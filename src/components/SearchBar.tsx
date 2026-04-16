import React, { useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

const makeStyles = (c: BrandColors) => StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: BRANDING.radius.md,
    borderWidth: 1, borderColor: c.border,
    paddingHorizontal: BRANDING.spacing.md,
    height: 44, gap: 8,
  },
  input:     { flex: 1, color: c.textPrimary, fontSize: BRANDING.fonts.sizeMD, paddingVertical: 0 },
  clearIcon: { fontSize: 12, color: c.textMuted },
  icon:      { fontSize: 16 },
  clearBtn:  { padding: 4 },
});

export default function SearchBar({ value, onChangeText, placeholder = 'Rechercher…', onClear }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);

  const handleClear = () => { onChangeText(''); onClear?.(); inputRef.current?.focus(); };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        ref={inputRef} style={styles.input} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={colors.textMuted}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
