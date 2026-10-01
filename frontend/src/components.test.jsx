// @vitest-environment jsdom
// Component tests for the QA fixes: what users see and click, not just the pure logic.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import SliderField from './pages/Prediction/components/SliderField';
import ResultCard from './pages/Prediction/components/ResultCard';
import DemoBanner from './components/DemoBanner';
import ShareDialog from './pages/Profile/components/ShareDialog';
import AuthModal from './pages/Home/AuthModal';
import { EMPTY_PROFILE } from './pages/Profile/profileFields';

// The mock/API switch, set per test (vitest would otherwise read the developer's .env.local).
const mode = vi.hoisted(() => ({ mock: true }));
vi.mock('./api/mode', () => ({
  get USE_MOCK() {
    return mode.mock;
  },
}));

// Which Google / X sign-ins the "server" has keys for, and where a click went.
const oauth = vi.hoisted(() => ({ providers: {}, started: [] }));
vi.mock('./api/connectApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getProviders: () => Promise.resolve(oauth.providers),
}));
vi.mock('./api/authApi', async (importOriginal) => ({
  ...(await importOriginal()),
  signInWith: (id) => oauth.started.push(id),
}));

afterEach(() => {
  cleanup();
  mode.mock = true;
  oauth.providers = {};
  oauth.started = [];
});

// jsdom has no <dialog> methods; the Profile modals call them.
HTMLDialogElement.prototype.showModal ??= function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function close() {
  this.open = false;
};

const POTASSIUM = { key: 'potassium', label: 'Potassium', unit: 'mmol/L', min: 2, max: 7, step: 0.1, limit: [1.5, 10], optional: true };

