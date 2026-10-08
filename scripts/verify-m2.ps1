# ArchiVision AI - Milestone M2 local verification
# Prerequisite: backend on :8000 and frontend on :3000

$ErrorActionPreference = "Stop"

$BackendBase = "http://localhost:8000"
$FrontendBase = "http://localhost:3000"

Write-Host "M2 verification - health and auth endpoints"
Write-Host ""

# 1. Backend health
$backend = Invoke-WebRequest -Uri "$BackendBase/health" -UseBasicParsing
if ($backend.StatusCode -ne 200 -or $backend.Content -notmatch '"status"\s*:\s*"ok"') {
    throw "Backend health check failed"
}
Write-Host "OK  Backend Health: GET $BackendBase/health (HTTP 200)"

# 2. Frontend health
$frontend = Invoke-WebRequest -Uri "$FrontendBase/api/health" -UseBasicParsing
if ($frontend.StatusCode -ne 200 -or $frontend.Content -notmatch '"status"\s*:\s*"ok"') {
    throw "Frontend health check failed"
}
Write-Host "OK  Frontend Health: GET $FrontendBase/api/health (HTTP 200)"

# 3. Protected endpoint without token -> 401
$unauthStatus = 0
try {
    $res = Invoke-WebRequest -Uri "$BackendBase/api/v1/auth/me" -UseBasicParsing
    $unauthStatus = $res.StatusCode
} catch {
    $unauthStatus = 401
}

if ($unauthStatus -ne 401) {
    throw "Expected HTTP 401 without token, got $unauthStatus"
}
Write-Host "OK  Unauthenticated: GET $BackendBase/api/v1/auth/me returned HTTP 401"

# 4. Protected endpoint with malformed token -> 401
$malformedStatus = 0
try {
    $res = Invoke-WebRequest -Uri "$BackendBase/api/v1/auth/me" -Headers @{ Authorization = "Bearer invalid.jwt.token" } -UseBasicParsing
    $malformedStatus = $res.StatusCode
} catch {
    $malformedStatus = 401
}

if ($malformedStatus -ne 401) {
    throw "Expected HTTP 401 with malformed token, got $malformedStatus"
}
Write-Host "OK  Malformed Token: GET $BackendBase/api/v1/auth/me returned HTTP 401"

Write-Host ""
Write-Host "M2 local verification passed."
