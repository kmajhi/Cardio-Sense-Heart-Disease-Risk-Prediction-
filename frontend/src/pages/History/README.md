# Cardio Sense History page

Past risk estimates and the test results behind them, in the Cardio Sense theme.
The top of the page is a dashboard-style board: four tiles with animated charts beside
the glowing heart from the Dashboard, with tab pills and callouts pinned to the heart.

## Usage

Routed at `/history` in `src/App.jsx`. It reuses `../Dashboard/components/NavBar` and
`../Dashboard/Dashboard.css`. Without a `records` prop it uses `historyMock.js`.

## Data shape

Oldest first. Each record is one `/api/predict/` call, stored as-is:

```js
{
  id: 'A-1362',
  created_at: '2026-09-21T14:32:00',
  inputs: { age, sex, bp_mmhg, ldl, ..., troponin_i, troponin_assay },  // the request body (toPayload keys)
  result: { probability, risk_level, top_factors: [{ name, contribution }] },  // the response
}
```

`predictor/models.py` should save exactly this: the request JSON, the response JSON and a
timestamp. The page then needs no mapping.

## Sections

- **Overview board.** Everything animates once on load, and is static under reduced motion:
  - *Risk estimate:* latest vs first estimate (numbers count up), and a pill meter that fills to the latest value.
  - *Risk over time:* one rounded bar per assessment, growing from the baseline in order, with dashed
    lines at the 35% / 65% risk bands. Hover or focus a bar for its date and value.
  - *Latest test results:* a donut of the newest panel by status (segments draw in one by one), a legend,
    and one tile per test group. Hovering a segment or legend row shows its count in the middle.
  - *What moved it:* the top three factors of the latest estimate, a Details link to the records, and a
    "Run new prediction" button.
  - *Heart:* `HeartHero` without its CTA. The Overview / Lipids / Vitals pills swap the three callouts
    pinned to the heart, which pop in again on every switch.
- **Test results.** Every test's latest value, change since the previous panel, sparkline, typical
  range and status.
- **Assessment records.** Newest first. Each row opens (animated `grid-template-rows`) with a single
  scanner sweep, showing the full results grouped by panel plus the factors behind that estimate.

## Rules this page follows

- Every risk figure is labelled an *estimate*, and the page shows the required disclaimer:
  "Research prototype. Not externally validated, not approved for clinical use."
- **Troponin-I is never compared across assays.** When the assay changed between panels, the change
  column says "Assay changed", and the sparkline only uses results from the current assay.
- Reference ranges in `tests.js` are *typical adult* ranges, used only for a gentle "outside range"
  flag. The footnote says labs differ. Changes are shown neutrally (arrows, no good/bad colour),
  since "up" is good for HDL and bad for LDL.
- Every animation is off under `prefers-reduced-motion`.
- The heart video blends with `mix-blend-mode: screen`, so `.pc-h-board`, `.pc-h-heart` and
  `.pc-h-heart-stage` must not get `transform`, `filter`, `opacity`, `backdrop-filter` or `z-index`
  (see the Dashboard README). The callouts are siblings of the video, never wrappers.

## Files

- `History.jsx`: page layout and load sequence.
- `tests.js`: test list, units, typical ranges, troponin assay handling, change logic.
- `historyMock.js`: six sample assessments (the troponin assay switches in May on purpose).
- `board.js`: status counts, group summaries and risk labels used by the board.
- `components/`: `RiskSummaryCard`, `RiskBarsCard`, `TestsDonutCard`, `FactorsCard`, `HeartInsights`
  (the board), `LabTable`, `RecordList`.
- `History.css`: page styles, prefixed `pc-h-`.
