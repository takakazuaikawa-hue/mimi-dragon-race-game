// リッチ一人称シーンのPNGプレビュー（canvas2D相当のシムで、本体と同じ描画ロジックを検証）
const zlib = require("zlib"), fs = require("fs");

// ---- PNG ----
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function ch(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const ty = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([ty, d]))); return Buffer.concat([l, ty, d, cr]); }
function png(W, H, b) { const s = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc(H * (W * 4 + 1)); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; b.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); } return Buffer.concat([s, ch("IHDR", ih), ch("IDAT", zlib.deflateSync(raw)), ch("IEND", Buffer.alloc(0))]); }

// ---- canvas2D 互換シム ----
function pc(s) {
  if (s && s._grad) return s;
  if (typeof s !== "string") return { r: 0, g: 0, b: 0, a: 1 };
  if (s[0] === "#") { let h = s.slice(1); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }; }
  const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(",").map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; }
  return { r: 0, g: 0, b: 0, a: 1 };
}
function Ctx(W, H) { this.W = W; this.H = H; this.buf = Buffer.alloc(W * H * 4); this.fillStyle = "#000"; this.strokeStyle = "#000"; this.lineWidth = 1; this.globalAlpha = 1; this._p = []; this._circle = null; this._st = []; }
Ctx.prototype.save = function () { this._st.push([this.fillStyle, this.strokeStyle, this.lineWidth, this.globalAlpha]); };
Ctx.prototype.restore = function () { const s = this._st.pop(); if (s) { this.fillStyle = s[0]; this.strokeStyle = s[1]; this.lineWidth = s[2]; this.globalAlpha = s[3]; } };
Ctx.prototype.createLinearGradient = function (x0, y0, x1, y1) { const g = { _grad: 1, x0, y0, x1, y1, st: [], addColorStop(o, c) { this.st.push([o, pc(c)]); } }; return g; };
Ctx.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { const g = { _grad: 1, _radial: 1, cx: x1, cy: y1, r0: r0, r1: r1, st: [], addColorStop(o, c) { this.st.push([o, pc(c)]); } }; return g; };
Ctx.prototype._sample = function (style, x, y) {
  if (style && style._grad) {
    const g = style; let t;
    if (g._radial) { const d = Math.hypot(x - g.cx, y - g.cy); t = (d - g.r0) / ((g.r1 - g.r0) || 1); }
    else { const dx = g.x1 - g.x0, dy = g.y1 - g.y0, L = dx * dx + dy * dy || 1; t = ((x - g.x0) * dx + (y - g.y0) * dy) / L; }
    t = t < 0 ? 0 : t > 1 ? 1 : t; let a = g.st[0], b = g.st[g.st.length - 1]; for (let i = 0; i < g.st.length - 1; i++) { if (t >= g.st[i][0] && t <= g.st[i + 1][0]) { a = g.st[i]; b = g.st[i + 1]; break; } } const span = (b[0] - a[0]) || 1, f = (t - a[0]) / span; return { r: a[1].r + (b[1].r - a[1].r) * f, g: a[1].g + (b[1].g - a[1].g) * f, b: a[1].b + (b[1].b - a[1].b) * f, a: a[1].a + (b[1].a - a[1].a) * f };
  }
  return pc(style);
};
Ctx.prototype._px = function (x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; let a = (c.a == null ? 1 : c.a) * this.globalAlpha; if (a <= 0) return; if (a > 1) a = 1; const i = (y * this.W + x) * 4, ia = 1 - a; this.buf[i] = c.r * a + this.buf[i] * ia; this.buf[i + 1] = c.g * a + this.buf[i + 1] * ia; this.buf[i + 2] = c.b * a + this.buf[i + 2] * ia; this.buf[i + 3] = 255; };
Ctx.prototype.fillRect = function (x, y, w, h) { const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h); for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this._px(xx, yy, this._sample(this.fillStyle, xx, yy)); };
Ctx.prototype.beginPath = function () { this._p = []; this._circle = null; };
Ctx.prototype.moveTo = function (x, y) { this._p.push([x, y]); };
Ctx.prototype.lineTo = function (x, y) { this._p.push([x, y]); };
Ctx.prototype.closePath = function () { };
Ctx.prototype.arc = function (cx, cy, r) { this._circle = [cx, cy, r]; };
Ctx.prototype.fill = function () {
  if (this._circle) { const [cx, cy, r] = this._circle; for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this._px(x, y, this._sample(this.fillStyle, x, y)); return; }
  const p = this._p; if (p.length < 3) return; let minY = 1e9, maxY = -1e9; p.forEach(q => { if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1]; });
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(this.H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) { const xs = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((u, v) => u - v); for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(this.W, Math.ceil(xs[k + 1])); for (let x = xa; x < xb; x++) this._px(x, y, this._sample(this.fillStyle, x, y)); } }
};
Ctx.prototype.stroke = function () { const p = this._p; const c = pc(this.strokeStyle), lw = this.lineWidth || 1; for (let i = 0; i + 1 < p.length; i++) { let [x0, y0] = p[i], [x1, y1] = p[i + 1]; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy, x = Math.round(x0), y = Math.round(y0); for (let n = 0; n < 5000; n++) { for (let oy = 0; oy < lw; oy++) for (let ox = 0; ox < lw; ox++) this._px(x + ox, y + oy, c); if (x === Math.round(x1) && y === Math.round(y1)) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } } } };

// =====================================================================
// 迷宮データ
// =====================================================================
const BASE = ["#########", "#S......#", "#.#####.#", "#.#.T.#.#", "#.#.#.#.#", "#.#.#...#", "#.#.###.#", "#...#..F#", "#########"];
const FLOORS = [
  { name: "1F ビーチサイド", t: "id", far: "U", accent: [38, 196, 176] },
  { name: "2F プールデッキ", t: "mirrorH", far: "U", accent: [64, 176, 235] },
  { name: "3F 南国グルメ横丁", t: "mirrorV", far: "U", accent: [255, 140, 90] },
  { name: "4F マリンアドベンチャー", t: "rot180", far: "U", accent: [40, 130, 210] },
  { name: "屋上サンセットテラス", t: "transpose", far: "E", accent: [255, 120, 150], sky: true },
];
const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function tf(base, k) { let m = base.map(r => r.split("")), n = m.length, o; if (k === "mirrorH") o = m.map(r => r.slice().reverse()); else if (k === "mirrorV") o = m.slice().reverse(); else if (k === "rot180") o = m.slice().reverse().map(r => r.slice().reverse()); else if (k === "transpose") { o = []; for (let x = 0; x < n; x++) { o[x] = []; for (let y = 0; y < n; y++) o[x][y] = m[y][x]; } } else o = m.map(r => r.slice()); return o.map(r => r.join("")); }
function build(i) { return tf(BASE, FLOORS[i].t).map(r => r.replace("F", FLOORS[i].far)); }

