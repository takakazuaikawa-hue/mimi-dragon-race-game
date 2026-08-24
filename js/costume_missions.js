// =============================================================================
// costume_missions.js — 衣装ミッション＋ご褒美CG
// =============================================================================
// ★狙い（docs/COSTUME_MISSION_CG_DIRECTIVE.md・ユーザー発案 2026-08-03）
//   衣装は「買って着る」で終わっていた。そこに小さなミッション列を付け、達成すると
//   **その衣装を着たミミの一枚絵（ご褒美CG）**が開く。衣装が「思い出の入れ物」になる。
//
// ★守っていること
//   ・判定は**既存の状態を読むだけ**（新フラグを増やさない）。レース数値には一切触らない。
//   ・計器を置かない＝「達成率◯%」バーは作らない。読み物とチェックの形（[[propose-fun-not-instruments]]）。
//   ・取得カットインは既存 showLifeCutin に一本化（自作様式を増やさない・2026-08-03 決裁）。
//   ・記録は state.player.kurashi に相乗り（暮らし台帳と同じ場所・後方互換）。
//   ・告知しない：ミッションは衣装を持っている人のきせかえ画面に静かに現れる（告知7:余白3）。
// =============================================================================

// ── 判定に使う小道具（すべて既存stateの読み取り）──────────────────────────
function _cmKurashi() { try { return (state.player || {}).kurashi || {}; } catch (e) { return {}; } }
function _cmSeen(spotId) { return !!(_cmKurashi().spotsSeen || {})[spotId]; }
function _cmAte(mealId) { try { return typeof mealEaten === "function" && mealEaten(mealId); } catch (e) { return false; } }
function _cmStar(spotId) { try { return (_cmKurashi().photoStars || {})[spotId] || 0; } catch (e) { return 0; } }
function _cmRpg() { try { return (typeof rpgData === "function") ? rpgData() : {}; } catch (e) { return {}; } }
function _cmWins() { try { return (state.player || {}).wins || 0; } catch (e) { return 0; } }

// ── 台帳 ─────────────────────────────────────────────────────────────────
// outfit＝OUTFITS の id／cg＝ご褒美一枚絵／steps＝3手（行く・食べる・勝つ の型）
// line＝獲得時にミミが言うひとこと（声表準拠・短く）
var COSTUME_MISSIONS = [
  {
    outfit: "leonmall", icon: "👗", name: "モールでお買い物",
    cg: "images/cg/cg_leonmall.webp",
    kicker: "おでかけの記録",
    steps: [
      { t: "モールで大冒険を制覇する", done: function () { return !!_cmRpg().cleared; } },
      { t: "崑崙モールに立ち寄る",     done: function () { return _cmSeen("mall"); } },
      { t: "モールの品を20そろえる",   done: function () { try { return rpgShopTotalOwned().o >= 20; } catch (e) { return false; } } }
    ],
    line: "買いすぎた。……でも、後悔はしてないですっ。"
  }
];

function costumeMissionOf(outfitId) {
  for (var i = 0; i < COSTUME_MISSIONS.length; i++) if (COSTUME_MISSIONS[i].outfit === outfitId) return COSTUME_MISSIONS[i];
  return null;
}
// その衣装を持っているか（買った/戦利品/解放）。持っていない衣装のミッションは見せない。
function _cmOwned(outfitId) {
  try {
    var o = (typeof OUTFITS !== "undefined") ? OUTFITS.find(function (x) { return x.id === outfitId; }) : null;
    return !!(o && typeof outfitOwned === "function" && outfitOwned(o));
  } catch (e) { return false; }
}
function costumeCgGot(outfitId) { return !!(_cmKurashi().costumeCg || {})[outfitId]; }

// 達成チェック（きせかえ画面を開いた時・ミッション表示時に呼ぶ）。
// 3手そろっていて未取得なら、CGを開けてカットイン。
function costumeMissionCheck(outfitId) {
  var m = costumeMissionOf(outfitId);
  if (!m || !_cmOwned(outfitId) || costumeCgGot(outfitId)) return false;
  for (var i = 0; i < m.steps.length; i++) if (!m.steps[i].done()) return false;
  try {
    var kz = state.player.kurashi || (state.player.kurashi = {});
    var cg = kz.costumeCg || (kz.costumeCg = {});
    cg[outfitId] = 1;
    if (typeof saveGame === "function") saveGame();
    if (typeof showLifeCutin === "function") {
      showLifeCutin({ branch: "attire", icon: m.icon || "👗", title: "ご褒美の一枚絵「" + m.name + "」" });
    }
  } catch (e) {}
  return true;
}
// 全衣装ぶん走らせる（画面を開いた時の一括判定）。
function costumeMissionCheckAll() {
  var got = false;
  COSTUME_MISSIONS.forEach(function (m) { if (costumeMissionCheck(m.outfit)) got = true; });
  return got;
}

// ── 表示：きせかえ画面に差し込むミッション列のHTML（持っている衣装だけ）──────
function costumeMissionHtml(outfitId) {
  var m = costumeMissionOf(outfitId);
  if (!m || !_cmOwned(outfitId)) return "";
  var got = costumeCgGot(outfitId);
  var rows = m.steps.map(function (s) {
    var ok = false; try { ok = !!s.done(); } catch (e) {}
    return '<div class="cm-step' + (ok ? " ok" : "") + '"><span>' + (ok ? "✓" : "・") + '</span>' + s.t + '</div>';
  }).join("");
  return '<div class="cm-box' + (got ? " got" : "") + '">' +
    '<div class="cm-h">' + (m.icon || "👗") + ' ' + m.kicker + '</div>' + rows +
    (got ? '<button class="cm-open" data-cg="' + m.outfit + '">🖼 ご褒美の一枚絵を見る</button>' : "") +
    '</div>';
}
// ご褒美CGのビューア（タップで閉じる・表示専用）
function costumeCgOpen(outfitId) {
  var m = costumeMissionOf(outfitId); if (!m || !costumeCgGot(outfitId)) return;
  document.querySelectorAll(".cm-view").forEach(function (n) { n.remove(); });
  var ov = document.createElement("div");
  ov.className = "cm-view";
  ov.innerHTML = '<img src="' + m.cg + '" alt="">' +
    '<div class="cm-view-cap"><b>' + m.name + '</b><span>' + m.line + '</span></div>';
  ov.onclick = function () { ov.remove(); };
  document.body.appendChild(ov);
  try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
}

if (typeof module !== "undefined" && module.exports) { module.exports = { COSTUME_MISSIONS: COSTUME_MISSIONS }; }
