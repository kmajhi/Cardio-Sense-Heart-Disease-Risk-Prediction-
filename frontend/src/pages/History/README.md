# Cardio Sense History page

Past risk estimates and the test results behind them, in the Cardio Sense theme.
The overview row follows the reference video's feature cards: three small illustrations
that play once on load and replay on hover or keyboard focus.

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

- **Overview.** Each card replays when hovered or focused (`useReplay` remounts the animated part):
  - *Latest test results:* a scanner beam sweeps the newest lab panel, then a "Panel reviewed" chip pops in.
  - *Latest risk estimate:* the arc around the hexagon fades and redraws to the latest probability.
  - *Risk over time:* the headline change blurs back in, and the nodes pop in one by one while the line stays put.
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

## Files

- `History.jsx`: page layout and load sequence.
- `tests.js`: test list, units, typical ranges, troponin assay handling, change logic.
- `historyMock.js`: six sample assessments (the troponin assay switches in May on purpose).
- `components/`: `ScanCard`, `GaugeCard`, `TrendCard`, `LabTable`, `RecordList`, `useReplay`.
- `History.css`: page styles, prefixed `pc-h-`.
