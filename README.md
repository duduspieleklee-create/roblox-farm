# roblox-farm

Runs multiple headless Roblox browser sessions in parallel via Playwright, with a live web dashboard for monitoring tab/instance status.

## Components

- **manager.js** — launches a headless Chromium instance and opens one browser tab per account (or guest tab if no account is configured), staggered on a delay. Exposes a `GET /status` endpoint (port 3000) reporting per-tab state (loading/ready/error), uptime, URL, and title. Applies lightweight optimizations: throttled `requestAnimationFrame` and blocking of analytics/telemetry/ads/video requests.
- **dashboard/** — Express + WebSocket server (port 8080) that polls one or more farm instances' `/status` endpoints every 8s and broadcasts the combined state to connected browser clients.

## Configuration

`manager.js` reads these environment variables:

| Variable | Default | Description |
|---|---|---|
| `INSTANCE_ID` | `1` | Identifier reported in `/status` |
| `MAX_TABS` | `80` | Max accounts/tabs to open |
| `TAB_COUNT` | `10` | Number of placeholder tabs generated if no accounts file exists |
| `FPS_THROTTLE` | `7` | Throttled animation frame rate per tab |
| `TAB_STAGGER_MS` | `1500` | Delay between opening each tab |
| `GAME_URL` | `https://www.roblox.com/home` | URL each tab navigates to |

Accounts are read from `data/accounts.json` (created with placeholder entries on first run if missing). Each entry may include an `id`, and optionally `cookie` (a `.ROBLOSECURITY` value) to open the tab logged in. This file is gitignored — do not commit real credentials.

## Running

```bash
docker compose up --build
```

This starts `farm-1` (the manager) and the `dashboard`, which is served at `http://localhost:8080`.
