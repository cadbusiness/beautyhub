<?php
/**
 * Plugin Name: BeautyHub - Export Bookly (services & extras)
 * Description: Exporte les services et extras Bookly en CSV / JSON pour migration BeautyHub.
 * Version: 1.1.0
 * Author: BeautyHub
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'BeautyHub_Bookly_Export' ) ) :

final class BeautyHub_Bookly_Export {
	const PAGE_SLUG = 'beautyhub-bookly-export';
	const NONCE     = 'beautyhub_bookly_export';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'maybe_download' ) );
	}

	public static function register_menu() {
		add_management_page(
			'Export Bookly BeautyHub',
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

		if ( 'services_csv' === $type ) {
			self::send_csv( 'bookly-services.csv', self::services_csv_rows( $data['services'] ) );
		} elseif ( 'extras_csv' === $type ) {
			self::send_csv( 'bookly-extras.csv', self::extras_csv_rows( $data['extras'] ) );
		} elseif ( 'json' === $type ) {
			self::send_json(
				'bookly-services-extras.json',
				array(
					'exported_at'    => gmdate( 'c' ),
					'site_url'       => home_url( '/' ),
					'services_table' => $data['services_table'],
					'extras_table'   => $data['extras_table'],
					'categories'     => $data['categories'],
					'services'       => $data['services'],
					'extras'         => $data['extras'],
					'counts'         => array(
						'services' => count( $data['services'] ),
						'extras'   => count( $data['extras'] ),
					),
				)
			);
		} else {
			wp_die( 'Export inconnu.' );
		}
	}

	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Acces refuse.' );
		}

		$data  = self::collect();
		$base  = admin_url( 'tools.php?page=' . self::PAGE_SLUG );
		$nonce = wp_create_nonce( self::NONCE );
		$svc_n = count( $data['services'] );
		$ext_n = count( $data['extras'] );
		$cat_n = count( $data['categories'] );

		echo '<div class="wrap">';
		echo '<h1>Export Bookly - BeautyHub</h1>';
		echo '<p>Exporte le catalogue Bookly (prestations + extras) pour migration vers BeautyHub.</p>';

		echo '<table class="widefat striped" style="max-width:640px;margin:16px 0;"><tbody>';
		echo '<tr><th>Table services</th><td>' . esc_html( $data['services_table'] ? $data['services_table'] : 'introuvable' ) . '</td></tr>';
		echo '<tr><th>Table extras</th><td>' . esc_html( $data['extras_table'] ? $data['extras_table'] : 'introuvable (voir diagnostic ci-dessous)' ) . '</td></tr>';
		echo '<tr><th>Categories</th><td>' . esc_html( (string) $cat_n ) . '</td></tr>';
		echo '<tr><th>Services</th><td><strong>' . esc_html( (string) $svc_n ) . '</strong></td></tr>';
		echo '<tr><th>Extras</th><td><strong>' . esc_html( (string) $ext_n ) . '</strong></td></tr>';
		echo '</tbody></table>';

		if ( ! empty( $data['diagnostic'] ) ) {
			echo '<h2 style="margin-top:24px;">Diagnostic - tables Bookly detectees</h2>';
			echo '<p style="max-width:720px;">Si la table extras est marquee "introuvable" mais que le client a bien des extras dans Bookly, envoie-nous une capture de ce tableau. Le nom exact de la table depend de la version et des addons installes.</p>';
			echo '<table class="widefat striped" style="max-width:720px;"><thead><tr>';
			echo '<th>Table</th><th style="text-align:right;">Lignes</th>';
			echo '</tr></thead><tbody>';
			foreach ( $data['diagnostic'] as $row ) {
				$highlight = ( stripos( $row['short'], 'extra' ) !== false ) ? ' style="background:#fff8c5;"' : '';
				echo '<tr' . $highlight . '>';
				echo '<td><code>' . esc_html( $row['table'] ) . '</code></td>';
				echo '<td style="text-align:right;"><strong>' . esc_html( (string) $row['rows'] ) . '</strong></td>';
				echo '</tr>';
			}
			echo '</tbody></table>';
		}

		if ( ! $data['services_table'] ) {
			echo '<div class="notice notice-error"><p>Aucune table bookly_services trouvee. Verifie que Bookly est installe.</p></div>';
			echo '</div>';
			return;
		}

		self::echo_download_button( $base, $nonce, 'services_csv', 'Telecharger services (CSV)' );
		self::echo_download_button( $base, $nonce, 'extras_csv', 'Telecharger extras (CSV)' );
		self::echo_download_button( $base, $nonce, 'json', 'Telecharger tout (JSON)' );

		if ( $svc_n > 0 ) {
			echo '<h2 style="margin-top:24px;">Apercu services (20 premiers)</h2>';
			echo '<table class="widefat striped"><thead><tr>';
			echo '<th>ID</th><th>Titre</th><th>Categorie</th><th>Duree (min)</th><th>Prix</th><th>Visibilite</th><th>Extras</th>';
			echo '</tr></thead><tbody>';
			$i = 0;
			foreach ( $data['services'] as $s ) {
				if ( $i >= 20 ) {
					break;
				}
				$i++;
				$extra_count = 0;
				foreach ( $data['extras'] as $e ) {
					if ( (int) $e['service_id'] === (int) $s['id'] ) {
						$extra_count++;
					}
				}
				echo '<tr>';
				echo '<td>' . (int) $s['id'] . '</td>';
				echo '<td>' . esc_html( (string) $s['title'] ) . '</td>';
				echo '<td>' . esc_html( (string) $s['category_name'] ) . '</td>';
				echo '<td>' . esc_html( (string) $s['duration_min'] ) . '</td>';
				echo '<td>' . esc_html( (string) $s['price'] ) . '</td>';
				echo '<td>' . esc_html( (string) $s['visibility'] ) . '</td>';
				echo '<td>' . (int) $extra_count . '</td>';
				echo '</tr>';
			}
			echo '</tbody></table>';
		}

		if ( $ext_n > 0 ) {
			echo '<h2 style="margin-top:24px;">Apercu extras (20 premiers)</h2>';
			echo '<table class="widefat striped"><thead><tr>';
			echo '<th>ID</th><th>Extra</th><th>Service parent</th><th>Duree (min)</th><th>Prix</th><th>Min</th><th>Max</th>';
			echo '</tr></thead><tbody>';
			$i = 0;
			foreach ( $data['extras'] as $e ) {
				if ( $i >= 20 ) {
					break;
				}
				$i++;
				echo '<tr>';
				echo '<td>' . (int) $e['id'] . '</td>';
				echo '<td>' . esc_html( (string) $e['title'] ) . '</td>';
				echo '<td>' . esc_html( (string) $e['service_title'] ) . ' (#' . (int) $e['service_id'] . ')</td>';
				echo '<td>' . esc_html( (string) $e['duration_min'] ) . '</td>';
				echo '<td>' . esc_html( (string) $e['price'] ) . '</td>';
				echo '<td>' . esc_html( (string) $e['min_quantity'] ) . '</td>';
				echo '<td>' . esc_html( (string) $e['max_quantity'] ) . '</td>';
				echo '</tr>';
			}
			echo '</tbody></table>';
		}

		echo '</div>';
	}

	private static function echo_download_button( $base, $nonce, $export, $label ) {
		$url = add_query_arg(
			array(
				'bh_export' => $export,
				'_wpnonce'  => $nonce,
			),
			$base
		);
		echo '<p><a class="button button-primary" href="' . esc_url( $url ) . '">' . esc_html( $label ) . '</a></p>';
	}

	private static function collect() {
		global $wpdb;

		$services_table = self::find_table( array( 'bookly_services' ) );
		$extras_table   = self::find_table(
			array(
				'bookly_service_extras',
				'bookly_service_extra',
				'bookly_extras',
			)
		);
		$cats_table     = self::find_table( array( 'bookly_categories' ) );

		$diagnostic = self::diagnostic_tables();

		$categories = array();
		if ( $cats_table ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$rows = $wpdb->get_results( "SELECT * FROM `{$cats_table}` ORDER BY id ASC", ARRAY_A );
			foreach ( (array) $rows as $row ) {
				$id = (int) ( isset( $row['id'] ) ? $row['id'] : 0 );
				$name = '';
				if ( isset( $row['name'] ) ) {
					$name = (string) $row['name'];
				} elseif ( isset( $row['title'] ) ) {
					$name = (string) $row['title'];
				}
				$categories[ $id ] = array(
					'id'   => $id,
					'name' => $name,
				);
			}
		}

		$services = array();
		if ( $services_table ) {
			$cols = self::table_columns( $services_table );
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$rows = $wpdb->get_results( "SELECT * FROM `{$services_table}` ORDER BY id ASC", ARRAY_A );
			foreach ( (array) $rows as $row ) {
				$cat_id       = isset( $row['category_id'] ) ? (int) $row['category_id'] : 0;
				$duration_sec = isset( $row['duration'] ) ? (int) $row['duration'] : 0;
				$cat_name     = ( $cat_id && isset( $categories[ $cat_id ] ) ) ? $categories[ $cat_id ]['name'] : '';
				$services[]   = array(
					'id'                => (int) ( isset( $row['id'] ) ? $row['id'] : 0 ),
					'category_id'       => $cat_id ? $cat_id : null,
					'category_name'     => $cat_name,
					'title'             => (string) ( isset( $row['title'] ) ? $row['title'] : '' ),
					'info'              => (string) ( isset( $row['info'] ) ? $row['info'] : '' ),
					'duration_sec'      => $duration_sec,
					'duration_min'      => (int) round( $duration_sec / 60 ),
					'price'             => self::normalize_price( isset( $row['price'] ) ? $row['price'] : 0 ),
					'price_cents'       => self::price_to_cents( isset( $row['price'] ) ? $row['price'] : 0 ),
					'color'             => (string) ( isset( $row['color'] ) ? $row['color'] : '' ),
					'visibility'        => (string) ( isset( $row['visibility'] ) ? $row['visibility'] : 'public' ),
					'type'              => (string) ( isset( $row['type'] ) ? $row['type'] : 'simple' ),
					'padding_left_sec'  => isset( $row['padding_left'] ) ? (int) $row['padding_left'] : 0,
					'padding_right_sec' => isset( $row['padding_right'] ) ? (int) $row['padding_right'] : 0,
					'buffer_before_min' => isset( $row['padding_left'] ) ? (int) round( (int) $row['padding_left'] / 60 ) : 0,
					'buffer_after_min'  => isset( $row['padding_right'] ) ? (int) round( (int) $row['padding_right'] / 60 ) : 0,
					'position'          => isset( $row['position'] ) ? (int) $row['position'] : 0,
					'raw'               => self::filter_raw( $row, $cols ),
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
				$service_id    = (int) ( isset( $row['service_id'] ) ? $row['service_id'] : 0 );
				$duration_sec  = isset( $row['duration'] ) ? (int) $row['duration'] : 0;
				$min_q         = 0;
				$max_q         = 1;
				if ( isset( $row['min_quantity'] ) ) {
					$min_q = (int) $row['min_quantity'];
				} elseif ( isset( $row['min_qty'] ) ) {
					$min_q = (int) $row['min_qty'];
				}
				if ( isset( $row['max_quantity'] ) ) {
					$max_q = (int) $row['max_quantity'];
				} elseif ( isset( $row['max_qty'] ) ) {
					$max_q = (int) $row['max_qty'];
				}
				$attachment_id = isset( $row['attachment_id'] ) ? (int) $row['attachment_id'] : 0;
				$image_url     = $attachment_id ? (string) wp_get_attachment_url( $attachment_id ) : '';
				$svc_title     = isset( $service_titles[ $service_id ] ) ? $service_titles[ $service_id ] : '';

				$extras[] = array(
					'id'            => (int) ( isset( $row['id'] ) ? $row['id'] : 0 ),
					'service_id'    => $service_id,
					'service_title' => $svc_title,
					'title'         => (string) ( isset( $row['title'] ) ? $row['title'] : '' ),
					'duration_sec'  => $duration_sec,
					'duration_min'  => (int) round( $duration_sec / 60 ),
					'price'         => self::normalize_price( isset( $row['price'] ) ? $row['price'] : 0 ),
					'price_cents'   => self::price_to_cents( isset( $row['price'] ) ? $row['price'] : 0 ),
					'min_quantity'  => $min_q,
					'max_quantity'  => $max_q,
					'position'      => isset( $row['position'] ) ? (int) $row['position'] : 0,
					'attachment_id' => $attachment_id ? $attachment_id : null,
					'image_url'     => $image_url,
					'raw'           => self::filter_raw( $row, $cols ),
				);
			}
		}

		return array(
			'services_table' => $services_table,
			'extras_table'   => $extras_table,
			'categories'     => array_values( $categories ),
			'services'       => $services,
			'extras'         => $extras,
			'diagnostic'     => $diagnostic,
		);
	}

	/**
	 * Liste toutes les tables `%bookly%` et leur nombre de lignes.
	 * Sert de diagnostic quand l'export extras est vide.
	 */
	private static function diagnostic_tables() {
		global $wpdb;
		$out    = array();
		$prefix = $wpdb->prefix;
		$like   = $wpdb->esc_like( 'bookly' );
		$tables = $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', '%' . $like . '%' ) );
		$rowses = array();
		$names  = array();
		foreach ( (array) $tables as $t ) {
			$t     = (string) $t;
			$short = ( strpos( $t, $prefix ) === 0 ) ? substr( $t, strlen( $prefix ) ) : $t;
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$t}`" );
			$out[] = array(
				'table' => $t,
				'short' => $short,
				'rows'  => $count,
			);
			$rowses[] = $count;
			$names[]  = $short;
		}
		if ( ! empty( $out ) ) {
			array_multisort( $rowses, SORT_DESC, SORT_NUMERIC, $names, SORT_ASC, SORT_STRING, $out );
		}
		return $out;
	}

	private static function find_table( $suffixes ) {
		global $wpdb;

		static $all_tables = null;
		if ( null === $all_tables ) {
			$all_tables = $wpdb->get_col( 'SHOW TABLES' );
		}

		foreach ( $suffixes as $suffix ) {
			$exact = $wpdb->prefix . $suffix;
			foreach ( (array) $all_tables as $table ) {
				$table = (string) $table;
				if ( $table === $exact || substr( $table, -strlen( $suffix ) ) === $suffix ) {
					return $table;
				}
			}
		}

		return null;
	}

	private static function table_columns( $table ) {
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cols = $wpdb->get_col( "SHOW COLUMNS FROM `{$table}`" );
		return array_map( 'strval', (array) $cols );
	}

	private static function filter_raw( $row, $cols ) {
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

	private static function services_csv_rows( $services ) {
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

	private static function extras_csv_rows( $extras ) {
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

	private static function send_csv( $filename, $rows ) {
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo "\xEF\xBB\xBF";
		$out = fopen( 'php://output', 'w' );
		foreach ( $rows as $row ) {
			fputcsv( $out, $row, ';' );
		}
		fclose( $out );
		exit;
	}

	private static function send_json( $filename, $payload ) {
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=' . $filename );
		echo wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		exit;
	}
}

BeautyHub_Bookly_Export::init();

endif;
