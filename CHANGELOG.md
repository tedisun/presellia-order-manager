# Changelog — Order Manager

Toutes les modifications notables sont documentées ici.
Format : [SemVer](https://semver.org/) · [Keep a Changelog](https://keepachangelog.com/)

---

## [1.4.6] — 2026-07-22

### Corrigé
- **Verrous Anti-Double-Clic / Anti-Doublons** : implémentation systématique de verrous synchrones (`useRef`) sur tous les boutons d'actions asynchrones critiques de l'application. Empêche de manière définitive la création de commandes doublées (WooCommerce), les doublons de création de clients (résout l'erreur 400 intermittente), les doublons de promotion de comptes et les doublons d'ajout de notes de commandes en cas d'appuis répétés rapides.

---

## [1.4.5] — 2026-07-15

### Modifié
- **Formatage WhatsApp robuste (wa.me)** : refonte globale de la logique de nettoyage des numéros de téléphone via la fonction centralisée `cleanPhoneForWhatsApp` dans `constants.ts`. Gère et corrige automatiquement les préfixes internationaux `00` (ex: `00237...`), supprime les caractères inutiles et conserve l'intégration historique du code pays local par défaut.

---

## [1.4.4] — 2026-07-15

### Ajouté
- **Cache persistant Offline-First** : conservation du cache local des commandes, clients et produits au-delà de la date d'expiration pour servir de repli en mode hors-ligne.
- **Affichage instantané des commandes** : pré-chargement immédiat du détail d'une commande via le cache local avec mise à jour silencieuse en arrière-plan (Stale-While-Revalidate).
- **Calcul de Taux de Conversion local** : calcul dynamique local en cas d'indisponibilité ou d'erreur sur l'API Koko Analytics.
- **Logs Koko Analytics** : journalisation détaillée des erreurs de requêtes de statistiques visiteurs dans le panneau de diagnostic.

---

## [1.4.3] — 2026-07-15

### Ajouté
- **Système de Diagnostic API et Logs persistants** : capture automatique de tous les échecs et codes de retour d'erreur de l'API WooCommerce (ex: erreur 400, e-mail existant, mauvais format de pays) directement dans le journal de logs persistant (`logger.ts`).
- **Export des logs via Diagnostic** : possibilité pour les agents d'ouvrir l'écran de Diagnostic (depuis l'onglet Notifications), de visualiser l'historique détaillé des requêtes échouées et d'exporter/partager la trace sous forme de fichier texte en un clic (par email, WhatsApp, etc.).

---

## [1.4.2] — 2026-07-06

### Ajouté
- **Bouton d'envoi WhatsApp direct** : bouton vert côte à côte dans le détail des commandes pour envoyer des messages de paiement pré-remplis directement via WhatsApp (`wa.me`).
- **Actions rapides Recherche client** : ajout d'icônes tactiles indépendantes d'appel et de discussion WhatsApp directement dans chaque ligne de résultat de la recherche client.
- **Action WhatsApp dans la fiche contact** : bouton WhatsApp dédié dans la section contact de la fiche client.
- **Sélecteur de pays (Dropdown)** : modal de sélection bottom sheet pour choisir parmi les pays de la région (Burkina Faso, Côte d'Ivoire, Sénégal, Togo, Bénin, Mali, Niger, Guinée, France) avec champ de saisie de repli pour les codes ISO personnalisés.

### Optimisé
- **Performances de chargement du catalogue** : parallélisation du chargement des pages produits via `Promise.all` après lecture de l'en-tête `x-wp-totalpages` de la première page. Réduit le temps de chargement de 60-70%.
- **Transition de période du tableau de bord** : introduction de l'état `loadedPeriod` affichant de discrets indicateurs de chargement locaux (spinners) au cœur des cartes KPI et graphiques lors du changement de période (évite l'affichage de valeurs incorrectes ou de zéros temporaires).

### Corrigé
- **Filet de sécurité étendu** : détection de l'état modifié (dirty) des formulaires nouveaux clients et d'édition de client pour empêcher toute perte accidentelle de données lors de la création d'une commande.

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
