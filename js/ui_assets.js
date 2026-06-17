// =============================================================================
// ui_assets.js — 暮らしと資産の画面群（CODEMAP §6・分割第2弾）。
// =============================================================================
// ★ui_render.js から無改変で抽出：renderAssets / renderActiveSkills /
//   showSkillTitleCutin / renderLifeTree / renderLifeCollection ＋ _lifeTab / _ltJustUnlocked。
//   参照（state / el / recomputeAssets / LIFE_* / lifetree_engine 関数 / showLifeCutin(ui_render) 等）は
//   すべてグローバル共有なので別ファイルでも不変。呼び出しは renderHome のナビ・nav.js から call-time。
// =============================================================================

let _lifeTab = null;   // 選択中の枝（null は自動選択）

// 暮らし＝コンパクトなダッシュボード。状態は小さくグラフィカルに、情報量の多いもの
//（スキルツリー＝約200ノード／コレクション＝約200点）は専用画面へ遷移させてスクロールを抑える。
// 🎯 目標（クエスト）／🍽️ 食事（みみしんぼ）の画面は js/ui_meta.js へ抽出済み（CODEMAP §6・分割第1弾）。
//   renderGoals / renderMeals / showMealDetail / _mealTab はそちら。ロジックは無改変で移動しただけ。

