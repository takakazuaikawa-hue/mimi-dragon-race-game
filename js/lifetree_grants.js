// =========================================================================
// lifetree_grants.js — 🌱 くらしツリーのイベント授与（2026-08-02・ユーザー決裁済み）
// =========================================================================
// 「ツリーは手で取るだけのものにしない。イベントの所々でカットインで取得していくのが
// ギャグとして面白い」＝決裁。対応表の正本＝docs/LIFETREE_EVENT_GRANT_TABLE.md（22件・承認済み）。
//
// ★設計の芯
//   ・新しいフラグを1つも増やさない＝22件すべて既存の状態／フラグに相乗りする。
//   ・**資産帯は尊重する**：ノードの cost が示す到達資産に届くまでは授与を保留し、
//     届いた時点で授かる（物語の順序が資産の順序を追い越さない）。
//   ・授与は無料＝コインを引かない（購入経路 hunger.js の unlockLifeNode ラップは通さない）。
//   ・残り178ノードはコイン購入のまま＝経済のシンクは壊さない。
//   ・暮らしレベルの上限は 1+floor(解放数/20) なので、22件すべて授かっても上限は +1 だけ。
// ★完全に表示・進行メタ＝レースの着順・オッズ・配当・FinalPower には一切非干渉。
// =========================================================================

function _lgFlag(n) {
  try {
    if (typeof getStoryFlag === "function" && getStoryFlag(n)) return true;
    return !!(state.player && state.player.flags && state.player.flags[n]);
  } catch (e) { return false; }
}
function _lgMeals() { try { return mealStatsAll().got; } catch (e) { return 0; } }
function _lgKz() { try { return state.player.kurashi || {}; } catch (e) { return {}; } }
function _lgOutfits() {
  try {
    var p = state.player;
    return ((p.outfitsWon || []).length) + ((p.outfitsBought || []).length);
  } catch (e) { return 0; }
}

