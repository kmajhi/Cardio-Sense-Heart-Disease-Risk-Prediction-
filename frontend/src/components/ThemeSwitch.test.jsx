// @vitest-environment jsdom
// The glass light / dark switch: a real switch for assistive tech, the knob shows
// the current mode and the text names the mode a click switches to.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import ThemeSwitch from './ThemeSwitch';

afterEach(cleanup);

function Harness({ onToggle = () => {} }) {
  const [dark, setDark] = useState(false);
  return (
    <ThemeSwitch
      dark={dark}
      onToggle={() => {
        onToggle();
        setDark((d) => !d);
      }}
    />
  );
}

describe('ThemeSwitch', () => {
  it('is a labelled switch that flips between light and dark', () => {
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.className).toMatch(/is-light/);
    expect(sw.title).toBe('Switch to dark mode');

    fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.className).toMatch(/is-dark/);
    expect(sw.title).toBe('Switch to light mode');
  });

  it('works from the keyboard like any button', () => {
    render(<Harness />);
    const sw = screen.getByRole('switch');
    sw.focus();
    expect(document.activeElement).toBe(sw);
    expect(sw.tagName).toBe('BUTTON'); // Enter and Space toggle it natively
  });
});
