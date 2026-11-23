// =============================================================================
// ui_economy.js — 「🏦 島の経済」画面（暮らし配下）。島の経済状態のダッシュボード。
// =============================================================================
// ・資産の評価と、開催事業の現金会計を区別する。個人の戦績を全島の取引量とはしない。
// ・終章中のみ、上部に☄️絶滅メーター本体（綱引きダイヤル＋？説明＋最終決戦導線）を集約＝
//   ホームの大HUDをここへ移設し、ホームは🎯目標と同じコンパクトなチップに（ドリルダウン先）。
// ★完全に表示専用＝読むだけ（state.player/state.assets）。着順・オッズ・配当・経済計算には
//   一切干渉しない（[[race-math-immutable]]）。recomputeAssets は再計算（高水位）で値が下がらない。
// =============================================================================

// 資産からみた発展の目安（総資産レベル 0..5）。施設の建設・開催の黒字を保証しない。
var ECO_TIERS = [
  { ic: "🏕️", name: "開拓期",     note: "ここから、暮らしと取材を積み重ねる。" },
  { ic: "🍢", name: "屋台の賑わい", note: "暮らしの選択肢が、少しずつ広がる。" },
  { ic: "🏪", name: "商店街の活気", note: "手元に残したものと、育てた評判の記録。" },
  { ic: "🏙️", name: "市場町の繁栄", note: "積み上げた資産を、次は何に使おう。" },
  { ic: "🌆", name: "経済都市",     note: "島へ投じる富にも、大きな選択肢ができた。" },
  { ic: "🌃", name: "大龍経済圏",   note: "大きな資産を、これからの暮らしへ。" }
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
       lead: (total) => `異世界より来訪の予想家ミミ氏、中央聖龍レース場で始動。財布だけでなく、暮らしや評判にも値をつけた資産評価は ${fmtCoins(total)}。ここに、その歩みを記録する。`,
       quote: "サケ・ウダダ氏（賭場親方）「気配は悪くねえ。それだけだ」" },
  2: { head: "オッズは“願望の影”——分析予想の時代へ", by: "市況・ミズ",
       lead: (total) => `人気の数字と、竜が実際に得意とする走り。その違いを読む取材が始まる。ミミ氏の現在の資産評価は ${fmtCoins(total)}。一戦の配当と、積み重ねた評判は別々に記録する。`,
       quote: "ミズ氏（両替商）「市場は嘘をつくの。奥の“ほんとう”を見た人から、豊かになる」" },
  3: { head: "暮らしに、根を張る", by: "暮らし面・合同",
       lead: (total) => `勝ち負けの外側に、選んだ食事や装い、暮らしが残る。負けた夜にも、人生は続く。ミミ氏の資産評価は ${fmtCoins(total)}。現金以外の内訳も、下の帳面で確かめられる。`,
       quote: "スミカ・ラグナ氏（村官吏）「ミミ様。評判の値打ちと、明日のお支払いは、分けて考えましょう」" },
  4: { head: "島の外へ、声を届ける", by: "実況・マクラ寄稿",
       lead: (total) => `画面の向こうにいる人に、島の何を伝えよう。見て歩いた場所、自分で選んだ一皿。ミミ氏の資産評価 ${fmtCoins(total)} とともに、その人自身の言葉を残していく。`,
       quote: "マクラ氏（実況）「数字の向こうにも、一人ずついる。どの一言が届いたか、一緒に見よう！」" },
  5: { head: "賭場の明日を、帳簿から考える", by: "経済面・編集部",
       lead: (total) => `一着を知った客が集まる日も、店と賭場は明日の支払いを迎える。ミミ氏の資産評価は ${fmtCoins(total)}。それをそのまま現金の基金とはせず、実際の設備と開催の収支から、続けられる形を探す。`,
       quote: "観測者セレスティア氏「面白いね。理に、抗うつもりなんだ」" },
  6: { head: "あの夜の先へ——次の灯りをともす", by: "経済面・編集部",
       lead: (total) => `あの夜を越えても、店を開ける人、荷を運ぶ人の仕事は続く。ミミ氏の資産評価は ${fmtCoins(total)}。島に残した設備と開催の記録を確かめながら、次の暮らしへ進んでいく。`,
       quote: "スミカ・ラグナ氏（村官吏）「ミミ様。次の明日も、ご一緒に考えてまいりましょう」" }
};

