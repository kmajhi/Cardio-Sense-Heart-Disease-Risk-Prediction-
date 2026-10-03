// @vitest-environment jsdom
// A page that fails to draw shows what happened and a way out, never a blank screen.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

afterEach(cleanup);

function Broken({ message }) {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  it('shows the error and a reload button instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary resetKey="/console">
        <Broken message="Cannot read properties of undefined (reading 'kpis')" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/couldn’t be shown.*reading 'kpis'/s);
    expect(screen.getByRole('button', { name: /reload page/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /go to the homepage/i })).toBeTruthy();
  });

  it('says a newer version is available when a page file from an old deploy is gone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem('cardio-sense:reloaded-for-new-version', '1'); // no auto-reload in the test
    render(
      <ErrorBoundary resetKey="/console">
        <Broken message="Failed to fetch dynamically imported module: https://x/assets/Console-old.js" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/newer version is available/i);
  });

  it('clears when the user moves to another page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="/console">
        <Broken message="boom" />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary resetKey="/dashboard">
        <p>Dashboard</p>
      </ErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });
});
