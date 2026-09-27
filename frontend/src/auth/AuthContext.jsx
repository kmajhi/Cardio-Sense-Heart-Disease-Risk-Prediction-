import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as authApi from '../api/authApi';

const AuthContext = createContext(null);

/** Who is signed in. `user` is undefined while the session is being checked, then a user or null. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  // Just logged out: protected pages go Home without asking to sign in again.
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    authApi
      .currentUser()
      .then(setUser)
      .catch(() => setUser(null)); // API unreachable: treat as signed out
  }, []);

  const login = useCallback(async (credentials) => {
    const signedIn = await authApi.login(credentials);
    setSignedOut(false);
    setUser(signedIn);
    return signedIn;
  }, []);

  const register = useCallback(async (details) => {
    const created = await authApi.register(details);
    setSignedOut(false);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setSignedOut(true);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, signedOut, login, register, logout }),
    [user, signedOut, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** null outside an <AuthProvider> (e.g. a page rendered on its own). */
export const useAuth = () => useContext(AuthContext);

/** Sends signed-out visitors to the login page, remembering where they were going. */
export function RequireAuth({ children }) {
  const { user, signedOut } = useAuth();
  const location = useLocation();
  if (user === undefined) return null; // still checking the session
  if (!user) return <Navigate to="/" replace state={signedOut ? null : { from: location }} />;
  return children;
}
