const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const MODE = params.get("mode") || "";           // "" | "tv" | "small"
let user = params.get("u") || localStorage.getItem("ld:user") || "dave";
let data = null;
let gardenState = null; window.gardenState = null;
let catalog = [];
document.body.classList.toggle("tv", MODE === "tv");
document.body.classList.toggle("small", MODE === "small");

// ---------- theme ----------
function applyTheme(key, accent) {
  const t = THEMES[key] ?? THEMES.sunrise;
  const r = document.documentElement.style;
  for (const k of ["bg", "card", "text", "muted", "accent", "border", "font"]) r.setProperty(`--${k}`, t[k]);
  r.setProperty("--page", t.page ?? t.bg);
  r.setProperty("--on-accent", t.onAccent ?? t.bg);
  r.setProperty("--alert", t.alert ?? "#c0341d");
  document.documentElement.dataset.theme = THEMES[key] ? key : "sunrise";
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("themed")));
  if (accent) r.setProperty("--accent", accent);
  $("#theme").value = key;
  $("#accent").value = accent || (t.accent.startsWith("#") ? t.accent : "#7aa2ff");
}
function themePrefs() {
  try { return JSON.parse(localStorage.getItem(`ld:theme:${user}`)) || {}; } catch { return {}; }
}
function saveTheme(p) { localStorage.setItem(`ld:theme:${user}`, JSON.stringify(p)); }
function themeOptions(sel, allowLocked) {
  const owned = gardenState?.unlocked?.themes ?? [];
  const costs = Object.fromEntries((gardenState?.themes ?? []).map((t) => [t.id, t.cost]));
  const was = sel.value;   // re-rendered when tokens change; keep the selection
  sel.innerHTML = Object.entries(THEMES).map(([k, t]) => {
    const locked = t.locked && !owned.includes(k);
    return `<option value="${k}" ${locked && !allowLocked ? "disabled" : ""}>${t.name}${locked ? ` (locked, ${costs[k] ?? ""} tokens)` : ""}</option>`;
  }).join("");
  if (was) sel.value = was;
}
const renderThemePicker = () => themeOptions($("#theme"), false);
$("#theme").onchange = (e) => { const p = { ...themePrefs(), theme: e.target.value, accent: null }; saveTheme(p); applyTheme(p.theme, null); };
$("#accent").oninput = (e) => { const p = { ...themePrefs(), accent: e.target.value }; saveTheme(p); document.documentElement.style.setProperty("--accent", e.target.value); };

// ---------- render ----------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (v) => (typeof v === "number" ? v.toLocaleString() : esc(v));

function spark(series) {
  if (!series || series.filter((v) => v != null).length < 3) return "";
  const w = 64, h = 18, min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - ((v - min) / span) * (h - 2) - 1}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
}
function delta(d, w = 7) {
  if (d == null || d === 0) return "";
  return `<span class="delta ${d > 0 ? "up" : "down"}" title="vs ${w} days ago">${d > 0 ? "▲" : "▼"} ${Math.abs(d).toLocaleString()}</span>`;
}
const stat = (s) => `<div class="stat"><div class="v">${fmt(s.value)}${delta(s.delta, s.window)}</div><div class="l">${esc(s.label)}</div>${s.sub ? `<div class="s">${esc(s.sub)}</div>` : ""}${spark(s.series)}</div>`;
const okUrl = (u) => /^https?:\/\//i.test(String(u ?? ""));   // an RSS <link>javascript:…</link> must not become clickable
const link = (i, cls) => okUrl(i.url) ? `<a class="${cls}" href="${esc(i.url)}" target="_blank" rel="noopener">` : `<span class="${cls}">`;
const endLink = (i) => (okUrl(i.url) ? "</a>" : "</span>");

// "07:42" today, "yesterday 22:10", else "Sep 24 07:42"
function asOf(t) {
  if (!t) return "earlier";
  const d = new Date(t), now = new Date(), hm = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return hm;
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) return `yesterday ${hm}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${hm}`;
}
function widget(w) {
  if (w.type === "garden") return gardenCard(w);
  if (w.type === "noticed") return noticedCard(w);
  if (w.type === "routine") return routineCard(w);
  const urgent = w.attention?.some((a) => a.level === "high");
  const cls = ["card", "widget", w.setup ? "dim" : "", w.error ? "broken" : "", urgent ? "alert" : ""].join(" ");
  let body = "";
  if (w.setup) body = `<p class="hint">${esc(w.setup)}</p>`;
  else if (w.error) body = `<p class="warn"><b>Couldn’t check.</b> ${esc(w.error)}</p><div class="row"><button class="mini" data-open="options">Fix keys</button></div>`;
  else {
    if (w.stats?.length) body += `<div class="stats">${w.stats.map(stat).join("")}</div>`;
    if (w.attention?.length)
      body += `<ul class="items att">${w.attention.map((a) => `<li class="${a.level}">${link(a, "t")}${esc(a.text)}${endLink(a)}${a.level === "high" ? `<button class="mini" data-focus="${esc(a.text)}">Do it now</button>` : ""}</li>`).join("")}</ul>`;
    else if (w.type === "attention") body += `<p class="hint">Nothing waiting on GitHub.</p>`;
    if (w.items?.length)
      body += `<ul class="items">${w.items.map((i) => `<li><span class="ti">${link(i, "t")}${esc(i.text)}${endLink(i)}${i.sub ? `<span class="sub">${esc(i.sub)}</span>` : ""}</span>${i.badge ? `<span class="b">${esc(i.badge)}</span>` : ""}</li>`).join("")}</ul>`;
  }
  return `<section class="${cls}" data-wid="${w.id}" data-type="${esc(w.type)}">${urgent ? `<div class="alert-strip"><i></i>needs you</div>` : ""}<h2><span class="icon">${widgetIcon(w.type)}</span>${esc(w.title)}${w.stale ? `<span class="asof" title="Saved from last time. Fresh data is on its way.">as of ${esc(asOf(w.asOf))}</span>` : ""}</h2>${body}</section>`;
}

