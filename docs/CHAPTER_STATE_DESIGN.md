# 章デザインの実装案 — 章ジャンプ・フラグ整理・チュートリアル・レベルデザイン

対象：`C:\Users\takakazu\projects\mimi_dragon_race_game`（バニラJS・モジュール無し・classic script／`index.html` の読み込み順が意味を持つ）
作成：2026-07-31／本文中の `file:line` はすべて本セッションで実ファイルを開いて確認したもの。
確認できなかったものは **【未確認】**、他調査から引いた数値は **【推定・他調査】** と明記する。

> **不変条件（この文書の全提案が守るもの）**
> レースの着順・オッズ・配当・FinalPower・抽選には一切触れない（`race_engine` / `odds_engine` / `betting_engine`）。
> ここで足すものは全部 **表示・ゲート・開発補助** に限る。[[race-math-immutable]]

---

## 0. 何を作るのか（1段落）

いま「章」は **3か所に散っている**：解放条件は `chapterAvailable()`（`js/data_assets.js:310-334`）、章の副作用は `renderStoryChapter()` の中（`js/ui_story.js:211-226`）、章の名前と段は `GOAL_PHASES`（`js/goals.js:147-153`）。
そのため「第4話に立っている状態」を一箇所で言い表せず、**再現もできないし検算もできない**。

本案は `js/data_chapters.js` を1枚足して、章ごとに

- `gate` … いつ開くか（★**新しい判定は作らない。`chapterAvailable()` に委譲する**）
- `required` … その章に立っているとき真であるべき述語の列（＝「必須フラグ」の定義そのもの）
- `applyState(st)` … `required` を満たすように state を作る（デバッグ章ジャンプ）
- `verify(st)` … いまの state がその章として整合しているか（機械検算）

を持たせる。`applyState` と `verify` が **同じ `required` 表を読む** ので、再現と検算が原理的にズレない。
これが目的①②③④すべての土台になる。

---

## A. CHAPTERS データ構造の具体案（`js/data_chapters.js`）

### A-1. 設計の芯：ゲートを二重化しない

このリポジトリで実際に起きている事故は「同じことを2か所に書いて片方が古びる」型である。実例：

- `STORY_UNLOCK_AT`（`js/data_assets.js:279`）の第2話3000／第3話30000 は、実ゲート（同 :322-324＝3戦＋ブニクロ所持／単勝1勝）と別物のまま残っている。
- そのフォールバック分岐 `js/assets_engine.js:202-206` は **到達不能**。`index.html:77` で `data_assets.js` が `index.html:85` の `assets_engine.js` より先に読まれ、`chapterAvailable` が常に定義済みなので `js/assets_engine.js:204` で必ず早期 return する。
- `docs/PROGRESSION_DESIGN.md:44-45` の章ゲート表（総資産3千／3万）も実装と食い違っている。

したがって **CHAPTERS は3つ目のゲートを作ってはならない**。`gate()` は `chapterAvailable()` を呼ぶだけの薄いラッパにする。CHAPTERS が持つ固有の情報は「章に立っている状態の記述」だけ。

### A-2. ファイルの置き場所

`index.html` の `js/progression.js`（`index.html:106`）の直後に1行。

```html
<script src="js/data_chapters.js?v=20260801c"></script>
```

理由：`goals.js`(105) / `progression.js`(106) と同じ「進行の台帳」レイヤ。
他ファイルへの参照は **すべて関数の中**（呼び出し時解決）に閉じるので、実際には順序に依存しない。`nav.js` の作法（`js/nav.js:9` 「描画関数は呼び出し時(typeof guard)に解決＝読み込み順に依存しない」）に合わせる。

### A-3. 骨格（そのまま置ける形）

```js
// =========================================================================
// data_chapters.js — 章の「状態」の単一記述（デバッグ章ジャンプ＋整合診断）
// =========================================================================
// ★これは新しい解放ゲートではない。解放の正本は data_assets.js:310-334 の
//   chapterAvailable() のまま。ここは「その章に立っているとき state はどう
//   なっているか」を1枚に書き、それを
//     (a) 再現する chapterApply()   … デバッグ章ジャンプ
//     (b) 検算する chapterVerify()  … 整合診断（devcheck と同じ思想）
//   の両方が読む。同じ表を読むので再現と検算が原理的にズレない。
// ★表示/メタ専用。着順・オッズ・配当・FinalPower には一切触れない。
// ★fix() は必ずゲームの既存 setter を通すこと（生代入は shinganDevUnlock が
//   作ってしまった「第5話だけ既読」状態＝門番の破れ を再生産する）。
// 関連：docs/CHAPTER_DESIGN.md（本文書）／docs/PROGRESSION_DESIGN.md
// =========================================================================

// ---- 小道具（すべて呼び出し時解決＝読み込み順に非依存） ----
function _chSt(st) { return st || state; }
function _chFlag(n) { try { return typeof getStoryFlag === "function" && !!getStoryFlag(n); } catch (e) { return false; } }
function _chSet(n)  { if (typeof setStoryFlag === "function") setStoryFlag(n, true); }
function _chPeak(st) {
  try { return (typeof assetsPeak === "function") ? assetsPeak(_chSt(st)) : ((_chSt(st).player || {}).assetsPeak || 0); }
  catch (e) { return 0; }
}
function _chAvail(id) { try { return (typeof chapterAvailable === "function") ? !!chapterAvailable(id) : false; } catch (e) { return false; } }

// ---- 要求アトム：key / label / get / fix の4つだけ ----
// get(st) … 真ならこの要求は満たされている（読むだけ・副作用なし）
// fix(st) … 満たすために state を動かす（表示メタのみ）
function _req(key, label, get, fix) { return { key: key, label: label, get: get, fix: fix }; }

var CH_REQ = {
  // 章の既読印。★ゲートが見ている唯一のフラグ（data_assets.js:304 chapterRead）
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
  // ★wins は「単勝の的中」でしか増えない（ui_render.js:2745-2748）。
  //   ここでも wins と everHit を必ず同時に立てる（実プレイでは同時にしか立たない）。
  wins: function (n) {
    return _req("wins" + n, n + "勝（単勝的中） (wins>=" + n + ")",
      function (st) { return ((_chSt(st).player || {}).wins || 0) >= n; },
      function (st) {
        var p = _chSt(st).player;
        p.wins = Math.max(p.wins || 0, n);
        p.completedRaces = Math.max(p.completedRaces || 0, n);
        if (p.flags) p.flags.everHit = true;
      });
  },
  everHit: function () {
    return _req("everHit", "はじめて的中している (everHit)",
      function (st) { return !!((_chSt(st).player.flags || {}).everHit) || _chFlag("everHit"); },
      function (st) { var p = _chSt(st).player; (p.flags || (p.flags = {})).everHit = true; });
  },
  // 衣装の所持。★state.js:145-148 の移行と同じ書き方（outfitsBought へ push）
  outfit: function (id) {
    return _req("outfit_" + id, "衣装『" + id + "』を購入済み",
      function (st) {
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
  // 到達最高資産。★assetsPeak は recomputeAssets が max でしか動かさない
  //   （assets_engine.js:177-194）ので、上へ代入しても再計算で消えない。
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
        // ポロ発見は2勝が前提（poro.js:184-186）。前提ごと満たす。
        var p = _chSt(st).player;
        p.wins = Math.max(p.wins || 0, 2);
        p.completedRaces = Math.max(p.completedRaces || 0, 2);
        _chSet("poroFound"); _chSet("dragonScoutUnlocked"); _chSet("dragonStableUnlocked");
      });
  },
  // 神眼レースの出走要件＝固定8頭すべて（shingan_race.js:84,326-327,371）
  scoutAll: function () {
    return _req("scoutAll", "神眼ロスター8頭をスカウト済み",
      function () { try { return (typeof shinganAllScouted === "function") && shinganAllScouted(); } catch (e) { return false; } },
      function (st) {
        var p = _chSt(st).player;
        p.collection = p.collection || {};
        try {
          SHINGAN_ROSTER.forEach(function (d) {
            if (d.id === "poro") { _chSet("poroFound"); return; }
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
      function () { if (typeof epilogueClear === "function") epilogueClear(); });   // ★正規の印の立て方に合わせる
  }
};
```