// =====================================================================
// ★リッチ・シーン描画（本体 mall_rpg.js と同一ロジックにする）
// =====================================================================
function rpgScene(ctx, env) {
  const W = env.W, H = env.H, cx = W / 2, cy = H * 0.46, maxD = 4, p = 0.6, t = env.t || 0, ph = t / 1000;
  const A = env.accent, sunset = env.sunset;
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const rgba = (a, k, al) => `rgba(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0},${al})`;
  const cell = env.cell, wall = (d, l) => cell(d, l) === "#";
  // パレット（明るいリゾート基調）
  const WALL = [236, 232, 224], FLOOR = [206, 198, 186], CEIL = [240, 242, 244], TRIM = [120, 112, 100], GLASS = [200, 224, 230];
  const rect = []; for (let d = 0; d <= maxD; d++) { const s = Math.pow(p, d); rect[d] = { l: cx - (W * 0.5) * s, t: cy - (H * 0.5) * s, r: cx + (W * 0.5) * s, b: cy + (H * 0.5) * s }; }
  const yN = (r, f) => r.t + f * (r.b - r.t), xN = (r, f) => r.l + f * (r.r - r.l);
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const line = (x0, y0, x1, y1, c, w) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.stroke(); };
  const sh = d => Math.max(0.55, 1 - d * 0.1);

  // 空（天井）と床のベース・グラデ
  let g = ctx.createLinearGradient(0, 0, 0, cy); g.addColorStop(0, rgb(CEIL, 0.82)); g.addColorStop(1, rgb(CEIL, 1.0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, cy + 1);
  g = ctx.createLinearGradient(0, cy, 0, H); g.addColorStop(0, rgb(FLOOR, 1.02)); g.addColorStop(1, rgb(FLOOR, 0.62)); ctx.fillStyle = g; ctx.fillRect(0, cy, W, H - cy);

  // 海の見える窓
  const oceanWindow = (x0, y0, x1, y1, k) => {
    const midY = y0 + (y1 - y0) * 0.52;
    let sg = ctx.createLinearGradient(0, y0, 0, midY);
    if (sunset) { sg.addColorStop(0, rgb([255, 150, 90], k)); sg.addColorStop(1, rgb([255, 210, 150], k)); }
    else { sg.addColorStop(0, rgb([120, 190, 235], k)); sg.addColorStop(1, rgb([200, 235, 245], k)); }
    ctx.fillStyle = sg; ctx.fillRect(x0, y0, x1 - x0, midY - y0);
    let eg = ctx.createLinearGradient(0, midY, 0, y1);
    if (sunset) { eg.addColorStop(0, rgb([120, 120, 170], k)); eg.addColorStop(1, rgb([60, 80, 140], k)); }
    else { eg.addColorStop(0, rgb([70, 175, 215], k)); eg.addColorStop(1, rgb([30, 120, 175], k)); }
    ctx.fillStyle = eg; ctx.fillRect(x0, midY, x1 - x0, y1 - midY);
    // 太陽＋海面のきらめき
    const scx = x0 + (x1 - x0) * (sunset ? 0.5 : 0.72), scy = y0 + (y1 - y0) * (sunset ? 0.4 : 0.24), sr = Math.max(2, (x1 - x0) * 0.1);
    ctx.fillStyle = sunset ? rgba([255, 180, 110], k, 0.95) : rgba([255, 250, 215], k, 0.95); ctx.beginPath(); ctx.arc(scx, scy, sr, 0, 7); ctx.fill();
    ctx.fillStyle = rgba([255, 245, 210], k, 0.5); ctx.beginPath(); ctx.arc(scx, scy, sr * 1.7, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) { const wy = midY + (y1 - midY) * (0.18 + i * 0.2); ctx.strokeStyle = rgba([255, 255, 255], k, 0.5 - i * 0.08); ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x0; xx <= x1; xx += 2) { const yy = wy + Math.sin(xx * 0.4 + ph * 2 + i) * 1.4; xx === x0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
    // サンの直下に反射の柱
    ctx.fillStyle = rgba([255, 250, 220], k, 0.25); ctx.fillRect(scx - sr * 0.5, midY, sr, y1 - midY);
  };
  // ヤシの植栽
  const palm = (bx, by, s, k) => {
    ctx.fillStyle = rgb([90, 70, 54], k); ctx.fillRect(bx - s * 0.7, by - s * 0.5, s * 1.4, s * 0.5);          // プランター
    ctx.fillStyle = rgb([70, 52, 40], k); ctx.fillRect(bx - s * 0.12, by - s * 2.4, s * 0.24, s * 1.9);         // 幹
    ctx.fillStyle = rgb([46, 150, 90], k);
    for (let a = 0; a < 6; a++) { const ang = -Math.PI / 2 + (a - 2.5) * 0.5; const ex = bx + Math.cos(ang) * s * 1.5, ey = by - s * 2.4 + Math.sin(ang) * s * 1.1; poly([[bx, by - s * 2.4], [ex - s * 0.15, ey], [ex + s * 0.15, ey + s * 0.1]], rgb([46, 150, 90], k * (0.8 + a * 0.04))); }
    ctx.fillStyle = rgb([60, 170, 100], k); ctx.beginPath(); ctx.arc(bx, by - s * 2.4, s * 0.3, 0, 7); ctx.fill();
  };

  // 店先（側壁・グラデ＋日よけ＋ガラス映り込み＋柱＋幅木）
  const storefront = (near, far, left, k, depth) => {
    const nx = left ? near.l : near.r, fx = left ? far.l : far.r;
    const band = (f0, f1, fill) => poly([[nx, yN(near, f0)], [fx, yN(far, f0)], [fx, yN(far, f1)], [nx, yN(near, f1)]], fill);
    // 壁（縦グラデ：上下AO）
    let wg = ctx.createLinearGradient(0, near.t, 0, near.b); wg.addColorStop(0, rgb(WALL, k * 0.8)); wg.addColorStop(0.5, rgb(WALL, k)); wg.addColorStop(1, rgb(WALL, k * 0.78));
    band(0, 1, wg);
    // 日よけ（アクセント色・グラデ）
    let ag = ctx.createLinearGradient(0, yN(near, 0.05), 0, yN(near, 0.26)); ag.addColorStop(0, rgb(A, k * 1.05)); ag.addColorStop(1, rgb(A, k * 0.8));
    band(0.05, 0.26, ag);
    line(nx, yN(near, 0.26), fx, yN(far, 0.26), rgba([0, 0, 0], 1, 0.18 * k), 1);
    // ガラス（縦グラデ＋斜めハイライト＋店内シルエット）
    let gg = ctx.createLinearGradient(0, yN(near, 0.30), 0, yN(near, 0.74)); gg.addColorStop(0, rgb(GLASS, k * 1.05)); gg.addColorStop(1, rgb(GLASS, k * 0.82));
    band(0.30, 0.74, gg);
    band(0.40, 0.62, rgba([40, 40, 50], k, 0.18));        // 店内の暗がり
    // ガラスの斜めハイライト（店先の映り込み）
    line(xN({ l: nx, r: fx, b: 0 }, 0.0) + (fx - nx) * 0.2, yN(near, 0.34), nx + (fx - nx) * 0.5, yN(near, 0.70), rgba([255, 255, 255], k, 0.25), 1);
    // 幅木
    band(0.86, 1, rgb([150, 142, 132], k));
    // 柱（手前・奥）
    let cg = ctx.createLinearGradient(nx - 1, 0, nx + 2, 0); cg.addColorStop(0, rgb(TRIM, k * 0.7)); cg.addColorStop(1, rgb([210, 204, 196], k));
    ctx.fillStyle = cg; ctx.fillRect(nx - (left ? 0 : 2), near.t, 2, near.b - near.t);
    line(fx, far.t, fx, far.b, rgba(TRIM, k, 0.8), 1);
  };

  // 正面＝海の見える大きな窓
  const facade = (r, k) => {
    poly([[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]], rgb(WALL, k));
    let ag = ctx.createLinearGradient(0, yN(r, 0.05), 0, yN(r, 0.24)); ag.addColorStop(0, rgb(A, k * 1.05)); ag.addColorStop(1, rgb(A, k * 0.82));
    ctx.fillStyle = ag; ctx.fillRect(r.l, yN(r, 0.05), r.r - r.l, yN(r, 0.24) - yN(r, 0.05));
    oceanWindow(r.l + 3, yN(r, 0.30), r.r - 3, yN(r, 0.86), k);
    line(r.l, yN(r, 0.58), r.r, yN(r, 0.58), rgba(TRIM, k, 0.7), 1);
    for (let m = 1; m < 4; m++) { const x = xN(r, m / 4); line(x, yN(r, 0.30), x, yN(r, 0.86), rgba(TRIM, k, 0.8), 1); }
    poly([[r.l, yN(r, 0.86)], [r.r, yN(r, 0.86)], [r.r, yN(r, 0.93)], [r.l, yN(r, 0.93)]], rgb([150, 142, 132], k));
  };

  // 奥→手前
  for (let c = maxD; c >= 1; c--) {
    const near = rect[c - 1], far = rect[c], k = sh(c);
    if (wall(c, 0)) { facade(near, sh(c - 1)); }
    else {
      // 床（グラデ＋遠近タイル＋中央グロス＋店色の映り込み）
      let fg = ctx.createLinearGradient(0, far.b, 0, near.b); fg.addColorStop(0, rgb(FLOOR, k * 0.85)); fg.addColorStop(1, rgb(FLOOR, k * 1.05));
      poly([[near.l, near.b], [far.l, far.b], [far.r, far.b], [near.r, near.b]], fg);
      line(far.l, far.b, far.r, far.b, rgba([120, 112, 100], k, 0.5), 1);
      [0.25, 0.5, 0.75].forEach(fr => line(xN(near, fr), near.b, xN(far, fr), far.b, rgba([120, 112, 100], k, 0.35), 1));
      // 反射（店アクセント色を床に薄く）
      if (wall(c, -1)) { ctx.save(); ctx.globalAlpha = 0.12 * k; poly([[near.l, near.b], [far.l, far.b], [xN(far, 0.2), far.b], [xN(near, 0.2), near.b]], rgb(A, 1)); ctx.restore(); }
      if (wall(c, 1)) { ctx.save(); ctx.globalAlpha = 0.12 * k; poly([[xN(near, 0.8), near.b], [xN(far, 0.8), far.b], [far.r, far.b], [near.r, near.b]], rgb(A, 1)); ctx.restore(); }
      // 中央グロス
      ctx.save(); ctx.globalAlpha = 0.10; poly([[xN(near, 0.42), near.b], [xN(far, 0.46), far.b], [xN(far, 0.54), far.b], [xN(near, 0.58), near.b]], "rgb(255,255,255)"); ctx.restore();
      // 天井（グラデ＋天窓＋照明パネル＋梁）
      let cg = ctx.createLinearGradient(0, near.t, 0, far.t); cg.addColorStop(0, rgb(CEIL, k)); cg.addColorStop(1, rgb(CEIL, k * 0.9));
      poly([[near.l, near.t], [far.l, far.t], [far.r, far.t], [near.r, near.t]], cg);
      poly([[xN(near, 0.40), near.t], [xN(far, 0.42), far.t], [xN(far, 0.58), far.t], [xN(near, 0.60), near.t]], rgba([255, 252, 240], k, 0.9)); // 天窓
      poly([[xN(near, 0.30), far.t], [xN(far, 0.34), far.t], [xN(far, 0.66), far.t], [xN(near, 0.70), far.t]], rgba([255, 255, 235], 1, 0.8)); // 照明
      line(near.l, near.t, far.l, far.t, rgba([90, 86, 80], k, 0.4), 1);
      line(near.r, near.t, far.r, far.t, rgba([90, 86, 80], k, 0.4), 1);
      // 側壁
      if (wall(c, -1)) storefront(near, far, true, k, c);
      if (wall(c, 1)) storefront(near, far, false, k, c);
      // 吊り照明（中央）
      const lx = cx, ly = far.t + (near.t - far.t) * 0.25;
      ctx.fillStyle = rgba([255, 244, 200], 1, 0.9); ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.5, (near.t - far.t) * 0.04), 0, 7); ctx.fill();
      // ヤシ（手前2段の通路脇）
      if (c <= 2 && !wall(c, -1)) palm(xN(near, 0.12), near.b, (near.b - far.b) * 0.5 + 6, k);
      if (c <= 2 && !wall(c, 1)) palm(xN(near, 0.88), near.b, (near.b - far.b) * 0.5 + 6, k);
    }
  }

  // 光のシャフト（天窓から床へ）
  ctx.save(); ctx.globalAlpha = 0.10; let ls = ctx.createLinearGradient(0, rect[maxD].t, 0, H); ls.addColorStop(0, "rgb(255,250,225)"); ls.addColorStop(1, "rgba(255,250,225,0)"); ctx.fillStyle = ls; poly([[xN(rect[maxD], 0.42), rect[maxD].t], [xN(rect[maxD], 0.58), rect[maxD].t], [W * 0.72, H], [W * 0.28, H]], ls); ctx.restore();
  // 遠景もや（空気遠近）
  ctx.save(); ctx.globalAlpha = 0.5; let hz = ctx.createLinearGradient(0, cy - 18, 0, cy + 22); hz.addColorStop(0, "rgba(255,255,255,0)"); hz.addColorStop(0.5, sunset ? "rgba(255,220,190,0.5)" : "rgba(225,240,248,0.55)"); hz.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = hz; ctx.fillRect(0, cy - 22, W, 46); ctx.restore();
}

