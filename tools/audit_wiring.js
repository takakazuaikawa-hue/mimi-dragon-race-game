#!/usr/bin/env node
// =============================================================================
// tools/audit_wiring.js — 「存在しない関数を呼んでいる配線」を洗い出す
// =============================================================================
// ★なぜ要るか
//   このゲームはボタンの動作を関数呼び出しで繋いでいる。呼び先の名前を
//   間違えても、多くは try/catch や typeof チェックに吸われて無言で死ぬ。
//   実際、実況エンジンでも betHit() / finishTauOf() という存在しない名前を
//   呼んでいて、機能が丸ごと動いていなかった（構文検査は通ってしまう）。
//   画面を1つずつ触って確かめるのは現実的でないので、呼び名を突き合わせる。
//
// 使い方:
//   node tools/audit_wiring.js            … 未定義の呼び出しを一覧
//   node tools/audit_wiring.js -v         … 呼び出し箇所の行も出す
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const VERBOSE = process.argv.includes("-v");

const files = fs.readdirSync(path.join(ROOT, "js"))
  .filter(f => f.endsWith(".js"))
  .map(f => ({ name: "js/" + f, src: fs.readFileSync(path.join(ROOT, "js", f), "utf8") }));

// ── 定義されている名前を集める ───────────────────────────────
// ★行頭に限定すると、行の途中で宣言された内部関数を取りこぼして
//   誤検出になる（var rand = function () {...} など）。どこにあっても拾う。
const defined = new Set();
files.forEach(f => {
  for (const m of f.src.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  for (const m of f.src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
  for (const m of f.src.matchAll(/([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?(?:function|\()/g)) defined.add(m[1]);
  for (const m of f.src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
  // 分割代入・引数名も「その場にある名前」として扱う
  for (const m of f.src.matchAll(/\(\s*([A-Za-z_$][\w$]*)\s*(?:,|\)\s*=>)/g)) defined.add(m[1]);
  // オブジェクトの短縮メソッド記法（ spot(x, y) { ... } ）も定義とみなす
  for (const m of f.src.matchAll(/^\s{2,}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) defined.add(m[1]);
  // Promise の resolve / reject などコールバック引数名
  for (const m of f.src.matchAll(/\(\s*([A-Za-z_$][\w$]*)\s*(?:,\s*[A-Za-z_$][\w$]*\s*)?\)\s*=>/g)) defined.add(m[1]);
  // ★関数の仮引数もすべて定義扱いにする。
  //   showNavConfirm(icon, title, desc, onGo) の onGo() を「未定義の呼び出し」
  //   として挙げてしまい、本物の不具合が5件の誤検出に埋もれていた。
  for (const m of f.src.matchAll(/function\s*[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g))
    m[1].split(",").forEach(a => { const n = a.trim().split(/[\s=]/)[0]; if (/^[A-Za-z_$][\w$]*$/.test(n)) defined.add(n); });
});

// ブラウザ側と標準のものは対象外
const BUILTIN = new Set(("Array Boolean Date Error Function Image Audio JSON Map Math Number Object " +
  "Promise Proxy RegExp Set String Symbol WeakMap alert atob btoa clearInterval clearTimeout confirm " +
  "decodeURI decodeURIComponent encodeURI encodeURIComponent eval fetch isFinite isNaN parseFloat " +
  "parseInt prompt requestAnimationFrame cancelAnimationFrame setInterval setTimeout structuredClone " +
  "queueMicrotask getComputedStyle matchMedia FormData URL URLSearchParams Intl Blob FileReader " +
  "IntersectionObserver MutationObserver ResizeObserver CustomEvent Event AbortController " +
  "Float32Array Float64Array Int8Array Int16Array Int32Array Uint8Array Uint16Array Uint32Array " +
  "Uint8ClampedArray ArrayBuffer DataView BigInt WeakSet Reflect " +
  "if for while switch catch return typeof function new delete void in of do else try").split(/\s+/));

// CSS の関数記法は文字列の中にしか出てこない。名前だけ見ると呼び出しに見える。
const CSSFN = new Set(("blur brightness contrast saturate grayscale sepia invert opacity drop-shadow " +
  "translate translateX translateY translateZ translate3d scale scaleX scaleY rotate rotateX rotateY " +
  "hue-rotate skew skewX skewY matrix perspective calc var url rgb rgba hsl hsla linear-gradient " +
  "radial-gradient conic-gradient cubic-bezier steps clamp min max minmax repeat attr counter " +
  "not is where has nth-child nth-of-type env").split(/\s+/));

// ── 呼び出されている名前を集めて、定義に無いものを拾う ────────────
const miss = {};
files.forEach(f => {
  const lines = f.src.split("\n");
  lines.forEach((ln, i) => {
    // コメント行は見ない
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    // ★文字列の中は見ない。CSS の filter や transform を呼び出しと誤読するため。
    // ★行末のコメントも落とす。日本語・英語の説明文に括弧が来ると
    //   「関数呼び出し」に見えてしまい、誤検出が大量に出る。
    // ★先に \r を落とすこと。このリポジトリは CRLF で、JavaScript の . は
    //   \r を行終端として扱うため、 //.*$ が末尾コメントに一致しない。
    //   これに気づかず「コメント内の括弧」を関数呼び出しとして大量に誤検出した。
    const bare = ln.replace(/\r/g, "")
                   .replace(/"(?:[^"\\]|\\.)*"/g, '""')
                   .replace(/'(?:[^'\\]|\\.)*'/g, "''")
                   .replace(/`(?:[^`\\]|\\.)*`/g, "``")
                   .replace(/\/\/.*$/, "")
                   .replace(/\/\*.*?\*\//g, "");
    for (const m of bare.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]{2,})\s*\(/g)) {
      const name = m[2];
      if (BUILTIN.has(name) || CSSFN.has(name) || defined.has(name)) continue;
      // 直前が typeof チェックなら「無くてもよい」意図なので除外
      const before = bare.slice(0, m.index + m[0].length);
      if (/typeof\s+[A-Za-z_$][\w$]*\s*===?\s*["']function["']/.test(before)) continue;
      (miss[name] = miss[name] || []).push(f.name + ":" + (i + 1) + "  " + ln.trim().slice(0, 90));
    }
  });
});

// ── 結果 ──────────────────────────────────────────────────
const keys = Object.keys(miss).sort((a, b) => miss[b].length - miss[a].length);
console.log("");
console.log("=== 配線検査：定義が見つからない呼び出し ===");
console.log("読み込んだファイル: " + files.length + "本 ／ 定義された名前: " + defined.size + "個");
console.log("");
if (!keys.length) { console.log("✅ 未定義の呼び出しなし"); process.exit(0); }
keys.forEach(k => {
  console.log("  ❌ " + k + "()  ×" + miss[k].length);
  (VERBOSE ? miss[k] : miss[k].slice(0, 2)).forEach(l => console.log("       " + l));
});
console.log("");
console.log("計 " + keys.length + "種");
