// AI "good morning" brief. Provider picked by OLLAMA_MODEL prefix (local Ollama, claude-*, openrouter/*); template fallback if it fails.
import { aiText, warmOllama } from "./ai.js";
export const warmBrief = (env) => warmOllama(env.OLLAMA_MODEL || "qwen3.5:9b", env);

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
      case "email": { const m = w.mail; if (!m) return null; const n = m.recentCapped ? "20 or more" : m.recent; return `Inbox (${m.folder}): ${n} new in the last day${n ? "" : " (nothing new)"}. The total unread count is old mail and not worth mentioning.`; }
      case "github": { const st = val(w, "Stars"), v = w.stats?.find((s) => s.label.startsWith("Views")); return st ? `GitHub: ${st.value} stars${d(st)}${v ? `, ${v.value} views over ${v.label.replace("Views ", "")}${v.sub?.includes("collected") ? " (partial data)" : ""}` : ""}.` : null; }
      case "news": return (w.items ?? []).length ? `Top stories: ${w.items.slice(0, 4).map((i) => i.text).join("; ")}.` : null;
      case "routine": case "garden": return null;   // the companion and their own tiles say these; the brief does not restate them
      case "ai": case "credits": return null;   // housekeeping cards: only mentioned when broken (handled above)
      default: return (w.stats ?? []).length ? `${w.title}: ${w.stats.map((s) => `${s.label.toLowerCase()} ${s.value}${d(s)}`).join(", ")}.` : null;
    }
  }).filter(Boolean).join("\n");
}

