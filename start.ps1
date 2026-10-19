param([string]$Project = (Get-Location).Path, [switch]$Demo, [string]$Session)
$entry = Join-Path $PSScriptRoot 'src/main.ts'
$launchArgs = @($entry, (Resolve-Path -LiteralPath $Project).Path)
if ($Demo) { $launchArgs += '--demo' }
if ($Session) { $launchArgs += @('--session', (Resolve-Path -LiteralPath $Session).Path) }
& bun @launchArgs
exit $LASTEXITCODE
