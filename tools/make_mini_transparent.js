#!/usr/bin/env node
// =============================================================================
// tools/make_mini_transparent.js — 衣装ミニ絵の白背景を抜いて透過にする
// =============================================================================
// ★なぜ要るか
//   images/cast/mimi/mimi_<衣装id>_mini.png は36枚すべて白背景が焼き込まれた
//   RGB画像で、暗いお部屋の上に置くと白い箱が浮いてしまう。
//   （既定で使っていた mimi_loading1_mini.png だけが透過だった）
//
// ★白を一律に抜いてはいけない
//   ミミの衣装には白い服が多い（バニーのパーカー等）。明るさで抜くと
//   服に穴が空く。そこで「画像の縁から繋がっている白」だけを背景とみなす
//   （塗りつぶし＝flood fill）。服の中の白は縁と繋がっていないので残る。
//
// 使い方:
//   node tools/make_mini_transparent.js            … 変換して上書き保存
//   node tools/make_mini_transparent.js --dry      … 変換せず判定だけ表示
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "images/cast/mimi");
const DRY = process.argv.includes("--dry");
const OUT_W = 512;            // 元は1024x1536と大きい。表示は小さいので半分に縮める
const WHITE = 238;            // これ以上明るければ「白」＝確実な背景（縁からの連結のみ）
const SOFT  = 186;            // これ以上明るい縁の画素は、白さに応じて半透明にする
const EDGE_PASSES = 8;        // にじみを食う回数（多すぎると本体を削る）
const THIN_R = 2.5;           // 縁と地続きでない白のうち、この太さ以下＝髪などの隙間として抜く

// ── PNG を読む（8bit・非インタレース限定） ──────────────────────
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNGではない");
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const depth = buf[24], color = buf[25], interlace = buf[28];
  if (depth !== 8 || interlace !== 0) throw new Error("8bit・非インタレースのみ対応");
  const ch = color === 2 ? 3 : color === 6 ? 4 : 0;
  if (!ch) throw new Error("RGB/RGBA のみ対応（色種 " + color + "）");
  let off = 8, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(buf.slice(off + 8, off + 8 + len));
    off += 12 + len;
    if (type === "IEND") break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // フィルタを戻す
  const stride = w * ch, out = Buffer.alloc(w * h * ch);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {                       // Paeth
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

// ── PNG を書く（RGBA） ─────────────────────────────────────────
function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                    // フィルタなし（素直・十分小さい）
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
let _crcT = null;
function crc32(buf) {
  if (!_crcT) {
    _crcT = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); _crcT[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = _crcT[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return c ^ -1;
}

// ── 縁から繋がった白だけを背景として塗りつぶす ────────────────────
// 返り値は不透明度（0=完全に背景／255=完全に前景）。
//
// ★2段構え。
//   ①真っ白（WHITE以上）を縁から塗りつぶす＝確実な背景。
//   ②その縁に接している「白っぽい」画素を、白さに応じた半透明にしながら
//     少しずつ食い込ませる（SOFT まで）。これがアンチエイリアスの縁で、
//     ①だけだと髪のまわりに白い輪郭が残る（ユーザー報告の症状）。
//     食い込むのは背景と地続きの画素だけなので、服の中の白には届かない。
function backgroundAlpha(w, h, ch, data) {
  const isWhite = i => data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE;
  const alpha = new Uint8Array(w * h).fill(255);
  const bg = new Uint8Array(w * h);            // 完全な背景（さらに広げる起点）

  // ①白い画素を連結成分に分け、成分ごとに「背景か否か」を決める。
  //   ★縁から届く白だけを抜く方式では、髪束の隙間の白が残る。隙間は
  //     髪に囲まれていて画像の縁と地続きでないため、塗りつぶしが届かない
  //     （ユーザー指摘「髪の毛回りが抜けてない」の正体）。
  //   ★かといって白を一律に抜くと、白い服（バニーのパーカー等）が消える。
  //   ★区別は「面積」ではなく「太さ」でつける。
  //     面積で切ると白い服まで穴だらけになった（服の白も陰影で細かく
  //     割れていて、ひとつひとつは小さい）。実測すると差は太さに出る：
  //       髪の隙間 … 細い筋。内接半径2以下が1613個
  //       服の白   … 太い塊。内接半径3超が69個
  //     ・画像の縁に触れている          → 背景
  //     ・触れていなくて細い（筋）      → 髪などの隙間 → 背景
  //     ・触れていなくて太い（塊）      → 服 → 残す
  //   太さは距離変換（白でない場所からの距離）の最大値で測る。
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = isWhite(i * ch) ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; let v = dist[k];
    if (x > 0) v = Math.min(v, dist[k - 1] + 1);
    if (y > 0) v = Math.min(v, dist[k - w] + 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[k - w - 1] + 1.414);
    if (x < w - 1 && y > 0) v = Math.min(v, dist[k - w + 1] + 1.414);
    dist[k] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x; let v = dist[k];
    if (x < w - 1) v = Math.min(v, dist[k + 1] + 1);
    if (y < h - 1) v = Math.min(v, dist[k + w] + 1);
    if (x < w - 1 && y < h - 1) v = Math.min(v, dist[k + w + 1] + 1.414);
    if (x > 0 && y < h - 1) v = Math.min(v, dist[k + w - 1] + 1.414);
    dist[k] = v;
  }

  const seen = new Uint8Array(w * h);
  for (let sy = 0; sy < h; sy++) for (let sx = 0; sx < w; sx++) {
    const s = sy * w + sx;
    if (seen[s] || !isWhite(s * ch)) continue;
    const comp = [];
    const st = [s]; seen[s] = 1;
    let touchesEdge = false, maxR = 0;
    while (st.length) {
      const k = st.pop(), x = k % w, y = (k / w) | 0;
      comp.push(k);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
      if (dist[k] > maxR) maxR = dist[k];
      const nb = [];
      if (x > 0) nb.push(k - 1);
      if (x < w - 1) nb.push(k + 1);
      if (y > 0) nb.push(k - w);
      if (y < h - 1) nb.push(k + w);
      for (const n of nb) { if (!seen[n] && isWhite(n * ch)) { seen[n] = 1; st.push(n); } }
    }
    if (touchesEdge || maxR <= THIN_R) {
      for (const k of comp) { bg[k] = 1; alpha[k] = 0; }
    }
  }

  // ②縁のにじみを段階的に食う（数回で収束する。行き過ぎないよう回数で止める）
  for (let pass = 0; pass < EDGE_PASSES; pass++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (bg[k]) continue;
      // 背景に接しているか
      if (!((x > 0 && bg[k - 1]) || (x < w - 1 && bg[k + 1]) ||
            (y > 0 && bg[k - w]) || (y < h - 1 && bg[k + w]))) continue;
      const i = k * ch, mn = Math.min(data[i], data[i + 1], data[i + 2]);
      if (mn < SOFT) continue;                 // もう十分に濃い＝ここが本当の輪郭
      // 白いほど透明に。SOFT で不透明、WHITE で透明。
      const a = Math.max(0, Math.min(255, Math.round(255 * (WHITE - mn) / (WHITE - SOFT))));
      add.push([k, 255 - a]);
    }
    if (!add.length) break;
    add.forEach(([k, a]) => { alpha[k] = Math.min(alpha[k], a); if (a < 40) bg[k] = 1; });
  }
  return alpha;
}

// ── 縮小（不透明度で重みづけして平均する） ─────────────────────────
// ★背景の白を色に混ぜないこと。素直に平均すると縁が白っぽくなり、
//   せっかく抜いた輪郭にまた白いふちが戻ってしまう。
//
// ★もう一手：半透明の画素は「白と混ざった色」がそのまま入っている。
//   白を差し引いて元の色に戻す（逆合成）。これをしないと、髪の縁が
//   白ボケしたまま残る。C = a*F + (1-a)*255 を F について解く。
function unmixWhite(r, g, b, a) {
  if (a <= 0) return [255, 255, 255];
  if (a >= 250) return [r, g, b];
  const k = a / 255, inv = (1 - k) * 255;
  const f = v => Math.max(0, Math.min(255, Math.round((v - inv) / k)));
  return [f(r), f(g), f(b)];
}
function shrink(w, h, ch, data, alpha, nw) {
  const nh = Math.max(1, Math.round(h * nw / w));
  const out = Buffer.alloc(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(w, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.min(h, Math.ceil((y + 1) * sy));
      let r = 0, g = 0, b = 0, aw = 0, asum = 0, tot = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const k = yy * w + xx, a = alpha[k]; tot++; asum += a;
        if (!a) continue;
        const i = k * ch;
        const [fr, fg, fb] = unmixWhite(data[i], data[i + 1], data[i + 2], a);
        r += fr * a; g += fg * a; b += fb * a; aw += a;   // 不透明度で重みづけ
      }
      const o = (y * nw + x) * 4;
      if (!aw) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 0; continue; }
      out[o] = (r / aw) | 0; out[o + 1] = (g / aw) | 0; out[o + 2] = (b / aw) | 0;
      out[o + 3] = Math.round(asum / tot);
    }
  }
  return { w: nw, h: nh, data: out };
}