### A-4. 章の表

```js
// ★required は累積で書く（前章の既読も含む）。applyState が1パスで済み、
//   verify が「途中の章だけ既読」を必ず捕まえられる。
var CHAPTERS = [
  {
    id: "0", storyId: null, phase: 1,
    title: "序章 ― 生き延びる",
    // ★STORY_CHAPTERS（data_assets.js:82-113）は 1/2/3/4/5/ED の6件だけで、序章は存在しない。
    //   名前があるのは goals.js:148 の GOAL_PHASES だけ。物語一覧にカードは増やさず、
    //   ここが唯一「序章」を状態として持つ場所にする。
    gate: function () { return true; },
    required: [],
    teaches: ["賭ける→当たる／外れる", "単勝と複勝／ワイドの違い"],
    budget: { races: [0, 5], minutes: [10, 20] },
    opensOnEnter: ["レース選択・出走・賭け", "物語（第1話）", "静かモードのホーム"],
    opensOnExit:  ["🎁初陣祝いVN（1戦完走・ui_render.js:279-317）", "📖図鑑（everHit・progression.js:18-22）",
                   "🛍️モール（maxCoinsReached>=2000・ui_render.js:265-276）", "🏝️おでかけ（wins>=1・ui_konron_map.js:143）"]
  },
  {
    id: "1", storyId: "1", phase: 1, title: "第1話　竜王女サケに拾われる",
    gate: function () { return _chAvail("1"); },       // data_assets.js:318 → 無条件
    required: [],
    teaches: ["物語の読み方（全画面リーダー・story_reveal.js）"],
    budget: { races: [0, 1], minutes: [5, 10] }
  },
  {
    id: "2", storyId: "2", phase: 2, title: "第2話　ミズの分析予想",
    gate: function () { return _chAvail("2"); },       // data_assets.js:322-323
    required: [CH_REQ.read(1), CH_REQ.races(3), CH_REQ.outfit("buniqro")],
    teaches: ["人気とオッズは裏返し", "分析タブの読み方（ui_render.js:2020-2022）"],
    budget: { races: [5, 20], minutes: [30, 45] },
    opensOnEnter: ["📊分析予想（progression.js:46-50）", "ミズの登場（advisorMet・data_assets.js:287-296）"]
  },
  {
    id: "3", storyId: "3", phase: 3, title: "第3話　スミカと総資産",
    gate: function () { return _chAvail("3"); },       // data_assets.js:324
    required: [CH_REQ.read(1), CH_REQ.read(2), CH_REQ.wins(1)],
    teaches: ["資産＝コインだけではない", "★暮らしレベルの上限＝ツリーのノード数（data_ranks.js:141-150）"],
    budget: { races: [20, 22], minutes: [5, 10] },
    opensOnEnter: ["🌱くらしツリー＋生活資産（progression.js:33-37）", "スカウトのロケ cliff（scout_engine.js:43）",
                   "★livingLevelCap の発火（data_ranks.js:141-150）"]
  },
  {
    id: "4", storyId: "4", phase: 4, title: "第4話　マクラと推し竜文化",
    gate: function () { return _chAvail("4"); },       // data_assets.js:325
    required: [CH_REQ.read(1), CH_REQ.read(2), CH_REQ.read(3), CH_REQ.wins(1),
               CH_REQ.peak(1000000, "到達最高資産 100万")],
    teaches: ["名声も資産である＝配信で稼ぐ", "スマホ購入＝ホームが変身する"],
    budget: { races: [22, 60], minutes: [60, 90] },
    opensOnEnter: ["metMakura を無条件セット（ui_story.js:224）", "📖図鑑の深い記録（progression.js:51-55）",
                   "📱スマホ購入CTA（ui_home.js:386,434）", "スカウト volcano/sea（scout_engine.js:44）",
                   "セレスティア伏線VN（epilogue_engine.js:61）"]
  },
  {
    id: "5", storyId: "5", phase: 5, title: "第5話　セレスティアの神眼",
    gate: function () { return _chAvail("5"); },       // data_assets.js:326
    required: [CH_REQ.read(1), CH_REQ.read(2), CH_REQ.read(3), CH_REQ.read(4),
               CH_REQ.flag("metMakura", "マクラに会っている"), CH_REQ.peak(100000000, "到達最高資産 1億")],
    teaches: ["終章＝綱引きのルール（epilogue_engine.js:135-154）"],
    budget: { races: [60, 110], minutes: [60, 90] },
    // ★開いた瞬間に不可逆な状態遷移が2つ走る（章を開く前に告知が要る＝§D-4）
    irreversible: ["epilogueStart()＝終章の起動（ui_story.js:226 → epilogue_engine.js:157-160）",
                   "神眼開眼カットイン（ui_story.js:215-217・初回1回のみ）"]
  },
  {
    id: "EP", storyId: null, phase: 5, title: "終章 ― 絶滅メーターの綱引き",
    // ★章データを持たない状態遷移。STORY_CHAPTERS に居場所が無いので、
    //   「いま終章にいる」ことを物語画面が示せない（§D-5 で対処）。
    gate: function (st) { var e = (_chSt(st).player || {}).epilogue; return !!(e && e.active); },
    required: [CH_REQ.read(1), CH_REQ.read(2), CH_REQ.read(3), CH_REQ.read(4), CH_REQ.read(5), CH_REQ.epActive()],
    teaches: ["押し戻し4活動（scoutNew/assetLevel/mallBuy/hit/win・epilogue_engine.js:98）",
              "★8頭スカウトが最終決戦の出走要件（shingan_race.js:84）"],
    budget: { races: [110, 150], minutes: [60, 80] }
  },
  {
    id: "ED", storyId: "ED", phase: 6, title: "エンディング　次の物語へ",
    gate: function () { return _chAvail("ED"); },      // data_assets.js:330
    required: [CH_REQ.read(1), CH_REQ.read(2), CH_REQ.read(3), CH_REQ.read(4), CH_REQ.read(5),
               CH_REQ.poroFound(), CH_REQ.scoutAll(), CH_REQ.edFlag()],
    teaches: ["三頭同着に自力で気づく（神眼レース）"],
    budget: { races: [150, 165], minutes: [40, 80] }
  }
];

function chapterMeta(id) { return CHAPTERS.find(function (c) { return String(c.id) === String(id); }) || null; }
```

