<?php

if (!defined('ABSPATH')) {
    exit;
}

class BeautyHub_Admin
{
    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_menu']);
        add_action('admin_init', [self::class, 'register_settings']);
    }

    public static function register_menu(): void
    {
        add_submenu_page(
            'woocommerce',
            'BeautyHub',
            'BeautyHub',
            'manage_woocommerce',
            'beautyhub-connector',
            [self::class, 'render_page']
        );
    }

    public static function register_settings(): void
    {
        register_setting('beautyhub_connector', 'beautyhub_api_url', [
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => '',
        ]);
        register_setting('beautyhub_connector', 'beautyhub_webhook_token', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => '',
        ]);
        register_setting('beautyhub_connector', 'beautyhub_webhook_secret', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => '',
        ]);
    }

    public static function render_page(): void
    {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $api_url = get_option('beautyhub_api_url', '');
        $token = get_option('beautyhub_webhook_token', '');
        $secret = get_option('beautyhub_webhook_secret', '');
        ?>
        <div class="wrap">
            <h1>BeautyHub Connector</h1>
            <p>Connectez votre boutique WooCommerce à BeautyHub pour synchroniser le catalogue et le stock en temps réel.</p>

            <form method="post" action="options.php">
                <?php settings_fields('beautyhub_connector'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="beautyhub_api_url">URL BeautyHub</label></th>
                        <td>
                            <input type="url" id="beautyhub_api_url" name="beautyhub_api_url"
                                   value="<?php echo esc_attr($api_url); ?>" class="regular-text"
                                   placeholder="https://votre-institut.beautyhub.app" required />
                            <p class="description">URL de votre back-office BeautyHub (sans slash final).</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="beautyhub_webhook_token">Token webhook</label></th>
                        <td>
                            <input type="text" id="beautyhub_webhook_token" name="beautyhub_webhook_token"
                                   value="<?php echo esc_attr($token); ?>" class="regular-text" required />
                            <p class="description">Copiez le token depuis Compte → Institut → WooCommerce dans BeautyHub.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="beautyhub_webhook_secret">Secret webhook</label></th>
                        <td>
                            <input type="password" id="beautyhub_webhook_secret" name="beautyhub_webhook_secret"
                                   value="<?php echo esc_attr($secret); ?>" class="regular-text" required />
                            <p class="description">Secret affiché dans BeautyHub (ne le partagez pas).</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Enregistrer'); ?>
            </form>

            <hr />
            <h2>Clés API REST</h2>
            <p>Générez des clés WooCommerce (Réglages → Avancé → API REST) avec permissions <strong>Lecture/Écriture</strong>, puis saisissez-les dans BeautyHub.</p>
            <p><a class="button" href="<?php echo esc_url(admin_url('admin.php?page=wc-settings&tab=advanced&section=keys')); ?>">Gérer les clés API</a></p>
        </div>
        <?php
    }
}
