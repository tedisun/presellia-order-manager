import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { BRANDING } from '@config/branding';
import { PRODUCTS_CACHE_TTL_MS, RECENT_CUSTOMERS_CACHE_TTL } from '@config/constants';
import { useAuth } from '@modules/auth/hooks/useAuth';
import { useTheme } from '@context/ThemeContext';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

import LoginScreen from '@modules/auth/screens/LoginScreen';
import TabNavigator from './TabNavigator';

const RootStack = createNativeStackNavigator<RootStackParamList>();

// ─── Bootstrap : précharge produits + enregistre token push ──────────────────
async function bootstrapApp() {
  const [
    { fetchAllProducts, fetchPartnerProducts, fetchOrders },
    { Cache, CACHE_KEYS, buildRecentCustomersFromOrders },
    { registerPushToken },
  ] = await Promise.all([
    import('@services/woocommerce'),
    import('@services/cache'),
    import('@services/notifications'),
  ]);

  // Push token (non-bloquant)
  registerPushToken().catch(() => {});

  // Catalogue produits (12 h de cache)
  if (!Cache.has(CACHE_KEYS.ALL_PRODUCTS)) {
    const [regular, partner] = await Promise.all([
      fetchAllProducts(),
      fetchPartnerProducts().catch(() => [] as Awaited<ReturnType<typeof fetchPartnerProducts>>),
    ]);
    Cache.set(CACHE_KEYS.ALL_PRODUCTS,     regular, PRODUCTS_CACHE_TTL_MS);
    Cache.set(CACHE_KEYS.PARTNER_PRODUCTS, partner, PRODUCTS_CACHE_TTL_MS);
  }

  // Clients récents depuis les dernières commandes (2 h de cache)
  if (!Cache.has(CACHE_KEYS.RECENT_CUSTOMERS)) {
    const orders = await fetchOrders({ per_page: 50 }).catch(() => []);
    Cache.set(CACHE_KEYS.RECENT_CUSTOMERS, buildRecentCustomersFromOrders(orders), RECENT_CUSTOMERS_CACHE_TTL);
  }
}

// ─── Navigateur racine ────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (!isAuthenticated) return;
    bootstrapApp().catch(() => {}); // erreurs silencieuses (mode offline)
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
      ref={navigationRef}
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
          <RootStack.Screen name="Main" component={TabNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
