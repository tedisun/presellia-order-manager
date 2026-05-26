// ─── WooCommerce REST API wrapper ─────────────────────────────────────────────
// Phase 1 (USE_MOCK = true)  : retourne les mock data avec délai simulé
// Phase 2 (USE_MOCK = false) : appels fetch réels vers WC REST API

import { USE_MOCK, WC_API_PATH, PPB_API_PATH, ORDERS_PER_PAGE, CUSTOMERS_PER_PAGE, PRODUCTS_PER_PAGE } from '@config/constants';
import { Storage } from './storage';
import type { WCOrder, WCCustomer, WCProduct, WCProductVariation, CreateOrderPayload, DashboardStats, OrderStatus, WCOrderStatus, WCOrderNote } from '@app-types/woocommerce';
import type { DashboardPeriod } from '@config/constants';

// ─── Erreurs ──────────────────────────────────────────────────────────────────
export class WCApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(`WooCommerce API erreur ${status}`);
    this.name = 'WCApiError';
  }
}
export class AuthError extends Error {
  constructor(message = 'Non authentifié') {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Auth : WP Application Password (username:app_password en Basic Auth)
// Plus besoin de consumer_key/secret — WP App Password suffit pour toute l'API WC.

async function wcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const creds = await Storage.getCredentials();
  if (!creds) throw new AuthError();

  const url = `${creds.store_url}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new WCApiError(response.status, data);
  }

  return response.json() as Promise<T>;
}

export function enrichProduct(p: any): WCProduct {
  if (!p) return p;
  const metaPartnerPrice = p.meta_data?.find((m: any) => m.key === '_ppb_partner_price')?.value;
  return {
    ...p,
    partner_price: metaPartnerPrice ? String(metaPartnerPrice) : undefined,
  };
}

export function enrichProductVariation(v: any): WCProductVariation {
  if (!v) return v;
  const metaPartnerPrice = v.meta_data?.find((m: any) => m.key === '_ppb_partner_price')?.value;
  return {
    ...v,
    partner_price: metaPartnerPrice ? String(metaPartnerPrice) : undefined,
  };
}

// ─── Commandes ────────────────────────────────────────────────────────────────
export interface FetchOrdersParams {
  status?: OrderStatus | 'any';
  page?: number;
  per_page?: number;
  search?: string;
  after?: string;
  before?: string;
  customer?: number;
}

export async function fetchOrders(params: FetchOrdersParams = {}): Promise<WCOrder[]> {
  if (USE_MOCK) {
    const { MOCK_ORDERS, simulateDelay } = await import('@modules/orders/mock/ordersMock');
    let orders = [...MOCK_ORDERS];
    if (params.status && params.status !== 'any') {
      orders = orders.filter((o) => o.status === params.status);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.number.includes(q) ||
          `${o.billing.first_name} ${o.billing.last_name}`.toLowerCase().includes(q)
      );
    }
    if (params.customer !== undefined) {
      orders = orders.filter((o) => o.customer_id === params.customer);
    }
    return simulateDelay(orders);
  }

  const query = new URLSearchParams({
    per_page: String(params.per_page ?? ORDERS_PER_PAGE),
    page: String(params.page ?? 1),
    ...(params.status && params.status !== 'any' ? { status: params.status } : {}),
    ...(params.search   ? { search:   params.search          } : {}),
    ...(params.after    ? { after:    params.after            } : {}),
    ...(params.before   ? { before:   params.before           } : {}),
    ...(params.customer !== undefined ? { customer: String(params.customer) } : {}),
  });
  return wcFetch<WCOrder[]>(`${WC_API_PATH}/orders?${query}`);
}

export async function fetchOrder(id: number): Promise<WCOrder> {
  if (USE_MOCK) {
    const { MOCK_ORDERS, simulateDelay } = await import('@modules/orders/mock/ordersMock');
    const order = MOCK_ORDERS.find((o) => o.id === id);
    if (!order) throw new WCApiError(404, { message: 'Commande introuvable' });
    return simulateDelay(order, 200);
  }
  return wcFetch<WCOrder>(`${WC_API_PATH}/orders/${id}`);
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<WCOrder> {
  if (USE_MOCK) {
    const { MOCK_ORDERS, simulateDelay } = await import('@modules/orders/mock/ordersMock');
    const idx = MOCK_ORDERS.findIndex((o) => o.id === id);
    if (idx === -1) throw new WCApiError(404, null);
    // Mutation en place pour que le changement persiste dans la session mock
    MOCK_ORDERS[idx] = { ...MOCK_ORDERS[idx], status, date_modified: new Date().toISOString() };
    return simulateDelay(MOCK_ORDERS[idx], 300);
  }
  return wcFetch<WCOrder>(`${WC_API_PATH}/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function addOrderNote(id: number, note: string): Promise<void> {
  if (USE_MOCK) {
    const { simulateDelay } = await import('@modules/orders/mock/ordersMock');
    return simulateDelay(undefined, 200);
  }
  await wcFetch(`${WC_API_PATH}/orders/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note, customer_note: false }),
  });
}

export async function fetchOrderNotes(orderId: number): Promise<WCOrderNote[]> {
  if (USE_MOCK) {
    const { simulateDelay } = await import('@modules/orders/mock/ordersMock');
    return simulateDelay<WCOrderNote[]>([
      { id: 1, author: 'système', date_created: new Date(Date.now() - 3600000).toISOString(), note: 'Commande créée manuellement.', customer_note: false },
      { id: 2, author: 'admin', date_created: new Date().toISOString(), note: 'Appel client passé. Le client confirme les détails.', customer_note: false },
    ], 200);
  }
  return wcFetch<WCOrderNote[]>(`${WC_API_PATH}/orders/${orderId}/notes`);
}

export async function createOrder(payload: CreateOrderPayload): Promise<WCOrder> {
  if (USE_MOCK) {
    const { MOCK_ORDERS, simulateDelay } = await import('@modules/orders/mock/ordersMock');
    const newOrder: WCOrder = {
      id: 99999,
      number: '99999',
      status: payload.status,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      total: payload.line_items.reduce((sum, li) => sum + parseFloat(li.total), 0).toFixed(2),
      currency: 'XOF',
      billing: { first_name: '', last_name: '', company: '', address_1: '', address_2: '', city: '', state: '', postcode: '', country: 'BF', email: '', phone: '', ...payload.billing },
      shipping: { first_name: '', last_name: '', address_1: '', city: '', country: 'BF' },
      line_items: [],
      fee_lines: [],
      coupon_lines: [],
      payment_method: payload.payment_method,
      payment_method_title: payload.payment_method_title,
      payment_url: `https://presellia.com/checkout/order-pay/99999/?pay_for_order=true&key=wc_order_mock`,
      customer_id: payload.customer_id,
      customer_note: '',
      meta_data: payload.meta_data,
    };
    return simulateDelay(newOrder, 500);
  }
  return wcFetch<WCOrder>(`${WC_API_PATH}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrder(id: number, payload: Partial<CreateOrderPayload>): Promise<WCOrder> {
  if (USE_MOCK) {
    const { MOCK_ORDERS, simulateDelay } = await import('@modules/orders/mock/ordersMock');
    const idx = MOCK_ORDERS.findIndex((o) => o.id === id);
    if (idx === -1) throw new WCApiError(404, { message: 'Commande introuvable' });
    
    const existing = MOCK_ORDERS[idx];
    const total = payload.line_items 
      ? payload.line_items.reduce((sum, li) => sum + parseFloat(li.total || '0'), 0).toFixed(2)
      : existing.total;

    MOCK_ORDERS[idx] = {
      ...existing,
      status: payload.status ?? existing.status,
      date_modified: new Date().toISOString(),
      total,
      billing: { ...existing.billing, ...payload.billing },
      payment_method: payload.payment_method ?? existing.payment_method,
      payment_method_title: payload.payment_method_title ?? existing.payment_method_title,
      currency: payload.currency ?? existing.currency,
      customer_id: payload.customer_id !== undefined ? payload.customer_id : existing.customer_id,
      line_items: payload.line_items ? payload.line_items.map((li: any, i) => ({
        id: 1000 + i,
        name: 'Produit #' + li.product_id,
        product_id: li.product_id,
        variation_id: li.variation_id || 0,
        quantity: li.quantity,
        tax_class: '',
        subtotal: li.subtotal || li.total,
        subtotal_tax: '0.00',
        total: li.total,
        total_tax: '0.00',
        taxes: [],
        meta_data: [],
        sku: '',
        price: parseFloat(li.total) / li.quantity,
      })) : existing.line_items,
      meta_data: payload.meta_data ? [...existing.meta_data.filter(m => !payload.meta_data?.some(pm => pm.key === m.key)), ...payload.meta_data] : existing.meta_data,
    };
    return simulateDelay(MOCK_ORDERS[idx], 500);
  }
  return wcFetch<WCOrder>(`${WC_API_PATH}/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchProductVariations(productId: number): Promise<WCProductVariation[]> {
  if (USE_MOCK) {
    const { simulateDelay } = await import('@modules/orders/mock/ordersMock');
    return simulateDelay<WCProductVariation[]>([
      {
        id: productId * 100 + 1, status: 'publish', sku: '',
        price: '25000', regular_price: '25000', sale_price: '',
        stock_status: 'instock', stock_quantity: null,
        attributes: [{ id: 1, name: 'Durée', option: '1 an' }],
      },
      {
        id: productId * 100 + 2, status: 'publish', sku: '',
        price: '15000', regular_price: '15000', sale_price: '',
        stock_status: 'instock', stock_quantity: null,
        attributes: [{ id: 1, name: 'Durée', option: '6 mois' }],
      },
      {
        id: productId * 100 + 3, status: 'publish', sku: '',
        price: '8000', regular_price: '8000', sale_price: '',
        stock_status: 'instock', stock_quantity: null,
        attributes: [{ id: 1, name: 'Durée', option: '1 mois' }],
      },
    ], 300);
  }
  const res = await wcFetch<WCProductVariation[]>(
    `${WC_API_PATH}/products/${productId}/variations?per_page=50&status=publish&orderby=menu_order&order=asc`
  );
  return res.map(enrichProductVariation);
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function fetchCustomers(search?: string): Promise<WCCustomer[]> {
  if (USE_MOCK) {
    const { MOCK_CUSTOMERS, simulateDelay: delay } = await import('@modules/customers/mock/customersMock');
    let customers = [...MOCK_CUSTOMERS];
    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.billing.phone.includes(q)
      );
    }
    return delay(customers);
  }

  if (!search || search.trim().length === 0) {
    const query = new URLSearchParams({ per_page: String(CUSTOMERS_PER_PAGE) });
    return wcFetch<WCCustomer[]>(`${WC_API_PATH}/customers?${query}`);
  }

  // ── Recherche multi-termes ──────────────────────────────────────────────────
  // WooCommerce cherche sur display_name, email, login — pas sur first_name/last_name
  // séparément. Pour "Abdoulaye Fofana", on cherche chaque mot en parallèle,
  // puis on fusionne et déduplique par ID.
  const terms = search.trim().split(/\s+/).filter(t => t.length >= 2);
  const searchTerms = terms.length > 1 ? terms : [search.trim()];

  const results = await Promise.allSettled(
    searchTerms.map(term => {
      const q = new URLSearchParams({ per_page: '50', search: term });
      return wcFetch<WCCustomer[]>(`${WC_API_PATH}/customers?${q}`);
    })
  );

  const seen = new Set<number>();
  const merged: WCCustomer[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const customer of result.value) {
        if (!seen.has(customer.id)) {
          seen.add(customer.id);
          merged.push(customer);
        }
      }
    }
  }
  return merged;
}

