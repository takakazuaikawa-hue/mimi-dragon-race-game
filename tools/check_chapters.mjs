#!/usr/bin/env node
// =========================================================================
// tools/check_chapters.mjs — 章ゲートと不変条件の回帰テスト（依存ゼロ・Node標準のみ）
//
//   実行:  node tools/check_chapters.mjs
//   正本:  docs/CHAPTER_STATE_DESIGN.md ／ js/data_chapters.js
//
//   なぜ外部のテストランナーを入れないか（設計文書 §E）：
//     Vitest/Jest は ESM+transform 前提で、この repo の classic script（index.html に
//     80本以上をグローバルで積む）とは相性が悪い。動かすには package.json と依存と
//     ソース改変（export）まで払って、得られるのはアサーションだけ。
//     一方この repo には既に依存ゼロの Node ハーネスの前例がある（check.mjs /
//     audit_facts.js / sim_mall_run.js）。その作法にそのまま乗る。
//
//   何をテストするか：
//     1) 全8章について chapterApply → ゲートが開き、chapterVerify が空
//     2) 壊れた state を chapterInvariants が捕まえる（既知バグの回帰ガード）
//        - 飛び読み（_chapter_intro_5 だけ）＝shinganDevUnlock が作る型
//        - 正規クリアでクリア後コンテンツが開かない（F4で修正済み）
//
//   限界（正直に書いておく）：
//     ui_*.js は DOM 依存が濃いので vm には載らない（sim_mall_run.js が同じ事情を
//     既に記録している）。よってここで見られるのはデータ層とゲート層まで。
//     UI の確認はデバッグ章ジャンプ（F3）＋実機プレイが担う。
//
//   終了コード: 失敗があれば 1。
// =========================================================================
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// vm に流し込む順（index.html の並びに合わせる。ui_* は DOM 依存なので載せない）。
const FILES = [
  "utils", "data_dragons", "data_dragons_ext", "data_ranks", "data_races", "data_assets",
  "state", "assets_engine", "event_hooks", "lifetree_engine", "goals", "progression",
  "shingan_race", "epilogue_engine", "poro", "data_chapters"
];

function fresh() {
  const store = {};
  const noop = () => {};
  const ctx = createContext({
    console,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    // DOM は「無い」ことにする。data 層のコードは typeof guard を通すので落ちない。
    document: { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add: noop, remove: noop } }) },
    setTimeout: noop, clearTimeout: noop, requestAnimationFrame: noop,
    Math, JSON, Date, Object, Array, String, Number, Boolean, Promise, Error, RegExp, Map, Set, isNaN, parseInt, parseFloat
  });
  ctx.window = ctx;                                    // 「window があれば window へ公開」する行を通す
  ctx.globalThis = ctx;
  for (const f of FILES) {
    const src = readFileSync(`${ROOT}js/${f}.js`, "utf8");
    try { runInContext(src, ctx, { filename: `js/${f}.js` }); }
    catch (e) { throw new Error(`読み込み失敗 js/${f}.js: ${e.message}`); }
  }
  runInContext("resetGame()", ctx);
  return ctx;
}

// ── ちいさなテストランナー（依存ゼロ） ──
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log("章ゲートと不変条件の回帰テスト（tools/check_chapters.mjs）\n");

// ── 1) 全章：再現できて、ゲートが開き、検算が空 ──
console.log("1) 各章を chapterApply で再現する");
{
  const probe = fresh();
  const ids = runInContext("CHAPTERS.map(c => c.id)", probe);
  for (const id of ids) {
    test(`章 ${id}：ゲートが開き、検算が空`, () => {
      const ctx = fresh();
      ctx.__id = id;
      const r = runInContext("chapterApply(__id, { read: true })", ctx);
      assert(r.ok, `chapterApply が失敗: ${r.err}`);
      assert(r.problems.length === 0, `検算に問題:\n      - ${r.problems.join("\n      - ")}`);
      const open = runInContext("chapterMeta(__id).gate(state)", ctx);
      assert(open === true, "ゲートが開いていない");
    });
  }
}