function Field({ initial = 4.1, onValue = () => {} }) {
  const [value, setValue] = useState(initial);
  return (
    <SliderField
      field={POTASSIUM}
      value={value}
      fallback={4.1}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('"Not measured" labs (QA H2)', () => {
  it('sends null instead of a stand-in value, and brings the typical value back when unticked', () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const box = screen.getByRole('checkbox', { name: /not measured/i });

    fireEvent.click(box);
    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('slider').disabled).toBe(true);
    expect(screen.getByText(/the model fills it in/i)).toBeTruthy();

    fireEvent.click(box);
    expect(onValue).toHaveBeenLastCalledWith(4.1);
    expect(screen.getByRole('slider').disabled).toBe(false);
  });

  it('only optional fields offer it', () => {
    render(<SliderField field={{ ...POTASSIUM, optional: false }} value={4} onChange={() => {}} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('Result card', () => {
  const data = {
    probability: 0.42,
    risk_level: 'moderate',
    top_factors: [{ name: 'LDL', contribution: 0.1 }],
    missing_fields: ['Sodium', 'Potassium', 'Chloride'],
    low_confidence: true,
  };

  it('names imputed labs and flags low confidence (QA H3)', () => {
    render(<ResultCard status="idle" data={data} stale={false} error="" notification={null} />);
    expect(screen.getByText(/low confidence/i)).toBeTruthy();
    expect(screen.getByText(/estimated without sodium, potassium, chloride/i)).toBeTruthy();
  });

  it('labels demo-mode scores as illustrative (QA C2)', () => {
    render(<ResultCard status="idle" data={data} stale={false} error="" notification={null} />);
    expect(screen.getByRole('heading', { name: /illustrative score \(demo\)/i })).toBeTruthy();
  });

  it('calls a real estimate a model estimate', () => {
    mode.mock = false;
    render(<ResultCard status="idle" data={data} stale={false} error="" notification={null} />);
    expect(screen.getByRole('heading', { name: /^model estimate$/i })).toBeTruthy();
  });

  it('warns when an estimate came from the old troponin model (QA C1)', () => {
    const old = { ...data, missing_fields: [], top_factors: [{ name: 'Troponin-I', contribution: 0.38 }] };
    render(<ResultCard status="idle" data={old} stale={false} error="" notification={null} />);
    expect(screen.getByText(/older model/i)).toBeTruthy();
  });

  it('never shows a flat 100%', () => {
    render(<ResultCard status="idle" data={{ ...data, probability: 1 }} stale={false} error="" notification={null} />);
    expect(screen.getByText('>99')).toBeTruthy();
  });
});

describe('Demo banner (QA C2)', () => {
  it('is shown in mock mode', () => {
    render(<DemoBanner />);
    expect(screen.getByRole('note').textContent).toMatch(/not the trained model/i);
  });

  it('is hidden with the real API', () => {
    mode.mock = false;
    render(<DemoBanner />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('Share dialog (QA M3)', () => {
  it('attaches the full report only after an explicit confirmation', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const records = [
      { id: 'A-0001', created_at: '2026-01-01T00:00:00Z', inputs: {}, result: { probability: 0.3, risk_level: 'low', top_factors: [] } },
    ];
    const reportFile = () => new File(['<html></html>'], 'report.html', { type: 'text/html' });
    render(
      <ShareDialog open onClose={() => {}} profile={EMPTY_PROFILE} records={records} reportFile={reportFile} notify={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /more…/i }));
    expect(share).toHaveBeenLastCalledWith(expect.not.objectContaining({ files: expect.anything() }));

    fireEvent.click(screen.getByRole('button', { name: /send the full health report/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/medications, allergies, emergency contact/);
    fireEvent.click(screen.getByRole('button', { name: /^share full report$/i }));
    expect(share).toHaveBeenLastCalledWith(expect.objectContaining({ files: [expect.any(File)] }));

    delete navigator.share;
    delete navigator.canShare;
  });
});

describe('Login dialog (QA L8)', () => {
  const props = { mode: 'login', onMode: () => {}, onClose: () => {}, login: vi.fn(), register: vi.fn(), onSignedIn: () => {} };

  it('shows no Google / X buttons when the server has no keys for them', async () => {
    render(<AuthModal {...props} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^login$/i })).toBeTruthy());
    expect(screen.queryByRole('button', { name: /google|facebook|with x/i })).toBeNull();
  });

  it('offers Continue with Google / X for configured providers and starts that sign-in', async () => {
    oauth.providers = { gmail: true, x: true };
    render(<AuthModal {...props} />);
    const google = await screen.findByRole('button', { name: /continue with google/i });
    expect(screen.getByRole('button', { name: /continue with x/i })).toBeTruthy();
    fireEvent.click(google);
    expect(oauth.started).toEqual(['gmail']);
    expect(screen.getByRole('button', { name: /opening google/i }).disabled).toBe(true);
  });

  it('only shows the providers that are set up', async () => {
    oauth.providers = { gmail: true, x: false };
    render(<AuthModal {...props} mode="register" />);
    expect(await screen.findByRole('button', { name: /sign up with google/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /with x/i })).toBeNull();
  });

  it('shows why a Google / X sign-in came back refused', () => {
    render(<AuthModal {...props} initialError="An account with this email already exists." />);
    expect(screen.getByRole('alert').textContent).toMatch(/already exists/);
  });

  it('offers a password reset', () => {
    render(<AuthModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back to log in/i }));
    expect(screen.getByRole('button', { name: /^login$/i })).toBeTruthy();
  });

  it('keeps keyboard focus inside the dialog: Tab wraps around', () => {
    // jsdom has no layout (offsetParent is always null), so treat every element as visible.
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function parent() {
      return this.parentNode;
    });
    try {
      render(<AuthModal {...props} />);
      const dialog = screen.getByRole('dialog');
      const items = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')].filter(
        (el) => !el.closest('[inert]'),
      );
      items.at(-1).focus();
      fireEvent.keyDown(window, { key: 'Tab' });
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(items.at(-1));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Patient ranges: adults of any realistic age and size', () => {
  const AGE = { key: 'age', label: 'Age', unit: 'yrs', min: 18, max: 110, step: 1, limit: [1, 120], train: [18, 97], adultFrom: 18 };

  it('accepts a 105-year-old and says the model treats it like its oldest patient', () => {
    render(<SliderField field={AGE} value={105} onChange={() => {}} />);
    expect(screen.getByText(/beyond the training data \(18–97 yrs\): the model treats it like 97 yrs/i)).toBeTruthy();
  });

  it('explains that a child gets no estimate instead of calling the value impossible', () => {
    render(<SliderField field={AGE} value={12} onChange={() => {}} />);
    expect(screen.getByRole('alert').textContent).toMatch(/under 18: the model only estimates adults/i);
    expect(screen.queryByText(/aren.t possible/)).toBeNull();
  });

  it('blocks the run with the reason, and names out-of-range values in the result', async () => {
    const { patientError, DEFAULTS } = await import('./pages/Prediction/fields');
    expect(patientError({ ...DEFAULTS, age: 105, weight: 150, height: 180 })).toBe('');
    expect(patientError({ ...DEFAULTS, age: 9 })).toMatch(/adults \(18 or over\) only/);
    expect(patientError({ ...DEFAULTS, height: 60, weight: 300 })).toMatch(/BMI of 833/);

    const blocked = patientError({ ...DEFAULTS, age: 9 });
    render(<ResultCard status="idle" data={null} stale={false} error="" notification={null} blocked={blocked} />);
    expect(screen.getByRole('alert').textContent).toMatch(/no estimate for this patient/i);
    expect(screen.getByRole('button', { name: /run/i }).disabled).toBe(true);
  });

  it('lists values beyond the training data under the estimate', () => {
    const data = {
      probability: 0.9, risk_level: 'high', top_factors: [], missing_fields: [], low_confidence: true,
      outside_training: [{ name: 'Age', value: 105, min: 18, max: 97, unit: 'years' }],
    };
    render(<ResultCard status="idle" data={data} stale={false} error="" notification={null} />);
    expect(screen.getByText(/age 105 years \(highest seen 97\)/i)).toBeTruthy();
  });
});
