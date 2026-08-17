<?php
/** Collez ceci dans Code Snippets (Run everywhere), ou installez le plugin beautyhub-bookly-export.php. */

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
		} elseif ( 'appointments_csv' === $type ) {
			self::send_csv( 'bookly-appointments.csv', self::appointments_csv_rows( self::collect_appointments() ) );
		} elseif ( 'json' === $type ) {
			$appointments = self::collect_appointments();
			self::send_json(
				'bookly-beautyhub-export.json',
				array(
					'exported_at'    => gmdate( 'c' ),
					'site_url'       => home_url( '/' ),
					'services_table' => $data['services_table'],
					'extras_table'   => $data['extras_table'],
					'categories'     => $data['categories'],
					'services'       => $data['services'],
					'extras'         => $data['extras'],
					'appointments'   => $appointments,
					'counts'         => array(
						'services'     => count( $data['services'] ),
						'extras'       => count( $data['extras'] ),
						'appointments' => count( $appointments ),
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
		$appt_n = self::count_appointments();

		echo '<h1>Export Bookly - BeautyHub</h1>';
		echo '<p>Exporte le catalogue Bookly (prestations + extras) et les rendez-vous pour migration vers BeautyHub.</p>';

		echo '<table class="widefat striped" style="max-width:640px;margin:16px 0;"><tbody>';
		echo '<tr><th>Table services</th><td>' . esc_html( $data['services_table'] ? $data['services_table'] : 'introuvable' ) . '</td></tr>';
		echo '<tr><th>Table extras</th><td>' . esc_html( $data['extras_table'] ? $data['extras_table'] : 'introuvable (voir diagnostic ci-dessous)' ) . '</td></tr>';
		echo '<tr><th>Categories</th><td>' . esc_html( (string) $cat_n ) . '</td></tr>';
		echo '<tr><th>Services</th><td><strong>' . esc_html( (string) $svc_n ) . '</strong></td></tr>';
		echo '<tr><th>Extras</th><td><strong>' . esc_html( (string) $ext_n ) . '</strong></td></tr>';
		echo '<tr><th>Rendez-vous</th><td><strong>' . esc_html( (string) $appt_n ) . '</strong></td></tr>';
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
		self::echo_download_button( $base, $nonce, 'appointments_csv', 'Telecharger rendez-vous (CSV)' );
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

	private static function count_appointments() {
		$ca_table = self::find_table( array( 'bookly_customer_appointments' ) );
		if ( ! $ca_table ) {
			return 0;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$ca_table}`" );
	}

	/**
	 * Une ligne BeautyHub = un customer_appointment Bookly (1 client par creneau).
	 */
	private static function collect_appointments() {
		global $wpdb;

		$appt_table = self::find_table( array( 'bookly_appointments' ) );
		$ca_table   = self::find_table( array( 'bookly_customer_appointments' ) );
		$cust_table = self::find_table( array( 'bookly_customers' ) );
		$staff_table = self::find_table( array( 'bookly_staff' ) );
		$svc_table  = self::find_table( array( 'bookly_services' ) );
		$extras_table = self::find_table(
			array(
				'bookly_service_extras',
				'bookly_service_extra',
				'bookly_extras',
			)
		);
		$pay_table  = self::find_table( array( 'bookly_payments' ) );

		if ( ! $appt_table || ! $ca_table ) {
			return array();
		}

		$ca_cols    = self::table_columns( $ca_table );
		$appt_cols  = self::table_columns( $appt_table );
		$cust_cols  = $cust_table ? self::table_columns( $cust_table ) : array();
		$staff_cols = $staff_table ? self::table_columns( $staff_table ) : array();
		$svc_cols   = $svc_table ? self::table_columns( $svc_table ) : array();
		$pay_cols   = $pay_table ? self::table_columns( $pay_table ) : array();

		$has = function ( $cols, $name ) {
			return in_array( $name, $cols, true );
		};

		$select = array( 'ca.id AS ca_id', 'ca.appointment_id', 'ca.customer_id' );
		$select[] = $has( $ca_cols, 'status' ) ? 'ca.status AS ca_status' : "'' AS ca_status";
		$select[] = $has( $ca_cols, 'notes' ) ? 'ca.notes AS ca_notes' : "'' AS ca_notes";
		$select[] = $has( $ca_cols, 'extras' ) ? 'ca.extras AS ca_extras' : "'' AS ca_extras";
		$select[] = $has( $ca_cols, 'number_of_persons' ) ? 'ca.number_of_persons' : '1 AS number_of_persons';
		$select[] = $has( $ca_cols, 'payment_id' ) ? 'ca.payment_id' : 'NULL AS payment_id';

		$select[] = $has( $appt_cols, 'staff_id' ) ? 'a.staff_id' : 'NULL AS staff_id';
		$select[] = $has( $appt_cols, 'service_id' ) ? 'a.service_id' : 'NULL AS service_id';
		$select[] = $has( $appt_cols, 'start_date' ) ? 'a.start_date' : 'NULL AS start_date';
		$select[] = $has( $appt_cols, 'end_date' ) ? 'a.end_date' : 'NULL AS end_date';
		$select[] = $has( $appt_cols, 'extras_duration' ) ? 'a.extras_duration' : '0 AS extras_duration';
		$select[] = $has( $appt_cols, 'internal_note' ) ? 'a.internal_note' : "'' AS internal_note";

		$join = "FROM `{$ca_table}` ca INNER JOIN `{$appt_table}` a ON a.id = ca.appointment_id";

		if ( $cust_table ) {
			$join .= " LEFT JOIN `{$cust_table}` c ON c.id = ca.customer_id";
			$select[] = $has( $cust_cols, 'full_name' ) ? 'c.full_name AS customer_full_name' : "'' AS customer_full_name";
			$select[] = $has( $cust_cols, 'first_name' ) ? 'c.first_name AS customer_first_name' : "'' AS customer_first_name";
			$select[] = $has( $cust_cols, 'last_name' ) ? 'c.last_name AS customer_last_name' : "'' AS customer_last_name";
			$select[] = $has( $cust_cols, 'email' ) ? 'c.email AS customer_email' : "'' AS customer_email";
			$select[] = $has( $cust_cols, 'phone' ) ? 'c.phone AS customer_phone' : "'' AS customer_phone";
		} else {
			$select[] = "'' AS customer_full_name";
			$select[] = "'' AS customer_first_name";
			$select[] = "'' AS customer_last_name";
			$select[] = "'' AS customer_email";
			$select[] = "'' AS customer_phone";
		}

		if ( $staff_table ) {
			$join .= " LEFT JOIN `{$staff_table}` st ON st.id = a.staff_id";
			$select[] = $has( $staff_cols, 'full_name' ) ? 'st.full_name AS staff_name' : "'' AS staff_name";
		} else {
			$select[] = "'' AS staff_name";
		}

		if ( $svc_table ) {
			$join .= " LEFT JOIN `{$svc_table}` s ON s.id = a.service_id";
			$select[] = $has( $svc_cols, 'title' ) ? 's.title AS service_title' : "'' AS service_title";
			$select[] = $has( $svc_cols, 'price' ) ? 's.price AS service_price' : '0 AS service_price';
		} else {
			$select[] = "'' AS service_title";
			$select[] = '0 AS service_price';
		}

		if ( $pay_table && $has( $ca_cols, 'payment_id' ) ) {
			$join .= " LEFT JOIN `{$pay_table}` p ON p.id = ca.payment_id";
			$pay_amount = $has( $pay_cols, 'paid' ) ? 'p.paid' : ( $has( $pay_cols, 'total' ) ? 'p.total' : 'NULL' );
			$select[]   = "{$pay_amount} AS payment_total";
		} else {
			$select[] = 'NULL AS payment_total';
		}

		$sql = 'SELECT ' . implode( ', ', $select ) . " {$join} ORDER BY a.start_date ASC, ca.id ASC";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $sql, ARRAY_A );

		$extras_by_id = array();
		if ( $extras_table ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$extra_rows = $wpdb->get_results( "SELECT * FROM `{$extras_table}`", ARRAY_A );
			foreach ( (array) $extra_rows as $er ) {
				$eid = (int) ( isset( $er['id'] ) ? $er['id'] : 0 );
				if ( ! $eid ) {
					continue;
				}
				$dur = isset( $er['duration'] ) ? (int) $er['duration'] : 0;
				$extras_by_id[ $eid ] = array(
					'id'           => $eid,
					'title'        => (string) ( isset( $er['title'] ) ? $er['title'] : '' ),
					'duration_min' => (int) round( $dur / 60 ),
					'price_cents'  => self::price_to_cents( isset( $er['price'] ) ? $er['price'] : 0 ),
				);
			}
		}

		$out = array();
		foreach ( (array) $rows as $row ) {
			$ca_id = (int) ( isset( $row['ca_id'] ) ? $row['ca_id'] : 0 );
			if ( ! $ca_id ) {
				continue;
			}

			$start_iso = self::datetime_to_iso( isset( $row['start_date'] ) ? $row['start_date'] : '' );
			$end_iso   = self::datetime_to_iso( isset( $row['end_date'] ) ? $row['end_date'] : '' );
			$extras_duration = isset( $row['extras_duration'] ) ? (int) $row['extras_duration'] : 0;
			if ( $extras_duration > 0 && $end_iso ) {
				try {
					$end_dt = new DateTime( $end_iso );
					$end_dt->modify( '+' . $extras_duration . ' seconds' );
					$end_iso = $end_dt->format( 'Y-m-d\\TH:i:s\\Z' );
				} catch ( Exception $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
				}
			}

			$extras = self::normalize_appointment_extras(
				isset( $row['ca_extras'] ) ? $row['ca_extras'] : '',
				$extras_by_id
			);

			$price_cents = null;
			if ( isset( $row['payment_total'] ) && $row['payment_total'] !== null && $row['payment_total'] !== '' ) {
				$price_cents = self::price_to_cents( $row['payment_total'] );
			} elseif ( isset( $row['service_price'] ) ) {
				$price_cents = self::price_to_cents( $row['service_price'] );
				foreach ( $extras as $ex ) {
					$price_cents += (int) $ex['price_cents'] * max( 1, (int) $ex['quantity'] );
				}
			}

			$notes = array();
			if ( ! empty( $row['ca_notes'] ) ) {
				$notes[] = (string) $row['ca_notes'];
			}
			if ( ! empty( $row['internal_note'] ) ) {
				$notes[] = (string) $row['internal_note'];
			}

			$out[] = array(
				'bookly_ca_id'          => $ca_id,
				'bookly_appointment_id' => (int) ( isset( $row['appointment_id'] ) ? $row['appointment_id'] : 0 ),
				'starts_at'             => $start_iso,
				'ends_at'               => $end_iso,
				'status'                => self::map_bookly_status( isset( $row['ca_status'] ) ? $row['ca_status'] : '' ),
				'bookly_status'         => (string) ( isset( $row['ca_status'] ) ? $row['ca_status'] : '' ),
				'service_bookly_id'     => (int) ( isset( $row['service_id'] ) ? $row['service_id'] : 0 ),
				'service_title'         => (string) ( isset( $row['service_title'] ) ? $row['service_title'] : '' ),
				'staff_bookly_id'       => isset( $row['staff_id'] ) && $row['staff_id'] ? (int) $row['staff_id'] : null,
				'staff_name'            => (string) ( isset( $row['staff_name'] ) ? $row['staff_name'] : '' ),
				'customer_bookly_id'    => isset( $row['customer_id'] ) && $row['customer_id'] ? (int) $row['customer_id'] : null,
				'customer_first_name'   => (string) ( isset( $row['customer_first_name'] ) ? $row['customer_first_name'] : '' ),
				'customer_last_name'    => (string) ( isset( $row['customer_last_name'] ) ? $row['customer_last_name'] : '' ),
				'customer_full_name'    => (string) ( isset( $row['customer_full_name'] ) ? $row['customer_full_name'] : '' ),
				'customer_email'        => (string) ( isset( $row['customer_email'] ) ? $row['customer_email'] : '' ),
				'customer_phone'        => (string) ( isset( $row['customer_phone'] ) ? $row['customer_phone'] : '' ),
				'notes'                 => implode( "\n", $notes ),
				'price_cents'           => $price_cents,
				'extras'                => $extras,
			);
		}

		return $out;
	}

	private static function datetime_to_iso( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value || '0000-00-00 00:00:00' === $value ) {
			return '';
		}
		try {
			$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'Europe/Paris' );
			$dt = date_create( $value, $tz );
			if ( ! $dt ) {
				return $value;
			}
			$dt->setTimezone( new DateTimeZone( 'UTC' ) );
			return $dt->format( 'Y-m-d\\TH:i:s\\Z' );
		} catch ( Exception $e ) {
			return $value;
		}
	}

	private static function map_bookly_status( $raw ) {
		$v = strtolower( trim( (string) $raw ) );
		$map = array(
			'pending'    => 'booked',
			'approved'   => 'confirmed',
			'confirmed'  => 'confirmed',
			'booked'     => 'booked',
			'cancelled'  => 'cancelled',
			'canceled'   => 'cancelled',
			'rejected'   => 'cancelled',
			'done'       => 'completed',
			'completed'  => 'completed',
			'waitlisted' => 'skip',
			'waiting'    => 'skip',
			'no-show'    => 'no_show',
			'noshow'     => 'no_show',
			'no_show'    => 'no_show',
		);
		return isset( $map[ $v ] ) ? $map[ $v ] : 'booked';
	}

	private static function normalize_appointment_extras( $raw, $extras_by_id ) {
		$map = array();
		if ( is_array( $raw ) ) {
			$map = $raw;
		} elseif ( is_string( $raw ) && '' !== trim( $raw ) ) {
			$decoded = json_decode( $raw, true );
			if ( is_array( $decoded ) ) {
				$map = $decoded;
			} elseif ( function_exists( 'maybe_unserialize' ) ) {
				$unser = maybe_unserialize( $raw );
				if ( is_array( $unser ) ) {
					$map = $unser;
				}
			}
		}

		$out = array();
		foreach ( $map as $key => $qty ) {
			$eid = 0;
			$quantity = 1;
			$title = '';
			$duration_min = 0;
			$price_cents = 0;
			if ( is_array( $qty ) ) {
				$eid          = (int) ( isset( $qty['id'] ) ? $qty['id'] : ( isset( $qty['extra_id'] ) ? $qty['extra_id'] : $key ) );
				$quantity     = max( 1, (int) ( isset( $qty['quantity'] ) ? $qty['quantity'] : 1 ) );
				$title        = (string) ( isset( $qty['title'] ) ? $qty['title'] : '' );
				$duration_min = (int) ( isset( $qty['duration_min'] ) ? $qty['duration_min'] : 0 );
				$price_cents  = isset( $qty['price_cents'] ) ? (int) $qty['price_cents'] : self::price_to_cents( isset( $qty['price'] ) ? $qty['price'] : 0 );
			} else {
				$eid      = (int) $key;
				$quantity = max( 1, (int) $qty );
			}
			if ( ! $eid && '' === $title ) {
				continue;
			}
			$catalog = ( $eid && isset( $extras_by_id[ $eid ] ) ) ? $extras_by_id[ $eid ] : null;
			if ( $catalog ) {
				if ( '' === $title ) {
					$title = $catalog['title'];
				}
				if ( ! $duration_min ) {
					$duration_min = $catalog['duration_min'];
				}
				if ( ! $price_cents ) {
					$price_cents = $catalog['price_cents'];
				}
			}
			$out[] = array(
				'bookly_extra_id' => $eid,
				'title'           => $title,
				'quantity'        => $quantity,
				'duration_min'    => $duration_min,
				'price_cents'     => $price_cents,
			);
		}
		return $out;
	}

	private static function appointments_csv_rows( $appointments ) {
		$rows   = array();
		$rows[] = array(
			'bookly_ca_id',
			'bookly_appointment_id',
			'starts_at',
			'ends_at',
			'status',
			'bookly_status',
			'service_bookly_id',
			'service_title',
			'staff_bookly_id',
			'staff_name',
			'customer_bookly_id',
			'customer_first_name',
			'customer_last_name',
			'customer_full_name',
			'customer_email',
			'customer_phone',
			'notes',
			'price_cents',
			'extras_json',
		);
		foreach ( $appointments as $a ) {
			$rows[] = array(
				$a['bookly_ca_id'],
				$a['bookly_appointment_id'],
				$a['starts_at'],
				$a['ends_at'],
				$a['status'],
				$a['bookly_status'],
				$a['service_bookly_id'],
				$a['service_title'],
				$a['staff_bookly_id'],
				$a['staff_name'],
				$a['customer_bookly_id'],
				$a['customer_first_name'],
				$a['customer_last_name'],
				$a['customer_full_name'],
				$a['customer_email'],
				$a['customer_phone'],
				$a['notes'],
				$a['price_cents'],
				wp_json_encode( $a['extras'] ),
			);
		}
		return $rows;
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
