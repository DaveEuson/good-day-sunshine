// Morning routine: a short daily checklist. Resets each day, earns garden tokens once when finished,
// and keeps per-day history so "I noticed" can spot a step that keeps getting skipped on one weekday.
//
// Items come from the widget config, one per line:  "Meds · with food", "Water x4 · glasses", "Pack lunch · before 8:30".
// "xN" makes a counter (tap to add one, wraps to 0 after N); " · " adds a small note.
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_ITEMS = ["Meds · with food", "Water x4 · glasses", "Breakfast", "Stretch · 2 minutes", "Pack lunch · before 8:30"];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
const dayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function parseItems(lines = DEFAULT_ITEMS) {
  const seen = new Set();
  return (lines.length ? lines : DEFAULT_ITEMS).map((line) => {
    const [head, ...rest] = String(line).split(/\s+·\s+/);
    const m = head.trim().match(/^(.*?)\s+[x×](\d+)$/i);
    const label = (m ? m[1] : head).trim();
    let id = slug(label); while (seen.has(id)) id += "-2"; seen.add(id);
    return { id, label, note: rest.join(" · ").trim(), target: m ? Math.max(1, Math.min(20, +m[2])) : 1 };
  }).filter((x) => x.label);
}

// Day state: { counts: { id: n } }. An item is done when its count reaches its target.
export function summary(items, day = {}) {
  const counts = day.counts ?? {};
  const rows = items.map((it) => ({ ...it, count: counts[it.id] ?? 0, done: (counts[it.id] ?? 0) >= it.target }));
  const done = rows.filter((r) => r.done).length;
  return { rows, done, total: rows.length, complete: rows.length > 0 && done === rows.length, missing: rows.filter((r) => !r.done).map((r) => r.label) };
}

// Tap: a checkbox toggles; a counter adds one and wraps to 0 after its target.
export function tap(state, items, id, now = Date.now()) {
  const it = items.find((x) => x.id === id);
  if (!it) throw new Error("Unknown routine step.");
  const d = dayStr(now);
  state.days ??= {};
  const day = (state.days[d] ??= { counts: {} });
  const c = day.counts[id] ?? 0;
  day.counts[id] = it.target === 1 ? (c ? 0 : 1) : (c >= it.target ? 0 : c + 1);
  for (const k of Object.keys(state.days)) if ((new Date(d) - new Date(k)) / 86_400_000 > 90) delete state.days[k];
  const s = summary(items, day);
  const firstComplete = s.complete && !day.rewarded;
  if (firstComplete) day.rewarded = true;
  return { summary: s, firstComplete };
}

export const today = (state, items, now = Date.now()) => summary(items, state.days?.[dayStr(now)]);

export function store(dir) {
  const file = (u) => path.join(dir, `${u}.json`);
  return {
    load(u) { try { return JSON.parse(fs.readFileSync(file(u), "utf8")); } catch { return { days: {} }; } },
    save(u, s) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(u), JSON.stringify(s, null, 1)); return s; },
  };
}
