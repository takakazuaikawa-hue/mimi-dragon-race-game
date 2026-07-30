// =========================================================================
// poro.js — 泣き虫竜ポロ：相棒キャラ／物語アーク／解放フラグ（表示専用メタ）
// =========================================================================
// 仕様書「泣き虫竜ポロ 実装仕様書」に基づく。★最重要の前提：
//   - ポロは既に DRAGONS（data_dragons.js）に「出走する人気竜」として存在する。
//     その出走・オッズ・配当・図鑑・既存の登場イベント(§10)は一切変更しない。
//   - 本モジュールが足すのは “相棒としてのポロ” ＝ 発見/聖龍幼体説/鑑定の物語、
//     龍舎・スカウト・グルメレースの解放フラグ、ダイアログ上の立ち絵キャラ登録。
//     すべて表示専用メタ。着順/オッズ/配当（race/odds/betting）には非干渉。
//
// 公開（グローバル関数・classic script）：
//   poroFound()            … ポロを発見済みか
//   poroScoutUnlocked()    … 竜スカウト解放済みか
//   poroStableUnlocked()   … 龍舎解放済みか
//   poroGourmetUnlocked()  … ポロのグルメレース解放済みか
//   maybePlayPoroArc(chId) … 第4章を開いた初回に発見〜鑑定アークを再生（renderStoryChapterから呼ぶ）
//   PORO_PROFILE           … 仕様のプロフィール（後続フェーズで参照）
// =========================================================================

// 仕様 §9 のプロフィール（表示専用・参照用）。
const PORO_PROFILE = {
  id: "poro",
  displayName: "ポロ",
  title: "泣き虫竜",
  species: "ムラサキマルチビ竜",
  growthStage: "juvenile",
  isSacredDragon: false,
  canRace: false,          // ＝“相棒システム経由では出走させない”の意。既存のレース出走ポロとは別レイヤ。
  canFly: false,
  temperament: "timid",
  favoriteFoods: ["紫色の果実", "甘い木の実", "柔らかい根菜", "屋台の菓子", "特製ポロ饅頭"],
  dislikedThings: ["歓声", "雷鳴", "発走ベル", "怒鳴り声", "単独行動"],
  cries: ["ぽろ……", "きゅるる……", "ぴゃあっ！", "ぽろぉぉぉ……！", "……ぽろっ！"],
  mascotRole: true
};

// ── フラグ（state.player.flags に保存。getStoryFlag/setStoryFlag は event_hooks.js） ──
function poroFound() { return typeof getStoryFlag === "function" && getStoryFlag("poroFound"); }
function poroScoutUnlocked() { return typeof getStoryFlag === "function" && getStoryFlag("dragonScoutUnlocked"); }
function poroStableUnlocked() { return typeof getStoryFlag === "function" && getStoryFlag("dragonStableUnlocked"); }
function poroGourmetUnlocked() { return typeof getStoryFlag === "function" && getStoryFlag("poroGourmetRaceUnlocked"); }
// ★図鑑(竜を見る)は「序章＝はじめて的中」で開放（progression再設計・docs/PROGRESSION_DESIGN.md）。
// 深い情報は出会い回数で段階的に解放（第4話頃に自然と深まる）。everHit は的中で立つフラグ。
function dexUnlocked() {
  return !!(typeof getStoryFlag === "function" && getStoryFlag("everHit"))
    || !!(state.player && state.player.flags && state.player.flags.everHit);
}

// ── ダイアログ立ち絵キャラとして登録（紫＝仕様の体色。立ち絵 webp が無ければ絵文字へ自動FB） ──
(function registerPoroCast() {
  if (typeof window !== "undefined" && window.Dialogue && Dialogue.registerCast) {
    Dialogue.registerCast("poro", {
      name: "ポロ", color: "#9a6ad0", symbol: "🥹", side: "left",
      // 紫ポロ立ち絵（ユーザー提供・512×768透過）。表情差分：default/cry/surprise。未配置時はsymbolへ。
      img: {
        default: "images/cast/stand/poro.webp",
        cry: "images/cast/stand/poro_cry.webp",
        surprise: "images/cast/stand/poro_surprise.webp",
        happy: "images/cast/stand/poro_happy.webp",     // Codex納品（CAST_ART_BRIEF §4・欠損はdefaultへFB）
        eat: "images/cast/stand/poro_eat.webp",
        sleepy: "images/cast/stand/poro_sleepy.webp"
      }
    });
  }
})();

