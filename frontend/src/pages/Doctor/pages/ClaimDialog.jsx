import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../../../api/doctorApi';
import { ConfirmDialog, Findings, RiskTag, useToast } from '../ui';
import { fmtDateTime, patientLine } from '../format';

const TAKEN = 'This assessment has already been assigned to another doctor.';

/**
 * "Accept this clinical review?" for one queue row. The server decides the race:
 * if another doctor got there first, this says so and the queue refreshes.
 */
export default function ClaimDialog({ row, onClose, onTaken }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const taken = useRef(onTaken);
  useEffect(() => {
    taken.current = onTaken;
  });

  useEffect(() => {
    setQuestion('');
    if (!row) return undefined;
    let alive = true;
    doctorApi
      .request(row.id)
      .then((d) => alive && setQuestion(d.question || ''))
      .catch((err) => {
        if (alive && err.status === 409) {
          toast(TAKEN, 'error');
          taken.current();
        }
      });
    return () => {
      alive = false;
    };
  }, [row, toast]);

  const accept = async () => {
    setBusy(true);
    try {
      await doctorApi.claim(row.id);
      toast(`Assessment ${row.assessment} is now assigned to you.`);
      navigate(`/doctor/review/${row.id}`);
    } catch (err) {
      if (err.status === 409) {
        toast(TAKEN, 'error');
        onTaken();
      } else {
        toast(err.status === 403 && err.message.length < 200 ? err.message : 'Unable to accept this review request. Please try again.', 'error');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog open={Boolean(row)} title="Accept this clinical review?" confirmLabel="Accept Review" busy={busy} onConfirm={accept} onCancel={onClose}>
      {row && (
        <>
          <p>This assessment will be assigned to you. Other doctors will no longer be able to claim it.</p>
          <dl className="dr-kv" style={{ margin: '16px 0 0', padding: 12, border: '1px solid var(--dr-line)', borderRadius: 10 }}>
            <dt>Assessment</dt>
            <dd className="dr-ref">{row.assessment}</dd>
            <dt>Patient</dt>
            <dd>
              {row.patient.name} · {patientLine(row.patient)}
            </dd>
            <dt>Risk estimate</dt>
            <dd>
              <RiskTag risk={row.risk} />
            </dd>
            <dt>Key findings</dt>
            <dd>
              <Findings items={row.findings} />
            </dd>
            <dt>Requested</dt>
            <dd className="dr-num">{fmtDateTime(row.requested_at)}</dd>
            {question && (
              <>
                <dt>Patient’s question</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{question}</dd>
              </>
            )}
          </dl>
        </>
      )}
    </ConfirmDialog>
  );
}
