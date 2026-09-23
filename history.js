// Stat history → deltas + sparklines, and per-day counters (e.g. GitHub traffic) → sums over any window.
// Two JSONL files, loaded into memory. `window` (days) is per widget; defaults 7 for deltas, 2× for sparklines.
import fs from "node:fs";

const DAY = 86_400_000;
const KEEP = 90 * DAY;
const dir = (f) => f.replace(/[\\/][^\\/]+$/, "");

export function openHistory(file) {
  const byKey = new Map(); // key → [{t, k, s:{label:value}}]
  const cutoff = Date.now() - KEEP;
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line) continue;
      const rec = JSON.parse(line);
      if (rec.t < cutoff) continue;
      (byKey.get(rec.k) ?? byKey.set(rec.k, []).get(rec.k)).push(rec);
    }
    fs.writeFileSync(file, [...byKey.values()].flat().sort((a, b) => a.t - b.t).map((r) => JSON.stringify(r) + "\n").join(""));
  } catch {}

  // Daily counters: key → Map(dateStr → {field: value}); latest write for a date wins.
  const dailyFile = file.replace(/history\.jsonl$/, "dailies.jsonl");
  const daily = new Map();
  try {
    for (const line of fs.readFileSync(dailyFile, "utf8").split("\n")) {
      if (!line) continue;
      const { k, d, v } = JSON.parse(line);
      (daily.get(k) ?? daily.set(k, new Map()).get(k)).set(d, v);
    }
  } catch {}

  return {
    record(key, stats, now = Date.now()) {
      const s = {};
      for (const st of stats ?? []) if (typeof st.value === "number") s[st.label] = st.value;
      if (!Object.keys(s).length) return;
      const rec = { t: now, k: key, s };
      (byKey.get(key) ?? byKey.set(key, []).get(key)).push(rec);
      fs.mkdirSync(dir(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(rec) + "\n");
    },
    // Mutates stats: .delta vs `window` days ago (else oldest sample ≥1d), .series = last value per day over 2×window, .window.
    enrich(key, stats, now = Date.now(), window = 7) {
      const recs = byKey.get(key);
      if (!recs?.length) return stats;
      const span = Math.min(90, window * 2);
      for (const st of stats ?? []) {
        if (typeof st.value !== "number") continue;
        const have = recs.filter((r) => st.label in r.s);
        if (!have.length) continue;
        const old = [...have].reverse().find((r) => now - r.t >= window * DAY) ?? (now - have[0].t >= DAY ? have[0] : null);
        if (old) { st.delta = st.value - old.s[st.label]; st.window = window; }
        const days = new Map();
        for (const r of have) if (now - r.t <= span * DAY) days.set(Math.floor(r.t / DAY), r.s[st.label]);
        days.set(Math.floor(now / DAY), st.value);
        if (days.size > 1) st.series = [...days.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      }
      return stats;
    },
    // Upsert one day's counters for a key. dateStr = YYYY-MM-DD.
    recordDaily(key, dateStr, values) {
      const m = daily.get(key) ?? daily.set(key, new Map()).get(key);
      const cur = m.get(dateStr);
      if (cur && Object.keys(values).every((f) => cur[f] === values[f])) return;
      m.set(dateStr, { ...cur, ...values });
      fs.mkdirSync(dir(dailyFile), { recursive: true });
      fs.appendFileSync(dailyFile, JSON.stringify({ k: key, d: dateStr, v: m.get(dateStr) }) + "\n");
    },
    // Sum counters over the last `days` days. Returns { <field>: sum, days: covered }.
    sumDaily(key, days, now = Date.now()) {
      const m = daily.get(key);
      const out = { days: 0 };
      if (!m) return out;
      const from = new Date(now - (days - 1) * DAY).toISOString().slice(0, 10); // today counts as day 1
      for (const [d, v] of m) {
        if (d < from) continue;
        out.days++;
        for (const [f, n] of Object.entries(v)) out[f] = (out[f] ?? 0) + n;
      }
      return out;
    },
  };
}