// ---------- Morning routine ----------
function routineCard(w) {
  const r = w.routine;
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  const rows = r.rows.map((it) => {
    const counter = it.target > 1;
    const meta = counter ? `${it.count} of ${it.target}${it.note ? " " + it.note : ""}` : it.note;
    return `<li><button type="button" class="rt ${it.done ? "done" : ""}" data-rt="${esc(it.id)}" aria-pressed="${it.done}">
      <span class="rt-box">${counter && !it.done && it.count ? it.count : it.done ? icon("check", 13) : ""}</span><span class="rt-label">${esc(it.label)}</span>${meta ? `<span class="rt-meta">${esc(meta)}</span>` : ""}</button></li>`;
  }).join("");
  const foot = r.complete ? `<p class="rt-foot">All done. That’s the morning handled.</p>` : "";
  return `<section class="card widget routine ${r.complete ? "complete" : ""}" data-wid="${w.id}" data-type="routine">
    <h2><span class="icon">${widgetIcon("routine")}</span>${esc(w.title)}<span class="when">${r.done} of ${r.total}</span></h2>
    <div class="rt-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${r.total}" aria-valuenow="${r.done}"><i style="transform:scaleX(${pct / 100})"></i></div>
    <ul class="rt-list">${rows}</ul>${foot}</section>`;
}
$("#grid").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-rt]");
  if (!b) return;
  b.disabled = true;
  const j = await fetch(`/api/routine/tap?u=${encodeURIComponent(user)}`, { method: "POST", body: JSON.stringify({ id: b.dataset.rt }) }).then((r) => r.json()).catch(() => ({ error: "Couldn’t save that." }));
  if (j.error) { toast(j.error); b.disabled = false; return; }
  const w = data.widgets.find((x) => x.type === "routine");
  w.routine = j.routine;
  b.closest(".routine").outerHTML = routineCard(w);
  if (j.garden) { const g = data.widgets.find((x) => x.type === "garden"); if (g) { g.garden = j.garden; const card = document.querySelector("#grid .garden"); if (card) card.outerHTML = gardenCard(g); } toast("Morning routine done. +5 tokens"); SFX.harvest?.(); }
  else SFX.tap?.();
  renderHero(data, user, () => { renderHero(data, user); loadBrief(); });
});

// ---------- I noticed ----------
function noticedCard(w) {
  const n = w.notice;
  if (!n) return "";  // nothing noticed → no card, by design
  const t = THEMES[document.documentElement.dataset.theme] ?? {};
  const face = faceURI(data.config.character || "sun", false, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || t.accent, t.card || "#fff");
  const who = CHARACTERS[data.config.character] ?? "Sun";
  const buttons = n.nudge
    ? `<div class="row"><button data-n="yes" data-id="${esc(n.id)}">Yes please</button><button class="ghost" data-n="no" data-id="${esc(n.id)}">No thanks</button></div>`
    : `<div class="row"><button data-n="ok" data-id="${esc(n.id)}">${esc(n.ack ?? "Got it")}</button></div>`;
  return `<section class="card widget noticed" data-wid="${w.id}" data-type="noticed"><h2><span class="icon">${widgetIcon("noticed")}</span>${esc(w.title)}<span class="when">this week</span></h2>
    <div class="observe"><img src="${face}" width="44" height="44" alt=""><p>${esc(n.text)}</p></div>
    ${n.ask ? `<p class="ask-line">${esc(n.ask)}</p>` : ""}${buttons}
    <div class="eyebrow foot">noticed by ${esc(who)} · <button class="link" data-why="${esc(n.why)}">why?</button></div></section>`;
}
$("#grid").addEventListener("click", async (e) => {
  const why = e.target.closest("[data-why]");
  if (why) { toast(why.dataset.why, 6000); return; }
  const b = e.target.closest("[data-n]");
  if (!b) return;
  const r = await fetch(`/api/notice/${b.dataset.n}?u=${encodeURIComponent(user)}`, { method: "POST", body: JSON.stringify({ id: b.dataset.id }) }).then((r) => r.json());
  const card = b.closest(".noticed");
  card.innerHTML = `<h2><span class="icon">${widgetIcon("noticed")}</span>I noticed</h2><p class="hint">${b.dataset.n === "yes" ? "Done. I’ll nudge you." : b.dataset.n === "no" ? "Okay. I won’t bring it up again for a month." : "Noted."}</p>`;
  SFX.tap?.();
  if (r.nudges) { const w = data.widgets.find((x) => x.type === "noticed"); if (w) { w.nudges = r.nudges; w.todayNudges = r.nudges.filter((x) => x.day === new Date().getDay()); renderHero(data, user, () => { renderHero(data, user); loadBrief(); }); } }
});

// ---------- garden ----------
const seedMini = (s) => plantSVG(s.id, 9, 10, { size: 26, label: "" });
function gardenCard(w) {
  const g = gardenState = window.gardenState = w.garden ?? gardenState;
  $("#tokens").innerHTML = `<span class="tk" title="Garden tokens">${icon("coin", 15)}${g.tokens}</span><span class="tk" title="Days in a row">${icon("flame", 15)}${g.streak}</span>`;
  renderThemePicker();
  const p = g.plantView;
  let body;
  if (p) {
    const dots = Array.from({ length: p.stages }, (_, i) => `<i class="${i <= p.stage ? "on" : ""}"></i>`).join("");
    body = `
      <div class="plant ${p.wilted ? "wilted" : ""}"><div class="art">${plantSVG(p.seed, p.stage, p.stages, { wilted: p.wilted, size: 92, label: p.name })}</div>
        <div><div class="pname">${esc(p.name)}${p.wilted ? " · wilted" : p.ready ? " · ready!" : ""}</div><div class="dots">${dots}</div>
        <div class="hint">${p.ready ? `Harvest for +${p.harvest}` : p.wateredToday ? "Watered today. Come back tomorrow." : "Needs water."}</div></div></div>
      <div class="row">
        ${p.ready ? `<button data-g="harvest">Harvest</button>` : `<button data-g="water" ${p.wateredToday ? "disabled" : ""}>${icon("drop", 15)}Water</button>`}
        <button data-g="shop" class="ghost">Seeds & themes</button>
      </div>`;
  } else {
    body = `<p class="hint">Nothing planted. Pick a seed:</p>
      <div class="seeds">${g.seeds.filter((s) => s.unlocked).map((s) => `<button data-g="plant" data-seed="${s.id}">${seedMini(s)}${esc(s.name)}</button>`).join("")}</div>
      <div class="row"><button data-g="shop" class="ghost">Seeds & themes</button></div>`;
  }
  const shop = `
    <div class="shop" hidden>
      <div class="hint">Seeds</div>
      <div class="seeds">${g.seeds.map((s) => s.unlocked ? `<span class="owned">${seedMini(s)}${esc(s.name)}</span>` : `<button data-g="buy" data-kind="seed" data-id="${s.id}" ${g.tokens < s.cost ? "disabled" : ""}>${seedMini(s)}${esc(s.name)} · ${icon("coin", 14)}${s.cost}</button>`).join("")}</div>
      <div class="hint">Themes</div>
      <div class="seeds">${g.themes.map((t) => t.unlocked ? `<span class="owned">${esc(THEMES[t.id]?.name ?? t.id)}</span>` : `<button data-g="buy" data-kind="theme" data-id="${t.id}" ${g.tokens < t.cost ? "disabled" : ""}>${esc(THEMES[t.id]?.name ?? t.id)} · ${icon("coin", 14)}${t.cost}</button>`).join("")}</div>
      ${g.harvested.length ? `<div class="hint">Harvested: ${g.harvested.map((h) => g.seeds.find((s) => s.id === h.seed)?.id ?? "").filter(Boolean).map((id) => plantSVG(id, 9, 10, { size: 26 })).join("")}</div>` : ""}
    </div>`;
  const log = g.log?.length ? `<div class="glog">${`<div>${esc(g.log[0])}</div>`}</div>` : "";
  return `<section class="card widget garden" data-wid="${w.id}" data-type="garden"><h2><span class="icon">${widgetIcon("garden")}</span>${esc(w.title)}</h2>${body}${shop}${log}</section>`;
}

