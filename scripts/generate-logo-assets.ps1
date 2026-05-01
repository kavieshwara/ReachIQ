Add-Type -AssemblyName System.Drawing

$logoDir = "D:\voice agent\reachiq\frontend\public\logo"
New-Item -ItemType Directory -Force -Path $logoDir | Out-Null

function New-GradientBrush([System.Drawing.RectangleF]$rect) {
  $start = [System.Drawing.ColorTranslator]::FromHtml("#6C63FF")
  $end = [System.Drawing.ColorTranslator]::FromHtml("#4B44CC")
  return New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $start, $end, 45)
}

function Draw-ReachIQIcon([System.Drawing.Graphics]$g, [float]$size, [float]$x = 0, [float]$y = 0) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $bubbleRect = New-Object System.Drawing.RectangleF($x + $size * 0.16, $y + $size * 0.06, $size * 0.74, $size * 0.78)
  $tail = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tail.AddPolygon(@(
      (New-Object System.Drawing.PointF($x + $size * 0.12, $y + $size * 0.70)),
      (New-Object System.Drawing.PointF($x + $size * 0.08, $y + $size * 0.94)),
      (New-Object System.Drawing.PointF($x + $size * 0.27, $y + $size * 0.82))
    ))

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radius = $size * 0.16
  $diameter = $radius * 2
  $path.AddArc($bubbleRect.X, $bubbleRect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($bubbleRect.Right - $diameter, $bubbleRect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($bubbleRect.Right - $diameter, $bubbleRect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($bubbleRect.X, $bubbleRect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $path.AddPath($tail, $true)

  $brush = New-GradientBrush($bubbleRect)
  $g.FillPath($brush, $path)

  $font = New-Object System.Drawing.Font("Segoe UI", $size * 0.42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $stringFormat = New-Object System.Drawing.StringFormat
  $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
  $letterRect = New-Object System.Drawing.RectangleF($x + $size * 0.30, $y + $size * 0.24, $size * 0.36, $size * 0.36)
  $g.DrawString("R", $font, [System.Drawing.Brushes]::White, $letterRect, $stringFormat)

  $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#00D9A6"))
  $g.FillEllipse($dotBrush, $x + $size * 0.74, $y + $size * 0.08, $size * 0.16, $size * 0.16)

  $font.Dispose()
  $stringFormat.Dispose()
  $brush.Dispose()
  $dotBrush.Dispose()
  $path.Dispose()
  $tail.Dispose()
}

function Save-IconPng([string]$path, [int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-ReachIQIcon $graphics $size 0 0
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-IconPng (Join-Path $logoDir "favicon-16x16.png") 16
Save-IconPng (Join-Path $logoDir "apple-touch-icon.png") 180
Save-IconPng (Join-Path $logoDir "icon-192.png") 192
Save-IconPng (Join-Path $logoDir "icon-512.png") 512

$iconBitmap = New-Object System.Drawing.Bitmap(64, 64)
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
$iconGraphics.Clear([System.Drawing.Color]::Transparent)
Draw-ReachIQIcon $iconGraphics 64 0 0
$icon = [System.Drawing.Icon]::FromHandle($iconBitmap.GetHicon())
$stream = [System.IO.File]::Open((Join-Path $logoDir "favicon.ico"), [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Dispose()
$iconGraphics.Dispose()
$iconBitmap.Dispose()

$logoBitmap = New-Object System.Drawing.Bitmap(1600, 520)
$logoGraphics = [System.Drawing.Graphics]::FromImage($logoBitmap)
$logoGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$logoGraphics.Clear([System.Drawing.Color]::White)
Draw-ReachIQIcon $logoGraphics 320 100 80
$reachBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1A1A2E"))
$iqBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#6C63FF"))
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#00D9A6"))
$font = New-Object System.Drawing.Font("Segoe UI", 150, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$logoGraphics.DrawString("reach", $font, $reachBrush, 520, 150)
$logoGraphics.DrawString("iq", $font, $iqBrush, 1175, 150)
$logoGraphics.FillEllipse($dotBrush, 1265, 118, 26, 26)
$logoBitmap.Save((Join-Path $logoDir "reachiq-logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose()
$reachBrush.Dispose()
$iqBrush.Dispose()
$dotBrush.Dispose()
$logoGraphics.Dispose()
$logoBitmap.Dispose()

@"
<svg width="1600" height="520" viewBox="0 0 1600 520" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="520" fill="white"/>
  <path d="M160 99C160 63.1015 189.102 34 225 34H486C521.899 34 551 63.1015 551 99V293C551 364.797 492.797 423 421 423H182L131 443L149.36 378.74C157.334 350.829 161.6 321.938 161.6 292.936V99Z" fill="url(#paint0_linear)"/>
  <path d="M242 136H354C423.347 136 466 171.26 466 231.74C466 281.26 434.91 314.66 378.02 323.58L472 414H393.86L310.14 332.7H297.64V414H242V136Z" fill="white"/>
  <circle cx="489" cy="95" r="39" fill="#00D9A6"/>
  <text x="618" y="327" fill="#1A1A2E" font-family="Inter, Segoe UI, sans-serif" font-size="222" font-weight="700">reach</text>
  <text x="1268" y="327" fill="#6C63FF" font-family="Inter, Segoe UI, sans-serif" font-size="222" font-weight="700">iq</text>
  <circle cx="1357" cy="142" r="13" fill="#00D9A6"/>
  <defs>
    <linearGradient id="paint0_linear" x1="131" y1="34" x2="551" y2="443" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6C63FF"/>
      <stop offset="1" stop-color="#4B44CC"/>
    </linearGradient>
  </defs>
</svg>
"@ | Set-Content -Path (Join-Path $logoDir "reachiq-logo.svg")

$ogBitmap = New-Object System.Drawing.Bitmap(1200, 630)
$ogGraphics = [System.Drawing.Graphics]::FromImage($ogBitmap)
$ogGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$ogGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0A0A0F"))

$cornerBrushOne = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(0, 0, 480, 320)), [System.Drawing.Color]::FromArgb(110, 108, 99, 255), [System.Drawing.Color]::FromArgb(0, 108, 99, 255), 45)
$cornerBrushTwo = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle(760, 320, 440, 310)), [System.Drawing.Color]::FromArgb(90, 0, 217, 166), [System.Drawing.Color]::FromArgb(0, 0, 217, 166), 225)
$ogGraphics.FillEllipse($cornerBrushOne, -120, -60, 520, 360)
$ogGraphics.FillEllipse($cornerBrushTwo, 850, 360, 420, 300)
Draw-ReachIQIcon $ogGraphics 150 130 150
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$tealTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#00D9A6"))
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#9898B8"))
$titleFont = New-Object System.Drawing.Font("Segoe UI", 82, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$ogGraphics.DrawString("reach", $titleFont, $whiteBrush, 305, 170)
$ogGraphics.DrawString("iq", $titleFont, $tealTextBrush, 618, 170)
$ogGraphics.DrawString("WhatsApp outreach for freelancers", $subtitleFont, $mutedBrush, 280, 310)
$ogBitmap.Save((Join-Path $logoDir "og-image.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$cornerBrushOne.Dispose()
$cornerBrushTwo.Dispose()
$whiteBrush.Dispose()
$tealTextBrush.Dispose()
$mutedBrush.Dispose()
$titleFont.Dispose()
$subtitleFont.Dispose()
$ogGraphics.Dispose()
$ogBitmap.Dispose()
