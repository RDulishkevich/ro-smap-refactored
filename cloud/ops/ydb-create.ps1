# Creates serverless YDB for Полёвка and prints Document API endpoint.
# Run from a machine with `yc` logged in. Then put YDB_DOCAPI_ENDPOINT on the Cloud Function
# and grant the function SA `ydb.databaseUser` (or `ydb.editor`) on this database.

$ErrorActionPreference = 'Stop'
$name = if ($env:YDB_NAME) { $env:YDB_NAME } else { 'polevka' }

Write-Host "Creating serverless YDB '$name' (no-op if it already exists)..."
$existing = yc ydb database list --format json | ConvertFrom-Json
$found = @($existing) | Where-Object { $_.name -eq $name } | Select-Object -First 1
if (-not $found) {
    yc ydb database create $name --serverless
    $found = yc ydb database get $name --format json | ConvertFrom-Json
}

$endpoint = $found.document_api_endpoint
if (-not $endpoint) {
    $full = yc ydb database get $name --format json | ConvertFrom-Json
    $endpoint = $full.document_api_endpoint
}

Write-Host ""
Write-Host "YDB_DOCAPI_ENDPOINT=$endpoint"
Write-Host "YDB_DATABASE=$($found.database_path)"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Function SA: yc ydb database add-access-binding $name --role ydb.databaseUser --service-account-id <SA>"
Write-Host "  2. Set function env YDB_DOCAPI_ENDPOINT (same static keys as Object Storage if that SA owns both)"
Write-Host "  3. node cloud/ops/migrate-to-ydb.cjs"
Write-Host "  4. Redeploy API (zip must include ydbDoc.js). health.ydb must be true, version >= 18"
