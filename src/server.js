import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Resend } from "resend";

const app = express();
const port = process.env.PORT || 8790;
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || `${adminUsername}:${adminPassword}:local`;

const resendApiKey = process.env.RESEND_API_KEY || "";
const leadsNotifyEmail = process.env.LEADS_NOTIFY_EMAIL || "";
const leadsFromEmail = process.env.LEADS_FROM_EMAIL || "onboarding@resend.dev";
const adminRecoveryEmail = process.env.ADMIN_RECOVERY_EMAIL || leadsNotifyEmail;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const contentPath = path.join(__dirname, "content", "poet-personality-content.json");
const dataDir = path.join(rootDir, "data");
const leadsPath = path.join(dataDir, "leads.jsonl");
const eventsPath = path.join(dataDir, "events.jsonl");

const rateState = new Map();
const adminRecoveryTokens = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)[0];
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit({ keyPrefix, windowMs, maxHits }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const now = Date.now();
    const current = rateState.get(key);

    if (!current || now > current.resetAt) {
      rateState.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxHits) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }

    current.count += 1;
    return next();
  };
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function makeAdminSessionToken() {
  return crypto.createHash("sha256").update(`${adminUsername}:${adminPassword}:${adminSessionSecret}`).digest("hex");
}

function requireAdminSession(req, res, next) {
  if (!adminPassword) return res.status(503).send("ADMIN_PASSWORD is not configured.");

  const cookies = parseCookies(req);
  if (cookies.admin_session === makeAdminSessionToken()) return next();

  return res.redirect("/admin/login");
}

async function appendJsonl(filePath, payload) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function readJsonl(filePath, limit = 200) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

async function notifyLead(lead) {
  if (!resend || !leadsNotifyEmail) return { sent: false, reason: "resend_not_configured" };

  await resend.emails.send({
    from: leadsFromEmail,
    to: leadsNotifyEmail,
    subject: `New Poet Personality lead: ${lead.email}`,
    html: `
      <h2>New Lead Captured</h2>
      <p><strong>Email:</strong> ${lead.email}</p>
      <p><strong>Source:</strong> ${lead.source}</p>
      <p><strong>Page:</strong> ${lead.page}</p>
      <p><strong>Timestamp:</strong> ${lead.ts}</p>
      <p><strong>User Agent:</strong> ${lead.ua}</p>
    `
  });

  return { sent: true };
}

async function sendAdminRecoveryEmail({ link, ip, ua }) {
  if (!resend || !adminRecoveryEmail) return { sent: false, reason: "recovery_not_configured" };

  await resend.emails.send({
    from: leadsFromEmail,
    to: adminRecoveryEmail,
    subject: "Poet Personality admin recovery link",
    html: `
      <h2>Admin recovery requested</h2>
      <p>Use this one-time sign-in link (valid for 15 minutes):</p>
      <p><a href="${link}">${link}</a></p>
      <p><strong>IP:</strong> ${ip}</p>
      <p><strong>User Agent:</strong> ${ua}</p>
    `
  });

  return { sent: true };
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

app.get("/api/content", async (_req, res) => {
  const raw = await fs.readFile(contentPath, "utf8");
  res.type("application/json").send(raw);
});

app.post("/api/lead", rateLimit({ keyPrefix: "lead", windowMs: 60_000, maxHits: 10 }), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "invalid_email" });

    const lead = {
      ts: new Date().toISOString(),
      email,
      source: req.body?.source || "unknown",
      page: req.body?.page || "",
      ua: req.headers["user-agent"] || ""
    };

    await appendJsonl(leadsPath, lead);

    let notify = { sent: false, reason: "not_attempted" };
    try {
      notify = await notifyLead(lead);
    } catch (error) {
      notify = { sent: false, reason: "notify_failed", details: error.message };
      await appendJsonl(eventsPath, {
        ts: new Date().toISOString(),
        name: "lead_notify_failed",
        page: lead.page,
        meta: { email: lead.email, error: error.message },
        ua: lead.ua
      });
    }

    return res.json({ ok: true, notify });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "lead_capture_failed", details: error.message });
  }
});

app.post("/api/events", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "invalid_event" });

    await appendJsonl(eventsPath, {
      ts: new Date().toISOString(),
      name,
      page: req.body?.page || "",
      meta: req.body?.meta || {},
      ua: req.headers["user-agent"] || ""
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "event_capture_failed", details: error.message });
  }
});

