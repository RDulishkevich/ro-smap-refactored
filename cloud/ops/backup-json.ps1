# Daily / on-demand backup of RO.SMap databases
# 1) Always saves a local copy under cloud/backups/ (gitignored)
# 2) If cloud/api/.env has S3 keys — also uploads to s3://rosmap2026/backups/...
#
# Usage (Windows PowerShell):
#   powershell -ExecutionPolicy Bypass -File cloud/ops/backup-json.ps1

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bucket = 'rosmap2026'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$localDir = Join-Path $root "cloud\backups\$stamp"
New-Item -ItemType Directory -Path $localDir -Force | Out-Null

$publicFiles = @('map_data.json', 'profiles.json', 'mail.json', 'feed.json', 'events.json')
Write-Host "Local backup -> $localDir"

foreach ($file in $publicFiles) {
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $url = "https://storage.yandexcloud.net/$bucket/${file}?nocache=$ts"
    $out = Join-Path $localDir $file
    Write-Host "  download $file"
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}

# Optional cloud mirror + private auth backup via Node + .env keys
$envFile = Join-Path $root 'cloud\api\.env'
$nodeBackup = Join-Path $PSScriptRoot 'backup-upload.mjs'
if ((Test-Path $envFile) -and (Test-Path $nodeBackup) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Cloud mirror via service account keys..."
    & node $nodeBackup --stamp $stamp --local $localDir
} else {
    Write-Host "Skip cloud mirror (need cloud/api/.env + node)."
}

Write-Host "Done. Local files:"
Get-ChildItem $localDir | ForEach-Object { Write-Host ("  {0}  {1:N0} bytes" -f $_.Name, $_.Length) }