export async function fetchCustomer(id: number): Promise<WCCustomer> {
  if (USE_MOCK) {
    const { MOCK_CUSTOMERS, simulateDelay: delay } = await import('@modules/customers/mock/customersMock');
    const c = MOCK_CUSTOMERS.find((x) => x.id === id);
    if (!c) throw new WCApiError(404, null);
    return delay(c, 200);
  }
  return wcFetch<WCCustomer>(`${WC_API_PATH}/customers/${id}`);
}

// Retourne le nombre réel de commandes d'un client enregistré.
// L'API /customers retourne souvent orders_count = 0 à cause d'une table de cache
// WC non synchronisée. On utilise le header X-WP-Total de /orders?customer=ID.
export async function fetchCustomerOrderCount(customerId: number): Promise<number> {
  if (USE_MOCK || customerId === 0) return 0;
  try {
    const creds = await Storage.getCredentials();
    if (!creds) return 0;
    const url = `${creds.store_url}${WC_API_PATH}/orders?customer=${customerId}&per_page=1&_fields=id`;
    const res = await fetch(url, {
      headers: { 'Authorization': 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`) },
    });
    if (!res.ok) return 0;
    const total = res.headers.get('X-WP-Total');
    return total ? parseInt(total, 10) : 0;
  } catch {
    return 0;
  }
}

export async function syncCustomerPhone(id: number, phone: string): Promise<void> {
  // Corrige le bug WC : le téléphone n'est pas sauvegardé dans le profil client
  // lors de la création manuelle — on force la mise à jour ici.
  if (USE_MOCK) return;
  await wcFetch(`${WC_API_PATH}/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ billing: { phone } }),
  });
}

