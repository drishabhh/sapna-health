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

Password-gated. At the top: **Create plan for today** / **Start a new plan** — step flow Stretching or Exercise → body part → GIF → sets/reps → add another → **Post / Publish plan**. Same panel also saves GitHub / Google keys and posts diet, periods, and lift logs.

## Stack

Static site on GitHub Pages — HTML/CSS/JS, no backend.
