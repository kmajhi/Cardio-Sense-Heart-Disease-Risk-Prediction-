// @vitest-environment jsdom
// "Choose your role" on the login window: User / Patient keeps the usual login
// and register, Admin signs in to the console, Doctor hands over to /doctor.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import AuthModal from '../pages/Home/AuthModal';
import RolePicker from './RolePicker';

vi.mock('../api/connectApi', () => ({ getProviders: () => Promise.resolve({}) }));
afterEach(cleanup);

function Window({ login = vi.fn().mockResolvedValue({}), onSignedIn = vi.fn(), onDoctor = vi.fn(), start = 'patient' }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState(start);
  return (
    <AuthModal
      mode={mode}
      onMode={setMode}
      onClose={() => {}}
      login={login}
      register={vi.fn()}
      onSignedIn={onSignedIn}
      role={role}
      onRole={(r) => (r === 'doctor' ? onDoctor() : setRole(r))}
    />
  );
}

describe('RolePicker', () => {
  it('offers the three roles as a radio group and reports the choice', () => {
    const onRole = vi.fn();
    render(<RolePicker role="patient" onRole={onRole} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['User / Patient', 'Admin', 'Doctor']);
    expect(screen.getByRole('radio', { name: 'User / Patient' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }));
    expect(onRole).toHaveBeenCalledWith('admin');
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

  it('Admin signs in with the same login and says where it leads', async () => {
    const login = vi.fn().mockResolvedValue({ is_staff: true });
    const onSignedIn = vi.fn();
    render(<Window login={login} onSignedIn={onSignedIn} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }));
    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Register' })).toBeNull(); // no self-made admin accounts
    fireEvent.change(screen.getAllByLabelText('Email')[0], { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getAllByLabelText('Password')[0], { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login to Admin Console' }));
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('login', 'admin'));
    expect(login).toHaveBeenCalledWith({ email: 'admin@example.com', password: 'secret-pass' });
  });

  it('Doctor hands over to the Doctor Portal', () => {
    const onDoctor = vi.fn();
    render(<Window onDoctor={onDoctor} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Doctor' }));
    expect(onDoctor).toHaveBeenCalled();
  });
});