// The model may only restate what the page knows. Advice nobody asked for ("keep the humidity up") and numbers that are
// not in the data are caught here; the caller then shows the plain template instead. Returns why it was rejected, or null.
const ADVICE = /\b(remember to|make sure|don['’]t forget|do not forget|be sure to|you should|you could|you might want|consider|try to|keep the|check for|keep an eye)\b/i;
const TOPICS = [[/\b(routine|checklist)\b/i, /routine|checklist/i, "the morning routine"], [/\b(plant|sprout|garden|streak)\b/i, /plant|sprout|garden|streak/i, "the garden"]];
const UNITS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
// "thirty-eight" is a number too (and "one" is not counted: "one thing" is not a figure)
export function spokenNumbers(text) {
  const out = [];
  for (const m of String(text).toLowerCase().matchAll(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?\b|\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g))
    out.push(m[1] ? TENS[m[1]] + (m[2] ? UNITS[m[2]] : 0) : UNITS[m[3]]);
  return out;
}
export function grounded(text, factsText) {
  if (ADVICE.test(text)) return "it gave advice the page can't back up";
  for (const [said, has, name] of TOPICS) if (said.test(text) && !has.test(factsText)) return `it talked about ${name}, which isn't in the data`;
  for (const n of String(text).match(/\d+(?:[.,]\d+)?/g) ?? []) if (!factsText.includes(n)) return `it used the number ${n}, which isn't in the data`;
  for (const n of spokenNumbers(text)) if (!new RegExp(`(?<![\\d.,])${n}(?![\\d])`).test(factsText)) return `it used the number ${n}, which isn't in the data`;
  return null;
}

// No model available: one honest sentence, no field names, no zeros.
export function fallback({ widgets, name, evening, today }) {
  if (evening && today) return [today.headline, today.todo[0] ? `${today.todo[0]}.` : "", today.tail].filter(Boolean).join(" ");
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
// Evening: a short recap of what got done and the one thing to set up for tomorrow.
async function eveningBrief(input, env, timeoutMs) {
  const { name, tone, today, widgets, character } = input;
  const model = env.OLLAMA_MODEL || "qwen3.5:9b";
  const lines = [
    `Done today: ${today.done.length ? today.done.join(", ") : "nothing tracked"}.`,
    today.todo.length ? `Still open: ${today.todo.join("; ")}.` : "",
    today.tomorrow.length ? `Tomorrow: ${today.tomorrow.join("; ")}.` : today.calendarChecked ? "Tomorrow: nothing on the calendar." : "",
    `Check-in streak: ${today.streak} days.`,
    ...widgets.filter((w) => w.status === "error").map((w) => `${w.title}: could not be checked (${w.error}).`),
  ].filter(Boolean).join("\n");
  const system = `${persona(character, name)} You write a two-sentence end-of-day note for ${name}. Tone: ${tone || "warm, concise"}. First sentence: acknowledge what got done today, kindly, without exaggerating; if little got done, say that is fine. Second sentence: what tomorrow starts with, taken only from the "Tomorrow" line; if there is no Tomorrow line, leave tomorrow out and do not suggest anything. Never give advice about the weather, plants, health or anything else that is not in the facts. Plain text, no lists, no emoji. Use only the facts given. Write like a friend talking, not a report: never say "tracked", "tasks", "outcome" or "little to report".`;
  const fallbackText = [today.headline, today.todo[0] ? `${today.todo[0]}.` : "", today.tail].filter(Boolean).join(" ");
  try {
    const text = await aiText({ model, system, messages: [{ role: "user", content: lines }], effort: "low", temperature: 0.6, signal: AbortSignal.timeout(timeoutMs) }, env);
    if (!text) return { text: fallbackText, fromModel: false, reason: "model returned nothing" };
    const bad = grounded(text, lines);
    return bad ? { text: fallbackText, fromModel: false, reason: bad } : { text, fromModel: true };
  } catch (e) {
    return { text: fallbackText, fromModel: false, reason: e.name === "TimeoutError" ? `model took over ${Math.round(timeoutMs / 1000)}s` : e.message.slice(0, 80) };
  }
}

// The character writes the brief in first person. Wording only; the facts rules below still apply.
const CHARACTER = {
  sun: "Sun, a warm, slightly nudgy morning companion",
  cat: "Cat, a dry, secretly kind companion",
  robot: "Robot, a precise, economical companion",
  cloud: "Cloud, a soft, gentle companion",
  coffee: "Coffee, a quick companion who keeps it short",
};
const persona = (c, name) => `You are ${CHARACTER[c] ?? CHARACTER.sun}. You are on ${name}'s side and want their day to go well. Speak to ${name} in first person ("I", "you"), like someone who is here to help, not a report.`;

export async function brief(input, env, timeoutMs = +(env.BRIEF_TIMEOUT_MS || 30_000)) {
  const { widgets, name, tone, focus, mood, evening, today, character } = input;
  const model = env.OLLAMA_MODEL || "qwen3.5:9b";
  const hour = new Date().getHours();
  if (evening && today) return eveningBrief(input, env, timeoutMs);
  const system = `${persona(character, name)} You write a "start of day" brief for ${name}. Local time hour: ${hour}. Tone: ${tone || "warm, concise"}.${focus ? ` They say what usually steals their day is ${focus}; if the data hints at that, say so gently.` : ""}
${mood === "rough" ? "They said they feel rough this morning: one sentence, gentle, only the single most important thing. " : mood === "meh" ? "They feel meh: keep it to two short sentences. " : ""}Do not mention the morning routine, the garden or plants: they are shown elsewhere. Your job here is the picture of the day, not the to-do list: the next action is already suggested to them separately, so do not give instructions or say "please". Speak as yourself, using "I" at least once (for example "I only see…", "I'd keep an eye on…", "Looks like…"). Rules: plain text, no markdown, no lists, no headings, no emoji. One to three sentences, shorter is better. Say only what is new, changed, or worth knowing: things needing attention, the first event today, a number that moved, weather only if it changes plans. Never restate a zero, an unchanged number, or anything already obvious. If nothing needs them, say that in one short sentence and stop. Copy numbers exactly as digits from DATA. Do not invent data. A source that "could not be checked" must be mentioned as such in one clause; never claim all clear while one is broken.`;
  try {
    const dataText = facts(widgets);
    const text = await aiText({ model, system, messages: [{ role: "user", content: `DATA:\n${dataText}` }], effort: "low", temperature: 0.6, signal: AbortSignal.timeout(timeoutMs) }, env);
    if (!text) return { text: fallback(input), fromModel: false, reason: "model returned nothing" };
    const bad = grounded(text, dataText);
    return bad ? { text: fallback(input), fromModel: false, reason: bad } : { text, fromModel: true };
  } catch (e) {
    return { text: fallback(input), fromModel: false, reason: e.name === "TimeoutError" ? `model took over ${Math.round(timeoutMs / 1000)}s` : e.message.slice(0, 80) };
  }
}
