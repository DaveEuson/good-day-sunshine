# Prompt for Claude Design

Paste everything below the line. Attach two screenshots of the current page (top and scrolled) and, if it accepts files, `public/styles.css` and `public/themes.js`.

---

Redesign the visual layer of **Good Day Sunshine**, a personal "first thing in the morning" dashboard. One page, opens on login, also lives as the browser new-tab page, and runs on a TV and on 5–7" always-on panels. Vanilla HTML/CSS/JS, no framework. I want a design system and mockups I can implement straight into CSS.

## What the page is for

The reader has just woken up and has ADHD. In under five seconds they must know: what needs me, what's first today, what changed since yesterday. Everything else is secondary. The page should feel like morning light, not a SaaS analytics tool.

## Fixed structure (don't reinvent)

- Header: greeting ("Good morning, Dave."), date, one summary line ("24°C clear · next: 10:30 standup · 3 need you (1 urgent)"), and a control cluster (tokens pill, profile, theme, accent, refresh, chat, options).
- AI brief: 1–3 sentences, only what's new or needs a decision.
- Card grid, each card = one source: Needs attention (GitHub notifications/reviews), Calendar, Weather, Inbox, Garden (a plant you water once a day; tokens, streak, seed shop), Top stories, GitHub stats, YouTube, Twitch. Cards have: title row with icon, big-number stats with ▲▼ 7-day delta and a tiny sparkline, a list of items (text + caption + optional badge), and for attention items a red/orange/grey dot.
- Bottom strip: "Not set up yet: YouTube, Twitch · Add keys".
- Overlays: chat drawer (bottom-right), options dialog, a full-screen wake-up wizard (one question per card), a quiet-hours night screen (black, dim clock).

## Constraints

- Every color comes from 7 CSS variables per theme: `--bg`, `--page` (optional gradient), `--card`, `--text`, `--muted`, `--accent`, `--border`, plus `--font`. Themes are user-selectable and some are unlocked with garden tokens. Design must hold in all of: Sunrise (warm cream, orange), Sky (pale blue), Midnight (navy), Paper (serif, cream), Forest, Ember, Terminal (green on black), Aurora (gradient), Sakura, Gold. Show at least Sunrise, Midnight, Terminal.
- Three layouts from the same CSS: desktop grid; `tv` (3 m viewing distance, no controls, 1.4× type); `small` (800×480, one card at a time, cycles).
- No images, no icon fonts. Unicode glyphs or inline SVG only. System font stack unless a theme specifies one.
- Accessible: 4.5:1 text contrast in every theme, focus rings, nothing conveyed by color alone (the attention dots also need shape or text).
- Motion: subtle, ≤250 ms, respects `prefers-reduced-motion`.

## What I want back

1. **Hierarchy pass**: how the header, summary line, brief, and the first card row should differ in weight so the "what needs me" answer reads first. Type scale (px), spacing scale, card padding, radius, shadow or border decision.
2. **Card anatomy**: one spec for the card that all nine sources share, with states: normal, has-urgent (must be visible from across a room), empty ("nothing needs you"), error, and setup-needed (collapsed).
3. **Stat tile**: number + label + delta + sparkline. Make the delta readable but not shouting.
4. **Garden card**: the one playful element. Plant art is emoji today; propose a better treatment that still costs zero assets (CSS shapes or inline SVG), the growth-stage dots, the water button, and the seed/theme shop.
5. **Brief**: it's a paragraph in a bordered box today. Make it feel like a note from a person, not a system message.
6. **TV and small variants** of the top of the page.
7. **Two new themes** in the same variable scheme, one light, one dark, with hex values.

Deliver as annotated mockups plus a CSS token table I can paste. Prefer fewer, stronger decisions over options. If something in the current page is fine, say so and leave it.