$("#grid").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-g]");
  if (!b) return;
  const card = b.closest(".garden");
  if (b.dataset.g === "shop") { const s = card.querySelector(".shop"); s.hidden = !s.hidden; SFX.tap(); return; }
  const payload = b.dataset.g === "plant" ? { seed: b.dataset.seed } : b.dataset.g === "buy" ? { kind: b.dataset.kind, id: b.dataset.id } : {};
  const r = await fetch(`/api/garden/${b.dataset.g}?u=${encodeURIComponent(user)}`, { method: "POST", body: JSON.stringify(payload) });
  const j = await r.json();
  const w = data.widgets.find((x) => x.type === "garden");
  w.garden = j.garden;
  card.outerHTML = gardenCard(w);
  if (j.error) $("#status").textContent = j.error;
  else (SFX[b.dataset.g === "buy" ? "unlock" : b.dataset.g] ?? SFX.tap)();
});

// ---------- brief ----------
function greeting(name) {
  const h = new Date().getHours();
  const g = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${g}, ${name}.`;
}
// Template shows instantly; the model's text swaps in when it lands (or the template stays, with a note).
let briefSeq = 0, briefRetried = false;
async function loadBrief() {
  if (!data.brief?.enabled) { $("#brief").hidden = true; return; }
  $("#brief").hidden = false;
  const seq = ++briefSeq;
  const evening = isEvening(data.config);
  const payload = { widgets: data.widgets, name: data.user, character: data.config.character, tone: data.brief.tone, focus: data.brief.focus, mood: evening ? "" : getMood(user), evening, today: evening ? data.today : undefined };
  const post = (extra) => fetch("/api/brief", { method: "POST", body: JSON.stringify({ ...payload, ...extra }) }).then((r) => r.json());
  const show = (j) => {
    if (seq !== briefSeq) return;
    $("#brief").classList.toggle("pending", !!j.pending);
    const slow = /took over/.test(j.reason ?? "");
    const why = slow ? "the AI model is still waking up, I'll try again in a minute" : /nothing/.test(j.reason ?? "") ? "the AI model had nothing to say" : j.reason || "no AI model is set up";
    $("#brief").dataset.note = j.pending ? "Writing…" : j.fromModel ? "" : `Plain summary for now: ${why}.`;
    if (slow && !j.pending && !briefRetried) { briefRetried = true; setTimeout(() => { if (seq === briefSeq) loadBrief(); }, 60_000); }
    const rough = !evening && getMood(user) === "rough";
    $("#brief").className = `card brief${j.pending ? " pending" : ""}${rough ? " closed" : ""}`;
    $("#brief").innerHTML = `<p>${esc(j.text || j.error)}</p><button type="button" class="brief-more" hidden>More</button>`;
    const p = $("#brief p"), more = $("#brief .brief-more");
    more.hidden = !(rough || p.scrollHeight > p.clientHeight + 2);
    if (rough) more.textContent = "Show the brief";
  };
  try {
    const fast = await post({ fast: true });
    show(fast);
    if (fast.pending) show(await post({}));
  } catch (e) {
    if (seq === briefSeq) $("#brief").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

// ---------- chat ----------
const chatLog = [];
$("#chat-toggle").onclick = () => { if (document.body.classList.contains("phone")) return window.phoneTab?.("chat"); $("#chat").hidden = !$("#chat").hidden; if (!$("#chat").hidden) { window.fillStarters?.(); $("#chat-input").focus(); } };
$("#chat-clear").onclick = () => { chatLog.length = 0; $("#chat-log").innerHTML = ""; window.fillStarters?.(); };
async function ask(q) {
  q = q.trim();
  if (!q) return;
  $("#chat").hidden = false;
  $("#chat-input").value = q;
  $("#chat-form").requestSubmit();
}
$("#brief").addEventListener("click", (e) => {
  const b = e.target.closest(".brief-more");
  if (!b) return;
  const el = $("#brief");
  el.classList.remove("closed");
  el.classList.toggle("open");
  b.textContent = el.classList.contains("open") ? "Less" : "More";
});
$("#ask").onsubmit = (e) => { e.preventDefault(); ask($("#ask-in").value); $("#ask-in").value = ""; };
$("#ask").addEventListener("click", (e) => { const b = e.target.closest("[data-ask]"); if (b) ask(b.dataset.ask); });
$("#chat-form").onsubmit = async (e) => {
  e.preventDefault();
  const q = $("#chat-input").value.trim();
  if (!q) return;
  $("#chat-input").value = "";
  chatLog.push({ role: "user", content: q });
  $("#chat-log").insertAdjacentHTML("beforeend", `<div class="msg me">${esc(q)}</div><div class="msg bot"></div>`);
  const out = $("#chat-log").lastElementChild;
  $("#chat-log").scrollTop = 1e9;
  let text = "";
  try {
    const r = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ messages: chatLog, widgets: data?.widgets, name: data?.user }) });
    if (!r.ok) throw new Error((await r.json()).error);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const l of lines) { if (!l) continue; try { text += JSON.parse(l).message?.content ?? ""; } catch {} }
      out.textContent = text; $("#chat-log").scrollTop = 1e9;
    }
    chatLog.push({ role: "assistant", content: text });
  } catch (err) { out.textContent = `Error: ${err.message}`; out.classList.add("err"); }
};

// ---------- options menu ----------
$("#settings-toggle").onclick = () => openSettings();
let keyMeta = [];
let settingsSeq = 0;
const keyClear = new Set();

// ---- tabs
function showTab(name) {
  for (const t of document.querySelectorAll(".set-tabs [data-tab]")) t.setAttribute("aria-selected", String(t.dataset.tab === name));
  for (const p of document.querySelectorAll("#settings [data-panel]")) p.hidden = p.dataset.panel !== name;
  $("#settings .set-body").scrollTop = 0;
}
$("#settings .set-tabs").addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) showTab(t.dataset.tab); });
const setMsg = (text, bad = false) => { const m = $("#settings-msg"); m.textContent = text; m.classList.toggle("bad", bad); };

async function openSettings(tab = "you") {
  // The model check can take seconds on a cold start (one Ollama call per installed model), so it
  // fills the AI tab when it lands instead of holding the dialog closed.
  const seq = ++settingsSeq;
  const modelsP = fetch("/api/models").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [cat, envInfo] = await Promise.all([
    catalog.length ? catalog : fetch("/api/catalog").then((r) => r.json()),
    fetch("/api/env").then((r) => (r.ok ? r.json() : null)),
  ]);
  catalog = cat;
  const cfg = data.config;
  const f = $("#settings-form");
  setMsg("");

  // You
  f.name.value = cfg.name ?? "";
  themeOptions($("#settings-theme"), true);
  f.theme.value = cfg.theme ?? "sunrise";
  f.units.value = cfg.units ?? cfg.widgets?.find((w) => w.type === "weather")?.units ?? "auto";
  renderCharacters(cfg.character ?? "sun");
  f.accentOn.checked = !!cfg.accent;
  f.accentPick.value = cfg.accent || (THEMES[f.theme.value]?.accent ?? "#d1620a");
  f.accentPick.disabled = !f.accentOn.checked;

  // Morning
  f.briefEnabled.checked = cfg.brief?.enabled !== false;
  const tone = cfg.brief?.tone || "warm, concise, a little dry";
  if (![...f.tone.options].some((o) => o.value === tone)) f.tone.add(new Option(tone, tone));
  f.tone.value = tone;
  f.alarmTime.value = cfg.alarm?.time ?? "";
  for (const c of f.querySelectorAll("[name=alarmDay]")) c.checked = (cfg.alarm?.days ?? [1, 2, 3, 4, 5]).includes(+c.value);
  f.sound.checked = !!cfg.sound;
  setEvening(cfg.evening?.from ?? "17:00");

  // Display
  setQuiet(cfg.quiet ? `${cfg.quiet.start}-${cfg.quiet.end}` : "");
  setCycle(cfg.display?.cycleSec ?? 10);
  renderScreens();

  // Widgets
  const rows = [...cfg.widgets.map((w) => ({ ...w, on: true })), ...catalog.filter((c) => !cfg.widgets.some((w) => w.type === c.type)).map((c) => ({ type: c.type, on: false }))];
  renderWidgetRows(rows);

  // AI
  aiModels = null;
  f.modelsAll.checked = false;
  for (const s of [$("#brief-model"), $("#chat-model-sel")]) s.innerHTML = `<option value="">checking models…</option>`;
  $("#ai-status").innerHTML = "<b>Checking which models are installed…</b>";
  $("#models-hidden").innerHTML = ""; $("#models-all-row").hidden = true;
  modelsP.then((m) => { if (seq === settingsSeq) fillAI(m); });

  // Keys
  keyMeta = envInfo ?? [];
  keyClear.clear(); keyOpen.clear();
  $("#admin-note").hidden = !!envInfo;
  renderKeys();

  showTab(tab);
  if (!$("#settings").open) $("#settings").showModal();
}

function fillAI(models) {
  const f = $("#settings-form");
  if (!models) { $("#ai-status").innerHTML = "<b>Couldn’t check models.</b> Is the server running?"; return; }
  f.OLLAMA_URL.value = models.url; f.OLLAMA_URL.dataset.init = models.url;
  $("#brief-model").dataset.init = models.brief; $("#chat-model-sel").dataset.init = models.chat;
  aiModels = models;
  f.modelsAll.checked = false;
  $("#brief-model").innerHTML = ""; $("#chat-model-sel").innerHTML = "";   // start from the saved choice, not a cancelled edit
  renderModelPickers();
  const hidden = (models.installed ?? []).filter((m) => !m.fit);
  const cloud = models.cloud?.length ? `Sends dashboard data to ${[...new Set(models.cloud)].join(" and ")}.` : "Nothing leaves this machine.";
  $("#ai-status").innerHTML = `<b>${models.installed?.length ? `${models.local} of ${models.installed.length} installed models can write your brief` : "Ollama isn’t reachable"}</b>${models.claude ? " · Claude ready" : ""}${models.openrouter ? " · OpenRouter ready" : ""}<br>${esc(cloud)}`;
  $("#ai-status").classList.toggle("cloud", !!models.cloud?.length);
  const byWhy = {};
  for (const m of hidden) (byWhy[m.why.replace(/ \(.*\)$/, "")] ??= []).push(m.name);
  $("#models-hidden").innerHTML = hidden.length ? `${hidden.length} hidden because they can’t write a brief:<br>${Object.entries(byWhy).map(([why, names]) => `<b>${esc(why)}</b>: ${esc(names.join(", "))}`).join("<br>")}` : "";
  $("#models-all-row").hidden = !hidden.length;
}

// ---- AI: model pickers. Local = installed models that can write (largest first); "show all" adds the rest.
let aiModels = null;
function renderModelPickers() {
  const m = aiModels, f = $("#settings-form");
  if (!m) return;
  const all = f.modelsAll.checked;
  const local = (m.installed ?? []).filter((x) => all || x.fit);
  const opt = (name, label, cur) => `<option value="${esc(name)}" ${name === cur ? "selected" : ""}>${esc(label)}</option>`;
  const build = (cur) => {
    const groups = [
      ["On this machine", local.map((x) => [x.name, `${x.name}  ·  ${x.params}${x.fit ? "" : `  ·  ${x.why}`}`])],
      ["Claude (needs Anthropic key)", m.models.filter((x) => /^claude-/.test(x)).map((x) => [x, x])],
      ["OpenRouter (needs OpenRouter key)", m.models.filter((x) => /^openrouter\//.test(x)).map((x) => [x, x.replace(/^openrouter\//, "")])],
    ].filter(([, l]) => l.length);
    const shown = new Set(groups.flatMap(([, l]) => l.map(([n]) => n)));
    const extra = cur && !shown.has(cur) ? opt(cur, `${cur}  ·  current`, cur) : "";   // never drop what's in use
    return extra + groups.map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(([n, lab]) => opt(n, lab, cur)).join("")}</optgroup>`).join("");
  };
  const keep = (sel, fallback) => sel.value || fallback;
  $("#brief-model").innerHTML = build(keep($("#brief-model"), m.brief));
  $("#chat-model-sel").innerHTML = build(keep($("#chat-model-sel"), m.chat));
}
$("#settings-form").modelsAll.addEventListener("change", renderModelPickers);

