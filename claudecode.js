// Claude Code keeps every conversation as JSON lines under ~/.claude/projects. This reads them into a small per-file index:
// tokens per day and model, active session time, the last thing you asked. Read-only; nothing is sent anywhere.
// Files are read once and then only their new tail, in chunks, with a time budget, so a first scan of gigabytes of
// history never blocks the page (the widget shows what is indexed so far and finishes on the next refresh).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DAY = 86_400_000, GAP = 5 * 60_000, CHUNK = 8 * 1024 * 1024;

// Estimated $/MTok [input, output, cache read]; cache writes are 1.25x (5 min) or 2x (1 h) of input. First match wins.
// Prices change, so every figure shown from this is labelled an estimate.
const PRICES = [
  [/fable|mythos/, [10, 50, 0.25]],
  [/opus-5-5/, [4, 20, 0.2]],
  [/opus-(?:5|4-[5-8])\b/, [5, 25, 0.5]],
  [/opus/, [15, 75, 1.5]],
  [/sonnet-5/, [2, 10, 0.2]],
  [/sonnet/, [3, 15, 0.3]],
  [/haiku-4/, [1, 5, 0.1]],
  [/haiku/, [0.8, 4, 0.08]],
];
const priceOf = (model) => PRICES.find(([re]) => re.test(model))?.[1] ?? null;
const normModel = (m) => String(m ?? "").toLowerCase().replace(/\[.*?\]/g, "");

const pad = (n) => String(n).padStart(2, "0");
export const dayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// usage arrays are [input, output, cacheRead, cacheWrite5m, cacheWrite1h]
export function costOf(byModel) {
  let usd = 0; const unknown = [];
  for (const [m, u] of Object.entries(byModel)) {
    const p = priceOf(m);
    if (!p) { if (u.some(Boolean)) unknown.push(m); continue; }
    usd += (u[0] * p[0] + u[1] * p[1] + u[2] * p[2] + u[3] * p[0] * 1.25 + u[4] * p[0] * 2) / 1e6;
  }
  return { usd, unknown };
}
// Fresh work: what you and Claude wrote plus new cache entries. Cache reads are far larger and cheap, so they are left out.
export const freshTokens = (byModel) => Object.values(byModel).reduce((s, u) => s + u[0] + u[1] + u[3] + u[4], 0);

