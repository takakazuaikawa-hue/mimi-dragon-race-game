/**
 * ui_render.js — all screen renderers.
 *
 * Screens implemented (in render-function form, dispatched by main.js):
 *   home / race_select / race_detail / race_run / result / analysis /
 *   village / collection / help.
 *
 * DOM helpers `$` and `el` live in utils.js.
 *
 * EXTENSION POINT — new screen:
 *   1. Add render<NewScreen>() following the pattern (set state.ui.screen,
 *      clear #app, append elements, end with .actions buttons).
 *   2. Wire it into the rerenderCurrent map in main.js.
 *   3. Add a navigation button on the home screen (or wherever entry lives).
 */

function updateHeader() {
  $("coin-display").textContent = fmtCoins(state.player.coins);
  $("rank-display").textContent = state.player.rank;
}

// =========================================================================
// Title screen — the commercial first impression. No image files (hard
// constraint): the key art is pure CSS (night sky, moon, stars, gradient
// logo) plus an animated pixel-dragon mascot rendered on a canvas by reusing
// the race sprite. Hides the dev HUD header for a clean opening beat.
// =========================================================================
function renderTitle() {
  state.ui.screen = "title";
  document.body.classList.add("title-mode");
  const app = $("app"); app.innerHTML = "";
  const wrap = el("div", "title-screen");
  wrap.innerHTML = `
    <div class="title-bg"></div>
    <div class="title-stars"></div>
    <div class="title-moon"></div>
    <div class="title-inner">
      <div class="title-kicker">── 競竜 予想ドラマ ──</div>
      <h1 class="title-logo"><span class="tl-main">聖龍爆走録</span> <span class="tl-mimi">ミミ</span></h1>
      <div class="title-novel">転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件</div>
      <canvas id="title-dragon" class="title-dragon" width="184" height="120"></canvas>
      <div class="title-tagline">市場のオッズと、真の実力。<br>その<b>ズレ</b>を読み切れ。</div>
      <div class="title-actions"></div>
      <div class="title-foot">v0.1 ・ ぱほぱほスタジオ</div>
    </div>`;
  app.appendChild(wrap);

  const acts = wrap.querySelector(".title-actions");
  const start = el("button", "title-cta", "▶ はじめる");
  start.onclick = () => renderHome();
  acts.appendChild(start);
  const p = state.player;
  acts.appendChild(el("div", "title-hint",
    p.completedRaces > 0 ? `おかえりなさい — ${p.completedRaces}戦 ・ ${fmtCoins(p.coins)}` : "ようこそ、予想家の世界へ"));

  // animated pixel-dragon mascot (reuses the race sprite); self-stops on screen change
  const cv = document.getElementById("title-dragon");
  if (cv && cv.getContext && typeof rcDrawDragon === "function") {
    const tctx = cv.getContext("2d");
    let g = 1.7;
    (function frame() {
      if (!document.body.contains(cv)) return;
      tctx.clearRect(0, 0, cv.width, cv.height);
      g += 0.11;
      rcDrawDragon(tctx, {
        x: cv.width / 2, y: cv.height / 2 + Math.sin(g * 0.5) * 5, scale: 1.95,
        color: "#ffd54a", style: "escape", gait: g, flap: g * 0.6, lean: 0.5, glow: 0.6
      });
      requestAnimationFrame(frame);
    })();
  }
}

function renderHome() {
  state.ui.screen = "home";
  document.body.classList.remove("title-mode");
  const app = $("app"); app.innerHTML = "";
  const p = state.player;
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const rankLabel = (RANKS[p.rank] && RANKS[p.rank].label) || "";
  const winRate = p.completedRaces > 0 ? Math.round((p.wins / p.completedRaces) * 100) : 0;
  const total = p.totalAssets || 0;
  const nextT = (typeof nextAssetThreshold === "function") ? nextAssetThreshold(total) : null;
  const fillPct = nextT ? Math.max(5, Math.min(100, total / nextT * 100)) : 100;
  let stageLabel = "";
  try { const st = (typeof lifeStageFor === "function" && state.assets) ? lifeStageFor(state.assets.unlockedLifeStages) : null; stageLabel = (st && (st.label || st.name || st.title)) || ""; } catch (e) {}

  // --- calm fixed ambient (drop images/home_ambient.png to layer a backdrop) ---
  const bg = el("div", "hw-bg");
  bg.innerHTML = (typeof photoOr === "function" ? photoOr("images/home_ambient.png", "") : "");
  app.appendChild(bg);

  const wrap = el("div", "home2");

  // --- the world vista: distant volcano, jungle ridges, lantern string ---
  // (CSS diorama fallback; drop images/home_vista_day.png to layer a painted banner on top)
  const vista = el("div", "hw-vista");
  vista.innerHTML =
    `<div class="hwv-sky"></div><div class="hwv-sun"></div>` +
    `<div class="hwv-volcano"><div class="hwv-crater"></div></div>` +
    `<div class="hwv-smoke"></div>` +
    `<div class="hwv-ridge-far"></div><div class="hwv-haze"></div><div class="hwv-ridge-near"></div>` +
    `<div class="hwv-lanterns" id="hw-lanterns"></div>` +
    (typeof photoOr === "function" ? photoOr("images/home_vista_day.png", "") : "") +
    `<div class="hwv-fade"></div>` +
    `<div class="hwv-label"><i></i>聖龍レース都市・ヴォルカ街道</div>`;
  wrap.appendChild(vista);
  const lr = vista.querySelector("#hw-lanterns");
  if (lr) [10, 26, 42, 58, 74, 90].forEach((xp, i) => { const L = el("div", "hw-lantern"); L.style.left = xp + "%"; L.style.top = (7 + (i % 2) * 4) + "px"; lr.appendChild(L); });

  // hero — player status
  const hero = el("div", "glass-panel hw-hero");
  hero.innerHTML =
    `<canvas class="hb-dragon" width="92" height="74"></canvas>` +
    `<div class="hw-hero-id"><div class="hw-greet">ようこそ、聖龍都市へ</div>` +
    `<div class="hw-name">予想家 ミミ</div>` +
    `<div class="hw-rank">ランク <b>${p.rank}</b>${rankLabel ? "　" + rankLabel : ""}</div></div>` +
    `<div class="hw-coins"><span>所持コイン</span><b>${fmtCoins(p.coins)}</b></div>`;
  wrap.appendChild(hero);

  // total-asset bar
  let stageInfo = stageLabel ? "暮らし：" + stageLabel : "";
  if (nextT) stageInfo += (stageInfo ? " ／ " : "") + "次の段階まで あと " + fmtCoins(Math.max(0, nextT - total));
  else if (!stageLabel) stageInfo = "最終段階に到達";
  const asset = el("div", "glass-panel hw-asset");
  asset.innerHTML =
    `<div class="hw-asset-row"><span>総資産（ミミの再起度）</span><b>${fmtCoins(total)}</b></div>` +
    `<div class="hw-asset-bar"><div class="hw-asset-fill" style="width:${fillPct}%"></div></div>` +
    `<div class="hw-asset-stage">${stageInfo}</div>`;
  wrap.appendChild(asset);

  // record chips
  const rec = el("div", "hw-rec");
  const rc = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  rec.innerHTML = rc("出走", p.completedRaces) + rc("単勝", p.wins) + rc("勝率", winRate + "%") + rc("最高配当", fmtCoins(p.biggestPayout || 0));
  wrap.appendChild(rec);

  // the public-race ticket — the most important button (§18.3)
  const cta = el("button", "hw-cta",
    `<span class="hw-cta-tag">公営 聖龍レース・出走券</span><span class="hw-cta-main">レースへ進む<span class="hw-cta-mon">🐉</span></span>`);
  cta.onclick = () => renderRaceSelect();
  wrap.appendChild(cta);

  // tourist-board menu
  const tile = (icon, label, sub, onClick) => {
    const b = el("button", "hw-tile",
      `<span class="hw-tile-ic">${icon}</span><span class="hw-tile-tx"><span class="hw-tile-l">${label}</span><span class="hw-tile-s">${sub}</span></span>`);
    b.onclick = onClick; return b;
  };
  wrap.appendChild(el("div", "hw-seclabel", "育成・記録"));
  const g1 = el("div", "hw-menu2");
  g1.appendChild(tile("🏠", "暮らしと資産", "総資産と暮らしの歩み", () => renderAssets()));
  g1.appendChild(tile("📜", "ストーリー", "ミミと5人の物語", () => renderStory()));
  g1.appendChild(tile("📖", "竜図鑑", "出会った竜の記録", () => renderCollection()));
  g1.appendChild(tile("🏘️", "竜の村", "竜たちと交流する", () => renderVillage()));
  wrap.appendChild(g1);
  wrap.appendChild(el("div", "hw-seclabel", "サポート"));
  const g2 = el("div", "hw-menu2");
  g2.appendChild(tile("💬", "相談する", "顧問に視点をもらう", () => renderConsult()));
  g2.appendChild(tile("🎓", "予想入門", "賭けの基礎を学ぶ", () => renderHelp()));
  g2.appendChild(tile("📣", "シェア", "友達に教える", shareGameInfo));
  wrap.appendChild(g2);

  const foot = el("div", "hw-foot");
  const reset = el("button", null, "データをリセット");
  reset.onclick = () => { if (confirm("プレイヤー状態をリセットしますか？")) { resetGame(); updateHeader(); renderHome(); } };
  foot.appendChild(reset);
  wrap.appendChild(foot);

  app.appendChild(wrap);

  // mascot animation (reuses the race sprite)
  const cv = hero.querySelector(".hb-dragon");
  if (cv && cv.getContext && typeof rcDrawDragon === "function") {
    const tctx = cv.getContext("2d");
    let g = 1.0;
    (function frame() {
      if (!document.body.contains(cv)) return;
      tctx.clearRect(0, 0, cv.width, cv.height);
      g += 0.1;
      rcDrawDragon(tctx, { x: cv.width / 2, y: cv.height / 2 + Math.sin(g * 0.5) * 4, scale: 1.4, color: "#ffd54a", style: "escape", gait: g, flap: g * 0.6, lean: 0.4, glow: 0.5 });
      requestAnimationFrame(frame);
    })();
  }
}

