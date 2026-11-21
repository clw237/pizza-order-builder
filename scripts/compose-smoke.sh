#!/usr/bin/env bash
# Smoke test for the running compose stack: docker compose up --build --wait, then run this.
# Expects KITCHEN_TOKEN to be the value compose started the service with. CI and humans run it.
set -euo pipefail

service=http://127.0.0.1:3000
web=http://127.0.0.1:5173
fail() { echo "FAIL: $*" >&2; exit 1; }
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

[ -n "${KITCHEN_TOKEN:-}" ] || fail "set KITCHEN_TOKEN to the token compose started the service with"

echo "==> service health"
[ "$(status "$service/health")" = 200 ] || fail "service /health is not 200"

echo "==> builder page"
[ "$(status "$web/")" = 200 ] || fail "builder page is not 200"

echo "==> submit an order through the builder's /api proxy (1 small plain = \$5.32)"
order='{"order":{"lines":[{"sizeId":"small","quantity":1,"toppingIds":[]}],"promoCodes":[],"tip":{"mode":"dollars","value":""}},"expectedTotalCents":532}'
created=$(curl -s -w '\n%{http_code}' -X POST "$web/api/orders" \
  -H 'content-type: application/json' -H "idempotency-key: compose-smoke-$$-$RANDOM" -d "$order")
[ "$(tail -n1 <<<"$created")" = 201 ] || fail "submit was not 201: $created"
id=$(head -n1 <<<"$created" | sed -n 's/^{"id":"\([^"]*\)".*/\1/p')
[ -n "$id" ] || fail "no order id in: $created"
echo "    order $id"

echo "==> restaurant routes refuse a request without the token"
[ "$(status "$service/orders")" = 401 ] || fail "GET /orders without a token is not 401"

echo "==> kitchen CLI inside the service container lists and advances the order"
docker compose exec -T service npm run -s kitchen -- list | grep -q "$id" || fail "order not listed"
docker compose exec -T service npm run -s kitchen -- advance "$id" | grep -q "is now Started" ||
  fail "advance did not start the order"

echo "Compose smoke test passed."
