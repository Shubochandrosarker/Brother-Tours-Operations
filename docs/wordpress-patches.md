# WordPress-side patches — PROPOSED, NOT APPLIED

**Status: none of these are applied.** They are recorded here as reviewed diffs awaiting sign-off.

These touch `brother-tours-operations-api` (v1.0.1) on live `www.brothertours.com`. Requirements before any of them ship:

1. Explicit sign-off from Shuvo.
2. A Bridgistic snapshot taken immediately beforehand.
3. Deployment one patch at a time, with the §2 smoke test in `DEPLOYMENT.md` run between each.

Blast-radius tiers follow the Brother Tours execution runbook.

> **Important:** the app-side deployment fix does **not** depend on any of these. The login loop was a stale committed bundle, not a backend defect. Ship the app fix first, confirm production is healthy, then consider these on their own schedule.

---

## 6.1 — Cookie domain · Tier 3 · Recommended

**Problem.** `SessionController::issue_session()` sets `'domain' => ''`, making `bt_ops_session` host-only for `www.brothertours.com`. It works today only because the app calls `www` directly. It breaks the moment anything calls the apex or a second subdomain.

The second half matters more than the first: `clear_cookie()` must use the *same* domain the cookie was set with. A cookie cleared under a different domain is never actually cleared, which leaves phantom sessions alive after logout.

```diff
--- a/includes/class-session-controller.php
+++ b/includes/class-session-controller.php
@@
+	/**
+	 * Cookie domain for the operations session.
+	 *
+	 * Must be identical when setting and clearing, or the clear silently
+	 * fails and the session survives logout.
+	 */
+	private function cookie_domain() {
+		$default = '.brothertours.com';
+		return (string) apply_filters( 'bt_ops_session_cookie_domain', $default );
+	}
+
 	private function issue_session( $user, $token, $expires_at ) {
 		setcookie(
 			self::COOKIE_NAME,
 			$token,
 			array(
 				'expires'  => $expires_at,
 				'path'     => '/',
-				'domain'   => '',
+				'domain'   => $this->cookie_domain(),
 				'secure'   => is_ssl(),
 				'httponly' => true,
 				'samesite' => 'None',
 			)
 		);
 	}
@@
 	private function clear_cookie() {
 		setcookie(
 			self::COOKIE_NAME,
 			'',
 			array(
 				'expires'  => time() - 3600,
 				'path'     => '/',
-				'domain'   => '',
+				'domain'   => $this->cookie_domain(),
 				'secure'   => is_ssl(),
 				'httponly' => true,
 				'samesite' => 'None',
 			)
 		);
 	}
```

**Blast radius.** Every currently signed-in operator is logged out once on deploy, because sessions issued host-only will no longer match the new domain-scoped cookie. Announce it. No data is affected.

**Rollback.** Revert the diff; operators sign in again once more.

---

## 6.2 — `Cache-Control: no-store` on all `bridgistic/v1` responses · Tier 3 · Do this

**Problem.** The site has an `advanced-cache.php` drop-in active and no external object cache. If `GET /auth/session` is ever page-cached, one operator's session state is served to every operator — or a cached `401` reproduces exactly this login loop for everyone at once, from the edge, with no backend signal.

This is the single highest-value backend change. An auth endpoint must never be cacheable.

```diff
--- a/brother-tours-operations-api.php
+++ b/brother-tours-operations-api.php
@@
 add_action( 'rest_api_init', array( $this, 'register_routes' ) );
+add_filter( 'rest_pre_serve_request', array( $this, 'force_no_store' ), 10, 4 );
@@
+	/**
+	 * Operations responses must never be cached — not by WordPress, not by the
+	 * advanced-cache.php drop-in, and not by any edge in front of them.
+	 *
+	 * @param bool             $served  Whether the request has already been served.
+	 * @param WP_HTTP_Response $result  Response object.
+	 * @param WP_REST_Request  $request Request object.
+	 * @param WP_REST_Server   $server  Server instance.
+	 * @return bool
+	 */
+	public function force_no_store( $served, $result, $request, $server ) {
+		$route = $request->get_route();
+		if ( 0 !== strpos( $route, '/bridgistic/v1' ) ) {
+			return $served;
+		}
+
+		nocache_headers();
+		if ( ! headers_sent() ) {
+			header( 'Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0' );
+			header( 'Pragma: no-cache' );
+			header( 'Expires: 0' );
+			header( 'Vary: Origin, Cookie' );
+		}
+
+		return $served;
+	}
```

Also set, so the drop-in does not cache the namespace before PHP gets a say:

