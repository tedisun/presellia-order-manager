import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { OrderStatus } from '@app-types/woocommerce';

interface Props { status: OrderStatus; size?: 'sm' | 'md'; }

const LABELS: Record<OrderStatus, string> = {
  pending:    'En attente',
  processing: 'En cours',
  'on-hold':  'En pause',
  completed:  'Terminée',
  cancelled:  'Annulée',
  refunded:   'Remboursée',
  failed:     'Échouée',
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const { colors } = useTheme();
  const color = colors.status[status] ?? colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: color + '55', backgroundColor: color + '22' }]}>
      <View style={[styles.dot, { backgroundColor: color }, size === 'sm' && styles.dotSm]} />
      <Text style={[styles.label, { color }, size === 'sm' && styles.labelSm]}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', gap: 5 },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  dotSm: { width: 5, height: 5 },
  label: { fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightSemiBold },
  labelSm: { fontSize: BRANDING.fonts.sizeXS },
});
