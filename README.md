# MacNLift — Macros & Workouts

A mobile-first, installable PWA that tracks both your training and your
nutrition in one place. Vanilla HTML/CSS/JS — no build step, no backend
required for the core app. Data is stored locally in `localStorage` and
optionally synced to Firestore.

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

## Macros tab — food search & camera

The Macros tab can log food two ways:

- **Search**: type a food name → results come from
  [USDA FoodData Central](https://fdc.nal.usda.gov/) via
  `/api/food-search`. Falls back to
  [Open Food Facts](https://world.openfoodfacts.org/) if USDA is
  unavailable.

- **Photo**: take a picture of food or a nutrition label → the image
  is sent to Google Gemini Vision via `/api/food-recognize`. Macros
  are parsed and pre-filled in the portion modal.

### Search setup (one-time)

1. Get a free USDA key (instant, no card) at
   <https://fdc.nal.usda.gov/api-key-signup.html>.
2. In **Vercel → Settings → Environment Variables**, add
   `USDA_API_KEY = <your key>` for Production.
3. Redeploy.

USDA's free tier is 1,000 requests/hour. The search proxy edge-caches
results so popular queries cost ~zero requests after the first hit.

Without `USDA_API_KEY`, search falls back to Open Food Facts which is
heavily skewed toward European packaged products — usable but much
worse for generic foods and meals.

### Photo setup (one-time)

1. Get a free Gemini key at <https://aistudio.google.com/app/apikey>
   (no credit card; 1500 requests/day on the free tier).
2. In **Vercel → Settings → Environment Variables**, add
   `GEMINI_API_KEY = <your key>` for Production.
3. Redeploy.

If `GEMINI_API_KEY` isn't set, the photo button returns a clear
error and the text search still works.

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
