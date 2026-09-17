param(
  [Alias('Web2ExeRoot')]
  [string]$Web2AppRoot,
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $projectRoot 'dist'
$artifactDirectory = Join-Path $projectRoot 'artifacts'
$iconPath = Join-Path $projectRoot 'assets\wechat-article-formatter.ico'
$outputPath = if ($OutputPath) {
  if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath }
  else { Join-Path $projectRoot $OutputPath }
} else {
  Join-Path $artifactDirectory 'wechat-article-formatter.exe'
}

if (-not $Web2AppRoot) {
  $configuredRoot = [Environment]::GetEnvironmentVariable('LW_WEB2APP_ROOT')
  $workspaceParent = Split-Path -Parent $projectRoot
  $rootCandidates = @(
    $configuredRoot,
    (Join-Path $workspaceParent 'lw.Web2App'),
    (Join-Path $workspaceParent 'lw.Web2Exe'),
    (Join-Path $workspaceParent 'ChatGPT\lw.Web2App'),
    (Join-Path $workspaceParent 'ChatGPT\lw.Web2Exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  $Web2AppRoot = $rootCandidates | Select-Object -First 1
}

if (-not $Web2AppRoot) {
  throw 'lw.Web2App root was not found. Pass -Web2AppRoot or set LW_WEB2APP_ROOT.'
}

$packerCandidates = @(
  (Join-Path $Web2AppRoot 'lw.Web2App.exe'),
  (Join-Path $Web2AppRoot 'build-ninja\lw.Web2App.exe'),
  (Join-Path $Web2AppRoot 'build-local-windows-ninja\lw.Web2App.exe'),
  (Join-Path $Web2AppRoot 'build\Release\lw.Web2App.exe')
)
$packer = $packerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $packer) { throw "lw.Web2App.exe was not found under $Web2AppRoot" }
if (-not (Test-Path -LiteralPath (Join-Path $sourceDirectory 'index.html'))) {
  throw 'Build output not found. Run npm run build first.'
}
if (-not (Test-Path -LiteralPath $iconPath)) { throw "Icon asset not found: $iconPath" }

$packageVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$numericVersion = ($packageVersion -split '[+-]')[0]
$versionParts = @($numericVersion -split '\.')
while ($versionParts.Count -lt 4) { $versionParts += '0' }
$peVersion = ($versionParts[0..3] -join '.')
$copyright = "Copyright © $((Get-Date).Year) 天天代码码天天"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null
if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Force }

$packArguments = @(
  'pack', $sourceDirectory, $outputPath,
  '--entry', 'index.html',
  '--title', '公众号排版助手',
  '--product-name', '公众号排版助手',
  '--file-description', '"微信公众号文章 Markdown 排版与发布工具"',
  '--app-id', 'com.lxw.wechat.article.formatter',
  '--width', '1440',
  '--height', '900',
  '--windowed',
  '--external-links', 'browser',
  '--icon', $iconPath,
  '--company', '天天代码码天天',
  '--version', $peVersion,
  '--copyright', "`"$copyright`""
)

$pack = Start-Process -FilePath $packer -Wait -PassThru -NoNewWindow -ArgumentList $packArguments
if ($pack.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) {
  throw "lw.Web2App packaging failed with exit code $($pack.ExitCode)"
}

$versionInfo = (Get-Item -LiteralPath $outputPath).VersionInfo
$expectedMetadata = @{
  ProductName = '公众号排版助手'
  FileDescription = '微信公众号文章 Markdown 排版与发布工具'
  CompanyName = '天天代码码天天'
  FileVersion = $peVersion
  ProductVersion = $peVersion
  LegalCopyright = $copyright
}
foreach ($field in $expectedMetadata.Keys) {
  if ($versionInfo.$field -ne $expectedMetadata[$field]) {
    throw "PE metadata mismatch for ${field}: '$($versionInfo.$field)'"
  }
}

$inspect = Start-Process -FilePath $packer -Wait -PassThru -NoNewWindow -ArgumentList @('inspect', $outputPath)
if ($inspect.ExitCode -ne 0) { throw "lw.Web2App inspection failed with exit code $($inspect.ExitCode)" }

Get-Item -LiteralPath $outputPath | Select-Object FullName, Length, LastWriteTime
