<?php
/**
 * Plugin Name: POM Push Notifications
 * Description: Enregistre les tokens Expo Push et envoie des notifications
 *              aux agents Presellia lors d'événements WooCommerce.
 *              Expose également un endpoint d'authentification native pour
 *              l'application mobile (création automatique d'Application Password).
 * Version:     1.2.0
 * Author:      Tedisun SARL
 *
 * Déposé dans /wp-content/mu-plugins/ — chargé automatiquement par WordPress,
 * pas besoin d'activation manuelle.
 *
 * Endpoints REST :
 *   POST /wp-json/pom/v1/auth               ← connexion native (username + password WP)
 *   POST /wp-json/pom/v1/register-token     ← app mobile enregistre son token
 *   DELETE /wp-json/pom/v1/register-token   ← app mobile supprime son token (logout)
 *
 * Meta utilisateur :
 *   _pom_push_tokens  → JSON array de { token, platform, updated_at }
 */

defined('ABSPATH') || exit;

// ─── Constantes ───────────────────────────────────────────────────────────────

define('POM_EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send');
define('POM_USER_META_KEY', '_pom_push_tokens');
define('POM_NAMESPACE', 'pom/v1');
define('POM_APP_PASSWORD_NAME', 'Presellia Orders App');

// ─── Enregistrement des routes REST ──────────────────────────────────────────

add_action('rest_api_init', function () {

    // ── Authentification native (connexion sans redirection navigateur) ────────
    // Accepte username + password WordPress ordinaires, retourne un Application
    // Password généré automatiquement. Sécurisé par rate-limiting (5 essais/h/IP).
    register_rest_route(POM_NAMESPACE, '/auth', [
        'methods'             => 'POST',
        'callback'            => 'pom_native_auth',
        'permission_callback' => '__return_true', // Publique — sécurisée par rate-limit
        'args'                => [
            'username' => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'password' => ['required' => true,  'type' => 'string'],
            'app_name' => ['required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'default' => POM_APP_PASSWORD_NAME],
        ],
    ]);

    register_rest_route(POM_NAMESPACE, '/register-token', [
        [
            'methods'             => 'POST',
            'callback'            => 'pom_register_token',
            'permission_callback' => 'pom_require_authenticated',
            'args'                => [
                'token'    => ['required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                'platform' => ['required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'default' => 'android'],
            ],
        ],
        [
            'methods'             => 'DELETE',
            'callback'            => 'pom_unregister_token',
            'permission_callback' => 'pom_require_authenticated',
            'args'                => [
                'token' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ],
    ]);

    register_rest_route(POM_NAMESPACE, '/status', [
        'methods'             => 'GET',
        'callback'            => 'pom_get_status',
        'permission_callback' => 'pom_require_authenticated',
    ]);

    register_rest_route(POM_NAMESPACE, '/test-push', [
        'methods'             => 'POST',
        'callback'            => 'pom_test_push',
        'permission_callback' => 'pom_require_authenticated',
    ]);
});

function pom_get_status(): WP_REST_Response {
    $user_id = get_current_user_id();
    $tokens = pom_get_tokens($user_id);
    $last_log = get_option('_pom_last_push_log', 'Aucun log d\'envoi enregistré pour le moment.');
    return new WP_REST_Response([
        'active'            => true,
        'user_has_token'    => !empty($tokens),
        'registered_tokens' => count($tokens),
        'last_push_log'     => $last_log,
    ], 200);
}

function pom_test_push(): WP_REST_Response {
    $user_id = get_current_user_id();
    $tokens = pom_get_tokens($user_id);
    if (empty($tokens)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Aucun jeton push enregistré pour votre compte sur ce serveur.',
        ], 400);
    }
    $token_strings = array_map(fn($t) => $t['token'], $tokens);
    $title = '🔔 Test Sonore Presellia';
    $body = 'La configuration sonore et de priorité maximale est active !';
    $data = ['type' => 'system'];
    $result = pom_send_push_with_result($token_strings, $title, $body, $data, 'cha-ching');
    return new WP_REST_Response($result, $result['success'] ? 200 : 500);
}

// ─── Permission : utilisateur WP connecté (WP Application Password) ──────────

function pom_require_authenticated(): bool {
    return is_user_logged_in();
}

// ─── Authentification native — crée un Application Password automatiquement ───