// =====================================================================
// 出力
// =====================================================================
function envFor(fi, px, py, dir) {
  const map = build(fi).map(r => r.split(""));
  const isW = (x, y) => (y < 0 || y >= map.length || x < 0 || x >= map[0].length || map[y][x] === "#");
  const cellRaw = (x, y) => (y < 0 || y >= map.length || x < 0 || x >= map[0].length ? "#" : map[y][x]);
  return {
    W: 480, H: 300, accent: FLOORS[fi].accent, sunset: !!FLOORS[fi].sky, t: 1500,
    cell: (d, l) => { const f = DV[dir], r = DV[(dir + 1) % 4]; return cellRaw(px + f[0] * d + r[0] * l, py + f[1] * d + r[1] * l); },
  };
}
function findS(fi) { const m = build(fi); for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length; x++) if (m[y][x] === "S") return [x, y]; return [1, 1]; }
function bestDir(fi, sx, sy) { const m = build(fi).map(r => r.split("")); const isW = (x, y) => (y < 0 || y >= m.length || x < 0 || x >= m[0].length || m[y][x] === "#"); let best = 1, bl = -1; for (let dir = 0; dir < 4; dir++) { let len = 0; for (let d = 1; d <= 5; d++) { if (isW(sx + DV[dir][0] * d, sy + DV[dir][1] * d)) break; len++; } if (len > bl) { bl = len; best = dir; } } return best; }

