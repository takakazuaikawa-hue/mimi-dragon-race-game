# Ember Nocturne → 火山フィニッシュ race backdrop (GDI+), 1600x800.
Add-Type -AssemblyName System.Drawing
$W = 1600; $H = 800
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

function Col([int]$a, [int]$r, [int]$gg, [int]$b) { [System.Drawing.Color]::FromArgb($a, $r, $gg, $b) }
function Glow($gr, $cx, $cy, $rad, $baseA, $cr, $cg, $cb2, $layers) {
  # smooth radial glow via PathGradientBrush (no banding)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddEllipse(($cx - $rad), ($cy - $rad), (2 * $rad), (2 * $rad))
  $pg = New-Object System.Drawing.Drawing2D.PathGradientBrush $p
  $pg.CenterColor = (Col $baseA $cr $cg $cb2)
  $pg.SurroundColors = @((Col 0 $cr $cg $cb2))
  $blend = New-Object System.Drawing.Drawing2D.Blend 3
  $blend.Positions = @(0.0, 0.55, 1.0)   # 0 = outer edge, 1 = center
  $blend.Factors = @(0.0, 0.12, 1.0)     # bright concentrated core, soft falloff
  $pg.Blend = $blend
  $gr.FillEllipse($pg, ($cx - $rad), ($cy - $rad), (2 * $rad), (2 * $rad))
  $pg.Dispose(); $p.Dispose()
}

# --- sky: cold teal night bleeding to ember at the horizon ---
$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rect, ([System.Drawing.Color]::Black), ([System.Drawing.Color]::Black), 90
$cb = New-Object System.Drawing.Drawing2D.ColorBlend 5
$cb.Colors = @((Col 255 11 26 46), (Col 255 18 37 56), (Col 255 42 34 54), (Col 255 92 44 34), (Col 255 48 21 15))
$cb.Positions = @(0.0, 0.45, 0.72, 0.9, 1.0)
$lg.InterpolationColors = $cb
$g.FillRectangle($lg, $rect)

# --- stars (upper sky, fading toward horizon) ---
$rand = New-Object System.Random 7
for ($i = 0; $i -lt 150; $i++) {
  $x = $rand.Next(0, $W); $y = $rand.Next(0, 440)
  $fade = 1.0 - ($y / 520.0)
  $a = [int]((40 + $rand.Next(0, 150)) * $fade)
  if ($a -lt 8) { continue }
  $s = 1 + $rand.NextDouble() * 1.8
  $br = New-Object System.Drawing.SolidBrush (Col $a 220 230 245)
  $g.FillEllipse($br, $x, $y, $s, $s); $br.Dispose()
}

# --- moon, top-right, soft halo ---
Glow $g 1240 150 150 70 255 247 224 7
$mb = New-Object System.Drawing.SolidBrush (Col 236 255 247 224)
$g.FillEllipse($mb, (1240 - 44), (150 - 44), 88, 88); $mb.Dispose()
$ms = New-Object System.Drawing.SolidBrush (Col 26 200 180 150)
$g.FillEllipse($ms, (1240 - 30), (150 - 36), 48, 48); $ms.Dispose()

# --- broad ember glow along the horizon, around the volcano base ---
Glow $g 540 562 430 86 255 110 40 8

# --- layered ridge silhouettes (far -> near, cooler -> darker) ---
function Ridge($gr, $baseY, $amp, $seed, $a, $cr, $cg, $cb2) {
  $r2 = New-Object System.Random $seed
  $arr = @()
  $arr += [System.Drawing.PointF]::new(0, $H)
  $x = 0
  while ($x -le $W) {
    $y = $baseY - [math]::Sin($x * 0.004 + $seed) * $amp - $r2.Next(0, [int]$amp)
    $arr += [System.Drawing.PointF]::new($x, $y)
    $x += 40
  }
  $arr += [System.Drawing.PointF]::new($W, $H)
  $br = New-Object System.Drawing.SolidBrush (Col $a $cr $cg $cb2)
  $gr.FillPolygon($br, [System.Drawing.PointF[]]$arr)
  $br.Dispose()
}
Ridge $g 538 26 11 210 16 26 42
Ridge $g 550 30 23 226 14 22 34
Ridge $g 560 34 31 244 11 15 22

# --- volcano cone (off-center left) ---
$vx = 540; $vbase = 560; $vpeak = 332; $vhw = 230
$vpts = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(($vx - $vhw), $vbase),
  [System.Drawing.PointF]::new(($vx - 18), ($vpeak + 4)),
  [System.Drawing.PointF]::new(($vx + 18), ($vpeak + 4)),
  [System.Drawing.PointF]::new(($vx + $vhw), $vbase))
