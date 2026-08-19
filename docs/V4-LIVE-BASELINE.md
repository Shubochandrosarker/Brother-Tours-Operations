# V4-LIVE-BASELINE.md

Phase 0 audit baseline for Brother Tours Operations Dashboard V4.1.

**Prepared:** 2026-08-19 · **Revised:** 2026-08-19 with a live production runtime read (see §0.1)
**Scope:** Bridgistic endpoint inventory, Insightistic **plugin** integration surface, website content inventory, security observations.

---

## 0. Provenance and verification status

**Read this section before relying on any figure in this document.**

Outbound network egress to `brothertours.com`, `app.brothertours.com` and `insightistic.com` is **blocked by the environment's egress policy** from the environment this document was prepared in. Every host returned a policy denial at the CONNECT layer:

```
www.brothertours.com:443  → gateway answered 403 to CONNECT (policy denial)
app.brothertours.com:443  → blocked
insightistic.com:443      → blocked
```

Both a direct HTTP client and the harness fetch tool were denied by the same policy. The site is also not present in the connected WordPress.com account, so no authenticated management path exists either.

**Consequence: nothing measured *from this environment* is a fresh reading of the live site.** That constraint still holds for anything marked **[REPO]** or **[DERIVED]**.

**It no longer holds for the document as a whole.** Master Prompt v2.0 supplied a live connector read of the production runtime on 19 Aug 2026, and everything marked **[LIVE-0819]** comes from it. Those claims *are* fresh measurements — taken through the Bridgistic connector from a host with access, not from here. This follows the provenance convention already established in [`wordpress-patches.md`](./wordpress-patches.md).

Every claim below carries one of these markers:

| Marker | Meaning |
|---|---|
| **[REPO]** | Verified against source code in this repository. Reproducible now. |
| **[AUDIT-0820]** | Carried forward from the 2026-08-20 live environment scan supplied in the V4.1 build prompt. Not re-verified. |
| **[BRIEF-0818]** | Carried forward from the incident brief's live backend read of 18 Aug 2026, via `wordpress-patches.md`. Not re-verified. |
| **[DERIVED]** | Computed in this document from **[REPO]** and **[AUDIT-0820]** inputs. Arithmetic is reproducible; the inputs are only as good as their own markers. |
| **[UNVERIFIED]** | Asserted in the source material and **not** corroborated by any evidence available here. |
| **[CONTRADICTED]** | Asserted in the source material and **actively contradicted** by evidence gathered here. |
| **[LIVE-0819]** | **Read live from the production WordPress runtime on 19 Aug 2026** through the Bridgistic connector (`bridgistic_execute_php`, `bridgistic_fs_read`, `rest_get_server()->get_routes()`), via Master Prompt v2.0. **Strongest evidence in this document — it outranks every other marker.** |

Anything marked **[AUDIT-0820]**, **[BRIEF-0818]**, **[UNVERIFIED]** or **[CONTRADICTED]** must be re-verified against the live site before it drives an irreversible decision. §7 lists the exact commands to do that.

### 0.1 Correction log — 19 Aug 2026

Master Prompt v2.0 supplied a live connector read of the production runtime. Where it contradicts this document, **v2.0 wins**. The following claims were wrong and are corrected in place:

| # | Was | Now | Where |
|---|---|---|---|
| 1 | Insightistic treated as an unconfirmed **SaaS product at `insightistic.com`** | **Insightistic 4.4.0 is a WordPress plugin installed and active on the site.** The web search was answering the wrong question entirely — the subject was never a hosted app. GA4 and GSC are connected and returning real data. | §4 (rewritten) |
| 2 | Nine `/woo/*` routes documented as live commerce surface | **WooCommerce is not installed.** The routes register but are dead. | §2.5 |
| 3 | `GET /insightistic` listed as a live S1 route | **Returns 404** — the controller exists in source but is never registered (defect B-1). | §2.11 |
| 4 | Route count "unresolved: 80 vs 47 vs 50+" | **Resolved: 80 route patterns**, confirmed by live `rest_get_server()->get_routes()`. The derived figure was correct. | §2.12 |
| 5 | Site described as "WordPress + WooCommerce" | WordPress 7.0.4 / PHP 8.3.31, theme `Brother Tours` 2.5.0, no WooCommerce. | §1, §3 |

The original wording is not preserved for its own sake — but the provenance markers are, so a reader can still see which claims rested on what.

---

## 1. Environment scan

| Asset | Value | Status |
|---|---|---|
| Production site | `https://www.brothertours.com/` | WordPress **7.0.4**, PHP **8.3.31**, theme `Brother Tours` 2.5.0 (template `wpistic`), Elementor 4.2.2, timezone `Asia/Vientiane` **[LIVE-0819]** |
| Host path | `/home/u564261379/domains/brothertours.com/public_html` | **[LIVE-0819]** |
| WooCommerce | — | **NOT INSTALLED.** Every `/woo/*` route and `woo:*` scope is dead. **[LIVE-0819]** |
| REST root | `https://www.brothertours.com/wp-json/` | Exposes full route index anonymously **[LIVE-0819]** |
| Bridgistic API | `https://www.brothertours.com/wp-json/bridgistic/v1/` | Active namespace, **80 route patterns** **[LIVE-0819]** |
| App dashboard | `https://app.brothertours.com/` | Internal-only. `/healthz` payload and deployed commit still **[UNVERIFIED]** — blocked by robots.txt at the fetch layer |
| **Insightistic** | **WordPress plugin, v4.4.0, active** | **Installed on the site. GA4 + GSC connected and returning real data. Exposes no REST API — see §4.** **[LIVE-0819]** |

Active plugins that matter **[LIVE-0819]**:

| Plugin | Version | Role |
|---|---|---|
| Bridgistic | 1.2.2 | HMAC-authenticated machine connector. **Not for browsers.** |
| Brother Tours Operations API | 1.0.1 | Session-authenticated dashboard API. **This is the app's backend.** |
| WPistic Tour Manager | 2.5.0 | Tours, destinations, experiences, departures, bookings |
| Formistic | 2.5.0 | Form submissions, replies, notes, subscribers |
| Brother Tours Content Studio | 1.0.2 | Gutenberg blocks, structured tour fields, SEO meta, a sitemap |
| **Insightistic** | **4.4.0** | **GA4 + GSC + PageSpeed + AI. Admin-AJAX only, no REST API.** |

