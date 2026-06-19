import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import type { OrderStatus } from '@app-types/woocommerce';

export interface OrderFilters {
  status: OrderStatus | 'any';
}

interface Props {
  visible: boolean;
  filters: OrderFilters;
  onApply: (filters: OrderFilters) => void;
  onClose: () => void;
}

const STATUSES: { value: OrderStatus | 'any'; label: string }[] = [
  { value: 'any',        label: 'Tous les statuts' },
  { value: 'pending',    label: '⏳ En attente' },
  { value: 'processing', label: '🔄 En cours' },
  { value: 'on-hold',    label: '⏸ En pause' },
  { value: 'completed',  label: '✅ Terminée' },
  { value: 'cancelled',  label: '❌ Annulée' },
  { value: 'refunded',   label: '↩️ Remboursée' },
  { value: 'failed',     label: '⛔ Échouée' },
];

const makeStyles = (c: BrandColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: BRANDING.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BRANDING.spacing.xl,
    marginBottom: BRANDING.spacing.md,
  },
  title: {
    fontSize: BRANDING.fonts.sizeLG,
    fontWeight: BRANDING.fonts.weightBold,
    color: c.textPrimary,
  },
  resetText: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.primary,
  },
  body: {
    paddingHorizontal: BRANDING.spacing.xl,
    paddingBottom: BRANDING.spacing.lg,
  },
  sectionLabel: {
    fontSize: BRANDING.fonts.sizeXS,
    fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: BRANDING.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BRANDING.spacing.sm,
  },
  chip: {
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: BRANDING.spacing.xs,
    borderRadius: BRANDING.radius.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipLabel: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textSecondary,
  },
  chipLabelActive: {
    color: '#FFF',
    fontWeight: BRANDING.fonts.weightSemiBold,
  },
  applyBtn: {
    backgroundColor: c.primary,
    marginHorizontal: BRANDING.spacing.xl,
    borderRadius: BRANDING.radius.md,
    paddingVertical: BRANDING.spacing.md,
    alignItems: 'center',
    marginTop: BRANDING.spacing.sm,
  },
  applyText: {
    color: '#FFF',
    fontSize: BRANDING.fonts.sizeMD,
    fontWeight: BRANDING.fonts.weightSemiBold,
  },
});

export default function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [local, setLocal] = React.useState<OrderFilters>(filters);

  React.useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible, filters]);

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    const reset: OrderFilters = { status: 'any' };
    setLocal(reset);
    onApply(reset);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Filtres</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionLabel}>Statut</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.chip, local.status === s.value && styles.chipActive]}
                onPress={() => setLocal((f) => ({ ...f, status: s.value }))}
              >
                <Text style={[styles.chipLabel, local.status === s.value && styles.chipLabelActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
          <Text style={styles.applyText}>Appliquer les filtres</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
