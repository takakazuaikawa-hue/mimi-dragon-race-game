// =============================================================================
// field_lessons.js — 習い事の「実地稽古」（遊ぶほど暮らしがそろう）
// =============================================================================
// ★狙い（docs/MINIGAME_LEVELUP_DIRECTIVE §6.5・ユーザー発注 2026-07-25）
//   習い事（ACTIVE_SKILLS 8種）は「月謝を払って通う」だけで上がっていた。
//   ここにモール大冒険・島めぐりの遊びが直接つながる「実地ルート」を足す。
//   遊びの副産物として、ミミの暮らし（習い事のドット）が金色に埋まっていく実感を作る。
//
// ★仕組み
//   ・fieldStats に各種カウンタを刻む（各フェーズのアクションが FieldStats.bump("...") を1行呼ぶ）。
//   ・KURASHI_FIELD 台帳＝8スキル×2条件（モール1／島めぐり1）。条件成立でスキルLv+1（実地稽古）。
//   ・実地で上がるのは各スキル最大2Lv（=2条件）。残り2Lvは従来の月謝＝実地は近道であって置き換えない。
//   ・師範ゲート尊重（fail-closed）：師範未登場なら即上げず fieldPending に積み、出会った章で「開花」。
//   ・実地で上げたLvは金ドット（askill-dot.field）で見える化。
//
// ★このファイルの約束：完全に表示専用メタ。レースの着順・オッズ・配当には一切触らない。
// =============================================================================

// 実地の対応表。skill＝ACTIVE_SKILLS の id。src＝"mall"/"tour"（金ドットの由来／各スキル最大2）。
// stat＝fieldStats のキー。need＝到達に必要な回数。line＝実地稽古カットインの一言（ミミ視点）。
var KURASHI_FIELD = [
  // 💬 英会話
  { id: "en_mall", skill: "english", src: "mall", stat: "mallSatisfied", need: 10, line: "観光客を10人もてなした。気づけば身振り手振りで通じてる。" },
  { id: "en_tour", skill: "english", src: "tour", stat: "tourStar2Port", need: 3,  line: "港で外国の人にシャッターを頼まれた。Here! で通じた！" },
  // 💪 会員制ジム
  { id: "gy_mall", skill: "gym",     src: "mall", stat: "mallSteps",     need: 200, line: "モールを200歩。歩き回るだけで、けっこうな運動になる。" },
  { id: "gy_tour", skill: "gym",     src: "tour", stat: "tourHighSpots", need: 2,  line: "崖と滝の高いところまで登った。太ももが自信をつけた。" },
  // 🍳 お料理教室
  { id: "co_mall", skill: "cooking", src: "mall", stat: "mallFoodComp",  need: 1,  line: "フードコートの品を全部そろえた。味の引き出しが増えた。" },
  { id: "co_tour", skill: "cooking", src: "tour", stat: "tourEats",      need: 8,  line: "食べ歩き8品。舌が肥えると、作る手も上がるらしい。" },
  // 📈 投資懇談会
  { id: "in_mall", skill: "invest",  src: "mall", stat: "mallHaggleWins", need: 10, line: "値切り10回成功。お金の交渉が、板についてきた。" },
  { id: "in_tour", skill: "invest",  src: "tour", stat: "tourEconSpot",  need: 1,  line: "大学の研究街で、オッズの理屈を覗いた。数字が味方に見える。" },
  // 🍵 茶道
  { id: "te_mall", skill: "tea",     src: "mall", stat: "mallLoungeRests", need: 5, line: "ラウンジで5回ひと息。座って呼吸を整える所作が身についた。" },
  { id: "te_tour", skill: "tea",     src: "tour", stat: "tourTeaMaster",  need: 1,  line: "温泉茶屋で傑作を撮れた日。心が静かだと、手も静かになる。" },
  // 🧘 ヨガ
  { id: "yo_mall", skill: "yoga",    src: "mall", stat: "mallCharges",   need: 10, line: "「ためる」を10回。息を止めて放つ呼吸が、板についた。" },
  { id: "yo_tour", skill: "yoga",    src: "tour", stat: "tourViewShots", need: 3,  line: "絶景を見頃に3枚。景色に呼吸を合わせるのが上手くなった。" },
  // 📚 読書会
  { id: "re_mall", skill: "reading", src: "mall", stat: "mallCodex12",   need: 12, line: "敵図鑑の弱点を12種。観察して覚えるのが、癖になってきた。" },
  { id: "re_tour", skill: "reading", src: "tour", stat: "tourGuideRead", need: 20, line: "旅の読み物を20件。知らない土地の話が、頭に積もっていく。" },
  // 🤲 ボランティア
  { id: "vo_mall", skill: "volunteer", src: "mall", stat: "mallHelpChoices", need: 5, line: "モールで5回、困った人を助けた。誰かの役に立つのは、癖になる。" },
  { id: "vo_tour", skill: "volunteer", src: "tour", stat: "tourCivic",    need: 1,  line: "村の暮らしの場所をめぐった。島に、少しずつ根が生えていく。" }
];

