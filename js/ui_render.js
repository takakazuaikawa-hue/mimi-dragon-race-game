// UI rendering for each screen.

function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function updateHeader() {
  $("coin-display").textContent = fmtCoins(state.player.coins);
  $("rank-display").textContent = state.player.rank;
}

function renderHome() {
  state.ui.screen = "home";
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "ホーム"));
  const intro = el("div", "card", `
    <p>ようこそ、<b>聖龍爆走録ミミ</b>へ。</p>
    <p>あなたは予想家として、市場のオッズと真の実力のズレを読み、賭けで利益を出します。</p>
    <p>所持コイン: <b>${fmtCoins(state.player.coins)}</b> ／ 出走数: ${state.player.completedRaces} ／ 単竜的中: ${state.player.wins}</p>
  `);
  app.appendChild(intro);
  const actions = el("div", "actions");
  const goRace = el("button", null, "レースを選ぶ"); goRace.onclick = () => renderRaceSelect();
  actions.appendChild(goRace);
  const goVillage = el("button", "secondary", "竜の村を訪れる"); goVillage.onclick = () => renderVillage();
  actions.appendChild(goVillage);
  const goCollection = el("button", "secondary", "竜図鑑"); goCollection.onclick = () => renderCollection();
  actions.appendChild(goCollection);
  const goHelp = el("button", "secondary", "予想入門"); goHelp.onclick = () => renderHelp();
  actions.appendChild(goHelp);
  const shareGame = el("button", "secondary", "ゲームをシェア"); shareGame.onclick = shareGameInfo;
  actions.appendChild(shareGame);
  const reset = el("button", "secondary", "リセット"); reset.onclick = () => {
    if (confirm("プレイヤー状態をリセットしますか？")) { resetGame(); updateHeader(); renderHome(); }
  };
  actions.appendChild(reset);
  app.appendChild(actions);
}

