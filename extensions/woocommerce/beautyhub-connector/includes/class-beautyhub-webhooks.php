<?php

if (!defined('ABSPATH')) {
    exit;
}

if (class_exists('BeautyHub_Webhooks')) {
    return;
}

class BeautyHub_Webhooks
{
    public static function init(): void
    {
        add_action('woocommerce_update_product', [self::class, 'on_product_save'], 20, 1);
        add_action('woocommerce_new_product', [self::class, 'on_product_save'], 20, 1);
        add_action('woocommerce_product_set_stock', [self::class, 'on_stock_change'], 20, 1);
        add_action('before_delete_post', [self::class, 'on_product_delete'], 20, 1);
        add_action('woocommerce_order_status_completed', [self::class, 'on_order_completed'], 20, 1);

        add_action('woocommerce_created_customer', [self::class, 'on_customer_created'], 20, 3);
        add_action('woocommerce_new_customer', [self::class, 'on_customer_created'], 20, 3);
        add_action('woocommerce_update_customer', [self::class, 'on_customer_updated'], 20, 1);
        add_action('profile_update', [self::class, 'on_profile_updated'], 20, 2);
        add_action('user_register', [self::class, 'on_user_register'], 20, 1);
        add_action('delete_user', [self::class, 'on_user_delete'], 20, 1);
    }

    private static function endpoint(): ?string
    {
        $base = rtrim((string) get_option('beautyhub_api_url', ''), '/');
        $token = trim((string) get_option('beautyhub_webhook_token', ''));
        if ($base === '' || $token === '') {
            return null;
        }
        return $base . '/api/webhooks/woocommerce/' . rawurlencode($token);
    }

    private static function secret(): ?string
    {
        $secret = trim((string) get_option('beautyhub_webhook_secret', ''));
        return $secret !== '' ? $secret : null;
    }

