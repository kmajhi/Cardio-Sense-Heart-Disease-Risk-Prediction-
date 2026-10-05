// @vitest-environment jsdom
// The loading ring, the first-visit screen, and the Prediction loading card.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RingLoader from './RingLoader';
import BootScreen from './BootScreen';
import ResultCard from '../pages/Prediction/components/ResultCard';

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RingLoader', () => {
  it('draws 36 bars, hidden from screen readers, at the given size', () => {
    const { container } = render(<RingLoader size={90} />);
    const ring = container.querySelector('.rl-ring');
    expect(ring.getAttribute('aria-hidden')).toBe('true');
    expect(ring.style.getPropertyValue('--rl-size')).toBe('90px');
    expect(container.querySelectorAll('.rl-bar')).toHaveLength(36);
  });
});

describe('First-visit screen', () => {
  const at = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <BootScreen />
      </MemoryRouter>,
    );

  it('shows once per session on a page other than Home, then goes away', () => {
    vi.useFakeTimers();
    at('/about');
    expect(screen.getByRole('status', { name: 'Loading Cardio Sense' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    at('/about'); // same session: not again
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('leaves Home, the admin console and the Doctor Panel to their own screens', () => {
    for (const path of ['/', '/console/users', '/doctor']) {
      at(path);
      expect(screen.queryByRole('status')).toBeNull();
      cleanup();
    }
  });
});

describe('Prediction loading card', () => {
  it('replaces the result while the model runs', () => {
    render(<ResultCard status="loading" data={{ probability: 0.4, risk_level: 'moderate', top_factors: [] }} />);
    const card = screen.getByRole('status');
    expect(card.textContent).toMatch('Running the prediction');
    expect(card.querySelector('.rl-ring')).toBeTruthy();
    expect(screen.queryByText(/Estimated probability of heart disease/)).toBeNull();
  });

  it('is gone once the result is in', () => {
    render(<ResultCard status="idle" data={{ probability: 0.4, risk_level: 'moderate', top_factors: [] }} />);
    expect(screen.queryByText('Running the prediction')).toBeNull();
  });
});
