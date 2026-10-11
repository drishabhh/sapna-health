# Sapna Health

Personal companion for Sapna — **Today**, **Workout** (plan + GIFs + LOG), **Diet**, **Periods**, and **Gym weight logs** — one Health app, Health theme.

**Live:** https://drishabhh.github.io/sapna-health/  

> The old `sapna-workout` Pages site redirects here (`#workout`).

## Sections

| Section | Persistence |
|---------|-------------|
| Workout | `data/today.json` + `media/` / GIF library; lift LOG → `data/weights.json` |
| Diet | Device (`localStorage`) + optional Admin publish of defaults |
| Periods | Device + optional sync to `data/periods.json` |
| Weight logs | Device + sync to `data/weights.json` (shared PAT) |

## Admin

Password-gated. **Edit current plan** loads today’s cart. **Create new plan** asks for name + date (default tomorrow), then the same cart. Browse **Library** or **Past plans**, tap tiles (or **+ Add custom** GIF/stretch with body part for the library), then **Publish**. Same panel also saves GitHub / Gemini keys and posts diet, periods, and lift logs.

## Overnight Insights (4:00 IST)

Browser can’t wake at 4am. GitHub Actions runs once daily:

| | |
|--|--|
| Workflow template | `scripts/daily-insights.workflow.yml` → copy to `.github/workflows/daily-insights.yml` (needs a token/UI with **workflow** scope) |
| Schedule | **04:00 Asia/Kolkata** → cron `30 22 * * *` UTC (22:30 UTC = 4:00 IST next morning) |
| Secret | `GEMINI_API_KEY` — **Settings → Secrets and variables → Actions → New repository secret** (do not commit) |
| Script | `node scripts/daily-insights.mjs` |
| Output | `data/insights/latest.json` (+ dated `YYYY-MM-DD.json`) |
| Site | Today loads overnight file on open; **AI coach** = optional manual refresh (Gemini → Puter Grok) |

### Phone AI (browser)
Paste/save Gemini under **Admin → Gemini key**, or Insights / Diet panels. Stored in `localStorage` only. Manual taps: **try Gemini first**, then **Puter.js Grok** (`https://js.puter.com/v2/`) — no Puter key; may prompt Puter sign-in (User-Pays). Overnight cron stays **Gemini-only** (Actions secret).

| Key / path | Where | Used for |
|-----|--------|----------|
| Phone AI Studio key | Site UI → localStorage | Tried first for AI coach + Fill food library |
| Puter Grok (no key) | Browser via Puter.js | Fallback when Gemini fails / missing |
| `GEMINI_API_KEY` secret | GitHub Actions secrets | Overnight 4:00 IST cron only (no Puter) |

Overnight and phone are **different** — cron never uses Puter.

**Enable once:** In GitHub, add file `.github/workflows/daily-insights.yml` with the contents of `scripts/daily-insights.workflow.yml` (web UI or a PAT that includes the `workflow` scope). Then **Actions → Daily Insights (4am IST) → Run workflow** to test.

Quota: **one scheduled Gemini call per day**. Manual / food-list bootstrap: Gemini when the phone key works, else Puter Grok (her Puter allowance).

## Stack

Static site on GitHub Pages — HTML/CSS/JS, no backend. Cron via GitHub Actions.
