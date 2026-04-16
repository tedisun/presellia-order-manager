# CLAUDE.md — Order Manager (Presellia)

## Identité du projet

App mobile interne **Tedisun SARL** pour gérer les commandes WooCommerce de `presellia.com`.
Remplace l'app WooCommerce officielle (qui requiert Jetpack et dégrade les performances du site).

- **Nom** : Order Manager — branding dans `src/config/branding.ts` (adaptable à d'autres clients)
- **Distribution** : APK via GitHub Releases — pas d'App Store, pas de Jetpack
- **Public** : équipe Tedisun uniquement (Rodrigue + agents commerciaux)

---

## Règles essentielles

### Phases de développement

```
USE_MOCK = true   → Phase 1 (données mock, UI validation sans API)
USE_MOCK = false  → Phase 2 (API réelle, credentials stockés dans SecureStore)
```

Le flag est dans `src/config/constants.ts`. **Ne jamais modifier la logique des services** — seul ce boolean change.

### Versioning — 2 points de synchronisation obligatoires

1. `app.json` → `version` (semver) + `versionCode` (format `yyyymmddHH`, ex: `2026041309`)
2. `CHANGELOG.md` → entrée `## [X.Y.Z] — YYYY-MM-DD`

**Release** = `git tag vX.Y.Z && git push origin vX.Y.Z` → GitHub Actions construit et publie l'APK.

### Architecture des modules

```
src/modules/<module>/
  screens/     ← composants de page (SafeAreaView en racine)
  components/  ← composants propres au module
  hooks/       ← custom hooks
  mock/        ← données mock (tree-shaken en prod)
```

Chaque fichier = une responsabilité. Pas de "barrel" `index.ts` sauf si > 3 exports.

### Ne jamais

- Importer `expo-secure-store` directement → utiliser `@services/storage`
- Appeler les endpoints WC directement → utiliser `@services/woocommerce`
- Hard-coder des couleurs/tailles → utiliser `BRANDING.colors.*` / `BRANDING.spacing.*`
- Modifier `consumer_key` / `consumer_secret` en clair dans le code
- Skipper `syncCustomerPhone()` après création de commande (bug WC téléphone)

---

## Services clés

| Service | Rôle |
|---|---|
| `@services/woocommerce` | Tous les appels WC REST API (mock + réel) |
| `@services/storage` | SecureStore wrapper + localStorage fallback web |
| `@services/github-updates` | Vérification mise à jour APK |
| `@modules/auth/hooks/useAuth` | Context auth + login/logout |

## Endpoints utilisés

- `GET  /wp-json/wc/v3/orders` — liste + filtres
- `GET  /wp-json/wc/v3/orders/:id` — détail
- `PUT  /wp-json/wc/v3/orders/:id` — changer statut
- `POST /wp-json/wc/v3/orders/:id/notes` — note interne
- `POST /wp-json/wc/v3/orders` — créer commande
- `GET  /wp-json/wc/v3/customers` — liste + recherche
- `PUT  /wp-json/wc/v3/customers/:id` — sync téléphone
- `GET  /wp-json/wc/v3/products` — catalogue
- `GET  /wp-json/ppb/v1/products` — prix partenaire (plugin PPB)
- `GET  /wp-json/wp/v2/users/me` — vérification credentials (login)
- `GET  https://api.github.com/repos/tedisun/presellia-order-manager/releases/latest`

## Lancer l'app

```bash
# Web (test immédiat)
npx expo start --web

# Android (Expo Go)
npx expo start
# Scanner le QR code avec Expo Go

# Build APK release
git tag v1.0.0 && git push origin v1.0.0
# → GitHub Actions déclenche EAS Build → APK publié sur GitHub Releases
```

## Variables d'environnement (secrets GitHub Actions)

- `EXPO_TOKEN` — compte expo.dev (gratuit), requis pour EAS Build

## Pièges connus

- `expo-secure-store` non disponible sur web → `storage.ts` détecte `Platform.OS` et bascule sur `localStorage`
- `expo-notifications` silencieux sur web → guard `Platform.OS !== 'web'` dans Phase 2
- WC `billing_phone` non synchronisé sur profil client après création manuelle → `syncCustomerPhone()` obligatoire
- `versionCode` Android doit croître strictement → format `yyyymmddHH`
- FlashList (Shopify) améliore les perfs sur grandes listes mais nécessite `getItemType` — utiliser `FlatList` en v1
- Avec `edgeToEdgeEnabled: true` (Android SDK 35), la tab bar empiète sur la zone système → **toujours** appliquer `useSafeAreaInsets()` sur les éléments positionnés en bas

---

## Pratiques de développement (apprises en session)

### Avant toute nouvelle feature ou redesign

1. **Audit du code existant en premier** — relire les écrans/services concernés, identifier les bugs avant de commencer. On ne redesigne pas du code cassé.
2. **Poser des questions si le cas d'usage n'est pas clair** — mieux vaut 2 min de discussion qu'une heure de code à refaire. Ex : "les commandes passent directement en Terminé sur paiement ?" évite de construire des alertes inutiles.
3. **Chercher l'inspiration UI avant de coder** — utiliser Playwright + Dribbble/Figma Community pour voir des patterns éprouvés. On ne réinvente pas la roue UX.

### Architecture & maintenabilité

4. **Une responsabilité par fichier** — service = `woocommerce.ts`, stockage = `storage.ts`, données mock = `ordersMock.ts`. Jamais de logique API dans un composant React.
5. **Filtrage local > appels API multiples** — charger `allOrders` une fois, filtrer en mémoire pour les tabs de statut. Plus rapide, moins de requêtes, UX instantané.
6. **Les données mock restent dans `src/modules/<module>/mock/`** — jamais dans les services, jamais dans les composants. Elles sont tree-shakées en prod.
7. **`BRANDING` est la seule source de vérité pour les styles** — couleur, taille, espacement, rayon. Zéro valeur inline sauf justification explicite.

### Mobile UX

8. **Toujours `useSafeAreaInsets()`** pour les éléments proches des bords physiques (tab bar, FAB, bottom sheets). Sur Android avec `edgeToEdgeEnabled: true`, la zone système empiète sinon.
9. **Les infos de contact sont des actions** — un numéro de téléphone déclenche `tel:`, un email déclenche `mailto:`, un lien de paiement déclenche `Share.share()`. Ne pas afficher des données sans les rendre exploitables.
10. **Statuts = couleurs + badges** — chaque statut WC a une couleur dans `BRANDING.colors.status`. Les tabs de filtre montrent les counts, les timelines montrent la progression. L'utilisateur ne lit pas, il scanne.
11. **Dropdowns discrets plutôt que des rangées de pills** — un bouton compact `📅 Mois ▾` + modal flottant prend moins de place et est plus professionnel qu'une rangée de chips. Pattern validé sur WooCommerce Admin.

### Sécurité & credentials

12. **WP Application Password** pour l'auth API, pas `consumer_key/secret` — unifié, révocable par l'admin WP, fonctionne sur toute l'API WC sans OAuth.
13. **Zéro credential en dur dans le code** — toujours `SecureStore` via `@services/storage`. Les credentials sont saisis à la connexion, jamais dans les fichiers.

### Collaboration avec les agents IA

14. **Lire les fichiers avant de les modifier** — un agent qui modifie sans lire introduit des régressions sur le code existant.
15. **Un bug diagnostiqué > un bug contourné** — identifier la cause racine (ex: `consumer_key` manquant dans le formulaire vs dans le service) plutôt que de patcher le symptôme.
16. **Les mocks doivent couvrir les cas limites** — client sans téléphone, client partenaire (rôle `partner`), nouvelle commande à 0 article, statut `on-hold` avec sa clé CSS `on-hold` vs `on_hold` dans les types.
17. **Ne pas hésiter à demander des informations supplémentaires** — si le comportement métier n'est pas évident (flux de paiement, rôles utilisateur, règles de statut), poser la question avant de décider d'une architecture. Une hypothèse incorrecte coûte bien plus qu'une question.
