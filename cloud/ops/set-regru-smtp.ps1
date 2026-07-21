# Set Reg.ru domain mailbox SMTP on Secure API (prompts for noreply password — do not paste into chat).
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File cloud/ops/set-regru-smtp.ps1
# If panel shows another SMTP host, pass: -SmtpHost mail.polevka.art

param(
    [string]$SmtpHost = "mail.hosting.reg.ru",
    [string]$SmtpUser = "noreply@polevka.art",
    [string]$SmtpPort = "465",
    [string]$MailFrom = "noreply@polevka.art",
    [string]$FunctionId = "d4ebp9rd7rd53iso4p8u"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

Write-Host "SMTP_HOST=$SmtpHost  SMTP_PORT=$SmtpPort  SMTP_USER=$SmtpUser  MAIL_FROM=$MailFrom"
$secure = Read-Host "Password for noreply@polevka.art" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $SmtpPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) | Out-Null
}
if (-not $SmtpPass) { throw "Empty password" }

Write-Host "Building zip..."
Push-Location (Join-Path $root "cloud\api")
npm install --omit=dev | Out-Null
$zip = Join-Path $root "cloud\rosmap-api-deploy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path index.js, mailTemplates.js, package.json, package-lock.json, node_modules -DestinationPath $zip -Force
Pop-Location

Write-Host "Reading current function env..."
$ver = (yc serverless function version list --function-id $FunctionId --limit 1 --format json | ConvertFrom-Json)[0]
$full = yc serverless function version get --id $ver.id --format json | ConvertFrom-Json
$envMap = @{}
if ($full.environment) {
    $full.environment.PSObject.Properties | ForEach-Object { $envMap[$_.Name] = [string]$_.Value }
}

$envMap["SMTP_HOST"] = $SmtpHost
$envMap["SMTP_PORT"] = $SmtpPort
$envMap["SMTP_USER"] = $SmtpUser
$envMap["SMTP_PASS"] = $SmtpPass
$envMap["MAIL_FROM"] = $MailFrom

$ycArgs = @(
    "serverless", "function", "version", "create",
    "--function-id", $FunctionId,
    "--runtime", "nodejs18",
    "--entrypoint", "index.handler",
    "--memory", "512m",
    "--execution-timeout", "30s",
    "--source-path", $zip
)
foreach ($k in ($envMap.Keys | Sort-Object)) {
    $ycArgs += @("--environment", "$k=$($envMap[$k])")
}

Write-Host "Deploying new version (password not printed)..."
& yc @ycArgs
if ($LASTEXITCODE -ne 0) { throw "yc deploy failed: $LASTEXITCODE" }

Remove-Item $zip -Force -ErrorAction SilentlyContinue
Write-Host "Done. Test: https://www.polevka.art cabinet -> send email code"
Write-Host "If send fails, check SMTP host in Reg.ru mail client settings and re-run with -SmtpHost ..."