$vb = New-Object System.Drawing.SolidBrush (Col 255 22 13 12)
$g.FillPolygon($vb, $vpts); $vb.Dispose()
$fpts = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(($vx + 4), ($vpeak + 4)),
  [System.Drawing.PointF]::new(($vx + 18), ($vpeak + 4)),
  [System.Drawing.PointF]::new(($vx + $vhw), $vbase),
  [System.Drawing.PointF]::new(($vx + $vhw * 0.4), $vbase))
$fb = New-Object System.Drawing.SolidBrush (Col 55 120 50 34)
$g.FillPolygon($fb, $fpts); $fb.Dispose()

# --- smoke plume (behind glow/embers) ---
$rs = New-Object System.Random 55
for ($i = 0; $i -lt 16; $i++) {
  $ph = $i / 16.0
  $sy = ($vpeak + 6) - $ph * 215
  $sx = $vx + $ph * 120 + ($rs.NextDouble() - 0.5) * 30
  $sr = 24 + $ph * 72
  $a = [int]((1 - $ph) * 52) + 8
  $br = New-Object System.Drawing.SolidBrush (Col $a 46 42 52)
  $g.FillEllipse($br, ($sx - $sr), ($sy - $sr), (2 * $sr), (2 * $sr)); $br.Dispose()
}

# --- crater glow ---
Glow $g $vx ($vpeak + 6) 72 220 255 150 50 7
Glow $g $vx ($vpeak + 6) 34 235 255 235 150 5

# --- lava flows down the flanks ---
$pen = New-Object System.Drawing.Pen ((Col 205 255 110 40), 4)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawCurve($pen, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(($vx - 6), ($vpeak + 14)),
    [System.Drawing.PointF]::new(($vx - 46), ($vpeak + 96)),
    [System.Drawing.PointF]::new(($vx - 118), ($vbase - 6))))
$g.DrawCurve($pen, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(($vx + 6), ($vpeak + 14)),
    [System.Drawing.PointF]::new(($vx + 50), ($vpeak + 92)),
    [System.Drawing.PointF]::new(($vx + 120), ($vbase - 8))))
$pen.Dispose()
$pen2 = New-Object System.Drawing.Pen ((Col 210 255 214 140), 1.6)
$g.DrawCurve($pen2, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(($vx - 6), ($vpeak + 14)),
    [System.Drawing.PointF]::new(($vx - 46), ($vpeak + 96)),
    [System.Drawing.PointF]::new(($vx - 118), ($vbase - 6))))
$pen2.Dispose()

# --- rising embers ---
$re = New-Object System.Random 99
for ($i = 0; $i -lt 48; $i++) {
  $ph = $re.NextDouble()
  $ey = ($vpeak + 6) - $ph * 155
  $ex = $vx + ([math]::Sin($i * 2.1)) * 30 * $ph + ($re.NextDouble() - 0.5) * 30
  $a = [int]((1 - $ph) * 225)
  if ($a -lt 10) { continue }
  $s = 2.6 * (1 - $ph * 0.4)
  $cc = 255 - [int]($ph * 120)
  $br = New-Object System.Drawing.SolidBrush (Col $a 255 $cc 60)
  $g.FillEllipse($br, $ex, $ey, $s, $s); $br.Dispose()
}

# --- lower haze: keep the track zone dark + uncluttered ---
$rect2 = New-Object System.Drawing.Rectangle 0, 540, $W, 260
$lg2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rect2, ([System.Drawing.Color]::Black), ([System.Drawing.Color]::Black), 90
$cb2 = New-Object System.Drawing.Drawing2D.ColorBlend 3
$cb2.Colors = @((Col 0 8 11 18), (Col 120 7 9 14), (Col 215 6 8 12))
$cb2.Positions = @(0.0, 0.5, 1.0)
$lg2.InterpolationColors = $cb2
$g.FillRectangle($lg2, $rect2)

# --- vignette: settle the corners ---
$vpath = New-Object System.Drawing.Drawing2D.GraphicsPath
$vpath.AddEllipse(-220, -140, ($W + 440), ($H + 380))
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $vpath
$pgb.CenterColor = (Col 0 0 0 0)
$pgb.SurroundColors = @((Col 150 4 7 12))
$g.FillRectangle($pgb, 0, 0, $W, $H)
$pgb.Dispose(); $vpath.Dispose()

$out = "C:\Users\takakazu\OneDrive\Documents\mimi_dragon_race_game\images\racebg\fire_src.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved $out"
