// =============================================================================
// ui_economy.js — 「🏦 島の経済」画面（暮らし配下）。島の経済状態のダッシュボード。
// =============================================================================
// ・総資産＝島の景気ティア／6資産成分の内訳／名声・フォロワー・村・レース経済の指標。
// ・終章中のみ、上部に☄️絶滅メーター本体（綱引きダイヤル＋？説明＋最終決戦導線）を集約＝
//   ホームの大HUDをここへ移設し、ホームは🎯目標と同じコンパクトなチップに（ドリルダウン先）。
// ★完全に表示専用＝読むだけ（state.player/state.assets）。着順・オッズ・配当・経済計算には
//   一切干渉しない（[[race-math-immutable]]）。recomputeAssets は再計算（高水位）で値が下がらない。
// =============================================================================

// 島の景気ティア（総資産レベル 0..5 に対応。assetLevelOf=data_assets.js）。表示専用のフレーバー。
var ECO_TIERS = [
  { ic: "🏕️", name: "開拓期",     note: "灯りはまだ小さい。これからの島。" },
  { ic: "🍢", name: "屋台の賑わい", note: "場外に屋台が並びはじめた。" },   // 1万〜
  { ic: "🏪", name: "商店街の活気", note: "店が増え、人の流れができた。" }, // 10万〜
  { ic: "🏙️", name: "市場町の繁栄", note: "島の市場に、金が巡りはじめた。" }, // 1000万〜
  { ic: "🌆", name: "経済都市",     note: "島は大きな経済圏になった。" },   // 10億〜
  { ic: "🌃", name: "大龍経済圏",   note: "島の灯りは、もう消えない。" }    // 1兆〜
];
function _ecoTierOf(total) {
  var lv = (typeof assetLevelOf === "function") ? assetLevelOf(total) : 0;
  lv = Math.max(0, Math.min(5, lv));
  return { lv: lv, t: ECO_TIERS[lv] };
}
function _ecoNum(n) { n = Math.floor(n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

// ── K3-A1（docs/KURASHI_STORY_WEAVE.md A1）：聖龍日報「経済面」の章連動リード記事。
// いま何話か（kurashiChapter）で紙面の顔が変わる＝島の経済が物語の一部になる。表示のみ。
const KURASHI_ECON_ARTICLES = {
  1: { head: "賭場に、新しい灯", by: "経済面・編集部",
       lead: (total) => `異世界より来訪の予想家ミミ氏、中央聖龍レース場で始動。市場はなお様子見だが、場外の人出は微増。総資産 ${fmtCoins(total)} からの再起を、島は静かに見守っている。`,
       quote: "サケ・ウダダ氏（賭場親方）「気配は悪くねえ。それだけだ」" },
  2: { head: "オッズは“願望の影”——分析予想の時代へ", by: "市況・ミズ",
       lead: (total) => `ミミ氏の台頭で場内に「根拠ある予想」の風。人気順に流されぬ買い方が広がり、賭場の取引はより厚く。島の総資産は ${fmtCoins(total)} 水準に。`,
       quote: "ミズ氏（両替商）「市場は嘘をつくの。奥の“ほんとう”を見た人から、豊かになる」" },
  3: { head: "暮らしに、根を張る", by: "暮らし面・合同",
       lead: (total) => `勝ち負けの外側に「暮らし」を育てる動きが広がる。くらしツリー、生活資産——負けた夜にも人生は続く、が合言葉。島の経済圏は ${fmtCoins(total)} へ。`,
       quote: "スミカ・ラグナ氏（村官吏）「村の夜が、明るくなりました。数字より、それが答えです」" },
  4: { head: "配信経済圏、島を回す", by: "実況・マクラ寄稿",
       lead: (total) => `ミミ氏の配信が観客の形を変えた。画面の向こうの声援が場内の熱へ、熱が屋台と土産物へ。配信発の経済が島を巡り、総資産 ${fmtCoins(total)}。`,
       quote: "マクラ氏（実況）「レースは走る者と、見る者で出来てる。今この島は、世界一の観客席だ」" },
  5: { head: "“天井”に備える——避難基金、始動", by: "経済面・編集部",
       lead: (total) => `世界の天井、淘汰の理。にわかに信じ難い話に、島は備えを選んだ。賭場の灯りを守る基金が発足。原資は島の総資産 ${fmtCoins(total)}——ミミ氏の再起そのものだ。`,
       quote: "観測者セレスティア氏「面白い。理に、抗うつもりなのね」" },
  6: { head: "復興景気、続く——灯りは消えなかった", by: "経済面・編集部",
       lead: (total) => `あの夜を越えて、島の経済は最高水準 ${fmtCoins(total)} で推移。市場・縁日・温泉郷いずれも人出は過去最高。復興の中心に、いつもの配信の灯がある。`,
       quote: "島民談「勝っても負けても、あの子の『ぱほぱほ』で一日が終わる。それが崑崙の平和よ」" }
};

function renderEconomy() {
  state.ui.screen = "economy";
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const p = state.player, a = state.assets || {};
  const total = p.totalAssets || 0;          // 表示する資産＝いまの純資産
  const gate  = (typeof assetsPeak === "function") ? assetsPeak(state) : total;   // 景気ティア＝到達最高（下がらない）
  const app = beginScreen();   // 上部に「← 暮らし」

  const _h2 = el("h2", null, `🏦 島の経済 <button class="info-q" title="お金のしくみ">？</button>`);
  const _q = _h2.querySelector(".info-q"); if (_q) _q.onclick = () => { if (typeof showMoneyMap === "function") showMoneyMap(); };
  app.appendChild(_h2);
  app.appendChild(el("div", "as-hint2", "賭場の灯りが大きいほど、島は栄える。"));

  // ── 聖龍日報「経済面」リード記事（章連動・K3-A1・表示のみ）──
  try {
    const ch = Math.min((typeof kurashiChapter === "function") ? kurashiChapter() : 1, 6);
    const art = KURASHI_ECON_ARTICLES[ch] || KURASHI_ECON_ARTICLES[1];
    const clip = el("div", "card news-clip");
    clip.innerHTML =
      `<div class="nc-mast"><span class="nc-mast-art">` +
        `<img class="nc-daiji" src="images/kurashi/shinbun_daiji.webp" alt="聖龍日報" onerror="this.parentNode.innerHTML='聖龍日報｜経済面'">` +
        `<img class="nc-men" src="images/kurashi/men_keizai.webp" alt="経済面" onerror="this.remove()">` +
      `</span><span class="nc-date">${ch >= 6 ? "復興期" : "第" + ch + "期"}</span></div>` +
      `<div class="nc-head">${art.head}</div>` +
      `<div class="nc-lead">${art.lead(total)}</div>` +
      `<div class="nc-quote">${art.quote}</div>` +
      `<div class="nc-by">（${art.by}）</div>`;
    app.appendChild(clip);
  } catch (e) {}

  // ── 終章：絶滅メーター本体（終章中のみ・ホームから移設した詳細＋説明）──
  if (typeof epilogueOn === "function" && epilogueOn()) {
    app.appendChild(_ecoExtinctionPanel());
  }

  // ── 🏗 島づくり入口（5章解放・docs/ISLAND_INVEST_DESIGN.md）──
  //   稼いだ富を島に注ぎ、絶滅を押し戻す。5章前はロック＋条件明示（解放の見せ場）。
  if (typeof renderIslandBuild === "function") {
    // ★門番：解放は advisorMet("celestia")＝総資産1億 AND 第5話既読のみ（旧 OR は第5話未読でも総資産だけで開いた＝未登場のまま終章の中身に触れてしまう）。
    const _ch5 = (typeof advisorMet === "function") && advisorMet("celestia");
    if (_ch5) {
      const bd = el("button", "card isl-entry");
      const _tn = (typeof islandTier === "function") ? ISLAND_TIER_NAME[islandTier()] : "";
      const _dv = (typeof islandDevTotal === "function") ? islandDevTotal() + "/" + islandDevMax() : "";
      bd.innerHTML = `<span class="isl-entry-ic">🏗</span><span class="isl-entry-tx"><b>島づくり</b>` +
        `<small>${_tn}　発展度 ${_dv}　・　富を注いで絶滅を押し戻す</small></span><span class="isl-entry-go">›</span>`;
      bd.onclick = () => renderIslandBuild();
      app.appendChild(bd);
    } else {
      const bl = el("button", "card isl-entry locked");
      bl.innerHTML = `<span class="isl-entry-ic">🔒</span><span class="isl-entry-tx"><b>島づくり</b><small>終章（総資産1億・第5話）で、島そのものに投資できるようになります</small></span>`;
      // ★ロック案内では未登場キャラの固有名（第5話の副題）を出さない。予告は「終章（総資産1億・第5話）」まで。
      bl.onclick = () => { if (typeof showInfoPopup === "function") showInfoPopup("🏗 島づくり",
        `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>物語が<u>終章（総資産1億・第5話）</u>に入ると、勝ち取った富を島の施設・店・レース場・竜宿舎・公共・産業に投資して、島を造り替えられるようになります。</small></div></div>`); };
      app.appendChild(bl);
    }
  }

  // ── 島の景気（総資産ティア＋次の段階への進捗）──
  const tier = _ecoTierOf(gate);
  const nextTh = (typeof nextAssetThreshold === "function") ? nextAssetThreshold(gate) : null;
  const curFloor = (tier.lv >= 1 && typeof ASSET_LEVELS !== "undefined") ? ASSET_LEVELS[tier.lv - 1].threshold : 0;
  const pct = nextTh ? Math.max(2, Math.min(100, Math.round((gate - curFloor) / (nextTh - curFloor) * 100))) : 100;
  const nextTier = nextTh ? _ecoTierOf(nextTh).t : null;
  const hero = el("div", "card eco-hero eco-hero--" + tier.lv);
  hero.innerHTML =
    `<div class="eco-hero-top"><span class="eco-hero-ic">${tier.t.ic}</span>` +
      `<div class="eco-hero-id"><div class="eco-hero-k">島の景気　Lv ${tier.lv} / 5</div>` +
      `<div class="eco-hero-name">${tier.t.name}</div></div></div>` +
    `<div class="eco-hero-total"><span class="eco-hero-tl">島の資産</span><b>${fmtCoins(total)}</b></div>` +
    `<div class="eco-hero-bar"><i style="width:${pct}%"></i></div>` +
    `<div class="eco-hero-next">${nextTh ? `あと <b>${fmtCoins(nextTh - gate)}</b> で「${nextTier.name}」へ` : "🌃 最高景気に到達。島の灯りは、もう消えない。"}</div>` +
    `<div class="eco-hero-note">${tier.t.note}</div>`;
  app.appendChild(hero);

  // ── 経済の内訳（6成分のセグメントバー＝暮らし画面と同じ見せ方）──
  const parts = [
    ["コイン", p.coins, "#e6b24a"], ["村", a.villageValue, "#49c89c"], ["施設", a.facilityValue, "#57b1dd"],
    ["生活", a.livingValue, "#caa44a"], ["名声", a.fameValue, "#d6452f"], ["ドラゴン", a.dragonValue, "#9a6ad0"],
    ["島づくり投資", a.islandValue, "#ec7fb9"]   // ★投資累計＝資産（2026-07-30）
  ].filter(x => (x[1] || 0) > 0);
  const sum = parts.reduce((s, x) => s + x[1], 0) || 1;
  app.appendChild(el("div", "eco-sec", "経済の内訳"));
  app.appendChild(el("div", "card as-break",
    `<div class="as-break-bar">${parts.map(x => `<div style="width:${x[1] / sum * 100}%;background:${x[2]}"></div>`).join("")}</div>` +
    `<div class="as-break-legend">${parts.map(x => `<span><i style="background:${x[2]}"></i>${x[0]} ${fmtCoins(x[1])}</span>`).join("")}</div>`));

  // ── 島の指標（フォロワー・名声・村・レース経済）──
  const folV = 800 + Math.floor((a.fameValue || 0) * 2) + (p.completedRaces || 0) * 15 + (p.wins || 0) * 40;
  const winRate = (p.completedRaces || 0) > 0 ? Math.round((p.wins || 0) / p.completedRaces * 100) : 0;
  const vlv = p.villageLevel || (p.village && p.village.level) || 1;
  const tile = (ic, val, label, sub) =>
    `<div class="eco-tile"><span class="eco-tile-ic">${ic}</span><span class="eco-tile-v">${val}</span>` +
    `<span class="eco-tile-l">${label}</span>${sub ? `<span class="eco-tile-s">${sub}</span>` : ""}</div>`;
  app.appendChild(el("div", "eco-sec", "島の指標"));
  app.appendChild(el("div", "eco-grid",
    tile("💗", _ecoNum(folV), "フォロワー", "島を見守る観客") +
    tile("🏅", fmtCoins(a.fameValue || 0), "名声（評判）", "ランク " + (p.rank || 1)) +
    tile("🏘️", "Lv " + vlv, "村の発展", "島のインフラ") +
    tile("🐉", _ecoNum(p.completedRaces || 0), "開催レース", "賭けの取引量") +
    tile("🏆", (p.wins || 0) + "勝", "的中の実績", "勝率 " + winRate + "%") +
    tile("💰", fmtCoins(p.biggestPayout || 0), "最高配当", "一撃の最高記録")));

  // ── 市況メモ（ミズの声・表示専用フレーバー）──
  // ★BUGFIX：ミズと出会う前（第2話未読）は市況メモを出さない（advisorMet）。
  // ★fail-closed 化：旧 `typeof advisorMet !== "function" ||` は読み込み順の事故で advisorMet が
  //   未定義のとき「出す」側に倒れていた（＝未登場のミズの名が出る）。伏せる側に倒す（R6）。
  if ((typeof advisorMet === "function") && advisorMet("mizu")) {
    const memo = tier.lv >= 4
      ? "市場はあなたを中心に回りはじめた。……あはん、いい流れね。"
      : tier.lv >= 2
        ? "人とお金が動きはじめた。市場は、まだ伸びる余地があるわ。"
        : "まだ小さな賭場。でも、灯りが一つ点くたび、島は少しずつ温まる。";
    app.appendChild(el("div", "card eco-memo", `<span class="eco-memo-who">💧 ミズの市況メモ</span><span class="eco-memo-tx">「${memo}」</span>`));
  }

  // ── 島の景色（I2・島づくりの発展度でテキストが進化。全体の一文＋育った分野ごとの“いま”）──
  if (typeof islandTier === "function" && typeof islandDevTotal === "function" && islandDevTotal() > 0) {
    const _scene = ["島に、新しい息吹が芽ぶきはじめた。", "道が、灯りが、少しずつ島を編み直していく。",
      "どこを歩いても、島が育っているのがわかる。人の声が、明るい。", "ここは、もう誰にも淘汰させない——栄えた島。"][islandTier()];
    let _sceneHTML = `<div class="eco-scene-lead"><span class="eco-scene-ic">🏝️</span><span class="eco-scene-tx">${_scene}</span></div>`;
    // 育った分野ごとの一文（Lvが高い順に最大3つ）＝投資が“歩ける報酬”のテキストに化ける。
    const _domains = (typeof islandEvolveScenes === "function") ? islandEvolveScenes(3) : [];
    if (_domains.length) {
      _sceneHTML += `<div class="eco-scene-list">` + _domains.map(function (d) {
        return `<div class="eco-scene-row"><span class="eco-scene-di">${d.ic}</span><span class="eco-scene-dt">${d.line}</span></div>`;
      }).join("") + `</div>`;
    }
    app.appendChild(el("div", "card eco-scene", _sceneHTML));
  }

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}

// I4 決戦の備え＝4つの軸の到達状況（提示のみ・表示専用）。ラベルは固有名を出さない（R7）。
function _finalPrepList() {
  const p = state.player || {}, col = p.collection || {};
  let scouted = 0; try { scouted = Object.values(col).filter(function (e) { return e && e.scouted; }).length; } catch (e) {}
  const tier = (typeof islandTier === "function") ? islandTier() : 0;
  let advs = 0; try { advs = ["sake", "mizu", "sumika", "makura", "celestia"].filter(function (k) { return typeof advisorMet === "function" && advisorMet(k); }).length; } catch (e) {}
  const seen = (typeof getStoryFlag === "function") && getStoryFlag("_chapter_intro_5");
  return [
    { ic: "🐲", label: "竜を集める",     ok: scouted >= 8, now: scouted + "/8 頭" },
    { ic: "🏝️", label: "島を育てる",     ok: tier >= 2,    now: (typeof ISLAND_TIER_NAME !== "undefined" ? ISLAND_TIER_NAME[tier] : "") },
    { ic: "🎓", label: "みんなの助言を得る", ok: advs >= 5,  now: advs + "/5 人" },
    { ic: "📖", label: "物語を見届ける", ok: !!seen,       now: seen ? "済" : "これから" }
  ];
}

// 終章：絶滅メーター本体（綱引きダイヤル＋？説明＋最終決戦）。ホームのHUDをここへ移設。表示専用。
function _ecoExtinctionPanel() {
  const e = epData();
  const dial = epilogueDial().toFixed(2);
  const prog = epilogueProgress();
  const zone = (typeof epilogueZone === "function") ? epilogueZone() : "mid";
  const react = (typeof epilogueDialReaction === "function") ? epilogueDialReaction() : "";
  const wrap = el("div", "card eco-ext eco-ext--" + zone);
  const hud = el("div", "ep-hud ep-hud--" + zone + (react ? " ep-react-" + react : ""));
  hud.innerHTML =
    `<div class="ep-hud-top"><span class="ep-hud-ttl">☄️ 絶滅メーター <button class="info-q" title="絶滅メーターって？">？</button></span>` +
    `<span class="ep-hud-odds">答えの単勝 <b class="ep-dial-num">${dial}</b><span class="ep-dial-x">倍</span></span></div>` +
    `<div class="ep-dial"><div class="ep-dial-track"><span class="ep-dial-needle" style="left:${prog}%"></span></div>` +
    `<div class="ep-dial-scale"><span class="ep-tk ep-tk-doom">1.0<small>淘汰</small></span>` +
    `<span class="ep-tk ep-tk-mid">1.05</span>` +
    `<span class="ep-tk ep-tk-safe">1.1<small>安全</small></span></div></div>` +
    `<div class="ep-hud-note">🌴スカウト・🏠暮らし・🛍️買い物・🏅的中で押し戻す（0で最終決戦）</div>`;
  const _q = hud.querySelector(".info-q");
  if (_q) _q.onclick = (ev) => { ev.stopPropagation(); if (typeof showEpilogueMeterHelp === "function") showEpilogueMeterHelp(); };
  wrap.appendChild(hud);
  // I4 決戦の備え：これまでの積み重ねを4つの軸で見せる（カタルシスの提示のみ・最終決戦の発火条件は
  //   finalReady=メーター0 のまま。ここでゲートはしない）。ラベルは固有名を出さない（R7）。
  const prep = _finalPrepList();
  const prepDone = prep.filter(function (x) { return x.ok; }).length;
  const pl = el("div", "eco-prep");
  pl.innerHTML = `<div class="eco-prep-t">⚔️ 決戦に持っていくもの <b>${prepDone}/4</b></div>` +
    prep.map(function (x) {
      return `<div class="eco-prep-row${x.ok ? " done" : ""}"><span class="pk">${x.ok ? "✓" : "○"}</span>` +
        `<span class="pic">${x.ic}</span><span class="plb">${x.label}</span><span class="pn">${x.now || ""}</span></div>`;
    }).join("");
  wrap.appendChild(pl);
  if (e.finalReady) {
    const fin = el("button", "hl-final eco-final", `⚔️ 最終決戦へ ▶`);
    fin.onclick = () => { if (typeof startFinalBattle === "function") startFinalBattle(); };
    wrap.appendChild(fin);
  }
  // 初めてメーター詳細を開いた時に一度だけ自動で説明（VN/別ポップ中は次回へ）。
  if (typeof maybeShowMeterHelpFirstTime === "function") setTimeout(function () { try { maybeShowMeterHelpFirstTime(); } catch (x) {} }, 360);
  return wrap;
}

if (typeof window !== "undefined") { window.renderEconomy = renderEconomy; }
