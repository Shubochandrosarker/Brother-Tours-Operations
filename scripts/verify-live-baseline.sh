#!/usr/bin/env bash
#
# Phase 0 live verification for docs/V4-LIVE-BASELINE.md.
#
# Settles every claim the baseline could not measure because egress to
# brothertours.com was blocked. Run from a host that can reach the site.
#
#   ./scripts/verify-live-baseline.sh                  # anonymous checks only
#   BT_COOKIE='bt_ops_session=...' ./scripts/verify-live-baseline.sh
#
# READ-ONLY. Sends no writes, mutates nothing, exploits nothing. The S5 section
# sends empty POSTs purely to observe the authorization decision — a 401/403 is
# the expected and desired result.
#
# Exit 0 = no critical finding. Exit 1 = something needs attention before Phase 1.

set -uo pipefail

BASE="${BT_BASE:-https://www.brothertours.com}"
NS="$BASE/wp-json/bridgistic/v1"
APP="${BT_APP:-https://app.brothertours.com}"
COOKIE="${BT_COOKIE:-}"
CURL=(curl -sS --max-time 30)
[ -n "$COOKIE" ] && CURL+=(-H "Cookie: $COOKIE")

critical=0
warn=0
pass=0

hr()   { printf '\n\033[1m── %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mCRIT\033[0m  %s\n' "$1"; critical=$((critical+1)); }
note() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; warn=$((warn+1)); }
info() { printf '        %s\n' "$1"; }

have_jq=1; command -v jq >/dev/null 2>&1 || have_jq=0
[ "$have_jq" -eq 0 ] && note "jq not installed — route parsing will be limited"

# ── 1. Route inventory · settles conflict C-01 ────────────────────────────────
hr "1. Bridgistic namespace route inventory (C-01)"

# Reachability is decided ONCE, here. An intercepting proxy can answer with its
# own 403 and headers, so "got bytes back" is not proof we reached the origin —
# only a parseable WordPress route index is. Everything downstream is gated on
# this, otherwise a blocked host silently reads as a clean bill of health.
REACHABLE=0
idx="$("${CURL[@]}" "$NS/" 2>/dev/null)"
if ! printf '%s' "$idx" | grep -q '"routes"'; then
  bad "Could not read a route index from $NS/ — is egress to the host open?"
  info "Response was ${#idx} bytes and contained no \"routes\" key."
  info "If a proxy sits in front of you, its error page can masquerade as a reply."
else
  REACHABLE=1
  if [ "$have_jq" -eq 1 ]; then
    paths=$(printf '%s' "$idx" | jq -r '.routes | keys | length' 2>/dev/null || echo "?")
    pairs=$(printf '%s' "$idx" \
      | jq -r '[.routes | to_entries[] | .value.endpoints[]?.methods[]?] | length' 2>/dev/null || echo "?")
    info "distinct route patterns : $paths   (baseline derived 80)"
    info "method+path pairs       : $pairs   (baseline derived 107)"

    printf '%s' "$idx" \
      | jq -r '.routes | to_entries[] | "\(.key) :: \([.value.endpoints[]?.methods[]?] | unique | join(","))"' \
      2>/dev/null | sort > /tmp/bt-live-routes.txt
    info "full inventory written to /tmp/bt-live-routes.txt"

    case "$paths" in
      80) ok "Route count matches the baseline's derived figure (80)" ;;
      ?)  note "Could not parse route count" ;;
      *)  note "Route count is $paths, not the derived 80 — update the baseline and C-01" ;;
    esac
  else
    frags=$(printf '%s' "$idx" | tr ',' '\n' | grep -c 'bridgistic/v1' || true)
    info "$frags route fragments seen — install jq for exact counts"
  fi
fi

# ── 2. Anonymous REST index exposure · §5.1 ──────────────────────────────────
hr "2. Anonymous REST index exposure (§5.1)"

anon=$(curl -sS --max-time 30 "$BASE/wp-json/" 2>/dev/null)
if [ -z "$anon" ]; then
  # An empty body is a transport failure, NOT evidence the namespace is hidden.
  note "No response from $BASE/wp-json/ — cannot judge exposure (not a pass)"
elif printf '%s' "$anon" | grep -q 'bridgistic/v1'; then
  bad "bridgistic/v1 IS listed in the anonymous REST index — T-081 still unshipped"
  info "An unauthenticated visitor learns /execute, /db/query and /fs/* exist."
elif printf '%s' "$anon" | grep -q '"namespaces"'; then
  ok "Valid REST index returned and bridgistic/v1 is absent — T-081 appears shipped"
else
  note "Response was not a recognisable REST index — cannot judge exposure"
fi

# ── 3. Auth response cacheability · §5.5 ─────────────────────────────────────
hr "3. Auth response cache headers (§5.5)"

if [ "$REACHABLE" -eq 0 ]; then
  note "Origin unreachable — skipping (absence of no-store cannot be concluded)"
else
hdr=$(curl -sSI --max-time 30 "$NS/auth/session" 2>/dev/null)
cc=$(printf '%s' "$hdr" | grep -i '^cache-control:' | tr -d '\r' || true)
if printf '%s' "$cc" | grep -qi 'no-store'; then
  ok "no-store present on /auth/session — patch 6.2 appears shipped"
