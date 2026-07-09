<?php

if (!defined('ABSPATH')) {
    exit;
}

if (class_exists('BeautyHub_Vouchers')) {
    return;
}

class BeautyHub_Vouchers
{
    public static function init(): void
    {
        add_filter('woocommerce_get_shop_coupon_data', [self::class, 'maybe_resolve_coupon'], 10, 2);
        add_action('woocommerce_checkout_order_processed', [self::class, 'confirm_order_vouchers'], 20, 3);
        add_action('woocommerce_order_status_completed', [self::class, 'confirm_order_vouchers_from_status'], 15, 1);
    }

    private static function api_base(): ?string
    {
        $base = rtrim((string) get_option('beautyhub_api_url', ''), '/');
        return $base !== '' ? $base : null;
    }

    private static function token(): ?string
    {
        $token = trim((string) get_option('beautyhub_webhook_token', ''));
        return $token !== '' ? $token : null;
    }

    private static function secret(): ?string
    {
        $secret = trim((string) get_option('beautyhub_webhook_secret', ''));
        return $secret !== '' ? $secret : null;
    }

    private static function request(string $path, array $payload): ?array
    {
        $base = self::api_base();
        $token = self::token();
        $secret = self::secret();
        if (!$base || !$token || !$secret) {
            return null;
        }

        $body = wp_json_encode($payload);
        $signature = 'sha256=' . hash_hmac('sha256', $body, $secret);
        $response = wp_remote_post($base . $path, [
            'timeout' => 12,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-BeautyHub-Token' => $token,
                'X-BeautyHub-Signature' => $signature,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            return null;
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            return null;
        }

        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
        return is_array($decoded) ? $decoded : null;
    }

    private static function coupon_supported(string $code): bool
    {
        return (bool) preg_match('/^(VC|GC|AV|BHV)[A-Z0-9\-]*$/', strtoupper($code));
    }

    private static function cart_total_cents(): int
    {
        if (!function_exists('WC') || !WC()->cart) {
            return 0;
        }
        $total = (float) WC()->cart->get_total('edit');
        return max(0, (int) round($total * 100));
    }

    public static function maybe_resolve_coupon($false, $raw_code)
    {
        $code = strtoupper(trim((string) $raw_code));
        if (!self::coupon_supported($code)) {
            return $false;
        }

        $total_cents = self::cart_total_cents();
        if ($total_cents <= 0) {
            return $false;
        }

        $result = self::request('/api/connectors/woocommerce/vouchers', [
            'action' => 'validate',
            'code' => $code,
            'total_cents' => $total_cents,
            'currency' => get_woocommerce_currency(),
            'cart_hash' => function_exists('WC') && WC()->cart ? WC()->cart->get_cart_hash() : '',
        ]);

        if (!$result || empty($result['valid']) || empty($result['discount_cents'])) {
            return $false;
        }

        $discount = ((int) $result['discount_cents']) / 100;

        if (function_exists('WC') && WC()->session) {
            $cache = WC()->session->get('beautyhub_voucher_checkout', []);
            if (!is_array($cache)) {
                $cache = [];
            }
            $cache[$code] = [
                'discount_cents' => (int) $result['discount_cents'],
                'reserve_token' => isset($result['reserve_token']) ? (string) $result['reserve_token'] : '',
            ];
            WC()->session->set('beautyhub_voucher_checkout', $cache);
        }

        return [
            'id' => 'beautyhub_' . sanitize_title($code),
            'code' => $code,
            'amount' => wc_format_decimal($discount, 2),
            'discount_type' => 'fixed_cart',
            'individual_use' => false,
            'usage_limit' => 0,
            'usage_limit_per_user' => 0,
            'virtual' => true,
            'description' => 'BeautyHub voucher',
        ];
    }

    public static function confirm_order_vouchers($order_id, $posted_data, $order): void
    {
        if (!($order instanceof WC_Order)) {
            return;
        }
        self::confirm_order($order);
    }

    public static function confirm_order_vouchers_from_status(int $order_id): void
    {
        $order = wc_get_order($order_id);
        if ($order) {
            self::confirm_order($order);
        }
    }

    private static function confirm_order(WC_Order $order): void
    {
        $codes = $order->get_coupon_codes();
        if (empty($codes)) {
            return;
        }

        $session_cache = function_exists('WC') && WC()->session
            ? WC()->session->get('beautyhub_voucher_checkout', [])
            : [];
        if (!is_array($session_cache)) {
            $session_cache = [];
        }

        foreach ($codes as $raw_code) {
            $code = strtoupper(trim((string) $raw_code));
            if (!self::coupon_supported($code)) {
                continue;
            }

            $item_amount = 0;
            foreach ($order->get_items('coupon') as $coupon_item) {
                if (strtoupper((string) $coupon_item->get_code()) === $code) {
                    $item_amount = (float) $coupon_item->get_discount();
                    break;
                }
            }

            $amount_cents = max(1, (int) round($item_amount * 100));
            $reserve_token = '';
            if (isset($session_cache[$code]['reserve_token'])) {
                $reserve_token = (string) $session_cache[$code]['reserve_token'];
            }

            self::request('/api/connectors/woocommerce/vouchers', [
                'action' => 'confirm',
                'code' => $code,
                'order_id' => $order->get_id(),
                'amount_cents' => $amount_cents,
                'cart_hash' => $reserve_token,
                'idempotency_key' => sprintf(
                    'woo:checkout:%d:%s:%d',
                    (int) $order->get_id(),
                    $code,
                    $amount_cents
                ),
            ]);
        }
    }
}
