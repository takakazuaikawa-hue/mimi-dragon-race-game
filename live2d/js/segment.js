// =====================================================================
// L2_SEG — image segmentation toolkit (no ML, no deps). Works on a single
// full-resolution RGBA buffer + a 1-byte/pixel mask (0 / 255).
// Tools: alpha threshold, magic-wand flood fill, rect / lasso / brush, plus
// connected-components for already-disconnected parts, and refinement ops
// (grow/shrink/fillHoles/removeSpecks/keepLargest) with undo/redo.
// =====================================================================
const L2_SEG = (function () {
  function fromImage(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: id.data };  // data = Uint8ClampedArray RGBA
  }

  function newMask(w, h) { return new Uint8Array(w * h); }
  function cloneMask(m) { return m.slice(); }

  // ----- undo/redo history (per active mask) -----
  function History(limit) { this.limit = limit || 24; this.stack = []; this.idx = -1; }
  History.prototype.snapshot = function (mask) {
    this.stack = this.stack.slice(0, this.idx + 1);
    this.stack.push(cloneMask(mask));
    if (this.stack.length > this.limit) this.stack.shift();
    this.idx = this.stack.length - 1;
  };
  History.prototype.undo = function () { if (this.idx > 0) { this.idx--; return cloneMask(this.stack[this.idx]); } return null; };
  History.prototype.redo = function () { if (this.idx < this.stack.length - 1) { this.idx++; return cloneMask(this.stack[this.idx]); } return null; };
  History.prototype.canUndo = function () { return this.idx > 0; };
  History.prototype.canRedo = function () { return this.idx < this.stack.length - 1; };

  function applyMode(mask, i, mode) {
    if (mode === 'subtract') mask[i] = 0;
    else mask[i] = 255;                 // add / replace both set; replace clears first (caller).
  }

  // alpha >= alphaMin → mask. mode add/subtract/replace.
  function alphaThreshold(src, mask, alphaMin, mode) {
    if (mode === 'replace') mask.fill(0);
    const d = src.data;
    for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
      if (d[p] >= alphaMin) applyMode(mask, i, mode || 'add');
    }
    return mask;
  }

  // Magic-wand flood fill from (sx,sy): 4-neighbour BFS, RGB(+a) distance <= tol.
  function floodFill(src, mask, sx, sy, tol, mode) {
    const w = src.w, h = src.h, d = src.data;
    sx |= 0; sy |= 0;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return mask;
    const si = (sy * w + sx) * 4;
    const sr = d[si], sg = d[si + 1], sb = d[si + 2], sa = d[si + 3];
    const tol2 = tol * tol * 3;                 // compare squared distance over 3 channels
    const seen = new Uint8Array(w * h);
    const stack = [sy * w + sx];
    const sub = mode === 'subtract';
    while (stack.length) {
      const idx = stack.pop();
      if (seen[idx]) continue; seen[idx] = 1;
      const p = idx * 4;
      const dr = d[p] - sr, dg = d[p + 1] - sg, db = d[p + 2] - sb;
      const da = (d[p + 3] - sa);
      if (dr * dr + dg * dg + db * db > tol2 || da * da > tol * tol * 4) continue;
      mask[idx] = sub ? 0 : 255;
      const x = idx % w, y = (idx / w) | 0;
      if (x > 0) stack.push(idx - 1);
      if (x < w - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - w);
      if (y < h - 1) stack.push(idx + w);
    }
    return mask;
  }

  function rectMask(mask, w, h, x, y, rw, rh, mode) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(w, (x + rw) | 0), y1 = Math.min(h, (y + rh) | 0);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) applyMode(mask, yy * w + xx, mode || 'add');
    return mask;
  }

  // polygon fill via even-odd scanline (uses L2_UTIL.inPoly per-pixel within bbox)
  function lassoMask(mask, w, h, pts, mode) {
    if (pts.length < 3) return mask;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (const pt of pts) { minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]); maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]); }
    minX = Math.max(0, minX | 0); minY = Math.max(0, minY | 0); maxX = Math.min(w - 1, maxX | 0); maxY = Math.min(h - 1, maxY | 0);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (L2_UTIL.inPoly(x + 0.5, y + 0.5, pts)) applyMode(mask, y * w + x, mode || 'add');
    }
    return mask;
  }

  function brush(mask, w, h, cx, cy, r, mode) {
    const x0 = Math.max(0, (cx - r) | 0), y0 = Math.max(0, (cy - r) | 0);
    const x1 = Math.min(w - 1, (cx + r) | 0), y1 = Math.min(h - 1, (cy + r) | 0);
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) applyMode(mask, y * w + x, mode || 'add');
    }
    return mask;
  }

  function subtractMask(mask, other) { for (let i = 0; i < mask.length; i++) if (other[i]) mask[i] = 0; return mask; }

  // ----- morphology / cleanup (4-neighbour) -----
  function grow(mask, w, h, iters) {
    for (let it = 0; it < (iters || 1); it++) {
      const src = cloneMask(mask);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (src[i]) continue;
        if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) mask[i] = 255;
      }
    }
    return mask;
  }
  function shrink(mask, w, h, iters) {
    for (let it = 0; it < (iters || 1); it++) {
      const src = cloneMask(mask);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!src[i]) continue;
        if ((x > 0 && !src[i - 1]) || (x < w - 1 && !src[i + 1]) || (y > 0 && !src[i - w]) || (y < h - 1 && !src[i + w])) mask[i] = 0;
      }
    }
    return mask;
  }

  // label connected components of `pred` (a Uint8Array predicate mask). 4-conn.
  function _label(pred, w, h) {
    const labels = new Int32Array(w * h).fill(0);
    let next = 0; const sizes = []; const boxes = [];
    const stack = [];
    for (let s = 0; s < pred.length; s++) {
      if (!pred[s] || labels[s]) continue;
      next++; let size = 0; let minX = w, minY = h, maxX = 0, maxY = 0;
      stack.push(s); labels[s] = next;
      while (stack.length) {
        const idx = stack.pop(); size++;
        const x = idx % w, y = (idx / w) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x > 0 && pred[idx - 1] && !labels[idx - 1]) { labels[idx - 1] = next; stack.push(idx - 1); }
        if (x < w - 1 && pred[idx + 1] && !labels[idx + 1]) { labels[idx + 1] = next; stack.push(idx + 1); }
        if (y > 0 && pred[idx - w] && !labels[idx - w]) { labels[idx - w] = next; stack.push(idx - w); }
        if (y < h - 1 && pred[idx + w] && !labels[idx + w]) { labels[idx + w] = next; stack.push(idx + w); }
      }
      sizes[next] = size; boxes[next] = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    return { labels, count: next, sizes, boxes };
  }

  function removeSpecks(mask, w, h, minArea) {
    const { labels, count, sizes } = _label(mask, w, h);
    for (let i = 0; i < mask.length; i++) if (mask[i] && sizes[labels[i]] < minArea) mask[i] = 0;
    void count; return mask;
  }
  function keepLargestComponent(mask, w, h) {
    const { labels, count, sizes } = _label(mask, w, h);
    let best = 0, bestSize = -1;
    for (let l = 1; l <= count; l++) if (sizes[l] > bestSize) { bestSize = sizes[l]; best = l; }
    for (let i = 0; i < mask.length; i++) if (labels[i] !== best) mask[i] = 0;
    return mask;
  }
  // fill interior holes: label the 0-region; any 0-component not touching the
  // border is an enclosed hole → set to 255.
  function fillHoles(mask, w, h) {
    const inv = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) inv[i] = mask[i] ? 0 : 1;
    const { labels, count, boxes } = _label(inv, w, h);
    const border = new Uint8Array(count + 1);
    for (let x = 0; x < w; x++) { border[labels[x]] = 1; border[labels[(h - 1) * w + x]] = 1; }
    for (let y = 0; y < h; y++) { border[labels[y * w]] = 1; border[labels[y * w + w - 1]] = 1; }
    for (let i = 0; i < mask.length; i++) { const l = labels[i]; if (l && !border[l]) mask[i] = 255; }
    void boxes; return mask;
  }

  // connected components of the opaque silhouette → one mask+bbox per blob.
  function connectedComponents(src, alphaMin, minArea) {
    const w = src.w, h = src.h, d = src.data;
    const pred = new Uint8Array(w * h);
    for (let i = 0, p = 3; i < pred.length; i++, p += 4) pred[i] = d[p] >= alphaMin ? 1 : 0;
    const { labels, count, sizes, boxes } = _label(pred, w, h);
    const out = [];
    for (let l = 1; l <= count; l++) {
      if (sizes[l] < (minArea || 1)) continue;
      const m = new Uint8Array(w * h);
      for (let i = 0; i < m.length; i++) if (labels[i] === l) m[i] = 255;
      out.push({ mask: m, bbox: boxes[l], area: sizes[l] });
    }
    out.sort((a, b) => b.area - a.area);
    return out;
  }

  function boundingBox(mask, w, h) {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  function maskArea(mask) { let n = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) n++; return n; }

  // Crop the source image through `mask` within `bbox` → a canvas (alpha = mask).
  function cropMaskedToCanvas(srcImg, mask, w, h, bbox, feather) {
    const c = document.createElement('canvas');
    c.width = bbox.w; c.height = bbox.h;
    const g = c.getContext('2d');
    g.drawImage(srcImg, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h);
    const out = g.getImageData(0, 0, bbox.w, bbox.h);
    const od = out.data;
    for (let yy = 0; yy < bbox.h; yy++) {
      for (let xx = 0; xx < bbox.w; xx++) {
        const mi = (bbox.y + yy) * w + (bbox.x + xx);
        const oi = (yy * bbox.w + xx) * 4 + 3;
        if (!mask[mi]) od[oi] = 0;
      }
    }
    g.putImageData(out, 0, 0);
    if (feather) { /* optional: a light blur pass could go here; kept crisp by default */ }
    return c;
  }

  // a magenta overlay ImageData for live mask preview
  function maskOverlayImageData(mask, w, h) {
    const id = new ImageData(w, h);
    const d = id.data;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) { const p = i * 4; d[p] = 255; d[p + 1] = 40; d[p + 2] = 150; d[p + 3] = 110; }
    }
    return id;
  }

  return {
    fromImage, newMask, cloneMask, History,
    alphaThreshold, floodFill, rectMask, lassoMask, brush, subtractMask,
    grow, shrink, removeSpecks, keepLargestComponent, fillHoles, connectedComponents,
    boundingBox, maskArea, cropMaskedToCanvas, maskOverlayImageData
  };
})();