// ─── Produits ─────────────────────────────────────────────────────────────────
export async function fetchProducts(search?: string): Promise<WCProduct[]> {
  if (USE_MOCK) {
    const { MOCK_PRODUCTS } = await import('@modules/orders/mock/productsMock');
    const { simulateDelay: delay } = await import('@modules/orders/mock/ordersMock');
    let products = [...MOCK_PRODUCTS];
    if (search) {
      const q = search.toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return delay(products.sort((a, b) => a.name.localeCompare(b.name)));
  }
  const query = new URLSearchParams({
    per_page: String(PRODUCTS_PER_PAGE),
    status: 'publish',
    orderby: 'title',
    order: 'asc',
    ...(search ? { search } : {}),
  });
  const res = await wcFetch<WCProduct[]>(`${WC_API_PATH}/products?${query}`);
  return res.map(enrichProduct);
}

// Récupère l'intégralité du catalogue publié en paginant toutes les pages (100/page).
// Utilisé pour le cache produits au démarrage (TTL 12 h).
export async function fetchAllProducts(): Promise<WCProduct[]> {
  if (USE_MOCK) {
    const { MOCK_PRODUCTS } = await import('@modules/orders/mock/productsMock');
    const { simulateDelay: delay } = await import('@modules/orders/mock/ordersMock');
    return delay([...MOCK_PRODUCTS]);
  }
  const all: WCProduct[] = [];
  let page = 1;
  while (true) {
    const q = new URLSearchParams({
      per_page: String(PRODUCTS_PER_PAGE),
      page:     String(page),
      status:   'publish',
      orderby:  'title',
      order:    'asc',
    });
    const batch = await wcFetch<WCProduct[]>(`${WC_API_PATH}/products?${q}`);
    all.push(...batch.map(enrichProduct));
    if (batch.length < PRODUCTS_PER_PAGE) break;
    page++;
  }
  return all;
}

// Top products vendus sur la période (pour la section "Fréquemment commandés").
// Agrège depuis les 50 dernières commandes — pas besoin de view_woocommerce_reports.
export async function fetchTopProducts(limit = 6): Promise<WCProduct[]> {
  if (USE_MOCK) {
    const { MOCK_PRODUCTS } = await import('@modules/orders/mock/productsMock');
    const { simulateDelay: delay } = await import('@modules/orders/mock/ordersMock');
    return delay(MOCK_PRODUCTS.slice(0, limit));
  }
  try {
    // Récupère les line_items des 50 dernières commandes finalisées ou activées
    type SlimOrder = { line_items: Array<{ product_id: number; quantity: number }> };
    const recentOrders = await wcFetch<SlimOrder[]>(
      `${WC_API_PATH}/orders?per_page=50&status=completed,processing,souscription-actv&_fields=line_items`
    );

    // Agrège la fréquence par product_id
    const freq = new Map<number, number>();
    for (const order of recentOrders) {
      for (const item of order.line_items ?? []) {
        if (item.product_id > 0) {
          freq.set(item.product_id, (freq.get(item.product_id) ?? 0) + item.quantity);
        }
      }
    }
    if (!freq.size) {
      // Fallback sur le catalogue réel si aucune vente enregistrée
      const fallbackRes = await wcFetch<WCProduct[]>(`${WC_API_PATH}/products?per_page=${limit}&status=publish`);
      return fallbackRes.map(enrichProduct);
    }

    const topIds = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    const topRes = await wcFetch<WCProduct[]>(
      `${WC_API_PATH}/products?include=${topIds.join(',')}&per_page=${limit}&status=publish`
    );
    return topRes.map(enrichProduct);
  } catch {
    // En cas d'erreur réseau, fallback sur le catalogue général en direct pour éviter toute donnée test
    try {
      const errFallbackRes = await wcFetch<WCProduct[]>(`${WC_API_PATH}/products?per_page=${limit}&status=publish`);
      return errFallbackRes.map(enrichProduct);
    } catch {
      return [];
    }
  }
}

// Mise à jour des infos de facturation d'un client enregistré
export async function updateCustomerBilling(id: number, data: {
  first_name?: string; last_name?: string; phone?: string;
  email?: string; city?: string; country?: string; company?: string;
}): Promise<void> {
  if (USE_MOCK || id === 0) return;
  await wcFetch(`${WC_API_PATH}/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      first_name: data.first_name,
      last_name:  data.last_name,
      email:      data.email,
      billing: {
        first_name: data.first_name, last_name: data.last_name,
        phone: data.phone, city: data.city,
        country: data.country, company: data.company,
        email: data.email,
      },
    }),
  });
}

export async function fetchPartnerProducts(): Promise<WCProduct[]> {
  if (USE_MOCK) {
    const { MOCK_PRODUCTS } = await import('@modules/orders/mock/productsMock');
    const { simulateDelay: delay } = await import('@modules/orders/mock/ordersMock');
    return delay(MOCK_PRODUCTS.filter((p) => p.partner_price));
  }
  const res = await wcFetch<WCProduct[]>(`${PPB_API_PATH}/products`);
  return res.map(enrichProduct);
}

export async function fetchLowStockProducts(threshold = 5): Promise<WCProduct[]> {
  if (USE_MOCK) {
    const { MOCK_LOW_STOCK_PRODUCTS } = await import('@modules/orders/mock/productsMock');
    const { simulateDelay: delay } = await import('@modules/orders/mock/ordersMock');
    return delay(MOCK_LOW_STOCK_PRODUCTS, 300);
  }
  const query = new URLSearchParams({ per_page: '50', status: 'publish', stock_status: 'instock' });
  const products = await wcFetch<WCProduct[]>(`${WC_API_PATH}/products?${query}`);
  return products.map(enrichProduct).filter((p) => p.stock_quantity !== null && p.stock_quantity <= threshold);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// Calcule les dates de début/fin pour chaque période
function getPeriodDates(
  period: DashboardPeriod,
  customRange?: { start: string; end: string }
): { dateMin: string; dateMax: string } {
  if (period === 'custom' && customRange) {
    return { dateMin: customRange.start, dateMax: customRange.end };
  }
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':   break;
    case 'week':    start.setDate(start.getDate() - 6); break;
    case 'month':   start.setDate(1); break;
    case 'quarter': start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1); break;
    case 'year':    start.setMonth(0, 1); break;
    default:        break;
  }

  const fmt = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD
  return { dateMin: fmt(start), dateMax: fmt(now) };
}

interface WCSalesReport {
  total_sales: string;
  net_sales: string;
  num_orders: number;
  items_sold: number;
}

interface WCOrderTotal {
  slug: string;
  name: string;
  total: number;
}

// Agrège les commandes d'une période directement depuis /orders (pas /reports/).
// Ne requiert pas view_woocommerce_reports — fonctionne avec WP Application Password standard.
async function fetchOrdersForPeriod(
  dateMin: string, dateMax: string
): Promise<{ id: number; status: string; total: string }[]> {
  const all: { id: number; status: string; total: string }[] = [];
  for (let page = 1; page <= 5; page++) {
    const query = new URLSearchParams({
      after:    `${dateMin}T00:00:00`,
      before:   `${dateMax}T23:59:59`,
      per_page: '100',
      page:     String(page),
      _fields:  'id,status,total',
      orderby:  'date',
      order:    'desc',
    });
    const batch = await wcFetch<{ id: number; status: string; total: string }[]>(
      `${WC_API_PATH}/orders?${query}`
    );
    all.push(...batch);
    if (batch.length < 100) break; // plus de pages
  }
  return all;
}

// Koko Analytics — visites et pages vues du site
// Endpoint public : /wp-json/koko-analytics/v1/stats
export async function fetchSiteVisits(
  period: DashboardPeriod,
  customRange?: { start: string; end: string }
): Promise<{ visitors: number; pageviews: number } | null> {
  if (USE_MOCK) return { visitors: 1250, pageviews: 3400 };
  try {
    const creds = await Storage.getCredentials();
    if (!creds) return null;
    const { dateMin, dateMax } = getPeriodDates(period, customRange);
    const url = `${creds.store_url}/wp-json/koko-analytics/v1/stats?start_date=${dateMin}&end_date=${dateMax}`;
    const res = await fetch(url, {
      headers: { 'Authorization': 'Basic ' + btoa(`${creds.wp_username}:${creds.wp_app_password}`) },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ visitors: number; pageviews: number }>;
  } catch {
    return null;
  }
}

export async function fetchDashboardStats(
  period: DashboardPeriod,
  customRange?: { start: string; end: string }
): Promise<DashboardStats> {
  if (USE_MOCK) {
    const { getMockDashboard } = await import('../modules/dashboard/mock/dashboardMock');
    const { simulateDelay } = await import('@modules/orders/mock/ordersMock');
    return simulateDelay(getMockDashboard(period));
  }

  const { dateMin, dateMax } = getPeriodDates(period, customRange);

  // Agrégation directe des commandes — même approche que le MCP wc_get_store_stats
  const [periodOrders, recentOrders] = await Promise.all([
    fetchOrdersForPeriod(dateMin, dateMax),
    fetchOrders({ per_page: 5 }),
  ]);

  // Statuts qui contribuent au CA (excluent cancelled/refunded/failed/pending)
  const revenueStatuses = new Set(['processing', 'on-hold', 'completed', 'souscription-actv']);
  const revenue = periodOrders
    .filter(o => revenueStatuses.has(o.status))
    .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

  const revenueObj: import('@app-types/woocommerce').DashboardRevenue = {
    today: 0, week: 0, month: 0, quarter: 0, year: 0, custom: 0,
  };
  revenueObj[period] = revenue;

  // Counts par statut sur la période
  const counts: import('@app-types/woocommerce').DashboardOrderCounts = {
    pending: 0, processing: 0, completed: 0, cancelled: 0, on_hold: 0,
  };
  periodOrders.forEach((o) => {
    if (o.status === 'pending')    counts.pending++;
    if (o.status === 'processing') counts.processing++;
    if (o.status === 'completed' || o.status === 'souscription-actv')  counts.completed++;
    if (o.status === 'cancelled')  counts.cancelled++;
    if (o.status === 'on-hold')    counts.on_hold++;
  });

  const activeOrders = periodOrders.filter(o => revenueStatuses.has(o.status) || o.status === 'pending');

  return {
    revenue: revenueObj,
    order_counts: counts,
    recent_orders: recentOrders,
    period_order_count: activeOrders.length,
    period_items_sold: 0,
    conversion_rate: undefined,
  };
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function createCustomer(data: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  company?: string;
}): Promise<WCCustomer> {
  const baseCustomer: WCCustomer = {
    id: 0,
    date_created: new Date().toISOString(),
    email: data.email,
    first_name: data.first_name,
    last_name: data.last_name,
    username: '',
    billing: {
      first_name: data.first_name, last_name: data.last_name,
      company: data.company ?? '',
      address_1: '', address_2: '',
      city: data.city ?? '', state: '', postcode: '',
      country: data.country ?? 'BF',
      email: data.email, phone: data.phone ?? '',
    },
    shipping: {
      first_name: data.first_name, last_name: data.last_name,
      address_1: '', city: data.city ?? '', country: data.country ?? 'BF',
    },
    meta_data: [],
    orders_count: 0,
    total_spent: '0',
    role: 'customer',
    avatar_url: '',
  };

  if (USE_MOCK) return baseCustomer;

  return wcFetch<WCCustomer>(`${WC_API_PATH}/customers`, {
    method: 'POST',
    body: JSON.stringify({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      billing: {
        first_name: data.first_name, last_name: data.last_name,
        phone: data.phone ?? '',
        company: data.company ?? '',
        city: data.city ?? '',
        country: data.country ?? 'BF',
        email: data.email,
      },
    }),
  });
}

// Rattache toutes les commandes guests d'un email à un nouveau customer_id.
// Appelé après createCustomer() pour migrer l'historique du guest vers le nouveau compte.
export async function linkOrdersToCustomer(email: string, newCustomerId: number): Promise<{ linked: number; failed: number }> {
  if (USE_MOCK) return { linked: 0, failed: 0 };
  if (!email || newCustomerId === 0) return { linked: 0, failed: 0 };

  // Récupérer les commandes guest correspondant à cet email
  const query = new URLSearchParams({
    search: email,
    per_page: '50',
    _fields: 'id,customer_id,billing',
  });
  const orders = await wcFetch<{ id: number; customer_id: number; billing: { email: string } }[]>(
    `${WC_API_PATH}/orders?${query}`
  );

  const guestOrders = orders.filter(
    (o) => o.customer_id === 0 && o.billing?.email?.toLowerCase() === email.toLowerCase()
  );

  let linked = 0;
  let failed = 0;
  for (const order of guestOrders) {
    try {
      await wcFetch(`${WC_API_PATH}/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ customer_id: newCustomerId }),
      });
      linked++;
    } catch {
      failed++;
    }
  }
  return { linked, failed };
}

