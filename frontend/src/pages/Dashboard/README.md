# Cardio Sense Dashboard (Heart health overview)

React version of the Figma "Heart health overview" page, with the looping heart video,
the page-load transition, and working widgets.

## Usage

Routed at `/` in `src/App.jsx`, with a view-transition `Link` as `LinkComponent`.
Without a router, `<Dashboard />` falls back to plain `<a>` links.

## Connect real data

`dashboardMock.js` shows the exact shape each widget expects. Fetch from the Django API
and pass it in:

```jsx
const [data, setData] = useState(null);
useEffect(() => { fetch('/api/dashboard/').then(r => r.json()).then(setData); }, []);
return data ? <Dashboard data={data} LinkComponent={Link} /> : null;
```

`risk.probability` is 0–1 and `risk.level` is `low | moderate | high`.
`risk.factors` is a good place for the top SHAP contributors.

## What's in here

- `Dashboard.jsx`: the page and the one-time load sequence (`is-ready` class).
- `Dashboard.css`: all styles, prefixed `pc-`, responsive down to phones, reduced motion respected.
- `components/HeartHero.jsx`: the heart video (3.6 s seamless loop, WebM + MP4 + poster).
- `components/HeartRateChart.jsx`: smooth SVG line, hover/tap or arrow keys to inspect values.
- `components/CheckupsCard.jsx`: next appointment with Today / Tomorrow / Week / Month filters.
- `components/BreathingPlayer.jsx`: a working 4-7-8 breathing timer.
- `components/RiskCard.jsx`, `AlertCard.jsx`, `RecoveryChip.jsx`, `NavBar.jsx`.

## Theme and motion

The "misty horizon" theme follows the reference video:
- A dusk-to-fog sky background, frosted white cards, violet accents (`--pc-violet` #6833e4),
  and one sun-yellow detail (`--pc-sun` #fcb71d) on CTA arrows.
- Plus Jakarta Sans, with headlines split into a hairline word (`.pc-thin`) and a heavy one (`.pc-bold`).
- Tokens live on `.pc-dash` at the top of `Dashboard.css`.
- The logo is `HeartMark` in `components/NavBar.jsx`: a vector traced from the brand artwork,
  drawn in `--pc-brand` (#ed3a4f). The same artwork is in `assets/cardio-sense-logo.svg`.
- Favicons are in `frontend/public/`: `favicon.svg` (sharp at any size),
  `favicon.ico` (16/32/48 px), 16 and 32 px PNGs, and `apple-touch-icon.png` (180 px, white tile).
  The PNG and ICO versions are made from the logo image itself. They are linked from `frontend/index.html`.

Motion (all switched off under `prefers-reduced-motion`):
- **Page change:** a circle wipe from the top-left corner (`@view-transition` + `pc-circle-wipe`).
  It works across full page loads in Chrome/Edge 126+. With react-router, use
  `<Link viewTransition>` (v7) so client-side navigation gets it too. Other browsers just navigate.
- **Load sequence:**
  - Headline lines wipe in from the right (`.pc-wipe`).
  - Fog rolls in along the bottom of the panel (`.pc-fog`).
  - The heart's orb opens as a circle, and the heart glides in from the right while unblurring.
  - The heart-rate line draws itself, then its violet nodes pop in one by one.
- **Check-ups filter:** the appointment card glides in again on every filter change.

## One rule for the heart video

The video uses `mix-blend-mode: screen` to make its black background disappear. Screen blending only
works over something dark, so on this light theme the heart sits in a dark violet orb (`.pc-hero-orb`).
Don't remove the orb or make it light, or the heart will wash out.
That only works if no parent element creates an isolated layer. Don't add `transform`,
`filter`, `opacity < 1`, `backdrop-filter`, `isolation: isolate` or `z-index`
(with position) to `.pc-dash`, `.pc-stage`, `.pc-panel`, `.pc-hero`, or any wrapper
you put around `<Dashboard />`. If the heart suddenly shows a black box, that's the cause.
