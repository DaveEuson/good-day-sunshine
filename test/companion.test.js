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

test("companion: Claude Code insight only appears when those widgets are on, and only for real quiet or real spend", () => {
  const day = 86_400_000, monday = new Date(2026, 9, 5, 8, 20).getTime(), tue = monday + day;
  const rows = [
    { name: "RigMatch", lastTs: monday - 3_600_000, sessions: 7, activeMs: 40 * 3_600_000, tokens: 44e6, usd: 1156 },
    { name: "Slop24", lastTs: monday - 5 * day, sessions: 2, activeMs: 3 * 3_600_000, tokens: 5e6, usd: 69 },
    { name: "Tiny", lastTs: monday - 6 * day, sessions: 1, activeMs: 60_000, tokens: 1000, usd: 0 },
  ];
  const cp = { type: "claudeprojects", status: "ok", claude: { days: 7, usd: 1225, rows } };
  const left = { type: "claudeleft", status: "ok", left: [{ name: "Slop24", prompt: "add the retry logic to the uploader", title: "Uploader" }] };
  assert.equal(suggest({ widgets: [], cfg: {}, now: monday })[0].kind, "clear", "nothing without the widgets");

  const a = suggest({ widgets: [cp, left], cfg: { character: "sun" }, now: monday });
  assert.deepEqual(a.map((x) => x.kind), ["claudeLeft", "claudeSpend"]);
  assert.match(a[0].say, /Slop24 has been quiet for 5 days. Last time you asked: “add the retry logic to the uploader”/);
  assert.deepEqual(a[0].actions.map((x) => x.act), ["focus", "scroll", "later"]);
  assert.match(a[0].actions[0].arg, /Pick Slop24 back up: add the retry logic/);
  assert.match(a[1].say, /\$1,156 of roughly \$1,225, went to RigMatch. That's an estimate/);

  const b = suggest({ widgets: [cp], cfg: {}, now: tue });   // not Monday, and the prompt widget is off
  assert.deepEqual(b.map((x) => x.kind), ["claudeQuiet"], "Tiny never counts (no real work), spend only on Mondays");
  assert.equal(b[0].actions[0].act, "pickFocus");
  assert.deepEqual(suggest({ widgets: [{ ...cp, status: "error", error: "x" }], cfg: {}, now: monday }).map((x) => x.kind), ["broken"], "a broken widget is reported, never used as data");
  assert.equal(suggest({ widgets: [cp, left], cfg: {}, evening: true, today: { tomorrow: [] }, now: monday })[0].kind, "clear", "none of this in the evening");
});
