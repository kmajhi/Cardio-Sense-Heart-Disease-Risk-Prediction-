import { linkProps } from '../../Dashboard/link';

/** "What moved it": the top factors of the latest estimate, and a way to run a new one. */
export default function FactorsCard({ record, LinkComponent }) {
  const L = LinkComponent;
  const factors = record.result.top_factors.slice(0, 3);

  return (
    <article className="pc-h-tile pc-h-tile--factors pc-enter" style={{ '--d': '400ms' }} aria-labelledby="h-factors-title">
      <header className="pc-h-tile-head">
        <h2 id="h-factors-title" className="pc-h-tile-title">What moved it</h2>
        <a href="#h-records" className="pc-h-ghost-btn">
          Details
        </a>
      </header>

      <ul className="pc-h-factor-rows">
        {factors.map((f, i) => {
          const up = f.contribution > 0;
          return (
            <li key={f.name} style={{ '--i': i }}>
              <span className={`pc-h-factor-icon ${up ? 'is-up' : 'is-down'}`} aria-hidden="true">
                {up ? '↗' : '↘'}
              </span>
              <span className="pc-h-factor-text">
                <span>{f.name}</span>
                <span className={up ? 'is-up' : 'is-down'}>
                  {up ? 'Raised' : 'Lowered'} {Math.abs(f.contribution * 100).toFixed(1)} pts
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <L {...linkProps(L, '/prediction')} className="pc-h-cta">
        Run new prediction
        <span className="pc-hero-cta-arrow" aria-hidden="true">
          →
        </span>
      </L>
    </article>
  );
}
