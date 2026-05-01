param(
  [string]$AppName = "reachiq-api-kaviesh",
  [string]$Region = "bom",
  [string]$FlyCtlPath = "$env:USERPROFILE\.fly\bin\flyctl.exe",
  [string]$ProjectRoot = "D:\voice agent\reachiq"
)

$ErrorActionPreference = "Stop"

function Get-EnvMap {
  param([string]$Path)

  $envMap = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $parts = $line.Split("=", 2)
    $envMap[$parts[0].Trim()] = $parts[1]
  }

  return $envMap
}

function Ensure-App {
  param([string]$Name)

  try {
    & $FlyCtlPath status --app $Name 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
      return
    }
  } catch {
    # continue and try to create
  }

  try {
    & $FlyCtlPath apps create $Name
  } catch {
    if ($_.Exception.Message -notmatch "already exists") {
      throw
    }
  }
}

Push-Location (Join-Path $ProjectRoot "backend")
try {
  $envMap = Get-EnvMap (Join-Path $PWD ".env")

  Ensure-App -Name $AppName

  $volumeExists = $false
  try {
    $volumes = & $FlyCtlPath volumes list --app $AppName --json 2>$null | ConvertFrom-Json
    $volumeExists = [bool]($volumes | Where-Object { $_.Name -eq "reachiqdata" })
  } catch {
    $volumeExists = $false
  }

  if (-not $volumeExists) {
    & $FlyCtlPath volumes create reachiqdata --app $AppName --region $Region --size 3
  }

  $secretKeys = @(
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "WHATSAPP_API_VERSION",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_CREDENTIAL_SECRET",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "UPSTASH_REDIS_URL",
    "UPSTASH_REDIS_TOKEN",
    "RESEND_API_KEY",
    "SUPPORT_INBOX_EMAIL",
    "SUPPORT_CONTACT_EMAIL",
    "RESEND_FROM_EMAIL",
    "SERPER_API_KEY",
    "OUTSCRAPER_API_KEY"
  )

  $secretArgs = @()
  foreach ($key in $secretKeys) {
    $value = $envMap[$key]
    if ($value) {
      $secretArgs += "$key=$value"
    }
  }

  if ($secretArgs.Count -gt 0) {
    & $FlyCtlPath secrets set --app $AppName @secretArgs
  }

  & $FlyCtlPath deploy --remote-only --config fly.toml
} finally {
  Pop-Location
}
