import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../providers/email.js";

const entry = (title, iso) => `<entry><title>${title}</title><link rel="alternate" href="https://mail.google.com/x?a=1&amp;b=2"/><summary>hi &amp; bye</summary><issued>${iso}</issued><author><name>Priya</name></author></entry>`;
const now = Date.parse("2026-09-27T16:00:00Z");

test("email: counts only mail from the last day, unescapes, keeps links", () => {
  const xml = `<feed><fullcount>2604</fullcount>${entry("New thing", "2026-09-27T09:00:00Z")}${entry("Old thing", "2026-09-20T09:00:00Z")}</feed>`;
  const f = parseFeed(xml, now);
  assert.equal(f.unread, 2604);
  assert.equal(f.recent, 1);
  assert.equal(f.recentCapped, false);
  assert.equal(f.entries[0].url, "https://mail.google.com/x?a=1&b=2");
  assert.equal(f.entries[0].summary, "hi & bye");
  assert.equal(f.entries[0].from, "Priya");
});

test("email: a full page of recent mail is reported as 20 or more", () => {
  const xml = `<feed><fullcount>181497</fullcount>${Array.from({ length: 20 }, (_, i) => entry(`m${i}`, "2026-09-27T12:00:00Z")).join("")}</feed>`;
  const f = parseFeed(xml, now);
  assert.equal(f.recent, 20);
  assert.equal(f.recentCapped, true);
});
