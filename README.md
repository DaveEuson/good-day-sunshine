# Good Day Sunshine ☀

One page, first thing in the morning. Calendar, weather, inbox, top stories, GitHub, YouTube, Twitch, whatever needs your attention. 7-day deltas and sparklines. A local-AI brief and a local-AI chat. A garden you water once a day. Runs on your machine, shows on any screen. Zero npm dependencies.

## Run

```bash
cp .env.example .env   # fill in keys you have; missing ones show a setup hint
npm start              # http://localhost:4242 (bound to 0.0.0.0 so other screens on the LAN can open it)
npm run check          # tests
```

GitHub and attention work with no setup if `gh auth login` has been run. Weather needs nothing (Open-Meteo; no location → IP lookup). Top stories need nothing (RSS). AI needs [Ollama](https://ollama.com) running; if it is down, the brief falls back to a template and chat reports an error.

## Install (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scriptsinstall.ps1
```

Installs Node if missing (winget), puts a sun in the tray, starts at login, and opens your page. Tray menu: Open, Options, TV mode, Start at login, Open page when I start, Quit. Uninstall with `-Uninstall`. Nothing else is installed; it is a PowerShell tray around `node server.js`.

## First run: the wake-up wizard

An empty install, a profile without `onboarded: true`, `?setup=1`, or "+ New person" in the profile menu opens the wizard: one question at a time, conversational ("Do you manage a Twitch stream?"), details only for what you said yes to, look/quiet hours/sounds/local model at the end. It writes the same profile + keys the options menu does, plants your first seed, and hands you your page. Everything it asked is editable later in ⚙.

## Browser extension

`extension/` is a Manifest V3 new-tab override: every new tab is your page, with a "not running" screen if the server is down. Load unpacked (chrome://extensions → Developer mode → Load unpacked → the `extension` folder) in Chrome, Edge, Brave. Server address in the extension options. Icons come from `node scripts/make-icons.js`.

## Your own page

Click ⚙ (or press `o`). Everything is there: name, theme, accent, brief, sounds, quiet hours, display cycle, the widget list (tick to show, ▲▼ to order, per-widget fields), Ollama URL + models, and API keys. Profile saves to `config/users/<you>.json`; keys and models save to `.env` (mode 600, never sent back to the browser). Keys/profile edits are accepted only from the machine running the server unless `ADMIN_FROM_LAN=1`. Or copy `config/users/_template.json` by hand. Open `?u=<you>` or use the profile picker. Theme/accent overrides from the header picker are saved per profile in the browser only.

### Widgets

| type | options | needs |
|---|---|---|
| `attention` | – | GitHub token with `notifications` scope (`gh` works) |
| `calendar` | `ics`, `days`, `max` | `CALENDAR_ICS` private iCal URL(s), comma separated. Google: calendar settings → "Secret address in iCal format". No OAuth. |
| `weather` | `city` or `lat`/`lon`, `units` (`c`/`f`) | nothing |
| `email` | `user`, `max` | `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google → Security → 2-Step → App passwords) |
| `news` | `feeds` [urls], `perFeed`, `max` | nothing. Default: HN front page, BBC World, Ars Technica |
| `garden` | – | nothing |
| `github` | `user`, `top` | `GITHUB_TOKEN` or `gh` (traffic needs push access) |
| `youtube` | `channelId` | `YOUTUBE_API_KEY` |
| `twitch` | `login` | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`; followers need `TWITCH_USER_TOKEN` |

Any widget accepts `title` (rename) and `key` (pin its history across config edits; default: type).

### Add a widget type

Create `providers/<name>.js` exporting `meta = { title, icon }` and `fetchData(cfg, env)` returning

```js
{ stats: [{ label, value, sub? }], items: [{ text, url?, badge?, sub? }], attention: [{ text, url, level }] }
```

Register it in `providers/index.js` (and add an `OPTION_HINTS` entry so the options menu shows a placeholder). Done.

### Themes

`public/themes.js`. One object per theme, six CSS variables (+ optional `page` gradient). `locked: true` themes are bought with garden tokens; costs in `garden.js`.

## Deltas + sparklines

Every fresh fetch appends numeric stats to `data/history.jsonl`. Stats show ▲/▼ vs 7 days ago (or vs the oldest sample ≥1 day old) and a 14-day sparkline once there is more than one day of data. 90-day retention.

## Garden

Check in once a day → 10 tokens + streak bonus (up to +20). Come back ≥1 h later → +2, up to 5×/day. Plant a seed, water once a day (+3); each watering grows a stage. Miss 3 days → wilts and loses a stage. Fully grown → harvest for a bonus. Spend tokens on seeds (Sunflower 30 → Dragon fruit 400) and locked themes (Aurora 80, Sakura 120, Gold 300). State: `data/garden/<user>.json`. Tuning: constants at the top of `garden.js`. Sounds are WebAudio blips, no files (toggle in options).

## AI

- **Brief**: `OLLAMA_MODEL` (default `qwen3.5:9b`) writes three sentences from the live data, in the tone you picked, aware of what you said steals your day. Cached 5 min.
- **Chat**: 💬 or `c`. Streams from `CHAT_MODEL` (default `llama3.2:3b`) with the current dashboard as system context. Nothing leaves the machine.

## Displays

| where | how |
|---|---|
| Desktop browser | `http://host:4242/?u=dave` |
| TV / big monitor | `?mode=tv` — no controls, big type, clock. |
| Small always-on panel (3–7") | `?mode=small` — one card at a time, cycles every `display.cycleSec` (options menu), tap to advance. |
| Night | Set quiet hours in options. Screen goes black with a dim clock; tap to wake for 3 min. A black LCD still backlights, so for true dark put the panel on DPMS/`vcgencmd display_power 0` from cron. |

### Raspberry Pi 5 / Jetson (HDMI display)

```bash
sudo apt install -y chromium-browser
git clone <this repo> ~/good-day-sunshine
~/good-day-sunshine/scripts/kiosk.sh http://<your-pc-ip>:4242 tv dave     # or: small
```

Boot on start: edit the host/mode/user in `scripts/kiosk.service`, then

```bash
mkdir -p ~/.config/systemd/user && cp ~/good-day-sunshine/scripts/kiosk.service ~/.config/systemd/user/
systemctl --user enable --now kiosk && loginctl enable-linger $USER
```

The Pi/Jetson can also *run* the server (`node server.js`, Node ≥ 20) and Ollama; a Jetson runs `llama3.2:3b` fine, a Pi 5 is slow but works for the brief.

### Waveshare and other cheap panels

- **HDMI LCDs (Waveshare 4.3"/5"/7" HDMI, 800×480)**: plug into the Pi, use `?mode=small`. Nothing else.
- **SPI/DSI LCDs (Waveshare 3.5" RPi LCD, 4" DSI)**: same, once the driver overlay is set up.
- **E-paper (Waveshare 7.5" / 4.2" / 2.13" HAT)**: no browser. `scripts/epaper.py` pulls `/api/summary` and draws it with PIL; cron it every 10–15 min. Pass the panel module name (`epd7in5_V2` etc.) as the third argument to push to the panel; without it, it writes `summary.png` so you can preview on any machine.
- **ESP32 boards (Waveshare ESP32-S3-Touch-LCD-4.3/7, ~$30–45, or the ClaudeTrackerPi build)**: poll `GET /api/summary?u=dave` (small JSON: greeting, stats, attention lines, headlines, garden) and draw with LVGL. No HTML, no JS, one HTTP GET.
- **Cheapest full-page option**: Pi Zero 2 W + Waveshare 7" HDMI, runs `?mode=small` in Chromium.

`/api/summary` is stable and small on purpose; build any display on it.

## API

- `GET /api/dashboard?u=<user>[&refresh=1]` – all widget data + config (5 min cache)
- `GET /api/summary?u=<user>` – compact JSON for tiny displays
- `GET /api/catalog` – widget types for the options menu
- `GET /api/users` · `PUT /api/users/<name>` – list / save a profile
- `POST /api/brief` – `{ widgets, name, tone }` → `{ text }`
- `POST /api/chat` – `{ messages, widgets, name }` → NDJSON stream
- `POST /api/garden/{water|harvest|plant|buy}?u=` – `{ seed }` / `{ kind, id }` → `{ garden }`

Keys: `r` refresh · `c` chat · `o` options.

## License

MIT