// ── 第4章 発見〜聖龍幼体説〜鑑定〜受容の物語アーク（立ち絵セリフ） ──
// キャラの声（[[mimi-costume-mall]] §キャラの役割）：ミミ=来訪者(反応/質問)、サケ=現場/竜を見る、
// ミズ=市場/価値、スミカ=生活/手配、マクラ=観客/熱狂、セレスティア=聖龍の意味/世界の天井。
// ★小出し設計（ユーザー指示）：出会いは2勝目という早期タイミングなので、まだ物語で会っていない
//   顧問（ミズ＝第2話／スミカ＝第3話／マクラ＝第4話／セレスティア＝第5話）はこの核心シーンに
//   出演させない。彼女たちの反応は別の短い後日談シーン（poro***FollowupScript）として切り出し、
//   実際にその章を読んだ後に1回だけ再生する＝進行に追いつくまで小出しにする。
//   核心シーン（発見・命名オチ）はナレーター／ミミ／ポロ／村人／サケ（第1話＝最初から知り合い）だけで回す。
function poroDiscoveryScript() {
  return [
    ["narrator", "雷雨の去ったレース場の裏手。資材置き場、木箱の陰で——なにかが、ちいさく震えていた。"],
    ["mimi", "……あれ？ なにか、ふるえてる……。", "default"],
    ["poro", "……ぽろ……ぴゃっ……！", "surprise"],
    ["mimi", "わわっ、ごめんね。こわくないよ。ほら……おいで。", "happy"],
    ["poro", "……ぽろぉ……。", "cry"],
    ["mimi", "あったかい……。ちっちゃな竜さん。どこから来たの？", "default"],
    ["villager", "っ……その紫の体に、宝石みたいな鱗……ま、まさか、聖龍の幼体じゃ……！？"],
    ["mimi", "せ、聖龍……？ この子が……？", "panic"],
    // 旧ミズ台詞の情報（測定器がショートしただけ）を村人の口へ。未登場の顧問を出さないため。
    ["villager", "み、魔力測定器が振り切れとる……！ ——いや待て。この機械、この仔の涙と鼻水でショートしとるだけだ……。"],
    ["sake", "だが妙だ。この仔、人の不安によく耳が動く。音と匂いと、地の震えを拾っている。そこだけは、本物だ。"],
    ["mimi", "じゃあ……ほんとうに、聖龍なんですか……？", "default"],
    // 旧スミカ台詞の役割（鑑定へ促す）をサケへ。サケは第1話＝最初から会っている唯一の顧問。
    ["sake", "……知らん。憶測じゃ竜は育たん。鑑定に出せ。話はそれからだ。"],
    ["narrator", "＜鑑定結果＞　種族：ムラサキマルチビ竜／成長段階：幼体／希少指定：なし／聖龍との血縁：なし／特殊能力：なし／……食べ過ぎ傾向：あり。"],
    ["villager", "……な〜んだ。ぜんぶ、ふつうの仔竜かぁ。"],
    // 旧ミズ台詞の種明かしを村人＋ナレーターへ分担（「市場が夢を見た」の総括はナレーターが引き取る）。
    ["villager", "紫も、宝石みたいな鱗も、この辺じゃ珍しくねぇしなあ。巻いてた祭祀布だって、夜市の古布屋に積んであるやつだ。"],
    ["narrator", "開催日に現れたのも——屋台の果物が目当て。ただそれだけのことに、みんなが勝手に夢を見ていた。"],
    ["poro", "……ぽろ？", "default"],
    ["mimi", "……。", "default"],
    ["mimi", "じゃあ、世界を救わなくていいんですね。", "smile"],
    ["mimi", "よかった。ポロは、ポロのままでいいです。", "happy"],
    ["sake", "……ふん。名は？"],
    ["mimi", "ポロ。泣き虫の、ポロです。わたしの……相棒。", "happy"],
    ["poro", "……ぽろっ！"]
  ];
}
// 後日談Ⓐ-1：第2話（ミズと市場）を実際に読んだ後、初めて開いた時に1回だけ再生。ミズ＝市場・期待値の視点。
function poroMizuFollowupScript() {
  return [
    ["narrator", "帳簿から目を上げたその人が、ミミの腕の中をちらりと見た。"],
    ["mizu", "それが噂の“聖龍の幼体”ね。……ふふ。あの一週間、紫の布は三倍に跳ねたのよ、あはん。"],
    ["mimi", "え……ポロ、なんにもしてないのに……。", "default"],
    ["mizu", "そう。価値ではなく、期待だけが値を吊り上げた。——その子の値段はゼロ。だから安心して、抱いていなさい。"],
    ["poro", "……ぽろ？", "default"]
  ];
}
// 後日談Ⓐ-2：第3話（スミカと生活の立て直し）を実際に読んだ後、初めて開いた時に1回だけ再生。スミカ＝生活・住居の視点。
function poroSumikaFollowupScript() {
  return [
    ["narrator", "住まいの点検に来た秘書が、部屋の隅の毛布の山を見つけて足を止めた。"],
    ["sumika", "ミミ様。竜は情緒ではなく設備です。寝床・水場・餌箱——三点、手配いたしました。"],
    ["mimi", "そ、そこまで……！？ ポロ、おうちができたって。", "happy"],
    ["sumika", "生活が整えば、竜は泣き止みます。……ええ。人も、同じです。"],
    ["poro", "……ぽろっ！"]
  ];
}
// 後日談Ⓑ：第4話（マクラと推し竜文化）を実際に読んだ後、初めて開いた時に1回だけ再生。
function poroMakuraFollowupScript() {
  return [
    ["narrator", "ポロの噂は、あっという間に配信者の耳に入っていた。"],
    ["makura", "出たァ！ 噂の紫の仔竜！ こいつぁバズらせない手はないぜ！？"],
    ["mimi", "……この子はポロです。世界は救いません。ただの、食いしん坊で。", "smile"],
    ["makura", "そういうとこも込みで、バズるんだよなぁ。人気ってのは、正体よりキャラだぜ？"],
    ["poro", "……ぽろ？", "default"]
  ];
}
// 後日談Ⓒ：第5話（セレスティアの神眼）を実際に読んだ後、初めて開いた時に1回だけ再生。
function poroCelestiaFollowupScript() {
  return [
    ["narrator", "終章の気配が近づく頃、あの旅人がふらりとポロを覗き込んだ。"],
    ["celestia", "……ただの仔竜。けれど時々思うの。“ただの”が、一番強く続くのかもしれないと。"],
    ["mimi", "……セレスティアさん？", "default"],
    ["celestia", "なんでもないわ。大事にね、その子。"],
    ["poro", "……ぽろっ！"]
  ];
}

