import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BRANDING } from '@config/branding';
import { fetchCustomers, fetchGuestCustomers, fetchCustomerOrderCount } from '@services/woocommerce';
import SearchBar from '@components/SearchBar';
import EmptyState from '@components/EmptyState';
import type { WCCustomer } from '@app-types/woocommerce';
import type { CustomersStackParamList } from '@navigation/types';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';

type NavProp = NativeStackNavigationProp<CustomersStackParamList, 'CustomerSearch'>;

// Clé stable pour les invités (même logique que CreateOrderScreen)
function customerKey(c: WCCustomer): string {
  return c.id !== 0 ? `reg-${c.id}` : `guest-${c.email || c.billing.phone || `${c.first_name}${c.last_name}`}`;
}

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  searchBar: {
    padding: BRANDING.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  guestLoadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BRANDING.spacing.sm,
    paddingHorizontal: BRANDING.spacing.lg,
    paddingVertical: BRANDING.spacing.xs,
    backgroundColor: c.primary + '12',
    borderBottomWidth: 1,
    borderBottomColor: c.primary + '30',
  },
  guestLoadingText: {
    fontSize: BRANDING.fonts.sizeXS,
    color: c.primary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 20 },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BRANDING.spacing.lg,
    paddingVertical: BRANDING.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: BRANDING.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: BRANDING.fonts.sizeMD,
    fontWeight: BRANDING.fonts.weightBold,
    color: c.primary,
    textTransform: 'uppercase',
  },
  customerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.xs, flexWrap: 'wrap' },
  name: {
    fontSize: BRANDING.fonts.sizeMD,
    fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.textPrimary,
  },
  guestBadge: {
    backgroundColor: c.textMuted + '33',
    borderRadius: BRANDING.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  guestText: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
  partnerBadge: {
    backgroundColor: c.success + '33',
    borderRadius: BRANDING.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  partnerText: { fontSize: BRANDING.fonts.sizeXS, color: c.success },
  email: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 1 },
  phone: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 1 },
  meta: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, marginTop: 1 },
  ordersMeta: { alignItems: 'center', flexShrink: 0 },
  ordersCount: {
    fontSize: BRANDING.fonts.sizeLG,
    fontWeight: BRANDING.fonts.weightBold,
    color: c.textPrimary,
  },
  ordersLabel: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
  emptyContainer: { flex: 1 },
});

export default function CustomerSearchScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<WCCustomer[]>(() => {
    // Initialise avec les clients récents depuis le cache si disponible
    try {
      const { Cache, CACHE_KEYS } = require('@services/cache') as typeof import('@services/cache');
      return Cache.get<WCCustomer[]>(CACHE_KEYS.RECENT_CUSTOMERS) ?? [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [searched, setSearched] = useState(false);
  // Compteurs réels de commandes — peuplés en arrière-plan car orders_count WC est souvent 0
  const [orderCounts, setOrderCounts] = useState<Record<number, number>>({});
  const fetchCountsAbortRef = useRef<boolean>(false);

  const search = useCallback(async (q: string) => {
    fetchCountsAbortRef.current = true; // annuler les fetches précédents
    if (q.length < 2) {
      // Revenir aux clients récents quand la recherche est effacée
      const { Cache, CACHE_KEYS } = await import('@services/cache');
      setCustomers(Cache.get<WCCustomer[]>(CACHE_KEYS.RECENT_CUSTOMERS) ?? []);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      // Étape 1 : clients enregistrés — s'affichent immédiatement
      const registered = await fetchCustomers(q);
      setCustomers(registered);
      setLoading(false);

      // Étape 1b : chargement des vrais compteurs de commandes en arrière-plan
      fetchCountsAbortRef.current = false;
      const abortSnapshot = fetchCountsAbortRef.current;
      for (const customer of registered) {
        if (customer.id > 0) {
          fetchCustomerOrderCount(customer.id).then(count => {
            if (fetchCountsAbortRef.current !== abortSnapshot) return; // annulé
            setOrderCounts(prev => ({ ...prev, [customer.id]: count }));
          }).catch(() => {});
        }
      }

      // Étape 2 : invités — chargés en arrière-plan, ajoutés sans bloquer
      setLoadingGuests(true);
      const guests = await fetchGuestCustomers(q);
      setLoadingGuests(false);
      if (guests.length > 0) {
        const regEmails = new Set(registered.filter(c => c.email).map(c => c.email.toLowerCase()));
        const unique = guests.filter(g => !g.email || !regEmails.has(g.email.toLowerCase()));
        if (unique.length > 0) {
          setCustomers(prev => {
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
    const t = setTimeout(() => search(query), 400);
    return () => clearTimeout(t);
  }, [query, search]);

  const navigateToCustomer = (c: WCCustomer) => {
    navigation.navigate('CustomerDetail', {
      customerId: c.id,
      guestJson: c.id === 0 ? JSON.stringify(c) : undefined,
    });
  };

  const handleWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    if (cleaned.length === 8 && !cleaned.startsWith('226')) cleaned = '226' + cleaned;
    
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() =>
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp.')
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchBar}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Nom, email, téléphone…" />
      </View>

      {loadingGuests && !loading && (
        <View style={styles.guestLoadingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.guestLoadingText}>Recherche dans les commandes invités…</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={customerKey}
          ListHeaderComponent={!searched && customers.length > 0 ? (
            <Text style={{ color: colors.textMuted, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Clients récents
            </Text>
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.customerRow}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.md }}
                onPress={() => navigateToCustomer(item)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.first_name.charAt(0)}{item.last_name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.customerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                    {item.id === 0 && (
                      <View style={styles.guestBadge}>
                        <Text style={styles.guestText}>Invité</Text>
                      </View>
                    )}
                    {item.role === 'partner' && (
                      <View style={styles.partnerBadge}>
                        <Text style={styles.partnerText}>Partenaire</Text>
                      </View>
                    )}
                  </View>
                  {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
                  {item.billing.phone ? <Text style={styles.phone}>{item.billing.phone}</Text> : null}
                  {item.billing.company ? <Text style={styles.meta}>{item.billing.company}</Text> : null}
                  {item.billing.city ? (
                    <Text style={styles.meta}>
                      {item.billing.city}{item.billing.country ? ` · ${item.billing.country}` : ''}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {item.billing.phone ? (
                  <>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${item.billing.phone}`)}
                      style={{ padding: 6 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="call-outline" size={18} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleWhatsApp(item.billing.phone)}
                      style={{ padding: 6 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    </TouchableOpacity>
                  </>
                ) : null}
                {item.id !== 0 && (
                  <TouchableOpacity
                    style={[styles.ordersMeta, { paddingLeft: 6 }]}
                    onPress={() => navigateToCustomer(item)}
                  >
                    <Text style={styles.ordersCount}>
                      {orderCounts[item.id] !== undefined
                        ? orderCounts[item.id]
                        : (item.orders_count ?? '…')}
                    </Text>
                    <Text style={styles.ordersLabel}>cmd.</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            searched ? (
              <EmptyState
                icon="🔍"
                title="Aucun client trouvé"
                subtitle={`Aucun résultat pour "${query}"`}
              />
            ) : (
              <EmptyState
                icon="👥"
                title="Recherchez un client"
                subtitle="Tapez au moins 2 caractères pour chercher"
              />
            )
          }
          contentContainerStyle={customers.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
