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
  let idx = 0, ackShown = "";
  let later = new Set();

  window.companionHTML = function companionHTML(data, user) {
    const cfg = data.config, c = cfg.character || "sun";
    const evening = isEvening(cfg);
    const mood = getMood(user);
    if (!evening && !mood && new Date().getHours() < 12) {
      return `<div class="who">${esc(NAMES[c] ?? "Sun")}</div><p class="say">Morning, ${esc(cfg.name)}. ${esc(ASK[c] ?? ASK.sun)}</p>
        <div class="c-actions">${MOODS.map(([id, l]) => `<button type="button" class="c-btn ghost" data-cmood="${id}">${l}</button>`).join("")}</div>
        <button type="button" class="c-skip" data-cmood="skip">skip</button>`;
    }
    const max = mood === "rough" ? 1 : mood === "meh" ? 2 : Infinity;
    const list = (data.companion ?? []).filter((s) => !later.has(s.id)).slice(0, max);
    if (!list.length) return `<div class="who">${esc(NAMES[c] ?? "Sun")}</div><p class="say">That's everything I'd suggest right now. Want to pick one thing anyway?</p><div class="c-actions"><button type="button" class="c-btn ghost" data-cact="pickFocus" data-carg="">Pick one thing</button></div>`;
    idx = idx % list.length;
    const s = list[idx];
    const ack = ackShown === mood && mood && ACK[mood] ? `<span class="ack">${esc(ACK[mood][c] ?? ACK[mood].sun)}</span> ` : "";
    const btn = (a, i) => `<button type="button" class="c-btn ${i === 0 ? "" : "ghost"}" data-cact="${esc(a.act)}" data-carg="${esc(a.arg ?? "")}">${esc(a.label)}</button>`;
    return `<div class="who">${esc(NAMES[c] ?? "Sun")}</div>
      <p class="say">${ack}${esc(s.say)}</p>
      <div class="c-actions">${s.actions.map(btn).join("")}</div>
      ${list.length > 1 ? `<button type="button" class="c-more" data-cnext>What else? <span>${idx + 1} of ${list.length}</span></button>` : ""}`;
  };

  window.bindCompanion = function bindCompanion(el, data, user, rerender) {
    el.onclick = async (e) => {
      const m = e.target.closest("[data-cmood]");
      if (m) { const v = m.dataset.cmood === "skip" ? "okay" : m.dataset.cmood; setMood(user, v); ackShown = m.dataset.cmood === "skip" ? "" : v; idx = 0; rerender(); loadBrief?.(); return; }
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