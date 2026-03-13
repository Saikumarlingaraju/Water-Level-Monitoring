#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://water-level-monitoring-backend.onrender.com}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://waterlevelmonitoring-six.vercel.app}"
AUTH_USERNAME="${AUTH_USERNAME:-}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"

pass() { echo "[PASS] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

http_code() {
  curl -s -o /tmp/deploy_check.out -w "%{http_code}" "$@"
}

echo "Checking backend: ${BACKEND_URL}"

code=$(http_code "${BACKEND_URL}/health")
[[ "$code" == "200" ]] || fail "/health returned HTTP $code"
pass "/health reachable"

if grep -q '"status"[[:space:]]*:[[:space:]]*"healthy"' /tmp/deploy_check.out; then
  pass "health status is healthy"
else
  warn "health payload does not include status=healthy"
fi

if grep -q '"database"[[:space:]]*:[[:space:]]*"configured"' /tmp/deploy_check.out; then
  pass "database connectivity reported configured"
else
  warn "database status is not configured"
fi

code=$(http_code "${BACKEND_URL}/docs")
[[ "$code" == "200" ]] || fail "/docs returned HTTP $code"
pass "/docs reachable"

code=$(http_code -X OPTIONS "${BACKEND_URL}/api/v1/auth/login" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST")
[[ "$code" == "200" ]] || fail "CORS preflight failed for frontend origin (${FRONTEND_ORIGIN}), HTTP $code"
pass "CORS preflight for frontend origin"

if [[ -n "$AUTH_USERNAME" && -n "$AUTH_PASSWORD" ]]; then
  login_response=$(curl -s -X POST "${BACKEND_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${AUTH_USERNAME}\",\"password\":\"${AUTH_PASSWORD}\"}")

  token=$(echo "$login_response" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
  if [[ -z "$token" ]]; then
    fail "Login did not return access_token"
  fi
  pass "Auth login returns token"

  code=$(http_code "${BACKEND_URL}/api/v1/auth/me" -H "Authorization: Bearer ${token}")
  [[ "$code" == "200" ]] || fail "/api/v1/auth/me failed with HTTP $code"
  pass "Auth protected endpoint works"

  code=$(http_code "${BACKEND_URL}/api/v1/model-info" -H "Authorization: Bearer ${token}")
  [[ "$code" == "200" ]] || fail "/api/v1/model-info failed with HTTP $code"
  pass "Model info endpoint works"
else
  warn "Skipping auth-protected endpoint tests (set AUTH_USERNAME and AUTH_PASSWORD)"
fi

echo "Deployment verification completed."
