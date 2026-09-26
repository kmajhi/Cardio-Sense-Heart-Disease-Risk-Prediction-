# Cardio Sense frontend

React (Vite) app with five pages: Dashboard, Prediction, History, About and Profile.

## Commands (from `frontend/`)

```bash
npm install
npm run dev      # http://localhost:5173 ; /api/* is proxied to Django on :8000
npm run build    # production build in dist/
```

## API

The files in `src/api/` use in-browser mocks by default. To use the Django API (see
`backend/README.md`), copy `.env.example` to `.env.local` and set `VITE_USE_MOCK_API=false`:

- `predictionApi.js`: `POST /api/predict/` (mock: `pages/Prediction/predictionMock.js`)
- `historyApi.js`: `GET /api/history/` (mock: `pages/History/historyMock.js`)
- `profileApi.js`: `GET / PUT / DELETE /api/profile/` (mock: this browser's `localStorage`)

## Layout

```
index.html            favicon links, meta
public/               favicons (made from the logo)
src/
  main.jsx            React root + BrowserRouter
  App.jsx             routes; links use view transitions (circle wipe between pages)
  api/                client.js (fetch wrapper); prediction, history and profile APIs (mock ↔ real switch)
  pages/
    Dashboard/        heart health overview; also holds the shared theme (Dashboard.css),
                      NavBar, HeartHero, logo and assets used by every page
    Prediction/       risk prediction form + result
    History/          test results and assessment records
    About/            project story, model inputs, method and limitations
    Profile/          health profile (create/edit/delete), report download, sharing, linked accounts
```

Each page folder has its own README covering its design, motion and data rules. Shared pieces
currently live in `pages/Dashboard/`. Moving them to `src/components/{layout,common}` is a planned
follow-up.

## Hosting note

The app uses client-side routing, so the web server must return `index.html` for unknown paths
(for example `/history` on refresh). Vite's dev and preview servers already do this.