// ---- Morning tab: evening recap start
function setEvening(v) {
  $("#settings-form").eveningFrom.value = v;
  for (const b of $("#evening-pick").querySelectorAll("[data-e]")) b.setAttribute("aria-checked", String(b.dataset.e === v));
}
$("#evening-pick").addEventListener("click", (e) => { const b = e.target.closest("[data-e]"); if (b) setEvening(b.dataset.e); });

// ---- Display: quiet-hours and card-time presets, addresses for other screens
function setQuiet(v) {
  const f = $("#settings-form");
  const presets = [...$("#quiet-pick").querySelectorAll("[data-q]")].map((b) => b.dataset.q);
  const pick = v === "custom" || (v && !presets.includes(v)) ? "custom" : v;
  if (pick !== "custom") { const [s, e] = v ? v.split("-") : ["", ""]; f.quietStart.value = s; f.quietEnd.value = e; }
  else if (v && v !== "custom") { const [s, e] = v.split("-"); f.quietStart.value = s; f.quietEnd.value = e; }
  for (const b of $("#quiet-pick").querySelectorAll("[data-q]")) b.setAttribute("aria-checked", String(b.dataset.q === pick));
  $("#quiet-custom").hidden = pick !== "custom";
  if (pick === "custom" && !f.quietStart.value) { f.quietStart.value = "22:30"; f.quietEnd.value = "06:30"; }
}
function setCycle(n) {
  $("#settings-form").cycleSec.value = n;
  for (const b of $("#cycle-pick").querySelectorAll("[data-c]")) b.setAttribute("aria-checked", String(+b.dataset.c === +n));
}
$("#quiet-pick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) setQuiet(b.dataset.q); });
$("#cycle-pick").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) setCycle(+b.dataset.c); });

