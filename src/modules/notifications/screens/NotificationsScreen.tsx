import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import EmptyState from '@components/EmptyState';
import type { AppNotification } from '@app-types/woocommerce';
import {
  getStoredNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@services/notifications';

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe:             { flex: 1, backgroundColor: c.background },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: BRANDING.spacing.lg, paddingVertical: BRANDING.spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  title:            { fontSize: BRANDING.fonts.sizeXL, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  badge:            { fontSize: BRANDING.fonts.sizeXS, color: c.primary, marginTop: 2 },
  markAllText:      { fontSize: BRANDING.fonts.sizeSM, color: c.primary },
  row:              { flexDirection: 'row', paddingHorizontal: BRANDING.spacing.lg, paddingVertical: BRANDING.spacing.md, borderBottomWidth: 1, borderBottomColor: c.border, gap: BRANDING.spacing.md, alignItems: 'flex-start' },
  rowUnread:        { backgroundColor: c.primary + '0A' },
  iconWrap:         { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
  icon:             { fontSize: 18 },
  body:             { flex: 1 },
  notifTitle:       { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, fontWeight: BRANDING.fonts.weightMedium },
  notifTitleUnread: { color: c.textPrimary, fontWeight: BRANDING.fonts.weightSemiBold },
  message:          { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 2, lineHeight: 18 },
  time:             { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, marginTop: 4 },
  unreadDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 6 },
  emptyContainer:   { flex: 1 },
});

const TYPE_ICONS: Record<string, string> = {
  new_order:     '🛒',
  status_change: '🔄',
  system:        '⚙️',
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const stored = await getStoredNotifications();
    setNotifications(stored);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((ns) => ns.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.badge}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.rowUnread]}
            onPress={() => {
              handleMarkRead(item.id);
              if (item.order_id) {
                navigation.navigate('OrdersTab', {
                  screen: 'OrderDetail',
                  params: { orderId: item.order_id },
                });
              }
            }}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
            </View>
            <View style={styles.body}>
              <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.time}>
                {new Date(item.created_at).toLocaleString('fr-FR', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="🔔" title="Aucune notification" subtitle="Vous êtes à jour !" />
          ) : null
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
