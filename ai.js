// AI providers, picked by model id prefix:
//   claude-*        → Anthropic SDK (lazy import; the only npm dependency)
//   openrouter/*    → OpenRouter, OpenAI-compatible chat completions over fetch
//   anything else   → local Ollama
// All three expose the same shape: an async iterable of text chunks. Nothing here invents facts.

export const CLAUDE_MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"];
export const isClaude = (m) => /^claude-/.test(m || "");
export const isOpenRouter = (m) => /^openrouter\//.test(m || "");
export const provider = (m) => (isClaude(m) ? "anthropic" : isOpenRouter(m) ? "openrouter" : "ollama");
const TIMEOUT = 60_000;

let Anthropic = null;
async function anthropic(env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("Add your Anthropic API key in ⚙ Options → Keys to use Claude.");
  Anthropic ??= (await import("@anthropic-ai/sdk")).default;
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

async function* claudeStream({ model, system, messages, effort = "low", signal }, env) {
  const c = await anthropic(env);
  const stream = c.beta.messages.stream({
    model, max_tokens: 64000, system, messages,
    output_config: { effort },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  }, { signal: signal ?? AbortSignal.timeout(TIMEOUT) });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield `\n[Claude declined: ${final.stop_details?.explanation ?? final.stop_details?.category ?? "policy"}]`;
}

// OpenRouter: SSE "data: {...}" lines, OpenAI delta format.
async function* openrouterStream({ model, system, messages, temperature = 0.5, signal }, env) {
  if (!env.OPENROUTER_API_KEY) throw new Error("Add your OpenRouter API key in ⚙ Options → Keys to use OpenRouter models.");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: signal ?? AbortSignal.timeout(TIMEOUT),
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://github.com/DaveEuson/good-day-sunshine", "X-Title": "Good Day Sunshine" },
    body: JSON.stringify({ model: model.replace(/^openrouter\//, ""), stream: true, temperature, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!r.ok) throw new Error(`openrouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith("data: ")) continue;
      const d = l.slice(6).trim();
      if (d === "[DONE]") return;
      try { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) yield t; } catch {}
    }
  }
}

// think:false keeps reasoning models (qwen3.x, deepseek-r1) from spending the whole budget thinking; these are short tasks.
async function* ollamaStream({ model, system, messages, temperature = 0.5, signal, think = false }, env) {
  const url = env.OLLAMA_URL || "http://localhost:11434";
  const r = await fetch(`${url}/api/chat`, {
    method: "POST",
    signal: signal ?? AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ model, stream: true, think, messages: [{ role: "system", content: system }, ...messages], options: { temperature } }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const l of lines) { if (!l) continue; try { const t = JSON.parse(l).message?.content; if (t) yield t; } catch {} }
  }
}

export function aiStream(opts, env) {
  const p = provider(opts.model);
  return p === "anthropic" ? claudeStream(opts, env) : p === "openrouter" ? openrouterStream(opts, env) : ollamaStream(opts, env);
}

export async function aiText(opts, env) {
  let out = "";
  for await (const t of aiStream(opts, env)) out += t;
  return out.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// Curated OpenRouter list for the picker (vendors people recognise), cached an hour. Any other id works if typed into .env.
const OR_VENDORS = ["anthropic", "google", "openai", "meta-llama", "mistralai", "deepseek", "qwen", "x-ai"];
let orCache = { at: 0, models: [] };
export async function openrouterModels(env) {
  if (!env.OPENROUTER_API_KEY) return [];
  if (Date.now() - orCache.at < 3_600_000) return orCache.models;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(5000) });
    const all = (await r.json()).data ?? [];
    const ids = all.map((m) => m.id).filter((id) => OR_VENDORS.includes(id.split("/")[0]) && !/:(free|batch|thinking|online|extended)$|preview|exp|beta|\d{4}-\d{2}-\d{2}/.test(id)).sort();
    orCache = { at: Date.now(), models: ids.slice(0, 40).map((id) => `openrouter/${id}`) };
  } catch { orCache = { at: Date.now(), models: ["openrouter/anthropic/claude-haiku-4-5", "openrouter/google/gemini-2.5-flash", "openrouter/openai/gpt-4o-mini"] }; }
  return orCache.models;
}
