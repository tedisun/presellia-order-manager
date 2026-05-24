import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import CurrencyText from '@components/CurrencyText';
import type { WCOrder } from '@app-types/woocommerce';
import { getStatusLabel } from '@config/constants';

interface Props { order: WCOrder; onPress: () => void; }

function relativeDate(isoDate: string): string {

  const diffMs  = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);
  if (diffMin < 2)  return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24)   return `Il y a ${diffH}h`;
  if (diffD === 1)  return 'Hier';
  if (diffD < 7)    return `Il y a ${diffD}j`;
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

const makeStyles = (c: BrandColors) => StyleSheet.create({
  card:         { backgroundColor: c.surface, borderRadius: BRANDING.radius.lg, padding: BRANDING.spacing.md, marginHorizontal: BRANDING.spacing.lg, marginBottom: BRANDING.spacing.sm, borderWidth: 1, borderColor: c.border, gap: BRANDING.spacing.sm },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum:     { fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightBold, color: c.textMuted, letterSpacing: 0.5 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BRANDING.radius.full, borderWidth: 1 },
  statusDot:    { width: 5, height: 5, borderRadius: 3 },
  statusLabel:  { fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightSemiBold },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  customerName: { flex: 1, fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  productLine:  { flex: 1, fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  moreItems:    { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
  bottomRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 2 },
  metaLeft:     { gap: 3 },
  metaText:     { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
});

export default function OrderRow({ order, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusColor = colors.status[order.status] ?? colors.textMuted;
  const itemCount   = order.line_items.reduce((s, li) => s + li.quantity, 0);
  const city        = order.billing.city || order.shipping.city;
  const firstItem   = order.line_items[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.topRow}>
        <Text style={styles.orderNum}>#{order.number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.customerName} numberOfLines={1}>{order.billing.first_name} {order.billing.last_name}</Text>
      </View>
      {firstItem && (
        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={13} color={colors.textMuted} />
          <Text style={styles.productLine} numberOfLines={1}>
            {firstItem.name}
            {itemCount > 1 && <Text style={styles.moreItems}>  +{itemCount - 1} article{itemCount - 1 > 1 ? 's' : ''}</Text>}
          </Text>
        </View>
      )}
      <View style={styles.bottomRow}>
        <View style={styles.metaLeft}>
          {city ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{city}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{relativeDate(order.date_created)}</Text>
          </View>
        </View>
        <CurrencyText amount={order.total} currency={order.currency} size="md" bold />
      </View>
    </TouchableOpacity>
  );
}