// =========================================================================
// §30 — 暮らしと資産 (total-asset / lifestyle) screen.
// Two layers (§9): A. numeric breakdown, B. ミミの生活. Plus story progress +
// the life-asset list (auto-unlocked + purchasable cosmetics). This screen is
// read/cosmetic only — it never changes coins except via an explicit purchase,
// and never touches race results.
// =========================================================================
function renderAssets() {
  state.ui.screen = "assets";
  recomputeAssets(state);  // keep the view in sync (idempotent, monotonic)
  const p = state.player, a = state.assets;
  const total = p.totalAssets;
  const level = a.unlockedLifeStages;
  const stage = lifeStageFor(level);
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "暮らしと資産"));

  // --- Headline: total assets + the coins/maxCoins distinction (§16) ---
  const head = el("div", "card");
  const nextT = nextAssetThreshold(total);
  head.innerHTML =
    `<div class="asset-total">総資産：<b>${fmtCoins(total)}</b> コイン相当</div>` +
    `<div class="asset-coins">手持ち：<b>${fmtCoins(p.coins)}</b> ／ 最大到達：<b>${fmtCoins(p.maxCoinsReached)}</b></div>` +
    `<div class="asset-coins-note">※ 手持ちは賭けに使うお金、総資産はミミの再起度です（賭けに負けても総資産は下がりません）。</div>` +
    (nextT ? `<div class="asset-next">次の段階まで：あと <b>${fmtCoins(Math.max(0, nextT - total))}</b></div>`
           : `<div class="asset-next">最終段階に到達しています。</div>`);
  app.appendChild(head);

  // (b) Sumika's voice on 総資産 (once she has been met).
  const _avA = advisorVoiceEl("assets"); if (_avA) app.appendChild(_avA);

  // --- B. ミミの生活 ---
  const life = el("div", "card");
  life.appendChild(el("div", "asset-stage-title", `ミミの生活：${stage.summary}`));
  const rows = [
    ["住居", stage.housing], ["衣装", stage.outfit], ["食事", stage.food],
    ["部屋飾り", stage.decor], ["実況道具", stage.tool],
    ["支援者", stage.supporter], ["名声", stage.fame], ["村の様子", stage.village]
  ];
  const grid = el("div", "asset-life-grid");
  rows.forEach(([k, v]) => {
    const row = el("div", "asset-life-row");
    row.appendChild(el("span", "k", k));
    row.appendChild(el("span", "v", v));
    grid.appendChild(row);
  });
  life.appendChild(grid);
  life.appendChild(el("div", "asset-rescue", `救済見込み額：${fmtCoins(calculateRescueCoins(state, p.rank))}（破産時に世界が支えてくれる額）`));
  app.appendChild(life);

  // --- A. 数値一覧（内訳） ---
  app.appendChild(el("h3", null, "内訳"));
  const breakdown = el("table", "ranking-table");
  breakdown.innerHTML =
    `<tr><th>項目</th><th>価値</th></tr>` +
    `<tr><td>最大到達コイン</td><td>${fmtCoins(p.maxCoinsReached)}</td></tr>` +
    `<tr><td>村資産</td><td>${fmtCoins(a.villageValue)}</td></tr>` +
    `<tr><td>施設価値</td><td>${fmtCoins(a.facilityValue)}</td></tr>` +
    `<tr><td>生活資産</td><td>${fmtCoins(a.livingValue)}</td></tr>` +
    `<tr><td>名声価値</td><td>${fmtCoins(a.fameValue)}</td></tr>` +
    `<tr><td>ドラゴン資産</td><td>${fmtCoins(a.dragonValue)}</td></tr>` +
    `<tr class="top1"><td><b>総資産</b></td><td><b>${fmtCoins(total)}</b></td></tr>`;
  app.appendChild(breakdown);

  // --- ストーリー進行 (§7) ---
  app.appendChild(el("h3", null, "ストーリー進行"));
  const story = el("div", "card");
  STORY_CHAPTERS.forEach(ch => {
    const unlocked = total >= storyUnlockAt(ch.id);
    const row = el("div", "asset-story-row" + (unlocked ? " unlocked" : " locked"));
    const head2 = el("div", "asset-story-head");
    head2.appendChild(el("span", "t", ch.title));
    head2.appendChild(el("span", "s", unlocked ? "解放" : `総資産 ${fmtCoins(storyUnlockAt(ch.id))} で解放`));
    row.appendChild(head2);
    if (unlocked) row.appendChild(el("div", "asset-story-body", ch.body));
    story.appendChild(row);
  });
  app.appendChild(story);

  // --- 生活資産アイテム (§5: auto-unlocked + purchasable) ---
  app.appendChild(el("h3", null, "生活資産"));
  const items = el("div", "card");
  LIFE_ASSETS.forEach(item => {
    const owned = isLifeAssetUnlocked(state, item, level);
    const row = el("div", "asset-item-row" + (owned ? " owned" : ""));
    const info = el("div", "asset-item-info");
    info.appendChild(el("span", "cat", LIFE_CATEGORY_LABEL[item.category] || item.category));
    info.appendChild(el("span", "nm", item.name));
    info.appendChild(el("span", "ds", item.description));
    row.appendChild(info);
    const right = el("div", "asset-item-right");
    if (item.unlockType === "auto") {
      right.appendChild(el("span", "tag", owned ? "解放済み" : `Lv${item.unlockAssetLevel}で解放`));
    } else if (owned) {
      right.appendChild(el("span", "tag", "購入済み"));
    } else {
      const buy = el("button", "secondary", `購入 ${fmtCoins(item.price)}`);
      buy.disabled = state.player.coins < item.price;
      buy.onclick = () => {
        const res = buyLifeItem(item.id);
        if (res.ok) renderAssets();
        else if (res.reason === "poor") alert("コインが足りません。");
      };
      right.appendChild(buy);
    }
    row.appendChild(right);
    items.appendChild(row);
  });
  app.appendChild(items);

  const actions = el("div", "actions");
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// =========================================================================
// Story-unlock popup (a) — shown when a 総資産 threshold is crossed during a
// race. Reuses the same CG placeholder slot. `chapters` is an array; it chains
// via 次へ so multiple unlocks in one race show one after another.
// =========================================================================
function showStoryUnlock(chapters, idx) {
  idx = idx || 0;
  const ch = chapters[idx];
  if (!ch) return;
  const cast = STORY_CAST[ch.cast];
  const ex = document.getElementById("story-unlock"); if (ex) ex.remove();
  const ov = el("div", "story-unlock-overlay"); ov.id = "story-unlock";
  const modal = el("div", "card story-unlock-modal");
  if (cast) modal.style.setProperty("--cg", cast.color);
  modal.innerHTML =
    `<div class="su-badge">✦ 新エピソード解放 ✦</div>` +
    `<div class="story-cg"><div class="story-cg-art">${photoOr("images/story/" + ch.id + ".png", `<span class="story-cg-sym">${cast ? cast.symbol : "🐲"}</span>`)}</div>` +
      `<div class="story-cg-cap"><span class="story-cg-tag">一枚絵</span>${ch.scene || ""}</div></div>` +
    `<div class="su-title">${ch.title}</div>` +
    (cast ? `<div class="su-cast"><span class="su-cast-sym" style="--cg:${cast.color}">${photoOr("images/cast/" + ch.cast + ".png", cast.symbol)}</span>${cast.name}<small>（${cast.tag}）</small></div>` : "") +
    `<div class="su-body">${ch.body}</div>`;
  const btn = el("button", "su-close", idx < chapters.length - 1 ? "次へ ▶" : "とじる");
  btn.onclick = () => { ov.remove(); if (idx < chapters.length - 1) showStoryUnlock(chapters, idx + 1); };
  modal.appendChild(btn);
  ov.appendChild(modal);
  document.body.appendChild(ov);
}

// (b) advisor "voice" element for a gameplay screen, or null if none met yet.
//   context "race"   → most-advanced race advisor met (Sake→Mizu→Makura→Celestia)
//   context "assets" → Sumika (lifestyle / 総資産)
function advisorVoiceEl(context) {
  const total = state.player.totalAssets || 0;
  const order = context === "assets" ? ["sumika"] : ["celestia", "makura", "mizu", "sake"];
  let key = null;
  for (const k of order) { if (STORY_RACE_VOICE[k] && total >= castUnlockAt(k)) { key = k; break; } }
  if (!key) return null;
  const c = STORY_CAST[key];
  const box = el("div", "card advisor-voice");
  box.style.setProperty("--cg", c.color);
  box.innerHTML =
    `<span class="av-sym">${c.symbol}</span>` +
    `<span class="av-body"><span class="av-name">${c.name}<small>（${c.tag}）</small></span>` +
    `<span class="av-line">${STORY_RACE_VOICE[key]}</span></span>`;
  return box;
}

// Image drop-in (1)(2): returns `fallbackHTML` plus an <img> that loads a real
// asset from `src` if present (fades in over the fallback) and removes itself on
// 404 so only the placeholder shows. See images/README.md for the convention.
function photoOr(src, fallbackHTML) {
  return fallbackHTML +
    `<img class="photo-fill" alt="" src="${src}" onload="this.classList.add('loaded')" onerror="this.remove()">`;
}

// =========================================================================
// (3) Celestia's 神眼 — opt-in consult on the race-detail screen (unlocked at
// 総資産 1億). Reveals the race winner but COLLAPSES that dragon's market odds
// (§7.3), teaching "knowing the winner ≠ growing assets". The finish ORDER is
// never altered — only this one dragon's odds for this one race change, and
// only because the player chose to ask.
// =========================================================================
function applyCelestiaCollapse(oddsResult, dragonId) {
  const od = oddsResult.oddsData.find(o => o.dragonId === dragonId);
  if (od) { od.winOdds = 1.01; od.placeOdds = Math.min(od.placeOdds, 1.01); od._celestia = true; }
  Object.keys(oddsResult.wideOdds || {}).forEach(k => {
    if (k.split("|").indexOf(dragonId) !== -1) oddsResult.wideOdds[k].odds = Math.min(oddsResult.wideOdds[k].odds, 1.01);
  });
}
function consultCelestia() {
  const c = state.current;
  if (!c || c._celestiaRevealed) return;
  if (!c._fixedResult) c._fixedResult = runRace(c.race, c.trialForms);  // fix the result so the reveal is TRUE and the race plays to it
  const winId = c._fixedResult.entries[0].dragon.id;
  applyCelestiaCollapse(c.oddsResult, winId);
  c._celestiaRevealed = winId;
  renderRaceDetail(c.race);   // re-render; the consult guard reuses the collapsed odds + fixed forms
}
function celestiaSectionEl() {
  const c = state.current;
  if (!c || !c.race) return null;
  if ((state.player.totalAssets || 0) < castUnlockAt("celestia")) return null;   // not met yet
  const cast = STORY_CAST.celestia;
  const box = el("div", "card celestia-box");
  box.style.setProperty("--cg", cast.color);
  if (c._celestiaRevealed) {
    const win = DRAGONS.find(d => d.id === c._celestiaRevealed);
    const nm = win ? win.name : "？";
    box.classList.add("revealed");
    box.innerHTML =
      `<div class="cel-head">${cast.symbol} セレスティアの神眼</div>` +
      `<div class="cel-reveal">この一戦、生き残る一頭は <b>${nm}</b>。</div>` +
      `<div class="cel-warn">……ただし答えは知れ渡った。<b>${nm}</b> の単竜オッズは弾けて消え（×1.01）、絡む複・ワイドも沈んだ。1着を知ることと、価値を残すことは違うわ。</div>`;
  } else {
    // Progressive disclosure: a compact ask button up front. Pressing it reveals the
    // catch (odds collapse) AND the real 聞く / やめる choice — so the screen isn't
    // pre-loaded with the warning before the player has opted to look.
    const renderClosed = () => {
      box.classList.remove("cel-open");
      box.innerHTML = `<div class="cel-head">${cast.symbol} セレスティアに1着を聞く</div>`;
      const ask = el("button", "cel-ask", "🔮 聞いてみる");
      ask.onclick = renderOpen;
      box.appendChild(ask);
    };
    const renderOpen = () => {
      box.classList.add("cel-open");
      box.innerHTML =
        `<div class="cel-head">${cast.symbol} セレスティアに1着を聞く</div>` +
        `<div class="cel-warn">神眼は1着を教えてくれる。ただし開示した瞬間、その竜のオッズは弾けて消える（×1.01）。それでも聞く？</div>`;
      const row = el("div", "cel-choice");
      const yes = el("button", "cel-ask", "聞く（×1.01覚悟）");
      yes.onclick = () => consultCelestia();
      const no = el("button", "cel-ask ghost", "やめておく");
      no.onclick = renderClosed;
      row.appendChild(yes); row.appendChild(no);
      box.appendChild(row);
    };
    renderClosed();
  }
  return box;
}

