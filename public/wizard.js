// "Wake up" wizard: first-run onboarding, one conversational question at a time. Runs when a profile
// has no `onboarded: true`, on ?setup=1, or from "+ New person" in the profile menu.
// Answers land in config/users/<slug>.json (+ keys in .env) via the normal API, so everything is
// editable later from ⚙ Options.
window.runWizard = async function runWizard({ existing = null, onDone }) {
  const $w = document.getElementById("wizard");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const a = { alarm: existing?.alarm ?? null, name: existing?.name ?? "", character: existing?.character ?? "sun", tone: existing?.brief?.tone ?? "", focus: existing?.brief?.focus ?? "", w: {}, keys: {}, theme: existing?.theme ?? "sunrise", quiet: existing?.quiet ?? null, sound: existing?.sound ?? true, model: null };
  for (const x of existing?.widgets ?? []) a.w[x.type] = { ...x };
  let models = null;
  try { models = await (await fetch("/api/models")).json(); } catch {}

  const v = (s) => document.querySelector(s)?.value ?? "";
  const picked = () => document.querySelector(".wz-choice.on")?.dataset.v ?? "";
  const choices = (opts, cur) => `<div class="wz-choices">${opts.map(([label, val]) => `<button type="button" class="wz-choice ${val === cur ? "on" : ""}" data-v="${esc(val)}">${esc(label)}</button>`).join("")}</div>`;
  const yesno = (cur) => choices([["Yes", "1"], ["No", ""]], cur ? "1" : "");
  const text = (id, ph, val = "", type = "text") => `<input id="${id}" class="wz-text" type="${type}" placeholder="${esc(ph)}" value="${esc(val)}" autocomplete="off">`;
  const on = (t) => !!a.w[t];
  const yn = (t, extra = {}) => () => { if (picked()) a.w[t] ??= { ...extra }; else delete a.w[t]; };

  // Each step: { q, sub?, render, read, when?, skip? }. q can be a function of the answers so far.
  const steps = [
    { q: "Good day. What should I call you?", render: () => text("wz-in", "your name", a.name), read: () => { a.name = v("#wz-in").trim(); if (!a.name) throw "I need something to call you."; } },
    { q: () => `Morning, ${a.name}. Who should greet you?`, sub: "Changes the voice and the face, never the facts.", render: () => `<div class="wz-themes">${Object.entries(CHARACTERS).map(([id, n]) => `<button type="button" class="wz-theme wz-char ${a.character === id ? "on" : ""}" data-char="${id}"><img src="${faceURI(id, false, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), THEMES[document.documentElement.dataset.theme]?.card || "#fff")}" width="44" height="44" alt=""> ${n}</button>`).join("")}</div>`, read: () => {} },
    { q: () => `How should I talk to you first thing?`, render: () => choices([["Warm and steady", "warm, steady, encouraging"], ["Direct and efficient", "direct, efficient, no fluff"], ["Playful but useful", "playful, light, still useful"], ["A little dry", "warm, concise, a little dry"]], a.tone), read: () => { a.tone = picked() || "warm, concise"; } },
    { q: "What usually steals your day?", sub: "I'll keep it in mind when I write your brief.", render: () => choices([["Context switching", "context switching"], ["Avoidance", "avoiding the hard thing"], ["Too many tabs", "too many tabs and threads"], ["Meetings", "meetings eating the morning"], ["Nothing in particular", ""]], a.focus), read: () => { a.focus = picked(); } },

    { q: "Do you write code on GitHub?", sub: "I'll show stars, traffic, and anything waiting on you: reviews, mentions, assignments.", render: () => yesno(on("github")), read: () => { yn("github", { top: 6 })(); if (picked()) a.w.attention ??= {}; else delete a.w.attention; } },
    { when: () => on("github"), q: "What's your GitHub login?", render: () => text("wz-in", "octocat", a.w.github?.user), read: () => { a.w.github.user = v("#wz-in").trim(); if (!a.w.github.user) throw "I need the login to look you up."; } },

    { q: "Do you run a YouTube channel?", render: () => yesno(on("youtube")), read: yn("youtube") },
    { when: () => on("youtube"), skip: true, q: "Which channel, and do you have a Data API key?", sub: "Channel id starts with UC (YouTube Studio → Settings → Channel → Advanced). Key from Google Cloud → YouTube Data API v3. Skip and add it later in Options if you like.", render: () => text("wz-in", "UC…") + text("wz-in2", "API key", "", "password"), read: () => { const c = v("#wz-in").trim(), k = v("#wz-in2").trim(); if (c) a.keys.YOUTUBE_CHANNEL_ID = c; if (k) a.keys.YOUTUBE_API_KEY = k; } },

    { q: "Do you manage a Twitch stream?", render: () => yesno(on("twitch")), read: yn("twitch") },
    { when: () => on("twitch"), skip: true, q: "What's the channel? And an app client id + secret if you have one.", sub: "dev.twitch.tv → Console → Register application. Without it I can only show the setup hint.", render: () => text("wz-in", "your channel") + text("wz-in2", "client id") + text("wz-in3", "client secret", "", "password"), read: () => { const l = v("#wz-in").trim(), i = v("#wz-in2").trim(), s = v("#wz-in3").trim(); if (l) a.keys.TWITCH_LOGIN = l; if (i) a.keys.TWITCH_CLIENT_ID = i; if (s) a.keys.TWITCH_CLIENT_SECRET = s; } },

    { q: "Want your calendar on the page?", sub: "Next events and your first meeting.", render: () => yesno(on("calendar")), read: yn("calendar") },
    { when: () => on("calendar"), skip: true, q: "Paste a private iCal link.", sub: "Google Calendar → Settings → your calendar → \"Secret address in iCal format\". Outlook and others work too. Or skip for now.", render: () => text("wz-in", "https://calendar.google.com/calendar/ical/…/basic.ics"), read: () => { const u = v("#wz-in").trim(); if (u) a.keys.CALENDAR_ICS = u; } },

    { q: "Should I count your unread mail?", sub: "Gmail only, for now.", render: () => yesno(on("email")), read: yn("email") },
    { when: () => on("email"), skip: true, q: "Gmail address and an app password.", sub: "Google Account → Security → 2-Step Verification → App passwords. It never leaves this machine.", render: () => text("wz-in", "you@gmail.com") + text("wz-in2", "app password", "", "password"), read: () => { const u = v("#wz-in").trim(), p = v("#wz-in2").trim(); if (u && p) { a.keys.GMAIL_USER = u; a.keys.GMAIL_APP_PASSWORD = p; } } },

    { q: "Want the weather?", render: () => yesno(on("weather")), read: yn("weather", { units: "c" }) },
    { when: () => on("weather"), q: "Where are you?", sub: "City name. Leave it blank and I'll guess from your network.", render: () => text("wz-in", "San Diego", a.w.weather?.city) + `<div class="wz-row">${choices([["°C", "c"], ["°F", "f"]], a.w.weather?.units ?? "c")}</div>`, read: () => { const c = v("#wz-in").trim(); a.w.weather = { ...(c ? { city: c } : {}), units: picked() || "c" }; } },

    { q: "A few headlines with your coffee?", sub: "Hacker News, BBC, Ars by default. Change the feeds later in Options.", render: () => yesno(on("news")), read: yn("news", { max: 8 }) },
    { q: "Want a little plant to water every day?", sub: "Checking in earns tokens. Tokens unlock seeds and themes.", render: () => yesno(on("garden")), read: yn("garden") },

    { q: "Pick a look.", sub: "Tap to try it on.", render: () => `<div class="wz-themes">${Object.entries(THEMES).filter(([, t]) => !t.locked).map(([k, t]) => `<button type="button" class="wz-theme ${k === a.theme ? "on" : ""}" data-theme="${k}" style="background:${t.card};color:${t.text};border-color:${k === a.theme ? t.accent : t.border}"><span style="color:${t.accent}">●</span> ${esc(t.name)}</button>`).join("")}</div>`, read: () => {} },
    { q: "When should the screen go dark?", sub: "Quiet hours. Tap the screen to wake it for a few minutes.", render: () => choices([["Never", ""], ["22:00 – 07:00", "22:00-07:00"], ["23:00 – 06:00", "23:00-06:00"], ["00:00 – 08:00", "00:00-08:00"]], a.quiet ? `${a.quiet.start}-${a.quiet.end}` : ""), read: () => { const p = picked(); a.quiet = p ? { start: p.split("-")[0], end: p.split("-")[1] } : null; } },
    { q: "Should this screen wake you up?", sub: "It brightens slowly over ten minutes before the time, then a soft chime. Weekdays. Snooze gives you the short version.", render: () => choices([["No alarm", ""], ["06:30", "06:30"], ["07:00", "07:00"], ["07:30", "07:30"], ["08:00", "08:00"]], a.alarm?.time ?? ""), read: () => { const t = picked(); a.alarm = t ? { time: t, days: [1, 2, 3, 4, 5], ramp: 10 } : null; } },
    { when: () => on("garden"), q: "Little sounds when the garden grows?", render: () => yesno(a.sound), read: () => { a.sound = !!picked(); } },
    { skip: true, q: "Have an Anthropic API key? Claude can write your brief and answer questions about your day.", sub: "console.anthropic.com → API keys. Stored on this machine only. Skip to use a local model, or none.", render: () => text("wz-in", "sk-ant-…", "", "password"), read: () => { const k = v("#wz-in").trim(); if (k) { a.keys.ANTHROPIC_API_KEY = k; a.model = "claude-opus-5"; a.chatModel = "claude-opus-5"; } } },
    { when: () => !a.keys.ANTHROPIC_API_KEY && models?.local, q: "I can write you a three-sentence brief each morning with a local model. Which one?", sub: `Found ${models?.local ?? 0} in Ollama. Nothing leaves this machine.`, render: () => choices([["Skip the brief", ""], ...models.models.filter((m) => !/^claude-/.test(m)).slice(0, 8).map((m) => [m, m])], a.model ?? models.brief), read: () => { a.model = picked(); } },
  ];

  let i = 0;
  function show() {
    const seq = steps.filter((s) => !s.when || s.when());
    if (i >= seq.length) return finish();
    const s = seq[i];
    $w.innerHTML = `
      <div class="wz-card">
        <div class="wz-step">${i + 1} / ${seq.length}</div>
        <h1>${esc(typeof s.q === "function" ? s.q() : s.q)}</h1>
        ${s.sub ? `<p class="hint">${esc(s.sub)}</p>` : ""}
        <div class="wz-body">${s.render()}</div>
        <div class="wz-nav">
          ${i > 0 ? `<button type="button" class="ghost" id="wz-back">Back</button>` : `<span></span>`}
          <span>${s.skip ? `<button type="button" class="ghost" id="wz-skip">Later</button>` : ""}<button type="button" id="wz-next">${i === seq.length - 1 ? "Wake up" : "Next"}</button></span>
        </div>
        <div class="err" id="wz-err"></div>
      </div>`;
    $w.hidden = false;
    $w.querySelector("#wz-in")?.focus();
    $w.onclick = (e) => {
      const c = e.target.closest(".wz-choice");
      if (c) { c.parentElement.querySelectorAll(".wz-choice").forEach((x) => x.classList.toggle("on", x === c)); if (c.closest(".wz-body")?.querySelectorAll(".wz-choices").length === 1 && !$w.querySelector(".wz-text")) next(); return; }
      const ch = e.target.closest(".wz-char");
      if (ch) { a.character = ch.dataset.char; $w.querySelectorAll(".wz-char").forEach((x) => x.classList.toggle("on", x === ch)); return; }
      const t = e.target.closest(".wz-theme");
      if (t) { a.theme = t.dataset.theme; applyTheme(a.theme, null); $w.querySelectorAll(".wz-theme").forEach((x) => x.classList.toggle("on", x === t)); return; }
      if (e.target.id === "wz-next") next();
      if (e.target.id === "wz-skip") { i++; show(); }
      if (e.target.id === "wz-back") { i--; show(); }
    };
    $w.onkeydown = (e) => { if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); next(); } };
    function next() { try { s.read(); i++; show(); } catch (err) { $w.querySelector("#wz-err").textContent = String(err); } }
  }

  async function finish() {
    $w.innerHTML = `<div class="wz-card"><h1>Setting things up…</h1></div>`;
    const slug = existing?.slug ?? (a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "me");
    const order = ["attention", "calendar", "weather", "email", "garden", "news", "github", "youtube", "twitch"];
    const widgets = order.filter((t) => a.w[t]).map((t) => ({ type: t, ...a.w[t] }));
    if (!widgets.length) widgets.push({ type: "weather", units: "c" }, { type: "news", max: 8 });
    const cfg = { ...(existing ?? {}), name: a.name, character: a.character, theme: a.theme, accent: existing?.accent ?? null, widgets, brief: { enabled: !!a.model || !!a.keys.ANTHROPIC_API_KEY || !models?.ok, tone: a.tone, ...(a.focus ? { focus: a.focus } : {}) }, sound: a.sound, quiet: a.quiet ?? undefined, alarm: a.alarm ?? undefined, display: existing?.display ?? { cycleSec: 12 }, onboarded: true };
    delete cfg.slug;
    try {
      let r = await (await fetch(`/api/users/${slug}`, { method: "PUT", body: JSON.stringify(cfg) })).json();
      if (r.error) throw new Error(r.error);
      const env = { ...a.keys, ...(a.model ? { OLLAMA_MODEL: a.model } : {}), ...(a.chatModel ? { CHAT_MODEL: a.chatModel } : {}) };
      if (Object.keys(env).length) { r = await (await fetch("/api/env", { method: "PUT", body: JSON.stringify(env) })).json(); if (r.error) throw new Error(r.error); }
      if (a.w.garden) await fetch(`/api/garden/plant?u=${slug}`, { method: "POST", body: JSON.stringify({ seed: "sprout" }) }).catch(() => {});
      $w.innerHTML = `<div class="wz-card"><h1>Good day, ${esc(a.name)}.</h1><p class="hint">${a.w.garden ? "Your first seed is in the ground. Water it tomorrow." : "Your page is ready."} Everything you told me is in ⚙ Options if you change your mind.</p><div class="wz-nav"><span></span><button type="button" id="wz-go">Open my page</button></div></div>`;
      $w.querySelector("#wz-go").onclick = () => onDone(slug);
    } catch (err) {
      $w.innerHTML = `<div class="wz-card"><h1>That didn't save.</h1><p class="err">${esc(err.message)}</p><p class="hint">Settings can only be saved from the machine running the server.</p><div class="wz-nav"><span></span><button type="button" id="wz-retry">Try again</button></div></div>`;
      $w.querySelector("#wz-retry").onclick = () => { i = 0; show(); };
    }
  }
  show();
};
