import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { USE_MOCK } from '@config/constants';
import { Storage } from '@services/storage';
import { Cache } from '@services/cache';
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

  // Vérification au démarrage — credentials & cache chargés ?
  useEffect(() => {
    (async () => {
      try {
        // Initialiser le cache hybride persistant au tout début du démarrage
        await Cache.initialize();

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

      let wpUser = null;
      let finalUsername = credentials.wp_username;
      let finalAppPassword = credentials.wp_app_password;

      // 1. Tenter l'authentification native via notre MU-plugin /pom/v1/auth
      try {
        const nativeAuthRes = await fetch(`${credentials.store_url}/wp-json/pom/v1/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: credentials.wp_username,
            password: credentials.wp_app_password,
          }),
        });

        if (nativeAuthRes.status === 200) {
          const authData = await nativeAuthRes.json();
          if (authData.success && authData.app_password) {
            finalUsername = authData.wp_username;
            finalAppPassword = authData.app_password;
            wpUser = authData.user;
          }
        } else if (
          nativeAuthRes.status === 401 ||
          nativeAuthRes.status === 403 ||
          nativeAuthRes.status === 429
        ) {
          const errData = await nativeAuthRes.json().catch(() => ({}));
          throw new Error(errData.message || 'Identifiants incorrects.');
        }
      } catch (nativeErr: any) {
        // Si c'est une erreur d'identifiants ou de rate-limiting explicite, on la propage
        if (
          nativeErr.message === 'Identifiants incorrects.' ||
          nativeErr.message.includes('Trop de tentatives') ||
          nativeErr.message.includes('Accès refusé')
        ) {
          throw nativeErr;
        }
        // Sinon (404, pas de plugin...), on passe silencieusement au fallback Basic Auth
      }

      // 2. Fallback : vérification credentials standards via Basic Auth
      if (!wpUser) {
        const authHeader = 'Basic ' + btoa(`${credentials.wp_username}:${credentials.wp_app_password}`);
        const response = await fetch(`${credentials.store_url}/wp-json/wp/v2/users/me`, {
          headers: { Authorization: authHeader },
        });

        if (!response.ok) {
          throw new Error('Identifiants incorrects. Vérifiez votre saisie ou votre mot de passe d\'application.');
        }

        wpUser = await response.json();
      }

      const user: AppUser = {
        id: wpUser.id,
        name: wpUser.name || wpUser.display_name || finalUsername,
        email: wpUser.email || '',
        username: wpUser.slug || finalUsername,
        role: 'administrator',
        store_url: credentials.store_url,
      };

      const finalCredentials: WCCredentials = {
        ...credentials,
        wp_username: finalUsername,
        wp_app_password: finalAppPassword,
      };

      await Storage.saveCredentials(finalCredentials);
      await Storage.saveUser(user);
      setState({ isAuthenticated: true, isLoading: false, user, error: null });

      // Enregistrement push token silencieux — jamais bloquant
      import('@services/notifications').then(({ registerPushToken }) => registerPushToken());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  const logout = useCallback(async () => {
    await Storage.clearCredentials();
    await Cache.clearAll();
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
