import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createStore } from "../swr.js";

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gds-swr-")), "cache.json");

test("swr: miss waits, fresh is cached, stale returns at once and refreshes in the background", async () => {
  let t = 1_000_000, calls = 0;
  const s = createStore(tmp(), { ttl: 100, now: () => t });
  const fn = async () => ({ n: ++calls });
  assert.deepEqual((await s.get("k", fn)).value, { n: 1 });
  assert.equal((await s.get("k", fn)).stale, false);
  assert.equal(calls, 1, "fresh hit does not refetch");
  t += 200;
  const r = await s.get("k", fn);
  assert.equal(r.stale, true);
  assert.deepEqual(r.value, { n: 1 }, "stale value served immediately");
  await new Promise((res) => setImmediate(res));
  assert.deepEqual((await s.get("k", fn)).value, { n: 2 }, "background refresh landed");
});

test("swr: survives a restart from disk, marked stale; too-old entries are dropped", async () => {
  const file = tmp();
  let t = 5_000_000;
  const a = createStore(file, { now: () => t });
  await a.get("fresh", async () => ({ v: "yesterday" }));
  a.flush();
  let slow;
  const b = createStore(file, { now: () => t + 60_000, maxStale: 3_600_000 });
  const r = await b.get("fresh", () => new Promise((res) => { slow = res; }));
  assert.equal(r.stale, true);
  assert.deepEqual(r.value, { v: "yesterday" }, "restart shows last known data without waiting");
  slow({ v: "today" });
  const c = createStore(file, { now: () => t + 7_200_000, maxStale: 3_600_000 });
  assert.deepEqual((await c.get("fresh", async () => ({ v: "new" }))).value, { v: "new" }, "older than maxStale → wait for fresh");
});

test("swr: a failed refresh replaces old data with an error, and force waits", async () => {
  let t = 0;
  const s = createStore(tmp(), { ttl: 10, now: () => t });
  await s.get("k", async () => ({ unread: 5 }));
  t = 100;
  await s.get("k", async () => { throw new Error("401 rejected"); });
  await new Promise((res) => setImmediate(res));
  assert.deepEqual((await s.get("k", async () => ({ unread: 9 }), { force: true })).value, { unread: 9 });
  t = 300;
  await s.get("k", async () => { throw new Error("401 rejected"); });
  await new Promise((res) => setImmediate(res));
  t = 301;
  assert.deepEqual((await s.get("k", async () => ({ unread: 1 }))).value, { error: "401 rejected" }, "error is stored, not the old numbers");
});

test("swr: clear() beats a refresh that was already running (a key saved mid-refresh)", async () => {
  const s = createStore(tmp(), { ttl: 60_000 });
  let release;
  const slowOld = () => new Promise((res) => { release = () => res({ used: "old key" }); });
  const pending = s.get("k", slowOld);
  s.clear();
  const fresh = await s.get("k", async () => ({ used: "new key" }), { force: true });
  release(); await pending;
  assert.deepEqual(fresh.value, { used: "new key" });
  assert.deepEqual((await s.get("k", async () => ({ used: "x" }))).value, { used: "new key" }, "the old result was not stored");
});
