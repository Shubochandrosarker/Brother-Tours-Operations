<?php
/**
 * Content controller — articles, pages, tour CPTs, taxonomy and revisions.
 *
 * Registers under BTOA_NAMESPACE (bridgistic/v1) so SessionController's
 * determine_current_user() URI gate resolves the operations session. Core
 * wp/v2 is NOT an option: that gate only fires for URIs containing the
 * operations namespace, so wp/v2 with the ops cookie resolves to user 0.
 *
 * @package BrotherTours\OperationsApi
 */

namespace BrotherTours\OperationsApi\Content;

use WP_Error;
use WP_Post;
use WP_Query;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

class ContentController {

	/**
	 * Post types this controller will ever touch.
	 *
	 * An arbitrary post_type from the client is how a content endpoint quietly
	 * becomes an arbitrary-CPT write endpoint. Never widen this from a request.
	 */
	const ALLOWED_TYPES = array(
		'post',
		'page',
		'wpistic_tour',
		'wpistic_destination',
		'wpistic_experience',
	);

	/** Statuses a caller may set. */
	const ALLOWED_STATUSES = array( 'draft', 'pending', 'publish', 'private', 'future' );

	/**
	 * Meta keys the dashboard may WRITE.
	 *
	 * Exactly the keys already in production use. Anything else is rejected
	 * rather than passed through to update_post_meta().
	 */
	const WRITABLE_META = array(
		'bt_seo_title',
		'bt_seo_description',
		'_wpistic_tone',
	);

	/**
	 * Meta keys the dashboard may READ but never write.
	 *
	 * _seoistic_* is audit output owned by SEOISTIC. The dashboard displays the
	 * score; it does not get to author it.
	 */
	const READONLY_META = array(
		'_seoistic_title',
		'_seoistic_description',
		'_seoistic_score',
		'_seoistic_last_audit',
	);

	public function register_routes() {
		$ns = BTOA_NAMESPACE;

		register_rest_route( $ns, '/content/types', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_types' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
		) );

