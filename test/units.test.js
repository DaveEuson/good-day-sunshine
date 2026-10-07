import { test } from "node:test";
import assert from "node:assert/strict";
import { fahrenheit } from "../providers/weather.js";
import { warmOllama } from "../ai.js";

test("weather units: automatic follows the country, explicit choices win", () => {
  assert.equal(fahrenheit("auto", "US"), true);
  assert.equal(fahrenheit(undefined, "us"), true);
  assert.equal(fahrenheit("auto", "GB"), false);
  assert.equal(fahrenheit("auto", undefined), false, "unknown place: Celsius");
  assert.equal(fahrenheit("f", "GB"), true);
  assert.equal(fahrenheit("c", "US"), false);
});

test("warmOllama: wakes a local model once, never a cloud model", async () => {
  const calls = [], real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true }; };
  try {
    warmOllama("warm-test-model:9b", { OLLAMA_URL: "http://127.0.0.1:1" });
    warmOllama("warm-test-model:9b", { OLLAMA_URL: "http://127.0.0.1:1" });
    warmOllama("claude-opus-5-5", {});
    warmOllama("openrouter/x/y", {});
  } finally { globalThis.fetch = real; }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:1/api/generate");
  assert.deepEqual(calls[0].body, { model: "warm-test-model:9b", keep_alive: "30m" });
});
