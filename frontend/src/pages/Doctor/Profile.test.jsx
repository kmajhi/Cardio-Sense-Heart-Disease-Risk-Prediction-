// @vitest-environment jsdom
// Doctor Panel → Profile → Profile photo: add, change, remove.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { doctorApi } from '../../api/doctorApi';
import Profile from './pages/Profile';
import { ToastProvider } from './ui';

vi.mock('../../api/doctorApi', () => ({ doctorApi: { setPhoto: vi.fn(), setAvailable: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PHOTO = 'data:image/jpeg;base64,AAAA';
const me = (extra = {}) => ({
  name: 'Farhana Rahman', doctor_id: 'DR-0002', email: 'doctor@example.com', is_active: true, is_available: true,
  verified: true, active_reviews: 0, completed_reviews: 0, photo: '', ...extra,
});
const show = (who, reloadMe = vi.fn().mockResolvedValue()) =>
  render(
    <ToastProvider>
      <Profile me={who} reloadMe={reloadMe} />
    </ToastProvider>,
  );

describe('Doctor profile photo', () => {
  it('offers Add photo when there is none, with initials meanwhile', () => {
    show(me());
    const section = within(screen.getByRole('region', { name: 'Profile photo' }));
    expect(section.getByText('Add photo')).toBeTruthy();
    expect(section.queryByRole('button', { name: 'Remove photo' })).toBeNull();
    expect(section.getByLabelText('Add photo').getAttribute('type')).toBe('file');
    expect(screen.getAllByText('FR').length).toBeGreaterThan(0);
  });

  it('shows the photo, and removes it after confirming', async () => {
    doctorApi.setPhoto.mockResolvedValue({});
    const reloadMe = vi.fn().mockResolvedValue();
    const { container } = show(me({ photo: PHOTO }), reloadMe);
    expect(container.querySelectorAll(`img[src="${PHOTO}"]`).length).toBe(2); // header and photo section
    const section = within(screen.getByRole('region', { name: 'Profile photo' }));
    expect(section.getByText('Change photo')).toBeTruthy();
    fireEvent.click(section.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove your photo?' })).getByRole('button', { name: 'Remove photo' }));
    await vi.waitFor(() => expect(reloadMe).toHaveBeenCalled());
    expect(doctorApi.setPhoto).toHaveBeenCalledWith('');
  });

  it('is locked for an inactive account', () => {
    show(me({ is_active: false, photo: PHOTO }));
    const section = within(screen.getByRole('region', { name: 'Profile photo' }));
    expect(section.getByLabelText('Change photo').disabled).toBe(true);
    expect(section.getByRole('button', { name: 'Remove photo' }).disabled).toBe(true);
  });
});
