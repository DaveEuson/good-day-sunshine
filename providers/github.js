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

export async function fetchData(cfg, env) {
  const tok = token(env);
  const user = cfg.user;
  if (!user) return { setup: "Add \"user\" to the github widget config." };

  const repos = await gh(`/users/${user}/repos?per_page=100&sort=updated`, tok);
  const own = repos.filter((r) => !r.fork);
  const stars = own.reduce((n, r) => n + r.stargazers_count, 0);
  const forks = own.reduce((n, r) => n + r.forks_count, 0);
  const top = [...own].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, cfg.top ?? 5);

  // 14-day traffic needs push access; ignore per-repo failures.
  const traffic = await Promise.all(
    top.map((r) => gh(`/repos/${r.full_name}/traffic/views`, tok).catch(() => null))
  );
  const views14 = traffic.reduce((n, t) => n + (t?.count ?? 0), 0);
  const uniques14 = traffic.reduce((n, t) => n + (t?.uniques ?? 0), 0);

  const items = top.map((r, i) => ({
    text: r.name,
    url: r.html_url,
    badge: `★ ${r.stargazers_count}`,
    sub: traffic[i] ? `${traffic[i].count} views · ${traffic[i].uniques} unique (14d)` : r.description ?? "",
  }));

  return {
    stats: [
      { label: "Stars", value: stars },
      { label: "Forks", value: forks },
      { label: "Repos", value: own.length },
      { label: "Views 14d", value: views14, sub: `${uniques14} unique` },
    ],
    items,
  };
}
