# ============================================================================
# 把「Wallpaper Engine 当前正在显示的壁纸」同步进这个站点
# ----------------------------------------------------------------------------
# 用法（在项目根目录）：  powershell -ExecutionPolicy Bypass -File scripts\sync-wallpaper.ps1
#
# 原理：Wallpaper Engine 会把当前壁纸写一份到注册表
#   HKCU\Control Panel\Desktop  ->  WallPaper
# 这个值通常指向 ...\Themes\WallpaperEngineOverride_xxx.jpg
# 网页（部署到 Vercel 后）没法实时读取本机壁纸，所以做成"手动/定时同步一次"。
# ============================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root 'public\img\wallpaper\okuki'
$dest = Join-Path $destDir 'image.jpg'
$preview = Join-Path $destDir 'image-pre.jpg'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

# 1) 找当前壁纸
$src = $null
try {
    $src = (Get-ItemProperty 'HKCU:\Control Panel\Desktop' -Name WallPaper -ErrorAction Stop).WallPaper
} catch {
    $src = $null
}

if (-not $src -or -not (Test-Path $src)) {
    Write-Host "[x] 没读到当前壁纸。可能 Wallpaper Engine 没在跑，或壁纸是动态的（动态壁纸不会生成静态图）。" -ForegroundColor Red
    Write-Host "    当前注册表值：$src"
    exit 1
}

$info = Get-Item $src
Write-Host "[1/3] 当前壁纸：$($info.FullName)"
Write-Host "      $([math]::Round($info.Length/1KB)) KB"

# 2) 拷贝原图
Copy-Item $info.FullName $dest -Force
Write-Host "[2/3] 已写入：public\img\wallpaper\okuki\image.jpg"

# 3) 生成 720 宽的缩略图（壁纸选择器用）
$img = [System.Drawing.Image]::FromFile($dest)
$w = 720
$h = [int]($img.Height * $w / $img.Width)
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $w, $h)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 82L)
$bmp.Save($preview, $codec, $params)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Host "[3/3] 已生成缩略图：public\img\wallpaper\okuki\image-pre.jpg"

Write-Host ""
Write-Host "[v] 完成。刷新页面即可看到新壁纸。" -ForegroundColor Green
Write-Host "    如果之前在页面的设置里手动换过壁纸，可能被 cookie 记住了："
Write-Host "    按 F12 → Application → Cookies → 删掉 leleodatabackground，再刷新。"
