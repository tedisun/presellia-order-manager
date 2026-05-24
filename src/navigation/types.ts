import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// ─── Stack racine (auth gate) ─────────────────────────────────────────────────
export type RootStackParamList = {
  Auth:       undefined;
  Main:       undefined;
  Diagnostic: undefined;
};

// ─── Stack Auth ───────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
};

// ─── Tabs principaux ──────────────────────────────────────────────────────────
export type MainTabParamList = {
  Dashboard: undefined;
  OrdersTab: undefined;
  CustomersTab: undefined;
  ProductsTab: undefined;
  MenuTab: undefined;
};

export type ProductsStackParamList = {
  ProductsList: undefined;
};

export type MenuStackParamList = {
  MenuHome: undefined;
  Notifications: undefined; // inbox relogged here
};

// ─── Stack Commandes ──────────────────────────────────────────────────────────
export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: { orderId: number };
  CreateOrder: { orderId?: number; customerId?: number } | undefined;
};

// ─── Stack Clients ────────────────────────────────────────────────────────────
export type CustomersStackParamList = {
  CustomerSearch: undefined;
  CustomerDetail: { customerId: number; guestJson?: string };
};

// ─── Props helpers ────────────────────────────────────────────────────────────
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OrdersStackScreenProps<T extends keyof OrdersStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<OrdersStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type CustomersStackScreenProps<T extends keyof CustomersStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CustomersStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;
