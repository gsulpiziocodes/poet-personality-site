import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;
const usingSupabase = Boolean(supabase);
let poemStorageUsingSupabase = Boolean(supabase);

if (poemStorageUsingSupabase) {
  try {
    const { error } = await supabase.from("poem_collections").select("id").limit(1);
    if (error) throw error;
  } catch {
    poemStorageUsingSupabase = false;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const contentPath = path.join(__dirname, "content", "poet-personality-content.json");
const contentData = JSON.parse(await fs.readFile(contentPath, "utf8"));
const typeBySlug = new Map((contentData.types || []).map((t) => [t.slug, t]));
const dataDir = path.join(rootDir, "data");
const leadsPath = path.join(dataDir, "leads.jsonl");
const eventsPath = path.join(dataDir, "events.jsonl");
const poemCollectionsPath = path.join(dataDir, "poem-collections.json");
const poemsPath = path.join(dataDir, "poems.jsonl");
const usersPath = path.join(dataDir, "users.json");
const userSessionSecret = process.env.USER_SESSION_SECRET || adminSessionSecret;

const rateState = new Map();
const adminRecoveryTokens = new Map();
const userResetTokens = new Map();

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

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 150000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function encodeSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", userSessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function decodeSession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", userSessionSecret).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.uid || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAdminSession(req, res, next) {
  if (!adminPassword) return res.status(503).send("ADMIN_PASSWORD is not configured.");

  const cookies = parseCookies(req);
  if (cookies.admin_session === makeAdminSessionToken()) return next();

  return res.redirect("/admin/login");
}

async function loadUserFromSession(req, _res, next) {
  const cookies = parseCookies(req);
  const payload = decodeSession(cookies.user_session);
  if (!payload) {
    req.user = null;
    return next();
  }

  req.user = await findUserById(payload.uid);
  return next();
}

function requireUserSession(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: "unauthorized" });
  return next();
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

async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function getUsers() {
  return readJson(usersPath, []);
}

async function findUserByEmail(email) {
  const users = await getUsers();
  return users.find((u) => normalizeEmail(u.email) === normalizeEmail(email)) || null;
}

async function findUserById(id) {
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || "",
    email: user.email,
    created_at: user.created_at,
    last_login_at: user.last_login_at || null,
    collection_tokens: Array.isArray(user.collection_tokens) ? user.collection_tokens : []
  };
}

async function createUser({ name, email, password }) {
  const users = await getUsers();
  if (users.some((u) => normalizeEmail(u.email) === normalizeEmail(email))) {
    throw new Error("email_exists");
  }

  const now = new Date().toISOString();
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim().slice(0, 120),
    email: normalizeEmail(email),
    password_salt: salt,
    password_hash: hash,
    created_at: now,
    last_login_at: now,
    collection_tokens: []
  };

  users.push(user);
  await writeJson(usersPath, users);
  return user;
}

async function verifyUserPassword({ email, password }) {
  const users = await getUsers();
  const user = users.find((u) => normalizeEmail(u.email) === normalizeEmail(email));
  if (!user) return null;

  const { hash } = hashPassword(password, user.password_salt);
  if (hash !== user.password_hash) return null;

  user.last_login_at = new Date().toISOString();
  await writeJson(usersPath, users);
  return user;
}

async function attachCollectionToUser({ userId, token }) {
  if (!userId || !token) return;
  const users = await getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  const existing = new Set(Array.isArray(user.collection_tokens) ? user.collection_tokens : []);
  existing.add(token);
  user.collection_tokens = Array.from(existing);
  await writeJson(usersPath, users);
}

async function updateUserPassword({ userId, password }) {
  const users = await getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return false;

  const { salt, hash } = hashPassword(password);
  user.password_salt = salt;
  user.password_hash = hash;
  user.updated_at = new Date().toISOString();
  await writeJson(usersPath, users);
  return true;
}

function makeCollectionToken() {
  return crypto.randomBytes(18).toString("hex");
}

function hashPoemText(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex");
}

function normalizePoemInput(raw, idx = 0) {
  const title = String(raw?.title || `Poem ${idx + 1}`).trim().slice(0, 160) || `Poem ${idx + 1}`;
  const text = String(raw?.text || "").trim();
  const status = raw?.status === "draft" ? "draft" : "final";
  return { title, text, status };
}

async function saveLead(lead) {
  if (!supabase) {
    await appendJsonl(leadsPath, lead);
    return;
  }

  const { error } = await supabase.from("leads").insert({
    ts: lead.ts,
    email: lead.email,
    source: lead.source,
    page: lead.page,
    ua: lead.ua
  });
  if (error) throw error;
}

async function saveEvent(event) {
  if (!supabase) {
    await appendJsonl(eventsPath, event);
    return;
  }

  const { error } = await supabase.from("events").insert({
    ts: event.ts,
    name: event.name,
    page: event.page,
    meta: event.meta,
    ua: event.ua
  });
  if (error) throw error;
}