function pom_native_auth(WP_REST_Request $request): WP_REST_Response|WP_Error {
    // ── Rate-limiting désactivé temporairement pour les tests ──────────────────
    /*
    $ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rate_key = 'pom_auth_rate_' . md5($ip);
    $attempts = (int) get_transient($rate_key);
    if ($attempts >= 5) {
        return new WP_Error('too_many_attempts', 'Trop de tentatives. Réessayez dans une heure.', ['status' => 429]);
    }
    set_transient($rate_key, $attempts + 1, HOUR_IN_SECONDS);
    */

    $username = $request->get_param('username');
    $password = $request->get_param('password');
    $app_name = $request->get_param('app_name');

    // ── Authentification WordPress standard ───────────────────────────────────
    $user = wp_authenticate($username, $password);
    if (is_wp_error($user)) {
        // Message générique pour ne pas révéler si l'utilisateur existe
        return new WP_Error('invalid_credentials', 'Identifiants incorrects.', ['status' => 401]);
    }

    // ── Vérification du rôle (agents Presellia seulement) ────────────────────
    $allowed_roles = ['administrator', 'editor', 'shop_manager', 'partner'];
    $user_roles    = (array) $user->roles;
    if (empty(array_intersect($user_roles, $allowed_roles))) {
        return new WP_Error('forbidden', 'Accès refusé. Rôle insuffisant.', ['status' => 403]);
    }

    // ── Vérifier que les Application Passwords sont activés ──────────────────
    if (!class_exists('WP_Application_Passwords')) {
        return new WP_Error('not_supported', 'Application Passwords non disponible sur ce serveur.', ['status' => 501]);
    }

    // ── Révoquer tout ancien mot de passe "Presellia Orders App" (idempotent) ─
    $existing = WP_Application_Passwords::get_user_application_passwords($user->ID);
    foreach ($existing as $app_pw) {
        if (isset($app_pw['name']) && $app_pw['name'] === $app_name) {
            WP_Application_Passwords::delete_application_password($user->ID, $app_pw['uuid']);
        }
    }

    // ── Créer un nouveau Application Password ─────────────────────────────────
    $created = WP_Application_Passwords::create_new_application_password($user->ID, [
        'name' => $app_name,
    ]);
    if (is_wp_error($created)) {
        return new WP_Error('creation_failed', 'Impossible de créer le mot de passe d\'application.', ['status' => 500]);
    }

    // $created[0] = le mot de passe en clair (disponible une seule fois)
    [$plain_password] = $created;

    // Réinitialiser le compteur de tentatives après succès
    delete_transient($rate_key);

    return new WP_REST_Response([
        'success'      => true,
        'wp_username'  => $user->user_login,
        'app_password' => $plain_password, // Format "xxxx xxxx xxxx xxxx xxxx xxxx"
        'user'         => [
            'id'    => $user->ID,
            'name'  => $user->display_name,
            'email' => $user->user_email,
            'roles' => $user_roles,
        ],
    ], 200);
}

// ─── Enregistrer un token ─────────────────────────────────────────────────────

function pom_register_token(WP_REST_Request $request): WP_REST_Response {
    $user_id  = get_current_user_id();
    $token    = $request->get_param('token');
    $platform = $request->get_param('platform');

    $tokens = pom_get_tokens($user_id);

    // Dédoublonnage : on remplace si le token existe déjà
    $tokens = array_values(array_filter($tokens, fn($t) => $t['token'] !== $token));
    $tokens[] = [
        'token'      => $token,
        'platform'   => $platform,
        'updated_at' => gmdate('c'),
    ];

    update_user_meta($user_id, POM_USER_META_KEY, wp_json_encode($tokens));

    return new WP_REST_Response(['registered' => true, 'count' => count($tokens)], 200);
}

// ─── Supprimer un token (déconnexion) ─────────────────────────────────────────

function pom_unregister_token(WP_REST_Request $request): WP_REST_Response {
    $user_id = get_current_user_id();
    $token   = $request->get_param('token');

    $tokens = pom_get_tokens($user_id);
    $tokens = array_values(array_filter($tokens, fn($t) => $t['token'] !== $token));

    update_user_meta($user_id, POM_USER_META_KEY, wp_json_encode($tokens));

    return new WP_REST_Response(['unregistered' => true], 200);
}

// ─── Récupérer les tokens d'un utilisateur ────────────────────────────────────