// ── 2) 壊れた state を検算器が捕まえる（既知バグの回帰ガード） ──
console.log("\n2) 壊れた state を chapterInvariants が捕まえる");

test("飛び読み（第5話だけ既読）を I1 が捕まえる", () => {
  const ctx = fresh();
  runInContext(`setStoryFlag("_chapter_intro_5", true)`, ctx);
  const p = runInContext("chapterInvariants(state)", ctx);
  assert(p.some(s => s.startsWith("I1")), `I1 が出ていない: ${JSON.stringify(p)}`);
});

test("metMakura だけ立った state を I2 が捕まえる", () => {
  const ctx = fresh();
  runInContext(`setStoryFlag("metMakura", true)`, ctx);
  const p = runInContext("chapterInvariants(state)", ctx);
  assert(p.some(s => s.startsWith("I2")), `I2 が出ていない: ${JSON.stringify(p)}`);
});

test("★F4の回帰：edFlag だけ立って gameCleared が無い state を I9 が捕まえる", () => {
  const ctx = fresh();
  runInContext(`
    var e = state.player.epilogue || (state.player.epilogue = {});
    e.active = true; e.edFlag = true;
    setStoryFlag("_chapter_intro_1", true); setStoryFlag("_chapter_intro_2", true);
    setStoryFlag("_chapter_intro_3", true); setStoryFlag("_chapter_intro_4", true);
    setStoryFlag("_chapter_intro_5", true); setStoryFlag("metMakura", true);
  `, ctx);
  const p = runInContext("chapterInvariants(state)", ctx);
  assert(p.some(s => s.startsWith("I9")), `I9 が出ていない: ${JSON.stringify(p)}`);
});

test("★F4の回帰：ED を正規に再現すると I9 が出ない（グルメレースが開く）", () => {
  const ctx = fresh();
  const r = runInContext(`chapterApply("ED", { read: true })`, ctx);
  assert(!r.problems.some(s => s.startsWith("I9")), `I9 が残っている: ${JSON.stringify(r.problems)}`);
  const unlocked = runInContext(`getStoryFlag("poroGourmetRaceUnlocked")`, ctx);
  assert(unlocked === true, "poroGourmetRaceUnlocked が立っていない＝グルメレースが開かない");
});

test("健全な新規セーブでは不変条件に問題が無い", () => {
  const ctx = fresh();
  const p = runInContext("chapterInvariants(state)", ctx);
  assert(p.length === 0, `新規セーブで問題が出た: ${JSON.stringify(p)}`);
});

// ── 3) 表そのものの健全性 ──
console.log("\n3) 章の表の健全性");

test("required は累積になっている（後の章ほど増える・減らない）", () => {
  const ctx = fresh();
  const lens = runInContext("CHAPTERS.map(c => c.required.length)", ctx);
  for (let i = 1; i < lens.length; i++) assert(lens[i] >= lens[i - 1], `章 ${i} で必須が減っている: ${JSON.stringify(lens)}`);
});

test("required に key の重複が無い", () => {
  const ctx = fresh();
  const dup = runInContext(`
    (function(){
      var bad = [];
      CHAPTERS.forEach(function(c){
        var seen = {};
        c.required.forEach(function(r){ if (seen[r.key]) bad.push(c.id + ":" + r.key); seen[r.key] = 1; });
      });
      return bad;
    })()
  `, ctx);
  assert(dup.length === 0, `重複: ${JSON.stringify(dup)}`);
});

test("gate は data_assets.js の chapterAvailable を参照している（3つ目の正本を作っていない）", () => {
  const src = readFileSync(`${ROOT}js/data_chapters.js`, "utf8");
  const table = src.slice(src.indexOf("var CHAPTERS = ["), src.indexOf("function chapterMeta"));
  const gates = table.match(/gate: function[^\n]*/g) || [];
  const own = gates.filter(g => !/_chAvail|epilogue|return true/.test(g));
  assert(own.length === 0, `独自のゲート条件を書いている行がある:\n      ${own.join("\n      ")}`);
});

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} 通過 / ${fail} 失敗`);
process.exit(fail === 0 ? 0 : 1);
