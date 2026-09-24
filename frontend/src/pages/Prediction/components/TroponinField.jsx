import Segmented from './Segmented';
import { TROPONIN_ASSAYS } from '../fields';

/**
 * Troponin-I needs its assay type: Quantitative reports ng/mL and
 * High-sensitivity reports ng/L, so the same number means very different
 * things. Switching assay clears the value instead of reinterpreting it.
 */
export default function TroponinField({ assay, value, onAssayChange, onValueChange, showError }) {
  const current = TROPONIN_ASSAYS[assay];

  return (
    <div className="pc-pr-fields">
      <Segmented
        id="pr-trop-assay"
        label="Assay type"
        options={Object.entries(TROPONIN_ASSAYS).map(([key, a]) => [key, `${a.label} · ${a.unit}`])}
        value={assay}
        onChange={onAssayChange}
      />

      <div className="pc-pr-field">
        <label className="pc-pr-label" htmlFor="pr-troponin">
          Troponin-I result
        </label>
        <div className={`pc-pr-unit-input${showError ? ' is-invalid' : ''}`}>
          <input
            id="pr-troponin"
            type="number"
            inputMode="decimal"
            min="0"
            step={current.step}
            placeholder={current.placeholder}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            aria-invalid={showError || undefined}
            aria-describedby="pr-trop-note"
            required
          />
          <span>{current.unit}</span>
        </div>
        <p id="pr-trop-note" className={`pc-pr-hint${showError ? ' is-error' : ''}`}>
          {showError
            ? 'Enter the Troponin-I result to run a prediction.'
            : `Enter the value as reported, in ${current.unit}. The two assays use different units and aren't interchangeable.`}
        </p>
      </div>
    </div>
  );
}
