import { execSync } from "node:child_process";

const API = "https://api.github.com";

export function token(env) {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  try { return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return null; }
}

export async function gh(path, tok) {
  const r = await fetch(API + path, {
    headers: { Accept: "application/vnd.github+json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
  });
  if (!r.ok) throw new Error(`${path.split("?")[0]} → ${r.status}`);
  return r.json();
}

export const meta = { title: "GitHub", icon: "⌥" };

// cfg.window (days, default 14) sizes the traffic sum, the delta comparison and the sparkline.
// GitHub's traffic API only returns the last 14 days, so each day's views are stored (ctx.history) and
// summed over the window; longer windows fill in as days are collected.
export async function fetchData(cfg, env, ctx = {}) {
  const tok = token(env);
  const user = cfg.user;
  if (!user) return { setup: "Add your GitHub login to the GitHub widget in ⚙ Options." };
  const window = Math.max(1, Math.min(90, +cfg.window || 14));

  const repos = await gh(`/users/${user}/repos?per_page=100&sort=updated`, tok);
  const own = repos.filter((r) => !r.fork);
  const stars = own.reduce((n, r) => n + r.stargazers_count, 0);
  const forks = own.reduce((n, r) => n + r.forks_count, 0);
  const top = [...own].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, cfg.top ?? 5);

  // 14-day traffic needs push access; ignore per-repo failures.
  const traffic = await Promise.all(
    top.map((r) => gh(`/repos/${r.full_name}/traffic/views`, tok).catch(() => null))
  );
  let views = 0, uniques = 0, covered = 0, stored = false;
  const per = top.map((r, i) => {
    const t = traffic[i];
    if (!t) return null;
    if (ctx.history) {
      stored = true;
      for (const d of t.views ?? []) ctx.history.recordDaily(`gh:${r.full_name}`, d.timestamp.slice(0, 10), { views: d.count, uniques: d.uniques });
      const s = ctx.history.sumDaily(`gh:${r.full_name}`, window);
      covered = Math.max(covered, s.days);
      views += s.views ?? 0; uniques += s.uniques ?? 0;
      return s;
    }
    views += t.count; uniques += t.uniques; covered = 14;
    return { views: t.count, uniques: t.uniques, days: 14 };
  });
  const partial = stored && covered < window && covered > 0 ? ` · ${covered} of ${window} days collected` : "";

  const items = top.map((r, i) => ({
    text: r.name,
    url: r.html_url,
    badge: `★ ${r.stargazers_count}`,
    sub: per[i] ? `${per[i].views ?? 0} views · ${per[i].uniques ?? 0} unique (${window}d)` : r.description ?? "",
  }));

  return {
    stats: [
      { label: "Stars", value: stars },
      { label: "Forks", value: forks },
      { label: "Repos", value: own.length },
      { label: `Views ${window}d`, value: views, sub: `${uniques} unique${partial}` },
    ],
    items,
  };
}
