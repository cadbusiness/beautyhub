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

        self::send('order.completed', [
            'id' => $order_id,
            'total' => $order->get_total(),
            'status' => $order->get_status(),
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
}