    private static function send(string $event, array $payload): void
    {
        $endpoint = self::endpoint();
        if (!$endpoint) {
            return;
        }

        $body = wp_json_encode([
            'event' => $event,
            'payload' => $payload,
        ]);

        $secret = self::secret();
        $signature = $secret
            ? 'sha256=' . hash_hmac('sha256', $body, $secret)
            : '';

        wp_remote_post($endpoint, [
            'timeout' => 15,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-BeautyHub-Signature' => $signature,
                'X-BeautyHub-Event' => $event,
            ],
            'body' => $body,
        ]);
    }

    private static function product_payload(WC_Product $product): array
    {
        $image_id = $product->get_image_id();
        $images = [];
        if ($image_id) {
            $src = wp_get_attachment_image_url($image_id, 'full');
            if ($src) {
                $images[] = ['src' => $src];
            }
        }

        $categories = [];
        $category_ids = $product->get_category_ids();
        if (is_array($category_ids) && !empty($category_ids)) {
            foreach ($category_ids as $category_id) {
                $term = get_term((int) $category_id, 'product_cat');
                if ($term && !is_wp_error($term)) {
                    $categories[] = [
                        'id' => (int) $term->term_id,
                        'name' => (string) $term->name,
                        'slug' => (string) $term->slug,
                    ];
                }
            }
        }

        $meta_data = [];
        foreach ([
            '_beautyhub_gift_card',
            '_beautyhub_gift_template_id',
            '_beautyhub_gift_variation_templates',
        ] as $meta_key) {
            $value = get_post_meta($product->get_id(), $meta_key, true);
            if ($value !== '' && $value !== null) {
                $meta_data[] = [
                    'key' => $meta_key,
                    'value' => $value,
                ];
            }
        }

        return [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'stock_quantity' => $product->get_manage_stock()
                ? $product->get_stock_quantity()
                : null,
            'status' => $product->get_status() === 'publish' ? 'publish' : $product->get_status(),
            'images' => $images,
            'categories' => $categories,
            'meta_data' => $meta_data,
        ];
    }

    public static function on_product_save(int $product_id): void
    {
        $product = wc_get_product($product_id);
        if (!$product) {
            return;
        }
        self::send('product.updated', self::product_payload($product));
    }

    public static function on_stock_change(WC_Product $product): void
    {
        self::send('product.stock_updated', [
            'id' => $product->get_id(),
            'stock_quantity' => $product->get_manage_stock()
                ? $product->get_stock_quantity()
                : null,
        ]);
    }

    public static function on_product_delete(int $post_id): void
    {
        if (get_post_type($post_id) !== 'product') {
            return;
        }
        self::send('product.deleted', ['id' => $post_id]);
    }

    public static function on_order_completed(int $order_id): void
    {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        if ($order->get_payment_method() === 'beautyhub_pos') {
            return;
        }

        $coupon_lines = [];
        foreach ($order->get_items('coupon') as $coupon) {
            $coupon_lines[] = [
                'code' => strtoupper((string) $coupon->get_code()),
                'discount' => (float) $coupon->get_discount(),
                'discount_tax' => (float) $coupon->get_discount_tax(),
            ];
        }

        $line_items = [];
        foreach ($order->get_items() as $item) {
            $product_id = (int) $item->get_product_id();
            $variation_id = (int) $item->get_variation_id();
            $is_gift = get_post_meta($product_id, '_beautyhub_gift_card', true) === 'yes';
            $template_id = '';
            if ($variation_id > 0) {
                $template_id = (string) get_post_meta($variation_id, '_beautyhub_gift_template_id', true);
            }
            if ($template_id === '') {
                $template_id = (string) get_post_meta($product_id, '_beautyhub_gift_template_id', true);
            }
            $line_items[] = [
                'product_id' => $product_id,
                'variation_id' => $variation_id,
                'quantity' => (int) $item->get_quantity(),
                'total' => (float) $item->get_total(),
                'is_gift_card' => $is_gift,
                'gift_template_id' => $template_id,
            ];
        }

        self::send('order.completed', [
            'id' => $order_id,
            'total' => $order->get_total(),
            'status' => $order->get_status(),
            'currency' => $order->get_currency(),
            'date_completed' => $order->get_date_completed()
                ? $order->get_date_completed()->date('c')
                : null,
            'customer_id' => (int) $order->get_customer_id(),
            'coupon_lines' => $coupon_lines,
            'line_items' => $line_items,
            'billing' => [
                'first_name' => (string) $order->get_billing_first_name(),
                'last_name' => (string) $order->get_billing_last_name(),
                'email' => (string) $order->get_billing_email(),
                'phone' => (string) $order->get_billing_phone(),
                'address_1' => (string) $order->get_billing_address_1(),
                'address_2' => (string) $order->get_billing_address_2(),
                'postcode' => (string) $order->get_billing_postcode(),
                'city' => (string) $order->get_billing_city(),
                'country' => (string) $order->get_billing_country(),
            ],
            'meta' => [
                'payment_method' => $order->get_payment_method(),
            ],
        ]);

        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            if (!$product) {
                continue;
            }
            self::send('product.stock_updated', [
                'id' => $product->get_id(),
                'stock_quantity' => $product->get_manage_stock()
                    ? $product->get_stock_quantity()
                    : null,
            ]);
        }
    }

    /**
     * Vérifie qu'un user WP est bien un customer WooCommerce (a le rôle "customer"
     * ou une commande passée). Utilisé pour éviter de synchroniser les admins.
     */
    private static function is_woo_customer(int $user_id): bool
    {
        $user = get_userdata($user_id);
        if (!$user) {
            return false;
        }
        $roles = (array) ($user->roles ?? []);
        if (in_array('customer', $roles, true)) {
            return true;
        }
        // Fallback : l'utilisateur a au moins une commande
        if (function_exists('wc_get_orders')) {
            $orders = wc_get_orders([
                'customer_id' => $user_id,
                'limit' => 1,
                'return' => 'ids',
            ]);
            if (!empty($orders)) {
                return true;
            }
        }
        return false;
    }

    private static function customer_payload(int $user_id): ?array
    {
        $customer = null;
        if (class_exists('WC_Customer')) {
            try {
                $customer = new WC_Customer($user_id);
            } catch (Exception $e) {
                $customer = null;
            }
        }
        $user = get_userdata($user_id);
        if (!$user) {
            return null;
        }

        $get = static function ($object, string $method, string $fallback = ''): string {
            if ($object && method_exists($object, $method)) {
                $value = $object->$method();
                return is_string($value) ? $value : (string) $value;
            }
            return $fallback;
        };

        return [
            'id' => $user_id,
            'email' => (string) $user->user_email,
            'first_name' => $get($customer, 'get_first_name', (string) get_user_meta($user_id, 'first_name', true)),
            'last_name' => $get($customer, 'get_last_name', (string) get_user_meta($user_id, 'last_name', true)),
            'username' => (string) $user->user_login,
            'date_created' => $user->user_registered
                ? mysql2date('c', $user->user_registered, false)
                : null,
            'billing' => [
                'first_name' => $get($customer, 'get_billing_first_name'),
                'last_name' => $get($customer, 'get_billing_last_name'),
                'email' => $get($customer, 'get_billing_email', (string) $user->user_email),
                'phone' => $get($customer, 'get_billing_phone'),
                'address_1' => $get($customer, 'get_billing_address_1'),
                'address_2' => $get($customer, 'get_billing_address_2'),
                'postcode' => $get($customer, 'get_billing_postcode'),
                'city' => $get($customer, 'get_billing_city'),
                'country' => $get($customer, 'get_billing_country'),
            ],
        ];
    }

    public static function on_customer_created($user_id, $new_customer_data = null, $password_generated = null): void
    {
        $uid = (int) $user_id;
        if ($uid <= 0) {
            return;
        }
        if (!self::is_woo_customer($uid)) {
            return;
        }
        $payload = self::customer_payload($uid);
        if ($payload) {
            self::send('customer.created', $payload);
        }
    }

    public static function on_customer_updated($user_id): void
    {
        $uid = (int) $user_id;
        if ($uid <= 0) {
            return;
        }
        if (!self::is_woo_customer($uid)) {
            return;
        }
        $payload = self::customer_payload($uid);
        if ($payload) {
            self::send('customer.updated', $payload);
        }
    }

    /**
     * WordPress hook `profile_update` : ne notifie que les customers Woo.
     */
    public static function on_profile_updated($user_id, $old_user_data = null): void
    {
        self::on_customer_updated($user_id);
    }

    /**
     * WordPress hook `user_register` : couvre les créations de comptes WP qui
     * n'ont pas déclenché `woocommerce_created_customer` (registrations custom).
     */
    public static function on_user_register($user_id): void
    {
        self::on_customer_created($user_id);
    }

    public static function on_user_delete($user_id): void
    {
        $uid = (int) $user_id;
        if ($uid <= 0) {
            return;
        }
        self::send('customer.deleted', ['id' => $uid]);
    }
}
