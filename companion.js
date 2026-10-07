// The companion: picks what matters right now and offers to help with it, one thing at a time, in the character's
// voice. Deterministic and built only from what the page already knows, so it can't invent facts; the AI brief is
// separate. Each suggestion carries buttons the page can act on:
//   focus(task) · open(url) · water · routine(id) · options(tab) · ask(prompt) · scroll(type) · later · pickFocus
import fs from "node:fs";
import path from "node:path";

const localDay = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hm = (t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const q = (s, n = 70) => { s = String(s ?? "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// Mail a person wrote, not a system: bots, no-reply and notification senders never get "draft a reply".
export const fromAPerson = (name = "", email = "") => !/\[bot\]|\bbot\b|no-?reply|donotreply|do-not-reply|notifications?@|notify@|alerts?@|mailer|bounce|updates?@|news(letter)?@|marketing|info@|support@|team@|hello@/i.test(`${name} ${email}`);
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

// One line per situation per character. Facts come in through {slots}; only the wording changes.
export const VOICE = {
  broken: {
    sun: "I can't see your {what} right now: {why} Want to fix it together?",
    cat: "Your {what} isn't talking to me. {why} Fix it and I'll stop mentioning it.",
    robot: "{what} is unreachable. Cause: {why} Recommend fixing the key.",
    cloud: "I can't reach your {what} at the moment. {why} No rush, but it would help me help you.",
    coffee: "{what} is down. {why} Fix it?",
  },
  waiting: {
    sun: "Someone's waiting on you: “{t}”. Want to do it now? I'll sit with you for 25 minutes.",
    cat: "“{t}” is waiting on you. I'd get it out of the way. I'll watch the clock.",
    robot: "Top priority: “{t}”. Someone is blocked on it. Start a 25-minute block?",
    cloud: "There's one thing someone's waiting for: “{t}”. Shall we do it together, gently?",
    coffee: "“{t}”. Someone's waiting. 25 minutes, go?",
  },
  eventSoon: {
    sun: "{t} is at {time}, {m} minutes from now. Time for one focused thing first. Want to pick it?",
    cat: "{t} at {time}. That's {m} minutes. Enough to get one thing done, if you start now.",
    robot: "{m} minutes until {t} ({time}). Suggest one focus block.",
    cloud: "{t} is at {time}. You have {m} quiet minutes before it, if you'd like to use them.",
    coffee: "{t} in {m}. One thing first?",
  },
  eventNow: {
    sun: "{t} starts in {m} minutes. Start wrapping up, I'll hold your place.",
    cat: "{t} in {m} minutes. Wrap it up.",
    robot: "{t} in {m} minutes. Wrap up now.",
    cloud: "{t} is in {m} minutes. Time to gently wind down what you're doing.",
    coffee: "{t}, {m} min. Wrap up.",
  },
  mail: {
    sun: "New email from {from}: “{t}”. Want me to help you write a reply?",
    cat: "{from} wrote: “{t}”. I can draft something if you can't be bothered.",
    robot: "New message from {from}: “{t}”. Draft a reply?",
    cloud: "{from} sent you something: “{t}”. I can help with a reply whenever you're ready.",
    coffee: "{from}: “{t}”. Reply?",
  },
  routine: {
    sun: "Let's get the basics done. {first} first?",
    cat: "Basics before anything clever. {first}.",
    robot: "Morning routine: {done} of {total}. Next step: {first}.",
    cloud: "Let's start small. How about {first}?",
    coffee: "{first}. Then the rest.",
  },
  plant: {
    sun: "Your {plant} is thirsty. One tap?",
    cat: "The {plant} would like water. It won't ask twice. Actually it will.",
    robot: "{plant}: not watered today.",
    cloud: "Your {plant} could use a little water.",
    coffee: "Water the {plant}?",
  },
  notifications: {
    sun: "{n} GitHub notifications, nothing urgent. Clear them now or later, your call.",
    cat: "{n} notifications. None of them are on fire.",
    robot: "{n} non-urgent GitHub notifications pending.",
    cloud: "There are {n} GitHub notifications, nothing pressing.",
    coffee: "{n} notifications. Not urgent.",
  },
  clear: {
    sun: "Nothing needs you right now. Want to pick one thing to move forward today?",
    cat: "Nothing's on fire. Suspicious. Want to pick one thing anyway?",
    robot: "No pending items. Select one task to advance?",
    cloud: "It's quiet. Would you like to choose one small thing to do?",
    coffee: "All clear. One thing?",
  },
  claudeLeft: {
    sun: "{name} has been quiet for {n} days. Last time you asked: “{p}”. Want to pick it back up?",
    cat: "{name}: {n} days of silence. You left off at “{p}”. I'd go back.",
    robot: "{name} idle for {n} days. Last prompt: “{p}”. Resume with a focus block?",
    cloud: "{name} has been waiting {n} days. You stopped at “{p}”. Whenever you're ready, we can start there.",
    coffee: "{name}, {n}d quiet. “{p}”. Resume?",
  },
  claudeQuiet: {
    sun: "{name} has been quiet for {n} days. Worth a look?",
    cat: "{name} hasn't heard from you in {n} days.",
    robot: "{name}: no activity for {n} days.",
    cloud: "{name} has been quiet for {n} days, if you'd like to visit it.",
    coffee: "{name}, {n}d quiet. Look?",
  },
  claudeSpend: {
    sun: "Most of this past week's Claude spend, about {part} of roughly {total}, went to {name}. That's an estimate, but good to know.",
    cat: "{name} ate about {part} of your roughly {total} Claude week. Estimated.",
    robot: "Estimated Claude spend, 7 days: {total}. {name}: {part}.",
    cloud: "Most of the week's Claude spend, about {part} of roughly {total}, was {name}. It's only an estimate.",
    coffee: "{name}: ~{part} of ~{total} this week.",
  },
  eveningPlant: {
    sun: "Before bed: your {plant} hasn't had water today. One tap and it's done.",
    cat: "The {plant} is still dry. You know what to do.",
    robot: "{plant} unwatered today. Water before end of day.",
    cloud: "One small thing before you rest: the {plant} would like some water.",
    coffee: "Water the {plant}, then bed.",
  },
  eveningPrep: {
    sun: "Tomorrow starts with {first}. Want help getting ready for it?",
    cat: "Tomorrow: {first}. Prep now and future you says thanks.",
    robot: "Tomorrow's first item: {first}. Prepare now?",
    cloud: "Tomorrow begins with {first}. We can think about it together, if you like.",
    coffee: "Tomorrow: {first}. Prep?",
  },
  eveningClear: {
    sun: "That's the day. Nothing else needs you tonight.",
    cat: "Done for today. Go do nothing.",
    robot: "No open items. Day complete.",
    cloud: "That's everything for today. Rest well.",
    coffee: "Done. Rest.",
  },
};
const say = (kind, char, v) => fill(VOICE[kind]?.[char] ?? VOICE[kind]?.sun ?? "", v);
const LATER = { label: "Not now", act: "later" };

// widgets: dashboard widgets; today: evening.js summary; later: ids dismissed today
export function suggest({ widgets = [], cfg = {}, today = null, evening = false, later = [], now = Date.now() }) {
  const char = cfg.character ?? "sun";
  const out = [];
  const add = (s) => { if (!later.includes(s.id)) out.push(s); };
  const w = (type) => widgets.find((x) => x.type === type);

  for (const b of widgets.filter((x) => x.status === "error")) {
    add({ id: `broken-${b.type}`, kind: "broken", say: say("broken", char, { what: b.title, why: q(b.error, 90) }), actions: [{ label: "Fix it", act: "options", arg: "keys" }, LATER] });
  }

  if (evening) {
    const plant = w("garden")?.garden?.plantView;
    if (plant && !plant.wateredToday && !plant.ready) add({ id: "plant-eve", kind: "plant", say: say("eveningPlant", char, { plant: plant.name.toLowerCase() }), actions: [{ label: "Water it", act: "water" }, LATER] });
    const first = today?.tomorrow?.[0];
    if (first && !/^alarm/.test(first)) add({ id: `prep-${first}`, kind: "prep", say: say("eveningPrep", char, { first }), actions: [{ label: "Help me prep", act: "ask", arg: `Help me get ready for tomorrow: ${first}. Keep it to three short steps.` }, LATER] });
    if (!out.length) out.push({ id: "clear-eve", kind: "clear", say: say("eveningClear", char, {}), actions: [] });
    return out;
  }

  for (const a of (w("attention")?.attention ?? []).filter((x) => x.level === "high")) {
    const t = q(a.text.replace(/^(Review|Assigned): /, ""));
    add({ id: `wait-${a.url || a.text}`, kind: "waiting", say: say("waiting", char, { t }), actions: [{ label: "Start 25 min", act: "focus", arg: t }, ...(a.url ? [{ label: "Open it", act: "open", arg: a.url }] : []), LATER] });
  }

  const next = w("calendar")?.next;
  if (next) {
    const m = Math.round((new Date(next.start) - now) / 60_000);
    if (m > 0 && m <= 15) add({ id: `event-${next.start}-now`, kind: "event", say: say("eventNow", char, { t: next.title, m, time: hm(next.start) }), actions: [{ label: "OK", act: "later" }] });
    else if (m > 15 && m <= 90) add({ id: `event-${next.start}`, kind: "event", say: say("eventSoon", char, { t: next.title, m, time: hm(next.start) }), actions: [{ label: "Just one thing", act: "pickFocus" }, LATER] });
  }

  const mailW = w("email");
  if (mailW?.status === "ok" && mailW.items?.length) {
    for (const it of mailW.items.slice(0, 2)) {
      if (!/^\d+[mh] ·/.test(it.sub ?? "")) continue;   // only mail from the last 24 h ("5m ·" / "16h ·")
      if (!fromAPerson(it.badge, it.email)) continue;
      const body = q(String(it.sub ?? "").replace(/^\d+[mhd] · /, ""), 200);
      add({ id: `mail-${it.url || it.text}`, kind: "mail", say: say("mail", char, { from: q(it.badge, 30), t: q(it.text, 60) }), actions: [...(it.url ? [{ label: "Open it", act: "open", arg: it.url }] : []), { label: "Draft a reply", act: "ask", arg: `Draft a short, friendly reply to an email from ${it.badge} with the subject "${it.text}". It starts: "${body}". Keep it under 80 words.` }, LATER] });
    }
  }

  const r = w("routine")?.routine;
  if (r?.total && !r.complete) {
    const step = r.rows.find((x) => !x.done);
    add({ id: "routine", kind: "routine", say: say("routine", char, { first: step.label, done: r.done, total: r.total }), actions: [{ label: step.target > 1 ? `+1 ${step.label.toLowerCase()}` : `Done: ${step.label.toLowerCase()}`, act: "routine", arg: step.id }, { label: "Show the list", act: "scroll", arg: "routine" }, LATER] });
  }

  const plant = w("garden")?.garden?.plantView;
  if (plant && !plant.wateredToday && !plant.ready) add({ id: "plant", kind: "plant", say: say("plant", char, { plant: plant.name.toLowerCase() }), actions: [{ label: "Water it", act: "water" }, LATER] });

  const med = (w("attention")?.attention ?? []).filter((x) => x.level !== "high");
  if (med.length >= 3) add({ id: "notifications", kind: "notifications", say: say("notifications", char, { n: med.length }), actions: [{ label: "Open GitHub", act: "open", arg: "https://github.com/notifications" }, LATER] });

  // Claude Code insight, only when those widgets are on. A project that had real work and has gone quiet is worth a nudge;
  // on Mondays, one project eating most of the week's spend is worth knowing. Estimates are called estimates.
  const cp = w("claudeprojects")?.status === "ok" ? w("claudeprojects").claude : null;
  const left = w("claudeleft")?.status === "ok" ? w("claudeleft").left : null;
  if (cp?.rows?.length) {
    const quiet = cp.rows.filter((r) => (r.activeMs >= 2 * 3_600_000 || r.tokens >= 1e6) && now - r.lastTs >= 3 * 86_400_000).sort((a, b) => b.tokens - a.tokens)[0];
    if (quiet) {
      const n = Math.floor((now - quiet.lastTs) / 86_400_000), name = q(quiet.name, 30), l = left?.find((x) => x.name === quiet.name && x.prompt);
      if (l) add({ id: `claude-left-${quiet.name}`, kind: "claudeLeft", say: say("claudeLeft", char, { name, n, p: q(l.prompt, 90) }), actions: [{ label: "Pick it back up", act: "focus", arg: q(`Pick ${quiet.name} back up: ${l.prompt}`, 120) }, { label: "Show the list", act: "scroll", arg: "claudeleft" }, LATER] });
      else add({ id: `claude-quiet-${quiet.name}`, kind: "claudeQuiet", say: say("claudeQuiet", char, { name, n }), actions: [left ? { label: "Where did I stop?", act: "scroll", arg: "claudeleft" } : { label: "Just one thing", act: "pickFocus" }, LATER] });
    }
    const top = [...cp.rows].sort((a, b) => b.usd - a.usd)[0];
    if (new Date(now).getDay() === 1 && cp.usd >= 100 && top && top.usd / cp.usd >= 0.6) add({ id: "claude-spend", kind: "claudeSpend", say: say("claudeSpend", char, { name: q(top.name, 30), part: money(top.usd), total: money(cp.usd) }), actions: [{ label: "See the list", act: "scroll", arg: "claudeprojects" }, LATER] });
  }

  if (!out.length) out.push({ id: "clear", kind: "clear", say: say("clear", char, {}), actions: [{ label: "Just one thing", act: "pickFocus" }] });
  return out;
}

// Per-day "not now" list.
export function store(dir) {
  const file = (u) => path.join(dir, `${u}.json`);
  return {
    later(u) { try { const s = JSON.parse(fs.readFileSync(file(u), "utf8")); return s.day === localDay() ? s.later : []; } catch { return []; } },
    addLater(u, id) { const l = this.later(u); if (!l.includes(id)) l.push(id); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(u), JSON.stringify({ day: localDay(), later: l })); return l; },
  };
}