// ── 実行 ──────────────────────────────────────────────────────
const files = fs.readdirSync(DIR).filter(f => /_mini\.png$/.test(f)).sort();
let done = 0, skip = 0, before = 0, after = 0;
console.log("");
console.log("=== 衣装ミニ絵の白背景を抜く（" + files.length + "枚）===");
files.forEach(f => {
  const p = path.join(DIR, f);
  const buf = fs.readFileSync(p);
  before += buf.length;
  let img;
  try { img = decodePng(buf); } catch (e) { console.log("  ⚠ " + f + " 読めない: " + e.message); skip++; return; }
  if (img.ch === 4) { console.log("  ・" + f + " すでに透過"); skip++; after += buf.length; return; }
  const alpha = backgroundAlpha(img.w, img.h, img.ch, img.data);
  let clear = 0, soft = 0;
  for (let i = 0; i < alpha.length; i++) { if (!alpha[i]) clear++; else if (alpha[i] < 250) soft++; }
  const pct = Math.round(clear / alpha.length * 100);
  if (pct < 5) { console.log("  ⚠ " + f + " 背景らしき白が" + pct + "%しかない→触らない"); skip++; after += buf.length; return; }
  const sm = shrink(img.w, img.h, img.ch, img.data, alpha, OUT_W);
  const outBuf = encodePng(sm.w, sm.h, sm.data);
  if (!DRY) fs.writeFileSync(p, outBuf);
  after += outBuf.length;
  done++;
  console.log("  ✓ " + f.padEnd(30) + img.w + "x" + img.h + " → " + sm.w + "x" + sm.h +
              "  背景" + pct + "% 縁" + soft + "  " + (buf.length / 1024 | 0) + "KB → " + (outBuf.length / 1024 | 0) + "KB");
});
console.log("");
console.log((DRY ? "【下見のみ】" : "") + "変換 " + done + "枚 ／ 触らず " + skip + "枚 ／ 合計 " +
            (before / 1048576).toFixed(1) + "MB → " + (after / 1048576).toFixed(1) + "MB");
