import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, RefreshControl, Linking, Modal, FlatList, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { fetchCustomer, fetchOrders, updateCustomerBilling, createCustomer, linkOrdersToCustomer } from '@services/woocommerce';
import { cleanPhoneForWhatsApp } from '@config/constants';
import CurrencyText from '@components/CurrencyText';
import StatusBadge from '@components/StatusBadge';
import LoadingSpinner from '@components/LoadingSpinner';
import type { WCCustomer, WCOrder } from '@app-types/woocommerce';
import type { CustomersStackParamList } from '@navigation/types';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';

type RoutePropType = RouteProp<CustomersStackParamList, 'CustomerDetail'>;
type NavProp = NativeStackNavigationProp<CustomersStackParamList, 'CustomerDetail'>;

const COUNTRIES = [
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'SN', name: 'Sénégal' },
  { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'ML', name: 'Mali' },
  { code: 'NE', name: 'Niger' },
  { code: 'GN', name: 'Guinée' },
  { code: 'FR', name: 'France' },
  { code: 'OTHER', name: 'Autre (Saisie manuelle)' }
];

const isStandardCountry = (code: string) => {
  return ['BF', 'CI', 'SN', 'TG', 'BJ', 'ML', 'NE', 'GN', 'FR'].includes(code);
};

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: BRANDING.spacing.lg, gap: BRANDING.spacing.md },
  // Identity
  identityCard: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BRANDING.spacing.md,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: BRANDING.fonts.sizeXL,
    fontWeight: BRANDING.fonts.weightBold,
    color: c.primary,
    textTransform: 'uppercase',
  },
  identityInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  guestBadge: {
    backgroundColor: c.textMuted + '33',
    borderRadius: BRANDING.radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  guestText: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
  partnerBadge: {
    backgroundColor: c.success + '33',
    borderRadius: BRANDING.radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  partnerText: { fontSize: BRANDING.fonts.sizeXS, color: c.success },
  email: { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginTop: 2 },
  company: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, marginTop: 2 },
  editBtn: {
    padding: 8,
    borderRadius: BRANDING.radius.full,
    backgroundColor: c.primary + '18',
    flexShrink: 0,
  },
  // Edit form
  editForm: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    borderWidth: 1,
    borderColor: c.primary + '55',
    gap: BRANDING.spacing.md,
  },
  editFormTitle: { fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textPrimary },
  formRow: { flexDirection: 'row', gap: BRANDING.spacing.md },
  formField: { flex: 1, gap: 4 },
  formFieldFull: { gap: 4 },
  formLabel: { fontSize: BRANDING.fonts.sizeXS, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  formInput: {
    backgroundColor: c.background,
    borderWidth: 1, borderColor: c.border,
    borderRadius: BRANDING.radius.md,
    paddingHorizontal: BRANDING.spacing.md, paddingVertical: BRANDING.spacing.sm,
    color: c.textPrimary,
    fontSize: BRANDING.fonts.sizeMD,
  },
  guestEditNote: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, fontStyle: 'italic' },
  promoteNote: {
    fontSize: BRANDING.fonts.sizeXS, color: c.success + 'CC',
    fontStyle: 'italic', lineHeight: 18,
  },
  editActions: { flexDirection: 'row', gap: BRANDING.spacing.md },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: c.border,
    borderRadius: BRANDING.radius.md, paddingVertical: BRANDING.spacing.md, alignItems: 'center',
  },
  cancelText: { color: c.textSecondary, fontSize: BRANDING.fonts.sizeMD },
  saveBtn: {
    flex: 2, backgroundColor: c.primary,
    borderRadius: BRANDING.radius.md, paddingVertical: BRANDING.spacing.md, alignItems: 'center',
  },
  promoteBtn: {
    flex: 2, backgroundColor: c.success,
    borderRadius: BRANDING.radius.md, paddingVertical: BRANDING.spacing.md, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: BRANDING.fonts.sizeMD, fontWeight: BRANDING.fonts.weightSemiBold },
  // Promote form variant
  promoteForm: {
    borderColor: c.success + '55',
    backgroundColor: c.success + '08',
  },
  promoteHeader: { flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.sm },
  // Promote card (bouton d'action)
  promoteCard: {
    backgroundColor: c.success + '12',
    borderRadius: BRANDING.radius.lg,
    borderWidth: 1,
    borderColor: c.success + '44',
    padding: BRANDING.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BRANDING.spacing.md,
  },
  promoteCardIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: c.success + '22',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  promoteCardTitle: {
    fontSize: BRANDING.fonts.sizeMD,
    fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.success,
  },
  promoteCardSub: {
    fontSize: BRANDING.fonts.sizeXS,
    color: c.success + 'AA',
    marginTop: 2,
  },
  // Stats
  statsRow: { flexDirection: 'row', gap: BRANDING.spacing.md },
  statCard: {
    flex: 1, backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md, padding: BRANDING.spacing.md,
    borderWidth: 1, borderColor: c.border, alignItems: 'center', gap: 2,
  },
  statValue: { fontSize: BRANDING.fonts.sizeXL, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  statLabel: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted },
  // Cards
  card: {
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.lg, padding: BRANDING.spacing.lg,
    borderWidth: 1, borderColor: c.border, gap: BRANDING.spacing.sm,
  },
  cardTitle: {
    fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightSemiBold,
    color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  contactValue: { fontSize: BRANDING.fonts.sizeSM },
  noPhone: { fontSize: BRANDING.fonts.sizeSM, color: c.warning },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  infoLabel: { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted, flex: 1 },
  infoValue: { fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary, flex: 2, textAlign: 'right' },
  noOrders: { fontSize: BRANDING.fonts.sizeSM, color: c.textMuted, textAlign: 'center', paddingVertical: BRANDING.spacing.md },
  orderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: BRANDING.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  orderLeft: {},
  orderNum: { fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightSemiBold, color: c.primary },
  orderDate: { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, marginTop: 1 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BRANDING.radius.lg,
    borderTopRightRadius: BRANDING.radius.lg,
    padding: BRANDING.spacing.lg,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: BRANDING.spacing.md,
  },
  modalTitle: {
    fontSize: BRANDING.fonts.sizeLG,
    fontWeight: BRANDING.fonts.weightBold,
    marginBottom: BRANDING.spacing.md,
    textAlign: 'center',
  },
});

