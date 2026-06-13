// 一人称ビューの見た目をPNGに書き出す（ブラウザ無しでmall_rpgのrpgDrawViewを再現）
const zlib = require("zlib");
const fs = require("fs");

// ---- PNGエンコーダ（RGBA） ----
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function encodePNG(W, H, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---- 簡易ラスタライザ ----
function Canvas(W, H) { this.W = W; this.H = H; this.buf = Buffer.alloc(W * H * 4); }
Canvas.prototype.set = function (x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; const i = (y * this.W + x) * 4; this.buf[i] = r; this.buf[i + 1] = g; this.buf[i + 2] = b; this.buf[i + 3] = 255; };
Canvas.prototype.fillRect = function (x0, y0, x1, y1, c) { for (let y = Math.max(0, y0 | 0); y < Math.min(this.H, y1 | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(this.W, x1 | 0); x++) this.set(x, y, c[0], c[1], c[2]); };
Canvas.prototype.poly = function (pts, c) {
  let minY = 1e9, maxY = -1e9; pts.forEach(p => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(this.H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const y0 = a[1], y1 = b[1]; if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) { const t = (y - y0) / (y1 - y0); xs.push(a[0] + t * (b[0] - a[0])); } }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) { for (let x = Math.max(0, Math.ceil(xs[k])); x < Math.min(this.W, Math.ceil(xs[k + 1])); x++) this.set(x, y, c[0], c[1], c[2]); }
  }
};
Canvas.prototype.line = function (x0, y0, x1, y1, c) { const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy, x = x0 | 0, y = y0 | 0; for (let n = 0; n < 4000; n++) { this.set(x, y, c[0], c[1], c[2]); if (x === (x1 | 0) && y === (y1 | 0)) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dy * 0 + dx, err += -dx; y += sy; } } };

// ---- 迷宮データ（mall_rpg.jsと同じ） ----
const BASE = ["#########", "#S......#", "#.#####.#", "#.#.T.#.#", "#.#.#.#.#", "#.#.#...#", "#.#.###.#", "#...#..F#", "#########"];
const FLOORS = [
  { name: "1F ファッション通り", t: "id", far: "U", pal: { f: [156, 92, 132], s: [112, 66, 98], fl: [72, 48, 64], c: [46, 30, 42] } },
  { name: "2F 雑貨＆ガジェット", t: "mirrorH", far: "U", pal: { f: [70, 124, 134], s: [50, 92, 100], fl: [40, 66, 70], c: [24, 42, 46] } },
  { name: "3F フードコート", t: "mirrorV", far: "U", pal: { f: [170, 112, 66], s: [124, 82, 50], fl: [82, 56, 38], c: [52, 34, 24] } },
  { name: "4F シネマ＆ゲーム", t: "rot180", far: "U", pal: { f: [86, 84, 158], s: [60, 58, 114], fl: [46, 44, 80], c: [28, 26, 52] } },
  { name: "屋上ガーデン", t: "transpose", far: "E", pal: { f: [94, 152, 92], s: [68, 114, 68], fl: [64, 104, 60], c: [120, 162, 204] } },
];
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function tf(base, k) { let m = base.map(r => r.split("")), n = m.length, o; if (k === "mirrorH") o = m.map(r => r.slice().reverse()); else if (k === "mirrorV") o = m.slice().reverse(); else if (k === "rot180") o = m.slice().reverse().map(r => r.slice().reverse()); else if (k === "transpose") { o = []; for (let x = 0; x < n; x++) { o[x] = []; for (let y = 0; y < n; y++) o[x][y] = m[y][x]; } } else o = m.map(r => r.slice()); return o.map(r => r.join("")); }
function build(i) { return tf(BASE, FLOORS[i].t).map(r => r.replace("F", FLOORS[i].far)); }

