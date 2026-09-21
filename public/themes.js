// Theme presets. Each is a set of CSS variables. Add one → appears in picker.
// `locked: true` themes are bought with garden tokens (costs live in garden.js THEME_COSTS).
window.THEMES = {
  sunrise:  { name: "Sunrise",  bg: "#fff7ea", page: "linear-gradient(180deg,#ffe9c7 0%,#fff7ea 38%,#fffdf8 100%)", card: "#ffffff", text: "#2a1d10", muted: "#8a7457", accent: "#f07f1f", border: "#f3e2c8", font: "system-ui, -apple-system, Segoe UI, sans-serif" },
  sky:      { name: "Sky",      bg: "#eef6ff", page: "linear-gradient(180deg,#d9ecff 0%,#eef6ff 45%,#ffffff 100%)", card: "#ffffff", text: "#0f1f33", muted: "#5f7690", accent: "#1e88e5", border: "#d6e6f7", font: "system-ui, sans-serif" },
  midnight: { name: "Midnight", bg: "#0b1020", card: "#131a2e", text: "#e6e9f2", muted: "#8b93ad", accent: "#7aa2ff", border: "#222b47", font: "system-ui, -apple-system, Segoe UI, sans-serif" },
  paper:    { name: "Paper",    bg: "#f6f3ec", card: "#ffffff", text: "#1e1c18", muted: "#7a756b", accent: "#c2410c", border: "#e6e1d6", font: "Georgia, 'Iowan Old Style', serif" },
  forest:   { name: "Forest",   bg: "#0f1a14", card: "#16241c", text: "#e3efe6", muted: "#8aa693", accent: "#5ad27d", border: "#243a2e", font: "system-ui, sans-serif" },
  ember:    { name: "Ember",    bg: "#1a0f0f", card: "#261515", text: "#f5e9e6", muted: "#b08d86", accent: "#ff7a45", border: "#3d2424", font: "system-ui, sans-serif" },
  terminal: { name: "Terminal", bg: "#000000", card: "#0a0f0a", text: "#b8f5b8", muted: "#5f8f5f", accent: "#39ff14", border: "#1f3a1f", font: "ui-monospace, Consolas, monospace" },
  slate:    { name: "Slate",    bg: "#eef1f5", card: "#ffffff", text: "#111827", muted: "#6b7280", accent: "#2563eb", border: "#dfe3ea", font: "Inter, system-ui, sans-serif" },
  aurora:   { name: "Aurora",   bg: "#0c1528", page: "linear-gradient(160deg,#0a0f1f 0%,#10203a 45%,#0b2a2a 100%)", card: "rgba(20,30,55,.75)", text: "#e8f4ff", muted: "#8fb3c9", accent: "#5ee6c8", border: "#22405a", font: "system-ui, sans-serif", locked: true },
  sakura:   { name: "Sakura",   bg: "#fff5f7", card: "#ffffff", text: "#3b1f2b", muted: "#a07a8a", accent: "#e8548a", border: "#f5d5de", font: "'Segoe UI', system-ui, sans-serif", locked: true },
  gold:     { name: "Gold",     bg: "#0e0c08", card: "#1a1610", text: "#f5ecd7", muted: "#a8996f", accent: "#f2c14e", border: "#3a3220", font: "Georgia, serif", locked: true },
};
