import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { store } from "../mood.js";

test("mood: kept per person and day, morning and evening apart; a new day starts empty", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gds-mood-"));
  const m = store(dir);
  const mon = new Date(2026, 9, 5, 8, 0).getTime(), tue = mon + 86_400_000;
  assert.deepEqual(m.get("dave", mon), { day: "2026-10-05" });
  m.set("dave", "morning", "rough", mon);
  m.set("dave", "evening", "okay", mon);
  assert.deepEqual(m.get("dave", mon), { day: "2026-10-05", morning: "rough", evening: "okay" });
  assert.deepEqual(m.get("anna", mon), { day: "2026-10-05" }, "another person is untouched");
  assert.deepEqual(m.get("dave", tue), { day: "2026-10-06" }, "tomorrow starts empty");
  m.set("dave", "morning", "", mon);
  assert.equal(m.get("dave", mon).morning, undefined, "an empty value clears it");
  assert.throws(() => m.set("dave", "morning", "furious", mon), /Unknown mood/);
  assert.throws(() => m.set("dave", "noon", "okay", mon), /Unknown kind/);
});
