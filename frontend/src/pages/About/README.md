# Cardio Sense About page

The product's "about us" page: what Cardio Sense is, why it exists, how it works, every part of
the app, the science, how data is protected, the project's history and an FAQ.

## Usage

Routed at `/about` in `src/App.jsx`. It reuses `NavBar`, `HeartHero`, `SiteFooter`, `link.js`
and the `usePrefersReducedMotion` hook. The footer links to `#a-how`, `#a-inputs`, `#a-model`,
`#a-trust` and `#a-faq`; keep those ids.

## Sections

1. **Hero:** status badge, three-line headline, lead, CTAs and the heart orb.
2. **Facts strip** (count-up) and an **on-this-page** link bar.
3. **Mission** (`#a-mission`): the problem, three problem → answer contrasts, four principles.
4. **How it works** (`#a-how`): `components/ProductTour.jsx`. Four steps beside a browser-window
   mock that shows each one. It auto-advances every 6 s, pauses on hover, off screen or once the
   reader picks a step, and never runs with reduced motion. Arrow keys move between steps.
5. **Platform** (`#a-platform`): a bento grid of every part of the app with small decorative
   previews. The admin console card links only for staff.
6. **Who it's for** (`#a-who`): three audiences.
7. **Inputs** (`#a-inputs`): all inputs with group filters and a legend.
8. **The science** (`#a-model`): pipeline, held-out metrics, a method accordion, the
   transparency report (limitations) and the required disclaimer.
9. **Privacy & trust** (`#a-trust`) and the tech stack.
10. **Journey** (`#a-journey`): milestones from the git history, plus what's next.
11. **FAQ** (`#a-faq`) and the closing call to action.

## Content rules

All copy lives in `content.js`, and every statement there must be true of the app as built:
model figures from `ml/artifacts/model_metadata.json`, privacy claims from `backend/predictor`
(export, deletion, password hashing, audit log), dates from the commit history. There are no
invented customers, testimonials, team members or usage numbers. The example patient in the
tour and the platform previews is labelled as an illustration.

`pages/Home/Home.jsx` also imports `DISCLAIMER`, `FACTS`, `METRICS` and `STEPS` from
`content.js`, and looks two facts up by their label. Keep those exports and labels.

## Motion

- **Sticky nav:** becomes a frosted pill once the page scrolls.
- **Reveal on scroll:** `useInView` adds `.is-in` once; a short rise and fade, with children
  staggered by `--i`. Thresholds are low (or observe a small element), so fast scrolling and
  short phone screens never leave a section blank.
- **Scroll-linked extra:** in Chrome/Edge 115+ the hero copy leaves faster than the heart.
- **Nothing transforms the heart orb or its ancestors**, which would break the video's
  `screen` blend (see the Dashboard README).
- Everything is switched off under `prefers-reduced-motion`.
