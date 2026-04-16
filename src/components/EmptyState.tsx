import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';

interface Props { icon?: string; title: string; subtitle?: string; }

export default function EmptyState({ icon = '📭', title, subtitle }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: BRANDING.spacing.xxl, gap: BRANDING.spacing.sm },
  icon:     { fontSize: 48, marginBottom: BRANDING.spacing.sm },
  title:    { fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightSemiBold, textAlign: 'center' },
  subtitle: { fontSize: BRANDING.fonts.sizeSM, textAlign: 'center', lineHeight: 20 },
});
