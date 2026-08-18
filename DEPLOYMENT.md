# Deployment — Brother Tours Operations Hub

Production only. There is no staging environment; see [Staging](#staging) below.

| | |
|---|---|
| App | `https://app.brothertours.com` |
| API | `https://www.brothertours.com/wp-json/bridgistic/v1` |
| Runtime | Hostinger Web App, Node 22 |
| Backend | WordPress (`brother-tours-operations-api`), source of truth |

---

## 1 · Hostinger Web App panel

Set exactly this. Do not rely on panel defaults.

```text
Application root:  /            (repository root — the workspace root, not apps/web)
Node version:      22           (matches .nvmrc and engines ">=20 <23")
Install command:   npm ci
Build command:     BT_TARGET=production npm run build && BT_TARGET=production npm run verify:build
Start command:     npm start
Health check path: /healthz
```

Build-time environment variables:

```text
VITE_BT_API_BASE = https://www.brothertours.com/wp-json/bridgistic/v1
BT_TARGET        = production
```

`PORT` is injected by Hostinger. `server.mjs` reads it and binds `0.0.0.0` — never hardcode a port.

### The build step is not optional

`server.mjs` is a pure static file server. It never builds. It serves whatever is in `dist/apps/web`.
`dist/` is not in git (deliberately — see §4), so **if the build command does not run, there is nothing to serve and the process exits with a clear error** rather than silently shipping a stale bundle.

If the Hostinger plan or panel cannot run a build step, do **not** resurrect a committed `dist/`. Change the deployment model instead:

1. Build in GitHub Actions (`.github/workflows/build.yml` already produces and verifies the exact artifact).
2. Upload `dist/apps/web` plus `server.mjs`, `package.json` and `package-lock.json` as the deployment payload.
3. Run `npm ci --omit=dev && npm start` on the host.

The artifact must carry `dist/apps/web/build-info.json`; without it `/healthz` cannot report which build is live and the CSP `connect-src` degrades to `'self'` only.

---

## 2 · Verifying a deployment

One request answers "what is live and where is it pointed":

```bash
curl -s https://app.brothertours.com/healthz
```

```json
{
  "ok": true,
  "app": "brother-tours-operations-hub",
  "apiBase": "https://www.brothertours.com/wp-json/bridgistic/v1",
  "commit": "<short sha>",
  "builtAt": "<ISO timestamp>",
  "uptimeSeconds": 0
}
```

`apiBase` must be the `www` `bridgistic/v1` URL and `commit` must match `main`. If either disagrees, the deployed bundle is not the one you think it is — **stop and re-deploy** rather than debugging the app.

Live smoke test, in order:

1. `/healthz` reports the expected `apiBase` and `commit`.
2. `/login` renders; the footer shows the correct compiled API base.
3. Sign in with an account holding `bt_manage_operations`.
4. **Hard-refresh.** The session must persist — this is the assertion that was failing.
5. Dashboard loads real data from `GET /dashboard`.
6. Add one internal note on a test record — confirms the `X-BT-CSRF` write path.
7. DevTools → Application → Cookies on `www.brothertours.com`: `bt_ops_session` present, `HttpOnly`, `Secure`, `SameSite=None`.
8. DevTools → Network: zero requests to `bt-ops/v1` or `staging.brothertours.com`.
9. Sign out → `/auth/session` returns `401` → redirected to `/login` **with a message**, not silently.

---

## 3 · Which routing file applies to which runtime

Three SPA-routing mechanisms live in this repository. Only one is active at a time. Editing the wrong one is how SPA routing gets "debugged" for a day with no effect.

| File | Runtime | Active on Hostinger Web App? |
|---|---|---|
| `server.mjs` | **Node** — the Hostinger Web App runtime | **Yes. This is the one that matters.** |
| `apps/web/public/.htaccess` | Apache / LiteSpeed static hosting | No — inert under Node |
| `apps/web/public/_redirects` | Netlify | No — inert under Node |

The two static-host files are kept only as a fallback for static hosting. Under the current deployment, **all SPA routing and header behaviour comes from `server.mjs`.**

`server.mjs` deliberately returns `404` for a missing file under `/assets/` rather than falling back to `index.html`. Serving HTML under a `text/javascript` Content-Type kills the app with an opaque module parse error; a `404` names the problem.

---

## 4 · Why `dist/` is not in git

It was, and that is exactly what took production down. The committed bundle was compiled against `https://staging.brothertours.com/wp-json/bt-ops/v1` — a dead host and a dead REST namespace — and `dist/apps/web/assets/` held duplicate chunks from two different builds, proving the tracked output was an accumulated mixture rather than a clean artifact.

Guards now in place, in the order they fire:

| Guard | Catches |
|---|---|
| `.gitignore` (`dist/`, `*.zip`) | Re-committing build output |
| `npm run preflight:production` | A non-HTTPS or non-`bridgistic/v1` API base; browser-storage auth; missing `X-BT-CSRF` |
| `scripts/stamp.mjs` | Writes `build-info.json` so the shipped build is identifiable |
| `scripts/verify-build.mjs` | `bt-ops/v1` in the bundle, a staging host in a production build, an unresolved API base, duplicate chunks, `index.html` pointing at absent assets |
| `.github/workflows/build.yml` | All of the above, on every push and PR — including a hard failure if `dist/` or a `.zip` is tracked again |

A bare `npm run build` **is** the production build. There is no other profile that can be reached by accident.

---

## 5 · Staging

**There is no staging environment.** The staging profile (`apps/web/.env.staging`, `build:staging`, `preflight:staging`) has been removed.

It previously pointed at `https://staging.brothertours.com/wp-json/bridgistic/v1`, which disagreed with the 14 Aug deployment note recording the staging API at the apex `https://brothertours.com/wp-json/bridgistic/v1`. At most one was real, and a build profile pointing at an unconfirmed host is worse than no profile — it is precisely what shipped the wrong bundle.

To reintroduce staging later:

1. Confirm the host actually serves WordPress and the `bridgistic/v1` namespace resolves.
2. Add `apps/web/.env.staging` with the confirmed base.
3. Add `build:staging` / `preflight:staging` back to `package.json`.
4. Add the staging origin to `BT_OPS_ALLOWED_ORIGINS` on the WordPress side.
5. Extend `scripts/verify-build.mjs` so a staging base cannot pass a `BT_TARGET=production` build (the check is already there and keyed on `BT_TARGET`).

---

## 6 · WordPress side

The backend is live and is the source of truth. Recommended changes are documented, **unapplied**, in [`docs/wordpress-patches.md`](docs/wordpress-patches.md). They require sign-off and a Bridgistic snapshot before deployment and are not part of this deployment.