export default function CustomerDetailScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavProp>();
  const { customerId, guestJson } = route.params;
  const isGuest = customerId === 0;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [customer, setCustomer] = useState<WCCustomer | null>(
    guestJson ? JSON.parse(guestJson) as WCCustomer : null
  );
  const [orders, setOrders] = useState<WCOrder[]>([]);
  const [loading, setLoading] = useState(!isGuest);
  const [refreshing, setRefreshing] = useState(false);

  // Edit / promote state
  const [showEdit, setShowEdit] = useState(false);
  const [promoteMode, setPromoteMode] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const [promoted, setPromoted] = useState(false); // true once guest was promoted
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);

  const handleWhatsApp = (phone: string) => {
    const cleaned = cleanPhoneForWhatsApp(phone);
    Linking.openURL(`https://wa.me/${cleaned}`).catch(() =>
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp.')
    );
  };

  const load = async () => {
    try {
      if (isGuest && customer) {
        // Invité : pas de fetchCustomer — chercher ses commandes par email
        if (customer.email) {
          const allOrders = await fetchOrders({ search: customer.email, per_page: 20 });
          setOrders(allOrders.filter(o => o.customer_id === 0));
        }
      } else {
        const [c, allOrders] = await Promise.all([
          fetchCustomer(customerId),
          fetchOrders({ customer: customerId, per_page: 50 }),
        ]);
        setCustomer(c);
        setOrders(allOrders);
        navigation.setOptions({ title: `${c.first_name} ${c.last_name}` });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger ce client.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isGuest && customer) {
      navigation.setOptions({ title: `${customer.first_name} ${customer.last_name}` });
      load();
    } else if (!isGuest) {
      load();
    }
  }, [customerId]);

  const openEdit = (promote = false) => {
    if (!customer) return;
    setEditFirst(customer.first_name);
    setEditLast(customer.last_name);
    setEditPhone(customer.billing.phone || '');
    setEditEmail(customer.email || '');
    setEditCity(customer.billing.city || '');
    setEditCountry(customer.billing.country || 'BF');
    setEditCompany(customer.billing.company || '');
    setPromoteMode(promote);
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!customer || saving || savingRef.current) return;
    const email = editEmail.trim();

    if (promoteMode && !email) {
      Alert.alert('Email requis', 'Un email est nécessaire pour créer un compte client.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const updated: WCCustomer = {
        ...customer,
        first_name: editFirst.trim() || customer.first_name,
        last_name:  editLast.trim() || customer.last_name,
        email:      email || customer.email,
        billing: {
          ...customer.billing,
          phone:   editPhone.trim(),
          city:    editCity.trim(),
          country: editCountry.trim() || customer.billing.country,
          company: editCompany.trim(),
          email:   email || customer.email,
        },
      };

      if (promoteMode) {
        // Créer le compte WooCommerce
        const newCustomer = await createCustomer({
          first_name: updated.first_name,
          last_name:  updated.last_name,
          email:      updated.email,
          phone:      updated.billing.phone,
          city:       updated.billing.city,
          country:    updated.billing.country,
          company:    updated.billing.company,
        });

        // Fermer le formulaire immédiatement — ne pas attendre le rattachement
        setCustomer({ ...newCustomer, billing: updated.billing });
        setPromoted(true);
        setShowEdit(false);
        setPromoteMode(false);
        Alert.alert('Promotion réussie', 'Compte WooCommerce créé. Rattachement des commandes en arrière-plan…');

        // Rattacher les commandes en arrière-plan (fire-and-forget)
        linkOrdersToCustomer(updated.email, newCustomer.id)
          .then(({ linked }) => { if (linked > 0) load(); })
          .catch(() => {});
      } else {
        // Modification simple — persiste sur WC pour les clients enregistrés
        if (!isGuest) {
          await updateCustomerBilling(customerId, {
            first_name: updated.first_name,
            last_name:  updated.last_name,
            email:      updated.email,
            phone:      updated.billing.phone,
            city:       updated.billing.city,
            country:    updated.billing.country,
            company:    updated.billing.company,
          });
        }
        setCustomer(updated);
        setShowEdit(false);
      }
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de sauvegarder.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (!customer) return null;

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {customer.first_name.charAt(0)}{customer.last_name.charAt(0)}
            </Text>
          </View>
          <View style={styles.identityInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{customer.first_name} {customer.last_name}</Text>
              {isGuest && (
                <View style={styles.guestBadge}>
                  <Text style={styles.guestText}>Invité</Text>
                </View>
              )}
              {customer.role === 'partner' && (
                <View style={styles.partnerBadge}>
                  <Text style={styles.partnerText}>Partenaire</Text>
                </View>
              )}
            </View>
            {customer.email ? <Text style={styles.email}>{customer.email}</Text> : null}
            {customer.billing.company ? <Text style={styles.company}>{customer.billing.company}</Text> : null}
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit()}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Edit form / promote form */}
        {showEdit && (
          <View style={[styles.editForm, promoteMode && styles.promoteForm]}>
            {promoteMode ? (
              <View style={styles.promoteHeader}>
                <Ionicons name="person-add-outline" size={18} color={colors.success} />
                <Text style={[styles.editFormTitle, { color: colors.success }]}>Créer un compte client</Text>
              </View>
            ) : (
              <Text style={styles.editFormTitle}>Modifier les informations</Text>
            )}
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Prénom</Text>
                <TextInput style={styles.formInput} value={editFirst} onChangeText={setEditFirst}
                  placeholder="Prénom" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Nom</Text>
                <TextInput style={styles.formInput} value={editLast} onChangeText={setEditLast}
                  placeholder="Nom" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
              </View>
            </View>
            <View style={styles.formFieldFull}>
              <Text style={styles.formLabel}>Téléphone</Text>
              <TextInput style={styles.formInput} value={editPhone} onChangeText={setEditPhone}
                placeholder="+226 XX XX XX XX" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            </View>
            <View style={styles.formFieldFull}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput style={styles.formInput} value={editEmail} onChangeText={setEditEmail}
                placeholder="email@exemple.com" placeholderTextColor={colors.textMuted}
                keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Ville</Text>
                <TextInput style={styles.formInput} value={editCity} onChangeText={setEditCity}
                  placeholder="Ouagadougou" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Pays</Text>
                <TouchableOpacity
                  style={[styles.formInput, { justifyContent: 'center', height: 42 }]}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: editCountry ? colors.textPrimary : colors.textMuted }}>
                      {COUNTRIES.find(c => c.code === editCountry)?.name || (editCountry ? `Autre (${editCountry})` : 'Sélect...')}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={14} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            {!isStandardCountry(editCountry) && (
              <View style={styles.formFieldFull}>
                <Text style={styles.formLabel}>Code pays manuel (2 lettres)</Text>
                <TextInput style={styles.formInput} value={editCountry} onChangeText={(text) => setEditCountry(text.toUpperCase().trim().slice(0, 2))}
                  placeholder="Ex: US, CA" placeholderTextColor={colors.textMuted} autoCapitalize="characters" maxLength={2} />
              </View>
            )}
            <View style={styles.formFieldFull}>
              <Text style={styles.formLabel}>Entreprise</Text>
              <TextInput style={styles.formInput} value={editCompany} onChangeText={setEditCompany}
                placeholder="Nom de l'entreprise" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </View>
            {isGuest && !promoteMode && (
              <Text style={styles.guestEditNote}>
                Client invité — modifications sauvegardées localement uniquement.
              </Text>
            )}
            {promoteMode && (
              <Text style={styles.promoteNote}>
                Un compte WooCommerce sera créé et les commandes existantes seront rattachées à ce compte.
              </Text>
            )}
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowEdit(false); setPromoteMode(false); }}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[promoteMode ? styles.promoteBtn : styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                {saving ? (
                  <Text style={styles.saveBtnText}>{promoteMode ? 'Création…' : 'Sauvegarde…'}</Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {promoteMode && <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />}
                    <Text style={styles.saveBtnText}>{promoteMode ? 'Créer le compte' : 'Enregistrer'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bouton de promotion — invités non encore promus */}
        {isGuest && !promoted && !showEdit && (
          <TouchableOpacity style={styles.promoteCard} onPress={() => openEdit(true)}>
            <View style={styles.promoteCardIcon}>
              <Ionicons name="person-add-outline" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoteCardTitle}>Promouvoir en client</Text>
              <Text style={styles.promoteCardSub}>Créer un compte WooCommerce et rattacher les commandes</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.success} />
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Commandes" value={String(orders.length)} styles={styles} />
          <StatCard label="Total dépensé" value={<CurrencyText amount={totalSpent} size="md" bold />} styles={styles} />
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>
          {customer.billing.phone ? (
            <>
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${customer.billing.phone}`)}>
                <Ionicons name="call-outline" size={15} color={colors.success} />
                <Text style={[styles.contactValue, { color: colors.success }]}>{customer.billing.phone} (Appeler)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactRow} onPress={() => handleWhatsApp(customer.billing.phone)}>
                <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                <Text style={[styles.contactValue, { color: '#25D366' }]}>{customer.billing.phone} (WhatsApp)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.noPhone}>Aucun numéro de téléphone</Text>
          )}
          {customer.email ? (
            <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${customer.email}`)}>
              <Ionicons name="mail-outline" size={15} color={colors.info} />
              <Text style={[styles.contactValue, { color: colors.info }]}>{customer.email}</Text>
            </TouchableOpacity>
          ) : null}
          {customer.billing.city ? (
            <InfoRow label="Ville" value={customer.billing.city} styles={styles} />
          ) : null}
          {customer.billing.country ? (
            <InfoRow label="Pays" value={customer.billing.country} styles={styles} />
          ) : null}
          {customer.billing.company ? (
            <InfoRow label="Entreprise" value={customer.billing.company} styles={styles} />
          ) : null}
          {customer.billing.address_1 ? (
            <InfoRow label="Adresse" value={customer.billing.address_1} styles={styles} />
          ) : null}
        </View>

        {/* Order history */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historique ({orders.length})</Text>
          {orders.length === 0 ? (
            <Text style={styles.noOrders}>
              {isGuest ? 'Aucune commande trouvée pour cet invité' : 'Aucune commande'}
            </Text>
          ) : (
            orders.map((o) => (
              <View key={o.id} style={styles.orderRow}>
                <View style={styles.orderLeft}>
                  <Text style={styles.orderNum}>#{o.number}</Text>
                  <Text style={styles.orderDate}>{new Date(o.date_created).toLocaleDateString('fr-FR')}</Text>
                </View>
                <View style={styles.orderRight}>
                  <CurrencyText amount={o.total} size="sm" bold />
                  <StatusBadge status={o.status} size="sm" />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Country Picker Modal Sheet */}
      <Modal visible={showCountryPicker} transparent animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountryPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 20) }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sélectionner un pays</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: BRANDING.spacing.lg,
                    paddingVertical: BRANDING.spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                  onPress={() => {
                    if (item.code === 'OTHER') {
                      setEditCountry('');
                    } else {
                      setEditCountry(item.code);
                    }
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={{ fontSize: 16, color: colors.textPrimary, flex: 1 }}>{item.name}</Text>
                  {editCountry === item.code && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  {!isStandardCountry(editCountry) && item.code === 'OTHER' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 350 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, styles }: { label: string; value: string | React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statCard}>
      {typeof value === 'string' ? <Text style={styles.statValue}>{value}</Text> : value}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
