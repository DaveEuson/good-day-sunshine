import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providers, OPTION_HINTS } from "./providers/index.js";
import { brief } from "./brief.js";
import { chat } from "./chat.js";
import { openHistory } from "./history.js";
import * as garden from "./garden.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, "public");
const USERS = path.join(ROOT, "config", "users");
const DATA = path.join(ROOT, "data");

// .env loader (no deps). Real env wins over file.
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}
const env = process.env;
const PORT = +(env.PORT || 4242);
const HOST = env.HOST || "0.0.0.0"; // LAN by default so Pi/Jetson/ESP32 displays can reach it
const TTL = +(env.CACHE_TTL_MS || 5 * 60_000);

const history = openHistory(path.join(DATA, "history.jsonl"));
const gardens = garden.store(path.join(DATA, "garden"));

const cache = new Map(); // key → { at, value }
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const safeName = (name) => String(name || "dave").replace(/[^a-z0-9_-]/gi, "");
function loadUser(name) {
  const p = path.join(USERS, `${safeName(name)}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function runWidget(w, i, user) {
  const base = { id: i, type: w.type, title: w.title ?? w.type };
  if (w.type === "garden") return { ...base, title: w.title ?? "Garden", icon: "❀", garden: garden.view(gardens.save(user, garden.checkin(gardens.load(user)))) };
  const p = providers[w.type];
  if (!p) return { ...base, error: `Unknown widget type "${w.type}".` };
  const hkey = `${user}:${w.key ?? w.type}`;
  try {
    const data = await cached(`${user}:${JSON.stringify(w)}`, async () => {
      const d = await p.fetchData(w, env);
      if (d.stats) history.record(hkey, d.stats);
      return d;
    });
    const out = { ...base, title: w.title ?? data.title ?? p.meta.title, icon: p.meta.icon, ...data };
    if (out.stats) out.stats = history.enrich(hkey, structuredClone(out.stats));
    return out;
  } catch (e) {
    return { ...base, icon: p.meta.icon, error: e.message };
  }
}

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
async function body(req) { let b = ""; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const user = safeName(url.searchParams.get("u") || "dave");

  try {
    if (url.pathname === "/api/dashboard") {
      const cfg = loadUser(user);
      if (!cfg) return json(res, 404, { error: `No config/users/${user}.json` });
      if (url.searchParams.has("refresh")) cache.clear();
      const widgets = await Promise.all(cfg.widgets.map((w, i) => runWidget(w, i, user)));
      return json(res, 200, { user: cfg.name, theme: cfg.theme, accent: cfg.accent, brief: cfg.brief, config: cfg, widgets, chatModel: env.CHAT_MODEL || "llama3.2:3b" });
    }

    // Compact text-ish view for microcontrollers / e-paper / TTS. No HTML needed.
    if (url.pathname === "/api/summary") {
      const cfg = loadUser(user);
      if (!cfg) return json(res, 404, { error: `No config/users/${user}.json` });
      const widgets = await Promise.all(cfg.widgets.map((w, i) => runWidget(w, i, user)));
      const h = new Date().getHours();
      return json(res, 200, {
        greeting: `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${cfg.name}`,
        date: new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
        widgets: widgets.filter((w) => w.stats?.length).map((w) => ({ title: w.title, stats: w.stats.map(({ label, value, delta }) => ({ label, value, delta })) })),
        attention: widgets.flatMap((w) => w.attention ?? []).map((a) => a.text),
        headlines: widgets.filter((w) => w.type === "news").flatMap((w) => w.items ?? []).map((i) => i.text),
        garden: widgets.find((w) => w.type === "garden")?.garden && (({ tokens, streak, plantView }) => ({ tokens, streak, plant: plantView && `${plantView.art} ${plantView.name}` }))(widgets.find((w) => w.type === "garden").garden),
      });
    }

    if (url.pathname === "/api/catalog") {
      const cat = Object.entries(providers).map(([type, p]) => ({ type, title: p.meta.title, icon: p.meta.icon, hint: OPTION_HINTS[type] ?? "{}" }));
      cat.splice(4, 0, { type: "garden", title: "Garden", icon: "❀", hint: "{}" });
      return json(res, 200, cat);
    }

    const um = url.pathname.match(/^\/api\/users\/([a-z0-9_-]+)$/i);
    if (um && req.method === "PUT") {
      const cfg = await body(req);
      if (typeof cfg.name !== "string" || !Array.isArray(cfg.widgets)) return json(res, 400, { error: "Need name and widgets[]." });
      const bad = cfg.widgets.find((w) => w.type !== "garden" && !providers[w.type]);
      if (bad) return json(res, 400, { error: `Unknown widget type "${bad.type}".` });
      fs.writeFileSync(path.join(USERS, `${safeName(um[1])}.json`), JSON.stringify(cfg, null, 2) + "\n");
      cache.clear();
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/api/brief" && req.method === "POST") {
      const { widgets, name, tone } = await body(req);
      const text = await cached(`brief:${name}:${JSON.stringify(widgets).length}`, () => brief({ widgets, name, tone }, env));
      return json(res, 200, { text });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const stream = await chat(await body(req), env);
      res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
      for await (const chunk of stream) res.write(chunk);
      return res.end();
    }

    const g = url.pathname.match(/^\/api\/garden\/(\w+)$/);
    if (g && req.method === "POST") {
      const act = garden.ACTIONS[g[1]];
      if (!act) return json(res, 404, { error: "Unknown action." });
      const s = gardens.load(user);
      try { act(s, await body(req)); } catch (e) { return json(res, 400, { error: e.message, garden: garden.view(s) }); }
      return json(res, 200, { garden: garden.view(gardens.save(user, s)) });
    }

    if (url.pathname === "/api/users") {
      const names = fs.readdirSync(USERS).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.replace(".json", ""));
      return json(res, 200, names);
    }
  } catch (e) {
    return json(res, 500, { error: e.message });
  }

  // static
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = path.normalize(path.join(PUB, file));
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => console.log(`good-day-sunshine → http://localhost:${PORT}  (bound to ${HOST})`));
