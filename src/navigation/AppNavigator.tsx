import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { BRANDING } from '@config/branding';
import { useAuth } from '@modules/auth/hooks/useAuth';
import { useTheme } from '@context/ThemeContext';
import type { RootStackParamList } from './types';

import LoginScreen from '@modules/auth/screens/LoginScreen';
import TabNavigator from './TabNavigator';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useTheme();

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
          <RootStack.Screen name="Main" component={TabNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
