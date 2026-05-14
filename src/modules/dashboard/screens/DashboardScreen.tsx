import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Modal, Pressable, AppState, type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import { useAuth } from '@modules/auth/hooks/useAuth';
import { fetchDashboardStats, fetchOrders, fetchTopProducts, fetchSiteVisits } from '@services/woocommerce';
import CurrencyText from '@components/CurrencyText';
import StatusBadge from '@components/StatusBadge';
import LoadingSpinner from '@components/LoadingSpinner';
import UpdateBanner from '@modules/updates/components/UpdateBanner';
import { useUpdateChecker } from '@modules/updates/hooks/useUpdateChecker';
import type { DashboardStats, WCOrder } from '@app-types/woocommerce';
import type { DashboardPeriod } from '@config/constants';
import type { MainTabParamList, OrdersStackParamList } from '@navigation/types';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<OrdersStackParamList>
>;

const PERIODS: { key: DashboardPeriod; label: string; shortLabel: string }[] = [
  { key: 'today',   label: "Aujourd'hui",  shortLabel: "Auj." },
  { key: 'week',    label: 'Cette semaine', shortLabel: 'Semaine' },
  { key: 'month',   label: 'Ce mois-ci',   shortLabel: 'Mois' },
  { key: 'quarter', label: 'Ce trimestre', shortLabel: '3 mois' },
  { key: 'year',    label: 'Cette année',  shortLabel: 'Année' },
];

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe:           { flex: 1, backgroundColor: c.background },
  content:        { padding: BRANDING.spacing.lg, gap: BRANDING.spacing.md },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: BRANDING.spacing.xs },
  headerLeft:     { flex: 1, marginRight: BRANDING.spacing.md },
  greeting:       { fontSize: BRANDING.fonts.sizeXL, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  subGreeting:    { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted, marginTop: 2 },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.sm },
  themeBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  periodBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: BRANDING.radius.full, paddingHorizontal: BRANDING.spacing.md, paddingVertical: 7 },
  periodBtnIcon:  { fontSize: 14 },
  periodBtnLabel: { fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary, fontWeight: BRANDING.fonts.weightSemiBold },
  periodBtnCaret: { fontSize: 10, color: c.textMuted, marginTop: 1 },
  kpiRow:         { flexDirection: 'row', gap: BRANDING.spacing.sm },
  kpiNumber:      { fontSize: 26, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary, lineHeight: 32 },
  section:        { backgroundColor: c.surface, borderRadius: 16, padding: BRANDING.spacing.lg, borderWidth: 1, borderColor: c.border, gap: BRANDING.spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.sm },
  sectionTitle:   { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  seeAll:         { fontSize: BRANDING.fonts.sizeSM, color: c.primary },
  topRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: BRANDING.spacing.sm, gap: BRANDING.spacing.sm },
  topRowBorder:   { borderBottomWidth: 1, borderBottomColor: c.border },
  topRank:        { width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary + '22', alignItems: 'center', justifyContent: 'center' },
  topRankText:    { fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightBold, color: c.primary },
  topName:        { flex: 1, fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary, fontWeight: BRANDING.fonts.weightMedium },
  statusGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: BRANDING.spacing.sm, marginTop: BRANDING.spacing.xs },
  statusItem:     { alignItems: 'center', minWidth: 60 },
  statusCount:    { fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightBold },
  statusLabel:    { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, marginTop: 2 },
  recentOrderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: BRANDING.spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  recentOrderLeft:{ flex: 1 },
  recentOrderNum: { fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightSemiBold, color: c.primary },
  recentOrderName:{ fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 1 },
  recentOrderRight:{ alignItems: 'flex-end', gap: 4 },
  empty:          { color: c.textMuted, fontSize: BRANDING.fonts.sizeSM, textAlign: 'center', paddingVertical: BRANDING.spacing.md },
  menuBackdrop:   { ...StyleSheet.absoluteFillObject },
  periodMenu:     { position: 'absolute', right: BRANDING.spacing.lg, backgroundColor: c.surfaceElevated, borderRadius: BRANDING.radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden', minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 12 },
  periodMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: BRANDING.spacing.lg, paddingVertical: BRANDING.spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  periodMenuItemActive: { backgroundColor: c.primary + '22' },
  periodMenuLabel:{ fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  periodMenuLabelActive: { color: c.primary, fontWeight: BRANDING.fonts.weightSemiBold },
  periodMenuCheck:{ fontSize: BRANDING.fonts.sizeSM, color: c.primary, fontWeight: BRANDING.fonts.weightBold },
});

