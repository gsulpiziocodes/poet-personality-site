import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 8790;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");
const contentPath = path.join(__dirname, "content", "poet-personality-content.json");

app.use(express.static(publicDir));

app.get("/api/content", async (_req, res) => {
  const raw = await fs.readFile(contentPath, "utf8");
  res.type("application/json").send(raw);
});

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/types", (_req, res) => res.sendFile(path.join(publicDir, "types.html")));
app.get("/type/:slug", (_req, res) => res.sendFile(path.join(publicDir, "type.html")));
app.get("/categories", (_req, res) => res.sendFile(path.join(publicDir, "categories.html")));
app.get("/results-demo", (_req, res) => res.sendFile(path.join(publicDir, "results.html")));

app.listen(port, () => console.log(`Poet Personality web running at http://localhost:${port}`));
