// @vitest-environment jsdom
// Ask a Doctor in demo mode (no server): a request about one of your assessments
// is kept in this browser per account and shows as pending until withdrawn.
// With the server the same page talks to /api/reviews/ (api/reviewApi.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AskDoctor from './AskDoctor';
import { loadRequests, reviewSteps } from './requests';

// Demo mode whatever .env.local says: no server in unit tests.
vi.mock('../../api/mode', () => ({ USE_MOCK: true }));

const records = [
  { id: 'A-0001', created_at: '2026-09-01T10:00:00', inputs: {}, result: { probability: 0.2, risk_level: 'low', top_factors: [] } },
  { id: 'A-0002', created_at: '2026-10-01T10:00:00', inputs: {}, result: { probability: 0.72, risk_level: 'high', top_factors: [{ name: 'LDL' }] } },
];

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Ask a Doctor', () => {
  it('asks for a prediction first when there are no assessments', () => {
    render(<AskDoctor records={[]} account="a@b.c" />);
    expect(screen.getByRole('link', { name: 'Run a prediction' }).getAttribute('href')).toBe('/prediction');
    expect(screen.queryByRole('button', { name: /Request Doctor Review/ })).toBeNull();
  });

  it('sends a question about the newest assessment, then lets it be withdrawn', async () => {
    render(<AskDoctor records={records} account="a@b.c" />);
    expect(screen.getByLabelText('Assessment').value).toBe('A-0002');
    const send = screen.getByRole('button', { name: /Request Doctor Review/ });
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is my LDL the main reason for my risk?' } });
    expect(send.disabled).toBe(true); // still needs the consent box
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(send);

    expect((await screen.findByText(/Request sent/)).textContent).toMatch(/submitted for clinical review/);
    const list = within(screen.getByRole('region', { name: 'Your requests' }));
    expect(await list.findByText('Is my LDL the main reason for my risk?')).toBeTruthy();
    expect(list.getByText('Pending Doctor Review')).toBeTruthy();
    expect(loadRequests('a@b.c')).toHaveLength(1);
    expect(loadRequests('other@b.c')).toHaveLength(0); // each account keeps its own
    // One open request per assessment.
    expect(screen.getByText(/already has a doctor review in progress/)).toBeTruthy();

    fireEvent.click(list.getByRole('button', { name: 'Withdraw' }));
    expect(await list.findByText(/No review requests yet/)).toBeTruthy();
    expect(loadRequests('a@b.c')).toHaveLength(0);
  });
});

describe('reviewSteps', () => {
  it('marks only what happened, in order', () => {
    const pending = reviewSteps({ status: 'pending', requested_at: '2026-10-04T09:42:00Z', timeline: [{ kind: 'requested', at: '2026-10-04T09:42:00Z' }] }, '2026-10-04T09:00:00Z');
    expect(pending.map((s) => Boolean(s.when))).toEqual([true, true, false, false, false, false]);

    const done = reviewSteps({
      status: 'completed',
      timeline: [
        { kind: 'requested', at: '1' },
        { kind: 'claimed', at: '2' },
        { kind: 'opened', at: '3' },
        { kind: 'submitted', at: '4' },
        { kind: 'report_updated', at: '5' },
      ],
    }, '0');
    expect(done.map((s) => s.when)).toEqual(['0', '1', '2', '3', '4', '5']);
  });
});
