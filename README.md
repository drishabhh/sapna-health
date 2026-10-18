# Sapna Health

Personal companion for Sapna — **Today**, **Workout** (plan + GIFs + LOG), **Diet**, **Periods**, and **Gym weight logs** — one Health app, Health theme.

**Live:** https://drishabhh.github.io/sapna-health/  

> The old `sapna-workout` Pages site redirects here (`#workout`).

## Sections

| Section | Persistence |
|---------|-------------|
| Workout | `data/today.json` + `media/` / GIF library; lift LOG → `data/weights.json` |
| Diet | Sapna logs breakfast/lunch/dinner/snacks from the food library; edit grams to scale macros. Admin maintains library only (no pre-built plan). Sync → `data/diet-checks.json` |
| Periods | Device + optional sync to private repo `sapna-health-data` → `data/periods.json` |
| Weight logs | Device + sync to private repo `sapna-health-data` → `data/weights.json` |

### Where data lives

This repo is **public** and only holds the site, workout/diet plans, food library and media.
Personal logs — periods, weights, diet checkmarks, profile and overnight insights — live in the
**private** repo `drishabhh/sapna-health-data` (same `data/…` paths). Phones read/write it through
the GitHub API with a **fine-grained token**: *Only select repositories → `sapna-health-data` →
Contents: Read and write*. Admin needs a token with the same access on both repos.

## Admin

Password-gated (PBKDF2 hash in `js/admin-auth.js`; the password is not stored in this repo).
The gate only hides admin UI — real protection is the GitHub token.

- **Workout plans** — cart → Publish → `data/today.json` + history.
- **Diet plans** — same cart pattern → Publish → `data/diet-today.json` + `data/diet-plans/`. Sapna only checkmarks items + quick-adds extras (no AI UI).
- **AI** (Insights regenerate, packaged-product fill, batch foods, Puter Grok, diet AI fill) is **Admin only**.
- Same panel saves GitHub / Gemini keys and posts diet defaults, periods, and lift logs.

## Overnight Insights (4:00 IST)

Browser can’t wake at 4am. GitHub Actions runs once daily:

| | |
|--|--|
| Workflow template | `scripts/daily-insights.workflow.yml` → copy to `.github/workflows/daily-insights.yml` **in `sapna-health-data`** |
| Schedule | **04:00 Asia/Kolkata** → cron `30 22 * * *` UTC (22:30 UTC = 4:00 IST next morning) |
| Secret | `GEMINI_API_KEY` in **sapna-health-data** — Settings → Secrets and variables → Actions (do not commit) |
| Script | `node scripts/daily-insights.mjs` |
| Output | `sapna-health-data` → `data/insights/latest.json` (+ dated `YYYY-MM-DD.json`) |
| Site | Today loads overnight file on open; **AI coach** = optional manual refresh (Gemini → Puter Grok) |

### Phone AI (browser)
Paste/save Gemini under **Admin → Gemini key**. Stored in `localStorage` only. Manual Admin taps: **try Gemini first**, then **Puter.js Grok** — no Puter key; may prompt Puter sign-in (User-Pays). Overnight cron stays **Gemini-only** (Actions secret). Sapna sees overnight Insights read-only.

| Key / path | Where | Used for |
|-----|--------|----------|
| Phone AI Studio key | Site UI → localStorage | Tried first for AI coach + Fill food library |
| Puter Grok (no key) | Browser via Puter.js | Fallback when Gemini fails / missing |
| `GEMINI_API_KEY` secret | GitHub Actions secrets | Overnight 4:00 IST cron only (no Puter) |

Overnight and phone are **different** — cron never uses Puter.

**Enable once:** In `sapna-health-data`, add `.github/workflows/daily-insights.yml` with the contents of `scripts/daily-insights.workflow.yml`. Then **Actions → Daily Insights (4am IST) → Run workflow** to test.

Quota: **one scheduled Gemini call per day**. Manual / food-list bootstrap: Gemini when the phone key works, else Puter Grok (her Puter allowance).

## Stack

Static site on GitHub Pages — HTML/CSS/JS, no backend. Cron via GitHub Actions.
