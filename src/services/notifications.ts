import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification } from '@app-types/woocommerce';
import { Storage } from '@services/storage';
import { POM_API_PATH, USE_MOCK } from '@config/constants';

const NOTIF_STORAGE_KEY = '@presellia_notifications';
const MAX_STORED = 100; // plafond pour ne pas gonfler AsyncStorage

// ─── Push token ──────────────────────────────────────────────────────────────

/**
 * Demande la permission de notifications, obtient le token Expo Push,
 * l'enregistre localement et le pousse vers le mu-plugin WordPress.
 * Silencieux en cas d'échec — jamais bloquant au démarrage.
 */
export async function registerPushToken(): Promise<void> {
  if (USE_MOCK || Platform.OS === 'web') return;

  try {
    // Import dynamique pour ne pas bundler expo-notifications inutilement sur web
    const Notifications = await import('expo-notifications');

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return; // utilisateur a refusé

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Sauvegarde locale
    await Storage.savePushToken(token);

    // Envoi vers WordPress (mu-plugin pom/v1)
    const creds = await Storage.getCredentials();
    if (!creds) return;

    const basicAuth = 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`);

    await fetch(`${creds.store_url}${POM_API_PATH}/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth,
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch {
    // Silencieux — les notifications sont un bonus, pas un prérequis
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
    // Dédoublonnage par id
    const filtered = existing.filter((n) => n.id !== notif.id);
    // Plus récent en tête, on plafonne à MAX_STORED
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

// ─── Conversion d'une notification Expo → AppNotification ────────────────────

/**
 * Transforme le payload reçu depuis Expo Push en AppNotification locale.
 * Le mu-plugin WordPress doit envoyer les champs data.type, data.order_id.
 */
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
