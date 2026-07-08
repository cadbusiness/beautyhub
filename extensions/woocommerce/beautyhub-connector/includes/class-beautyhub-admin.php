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
        add_action('admin_init', [self::class, 'maybe_disconnect']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
    }

    public static function enqueue_assets(string $hook): void
    {
        if ($hook !== 'woocommerce_page_beautyhub-connector') {
            return;
        }
        wp_enqueue_style(
            'beautyhub-connector-admin',
            BEAUTYHUB_CONNECTOR_URL . 'assets/admin.css',
            [],
            BEAUTYHUB_CONNECTOR_VERSION
        );
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
        wp_safe_redirect(admin_url('admin.php?page=beautyhub-connector&beautyhub_disconnected=1'));
        exit;
    }

    public static function render_page(): void
    {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }

        $connected = BeautyHub_Pairing::is_connected();
        $api_url = (string) get_option('beautyhub_api_url', '');
        $connected_at = (string) get_option('beautyhub_connected_at', '');
        $error = isset($_GET['beautyhub_error'])
            ? sanitize_text_field(wp_unslash($_GET['beautyhub_error']))
            : '';
        $just_connected = isset($_GET['beautyhub_connected']);
        $just_disconnected = isset($_GET['beautyhub_disconnected']);
        $disconnect_url = wp_nonce_url(
            admin_url('admin.php?page=beautyhub-connector&beautyhub_disconnect=1'),
            'beautyhub_disconnect'
        );
        ?>
        <div class="bh-wrap">
            <div class="bh-card">
                <div class="bh-header">
                    <div>
                        <h1 class="bh-title">BeautyHub</h1>
                        <p class="bh-subtitle">
                            Synchronisez votre catalogue et votre stock avec la caisse BeautyHub en temps réel.
                        </p>
                    </div>
                    <span class="bh-badge <?php echo $connected ? 'bh-badge--ok' : 'bh-badge--idle'; ?>">
                        <?php echo $connected ? 'Connecté' : 'Non connecté'; ?>
                    </span>
                </div>

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
                    <div class="bh-notice bh-notice--success">
                        Votre boutique est reliée à <strong><?php echo esc_html($api_url); ?></strong>.
                        Les ventes en ligne et en caisse partagent le même stock.
                    </div>
                    <?php if ($connected_at !== '') : ?>
                        <p class="bh-meta">Connecté le <strong><?php echo esc_html($connected_at); ?></strong></p>
                    <?php endif; ?>
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
                                <p class="bh-step-title">Installez ce plugin</p>
                                <p class="bh-step-desc">Vous y êtes — le connecteur BeautyHub est actif.</p>
                            </div>
                        </li>
                        <li class="bh-step">
                            <span class="bh-step-num">2</span>
                            <div>
                                <p class="bh-step-title">Connectez depuis BeautyHub</p>
                                <p class="bh-step-desc">
                                    Dans votre back-office BeautyHub, ouvrez Compte → Institut → WooCommerce,
                                    saisissez l’URL de cette boutique et cliquez sur <strong>Connecter</strong>.
                                </p>
                            </div>
                        </li>
                        <li class="bh-step">
                            <span class="bh-step-num">3</span>
                            <div>
                                <p class="bh-step-title">Ouvrez le lien magique</p>
                                <p class="bh-step-desc">
                                    BeautyHub génère un lien sécurisé : ouvrez-le ici (admin WordPress connecté).
                                    Les clés API et webhooks se configurent automatiquement.
                                </p>
                            </div>
                        </li>
                    </ul>
                    <div class="bh-notice bh-notice--info">
                        Aucune clé API à copier-coller : la connexion se fait en un clic depuis BeautyHub.
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }
}
