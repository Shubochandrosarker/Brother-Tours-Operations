<?php
/**
 * Media controller — library listing, upload, metadata and deletion.
 *
 * The Operations API README says to use the core wp/v2 media API for uploads.
 * That is wrong for this SPA and will 401: SessionController's
 * determine_current_user() only resolves the ops session for URIs containing
 * the operations namespace, so wp/v2 sees user 0. Media must live here.
 *
 * @package BrotherTours\OperationsApi
 */

namespace BrotherTours\OperationsApi\Media;

use WP_Error;
use WP_Query;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

class MediaController {

	/** Hard ceiling regardless of what PHP or the role would otherwise allow. */
	const MAX_BYTES = 16777216; // 16 MB

	/**
	 * Explicit allowlist on top of get_allowed_mime_types() for the current
	 * user. SVG is deliberately absent — it is an XSS vector without a
	 * sanitiser in the pipeline.
	 */
	const ALLOWED_MIME = array(
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/avif',
		'application/pdf',
	);

	public function register_routes() {
		$ns = BTOA_NAMESPACE;

		register_rest_route( $ns, '/media', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_media' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'upload_media' ),
				'permission_callback' => array( $this, 'can_upload' ),
			),
		) );

		register_rest_route( $ns, '/media/(?P<id>\d+)', array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_media' ),
				'permission_callback' => array( $this, 'can_read' ),
			),
			array(
				'methods'             => 'PATCH',
				'callback'            => array( $this, 'update_media' ),
				'permission_callback' => array( $this, 'can_edit_item' ),
			),
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => array( $this, 'delete_media' ),
				'permission_callback' => array( $this, 'can_delete_item' ),
			),
		) );
	}

	/* ------------------------------------------------------------------ */

	public function can_read( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'upload_files' ) || current_user_can( 'edit_posts' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'Your account cannot browse the media library.', array( 'status' => 403 ) );
	}

	public function can_upload( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return current_user_can( 'upload_files' )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'Your account does not have the upload_files capability.', array( 'status' => 403 ) );
	}

	public function can_edit_item( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		$id = (int) $request->get_param( 'id' );
		return current_user_can( 'edit_post', $id )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'You cannot edit this attachment.', array( 'status' => 403 ) );
	}

	public function can_delete_item( WP_REST_Request $request ) {
		$auth = $this->authorize( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		$id = (int) $request->get_param( 'id' );
		return current_user_can( 'delete_post', $id )
			? true
			: new WP_Error( 'bt_ops_forbidden', 'You cannot delete this attachment.', array( 'status' => 403 ) );
	}

	private function authorize( WP_REST_Request $request ) {
		if ( class_exists( '\BrotherTours\OperationsApi\Support\Csrf' ) ) {
			return \BrotherTours\OperationsApi\Support\Csrf::authorize( $request );
		}
		return new WP_Error( 'bt_ops_authorize_unavailable', 'Authorization helper is unavailable.', array( 'status' => 500 ) );
	}

	/* ------------------------------------------------------------------ */

	public function list_media( WP_REST_Request $request ) {
		$per_page = min( 100, max( 1, (int) ( $request->get_param( 'perPage' ) ?: $request->get_param( 'per_page' ) ?: 40 ) ) );
		$page     = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );

		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'date',
			'order'          => 'DESC',
		);

		$search = sanitize_text_field( (string) $request->get_param( 'search' ) );
		if ( '' !== $search ) {
			$args['s'] = $search;
		}
		$mime = sanitize_text_field( (string) ( $request->get_param( 'mimeType' ) ?: $request->get_param( 'mime_type' ) ) );
		if ( '' !== $mime ) {
			$args['post_mime_type'] = $mime;
		}

		$query = new WP_Query( $args );
		$items = array_map( array( $this, 'shape' ), $query->posts );

		return $this->respond( array(
			'items'      => $items,
			'total'      => (int) $query->found_posts,
			'totalPages' => (int) $query->max_num_pages,
			'page'       => $page,
			'perPage'    => $per_page,
		) );
	}

	public function get_media( WP_REST_Request $request ) {
		$id   = (int) $request->get_param( 'id' );
		$post = get_post( $id );
		if ( ! $post || 'attachment' !== $post->post_type ) {
			return new WP_Error( 'bt_ops_not_found', 'Attachment not found.', array( 'status' => 404 ) );
		}
		return $this->respond( $this->shape( $post ) );
	}

	public function upload_media( WP_REST_Request $request ) {
		$files = $request->get_file_params();
		if ( empty( $files['file'] ) ) {
			return new WP_Error( 'bt_ops_no_file', 'No file was uploaded.', array( 'status' => 422 ) );
		}

		$file = $files['file'];

		if ( ! empty( $file['error'] ) ) {
			return new WP_Error( 'bt_ops_upload_error', 'The upload did not complete.', array( 'status' => 422 ) );
		}
		if ( (int) $file['size'] > self::MAX_BYTES ) {
			return new WP_Error(
				'bt_ops_file_too_large',
				sprintf( 'Files must be %d MB or smaller.', self::MAX_BYTES / 1048576 ),
				array( 'status' => 422 )
			);
		}

		// Trust the file's real type, not the name or the client-declared type.
		$checked = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
		$mime    = $checked['type'] ?: '';
		if ( ! in_array( $mime, self::ALLOWED_MIME, true ) ) {
			return new WP_Error(
				'bt_ops_mime_not_allowed',
				'That file type is not accepted. Images and PDFs only.',
				array( 'status' => 422, 'detectedType' => $mime ?: null )
			);
		}
		// And still respect what this particular user is allowed to upload.
		if ( ! in_array( $mime, (array) get_allowed_mime_types(), true ) ) {
			return new WP_Error( 'bt_ops_mime_not_allowed_for_user', 'Your account cannot upload that file type.', array( 'status' => 403 ) );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$handled = wp_handle_upload( $file, array( 'test_form' => false ) );
		if ( isset( $handled['error'] ) ) {
			return new WP_Error( 'bt_ops_upload_failed', $handled['error'], array( 'status' => 500 ) );
		}

		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => $handled['type'],
				'post_title'     => sanitize_text_field( (string) ( $request->get_param( 'title' ) ?: pathinfo( $handled['file'], PATHINFO_FILENAME ) ) ),
				'post_content'   => '',
				'post_status'    => 'inherit',
			),
			$handled['file'],
			0,
			true
		);
		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $handled['file'] ) );

		// Alt text is required by the UI because the site's SEO audit already
		// flags missing alt text; an uploader that skips it makes that worse.
		$alt = sanitize_text_field( (string) $request->get_param( 'alt' ) );
		if ( '' !== $alt ) {
			update_post_meta( $attachment_id, '_wp_attachment_image_alt', $alt );
		}
		$caption = sanitize_text_field( (string) $request->get_param( 'caption' ) );
		if ( '' !== $caption ) {
			wp_update_post( array( 'ID' => $attachment_id, 'post_excerpt' => $caption ) );
		}

		return $this->respond( $this->shape( get_post( $attachment_id ) ), 201 );
	}

	public function update_media( WP_REST_Request $request ) {
		$id   = (int) $request->get_param( 'id' );
		$post = get_post( $id );
		if ( ! $post || 'attachment' !== $post->post_type ) {
			return new WP_Error( 'bt_ops_not_found', 'Attachment not found.', array( 'status' => 404 ) );
		}

		$update = array( 'ID' => $id );
		if ( $request->offsetExists( 'title' ) ) {
			$update['post_title'] = sanitize_text_field( (string) $request->get_param( 'title' ) );
		}
		if ( $request->offsetExists( 'caption' ) ) {
			$update['post_excerpt'] = sanitize_text_field( (string) $request->get_param( 'caption' ) );
		}
		if ( $request->offsetExists( 'description' ) ) {
			$update['post_content'] = sanitize_textarea_field( (string) $request->get_param( 'description' ) );
		}
		if ( count( $update ) > 1 ) {
			$result = wp_update_post( $update, true );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		if ( $request->offsetExists( 'alt' ) ) {
			update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( (string) $request->get_param( 'alt' ) ) );
		}

		return $this->respond( $this->shape( get_post( $id ) ) );
	}

	public function delete_media( WP_REST_Request $request ) {
		$id    = (int) $request->get_param( 'id' );
		$force = filter_var( $request->get_param( 'force' ), FILTER_VALIDATE_BOOLEAN );
		$post  = get_post( $id );
		if ( ! $post || 'attachment' !== $post->post_type ) {
			return new WP_Error( 'bt_ops_not_found', 'Attachment not found.', array( 'status' => 404 ) );
		}
		$deleted = wp_delete_attachment( $id, $force );
		if ( ! $deleted ) {
			return new WP_Error( 'bt_ops_delete_failed', 'The attachment could not be deleted.', array( 'status' => 500 ) );
		}
		return $this->respond( array( 'deleted' => true, 'id' => $id, 'permanent' => (bool) $force ) );
	}

	/* ------------------------------------------------------------------ */

	private function shape( $post ) {
		$id    = (int) $post->ID;
		$metadata = wp_get_attachment_metadata( $id );

		// The full sizes map, so a grid can pick a thumbnail instead of loading
		// 78 full-size originals.
		$sizes = array();
		if ( is_array( $metadata ) && ! empty( $metadata['sizes'] ) ) {
			foreach ( array_keys( $metadata['sizes'] ) as $size ) {
				$src = wp_get_attachment_image_src( $id, $size );
				if ( $src ) {
					$sizes[ $size ] = array( 'url' => $src[0], 'width' => (int) $src[1], 'height' => (int) $src[2] );
				}
			}
		}

		return array(
			'id'          => $id,
			'title'       => get_the_title( $post ),
			'alt'         => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
			'caption'     => (string) $post->post_excerpt,
			'description' => (string) $post->post_content,
			'mimeType'    => $post->post_mime_type,
			'url'         => wp_get_attachment_url( $id ),
			'thumbnail'   => wp_get_attachment_image_url( $id, 'thumbnail' ) ?: null,
			'medium'      => wp_get_attachment_image_url( $id, 'medium' ) ?: null,
			'sizes'       => $sizes,
			'width'       => isset( $metadata['width'] ) ? (int) $metadata['width'] : null,
			'height'      => isset( $metadata['height'] ) ? (int) $metadata['height'] : null,
			'filesize'    => isset( $metadata['filesize'] ) ? (int) $metadata['filesize'] : null,
			'uploadedAt'  => $post->post_date_gmt ? gmdate( 'c', strtotime( $post->post_date_gmt . ' UTC' ) ) : null,
			'authorName'  => get_the_author_meta( 'display_name', $post->post_author ),
			'missingAlt'  => '' === (string) get_post_meta( $id, '_wp_attachment_image_alt', true )
				&& 0 === strpos( (string) $post->post_mime_type, 'image/' ),
		);
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
