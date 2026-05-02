import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  StyleSheet, Alert, Share, RefreshControl, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BRANDING } from '@config/branding';
import { fetchOrder, updateOrderStatus, addOrderNote } from '@services/woocommerce';
import { ALL_ORDER_STATUSES, getStatusLabel } from '@config/constants';
import CurrencyText from '@components/CurrencyText';
import StatusBadge from '@components/StatusBadge';
import LoadingSpinner from '@components/LoadingSpinner';
import type { WCOrder, OrderStatus } from '@app-types/woocommerce';
import type { OrdersStackParamList } from '@navigation/types';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';

// ─── Timeline ─────────────────────────────────────────────────────────────────
const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending',    label: 'En attente' },
  { status: 'processing', label: 'En cours' },
  { status: 'completed',  label: 'Terminée' },
];

const makeTlStyles = (c: BrandColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: BRANDING.spacing.sm,
    paddingHorizontal: BRANDING.spacing.xs,
  },
  step: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  checkmark: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: BRANDING.fonts.weightBold,
  },
  stepLabel: {
    fontSize: BRANDING.fonts.sizeXS,
    textAlign: 'center',
    maxWidth: 64,
  },
  line: {
    flex: 1,
    height: 2,
    marginBottom: 18, // align with dot center
    marginHorizontal: 2,
  },
});