### A-5. `applyState` / `verify`

```js
// ★既定は「その章の“手前”に立たせる」＝当該章はまだ未読。
//   これで導入VN・カットイン・不可逆な副作用（metMakura / epilogueStart）を
//   実機で毎回ちゃんと見られる。読了状態で入りたいときだけ {read:true}。
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
  if (o.read && ch.storyId) _chSet("_chapter_intro_" + ch.storyId);
  _chSet("_devJumped");                                   // 「この保存は開発ジャンプ済み」の印（診断が言えるように）
  if (typeof saveGame === "function") saveGame();
  return { ok: true, chapter: ch.id, applied: applied, problems: chapterVerify(ch.id, st) };
}

// いまの state がその章として整合しているか。問題文の配列を返す（空＝健全）。
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

// いまプレイヤーが立っている章（最も進んだもの）。
function chapterCurrent(st) {
  st = _chSt(st);
  for (var i = CHAPTERS.length - 1; i >= 0; i--) {
    var c = CHAPTERS[i];
    if (c.storyId && _chFlag("_chapter_intro_" + c.storyId)) return c;
    if (c.id === "EP") { var e = (st.player || {}).epilogue; if (e && e.active) return c; }
  }
  return CHAPTERS[0];
}
```

### A-6. 不変条件（`chapterInvariants`）— ④の機械検算

**すべて単調な値（フラグ・`assetsPeak`・`wins`・所持品）だけを見る**ので、履歴を持たなくても後から検算できる。

```js
// 章に依らず常に成り立つべきこと。devcheck.js と同じ思想＝手で見つけた矛盾を機械が見張る。
function chapterInvariants(st) {
  st = _chSt(st); var p = st.player || {}, out = [];
  var rd = function (n) { return _chFlag("_chapter_intro_" + n); };

  // I1 既読は連続（＝飛び読みが起きていない）。shinganDevUnlock が作る
  //    「第5話だけ既読」（shingan_race.js:244-263）をここで必ず捕まえる。
  var seq = ["1", "2", "3", "4", "5"], broke = false;
  for (var i = 0; i < seq.length; i++) {
    if (!rd(seq[i])) broke = true;
    else if (broke) out.push("I1 章の既読が飛んでいる：第" + seq[i] + "話が既読なのに手前が未読");
  }
  // I2 metMakura ⇔ 第4話既読（ui_story.js:224 が無条件でセットする）
  if (rd("4") !== _chFlag("metMakura")) out.push("I2 metMakura と第4話既読が食い違う（ui_story.js:224）");
  // I3〜I5 既読章の“実績”は単調なので後から検算できる
  if (rd("2") && (p.completedRaces || 0) < 3) out.push("I3 第2話既読なのに完走3戦未満（data_assets.js:322）");
  if (rd("3") && (p.wins || 0) < 1)          out.push("I4 第3話既読なのに単勝0勝（data_assets.js:324）");
  if (rd("4") && _chPeak(st) < 1000000)      out.push("I5 第4話既読なのに到達最高資産 <100万（data_assets.js:325）");
  if (rd("5") && _chPeak(st) < 100000000)    out.push("I5 第5話既読なのに到達最高資産 <1億（data_assets.js:326）");
  // I6 終章の起動 ⇔ 第5話既読（ui_story.js:226）
  var e = p.epilogue || {};
  if (!!e.active !== rd("5")) out.push("I6 epilogue.active と第5話既読が食い違う（ui_story.js:226）");
  // I7 ED の隠れ必須（shingan_race.js:78-82,84）
  if (e.edFlag) {
    if (typeof poroFound === "function" && !poroFound()) out.push("I7 edFlag が立っているのにポロ未発見（shingan_race.js:78-82）");
    if (typeof shinganAllScouted === "function" && !shinganAllScouted()) out.push("I7 edFlag が立っているのに8頭未スカウト（shingan_race.js:84）");
  }
  // I8 顧問の門番（data_assets.js:287-296）＝既読章の顧問が未登場なら破れている
  try {
    STORY_CHAPTERS.forEach(function (c) {
      if (c.cast && _chFlag("_chapter_intro_" + c.id) && typeof advisorMet === "function" && !advisorMet(c.cast))
        out.push("I8 門番が破れている：第" + c.id + "話は既読なのに顧問が未登場扱い");
    });
  } catch (err) {}
  // I9 クリア後コンテンツの導線（既知の実バグの常設検出・§C-3）
  if (e.edFlag && !_chFlag("gameCleared"))
    out.push("I9 正規クリア済みなのに gameCleared が立っていない（ui_render.js:1099 のコメント参照）");
  if (e.edFlag && typeof poroFound === "function" && poroFound() && !_chFlag("poroGourmetRaceUnlocked"))
    out.push("I9 特別號『ポロのグルメレース』の導線（data_assets.js:121-122）が開かない（poro_gourmet.js:61-70）");
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
}
```

### A-7. 「それらしい経済」プロファイル（任意・第2段）

`gate` を満たすだけの state は **経済的にありえない**（例：`assetsPeak` 1億なのに `village.level` 1）。
第4話／第5話の体感を実機で見るには、村レベルとくらしツリーも一緒に動かす必要がある。

```js
// CHAPTERS[i].profile.typical … 「その章にいるプレイヤーの、ありそうな経済」
// ★村レベルは総資産の主成分（VILLAGE_VALUE_BY_LEVEL・assets_engine.js:39-44）なので、
//   ここを動かさないと assetsPeak だけ巨大で内訳が空という嘘の state になる。
profile: {
  typical: function (st) {
    var p = _chSt(st).player, v = p.village || (p.village = {});
    v.level = Math.max(v.level || 1, 6);            // 村価値 200万（assets_engine.js:39）
    p.villageLevel = v.level;
    p.rank = Math.max(p.rank || 1, 5);
    p.completedRaces = Math.max(p.completedRaces || 0, 60);
    // くらしツリー：cap（data_ranks.js:141-150）と辻褄を合わせる＝村Lv6 には 100ノード要る
    try {
      var n = 0;
      LIFE_MILESTONES.forEach(function (m) {
        if (n < 100 && (typeof lifeNodeBandAt !== "function" || _chPeak(st) >= lifeNodeBandAt(m))) {
          _chSt(st).lifeTree.unlocked[m.nodeId] = true; n++;
        }
      });
    } catch (e) {}
  }
}
```

