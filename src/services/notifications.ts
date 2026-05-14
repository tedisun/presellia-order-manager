import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification } from '@app-types/woocommerce';
import { Storage } from '@services/storage';
import { POM_API_PATH, USE_MOCK } from '@config/constants';
import { logger } from '@services/logger';

const NOTIF_STORAGE_KEY = '@presellia_notifications';
const MAX_STORED = 100;

// ID du projet Expo — doit correspondre à extra.eas.projectId dans app.json
const EXPO_PROJECT_ID = '71dc7ad9-2268-4048-af64-a1b55781fa9a';

// ─── Push token ──────────────────────────────────────────────────────────────

/**
 * Demande la permission, obtient le token Expo Push, l'enregistre
 * localement et le pousse vers le mu-plugin WordPress (pom/v1).
 * Silencieux en cas d'échec — jamais bloquant au démarrage.
 */
export async function registerPushToken(): Promise<void> {
  if (USE_MOCK || Platform.OS === 'web') {
    logger.info('push', `Skipped (mock=${USE_MOCK}, platform=${Platform.OS})`);
    return;
  }

  try {
    const Notifications = await import('expo-notifications');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    logger.info('push', `Permission actuelle: ${existingStatus}`);

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      logger.info('push', `Permission après demande: ${status}`);
    }

    if (finalStatus !== 'granted') {
      logger.warn('push', 'Permission refusée — aucun token envoyé');
      return;
    }

    // IMPORTANT : projectId obligatoire depuis Expo SDK 49+
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    const token = tokenData.data;
    logger.info('push', `Token obtenu: ${token.slice(0, 40)}…`);

    await Storage.savePushToken(token);

    const creds = await Storage.getCredentials();
    if (!creds) {
      logger.warn('push', 'Pas de credentials — token non envoyé à WordPress');
      return;
    }

    const basicAuth = 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`);
    const url = `${creds.store_url}${POM_API_PATH}/register-token`;
    logger.info('push', `Envoi token vers ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: basicAuth },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '(vide)');
      logger.error('push', `Erreur WP ${res.status}: ${body.slice(0, 150)}`);
    } else {
      logger.info('push', 'Token enregistré dans WordPress ✓');
    }
  } catch (err) {
    logger.error('push', `Exception: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Vérifie l'état du mu-plugin pom/v1 côté WordPress (pour l'écran diagnostic). */
export async function checkPomStatus(): Promise<{
  reachable: boolean;
  registered: boolean;
  token_count?: number;
  error?: string;
}> {
  if (USE_MOCK || Platform.OS === 'web') {
    return { reachable: false, registered: false, error: 'Mode mock ou web' };
  }
  try {
    const creds = await Storage.getCredentials();
    if (!creds) return { reachable: false, registered: false, error: 'Pas de credentials' };

    const basicAuth = 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`);
    const res = await fetch(`${creds.store_url}${POM_API_PATH}/status`, {
      headers: { Authorization: basicAuth },
    });
    if (!res.ok) {
      return { reachable: false, registered: false, error: `HTTP ${res.status}` };
    }
    const json = await res.json() as { active?: boolean; registered_tokens?: number; user_has_token?: boolean };
    return {
      reachable:   !!json.active,
      registered:  !!json.user_has_token,
      token_count: json.registered_tokens,
    };
  } catch (err) {
    return { reachable: false, registered: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Stockage local des notifications ────────────────────────────────────────

export async function getStoredNotifications(): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

export async function storeNotification(notif: AppNotification): Promise<void> {
  try {
    const existing = await getStoredNotifications();
    const filtered = existing.filter((n) => n.id !== notif.id);
    const updated = [notif, ...filtered].slice(0, MAX_STORED);
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silencieux
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    const existing = await getStoredNotifications();
    const updated = existing.map((n) => (n.id === id ? { ...n, read: true } : n));
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const existing = await getStoredNotifications();
    const updated = existing.map((n) => ({ ...n, read: true }));
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

// ─── Conversion payload Expo → AppNotification ───────────────────────────────

export function expoPayloadToNotification(
  notificationId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): AppNotification {
  return {
    id:         notificationId,
    type:       (data?.type as AppNotification['type']) ?? 'system',
    title:      title || 'Notification',
    body:       body  || '',
    order_id:   typeof data?.order_id === 'number' ? data.order_id : undefined,
    read:       false,
    created_at: new Date().toISOString(),
  };
}
