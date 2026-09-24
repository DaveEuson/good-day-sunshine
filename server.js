import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { providers, OPTION_HINTS, KEYS } from "./providers/index.js";
import { brief, fallback } from "./brief.js";
import { chat } from "./chat.js";
import { CLAUDE_MODELS, openrouterModels, provider } from "./ai.js";
import { openHistory } from "./history.js";
import * as garden from "./garden.js";
import * as notice from "./notice.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, "public");
const USERS = path.join(ROOT, "config", "users");
const DATA = path.join(ROOT, "data");

// .env loader/writer (no deps). Real env wins over file on first load.
const ENV_FILE = path.join(ROOT, ".env");
function readEnvFile() {
  const out = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}
for (const [k, v] of Object.entries(readEnvFile())) if (!(k in process.env)) process.env[k] = v;
function writeEnv(updates) {
  const cur = readEnvFile();
  for (const [k, v] of Object.entries(updates)) { if (v === "" || v == null) delete cur[k]; else cur[k] = String(v); }
  fs.writeFileSync(ENV_FILE, Object.entries(cur).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
  for (const [k, v] of Object.entries(updates)) { if (v === "" || v == null) delete process.env[k]; else process.env[k] = String(v); }
}
const env = process.env;
const isLocal = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) || env.ADMIN_FROM_LAN === "1";
const PORT = +(env.PORT || 4242);
const HOST = env.HOST || "0.0.0.0"; // LAN by default so Pi/Jetson/ESP32 displays can reach it
const TTL = +(env.CACHE_TTL_MS || 5 * 60_000);

const history = openHistory(path.join(DATA, "history.jsonl"));
const gardens = garden.store(path.join(DATA, "garden"));
const notices = notice.store(path.join(DATA, "notices"));