> ★注意：くらしツリーのノードは **195/200 が前提を持つ**【推定・他調査】ので、素朴に100個立てると前提の破れた木ができる。`lifeNodePrereqMet`（`js/lifetree_engine.js:206-210`）を通しながら幅優先で埋めるのが正確だが、**表示専用**なので第1段では上の素朴版で足りる。前提の整合を診断したくなったら `chapterInvariants` に I10 として足す。

---

## B. デバッグ章ジャンプの実装案

### B-1. 現状の欠落（確認済み）

- `js/nav.js:89` — `story_read: function () { renderStory(); }` ＝**章IDを捨てている**。
- `js/nav.js:122-131` — `&dev=1` の分岐は `shingan` と `collection` の2つだけ。
- 設定のデバッグ盤（`js/ui_render.js:991-1094`）にあるのは コイン／ランク／全衣装／終章テスト準備／メーター残10／神眼カットイン／神眼直行 のみ。**第4話（総資産100万）・第5話（1億）を実機で見る正規手段が無い。**
- 唯一の近道 `shinganDevUnlock`（`js/shingan_race.js:244-263`）は `_chapter_intro_5` だけを立てるので、`_chapter_intro_1〜4` と `metMakura` が偽のまま＝**門番の破れた state** を本番セーブに作る（`js/data_assets.js:287-296`）。

### B-2. 接続点①：設定のデバッグ盤

**挿入位置：`js/ui_render.js:1053` の `as-hint2`（「※メタ操作のみ…」）の直後、`js/ui_render.js:1055` の 🩺自己診断ブロックの手前。**
既存の 🧭画面ジャンプ（`js/ui_render.js:1081-1093`）とまったく同じ書式（`as-sec` 見出し → `set-debug`/`set-jump` グリッド → `as-hint2` 注意書き）に合わせる。

```js
// 📖 章ジャンプ：章ごとの state を再現して物語へ飛ぶ（js/data_chapters.js）。
// 触るのは解放メタのみ＝レースの着順・オッズ・配当には一切触れない。
if (typeof CHAPTERS !== "undefined" && typeof chapterApply === "function") {
  app.appendChild(el("div", "as-sec", "📖 章ジャンプ（章ごとの状態を再現）"));

  // 「読了状態で入る」トグル。既定 OFF＝章の“手前”に立つ＝導入VNと不可逆な副作用を毎回見られる。
  const chRow = el("div", "set-row",
    `<span class="set-ic">📖</span><span class="set-tx"><span class="set-nm">読了状態で入る</span>` +
    `<span class="set-sub">OFF＝その章の直前（導入VN・カットインをこれから見る）</span></span>`);
  const chTg = el("button", "set-toggle" + (window._chJumpRead ? " on" : ""), window._chJumpRead ? "ON" : "OFF");
  chTg.onclick = () => { window._chJumpRead = !window._chJumpRead; renderSettings(); };
  chRow.appendChild(chTg); app.appendChild(chRow);

  const cg = el("div", "set-jump");
  CHAPTERS.forEach(c => {
    const b = el("button", "set-jump-b", `<b>${c.id}</b><span>${c.title.replace(/^第|話.*$/g, "")}</span>`);
    b.title = c.title + "　（URL：?go=story&dev=1&ch=" + c.id + "）";
    b.onclick = () => {
      const r = chapterApply(c.id, { read: !!window._chJumpRead });
      if (typeof Sfx !== "undefined" && Sfx.play) Sfx.play("nav");
      _chShowVerify(r);                                   // 適用結果＋診断を必ず見せる（黙って進めない）
    };
    cg.appendChild(b);
  });
  app.appendChild(cg);

  const vb = el("button", "set-dbg-b", "🔍 いまの整合を診断");
  vb.onclick = () => _chShowVerify({ ok: true, chapter: chapterCurrent().id, applied: [], problems: chapterVerifyAll().problems });
  const vg = el("div", "set-debug"); vg.appendChild(vb); app.appendChild(vg);

  app.appendChild(el("div", "as-hint2",
    "その章に立っているとき満たされているはずの条件（既読・戦数・勝利・所持・到達資産）だけを付与します。" +
    "既定は<b>その章の直前</b>＝導入セリフ・カットイン・章を開いた瞬間の副作用（第4話＝図鑑の深い記録／第5話＝終章の起動）を通しで確認できます。" +
    "URLでも：<code>?go=story&amp;dev=1&amp;ch=4</code>（<code>&amp;read=1</code> で読了状態）。" +
    "<b>本番セーブがその章まで進んだ状態になります</b>ので、確認用のセーブで使ってください。"));
}
```

`_chShowVerify` は `js/ui_render.js:1058-1069` の `showRep`（🩺自己診断の `navpop-ov` オーバーレイ）と同じ形を使う。**新規CSSは不要**（`progression.js:184-200` と同じ既存クラスの流用）。

> ★警告文は既存の `js/ui_render.js:1050`「**本番セーブが終章まで進んだ状態になります**」をそのまま踏襲する。これが唯一の既存の作法なので、増やさず揃える。

### B-3. 接続点②：URL ルート

`js/nav.js:122-131` の `dev=1` 分岐に3行、`js/nav.js:89` の `story_read` に1行。

```js
// nav.js:122-131 の中に追記
if ((go === "story" || go === "story_read") && typeof chapterApply === "function" && p.get("ch")) {
  chapterApply(p.get("ch"), { read: p.get("read") === "1" });
}

// nav.js:89 を差し替え（?ch= が無ければ従来どおり一覧＝既定の挙動は不変）
story_read: function () {
  var c = null;
  try { c = new URLSearchParams(location.search).get("ch"); } catch (e) {}
  if (c && typeof renderStoryChapter === "function") renderStoryChapter(c); else renderStory();
},
```

これで missing 項目「章ジャンプのデバッグ手段が無い」と「`nav.js:89` が章IDを捨てる」の両方が閉じる。既定挙動（`?ch=` なし）は1ミリも変わらない。

### B-4. `shinganDevUnlock` の扱い

**消さない。委譲する。** `js/shingan_race.js:244-263` の ①〜③ を `chapterApply("ED")` 相当で置き換えれば、`_chapter_intro_1〜4` と `metMakura` も一緒に立ち、門番の破れが原理的に起きなくなる。④の演出フラグ戻し（`replay`）は神眼固有なので残す。

