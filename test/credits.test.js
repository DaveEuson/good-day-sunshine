import { test } from "node:test";
import assert from "node:assert/strict";
import { sumAnthropic, sumOpenAI, fetchData } from "../providers/credits.js";

test("credits: Anthropic amounts are cent strings across pages and buckets", () => {
  const pages = [
    { data: [{ results: [{ amount: "123.78912", currency: "USD" }, { amount: "76.21088", currency: "USD" }] }, { results: [] }], has_more: true },
    { data: [{ results: [{ amount: "1000", currency: "USD" }] }], has_more: false },
  ];
  assert.equal(Math.round(sumAnthropic(pages) * 100) / 100, 12.0);
});

test("credits: OpenAI amounts are dollar values, array or page envelope", () => {
  const arr = [{ object: "bucket", results: [{ amount: { value: 0.1308, currency: "usd" } }] }, { object: "bucket", results: [{ amount: { value: 2.5, currency: "usd" } }] }];
  assert.equal(Math.round(sumOpenAI(arr) * 1000) / 1000, 2.631);
  assert.equal(sumOpenAI({ object: "page", data: arr }), sumOpenAI(arr));
});

test("credits: nothing configured is setup, not zero", async () => {
  const r = await fetchData({}, {});
  assert.match(r.setup, /Options/);
  assert.equal(r.stats, undefined);
});