async function getLeads(limit = 200) {
  if (!supabase) return readJsonl(leadsPath, limit);

  const { data, error } = await supabase
    .from("leads")
    .select("ts,email,source,page,ua")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getEvents(limit = 200) {
  if (!supabase) return readJsonl(eventsPath, limit);

  const { data, error } = await supabase
    .from("events")
    .select("ts,name,page,meta,ua")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getCollection(token) {
  if (!token) return null;

  if (!poemStorageUsingSupabase) {
    const collections = await readJson(poemCollectionsPath, []);
    return collections.find((x) => x.token === token) || null;
  }

  const { data, error } = await supabase.from("poem_collections").select("id,token,email,created_at,updated_at").eq("token", token).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function createOrUpdateCollection({ token, email }) {
  const now = new Date().toISOString();

  if (!poemStorageUsingSupabase) {
    const collections = await readJson(poemCollectionsPath, []);
    let current = collections.find((x) => x.token === token);
    if (!current) {
      current = { id: crypto.randomUUID(), token, email: email || null, created_at: now, updated_at: now };
      collections.push(current);
    } else {
      current.updated_at = now;
      if (email) current.email = email;
    }
    await writeJson(poemCollectionsPath, collections);
    return current;
  }

  let existing = await getCollection(token);
  if (!existing) {
    const { data, error } = await supabase
      .from("poem_collections")
      .insert({ token, email: email || null })
      .select("id,token,email,created_at,updated_at")
      .single();
    if (error) throw error;
    return data;
  }

  const patch = { updated_at: now };
  if (email) patch.email = email;

  const { data, error } = await supabase
    .from("poem_collections")
    .update(patch)
    .eq("id", existing.id)
    .select("id,token,email,created_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

async function getPoemsByCollectionToken(token) {
  if (!token) return [];

  if (!poemStorageUsingSupabase) {
    const poems = await readJson(poemsPath, []);
    return poems.filter((x) => x.collection_token === token).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }

  const { data, error } = await supabase
    .from("poems")
    .select("id,collection_id,title,text,status,text_hash,created_at,updated_at")
    .eq("collection_token", token)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function upsertPoem({ collection, poem }) {
  const now = new Date().toISOString();
  const textHash = hashPoemText(poem.text);

  if (!poemStorageUsingSupabase) {
    const poems = await readJson(poemsPath, []);
    const existing = poems.find((x) => x.collection_token === collection.token && (x.id === poem.id || x.text_hash === textHash));
    if (existing) {
      existing.title = poem.title;
      existing.text = poem.text;
      existing.status = poem.status;
      existing.text_hash = textHash;
      existing.updated_at = now;
      await writeJson(poemsPath, poems);
      return { row: existing, inserted: false, deduped: existing.id !== poem.id && !!poem.id === false };
    }

    const row = {
      id: poem.id || crypto.randomUUID(),
      collection_token: collection.token,
      title: poem.title,
      text: poem.text,
      status: poem.status,
      text_hash: textHash,
      created_at: now,
      updated_at: now
    };
    poems.push(row);
    await writeJson(poemsPath, poems);
    return { row, inserted: true, deduped: false };
  }

  if (poem.id) {
    const { data, error } = await supabase
      .from("poems")
      .update({ title: poem.title, text: poem.text, status: poem.status, text_hash: textHash, updated_at: now })
      .eq("id", poem.id)
      .eq("collection_id", collection.id)
      .select("id,collection_id,title,text,status,text_hash,created_at,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (data) return { row: data, inserted: false, deduped: false };
  }

  const { data: existing, error: existingError } = await supabase
    .from("poems")
    .select("id,collection_id,title,text,status,text_hash,created_at,updated_at")
    .eq("collection_id", collection.id)
    .eq("text_hash", textHash)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { row: existing, inserted: false, deduped: true };

  const { data, error } = await supabase
    .from("poems")
    .insert({
      collection_id: collection.id,
      collection_token: collection.token,
      title: poem.title,
      text: poem.text,
      status: poem.status,
      text_hash: textHash
    })
    .select("id,collection_id,title,text,status,text_hash,created_at,updated_at")
    .single();
  if (error) throw error;
  return { row: data, inserted: true, deduped: false };
}

async function deletePoem({ token, poemId }) {
  if (!poemStorageUsingSupabase) {
    const poems = await readJson(poemsPath, []);
    const next = poems.filter((x) => !(x.collection_token === token && x.id === poemId));
    await writeJson(poemsPath, next);
    return poems.length !== next.length;
  }

  const collection = await getCollection(token);
  if (!collection) return false;
  const { data, error } = await supabase
    .from("poems")
    .delete()
    .eq("collection_id", collection.id)
    .eq("id", poemId)
    .select("id");
  if (error) throw error;
  return (data || []).length > 0;
}

async function getPoemStats() {
  if (!poemStorageUsingSupabase) {
    const collections = await readJson(poemCollectionsPath, []);
    const poems = await readJson(poemsPath, []);
    const draftCount = poems.filter((x) => x.status === "draft").length;
    return {
      collections: collections.length,
      poems: poems.length,
      drafts: draftCount,
      finalized: poems.length - draftCount
    };
  }

  const [{ count: collectionCount, error: cErr }, { count: poemCount, error: pErr }, { count: draftCount, error: dErr }] = await Promise.all([
    supabase.from("poem_collections").select("id", { count: "exact", head: true }),
    supabase.from("poems").select("id", { count: "exact", head: true }),
    supabase.from("poems").select("id", { count: "exact", head: true }).eq("status", "draft")
  ]);
  if (cErr || pErr || dErr) throw cErr || pErr || dErr;

  const poemsTotal = poemCount || 0;
  const drafts = draftCount || 0;
  return { collections: collectionCount || 0, poems: poemsTotal, drafts, finalized: poemsTotal - drafts };
}

async function getRecentPoems(limit = 200) {
  if (!poemStorageUsingSupabase) {
    const poems = await readJson(poemsPath, []);
    return poems.slice(-limit).reverse();
  }

  const { data, error } = await supabase
    .from("poems")
    .select("id,collection_token,title,text,status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
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

async function sendSignupConfirmationEmail({ email, name, origin }) {
  if (!resend || !leadsFromEmail) return { sent: false, reason: "email_not_configured" };

  const safeName = String(name || "there").trim() || "there";
  const appOrigin = String(origin || "").trim();
  const analyzeUrl = appOrigin ? `${appOrigin}/analyze` : "#";

  await resend.emails.send({
    from: leadsFromEmail,
    to: email,
    subject: "Welcome to Poet Personality ✨",
    html: `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#201a15;max-width:560px;margin:0 auto;padding:20px;">
        <h2 style="margin:0 0 10px;">Hey ${safeName}, your account is ready.</h2>
        <p style="margin:0 0 12px;">Thanks for creating your Poet Personality account. You can now save your writing, revisit your analysis, and keep building your profile over time.</p>
        <p style="margin:0 0 16px;"><a href="${analyzeUrl}" style="display:inline-block;background:#7a4416;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;">Start analyzing poems</a></p>
        <p style="margin:0 0 8px;color:#6f6254;font-size:14px;">If you didn’t create this account, you can ignore this email.</p>
        <p style="margin:0;color:#6f6254;font-size:14px;">— Poet Personality</p>
      </div>
    `
  });

  return { sent: true };
}

async function sendAnalysisResultEmail({ email, analysis, poemCount, origin }) {
  if (!resend || !leadsFromEmail) return { sent: false, reason: "email_not_configured" };

  const appOrigin = String(origin || "").trim();
  const typeUrl = analysis?.personalitySlug && appOrigin ? `${appOrigin}/type/${analysis.personalitySlug}` : appOrigin || "#";

  await resend.emails.send({
    from: leadsFromEmail,
    to: email,
    subject: `Your Poet Personality result: ${analysis?.personalityTitle || "Archetype"}`,
    html: `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#201a15;max-width:600px;margin:0 auto;padding:20px;">
        <p style="margin:0 0 8px;color:#6f6254;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Poet Personality Analysis</p>
        <h2 style="margin:0 0 10px;">${analysis?.personalityTitle || "Your result"}</h2>
        <p style="margin:0 0 12px;">${analysis?.summary || "Your poetic identity is emerging."}</p>
        <p style="margin:0 0 14px;color:#6f6254;font-size:14px;">Based on ${poemCount || 0} submitted poem${poemCount === 1 ? "" : "s"}.</p>
        <div style="background:#faf6ef;border:1px solid #e9dece;border-radius:12px;padding:12px 14px;margin:0 0 16px;">
          <p style="margin:0;"><strong>Why this fits:</strong> ${analysis?.commentary || ""}</p>
        </div>
        <p style="margin:0 0 16px;"><a href="${typeUrl}" style="display:inline-block;background:#7a4416;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;">Open your full profile</a></p>
        <p style="margin:0;color:#6f6254;font-size:14px;">Keep writing and re-run your analysis anytime to increase confidence in your profile.</p>
      </div>
    `
  });

  return { sent: true };
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildStyleProfileFromPoems(poems = []) {
  const texts = (poems || []).map((p) => String(p?.text || "").trim()).filter(Boolean);
  const corpus = texts.join("\n");
  const lines = corpus.split("\n").map((x) => x.trim()).filter(Boolean);
  const words = corpus.toLowerCase().match(/[a-z']+/g) || [];

  const avgLineWords = lines.length
    ? Number((lines.reduce((sum, line) => sum + line.split(/\s+/).filter(Boolean).length, 0) / lines.length).toFixed(1))
    : 0;
  const avgSentenceWords = (() => {
    const sentences = corpus.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    if (!sentences.length) return 0;
    return Number((sentences.reduce((sum, s) => sum + (s.match(/[a-z']+/gi) || []).length, 0) / sentences.length).toFixed(1));
  })();

  const pronounI = words.filter((w) => w === "i" || w === "me" || w === "my").length;
  const pronounYou = words.filter((w) => w === "you" || w === "your").length;
  const questionLines = lines.filter((l) => l.includes("?")).length;

  const stop = new Set(["the", "and", "a", "to", "of", "in", "is", "it", "that", "for", "on", "with", "as", "at", "by", "an", "be", "this", "from", "or", "are", "was", "were", "but", "not", "have", "has", "had", "i", "you", "my", "me", "your"]);
  const freq = new Map();
  for (const w of words) {
    if (w.length < 4 || stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const signatureWords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([w]) => w);

  const snippets = texts
    .flatMap((text) => text.split("\n").map((line) => line.trim()).filter((line) => line.length >= 28 && line.length <= 150))
    .slice(0, 8);

  return {
    poemCount: texts.length,
    lineCount: lines.length,
    avgLineWords,
    avgSentenceWords,
    questionLineRate: lines.length ? Number((questionLines / lines.length).toFixed(3)) : 0,
    firstPersonRate: words.length ? Number((pronounI / words.length).toFixed(3)) : 0,
    secondPersonRate: words.length ? Number((pronounYou / words.length).toFixed(3)) : 0,
    signatureWords,
    snippets
  };
}

function analyzePoemCorpus(poems = [], options = {}) {
  const deep = Boolean(options?.deep);
  const corpus = poems.map((p) => String(p?.text || "").trim()).filter(Boolean).join("\n");
  const words = corpus.toLowerCase().match(/[a-z']+/g) || [];
  const lines = corpus.split("\n").map((x) => x.trim()).filter(Boolean);

  const lexicons = {
    "the-alchemist": ["transform", "change", "become", "heal", "wound", "rebirth", "alchemy", "ash", "blood"],
    "the-oracle": ["prophecy", "vision", "omen", "myth", "symbol", "fate", "star", "cosmos", "oracle"],
    "the-architect": ["form", "structure", "measure", "line", "frame", "craft", "design", "pattern"],
    "the-seeker": ["why", "search", "meaning", "question", "truth", "time", "if", "becoming", "path"],
    "the-lover": ["love", "heart", "kiss", "beloved", "desire", "touch", "longing", "tender"],
    "the-dreamer": ["dream", "moon", "mist", "sleep", "memory", "haze", "luminous", "soft"],
    "the-muse": ["beauty", "art", "song", "lyric", "inspire", "grace", "color", "melody"],
    "the-devotee": ["prayer", "sacred", "faith", "ritual", "reverence", "devotion", "altar"],
    "the-confessor": ["i", "me", "my", "shame", "confess", "secret", "naked", "honest"],
    "the-witness": ["street", "window", "city", "kitchen", "room", "table", "hands", "morning"],
    "the-rebel": ["rage", "refuse", "break", "riot", "resist", "burn", "fight", "against"],
    "the-mourner": ["grief", "loss", "absence", "mourning", "funeral", "shadow", "empty", "gone"],
    "the-storyteller": ["then", "before", "after", "once", "character", "scene", "road", "journey"],
    "the-minimalist": ["spare", "quiet", "white", "small", "still", "clean", "plain", "single"],
    "the-performer": ["voice", "crowd", "stage", "rhythm", "breath", "beat", "shout", "mic"],
    "the-weaver": ["thread", "weave", "layer", "braid", "echo", "interlace", "pattern", "tapestry"]
  };

  const scoreLexicon = (list) => words.reduce((n, w) => n + (list.includes(w) ? 1 : 0), 0);
  const scores = Object.fromEntries(Object.entries(lexicons).map(([k, v]) => [k, scoreLexicon(v)]));

  const questionRate = lines.length ? lines.filter((l) => l.includes("?")).length / lines.length : 0;
  const avgLineLength = lines.length ? lines.reduce((a, l) => a + l.split(/\s+/).filter(Boolean).length, 0) / lines.length : 0;

  if (avgLineLength <= 5) scores["the-minimalist"] += 2;
  if (questionRate > 0.14) scores["the-seeker"] += 2;
  if (avgLineLength > 12) scores["the-storyteller"] += 1;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topSlug = ranked[0]?.[0] || "the-seeker";
  const topType = typeBySlug.get(topSlug) || { name: "The Seeker", overview: "A reflective poet drawn to meaning and open questions." };
  const top3Themes = ranked.slice(0, 3).map(([slug]) => (typeBySlug.get(slug)?.name || slug));

  const tone = topSlug === "the-lover" ? "tender and ardent"
    : topSlug === "the-mourner" ? "elegiac and vulnerable"
    : topSlug === "the-architect" ? "controlled and deliberate"
    : topSlug === "the-dreamer" ? "atmospheric and luminous"
    : topSlug === "the-rebel" ? "urgent and defiant"
    : topSlug === "the-witness" ? "grounded and observant"
    : "reflective and searching";

  const explanation = `Across ${poems.length} poem${poems.length === 1 ? "" : "s"}, your writing most strongly aligns with ${topType.name}. ${topType.overview || ""}\n\nYou repeatedly return to ${top3Themes.join(", ")} energies, suggesting a stable poetic identity rather than a one-off mood. Emotionally, the voice feels ${tone}, with a recurring movement from sensation toward interpretation.\n\nIn structure, your line behavior (avg ${avgLineLength.toFixed(1)} words per line) and question cadence (${(questionRate * 100).toFixed(1)}% of lines) reinforce this archetype. The tonal through-line and thematic recurrence suggest a recognizable worldview and signature poetic instinct.`;

  const allLines = poems.flatMap((poem) =>
    String(poem?.text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );

  const scoreLine = (line) => {
    const lineWords = (line.match(/[a-z']+/gi) || []).length;
    const sensoryHits = (line.match(/(smell|taste|touch|salt|fire|ash|street|window|blood|skin|rain|city|voice|light|shadow)/gi) || []).length;
    const contrastHits = (line.match(/(but|yet|while|although|though|another|against)/gi) || []).length;
    return lineWords + sensoryHits * 2 + contrastHits;
  };

  const bestLines = [...new Set(allLines)]
    .filter((line) => {
      const lineWords = (line.match(/[a-z']+/gi) || []).length;
      return lineWords >= 5 && lineWords <= 22;
    })
    .map((line) => ({ line, score: scoreLine(line) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ line }) => ({
      line,
      why: "This line carries emotional and sensory weight while advancing the poem's central tension. It balances image and meaning without over-explaining."
    }));

  const firstPersonRate = words.length ? (words.filter((w) => w === "i" || w === "me" || w === "my").length / words.length) : 0;
  const secondPersonRate = words.length ? (words.filter((w) => w === "you" || w === "your").length / words.length) : 0;

  const whatWorks = [
    `A clear, authentic voice with strong ${topType.name} energy across multiple poems.`,
    `Concrete imagery gives emotional ideas a place to land.`,
    `Tonal consistency (${tone}) makes the work feel cohesive rather than scattered.`,
    `The poems stay readable and emotionally immediate while still carrying depth.`
  ];

  const whatToImprove = [
    "Sharpen one central metaphor per poem and let nearby images revolve around it.",
    "Tighten lineation: use punctuation and deliberate enjambment to guide breath and emphasis.",
    "Replace general statements with specific, surprising details from lived scenes.",
    "Prune weak modifiers and passive phrasing; choose stronger verbs for immediacy.",
    "Create more tension between images so each stanza complicates what came before.",
    "Aim for a clearer arc (arrival, encounter, shift, reveal) so endings feel earned."
  ];

  const poetInferences = [
    firstPersonRate > 0.03
      ? "You favor first-person perspective to build emotional intimacy."
      : "You often keep a slight observational distance, which can make scenes feel cinematic.",
    secondPersonRate > 0.02
      ? "You use direct address effectively to pull the reader (or subject) into the poem."
      : "Your voice tends to imply the listener rather than naming them directly.",
    avgLineLength > 10
      ? "You lean toward conversational, sentence-led line breaks over strict formal compression."
      : "You show a compression instinct—shorter lines that prioritize pressure and precision.",
    "You are drawn to metaphor, and your strongest moments connect image with social or emotional observation."
  ];

  const imageryDensity = words.length ? Math.min(100, Math.round((allLines.join(" ").match(/(like|as|as if|as though|image|shadow|light|street|window|body|fire|water|ash|dream)/gi)?.length || 0) / Math.max(1, allLines.length) * 22)) : 0;

  const styleSnapshot = {
    diction: "Accessible, image-forward diction with occasional elevated language for emphasis.",
    syntax: avgLineLength > 10
      ? "Conversational syntax with sentence-driven momentum and flexible punctuation."
      : "Compressed syntax with short, intentional units and restrained phrasing.",
    imageryDensity: `${imageryDensity}% (moderate-to-high image concentration across lines).`,
    tone,
    themes: top3Themes,
    form: "Primarily free verse with voice-led lineation and variable stanza movement.",
    rhythm: avgLineLength > 10
      ? "Loose conversational cadence driven by syntax and thought turns."
      : "Tighter cadence with emphasis on line pressure and pauses."
  };

  const poetRecsBySlug = {
    "the-alchemist": ["Sylvia Plath", "Ocean Vuong", "Seamus Heaney"],
    "the-oracle": ["Emily Dickinson", "T. S. Eliot", "Rainer Maria Rilke"],
    "the-architect": ["Elizabeth Bishop", "Robert Frost", "Louise Glück"],
    "the-seeker": ["Mary Oliver", "Walt Whitman", "Rainer Maria Rilke"],
    "the-lover": ["Pablo Neruda", "Sappho", "Ada Limón"],
    "the-dreamer": ["John Keats", "Matsuo Bashō", "Ocean Vuong"],
    "the-muse": ["Mary Oliver", "Pablo Neruda", "Louise Glück"],
    "the-devotee": ["Mary Oliver", "Rumi", "Wendell Berry"],
    "the-confessor": ["Anne Sexton", "Sylvia Plath", "Sharon Olds"],
    "the-witness": ["Gwendolyn Brooks", "Langston Hughes", "Elizabeth Bishop"],
    "the-rebel": ["Audre Lorde", "Allen Ginsberg", "Adrienne Rich"],
    "the-mourner": ["W. H. Auden", "Natasha Trethewey", "Louise Glück"],
    "the-storyteller": ["Frank O'Hara", "Langston Hughes", "Maya Angelou"],
    "the-minimalist": ["Matsuo Bashō", "Emily Dickinson", "William Carlos Williams"],
    "the-performer": ["Maya Angelou", "Gil Scott-Heron", "Langston Hughes"],
    "the-weaver": ["Adrienne Rich", "T. S. Eliot", "Agha Shahid Ali"]
  };

  const recommendedPoets = (poetRecsBySlug[topSlug] || ["Mary Oliver", "Frank O'Hara", "Ocean Vuong"]).map((name, idx) => ({
    name,
    match: Math.max(70, 92 - idx * 8),
    why: idx === 0
      ? `Top style alignment for your current ${topType.name} profile.`
      : idx === 1
        ? "Strong model for tightening image-to-meaning movement and tonal control."
        : "Improvement pick for deeper metaphor development and rhythmic precision.",
    notableWorks: idx === 0
      ? ["Selected Poems", "Signature Collection"]
      : idx === 1
        ? ["Key Poems", "Collected Works"]
        : ["Recent Collection", "Selected Lyrics"]
  }));

  const similarPoems = recommendedPoets.map((poet, idx) => ({
    title: idx === 0 ? "Primary style match" : idx === 1 ? "Precision + compression model" : "Growth model",
    poet: poet.name,
    styleMatch: poet.match,
    reason: poet.why
  }));

  const nextReads = [
    `${recommendedPoets[0]?.name || "Mary Oliver"} — selected poems`,
    `${recommendedPoets[1]?.name || "Frank O'Hara"} — key shorter works`,
    `${recommendedPoets[2]?.name || "Ocean Vuong"} — contemporary lyric selections`,
    "An anthology of city and place-based poems",
    "A craft text focused on line breaks and revision"
  ];

  const uniqueWordCount = new Set(words).size;
  const lexicalRatio = words.length ? uniqueWordCount / words.length : 0;
  const lineStdDev = (() => {
    if (!lines.length) return 0;
    const lengths = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
    const variance = lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length;
    return Math.sqrt(variance);
  })();

  const deepDive = deep
    ? {
        patternSummary: `Your poems show a ${topType.name} center with ${top3Themes.join(", ")} pressure points. The voice remains ${tone}, while structure swings between compression and release.`,
        lexicalVariation: `${Math.round(lexicalRatio * 100)}% unique-word ratio (${uniqueWordCount} distinct words across ${words.length} total words).`,
        emotionalBalance: `First-person rate ${(firstPersonRate * 100).toFixed(1)}% vs second-person ${(secondPersonRate * 100).toFixed(1)}% suggests ${firstPersonRate > secondPersonRate ? "inward processing" : "outward address"} as your default emotional stance.`,
        lineShape: `Average line length ${avgLineLength.toFixed(1)} words with variance ${lineStdDev.toFixed(1)} indicates ${lineStdDev > 4 ? "high rhythmic swing" : "controlled rhythmic consistency"}.`,
        revisionFocus: `For your next draft, keep ${topType.name} tone but tighten one stanza around a single recurring image, then add one deliberate tonal pivot in the final third.`
      }
    : null;

  return {
    personalityKey: topSlug,
    personalitySlug: topSlug,
    personalityTitle: topType.name,
    summary: topType.shortBlurb || topType.subtitle || topType.overview || "A distinct poetic identity is emerging in your work.",
    commentary: explanation,
    observations: {
      recurringThemes: top3Themes,
      emotionalPattern: tone,
      imageryAndTone: `Your imagery and symbolic motifs align with ${topType.name}, with consistent tonal intent across poems.`,
      structureAndVoice: `Average line length ${avgLineLength.toFixed(1)}; question-line rate ${(questionRate * 100).toFixed(1)}%.`,
      worldview: `Your poems collectively prioritize the sensibility of ${topType.name}.`
    },
    bestLines,
    whatWorks,
    whatToImprove,
    poetInferences,
    styleSnapshot,
    recommendedPoets,
    similarPoems,
    nextReads,
    deepDive
  };
}

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(loadUserFromSession);
app.use(express.static(publicDir));

app.get("/api/content", async (_req, res) => {
  const raw = await fs.readFile(contentPath, "utf8");
  res.type("application/json").send(raw);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storage: usingSupabase ? "supabase" : "jsonl" });
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

    await saveLead(lead);

    let notify = { sent: false, reason: "not_attempted" };
    try {
      notify = await notifyLead(lead);
    } catch (error) {
      notify = { sent: false, reason: "notify_failed", details: error.message };
      await saveEvent({
        ts: new Date().toISOString(),
        name: "lead_notify_failed",
        page: lead.page,
        meta: { email: lead.email, error: error.message },
        ua: lead.ua
      });
    }

    return res.json({ ok: true, notify, storage: usingSupabase ? "supabase" : "jsonl" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "lead_capture_failed", details: error.message });
  }
});

app.post("/api/events", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "invalid_event" });

    await saveEvent({
      ts: new Date().toISOString(),
      name,
      page: req.body?.page || "",
      meta: req.body?.meta || {},
      ua: req.headers["user-agent"] || ""
    });

    return res.json({ ok: true, storage: usingSupabase ? "supabase" : "jsonl" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "event_capture_failed", details: error.message });
  }
});

app.get("/api/poems", rateLimit({ keyPrefix: "poems", windowMs: 60_000, maxHits: 40 }), async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    const collection = await getCollection(token);
    if (!collection) return res.status(404).json({ ok: false, error: "collection_not_found" });

    const poems = await getPoemsByCollectionToken(token);
    return res.json({ ok: true, collection: { token: collection.token, email: collection.email || null }, poems });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "poems_fetch_failed", details: error.message });
  }
});

app.post("/api/poems/batch", rateLimit({ keyPrefix: "poems", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    const providedToken = String(req.body?.collectionToken || "").trim();
    const token = providedToken || makeCollectionToken();
    const email = String(req.body?.email || "").trim().toLowerCase() || null;
    const incomingPoems = Array.isArray(req.body?.poems) ? req.body.poems : [];

    if (!incomingPoems.length) return res.status(400).json({ ok: false, error: "empty_batch" });
    if (incomingPoems.length > 100) return res.status(400).json({ ok: false, error: "too_many_poems" });

    const collection = await createOrUpdateCollection({ token, email });
    if (req.user?.id) await attachCollectionToUser({ userId: req.user.id, token });
    const existing = await getPoemsByCollectionToken(token);
    if (existing.length > 100) return res.status(400).json({ ok: false, error: "collection_limit_reached" });

    const normalized = incomingPoems.map((x, i) => ({ ...normalizePoemInput(x, i), id: x?.id ? String(x.id) : null }));
    for (const poem of normalized) {
      if (!poem.text) return res.status(400).json({ ok: false, error: "empty_poem_text" });
      if (poem.text.length > 10_000) return res.status(400).json({ ok: false, error: "poem_too_long" });
    }

    const existingIds = new Set(existing.map((x) => x.id));
    const newCount = normalized.filter((x) => !x.id || !existingIds.has(x.id)).length;
    if (existing.length + newCount > 100) return res.status(400).json({ ok: false, error: "collection_limit_exceeded" });

    let inserted = 0;
    let updated = 0;
    let deduped = 0;
    const saved = [];

    for (const poem of normalized) {
      const result = await upsertPoem({ collection, poem });
      saved.push(result.row);
      if (result.deduped) deduped += 1;
      else if (result.inserted) inserted += 1;
      else updated += 1;
    }

    const allPoems = await getPoemsByCollectionToken(token);
    return res.json({
      ok: true,
      message: "Saved",
      returnLink: `/my-poems/${token}`,
      collection: { token, email: collection.email || null },
      counts: { inserted, updated, deduped, total: allPoems.length },
      poems: allPoems
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "poems_save_failed", details: error.message });
  }
});

app.delete("/api/poems/:poemId", rateLimit({ keyPrefix: "poems", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    const token = String(req.query?.token || req.body?.token || "").trim();
    const poemId = String(req.params?.poemId || "").trim();
    if (!token || !poemId) return res.status(400).json({ ok: false, error: "missing_token_or_poem_id" });

    const deleted = await deletePoem({ token, poemId });
    if (!deleted) return res.status(404).json({ ok: false, error: "poem_not_found" });

    return res.json({ ok: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "poem_delete_failed", details: error.message });
  }
});

app.get("/api/style-profile", rateLimit({ keyPrefix: "poems", windowMs: 60_000, maxHits: 30 }), async (req, res) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

    const poems = await getPoemsByCollectionToken(token);
    const valid = poems
      .map((p) => ({ text: String(p?.text || "").trim() }))
      .filter((p) => p.text);

    if (!valid.length) return res.json({ ok: true, profile: buildStyleProfileFromPoems([]) });

    return res.json({ ok: true, profile: buildStyleProfileFromPoems(valid) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "style_profile_failed", details: error.message });
  }
});

app.post("/api/poems/analyze", rateLimit({ keyPrefix: "poems", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    let poems = Array.isArray(req.body?.poems) ? req.body.poems : [];
    const token = String(req.body?.collectionToken || "").trim();
    const email = normalizeEmail(req.body?.email);
    const deep = Boolean(req.body?.deep);

    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (!poems.length && token) poems = await getPoemsByCollectionToken(token);

    const valid = poems
      .map((p) => ({ title: String(p?.title || ""), text: String(p?.text || "").trim() }))
      .filter((p) => p.text);

    if (!valid.length) return res.status(400).json({ ok: false, error: "no_poems_to_analyze" });

    const analysis = analyzePoemCorpus(valid, { deep });

    let emailSent = false;
    let emailReason = "not_attempted";
    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const sent = await sendAnalysisResultEmail({ email, analysis, poemCount: valid.length, origin });
      emailSent = !!sent?.sent;
      emailReason = sent?.reason || "ok";
    } catch (error) {
      emailReason = "send_failed";
      await saveEvent({
        ts: new Date().toISOString(),
        name: "analysis_email_failed",
        page: "/analyze",
        meta: { email, error: error.message },
        ua: req.headers["user-agent"] || ""
      });
    }

    return res.json({ ok: true, analysis, poemCount: valid.length, emailSent, emailReason });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "analysis_failed", details: error.message });
  }
});

app.post("/api/auth/register", rateLimit({ keyPrefix: "auth", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!name) return res.status(400).json({ ok: false, error: "invalid_name" });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "invalid_email" });
    if (password.length < 8) return res.status(400).json({ ok: false, error: "password_too_short" });

    const user = await createUser({ name, email, password });
    const token = encodeSession({ uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `user_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`);

    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      await sendSignupConfirmationEmail({ email: user.email, name: user.name, origin });
    } catch (error) {
      await saveEvent({
        ts: new Date().toISOString(),
        name: "signup_confirmation_email_failed",
        page: "/account",
        meta: { email: user.email, error: error.message },
        ua: req.headers["user-agent"] || ""
      });
    }

    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (error) {
    const status = error.message === "email_exists" ? 409 : 500;
    return res.status(status).json({ ok: false, error: error.message || "register_failed" });
  }
});

app.post("/api/auth/login", rateLimit({ keyPrefix: "auth", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const user = await verifyUserPassword({ email, password });
    if (!user) return res.status(401).json({ ok: false, error: "invalid_credentials" });

    const token = encodeSession({ uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `user_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secureFlag}`);
    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "login_failed", details: error.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "user_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  return res.json({ ok: true, user: toPublicUser(req.user) });
});

app.post("/api/auth/link-collection", requireUserSession, async (req, res) => {
  try {
    const token = String(req.body?.collectionToken || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "missing_collection_token" });

    const collection = await getCollection(token);
    if (!collection) return res.status(404).json({ ok: false, error: "collection_not_found" });

    await attachCollectionToUser({ userId: req.user.id, token });
    const user = await findUserById(req.user.id);
    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "link_failed", details: error.message });
  }
});

app.post("/api/auth/forgot-password", rateLimit({ keyPrefix: "auth", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "invalid_email" });

    const user = await findUserByEmail(email);
    if (user) {
      const token = crypto.randomBytes(24).toString("hex");
      const exp = Date.now() + 30 * 60 * 1000;
      userResetTokens.set(token, { userId: user.id, exp });

      if (resend && leadsFromEmail) {
        const origin = `${req.protocol}://${req.get("host")}`;
        const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
        try {
          await resend.emails.send({
            from: leadsFromEmail,
            to: email,
            subject: "Reset your Poet Personality password",
            html: `<p>You requested a password reset.</p><p><a href="${link}">Reset your password</a></p><p>This link expires in 30 minutes.</p>`
          });
        } catch {
          // Do not leak transport errors in response
        }
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "forgot_password_failed", details: error.message });
  }
});

app.get("/api/auth/reset-password/validate", rateLimit({ keyPrefix: "auth", windowMs: 60_000, maxHits: 40 }), (req, res) => {
  const token = String(req.query?.token || "").trim();
  const current = userResetTokens.get(token);
  if (!token || !current || Date.now() > current.exp) {
    if (token) userResetTokens.delete(token);
    return res.status(400).json({ ok: false, error: "invalid_or_expired_token" });
  }
  return res.json({ ok: true });
});

app.post("/api/auth/reset-password", rateLimit({ keyPrefix: "auth", windowMs: 60_000, maxHits: 20 }), async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    const current = userResetTokens.get(token);

    if (!token || !current || Date.now() > current.exp) {
      if (token) userResetTokens.delete(token);
      return res.status(400).json({ ok: false, error: "invalid_or_expired_token" });
    }

    if (password.length < 8) return res.status(400).json({ ok: false, error: "password_too_short" });

    const updated = await updateUserPassword({ userId: current.userId, password });
    userResetTokens.delete(token);
    if (!updated) return res.status(404).json({ ok: false, error: "user_not_found" });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "reset_password_failed", details: error.message });
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
  if (user !== adminUsername || pass !== adminPassword) return res.redirect("/admin/login?error=1");

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
  const leads = await getLeads(5000);
  const headers = ["ts", "email", "source", "page", "ua"];
  const rows = [headers.join(","), ...leads.map((lead) => headers.map((h) => csvEscape(lead[h])).join(","))];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"poet-personality-leads-${Date.now()}.csv\"`);
  res.send(rows.join("\n"));
});

app.get("/admin", rateLimit({ keyPrefix: "admin", windowMs: 60_000, maxHits: 20 }), requireAdminSession, async (_req, res) => {
  const [leads, events, poemStats, poems] = await Promise.all([getLeads(), getEvents(), getPoemStats(), getRecentPoems()]);

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
<div class="card"><small>Storage backend: ${usingSupabase ? "Supabase" : "Local JSONL"}</small></div>
<div class="card"><div class="row"><a class="button" href="/admin/leads.csv">Export Leads CSV</a><form method="post" action="/admin/logout"><button class="button" type="submit">Sign out</button></form></div></div>
<div class="card"><h2>Leads (${leads.length})</h2>
${leads.map((x) => `<pre>${JSON.stringify(x, null, 2)}</pre>`).join("") || "<small>No leads yet.</small>"}
</div>
<div class="card"><h2>Events (${events.length})</h2>
${events.map((x) => `<pre>${JSON.stringify(x, null, 2)}</pre>`).join("") || "<small>No events yet.</small>"}
</div>
<div class="card"><h2>Poem Stats</h2>
<pre>${JSON.stringify(poemStats, null, 2)}</pre>
<small>Private poem storage is owner-only by return link token.</small>
</div>
<div class="card"><h2>Recent Poems (${poems.length})</h2>
${poems.map((x) => `<pre>${JSON.stringify({ ...x, text: String(x.text || "").slice(0, 4000) }, null, 2)}</pre>`).join("") || "<small>No poems yet.</small>"}
</div>
</main></body></html>`;

  res.type("html").send(html);
});

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/types", async (_req, res) => {
  try {
    const templatePath = path.join(publicDir, "types.html");
    const template = await fs.readFile(templatePath, "utf8");
    const hoverVideoBySlug = {
      "the-alchemist": "alchemist-hover.mp4",
      "the-oracle": "the-oracle-hover.mp4",
      "the-architect": "the-architect-hover.mp4",
      "the-seeker": "the-seeker-hover.mp4",
      "the-lover": "the-lover-hover.mp4",
      "the-dreamer": "the-dreamer-hover.mp4",
      "the-muse": "the-muse-hover.mp4",
      "the-devotee": "the-devotee-hover.mp4",
      "the-confessor": "the-confessor-hover.mp4",
      "the-witness": "the-witness-hover.mp4",
      "the-rebel": "the-rebel-hover.mp4",
      "the-mourner": "the-mourner-hover.mp4",
      "the-storyteller": "the-storyteller-hover.mp4",
      "the-minimalist": "the-minimalist-hover.mp4",
      "the-performer": "the-performer-hover.mp4",
      "the-weaver": "the-weaver-hover.mp4"
    };

    const cards = (contentData.types || [])
      .map((t) => {
        const videoFile = hoverVideoBySlug[t.slug];
        const hoverVideo = videoFile
          ? `<video class='type-hover-video' muted loop playsinline preload='metadata' poster='/images/${t.slug}.png'><source src='/videos/${videoFile}' type='video/mp4'></video>`
          : "";
        return `<div class='card'><div class='type-card ${videoFile ? "has-hover-video" : ""}' data-type-slug='${t.slug}'><a class='type-card-art-link' href='/type/${t.slug}' aria-label='Open ${t.name} profile'><figure class='type-card-art'><img src='/images/${t.slug}.png' alt='${t.name} personality illustration' loading='lazy'/>${hoverVideo}</figure></a><span class='chip'>${t.group}</span><h3>${t.name}</h3><p>${t.shortBlurb}</p><a class='type-card-cta' href='/type/${t.slug}'><span>View full profile</span><span aria-hidden='true'>→</span></a></div></div>`;
      })
      .join("");

    const html = template.replace("<div id='typesGrid' class='grid reveal'></div>", `<div id='typesGrid' class='grid reveal'>${cards}</div>`);
    res.type("html").send(html);
  } catch {
    res.sendFile(path.join(publicDir, "types.html"));
  }
});
app.get("/type/:slug", (_req, res) => res.sendFile(path.join(publicDir, "type.html")));
app.get("/categories", (_req, res) => res.sendFile(path.join(publicDir, "categories.html")));
app.get("/tool-kits", (_req, res) => res.redirect("/categories"));
app.get("/results-demo", (_req, res) => res.sendFile(path.join(publicDir, "results.html")));
app.get("/analyze", (_req, res) => res.sendFile(path.join(publicDir, "analyze.html")));
app.get("/account", (_req, res) => res.sendFile(path.join(publicDir, "account.html")));
app.get("/forgot-password", (_req, res) => res.sendFile(path.join(publicDir, "forgot-password.html")));
app.get("/reset-password", (_req, res) => res.sendFile(path.join(publicDir, "reset-password.html")));
app.get("/dashboard", (_req, res) => res.sendFile(path.join(publicDir, "dashboard.html")));
app.get("/settings", (_req, res) => res.sendFile(path.join(publicDir, "settings.html")));
app.get("/my-poems/:token", (_req, res) => res.sendFile(path.join(publicDir, "my-poems.html")));

app.listen(port, () => {
  console.log(`Poet Personality web running at http://localhost:${port}`);
  console.log(`Storage backend: ${usingSupabase ? "Supabase" : "Local JSONL"}`);
});
