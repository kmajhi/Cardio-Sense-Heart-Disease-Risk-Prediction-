import { useEffect, useState } from 'react';
import { doctorApi } from '../../../api/doctorApi';
import { Empty, Icon, LoadError, Pager, RequestList, Skeleton, useLoad } from '../ui';

const COPY = {
  active: {
    title: 'My Active Reviews',
    sub: 'Assessments assigned to you and still under review.',
    empty: ['No active reviews', 'You don’t currently have any assessments under review.'],
    icon: 'clipboard',
  },
  completed: {
    title: 'Completed Reviews',
    sub: 'Reviews you have submitted. They are read-only: the patient’s record keeps exactly what you submitted.',
    empty: ['No completed reviews yet', 'Reviews you submit will be listed here.'],
    icon: 'checkCircle',
  },
};

/** The doctor's own reviews: active (under review) or completed. */
export default function MyReviews({ scope, blocked }) {
  const copy = COPY[scope];
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useLoad(
    () => (blocked ? Promise.resolve(null) : doctorApi.reviews({ scope, q: search, page })),
    [scope, search, page, blocked],
  );

  const completed = scope === 'completed';
  return (
    <>
      <div className="dr-page-head">
        <div>
          <h1 className="dr-h1">{copy.title}</h1>
          <p className="dr-sub">{copy.sub}</p>
        </div>
      </div>
      {blocked ? null : (
        <section className="dr-card dr-section">
          <div className="dr-toolbar">
            <div className="dr-search">
              <Icon name="search" size={16} />
              <label className="dr-sr" htmlFor={`dr-q-${scope}`}>
                Search
              </label>
              <input id={`dr-q-${scope}`} className="dr-input" type="search" placeholder="Patient name or assessment ID" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {loading && !data ? (
            <Skeleton rows={4} />
          ) : error ? (
            <LoadError error={error} onRetry={reload} />
          ) : data.results.length === 0 ? (
            search ? (
              <Empty icon="search" title="Nothing matches that search" />
            ) : (
              <Empty icon={copy.icon} title={copy.empty[0]}>
                {copy.empty[1]}
              </Empty>
            )
          ) : (
            <>
              <RequestList
                rows={data.results}
                columns={completed ? ['assessment', 'patient', 'risk', 'requested', 'decision', 'status'] : ['assessment', 'patient', 'risk', 'findings', 'requested', 'status']}
                dateKey={completed ? 'completed_at' : 'claimed_at'}
                dateLabel={completed ? 'Review date' : 'Review started'}
                action={(row) =>
                  completed ? { label: 'View Review', to: `/doctor/review/${row.id}` } : { label: 'Continue Review', tone: 'primary', to: `/doctor/review/${row.id}` }
                }
              />
              <Pager data={data} page={page} onPage={setPage} />
            </>
          )}
        </section>
      )}
    </>
  );
}
