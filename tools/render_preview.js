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
  { name: "1F ファッション通り", t: "id", far: "U", accent: [226, 120, 162] },
  { name: "2F 雑貨＆ガジェット", t: "mirrorH", far: "U", accent: [64, 176, 188] },
  { name: "3F フードコート", t: "mirrorV", far: "U", accent: [244, 152, 66] },
  { name: "4F シネマ＆ゲーム", t: "rot180", far: "U", accent: [120, 116, 214] },
  { name: "屋上ガーデン", t: "transpose", far: "E", accent: [86, 184, 110], sky: true },
];
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function tf(base, k) { let m = base.map(r => r.split("")), n = m.length, o; if (k === "mirrorH") o = m.map(r => r.slice().reverse()); else if (k === "mirrorV") o = m.slice().reverse(); else if (k === "rot180") o = m.slice().reverse().map(r => r.slice().reverse()); else if (k === "transpose") { o = []; for (let x = 0; x < n; x++) { o[x] = []; for (let y = 0; y < n; y++) o[x][y] = m[y][x]; } } else o = m.map(r => r.slice()); return o.map(r => r.join("")); }
function build(i) { return tf(BASE, FLOORS[i].t).map(r => r.replace("F", FLOORS[i].far)); }

// ---- rpgDrawView を低解像で再現 ----
function mallPalette(fi) {
  const A = FLOORS[fi].accent, sky = FLOORS[fi].sky, WH = [255, 255, 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return {
    floor: [208, 202, 192], grout: [176, 168, 156],
    ceil: sky ? [150, 198, 228] : [234, 236, 238], light: [253, 251, 244],
    wall: [233, 231, 225], glass: mix(A, WH, 0.6), sign: A, kick: [160, 154, 146], trim: [120, 114, 106], sky: sky,
  };
}
function drawView(fi, px, py, dir) {
  const map = build(fi).map(r => r.split(""));
  const isWall = (x, y) => (y < 0 || y >= map.length || x < 0 || x >= map[0].length || map[y][x] === "#");
  const ahead = (depth, lat) => { const f = DV[dir], r = DV[(dir + 1) % 4]; return [px + f[0] * depth + r[0] * lat, py + f[1] * depth + r[1] * lat]; };
  const W = 240, H = 150, cx = W / 2, cy = H / 2, cv = new Canvas(W, H);
  const P = mallPalette(fi), maxD = 4, p = 0.58;
  const col = (rgb, k) => [Math.round(Math.min(255, rgb[0] * k)), Math.round(Math.min(255, rgb[1] * k)), Math.round(Math.min(255, rgb[2] * k))];
  const sh = d => Math.max(0.6, 1 - d * 0.085);
  const rect = []; for (let d = 0; d <= maxD; d++) { const s = Math.pow(p, d); rect[d] = { l: cx - (W / 2) * s, t: cy - (H / 2) * s, r: cx + (W / 2) * s, b: cy + (H / 2) * s }; }
  const yN = (r, f) => r.t + f * (r.b - r.t), xN = (r, f) => r.l + f * (r.r - r.l);
  // 明るい背景（天井/床）
  cv.fillRect(0, 0, W, H / 2, col(P.ceil, 0.9));
  cv.fillRect(0, H / 2, W, H, col(P.floor, 0.66));
  // 店先（側壁）
  function storefront(near, far, left, k) {
    const nx = left ? near.l : near.r, fx = left ? far.l : far.r;
    const band = (f0, f1, c) => cv.poly([[nx, yN(near, f0)], [fx, yN(far, f0)], [fx, yN(far, f1)], [nx, yN(near, f1)]], c);
    band(0, 1, col(P.wall, k));
    band(0.05, 0.24, col(P.sign, k));    // 看板帯
    band(0.30, 0.74, col(P.glass, k));   // ガラス
    band(0.86, 1, col(P.kick, k));       // 幅木
    cv.line(nx, near.t, nx, near.b, col(P.trim, k));
    cv.line(fx, far.t, fx, far.b, col(P.trim, k));
  }
  // 正面の店（行き止まり）
  function facade(r, k) {
    cv.poly([[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]], col(P.wall, k));
    cv.fillRect(r.l, yN(r, 0.06), r.r, yN(r, 0.27), col(P.sign, k));
    cv.fillRect(r.l, yN(r, 0.33), r.r, yN(r, 0.83), col(P.glass, k));
    for (let m = 1; m < 4; m++) { const x = xN(r, m / 4); cv.line(x, yN(r, 0.33), x, yN(r, 0.83), col(P.trim, k)); }
    cv.fillRect(r.l, yN(r, 0.83), r.r, yN(r, 0.92), col(P.kick, k));
  }
  for (let c = maxD; c >= 1; c--) {
    const near = rect[c - 1], far = rect[c], k = sh(c);
    if (isWall(ahead(c, 0)[0], ahead(c, 0)[1])) {
      facade(near, sh(c - 1));
    } else {
      // 床（つやタイル）＋目地
      cv.poly([[near.l, near.b], [far.l, far.b], [far.r, far.b], [near.r, near.b]], col(P.floor, k));
      cv.line(far.l, far.b, far.r, far.b, col(P.grout, k));
      [0.33, 0.66].forEach(fr => cv.line(xN(near, fr), near.b, xN(far, fr), far.b, col(P.grout, k * 0.92)));
      // 天井＋天窓ストリップ＋照明ライン
      cv.poly([[near.l, near.t], [far.l, far.t], [far.r, far.t], [near.r, near.t]], col(P.ceil, k));
      cv.poly([[xN(near, 0.42), near.t], [xN(far, 0.42), far.t], [xN(far, 0.58), far.t], [xN(near, 0.58), near.t]], col(P.light, k));
      cv.line(far.l, far.t, far.r, far.t, col(P.light, 1));
      // 側壁＝店先
      if (isWall(ahead(c, -1)[0], ahead(c, -1)[1])) storefront(near, far, true, k);
      if (isWall(ahead(c, 1)[0], ahead(c, 1)[1])) storefront(near, far, false, k);
    }
  }
  // アイコン位置（絵文字は描けないので色マーカー）
  for (let c = 1; c <= maxD; c++) { const a = ahead(c, 0); if (isWall(a[0], a[1])) break; const ch = map[a[1]][a[0]]; if (ch === "T" || ch === "U" || ch === "E") { const r = rect[c], mc = ch === "T" ? [240, 200, 70] : ch === "U" ? [120, 220, 230] : [235, 90, 90]; cv.fillRect(xN(r, 0.5) - 6, yN(r, 0.5) - 6, xN(r, 0.5) + 6, yN(r, 0.5) + 6, mc); break; } }
  // ごく軽いビネット（モールは明るい）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy); const t = Math.max(0, Math.min(1, (d - H * 0.3) / (H * 0.6))); const k = 1 - t * 0.22; const i = (y * W + x) * 4; cv.buf[i] *= k; cv.buf[i + 1] *= k; cv.buf[i + 2] *= k; }
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
