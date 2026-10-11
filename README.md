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

Password-gated. **Edit current plan** loads today’s cart. **Create new plan** asks for name + date (default tomorrow), then the same cart. Browse **Library** or **Past plans**, tap tiles (or **+ Add custom** GIF/stretch with body part for the library), then **Publish**. Same panel also saves GitHub / Google keys and posts diet, periods, and lift logs.

## Stack

Static site on GitHub Pages — HTML/CSS/JS, no backend.
