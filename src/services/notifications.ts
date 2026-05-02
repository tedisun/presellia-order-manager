import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification } from '@app-types/woocommerce';
import { Storage } from '@services/storage';
import { POM_API_PATH, USE_MOCK } from '@config/constants';

const NOTIF_STORAGE_KEY = '@presellia_notifications';
const MAX_STORED = 100;

// ─── Handler de présentation (doit être déclaré AVANT tout listener) ──────────
// Requis pour que les notifications s'affichent quand l'app est au premier plan.
// Sans ce handler, les notifications iOS/Android sont silencieusement ignorées.
export function setupNotificationDisplayHandler(): void {
  if (Platform.OS === 'web' || USE_MOCK) return;
  import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
        priority: Notifications.AndroidNotificationPriority?.HIGH,
      }),
    });
  }).catch(() => {});
}

// ─── Canal Android (obligatoire Android 8+) ───────────────────────────────────
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Commandes',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  } catch {}
}

// ─── Enregistrement du token Expo Push ────────────────────────────────────────
export async function registerPushToken(): Promise<void> {
  if (USE_MOCK || Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await ensureAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await Storage.savePushToken(token);

    const creds = await Storage.getCredentials();
    if (!creds) return;

    await fetch(`${creds.store_url}${POM_API_PATH}/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`),
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch {}
}

// ─── Listeners (à appeler une seule fois depuis AppNavigator) ─────────────────
// Retourne une fonction de nettoyage à appeler lors du démontage.
export function initNotificationListeners(
  onOrderTap: (orderId: number) => void
): () => void {
  if (Platform.OS === 'web' || USE_MOCK) return () => {};

  let receivedSub: { remove(): void } | null = null;
  let responseSub:  { remove(): void } | null = null;

  import('expo-notifications').then((Notifications) => {
    // Notification reçue en foreground → stocker + afficher
    receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title = '', body = '', data = {} } = notification.request.content;
      const appNotif = expoPayloadToNotification(
        notification.request.identifier,
        title ?? '',
        body ?? '',
        data as Record<string, unknown>
      );
      storeNotification(appNotif).catch(() => {});
    });

    // Tap sur une notification → naviguer vers la commande
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const { title = '', body = '' } = response.notification.request.content;

      const appNotif = expoPayloadToNotification(
        response.notification.request.identifier,
        title ?? '',
        body ?? '',
        data
      );
      storeNotification(appNotif).catch(() => {});
      markNotificationRead(appNotif.id).catch(() => {});

      if (typeof data?.orderId === 'number') {
        onOrderTap(data.orderId);
      }
    });
  }).catch(() => {});

  return () => {
    receivedSub?.remove();
    responseSub?.remove();
  };
}

// ─── Stockage local ───────────────────────────────────────────────────────────

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
  } catch {}
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
    order_id:   typeof data?.orderId === 'number' ? data.orderId : undefined,
    read:       false,
    created_at: new Date().toISOString(),
  };
}
