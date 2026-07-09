<?php

if (!defined('ABSPATH')) {
    exit;
}

if (class_exists('BeautyHub_Admin')) {
    return;
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

        $connect_base = $api_url !== '' ? rtrim($api_url, '/') : 'https://beautyhub-two.vercel.app';
        $connect_url = $connect_base . '/compte/institut/woocommerce?shop=' . rawurlencode($shop_url);
        $version = BEAUTYHUB_CONNECTOR_VERSION;
        ?>
        <div class="bh-app">
            <header class="bh-topbar">
                <div class="bh-brand">
                    <span class="bh-logo" aria-hidden="true">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="40" height="40" rx="11" fill="url(#bhLogoGrad)"/>
                            <path d="M13.6 28.4V11.6h6.9c3.1 0 5 1.6 5 4.1 0 1.7-.9 3-2.5 3.5 1.9.4 3 1.8 3 3.9 0 2.8-2 4.5-5.4 4.5h-7zm3.3-10h3c1.4 0 2.3-.7 2.3-1.9 0-1.2-.9-1.8-2.3-1.8h-3v3.7zm0 7.3h3.2c1.5 0 2.4-.7 2.4-2 0-1.3-.9-2-2.4-2h-3.2v4z" fill="#fff"/>
                            <defs>
                                <linearGradient id="bhLogoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#818cf8"/>
                                    <stop offset="1" stop-color="#0f172a"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </span>
                    <span class="bh-brand-text">
                        <span class="bh-brand-name">BeautyHub</span>
                        <span class="bh-brand-sub">Connector · WooCommerce</span>
                    </span>
                </div>
                <div class="bh-topbar-right">
                    <span class="bh-badge <?php echo $connected ? 'bh-badge--ok' : 'bh-badge--idle'; ?>">
                        <span class="bh-badge-dot"></span>
                        <?php echo $connected ? esc_html__('Connecté', 'beautyhub-connector') : esc_html__('Non connecté', 'beautyhub-connector'); ?>
                    </span>
                    <span class="bh-version">v<?php echo esc_html($version); ?></span>
                </div>
            </header>

            <?php if ($update_available) : ?>
                <div class="bh-banner">
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

            <?php if ($just_connected) : ?>
                <div class="bh-notice bh-notice--success">Boutique reliée à BeautyHub. Le stock se synchronise automatiquement.</div>
            <?php endif; ?>
            <?php if ($just_disconnected) : ?>
                <div class="bh-notice bh-notice--info">Connexion BeautyHub supprimée sur cette boutique.</div>
            <?php endif; ?>
            <?php if ($error !== '') : ?>
                <div class="bh-notice bh-notice--error">Échec de la connexion : <?php echo esc_html($error); ?></div>
            <?php endif; ?>

            <div class="bh-layout">
                <main class="bh-main">
                    <?php if ($connected) : ?>
                        <section class="bh-panel bh-panel--connected">
                            <div class="bh-connected-head">
                                <span class="bh-check" aria-hidden="true">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </span>
                                <div>
                                    <h2 class="bh-panel-title">Boutique connectée</h2>
                                    <p class="bh-panel-desc">Catalogue, stock et commandes sont synchronisés en temps réel avec BeautyHub.</p>
                                </div>
                            </div>
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
                                <a class="bh-btn bh-btn--primary" href="<?php echo esc_url($connect_base . '/compte/institut/woocommerce'); ?>" target="_blank" rel="noopener">Ouvrir BeautyHub</a>
                                <a class="bh-btn bh-btn--ghost" href="<?php echo esc_url($disconnect_url); ?>">Déconnecter</a>
                            </div>
                        </section>
                    <?php else : ?>
                        <section class="bh-hero">
                            <span class="bh-hero-icon" aria-hidden="true">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M9 7V4m6 3V4M8 7h8a2 2 0 012 2v3a6 6 0 01-6 6h-0a6 6 0 01-6-6V9a2 2 0 012-2zM12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </span>
                            <h2 class="bh-hero-title">Reliez votre boutique à BeautyHub</h2>
                            <p class="bh-hero-desc">Synchronisez catalogue, stock et commandes en un clic. Aucune clé API à copier-coller.</p>
                            <a class="bh-btn bh-btn--primary bh-btn--lg" href="<?php echo esc_url($connect_url); ?>" target="_blank" rel="noopener">
                                Se connecter
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </a>
                            <p class="bh-hero-hint">Vous serez redirigé vers votre back-office BeautyHub pour valider la connexion en toute sécurité.</p>
                        </section>

                        <section class="bh-panel">
                            <h3 class="bh-panel-subtitle">Comment ça marche</h3>
                            <ol class="bh-steps">
                                <li class="bh-step">
                                    <span class="bh-step-num">1</span>
                                    <div>
                                        <p class="bh-step-title">Plugin installé</p>
                                        <p class="bh-step-desc">Le connecteur est actif sur <?php echo esc_html($shop_url); ?>.</p>
                                    </div>
                                </li>
                                <li class="bh-step">
                                    <span class="bh-step-num">2</span>
                                    <div>
                                        <p class="bh-step-title">Cliquez sur « Se connecter »</p>
                                        <p class="bh-step-desc">Vous ouvrez votre back-office BeautyHub, déjà identifié.</p>
                                    </div>
                                </li>
                                <li class="bh-step">
                                    <span class="bh-step-num">3</span>
                                    <div>
                                        <p class="bh-step-title">Validez dans BeautyHub</p>
                                        <p class="bh-step-desc">Les clés API et webhooks se configurent automatiquement. C'est prêt.</p>
                                    </div>
                                </li>
                            </ol>
                        </section>
                    <?php endif; ?>
                </main>

                <aside class="bh-aside">
                    <div class="bh-panel bh-panel--aside">
                        <h3 class="bh-aside-title">Synchronisation temps réel</h3>
                        <ul class="bh-features">
                            <li>Stock boutique ↔ caisse</li>
                            <li>Catalogue produits</li>
                            <li>Commandes en ligne</li>
                            <li>Ventes institut (POS)</li>
                        </ul>
                        <?php if (!$connected) : ?>
                            <p class="bh-side-note">Aucune clé API à copier-coller. La connexion se fait en un clic depuis BeautyHub.</p>
                        <?php else : ?>
                            <p class="bh-side-note bh-side-note--ok">Synchronisation active. Le stock est propagé dans les deux sens.</p>
                        <?php endif; ?>
                    </div>
                </aside>
            </div>
        </div>
        <?php
    }
}
