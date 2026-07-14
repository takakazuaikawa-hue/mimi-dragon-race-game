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
        surprise: "images/cast/stand/poro_surprise.webp"
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

// 発見完了＝フラグ確定（poroFound＋鑑定＋スカウト/龍舎を同時解放）。仕様 §8・§12。
function completePoroDiscovery() {
  if (typeof setStoryFlag !== "function") return;
  setStoryFlag("poroFound", true);
  setStoryFlag("poroAppraisalStarted", true);
  setStoryFlag("poroAppraisalCompleted", true);
  setStoryFlag("poroConfirmedNotSacredDragon", true);
  setStoryFlag("dragonScoutUnlocked", true);
  setStoryFlag("dragonStableUnlocked", true);
  showPoroUnlockNotice();
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
  app.appendChild(el("h2", null, "🏠 龍舎"));
  app.appendChild(el("div", "as-hint2", "ポロと、出会った竜たちの拠点。なでて仲良くなろう（表示専用・レースには影響しません）。"));

  // ── ポロ常駐カード（マスコット＋親密度＋なでる＋小イベント） ──
  const af = dragonAffection("poro");
  const poroCard = el("div", "card stable-poro");
  poroCard.innerHTML =
    `<div class="stable-poro-fig">${poroStandeeHTML(96)}</div>` +
    `<div class="stable-poro-info">` +
      `<div class="stable-poro-nm">🥹 泣き虫竜ポロ <span class="stable-tag">相棒</span></div>` +
      `<div class="stable-poro-sub">ムラサキマルチビ竜・幼体／気性：臆病でやさしい</div>` +
      `<div class="stable-aff"><span>なかよし度</span><div class="stable-aff-bar"><i style="width:${af}%"></i></div><b>${af}</b></div>` +
      `<div class="stable-poro-ev" id="stable-poro-ev">${poroStableEvent()}</div>` +
    `</div>`;
  const pet = el("button", "stable-pet", "🫳 なでる");
  pet.onclick = () => {
    const v = raiseAffection("poro", 3);
    if (window.Sfx && Sfx.play) Sfx.play("paho");
    poroCard.querySelector(".stable-aff-bar i").style.width = v + "%";
    poroCard.querySelector(".stable-aff b").textContent = v;
    const ev = document.getElementById("stable-poro-ev");
    if (ev) ev.textContent = pickPoroPet(v);
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

  // ── 出会った竜の一覧 ──
  const met = poroMetDragonIds().filter(id => id !== "poro");
  app.appendChild(el("div", "stable-sec", `🐉 出会った竜 <span>${met.length}</span>`));
  if (!met.length) {
    app.appendChild(el("div", "stable-empty", "まだポロのほかに竜はいません。レースで竜を見たり、竜スカウトで出会えます。"));
  } else {
    const grid = el("div", "stable-grid");
    met.forEach(id => {
      const d = dragonById(id); if (!d) return;
      const e = poroColEntry(id);
      const af2 = e.affection || 0;
      const card = el("button", "stable-card" + (e.favorite ? " fav" : ""),
        `<span class="stable-card-dot" style="background:${d.color || "#caa24a"}"></span>` +
        `<span class="stable-card-nm">${d.name}</span>` +
        `<span class="stable-card-sub">${poroStyleLabel(d)}・${poroTemperLabel(d)}${e.scouted ? " ・🔍" : ""}</span>` +
        `<span class="stable-card-aff"><i style="width:${af2}%"></i></span>`);
      card.onclick = () => showDragonDetail(id);
      grid.appendChild(card);
    });
    app.appendChild(grid);
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

// 個体詳細（表示専用）。
function showDragonDetail(id) {
  const d = dragonById(id); if (!d || typeof showInfoPopup !== "function") return;
  const e = poroColEntry(id);
  const rec = e.records || {};
  const af = e.affection || 0;
  showInfoPopup(`${id === "poro" ? "🥹 " : "🐉 "}${d.name}`,
    `<div class="dd-flavor">${d.portraitTone || ""}</div>` +
    `<div class="dd-row"><span>脚質</span><b>${poroStyleLabel(d)}</b></div>` +
    `<div class="dd-row"><span>得意距離</span><b>${poroDistLabel(d)}</b></div>` +
    `<div class="dd-row"><span>得意天候</span><b>${poroWeatherLabel(d)}</b></div>` +
    `<div class="dd-row"><span>気性</span><b>${poroTemperLabel(d)}</b></div>` +
    `<div class="dd-row"><span>体調</span><b>${poroMoodLabel(d)}</b></div>` +
    `<div class="dd-row"><span>人気度</span><b>${d.publicImage != null ? d.publicImage : "—"}</b></div>` +
    (d.traits && d.traits.length ? `<div class="dd-traits">${d.traits.map(t => `<span>${t}</span>`).join("")}</div>` : "") +
    `<div class="dd-row"><span>なかよし度</span><b>${af}</b></div>` +
    (rec.racesSeen ? `<div class="dd-rec">観戦${rec.racesSeen}・3着内${rec.top3Seen || 0}・あなたの的中${rec.playerHitCount || 0}</div>` : "") +
    `<div class="mm-note">※ 表示専用。レースの結果・オッズ・配当には影響しません。</div>`);
}

// =========================================================================
// 竜スカウトは「発見＆交渉」ゲームへ刷新（js/data_scout.js・scout_engine.js・ui_scout.js）。
// renderScout は ui_scout.js（poro.js の後に読み込み）で後勝ち上書き。旧・コイン即時抽選版
// （SCOUT_SPOTS / poroScoutCandidates / showScoutResult）はここから撤去した。
// 成立の払い出し（collection.scouted/seen＋raiseAffection＋epPush）は新UI側で同一。
// =========================================================================
