import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WCCustomer, WCOrder } from '@app-types/woocommerce';

interface Entry<T> {
  data: T;
  exp: number;
}

const store = new Map<string, Entry<unknown>>();

// Liste des clés de cache que l'on souhaite rendre persistantes sur disque
const PERSISTENT_KEYS = new Set<string>([
  'products_all',
  'products_partner',
  'customers_recent',
  'dashboard_stats_today',
  'dashboard_stats_week',
  'dashboard_stats_month',
  'dashboard_stats_quarter',
  'dashboard_stats_year'
]);

export const Cache = {
  /**
   * Initialise le cache persistant en chargeant les données depuis le disque (AsyncStorage) vers la mémoire.
   * Doit être appelé une fois au démarrage de l'application.
   */
  async initialize(): Promise<void> {
    try {
      const keys = Array.from(PERSISTENT_KEYS);
      const pairs = await AsyncStorage.multiGet(keys);
      
      const now = Date.now();
      for (const [key, val] of pairs) {
        if (val) {
          try {
            const entry = JSON.parse(val) as Entry<unknown>;
            // Ne charger en mémoire que si l'entrée n'a pas expiré
            if (entry.exp > now) {
              store.set(key, entry);
            } else {
              await AsyncStorage.removeItem(key);
            }
          } catch {
            await AsyncStorage.removeItem(key);
          }
        }
      }
      console.log('[Cache] Cache persistant chargé avec succès en mémoire.');
    } catch (err) {
      console.warn('[Cache] Échec de l\'initialisation du cache persistant:', err);
    }
  },

  set<T>(key: string, data: T, ttlMs: number): void {
    const exp = Date.now() + ttlMs;
    const entry: Entry<T> = { data, exp };
    
    // Mettre à jour en mémoire de manière synchrone
    store.set(key, entry);
    
    // Si la clé est persistante, sauvegarder sur disque de manière asynchrone en arrière-plan
    if (PERSISTENT_KEYS.has(key)) {
      AsyncStorage.setItem(key, JSON.stringify(entry)).catch((err) => {
        console.warn(`[Cache] Échec de persistance pour la clé "${key}":`, err);
      });
    }
  },

  get<T>(key: string): T | null {
    const e = store.get(key) as Entry<T> | undefined;
    if (!e || Date.now() > e.exp) {
      store.delete(key);
      if (PERSISTENT_KEYS.has(key)) {
        AsyncStorage.removeItem(key).catch(() => {});
      }
      return null;
    }
    return e.data;
  },

  invalidate(key: string): void {
    store.delete(key);
    if (PERSISTENT_KEYS.has(key)) {
      AsyncStorage.removeItem(key).catch(() => {});
    }
  },

  has(key: string): boolean {
    const e = store.get(key);
    return !!e && Date.now() <= e.exp;
  },

  async clearAll(): Promise<void> {
    store.clear();
    const keys = Array.from(PERSISTENT_KEYS);
    await AsyncStorage.multiRemove(keys).catch(() => {});
  }
};

export const CACHE_KEYS = {
  ALL_PRODUCTS:     'products_all',
  PARTNER_PRODUCTS: 'products_partner',
  RECENT_CUSTOMERS: 'customers_recent',
} as const;

// Reconstruit des WCCustomer partiels depuis les données de facturation des commandes.
// Limité aux 15 premiers clients uniques (par date décroissante).
export function buildRecentCustomersFromOrders(orders: WCOrder[]): WCCustomer[] {
  const seen = new Set<number>();
  const customers: WCCustomer[] = [];

  for (const o of orders) {
    if (o.customer_id <= 0 || seen.has(o.customer_id)) continue;
    seen.add(o.customer_id);
    customers.push({
      id:           o.customer_id,
      first_name:   o.billing.first_name,
      last_name:    o.billing.last_name,
      email:        o.billing.email,
      username:     '',
      billing:      o.billing,
      shipping:     o.shipping,
      meta_data:    [],
      orders_count: 0,
      total_spent:  '0',
      role:         'customer',
      avatar_url:   '',
      date_created: '',
    });
    if (customers.length >= 15) break;
  }

  return customers;
}
