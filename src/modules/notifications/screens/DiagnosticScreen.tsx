import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRANDING } from '@config/branding';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import { logger, type LogEntry } from '@services/logger';
import { registerPushToken, checkPomStatus } from '@services/notifications';
import { Storage } from '@services/storage';

const LEVEL_COLOR = { info: '#4ade80', warn: '#facc15', error: '#f87171' };
const LEVEL_ICON  = { info: '●', warn: '▲', error: '✕' };

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe:        { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: 'row', alignItems: 'center', gap: BRANDING.spacing.md, paddingHorizontal: BRANDING.spacing.lg, paddingVertical: BRANDING.spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  title:       { flex: 1, fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  backBtn:     { padding: 4 },
  shareBtn:    { padding: 4 },
  section:     { backgroundColor: c.surface, borderRadius: BRANDING.radius.md, marginHorizontal: BRANDING.spacing.lg, marginTop: BRANDING.spacing.md, padding: BRANDING.spacing.md, borderWidth: 1, borderColor: c.border, gap: BRANDING.spacing.sm },
  sectionTitle:{ fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:       { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary },
  value:       { fontSize: BRANDING.fonts.sizeSM, color: c.textPrimary, fontWeight: BRANDING.fonts.weightMedium, flex: 1, textAlign: 'right' },
  statusOk:    { color: '#4ade80', fontWeight: BRANDING.fonts.weightBold },
  statusErr:   { color: '#f87171', fontWeight: BRANDING.fonts.weightBold },
  statusWarn:  { color: '#facc15', fontWeight: BRANDING.fonts.weightBold },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary + '22', borderRadius: BRANDING.radius.sm, paddingVertical: BRANDING.spacing.sm, paddingHorizontal: BRANDING.spacing.md, alignSelf: 'flex-start' },
  actionText:  { fontSize: BRANDING.fonts.sizeSM, color: c.primary, fontWeight: BRANDING.fonts.weightSemiBold },
  logRow:      { flexDirection: 'row', gap: 6, paddingVertical: 3 },
  logIcon:     { fontSize: 10, lineHeight: 16, width: 12, textAlign: 'center' },
  logTag:      { fontSize: 10, color: c.textMuted, width: 44, lineHeight: 16 },
  logTs:       { fontSize: 10, color: c.textMuted, lineHeight: 16, marginRight: 4 },
  logMsg:      { flex: 1, fontSize: 10, color: c.textSecondary, lineHeight: 14 },
  clearBtn:    { fontSize: BRANDING.fonts.sizeXS, color: c.error, padding: 4 },
  logHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

interface PomStatus {
  reachable: boolean;
  registered: boolean;
  token_count?: number;
  error?: string;
}

export default function DiagnosticScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();

  const [pushToken, setPushToken]   = useState<string | null>(null);
  const [storeUrl, setStoreUrl]     = useState<string>('—');
  const [pomStatus, setPomStatus]   = useState<PomStatus | null>(null);
  const [checkingPom, setCheckingPom] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [logs, setLogs]             = useState<LogEntry[]>(logger.getEntries());

  // Charger infos au mount
  useEffect(() => {
    Storage.getCredentials().then((c) => {
      setStoreUrl(c?.store_url ?? '—');
    });
    Storage.getPushToken?.().then?.(setPushToken).catch(() => null);
  }, []);

  // Sync logs en temps réel
  useEffect(() => {
    const unsub = logger.subscribe(() => setLogs([...logger.getEntries()]));
    return unsub;
  }, []);

  const checkPom = useCallback(async () => {
    setCheckingPom(true);
    const status = await checkPomStatus();
    setPomStatus(status);
    setCheckingPom(false);
  }, []);

  const handleReRegister = useCallback(async () => {
    setRegistering(true);
    logger.info('diag', 'Réenregistrement du token push demandé');
    await registerPushToken();
    const token = await Storage.getPushToken?.().catch(() => null);
    setPushToken(token ?? null);
    setRegistering(false);
    checkPom();
  }, [checkPom]);

  const handleShareLogs = useCallback(() => {
    const text = logs
      .slice(0, 100)
      .map((e) => `[${e.ts.slice(11, 19)}] ${e.level.toUpperCase()} [${e.tag}] ${e.msg}`)
      .join('\n');
    Share.share({ message: `--- Diagnostic Presellia Orders ---\n${text}` });
  }, [logs]);

  const formatToken = (t: string | null) => {
    if (!t) return 'Non enregistré';
    return `${t.slice(0, 30)}…`;
  };

  const pomOk = pomStatus?.reachable && pomStatus?.registered;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Diagnostic</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareLogs}>
          <Ionicons name="share-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: BRANDING.spacing.xl }}>
        {/* ── Infos app ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environnement</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Plateforme</Text>
            <Text style={styles.value}>{Platform.OS} {Platform.Version}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Store URL</Text>
            <Text style={styles.value} numberOfLines={1}>{storeUrl}</Text>
          </View>
        </View>

        {/* ── Push token ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Token</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Token Expo</Text>
            <Text
              style={[styles.value, pushToken ? styles.statusOk : styles.statusErr]}
              numberOfLines={1}
            >
              {formatToken(pushToken)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, registering && { opacity: 0.6 }]}
            onPress={handleReRegister}
            disabled={registering}
          >
            {registering
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            }
            <Text style={styles.actionText}>
              {registering ? 'En cours…' : 'Réenregistrer le token'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Mu-plugin POM ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mu-plugin WordPress (pom/v1)</Text>

          {pomStatus === null ? (
            <TouchableOpacity
              style={[styles.actionBtn, checkingPom && { opacity: 0.6 }]}
              onPress={checkPom}
              disabled={checkingPom}
            >
              {checkingPom
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="wifi-outline" size={14} color={colors.primary} />
              }
              <Text style={styles.actionText}>{checkingPom ? 'Vérification…' : 'Vérifier le plugin'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Endpoint /pom/v1</Text>
                <Text style={pomStatus.reachable ? styles.statusOk : styles.statusErr}>
                  {pomStatus.reachable ? '✓ Actif' : '✕ Inactif'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Token enregistré</Text>
                <Text style={pomStatus.registered ? styles.statusOk : styles.statusWarn}>
                  {pomStatus.registered ? '✓ Oui' : '⚠ Non'}
                </Text>
              </View>
              {pomStatus.token_count !== undefined && (
                <View style={styles.row}>
                  <Text style={styles.label}>Tokens actifs</Text>
                  <Text style={styles.value}>{pomStatus.token_count}</Text>
                </View>
              )}
              {pomStatus.error && (
                <Text style={[styles.value, styles.statusErr, { textAlign: 'left' }]}>
                  Erreur : {pomStatus.error}
                </Text>
              )}

              {!pomStatus.reachable && (
                <Text style={[styles.label, { lineHeight: 18, marginTop: 4 }]}>
                  Le mu-plugin n'est pas installé. Déployez{' '}
                  <Text style={{ color: colors.primary }}>pom-push-notifications.php</Text>
                  {' '}dans wp-content/mu-plugins/
                </Text>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, checkingPom && { opacity: 0.6 }]}
                onPress={checkPom}
                disabled={checkingPom}
              >
                <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                <Text style={styles.actionText}>Revérifier</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Logs en temps réel ── */}
        <View style={[styles.section, { gap: 2 }]}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Logs ({logs.length})</Text>
            <TouchableOpacity onPress={() => logger.clear()}>
              <Text style={styles.clearBtn}>Effacer</Text>
            </TouchableOpacity>
          </View>
          {logs.length === 0 && (
            <Text style={styles.label}>Aucun log pour l'instant.</Text>
          )}
          {logs.slice(0, 80).map((entry, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={[styles.logIcon, { color: LEVEL_COLOR[entry.level] }]}>
                {LEVEL_ICON[entry.level]}
              </Text>
              <Text style={styles.logTs}>{entry.ts.slice(11, 19)}</Text>
              <Text style={styles.logTag}>[{entry.tag}]</Text>
              <Text style={styles.logMsg}>{entry.msg}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
