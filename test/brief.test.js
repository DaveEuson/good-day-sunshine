import { test } from "node:test";
import assert from "node:assert/strict";
import { brief } from "../brief.js";

test("brief falls back to template when Ollama unreachable", async () => {
  const widgets = [
    { title: "GitHub", stats: [{ label: "Stars", value: 13 }] },
    { title: "Needs attention", attention: [{ text: "x", url: "", level: "high" }, { text: "y", url: "", level: "med" }] },
  ];
  const text = await brief({ widgets, name: "Test" }, { OLLAMA_URL: "http://127.0.0.1:1", OLLAMA_TIMEOUT_MS: 500 });
  assert.match(text, /Test/);
  assert.match(text, /GitHub stars at 13/);
  assert.match(text, /2 things need you \(1 urgent\)/);
});
