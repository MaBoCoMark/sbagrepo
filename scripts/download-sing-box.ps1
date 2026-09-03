# PowerShell script to download official sing-box binary for Windows x64
$ErrorActionPreference = "Stop"

$repo = "SagerNet/sing-box"
$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
$version = $latestRelease.tag_name
if (-not $version) {
    $version = "v1.10.1"
}
$rawVersion = $version.TrimStart('v')

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetDir = Resolve-Path "$scriptDir\..\src-tauri\binaries"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
}

$zipName = "sing-box-$rawVersion-windows-amd64.zip"
$downloadUrl = "https://github.com/$repo/releases/download/$version/$zipName"
$tempZip = Join-Path $env:TEMP $zipName
$tempExtract = Join-Path $env:TEMP "singbox-extract"

Write-Host "Downloading sing-box $version for Windows x64..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip

if (Test-Path $tempExtract) {
    Remove-Item -Recurse -Force $tempExtract
}
Expand-Archive -Path $tempZip -DestinationPath $tempExtract

$singBoxExe = Get-ChildItem -Path $tempExtract -Recurse -Filter "sing-box.exe" | Select-Object -First 1
if ($singBoxExe) {
    $destination = Join-Path $targetDir "sing-box-x86_64-pc-windows-msvc.exe"
    Copy-Item -Path $singBoxExe.FullName -Destination $destination -Force
    Write-Host "✅ Successfully placed sing-box binary at: $destination" -ForegroundColor Green
} else {
    Write-Error "Failed to find sing-box.exe in extracted archive."
}

Remove-Item -Force $tempZip
Remove-Item -Recurse -Force $tempExtract
