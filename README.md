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

## Cloud sync (Firebase)

Optional Google sign-in syncs your data between phone and desktop via Firestore.
After registering a Firebase project (config goes in `firebase.js`):

1. **Authentication → Sign-in method**: enable Google.
2. **Firestore → Create database**: production mode.
3. **Firestore → Rules → Publish:**
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. **Authentication → Settings → Authorized domains**: add your prod URL
   (`localhost` is already there).

Without step 3 the app shows a *Permission denied* banner — Firestore
defaults to deny-all in production mode.

## Exercise GIFs (ExerciseDB)

Settings → Exercise GIFs pulls real demo GIFs from
[ExerciseDB on RapidAPI](https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb).

1. Sign up on RapidAPI (free, no card).
2. Open the ExerciseDB API page and subscribe to the **Basic** plan
   (free tier — 500 requests/month, more than enough since we match
   in a single request).
3. Copy your `X-RapidAPI-Key` from the **Code Snippets** panel.
4. Paste it into Settings → Exercise GIFs → Match exercises with GIFs.

The catalog is fetched once, fuzzy-matched against the 158 built-in
exercises by name + equipment + target muscle. Matched `gifUrl`s are
stored on each exercise and synced to Firestore, so other devices
inherit the matches without needing the API key.

## File map

| File | Purpose |
| ---- | ------- |
| `index.html` | Page shell, nav, scaffolding |
| `styles.css` | All styling (glassmorphism, dark/light, layout) |
| `app.js` | UI logic, routing, modals, workout session |
| `db.js` | localStorage data layer + cloud-push hook |
| `firebase.js` | Firebase Auth + Firestore wrapper (ES module) |
| `illustrations.js` | SVG body-figure system |
| `seed.js` | Default exercises and a sample program |
| `manifest.webmanifest` | PWA manifest |
| `sw.js` | Offline-first service worker (same-origin only) |
| `icons/` | App icons (PNG + SVG) |