---

## 2. Bridgistic `/v1` endpoint inventory

### 2.1 How this inventory was built

Two independent sources were reconciled:

1. **[AUDIT-0820]** — the live route inventory captured in the V4.1 build prompt.
2. **[REPO]** — every route the shipped React client actually calls, extracted mechanically from `apps/web/src/api/*.js`:

   ```bash
   grep -rhoE "api\.(get|post|patch|put|delete)\(\s*[\`'\"][^\`'\"]+" apps/web/src --include=*.js --include=*.jsx
   ```

**Reconciliation result [DERIVED]:**

| Measure | Count |
|---|---|
| Distinct route patterns in the namespace | **80** |
| Distinct method + path pairs | **107** |
| Method + path pairs the Operations app calls | **52** |
| Method + path pairs the app **never** calls | **55** |
| Routes the app calls that are **missing** from the audit inventory | **0** |

The zero in the last row matters: every route the shipped client consumes appears in the 2026-08-20 audit list. The business half of that audit is corroborated by this repository.

**The connector half is now independently confirmed too.** A live `rest_get_server()->get_routes()` read on 19 Aug 2026 returned **80 route patterns in the namespace** — matching the derived figure exactly. `/execute`, `/db/query`, `/fs/*`, `/snapshot/*`, `/plugins`, `/users`, `/options`, `/posts`, `/media` are all real and registered. The one correction is `/woo/*`: those routes register, but WooCommerce is not installed, so they are dead (§2.5). **[LIVE-0819]**

### 2.2 Security classification scheme

| Tier | Name | Meaning |
|---|---|---|
| **S0** | Public | Served without a session. |
| **S1** | Authenticated read | Session required. Operational data, no PII. |
| **S2** | Authenticated read · sensitive | Session required. Customer PII, financial or contact data. |
| **S3** | Authenticated write · business | Mutates business records. CSRF + capability required. |
| **S4** | Privileged write · infrastructure | Mutates site configuration, users, plugins or snapshots. Admin-only. |
| **S5** | **Code / data execution** | Arbitrary code, SQL or filesystem write. Full site compromise if reachable by a non-admin. |

`App?` = consumed by the shipped React client **[REPO]**. `—` means the route exists server-side but no client in this repository calls it.

### 2.3 System / connector routes — **S5 and S4**

Owned by the **Bridgistic connector plugin**, not the Operations API. **[BRIEF-0818]**

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| POST | `/execute` | **S5** | — | Code execution. Admin-only. **[AUDIT-0820]** |
| POST | `/db/query` | **S5** | — | SQL runner, read-only by default. **[AUDIT-0820]** |
| POST | `/fs/write` | **S5** | — | File editor. Admin-only. **[AUDIT-0820]** |
| POST | `/fs/delete` | **S5** | — | File delete. Admin-only. **[AUDIT-0820]** |
| POST | `/fs/read` | **S4** | — | File viewer. Discloses source and secrets in config files. |
| POST | `/fs/list` | **S4** | — | File browser. Directory disclosure. |
| POST | `/snapshot/restore` | **S4** | — | Restores site state. Destructive. |
| POST | `/snapshot/delete` | **S4** | — | Destroys recovery points. |
| GET / POST | `/snapshot` | **S4** | — | Snapshot read / create. |
| GET | `/system/health` | **S1** | ✅ | Only connector-adjacent route the app consumes. |

**Every S5 route is in the unused-by-app set.** Restricting the connector namespace to admin sessions costs the Operations dashboard exactly nothing — see §5.2.

### 2.4 Core WordPress routes — **S4 / S2**

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| GET | `/site-info` | S1 | — | Environment disclosure. |
| GET / POST | `/posts` | S3 | — | Content read / create. |
| GET / POST / DELETE | `/posts/{id}` | S3 | — | Content mutation and deletion. |
| GET / POST | `/media` | S3 | — | Media read / upload. |
| DELETE | `/media/{id}` | S3 | — | Media deletion. |
| GET / POST | `/users` | **S4** | — | **User enumeration and creation.** |
| GET / POST | `/users/{id}` | **S4** | — | **User read and modification.** |
| GET / POST | `/options` | **S4** | — | **`wp_options` read/write — site takeover primitive.** |
| GET | `/plugins` | **S4** | — | Plugin inventory disclosure. |
| POST | `/plugins/toggle` | **S4** | — | **Activate / deactivate plugins.** |

`/users`, `/options` and `/plugins/toggle` are each independently sufficient for privilege escalation. None is used by the Operations app.

### 2.5 WooCommerce routes — **DEAD, not installed**

> **[LIVE-0819] WooCommerce is not installed on this site.** These routes are registered by the connector but have no plugin behind them. The tiers below describe what they *would* expose if WooCommerce were ever activated — treat this as a latent-risk table, not live surface. Ignore every `woo:*` scope and `/woo/*` route in current work.

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| GET / POST | `/woo/products` | S3 | — | Product catalogue. |
| GET / POST | `/woo/products/{id}` | S3 | — | Product mutation. |
| GET | `/woo/orders` | **S2** | — | **Order list — customer PII + financial.** |
| GET | `/woo/orders/{id}` | **S2** | — | **Single order — full PII.** |
| POST | `/woo/orders/{id}/status` | **S3** | — | Order status transition. Financially material. |
| GET | `/woo/customers` | **S2** | — | **Customer list — PII.** |
| GET | `/woo/customers/{id}` | **S2** | — | **Single customer — PII.** |
| GET | `/woo/inventory` | S1 | — | Stock levels. |
| GET | `/woo/sales-summary` | S1 | — | Aggregate revenue. |

The entire WooCommerce surface is dead: no plugin, no data, and the Operations app never calls it. The V4.1 plan's `/commerce/*` route group in `bt-ops/v2` therefore has **nothing to migrate** — drop it from the migration scope until WooCommerce is actually adopted. The `woocommerce_pro` Insightistic addon is off for the same reason (§4.1).

