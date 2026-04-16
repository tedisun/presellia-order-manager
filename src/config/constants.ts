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
export const APP_VERSION = '1.1.0'; // toujours synchronisé avec app.json > version

// ─── Pagination ───────────────────────────────────────────────────────────────
export const ORDERS_PER_PAGE = 50;
export const CUSTOMERS_PER_PAGE = 20;
export const PRODUCTS_PER_PAGE = 50;

// ─── Périodes dashboard ───────────────────────────────────────────────────────
export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

export const DASHBOARD_PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: 'today',   label: "Auj." },
  { key: 'week',    label: "Sem." },
  { key: 'month',   label: "Mois" },
  { key: 'quarter', label: "3 M"  },
  { key: 'year',    label: "An"   },
];