```diff
--- a/wp-config.php
+++ b/wp-config.php
@@
+/* Never page-cache the operations API. */
+if ( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( $_SERVER['REQUEST_URI'], '/wp-json/bridgistic/v1' ) ) {
+	if ( ! defined( 'DONOTCACHEPAGE' ) ) {
+		define( 'DONOTCACHEPAGE', true );
+	}
+}
```

**Blast radius.** Response headers only; no schema, no data, no behaviour change for correctly-behaving clients. Slight increase in origin requests for operations routes, which is the intended outcome.

**Rollback.** Revert; caching returns to its current (unsafe) state.

---

## 6.3 — Namespace collision · Tier 4 · STOP — product decision, do not bundle

**Problem.** The Operations API registers under `bridgistic/v1` — **the same REST namespace as the Bridgistic connector plugin**. `GET /wp-json/bridgistic/v1` now enumerates 47 operations routes alongside Bridgistic's `execute`, `db/query`, `fs/write`, `fs/delete` and `users` routes in a single public index.

Two plugins owning one namespace is a defect regardless of security posture: either plugin's future route registration can silently shadow the other's, and neither team can see the collision from its own codebase.

**Recommendation.** Move the operations API to its own namespace (`bt-ops/v2`), serve both for one release with `bridgistic/v1` deprecated, then retire the old one.

```diff
--- a/includes/class-operations-api.php
+++ b/includes/class-operations-api.php
@@
-	const NAMESPACE = 'bridgistic/v1';
+	const NAMESPACE        = 'bt-ops/v2';
+	const LEGACY_NAMESPACE = 'bridgistic/v1';
@@
 	public function register_routes() {
-		$this->register_all( self::NAMESPACE );
+		$this->register_all( self::NAMESPACE );
+
+		// Deprecated. Remove one release after every client reports bt-ops/v2.
+		if ( apply_filters( 'bt_ops_serve_legacy_namespace', true ) ) {
+			$this->register_all( self::LEGACY_NAMESPACE );
+		}
 	}
```

**Why this must not ride along with the deployment fix.** It changes `VITE_BT_API_BASE`, the `scripts/preflight.mjs` regex, and `scripts/verify-build.mjs` — all three of which currently *hard-code `bridgistic/v1` as the correct value and treat `bt-ops` as the dead namespace signalling a stale bundle*. Shipping this without sequencing those changes would make the verifier reject every correct build.

Sequence, if approved:

1. Deploy the backend serving **both** namespaces.
2. Confirm both resolve in production.
3. Update `preflight.mjs` and `verify-build.mjs` to accept `bt-ops/v2` and keep rejecting `bt-ops/v1`.
4. Update `.env.production` and rebuild.
5. Confirm `/healthz` and DevTools show only `bt-ops/v2` traffic.
6. Only then set `bt_ops_serve_legacy_namespace` to false.

**Blast radius.** Every client of the API, plus the repository's own build guards. Highest-risk item on this page.

---

## 6.4 — REST index exposure

Fold into the existing `T-081` work item. Both namespaces should be filtered out of the public `/wp-json/` index. No separate diff here — `T-081` owns it.

---

## Verified as NOT causes — do not "fix" these

Confirmed against the live backend during the incident investigation. Listed so the same ground is not re-covered.

| Suspected | Verified state |
|---|---|
| CORS misconfigured | Correct. `BT_OPS_ALLOWED_ORIGINS` includes `https://app.brothertours.com`; `SessionController::cors_headers` sends the exact origin plus `Access-Control-Allow-Credentials: true` and strips core's reflected headers for non-allowlisted origins. |
| `credentials: 'include'` missing | Present on every request in `apps/web/src/api/client.js`. |
| Capability not granted | `bt_manage_operations` is held by `administrator`, `tour_staff`, `wpistic_travel_manager`, `wpistic_travel_agent`, `crm_owner`, `crm_manager`, `crm_sales`. Both existing users are administrators. |
| Cookie blocked as third-party | Not blocked. `app.brothertours.com` and `www.brothertours.com` share the registrable domain `brothertours.com`. |
| `SameSite`/`Secure` wrong | `is_ssl()` returns true; the cookie is issued `SameSite=None; Secure; HttpOnly; Path=/`. |
| WP REST nonce required | Not required. `rest_cookie_check_errors` early-returns because `$wp_rest_auth_cookie !== true` while `is_user_logged_in()` is true. |
| Routes not registered | All 47 `bridgistic/v1` operations routes are registered and resolving. |

**Provenance note.** The rows above are carried forward from the incident brief's live backend read of 18 Aug 2026. They were **not** independently re-verified while preparing this document — network egress to `brothertours.com` is blocked from the build environment. Treat them as prior findings, not fresh measurements.
