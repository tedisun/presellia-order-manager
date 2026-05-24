import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, Pressable, RefreshControl, TextInput,
  KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import { fetchProducts, fetchProductVariations, updateProduct } from '@services/woocommerce';
import type { WCProduct, WCProductVariation } from '@app-types/woocommerce';
import CurrencyText from '@components/CurrencyText';
import SearchBar from '@components/SearchBar';

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  
  // Onglets filtres
  chipsRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: c.surfaceElevated, borderColor: c.border },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },

  // Cartes produits
  listContent: { gap: 12, paddingBottom: 24 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoCol: { flex: 1, gap: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catText: { fontSize: 10, color: c.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nameText: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  skuText: { fontSize: 11, color: c.textMuted },
  rightCol: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  priceText: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
  
  // Badges stock
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-end' },
  badgeInStock: { backgroundColor: '#D1FAE5' },
  badgeOut: { backgroundColor: '#FEE2E2' },
  badgeLow: { backgroundColor: '#FEF3C7' },
  badgeVar: { backgroundColor: c.primary + '22' },
  badgeTextInStock: { fontSize: 10, fontWeight: '600', color: '#065F46' },
  badgeTextOut: { fontSize: 10, fontWeight: '600', color: '#991B1B' },
  badgeTextLow: { fontSize: 10, fontWeight: '600', color: '#92400E' },
  badgeTextVar: { fontSize: 10, fontWeight: '600', color: c.primary },

  emptyText: { textAlign: 'center', color: c.textMuted, fontSize: 14, marginTop: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Detail Modal Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12, marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, flex: 1, marginRight: 10 },
  modalCloseBtn: { padding: 4 },
  modalScroll: { gap: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: c.textMuted },
  detailVal: { fontSize: 13, fontWeight: '600', color: c.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  variationTitle: { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  variationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surfaceElevated, borderRadius: 10, padding: 10, marginTop: 6, borderWidth: 1, borderColor: c.border },
  variationName: { fontSize: 13, color: c.textPrimary, fontWeight: '500' },
  variationPrice: { fontSize: 13, fontWeight: '700', color: c.primary },
  // Formulaire d'édition de produit
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  editInput: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: c.textPrimary, fontSize: 14 },
  btnAction: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnActionText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
});

type FilterType = 'all' | 'instock' | 'lowstock' | 'outofstock';

export default function ProductsListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Product Detail Modal & Edition
  const [selectedProduct, setSelectedProduct] = useState<WCProduct | null>(null);
  const [variations, setVariations] = useState<WCProductVariation[]>([]);
  const [loadingVar, setLoadingVar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editPartnerPrice, setEditPartnerPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [updatingProduct, setUpdatingProduct] = useState(false);
  // Édition d'une variation spécifique
  const [editingVariation, setEditingVariation] = useState<WCProductVariation | null>(null);
  const [editVarPrice, setEditVarPrice] = useState('');
  const [editVarSalePrice, setEditVarSalePrice] = useState('');
  const [editVarPartnerPrice, setEditVarPartnerPrice] = useState('');
  const [editVarStock, setEditVarStock] = useState('');
  const [updatingVariation, setUpdatingVariation] = useState(false);

  const load = useCallback(async () => {
    try {
      const prods = await fetchProducts();
      setProducts(prods);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleProductSelect = async (prod: WCProduct) => {
    setSelectedProduct(prod);
    setIsEditing(false);
    setEditPrice(prod.regular_price || prod.price || '');
    setEditSalePrice(prod.sale_price || '');
    setEditPartnerPrice(prod.partner_price || '');
    setEditStock(prod.stock_quantity !== null ? prod.stock_quantity.toString() : '');

    if (prod.type === 'variable') {
      setLoadingVar(true);
      setVariations([]);
      try {
        const vars = await fetchProductVariations(prod.id);
        setVariations(vars);
      } catch {
        console.warn('Erreur lors du chargement des variations');
      } finally {
        setLoadingVar(false);
      }
    }
  };

  const handleSaveProductEdit = async () => {
    if (!selectedProduct) return;
    setUpdatingProduct(true);
    try {
      const updated = await updateProduct(selectedProduct.id, {
        regular_price: editPrice,
        sale_price: editSalePrice,
        stock_quantity: editStock ? parseInt(editStock, 10) : 0,
        meta_data: [
          {
            key: '_ppb_partner_price',
            value: editPartnerPrice,
          }
        ]
      });
      
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? updated : p));
      setSelectedProduct(updated);
      setIsEditing(false);
      Alert.alert('Succès', 'Le produit a été mis à jour avec succès.');
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le produit.');
    } finally {
      setUpdatingProduct(false);
    }
  };

  const handleEditVariation = (v: WCProductVariation) => {
    setEditingVariation(v);
    setEditVarPrice(v.regular_price || v.price || '');
    setEditVarSalePrice(v.sale_price || '');
    setEditVarPartnerPrice(v.partner_price || '');
    setEditVarStock(v.stock_quantity !== null ? v.stock_quantity.toString() : '');
  };

  const handleSaveVariationEdit = async () => {
    if (!selectedProduct || !editingVariation) return;
    setUpdatingVariation(true);
    try {
      const updated = await updateProduct(
        selectedProduct.id,
        {
          regular_price: editVarPrice,
          sale_price: editVarSalePrice,
          stock_quantity: editVarStock ? parseInt(editVarStock, 10) : 0,
          meta_data: [
            {
              key: '_ppb_partner_price',
              value: editVarPartnerPrice,
            }
          ]
        },
        editingVariation.id
      );
      setVariations(prev => prev.map(v => v.id === editingVariation.id ? {
        ...v,
        price: editVarSalePrice || editVarPrice,
        regular_price: editVarPrice,
        sale_price: editVarSalePrice,
        partner_price: editVarPartnerPrice,
        stock_quantity: editVarStock ? parseInt(editVarStock, 10) : null
      } : v));
      setEditingVariation(null);
      Alert.alert('Succès', 'La variation a été mise à jour.');
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour cette variation.');
    } finally {
      setUpdatingVariation(false);
    }
  };

  // Icône dynamique par catégorie
  const getProductIcon = (prod: WCProduct) => {
    const cats = prod.categories.map(c => c.name.toLowerCase());
    if (cats.some(c => c.includes('office') || c.includes('microsoft') || c.includes('windows'))) {
      return 'key-outline';
    }
    if (cats.some(c => c.includes('sécurité') || c.includes('antivirus') || c.includes('kaspersky') || c.includes('vpn') || c.includes('surfshark'))) {
      return 'shield-checkmark-outline';
    }
    if (cats.some(c => c.includes('conception') || c.includes('adobe') || c.includes('autodesk') || c.includes('cad'))) {
      return 'brush-outline';
    }
    return 'cube-outline';
  };

  // Filtrage et recherche
  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (search.trim().length > 0) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (filter === 'instock') {
      result = result.filter(p => p.stock_status === 'instock');
    } else if (filter === 'outofstock') {
      result = result.filter(p => p.stock_status === 'outofstock');
    } else if (filter === 'lowstock') {
      result = result.filter(p => p.stock_quantity !== null && p.stock_quantity > 0 && p.stock_quantity <= 5 && p.stock_status !== 'outofstock');
    }
    return result;
  }, [products, search, filter]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Chargement du catalogue...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {/* Barre de recherche */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un produit ou SKU..."
        />

        {/* Chips Filtres de stock */}
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, filter === 'all' && styles.chipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, filter === 'instock' && styles.chipActive]}
            onPress={() => setFilter('instock')}
          >
            <Text style={[styles.chipText, filter === 'instock' && styles.chipTextActive]}>En Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, filter === 'lowstock' && styles.chipActive]}
            onPress={() => setFilter('lowstock')}
          >
            <Text style={[styles.chipText, filter === 'lowstock' && styles.chipTextActive]}>Stock faible</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, filter === 'outofstock' && styles.chipActive]}
            onPress={() => setFilter('outofstock')}
          >
            <Text style={[styles.chipText, filter === 'outofstock' && styles.chipTextActive]}>En rupture</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des produits */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const isVariable = item.type === 'variable';
            const isOut = item.stock_status === 'outofstock';
            const isLow = item.stock_quantity !== null && item.stock_quantity <= 5;
            
            return (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => handleProductSelect(item)}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={getProductIcon(item)} size={20} color={colors.primary} />
                </View>
                
                <View style={styles.infoCol}>
                  <View style={styles.catRow}>
                    <Text style={styles.catText}>{item.categories[0]?.name || 'Licence'}</Text>
                  </View>
                  <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                  {item.sku ? <Text style={styles.skuText}>SKU: {item.sku}</Text> : null}
                </View>

                <View style={styles.rightCol}>
                  {!isVariable ? (
                    <CurrencyText amount={item.price} size="sm" bold color={colors.textPrimary} />
                  ) : (
                    <Text style={[styles.priceText, { fontSize: 12, color: colors.primary }]}>Variable</Text>
                  )}
                  
                  {/* Badge de stock */}
                  {isVariable ? (
                    <View style={[styles.badge, styles.badgeVar]}>
                      <Text style={styles.badgeTextVar}>Options</Text>
                    </View>
                  ) : isOut ? (
                    <View style={[styles.badge, styles.badgeOut]}>
                      <Text style={styles.badgeTextOut}>En rupture</Text>
                    </View>
                  ) : isLow ? (
                    <View style={[styles.badge, styles.badgeLow]}>
                      <Text style={styles.badgeTextLow}>{item.stock_quantity} restants</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.badgeInStock]}>
                      <Text style={styles.badgeTextInStock}>En stock</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun produit ne correspond à ces critères</Text>
          }
        />
      </View>

      {/* Modal Fiche Produit détaillée */}
      <Modal
        visible={selectedProduct !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedProduct(null)}>
            <Pressable
              style={[
                styles.modalSheet,
                {
                  backgroundColor: colors.surface,
                  paddingBottom: Math.max(insets.bottom, 20)
                }
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedProduct?.name}</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedProduct(null)}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <ScrollView
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Catégorie</Text>
                  <Text style={styles.detailVal}>{selectedProduct.categories.map(c => c.name).join(', ') || 'Aucune'}</Text>
                </View>
                {selectedProduct.sku ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>SKU unique</Text>
                    <Text style={styles.detailVal}>{selectedProduct.sku}</Text>
                  </View>
                ) : null}
                {isEditing ? (
                  <View style={{ gap: 12, marginTop: 8 }}>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Quantité disponible (stock)</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editStock}
                        onChangeText={setEditStock}
                        placeholder="Ex: 10"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Prix standard (F)</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editPrice}
                        onChangeText={setEditPrice}
                        placeholder="Ex: 15000"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Prix promo (F - optionnel)</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editSalePrice}
                        onChangeText={setEditSalePrice}
                        placeholder="Laisser vide pour aucun prix promo"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Prix partenaire Pro (F - optionnel)</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editPartnerPrice}
                        onChangeText={setEditPartnerPrice}
                        placeholder="Laisser vide pour aucun prix partenaire"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.btnAction, { backgroundColor: colors.border, flex: 1 }]}
                        onPress={() => setIsEditing(false)}
                        disabled={updatingProduct}
                      >
                        <Text style={[styles.btnActionText, { color: colors.textSecondary }]}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnAction, { backgroundColor: colors.primary, flex: 1 }]}
                        onPress={handleSaveProductEdit}
                        disabled={updatingProduct}
                      >
                        {updatingProduct ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.btnActionText}>Enregistrer</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>État de stock</Text>
                      <Text style={[styles.detailVal, { color: selectedProduct.stock_status === 'instock' ? colors.success : colors.error }]}>
                        {selectedProduct.stock_status === 'instock' ? 'En stock' : 'Rupture de stock'}
                      </Text>
                    </View>
                    {selectedProduct.stock_quantity !== null && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quantité disponible</Text>
                        <Text style={styles.detailVal}>{selectedProduct.stock_quantity} clés</Text>
                      </View>
                    )}
                    {selectedProduct.type !== 'variable' && (
                      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 8, justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, backgroundColor: colors.surfaceElevated, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' }}>Prix public</Text>
                          <CurrencyText amount={selectedProduct.price} size="sm" bold />
                        </View>
                        {selectedProduct.partner_price ? (
                          <View style={{ flex: 1, backgroundColor: colors.surfaceElevated, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 10, color: colors.success, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' }}>Partenaire (Pro)</Text>
                            <CurrencyText amount={selectedProduct.partner_price} size="sm" bold color={colors.success} />
                          </View>
                        ) : null}
                      </View>
                    )}

                    
                    {selectedProduct.type !== 'variable' && (
                      <TouchableOpacity
                        style={[styles.btnAction, { backgroundColor: colors.primary + '15', marginTop: 12, borderWidth: 1.5, borderColor: colors.primary }]}
                        onPress={() => setIsEditing(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.btnActionText, { color: colors.primary }]}>✏️  Modifier le prix & stock</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {/* Section pour les variations de produits variables */}
                {selectedProduct.type === 'variable' && (
                  <View>
                    <Text style={styles.variationTitle}>Variations disponibles</Text>
                    {loadingVar ? (
                      <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
                    ) : variations.length > 0 ? (
                      variations.map((v) => (
                        <View key={v.id}>
                          <View style={styles.variationRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.variationName}>
                                {v.attributes.map(a => a.option).join(' · ')}
                              </Text>
                              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                                {v.stock_quantity !== null ? `${v.stock_quantity} en stock` : 'Stock non géré'}
                                {v.partner_price ? ` · Partner: ${v.partner_price} F` : ''}
                              </Text>
                            </View>
                            <CurrencyText amount={v.price} size="sm" bold color={colors.primary} />
                            <TouchableOpacity
                              onPress={() => editingVariation?.id === v.id ? setEditingVariation(null) : handleEditVariation(v)}
                              style={{ marginLeft: 8, padding: 4 }}
                            >
                              <Ionicons
                                name={editingVariation?.id === v.id ? 'close-circle-outline' : 'create-outline'}
                                size={18}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                          </View>

                          {/* Formulaire d'édition inline de la variation */}
                          {editingVariation?.id === v.id && (
                            <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, marginTop: 4, gap: 10, borderWidth: 1, borderColor: colors.primary + '44' }}>
                              <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Prix standard (F)</Text>
                                <TextInput
                                  style={styles.editInput}
                                  value={editVarPrice}
                                  onChangeText={setEditVarPrice}
                                  placeholder="Ex: 15000"
                                  placeholderTextColor={colors.textMuted}
                                  keyboardType="decimal-pad"
                                />
                              </View>
                              <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Prix promo (F - optionnel)</Text>
                                <TextInput
                                  style={styles.editInput}
                                  value={editVarSalePrice}
                                  onChangeText={setEditVarSalePrice}
                                  placeholder="Laisser vide pour aucun prix promo"
                                  placeholderTextColor={colors.textMuted}
                                  keyboardType="decimal-pad"
                                />
                              </View>
                              <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Prix partenaire Pro (F - optionnel)</Text>
                                <TextInput
                                  style={styles.editInput}
                                  value={editVarPartnerPrice}
                                  onChangeText={setEditVarPartnerPrice}
                                  placeholder="Laisser vide pour aucun prix partenaire"
                                  placeholderTextColor={colors.textMuted}
                                  keyboardType="decimal-pad"
                                />
                              </View>
                              <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Quantité en stock</Text>
                                <TextInput
                                  style={styles.editInput}
                                  value={editVarStock}
                                  onChangeText={setEditVarStock}
                                  placeholder="Ex: 10"
                                  placeholderTextColor={colors.textMuted}
                                  keyboardType="number-pad"
                                />
                              </View>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  style={[styles.btnAction, { backgroundColor: colors.border, flex: 1 }]}
                                  onPress={() => setEditingVariation(null)}
                                  disabled={updatingVariation}
                                >
                                  <Text style={[styles.btnActionText, { color: colors.textSecondary }]}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.btnAction, { backgroundColor: colors.primary, flex: 1 }]}
                                  onPress={handleSaveVariationEdit}
                                  disabled={updatingVariation}
                                >
                                  {updatingVariation
                                    ? <ActivityIndicator size="small" color="#FFF" />
                                    : <Text style={styles.btnActionText}>Enregistrer</Text>
                                  }
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Aucune option configurée</Text>
                    )}
                  </View>
                )}
                </ScrollView>
              )}
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
