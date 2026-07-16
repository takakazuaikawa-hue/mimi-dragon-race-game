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

// ★ネタバレ門番 ─────────────────────────────────────────────
//   目標は「まだ出会っていない相手」の名前まで先に見せてしまう（新規セーブでも全段が読める）ため、
//   物語側（ui_story.js の ■■■■■■）と足並みを揃えて、未登場キャラの固有名・章題だけを伏せる。
//   ・顧問（サケ/ミズ/スミカ/マクラ/セレスティア）＝ data_assets.js の advisorMet() が唯一の述語。
//   ・ポロ＝ poro.js の poroFound() が唯一の門番（命名オチを潰さないため名前も「泣き虫」も出さない）。
//   ・伏せるのは正体だけ。条件（総資産◯◯・第N話を読む・2勝）は残す＝進む先はわかる（予告はOK）。
//   ・fail-closed：関数が未定義／例外なら「まだ出会っていない」側に倒す（ネタバレは不可逆・伏字は無害）。
function _gAdvisorMet(castKey) {
  try { return (typeof advisorMet === "function") ? !!advisorMet(castKey) : false; } catch (e) { return false; }
}
function _gPoroFound() {
  try { return (typeof poroFound === "function") ? !!poroFound() : false; } catch (e) { return false; }
}
// この目標の中身を伏せるか＝依存する相手（cast＝顧問キー／hides:"poro"）にまだ出会っていない。
// ★判定は goalDone ではなく advisorMet/poroFound で行う（達成フラグと“出会い”は別物のため）。
function goalMasked(g) {
  try {
    if (!g) return false;
    if (g.cast && !_gAdvisorMet(g.cast)) return true;
    if (g.hides === "poro" && !_gPoroFound()) return true;
  } catch (e) { return true; }   // 例外時も伏せる側へ
  return false;
}
// 表示用タイトル／ヒント（★UI側は g.title / g.hint を直読みせず必ずこの2つを通すこと）。
function goalTitleSafe(g) {
  if (!g) return "";
  return goalMasked(g) ? (g.maskTitle || g.title || "") : (g.title || "");
}
function goalHintSafe(g) {
  if (!g) return "";
  return goalMasked(g) ? (g.maskHint || g.hint || "") : (g.hint || "");
}
// 表示用アイコン。★記号もネタバレになりうる（☄️＝STORY_CAST.celestia.symbol）ので、
//   maskIcon を持つ目標は未登場のあいだ無害な記号へ差し替える（castSymbolSafe と同じ考え方）。
function goalIconSafe(g) {
  if (!g) return "";
  return goalMasked(g) ? (g.maskIcon || g.icon || "") : (g.icon || "");
}

// 段メタ（物語進行）。
var GOAL_PHASES = [
  { id: 1, label: "序章 ― 生き延びる" },
  { id: 2, label: "第二話 ― オッズと市場" },
  { id: 3, label: "第三話 ― 暮らしを立てる" },
  { id: 4, label: "第四話 ― 配信者になる" },
  { id: 5, label: "終章 ― 島を守る" }
];

