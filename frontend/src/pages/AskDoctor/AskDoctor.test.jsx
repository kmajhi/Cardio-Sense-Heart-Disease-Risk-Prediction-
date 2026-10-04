// @vitest-environment jsdom
// Ask a Doctor (demo phase): send a question about one of your assessments;
// it's kept in this browser per account and shows as pending until withdrawn.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AskDoctor from './AskDoctor';
import { loadRequests } from './requests';

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
    expect(screen.queryByRole('button', { name: /Send to a doctor/ })).toBeNull();
  });

  it('sends a question about the newest assessment, then lets it be withdrawn', () => {
    render(<AskDoctor records={records} account="a@b.c" />);
    expect(screen.getByLabelText('Assessment').value).toBe('A-0002');
    const send = screen.getByRole('button', { name: /Send to a doctor/ });
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is my LDL the main reason for my risk?' } });
    expect(send.disabled).toBe(true); // still needs the consent box
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(send);

    expect(screen.getByRole('status').textContent).toMatch(/Request sent/);
    const list = within(screen.getByRole('region', { name: 'Your requests' }));
    expect(list.getByText('Is my LDL the main reason for my risk?')).toBeTruthy();
    expect(list.getByText(/Pending review/)).toBeTruthy();
    expect(loadRequests('a@b.c')).toHaveLength(1);
    expect(loadRequests('other@b.c')).toHaveLength(0); // each account keeps its own

    fireEvent.click(list.getByRole('button', { name: 'Withdraw' }));
    expect(loadRequests('a@b.c')).toHaveLength(0);
  });
});
