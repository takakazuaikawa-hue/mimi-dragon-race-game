// =========================================================================
// next_suggest.js — 次の一手エンジン（docs/GAME_EXPERIENCE_DESIGN.md §3・表示専用）。
// =========================================================================
// 「区切りの画面」が文脈に合う次の一手を1〜2個だけ提案する＝島の一日ループの結線。
// 台帳：{ at: 画面id, weight, icon, label, sub, cond(ctx), go }。
// at ごとに cond を満たす候補から weight 上位2件だけ表示。押しつけない（従来ボタンは常に有効）。
// ★追加規約：新機能を作ったら「入口1件・出口1件」をこの台帳に登録する（正本 §4 拡張契約）。
// 完全に表示専用＝レースの着順・オッズ・配当・FinalPower には一切影響しない。

var NEXT_SUGGEST = [
  // ── レース結果（勝ち）：結果→島時間の結線（M1・最重要の断線だった）──
  { at: "result", weight: 90, icon: "🍽", label: "勝ち飯を食べにいく", sub: "今日の一勝を、うまい飯で締める",
    cond: function (ctx) { return !!(ctx && ctx.hit); }, go: function () { renderMeals(); } },
  { at: "result", weight: 80, icon: "📱", label: "みんなの反応を見る", sub: "配信のファンが騒いでる",
    cond: function (ctx) { return !!(ctx && ctx.hit) && typeof broadcastOn === "function" && broadcastOn(); },
    go: function () { renderSns(); } },
  // ── レース結果（負け）──
  { at: "result", weight: 90, icon: "🍜", label: "負け飯で立て直す", sub: "負けても腹は減る。明日の一杯へ",
    cond: function (ctx) { return !(ctx && ctx.hit); }, go: function () { renderMeals(); } },
  { at: "result", weight: 70, icon: "🌳", label: "くらしツリーに一節", sub: "勝敗の外に、育つものがある",
    cond: function (ctx) {
      try { return !(ctx && ctx.hit) && getStoryFlag("_chapter_intro_3") && lifeTreeStats().available > 0; } catch (e) { return false; }
    }, go: function () { renderLifeTree(); } },
  { at: "result", weight: 60, icon: "📸", label: "今日の一枚を見にいく", sub: "観光の日替わりフォトミッション",
    cond: function (ctx) {
      try { return typeof _kmPhotoMission === "function" && konronMapUnlocked() && (function () { const id = _kmPhotoMission(); return id && !_kmPmDone(id); })(); } catch (e) { return false; }
    }, go: function () { renderKonronMap(); } }
];

// 区切り画面用の提案行を生成（無ければ null＝何も出さない）。
function nextSuggestRow(at, ctx) {
  try {
    const cands = NEXT_SUGGEST
      .filter(function (s) { return s.at === at; })
      .filter(function (s) { try { return !s.cond || s.cond(ctx); } catch (e) { return false; } })
      .sort(function (a, b) { return (b.weight || 0) - (a.weight || 0); })
      .slice(0, 2);
    if (!cands.length) return null;
    const row = el("div", "nx-row");
    row.appendChild(el("div", "nx-k", "このあとの島時間"));
    cands.forEach(function (s) {
      const b = el("button", "nx-chip");
      b.innerHTML = "<span class='nx-ic'>" + s.icon + "</span>" +
        "<span class='nx-tx'><b>" + s.label + "</b><small>" + (s.sub || "") + "</small></span>" +
        "<span class='nx-go'>▸</span>";
      b.onclick = function () { try { s.go(); } catch (e) {} };
      row.appendChild(b);
    });
    return row;
  } catch (e) { return null; }
}
