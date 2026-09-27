import { test } from "node:test";
import assert from "node:assert/strict";
import { todaySummary, isEvening } from "../evening.js";

const now = new Date(2026, 8, 27, 20, 0).getTime();   // Sunday 20:00
const today = "2026-09-27";

test("evening: recap of the day and first thing tomorrow", () => {
  const garden = { streak: 6, days: { [today]: { focus: 2 } }, plant: { seed: "sprout", lastWater: today } };
  const routine = { total: 5, done: 5, complete: true, missing: [] };
  const widgets = [
    { type: "calendar", next: { title: "Standup", start: new Date(2026, 8, 28, 9, 0).toISOString() } },
    { type: "weather", status: "ok", items: [{ text: "Mon · Mostly clear", badge: "27 / 18 · 4%" }] },
  ];
  const s = todaySummary({ garden, routine, cfg: { alarm: { time: "07:00", days: [1, 2, 3, 4, 5] } }, widgets, now });
  assert.equal(s.headline, "Today: morning routine done, 2 focus blocks, plant watered.");
  assert.equal(s.tail, "Tomorrow: Standup at 09:00.");
  assert.deepEqual(s.tomorrow.slice(1), ["alarm at 07:00", "mostly clear, 27 / 18"]);
  assert.deepEqual(s.todo, []);
});

test("evening: an empty day is named kindly, open items are listed, no alarm on a day it doesn't ring", () => {
  const s = todaySummary({ garden: { days: {}, plant: { seed: "sprout", lastWater: "2026-09-26" } }, routine: { total: 5, done: 2, complete: false, missing: ["Breakfast", "Stretch", "Pack lunch"] }, cfg: { alarm: { time: "07:00", days: [2] } }, widgets: [], now });
  assert.equal(s.headline, "Today: routine 2 of 5.");
  assert.equal(s.tail, "");
  assert.deepEqual(s.todo, ["Water the plant before bed", "Still open from this morning: Breakfast, Stretch, Pack lunch"]);
  assert.equal(todaySummary({ garden: { days: {} }, routine: null, cfg: {}, widgets: [], now }).headline, "A quiet day. That counts too.");
});

test("evening: time window", () => {
  assert.equal(isEvening({}, new Date(2026, 8, 27, 16, 59)), false);
  assert.equal(isEvening({}, new Date(2026, 8, 27, 17, 0)), true);
  assert.equal(isEvening({}, new Date(2026, 8, 28, 1, 30)), true, "after midnight is still the evening");
  assert.equal(isEvening({}, new Date(2026, 8, 28, 6, 0)), false);
  assert.equal(isEvening({ evening: { from: "off" } }, new Date(2026, 8, 27, 21, 0)), false);
  assert.equal(isEvening({ evening: { from: "19:00" } }, new Date(2026, 8, 27, 18, 0)), false);
});

test("evening: an untouched routine is neither an achievement nor a nag", () => {
  const s = todaySummary({ garden: { days: {} }, routine: { total: 5, done: 0, complete: false, missing: ["Meds", "Water", "Breakfast", "Stretch", "Pack lunch"] }, cfg: {}, widgets: [], now });
  assert.equal(s.headline, "A quiet day. That counts too.");
  assert.deepEqual(s.todo, []);
});
