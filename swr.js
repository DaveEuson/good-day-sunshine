// Widget cache: stale-while-revalidate, persisted to disk so a restart shows the last known data instantly.
//   fresh (younger than ttl)      → returned as is
//   stale (older, or from disk)   → returned at once marked stale; one background refresh starts
//   missing / force               → waits for a fetch
// A fetch that throws is stored as { error } so a failed refresh replaces old numbers instead of hiding behind them.
import fs from "node:fs";
import path from "node:path";

export function createStore(file, { ttl = 5 * 60_000, maxStale = 24 * 3_600_000, now = () => Date.now() } = {}) {
  const map = new Map();       // key → { at, value }
  const inflight = new Map();  // key → Promise<value>
  let gen = 0;                 // bumped by clear(): results of older fetches are returned but not stored
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const [k, e] of Object.entries(saved)) if (e && now() - e.at < maxStale) map.set(k, { ...e, fromDisk: true });
  } catch {}

  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file + ".tmp", JSON.stringify(Object.fromEntries([...map].map(([k, e]) => [k, { at: e.at, value: e.value }]))));
        fs.renameSync(file + ".tmp", file);
      } catch {}
    }, 1000);
    timer.unref?.();
  };

  function refresh(key, fn) {
    if (inflight.has(key)) return inflight.get(key);
    const g = gen;
    const p = (async () => {
      let value;
      try { value = await fn(); } catch (e) { value = { error: e.message }; }
      if (g === gen) { map.set(key, { at: now(), value }); persist(); }
      return value;
    })().finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
    inflight.set(key, p);
    return p;
  }

  return {
    async get(key, fn, { force = false } = {}) {
      const hit = map.get(key);
      if (hit && !force && !hit.fromDisk && now() - hit.at < ttl) return { value: hit.value, at: hit.at, stale: false };
      if (hit && !force) { refresh(key, fn); return { value: hit.value, at: hit.at, stale: true }; }
      const value = await refresh(key, fn);
      return { value, at: map.get(key)?.at ?? now(), stale: false };
    },
    clear() { gen++; map.clear(); inflight.clear(); persist(); },
    pending: () => inflight.size,
    flush() { clearTimeout(timer); timer = null; try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(Object.fromEntries([...map].map(([k, e]) => [k, { at: e.at, value: e.value }])))); } catch {} },
  };
}
