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
      try { return !(ctx && ctx.hit) && getStoryFlag("_chapter_intro_3") && lifeTreeStats().readyCount > 0; } catch (e) { return false; }
    }, go: function () { renderLifeTree(); } },
  // ── レース結果共通（T0）：走った土地を島の地図で確かめる＝レース⇄島めぐりの結線 ──
  //   rg_* 6地域に写真が付いたので、地図を開くと「さっき走った場所」を1枚の景色として見られる。
  //   weight 78＝勝ち時は勝ち飯/SNSが優先、負け時に負け飯の次で自然に出る（既存の勝ち導線は不変）。
  { at: "result", weight: 78, icon: "🗺", label: "今日走った土地を見にいく", sub: "島の地図で、さっき走った場所を確かめる",
    cond: function () { try { return typeof konronMapUnlocked === "function" && konronMapUnlocked(); } catch (e) { return false; } },
    go: function () { renderKonronMap(); } },
  // ★M3 重複告知の削減：「今日の一枚」は崑崙マップ内のストリップと食事あとの導線で押し出す。
  //   結果画面からも出すと同じミニ発見を3口で告知＝出し過ぎになるので、結果画面からは外した（勝ち飯/SNS/負け飯で十分）。

  // ── 食事のあと（M2）：島の一日ループの続き ──
  { at: "meals", weight: 90, icon: "📸", label: "今日の一枚を見にいく", sub: "腹ごしらえのあとは、島さんぽ",
    cond: function () { try { return typeof _kmPhotoMission === "function" && konronMapUnlocked() && (function () { const id = _kmPhotoMission(); return id && !_kmPmDone(id); })(); } catch (e) { return false; } },
    go: function () { renderKonronMap(); } },
  { at: "meals", weight: 70, icon: "🐲", label: "次のレースへ", sub: "おなかも満ちた。さあ勝負",
    cond: function () { return typeof hungerCanRace !== "function" || hungerCanRace(); }, go: function () { renderRaceSelect(); } },

  // ── 観光のあと（M2）──
  { at: "konron", weight: 85, icon: "📱", label: "SNSに反応が来てる", sub: "配信のファンレターが未読",
    cond: function () { try { return typeof broadcastOn === "function" && broadcastOn() && typeof snsUnreadLetters === "function" && snsUnreadLetters() > 0; } catch (e) { return false; } },
    go: function () { renderSns(); } },
  { at: "konron", weight: 70, icon: "🐲", label: "次のレースへ", sub: "島を満喫したら、また競竜場へ",
    cond: function () { return typeof hungerCanRace !== "function" || hungerCanRace(); }, go: function () { renderRaceSelect(); } },

  // ── SNSのあと（M2）：一日の締め ──
  { at: "sns", weight: 90, icon: "🌙", label: "ホームへ（配信締め）", sub: "今日もおつかれさま。また明日",
    cond: function () { return true; }, go: function () { renderHome(); } }
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