// ---- HD-2D風 後処理：被写界深度(ティルトシフト)＋ブルーム＋暖色グレード ----
function blurBuf(src, W, H, r) {
  const tmp = Buffer.alloc(W * H * 4), out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let R = 0, G = 0, B = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; const i = (y * W + xx) * 4; R += src[i]; G += src[i + 1]; B += src[i + 2]; n++; } const j = (y * W + x) * 4; tmp[j] = R / n; tmp[j + 1] = G / n; tmp[j + 2] = B / n; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let R = 0, G = 0, B = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; const i = (yy * W + x) * 4; R += tmp[i]; G += tmp[i + 1]; B += tmp[i + 2]; n++; } const j = (y * W + x) * 4; out[j] = R / n; out[j + 1] = G / n; out[j + 2] = B / n; }
  return out;
}
function hd2d(ctx) {
  const buf = ctx.buf, W = ctx.W, H = ctx.H, focus = H * 0.66;
  const soft = blurBuf(buf, W, H, 2), strong = blurBuf(buf, W, H, 4);
  for (let y = 0; y < H; y++) { const dist = Math.abs(y - focus) / (H * 0.5); const m = Math.min(1, Math.max(0, (dist - 0.30) * 1.7)); if (m <= 0.01) continue; const src = m > 0.55 ? strong : soft, f = m; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; buf[i] = buf[i] * (1 - f) + src[i] * f; buf[i + 1] = buf[i + 1] * (1 - f) + src[i + 1] * f; buf[i + 2] = buf[i + 2] * (1 - f) + src[i + 2] * f; } }
  const bp = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { const o = i * 4, l = (buf[o] + buf[o + 1] + buf[o + 2]) / 3, e = Math.max(0, l - 190) / 65; bp[o] = buf[o] * e; bp[o + 1] = buf[o + 1] * e; bp[o + 2] = buf[o + 2] * e; }
  const bb = blurBuf(bp, W, H, 6);
  for (let i = 0; i < W * H; i++) { const o = i * 4; buf[o] = Math.min(255, buf[o] + bb[o] * 0.7); buf[o + 1] = Math.min(255, buf[o + 1] + bb[o + 1] * 0.7); buf[o + 2] = Math.min(255, buf[o + 2] + bb[o + 2] * 0.7); }
  for (let i = 0; i < W * H; i++) { const o = i * 4; let r = (buf[o] - 128) * 1.08 + 128 + 7, g = (buf[o + 1] - 128) * 1.06 + 128 + 2, b = (buf[o + 2] - 128) * 1.06 + 128 - 6; buf[o] = Math.max(0, Math.min(255, r)); buf[o + 1] = Math.max(0, Math.min(255, g)); buf[o + 2] = Math.max(0, Math.min(255, b)); }
  // ビネット
  const cx = W / 2, cy = H * 0.46;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - cx) / (W * 0.6), dy = (y - cy) / (H * 0.7), r2 = dx * dx + dy * dy; if (r2 > 0.5) { const a = Math.min(0.45, (r2 - 0.5) * 0.6), o = (y * W + x) * 4, k = 1 - a; buf[o] *= k; buf[o + 1] *= k; buf[o + 2] *= k; } }
}

