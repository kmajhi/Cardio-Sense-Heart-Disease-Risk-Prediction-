# Cardio Sense frontend

React (Vite) app: a public Home page (with the Log in / Register dialog) and About page, and,
once signed in, Dashboard, Prediction, History, Guidance and Profile. Prediction can be viewed
signed out; running it asks you to log in first.

## Accounts and routes

- `/` Home. Signed-out visitors see it; signed-in users are sent to `/dashboard`. Log in and
  Register both land on the Dashboard (or back on the page that asked for an account).
- `/about` and `/prediction` are open; `/dashboard`, `/history`, `/guidance` and `/profile`
  need an account (`RequireAuth` in `src/auth/AuthContext.jsx` sends visitors Home to sign in).
- Everything a user sees is their own: a new account starts with an empty Dashboard and History
  until its first prediction.

## Commands (from `frontend/`)

```bash
npm install
npm run dev      # http://localhost:5173 ; /api/* is proxied to Django on :8000
npm run build    # production build in dist/
npm test         # Vitest: the clinical logic in src/clinical/
```

## API

The files in `src/api/` use in-browser mocks by default. To use the Django API (see
`backend/README.md`), copy `.env.example` to `.env.local` and set `VITE_USE_MOCK_API=false`:

- `authApi.js`: `/api/auth/me|register|login|logout/` (mock: accounts in `localStorage`, passwords
  as salted SHA-256 hashes)
- `predictionApi.js`: `POST /api/predict/` (mock: `pages/Prediction/predictionMock.js`)
- `historyApi.js`: `GET /api/history/` (mock: the signed-in account's records in `localStorage`)
- `profileApi.js`: `GET / PUT / DELETE /api/profile/` (mock: the signed-in account's profile)

`client.js` sends the session cookie and Django's CSRF token. The mock keeps every account's data
apart (`mockStore.js`), like the real API.

## Layout

```
index.html            favicon links, meta
public/               favicons (made from the logo)
src/
  main.jsx            React root + BrowserRouter
  App.jsx             routes (public / signed-in); links use view transitions (a quick crossfade)
  assets/             videos and images shared by several pages: hero-heart.mp4 (Home,
                      Dashboard), heart-loop (HeartHero), the logo artwork
  auth/               AuthContext: who is signed in, login/register/logout, RequireAuth
  api/                client.js (fetch wrapper); auth, prediction, history, profile and connect APIs (mock ↔ real switch)
  components/         shared UI: NavBar (and the HeartMark logo), SiteFooter, NavWeather,
                      HeartHero (About, History), link.js (plain <a> or router <Link>)
  hooks/              usePrefersReducedMotion
  clinical/           reference ranges, feature analysis, notifications, recommendations (see its README)
  notifications/      notification context, grouped alerts, nav bell menu
  pages/
    Home/             landing page: hero with the heart clip, how it works, the model's figures,
                      the Log in / Register dialog (AuthModal) and the loader
    Dashboard/        heart health overview; its Dashboard.css is also the shared theme
                      (tokens, nav, panel, load sequence) every page imports
    Prediction/       risk prediction form + result
    History/          test results and assessment records
    About/            project story, model inputs, method and limitations
    Guidance/         personalised diet, activity and habit suggestions from the latest assessment
    Profile/          health profile (create/edit/delete), report download, sharing, linked accounts
```

Each page folder has its own README covering its design, motion and data rules. Anything more
than one page uses lives in `src/components/`, `src/hooks/` or `src/assets/`; a page folder holds
only that page. The shared theme is still `pages/Dashboard/Dashboard.css`.

## Hosting note

The app uses client-side routing, so the web server must return `index.html` for unknown paths
(for example `/history` on refresh). Vite's dev and preview servers already do this.
