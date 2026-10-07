# Sapna Health

Personal health companion for Sapna — **Diet**, **Periods** (private on device), and **Gym weight logs**, with a link to today’s workout.

**Live:** https://drishabhh.github.io/sapna-health/  
**Workout app (separate, locked):** https://drishabhh.github.io/sapna-workout/

## Sections

| Section | Persistence |
|---------|-------------|
| Diet | Device (`localStorage`) + optional Admin publish of shared defaults (`data/diet-defaults.json`) |
| Periods | **Device only** — never committed to this public repo |
| Weight logs | Device + export/import backup |
| Workout | Links out to the Sapna workout Pages site |

## Admin

Password-gated (same hashed gate pattern as the workout site). Used to publish diet default targets via GitHub PAT if desired. Intimate period data is never published.

## Stack

Static site on GitHub Pages — HTML/CSS/JS, no backend.