const makeKpiStyles = (c: BrandColors) => StyleSheet.create({
  card:       { flex: 1, borderRadius: BRANDING.radius.lg, padding: BRANDING.spacing.md, borderWidth: 1, gap: BRANDING.spacing.sm },
  top:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:      { fontSize: BRANDING.fonts.sizeXS, color: c.textSecondary, fontWeight: BRANDING.fonts.weightMedium, textTransform: 'uppercase', letterSpacing: 0.7, flex: 1 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  valueWrap:  { marginTop: 2 },
});

export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles    = useMemo(() => makeStyles(colors), [colors]);
  const kpiStyles = useMemo(() => makeKpiStyles(colors), [colors]);
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { updateInfo, dismiss } = useUpdateChecker();

  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [siteVisits, setSiteVisits] = useState<{ visitors: number; pageviews: number } | null>(null);
  const [recentOrders, setRecentOrders] = useState<WCOrder[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; price: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [dropdownY, setDropdownY] = useState(100);
  const periodBtnRef = useRef<View>(null);

  const load = useCallback(async () => {
    try {
      // fetchOrders est critique (affiche les dernières commandes même si les stats échouent).
      // fetchDashboardStats et fetchLowStockProducts ont leur propre catch — leur échec
      // n'empêche pas le reste de s'afficher (ex: permissions insuffisantes sur /reports).
      const [s, orders, top, visits] = await Promise.all([
        fetchDashboardStats(period).catch(() => null),
        fetchOrders({ per_page: 5 }),
        fetchTopProducts(5).catch(() => []),
        fetchSiteVisits(period).catch(() => null),
      ]);
      setStats(s);
      setRecentOrders(orders.slice(0, 5));
      setTopProducts(top.map((p) => ({ name: p.name, price: p.price })));
      setSiteVisits(visits);
    } catch (err) {
      // fetchOrders a échoué — erreur réseau ou auth
      console.warn('[Dashboard] Échec chargement commandes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Refresh automatique quand l'app revient au premier plan
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        load();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bonne après-midi';
    return 'Bonsoir';
  };

  const currentPeriod = PERIODS.find((p) => p.key === period)!;

  const openPeriodMenu = () => {
    periodBtnRef.current?.measureInWindow((_x, y, _w, h) => {
      setDropdownY(y + h + 6);
    });
    setShowPeriodMenu(true);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Chargement du tableau de bord…" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting()}, {user?.name ?? 'Rodrigue'} 👋</Text>
            <Text style={styles.subGreeting}>Aperçu de votre boutique</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Toggle jour / nuit */}
            <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme} activeOpacity={0.7}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            {/* Period selector button */}
            <TouchableOpacity
              ref={periodBtnRef}
              style={styles.periodBtn}
              onPress={openPeriodMenu}
              activeOpacity={0.75}
            >
              <Text style={styles.periodBtnIcon}>📅</Text>
              <Text style={styles.periodBtnLabel}>{currentPeriod.shortLabel}</Text>
              <Text style={styles.periodBtnCaret}>▾</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Update banner */}
        {updateInfo && <UpdateBanner info={updateInfo} onDismiss={dismiss} />}

        {/* KPI cards — s'affichent avec des tirets si les stats échouent */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="Revenu"
            value={stats
              ? <CurrencyText amount={stats.revenue[period]} size="xxl" bold color={colors.textPrimary} />
              : <Text style={styles.kpiNumber}>—</Text>
            }
            iconName="trending-up"
            accent={colors.success}
            kpiStyles={kpiStyles}
          />
          <KpiCard
            label="Commandes"
            value={<Text style={styles.kpiNumber}>{stats?.period_order_count ?? '—'}</Text>}
            iconName="bag-handle-outline"
            accent={colors.primary}
            kpiStyles={kpiStyles}
          />
        </View>

        <View style={styles.kpiRow}>
          <KpiCard
            label="Taux de conversion"
            value={
              <Text style={styles.kpiNumber}>
                {siteVisits && stats && siteVisits.visitors > 0 && stats.period_order_count != null
                  ? `${((stats.period_order_count / siteVisits.visitors) * 100).toFixed(1)}%`
                  : siteVisits === null ? '—' : '0%'}
              </Text>
            }
            iconName="trending-up-outline"
            accent={colors.info}
            kpiStyles={kpiStyles}
          />
          <KpiCard
            label="En traitement"
            value={
              <Text style={[styles.kpiNumber, { color: colors.status.processing }]}>
                {stats?.order_counts.processing ?? '—'}
              </Text>
            }
            iconName="time-outline"
            accent={colors.status.processing}
            kpiStyles={kpiStyles}
          />
        </View>

        <View style={styles.kpiRow}>
          <KpiCard
            label="Visiteurs"
            value={<Text style={styles.kpiNumber}>{siteVisits?.visitors ?? '—'}</Text>}
            iconName="eye-outline"
            accent={colors.accent}
            kpiStyles={kpiStyles}
          />
          <KpiCard
            label="Pages vues"
            value={<Text style={styles.kpiNumber}>{siteVisits?.pageviews ?? '—'}</Text>}
            iconName="document-text-outline"
            accent={colors.textMuted}
            kpiStyles={kpiStyles}
          />
        </View>

        {/* Status breakdown — only when stats loaded */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Répartition par statut</Text>
            <View style={styles.statusGrid}>
              {Object.entries(stats.order_counts).map(([status, count]) => {
                const colorKey = status === 'on_hold' ? 'on-hold' : status;
                const label = status === 'on_hold' ? 'en pause' : status;
                return (
                  <View key={status} style={styles.statusItem}>
                    <Text style={[styles.statusCount, { color: colors.status[colorKey] ?? colors.textMuted }]}>
                      {count as number}
                    </Text>
                    <Text style={styles.statusLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Top products */}
        {topProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="star-outline" size={16} color={colors.warning} />
                <Text style={styles.sectionTitle}>Produits populaires</Text>
              </View>
            </View>
            {topProducts.map((p, idx) => {
              const isLast = idx === topProducts.length - 1;
              return (
                <View key={idx} style={[styles.topRow, !isLast && styles.topRowBorder]}>
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                  <CurrencyText amount={p.price} size="sm" />
                </View>
              );
            })}
          </View>
        )}

        {/* Recent orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dernières commandes</Text>
            <TouchableOpacity onPress={() => navigation.navigate('OrdersTab' as any)}>
              <Text style={styles.seeAll}>Voir tout →</Text>
            </TouchableOpacity>
          </View>

          {recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.recentOrderRow}
              onPress={() => navigation.navigate('OrdersTab' as any, { screen: 'OrderDetail', params: { orderId: order.id } } as any)}
            >
              <View style={styles.recentOrderLeft}>
                <Text style={styles.recentOrderNum}>#{order.number}</Text>
                <Text style={styles.recentOrderName}>
                  {order.billing.first_name} {order.billing.last_name}
                </Text>
              </View>
              <View style={styles.recentOrderRight}>
                <CurrencyText amount={order.total} size="sm" bold />
                <StatusBadge status={order.status} size="sm" />
              </View>
            </TouchableOpacity>
          ))}

          {recentOrders.length === 0 && (
            <Text style={styles.empty}>Aucune commande récente</Text>
          )}
        </View>
      </ScrollView>

      {/* Period dropdown modal */}
      <Modal
        visible={showPeriodMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPeriodMenu(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setShowPeriodMenu(false)} />
        <View style={[styles.periodMenu, { top: dropdownY }]}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodMenuItem, period === p.key && styles.periodMenuItemActive]}
              onPress={() => { setPeriod(p.key); setShowPeriodMenu(false); }}
            >
              <Text style={[styles.periodMenuLabel, period === p.key && styles.periodMenuLabelActive]}>
                {p.label}
              </Text>
              {period === p.key && <Text style={styles.periodMenuCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function KpiCard({
  label, value, iconName, accent, kpiStyles,
}: {
  label: string;
  value: React.ReactNode;
  iconName: IoniconName;
  accent: string;
  kpiStyles: ReturnType<typeof makeKpiStyles>;
}) {
  return (
    <View style={[kpiStyles.card, { backgroundColor: accent + '28', borderColor: accent + '55' }]}>
      <View style={kpiStyles.top}>
        <Text style={kpiStyles.label}>{label}</Text>
        <View style={[kpiStyles.iconCircle, { backgroundColor: accent + '44' }]}>
          <Ionicons name={iconName} size={15} color={accent} />
        </View>
      </View>
      <View style={kpiStyles.valueWrap}>{value}</View>
    </View>
  );
}

