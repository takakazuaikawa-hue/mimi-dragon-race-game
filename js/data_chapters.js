// =========================================================================
// data_chapters.js — 章の「状態」の単一記述（デバッグ章ジャンプ＋整合診断）
// =========================================================================
// 正本：docs/CHAPTER_STATE_DESIGN.md（7体の並列調査で実装から起こした台帳）
//
// ★これは新しい解放ゲートではない。解放の正本は data_assets.js の
//   chapterAvailable() のまま。gate() はそれを呼ぶだけの薄いラッパにする。
//   理由＝このリポジトリの事故は全部「同じ条件を2か所に書いて片方が古びた」型
//   （STORY_UNLOCK_AT vs 実ゲート、到達不能な assets_engine.js:202-206、
//     docs/PROGRESSION_DESIGN.md の章ゲート表）。3つ目の正本を作らない。
//
//   ここが持つ固有の情報は「その章に立っているとき state はどうなっているか」だけ。それを
//     (a) 再現する chapterApply()  … デバッグ章ジャンプ
//     (b) 検算する chapterVerify() … 整合診断（devcheck と同じ思想）
//   の両方が読む。同じ表を読むので再現と検算が原理的にズレない。
//
// ★表示/メタ専用。着順・オッズ・配当・FinalPower には一切触れない（[[race-math-immutable]]）。
// ★fix() は必ず既存の setter を通す。生代入は shinganDevUnlock が作ってしまった
//   「第5話だけ既読＝門番の破れた state」を再生産する。
// ★参照は全て関数の中（呼び出し時解決）＝読み込み順に依存しない（nav.js と同じ作法）。
// =========================================================================

// ---- 小道具 ----
function _chSt(st) { return st || state; }
function _chFlag(n) { try { return typeof getStoryFlag === "function" && !!getStoryFlag(n); } catch (e) { return false; } }
function _chSet(n) { if (typeof setStoryFlag === "function") setStoryFlag(n, true); }
function _chPeak(st) {
  try { return (typeof assetsPeak === "function") ? assetsPeak(_chSt(st)) : ((_chSt(st).player || {}).assetsPeak || 0); }
  catch (e) { return 0; }
}
function _chAvail(id) { try { return (typeof chapterAvailable === "function") ? !!chapterAvailable(id) : false; } catch (e) { return false; } }

// ---- 要求アトム：key / label / get / fix ----
// get(st) … 真ならこの要求は満たされている（読むだけ・副作用なし）
// fix(st) … 満たすために state を動かす（表示メタのみ）
function _req(key, label, get, fix) { return { key: key, label: label, get: get, fix: fix }; }

