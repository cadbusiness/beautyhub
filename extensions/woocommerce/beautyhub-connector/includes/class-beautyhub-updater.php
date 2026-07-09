<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Mises à jour automatiques depuis BeautyHub (même principe que Bruce Pilot).
 */
class BeautyHub_Updater
{
    private string $slug;
    private string $basename;
    private string $version;
    private ?object $update_data = null;

    public function __construct()
    {
        $this->slug     = 'beautyhub-connector';
        $this->basename = defined('BEAUTYHUB_CONNECTOR_BASENAME')
            ? BEAUTYHUB_CONNECTOR_BASENAME
            : plugin_basename(BEAUTYHUB_CONNECTOR_PATH . 'beautyhub-connector.php');
        $this->version  = BEAUTYHUB_CONNECTOR_VERSION;

        add_filter('pre_set_site_transient_update_plugins', [$this, 'check_for_update']);
        add_filter('plugins_api', [$this, 'plugin_info'], 20, 3);
        add_filter('upgrader_post_install', [$this, 'after_install'], 10, 3);
        add_action('upgrader_process_complete', [$this, 'on_upgrader_process_complete'], 10, 2);
        add_action('admin_init', [$this, 'maybe_nudge_update_check'], 5);
        add_action(
            'in_plugin_update_message-' . $this->basename,
            [$this, 'update_message'],
            10,
            2
        );
    }

    private function get_update_api_url(): string
    {
        $api = rtrim((string) get_option('beautyhub_api_url', ''), '/');
        if ($api !== '') {
            return $api . '/api/connectors/woocommerce/updates';
        }

        return 'https://beautyhub-two.vercel.app/api/connectors/woocommerce/updates';
    }

    private function get_allowed_hosts(): array
    {
        $hosts = ['beautyhub-two.vercel.app', 'beautyhub.app', 'www.beautyhub.app'];

        $api_host = wp_parse_url($this->get_update_api_url(), PHP_URL_HOST);
        if (is_string($api_host) && $api_host !== '') {
            $hosts[] = strtolower($api_host);
        }

        $download_host = wp_parse_url($this->get_download_url_fallback(), PHP_URL_HOST);
        if (is_string($download_host) && $download_host !== '') {
            $hosts[] = strtolower($download_host);
        }

        return array_values(array_unique($hosts));
    }

    private function get_download_url_fallback(): string
    {
        $api = rtrim((string) get_option('beautyhub_api_url', ''), '/');
        $base = $api !== '' ? $api : 'https://beautyhub-two.vercel.app';
        return $base . '/downloads/beautyhub-connector.zip';
    }

    private function is_valid_download_url(string $url): bool
    {
        if ($url === '') {
            return false;
        }

        $parsed = wp_parse_url($url);
        if (!is_array($parsed)) {
            return false;
        }

        $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
        $host = strtolower((string) ($parsed['host'] ?? ''));

        return $scheme === 'https' && $host !== '' && in_array($host, $this->get_allowed_hosts(), true);
    }

    public function maybe_nudge_update_check(): void
    {
        if (!is_admin() || !current_user_can('update_plugins')) {
            return;
        }

        $page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
        if ($page !== BeautyHub_Admin::PAGE_SLUG) {
            return;
        }

        $key = 'beautyhub_update_nudge';
        if (get_transient($key)) {
            return;
        }

        set_transient($key, 1, 6 * HOUR_IN_SECONDS);
        $this->clear_update_cache();
        $this->get_update_data(true);

        if (function_exists('wp_update_plugins')) {
            if (!function_exists('wp_clean_update_cache')) {
                require_once ABSPATH . 'wp-admin/includes/update.php';
            }
            wp_update_plugins();
        }
    }

    public function check_for_update($transient)
    {
        if (empty($transient->checked)) {
            return $transient;
        }

        unset($transient->response[$this->basename], $transient->no_update[$this->basename]);

        $force = is_admin()
            && current_user_can('update_plugins')
            && (isset($_GET['force-check']) || isset($_GET['beautyhub-force-update-check']));

        $update_data = $this->get_update_data($force);
        if (!$update_data || empty($update_data->version)) {
            return $transient;
        }

        $installed = isset($transient->checked[$this->basename])
            ? (string) $transient->checked[$this->basename]
            : $this->version;

        $package = (string) ($update_data->download_url ?? '');
        if ($package !== '' && !$this->is_valid_download_url($package)) {
            $package = '';
        }

        if (version_compare($installed, $update_data->version, '<') && $package !== '') {
            $transient->response[$this->basename] = (object) [
                'slug'        => $this->slug,
                'plugin'      => $this->basename,
                'new_version' => $update_data->version,
                'url'         => $update_data->homepage ?? 'https://beautyhub.app',
                'package'     => $package,
                'tested'      => $update_data->tested_wp ?? '',
                'requires_php' => $update_data->requires_php ?? '7.4',
            ];
        } else {
            $transient->no_update[$this->basename] = (object) [
                'slug'        => $this->slug,
                'plugin'      => $this->basename,
                'new_version' => $installed,
                'url'         => $update_data->homepage ?? 'https://beautyhub.app',
                'package'     => '',
            ];
        }

        return $transient;
    }

