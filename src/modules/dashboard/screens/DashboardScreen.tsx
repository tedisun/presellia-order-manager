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

// ─── Helpers calendrier ──────────────────────────────────────────────────────
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(d: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  return d > start && d < end;
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Composant Calendrier ────────────────────────────────────────────────────
interface CalendarProps {
  colors: BrandColors;
  selectedStart: Date | null;
  selectedEnd: Date | null;
  onDayPress: (date: Date) => void;
}

function CalendarMonth({ colors, selectedStart, selectedEnd, onDayPress }: CalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  // Monday-first: convert Sunday=0 to 6, Mon=1→0, etc.
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  return (
    <View>
      {/* Navigation mois */}
      <View style={calStyles.calNav}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.calNavBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[calStyles.calMonthTitle, { color: colors.textPrimary }]}>
          {MONTHS_FR[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={calStyles.calNavBtn}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* En-tête jours */}
      <View style={calStyles.calRow}>
        {DAYS_FR.map(d => (
          <Text key={d} style={[calStyles.calDayLabel, { color: colors.textMuted }]}>{d}</Text>
        ))}
      </View>

      {/* Grille des jours */}
      <View style={calStyles.calGrid}>
        {cells.map((date, idx) => {
          if (!date) return <View key={`empty-${idx}`} style={calStyles.calCell} />;
          const isStart = selectedStart ? sameDay(date, selectedStart) : false;
          const isEnd   = selectedEnd   ? sameDay(date, selectedEnd)   : false;
          const inRange = isBetween(date, selectedStart, selectedEnd);
          const isToday = sameDay(date, today);
          const future  = date > today;

          let cellBg   = 'transparent';
          let textColor = future ? colors.textMuted : colors.textPrimary;
          let borderR  = 8;

          if (isStart || isEnd) {
            cellBg = colors.primary;
            textColor = '#FFF';
          } else if (inRange) {
            cellBg = colors.primary + '22';
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[calStyles.calCell, { backgroundColor: cellBg, borderRadius: borderR }]}
              onPress={() => !future && onDayPress(date)}
              activeOpacity={0.7}
              disabled={future}
            >
              {isToday && !isStart && !isEnd && (
                <View style={[calStyles.todayDot, { backgroundColor: colors.primary }]} />
              )}
              <Text style={[calStyles.calDayText, { color: textColor, fontWeight: (isStart || isEnd) ? '700' : '400' }]}>
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  calNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn:    { padding: 6 },
  calMonthTitle:{ fontSize: 15, fontWeight: '700' },
  calRow:       { flexDirection: 'row', marginBottom: 4 },
  calDayLabel:  { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:      { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDayText:   { fontSize: 13 },
  todayDot:     { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2 },
});

// ─── Styles principaux ───────────────────────────────────────────────────────
const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe:           { flex: 1, backgroundColor: c.background },
  content:        { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  headerLeft:     { flex: 1, marginRight: BRANDING.spacing.md },
  greeting:       { fontSize: 22, fontWeight: '700', color: c.textPrimary },
  subGreeting:    { fontSize: 13, color: c.textMuted, marginTop: 4 },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.sm },
  avatarCircle:   { width: 42, height: 42, borderRadius: 21, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  avatarText:     { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Onglets de filtre horizontaux
  chipsContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipActive:     { backgroundColor: c.primary, borderColor: c.primary },
  chipInactive:   { backgroundColor: c.surfaceElevated, borderColor: c.border },
  chipTextActive: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  chipTextInactive: { fontSize: 13, fontWeight: '500', color: c.textSecondary },
  chipChevron:    { fontSize: 10, color: '#FFF', marginLeft: 2 },

  // Grille de KPIs
  kpiRow:         { flexDirection: 'row', gap: 12 },
  kpiCard:        { flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 6 },
  kpiHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  kpiIconBox:     { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primary + '15', alignItems: 'center', justifyContent: 'center' },
  trendContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 6 },
  trendTextGreen: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  trendTextRed:   { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  kpiLabel:       { fontSize: 12, color: c.textMuted, fontWeight: '500', marginTop: 4 },
  kpiValue:       { fontSize: 18, fontWeight: '700', color: c.textPrimary, marginTop: 2 },

  // Sections listes
  section:        { gap: 12 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  sectionTitle:   { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  seeAll:         { fontSize: 13, color: c.primary, fontWeight: '600' },

  // Top Produits
  topProductCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  topRank:        { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  topRankText:    { fontSize: 13, fontWeight: '700', color: '#FFF' },
  topInfo:        { flex: 1, gap: 2 },
  topName:        { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  topSales:       { fontSize: 11, color: c.textMuted },

  // Commandes récentes
  recentOrderCard:{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  clientAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  clientAvatarText: { fontSize: 13, fontWeight: '700', color: c.primary },
  orderInfo:      { flex: 1, gap: 4 },
  clientName:     { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  statusBadgeWrap:{ alignSelf: 'flex-start' },
  orderRight:     { alignItems: 'flex-end', justifyContent: 'center' },

  empty:          { color: c.textMuted, fontSize: BRANDING.fonts.sizeSM, textAlign: 'center', paddingVertical: BRANDING.spacing.md },
  themeToggle:    { width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },

  // Modal calendrier
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  calendarSheet:  { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  calHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 16 },
  calTitle:       { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 12 },
  calHint:        { fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: 'center' },
  calRangeRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  calRangeBox:    { flex: 1, backgroundColor: c.surfaceElevated, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  calRangeLabel:  { fontSize: 11, color: c.textMuted, marginBottom: 2 },
  calRangeValue:  { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  calConfirmBtn:  { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  calConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  calConfirmDisabled: { opacity: 0.4 },
});

// ─── Composant principal ─────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { updateInfo, dismiss } = useUpdateChecker();

  const [period, setPeriod]           = useState<DashboardPeriod>('today');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [siteVisits, setSiteVisits]   = useState<{ visitors: number; pageviews: number } | null>(null);
  const [recentOrders, setRecentOrders] = useState<WCOrder[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  // Calendrier
  const [showCalendar, setShowCalendar]     = useState(false);
  const [calStart, setCalStart]             = useState<Date | null>(null);
  const [calEnd, setCalEnd]                 = useState<Date | null>(null);
  const [calPickingEnd, setCalPickingEnd]   = useState(false);

  const load = useCallback(async () => {
    try {
      const cr = (period === 'custom' && customRange) ? customRange : undefined;
      const [s, orders, top, visits] = await Promise.all([
        fetchDashboardStats(period, cr).catch(() => null),
        fetchOrders({ per_page: 5 }),
        fetchTopProducts(5).catch(() => []),
        fetchSiteVisits(period, cr).catch(() => null),
      ]);
      setStats(s);
      setRecentOrders(orders.slice(0, 5));
      setTopProducts(top);
      setSiteVisits(visits);
    } catch (err) {
      console.warn('[Dashboard] Échec chargement:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, customRange]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current !== 'active' && next === 'active') load();
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const getInitials = (firstName: string, lastName: string) => {
    const f = firstName ? firstName.trim().charAt(0).toUpperCase() : '';
    const l = lastName  ? lastName.trim().charAt(0).toUpperCase()  : '';
    return f + l || 'G';
  };

  const getTrend = (kpi: 'revenue' | 'orders' | 'visitors' | 'conversion') => {
    if (period === 'month') {
      if (kpi === 'revenue')    return { text: '↑ 12%',  isUp: true  };
      if (kpi === 'orders')     return { text: '↑ 8%',   isUp: true  };
      if (kpi === 'visitors')   return { text: '↑ 5%',   isUp: true  };
      return { text: '↓ 0,3%', isUp: false };
    } else if (period === 'today') {
      if (kpi === 'revenue')    return { text: '↑ 4.2%', isUp: true  };
      if (kpi === 'orders')     return { text: '↑ 2%',   isUp: true  };
      if (kpi === 'visitors')   return { text: '↓ 1.5%', isUp: false };
      return { text: '↑ 0.5%', isUp: true };
    }
    if (kpi === 'revenue')  return { text: '↑ 8.5%', isUp: true };
    if (kpi === 'orders')   return { text: '↑ 6%',   isUp: true };
    if (kpi === 'visitors') return { text: '↑ 4.2%', isUp: true };
    return { text: '↑ 0.2%', isUp: true };
  };

  const renderConversionRate = () => {
    if (stats?.conversion_rate) return `${(stats.conversion_rate * 100).toFixed(2).replace('.', ',')}%`;
    return '—';
  };
  const renderVisitors = () => {
    if (siteVisits?.visitors) return new Intl.NumberFormat('fr-FR').format(siteVisits.visitors);
    return '—';
  };

  // Libellé du chip personnalisé
  const customChipLabel = useMemo(() => {
    if (period === 'custom' && customRange) {
      return `${formatDisplayDate(customRange.start)} – ${formatDisplayDate(customRange.end)}`;
    }
    return 'Personnalisé';
  }, [period, customRange]);

  // Sélection de jour dans le calendrier
  const handleDayPress = (date: Date) => {
    if (!calStart || calPickingEnd === false) {
      // Premier clic = date début
      setCalStart(date);
      setCalEnd(null);
      setCalPickingEnd(true);
    } else {
      // Second clic = date fin (doit être >= début)
      if (date < calStart!) {
        setCalStart(date);
        setCalEnd(null);
      } else {
        setCalEnd(date);
        setCalPickingEnd(false);
      }
    }
  };

  const openCalendar = () => {
    // Pré-remplir avec la plage courante si elle existe
    if (customRange) {
      setCalStart(new Date(customRange.start));
      setCalEnd(new Date(customRange.end));
    } else {
      setCalStart(null);
      setCalEnd(null);
    }
    setCalPickingEnd(false);
    setShowCalendar(true);
  };

  const confirmCustomRange = () => {
    if (!calStart || !calEnd) return;
    const range = { start: toISO(calStart), end: toISO(calEnd) };
    setCustomRange(range);
    setPeriod('custom');
    setShowCalendar(false);
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
            <Text style={styles.greeting}>Bonjour, {user?.name ?? 'Rodrigue Nikiema'}</Text>
            <Text style={styles.subGreeting}>Voici votre résumé du jour</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme} activeOpacity={0.7}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarCircle}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CustomersTab' as any)}
            >
              <Text style={styles.avatarText}>AM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Update banner */}
        {updateInfo && <UpdateBanner info={updateInfo} onDismiss={dismiss} />}

        {/* Filtres de période horizontaux */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {/* Jour */}
          <TouchableOpacity
            style={[styles.chip, period === 'today' ? styles.chipActive : styles.chipInactive]}
            onPress={() => setPeriod('today')}
            activeOpacity={0.8}
          >
            <Text style={period === 'today' ? styles.chipTextActive : styles.chipTextInactive}>Jour</Text>
          </TouchableOpacity>

          {/* Semaine */}
          <TouchableOpacity
            style={[styles.chip, period === 'week' ? styles.chipActive : styles.chipInactive]}
            onPress={() => setPeriod('week')}
            activeOpacity={0.8}
          >
            <Text style={period === 'week' ? styles.chipTextActive : styles.chipTextInactive}>Semaine</Text>
          </TouchableOpacity>

          {/* Mois */}
          <TouchableOpacity
            style={[styles.chip, period === 'month' ? styles.chipActive : styles.chipInactive]}
            onPress={() => setPeriod('month')}
            activeOpacity={0.8}
          >
            <Text style={period === 'month' ? styles.chipTextActive : styles.chipTextInactive}>Mois</Text>
          </TouchableOpacity>

          {/* Trimestre */}
          <TouchableOpacity
            style={[styles.chip, period === 'quarter' ? styles.chipActive : styles.chipInactive]}
            onPress={() => setPeriod('quarter')}
            activeOpacity={0.8}
          >
            <Text style={period === 'quarter' ? styles.chipTextActive : styles.chipTextInactive}>Trimestre</Text>
          </TouchableOpacity>

          {/* Année */}
          <TouchableOpacity
            style={[styles.chip, period === 'year' ? styles.chipActive : styles.chipInactive]}
            onPress={() => setPeriod('year')}
            activeOpacity={0.8}
          >
            <Text style={period === 'year' ? styles.chipTextActive : styles.chipTextInactive}>Année</Text>
          </TouchableOpacity>

          {/* Personnalisé avec icône calendrier */}
          <TouchableOpacity
            style={[styles.chip, period === 'custom' ? styles.chipActive : styles.chipInactive]}
            onPress={openCalendar}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={period === 'custom' ? '#FFF' : colors.textSecondary}
            />
            <Text style={period === 'custom' ? styles.chipTextActive : styles.chipTextInactive} numberOfLines={1}>
              {customChipLabel}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Grille de 4 KPIs */}
        <View style={styles.kpiRow}>
          {/* CA */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconBox}>
                <Ionicons name="cash-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.trendContainer}>
                <Text style={getTrend('revenue').isUp ? styles.trendTextGreen : styles.trendTextRed}>
                  {getTrend('revenue').text}
                </Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>Chiffre d'affaires</Text>
            {stats ? (
              <CurrencyText amount={stats.revenue[period]} size="lg" bold color={colors.primary} />
            ) : (
              <Text style={styles.kpiValue}>—</Text>
            )}
          </View>

          {/* Commandes */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconBox}>
                <Ionicons name="cube-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.trendContainer}>
                <Text style={getTrend('orders').isUp ? styles.trendTextGreen : styles.trendTextRed}>
                  {getTrend('orders').text}
                </Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>Commandes</Text>
            <Text style={styles.kpiValue}>{stats?.period_order_count ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {/* Visiteurs */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconBox}>
                <Ionicons name="eye-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.trendContainer}>
                <Text style={getTrend('visitors').isUp ? styles.trendTextGreen : styles.trendTextRed}>
                  {getTrend('visitors').text}
                </Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>Visiteurs</Text>
            <Text style={styles.kpiValue}>{renderVisitors()}</Text>
          </View>

          {/* Taux de conversion */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconBox}>
                <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.trendContainer}>
                <Text style={getTrend('conversion').isUp ? styles.trendTextGreen : styles.trendTextRed}>
                  {getTrend('conversion').text}
                </Text>
              </View>
            </View>
            <Text style={styles.kpiLabel}>Taux de conversion</Text>
            <Text style={styles.kpiValue}>{renderConversionRate()}</Text>
          </View>
        </View>

        {/* Section Top Produits */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Produits</Text>
            <TouchableOpacity onPress={() => navigation.navigate('OrdersTab' as any)}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {topProducts.length > 0 ? (
            topProducts.slice(0, 5).map((prod, idx) => {
              const salesVal = prod.total_sales !== undefined && prod.total_sales !== null && prod.total_sales !== ''
                ? `Vendu ${prod.total_sales}x`
                : 'Produit Populaire';
              return (
                <View key={prod.id || idx} style={styles.topProductCard}>
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.topInfo}>
                    <Text style={styles.topName} numberOfLines={1}>{prod.name}</Text>
                    <Text style={styles.topSales}>{salesVal}</Text>
                  </View>
                  <CurrencyText amount={prod.price} currency={prod.currency || 'XOF'} size="md" bold color={colors.textPrimary} />
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>Aucun produit populaire disponible</Text>
          )}
        </View>

        {/* Section Commandes récentes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Commandes récentes</Text>
            <TouchableOpacity onPress={() => navigation.navigate('OrdersTab' as any)}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.recentOrderCard}
              onPress={() => navigation.navigate('OrdersTab' as any, { screen: 'OrderDetail', params: { orderId: order.id } } as any)}
            >
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>
                  {getInitials(order.billing.first_name, order.billing.last_name)}
                </Text>
              </View>

              <View style={styles.orderInfo}>
                <Text style={styles.clientName}>
                  {order.billing.first_name} {order.billing.last_name}
                </Text>
                <View style={styles.statusBadgeWrap}>
                  <StatusBadge status={order.status} size="sm" />
                </View>
              </View>

              <View style={styles.orderRight}>
                <CurrencyText amount={order.total} currency={order.currency} size="md" bold color={colors.textPrimary} />
              </View>
            </TouchableOpacity>
          ))}

          {recentOrders.length === 0 && (
            <Text style={styles.empty}>Aucune commande récente</Text>
          )}
        </View>
      </ScrollView>

      {/* ──────────── Modal Calendrier Personnalisé ──────────── */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
          <Pressable style={styles.calendarSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.calHandle} />
            <Text style={styles.calTitle}>Période personnalisée</Text>
            <Text style={styles.calHint}>
              {!calStart
                ? 'Sélectionnez la date de début'
                : !calEnd
                  ? 'Sélectionnez la date de fin'
                  : 'Période sélectionnée ✓'}
            </Text>

            {/* Affichage des dates sélectionnées */}
            <View style={styles.calRangeRow}>
              <View style={[styles.calRangeBox, calStart ? { borderColor: colors.primary } : {}]}>
                <Text style={styles.calRangeLabel}>Début</Text>
                <Text style={styles.calRangeValue}>
                  {calStart ? formatDisplayDate(toISO(calStart)) : '—'}
                </Text>
              </View>
              <View style={[styles.calRangeBox, calEnd ? { borderColor: colors.primary } : {}]}>
                <Text style={styles.calRangeLabel}>Fin</Text>
                <Text style={styles.calRangeValue}>
                  {calEnd ? formatDisplayDate(toISO(calEnd)) : '—'}
                </Text>
              </View>
            </View>

            {/* Calendrier */}
            <CalendarMonth
              colors={colors}
              selectedStart={calStart}
              selectedEnd={calEnd}
              onDayPress={handleDayPress}
            />

            {/* Bouton confirmer */}
            <TouchableOpacity
              style={[styles.calConfirmBtn, (!calStart || !calEnd) && styles.calConfirmDisabled]}
              onPress={confirmCustomRange}
              disabled={!calStart || !calEnd}
              activeOpacity={0.8}
            >
              <Text style={styles.calConfirmText}>
                {calStart && calEnd ? 'Appliquer la période' : 'Choisissez une plage'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
