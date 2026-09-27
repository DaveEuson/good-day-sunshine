// Phone layout (Claude Design handoff): under 700 px wide, a bottom tab bar splits the page into
// Today · Updates · Garden · Chat, one screen each, instead of one very long column.
// TV and small-panel modes keep their own layouts.
(() => {
  const $ = (s) => document.querySelector(s);
  const TAB_OF = {
    attention: "today", routine: "today", noticed: "today", calendar: "today", weather: "today",
    email: "updates", news: "updates", github: "updates", youtube: "updates", twitch: "updates", credits: "updates", ai: "updates",
    garden: "garden",
  };
  const TABS = [["today", "Today", "☀"], ["updates", "Updates", "▤"], ["garden", "Garden", "❀"], ["chat", "Chat", "✳"]];
  const mq = window.matchMedia("(max-width: 699px)");
  const mode = new URLSearchParams(location.search).get("mode");
  let tab = (() => { try { return localStorage.getItem("gds:phone-tab") || "today"; } catch { return "today"; } })();

  const bar = document.createElement("nav");
  bar.className = "phone-tabs";
  bar.setAttribute("aria-label", "Sections");
  bar.innerHTML = TABS.map(([id, label, glyph]) => `<button type="button" data-ptab="${id}"><span class="g" aria-hidden="true">${glyph}</span><span>${label}</span><i class="badge" hidden></i></button>`).join("");
  document.body.appendChild(bar);

  function apply() {
    const phone = mq.matches && !mode;
    document.body.classList.toggle("phone", phone);
    document.body.dataset.ptab = phone ? tab : "";
    bar.hidden = !phone;
    const ft = $("#focus-toggle"); if (ft) ft.textContent = phone ? "Focus" : "Just one thing";
    for (const b of bar.querySelectorAll("[data-ptab]")) b.setAttribute("aria-current", String(b.dataset.ptab === tab));
    // cards: show the ones that belong to this tab (unknown types go to Updates)
    for (const card of document.querySelectorAll("#grid > .widget")) card.hidden = phone && (TAB_OF[card.dataset.type] ?? "updates") !== tab;
    // chat is a whole tab on phones; an empty chat offers the same starters as the desktop ask bar
    if (phone) $("#chat").hidden = tab !== "chat";
    const log = $("#chat-log");
    if (phone && tab === "chat" && log && !log.querySelector(".msg")) {
      log.innerHTML = `<div class="starters"><p class="muted">Ask about your day, or tap one:</p>${[...document.querySelectorAll(".ask-chips [data-ask]")].map((b) => `<button type="button" data-start="${b.dataset.ask.replace(/"/g, "&quot;")}">${b.textContent}</button>`).join("")}</div>`;
    }
    // badges: urgent things on Today, new mail on Updates, unwatered plant on Garden
    const ws = window.data?.widgets ?? [];
    const urgent = ws.flatMap((w) => w.attention ?? []).filter((a) => a.level === "high").length + ws.filter((w) => w.status === "error").length;
    const mail = ws.find((w) => w.type === "email")?.mail;
    const plant = ws.find((w) => w.type === "garden")?.garden?.plantView;
    badge("today", urgent ? String(urgent) : "", true);
    badge("updates", mail?.recent ? (mail.recentCapped ? "20+" : String(mail.recent)) : "");
    badge("garden", plant && !plant.wateredToday && !plant.ready ? "•" : "");
  }
  function badge(id, text, alert = false) {
    const i = bar.querySelector(`[data-ptab="${id}"] .badge`);
    i.hidden = !text; i.textContent = text; i.classList.toggle("alert", alert);
  }
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ptab]");
    if (!b) return;
    tab = b.dataset.ptab;
    try { localStorage.setItem("gds:phone-tab", tab); } catch {}
    apply();
    window.scrollTo({ top: 0 });
    if (tab === "chat") $("#chat-input")?.focus();
  });
  mq.addEventListener("change", () => { if (!mq.matches) $("#chat").hidden = true; apply(); });
  window.phoneLayout = apply;   // app.js calls this after every render
  window.phoneTab = (t) => { tab = t; apply(); };
  apply();
})();
document.getElementById("chat-log")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-start]");
  if (!b) return;
  document.querySelector("#chat-log .starters")?.remove();
  document.getElementById("chat-input").value = b.dataset.start;
  document.getElementById("chat-form").requestSubmit();
});
