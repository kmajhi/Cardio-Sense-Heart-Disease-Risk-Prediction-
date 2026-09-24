# Cardio Sense About page

A scrolling story about what Cardio Sense is, how it works, what the model looks at, how it was
built and its limits. The layout and motion follow the reference landing page, in the Cardio
Sense theme.

## Usage

Routed at `/about` in `src/App.jsx`. It reuses `NavBar`, `HeartHero`, `link.js` and the
`usePrefersReducedMotion` hook from `../Dashboard`.

## Sections

1. **Hero:** a three-line headline (thin, then heavy), a lead paragraph, CTAs, and the heart orb.
2. **Facts strip:** the reference's logo row, as numbers that count up: 1,035 records, 21 inputs,
   4 models, 5-fold CV, 5 factors per estimate.
3. **How it works:** two HTML phone mockups (the input form and a result) that rise in tilted,
   next to three numbered steps.
4. **What the model looks at:** all inputs as tiles with group filter pills (the reference's
   fleet grid). Derived inputs (BMI, max heart rate) and Troponin-I are marked out.
5. **Key features:** four cards that cascade in diagonally and cascade out as you scroll past.
6. **How it was built:** method, held-out test metrics (count-up), a caveat, limitations, and the
   required disclaimer.
7. **CTA band and footer.**

All copy and figures live in `content.js`. Update the metrics there if the model is retrained
(they come from `ml/artifacts/model_metadata.json`).

## Motion

- **Sticky nav:** becomes a frosted dusk pill once the page scrolls.
- **Reveal on scroll:** `useInView` (IntersectionObserver) adds `.is-in` once, driving the
  phones, steps, tiles, cards, metrics and CTA. Reveals animate `translate` and `opacity`.
- **Scroll-linked extras:** these use `animation-timeline: view()` in Chrome/Edge 115+ and are
  skipped elsewhere. They animate `transform`, so they never fight the reveals:
  - the hero copy drifts up and fades faster than the heart as you leave;
  - input tile rows drift at different speeds;
  - feature cards leave in a diagonal cascade.
- **Nothing transforms the heart orb or its ancestors**, which would break the video's
  `screen` blend (see the Dashboard README).
- **Reduced motion:** everything is static, and the count-ups show their final numbers.

## Content rules

- Metrics are labelled as held-out test results from one hospital's data, with a caveat that they
  likely overstate real-world performance.
- The page carries the exact disclaimer: "Research prototype. Not externally validated, not
  approved for clinical use."