```js
function shinganDevUnlock(opts) {
  var o = opts || {};
  if (typeof chapterApply === "function") chapterApply("EP", { read: true });   // 第1〜5話既読＋終章起動
  if (typeof CH_REQ !== "undefined") { CH_REQ.scoutAll().fix(state); CH_REQ.peak(storyUnlockAt("ED")).fix(state); }
  var sg = shinganData();
  if (o.replay) { sg.intro = false; sg.cleared = false; sg.failShown = false; sg.best = null; }
  if (typeof saveGame === "function") saveGame();
  return { unlocked: shinganUnlocked(), allScouted: shinganAllScouted() };
}
```

---

## C. フラグの整理案

### C-1. まず「正本の宣言」を実装に合わせる（1行・ゼロリスク）

`js/state.js:41-44` は
> 「物語・解放の進行フラグの正本は `setStoryFlag/getStoryFlag`（`village.storyFlags` に保存）」「`getStoryFlag` が両読み」

と書いているが、実装は `js/event_hooks.js:43-44` で **`state.player.flags` のみ**を読み書きする。`village.storyFlags` / `village.eventFlags`（`js/state.js:78`・`js/state.js:253`）は宣言だけで、読み書きが1件も無い。

**推奨＝コメントを実装に合わせる。** 逆（両読みを実装する）はやらない。既存セーブの移行が要り、得るものがゼロだから。`village.storyFlags` のフィールド自体は保存レイアウト互換のため残し、「名残・常に空」と書き添える。

### C-2. 3階層に線を引く（②の答え）

| 階層 | 定義 | 例 | ゲートに使ってよいか |
|---|---|---|---|
| **P0 進行** | 章・機能の解放条件が読む。欠けると詰む | `_chapter_intro_1〜5`, `metMakura`, `everHit`, `poroFound`, `dragonScoutUnlocked`, `epilogue.active/finalReady/edFlag`, 値では `wins`/`completedRaces`/`assetsPeak` | ○（**ここだけ**） |
| **P1 体験** | 分岐はするが解放はしない。欠けても詰まない | `sakeGiftSeen`, `mallIntroSeen`, `firstWideHit`, `phoneBought`, `celestiaStrangerSeen`, `_unlocked_<id>`, `_story_read_<id>` | ×（使うとソフトロックの温床） |
| **P2 once ガード** | 同じ演出を2回出さないためだけ | `_anaTutorSeen`, `snsHelpSeen`, `_help_scout_seen`, `epMeterHelpSeen`, `dragonRobeGranted`, `eightDragonsAssembled` | × |

**この線が守られていない実例が、いま起きている最大の実害**である：`gameCleared` と `poroGourmetRaceUnlocked`（本来 P1/P2）が **クリア後コンテンツのゲート**（`js/poro_gourmet.js:61-70`, `js/ui_collection_score.js:70`）に昇格していて、書き手が `js/ui_render.js:1126-1129`（設定のおまけ経路）しかない。結果、**正規クリア直後に特別號から飛ぶと「🔒 まだ開いていません」でホームへ戻される**。

`CHAPTERS[].required` は **P0 だけ**を列挙し、`optionalFlags` に P1 を並べる。この2つを取り違えないことが、以後のソフトロックを防ぐ唯一の規律になる。

### C-3. 孤児フラグの処分（実害の有無で分ける）

| 分類 | 対象 | 処分 | 理由 |
|---|---|---|---|
| **A. 実害あり（直す）** | `gameCleared` / `poroGourmetRaceUnlocked` | **`epilogueClear()`（`js/epilogue_engine.js:263-265`）で `edFlag` と同時に立てる** | クリア後コンテンツが正規クリアで開かない。`ending_engine.js` 側で立てるとおまけ再生でも走ってしまうので、正規の印と同居させるのが単一。`ui_render.js:1126-1129` は「既存セーブの救済」として残してよい |
| **B. 読み手を1つ作る** | `epilogue.cycle`（`js/epilogue_engine.js:192` で加算・読み手0件） | 🏦島の経済「決戦の備え」（`js/ui_economy.js:186-199`）に「仕切り直し ◯回目」の1行 | 何度振り切れたかを画面が言えるようになる。1行で孤児が解消 |
| **C. 予約として残す（触らない）** | `seenFirstRaceTutorial`, `seenFirstWideTutorial`, `reachedCoins_10000`, `reachedCoins_100000000`, `firstRankUp`, `poroAppraisalStarted/Completed`, `poroConfirmedNotSacredDragon` | **削除しない。コメントで「予約・未使用」と明示するだけ** | 削除には初期オブジェクト（`js/state.js:46-66`）と `resetGame`（`js/state.js:236-243`）の両方を触る必要があり、`js/state.js:45` が既に「このリストは resetGame と常に一致させること」と自制している。得るもの＜壊すリスク |
| **D. 器ごと孤児（残す）** | `village.storyFlags` / `village.eventFlags` | 残す＋C-1のコメント修正 | 保存レイアウト互換 |
| **E. 死んだ入口（削るか使うか）** | `effects.setFlags`（`js/event_hooks.js:194-198`・registry で使用0件）、`condition.forbiddenFlag`（`js/event_hooks.js:140`・使用0件） | **残す**（対の `requiredFlag` は `js/event_registry.js:63,462,477,492` で現役／`forbiddenFlag` はチュートリアル設計で使い所がある＝§D-2） | 機構として整合しており、削ると将来また足すことになる |

### C-4. 命名の統一（新規のみ・既存は改名しない）

改名は **既存セーブでの演出再発火**を招く（`_anaTutorSeen` を改名すると全プレイヤーにチュートリアルが再出現する）。よって：

- **既存は据え置き。**
- **新規のフラグは接頭辞で階層を宣言する：** P0＝接頭辞なしの camelCase（既存の `metMakura`/`phoneBought` に合わせる）／P1＝`_unlocked_<id>`・`_story_read_<id>`（既存規則を継続）／P2＝**`_once_<id>`**（新規則）。
- **紛らわしい2語に呼び名を固定する。** `_chapter_intro_N` は「開いた瞬間」、`_story_read_N` は「全段落を読み切った」（`js/story_reveal.js:37,89`）で、`chapterRead()`（`js/data_assets.js:304`）という関数名は前者を指しているのに後者に見える。新規コードでは
  - `chapterOpened(id)` … `_chapter_intro_` を見る（＝`chapterRead` の別名）
  - `chapterFinished(id)` … `_story_read_` を見る
  の2ヘルパを足して使い分ける。`chapterRead()` は既存呼び出しのため残す（削らない）。

---

## D. チュートリアルとプレイ時間の設計

### D-1. 原則：**1章＝1教材**

いまチュートリアルは `js/event_registry.js:45,76,87,96,105` の once イベント群と、章の副作用（`js/ui_render.js:2020-2022` のミズ初回、`js/epilogue_engine.js:147-154` のメーター説明）に散っている。悪くない粒度だが、**どの章が何を教える責任を持つか**が書かれていない。`CHAPTERS[].teaches` がその宣言になる。

