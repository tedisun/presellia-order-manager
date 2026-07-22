// ─── Mode mock (Phase 1) ──────────────────────────────────────────────────────
// Phase 1 : USE_MOCK = true  → toutes les fonctions retournent les mock data
// Phase 2 : USE_MOCK = false → appels WooCommerce REST API réels
export const USE_MOCK = false;

// ─── Clés de stockage sécurisé (SecureStore) ─────────────────────────────────
export const STORAGE_KEYS = {
  STORE_URL: 'wc_store_url',
  CONSUMER_KEY: 'wc_consumer_key',
  CONSUMER_SECRET: 'wc_consumer_secret',
  WP_USERNAME: 'wp_username',
  WP_APP_PASSWORD: 'wp_app_password',
  PUSH_TOKEN: 'expo_push_token',
  CURRENT_USER: 'current_user',
} as const;

// ─── Chemins API ──────────────────────────────────────────────────────────────
export const WC_API_PATH = '/wp-json/wc/v3';
export const WP_API_PATH = '/wp-json/wp/v2';
export const PPB_API_PATH = '/wp-json/ppb/v1';
export const POM_API_PATH = '/wp-json/pom/v1'; // endpoint push token (mu-plugin)

// ─── GitHub ───────────────────────────────────────────────────────────────────
export const GITHUB_REPO = 'tedisun/presellia-order-manager';
export const APP_VERSION = '1.4.6'; // toujours synchronisé avec app.json > version

// ─── Pagination ───────────────────────────────────────────────────────────────
export const ORDERS_PER_PAGE    = 50;
export const CUSTOMERS_PER_PAGE = 100; // max WC API (était 20)
export const PRODUCTS_PER_PAGE  = 100; // par page lors du fetch toutes-pages

// ─── Cache ────────────────────────────────────────────────────────────────────
export const PRODUCTS_CACHE_TTL_MS      = 12 * 60 * 60 * 1000; // 12 h
export const RECENT_CUSTOMERS_CACHE_TTL =  2 * 60 * 60 * 1000; //  2 h

// ─── Statuts de commande ──────────────────────────────────────────────────────
// Source unique pour le status picker (OrderDetailScreen) et StatusBadge.
// Ajouter ici les statuts personnalisés du site (ex : plugins Order Status Manager).
export const ALL_ORDER_STATUSES: { slug: string; label: string }[] = [
  { slug: 'pending',    label: 'En attente de paiement' },
  { slug: 'processing', label: 'En cours' },
  { slug: 'on-hold',   label: 'En pause' },
  { slug: 'completed', label: 'Terminée' },
  { slug: 'cancelled', label: 'Annulée' },
  { slug: 'refunded',  label: 'Remboursée' },
  { slug: 'failed',    label: 'Échouée' },
  // ── Statuts personnalisés Presellia ─────────────────────────────────────────
  { slug: 'souscription-actv', label: 'Souscription Activée' },
  { slug: 'checkout-draft', label: 'Brouillon' },
];

export function getStatusLabel(slug: string): string {
  if (!slug) return '';
  const cleanSlug = slug.replace(/^wc-/, '');
  const found = ALL_ORDER_STATUSES.find((s) => s.slug === cleanSlug || s.slug === slug);
  if (found) return found.label;

  const clean = cleanSlug.replace(/-/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}


// ─── Périodes dashboard ───────────────────────────────────────────────────────
export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export const DASHBOARD_PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: 'today',   label: "Auj." },
  { key: 'week',    label: "Sem." },
  { key: 'month',   label: "Mois" },
  { key: 'quarter', label: "3 M"  },
  { key: 'year',    label: "An"   },
  { key: 'custom',  label: "Perso" },
];

export function cleanPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0') && cleaned.length > 8) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length === 8 && !cleaned.startsWith('226')) {
    cleaned = '226' + cleaned;
  }
  return cleaned;
}
