# V4-LIVE-BASELINE.md

Phase 0 audit baseline for Brother Tours Operations Dashboard V4.1.

**Prepared:** 2026-08-19
**Scope:** Bridgistic endpoint inventory, Insightistic product status, website structure, security observations.

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

**Consequence: nothing in this document is a fresh measurement of the live site.** This follows the provenance convention already established in [`wordpress-patches.md`](./wordpress-patches.md).

Every claim below carries one of these markers:

| Marker | Meaning |
|---|---|
| **[REPO]** | Verified against source code in this repository. Reproducible now. |
| **[AUDIT-0820]** | Carried forward from the 2026-08-20 live environment scan supplied in the V4.1 build prompt. Not re-verified. |
| **[BRIEF-0818]** | Carried forward from the incident brief's live backend read of 18 Aug 2026, via `wordpress-patches.md`. Not re-verified. |
| **[DERIVED]** | Computed in this document from **[REPO]** and **[AUDIT-0820]** inputs. Arithmetic is reproducible; the inputs are only as good as their own markers. |
| **[UNVERIFIED]** | Asserted in the source material and **not** corroborated by any evidence available here. |
| **[CONTRADICTED]** | Asserted in the source material and **actively contradicted** by evidence gathered here. |

Anything marked **[AUDIT-0820]**, **[BRIEF-0818]**, **[UNVERIFIED]** or **[CONTRADICTED]** must be re-verified against the live site before it drives an irreversible decision. §7 lists the exact commands to do that.

---

## 1. Environment scan

| Asset | URL | Status |
|---|---|---|
| Production site | `https://www.brothertours.com/` | WordPress + WooCommerce **[AUDIT-0820]** · not reachable from here |
| REST root | `https://www.brothertours.com/wp-json/` | Exposes full route index anonymously **[AUDIT-0820]** |
| Bridgistic API | `https://www.brothertours.com/wp-json/bridgistic/v1/` | Active namespace **[AUDIT-0820]** |
| App dashboard | `https://app.brothertours.com/` | Internal-only, expected **[AUDIT-0820]** |
| Insightistic | `https://insightistic.com/` | **Product could not be confirmed — see §4** **[CONTRADICTED]** |

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

The zero in the last row matters: every route the shipped client consumes appears in the 2026-08-20 audit list. The business half of that audit is corroborated by this repository. The connector half (`/execute`, `/db/query`, `/fs/*`, `/snapshot/*`, `/plugins`, `/users`, `/options`, `/woo/*`, `/posts`, `/media`) is **not** corroborated by anything in this repo — the app never touches it — and rests on **[AUDIT-0820]** alone.

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

### 2.5 WooCommerce routes — **S2 / S3**

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

The entire WooCommerce surface is unused by the Operations app today. Under V4.1 it becomes `/commerce/*` in `bt-ops/v2` and needs `bt_view_booking_pii` on the four **S2** routes.

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
| GET | `/insightistic` | S1 | Returns `active` / `version` only — **no analytics data**. See §4. |

`/playbooks/run` and `/schedules/run-now` trigger server-side execution. They belong in the same restriction envelope as `/execute`.

### 2.12 Route count discrepancy — **unresolved**

Three different totals exist for this namespace and they do not agree:

| Source | Figure |
|---|---|
| V4.1 build prompt **[AUDIT-0820]** | "50+ endpoints active" |
| Incident brief **[BRIEF-0818]** | "All 47 `bridgistic/v1` operations routes are registered" |
| This document **[DERIVED]** | 80 distinct routes / 107 method+path pairs total; of which **38 distinct routes / 52 method+path pairs** are consumed by the Operations client |

Note the 38/52 figure is "consumed by the shipped client", which is measurable here, **not** "registered by the operations plugin", which is not — plugin ownership per route cannot be established without reading the two plugins' source. The two sets are probably close but they are not the same question, and the brief's 47 may well be counting the second one. The gap is most likely a difference in what each source counted as an "operations route" versus a connector route — but that is an inference, not a finding.

**This must be settled by a live `GET /wp-json/bridgistic/v1/` read before the `bt-ops/v2` migration begins**, because the migration's completeness check depends on knowing the true denominator. See §7.