// §09 §24 V1 Village screen
function renderVillage() {
  state.ui.screen = "village";
  runEventHooks("onVillageUpdate", { villageLevel: state.player.villageLevel });
  const app = $("app"); app.innerHTML = "";
  const v = state.player.village || { level: 1, name: "泣き虫ドラゴン村" };
  app.appendChild(el("h2", null, `${v.name} (Lv ${v.level})`));

  const card = el("div", "card");
  const rescue = RESCUE_COINS[v.level] || 300;
  const villMult = VILLAGE_MULT[v.level] || 1.0;
  card.innerHTML = `
    <div><b>村レベル:</b> ${v.level}</div>
    <div><b>救済コイン:</b> ${fmtCoins(rescue)} (破産時に支給)</div>
    <div><b>賭金倍率:</b> ×${villMult}</div>
    <div><b>解放された竜:</b> ${v.unlockedDragonIds.length} / ${DRAGONS.length}</div>
    <div class="condition-line">※ 村機能は将来のフェーズで拡張されます (§09 §25)。</div>
  `;
  app.appendChild(card);

  // Facilities placeholder (§09 §17)
  app.appendChild(el("h3", null, "村の施設"));
  const facList = el("div", "card");
  const facLabel = { paddock:"竜見せ広場", newspaper:"予想新聞社", grandstand:"応援席",
                     riderPost:"ライダー詰所", dragonStable:"竜舎", exchange:"交換所" };
  for (const k in facLabel) {
    facList.appendChild(el("div", null, `${facLabel[k]}: Lv ${v.facilities[k] || 0} (未解放)`));
  }
  app.appendChild(facList);

  const actions = el("div", "actions");
  const home = el("button", null, "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}

// §07 §20 Help / Tutorial screen — §10 explains all V1 prediction concepts.
function renderHelp() {
  state.ui.screen = "help";
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "予想入門"));

  const section = (title, body) => {
    const c = el("div", "analysis-section");
    c.appendChild(el("span", "label", title));
    body.forEach(line => c.appendChild(el("div", null, line)));
    return c;
  };

  app.appendChild(section("このゲームの心臓", [
    "<b>市場のオッズと真の実力のズレを読み、賭けで利益を出す</b>予想カジノです。",
    "1番人気が強いとは限りません。コース・脚質・スタミナ・ペースを読むほど、勝率は上がります。"
  ]));

  app.appendChild(section("賭式は3種類", [
    "<b>単竜</b>：1頭を選び、1着のみ的中。最も高いリターン、最も難しい。",
    "<b>複竜</b>：1頭を選び、3着以内で的中。安全寄り、堅実なリターン。",
    "<b>ワイド竜</b>：2頭を選び、両方が3着以内で的中。本命＋穴の組合せで妙味の塊。"
  ]));

  app.appendChild(section("オッズの読み方", [
    "オッズは「市場の人気投票」から計算され、真の勝率とは <b>ズレます</b>。",
    "前走勝利・新聞印・派手な見た目・ファン人気で人気が集まり、オッズは下がります。",
    "そのズレ＝<b>妙味</b>。市場が見落としている適性を見つけるのが予想家の仕事です。"
  ]));

  app.appendChild(section("コース3区間", [
    "レースは<b>序盤・中盤・終盤</b>の3セクション。各々で必要な能力が違います。",
    "例：終盤=長い直線 → 速度+翼+スタミナ重視。終盤=最終大旋回 → 回転+気性重視。",
    "出走表で各セクションを確認し、適性を持つ竜を探しましょう。"
  ]));

  app.appendChild(section("脚質とペース", [
    "<b>逃げ</b>＝早く前へ。<b>先行</b>＝前位安定。<b>差し</b>＝中盤伸び。<b>追込</b>＝最終後方一気。",
    "逃げ・先行が多い＝ペースが上がり、スタミナ薄い前残り型は終盤で <b>崩壊</b> します。",
    "逆にスローペースなら差し・追込が届かず、逃げ・先行が残ります。"
  ]));

  app.appendChild(section("スタミナ", [
    "各竜は「スタミナプール」を持ち、レース中にセクションごとに消費。",
    "ハイペース・苦手な区間・距離の長さで消費が増えます。",
    "終盤に残り20%以下＝崩壊判定、ペナルティで大きく失速します。"
  ]));

  app.appendChild(section("妙味の探し方", [
    "1. 1番人気の<b>弱点</b>を探す（今日のコースに合わないステータス）",
    "2. 中位人気で<b>適性が刺さっている</b>竜を探す（オッズ10倍以上で勝率10%なら+EV）",
    "3. <b>ワイド竜</b>で本命＋妙味馬を組む（1着を当てなくても勝てる）",
    "4. 詳細モード以上では「妙味の手がかり」セクションがヒントを出します"
  ]));

  app.appendChild(section("情報量レベル", [
    "ヘッダの「情報量」セレクタで表示量を調整できます。",
    "<b>簡易</b>=入門。<b>標準</b>=デフォルト。<b>詳細</b>=妙味手がかり＋分析項目追加。<b>エキスパート</b>=コンポーネント内訳まで。"
  ]));

  app.appendChild(section("救済システム", [
    "コインが0になっても安心。サケ・ウダダが村の予備コイン300枚を渡してくれます（村Lv1）。",
    "借金ではありません。小さく賭けて立て直しましょう。"
  ]));

  const actions = el("div", "actions");
  const home = el("button", null, "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}

// §09 §8,§9,§10 Collection screen
function renderCollection() {
  state.ui.screen = "collection";
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "竜図鑑"));
  const seenCount = Object.values(state.player.collection || {}).filter(e => e.seen).length;
  app.appendChild(el("div", "card", `見た竜: <b>${seenCount}</b> / ${DRAGONS.length} 種`));

  const tbl = el("table", "entry-table");
  tbl.innerHTML = `<thead><tr>
    <th>竜名</th><th>脚質</th><th>状態</th>
    <th>見た数</th><th>勝</th><th>複圏</th>
    <th>賭けた数</th><th>的中</th><th>★</th>
  </tr></thead>`;
  const tbody = el("tbody");
  DRAGONS.forEach(d => {
    const entry = (state.player.collection || {})[d.id];
    const seen = entry && entry.seen;
    const r = entry ? entry.records : { racesSeen:0, winsSeen:0, top3Seen:0, playerBetCount:0, playerHitCount:0 };
    const tr = el("tr");
    tr.innerHTML = `
      <td><b>${seen ? d.name : "？？？"}</b></td>
      <td class="style-${d.style}">${seen ? STYLE_LABEL[d.style] : "－"}</td>
      <td>${seen ? "解放" : "未確認"}</td>
      <td class="num">${r.racesSeen}</td>
      <td class="num">${r.winsSeen}</td>
      <td class="num">${r.top3Seen}</td>
      <td class="num">${r.playerBetCount}</td>
      <td class="num">${r.playerHitCount}</td>
      <td><button class="fav-btn" data-id="${d.id}">${entry && entry.favorite ? "★" : "☆"}</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  app.appendChild(tbl);

  app.querySelectorAll(".fav-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const entry = ensureCollectionEntry(id);
      entry.favorite = !entry.favorite;
      const list = state.player.village.favoriteDragonIds;
      if (entry.favorite && !list.includes(id)) list.push(id);
      else if (!entry.favorite) {
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1);
      }
      saveGame();
      renderCollection();
    };
  });

  const actions = el("div", "actions");
  const home = el("button", null, "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}

function renderRaceSelect() {
  state.ui.screen = "race_select";
  runEventHooks("beforeRaceSelect");
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "レース選択"));
  const list = el("div");
  RACES.forEach(r => {
    const locked = r.rank > state.player.rank;
    const card = el("div", "card race-card");
    const theme = REGION_THEME[r.region];
    if (theme) {
      card.setAttribute("data-region", r.region);
      card.style.setProperty("--region-accent", theme.accent);
    }
    card.innerHTML = `
      <div>
        <div><b>${raceFullName(r)}</b> <span class="rank-${statRank(r.rank*15)}">[Rank ${r.rank}]</span>${locked ? ` <span class="locked-badge">🔒 ランク${r.rank}解放後</span>` : ""}</div>
        <div class="race-meta">${DISTANCE[r.distance].label} ／ ${WEATHERS[r.weather].label} ／ ${getSection("early",r.early).label}→${getSection("mid",r.mid).label}→${getSection("late",r.late).label}</div>
        <div class="race-meta">目的: ${r.purpose} ／ 賭金上限: ${fmtCoins(RANKS[r.rank].maxWager * (VILLAGE_MULT[state.player.villageLevel]||1))}</div>
      </div>
      <div><button ${locked ? 'disabled' : ''}>${locked ? 'ロック中' : 'このレースを見る'}</button></div>
    `;
    if (!locked) card.querySelector("button").onclick = () => renderRaceDetail(r);
    list.appendChild(card);
  });
  app.appendChild(list);
  const back = el("button", "secondary", "ホームへ"); back.onclick = renderHome;
  app.appendChild(back);
}

function renderRaceDetail(race) {
  state.ui.screen = "race_detail";
  runEventHooks("afterRaceSelect", { race });

  // Compute odds (market simulation).
  runEventHooks("beforeEntryList", { race });
  const oddsResult = simulateMarket(race);
  // Generate trial-run forms shown to the player (cached so they stay
  // consistent during this race-detail session per §07 §11).
  const trialForms = {};
  getRaceDragons(race).forEach(d => trialForms[d.id] = generateForm(d));

  state.current = { race, oddsResult, trialForms, bet: { type: "win", selections: [], wager: 100 } };
  // Tense tag for panyu hook when overpopular favorite has bad fit
  const fav = oddsResult.oddsData.find(o => o.popularityRank === 1);
  const tense = fav && fav.winOdds <= 2.5;
  runEventHooks("afterEntryList", { race, tags: tense ? ["tense_race"] : [] });
  runEventHooks("beforeDragonPreview", { race });
  runEventHooks("afterDragonPreview", { race, tags: tense ? ["tense_race"] : [] });

  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, raceFullName(race)));

  // Race info card with region theme (§11 §23)
  const info = el("div", "card race-detail-card");
  const theme = REGION_THEME[race.region];
  if (theme) {
    info.setAttribute("data-region", race.region);
    info.style.setProperty("--region-from", theme.from);
    info.style.setProperty("--region-to", theme.to);
    info.style.setProperty("--region-accent", theme.accent);
  }
  info.innerHTML = `
    <div>
      <div><b>ランク:</b> Rank ${race.rank} (${RANKS[race.rank].label})</div>
      <div><b>距離:</b> ${DISTANCE[race.distance].label}</div>
      <div><b>天候:</b> ${WEATHERS[race.weather].label}</div>
      <div><b>最大賭金:</b> ${fmtCoins(RANKS[race.rank].maxWager)}</div>
    </div>
    <div>
      <div><b>序盤:</b> ${getSection("early",race.early).label}</div>
      <div><b>中盤:</b> ${getSection("mid",race.mid).label}</div>
      <div><b>終盤:</b> ${getSection("late",race.late).label}</div>
      <div class="condition-line">${race.purpose}</div>
    </div>
  `;
  app.appendChild(info);

  // Entry list
  app.appendChild(el("h3", null, "出走表"));
  const tbl = el("table", "entry-table");
  tbl.innerHTML = `
    <thead><tr>
      <th>人気</th><th>竜名</th><th>脚質</th>
      <th>速</th><th>耐</th><th>回</th><th>翼</th><th>火</th><th>気</th>
      <th>印</th><th>近</th>
      <th>単オッズ</th><th>複オッズ</th>
      <th>特徴</th>
    </tr></thead>
  `;
  const tbody = el("tbody");
  // Sort by popularity rank
  const sorted = [...oddsResult.oddsData].sort((a,b) => a.popularityRank - b.popularityRank);
  sorted.forEach(od => {
    const d = DRAGONS.find(x => x.id === od.dragonId);
    const tr = el("tr");
    const rk = od.popularityRank;
    tr.innerHTML = `
      <td><span class="popularity-rank p${rk<=3?rk:""}">${rk}</span></td>
      <td><span class="dragon-icon-row">${dragonIconPlaceholder(d)}<b>${d.name}</b></span></td>
      <td class="style-${d.style}">${STYLE_LABEL[d.style]}</td>
      <td class="num rank-${statRank(d.stats.speed)}">${statRank(d.stats.speed)}</td>
      <td class="num rank-${statRank(d.stats.stamina)}">${statRank(d.stats.stamina)}</td>
      <td class="num rank-${statRank(d.stats.turn)}">${statRank(d.stats.turn)}</td>
      <td class="num rank-${statRank(d.stats.wing)}">${statRank(d.stats.wing)}</td>
      <td class="num rank-${statRank(d.stats.fire)}">${statRank(d.stats.fire)}</td>
      <td class="num rank-${statRank(d.stats.nerve)}">${statRank(d.stats.nerve)}</td>
      <td class="mark">${d.newspaperMark || "-"}</td>
      <td class="num">${recentResultLabel(d.recentResult)}</td>
      <td class="num odds-win">${od.winOdds.toFixed(1)}</td>
      <td class="num odds-place">${od.placeOdds.toFixed(1)}</td>
      <td class="dragon-traits">${d.traits.join(" / ")}</td>
    `;
    if (state.ui.debug) {
      tr.appendChild(el("td", "debug-info", `pop=${od.popularityPower.toFixed(1)} winP=${(od.marketWinProb*100).toFixed(1)}% placeP=${(od.marketPlaceProb*100).toFixed(1)}%`));
    }
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  app.appendChild(tbl);

  // Trial Run Summary (§07 §11) — visible at standard+
  if (state.ui.infoLevel !== "simple") {
    app.appendChild(el("h3", null, "試走サマリー"));
    const trialTbl = el("table", "trial-table");
    trialTbl.innerHTML = `<thead><tr>
      <th>竜名</th><th>体調</th><th>集中</th>
      <th>試走スタート</th><th>試走旋回</th><th>試走終い</th>
      <th>騎手呼吸</th><th>注釈</th>
    </tr></thead>`;
    const tbody2 = el("tbody");
    sorted.forEach(od => {
      const d = DRAGONS.find(x => x.id === od.dragonId);
      const f = state.current.trialForms[d.id];
      const cls = v => v >= 75 ? "trial-good" : v >= 55 ? "trial-mid" : "trial-bad";
      const note = trialNote(d, f);
      const tr = el("tr");
      tr.innerHTML = `
        <td><b>${d.name}</b></td>
        <td class="${cls(f.bodyCondition)}">${statRank(f.bodyCondition)}</td>
        <td class="${cls(f.focus)}">${statRank(f.focus)}</td>
        <td class="${cls(f.trialStart)}">${statRank(f.trialStart)}</td>
        <td class="${cls(f.trialTurn)}">${statRank(f.trialTurn)}</td>
        <td class="${cls(f.trialFinish)}">${statRank(f.trialFinish)}</td>
        <td class="${cls(f.riderSync)}">${statRank(f.riderSync)}</td>
        <td class="trial-note">${note}</td>
      `;
      tbody2.appendChild(tr);
    });
    trialTbl.appendChild(tbody2);
    app.appendChild(trialTbl);
  }

  // Advanced/Expert: show value-bet hints (market vs true rough estimate)
  if (state.ui.infoLevel === "advanced" || state.ui.infoLevel === "expert") {
    app.appendChild(el("h3", null, "妙味の手がかり（詳細モード）"));
    const hintBox = el("div", "card");
    const hints = generateValueHints(race, oddsResult, state.current.trialForms);
    hints.forEach(h => hintBox.appendChild(el("div", null, h)));
    app.appendChild(hintBox);
  }

  // Betting panel
  app.appendChild(el("h3", null, "賭けパネル"));
  const panel = el("div", "card");
  panel.innerHTML = `
    <div class="bet-tabs">
      <button data-type="win" class="active">単竜（1着）</button>
      <button data-type="place">複竜（3着以内）</button>
      <button data-type="wide">ワイド竜（2頭3着以内）</button>
    </div>
    <div class="selectors">
      <label>1頭目: <select id="sel-a"></select></label>
      <label id="sel-b-row" style="display:none;">2頭目: <select id="sel-b"></select></label>
      <label>賭金: <input id="wager" type="number" min="1" step="1" value="100" max="${RANKS[race.rank].maxWager}"></label>
      <div class="expected-payout" id="expected-payout">期待払戻: -</div>
    </div>
    <div class="actions">
      <button id="bet-confirm">この賭けで出走</button>
      <button id="back-race-select" class="secondary">戻る</button>
    </div>
    <div class="condition-line">所持: ${fmtCoins(state.player.coins)}コイン ／ このランクの上限賭金: ${fmtCoins(RANKS[race.rank].maxWager)}</div>
  `;
  app.appendChild(panel);

  // Populate selectors
  const optHTML = sorted.map(od => {
    const d = DRAGONS.find(x => x.id === od.dragonId);
    return `<option value="${d.id}">${od.popularityRank}人気 ${d.name}</option>`;
  }).join("");
  $("sel-a").innerHTML = `<option value="">--選択--</option>` + optHTML;
  $("sel-b").innerHTML = `<option value="">--選択--</option>` + optHTML;

  // Tabs
  panel.querySelectorAll(".bet-tabs button").forEach(btn => {
    btn.onclick = () => {
      panel.querySelectorAll(".bet-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.current.bet.type = btn.dataset.type;
      $("sel-b-row").style.display = (btn.dataset.type === "wide") ? "block" : "none";
      runEventHooks("beforeBet", { race, bet: state.current.bet });
      updateExpected();
    };
  });
  $("sel-a").onchange = updateExpected;
  $("sel-b").onchange = updateExpected;
  $("wager").oninput = updateExpected;
  $("bet-confirm").onclick = onConfirmBet;
  $("back-race-select").onclick = renderRaceSelect;
}

// §11 §19 placeholder dragon icon — colored disc + name initial.
function dragonIconPlaceholder(d) {
  const color = STYLE_COLOR[d.style] || "#888";
  const initial = d.name.charAt(0);
  return `<span class="dragon-icon" style="background:${color}">${initial}</span>`;
}

function trialNote(d, f) {
  const notes = [];
  if (f.bodyCondition >= 75) notes.push("鱗のツヤ良");
  else if (f.bodyCondition < 50) notes.push("足取り重い");
  if (f.trialStart >= 80) notes.push("発走◎");
  else if (f.trialStart < 50) notes.push("出遅れ気味");
  if (f.trialFinish >= 80) notes.push("終い伸びる");
  else if (f.trialFinish < 50) notes.push("終い甘い");
  if (f.trialTurn >= 80) notes.push("旋回滑らか");
  else if (f.trialTurn < 50) notes.push("旋回外膨れ");
  if (f.riderSync >= 80) notes.push("呼吸◎");
  if (notes.length === 0) notes.push("並み");
  return notes.join("／");
}

function generateValueHints(race, oddsResult, trialForms) {
  // Quick rough estimate: weight basePower + coursePower fit, compare to popularityPower
  const hints = [];
  const items = getRaceDragons(race).map(d => {
    const cp = coursePower(d, race);
    const wp = weightedStat(d.stats, WEATHERS[race.weather].weights);
    const f = trialForms[d.id];
    const fp = formPower(f);
    const fit = basePower(d) * 0.35 + cp.total * 0.20 + wp * 0.10 + fp * 0.15;
    const od = oddsResult.oddsData.find(o => o.dragonId === d.id);
    return { d, fit, popularityPower: od.popularityPower, popRank: od.popularityRank, winOdds: od.winOdds };
  });
  // Sort by fit-vs-popularity gap
  items.sort((a,b) => (b.fit - b.popularityPower) - (a.fit - a.popularityPower));
  const top = items.slice(0,2);
  const bot = items.slice(-2);
  top.forEach(it => {
    if (it.fit - it.popularityPower > 5) {
      hints.push(`💡 ${it.d.name} (${it.popRank}番人気・単${it.winOdds.toFixed(1)}): コース適性が市場評価より高い (推定差 +${(it.fit - it.popularityPower).toFixed(1)})`);
    }
  });
  bot.forEach(it => {
    if (it.popularityPower - it.fit > 5) {
      hints.push(`⚠ ${it.d.name} (${it.popRank}番人気・単${it.winOdds.toFixed(1)}): 市場が過剰評価の可能性 (推定差 -${(it.popularityPower - it.fit).toFixed(1)})`);
    }
  });
  if (hints.length === 0) hints.push("今回は市場と実力の差が小さい平穏なレースです。");
  return hints;
}

function recentResultLabel(v) {
  if (v >= 90) return "前走◎";
  if (v >= 75) return "好走";
  if (v >= 55) return "普通";
  return "凡走";
}

function updateExpected() {
  const c = state.current;
  const type = document.querySelector(".bet-tabs button.active").dataset.type;
  const a = $("sel-a").value;
  const b = $("sel-b").value;
  const wager = parseInt($("wager").value, 10);
  c.bet = { type, selections: type === "wide" ? [a,b] : [a], wager };
  let display = "期待払戻: -";
  if (a && (type !== "wide" || b) && wager > 0) {
    try {
      const odds = betOdds(c.bet, c.oddsResult);
      const payout = Math.floor(wager * odds);
      display = `オッズ ${odds.toFixed(1)}倍 ／ 的中時払戻: ${fmtCoins(payout)}コイン (利益 +${fmtCoins(payout - wager)})`;
    } catch (e) { display = "オッズ計算エラー"; }
  }
  $("expected-payout").textContent = display;
}

function onConfirmBet(skipDialog) {
  const c = state.current;
  const err = validateBet(c.bet, c.race);
  if (err) {
    const ep = document.getElementById("expected-payout");
    if (ep) { ep.textContent = "エラー: " + err; ep.style.color = "#ff8080"; }
    return;
  }
  // §07 §13 confirmation dialog to prevent accidental bets.
  if (!skipDialog) {
    showBetConfirm();
    return;
  }
  // Deduct wager up-front
  state.player.coins -= c.bet.wager;
  updateHeader();
  saveGame();
  runEventHooks("afterBet", { race: c.race, bet: c.bet });
  // Run race using the trial-run forms shown to the player.
  runEventHooks("duringRace", { race: c.race });
  const raceResult = runRace(c.race, c.trialForms);
  c.raceResult = raceResult;
  const betResult = resolveBet(c.bet, raceResult, c.oddsResult);
  c.betResult = betResult;
  // Award payout
  state.player.coins += betResult.payout;
  state.player.completedRaces += 1;
  state.player.completedByRank[c.race.rank] = (state.player.completedByRank[c.race.rank] || 0) + 1;
  if (betResult.hit && c.bet.type === "win") {
    state.player.wins += 1;
    state.player.winsByRank[c.race.rank] = (state.player.winsByRank[c.race.rank] || 0) + 1;
  }
  updateCollectionFromRace(raceResult, c.bet, betResult);
  checkEconomyMilestones(betResult);
  checkRankProgression();
  saveGame();
  updateHeader();
  renderRaceRun();
}

// §07 §13 Bet confirmation modal.
function showBetConfirm() {
  const c = state.current;
  const typeLabel = { win:"単竜", place:"複竜", wide:"ワイド竜" }[c.bet.type];
  const sel = c.bet.selections.map(id => DRAGONS.find(d => d.id === id).name).join(" + ");
  const odds = betOdds(c.bet, c.oddsResult);
  const payout = Math.floor(c.bet.wager * odds);
  const overlay = document.getElementById("event-overlay");
  document.getElementById("event-speaker").textContent = "賭けの確認";
  document.getElementById("event-text").innerHTML =
    `<b>${typeLabel}</b> ／ ${sel}<br>賭金: <b>${fmtCoins(c.bet.wager)}</b>コイン<br>` +
    `オッズ: <b>${odds.toFixed(1)}</b>倍<br>的中時払戻: <b>${fmtCoins(payout)}</b>コイン<br><br>` +
    `この賭けで出走しますか？`;
  // Swap close button for two buttons
  const closeBtn = document.getElementById("event-close");
  closeBtn.style.display = "none";
  let existing = document.getElementById("bet-confirm-actions");
  if (existing) existing.remove();
  const actions = document.createElement("div");
  actions.id = "bet-confirm-actions";
  actions.style.display = "flex"; actions.style.gap = "10px"; actions.style.marginTop = "12px";
  const yes = document.createElement("button"); yes.textContent = "出走する";
  yes.onclick = () => { closeBetConfirm(); onConfirmBet(true); };
  const no = document.createElement("button"); no.textContent = "やめる"; no.className = "secondary";
  no.onclick = () => { closeBetConfirm(); };
  actions.appendChild(yes); actions.appendChild(no);
  closeBtn.parentNode.appendChild(actions);
  overlay.classList.remove("hidden");
}
function closeBetConfirm() {
  const overlay = document.getElementById("event-overlay");
  overlay.classList.add("hidden");
  document.getElementById("event-close").style.display = "";
  const a = document.getElementById("bet-confirm-actions");
  if (a) a.remove();
}

function renderRaceRun() {
  state.ui.screen = "race_run";
  const c = state.current;
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "レース進行"));
  const log = el("div", "race-log");
  c.raceResult.logs.forEach(phase => {
    log.appendChild(el("div", "phase", `【${phase.phase}】`));
    phase.lines.forEach(line => log.appendChild(el("div", "line", line)));
  });
  app.appendChild(log);

  app.appendChild(el("h3", null, "最終順位"));
  const tbl = el("table", "ranking-table");
  tbl.innerHTML = `<thead><tr><th>着順</th><th>竜名</th><th>脚質</th><th>FinalPower</th><th>スタミナ残</th></tr></thead>`;
  const tbody = el("tbody");
  c.raceResult.entries.forEach(e => {
    const tr = el("tr", e.rank <= 3 ? `top${e.rank}` : "");
    tr.innerHTML = `
      <td>${e.rank}</td>
      <td><b>${e.dragon.name}</b></td>
      <td class="style-${e.dragon.style}">${STYLE_LABEL[e.dragon.style]}</td>
      <td>${e.finalPower.toFixed(1)}</td>
      <td>${staminaBar(e)} ${e.collapse ? '<span class="collapse-marker">崩壊</span>' : ''}</td>
    `;
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  app.appendChild(tbl);

  if (state.ui.debug) {
    const dbg = el("div", "debug-info", debugDumpRace(c.raceResult));
    app.appendChild(dbg);
  }

  const actions = el("div", "actions");
  const next = el("button", null, "結果を見る"); next.onclick = renderResult;
  actions.appendChild(next);
  app.appendChild(actions);
}

function staminaBar(e) {
  const ratio = clamp(e.staminaRatio, 0, 1);
  return `<span class="stamina-bar"><div style="width:${(ratio*100).toFixed(0)}%"></div></span>`;
}

function debugDumpRace(rr) {
  return rr.entries.map(e =>
    `${e.rank}. ${e.dragon.name} | fp=${e.finalPower.toFixed(1)} bp=${e.basePower.toFixed(1)} cp=${e.coursePower.total.toFixed(1)} wp=${e.weatherPower.toFixed(1)} fmp=${e.formPower.toFixed(1)} pp=${e.pacePower.toFixed(1)} pos=${e.positionPower.toFixed(1)} rnd=${e.randomPower.toFixed(1)} stAdj=${e.staminaAdjustment.toFixed(1)} stRem=${e.staminaRemaining.toFixed(1)}`
  ).join("\n") + `\nPace: ${rr.pace.type} (idx=${rr.pace.index.toFixed(1)})`;
}

function renderResult() {
  state.ui.screen = "result";
  const c = state.current;
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "賭け結果"));

  const r = c.betResult;
  const headBox = el("div", "card");
  const sel = c.bet.selections.map(id => DRAGONS.find(d => d.id === id).name).join(" + ");
  const typeLabel = { win:"単竜", place:"複竜", wide:"ワイド竜"}[c.bet.type];
  headBox.innerHTML = `
    <div>賭式: <b>${typeLabel}</b> ／ 選択: <b>${sel}</b> ／ 賭金: <b>${fmtCoins(r.wager)}</b> ／ オッズ: <b>${r.odds.toFixed(1)}</b></div>
    <div class="${r.hit ? 'result-hit' : 'result-miss'}">${r.hit ? '的中！' : 'ハズレ'}</div>
    <div>払戻: <b>${fmtCoins(r.payout)}</b>コイン ／ 収支: <b>${r.profit >= 0 ? '+' : ''}${fmtCoins(r.profit)}</b></div>
    <div>新所持コイン: <b>${fmtCoins(state.player.coins)}</b></div>
  `;
  app.appendChild(headBox);

  // Mimi/Sake reaction after race result (§3 afterRaceResult)
  const winnerOd = c.oddsResult.oddsData.find(o => o.dragonId === c.raceResult.entries[0].dragon.id);
  runEventHooks("afterRaceResult", { race: c.race, hit: r.hit, popularityRank: winnerOd.popularityRank, bigLoss: !r.hit && r.wager >= 500 });

  // Bankruptcy
  if (state.player.coins <= 0) runEventHooks("onBankruptcy", { race: c.race });

  const actions = el("div", "actions");
  const a = el("button", null, "分析を見る"); a.onclick = renderAnalysis;
  actions.appendChild(a);
  const next = el("button", "secondary", "次のレースへ"); next.onclick = renderRaceSelect;
  actions.appendChild(next);
  app.appendChild(actions);
}

// Game-level share — promotes the game itself rather than a single race result.
const GAME_SHARE_URL = "";  // 公開URLが決まったらここに入れる

function buildGameShareText() {
  const lines = [
    `【聖龍爆走録ミミ】`,
    `転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件`,
    ``,
    `市場のオッズと真の実力のズレを読む、ファンタジー公営龍レース予想カジノ。`,
    `8竜・3賭式（単竜／複竜／ワイド竜）・5レース。`,
    `1番人気が強いとは限らない。読めば勝てる、読まなきゃ負ける。`,
    ``,
    `#聖龍爆走録ミミ #ぱほぱほ`
  ];
  if (GAME_SHARE_URL) lines.push("", GAME_SHARE_URL);
  return lines.join("\n");
}

async function shareGameInfo() {
  const text = buildGameShareText();
  const payload = { title: "聖龍爆走録ミミ", text };
  if (GAME_SHARE_URL) payload.url = GAME_SHARE_URL;
  if (navigator.share) {
    try {
      await navigator.share(payload);
      flashShareToast("シェアしました");
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      flashShareToast("ゲーム紹介文をコピーしました");
      return;
    } catch (e) { /* fall through */ }
  }
  showShareFallback(text, "ゲーム紹介文をコピー");
}

function flashShareToast(msg) {
  let toast = document.getElementById("share-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "share-toast";
    toast.className = "share-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function showShareFallback(text, title) {
  const overlay = document.getElementById("event-overlay");
  document.getElementById("event-speaker").textContent = title || "テキストをコピー";
  document.getElementById("event-text").innerHTML =
    `<div style="font-size:12px;color:#a0a0a0;margin-bottom:8px;">下のテキストを選んでコピーしてください。</div>` +
    `<textarea readonly style="width:100%;height:160px;background:#1a1530;color:#f0e8d0;border:1px solid #604040;border-radius:3px;padding:6px;font-size:13px;">${text.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</textarea>`;
  overlay.classList.remove("hidden");
}

function renderAnalysis() {
  state.ui.screen = "analysis";
  const c = state.current;
  const analysis = buildAnalysis(c.race, c.raceResult, c.oddsResult, c.betResult);
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "レース後分析"));
  runEventHooks("afterRaceAnalysis", { race: c.race, analysis });

  const sec = (label, lines) => {
    const d = el("div", "analysis-section");
    d.appendChild(el("span", "label", label));
    lines.forEach(t => d.appendChild(el("div", null, t)));
    return d;
  };

  const lvl = state.ui.infoLevel;
  // §07 §16 level-based analysis display.
  // simple: winner reason + pace + next hint
  // standard: + favorite failure + value notes + bet eval
  // advanced: + stamina + weather notes
  // expert: + component breakdown
  app.appendChild(sec("勝因", analysis.winnerReasons));
  app.appendChild(sec("ペース総括", [analysis.paceSummary]));
  if (lvl !== "simple") {
    app.appendChild(sec("人気馬(竜)分析", analysis.favoriteFailureReasons));
    app.appendChild(sec("妙味・人気とのズレ", analysis.valueNotes));
    if (analysis.betEval && analysis.betEval.length) app.appendChild(sec("今回の賭け評価", analysis.betEval));
  }
  if (lvl === "advanced" || lvl === "expert") {
    app.appendChild(sec("スタミナ", analysis.staminaNotes));
    app.appendChild(sec("天候", analysis.weatherNotes));
  }
  if (lvl === "expert") {
    const top3 = c.raceResult.entries.slice(0,3);
    const lines = top3.map(e =>
      `${e.rank}着 ${e.dragon.name}: BP=${e.basePower.toFixed(1)} CP=${e.coursePower.total.toFixed(1)} WP=${e.weatherPower.toFixed(1)} FP=${e.formPower.toFixed(1)} PaceP=${e.pacePower.toFixed(1)} PosP=${e.positionPower.toFixed(1)} Rnd=${e.randomPower.toFixed(1)} StAdj=${e.staminaAdjustment.toFixed(1)} → Final=${e.finalPower.toFixed(1)}`
    );
    app.appendChild(sec("コンポーネント内訳（エキスパート）", lines));
  }
  app.appendChild(sec("次戦へのヒント", analysis.nextHints));

  const actions = el("div", "actions");
  const next = el("button", null, "次のレースへ"); next.onclick = renderRaceSelect;
  actions.appendChild(next);
  const home = el("button", "secondary", "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}
