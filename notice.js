// "I noticed": one observation from data already on disk, at most once a week, always with a Yes/No offer.
// Never a fact the page doesn't have. Sources: garden per-day records, notification counts by weekday.
import fs from "node:fs";
import path from "node:path";

const DAY = 86_400_000;
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MILESTONES = [7, 14, 30, 60, 100];

// Candidate notices, best first. `garden` is the raw garden state, `series` = [{t, v}] of GitHub notification counts.
export function computeNotices({ garden, series = [], now = Date.now() }) {
  const out = [];
  const days = garden?.days ?? {};
  const dates = Object.keys(days).sort();

  // 1. Streak milestone (time-sensitive, shown the day it happens)
  if (MILESTONES.includes(garden?.streak)) {
    out.push({ id: `streak-${garden.streak}`, kind: "milestone", text: `${garden.streak} mornings in a row. That is a habit now, not a streak.`, why: `Your garden check-ins: ${garden.streak} consecutive days.`, ack: "Nice" });
  }

  // 2. A weekday you keep not watering (checked in, didn't water), ≥3 occurrences, others mostly fine
  const byDow = Array.from({ length: 7 }, () => ({ seen: 0, missed: 0 }));
  for (const d of dates) {
    if (now - new Date(d + "T12:00") > 35 * DAY) continue;
    const r = days[d]; if (!r.checkin || !garden.plant) continue;
    const w = new Date(d + "T12:00").getDay(); byDow[w].seen++; if (!r.water) byDow[w].missed++;
  }
  const worst = byDow.map((x, i) => ({ ...x, i })).filter((x) => x.seen >= 3 && x.missed >= 3 && x.missed / x.seen >= 0.75).sort((a, b) => b.missed - a.missed)[0];
  if (worst) {
    const othersOk = byDow.filter((x, i) => i !== worst.i && x.seen).every((x) => x.missed / x.seen <= 0.34);
    if (othersOk) out.push({ id: `water-${worst.i}`, kind: "pattern", text: `You have skipped watering ${worst.missed} ${DOW[worst.i]}s running. Every other day you have got to it.`, why: `Garden records for the last five weeks: ${DOW[worst.i]}s ${worst.missed} of ${worst.seen} unwatered, other days almost always watered.`, nudge: { day: worst.i, time: "07:40", text: "Water the plant" }, ask: `Want a nudge at 7:40 on ${DOW[worst.i]}s?` });
  }

  // 3. Notifications pile up on one weekday (≥2 samples on ≥3 weekdays, spike ≥2× the others and ≥5)
  const perDow = Array.from({ length: 7 }, () => []);
  for (const { t, v } of series) if (now - t <= 28 * DAY && typeof v === "number") perDow[new Date(t).getDay()].push(v);
  const avgs = perDow.map((a, i) => ({ i, n: a.length, avg: a.length ? a.reduce((s, v) => s + v, 0) / a.length : null })).filter((x) => x.n >= 2);
  if (avgs.length >= 3) {
    const top = [...avgs].sort((a, b) => b.avg - a.avg)[0];
    const rest = avgs.filter((x) => x.i !== top.i).map((x) => x.avg).sort((a, b) => a - b);
    const median = rest[Math.floor(rest.length / 2)];
    if (top.avg >= 5 && top.avg >= 2 * Math.max(median, 1)) {
      out.push({ id: `notif-${top.i}`, kind: "pattern", text: `GitHub notifications pile up on ${DOW[top.i]}s: about ${Math.round(top.avg)}, against ${Math.round(median)} on other days.`, why: `Notification counts recorded on this page over the last four weeks, averaged by weekday.`, nudge: { day: top.i, time: "08:30", text: "Clear GitHub notifications first" }, ask: `Want a nudge at 8:30 on ${DOW[top.i]}s to clear them before they stack?` });
    }
  }

  // 4. Focus blocks this week (≥3)
  const blocks = dates.filter((d) => now - new Date(d + "T12:00") <= 7 * DAY).reduce((n, d) => n + (days[d].focus ?? 0), 0);
  if (blocks >= 3) out.push({ id: `focus-w${Math.floor(now / (7 * DAY))}`, kind: "win", text: `${blocks} focus blocks this week. Each one was a thing that actually got done.`, why: `"Just one thing" blocks finished in the last seven days.`, ack: "Nice" });

  return out;
}

// Pick what to show today: a stored current pick stays for the day; otherwise the first eligible candidate.
// Patterns respect the weekly limit and 30-day dismissals; milestones/wins bypass the weekly limit but show once.
export function pick(cands, st, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  if (st.current?.date === today) return cands.find((c) => c.id === st.current.id) ?? null;
  const weekly = st.lastShownAt && now - st.lastShownAt < 7 * DAY;
  const c = cands.find((c) => {
    if (st.shown[c.id]) return false;
    if (st.dismissed[c.id] && now - st.dismissed[c.id] < 30 * DAY) return false;
    return c.kind !== "pattern" || !weekly;
  });
  if (c) { st.current = { id: c.id, date: today }; st.shown[c.id] = now; st.lastShownAt = now; }
  return c ?? null;
}

export function fresh() { return { shown: {}, dismissed: {}, nudges: [], current: null, lastShownAt: 0 }; }

export function store(dir) {
  const file = (u) => path.join(dir, `${u}.json`);
  return {
    load(u) { try { return { ...fresh(), ...JSON.parse(fs.readFileSync(file(u), "utf8")) }; } catch { return fresh(); } },
    save(u, s) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(u), JSON.stringify(s, null, 1)); return s; },
  };
}

// Responses to the card. `cands` needed to look up the nudge for a yes.
export function respond(st, action, id, cands, now = Date.now()) {
  const c = cands.find((x) => x.id === id);
  if (action === "yes" && c?.nudge && !st.nudges.some((n) => n.id === id)) st.nudges.push({ id, ...c.nudge });
  if (action === "no") st.dismissed[id] = now;
  if (action === "forget") st.nudges = st.nudges.filter((n) => n.id !== id);
  if (st.current?.id === id && action !== "forget") st.current = null;
  return st;
}