| 章 | 教える1つ | 既存の実装 | 不足 |
|---|---|---|---|
| 序章 | 賭ける→当たる／外れる | `js/event_registry.js:45,87,96,105` の once 群 | — |
| 第1話 | 物語の読み方（全画面リーダー） | `js/ui_story.js:272-274` `srOpenReader` | — |
| 第2話 | 人気とオッズは裏返し | `js/ui_render.js:2020-2022` `_anaTutorSeen` | — |
| **第3話** | 資産＝コインだけではない／**暮らしLvの上限はツリー** | `js/progression.js:33-37`（くらしツリー解放cut-in） | **★`livingLevelCap`（`js/data_ranks.js:141-150`）の説明がどこにも無い。** 第3話を読んだ瞬間に上限が発火するのに、プレイヤーには「急にレベルが上がらなくなった」としか見えない |
| 第4話 | 名声も資産／スマホで世界が変わる | `js/ui_home.js:386,434` CTA・`js/ui_render.js:346-355` 購入VN | — |
| 第5話／終章 | 綱引きのルール | `js/epilogue_engine.js:135-154`（初表示で自動1回） | **★8頭スカウトが最終決戦の出走要件（`js/shingan_race.js:84`）だと事前に言うのは `js/ui_economy.js:186-199` の「決戦の備え」だけ。** `chapterUnlockHint` の ED 文言（`js/data_assets.js:342`）にも無い |

**足すもの（2件・どちらも既存の型に1件足すだけ）**

1. `js/progression.js:33-37` の `lifetree` cut-in の `notifyBody` に1文追記：「これから**暮らしレベルは、この木がどれだけ育ったかで頭打ち**になります（20節でレベル1つぶん）」。
2. `js/progression.js:56-58` の `doomview` toast（第5話）に1文：「最終決戦には**8頭ぜんぶ**の相棒が要ります。スカウトを続けて。」

### D-2. `forbiddenFlag` の使いどころ

`js/event_hooks.js:140` に実装があるのに `js/event_registry.js` で使用0件。チュートリアルの「もう分かっている人には出さない」に使える（例：`_anaTutorSeen` が立っていたら初心者向けの重複解説を出さない）。**新機能ではなく、既にある機構を1回使うだけ**なので、削除ではなく活用を推す。

### D-3. プレイ時間とレース数の設計

物差しは `docs/GAME_DESIGN_NUMBERS.md:101-102` の確定値に合わせる：
**1戦約2分／平均的中で累計約165戦でR7／レースだけで6〜7時間・島時間込みでメイン10〜15時間級。**
章のペースは、この165戦の背骨の**内側に**収める（章がランクより先に走ると、R2の頃に終章が始まる）。

| 章 | 目標レース数（累計） | 目標時間 | 現状の実測／推定 | ズレの主因（file:line） |
|---|---|---|---|---|
| 序章＋第1話 | 0 → 5 | 10〜20分 | 一致 | — |
| 第2話 | 5 → 20 | 30〜45分 | **18〜88戦・中央値35**【推定・他調査】 | ブニクロ2000コイン（`js/data_assets.js:168,306-309`）が、R1〜R3帯の本命買いが期待値マイナスの区間に置かれている。ばらつきが4倍 |
| 第3話 | 20 → 22 | 5〜10分 | 一致（追加条件は初単勝だけ） | — |
| 第4話 | 22 → 60 | 60〜90分 | **第3話直後〜350戦に二極化**【推定・他調査】 | ★下の D-4 |
| 第5話 | 60 → 110 | 60〜90分 | **80〜91戦、または400戦でも未到達**【推定・他調査】 | ★同上 |
| 終章 | 110 → 150 | 60〜80分 | メーター160幅／レース毎+3、押し戻し6〜22（`js/epilogue_engine.js:95-99`） | 設計どおり。ただし `assetsPeak>=10億` で完全に迂回できる（`js/shingan_race.js:86-94`） |
| ED（最終決戦） | 150 → 165 | 40〜80分 | 神眼パズル | — |

### D-4. ★最大のレベルデザイン問題：`livingLevelCap` の fail-open

第4話・第5話のゲートは `assetsPeak`（`js/data_assets.js:325-326`）で、その主成分は**村価値**（`VILLAGE_VALUE_BY_LEVEL` ＝ `js/assets_engine.js:39`：Lv6=200万／Lv9=1.2億／Lv10=5億）。村レベルの上限は `livingLevelCap`（`js/data_ranks.js:141-150`）＝ `1 + floor(解放ノード数/20)`。

そして **`livingLevelCap` は第3話を読むまで上限なし（`LIVING_RANKS.length`）を返す**（`js/data_ranks.js:145-146`、コメントは「序盤のテンポを損なわないため」）。

結果、構造的に **「第3話を後回しにするほど第4話・第5話が早く開く」** という順序の逆転が残っている。第3話を読むこと自体がペナルティになっている。

**選択肢（要決裁）**

| 案 | 内容 | 効果 | 副作用 |
|---|---|---|---|
| **① 前段にも固定上限を置く（推奨）** | `js/data_ranks.js:146` の `return LIVING_RANKS.length;` を `return 4;` に | 第3話前は村Lv4（村12万）まで＝序盤のテンポは保つが、Lv10（村5億）への抜け道が閉じる。第4話（100万）にはツリーが必須になり、章順どおりに進む | 進行が変わる。リリース前なので後方互換不要（`docs/PROGRESSION_DESIGN.md` 方針） |
| ② 章ゲートを資産から外す | 第4話も実績ベース（例：フォロワー／スカウト頭数）へ | 逆転は消える | 「資産100万」という物語の芯（第3話＝スミカと総資産）が薄まる |
| ③ そのまま | — | ゼロコスト | 到達戦数が22〜350戦で暴れる＝プレイ時間が設計不能 |

**推奨は①。** 1行で、`assetsPeak` の上げ方（＝村・名声）にも `race math` にも触れない。
なお `applyLivingLevelUps`（`js/state.js:372-387`）は既に「上限は上がらないだけ・**得たレベルは絶対に下げない**」を保証しているので、①を入れても既存の走が壊れることはない。

### D-5. その他の体験上の穴（章に紐づくもの）

