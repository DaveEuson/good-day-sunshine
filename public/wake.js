// Wake-up ramp (Claude Design handoff): from `ramp` minutes before the alarm the black veil fades 0.93 → 0,
// the face fades in, a huge clock shows, the greeting appears at 45%. At the alarm: soft chime.
// Snooze 9 min → back to black, then full brightness; the page then shows the short brief. "I'm up" → done for today.
// ?wake=test runs the whole ramp in 12 seconds.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const key = (u) => `gds:wake:${u}:${today()}`;
  const TEST = new URLSearchParams(location.search).get("wake") === "test";
  let testAlarm = null, chimeAt = 0, lastState = "";

  window.wakeState = (u) => localStorage.getItem(key(u)) || "";
  const setState = (u, v) => localStorage.setItem(key(u), v);

  function alarmFor(cfg) {
    if (TEST) return (testAlarm ??= { at: Date.now() + 12_000, ramp: 12_000 });
    const a = cfg.alarm;
    if (!a?.time) return null;
    const d = new Date();
    if (a.days?.length && !a.days.includes(d.getDay())) return null;
    const [h, m] = a.time.split(":").map(Number);
    const t = new Date(d); t.setHours(h, m, 0, 0);
    return { at: t.getTime(), ramp: (a.ramp ?? 10) * 60_000 };
  }

  // Called every few seconds from app.js. Returns true while the overlay owns the screen.
  window.tickWake = function tickWake(cfg, user) {
    const $w = $("#wake");
    const al = alarmFor(cfg);
    const st = TEST ? lastState : wakeState(user);
    if (!al || st === "up") { $w.hidden = true; return false; }
    const now = Date.now();
    let progress;
    if (st.startsWith("snooze:")) {
      const until = +st.slice(7);
      if (now < until) { $w.hidden = true; return false; }
      progress = 1;
    } else {
      if (now < al.at - al.ramp) { $w.hidden = true; return false; }
      if (now > al.at + 60 * 60_000) { setState(user, "up"); $w.hidden = true; return false; } // nobody came; stop after an hour
      progress = Math.min(1, (now - (al.at - al.ramp)) / al.ramp);
    }
    render(progress, cfg, user);
    if (progress >= 1 && now - chimeAt > 20_000 && !$w.hidden) { chimeAt = now; SFX.unlock?.(); }
    return true;
  };

  function render(p, cfg, user) {
    const $w = $("#wake");
    const t = THEMES[document.documentElement.dataset.theme] ?? {};
    const face = faceURI(cfg.character || "sun", false, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || t.accent, t.card || "#fff");
    if ($w.hidden || !$w.dataset.ready) {
      $w.innerHTML = `
        <img class="wake-face" src="${face}" alt="" width="120" height="120">
        <div class="wake-clock" id="wake-clock"></div>
        <div class="wake-greet" id="wake-greet"></div>
        <div class="wake-actions"><button class="ghost" id="wake-snooze">Snooze 9 min</button><button id="wake-up">I’m up</button></div>`;
      $w.dataset.ready = "1";
      $w.hidden = false;
      $("#wake-snooze").onclick = () => { setState(user, `snooze:${Date.now() + (TEST ? 5_000 : 9 * 60_000)}`); lastState = `snooze:${Date.now() + 5_000}`; $w.hidden = true; toast("Snoozed. Back in nine minutes with the short version."); SFX.tap?.(); window.onWake?.(); };
      $("#wake-up").onclick = () => { setState(user, "up"); lastState = "up"; $w.hidden = true; SFX.plant?.(); window.onWake?.(); };
    }
    $w.style.setProperty("--veil", String(0.93 * (1 - p)));
    $w.style.setProperty("--lit", String(p));
    const h = new Date().getHours();
    $("#wake-clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    $("#wake-greet").textContent = p >= 0.45 ? `${h < 12 ? "Good morning" : "Hello"}, ${cfg.name}.` : "";
    $w.classList.toggle("ringing", p >= 1);
  }
})();
