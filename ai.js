// AI providers: local Ollama (default) or Claude via the Anthropic SDK when a model id starts with "claude-".
// The SDK is imported lazily so the app runs with no node_modules when Claude isn't configured.

export const CLAUDE_MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"];
export const isClaude = (model) => /^claude-/.test(model || "");

let Anthropic = null;
async function client(env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("Add your Anthropic API key in ⚙ Options → Keys to use Claude.");
  Anthropic ??= (await import("@anthropic-ai/sdk")).default;
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

// Streams text chunks. `messages` are {role, content} turns; `system` is a string.
export async function* claudeStream({ model, system, messages, effort = "low" }, env) {
  const c = await client(env);
  const stream = c.beta.messages.stream({
    model,
    max_tokens: 64000,
    system,
    messages,
    output_config: { effort },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield `\n[Claude declined: ${final.stop_details?.explanation ?? final.stop_details?.category ?? "policy"}]`;
}

export async function claudeText(opts, env) {
  let out = "";
  for await (const t of claudeStream(opts, env)) out += t;
  return out.trim();
}

// Ollama streaming, normalised to the same "async iterable of text" shape.
export async function* ollamaStream({ model, system, messages, url, temperature = 0.5 }) {
  const r = await fetch(`${url}/api/chat`, {
    method: "POST",
    body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: system }, ...messages], options: { temperature } }),
  });
  if (!r.ok) throw new Error(`ollama chat → ${r.status}`);
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const l of lines) { if (!l) continue; try { const t = JSON.parse(l).message?.content; if (t) yield t; } catch {} }
  }
}
