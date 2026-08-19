<?php
/**
 * Analytics controller — a server-side adapter over the Insightistic plugin.
 *
 * Insightistic 4.4.0 is installed and active but registers NO REST namespace;
 * it is admin-AJAX only. This controller is the only path by which the
 * dashboard can read GA4, Search Console and PageSpeed data.
 *
 * Three rules shape every handler here:
 *
 *   1. No secret ever leaves the server. /analytics/status reports booleans.
 *   2. get_dashboard_data() returns a pre-rendered `html` string built by
 *      another plugin. It is stripped here so it cannot reach the React tree
 *      even by accident.
 *   3. PageSpeed makes a live 10-30s Google call. It runs on cron, never
 *      inside a dashboard request.
 *
 * @package BrotherTours\OperationsApi
 */

namespace BrotherTours\OperationsApi\Insightistic;

use Throwable;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

class AnalyticsController {

	const CRON_PAGESPEED = 'bt_ops_run_pagespeed';

	/** Cache TTLs. Google API quota is finite and the SPA will poll. */
	const TTL_GSC       = HOUR_IN_SECONDS;
	const TTL_GA4       = HOUR_IN_SECONDS;
	const TTL_PAGESPEED = 6 * HOUR_IN_SECONDS;
	const TTL_STATUS    = 5 * MINUTE_IN_SECONDS;

	/**
	 * Option keys that must NEVER appear in a REST response.
	 *
	 * Asserted in tests. If you add an Insightistic integration, add its secret
	 * key here first.
	 */
	const FORBIDDEN_KEYS = array(
		'insightistic_api_private_key',
		'insightistic_pagespeed_api_key_enc',
		'insightistic_groq_key',
		'insightistic_connector_secret',
		'insightistic_crypto_secret',
	);

	public function register_routes() {
		$ns = BTOA_NAMESPACE;

		$read = array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => array( $this, 'can_read' ),
		);

		register_rest_route( $ns, '/analytics/status', array(
			array_merge( $read, array( 'callback' => array( $this, 'get_status' ) ) ),
		) );

		register_rest_route( $ns, '/analytics/search-console', array(
			array_merge( $read, array( 'callback' => array( $this, 'get_search_console' ) ) ),
		) );

		register_rest_route( $ns, '/analytics/ga4', array(
			array_merge( $read, array( 'callback' => array( $this, 'get_ga4' ) ) ),
		) );

		register_rest_route( $ns, '/analytics/pagespeed', array(
			array_merge( $read, array( 'callback' => array( $this, 'get_pagespeed' ) ) ),
		) );

