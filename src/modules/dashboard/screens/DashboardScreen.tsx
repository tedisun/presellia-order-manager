import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Modal, Pressable, AppState, type AppStateStatus,
  Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Cache, CACHE_KEYS } from '@services/cache';
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

function getChartData(period: DashboardPeriod, totalRevenue: number) {
  let labels: string[] = [];
  let data: number[] = [];

  switch (period) {
    case 'today':
      labels = ['08h', '10h', '12h', '14h', '16h', '18h'];
      data = [
        totalRevenue * 0.1,
        totalRevenue * 0.15,
        totalRevenue * 0.25,
        totalRevenue * 0.2,
        totalRevenue * 0.2,
        totalRevenue * 0.1,
      ];
      break;
    case 'week':
      labels = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
      data = [
        totalRevenue * 0.12,
        totalRevenue * 0.18,
        totalRevenue * 0.15,
        totalRevenue * 0.22,
        totalRevenue * 0.18,
        totalRevenue * 0.1,
        totalRevenue * 0.05,
      ];
      break;
    case 'month':
      labels = ['S1', 'S2', 'S3', 'S4'];
      data = [
        totalRevenue * 0.22,
        totalRevenue * 0.28,
        totalRevenue * 0.25,
        totalRevenue * 0.25,
      ];
      break;
    case 'quarter':
      labels = ['M1', 'M2', 'M3'];
      data = [
        totalRevenue * 0.3,
        totalRevenue * 0.38,
        totalRevenue * 0.32,
      ];
      break;
    case 'year':
      labels = ['T1', 'T2', 'T3', 'T4'];
      data = [
        totalRevenue * 0.22,
        totalRevenue * 0.26,
        totalRevenue * 0.28,
        totalRevenue * 0.24,
      ];
      break;
    default:
      labels = ['Début', 'Milieu', 'Fin'];
      data = [
        totalRevenue * 0.3,
        totalRevenue * 0.4,
        totalRevenue * 0.3,
      ];
  }

  if (totalRevenue === 0) {
    data = data.map(() => 0);
  } else {
    data = data.map(v => Math.round(v));
  }

  return {
    labels,
    datasets: [{ data }]
  };
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
  chartCard:      { backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 4 },
  chartTitle:     { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },

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
  const insets = useSafeAreaInsets();

  const [period, setPeriod]           = useState<DashboardPeriod>('today');
  const [loadedPeriod, setLoadedPeriod] = useState<DashboardPeriod>('today');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [siteVisits, setSiteVisits]   = useState<{ visitors: number; pageviews: number } | null>(null);
  const [recentOrders, setRecentOrders] = useState<WCOrder[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [isSyncing, setIsSyncing]     = useState(false);

  // Calendrier
  const [showCalendar, setShowCalendar]     = useState(false);
  const [calStart, setCalStart]             = useState<Date | null>(null);
  const [calEnd, setCalEnd]                 = useState<Date | null>(null);
  const [calPickingEnd, setCalPickingEnd]   = useState(false);

  const lastUpdateRef = useRef<Date | null>(null);

  // Charger le cache initial au montage
  useEffect(() => {
    try {
      const cachedStats = Cache.get<DashboardStats>(CACHE_KEYS.DASHBOARD_STATS + period);
      const cachedOrders = Cache.get<WCOrder[]>(CACHE_KEYS.DASHBOARD_RECENT);
      const cachedProducts = Cache.get<any[]>(CACHE_KEYS.DASHBOARD_TOP);
      const cachedVisits = Cache.get<any>(CACHE_KEYS.DASHBOARD_VISITS + period);

      let hasCache = false;
      if (cachedStats) {
        setStats(cachedStats);
        setLoadedPeriod(period);
        hasCache = true;
      }
      if (cachedOrders) setRecentOrders(cachedOrders);
      if (cachedProducts) setTopProducts(cachedProducts);
      if (cachedVisits) setSiteVisits(cachedVisits);

      if (hasCache) {
        setLoading(false);
        lastUpdateRef.current = new Date();
      }
    } catch (err) {
      console.warn('[DashboardScreen] Échec lecture cache initial:', err);
    }
  }, []);

  const load = useCallback(async (isPeriodChange = false) => {
    if (isPeriodChange) {
      setIsSyncing(true);
      // Charger immédiatement le cache pour la nouvelle période s'il existe
      try {
        const cachedStats = Cache.get<DashboardStats>(CACHE_KEYS.DASHBOARD_STATS + period);
        const cachedVisits = Cache.get<any>(CACHE_KEYS.DASHBOARD_VISITS + period);
        if (cachedStats) {
          setStats(cachedStats);
          setLoadedPeriod(period);
        } else {
          setStats(null);
        }
        if (cachedVisits) {
          setSiteVisits(cachedVisits);
        } else {
          setSiteVisits(null);
        }
      } catch {}
    } else {
      setIsSyncing(true);
    }

    try {
      // Synchronisation de la file d'attente hors-ligne au chargement/rafraîchissement
      try {
        const { OfflineQueue } = await import('@services/offlineQueue');
        await OfflineQueue.syncQueue();
      } catch (err) {
        console.warn('[OfflineQueue] Synchro Dashboard échouée:', err);
      }

      const cr = (period === 'custom' && customRange) ? customRange : undefined;
      const [s, orders, top, visits] = await Promise.all([
        fetchDashboardStats(period, cr).catch(() => null),
        fetchOrders({ per_page: 5 }),
        fetchTopProducts(5).catch(() => []),
        fetchSiteVisits(period, cr).catch(() => null),
      ]);

      if (s) {
        setStats(s);
        setLoadedPeriod(period);
        const STATS_CACHE_TTL = 1 * 60 * 60 * 1000; // 1h
        Cache.set(CACHE_KEYS.DASHBOARD_STATS + period, s, STATS_CACHE_TTL);
      }
      if (orders) {
        const sliced = orders.slice(0, 5);
        setRecentOrders(sliced);
        const ORDERS_CACHE_TTL = 1 * 60 * 60 * 1000; // 1h
        Cache.set(CACHE_KEYS.DASHBOARD_RECENT, sliced, ORDERS_CACHE_TTL);
      }
      if (top) {
        setTopProducts(top);
        const TOP_CACHE_TTL = 2 * 60 * 60 * 1000; // 2h
        Cache.set(CACHE_KEYS.DASHBOARD_TOP, top, TOP_CACHE_TTL);
      }
      if (visits) {
        setSiteVisits(visits);
        const VISITS_CACHE_TTL = 1 * 60 * 60 * 1000; // 1h
        Cache.set(CACHE_KEYS.DASHBOARD_VISITS + period, visits, VISITS_CACHE_TTL);
      }

      const now = new Date();
      lastUpdateRef.current = now;
    } catch (err) {
      console.warn('[Dashboard] Échec chargement:', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
      setRefreshing(false);
    }
  }, [period, customRange]);

  // Déclenché uniquement lors d'un changement de filtre (sans écran de chargement complet)
  useEffect(() => {
    const hasInitialData = !!stats;
    if (hasInitialData) {
      load(true);
    } else {
      setLoading(true);
      load(false);
    }
  }, [period, customRange]);

  // Sync au focus avec staleness check de 2 minutes
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      const needsSync = !lastUpdateRef.current || (now.getTime() - lastUpdateRef.current.getTime() > 2 * 60 * 1000);
      if (needsSync && stats) {
        load(false);
      }
    }, [load, stats])
  );

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current !== 'active' && next === 'active') load(false);
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(false); };

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
    if (siteVisits?.visitors && stats?.period_order_count) {
      const rate = stats.period_order_count / siteVisits.visitors;
      return `${(rate * 100).toFixed(2).replace('.', ',')}%`;
    }
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

  const hasCurrentData = stats && loadedPeriod === period;

  if (loading) {
    return <LoadingSpinner fullScreen message="Chargement du tableau de bord…" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={isSyncing ? { opacity: 0.6 } : undefined}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Bonjour, {user?.name ?? 'Rodrigue Nikiema'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.subGreeting}>Voici votre résumé du jour</Text>
              {isSyncing && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
              )}
            </View>
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
            {hasCurrentData ? (
              <CurrencyText amount={stats!.revenue[period]} size="lg" bold color={colors.primary} />
            ) : (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
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
            {hasCurrentData ? (
              <Text style={styles.kpiValue}>{stats?.period_order_count ?? '—'}</Text>
            ) : (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
            )}
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
            {hasCurrentData ? (
              <Text style={styles.kpiValue}>{renderVisitors()}</Text>
            ) : (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
            )}
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
            {hasCurrentData ? (
              <Text style={styles.kpiValue}>{renderConversionRate()}</Text>
            ) : (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
            )}
          </View>
        </View>

        {/* ─── Analytiques Visuels Premium ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Analytiques Visuels</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Premium</Text>
            </View>
          </View>

          {/* Graphique de Ventes */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Courbe de Ventes (CA en XOF)</Text>
            {hasCurrentData ? (
              <LineChart
                data={getChartData(period, stats!.revenue[period] || 0)}
                width={Dimensions.get('window').width - 60}
                height={180}
                bezier
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                  labelColor: (opacity = 1) => colors.textSecondary,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: colors.primary
                  }
                }}
                style={{
                  marginVertical: 4,
                  borderRadius: 12
                }}
              />
            ) : (
              <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>

          {/* Graphique des volumes de licences par produit */}
          {topProducts.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Volume de licences vendues (Top Produits)</Text>
              <BarChart
                data={{
                  labels: topProducts.slice(0, 4).map(p => {
                    const cleanName = p.name || 'Produit';
                    return cleanName.split(' ')[0].slice(0, 8);
                  }),
                  datasets: [
                    {
                      data: topProducts.slice(0, 4).map(p => {
                        const sales = parseInt(p.total_sales, 10);
                        return isNaN(sales) ? 1 : sales;
                      })
                    }
                  ]
                }}
                width={Dimensions.get('window').width - 60}
                height={180}
                yAxisLabel=""
                yAxisSuffix="x"
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                  labelColor: (opacity = 1) => colors.textSecondary,
                  style: {
                    borderRadius: 16
                  }
                }}
                style={{
                  marginVertical: 4,
                  borderRadius: 12
                }}
              />
            </View>
          )}
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
          <Pressable style={[styles.calendarSheet, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20) }]} onPress={e => e.stopPropagation()}>
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
