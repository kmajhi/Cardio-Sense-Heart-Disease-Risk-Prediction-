import { linkProps } from '../../../components/link';

export default function AlertCard({ alert, LinkComponent }) {
  if (!alert) return null;
  const L = LinkComponent;
  return (
    <aside className="pc-alert pc-enter" style={{ '--d': '520ms', '--pc-rise': '60px' }}>
      <span className="pc-alert-dot" aria-hidden="true" />
      <div>
        <p className="pc-alert-title">{alert.title}</p>
        {alert.detail && <p className="pc-alert-detail">{alert.detail}</p>}
        <L {...linkProps(L, alert.href ?? '/history')} className="pc-alert-link">
          {alert.linkLabel ?? 'See details'}
        </L>
      </div>
    </aside>
  );
}
