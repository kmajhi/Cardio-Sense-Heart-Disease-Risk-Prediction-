// @vitest-environment jsdom
// The phone menu (≤760px): opens full screen, lists every page, closes on
// Escape or a link, and gives the page its scroll back.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import NavBar from './NavBar';

afterEach(cleanup);

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

describe('Phone menu', () => {
  it('opens with every page, marks the current one and locks the page scroll', () => {
    render(<NavBar user={{ name: 'Rahim Uddin' }} activePath="/history" LinkComponent="a" />);
    openMenu();
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    const links = within(menu).getAllByRole('link').map((a) => a.textContent.trim());
    expect(links).toEqual(expect.arrayContaining(['Dashboard', 'Prediction', 'History', 'About', 'Guidance', 'Profile']));
    expect(within(menu).getByRole('link', { name: 'History' }).getAttribute('aria-current')).toBe('page');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(within(menu).getByRole('button', { name: 'Close menu' }));
  });

  it('closes on Escape and gives the scroll and focus back', () => {
    render(<NavBar user={{ name: 'Rahim Uddin' }} activePath="/" LinkComponent="a" />);
    openMenu();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open menu' }));
  });

  it('closes when a link is chosen', () => {
    render(<NavBar user={{ name: 'Rahim Uddin' }} activePath="/" LinkComponent="a" />);
    openMenu();
    const about = within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'About' });
    about.addEventListener('click', (e) => e.preventDefault()); // the test browser can't navigate
    fireEvent.click(about);
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
  });
});
