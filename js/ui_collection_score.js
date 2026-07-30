// =========================================================================
// ui_collection_score.js — 🏆 コレクション・やり込み（クリア後の“得点”）。
// =========================================================================
// 各コレクション（図鑑/衣装/食べ歩き/小イベント/くらしツリー/スカウト）の達成度を一覧＝総合達成率（得点）。
// ＋クリア後ミニゲーム（ポロのグルメレース・エンドレスタワー）への導線。
// ★完全に表示専用＝state を読むだけ。レース着順/オッズ/配当には非干渉（[[race-math-immutable]]）。
// docs/PROGRESSION_DESIGN.md ⑦。暮らしハブ「🏆 コレクション」から。
// =========================================================================

function _csRow(ic, name, got, total) {
  var g = Math.min(got, total), pct = total ? Math.round(g / total * 100) : 0;
  return `<div class="cs-row"><span class="cs-ic">${ic}</span>` +
    `<span class="cs-tx"><span class="cs-nm">${name}</span>` +
    `<span class="cs-bar"><i style="width:${pct}%"></i></span></span>` +
    `<span class="cs-num">${got} / ${total}</span></div>`;
}

// ── 各コレクションの収集状況の集計（表示専用・単一の集計元）─────────────
// ★2026-07-30 『ドラゴンレース紀行』の売上式（state.js checkDailyLogin）もこの総合達成率を
//   「紀行の充実度」として読む＝島でのあらゆる行動（食べ歩き/図鑑/写真/スカウト/衣装/暮らし）が
//   そのまま紀行のネタ＝売上になる（docs/ENDGAME_ECONOMY_REDESIGN.md 柱A）。
function collectionScoreParts() {
  var dexTot = (typeof _gDexTotal === "function") ? _gDexTotal() : 8;
  var rows = [];
  rows.push(["📖", "竜の図鑑", (typeof collectionSeenCount === "function") ? collectionSeenCount() : 0, dexTot]);
  var outGot = 0, outTot = 0;
  try { if (typeof OUTFITS !== "undefined") { outTot = OUTFITS.length; outGot = OUTFITS.filter(function (o) { return (typeof outfitOwned === "function") && outfitOwned(o); }).length; } } catch (e) {}
  rows.push(["👗", "晴れ着（衣装）", outGot, outTot]);
  var ml = (typeof mealStatsAll === "function") ? mealStatsAll() : { got: 0, total: 0 };
  rows.push(["🍽️", "食べ歩き（みみしんぼ）", ml.got, ml.total]);
  var se = (typeof storyEventsStats === "function") ? storyEventsStats() : { got: 0, total: 0 };
  rows.push(["✨", "物語の小イベント", se.got, se.total]);
  var ltGot = 0, ltTot = 0;
  try { var lt = (typeof lifeTreeStats === "function") ? lifeTreeStats() : null; if (lt) { ltGot = lt.unlockedCount || 0; ltTot = lt.totalNodes || 0; } } catch (e) {}
  rows.push(["🌳", "くらしツリー", ltGot, ltTot]);
  rows.push(["🐲", "スカウトした竜", (typeof _gScouted === "function") ? _gScouted() : 0, dexTot]);
  var sg = 0, stt = 0;
  rows.forEach(function (r) { sg += Math.min(r[2], r[3]); stt += r[3]; });
  return { rows: rows, got: sg, total: stt, pct: stt ? Math.round(sg / stt * 100) : 0 };
}
if (typeof window !== "undefined") window.collectionScoreParts = collectionScoreParts;

function renderCollectionScore() {
  state.ui.screen = "collection_score";
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  var app = beginScreen();   // 上部に「← 暮らし」
  app.appendChild(el("h2", null, "🏆 コレクション・やり込み"));

  var cs = collectionScoreParts();
  var rows = cs.rows, sg = cs.got, stt = cs.total, pct = cs.pct;

  // ── 総合達成度（得点） ──
  var hero = el("div", "card cs-hero");
  hero.innerHTML =
    `<div class="cs-hero-k">コレクション達成度</div>` +
    `<div class="cs-hero-pct">${pct}<small>%</small></div>` +
    `<div class="cs-hero-bar"><i style="width:${pct}%"></i></div>` +
    `<div class="cs-hero-sub">${sg} / ${stt} 集めた</div>`;
  app.appendChild(hero);

  app.appendChild(el("div", "card cs-list", rows.map(function (r) { return _csRow(r[0], r[1], r[2], r[3]); }).join("")));

  // ── クリア後ミニゲーム ──
  app.appendChild(el("div", "as-sec", "🎮 ミニゲーム"));
  var games = el("div", "as-entries");
  var gEntry = function (ic, label, sub, onClick) {
    var b = el("button", "as-entry", `<span class="as-entry-ic">${ic}</span><span class="as-entry-tx"><span class="as-entry-l">${label}</span><span class="as-entry-s">${sub}</span></span><span class="as-entry-ch">›</span>`);
    b.onclick = onClick; return b;
  };
  if (typeof poroGourmetUnlocked === "function" && poroGourmetUnlocked() && typeof renderPoroGourmet === "function") {
    games.appendChild(gEntry("🏃", "ポロのグルメレース", "横スクロールでごはんを集める（スコアアタック）", function () { renderPoroGourmet(); }));
  }
  if (typeof mallUnlocked === "function" && mallUnlocked() && typeof renderMall === "function") {
    games.appendChild(gEntry("🌟", "エンドレスタワー", "🗼お買い物ダンジョンの無限階に挑む", function () { renderMall(); }));
  }
  // ★この文が出る＝ミニゲーム未解放。相棒の名前は伏せる（未発見なら命名オチを潰す・R4）。
  if (!games.children.length) games.appendChild(el("div", "as-hint2", "進めると、やり込みミニゲームがここに並びます（本編クリア後に解放）。"));
  app.appendChild(games);

  var actions = el("div", "actions");
  var back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = function () { renderAssets(); };
  actions.appendChild(back);
  app.appendChild(actions);
}

if (typeof window !== "undefined") window.renderCollectionScore = renderCollectionScore;
