import { USE_MOCK } from '../api/mode';
import './DemoBanner.css';

/**
 * Shown on every page while the app runs on the in-browser mock (QA C2): its
 * risk scores come from a hand-tuned formula, not the trained model, and must
 * never pass for real estimates.
 */
export default function DemoBanner() {
  if (!USE_MOCK) return null;
  return (
    <div className="pc-demo-banner" role="note">
      <strong>Demo mode.</strong> Risk scores here are illustrative, from a simple built-in formula, not the trained
      model. Your data stays in this browser.
    </div>
  );
}
