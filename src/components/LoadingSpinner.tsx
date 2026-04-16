import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';

interface Props { message?: string; fullScreen?: boolean; }

export default function LoadingSpinner({ message, fullScreen = false }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, fullScreen && { flex: 1, backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: BRANDING.spacing.xl, alignItems: 'center', justifyContent: 'center', gap: BRANDING.spacing.md },
  message:   { fontSize: BRANDING.fonts.sizeSM },
});
