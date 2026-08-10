# Brother Tours Operations Hub

Production-oriented React/Vite operations console for Brother Tours.

## Architecture

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Recharts.
- **Backend / source of truth:** the existing Brother Tours WordPress installation.
- **Operations API:** `bt-ops/v1` via `VITE_BT_API_BASE`.
- **Authentication:** WordPress-authoritative HttpOnly session cookie plus runtime-only `X-BT-CSRF` token.
- **Business data:** never duplicated into the frontend or a second application database.

## Implemented modules

- Secure sign-in and session hydration
- Command Center dashboard using the real `GET /dashboard` aggregate
- Inquiries / bookings list and detail workspace
- Backend-controlled booking workflow, assignment, notes, lifecycle actions, payment-link requests, and connection dispatch
- Tours CRUD and detailed editor
- Destinations CRUD
- Experiences CRUD
- Departures CRUD and availability filtering
- Formistic inbox, detail, notes, reply workflow, attachment metadata, and AI metadata display
- Newsletter subscribers
- Team / assignment visibility
- Connections and delivery logs
- Reports
- System Health
- Account / app settings information
- Responsive desktop/mobile shell, dark/light/system themes, route error isolation

## Local development

```bash
npm ci
npm run dev
```

The web app runs on port `3000` by default.

## Production build

```bash
npm ci
npm run build
npm start
```

`npm start` serves `dist/apps/web` with SPA fallback, `/healthz`, noindex headers, and baseline security headers.

## Environment

Current build target:

```env
VITE_BT_API_BASE=https://staging.brothertours.com/wp-json/bt-ops/v1
```

This URL is public configuration, not a secret. Never put WordPress passwords, session values, CSRF tokens, connection secrets, payment secrets, or private API keys in `VITE_*` variables.

Before the final live backend cutover, change `apps/web/.env.production` to the production Brother Tours Operations API.

## Important backend requirements

The WordPress Operations API must allow the deployed app origin, for example:

```text
https://app.brothertours.com
```

Credentialed CORS must remain explicit. Do not use a wildcard origin for this authenticated application.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Audit

See [`AUDIT.md`](AUDIT.md).
