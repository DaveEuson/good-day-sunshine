// Hero (answer headline, face, chips, mood, countdown ring) and "Just one thing" focus mode.
// Design: Claude Design handoff v7. Data: whatever the widgets returned; nothing here invents facts.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const moodKey = (u) => `gds:mood:${u}:${todayKey()}`;

  window.getMood = (u) => localStorage.getItem(moodKey(u)) || "";
  const setMood = (u, m) => { if (m) localStorage.setItem(moodKey(u), m); else localStorage.removeItem(moodKey(u)); };

  const greet = (name, mood) => {
    const h = new Date().getHours();
    if (mood === "rough") return `Go gently today, ${name}.`;
    if (mood === "great") return `Morning, ${name}. Let's go.`;
    return `${h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${name}.`;
  };

  // Answer headline: bold head + muted tail. Head = the one thing; tail = next fixed point.
  function answer(ws, next) {
    const att = ws.flatMap((w) => (w.attention ?? []).map((a) => ({ ...a, from: w.title })));
    const high = att.filter((a) => a.level === "high");
    const broken = ws.filter((w) => w.status === "error");
    let head;
    if (broken.length) head = `Heads up: ${broken.map((w) => w.title).join(", ")} can’t connect.`;
    else if (high.length === 1) head = `${high[0].text.replace(/^Review: /, "A review is waiting: ").replace(/^Assigned: /, "")}.`;
    else if (high.length > 1) head = `${high.length} things are waiting on you.`;
    else if (att.length) head = `${att.length} ${att.length === 1 ? "thing needs" : "things need"} a look, nothing urgent.`;
    else head = "Nothing's blocking you today.";
    let tail = "";
    if (next) tail = `${esc(next.title)} at ${new Date(next.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
    else { const wx = ws.find((w) => w.type === "weather" && w.stats); if (wx) tail = `${esc(wx.stats[0].value)} ${esc(wx.stats[0].label.toLowerCase())}, high ${esc(wx.stats[1].value.split(" / ")[0])}.`; }
    return { head, tail, high, att, broken };
  }

  function chips(ws, a) {
    const out = [];
    if (a.high.length) out.push(`<span class="chip alert">${a.high.length} urgent</span>`);
    const mail = ws.find((w) => w.type === "email" && w.stats);
    if (mail) out.push(`<span class="chip">${mail.stats[0].value} unread</span>`);
    const cal = ws.find((w) => w.type === "calendar" && w.stats);
    if (cal) out.push(`<span class="chip">${cal.stats[0].value} today</span>`);
    const g = ws.find((w) => w.type === "garden")?.garden;
    if (g?.plantView && !g.plantView.wateredToday && !g.plantView.ready) out.push(`<span class="chip">Water the ${esc(g.plantView.name.toLowerCase())}</span>`);
    return out.join("");
  }

  const MOODS = [["great", "Great"], ["okay", "Okay"], ["meh", "Meh"], ["rough", "Rough"]];
  const ACK = { great: "Good. Let's use it.", okay: "Okay is plenty.", meh: "Noted. Small steps today.", rough: "Noted. I'll keep it short." };

  let ringNext = null;
  function ringHTML(next) {
    if (!next) return "";
    return `<div class="countdown card" id="ring"><svg viewBox="0 0 120 120" width="112" height="112"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="10"/><circle id="ring-arc" cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="326.7" stroke-dashoffset="0"/></svg><div class="ring-num"><b id="ring-min"></b><span>min</span></div><div class="ring-copy"><div class="eyebrow">until</div><div class="ring-title">${esc(next.title)} <span class="muted">${new Date(next.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div><div class="ring-hint" id="ring-hint"></div></div></div>`;
  }
  function tickRing() {
    if (!ringNext || !$("#ring")) return;
    const mins = Math.max(0, Math.round((new Date(ringNext.start) - Date.now()) / 60000));
    const frac = Math.min(1, Math.max(0, mins / 60));
    $("#ring-arc").setAttribute("stroke-dashoffset", String(326.7 * (1 - frac)));
    $("#ring-min").textContent = mins > 99 ? `${Math.floor(mins / 60)}h` : mins;
    $("#ring-hint").textContent = mins > 30 ? "Time for one focus block first." : mins > 15 ? "Enough for something small." : mins > 5 ? "Start wrapping up." : "Go now.";
    $("#ring").classList.toggle("soon", mins <= 15); $("#ring").classList.toggle("now", mins <= 5);
    $("#ring-arc").style.stroke = mins <= 5 ? "var(--alert)" : "var(--accent)";
  }
  setInterval(tickRing, 15_000);

  window.renderHero = function renderHero(data, user, onMood) {
    const ws = data.widgets;
    const cfg = data.config;
    const mood = getMood(user);
    const next = ws.find((w) => w.type === "calendar")?.next ?? null;
    ringNext = next && new Date(next.start) > Date.now() ? next : null;
    const a = answer(ws, ringNext);
    const t = THEMES[document.documentElement.dataset.theme] ?? {};
    if (wakeState(user).startsWith("snooze:")) {
      const face0 = faceURI(cfg.character || "sun", false, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || t.accent, t.card || "#fff");
      const wx = ws.find((w) => w.type === "weather" && w.stats);
      const g = ws.find((w) => w.type === "garden")?.garden;
      const items = [
        a.broken.length ? `${a.broken.map((w) => w.title).join(", ")} couldn’t be checked.` : a.high.length ? `${a.high[0].text}` : a.att.length ? `${a.att.length} things waiting, nothing urgent.` : "Nothing needs you.",
        ringNext ? `${ringNext.title} at ${new Date(ringNext.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.` : wx ? `${wx.stats[0].value}, ${wx.stats[0].label.toLowerCase()}, high ${wx.stats[1].value.split(" / ")[0]}.` : "Nothing on the calendar.",
        g?.plantView && !g.plantView.wateredToday ? `Water the ${g.plantView.name.toLowerCase()}.` : "Coffee.",
      ];
      $("#hero-block").innerHTML = `<img class="face" src="${face0}" alt="" width="92" height="92"><div class="hero-main"><div class="greeting">${esc(greet(cfg.name, mood))}</div><h1 class="answer"><b>Short version, since you snoozed.</b></h1><ol class="short">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol><div class="row"><button class="ghost" id="full-brief">Full brief</button></div></div>`;
      $("#full-brief").onclick = () => { wakeDone(user); onMood?.(); };
      return a;
    }
    const face = faceURI(cfg.character || "sun", a.high.length > 0 || a.broken.length > 0, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || t.accent, t.card || "#fff", t.alert || "#c0341d", skinFor());
    $("#hero-block").innerHTML = `
      <img class="face" src="${face}" alt="" width="92" height="92">
      <div class="hero-main">
        <div class="greeting">${esc(greet(cfg.name, mood))}</div>
        <h1 class="answer"><b>${esc(a.head)}</b> <span>${a.tail}</span></h1>
        <div class="chips">${chips(ws, a)}</div>
        <div class="mood">${mood ? `<span class="muted">${ACK[mood]}</span>` : `<span class="muted">How are you this morning?</span>`}${MOODS.map(([id, l]) => `<button class="pill ${mood === id ? "on" : ""}" data-mood="${id}">${l}</button>`).join("")}</div>
      </div>
      ${ringHTML(ringNext)}`;
    tickRing();
    $("#hero-block").onclick = (e) => {
      const b = e.target.closest("[data-mood]");
      if (!b) return;
      setMood(user, mood === b.dataset.mood ? "" : b.dataset.mood);
      onMood?.();
    };
    return a;
  };

  // Outfits unlock with mornings (garden streak): 10 → spring flower, 28 → winter hat; autumn scarf in season.
  function skinFor() {
    const streak = window.gardenState?.streak ?? 0;
    const m = new Date().getMonth();
    if (streak >= 28) return "winter";
    if (streak >= 10) return "spring";
    return m >= 8 && m <= 10 ? "autumn" : "";
  }

  // ---------- Just one thing ----------
  let focusTimer = null, focusLeft = 0, focusPaused = false;
  const LINES = ["I'm here. Doing my own emails next to you.", "One step. Then the next.", "Still here.", "Nothing else is getting in.", "Halfway is a real place."];
  window.startFocus = async function startFocus(task, user, opts = {}) {
    const $f = $("#focus");
    focusLeft = 25 * 60; focusPaused = false;
    const cfg = window.data?.config ?? {};
    const face = faceURI(cfg.character || "sun", false, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), THEMES[document.documentElement.dataset.theme]?.card || "#fff");
    $f.innerHTML = `
      <div class="focus-top"><span class="eyebrow">just one thing · everything else can wait</span><button class="ghost" id="focus-exit">Exit</button></div>
      <div class="focus-body">
        <div class="focus-ring"><svg viewBox="0 0 120 120" width="210" height="210"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8"/><circle id="focus-arc" cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="326.7" stroke-dashoffset="0"/></svg><div class="focus-time" id="focus-time">25:00</div>
          <div class="row"><button class="ghost" id="focus-pause">Pause</button><button id="focus-done">Done it</button></div></div>
        <div class="focus-task">
          <div class="bubble"><img src="${face}" width="36" height="36" alt=""><span id="focus-line">${LINES[0]}</span></div>
          <h2>${esc(task)}</h2>
          <div class="eyebrow ai" id="focus-ai">splitting into small steps…</div>
          <ol class="steps" id="focus-steps"><li class="skel"></li><li class="skel"></li><li class="skel"></li><li class="skel"></li></ol>
        </div>
      </div>`;
    $f.hidden = false;
    let li = 0;
    const lineTimer = setInterval(() => { li = (li + 1) % LINES.length; const el = $("#focus-line"); if (el) el.textContent = LINES[li]; }, 45_000);
    const stop = () => { clearInterval(focusTimer); clearInterval(lineTimer); $f.hidden = true; };
    const tick = () => {
      if (focusPaused) return;
      focusLeft = Math.max(0, focusLeft - 1);
      $("#focus-time").textContent = `${String(Math.floor(focusLeft / 60)).padStart(2, "0")}:${String(focusLeft % 60).padStart(2, "0")}`;
      $("#focus-arc").setAttribute("stroke-dashoffset", String(326.7 * (1 - focusLeft / 1500)));
      if (focusLeft === 0) { clearInterval(focusTimer); toast("Time's up. Done, or a bit more?", 4600); SFX.unlock?.(); }
    };
    focusTimer = setInterval(tick, 1000);
    $("#focus-exit").onclick = stop;
    $("#focus-pause").onclick = (e) => { focusPaused = !focusPaused; e.target.textContent = focusPaused ? "Resume" : "Pause"; };
    $("#focus-done").onclick = async () => {
      stop();
      const r = await fetch(`/api/garden/focus?u=${encodeURIComponent(user)}`, { method: "POST", body: "{}" }).then((r) => r.json()).catch(() => null);
      toast(r?.garden ? `Done. +5 tokens · ${r.garden.tokens} total` : "Done.");
      SFX.harvest?.();
      opts.onDone?.(r?.garden);
    };
    $("#focus-steps").onclick = (e) => { const l = e.target.closest("li"); if (l) { l.classList.toggle("done"); SFX.tap?.(); } };

    // AI split: 4 steps, one line each, from the configured chat model. Silent fallback after a slow start.
    const timeout = setTimeout(() => fill(["Open it and read what's there", "Decide the smallest next move", "Do that one move", "Leave a note or tick it off"], "you"), 6000);
    try {
      const r = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ name: cfg.name, widgets: window.data?.widgets, messages: [{ role: "user", content: `Split this task into exactly 4 small concrete steps, each under 10 words, one per line, no numbering, no extra text:\n${task}` }] }) });
      const txt = await r.text();
      const steps = txt.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).message?.content ?? ""; } catch { return ""; } }).join("").split("\n").map((s) => s.replace(/^[\s\d.)-]+/, "").trim()).filter(Boolean).slice(0, 4);
      if (steps.length >= 2) { clearTimeout(timeout); fill(steps, window.data?.chatModel); }
    } catch {}
    function fill(steps, by) {
      const ol = $("#focus-steps"); if (!ol) return;
      ol.innerHTML = steps.map((s, i) => `<li class="${i === 0 ? "cur" : ""}"><i></i>${esc(s)}</li>`).join("");
      $("#focus-ai").innerHTML = by === "you" ? "steps: a plain default" : `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z" fill="var(--accent)"/></svg> split into small steps by ${esc(CHARACTERS[cfg.character] ?? "Sun")} · ${esc(by)}`;
    }
  };

  let toastTimer = null;
  window.toast = function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  };
})();
