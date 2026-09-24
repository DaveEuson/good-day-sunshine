import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openHistory } from "../history.js";

test("history: a stat with a null value is never recorded, delta stays null", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gds-")), "history.jsonl");
  const h = openHistory(file);
  const now = Date.now();
  h.record("k", [{ label: "Unread", value: null }], now - 2 * 86_400_000);
  const s = h.enrich("k", [{ label: "Unread", value: 3 }], now)[0];
  assert.equal(s.delta, undefined);
  assert.equal(fs.existsSync(file), false, "nothing written for a failed check");
});