var CH_REQ = {
  // 章の既読印。★ゲートが見ている唯一のフラグ（data_assets.js chapterRead）
  read: function (n) {
    return _req("read" + n, "第" + n + "話が既読 (_chapter_intro_" + n + ")",
      function () { return _chFlag("_chapter_intro_" + n); },
      function () { _chSet("_chapter_intro_" + n); });
  },
  races: function (n) {
    return _req("races" + n, n + "戦を完走 (completedRaces>=" + n + ")",
      function (st) { return ((_chSt(st).player || {}).completedRaces || 0) >= n; },
      function (st) { var p = _chSt(st).player; p.completedRaces = Math.max(p.completedRaces || 0, n); });
  },
  // ★wins は「単勝の的中」でしか増えない（ui_render.js settleRace）。実プレイでは
  //   wins と everHit は必ず同時にしか立たないので、ここでも必ず同時に立てる。
  wins: function (n) {
    return _req("wins" + n, n + "勝（単勝的中） (wins>=" + n + ")",
      function (st) { return ((_chSt(st).player || {}).wins || 0) >= n; },
      function (st) {
        var p = _chSt(st).player;
        p.wins = Math.max(p.wins || 0, n);
        p.completedRaces = Math.max(p.completedRaces || 0, n);
        (p.flags || (p.flags = {})).everHit = true;
      });
  },
  everHit: function () {
    return _req("everHit", "はじめて的中している (everHit)",
      function (st) { return !!((_chSt(st).player.flags || {}).everHit) || _chFlag("everHit"); },
      function (st) { var p = _chSt(st).player; (p.flags || (p.flags = {})).everHit = true; });
  },
  // 衣装の所持（state.js の旧セーブ移行と同じ書き方＝outfitsBought へ push）
  outfit: function (id) {
    return _req("outfit_" + id, "衣装『" + id + "』を所持",
      function () {
        try {
          var o = OUTFITS.find(function (x) { return x.id === id; });
          return (typeof outfitOwned === "function") && !!outfitOwned(o);
        } catch (e) { return false; }
      },
      function (st) {
        var p = _chSt(st).player;
        if (!Array.isArray(p.outfitsBought)) p.outfitsBought = [];
        if (p.outfitsBought.indexOf(id) < 0) p.outfitsBought.push(id);
      });
  },
  // 到達最高資産。assetsPeak は recomputeAssets が max でしか動かさないので、
  // 上へ代入しても再計算で消えない。
  peak: function (n, label) {
    return _req("peak" + n, label || ("到達最高資産 >= " + n),
      function (st) { return _chPeak(st) >= n; },
      function (st) {
        var p = _chSt(st).player;
        p.assetsPeak = Math.max(p.assetsPeak || 0, n);
        p.maxCoinsReached = Math.max(p.maxCoinsReached || 0, Math.min(n, 100000000));
        if (typeof recomputeAssets === "function") recomputeAssets(_chSt(st));
      });
  },
  flag: function (name, label) {
    return _req("flag_" + name, label || name,
      function () { return _chFlag(name); },
      function () { _chSet(name); });
  },
  poroFound: function () {
    return _req("poroFound", "ポロを見つけている (poroFound)",
      function () { return (typeof poroFound === "function") ? !!poroFound() : _chFlag("poroFound"); },
      function (st) {
        // ポロ発見は単勝2勝が前提（poro.js）。前提ごと満たす。
        var p = _chSt(st).player;
        p.wins = Math.max(p.wins || 0, 2);
        p.completedRaces = Math.max(p.completedRaces || 0, 2);
        (p.flags || (p.flags = {})).everHit = true;
        _chSet("poroMet"); _chSet("poroFound");
        _chSet("dragonScoutUnlocked"); _chSet("dragonStableUnlocked");
      });
  },
  // 神眼レースの出走要件＝固定8頭すべて（shingan_race.js shinganAllScouted）
  scoutAll: function () {
    return _req("scoutAll", "神眼ロスター8頭をスカウト済み",
      function () { try { return (typeof shinganAllScouted === "function") && shinganAllScouted(); } catch (e) { return false; } },
      function (st) {
        var p = _chSt(st).player;
        p.collection = p.collection || {};
        try {
          SHINGAN_ROSTER.forEach(function (d) {
            if (d.id === "poro") { _chSet("poroFound"); return; }   // ポロだけは物語フラグが正
            p.collection[d.id] = Object.assign({}, p.collection[d.id], { scouted: true, seen: true, unlocked: true });
          });
        } catch (e) {}
      });
  },
  epActive: function () {
    return _req("epActive", "終章が起動している (epilogue.active)",
      function (st) { var e = (_chSt(st).player || {}).epilogue; return !!(e && e.active); },
      function () { if (typeof epilogueStart === "function") epilogueStart(); });
  },
  edFlag: function () {
    return _req("edFlag", "最終決戦をクリア済み (epilogue.edFlag)",
      function (st) { var e = (_chSt(st).player || {}).epilogue; return !!(e && e.edFlag); },
      function () { if (typeof epilogueClear === "function") epilogueClear(); });   // 正規の印の立て方に合わせる
  },
  // ★gameCleared は生で立ててはいけない。markGameCleared() は「もう立っている」と見ると
  //   即 return するので、先に生代入するとグルメレース解放だけ取り残される
  //   （初版はこれを踏んで chapterVerify の I9 に捕まった）。必ず正規経路を通す。
  gameCleared: function () {
    return _req("gameCleared", "エンディングを観終わっている (gameCleared)",
      function () { return _chFlag("gameCleared"); },
      function () { if (typeof markGameCleared === "function") markGameCleared(); else _chSet("gameCleared"); });
  }
};

