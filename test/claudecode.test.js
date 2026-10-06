import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createIndex, applyLine, costOf, freshTokens, projectOf, dayStr } from "../claudecode.js";

const T = (h, m = 0, d = 6) => new Date(2026, 9, d, h, m).toISOString();   // local time, Oct 2026
const now = new Date(2026, 9, 6, 12, 0).getTime();
const asst = (id, ts, model, u, extra = {}) => JSON.stringify({ type: "assistant", timestamp: ts, cwd: "H:\\Projects\\Slop24", message: { id, model, usage: u, content: [{ type: "text", text: "hi" }] }, ...extra });
const user = (text, ts, extra = {}) => JSON.stringify({ type: "user", timestamp: ts, cwd: "H:\\Projects\\Slop24", message: { role: "user", content: text }, ...extra });
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "gds-claude-"));
function write(dir, rel, lines) { const f = path.join(dir, "projects", rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, lines.join("\n") + "\n"); return f; }

test("one reply written as several lines is counted once, with the last usage", () => {
  const ent = { offset: 0, byDay: {}, lastTs: 0 };
  const u1 = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 1000, cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 0 } };
  const u2 = { ...u1, output_tokens: 541 };
  for (const [id, u, ts] of [["m1", u1, T(9)], ["m1", u2, T(9, 0)], ["m1", u2, T(9, 1)], ["m2", u1, T(9, 2)]]) applyLine(ent, JSON.parse(asst(id, ts, "claude-opus-5-5", u)));
  const day = ent.byDay[dayStr(Date.parse(T(9)))];
  assert.deepEqual(day.byModel["claude-opus-5-5"], [20, 546, 2000, 400, 0]);
});

test("cost: known models priced, unknown models reported, cache writes cost more than reads", () => {
  const { usd, unknown } = costOf({ "claude-opus-5-5": [1e6, 1e6, 1e6, 1e6, 0], "claude-future-9": [5, 5, 0, 0, 0] });
  assert.ok(Math.abs(usd - (4 + 20 + 0.2 + 5)) < 1e-9, String(usd));   // $4 in + $20 out + $0.20 read + $5 write (1.25 x 4)
  assert.deepEqual(unknown, ["claude-future-9"]);
  assert.equal(freshTokens({ a: [1, 2, 1000, 3, 4] }), 10, "cache reads are not fresh work");
});

test("projects: worktrees fold into their project; paths give names", () => {
  assert.deepEqual(projectOf("H:\\Projects\\Slop24\\.claude\\worktrees\\clever-spence"), { key: "h:/projects/slop24", name: "Slop24", path: "H:/Projects/Slop24" });
  assert.equal(projectOf("", "H--Projects-X").name, "X", "no known directory: the folder name, minus the drive and Projects prefix");
});

test("index: tokens, sessions, sub-agents, time, last prompt, per project", async () => {
  const dir = tmpDir();
  const u = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 5000, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 0 } };
  write(dir, "H--Projects-Slop24/s1.jsonl", [
    user("fix the login bug", T(9, 0)), asst("a", T(9, 1), "claude-sonnet-5-5", u), asst("a", T(9, 1), "claude-sonnet-5-5", u),
    user("<command-name>/model</command-name>", T(9, 2)), user("now add a test", T(9, 3)), asst("b", T(9, 4), "claude-sonnet-5-5", u),
    JSON.stringify({ type: "custom-title", customTitle: "Login fixes", sessionId: "s1" }),
    JSON.stringify({ type: "last-prompt", lastPrompt: "now add a test", sessionId: "s1" }),
    user("x", T(9, 5), { message: { role: "user", content: [{ type: "tool_result", content: "big" }] } }),
  ]);
  write(dir, "H--Projects-Slop24/s1/subagents/agent-1.jsonl", [asst("c", T(9, 30), "claude-haiku-4-5", u)]);
  write(dir, "H--Projects-Other/s9.jsonl", [asst("d", T(8, 0, 1), "claude-haiku-4-5", u, { cwd: "H:\\Projects\\Other" })]);   // 5 days ago
  const idx = createIndex({ dir, now: () => now });
  const r = await idx.refresh({ days: 7 });
  assert.equal(r.partial, false); assert.equal(r.total, 3);
  const rows = idx.snapshot({ days: 7 });
  assert.equal(rows.length, 2);
  const slop = rows[0];
  assert.equal(slop.name, "Slop24");
  assert.equal(slop.sessions, 1, "sub-agent files are not sessions");
  assert.equal(slop.byModel["claude-sonnet-5-5"][0], 200, "two replies, a and b");
  assert.equal(slop.byModel["claude-haiku-4-5"][0], 100, "sub-agent spend counts");
  assert.equal(slop.prompts, 2, "commands and tool results are not prompts you typed");
  assert.equal(slop.last.prompt, "now add a test");
  assert.equal(slop.last.title, "Login fixes");
  assert.ok(slop.activeMs >= 4 * 60_000 && slop.activeMs <= 6 * 60_000, String(slop.activeMs));
  assert.ok(slop.usd > 0);
  assert.equal(idx.snapshot({ days: 1 }).length, 1, "the file from five days ago is outside a 1-day window");
});

test("index: only the new tail is read; a rewritten (shorter) file starts over; state survives a restart", async () => {
  const dir = tmpDir(), state = path.join(dir, "idx.json");
  const u = { input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 0 };
  const f = write(dir, "p/s.jsonl", [asst("a", T(9), "claude-haiku-4-5", u)]);
  let idx = createIndex({ dir, stateFile: state, now: () => now });
  await idx.refresh({ days: 3 });
  assert.equal(idx.snapshot({ days: 3 })[0].byModel["claude-haiku-4-5"][0], 10);
  fs.appendFileSync(f, asst("b", T(10), "claude-haiku-4-5", u) + "\n");
  await idx.refresh({ days: 3 });
  assert.equal(idx.snapshot({ days: 3 })[0].byModel["claude-haiku-4-5"][0], 20, "appended line added once, first line not re-counted");
  idx = createIndex({ dir, stateFile: state, now: () => now });   // restart
  await idx.refresh({ days: 3 });
  assert.equal(idx.snapshot({ days: 3 })[0].byModel["claude-haiku-4-5"][0], 20, "nothing re-read or doubled");
  fs.writeFileSync(f, asst("z", T(11), "claude-haiku-4-5", u) + "\n");   // shorter file
  await idx.refresh({ days: 3 });
  assert.equal(idx.snapshot({ days: 3 })[0].byModel["claude-haiku-4-5"][0], 10, "rewritten file is read from the start");
});

test("index: a missing Claude folder is reported, not an error", () => {
  assert.equal(createIndex({ dir: path.join(os.tmpdir(), "gds-no-such-claude-dir") }).exists(), false);
});