async function renderScreens() {
  const box = $("#screens");
  let lan;
  try { lan = await (await fetch("/api/lan")).json(); } catch { box.innerHTML = `<p class="help">Couldn’t read this computer’s address.</p>`; return; }
  const addrs = lan.addresses ?? [];
  if (!addrs.length) { box.innerHTML = `<p class="help">This computer isn’t on a network right now.</p>`; return; }
  const q = user !== "dave" ? `u=${encodeURIComponent(user)}&` : "";
  const main = addrs[0], base = `http://${main.address}:${lan.port}/`;
  const rows = [
    ["TV or big screen", `${base}?${q}mode=tv`],
    ["Small panel", `${base}?${q}mode=small`],
    ["Raspberry Pi kiosk command", `~/good-day-sunshine/scripts/kiosk.sh http://${main.address}:${lan.port} small ${user}`],
  ];
  box.innerHTML = `<p class="help top">Open these on another device on the same network as this computer (${esc(main.address)}).</p>
    ${rows.map(([label, v], i) => `<div class="copy-row"><span class="copy-lbl">${esc(label)}</span><code>${esc(v)}</code><button type="button" class="ghost sm" data-copy="${esc(v)}">Copy</button>${i < 2 ? `<a class="link sm" href="${esc(v.replace(main.address, "localhost"))}" target="_blank">preview</a>` : ""}</div>`).join("")}
    ${addrs.length > 1 ? `<p class="help">Also reachable at ${addrs.slice(1).map((a) => `${esc(a.address)}${a.vpn ? " (VPN)" : ""}`).join(", ")}.</p>` : ""}
    <p class="help">If the other screen can’t connect, Windows may be blocking port ${lan.port}. See “Displays” in the README for the one-line firewall rule.</p>`;
}
$("#screens").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch { b.textContent = "Select it"; }
  setTimeout(() => { b.textContent = "Copy"; }, 1500);
});

// ---- You: character picker with the real faces
function renderCharacters(cur) {
  const f = $("#settings-form");
  f.character.value = cur;
  const t = THEMES[document.documentElement.dataset.theme] ?? {};
  const acc = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || t.accent;
  const blurb = { sun: "warm, a little nudgy", cat: "dry, secretly kind", robot: "precise", cloud: "soft", coffee: "quick" };
  $("#char-pick").innerHTML = Object.entries(CHARACTERS).map(([id, n]) => `<button type="button" class="char ${id === cur ? "on" : ""}" data-char="${id}" aria-pressed="${id === cur}"><img src="${faceURI(id, false, acc, t.card || "#fff")}" alt="" width="40" height="40"><b>${esc(n)}</b><span>${esc(blurb[id])}</span></button>`).join("");
}
$("#char-pick").addEventListener("click", (e) => { const b = e.target.closest("[data-char]"); if (b) renderCharacters(b.dataset.char); });
$("#settings-form").accentOn.addEventListener("change", (e) => { e.target.form.accentPick.disabled = !e.target.checked; });
$("#settings-theme").addEventListener("change", (e) => { const f = e.target.form; if (!f.accentOn.checked) f.accentPick.value = THEMES[e.target.value]?.accent ?? f.accentPick.value; });
$("#alarm-clear").onclick = () => { $("#settings-form").alarmTime.value = ""; };

