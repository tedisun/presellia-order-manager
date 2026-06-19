import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification } from '@app-types/woocommerce';
import { Storage } from '@services/storage';
import { POM_API_PATH, USE_MOCK } from '@config/constants';
import { logger } from '@services/logger';

const NOTIF_STORAGE_KEY = '@presellia_notifications';
const MAX_STORED = 100;

// ID du projet Expo — obligatoire depuis SDK 49+ (app.json > extra.eas.projectId)
const EXPO_PROJECT_ID = '71dc7ad9-2268-4048-af64-a1b55781fa9a';

// ─── Handler de présentation (doit être déclaré AVANT tout listener) ──────────
// Requis pour que les notifications s'affichent quand l'app est au premier plan.
// Sans ce handler, les notifications iOS/Android sont silencieusement ignorées.
export function setupNotificationDisplayHandler(): void {
  if (Platform.OS === 'web' || USE_MOCK) return;
  import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
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
    // 1. Canal pour les ventes réussies (avec son Caissier/Cha-ching)
    await Notifications.setNotificationChannelAsync('presellia_sales', {
      name: 'Ventes Presellia (Cha-ching)',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'cash_register.wav',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });

    // 2. Canal pour les autres notifications (son par défaut)
    await Notifications.setNotificationChannelAsync('presellia_general', {
      name: 'Notifications Générales',
      importance: Notifications.AndroidImportance.MAX,
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

    // projectId obligatoire depuis Expo SDK 49+
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
    const token = tokenData.data;
    logger.info('push', `Token: ${token.slice(0, 40)}…`);

    await Storage.savePushToken(token);

    const creds = await Storage.getCredentials();
    if (!creds) {
      logger.warn('push', 'Pas de credentials — token non envoyé à WP');
      return;
    }

    const res = await fetch(`${creds.store_url}${POM_API_PATH}/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`),
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('push', `Erreur WP ${res.status}: ${body.slice(0, 100)}`);
    } else {
      logger.info('push', 'Token enregistré dans WordPress ✓');
    }
  } catch (err) {
    logger.error('push', `Exception: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Vérification état mu-plugin (pour écran diagnostic) ─────────────────────
export async function checkPomStatus(): Promise<{
  reachable: boolean; registered: boolean; token_count?: number; error?: string; last_push_log?: string;
}> {
  if (USE_MOCK || Platform.OS === 'web') return { reachable: false, registered: false, error: 'Mock/Web' };
  try {
    const creds = await Storage.getCredentials();
    if (!creds) return { reachable: false, registered: false, error: 'Pas de credentials' };
    const res = await fetch(`${creds.store_url}${POM_API_PATH}/status`, {
      headers: { Authorization: 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`) },
    });
    if (!res.ok) return { reachable: false, registered: false, error: `HTTP ${res.status}` };
    const json = await res.json() as { active?: boolean; registered_tokens?: number; user_has_token?: boolean; last_push_log?: string };
    return { 
      reachable: !!json.active, 
      registered: !!json.user_has_token, 
      token_count: json.registered_tokens,
      last_push_log: json.last_push_log,
    };
  } catch (err) {
    return { reachable: false, registered: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Envoi d'un push de test interactif ──────────────────────────────────────
export async function sendTestPush(): Promise<{ success: boolean; message: string; details?: string }> {
  if (USE_MOCK || Platform.OS === 'web') {
    return { success: false, message: 'Non supporté sur simulateur / web' };
  }
  try {
    const creds = await Storage.getCredentials();
    if (!creds) return { success: false, message: 'Identifiants introuvables' };
    const res = await fetch(`${creds.store_url}${POM_API_PATH}/test-push`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`) },
    });
    const json = await res.json() as { success: boolean; message: string; details?: string };
    return json;
  } catch (err) {
    return { success: false, message: 'Erreur de connexion', details: err instanceof Error ? err.message : String(err) };
  }
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

      const rawId = data?.orderId ?? data?.order_id;
      const orderId = typeof rawId === 'number' ? rawId : (typeof rawId === 'string' ? parseInt(rawId, 10) : undefined);
      if (orderId && !isNaN(orderId)) {
        onOrderTap(orderId);
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
  const rawId = data?.orderId ?? data?.order_id;
  const orderId = typeof rawId === 'number' ? rawId : (typeof rawId === 'string' ? parseInt(rawId, 10) : undefined);
  return {
    id:         notificationId,
    type:       (data?.type as AppNotification['type']) ?? 'system',
    title:      title || 'Notification',
    body:       body  || '',
    order_id:   orderId && !isNaN(orderId) ? orderId : undefined,
    read:       false,
    created_at: new Date().toISOString(),
  };
}
