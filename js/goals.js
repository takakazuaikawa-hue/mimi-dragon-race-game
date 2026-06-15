// =========================================================================
// goals.js — ホームの「目標（クエスト）」。ストーリー進行に沿ったクリア要素を
//   ホーム左上に常設し、次に何を目指すかでモチベーションを訴求する。
// =========================================================================
// ★完全に表示専用＝既存 state を読んで達成を判定するだけ。新通貨・報酬・ゲーム進行には一切干渉しない
//   （[[race-math-immutable]]）。達成すると“次の目標”へ自動で進む。判定は毎描画時に評価。
// 段（phase）は物語の章とゆるく対応：序章→市場→暮らし→推し竜→神眼/終章。
// =========================================================================

// フォロワー数（ホーム表示と同じ式：名声・戦績連動の表示専用値）。
function goalFollowers() {
  try {
    var p = state.player;
    var fame = (state.assets && state.assets.fameValue) || 0;
    return 800 + Math.floor(fame * 2) + (p.completedRaces || 0) * 15 + (p.wins || 0) * 40;
  } catch (e) { return 0; }
}
function _gFlag(name) {
  try {
    if (typeof getStoryFlag === "function" && getStoryFlag(name)) return true;
    return !!(state.player && state.player.flags && state.player.flags[name]);
  } catch (e) { return false; }
}
function _gOutfitCount() {
  try {
    var p = state.player;
    var b = (p.outfitsBought || []).length, w = (p.outfitsWon || []).length;
    return b + w + 1;   // +1：初期の無料衣装（ブニクロ）は常に所持
  } catch (e) { return 0; }
}
function _gScouted() {
  try { return Object.values(state.player.collection || {}).filter(function (e) { return e && e.scouted; }).length; }
  catch (e) { return 0; }
}
function _gDexTotal() { try { return (typeof DRAGONS !== "undefined") ? DRAGONS.filter(function (d) { return d.id !== "poro"; }).length : 8; } catch (e) { return 8; } }
function _gLifeStage() { try { return (state.assets && state.assets.unlockedLifeStages) || 0; } catch (e) { return 0; } }
function _gLifeNodes() { try { return Object.keys((state.lifeTree && state.lifeTree.unlocked) || {}).filter(function (k) { return state.lifeTree.unlocked[k]; }).length; } catch (e) { return 0; } }

// 段メタ（物語進行）。
var GOAL_PHASES = [
  { id: 1, label: "序章 ― 霧の島で" },
  { id: 2, label: "第二話 ― オッズと市場" },
  { id: 3, label: "第三話 ― 暮らしを立てる" },
  { id: 4, label: "第四話 ― 推し竜の熱" },
  { id: 5, label: "終章 ― 島を守る" }
];