// ===== アイソメトリック戦闘アリーナ（本体と同一ロジック） =====
function rpgIsoLayout(W, H, n) {
  const pcx = W * 0.5, pcy = H * 0.64, pw = W * 0.45, pdh = H * 0.16;
  const top = [pcx, pcy - pdh], right = [pcx + pw, pcy], bot = [pcx, pcy + pdh], left = [pcx - pw, pcy];
  const bn = Math.max(1, n), slots = [];
  for (let i = 0; i < bn; i++) {
    const f = bn === 1 ? 0.5 : (0.5 + (i - (bn - 1) / 2) * (0.62 / Math.max(1, bn - 1)));
    slots.push({ x: pcx + (f - 0.5) * pw * 1.05, y: pcy - pdh * 0.34 + (i % 2) * 10, scale: 1 });
  }
  const mimi = { x: pcx - pw * 0.46, y: pcy + pdh * 0.55 };
  return { pcx, pcy, pw, pdh, top, right, bot, left, slots, mimi };
}
function rpgIsoArena(ctx, env) {
  const W = env.W, H = env.H, A = env.accent, sunset = env.sunset, t = env.t || 0, ph = t / 1000, n = env.n || 2;
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const rgba = (a, k, al) => `rgba(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0},${al})`;
  const L = rpgIsoLayout(W, H, n);
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const line = (a, b, c, w) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.stroke(); };
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const ell = (p, rw, fill) => { ctx.beginPath(); for (let a = 0; a < 6.5; a += 0.25) { const x = p.x + Math.cos(a) * rw, y = p.y + Math.sin(a) * rw * 0.4; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  // 空
  let sg = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  if (sunset) { sg.addColorStop(0, "rgb(255,150,95)"); sg.addColorStop(1, "rgb(255,212,165)"); }
  else { sg.addColorStop(0, "rgb(130,198,234)"); sg.addColorStop(1, "rgb(222,240,250)"); }
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.62);
  // 太陽
  ctx.fillStyle = sunset ? "rgba(255,200,140,.4)" : "rgba(255,250,225,.4)"; ctx.beginPath(); ctx.arc(W * 0.74, H * 0.24, 42, 0, 7); ctx.fill();
  ctx.fillStyle = sunset ? "rgba(255,178,108,.96)" : "rgba(255,250,220,.96)"; ctx.beginPath(); ctx.arc(W * 0.74, H * 0.24, 24, 0, 7); ctx.fill();
  // 海
  let se = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.64);
  if (sunset) { se.addColorStop(0, "rgb(120,120,170)"); se.addColorStop(1, "rgb(70,84,128)"); }
  else { se.addColorStop(0, "rgb(72,176,216)"); se.addColorStop(1, "rgb(40,135,185)"); }
  ctx.fillStyle = se; ctx.fillRect(0, H * 0.42, W, H * 0.22);
  for (let i = 0; i < 3; i++) { const wy = H * (0.46 + i * 0.045); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = 0; xx <= W; xx += 3) { const yy = wy + Math.sin(xx * 0.05 + ph * 2 + i) * 1.5; xx === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
  // プラットフォーム側面（厚み）
  const dp = 16;
  poly([L.left, L.bot, [L.bot[0], L.bot[1] + dp], [L.left[0], L.left[1] + dp]], rgb(A, 0.45));
  poly([L.bot, L.right, [L.right[0], L.right[1] + dp], [L.bot[0], L.bot[1] + dp]], rgb(A, 0.34));
  // 天面
  let pg = ctx.createLinearGradient(0, L.pcy - L.pdh, 0, L.pcy + L.pdh); pg.addColorStop(0, "rgb(196,206,218)"); pg.addColorStop(1, "rgb(238,242,247)");
  poly([L.top, L.right, L.bot, L.left], pg);
  // タイル目地
  const N = 6, grout = "rgba(120,132,148,0.45)";
  for (let i = 1; i < N; i++) { const f = i / N; line(lerp(L.top, L.left, f), lerp(L.right, L.bot, f), grout, 1); line(lerp(L.top, L.right, f), lerp(L.left, L.bot, f), grout, 1); }
  // アクセント縁取り（奥のエッジを光らせる）
  line(L.left, L.top, rgba(A, 1.2, 0.85), 2); line(L.top, L.right, rgba(A, 1.2, 0.85), 2);
  // スポットライト
  let spg = ctx.createRadialGradient(L.pcx, L.pcy, 8, L.pcx, L.pcy, L.pw * 0.95); spg.addColorStop(0, "rgba(255,250,225,0.3)"); spg.addColorStop(1, "rgba(255,250,225,0)");
  poly([L.top, L.right, L.bot, L.left], spg);
  // 接地影＋プレースホルダ戦闘者（本体ではDOMスプライト）
  L.slots.forEach((s) => { ell(s, 28, "rgba(0,0,0,0.32)"); ctx.fillStyle = rgb([220, 150, 180], 1); ctx.beginPath(); ctx.arc(s.x, s.y - 28, 22, 0, 7); ctx.fill(); });
  ell(L.mimi, 26, "rgba(0,0,0,0.32)"); ctx.fillStyle = "rgb(255,120,170)"; ctx.beginPath(); ctx.arc(L.mimi.x, L.mimi.y - 28, 22, 0, 7); ctx.fill();
  hd2d(ctx);
}

