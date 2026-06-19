# Lift — Workout Tracker

A mobile-first, installable workout tracker PWA. Vanilla HTML/CSS/JS — no build step,
no backend. Data is stored locally in `localStorage`.

## Features

- **Home** — quick stats (this week, last session, total volume), active programs, recent workouts.
- **Programs & routines** — create, edit, delete, and start workouts from a routine.
- **Empty workout** — start a workout that isn't tied to any program.
- **Live workout session** — log sets, reps, and weight; tick sets done; running time, sets, and volume.
- **Exercise library** — search by name/muscle, filter by muscle group, add custom exercises.
- **Exercise detail** — modern modal with About + History tabs, PR detection, and previous sets.
- **History** — search workouts/exercises, filter by Today/7/30/60/90 days/All, drill into details.
- **Settings** — light/dark theme toggle, kg/lb units, body metrics, GitHub-style activity dot chart, reset data.
- **PWA** — `manifest.webmanifest`, service worker, installable on iOS/Android/Chrome.

## Run locally

Any static file server works. For example:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Install on phone

1. Open the site in mobile Safari / Chrome.
2. Use *Share → Add to Home Screen* (iOS) or *Install app* (Android).

## File map

| File | Purpose |
| ---- | ------- |
| `index.html` | Page shell, nav, scaffolding |
| `styles.css` | All styling (glassmorphism, dark/light, layout) |
| `app.js` | UI logic, routing, modals, workout session |
| `db.js` | localStorage data layer |
| `seed.js` | Default exercises and a sample program |
| `manifest.webmanifest` | PWA manifest |
| `sw.js` | Offline-first service worker |
| `icons/` | App icons (PNG + SVG) |
