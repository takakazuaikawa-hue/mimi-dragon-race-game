#!/usr/bin/env node
// =============================================================================
// tools/audit_dead_features.js — 「置いてあるだけで動かない機能」を洗い出す
// =============================================================================
// ★なぜ要るか
//   ユーザー指摘：「これは貼ってフラグの残りですかね？ なぜ放置されてるの？
//   ほかにも放置されている機能がたくさんあるんじゃない？」
//
//   実際、村の施設6つは state に 0 で初期化され、画面に「未解放」と表示され、
//   <値を上げるコードがどこにも無い>＝永久に開かない飾りだった。
//   同じ形（初期化と表示はあるが、更新が無い）を機械で探す。
//   人が読んで気づくのは無理な規模なので、突き合わせでしか見つからない。
//
// ★誤検出でつまずいた点（同じ穴に落ちないよう記録）
//   ・キー名で探すと動的キー書き込みを見落とす。
//     実コードは state.player.completedByRank[c.race.rank] = ... と書くので、
//     「.1 が代入されていない」は嘘。塊の名前で探すこと。
//   ・関数の呼び出し探しは、行頭定義（＝画面の入口）だけを対象にする。
//     race_canvas.js の内部関数まで数えると「呼ばれていない」と誤る。
//
// 使い方: node tools/audit_dead_features.js        … 一覧
//         node tools/audit_dead_features.js -v     … 全件
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const VERBOSE = process.argv.includes("-v");

const files = fs.readdirSync(path.join(ROOT, "js")).filter(f => f.endsWith(".js"))
  .map(f => ({ name: f, src: fs.readFileSync(path.join(ROOT, "js", f), "utf8").replace(/\r/g, "") }));
const all = files.map(f => f.src).join("\n");
const strip = s => s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const code = strip(all);

const found = [];

// 承知のうえで空のまま残している塊（理由は state.js のその場に書く）。
// ここに足すのは「画面に出していない・約束もしていない」ものだけ。
const KNOWN_EMPTY = {
  facilities: "初期構想の名残。画面からは撤去済みで、assets_engine の読み先としてだけ残す"
};

// ── ① 「順次アップデート」「準備中」など、未完成を画面に告知している場所 ──
//    プレイヤーには「作りかけを見せられている」としか映らない。
{
  const RE = /(順次アップデート|近日|coming soon|実装予定|後日実装|工事中)/i;
  files.forEach(f => {
    f.src.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*)/.test(ln)) return;          // コメントは除く
      const m = ln.match(/["'`]([^"'`]{6,})["'`]/g);
      if (!m) return;
      m.forEach(lit => {
        if (RE.test(lit) && /[ぁ-んァ-ヶ一-龠]/.test(lit))
          found.push({ kind: "未完成の告知", where: f.name + ":" + (i + 1), what: lit.slice(1, 70) });
      });
    });
  });
}

// ── ② state に置いてあるのに、一度も更新されない塊 ────────────────────
{
  const st = files.find(f => f.name === "state.js");
  if (st) {
    const seen = new Set();
    for (const m of st.src.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) {
      const group = m[1], body = m[2];
      // ★「0の項目が2つ以上」に絞ると取りこぼす。
      //   entryEncouragement は {available:false, remainingUses:0, candidateDragonIds:[]} で
      //   0の項目が1つしかなく、初期化しか無いのに検査をすり抜けていた。
      //   項目の型は問わず、「まとまりとして一度も書き換えられていない」かどうかで見る。
      const keys = [...body.matchAll(/(\w+)\s*:/g)].map(x => x[1]);
      if (keys.length < 2 || seen.has(group)) continue;
      seen.add(group);
      // ★state.js の外だけを見てもいけない。notesUnlocked は state.js の中で
      //   書き換えられていて、それを「書き込みが無い」と誤判定した。
      //   見るべきは「初期化以外の書き込みがあるか」なので、初期化の {...} だけ
      //   取り除いた全ソースを相手にする。
      const init = new RegExp(group + "\\s*:\\s*\\{[^{}]*\\}", "g");
      const rest = code.replace(init, "");
      // キーは [動的] でも .固定名 でも拾えるようにする。
      const w = new RegExp(group + "\\s*(\\[[^\\]]*\\]|\\.\\w+)?\\s*(=[^=]|\\+=|-=|\\+\\+|--)");
      // 承知のうえで枠だけ残しているもの（state.js に理由を書いてある）は除く
      if (KNOWN_EMPTY[group]) continue;
      if (!w.test(rest))
        found.push({ kind: "更新されない値", where: "state." + group,
                     what: keys.length + "項目すべて初期値のまま／書き込みが無い" });
    }
  }
}

// ── ③ 画面の入口なのに、どこからも呼ばれない ─────────────────────────
//    行頭の function renderXxx だけを見る（内部関数は対象外）。
{
  const renders = new Set();
  files.forEach(f => {
    for (const m of f.src.matchAll(/^function\s+(render[A-Z]\w*)/gm)) renders.add(m[1]);
  });
  const nav = files.find(f => f.name === "nav.js");
  // 「後方互換」と書き添えてある入口は、呼ばれなくても意図的な残置なので数えない。
  const compat = new Set();
  files.forEach(f => {
    const ln = f.src.split("\n");
    ln.forEach((s, i) => {
      const m = s.match(/^function\s+(render[A-Z]\w*)/);
      if (m && /後方互換|互換|deprecated/i.test((ln[i - 1] || "") + (ln[i - 2] || ""))) compat.add(m[1]);
    });
  });
  renders.forEach(fn => {
    if (compat.has(fn)) return;
    const calls = (code.match(new RegExp("(?<!function\\s)\\b" + fn + "\\s*\\(", "g")) || []).length;
    const defs = (code.match(new RegExp("function\\s+" + fn + "\\s*\\(", "g")) || []).length;
    if (calls - defs > 0) return;
    if (nav && nav.src.includes(fn)) return;          // goto の対応表から到達できる
    found.push({ kind: "呼ばれない画面", where: fn + "()", what: "定義はあるが呼び出しも対応表への登録も無い" });
  });
}

// ── ④ 押しても何も起きないボタン ────────────────────────────────────
{
  files.forEach(f => {
    f.src.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*)/.test(ln)) return;
      if (/\.onclick\s*=\s*(\(\)\s*=>\s*\{\s*\}|function\s*\(\)\s*\{\s*\})/.test(ln))
        found.push({ kind: "空のボタン", where: f.name + ":" + (i + 1), what: ln.trim().slice(0, 70) });
    });
  });
}

// ── 出力 ────────────────────────────────────────────────────────────
const byKind = {};
found.forEach(x => (byKind[x.kind] = byKind[x.kind] || []).push(x));
console.log("");
console.log("=== 放置されている機能の検査 ===");
if (!found.length) { console.log("✅ 見つからず"); process.exit(0); }
Object.keys(byKind).forEach(k => {
  console.log("");
  console.log("■ " + k + "（" + byKind[k].length + "件）");
  const list = VERBOSE ? byKind[k] : byKind[k].slice(0, 12);
  list.forEach(x => console.log("   " + x.where.padEnd(30) + " " + x.what));
  if (!VERBOSE && byKind[k].length > 12) console.log("   … ほか " + (byKind[k].length - 12) + "件（-v で全部）");
});
console.log("");
console.log("計 " + found.length + "件");