---

## 3. Website structure

**All of §3 is [AUDIT-0820] — carried forward, not verified here.** `sitemap.xml` could not be fetched.

- **Platform:** WordPress, custom `wpistic` theme
- **Commerce:** WooCommerce (products, orders, customers endpoints active)
- **Forms:** Formistic, submissions endpoint active
- **Regions:** Northern, Central and Southern Laos — **6 destinations**
- **Tours:** Signature journeys with fixed annual departures
- **Reviews:** Google / TripAdvisor integration visible
- **Founder:** Ken FJ Her, Licensed Lao National Tour Guide since 2010

**Caution on the founder profile and the "6 regions" figure.** These are business facts about a named real person and a live commercial catalogue. V4.1 §24 forbids inventing guide details or business facts. Neither could be checked here. Confirm both against the live site — and with the business — before either appears in shipped UI, marketing copy, or seed data.

---

## 4. Insightistic — **NOT CONFIRMED**

**Status: [CONTRADICTED]. The premise that `insightistic.com` is a confirmed AI analytics platform did not survive checking.**

The brief asked to record Insightistic as *"verified — a real AI analytics platform (`insightistic.com`) with GA4, GSC, PageSpeed, revenue analytics, and white-label reporting."* That verification could not be reproduced, and the available evidence points the other way.

**What was attempted:**

| Check | Result |
|---|---|
| Direct fetch of `insightistic.com` / `www.insightistic.com` | **Blocked by egress policy** — no signal either way |
| Web search: `"insightistic"` (exact) | **No analytics product.** Only hit is `insightistic.blogspot.com`, an unrelated personal philosophy blog from Zambia |
| Web search: Insightistic + AI analytics + WordPress/WooCommerce + GA4 + GSC + PageSpeed + white-label | **No result matching the product.** Returned only unrelated tools (Site Kit, MonsterInsights, Analytify, InsightBase, Insightful.io) |
| Web search scoped to `insightistic.com`, wordpress.org, github.com, producthunt.com, x.com, linkedin.com | **No trace of the product on any of them** |

**What this does and does not mean.** It is *not* proof the product does not exist — a private, unlisted, or newly launched plugin can legitimately have zero search-index footprint, and the domain itself was unreachable, so its absence from the index is the only real evidence here. What it does mean is that **the "verified" claim has no support that can be reproduced**, and V4.1 §24 explicitly forbids treating unverified business facts as established.

**The one corroborated fact** is from the audit itself and is a *negative*: the `/insightistic` endpoint returns `active` and `version` only. **No GA4, GSC, PageSpeed or revenue data is exposed through the Operations API today.** **[AUDIT-0820]**

**Consequence for the plan.** Phase 2 (Insightistic Adapter) is specified as an adapter over an existing product's internal PHP interfaces. If that product is not what the brief assumes, Phase 2 has no foundation and the `/analytics/*` route group in `bt-ops/v2` has nothing to adapt.

**Blocker — requires business input before Phase 2 is scheduled:**

1. Confirm Insightistic exists and is installed on `brothertours.com` (`GET /wp-json/bridgistic/v1/plugins`).
2. Provide access to its source so its real service classes can be audited, as Phase 0 requires.
3. Confirm GA4 / GSC / PageSpeed are actually connected and syncing, not merely supported.

Until 1–3 are answered, **do not build the analytics adapter** and do not show analytics UI backed by assumed data. V4.1 §24 requires an explicit `Not configured` state instead.

---

## 5. Security observations

### 5.1 Anonymous REST index exposes the full route map — **confirmed by two sources**

`GET /wp-json/` returns the standard WordPress REST index, which enumerates `bridgistic/v1` **to unauthenticated callers** **[AUDIT-0820]**. The incident brief records the same collision from the other side: the namespace *"now enumerates 47 operations routes alongside Bridgistic's `execute`, `db/query`, `fs/write`, `fs/delete` and `users` routes in a single public index"* **[BRIEF-0818]**.

An anonymous visitor therefore learns that a code-execution endpoint, a SQL runner and a filesystem writer exist at known paths, along with their argument schemas.

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

