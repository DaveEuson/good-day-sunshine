// Evening recap: what got done today and what is first tomorrow. Built on the server from data already on disk
// (garden day record, routine, alarm, calendar/weather widgets) so the hero, the brief and the tests share one version.

const dayStr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const hm = (t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// garden: raw garden state; routine: routine.today() summary or null; cfg: user config; widgets: dashboard widgets
export function todaySummary({ garden, routine, cfg, widgets = [], now = Date.now() }) {
  const day = garden?.days?.[dayStr(now)] ?? {};
  const plant = garden?.plant;
  const watered = !!plant && plant.lastWater === dayStr(now);
  const done = [];
  if (routine?.done) done.push(routine.complete ? "morning routine done" : `routine ${routine.done} of ${routine.total}`);   // 0 of 5 is not an achievement
  if (day.focus) done.push(plural(day.focus, "focus block"));
  if (plant) done.push(watered ? "plant watered" : null);
  const doneList = done.filter(Boolean);

  // Tomorrow: first calendar event after now (if it is tomorrow), alarm if it rings tomorrow, tomorrow's weather.
  const tomorrow = [];
  const tmr = new Date(now + 86_400_000);
  const next = widgets.find((w) => w.type === "calendar")?.next;
  if (next && dayStr(next.start) === dayStr(tmr)) tomorrow.push(`${next.title} at ${hm(next.start)}`);
  const a = cfg?.alarm;
  if (a?.time && (!a.days?.length || a.days.includes(tmr.getDay()))) tomorrow.push(`alarm at ${a.time}`);
  const wx = widgets.find((w) => w.type === "weather" && w.status === "ok")?.items?.[0];
  if (wx) tomorrow.push(`${wx.text.split(" · ")[1]?.toLowerCase() ?? "weather"}, ${wx.badge?.split(" · ")[0] ?? ""}`.replace(/, $/, ""));

  const headline = doneList.length ? `Today: ${doneList.join(", ")}.` : "A quiet day. That counts too.";
  const tail = tomorrow.length ? `Tomorrow: ${tomorrow[0]}.` : "";
  const todo = [];
  if (plant && !watered && !plant.ready) todo.push("Water the plant before bed");
  // Only if the routine was started: listing five untouched steps at night is a nag, not a recap.
  if (routine?.done && !routine.complete && routine.missing.length) todo.push(`Still open from this morning: ${routine.missing.join(", ")}`);
  return { headline, tail, done: doneList, tomorrow, todo, streak: garden?.streak ?? 0 };
}

export function isEvening(cfg, date = new Date()) {
  const from = cfg?.evening?.from ?? "17:00";
  if (!from || from === "off") return false;
  const [h, m] = from.split(":").map(Number);
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= h * 60 + m || date.getHours() < 4;   // until 4 am counts as the same evening
}
