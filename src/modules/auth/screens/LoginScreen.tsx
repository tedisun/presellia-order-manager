import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRANDING } from '@config/branding';
import { APP_VERSION } from '@config/constants';
import { useTheme } from '@context/ThemeContext';
import type { BrandColors } from '@config/themes';
import { useAuth } from '../hooks/useAuth';
import type { WCCredentials } from '@app-types/woocommerce';

const makeStyles = (c: BrandColors) => StyleSheet.create({
  safe:            { flex: 1, backgroundColor: c.background },
  flex:            { flex: 1 },
  container:       { flexGrow: 1, padding: BRANDING.spacing.xl, justifyContent: 'center' },
  header:          { alignItems: 'center', marginBottom: BRANDING.spacing.xxl },
  logo:            { fontSize: 56, marginBottom: BRANDING.spacing.sm },
  appName:         { fontSize: BRANDING.fonts.sizeXXL, fontWeight: BRANDING.fonts.weightBold, color: c.textPrimary },
  businessName:    { fontSize: BRANDING.fonts.sizeMD, color: c.primary, marginTop: BRANDING.spacing.xs },
  form:            { backgroundColor: c.surface, borderRadius: BRANDING.radius.lg, padding: BRANDING.spacing.xl, borderWidth: 1, borderColor: c.border },
  sectionLabel:    { fontSize: BRANDING.fonts.sizeXS, fontWeight: BRANDING.fonts.weightSemiBold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: BRANDING.spacing.sm },
  field:           { marginBottom: BRANDING.spacing.md },
  label:           { fontSize: BRANDING.fonts.sizeSM, color: c.textSecondary, marginBottom: BRANDING.spacing.xs },
  input:           { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: BRANDING.radius.md, paddingHorizontal: BRANDING.spacing.md, paddingVertical: BRANDING.spacing.sm + 2, color: c.textPrimary, fontSize: BRANDING.fonts.sizeMD },
  showPasswordsBtn:{ alignSelf: 'flex-start', marginBottom: BRANDING.spacing.sm },
  showPasswordsText:{ fontSize: BRANDING.fonts.sizeSM, color: c.primary },
  hint:            { fontSize: BRANDING.fonts.sizeXS, color: c.textMuted, lineHeight: 16, marginBottom: BRANDING.spacing.lg },
  errorBox:        { backgroundColor: c.error + '22', borderRadius: BRANDING.radius.sm, padding: BRANDING.spacing.sm, marginBottom: BRANDING.spacing.md, borderWidth: 1, borderColor: c.error + '55' },
  errorText:       { color: c.error, fontSize: BRANDING.fonts.sizeSM },
  loginBtn:        { backgroundColor: c.primary, borderRadius: BRANDING.radius.md, paddingVertical: BRANDING.spacing.md, alignItems: 'center', marginTop: BRANDING.spacing.sm },
  loginBtnDisabled:{ opacity: 0.5 },
  loginBtnText:    { color: '#FFF', fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightSemiBold },
  footer:          { textAlign: 'center', color: c.textMuted, fontSize: BRANDING.fonts.sizeXS, marginTop: BRANDING.spacing.xl },
});

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { login, isLoading, error } = useAuth();

  const [form, setForm] = useState<WCCredentials>({
    store_url:        'https://presellia.com',
    consumer_key:     '',
    consumer_secret:  '',
    wp_username:      'aipilot',
    wp_app_password:  '',
  });

  const [showPasswords, setShowPasswords] = useState(false);

  const handleChange = (field: keyof WCCredentials, value: string) => {
    setForm((f) => ({ ...f, [field]: value.trim() }));
  };

  const handleLogin = () => {
    login(form);
  };

  const isFormValid =
    form.store_url.startsWith('https://') &&
    form.wp_username.length > 0 &&
    form.wp_app_password.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Logo / En-tête */}
          <View style={styles.header}>
            <Text style={styles.logo}>📦</Text>
            <Text style={styles.appName}>{BRANDING.appName}</Text>
            <Text style={styles.businessName}>{BRANDING.businessName}</Text>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Boutique</Text>

            <View style={styles.field}>
              <Text style={styles.label}>URL de la boutique</Text>
              <TextInput
                style={styles.input}
                value={form.store_url}
                onChangeText={(v) => handleChange('store_url', v)}
                placeholder="https://votre-boutique.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: BRANDING.spacing.lg }]}>
              Identifiants WordPress
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nom d'utilisateur</Text>
              <TextInput
                style={styles.input}
                value={form.wp_username}
                onChangeText={(v) => handleChange('wp_username', v)}
                placeholder="aipilot"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe d'application</Text>
              <TextInput
                style={styles.input}
                value={form.wp_app_password}
                onChangeText={(v) => handleChange('wp_app_password', v)}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPasswords}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={styles.showPasswordsBtn}
              onPress={() => setShowPasswords((v) => !v)}
            >
              <Text style={styles.showPasswordsText}>
                {showPasswords ? '🙈 Masquer' : '👁 Afficher les mots de passe'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Créez un mot de passe d'application dans{'\n'}
              WP Admin → Utilisateurs → Votre profil → Mots de passe d'application
            </Text>

            {/* Erreur */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            {/* Bouton connexion */}
            <TouchableOpacity
              style={[styles.loginBtn, (!isFormValid || isLoading) && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Se connecter</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>Tedisun SARL · {BRANDING.appName} v{APP_VERSION}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

