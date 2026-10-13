# Sapna Health

Personal companion for Sapna — **Today**, **Workout** (plan + GIFs + LOG), **Diet**, **Periods**, and **Gym weight logs** — one Health app, Health theme.

**Live:** https://drishabhh.github.io/sapna-health/  

> The old `sapna-workout` Pages site redirects here (`#workout`).

## Sections

| Section | Persistence |
|---------|-------------|
| Workout | `data/today.json` + `media/` / GIF library; lift LOG → `data/weights.json` |
| Diet | Admin publishes `data/diet-today.json` + `data/diet-plans/`; Sapna checkmarks + editable grams (macros scale) + extras on device (`localStorage`) with optional sync to `data/diet-checks.json` |
| Periods | Device + optional sync to `data/periods.json` |
| Weight logs | Device + sync to `data/weights.json` (shared PAT) |

## Admin

Password-gated (`SapnaJim`).

- **Workout plans** — cart → Publish → `data/today.json` + history.
- **Diet plans** — same cart pattern → Publish → `data/diet-today.json` + `data/diet-plans/`. Sapna only checkmarks items + quick-adds extras (no AI UI).
- **AI** (Insights regenerate, packaged-product fill, batch foods, Puter Grok, diet AI fill) is **Admin only**.
- Same panel saves GitHub / Gemini keys and posts diet defaults, periods, and lift logs.

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
Paste/save Gemini under **Admin → Gemini key**. Stored in `localStorage` only. Manual Admin taps: **try Gemini first**, then **Puter.js Grok** — no Puter key; may prompt Puter sign-in (User-Pays). Overnight cron stays **Gemini-only** (Actions secret). Sapna sees overnight Insights read-only.

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
