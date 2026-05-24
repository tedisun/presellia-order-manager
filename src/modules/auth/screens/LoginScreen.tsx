import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  header:          { alignItems: 'center', marginBottom: BRANDING.spacing.lg },
  logoContainer:   { alignItems: 'center', marginBottom: BRANDING.spacing.md },
  logoCircle:      { width: 90, height: 90, borderRadius: 45, backgroundColor: c.primary + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F59E0B', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
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
  wpBtn:           { backgroundColor: c.primary, borderRadius: BRANDING.radius.md, paddingVertical: BRANDING.spacing.md, alignItems: 'center', marginTop: BRANDING.spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: c.primaryDark, shadowColor: c.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  wpBtnText:       { color: '#FFF', fontSize: BRANDING.fonts.sizeLG, fontWeight: BRANDING.fonts.weightSemiBold },
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
    wp_username:      '',
    wp_app_password:  '',
  });

  const [showPasswords, setShowPasswords] = useState(false);

  // Support du Flux d'Autorisation WordPress automatique
  React.useEffect(() => {
    const getParam = (urlStr: string, paramName: string) => {
      const regex = new RegExp('[?&]' + paramName + '=([^&#]*)');
      const results = regex.exec(urlStr);
      return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : null;
    };

    const parseAndLogin = async (url: string) => {
      if (!url || !url.startsWith('presellia-orders://auth')) return;
      
      const wp_username = getParam(url, 'user_login');
      const wp_app_password = getParam(url, 'password');
      const store_url = getParam(url, 'siteurl');

      if (wp_username && wp_app_password && store_url) {
        setForm((f) => ({
          ...f,
          store_url: store_url,
          wp_username: wp_username,
          wp_app_password: wp_app_password,
        }));
        
        login({
          store_url,
          wp_username,
          wp_app_password,
          consumer_key: '',
          consumer_secret: '',
        });
      }
    };

    const handleDeepLink = (event: { url: string }) => {
      parseAndLogin(event.url);
    };

    // Vérifier l'URL de démarrage
    Linking.getInitialURL().then((url) => {
      if (url) parseAndLogin(url);
    });

    // Écouter les liens entrants
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [login]);

  const handleChange = (field: keyof WCCredentials, value: string) => {
    setForm((f) => ({ ...f, [field]: value.trim() }));
  };

  const handleLogin = () => {
    login(form);
  };

  const handleWordPressAuthFlow = () => {
    if (!form.store_url) {
      Alert.alert('URL requise', 'Veuillez saisir l\'URL de votre boutique Presellia (ex: https://presellia.com) pour lancer la connexion automatique.');
      return;
    }
    if (!form.store_url.startsWith('https://')) {
      Alert.alert('Erreur', 'Veuillez saisir une URL valide commençant par https://');
      return;
    }
    const cleanUrl = form.store_url.replace(/\/$/, ''); // enlever le slash de fin
    
    // Pour Presellia, le slug admin sécurisé et renommé est "superu".
    // On redirige vers superu avec un redirect_to pointant vers l'autorisation,
    // ce qui force l'utilisateur à se connecter via superu s'il n'est pas connecté,
    // puis WordPress le redirigera vers l'écran d'autorisation standard !
    const redirectUrl = `${cleanUrl}/wp-admin/authorize-application.php?app_name=Presellia Orders&success_url=presellia-orders://auth`;
    const authUrl = `${cleanUrl}/superu?redirect_to=${encodeURIComponent(redirectUrl)}`;
    
    Linking.openURL(authUrl).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir le navigateur.");
    });
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
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="key" size={40} color="#F59E0B" />
              </View>
            </View>
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

            <TouchableOpacity
              style={[styles.wpBtn, !form.store_url.startsWith('https://') && styles.loginBtnDisabled]}
              onPress={handleWordPressAuthFlow}
              disabled={!form.store_url.startsWith('https://') || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.wpBtnText}>🔑  Connexion WordPress</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: BRANDING.spacing.md }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ marginHorizontal: 10, color: colors.textMuted, fontSize: BRANDING.fonts.sizeXS }}>OU SAISIE MANUELLE</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: BRANDING.spacing.xs }]}>
              Identifiants WordPress
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nom d'utilisateur ou E-mail</Text>
              <TextInput
                style={styles.input}
                value={form.wp_username}
                onChangeText={(v) => handleChange('wp_username', v)}
                placeholder="Ex: admin ou contact@presellia.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe WordPress</Text>
              <TextInput
                style={styles.input}
                value={form.wp_app_password}
                onChangeText={(v) => handleChange('wp_app_password', v)}
                placeholder="Saisissez votre mot de passe standard"
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
                {showPasswords ? '🙈 Masquer' : '👁 Afficher le mot de passe'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Saisissez vos identifiants de connexion WordPress habituels.{"\n"}
              L'application s'occupe de s'authentifier de manière sécurisée.
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

