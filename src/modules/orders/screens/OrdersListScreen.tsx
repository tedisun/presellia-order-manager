import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ScrollView, LayoutAnimation,
  Platform, UIManager, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRANDING } from '@config/branding';
import { fetchOrders } from '@services/woocommerce';

const ORDERS_CACHE_KEY = '@presellia_orders_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — cache considéré frais

interface OrdersCache {
  orders:    WCOrder[];
  updatedAt: number;
}
import OrderRow from '../components/OrderRow';
import SearchBar from '@components/SearchBar';
import EmptyState from '@components/EmptyState';
import LoadingSpinner from '@components/LoadingSpinner';
import type { WCOrder, OrderStatus } from '@app-types/woocommerce';
import type { OrdersStackParamList } from '@navigation/types';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavProp = NativeStackNavigationProp<OrdersStackParamList, 'OrdersList'>;

interface StatusTab {
  value: OrderStatus | 'any';
  label: string;
  colorKey?: keyof BrandColors['status'];
}

const STATUS_TABS: StatusTab[] = [
  { value: 'any',        label: 'Tous' },
  { value: 'pending',    label: 'Attente',  colorKey: 'pending' },
  { value: 'processing', label: 'En cours', colorKey: 'processing' },
  { value: 'completed',  label: 'Terminé',  colorKey: 'completed' },
  { value: 'cancelled',  label: 'Annulé',   colorKey: 'cancelled' },
  { value: 'on-hold',    label: 'En pause', colorKey: 'on-hold' },
];

interface OrderGroup {
  title: string;
  data: WCOrder[];
}

