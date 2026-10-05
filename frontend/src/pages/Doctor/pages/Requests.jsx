import { useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doctorApi } from '../../../api/doctorApi';
import { Empty, Icon, LoadError, Pager, RequestList, Skeleton, useLoad } from '../ui';
import ClaimDialog from './ClaimDialog';

const BLANK = { q: '', risk: '', attention: '', age_min: '', age_max: '', date_from: '', date_to: '', sort: 'priority' };

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** The open queue: every pending request this doctor could accept, filtered on the server. */
export default function Requests({ me, refreshCounts, blocked }) {
  const ids = { risk: useId(), sort: useId(), amin: useId(), amax: useId(), from: useId(), to: useId(), panel: useId() };
  const [params] = useSearchParams();
  const [f, setF] = useState(() => ({ ...BLANK, attention: params.get('attention') === '1' ? '1' : '' }));
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [claiming, setClaiming] = useState(null);
  const q = useDebounced(f.q);
  const query = { ...f, q, page };
  const key = JSON.stringify(query);
  const { data, error, loading, reload } = useLoad(() => (blocked ? Promise.resolve(null) : doctorApi.requests(JSON.parse(key))), [key, blocked]);

  const set = (k) => (e) => {
    setPage(1);
    setF((cur) => ({ ...cur, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value }));
  };
  const active = Object.entries(f).filter(([k, v]) => k !== 'q' && k !== 'sort' && v).length;
  const onTaken = useCallback(() => {
    setClaiming(null);
    reload();
    refreshCounts();
  }, [reload, refreshCounts]);

  return (
    <>
      <div className="dr-page-head">
        <div>
          <h1 className="dr-h1">Review Requests</h1>
          <p className="dr-sub">Patient assessments waiting for clinical review.</p>
        </div>
      </div>
      {blocked ? null : (
        <section className="dr-card dr-section">
          <div className="dr-toolbar">
            <div className="dr-search">
              <Icon name="search" size={16} />
              <label className="dr-sr" htmlFor="dr-q">
                Search requests
              </label>
              <input id="dr-q" className="dr-input" type="search" placeholder="Patient name or assessment ID" value={f.q} onChange={set('q')} />
            </div>
            <label className="dr-sr" htmlFor={ids.sort}>
              Sort
            </label>
            <select id={ids.sort} className="dr-select" value={f.sort} onChange={set('sort')}>
              <option value="priority">Priority</option>
              <option value="oldest">Oldest first</option>
              <option value="newest">Newest first</option>
            </select>
            <button type="button" className="dr-btn is-secondary" aria-expanded={showFilters} aria-controls={ids.panel} onClick={() => setShowFilters((v) => !v)}>
              <Icon name="filter" size={16} /> Filters{active ? ` (${active})` : ''}
            </button>
            {active > 0 && (
              <button type="button" className="dr-btn is-ghost" onClick={() => setF({ ...BLANK, q: f.q, sort: f.sort })}>
                Clear
              </button>
            )}
            {showFilters && (
              <div className="dr-filters" id={ids.panel}>
                <div className="dr-field">
                  <label className="dr-label" htmlFor={ids.risk}>
                    Risk category
                  </label>
                  <select id={ids.risk} className="dr-select" style={{ width: '100%' }} value={f.risk} onChange={set('risk')}>
                    <option value="">Any</option>
                    <option value="high">High</option>
                    <option value="moderate">Moderate</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="dr-field">
                  <label className="dr-label" htmlFor={ids.amin}>
                    Age from
                  </label>
                  <input id={ids.amin} className="dr-input" type="number" min="0" max="120" value={f.age_min} onChange={set('age_min')} />
                </div>
                <div className="dr-field">
                  <label className="dr-label" htmlFor={ids.amax}>
                    Age to
                  </label>
                  <input id={ids.amax} className="dr-input" type="number" min="0" max="120" value={f.age_max} onChange={set('age_max')} />
                </div>
                <div className="dr-field">
                  <label className="dr-label" htmlFor={ids.from}>
                    Requested from
                  </label>
                  <input id={ids.from} className="dr-input" type="date" value={f.date_from} onChange={set('date_from')} />
                </div>
                <div className="dr-field">
                  <label className="dr-label" htmlFor={ids.to}>
                    Requested to
                  </label>
                  <input id={ids.to} className="dr-input" type="date" value={f.date_to} onChange={set('date_to')} />
                </div>
                <label className="dr-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end', minHeight: 36 }}>
                  <input type="checkbox" checked={f.attention === '1'} onChange={set('attention')} />
                  <span className="dr-label">Needs attention only</span>
                </label>
              </div>
            )}
          </div>
          {loading && !data ? (
            <Skeleton rows={5} />
          ) : error ? (
            <LoadError error={error} onRetry={reload} />
          ) : data.results.length === 0 ? (
            active || f.q ? (
              <Empty icon="search" title="No matching requests">
                Try a different search or clear the filters.
              </Empty>
            ) : (
              <Empty title="No review requests">You’re all caught up. New assessments will appear here when they are available.</Empty>
            )
          ) : (
            <>
              <RequestList rows={data.results} action={(row) => (me.is_available ? { label: 'Review Request', tone: 'primary', onClick: () => setClaiming(row) } : null)} />
              <Pager data={data} page={page} onPage={setPage} />
            </>
          )}
        </section>
      )}
      {!blocked && !me.is_available && (
        <div className="dr-callout is-info">
          <Icon name="info" />
          <p>You’re marked unavailable, so you can’t accept new requests. Set yourself available on your Profile or the Dashboard.</p>
        </div>
      )}
      <p className="dr-help" style={{ marginTop: 16 }}>
        “Higher model-estimated risk” reflects the machine-learning estimate only; it is not a clinical urgency assessment.
      </p>
      <ClaimDialog row={claiming} onClose={() => setClaiming(null)} onTaken={onTaken} />
    </>
  );
}
