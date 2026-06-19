# Changelog — Order Manager

Toutes les modifications notables sont documentées ici.
Format : [SemVer](https://semver.org/) · [Keep a Changelog](https://keepachangelog.com/)

---

## [1.4.1] — 2026-06-04

### Ajouté
- **Panel de Diagnostic Interactif** : écran Diagnostic enrichi avec l'historique du dernier envoi (réponse brute de l'API Expo) et un bouton "Tester les notifications" (déclenchant `POST /pom/v1/test-push` pour envoyer un push de test immédiat).
- **Vérification automatique** : actualisation automatique du log de diagnostic après l'envoi d'un push de test réussi.

### Modifié
- **Plugin WordPress** : version `1.2.0` de `pom-push-notifications.php` déployée. Envoie les notifications avec la priorité `'high'` et cible le canal `'presellia_urgent'` d'importance `AndroidImportance.MAX` pour forcer la sonnerie et l'alerte sur Android.

---

## [1.4.0] — 2026-06-04

### Ajouté
- **Notes de commande** : affichage et ajout de notes de commande dans l'écran de détail de commande.
- **Icon Premium** : nouvelle icône de marque et splash screen unifiés.
- **Champs personnalisés** : support des champs personnalisés de produits (plugin Advanced Product Fields).

### Corrigé
- **Chevauchement clavier/champs** : résolution du problème de masquage des formulaires lors de la saisie clavier (via KeyboardAvoidingView).
- **Barre système Android** : adaptation des marges en bas de l'écran pour éviter le conflit avec les touches de navigation physique du téléphone.

---

## [1.3.0] — 2026-05-02

### Ajouté
- **Logo** : icône app branded (sac ✓ blanc, cercle violet, fond sombre) — icon.png / adaptive-icon.png / splash-icon.png / favicon.png
- **Dashboard — Produits populaires** : section remplaçant "Stock faible" (inutile sur un catalogue 100% digital), affiche le top 5 des produits les plus vendus depuis les 50 dernières commandes
- **Dashboard — KPIs Koko Analytics** : 2 nouvelles cartes Visiteurs et Pages vues (données déjà récupérées depuis v1.1.0 mais non affichées)

### Corrigé
- **Notifications push** : fix complet — handler foreground (`setNotificationHandler`) manquant → notifs silencieuses ; canal Android 8+ créé avec son + vibration ; token enregistré au login et envoyé au plugin mu ; navigation vers commande au tap
- **Son notifications** : `shouldPlaySound: true` + canal Android avec `sound: 'default'`

### Technique
- `setupNotificationDisplayHandler()` doit être appelé AVANT tout listener (sinon iOS/Android ignore les notifications foreground)
- `initNotificationListeners()` retourne une fonction de nettoyage (pattern Expo recommandé)
- `bootstrapApp()` prend un callback `onOrderTap` pour router la navigation depuis les notifs

---

## [1.2.0] — 2026-05-02

### Ajouté
- **Cache produits 12 h** : catalogue entier chargé au démarrage (`fetchAllProducts()`, pagination 100/page), filtrage local immédiat dans le formulaire de commande — plus aucun appel réseau à la frappe
- **Clients récents** : 15 derniers clients affichés avant toute recherche (écrans Clients + Création commande), alimentés depuis les commandes récentes (cache 2 h)
- **Status picker libre** : bottom sheet dans le détail commande listant tous les statuts disponibles (standard + custom), remplace les boutons de transitions prédéfinis

### Corrigé
- **Produits tronqués** : suppression du `slice(0, 15)` + pagination complète — les 60+ produits sont tous accessibles
- **Clients introuvables** : `CUSTOMERS_PER_PAGE` 20 → 100 ; accélère la recherche serveur

### Technique
- Nouveau service `src/services/cache.ts` (cache TTL en mémoire)
- Nouveau `src/navigation/navigationRef.ts` (navigation externe depuis notifications)
- `ALL_ORDER_STATUSES` dans `constants.ts` — source unique pour le picker et les labels
- `OrderStatus` étendu pour accepter les statuts WC personnalisés `(string & {})`
- Bootstrap au démarrage : préchargement produits + enregistrement token push à la connexion

---

## [1.1.0] — 2026-04-16

### Ajouté
- **Mode jour/nuit** : toggle dans le header du Dashboard, persisté en AsyncStorage, appliqué à tous les écrans
- **Notifications push** : enregistrement du token Expo, réception en foreground/tap, stockage local AsyncStorage
- **Mise à jour OTA** : version dynamique dans le footer (depuis `APP_VERSION`)

### Modifié
- Phase 2 active (`USE_MOCK = false`) : connexion WooCommerce REST API réelle
- `CustomerDetailScreen` : historique commandes via `?customer=ID` côté serveur (plus de filtre client-side)
- `fetchTopProducts` : agrégation depuis les 50 dernières commandes (plus de `/reports/top_sellers`)
- `linkOrdersToCustomer` : fire-and-forget dans `CreateOrderScreen` et `CustomerDetailScreen`
- `app.json` : `userInterfaceStyle` passé en `automatic` (respect du thème système)
- `@context/ThemeContext` alias ajouté (tsconfig + babel)

### Corrigé
- Type hack `null as unknown as WCCustomer` supprimé dans `StepCustomer`
- Version footer `LoginScreen` : affiche `APP_VERSION` au lieu de `v1.0.0` hardcodé

---

## [1.0.0] — 2026-04-13

### Ajouté
- Application mobile React Native + Expo (web + Android depuis un seul codebase)
- Authentification via WP Application Password — pas de Jetpack requis
- **Dashboard** : KPIs (revenu, commandes, taux de conversion), filtre 5 périodes, 5 dernières commandes, bannière de mise à jour
- **Commandes** : liste groupée par date, recherche, filtres par statut, FAB "nouvelle commande"
- **Détail commande** : articles, client, paiement, transitions de statut, partage lien WhatsApp
- **Création commande** : flux 4 étapes (client → produits + remises → paiement → récap)
  - Support prix partenaire (PPB `/ppb/v1/products`)
  - Remise par ligne (% ou montant fixe)
  - Paiement hors ligne (Orange Money, Moov, Cash, Virement) ou lien de paiement
  - Fix bug WC : sync téléphone profil client après création
- **Clients** : recherche par nom/email/téléphone, fiche avec historique commandes
- **Notifications** : liste avec badge, marquage lu/non-lu, navigation vers commande
- **Mise à jour** : vérification GitHub API au démarrage, bannière + installation APK in-app
- Phase 1 complète : toute l'UI fonctionne avec mock data (`USE_MOCK = true`)
- Distribution : APK via GitHub Releases (pas d'App Store), GitHub Actions automatique sur tag `vX.X.X`

### Architecture
- `USE_MOCK` flag unique dans `constants.ts` — passage Phase 2 = changer un boolean
- Branding centralisé dans `branding.ts` — adaptable à n'importe quel business
- Path aliases TypeScript : `@modules`, `@services`, `@components`, `@config`, `@navigation`, `@types`