// 目標一覧。done(s) は達成判定（state を読むだけ）。順番＝挑戦順。
var GOALS = [
  // ── 序章 ──
  { id: "firstRace",   phase: 1, icon: "🏁", title: "はじめてのレースに出走する", hint: "まずは1戦、走ってみよう。",         done: function (s) { return (s.player.completedRaces || 0) >= 1; } },
  { id: "firstWin",    phase: 1, icon: "🏆", title: "はじめての勝利をあげる",       hint: "単勝でも複勝でも、1つ当てる。",   done: function (s) { return (s.player.wins || 0) >= 1; } },
  { id: "changeFit",   phase: 1, icon: "👗", title: "衣装を着替えてみる",           hint: "モールで服を手に入れて着替える。", done: function () { return _gOutfitCount() >= 2; } },
  { id: "firstMeal",   phase: 1, icon: "🍙", title: "屋台のごはんにありつく",       hint: "暮らしが上がると食事も変わる。",   done: function () { return _gLifeStage() >= 1; } },

  // ── 第二話：オッズと市場 ──
  { id: "learnRace",   phase: 2, icon: "📊", title: "レース場の仕組みを知る",       hint: "予想入門でオッズの読み方を学ぶ。", done: function () { return _gFlag("seenFirstRaceTutorial"); } },
  { id: "wideHit",     phase: 2, icon: "🎯", title: "ワイド／複勝を当てる",         hint: "単勝の外に“妙味”を見つける。",     done: function () { return _gFlag("firstWideHit"); } },
  { id: "rankUp",      phase: 2, icon: "🏅", title: "ランクを上げる",               hint: "出走と勝利でランク2へ。",         done: function (s) { return (s.player.rank || 1) >= 2; } },

  // ── 第三話：暮らしを立てる ──
  { id: "oneRoom",     phase: 3, icon: "🏠", title: "ワンルームへ引っ越す",         hint: "総資産を伸ばして住まいを上げる。", done: function () { return _gLifeStage() >= 2; } },
  { id: "basicFit",    phase: 3, icon: "👒", title: "基本のファッションを揃える",   hint: "お気に入りの晴れ着を集める。",     done: function () { return _gOutfitCount() >= 4; } },
  { id: "lifeTree",    phase: 3, icon: "🌱", title: "くらしツリーを育てはじめる",   hint: "暮らしポイントで生活を解放する。", done: function () { return _gLifeNodes() >= 1; } },
  { id: "conquerMeal", phase: 3, icon: "🍱", title: "島のごちそうを食べ尽くす",     hint: "立派な暮らし（最上級の食）まで。", done: function () { return _gLifeStage() >= 4; } },

  // ── 第四話：推し竜の熱 ──
  { id: "meetMakura",  phase: 4, icon: "📣", title: "マクラに会い、推し竜文化を知る", hint: "観客の熱が島を満たす。",          done: function () { return _gFlag("metMakura"); } },
  { id: "fol10k",      phase: 4, icon: "💗", title: "フォロワーを1万人にする",       hint: "名声と戦績で配信を育てる。",       done: function () { return goalFollowers() >= 10000; } },
  { id: "scout",       phase: 4, icon: "🐲", title: "竜を龍舎にスカウトする",       hint: "ポロと一緒に新しい仲間を迎える。", done: function () { return _gScouted() >= 1; } },
  { id: "dexHalf",     phase: 4, icon: "📖", title: "図鑑を半分まで埋める",         hint: "出会った竜を記録していく。",       done: function () { var seen = (typeof collectionSeenCount === "function") ? collectionSeenCount() : 0; return seen >= Math.ceil(_gDexTotal() / 2); } },

  // ── 終章：島を守る ──
  { id: "meetCelestia", phase: 5, icon: "🌌", title: "セレスティアの神眼に出会う",   hint: "淘汰のブラックメテオが現れる。",   done: function () { return _gFlag("_chapter_intro_5") || _gFlag("celestiaStrangerSeen"); } },
  { id: "growVillage",  phase: 5, icon: "🏘️", title: "村の経営を進める",            hint: "村レベルを上げ、施設を育てる。",   done: function (s) { return ((s.player.village && s.player.village.level) || s.player.villageLevel || 1) >= 2; } },
  { id: "fol100k",      phase: 5, icon: "💗", title: "フォロワーを10万人にする",     hint: "島いちばんの予想家へ。",           done: function () { return goalFollowers() >= 100000; } },
  { id: "protect",      phase: 5, icon: "☄️", title: "賭場を壊さず、島を守りきる",   hint: "終章をクリアしてエンディングへ。", done: function () { try { return !!(state.player.epilogue && state.player.epilogue.edFlag); } catch (e) { return false; } } }
];

function goalDone(g) { try { return !!g.done(state); } catch (e) { return false; } }
function goalsStats() {
  var done = 0;
  for (var i = 0; i < GOALS.length; i++) if (goalDone(GOALS[i])) done++;
  return { done: done, total: GOALS.length };
}
// 次に挑む目標（先頭の未達成）。全達成なら null。
function nextGoal() {
  for (var i = 0; i < GOALS.length; i++) if (!goalDone(GOALS[i])) return GOALS[i];
  return null;
}
if (typeof window !== "undefined") { window.GOALS = GOALS; window.nextGoal = nextGoal; window.goalsStats = goalsStats; }
