import { test } from "node:test";
import assert from "node:assert/strict";
import { parseItems, tap, today, DEFAULT_ITEMS } from "../routine.js";

test("routine: parses labels, notes and counters", () => {
  const items = parseItems(DEFAULT_ITEMS);
  assert.deepEqual(items.map((i) => [i.id, i.target, i.note]), [["meds", 1, "with food"], ["water", 4, "glasses"], ["breakfast", 1, ""], ["stretch", 1, "2 minutes"], ["pack-lunch", 1, "before 8:30"]]);
  assert.equal(parseItems(["Walk the dog", "Walk the dog"])[1].id, "walk-the-dog-2");
  assert.equal(parseItems([]).length, 5, "empty list falls back to the defaults");
});

test("routine: checkbox toggles, counter wraps, completion rewards once, days reset", () => {
  const items = parseItems(DEFAULT_ITEMS);
  const st = { days: {} };
  const t = new Date(2026, 8, 27, 7).getTime();
  assert.equal(tap(st, items, "meds", t).summary.done, 1);
  assert.equal(tap(st, items, "meds", t).summary.done, 0, "second tap unticks");
  for (let i = 0; i < 3; i++) tap(st, items, "water", t);
  assert.equal(today(st, items, t).rows[1].count, 3);
  assert.equal(today(st, items, t).rows[1].done, false);
  for (const id of ["meds", "breakfast", "stretch", "pack-lunch"]) tap(st, items, id, t);
  const last = tap(st, items, "water", t);
  assert.equal(last.summary.complete, true);
  assert.equal(last.firstComplete, true);
  assert.equal(tap(st, items, "water", t).summary.rows[1].count, 0, "counter wraps to 0 after 4");
  tap(st, items, "water", t); tap(st, items, "water", t); tap(st, items, "water", t);
  assert.equal(tap(st, items, "water", t).firstComplete, false, "reward only once a day");
  assert.equal(today(st, items, t + 86_400_000).done, 0, "a new day starts empty");
  assert.throws(() => tap(st, items, "nope", t), /Unknown/);
});
