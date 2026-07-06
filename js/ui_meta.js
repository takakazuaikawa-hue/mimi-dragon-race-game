// =========================================================================
// ui_meta.js — ホームのメタ収集画面（目標クエスト／食事みみしんぼ）。
// =========================================================================
// ★ui_render.js から“ロジック無改変で抽出”した分割ファイル（CODEMAP §6 の段階分割・第1弾）。
//   renderGoals / renderMeals / showMealDetail と _mealTab を移しただけ＝中身は一切変えていない。
//   参照（state / el / beginScreen / GOALS・GOAL_PHASES・goalDone・nextGoal・goalsStats /
//   MEALS系 mealStatsAll・MEAL_TIERS・mealsByTier・mealUnlocked・mealTierStats・mealEaten・
//   mealSolved・eatMeal・solveMeal / Sfx）はすべてグローバル共有なので、別ファイルでも不変。
//   呼び出し元：ホームの🎯チップ・🍽️食事ナビ（renderHome）／nav.js の screenMap（いずれも call-time 解決）。
// 関連：js/goals.js（GOALS/達成判定）・js/meals.js（MEALS/eat・guess判定）・docs/CODEMAP.md §6
// =========================================================================

// 🎯 目標（クエスト）一覧＝ホーム左上チップのドリルダウン先。段（物語進行）ごとに達成/挑戦中/未達を表示。
// 完全に表示専用＝goals.js の done(state) を読むだけ。js/goals.js
function renderGoals() {
  state.ui.screen = "goals";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🎯 目標（クエスト）"));
  const gs = (typeof goalsStats === "function") ? goalsStats() : { done: 0, total: 0 };
  app.appendChild(el("div", "as-hint2", `ストーリーを進めながら、ひとつずつクリアしていこう。`));
  const bar = el("div", "goals-bar");
  bar.innerHTML = `<i style="width:${gs.total ? Math.round(gs.done / gs.total * 100) : 0}%"></i><b>${gs.done}/${gs.total} 達成</b>`;
  app.appendChild(bar);
  const ng = (typeof nextGoal === "function") ? nextGoal() : null;
  (typeof GOAL_PHASES !== "undefined" ? GOAL_PHASES : []).forEach(ph => {
    const items = GOALS.filter(g => g.phase === ph.id);
    if (!items.length) return;
    app.appendChild(el("div", "as-sec", ph.label));
    const list = el("div", "goals-list");
    items.forEach(g => {
      const done = (typeof goalDone === "function") ? goalDone(g) : false;
      const isNext = ng && g.id === ng.id;
      const row = el("div", "goal-row" + (done ? " done" : "") + (isNext ? " next" : ""));
      row.innerHTML =
        `<span class="goal-ic">${done ? "✅" : (isNext ? "🎯" : g.icon)}</span>` +
        `<span class="goal-tx"><b>${g.title}</b><small>${done ? "達成ずみ" : g.hint}</small></span>` +
        `<span class="goal-st">${done ? "✓ クリア" : (isNext ? "挑戦中" : "")}</span>`;
      list.appendChild(row);
    });
    app.appendChild(list);
  });
}