		register_rest_route( $ns, '/analytics/pagespeed/run', array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'run_pagespeed' ),
				'permission_callback' => array( $this, 'can_run_pagespeed' ),
			),
		) );

		register_rest_route( $ns, '/analytics/404s', array(
			array_merge( $read, array( 'callback' => array( $this, 'get_404s' ) ) ),
		) );

		add_action( self::CRON_PAGESPEED, array( $this, 'cron_run_pagespeed' ), 10, 2 );
	}

	/* ---------------------------------------------------------------------
	 * Permissions
	 * ------------------------------------------------------------------- */

	public function can_read( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'bt_manage_operations' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'Your account cannot read operations analytics.', array( 'status' => 403 ) );
	}

	public function can_run_pagespeed( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'manage_options' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'Running a PageSpeed test requires manage_options.', array( 'status' => 403 ) );
	}

	private function authorize( WP_REST_Request $request ) {
		if ( class_exists( '\BrotherTours\OperationsApi\Support\Csrf' ) ) {
			return \BrotherTours\OperationsApi\Support\Csrf::authorize( $request );
		}
		return new WP_Error( 'bt_ops_authorize_unavailable', 'Authorization helper is unavailable.', array( 'status' => 500 ) );
	}

	/* ---------------------------------------------------------------------
	 * Status
	 * ------------------------------------------------------------------- */

	public function get_status( WP_REST_Request $request ) {
		$cached = get_transient( 'bt_ops_analytics_status' );
		if ( is_array( $cached ) ) {
			return $this->respond( $cached + array( 'cached' => true ) );
		}

		$active = $this->plugin_active();

		$status = array(
			'insightistic' => array(
				'active'  => $active,
				'version' => $active ? $this->plugin_version() : null,
			),
			// Booleans only. Never the values behind them.
			'ga4' => array(
				'configured' => $this->has_option( 'insightistic_api_private_key' ) && $this->has_option( 'insightistic_ga4_property_id' ),
				'propertyId' => $this->safe_property_id(),
			),
			'gsc' => array(
				'configured' => $this->has_option( 'insightistic_gsc_property' ),
				'property'   => (string) get_option( 'insightistic_gsc_property', '' ),
			),
			'pagespeed' => array(
				'configured' => $this->has_option( 'insightistic_pagespeed_api_key_enc' ),
				'defaultUrl' => $this->pagespeed_default_url(),
			),
			'lastSync'     => $this->call_static( 'Insightistic_Sync', 'last_sync' ),
			'syncLog'      => $this->call_static( 'Insightistic_Sync', 'logs' ),
			'systemStatus' => $this->call_static( 'Insightistic_System_Status', 'collect' ),
			'cached'       => false,
		);

		$status = $this->scrub( $status );
		set_transient( 'bt_ops_analytics_status', $status, self::TTL_STATUS );

		return $this->respond( $status );
	}

	/* ---------------------------------------------------------------------
	 * Search Console — the strongest verified source. Build UI on this first.
	 * ------------------------------------------------------------------- */

	public function get_search_console( WP_REST_Request $request ) {
		$days = $this->sanitize_days( $request->get_param( 'days' ) );
		$key  = "bt_ops_gsc_{$days}";

		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $this->respond( $this->with_source( $cached, 'insightistic-gsc', true ) );
		}

		$payload = $this->guard( function () use ( $days ) {
			if ( ! class_exists( 'Insightistic_GSC' ) ) {
				return null;
			}
			$gsc = new \Insightistic_GSC();
			return $gsc->get_sync_payload( $days );
		} );

		if ( is_wp_error( $payload ) ) {
			return $payload;
		}
		if ( ! is_array( $payload ) ) {
			return $this->unavailable( 'Search Console data is not available. Check the Insightistic connection.' );
		}

		$data = array(
			'days'    => $days,
			'daily'   => $this->rows( $payload, 'daily' ),
			'queries' => array_slice( $this->rows( $payload, 'queries' ), 0, 250 ),
			'pages'   => array_slice( $this->rows( $payload, 'pages' ), 0, 250 ),
		);
		$data['totals'] = $this->totals( $data['daily'] );

		set_transient( $key, $data, self::TTL_GSC );
		return $this->respond( $this->with_source( $data, 'insightistic-gsc', false ) );
	}

	/* ---------------------------------------------------------------------
	 * GA4
	 * ------------------------------------------------------------------- */

	public function get_ga4( WP_REST_Request $request ) {
		$days = $this->sanitize_days( $request->get_param( 'days' ) );
		$key  = "bt_ops_ga4_{$days}";

		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $this->respond( $this->with_source( $cached, 'insightistic-ga4', true ) );
		}

		$sync = $this->guard( function () use ( $days ) {
			if ( ! class_exists( 'Insightistic_GA' ) ) {
				return null;
			}
			$ga = new \Insightistic_GA();
			return $ga->get_sync_payload( $days );
		} );
		if ( is_wp_error( $sync ) ) {
			return $sync;
		}

		$dashboard = $this->guard( function () use ( $days ) {
			if ( ! class_exists( 'Insightistic_GA' ) ) {
				return null;
			}
			$ga = new \Insightistic_GA();
			return $ga->get_dashboard_data( $days );
		} );
		if ( is_wp_error( $dashboard ) ) {
			$dashboard = null; // Degrade: the sync payload alone is still useful.
		}

		if ( ! is_array( $sync ) && ! is_array( $dashboard ) ) {
			return $this->unavailable( 'GA4 data is not available. Check the Insightistic connection.' );
		}

		$daily = $this->rows( is_array( $sync ) ? $sync : array(), 'daily' );

		$data = array(
			'days'      => $days,
			'daily'     => $daily,
			// The live property returns channels while daily comes back empty.
			// The client must render an explicit unavailable state rather than a
			// flat-line chart, so say so in the payload instead of leaving the
			// client to infer it from an empty array.
			'dailyAvailable' => ! empty( $daily ),
			'channels'  => $this->rows( is_array( $sync ) ? $sync : array(), 'channels' ),
			'countries' => is_array( $dashboard ) ? $this->rows( $dashboard, 'countries' ) : array(),
			'pages'     => is_array( $dashboard ) ? $this->rows( $dashboard, 'pages' ) : array(),
			'overview'  => is_array( $dashboard ) && isset( $dashboard['overview'] ) ? $dashboard['overview'] : null,
			'totals'    => is_array( $dashboard ) && isset( $dashboard['structured_data']['totals'] )
				? $dashboard['structured_data']['totals']
				: null,
		);

		// `html` is a pre-rendered string from another plugin. Stripped here so
		// it can never reach the client; the SPA has no dangerouslySetInnerHTML.
		unset( $data['html'] );

		$data = $this->scrub( $data );
		set_transient( $key, $data, self::TTL_GA4 );
		return $this->respond( $this->with_source( $data, 'insightistic-ga4', false ) );
	}

	/* ---------------------------------------------------------------------
	 * PageSpeed — asynchronous by construction
	 * ------------------------------------------------------------------- */

	public function get_pagespeed( WP_REST_Request $request ) {
		$url      = $this->sanitize_target_url( $request->get_param( 'url' ) );
		$strategy = 'desktop' === $request->get_param( 'strategy' ) ? 'desktop' : 'mobile';

		if ( is_wp_error( $url ) ) {
			return $url;
		}

		$cached = get_transient( $this->pagespeed_key( $url, $strategy ) );
		if ( is_array( $cached ) ) {
			return $this->respond( array(
				'status'    => 'fresh',
				'url'       => $url,
				'strategy'  => $strategy,
				'data'      => $cached['data'] ?? null,
				'fetchedAt' => $cached['fetchedAt'] ?? null,
			) );
		}

		$last = get_option( $this->pagespeed_key( $url, $strategy ) . '_last', null );
		if ( is_array( $last ) ) {
			return $this->respond( array(
				'status'    => 'stale',
				'url'       => $url,
				'strategy'  => $strategy,
				'data'      => $last['data'] ?? null,
				'fetchedAt' => $last['fetchedAt'] ?? null,
			) );
		}

		return $this->respond( array(
			'status'    => 'never_run',
			'url'       => $url,
			'strategy'  => $strategy,
			'data'      => null,
			'fetchedAt' => null,
		) );
	}

	public function run_pagespeed( WP_REST_Request $request ) {
		$url      = $this->sanitize_target_url( $request->get_param( 'url' ) );
		$strategy = 'desktop' === $request->get_param( 'strategy' ) ? 'desktop' : 'mobile';

		if ( is_wp_error( $url ) ) {
			return $url;
		}
		if ( ! $this->has_option( 'insightistic_pagespeed_api_key_enc' ) ) {
			return $this->unavailable( 'PageSpeed is not configured in Insightistic.' );
		}

		// A live PSI call is routinely 10-30s and would hit the PHP timeout
		// inside a dashboard request. Schedule it and let the client poll.
		if ( ! wp_next_scheduled( self::CRON_PAGESPEED, array( $url, $strategy ) ) ) {
			wp_schedule_single_event( time() + 5, self::CRON_PAGESPEED, array( $url, $strategy ) );
		}

		return $this->respond( array(
			'status'    => 'queued',
			'url'       => $url,
			'strategy'  => $strategy,
			'queuedAt'  => gmdate( 'c' ),
		), 202 );
	}

	/**
	 * Cron worker. Runs outside the request cycle, so a slow Google call costs
	 * nothing a user is waiting on.
	 */
	public function cron_run_pagespeed( $url, $strategy = 'mobile' ) {
		$url = esc_url_raw( (string) $url );
		if ( ! $url ) {
			return;
		}

		$payload = $this->guard( function () use ( $url ) {
			if ( ! class_exists( 'Insightistic_PageSpeed' ) ) {
				return null;
			}
			$psi = new \Insightistic_PageSpeed();
			return $psi->get_sync_payload( $url );
		} );

		if ( is_wp_error( $payload ) || ! is_array( $payload ) ) {
			return;
		}

		$record = array(
			'data'      => $this->scrub( $payload ),
			'fetchedAt' => gmdate( 'c' ),
		);
		set_transient( $this->pagespeed_key( $url, $strategy ), $record, self::TTL_PAGESPEED );
		// Keep the last result past TTL so the UI can show "stale" rather than
		// falling back to "never run" every six hours.
		update_option( $this->pagespeed_key( $url, $strategy ) . '_last', $record, false );
	}

	/* ---------------------------------------------------------------------
	 * 404 log — a 41 KB option. Slice server-side; never ship the blob.
	 * ------------------------------------------------------------------- */

	public function get_404s( WP_REST_Request $request ) {
		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );
		$per_page = min( 100, max( 1, (int) ( $request->get_param( 'perPage' ) ?: $request->get_param( 'per_page' ) ?: 25 ) ) );

		$log = get_option( 'insightistic_404_log', array() );
		if ( ! is_array( $log ) ) {
			$log = array();
		}

		$rows = array();
		foreach ( $log as $key => $entry ) {
			if ( is_array( $entry ) ) {
				$rows[] = array(
					'url'      => (string) ( $entry['url'] ?? $entry['uri'] ?? $key ),
					'hits'     => (int) ( $entry['hits'] ?? $entry['count'] ?? 1 ),
					'lastSeen' => isset( $entry['last'] ) ? (string) $entry['last'] : ( isset( $entry['last_seen'] ) ? (string) $entry['last_seen'] : null ),
					'referrer' => isset( $entry['referrer'] ) ? (string) $entry['referrer'] : null,
				);
				continue;
			}
			$rows[] = array( 'url' => (string) $key, 'hits' => (int) $entry, 'lastSeen' => null, 'referrer' => null );
		}

		usort( $rows, static function ( $a, $b ) {
			return $b['hits'] <=> $a['hits'];
		} );

		$total  = count( $rows );
		$offset = ( $page - 1 ) * $per_page;

		return $this->respond( array(
			'items'      => array_slice( $rows, $offset, $per_page ),
			'total'      => $total,
			'totalPages' => (int) max( 1, ceil( $total / $per_page ) ),
			'page'       => $page,
			'perPage'    => $per_page,
		) );
	}

	/* ---------------------------------------------------------------------
	 * Insightistic access helpers
	 * ------------------------------------------------------------------- */

	/**
	 * Every call into Insightistic goes through here.
	 *
	 * The plugin can be deactivated at any time and its internals are not a
	 * public API. A failure must degrade the analytics page, never 500 the
	 * dashboard.
	 */
	private function guard( callable $fn ) {
		if ( ! $this->plugin_active() ) {
			return null;
		}
		try {
			return $fn();
		} catch ( Throwable $e ) {
			// Message only; never the trace, which can carry option values.
			return new WP_Error(
				'bt_ops_analytics_unavailable',
				'Insightistic could not return data: ' . $e->getMessage(),
				array( 'status' => 503 )
			);
		}
	}

	private function call_static( $class, $method ) {
		$result = $this->guard( function () use ( $class, $method ) {
			if ( ! class_exists( $class ) || ! is_callable( array( $class, $method ) ) ) {
				return null;
			}
			return call_user_func( array( $class, $method ) );
		} );
		return is_wp_error( $result ) ? null : $result;
	}

	private function plugin_active() {
		return class_exists( 'Insightistic_GA' )
			|| class_exists( 'Insightistic_GSC' )
			|| defined( 'INSIGHTISTIC_VERSION' );
	}

	private function plugin_version() {
		return defined( 'INSIGHTISTIC_VERSION' ) ? INSIGHTISTIC_VERSION : null;
	}

	private function has_option( $key ) {
		$value = get_option( $key, '' );
		return ! ( '' === $value || null === $value || false === $value );
	}

	/**
	 * The GA4 property ID is an identifier, not a credential, and the dashboard
	 * shows it so an operator can confirm which property they are looking at.
	 */
	private function safe_property_id() {
		$id = get_option( 'insightistic_ga4_property_id', '' );
		return $id ? (string) $id : null;
	}

	private function pagespeed_default_url() {
		$configured = get_option( 'insightistic_pagespeed_default_url', '' );
		return $configured ? (string) $configured : home_url( '/' );
	}

	private function pagespeed_key( $url, $strategy ) {
		return 'bt_ops_psi_' . md5( $url . '|' . $strategy );
	}

	/* ---------------------------------------------------------------------
	 * Input and output safety
	 * ------------------------------------------------------------------- */

	private function sanitize_days( $days ) {
		$days = (int) ( $days ?: 28 );
		return max( 1, min( 90, $days ) );
	}

	/**
	 * PageSpeed targets are same-origin only.
	 *
	 * Without this the endpoint is an open PSI relay: anyone with a session
	 * could point Google's crawler at an arbitrary host on our API key.
	 */
	private function sanitize_target_url( $url ) {
		$url = trim( (string) $url );
		if ( '' === $url ) {
			return $this->pagespeed_default_url();
		}
		$url = esc_url_raw( $url );
		if ( ! $url ) {
			return new WP_Error( 'bt_ops_invalid_url', 'Unparseable URL.', array( 'status' => 422 ) );
		}
		$target = wp_parse_url( $url, PHP_URL_HOST );
		$home   = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		if ( ! $target || ! $home ) {
			return new WP_Error( 'bt_ops_invalid_url', 'Unparseable URL.', array( 'status' => 422 ) );
		}
		// Strip the www prefix specifically. ltrim() with 'www.' would treat it
		// as a character set and eat leading w/. from any host.
		$strip  = static function ( $host ) {
			return preg_replace( '/^www\./i', '', strtolower( $host ) );
		};
		if ( $strip( $target ) !== $strip( $home ) ) {
			return new WP_Error(
				'bt_ops_url_not_allowed',
				'PageSpeed can only be run against this site.',
				array( 'status' => 422 )
			);
		}
		return $url;
	}

	private function rows( array $payload, $key ) {
		$rows = $payload[ $key ] ?? array();
		return is_array( $rows ) ? array_values( $rows ) : array();
	}

	private function totals( array $daily ) {
		$clicks = 0;
		$impressions = 0;
		$position_sum = 0.0;
		$position_n = 0;
		foreach ( $daily as $row ) {
			$clicks      += (int) ( $row['clicks'] ?? 0 );
			$impressions += (int) ( $row['impressions'] ?? 0 );
			if ( isset( $row['avg_position'] ) ) {
				$position_sum += (float) $row['avg_position'];
				$position_n++;
			}
		}
		return array(
			'clicks'      => $clicks,
			'impressions' => $impressions,
			'ctr'         => $impressions > 0 ? round( $clicks / $impressions, 4 ) : 0.0,
			'avgPosition' => $position_n > 0 ? round( $position_sum / $position_n, 2 ) : null,
		);
	}

	/**
	 * Last line of defence before serialisation.
	 *
	 * Strips any key whose name matches a known secret, at any depth. The
	 * handlers above already avoid reading them; this catches the case where an
	 * upstream Insightistic payload embeds one we did not anticipate.
	 */
	private function scrub( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		$clean = array();
		foreach ( $value as $key => $item ) {
			if ( is_string( $key ) ) {
				$lower = strtolower( $key );
				if ( in_array( $lower, self::FORBIDDEN_KEYS, true ) ) {
					continue;
				}
				if ( preg_match( '/(private_key|api_key|secret|_enc$|password|token)/', $lower ) ) {
					continue;
				}
				if ( 'html' === $lower ) {
					continue; // Pre-rendered markup never crosses the boundary.
				}
			}
			$clean[ $key ] = is_array( $item ) ? $this->scrub( $item ) : $item;
		}
		return $clean;
	}

	private function with_source( array $data, $source, $cached ) {
		return array_merge( $data, array(
			'source'          => $source,
			'cached'          => (bool) $cached,
			'dataGeneratedAt' => gmdate( 'c' ),
		) );
	}

	private function unavailable( $message ) {
		return new WP_Error( 'bt_ops_analytics_unavailable', $message, array( 'status' => 503 ) );
	}

	private function respond( $data, $status = 200 ) {
		if ( function_exists( '\btoa_response' ) ) {
			return \btoa_response( $data, $status );
		}
		return new \WP_REST_Response(
			array(
				'success' => true,
				'data'    => $data,
				'meta'    => array(
					'generatedAt' => gmdate( 'c' ),
					'timezone'    => wp_timezone_string(),
					'apiVersion'  => defined( 'BTOA_VERSION' ) ? BTOA_VERSION : '1.1.0',
				),
			),
			$status
		);
	}
}
