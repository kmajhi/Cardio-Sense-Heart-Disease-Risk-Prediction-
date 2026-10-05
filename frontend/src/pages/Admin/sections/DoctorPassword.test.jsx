// @vitest-environment jsdom
// Admin → Doctors → "Set new password" for a doctor who forgot theirs.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { admin } from '../../../api/adminApi';
import { generatePassword, passwordProblem } from '../labels';
import { ToastProvider } from '../ui';
import SetDoctorPassword from './DoctorPassword';

vi.mock('../../../api/adminApi', () => ({ admin: { resetDoctorPassword: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('password helpers', () => {
  it('generates strong passwords with every kind of character', () => {
    for (let i = 0; i < 50; i += 1) {
      const pw = generatePassword();
      expect(pw).toHaveLength(14);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[2-9]/);
      expect(pw).toMatch(/[-_!@#%+?]/);
      expect(pw).not.toMatch(/[0O1lI]/);
      expect(passwordProblem(pw, pw)).toBe('');
    }
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBe(20);
  });

  it('explains what is wrong before sending', () => {
    expect(passwordProblem('short', 'short')).toMatch(/8 characters/);
    expect(passwordProblem('12345678', '12345678')).toMatch(/letters/);
    expect(passwordProblem('Strong-Pass-1', 'Strong-Pass-2')).toMatch(/don’t match/);
  });
});

describe('Set new password', () => {
  const show = (onDone = () => {}) =>
    render(
      <ToastProvider>
        <SetDoctorPassword doctor={{ id: 7, name: 'Farhana Rahman' }} onDone={onDone} />
      </ToastProvider>,
    );

  it('sets a confirmed password, temporary by default', async () => {
    admin.resetDoctorPassword.mockResolvedValue({ detail: 'New password set.' });
    const onDone = vi.fn();
    show(onDone);
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    const [pw, again] = [screen.getByLabelText('New password'), screen.getByLabelText('Confirm password')];
    // Read-only until focused, so the browser can't autofill the admin's own password.
    expect(pw.readOnly).toBe(true);
    fireEvent.focus(pw);
    fireEvent.change(pw, { target: { value: 'Heart-Test-2026' } });
    fireEvent.focus(again);
    fireEvent.change(again, { target: { value: 'Heart-Test-2025' } });
    expect(screen.getByRole('alert').textContent).toMatch(/don’t match/);
    expect(screen.getByRole('button', { name: 'Save new password' }).disabled).toBe(true);

    fireEvent.change(again, { target: { value: 'Heart-Test-2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(admin.resetDoctorPassword).toHaveBeenCalledWith(7, 'Heart-Test-2026', true);
  });

  it('can generate a password and skip the forced change', async () => {
    admin.resetDoctorPassword.mockResolvedValue({ detail: 'ok' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
    const generated = screen.getByLabelText('New password').value;
    expect(generated).toHaveLength(14);
    expect(screen.getByLabelText('New password').type).toBe('text'); // shown, so it can be read out
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await vi.waitFor(() => expect(admin.resetDoctorPassword).toHaveBeenCalledWith(7, generated, false));
  });
});
