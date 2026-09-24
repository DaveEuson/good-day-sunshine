// AI credits: what each provider has left or has cost this month. Each provider is checked on its own;
// one failing never reads as $0 (it becomes a "couldn't check" line). Nothing configured → setup hint.
//
//   Anthropic  — Admin API cost report, month to date, USD. Needs ANTHROPIC_ADMIN_KEY (sk-ant-admin…; org accounts only).
//   OpenAI     — /v1/organization/costs, month to date, USD. Needs OPENAI_ADMIN_KEY (admin key, not a project key).
//   OpenRouter — remaining credits. Uses OPENROUTER_API_KEY via /auth/key (limit_remaining) or OPENROUTER_MANAGEMENT_KEY via /credits.
//   DeepSeek   — /user/balance. Needs DEEPSEEK_API_KEY.
// cfg.budget = { anthropic: 50, openai: 20 } monthly USD budgets → "left" and a heads-up under 10%.

export const meta = { title: "AI credits", icon: "◈" };

const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const usd = (n) => `$${n.toFixed(2)}`;
const get = async (url, headers) => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${r.status}${r.status === 401 || r.status === 403 ? " (key rejected or wrong key type)" : ""}`);
  return r.json();
};

// Pure parsers (tested). Amounts: Anthropic = decimal string in cents; OpenAI = { value, currency } in dollars.
export const sumAnthropic = (pages) => pages.flatMap((p) => p.data ?? []).flatMap((b) => b.results ?? []).reduce((s, r) => s + Number(r.amount) / 100, 0);
export const sumOpenAI = (json) => (Array.isArray(json) ? json : json.data ?? []).flatMap((b) => b.results ?? []).reduce((s, r) => s + Number(r.amount?.value ?? 0), 0);

async function anthropic(env) {
  const from = monthStart().toISOString();
  const pages = [];
  let page = null;
  do {
    const q = new URLSearchParams({ starting_at: from, limit: "31" }); if (page) q.set("page", page);
    const j = await get(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, { "x-api-key": env.ANTHROPIC_ADMIN_KEY, "anthropic-version": "2023-06-01" });
    pages.push(j); page = j.has_more ? j.next_page : null;
  } while (page && pages.length < 5);
  return { spent: sumAnthropic(pages) };
}

async function openai(env) {
  const start = Math.floor(monthStart().getTime() / 1000);
  const j = await get(`https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=31`, { Authorization: `Bearer ${env.OPENAI_ADMIN_KEY}` });
  return { spent: sumOpenAI(j) };
}

async function openrouter(env) {
  if (env.OPENROUTER_MANAGEMENT_KEY) {
    const j = await get("https://openrouter.ai/api/v1/credits", { Authorization: `Bearer ${env.OPENROUTER_MANAGEMENT_KEY}` });
    return { left: j.data.total_credits - j.data.total_usage, spentAll: j.data.total_usage };
  }
  const j = await get("https://openrouter.ai/api/v1/auth/key", { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` });
  const d = j.data ?? {};
  return { left: d.limit_remaining ?? null, spentAll: d.usage ?? null, limit: d.limit ?? null };
}

async function deepseek(env) {
  const j = await get("https://api.deepseek.com/user/balance", { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` });
  const b = (j.balance_infos ?? []).find((x) => x.currency === "USD") ?? j.balance_infos?.[0];
  return { left: b ? Number(b.total_balance) : null, currency: b?.currency ?? "USD", available: j.is_available };
}

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", keys: ["ANTHROPIC_ADMIN_KEY"], run: anthropic },
  { id: "openai", name: "OpenAI", keys: ["OPENAI_ADMIN_KEY"], run: openai },
  { id: "openrouter", name: "OpenRouter", keys: ["OPENROUTER_API_KEY", "OPENROUTER_MANAGEMENT_KEY"], any: true, run: openrouter },
  { id: "deepseek", name: "DeepSeek", keys: ["DEEPSEEK_API_KEY"], run: deepseek },
];

export async function fetchData(cfg, env) {
  const active = PROVIDERS.filter((p) => (p.any ? p.keys.some((k) => env[k]) : p.keys.every((k) => env[k])));
  if (!active.length) return { setup: "Add an Anthropic admin key, OpenAI admin key, OpenRouter key or DeepSeek key in ⚙ Options → Keys." };
  const budget = cfg.budget ?? {};
  const stats = [], items = [], attention = [], errors = [];
  const month = new Date().toLocaleDateString(undefined, { month: "short" });

  await Promise.all(active.map(async (p) => {
    try {
      const r = await p.run(env);
      if (r.spent != null) {
        const b = budget[p.id];
        const left = b != null ? b - r.spent : null;
        stats.push({ label: `${p.name} $ in ${month}`, value: Math.round(r.spent * 100) / 100, sub: b != null ? `of ${usd(b)} · ${usd(Math.max(0, left))} left` : "month to date" });
        if (b != null && left <= b * 0.1) attention.push({ text: `${p.name}: ${usd(Math.max(0, left))} of the ${usd(b)} monthly budget left`, url: "", level: left <= 0 ? "high" : "med" });
      }
      if (r.left != null) {
        const cur = r.currency && r.currency !== "USD" ? ` ${r.currency}` : "";
        stats.push({ label: `${p.name} left`, value: Math.round(r.left * 100) / 100, sub: r.limit != null ? `of ${usd(r.limit)} key limit${cur}` : r.spentAll != null ? `${usd(r.spentAll)} used so far${cur}` : cur.trim() || "credits" });
        if (r.left <= 2) attention.push({ text: `${p.name} credits are down to ${usd(Math.max(0, r.left))}`, url: "", level: r.left <= 0.5 ? "high" : "med" });
        if (r.available === false) attention.push({ text: `${p.name} says the balance is not sufficient for new requests`, url: "", level: "high" });
      } else if (r.spent == null) items.push({ text: `${p.name}: this key doesn’t report a balance`, sub: "OpenRouter needs a management key for exact credits" });
    } catch (e) {
      errors.push(p.name);
      items.push({ text: `${p.name}: couldn’t check`, sub: e.message });
    }
  }));

  if (errors.length === active.length) return { error: `Couldn’t check ${errors.join(", ")}: ${items[0]?.sub ?? "request failed"}` };
  return { stats, items, attention };
}
