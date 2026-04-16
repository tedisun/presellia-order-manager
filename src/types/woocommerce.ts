// ─── Statuts commandes ────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

// ─── Méthodes de paiement hors ligne (spécifiques Presellia) ─────────────────
export type OfflinePaymentDetail =
  | 'orange_money'
  | 'moov_money'
  | 'wave'
  | 'my_nita'
  | 'cash'
  | 'virement'
  | 'autre';

// ─── Commande WooCommerce ─────────────────────────────────────────────────────
export interface WCOrder {
  id: number;
  number: string;
  status: OrderStatus;
  date_created: string;       // ISO 8601
  date_modified: string;
  total: string;              // string décimal ex: "25000.00"
  currency: string;           // "XOF"
  billing: WCBilling;
  shipping: WCShipping;
  line_items: WCLineItem[];
  fee_lines: WCFeeLine[];
  coupon_lines: WCCouponLine[];
  payment_method: string;           // slug ex: "ppay_orange"
  payment_method_title: string;     // libellé ex: "Orange Money"
  payment_url: string;              // URL checkout/order-pay pour partage WhatsApp
  meta_data: WCMeta[];
  customer_id: number;              // 0 = guest
  customer_note: string;
  // Champs calculés côté app (enrichissement)
  licenceflow_delivered?: boolean;
  created_by_agent?: string;        // depuis meta _presellia_created_by
  offline_payment_detail?: OfflinePaymentDetail; // depuis meta _presellia_payment_detail
}

// ─── Adresses ─────────────────────────────────────────────────────────────────
export interface WCBilling {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

export interface WCShipping {
  first_name: string;
  last_name: string;
  address_1: string;
  city: string;
  country: string;
}

// ─── Lignes de commande ───────────────────────────────────────────────────────
export interface WCLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  sku: string;
  price: number;              // prix unitaire en entier (XOF)
  total: string;              // total ligne
  subtotal: string;
  meta_data: WCMeta[];
}

export interface WCFeeLine {
  id: number;
  name: string;
  total: string;
}

export interface WCCouponLine {
  id: number;
  code: string;
  discount: string;
}

// ─── Méta données ─────────────────────────────────────────────────────────────
export interface WCMeta {
  id?: number;
  key: string;
  value: string;
}

// ─── Client WooCommerce ───────────────────────────────────────────────────────
export type CustomerRole = 'customer' | 'partner' | 'subscriber' | 'administrator';

export interface WCCustomer {
  id: number;
  date_created: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: WCBilling;
  shipping: WCShipping;
  meta_data: WCMeta[];
  orders_count: number;
  total_spent: string;
  role: CustomerRole;
  avatar_url: string;
}

// ─── Produit WooCommerce ──────────────────────────────────────────────────────
export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  type: 'simple' | 'variable' | 'grouped';
  status: 'publish' | 'draft' | 'private';
  price: string;
  regular_price: string;
  sale_price: string;
  sku: string;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity: number | null;
  categories: { id: number; name: string }[];
  partner_price?: string;     // depuis PPB /ppb/v1/products — null si pas partenaire
}

// ─── Ligne de commande à créer (formulaire CreateOrder) ───────────────────────
export interface OrderLineItemDraft {
  product: WCProduct;
  quantity: number;
  discount_percent: number;   // 0–100
  discount_fixed: number;     // montant XOF
  unit_price: number;         // prix effectif après remise
}

// ─── Payload création de commande ────────────────────────────────────────────
export interface CreateOrderPayload {
  customer_id: number;
  billing: Partial<WCBilling>;
  line_items: {
    product_id: number;
    quantity: number;
    subtotal: string;         // prix original × qté (avant remise) — ex: "50000.00"
    total: string;            // prix remisé × qté (ce qui est facturé) — ex: "45000.00"
  }[];
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  status: OrderStatus;
  meta_data: WCMeta[];
}

// ─── Statistiques dashboard ───────────────────────────────────────────────────
export interface DashboardRevenue {
  today: number;
  week: number;
  month: number;
  quarter: number;
  year: number;
}

export interface DashboardOrderCounts {
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  on_hold: number;
}

export interface DashboardStats {
  revenue: DashboardRevenue;
  order_counts: DashboardOrderCounts;
  recent_orders: WCOrder[];
  period_order_count?: number;  // commandes dans la période sélectionnée
  period_items_sold?: number;   // articles vendus dans la période
  conversion_rate?: number;     // undefined si Koko Analytics non installé
}

// ─── Utilisateur authentifié ──────────────────────────────────────────────────
export interface AppUser {
  id: number;
  name: string;
  email: string;
  username: string;
  role: CustomerRole;
  store_url: string;
}

// ─── Notification locale ──────────────────────────────────────────────────────
export type NotificationType = 'new_order' | 'status_change' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  order_id?: number;
  read: boolean;
  created_at: string;         // ISO 8601
}

// ─── Credentials stockées ────────────────────────────────────────────────────
export interface WCCredentials {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  wp_username: string;
  wp_app_password: string;
}

// ─── Réponse vérification mise à jour ────────────────────────────────────────
export interface GithubRelease {
  tag_name: string;           // ex: "v1.2.0"
  name: string;
  body: string;
  html_url: string;
  assets: {
    name: string;
    browser_download_url: string;
    content_type: string;
  }[];
}
