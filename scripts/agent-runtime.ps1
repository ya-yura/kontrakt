param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("show", "verify-web", "verify-api")]
  [string]$Command
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $root ".agent-state/runtime-status.json"

if (!(Test-Path $statePath)) {
  Write-Error "Missing .agent-state/runtime-status.json"
}

$state = Get-Content -Raw -Encoding UTF8 $statePath | ConvertFrom-Json

function Test-ServiceUrl {
  param([string]$Name)

  $service = $state.services.$Name
  if ($null -eq $service -or [string]::IsNullOrWhiteSpace($service.url)) {
    Write-Output "$Name: no URL recorded"
    return
  }

  try {
    $response = Invoke-WebRequest -Uri $service.url -UseBasicParsing -TimeoutSec 5
    Write-Output "$Name: OK $($response.StatusCode) $($service.url)"
  } catch {
    Write-Output "$Name: FAILED $($service.url) - $($_.Exception.Message)"
  }
}

switch ($Command) {
  "show" {
    $state.services | ConvertTo-Json -Depth 10
  }
  "verify-web" {
    Test-ServiceUrl -Name "web"
  }
  "verify-api" {
    Test-ServiceUrl -Name "api"
  }
}