function renderEconomy() {
  state.ui.screen = "economy";
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const p = state.player, a = state.assets || {};
  const total = p.totalAssets || 0;          // 表示する資産＝いまの純資産
  const gate  = (typeof assetsPeak === "function") ? assetsPeak(state) : total;   // 景気ティア＝到達最高（下がらない）
  const app = beginScreen();   // 上部に「← 暮らし」
  if (typeof appendIslandDiscoveryEconomy === "function") appendIslandDiscoveryEconomy(app);

  const _h2 = el("h2", null, `🏦 島の経済 <button class="info-q" title="お金のしくみ">？</button>`);
  const _q = _h2.querySelector(".info-q"); if (_q) _q.onclick = () => { if (typeof showMoneyMap === "function") showMoneyMap(); };
  app.appendChild(_h2);
  app.appendChild(el("div", "as-hint2", "暮らしの資産と、賭場を続けるための帳簿。"));

  if (p.shingan?.festival && typeof ShinganFestival !== "undefined" && typeof ShinganFestival.recoveryView === "function") {
    try {
      const recovery = ShinganFestival.recoveryView(ShinganFestival.restore(p));
      if (recovery.required) {
        const business = el("button", "card isl-entry");
        business.innerHTML = '<span class="isl-entry-ic">🏝️</span><span class="isl-entry-tx"><b>' +
          (recovery.complete ? "島の営業を立て直した記録" : "次の営業と受渡しを決める") + '</b><small>営業現金 ' +
          _ecoNum(recovery.cash) + ' ／ 借入・未払 ' + _ecoNum(recovery.debt + recovery.arrears) + 'コイン</small></span><span class="isl-entry-go">›</span>';
        business.onclick = () => renderShinganRace(); app.appendChild(business);
      }
    } catch (_) { /* A damaged record is explained at the official entry, never treated as a clear. */ }
  }

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
    if (typeof renderScout === "function" && typeof shinganAllScouted === "function" && !shinganAllScouted()) {
      const report = el("button", "card isl-entry");
      const waiting = !poroFound();
      const appraisalReady = waiting && typeof poroAppraisalWaiting === "function" && poroAppraisalWaiting()?.left === 0;
      const title = appraisalReady ? "鑑定所の知らせを受け取る" : waiting ? "相棒との出会いへ · レースを選ぶ" : "竜の取材便へ";
      const hint = waiting ? poroRaceLead() : "編集部の手配で、未取材の決戦竜に会いに行く";
      report.innerHTML = '<span class="isl-entry-ic">🐉</span><span class="isl-entry-tx"><b>' + title + '</b><small>' + hint + '</small></span><span class="isl-entry-go">›</span>';
      report.onclick = appraisalReady ? renderCollection : waiting ? renderRaceSelect : renderScout;
      app.appendChild(report);
    }
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
      bl.innerHTML = `<span class="isl-entry-ic">🔒</span><span class="isl-entry-tx"><b>島づくり</b><small>第5話の出会いを読み終えると、島そのものに投資できるようになります</small></span>`;
      // ★ロック案内では未登場キャラの固有名（第5話の副題）を出さない。予告は「終章（総資産1億・第5話）」まで。
      bl.onclick = () => { if (typeof showInfoPopup === "function") showInfoPopup("🏗 島づくり",
        `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small><u>第5話の出会いを読み終えると</u>、島の施設・店・レース場・竜宿舎・公共・産業に投資できるようになります。</small></div></div>`); };
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
      `<div class="eco-hero-id"><div class="eco-hero-k">資産からみた発展の目安　Lv ${tier.lv} / 5</div>` +
      `<div class="eco-hero-name">${tier.t.name}</div></div></div>` +
    `<div class="eco-hero-total"><span class="eco-hero-tl">ミミの資産評価</span><b>${fmtCoins(total)}</b></div>` +
    `<div class="eco-hero-bar"><i style="width:${pct}%"></i></div>` +
    `<div class="eco-hero-next">${nextTh ? `あと <b>${fmtCoins(nextTh - gate)}</b> で「${nextTier.name}」へ` : "🌃 資産評価の最高段階に到達。"}</div>` +
    `<div class="eco-hero-note">${tier.t.note}</div>`;
  app.appendChild(hero);

  // ── 経済の内訳（6成分のセグメントバー＝暮らし画面と同じ見せ方）──
  const parts = [
    ["コイン", p.coins, "#e6b24a"], ["村", a.villageValue, "#49c89c"], ["施設", a.facilityValue, "#57b1dd"],
    ["生活", a.livingValue, "#caa44a"], ["名声", a.fameValue, "#d6452f"], ["ドラゴン", a.dragonValue, "#9a6ad0"],
    ["島づくり投資", a.islandValue, "#ec7fb9"]   // ★投資累計＝資産（2026-07-30）
  ].filter(x => (x[1] || 0) > 0);
  const sum = parts.reduce((s, x) => s + x[1], 0) || 1;
  app.appendChild(el("div", "eco-sec", "資産評価の内訳"));
  app.appendChild(el("div", "card as-break",
    `<div class="as-break-bar">${parts.map(x => `<div style="width:${x[1] / sum * 100}%;background:${x[2]}"></div>`).join("")}</div>` +
    `<div class="as-break-legend">${parts.map(x => `<span><i style="background:${x[2]}"></i>${x[0]} ${fmtCoins(x[1])}</span>`).join("")}</div>`));

  // ── 島の指標（フォロワー・名声・村・レース経済）──
  const folV = (typeof goalFollowers === "function") ? goalFollowers() : 800;   // ★式は goals.js の1か所だけ（ここに写しを持たない）
  const winRate = (p.completedRaces || 0) > 0 ? Math.round((p.wins || 0) / p.completedRaces * 100) : 0;
  const vlv = p.villageLevel || (p.village && p.village.level) || 1;
  const tile = (ic, val, label, sub) =>
    `<div class="eco-tile"><span class="eco-tile-ic">${ic}</span><span class="eco-tile-v">${val}</span>` +
    `<span class="eco-tile-l">${label}</span>${sub ? `<span class="eco-tile-s">${sub}</span>` : ""}</div>`;
  app.appendChild(el("div", "eco-sec", "ミミの活動の記録"));
  app.appendChild(el("div", "eco-grid",
    tile("💗", _ecoNum(folV), "読者", "取材と執筆の記録から") +
    tile("🏅", fmtCoins(a.fameValue || 0), "名声（評判）", "ランク " + (p.rank || 1)) +
    tile("🏘️", "Lv " + vlv, "暮らしの拠点", "ミミの村レベル") +
    tile("🐉", _ecoNum(p.completedRaces || 0), "参加したレース", "自分の完走数") +
    tile("🏆", (p.wins || 0) + "勝", "的中の実績", "勝率 " + winRate + "%") +
    tile("💰", fmtCoins(p.biggestPayout || 0), "最高配当", "一撃の最高記録")));

  // ── 市況メモ（ミズの声・表示専用フレーバー）──
  // ★BUGFIX：ミズと出会う前（第2話未読）は市況メモを出さない（advisorMet）。
  // ★fail-closed 化：旧 `typeof advisorMet !== "function" ||` は読み込み順の事故で advisorMet が
  //   未定義のとき「出す」側に倒れていた（＝未登場のミズの名が出る）。伏せる側に倒す（R6）。
  if ((typeof advisorMet === "function") && advisorMet("mizu")) {
    const memo = "ここまで積んだ評判も暮らしも、値打ちはあるわ。でも、明日の仕入れは現金で払うの。帳簿のどの欄か、見ておきましょう。あはん。";
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
  // ★実バグの修正（2026-08-01・F6の検証中に実測で発見）：ここは「スカウト済みの竜を種類を問わず
  //   数える」実装だったが、最終決戦（神眼レース）が要求するのは**特定の8頭**（SHINGAN_ROSTER）。
  //   別の竜を8頭集めると「✅ 8/8頭」と出るのに、神眼レースの画面では出走できず
  //   「8頭全員のスカウトが必要」で止まる＝最後の最後で壁に当たる誤誘導だった（再現確認済み）。
  //   正本 shinganScouted() で、要求されている8頭だけを数える。
  let scouted = 0, need = 8;
  try {
    if (typeof SHINGAN_ROSTER !== "undefined" && typeof shinganScouted === "function") {
      need = SHINGAN_ROSTER.length;
      scouted = SHINGAN_ROSTER.filter(function (d) { return shinganScouted(d.id); }).length;
    } else {
      scouted = Object.values(col).filter(function (e) { return e && e.scouted; }).length;   // fail-open（旧挙動）
    }
  } catch (e) {}
  const tier = (typeof islandTier === "function") ? islandTier() : 0;
  let advs = 0; try { advs = ["sake", "mizu", "sumika", "makura", "celestia"].filter(function (k) { return typeof advisorMet === "function" && advisorMet(k); }).length; } catch (e) {}
  const seen = (typeof getStoryFlag === "function") && getStoryFlag("_chapter_intro_5");
  return [
    // ★固有名は出さない（R7＝未登場の竜の名前を漏らさない）が、「決戦に出る顔ぶれ」であることは示す。
    { ic: "🐲", label: "決戦の竜を取材する", ok: scouted >= need, now: scouted + "/" + need + " 頭" },
    { ic: "🏝️", label: "島を育てる",     ok: tier >= 2,    now: (typeof ISLAND_TIER_NAME !== "undefined" ? ISLAND_TIER_NAME[tier] : "") },
    { ic: "🎓", label: "みんなの助言を得る", ok: advs >= 5,  now: advs + "/5 人" },
    { ic: "📖", label: "物語を見届ける", ok: !!seen,       now: seen ? "済" : "これから" }
  ];
}

// 終章：絶滅メーター本体（綱引きダイヤル＋？説明＋最終決戦）。ホームのHUDをここへ移設。表示専用。
function _ecoExtinctionPanel() {
  if (typeof epSyncOutfits === "function") epSyncOutfits();
  const e = epData();
  const dial = epilogueDial().toFixed(2);
  const prog = epilogueProgress();
  const zone = (typeof epilogueZone === "function") ? epilogueZone() : "mid";
  const react = (typeof epilogueDialReaction === "function") ? epilogueDialReaction() : "";
  const wrap = el("div", "card eco-ext eco-ext--" + zone);
  const vista = el("div", "late-vista late-vista--pressure");
  // 安全域でも決着前の朝は見せない。夜の灯りの強さで押し戻しを表現する。
  vista.innerHTML = `<img src="images/story/late/island_pressure.webp" alt="星空の下で灯りを守る島" onerror="this.remove()">` +
    `<span>${e.finalReady ? "積み上げた備えを、本番へ。" : zone === "safe" ? "島の灯りを、明日へつなぐ。" : zone === "doom" ? "それでも、灯りは消さない。" : "この島に、まだ灯りがある。"}</span>`;
  wrap.appendChild(vista);
  const hud = el("div", "ep-hud ep-hud--" + zone + (react ? " ep-react-" + react : ""));
  hud.innerHTML =
    `<div class="ep-hud-top"><span class="ep-hud-ttl">☄️ 絶滅メーター <button class="info-q" title="絶滅メーターって？">？</button></span>` +
    `<span class="ep-hud-odds">答えの単勝 <b class="ep-dial-num">${dial}</b><span class="ep-dial-x">倍</span></span></div>` +
    `<div class="ep-dial"><div class="ep-dial-track"><span class="ep-dial-needle" style="left:${prog}%"></span></div>` +
    `<div class="ep-dial-scale"><span class="ep-tk ep-tk-doom">1.0<small>淘汰</small></span>` +
    `<span class="ep-tk ep-tk-mid">1.05</span>` +
    `<span class="ep-tk ep-tk-safe">1.1<small>安全</small></span></div></div>` +
    `<div class="ep-hud-note">🏠暮らし・👗装い・🏅的中が備えを支える。八頭の取材がそろえば、築いた時期を問わず公示へ。島の救済は、本番の予想と会計で確かめる。</div>`;
  const _q = hud.querySelector(".info-q");
  if (_q) _q.onclick = (ev) => { ev.stopPropagation(); if (typeof showEpilogueMeterHelp === "function") showEpilogueMeterHelp(); };
  wrap.appendChild(hud);
  // I4 決戦の備え：これまでの積み重ねを4つの軸で見せる（カタルシスの提示のみ・最終決戦の発火条件は
  //   finalReady=メーター0 のまま。ここでゲートはしない）。ラベルは固有名を出さない（R7）。
  const prep = _finalPrepList();
  const prepDone = prep.filter(function (x) { return x.ok; }).length;
  const pl = el("div", "eco-prep");
  pl.innerHTML = `<div class="eco-prep-t">⚔️ 決戦の準備と、島に残せるもの</div><p>八頭の取材が決戦の条件。島づくりは、できる範囲で。</p>` +
    prep.map(function (x) {
      return `<div class="eco-prep-row${x.ok ? " done" : ""}"><span class="pk">${x.ok ? "✓" : "○"}</span>` +
        `<span class="pic">${x.ic}</span><span class="plb">${x.label}</span><span class="pn">${x.now || ""}</span></div>`;
    }).join("");
  wrap.appendChild(pl);
  if (typeof appendIslandLifePurpose === "function") appendIslandLifePurpose(wrap);
  // The new fair-race direction is a reversible, opt-in trial. Pass only a
  // whitelisted historical snapshot in the URL fragment; never the save itself.
  if (typeof ShinganTrialBridge !== "undefined") {
    const trial = el("div", "eco-paper-trial");
    trial.innerHTML = '<span class="eco-trial-label">別の遊び方・練習</span><b>最後の一面を練習する</b><button class="info-q" title="試遊について">？</button><p>独立した練習用の島で試します。この練習では本編のクリアや所持金は変わりません。</p>';
    trial.querySelector(".info-q").onclick = () => {
      if (typeof showInfoPopup === "function") showInfoPopup("最後の一面・試遊", '<p>本編で済ませた港の桟橋修理・市場拡張・スカウトと、訪問や食事の集計だけを持ち込みます。記憶探しの新しい場面は試遊の中で体験します。</p><p>試作用の600コインから開始します。試遊の結果で本編のコイン・セーブ・エンディングは変わりません。本編へは左上の矢印から戻れます。</p>');
    };
    const tryPaper = el("button", "secondary eco-trial-play", "本編とは別の練習へ");
    tryPaper.onclick = () => {
      const snapshot = ShinganTrialBridge.capture(state.player, {
        poroFound: typeof poroFound === "function" && poroFound(),
        mizuMet: typeof advisorMet === "function" && advisorMet("mizu")
      });
      location.assign(ShinganTrialBridge.toURL(snapshot));
    };
    trial.appendChild(tryPaper); wrap.appendChild(trial);
  }
  // ★M3：最終決戦の中身＝神眼レース。メーター押し切り(finalReady) または 総資産10億で解放（shinganUnlocked）。
  if (e.finalReady || (typeof shinganUnlocked === "function" && shinganUnlocked())) {
    const fin = el("button", "hl-final eco-final", typeof shinganAllScouted === "function" && !shinganAllScouted()
      ? "🐉 決戦の取材名簿を見る ▶" : "☄️ 最後の予想紙をつくる ▶");
    fin.onclick = () => {
      if (typeof renderShinganRace === "function") renderShinganRace();
      else showInfoPopup("最後の一面", "<p>決戦の画面を読み込めませんでした。ページを再読み込みしてから、もう一度開いてください。</p>");
    };
    wrap.appendChild(fin);
  }
  // 初めてメーター詳細を開いた時に一度だけ自動で説明（VN/別ポップ中は次回へ）。
  if (typeof maybeShowMeterHelpFirstTime === "function") setTimeout(function () { try { maybeShowMeterHelpFirstTime(); } catch (x) {} }, 360);
  return wrap;
}

if (typeof window !== "undefined") { window.renderEconomy = renderEconomy; }
