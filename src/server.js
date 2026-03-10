import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 8790;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const contentPath = path.join(__dirname, "content", "poet-personality-content.json");
const dataDir = path.join(rootDir, "data");
const leadsPath = path.join(dataDir, "leads.jsonl");
const eventsPath = path.join(dataDir, "events.jsonl");

async function appendJsonl(filePath, payload) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

app.use(express.json({ limit: "256kb" }));
app.use(express.static(publicDir));

app.get("/api/content", async (_req, res) => {
  const raw = await fs.readFile(contentPath, "utf8");
  res.type("application/json").send(raw);
});

app.post("/api/lead", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    await appendJsonl(leadsPath, {
      ts: new Date().toISOString(),
      email,
      source: req.body?.source || "unknown",
      page: req.body?.page || "",
      ua: req.headers["user-agent"] || ""
    });

    return res.json({ ok: true });
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

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/types", (_req, res) => res.sendFile(path.join(publicDir, "types.html")));
app.get("/type/:slug", (_req, res) => res.sendFile(path.join(publicDir, "type.html")));
app.get("/categories", (_req, res) => res.sendFile(path.join(publicDir, "categories.html")));
app.get("/results-demo", (_req, res) => res.sendFile(path.join(publicDir, "results.html")));

app.listen(port, () => console.log(`Poet Personality web running at http://localhost:${port}`));