// ── 対応表（承認済み22件）。node はツリーの title（一意キー）。quip＝カットインの一言 ──
var LIFE_GRANTS = [
  { id: "lg_first_race", node: "借金とともに夜が明ける", when: function (p) { return (p.completedRaces || 0) >= 1; },
    at: "はじめてゲートをくぐった日", quip: "返す当てはない。でも、朝は来た。" },
  { id: "lg_first_meal", node: "食パンの耳をもらえる", when: function () { return _lgMeals() >= 1; },
    at: "はじめて島のものを食べた日", quip: "耳だけでも、もらえるって、すごいことでは？" },
  { id: "lg_first_hit", node: "缶コーヒーを飲み残せる", when: function () { return _lgFlag("everHit"); },
    at: "はじめて的中した日", quip: "飲み切らずに捨てた。ぜいたくの味がした。" },
  { id: "lg_first_win", node: "床じゃなく布団で寝る", when: function (p) { return (p.wins || 0) >= 1; },
    at: "はじめて単勝を獲った日", quip: "床の硬さを、からだが忘れていく。" },
  { id: "lg_first_outfit", node: "穴の空いてない靴下", when: function () { return _lgOutfits() >= 1; },
    at: "はじめて自分の服を買った日", quip: "親指が、外の世界を見なくなった。" },
  { id: "lg_first_walk", node: "中古の自転車を買う", when: function () { return Object.keys(_lgKz().areasWalked || {}).length >= 1; },
    at: "はじめて島を歩いた日", quip: "歩くのに飽きたので、こいだ。" },
  { id: "lg_met_bc", node: "ラジオで実況を聴く", when: function () { return _lgFlag("_chapter_intro_2") || _lgFlag("metMakura"); },
    at: "実況と出会った日", quip: "声だけで、走ってる景色が見える。すごい発明だ。" },
  { id: "lg_meals5", node: "半額の缶詰を狩る", when: function () { return _lgMeals() >= 5; },
    at: "食べ歩き5品", quip: "半額シールは、夕方の狩り。腕が上がってきた。" },
  { id: "lg_areas6", node: "一泊の小旅行", when: function () { return Object.keys(_lgKz().areasWalked || {}).length >= 6; },
    at: "島の6つの土地を踏んだ日", quip: "泊まってみたら、朝の島は別の島だった。" },

  { id: "lg_intro_a", node: "毎日湯船に浸かれる", when: function () { return _lgFlag("assetsIntroSeen"); },
    at: "スミカが家計簿をつけた日", quip: "帳面に「湯」と書かれていた。書かれると、うれしい。" },
  { id: "lg_reveal", node: "自分の冷蔵庫を持つ", when: function () { return _lgFlag("assetsRevealed"); },
    at: "自力の借金を返し終えた日", quip: "中身は麦茶だけ。でも、わたしの冷気だ。" },
  { id: "lg_meals10", node: "食材を“さん付け”できる", when: function () { return _lgMeals() >= 10; },
    at: "食べ歩き10品", quip: "大根さん。じゃがいもさん。……敬意です。" },
  { id: "lg_poro", node: "猫を迎える", when: function () { return _lgFlag("poroFound"); },
    at: "ポロを迎えた日", quip: "猫ではない。だいぶ大きい。でも、膝には乗る。" },
  { id: "lg_onsen", node: "詰め替えじゃないシャンプー", when: function () { return !!(_lgKz().spotsSeen || {}).uroko; },
    at: "温泉郷にはじめて行った日", quip: "ポンプを押すたび、いい音がする。これが本体か。" },
  { id: "lg_scout", node: "タクシーを“足”にする", when: function () { return _lgFlag("dragonScoutUnlocked"); },
    at: "竜を探しに行けるようになった日", quip: "遠くの竜に会いに行くのに、歩いてる場合じゃない。" },
  { id: "lg_master", node: "趣味のカメラを買う", when: function () { return (_lgKz().masterpieces || 0) >= 1; },
    at: "はじめて☆3の一枚を撮った日", quip: "腕がいいのか、島がいいのか。……島だな。" },
  { id: "lg_outfit3", node: "古着屋で上着を選ぶ", when: function () { return _lgOutfits() >= 3; },
    at: "衣装が3着になった日", quip: "「選ぶ」という動詞が、人生に増えた。" },

  { id: "lg_phone", node: "ギガを気にせず実況を観る", when: function () { return _lgFlag("phoneBought"); },
    at: "スマホを買った日", quip: "月末に画質が落ちない世界があるらしい。" },
  { id: "lg_meals25", node: "コンビニスイーツを我慢しない", when: function () { return _lgMeals() >= 25; },
    at: "食べ歩き25品", quip: "取材費です。取材費なんです。" },
  { id: "lg_ch5", node: "駅近の物件に住む", when: function () { return _lgFlag("_chapter_intro_5"); },
    at: "第5話に届いた日", quip: "始発が聞こえる。うるさい。……でも、駅近だ。" },
  { id: "lg_repay", node: "行きつけのバー", when: function () { return _lgFlag("sakeDebtSettled"); },
    at: "サケに恩を返しに行った日", quip: "受け取ってもらえなかった297万で、一杯おごった。" },
  { id: "lg_clear", node: "聖龍に名を覚えられる", when: function () { return _lgFlag("gameCleared"); },
    at: "物語を走り切った日", quip: "……名前、呼ばれた。呼ばれてしまった。" }
];

// ── 授与できるか（帯を尊重する） ────────────────────────────────────────
function _lgNode(title) {
  try { return (typeof LIFE_NODE_BY_TITLE !== "undefined") ? LIFE_NODE_BY_TITLE[title] : null; } catch (e) { return null; }
}
function _lgBandOk(node) {
  try {
    if (typeof lifeNodeBandAt !== "function") return true;
    var need = lifeNodeBandAt(node);
    if (!need) return true;
    return (typeof assetsPeak === "function") ? assetsPeak(state) >= need : true;
  } catch (e) { return true; }
}