### 2.6 Authentication routes

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| POST | `/oauth/token` | **S4** | — | Token issuance. Not used by the app; the app is cookie-session based. |
| POST | `/auth/session/login` | S0→S1 | ✅ | Issues `bt_ops_session` HttpOnly cookie. **[REPO]** |
| GET | `/auth/session` | S1 | ✅ | Authoritative session check. 401 here **is** signed-out. **[REPO]** |
| POST | `/auth/session/logout` | S1 | ✅ | **[REPO]** |
| POST | `/auth/session/revoke-all` | S1 | ✅ | Revokes every session for the user. **[REPO]** |

Cookie is issued `SameSite=None; Secure; HttpOnly; Path=/`. **[BRIEF-0818]**
`/oauth/token` being live alongside cookie sessions means **two parallel authentication paths exist**. Only one is exercised and only one has been reviewed. See §5.4.

### 2.7 Tour operations routes — **S1 / S3**

All consumed by the app. **[REPO]**

| Method | Route | Tier | App? |
|---|---|:--:|:--:|
| GET / POST | `/tours` | S1 / S3 | ✅ |
| GET / PATCH / DELETE | `/tours/{id}` | S1 / S3 | ✅ |
| GET / POST | `/destinations` | S1 / S3 | ✅ |
| GET / PATCH / DELETE | `/destinations/{id}` | S1 / S3 | ✅ |
| GET / POST | `/experiences` | S1 / S3 | ✅ |
| GET / PATCH / DELETE | `/experiences/{id}` | S1 / S3 | ✅ |
| GET / POST | `/departures` | S1 / S3 | ✅ |
| GET / PATCH / DELETE | `/departures/{id}` | S1 / S3 | ✅ |

`DELETE` on `/tours/{id}`, `/destinations/{id}` and `/experiences/{id}` accepts `?force=true` for permanent deletion rather than trash. **[REPO]** — `apps/web/src/api/tours.js`, `catalog.js`.

### 2.8 Booking workflow engine — **S2 / S3**

Bookings carry traveller PII. Every route here is **S2 or above**.

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| GET | `/bookings` | **S2** | ✅ | List. Filters: `status`, `portal_status`, `assigned_to`, `tour_id`, `from`, `to`. **[REPO]** |
| GET | `/bookings/{id}` | **S2** | ✅ | Full booking incl. traveller PII. |
| GET | `/bookings/{id}/actions` | S1 | ✅ | Backend-permitted action list. |
| POST | `/bookings/{id}/workflow` | **S3** | ✅ | **Pipeline state transition.** Body `{status}`. **[REPO]** |
| POST | `/bookings/{id}/assign` | **S3** | ✅ | Body `{userId}`. |
| POST | `/bookings/{id}/note` | **S3** | ✅ | Body `{note}`. |
| POST | `/bookings/{id}/lifecycle` | **S3** | ✅ | Body `{action}`. |
| POST | `/bookings/{id}/payment-link` | **S3** | ✅ | **Financially material.** Body `{gateway, type}`. Needs `bt_manage_payments`. |
| POST | `/bookings/{id}/dispatch` | **S3** | ✅ | Fires outbound webhook. Body `{event}`. |

`/bookings/{id}/workflow` is the Kanban transition endpoint. The backend — not the client — owns which transitions are legal; the app reads `/actions` to learn what it may offer.

### 2.9 Inbox / communications — **S2 / S3**

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| GET | `/inbox/submissions` | **S2** | ✅ | Formistic submissions — name, email, message. **[REPO]** |
| GET | `/inbox/submissions/{id}` | **S2** | ✅ | Full submission + attachment metadata. |
| POST | `/inbox/submissions/{id}/status` | S3 | ✅ | Body `{status}`. |
| POST | `/inbox/submissions/{id}/notes` | S3 | ✅ | Body `{note, tags}`. |
| POST | `/inbox/submissions/{id}/reply` | **S3** | ✅ | **Sends outbound email to a customer.** |
| GET | `/inbox/stats` | S1 | ✅ | Aggregate counts. |
| GET | `/newsletter/subscribers` | **S2** | ✅ | **Subscriber email list.** |

`/inbox/submissions/{id}/reply` sends real mail to a real customer. It is the highest-consequence **S3** route in the business half of the namespace and must never be exercised during testing against production.

### 2.10 Connections, reports, team, dashboard

| Method | Route | Tier | App? | Notes |
|---|---|:--:|:--:|---|
| GET / POST | `/connections` | S1 / **S4** | ✅ | **Integration credentials.** POST stores secrets. |
| PATCH / DELETE | `/connections/{id}` | **S4** | ✅ | Mutates/removes an integration. |
| GET | `/connections/logs` | **S2** | ✅ | Delivery logs — may contain payload PII. |
| GET | `/reports/overview` | S1 | ✅ | |
| GET | `/reports/bookings` | **S2** | ✅ | Booking-derived; PII risk. |
| GET | `/reports/forms` | S1 | ✅ | |
| GET | `/team` | **S2** | ✅ | Staff directory. |
| GET | `/team/{id}` | **S2** | ✅ | Staff member. |
| GET | `/dashboard` | **S2** | ✅ | **Single aggregate.** Mixes booking, inbox and system data — inherits the highest tier of its inputs. **[REPO]** |

`GET /dashboard` is the only aggregate the Command Center uses. The invented `/dashboard/snapshot`, `/attention`, `/alerts`, `/activity` and `/upcoming` endpoints were removed and are now blocked by `scripts/preflight.mjs`. **[REPO]** — `AUDIT.md` §3.

### 2.11 Automation routes — **S4**

Connector-owned. None consumed by the app. **[AUDIT-0820]**

| Method | Route | Tier | Notes |
|---|---|:--:|---|
| GET / POST | `/playbooks` | **S4** | Automation definitions. |
| POST | `/playbooks/run` | **S4** | **Executes an automation.** |
| POST | `/playbooks/delete` | **S4** | |
| GET | `/playbooks/{slug}` | S1 | |
| GET / POST | `/schedules` | **S4** | Cron-like scheduling. |
| POST | `/schedules/toggle` | **S4** | |
| POST | `/schedules/delete` | **S4** | |
| POST | `/schedules/run-now` | **S4** | **Immediate execution.** |
| GET / POST | `/memory` | S3 | Agent memory store. |
| POST | `/memory/delete` | S3 | |
| GET | `/usage` | S1 | |
| GET | `/approvals/status` | S1 | |
| GET | `/insightistic` | — | **404 — NOT REGISTERED.** `src/Insightistic/InsightisticController.php` exists but is absent from the `plugins_loaded` boot list. Dead code documented as live in the plugin README (defect **B-1**). Registering it is task 1 of §4.6. **[LIVE-0819]** |

