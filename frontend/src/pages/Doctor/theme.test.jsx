// @vitest-environment jsdom
// Doctor Panel day / night mode: the choice is applied to <html> while the panel
// is open, remembered in this browser, and removed when leaving the panel.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemePicker, ThemeProvider } from './ui';

let osDark = false;
beforeEach(() => {
  localStorage.clear();
  osDark = false;
  window.matchMedia = vi.fn(() => ({ matches: osDark, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(cleanup);

const show = () =>
  render(
    <ThemeProvider>
      <ThemePicker />
    </ThemeProvider>,
  );
const theme = () => document.documentElement.dataset.drTheme;

describe('Doctor Panel theme', () => {
  it('follows the device by default', () => {
    osDark = true;
    show();
    expect(screen.getByRole('radio', { name: /System/ }).getAttribute('aria-checked')).toBe('true');
    expect(theme()).toBe('dark');
  });

  it('switches day and night, remembers it, and cleans up on leaving', () => {
    const { unmount } = show();
    expect(theme()).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: /Night/ }));
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('cardio-doctor:theme')).toBe('dark');
    unmount();
    expect(theme()).toBeUndefined(); // the rest of the app is never themed by the panel

    show();
    expect(theme()).toBe('dark'); // remembered
    fireEvent.click(screen.getByRole('radio', { name: /Day/ }));
    expect(theme()).toBe('light');
  });

  it('still works when storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    show();
    fireEvent.click(screen.getByRole('radio', { name: /Night/ }));
    expect(theme()).toBe('dark');
    get.mockRestore();
    set.mockRestore();
  });
});
