// Icons and the garden's plant drawings, as inline SVG. No emoji anywhere in the interface:
// emoji render differently on every device (and on the Pi's e-paper they are tofu); these follow the theme colours.
(() => {
  // 24 px grid, stroke icons. `currentColor` so they take the text/accent colour of whatever holds them.
  const P = {
    refresh: `<path d="M20 11a8 8 0 1 0-2.4 5.8"/><path d="M20 4.5V11h-6.5"/>`,
    chat: `<path d="M4.5 5.5h15v10.5H10l-5.5 4v-4h0z"/>`,
    sliders: `<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
    send: `<path d="M5 12h13M12.5 6l6 6-6 6"/>`,
    check: `<path d="M5 12.5l4.5 4.5L19 7"/>`,
    checkCircle: `<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.4l2.7 2.7 4.8-5.2"/>`,
    alert: `<path d="M12 4.2l9 15.6H3z"/><path d="M12 10v4.2M12 17.2v.1"/>`,
    spark: `<path d="M12 3c.7 4.7 2.6 6.6 7.2 7.2-4.6.6-6.5 2.5-7.2 7.2-.7-4.7-2.6-6.6-7.2-7.2C9.4 9.6 11.3 7.7 12 3z"/>`,
    coin: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/>`,
    flame: `<path d="M12 3.2c.9 3.4 5.2 5.4 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2.1 1-3.4 2.1-4.4.2 1.3.8 2.1 1.7 2.5C10.2 8.3 10.9 5.8 12 3.2z"/>`,
    drop: `<path d="M12 3.8c3.2 4.2 6.2 6.9 6.2 10.3a6.2 6.2 0 0 1-12.4 0c0-3.4 3-6.1 6.2-10.3z"/>`,
    lock: `<rect x="5.5" y="11" width="13" height="8.5" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/>`,
    sun: `<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/>`,
    cloud: `<path d="M7.5 18.5a4.2 4.2 0 0 1-.6-8.3 5.6 5.6 0 0 1 10.6 1.3 3.5 3.5 0 0 1-.4 7z"/>`,
    mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.5l7.5 6 7.5-6"/>`,
    news: `<path d="M5 5.5h11v13H7a2 2 0 0 1-2-2z"/><path d="M16 9.5h3v7a2 2 0 0 1-2 2M8.5 9h4.5M8.5 12.5h4.5"/>`,
    branch: `<circle cx="7" cy="5.8" r="2"/><circle cx="7" cy="18.2" r="2"/><circle cx="17" cy="9.5" r="2"/><path d="M7 7.8v8.4M17 11.5c0 3-3 3.2-8.2 4.6"/>`,
    play: `<rect x="3.5" y="6" width="17" height="12" rx="3.5"/><path d="M10.2 9.5v5l4.3-2.5z"/>`,
    broadcast: `<circle cx="12" cy="12" r="1.8"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.4 9.4 0 0 0 0 13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2"/>`,
    calendar: `<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>`,
    leaf: `<path d="M5 19c0-8 4.5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>`,
    bell: `<path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>`,
    dot: `<circle cx="12" cy="12" r="3"/>`,
    stack: `<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16L12 20.5l8.5-4.5"/>`,
    x: `<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
    arrowUp: `<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>`,
  };
  window.icon = (name, size = 18, cls = "") =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.dot}</svg>`;

  // widget type -> icon
  window.WIDGET_ICON = { attention: "bell", routine: "checkCircle", weather: "cloud", calendar: "calendar", email: "mail", news: "news", github: "branch", youtube: "play", twitch: "broadcast", garden: "leaf", ai: "spark", credits: "coin", noticed: "spark", claudeprojects: "stack", claudeleft: "chat" };
  window.widgetIcon = (type, size = 16) => icon(WIDGET_ICON[type] ?? "dot", size);

  window.hydrateIcons = (root = document) => {
    for (const el of root.querySelectorAll("[data-icon]:not([data-hydrated])")) {
      el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon, +el.dataset.size || 18));
      el.dataset.hydrated = "1";
    }
  };
  window.hydrateIcons();

  // ---------- plants ----------
  // plantSVG(seedId, stage, stageCount): one drawing per seed that grows with the stage; colours come from CSS (.pl-*).
  const leaf = (x, y, len, ang) => `<path class="pl-leaf" transform="translate(${x} ${y}) rotate(${ang})" d="M0 0Q${len * 0.5} ${-len * 0.42} ${len} 0Q${len * 0.5} ${len * 0.42} 0 0z"/>`;
  const petals = (x, y, n, r, w, cls = "pl-accent", off = 0) => Array.from({ length: n }, (_, i) => `<ellipse class="${cls}" cx="${x}" cy="${y - r}" rx="${w}" ry="${r * 0.62}" transform="rotate(${off + (360 / n) * i} ${x} ${y})"/>`).join("");
  const BASE = 82, CX = 48;

  function drawPlant(seed, p) {
    const h = 12 + 42 * p, top = BASE - h;
    const stem = (bend = 0) => `<path class="pl-stem" d="M${CX} ${BASE}Q${CX + bend} ${BASE - h * 0.55} ${CX + bend * 0.5} ${top}"/>`;
    const sideLeaves = (n, size) => Array.from({ length: n }, (_, i) => { const y = BASE - h * (0.3 + i * 0.2); return i % 2 ? leaf(CX, y, size, -150) : leaf(CX, y, size, -30); }).join("");
    const nLeaves = Math.min(4, 1 + Math.round(p * 3)), lsz = 11 + 8 * p;
    const full = p >= 1;
    switch (seed) {
      case "sunflower": {
        const head = p < 0.55 ? "" : full
          ? petals(CX, top - 6, 13, 13, 4.6) + `<circle class="pl-disc" cx="${CX}" cy="${top - 6}" r="7.5"/>`
          : `<circle class="pl-accent" cx="${CX}" cy="${top - 3}" r="${4 + 4 * p}"/>`;
        return stem() + sideLeaves(nLeaves, lsz) + head;
      }
      case "tulip": {
        const s = p < 0.5 ? 0 : full ? 1 : 0.62;
        const cup = s ? `<g transform="translate(${CX} ${top}) scale(${s})"><path class="pl-accent" d="M-9 -16Q-10 4 0 6Q10 4 9 -16L4.5 -9 0 -18 -4.5 -9z"/></g>` : "";
        return stem() + leaf(CX, BASE - h * 0.12, 24 + 10 * p, -62) + leaf(CX, BASE - h * 0.12, 22 + 8 * p, -118) + cup;
      }
      case "cactus": case "dragonfruit": {
        const bh = 12 + 40 * p, w = seed === "cactus" ? 20 : 15, y = BASE - bh;
        const arms = p > 0.4 ? `<path class="pl-leaf" d="M${CX - w / 2} ${BASE - bh * 0.5}h-9a5 5 0 0 1-5-5v-9a4.5 4.5 0 0 1 9 0v6h5z"/>` + (p > 0.7 ? `<path class="pl-leaf" d="M${CX + w / 2} ${BASE - bh * 0.62}h8a5 5 0 0 0 5-5v-6a4.5 4.5 0 0 0-9 0v3h-4z"/>` : "") : "";
        const body = `<rect class="pl-leaf" x="${CX - w / 2}" y="${y}" width="${w}" height="${bh}" rx="${w / 2}"/><path class="pl-rib" d="M${CX} ${y + 5}V${BASE}"/>`;
        const bloom = !full ? "" : seed === "cactus" ? petals(CX, y + 1, 6, 6, 2.6) + `<circle class="pl-spot" cx="${CX}" cy="${y + 1}" r="2"/>`
          : `<g transform="translate(${CX} ${y - 4})"><ellipse class="pl-accent" rx="11" ry="13"/><path class="pl-leaf" d="M-11 -2l-6-3 5 8zM11 -2l6-3-5 8zM-8 7l-6 2 7 2zM8 7l6 2-7 2zM0 -13l-3-6 6 0z"/></g>`;
        return arms + body + bloom;
      }
      case "mushroom": {
        const one = (x, s) => `<g transform="translate(${x} ${BASE}) scale(${s})"><rect class="pl-seed" x="-5" y="-22" width="10" height="22" rx="4"/><path class="pl-accent" d="M-22 -20a22 17 0 0 1 44 0z"/><circle class="pl-spot" cx="-8" cy="-27" r="2.6"/><circle class="pl-spot" cx="6" cy="-31" r="2.2"/><circle class="pl-spot" cx="13" cy="-24" r="1.8"/></g>`;
        const s = 0.45 + 0.65 * p;
        return one(CX, s) + (p >= 0.5 ? one(CX - 24, s * 0.55) : "") + (p >= 0.8 ? one(CX + 24, s * 0.45) : "");
      }
      case "bonsai": {
        const th = 14 + 30 * p, ty = BASE - 8 - th, c = (x, y, r) => `<ellipse class="pl-leaf" cx="${x}" cy="${y}" rx="${r * 1.35}" ry="${r}"/>`;
        const canopy = c(CX, ty, 6 + 10 * p) + (p > 0.35 ? c(CX - 14 * p, ty + 6, 5 + 6 * p) : "") + (p > 0.6 ? c(CX + 15 * p, ty + 4, 5 + 7 * p) : "") + (full ? c(CX + 2, ty - 10, 8) : "");
        return `<path class="pl-trunk" d="M${CX} ${BASE - 8}Q${CX - 6} ${BASE - 8 - th * 0.5} ${CX} ${ty + 2}"/>` + canopy + `<path class="pl-pot" d="M30 ${BASE - 8}h36l-4 14H34z"/>`;
      }
      case "lotus": {
        const water = `<ellipse class="pl-water" cx="${CX}" cy="${BASE + 2}" rx="34" ry="8"/><ellipse class="pl-leaf" cx="${CX - 22}" cy="${BASE}" rx="${6 + 6 * p}" ry="3"/>`;
        if (p < 0.34) return water;
        const r = 7 + 12 * p, y = BASE - 4;
        return water + petals(CX, y, p > 0.7 ? 9 : 5, r, 4.2 + 2 * p, "pl-accent", p > 0.7 ? 0 : 36) + (full ? petals(CX, y, 5, r * 0.62, 3.6, "pl-spot", 0) : "") + `<circle class="pl-disc" cx="${CX}" cy="${y}" r="2.6"/>`;
      }
      default: {   // sprout
        const crown = full ? leaf(CX, top, 24, -48) + leaf(CX, top, 24, -132) : p > 0.2 ? leaf(CX, top, 12 + 10 * p, -50) + leaf(CX, top, 12 + 10 * p, -130) : "";
        return stem(3) + (p > 0.5 ? sideLeaves(Math.min(2, nLeaves), lsz) : "") + crown;
      }
    }
  }

  window.plantSVG = (seed, stage, stages, { wilted = false, size = 84, label = "" } = {}) => {
    const p = stages > 1 ? Math.max(0, Math.min(1, stage / (stages - 1))) : 1;
    const soil = seed === "lotus" || seed === "mushroom" ? "" : `<ellipse class="pl-soil" cx="${CX}" cy="${BASE + 3}" rx="29" ry="6"/>`;
    const body = stage <= 0 ? `<ellipse class="pl-seed" cx="${CX}" cy="${BASE - 3}" rx="5" ry="7" transform="rotate(-24 ${CX} ${BASE - 3})"/>` : drawPlant(seed, p);
    return `<svg class="plant-svg ${wilted ? "wilted" : ""}" viewBox="0 0 96 96" width="${size}" height="${size}" role="img" aria-label="${label || seed}">${soil}${body}</svg>`;
  };
})();