export function projectOf(cwd, fallback = "") {
  const p = String(cwd || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (!p) { const nice = fallback.replace(/^[A-Za-z]--(?:Users-[^-]+-)?(?:Projects-|Documents-)?/, ""); return { key: fallback.toLowerCase(), name: nice || fallback || "unknown" }; }
  const root = p.replace(/\/\.claude\/worktrees\/.*$/, "");   // a worktree belongs to the project it was cut from
  return { key: root.toLowerCase(), name: root.split("/").filter(Boolean).pop() || root, path: root };
}

const encodeDir = (p) => String(p).replace(/[^A-Za-z0-9]/g, "-");
const cleanPrompt = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isHuman = (s) => s.length > 1 && !/^[<[]/.test(s) && !/^Caveat:/.test(s);   // commands, reminders and interrupts are not what you asked

const newEntry = (sub) => ({ offset: 0, sub, cwd: null, title: null, lastPrompt: null, humanPrompt: null, lastTs: 0, lastMsg: null, byDay: {} });
const dayOf = (ent, d) => (ent.byDay[d] ??= { active: 0, prompts: 0, byModel: {} });

// One parsed transcript line into the entry. Exported for tests.
export function applyLine(ent, o) {
  // The project is the folder Claude filed the session under (its name is the launch directory with every symbol turned into "-");
  // a session can wander to other directories later, so only a cwd that encodes to that folder names the project.
  if (o.cwd && !ent.cwd && (!ent.folder || encodeDir(o.cwd) === ent.folder)) ent.cwd = o.cwd;
  if (o.type === "custom-title") { if (o.customTitle) ent.title = cleanPrompt(o.customTitle); return; }
  if (o.type === "last-prompt") { const text = cleanPrompt(o.lastPrompt); if (text) ent.lastPrompt = { text, t: ent.lastTs }; return; }
  if (o.type !== "user" && o.type !== "assistant") return;
  const ts = Date.parse(o.timestamp);
  if (!Number.isFinite(ts)) return;
  const day = dayStr(ts);
  if (ent.lastTs && ts > ent.lastTs && ts - ent.lastTs <= GAP) dayOf(ent, day).active += ts - ent.lastTs;   // time between messages, if you were evidently still at it
  if (ts > ent.lastTs) ent.lastTs = ts;

  if (o.type === "user") {
    const c = o.message?.content;
    if (typeof c === "string" && !o.isMeta) {
      const text = cleanPrompt(c);
      if (isHuman(text)) { ent.humanPrompt = { text, t: ts }; dayOf(ent, day).prompts++; }
    }
    return;
  }
  const u = o.message?.usage, model = normModel(o.message?.model);
  if (!u || !model || model.startsWith("<")) return;
  const cc = u.cache_creation ?? {};
  const w5 = cc.ephemeral_5m_input_tokens ?? (cc.ephemeral_1h_input_tokens == null ? u.cache_creation_input_tokens ?? 0 : 0), w1 = cc.ephemeral_1h_input_tokens ?? 0;
  const use = [u.input_tokens ?? 0, u.output_tokens ?? 0, u.cache_read_input_tokens ?? 0, w5, w1];
  const add = (d, m, v, sign) => { const arr = (dayOf(ent, d).byModel[m] ??= [0, 0, 0, 0, 0]); for (let i = 0; i < 5; i++) arr[i] += sign * v[i]; };
  // One reply is written as several lines (thinking, text, tool call) that repeat the same usage; the last copy wins.
  const id = o.message?.id;
  if (id && ent.lastMsg?.id === id) add(ent.lastMsg.day, ent.lastMsg.model, ent.lastMsg.use, -1);
  add(day, model, use, 1);
  ent.lastMsg = { id, day, model, use };
}

function handleLine(ent, line) {
  if (!line) return;
  const a = line.includes('"type":"assistant"'), u = !a && line.includes('"type":"user"');
  const p = !a && !u && (line.includes('"type":"last-prompt"') || line.includes('"type":"custom-title"'));
  if (!(a || u || p)) return;
  if (u && line.includes('"type":"tool_result"')) return;   // tool output: huge and not something you typed
  try { applyLine(ent, JSON.parse(line)); } catch {}
}

// Returns true when the file is read to the end, false when the time budget ran out first.
async function readInto(ent, file, size, deadline) {
  const fh = await fs.promises.open(file, "r");
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = ent.offset, carry = Buffer.alloc(0);
    while (pos < size) {
      const { bytesRead } = await fh.read(buf, 0, Math.min(CHUNK, size - pos), pos);
      if (!bytesRead) break;
      const chunk = carry.length ? Buffer.concat([carry, buf.subarray(0, bytesRead)]) : buf.subarray(0, bytesRead);
      const nl = chunk.lastIndexOf(10);
      pos += bytesRead;
      if (nl < 0) { carry = Buffer.from(chunk); continue; }
      for (const line of chunk.subarray(0, nl).toString("utf8").split("\n")) handleLine(ent, line);
      carry = Buffer.from(chunk.subarray(nl + 1));
      ent.offset = pos - carry.length;
      if (Date.now() > deadline && pos < size) return false;
    }
    return true;
  } finally { await fh.close(); }
}

function listFiles(projectsDir, sinceMs) {
  const out = [];
  const take = (file, folder, sub, parent = null) => { try { const st = fs.statSync(file); if (st.mtimeMs >= sinceMs) out.push({ file, folder, sub, parent, size: st.size, mtime: st.mtimeMs }); } catch {} };
  let projects = [];
  try { projects = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return out; }
  for (const p of projects) {
    const pdir = path.join(projectsDir, p.name);
    let entries = [];
    try { entries = fs.readdirSync(pdir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".jsonl")) take(path.join(pdir, e.name), p.name, false);
      else if (e.isDirectory()) {   // <session>/subagents/agent-*.jsonl: sub-agent work is real spend too
        const sdir = path.join(pdir, e.name, "subagents");
        try { for (const f of fs.readdirSync(sdir)) if (f.endsWith(".jsonl")) take(path.join(sdir, f), p.name, true, path.join(pdir, e.name + ".jsonl")); } catch {}
      }
    }
  }
  return out;
}

