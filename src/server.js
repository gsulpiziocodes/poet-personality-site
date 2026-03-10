import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { Resend } from "resend";

const app = express();
const port = process.env.PORT || 8790;
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "";

const resendApiKey = process.env.RESEND_API_KEY || "";
const leadsNotifyEmail = process.env.LEADS_NOTIFY_EMAIL || "";
const leadsFromEmail = process.env.LEADS_FROM_EMAIL || "onboarding@resend.dev";
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
  if (!resend || !leadsNotifyEmail) {
    return { sent: false, reason: "resend_not_configured" };
  }

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

function requireAdmin(req, res, next) {
  if (!adminPassword) {
    return res.status(503).send("ADMIN_PASSWORD is not configured.");
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Poet Personality Admin"');
    return res.status(401).send("Authentication required.");
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [user = "", pass = ""] = decoded.split(":");
  if (user !== adminUsername || pass !== adminPassword) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Poet Personality Admin"');
    return res.status(401).send("Invalid credentials.");
  }

  return next();
}

app.use(express.json({ limit: "256kb" }));
app.use(express.static(publicDir));

app.get("/api/content", async (_req, res) => {
  const raw = await fs.readFile(contentPath, "utf8");
  res.type("application/json").send(raw);
});

app.post("/api/lead", rateLimit({ keyPrefix: "lead", windowMs: 60_000, maxHits: 10 }), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

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

app.get("/admin", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), requireAdmin, async (_req, res) => {
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
</style></head><body><main class="wrap">
<h1>Admin Dashboard</h1>
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