// ---- 章の表 ----
// ★adds には「その章で新しく必要になるもの」だけを書く。required は下の _chBuild が
//   前章ぶんを畳み込んで累積にする。手で累積を書くと必ず書き漏れる（実際、初版は
//   第3話以降で races(3)/outfit を落として chapterVerify に I3 で捕まった）。
// ★onRead には「その章を開いた瞬間に実ゲームが起こす副作用」を書く。ui_story.js が
//   無条件でやること（第4話=metMakura／第5話=epilogueStart）を再現しないと、
//   デバッグジャンプが本物と違う state を作ってしまう。
var CHAPTERS = [
  {
    id: "0", storyId: null, phase: 1, title: "序章 ― 生き延びる",
    // ★STORY_CHAPTERS は 1/2/3/4/5/ED の6件だけで序章は存在しない。名前があるのは
    //   goals.js の GOAL_PHASES だけ。物語一覧にカードは増やさず、ここが唯一
    //   「序章」を状態として持つ場所にする。
    gate: function () { return true; },
    adds: [],
    teaches: ["賭ける→当たる／外れる", "単勝と複勝／ワイドの違い"],
    budget: { races: [0, 5], minutes: [10, 20] },
    opensOnExit: ["🎁初陣祝いVN（1戦完走）", "📖図鑑（everHit）", "🛍️モール（maxCoinsReached>=2000）", "🏝️おでかけ（wins>=1）"]
  },
  {
    id: "1", storyId: "1", phase: 1, title: "第1話　竜王女サケに拾われる",
    gate: function () { return _chAvail("1"); },        // 無条件
    adds: [],
    teaches: ["物語の読み方（全画面リーダー）"],
    budget: { races: [0, 1], minutes: [5, 10] }
  },
  {
    id: "2", storyId: "2", phase: 2, title: "第2話　ミズの分析予想",
    gate: function () { return _chAvail("2"); },        // 既読1 && 完走3 && ブニクロ所持
    adds: [CH_REQ.read(1), CH_REQ.races(3), CH_REQ.outfit("buniqro")],
    teaches: ["人気とオッズは裏返し", "分析タブの読み方"],
    budget: { races: [5, 20], minutes: [30, 45] },
    opensOnEnter: ["📊分析予想", "ミズの登場（advisorMet）"]
  },
  {
    id: "3", storyId: "3", phase: 3, title: "第3話　スミカと総資産",
    gate: function () { return _chAvail("3"); },        // 既読2 && 単勝1勝
    adds: [CH_REQ.read(2), CH_REQ.wins(1)],
    teaches: ["資産＝コインだけではない", "★暮らしレベルの上限＝ツリーのノード数"],
    budget: { races: [20, 22], minutes: [5, 10] },
    opensOnEnter: ["🌱くらしツリー＋生活資産", "スカウトのロケ cliff", "★livingLevelCap の発火"]
  },
  {
    id: "4", storyId: "4", phase: 4, title: "第4話　マクラと推し竜文化",
    gate: function () { return _chAvail("4"); },        // 既読3 && assetsPeak>=100万
    adds: [CH_REQ.read(3), CH_REQ.peak(1000000, "到達最高資産 100万")],
    teaches: ["名声も資産である＝配信で稼ぐ", "スマホ購入＝ホームが変身する"],
    budget: { races: [22, 60], minutes: [60, 90] },
    // ★ui_story.js は第4話を開いた瞬間に metMakura を無条件でセットする。
    onRead: function () { _chSet("metMakura"); },
    opensOnEnter: ["metMakura を無条件セット", "📖図鑑の深い記録", "📱スマホ購入CTA",
                   "スカウト volcano/sea", "セレスティア伏線VN"]
  },
  {
    id: "5", storyId: "5", phase: 5, title: "第5話　セレスティアの神眼",
    gate: function () { return _chAvail("5"); },        // 既読4 && assetsPeak>=1億
    adds: [CH_REQ.read(4), CH_REQ.flag("metMakura", "マクラに会っている"), CH_REQ.peak(100000000, "到達最高資産 1億")],
    teaches: ["終章＝綱引きのルール"],
    budget: { races: [60, 110], minutes: [60, 90] },
    // ★ui_story.js は第5話を開いた瞬間に epilogueStart() を呼ぶ＝終章が起動する。
    onRead: function () { if (typeof epilogueStart === "function") epilogueStart(); },
    // ★開いた瞬間に不可逆な状態遷移が走る（章を開く前の告知が要る＝設計文書 §D-5）
    irreversible: ["epilogueStart()＝終章の起動（ui_story.js）", "導入VNは二度と再生されない"]
  },
  {
    id: "EP", storyId: null, phase: 5, title: "終章 ― 絶滅メーターの綱引き",
    // ★終章は章データを持たず epilogue.active だけで表現されている（物語一覧に居場所が無い）。
    gate: function (st) { var e = (_chSt(st).player || {}).epilogue; return !!(e && e.active); },
    adds: [CH_REQ.read(5), CH_REQ.epActive(), CH_REQ.poroFound(), CH_REQ.scoutAll()],
    teaches: ["押し戻しの4活動", "★同着＝1.0倍の元返し（この島の掟）"],
    budget: { races: [110, 190], minutes: [60, 120] },
    opensOnEnter: ["☄️絶滅メーター", "🏦島の経済", "⚔️竜帝の戴冠衣（安全ゾーン到達で授与）", "☄️神眼レース"]
  },
  {
    id: "ED", storyId: "ED", phase: 5, title: "エンディング ― 次の物語へ",
    gate: function () { return _chAvail("ED"); },
    // ★gameCleared は CH_REQ.gameCleared() が markGameCleared() 経由で立てる
    //   ＝グルメレース解放まで一緒に正しく起きる（F4）。onRead は要らない。
    adds: [CH_REQ.edFlag(), CH_REQ.gameCleared()],
    teaches: [],
    budget: { races: [190, 190], minutes: [20, 30] },
    opensOnEnter: ["SPECIAL クリア後の島", "🏃ポロのグルメレース（ED完走で・markGameCleared）", "🏆やり込み得点"]
  }
];

