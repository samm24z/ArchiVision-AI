#!/usr/bin/env bash
# ArchiVision AI — M1 local health and CORS checks
# Prerequisite: backend on :8000 and frontend on :3000

set -euo pipefail

BACKEND_HEALTH="http://localhost:8000/health"
FRONTEND_HEALTH="http://localhost:3000/api/health"
FRONTEND_ORIGIN="http://localhost:3000"

echo "M1 verification — health and CORS"
echo

backend_body="$(curl -fsS "$BACKEND_HEALTH")"
echo "OK  GET $BACKEND_HEALTH"
echo "$backend_body" | grep -q '"status":"ok"\|"status": "ok"' || {
  echo "Backend health payload missing status=ok" >&2
  exit 1
}

frontend_body="$(curl -fsS "$FRONTEND_HEALTH")"
echo "OK  GET $FRONTEND_HEALTH"
echo "$frontend_body" | grep -q '"status":"ok"\|"status": "ok"' || {
  echo "Frontend health payload missing status=ok" >&2
  exit 1
}

cors_headers="$(curl -fsS -D - -o /dev/null -H "Origin: ${FRONTEND_ORIGIN}" "$BACKEND_HEALTH")"
echo "$cors_headers" | grep -qi "Access-Control-Allow-Origin: ${FRONTEND_ORIGIN}" || {
  echo "CORS failed: expected Access-Control-Allow-Origin: ${FRONTEND_ORIGIN}" >&2
  echo "$cors_headers" >&2
  exit 1
}
echo "OK  CORS Access-Control-Allow-Origin=${FRONTEND_ORIGIN}"

echo
echo "M1 local verification passed."
