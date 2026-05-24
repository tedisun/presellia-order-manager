import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import type { MainTabParamList, OrdersStackParamList, CustomersStackParamList, ProductsStackParamList, MenuStackParamList } from './types';

import DashboardScreen from '@modules/dashboard/screens/DashboardScreen';
import OrdersListScreen from '@modules/orders/screens/OrdersListScreen';
import OrderDetailScreen from '@modules/orders/screens/OrderDetailScreen';
import CreateOrderScreen from '@modules/orders/screens/CreateOrderScreen';
import CustomerSearchScreen from '@modules/customers/screens/CustomerSearchScreen';
import CustomerDetailScreen from '@modules/customers/screens/CustomerDetailScreen';
import ProductsListScreen from '@modules/products/screens/ProductsListScreen';
import MenuHomeScreen from '@modules/menu/screens/MenuHomeScreen';
import NotificationsScreen from '@modules/notifications/screens/NotificationsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const CustomersStack = createNativeStackNavigator<CustomersStackParamList>();
const ProductsStack = createNativeStackNavigator<ProductsStackParamList>();
const MenuStack = createNativeStackNavigator<MenuStackParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ icon, focused, colors }: { icon: IoniconName; focused: boolean; colors: BrandColors }) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} />
    </View>
  );
}

function OrdersNavigator() {
  const { colors } = useTheme();
  return (
    <OrdersStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
        headerBackTitle: '',
      }}
    >
      <OrdersStack.Screen name="OrdersList"   component={OrdersListScreen}   options={{ title: 'Commandes', headerShown: false }} />
      <OrdersStack.Screen name="OrderDetail"  component={OrderDetailScreen}  options={{ title: 'Commande' }} />
      <OrdersStack.Screen name="CreateOrder"  component={CreateOrderScreen}  options={{ title: 'Nouvelle commande' }} />
    </OrdersStack.Navigator>
  );
}

function CustomersNavigator() {
  const { colors } = useTheme();
  return (
    <CustomersStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
        headerBackTitle: '',
      }}
    >
      <CustomersStack.Screen name="CustomerSearch" component={CustomerSearchScreen} options={{ title: 'Clients', headerShown: false }} />
      <CustomersStack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Client' }} />
    </CustomersStack.Navigator>
  );
}

function ProductsNavigator() {
  const { colors } = useTheme();
  return (
    <ProductsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
        headerBackTitle: '',
      }}
    >
      <ProductsStack.Screen name="ProductsList" component={ProductsListScreen} options={{ title: 'Produits', headerShown: false }} />
    </ProductsStack.Navigator>
  );
}

function MenuNavigator() {
  const { colors } = useTheme();
  return (
    <MenuStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
        headerBackTitle: '',
      }}
    >
      <MenuStack.Screen name="MenuHome" component={MenuHomeScreen} options={{ title: 'Menu', headerShown: false }} />
      <MenuStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Boîte de réception' }} />
    </MenuStack.Navigator>
  );
}

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const unreadNotifications = 4;

  const tabBarStyle = useMemo(() => ({
    backgroundColor: colors.surface,
    borderTopColor:  colors.border,
    borderTopWidth:  1,
    paddingTop:      4,
    height:          60 + insets.bottom,
    paddingBottom:   insets.bottom,
  }), [colors, insets.bottom]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Boutique',
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? 'stats-chart' : 'stats-chart-outline'} focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersNavigator}
        options={{
          tabBarLabel: 'Commandes',
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? 'receipt' : 'receipt-outline'} focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={CustomersNavigator}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? 'people' : 'people-outline'} focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="ProductsTab"
        component={ProductsNavigator}
        options={{
          tabBarLabel: 'Produits',
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? 'cube' : 'cube-outline'} focused={focused} colors={colors} />,
        }}
      />
      <Tab.Screen
        name="MenuTab"
        component={MenuNavigator}
        options={{
          tabBarLabel: 'Menu',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? 'apps' : 'apps-outline'} size={20} color={focused ? colors.primary : colors.textMuted} />
              {unreadNotifications > 0 && (
                <View style={[styles.badge, { borderColor: colors.background }]} />
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: BRANDING.fonts.sizeXS - 1, marginBottom: 4 },
  iconContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: -2, right: -4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
  },
});
