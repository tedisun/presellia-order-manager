<?php
/**
 * Plugin Name: Presellia Order Manager — Push Notifications
 * Description: Envoie des push notifications Expo à l'app Order Manager lors de nouvelles commandes.
 * Version:     1.0.0
 * Author:      Tedisun SARL
 *
 * INSTALLATION :
 *   Copier ce fichier dans wp-content/mu-plugins/pom-push-notifications.php
 *   Aucune activation nécessaire — les mu-plugins sont chargés automatiquement.
 */

defined('ABSPATH') || exit;

// ─── REST API ─────────────────────────────────────────────────────────────────

add_action('rest_api_init', function () {
    // POST /wp-json/pom/v1/register-token  — enregistre le token de l'appareil
    register_rest_route('pom/v1', '/register-token', [
        'methods'             => 'POST',
        'callback'            => 'pom_register_token',
        'permission_callback' => 'is_user_logged_in',
    ]);

    // GET  /wp-json/pom/v1/status          — état du plugin (pour diagnostic app)
    register_rest_route('pom/v1', '/status', [
        'methods'             => 'GET',
        'callback'            => 'pom_status',
        'permission_callback' => 'is_user_logged_in',
    ]);
});

function pom_register_token(WP_REST_Request $request): WP_REST_Response {
    $token    = sanitize_text_field($request->get_param('token') ?? '');
    $platform = sanitize_text_field($request->get_param('platform') ?? 'android');

    if (empty($token)) {
        return new WP_REST_Response(['success' => false, 'message' => 'Token manquant'], 400);
    }

    $tokens   = get_option('pom_push_tokens', []);
    $user_id  = get_current_user_id();

    $tokens[$user_id] = [
        'token'      => $token,
        'platform'   => $platform,
        'user_id'    => $user_id,
        'updated_at' => time(),
    ];

    update_option('pom_push_tokens', $tokens, false); // autoload=false

    return new WP_REST_Response(['success' => true, 'registered' => true]);
}

function pom_status(): WP_REST_Response {
    $tokens  = get_option('pom_push_tokens', []);
    $user_id = get_current_user_id();

    return new WP_REST_Response([
        'active'            => true,
        'registered_tokens' => count($tokens),
        'user_has_token'    => isset($tokens[$user_id]),
    ]);
}

// ─── Hooks WooCommerce ────────────────────────────────────────────────────────

// Nouvelle commande créée (checkout standard ou REST API)
add_action('woocommerce_checkout_order_created',  'pom_on_new_order', 10, 1);
add_action('woocommerce_rest_insert_order_object', 'pom_on_rest_new_order', 10, 3);

function pom_on_new_order($order): void {
    if (!($order instanceof WC_Order)) return;
    pom_maybe_notify_new_order($order->get_id());
}

function pom_on_rest_new_order($order, $request, $creating): void {
    if (!$creating || !($order instanceof WC_Order)) return;
    pom_maybe_notify_new_order($order->get_id());
}

function pom_maybe_notify_new_order(int $order_id): void {
    if (!$order_id) return;

    // Dédoublonnage — évite deux notifications si plusieurs hooks se déclenchent
    if (get_post_meta($order_id, '_pom_notified', true)) return;
    update_post_meta($order_id, '_pom_notified', '1');

    $order = wc_get_order($order_id);
    if (!$order) return;

    $total  = number_format((float) $order->get_total(), 0, ',', ' ');
    $name   = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
    $number = $order->get_order_number();

    pom_send_to_all([
        'title' => "Nouvelle commande #{$number}",
        'body'  => "{$name} · {$total} F CFA",
        'data'  => ['type' => 'new_order', 'order_id' => $order_id],
    ]);
}

// Changement de statut
add_action('woocommerce_order_status_changed', 'pom_on_status_changed', 10, 4);

function pom_on_status_changed(int $order_id, string $old_status, string $new_status, WC_Order $order): void {
    $notify_statuses = ['completed', 'cancelled', 'refunded', 'failed'];
    if (!in_array($new_status, $notify_statuses, true)) return;

    $labels = [
        'completed' => 'Terminée ✓',
        'cancelled' => 'Annulée',
        'refunded'  => 'Remboursée',
        'failed'    => 'Échouée',
    ];

    $name   = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
    $number = $order->get_order_number();

    pom_send_to_all([
        'title' => "Commande #{$number} — {$labels[$new_status]}",
        'body'  => $name,
        'data'  => ['type' => 'status_change', 'order_id' => $order_id],
    ]);
}

// ─── Envoi push via Expo Push API ─────────────────────────────────────────────

function pom_send_to_all(array $message): void {
    $tokens = get_option('pom_push_tokens', []);
    if (empty($tokens)) return;

    $push_tokens = array_unique(array_column($tokens, 'token'));

    $messages = array_values(array_map(function (string $token) use ($message): array {
        return [
            'to'       => $token,
            'title'    => $message['title'],
            'body'     => $message['body'],
            'data'     => $message['data'] ?? [],
            'sound'    => 'default',
            'priority' => 'high',
        ];
    }, $push_tokens));

    $response = wp_remote_post('https://exp.host/--/api/v2/push/send', [
        'headers' => [
            'Content-Type' => 'application/json',
            'Accept'       => 'application/json',
        ],
        'body'    => wp_json_encode($messages),
        'timeout' => 30,
    ]);

    if (is_wp_error($response)) {
        error_log('[POM] Erreur push: ' . $response->get_error_message());
    } elseif (wp_remote_retrieve_response_code($response) >= 400) {
        error_log('[POM] Expo API erreur ' . wp_remote_retrieve_response_code($response) . ': ' . wp_remote_retrieve_body($response));
    }
}
