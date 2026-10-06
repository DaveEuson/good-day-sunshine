# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who wants a calm morning dashboard: a person starting the day who wants to know what matters now, not read a wall of data. It is friendly to ADHD (one clear next step, no pile of boxes) without being ADHD-only. The first user is its author; others are expected to clone, theme and adopt it ("productized, themeable per user"). Used on a desktop browser first thing in the morning and left open as a dashboard, on a phone, on a TV across the room, and on small always-on panels (Raspberry Pi, Jetson, Waveshare-class displays, e-paper).

## Product Purpose

A one-page "good morning" companion. It shows what needs attention (GitHub notifications and reviews, mail, calendar, weather, news, YouTube and Twitch channels, AI credit and Claude Code usage), a morning routine checklist, and a small garden game, and a character leads the page: it asks how you feel, then offers one next action with a button that does it. Success is a person who knows the one thing to do next within seconds, and trusts what the page tells them.

## Positioning

Four things a neighbouring dashboard could not truthfully copy together:
- A companion (Sun, Cat, Robot, Cloud or Coffee) that picks ONE thing and does it with you, doing less on rough mornings.
- Honest status: a source that fails says it failed. A failed check never shows a zero or "all clear".
- Local-first: runs on the user's own machine with a local AI model by default; nothing leaves it unless the user adds a key.
- A garden game: daily check-ins earn tokens that unlock seeds and themes.

## Operating Context

Single-user pages (config per person in `config/users/<name>.json`), served by a small zero-dependency Node server on port 4242; also shipped as one Windows exe with a tray icon and a browser extension, and as a kiosk on a Raspberry Pi. Widgets are opt-in cards configured in an Options dialog (tabs: You, Morning, Widgets, AI, Keys, Display). A wake-up wizard asks conversational questions on first run. Evening mode recaps the day and prepares tomorrow. Modes: `?mode=tv`, `?mode=small`, and a phone layout under 700 px with a bottom tab bar.

## Capabilities and Constraints

- Plain HTML, CSS and vanilla JavaScript, no framework and no build step for the front end; the same code runs from source, on a Pi, and inside a single exe.
- Every widget reports `ok`, `error` or `setup`; failed checks ship no numbers and write no history. A broken source is named in the headline ("Heads up: X can't connect").
- Layouts must keep working on four device classes: desktop, phone, TV, and an 800x480 always-on panel.
- The page makes no third-party requests: fonts and icons are bundled, the AI is local by default, and admin endpoints are local-only.
- The companion's bubble is built from fixed templates so it only states facts the page has; the AI brief is separate and may be absent.
- Themes are CSS variables set from `public/themes.js` (11 today, some unlocked with garden tokens). New themes must keep the same contract.
- Claude Code history widgets show estimates (spend is computed from public per-token prices) and must say so.

## Brand Commitments

Name: Good Day Sunshine. Tone: kind and concise, never guilt, no streak-shaming, less on a rough morning. Five named characters with their own voices (Sun warm and slightly nudgy, Cat dry and secretly kind, Robot precise, Cloud soft, Coffee quick), generated as SVG faces with outfits that unlock with streaks. The "Heliotropic Record" art plate (`art/`) is the author's own artwork and the source of the Heliotrope theme and the loading screen.

## Evidence on Hand

- Real running instance with live data for its author (screenshots of desktop, evening, phone, TV and small modes in `design-pack/`, kept out of git).
- Art plate and its philosophy in `art/` (PNG, PDF, Markdown).
- 50 automated tests for the server logic. There are no user testimonials, usage numbers or other users' feedback yet; none should be invented.

## Product Principles

1. One next thing beats a complete overview. The page earns attention by choosing, not by listing.
2. Say what is true, including "I can't see that". Never show a number the page could not check.
3. Quiet when fine, loud only when something needs the person; rough days get less, not more.
4. Runs on the person's own machine and small hardware; no outside dependencies at runtime.
5. Personality lives in the companion, not in decoration; every theme keeps the same information and the same honesty.

## Accessibility & Inclusion

Designed to be ADHD-friendly (one clear action, low clutter, no guilt) and to respect reduced-motion preferences. No formal standard (such as WCAG level) has been set; it has not been audited yet.