// 発見アークの再生（1回だけ）。完了後にフラグ確定＋解放通知。window._poroArcPlayingで二重起動ガード。
function _playPoroArc() {
  if (poroFound()) return false;
  if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
  if (window._poroArcPlaying) return false;
  window._poroArcPlaying = true;
  Dialogue.play(poroDiscoveryScript(), { force: true }).then(function () {
    window._poroArcPlaying = false;
    completePoroDiscovery();
  });
  return true;
}
// ★出会い＝序盤の「2勝目」（ユーザー指定）。ポロは第3・4章の一枚絵に既に登場するため、章開放
//   （総資産100万＝第4章）より前に加入させる。wins＝単勝的中数。結果画面(renderResult)から呼ぶ。
function maybePlayPoroArcOnWin() {
  if (poroFound()) return false;
  if (((state.player && state.player.wins) || 0) < 2) return false;
  return _playPoroArc();
}
// フォールバック：万一2勝より先に第3/4章へ到達していたら、章を開いた時に出会いを再生（取りこぼし防止）。
function maybePlayPoroArcOnChapter(chId) {
  if (chId !== "3" && chId !== "4") return false;
  if (poroFound()) return false;
  return _playPoroArc();
}
// 後日談の共通再生ヘルパー（_playPoroArcと同じ二重起動ガードを共用＝同時に2つ走らせない）。
function _playPoroFollowup(script, seenFlag) {
  if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
  if (window._poroArcPlaying) return false;
  window._poroArcPlaying = true;
  Dialogue.play(script, { force: true }).then(function () {
    window._poroArcPlaying = false;
    if (typeof setStoryFlag === "function") setStoryFlag(seenFlag, true);
    if (typeof saveGame === "function") saveGame();
  });
  return true;
}
// ★門番の正本＝顧問の“登場”は advisorMet(castKey)（総資産しきい値 AND その章の既読）だけで判定する。
//   Dialogue は STORY_CAST をそのまま使う＝台本に mizu/sumika/… を書いた瞬間に本名・テーマ色・立ち絵が
//   出てしまうため、後日談の門番も _chapter_intro_N の直読みではなく advisorMet に一本化する。
//   （fail-closed：advisorMet が未定義なら false ＝ 出さない。既読フラグは再生完了後にしか立たないので、
//     一時的に閉じても内容が消えることはなく、条件を満たした時に再生される。）
function _poroAdvisorMet(castKey) {
  try { return (typeof advisorMet === "function") && !!advisorMet(castKey); } catch (e) { return false; }
}
function _poroSeen(flag) { return !!(typeof getStoryFlag === "function" && getStoryFlag(flag)); }

// 小出しⒶ-1：ポロ発見済み＆ミズと出会った後、初回だけミズの後日談を再生（renderStoryChapterから呼ぶ）。
function maybePlayPoroMizuFollowup() {
  if (!poroFound()) return false;
  if (!_poroAdvisorMet("mizu")) return false;
  if (_poroSeen("poroMizuSceneSeen")) return false;
  return _playPoroFollowup(poroMizuFollowupScript(), "poroMizuSceneSeen");
}
// 小出しⒶ-2：ポロ発見済み＆スミカと出会った後、初回だけスミカの後日談を再生。
function maybePlayPoroSumikaFollowup() {
  if (!poroFound()) return false;
  if (!_poroAdvisorMet("sumika")) return false;
  if (_poroSeen("poroSumikaSceneSeen")) return false;
  return _playPoroFollowup(poroSumikaFollowupScript(), "poroSumikaSceneSeen");
}
// 小出しⒷ：ポロ発見済み＆マクラと出会った後（第4話）、初回だけマクラの後日談を再生。
function maybePlayPoroMakuraFollowup() {
  if (!poroFound()) return false;
  if (!_poroAdvisorMet("makura")) return false;
  if (_poroSeen("poroMakuraSceneSeen")) return false;
  return _playPoroFollowup(poroMakuraFollowupScript(), "poroMakuraSceneSeen");
}
// 小出しⒸ：ポロ発見済み＆セレスティアと出会った後（第5話＝正体解禁）、初回だけ後日談を再生。
//   ★伏線段階（celestiaStrangerSeen だけ立っている状態）では advisorMet が false ＝ 本名も立ち絵も出さない。
function maybePlayPoroCelestiaFollowup() {
  if (!poroFound()) return false;
  if (!_poroAdvisorMet("celestia")) return false;
  if (_poroSeen("poroCelestiaSceneSeen")) return false;
  return _playPoroFollowup(poroCelestiaFollowupScript(), "poroCelestiaSceneSeen");
}
// ui_story.js から章を開くたびに呼ぶ窓口（2→ミズ、3→スミカ、4→マクラ、5→セレスティア）。
// ★発見アークが同じ呼び出しで走った直後は poroFound() がまだ false（フラグは再生完了後に立つ）ため、
//   後日談はここでは走らず、次にその章を開いた時に再生される＝二重再生しない。
function maybePlayPoroFollowupOnChapter(chId) {
  if (chId === "2") return maybePlayPoroMizuFollowup();
  if (chId === "3") return maybePlayPoroSumikaFollowup();
  if (chId === "4") return maybePlayPoroMakuraFollowup();
  if (chId === "5") return maybePlayPoroCelestiaFollowup();
  return false;
}