// 目標一覧。done(s) は達成判定（state を読むだけ）。★順番＝挑戦順＝解放の道筋（docs/PROGRESSION_DESIGN.md）。
//   各目標の hint に「達成条件（両フラグ）」を明示し、達成で機能が解放される（解放ゲートは目標と同条件）。
var GOALS = [
  // ── 序章：生き延びる（静かホーム） ──
  { id: "firstRace",  phase: 1, icon: "🏁", title: "はじめてのレースに出走する", hint: "まずは1戦、走ってみよう。",                 done: function (s) { return (s.player.completedRaces || 0) >= 1; } },
  { id: "firstHit",   phase: 1, icon: "🎯", title: "はじめて的中する",           hint: "1点でも当てると 🐉竜の図鑑 が開く。",     done: function () { return _gFlag("everHit"); } },
  { id: "firstWin",   phase: 1, icon: "🏆", title: "はじめての勝利をあげる",     hint: "単勝で1着を当てる。",                       done: function (s) { return (s.player.wins || 0) >= 1; } },
  { id: "firstMeal",  phase: 1, icon: "🍙", title: "屋台のごはんにありつく",     hint: "🍽️ごはんで1品たべると達成。おなかが減ったら屋台へ。", done: function () { return (typeof mealStatsAll === "function") && mealStatsAll().got >= 1; } },   // ★実際に食べたかで判定（旧=総資産1万の代理指標）

  // ── 第二話：オッズと市場 ── 🛍️モール買い物が開く ──
  // cast: 未登場のあいだ固有名を伏せる（maskTitle/maskHint に切替）。条件＝総資産・第N話はそのまま残す。
  { id: "readCh2",    phase: 2, icon: "📊", title: "ミズの分析を学ぶ（第2話）", hint: "第1話を読み、レースを数戦こなすと第2話 → 🛍️モールで買い物が開放。", cast: "mizu", maskTitle: "？？？に会う（第2話）", done: function () { return _gFlag("_chapter_intro_2"); } },
  { id: "changeFit",  phase: 2, icon: "👗", title: "衣装を着替えてみる",         hint: "モールで服を手に入れて着替える。",         done: function () { return _gOutfitCount() >= 2; } },
  { id: "wideHit",    phase: 2, icon: "✨", title: "ワイド／複勝を当てる",       hint: "単勝の外に“妙味”を見つける。",             done: function () { return _gFlag("firstWideHit"); } },
  { id: "rankUp",     phase: 2, icon: "🏅", title: "ランクを上げる",             hint: "出走と勝利でランク2へ。",                   done: function (s) { return (s.player.rank || 1) >= 2; } },

  // ── 第三話：暮らしを立てる ── 🌱くらしツリー・生活資産／2勝で🐲龍舎・竜スカウト ──
  { id: "readCh3",    phase: 3, icon: "🏠", title: "スミカと総資産（第3話）",   hint: "第2話を読み、はじめて単勝を当てると第3話 → 🌱くらしツリー・生活資産が開放。", cast: "sumika", maskTitle: "？？？と総資産（第3話）", done: function () { return _gFlag("_chapter_intro_3"); } },
  // hides:"poro" ＝ 発見前は名前「ポロ」を出さない（命名オチを潰さないため。発見条件の2勝は仕様どおり不変）。
  { id: "buddy",      phase: 3, icon: "🐲", title: "相棒を見つける（2勝）",     hint: "2勝するとポロと出会い、🐲龍舎・竜スカウトが開く。", hides: "poro", maskHint: "2勝すると相棒と出会い、🐲龍舎・竜スカウトが開く。", done: function (s) { return (s.player.wins || 0) >= 2; } },
  { id: "lifeTree",   phase: 3, icon: "🌱", title: "くらしツリーを育てはじめる", hint: "暮らしポイントで生活を解放する。",         done: function () { return _gLifeNodes() >= 1; } },
  { id: "oneRoom",    phase: 3, icon: "🛏️", title: "ワンルームへ引っ越す",       hint: "🌳暮らしで、コインを払って引っ越す。",     done: function () { return (typeof roomLevel === "function") && roomLevel() >= 1; } },   // ★実際に引っ越したかで判定（引っ越しはコイン制）

  // ── 第四話：配信者になる ── 📱スマホ購入でホーム放送化・SNS解禁 ──
  { id: "meetMakura", phase: 4, icon: "📣", title: "マクラに会う（第4話）",     hint: "第3話を読み、総資産100万で第4話 → 📖図鑑の深い情報。", cast: "makura", maskTitle: "？？？に会う（第4話）", done: function () { return _gFlag("metMakura"); } },
  { id: "buyPhone",   phase: 4, icon: "📱", title: "スマホを買って配信を始める", hint: "マクラに背中を押されてスマホを買う → 配信ホーム・SNS・💗フォロワー解禁。", cast: "makura", maskHint: "？？？に背中を押されてスマホを買う → 配信ホーム・SNS・💗フォロワー解禁。", done: function () { return _gFlag("phoneBought"); } },
  { id: "fol10k",     phase: 4, icon: "💗", title: "フォロワーを1万人にする",   hint: "名声と戦績で配信を育てる。",               done: function () { return goalFollowers() >= 10000; } },
  { id: "dexHalf",    phase: 4, icon: "📖", title: "図鑑を半分まで埋める",       hint: "出会った竜を記録していく。",               done: function () { var seen = (typeof collectionSeenCount === "function") ? collectionSeenCount() : 0; return seen >= Math.ceil(_gDexTotal() / 2); } },

  // ── 終章：島を守る ── 全開放（スカウト全ロケ・買い物全品・暮らし全枝・上級グルメ） ──
  // セレスティアは伏線段階（celestiaStrangerSeen）でも本名・☄️・「神眼」を出さない（解禁は第5話＝advisorMet）。
  { id: "meetCelestia", phase: 5, icon: "🌌", title: "セレスティアの神眼（第5話）", hint: "第4話を読み、総資産1億で第5話 → 終章・☄️絶滅メーター。", cast: "celestia", maskTitle: "？？？（第5話）", maskHint: "第4話を読み、総資産1億で第5話 → 終章がはじまる。", done: function () { return _gFlag("_chapter_intro_5") || _gFlag("celestiaStrangerSeen"); } },
  { id: "scout3",     phase: 5, icon: "🌋", title: "新たな地で竜を3頭スカウトする", hint: "終章で全ロケーション（火山・水中・空中…）が開放。", done: function () { return _gScouted() >= 3; } },
  { id: "fol100k",    phase: 5, icon: "💗", title: "フォロワーを10万人にする",   hint: "島いちばんの予想家へ。",                   done: function () { return goalFollowers() >= 100000; } },
  // ☄️はセレスティアの記号（data_assets.js の STORY_CAST.celestia.symbol）＝未登場のあいだは出さない（R3）。文面に固有名は無いので伏せるのはアイコンだけ。
  { id: "protect",    phase: 5, icon: "☄️", title: "賭場を壊さず、島を守りきる", hint: "終章をクリアしてエンディングへ。",         cast: "celestia", maskIcon: "🏝️", done: function () { try { return !!(state.player.epilogue && state.player.epilogue.edFlag); } catch (e) { return false; } } }
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
// ★門番つきの表示関数も公開（ホーム／目標一覧の両方が同じ伏字ルールを使うため）。
if (typeof window !== "undefined") {
  window.GOALS = GOALS; window.nextGoal = nextGoal; window.goalsStats = goalsStats;
  window.goalMasked = goalMasked; window.goalTitleSafe = goalTitleSafe; window.goalHintSafe = goalHintSafe;
  window.goalIconSafe = goalIconSafe;
}
