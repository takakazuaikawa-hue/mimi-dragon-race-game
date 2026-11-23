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
  "shingan_race", "epilogue_engine", "poro", "data_chapters", "reading_journal",
  "island_life_loop", "island_discovery_stories", "island_discovery", "scout_engine"
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

test("★F5の回帰：shinganDevUnlock が門番の破れた state を作らない", () => {
  const ctx = fresh();
  runInContext(`__r = shinganDevUnlock({ replay: true })`, ctx);
  const p = runInContext("chapterInvariants(state)", ctx);
  assert(p.length === 0, `壊れた state を作った:\n      - ${p.join("\n      - ")}`);
  assert(ctx.__r.unlocked === true, "神眼レースが解放されていない");
  assert(ctx.__r.allScouted === true, "8頭が揃っていない");
  // 門番＝既読章の顧問が全員登場している（従来は第5話だけ既読で mizu/sumika/makura が false だった）
  const met = runInContext(`["sake","mizu","sumika","makura","celestia"].map(k => advisorMet(k))`, ctx);
  assert(met.every(Boolean), `顧問が未登場のまま: ${JSON.stringify(met)}`);
});

test("健全な新規セーブでは不変条件に問題が無い", () => {
  const ctx = fresh();
  const p = runInContext("chapterInvariants(state)", ctx);
  assert(p.length === 0, `新規セーブで問題が出た: ${JSON.stringify(p)}`);
});

test("相棒の取材案内は単勝の残数から鑑定の残り完走数に切り替わる", () => {
  const ctx = fresh();
  const run = code => runInContext(code, ctx);
  run("state.player.wins=1");
  assert(run('poroRaceLead().includes("単勝をあと1回")'), "未達の単勝数が違う");
  run('state.player.wins=2;setStoryFlag("poroMet",true);_poroMarkBeat()');
  assert(run('poroRaceLead().includes("あと" + PORO_APPRAISAL_GAP + "戦")'), "鑑定の待ち時間が違う");
  run("state.player.completedRaces += PORO_APPRAISAL_GAP");
  assert(run('poroRaceLead().includes("図鑑で受け取")'), "鑑定が届く場所が違う");
});

test("メーターを押し返した時の案内は、相棒と取材便の残り頭数を見て切り替わる", () => {
  const ctx = fresh();
  const run = code => runInContext(code, ctx);
  ctx.showInfoPopup = (title, message) => { ctx.lastPopup = message; };
  run("onFinalReady()");
  assert(ctx.lastPopup.includes("あと8頭") && ctx.lastPopup.includes("相棒"), "相棒との出会いを案内していない");
  run('setStoryFlag("poroMet", true); setStoryFlag("poroFound", true); onFinalReady()');
  assert(ctx.lastPopup.includes("あと7頭") && ctx.lastPopup.includes("取材便"), "取材便で会える残り頭数が違う");
  run('SHINGAN_ROSTER.filter(d => d.id !== "poro").forEach(d => { state.player.collection[d.id] = { scouted: true }; }); onFinalReady()');
  assert(ctx.lastPopup.includes("八頭の取材もそろった"), "全頭の取材が終わっても予想紙に進めない");
});

