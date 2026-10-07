import { test } from "node:test";
import assert from "node:assert/strict";
import { brief, facts, fallback } from "../brief.js";

const widgets = [
  { title: "Inbox", type: "email", status: "error", error: "Gmail rejected the app password." },
  { title: "Needs attention", type: "attention", status: "ok", stats: [{ label: "Notifications", value: 0 }, { label: "Reviews", value: 0 }, { label: "Assigned", value: 0 }], attention: [] },
  { title: "GitHub", type: "github", status: "ok", stats: [{ label: "Stars", value: 14, delta: 1, window: 7 }, { label: "Views 30d", value: 189, sub: "86 unique · 14 of 30 days collected" }] },
  { title: "YouTube", type: "youtube", status: "setup", setup: "Set keys" },
];

test("facts: failures are stated, setup skipped, no field-name prose", () => {
  const f = facts(widgets);
  assert.match(f, /Inbox: could not be checked \(Gmail rejected the app password\.\)/);
  assert.match(f, /GitHub: 14 stars \(up 1 vs 7 days ago\), 189 views over 30d \(partial data\)/);
  assert.doesNotMatch(f, /YouTube/);
  assert.doesNotMatch(f, /unread at 0|Unread=0/);
});

test("fallback: never claims all clear while a source is broken", () => {
  const t = fallback({ widgets, name: "Dave" });
  assert.match(t, /couldn’t check Inbox/);
  assert.match(t, /Otherwise nothing needs you/);
  assert.doesNotMatch(t, /at 0/);
});

test("brief falls back to template when the model is unreachable", async () => {
  const { text, fromModel } = await brief({ widgets, name: "Test" }, { OLLAMA_URL: "http://127.0.0.1:1", OLLAMA_MODEL: "x" });
  assert.equal(fromModel, false);
  assert.match(text, /Test/);
  assert.match(text, /Inbox/);
});

test("grounded: advice and numbers the page doesn't have are caught, honest restatements pass", async () => {
  const { grounded } = await import("../brief.js");
  const data = "Garden: the sprout has not been watered yet today. Check-in streak: 11 days in a row.\nWeather: 36 clear, high 39.";
  assert.equal(grounded("The sprout still needs water and your streak is at 11 days. It will reach 39 today.", data), null);
  assert.match(grounded("Remember to keep the humidity up for the plant.", data), /advice/);
  assert.match(grounded("It will hit 45 degrees this afternoon.", data), /number 45/);
  assert.match(grounded("You should water it soon.", data), /advice/);
});

test("grounded: things shown elsewhere and numbers in words are checked too", async () => {
  const { grounded, spokenNumbers, facts } = await import("../brief.js");
  const data = "Weather: 36 clear, high 39.\nGitHub: 15 stars.";
  assert.match(grounded("You still have four routine steps ahead.", data), /routine/);
  assert.match(grounded("The sprout needs water.", data), /garden/);
  assert.match(grounded("It will be about thirty-eight degrees.", data), /number 38/);
  assert.equal(grounded("It is thirty-six and clear, with fifteen stars on GitHub.", data), null);
  assert.deepEqual(spokenNumbers("one thing, twenty-two apples, forty and seven"), [22, 40, 7]);
  const f = facts([{ type: "routine", status: "ok", title: "Morning routine", routine: { total: 5, done: 0, missing: ["Meds"], complete: false } }, { type: "garden", status: "ok", title: "Garden", garden: { plantView: { name: "Sprout", wateredToday: false }, streak: 3 } }]);
  assert.equal(f, "", "the routine and the plant are not in the brief's facts");
});