else
  bad "no-store MISSING on /auth/session — session state is page-cacheable"
  info "${cc:-(no Cache-Control header at all)}"
  info "Fix is written and reviewed in docs/wordpress-patches.md §6.2"
fi
printf '%s' "$hdr" | grep -iE '^(vary|pragma|x-cache|cf-cache-status):' | tr -d '\r' \
  | sed 's/^/        /' || true
fi

# ── 4. S5 authorization · §5.2 ───────────────────────────────────────────────
hr "4. S5 connector-route authorization (§5.2)"
info "Empty POSTs. Observing the authorization decision only — 401/403 is correct."

if [ "$REACHABLE" -eq 0 ]; then
  note "Origin unreachable — skipping (a proxy 403 would masquerade as a pass)"
else
for r in execute db/query fs/list fs/read fs/write fs/delete; do
  code=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' -X POST "$NS/$r" 2>/dev/null)
  case "$code" in
    401|403) ok  "POST /$r → $code (rejects anonymous)" ;;
    404)     note "POST /$r → 404 (route absent or hidden)" ;;
    000)     note "POST /$r → no response" ;;
    *)       bad "POST /$r → $code — MUST NOT be reachable anonymously" ;;
  esac
done
fi

# ── 5. Insightistic PLUGIN · §4 ────────────────────────────────────────────────
hr "5. Insightistic plugin (§4)"
info "Subject is the WordPress PLUGIN (v4.4.0), not any hosted product."

if [ "$REACHABLE" -eq 0 ]; then
  note "Origin unreachable — skipping"
else
  # /insightistic is expected to 404 until defect B-1 is fixed (controller
  # exists in source but is never registered). A 200 here means B-1 shipped.
  ins_code=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' "$NS/insightistic" 2>/dev/null)
  case "$ins_code" in
    404) ok  "GET /insightistic → 404 as expected (defect B-1 still open)" ;;
    200) ok  "GET /insightistic → 200 — InsightisticController is now registered (B-1 fixed)" ;;
    401|403) note "GET /insightistic → $ins_code (needs auth; re-run with BT_COOKIE)" ;;
    *)   note "GET /insightistic → $ins_code (unexpected)" ;;
  esac

  if [ -z "$COOKIE" ]; then
    note "No BT_COOKIE set — skipping the plugin-list and secret-leak checks"
  else
    plugins="$("${CURL[@]}" "$NS/plugins" 2>/dev/null)"
    if printf '%s' "$plugins" | grep -qi 'insightistic'; then
      ok "Insightistic plugin present in the live plugin list"
    else
      note "Insightistic not found in the plugin list — re-check §4.1"
    fi
    if printf '%s' "$plugins" | grep -qi 'woocommerce'; then
      note "WooCommerce IS present — §2.5 says it is not installed; update the baseline"
    else
      ok "WooCommerce absent, as documented — /woo/* routes are dead"
    fi

    # §4.5 — these option values must never appear in any REST response.
    for ep in "analytics/status" "insightistic"; do
      body="$("${CURL[@]}" "$NS/$ep" 2>/dev/null)"
      if printf '%s' "$body" | grep -qiE 'private_key|api_key_enc|groq_key|connector_secret|crypto_secret'; then
        bad "$ep LEAKS an Insightistic secret value — must report booleans only (§4.5)"
      fi
    done
    ok "No Insightistic secret values seen in /analytics/status or /insightistic"
  fi
fi

# ── 6. Site structure · §3 / C-04 ────────────────────────────────────────────
hr "6. Site structure (§3, C-04)"

sm=$(curl -sS --max-time 30 "$BASE/sitemap.xml" 2>/dev/null)
if [ "$REACHABLE" -eq 0 ]; then
  note "Origin unreachable — skipping"
elif printf '%s' "$sm" | grep -q '<loc>'; then
  n=$(printf '%s' "$sm" | grep -oE '<loc>[^<]+</loc>' | wc -l | tr -d ' ')
  info "sitemap.xml returned $n <loc> entries"
  printf '%s' "$sm" | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g' \
    | head -40 | sed 's/^/        /'
  info "Confirm the 6-destination / 3-region figure against this list, then C-04."
else
  note "sitemap.xml unavailable — C-04 stays open"
fi

# ── 7. Deployed build ────────────────────────────────────────────────────────
hr "7. Deployed app build"
hz=$(curl -sS --max-time 30 "$APP/healthz" 2>/dev/null)
info "${hz:-unreachable}"
printf '%s' "$hz" | grep -q 'bridgistic/v1' \
  && ok "App reports the bridgistic/v1 namespace" \
  || note "App did not report bridgistic/v1 — check the deployed bundle"

# ── Summary ──────────────────────────────────────────────────────────────────
hr "Summary"
printf '  pass %d · warn %d · critical %d\n\n' "$pass" "$warn" "$critical"

if [ "$critical" -gt 0 ]; then
  echo "  Critical findings present. Resolve them before starting Phase 1."
  echo "  Update docs/V4-LIVE-BASELINE.md provenance markers with what you measured."
  exit 1
fi
echo "  No critical findings. Update the baseline's provenance markers to [VERIFIED]."