// ---- rpgDrawView を低解像で再現 ----
function drawView(fi, px, py, dir) {
  const map = build(fi).map(r => r.split(""));
  const isWall = (x, y) => (y < 0 || y >= map.length || x < 0 || x >= map[0].length || map[y][x] === "#");
  const ahead = (depth, lat) => { const f = DV[dir], r = DV[(dir + 1) % 4]; return [px + f[0] * depth + r[0] * lat, py + f[1] * depth + r[1] * lat]; };
  const W = 240, H = 150, cx = W / 2, cy = H / 2, cv = new Canvas(W, H);
  const pal = FLOORS[fi].pal, maxD = 4, p = 0.58;
  const col = (rgb, k) => [Math.round(rgb[0] * k), Math.round(rgb[1] * k), Math.round(rgb[2] * k)];
  cv.fillRect(0, 0, W, H / 2, col(pal.c, 0.7));
  cv.fillRect(0, H / 2, W, H, col(pal.fl, 0.6));
  const rect = []; for (let d = 0; d <= maxD; d++) { const s = Math.pow(p, d); rect[d] = { l: cx - (W / 2) * s, t: cy - (H / 2) * s, r: cx + (W / 2) * s, b: cy + (H / 2) * s }; }
  const sh = d => Math.max(0.25, 1 - d * 0.17);
  for (let c = maxD; c >= 1; c--) {
    const near = rect[c - 1], far = rect[c];
    if (isWall(ahead(c, 0)[0], ahead(c, 0)[1])) {
      cv.poly([[near.l, near.t], [near.r, near.t], [near.r, near.b], [near.l, near.b]], col(pal.f, sh(c - 1)));
      // レンガ
      const rows = 5, rh = (near.b - near.t) / rows, cw = (near.r - near.l) / 4, dark = col(pal.f, sh(c - 1) * 0.7);
      for (let i = 1; i < rows; i++) cv.line(near.l, near.t + i * rh, near.r, near.t + i * rh, dark);
      for (let i = 0; i < rows; i++) { const off = (i % 2) * cw / 2; for (let xx = near.l + off; xx < near.r; xx += cw) cv.line(xx, near.t + i * rh, xx, near.t + (i + 1) * rh, dark); }
    } else {
      cv.poly([[near.l, near.b], [far.l, far.b], [far.r, far.b], [near.r, near.b]], col(pal.fl, sh(c)));
      cv.poly([[near.l, near.t], [far.l, far.t], [far.r, far.t], [near.r, near.t]], col(pal.c, sh(c) * 0.82));
      if (isWall(ahead(c, -1)[0], ahead(c, -1)[1])) cv.poly([[near.l, near.t], [far.l, far.t], [far.l, far.b], [near.l, near.b]], col(pal.s, sh(c)));
      if (isWall(ahead(c, 1)[0], ahead(c, 1)[1])) cv.poly([[near.r, near.t], [far.r, far.t], [far.r, far.b], [near.r, near.b]], col(pal.s, sh(c)));
    }
  }
  // アイコン位置（絵文字は描けないので色マーカー）
  for (let c = 1; c <= maxD; c++) { const a = ahead(c, 0); if (isWall(a[0], a[1])) break; const ch = map[a[1]][a[0]]; if (ch === "T" || ch === "U" || ch === "E") { const r = rect[c], mc = ch === "T" ? [240, 200, 70] : ch === "U" ? [120, 220, 230] : [235, 90, 90]; cv.fillRect((r.l + r.r) / 2 - 6, (r.t + r.b) / 2 - 6, (r.l + r.r) / 2 + 6, (r.t + r.b) / 2 + 6, mc); break; } }
  // 松明ビネット
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy); const t = Math.max(0, Math.min(1, (d - H * 0.18) / (H * 0.6))); const k = 1 - t * 0.55; const i = (y * W + x) * 4; cv.buf[i] *= k; cv.buf[i + 1] *= k; cv.buf[i + 2] *= k; }
  return cv;
}
// 2倍nearestで拡大（pixelated表示を再現）
function upscale(cv, s) { const W = cv.W * s, H = cv.H * s, out = new Canvas(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = (x / s) | 0, sy = (y / s) | 0, i = (sy * cv.W + sx) * 4, j = (y * W + x) * 4; out.buf[j] = cv.buf[i]; out.buf[j + 1] = cv.buf[i + 1]; out.buf[j + 2] = cv.buf[i + 2]; out.buf[j + 3] = 255; } return out; }

// 各フロアのSから「一番長く開けている向き」を選んでレンダ
function findS(fi) { const m = build(fi); for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length; x++) if (m[y][x] === "S") return [x, y]; return [1, 1]; }
function bestDir(fi, sx, sy) { const m = build(fi).map(r => r.split("")); const isWall = (x, y) => (y < 0 || y >= m.length || x < 0 || x >= m[0].length || m[y][x] === "#"); let best = 1, bestLen = -1; for (let dir = 0; dir < 4; dir++) { let len = 0; for (let d = 1; d <= 5; d++) { const nx = sx + DV[dir][0] * d, ny = sy + DV[dir][1] * d; if (isWall(nx, ny)) break; len++; } if (len > bestLen) { bestLen = len; best = dir; } } return best; }

const files = [];
for (let fi = 0; fi < FLOORS.length; fi++) {
  const [sx, sy] = findS(fi); const dir = bestDir(fi, sx, sy);
  const cv = upscale(drawView(fi, sx, sy, dir), 2);
  const fn = `/tmp/rpg_floor${fi}.png`;
  fs.writeFileSync(fn, encodePNG(cv.W, cv.H, cv.buf));
  files.push(fn); console.log("wrote", fn, FLOORS[fi].name);
}
console.log("DONE", files.join(" "));