export async function fetchGuestCustomers(search?: string): Promise<WCCustomer[]> {
  // Utilise le paramètre `search` de l'API orders pour une recherche DB côté serveur.
  // Beaucoup plus rapide que de récupérer 100 commandes et filtrer côté client.
  if (!search || search.trim().length < 2) return [];

  if (USE_MOCK) {
    const { MOCK_ORDERS, simulateDelay } = await import('@modules/orders/mock/ordersMock');
    const q = search.toLowerCase();
    const guestOrders = MOCK_ORDERS.filter(
      (o) => o.customer_id === 0 && o.billing.first_name &&
        (`${o.billing.first_name} ${o.billing.last_name}`.toLowerCase().includes(q) ||
         o.billing.email.toLowerCase().includes(q) ||
         o.billing.phone.includes(q))
    );
    const seen = new Set<string>();
    const guests: WCCustomer[] = [];
    for (const order of guestOrders) {
      const key = order.billing.email || `${order.billing.first_name}-${order.billing.last_name}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      guests.push({
        id: 0, date_created: order.date_created, email: order.billing.email,
        first_name: order.billing.first_name, last_name: order.billing.last_name,
        username: '', billing: order.billing, shipping: order.shipping,
        meta_data: [], orders_count: 1, total_spent: order.total, role: 'customer', avatar_url: '',
      });
    }
    return simulateDelay(guests, 300);
  }

  // Recherche server-side via ?search= (indexé sur billing name/email/phone)
  const query = new URLSearchParams({
    search: search.trim(),
    per_page: '20',
    _fields: 'id,billing,shipping,customer_id,date_created,total',
  });
  const orders = await wcFetch<WCOrder[]>(`${WC_API_PATH}/orders?${query}`);
  const guestOrders = orders.filter((o) => o.customer_id === 0 && o.billing.first_name);

  const seen = new Set<string>();
  const result: WCCustomer[] = [];
  for (const order of guestOrders) {
    const key = order.billing.email?.toLowerCase() ||
      `${order.billing.first_name}-${order.billing.last_name}-${order.billing.phone}`.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: 0, date_created: order.date_created, email: order.billing.email,
      first_name: order.billing.first_name, last_name: order.billing.last_name,
      username: '', billing: order.billing, shipping: order.shipping,
      meta_data: [], orders_count: 1, total_spent: order.total, role: 'customer', avatar_url: '',
    });
  }
  return result;
}

export async function fetchOrderStatuses(): Promise<WCOrderStatus[]> {
  if (USE_MOCK) {
    const { simulateDelay } = await import('@modules/orders/mock/ordersMock');
    return simulateDelay<WCOrderStatus[]>([
      { slug: 'pending',    name: 'Attente paiement' },
      { slug: 'processing', name: 'En cours' },
      { slug: 'on-hold',   name: 'En attente' },
      { slug: 'completed', name: 'Terminée' },
      { slug: 'cancelled', name: 'Annulée' },
      { slug: 'refunded',  name: 'Remboursée' },
      { slug: 'failed',    name: 'Échouée' },
      { slug: 'souscription-actv', name: 'Souscription Activée' },
      { slug: 'checkout-draft', name: 'Brouillon' }
    ], 200);
  }
  return wcFetch<WCOrderStatus[]>(`${WC_API_PATH}/orders/statuses`);
}

export async function updateProduct(
  id: number,
  data: {
    regular_price?: string;
    sale_price?: string;
    stock_quantity?: number;
    stock_status?: string;
    meta_data?: Array<{ key: string; value: string }>;
  },
  variationId?: number
): Promise<WCProduct> {
  if (USE_MOCK) {
    const { MOCK_PRODUCTS } = await import('@modules/orders/mock/productsMock');
    const { simulateDelay } = await import('@modules/orders/mock/ordersMock');
    const idx = MOCK_PRODUCTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new WCApiError(404, null);
    
    const current = MOCK_PRODUCTS[idx];
    const newPrice = data.regular_price !== undefined ? data.regular_price : current.price;
    const newSalePrice = data.sale_price !== undefined ? data.sale_price : current.sale_price;
    const newQty = data.stock_quantity !== undefined ? data.stock_quantity : current.stock_quantity;
    
    let newStatus = data.stock_status || current.stock_status;
    if (newQty === 0) {
      newStatus = 'outofstock';
    } else if (newQty !== null && newQty > 0) {
      newStatus = 'instock';
    }
    
    const newPartnerPrice = data.meta_data?.find(m => m.key === '_ppb_partner_price')?.value || current.partner_price;
    
    MOCK_PRODUCTS[idx] = { 
      ...current, 
      regular_price: newPrice,
      sale_price: newSalePrice,
      price: newSalePrice ? newSalePrice : newPrice,
      stock_quantity: newQty,
      stock_status: newStatus as any,
      partner_price: newPartnerPrice,
    };
    return simulateDelay(MOCK_PRODUCTS[idx], 300);
  }
  
  // Si variationId fourni → éditer la variation individuelle
  const endpoint = variationId
    ? `${WC_API_PATH}/products/${id}/variations/${variationId}`
    : `${WC_API_PATH}/products/${id}`;

  const res = await wcFetch<WCProduct>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return enrichProduct(res);
}