// ★追いつき再生（ユーザー指定）：後日談は「章を開いた時」に出るが、第2話（総資産3千）・第3話（3万）は
//   出会い（単勝2勝目）より先に読まれるのが普通。そのままだと「章をもう一度開き直した時」にしか流れず、
//   多くのプレイヤーが見ないまま終わる。そこで発見の瞬間に、既に読み終えている章の後日談を章順にまとめて
//   再生してから解放通知を出す。門番は各 maybePlay* と同じ advisorMet（未登場の顧問は出ない）。
const PORO_FOLLOWUPS = [
  { cast: "mizu",     flag: "poroMizuSceneSeen",     script: poroMizuFollowupScript },
  { cast: "sumika",   flag: "poroSumikaSceneSeen",   script: poroSumikaFollowupScript },
  { cast: "makura",   flag: "poroMakuraSceneSeen",   script: poroMakuraFollowupScript },
  { cast: "celestia", flag: "poroCelestiaSceneSeen", script: poroCelestiaFollowupScript }
];
// まだ見ていない＝「出会い済みの顧問 × 未再生」の後日談（章順）。
function pendingPoroFollowups() {
  if (!poroFound()) return [];
  return PORO_FOLLOWUPS.filter(f => _poroAdvisorMet(f.cast) && !_poroSeen(f.flag));
}
// 溜まっている後日談を順に再生し、終わったら done() を呼ぶ。再生するものが無ければ false（呼び元が done する）。
function playPoroFollowupCatchup(done) {
  const pend = pendingPoroFollowups();
  if (!pend.length) return false;
  if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
  if (window._poroArcPlaying) return false;
  window._poroArcPlaying = true;
  let chain = Promise.resolve();
  pend.forEach(function (f) {
    chain = chain.then(function () { return Dialogue.play(f.script(), { force: true }); })
                 .then(function () {
                   if (typeof setStoryFlag === "function") setStoryFlag(f.flag, true);   // 1本ずつ確定（途中離脱でも取りこぼさない）
                   if (typeof saveGame === "function") saveGame();
                 });
  });
  chain.then(function () {
    window._poroArcPlaying = false;
    if (typeof done === "function") done();
  });
  return true;
}

// 発見完了＝フラグ確定（poroFound＋鑑定＋スカウト/龍舎を同時解放）。仕様 §8・§12。
function completePoroDiscovery() {
  if (typeof setStoryFlag !== "function") return;
  setStoryFlag("poroFound", true);
  setStoryFlag("poroAppraisalStarted", true);
  setStoryFlag("poroAppraisalCompleted", true);
  setStoryFlag("poroConfirmedNotSacredDragon", true);
  setStoryFlag("dragonScoutUnlocked", true);
  setStoryFlag("dragonStableUnlocked", true);
  // ★追いつき再生：poroFound を立てた直後なので、既に読み終えている章の後日談が pending に見える。
  //   出会い済みの顧問の反応を章順にまとめて流し、終わってから解放通知を出す（無ければ即通知）。
  const _caughtUp = (typeof playPoroFollowupCatchup === "function") &&
    playPoroFollowupCatchup(function () { showPoroUnlockNotice(); });
  if (!_caughtUp) showPoroUnlockNotice();
}

// 新機能解放通知（仕様 §12「UI上で新機能解放通知が表示される」）。
function showPoroUnlockNotice() {
  if (typeof showInfoPopup !== "function") return;
  showInfoPopup("🐲 ポロが仲間になった！",
    `<div class="mm-row"><span class="mm-ic">🥹</span><div><b>泣き虫竜ポロ</b>` +
      `<small>聖龍ではなかった——ただの、ふつうのムラサキマルチビ竜。それでも、ミミの大切な相棒。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏠</span><div><b>「龍舎」を解放</b><small>出会った竜を見守り、ポロと過ごす拠点。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🔍</span><div><b>「竜スカウト」を解放</b><small>野に眠る竜を探しにいける。ポロが案内してくれる。</small></div></div>` +
    `<div class="mm-note">※ ポロは競走させません。レースの結果・オッズ・配当は変わりません（表示専用）。</div>`);
}

// =========================================================================
// 表示専用メタの土台：親密度・出会った竜・竜の表示用ラベル
// （着順/オッズ/配当には一切触れない。state.player.collection を流用）
// =========================================================================
function poroColEntry(id) {
  if (typeof ensureCollectionEntry === "function") return ensureCollectionEntry(id);
  // フォールバック（ensureCollectionEntry未定義時）
  state.player.collection = state.player.collection || {};
  if (!state.player.collection[id]) state.player.collection[id] = { dragonId: id, seen: true, records: {} };
  return state.player.collection[id];
}
function dragonAffection(id) { const e = poroColEntry(id); return e.affection || 0; }
function raiseAffection(id, amt) {
  const e = poroColEntry(id);
  e.affection = Math.max(0, Math.min(100, (e.affection || 0) + amt));
  if (typeof saveGame === "function") saveGame();
  return e.affection;
}
function dragonById(id) { return (typeof DRAGONS !== "undefined") ? DRAGONS.find(d => d.id === id) : null; }

