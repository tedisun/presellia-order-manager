# Changelog — Order Manager

Toutes les modifications notables sont documentées ici.
Format : [SemVer](https://semver.org/) · [Keep a Changelog](https://keepachangelog.com/)

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