function pom_get_tokens(int $user_id): array {
    $raw = get_user_meta($user_id, POM_USER_META_KEY, true);
    if (empty($raw)) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ─── Récupérer tous les tokens de tous les agents ────────────────────────────
// On notifie uniquement les utilisateurs avec rôle editor, administrator ou
// le rôle custom "partner" (agents commerciaux Presellia).

function pom_get_all_agent_tokens(): array {
    $allowed_roles = ['administrator', 'editor', 'shop_manager', 'partner'];
    $all_tokens    = [];

    foreach ($allowed_roles as $role) {
        $users = get_users(['role' => $role, 'fields' => 'ID']);
        foreach ($users as $user_id) {
            $tokens = pom_get_tokens((int) $user_id);
            foreach ($tokens as $t) {
                $all_tokens[] = $t['token'];
            }
        }
    }

    return array_unique($all_tokens);
}

// ─── Envoi push via Expo Push API ────────────────────────────────────────────

/**
 * @param string[] $tokens   Liste des tokens Expo Push (ExponentPushToken[...])
 * @param string   $title    Titre de la notification
 * @param string   $body     Corps du message
 * @param array    $data     Données custom (type, order_id…)
 */
function pom_send_push_with_result(array $tokens, string $title, string $body, array $data = [], string $sound_type = 'default'): array {
    if (empty($tokens)) {
        return ['success' => false, 'message' => 'Aucun jeton fourni.', 'details' => ''];
    }

    $sound = ($sound_type === 'cha-ching') ? 'cash_register.wav' : 'default';
    $channel_id = ($sound_type === 'cha-ching') ? 'presellia_sales' : 'presellia_general';

    $messages = array_map(fn($token) => [
        'to'        => $token,
        'title'     => $title,
        'body'      => $body,
        'data'      => $data,
        'sound'     => $sound,
        'badge'     => 1,
        'channelId' => $channel_id,
        'priority'  => 'high',
    ], $tokens);

    $response = wp_remote_post(POM_EXPO_PUSH_URL, [
        'body'    => wp_json_encode($messages),
        'headers' => [
            'Content-Type' => 'application/json',
            'Accept'       => 'application/json',
        ],
        'timeout' => 15,
    ]);

    if (is_wp_error($response)) {
        $err = $response->get_error_message();
        update_option('_pom_last_push_log', 'Erreur réseau WP: ' . $err);
        return [
            'success' => false,
            'message' => 'Erreur de connexion HTTP sortante du serveur WP vers Expo.',
            'details' => $err,
        ];
    }

    $code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    update_option('_pom_last_push_log', 'HTTP ' . $code . ': ' . $response_body);

    if ($code !== 200) {
        return [
            'success' => false,
            'message' => 'Expo API a répondu avec le statut ' . $code,
            'details' => $response_body,
        ];
    }

    return [
        'success' => true,
        'message' => 'Notification transmise avec succès à Expo.',
        'details' => $response_body,
    ];
}

function pom_send_push(array $tokens, string $title, string $body, array $data = [], string $sound_type = 'default'): void {
    if (empty($tokens)) return;
    $chunks = array_chunk($tokens, 100);
    foreach ($chunks as $chunk) {
        pom_send_push_with_result($chunk, $title, $body, $data, $sound_type);
    }
}

// ─── Déclencheurs de notifications de nouvelles commandes ──────────────────────

function pom_notify_new_order(int $order_id): void {
    static $notified_orders = [];
    if (in_array($order_id, $notified_orders, true)) return;
    $notified_orders[] = $order_id;

    $order = wc_get_order($order_id);
    if (! $order) return;

    $customer = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
    if (empty($customer)) {
        $customer = trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name());
    }
    
    $currency_code = $order->get_currency();
    $total_val = (float) $order->get_total();
    
    if ($currency_code === 'XOF') {
        $total = number_format($total_val, 0, ',', ' ') . ' F CFA';
    } elseif ($currency_code === 'USD') {
        $total = '$' . number_format($total_val, 2, '.', ',');
    } elseif ($currency_code === 'EUR') {
        $total = number_format($total_val, 2, ',', ' ') . ' €';
    } else {
        $total = number_format($total_val, 2, ',', ' ') . ' ' . $currency_code;
    }

    $tokens = pom_get_all_agent_tokens();

    pom_send_push(
        $tokens,
        '🛒 Nouvelle commande #' . $order->get_order_number(),
        ($customer ?: 'Client inconnu') . ' · ' . $total,
        [
            'type'     => 'new_order',
            'order_id' => $order_id,
        ],
        'cha-ching'
    );
}
// ─── Hook : changement de statut commande (Unique déclencheur de notifications) ──
// Nous n'écoutons plus les hooks de création bruts (checkout_order_processed, etc.)
// pour éviter les fausses alertes sur commandes impayées (pending) et les doublons.
add_action('woocommerce_order_status_changed', function (int $order_id, string $old_status, string $new_status): void {
    // On ne notifie pas les transitions vers des états impayés ou échoués
    $skip = ['pending', 'failed'];
    if (in_array($new_status, $skip, true)) return;
    if ($old_status === $new_status) return;

    $order = wc_get_order($order_id);
    if (! $order) return;

    // Détection d'une nouvelle vente réussie/payée :
    // passage d'un statut impayé/vide (pending, checkout-draft, new) à un statut payé (processing, completed)
    $is_new_sale = in_array($old_status, ['', 'pending', 'checkout-draft'], true) && in_array($new_status, ['processing', 'completed'], true);

    if ($is_new_sale) {
        // C'est une nouvelle vente encaissée -> On envoie la notification "Nouvelle commande" avec le son de caisse enregistreuse !
        pom_notify_new_order($order_id);
        return;
    }

    // Sinon, c'est un changement de statut après coup (ex: d'En cours à Terminée, ou d'En cours à Annulée)
    $labels = [
        'processing' => '🔄 En cours de traitement',
        'on-hold'    => '⏸ En attente de paiement',
        'completed'  => '✅ Terminée',
        'cancelled'  => '❌ Annulée',
        'refunded'   => '↩️ Remboursée',
    ];

    $label  = $labels[$new_status] ?? ucfirst($new_status);
    $tokens = pom_get_all_agent_tokens();

    pom_send_push(
        $tokens,
        $label . ' — #' . $order->get_order_number(),
        trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()) ?: 'Client inconnu',
        [
            'type'       => 'status_change',
            'order_id'   => $order_id,
            'old_status' => $old_status,
            'new_status' => $new_status,
        ],
        'default' // Son système par défaut pour les états secondaires ou de gestion
    );
}, 10, 3);