| 穴 | 根拠 | 提案 |
|---|---|---|
| **単勝を買わない人は第3話以降に永久到達できない** | `wins` は `js/ui_render.js:2745-2748` で `bet.type==="win"` のときだけ増える。第3話ゲート＝`wins>=1`（`js/data_assets.js:324`）。おでかけ（`js/ui_konron_map.js:143`）も同条件 | `hitsByRank` は式別不問で記録済み（`js/ui_render.js:2741-2744`）。**代替条件を1つ足す**：`wins>=1 \|\| 複勝/ワイドの的中が5回` 程度。ゲート文言（`js/data_assets.js:339`）も併記に |
| **章を開くと不可逆な副作用が走るのに事前告知が無い** | 第4話＝`metMakura` 無条件セット（`js/ui_story.js:224`）、第5話＝`epilogueStart()`（同 :226）。比較：デバッグの終章直行には警告文がある（`js/ui_render.js:1047-1051`） | `CHAPTERS[].irreversible` を持たせ、物語一覧のカードに「この話を読むと終章が始まります」の1行。**確認ダイアログは要らない**（進行の妨げ）。告知だけで足りる |
| **終章に居場所が無い** | `STORY_CHAPTERS`（`js/data_assets.js:82-113`）は 1/2/3/4/5/ED の6件。終章は `epilogue.active` だけ | `CHAPTERS` に `id:"EP"` があるので、物語一覧に **カードではなく帯**（「◉ 終章 進行中 ─ 絶滅メーター ○○%」）を1本。`STORY_CHAPTERS` は触らない |
| **既読が1秒で立つ** | 章ゲートは全部 `_chapter_intro_`（開いた瞬間）を見る。`_story_read_`（全段落読了・`js/story_reveal.js:37,89`）はリーダー再オープン判定にしか使われない | 現状維持を推す。「読ませる」強制は初読リーダー（`js/ui_story.js:272-274`）が既に担っており、ゲートを `_story_read_` に変えると VN 中断で詰む経路が増える。ただし `chapterFinished()`（§C-4）を用意しておき、**演出・SNS・目標の分岐にだけ**使う |

---

## E. 外部ライブラリ／エンジンの要否 — 正直な結論

前提：`index.html` で 80本以上の classic script をグローバルに積む構成。**ビルドステップは無い**（`tools/check.mjs:1-18` が「ビルド無しプロジェクトの軽量ガード」と明記し、`node --check` と `?v=` トークンの一致だけを見ている）。`package.json` は存在しない（確認済み）。Node は v24.16.0。

### E-1. XState（状態機械）— ❌ 入れない

- **買えるもの**：宣言的な遷移、ガード、履歴、可視化ツール。
- **払うもの**：UMD ビルドの追加ロード（tree-shaking なし）、`index.html` に依存が1つ増える、そして何より **`chapterAvailable()` の条件をマシンのガードに書き写す必要がある**。
- **決定的な理由**：このリポジトリで実際に起きている事故は全部「同じ条件を2か所に書いて片方が古びた」型である（`STORY_UNLOCK_AT` vs 実ゲート＝`js/data_assets.js:279` と :322-326、到達不能な `js/assets_engine.js:202-206`、`docs/PROGRESSION_DESIGN.md:44-45`）。XState を入れることは **3つ目の正本を作ること** に等しく、病気そのものを増やす。
- さらに、章の進行は状態機械ではない。フラグは真にしかならない**単調な述語の束**であり、遷移も逆行もない。状態機械が得意なもの（逆行、並行状態、タイムアウト、キャンセル）がひとつも無い。
- **代替**：§A の `CHAPTERS` 表＋`chapterInvariants()`（合わせて約50行）で、必要な「ガード」と「不変条件」は全部書ける。

### E-2. zod（スキーマ検証）— ❌ 入れない

- zod が輝くのは **信用できない外部データ**（API レスポンス、ユーザー投稿 JSON）を境界で検証するとき。ここで扱う `state` は自分のコードが作り自分の localStorage から読むもので、**型が間違っている事故は起きていない**。
- 実際に起きているのは **組み合わせの不整合**（`metMakura` が立っているのに `_chapter_intro_4` が偽、`_chapter_intro_5` だけ既読）で、zod でこれを書くと `.refine(fn)` ＝**ただの関数**になる。13KB とビルド前提を払って、素の JS で書けるものを書くことになる。
- **例外条件**：セーブの **インポート／エクスポート機能**（他人のセーブ文字列を読み込む）を作るなら再検討に値する。現時点でそのような入口はコード中に見当たらない【未確認：全文検索はしていない】。

### E-3. テストランナー（Vitest / Jest）— ❌ ランナーは入れない／✅ Node 標準でテストは書く

- Vitest/Jest は **ESM＋transform 前提**で、classic script のグローバル群とは相性が悪い。動かすには `package.json` を作り、依存を数百パッケージ引き、`environment: jsdom` を足し、各ファイルを import 可能にするための **ソース改変**（`export`）まで要る。得られるものは「アサーションと watch」だけ。
- 一方、**このリポジトリには既に依存ゼロの Node ハーネスの前例がある**：`tools/check.mjs`（構文・キャッシュ版数・競合マーカー）、`tools/audit_facts.js`（画面の事実とコードの突合）、`tools/sim_mall_run.js`（バランス検証）。この作法にそのまま乗るのが最も安い。
- **推奨：`tools/check_chapters.mjs`（依存ゼロ・`node:test` + `node:vm`）。**

```js
// tools/check_chapters.mjs — 章ゲートと不変条件の回帰テスト（依存ゼロ）
//   実行: node tools/check_chapters.mjs
// classic script を vm で1つのコンテキストへ順に流し込む（tools/check.mjs と同じ思想）。
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import assert from "node:assert";

function fresh() {
  // ★必要なスタブは3つだけ（setStoryFlag → saveGame → localStorage を踏むため）
  const store = {};
  const ctx = createContext({
    window: {}, console,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { querySelector: () => null, querySelectorAll: () => [] }
  });
  ["utils", "data_dragons", "data_ranks", "data_assets", "state",
   "assets_engine", "lifetree_engine", "event_hooks", "progression", "data_chapters"]
    .forEach(f => runInContext(readFileSync(`js/${f}.js`, "utf8"), ctx, { filename: f }));
  return ctx;
}

for (const id of ["0", "1", "2", "3", "4", "5", "EP", "ED"]) {
  test(`章 ${id}: applyState → gate が開き、verify が空`, () => {
    const ctx = fresh();
    runInContext(`__r = chapterApply(${JSON.stringify(id)}, { read: true })`, ctx);
    assert.deepEqual(ctx.__r.problems, [], `章 ${id} の整合が崩れた:\n  ` + ctx.__r.problems.join("\n  "));
    assert.equal(runInContext(`chapterMeta(${JSON.stringify(id)}).gate(state)`, ctx), true);
  });
}

test("既読が飛んでいる state を I1 が捕まえる", () => {
  const ctx = fresh();
  runInContext(`setStoryFlag("_chapter_intro_5", true); __p = chapterInvariants(state)`, ctx);
  assert.ok(ctx.__p.some(s => s.startsWith("I1")), "飛び読みを検出できていない");
});
```

**このテストが最初から拾うはずのもの**（＝今日ある実バグの回帰ガード）：`shinganDevUnlock` 由来の「第5話だけ既読」（I1・I8）、正規クリアでクリア後コンテンツが開かない件（I9）。

- **正直な限界**：`js/state.js` の `saveGame()` は `localStorage` を触るので上のスタブが要る。`ui_*.js` は DOM 依存が濃いので **vm には載らない**（`tools/sim_mall_run.js:8-9` が「`mall_rpg.js` は window/DOM 依存で丸ごとは動かせない」と同じ事情を既に記録している）。よって Node 側でテストできるのは **データ層とゲート層まで**。UI の確認は §B のデバッグ章ジャンプ＋実機プレイが担う。この分担を最初から前提にする。

