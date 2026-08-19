# Brother Tours Operations Hub

Production-oriented React/Vite operations console for Brother Tours.

## Architecture

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Recharts.
- **Backend / source of truth:** the existing Brother Tours WordPress installation.
- **Operations API:** `bridgistic/v1` via `VITE_BT_API_BASE`.
- **Authentication:** WordPress-authoritative HttpOnly session cookie plus runtime-only `X-BT-CSRF` token.
- **Business data:** never duplicated into the frontend or a second application database.

The WordPress side — the `brother-tours-operations-api` plugin this app talks to,
including the `/content/*`, `/media`, `/analytics/*` and `/site/*` controllers
that back the Content, Media, Analytics and Site screens — lives in
[`Shubochandrosarker/brother-tours-laos`](https://github.com/Shubochandrosarker/brother-tours-laos)
under `plugins/brother-tours-operations-api`. This repository contains only the
React console.

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
BT_TARGET=production npm run build
BT_TARGET=production npm run verify:build
npm start
```

`npm run build` **is** the production build — there is no other profile. It runs preflight, builds, and stamps `dist/apps/web/build-info.json`.

`npm run verify:build` inspects the built output and fails on a dead namespace, a staging host in a production bundle, an unresolved API base, duplicate chunks from a stale build, or an `index.html` referencing assets that are not on disk. Run it before every deploy.

`npm start` serves `dist/apps/web` with SPA fallback, `/healthz`, noindex headers, and baseline security headers. Build output is **not** committed to this repository; `npm start` fails loudly if the build has not run.

Check which build is live:

```bash
curl -s https://app.brothertours.com/healthz
```

## Environment

Production build target:

```env
VITE_BT_API_BASE=https://www.brothertours.com/wp-json/bridgistic/v1
```

This URL is public configuration, not a secret. Never put WordPress passwords, session values, CSRF tokens, connection secrets, payment secrets, or private API keys in `VITE_*` variables.

There is no staging environment and no staging build profile. See the Staging section of [`DEPLOYMENT.md`](DEPLOYMENT.md) for the reasoning and for what reintroducing one would require.

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
