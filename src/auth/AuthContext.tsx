import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe, getToken, logout as apiLogout, mintAccessToken } from '../lib/api';
import type { UserInfo } from '../types';

interface AuthContextValue {
  user: UserInfo | null;
  isLoading: boolean;
  loginModalOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  signOut: () => Promise<void>;
  /** Re-fetch the current user (called by the login modal after a successful login). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const info = await getMe();
      setUser(info);
      if (!getToken()) await mintAccessToken();
    } catch {
      setUser(null);
    }
  }, []);

  // Always ask /auth/me on boot — never gate on a local token. Login state lives
  // in the session cookie on the API origin, which is exactly what makes these
  // three cases behave the same: arriving from astro-site, opening the link
  // directly, or returning from a previous session. If a cookie exists we are
  // logged in; if not, we are not.
  useEffect(() => {
    (async () => {
      try {
        const info = await getMe();
        setUser(info);
        if (!getToken()) await mintAccessToken();
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const openLogin = useCallback(() => setLoginModalOpen(true), []);
  const closeLogin = useCallback(() => setLoginModalOpen(false), []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, loginModalOpen, openLogin, closeLogin, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
