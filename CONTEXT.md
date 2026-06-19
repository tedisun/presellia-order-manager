# CONTEXT.md — Décisions d'architecture

## Pourquoi cette app existe

L'app WooCommerce officielle requiert Jetpack. Jetpack exécute ~40 requêtes HTTP au chargement et est responsable d'une pénalité de performance de ~1s FCP sur presellia.com. Ce n'est pas acceptable pour un site e-commerce en Afrique de l'Ouest où les connexions mobiles sont lentes.

Solution : app interne APK distribuée via GitHub Releases, authentification via WP Application Password (natif WP depuis 5.6).

## Ce qu'on ne fait PAS

- **Pas de Jetpack** — c'est le but de l'app
- **Pas d'App Store** — Tedisun = équipe interne, distribution directe APK
- **Pas de PWA** — les notifications push ne fonctionnent pas bien sur Android sans app native ; SecureStore n'est pas disponible sur web
- **Pas de Zustand/Redux** — Context API suffisant pour la taille de cette app
- **Pas d'axios** — fetch natif + wrapper typé = 50KB économisés
- **Pas de React Query** — même raison, surcharge non justifiée

## Choix technologiques

| Décision | Raison |
|---|---|
| React Native + Expo | Web + Android, même codebase, `expo start --web` pour tester sans APK |
| React Navigation 7 (pas expo-router) | Contrôle total du auth-gate, structure modulaire par module |
| `USE_MOCK` flag | UI complète sans API disponible, migration Phase 2 = 1 ligne |
| Dark mode first | Cohérent WC app, confort journalier pour l'équipe |
| EAS Build "preview" → APK | Pas de signing store nécessaire pour distribution interne |
| GitHub Actions sur tag vX.X.X | Release automatisée sans intervention manuelle |
| n8n pour les push (Phase 2) | n8n déjà en prod chez Tedisun, zéro code serveur supplémentaire |

## Flux de paiement

Deux modes sur la même commande :

1. **Hors ligne** : commande créée en statut `processing`, méthode `offline`, métadonnée `_presellia_payment_detail` pour les stats (Orange Money, Moov, Cash...)
2. **Lien de paiement** : commande créée en statut `pending`, WooCommerce génère un `payment_url` natif → partage WhatsApp via `Share.share()`

Pas de gateway tiers, pas de webhook additionnel pour le cas hors ligne.

## Bug WooCommerce — téléphone client

Quand une commande est créée manuellement via API, WC enregistre le téléphone dans `billing` mais **ne le synchronise pas** sur le profil `wp_user`. Résultat : la prochaine commande du même client n'a plus de téléphone pré-rempli.

Fix : `syncCustomerPhone(customerId, phone)` appelle `PUT /wc/v3/customers/:id` après chaque création.

## Prix partenaire (PPB)

Les clients avec `role = 'partner'` ont accès à des prix réduits via le plugin PPB (Prix Partenaire Boutique). L'app détecte le rôle et appelle `/wp-json/ppb/v1/products` au lieu de `/wc/v3/products`. Le flag `partner_price` sur WCProduct indique le prix spécifique.

## Notifications push & Diagnostic (v1.2.0)

Architecture sans Jetpack :
1. L'application mobile enregistre le token FCM via `expo-notifications`.
2. Le token est envoyé à un mu-plugin WordPress (`pom-push-notifications.php`).
3. Le mu-plugin intercepte les événements de commande WooCommerce (checkout, REST insert, admin process, status change) et envoie les requêtes HTTP `POST` à l'API Expo (`exp.host/--/api/v2/push/send`) avec une priorité élevée (`'priority' => 'high'`) et un canal Android `'presellia_urgent'` à importance maximale (`MAX`) pour forcer la sonnerie et la bannière "heads-up".
4. Un système de diagnostic interactif est en place :
   - `/wp-json/pom/v1/status` (GET) : retourne l'état des tokens et le journal d'erreur/succès du dernier envoi Expo.
   - `/wp-json/pom/v1/test-push` (POST) : déclenche un push de test immédiat vers le téléphone connecté.
   - Journalisation : la réponse brute de l'API Expo (code HTTP + JSON de retour) est stockée dans l'option WordPress `_pom_last_push_log` pour consultation immédiate.

### Déploiement & Environnement Serveur
- **Emplacement du mu-plugin** : `/var/www/html/wp-content/mu-plugins/pom-push-notifications.php` (vérifié et déployé le 2026-06-04 à 20:11 UTC, taille 17136 octets).
- **Conteneur Docker WordPress** : `wordpress-k8okkkw88sgg8k4occow08cg` sur le serveur Coolify (`109.199.117.153`).
- **Passerelle de déploiement (SSH Tunnel)** : Le serveur Coolify n'expose pas directement le SSH au public ou via clé simplifiée pour les agents externes, mais partage le même mot de passe d'administration (`contaboSiegeAMaDr0ite`) que le serveur Mailcow VPS (`109.123.241.113`). On peut ainsi rebondir de Mailcow vers Coolify avec `sshpass` pour exécuter des commandes ou copier des fichiers dans le conteneur WordPress.

## Mise à jour in-app

`useUpdateChecker` interroge `api.github.com/repos/tedisun/presellia-order-manager/releases/latest` au démarrage. Si `tag_name` > `APP_VERSION` (comparaison semver), `UpdateBanner` s'affiche avec un bouton "Installer" qui ouvre l'URL APK via `Linking.openURL`.

## Monnaie

Tout est en XOF (FCFA, Franc CFA). `CurrencyText` formate avec `Intl.NumberFormat('fr-FR')` et affiche `{valeur} XOF`. Pas de décimales (les montants FCFA sont toujours entiers).
