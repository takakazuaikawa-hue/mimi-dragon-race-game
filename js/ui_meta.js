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
      // ★まだ出会っていないキャラの固有名・章題は伏せる（goals.js の門番／未定義なら伏字側に倒す＝fail-closed）。
      const title = (typeof goalTitleSafe === "function") ? goalTitleSafe(g) : (g.maskTitle || g.title);
      const hint  = (typeof goalHintSafe === "function") ? goalHintSafe(g) : (g.maskHint || g.hint);
      // アイコンも門番を通す（☄️＝セレスティアの記号なので未登場のあいだは無害な記号へ）。
      const icon  = (typeof goalIconSafe === "function") ? goalIconSafe(g) : (g.maskIcon || g.icon);
      const row = el("div", "goal-row" + (done ? " done" : "") + (isNext ? " next" : ""));
      row.innerHTML =
        `<span class="goal-ic">${done ? "✅" : (isNext ? "🎯" : icon)}</span>` +
        `<span class="goal-tx"><b>${title}</b><small>${done ? "達成ずみ" : hint}</small></span>` +
        `<span class="goal-st">${done ? "✓ クリア" : (isNext ? "挑戦中" : "")}</span>`;
      // ★未達の目標には「その場所へ行く」ボタンを付ける（ユーザー指摘：モールの入口が分かりにくい／
      //   モールは島タブの奥にしか無く、序盤の関門なのに辿り着けなかった）。目標＝行き先、にする。
      if (!done && g.go && (!g.goIf || g.goIf())) {
        const jump = el("button", "goal-go", g.goLabel || "▶ 行く");
        jump.onclick = (e) => { e.stopPropagation(); try { g.go(); } catch (err) {} };
        row.appendChild(jump);
      }
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
  const _tUnlocked = id => (typeof mealTierUnlocked !== "function") || mealTierUnlocked(id);   // グルマン=総資産100万／しんぼ=終章（meals.js）
  const _mealLockHint = id => id === "shinbo" ? "終章（第5話）" : "総資産100万";   // ★段位ごとの解禁条件（新ゲートと一致させる）
  const _lockMsg = (id) => { if (typeof showInfoPopup === "function") showInfoPopup("🥢 上級グルメ",
    `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>この段位は<u>${_mealLockHint(id)}</u>で開放されます。まずは食べ歩きから。</small></div></div>`); };
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
      ? `<span class="meal-tab-ic">🔒</span><span class="meal-tab-p">${t.id === "shinbo" ? "終章" : "100万"}</span>`
      : `<span class="meal-tab-ic">${t.icon}</span><span class="meal-tab-p">${done ? "✓ " : ""}${st.got}/${st.total}</span>`;
    tab.onclick = locked ? (() => _lockMsg(t.id)) : () => { _mealTab = t.id; renderMeals(); };
    tabs.appendChild(tab);
  });
  app.appendChild(tabs);

  // 選択中の段だけ：見出し＋グリッド（未開放なら開放案内）
  const t = tiers.find(x => x.id === _mealTab) || tiers[0];
  if (t && !_tUnlocked(t.id)) {
    app.appendChild(el("div", "as-hint2", "🔒 上級グルメ「" + t.name + "」は" + _mealLockHint(t.id) + "で開放されます。"));
  } else if (t) {
    const sec = el("div", "meal-sec");
    // 価格は品ごとに異なる（各カードに表示）ので、見出しはモードのみ。当てる段位は無料。
    const _secTag = t.mode === "guess" ? "🔍 食材・隠し味を当てる" : "🍴 食べて集める";
    sec.innerHTML = `<span class="meal-sec-ic">${t.icon}</span><span class="meal-sec-tx"><b>${t.no}. ${t.name}</b>` +
      `<small>${t.sub}　・　${_secTag}</small></span>`;
    app.appendChild(sec);
    const grid = el("div", "meal-grid");
    mealsByTier(t.id).forEach(m => {
      const un = mealUnlocked(m);
      const card = el("button", "meal-card" + (un ? " got" : ""));
      const thumb = (un && m.photo)
        ? `<span class="meal-card-thumb"><img src="${m.photo}" alt="" decoding="async"></span>`
        : `<span class="meal-card-ic">${un ? m.icon : "❔"}</span>`;
      const _cardPrice = (!m.quiz && typeof mealPrice === "function")
        ? `<span class="meal-card-price">🪙${mealPrice(m).toLocaleString("ja-JP")}</span>` : "";
      card.innerHTML = `${thumb}<span class="meal-card-nm">${un ? m.name : "？？？"}${_cardPrice}</span>`;
      card.onclick = () => showMealDetail(m);
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }
  // ★M2/M3 結線の穴埋め：食事のあとの「次の一手」（今日の一枚／次のレース）＝島の一日ループ。
  //   台帳(next_suggest.js の at:"meals")は定義済みだったが renderMeals から呼ばれておらず死んでいた。
  if (typeof nextSuggestRow === "function") { const _nx = nextSuggestRow("meals"); if (_nx) app.appendChild(_nx); }
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
  // 観光の写真ビューアーと同じ「タップで拡大／縮小」。box.innerHTML更新のたびに呼び直す（要素が作り直されるため）。
  const _wirePhotoZoom = () => {
    const ph = box.querySelector(".meal-pop-photo");
    if (ph) ph.onclick = () => ph.classList.toggle("meal-pop-photo--zoom");
  };
  const render = () => {
    if (!m.quiz) {
      // ── 食べる（何度でも＝腹ごしらえ）。初回は発見、既食は再注文で回復。満腹時はムダ食い防止。 ──
      const eaten = mealEaten(m.id);
      const _price = (typeof mealPrice === "function") ? mealPrice(m) : 0;
      const _heal  = (typeof mealHeal === "function") ? mealHeal(m) : 0;
      const _coins = (state.player && state.player.coins) || 0;
      const _free  = (typeof hungerFreeMealOk === "function") && hungerFreeMealOk();
      const _hunger = (typeof hungerGet === "function") ? hungerGet() : 100;
      const _full  = eaten && _hunger >= 100;                       // 既食＆満腹＝再注文不可
      const _short = !_free && !_full && _coins < _price;
      const _priceTxt = _free ? "🍜 今日はおごり（無料）" : "🍽 " + _price.toLocaleString("ja-JP") + "コイン";
      const _bal = "🪙" + _coins.toLocaleString("ja-JP");
      const _balTxt = _full ? "🈵 おなかいっぱい（おなか " + _hunger + "／100）"
        : _free ? "所持 " + _bal
        : _short ? "所持 " + _bal + "（足りない）"
        : "所持 " + _bal + " → 残り 🪙" + (_coins - _price).toLocaleString("ja-JP");
      let _html = head();
      _html += eaten
        ? `<div class="meal-react">${m.react}</div><div class="meal-note">📖 ${m.note}</div>`
        : `<div class="meal-prompt">ひとくち、いってみる？</div>`;
      _html += `<div class="meal-buy${(_short || _full) ? " short" : ""}"><div class="meal-buy-row"><span class="meal-buy-cost">${_priceTxt}</span><span class="meal-buy-heal">🍚 おなか +${_heal}</span></div>` +
        `<small>${_balTxt}</small></div>`;
      box.innerHTML = _html;
      _wirePhotoZoom();
      const btns = el("div", "navpop-btns");
      const eat = el("button", "navpop-go" + (_full ? " is-off" : ""), eaten ? "🍴 もう一度食べる" : "🍴 いただきます！");
      if (_full) eat.disabled = true;
      else eat.onclick = () => { eatMeal(m.id); if (window.Sfx) Sfx.play("coin"); render(); };
      const later = el("button", "navpop-cancel", eaten ? "閉じる" : "また今度"); later.onclick = () => _closeMeal();
      btns.appendChild(eat); btns.appendChild(later); box.appendChild(btns);
    } else {
      // ── 当てる（食材／隠し味） ──
      if (mealSolved(m.id)) {
        box.innerHTML = head() + `<div class="meal-desc">${m.desc}</div><div class="meal-react meal-hit">${m.quiz.hit}</div><div class="meal-note">📖 ${m.note}</div>`;
        _wirePhotoZoom();
        const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "ごちそうさま"); ok.onclick = () => _closeMeal(); btns.appendChild(ok); box.appendChild(btns);
      } else {
        box.innerHTML = head() + `<div class="meal-desc">${m.desc}</div><div class="meal-q">${m.quiz.q}</div>`;
        _wirePhotoZoom();
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