export function createIndex({ dir, stateFile = null, now = Date.now } = {}) {
  const projectsDir = path.join(dir, "projects");
  const files = new Map();
  let windowDays = 1, inflight = null;
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (saved?.v === 1) for (const [k, e] of Object.entries(saved.files ?? {})) files.set(k, e);
  } catch {}

  const save = () => {
    if (!stateFile) return;
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile + ".tmp", JSON.stringify({ v: 1, files: Object.fromEntries(files) }));
      fs.renameSync(stateFile + ".tmp", stateFile);
    } catch {}
  };

  async function run(budgetMs) {
    const list = listFiles(projectsDir, now() - (windowDays + 1) * DAY).sort((a, b) => b.mtime - a.mtime);
    const live = new Set(list.map((f) => f.file));
    for (const k of [...files.keys()]) if (!live.has(k)) files.delete(k);
    const deadline = Date.now() + budgetMs;
    let done = 0, partial = false;
    for (const f of list) {
      let ent = files.get(f.file);
      if (!ent || f.size < ent.offset) { ent = newEntry(f.sub); ent.folder = f.folder; ent.parent = f.parent; files.set(f.file, ent); }   // new, or rewritten shorter
      if (ent.offset < f.size && !(await readInto(ent, f.file, f.size, deadline))) { partial = true; break; }
      done++;
    }
    save();
    return { partial, done, total: list.length };
  }

  return {
    exists: () => fs.existsSync(projectsDir),
    // Read what is new. Concurrent callers share one pass.
    refresh({ days = 7, budgetMs = 2500 } = {}) {
      windowDays = Math.max(windowDays, days);
      return (inflight ??= run(budgetMs).finally(() => { inflight = null; }));
    },
    // Per project over the last `days` days (today counts), newest activity first.
    snapshot({ days = 7 } = {}) {
      const today = dayStr(now()), first = dayStr(now() - (days - 1) * DAY);
      const byProject = new Map();
      for (const ent of files.values()) {
        const pj = projectOf(ent.cwd ?? (ent.parent && files.get(ent.parent)?.cwd), ent.folder);   // a sub-agent belongs to the session that started it
        const inWindow = Object.keys(ent.byDay).filter((d) => d >= first);
        if (!inWindow.length && !(ent.lastTs && dayStr(ent.lastTs) >= first)) continue;
        const a = byProject.get(pj.key) ?? byProject.set(pj.key, { key: pj.key, name: pj.name, path: pj.path, sessions: 0, activeMs: 0, prompts: 0, byModel: {}, todayByModel: {}, lastTs: 0, last: null }).get(pj.key);
        for (const d of inWindow) {
          const day = ent.byDay[d];
          a.activeMs += day.active; a.prompts += day.prompts;
          for (const [m, u] of Object.entries(day.byModel)) {
            const t = (a.byModel[m] ??= [0, 0, 0, 0, 0]); u.forEach((v, i) => { t[i] += v; });
            if (d === today) { const tt = (a.todayByModel[m] ??= [0, 0, 0, 0, 0]); u.forEach((v, i) => { tt[i] += v; }); }
          }
        }
        if (!ent.sub && inWindow.length) a.sessions++;
        if (ent.lastTs > a.lastTs) a.lastTs = ent.lastTs;
        if (!ent.sub && ent.lastTs > (a.last?.t ?? 0)) {   // the thread you can pick back up is a session you typed in, not a sub-agent
          const p = ent.lastPrompt ?? ent.humanPrompt;
          a.last = { prompt: p?.text ?? null, title: ent.title, t: ent.lastTs };
        }
      }
      const rows = [...byProject.values()].sort((x, y) => y.lastTs - x.lastTs);
      const clash = new Map(); for (const r of rows) clash.set(r.name, (clash.get(r.name) ?? 0) + 1);
      for (const r of rows) {
        if (clash.get(r.name) > 1 && r.path) r.name = r.path.split("/").filter(Boolean).slice(-2).join("/");   // two projects called "app": show the parent too
        const c = costOf(r.byModel);
        r.tokens = freshTokens(r.byModel); r.usd = c.usd; r.unknown = c.unknown;
        r.todayTokens = freshTokens(r.todayByModel);
      }
      return rows;
    },
  };
}

const indexes = new Map();
// One shared index per Claude folder, so the "Claude projects" and "Where you left off" widgets read the history once.
export function indexFor(cfg = {}, env = {}, ctx = {}) {
  const dir = cfg.dir || env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  if (!indexes.has(dir)) indexes.set(dir, createIndex({ dir, stateFile: ctx.dataDir ? path.join(ctx.dataDir, "claudecode-index.json") : null }));
  return { index: indexes.get(dir), dir };
}

export const fmtTokens = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
export const fmtHours = (ms) => { const m = Math.round(ms / 60_000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim(); };
export const agoOf = (t, now = Date.now()) => { const m = Math.max(0, Math.round((now - t) / 60_000)); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };