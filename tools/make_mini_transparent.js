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
const WHITE = 238;            // これ以上明るければ「白」とみなす（縁からの連結のみ背景）

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
function backgroundMask(w, h, ch, data) {
  const isWhite = i => data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE;
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x; if (bg[k]) return;
    if (!isWhite(k * ch)) return;
    bg[k] = 1; stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return bg;
}

// ── 縮小（背景を混ぜないよう、透明ぶんを除いて平均する） ────────────
function shrink(w, h, ch, data, bg, nw) {
  const nh = Math.max(1, Math.round(h * nw / w));
  const out = Buffer.alloc(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(w, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.min(h, Math.ceil((y + 1) * sy));
      let r = 0, g = 0, b = 0, n = 0, tot = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const k = yy * w + xx; tot++;
        if (bg[k]) continue;                       // 背景の白は色に混ぜない
        const i = k * ch; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      const o = (y * nw + x) * 4;
      if (!n) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 0; continue; }
      out[o] = (r / n) | 0; out[o + 1] = (g / n) | 0; out[o + 2] = (b / n) | 0;
      out[o + 3] = Math.round(255 * n / tot);      // 縁は面積比でなめらかに
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
  const bg = backgroundMask(img.w, img.h, img.ch, img.data);
  let bgN = 0; for (let i = 0; i < bg.length; i++) if (bg[i]) bgN++;
  const pct = Math.round(bgN / bg.length * 100);
  if (pct < 5) { console.log("  ⚠ " + f + " 背景らしき白が" + pct + "%しかない→触らない"); skip++; after += buf.length; return; }
  const sm = shrink(img.w, img.h, img.ch, img.data, bg, OUT_W);
  const outBuf = encodePng(sm.w, sm.h, sm.data);
  if (!DRY) fs.writeFileSync(p, outBuf);
  after += outBuf.length;
  done++;
  console.log("  ✓ " + f.padEnd(30) + img.w + "x" + img.h + " → " + sm.w + "x" + sm.h +
              "  背景" + pct + "%  " + (buf.length / 1024 | 0) + "KB → " + (outBuf.length / 1024 | 0) + "KB");
});
console.log("");
console.log((DRY ? "【下見のみ】" : "") + "変換 " + done + "枚 ／ 触らず " + skip + "枚 ／ 合計 " +
            (before / 1048576).toFixed(1) + "MB → " + (after / 1048576).toFixed(1) + "MB");