test("アヤに現地で自分の体験を話すと第四話へ進み、本音・過去の履歴・会計を保つ", () => {
  const ctx = fresh();
  const run = code => runInContext(code, ctx);
  run('chapterApply("3",{read:true}); const p=state.player, L=IslandLifeLoop;');
  run('const purse=()=>JSON.stringify([state.player.coins,assetsPeak(state),state.player.outfitsBought,state.player.island]), initial=purse();');
  run('const local={enabled:true,completedRaces:p.completedRaces,openSpots:["mall"],currentSpotId:"mall",currentOutfitId:"buniqro",ownedOutfits:[{id:"buniqro",name:"ブニクロ普段着"},{id:"jungle",name:"手持ちの勝負服"}]};');
  run('const start=()=>L.record(L.start(null,"style",local),{type:"visit",spotId:"mall"},local);');
  run('const experienced=L.record(start(),{type:"outfit",outfitId:"jungle",previousOutfitId:"buniqro"},{...local,currentOutfitId:"jungle"});');
  run('p.islandLife=L.respond(start(),"unsure","in_person",local)');
  assert(!run('chapterAvailable("4")'), "顔を合わせ、未体験のまま見送っただけで第四話を開いた");
  run('p.islandLife=experienced');
  assert(!run('chapterAvailable("4")'), "感想を伝える前に第四話を開いた");
  run('p.islandLife=L.respond(experienced,"different","sns",local)');
  assert(!run('chapterAvailable("4")'), "現地の対話を経ていない");
  for (const opinion of ["different","unsure","again"]) {
    run('p.islandLife=L.respond(experienced,"'+opinion+'","in_person",local)');
    assert(run('chapterAvailable("4") && !chapterAvailable("5") && !advisorMet("makura") && nextGoal().id==="meetMakura"'), "本音を話した後の第四話の開放・次の目標が違う");
    assert(run('chapterFourLifeStatus().outing.experience.id==="jungle"'), "実際に選んだ経験が消えた");
  }
  run('delete p.islandLife.firstLocalStory; p.islandLife.favorite=null; p.islandLife.conversations={}; delete p.islandLife.history[0].visitedSpotId;');
  assert(run('chapterFourLifeStatus().ready'), "旧形式の現地会話が復元されない");
  run('for(let i=0;i<8;i++){let a=L.start(p.islandLife,"style",local); p.islandLife=L.respond(a,"unsure","in_person",local);} saveGame();loadGame()');
  assert(run('chapterFourLifeStatus().outing.experience.id==="jungle" && chapterAvailable("4")'), "手帳の履歴が流れて、認定済みの体験が消えた");
  run('setStoryFlag("_chapter_intro_3",false)');
  assert(!run('chapterAvailable("4")'), "第三話を飛ばした");
  run('setStoryFlag("_chapter_intro_3",true);chapterApply("4",{read:true})');
  assert(run('chapterVerify("4").length===0 && advisorMet("makura") && purse()===initial && assetsPeak(state)<storyUnlockAt("4")'), "資産を付与したか、低資産で第四話を検算できない");
});

test("無料の現地調査で第四話を開き、第五話に同じ発見を持ち越す", () => {
  const ctx = fresh();
  const run = code => runInContext(code, ctx);
  run('chapterApply("3",{read:true}); const p=state.player, E=IslandDiscovery; const at=currentSpotId=>({enabled:true,openSpots:["market","tanada"],currentSpotId});');
  run('p.islandDiscovery=E.observe(null,"water_jars",at("market"));p.islandDiscovery=E.observe(p.islandDiscovery,"water_fork",at("tanada"));p.islandDiscovery=E.propose(p.islandDiscovery,"water","upstream",["water_jars","water_fork"],at("market"));');
  assert(!run('chapterAvailable("4")'), "二つの手掛かりや未確認の仮説だけで第四話を開いた");
  run('p.islandDiscovery=E.inspect(p.islandDiscovery,"water","trace",at("tanada"));');
  assert(run('chapterAvailable("4") && chapterFourLifeStatus().findings===1 && chapterFiveFieldStatus().findings===1 && !chapterAvailable("5")'), "発見1件の第四話と第五話での扱いが違う");
  run('chapterApply("4",{read:true});saveGame();loadGame()');
  assert(run('chapterVerify("4").length===0 && !chapterAvailable("5") && assetsPeak(state)<1000000'), "確定発見経路を再読込できない");
});