// ---- 累積の構築（adds → required）----
// 前章までの adds を畳み込み、key の重複を落として required を作る。
// 手で累積を書くと必ず漏れるので、機械にやらせる。
(function _chBuild() {
  var seen = {}, acc = [];
  CHAPTERS.forEach(function (c) {
    (c.adds || []).forEach(function (r) { if (!seen[r.key]) { seen[r.key] = 1; acc.push(r); } });
    c.required = acc.slice();
  });
})();

function chapterMeta(chId) {
  for (var i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].id === String(chId)) return CHAPTERS[i];
  return null;
}

// ---- 再現：その章の状態を作る ----
// ★既定は「その章の“手前”に立たせる」＝当該章はまだ未読。これで導入VN・カットイン・
//   不可逆な副作用（metMakura / epilogueStart）を実機で毎回ちゃんと見られる。
//   読了状態で入りたいときだけ {read:true}。
function chapterApply(chId, opts) {
  var o = opts || {}, st = _chSt(o.state), ch = chapterMeta(chId);
  if (!ch) return { ok: false, err: "unknown chapter: " + chId };
  var applied = [];
  ch.required.forEach(function (r) {
    var had = false; try { had = !!r.get(st); } catch (e) {}
    if (!had) { try { r.fix(st); applied.push(r.key); } catch (e) { applied.push(r.key + "(失敗)"); } }
  });
  if (o.profile && ch.profile && typeof ch.profile[o.profile] === "function") ch.profile[o.profile](st);
  if (typeof recomputeAssets === "function") recomputeAssets(st);
  if (o.read && ch.storyId) {
    _chSet("_chapter_intro_" + ch.storyId);
    // ★実ゲームが「章を開いた瞬間」に無条件でやる副作用を再現する（ui_story.js）。
    //   ここを省くと、デバッグジャンプが本物と違う state を作る（初版は I2/I6 で捕まった）。
    if (typeof ch.onRead === "function") { try { ch.onRead(st); } catch (e) {} }
  }
  _chSet("_devJumped");                                   // 「この保存は開発ジャンプ済み」の印
  if (typeof saveGame === "function") saveGame();
  return { ok: true, chapter: ch.id, applied: applied, problems: chapterVerify(ch.id, st) };
}

// ---- 検算：いまの state がその章として整合しているか（空配列＝健全） ----
function chapterVerify(chId, st) {
  st = _chSt(st);
  var ch = chapterMeta(chId), out = [];
  if (!ch) return ["unknown chapter: " + chId];
  ch.required.forEach(function (r) {
    var ok = false; try { ok = !!r.get(st); } catch (e) {}
    if (!ok) out.push("必須が欠けている：" + r.label);
  });
  return out.concat(chapterInvariants(st));
}

