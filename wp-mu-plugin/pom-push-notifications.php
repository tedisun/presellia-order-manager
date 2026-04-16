<?php
/**
 * Plugin Name: POM Push Notifications
 * Description: Enregistre les tokens Expo Push et envoie des notifications
 *              aux agents Presellia lors d'événements WooCommerce.
 * Version:     1.1.0
 * Author:      Tedisun SARL
 *
 * Déposé dans /wp-content/mu-plugins/ — chargé automatiquement par WordPress,
 * pas besoin d'activation manuelle.
 *
 * Endpoints REST :
 *   POST /wp-json/pom/v1/register-token   ← app mobile enregistre son token
 *   DELETE /wp-json/pom/v1/register-token ← app mobile supprime son token (logout)
 *
 * Meta utilisateur :
 *   _pom_push_tokens  → JSON array de { token, platform, updated_at }
 */

defined('ABSPATH') || exit;

// ─── Constantes ───────────────────────────────────────────────────────────────

define('POM_EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send');
define('POM_USER_META_KEY', '_pom_push_tokens');
define('POM_NAMESPACE', 'pom/v1');

// ─── Enregistrement des routes REST ──────────────────────────────────────────

add_action('rest_api_init', function () {
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
});

// ─── Permission : utilisateur WP connecté (WP Application Password) ──────────

function pom_require_authenticated(): bool {
    return is_user_logged_in();
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
function pom_send_push(array $tokens, string $title, string $body, array $data = []): void {
    if (empty($tokens)) return;

    // L'API Expo accepte jusqu'à 100 messages par requête
    $chunks = array_chunk($tokens, 100);

    foreach ($chunks as $chunk) {
        $messages = array_map(fn($token) => [
            'to'    => $token,
            'title' => $title,
            'body'  => $body,
            'data'  => $data,
            'sound' => 'default',
            'badge' => 1,
        ], $chunk);

        wp_remote_post(POM_EXPO_PUSH_URL, [
            'body'    => wp_json_encode($messages),
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ],
            'timeout' => 10,
        ]);
        // Erreurs réseau ignorées silencieusement — les notifications sont best-effort
    }
}

// ─── Hook : nouvelle commande ─────────────────────────────────────────────────

add_action('woocommerce_new_order', function (int $order_id): void {
    $order    = wc_get_order($order_id);
    if (! $order) return;

    $customer = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
    $total    = number_format((float) $order->get_total(), 0, ',', ' ') . ' F CFA';
    $tokens   = pom_get_all_agent_tokens();

    pom_send_push(
        $tokens,
        '🛒 Nouvelle commande #' . $order->get_order_number(),
        ($customer ?: 'Client inconnu') . ' · ' . $total,
        [
            'type'     => 'new_order',
            'order_id' => $order_id,
        ]
    );
}, 10, 1);

// ─── Hook : changement de statut commande ─────────────────────────────────────

add_action('woocommerce_order_status_changed', function (int $order_id, string $old_status, string $new_status): void {
    // On ne notifie pas les transitions mineures ou les retours en arrière
    $skip = ['pending', 'failed'];
    if (in_array($new_status, $skip, true)) return;
    if ($old_status === $new_status) return;

    $order    = wc_get_order($order_id);
    if (! $order) return;

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
        ]
    );
}, 10, 3);
