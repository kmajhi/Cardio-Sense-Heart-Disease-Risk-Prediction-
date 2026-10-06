// @vitest-environment jsdom
// "Choose your role" on the login window: User / Patient keeps the usual login
// and register (admins sign in there too), Doctor hands over to /doctor.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import AuthModal from '../pages/Home/AuthModal';
import RolePicker from './RolePicker';

vi.mock('../api/connectApi', () => ({ getProviders: () => Promise.resolve({}) }));
afterEach(cleanup);

function Window({ login = vi.fn().mockResolvedValue({}), onSignedIn = vi.fn(), onDoctor = vi.fn() }) {
  const [mode, setMode] = useState('login');
  return (
    <AuthModal
      mode={mode}
      onMode={setMode}
      onClose={() => {}}
      login={login}
      register={vi.fn()}
      onSignedIn={onSignedIn}
      onRole={(r) => r === 'doctor' && onDoctor()}
    />
  );
}

describe('RolePicker', () => {
  it('offers User / Patient and Doctor as a radio group and reports the choice', () => {
    const onRole = vi.fn();
    render(<RolePicker role="patient" onRole={onRole} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['User / Patient', 'Doctor']);
    expect(screen.getByRole('radio', { name: 'User / Patient' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Doctor' }));
    expect(onRole).toHaveBeenCalledWith('doctor');
    onRole.mockClear();
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' });
    expect(onRole).toHaveBeenLastCalledWith('doctor'); // wraps around from the first to the last
  });
});

describe('Login window roles', () => {
  it('User / Patient keeps Log in and Register as before', () => {
    render(<Window />);
    expect(screen.getByRole('tab', { name: 'Register' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
  });

  it('Admins sign in as User / Patient; the signed-in account is handed on', async () => {
    const admin = { is_staff: true };
    const login = vi.fn().mockResolvedValue(admin);
    const onSignedIn = vi.fn();
    render(<Window login={login} onSignedIn={onSignedIn} />);
    expect(screen.queryByRole('radio', { name: 'Admin' })).toBeNull();
    fireEvent.change(screen.getAllByLabelText('Email')[0], { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getAllByLabelText('Password')[0], { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('login', admin));
    expect(login).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret-pass' });
  });

  it('Doctor hands over to the Doctor Portal', () => {
    const onDoctor = vi.fn();
    render(<Window onDoctor={onDoctor} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Doctor' }));
    expect(onDoctor).toHaveBeenCalled();
  });
});
