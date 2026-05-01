param(
  [string]$AppName = "reachiq-web-kaviesh",
  [string]$FlyCtlPath = "$env:USERPROFILE\.fly\bin\flyctl.exe",
  [string]$ProjectRoot = "D:\voice agent\reachiq",
  [string]$ApiUrl = "https://reachiq-api-kaviesh.fly.dev",
  [string]$AppUrl = "https://reachiq-web-kaviesh.fly.dev"
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

Push-Location (Join-Path $ProjectRoot "frontend")
try {
  $envMap = Get-EnvMap (Join-Path $PWD ".env.local")

  Ensure-App -Name $AppName

  & $FlyCtlPath deploy `
    --remote-only `
    --config fly.toml `
    --build-arg "NEXT_PUBLIC_SUPABASE_URL=$($envMap["NEXT_PUBLIC_SUPABASE_URL"])" `
    --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$($envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"])" `
    --build-arg "NEXT_PUBLIC_API_URL=$ApiUrl" `
    --build-arg "NEXT_PUBLIC_APP_URL=$AppUrl"
} finally {
  Pop-Location
}
