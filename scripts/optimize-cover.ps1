# 把任意图片处理成"项目卡封面"：16:9 居中裁切 + 1600 宽 + 压缩
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\optimize-cover.ps1 -Source "C:\图片\a.png"
#   powershell -ExecutionPolicy Bypass -File scripts\optimize-cover.ps1 -Source "C:\图片" -Quality 3
#
# 输出：public/img/projects/<文件名>.jpg
#      然后在 projects.json 里写 "/img/projects/<文件名>.jpg"

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [int]$Width = 1600,
  [int]$Quality = 4          # ffmpeg -q:v，越小越清晰（2~5 合适）
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$ff = "C:\Users\okuki\AppData\Roaming\bilibili\ffmpeg\ffmpeg.exe"
if (-not (Test-Path $ff)) { $ff = "C:\Program Files\JianyingPro\Apps\5.7.0.11527\ffmpeg.exe" }
if (-not (Test-Path $ff)) { throw "找不到 ffmpeg，请先安装或改脚本里的路径" }

$outDir = Join-Path $root 'public\img\projects'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$files = @()
if (Test-Path $Source -PathType Container) {
  $files = Get-ChildItem $Source -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp|bmp)$' }
} else {
  $files = @(Get-Item $Source)
}
if (-not $files.Count) { throw "没有找到可处理的图片：$Source" }

foreach ($f in $files) {
  $name = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  $dest = Join-Path $outDir "$name.jpg"

  # 16:9 居中裁切 -> 缩放到目标宽度 -> 压 jpeg
  $vf = "crop='min(iw,ih*16/9)':'min(ih,iw*9/16)',scale=${Width}:-2:flags=lanczos"

  & $ff -y -hide_banner -loglevel error -i $f.FullName -vf $vf -q:v $Quality $dest 2>&1 | Out-Null
  if (Test-Path $dest) {
    $kb = [math]::Round((Get-Item $dest).Length / 1KB)
    $warn = if ($kb -gt 400) { "  ⚠ 偏大，试试 -Quality 6" } else { "" }
    Write-Host ("[v] {0,-40} -> {1}  ({2} KB){3}" -f $f.Name, "public/img/projects/$name.jpg", $kb, $warn) -ForegroundColor Green
  } else {
    Write-Host ("[x] 处理失败：{0}" -f $f.Name) -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "在 projects.json 里这样引用：" -ForegroundColor Cyan
Write-Host '  { "img": "/img/projects/你的文件名.jpg", ... }'
