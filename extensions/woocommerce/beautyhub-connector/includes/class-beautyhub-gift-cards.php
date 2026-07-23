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
    public const META_TEMPLATE = '_beautyhub_gift_template_id';
    public const META_VARIATION_MAP = '_beautyhub_gift_variation_templates';
    public const META_ORDER = '_beautyhub_gift_cards';
    public const ENDPOINT = 'beautyhub-gift-cards';

    public static function init(): void
    {
        add_action('woocommerce_product_options_general_product_data', [self::class, 'product_field']);
        add_action('woocommerce_process_product_meta', [self::class, 'save_product_field']);
        add_action('woocommerce_product_after_variable_attributes', [self::class, 'variation_field'], 10, 3);
        add_action('woocommerce_save_product_variation', [self::class, 'save_variation_field'], 10, 2);
        add_action('woocommerce_order_details_after_order_table', [self::class, 'render_order_links'], 20, 1);
        add_action('woocommerce_email_order_meta', [self::class, 'email_order_meta'], 20, 3);
        add_filter('woocommerce_email_attachments', [self::class, 'email_attachments'], 20, 4);

        add_action('init', [self::class, 'add_endpoint']);
        add_action('init', [self::class, 'maybe_flush_rewrites'], 20);
        add_filter('woocommerce_account_menu_items', [self::class, 'account_menu_item']);
        add_action('woocommerce_account_' . self::ENDPOINT . '_endpoint', [self::class, 'account_endpoint_content']);
    }

    public static function add_endpoint(): void
    {
        add_rewrite_endpoint(self::ENDPOINT, EP_ROOT | EP_PAGES);
    }

    public static function maybe_flush_rewrites(): void
    {
        $stored = (string) get_option('beautyhub_connector_gift_endpoint_version', '');
        if ($stored === BEAUTYHUB_CONNECTOR_VERSION) {
            return;
        }
        flush_rewrite_rules(false);
        update_option('beautyhub_connector_gift_endpoint_version', BEAUTYHUB_CONNECTOR_VERSION);
    }

    /** @param array<string, string> $items */
    public static function account_menu_item(array $items): array
    {
        $new = [];
        foreach ($items as $key => $label) {
            $new[$key] = $label;
            if ($key === 'orders') {
                $new[self::ENDPOINT] = __('Cartes cadeaux', 'beautyhub-connector');
            }
        }
        if (!isset($new[self::ENDPOINT])) {
            $new[self::ENDPOINT] = __('Cartes cadeaux', 'beautyhub-connector');
        }
        return $new;
    }

    public static function account_endpoint_content(): void
    {
        $customer_id = get_current_user_id();
        if (!$customer_id) {
            echo '<p>' . esc_html__('Connectez-vous pour voir vos cartes cadeaux.', 'beautyhub-connector') . '</p>';
            return;
        }

        $orders = wc_get_orders([
            'customer_id' => $customer_id,
            'limit' => 50,
            'orderby' => 'date',
            'order' => 'DESC',
            'status' => ['wc-completed', 'wc-processing', 'wc-on-hold'],
        ]);

        $cards = [];
        foreach ($orders as $order) {
            if (!$order instanceof WC_Order) {
                continue;
            }
            foreach (self::cards_from_order($order) as $card) {
                $card['_order_id'] = $order->get_id();
                $cards[] = $card;
            }
        }

        if (empty($cards)) {
            echo '<p>' . esc_html__('Aucune carte cadeau BeautyHub pour le moment.', 'beautyhub-connector') . '</p>';
            return;
        }

        echo '<h2>' . esc_html__('Mes cartes cadeaux', 'beautyhub-connector') . '</h2>';
        echo '<table class="shop_table shop_table_responsive my_account_orders"><thead><tr>';
        echo '<th>' . esc_html__('Code', 'beautyhub-connector') . '</th>';
        echo '<th>' . esc_html__('Montant', 'beautyhub-connector') . '</th>';
        echo '<th>' . esc_html__('PDF', 'beautyhub-connector') . '</th>';
        echo '</tr></thead><tbody>';
        foreach ($cards as $card) {
            $code = isset($card['code']) ? (string) $card['code'] : '';
            $url = isset($card['pdf_url']) ? (string) $card['pdf_url'] : '';
            $cents = isset($card['amount_cents']) ? (int) $card['amount_cents'] : 0;
            if ($code === '') {
                continue;
            }
            echo '<tr><td data-title="Code"><strong>' . esc_html($code) . '</strong></td>';
            echo '<td data-title="Montant">' . wp_kses_post(wc_price($cents / 100)) . '</td>';
            echo '<td data-title="PDF">';
            if ($url !== '') {
                echo '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">'
                    . esc_html__('Télécharger', 'beautyhub-connector') . '</a>';
            } else {
                echo '&mdash;';
            }
            echo '</td></tr>';
        }
        echo '</tbody></table>';
    }

    /** @return array<int, array{id:string,name:string}> */
    private static function fetch_templates(): array
    {
        $base = rtrim((string) get_option('beautyhub_api_url', ''), '/');
        $token = trim((string) get_option('beautyhub_webhook_token', ''));
        $secret = trim((string) get_option('beautyhub_webhook_secret', ''));
        if ($base === '' || $token === '') {
            return [];
        }
        $signature = $secret !== '' ? 'sha256=' . hash_hmac('sha256', '', $secret) : '';
        $response = wp_remote_get($base . '/api/connectors/woocommerce/gift-templates', [
            'timeout' => 10,
            'headers' => [
                'X-BeautyHub-Token' => $token,
                'X-BeautyHub-Signature' => $signature,
            ],
        ]);
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            return [];
        }
        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
        if (!is_array($decoded) || !isset($decoded['templates']) || !is_array($decoded['templates'])) {
            return [];
        }
        $out = [];
        foreach ($decoded['templates'] as $tpl) {
            if (!is_array($tpl) || empty($tpl['id']) || empty($tpl['name'])) {
                continue;
            }
            $out[] = [
                'id' => (string) $tpl['id'],
                'name' => (string) $tpl['name'],
            ];
        }
        return $out;
    }

    public static function product_field(): void
    {
        $product_id = get_the_ID();
        $selected = (string) get_post_meta($product_id, self::META_TEMPLATE, true);
        $templates = self::fetch_templates();

        echo '<div class="options_group">';
        woocommerce_wp_checkbox([
            'id' => self::META_PRODUCT,
            'label' => __('Carte cadeau BeautyHub', 'beautyhub-connector'),
            'description' => __('À la commande terminée, BeautyHub émet une carte cadeau (solde) et un PDF.', 'beautyhub-connector'),
            'desc_tip' => true,
            'value' => get_post_meta($product_id, self::META_PRODUCT, true) === 'yes' ? 'yes' : 'no',
        ]);

        echo '<p class="form-field"><label for="' . esc_attr(self::META_TEMPLATE) . '">'
            . esc_html__('Template PDF BeautyHub', 'beautyhub-connector') . '</label>';
        echo '<select style="width:50%" id="' . esc_attr(self::META_TEMPLATE) . '" name="' . esc_attr(self::META_TEMPLATE) . '">';
        echo '<option value="">' . esc_html__('Template par défaut', 'beautyhub-connector') . '</option>';
        foreach ($templates as $tpl) {
            printf(
                '<option value="%s"%s>%s</option>',
                esc_attr($tpl['id']),
                selected($selected, $tpl['id'], false),
                esc_html($tpl['name'])
            );
        }
        echo '</select></p>';
        echo '</div>';
    }

    public static function save_product_field(int $product_id): void
    {
        $value = isset($_POST[self::META_PRODUCT]) ? 'yes' : 'no';
        update_post_meta($product_id, self::META_PRODUCT, $value);

        $template = isset($_POST[self::META_TEMPLATE])
            ? sanitize_text_field(wp_unslash((string) $_POST[self::META_TEMPLATE]))
            : '';
        update_post_meta($product_id, self::META_TEMPLATE, $template);
    }

    /**
     * @param int $loop
     * @param array<string, mixed> $variation_data
     * @param WP_Post $variation
     */
    public static function variation_field($loop, $variation_data, $variation): void
    {
        $variation_id = (int) $variation->ID;
        $selected = (string) get_post_meta($variation_id, self::META_TEMPLATE, true);
        $templates = self::fetch_templates();

        echo '<div class="form-row form-row-full">';
        echo '<label>' . esc_html__('Template PDF BeautyHub (variation)', 'beautyhub-connector') . '</label>';
        echo '<select name="beautyhub_gift_template_id[' . esc_attr((string) $loop) . ']">';
        echo '<option value="">' . esc_html__('Hériter du produit', 'beautyhub-connector') . '</option>';
        foreach ($templates as $tpl) {
            printf(
                '<option value="%s"%s>%s</option>',
                esc_attr($tpl['id']),
                selected($selected, $tpl['id'], false),
                esc_html($tpl['name'])
            );
        }
        echo '</select></div>';
    }

    public static function save_variation_field(int $variation_id, int $loop): void
    {
        $raw = isset($_POST['beautyhub_gift_template_id'][$loop])
            ? sanitize_text_field(wp_unslash((string) $_POST['beautyhub_gift_template_id'][$loop]))
            : '';
        update_post_meta($variation_id, self::META_TEMPLATE, $raw);

        $parent_id = (int) wp_get_post_parent_id($variation_id);
        if ($parent_id <= 0) {
            return;
        }

        $stored = get_post_meta($parent_id, self::META_VARIATION_MAP, true);
        $map = [];
        if (is_array($stored)) {
            $map = $stored;
        } elseif (is_string($stored) && $stored !== '') {
            $decoded = json_decode($stored, true);
            $map = is_array($decoded) ? $decoded : [];
        }

        if ($raw !== '') {
            $map[(string) $variation_id] = $raw;
        } else {
            unset($map[(string) $variation_id]);
        }
        update_post_meta($parent_id, self::META_VARIATION_MAP, wp_json_encode($map));
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
