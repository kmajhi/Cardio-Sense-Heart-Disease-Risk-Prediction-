// @vitest-environment jsdom
// The PDF report button and the guidance snapshot it sends with each report.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { guidanceSnapshot, ENGINE } from '../clinical/snapshot';
import { recommend } from '../clinical/recommend';
import { buildNotification } from '../clinical/notifications';

const HIGH = {
  age: 66, sex: 'M', height_cm: 162, weight_kg: 78, family_history: 1, hypertension: 1, diabetes: 1,
  chest_pain_history: 1, bp_mmhg: 185, rbs_mmol_l: 14.5, total_cholesterol: 270, hdl: 32, ldl: 185,
  triglycerides: 280, hemoglobin: 11.2, creatinine: 1.9, platelets: 230000, sodium: 134, potassium: 4.6,
  chloride: 99, troponin_i: 850, troponin_assay: 'high-sensitivity',
};
const record = { id: 'A-0007', inputs: HIGH, result: { probability: 0.93, risk_level: 'high' } };

describe('guidanceSnapshot', () => {
  it('is exactly the advice the Guidance page shows, plus every finding', () => {
    const profile = { smoker: 'current', allergies: [], medications: [] };
    const snap = guidanceSnapshot(record, profile);
    const plan = recommend(buildNotification(record), profile);
    expect(snap.engine).toBe(ENGINE);
    expect(snap.sections.map((s) => s.items.map((i) => i.text))).toEqual(plan.sections.map((s) => s.items.map((i) => i.text)));
    expect(snap.urgent).toBe(true);
    expect(snap.findings.find((f) => f.key === 'bp_mmhg')).toMatchObject({ value: 185, unit: 'mmHg', level: 'urgent' });
    expect(snap.groups[0]).toMatchObject({ id: 'cardiac', level: 'urgent' });
    expect(snap.groups[0].why).toBeTruthy();
    expect(snap.used_profile).toBe(true);
  });

  it('has nothing to say without a result', () => {
    expect(guidanceSnapshot({ id: 'A-1', inputs: HIGH })).toBeNull();
  });
});

describe('ReportButton', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function load() {
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    vi.resetModules();
    return (await import('./ReportButton')).default;
  }

  it('makes one report at a time and says when it is done', async () => {
    const ReportButton = await load();
    let finish;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/guidance/')) return Promise.resolve(new Response('{"recorded_at":"x"}', { status: 200 }));
      return new Promise((resolve) => {
        finish = () =>
          resolve(new Response(new Blob(['%PDF']), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="cardio-sense-report-A-0007.pdf"',
            },
          }));
      });
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<ReportButton record={record} />);
    const button = screen.getByRole('button', { name: /download pdf health report/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText(/preparing your report/i);
    expect(screen.getByRole('button').disabled).toBe(true);
    await act(async () => finish());
    await screen.findByText(/downloaded cardio-sense-report-A-0007\.pdf/i);
    const reportCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/report/'));
    expect(reportCalls).toHaveLength(1);
    expect(reportCalls[0][0]).toBe('/api/history/A-0007/report/');
  });

  it('shows the server’s reason when it fails', async () => {
    const ReportButton = await load();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"detail":"No such assessment."}', { status: 404, headers: { 'Content-Type': 'application/json' } }),
    );
    render(<ReportButton record={record} />);
    fireEvent.click(screen.getByRole('button'));
    expect((await screen.findByRole('alert')).textContent).toBe('No such assessment.');
    expect(screen.getByRole('button').disabled).toBe(false);
  });

  it('is not offered for an estimate that was not saved', async () => {
    const ReportButton = await load();
    const { container } = render(<ReportButton record={{ inputs: HIGH, result: record.result }} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('ReportButton with a download manager', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('hands the download to a plain link when the page gets an empty response', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    vi.resetModules();
    const ReportButton = (await import('./ReportButton')).default;
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).endsWith('/guidance/') ? new Response('{}', { status: 200 }) : new Response(null, { status: 204 })),
    );
    const hrefs = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      hrefs.push(this.getAttribute('href'));
    });
    render(<ReportButton record={record} />);
    fireEvent.click(screen.getByRole('button'));
    await screen.findByText(/is downloading/i);
    expect(hrefs).toEqual(['/api/history/A-0007/report/']);
  });
});
