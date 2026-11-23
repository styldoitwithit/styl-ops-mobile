# STYL Ops Hub — Mobile prototype

Mobile-first, installable web app (PWA) version of STYL Ops Hub.
This build covers **Overview** and **Sales** (Pipeline · Meetings · Sales Score).

No build step or install needed — plain HTML/CSS/JS.

## Run it
- Quick look: double-click `index.html` (opens in your browser).
- On a phone: deploy the folder to Vercel (or any static host) and open the URL.
  Use "Add to Home screen" to install it like an app.

## What's in it
| Screen | Matches web app | Mobile changes |
|---|---|---|
| Overview | 6 stat cards, recent activity, upcoming meetings, quick links | 2-column stats, stacked sections |
| Sales › Pipeline | Cold → Warm → Prospect → Won/Lost, TAT, quick add, lead drawer, log call, schedule meeting | Stage filter chips + search, cards, bottom sheet, "Add lead" button |
| Sales › Meetings | Upcoming / past list with "in Xh/Xd" | Compact rows |
| Sales › Sales Score | Same formula and weights | Leaderboard cards instead of a table |

## Data
- **Live mode** — "Continue with Google" signs in through the same Supabase
  project as the web app (`js/config.js`). Same allowlist (`profiles`), same
  tables (`prospects`, `sales_activities`, `meetings`, `activity_log`,
  `clients`, `tasks`) and same row-level security. Changes show up in the web app.
- **Sample data mode** — "Explore with sample data" uses `js/data.js`, saved
  only in that browser. Reset it from the avatar menu (top-right).

### One-time Supabase setting
Add the deployed URL (e.g. `https://styl-ops-mobile.vercel.app/**`) under
Supabase → Authentication → URL Configuration → **Redirect URLs**, otherwise
Google sign-in returns to the web app instead of the mobile app.

## Files
- `index.html` — shell, app bar, bottom tab bar
- `css/styles.css` — dark theme, responsive rules (320px → tablet)
- `js/data.js` — team list, stages, score weights, sample data
- `js/app.js` — router and screens
- `manifest.webmanifest`, `sw.js`, `icons/` — install + offline support
