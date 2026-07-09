<?php

if (!defined('ABSPATH')) {
    exit;
}

if (class_exists('BeautyHub_Pairing')) {
    return;
}

class BeautyHub_Pairing
{
    public static function init(): void
    {
        add_action('admin_init', [self::class, 'maybe_handle_pairing']);
    }

    public static function maybe_handle_pairing(): void
    {
        if (!is_admin() || !current_user_can('manage_woocommerce')) {
            return;
        }

        $token = isset($_GET['beautyhub_pair'])
            ? sanitize_text_field(wp_unslash($_GET['beautyhub_pair']))
            : '';
        $api_url = isset($_GET['beautyhub_api'])
            ? esc_url_raw(wp_unslash($_GET['beautyhub_api']))
            : '';

        if ($token === '' || $api_url === '') {
            return;
        }

        $result = self::complete_pairing($token, $api_url);
        $page = admin_url('admin.php?page=beautyhub-connector');

        if (is_wp_error($result)) {
            wp_safe_redirect(add_query_arg('beautyhub_error', rawurlencode($result->get_error_message()), $page));
            exit;
        }

        wp_safe_redirect(add_query_arg('beautyhub_connected', '1', $page));
        exit;
    }

    /**
     * @return true|WP_Error
     */
    public static function complete_pairing(string $pairing_token, string $api_url)
    {
        $keys = self::create_rest_api_keys();
        if (is_wp_error($keys)) {
            return $keys;
        }

        $endpoint = rtrim($api_url, '/') . '/api/connectors/woocommerce/pair/complete';
        $body = wp_json_encode([
            'pairing_token' => $pairing_token,
            'site_url' => home_url(),
            'consumer_key' => $keys['consumer_key'],
            'consumer_secret' => $keys['consumer_secret'],
        ]);

        $response = wp_remote_post($endpoint, [
            'timeout' => 20,
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        $raw = wp_remote_retrieve_body($response);
        $data = json_decode($raw, true);

        if ($code < 200 || $code >= 300 || !is_array($data) || empty($data['ok'])) {
            $message = is_array($data) && !empty($data['error'])
                ? (string) $data['error']
                : 'pairing_failed';
            return new WP_Error('beautyhub_pairing', $message);
        }

        update_option('beautyhub_api_url', rtrim((string) ($data['api_url'] ?? $api_url), '/'));
        update_option('beautyhub_webhook_token', (string) ($data['webhook_token'] ?? ''));
        update_option('beautyhub_webhook_secret', (string) ($data['webhook_secret'] ?? ''));
        update_option('beautyhub_connected_at', gmdate('c'));
        update_option('beautyhub_consumer_key_id', (int) ($keys['key_id'] ?? 0));

        return true;
    }

    /**
     * @return array{consumer_key:string,consumer_secret:string,key_id:int}|WP_Error
     */
    private static function create_rest_api_keys()
    {
        global $wpdb;

        if (!function_exists('wc_rand_hash') || !function_exists('wc_api_hash')) {
            return new WP_Error('beautyhub_woo', 'WooCommerce indisponible.');
        }

        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return new WP_Error('beautyhub_auth', 'Utilisateur WordPress requis.');
        }

        $consumer_key = 'ck_' . wc_rand_hash();
        $consumer_secret = 'cs_' . wc_rand_hash();

        $inserted = $wpdb->insert(
            $wpdb->prefix . 'woocommerce_api_keys',
            [
                'user_id' => $user_id,
                'description' => 'BeautyHub Connector',
                'permissions' => 'read_write',
                'consumer_key' => wc_api_hash($consumer_key),
                'consumer_secret' => $consumer_secret,
                'truncated_key' => substr($consumer_key, -7),
            ],
            ['%d', '%s', '%s', '%s', '%s', '%s']
        );

        if (!$inserted) {
            return new WP_Error('beautyhub_keys', 'Impossible de créer les clés API.');
        }

        return [
            'consumer_key' => $consumer_key,
            'consumer_secret' => $consumer_secret,
            'key_id' => (int) $wpdb->insert_id,
        ];
    }

    public static function is_connected(): bool
    {
        $token = (string) get_option('beautyhub_webhook_token', '');
        $secret = (string) get_option('beautyhub_webhook_secret', '');
        $api = (string) get_option('beautyhub_api_url', '');

        return $token !== '' && $secret !== '' && $api !== '';
    }

    public static function disconnect(): void
    {
        delete_option('beautyhub_api_url');
        delete_option('beautyhub_webhook_token');
        delete_option('beautyhub_webhook_secret');
        delete_option('beautyhub_connected_at');
        delete_option('beautyhub_consumer_key_id');
    }
}
