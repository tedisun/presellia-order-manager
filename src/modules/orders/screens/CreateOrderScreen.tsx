import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useAuth } from '@modules/auth/hooks/useAuth';
import {
  fetchCustomers, fetchGuestCustomers, fetchPartnerProducts,
  createOrder, createCustomer, syncCustomerPhone, fetchTopProducts,
  fetchProductVariations,
} from '@services/woocommerce';
import CurrencyText from '@components/CurrencyText';
import SearchBar from '@components/SearchBar';
import type { WCCustomer, WCProduct, WCProductVariation, CreateOrderPayload, OfflinePaymentDetail } from '@app-types/woocommerce';
import type { OrdersStackParamList } from '@navigation/types';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';

type RoutePropType = RouteProp<OrdersStackParamList, 'CreateOrder'>;
type NavProp = NativeStackNavigationProp<OrdersStackParamList, 'CreateOrder'>;

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface LineItemDraft {
  product:      WCProduct;
  variation?:   WCProductVariation;   // défini si produit variable
  quantity:     number;
  discountType: 'none' | 'percent' | 'fixed';
  discountValue: number;
}

/** Étiquette courte de la variation (ex: "1 an", "6 mois — Home") */
function variationLabel(v: WCProductVariation): string {
  return v.attributes.map((a) => a.option).join(' · ') || `#${v.id}`;
}

interface PaymentChoice {
  mode: 'offline' | 'link';
  detail: OfflinePaymentDetail | null;
}

const OFFLINE_METHODS: { value: OfflinePaymentDetail; label: string }[] = [
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'moov_money',   label: 'Moov Money' },
  { value: 'wave',         label: 'Wave' },
  { value: 'my_nita',      label: 'My Nita' },
  { value: 'cash',         label: 'Cash' },
  { value: 'virement',     label: 'Virement' },
  { value: 'autre',        label: 'Autre' },
];

function getLineUnitPrice(li: LineItemDraft): number {
  // Priorité : prix variation > prix produit (partner ou standard)
  if (li.variation) return parseFloat(li.variation.partner_price || li.variation.price || '0');
  return parseFloat(li.product.price || '0');
}

