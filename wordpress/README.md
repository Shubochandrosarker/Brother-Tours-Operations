# WordPress backend — `brother-tours-operations-api` 1.1.0

New operations-plane controllers that give the dashboard content management and
analytics. **Not applied.** These are reviewable source files, staged here for
sign-off and manual deployment.

---

## 0. Read this before deploying

### 0.1 These files were written against a documented interface, not the source

The plugin `brother-tours-operations-api` v1.0.1 lives on the production
WordPress host and **is not in this repository**. The controllers here were
written against the interface described in Master Prompt v2.0's live runtime
read — not against the actual plugin source, which was never available in the
environment that produced them.

**Everything in §1 is an assumption that must be checked before this ships.**
A mismatch will show up as a fatal error, not a graceful degradation.

### 0.2 Deployment preconditions

Per the Brother Tours execution runbook, all three before any file is copied:

1. Explicit sign-off from Shuvo.
2. **A Bridgistic snapshot taken immediately beforehand.**
3. Deployed one controller at a time, with the §2 smoke test between each.

---

## 1. Integration contract — verify each line

These controllers assume the following about the existing plugin. Check each
against the real source before deploying; adapt the controllers, not the plugin.

| # | Assumption | Used by | If wrong |
|---|---|---|---|
| A-1 | `BTOA_NAMESPACE` is defined and equals `bridgistic/v1` | all | Routes register in the wrong namespace and the session gate never fires |
| A-2 | `\BrotherTours\OperationsApi\Support\Csrf::authorize( $request )` exists and returns `true` or `WP_Error` | all | **Fails closed** — every route returns 500 `bt_ops_authorize_unavailable`. Safe, but the API is dead until fixed |
| A-3 | A response helper produces `{ success, data, meta }` | all | Falls back to an inline `WP_REST_Response` in the same shape. Safe, but bypasses any shared header logic |
| A-4 | `BTOA_VERSION` is defined | all | `meta.apiVersion` reports `1.1.0` |
| A-5 | The PSR-4 root maps `BrotherTours\OperationsApi\` → `includes/` | all | Classes never autoload; add explicit `require_once` in the boot file |
| A-6 | Capability `bt_manage_operations` exists | analytics, site | Analytics returns 403 for everyone |

**A-2 and A-3 are the load-bearing ones.** The controllers deliberately fail
closed on A-2: a missing authorization helper returns 500 rather than
defaulting to allow. Do not "fix" that by removing the guard.

If the real helper names differ, change the three private methods
(`authorize()`, `respond()`) in each controller. They are isolated for exactly
this reason.

---

## 2. Registration

The controllers are inert until registered. Add to the `plugins_loaded` boot
list in `brother-tours-operations-api.php`:

```php
add_action( 'rest_api_init', function () {
	( new \BrotherTours\OperationsApi\Content\ContentController() )->register_routes();
	( new \BrotherTours\OperationsApi\Media\MediaController() )->register_routes();
	( new \BrotherTours\OperationsApi\Insightistic\AnalyticsController() )->register_routes();
	( new \BrotherTours\OperationsApi\System\SiteController() )->register_routes();

	// Defect B-1: this controller has existed since 1.0.1 but was never in the
	// boot list, so GET /insightistic has always returned 404 while the README
	// documented it as live. Register it, and change its capability check from
	// edit_posts to bt_manage_operations for consistency with every other read
	// route (defect B-3).
	if ( class_exists( '\BrotherTours\OperationsApi\Insightistic\InsightisticController' ) ) {
		( new \BrotherTours\OperationsApi\Insightistic\InsightisticController() )->register_routes();
	}
} );
```

Bump the plugin header and `BTOA_VERSION` to `1.1.0`.

---

## 3. What each controller adds

### `Content/ContentController.php`

```
GET    /content/types                     registered types the user may edit, with counts
GET    /content/posts                     ?type&status&search&page&perPage&orderby&order&author&category
POST   /content/posts                     create
GET    /content/posts/{id}                full record incl. meta, terms, featured image
PATCH  /content/posts/{id}                update
DELETE /content/posts/{id}?force=true     trash, or permanent with force
POST   /content/posts/{id}/restore        untrash
GET    /content/posts/{id}/revisions      revision list
GET    /content/taxonomies?type=post
GET    /content/terms?taxonomy=&search=
POST   /content/terms                     create term
```

Five things worth knowing:

1. **Post types are allowlisted** to `post`, `page`, `wpistic_tour`,
   `wpistic_destination`, `wpistic_experience`. An arbitrary `post_type` from
   the client is how a content endpoint becomes an arbitrary-CPT write
   endpoint.
2. **Capabilities are per-object.** `current_user_can( 'edit_post', $id )`, not
   a blanket `edit_posts` on the controller. `bt_manage_operations` gates
   login and is held by seven roles — only `administrator` also holds
   `edit_posts`.
3. **Unknown fields are rejected with 422** rather than forwarded to
   `wp_insert_post()`. A typo fails loudly instead of silently doing nothing.
4. **`_seoistic_*` is read-only.** Those keys are audit output owned by
   SEOISTIC. The response exposes the score; no write path touches them. Only
   `bt_seo_title`, `bt_seo_description` and `_wpistic_tone` are writable.
5. **Builder content is server-side read-only.** Records with
   `_elementor_edit_mode = builder` or `has_blocks()` reject a `content` PATCH
   with 409 and an edit link. Round-tripping Elementor JSON through a textarea
   destroys the page, and a client-side guard is not a guarantee.

Optimistic concurrency: send the record's `modifiedGmt` back on PATCH and the
server returns 409 if it changed. Two administrators, one site, no locking.

### `Insightistic/AnalyticsController.php`

```
GET  /analytics/status                    integration booleans, last sync, system status
GET  /analytics/search-console?days=28    { daily, queries, pages, totals }
GET  /analytics/ga4?days=28               { daily, dailyAvailable, channels, countries, pages, totals }
GET  /analytics/pagespeed?url=&strategy=  cached result: fresh | stale | never_run
POST /analytics/pagespeed/run             enqueue a cron run (manage_options)
GET  /analytics/404s?page&perPage         paginated slice of the 41 KB log
```

Insightistic 4.4.0 registers **no REST namespace** — it is admin-AJAX only.
This adapter is the only path from the dashboard to GA4/GSC/PSI data.

Four hard rules, each enforced in code:

- **No secret leaves the server.** `/analytics/status` reports booleans.
  A recursive `scrub()` runs on every payload and drops any key matching
  `private_key|api_key|secret|_enc$|password|token`, at any depth — so an
  upstream payload embedding a credential we did not anticipate still cannot
  reach the client.
- **`html` never crosses the boundary.** `get_dashboard_data()` returns a
  pre-rendered string built by another plugin. `scrub()` drops it. The SPA has
  no `dangerouslySetInnerHTML` and the build fails if one appears.
- **PageSpeed is asynchronous.** A live PSI call is routinely 10–30s and would
  hit the PHP timeout inside a request. `GET` serves a transient; `POST /run`
  schedules a single cron event. The last result is also kept in an option so
  the UI can show "stale" rather than dropping back to "never run" every six
  hours.
- **PageSpeed targets are same-origin only.** Otherwise the endpoint is an open
  PSI relay anyone with a session could point at an arbitrary host on our key.

`GA4 daily[]` returns empty on this property while `channels` returns 7 rows.
The response carries an explicit `dailyAvailable: false` so the client renders
an unavailable state rather than a flat-line chart. **Do not build a GA4
time-series chart until that is diagnosed** (conflict C-08).

Cache TTLs: GSC and GA4 1 h, PageSpeed 6 h, status 5 min. Google quota is
finite and the SPA polls.

### `Media/MediaController.php`

```
GET    /media          ?search&page&perPage&mimeType
POST   /media          multipart/form-data (upload_files)
GET    /media/{id}
PATCH  /media/{id}     alt, title, caption, description
DELETE /media/{id}?force=true
```

- Type is detected with `wp_check_filetype_and_ext()` against the file itself,
  not the name or the client-declared type, then checked against both an
  explicit allowlist and `get_allowed_mime_types()` for the current user.
- **SVG is not accepted** — an XSS vector without a sanitiser in the pipeline.
- 16 MB ceiling regardless of what PHP would otherwise permit.
- Returns the full `sizes` map so a grid can pick a thumbnail instead of
  loading 78 full-size originals, and flags `missingAlt` per item.

### `System/SiteController.php`

```
GET /site/overview   WP/PHP version, theme, timezone, per-type counts, media and user counts
GET /site/plugins    name, version, active (manage_options)
GET /site/users      id, displayName, email, roles, postCount (list_users)
GET /site/cron       next runs for watched hooks (manage_options)
```

Read-only in 1.1.0. Activation, updates and user creation stay in wp-admin —
they belong to the connector plane and its approval gate, not a browser
session.

---

## 4. Smoke test

Run between each controller. Against a staging copy, or with an administrator
Application Password — **never against production unreviewed.**

```bash
BASE=https://www.brothertours.com/wp-json/bridgistic/v1
AUTH='-u user:app-password'

