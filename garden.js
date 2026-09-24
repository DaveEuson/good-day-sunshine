// Garden game: check in daily for tokens, water a plant, unlock seeds and themes.
import fs from "node:fs";
import path from "node:path";

export const SEEDS = {
  sprout:      { name: "Sprout",       cost: 0,   harvest: 20,  stages: ["🫘", "🌱", "🌿", "🪴"] },
  sunflower:   { name: "Sunflower",    cost: 30,  harvest: 40,  stages: ["🫘", "🌱", "🌿", "🌻"] },
  cactus:      { name: "Cactus",       cost: 50,  harvest: 60,  stages: ["🫘", "🌱", "🌵", "🌵🌸"] },
  tulip:       { name: "Tulip",        cost: 70,  harvest: 80,  stages: ["🫘", "🌱", "🌿", "🌷", "🌷🌷"] },
  mushroom:    { name: "Mushroom",     cost: 100, harvest: 110, stages: ["🫘", "🌱", "🍄", "🍄🍄", "🍄🍄🍄"] },
  bonsai:      { name: "Bonsai",       cost: 150, harvest: 170, stages: ["🫘", "🌱", "🌿", "🌳", "🎋", "🌲"] },
  lotus:       { name: "Lotus",        cost: 220, harvest: 250, stages: ["🫘", "🌱", "🌿", "🪷", "🪷🪷", "🪷🪷🪷"] },
  dragonfruit: { name: "Dragon fruit", cost: 400, harvest: 500, stages: ["🫘", "🌱", "🌵", "🌵🌸", "🌵🐉", "🐉🍈🐉"] },
};

export const THEME_COSTS = { aurora: 80, sakura: 120, gold: 300 };

const DAILY = 10, EXTRA = 2, MAX_EXTRA = 5, EXTRA_GAP = 60 * 60_000, WATER = 3, WILT_AFTER = 3;

const dayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000);

export function fresh() {
  return { tokens: 0, streak: 0, lastCheckin: null, lastCheckAt: 0, checksToday: 0, plant: null, unlocked: { seeds: ["sprout"], themes: [] }, harvested: [], log: [] };
}

const note = (s, msg) => { s.log.unshift(msg); s.log.length = Math.min(s.log.length, 5); };

// Per-day record (what "I noticed" reads): { checkin, water, focus }. 90-day retention.
function mark(s, now, field, value = true) {
  s.days ??= {};
  const d = dayStr(now);
  s.days[d] = { ...(s.days[d] ?? {}), [field]: field === "focus" ? (s.days[d]?.focus ?? 0) + 1 : value };
  for (const k of Object.keys(s.days)) if (daysBetween(k, d) > 90) delete s.days[k];
}

export function checkin(s, now = Date.now()) {
  const today = dayStr(now);
  if (s.lastCheckin !== today) {
    s.streak = s.lastCheckin && daysBetween(s.lastCheckin, today) === 1 ? s.streak + 1 : 1;
    const earned = DAILY + Math.min(s.streak, 20);
    s.tokens += earned; s.lastCheckin = today; s.checksToday = 1; s.lastCheckAt = now;
    mark(s, now, "checkin");
    note(s, `+${earned} tokens · day ${s.streak} streak`);
  } else if (now - s.lastCheckAt >= EXTRA_GAP && s.checksToday <= MAX_EXTRA) {
    s.tokens += EXTRA; s.checksToday++; s.lastCheckAt = now;
    mark(s, now, "checkin");
    note(s, `+${EXTRA} tokens for checking back`);
  }
  const p = s.plant;
  if (p && !p.wilted && !p.ready) {
    const since = daysBetween(p.lastWater ?? p.plantedAt, today);
    if (since >= WILT_AFTER) { p.wilted = true; p.stage = Math.max(0, p.stage - 1); note(s, `${SEEDS[p.seed].name} wilted — water it!`); }
  }
  return s;
}

export function water(s, now = Date.now()) {
  const p = s.plant;
  if (!p) throw new Error("Nothing planted.");
  if (p.ready) throw new Error("Ready to harvest.");
  const today = dayStr(now);
  if (p.lastWater === today) throw new Error("Already watered today.");
  p.lastWater = today; p.wilted = false;
  mark(s, now, "water");
  p.stage = Math.min(p.stage + 1, SEEDS[p.seed].stages.length - 1);
  if (p.stage === SEEDS[p.seed].stages.length - 1) p.ready = true;
  s.tokens += WATER;
  note(s, p.ready ? `${SEEDS[p.seed].name} is fully grown!` : `Watered · +${WATER}`);
  return s;
}

export function harvest(s) {
  const p = s.plant;
  if (!p?.ready) throw new Error("Not ready.");
  const seed = SEEDS[p.seed];
  s.tokens += seed.harvest; s.harvested.push({ seed: p.seed, at: Date.now() }); s.plant = null;
  note(s, `Harvested ${seed.name} · +${seed.harvest}`);
  return s;
}

export function plant(s, seed, now = Date.now()) {
  if (!SEEDS[seed]) throw new Error("Unknown seed.");
  if (!s.unlocked.seeds.includes(seed)) throw new Error("Seed locked.");
  if (s.plant) throw new Error("Already growing something.");
  s.plant = { seed, stage: 0, plantedAt: dayStr(now), lastWater: null, wilted: false, ready: false };
  note(s, `Planted ${SEEDS[seed].name}`);
  return s;
}

export function buy(s, kind, id) {
  const cost = kind === "seed" ? SEEDS[id]?.cost : THEME_COSTS[id];
  const list = kind === "seed" ? s.unlocked.seeds : s.unlocked.themes;
  if (cost == null) throw new Error("Unknown item.");
  if (list.includes(id)) throw new Error("Already unlocked.");
  if (s.tokens < cost) throw new Error(`Need ${cost - s.tokens} more tokens.`);
  s.tokens -= cost; list.push(id);
  note(s, `Unlocked ${kind === "seed" ? SEEDS[id].name : id} · -${cost}`);
  return s;
}

// Finished a "Just one thing" focus block. Capped so it can't be farmed.
export function focus(s, now = Date.now()) {
  const today = dayStr(now);
  if (s.focusDay !== today) { s.focusDay = today; s.focusToday = 0; }
  if (s.focusToday >= 4) throw new Error("That's four blocks today. Rest counts too.");
  s.focusToday++; s.tokens += 5;
  mark(s, now, "focus");
  note(s, `Focus block done · +5`);
  return s;
}

export const ACTIONS = { water, harvest, focus, plant: (s, b) => plant(s, b.seed), buy: (s, b) => buy(s, b.kind, b.id) };

export function store(dir) {
  const file = (u) => path.join(dir, `${u}.json`);
  return {
    load(u) { try { return { ...fresh(), ...JSON.parse(fs.readFileSync(file(u), "utf8")) }; } catch { return fresh(); } },
    save(u, s) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(u), JSON.stringify(s, null, 1)); return s; },
  };
}

export function view(s) {
  const p = s.plant;
  return {
    ...s,
    plantView: p && { ...p, name: SEEDS[p.seed].name, art: SEEDS[p.seed].stages[p.stage], stages: SEEDS[p.seed].stages.length, harvest: SEEDS[p.seed].harvest, wateredToday: p.lastWater === dayStr(Date.now()) },
    seeds: Object.entries(SEEDS).map(([id, x]) => ({ id, name: x.name, cost: x.cost, final: x.stages.at(-1), unlocked: s.unlocked.seeds.includes(id) })),
    themes: Object.entries(THEME_COSTS).map(([id, cost]) => ({ id, cost, unlocked: s.unlocked.themes.includes(id) })),
  };
}