const shots = [];
// ★攻撃モーションのキーフレーム実証（予備動作/着弾）＝canvasで本当に表現できるかの検証
function rpgAttackKF(ctx, env) {
  const W = env.W, H = env.H, A = env.accent, n = env.n || 2;
  const o = env.o || {}; // { mimiDx, mimiDy, tgt, tgtDx, tgtDy, flashA, burstCol, burstN, burstR, charge, num }
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const ell = (x, y, rw, rh, c) => { ctx.fillStyle = c; ctx.beginPath(); for (let a = 0; a < 6.5; a += 0.22) { const px = x + Math.cos(a) * rw, py = y + Math.sin(a) * rh; a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.fill(); };
  const circ = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const L = rpgIsoLayout(W, H, n);
  // 背景（昼）
  let sg = ctx.createLinearGradient(0, 0, 0, H * 0.62); sg.addColorStop(0, "rgb(130,198,234)"); sg.addColorStop(1, "rgb(222,240,250)"); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.62);
  let se = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.64); se.addColorStop(0, "rgb(72,176,216)"); se.addColorStop(1, "rgb(40,135,185)"); ctx.fillStyle = se; ctx.fillRect(0, H * 0.42, W, H * 0.22);
  const dp = 16; poly([L.left, L.bot, [L.bot[0], L.bot[1] + dp], [L.left[0], L.left[1] + dp]], rgb(A, 0.45)); poly([L.bot, L.right, [L.right[0], L.right[1] + dp], [L.bot[0], L.bot[1] + dp]], rgb(A, 0.34));
  let pg = ctx.createLinearGradient(0, L.pcy - L.pdh, 0, L.pcy + L.pdh); pg.addColorStop(0, "rgb(196,206,218)"); pg.addColorStop(1, "rgb(238,242,247)"); poly([L.top, L.right, L.bot, L.left], pg);
  // 敵
  L.slots.forEach((s, i) => {
    const isT = i === (o.tgt == null ? 0 : o.tgt);
    const kx = isT ? (o.tgtDx || 0) : 0, ky = isT ? (o.tgtDy || 0) : 0;
    ell(s.x, s.y, 26, 10, "rgba(0,0,0,0.30)");
    let col = [220, 150, 180];
    circ(s.x + kx, s.y - 28 + ky, 23, rgb(col, 1));
    if (isT && o.flashA) circ(s.x + kx, s.y - 28 + ky, 23, `rgba(255,255,255,${o.flashA})`); // 被弾フラッシュ
  });
  // ミミ（オフセット＝予備動作で引く／踏み込みで寄る）
  const mx = L.mimi.x + (o.mimiDx || 0), my = L.mimi.y + (o.mimiDy || 0);
  ell(L.mimi.x, L.mimi.y, 27, 11, "rgba(0,0,0,0.30)");
  if (o.charge) circ(mx, my - 30, 30, "rgba(120,200,255,0.35)"); // チャージ発光
  circ(mx, my - 30, 26, "rgb(255,120,170)");
  // 着弾バースト（放射パーティクル）
  if (o.burstN) {
    const t = o.tgt == null ? 0 : o.tgt, s = L.slots[t], bx = s.x + (o.tgtDx || 0), by = s.y - 28 + (o.tgtDy || 0);
    for (let k = 0; k < o.burstN; k++) { const a = (k / o.burstN) * 6.28, r = (o.burstR || 30) * (0.5 + (k % 3) * 0.25); circ(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.9, 3 + (k % 2) * 2, o.burstCol || "rgba(255,255,255,0.9)"); }
    circ(bx, by, (o.burstR || 30) * 0.5, "rgba(255,255,255,0.85)");
  }
  // ダメージ数字の位置（枠で示す）
  if (o.num) { const t = o.tgt == null ? 0 : o.tgt, s = L.slots[t]; ctx.fillStyle = "rgb(255,228,94)"; ctx.fillRect(s.x - 20 + (o.tgtDx || 0), s.y - 90, 40, 18); }
}
[["anticipation", { charge: true, mimiDx: -14, mimiDy: 8 }], ["impact", { mimiDx: 30, mimiDy: -10, tgt: 0, tgtDx: 14, flashA: 0.85, burstN: 14, burstR: 34, burstCol: "rgba(255,255,255,0.95)", num: 1 }], ["fire", { mimiDx: 24, mimiDy: -6, tgt: 0, tgtDx: 10, flashA: 0.5, burstN: 16, burstR: 36, burstCol: "rgba(255,150,60,0.95)", num: 1 }]].forEach(([name, o]) => {
  const env = { W: 520, H: 320, accent: FLOORS[0].accent, n: 3, o };
  const ctx = new Ctx(env.W, env.H); rpgAttackKF(ctx, env);
  const fn = `/tmp/kf_${name}.png`; fs.writeFileSync(fn, png(env.W, env.H, ctx.buf)); console.log("wrote", fn);
});

