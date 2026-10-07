// Today's mood per person, kept on the server so the phone, the TV and the desktop agree. One small file per
// person; a new day starts empty. kind is "morning" or "evening".
import fs from "node:fs";
import path from "node:path";

export const MOODS = ["great", "okay", "meh", "rough", "skip"];
const localDay = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function store(dir) {
  const file = (u) => path.join(dir, `${u}.json`);
  const read = (u, now) => {
    try { const s = JSON.parse(fs.readFileSync(file(u), "utf8")); if (s.day === localDay(now)) return s; } catch {}
    return { day: localDay(now) };
  };
  return {
    get: read,
    set(u, kind, value, now = Date.now()) {
      if (kind !== "morning" && kind !== "evening") throw new Error("Unknown kind.");
      if (value && !MOODS.includes(value)) throw new Error("Unknown mood.");
      const s = read(u, now);
      if (value) s[kind] = value; else delete s[kind];
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file(u), JSON.stringify(s));
      return s;
    },
  };
}