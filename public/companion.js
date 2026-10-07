// The companion's speech bubble: one suggestion at a time, in the character's voice, with buttons that do the thing.
// In the morning it asks how you are first; a rough morning gets one gentle suggestion, a meh one gets two.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const okUrl = (u) => /^https?:\/\//i.test(String(u ?? ""));
  const NAMES = { sun: "Sun", cat: "Cat", robot: "Robot", cloud: "Cloud", coffee: "Coffee" };
  const ASK = { sun: "How are you feeling this morning?", cat: "How are we doing today? Honestly.", robot: "Status check: how are you?", cloud: "How are you feeling, really?", coffee: "How are you?" };
  const ACK = {
    great: { sun: "Love that. Let's use it.", cat: "Good. Don't waste it.", robot: "Noted: high capacity.", cloud: "That's lovely to hear.", coffee: "Great. Go." },
    okay: { sun: "Okay is plenty.", cat: "Okay is fine. Okay gets things done.", robot: "Noted: normal capacity.", cloud: "Okay is a good place to start.", coffee: "Okay. Let's go." },
    meh: { sun: "Meh is allowed. Just two small things.", cat: "Meh. We'll keep it light.", robot: "Noted: reduced capacity. Two items max.", cloud: "That's alright. We'll go gently.", coffee: "Meh. Two things." },
    rough: { sun: "I'm sorry. Just one thing today, and only if you're up for it.", cat: "Rough. One thing. Maybe.", robot: "Noted: low capacity. One item.", cloud: "I'm here. Just one small thing, when you're ready.", coffee: "Rough. One thing." },
  };
  const MOODS = [["great", "Great"], ["okay", "Okay"], ["meh", "Meh"], ["rough", "Rough"]];
  const PICK = { sun: "What's the one thing?", cat: "One thing. Pick.", robot: "Select one task.", cloud: "What would feel good to do first?", coffee: "One thing?" };
  let idx = 0, ackShown = "";
  let picking = false, pickChoices = [];
  let later = new Set();

  window.companionHTML = function companionHTML(data, user) {
    const cfg = data.config, c = cfg.character || "sun";
    const evening = isEvening(cfg);
    const mood = getMood(user);
    if (!evening && !mood && new Date().getHours() < 12 && !document.body.classList.contains("tv")) {
      return `<div class="who">${esc(NAMES[c] ?? "Sun")}</div><p class="say">Morning, ${esc(cfg.name)}. ${esc(ASK[c] ?? ASK.sun)}</p>
        <div class="c-actions" role="group" aria-label="How are you feeling">${MOODS.map(([id, l]) => `<button type="button" class="c-btn ghost" data-cmood="${id}">${l}</button>`).join("")}</div>
        <button type="button" class="c-skip" data-cmood="skip">skip</button>`;
    }
    // The day's line under the suggestion. When the suggestion already says "nothing needs you", only the weather/next event follows.
    const ctxP = (tailOnly) => {
      const t = mood === "rough" ? "" : evening ? (data.today ? `${esc(data.today.headline)} ${esc(data.today.tail)}`.trim() : "") : (window.dayLine?.(data, tailOnly) ?? "");
      return t ? `<p class="ctx">${t}</p>` : "";
    };
    const max = mood === "rough" ? 1 : mood === "meh" ? 2 : Infinity;
    const list = (data.companion ?? []).filter((s) => !later.has(s.id)).slice(0, max);
    if (!list.length) return `<div class="who">${esc(NAMES[c] ?? "Sun")}</div><p class="say">That's everything I'd suggest right now. Want to pick one thing anyway?</p><div class="c-actions"><button type="button" class="c-btn ghost" data-cact="pickFocus" data-carg="">Just one thing</button></div>${ctxP(true)}`;
    idx = idx % list.length;
    const s = list[idx];
    const ack = ackShown === mood && mood && ACK[mood] ? `<span class="ack">${esc(ACK[mood][c] ?? ACK[mood].sun)}</span> ` : "";
    const btn = (a, i) => `<button type="button" class="c-btn ${i === 0 ? "" : "ghost"}" data-cact="${esc(a.act)}" data-carg="${esc(a.arg ?? "")}">${esc(a.label)}</button>`;
    return `<div class="who">${esc(NAMES[c] ?? "Sun")}</div>
      <p class="say">${ack}${esc(s.say)}</p>
      <div class="c-actions">${s.actions.map(btn).join("")}</div>
      ${ctxP(s.kind === "clear")}
      ${list.length > 1 ? `<button type="button" class="c-more" data-cnext>What else? <span>${idx + 1} of ${list.length}</span></button>` : ""}`;
  };

  // "Just one thing": the choices come from what the page already knows, at most four; typing is always possible.
  function oneThingChoices(data, now = Date.now()) {
    const ok = (t) => data.widgets.find((x) => x.type === t && x.status !== "error");
    const clip = (s, n = 64) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
    const out = [];
    for (const a of (ok("attention")?.attention ?? []).filter((x) => x.level === "high").slice(0, 2)) { const t = clip(a.text.replace(/^(Review|Assigned): /, "")); out.push({ label: t, task: t }); }
    const r = ok("routine")?.routine, step = r && !r.complete ? r.rows.find((x) => !x.done) : null;
    if (step) out.push({ label: step.label, task: step.label });
    const next = ok("calendar")?.next, m = next ? Math.round((new Date(next.start) - now) / 60_000) : 0;
    if (next && m > 0 && m <= 180) { const t = `Get ready for ${next.title} at ${new Date(next.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`; out.push({ label: clip(t), task: t }); }
    const claude = (data.companion ?? []).find((s) => s.kind === "claudeLeft" || s.kind === "claudeQuiet");
    const fa = claude?.actions.find((a) => a.act === "focus");
    if (fa) out.push({ label: clip(fa.arg), task: fa.arg });
    return out.slice(0, 4);
  }
  window.pickerOpen = () => picking;
  window.openOneThing = function openOneThing(data, user) {
    const el = $("#speech");
    if (!el) return false;
    const c = data.config.character || "sun";
    pickChoices = oneThingChoices(data);
    picking = true;
    el.innerHTML = `<div class="who">${esc(NAMES[c] ?? "Sun")}</div><p class="say">${esc(PICK[c] ?? PICK.sun)}</p>
      ${pickChoices.length ? `<div class="c-actions pick">${pickChoices.map((ch, i) => `<button type="button" class="c-btn ghost" data-pick="${i}">${esc(ch.label)}</button>`).join("")}</div>` : ""}
      <form class="pick-form"><input type="text" maxlength="140" autocomplete="off" aria-label="Something else" placeholder="${pickChoices.length ? "Or type something else" : "Type it, then press Enter"}"><button class="c-btn">Start 25 min</button></form>
      <button type="button" class="c-skip" data-pickback>Back</button>`;
    el.querySelector(pickChoices.length ? "[data-pick]" : ".pick-form input")?.focus();
    return true;
  };

  window.bindCompanion = function bindCompanion(el, data, user, rerender) {
    const startPicked = (task) => { picking = false; startFocus(task, user, { onDone: () => load() }); };
    el.onsubmit = (e) => { e.preventDefault(); const v = el.querySelector(".pick-form input")?.value.trim(); if (v) startPicked(v); };
    el.onkeydown = (e) => { if (e.key === "Escape" && picking) { picking = false; rerender(); } };
    el.onclick = async (e) => {
      if (e.target.closest("[data-pickback]")) { picking = false; rerender(); return; }
      const pk = e.target.closest("[data-pick]");
      if (pk) return startPicked(pickChoices[+pk.dataset.pick].task);
      const m = e.target.closest("[data-cmood]");
      if (m) { const v = m.dataset.cmood; setMood(user, v); ackShown = v === "skip" ? "" : v;   // skipping is recorded as skipping, not as "okay"
       idx = 0; rerender(); loadBrief?.(); return; }
      if (e.target.closest("[data-cnext]")) { idx++; ackShown = ""; rerender(); SFX.tap?.(); return; }
      const b = e.target.closest("[data-cact]");
      if (!b) return;
      const act = b.dataset.cact, arg = b.dataset.carg;
      const cur = (data.companion ?? []).filter((s) => !later.has(s.id))[idx];
      ackShown = "";
      if (act === "later") {
        if (cur) { later.add(cur.id); fetch(`/api/companion/later?u=${encodeURIComponent(user)}`, { method: "POST", body: JSON.stringify({ id: cur.id }) }).catch(() => {}); }
        rerender(); return;
      }
      if (act === "focus") return startFocus(arg, user, { onDone: () => load() });
      if (act === "pickFocus") return pickFocusTask();
      if (act === "open") { if (okUrl(arg)) window.open(arg, "_blank", "noopener"); return; }
      if (act === "options") return openSettings(arg || "you");
      if (act === "ask") return ask(arg);
      if (act === "scroll") { window.phoneTab?.("today"); document.querySelector(`#grid .widget[data-type="${CSS.escape(arg)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      if (act === "water" || act === "routine") {
        b.disabled = true;
        const url = act === "water" ? `/api/garden/water?u=${encodeURIComponent(user)}` : `/api/routine/tap?u=${encodeURIComponent(user)}`;
        const j = await fetch(url, { method: "POST", body: JSON.stringify(act === "routine" ? { id: arg } : {}) }).then((r) => r.json()).catch(() => ({ error: "Couldn’t do that." }));
        if (j.error) { toast(j.error); b.disabled = false; return; }
        toast(act === "water" ? "Watered. +3 tokens" : j.firstComplete ? "Morning routine done. +5 tokens" : "Ticked.");
        (act === "water" ? SFX.water : SFX.tap)?.();
        return load();
      }
    };
  };
  window.resetCompanion = () => { idx = 0; };
})();