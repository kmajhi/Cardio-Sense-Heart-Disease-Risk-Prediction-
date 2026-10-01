import { useEffect, useState } from 'react';
import { siteStatus } from '../api/adminApi';
import { USE_MOCK } from '../api/mode';
import './SiteBanner.css';

/**
 * The announcement and maintenance notice set in the admin console
 * (Site controls), on every page for every visitor. Checked on load and
 * every 2 minutes; nothing shows when there's nothing to say.
 */
export default function SiteBanner() {
  const [site, setSite] = useState(null);
  useEffect(() => {
    if (USE_MOCK) return undefined;
    let alive = true;
    const load = () =>
      siteStatus()
        .then((s) => alive && setSite(s))
        .catch(() => {}); // server down: the pages say so themselves
    load();
    const id = setInterval(load, 120000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!site) return null;
  return (
    <>
      {site.maintenance_mode && (
        <div className="pc-site-banner is-critical" role="alert">
          {site.maintenance_message || 'Cardio Sense is down for maintenance.'}
        </div>
      )}
      {site.announcement && (
        <div className={`pc-site-banner is-${site.announcement_level}`} role="status">
          {site.announcement}
        </div>
      )}
    </>
  );
}