### E-4. まとめ

| 候補 | 判断 | 一言 |
|---|---|---|
| XState | **入れない** | 遷移も逆行も無い単調述語に状態機械は過剰。かつ正本が3つ目になる＝この repo の持病を悪化させる |
| zod | **入れない** | 型ではなく「組み合わせ」が壊れている。`.refine()` は結局ただの関数。セーブのインポート機能を作るなら再検討 |
| Vitest / Jest | **入れない** | ESM/transform 前提。`package.json` と依存とソース改変を払って、得るのはアサーションだけ |
| `node:test` + `node:vm`（標準） | **入れる** | 依存ゼロ・ビルド不要・`tools/check.mjs` の前例あり。約80行 |
| 新規の実行時ライブラリ全般 | **入れない** | `index.html` に80本積む構成で、進行の設計に外部ランタイムを増やす理由が無い |

---

## F. 実装の順序（小さく始めて壊さない）

各段は **単独でデプロイでき、前段に依存しない**ように並べてある。

| 段 | 内容 | 触るファイル | リスク | 目安 |
|---|---|---|---|---|
| **F0** | **コメントを実装に合わせる**（`js/state.js:41-44` の「正本＝village.storyFlags」を修正／`js/assets_engine.js:202-206` に「到達不能」と明記／`docs/PROGRESSION_DESIGN.md:44-47` と `docs/GAME_DESIGN_NUMBERS.md:30,50,104-107` を現行に更新し、本文書を章の正本として参照） | コメントと docs のみ | **ゼロ**（実行コード不変） | 30分 |
| **F1** | **`js/data_chapters.js` を新設**（§A）＋`index.html:106` の直後に1行。**この時点では誰も呼ばない**＝挙動は完全に不変 | 新規1本＋`index.html` 1行 | ほぼゼロ（`?v=` は全体一括で揃える。`tools/check.mjs` が版数割れを検出する） | 半日 |
| **F2** | **`tools/check_chapters.mjs`**（§E-3）を足して現状を測る。ここで I1/I8/I9 が赤く出る＝既知バグの再現テストが手に入る | 新規1本 | ゼロ（本番非搭載） | 2時間 |
| **F3** | **デバッグ章ジャンプ**（§B-2 設定盤／§B-3 URL）。`state.ui.debug` の中だけ＝通常プレイヤーには一切見えない | `js/ui_render.js`（:1053 直後に挿入）、`js/nav.js`（:89, :122-131） | 低 | 半日 |
| **F4** | **実害フラグを直す**：`epilogueClear()`（`js/epilogue_engine.js:263-265`）で `gameCleared` と `poroGourmetRaceUnlocked` を立てる。F2 の I9 が緑になることで検証 | `js/epilogue_engine.js` 数行 | 低（既存の `ui_render.js:1126-1129` は救済として残す） | 1時間 |
| **F5** | **`shinganDevUnlock` を `chapterApply` へ委譲**（§B-4）。F2 の I1/I8 が緑になる | `js/shingan_race.js:244-263` | 低（開発用経路のみ） | 1時間 |
| **F6** | **チュートリアル2件を追記**（§D-1）：くらしツリー cut-in に上限の説明、第5話 toast に8頭要件 | `js/progression.js:37, :58` の文字列2つ | ゼロ | 30分 |
| **F7** | **告知**（§D-5）：`CHAPTERS[].irreversible` を物語一覧のカードに1行／終章の帯 | `js/ui_story.js` | 低（表示のみ） | 半日 |
| **F8** | ★**決裁が要る**：`livingLevelCap` の fail-open を閉じる（§D-4 案①・`js/data_ranks.js:146` を `return 4;`）。**先に F2 のテストへ「第3話を読んでも第4話が遠のかない」ケースを足してから**変更する | `js/data_ranks.js` 1行 | **中**（進行が変わる。実機で1周プレイして確認するまで完了と言わない） | 決裁＋1日 |
| **F9** | ★**決裁が要る**：単勝以外の代替ゲート（§D-5 第3話）。同じく先にテストケース | `js/data_assets.js:324,339` | 中 | 決裁＋半日 |
| **F10** | 任意：`chapterVerifyAll()` を 🩺自己診断（`js/devcheck.js`）の巡回に合流させ、開発中は常時見張る | `js/devcheck.js` | ゼロ | 2時間 |

**やらないと決めたこと（記録として残す）**

- 外部ライブラリの導入（§E）。
- `_anaTutorSeen` 等の既存フラグの改名（既存セーブで演出が再発火する）。
- `village.storyFlags` の両読み実装（移行リスクだけで得るものが無い）。
- `state.js` の予約フラグ群の削除（`js/state.js:45` の自制に従う）。
- `STORY_CHAPTERS`（`js/data_assets.js:82-113`）へ序章・終章のカードを足すこと（`chapterAvailable` の `switch` は `default:false`（同 :331）＝データ駆動でないので、カードを足すと switch も同時に触ることになる。`CHAPTERS` 側で名前を持ち、UI は帯で表現する）。

---

### 付録：この文書が根拠にした主要な file:line（本セッションで実読）

`js/data_assets.js:279, 287-296, 304-334, 336-345` ／ `js/state.js:17-105, 123-160, 225-266, 348-412` ／ `js/event_hooks.js:20-65, 140, 194-198` ／ `js/progression.js:17-96, 139-231` ／ `js/goals.js:11-205` ／ `js/ui_story.js:188-275` ／ `js/ui_render.js:260-360, 960-1159, 2745-2748（引用のみ）` ／ `js/nav.js:14-141` ／ `js/shingan_race.js:70-94, 240-279` ／ `js/epilogue_engine.js:90-199` ／ `js/assets_engine.js:30-208` ／ `js/data_ranks.js:130-155` ／ `js/lifetree_engine.js:140-230` ／ `js/scout_engine.js:35-50` ／ `js/meals.js:310-330` ／ `js/ui_konron_map.js:135-150` ／ `js/poro.js:37-48` ／ `js/devcheck.js:1-60` ／ `tools/check.mjs:1-40` ／ `tools/audit_facts.js:1-45` ／ `tools/sim_mall_run.js:1-35` ／ `index.html:66-185` ／ `docs/PROGRESSION_DESIGN.md` 全文 ／ `docs/GAME_DESIGN_NUMBERS.md:88-112`

**未確認**：セーブのインポート／エクスポート経路の有無（全文検索していない）。`Dialogue`/`DLG` が実際に欠ける状況が起きるか（`js/ui_story.js:211` の fail-stuck 経路）。
**推定・他調査**：到達戦数のシミュレーション値、くらしツリー195/200ノードが前提を持つという計測、R1〜R3帯の期待値マイナス。本セッションでは実行していない。