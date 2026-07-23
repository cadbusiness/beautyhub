<?php

if (!defined('ABSPATH')) {
    exit;
}

if (class_exists('BeautyHub_Gift_Cards')) {
    return;
}

class BeautyHub_Gift_Cards
{
    public const META_PRODUCT = '_beautyhub_gift_card';
    public const META_ORDER = '_beautyhub_gift_cards';

    public static function init(): void
    {
        add_action('woocommerce_product_options_general_product_data', [self::class, 'product_field']);
        add_action('woocommerce_process_product_meta', [self::class, 'save_product_field']);
        add_action('woocommerce_order_details_after_order_table', [self::class, 'render_order_links'], 20, 1);
        add_action('woocommerce_email_order_meta', [self::class, 'email_order_meta'], 20, 3);
        add_filter('woocommerce_email_attachments', [self::class, 'email_attachments'], 20, 4);
    }

    public static function product_field(): void
    {
        echo '<div class="options_group">';
        woocommerce_wp_checkbox([
            'id' => self::META_PRODUCT,
            'label' => __('Carte cadeau BeautyHub', 'beautyhub-connector'),
            'description' => __('À la commande terminée, BeautyHub émet une carte cadeau (solde) et un PDF.', 'beautyhub-connector'),
            'desc_tip' => true,
            'value' => get_post_meta(get_the_ID(), self::META_PRODUCT, true) === 'yes' ? 'yes' : 'no',
        ]);
        echo '</div>';
    }

    public static function save_product_field(int $product_id): void
    {
        $value = isset($_POST[self::META_PRODUCT]) ? 'yes' : 'no';
        update_post_meta($product_id, self::META_PRODUCT, $value);
    }

    /** @return array<int, array{code?:string,pdf_url?:string,amount_cents?:int}> */
    private static function cards_from_order(WC_Order $order): array
    {
        $raw = $order->get_meta(self::META_ORDER, true);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        if (is_array($raw)) {
            return $raw;
        }
        return [];
    }

    public static function render_order_links($order): void
    {
        if (!$order instanceof WC_Order) {
            return;
        }
        $cards = self::cards_from_order($order);
        if (empty($cards)) {
            return;
        }

        echo '<section class="beautyhub-gift-cards" style="margin:1.5em 0">';
        echo '<h2>' . esc_html__('Vos cartes cadeaux', 'beautyhub-connector') . '</h2>';
        echo '<ul>';
        foreach ($cards as $card) {
            $code = isset($card['code']) ? (string) $card['code'] : '';
            $url = isset($card['pdf_url']) ? (string) $card['pdf_url'] : '';
            if ($code === '') {
                continue;
            }
            echo '<li><strong>' . esc_html($code) . '</strong>';
            if ($url !== '') {
                echo ' — <a href="' . esc_url($url) . '" target="_blank" rel="noopener">'
                    . esc_html__('Télécharger le PDF', 'beautyhub-connector')
                    . '</a>';
            }
            echo '</li>';
        }
        echo '</ul></section>';
    }

    public static function email_order_meta($order, $sent_to_admin, $plain_text): void
    {
        if (!$order instanceof WC_Order || $sent_to_admin) {
            return;
        }
        $cards = self::cards_from_order($order);
        if (empty($cards)) {
            return;
        }

        if ($plain_text) {
            echo "\n" . __('Vos cartes cadeaux BeautyHub', 'beautyhub-connector') . "\n";
            foreach ($cards as $card) {
                $code = isset($card['code']) ? (string) $card['code'] : '';
                $url = isset($card['pdf_url']) ? (string) $card['pdf_url'] : '';
                if ($code === '') {
                    continue;
                }
                echo $code;
                if ($url !== '') {
                    echo ' — ' . $url;
                }
                echo "\n";
            }
            return;
        }

        echo '<h2>' . esc_html__('Vos cartes cadeaux BeautyHub', 'beautyhub-connector') . '</h2><ul>';
        foreach ($cards as $card) {
            $code = isset($card['code']) ? (string) $card['code'] : '';
            $url = isset($card['pdf_url']) ? (string) $card['pdf_url'] : '';
            if ($code === '') {
                continue;
            }
            echo '<li><strong>' . esc_html($code) . '</strong>';
            if ($url !== '') {
                echo ' — <a href="' . esc_url($url) . '">'
                    . esc_html__('Télécharger le PDF', 'beautyhub-connector')
                    . '</a>';
            }
            echo '</li>';
        }
        echo '</ul>';
    }

    /**
     * Attempt to attach PDF files when URLs are downloadable.
     *
     * @param array<int, string> $attachments
     * @return array<int, string>
     */
    public static function email_attachments(array $attachments, $email_id, $order, $email): array
    {
        if (!$order instanceof WC_Order) {
            return $attachments;
        }
        if (!in_array((string) $email_id, ['customer_completed_order', 'customer_on_hold_order', 'customer_processing_order'], true)) {
            return $attachments;
        }

        $cards = self::cards_from_order($order);
        $upload = wp_upload_dir();
        if (!empty($upload['error'])) {
            return $attachments;
        }

        foreach ($cards as $i => $card) {
            $url = isset($card['pdf_url']) ? (string) $card['pdf_url'] : '';
            $code = isset($card['code']) ? preg_replace('/[^A-Z0-9\-]/i', '', (string) $card['code']) : 'gift';
            if ($url === '') {
                continue;
            }
            $response = wp_remote_get($url, ['timeout' => 20]);
            if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
                continue;
            }
            $body = wp_remote_retrieve_body($response);
            if ($body === '') {
                continue;
            }
            $path = trailingslashit($upload['basedir']) . 'beautyhub-' . $code . '-' . $i . '.pdf';
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            if (file_put_contents($path, $body) !== false) {
                $attachments[] = $path;
            }
        }

        return $attachments;
    }
}
