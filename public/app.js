const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let user = params.get("u") || localStorage.getItem("ld:user") || "dave";
let data = null;

// ---------- theme ----------
function applyTheme(key, accent) {
  const t = THEMES[key] ?? THEMES.midnight;
  const r = document.documentElement.style;
  for (const k of ["bg", "card", "text", "muted", "accent", "border", "font"]) r.setProperty(`--${k}`, t[k]);
  if (accent) r.setProperty("--accent", accent);
  $("#theme").value = key;
  $("#accent").value = accent || t.accent;
}
function themePrefs() {
  try { return JSON.parse(localStorage.getItem(`ld:theme:${user}`)) || {}; } catch { return {}; }
}
function saveTheme(p) { localStorage.setItem(`ld:theme:${user}`, JSON.stringify(p)); }

$("#theme").innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join("");
$("#theme").onchange = (e) => { const p = { ...themePrefs(), theme: e.target.value, accent: null }; saveTheme(p); applyTheme(p.theme, null); };
$("#accent").oninput = (e) => { const p = { ...themePrefs(), accent: e.target.value }; saveTheme(p); document.documentElement.style.setProperty("--accent", e.target.value); };

// ---------- render ----------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (v) => (typeof v === "number" ? v.toLocaleString() : esc(v));

function widget(w) {
  const cls = ["card", "widget", w.setup || w.error ? "dim" : "", w.attention?.some((a) => a.level === "high") ? "alert" : ""].join(" ");
  let body = "";
  if (w.setup) body = `<p class="hint">${esc(w.setup)}</p>`;
  else if (w.error) body = `<p class="err">${esc(w.error)}</p>`;
  else {
    if (w.stats?.length)
      body += `<div class="stats">${w.stats.map((s) => `<div class="stat"><div class="v">${fmt(s.value)}</div><div class="l">${esc(s.label)}</div>${s.sub ? `<div class="s">${esc(s.sub)}</div>` : ""}</div>`).join("")}</div>`;
    if (w.attention?.length)
      body += `<ul class="items att">${w.attention.map((a) => `<li class="${a.level}"><a class="t" href="${esc(a.url)}" target="_blank">${esc(a.text)}</a></li>`).join("")}</ul>`;
    else if (w.type === "attention") body += `<p class="hint">Inbox zero. Nothing needs you.</p>`;
    if (w.items?.length)
      body += `<ul class="items">${w.items.map((i) => `<li><a class="t" href="${esc(i.url)}" target="_blank">${esc(i.text)}${i.sub ? `<span class="sub">${esc(i.sub)}</span>` : ""}</a><span class="b">${esc(i.badge ?? "")}</span></li>`).join("")}</ul>`;
  }
  return `<section class="${cls}"><h2><span class="icon">${esc(w.icon ?? "•")}</span>${esc(w.title)}</h2>${body}</section>`;
}

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

async function load(refresh = false) {
  $("#status").textContent = "Loading…";
  const r = await fetch(`/api/dashboard?u=${encodeURIComponent(user)}${refresh ? "&refresh=1" : ""}`);
  data = await r.json();
  if (data.error) { $("#grid").innerHTML = `<p class="err">${esc(data.error)}</p>`; return; }

  const p = themePrefs();
  applyTheme(p.theme || data.theme, p.accent ?? data.accent);
  document.title = `${data.user} · Life Dashboard`;
  $("#greeting").textContent = greeting(data.user);
  $("#date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  $("#grid").innerHTML = data.widgets.map(widget).join("");
  $("#status").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  loadBrief();
}

async function loadUsers() {
  const names = await (await fetch("/api/users")).json();
  $("#user").innerHTML = names.map((n) => `<option value="${n}" ${n === user ? "selected" : ""}>${n}</option>`).join("");
}
$("#user").onchange = (e) => { user = e.target.value; localStorage.setItem("ld:user", user); history.replaceState(null, "", `?u=${user}`); load(); };
$("#refresh").onclick = () => load(true);

loadUsers().then(() => load());
setInterval(() => load(), 10 * 60 * 1000);
