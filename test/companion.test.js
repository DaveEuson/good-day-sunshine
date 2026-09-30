import { test } from "node:test";
import assert from "node:assert/strict";
import { suggest, VOICE } from "../companion.js";

const now = new Date(2026, 8, 30, 8, 20).getTime();   // Wednesday 08:20
const widgets = [
  { type: "attention", status: "ok", attention: [{ text: "Review: Fix auth token refresh", url: "https://github.com/x/pull/9", level: "high" }, { text: "a", level: "med" }, { text: "b", level: "med" }, { text: "c", level: "low" }] },
  { type: "calendar", status: "ok", next: { title: "Standup", start: new Date(2026, 8, 30, 9, 0).toISOString() } },
  { type: "email", status: "ok", items: [{ text: "MRI results", badge: "Beckie", url: "https://mail.google.com/1", sub: "3h · Here are the results" }, { text: "Old thing", badge: "X", sub: "5d · old" }] },
  { type: "routine", status: "ok", routine: { total: 5, done: 1, complete: false, rows: [{ id: "meds", label: "Meds", target: 1, done: true }, { id: "water", label: "Water", target: 4, done: false }] } },
  { type: "garden", status: "ok", garden: { plantView: { name: "Sprout", wateredToday: false, ready: false } } },
  { type: "email-broken", status: "error", title: "Inbox", error: "Gmail rejected the app password." },
];

test("companion: the most important thing comes first, and each has something to do", () => {
  const s = suggest({ widgets, cfg: { character: "sun" }, now });
  assert.deepEqual(s.map((x) => x.kind), ["broken", "waiting", "event", "mail", "routine", "plant", "notifications"]);
  assert.match(s[1].say, /Someone's waiting on you: “Fix auth token refresh”/);
  assert.deepEqual(s[1].actions.map((a) => a.act), ["focus", "open", "later"]);
  assert.match(s[2].say, /Standup is at 09:00, 40 minutes from now/);
  assert.equal(s.filter((x) => x.kind === "mail").length, 1, "only mail from the last day");
  assert.match(s[4].say, /Water first\?/);
  assert.equal(s[4].actions[0].label, "+1 water");
});

test("companion: not now removes it for the day; nothing left gives a gentle offer", () => {
  const s = suggest({ widgets: [widgets[0]], cfg: {}, later: ["wait-https://github.com/x/pull/9"], now });
  assert.equal(s[0].kind, "notifications");
  const clear = suggest({ widgets: [], cfg: {}, now });
  assert.equal(clear[0].kind, "clear");
  assert.equal(clear[0].actions[0].act, "pickFocus");
});

test("companion: the character changes the words, never the facts", () => {
  for (const c of ["sun", "cat", "robot", "cloud", "coffee"]) {
    const s = suggest({ widgets: [widgets[0]], cfg: { character: c }, now });
    assert.match(s[0].say, /Fix auth token refresh/, c);
  }
  for (const [kind, lines] of Object.entries(VOICE)) assert.deepEqual(Object.keys(lines).sort(), ["cat", "cloud", "coffee", "robot", "sun"], kind);
});

test("companion: in the evening it only offers what can still be done tonight", () => {
  const s = suggest({ widgets, cfg: {}, evening: true, today: { tomorrow: ["Standup at 09:00", "alarm at 07:00"] }, now: new Date(2026, 8, 30, 20).getTime() });
  assert.deepEqual(s.map((x) => x.kind), ["broken", "plant", "prep"]);
  assert.equal(suggest({ widgets: [], cfg: {}, evening: true, today: { tomorrow: [] }, now }).at(0).kind, "clear");
});
import { fromAPerson } from "../companion.js";
test("companion: only offers to reply to people", () => {
  assert.equal(fromAPerson("github-actions[bot]", "notifications@github.com"), false);
  assert.equal(fromAPerson("Atlassian", "no-reply@atlassian.com"), false);
  assert.equal(fromAPerson("Beckie Euson", "beckie@example.com"), true);
  const s = suggest({ widgets: [{ type: "email", status: "ok", items: [{ text: "Build passed", badge: "CI", email: "noreply@ci.example", sub: "1h · ok" }] }], cfg: {}, now });
  assert.equal(s[0].kind, "clear");
});
