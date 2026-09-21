const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const MODE = params.get("mode") || "";           // "" | "tv" | "small"
let user = params.get("u") || localStorage.getItem("ld:user") || "dave";
let data = null;
let gardenState = null;
let catalog = [];
document.body.classList.toggle("tv", MODE === "tv");
document.body.classList.toggle("small", MODE === "small");

// ---------- theme ----------
function applyTheme(key, accent) {
  const t = THEMES[key] ?? THEMES.midnight;
  const r = document.documentElement.style;
  for (const k of ["bg", "card", "text", "muted", "accent", "border", "font"]) r.setProperty(`--${k}`, t[k]);
  r.setProperty("--page", t.page ?? t.bg);
  r.setProperty("--on-accent", t.onAccent ?? t.bg);
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
  if (!series || series.length < 2) return "";
  const w = 64, h = 18, min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - ((v - min) / span) * (h - 2) - 1}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
}
function delta(d) {
  if (d == null || d === 0) return "";
  return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d).toLocaleString()}</span>`;
}
const stat = (s) => `<div class="stat"><div class="v">${fmt(s.value)}${delta(s.delta)}</div><div class="l">${esc(s.label)}</div>${s.sub ? `<div class="s">${esc(s.sub)}</div>` : ""}${spark(s.series)}</div>`;
const link = (i, cls) => i.url ? `<a class="${cls}" href="${esc(i.url)}" target="_blank" rel="noopener">` : `<span class="${cls}">`;
const endLink = (i) => (i.url ? "</a>" : "</span>");

function widget(w) {
  if (w.type === "garden") return gardenCard(w);
  const cls = ["card", "widget", w.setup || w.error ? "dim" : "", w.attention?.some((a) => a.level === "high") ? "alert" : ""].join(" ");
  let body = "";
  if (w.setup) body = `<p class="hint">${esc(w.setup)}</p>`;
  else if (w.error) body = `<p class="err">${esc(w.error)}</p>`;
  else {
    if (w.stats?.length) body += `<div class="stats">${w.stats.map(stat).join("")}</div>`;
    if (w.attention?.length)
      body += `<ul class="items att">${w.attention.map((a) => `<li class="${a.level}">${link(a, "t")}${esc(a.text)}${endLink(a)}</li>`).join("")}</ul>`;
    else if (w.type === "attention") body += `<p class="hint">Inbox zero. Nothing needs you.</p>`;
    if (w.items?.length)
      body += `<ul class="items">${w.items.map((i) => `<li>${link(i, "t")}${esc(i.text)}${i.sub ? `<span class="sub">${esc(i.sub)}</span>` : ""}${endLink(i)}<span class="b">${esc(i.badge ?? "")}</span></li>`).join("")}</ul>`;
  }
  return `<section class="${cls}" data-wid="${w.id}"><h2><span class="icon">${esc(w.icon ?? "•")}</span>${esc(w.title)}</h2>${body}</section>`;
}

// ---------- garden ----------
function gardenCard(w) {
  const g = gardenState = w.garden ?? gardenState;
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
  const log = g.log?.length ? `<div class="glog">${g.log.slice(0, 3).map((l) => `<div>${esc(l)}</div>`).join("")}</div>` : "";
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
async function loadBrief() {
  if (!data.brief?.enabled) { $("#brief").hidden = true; return; }
  $("#brief").hidden = false;
  $("#brief").innerHTML = `<p class="muted">Writing your brief…</p>`;
  try {
    const r = await fetch("/api/brief", { method: "POST", body: JSON.stringify({ widgets: data.widgets, name: data.user, tone: data.brief.tone }) });
    const j = await r.json();
    $("#brief").innerHTML = `<p>${esc(j.text || j.error)}</p>`;
  } catch (e) {
    $("#brief").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

// ---------- chat ----------
const chatLog = [];
$("#chat-toggle").onclick = () => { $("#chat").hidden = !$("#chat").hidden; if (!$("#chat").hidden) $("#chat-input").focus(); };
$("#chat-clear").onclick = () => { chatLog.length = 0; $("#chat-log").innerHTML = ""; };
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
async function openSettings() {
  if (!catalog.length) catalog = await (await fetch("/api/catalog")).json();
  const cfg = data.config;
  const f = $("#settings-form");
  themeOptions($("#settings-theme"), true);
  f.name.value = cfg.name; f.theme.value = cfg.theme ?? "midnight"; f.accent.value = cfg.accent ?? "";
  f.briefEnabled.checked = cfg.brief?.enabled !== false; f.tone.value = cfg.brief?.tone ?? "";
  f.sound.checked = !!cfg.sound;
  f.quietStart.value = cfg.quiet?.start ?? ""; f.quietEnd.value = cfg.quiet?.end ?? "";
  f.cycleSec.value = cfg.display?.cycleSec ?? 12;
  // enabled widgets in config order, then the rest of the catalog disabled
  const rows = [...cfg.widgets.map((w) => ({ ...w, on: true })), ...catalog.filter((c) => !cfg.widgets.some((w) => w.type === c.type)).map((c) => ({ type: c.type, on: false }))];
  renderWidgetRows(rows);
}
function renderWidgetRows(rows) {
  $("#widget-list").innerHTML = rows.map((w, i) => {
    const c = catalog.find((x) => x.type === w.type) ?? { title: w.type, icon: "•", hint: "{}" };
    const { type, on, title, ...opts } = w;
    return `<div class="wrow" data-type="${type}">
      <label><input type="checkbox" class="w-on" ${on ? "checked" : ""}> <span class="icon">${esc(c.icon)}</span> ${esc(c.title)}</label>
      <input class="w-title" placeholder="title" value="${esc(title ?? "")}">
      <input class="w-opts" placeholder='${esc(c.hint)}' value="${esc(Object.keys(opts).length ? JSON.stringify(opts) : "")}">
      <span class="w-move"><button type="button" data-mv="-1" ${i === 0 ? "disabled" : ""}>▲</button><button type="button" data-mv="1" ${i === rows.length - 1 ? "disabled" : ""}>▼</button></span>
    </div>`;
  }).join("");
  $("#settings").showModal();
}
function readWidgetRows() {
  return [...document.querySelectorAll(".wrow")].map((r) => {
    const type = r.dataset.type, on = r.querySelector(".w-on").checked, title = r.querySelector(".w-title").value.trim();
    let opts = {};
    const raw = r.querySelector(".w-opts").value.trim();
    if (raw) { try { opts = JSON.parse(raw); } catch { throw new Error(`Options for ${type} are not valid JSON.`); } }
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
      ...data.config, name: f.name.value.trim(), theme: f.theme.value, accent: f.accent.value.trim() || null,
      brief: { enabled: f.briefEnabled.checked, tone: f.tone.value.trim() || undefined },
      sound: f.sound.checked,
      quiet: f.quietStart.value && f.quietEnd.value ? { start: f.quietStart.value, end: f.quietEnd.value } : undefined,
      display: { cycleSec: +f.cycleSec.value || 12 },
      widgets,
    };
    const r = await fetch(`/api/users/${encodeURIComponent(user)}`, { method: "PUT", body: JSON.stringify(cfg) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
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
  const show = () => { const c = cards(); c.forEach((el, i) => el.classList.toggle("active", i === slide % c.length)); };
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
  const asleep = inQuiet(data?.config?.quiet) && !(wokeAt && Date.now() - wokeAt < WAKE_MS);
  $("#night").hidden = !asleep;
  if (asleep) $("#night-clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
$("#night").onclick = () => { wokeAt = Date.now(); tickNight(); };
setInterval(tickNight, 15_000);

// ---------- load ----------
let lastHigh = null;
async function load(refresh = false) {
  $("#status").textContent = "Loading…";
  const r = await fetch(`/api/dashboard?u=${encodeURIComponent(user)}${refresh ? "&refresh=1" : ""}`);
  data = await r.json();
  if (data.error) { $("#grid").innerHTML = `<p class="err">${esc(data.error)}</p>`; return; }

  SFX.setEnabled(!!data.config.sound);
  gardenState = data.widgets.find((w) => w.type === "garden")?.garden ?? null;
  renderThemePicker();
  const p = themePrefs();
  applyTheme(p.theme || data.theme, p.accent ?? data.accent);
  document.title = `${data.user} · Good Day Sunshine`;
  $("#greeting").textContent = greeting(data.user);
  $("#date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  $("#chat-model").textContent = data.chatModel;
  $("#grid").innerHTML = data.widgets.map(widget).join("");
  $("#status").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  $("#mode-hint").textContent = MODE ? `· ${MODE} mode` : "";
  const high = data.widgets.flatMap((w) => w.attention ?? []).filter((a) => a.level === "high").length;
  if (lastHigh != null && high > lastHigh) SFX.alert();
  lastHigh = high;
  startCycle(); tickNight();
  loadBrief();
}

async function loadUsers() {
  const names = await (await fetch("/api/users")).json();
  $("#user").innerHTML = names.map((n) => `<option value="${n}" ${n === user ? "selected" : ""}>${n}</option>`).join("");
}
$("#user").onchange = (e) => { user = e.target.value; localStorage.setItem("ld:user", user); history.replaceState(null, "", `?u=${user}${MODE ? "&mode=" + MODE : ""}`); load(); };
$("#refresh").onclick = () => load(true);
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  if (e.key === "r") load(true);
  if (e.key === "c") $("#chat-toggle").click();
  if (e.key === "o") openSettings();
});

loadUsers().then(() => load());
setInterval(() => load(), 10 * 60 * 1000);