# Registration
curl -s "$BASE/" | jq -r '.routes | keys[]' | grep -E 'content|analytics|media|site'

# Content — expect 6 published articles, 40 published pages, 78 attachments
curl -s $AUTH "$BASE/content/posts?type=post&status=publish" | jq '.data.total'   # 6
curl -s $AUTH "$BASE/content/posts?type=page&status=publish" | jq '.data.total'   # 40
curl -s $AUTH "$BASE/media?perPage=1"                        | jq '.data.total'   # 78

# Analytics — booleans true, and NO secret values anywhere
curl -s $AUTH "$BASE/analytics/status" | jq '.data.ga4.configured, .data.gsc.configured'
curl -s $AUTH "$BASE/analytics/status" | grep -ciE 'private_key|api_key|secret|_enc'   # 0
curl -s $AUTH "$BASE/analytics/search-console?days=28" | jq '.data.daily | length'     # 29
curl -s $AUTH "$BASE/analytics/ga4?days=28" | jq '.data.dailyAvailable'                # false, expected
curl -s $AUTH "$BASE/analytics/ga4?days=28" | jq 'has("html")'                         # false

# Authorization — anonymous writes must never succeed
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/content/posts" \
  -H 'Content-Type: application/json' -d '{"title":"x"}'                               # 401/403

# Same-origin guard on PageSpeed
curl -s $AUTH -X POST "$BASE/analytics/pagespeed/run" \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com/"}'              # 422
```

The anonymous-write check and the secret-leak check are the two that must never
be skipped.

---

## 5. Deliberately not included

| Item | Why |
|---|---|
| Plugin activation / update / user creation | Connector plane, approval-gated. Link to wp-admin. |
| Gutenberg or Elementor editing | Reimplementing either in the SPA is a trap. Builder records are read-only with an "Open in WordPress" link. |
| SVG upload | XSS vector without a sanitiser (decision D-3). |
| Granting `edit_posts` to ops roles | A business decision, not a side effect of this work (decision D-2). |
| `bt-ops/v2` namespace migration | Product decision D-1, sequenced separately. These routes are added under the existing namespace. |
| Revenue analytics | The Insightistic licence is the free plan, `woocommerce_pro` is off, and there is no WooCommerce. Nothing to derive revenue from. |
