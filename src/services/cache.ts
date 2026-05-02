import type { WCCustomer, WCOrder } from '@app-types/woocommerce';

interface Entry<T> {
  data: T;
  exp: number;
}

const store = new Map<string, Entry<unknown>>();

export const Cache = {
  set<T>(key: string, data: T, ttlMs: number): void {
    store.set(key, { data, exp: Date.now() + ttlMs });
  },

  get<T>(key: string): T | null {
    const e = store.get(key) as Entry<T> | undefined;
    if (!e || Date.now() > e.exp) {
      store.delete(key);
      return null;
    }
    return e.data;
  },

  invalidate(key: string): void {
    store.delete(key);
  },

  has(key: string): boolean {
    const e = store.get(key);
    return !!e && Date.now() <= e.exp;
  },
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
