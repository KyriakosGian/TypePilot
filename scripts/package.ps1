$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releasePath = Join-Path $projectPath 'release'
$manifest = Get-Content -Raw (Join-Path $projectPath 'manifest.json') | ConvertFrom-Json
$packageName = "TypePilot-v$($manifest.version).zip"
$packagePath = Join-Path $releasePath $packageName
$temporaryBase = [System.IO.Path]::GetTempPath()
$stagingPath = Join-Path $temporaryBase ('typepilot-release-' + [guid]::NewGuid().ToString('N'))
if (-not $stagingPath.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid release staging path' }
$runtimeFiles = @('background.js','content.js','editor-state.js','x-post.js','manifest.json','options.html','options.js','options.css','style.css','LICENSE','PRIVACY.md')
try {
  New-Item -ItemType Directory -Path $stagingPath | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stagingPath 'icons') | Out-Null
  foreach ($file in $runtimeFiles) { Copy-Item -LiteralPath (Join-Path $projectPath $file) -Destination $stagingPath }
  foreach ($size in @(16,32,48,128)) { Copy-Item -LiteralPath (Join-Path $projectPath "icons/icon$size.png") -Destination (Join-Path $stagingPath 'icons') }
  Copy-Item -LiteralPath (Join-Path $projectPath 'vendor') -Destination $stagingPath -Recurse
  Compress-Archive -Path (Join-Path $stagingPath '*') -DestinationPath $packagePath -CompressionLevel Optimal -Force
  $hash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
  $checksumFile = Join-Path $releasePath 'SHA256SUMS.txt'
  $oldEntries = @(Get-Content -LiteralPath $checksumFile -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch ([regex]::Escape($packageName) + '$') })
  $checksumLines = @($oldEntries; "$hash  $packageName")
  [System.IO.File]::WriteAllText($checksumFile, ($checksumLines -join "`n") + "`n", (New-Object System.Text.UTF8Encoding $false))
  Write-Output "$packageName $hash"
} finally {
  if (Test-Path -LiteralPath $stagingPath) {
    $resolvedStagingPath = (Resolve-Path -LiteralPath $stagingPath).Path
    if (-not $resolvedStagingPath.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe release cleanup path' }
    Remove-Item -LiteralPath $resolvedStagingPath -Recurse
  }
}
