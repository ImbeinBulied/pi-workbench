param(
  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\PiWorkbench\bin'),
  [switch]$SkipDependencies,
  [switch]$NoPath
)
$ErrorActionPreference = 'Stop'
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) { throw 'Bun is required. Install Bun 1.3.14+ from https://bun.sh, then rerun this script.' }
$bunVersionText = (& bun --version).Trim()
if ($LASTEXITCODE -ne 0 -or [version]($bunVersionText.Split('-')[0]) -lt [version]'1.3.14') { throw 'Bun 1.3.14+ is required.' }
if (-not $SkipDependencies) {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is required to restore package-lock.json. Install Node.js, then rerun this script.' }
  Push-Location $PSScriptRoot
  try {
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. No launcher or PATH changes were made.' }
  } finally { Pop-Location }
}
$destination = [IO.Path]::GetFullPath($InstallDirectory)
$source = Join-Path $PSScriptRoot 'piw.cmd'
$shim = Join-Path $destination 'piw.cmd'
if ([string]::Equals($source, $shim, [StringComparison]::OrdinalIgnoreCase)) { throw 'Choose an InstallDirectory outside the source checkout.' }
$null = New-Item -ItemType Directory -Force -Path $destination
$escapedSource = $source.Replace('%', '%%')
[IO.File]::WriteAllText($shim, "@echo off`r`ncall `"$escapedSource`" %*`r`nexit /b %errorlevel%", [Text.UTF8Encoding]::new($false))
if (-not $NoPath) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $entries = @($userPath -split ';' | Where-Object { $_ })
  $alreadyAdded = @($entries | Where-Object { $_.TrimEnd('\') -ieq $destination.TrimEnd('\') }).Count -gt 0
  if (-not $alreadyAdded) {
    [Environment]::SetEnvironmentVariable('Path', (($entries + $destination) -join ';'), 'User')
  }
  if (-not (@($env:Path -split ';') -contains $destination)) { $env:Path = $env:Path.TrimEnd(';') + ';' + $destination }
}
Write-Output "Installed launcher: $shim"
Write-Output 'Keep this checkout in place. Open a new terminal, then run piw doctor and piw from your project folder.'