		register_rest_route( $ns, '/content/posts', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_posts' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'create_post' ),
				'permission_callback' => array( $this, 'can_create' ),
			),
		) );

		register_rest_route( $ns, '/content/posts/(?P<id>\d+)', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_post_item' ),
				'permission_callback' => array( $this, 'can_read_item' ),
			),
			array(
				'methods'             => 'PATCH',
				'callback'            => array( $this, 'update_post_item' ),
				'permission_callback' => array( $this, 'can_edit_item' ),
			),
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => array( $this, 'delete_post_item' ),
				'permission_callback' => array( $this, 'can_delete_item' ),
			),
		) );

		register_rest_route( $ns, '/content/posts/(?P<id>\d+)/restore', array(
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'restore_post_item' ),
				'permission_callback' => array( $this, 'can_edit_item' ),
			),
		) );

		register_rest_route( $ns, '/content/posts/(?P<id>\d+)/revisions', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_revisions' ),
				'permission_callback' => array( $this, 'can_edit_item' ),
			),
		) );

		register_rest_route( $ns, '/content/taxonomies', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_taxonomies' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
		) );

		register_rest_route( $ns, '/content/terms', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_terms' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'create_term' ),
				'permission_callback' => array( $this, 'can_manage_terms' ),
			),
		) );
	}

	/* ---------------------------------------------------------------------
	 * Permissions
	 *
	 * bt_manage_operations gates dashboard LOGIN and is held by 7 roles. It is
	 * NOT a content capability — only administrator also holds edit_posts. Each
	 * callback therefore checks the real WordPress capability on top of it.
	 * ------------------------------------------------------------------- */

	public function can_read( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'edit_posts' )
			? true
			: $this->forbidden( 'edit_posts' );
	}

	public function can_create( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		if ( ! current_user_can( 'edit_posts' ) ) {
			return $this->forbidden( 'edit_posts' );
		}
		$status = (string) $request->get_param( 'status' );
		if ( 'publish' === $status && ! current_user_can( 'publish_posts' ) ) {
			return $this->forbidden( 'publish_posts' );
		}
		return true;
	}

	public function can_read_item( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		return current_user_can( 'edit_post', $post->ID )
			? true
			: $this->forbidden( 'edit_post' );
	}

	public function can_edit_item( WP_REST_Request $request ) {
		return $this->can_read_item( $request );
	}

	public function can_delete_item( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		return current_user_can( 'delete_post', $post->ID )
			? true
			: $this->forbidden( 'delete_post' );
	}

	public function can_manage_terms( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'manage_categories' )
			? true
			: $this->forbidden( 'manage_categories' );
	}

	/**
	 * Session + CSRF gate, delegated to the plugin's existing Csrf helper so
	 * this controller cannot drift from the rest of the API.
	 */
	private function authorize( WP_REST_Request $request ) {
		if ( class_exists( '\BrotherTours\OperationsApi\Support\Csrf' ) ) {
			return \BrotherTours\OperationsApi\Support\Csrf::authorize( $request );
		}
		// Fail closed. A missing helper must never mean "allow".
		return new WP_Error(
			'bt_ops_authorize_unavailable',
			'Authorization helper is unavailable.',
			array( 'status' => 500 )
		);
	}

	private function forbidden( $capability ) {
		return new WP_Error(
			'bt_ops_forbidden',
			sprintf( 'Your account does not have the %s capability.', $capability ),
			array( 'status' => 403, 'requiredCapability' => $capability )
		);
	}

	/* ---------------------------------------------------------------------
	 * Read
	 * ------------------------------------------------------------------- */

	public function get_types( WP_REST_Request $request ) {
		$types = array();
		foreach ( self::ALLOWED_TYPES as $type ) {
			$object = get_post_type_object( $type );
			if ( ! $object ) {
				continue;
			}
			if ( ! current_user_can( $object->cap->edit_posts ) ) {
				continue;
			}
			$counts = (array) wp_count_posts( $type );
			$types[] = array(
				'type'       => $type,
				'label'      => $object->labels->name,
				'singular'   => $object->labels->singular_name,
				'hierarchical' => (bool) $object->hierarchical,
				'supports'   => array(
					'editor'    => post_type_supports( $type, 'editor' ),
					'excerpt'   => post_type_supports( $type, 'excerpt' ),
					'thumbnail' => post_type_supports( $type, 'thumbnail' ),
					'author'    => post_type_supports( $type, 'author' ),
				),
				'counts'     => array(
					'publish' => (int) ( $counts['publish'] ?? 0 ),
					'draft'   => (int) ( $counts['draft'] ?? 0 ),
					'pending' => (int) ( $counts['pending'] ?? 0 ),
					'private' => (int) ( $counts['private'] ?? 0 ),
					'future'  => (int) ( $counts['future'] ?? 0 ),
					'trash'   => (int) ( $counts['trash'] ?? 0 ),
				),
			);
		}
		return $this->respond( array( 'types' => $types ) );
	}

	public function list_posts( WP_REST_Request $request ) {
		$type = $this->sanitize_type( $request->get_param( 'type' ) );
		if ( is_wp_error( $type ) ) {
			return $type;
		}

		$per_page = min( 100, max( 1, (int) ( $request->get_param( 'perPage' ) ?: $request->get_param( 'per_page' ) ?: 20 ) ) );
		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );
		$status   = (string) $request->get_param( 'status' );

		$args = array(
			'post_type'      => $type,
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'post_status'    => $this->sanitize_query_status( $status ),
			'orderby'        => $this->sanitize_orderby( $request->get_param( 'orderby' ) ),
			'order'          => 'ASC' === strtoupper( (string) $request->get_param( 'order' ) ) ? 'ASC' : 'DESC',
		);

		$search = sanitize_text_field( (string) $request->get_param( 'search' ) );
		if ( '' !== $search ) {
			$args['s'] = $search;
		}
		$author = (int) $request->get_param( 'author' );
		if ( $author > 0 ) {
			$args['author'] = $author;
		}
		$category = (int) $request->get_param( 'category' );
		if ( $category > 0 && 'post' === $type ) {
			$args['cat'] = $category;
		}

		$query = new WP_Query( $args );
		$items = array_map( array( $this, 'shape_summary' ), $query->posts );

		return $this->respond( array(
			'items'      => $items,
			'total'      => (int) $query->found_posts,
			'totalPages' => (int) $query->max_num_pages,
			'page'       => $page,
			'perPage'    => $per_page,
		) );
	}

	public function get_post_item( WP_REST_Request $request ) {
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		return $this->respond( $this->shape_detail( $post ) );
	}

	public function list_revisions( WP_REST_Request $request ) {
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$revisions = wp_get_post_revisions( $post->ID, array( 'posts_per_page' => 20 ) );
		$items     = array();
		foreach ( $revisions as $revision ) {
			$items[] = array(
				'id'         => (int) $revision->ID,
				'authorId'   => (int) $revision->post_author,
				'authorName' => get_the_author_meta( 'display_name', $revision->post_author ),
				'modifiedAt' => $this->iso( $revision->post_modified_gmt ),
				'isAutosave' => (bool) wp_is_post_autosave( $revision ),
			);
		}
		return $this->respond( array( 'items' => $items, 'total' => count( $items ) ) );
	}

	public function list_taxonomies( WP_REST_Request $request ) {
		$type = $this->sanitize_type( $request->get_param( 'type' ) );
		if ( is_wp_error( $type ) ) {
			return $type;
		}
		$out = array();
		foreach ( get_object_taxonomies( $type, 'objects' ) as $taxonomy ) {
			if ( ! $taxonomy->show_ui && ! $taxonomy->public ) {
				continue;
			}
			$out[] = array(
				'taxonomy'     => $taxonomy->name,
				'label'        => $taxonomy->labels->name,
				'hierarchical' => (bool) $taxonomy->hierarchical,
				'termCount'    => (int) wp_count_terms( array( 'taxonomy' => $taxonomy->name, 'hide_empty' => false ) ),
				'canAssign'    => current_user_can( $taxonomy->cap->assign_terms ),
				'canManage'    => current_user_can( $taxonomy->cap->manage_terms ),
			);
		}
		return $this->respond( array( 'taxonomies' => $out ) );
	}

	public function list_terms( WP_REST_Request $request ) {
		$taxonomy = sanitize_key( (string) $request->get_param( 'taxonomy' ) );
		if ( ! $taxonomy || ! taxonomy_exists( $taxonomy ) ) {
			return new WP_Error( 'bt_ops_unknown_taxonomy', 'Unknown taxonomy.', array( 'status' => 404 ) );
		}
		$terms = get_terms( array(
			'taxonomy'   => $taxonomy,
			'hide_empty' => false,
			'search'     => sanitize_text_field( (string) $request->get_param( 'search' ) ),
			'number'     => 200,
		) );
		if ( is_wp_error( $terms ) ) {
			return $terms;
		}
		$items = array();
		foreach ( $terms as $term ) {
			$items[] = array(
				'id'    => (int) $term->term_id,
				'name'  => $term->name,
				'slug'  => $term->slug,
				'count' => (int) $term->count,
			);
		}
		return $this->respond( array( 'items' => $items, 'total' => count( $items ) ) );
	}

	/* ---------------------------------------------------------------------
	 * Write
	 * ------------------------------------------------------------------- */

	public function create_post( WP_REST_Request $request ) {
		$type = $this->sanitize_type( $request->get_param( 'type' ) );
		if ( is_wp_error( $type ) ) {
			return $type;
		}

		$fields = $this->collect_writable_fields( $request );
		if ( is_wp_error( $fields ) ) {
			return $fields;
		}

		$postarr = array_merge(
			array(
				'post_type'   => $type,
				'post_status' => 'draft',
				'post_author' => get_current_user_id(),
			),
			$fields['core']
		);

		if ( '' === trim( (string) ( $postarr['post_title'] ?? '' ) ) ) {
			return new WP_Error( 'bt_ops_missing_title', 'A title is required.', array( 'status' => 422 ) );
		}

		$id = wp_insert_post( $postarr, true );
		if ( is_wp_error( $id ) ) {
			return $id;
		}

		$this->apply_meta( $id, $fields['meta'] );
		$this->apply_terms( $id, $type, $fields['terms'] );
		$this->apply_featured_image( $id, $fields['featuredImageId'] );

		return $this->respond( $this->shape_detail( get_post( $id ) ), 201 );
	}

	public function update_post_item( WP_REST_Request $request ) {
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}

		// Elementor and block content cannot survive a round-trip through a
		// plain textarea. The SPA is read-only for those records; the server
		// enforces it too, because a client-side guard is not a guarantee.
		if ( $request->offsetExists( 'content' ) && $this->is_builder_content( $post ) ) {
			return new WP_Error(
				'bt_ops_builder_content_readonly',
				'This record carries Elementor or Gutenberg block content and cannot be edited from the dashboard. Open it in the WordPress editor.',
				array( 'status' => 409, 'editLink' => get_edit_post_link( $post->ID, 'raw' ) )
			);
		}

		// Optimistic concurrency: two administrators, one site, no locking.
		$expected = (string) $request->get_param( 'modifiedGmt' );
		if ( '' !== $expected && $expected !== $this->iso( $post->post_modified_gmt ) ) {
			return new WP_Error(
				'bt_ops_conflict',
				'This record changed since you loaded it. Reload before saving to avoid overwriting someone else\'s edit.',
				array( 'status' => 409, 'currentModifiedGmt' => $this->iso( $post->post_modified_gmt ) )
			);
		}

		$fields = $this->collect_writable_fields( $request );
		if ( is_wp_error( $fields ) ) {
			return $fields;
		}

		$status = $fields['core']['post_status'] ?? null;
		if ( 'publish' === $status && ! current_user_can( 'publish_posts' ) ) {
			return $this->forbidden( 'publish_posts' );
		}

		if ( ! empty( $fields['core'] ) ) {
			$result = wp_update_post( array_merge( array( 'ID' => $post->ID ), $fields['core'] ), true );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		$this->apply_meta( $post->ID, $fields['meta'] );
		$this->apply_terms( $post->ID, $post->post_type, $fields['terms'] );
		$this->apply_featured_image( $post->ID, $fields['featuredImageId'] );

		return $this->respond( $this->shape_detail( get_post( $post->ID ) ) );
	}

	public function delete_post_item( WP_REST_Request $request ) {
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$force = filter_var( $request->get_param( 'force' ), FILTER_VALIDATE_BOOLEAN );

		if ( $force ) {
			$deleted = wp_delete_post( $post->ID, true );
			if ( ! $deleted ) {
				return new WP_Error( 'bt_ops_delete_failed', 'The record could not be deleted.', array( 'status' => 500 ) );
			}
			return $this->respond( array( 'deleted' => true, 'id' => (int) $post->ID, 'permanent' => true ) );
		}

		$trashed = wp_trash_post( $post->ID );
		if ( ! $trashed ) {
			return new WP_Error( 'bt_ops_trash_failed', 'The record could not be moved to trash.', array( 'status' => 500 ) );
		}
		return $this->respond( array( 'deleted' => true, 'id' => (int) $post->ID, 'permanent' => false ) );
	}

	public function restore_post_item( WP_REST_Request $request ) {
		$post = $this->resolve_post( $request );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		if ( 'trash' !== $post->post_status ) {
			return new WP_Error( 'bt_ops_not_trashed', 'This record is not in the trash.', array( 'status' => 409 ) );
		}
		$restored = wp_untrash_post( $post->ID );
		if ( ! $restored ) {
			return new WP_Error( 'bt_ops_restore_failed', 'The record could not be restored.', array( 'status' => 500 ) );
		}
		// wp_untrash_post() restores to 'draft' on modern WordPress; make the
		// resulting state explicit rather than leaving the client to guess.
		return $this->respond( $this->shape_detail( get_post( $post->ID ) ) );
	}

	public function create_term( WP_REST_Request $request ) {
		$taxonomy = sanitize_key( (string) $request->get_param( 'taxonomy' ) );
		if ( ! $taxonomy || ! taxonomy_exists( $taxonomy ) ) {
			return new WP_Error( 'bt_ops_unknown_taxonomy', 'Unknown taxonomy.', array( 'status' => 404 ) );
		}
		$name = sanitize_text_field( (string) $request->get_param( 'name' ) );
		if ( '' === trim( $name ) ) {
			return new WP_Error( 'bt_ops_missing_term_name', 'A term name is required.', array( 'status' => 422 ) );
		}
		$created = wp_insert_term( $name, $taxonomy );
		if ( is_wp_error( $created ) ) {
			return $created;
		}
		$term = get_term( $created['term_id'], $taxonomy );
		return $this->respond( array(
			'id'    => (int) $term->term_id,
			'name'  => $term->name,
			'slug'  => $term->slug,
			'count' => (int) $term->count,
		), 201 );
	}

	/* ---------------------------------------------------------------------
	 * Input handling
	 * ------------------------------------------------------------------- */

	/**
	 * Pulls only the fields this controller recognises off the request.
	 *
	 * Unknown keys are rejected outright rather than forwarded to
	 * wp_insert_post(), so a typo cannot silently become a no-op and a hostile
	 * key cannot ride along into the postarr.
	 */
	private function collect_writable_fields( WP_REST_Request $request ) {
		$core  = array();
		$meta  = array();
		$terms = array();

		$known = array(
			'type', 'title', 'slug', 'content', 'excerpt', 'status', 'date',
			'author', 'categories', 'tags', 'featuredImageId', 'modifiedGmt',
			'bt_seo_title', 'bt_seo_description', '_wpistic_tone',
		);
		foreach ( array_keys( (array) $request->get_json_params() ) as $key ) {
			if ( ! in_array( $key, $known, true ) ) {
				return new WP_Error(
					'bt_ops_unknown_field',
					sprintf( 'Unrecognised field: %s', sanitize_key( $key ) ),
					array( 'status' => 422 )
				);
			}
		}

		if ( $request->offsetExists( 'title' ) ) {
			$core['post_title'] = sanitize_text_field( (string) $request->get_param( 'title' ) );
		}
		if ( $request->offsetExists( 'slug' ) ) {
			$core['post_name'] = sanitize_title( (string) $request->get_param( 'slug' ) );
		}
		if ( $request->offsetExists( 'content' ) ) {
			$core['post_content'] = wp_kses_post( (string) $request->get_param( 'content' ) );
		}
		if ( $request->offsetExists( 'excerpt' ) ) {
			$core['post_excerpt'] = sanitize_textarea_field( (string) $request->get_param( 'excerpt' ) );
		}
		if ( $request->offsetExists( 'status' ) ) {
			$status = (string) $request->get_param( 'status' );
			if ( ! in_array( $status, self::ALLOWED_STATUSES, true ) ) {
				return new WP_Error( 'bt_ops_invalid_status', 'Unsupported post status.', array( 'status' => 422 ) );
			}
			$core['post_status'] = $status;
		}
		if ( $request->offsetExists( 'date' ) ) {
			$date = (string) $request->get_param( 'date' );
			$time = strtotime( $date );
			if ( ! $time ) {
				return new WP_Error( 'bt_ops_invalid_date', 'Unparseable publication date.', array( 'status' => 422 ) );
			}
			$core['post_date']     = gmdate( 'Y-m-d H:i:s', $time + ( (int) ( get_option( 'gmt_offset' ) * HOUR_IN_SECONDS ) ) );
			$core['post_date_gmt'] = gmdate( 'Y-m-d H:i:s', $time );
		}
		if ( $request->offsetExists( 'author' ) ) {
			$author = (int) $request->get_param( 'author' );
			if ( $author > 0 && get_userdata( $author ) ) {
				$core['post_author'] = $author;
			}
		}

		foreach ( self::WRITABLE_META as $key ) {
			if ( $request->offsetExists( $key ) ) {
				$meta[ $key ] = sanitize_text_field( (string) $request->get_param( $key ) );
			}
		}

		if ( $request->offsetExists( 'categories' ) ) {
			$terms['category'] = array_map( 'absint', (array) $request->get_param( 'categories' ) );
		}
		if ( $request->offsetExists( 'tags' ) ) {
			$terms['post_tag'] = array_map( 'absint', (array) $request->get_param( 'tags' ) );
		}

		return array(
			'core'            => $core,
			'meta'            => $meta,
			'terms'           => $terms,
			'featuredImageId' => $request->offsetExists( 'featuredImageId' ) ? (int) $request->get_param( 'featuredImageId' ) : null,
		);
	}

	private function apply_meta( $post_id, array $meta ) {
		foreach ( $meta as $key => $value ) {
			if ( ! in_array( $key, self::WRITABLE_META, true ) ) {
				continue; // Defence in depth; collect_writable_fields already filtered.
			}
			if ( '' === $value ) {
				delete_post_meta( $post_id, $key );
				continue;
			}
			update_post_meta( $post_id, $key, $value );
		}
	}

	private function apply_terms( $post_id, $post_type, array $terms ) {
		foreach ( $terms as $taxonomy => $ids ) {
			if ( ! taxonomy_exists( $taxonomy ) ) {
				continue;
			}
			if ( ! in_array( $taxonomy, get_object_taxonomies( $post_type ), true ) ) {
				continue;
			}
			$taxonomy_object = get_taxonomy( $taxonomy );
			if ( ! current_user_can( $taxonomy_object->cap->assign_terms ) ) {
				continue;
			}
			wp_set_object_terms( $post_id, array_filter( $ids ), $taxonomy, false );
		}
	}

	private function apply_featured_image( $post_id, $attachment_id ) {
		if ( null === $attachment_id ) {
			return;
		}
		if ( $attachment_id <= 0 ) {
			delete_post_thumbnail( $post_id );
			return;
		}
		if ( 'attachment' === get_post_type( $attachment_id ) ) {
			set_post_thumbnail( $post_id, $attachment_id );
		}
	}

	/* ---------------------------------------------------------------------
	 * Shaping
	 * ------------------------------------------------------------------- */

	private function shape_summary( WP_Post $post ) {
		return array(
			'id'          => (int) $post->ID,
			'type'        => $post->post_type,
			'title'       => get_the_title( $post ),
			'slug'        => $post->post_name,
			'status'      => $post->post_status,
			'excerpt'     => (string) $post->post_excerpt,
			'authorId'    => (int) $post->post_author,
			'authorName'  => get_the_author_meta( 'display_name', $post->post_author ),
			'date'        => $this->iso( $post->post_date_gmt ),
			'modifiedGmt' => $this->iso( $post->post_modified_gmt ),
			'featuredImage' => $this->thumbnail_url( $post->ID ),
			'hasBlocks'      => has_blocks( $post ),
			'hasElementorData' => $this->has_elementor( $post->ID ),
			'seo'         => array(
				'title'       => (string) get_post_meta( $post->ID, 'bt_seo_title', true ),
				'description' => (string) get_post_meta( $post->ID, 'bt_seo_description', true ),
				'score'       => $this->seoistic_score( $post->ID ),
			),
			'editLink'    => get_edit_post_link( $post->ID, 'raw' ),
			'viewLink'    => get_permalink( $post ),
		);
	}

	private function shape_detail( WP_Post $post ) {
		$detail = $this->shape_summary( $post );

		$detail['content'] = $post->post_content;
		$detail['canPublish'] = current_user_can( 'publish_posts' );
		$detail['canDelete']  = current_user_can( 'delete_post', $post->ID );
		$detail['readOnlyBody'] = $this->is_builder_content( $post );

		$detail['terms'] = array();
		foreach ( get_object_taxonomies( $post->post_type ) as $taxonomy ) {
			$assigned = wp_get_object_terms( $post->ID, $taxonomy, array( 'fields' => 'all' ) );
			if ( is_wp_error( $assigned ) ) {
				continue;
			}
			$detail['terms'][ $taxonomy ] = array_map(
				static function ( $term ) {
					return array( 'id' => (int) $term->term_id, 'name' => $term->name, 'slug' => $term->slug );
				},
				$assigned
			);
		}

		// Read-only audit output. Surfaced so the editor can show a score, never
		// written back — SEOISTIC owns these keys.
		$detail['seoistic'] = array();
		foreach ( self::READONLY_META as $key ) {
			$value = get_post_meta( $post->ID, $key, true );
			if ( '' !== $value && null !== $value ) {
				$detail['seoistic'][ ltrim( $key, '_' ) ] = is_scalar( $value ) ? $value : null;
			}
		}

		return $detail;
	}

	private function thumbnail_url( $post_id ) {
		$thumb = get_post_thumbnail_id( $post_id );
		if ( ! $thumb ) {
			return null;
		}
		$src = wp_get_attachment_image_src( $thumb, 'medium' );
		return $src ? $src[0] : null;
	}

	private function seoistic_score( $post_id ) {
		$score = get_post_meta( $post_id, '_seoistic_score', true );
		return ( '' === $score || null === $score ) ? null : (int) $score;
	}

	private function has_elementor( $post_id ) {
		return 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true );
	}

	private function is_builder_content( WP_Post $post ) {
		return $this->has_elementor( $post->ID ) || has_blocks( $post );
	}

	/* ---------------------------------------------------------------------
	 * Helpers
	 * ------------------------------------------------------------------- */

	private function resolve_post( WP_REST_Request $request ) {
		$id   = (int) $request->get_param( 'id' );
		$post = $id ? get_post( $id ) : null;
		if ( ! $post ) {
			return new WP_Error( 'bt_ops_not_found', 'Record not found.', array( 'status' => 404 ) );
		}
		if ( ! in_array( $post->post_type, self::ALLOWED_TYPES, true ) ) {
			return new WP_Error( 'bt_ops_type_not_allowed', 'This post type is not managed by the operations console.', array( 'status' => 403 ) );
		}
		return $post;
	}

	private function sanitize_type( $type ) {
		$type = sanitize_key( (string) ( $type ?: 'post' ) );
		if ( ! in_array( $type, self::ALLOWED_TYPES, true ) ) {
			return new WP_Error( 'bt_ops_type_not_allowed', 'This post type is not managed by the operations console.', array( 'status' => 403 ) );
		}
		return $type;
	}

	private function sanitize_query_status( $status ) {
		if ( 'any' === $status ) {
			return array_merge( self::ALLOWED_STATUSES, array( 'trash' ) );
		}
		if ( in_array( $status, array_merge( self::ALLOWED_STATUSES, array( 'trash' ) ), true ) ) {
			return $status;
		}
		return array_merge( self::ALLOWED_STATUSES, array( 'trash' ) );
	}

	private function sanitize_orderby( $orderby ) {
		$allowed = array( 'date', 'modified', 'title', 'ID', 'menu_order' );
		return in_array( (string) $orderby, $allowed, true ) ? (string) $orderby : 'modified';
	}

	private function iso( $mysql_gmt ) {
		if ( ! $mysql_gmt || '0000-00-00 00:00:00' === $mysql_gmt ) {
			return null;
		}
		return gmdate( 'c', strtotime( $mysql_gmt . ' UTC' ) );
	}

	/**
	 * Delegates to the plugin's shared envelope so every route answers in the
	 * same shape: { success, data, meta: { generatedAt, timezone, apiVersion } }.
	 */
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