// =========================================================================
// Story screen (specs 31–34): a chapter reader with a 一枚絵CG placeholder slot
// per chapter (themed by the introduced advisor; ready to drop real art into
// later) + the long「件。」chapter text. Read/cosmetic only — gated by asset
// level, never touches race math.
// =========================================================================
function renderStory() {
  state.ui.screen = "story";
  recomputeAssets(state);
  const total = state.player.totalAssets;
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "ストーリー"));

  const intro = el("div", "card story-intro");
  const unlockedCount = STORY_CHAPTERS.filter(ch => total >= storyUnlockAt(ch.id)).length;
  intro.innerHTML =
    `<p class="story-intro-sub">借金まみれのバニー・ミミが、霧と火山の聖龍レース島で出会う5人と、5つの視点。総資産を育てると、新しい話が解放されます。</p>` +
    `<div class="story-progress">解放：<b>${unlockedCount}</b> / ${STORY_CHAPTERS.length} 話</div>`;
  app.appendChild(intro);

  STORY_CHAPTERS.forEach(ch => {
    const unlocked = total >= storyUnlockAt(ch.id);
    const cast = STORY_CAST[ch.cast];
    const card = el("div", "card story-chapter" + (unlocked ? "" : " locked"));

    // 一枚絵CG placeholder slot (real art can be dropped in here later)
    const cg = el("div", "story-cg" + (unlocked ? "" : " locked"));
    if (cast) cg.style.setProperty("--cg", cast.color);
    cg.innerHTML = unlocked
      ? `<div class="story-cg-art">${photoOr("images/story/" + ch.id + ".png", `<span class="story-cg-sym">${cast ? cast.symbol : "🐲"}</span>`)}</div>` +
        `<div class="story-cg-cap"><span class="story-cg-tag">一枚絵</span>${ch.scene || ""}</div>`
      : `<div class="story-cg-art"><span class="story-cg-sym">🔒</span></div>` +
        `<div class="story-cg-cap">総資産 ${fmtCoins(storyUnlockAt(ch.id))} で解放</div>`;
    card.appendChild(cg);

    card.appendChild(el("div", "story-ch-title", ch.title));

    if (unlocked) {
      if (cast) {
        const badge = el("div", "story-cast");
        badge.innerHTML =
          `<span class="story-cast-sym" style="--cg:${cast.color}">${cast.symbol}</span>` +
          `<span class="story-cast-info"><span class="story-cast-name">${cast.name}<small>（${cast.tag}）</small></span>` +
          `<span class="story-cast-gives">授けるもの：${cast.gives}</span></span>`;
        card.appendChild(badge);
      }
      card.appendChild(el("div", "story-ch-body", ch.body));
    } else {
      card.appendChild(el("div", "story-ch-locked", `総資産 ${fmtCoins(storyUnlockAt(ch.id))} に到達すると読めます。`));
    }
    app.appendChild(card);
  });

  const actions = el("div", "actions");
  const consultBtn = el("button", "secondary", "💬 相談する"); consultBtn.onclick = () => renderConsult();
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(consultBtn);
  actions.appendChild(back);
  app.appendChild(actions);
}

// =========================================================================
// 相談 (consult) screen — lists advisors met so far; each gives their
// "perspective" line (spec §10.3). Flavor only; never affects race math.
// =========================================================================
function renderConsult() {
  state.ui.screen = "consult";
  recomputeAssets(state);
  const total = state.player.totalAssets;
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "相談する"));
  app.appendChild(el("p", "consult-sub", "出会った顧問に話を聞けます。相談は「答え合わせ」ではなく「視点の切り替え」です。"));

  const list = el("div", "consult-list");
  Object.keys(STORY_CAST).forEach(k => {
    const c = STORY_CAST[k];
    const unlocked = total >= castUnlockAt(k);
    const card = el("div", "card consult-card" + (unlocked ? "" : " locked"));
    const port = el("div", "consult-port");
    port.style.setProperty("--cg", c.color);
    port.innerHTML = unlocked
      ? photoOr("images/cast/" + k + ".png", `<span class="consult-sym">${c.symbol}</span>`)
      : `<span class="consult-sym">🔒</span>`;
    card.appendChild(port);
    const body = el("div", "consult-body");
    body.innerHTML = unlocked
      ? `<div class="consult-name">${c.name}<small>（${c.tag}）</small></div>` +
        `<div class="consult-focus">${c.focus}　—　授けるもの：${c.gives}</div>` +
        `<div class="consult-line">「${c.consult}」</div>`
      : `<div class="consult-name muted">？？？</div>` +
        `<div class="consult-focus">総資産 ${fmtCoins(castUnlockAt(k))} で出会う</div>`;
    card.appendChild(body);
    list.appendChild(card);
  });
  app.appendChild(list);

  const actions = el("div", "actions");
  const storyBtn = el("button", "secondary", "📜 ストーリー"); storyBtn.onclick = () => renderStory();
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(storyBtn);
  actions.appendChild(back);
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
    <th>竜名</th><th>脚質</th><th>解放ノート</th>
    <th>見た数</th><th>勝</th><th>複圏</th>
    <th>賭けた数</th><th>的中</th><th>★</th>
  </tr></thead>`;
  const tbody = el("tbody");
  DRAGONS.forEach(d => {
    const entry = (state.player.collection || {})[d.id];
    const seen = entry && entry.seen;
    const r = entry ? entry.records : { racesSeen:0, winsSeen:0, top3Seen:0, playerBetCount:0, playerHitCount:0 };
    const notes = seen ? getCollectionNoteText(entry, d) : [];
    const tr = el("tr");
    tr.innerHTML = `
      <td><b>${seen ? d.name : "？？？"}</b></td>
      <td class="style-${d.style}">${seen ? STYLE_LABEL[d.style] : "－"}</td>
      <td class="trial-note">${notes.length ? notes.join("<br>") : "<span style=\"color:#666\">未確認</span>"}</td>
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
  app.appendChild(el("div", "condition-line", "ノート解放: 1戦=基本 / 3戦=気性 / 5戦=適性 / 2賭=市場印象 / 8戦+複圏経験=物語"));

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

// Reusable fold/expand (accordion) section — lets the player control how much of
// each info block is shown, so the bet flow isn't buried under reference data.
function uiCollapsible(headerHTML, openByDefault) {
  const wrap = el("div", "ui-collapse" + (openByDefault ? " open" : ""));
  const head = el("button", "ui-collapse-head",
    `<span class="uc-title">${headerHTML}</span><span class="uc-chev">▾</span>`);
  const body = el("div", "ui-collapse-body");
  head.onclick = () => wrap.classList.toggle("open");
  wrap.appendChild(head); wrap.appendChild(body);
  return { wrap, body };
}

