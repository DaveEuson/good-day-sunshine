// AI "good morning" brief. Provider picked by OLLAMA_MODEL prefix (local Ollama, claude-*, openrouter/*); template fallback if it fails.
import { aiText } from "./ai.js";

// Short human facts per widget. Failed checks are stated as failures, never as zeros.
export function facts(widgets) {
  const d = (s) => (s?.delta ? ` (${s.delta > 0 ? "up" : "down"} ${Math.abs(s.delta)} vs ${s.window ?? 7} days ago)` : "");
  const val = (w, label) => w.stats?.find((s) => s.label === label);
  return widgets.map((w) => {
    if (w.status === "setup") return null;
    if (w.status === "error") return `${w.title}: could not be checked (${w.error}). Say this; do not treat it as zero.`;
    switch (w.type) {
      case "attention": {
        const n = val(w, "Notifications"), r = val(w, "Reviews"), asg = val(w, "Assigned");
        const list = (w.attention ?? []).slice(0, 6).map((x) => `  - ${x.text}${x.level === "high" ? " (urgent)" : ""}`).join("\n");
        return `Needs attention: ${n?.value ?? 0} GitHub notifications${d(n)}, ${r?.value ?? 0} review requests, ${asg?.value ?? 0} assigned.${list ? "\n" + list : ""}`;
      }
      case "weather": { const [now, hl, rain] = w.stats ?? []; return now ? `Weather: ${now.value} ${now.label.toLowerCase()}, high ${hl?.value.split(" / ")[0]}, rain chance ${rain?.value}.` : null; }
      case "calendar": { const n = val(w, "Next"); return `Calendar: ${val(w, "Today")?.value ?? 0} events today${n?.sub ? `, next is ${n.sub} at ${n.value}` : ""}.`; }
      case "email": return `Inbox: ${val(w, "Unread")?.value ?? 0} unread${d(val(w, "Unread"))}.`;
      case "github": { const st = val(w, "Stars"), v = w.stats?.find((s) => s.label.startsWith("Views")); return st ? `GitHub: ${st.value} stars${d(st)}${v ? `, ${v.value} views over ${v.label.replace("Views ", "")}${v.sub?.includes("collected") ? " (partial data)" : ""}` : ""}.` : null; }
      case "news": return (w.items ?? []).length ? `Top stories: ${w.items.slice(0, 4).map((i) => i.text).join("; ")}.` : null;
      case "garden": { const p = w.garden?.plantView; return p ? `Garden: the ${p.name.toLowerCase()} ${p.wateredToday ? "has been watered today" : "has not been watered yet today"}${p.wilted ? " and is wilting" : ""}. Check-in streak: ${w.garden.streak} days in a row.` : null; }
      default: return (w.stats ?? []).length ? `${w.title}: ${w.stats.map((s) => `${s.label.toLowerCase()} ${s.value}${d(s)}`).join(", ")}.` : null;
    }
  }).filter(Boolean).join("\n");
}

// No model available: one honest sentence, no field names, no zeros.
export function fallback({ widgets, name }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const broken = widgets.filter((w) => w.status === "error");
  const att = widgets.flatMap((w) => w.attention ?? []);
  const high = att.filter((a) => a.level === "high").length;
  const parts = [];
  if (broken.length) parts.push(`I couldn’t check ${broken.map((w) => w.title).join(" or ")}.`);
  if (high) parts.push(`${high} urgent ${high === 1 ? "thing needs" : "things need"} you first.`);
  else if (att.length) parts.push(`${att.length} ${att.length === 1 ? "thing is" : "things are"} waiting, nothing urgent.`);
  else parts.push(broken.length ? "Otherwise nothing needs you." : "Nothing needs you right now.");
  return `${greet}, ${name}. ${parts.join(" ")}`;
}

// Returns { text, fromModel, reason? }. `timeoutMs` bounds the model wait; past that the template is the answer.
export async function brief(input, env, timeoutMs = +(env.BRIEF_TIMEOUT_MS || 20_000)) {
  const { widgets, name, tone, focus, mood } = input;
  const model = env.OLLAMA_MODEL || "qwen3.5:9b";
  const hour = new Date().getHours();
  const system = `You write a "start of day" brief for ${name}. Local time hour: ${hour}. Tone: ${tone || "warm, concise"}.${focus ? ` They say what usually steals their day is ${focus}; if the data hints at that, say so gently.` : ""}
${mood === "rough" ? "They said they feel rough this morning: one sentence, gentle, only the single most important thing. " : mood === "meh" ? "They feel meh: keep it to two short sentences. " : ""}Rules: plain text, no markdown, no lists, no headings, no emoji. One to three sentences, shorter is better. Say only what is new, changed, or needs a decision: things needing attention, the first event today, a number that moved, weather only if it changes plans. Never restate a zero, an unchanged number, or anything already obvious. If nothing needs them, say that in one short sentence and stop. Copy numbers exactly as digits from DATA. Do not invent data. A source that "could not be checked" must be mentioned as such in one clause; never claim all clear while one is broken.`;
  try {
    const text = await aiText({ model, system, messages: [{ role: "user", content: `DATA:\n${facts(widgets)}` }], effort: "low", temperature: 0.6, signal: AbortSignal.timeout(timeoutMs) }, env);
    return text ? { text, fromModel: true } : { text: fallback(input), fromModel: false, reason: "model returned nothing" };
  } catch (e) {
    return { text: fallback(input), fromModel: false, reason: e.name === "TimeoutError" ? `model took over ${Math.round(timeoutMs / 1000)}s` : e.message.slice(0, 80) };
  }
}
