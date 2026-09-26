import { HeartMark } from '../pages/Dashboard/components/NavBar';
import { linkProps } from '../pages/Dashboard/link';
import { DISCLAIMER } from '../pages/About/content';
import './SiteFooter.css';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      ['Dashboard', '/'],
      ['Prediction', '/prediction'],
      ['History', '/history'],
      ['Guidance', '/guidance'],
      ['Profile', '/profile'],
    ],
  },
  {
    title: 'Project',
    links: [
      ['About', '/about'],
      ['How it works', '/about#a-how'],
      ['Model inputs', '/about#a-inputs'],
      ['How it was built', '/about#a-model'],
    ],
  },
];

/**
 * The footer every page has except the Dashboard (whose layout is a single
 * screen). Styled like the About page's original footer.
 */
export default function SiteFooter({ LinkComponent = 'a', activePath }) {
  const L = LinkComponent;
  return (
    <footer className="pc-footer">
      <div className="pc-footer-brand">
        <L {...linkProps(L, '/')} className="pc-footer-logo">
          <HeartMark /> Cardio Sense
        </L>
        <p>AI-assisted heart disease risk estimation for resource-limited clinics. A final-year CSE capstone project.</p>
      </div>
      <nav aria-label="Footer" className="pc-footer-nav">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2>{col.title}</h2>
            {col.links.map(([label, to]) => (
              <L key={to} {...linkProps(L, to)} aria-current={activePath === to ? 'page' : undefined}>
                {label}
              </L>
            ))}
          </div>
        ))}
      </nav>
      <p className="pc-footer-legal">© 2026 Cardio Sense · {DISCLAIMER}</p>
    </footer>
  );
}