function renderRaceDetail(race) {
  state.ui.screen = "race_detail";
  runEventHooks("afterRaceSelect", { race });

  // §09 §12-16 Entry encouragement opportunity (may modify entries).
  state.current = state.current || {};
  // (3) Celestia consult is per-race: reset its reveal when a NEW race opens.
  const _prevRaceId = state.current.race && state.current.race.id;
  if (_prevRaceId !== race.id) { state.current._celestiaRevealed = null; state.current._fixedResult = null; state.current._openAdvisor = null; }
  const _consultActive = !!state.current._celestiaRevealed && _prevRaceId === race.id;
  const offer = maybeOfferEntryEncouragement(race);
  if (offer) {
    state.current._encouragementOverride = offer;
    // queue the story dialogue
    offer.offer.dialogue.forEach(([speaker, text]) => showEvent(speakerLabel(speaker), text));
  } else {
    state.current._encouragementOverride = null;
  }

  // Compute odds (market simulation).
  runEventHooks("beforeEntryList", { race });
  // When Celestia's 神眼 has been consulted this race, REUSE the (collapsed)
  // odds + fixed forms so the reveal stays consistent; otherwise compute fresh.
  const oddsResult = _consultActive ? state.current.oddsResult : simulateMarket(race);
  // Generate trial-run forms shown to the player (cached so they stay
  // consistent during this race-detail session per §07 §11).
  const trialForms = _consultActive ? state.current.trialForms
    : (() => { const tf = {}; getRaceDragons(race).forEach(d => tf[d.id] = generateForm(d)); return tf; })();

  Object.assign(state.current, { race, oddsResult, trialForms, bet: _consultActive && state.current.bet ? state.current.bet : { type: "win", selections: [], wager: 100 } });
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
  // Popularity-sorted entries — shared by the pick cards and the dragon-info table.
  const sorted = [...oddsResult.oddsData].sort((a, b) => a.popularityRank - b.popularityRank);
  const betCap = RANKS[race.rank].maxWager * (VILLAGE_MULT[state.player.villageLevel] || 1.0);

  // ===== レース条件は常時表示（折りたたまない）。サケの現場眼を一言添える。 =====
  const condWrap = el("div", "race-conditions-always");
  const _sakeV = advVoiceHeader("sake"); if (_sakeV) condWrap.appendChild(_sakeV);
  condWrap.appendChild(info);
  app.appendChild(condWrap);

  // ===== Advisor hub — character "marks" up top, each opening ONE focused panel
  // below. Nothing opens until the player taps a face (progressive disclosure);
  // each lens lives where its mentor would give it:
  //   ミズ＝分析予想 ／ マクラ＝竜の力と試走 ／ スミカ＝賭け金の目安 ／ セレスティア＝神眼。
  // (レース条件は上に常時表示。) Core handicapping info is ALWAYS reachable; meeting an
  // advisor only adds their voice. Mizu's analysis & Celestia's reveal stay gated. =====
  app.appendChild(buildAdvisorHub());

  // -- advisor voice line, shown atop a panel once that advisor has been met --
  function advVoiceHeader(key) {
    const cast = STORY_CAST[key];
    if (!cast || (state.player.totalAssets || 0) < castUnlockAt(key)) return null;
    const v = el("div", "adv-voice");
    v.style.setProperty("--cg", cast.color);
    v.innerHTML =
      `<span class="adv-voice-sym">${cast.symbol}</span>` +
      `<span class="adv-voice-body"><span class="adv-voice-name">${cast.name.split("・")[0]}<small>（${cast.tag}）</small></span>` +
      `<span class="adv-voice-line">${STORY_RACE_VOICE[key] || cast.consult}</span></span>`;
    return v;
  }

  // -- the hub itself: a row of advisor marks + a single panel host below --
  function buildAdvisorHub() {
    const ADVS = [
      { key: "mizu",     label: "分析予想",     build: buildMizuPanel, gated: true },
      { key: "makura",   label: "ドラゴン情報", build: buildDragonPanel },
      { key: "sumika",   label: "財政状況",     build: buildFinancePanel },
      { key: "celestia", label: "1着を聞く",    build: buildCelestiaPanel, gated: true },
    ];
    const hub = el("div", "advisor-hub");
    hub.appendChild(el("div", "adv-hub-cap", "🎴 相談役をタップすると、その視点だけが開きます"));
    const tabRow = el("div", "adv-tabs");
    const host = el("div", "adv-panel-host");
    const btnByKey = {};
    ADVS.forEach(a => {
      const cast = STORY_CAST[a.key];
      const locked = a.gated && (state.player.totalAssets || 0) < castUnlockAt(a.key);
      const b = el("button", "adv-tab" + (locked ? " locked" : ""));
      b.dataset.key = a.key;
      b.style.setProperty("--cg", cast.color);
      b.innerHTML =
        `<span class="adv-mark">${locked ? "🔒" : cast.symbol}</span>` +
        `<span class="adv-tab-label">${a.label}</span>` +
        `<span class="adv-tab-name">${cast.name.split("・")[0]}</span>`;
      b.onclick = () => setOpen(state.current._openAdvisor === a.key ? null : a.key);
      btnByKey[a.key] = b;
      tabRow.appendChild(b);
    });
    hub.appendChild(tabRow);
    hub.appendChild(host);
    function setOpen(key) {
      state.current._openAdvisor = key || null;
      Object.keys(btnByKey).forEach(k => btnByKey[k].classList.toggle("active", k === key));
      host.innerHTML = "";
      host.classList.toggle("open", !!key);
      if (key) {
        const a = ADVS.find(x => x.key === key);
        if (a) { const p = a.build(); if (p) host.appendChild(p); }
      }
    }
    setOpen(state.current._openAdvisor || null);   // restore across same-race re-renders
    return hub;
  }

  // -- ミズ：分析予想パネル — 人気の理由を分解→はがした実力評価で本命/対抗/穴。
  //    総資産3000でミズと出会うまではロック表示（彼女の章「ミズの分析予想」に対応）。 --
  function buildMizuPanel() {
    const unlocked = (state.player.totalAssets || 0) >= castUnlockAt("mizu");
    if (!unlocked) {
      const cast = STORY_CAST.mizu;
      const wrap = el("div", "card adv-panel adv-locked mizu-locked");
      wrap.style.setProperty("--cg", cast.color);
      wrap.innerHTML =
        `<div class="cel-lock-row"><span class="cel-lock-sym">🔒</span>` +
        `<div class="cel-lock-body"><div class="cel-lock-title">ミズの分析予想は、まだ読めない</div>` +
        `<div class="cel-lock-sub">総資産 ${fmtCoins(castUnlockAt("mizu"))} でミズと出会うと、人気の理由を分解した本命・対抗・穴が読めます。</div></div></div>`;
      return wrap;
    }
    const a = generateMizuAnalysis(race, oddsResult, state.current.trialForms);
    const wrap = el("div", "card adv-panel mizu-panel");
    const v = advVoiceHeader("mizu"); if (v) wrap.appendChild(v);
    // 人気の理由を分解（はがす前）
    const pop = el("div", "mz-pop");
    pop.innerHTML = `<div class="mz-h">人気の理由を分解</div>` +
      a.popular.map(p =>
        `<div class="mz-pop-row${p.overhyped ? " over" : ""}">` +
        `<span class="mz-pop-rank">${p.popRank}番人気</span>` +
        `<span class="mz-pop-body"><b>${p.name}</b><span class="mz-pop-reason">${p.reason}</span></span>` +
        `<span class="mz-pop-verdict">${p.verdict}</span></div>`
      ).join("");
    wrap.appendChild(pop);
    // はがした上での本命・対抗・穴
    const picks = el("div", "mz-picks");
    const card = (role, label, p) =>
      `<div class="mz-pick ${role}">` +
      `<span class="mz-badge">${label}</span>` +
      `<span class="mz-pick-main"><b>${p.name}</b>` +
      `<span class="mz-pick-meta">${p.popRank}番人気・単${p.winOdds.toFixed(1)}・${p.style}</span>` +
      `<span class="mz-pick-why">${p.why}</span></span></div>`;
    picks.innerHTML = `<div class="mz-h">人気をはがした、私の予想</div>` +
      card("honmei", "◎ 本命", a.honmei) +
      card("taikou", "○ 対抗", a.taikou) +
      card("ana", "★ 穴", a.ana);
    wrap.appendChild(picks);
    wrap.appendChild(el("div", "mz-foot", "※ オッズは観客の願望が混ざった値。これは公開情報からの実力評価による予想で、的中を保証するものではありません。"));
    return wrap;
  }

  // -- スミカ：財政状況パネル（所持金から賭け金の目安を提案。タップで賭金へセット） --
  function buildFinancePanel() {
    const wrap = el("div", "card adv-panel fin-panel");
    const v = advVoiceHeader("sumika"); if (v) wrap.appendChild(v);
    const coins = Math.max(0, Math.floor(state.player.coins));
    const cap = Math.floor(betCap);
    const head = el("div", "fin-head");
    head.innerHTML =
      `<div class="fin-stat"><span class="fin-k">所持金</span><span class="fin-v">${fmtCoins(coins)}</span></div>` +
      `<div class="fin-stat"><span class="fin-k">この一戦の上限</span><span class="fin-v">${fmtCoins(cap)}</span></div>`;
    wrap.appendChild(head);
    wrap.appendChild(el("div", "fin-lead", "いまの所持金から、無理なく賭けられる目安です。タップすると賭金にセットします。"));
    const tiers = [
      { label: "手堅く",     pct: 0.05, cls: "t-safe", note: "日々を切らさない最小の勝負" },
      { label: "ほどほど",   pct: 0.10, cls: "t-mid",  note: "生活と両立する標準の賭け" },
      { label: "勝負どころ", pct: 0.20, cls: "t-bold", note: "自信があるときの上限目安" },
    ];
    const amtOf = pct => Math.max(1, Math.min(Math.floor(coins * pct), cap, coins));
    const row = el("div", "fin-tiers");
    const tip = el("div", "fin-tip");
    tiers.forEach(t => {
      const amt = amtOf(t.pct);
      const b = el("button", "fin-tier " + t.cls);
      b.innerHTML =
        `<span class="ft-label">${t.label}</span>` +
        `<span class="ft-amt">${fmtCoins(amt)}</span>` +
        `<span class="ft-pct">所持の${Math.round(t.pct * 100)}%</span>` +
        `<span class="ft-note">${t.note}</span>`;
      b.onclick = () => {
        if (typeof setWager === "function") setWager(amt);   // keeps slider + chips in sync
        else { const w = $("wager"); if (w) w.value = amt; if (typeof updateExpected === "function") updateExpected(); }
        row.querySelectorAll(".fin-tier").forEach(x => x.classList.remove("chosen"));
        b.classList.add("chosen");
        const need = !(state.current.betSel && state.current.betSel.length);
        tip.textContent = `賭金を ${fmtCoins(amt)} コインにセット。${need ? "本命を選んでから" : ""}「賭ける」へ進めます。`;
      };
      row.appendChild(b);
    });
    wrap.appendChild(row);
    wrap.appendChild(tip);
    wrap.appendChild(el("div", "fin-caution", "全額は賭けない——余力が、次の一戦を生みます。"));
    return wrap;
  }

  // -- セレスティア：1着を聞く（解放済みなら2段階の神眼、未解放ならロック表示） --
  function buildCelestiaPanel() {
    const unlocked = (state.player.totalAssets || 0) >= castUnlockAt("celestia");
    if (unlocked) { const cel = celestiaSectionEl(); if (cel) return cel; }
    const cast = STORY_CAST.celestia;
    const wrap = el("div", "card adv-panel cel-locked");
    wrap.style.setProperty("--cg", cast.color);
    wrap.innerHTML =
      `<div class="cel-lock-row"><span class="cel-lock-sym">🔒</span>` +
      `<div class="cel-lock-body"><div class="cel-lock-title">セレスティアの神眼は、まだ開かない</div>` +
      `<div class="cel-lock-sub">総資産 ${fmtCoins(castUnlockAt("celestia"))} に届くと、この一戦の1着を聞けるようになります。</div></div></div>`;
    return wrap;
  }

  // ===== Betting panel — placed FIRST so the primary action needs no scrolling.
  // Selection is a grid of tappable dragon cards that fold the key handicapping
  // info (人気・脚質・単/複オッズ・印・近走) into the very thing you tap, so the
  // player reads-and-picks in one place instead of cross-referencing a dropdown.
  app.appendChild(el("h3", null, "賭けパネル"));
  // Wager bounds for the tap/drag stake controls (no number-typing required).
  const effMax = Math.max(1, Math.floor(Math.min(betCap, state.player.coins)));
  const wagerInit = Math.max(1, Math.min((_consultActive && state.current.bet && state.current.bet.wager) || Math.min(100, effMax), effMax));
  const panel = el("div", "card bet-panel");
  panel.innerHTML = `
    <div class="bet-tabs">
      <button data-type="win" class="active">単竜<small>1着</small></button>
      <button data-type="place">複竜<small>3着以内</small></button>
      <button data-type="wide">ワイド竜<small>2頭が3着以内</small></button>
    </div>
    <div class="bet-pick">
      <div class="bet-pick-head">
        <span id="pick-instruction"></span>
        <span class="pick-count" id="pick-count"></span>
      </div>
      <div class="bet-pick-grid" id="bet-pick-grid"></div>
    </div>
    <div class="bet-step1" id="bet-step1">
      <button id="bet-start" class="bet-start-btn" disabled>🐉 この本命で賭ける</button>
      <button id="back-race-select" class="secondary">戻る</button>
    </div>
    <div class="bet-step2" id="bet-step2" style="display:none">
      <div class="wager-box">
        <div class="wager-head">
          <span class="wager-label">賭金</span>
          <span class="wager-amount"><input id="wager" class="wager-big" type="text" inputmode="numeric" value="${wagerInit}"><span class="wager-unit">コイン</span></span>
        </div>
        <div class="wager-slider-row">
          <button class="wager-step" id="wager-minus" type="button" aria-label="減らす">−</button>
          <input id="wager-slider" class="wager-slider" type="range" min="1" max="${effMax}" step="1" value="${wagerInit}">
          <button class="wager-step" id="wager-plus" type="button" aria-label="増やす">＋</button>
        </div>
        <div class="wager-quick" id="wager-chips"></div>
      </div>
      <div class="payout-box empty" id="expected-payout"><div class="po-hint">賭金を選ぶと払戻が表示されます</div></div>
      <div class="actions">
        <button id="bet-confirm" disabled>この内容で出走</button>
        <button id="bet-cancel" class="secondary">やめる</button>
      </div>
    </div>
    <div class="condition-line">所持: ${fmtCoins(state.player.coins)}コイン ／ 上限賭金: ${fmtCoins(betCap)}<span class="cl-note">（村Lv${state.player.villageLevel}補正込）</span></div>
  `;
  app.appendChild(panel);

  // ---- tappable dragon selection (replaces the sel-a/sel-b dropdowns) ----
  // Preserve the in-progress pick across a Celestia consult re-render — otherwise
  // asking 神眼 would silently wipe the player's already-tapped selection.
  state.current.betSel = (_consultActive && state.current.bet && state.current.bet.selections)
    ? state.current.bet.selections.slice() : [];      // selected ids, in pick order
  const pickGrid = $("bet-pick-grid");
  const pickCardById = {};
  const maxSelFor = type => (type === "wide" ? 2 : 1);
  const pickInstruction = type =>
    type === "wide" ? "3着以内に入る2頭をタップ"
      : type === "place" ? "3着以内に入る本命を1頭タップ"
        : "1着になる本命を1頭タップ";

  function renderPickState() {
    const type = state.current.bet.type;
    const max = maxSelFor(type);
    const sel = state.current.betSel;
    sorted.forEach(od => {
      const card = pickCardById[od.dragonId];
      const at = sel.indexOf(od.dragonId);
      card.classList.toggle("selected", at >= 0);
      card.setAttribute("aria-pressed", at >= 0 ? "true" : "false");
      const ord = card.querySelector(".bp-order");
      if (at >= 0) { ord.textContent = max > 1 ? (at === 0 ? "①" : "②") : "✓"; ord.style.display = "flex"; }
      else ord.style.display = "none";
      card.querySelector(".bp-win").classList.toggle("dim", type === "place");
      card.querySelector(".bp-place").classList.toggle("dim", type === "win");
    });
    $("pick-instruction").textContent = pickInstruction(type);
    $("pick-count").textContent = `${sel.length} / ${max}`;
    const complete = sel.length === max;
    const startBtn = $("bet-start");
    if (startBtn) startBtn.disabled = !complete;
    if (!complete) showBetStep(1);   // pick broke → fold the wager step back away
  }

  function togglePick(id) {
    const sel = state.current.betSel;
    const max = maxSelFor(state.current.bet.type);
    const at = sel.indexOf(id);
    if (at >= 0) sel.splice(at, 1);                   // tap again to deselect
    else { if (sel.length >= max) sel.shift(); sel.push(id); }  // drop oldest when full
    renderPickState();
    updateExpected();
  }

  sorted.forEach(od => {
    const d = DRAGONS.find(x => x.id === od.dragonId);
    const rk = od.popularityRank;
    const card = el("button", "bet-pick-card");
    card.type = "button";
    card.dataset.id = d.id;
    card.innerHTML = `
      <span class="bp-order" style="display:none"></span>
      <span class="bp-pop p${rk <= 3 ? rk : ""}">${rk}<small>人気</small></span>
      <span class="bp-main">
        <span class="bp-name"><span class="dragon-icon" style="background:${dragonColor(d)}">${d.name.charAt(0)}</span>${d.name}</span>
        <span class="bp-sub"><span class="style-${d.style}">${STYLE_LABEL[d.style]}</span>${d.newspaperMark ? `<span class="bp-mark">${d.newspaperMark}</span>` : ""}<span class="bp-form">${recentResultLabel(d.recentResult)}</span></span>
        <span class="bp-traits">${d.traits.join("・")}</span>
      </span>
      <span class="bp-odds">
        <span class="bp-win"><b>${od.winOdds.toFixed(1)}</b><small>単</small></span>
        <span class="bp-place"><b>${od.placeOdds.toFixed(1)}</b><small>複</small></span>
      </span>
    `;
    card.onclick = () => togglePick(d.id);
    pickCardById[d.id] = card;
    pickGrid.appendChild(card);
  });

  // Tabs — switch bet type, trimming the selection to the new max.
  panel.querySelectorAll(".bet-tabs button").forEach(btn => {
    btn.onclick = () => {
      panel.querySelectorAll(".bet-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.current.bet.type = btn.dataset.type;
      const max = maxSelFor(btn.dataset.type);
      if (state.current.betSel.length > max) state.current.betSel = state.current.betSel.slice(0, max);
      runEventHooks("beforeBet", { race, bet: state.current.bet });
      showBetStep(1);
      renderPickState();
      updateExpected();
    };
  });
  // Two-step bet: pick → 賭ける (commit) → wager + 出走/やめる. Keeps the wager UI
  // hidden until the player has decided to bet, so the panel reads cleanly.
  function showBetStep(n) {
    const s1 = $("bet-step1"), s2 = $("bet-step2");
    if (s1) s1.style.display = n === 1 ? "" : "none";
    if (s2) s2.style.display = n === 2 ? "" : "none";
  }
  // ---- Stake controls: slider + −/+ stepper + fraction chips. Tap or drag to set
  // the wager — no number-typing needed. The field stays editable for power users
  // but is NEVER auto-focused, so the mobile keyboard no longer pops up on every bet. ----
  const stepAmt = betStepSize(effMax);
  const wagerCur = () => { const n = parseInt(String($("wager").value || "").replace(/[^0-9]/g, ""), 10); return Number.isNaN(n) ? 0 : n; };
  function setWager(v) {
    v = Math.round(v); if (Number.isNaN(v)) v = 0;
    v = Math.max(1, Math.min(v, effMax));
    const w = $("wager"); if (w) w.value = v;
    const sl = $("wager-slider"); if (sl) sl.value = v;
    const cg = $("wager-chips"); if (cg) cg.querySelectorAll(".wchip").forEach(c => c.classList.toggle("chosen", +c.dataset.amt === v));
    updateExpected();
  }
  $("wager-slider").oninput = () => setWager(+$("wager-slider").value);
  $("wager-minus").onclick = () => setWager(wagerCur() - stepAmt);
  $("wager-plus").onclick = () => setWager(wagerCur() + stepAmt);
  $("wager").oninput = () => {                         // optional manual typing
    const n = wagerCur(); const sl = $("wager-slider");
    if (sl && n >= 1) sl.value = Math.min(n, effMax);
    updateExpected();
  };
  $("wager").onblur = () => setWager(wagerCur());       // clamp once they finish typing
  const chipsEl = $("wager-chips");
  [{ l: "¼", a: Math.round(effMax * 0.25) }, { l: "½", a: Math.round(effMax * 0.5) }, { l: "最大", a: effMax }].forEach(c => {
    const amt = Math.max(1, Math.min(c.a, effMax));
    const chip = el("button", "wchip");
    chip.type = "button"; chip.dataset.amt = amt;
    chip.innerHTML = `<span class="wchip-amt">${fmtCoins(amt)}</span><span class="wchip-sub">${c.l}</span>`;
    chip.onclick = () => setWager(amt);
    chipsEl.appendChild(chip);
  });

  $("bet-confirm").onclick = onConfirmBet;
  $("back-race-select").onclick = renderRaceSelect;
  $("bet-start").onclick = () => { showBetStep(2); setWager(wagerCur()); };
  $("bet-cancel").onclick = () => showBetStep(1);

  renderPickState();
  updateExpected();   // initial payout hint + confirm-disabled state

  // -- マクラ：ドラゴン情報パネル — 出走表 / 試走 / 妙味 をタブで1つずつ。中身は常に
  //    見られる中核情報。マクラと出会うと彼女の声が上に乗る。 --
  function buildDragonPanel() {
    const wrap = el("div", "card adv-panel");
    const v = advVoiceHeader("makura"); if (v) wrap.appendChild(v);
    const showTrial = state.ui.infoLevel !== "simple";
    const showValue = state.ui.infoLevel === "advanced" || state.ui.infoLevel === "expert";
    const anaTabs = el("div", "ana-tabs");
    anaTabs.innerHTML =
      `<button data-pane="form" class="active">出走表</button>` +
      (showTrial ? `<button data-pane="trial">試走</button>` : "") +
      (showValue ? `<button data-pane="value">妙味</button>` : "");
    wrap.appendChild(anaTabs);

    // -- pane: 出走表 (entry table) --
    const paneForm = el("div", "ana-pane active"); paneForm.dataset.pane = "form";
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
    paneForm.appendChild(tbl);
    wrap.appendChild(paneForm);

    // -- pane: 試走サマリー (standard+) --
    if (showTrial) {
      const paneTrial = el("div", "ana-pane"); paneTrial.dataset.pane = "trial";
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
      paneTrial.appendChild(trialTbl);
      wrap.appendChild(paneTrial);
    }

    // -- pane: 妙味の手がかり (advanced/expert) --
    if (showValue) {
      const paneValue = el("div", "ana-pane"); paneValue.dataset.pane = "value";
      const hints = generateValueHints(race, oddsResult, state.current.trialForms);
      hints.forEach(h => paneValue.appendChild(el("div", "value-hint", h)));
      wrap.appendChild(paneValue);
    }

    // tab wiring — switch the visible pane (scoped to THIS panel)
    anaTabs.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        anaTabs.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        wrap.querySelectorAll(".ana-pane").forEach(p => p.classList.toggle("active", p.dataset.pane === btn.dataset.pane));
      };
    });
    return wrap;
  }

}