function getLineTotal(li: LineItemDraft): number {
  const base = getLineUnitPrice(li) * li.quantity;
  if (li.discountType === 'percent') return base * (1 - li.discountValue / 100);
  if (li.discountType === 'fixed')   return Math.max(0, base - li.discountValue);
  return base;
}

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  stepContent: { padding: BRANDING.spacing.lg, gap: BRANDING.spacing.md },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: BRANDING.spacing.md,
    paddingHorizontal: BRANDING.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: 0,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: c.primary, backgroundColor: c.primary + '44' },
  stepDotCurrent: { backgroundColor: c.primary, borderColor: c.primary },
  stepDotText: { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted, fontWeight: BRANDING.fonts.weightSemiBold },
  stepDotTextActive: { color: '#FFF' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: c.border,
    maxWidth: 40,
  },
  stepLineActive: { backgroundColor: c.primary },
  stepTitle: {
    fontSize: BRANDING.fonts.sizeLG,
    fontWeight: BRANDING.fonts.weightBold,
    color: c.textPrimary,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: BRANDING.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.background,
    gap: BRANDING.spacing.md,
  },
  backBtn: { padding: BRANDING.spacing.sm },
  backBtnText: { color: c.textSecondary, fontSize: BRANDING.fonts.sizeMD },
  nextBtn: {
    flex: 1,
    backgroundColor: c.primary,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#FFF', fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold },
  // Customer mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: c.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: BRANDING.spacing.sm,
    alignItems: 'center',
    borderRadius: BRANDING.radius.sm,
  },
  modeBtnActive: { backgroundColor: c.primary },
  modeBtnText: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, fontWeight: BRANDING.fonts.weightMedium },
  modeBtnTextActive: { color: '#FFF', fontWeight: BRANDING.fonts.weightSemiBold },
  emptyHint: { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted, textAlign: 'center', marginTop: 8 },
  guestSearchingBar: {
    flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.sm,
    marginTop: BRANDING.spacing.sm, padding: BRANDING.spacing.sm,
    backgroundColor: c.primary + '12',
    borderRadius: BRANDING.radius.sm,
  },
  guestSearchingText: { fontSize: BRANDING.fonts.sizeXS, color: c.primary },
  customerRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  guestBadge: {
    backgroundColor: c.textMuted + '33',
    borderRadius: BRANDING.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  guestBadgeText: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, fontWeight: BRANDING.fonts.weightMedium },
  // New customer form
  newCustomerForm: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    gap: BRANDING.spacing.md,
  },
  newCustomerFormTitle: { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  formRow: { flexDirection: 'row', gap: BRANDING.spacing.md },
  formField: { flex: 1, gap: 4 },
  formFieldFull: { gap: 4 },
  formLabel: { fontSize: BRANDING.fonts.sizeXS, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  formInput: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: BRANDING.radius.md,
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: BRANDING.spacing.sm,
    color: c.textPrimary,
    fontSize: BRANDING.fonts.sizeMD,
  },
  formHint: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, lineHeight: 16 },
  createCustomerBtn: {
    backgroundColor: c.primary,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
    marginTop: BRANDING.spacing.xs,
  },
  // Sticky cart panel
  stickyCartPanel: {
    borderTopWidth: 2,
    borderTopColor: c.primary + '55',
    backgroundColor: c.surface,
    padding: BRANDING.spacing.md,
    gap: BRANDING.spacing.sm,
    maxHeight: 300,
  },
  // Customer step
  customerRow: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: 2,
  },
  customerRowSelected: { borderColor: c.primary, backgroundColor: c.primary + '22' },
  customerName: { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  customerMeta: { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted },
  partnerBadge: { fontSize: BRANDING.fonts.sizeXS, color: c.success, marginTop: 2 },
  selectedCustomer: {
    backgroundColor: c.success + '22',
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.success + '55',
  },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: BRANDING.spacing.md },
  selectedLabel: { fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  changeLink: { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted, textDecorationLine: 'underline' },
  editLink: { fontSize: BRANDING.fonts.sizeSM, color: c.primary, fontWeight: BRANDING.fonts.weightSemiBold },
  selectedBody: { flexDirection: 'row', gap: BRANDING.spacing.md, alignItems: 'flex-start', marginBottom: BRANDING.spacing.md },
  selectedAvatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: c.primary + '33',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  selectedAvatarText: {
    fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightBold,
    color: c.primary, textTransform: 'uppercase',
  },
  selectedName: { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  selectedMeta: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 2 },
  selectedActions: {
    flexDirection: 'row', gap: BRANDING.spacing.sm,
    borderTopWidth: 1, borderTopColor: c.border,
    paddingTop: BRANDING.spacing.sm, marginTop: BRANDING.spacing.xs,
  },
  selectedActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: BRANDING.spacing.sm,
    borderRadius: BRANDING.radius.sm,
    backgroundColor: c.primary + '18',
  },
  selectedActionPromote: { backgroundColor: c.success + '18' },
  selectedActionText: { fontSize: BRANDING.fonts.sizeXS, color: c.primary, fontWeight: BRANDING.fonts.weightSemiBold },
  promoteInlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: BRANDING.spacing.sm,
    paddingTop: BRANDING.spacing.sm,
    borderTopWidth: 1, borderTopColor: c.success + '33',
  },
  promoteInlineText: { fontSize: BRANDING.fonts.sizeXS, color: c.success },
  editCustomerForm: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    borderWidth: 1,
    borderColor: c.primary + '55',
    gap: BRANDING.spacing.md,
  },
  editCustomerFormPromote: {
    borderColor: c.success + '55',
    backgroundColor: c.success + '08',
  },
  editFormActions: { flexDirection: 'row', gap: BRANDING.spacing.md },
  editCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
  },
  editCancelText: { color: c.textSecondary, fontSize: BRANDING.fonts.sizeMD },
  editSaveBtn: {
    flex: 2,
    backgroundColor: c.primary,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
  },
  editPromoteBtn: {
    flex: 2,
    backgroundColor: c.success,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
  },
  // Products step
  partnerNotice: {
    backgroundColor: c.success + '22',
    borderRadius: BRANDING.radius.sm,
    padding: BRANDING.spacing.sm,
  },
  partnerNoticeText: { fontSize: BRANDING.fonts.sizeSM, color: c.success },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BRANDING.spacing.xs,
    marginTop: BRANDING.spacing.md,
    marginBottom: BRANDING.spacing.xs,
  },
  sectionHeaderText: {
    fontSize: BRANDING.fonts.sizeXS,
    fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: BRANDING.spacing.sm,
  },
  productName: { fontSize: BRANDING.fonts.sizeMD, color: c.textPrimary },
  productSku: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
  addBtn: {
    fontSize: 22,
    color: c.primary,
    fontWeight: BRANDING.fonts.weightBold,
    paddingHorizontal: BRANDING.spacing.xs,
  },
  cartItem: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: BRANDING.spacing.sm,
  },
  cartItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartItemName: { flex: 1, fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary, fontWeight: BRANDING.fonts.weightSemiBold },
  removeBtn: { fontSize: 14, color: c.error, padding: 4 },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.sm, flexWrap: 'wrap' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 18, color: c.textPrimary, lineHeight: 22 },
  qtyValue: { fontSize: BRANDING.fonts.sizeMD, color: c.textPrimary, minWidth: 24, textAlign: 'center' },
  discountRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  discountType: {
    width: 28, height: 28, borderRadius: BRANDING.radius.sm,
    backgroundColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  discountTypeActive: { backgroundColor: c.primary },
  discountTypeText: { fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary, fontWeight: BRANDING.fonts.weightBold },
  discountInput: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: BRANDING.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: c.textPrimary,
    fontSize: BRANDING.fonts.sizeSM,
    width: 56,
    textAlign: 'center',
  },
  cartItemVariation: { fontSize: BRANDING.fonts.sizeXS, color: c.primary, marginTop: 1 },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cartTotalLabel: { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  // Variation modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: BRANDING.spacing.lg,
    gap: BRANDING.spacing.md,
    maxHeight: '80%',
  },
  modalTitle:   { fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  modalProduct: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  variationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.background,
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: BRANDING.spacing.sm,
  },
  variationRowOut: { opacity: 0.45 },
  variationLabel: { flex: 1, fontSize: BRANDING.fonts.sizeMD, color: c.textPrimary },
  variationSku:   { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, marginTop: 2 },
  outOfStockTag:  { fontSize: BRANDING.fonts.sizeXS, color: c.error },
  modalCancel: {
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: c.border,
    marginTop: BRANDING.spacing.xs,
  },
  modalCancelText: { fontSize: BRANDING.fonts.sizeMD, color: c.textSecondary },
  // Payment step
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    borderWidth: 2,
    borderColor: c.border,
    gap: BRANDING.spacing.md,
  },
  paymentCardActive: { borderColor: c.primary, backgroundColor: c.primary + '15' },
  paymentCardIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: c.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentCardTitle: { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  paymentCardSub: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 3 },
  methodRow: { gap: BRANDING.spacing.sm },
  methodLabel: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, fontWeight: BRANDING.fonts.weightMedium },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: BRANDING.spacing.sm },
  chip: {
    paddingHorizontal: BRANDING.spacing.md, paddingVertical: 7,
    borderRadius: BRANDING.radius.full, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surfaceElevated,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipLabel: { fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary },
  chipLabelActive: { color: '#FFF', fontWeight: BRANDING.fonts.weightSemiBold },
  // Recap step
  recapSection: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: 4,
  },
  recapLabel: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  recapValue: { fontSize: BRANDING.fonts.sizeMD, color: c.textPrimary, fontWeight: BRANDING.fonts.weightSemiBold },
  recapSub: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  recapItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  recapItemName: { flex: 1, fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginRight: 8 },
  recapTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.primary + '15',
    borderRadius: BRANDING.radius.md,
    padding: BRANDING.spacing.lg,
    borderWidth: 1,
    borderColor: c.primary + '55',
  },
  recapTotalLabel: { fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  submitBtn: {
    backgroundColor: c.primary,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
    marginTop: BRANDING.spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#FFF', fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightBold },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function CreateOrderScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [customer, setCustomer] = useState<WCCustomer | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [payment, setPayment] = useState<PaymentChoice>({ mode: 'offline', detail: null });
  const [submitting, setSubmitting] = useState(false);

  const goBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
      return;
    }
    // Étape 1 : confirmer si des données ont déjà été saisies
    const hasDraft = customer !== null || lineItems.length > 0;
    if (hasDraft) {
      Alert.alert(
        'Annuler la commande ?',
        'Toutes les données saisies seront perdues.',
        [
          { text: 'Continuer la saisie', style: 'cancel' },
          { text: 'Annuler la commande', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const total = lineItems.reduce((s, li) => s + getLineTotal(li), 0);

  const handleSubmit = async () => {
    if (!customer) return;
    setSubmitting(true);
    try {
      const payload: CreateOrderPayload = {
        status: payment.mode === 'link' ? 'pending' : 'completed',
        customer_id: customer.id,
        billing: {
          first_name: customer.first_name,
          last_name:  customer.last_name,
          email:      customer.email,
          phone:      customer.billing.phone,
          address_1:  customer.billing.address_1,
          city:       customer.billing.city,
          country:    customer.billing.country || 'BF',
        },
        line_items: lineItems.map((li) => ({
          product_id:   li.product.id,
          ...(li.variation ? { variation_id: li.variation.id } : {}),
          quantity:     li.quantity,
          subtotal:     (getLineUnitPrice(li) * li.quantity).toFixed(2),
          total:        getLineTotal(li).toFixed(2),
        })),
        payment_method:       payment.mode === 'link' ? 'woocommerce_payments' : 'offline',
        payment_method_title: payment.mode === 'link' ? 'Paiement en ligne' : 'Paiement hors ligne',
        set_paid: payment.mode === 'offline',
        meta_data: [
          { key: '_presellia_created_by', value: user?.username ?? 'app' },
          ...(payment.detail ? [{ key: '_presellia_payment_detail', value: payment.detail }] : []),
        ],
      };

      const created = await createOrder(payload);

      // Fix téléphone bug WC
      if (customer.id > 0 && customer.billing.phone) {
        await syncCustomerPhone(customer.id, customer.billing.phone).catch(() => {});
      }

      navigation.replace('OrderDetail', { orderId: created.id });
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de créer la commande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Step indicator */}
      <StepIndicator current={step} total={4} styles={styles} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {step === 1 && (
          <StepCustomer
            initial={customer}
            onSelect={(c) => setCustomer(c)}
            styles={styles}
            colors={colors}
          />
        )}
        {step === 2 && (
          <StepProducts
            customer={customer}
            items={lineItems}
            onChange={setLineItems}
            onNext={() => setStep(3)}
            styles={styles}
            colors={colors}
          />
        )}
        {step === 3 && (
          <StepPayment
            payment={payment}
            onChange={setPayment}
            onNext={() => setStep(4)}
            styles={styles}
            colors={colors}
          />
        )}
        {step === 4 && (
          <StepRecap
            customer={customer!}
            items={lineItems}
            payment={payment}
            total={total}
            submitting={submitting}
            onSubmit={handleSubmit}
            styles={styles}
          />
        )}
      </KeyboardAvoidingView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backBtnText}>← {step === 1 ? 'Annuler' : 'Retour'}</Text>
        </TouchableOpacity>
        {step < 4 && (
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed(step, customer, lineItems) && styles.nextBtnDisabled]}
            disabled={!canProceed(step, customer, lineItems)}
            onPress={() => setStep((s) => (s + 1) as 2 | 3 | 4)}
          >
            <Text style={styles.nextBtnText}>Suivant →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function canProceed(step: number, customer: WCCustomer | null, items: LineItemDraft[]): boolean {
  if (step === 1) return customer !== null;
  if (step === 2) return items.length > 0;
  return true;
}

// ─── Step 1: Customer ─────────────────────────────────────────────────────────
function StepCustomer({
  initial, onSelect, styles, colors,
}: {
  initial: WCCustomer | null;
  onSelect: (c: WCCustomer | null) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: BrandColors;
}) {
  const [mode, setMode] = useState<'search' | 'create'>('search');

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WCCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [selected, setSelected] = useState<WCCustomer | null>(initial);

  // New customer form state
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState('BF');
  const [newCompany, setNewCompany] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit / promote existing customer state
  const [showEdit, setShowEdit] = useState(false);
  const [promoteMode, setPromoteMode] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('BF');
  const [editCompany, setEditCompany] = useState('');

  const openEdit = (c: WCCustomer, promote = false) => {
    setEditFirst(c.first_name);
    setEditLast(c.last_name);
    setEditPhone(c.billing.phone || '');
    setEditEmail(c.email || '');
    setEditCity(c.billing.city || '');
    setEditCountry(c.billing.country || 'BF');
    setEditCompany(c.billing.company || '');
    setPromoteMode(promote);
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    const email = editEmail.trim();

    if (promoteMode && !email) {
      Alert.alert('Email requis', 'Un email est nécessaire pour créer un compte client.');
      return;
    }

    const updated: WCCustomer = {
      ...selected,
      first_name: editFirst.trim() || selected.first_name,
      last_name:  editLast.trim() || selected.last_name,
      email:      email || selected.email,
      billing: {
        ...selected.billing,
        phone:   editPhone.trim(),
        city:    editCity.trim(),
        country: editCountry.trim() || selected.billing.country,
        company: editCompany.trim(),
        email:   email || selected.email,
      },
    };

    if (promoteMode) {
      setPromoting(true);
      try {
        const { createCustomer: create, linkOrdersToCustomer: linkOrders } = await import('@services/woocommerce');
        const newCustomer = await create({
          first_name: updated.first_name,
          last_name:  updated.last_name,
          email:      updated.email,
          phone:      updated.billing.phone || undefined,
          city:       updated.billing.city || undefined,
          country:    updated.billing.country || 'BF',
          company:    updated.billing.company || undefined,
        });

        // Rattacher les commandes en arrière-plan — ne pas bloquer la saisie de commande
        linkOrders(updated.email, newCustomer.id).catch(() => {});

        const promoted = { ...newCustomer, billing: updated.billing };
        setSelected(promoted);
        setSelectedKey(`reg-${newCustomer.id}`);
        onSelect(promoted);
        setShowEdit(false);
        setPromoteMode(false);
        Alert.alert('Compte créé', `${updated.first_name} ${updated.last_name} est maintenant un client enregistré.`);
      } catch (err) {
        Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de créer le compte.');
      } finally {
        setPromoting(false);
      }
    } else {
      setSelected(updated);
      onSelect(updated);
      setShowEdit(false);
    }
  };

  // Clé stable pour comparer la sélection — les invités ont tous id=0
  const customerKey = (c: WCCustomer): string =>
    c.id !== 0 ? `reg-${c.id}` : `guest-${c.email || c.billing.phone || `${c.first_name}${c.last_name}`}`;

  const [selectedKey, setSelectedKey] = useState<string | null>(initial ? customerKey(initial) : null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoadingGuests(false); return; }
    setLoading(true);
    setLoadingGuests(false);
    try {
      // Étape 1 : clients enregistrés — s'affichent immédiatement
      const registered = await fetchCustomers(q);
      setResults(registered);
      setLoading(false);

      // Étape 2 : clients invités — indicateur visible pendant la recherche
      setLoadingGuests(true);
      const guests = await fetchGuestCustomers(q);
      setLoadingGuests(false);
      if (guests.length > 0) {
        const regEmails = new Set(registered.filter(c => c.email).map(c => c.email.toLowerCase()));
        const unique = guests.filter(g => !g.email || !regEmails.has(g.email.toLowerCase()));
        if (unique.length > 0) {
          setResults(prev => {
            const existingKeys = new Set(prev.map(customerKey));
            const deduped = unique.filter(g => !existingKeys.has(customerKey(g)));
            return deduped.length > 0 ? [...prev, ...deduped] : prev;
          });
        }
      }
    } catch {
      setLoading(false);
      setLoadingGuests(false);
    }
  }, []);

  React.useEffect(() => {
    if (mode !== 'search') return;
    const t = setTimeout(() => search(query), 400);
    return () => clearTimeout(t);
  }, [query, search, mode]);

  const handleCreate = async () => {
    if (!newFirst.trim() || !newLast.trim() || !newEmail.trim()) return;
    setCreating(true);
    try {
      const c = await createCustomer({
        first_name: newFirst.trim(),
        last_name:  newLast.trim(),
        email:      newEmail.trim(),
        phone:      newPhone.trim() || undefined,
        city:       newCity.trim() || undefined,
        country:    newCountry.trim() || 'BF',
        company:    newCompany.trim() || undefined,
      });
      onSelect(c);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de créer le client.');
    } finally {
      setCreating(false);
    }
  };

  // Formulaire d'édition/promotion — partagé entre les deux modes
  const editForm = (
    <View style={[styles.editCustomerForm, promoteMode && styles.editCustomerFormPromote]}>
      {promoteMode ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="person-add-outline" size={15} color={colors.success} />
          <Text style={[styles.newCustomerFormTitle, { color: colors.success }]}>Créer un compte client</Text>
        </View>
      ) : (
        <Text style={styles.newCustomerFormTitle}>Modifier le client</Text>
      )}
      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Prénom</Text>
          <TextInput style={styles.formInput} value={editFirst} onChangeText={setEditFirst}
            placeholder="Prénom" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Nom</Text>
          <TextInput style={styles.formInput} value={editLast} onChangeText={setEditLast}
            placeholder="Nom" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
        </View>
      </View>
      <View style={styles.formFieldFull}>
        <Text style={styles.formLabel}>Téléphone</Text>
        <TextInput style={styles.formInput} value={editPhone} onChangeText={setEditPhone}
          placeholder="+226 XX XX XX XX" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
      </View>
      <View style={styles.formFieldFull}>
        <Text style={styles.formLabel}>Email{promoteMode ? ' *' : ''}</Text>
        <TextInput style={styles.formInput} value={editEmail} onChangeText={setEditEmail}
          placeholder="email@exemple.com" placeholderTextColor={colors.textMuted}
          keyboardType="email-address" autoCapitalize="none" />
      </View>
      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Ville</Text>
          <TextInput style={styles.formInput} value={editCity} onChangeText={setEditCity}
            placeholder="Ouagadougou" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Pays</Text>
          <TextInput style={styles.formInput} value={editCountry} onChangeText={setEditCountry}
            placeholder="BF" placeholderTextColor={colors.textMuted} autoCapitalize="characters" maxLength={2} />
        </View>
      </View>
      <View style={styles.formFieldFull}>
        <Text style={styles.formLabel}>Entreprise</Text>
        <TextInput style={styles.formInput} value={editCompany} onChangeText={setEditCompany}
          placeholder="Nom de l'entreprise" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
      </View>
      <View style={styles.editFormActions}>
        <TouchableOpacity style={styles.editCancelBtn} onPress={() => { setShowEdit(false); setPromoteMode(false); }}>
          <Text style={styles.editCancelText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[promoteMode ? styles.editPromoteBtn : styles.editSaveBtn, promoting && { opacity: 0.6 }]}
          onPress={saveEdit}
          disabled={promoting}
        >
          <Text style={styles.nextBtnText}>{promoting ? 'Création…' : promoteMode ? 'Créer le compte' : 'Enregistrer'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Étape 1 — Client</Text>

      {/* ── Client sélectionné : remplace toute l'interface de recherche ── */}
      {selected ? (
        showEdit ? editForm : (
          <View style={styles.selectedCustomer}>
            <View style={styles.selectedHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                <Text style={styles.selectedLabel}>Client sélectionné</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelected(null); setSelectedKey(null); onSelect(null); }}>
                <Text style={styles.changeLink}>Changer</Text>
              </TouchableOpacity>
            </View>

            {/* Infos client */}
            <View style={styles.selectedBody}>
              <View style={styles.selectedAvatarWrap}>
                <Text style={styles.selectedAvatarText}>
                  {selected.first_name.charAt(0)}{selected.last_name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.selectedName}>{selected.first_name} {selected.last_name}</Text>
                  {selected.id === 0 && (
                    <View style={styles.guestBadge}><Text style={styles.guestBadgeText}>Invité</Text></View>
                  )}
                  {selected.role === 'partner' && (
                    <View style={[styles.guestBadge, { backgroundColor: colors.success + '33' }]}>
                      <Text style={[styles.guestBadgeText, { color: colors.success }]}>Partenaire</Text>
                    </View>
                  )}
                </View>
                {selected.billing.phone ? <Text style={styles.selectedMeta}>{selected.billing.phone}</Text> : null}
                {selected.email ? <Text style={styles.selectedMeta}>{selected.email}</Text> : null}
                {selected.billing.company ? <Text style={styles.selectedMeta}>{selected.billing.company}</Text> : null}
                {selected.billing.city ? <Text style={styles.selectedMeta}>{selected.billing.city}{selected.billing.country ? ` · ${selected.billing.country}` : ''}</Text> : null}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.selectedActions}>
              <TouchableOpacity style={styles.selectedActionBtn} onPress={() => openEdit(selected)}>
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={styles.selectedActionText}>Modifier</Text>
              </TouchableOpacity>
              {selected.id === 0 && (
                <TouchableOpacity style={[styles.selectedActionBtn, styles.selectedActionPromote]} onPress={() => openEdit(selected, true)}>
                  <Ionicons name="person-add-outline" size={14} color={colors.success} />
                  <Text style={[styles.selectedActionText, { color: colors.success }]}>Promouvoir en client</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      ) : (
        <>
          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'search' && styles.modeBtnActive]}
              onPress={() => setMode('search')}
            >
              <Text style={[styles.modeBtnText, mode === 'search' && styles.modeBtnTextActive]}>
                Client existant
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'create' && styles.modeBtnActive]}
              onPress={() => setMode('create')}
            >
              <Text style={[styles.modeBtnText, mode === 'create' && styles.modeBtnTextActive]}>
                Nouveau client
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'search' && (
            <>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Nom, email, téléphone…" />
              {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}
              {loadingGuests && !loading && (
                <View style={styles.guestSearchingBar}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.guestSearchingText}>Recherche dans les commandes invités…</Text>
                </View>
              )}
              {query.length >= 2 && !loading && !loadingGuests && results.length === 0 && (
                <Text style={styles.emptyHint}>Aucun résultat — créez un nouveau client via l'onglet ci-dessus.</Text>
              )}
              {results.map((c) => (
                <TouchableOpacity
                  key={customerKey(c)}
                  style={styles.customerRow}
                  onPress={() => { setSelected(c); setSelectedKey(customerKey(c)); onSelect(c); }}
                >
                  <View style={styles.customerRowHeader}>
                    <Text style={styles.customerName}>{c.first_name} {c.last_name}</Text>
                    {c.id === 0 && (
                      <View style={styles.guestBadge}>
                        <Text style={styles.guestBadgeText}>Invité</Text>
                      </View>
                    )}
                    {c.role === 'partner' && (
                      <View style={[styles.guestBadge, { backgroundColor: colors.success + '33' }]}>
                        <Text style={[styles.guestBadgeText, { color: colors.success }]}>Partenaire</Text>
                      </View>
                    )}
                  </View>
                  {c.email ? <Text style={styles.customerMeta}>{c.email}</Text> : null}
                  {c.billing.phone ? <Text style={styles.customerMeta}>{c.billing.phone}</Text> : null}
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}

      {!selected && mode === 'create' && (
        <View style={styles.newCustomerForm}>
          <Text style={styles.newCustomerFormTitle}>Informations du client</Text>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Prénom *</Text>
              <TextInput
                style={styles.formInput}
                value={newFirst}
                onChangeText={setNewFirst}
                placeholder="Prénom"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Nom *</Text>
              <TextInput
                style={styles.formInput}
                value={newLast}
                onChangeText={setNewLast}
                placeholder="Nom"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
          </View>
          <View style={styles.formFieldFull}>
            <Text style={styles.formLabel}>Téléphone</Text>
            <TextInput
              style={styles.formInput}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="+226 XX XX XX XX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.formFieldFull}>
            <Text style={styles.formLabel}>Email *</Text>
            <TextInput
              style={styles.formInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Ville</Text>
              <TextInput
                style={styles.formInput}
                value={newCity}
                onChangeText={setNewCity}
                placeholder="Ouagadougou"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Pays</Text>
              <TextInput
                style={styles.formInput}
                value={newCountry}
                onChangeText={setNewCountry}
                placeholder="BF"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>
          <View style={styles.formFieldFull}>
            <Text style={styles.formLabel}>Entreprise (optionnel)</Text>
            <TextInput
              style={styles.formInput}
              value={newCompany}
              onChangeText={setNewCompany}
              placeholder="Nom de l'entreprise"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>
          <TouchableOpacity
            style={[styles.createCustomerBtn, (!newFirst.trim() || !newLast.trim() || !newEmail.trim() || creating) && styles.nextBtnDisabled]}
            onPress={handleCreate}
            disabled={!newFirst.trim() || !newLast.trim() || !newEmail.trim() || creating}
          >
            {creating
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.nextBtnText}>Confirmer et continuer →</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Step 2: Products ─────────────────────────────────────────────────────────
function StepProducts({
  customer, items, onChange, onNext, styles, colors,
}: {
  customer: WCCustomer | null;
  items: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
  onNext: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: BrandColors;
}) {
  const [allProducts, setAllProducts] = useState<WCProduct[]>([]);
  const [topProducts, setTopProducts] = useState<WCProduct[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);

  // Variation picker state
  const [pickerProduct, setPickerProduct] = useState<WCProduct | null>(null);
  const [variations, setVariations]       = useState<WCProductVariation[]>([]);
  const [loadingVars, setLoadingVars]     = useState(false);

  const isPartner = customer?.role === 'partner';

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { fetchProducts } = await import('@services/woocommerce');
        const regular = await fetchProducts();
        if (isPartner) {
          const partnerList = await fetchPartnerProducts();
          const merged = regular.map((p) => {
            const pp = partnerList.find((x) => x.id === p.id);
            return pp ? { ...p, partner_price: pp.partner_price } : p;
          });
          setAllProducts(merged);
        } else {
          setAllProducts(regular);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isPartner]);

  React.useEffect(() => {
    fetchTopProducts(6).then(setTopProducts).catch(() => {}).finally(() => setLoadingTop(false));
  }, []);

  const q = query.trim().toLowerCase();
  const products = q.length >= 2
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      )
    : allProducts;

  // Clé unique par ligne : product + variation
  const lineKey = (li: LineItemDraft) =>
    li.variation ? `${li.product.id}-${li.variation.id}` : String(li.product.id);

  const addSimpleProduct = (product: WCProduct) => {
    const key = String(product.id);
    const existing = items.find((li) => lineKey(li) === key);
    if (existing) {
      onChange(items.map((li) => lineKey(li) === key ? { ...li, quantity: li.quantity + 1 } : li));
    } else {
      onChange([...items, { product, quantity: 1, discountType: 'none', discountValue: 0 }]);
    }
  };

  const addVariation = (product: WCProduct, variation: WCProductVariation) => {
    const key = `${product.id}-${variation.id}`;
    const existing = items.find((li) => lineKey(li) === key);
    if (existing) {
      onChange(items.map((li) => lineKey(li) === key ? { ...li, quantity: li.quantity + 1 } : li));
    } else {
      // Injecter le partner_price si disponible sur le produit parent
      const varWithPartner = isPartner && product.partner_price
        ? { ...variation, partner_price: product.partner_price }
        : variation;
      onChange([...items, { product, variation: varWithPartner, quantity: 1, discountType: 'none', discountValue: 0 }]);
    }
    setPickerProduct(null);
  };

  const handleProductPress = async (product: WCProduct) => {
    if (product.type !== 'variable') {
      addSimpleProduct(product);
      return;
    }
    // Produit variable : charger et afficher le picker
    setPickerProduct(product);
    setVariations([]);
    setLoadingVars(true);
    try {
      const vars = await fetchProductVariations(product.id);
      setVariations(vars.filter((v) => v.status === 'publish'));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les variations.');
      setPickerProduct(null);
    } finally {
      setLoadingVars(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<LineItemDraft>) => {
    onChange(items.map((li, i) => i === idx ? { ...li, ...patch } : li));
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const total = items.reduce((s, li) => s + getLineTotal(li), 0);

  const productRowContent = (p: WCProduct) => (
    <>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{p.name}</Text>
        {p.sku ? <Text style={styles.productSku}>{p.sku}</Text> : null}
        {p.type === 'variable' && (
          <Text style={[styles.productSku, { color: colors.primary }]}>Variations disponibles ›</Text>
        )}
      </View>
      {p.type !== 'variable' && (
        <CurrencyText
          amount={isPartner && p.partner_price ? p.partner_price : p.price}
          size="sm"
          bold={isPartner && !!p.partner_price}
          color={isPartner && p.partner_price ? colors.success : undefined}
        />
      )}
      <Text style={styles.addBtn}>+</Text>
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* ─── Product search (top, scrollable) ─── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepTitle}>Étape 2 — Produits</Text>

        {isPartner && (
          <View style={styles.partnerNotice}>
            <Text style={styles.partnerNoticeText}>🤝 Prix partenaire actifs</Text>
          </View>
        )}

        <SearchBar value={query} onChangeText={setQuery} placeholder="Rechercher un produit…" />

        {!query && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up-outline" size={14} color={colors.textMuted} />
              <Text style={styles.sectionHeaderText}>Fréquemment commandés</Text>
            </View>
            {loadingTop ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : topProducts.length > 0 ? (
              topProducts.map((p) => (
                <TouchableOpacity key={`top-${p.id}`} style={styles.productRow} onPress={() => handleProductPress(p)}>
                  {productRowContent(p)}
                </TouchableOpacity>
              ))
            ) : null}
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={14} color={colors.textMuted} />
              <Text style={styles.sectionHeaderText}>Tous les produits</Text>
            </View>
          </>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}

        {products.slice(0, 15).map((p) => (
          <TouchableOpacity key={p.id} style={styles.productRow} onPress={() => handleProductPress(p)}>
            {productRowContent(p)}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── Sticky cart (always visible when items > 0) ─── */}
      {items.length > 0 && (
        <View style={styles.stickyCartPanel}>
          <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: BRANDING.spacing.sm }} keyboardShouldPersistTaps="handled">
            {items.map((li, idx) => (
              <View key={lineKey(li)} style={styles.cartItem}>
                <View style={styles.cartItemTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{li.product.name}</Text>
                    {li.variation && (
                      <Text style={styles.cartItemVariation}>{variationLabel(li.variation)}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeItem(idx)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.cartItemRow}>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      onPress={() => li.quantity > 1 ? updateItem(idx, { quantity: li.quantity - 1 }) : removeItem(idx)}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{li.quantity}</Text>
                    <TouchableOpacity onPress={() => updateItem(idx, { quantity: li.quantity + 1 })} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.discountRow}>
                    <TouchableOpacity
                      style={[styles.discountType, li.discountType === 'percent' && styles.discountTypeActive]}
                      onPress={() => updateItem(idx, { discountType: li.discountType === 'percent' ? 'none' : 'percent', discountValue: 0 })}
                    >
                      <Text style={styles.discountTypeText}>%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.discountType, li.discountType === 'fixed' && styles.discountTypeActive]}
                      onPress={() => updateItem(idx, { discountType: li.discountType === 'fixed' ? 'none' : 'fixed', discountValue: 0 })}
                    >
                      <Text style={styles.discountTypeText}>F</Text>
                    </TouchableOpacity>
                    {li.discountType !== 'none' && (
                      <TextInput
                        style={styles.discountInput}
                        value={li.discountValue > 0 ? String(li.discountValue) : ''}
                        onChangeText={(v) => updateItem(idx, { discountValue: parseFloat(v) || 0 })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                    )}
                  </View>
                  <CurrencyText amount={getLineTotal(li)} size="sm" bold />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>Panier · {items.length} article{items.length > 1 ? 's' : ''}</Text>
            <CurrencyText amount={total} size="lg" bold />
          </View>
        </View>
      )}

      {/* ─── Variation picker modal ─── */}
      <Modal
        visible={pickerProduct !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerProduct(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerProduct(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choisir une variation</Text>
            {pickerProduct && (
              <Text style={styles.modalProduct}>{pickerProduct.name}</Text>
            )}

            {loadingVars ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: BRANDING.spacing.lg }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {variations.map((v) => {
                  const outOfStock = v.stock_status === 'outofstock';
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.variationRow, outOfStock && styles.variationRowOut, { marginBottom: BRANDING.spacing.sm }]}
                      onPress={() => !outOfStock && pickerProduct && addVariation(pickerProduct, v)}
                      disabled={outOfStock}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.variationLabel}>{variationLabel(v)}</Text>
                        {v.sku ? <Text style={styles.variationSku}>{v.sku}</Text> : null}
                        {outOfStock && <Text style={styles.outOfStockTag}>Rupture de stock</Text>}
                      </View>
                      {!outOfStock && (
                        <CurrencyText
                          amount={isPartner && v.partner_price ? v.partner_price : v.price}
                          size="sm"
                          bold={isPartner && !!v.partner_price}
                          color={isPartner && v.partner_price ? colors.success : undefined}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalCancel} onPress={() => setPickerProduct(null)}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Step 3: Payment ──────────────────────────────────────────────────────────
function StepPayment({
  payment, onChange, onNext, styles, colors,
}: {
  payment: PaymentChoice; onChange: (p: PaymentChoice) => void; onNext: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: BrandColors;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>Étape 3 — Paiement</Text>

      <TouchableOpacity
        style={[styles.paymentCard, payment.mode === 'offline' && styles.paymentCardActive]}
        onPress={() => onChange({ ...payment, mode: 'offline' })}
      >
        <View style={[styles.paymentCardIconWrap, payment.mode === 'offline' && { backgroundColor: colors.success + '22' }]}>
          <Ionicons name="wallet-outline" size={22} color={payment.mode === 'offline' ? colors.success : colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentCardTitle}>Paiement hors ligne</Text>
          <Text style={styles.paymentCardSub}>Cash · Mobile money · Virement</Text>
        </View>
        {payment.mode === 'offline' && (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        )}
      </TouchableOpacity>

      {payment.mode === 'offline' && (
        <View style={styles.methodRow}>
          <Text style={styles.methodLabel}>Méthode de paiement</Text>
          <View style={styles.chipRow}>
            {OFFLINE_METHODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.chip, payment.detail === m.value && styles.chipActive]}
                onPress={() => onChange({ ...payment, detail: payment.detail === m.value ? null : m.value })}
              >
                <Text style={[styles.chipLabel, payment.detail === m.value && styles.chipLabelActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.paymentCard, payment.mode === 'link' && styles.paymentCardActive]}
        onPress={() => onChange({ ...payment, mode: 'link', detail: null })}
      >
        <View style={[styles.paymentCardIconWrap, payment.mode === 'link' && { backgroundColor: colors.info + '22' }]}>
          <Ionicons name="send-outline" size={20} color={payment.mode === 'link' ? colors.info : colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentCardTitle}>Lien de paiement</Text>
          <Text style={styles.paymentCardSub}>Commande en attente — le client paie en ligne</Text>
        </View>
        {payment.mode === 'link' && (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Step 4: Recap ────────────────────────────────────────────────────────────
function StepRecap({
  customer, items, payment, total, submitting, onSubmit, styles,
}: {
  customer: WCCustomer;
  items: LineItemDraft[];
  payment: PaymentChoice;
  total: number;
  submitting: boolean;
  onSubmit: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>Étape 4 — Récapitulatif</Text>

      <View style={styles.recapSection}>
        <Text style={styles.recapLabel}>Client</Text>
        <Text style={styles.recapValue}>{customer.first_name} {customer.last_name}</Text>
        {customer.billing.phone && <Text style={styles.recapSub}>{customer.billing.phone}</Text>}
      </View>

      <View style={styles.recapSection}>
        <Text style={styles.recapLabel}>Articles ({items.length})</Text>
        {items.map((li, i) => (
          <View key={i} style={styles.recapItem}>
            <Text style={styles.recapItemName} numberOfLines={2}>
              {li.product.name}
              {li.variation ? ` — ${variationLabel(li.variation)}` : ''}
              {' '}× {li.quantity}
            </Text>
            <CurrencyText amount={getLineTotal(li)} size="sm" />
          </View>
        ))}
      </View>

      <View style={styles.recapSection}>
        <Text style={styles.recapLabel}>Paiement</Text>
        <Text style={styles.recapValue}>
          {payment.mode === 'link' ? 'Lien de paiement' : 'Hors ligne'}
          {payment.detail ? ` — ${OFFLINE_METHODS.find((m) => m.value === payment.detail)?.label}` : ''}
        </Text>
      </View>

      <View style={styles.recapTotal}>
        <Text style={styles.recapTotalLabel}>Total commande</Text>
        <CurrencyText amount={total} size="xl" bold />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitBtnText}>
            {payment.mode === 'link' ? '🔗 Créer et envoyer lien' : '✓ Créer la commande'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total, styles }: { current: number; total: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <React.Fragment key={n}>
          <View style={[styles.stepDot, n <= current && styles.stepDotActive, n === current && styles.stepDotCurrent]}>
            <Text style={[styles.stepDotText, n <= current && styles.stepDotTextActive]}>{n}</Text>
          </View>
          {n < total && <View style={[styles.stepLine, n < current && styles.stepLineActive]} />}
        </React.Fragment>
      ))}
    </View>
  );
}
