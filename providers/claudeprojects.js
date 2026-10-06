// "Claude projects": what you have been doing in Claude Code, from its local transcripts. Which projects, how long, how much.
// Spend is an estimate from public per-token prices. Reads files only; see claudecode.js.
import { indexFor, fmtTokens, fmtHours, agoOf } from "../claudecode.js";

export const meta = { title: "Claude projects", icon: "✳" };

export async function fetchData(cfg, env, ctx) {
  const { index, dir } = indexFor(cfg, env, ctx);
  if (!index.exists()) return { setup: `Claude Code history not found on this machine (looked in ${dir}). This widget only works where Claude Code runs.` };
  const days = Math.min(30, Math.max(1, +cfg.days || 7)), top = Math.min(12, Math.max(1, +cfg.top || 6));
  const prog = await index.refresh({ days });
  const rows = index.snapshot({ days });
  const today = rows.filter((r) => r.todayTokens > 0 || agoMs(r) < 86_400_000);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const unknown = [...new Set(rows.flatMap((r) => r.unknown))];

  const stats = [
    { label: "Active, 24h", value: today.length, sub: `${rows.length} project${rows.length === 1 ? "" : "s"} in ${days}d` },
    { label: `M tokens, ${days}d`, value: +(sum("tokens") / 1e6).toFixed(1), sub: "fresh, no cache reads" },
    { label: `Est. $, ${days}d`, value: Math.round(sum("usd")), sub: unknown.length ? `no price for ${unknown.join(", ")}` : "estimate" },
    { label: `Hours, ${days}d`, value: +(sum("activeMs") / 3_600_000).toFixed(1), sub: "between messages" },
  ];
  const items = rows.slice(0, top).map((r) => ({
    text: r.name,
    badge: agoOf(r.lastTs),
    sub: `${r.sessions} session${r.sessions === 1 ? "" : "s"} · ${fmtHours(r.activeMs)} · ${fmtTokens(r.tokens)} tok · ~$${Math.round(r.usd)}`,
  }));
  if (prog.partial) items.push({ text: "Still reading older sessions…", sub: `${prog.done} of ${prog.total} files so far` });
  if (!rows.length && !prog.partial) items.push({ text: `Nothing in the last ${days} days.`, sub: "Open Claude Code in a project and it shows up here." });
  const claude = { days, usd: sum("usd"), rows: rows.slice(0, 30).map((r) => ({ name: r.name, lastTs: r.lastTs, sessions: r.sessions, activeMs: r.activeMs, tokens: r.tokens, usd: r.usd })) };   // for the companion
  return { stats, items, claude, ...(prog.partial ? { partial: true, retryMs: 3000 } : {}) };
}
const agoMs = (r) => Date.now() - r.lastTs;