// Chat grounded in dashboard data. Proxies Ollama /api/chat, streams NDJSON through.
function context(widgets) {
  return (widgets ?? []).map((w) => {
    if (w.setup || w.error) return `${w.title}: not configured`;
    const stats = (w.stats ?? []).map((s) => `${s.label}=${s.value}${s.delta != null ? ` (${s.delta >= 0 ? "+" : ""}${s.delta} vs 7d ago)` : ""}`).join(", ");
    const items = [...(w.attention ?? []), ...(w.items ?? [])].slice(0, 10).map((i) => `- ${i.text}${i.badge ? ` [${i.badge}]` : ""}${i.sub ? ` · ${i.sub}` : ""}`).join("\n");
    return `## ${w.title}\n${stats}\n${items}`;
  }).join("\n\n");
}

export async function chat({ messages, widgets, name }, env) {
  const url = env.OLLAMA_URL || "http://localhost:11434";
  const model = env.CHAT_MODEL || "llama3.2:3b";
  const system = `You are ${name}'s personal dashboard assistant, running locally. Be brief and direct. Answer from the DATA below when relevant; say so if the data does not cover the question. Today: ${new Date().toDateString()}.

DATA:
${context(widgets)}`;

  const r = await fetch(`${url}/api/chat`, {
    method: "POST",
    body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: system }, ...messages.slice(-20)], options: { temperature: 0.5 } }),
  });
  if (!r.ok) throw new Error(`ollama chat → ${r.status}`);
  return r.body; // NDJSON stream: {message:{content}, done}
}
