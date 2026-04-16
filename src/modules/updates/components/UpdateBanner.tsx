import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import type { UpdateInfo } from '@services/github-updates';

interface Props { info: UpdateInfo; onDismiss: () => void; }

const makeStyles = (c: BrandColors) => StyleSheet.create({
  banner:      { backgroundColor: c.primary + '22', borderWidth: 1, borderColor: c.primary + '55', borderRadius: BRANDING.radius.md, padding: BRANDING.spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: BRANDING.spacing.md, gap: BRANDING.spacing.sm },
  textCol:     { flex: 1 },
  title:       { color: c.textPrimary, fontSize: BRANDING.fonts.sizeSM, fontWeight: BRANDING.fonts.weightSemiBold },
  subtitle:    { color: c.textSecondary, fontSize: BRANDING.fonts.sizeXS, marginTop: 2 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  installBtn:  { backgroundColor: c.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BRANDING.radius.sm },
  installText: { color: '#FFF', fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightSemiBold },
  dismissBtn:  { padding: 4 },
  dismissText: { color: c.textMuted, fontSize: 13 },
});

export default function UpdateBanner({ info, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const handleInstall = () => Linking.openURL(info.apkDownloadUrl ?? info.releaseUrl);

  return (
    <View style={styles.banner}>
      <View style={styles.textCol}>
        <Text style={styles.title}>🚀 Mise à jour disponible</Text>
        <Text style={styles.subtitle}>v{info.latestVersion} est disponible (actuellement v{info.currentVersion})</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.installBtn} onPress={handleInstall}>
          <Text style={styles.installText}>Installer</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
