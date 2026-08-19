<?php
/**
 * Site controller — the read-only "what the WP dashboard shows" surface.
 *
 * Read-only by design in 1.1.0. Plugin activation, updates and user creation
 * stay in wp-admin: those belong to the connector plane and its approval gate,
 * not to a browser session. The UI links out rather than reimplementing them.
 *
 * @package BrotherTours\OperationsApi
 */

namespace BrotherTours\OperationsApi\System;

use WP_Error;
use WP_REST_Request;
use WP_REST_Server;
use WP_User_Query;

defined( 'ABSPATH' ) || exit;

class SiteController {

	/** Cron hooks worth surfacing. Anything else is noise for an operator. */
	const WATCHED_HOOKS = array(
		'insightistic_run_sync',
		'insightistic_license_validate',
		'insightistic_send_email_automation',
		'bt_ops_run_pagespeed',
		'wp_scheduled_delete',
		'wp_version_check',
	);

	public function register_routes() {
		$ns = BTOA_NAMESPACE;

		register_rest_route( $ns, '/site/overview', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_overview' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
		) );

		register_rest_route( $ns, '/site/plugins', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_plugins' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( $ns, '/site/users', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_users' ),
				'permission_callback' => array( $this, 'can_list_users' ),
			),
		) );

		register_rest_route( $ns, '/site/cron', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_cron' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
	}

	/* ------------------------------------------------------------------ */

	public function can_read( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'bt_manage_operations' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'Your account cannot read site information.', array( 'status' => 403 ) );
	}

	public function can_manage( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'manage_options' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'This view requires manage_options.', array( 'status' => 403 ) );
	}

	public function can_list_users( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'list_users' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'This view requires list_users.', array( 'status' => 403 ) );
	}

	private function authorize( WP_REST_Request $request ) {
		if ( class_exists( '\BrotherTours\OperationsApi\Support\Csrf' ) ) {
			return \BrotherTours\OperationsApi\Support\Csrf::authorize( $request );
		}
		return new WP_Error( 'bt_ops_authorize_unavailable', 'Authorization helper is unavailable.', array( 'status' => 500 ) );
	}

	/* ------------------------------------------------------------------ */

	public function get_overview( WP_REST_Request $request ) {
		$types = array();
		foreach ( array( 'post', 'page', 'wpistic_tour', 'wpistic_destination', 'wpistic_experience' ) as $type ) {
			if ( ! post_type_exists( $type ) ) {
				continue;
			}
			$counts  = (array) wp_count_posts( $type );
			$object  = get_post_type_object( $type );
			$types[] = array(
				'type'    => $type,
				'label'   => $object ? $object->labels->name : $type,
				'publish' => (int) ( $counts['publish'] ?? 0 ),
				'draft'   => (int) ( $counts['draft'] ?? 0 ),
				'pending' => (int) ( $counts['pending'] ?? 0 ),
				'trash'   => (int) ( $counts['trash'] ?? 0 ),
			);
		}

		$theme = wp_get_theme();

		return $this->respond( array(
			'wpVersion'   => get_bloginfo( 'version' ),
			'phpVersion'  => PHP_VERSION,
			'siteName'    => get_bloginfo( 'name' ),
			'homeUrl'     => home_url( '/' ),
			'siteUrl'     => site_url( '/' ),
			'adminUrl'    => admin_url(),
			'timezone'    => wp_timezone_string(),
			'theme'       => array(
				'name'     => $theme->get( 'Name' ),
				'version'  => $theme->get( 'Version' ),
				'template' => $theme->get_template(),
			),
			'contentTypes' => $types,
			// The cast binds tighter than ??, so the coalesce has to happen
			// first or a missing key warns instead of defaulting.
			'mediaCount'   => (int) ( ( (array) wp_count_posts( 'attachment' ) )['inherit'] ?? 0 ),
			'userCount'    => (int) ( count_users()['total_users'] ?? 0 ),
			'activePlugins' => count( (array) get_option( 'active_plugins', array() ) ),
		) );
	}

	public function get_plugins( WP_REST_Request $request ) {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$active = (array) get_option( 'active_plugins', array() );
		$items  = array();
		foreach ( get_plugins() as $file => $data ) {
			$items[] = array(
				'file'    => $file,
				'name'    => $data['Name'] ?? $file,
				'version' => $data['Version'] ?? null,
				'active'  => in_array( $file, $active, true ),
			);
		}
		usort( $items, static function ( $a, $b ) {
			if ( $a['active'] === $b['active'] ) {
				return strcasecmp( $a['name'], $b['name'] );
			}
			return $a['active'] ? -1 : 1;
		} );
		return $this->respond( array( 'items' => $items, 'total' => count( $items ) ) );
	}

	public function get_users( WP_REST_Request $request ) {
		$query = new WP_User_Query( array(
			'number'  => 100,
			'orderby' => 'display_name',
			'order'   => 'ASC',
		) );
		$items = array();
		foreach ( $query->get_results() as $user ) {
			$items[] = array(
				'id'          => (int) $user->ID,
				'displayName' => $user->display_name,
				// Addresses are operational data for an admin-only view, not
				// customer PII, but they still never belong in a log or a URL.
				'email'       => $user->user_email,
				'roles'       => array_values( (array) $user->roles ),
				'postCount'   => (int) count_user_posts( $user->ID, 'post' ),
				'canEditPosts' => user_can( $user, 'edit_posts' ),
			);
		}
		return $this->respond( array( 'items' => $items, 'total' => count( $items ) ) );
	}

	public function get_cron( WP_REST_Request $request ) {
		$crons = _get_cron_array();
		$items = array();
		if ( is_array( $crons ) ) {
			foreach ( $crons as $timestamp => $hooks ) {
				foreach ( (array) $hooks as $hook => $events ) {
					if ( ! in_array( $hook, self::WATCHED_HOOKS, true ) ) {
						continue;
					}
					foreach ( (array) $events as $event ) {
						$items[] = array(
							'hook'      => $hook,
							'nextRun'   => gmdate( 'c', (int) $timestamp ),
							'schedule'  => $event['schedule'] ?: 'single',
							'overdue'   => (int) $timestamp < time(),
						);
					}
				}
			}
		}
		usort( $items, static function ( $a, $b ) {
			return strcmp( $a['nextRun'], $b['nextRun'] );
		} );
		return $this->respond( array(
			'items'       => $items,
			'total'       => count( $items ),
			'cronDisabled' => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON,
		) );
	}

	/* ------------------------------------------------------------------ */

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