`/playbooks/run` and `/schedules/run-now` trigger server-side execution. They belong in the same restriction envelope as `/execute`.

### 2.12 Route count — **RESOLVED at 80** **[LIVE-0819]**

Three totals were in conflict. A live `rest_get_server()->get_routes()` read on 19 Aug 2026 settled it.

| Source | Figure | Verdict |
|---|---|---|
| V4.1 build prompt **[AUDIT-0820]** | "50+ endpoints active" | Vague but not wrong — an undercount phrased as a floor. |
| Incident brief **[BRIEF-0818]** | "All 47 `bridgistic/v1` operations routes are registered" | Counts the **operations plane only**, not the whole namespace. Not comparable to 80. |
| This document **[DERIVED]** | 80 distinct routes / 107 method+path pairs | ✅ **Confirmed exactly.** |
| Live connector read **[LIVE-0819]** | **80 route patterns in the namespace** | **Authoritative.** |

The derived reconciliation was correct. The apparent conflict was a category error: the brief's 47 counts one plane, the 80 counts the namespace. Both can be true at once, and comparing them was never meaningful.

The earlier caution about "38/52 consumed vs registered" also resolves: v2.0's plane split (§2.3 of that document) assigns 33 route patterns to the operations plane and the rest to the connector, against the 38 this client actually calls. The remaining difference is `/system/health` and the four `/auth/session*` variants being counted differently across sources — a labelling difference, not a missing route.

**Consequence for the `bt-ops/v2` migration:** the denominator is now known. 80 patterns total; the operations plane is what moves; the connector plane stays. That unblocks the migration's completeness check.

---

## 3. Website structure and content inventory

**Superseded by [LIVE-0819].** The earlier version of this section carried the 2026-08-20 audit forward unverified. A live runtime read replaces most of it — including one figure that turned out to be wrong.

### 3.1 Live content inventory **[LIVE-0819]**

| Object | Published | Draft | Pending | Trash | Manageable from the app today? |
|---|--:|--:|--:|--:|---|
| `post` (articles) | 6 | — | — | 4 | **No** |
| `page` | 40 | 8 | 3 | 1 | **No** |
| `attachment` (media) | 78 | — | — | — | **No** |
| `wpistic_tour` | 37 | 11 | 1 | — | Yes |
| `wpistic_destination` | **10** | — | — | — | Yes |
| `wpistic_experience` | **0** | — | — | — | Yes |

**Correction: destinations are 10, not 6.** The "6 destinations across 3 Laos regions" figure came from the 2026-08-20 audit and does not match the runtime. Do not use 6 anywhere. Whether the 10 destination records map onto 3 marketing regions is a separate content question the runtime cannot answer — confirm with the business before any region-based UI or copy.

`wpistic_experience` has **zero records**. The app ships a full Experiences CRUD screen for an empty post type — an empty state, not an edge case.

### 3.2 Taxonomies — a content defect **[LIVE-0819]**

| Taxonomy | Terms |
|---|--:|
| `category` | 7 |
| `post_tag` | **0** |
| `tour_category` | **0** |
| `tour_destination` | **0** |
| `tour_duration_range` | **0** |
| `tour_difficulty` | **0** |
| `tour_season` | **0** |

Five registered tour taxonomies with nothing in them. **This is a content defect, not an API defect — surface it, do not silently populate it.** Any tag or tour-taxonomy UI must treat "create the first term" as the primary path, not the exception.

### 3.3 Users and article meta **[LIVE-0819]**

**2 users, both administrators.** All 6 articles bylined `Wordpressistic`.

Meta keys already in production use on every article:

```
bt_seo_title  ·  bt_seo_description  ·  _wpistic_tone  ·  _thumbnail_id
_seoistic_title  ·  _seoistic_description  ·  _seoistic_score
_seoistic_audit_report  ·  _seoistic_last_audit
```

The `_seoistic_*` keys are **audit output owned by SEOISTIC — read-only**. A dashboard may display the score and last-audit date; it must never write them. `bt_seo_title` and `bt_seo_description` are the writable pair.

### 3.4 Business data volumes **[LIVE-0819]**

| Table | Rows |
|---|--:|
| `wp_wpistic_bookings` | 3 |
| `wp_wpistic_formistic_submissions` | 7 |
| `wp_wpistic_formistic_subscribers` | 1 |
| `wp_wpistic_connections` | 1 |
| `wp_wpistic_formistic_impressions` | 122 |
| `wp_wpistic_invoices` | **0** |
| `wp_wpistic_transactions` | **0** |

**Every list view needs a real empty state.** With 1 subscriber and 0 invoices, empty is the normal case here, not the edge case. A dashboard that looks broken when a table is empty will look broken most of the time.

### 3.5 Still unverified

These came from the 2026-08-20 audit and the runtime read does not cover them:

- **Regions:** Northern / Central / Southern Laos as a 3-region structure — **[UNVERIFIED]**
- **Reviews:** Google / TripAdvisor integration visible on the front end — **[UNVERIFIED]**
- **Founder:** Ken FJ Her, Licensed Lao National Tour Guide since 2010 — **[UNVERIFIED]**

The founder profile is a business fact about a named real person. V4.1 §24 forbids inventing guide details. Confirm with the business before it appears in shipped UI, marketing copy, or seed data.

---

## 4. Insightistic — the WordPress plugin

**Status: [LIVE-0819]. Installed, active, and configured. This section replaces an earlier version that got the subject wrong.**

### 4.0 Correcting the record

An earlier draft of this section investigated **`insightistic.com` as a hosted SaaS product** and reported it unconfirmed on the strength of three web searches that found no such product.

**That was the wrong question.** Insightistic is a **WordPress plugin installed on `brothertours.com`** — read from the live runtime, not from a marketing site. Whether a public product page exists at `insightistic.com` is irrelevant to this project and has no bearing on Phase 2. A plugin's absence from a search index was never evidence about a plugin.