// ---- Widgets: typed fields from the catalog, shown only for widgets that are on
const getPath = (o, p) => p.split(".").reduce((v, k) => (v == null ? undefined : v[k]), o);
const delPath = (o, p) => { const ks = p.split("."); const parent = ks.slice(0, -1).reduce((v, k) => (v == null ? undefined : v[k]), o); if (parent) delete parent[ks.at(-1)]; };
const setPath = (o, p, v) => { const ks = p.split("."); let cur = o; for (const k of ks.slice(0, -1)) cur = cur[k] ??= {}; cur[ks.at(-1)] = v; };
function fieldHTML(fd, val) {
  const id = `wf-${Math.random().toString(36).slice(2, 8)}`;
  const common = `id="${id}" data-k="${esc(fd.k)}" data-type="${fd.type}"`;
  let input;
  if (fd.type === "select") input = `<select ${common}>${fd.options.map(([v, l]) => `<option value="${esc(v)}" ${String(val ?? fd.def) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  else if (fd.type === "list") input = `<textarea ${common} rows="2" placeholder="${esc(fd.ph ?? "")}">${esc((val ?? []).join("\n"))}</textarea>`;
  else if (fd.type === "number") input = `<input ${common} type="number" class="num" ${fd.min != null ? `min="${fd.min}"` : ""} ${fd.max != null ? `max="${fd.max}"` : ""} value="${esc(val ?? "")}" placeholder="${esc(fd.ph ?? (fd.def != null ? String(fd.def) : ""))}">`;
  else input = `<input ${common} value="${esc(val ?? "")}" placeholder="${esc(fd.ph ?? "")}" autocomplete="off">`;
  return `<div class="wf"><label for="${id}">${esc(fd.label)}</label>${input}</div>`;
}
function renderWidgetRows(rows) {
  $("#widget-list").innerHTML = rows.map((w, i) => {
    const c = catalog.find((x) => x.type === w.type) ?? { title: w.type, icon: "•", fields: [] };
    const fields = (c.fields ?? []).map((fd) => fieldHTML(fd, getPath(w, fd.k))).join("");
    const { on, ...orig } = w;
    return `<div class="wrow ${w.on ? "on" : ""}" data-type="${esc(w.type)}" data-orig="${esc(JSON.stringify(orig))}">
      <div class="wrow-head">
        <label class="check"><input type="checkbox" class="w-on" ${w.on ? "checked" : ""}><span class="icon">${esc(c.icon)}</span><b>${esc(c.title)}</b></label>
        <input class="w-title" value="${esc(w.title ?? "")}" placeholder="rename" aria-label="Rename ${esc(c.title)}" autocomplete="off">
        <span class="w-move"><button type="button" data-mv="-1" aria-label="Move up" ${i === 0 ? "disabled" : ""}>▲</button><button type="button" data-mv="1" aria-label="Move down" ${i === rows.length - 1 ? "disabled" : ""}>▼</button></span>
      </div>
      ${fields ? `<div class="wrow-fields">${fields}</div>` : ""}
    </div>`;
  }).join("");
}
function readWidgetRows() {
  return [...document.querySelectorAll("#widget-list .wrow")].map((r) => {
    const type = r.dataset.type, on = r.querySelector(".w-on").checked, title = r.querySelector(".w-title").value.trim();
    // Start from the saved widget so settings this tab doesn't show survive; shown fields overwrite, emptied ones are removed.
    let orig = {};
    try { orig = JSON.parse(r.dataset.orig || "{}"); } catch {}
    const out = { ...orig, type, on };
    if (type === "weather") delete out.units;   // now one setting for the person, on the You tab
    if (title) out.title = title; else delete out.title;
    for (const el of r.querySelectorAll("[data-k]")) {
      const raw = el.value.trim();
      const t = el.dataset.type;
      if (!raw) { delPath(out, el.dataset.k); continue; }
      const v = t === "number" ? Number(raw) : t === "list" ? raw.split(/\n+/).map((s) => s.trim()).filter(Boolean) : t === "select" && /^\d+$/.test(raw) ? Number(raw) : raw;
      if (t === "number" && !Number.isFinite(v)) throw new Error(`${type}: ${el.previousElementSibling?.textContent ?? el.dataset.k} must be a number.`);
      setPath(out, el.dataset.k, v);
    }
    return out;
  });
}
$("#widget-list").addEventListener("change", (e) => { if (e.target.classList.contains("w-on")) e.target.closest(".wrow").classList.toggle("on", e.target.checked); });
$("#widget-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mv]");
  if (!b) return;
  const rows = readWidgetRows(), i = [...document.querySelectorAll("#widget-list .wrow")].indexOf(b.closest(".wrow")), j = i + +b.dataset.mv;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  renderWidgetRows(rows);
  document.querySelectorAll("#widget-list .wrow")[j]?.querySelector(`[data-mv="${b.dataset.mv}"]:not(:disabled), [data-mv]`)?.focus();
});