function OrderTimeline({ currentStatus, colors }: { currentStatus: OrderStatus; colors: BrandColors }) {
  const tlStyles = useMemo(() => makeTlStyles(colors), [colors]);
  const specialStatuses: OrderStatus[] = ['cancelled', 'refunded', 'failed', 'on-hold'];
  if (specialStatuses.includes(currentStatus)) return null;

  const currentIndex = TIMELINE_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <View style={tlStyles.container}>
      {TIMELINE_STEPS.map((step, idx) => {
        const isPast = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const dotColor = isCurrent
          ? colors.status[step.status]
          : isPast
          ? colors.success
          : colors.border;
        const labelColor = isCurrent
          ? colors.textPrimary
          : isPast
          ? colors.textSecondary
          : colors.textMuted;

        return (
          <React.Fragment key={step.status}>
            <View style={tlStyles.step}>
              <View style={[tlStyles.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                {isPast && <Text style={tlStyles.checkmark}>✓</Text>}
                {isCurrent && <View style={tlStyles.dotInner} />}
              </View>
              <Text style={[tlStyles.stepLabel, { color: labelColor }]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>
            {idx < TIMELINE_STEPS.length - 1 && (
              <View
                style={[
                  tlStyles.line,
                  { backgroundColor: idx < currentIndex ? colors.success : colors.border },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: BRANDING.spacing.lg, gap: BRANDING.spacing.md },
  card: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    gap: BRANDING.spacing.sm,
  },
  cardTitle: {
    fontSize: BRANDING.fonts.sizeXS,
    fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: BRANDING.spacing.xs,
  },
  cardBody: { gap: BRANDING.spacing.xs },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: BRANDING.fonts.sizeXS,
    color: c.textMuted,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: BRANDING.spacing.sm,
  },
  changeStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BRANDING.spacing.sm,
    marginTop: BRANDING.spacing.sm,
    paddingVertical: BRANDING.spacing.sm,
    borderRadius: BRANDING.radius.md,
    borderWidth: 1,
  },
  changeStatusLabel: { fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightSemiBold },

  // Modal picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: BRANDING.spacing.md,
    paddingBottom: BRANDING.spacing.xl,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: BRANDING.spacing.md,
  },
  modalTitle: {
    fontSize: BRANDING.fonts.sizeMD,
    fontWeight: BRANDING.fonts.weightBold,
    textAlign: 'center',
    marginBottom: BRANDING.spacing.sm,
    paddingHorizontal: BRANDING.spacing.lg,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BRANDING.spacing.lg,
    paddingVertical: BRANDING.spacing.md,
    gap: BRANDING.spacing.md,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusItemLabel: { fontSize: BRANDING.fonts.sizeMD, flex: 1 },
  statusItemCurrent: { fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightSemiBold },

  shareBtn: {
    backgroundColor: c.primary,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: BRANDING.spacing.sm,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: BRANDING.fonts.sizeMD,
    fontWeight: BRANDING.fonts.weightSemiBold,
  },

  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  lineItemMain: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' },
  productName: {
    flex: 1,
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textPrimary,
  },
  productQty: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textMuted,
  },
  lineItemPrices: { alignItems: 'flex-end', gap: 2 },
  priceStrike: {
    fontSize: BRANDING.fonts.sizeXS,
    color: c.textMuted,
    textDecorationLine: 'line-through',
  },
  divider: { height: 1, backgroundColor: c.border, marginVertical: BRANDING.spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  summaryLabel: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  summaryValue: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  summaryBold: {
    fontWeight: BRANDING.fonts.weightBold,
    color: c.textPrimary,
    fontSize: BRANDING.fonts.sizeMD,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textMuted,
    flex: 1,
  },
  infoValueRow: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  infoIcon: { fontSize: 12 },
  infoValue: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textPrimary,
    textAlign: 'right',
  },
  infoValueTappable: {
    color: c.primary,
    textDecorationLine: 'underline',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavProp>();
  const { orderId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [order, setOrder] = useState<WCOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const load = async () => {
    try {
      const o = await fetchOrder(orderId);
      setOrder(o);
      navigation.setOptions({ title: `Commande #${o.number}` });
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  const handleStatusChange = (newStatus: string) => {
    if (!order) return;
    setPickerVisible(false);
    Alert.alert(
      'Changer le statut',
      `Passer la commande #${order.number} en "${getStatusLabel(newStatus)}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setUpdatingStatus(true);
            try {
              const updated = await updateOrderStatus(order.id, newStatus as OrderStatus);
              setOrder(updated);
            } catch {
              Alert.alert('Erreur', 'Impossible de changer le statut.');
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const handleSharePaymentLink = async () => {
    if (!order?.payment_url) return;
    const message = `Bonjour ${order.billing.first_name},\n\nVoici votre lien de paiement pour la commande #${order.number} :\n\n${order.payment_url}\n\nMontant : ${order.total} FCFA\n\nMerci !`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Erreur', 'Impossible de lancer l\'appel.')
    );
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() =>
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'email.')
    );
  };

  const getCreatedBy = () =>
    order?.meta_data?.find((m) => m.key === '_presellia_created_by')?.value ?? null;

  const getPaymentDetail = () =>
    order?.meta_data?.find((m) => m.key === '_presellia_payment_detail')?.value ?? null;

  if (loading) return <LoadingSpinner fullScreen message="Chargement de la commande…" />;
  if (!order) return null;

  const itemCount = order.line_items.reduce((s, l) => s + l.quantity, 0);
  const subtotal = order.line_items.reduce((s, l) => s + parseFloat(l.subtotal), 0);
  const discount = order.line_items.reduce((s, l) => s + (parseFloat(l.subtotal) - parseFloat(l.total)), 0);
  const createdBy = getCreatedBy();
  const paymentDetail = getPaymentDetail();

  const showShareBtn = order.payment_url && (order.status === 'pending' || order.status === 'processing');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Status picker modal ── */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Modifier le statut</Text>
            <FlatList
              data={ALL_ORDER_STATUSES}
              keyExtractor={(item) => item.slug}
              renderItem={({ item }) => {
                const isCurrent = item.slug === order.status;
                const dotColor = (colors.status as Record<string, string>)[item.slug] ?? colors.textMuted;
                return (
                  <TouchableOpacity
                    style={styles.statusItem}
                    onPress={() => !isCurrent && handleStatusChange(item.slug)}
                    disabled={isCurrent}
                    activeOpacity={isCurrent ? 1 : 0.7}
                  >
                    <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                    <Text style={[styles.statusItemLabel, { color: isCurrent ? colors.textMuted : colors.textPrimary }]}>
                      {item.label}
                    </Text>
                    {isCurrent && (
                      <Text style={[styles.statusItemCurrent, { color: colors.primary }]}>Actuel</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Status + timeline */}
        <View style={styles.card}>
          <View style={styles.statusHeader}>
            <StatusBadge status={order.status} />
            <Text style={styles.dateText}>
              {new Date(order.date_created).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>

          <OrderTimeline currentStatus={order.status} colors={colors} />

          {/* Bouton modifier statut */}
          <TouchableOpacity
            style={[styles.changeStatusBtn, { borderColor: colors.border }]}
            onPress={() => setPickerVisible(true)}
            disabled={updatingStatus}
            activeOpacity={0.7}
          >
            <Text style={[styles.changeStatusLabel, { color: colors.primary }]}>
              {updatingStatus ? 'Mise à jour…' : '⇄  Modifier le statut'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Share payment link — prominent CTA */}
        {showShareBtn && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleSharePaymentLink} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>📤  Partager le lien de paiement</Text>
          </TouchableOpacity>
        )}

        {/* Products */}
        <SectionCard title={`Articles (${itemCount})`} styles={styles}>
          {order.line_items.map((li) => {
            const hasDiscount = parseFloat(li.subtotal) > parseFloat(li.total);
            return (
              <View key={li.id} style={styles.lineItem}>
                <View style={styles.lineItemMain}>
                  <Text style={styles.productName}>{li.name}</Text>
                  <Text style={styles.productQty}>× {li.quantity}</Text>
                </View>
                <View style={styles.lineItemPrices}>
                  {hasDiscount && (
                    <Text style={styles.priceStrike}>
                      {(parseFloat(li.subtotal)).toLocaleString('fr-FR')} F
                    </Text>
                  )}
                  <CurrencyText amount={li.total} size="sm" bold={hasDiscount} />
                </View>
              </View>
            );
          })}

          <View style={styles.divider} />
          <SummaryRow label="Sous-total" value={subtotal} styles={styles} />
          {discount > 0 && <SummaryRow label="Remise" value={-discount} valueColor={colors.success} styles={styles} />}
          <SummaryRow label="Total" value={parseFloat(order.total)} bold styles={styles} />
        </SectionCard>

        {/* Client */}
        <SectionCard title="Client" styles={styles}>
          <InfoRow label="Nom" value={`${order.billing.first_name} ${order.billing.last_name}`} styles={styles} />
          {order.billing.phone ? (
            <InfoRow
              label="Téléphone"
              value={order.billing.phone}
              onPress={() => handleCall(order.billing.phone)}
              icon="📞"
              styles={styles}
            />
          ) : null}
          {order.billing.email ? (
            <InfoRow
              label="Email"
              value={order.billing.email}
              onPress={() => handleEmail(order.billing.email)}
              icon="✉️"
              styles={styles}
            />
          ) : null}
          {order.billing.city ? <InfoRow label="Ville" value={order.billing.city} styles={styles} /> : null}
          {order.customer_note ? <InfoRow label="Note client" value={order.customer_note} styles={styles} /> : null}
        </SectionCard>

        {/* Paiement */}
        <SectionCard title="Paiement" styles={styles}>
          <InfoRow label="Méthode" value={order.payment_method_title || '—'} styles={styles} />
          {paymentDetail ? <InfoRow label="Détail" value={paymentDetail} styles={styles} /> : null}
          {order.payment_url ? <InfoRow label="Lien paiement" value="Disponible" styles={styles} /> : null}
        </SectionCard>

        {/* Métadonnées internes */}
        {(createdBy || order.customer_id > 0) && (
          <SectionCard title="Informations internes" styles={styles}>
            {createdBy ? <InfoRow label="Créé par" value={String(createdBy)} styles={styles} /> : null}
            {order.customer_id > 0 ? <InfoRow label="ID Client" value={`#${order.customer_id}`} styles={styles} /> : null}
          </SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function InfoRow({
  label, value, onPress, icon, styles,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  icon?: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const row = (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        {icon && <Text style={styles.infoIcon}>{icon}</Text>}
        <Text style={[styles.infoValue, onPress && styles.infoValueTappable]}>{value}</Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {row}
      </TouchableOpacity>
    );
  }
  return row;
}

function SummaryRow({
  label, value, bold, valueColor, styles,
}: {
  label: string; value: number; bold?: boolean; valueColor?: string; styles: ReturnType<typeof makeStyles>;
}) {
  const formatted = Math.abs(value).toLocaleString('fr-FR', { minimumFractionDigits: 0 });
  const sign = value < 0 ? '−' : '';
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold, valueColor ? { color: valueColor } : {}]}>
        {sign}{formatted} F
      </Text>
    </View>
  );
}
