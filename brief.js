// AI "good morning" brief. Local Ollama by default, Claude if OLLAMA_MODEL is a claude-* id; template fallback if either fails.
import { isClaude, claudeText } from "./ai.js";

function summarize(widgets) {
  return widgets.map((w) => {
    if (w.setup || w.error) return `${w.title}: not configured`;
    const stats = (w.stats ?? []).map((s) => `${s.label}=${s.value}${s.delta != null ? ` (${s.delta >= 0 ? "+" : ""}${s.delta} vs 7d ago)` : ""}`).join(", ");
    const att = (w.attention ?? []).slice(0, 8).map((a) => `- ${a.text}`).join("\n");
    const items = (w.items ?? []).slice(0, 5).map((i) => `- ${i.text} (${i.badge ?? ""})`).join("\n");
    return `${w.title}: ${stats}\n${att}${items}`.trim();
  }).join("\n\n");
}

function fallback({ widgets, name }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const att = widgets.flatMap((w) => w.attention ?? []);
  const high = att.filter((a) => a.level === "high").length;
  const bits = [];
  for (const w of widgets) {
    const s = w.stats?.[0];
    if (s) bits.push(`${w.title} ${s.label.toLowerCase()} at ${s.value}`);
  }
  return `${greet}, ${name}. ${bits.join(", ")}. ${att.length ? `${att.length} things need you (${high} urgent).` : "Nothing is on fire."}`;
}

export async function brief(input, env) {
  const { widgets, name, tone, focus, mood } = input;
  const url = env.OLLAMA_URL || "http://localhost:11434";
  const model = env.OLLAMA_MODEL || "qwen3.5:9b";
  const hour = new Date().getHours();
  const system = `You write a 3-sentence "start of day" brief for ${name}. Local time hour: ${hour}. Tone: ${tone || "warm, concise"}.${focus ? ` They say what usually steals their day is ${focus}; if the data hints at that, say so gently.` : ""}
${mood === "rough" ? "They said they feel rough this morning: one sentence, gentle, only the single most important thing. " : mood === "meh" ? "They feel meh: keep it to two short sentences. " : ""}Rules: plain text, no markdown, no lists, no headings, no emoji. One to three sentences, shorter is better. Say only what is new, changed, or needs a decision: things needing attention, the first event today, a number that moved (deltas are marked "vs 7d ago"), weather only if it changes plans. Never restate a zero, an unchanged number, or anything already obvious. If nothing needs them, say that in one short sentence and stop. Copy numbers exactly as digits from DATA. Do not invent data. Sections marked "not configured" get no mention.`;
  const data = `DATA:\n${summarize(widgets)}`;

  try {
    if (isClaude(model)) {
      const text = await claudeText({ model, system, messages: [{ role: "user", content: data }], effort: "low" }, env);
      return text || fallback(input);
    }
    const ctl = AbortSignal.timeout(+(env.OLLAMA_TIMEOUT_MS || 60_000));
    const r = await fetch(`${url}/api/generate`, {
      method: "POST",
      signal: ctl,
      body: JSON.stringify({ model, prompt: `${system}\n\n${data}`, stream: false, think: false, options: { temperature: 0.6, num_predict: 200 } }),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    const j = await r.json();
    const text = (j.response || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return text || fallback(input);
  } catch {
    return fallback(input);
  }
}
