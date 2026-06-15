# serve.ps1 - local dev static server (preview only; NOT used by GitHub Pages).
# Robustness fixes (preview freeze / screenshot timeout):
#  - Range (206 Partial) support so audio/video seeking does not abort.
#  - Always try/catch the write so a client abort never leaves a half-open response
#    (the browser reaches 'load' -> screenshots work).
#  - Wider MIME map (.webp/.mp3/.m4a/.woff2 ...) + percent-decoded URL (Japanese filenames).
#  - KeepAlive off + no-cache to avoid hung connections / stale cache.
#  - Errors are logged only; the while loop keeps running (one bad request never kills the server).
# NOTE: keep this file ASCII-only. PowerShell 5.1 misreads non-BOM UTF-8 as CP932,
#       and multibyte comment bytes can corrupt code lines. Comments must be English.
$port = 8766
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port (robust: range/abort-safe/mime)"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".mjs"  = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".gif"  = "image/gif"
  ".svg"  = "image/svg+xml; charset=utf-8"
  ".ico"  = "image/x-icon"
  ".mp3"  = "audio/mpeg"
  ".m4a"  = "audio/mp4"
  ".ogg"  = "audio/ogg"
  ".wav"  = "audio/wav"
  ".mp4"  = "video/mp4"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".ttf"  = "font/ttf"
  ".txt"  = "text/plain; charset=utf-8"
  ".md"   = "text/plain; charset=utf-8"
}

while ($listener.IsListening) {
  $ctx = $null
  try { $ctx = $listener.GetContext() } catch { break }
  try {
    $req = $ctx.Request
    $res = $ctx.Response
    $res.KeepAlive = $false
    $res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    $res.AddHeader("Access-Control-Allow-Origin", "*")

    $path = [System.Uri]::UnescapeDataString($req.Url.LocalPath)
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root ($path.TrimStart("/"))

    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $total = $bytes.Length
      $res.ContentType = $ct
      $res.AddHeader("Accept-Ranges", "bytes")

      $start = 0; $len = $total
      $range = $req.Headers["Range"]
      if ($range -and ($range -match "bytes=(\d*)-(\d*)")) {
        $rs = $matches[1]; $re = $matches[2]
        $s = if ($rs -ne "") { [int]$rs } else { 0 }
        $e = if ($re -ne "") { [int]$re } else { $total - 1 }
        if ($e -ge $total) { $e = $total - 1 }
        if ($s -ge 0 -and $s -le $e) {
          $start = $s; $len = ($e - $s + 1)
          $res.StatusCode = 206
          $res.AddHeader("Content-Range", "bytes $s-$e/$total")
        }
      }
      $res.ContentLength64 = $len
      try { if ($len -gt 0) { $res.OutputStream.Write($bytes, $start, $len) } } catch {}
    } else {
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.StatusCode = 404
      $res.ContentType = "text/plain; charset=utf-8"
      $res.ContentLength64 = $msg.Length
      try { $res.OutputStream.Write($msg, 0, $msg.Length) } catch {}
    }
    try { $res.OutputStream.Close() } catch {}
  } catch {
    Write-Host "Error: $_"
    try { $ctx.Response.Abort() } catch {}
  }
}
