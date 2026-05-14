import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Platform, View } from 'react-native';
import { BRANDING } from '@config/branding';
import { useAuth } from '@modules/auth/hooks/useAuth';
import { useTheme } from '@context/ThemeContext';
import type { RootStackParamList } from './types';

import LoginScreen from '@modules/auth/screens/LoginScreen';
import TabNavigator from './TabNavigator';
import DiagnosticScreen from '@modules/notifications/screens/DiagnosticScreen';

// Foreground notification handler — doit être configuré au niveau module, avant tout rendu
if (Platform.OS !== 'web') {
  import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });
  });
}

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  // Écouter les notifications reçues quand l'app est ouverte (foreground)
  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated) return;

    let sub: { remove: () => void } | null = null;

    import('expo-notifications').then((Notifications) => {
      sub = Notifications.addNotificationReceivedListener(async (notif) => {
        const { storeNotification, expoPayloadToNotification } = await import('@services/notifications');
        const appNotif = expoPayloadToNotification(
          notif.request.identifier,
          notif.request.content.title ?? '',
          notif.request.content.body ?? '',
          (notif.request.content.data ?? {}) as Record<string, unknown>,
        );
        await storeNotification(appNotif);
      });
    });

    return () => { sub?.remove(); };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary:      colors.primary,
          background:   colors.background,
          card:         colors.surface,
          text:         colors.textPrimary,
          border:       colors.border,
          notification: colors.error,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium:  { fontFamily: 'System', fontWeight: '500' },
          bold:    { fontFamily: 'System', fontWeight: '700' },
          heavy:   { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="Main" component={TabNavigator} />
            <RootStack.Screen
              name="Diagnostic"
              component={DiagnosticScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
