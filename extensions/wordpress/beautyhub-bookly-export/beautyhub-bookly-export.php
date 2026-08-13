<?php
/**
 * Plugin Name: BeautyHub — Export Bookly (services & extras)
 * Description: Exporte les services et extras Bookly en CSV / JSON pour migration BeautyHub.
 * Version: 1.0.0
 * Author: BeautyHub
 * Requires at least: 5.8
 * Requires PHP: 7.4
 *
 * Installation rapide :
 * 1. Copier ce dossier dans wp-content/plugins/ (ou le fichier seul dans mu-plugins/)
 * 2. Activer le plugin
 * 3. Aller dans Outils → Export Bookly
 *
 * Alternative Code Snippets : coller tout le contenu de ce fichier (sauf l’en-tête Plugin Name
 * si le snippet est déjà nommé), puis ouvrir Outils → Export Bookly.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class BeautyHub_Bookly_Export {
	const PAGE_SLUG = 'beautyhub-bookly-export';
	const NONCE     = 'beautyhub_bookly_export';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'maybe_download' ) );
	}

	public static function register_menu() {
		add_management_page(
			'Export Bookly → BeautyHub',
			'Export Bookly',
			'manage_options',
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);
	}

	public static function maybe_download() {
		if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( empty( $_GET['page'] ) || self::PAGE_SLUG !== $_GET['page'] ) {
			return;
		}
		if ( empty( $_GET['bh_export'] ) ) {
			return;
		}

		check_admin_referer( self::NONCE );

		$type = sanitize_key( wp_unslash( $_GET['bh_export'] ) );
		$data = self::collect();

		switch ( $type ) {
			case 'services_csv':
				self::send_csv( 'bookly-services.csv', self::services_csv_rows( $data['services'] ) );
				break;
			case 'extras_csv':
				self::send_csv( 'bookly-extras.csv', self::extras_csv_rows( $data['extras'] ) );
				break;
			case 'json':
				self::send_json(
					'bookly-services-extras.json',
					array(
						'exported_at'     => gmdate( 'c' ),
						'site_url'        => home_url( '/' ),
						'services_table'  => $data['services_table'],
						'extras_table'    => $data['extras_table'],
						'categories'      => $data['categories'],
						'services'        => $data['services'],
						'extras'          => $data['extras'],
						'counts'          => array(
							'services' => count( $data['services'] ),
							'extras'   => count( $data['extras'] ),
						),
					)
				);
				break;
			default:
				wp_die( 'Export inconnu.' );
		}
	}

	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Accès refusé.' );
		}

		$data   = self::collect();
		$base   = admin_url( 'tools.php?page=' . self::PAGE_SLUG );
		$nonce  = wp_create_nonce( self::NONCE );
		$svc_n  = count( $data['services'] );
		$ext_n  = count( $data['extras'] );
		$cat_n  = count( $data['categories'] );

		echo '<div class="wrap">';
		echo '<h1>Export Bookly → BeautyHub</h1>';
		echo '<p>Exporte le catalogue Bookly (prestations + extras) pour migration vers BeautyHub.</p>';

		echo '<table class="widefat striped" style="max-width:640px;margin:16px 0;">';
		echo '<tbody>';
		echo '<tr><th>Table services</th><td>' . esc_html( $data['services_table'] ? $data['services_table'] : 'introuvable' ) . '</td></tr>';
		echo '<tr><th>Table extras</th><td>' . esc_html( $data['extras_table'] ? $data['extras_table'] : 'introuvable (addon Service Extras ?)' ) . '</td></tr>';
		echo '<tr><th>Catégories</th><td>' . esc_html( (string) $cat_n ) . '</td></tr>';
		echo '<tr><th>Services</th><td><strong>' . esc_html( (string) $svc_n ) . '</strong></td></tr>';
		echo '<tr><th>Extras</th><td><strong>' . esc_html( (string) $ext_n ) . '</strong></td></tr>';
		echo '</tbody></table>';

		if ( ! $data['services_table'] ) {
			echo '<div class="notice notice-error"><p>Aucune table <code>*bookly_services</code> trouvée. Vérifie que Bookly est installé sur ce site.</p></div>';
			echo '</div>';
			return;
		}

		$link = function ( $export, $label ) use ( $base, $nonce ) {
			$url = add_query_arg(
				array(
					'bh_export'   => $export,
					'_wpnonce'    => $nonce,
				),
				$base
			);
			printf(
				'<p><a class="button button-primary" href="%s">%s</a></p>',
				esc_url( $url ),
				esc_html( $label )
			);
		};

		$link( 'services_csv', 'Télécharger services (CSV)' );
		$link( 'extras_csv', 'Télécharger extras (CSV)' );
		$link( 'json', 'Télécharger tout (JSON)' );

		if ( $svc_n > 0 ) {
			echo '<h2 style="margin-top:24px;">Aperçu services (20 premiers)</h2>';
			echo '<table class="widefat striped"><thead><tr>';
			echo '<th>ID</th><th>Titre</th><th>Catégorie</th><th>Durée (min)</th><th>Prix</th><th>Visibilité</th><th>Extras liés</th>';
			echo '</tr></thead><tbody>';
			$i = 0;
			foreach ( $data['services'] as $s ) {
				if ( $i++ >= 20 ) {
					break;
				}
				$extra_count = 0;
				foreach ( $data['extras'] as $e ) {
					if ( (int) $e['service_id'] === (int) $s['id'] ) {
						$extra_count++;
					}
				}
				printf(
					'<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%d</td></tr>',
					(int) $s['id'],
					esc_html( (string) $s['title'] ),
					esc_html( (string) $s['category_name'] ),
					esc_html( (string) $s['duration_min'] ),
					esc_html( (string) $s['price'] ),
					esc_html( (string) $s['visibility'] ),
					$extra_count
				);
			}
			echo '</tbody></table>';
		}

		if ( $ext_n > 0 ) {
			echo '<h2 style="margin-top:24px;">Aperçu extras (20 premiers)</h2>';
			echo '<table class="widefat striped"><thead><tr>';
			echo '<th>ID</th><th>Extra</th><th>Service parent</th><th>Durée (min)</th><th>Prix</th><th>Min</th><th>Max</th>';
			echo '</tr></thead><tbody>';
			$i = 0;
			foreach ( $data['extras'] as $e ) {
				if ( $i++ >= 20 ) {
					break;
				}
				printf(
					'<tr><td>%d</td><td>%s</td><td>%s (#%d)</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
					(int) $e['id'],
					esc_html( (string) $e['title'] ),
					esc_html( (string) $e['service_title'] ),
					(int) $e['service_id'],
					esc_html( (string) $e['duration_min'] ),
					esc_html( (string) $e['price'] ),
					esc_html( (string) $e['min_quantity'] ),
					esc_html( (string) $e['max_quantity'] )
				);
			}
			echo '</tbody></table>';
		}

		echo '</div>';
	}

	/** @return array{services_table:?string,extras_table:?string,categories:array,services:array,extras:array} */
	private static function collect() {
		global $wpdb;

		$services_table = self::find_table( array( 'bookly_services' ) );
		$extras_table   = self::find_table( array( 'bookly_extras' ) );
		$cats_table     = self::find_table( array( 'bookly_categories' ) );

		$categories = array();
		if ( $cats_table ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$rows = $wpdb->get_results( "SELECT * FROM `{$cats_table}` ORDER BY id ASC", ARRAY_A );
			foreach ( (array) $rows as $row ) {
				$id = (int) ( $row['id'] ?? 0 );
				$categories[ $id ] = array(
					'id'   => $id,
					'name' => (string) ( $row['name'] ?? $row['title'] ?? '' ),
				);
			}
		}

		$services = array();
		if ( $services_table ) {
			$cols = self::table_columns( $services_table );
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$rows = $wpdb->get_results( "SELECT * FROM `{$services_table}` ORDER BY id ASC", ARRAY_A );
			foreach ( (array) $rows as $row ) {
				$cat_id = isset( $row['category_id'] ) ? (int) $row['category_id'] : 0;
				$duration_sec = isset( $row['duration'] ) ? (int) $row['duration'] : 0;
				$services[] = array(
					'id'                 => (int) ( $row['id'] ?? 0 ),
					'category_id'        => $cat_id ?: null,
					'category_name'      => $cat_id && isset( $categories[ $cat_id ] ) ? $categories[ $cat_id ]['name'] : '',
					'title'              => (string) ( $row['title'] ?? '' ),
					'info'               => (string) ( $row['info'] ?? '' ),
					'duration_sec'       => $duration_sec,
					'duration_min'       => (int) round( $duration_sec / 60 ),
					'price'              => self::normalize_price( $row['price'] ?? 0 ),
					'price_cents'        => self::price_to_cents( $row['price'] ?? 0 ),
					'color'              => (string) ( $row['color'] ?? '' ),
					'visibility'         => (string) ( $row['visibility'] ?? 'public' ),
					'type'               => (string) ( $row['type'] ?? 'simple' ),
					'padding_left_sec'   => isset( $row['padding_left'] ) ? (int) $row['padding_left'] : 0,
					'padding_right_sec'  => isset( $row['padding_right'] ) ? (int) $row['padding_right'] : 0,
					'buffer_before_min'  => isset( $row['padding_left'] ) ? (int) round( (int) $row['padding_left'] / 60 ) : 0,
					'buffer_after_min'   => isset( $row['padding_right'] ) ? (int) round( (int) $row['padding_right'] / 60 ) : 0,
					'position'           => isset( $row['position'] ) ? (int) $row['position'] : 0,
					'raw'                => self::filter_raw( $row, $cols ),
				);
			}
		}

		$service_titles = array();
		foreach ( $services as $s ) {
			$service_titles[ (int) $s['id'] ] = $s['title'];
		}

		$extras = array();
		if ( $extras_table ) {
			$cols = self::table_columns( $extras_table );
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$rows = $wpdb->get_results( "SELECT * FROM `{$extras_table}` ORDER BY service_id ASC, position ASC, id ASC", ARRAY_A );
			foreach ( (array) $rows as $row ) {
				$service_id   = (int) ( $row['service_id'] ?? 0 );
				$duration_sec = isset( $row['duration'] ) ? (int) $row['duration'] : 0;
				$min_q = isset( $row['min_quantity'] ) ? (int) $row['min_quantity'] : ( isset( $row['min_qty'] ) ? (int) $row['min_qty'] : 0 );
				$max_q = isset( $row['max_quantity'] ) ? (int) $row['max_quantity'] : ( isset( $row['max_qty'] ) ? (int) $row['max_qty'] : 1 );
				$attachment_id = isset( $row['attachment_id'] ) ? (int) $row['attachment_id'] : 0;
				$image_url = $attachment_id ? (string) wp_get_attachment_url( $attachment_id ) : '';

				$extras[] = array(
					'id'             => (int) ( $row['id'] ?? 0 ),
					'service_id'     => $service_id,
					'service_title'  => $service_titles[ $service_id ] ?? '',
					'title'          => (string) ( $row['title'] ?? '' ),
					'duration_sec'   => $duration_sec,
					'duration_min'   => (int) round( $duration_sec / 60 ),
					'price'          => self::normalize_price( $row['price'] ?? 0 ),
					'price_cents'    => self::price_to_cents( $row['price'] ?? 0 ),
					'min_quantity'   => $min_q,
					'max_quantity'   => $max_q,
					'position'       => isset( $row['position'] ) ? (int) $row['position'] : 0,
					'attachment_id'  => $attachment_id ?: null,
					'image_url'      => $image_url,
					'raw'            => self::filter_raw( $row, $cols ),
				);
			}
		}

		return array(
			'services_table' => $services_table,
			'extras_table'   => $extras_table,
			'categories'     => array_values( $categories ),
			'services'       => $services,
			'extras'         => $extras,
		);
	}

	/** @param string[] $suffixes */
	private static function find_table( array $suffixes ) {
		global $wpdb;

		static $all_tables = null;
		if ( null === $all_tables ) {
			$all_tables = $wpdb->get_col( 'SHOW TABLES' );
		}

		foreach ( $suffixes as $suffix ) {
			$exact = $wpdb->prefix . $suffix;
			foreach ( (array) $all_tables as $table ) {
				if ( $table === $exact || substr( (string) $table, -strlen( $suffix ) ) === $suffix ) {
					return (string) $table;
				}
			}
		}

		return null;
	}

	/** @return string[] */
	private static function table_columns( $table ) {
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols = $wpdb->get_col( "SHOW COLUMNS FROM `{$table}`" );
		return array_map( 'strval', (array) $cols );
	}

	private static function filter_raw( array $row, array $cols ) {
		$out = array();
		foreach ( $cols as $col ) {
			if ( array_key_exists( $col, $row ) ) {
				$out[ $col ] = $row[ $col ];
			}
		}
		return $out;
	}

	private static function normalize_price( $price ) {
		if ( is_string( $price ) ) {
			$price = str_replace( ',', '.', $price );
		}
		return number_format( (float) $price, 2, '.', '' );
	}

	private static function price_to_cents( $price ) {
		if ( is_string( $price ) ) {
			$price = str_replace( ',', '.', $price );
		}
		return (int) round( (float) $price * 100 );
	}

	private static function services_csv_rows( array $services ) {
		$rows   = array();
		$rows[] = array(
			'bookly_id',
			'title',
			'category_id',
			'category_name',
			'duration_min',
			'price',
			'price_cents',
			'color',
			'visibility',
			'type',
			'buffer_before_min',
			'buffer_after_min',
			'info',
			'position',
		);
		foreach ( $services as $s ) {
			$rows[] = array(
				$s['id'],
				$s['title'],
				$s['category_id'],
				$s['category_name'],
				$s['duration_min'],
				$s['price'],
				$s['price_cents'],
				$s['color'],
				$s['visibility'],
				$s['type'],
				$s['buffer_before_min'],
				$s['buffer_after_min'],
				$s['info'],
				$s['position'],
			);
		}
		return $rows;
	}

	private static function extras_csv_rows( array $extras ) {
		$rows   = array();
		$rows[] = array(
			'bookly_extra_id',
			'title',
			'service_id',
			'service_title',
			'duration_min',
			'price',
			'price_cents',
			'min_quantity',
			'max_quantity',
			'position',
			'image_url',
		);
		foreach ( $extras as $e ) {
			$rows[] = array(
				$e['id'],
				$e['title'],
				$e['service_id'],
				$e['service_title'],
				$e['duration_min'],
				$e['price'],
				$e['price_cents'],
				$e['min_quantity'],
				$e['max_quantity'],
				$e['position'],
				$e['image_url'],
			);
		}
		return $rows;
	}

	private static function send_csv( $filename, array $rows ) {
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo "\xEF\xBB\xBF"; // BOM Excel
		$out = fopen( 'php://output', 'w' );
		foreach ( $rows as $row ) {
			fputcsv( $out, $row, ';' );
		}
		fclose( $out );
		exit;
	}

	private static function send_json( $filename, array $payload ) {
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		exit;
	}
}

BeautyHub_Bookly_Export::init();
