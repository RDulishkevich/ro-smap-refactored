# Raise Cloud Function scale so ~100 concurrent writers/readers are not queued off.
# Default Yandex quota is often a handful of instances — if this command is rejected,
# ask support to raise serverless.instance.count / serverless.request.count, then rerun.
#
# Usage (from repo root, yc logged in):
#   pwsh cloud/ops/set-scale-policy.ps1

param(
    [string]$FunctionId = "d4ebp9rd7rd53iso4p8u",
    [int]$ZoneInstances = 16,
    [int]$ZoneRequests = 64
)

$ErrorActionPreference = "Stop"

Write-Host "Scaling $FunctionId  zone-instances=$ZoneInstances  zone-requests=$ZoneRequests"
yc serverless function set-scaling-policy `
  --id $FunctionId `
  --tag '$latest' `
  --zone-instances-limit $ZoneInstances `
  --zone-requests-limit $ZoneRequests

Write-Host "Next: new versions should use --concurrency 4 (Node 18+) so one instance handles several calls."
Write-Host "If yc says quota exceeded, raise it in the cloud console, then rerun this script."
