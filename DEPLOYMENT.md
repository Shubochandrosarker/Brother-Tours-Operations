# Deployment — Brother Tours Operations Hub

## Target

Recommended application hostname:

```text
https://app.brothertours.com
```

Current production API target:

```text
https://www.brothertours.com/wp-json/bridgistic/v1
```

## 1. Hostinger Web App profiles

Create separate Hostinger Web Apps or deployment environments when staging and production must be available at the same time. Both use the repository root and the same `npm start` command; only the build target and WordPress API differ.

### Staging profile

```text
Install command: npm ci
Build command:   npm run build:staging
Start command:   npm start
Node:            22
API:             https://staging.brothertours.com/wp-json/bridgistic/v1
```

### Production profile

```text
Install command: npm ci
Build command:   npm run build:production
Start command:   npm start
Node:            22
API:             https://www.brothertours.com/wp-json/bridgistic/v1
```

If Hostinger environment variables are used, set `VITE_BT_API_BASE` before the build. It overrides the committed `.env.staging` or `.env.production` value and must remain an HTTPS `bridgistic/v1` endpoint. Never put credentials in `VITE_*` variables.

The staging and production app origins must be distinct if both are online simultaneously. Add each exact origin to the corresponding WordPress Operations API CORS allow-list; credentialed CORS must not use `*`.

## 2. Pre-deploy checks

On the deployment build machine:

```bash
node --version
npm --version
npm ci
npm run build:production
```

Use Node 22 where available (`.nvmrc` is included).

Expected build directory:

```text
dist/apps/web
```

## 3. Environment

The production build reads:

```env
VITE_BT_API_BASE=https://www.brothertours.com/wp-json/bridgistic/v1
```

For staging validation, use:

```bash
npm run build:staging
```

This reads:

```env
VITE_BT_API_BASE=https://staging.brothertours.com/wp-json/bridgistic/v1
```

Do not add secrets to any `VITE_*` variable.

## 4. Start command

The repository includes a dependency-free Node static server:

```bash
npm start
```

It reads the hosting platform's `PORT` environment variable automatically and serves the compiled React app with SPA route fallback.

Health endpoint:

```text
/healthz
```

Expected response:

```json
{"ok":true,"app":"brother-tours-operations-hub","version":"1.0.0"}
```

Use the repository root as the application root. Hostinger supplies `PORT`; the server defaults to `3000` for local smoke tests.

## 5. WordPress CORS

The Brother Tours Operations API must allow the exact deployed origin:

```text
https://app.brothertours.com
```

The existing Operations API security model requires credentialed requests and the `X-BT-CSRF` header. Keep the allow-list explicit.

## 6. Smoke-test order

After deployment, test in this order:

1. `/login` renders.
2. Sign in with an authorized WordPress operations account.
3. Refresh the browser and confirm the session persists.
4. Dashboard loads real data.
5. Inquiries list loads.
6. One inquiry detail loads transactions/activity/connections.
7. Add one internal note on a staging record and verify `X-BT-CSRF` succeeds.
8. Tours list and one edit/save work.
9. Destinations, Experiences, and Departures load.
10. Form Inbox loads and one controlled staging note/reply flow is verified.
11. Connections, Reports, Team, and System Health load.
12. Verify `/healthz` returns HTTP 200.
13. Verify private app pages are not indexable.

## 7. Rollback

Keep the previous successful deployment/release available in the hosting platform. If any authenticated write path fails after release, switch traffic back to the previous release and investigate on staging rather than editing production data to compensate.

## 8. Live-backend cutover

When the production WordPress Operations API is ready:

1. Confirm the live WordPress API accepts `https://app.brothertours.com`.
2. Build with the production env:

   ```bash
   npm run build:production
   ```

3. Deploy the fresh production build.
4. Repeat the smoke tests above before normal staff use.
