<?php
/**
 * Plugin Name: BeautyHub Connector
 * Plugin URI: https://beautyhub.app
 * Description: Synchronise catalogue, stock et commandes entre WooCommerce et BeautyHub (caisse institut).
 * Version: 1.2.3
 * Author: BeautyHub
 * Update URI: https://beautyhub-two.vercel.app/api/connectors/woocommerce/updates
 * Requires at least: 6.0
 * Requires PHP: 7.1
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 * Text Domain: beautyhub-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

if (version_compare(PHP_VERSION, '7.1', '<')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p>'
            . 'BeautyHub Connector nécessite PHP 7.1 ou supérieur. Version détectée : '
            . esc_html(PHP_VERSION) . '. Contactez votre hébergeur pour mettre à jour PHP.'
            . '</p></div>';
    });
    return;
}

define('BEAUTYHUB_CONNECTOR_VERSION', '1.2.3');
define('BEAUTYHUB_CONNECTOR_PATH', plugin_dir_path(__FILE__));
define('BEAUTYHUB_CONNECTOR_URL', plugin_dir_url(__FILE__));
define('BEAUTYHUB_CONNECTOR_BASENAME', plugin_basename(__FILE__));

require_once BEAUTYHUB_CONNECTOR_PATH . 'includes/class-beautyhub-pairing.php';
require_once BEAUTYHUB_CONNECTOR_PATH . 'includes/class-beautyhub-admin.php';
require_once BEAUTYHUB_CONNECTOR_PATH . 'includes/class-beautyhub-webhooks.php';
require_once BEAUTYHUB_CONNECTOR_PATH . 'includes/class-beautyhub-updater.php';

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>BeautyHub Connector nécessite WooCommerce.</p></div>';
        });
        return;
    }

    new BeautyHub_Updater();
    BeautyHub_Admin::init();
    BeautyHub_Pairing::init();
    BeautyHub_Webhooks::init();
});

register_activation_hook(__FILE__, function () {
    set_transient('beautyhub_connector_welcome', 1, WEEK_IN_SECONDS);
});