// 🍽️ 食事＝ミミの食べ歩きコレクション（みみしんぼ）。段ごとに食べる/当てるで集めていく。js/meals.js
// 完全に表示専用＝食べた/解いたを state.player.meals に記録するだけ。
// UX：4段を縦に積まず“上の段タブ”で切替＝選んだ段だけ表示してスクロールを抑える（compact＋drill-down）。
let _mealTab = null;
function renderMeals() {
  state.ui.screen = "meals";
  const app = beginScreen();
  app.appendChild(el("h2", null, `🍽️ 食事 ― みみの食べ歩き <img class="news-men news-men--h2" src="images/kurashi/men_gurume.webp" alt="グルメ面" onerror="this.remove()">`));
  const all = (typeof mealStatsAll === "function") ? mealStatsAll() : { got: 0, total: 0 };
  const ob = el("div", "goals-bar");
  ob.innerHTML = `<i style="width:${all.total ? Math.round(all.got / all.total * 100) : 0}%"></i><b>${all.got} / ${all.total} 品</b>`;
  app.appendChild(ob);

  const tiers = (typeof MEAL_TIERS !== "undefined") ? MEAL_TIERS : [];
  const _tUnlocked = id => (typeof mealTierUnlocked !== "function") || mealTierUnlocked(id);   // 上級グルメは終章で開放
  const _lockMsg = () => { if (typeof showInfoPopup === "function") showInfoPopup("🥢 上級グルメ",
    `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>「島のミミグルマン」「みみしんぼ」は<u>終章（総資産1億・第5話）</u>で開放されます。まずは食べ歩きから。</small></div></div>`); };
  if (!_mealTab || !tiers.some(t => t.id === _mealTab) || !_tUnlocked(_mealTab)) {
    const firstInc = tiers.find(t => _tUnlocked(t.id) && (function () { const s = mealTierStats(t.id); return s.got < s.total; })());
    _mealTab = (firstInc || tiers.find(t => _tUnlocked(t.id)) || tiers[0] || {}).id;
  }
  // 段タブ（アイコン＋進捗・完成は✓・未開放は🔒終章）
  const tabs = el("div", "meal-tabs");
  tiers.forEach(t => {
    const locked = !_tUnlocked(t.id);
    const st = mealTierStats(t.id);
    const done = !locked && st.total > 0 && st.got === st.total;
    const tab = el("button", "meal-tab" + (t.id === _mealTab ? " on" : "") + (done ? " done" : "") + (locked ? " locked" : ""));
    tab.innerHTML = locked
      ? `<span class="meal-tab-ic">🔒</span><span class="meal-tab-p">終章</span>`
      : `<span class="meal-tab-ic">${t.icon}</span><span class="meal-tab-p">${done ? "✓ " : ""}${st.got}/${st.total}</span>`;
    tab.onclick = locked ? _lockMsg : () => { _mealTab = t.id; renderMeals(); };
    tabs.appendChild(tab);
  });
  app.appendChild(tabs);

  // 選択中の段だけ：見出し＋グリッド（未開放なら開放案内）
  const t = tiers.find(x => x.id === _mealTab) || tiers[0];
  if (t && !_tUnlocked(t.id)) {
    app.appendChild(el("div", "as-hint2", "🔒 上級グルメ「" + t.name + "」は終章（総資産1億・第5話）で開放されます。"));
  } else if (t) {
    const sec = el("div", "meal-sec");
    sec.innerHTML = `<span class="meal-sec-ic">${t.icon}</span><span class="meal-sec-tx"><b>${t.no}. ${t.name}</b>` +
      `<small>${t.sub}　・　${t.mode === "guess" ? "🔍 食材・隠し味を当てる" : "🍴 食べて集める"}</small></span>`;
    app.appendChild(sec);
    const grid = el("div", "meal-grid");
    mealsByTier(t.id).forEach(m => {
      const un = mealUnlocked(m);
      const card = el("button", "meal-card" + (un ? " got" : ""));
      const thumb = (un && m.photo)
        ? `<span class="meal-card-thumb"><img src="${m.photo}" alt="" decoding="async"></span>`
        : `<span class="meal-card-ic">${un ? m.icon : "❔"}</span>`;
      card.innerHTML = `${thumb}<span class="meal-card-nm">${un ? m.name : "？？？"}</span>`;
      card.onclick = () => showMealDetail(m);
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }
}
// 一品の詳細＝実食（eat）or 食材/隠し味あて（guess）。解放後は何度でも読める。
function showMealDetail(m) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop meal-pop");
  // 閉じる時、食事画面なら再描画＝食べた/解いたカードが即「取得済み」に反映される。
  const _closeMeal = () => { ov.remove(); if (state.ui.screen === "meals" && typeof renderMeals === "function") renderMeals(); };
  const head = () => (m.photo
    ? `<img class="meal-pop-photo" src="${m.photo}" alt="" decoding="async"><div class="meal-pop-ic meal-pop-ic--over">${m.icon}</div><div class="navpop-t">${m.name}</div>`
    : `<div class="meal-pop-ic">${m.icon}</div><div class="navpop-t">${m.name}</div>`);
  const render = () => {
    if (!m.quiz) {
      // ── 食べる ──
      if (mealEaten(m.id)) {
        box.innerHTML = head() + `<div class="meal-react">${m.react}</div><div class="meal-note">📖 ${m.note}</div>`;
        const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "ごちそうさま"); ok.onclick = () => _closeMeal(); btns.appendChild(ok); box.appendChild(btns);
      } else {
        box.innerHTML = head() + `<div class="meal-prompt">ひとくち、いってみる？</div>`;
        const btns = el("div", "navpop-btns");
        const eat = el("button", "navpop-go", "🍴 いただきます！");
        eat.onclick = () => { eatMeal(m.id); if (window.Sfx) Sfx.play("coin"); render(); };
        const later = el("button", "navpop-cancel", "また今度"); later.onclick = () => _closeMeal();
        btns.appendChild(eat); btns.appendChild(later); box.appendChild(btns);
      }
    } else {
      // ── 当てる（食材／隠し味） ──
      if (mealSolved(m.id)) {
        box.innerHTML = head() + `<div class="meal-desc">${m.desc}</div><div class="meal-react meal-hit">${m.quiz.hit}</div><div class="meal-note">📖 ${m.note}</div>`;
        const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "ごちそうさま"); ok.onclick = () => _closeMeal(); btns.appendChild(ok); box.appendChild(btns);
      } else {
        box.innerHTML = head() + `<div class="meal-desc">${m.desc}</div><div class="meal-q">${m.quiz.q}</div>`;
        const ch = el("div", "meal-choices");
        m.quiz.choices.forEach((c, i) => {
          const cb = el("button", "meal-choice", c);
          cb.onclick = () => {
            if (i === m.quiz.answer) { solveMeal(m.id); if (window.Sfx) Sfx.play("bigwin"); render(); }
            else {
              cb.classList.add("wrong"); cb.disabled = true;
              let fb = box.querySelector(".meal-miss");
              if (!fb) { fb = el("div", "meal-miss", m.quiz.miss); box.appendChild(fb); }
              if (window.Sfx) Sfx.play("miss");
            }
          };
          ch.appendChild(cb);
        });
        box.appendChild(ch);
        const later = el("button", "meal-x", "✕ また今度"); later.onclick = () => _closeMeal(); box.appendChild(later);
      }
    }
  };
  render();
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) _closeMeal(); };
  document.body.appendChild(ov);
}