function groupOrdersByDate(orders: WCOrder[]): OrderGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const map = new Map<string, WCOrder[]>();
  orders.forEach((order) => {
    const d = new Date(order.date_created);
    d.setHours(0, 0, 0, 0);
    let key: string;
    if (d.getTime() === today.getTime()) key = "Aujourd'hui";
    else if (d.getTime() === yesterday.getTime()) key = 'Hier';
    else {
      key = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      key = key.charAt(0).toUpperCase() + key.slice(1);
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  });
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  // Header
  header: {
    paddingHorizontal: BRANDING.spacing.lg,
    paddingTop: BRANDING.spacing.md,
    paddingBottom: BRANDING.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: BRANDING.fonts.sizeLG,
    fontWeight: BRANDING.fonts.weightBold,
    color: c.textPrimary,
  },
  headerMeta: {
    fontSize: BRANDING.fonts.sizeXS,
    color: c.textMuted,
  },

  // Filter button
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: 6,
    borderRadius: BRANDING.radius.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  filterBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterBtnText: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textSecondary,
  },
  filterBtnTextActive: {
    color: '#FFF',
    fontWeight: BRANDING.fonts.weightSemiBold,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.warning,
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Filters panel
  filtersPanel: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  tabsContent: {
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: BRANDING.spacing.sm,
    gap: BRANDING.spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: 6,
    borderRadius: BRANDING.radius.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  tabActive: {},
  tabLabel: {
    fontSize: BRANDING.fonts.sizeSM,
    color: c.textSecondary,
  },
  tabBadge: {
    borderRadius: BRANDING.radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontWeight: BRANDING.fonts.weightBold },

  // Search
  searchWrap: {
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: BRANDING.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },

  // List
  dateHeader: {
    paddingHorizontal: BRANDING.spacing.lg,
    paddingTop: BRANDING.spacing.md,
    paddingBottom: BRANDING.spacing.xs,
  },
  dateHeaderText: {
    fontSize: BRANDING.fonts.sizeXS,
    fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyContainer: { flex: 1 },
  listContent: { paddingTop: BRANDING.spacing.xs, paddingBottom: 80 },

  // FAB
  fab: {
    position: 'absolute',
    right: BRANDING.spacing.xl,
    bottom: BRANDING.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});

export default function OrdersListScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [allOrders, setAllOrders] = useState<WCOrder[]>([]);
  const [loading, setLoading]     = useState(true);   // true seulement si pas de cache
  const [syncing, setSyncing]     = useState(false);  // refresh silencieux en arrière-plan
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'any'>('any');
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lit le cache AsyncStorage et affiche les données immédiatement sans spinner
  const loadFromCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(ORDERS_CACHE_KEY);
      if (!raw) return false;
      const cached: OrdersCache = JSON.parse(raw);
      if (cached.orders?.length > 0) {
        setAllOrders(cached.orders);
        setLastUpdate(new Date(cached.updatedAt));
        setLoading(false);
        return true;
      }
    } catch {/* ignore */}
    return false;
  }, []);

  const saveCache = useCallback(async (orders: WCOrder[]) => {
    try {
      const payload: OrdersCache = { orders, updatedAt: Date.now() };
      await AsyncStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(payload));
    } catch {/* ignore */}
  }, []);

  // Appel réseau : silencieux si cache présent (syncing), bloquant si aucun cache
  const fetchFromApi = useCallback(async (q = '') => {
    try {
      const data = await fetchOrders({ search: q || undefined });
      setAllOrders(data);
      setLastUpdate(new Date());
      saveCache(data);
    } catch {
      // garder les données précédentes
    } finally {
      setLoading(false);
      setSyncing(false);
      setRefreshing(false);
    }
  }, [saveCache]);

  // Mount : cache d'abord, puis refresh silencieux
  useEffect(() => {
    (async () => {
      const hadCache = await loadFromCache();
      if (hadCache) {
        setSyncing(true);
      }
      await fetchFromApi('');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recherche avec debounce — toujours depuis l'API (la recherche texte n'est pas cachée)
  useEffect(() => {
    if (search === '') return; // le load initial couvre déjà search=''
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchFromApi(search), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search, fetchFromApi]);

  const onRefresh = () => { setRefreshing(true); fetchFromApi(search); };

  const toggleFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltersOpen(v => !v);
  };

  const orders = activeStatus === 'any'
    ? allOrders
    : allOrders.filter((o) => o.status === activeStatus);

  const countByStatus = (status: OrderStatus | 'any'): number =>
    status === 'any' ? allOrders.length : allOrders.filter((o) => o.status === status).length;

  const activeFiltersCount = activeStatus !== 'any' ? 1 : 0;

  const groups = groupOrdersByDate(orders);
  const flatData: (OrderGroup | WCOrder)[] = [];
  groups.forEach((group) => { flatData.push(group); flatData.push(...group.data); });

  if (loading && allOrders.length === 0) return <LoadingSpinner fullScreen message="Chargement des commandes…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Toutes les commandes</Text>
          <TouchableOpacity style={[styles.filterBtn, filtersOpen && styles.filterBtnActive]} onPress={toggleFilters} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={16} color={filtersOpen ? '#FFF' : colors.textSecondary} />
            <Text style={[styles.filterBtnText, filtersOpen && styles.filterBtnTextActive]}>Filtres</Text>
            {activeFiltersCount > 0 && (
              <View style={styles.filterDot} />
            )}
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headerMeta}>
            {allOrders.length} commande{allOrders.length !== 1 ? 's' : ''}
            {lastUpdate ? ` · Mis à jour à ${formatTime(lastUpdate)}` : ''}
          </Text>
          {syncing && <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.65 }] }} />}
        </View>
      </View>

      {/* ── Filtres dépliables ── */}
      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {STATUS_TABS.map((tab) => {
              const count = countByStatus(tab.value);
              const isActive = activeStatus === tab.value;
              const accentColor = tab.colorKey ? colors.status[tab.colorKey] : colors.primary;
              if (count === 0 && tab.value !== 'any') return null;
              return (
                <TouchableOpacity
                  key={tab.value}
                  style={[styles.tab, isActive && [styles.tabActive, { borderColor: accentColor, backgroundColor: accentColor + '1A' }]]}
                  onPress={() => setActiveStatus(tab.value)}
                >
                  <Text style={[styles.tabLabel, isActive && { color: accentColor, fontWeight: BRANDING.fonts.weightSemiBold }]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, { backgroundColor: isActive ? accentColor : colors.border }]}>
                      <Text style={[styles.tabBadgeText, { color: isActive ? '#FFF' : colors.textMuted }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Barre de recherche ── */}
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Rechercher une commande…" />
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={flatData}
        keyExtractor={(item, idx) =>
          'title' in item ? `group-${item.title}` : `order-${(item as WCOrder).id}`
        }
        renderItem={({ item }) => {
          if ('title' in item) {
            return (
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{(item as OrderGroup).title}</Text>
              </View>
            );
          }
          const order = item as WCOrder;
          return (
            <OrderRow
              order={order}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="📭"
            title="Aucune commande trouvée"
            subtitle={search ? `Aucun résultat pour "${search}"` : 'Toutes les commandes apparaîtront ici'}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateOrder', {})}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
