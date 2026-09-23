// Any calendar via private ICS URL (Google: Settings → calendar → "Secret address in iCal format").
// No OAuth. Handles DAILY/WEEKLY recurrence; monthly/yearly only if the base date is in window.
export const meta = { title: "Calendar", icon: "▦" };

const DAY = 86_400_000;
const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseDate(v, params = "") {
  if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(v)) return { d: new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)), allDay: true };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/);
  if (!m) return null;
  const parts = [+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)];
  return { d: m[7] ? new Date(Date.UTC(...parts)) : new Date(...parts), allDay: false }; // TZID → local approx
}

export function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") { if (cur.start) events.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const [key, ...p] = line.slice(0, i).split(";");
      const val = line.slice(i + 1);
      if (key === "SUMMARY") cur.title = val.replace(/\\,/g, ",");
      else if (key === "LOCATION") cur.location = val.replace(/\\,/g, ",");
      else if (key === "DTSTART") Object.assign(cur, (({ d, allDay }) => ({ start: d, allDay }))(parseDate(val, p.join(";")) ?? {}));
      else if (key === "DTEND") cur.end = parseDate(val, p.join(";"))?.d;
      else if (key === "RRULE") cur.rrule = Object.fromEntries(val.split(";").map((kv) => kv.split("=")));
      else if (key === "EXDATE") (cur.exdates ??= []).push(...val.split(",").map((v) => parseDate(v, p.join(";"))?.d?.getTime()));
    }
  }
  return events;
}

export function expand(events, from, to) {
  const out = [];
  for (const e of events) {
    const dur = e.end ? e.end - e.start : (e.allDay ? DAY : 0);
    const push = (d) => { if (d >= from - dur && d <= to && !e.exdates?.includes(d.getTime())) out.push({ ...e, start: d, end: new Date(+d + dur) }); };
    const r = e.rrule;
    if (!r) { push(e.start); continue; }
    const until = r.UNTIL ? parseDate(r.UNTIL)?.d : null;
    const iv = +(r.INTERVAL ?? 1);
    if (r.FREQ === "DAILY") {
      for (let d = new Date(e.start); d <= to && (!until || d <= until); d = new Date(+d + iv * DAY)) push(d);
    } else if (r.FREQ === "WEEKLY") {
      const days = r.BYDAY ? r.BYDAY.split(",").map((x) => DOW[x.slice(-2)]) : [e.start.getDay()];
      for (let wk = new Date(e.start); wk <= to && (!until || wk <= until); wk = new Date(+wk + iv * 7 * DAY)) {
        for (const dow of days) {
          const d = new Date(wk); d.setDate(wk.getDate() + ((dow - wk.getDay() + 7) % 7));
          if (d >= e.start && (!until || d <= until)) push(d);
        }
      }
    } else push(e.start);
  }
  return out.sort((a, b) => a.start - b.start);
}

export async function fetchData(cfg, env) {
  const urls = (cfg.ics ?? env.CALENDAR_ICS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return { setup: "Set Calendar iCal URL in ⚙ Options → Keys." };

  const texts = await Promise.all(urls.map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`ics → ${r.status}`); return r.text(); }));
  const now = new Date();
  const to = new Date(+now + (cfg.days ?? 7) * DAY);
  const all = expand(texts.flatMap(parseICS), now, to);
  const upcoming = all.filter((e) => e.end > now).slice(0, cfg.max ?? 6);
  const todayStr = now.toDateString();
  const today = upcoming.filter((e) => e.start.toDateString() === todayStr);
  const next = upcoming.find((e) => !e.allDay && e.start > now);

  const fmt = (e) => e.allDay
    ? e.start.toLocaleDateString(undefined, { weekday: "short" }) + " · all day"
    : e.start.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

  return {
    next: next ? { title: next.title ?? "(untitled)", start: next.start.toISOString() } : null,
    stats: [
      { label: "Today", value: today.length },
      { label: "Next", value: next ? next.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—", sub: next?.title },
      { label: `Next ${cfg.days ?? 7}d`, value: all.filter((e) => e.end > now).length },
    ],
    items: upcoming.map((e) => ({ text: e.title ?? "(untitled)", badge: fmt(e), sub: e.location })),
  };
}
