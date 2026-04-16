import { Platform } from 'react-native';
import type { WCCredentials, AppUser } from '@app-types/woocommerce';
import { STORAGE_KEYS } from '@config/constants';

// ─── Abstraction SecureStore / localStorage (web fallback) ───────────────────
// SecureStore ne fonctionne pas sur web — localStorage en fallback pour dev web.
// IMPORTANT : ne jamais utiliser localStorage en production APK Android.

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
}

// ─── API publique ─────────────────────────────────────────────────────────────
export const Storage = {
  // Stockage générique
  set: (key: string, value: string) => secureSet(key, value),
  get: (key: string) => secureGet(key),
  delete: (key: string) => secureDelete(key),

  // Credentials WooCommerce
  saveCredentials: async (creds: WCCredentials): Promise<void> => {
    await Promise.all([
      secureSet(STORAGE_KEYS.STORE_URL,        creds.store_url),
      secureSet(STORAGE_KEYS.CONSUMER_KEY,     creds.consumer_key),
      secureSet(STORAGE_KEYS.CONSUMER_SECRET,  creds.consumer_secret),
      secureSet(STORAGE_KEYS.WP_USERNAME,      creds.wp_username),
      secureSet(STORAGE_KEYS.WP_APP_PASSWORD,  creds.wp_app_password),
    ]);
  },

  getCredentials: async (): Promise<WCCredentials | null> => {
    const [store_url, consumer_key, consumer_secret, wp_username, wp_app_password] =
      await Promise.all([
        secureGet(STORAGE_KEYS.STORE_URL),
        secureGet(STORAGE_KEYS.CONSUMER_KEY),
        secureGet(STORAGE_KEYS.CONSUMER_SECRET),
        secureGet(STORAGE_KEYS.WP_USERNAME),
        secureGet(STORAGE_KEYS.WP_APP_PASSWORD),
      ]);

    // Auth via WP Application Password uniquement — consumer_key/secret non requis
    if (!store_url || !wp_username || !wp_app_password) return null;

    return {
      store_url,
      consumer_key:    consumer_key    || '',
      consumer_secret: consumer_secret || '',
      wp_username:     wp_username,
      wp_app_password: wp_app_password,
    };
  },

  clearCredentials: async (): Promise<void> => {
    await Promise.all(Object.values(STORAGE_KEYS).map((key) => secureDelete(key)));
  },

  // Utilisateur courant (JSON serialisé)
  saveUser: async (user: AppUser): Promise<void> => {
    await secureSet(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  getUser: async (): Promise<AppUser | null> => {
    const raw = await secureGet(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  },

  // Token push notifications
  savePushToken: (token: string) => secureSet(STORAGE_KEYS.PUSH_TOKEN, token),
  getPushToken: () => secureGet(STORAGE_KEYS.PUSH_TOKEN),
};