test("現地で異なる発見2件と一戦の手帖で第五話へ進み、財布・最高資産・工事を保持する", () => {
  const ctx = fresh();
  const run = code => runInContext(code, ctx);
  run(`chapterApply("4",{read:true});
    const p = state.player, at = currentSpotId => ({enabled:true,
      openSpots:["market","tanada","tsubo_roji","kirimina"],currentSpotId});
    const E = IslandDiscovery;
    for (const [id,spot] of [["water_jars","market"],["water_fork","tanada"],
      ["vinegar_crates","tsubo_roji"],["return_cargo","kirimina"]])
      p.islandDiscovery = E.observe(p.islandDiscovery,id,at(spot));
    p.islandDiscovery=E.propose(p.islandDiscovery,"water","upstream",["water_jars","water_fork"],at("market"));
    p.islandDiscovery=E.inspect(p.islandDiscovery,"water","trace",at("tanada"));
    p.islandDiscovery=E.propose(p.islandDiscovery,"trade","roundtrip",["vinegar_crates","return_cargo"],at("kirimina"));
    p.islandDiscovery=E.inspect(p.islandDiscovery,"trade","count",at("kirimina"));
    p.collection.poro={scouted:true}; p.flags.poroFound=true; p.flags.dragonScoutUnlocked=true;
    p.collection.goka={seen:true}; p.collection.rubel={seen:true};
    p.collection.unknownDragon={scouted:true};`);
  assert(run('chapterFiveFieldStatus().findings === 1 && !chapterAvailable("5")'), "手掛かり、未確定の調査を数えた");
  run('p.islandDiscovery=E.inspect(p.islandDiscovery,"trade","labels",at("kirimina"))');
  assert(run('chapterFiveFieldStatus().findings === 2 && !chapterAvailable("5")'), "目撃やポロだけで取材が完了した");
  run('p.collection.rubel.scouted=true');
  assert(!run('chapterAvailable("5")'), "第四話で届いた声を聞く前に第五話が開いた");
  run('const day=_epochDay(); p.flags.phoneBought=true; p.makuraPostMemory={id:"my_"+day+"_1",day,img:outfitImg(DEFAULT_OUTFIT),text:"今日の装い",reacts:3}');
  assert(run('!SHINGAN_ROSTER.some(d=>d.id==="rubel") && chapterFiveFieldStatus().scouted === 1 && chapterAvailable("5") && !shinganAllScouted()'), "通常の竜との成立が第五話と神眼で区別されていない");
  run('p.collection.rubel.scouted=false');
  run('p.collection.goka.scouted=true');
  assert(run('chapterFiveFieldStatus().scouted === 1 && chapterAvailable("5")'), "スカウト経路が開かない");
  run('p.collection.goka.scouted=false; p.readingNotes=[{id:"race-1"}]');
  assert(!run('chapterAvailable("5")'), "不完全な手帖記録が有効");
  run(`const dragon=DRAGONS[0]; const note=ReadingJournal.capture(p,
    {settled:true,betResult:{hit:false},raceResult:{entries:[{dragon,rank:4}]},
    race:{id:"race_test",cup:"取材で見た競走"},bet:{type:"win",selections:[dragon.id]},betReasonUsed:"data"},DRAGONS,{});
    p.readingNotes=ReadingJournal.pin([],note).notes;`);
  assert(run('chapterAvailable("5") && chapterFiveFieldStatus().notes === 1'), "外れた実予想や旧形式の既存手帖を評価しなかった");
  run('setStoryFlag("_chapter_intro_4",false)');
  assert(!run('chapterAvailable("5")'), "第四話を飛ばした");
  run('setStoryFlag("_chapter_intro_4",true); const accounting=()=>JSON.stringify([p.coins,assetsPeak(state),p.island]); const before=accounting()');
  assert(run('chapterAvailable("5") && !advisorMet("celestia") && !scoutLocationUnlocked("sky")'), "出会い前に第五話の後続機能を開けた");
  run('setStoryFlag("_chapter_intro_5",true);epilogueStart();saveGame();loadGame()');
  assert(run('chapterAvailable("5") && chapterVerify("5").length===0 && advisorMet("celestia") && scoutLocationUnlocked("sky")'), "低資産での第五話の再開に失敗");
  assert(run('JSON.stringify([state.player.coins,assetsPeak(state),state.player.island])===before'), "財布・最高資産・島施設を付与した");
  assert(run('!shinganUnlocked() && !shinganAllScouted()'), "第五話を読んだだけで決戦にも進めた");
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