function renderAssets() {
  state.ui.screen = "assets";
  recomputeAssets(state);
  const p = state.player, a = state.assets;
  const total = p.totalAssets;
  const level = Math.max(0, Math.min(a.unlockedLifeStages || 0, 5));
  const st = lifeTreeStats();
  const app = beginScreen();
  const _h2 = el("h2", null, `暮らしと資産 <button class="info-q" title="お金のしくみ">？</button>`);
  _h2.querySelector(".info-q").onclick = () => showMoneyMap();
  app.appendChild(_h2);

  // 状態（コンパクト）：総資産 ＋ 暮らしP
  const hero = el("div", "card lt-hero");
  hero.innerHTML =
    `<div class="lt-hero-top">` +
      `<div class="lt-hero-id"><div class="as-hero-lbl">総資産（ミミの再起度）</div><div class="as-hero-total">${fmtCoins(total)}</div></div>` +
      `<div class="lt-pcard"><div class="lt-pnum">${st.available}</div><div class="lt-plbl">暮らしP</div></div>` +
    `</div>`;
  app.appendChild(hero);

  const _avA = advisorVoiceEl("assets"); if (_avA) app.appendChild(_avA);

  // 内訳（小さなセグメントバー＝グラフィカル）
  const parts = [
    ["最大到達", p.maxCoinsReached, "#e6b24a"], ["村", a.villageValue, "#49c89c"], ["施設", a.facilityValue, "#57b1dd"],
    ["生活", a.livingValue, "#caa44a"], ["名声", a.fameValue, "#d6452f"], ["ドラゴン", a.dragonValue, "#9a6ad0"]
  ].filter(x => x[1] > 0);
  const sum = parts.reduce((s, x) => s + x[1], 0) || 1;
  app.appendChild(el("div", "card as-break",
    `<div class="as-break-bar">${parts.map(x => `<div style="width:${x[1] / sum * 100}%;background:${x[2]}"></div>`).join("")}</div>` +
    `<div class="as-break-legend">${parts.map(x => `<span><i style="background:${x[2]}"></i>${x[0]} ${fmtCoins(x[1])}</span>`).join("")}</div>` +
    `<div class="as-break-rescue">💛 破産しても安心 — 救済見込み <b>${fmtCoins(calculateRescueCoins(state, p.rank))}</b></div>`));

  // 情報量が多いものは専用画面へ遷移（小さなグラフィカルな入口）
  let ready = false;
  LIFE_BRANCHES.forEach(b => { const pr = lifeBranchProgress(b.id); if (pr.next && lifeNodeState(pr.next) === "ready") ready = true; });
  const colOwned = LIFE_ASSETS.filter(it => isLifeAssetUnlocked(state, it, level)).length;
  const unlockedCh = STORY_CHAPTERS.filter(ch => total >= storyUnlockAt(ch.id)).length;
  const skTitles = ACTIVE_SKILLS.filter(s => ((p.activeSkills || {})[s.id] || 0) >= s.levels.length).length;
  const entry = (ic, label, sub, badge, onClick) => {
    const b = el("button", "as-entry",
      `<span class="as-entry-ic">${ic}</span><span class="as-entry-tx"><span class="as-entry-l">${label}${badge ? ` <span class="as-entry-badge">${badge}</span>` : ""}</span>` +
        `<span class="as-entry-s">${sub}</span></span><span class="as-entry-ch">›</span>`);
    b.onclick = onClick; return b;
  };
  const ent = el("div", "as-entries");
  // 🏦 島の経済：島の景気・名声・フォロワー・レース経済を一望（終章中は絶滅メーター本体もここに）。js/ui_economy.js
  if (typeof renderEconomy === "function") {
    const epOn = (typeof epilogueOn === "function") && epilogueOn();
    ent.appendChild(entry("🏦", "島の経済", epOn ? "総資産・名声・村の景気… ＋ ☄️絶滅メーターの綱引き" : "総資産・名声・フォロワー・村の景気＝島の経済状態", epOn ? "☄️終章" : "", () => renderEconomy()));
  }
  ent.appendChild(entry("🌳", "くらしスキルツリー", `暮らしP ◇${st.available} 残り ・ 解放 ${st.unlockedCount}/${st.totalNodes}`, ready ? "振れる!" : "", () => renderLifeTree()));
  ent.appendChild(entry("🎁", "生活資産コレクション", `${colOwned} / ${LIFE_ASSETS.length} 解放`, "", () => renderLifeCollection()));
  ent.appendChild(entry("🎫", "習い事（アクティブスキル）", `称号 ${skTitles} / ${ACTIVE_SKILLS.length} 獲得 ・ ミミの暮らしの記録`, skTitles >= ACTIVE_SKILLS.length ? "コンプ!" : "", () => renderActiveSkills()));
  ent.appendChild(entry("📖", "物語", `${unlockedCh} / ${STORY_CHAPTERS.length} 話 解放`, "", () => renderStory()));
  // 相談（顧問）はホームのナビから移設＝暮らしハブに配置（予想の視点をもらう・任意）。
  if (typeof renderConsult === "function") ent.appendChild(entry("💬", "相談（顧問）", "サケ・ミズ・スミカから、予想の視点をもらいます。", "", () => renderConsult()));
  app.appendChild(ent);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// 専用画面：習い事（アクティブスキル）。通うとレベルが上がり、効果テキストと称号がつくだけの
// 完全な表示専用メタ進行。コイン・総資産・暮らしP・着順・オッズ・配当には一切触れない。
function renderActiveSkills() {
  state.ui.screen = "active_skills";
  if (!state.player.activeSkills) state.player.activeSkills = {};
  const as = state.player.activeSkills;
  const app = beginScreen();
  app.appendChild(el("h2", null, "習い事（アクティブスキル）"));

  const titles = ACTIVE_SKILLS.filter(s => (as[s.id] || 0) >= s.levels.length).length;
  app.appendChild(el("div", "as-hint2",
    `称号 <b>${titles} / ${ACTIVE_SKILLS.length}</b> 獲得　` +
    `<span class="as-hint">通うほど上達。レース結果には影響しない、ミミの“暮らしの記録”です。</span>`));

  // ホームに飾っている称号（ロードアウト式・表示専用）
  const eq = state.player.equippedTitle || null;
  if (eq) {
    const ek = ACTIVE_SKILLS.find(s => s.id === eq);
    if (ek && (as[ek.id] || 0) >= ek.levels.length) {
      app.appendChild(el("div", "askill-eqbanner", `🏅 ホームに飾り中：称号「${ek.title}」`));
    }
  }

  const grid = el("div", "askill-grid");
  ACTIVE_SKILLS.forEach(s => {
    const max = s.levels.length;
    const lv = Math.min(as[s.id] || 0, max);
    const maxed = lv >= max;
    const isEq = eq === s.id;
    const dots = Array.from({ length: max }, (_, i) => `<span class="askill-dot${i < lv ? " on" : ""}"></span>`).join("");
    const card = el("div", "askill" + (maxed ? " maxed" : "") + (isEq ? " equipped" : ""));
    card.innerHTML =
      `<div class="askill-top">` +
        `<span class="askill-ic">${s.icon}</span>` +
        `<span class="askill-id"><span class="askill-nm">${s.name}</span><span class="askill-tag">${s.tag}</span></span>` +
        `<span class="askill-lv">${maxed ? "極" : "Lv" + lv}</span>` +
      `</div>` +
      `<div class="askill-dots">${dots}</div>` +
      `<div class="askill-effect">${maxed
        ? `🏅 称号「${s.title}」を獲得！`
        : (lv > 0 ? s.levels[lv - 1] : "まだ通っていない。")}</div>` +
      (!maxed ? `<div class="askill-next"><span>次</span>${s.levels[lv]}</div>` : "");
    if (!maxed) {
      const go = el("button", "askill-go", lv > 0 ? "また通う ▶" : "通ってみる ▶");
      go.onclick = () => {
        const nv = Math.min((as[s.id] || 0) + 1, max);
        as[s.id] = nv;
        if (typeof saveGame === "function") saveGame();
        if (nv >= max) showSkillTitleCutin(s);
        renderActiveSkills();
      };
      card.appendChild(go);
    } else {
      const eqBtn = el("button", "askill-equip" + (isEq ? " on" : ""), isEq ? "✓ ホームに飾り中" : "🏅 称号を飾る");
      eqBtn.onclick = () => {
        state.player.equippedTitle = isEq ? null : s.id;
        if (typeof saveGame === "function") saveGame();
        renderActiveSkills();
      };
      card.appendChild(eqBtn);
    }
    grid.appendChild(card);
  });
  app.appendChild(grid);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}

// 称号獲得カットイン（表示専用・約1.1秒／タップで即スキップ）。showLifeCutin と同じ見た目を流用。
function showSkillTitleCutin(skill) {
  try {
    const ex = document.getElementById("lt-cutin"); if (ex) ex.remove();
    if (_ltCutinTimer) { clearTimeout(_ltCutinTimer); _ltCutinTimer = null; }
    const ov = el("div", "lt-cutin"); ov.id = "lt-cutin";
    ov.style.setProperty("--bc", "#e6b24a");
    ov.innerHTML =
      `<div class="lt-cutin-flash"></div><div class="lt-cutin-lines"></div>` +
      `<div class="lt-cutin-band"><div class="lt-cutin-inner">` +
        `<div class="lt-cutin-ic">${skill.icon}</div>` +
        `<div class="lt-cutin-tx">` +
          `<div class="lt-cutin-kicker">${skill.name}・極めた！</div>` +
          `<div class="lt-cutin-title">称号「${skill.title}」</div>` +
          `<div class="lt-cutin-sub">ミミ、また一歩……！</div>` +
        `</div>` +
      `</div></div>`;
    ov.onclick = () => { if (_ltCutinTimer) { clearTimeout(_ltCutinTimer); _ltCutinTimer = null; } ov.remove(); };
    document.body.appendChild(ov);
    try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
    _ltCutinTimer = setTimeout(() => {
      const o = document.getElementById("lt-cutin");
      if (o) { o.classList.add("out"); setTimeout(() => { if (o) o.remove(); }, 260); }
      _ltCutinTimer = null;
    }, 1150);
  } catch (e) {}
}

// 専用画面：くらしスキルツリー（枝タブ＋星座チェーン＋振り直し）
// 直近に解放したノード（点灯ポップ演出を一度だけ再生するためのフラグ）
let _ltJustUnlocked = null;
function renderLifeTree() {
  state.ui.screen = "life_tree";
  recomputeAssets(state);
  const st = lifeTreeStats();
  const app = beginScreen();   // 上部に「← 暮らし」が付く
  app.appendChild(el("h2", null, "くらしスキルツリー"));
  app.appendChild(el("div", "as-hint2", `暮らしP ◇<b>${st.available}</b> 残り ／ 解放 ${st.unlockedCount}/${st.totalNodes}　<span class="as-hint">レースで総資産が増える＝暮らしPが貯まる</span>`));

  if (!_lifeTab || !LIFE_TREE[_lifeTab]) {
    _lifeTab = LIFE_BRANCHES[0].id;
    for (let i = 0; i < LIFE_BRANCHES.length; i++) {
      const pr = lifeBranchProgress(LIFE_BRANCHES[i].id);
      if (pr.next && lifeNodeState(pr.next) === "ready") { _lifeTab = LIFE_BRANCHES[i].id; break; }
    }
  }
  const tabs = el("div", "lt-tabs");
  LIFE_BRANCHES.forEach(b => {
    const pr = lifeBranchProgress(b.id);
    const tab = el("button", "lt-tab" + (b.id === _lifeTab ? " on" : ""),
      `<span class="lt-tab-ic">${b.icon}</span><span class="lt-tab-nm">${b.name}</span><span class="lt-tab-pg">${pr.done}/${pr.total}</span>`);
    tab.style.setProperty("--bc", b.color);
    if (pr.next && lifeNodeState(pr.next) === "ready") tab.classList.add("ready");
    tab.onclick = () => { _lifeTab = b.id; renderLifeTree(); };
    tabs.appendChild(tab);
  });
  app.appendChild(tabs);

  const branch = LIFE_BRANCHES.find(b => b.id === _lifeTab);
  const chain = el("div", "lt-chain");
  chain.style.setProperty("--bc", branch.color);
  // フロンティア（次に狙える最初の未解放ノード）からの距離で段階開示する
  const _frPr = lifeBranchProgress(_lifeTab);
  const frontierPos = _frPr.next ? _frPr.next.pos : LIFE_TREE[_lifeTab].length;
  LIFE_TREE[_lifeTab].forEach(node => {
    const stt = lifeNodeState(node);
    const dot = stt === "prereq" ? "🔒" : node.icon;
    // 星座＋段階開示クラス：解放済=点灯／フロンティア=次の星／その先は距離で減衰
    let cz = "";
    if (stt === "unlocked") cz = " is-lit";
    else if (node.pos === frontierPos) cz = " is-next";
    else if (node.pos > frontierPos) { const d = node.pos - frontierPos; cz = d >= 3 ? " is-far3" : (d === 2 ? " is-far2" : " is-far1"); }
    if (node.nodeId === _ltJustUnlocked) cz += " just";
    let desc;
    if (stt === "prereq") {
      const miss = lifeNodeMissingPrereqs(node);
      const names = miss.slice(0, 2).map(pr => {
        const bb = LIFE_BRANCHES.find(b => b.id === pr.branch);
        return `${bb ? bb.icon : ""}${pr.title}`;
      }).join("／");
      desc = `<span class="lt-locked">🔒 ${names}${miss.length > 2 ? ` ほか${miss.length - 2}件` : ""} が必要</span>`;
    } else {
      desc = node.desc;
    }
    let right;
    if (stt === "unlocked")      right = `<span class="lt-node-cost done">✓</span>`;
    else if (stt === "ready")    right = `<button class="lt-buy">振り分け<b>◇${node.cost}</b></button>`;
    else if (stt === "nopoints") right = `<span class="lt-node-cost short">◇${node.cost}<small>P不足</small></span>`;
    else                         right = `<span class="lt-node-cost lock">◇${node.cost}</span>`;
    const row = el("div", "lt-node " + stt + cz,
      `<div class="lt-node-rail"><div class="lt-node-dot">${dot}</div></div>` +
      `<div class="lt-node-body"><div class="lt-node-title">${node.title}</div>` +
        `<div class="lt-node-desc">${desc}</div></div>` +
      `<div class="lt-node-right">${right}</div>`);
    if (stt === "ready") {
      const btn = row.querySelector(".lt-buy");
      if (btn) btn.onclick = () => { const r = unlockLifeNode(node); if (r.ok) { _ltJustUnlocked = node.nodeId; renderLifeTree(); showLifeCutin(node); } };
    }
    chain.appendChild(row);
  });
  _ltJustUnlocked = null;   // 演出は一度だけ
  app.appendChild(chain);

  const respec = el("button", "lt-respec", "↺ いつでも無料で振り直す");
  respec.onclick = () => {
    if (confirm("解放をすべて解除して、暮らしPを振り直しますか？\n（総資産・コインはそのまま。ノードはいつでも取り直せます）")) {
      respecLifeTree(); renderLifeTree();
    }
  };
  app.appendChild(respec);
  app.appendChild(el("div", "lt-respec-note", "💡 振り直しは無料。総資産もコインも減りません — 気軽に色々な暮らしを試せます。"));

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}

// 専用画面：生活資産コレクション（所持＝金／未解放＝灰）
function renderLifeCollection() {
  state.ui.screen = "life_collection";
  recomputeAssets(state);
  const a = state.assets;
  const level = Math.max(0, Math.min(a.unlockedLifeStages || 0, 5));
  const app = beginScreen();   // 上部に「← 暮らし」
  app.appendChild(el("h2", null, "生活資産コレクション"));
  const owned = LIFE_ASSETS.filter(it => isLifeAssetUnlocked(state, it, level)).length;
  app.appendChild(el("div", "as-hint2", `所持 <b>${owned} / ${LIFE_ASSETS.length}</b>　<span class="as-hint">🛒＝コインで購入可／Lv＝資産段階で自動解放</span>`));
  const itemsWrap = el("div", "as-items");
  const CAT_IC = { housing: "🏠", food: "🍽️", outfit: "👗", tool: "🎤", decor: "🖼️", supporter: "🤝" };
  LIFE_ASSETS.forEach(item => {
    const own = isLifeAssetUnlocked(state, item, level);
    const right = item.unlockType === "auto" ? (own ? "✓" : `Lv${item.unlockAssetLevel}`) : (own ? "✓" : "🛒");
    const cell = el("div", "as-item " + (own ? "owned" : "lock"),
      `<span class="as-item-ic">${CAT_IC[item.category] || "📦"}</span><span class="as-item-nm">${item.name}</span><span class="as-item-tag">${right}</span>`);
    if (item.unlockType !== "auto" && !own) {
      cell.classList.add("buyable");
      cell.title = `購入 ${fmtCoins(item.price)}`;
      cell.onclick = () => { const res = buyLifeItem(item.id); if (res.ok) renderLifeCollection(); else if (res.reason === "poor") alert("コインが足りません。"); };
    }
    itemsWrap.appendChild(cell);
  });
  app.appendChild(itemsWrap);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}
