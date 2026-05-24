import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@modules/auth/hooks/useAuth';
import { ThemeProvider, useTheme } from '@context/ThemeContext';
import AppNavigator from '@navigation/AppNavigator';
import {
  registerPushToken,
  storeNotification,
  expoPayloadToNotification,
} from '@services/notifications';

// ─── Gestion des notifications push ──────────────────────────────────────────
// Séparé dans un composant interne pour accéder à useAuth (dans AuthProvider)
// et ne démarrer l'écoute qu'une fois l'utilisateur connecté.

function PushHandler() {
  const { user } = useAuth();
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;

    let mounted = true;

    (async () => {
      // Import dynamique — évite de bundler expo-notifications sur web
      const Notifications = await import('expo-notifications');

      if (!mounted) return;

      // Afficher la notification même quand l'app est au premier plan
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Enregistrer le token push côté serveur
      await registerPushToken();

      // Notification reçue en foreground → stocker localement
      listenerRef.current = Notifications.addNotificationReceivedListener((notification) => {
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';
        const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
        const notif = expoPayloadToNotification(
          notification.request.identifier,
          title,
          body,
          data
        );
        storeNotification(notif).catch(() => {});
      });

      // Tap sur la notification (app en background ou fermée)
      responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const title = response.notification.request.content.title || '';
          const body = response.notification.request.content.body || '';
          const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
          const notif = expoPayloadToNotification(
            response.notification.request.identifier,
            title,
            body,
            data
          );
          // On stocke la notification (marquée non lue) — la navigation vers la
          // commande se fait via le tab Notifications qui la lira depuis AsyncStorage.
          storeNotification(notif).catch(() => {});
        }
      );
    })();

    return () => {
      mounted = false;
      listenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [user]);

  return null;
}

// ─── Thème StatusBar ──────────────────────────────────────────────────────────

function ThemedApp() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PushHandler />
      <AppNavigator />
    </>
  );
}

// ─── Racine ───────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
