// Append-only stat history → 7-day deltas + 14-day sparklines. One JSONL file, loaded into memory.
import fs from "node:fs";

const DAY = 86_400_000;
const KEEP = 90 * DAY;

export function openHistory(file) {
  const byKey = new Map(); // key → [{t, s:{label:value}}]
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

  return {
    record(key, stats, now = Date.now()) {
      const s = {};
      for (const st of stats ?? []) if (typeof st.value === "number") s[st.label] = st.value;
      if (!Object.keys(s).length) return;
      const rec = { t: now, k: key, s };
      (byKey.get(key) ?? byKey.set(key, []).get(key)).push(rec);
      fs.mkdirSync(file.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(rec) + "\n");
    },
    // Mutates stats: adds .delta (vs ≥7d ago, else oldest ≥1d) and .series (last value per day, 14d).
    enrich(key, stats, now = Date.now()) {
      const recs = byKey.get(key);
      if (!recs?.length) return stats;
      for (const st of stats ?? []) {
        if (typeof st.value !== "number") continue;
        const have = recs.filter((r) => st.label in r.s);
        if (!have.length) continue;
        const old = [...have].reverse().find((r) => now - r.t >= 7 * DAY) ?? (now - have[0].t >= DAY ? have[0] : null);
        if (old) st.delta = st.value - old.s[st.label];
        const days = new Map();
        for (const r of have) if (now - r.t <= 14 * DAY) days.set(Math.floor(r.t / DAY), r.s[st.label]);
        days.set(Math.floor(now / DAY), st.value);
        if (days.size > 1) st.series = [...days.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      }
      return stats;
    },
  };
}
