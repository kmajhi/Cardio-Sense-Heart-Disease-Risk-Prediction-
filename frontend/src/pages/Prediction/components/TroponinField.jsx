import Segmented from './Segmented';
import { TROPONIN_ASSAYS } from '../fields';

/**
 * Troponin-I needs its assay type: Quantitative reports ng/mL and
 * High-sensitivity reports ng/L, so the same number means very different
 * things. Switching assay clears the value instead of reinterpreting it.
 */
export default function TroponinField({ assay, value, onAssayChange, onValueChange, error, help, status }) {
  const current = TROPONIN_ASSAYS[assay];
  const showError = Boolean(error);

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
        <span className="pc-pr-label-row">
          <label className="pc-pr-label" htmlFor="pr-troponin">
            Troponin-I result
          </label>
          {help}
          {status?.band && !error && (
            <span className={`pc-pr-chip is-${status.level}`}>
              <span aria-hidden="true" className="pc-pr-chip-dot" />
              {status.band}
            </span>
          )}
        </span>
        <div className={`pc-pr-unit-input${showError ? ' is-invalid' : ''}`}>
          <input
            id="pr-troponin"
            type="number"
            inputMode="decimal"
            min="0"
            max={current.max}
            step={current.step}
            placeholder={current.placeholder}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            aria-invalid={showError || undefined}
            aria-describedby="pr-trop-note"
          />
          <span>{current.unit}</span>
        </div>
        <p id="pr-trop-note" className={`pc-pr-hint${showError ? ' is-error' : ''}`}>
          {showError
            ? error
            : `Optional. Enter the value as reported, in ${current.unit}; it's checked against the assay's clinical limit. The model doesn't use it (it ran backwards in the training data).`}
        </p>
      </div>
    </div>
  );
}
