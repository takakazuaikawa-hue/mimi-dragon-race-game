// =========================================================================
// action_hooks.js — 島側の行動フックの結線（R1）
// =========================================================================
// 正本: docs/REWARD_LOOP_DESIGN.md
//
// ★原則（ユーザー決裁）：
//     「プレイヤーが何かをやるたびに、その見返りとしてイベントが見られる」
//
// ★実測で分かっていること（ここを誤解しないこと）：
//   **個別の反応は既にある**。食べれば react が出る／服は DLG.OUTFIT がミミに喋らせる／
//   スポットは到着ミニVN／撮影は☆評価とガイドのひとこと／ノードは showLifeCutin／
//   スカウトは竜ごとの一言。だから個別を1から書く必要はない。
//   空いていたのは「節目」と「横断」＝**島でやったことに顧問もSNSも反応しない**こと。
//   （レース側は afterRaceSelect 15本・afterEntryList 7本と厚いのに、島側はフックすら無かった）
//
// ★このファイルは「後勝ちラップ」だけを行う（hunger.js と同じ作法）。
//   既存の関数も、既存の個別反応も、一切書き換えない。上に世界の反応を重ねるための器。
// ★R1の時点では event_registry.js に登録が0本なので、runEventHooks は何もしない
//   ＝**挙動は完全に不変**（data_chapters.js と同じ入り方）。
// ★読み込み順：hunger.js より後（hunger が eatMeal / unlockLifeNode を先にラップするので、
//   こちらが外側になり、課金・満腹処理が終わってから発火する）。
// ★表示/メタ専用＝レースの着順・オッズ・配当・FinalPower には一切触れない。
// =========================================================================

// =========================================================================
// 未消化の残り（R2・ホームの誘導が読む）
// =========================================================================
// ★なぜ要るか（実測）：25レース走った時点で、行ける島スポット30/62がすべて未訪問、
//   食べ歩き0/44なのに、おでかけタブにドットが点かなかった。誘導の器（目標チップ・
//   タブのドット）はあるのに、未消化コンテンツと連動していなかった。
//   ＝レースだけ繰り返す層は「島に何かある」と気づけないまま終わる。
// ★判定はここ1か所に集める（ホーム側にロジックを散らさない）。
// ★fail-open ではなく **fail-quiet**：数えられなければ false＝出さない。
//   誤って点けるより、点かない方がまし（オオカミ少年にしない）。
// ★表示専用＝レースの着順・オッズ・配当には触れない。
function actionBacklog() {
  const out = { spots: 0, meals: 0, dragons: 0, nodes: 0 };
  // 🏝 行けるのに、まだ行っていないスポット
  try {
    if (typeof KONRON_SPOTS !== "undefined" && typeof _kmSpotOpen === "function" && typeof konronMapUnlocked === "function" && konronMapUnlocked()) {
      const seen = ((state.player || {}).kurashi || {}).spotsSeen || {};
      Object.keys(KONRON_SPOTS).forEach(function (id) {
        if (_kmSpotOpen(KONRON_SPOTS[id]) && !seen[id]) out.spots++;
      });
    }
  } catch (e) {}
  // 🍜 いま食べられるのに、まだ食べていない品
  try {
    if (typeof MEALS !== "undefined" && typeof mealUnlocked === "function") {
      const d = (typeof mealData === "function") ? mealData() : { eaten: {} };
      MEALS.forEach(function (m) { if (mealUnlocked(m) && !(d.eaten || {})[m.id]) out.meals++; });
    }
  } catch (e) {}
  // 🐲 図鑑で見たのに、まだ龍舎に迎えていない竜（＝スカウトの余地）
  try {
    if (typeof poroStableUnlocked === "function" && poroStableUnlocked() && typeof DRAGONS !== "undefined") {
      const col = (state.player || {}).collection || {};
      DRAGONS.forEach(function (d) { const e = col[d.id]; if (e && e.seen && !e.scouted) out.dragons++; });
    }
  } catch (e) {}
  // 🌳 いま取れるツリーのノード
  try {
    if (typeof LIFE_MILESTONES !== "undefined" && typeof lifeNodeState === "function" &&
        typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_3")) {
      LIFE_MILESTONES.forEach(function (n) { if (lifeNodeState(n) === "ready") out.nodes++; });
    }
  } catch (e) {}
  return out;
}