// ---- Keys: ordered by what needs you. Each group is tied to the widgets that use it (`for` in providers/index.js).
const keyOpen = new Set();   // saved secret keys whose "Replace" box is open
function keySections() {
  const onTypes = new Set(data.config.widgets.map((w) => w.type));
  const byType = Object.fromEntries(data.widgets.map((w) => [w.type, w]));
  const groups = [...new Set(keyMeta.map((k) => k.group ?? "Other"))].map((g) => {
    const keys = keyMeta.filter((k) => (k.group ?? "Other") === g);
    const types = [...new Set(keys.flatMap((k) => k.for ?? []))];
    const widgets = types.map((t) => byType[t]).filter(Boolean);
    let section, note = "";
    if (types.includes("@ai")) section = "ai";
    else if (!types.some((t) => onTypes.has(t))) section = "off";
    else if (widgets.some((w) => w.status === "error")) { section = "fix"; note = widgets.filter((w) => w.status === "error").map((w) => w.error).join(" · "); }
    else if (widgets.some((w) => w.status === "setup")) { section = "need"; note = types.includes("credits") ? "Turned on, but not connected yet. Any one of these is enough." : "Turned on, but not connected yet."; }
    else section = "ok";
    return { g, keys, section, note };
  });
  return groups;
}
function keyRow(k, expand) {
  const id = `key-${k.key}`;
  const clearing = keyClear.has(k.key);
  const saved = k.set && !clearing;
  const secret = k.secret !== false;
  const showInput = !secret || !k.set || expand || keyOpen.has(k.key);
  const status = clearing ? `<span class="pill-s clr">will be removed</span>` : k.set ? `<span class="pill-s ok">✓ saved</span>` : k.optional ? `<span class="pill-s">optional</span>` : `<span class="pill-s">not set</span>`;
  const actions = [
    secret && saved && !showInput ? `<button type="button" class="link sm" data-open-key="${k.key}">replace</button>` : "",
    secret && k.set ? `<button type="button" class="link sm" data-clear="${k.key}">${clearing ? "keep it" : "remove"}</button>` : "",
    k.url && (!k.set || showInput) ? `<a href="${esc(k.url)}" target="_blank" rel="noopener" class="link sm">get one ↗</a>` : "",
  ].filter(Boolean).join("");
  const input = !showInput ? "" : secret
    ? `<input id="${id}" name="env:${k.key}" type="password" placeholder="${k.set ? "paste a new one to replace" : "paste here"}" autocomplete="off" ${clearing ? "disabled" : ""}>`
    : `<input id="${id}" name="env:${k.key}" value="${esc(k.value ?? "")}" autocomplete="off">`;
  return `<div class="key ${showInput ? "" : "compact"}">
    <div class="key-top"><label ${showInput ? `for="${id}"` : ""}>${esc(k.label)}</label>${status}<span class="key-actions">${actions}</span></div>
    ${input}${showInput && k.help ? `<p class="help">${esc(k.help)}</p>` : ""}
  </div>`;
}
const SECTIONS = [
  ["fix", "Needs fixing"],
  ["need", "Needed for widgets you turned on"],
  ["ok", "Connected"],
  ["ai", "AI models · optional, for Claude or OpenRouter instead of local models"],
];
function renderKeys() {
  const groups = keySections();
  const block = (grp) => `<fieldset class="key-group ${grp.section}"><legend>${esc(grp.g)}</legend>
    ${grp.note ? `<p class="key-note">${grp.section === "fix" ? icon("alert", 14, "inl") + " " : ""}${esc(grp.note)}</p>` : ""}
    ${grp.keys.map((k) => keyRow(k, grp.section === "fix")).join("")}</fieldset>`;
  const off = groups.filter((x) => x.section === "off");
  $("#key-list").innerHTML =
    SECTIONS.map(([id, title]) => { const gs = groups.filter((x) => x.section === id); return gs.length ? `<h4 class="key-sec ${id}">${esc(title)}</h4>${gs.map(block).join("")}` : ""; }).join("") +
    (off.length ? `<details class="key-off"><summary>Keys for widgets that are off (${off.map((x) => esc(x.g)).join(", ")})</summary>${off.map(block).join("")}</details>` : "");
  $("#keys-dot").hidden = !groups.some((x) => x.section === "fix");
}
$("#key-list").addEventListener("click", (e) => {
  const c = e.target.closest("[data-clear]");
  if (c) { keyClear.has(c.dataset.clear) ? keyClear.delete(c.dataset.clear) : keyClear.add(c.dataset.clear); renderKeys(); return; }
  const o = e.target.closest("[data-open-key]");
  if (o) { keyOpen.add(o.dataset.openKey); renderKeys(); $(`#key-${o.dataset.openKey}`)?.focus(); }
});

// ---- Save
$("#settings-form").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  e.preventDefault();
  const f = e.target;
  if (!f.name.value.trim()) { showTab("you"); f.name.focus(); return setMsg("Add a name first.", true); }
  if ((f.quietStart.value && !f.quietEnd.value) || (!f.quietStart.value && f.quietEnd.value)) { showTab("display"); return setMsg("Quiet hours need both a start and an end.", true); }
  setMsg("Saving…");
  try {
    const widgets = readWidgetRows().filter((w) => w.on).map(({ on, ...w }) => w);
    const days = [...f.querySelectorAll("[name=alarmDay]:checked")].map((c) => +c.value);
    const cfg = {
      ...data.config, name: f.name.value.trim(), theme: f.theme.value, character: f.character.value, units: f.units.value,
      accent: f.accentOn.checked ? f.accentPick.value : null,
      brief: { ...data.config.brief, enabled: f.briefEnabled.checked, tone: f.tone.value },
      sound: f.sound.checked,
      evening: { from: f.eveningFrom.value || "off" },
      quiet: f.quietStart.value && f.quietEnd.value ? { start: f.quietStart.value, end: f.quietEnd.value } : undefined,
      display: { ...data.config.display, cycleSec: Math.min(120, Math.max(3, +f.cycleSec.value || 12)) },
      alarm: f.alarmTime.value ? { ...data.config.alarm, time: f.alarmTime.value, days, ramp: data.config.alarm?.ramp ?? 10 } : undefined,
      widgets,
    };
    const j = await (await fetch(`/api/users/${encodeURIComponent(user)}`, { method: "PUT", body: JSON.stringify(cfg) })).json();
    if (j.error) throw new Error(j.error);
    const envUpd = {};
    for (const k of keyMeta) {
      if (keyClear.has(k.key)) { envUpd[k.key] = ""; continue; }
      const v = f[`env:${k.key}`]?.value.trim() ?? "";
      if (k.secret === false ? v !== (k.value ?? "") : v) envUpd[k.key] = v;
    }
    for (const k of ["OLLAMA_URL", "OLLAMA_MODEL", "CHAT_MODEL"]) { const el = f[k]; const v = el?.value?.trim(); if (v && v !== el.dataset.init) envUpd[k] = v; }
    if (Object.keys(envUpd).length) {
      const er = await (await fetch("/api/env", { method: "PUT", body: JSON.stringify(envUpd) })).json();
      if (er.error) throw new Error(er.error);
    }
    const p = themePrefs(); if (p.theme || p.accent) saveTheme({});   // saved theme wins over the header's per-browser override
    $("#settings").close();
    toast("Saved.");
    load(true);
  } catch (err) { setMsg(err.message, true); }
});

// ---------- display modes ----------
let slide = 0, cycleTimer = null;
function startCycle() {
  clearInterval(cycleTimer);
  if (MODE !== "small" && MODE !== "tv") return;
  const per = MODE === "tv" ? 3 : 1;   // cards on screen at once
  const cards = () => [...document.querySelectorAll("#grid > .widget:not(.dim)")];
  const dots = $("#dots");
  const show = () => {
    const c = cards(); if (!c.length) return;
    const pages = Math.ceil(c.length / per), cur = slide % pages;
    c.forEach((el, i) => el.classList.toggle("active", Math.floor(i / per) === cur));
    dots.innerHTML = Array.from({ length: pages }, (_, i) => `<i class="${i === cur ? "on" : ""}"></i>`).join("");
  };
  show();
  cycleTimer = setInterval(() => { slide++; show(); }, (data.config?.display?.cycleSec ?? 12) * 1000);
  $("#grid").onclick ??= () => { slide++; show(); };
}
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }, 1000);