`/oauth/token` is live alongside the cookie-session routes **[AUDIT-0820]**. The app uses only cookie sessions **[REPO]**. Only the cookie path has been reviewed — the incident brief's CORS, CSRF, capability and cookie-attribute findings all concern `SessionController`.

An unreviewed second path to the same authenticated surface is a gap. Establish whether `/oauth/token` is in use by anything; if not, it belongs in the §5.2 restriction envelope.

### 5.5 Auth responses are cacheable — highest-value backend fix, still unshipped

The site runs an `advanced-cache.php` drop-in with no external object cache. If `GET /auth/session` is ever page-cached, one operator's session state is served to every operator **[BRIEF-0818]**.

The fix is written and reviewed in `wordpress-patches.md` §6.2 (Tier 3, "Do this") — `rest_pre_serve_request` forcing `no-store` on the namespace, plus a `DONOTCACHEPAGE` guard in `wp-config.php`. **Not applied.** Headers only; no schema, data or behaviour change.

### 5.6 Session cookie clear-domain mismatch — still unshipped

`issue_session()` sets `'domain' => ''`, making `bt_ops_session` host-only. More seriously, `clear_cookie()` must use the *same* domain — a cookie cleared under a different domain is never cleared, leaving **phantom sessions alive after logout** **[BRIEF-0818]**. Diff written in `wordpress-patches.md` §6.1 (Tier 3). **Not applied.**

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

## 6. Data conflict register — seed entries

For `docs/V4-DATA-CONFLICT-REGISTER.md` (V4.1 §19 Phase 0).

| # | Conflict | Sources | Resolution |
|---|---|---|---|
| C-01 | Namespace route count: "50+" vs "47" vs 80/107 derived | AUDIT-0820, BRIEF-0818, DERIVED | Live `GET /wp-json/bridgistic/v1/` |
| C-02 | Insightistic product existence and capabilities | Brief asserts verified; no reproducible evidence found | Business input — §4 blocker |
| C-03 | Per-route capability gates unknown; only `bt_manage_operations` is documented, at namespace level | BRIEF-0818 | Source read of `brother-tours-operations-api` v1.0.1 |
| C-04 | "6 destinations" across 3 Laos regions | AUDIT-0820 only | Live sitemap + business confirmation |
| C-05 | Founder profile (Ken FJ Her, licensed since 2010) | AUDIT-0820 only | Business confirmation before any UI use |
| C-06 | `/oauth/token` purpose and consumers | AUDIT-0820 only | Source read + access-log review |

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

# §4 — is Insightistic actually installed, and what does its endpoint return?
curl -s https://www.brothertours.com/wp-json/bridgistic/v1/insightistic   # needs auth
curl -s https://www.brothertours.com/wp-json/bridgistic/v1/plugins        # needs auth

# §3 — site structure
curl -s https://www.brothertours.com/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | head -50

# Deployed build
curl -s https://app.brothertours.com/healthz
```

The S5 probe sends an empty POST deliberately — it is an authorization check, not an exploitation attempt. Any response other than 401/403 is a **critical** finding and should stop Phase 1.

---

## 8. Phase 0 exit status

| Phase 0 item (V4.1 §19) | Status |
|---|---|
| Verify all live endpoints | ⚠️ **Blocked** — egress denied. Inventory reconciled from two sources instead; §7 has the commands. |
| Create `docs/V4-LIVE-BASELINE.md` | ✅ This document. |
| Create `docs/V4-DATA-CONFLICT-REGISTER.md` | ⚠️ Seed entries in §6; not yet a standalone file. |
| Audit Insightistic source for real interfaces | ❌ **Blocked** — product unconfirmed and source unavailable. §4. |
| Audit Repos A and B file structures | ⚠️ Repo B (this one) audited. Repo A not present in this session. |

**Phase 0 is not complete and Phase 1 should not be treated as unblocked.** Two items are blocked on access that this environment cannot obtain, and one (§4) is blocked on a business answer rather than on tooling.

What Phase 0 did establish: the business half of the namespace is corroborated by shipped code, the app's true dependency surface is 52 of 107 method+path pairs, and the highest-value security fix (§5.2) turns out to carry no compatibility cost for this application.
