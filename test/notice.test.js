import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNotices, pick, fresh, respond } from "../notice.js";

const DAY = 86_400_000;
const now = new Date(2026, 8, 24, 9).getTime(); // Thursday
const iso = (t) => new Date(t).toISOString().slice(0, 10);

test("notices: skipped-Monday watering, streak milestone, focus win; nothing on thin data", () => {
  const days = {};
  for (let i = 1; i <= 28; i++) { const t = now - i * DAY; const dow = new Date(t).getDay(); days[iso(t)] = { checkin: true, water: dow !== 1, focus: i <= 6 ? 1 : 0 }; }
  const garden = { streak: 14, plant: { seed: "sprout" }, days };
  const n = computeNotices({ garden, series: [], now });
  const ids = n.map((x) => x.id);
  assert.ok(ids.includes("streak-14"));
  assert.ok(ids.includes("water-1"), ids.join());
  assert.match(n.find((x) => x.id === "water-1").text, /Mondays/);
  assert.ok(ids.some((i) => i.startsWith("focus-w")));
  assert.deepEqual(computeNotices({ garden: { streak: 3, days: {} }, series: [], now }), []);
});

test("notices: weekday notification spike", () => {
  const series = [];
  for (let i = 1; i <= 27; i++) { const t = now - i * DAY; series.push({ t, v: new Date(t).getDay() === 1 ? 12 : 2 }); }
  const n = computeNotices({ garden: { streak: 1, days: {} }, series, now });
  assert.equal(n[0].id, "notif-1");
  assert.match(n[0].text, /Mondays: about 12, against 2/);
});

test("pick: one pattern a week, milestones bypass, dismiss holds 30 days, yes stores a nudge", () => {
  const st = fresh();
  const cands = [{ id: "water-1", kind: "pattern", nudge: { day: 1, time: "07:40", text: "Water" } }, { id: "notif-1", kind: "pattern" }, { id: "streak-7", kind: "milestone" }];
  assert.equal(pick(cands, st, now).id, "water-1");
  assert.equal(pick(cands, st, now).id, "water-1", "same pick all day");
  respond(st, "yes", "water-1", cands, now);
  assert.equal(st.nudges[0].time, "07:40");
  const tomorrow = now + DAY;
  assert.equal(pick(cands, st, tomorrow).id, "streak-7", "milestone allowed within the week, second pattern is not");
  respond(st, "no", "streak-7", cands, tomorrow);
  assert.equal(pick(cands, st, tomorrow + DAY), null);
  assert.equal(pick(cands, st, now + 8 * DAY).id, "notif-1", "next pattern after a week");
});
