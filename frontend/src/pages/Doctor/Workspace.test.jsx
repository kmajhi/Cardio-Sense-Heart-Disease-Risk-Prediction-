// @vitest-environment jsdom
// The clinical review workspace: shows the saved case with each section's
// origin labelled, checks completeness before submitting, confirms, and
// submits once even when clicked twice.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GUIDANCE from '../../../../backend/tests/guidance_samples.json';
import { doctorApi } from '../../api/doctorApi';
import Workspace from './pages/Workspace';
import { ToastProvider } from './ui';

vi.mock('../../api/doctorApi', () => ({
  doctorApi: { review: vi.fn(), saveDraft: vi.fn(), submit: vi.fn(), reportUrl: (id) => `/api/doctor/reviews/${id}/report/` },
  notificationsApi: { list: vi.fn(), markRead: vi.fn() },
}));

const inputs = { age: 48, sex: 'M', height_cm: 170, weight_kg: 78, bp_mmhg: 132, ldl: 135, hypertension: 1, diabetes: 0 };
const ws = (extra = {}) => ({
  id: 'R-0001',
  assessment: 'A-0058',
  assessment_date: '2026-10-04T09:00:00Z',
  patient: { name: 'Test Patient', age: 48, sex: 'M' },
  risk: { probability: 0.52, level: 'moderate' },
  urgent: false,
  findings: [],
  topic: 'tests',
  topic_label: 'My test values',
  question: 'Is my LDL the main reason?',
  status: 'under_review',
  status_label: 'Currently Under Review',
  doctor: { name: 'Test Doctor', doctor_id: 'DR-0001', specialty: 'Cardiology', verified: true },
  requested_at: '2026-10-04T09:42:00Z',
  claimed_at: '2026-10-04T10:12:00Z',
  completed_at: null,
  decision: '',
  decision_label: '',
  assessment_detail: {
    id: 'A-0058',
    created_at: '2026-10-04T09:00:00Z',
    inputs,
    result: { probability: 0.52, risk_level: 'moderate', top_factors: [{ name: 'Age', contribution: 0.1 }], missing_fields: ['Hemoglobin'], outside_training: [], low_confidence: true },
    model: { name: 'Random Forest', trained_at: '2026-09-20T00:00:00Z', calibration: 'isotonic' },
    guidance: GUIDANCE.moderate,
  },
  review: null,
  timeline: [
    { kind: 'requested', label: 'Review requested', at: '2026-10-04T09:42:00Z', by: 'Test Patient' },
    { kind: 'claimed', label: 'Accepted by doctor', at: '2026-10-04T10:12:00Z', by: 'Dr. Test Doctor' },
  ],
  reports: [{ version: 1, label: 'Automated assessment report', reviewed: false }],
  ...extra,
});

