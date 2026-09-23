import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openHistory } from "../history.js";

const DAY = 86_400_000;
const d = (n, now) => new Date(now - n * DAY).toISOString().slice(0, 10);

test("dailies: upsert per day, sum over window, survive reopen", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gds-")), "history.jsonl");
  const h = openHistory(file);
  const now = Date.now();
  for (let i = 0; i < 20; i++) h.recordDaily("gh:x/y", d(i, now), { views: 10, uniques: 2 });
  h.recordDaily("gh:x/y", d(0, now), { views: 15, uniques: 3 }); // today revised upward → latest wins
  const s14 = h.sumDaily("gh:x/y", 14, now);
  assert.equal(s14.days, 14);
  assert.equal(s14.views, 13 * 10 + 15);
  const s30 = h.sumDaily("gh:x/y", 30, now);
  assert.equal(s30.days, 20, "only 20 days collected so far");
  assert.equal(openHistory(file).sumDaily("gh:x/y", 14, now).views, 145, "reopen replays upserts");
});

test("enrich: delta window is configurable", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gds-")), "history.jsonl");
  const h = openHistory(file);
  const now = Date.now();
  h.record("k", [{ label: "Stars", value: 10 }], now - 20 * DAY);
  h.record("k", [{ label: "Stars", value: 12 }], now - 8 * DAY);
  const s7 = h.enrich("k", [{ label: "Stars", value: 15 }], now, 7)[0];
  assert.equal(s7.delta, 3); assert.equal(s7.window, 7);
  const s14 = h.enrich("k", [{ label: "Stars", value: 15 }], now, 14)[0];
  assert.equal(s14.delta, 5); assert.equal(s14.window, 14);
});