// ── お世話ゲーム（龍舎）＝表示メタのデイリーループ ─────────────────────
// なでる=1日3回まで有効(+3)・ごはん=1日1回(+6/大好物+12)。絆(affection)はランク4段階で可視化し、
// 見返り＝「絆の深い順に八竜見参へ並ぶ」（scoutedRosterのaffection降順＝既存結線の可視化）。
// 大好物＝竜ごとに決定的に1品（食べ歩きMEALSから）。当てると図鑑に記録＝52頭ぶんの発見パズル。
// コイン消費は食事と同じ表示メタ消費。レースの着順/オッズ/配当には一切非干渉。
function _stDay() { return Math.floor(Date.now() / 86400000); }
function stableCare(id) {
  const e = poroColEntry(id);
  if (!e.care || e.care.d !== _stDay()) e.care = { d: _stDay(), p: 0, f: false };
  return e.care;
}
const BOND_RANKS = [[90, "かぞく", "💞"], [60, "しんゆう", "💗"], [30, "なかよし", "💕"], [0, "かおみしり", "🤍"]];
function bondRank(af) { return BOND_RANKS.find(r => (af || 0) >= r[0]); }
// 大好物：竜IDから決定的に1品（クイズ品を除いた実食メニューから）。データ追加でも既存竜の好物が
// なるべくズレないよう、ID文字列のハッシュで固定。
function dragonFavFood(d) {
  if (!d || typeof MEALS === "undefined") return null;
  const pool = MEALS.filter(m => !m.quiz);
  if (!pool.length) return null;
  let h = 0; const s = String(d.id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
// 絆ランクの節目を跨いだらお祝い（表示のみ）。
function _bondRankUpToast(d, before, after) {
  const rb = bondRank(before), ra = bondRank(after);
  if (rb === ra) return;
  try { if (window.Sfx) Sfx.play("legendary"); } catch (e) {}
  if (typeof showInfoPopup === "function") showInfoPopup(`${ra[2]} 絆ランクアップ！`,
    `<div class="mm-row"><span class="mm-ic">${ra[2]}</span><div><b>${d.name} と「${ra[1]}」になった！</b><small>絆の深い竜から順に、最終決戦の「八竜見参」に並びます。</small></div></div>`);
}

const PORO_STYLE_LABEL = { escape: "逃げ", front: "先行", late: "差し", chase: "追込" };
function poroStyleLabel(d) { return (d && PORO_STYLE_LABEL[d.style]) || "オールラウンド"; }
// 得意距離/天候/気性/体調＝既存statから導出した“表示用”の見立て（レース計算には使わない）。
function poroDistLabel(d) { if (!d || !d.stats) return "—"; const s = d.stats; return s.stamina - s.speed >= 12 ? "長距離" : s.speed - s.stamina >= 12 ? "短距離" : "中距離"; }
function poroWeatherLabel(d) {
  const r = (d && d.courseReputation) || {};
  const arr = [["晴/火山", r.fire || 0], ["風", r.wind || 0], ["霧", r.fog || 0]];
  arr.sort((a, b) => b[1] - a[1]);
  return arr[0][1] >= 60 ? arr[0][0] : "オールラウンド";
}
function poroTemperLabel(d) {
  const n = (d && d.stats && d.stats.nerve) || 50;
  return n >= 78 ? "おだやか" : n >= 60 ? "すなお" : n >= 45 ? "きまぐれ" : "気難しい";
}
function poroMoodLabel(d) { const m = (d && d.visualMood) || 50; return m >= 70 ? "絶好調" : m >= 50 ? "ふつう" : "ねむそう"; }

// 出会った竜＝図鑑でseen、またはスカウト済(scouted)。ポロは常に先頭。
function poroMetDragonIds() {
  const col = (state.player && state.player.collection) || {};
  const ids = Object.keys(col).filter(id => col[id] && (col[id].seen || col[id].scouted));
  if (ids.indexOf("poro") < 0 && poroFound()) ids.unshift("poro");
  // ポロを先頭へ
  return ["poro"].concat(ids.filter(id => id !== "poro"));
}

// ポロの反応（仕様 §4.1 案内役・§6 注意：的中情報にはしない＝ランダムな気分）。
const PORO_REACTIONS = [
  "ポロが、その子の足元のにおいをふんふん嗅いでいる。",
  "ポロが、ちょっと隠れた。……人見知り、かな？",
  "ポロが、しっぽをふって近寄っていった。",
  "ポロが、きゅるると小さく鳴いた。",
  "ポロが、リボンを見せびらかすように胸を張った。",
  "ポロが、ふいに涙ぐんだ。……理由は、ポロにしか分からない。"
];
function poroReaction() { const a = PORO_REACTIONS; return a[Math.floor((dragonAffection("poro") + (state.player.completedRaces || 0)) % a.length)]; }

// =========================================================================
// 龍舎（仕様 §4.2）— 表示専用の管理拠点。ポロ常駐＋出会った竜の閲覧・親密度・お気に入り。
// =========================================================================
function renderStable() {
  if (!poroStableUnlocked()) {   // Ⓒ 無反応→🔒案内でフィードバック。
    if (typeof renderHome === "function") renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("🐉 龍舎（りゅうしゃ）",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースを勝ち進み、相棒と出会うと、竜たちのお世話ができるようになります。</small></div></div>`);
    return;
  }
  state.ui.screen = "stable";
  const app = beginScreen();
  // 龍舎の絵（Codex納品 bg/stable.webp）をヘッダーバナーに。404なら静かに消える。
  const hero = el("div", "stable-hero");
  hero.innerHTML = `<img src="images/bg/stable.webp" alt="" decoding="async" onerror="this.closest('.stable-hero').remove()"><span>🏠 龍舎</span>`;
  app.appendChild(hero);
  app.appendChild(el("div", "as-hint2", "なでて、ごはんをあげて、絆を深める。"));

  // ── ポロ常駐カード（マスコット＋親密度＋なでる[1日3回]＋小イベント） ──
  const af = dragonAffection("poro");
  const pr = bondRank(af);
  const care0 = stableCare("poro");
  const poroCard = el("div", "card stable-poro");
  poroCard.innerHTML =
    `<div class="stable-poro-fig">${poroStandeeHTML(96)}</div>` +
    `<div class="stable-poro-info">` +
      `<div class="stable-poro-nm">🥹 泣き虫竜ポロ <span class="stable-tag">相棒</span><span class="st-rank">${pr[2]} ${pr[1]}</span></div>` +
      `<div class="stable-poro-sub">ムラサキマルチビ竜・幼体／気性：臆病でやさしい</div>` +
      `<div class="stable-aff"><span>絆</span><div class="stable-aff-bar"><i style="width:${af}%"></i></div><b>${af}</b></div>` +
      `<div class="stable-poro-ev" id="stable-poro-ev">${poroStableEvent()}</div>` +
    `</div>`;
  const pet = el("button", "stable-pet", care0.p < 3 ? `🫳 なでる（今日あと${3 - care0.p}回）` : "🫳 なでる");
  pet.onclick = () => {
    const care = stableCare("poro");
    const before = dragonAffection("poro");
    let v = before;
    if (care.p < 3) { care.p++; v = raiseAffection("poro", 3); _bondRankUpToast(dragonById("poro") || { name: "ポロ" }, before, v); }
    if (window.Sfx && Sfx.play) Sfx.play("paho");
    poroCard.querySelector(".stable-aff-bar i").style.width = v + "%";
    poroCard.querySelector(".stable-aff b").textContent = v;
    pet.textContent = care.p < 3 ? `🫳 なでる（今日あと${3 - care.p}回）` : "🫳 なでる";
    const ev = document.getElementById("stable-poro-ev");
    if (ev) ev.textContent = care.p >= 3 && v === before ? "ポロはもう満足そう。今日はたくさん甘えられた。" : pickPoroPet(v);
  };
  poroCard.querySelector(".stable-poro-info").appendChild(pet);
  app.appendChild(poroCard);

  // ── スカウト／図鑑への導線（トップナビから龍舎に集約） ──
  const subnav = el("div", "stable-subnav");
  if (poroScoutUnlocked()) {
    const scoutRow = el("button", "stable-scout-cta", "🔍 竜スカウトへ行く");
    scoutRow.onclick = () => renderScout();
    subnav.appendChild(scoutRow);
  }
  if (typeof renderCollection === "function" && dexUnlocked()) {   // 図鑑は第4話マクラに会ってから
    const dexRow = el("button", "stable-scout-cta stable-dex-cta", "📖 図鑑（記録・ごほうび）");
    dexRow.onclick = () => renderCollection();
    subnav.appendChild(dexRow);
  }
  app.appendChild(subnav);

  // ── 迎えた竜（スカウト済＝お世話できる）と、見かけた竜（図鑑のみ）を分けて表示 ──
  const met = poroMetDragonIds().filter(id => id !== "poro");
  const scoutedIds = met.filter(id => (poroColEntry(id) || {}).scouted);
  const seenIds = met.filter(id => !(poroColEntry(id) || {}).scouted);
  const mkCard = (id, canCare) => {
    const d = dragonById(id); if (!d) return null;
    const e = poroColEntry(id);
    const af2 = e.affection || 0;
    const r = bondRank(af2);
    const careToday = canCare ? stableCare(id) : null;
    const todo = canCare && (careToday.p < 3 || !careToday.f);
    const card = el("button", "stable-card" + (e.favorite ? " fav" : "") + (canCare ? "" : " ghostly"),
      `<span class="stable-card-dot" style="background:${d.color || "#caa24a"}"></span>` +
      `<span class="stable-card-nm">${d.name}${todo ? ' <i class="st-todo">●</i>' : ""}</span>` +
      (canCare
        ? `<span class="stable-card-sub">${r[2]} ${r[1]}${e.favFound ? "・🍽" : ""}</span>`
        : `<span class="stable-card-sub">${poroStyleLabel(d)}・${poroTemperLabel(d)}</span>`) +
      `<span class="stable-card-aff"><i style="width:${af2}%"></i></span>`);
    card.onclick = () => showDragonDetail(id);
    return card;
  };
  app.appendChild(el("div", "stable-sec", `🐲 迎えた竜（お世話できる）<span>${scoutedIds.length}</span>`));
  if (!scoutedIds.length) {
    app.appendChild(el("div", "stable-empty", "まだ龍舎に竜はいません。🔍竜スカウトで心を通わせると、ここに迎えられます。"));
  } else {
    const grid = el("div", "stable-grid");
    scoutedIds.forEach(id => { const c = mkCard(id, true); if (c) grid.appendChild(c); });
    app.appendChild(grid);
  }
  if (seenIds.length) {
    app.appendChild(el("div", "stable-sec", `👀 見かけた竜（図鑑のみ）<span>${seenIds.length}</span>`));
    app.appendChild(el("div", "as-hint2", "スカウトで迎えると、お世話ができる。"));
    const grid2 = el("div", "stable-grid");
    seenIds.forEach(id => { const c = mkCard(id, false); if (c) grid2.appendChild(c); });
    app.appendChild(grid2);
  }

  const actions = el("div", "actions");
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ポロ立ち絵（webpがあれば画像、無ければ絵文字）。size=px。
function poroStandeeHTML(size) {
  return `<img class="poro-img" src="images/cast/stand/poro.webp" alt="ポロ" ` +
    `style="height:${size}px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
    `<span class="poro-emoji" style="display:none;font-size:${Math.round(size * 0.7)}px">🥹</span>`;
}
const PORO_STABLE_EVENTS = [
  "ポロが飼料箱に頭を突っ込んで、抜けなくなっている。",
  "ポロが入口で、ミミの帰りをじっと待っていたみたい。",
  "ポロが新入りの竜に、こわごわリボンを見せている。",
  "大きな竜のくしゃみに驚いて、ポロがぴょんと浮いた。",
  "ポロが果物の数を、こっそり誤魔化そうとしている。"
];
function poroStableEvent() { const a = PORO_STABLE_EVENTS; return a[Math.floor((state.player.completedRaces || 0 + dragonAffection("poro")) % a.length)]; }
function pickPoroPet(v) {
  if (v >= 90) return "ポロが、ぐりぐり頭をすりつけてくる。だいすき、って顔。";
  if (v >= 50) return "ポロが、きゅるんと目を細めて甘えてきた。";
  return "ポロが、おそるおそる近づいて、ほっぺをくっつけた。";
}

// 個体詳細＝お世話ポップアップ（なでる/差し入れ/大好物あて・すべて表示メタ）。
// スカウト済み（＋ポロ）だけがお世話対象。未スカウトは閲覧のみ＋スカウトへの導線。
function showDragonDetail(id) {
  const d = dragonById(id); if (!d || typeof el !== "function") return;
  const e = poroColEntry(id);
  const canCare = id === "poro" || !!e.scouted;
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop infopop dragon-care");
  ov.appendChild(box);
  const close = () => { ov.remove(); if (state.ui && state.ui.screen === "stable" && typeof renderStable === "function") renderStable(); };
  ov.onclick = (ev) => { if (ev.target === ov) close(); };
  const fav = dragonFavFood(d);
  const render = (reaction) => {
    const af = e.affection || 0;
    const r = bondRank(af);
    const rec = e.records || {};
    const care = canCare ? stableCare(id) : null;
    box.innerHTML =
      `<div class="navpop-t">${id === "poro" ? "🥹 " : "🐉 "}${d.name} <span class="st-rank">${r[2]} ${r[1]}</span></div>` +
      `<div class="infopop-body">` +
        `<div class="dd-flavor">${d.portraitTone || ""}</div>` +
        `<div class="dd-row"><span>脚質</span><b>${poroStyleLabel(d)}</b></div>` +
        `<div class="dd-row"><span>気性</span><b>${poroTemperLabel(d)}</b></div>` +
        `<div class="dd-row"><span>体調</span><b>${poroMoodLabel(d)}</b></div>` +
        `<div class="dd-row"><span>絆</span><b>${af}</b><div class="stable-aff-bar dd-aff"><i style="width:${af}%"></i></div></div>` +
        `<div class="dd-row"><span>大好物</span><b>${e.favFound && fav ? `${fav.icon || "🍽"} ${fav.name}` : "？？？"}</b></div>` +
        (e.favFound ? "" : `<div class="dd-hint">🍽 ごはんの差し入れで、大好物が見つかるかも。</div>`) +
        // 📓 交渉メモ（QUALITY_PASS P0-1）＝スカウトで効いた技のカテゴリ。次に会う時の攻略情報。
        ((function () {
          const memo = (typeof scoutMemoGet === "function") ? scoutMemoGet(id) : [];
          if (!memo.length) return "";
          const cc = (typeof SCOUT_CAT_COLOR !== "undefined") ? SCOUT_CAT_COLOR : {};
          return `<div class="dd-memo">📓 効いた技：` +
            memo.map(c => `<b style="color:${cc[c] || "#caa24a"}">${c}</b>`).join("・") + `</div>`;
        })()) +
        // 📜 伝承コレクション（スカウト体験で解禁した断章の永久保管棚）
        ((typeof dragonLoreTexts === "function" && dragonLoreTexts(id)) ? (function () {
          const L = dragonLoreTexts(id), lv = (typeof dragonLoreLv === "function") ? dragonLoreLv(id) : 0;
          return `<div class="dd-lore-t">📜 伝承 <b>${lv}</b>/3</div>` + L.map(function (t, i) {
            return (i < lv)
              ? `<div class="dd-lore"><b>${DRAGON_LORE_TITLES[i]}</b><p>${t}</p></div>`
              : `<div class="dd-lore locked"><b>${DRAGON_LORE_TITLES[i]}</b><p>🔒 ${DRAGON_LORE_HINTS[i]}</p></div>`;
          }).join("");
        })() : "") +
        (rec.racesSeen ? `<div class="dd-rec">観戦${rec.racesSeen}・3着内${rec.top3Seen || 0}・あなたの的中${rec.playerHitCount || 0}</div>` : "") +
        (reaction ? `<div class="dd-react">${reaction}</div>` : "") +
      `</div>`;
    const btns = el("div", "navpop-btns dd-btns");
    if (canCare) {
      // 🫳 なでる（1日3回まで有効）
      const petB = el("button", "navpop-go dd-care", care.p < 3 ? `🫳 なでる（あと${3 - care.p}）` : "🫳 なでる");
      petB.onclick = () => {
        const c2 = stableCare(id); const before = e.affection || 0;
        if (c2.p < 3) {
          c2.p++;
          const after = raiseAffection(id, 3);
          try { if (window.Sfx) Sfx.play("paho"); } catch (err) {}
          _bondRankUpToast(d, before, after);
          render(`${d.name}は気持ちよさそうに目を細めた。`);
        } else {
          render(`${d.name}はもう満足そうだ。……また明日、来よう。`);
        }
      };
      btns.appendChild(petB);
      // 🍽 ごはんをあげる（1日1回・覚えた食べ歩きメニューから・コイン消費＝表示メタ）
      const feedB = el("button", "navpop-go dd-care", care.f ? "🍽 今日はごはん済み" : "🍽 ごはんをあげる");
      feedB.onclick = () => {
        const c2 = stableCare(id);
        if (c2.f) { render(`${d.name}のおなかは、今日はもういっぱい。`); return; }
        const pool = (typeof MEALS !== "undefined") ? MEALS.filter(m => !m.quiz && typeof mealEaten === "function" && mealEaten(m.id)) : [];
        if (!pool.length) { render("差し入れできる料理をまだ知らない。……まず🍽ごはんで食べ歩きしてこよう。"); return; }
        // 品選びリスト（覚えた品＝あなたの食べ歩きが竜との絆になる）
        box.querySelector(".infopop-body").innerHTML +=
          `<div class="dd-feed-t">どれを差し入れる？（1日1回）</div>` +
          `<div class="dd-feed-list">` + pool.map(m => {
            const price = (typeof mealPrice === "function") ? mealPrice(m) : 100;
            return `<button class="dd-feed" data-m="${m.id}">${m.icon || "🍽"} ${m.name}<small>−${price.toLocaleString("ja-JP")}</small></button>`;
          }).join("") + `</div>`;
        box.querySelectorAll(".dd-feed").forEach(fb => {
          fb.onclick = () => {
            const m = MEALS.find(x => x.id === fb.getAttribute("data-m")); if (!m) return;
            const price = (typeof mealPrice === "function") ? mealPrice(m) : 100;
            if ((state.player.coins || 0) < price) { render(`持ち合わせが足りない……（${price.toLocaleString("ja-JP")}コイン必要）`); return; }
            state.player.coins -= price;
            if (typeof updateHeader === "function") try { updateHeader(); } catch (err) {}
            const c3 = stableCare(id); c3.f = true;
            const isFav = fav && fav.id === m.id;
            const before = e.affection || 0;
            const after = raiseAffection(id, isFav ? 12 : 6);
            try { if (window.Sfx) Sfx.play(isFav ? "legendary" : "coin"); } catch (err) {}
            if (isFav && !e.favFound) { e.favFound = true; if (typeof saveGame === "function") saveGame(); }
            _bondRankUpToast(d, before, after);
            render(isFav
              ? `${d.name}の目が、かがやいた——大好物だ！！　しっぽが正直すぎる。（絆+12）`
              : `${d.name}は${m.name}をゆっくり味わって、小さく鳴いた。（絆+6）`);
          };
        });
      };
      btns.appendChild(feedB);
    } else {
      const note = el("div", "dd-hint", "🔍 スカウトで心を通わせて迎えると、なでる・ごはんの差し入れができるようになります。");
      box.querySelector(".infopop-body").appendChild(note);
      if (typeof poroScoutUnlocked === "function" && poroScoutUnlocked() && typeof renderScout === "function") {
        const goScout = el("button", "navpop-go dd-care", "🔍 スカウトへ行く");
        goScout.onclick = () => { ov.remove(); renderScout(); };
        btns.appendChild(goScout);
      }
    }
    const ok = el("button", "navpop-go secondary", "とじる"); ok.onclick = close;
    btns.appendChild(ok);
    box.appendChild(btns);
    const note2 = el("div", "mm-note", "※ 表示専用。レースの結果・オッズ・配当には影響しません。");
    box.appendChild(note2);
  };
  render("");
  document.body.appendChild(ov);
}