// §11 §19 placeholder dragon icon — colored disc + name initial.
function dragonIconPlaceholder(d) {
  const color = dragonColor(d);
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

// ミズの分析予想 — 人気の理由を（公開情報の）成分に分解し、人気バイアスを「はがした」
// 実力評価から本命・対抗・穴を出す。fit は generateValueHints と同じ公開情報ベースの
// 合成値（持ち能力・コース適性・天候・調子）で、レース結果や「このレースで効く力」を
// 明かすものではない＝予想であって正解ではない。
function generateMizuAnalysis(race, oddsResult, trialForms) {
  const items = getRaceDragons(race).map(d => {
    const cp = coursePower(d, race);
    const wp = weightedStat(d.stats, WEATHERS[race.weather].weights);
    const fp = formPower(trialForms[d.id]);
    const fit = basePower(d) * 0.35 + cp.total * 0.20 + wp * 0.10 + fp * 0.15;
    const od = oddsResult.oddsData.find(o => o.dragonId === d.id) || {};
    return { d, fit, pop: od.popularityPower || 0, popRank: od.popularityRank || 99,
             winOdds: od.winOdds || 0, comp: od.components || {} };
  });
  const byFit = [...items].sort((a, b) => b.fit - a.fit);
  byFit.forEach((it, i) => { it.fitRank = i + 1; });
  const byPop = [...items].sort((a, b) => a.popRank - b.popRank);

  // why a favorite is popular — pick the strongest VISIBLE driver (incl. pure hype)
  const reasonFor = it => {
    const c = it.comp, d = it.d, cands = [];
    if ((d.recentResult || 60) >= 88) cands.push(["前走勝ち級の勢い", 3.0]);
    else if ((d.recentResult || 60) >= 74) cands.push(["前走の好走", 2.6]);
    if (d.newspaperMark === "◎") cands.push(["新聞の本命◎印", 2.4]);
    else if (d.newspaperMark === "○") cands.push(["新聞の対抗○印", 2.0]);
    if ((c.visiblePower || 0) >= 72) cands.push(["持ち数字の高さ", 1.9]);
    if ((c.fanBias || 0) >= 68 || (c.publicImage || 0) >= 68) cands.push(["ファン人気・知名度", 1.6]);
    if ((c.courseReputation || 0) >= 72) cands.push(["コース実績の評判", 1.3]);
    if ((c.formImpression || 0) >= 70) cands.push(["パドックの好調感", 1.1]);
    cands.sort((x, y) => y[1] - x[1]);
    return cands.length ? cands[0][0] : "全体的な安定感";
  };
  // Compare ability RANK vs popularity RANK — robust to the fit/pop scale gap
  // (pop weights sum to 1.0, fit to 0.8, so raw pop−fit is always positive).
  const popular = byPop.slice(0, 3).map(it => {
    const gap = it.fitRank - it.popRank;             // +: popularity ahead of ability
    return {
      name: it.d.name, popRank: it.popRank, winOdds: it.winOdds, reason: reasonFor(it),
      overhyped: gap >= 2,
      verdict: gap >= 2 ? `実力評価は${it.fitRank}番手——人気先行`
        : gap <= -1 ? "人気以上に実力上位"
          : "支持に実力が伴う"
    };
  });

  // peel popularity away → rank by ability; 穴 = most undervalued among the unpopular
  const honmei = byFit[0], taikou = byFit[1];
  const anaPool = items.filter(it => it.popRank >= 4 && it !== honmei && it !== taikou);
  const ana = anaPool.length
    ? anaPool.slice().sort((x, y) => (y.popRank - y.fitRank) - (x.popRank - x.fitRank))[0]
    : (byFit.find(it => it !== honmei && it !== taikou) || byFit[2] || byFit[0]);

  const why = (it, role) =>
    role === "honmei" ? `実力評価1番手。${it.popRank <= 2 ? "人気でも中身が伴う" : "人気以上の総合力"}。`
      : role === "taikou" ? "実力評価2番手。展開ひとつで逆転も。"
        : `市場は${it.popRank}番人気と低評価だが、実力評価は${it.fitRank}番手。妙味は十分。`;
  const fmt = (it, role) => ({ name: it.d.name, popRank: it.popRank, winOdds: it.winOdds,
                               style: STYLE_LABEL[it.d.style], why: why(it, role) });
  return { popular, honmei: fmt(honmei, "honmei"), taikou: fmt(taikou, "taikou"), ana: fmt(ana, "ana") };
}

function recentResultLabel(v) {
  if (v >= 90) return "前走◎";
  if (v >= 75) return "好走";
  if (v >= 55) return "普通";
  return "凡走";
}

// Stake stepper increment — a "nice" round step scaled to the effective max, so
// the −/+ buttons feel right whether this race's cap is 100 or 1,000,000.
function betStepSize(max) {
  if (max <= 50) return 5;
  if (max <= 200) return 10;
  if (max <= 1000) return 50;
  if (max <= 5000) return 100;
  if (max <= 20000) return 500;
  if (max <= 100000) return 1000;
  if (max <= 1000000) return 10000;
  return Math.max(1, Math.round(max / 100));
}

function updateExpected() {
  const c = state.current;
  const type = document.querySelector(".bet-tabs button.active").dataset.type;
  const sel = c.betSel || [];                         // tappable-card selection (pick order)
  const a = sel[0] || "";
  const b = sel[1] || "";
  const wager = parseInt($("wager").value, 10);
  c.bet = { type, selections: type === "wide" ? [a, b] : [a], wager: Number.isNaN(wager) ? 0 : wager };

  const box = $("expected-payout");
  const confirmBtn = $("bet-confirm");
  box.style.color = "";                             // clear any prior inline error tint
  box.classList.remove("empty", "valid", "invalid");
  const setHint = (cls, msg) => {
    box.classList.add(cls);
    box.innerHTML = `<div class="po-hint">${msg}</div>`;
    if (confirmBtn) confirmBtn.disabled = true;
  };

  // 1) incomplete selection → friendly prompt, confirm stays disabled
  if (!(a && (type !== "wide" || b))) {
    setHint("empty", (type === "wide" ? "2頭" : "竜") + "と賭金を選ぶと払戻が表示されます");
    return;
  }
  // 2) validation (wager range / coins / cap / duplicate) → inline reason
  const err = validateBet(c.bet, c.race);
  if (err) { setHint("invalid", err); return; }
  // 3) valid → structured odds / payout / profit readout
  let odds, payout;
  try {
    odds = betOdds(c.bet, c.oddsResult);
    payout = Math.floor(c.bet.wager * odds);
  } catch (e) { setHint("invalid", "オッズ計算エラー"); return; }
  box.classList.add("valid");
  box.innerHTML =
    `<div class="po-line"><span class="pl-k">オッズ</span><span class="pl-v">${odds.toFixed(1)} 倍</span></div>` +
    `<div class="po-line"><span class="pl-k">的中時払戻</span><span class="pl-v">${fmtCoins(payout)} コイン</span></div>` +
    `<div class="po-line po-profit"><span class="pl-k">利益（上乗せ）</span><span class="pl-v">+${fmtCoins(payout - c.bet.wager)}</span></div>`;
  if (confirmBtn) confirmBtn.disabled = false;
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
  // (3) reuse the result Celestia's 神眼 already fixed, so the reveal stays true.
  const raceResult = c._fixedResult || runRace(c.race, c.trialForms);
  // Spec #27: broadcast cache invalidated for each new race run.
  c.broadcast = null; c.commentary = null; c.broadcastState = null;
  // Canvas-race rebuild: drop the old timeline + stop any running player.
  c.timeline = null;
  if (typeof stopRacePlayer === "function") stopRacePlayer();
  // Spec #29: recap is rebuilt per race; result-screen hooks fire once.
  // Spec #37: the win-moment celebration also re-arms for the new race.
  c.recap = null; c.recapTab = "result"; c.resultHooksRan = false; c.celebrated = false;
  c.raceResult = raceResult;
  c._fixedResult = null; c._celestiaRevealed = null;   // consult is consumed by the run
  const betResult = resolveBet(c.bet, raceResult, c.oddsResult);
  c.betResult = betResult;
  // Defer the payout + all result-derived progression to the result screen so
  // watching the race never spoils the outcome via the coin counter. settleRace()
  // runs exactly once on 答え合わせ. The up-front wager deduction is already saved.
  c.settled = false;
  // Durability: persist the owed payout so an abandoned race (reload/close mid-watch)
  // is still credited on next load — state.current itself is not persisted.
  state.player.pendingPayout = (c.betResult && c.betResult.payout) || 0;
  saveGame();
  renderRaceRun();
}

// §settlement (477a0b7) — apply the race outcome to the wallet + progression
// exactly once, when the result screen (答え合わせ) is reached. Kept out of
// onConfirmBet so the coin counter doesn't reveal the result before the player
// watches the race. state.current is not persisted, so no reload double-settle.
function settleRace() {
  const c = state.current;
  if (c.settled || !c.betResult || !c.raceResult) return;
  c.settled = true;
  state.player.pendingPayout = 0;   // consumed normally — nothing to reconcile on next load
  const betResult = c.betResult, raceResult = c.raceResult;
  // Award payout
  state.player.coins += betResult.payout;
  state.player.completedRaces += 1;
  state.player.completedByRank[c.race.rank] = (state.player.completedByRank[c.race.rank] || 0) + 1;
  if (betResult.hit && c.bet.type === "win") {
    state.player.wins += 1;
    state.player.winsByRank[c.race.rank] = (state.player.winsByRank[c.race.rank] || 0) + 1;
  }
  updateCollectionFromRace(raceResult, c.bet, betResult);
  gainVillageExp(c.race, betResult && betResult.hit, raceResult._newDragonsThisRace || 0);
  checkEconomyMilestones(betResult);
  checkRankProgression();
  // §30 — update total-asset progression from the payout (after coins/village/
  // rank/collection have settled). maxCoinsReached + 総資産 only ever rise.
  bumpMaxCoins();
  const prevStage = state.assets.unlockedLifeStages || 0;
  const prevTotal = state.player.totalAssets || 0;
  const ra = recomputeAssets(state);
  const newTotal = state.player.totalAssets || 0;
  // (a) story: any chapter whose 総資産 threshold was crossed THIS race pops up.
  const justUnlocked = STORY_CHAPTERS.filter(ch => prevTotal < storyUnlockAt(ch.id) && newTotal >= storyUnlockAt(ch.id));
  if (ra.level > prevStage || justUnlocked.length) {
    runEventHooks("onStoryUnlock", { stage: ra.level, chapter: ra.unlockedStory, chapters: justUnlocked });
  }
  saveGame();
  updateHeader();
  if (justUnlocked.length) showStoryUnlock(justUnlocked);   // popup over the result screen
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

// =========================================================================
// Spec #27: Phase-based pixel race broadcast
// =========================================================================

// Comfortable race-call cadence: ~1 short line per 1.1 seconds at 1x.
// Specs §27 §9.3 imply 6-18 lines per phase, so a 5-phase race fits roughly
// 50-80 lines → 60-90 seconds at 1x with no input required.
const AUTO_TICK_MS = 1100;

/**
 * In-race view (rebuilt as a continuous <canvas> race).
 *
 * The numerical result is decided already; here we only VISUALISE it. We still
 * build the broadcast + commentary (the recap & telop read them), then build a
 * continuous timeline (race_timeline_engine.js) whose finish order is guaranteed
 * identical to raceResult, and hand it to the canvas player (race_canvas.js).
 */
function renderRaceRun() {
  state.ui.screen = "race_run";
  const c = state.current;
  // If a player is already animating this race, don't tear it down on an
  // incidental rerender (e.g. the debug / info-level toggles call us again).
  if (c.racePlayer && document.getElementById("race-canvas-host")) return;

  if (!c.broadcast) {
    c.broadcast = buildBroadcastData(c.race, c.raceResult, c.bet, c.oddsResult);
    c.commentary = buildAllCommentary(c.broadcast, { race: c.race, bet: c.bet, oddsResult: c.oddsResult, raceResult: c.raceResult });
  }
  if (!c.timeline) {
    c.timeline = buildRaceTimeline(c.race, c.raceResult, c.oddsResult, c.bet);
  }
  const app = $("app"); app.innerHTML = "";
  const host = el("div"); host.id = "race-canvas-host";
  app.appendChild(host);
  startRaceCanvas(host, {
    race: c.race, raceResult: c.raceResult, oddsResult: c.oddsResult, bet: c.bet,
    betResult: c.betResult,
    timeline: c.timeline, commentary: c.commentary, broadcast: c.broadcast
  });
}

function stopAutoTimer() {
  const bs = state.current && state.current.broadcastState;
  if (bs && bs.timer) { clearTimeout(bs.timer); bs.timer = null; }
  // Canvas race player cleanup (RAF loop + listeners).
  if (typeof stopRacePlayer === "function") stopRacePlayer();
}

function startAutoTimer() {
  const bs = state.current && state.current.broadcastState;
  if (!bs) return;
  stopAutoTimer();
  if (!bs.autoMode) return;
  scheduleNextTick();
}

// §28 §5.2: each phase has its own telop tempo (faster near the finish), so we
// reschedule a one-shot timer using the CURRENT phase's tempoMs rather than a
// fixed interval.
function scheduleNextTick() {
  const c = state.current;
  const bs = c && c.broadcastState;
  if (!bs || !bs.autoMode) return;
  const q = c.commentary[bs.phaseIdx];
  const tempo = (q && q.tempoMs) ? q.tempoMs : AUTO_TICK_MS;
  bs.timer = setTimeout(autoTick, Math.max(140, tempo / bs.speed));
}

function autoTick() {
  const c = state.current;
  const bs = c && c.broadcastState;
  if (!bs) return;
  bs.timer = null;
  if (state.ui.screen !== "race_run") { stopAutoTimer(); return; }
  // Pause while a Mimi/Sake event overlay is showing so we don't talk over it.
  const overlay = document.getElementById("event-overlay");
  if (overlay && !overlay.classList.contains("hidden")) { scheduleNextTick(); return; }
  // End-of-race: stop auto and wait for the user to click "結果を見る".
  const lastPhaseIdx = c.broadcast.phases.length - 1;
  if (bs.phaseIdx === lastPhaseIdx
      && bs.lineIdx >= c.commentary[lastPhaseIdx].lines.length - 1) {
    bs.autoMode = false;
    renderBroadcastScreen();
    return;
  }
  stepLineOrPhase();
  scheduleNextTick();
}

/**
 * Renders/updates the broadcast screen.
 *
 * Two-pass rendering:
 *  1. First call: build the persistent shell (header / scene with 8 dragon
 *     nodes / rank bar / bet / mimi / controls / log).
 *  2. Subsequent calls (and every phase change): update positions, classes,
 *     and content WITHOUT rebuilding DOM, so CSS transitions can animate
 *     "passing / being passed" position changes.
 */
function renderBroadcastScreen() {
  const c = state.current;
  let wrap = document.getElementById("broadcast-wrap");
  if (!wrap || wrap.dataset.raceId !== c.race.id) {
    wrap = buildBroadcastShell(c);
    const app = $("app"); app.innerHTML = "";
    app.appendChild(wrap);
  }
  updateBroadcastFrame(wrap, c);
}

function buildBroadcastShell(c) {
  const wrap = el("div", "broadcast-wrap");
  wrap.id = "broadcast-wrap";
  wrap.dataset.raceId = c.race.id;
  wrap.innerHTML = `
    <div id="bc-header" class="broadcast-header"></div>
    <div id="bc-scene" class="broadcast-scene"></div>
    <div id="bc-rankbar" class="broadcast-rank-bar"></div>
    <div id="bc-bet" class="broadcast-bet" style="display:none"></div>
    <div id="bc-mimi" class="broadcast-mimi">
      <div class="avatar"></div><div class="lines" id="mimi-lines"></div>
    </div>
    <div id="bc-controls" class="broadcast-controls"></div>
    <div id="bc-log" class="broadcast-log" style="display:none"></div>
  `;
  // Layered parallax backdrop (a night dragon-racing stadium). Sits behind the
  // dragons; common to the horizontal camera modes, faded out for the vertical
  // perspective cameras (which paint their own receding road). Pure CSS in
  // style.css under `.scene-bg`.
  const scene = wrap.querySelector("#bc-scene");
  scene.innerHTML = `
    <div class="scene-bg" aria-hidden="true">
      <div class="sky"></div>
      <div class="ridge"></div>
      <div class="moon"></div>
      <div class="tower"></div>
      <div class="skyline"></div>
      <div class="crowd"></div>
      <div class="rail"></div>
      <div class="track"></div>
      <div class="vignette"></div>
    </div>`;
  // Pre-create persistent dragon nodes for all 8 entries so transitions can
  // animate the same DOM elements through every phase change.
  c.raceResult.entries.forEach(entry => {
    const node = buildPixelDragon(entry, c.broadcast.phases[0], c.bet, -30, 30);
    node.dataset.id = entry.dragon.id;
    node.style.opacity = "0";  // start hidden, frame update will reveal
    scene.appendChild(node);
  });
  return wrap;
}

function updateBroadcastFrame(wrap, c) {
  const bs = c.broadcastState;
  const phase = c.broadcast.phases[bs.phaseIdx];
  const phaseQueue = c.commentary[bs.phaseIdx];
  const shownLines = phaseQueue.lines.slice(0, bs.lineIdx + 1);

  // --- Header ---
  wrap.querySelector("#bc-header").innerHTML = `
    <div>
      <div class="phase-label">[${phase.label}] ${phase.sectionName}</div>
      <div>${raceFullName(c.race)}</div>
    </div>
    <div>
      <span class="weather-chip">${WEATHERS[c.race.weather].label}</span>
      <span> 残り ${phase.distanceRemaining}m</span>
    </div>`;

  // --- Scene: update persistent dragons ---
  updateBroadcastScene(wrap.querySelector("#bc-scene"), phase, c.bet);

  // --- Ranking bar ---
  const rankBar = wrap.querySelector("#bc-rankbar");
  rankBar.innerHTML = "";
  phase.orderedEntries.forEach((e, i) => {
    const id = e.dragon.id;
    const popRank = c.oddsResult.oddsData.find(o => o.dragonId === id).popularityRank;
    const isTarget = c.bet && c.bet.selections.includes(id);
    const cls = isTarget ? "target" : (popRank === 1 ? "fav" : "");
    rankBar.appendChild(el("span", `rank-pos ${cls}`,
      `${i + 1}: ${commentaryName(id)}`));
  });

  // --- Bet status ---
  const betEl = wrap.querySelector("#bc-bet");
  if (c.bet && c.bet.selections.length) {
    betEl.style.display = "";
    betEl.textContent = `🎯 ${phase.bettingStatus.summary}`;
  } else {
    betEl.style.display = "none";
  }

  // --- Mimi commentary (§28 §5.1 telop: latest line large, a couple fading
  // prior lines — never a tall growing stack; full text lives in 全ログ). ---
  const linesEl = wrap.querySelector("#mimi-lines");
  linesEl.innerHTML = "";
  const recent = shownLines.slice(-3);
  recent.forEach((line, i) => {
    const isLatest = i === recent.length - 1;
    const d = document.createElement("div");
    d.className = isLatest ? "line is-latest" : "line-prev";
    d.textContent = line;
    linesEl.appendChild(d);
  });
  linesEl.scrollTop = linesEl.scrollHeight;

  // --- Controls ---
  // Watch-mode: the race auto-plays start→finish so the player just watches
  // the dragons (§27 — no pause). Only speed / skip / log conveniences remain.
  const controls = wrap.querySelector("#bc-controls");
  controls.innerHTML = "";
  const atEnd = bs.phaseIdx === c.broadcast.phases.length - 1
      && bs.lineIdx >= c.commentary[bs.phaseIdx].lines.length - 1;
  if (!atEnd) {
    const speedBtn = makeBtn(`速度 ${bs.speed}×`, cycleSpeed, { secondary: bs.speed === 1 });
    if (bs.speed > 1) speedBtn.classList.add("speed-active");
    controls.appendChild(speedBtn);
    controls.appendChild(makeBtn("⏭ スキップ", skipToResult, { secondary: true }));
  }
  controls.appendChild(makeBtn("📜 全ログ", toggleLog, { secondary: true }));
  if (atEnd) {
    controls.appendChild(makeBtn("結果を見る", renderResult));
  }

  // --- Log panel ---
  const logEl = wrap.querySelector("#bc-log");
  if (bs.showLog) {
    logEl.style.display = "";
    logEl.innerHTML = "";
    c.broadcast.phases.forEach((p, i) => {
      logEl.appendChild(el("div", "log-phase", `【${p.label} ${p.sectionName}】`));
      c.commentary[i].lines.forEach(line => logEl.appendChild(el("div", "log-line", line)));
    });
  } else {
    logEl.style.display = "none";
  }
}

/**
 * Update dragon positions in-place so CSS transitions animate the change.
 * Focus entries get on-screen layout slots; non-focus dragons drift to the
 * left edge with low opacity (still mounted, so re-entry animates back).
 */
function updateBroadcastScene(scene, phase, bet) {
  scene.setAttribute("data-mode", phase.visualMode);

  const focusEntries = phase.focusDragonIds
    .map(id => phase.orderedEntries.find(e => e.dragon.id === id))
    .filter(Boolean)
    .sort((a, b) => phase.currRankMap[a.dragon.id] - phase.currRankMap[b.dragon.id]);
  const N = focusEntries.length;
  const layout = phaseLayoutFor(phase.id, N, phase.visualMode);
  const focusSlot = {};
  focusEntries.forEach((entry, i) => {
    focusSlot[entry.dragon.id] = { left: layout.left(i), bottom: layout.bottom(i) };
  });

  // Update every persistent dragon node.
  scene.querySelectorAll(".pixel-dragon").forEach(node => {
    const id = node.dataset.id;
    const entry = phase.orderedEntries.find(e => e.dragon.id === id);
    if (!entry) return;
    const rank = phase.currRankMap[id];
    // Position
    if (focusSlot[id]) {
      node.style.left = focusSlot[id].left + "%";
      node.style.bottom = focusSlot[id].bottom + "px";
      node.style.opacity = "1";
      node.style.zIndex = String(20 - rank);
    } else {
      // Drift off to the left edge while still mounted
      node.style.left = "-18%";
      node.style.bottom = "30px";
      node.style.opacity = "0.0";
    }
    // Rank tag
    const tag = node.querySelector(".rank-tag");
    if (tag) {
      tag.textContent = rank;
      tag.className = `rank-tag r${rank}`;
    }
    // Class flags
    node.classList.toggle("collapsed", !!entry.collapse);
    node.classList.toggle("bet-target", !!(bet && bet.selections.includes(id)));
    // Sprite pose follows camera mode + race state (face us / show backs /
    // exhausted / final-sprint lean / default run).
    node.dataset.pose = poseFor(phase.visualMode, rank, entry, phase.id);
    // Rank class controls bob speed & z-index in CSS
    node.classList.forEach(cn => { if (/^rank-\d+$/.test(cn)) node.classList.remove(cn); });
    node.classList.add(`rank-${rank}`);
  });
}

// §27 §8.2 layout per phase + visual mode (positioning rules independent of CSS camera).
function phaseLayoutFor(phaseId, N, visualMode) {
  // 後方視点: 縦並びでleaderが奥(上)、follower手前(下)。
  if (visualMode === "back_camera") {
    return {
      left:   i => 50 + (i % 2 === 0 ? -8 : 8) - (i * 1),
      bottom: i => 30 + i * 28      // leader top, follower bottom
    };
  }
  // 前方視点: leaderが手前(下大きく)、follower奥(上小さく)。
  if (visualMode === "front_camera") {
    return {
      left:   i => 50 + (i % 2 === 0 ? 6 : -6) + (i * 1),
      bottom: i => 18 + i * 22      // leader bottom, followers receding up
    };
  }
  if (phaseId === "development") {
    return {
      left: i => 80 - (N > 1 ? i * 40 / (N - 1) : 0),
      bottom: i => 32 + (i % 2) * 18 + (i >= 2 ? 4 : 0)
    };
  }
  if (phaseId === "late") {
    // leader anchored at 80% (not 90) so the rank-1/bet-target's glow + 🎯
    // reticle never clip the right edge (sprite box is 56px ≈ 7.5%).
    return {
      left: i => 80 - (N > 1 ? i * 60 / (N - 1) : 0),
      bottom: i => 28 + (i % 2) * 30 + i * 4
    };
  }
  if (phaseId === "finish") {
    return {
      left: i => 78 - (N > 1 ? i * 48 / (N - 1) : 0),
      bottom: i => 30 + (i % 2) * 22 + (i >= 2 ? 6 : 0)
    };
  }
  return {
    left: i => 80 - (N > 1 ? i * 60 / (N - 1) : 0),
    bottom: i => 30 + (i % 2) * 22 + (i >= 2 ? 6 : 0)
  };
}

/**
 * §27: which sprite pose to show. Driven by camera mode + race state so the
 * dragon's body language matches what's happening:
 *   tired  — stamina-collapsed (へばっている), any camera
 *   back   — back_camera (pack breaking away up-track, we see their backs)
 *   front  — front_camera (charging toward the lens, cute faces to viewer)
 *   goal   — leader in the closing stages (ゴール直前, leaning, mouth open)
 *   side   — default right-facing run
 */
function poseFor(visualMode, rank, entry, phaseId) {
  if (entry.collapse) return "tired";
  if (visualMode === "back_camera") return "back";
  if (visualMode === "front_camera") return "front";
  if ((phaseId === "finish" || phaseId === "late") && rank === 1) return "goal";
  return "side";
}

function buildPixelDragon(entry, phase, bet, leftPct, bottomPx) {
  const d = entry.dragon;
  const rank = phase.currRankMap[d.id];
  const color = dragonColor(d);
  const wrap = el("div", "pixel-dragon");
  wrap.dataset.style = d.style;
  wrap.dataset.pose = poseFor(phase.visualMode, rank, entry, phase.id);
  wrap.classList.add(`rank-${rank}`);
  if (bet && bet.selections.includes(d.id)) wrap.classList.add("bet-target");
  if (entry.collapse) wrap.classList.add("collapsed");
  wrap.style.left = leftPct + "%";
  wrap.style.bottom = bottomPx + "px";
  // One cohesive sprite. Every part for every pose is present; CSS shows/hides
  // and re-poses them per [data-pose] / [data-style] so we never rebuild DOM.
  wrap.innerHTML = `
    <span class="rank-tag r${rank}">${rank}</span>
    <div class="shadow"></div>
    <div class="sprite" style="--c:${color}">
      <div class="tail"></div>
      <div class="wing far"></div>
      <div class="wing near"></div>
      <div class="torso"></div>
      <div class="belly"></div>
      <div class="spine"></div>
      <div class="legs"></div>
      <div class="horn l"></div>
      <div class="horn r"></div>
      <div class="brow"></div>
      <div class="eye l"></div>
      <div class="eye r"></div>
      <div class="cheek l"></div>
      <div class="cheek r"></div>
      <div class="mouth"></div>
      <div class="sweat"></div>
    </div>
    <span class="name-tag">${d.name.replace(/^.+竜/, "")}</span>
  `;
  return wrap;
}

function makeBtn(label, onClick, opts) {
  const b = el("button", opts && opts.secondary ? "secondary" : "", label);
  b.onclick = onClick;
  return b;
}

// ---- Playback control ----

function stepLineOrPhase() {
  const c = state.current;
  const bs = c.broadcastState;
  const phaseCommentary = c.commentary[bs.phaseIdx];
  if (bs.lineIdx < phaseCommentary.lines.length - 1) {
    bs.lineIdx += Math.max(1, Math.floor(bs.speed));  // larger steps at higher speed
    bs.lineIdx = Math.min(bs.lineIdx, phaseCommentary.lines.length - 1);
  } else if (bs.phaseIdx < c.broadcast.phases.length - 1) {
    bs.phaseIdx += 1;
    bs.lineIdx = 0;
  } else {
    // End of broadcast — auto-stop
    if (bs.autoMode) toggleAuto();
  }
  renderBroadcastScreen();
}

function stepPhase(delta) {
  const c = state.current;
  const bs = c.broadcastState;
  const next = bs.phaseIdx + delta;
  if (next < 0 || next >= c.broadcast.phases.length) return;
  bs.phaseIdx = next;
  bs.lineIdx = 0;
  renderBroadcastScreen();
}

function toggleAuto() {
  const bs = state.current.broadcastState;
  bs.autoMode = !bs.autoMode;
  startAutoTimer();
  renderBroadcastScreen();
}

function cycleSpeed() {
  const bs = state.current.broadcastState;
  bs.speed = bs.speed === 1 ? 2 : bs.speed === 2 ? 3 : 1;
  startAutoTimer();
  renderBroadcastScreen();
}

function skipToResult() {
  const bs = state.current.broadcastState;
  stopAutoTimer();
  bs.autoMode = false;
  renderResult();
}

function toggleLog() {
  const bs = state.current.broadcastState;
  bs.showLog = !bs.showLog;
  renderBroadcastScreen();
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

// =========================================================================
// Spec #29 — post-race recap / 答え合わせ screen (tabbed).
// Tabs: 結果 / 払い戻し / 勝負所 / 分析 / 次のヒント / 実況ログ (§29 §9.1)
// First view shows 着順 + 的中/不的中 + 払い戻し + 短い勝負所 (§29 §9.2).
// The recap NEVER changes the race result or payout (§29 §12).
// =========================================================================
const RECAP_TABS = [
  { id: "result",  label: "結果" },
  { id: "payout",  label: "払い戻し" },
  { id: "highlights", label: "勝負所" },
  { id: "analysis", label: "分析" },
  { id: "hints",   label: "次のヒント" },
  { id: "log",     label: "実況ログ" }
];

function renderResult() {
  state.ui.screen = "result";
  const c = state.current;
  // Settle the wallet + progression now that the race is over — once per race
  // (c.settled guard), before the bankruptcy/reaction hooks that read coins.
  settleRace();
  // Stop any running broadcast auto-timer when leaving the race screen.
  stopAutoTimer();

  // Build the recap once per race (reuses analysis; never mutates result/payout).
  if (!c.recap) {
    c.recap = buildRecap({
      race: c.race, raceResult: c.raceResult, oddsResult: c.oddsResult,
      bet: c.bet, betResult: c.betResult, broadcastData: c.broadcast,
      commentary: c.commentary
    });
  }
  if (!c.recapTab) c.recapTab = "result";

  // Mimi/Sake reaction after race result + bankruptcy — fire exactly once.
  if (!c.resultHooksRan) {
    const r = c.betResult;
    const winnerOd = c.oddsResult.oddsData.find(o => o.dragonId === c.raceResult.entries[0].dragon.id);
    runEventHooks("afterRaceResult", { race: c.race, hit: r.hit, popularityRank: winnerOd.popularityRank, bigLoss: !r.hit && r.wager >= 500 });
    if (state.player.coins <= 0) runEventHooks("onBankruptcy", { race: c.race });
    c.resultHooksRan = true;
  }

  drawRecapScreen();
}

function showRecapTab(id) {
  state.current.recapTab = id;
  drawRecapScreen();
}

function drawRecapScreen() {
  const c = state.current;
  const recap = c.recap;
  const app = $("app"); app.innerHTML = "";
  app.appendChild(el("h2", null, "答え合わせ"));

  // --- Reward hero: lead with the emotional verdict (spec #37 Tier 1) ---
  const ps = recap.payoutSummary;
  if (ps) {
    app.appendChild(buildResultHero(ps, resultTierOf(ps), c));
  }

  // --- Tab bar ---
  const bar = el("div", "recap-tabs");
  RECAP_TABS.forEach(t => {
    const b = el("button", "recap-tab" + (c.recapTab === t.id ? " active" : ""), t.label);
    b.onclick = () => showRecapTab(t.id);
    bar.appendChild(b);
  });
  app.appendChild(bar);

  // --- Tab body ---
  const body = el("div", "recap-body");
  ({
    result: recapTabResult,
    payout: recapTabPayout,
    highlights: recapTabHighlights,
    analysis: recapTabAnalysis,
    hints: recapTabHints,
    log: recapTabLog
  }[c.recapTab] || recapTabResult)(body, recap, c);
  app.appendChild(body);

  // --- Persistent actions ---
  const actions = el("div", "actions");
  const detail = el("button", "secondary", "詳しい分析"); detail.onclick = renderAnalysis;
  actions.appendChild(detail);
  const next = el("button", null, "次のレースへ"); next.onclick = renderRaceSelect;
  actions.appendChild(next);
  app.appendChild(actions);
}

// =========================================================================
// Spec #37 Tier 1 — the WIN MOMENT. The race result/odds/payout are NEVER
// changed here; this is pure presentation that makes the payout reveal land.
// =========================================================================

// Win tier from the payout odds — the thrill scales with the 穴 you cracked.
function resultTierOf(ps) {
  if (!ps || !ps.hit) return 0;            // miss
  const o = ps.odds || 1;
  if (o >= 15) return 4;                    // 伝説の的中
  if (o >= 7)  return 3;                    // 超的中
  if (o >= 3)  return 2;                    // 大的中
  return 1;                                 // 的中
}

const RESULT_TIER = {
  0: { word: "ハズレ",           cls: "miss", sfx: "miss" },
  1: { word: "的中！",           cls: "t1",   sfx: "win" },
  2: { word: "大的中！",         cls: "t2",   sfx: "bigwin" },
  3: { word: "超的中！！",       cls: "t3",   sfx: "legendary" },
  4: { word: "伝説の的中！！！", cls: "t4",   sfx: "legendary" }
};

function fmtSigned(n) { return (n < 0 ? "−" : "+") + fmtCoins(Math.abs(n)); }

function buildResultHero(ps, tier, c) {
  const info = RESULT_TIER[tier] || RESULT_TIER[0];
  const hit = !!ps.hit;
  const muteIc = (window.Sfx && Sfx.isMuted()) ? "🔇" : "🔊";
  const hero = el("div", "rs-hero rs-" + info.cls);
  hero.innerHTML =
    `<button class="rs-mute" title="サウンド切替">${muteIc}</button>` +
    `<div class="rs-confetti" aria-hidden="true"></div>` +
    `<div class="rs-stamp">${info.word}</div>` +
    (hit
      ? `<div class="rs-payout"><span class="rs-plus">+</span><span class="rs-count" id="rs-count">0</span><span class="rs-unit">コイン</span></div>`
      : `<div class="rs-payout rs-payout-miss">−${fmtCoins(Math.abs(ps.profit))}<span class="rs-unit"> コイン</span></div>`) +
    `<div class="rs-sub">` +
      (hit
        ? `${ps.typeLabel} × ${ps.odds.toFixed(1)}倍　／　収支 <b>${fmtSigned(ps.profit)}</b>`
        : `${ps.typeLabel}　／　今回は届かず`) +
      `　・　所持 <b>${fmtCoins(state.player.coins)}</b></div>` +
    `<div class="rs-streak" id="rs-streak"></div>`;

  const mb = hero.querySelector(".rs-mute");
  if (mb) mb.onclick = (e) => {
    e.stopPropagation();
    if (window.Sfx) {
      Sfx.setMuted(!Sfx.isMuted());
      mb.textContent = Sfx.isMuted() ? "🔇" : "🔊";
      if (!Sfx.isMuted()) Sfx.play("click");
    }
  };

  // Celebrate exactly once per race; on later re-renders (tab switches) just
  // show the final number statically.
  if (!c.celebrated) {
    c.celebrated = true;
    // Wait until any Mimi/event popup is dismissed so the confetti + count-up
    // are actually seen (otherwise they'd play hidden under the overlay).
    whenResultVisible(() => celebrateResult(hero, ps, tier, info));
  } else if (hit) {
    const cnt = hero.querySelector("#rs-count");
    if (cnt) cnt.textContent = fmtCoins(ps.payout);
  }
  return hero;
}

// Run cb once the result screen is actually visible — i.e. the modal event
// overlay (Mimi reaction / story / rank-up popups) has been dismissed.
function whenResultVisible(cb) {
  const hidden = () => {
    const ov = document.getElementById("event-overlay");
    return !ov || ov.classList.contains("hidden");
  };
  if (hidden()) { requestAnimationFrame(cb); return; }
  let tries = 0;
  const iv = setInterval(() => {
    if (hidden() || ++tries > 600) { clearInterval(iv); requestAnimationFrame(cb); }
  }, 90);
}

function celebrateResult(hero, ps, tier, info) {
  if (!hero || !document.body.contains(hero)) return;
  try { if (window.Sfx) Sfx.play(ps.hit ? info.sfx : "miss"); } catch (e) {}
  const stamp = hero.querySelector(".rs-stamp");
  if (stamp) stamp.classList.add("rs-stamp-go");
  if (!ps.hit) return;
  const cnt = hero.querySelector("#rs-count");
  if (cnt) countUp(cnt, ps.payout, 900 + tier * 220);
  const conf = hero.querySelector(".rs-confetti");
  const n = [0, 18, 32, 50, 72][tier] || 18;
  if (conf) spawnConfetti(conf, n, tier);
  if (tier >= 3) {
    hero.classList.remove("rs-shake"); void hero.offsetWidth; hero.classList.add("rs-shake");
    setTimeout(() => hero.classList.remove("rs-shake"), 700);
  }
}

// Number count-up through fmtCoins (easeOutCubic), with soft ticks.
function countUp(node, to, dur) {
  if (!node) return;
  to = Math.max(0, Math.round(to));
  const start = performance.now();
  let lastTick = 0;
  (function frame(now) {
    if (!document.body.contains(node)) return;
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmtCoins(Math.round(to * eased));
    if (window.Sfx && p < 1 && now - lastTick > 70) { lastTick = now; Sfx.play("tick"); }
    if (p < 1) requestAnimationFrame(frame);
    else node.textContent = fmtCoins(to);
  })(start);
}

// Lightweight DOM confetti — no assets, colours from the world palette.
const RS_CONFETTI_COLORS = ["#ffd877", "#e6b24a", "#49c89c", "#2ea884", "#ff6f4d", "#57b1dd", "#f3ecdc"];
function spawnConfetti(container, n, tier) {
  if (!container) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "rs-confetto";
    const left = Math.random() * 100;
    const dur = 1.1 + Math.random() * 1.1;
    const delay = Math.random() * 0.5;
    const size = 5 + Math.random() * (tier >= 3 ? 8 : 5);
    const rot = (Math.random() * 720 - 360) | 0;
    const drift = (Math.random() * 60 - 30) | 0;
    p.style.cssText =
      `left:${left}%;width:${size.toFixed(1)}px;height:${(size * (0.5 + Math.random())).toFixed(1)}px;` +
      `background:${RS_CONFETTI_COLORS[(Math.random() * RS_CONFETTI_COLORS.length) | 0]};` +
      `animation-duration:${dur.toFixed(2)}s;animation-delay:${delay.toFixed(2)}s;` +
      `--rs-rot:${rot}deg;--rs-drift:${drift}px;`;
    frag.appendChild(p);
  }
  container.appendChild(frag);
  setTimeout(() => { if (container) container.innerHTML = ""; }, 2800);
}

function recapSection(label, lines) {
  const d = el("div", "analysis-section");
  d.appendChild(el("span", "label", label));
  (lines || []).forEach(t => { if (t) d.appendChild(el("div", null, t)); });
  return d;
}

// §29 §9.2 first view: 着順(全8) + 的中/不的中 + 払い戻し + 短い勝負所.
function recapTabResult(body, recap, c) {
  const tbl = el("table", "ranking-table");
  tbl.innerHTML =
    `<tr><th>着</th><th>竜</th><th>人気</th><th>オッズ</th><th>脚質</th><th>短評</th></tr>` +
    recap.resultSummary.map(e => {
      const cls = e.rank <= 3 ? ` class="top${e.rank}"` : "";
      const star = e.isBetTarget ? " ★" : "";
      const od = (e.odds != null) ? e.odds.toFixed(1) : "—";
      const pop = (e.popularityRank != null) ? `${e.popularityRank}番` : "—";
      return `<tr${cls}><td>${e.rank}</td><td>${e.name}${star}</td><td>${pop}</td><td>${od}</td><td>${e.style}</td><td>${e.blurb}</td></tr>`;
    }).join("");
  body.appendChild(tbl);
  body.appendChild(el("div", "recap-note", "★ … あなたの予想竜"));

  // Short 払い戻し one-liner.
  const ps = recap.payoutSummary;
  if (ps) {
    body.appendChild(recapSection("払い戻し", [
      `${ps.typeLabel}／${ps.resultText}`,
      `賭金 ${fmtCoins(ps.wager)} × ${ps.odds.toFixed(1)} → 払戻 ${fmtCoins(ps.payout)}（収支 ${ps.profit >= 0 ? '+' : ''}${fmtCoins(ps.profit)}）`,
      `所持コイン: ${fmtCoins(state.player.coins)}`
    ]));
  }

  // Short 勝負所 — top 2 highlights.
  body.appendChild(recapSection("勝負所", recap.broadcastHighlights.slice(0, 2)));

  // Mimi sign-off (§29 §8).
  const mimi = el("div", "recap-mimi");
  mimi.appendChild(el("span", "speaker", "ミミ"));
  mimi.appendChild(el("span", "line", recap.mimiRecap));
  body.appendChild(mimi);
}

function recapTabPayout(body, recap, c) {
  const ps = recap.payoutSummary;
  if (!ps) { body.appendChild(el("div", null, "賭けの記録がありません。")); return; }
  body.appendChild(recapSection("賭け", [
    `賭式: ${ps.typeLabel}`,
    `選択: ${ps.selections.map(s => s.name).join(" + ")}`,
    `結果: ${ps.resultText}`,
    `${ps.hit ? '的中' : '不的中'}／賭金 ${fmtCoins(ps.wager)}／オッズ ${ps.odds.toFixed(1)}`,
    `払戻: ${fmtCoins(ps.payout)}コイン（収支 ${ps.profit >= 0 ? '+' : ''}${fmtCoins(ps.profit)}）`,
    `所持コイン: ${fmtCoins(state.player.coins)}`
  ]));
  if (recap.betReview && recap.betReview.length) {
    body.appendChild(recapSection("馬券レビュー", recap.betReview));
  }
}

function recapTabHighlights(body, recap, c) {
  body.appendChild(recapSection("実況ハイライト", recap.broadcastHighlights));
}

function recapTabAnalysis(body, recap, c) {
  body.appendChild(recapSection("勝因", recap.winnerReason));
  if (recap.loserReason && recap.loserReason.length) {
    body.appendChild(recapSection("敗因・人気馬", recap.loserReason));
  }
  body.appendChild(recapSection("人気と実力のズレ", recap.marketGap));
  body.appendChild(recapSection("ペース", recap.paceAnalysis));
  if (recap.staminaAnalysis && recap.staminaAnalysis.length) {
    body.appendChild(recapSection("スタミナ", recap.staminaAnalysis));
  }
  if (recap.courseWeatherAnalysis && recap.courseWeatherAnalysis.length) {
    body.appendChild(recapSection("コース・天候", recap.courseWeatherAnalysis));
  }
}

function recapTabHints(body, recap, c) {
  body.appendChild(recapSection("次戦へのヒント", recap.nextHints));
}

function recapTabLog(body, recap, c) {
  const log = el("div", "broadcast-log");
  (recap.commentaryLog || []).forEach(phase => {
    const label = (BROADCAST_PHASES.find(p => p.id === phase.phaseId) || {}).label || phase.phaseId;
    log.appendChild(el("div", "log-phase", label));
    (phase.lines || []).forEach(line => log.appendChild(el("div", "log-line", line)));
  });
  body.appendChild(log);
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
  const analysis = buildAnalysis(c.race, c.raceResult, c.oddsResult, c.betResult, c.broadcast);
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
    if (analysis.broadcastNotes && analysis.broadcastNotes.length) {
      app.appendChild(sec("中継ハイライト", analysis.broadcastNotes));
    }
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