// ── state ヘルパ（すべて動的生成・後方互換）─────────────────────────────
function _flState() {
  var p = (typeof state !== "undefined" && state && state.player) ? state.player : null;
  if (!p) return null;
  p.fieldStats = p.fieldStats || {};
  p.fieldDone = p.fieldDone || {};
  p.fieldPending = p.fieldPending || {};
  p.fieldLevels = p.fieldLevels || {};
  p.activeSkills = p.activeSkills || {};
  return p;
}
// スキルの最大Lv（ACTIVE_SKILLS の levels.length）。
function _flSkillMax(skill) {
  try { var s = ACTIVE_SKILLS.find(function (x) { return x.id === skill; }); return s ? s.levels.length : 4; } catch (e) { return 4; }
}
// 師範に出会っているか（SKILL_SHIHAN の登場章 ch <= 現章）。未登場なら fail-closed。
function _flShihanMet(skill) {
  try {
    var m = (typeof _shihanOf === "function") ? _shihanOf(skill) : null;
    if (!m) return true;   // 師範が割り当てられていないスキルは制限なし
    var ch = (typeof kurashiChapter === "function") ? kurashiChapter() : 1;
    return ch >= m.ch;
  } catch (e) { return true; }
}

// ── カウンタ ────────────────────────────────────────────────────────────
var FieldStats = {
  bump: function (stat, n) {
    var p = _flState(); if (!p || !stat) return;
    p.fieldStats[stat] = (p.fieldStats[stat] || 0) + (n || 1);
    fieldCheck(stat);
  },
  get: function (stat) { var p = _flState(); return p ? (p.fieldStats[stat] || 0) : 0; }
};
// この stat を条件にする実地エントリを判定し、達成していたら実地稽古を発動。
function fieldCheck(stat) {
  var p = _flState(); if (!p) return;
  KURASHI_FIELD.forEach(function (e) {
    if (e.stat !== stat || p.fieldDone[e.id]) return;
    if ((p.fieldStats[e.stat] || 0) < e.need) return;
    p.fieldDone[e.id] = 1;   // 条件達成（開花待ちでも二度は数えない）
    _fieldGrant(e);
  });
}
// 実地の1レベルを与える（師範登場済み＝即上達／未登場＝pendingに積む）。
function _fieldGrant(e) {
  var p = _flState(); if (!p) return;
  var max = _flSkillMax(e.skill);
  if (_flShihanMet(e.skill)) {
    var cur = p.activeSkills[e.skill] || 0;
    if (cur < max) {
      p.activeSkills[e.skill] = cur + 1;
      p.fieldLevels[e.skill] = (p.fieldLevels[e.skill] || 0) + 1;   // 金ドット用
    }
    _fieldCutin(e, false);
  } else {
    p.fieldPending[e.skill] = (p.fieldPending[e.skill] || 0) + 1;   // 師範待ち
    if (typeof _showUnlockToast === "function") _showUnlockToast("✍️ 経験がミミの中に積もった…");
  }
  if (typeof saveGame === "function") saveGame();
}
// ── 開花：師範と出会った章で習い事画面を開いた時、まとめて反映（renderActiveSkills が呼ぶ）──
function fieldBloom() {
  var p = _flState(); if (!p) return false;
  var bloomed = false;
  Object.keys(p.fieldPending).forEach(function (skill) {
    var n = p.fieldPending[skill] || 0;
    if (n <= 0 || !_flShihanMet(skill)) return;
    var max = _flSkillMax(skill);
    for (var i = 0; i < n; i++) {
      var cur = p.activeSkills[skill] || 0;
      if (cur < max) { p.activeSkills[skill] = cur + 1; p.fieldLevels[skill] = (p.fieldLevels[skill] || 0) + 1; }
    }
    p.fieldPending[skill] = 0;
    bloomed = true;
    var m = (typeof _shihanOf === "function") ? _shihanOf(skill) : null;
    var who = (m && typeof castNameSafe === "function") ? castNameSafe(m.id) : "師範";
    _fieldCutin({ skill: skill, line: "——もう体が覚えてるじゃないか。（" + who + "）" }, true);
  });
  if (bloomed && typeof saveGame === "function") saveGame();
  return bloomed;
}
// 実地で上げたレベルのうち、まだ月謝で説明されていない“金ドット”の数。
function fieldGoldDots(skill) { var p = _flState(); return p ? (p.fieldLevels[skill] || 0) : 0; }

// ── 通知（実地稽古カットイン＝控えめなトースト。開花は少し強め）───────────
function _fieldCutin(e, bloom) {
  try {
    var sk = (typeof ACTIVE_SKILLS !== "undefined") ? ACTIVE_SKILLS.find(function (x) { return x.id === e.skill; }) : null;
    var ic = sk ? sk.icon : "✨", nm = sk ? sk.name : "習い事";
    var head = bloom ? ("🌸 " + nm + " が開花！") : (ic + " 実地の稽古：" + nm + " が上達！");
    if (typeof _showUnlockToast === "function") _showUnlockToast(head + "\n" + (e.line || ""));
    if (window.Sfx) Sfx.play(bloom ? "win" : "unlock");
    // ★G3-4 開花の瞬間だけミニアニメ（素材が無ければ何も出ない・表示専用）
    // 素材の花は**後半にかけてほどける**（実測：光る画素率が2.6秒あたりで最大）ので4秒見せる
    if (bloom && window.MiniClip) MiniClip.play("bloom", { ms: 4000 });
  } catch (err) {}
}

// Node 検証用
if (typeof module !== "undefined" && module.exports) {
  module.exports = { KURASHI_FIELD: KURASHI_FIELD };
}
