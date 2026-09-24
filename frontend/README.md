# Cardio Sense frontend

React (Vite) app with four pages: Dashboard, Prediction, History and About.

## Commands (from `frontend/`)

```bash
npm install
npm run dev      # http://localhost:5173 ; /api/* is proxied to Django on :8000
npm run build    # production build in dist/
```

## API

`src/api/predictionApi.js` uses the in-browser mock by default. To call Django's
`POST /api/predict/`, copy `.env.example` to `.env.local` and set `VITE_USE_MOCK_API=false`.
History still uses sample data (`pages/History/historyMock.js`) until the backend has a history endpoint.

## Layout

```
index.html            favicon links, meta
public/               favicons (made from the logo)
src/
  main.jsx            React root + BrowserRouter
  App.jsx             routes; links use view transitions (circle wipe between pages)
  api/                client.js (fetch wrapper), predictionApi.js (mock ↔ real switch)
  pages/
    Dashboard/        heart health overview; also holds the shared theme (Dashboard.css),
                      NavBar, HeartHero, logo and assets used by every page
    Prediction/       risk prediction form + result
    History/          test results and assessment records
    About/            project story, model inputs, method and limitations
```

Each page folder has its own README covering its design, motion and data rules. Shared pieces
currently live in `pages/Dashboard/`. Moving them to `src/components/{layout,common}` is a planned
follow-up.

## Hosting note

The app uses client-side routing, so the web server must return `index.html` for unknown paths
(for example `/history` on refresh). Vite's dev and preview servers already do this.
