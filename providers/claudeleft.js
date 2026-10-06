// "Where you left off": per project, the last thing you asked Claude Code, so you can pick the thread back up.
// Shows your own prompts on screen, so it is its own widget and off by default. Reads files only; see claudecode.js.
import { indexFor, agoOf } from "../claudecode.js";

export const meta = { title: "Where you left off", icon: "✳" };

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export async function fetchData(cfg, env, ctx) {
  const { index, dir } = indexFor(cfg, env, ctx);
  if (!index.exists()) return { setup: `Claude Code history not found on this machine (looked in ${dir}). This widget only works where Claude Code runs.` };
  const days = Math.min(30, Math.max(1, +cfg.days || 7)), top = Math.min(10, Math.max(1, +cfg.top || 5));
  const prog = await index.refresh({ days });
  const rows = index.snapshot({ days }).filter((r) => r.last?.prompt || r.last?.title);
  const items = rows.slice(0, top).map((r) => ({
    text: clip(r.last.prompt ?? r.last.title, 150),
    badge: r.name,
    sub: [agoOf(r.lastTs), r.last.title && r.last.prompt ? clip(r.last.title, 60) : ""].filter(Boolean).join(" · "),
  }));
  if (prog.partial) items.push({ text: "Still reading older sessions…", sub: `${prog.done} of ${prog.total} files so far` });
  if (!items.length) items.push({ text: `No Claude Code sessions in the last ${days} days.`, sub: "Open Claude Code in a project and it shows up here." });
  return { items, ...(prog.partial ? { partial: true, retryMs: 3000 } : {}) };
}