import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as authApi from '../api/authApi';
import { SESSION_ENDED } from '../api/client';

const AuthContext = createContext(null);

/** Who is signed in. `user` is undefined while the session is being checked, then a user or null. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  // Just logged out: protected pages go Home without asking to sign in again.
  const [signedOut, setSignedOut] = useState(false);
  // The server ended the session (it expired): protected pages ask to log in again.
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    authApi
      .currentUser()
      .then(setUser)
      .catch(() => setUser(null)); // API unreachable: treat as signed out
  }, []);

  useEffect(() => {
    const onEnded = () => {
      setUser((current) => {
        if (current) setExpired(true);
        return null;
      });
    };
    window.addEventListener(SESSION_ENDED, onEnded);
    return () => window.removeEventListener(SESSION_ENDED, onEnded);
  }, []);

  const login = useCallback(async (credentials) => {
    const signedIn = await authApi.login(credentials);
    setSignedOut(false);
    setExpired(false);
    setUser(signedIn);
    return signedIn;
  }, []);

  const register = useCallback(async (details) => {
    const created = await authApi.register(details);
    setSignedOut(false);
    setExpired(false);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setSignedOut(true);
    setUser(null);
  }, []);

  // Deleting the account also signs out; pages go Home like after a logout.
  const deleteAccount = useCallback(async (confirmation) => {
    await authApi.deleteAccount(confirmation);
    setSignedOut(true);
    setUser(null);
  }, []);

  // Re-reads the signed-in user (e.g. after setting a first password).
  const refresh = useCallback(async () => {
    setUser(await authApi.currentUser());
  }, []);

  const value = useMemo(
    () => ({ user, signedOut, expired, login, register, logout, deleteAccount, refresh }),
    [user, signedOut, expired, login, register, logout, deleteAccount, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** null outside an <AuthProvider> (e.g. a page rendered on its own). */
export const useAuth = () => useContext(AuthContext);

/** Sends signed-out visitors to the login page, remembering where they were going. */
export function RequireAuth({ children }) {
  const { user, signedOut, expired } = useAuth();
  const location = useLocation();
  if (user === undefined) return null; // still checking the session
  if (!user) {
    const state = signedOut ? null : { from: location, ...(expired ? { reason: 'expired' } : {}) };
    return <Navigate to="/" replace state={state} />;
  }
  return children;
}
