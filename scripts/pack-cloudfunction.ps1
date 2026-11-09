# 打包境内云函数（零依赖，约 30 KB）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\pack-cloudfunction.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'cloudfunction.zip'
$stage = Join-Path $root '.tmp\cloudfunction'

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item (Join-Path $root 'shared') (Join-Path $stage 'shared') -Recurse
Copy-Item (Join-Path $root 'cloudbase') (Join-Path $stage 'cloudbase') -Recurse
Remove-Item (Join-Path $stage 'cloudbase\README.md') -ErrorAction SilentlyContinue

# 云函数包用 cloudbase/package.json（ESM），复制到包根目录
Copy-Item (Join-Path $root 'cloudbase\package.json') (Join-Path $stage 'package.json')

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -CompressionLevel Optimal

$kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host ""
Write-Host "[v] 已生成 $out ($kb KB)" -ForegroundColor Green
Write-Host "    上传到腾讯云开发 / SCF / 阿里云 FC 即可（入口 index.main）"
Write-Host ""
Write-Host "包内文件："
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead($out).Entries |
  ForEach-Object { "    {0}  ({1} bytes)" -f $_.FullName, $_.Length }
