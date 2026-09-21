# Life Dashboard

One page. Your GitHub, YouTube, Twitch, and whatever needs your attention, with a local-AI "good morning" brief. Zero npm dependencies.

## Run

```bash
cp .env.example .env   # fill in keys you have; missing ones show a setup hint
npm start              # http://localhost:4242
```

GitHub works with no setup if `gh auth login` has been run. The brief uses local Ollama (`qwen3.5:9b` default); if Ollama is down it falls back to a templated sentence.

## Good-morning screen (Windows)

```powershell
.\scripts\install-logon.ps1
```

Starts the server at logon and opens the dashboard. Linux/macOS: add `node server.js &` and `xdg-open http://localhost:4242` to your login items.

## Your own page

1. Copy `config/users/_template.json` → `config/users/<you>.json`.
2. Pick widgets, theme, accent. Open `http://localhost:4242/?u=<you>` or use the profile picker.
3. Theme and accent overrides from the picker are saved per profile in the browser.

### Widget config

| type | fields | needs |
|---|---|---|
| `github` | `user`, `top` | `GITHUB_TOKEN` or `gh` (traffic needs push access) |
| `youtube` | `channelId` | `YOUTUBE_API_KEY` |
| `twitch` | `login` | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`; followers need `TWITCH_USER_TOKEN` |
| `attention` | – | GitHub token with `notifications` scope |

Any widget accepts `title` to rename it.

### Add a widget type

Create `providers/<name>.js` exporting `meta = { title, icon }` and `fetchData(cfg, env)` returning

```js
{ stats: [{ label, value, sub? }], items: [{ text, url, badge?, sub? }], attention: [{ text, url, level }] }
```

Register it in `providers/index.js`. Done.

### Themes

`public/themes.js`. One object per theme, six CSS variables. Add one, it appears in the picker.

## API

- `GET /api/dashboard?u=<user>[&refresh=1]` – all widget data (5 min cache)
- `POST /api/brief` – `{ widgets, name, tone }` → `{ text }`
- `GET /api/users`
