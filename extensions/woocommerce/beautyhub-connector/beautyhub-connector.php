<?php
/**
 * Plugin Name: BeautyHub Connector
 * Plugin URI: https://beautyhub.app
 * Description: Synchronise catalogue, stock et commandes entre WooCommerce et BeautyHub (caisse institut).
 * Version: 1.0.0
 * Author: BeautyHub
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 * Text Domain: beautyhub-connector
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BEAUTYHUB_CONNECTOR_VERSION', '1.0.0');
define('BEAUTYHUB_CONNECTOR_PATH', plugin_dir_path(__FILE__));
define('BEAUTYHUB_CONNECTOR_URL', plugin_dir_url(__FILE__));

require_once BEAUTYHUB_CONNECTOR_PATH . 'includes/class-beautyhub-admin.php';
require_once BEAUTYHUB_CONNECTOR_PATH . 'includes/class-beautyhub-webhooks.php';

add_action('plugins_loaded', function () {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>BeautyHub Connector nécessite WooCommerce.</p></div>';
        });
        return;
    }

    BeautyHub_Admin::init();
    BeautyHub_Webhooks::init();
});

register_activation_hook(__FILE__, function () {
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die('WooCommerce doit être installé et activé.');
    }
});
