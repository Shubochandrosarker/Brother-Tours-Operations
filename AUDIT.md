# Code Audit — Brother Tours Operations Hub

## Result

The exported Horizons project was converted into a standalone deployable React application and aligned to the actual Brother Tours Operations API contract.

## Critical issues corrected

### 1. Removed Horizons-only runtime/editor code

The export contained editor/session-journal/selection plugins and preview instrumentation. Production Vite configuration is now minimal and independent of Horizons.

### 2. Corrected authentication contract

- HttpOnly server session remains authoritative.
- `401` is treated as signed-out state, not as service outage.
- CSRF is runtime-only.
- Unsafe writes send `X-BT-CSRF`.
- No auth token is persisted in `localStorage` or `sessionStorage`.
- Success envelope parsing is centralized.

### 3. Removed invented dashboard endpoints

The app no longer expects:

```text
/dashboard/snapshot
/dashboard/attention
/dashboard/alerts
/dashboard/activity
/dashboard/upcoming
```

The Command Center uses the real single endpoint:

```text
GET /dashboard
```

Attention items and alert presentation are derived from real aggregate values returned by that endpoint.

### 4. Corrected booking/inquiry API usage

The app uses the real endpoints for:

- list/detail
- allowed actions
- workflow
- assignment
- internal note
- lifecycle action
- payment-link request
- connection dispatch

Transactions, activity, connection history, and Formistic source are consumed from the real booking detail payload instead of invented sub-endpoints.

### 5. Corrected Tour Manager payloads

Tour create/update now follows the real WordPress Operations API shape, including the actual WPistic meta keys, itinerary `{title, body}`, FAQ `{q, a}`, inclusions/exclusions, pricing/deposit enums, featured-media ID, statuses, and taxonomy display.

Taxonomy mutation is intentionally not invented because the current Operations API does not expose a term-catalogue endpoint.

### 6. Completed the API-supported app modules

Added production UI for:

- destinations
- experiences
- departures
- Formistic inbox and submission detail
- newsletter subscribers
- team
- connections / delivery logs
- reports
- system health
- settings

Unsupported standalone supplier/customer/payment databases were not invented. Payment information stays attached to the real booking record.

### 7. Deployment hardening

- Removed preview/editor tooling.
- Added production Vite config.
- Added Node 22 static server with SPA fallback.
- Added `/healthz`.
- Added private-app indexing controls.
- Added baseline response security headers.
- Removed remote Google Font dependency.
- Added production favicon and robots policy.
- Reduced source/dependency surface to files reachable from the production app.

## Validation performed in this workspace

- All 59 retained JS/JSX source files parsed with **0 syntax diagnostics** using the TypeScript parser.
- Node syntax checks passed for deployment server and configuration files.
- Local import-resolution scan found **0 missing source modules**.
- External-import scan found **0 package names missing from `package.json`**.
- Secret/auth-storage scan found no persisted auth/session/CSRF implementation.
- Invented-dashboard/subresource endpoint scan returned no matches.
- `package-lock.json` was successfully reconciled offline with the final package manifests.

## Validation limitation

A full `npm ci` / Vite production bundle could not be executed inside the current sandbox because this environment's package registry cache does not contain the required Vite tarball. This is an environment/package-fetch limitation, not a source-code diagnostic. The deployment host must still run:

```bash
npm ci
npm run build
```

before release. Do not call the deployment complete if that build fails on the real host.

## Current intentional constraint

`apps/web/.env.production` points to the **staging** Brother Tours API. This is deliberate for the current validation deployment. Change it only when the production WordPress Operations API is installed, configured, and ready.
