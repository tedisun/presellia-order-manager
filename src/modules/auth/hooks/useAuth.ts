import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { USE_MOCK } from '@config/constants';
import { Storage } from '@services/storage';
import type { AppUser, WCCredentials } from '@app-types/woocommerce';
import { MOCK_USER } from '../mock/authMock';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AppUser | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login:  (credentials: WCCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Vérification au démarrage — credentials déjà sauvegardées ?
  useEffect(() => {
    (async () => {
      try {
        if (USE_MOCK) {
          // En mock : toujours connecté avec l'utilisateur de test
          setState({ isAuthenticated: true, isLoading: false, user: MOCK_USER, error: null });
          return;
        }
        const user = await Storage.getUser();
        const creds = await Storage.getCredentials();
        setState({
          isAuthenticated: !!(user && creds),
          isLoading: false,
          user,
          error: null,
        });
      } catch {
        setState({ isAuthenticated: false, isLoading: false, user: null, error: null });
      }
    })();
  }, []);

  const login = useCallback(async (credentials: WCCredentials) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      if (USE_MOCK) {
        await Storage.saveCredentials(credentials);
        await Storage.saveUser(MOCK_USER);
        setState({ isAuthenticated: true, isLoading: false, user: MOCK_USER, error: null });
        return;
      }

      // Phase 2 : vérification credentials réels via WP REST API
      const authHeader = 'Basic ' + btoa(`${credentials.wp_username}:${credentials.wp_app_password}`);
      const response = await fetch(`${credentials.store_url}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) {
        throw new Error('Identifiants incorrects. Vérifiez vos informations.');
      }

      const wpUser = await response.json();
      const user: AppUser = {
        id: wpUser.id,
        name: wpUser.name,
        email: wpUser.email || '',
        username: wpUser.slug,
        role: 'administrator',
        store_url: credentials.store_url,
      };

      await Storage.saveCredentials(credentials);
      await Storage.saveUser(user);
      setState({ isAuthenticated: true, isLoading: false, user, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  const logout = useCallback(async () => {
    await Storage.clearCredentials();
    setState({ isAuthenticated: false, isLoading: false, user: null, error: null });
  }, []);

  const value: AuthContextValue = { ...state, login, logout };
  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
