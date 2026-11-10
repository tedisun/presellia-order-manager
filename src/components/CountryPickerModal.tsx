import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import { filterCountries, isStandardCountry, type CountryItem } from '@config/countries';

interface CountryPickerModalProps {
  visible: boolean;
  selectedCountry: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export default function CountryPickerModal({
  visible,
  selectedCountry,
  onSelect,
  onClose,
  title = 'Sélectionner un pays',
}: CountryPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  // Réinitialiser la recherche lorsque la modal s'ouvre
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  const filtered = useMemo(() => filterCountries(searchQuery), [searchQuery]);

  const isSelected = (item: CountryItem): boolean => {
    if (item.code === 'OTHER') {
      return !isStandardCountry(selectedCountry) && selectedCountry !== '';
    }
    return selectedCountry === item.code;
  };

  const handleSelect = (item: CountryItem) => {
    if (item.code === 'OTHER') {
      onSelect('');
    } else {
      onSelect(item.code);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16),
            },
          ]}
        >
          {/* Poignée supérieure */}
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

          {/* En-tête avec titre et bouton de fermeture */}
          <View style={styles.headerRow}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Barre de recherche */}
          <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher (ex: Congo, RDC, France...)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Liste des pays */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = isSelected(item);
              return (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    { borderBottomColor: colors.border },
                    selected && { backgroundColor: colors.primary + '10' },
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={[styles.countryName, { color: colors.textPrimary }]}>{item.name}</Text>
                  {item.code !== 'OTHER' && (
                    <View style={[styles.codeBadge, { backgroundColor: colors.border }]}>
                      <Text style={[styles.codeBadgeText, { color: colors.textSecondary }]}>{item.code}</Text>
                    </View>
                  )}
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="globe-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aucun pays trouvé</Text>
              </View>
            }
            style={styles.list}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: BRANDING.spacing.sm,
    paddingHorizontal: BRANDING.spacing.lg,
    maxHeight: '82%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: BRANDING.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: BRANDING.spacing.md,
  },
  modalTitle: {
    fontSize: BRANDING.fonts.sizeLG,
    fontWeight: BRANDING.fonts.weightBold,
  },
  closeBtn: {
    padding: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BRANDING.radius.md,
    paddingHorizontal: BRANDING.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginBottom: BRANDING.spacing.sm,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: BRANDING.fonts.sizeMD,
    paddingVertical: 4,
  },
  list: {
    maxHeight: 380,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: BRANDING.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  countryFlag: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  countryName: {
    fontSize: BRANDING.fonts.sizeMD,
    flex: 1,
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BRANDING.radius.sm,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: BRANDING.spacing.xl,
    gap: 8,
  },
  emptyText: {
    fontSize: BRANDING.fonts.sizeMD,
  },
});