app.get("/admin/login", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), (req, res) => {
  const error = req.query?.error === "1";
  res.type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Admin Login</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#f8f4ec;color:#1f1a15;margin:0;display:grid;place-items:center;min-height:100vh}
.card{background:#fff;border:1px solid #e3d4bf;border-radius:12px;padding:18px;max-width:420px;width:100%}
label{display:block;font-size:14px;margin:10px 0 6px}
input{width:100%;padding:10px;border:1px solid #d8c8b1;border-radius:8px}
button{margin-top:14px;width:100%;padding:10px;border:0;border-radius:8px;background:#1f1a15;color:#fff;font-weight:600;cursor:pointer}
small{color:#6f6254}
.error{margin-top:10px;background:#fff1f0;color:#8a1f11;border:1px solid #f3c8c1;padding:9px;border-radius:8px}
.link{display:inline-block;margin-top:10px;color:#5b3b1e;text-decoration:underline}
</style></head><body>
<form class="card" method="post" action="/admin/login">
<h2>Poet Personality Admin</h2>
<small>Sign in to view leads and events.</small>
${error ? '<div class="error">Invalid username or password.</div>' : ""}
<label>Username</label>
<input name="username" autocomplete="username" required />
<label>Password</label>
<input name="password" type="password" autocomplete="current-password" required />
<button type="submit">Sign in</button>
<a class="link" href="/admin/recovery">Forgot password / recovery link</a>
</form></body></html>`);
});

app.post("/admin/login", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), (req, res) => {
  if (!adminPassword) return res.status(503).send("ADMIN_PASSWORD is not configured.");

  const user = String(req.body?.username || "");
  const pass = String(req.body?.password || "");
  if (user !== adminUsername || pass !== adminPassword) {
    return res.redirect("/admin/login?error=1");
  }

  const token = makeAdminSessionToken();
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secureFlag}`);
  return res.redirect("/admin");
});

app.post("/admin/logout", requireAdminSession, (req, res) => {
  res.setHeader("Set-Cookie", "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.redirect("/admin/login");
});

app.get("/admin/recovery", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), (req, res) => {
  const sent = req.query?.sent === "1";
  res.type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Admin Recovery</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#f8f4ec;color:#1f1a15;margin:0;display:grid;place-items:center;min-height:100vh}
.card{background:#fff;border:1px solid #e3d4bf;border-radius:12px;padding:18px;max-width:480px;width:100%}
label{display:block;font-size:14px;margin:10px 0 6px}
input{width:100%;padding:10px;border:1px solid #d8c8b1;border-radius:8px}
button{margin-top:14px;width:100%;padding:10px;border:0;border-radius:8px;background:#1f1a15;color:#fff;font-weight:600;cursor:pointer}
small{color:#6f6254}
.ok{margin-top:10px;background:#f2fff4;color:#205b2a;border:1px solid #c7efcf;padding:9px;border-radius:8px}
.link{display:inline-block;margin-top:10px;color:#5b3b1e;text-decoration:underline}
</style></head><body>
<form class="card" method="post" action="/admin/recovery">
<h2>Admin Recovery</h2>
<small>Request a one-time sign-in link sent to your configured recovery email.</small>
${sent ? '<div class="ok">If configured, a recovery link has been sent.</div>' : ""}
<label>Username</label>
<input name="username" autocomplete="username" required />
<button type="submit">Send recovery link</button>
<a class="link" href="/admin/login">Back to login</a>
</form></body></html>`);
});

app.post("/admin/recovery", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  const user = String(req.body?.username || "");
  if (user === adminUsername && resend && adminRecoveryEmail) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000;
    adminRecoveryTokens.set(token, expiresAt);

    const origin = `${req.protocol}://${req.get("host")}`;
    const link = `${origin}/admin/recovery/verify?token=${encodeURIComponent(token)}`;

    try {
      await sendAdminRecoveryEmail({ link, ip: getClientIp(req), ua: req.headers["user-agent"] || "" });
    } catch {
      // Avoid user enumeration or leaking email transport errors
    }
  }

  return res.redirect("/admin/recovery?sent=1");
});

app.get("/admin/recovery/verify", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), (req, res) => {
  const token = String(req.query?.token || "");
  const expiresAt = adminRecoveryTokens.get(token);
  if (!expiresAt || Date.now() > expiresAt) {
    if (token) adminRecoveryTokens.delete(token);
    return res.status(401).send('Recovery link is invalid or expired. <a href="/admin/recovery">Request a new one</a>.');
  }

  adminRecoveryTokens.delete(token);
  const session = makeAdminSessionToken();
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `admin_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secureFlag}`);
  return res.redirect("/admin");
});

app.get("/admin/leads.csv", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), requireAdminSession, async (_req, res) => {
  const leads = await readJsonl(leadsPath, 5000);
  const headers = ["ts", "email", "source", "page", "ua"];
  const rows = [headers.join(","), ...leads.map((lead) => headers.map((h) => csvEscape(lead[h])).join(","))];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"poet-personality-leads-${Date.now()}.csv\"`);
  res.send(rows.join("\n"));
});

app.get("/admin", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), requireAdminSession, async (_req, res) => {
  const [leads, events] = await Promise.all([readJsonl(leadsPath), readJsonl(eventsPath)]);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Poet Personality Admin</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#f8f4ec;color:#1f1a15;margin:0}
.wrap{max-width:1100px;margin:24px auto;padding:0 16px}
.card{background:#fff;border:1px solid #e3d4bf;border-radius:12px;padding:14px;margin:12px 0}
pre{white-space:pre-wrap;word-break:break-word;background:#faf6ef;border:1px solid #eadfce;padding:10px;border-radius:8px}
small{color:#6f6254}
.button{display:inline-block;background:#1f1a15;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:600;border:0;cursor:pointer}
.row{display:flex;gap:10px;align-items:center}
</style></head><body><main class="wrap">
<h1>Admin Dashboard</h1>
<div class="card"><div class="row"><a class="button" href="/admin/leads.csv">Export Leads CSV</a><form method="post" action="/admin/logout"><button class="button" type="submit">Sign out</button></form></div></div>
<div class="card"><h2>Leads (${leads.length})</h2>
${leads.map((x) => `<pre>${JSON.stringify(x, null, 2)}</pre>`).join("") || "<small>No leads yet.</small>"}
</div>
<div class="card"><h2>Events (${events.length})</h2>
${events.map((x) => `<pre>${JSON.stringify(x, null, 2)}</pre>`).join("") || "<small>No events yet.</small>"}
</div>
</main></body></html>`;

  res.type("html").send(html);
});

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/types", (_req, res) => res.sendFile(path.join(publicDir, "types.html")));
app.get("/type/:slug", (_req, res) => res.sendFile(path.join(publicDir, "type.html")));
app.get("/categories", (_req, res) => res.sendFile(path.join(publicDir, "categories.html")));
app.get("/results-demo", (_req, res) => res.sendFile(path.join(publicDir, "results.html")));

app.listen(port, () => console.log(`Poet Personality web running at http://localhost:${port}`));