function show() {
  return render(
    <MemoryRouter initialEntries={['/doctor/review/R-0001']}>
      <ToastProvider>
        <Routes>
          <Route path="/doctor/review/:id" element={<Workspace refreshCounts={() => {}} />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Clinical review workspace', () => {
  it('shows the saved case and labels where each part comes from', async () => {
    doctorApi.review.mockResolvedValue(ws());
    show();
    expect(await screen.findByRole('heading', { name: 'Clinical Review' })).toBeTruthy();
    const risk = within(screen.getByRole('region', { name: 'Machine-Learning Risk Estimate' }));
    expect(risk.getByText('52%')).toBeTruthy();
    expect(risk.getByText('Machine-learning output')).toBeTruthy();
    expect(risk.getByText(/Model: Random Forest, probabilities calibrated by isotonic/)).toBeTruthy();
    expect(risk.getByText(/Not measured \(filled in by the model/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'AI-Generated Recommendations' })).getByText('Automated guidance')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Patient Summary' })).getByText('Is my LDL the main reason?')).toBeTruthy();
    const table = within(screen.getByRole('region', { name: 'Complete Health Information' }));
    expect(table.getByText('Blood pressure')).toBeTruthy();
    // Nothing is prefilled in the doctor's form.
    expect(screen.getByLabelText(/Diagnosis & advice/).value).toBe('');
  });

  it('checks completeness, confirms, and submits only once', async () => {
    doctorApi.review.mockResolvedValue(ws());
    let finish;
    doctorApi.submit.mockImplementation(() => new Promise((r) => (finish = r)));
    show();
    await screen.findByRole('heading', { name: 'Clinical Review' });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Clinical Review' }));
    expect(screen.getByRole('alert').textContent).toMatch('Select a review decision.');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByLabelText('Follow-up Required'));
    fireEvent.change(screen.getByLabelText(/Diagnosis & advice/), { target: { value: 'Blood pressure above target.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Clinical Review' }));
    expect(screen.getByRole('alert').textContent).toMatch(/action plan/);

    fireEvent.change(screen.getByLabelText(/Clinical Action Plan/), { target: { value: 'Home BP readings for 2 weeks.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Clinical Review' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Submit Clinical Review?' }));
    expect(dialog.getByText(/finalize your review for Assessment A-0058/)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Submit Review' }));
    fireEvent.click(dialog.getByRole('button', { name: /Please wait|Submit Review/ }));
    expect(doctorApi.submit).toHaveBeenCalledTimes(1);
    expect(doctorApi.submit.mock.calls[0][1]).toEqual({
      decision: 'follow_up_required',
      remarks: 'Blood pressure above target.',
      medications: [],
      action_plan: 'Home BP readings for 2 weeks.',
      notes: '',
    });

    doctorApi.review.mockResolvedValue(ws({ status: 'completed', status_label: 'Doctor Review Completed' }));
    finish(ws());
    expect(await screen.findByRole('heading', { name: 'Clinical Review Submitted' })).toBeTruthy();
  });

  it('writes a prescription with medicines and sends them without row keys', async () => {
    doctorApi.review.mockResolvedValue(ws());
    doctorApi.saveDraft.mockResolvedValue({ updated_at: '2026-10-04T10:30:00Z' });
    show();
    const rx = within(await screen.findByRole('region', { name: /Doctor’s Prescription/ }));
    expect(rx.getByText(/No medicines prescribed/)).toBeTruthy();

    fireEvent.click(rx.getByRole('button', { name: /Add medicine/ }));
    const first = within(rx.getByRole('group', { name: 'Medicine 1' }));
    fireEvent.change(first.getByLabelText('Strength'), { target: { value: '20 mg' } });
    fireEvent.click(screen.getByLabelText('Approved'));
    fireEvent.change(rx.getByLabelText(/Diagnosis & advice/), { target: { value: 'Raised LDL.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Clinical Review' }));
    expect(screen.getByRole('alert').textContent).toMatch('Enter the name of medicine 1, or remove that row.');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.change(first.getByLabelText('Medicine'), { target: { value: 'Atorvastatin' } });
    fireEvent.change(first.getByLabelText('Timing'), { target: { value: 'After meals' } });
    fireEvent.click(rx.getByRole('button', { name: /Add medicine/ }));
    fireEvent.click(rx.getByRole('button', { name: 'Remove medicine 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(doctorApi.saveDraft.mock.calls[0][1].medications).toEqual([
      { name: 'Atorvastatin', strength: '20 mg', frequency: '', timing: 'After meals', duration: '', instructions: '' },
    ]);
  });

  it('shows a submitted review read-only', async () => {
    doctorApi.review.mockResolvedValue(
      ws({
        status: 'completed',
        status_label: 'Doctor Review Completed',
        review: { status: 'submitted', decision: 'approved', decision_label: 'Approved', remarks: 'All reviewed.', medications: [{ name: 'Aspirin', strength: '75 mg', frequency: 'Once daily, morning (1-0-0)', timing: 'After meals', duration: 'Long term', instructions: '' }], action_plan: '', notes: '', submitted_at: '2026-10-04T10:36:00Z' },
      }),
    );
    show();
    expect(await screen.findByText('All reviewed.')).toBeTruthy();
    expect(screen.getByText('Aspirin')).toBeTruthy();
    expect(screen.getByText('Long term')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit Clinical Review' })).toBeNull();
    expect(screen.queryByLabelText(/Diagnosis & advice/)).toBeNull();
    expect(screen.getByRole('link', { name: /Updated report/ }).getAttribute('href')).toBe('/api/doctor/reviews/R-0001/report/');
  });

  it('explains when a review is not assigned to this doctor', async () => {
    doctorApi.review.mockRejectedValue(Object.assign(new Error('No such review'), { status: 404 }));
    show();
    expect(await screen.findByText('This review isn’t available to you')).toBeTruthy();
  });
});