// いまプレイヤーが立っている章（最も進んだもの）
function chapterCurrent(st) {
  st = _chSt(st);
  for (var i = CHAPTERS.length - 1; i >= 0; i--) {
    var c = CHAPTERS[i];
    if (c.id === "ED") { var ed = (st.player || {}).epilogue; if (ed && ed.edFlag) return c; continue; }
    if (c.id === "EP") { var e = (st.player || {}).epilogue; if (e && e.active) return c; continue; }
    if (c.storyId && _chFlag("_chapter_intro_" + c.storyId)) return c;
  }
  return CHAPTERS[0];
}

// ---- 不変条件：章に依らず常に成り立つべきこと ----
// すべて単調な値（フラグ・assetsPeak・wins・所持品）だけを見るので、履歴が無くても後から検算できる。
function chapterInvariants(st) {
  st = _chSt(st); var p = st.player || {}, out = [];
  var rd = function (n) { return _chFlag("_chapter_intro_" + n); };

  // I1 既読は連続（飛び読みが起きていない）。shinganDevUnlock が作る「第5話だけ既読」を捕まえる。
  var seq = ["1", "2", "3", "4", "5"], broke = false;
  for (var i = 0; i < seq.length; i++) {
    if (!rd(seq[i])) broke = true;
    else if (broke) out.push("I1 章の既読が飛んでいる：第" + seq[i] + "話が既読なのに手前が未読");
  }
  // I2 metMakura ⇔ 第4話既読（ui_story.js が無条件でセットする）
  if (rd("4") !== _chFlag("metMakura")) out.push("I2 metMakura と第4話既読が食い違う");
  // I3〜I5 既読章の“実績”は単調なので後から検算できる
  if (rd("2") && (p.completedRaces || 0) < 3) out.push("I3 第2話既読なのに完走3戦未満");
  if (rd("3") && (p.wins || 0) < 1) out.push("I4 第3話既読なのに単勝0勝");
  if (rd("4") && _chPeak(st) < 1000000) out.push("I5 第4話既読なのに到達最高資産 <100万");
  if (rd("5") && _chPeak(st) < 100000000) out.push("I5 第5話既読なのに到達最高資産 <1億");
  // I6 終章の起動 ⇔ 第5話既読
  var e = p.epilogue || {};
  if (!!e.active !== rd("5")) out.push("I6 epilogue.active と第5話既読が食い違う");
  // I7 ED の隠れ必須
  if (e.edFlag) {
    if (typeof poroFound === "function" && !poroFound()) out.push("I7 edFlag が立っているのにポロ未発見");
    try { if (typeof shinganAllScouted === "function" && !shinganAllScouted()) out.push("I7 edFlag が立っているのに8頭未スカウト"); } catch (err) {}
  }
  // I8 顧問の門番＝既読章の顧問が未登場なら破れている
  try {
    STORY_CHAPTERS.forEach(function (c) {
      if (c.cast && _chFlag("_chapter_intro_" + c.id) && typeof advisorMet === "function" && !advisorMet(c.cast))
        out.push("I8 門番が破れている：第" + c.id + "話は既読なのに顧問が未登場扱い");
    });
  } catch (err) {}
  // I9 クリア後コンテンツの導線（F4で修正済み・回帰の常設検出）
  if (e.edFlag && !_chFlag("gameCleared"))
    out.push("I9 正規クリア済みなのに gameCleared が立っていない");
  if (e.edFlag && _chFlag("gameCleared") && typeof poroFound === "function" && poroFound() && !_chFlag("poroGourmetRaceUnlocked"))
    out.push("I9 『ポロのグルメレース』の導線が開かない");
  return out;
}

// 全章まとめて（デバッグUI／Nodeテストの入口）
function chapterVerifyAll(st) {
  st = _chSt(st);
  return { current: chapterCurrent(st).id, devJumped: _chFlag("_devJumped"), problems: chapterInvariants(st) };
}

if (typeof window !== "undefined") {
  window.CHAPTERS = CHAPTERS; window.CH_REQ = CH_REQ; window.chapterMeta = chapterMeta;
  window.chapterApply = chapterApply; window.chapterVerify = chapterVerify;
  window.chapterCurrent = chapterCurrent; window.chapterVerifyAll = chapterVerifyAll;
  window.chapterInvariants = chapterInvariants;
}
