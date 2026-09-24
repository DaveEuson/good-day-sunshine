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
