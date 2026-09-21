import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providers } from "./providers/index.js";
import { brief } from "./brief.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, "public");
const USERS = path.join(ROOT, "config", "users");

// .env loader (no deps). Real env wins over file.
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}
const env = process.env;
const PORT = +(env.PORT || 4242);
const TTL = +(env.CACHE_TTL_MS || 5 * 60_000);

const cache = new Map(); // key → { at, value }
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function loadUser(name) {
  const safe = String(name || "dave").replace(/[^a-z0-9_-]/gi, "");
  const p = path.join(USERS, `${safe}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function runWidget(w, i) {
  const p = providers[w.type];
  if (!p) return { id: i, type: w.type, title: w.type, error: `Unknown widget type "${w.type}".` };
  const base = { id: i, type: w.type, title: w.title ?? p.meta.title, icon: p.meta.icon };
  try {
    const data = await cached(`${w.type}:${JSON.stringify(w)}`, () => p.fetchData(w, env));
    return { ...base, ...data };
  } catch (e) {
    return { ...base, error: e.message };
  }
}

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const user = url.searchParams.get("u") || "dave";

  if (url.pathname === "/api/dashboard") {
    const cfg = loadUser(user);
    if (!cfg) return json(res, 404, { error: `No config/users/${user}.json` });
    if (url.searchParams.has("refresh")) cache.clear();
    const widgets = await Promise.all(cfg.widgets.map(runWidget));
    return json(res, 200, { user: cfg.name, theme: cfg.theme, accent: cfg.accent, brief: cfg.brief, widgets });
  }

  if (url.pathname === "/api/brief" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { widgets, name, tone } = JSON.parse(body);
      const text = await cached(`brief:${name}:${JSON.stringify(widgets).length}`, () => brief({ widgets, name, tone }, env));
      return json(res, 200, { text });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  if (url.pathname === "/api/users") {
    const names = fs.readdirSync(USERS).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(".json", ""));
    return json(res, 200, names);
  }

  // static
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = path.normalize(path.join(PUB, file));
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`life-dashboard → http://localhost:${PORT}`));
