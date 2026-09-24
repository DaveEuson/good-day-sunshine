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
  sel.innerHTML = Object.entries(THEMES).map(([k, t]) => {
    const locked = t.locked && !owned.includes(k);
    return `<option value="${k}" ${locked && !allowLocked ? "disabled" : ""}>${t.name}${locked ? ` 🔒 ${costs[k] ?? ""}` : ""}</option>`;
  }).join("");
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
const link = (i, cls) => i.url ? `<a class="${cls}" href="${esc(i.url)}" target="_blank" rel="noopener">` : `<span class="${cls}">`;
const endLink = (i) => (i.url ? "</a>" : "</span>");

function widget(w) {
  if (w.type === "garden") return gardenCard(w);
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
  return `<section class="${cls}" data-wid="${w.id}" data-type="${esc(w.type)}">${urgent ? `<div class="alert-strip"><i></i>needs you</div>` : ""}<h2><span class="icon">${esc(w.icon ?? "•")}</span>${esc(w.title)}</h2>${body}</section>`;
}

// ---------- garden ----------
function gardenCard(w) {
  const g = gardenState = window.gardenState = w.garden ?? gardenState;
  $("#tokens").textContent = `🪙 ${g.tokens} · 🔥 ${g.streak}`;
  renderThemePicker();
  const p = g.plantView;
  let body;
  if (p) {
    const dots = Array.from({ length: p.stages }, (_, i) => `<i class="${i <= p.stage ? "on" : ""}"></i>`).join("");
    body = `
      <div class="plant ${p.wilted ? "wilted" : ""}"><div class="art">${p.art}</div>
        <div><div class="pname">${esc(p.name)}${p.wilted ? " · wilted" : p.ready ? " · ready!" : ""}</div><div class="dots">${dots}</div>
        <div class="hint">${p.ready ? `Harvest for +${p.harvest}` : p.wateredToday ? "Watered today. Come back tomorrow." : "Needs water."}</div></div></div>
      <div class="row">
        ${p.ready ? `<button data-g="harvest">Harvest 🧺</button>` : `<button data-g="water" ${p.wateredToday ? "disabled" : ""}>Water 💧</button>`}
        <button data-g="shop" class="ghost">Seeds & themes</button>
      </div>`;
  } else {
    body = `<p class="hint">Nothing planted. Pick a seed:</p>
      <div class="seeds">${g.seeds.filter((s) => s.unlocked).map((s) => `<button data-g="plant" data-seed="${s.id}">${s.final} ${esc(s.name)}</button>`).join("")}</div>
      <div class="row"><button data-g="shop" class="ghost">Seeds & themes</button></div>`;
  }
  const shop = `
    <div class="shop" hidden>
      <div class="hint">Seeds</div>
      <div class="seeds">${g.seeds.map((s) => s.unlocked ? `<span class="owned">${s.final} ${esc(s.name)}</span>` : `<button data-g="buy" data-kind="seed" data-id="${s.id}" ${g.tokens < s.cost ? "disabled" : ""}>${s.final} ${esc(s.name)} · 🪙 ${s.cost}</button>`).join("")}</div>
      <div class="hint">Themes</div>
      <div class="seeds">${g.themes.map((t) => t.unlocked ? `<span class="owned">${esc(THEMES[t.id]?.name ?? t.id)}</span>` : `<button data-g="buy" data-kind="theme" data-id="${t.id}" ${g.tokens < t.cost ? "disabled" : ""}>${esc(THEMES[t.id]?.name ?? t.id)} · 🪙 ${t.cost}</button>`).join("")}</div>
      ${g.harvested.length ? `<div class="hint">Harvested: ${g.harvested.map((h) => g.seeds.find((s) => s.id === h.seed)?.final ?? "").join(" ")}</div>` : ""}
    </div>`;
  const log = g.log?.length ? `<div class="glog">${`<div>${esc(g.log[0])}</div>`}</div>` : "";
  return `<section class="card widget garden" data-wid="${w.id}"><h2><span class="icon">❀</span>${esc(w.title)}</h2>${body}${shop}${log}</section>`;
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
let briefSeq = 0;
async function loadBrief() {
  if (!data.brief?.enabled) { $("#brief").hidden = true; return; }
  $("#brief").hidden = false;
  const seq = ++briefSeq;
  const payload = { widgets: data.widgets, name: data.user, tone: data.brief.tone, focus: data.brief.focus, mood: getMood(user) };
  const post = (extra) => fetch("/api/brief", { method: "POST", body: JSON.stringify({ ...payload, ...extra }) }).then((r) => r.json());
  const show = (j) => {
    if (seq !== briefSeq) return;
    $("#brief").classList.toggle("pending", !!j.pending);
    $("#brief").dataset.note = j.pending ? "thinking…" : j.fromModel ? "" : `summary · ${j.reason || "no model"}`;
    $("#brief").innerHTML = `<p>${esc(j.text || j.error)}</p>`;
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
$("#chat-toggle").onclick = () => { $("#chat").hidden = !$("#chat").hidden; if (!$("#chat").hidden) $("#chat-input").focus(); };
$("#chat-clear").onclick = () => { chatLog.length = 0; $("#chat-log").innerHTML = ""; };
async function ask(q) {
  q = q.trim();
  if (!q) return;
  $("#chat").hidden = false;
  $("#chat-input").value = q;
  $("#chat-form").requestSubmit();
}
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
async function openSettings() {
  const [cat, envInfo, models] = await Promise.all([
    catalog.length ? catalog : (await fetch("/api/catalog")).json(),
    fetch("/api/env").then((r) => r.ok ? r.json() : null),
    fetch("/api/models").then((r) => r.ok ? r.json() : null),
  ]);
  catalog = cat;
  const cfg = data.config;
  const f = $("#settings-form");
  themeOptions($("#settings-theme"), true);
  // AI
  $("#admin-note").hidden = !!envInfo;
  if (models) {
    f.OLLAMA_URL.value = models.url;
    const opts = (cur) => [...new Set([cur, ...models.models])].filter(Boolean).map((m) => `<option ${m === cur ? "selected" : ""}>${esc(m)}</option>`).join("");
    $("#brief-model").innerHTML = opts(models.brief); $("#chat-model-sel").innerHTML = opts(models.chat);
    $("#ai-status").textContent = [models.local ? `${models.local} local models` : "Ollama not reachable", models.claude ? "Claude ready" : "", models.openrouter ? "OpenRouter ready" : "", models.cloud?.length ? `⚠ dashboard data is sent to ${[...new Set(models.cloud)].join(" and ")}` : "nothing leaves this machine"].filter(Boolean).join(" · ");
  }
  // Keys
  keyMeta = envInfo ?? [];
  $("#key-list").innerHTML = keyMeta.map((k) => `<label title="${esc(k.help)}">${esc(k.label)}${k.url ? ` <a href="${esc(k.url)}" target="_blank" rel="noopener">↗</a>` : ""}
    <input name="env:${k.key}" ${k.secret === false ? `value="${esc(k.value ?? "")}"` : `type="password" placeholder="${k.set ? "•••••• (set)" : "not set"}"`} autocomplete="off"></label>`).join("");
  f.name.value = cfg.name; f.theme.value = cfg.theme ?? "sunrise"; f.character.value = cfg.character ?? "sun"; f.accent.value = cfg.accent ?? "";
  f.briefEnabled.checked = cfg.brief?.enabled !== false; f.tone.value = cfg.brief?.tone ?? "";
  f.sound.checked = !!cfg.sound;
  f.quietStart.value = cfg.quiet?.start ?? ""; f.quietEnd.value = cfg.quiet?.end ?? "";
  f.cycleSec.value = cfg.display?.cycleSec ?? 12;
  f.alarmTime.value = cfg.alarm?.time ?? "";
  for (const c of f.querySelectorAll("[name=alarmDay]")) c.checked = (cfg.alarm?.days ?? [1, 2, 3, 4, 5]).includes(+c.value);
  // enabled widgets in config order, then the rest of the catalog disabled
  const rows = [...cfg.widgets.map((w) => ({ ...w, on: true })), ...catalog.filter((c) => !cfg.widgets.some((w) => w.type === c.type)).map((c) => ({ type: c.type, on: false }))];
  renderWidgetRows(rows);
}
// Per-widget option fields come from the catalog hint (example JSON): key → input, typed by the example value.
const hintFields = (c) => { try { return Object.entries(JSON.parse(c.hint)); } catch { return []; } };
const fieldVal = (v) => Array.isArray(v) ? v.join(", ") : v ?? "";
function renderWidgetRows(rows) {
  $("#widget-list").innerHTML = rows.map((w, i) => {
    const c = catalog.find((x) => x.type === w.type) ?? { title: w.type, icon: "•", hint: "{}" };
    const { type, on, title, ...opts } = w;
    const fields = hintFields(c).map(([k, ex]) => `<label class="w-field">${esc(k)} <input data-k="${esc(k)}" data-ex='${esc(JSON.stringify(ex))}' placeholder="${esc(fieldVal(ex))}" value="${esc(fieldVal(opts[k]))}"></label>`).join("");
    return `<div class="wrow" data-type="${type}">
      <label><input type="checkbox" class="w-on" ${on ? "checked" : ""}> <span class="icon">${esc(c.icon)}</span> ${esc(c.title)}</label>
      <input class="w-title" placeholder="title" value="${esc(title ?? "")}">
      <div class="w-fields">${fields || `<span class="hint">no options</span>`}</div>
      <span class="w-move"><button type="button" data-mv="-1" ${i === 0 ? "disabled" : ""}>▲</button><button type="button" data-mv="1" ${i === rows.length - 1 ? "disabled" : ""}>▼</button></span>
    </div>`;
  }).join("");
  $("#settings").showModal();
}
function readWidgetRows() {
  return [...document.querySelectorAll(".wrow")].map((r) => {
    const type = r.dataset.type, on = r.querySelector(".w-on").checked, title = r.querySelector(".w-title").value.trim();
    const opts = {};
    for (const inp of r.querySelectorAll(".w-field input")) {
      const raw = inp.value.trim();
      if (!raw) continue;
      const ex = JSON.parse(inp.dataset.ex);
      opts[inp.dataset.k] = Array.isArray(ex) ? raw.split(",").map((s) => s.trim()).filter(Boolean) : typeof ex === "number" ? Number(raw) : raw;
    }
    return { type, on, ...(title ? { title } : {}), ...opts };
  });
}
$("#widget-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mv]");
  if (!b) return;
  const rows = readWidgetRows(), i = [...document.querySelectorAll(".wrow")].indexOf(b.closest(".wrow")), j = i + +b.dataset.mv;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  $("#settings").close(); renderWidgetRows(rows);
});
$("#settings-form").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  e.preventDefault();
  const f = e.target;
  try {
    const widgets = readWidgetRows().filter((w) => w.on).map(({ on, ...w }) => w);
    const cfg = {
      ...data.config, name: f.name.value.trim(), theme: f.theme.value, character: f.character.value, accent: f.accent.value.trim() || null,
      brief: { enabled: f.briefEnabled.checked, tone: f.tone.value.trim() || undefined },
      sound: f.sound.checked,
      quiet: f.quietStart.value && f.quietEnd.value ? { start: f.quietStart.value, end: f.quietEnd.value } : undefined,
      display: { cycleSec: +f.cycleSec.value || 12 },
      alarm: f.alarmTime.value ? { time: f.alarmTime.value, days: [...f.querySelectorAll("[name=alarmDay]:checked")].map((c) => +c.value), ramp: 10 } : undefined,
      widgets,
    };
    const r = await fetch(`/api/users/${encodeURIComponent(user)}`, { method: "PUT", body: JSON.stringify(cfg) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    // keys + AI → .env (only non-empty; "-" clears)
    const envUpd = {};
    for (const k of keyMeta) { const v = f[`env:${k.key}`].value.trim(); if (v) envUpd[k.key] = v === "-" ? "" : v; }
    for (const k of ["OLLAMA_URL", "OLLAMA_MODEL", "CHAT_MODEL"]) { const v = f[k]?.value?.trim(); if (v) envUpd[k] = v; }
    if (Object.keys(envUpd).length) {
      const er = await (await fetch("/api/env", { method: "PUT", body: JSON.stringify(envUpd) })).json();
      if (er.error) throw new Error(er.error);
    }
    $("#settings").close();
    load(true);
  } catch (err) { $("#status").textContent = err.message; }
});

// ---------- display modes ----------
let slide = 0, cycleTimer = null;
function startCycle() {
  clearInterval(cycleTimer);
  if (MODE !== "small") return;
  const cards = () => [...document.querySelectorAll("#grid > .widget:not(.dim)")];
  const dots = $("#dots");
  const show = () => {
    const c = cards(); if (!c.length) return;
    const cur = slide % c.length;
    c.forEach((el, i) => el.classList.toggle("active", i === cur));
    dots.innerHTML = c.map((_, i) => `<i class="${i === cur ? "on" : ""}"></i>`).join("");
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
async function load(refresh = false) {
  $("#status").textContent = "Loading…";
  const r = await fetch(`/api/dashboard?u=${encodeURIComponent(user)}${refresh ? "&refresh=1" : ""}`);
  data = await r.json();
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
  $("#date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  gardenState = window.gardenState = data.widgets.find((w) => w.type === "garden")?.garden ?? null;
  renderHero(data, user, () => { renderHero(data, user); loadBrief(); });
  $("#chat-model").textContent = data.chatModel;
  const mood = getMood(user);
  const ready = data.widgets.filter((w) => w.status !== "setup" && !(mood === "rough" && w.type === "news")), pending = data.widgets.filter((w) => w.status === "setup"), broken = data.widgets.filter((w) => w.status === "error");
  $("#grid").innerHTML = ready.map(widget).join("");
  $("#setup-strip").hidden = !(pending.length || broken.length) || !!MODE;
  $("#setup-strip").innerHTML = [broken.length ? `<span class="err">⚠ ${broken.map((w) => `${esc(w.title)}: ${esc(w.error)}`).join(" · ")}</span>` : "", pending.length ? `Not set up yet: <b>${pending.map((w) => esc(w.title)).join(", ")}</b>` : ""].filter(Boolean).join(" &nbsp; ") + (pending.length || broken.length ? ` <button id="setup-go">${broken.length ? "Fix keys" : "Add keys"}</button>` : "");
  $("#setup-go")?.addEventListener("click", openSettings);
  $("#status").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  $("#mode-hint").textContent = MODE ? `· ${MODE} mode` : "";
  const high = data.widgets.flatMap((w) => w.attention ?? []).filter((a) => a.level === "high").length;
  if (lastHigh != null && high > lastHigh) SFX.alert();
  lastHigh = high;
  startCycle(); tickNight();
  loadBrief();
  if (params.has("open")) { history.replaceState(null, "", location.pathname + (user !== "dave" ? `?u=${user}` : "")); if (params.get("open") === "options") openSettings(); }
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
  const att = data?.widgets.flatMap((w) => w.attention ?? []) ?? [];
  const top = att.find((x) => x.level === "high") ?? att[0];
  const t = prompt("Just one thing. What is it?", top ? top.text.replace(/^(Review|Assigned): /, "") : "");
  if (t) startFocus(t, user, { onDone: () => load() });
}
$("#focus-toggle").onclick = pickFocusTask;
$("#grid").addEventListener("click", (e) => { if (e.target.closest("[data-open=options]")) openSettings(); const b = e.target.closest("[data-focus]"); if (b) startFocus(b.dataset.focus.replace(/^(Review|Assigned): /, ""), user, { onDone: () => load() }); });
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  if (e.key === "r") load(true);
  if (e.key === "c") $("#chat-toggle").click();
  if (e.key === "o") openSettings();
  if (e.key === "j") pickFocusTask();
});

loadUsers().then(() => load());
setInterval(() => load(), 10 * 60 * 1000);
