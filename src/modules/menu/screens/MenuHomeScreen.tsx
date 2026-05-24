import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@modules/auth/hooks/useAuth';

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { paddingHorizontal: 16, paddingVertical: 12 },
  content: { gap: 18, paddingBottom: 32 },

  // En-tête de marque maquette
  brandCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  brandLogoCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12, shadowColor: c.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  brandLogoText: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  brandInfo: { flex: 1, gap: 2 },
  brandTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  brandSub: { fontSize: 12, color: c.textMuted },
  brandChevron: { fontSize: 14, color: c.textMuted },

  // Sections de cartes
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 4, marginBottom: 2 },

  // Rangement des cartes de réglages
  menuRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuInfo: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  menuSub: { fontSize: 11, color: c.textMuted },
  
  // Badges & redirection icons
  badgeCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  externalIcon: { color: c.textMuted, fontSize: 14, marginLeft: 4 },
});

export default function MenuHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  
  const unreadNotificationsCount = 4; // Badge boîte de réception dynamique maquette

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible de charger le lien.');
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* En-tête de marque maquette */}
          <TouchableOpacity 
            style={styles.brandCard} 
            activeOpacity={0.85}
            onPress={() => handleOpenLink('https://presellia.com')}
          >
            <View style={styles.brandLogoCircle}>
              {/* Logo text P symbol */}
              <Text style={styles.brandLogoText}>P</Text>
            </View>
            <View style={styles.brandInfo}>
              <Text style={styles.brandTitle}>Presellia</Text>
              <Text style={styles.brandSub}>presellia.com</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Section Réglages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Réglages</Text>
            
            <TouchableOpacity 
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Préférences', 'Mise à jour des préférences disponible prochainement.')}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="settings-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>Réglages</Text>
                <Text style={styles.menuSub}>Mettre à jour mes préférences</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Section Général */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Général</Text>

            {/* WC Admin */}
            <TouchableOpacity 
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => handleOpenLink(user?.store_url ? `${user.store_url}/superu/` : 'https://presellia.com/superu/')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#21759B15' }]}>
                <Ionicons name="logo-wordpress" size={16} color="#21759B" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>WC Admin</Text>
                <Text style={styles.menuSub}>Gérez plus de paramètres d'administration</Text>
              </View>
              <Ionicons name="open-outline" size={14} style={styles.externalIcon} />
            </TouchableOpacity>

            {/* Voir la boutique */}
            <TouchableOpacity 
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => handleOpenLink('https://presellia.com')}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="storefront-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>Voir la boutique</Text>
                <Text style={styles.menuSub}>Voir votre boutique en ligne</Text>
              </View>
              <Ionicons name="open-outline" size={14} style={styles.externalIcon} />
            </TouchableOpacity>

            {/* Clients (Tendances) */}
            <TouchableOpacity 
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CustomersTab')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="people-outline" size={16} color="#3B82F6" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>Clients</Text>
                <Text style={styles.menuSub}>Obtenir les tendances clients</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Boîte de réception (Alertes) */}
            <TouchableOpacity 
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Notifications')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="mail-outline" size={16} color="#3B82F6" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>Boîte de réception</Text>
                <Text style={styles.menuSub}>Restez à jour de vos notifications push</Text>
              </View>
              {unreadNotificationsCount > 0 && (
                <View style={[styles.badgeCircle, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.badgeText}>{unreadNotificationsCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Bouton de Déconnexion */}
            <TouchableOpacity 
              style={[styles.menuRow, { marginTop: 12, borderColor: colors.error + '44', backgroundColor: colors.error + '0A' }]}
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Déconnexion',
                  'Êtes-vous sûr de vouloir vous déconnecter de votre compte Presellia ?',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Se déconnecter', style: 'destructive', onPress: logout }
                  ]
                );
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.error + '18' }]}>
                <Ionicons name="log-out-outline" size={16} color={colors.error} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={[styles.menuTitle, { color: colors.error }]}>Déconnexion</Text>
                <Text style={styles.menuSub}>Fermer ma session et effacer mes données</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.error + '88'} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