(function () {
  function fire(hook, ctx) {
    try { if (typeof runEventHooks === "function") runEventHooks(hook, ctx || {}); } catch (e) {}
  }
  function kz() { try { return (state.player && state.player.kurashi) || {}; } catch (e) { return {}; } }
  function countTrue(o) { try { return Object.keys(o || {}).length; } catch (e) { return 0; } }

  // ── 🍜 ごはんを食べる ───────────────────────────────────────────────
  // eatMeal は hunger.js が先にラップしている（課金・満腹・おごり）。その外側に付く。
  if (typeof eatMeal === "function") {
    const _origEat = eatMeal;
    eatMeal = function (id) {
      let before = 0; try { before = mealStatsAll().got; } catch (e) {}
      const r = _origEat.apply(this, arguments);
      try {
        const after = mealStatsAll().got;
        if (after > before) {                       // ★初めて食べた品のときだけ鳴らす（再読では鳴らさない）
          const meal = (typeof MEALS !== "undefined") ? MEALS.find(m => m.id === id) : null;
          fire("onMeal", { id: id, meal: meal, totalEaten: after });
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 👗 衣装を手に入れる ─────────────────────────────────────────────
  if (typeof buyOutfit === "function") {
    const _origBuy = buyOutfit;
    buyOutfit = function (id) {
      const r = _origBuy.apply(this, arguments);
      try {
        if (r && r.ok) {
          const o = (typeof outfitById === "function") ? outfitById(id) : null;
          let owned = 0; try { owned = OUTFITS.filter(x => outfitOwned(x)).length; } catch (e) {}
          fire("onOutfit", { id: id, outfit: o, totalOwned: owned });
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 🌱 くらしツリーのノードを取る ──────────────────────────────────
  // hunger.js のラッパ（コイン）より外側。livingUp も一緒に渡す。
  if (typeof unlockLifeNode === "function") {
    const _origNode = unlockLifeNode;
    unlockLifeNode = function (node) {
      const r = _origNode.apply(this, arguments);
      try {
        if (r && r.ok) {
          const n = countTrue(state.lifeTree && state.lifeTree.unlocked);
          fire("onLifeNode", { node: node, totalNodes: n, livingUp: r.livingUp || null });
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 📸 写真を撮る ───────────────────────────────────────────────────
  // pgOpen(spotId, onDone) の onDone を包む＝呼び元（ui_konron_map）の結線は不変。
  if (typeof pgOpen === "function") {
    const _origPg = pgOpen;
    pgOpen = function (spotId, onDone) {
      return _origPg.call(this, spotId, function (stars, detail) {
        try {
          if (stars > 0) fire("onPhoto", { spotId: spotId, stars: stars, detail: detail || null,
                                           masterpieces: (kz().masterpieces || 0) });
        } catch (e) {}
        if (typeof onDone === "function") return onDone(stars, detail);
      });
    };
  }

  // ── 🏝 スポットに初めて行く ────────────────────────────────────────
  // spotsSeen（K2の還流台帳）が増えた瞬間を拾う。台帳そのものは触らない。
  // ★ポーリングではなく、島マップの描画を通るたびに差分を見る（描画は必ず通る）。
  if (typeof renderKonronMap === "function") {
    let _lastSeen = null;
    const _origMap = renderKonronMap;
    renderKonronMap = function () {
      const r = _origMap.apply(this, arguments);
      try {
        const seen = kz().spotsSeen || {};
        if (_lastSeen !== null) {
          Object.keys(seen).forEach(function (id) {
            if (!_lastSeen[id]) {
              const s = (typeof KONRON_SPOTS !== "undefined") ? KONRON_SPOTS[id] : null;
              fire("onSpotVisit", { spotId: id, spot: s, totalSeen: countTrue(seen) });
            }
          });
        }
        _lastSeen = Object.assign({}, seen);
      } catch (e) {}
      return r;
    };
  }

  // ── 🌴 竜をスカウトする ─────────────────────────────────────────────
  if (typeof scoutedRoster === "function") {
    // 成立の瞬間は ui_scout 側（e.scouted = true）。ここでは龍舎/スカウト画面の描画で差分を見る。
    let _lastN = null;
    ["renderScout", "renderStable"].forEach(function (fnName) {
      if (typeof window[fnName] !== "function") return;
      const _orig = window[fnName];
      window[fnName] = function () {
        const r = _orig.apply(this, arguments);
        try {
          let n = 0; try { n = scoutedRoster().length; } catch (e) {}
          if (_lastN !== null && n > _lastN) fire("onScout", { totalScouted: n });
          _lastN = n;
        } catch (e) {}
        return r;
      };
    });
  }
})();
