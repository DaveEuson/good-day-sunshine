// Chat grounded in dashboard data. Returns an async iterable of text chunks from whichever provider CHAT_MODEL names.
import { aiStream } from "./ai.js";

function context(widgets) {
  return (widgets ?? []).map((w) => {
    if (w.status === "setup") return `${w.title}: not set up`;
    if (w.status === "error") return `${w.title}: could not be checked (${w.error})`;
    const stats = (w.stats ?? []).map((s) => `${s.label}=${s.value}${s.delta != null ? ` (${s.delta >= 0 ? "+" : ""}${s.delta} vs ${s.window ?? 7}d ago)` : ""}`).join(", ");
    const items = [...(w.attention ?? []), ...(w.items ?? [])].slice(0, 10).map((i) => `- ${i.text}${i.badge ? ` [${i.badge}]` : ""}${i.sub ? ` · ${i.sub}` : ""}`).join("\n");
    return `## ${w.title}\n${stats}\n${items}`;
  }).join("\n\n");
}

export function chat({ messages, widgets, name }, env) {
  const model = env.CHAT_MODEL || "llama3.2:3b";
  const system = `You are ${name}'s personal dashboard assistant, running on their own machine. Be brief and direct. Answer from the DATA below when relevant; say so if the data does not cover the question. Today: ${new Date().toDateString()}.

DATA:
${context(widgets)}`;
  const turns = messages.slice(-20).map(({ role, content }) => ({ role, content }));
  return aiStream({ model, system, messages: turns, effort: "low" }, env);
}
