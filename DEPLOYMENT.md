# Deployment — Brother Tours Operations Hub

## Target

Recommended application hostname:

```text
https://app.brothertours.com
```

Current API during staging validation:

```text
https://staging.brothertours.com/wp-json/bt-ops/v1
```

## 1. Pre-deploy checks

On the deployment build machine:

```bash
node --version
npm --version
npm ci
npm run build
```

Use Node 22 where available (`.nvmrc` is included).

Expected build directory:

```text
dist/apps/web
```

## 2. Environment

The production build reads:

```env
VITE_BT_API_BASE=https://staging.brothertours.com/wp-json/bt-ops/v1
```

For the final production WordPress cutover, update `apps/web/.env.production` before rebuilding.

Do not add secrets to any `VITE_*` variable.

## 3. Start command

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

## 4. Hostinger-style Node deployment values

Use the repository root as the application root.

```text
Install command: npm ci
Build command:   npm run build
Start command:   npm start
Node:            22
```

Then connect the application hostname to this deployment.

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

1. Change `VITE_BT_API_BASE` to the production API base.
2. Add `https://app.brothertours.com` to that production WordPress instance's allowed origins.
3. Build again.
4. Deploy.
5. Repeat the smoke tests above before normal staff use.