// 戦闘シーン全体の構図検証（ネームプレート/HP/予告/選択/手番）
function rpgBattleMock(ctx, env) {
  const W = env.W, H = env.H, A = env.accent, sunset = env.sunset, n = env.n || 2, ph = (env.t || 0) / 1000;
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const rr = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const L = rpgIsoLayout(W, H, n);
  // 背景
  let sg = ctx.createLinearGradient(0, 0, 0, H * 0.6); if (sunset) { sg.addColorStop(0, "rgb(255,150,95)"); sg.addColorStop(1, "rgb(255,212,165)"); } else { sg.addColorStop(0, "rgb(130,198,234)"); sg.addColorStop(1, "rgb(222,240,250)"); } ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.62);
  let se = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.64); if (sunset) { se.addColorStop(0, "rgb(120,120,170)"); se.addColorStop(1, "rgb(70,84,128)"); } else { se.addColorStop(0, "rgb(72,176,216)"); se.addColorStop(1, "rgb(40,135,185)"); } ctx.fillStyle = se; ctx.fillRect(0, H * 0.42, W, H * 0.22);
  const dp = 16; poly([L.left, L.bot, [L.bot[0], L.bot[1] + dp], [L.left[0], L.left[1] + dp]], rgb(A, 0.45)); poly([L.bot, L.right, [L.right[0], L.right[1] + dp], [L.bot[0], L.bot[1] + dp]], rgb(A, 0.34));
  let pg = ctx.createLinearGradient(0, L.pcy - L.pdh, 0, L.pcy + L.pdh); pg.addColorStop(0, "rgb(196,206,218)"); pg.addColorStop(1, "rgb(238,242,247)"); poly([L.top, L.right, L.bot, L.left], pg);
  let spg = ctx.createRadialGradient(L.pcx, L.pcy, 8, L.pcx, L.pcy, L.pw * 0.95); spg.addColorStop(0, "rgba(255,250,225,0.3)"); spg.addColorStop(1, "rgba(255,250,225,0)"); poly([L.top, L.right, L.bot, L.left], spg);
  // 敵：接地影＋スプライト＋足元HPバー＋頭上に小さな予告＋選択マーカー（strokeは使わない）
  L.slots.forEach((s, i) => {
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); for (let a = 0; a < 6.5; a += 0.25) { const x = s.x + Math.cos(a) * 26, y = s.y + Math.sin(a) * 10; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.fill();
    if (i === 0) { ctx.fillStyle = "rgba(255,95,162,0.22)"; ctx.beginPath(); for (let a = 0; a < 6.5; a += 0.25) { const x = s.x + Math.cos(a) * 34, y = s.y + Math.sin(a) * 14; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.fill(); } // selection glow (fill)
    ctx.fillStyle = rgb([220, 150, 180], 1); ctx.beginPath(); ctx.arc(s.x, s.y - 28, 23, 0, 7); ctx.fill();   // sprite placeholder
    rr(s.x - 24, s.y + 1, 48, 5, "rgba(0,0,0,0.5)"); rr(s.x - 24, s.y + 1, 32, 5, "rgb(226,56,79)");          // 足元HPバー
    rr(s.x - 9, s.y - 66, 18, 14, i % 2 ? "rgb(170,95,210)" : "rgb(196,60,70)");                              // 頭上予告アイコン
    if (i === 0) poly([[s.x, s.y - 72], [s.x - 7, s.y - 82], [s.x + 7, s.y - 82]], "rgb(255,95,162)");        // 選択▼
  });
  // ミミ（手前）
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); for (let a = 0; a < 6.5; a += 0.25) { const x = L.mimi.x + Math.cos(a) * 28, y = L.mimi.y + Math.sin(a) * 11; a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.fill();
  ctx.fillStyle = "rgb(255,120,170)"; ctx.beginPath(); ctx.arc(L.mimi.x, L.mimi.y - 30, 27, 0, 7); ctx.fill();
  // 手番バナー（上中央）＋ターゲット情報枠（その下）＋状態アイコン（左上）
  rr(W / 2 - 58, 8, 116, 22, "rgba(58,143,206,0.95)");
  rr(W / 2 - 92, 34, 184, 18, "rgba(20,16,30,0.6)");   // 選択中の敵の名前/弱点を出す枠
  rr(10, 8, 26, 22, "rgba(70,40,46,0.85)");
}
[[0, 3], [4, 1]].forEach(([fi, n]) => {
  const env = { W: 520, H: 320, accent: FLOORS[fi].accent, sunset: !!FLOORS[fi].sky, t: 1500, n };
  const ctx = new Ctx(env.W, env.H); rpgBattleMock(ctx, env);
  const fn = `/tmp/btl_floor${fi}.png`; fs.writeFileSync(fn, png(env.W, env.H, ctx.buf)); console.log("wrote", fn);
});
[[0, 3], [4, 2]].forEach(([fi, n]) => {
  const env = { W: 520, H: 320, accent: FLOORS[fi].accent, sunset: !!FLOORS[fi].sky, t: 1500, n };
  const ctx = new Ctx(env.W, env.H); rpgIsoArena(ctx, env);
  const fn = `/tmp/iso_floor${fi}.png`; fs.writeFileSync(fn, png(env.W, env.H, ctx.buf)); console.log("wrote", fn);
});
for (let fi = 0; fi < FLOORS.length; fi++) { const [sx, sy] = findS(fi); shots.push([fi, sx, sy, bestDir(fi, sx, sy), `/tmp/scene_floor${fi}.png`]); }
shots.push([0, 5, 5, 1, "/tmp/scene_ocean0.png"]);
shots.forEach(([fi, x, y, dir, fn]) => { const env = envFor(fi, x, y, dir); const ctx = new Ctx(env.W, env.H); rpgScene(ctx, env); hd2d(ctx); fs.writeFileSync(fn, png(env.W, env.H, ctx.buf)); console.log("wrote", fn); });
console.log("DONE");