The practical consequence: **Phase 2 is not blocked.** The earlier draft escalated a non-blocker to management. The real constraint is narrower and is §4.2.

### 4.1 Verified configuration — 19 Aug 2026 **[LIVE-0819]**

Plugin **Insightistic 4.4.0**, active.

| Integration | Status | Detail |
|---|---|---|
| **GA4** | ✅ **Connected** | Property ID `461590374`. Service-account email + private key present. OAuth token cached (`_transient_insightistic_access_token_ga4`). |
| **Google Search Console** | ✅ **Connected — returns real data** | Property `https://www.brothertours.com`. Live call executed successfully. |
| **PageSpeed Insights** | ⚠️ **Key present, no default target** | API key encrypted at `insightistic_pagespeed_api_key_enc`. `insightistic_pagespeed_default_url` is **empty**. |
| GA4 Measurement Protocol | ❌ Not configured | `insightistic_measurement_id` and `..._secret` both empty. No server-side event sending. |
| Cloudflare | ❌ Not configured | account id / zone id / token all empty. |
| AI | ✅ Enabled | Provider `groq`, model `llama-3.1-8b-instant`, skill profile `basic`. |
| Addons | — | `email_automations` ✅ · `seo_opportunities` ✅ · `anomaly_alerts` ✅ · `content_lab` ✅ · `woocommerce_pro` ❌ (no WooCommerce on this site) |
| License | ✅ `active`, plan `free` | Features: `basic_analytics`, `ai_insights`, `email_audit_automation`. 1 of 3 activations used. |
| 404 monitor | ✅ Enabled | Log is **41 KB** in a single option. |
| Last full sync | `2026-08-19 19:06:03` | "Full sync complete", "Broken links: ok". |
| Email digest | Weekly, Mon 09:00 | To `shuvosarker42069@gmail.com`, `enquiry@brothertours.com`. |
| Cron | 3 hooks | `insightistic_run_sync` (daily) · `insightistic_license_validate` (daily) · `insightistic_send_email_automation` (weekly Mon 09:00). |

**Revenue analytics and white-label reporting** — claimed in the original V4.1 brief — are **not** in evidence. The license is the free plan (`basic_analytics`, `ai_insights`, `email_audit_automation`), `woocommerce_pro` is off, and there is no WooCommerce to derive revenue from. Do not design a revenue view on this data source. **[LIVE-0819]**

### 4.2 The real constraint: no REST API

Live namespace list: `oembed/1.0`, `wp/v2`, `wp-block-editor/v1`, `trustindex/v1`, `elementor-one/v1`, `bridgistic/v1`, `wpistic/v1`, `elementor/v1*`, `elementor-ai/v1`, `formistic/v1`, `wp-site-health/v1`, `wp-abilities/v1`.

**There is no `insightistic` namespace.** The plugin is **admin-AJAX only**. The dashboard cannot read GA4/GSC/PSI without a server-side adapter inside the operations plane. **[LIVE-0819]**

This is a build task, not a blocker — the data exists and is reachable from PHP.

### 4.3 The PHP surface an adapter calls — verified by reflection **[LIVE-0819]**

```php
Insightistic_GA::get_dashboard_data( int $days = 28, bool $force_refresh = false )
Insightistic_GA::get_sync_payload( int $days = 28 )
Insightistic_GSC::get_sync_payload( int $days = 28 )
Insightistic_PageSpeed::get_sync_payload( ?string $url = null )
Insightistic_System_Status::collect()        // static
Insightistic_Sync::last_sync()               // static
Insightistic_Sync::logs()                    // static
Insightistic_Sync::settings()                // static
Insightistic_Auth::get_token( string $scope, string $cache_key = 'ga4' )  // static
```

`Insightistic_GA`, `Insightistic_GSC` and `Insightistic_PageSpeed` are **instance** classes — `new Insightistic_GSC()` then call. Guard every call with `class_exists()` and `try/catch (\Throwable)`: the plugin can be deactivated, and the dashboard must degrade rather than 500.

Verified response shapes:

```
Insightistic_GSC::get_sync_payload(28) →
  { daily:   [ { date, clicks, impressions, ctr, avg_position }, … 29 rows ],
    queries: [ { query, clicks, impressions, ctr, position },     … 250 rows ],
    pages:   [ { page_path, clicks, impressions, ctr, position }, … 250 rows ] }

Insightistic_GA::get_sync_payload(28) →
  { daily:    [],                          // ⚠️ EMPTY on this site
    channels: [ { dimension_value, sessions, users, views, conversions,
                  revenue, engagement_rate }, … 7 rows ] }

Insightistic_GA::get_dashboard_data(28) →
  { html, chartData:{labels,sessions,revenue,users}, overview, countries[10],
    pages[10], channels[14], top_posts[], structured_data:{channels,totals},
    partial, cached_at }

Insightistic_System_Status::collect() →
  [ { label, status: pass|warn|fail, detail, optional, fix_url, fix_label }, … 13 checks ]
```

### 4.4 Three findings that constrain the build

1. **`GA::get_sync_payload().daily` returns `[]`** while `channels` returns 7 rows. Either the GA4 daily-dimension query fails silently or the property has no daily data in range. **Do not build a GA4 daily-traffic chart on it** — a chart rendering an empty array as a flat line is worse than no chart. Render an explicit "GA4 daily data unavailable" state and investigate the cause. Open decision **D-4**.

2. **`get_dashboard_data()` returns a pre-rendered `html` string** built by another plugin. **Never inject it into the React tree.** Use `structured_data`, `chartData`, `countries`, `pages`, `channels` only. Strip `html` in the controller so it cannot reach the client by accident. No `dangerouslySetInnerHTML` anywhere.

3. **`PageSpeed::get_sync_payload()` makes a live Google PSI call** — routinely 10–30 s. It must never run inside a synchronous dashboard request; it will hit the PHP timeout. Serve a cached transient and schedule runs via a single-event cron.

### 4.5 Secrets that must never leave the server

`/analytics/status` reports **booleans** — `"configured": true` — never values. These option keys must never appear in any REST response; assert it in a unit test:

```
insightistic_api_private_key
insightistic_pagespeed_api_key_enc
insightistic_groq_key
insightistic_connector_secret
insightistic_crypto_secret
```

Also: `insightistic_pagespeed_default_url` is empty, so an adapter must default to `home_url('/')` and **validate the target is same-origin** — otherwise `/analytics/pagespeed` becomes an open PSI relay pointable at arbitrary hosts.

### 4.6 Phase 2 status — built, not yet deployed

Phase 2 needed three engineering tasks, not business input. Two are done:

| # | Task | Status |
|---|---|---|
| 1 | Register the existing `InsightisticController` (§2.11, defect B-1) | ✅ **Done** — restored to the `plugins_loaded` boot list, with its capability moved from `edit_posts` to `bt_view_health` |
| 2 | Build `Insightistic\AnalyticsController` over the §4.3 surface | ✅ **Done** — transient caching (GSC/GA4 1 h, PSI 6 h), §4.5 secret suppression, `class_exists()` + `try/catch` throughout |
| 3 | Resolve the empty `daily[]` before any GA4 time-series UI | ❌ **Open** (C-08) — responses carry `dailyAvailable: false` and the UI renders an explicit unavailable state instead of a chart |

Both live in [`brother-tours-laos`](https://github.com/Shubochandrosarker/brother-tours-laos)
under `plugins/brother-tours-operations-api`, alongside the `/content/*`,
`/media` and `/site/*` controllers. **Merged, but not deployed** — the plugin
still has to be copied onto the host behind a Bridgistic snapshot.

The §4.3 surface was subsequently confirmed against the real Insightistic 4.4.0
source: all six classes exist, `GA`/`GSC`/`PageSpeed` are instance classes,
`Sync`/`System_Status` are static, and all seven option keys are present.

**Build order held: Search Console first.** It is the strongest verified source
— 29 daily rows × 250 queries × 250 pages. GA4 is partial. PageSpeed has no
default target.

---

## 5. Security observations

### 5.1 Anonymous REST index exposes the full route map — **confirmed live [LIVE-0819]**

`GET /wp-json/` returns the standard WordPress REST index, which enumerates `bridgistic/v1` **to unauthenticated callers** **[AUDIT-0820]**. The incident brief records the same collision from the other side: the namespace *"now enumerates 47 operations routes alongside Bridgistic's `execute`, `db/query`, `fs/write`, `fs/delete` and `users` routes in a single public index"* **[BRIEF-0818]**.

An anonymous visitor therefore learns that a code-execution endpoint, a SQL runner and a filesystem writer exist at known paths, along with their argument schemas.

A third, live confirmation: `GET /wp-json/bridgistic/v1` enumerates **80 routes including `execute`, `db/query` and `fs/write` in one anonymous index** (v2.0 defect **B-4**). **[LIVE-0819]**

Filtering is tracked as **T-081** and is listed in `wordpress-patches.md` §6.4 without a diff. **It remains unshipped.**

Obscurity is not authorization — this is a reconnaissance-cost finding, not an authorization bypass. It is worth fixing, and it is *not* a substitute for §5.2.

### 5.2 `/execute` and `/db/query` are live — and provably unnecessary for this app

Both are live and must remain capability-gated **[AUDIT-0820]**. This audit sharpens that from a caution into an actionable finding:

> **All 55 unused method+path pairs — including every S5 route — are consumed by nothing in this repository.** **[DERIVED]**

The Operations dashboard calls 52 of 107 pairs. `/execute`, `/db/query`, `/fs/write`, `/fs/delete`, `/fs/read`, `/fs/list`, `/snapshot/*`, `/plugins/toggle`, `/users`, `/options`, `/oauth/token`, `/playbooks/*` and `/schedules/*` are in the other 55.

**Restricting the entire connector surface to administrator sessions — or disabling it outright when the connector is not actively in use — cannot break the Operations dashboard.** There is no compatibility argument against it. This is the single highest-value security change available, and unlike the `bt-ops/v2` migration it requires no client change, no rebuild and no coordination with the frontend.

Caveat: it may break *other* Bridgistic connector clients outside this repository. Confirm what else consumes the namespace before restricting it.

### 5.3 Namespace collision — architectural, not just cosmetic

Two plugins own one namespace: the Bridgistic connector and `brother-tours-operations-api` v1.0.1 **[BRIEF-0818]**. Either plugin's future route registration can silently shadow the other's, and neither team can see the collision from its own codebase.

This is the driver for the `bt-ops/v2` migration (V4.1 §3, `wordpress-patches.md` §6.3, Tier 4 — flagged **STOP, product decision**).

**Sequencing hazard, verified [REPO]:** the repository's own build guards currently hard-code `bridgistic/v1` as the *correct* value:

- `scripts/preflight.mjs` — `VITE_BT_API_BASE` must match `^https://[^\s]+/wp-json/bridgistic/v1/?$`
- `scripts/verify-build.mjs:46` — same assertion against the built bundle
- `scripts/verify-build.mjs:39` — rejects `bt-ops/v1` as a dead-namespace signal

Shipping the namespace change without updating these first **would make the verifier reject every correct build**. The migration order in `wordpress-patches.md` §6.3 exists for this reason and must be followed.

### 5.4 Two parallel authentication paths

**Now explained. [LIVE-0819]** `/oauth/token` belongs to the **connector plane**, not the operations plane. The two planes have genuinely incompatible auth models sharing one namespace:

| | Connector plane (Bridgistic 1.2.2) | Operations plane (BT Ops API 1.0.1) |
|---|---|---|
| Auth | HMAC-SHA256 request signing, server-held secret | HttpOnly `bt_ops_session` cookie + `X-BT-CSRF` |
| Authorises as | A **key** with a fixed scope set — **no WordPress user** | A **WordPress user**, capability-checked per request |
| Envelope | `{ ok: true, data }` | `{ success: true, data, meta }` |
| Browser-safe | **Never** | Yes |

The connector key on this site holds **all 25 scopes, including `php:execute`** — plus `db:write`, `fs:write`, `plugins:manage`, `options:write`. **[LIVE-0819]**

This sharpens §5.2 into a hard architectural rule rather than a cleanup suggestion:

> **The SPA may only ever call operations-plane routes.** Signing an HMAC request needs the shared secret. Putting it in the browser hands every visitor `php:execute` on production. Putting it in `server.mjs` is barely better — it turns a static file server into a credential holder authorising as a *key with no user identity*, so `crm_sales` would wield the same power as `administrator` and the WordPress capability model is bypassed entirely.

There is no proxy option. Content and analytics endpoints must be built as new **operations-plane** controllers.

### 5.5 Auth responses are cacheable — **re-confirmed live**, still unshipped

The site runs an `advanced-cache.php` drop-in with no external object cache. If `GET /auth/session` is ever page-cached, one operator's session state is served to every operator **[BRIEF-0818]**.

Re-confirmed by the live source read as v2.0 defect **B-6**. **[LIVE-0819]**

The fix is written and reviewed in `wordpress-patches.md` §6.2 (Tier 3, "Do this") — `rest_pre_serve_request` forcing `no-store` on the namespace, plus a `DONOTCACHEPAGE` guard in `wp-config.php`. **Not applied.** Headers only; no schema, data or behaviour change.

### 5.6 Session cookie clear-domain mismatch — **re-confirmed live**, still unshipped

`issue_session()` sets `'domain' => ''`, making `bt_ops_session` host-only. More seriously, `clear_cookie()` must use the *same* domain — a cookie cleared under a different domain is never cleared, leaving **phantom sessions alive after logout**. Re-confirmed as v2.0 defect **B-5**. **[LIVE-0819]** Diff written in `wordpress-patches.md` §6.1 (Tier 3). **Not applied.**

### 5.7 Frontend security posture — verified good **[REPO]**

Not everything is outstanding. The client side holds up:

- No `localStorage` / `sessionStorage` anywhere in production source — enforced by `preflight.mjs`, build fails otherwise.
- `credentials: 'include'` on every request; `X-BT-CSRF` on every unsafe method — enforced by `preflight.mjs`.
- CSRF token held in memory only, never persisted.
- A transport failure is explicitly **not** treated as signed-out, so a network blip cannot evict an operator mid-task (`client.js`).
- A 401 from a data route triggers one shared re-verification rather than a stampede, and only an authoritative 401 from `/auth/session` evicts.
- `server.mjs` sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow, noarchive` and a CSP; `/healthz` is `no-store`.

The outstanding items in §5.1–5.6 are **all server-side**.

### 5.8 Priority

| # | Finding | Tier | Blast radius | Status |
|---|---|---|---|---|
| 1 | Restrict unused connector surface (§5.2) | S5 | None for this app | **Not started** |
| 2 | `no-store` on auth responses (§5.5) | S4 | Headers only | Diff ready, unshipped |
| 3 | Cookie clear-domain / phantom sessions (§5.6) | S4 | One forced re-login | Diff ready, unshipped |
| 4 | Filter anonymous REST index (§5.1) | S1 | None | T-081, no diff |
| 5 | Resolve `/oauth/token` (§5.4) | S4 | Unknown | Not investigated |
| 6 | `bt-ops/v2` namespace migration (§5.3) | — | Every API client + build guards | **STOP** — product decision |

Items 1–4 are independent of the namespace migration and can ship without it. Item 6 must not be bundled with anything.

---

## 6. Data conflict register

For `docs/V4-DATA-CONFLICT-REGISTER.md` (V4.1 §19 Phase 0). Five of the six original conflicts are now closed by the live read.

| # | Conflict | Status | Resolution |
|---|---|---|---|
| C-01 | Namespace route count: "50+" vs "47" vs 80/107 derived | ✅ **CLOSED** | **80 route patterns**, live-confirmed. The 47 counted the operations plane only — a category error, not a conflict. §2.12 **[LIVE-0819]** |
| C-02 | Insightistic existence and capabilities | ✅ **CLOSED** | **Plugin v4.4.0, installed and active.** GA4 + GSC connected and returning real data. The question was miscast as being about a SaaS product; it never was. §4 **[LIVE-0819]** |
| C-03 | Per-route capability gates | ⚠️ **PARTIAL** | `bt_manage_operations` is held by **7 roles**; only `administrator` also holds `edit_posts` / `publish_posts` / `upload_files` / `manage_options`. Per-route gates inside the operations plugin still need a source read. See C-07. **[LIVE-0819]** |
| C-04 | "6 destinations" across 3 Laos regions | ⚠️ **HALF-CLOSED** | **Destinations are 10, not 6** — the audit figure was wrong (§3.1). The 3-region structure remains **[UNVERIFIED]** and needs business confirmation. |
| C-05 | Founder profile (Ken FJ Her, licensed since 2010) | ❌ **OPEN** | Still **[UNVERIFIED]**. Business confirmation required before any UI use. |
| C-06 | `/oauth/token` purpose and consumers | ✅ **CLOSED** | Belongs to the **connector plane** — HMAC key auth, no WordPress user. Never callable from a browser. §5.4 **[LIVE-0819]** |
| **C-07** | **The capability trap** *(new)* | ❌ **OPEN** | Six of seven `bt_manage_operations` roles lack `edit_posts`; `editor`/`author` cannot sign in to the dashboard at all. Harmless today — both live users are administrators — but it bites the moment a real editor is hired. §6.1 |
| **C-08** | **GA4 `daily[]` returns empty** *(new)* | ❌ **OPEN** | `channels` returns 7 rows, `daily` returns `[]`. Blocks any GA4 time-series UI. Investigate before building the chart. §4.4 |
| **C-09** | **Three sitemap generators** *(new)* | ❌ **OPEN** | `/sitemap.xml` (theme/SEOISTIC), Content Studio rewrites, and WP core rules coexist — while `/wp-sitemap.xml` returns **404**. Live SEO defect, out of scope for the dashboard. Log against the SEO backlog. **[LIVE-0819]** |

### 6.1 C-07 — the capability trap, in full

`bt_manage_operations` gates dashboard **login**. It does not grant content capabilities. **[LIVE-0819]**

| Role | `bt_manage_operations` | `edit_posts` | `publish_posts` | `upload_files` | `manage_options` |
|---|:--:|:--:|:--:|:--:|:--:|
| `administrator` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `tour_staff` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `wpistic_travel_manager` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `wpistic_travel_agent` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `crm_owner` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `crm_manager` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `crm_sales` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `editor` / `author` | ❌ | ✅ | ✅ | ✅ | ❌ |

Two consequences for any content UI:

1. Content routes must check the **real WordPress capabilities** — `edit_posts`, `publish_posts`, `delete_post`, `upload_files`, and per-object `edit_post( $id )` — **in addition to** the `bt_manage_operations` login gate. A blanket `bt_manage_operations` check would hand content editing to all seven roles.
2. `GET /auth/session` already returns the user's full `capabilities` array. Navigation and button state must be driven from it: a user without `edit_posts` should not see a Content section at all — no dead links, no 403-on-click.

**Do not grant `edit_posts` to `tour_staff` or the `crm_*` roles as a side effect of any task.** That is a standalone business decision.

---

## 7. Re-verification commands

**All of the below is packaged as [`scripts/verify-live-baseline.sh`](../scripts/verify-live-baseline.sh)** — run that instead of pasting commands one at a time:

```bash
./scripts/verify-live-baseline.sh                                  # anonymous checks
BT_COOKIE='bt_ops_session=...' ./scripts/verify-live-baseline.sh   # adds §4 / C-02
```

It is read-only, exits non-zero on any critical finding, and writes the full live route inventory to `/tmp/bt-live-routes.txt` for direct comparison against §2.

One behaviour worth knowing: the script decides reachability **once**, by requiring a parseable `"routes"` key from the namespace index, and skips every downstream check if that fails. This is deliberate — an intercepting proxy answers with its own `403` *and headers*, which would otherwise make "no-store missing" and "S5 rejects anonymous" both report as confident results against a host that was never reached. A blocked run yields zero passes, never a clean bill of health.

The raw commands follow, for running by hand. Everything marked **[AUDIT-0820]**, **[BRIEF-0818]** or **[UNVERIFIED]** should be re-established before Phase 1 starts.

```bash
# Settles C-01 — authoritative route count, methods and args
curl -s https://www.brothertours.com/wp-json/bridgistic/v1/ | jq '.routes | keys | length'
curl -s https://www.brothertours.com/wp-json/bridgistic/v1/ \
  | jq -r '.routes | to_entries[] | "\(.key) :: \([.value.methods[]] | join(","))"' | sort

# §5.1 — is the namespace exposed to anonymous callers?
curl -s https://www.brothertours.com/wp-json/ | jq -r '.namespaces[]'

# §5.5 — are auth responses cacheable? Expect no-store; a hit here is the finding
curl -sI https://www.brothertours.com/wp-json/bridgistic/v1/auth/session \
  | grep -iE 'cache-control|pragma|vary|x-cache'

# §5.2 — confirm the S5 routes reject an anonymous caller (expect 401/403, never 200)
for r in execute db/query fs/list fs/read; do
  printf '%s -> ' "$r"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST \
    "https://www.brothertours.com/wp-json/bridgistic/v1/$r"
done

# §4 — CLOSED by the live read: plugin v4.4.0 is installed and active.
# /insightistic returns 404 (controller never registered, defect B-1) — expect 404, not data.
curl -s -o /dev/null -w '%{http_code}\n' \
  https://www.brothertours.com/wp-json/bridgistic/v1/insightistic          # → 404 until B-1 is fixed

# §3 — site structure
curl -s https://www.brothertours.com/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | head -50

# Deployed build
curl -s https://app.brothertours.com/healthz
```

The S5 probe sends an empty POST deliberately — it is an authorization check, not an exploitation attempt. Any response other than 401/403 is a **critical** finding and should stop Phase 1.

---

## 8. Phase 0 exit status

Updated after the 19 Aug 2026 live connector read.

| Phase 0 item (V4.1 §19) | Status |
|---|---|
| Verify all live endpoints | ✅ **DONE** — 80 route patterns confirmed by live `rest_get_server()->get_routes()`. **[LIVE-0819]** |
| Create `docs/V4-LIVE-BASELINE.md` | ✅ This document. |
| Create `docs/V4-DATA-CONFLICT-REGISTER.md` | ⚠️ §6 holds the full register (9 entries, 4 closed); not yet split into a standalone file. |
| Audit Insightistic source for real interfaces | ✅ **DONE** — plugin v4.4.0 confirmed; 9-method PHP surface captured by reflection with verified response shapes. §4.3 **[LIVE-0819]** |
| Audit Repos A and B file structures | ⚠️ Repo B (this one) audited. Repo A not present in this session. |

**Phase 0 is substantially complete.** Both items that were blocked on access are now resolved by the live read.

### 8.1 What changed since the first draft

The first version of this document was written from an egress-blocked environment and hedged accordingly. Most of its reasoning held up — the 80/107 route reconciliation was exactly right, and the §5.2 finding about unused connector surface survived contact with the live runtime and got stronger.

One conclusion did not hold: **§4 investigated the wrong subject.** It treated Insightistic as a SaaS product to be verified at `insightistic.com` and escalated a non-existent blocker to management on the strength of web searches that could never have answered the question. Insightistic is a WordPress plugin; a plugin's absence from a search index is not evidence about the plugin. The lesson is narrow and worth keeping: when a "product" appears in a WordPress build brief, check the plugin list first, and treat an unreachable marketing domain as no signal at all rather than as weak negative signal.

### 8.2 Remaining open items

| Item | Owner | Blocks |
|---|---|---|
| GA4 `daily[]` empty (C-08) | Engineering | GA4 time-series UI |
| Founder profile unverified (C-05) | Business | Any UI or copy naming the founder |
| 3-region structure unverified (C-04) | Business | Region-based navigation or copy |
| Capability trap (C-07) | Business decision | Non-admin content editing |
| `app.brothertours.com/healthz` payload + deployed commit | Engineering | Confirming what is actually live |
| Namespace migration `bt-ops/v2` (D-1) | Product decision | — deliberately unsequenced |

**Immediately actionable, no decision required:** restrict the unused connector
surface (§5.2), ship `no-store` on auth responses (§5.5), fix the cookie
clear-domain (§5.6), and filter the anonymous REST index (§5.1). None depends on
an open question above.

`InsightisticController` registration is no longer on that list — it is fixed in
the plugin repo and ships with the next deployment of
`brother-tours-operations-api`.