// =========================================================================
// 竜スカウトは「発見＆交渉」ゲームへ刷新（js/data_scout.js・scout_engine.js・ui_scout.js）。
// renderScout は ui_scout.js（poro.js の後に読み込み）で後勝ち上書き。旧・コイン即時抽選版
// （SCOUT_SPOTS / poroScoutCandidates / showScoutResult）はここから撤去した。
// 成立の払い出し（collection.scouted/seen＋raiseAffection＋epPush）は新UI側で同一。
// =========================================================================

// =========================================================================
// 開発用：図鑑を全開放して竜の絵を一覧する（?go=collection&dev=1 から呼ぶ）
// =========================================================================
// 竜のスプライトや識別色を見直すとき、実際に遊んで全種そろえるのは現実的でないため。
// ★触るのは図鑑の「見た」フラグだけ＝表示専用メタ。スカウト成立(scouted)・絆・
//   レースの着順/オッズ/配当には一切触れない（[[race-math-immutable]]）。
function devSeeAllDragons() {
  try {
    const p = state.player;
    if (typeof setStoryFlag === "function") setStoryFlag("everHit", true);   // 図鑑の解放条件
    p.flags = p.flags || {}; p.flags.everHit = true;
    p.collection = p.collection || {};
    (typeof DRAGONS !== "undefined" ? DRAGONS : []).forEach(d => {
      const e = p.collection[d.id] || {};
      e.seen = true;                                     // ★seen だけ。scouted は立てない
      e.records = e.records || { racesSeen: 0 };
      p.collection[d.id] = e;
    });
    if (typeof saveGame === "function") saveGame();
    return { seen: Object.keys(p.collection).length, total: (typeof DRAGONS !== "undefined" ? DRAGONS.length : 0) };
  } catch (e) { return { error: String(e) }; }
}
if (typeof window !== "undefined") window.devSeeAllDragons = devSeeAllDragons;
