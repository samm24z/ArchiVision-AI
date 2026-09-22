# ArchiVision AI — M1 local health and CORS checks
# Prerequisite: backend on :8000 and frontend on :3000

$ErrorActionPreference = "Stop"

$BackendHealth = "http://localhost:8000/health"
$FrontendHealth = "http://localhost:3000/api/health"
$FrontendOrigin = "http://localhost:3000"

function Assert-Ok([string]$Name, [Microsoft.PowerShell.Commands.WebResponseObject]$Response) {
    if ($Response.StatusCode -ne 200) {
        throw "$Name failed: HTTP $($Response.StatusCode)"
    }
    Write-Host "OK  $Name (HTTP $($Response.StatusCode))"
}

Write-Host "M1 verification — health and CORS"
Write-Host ""

$backend = Invoke-WebRequest -Uri $BackendHealth -UseBasicParsing
Assert-Ok "GET $BackendHealth" $backend
if ($backend.Content -notmatch '"status"\s*:\s*"ok"') {
    throw "Backend health payload missing status=ok"
}

$frontend = Invoke-WebRequest -Uri $FrontendHealth -UseBasicParsing
Assert-Ok "GET $FrontendHealth" $frontend
if ($frontend.Content -notmatch '"status"\s*:\s*"ok"') {
    throw "Frontend health payload missing status=ok"
}

$cors = Invoke-WebRequest -Uri $BackendHealth -Headers @{ Origin = $FrontendOrigin } -UseBasicParsing
Assert-Ok "GET $BackendHealth with Origin $FrontendOrigin" $cors
$allowOrigin = $cors.Headers["Access-Control-Allow-Origin"]
if ($allowOrigin -ne $FrontendOrigin) {
    throw "CORS failed: expected Access-Control-Allow-Origin=$FrontendOrigin, got '$allowOrigin'"
}
Write-Host "OK  CORS Access-Control-Allow-Origin=$allowOrigin"

Write-Host ""
Write-Host "M1 local verification passed."