    private function get_update_data(bool $force = false): ?object
    {
        if ($this->update_data !== null && !$force) {
            return $this->update_data;
        }

        $cache_key = 'beautyhub_connector_update_data';
        $cached = get_transient($cache_key);
        if ($cached !== false && !$force) {
            $this->update_data = $cached;
            return $this->update_data;
        }

        $response = wp_remote_get(
            add_query_arg(
                [
                    'action'  => 'check_update',
                    'slug'    => $this->slug,
                    'version' => $this->version,
                    'site'    => home_url(),
                ],
                $this->get_update_api_url()
            ),
            [
                'timeout' => 15,
                'headers' => ['Accept' => 'application/json'],
            ]
        );

        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            return null;
        }

        $body = json_decode(wp_remote_retrieve_body($response));
        if (!is_object($body) || empty($body->version)) {
            return null;
        }

        if (empty($body->download_url)) {
            $body->download_url = $this->get_download_url_fallback();
        }

        $this->update_data = $body;
        set_transient($cache_key, $this->update_data, HOUR_IN_SECONDS);

        return $this->update_data;
    }

    public function plugin_info($result, $action, $args)
    {
        if ($action !== 'plugin_information' || ($args->slug ?? '') !== $this->slug) {
            return $result;
        }

        $update_data = $this->get_update_data(true);
        if (!$update_data) {
            return $result;
        }

        $download = (string) ($update_data->download_url ?? '');
        if ($download !== '' && !$this->is_valid_download_url($download)) {
            $download = '';
        }

        return (object) [
            'name'          => $update_data->name ?? 'BeautyHub Connector',
            'slug'          => $this->slug,
            'version'       => $update_data->version,
            'author'        => '<a href="https://beautyhub.app">BeautyHub</a>',
            'author_profile'=> 'https://beautyhub.app',
            'requires'      => '6.0',
            'tested'        => $update_data->tested_wp ?? '6.7',
            'requires_php'  => $update_data->requires_php ?? '7.4',
            'download_link' => $download,
            'sections'      => [
                'description'  => $update_data->description ?? '',
                'installation' => $update_data->installation ?? '',
                'changelog'    => $update_data->changelog ?? '',
            ],
        ];
    }

    public function after_install($response, $hook_extra, $result)
    {
        global $wp_filesystem;

        if (!$response || is_wp_error($response)) {
            return $response;
        }

        if (($hook_extra['plugin'] ?? '') !== $this->basename) {
            return $response;
        }

        if (($hook_extra['action'] ?? '') === 'update') {
            return $response;
        }

        if (empty($result['destination']) || !$wp_filesystem) {
            return $response;
        }

        $plugin_folder = WP_PLUGIN_DIR . '/' . dirname($this->basename);
        $destination = untrailingslashit($result['destination']);

        if ($destination !== $plugin_folder && !$wp_filesystem->exists($plugin_folder)) {
            $moved = $wp_filesystem->move($destination, $plugin_folder, true);
            if (!$moved) {
                return new WP_Error(
                    'beautyhub_install_move_failed',
                    __('Impossible de déplacer le plugin vers le bon dossier.', 'beautyhub-connector')
                );
            }
        }

        if (!is_plugin_active($this->basename)) {
            activate_plugin($this->basename);
        }

        return $response;
    }

    public function update_message($plugin_data, $response): void
    {
        echo '<br><span style="color:#1d4ed8;">'
            . esc_html__('Mise à jour BeautyHub : clic sur « mettre à jour » remplace les fichiers automatiquement.', 'beautyhub-connector')
            . '</span>';
    }

    public function on_upgrader_process_complete($upgrader, $hook_extra): void
    {
        if (!is_array($hook_extra) || ($hook_extra['type'] ?? '') !== 'plugin') {
            return;
        }

        $plugins = $hook_extra['plugins'] ?? [];
        if (($hook_extra['plugin'] ?? '') === $this->basename || in_array($this->basename, $plugins, true)) {
            $this->clear_update_cache();
        }
    }

    private function clear_update_cache(): void
    {
        delete_transient('beautyhub_connector_update_data');
        delete_site_transient('update_plugins');
        $this->update_data = null;
    }

    /** @return array{version:string,package:string}|null */
    public function get_available_update(bool $force = false): ?array
    {
        $data = $this->get_update_data($force);
        if (!$data || empty($data->version)) {
            return null;
        }

        if (version_compare(BEAUTYHUB_CONNECTOR_VERSION, $data->version, '>=')) {
            return null;
        }

        $package = (string) ($data->download_url ?? '');
        if ($package === '' || !$this->is_valid_download_url($package)) {
            return null;
        }

        return ['version' => $data->version, 'package' => $package];
    }
}