function noticeCandidates(user) {
  const g = gardens.load(user);
  return notice.computeNotices({ garden: g, series: history.series(`${user}:attention`, "Notifications") });
}

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
  if (w.type === "garden") return { ...base, status: "ok", title: w.title ?? "Garden", icon: "❀", garden: garden.view(gardens.save(user, garden.checkin(gardens.load(user)))) };
  if (w.type === "noticed") {
    const st = notices.load(user);
    const cands = noticeCandidates(user);
    const n = notice.pick(cands, st);
    notices.save(user, st);
    const dow = new Date().getDay();
    return { ...base, status: "ok", title: w.title ?? "I noticed", icon: "✦", notice: n, nudges: st.nudges, todayNudges: st.nudges.filter((x) => x.day === dow) };
  }
  const p = providers[w.type];
  if (!p) return { ...base, status: "error", error: `Unknown widget type "${w.type}".` };
  const hkey = `${user}:${w.key ?? w.type}`;
  try {
    const data = await cached(`${user}:${JSON.stringify(w)}`, async () => {
      const d = await p.fetchData(w, env, { history });
      if (d.stats && !d.error && !d.setup) history.record(hkey, d.stats);
      return d;
    });
    const out = { ...base, title: w.title ?? data.title ?? p.meta.title, icon: p.meta.icon, ...data };
    out.status = data.setup ? "setup" : data.error ? "error" : "ok";
    if (out.status !== "ok") { delete out.stats; delete out.items; delete out.attention; } // never ship numbers from a failed check
    else if (out.stats) out.stats = history.enrich(hkey, structuredClone(out.stats), Date.now(), +w.window || 7);
    return out;
  } catch (e) {
    return { ...base, status: "error", icon: p.meta.icon, error: e.message };
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
      cat.splice(4, 0, { type: "garden", title: "Garden", icon: "❀", hint: "{}" }, { type: "noticed", title: "I noticed", icon: "✦", hint: "{}" });
      return json(res, 200, cat);
    }

    // Admin surface: only from this machine unless ADMIN_FROM_LAN=1.
    if (url.pathname === "/api/env" || url.pathname === "/api/models" || (req.method === "PUT" && url.pathname.startsWith("/api/users/"))) {
      if (!isLocal(req)) return json(res, 403, { error: "Settings can only be changed from the machine running the server (or set ADMIN_FROM_LAN=1)." });
    }
    if (url.pathname === "/api/env" && req.method === "GET") {
      return json(res, 200, KEYS.map((k) => ({ ...k, set: !!env[k.key], value: k.secret === false ? env[k.key] ?? "" : undefined })));
    }
    if (url.pathname === "/api/env" && req.method === "PUT") {
      const updates = await body(req);
      const allowed = new Set([...KEYS.map((k) => k.key), "OLLAMA_URL", "OLLAMA_MODEL", "CHAT_MODEL"]);
      // picking a claude-* model without a key is a dead end; say so before writing
      for (const k of ["OLLAMA_MODEL", "CHAT_MODEL"]) {
        if (/^claude-/.test(updates[k] || "") && !(updates.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY)) return json(res, 400, { error: `${updates[k]} needs an Anthropic API key (Keys section).` });
        if (/^openrouter\//.test(updates[k] || "") && !(updates.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY)) return json(res, 400, { error: `${updates[k]} needs an OpenRouter API key (Keys section).` });
      }
      for (const k of Object.keys(updates)) if (!allowed.has(k)) return json(res, 400, { error: `Not a settable key: ${k}` });
      writeEnv(updates);
      cache.clear();
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/models") {
      const base = env.OLLAMA_URL || "http://localhost:11434";
      let local = [];
      try { local = (await (await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) })).json()).models.map((m) => m.name); } catch {}
      const claude = env.ANTHROPIC_API_KEY ? CLAUDE_MODELS : [];
      const or = await openrouterModels(env);
      const brief = env.OLLAMA_MODEL || (local.length ? "qwen3.5:9b" : ""), chat = env.CHAT_MODEL || (local.length ? "llama3.2:3b" : "");
      return json(res, 200, { ok: local.length + claude.length + or.length > 0, url: base, local: local.length, claude: claude.length > 0, openrouter: or.length > 0, models: [...claude, ...or, ...local], brief, chat, cloud: [provider(brief), provider(chat)].filter((p) => p !== "ollama") });
    }

    const um = url.pathname.match(/^\/api\/users\/([a-z0-9_-]+)$/i);
    if (um && req.method === "PUT") {
      const cfg = await body(req);
      if (typeof cfg.name !== "string" || !Array.isArray(cfg.widgets)) return json(res, 400, { error: "Need name and widgets[]." });
      const bad = cfg.widgets.find((w) => !["garden", "noticed"].includes(w.type) && !providers[w.type]);
      if (bad) return json(res, 400, { error: `Unknown widget type "${bad.type}".` });
      fs.writeFileSync(path.join(USERS, `${safeName(um[1])}.json`), JSON.stringify(cfg, null, 2) + "\n");
      cache.clear();
      return json(res, 200, { ok: true });
    }

    // Brief: `fast: true` answers instantly (cached model text, else the template marked pending);
    // a normal call waits up to BRIEF_TIMEOUT_MS for the model. Only model answers are cached.
    if (url.pathname === "/api/brief" && req.method === "POST") {
      const input = await body(req);
      const key = `brief:${input.name}:${input.mood ?? ""}:${JSON.stringify(input.widgets).length}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL) return json(res, 200, { ...hit.value, cached: true });
      if (input.fast) return json(res, 200, { text: fallback(input), fromModel: false, pending: true });
      const out = await brief(input, env);
      if (out.fromModel) cache.set(key, { at: Date.now(), value: out });
      return json(res, 200, out);
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const stream = chat(await body(req), env);
      res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
      try { for await (const text of stream) res.write(JSON.stringify({ message: { content: text } }) + "\n"); }
      catch (e) { res.write(JSON.stringify({ message: { content: `\n[${e.message}]` } }) + "\n"); }
      return res.end();
    }

    const nm = url.pathname.match(/^\/api\/notice\/(yes|no|ok|forget)$/);
    if (nm && req.method === "POST") {
      const { id } = await body(req);
      const st = notice.respond(notices.load(user), nm[1], id, noticeCandidates(user));
      notices.save(user, st);
      return json(res, 200, { ok: true, nudges: st.nudges });
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
