# Redeploy Полёвка Secure API without printing secrets.
# Copies current function env, packs required JS, creates a new version.
# Usage (repo root, yc logged in):
#   pwsh cloud/ops/deploy-api.ps1

param(
    [string]$FunctionId = "d4ebp9rd7rd53iso4p8u",
    [int]$Concurrency = 4
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

Write-Host "Reading current function env (values not printed)..."
$listed = yc serverless function version list --function-id $FunctionId --limit 1 --format json | ConvertFrom-Json
$verId = @($listed)[0].id
if (-not $verId) { throw "No function versions" }
$full = yc serverless function version get --id $verId --format json | ConvertFrom-Json
$envMap = @{}
if ($full.environment) {
    $full.environment.PSObject.Properties | ForEach-Object { $envMap[$_.Name] = [string]$_.Value }
}
Write-Host ("Env keys: " + (($envMap.Keys | Sort-Object) -join ", "))

Write-Host "Building zip..."
Push-Location (Join-Path $root "cloud\api")
npm install --omit=dev
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed" }
$zip = Join-Path $root "cloud\rosmap-api-deploy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path index.js, sessionSecurity.js, mailTemplates.js, ydbDoc.js, package.json, package-lock.json, node_modules -DestinationPath $zip -Force
Pop-Location

$ycArgs = @(
    "serverless", "function", "version", "create",
    "--function-id", $FunctionId,
    "--runtime", "nodejs18",
    "--entrypoint", "index.handler",
    "--memory", "512m",
    "--execution-timeout", "30s",
    "--concurrency", "$Concurrency",
    "--source-path", $zip,
    "--format", "json"
)
$envMap["INTEGRITY_ALLOW_UNSIGNED"] = "0"
foreach ($k in ($envMap.Keys | Sort-Object)) {
    $ycArgs += @("--environment", "$k=$($envMap[$k])")
}

Write-Host "Creating function version..."
$outFile = Join-Path $env:TEMP "polevka-api-deploy.json"
& yc @ycArgs | Out-File -FilePath $outFile -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "yc deploy failed: $LASTEXITCODE" }
$created = Get-Content $outFile -Raw | ConvertFrom-Json
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Write-Host "id=$($created.id)"
Write-Host "status=$($created.status)"
Write-Host "runtime=$($created.runtime)"
