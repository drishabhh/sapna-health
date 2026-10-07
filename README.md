# Sapna Health

Personal health companion for Sapna — **Diet**, **Periods** (dates syncable), and **Gym weight logs**, with a link to today’s workout.

**Live:** https://drishabhh.github.io/sapna-health/  
**Workout app (separate, locked):** https://drishabhh.github.io/sapna-workout/

## Sections

| Section | Persistence |
|---------|-------------|
| Diet | Device (`localStorage`) + optional Admin publish of defaults (`data/diet-defaults.json`) |
| Periods | Device + optional sync of **dates** to `data/periods.json` (cross-device) |
| Weight logs | Device + export/import (exercise moves only) |
| Workout | Links out to Sapna workout Pages; inline exercise weight logs on-device |

## Admin

Password-gated (hashed). Publish diet defaults and/or period calendar dates via GitHub PAT.

## Stack

Static site on GitHub Pages — HTML/CSS/JS, no backend. Light Sapna visual shell with section accent colors.
