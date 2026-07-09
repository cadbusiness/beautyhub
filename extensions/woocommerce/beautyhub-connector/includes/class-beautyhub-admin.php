<?php

if (!defined('ABSPATH')) {
    exit;
}

class BeautyHub_Admin
{
    public const PAGE_SLUG = 'beautyhub-connector';

    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_menu']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('admin_init', [self::class, 'maybe_disconnect']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_filter(
            'plugin_action_links_' . plugin_basename(BEAUTYHUB_CONNECTOR_PATH . 'beautyhub-connector.php'),
            [self::class, 'plugin_action_links']
        );
        add_action('admin_notices', [self::class, 'activation_notice']);
    }

    /** @param array<string> $links */
    public static function plugin_action_links(array $links): array
    {
        $settings = sprintf(
            '<a href="%s">%s</a>',
            esc_url(admin_url('admin.php?page=' . self::PAGE_SLUG)),
            esc_html__('Configurer', 'beautyhub-connector')
        );
        array_unshift($links, $settings);
        return $links;
    }

    public static function activation_notice(): void
    {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }
        if (BeautyHub_Pairing::is_connected()) {
            return;
        }
        if (get_transient('beautyhub_connector_welcome') === false) {
            return;
        }

        $url = admin_url('admin.php?page=' . self::PAGE_SLUG);
        echo '<div class="notice notice-info is-dismissible"><p>';
        echo wp_kses_post(
            sprintf(
                /* translators: %s: admin page URL */
                __('BeautyHub Connector est actif. <a href="%s">Ouvrir la configuration</a> pour relier votre boutique.', 'beautyhub-connector'),
                esc_url($url)
            )
        );
        echo '</p></div>';
    }

    public static function enqueue_assets(string $hook): void
    {
        if ($hook !== 'toplevel_page_' . self::PAGE_SLUG) {
            return;
        }
        wp_enqueue_style(
            'beautyhub-connector-admin',
            BEAUTYHUB_CONNECTOR_URL . 'assets/admin.css',
            [],
            BEAUTYHUB_CONNECTOR_VERSION
        );
    }

    public static function menu_icon(): string
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none">'
            . '<rect width="20" height="20" rx="5" fill="#0f172a"/>'
            . '<path d="M5 14V6h2.2l2.1 5.1L11.4 6H13.5v8h-1.6V9.1L9.9 14H8.6L6.1 9.1V14H5z" fill="#fff"/>'
            . '</svg>';

        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }

    public static function register_menu(): void
    {
        add_menu_page(
            'BeautyHub',
            'BeautyHub',
            'manage_woocommerce',
            self::PAGE_SLUG,
            [self::class, 'render_page'],
            self::menu_icon(),
            56
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

    public static function maybe_disconnect(): void
    {
        if (
            !is_admin()
            || !current_user_can('manage_woocommerce')
            || !isset($_GET['beautyhub_disconnect'])
        ) {
            return;
        }

        check_admin_referer('beautyhub_disconnect');
        BeautyHub_Pairing::disconnect();
        wp_safe_redirect(admin_url('admin.php?page=' . self::PAGE_SLUG . '&beautyhub_disconnected=1'));
        exit;
    }

    public static function render_page(): void
    {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        delete_transient('beautyhub_connector_welcome');

        $connected = BeautyHub_Pairing::is_connected();
        $api_url = (string) get_option('beautyhub_api_url', '');
        $connected_at = (string) get_option('beautyhub_connected_at', '');
        $shop_url = home_url();
        $error = isset($_GET['beautyhub_error'])
            ? sanitize_text_field(wp_unslash($_GET['beautyhub_error']))
            : '';
        $just_connected = isset($_GET['beautyhub_connected']);
        $just_disconnected = isset($_GET['beautyhub_disconnected']);
        $disconnect_url = wp_nonce_url(
            admin_url('admin.php?page=' . self::PAGE_SLUG . '&beautyhub_disconnect=1'),
            'beautyhub_disconnect'
        );

        $update_available = null;
        $cached_update = get_transient('beautyhub_connector_update_data');
        if (
            is_object($cached_update)
            && !empty($cached_update->version)
            && version_compare(BEAUTYHUB_CONNECTOR_VERSION, (string) $cached_update->version, '<')
        ) {
            $update_available = (string) $cached_update->version;
        }
        ?>
        <div class="bh-wrap">
            <?php if ($update_available) : ?>
                <div class="bh-notice bh-notice--info" style="margin-bottom:12px;">
                    <?php
                    echo wp_kses_post(
                        sprintf(
                            /* translators: 1: version, 2: plugins admin URL */
                            __('Mise à jour %1$s disponible — <a href="%2$s">Mettre à jour maintenant</a>', 'beautyhub-connector'),
                            esc_html($update_available),
                            esc_url(admin_url('plugins.php'))
                        )
                    );
                    ?>
                </div>
            <?php endif; ?>
            <div class="bh-hero">
                <div class="bh-hero-brand">
                    <span class="bh-logo" aria-hidden="true">BH</span>
                    <div>
                        <p class="bh-hero-kicker">Connecteur institut</p>
                        <h1 class="bh-title">BeautyHub</h1>
                    </div>
                </div>
                <span class="bh-badge <?php echo $connected ? 'bh-badge--ok' : 'bh-badge--idle'; ?>">
                    <span class="bh-badge-dot" aria-hidden="true"></span>
                    <?php echo $connected ? esc_html__('Connecté', 'beautyhub-connector') : esc_html__('En attente', 'beautyhub-connector'); ?>
                </span>
            </div>

            <div class="bh-grid">
                <div class="bh-card bh-card--main">
                    <p class="bh-subtitle">
                        Synchronisez catalogue, stock et commandes entre cette boutique et la caisse BeautyHub.
                    </p>

                    <?php if ($just_connected) : ?>
                        <div class="bh-notice bh-notice--success">
                            Boutique reliée à BeautyHub. Le stock se synchronise automatiquement.
                        </div>
                    <?php endif; ?>

                    <?php if ($just_disconnected) : ?>
                        <div class="bh-notice bh-notice--info">
                            Connexion BeautyHub supprimée sur cette boutique.
                        </div>
                    <?php endif; ?>

                    <?php if ($error !== '') : ?>
                        <div class="bh-notice bh-notice--error">
                            Échec de la connexion : <?php echo esc_html($error); ?>
                        </div>
                    <?php endif; ?>

                    <?php if ($connected) : ?>
                        <div class="bh-status-grid">
                            <div class="bh-stat">
                                <span class="bh-stat-label">Boutique</span>
                                <span class="bh-stat-value"><?php echo esc_html($shop_url); ?></span>
                            </div>
                            <div class="bh-stat">
                                <span class="bh-stat-label">BeautyHub</span>
                                <span class="bh-stat-value"><?php echo esc_html($api_url); ?></span>
                            </div>
                            <?php if ($connected_at !== '') : ?>
                                <div class="bh-stat">
                                    <span class="bh-stat-label">Connecté le</span>
                                    <span class="bh-stat-value"><?php echo esc_html($connected_at); ?></span>
                                </div>
                            <?php endif; ?>
                        </div>
                        <div class="bh-actions">
                            <a class="bh-btn bh-btn--ghost" href="<?php echo esc_url($disconnect_url); ?>">
                                Déconnecter
                            </a>
                        </div>
                    <?php else : ?>
                        <ul class="bh-steps">
                            <li class="bh-step">
                                <span class="bh-step-num">1</span>
                                <div>
                                    <p class="bh-step-title">Plugin installé</p>
                                    <p class="bh-step-desc">Le connecteur BeautyHub est actif sur <?php echo esc_html($shop_url); ?>.</p>
                                </div>
                            </li>
                            <li class="bh-step">
                                <span class="bh-step-num">2</span>
                                <div>
                                    <p class="bh-step-title">Connectez depuis BeautyHub</p>
                                    <p class="bh-step-desc">
                                        Back-office BeautyHub → Compte → Institut → WooCommerce.
                                        Saisissez l’URL de cette boutique et cliquez sur <strong>Connecter</strong>.
                                    </p>
                                </div>
                            </li>
                            <li class="bh-step">
                                <span class="bh-step-num">3</span>
                                <div>
                                    <p class="bh-step-title">Ouvrez le lien magique ici</p>
                                    <p class="bh-step-desc">
                                        Restez connecté à WordPress et ouvrez le lien généré par BeautyHub.
                                        Tout se configure automatiquement.
                                    </p>
                                </div>
                            </li>
                        </ul>
                    <?php endif; ?>
                </div>

                <aside class="bh-card bh-card--side">
                    <h2 class="bh-side-title">Sync temps réel</h2>
                    <ul class="bh-features">
                        <li>Stock boutique ↔ caisse</li>
                        <li>Catalogue produits</li>
                        <li>Commandes en ligne</li>
                        <li>Ventes institut (POS)</li>
                    </ul>
                    <?php if (!$connected) : ?>
                        <p class="bh-side-note">
                            Aucune clé API à copier-coller. La connexion se fait en un clic depuis BeautyHub.
                        </p>
                    <?php else : ?>
                        <p class="bh-side-note bh-side-note--ok">
                            Synchronisation active. Les changements de stock sont propagés dans les deux sens.
                        </p>
                    <?php endif; ?>
                </aside>
            </div>
        </div>
        <?php
    }
}