// quiet hours: dim overlay, tap to wake for 3 min. Logic lifted from ADHD/service/nightlight.mjs.
const WAKE_MS = 3 * 60_000;
let wokeAt = 0;
function inQuiet(q, d = new Date()) {
  if (!q?.start || !q?.end || q.start === q.end) return false;
  const m = (s) => { const [h, mi] = s.split(":").map(Number); return h * 60 + mi; };
  const now = d.getHours() * 60 + d.getMinutes(), a = m(q.start), b = m(q.end);
  return a < b ? now >= a && now < b : now >= a || now < b;
}
function tickNight() {
  const waking = data && tickWake(data.config, user);
  const asleep = !waking && inQuiet(data?.config?.quiet) && !(wokeAt && Date.now() - wokeAt < WAKE_MS);
  $("#night").hidden = !asleep;
  if (asleep) $("#night-clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
$("#night").onclick = () => { wokeAt = Date.now(); tickNight(); };
setInterval(tickNight, 5_000);
window.onWake = () => { renderHero(data, user, () => { renderHero(data, user); loadBrief(); }); loadBrief(); };

// ---------- load ----------
let lastHigh = null;
// wake-up wizard: new person, ?setup=1, or a profile that never finished onboarding
function wizard(existing) {
  runWizard({ existing, onDone: (slug) => { localStorage.setItem("ld:user", slug); location.href = `/?u=${slug}`; } });
}
let staleTimer = null, staleTries = 0;
let firstPaint = false;
async function load(refresh = false) {
  $("#status").textContent = "Loading…";
  document.body.classList.add("loading");
  const r = await fetch(`/api/dashboard?u=${encodeURIComponent(user)}${refresh ? "&refresh=1" : ""}${params.has("evening") ? "&evening=1" : ""}`);
  data = await r.json();
  document.body.classList.remove("loading");
  document.getElementById("splash")?.remove();
  if (data.error) {
    if (user === "new" || r.status === 404) return wizard(null);
    $("#grid").innerHTML = `<p class="err">${esc(data.error)}</p>`; return;
  }
  if (params.has("setup") || (!data.config.onboarded && !MODE)) return wizard({ ...data.config, slug: user });

  SFX.setEnabled(!!data.config.sound);
  gardenState = data.widgets.find((w) => w.type === "garden")?.garden ?? null;
  renderThemePicker();
  const p = themePrefs();
  applyTheme(p.theme || data.theme, p.accent ?? data.accent);
  document.title = `${data.user} · Good Day Sunshine`;
  window.data = data;
  window.syncMood?.(user);
  $("#date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  gardenState = window.gardenState = data.widgets.find((w) => w.type === "garden")?.garden ?? null;
  renderHero(data, user, () => { renderHero(data, user); loadBrief(); });
  $("#chat-model").textContent = data.chatModel;
  const mood = getMood(user);
  const ready = data.widgets.filter((w) => w.status !== "setup" && !(mood === "rough" && w.type === "news") && !(isEvening(data.config) && w.type === "routine")), pending = data.widgets.filter((w) => w.status === "setup"), broken = data.widgets.filter((w) => w.status === "error");
  $("#grid").innerHTML = ready.map(widget).join("");
  [...$("#grid").children].forEach((el, i) => el.style.setProperty("--i", i));
  if (!firstPaint) { firstPaint = true; $("#grid").classList.add("enter"); $("#hero-block").classList.add("enter"); setTimeout(() => { $("#grid").classList.remove("enter"); $("#hero-block").classList.remove("enter"); }, 1800); }
  window.phoneLayout?.();
  // Broken sources already speak in the headline, the bubble and on their own card; this is only the quiet footer link.
  $("#setup-strip").hidden = !pending.length || !!MODE;
  $("#setup-strip").innerHTML = pending.length ? `Not set up: ${pending.map((w) => esc(w.title)).join(", ")}. <button id="setup-go" class="link">Add keys</button>` : "";
  $("#setup-go")?.addEventListener("click", () => openSettings("keys"));
  $("#status").textContent = data.stale ? `Showing saved data for ${data.stale} card${data.stale === 1 ? "" : "s"} · updating…` : `Updated ${new Date().toLocaleTimeString()}`;
  // Saved data came back instantly; fresh fetches are running on the server. Check again shortly, a few times.
  clearTimeout(staleTimer);
  if (data.stale && staleTries < 10) { staleTries++; staleTimer = setTimeout(() => load(), 3000); }
  else if (!data.stale) staleTries = 0;
  $("#mode-hint").textContent = MODE ? `· ${MODE} mode` : "";
  const high = data.widgets.flatMap((w) => w.attention ?? []).filter((a) => a.level === "high").length;
  if (lastHigh != null && high > lastHigh) SFX.alert();
  lastHigh = high;
  startCycle(); tickNight();
  loadBrief();
  if (params.has("open")) {   // one-shot: ?open=options[&tab=keys] from the tray or a link
    const tab = params.get("tab") || "you", what = params.get("open");
    params.delete("open"); params.delete("tab");
    history.replaceState(null, "", location.pathname + (user !== "dave" ? `?u=${user}` : ""));
    if (what === "options") openSettings(tab);
  }
}

async function loadUsers() {
  const names = await (await fetch("/api/users")).json();
  if (!names.length) user = "new";
  $("#user").innerHTML = names.map((n) => `<option value="${n}" ${n === user ? "selected" : ""}>${n}</option>`).join("") + `<option value="new">+ New person…</option>`;
}
$("#user").onchange = (e) => {
  user = e.target.value;
  if (user === "new") return wizard(null);
  localStorage.setItem("ld:user", user); history.replaceState(null, "", `?u=${user}${MODE ? "&mode=" + MODE : ""}`); load();
};
$("#refresh").onclick = () => load(true);
function pickFocusTask() {
  if (MODE || !data) return;   // a TV or panel has no keyboard
  window.phoneTab?.("today");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (!window.openOneThing?.(data, user)) toast("Couldn’t open the picker.");
}
$("#focus-toggle").onclick = pickFocusTask;
$("#grid").addEventListener("click", (e) => { if (e.target.closest("[data-open=options]")) openSettings("keys"); const b = e.target.closest("[data-focus]"); if (b) startFocus(b.dataset.focus.replace(/^(Review|Assigned): /, ""), user, { onDone: () => load() }); });
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;   // Ctrl+C is copy, not Chat
  if (e.key === "r") load(true);
  if (e.key === "c") $("#chat-toggle").click();
  if (e.key === "o") openSettings();
  if (e.key === "j") pickFocusTask();
});

loadUsers().then(() => load()).catch(() => { const s = document.getElementById("splash"); if (s) s.querySelector(".splash-note").textContent = "Can’t reach the dashboard server."; });
setInterval(() => load(), 10 * 60 * 1000);