// ── 走査：条件を満たしていて、まだ持っていないノードを授ける ───────────────
//   ホーム到着ごとに1回（紀行の記事と同じ息継ぎ）。複数たまっていたら順に見せる。
function lifeGrantScan() {
  var got = [];
  try {
    if (typeof LIFE_NODE_BY_TITLE === "undefined") return got;
    var p = state.player; if (!p) return got;
    var lt = state.lifeTree || (state.lifeTree = {});
    var un = lt.unlocked || (lt.unlocked = {});
    var log = p.lifeGranted || (p.lifeGranted = {});
    for (var i = 0; i < LIFE_GRANTS.length; i++) {
      var g = LIFE_GRANTS[i];
      if (log[g.id]) continue;
      var node = _lgNode(g.node);
      if (!node) continue;                          // 台帳とツリーがずれたら黙って飛ばす（fail-safe）
      var ok = false; try { ok = !!g.when(p); } catch (e) { ok = false; }
      if (!ok) continue;
      if (!_lgBandOk(node)) continue;               // 帯に届くまで保留（次の機会に授かる）
      log[g.id] = 1;
      if (!un[node.nodeId]) { un[node.nodeId] = true; got.push(g); }
    }
    if (got.length) { try { if (typeof saveGame === "function") saveGame(); } catch (e) {} }
  } catch (e) {}
  return got;
}

// ── 授与カットイン ───────────────────────────────────────────────────────
//   ★2026-08-03 ユーザー決裁：自作の緑カード（0.9秒）は廃止。**ツリー画面で買った時と同じ**
//   元のカットイン（showLifeCutin＝閃光＋集中線＋斜め帯・チープで良いやつ）へ一本化する。
//   複数たまっていたら、前のが閉じてから次を出す（重ねない・読む前に消さない）。
function lifeGrantCutIn(list, done) {
  if (!list || !list.length) { if (done) done(); return; }
  var i = 0;
  function next() {
    if (i >= list.length) { if (done) done(); return; }
    var g = list[i++];
    var node = _lgNode(g.node);
    if (node && typeof showLifeCutin === "function") {
      showLifeCutin(node);
      // 元カットインは自動2.4秒/タップ即閉じ。#lt-cutin が消えるのを見てから次へ（+0.3秒の息）
      var watch = setInterval(function () {
        if (!document.getElementById("lt-cutin")) { clearInterval(watch); setTimeout(next, 300); }
      }, 150);
    } else {
      // 予備（元カットインが無い環境）：タップで閉じるまで消えないカード
      var ov = document.createElement("div");
      ov.className = "lg-cut";
      ov.innerHTML =
        '<div class="lg-card">' +
          '<div class="lg-kicker">🌱 ' + g.at + '</div>' +
          '<div class="lg-node">' + g.node + '</div>' +
          '<div class="lg-note">タップで閉じる</div>' +
        "</div>";
      ov.onclick = function () { try { ov.remove(); } catch (e) {} next(); };
      document.body.appendChild(ov);
      try { if (typeof Sfx !== "undefined" && Sfx && Sfx.play) Sfx.play("unlock"); } catch (e) {}
    }
  }
  next();
}

// ホーム到着から呼ぶ入口（走査→あれば見せる）
function lifeGrantTick() {
  try {
    var got = lifeGrantScan();
    if (got.length) lifeGrantCutIn(got);
    return got.length;
  } catch (e) { return 0; }
}

// ── ツリー画面の入手ヒント：このノードはどこで手に入るのか ────────────────
//   「どこで取得できるかヒントを見られるようにしてバランスをとる」＝決裁。
function lifeNodeHint(node) {
  try {
    if (!node) return "";
    for (var i = 0; i < LIFE_GRANTS.length; i++) {
      var g = LIFE_GRANTS[i];
      if (g.node !== node.nodeId && g.node !== node.title) continue;
      if (state.player && state.player.lifeGranted && state.player.lifeGranted[g.id]) return "🌱 " + g.at + "に授かった";
      return "🌱 " + g.at + "に授かる";
    }
    return "🪙 コインで購入";
  } catch (e) { return ""; }
}

if (typeof window !== "undefined") {
  window.LIFE_GRANTS = LIFE_GRANTS;
  window.lifeGrantScan = lifeGrantScan;
  window.lifeGrantTick = lifeGrantTick;
  window.lifeNodeHint = lifeNodeHint;
}
