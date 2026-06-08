// =====================================================================
// L2_UTIL — shared math / colour / DOM helpers for the Live2D-like tool.
// Mirrors the conventions of the game's utils.js + race_canvas.js so the
// tool feels native (single global object, prefixed free functions).
// =====================================================================
const L2_UTIL = (function () {
  // ---- DOM (same flavour as the game's el()/$ helpers) ----
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  // ---- math ----
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }            // smoothstep
  function easeOutCubic(t) { const u = 1 - t; return 1 - u * u * u; }

  // Deterministic per-id phase desync — lifted from race_canvas.js dragonPhase().
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function phaseOf(id) { return ((hashStr(String(id)) % 997) / 997) * Math.PI * 2; }

  // ---- colour (ported from race_canvas.js _rcHexRgb/_rcRgbHex/rcShade) ----
  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgbHex(r, g, b) { const f = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); return '#' + f(r) + f(g) + f(b); }
  function shade(hex, amt) { const c = hexRgb(hex); return rgbHex(c[0] + amt, c[1] + amt, c[2] + amt); }
  function rgba(hex, a) { const c = hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // ---- point-in-polygon (even-odd, ported from race_canvas.js _rcInPoly) ----
  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ---- file download (single JSON or blob) ----
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime || 'application/json' }), filename);
  }

  // ---- image loading (dataURL / File → HTMLImageElement) ----
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed: ' + String(src).slice(0, 64)));
      img.src = src;
    });
  }
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('file read failed'));
      r.readAsDataURL(file);
    });
  }

  // Round a number to a fixed number of decimals for deterministic JSON output.
  function r2(v) { return Math.round(v * 100) / 100; }
  function ri(v) { return Math.round(v); }

  return {
    el, $, clear, clamp, lerp, ease, easeOutCubic, hashStr, phaseOf,
    hexRgb, rgbHex, shade, rgba, inPoly, downloadBlob, downloadText,
    loadImage, fileToDataURL, r2, ri
  };
})();
