/**
 * Pill toggle group (the design's segmented selectors).
 * options: [[value, text], ...]. `inline` puts the label beside the pills.
 */
export default function Segmented({ id, label, options, value, onChange, inline = false }) {
  return (
    <div className={`pc-pr-field${inline ? ' pc-pr-field--inline' : ''}`}>
      <span className="pc-pr-label" id={id}>
        {label}
      </span>
      <div className="pc-pr-seg" role="group" aria-labelledby={id}>
        {options.map(([optionValue, text]) => (
          <button
            key={optionValue}
            type="button"
            className="pc-pr-seg-btn"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
