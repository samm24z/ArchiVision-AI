#!/usr/bin/env bash
# ArchiVision AI — Milestone M2 Local Verification Script (Bash)
# Prerequisite: backend on :8000 and frontend on :3000

set -euo pipefail

BACKEND_BASE="http://localhost:8000"
FRONTEND_BASE="http://localhost:3000"

echo "=================================================="
echo "ArchiVision AI — Milestone M2 Verification"
echo "=================================================="
echo ""

# 1. Backend health check (HTTP 200)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_BASE/health")
if [ "$STATUS" != "200" ]; then
    echo "FAIL: Backend health check returned HTTP $STATUS, expected 200"
    exit 1
fi
echo "OK  Backend Health: GET $BACKEND_BASE/health (HTTP 200)"

# 2. Frontend health check (HTTP 200)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/api/health")
if [ "$STATUS" != "200" ]; then
    echo "FAIL: Frontend health check returned HTTP $STATUS, expected 200"
    exit 1
fi
echo "OK  Frontend Health: GET $FRONTEND_BASE/api/health (HTTP 200)"

# 3. Protected endpoint without token -> HTTP 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_BASE/api/v1/auth/me")
if [ "$STATUS" != "401" ]; then
    echo "FAIL: GET /api/v1/auth/me returned HTTP $STATUS without token, expected 401"
    exit 1
fi
echo "OK  Unauthenticated Request: GET $BACKEND_BASE/api/v1/auth/me returned HTTP 401"

# 4. Protected endpoint with malformed token -> HTTP 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.jwt.token" "$BACKEND_BASE/api/v1/auth/me")
if [ "$STATUS" != "401" ]; then
    echo "FAIL: GET /api/v1/auth/me returned HTTP $STATUS with malformed token, expected 401"
    exit 1
fi
echo "OK  Malformed Token Request: GET $BACKEND_BASE/api/v1/auth/me returned HTTP 401"

echo ""
echo "=================================================="
echo "Milestone M2 verification PASSED successfully."
echo "=================================================="
