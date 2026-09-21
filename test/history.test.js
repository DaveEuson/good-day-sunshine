import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openHistory } from "../history.js";
import { parseICS, expand } from "../providers/calendar.js";

const DAY = 86_400_000;

test("history: 7d delta and daily series", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ld-")), "h.jsonl");
  const h = openHistory(file);
  const now = Date.now();
  h.record("k", [{ label: "Stars", value: 10 }], now - 9 * DAY);
  h.record("k", [{ label: "Stars", value: 12 }], now - 3 * DAY);
  const stats = h.enrich("k", [{ label: "Stars", value: 15 }, { label: "Status", value: "LIVE" }], now);
  assert.equal(stats[0].delta, 5);
  assert.deepEqual(stats[0].series, [10, 12, 15]);
  assert.equal(stats[1].delta, undefined);
  // reopen reads from disk
  assert.equal(openHistory(file).enrich("k", [{ label: "Stars", value: 15 }], now)[0].delta, 5);
});

test("ics: weekly recurrence with BYDAY expands into window", () => {
  const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Standup\r\nDTSTART;TZID=Europe/London:20260901T093000\r\nDTEND;TZID=Europe/London:20260901T094500\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20260925\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 2);
  const out = expand(ev, new Date(2026, 8, 21), new Date(2026, 8, 28, 23, 59));
  const standups = out.filter((e) => e.title === "Standup").map((e) => e.start.getDay());
  assert.deepEqual(standups, [1, 3, 5, 1]); // Mon 21, Wed 23, Fri 25, Mon 28
  assert.ok(out.some((e) => e.title === "Holiday" && e.allDay));
});
