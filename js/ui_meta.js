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
// Fourth chapter's destinations share the real map/scout gates. This screen
// never purchases, scouts, confirms a discovery, or changes chapter progress.
function appendNextStoryEncounter(host, allowed) {
  if (typeof nextUnreadChapter !== "function" || typeof renderStoryChapter !== "function") return false;
  const next = nextUnreadChapter();
  if (!next || !(allowed || ["4", "5"]).includes(String(next.id))) return false;
  const box = el("section", "journey-encounter");
  box.appendChild(el("small", null, "次の出会いが開きました"));
  box.appendChild(el("h3", null, "この島で持ち帰った話を、次の出会いへ。"));
  const go = el("button", "primary", "第" + next.id + "話の出会いへ");
  go.onclick = () => renderStoryChapter(next.id); box.appendChild(go); host.appendChild(box);
  return true;
}

function renderChapterThreeJourney() {
  if (typeof chapterRead !== "function" || !chapterRead("3")) { renderGoals(); return; }
  if (chapterRead("4")) { renderChapterFourJourney(); return; }
  if (chapterAvailable("4")) { renderStoryChapter("4"); return; }
  state.ui.screen = "chapter_three_journey";
  const app = beginScreen(); app.classList.add("c4-journey", "c3-journey");
  const p = state.player, status = typeof chapterFourLifeStatus === "function" ? chapterFourLifeStatus(p) : null;
  const button = (host, label, action) => { const b = el("button", "secondary", label); b.onclick = action; host.appendChild(b); return b; };
  const hero = el("section", "c4-hero c3-hero");
  hero.appendChild(el("small", null, "第三話 · この島で暮らす、小さな一日"));
  hero.appendChild(el("h2", null, "誰かに話したいことを、ひとつ。"));
  hero.appendChild(el("p", null, "スミカに教わった暮らしの守り方。その先は、自分が気になる方へ。今日の一着や一杯を誰かと話すか、景色の奥の仕事を確かめてみよう。"));
  app.appendChild(hero);
  app.appendChild(el("p", "c3-invitation", "どちらかの寄り道から、次の出会いへ。新しい買い物や追加の勝利は必要ありません。"));
  const choices = el("div", "c4-destinations");
  const daily = el("section", "c4-destination");
  const dailyImg = el("img"); dailyImg.src = "images/konron/spots/mall_tropical_atrium.png"; dailyImg.alt = ""; daily.appendChild(dailyImg);
  const dailyBody = el("div", "c4-destination-body");
  dailyBody.appendChild(el("small", null, status && status.outing ? "✓ 自分の体験を、話した" : "人に会い、自分の好みを見つける"));
  dailyBody.appendChild(el("h3", null, "今日は、どの姿で歩こう？"));
  dailyBody.appendChild(el("p", null, "売場の常連アヤは、手持ちの服でもいいと言う。着替えて歩いてみた感想を伝えよう。「別の方が好き」でも、まだ迷っていてもいい。"));
  button(dailyBody, "手持ちの服で試す · モールへ", () => {
    if (typeof goIslandLifePlace === "function") goIslandLifePlace("style"); else renderMall();
  });
  button(dailyBody, "一杯と話の続きを · 屋台へ", () => {
    if (typeof goIslandLifePlace === "function") goIslandLifePlace("warm"); else kmGotoSpot("makemeshi");
  });
  dailyBody.appendChild(el("small", "c3-price-note", "服は今持っているもので。料理の注文は有料なので、財布を見て選ぼう。"));
  daily.appendChild(dailyBody); choices.appendChild(daily);
  const field = el("section", "c4-destination"), fieldImg = el("img");
  fieldImg.src = "images/konron/spots/market.webp"; fieldImg.alt = ""; field.appendChild(fieldImg);
  const fieldBody = el("div", "c4-destination-body");
  fieldBody.appendChild(el("small", null, status && status.findings ? "✓ 確かめて持ち帰った発見" : "景色から、暮らしの裏側を見つける"));
  fieldBody.appendChild(el("h3", null, "屋台の水は、どこから？"));
  fieldBody.appendChild(el("p", null, "離れた屋台の水甕に、同じ小さな札。田に流す水と、飲む水は同じなのだろうか。手掛かりをつなぎ、予想した先で確かめたい。"));
  const evidence = typeof IslandDiscovery !== "undefined" ? IslandDiscovery.normalize(p.islandDiscovery).evidence : [];
  const first = evidence.includes("water_jars"), second = evidence.includes("water_fork");
  button(fieldBody, status && status.findings || first && second ? "手帖で、見たことをつなぐ" : first ? "水の分かれ道へ · 棚田を歩く" : "霧待ち市場で、水甕を見てみる", () => {
    if (status && status.findings || first && second) { renderIslandDiscovery(); return; }
    if (!kmGotoSpot(first ? "tanada" : "market")) renderKonronMap();
  });
  fieldBody.appendChild(el("small", "c3-price-note", "観察と調査は無料。違う予想でも、手掛かりやお金は失いません。"));
  field.appendChild(fieldBody); choices.appendChild(field); app.appendChild(choices);
  const rest = el("section", "c4-route c3-purse");
  rest.appendChild(el("h3", null, "いま使えるコイン · " + fmtCoins(p.coins || 0)));
  rest.appendChild(el("p", null, "次のレースを楽しみたい時は、食事と賭ける分を残して。稼ぎ直す前に、手持ちでできる寄り道も選べます。"));
  button(rest, "出走表へ · 次に見たい竜を探す", () => renderRaceSelect());
  button(rest, "暮らしと資産を見てみる", () => renderAssets());
  app.appendChild(rest);
}

function appendMakuraPostDesk(app) {
  const p = state.player, panel = el("section", "c4-route");
  app.appendChild(panel);
  panel.appendChild(el("h3", null, "マクラの配信席"));
  const button = (label, fn) => { const b = el("button", "secondary", label); b.onclick = fn; panel.appendChild(b); };
  if (!p.flags?.phoneBought) {
    panel.appendChild(el("p", null, "あの旗の前で録った声は、まだ二人だけのもの。島の外にも届けたい一枚ができたら、マクラに会いに行こう。"));
    button((p.coins || 0) >= 3000 ? "配信用スマホを買う · 3,000コイン" : "マクラの立替で配信用スマホを持つ", buyPhoneAndGoLive);
    return;
  }
  button("写真と言葉を選んで投稿する", () => { snsSyncCamera(); _igCompose(); });
  button("島の景色や料理を地図から選ぶ", () => renderKonronMap());
  const posts = myPosts().filter(validMakuraPost);
  if (!posts.length) {
    panel.appendChild(el("p", null, "今日の装い、竜の紹介、気になる景色。何を見せたい？　自分の一枚ができたら、ここで一緒に反応を読もう。"));
    return;
  }
  const choose = el("select");
  choose.setAttribute("aria-label", "マクラに見せる自分の投稿");
  posts.forEach(post => { const o = el("option"); o.value = post.id; o.textContent = post.text; choose.appendChild(o); });
  panel.appendChild(choose);
  const card = el("div", "c4-route");
  button("この投稿に届いた反応を、マクラと読む", () => {
    const post = myPosts().find(item => item.id === choose.value && validMakuraPost(item));
    if (!post || state.player !== p || !p.flags?.phoneBought) return;
    card.replaceChildren();
    const subject = makuraPostSubject(post);
    const reacts = myPostReacts(post);
    const reply = myPostReplies(post)[0];
    const line = words => { const para = el("p"); para.textContent = words; card.appendChild(para); };
    if (post.img) { const photo = el("img"); photo.src = post.img; photo.alt = subject.name; photo.width = 120; card.appendChild(photo); }
    line("ミミの投稿「" + post.text + "」");
    line("この投稿への反応 " + reacts + "件");
    if (reply) line(reply.by + "「" + reply.back + "」");
    const comment = {
      dragon: subject.name + "の名前から始めたんだね。旗の前で録った二本目、思い出した。",
      outfit: subject.name + "を選んだんだ。竜が走っていない時間のミミちゃんも、これで見えるね。",
      gourmet: "この一皿に目を留めたんだね。味の話は、食べた人の言葉で聞きたいな。",
      photo: subject.name + "を見せたんだね。あたしがカメラを置くなら、ミミちゃんが立ち止まったところに置きたい。",
      camera: "写真だけで流れてきたら、あたしは通り過ぎたかも。ミミちゃんが選んだこの一言で、立ち止まれたよ。",
      text: "文字だけで送ってくれたときのだ。声に出して読むと、どこでひと息ついたか、聞こえてくるね。"
    };
    line("マクラ「" + comment[subject.kind] + "」");
    p.makuraPostMemory = { id: post.id, day: post.day, img: post.img, text: post.text, reacts };
    if (typeof saveGame === "function") saveGame();
    if (chapterAvailable("5") && !chapterRead("5")) {
      const next = el("button", "primary", "石段の観覧席へ · 第5話"); next.onclick = () => renderStoryChapter("5"); card.appendChild(next);
    }
  });
  panel.appendChild(card);
}

function renderChapterFourJourney(revisit) {
  if (typeof chapterRead !== "function" || !chapterRead("4")) { renderGoals(); return; }
  if (!revisit && chapterRead("5")) { renderEconomy(); return; }
  if (!revisit && typeof chapterAvailable === "function" && chapterAvailable("5")) { renderStoryChapter("5"); return; }
  state.ui.screen = "chapter_four_journey";
  const app = beginScreen();
  app.classList.add("c4-journey");
  const p = state.player;
  const button = (host, label, action, cls) => { const b = el("button", cls || "secondary", label); b.onclick = action; host.appendChild(b); return b; };
  const hero = el("section", "c4-hero");
  hero.appendChild(el("small", null, "第四話 · 島を知る時間"));
  hero.appendChild(el("h2", null, "島の続きを、見つけに。"));
  hero.appendChild(el("p", null, "マクラに話したくなる景色を探そう。竜のしぐさも、島の人の仕事も、見たことを自分の言葉にして持ち帰る。"));
  app.appendChild(hero);
  appendMakuraPostDesk(app);
  if (chapterRead("5")) { button(app, "第4話の記事へ", () => renderStoryChapter("4")); return; }
  if (typeof chapterFiveFieldStatus === "function") {
    const status = chapterFiveFieldStatus(p), route = el("section", "c4-route");
    route.appendChild(el("h3", null, "島を知って、物語の先へ"));
    if (status.hint) route.appendChild(el("p", null, status.hint));
    (status.requirements || []).forEach(r => route.appendChild(el("p", "c4-route-step" + (r.done ? " done" : ""), (r.done ? "✓ " : "○ ") + r.label + "　" + Math.min(r.count || 0, r.target) + "／" + r.target)));
    if ((status.requirements || []).some(r => r.id === "report" && !r.done)) {
      route.appendChild(el("p", null, "レースの結果で「この読みを、手帖に残す」を選べます。外れた予想も、考えた理由を残しておこう。"));
      button(route, "一戦を予想して、読みを残しに行く", () => renderRaceSelect());
    }
    app.appendChild(route);
  }
  const fields = typeof IslandDiscovery !== "undefined" ? IslandDiscovery.normalize(p.islandDiscovery) : { evidence: [] };
  const found = typeof IslandDiscovery !== "undefined" ? IslandDiscovery.exportDiscoveries(p.islandDiscovery) : [];
  const choices = el("div", "c4-destinations");
  const journeys = [
    { id: "dragon_trace", title: "水際の、止まった足跡", body: "水を飲みに来た、だけだろうか。風の方を向いた爪あとから、竜の一日を追ってみる。", spot: "ryu_mizunomi", image: "ryu_mizunomi", evidence: "trace_toes", next: "kazami_yagura", second: "trace_quill" },
    { id: "legend_ring", title: "昔話の品は、今どこに？", body: "夜市の古布屋にある、小さな環の写し。飾りなのか、道具なのか。暮らしの中に続きを探す。", spot: "furununo", image: "furununo", evidence: "ring_rubbing", next: null, second: "ring_mending" }
  ];
  journeys.forEach(j => {
    const done = found.some(f => f.caseId === j.id), started = fields.evidence.includes(j.evidence), paired = fields.evidence.includes(j.second);
    const card = el("section", "c4-destination" + (done ? " done" : ""));
    const img = el("img"); img.src = "images/konron/spots/" + j.image + ".webp"; img.alt = ""; card.appendChild(img);
    const body = el("div", "c4-destination-body");
    body.appendChild(el("small", null, done ? "✓ 手帖に残した発見" : started ? "手掛かりを持っている" : "寄り道から始まる発見"));
    body.appendChild(el("h3", null, j.title)); body.appendChild(el("p", null, j.body));
    button(body, done ? "発見と同行の記録を読む" : paired || started && !j.next ? "手掛かりから続きを考える" : started ? "風見の櫓へ" : "現地で見てみる", () => {
      if (done || paired || started && !j.next) { renderIslandDiscovery(); return; }
      if (typeof kmGotoSpot !== "function" || !kmGotoSpot(started ? j.next : j.spot)) renderKonronMap();
    });
    card.appendChild(body); choices.appendChild(card);
  });
  app.appendChild(choices);
  const scouts = el("section", "c4-route");
  scouts.appendChild(el("h3", null, "いま探しに行ける住処"));
  scouts.appendChild(el("p", null, "出会う竜は抽選。住処で近づき方を考え、竜自身を知る。走りや着順を頼む交渉ではありません。"));
  const roster = typeof DRAGONS !== "undefined" ? DRAGONS : [];
  const homes = new Map(); let later = 0, totalScouted = 0;
  roster.filter(d => d.id !== "poro").forEach(r => {
    if (p.collection && p.collection[r.id] && p.collection[r.id].scouted) { totalScouted++; return; }
    const d = typeof dragonById === "function" ? dragonById(r.id) : null;
    if (!d || typeof scoutDragonHome !== "function") return;
    const home = scoutDragonHome(d);
    if (typeof scoutLocationUnlocked === "function" && scoutLocationUnlocked(home)) homes.set(home, (homes.get(home) || 0) + 1);
    else later++;
  });
  scouts.appendChild(el("small", null, "仲よくなった竜 " + totalScouted + "頭。どの住処の相手でも、実際の出会いが取材の記録になります。"));
  homes.forEach((count, id) => {
    const loc = typeof SCOUT_LOCATIONS !== "undefined" ? SCOUT_LOCATIONS.find(l => l.id === id) : null;
    if (!loc) return;
    const population = typeof dragonsAtLocation === "function" ? dragonsAtLocation(id).length : count;
    button(scouts, loc.name + " · 未加入 " + count + "／生息 " + population + "頭 · 旅費 " + fmtCoins(loc.cost) + (loc.cost > (p.coins || 0) ? "（手持ち不足）" : ""), () => { state.ui.scoutFrom = id; renderScout(); }, "c4-scout-link");
  });
  if (!homes.size) scouts.appendChild(el("p", null, totalScouted > 0 && !later
    ? "この名簿の竜とは、すでに仲よくなっている。手帖を読み直したり、まだ見ぬ島の暮らしへ。"
    : "いま案内できる住処は、まだありません。現地の発見を確かめ、一戦の読みを手帖に残す道でも先へ進めます。"));
  if (later) scouts.appendChild(el("small", "c4-later", "空の住処は第五話から。今は残りの竜を探し回らなくて大丈夫。"));
  scouts.appendChild(el("p", null, "旅費は手持ちから。遠征を選ばない日は、一戦の読みを手帖に残す道もあります。"));
  app.appendChild(scouts);
  const money = el("section", "c4-route");
  money.appendChild(el("h3", null, "次の一戦と、暮らしに残すお金"));
  const amounts = el("div", "c4-amounts");
  [["いま使えるコイン", p.coins || 0], ["いまの総資産", p.totalAssets || 0], ["到達した最高資産", typeof assetsPeak === "function" ? assetsPeak(state) : p.assetsPeak || 0]].forEach(a => { const cell = el("div"); cell.appendChild(el("small", null, a[0])); cell.appendChild(el("b", null, fmtCoins(a[1]))); amounts.appendChild(cell); });
  money.appendChild(amounts);
  money.appendChild(el("p", null, "旅費と食事は手持ちから。暮らしの購入は、次の一戦に残す分を見て選ぼう。島の施設への投資は第五話で開く。"));
  button(money, "買える暮らしを選ぶ", () => renderLifeTree());
  button(money, "出走表を見て、次の読みを考える", () => renderRaceSelect());
  app.appendChild(money);
  button(app, "目標の一覧を見る", () => renderGoals());
}

function renderGoals() {
  state.ui.screen = "goals";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🎯 目標（クエスト）"));
  const gs = (typeof goalsStats === "function") ? goalsStats() : { done: 0, total: 0 };
  app.appendChild(el("div", "as-hint2", `本編の次の一歩と、島で試せる寄り道。全項目の達成はエンディングの条件ではありません。`));
  const bar = el("div", "goals-bar");
  bar.innerHTML = `<i style="width:${gs.total ? Math.round(gs.done / gs.total * 100) : 0}%"></i><b>${gs.done}/${gs.total} 達成</b>`;
  app.appendChild(bar);
  const ng = (typeof nextGoal === "function") ? nextGoal() : null;
  if (ng) {
    const step = el("div", "card goals-next");
    step.appendChild(el("small", null, (typeof getStoryFlag === "function" && getStoryFlag("gameCleared")) ? "次の寄り道" : "本編の次の一歩"));
    step.appendChild(el("h3", null, typeof goalTitleSafe === "function" ? goalTitleSafe(ng) : ng.title));
    step.appendChild(el("p", "as-hint2", typeof goalHintSafe === "function" ? goalHintSafe(ng) : ""));
    if (ng.go && (!ng.goIf || ng.goIf())) {
      const go = el("button", "primary", ng.goLabel || "行ってみる"); go.onclick = () => ng.go(); step.appendChild(go);
    }
    app.appendChild(step);
  }
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
  const _arrived = state.ui.screen !== "meals";   // ほかの画面から来た（段タブの切替や、食べたあとの描き直しではない）
  state.ui.screen = "meals";
  const app = beginScreen();
  app.appendChild(el("h2", null, `🍽️ 食事 ― みみの食べ歩き <img class="news-men news-men--h2" src="images/kurashi/men_gurume.webp" alt="グルメ面" onerror="this.remove()">`));
  const _mealHero = el("div", "meal-hero");   // 中身は段が確定してから入れる（下）
  app.appendChild(_mealHero);
  const all = (typeof mealStatsAll === "function") ? mealStatsAll() : { got: 0, total: 0 };
  const ob = el("div", "goals-bar");
  ob.innerHTML = `<i style="width:${all.total ? Math.round(all.got / all.total * 100) : 0}%"></i><b>${all.got} / ${all.total} 品</b>`;
  app.appendChild(ob);

  const tiers = (typeof MEAL_TIERS !== "undefined") ? MEAL_TIERS : [];
  const _tUnlocked = id => (typeof mealTierUnlocked !== "function") || mealTierUnlocked(id);
  const _mealLockHint = mealTierRequirement;
  const _lockMsg = (id) => { if (typeof showInfoPopup === "function") showInfoPopup("🥢 上級グルメ",
    `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>この段位は<u>${_mealLockHint(id)}</u>で開放されます。まずは食べ歩きから。</small></div></div>`); };
  if (!_mealTab || !tiers.some(t => t.id === _mealTab) || !_tUnlocked(_mealTab)) {
    const firstInc = tiers.find(t => _tUnlocked(t.id) && (function () { const s = mealTierStats(t.id); return s.got < s.total; })());
    _mealTab = (firstInc || tiers.find(t => _tUnlocked(t.id)) || tiers[0] || {}).id;
  }
  // ★空腹で来たら、「ここですぐ食べられる皿」がある段を開く（2026-11-13）。
  //   屋台の段は全品が「島で出会うまで一覧からは食べられない」品（出会いの設計・下の where）。
  //   新しいプレイヤーが空腹で来ると、食べられない「？？？」だけが並ぶ段が開いていた（通しプレイで発覚）。
  //   すぐ食べられる＝もう出会った皿（食べ直し）か、where の無い皿（自宅ごはん）。当てる段（quiz）は含めない。
  //   段タブを自分で切り替えたあとは動かさない（来たときだけ）。値段・回復量・出会いの決まりは読むだけ。
  const _eatHere = m => !m.quiz && (mealEaten(m.id) || !m.where);
  const _hungryNow = (typeof hungerGet === "function") ? hungerGet() : 100;
  const _hungry = _hungryNow < 100;
  if (_arrived && _hungry) {
    const _eatTier = tiers.find(t => _tUnlocked(t.id) && mealsByTier(t.id).some(_eatHere));
    if (_eatTier) _mealTab = _eatTier.id;
  }
  // ★段ごとの一枚絵（2026-08-04・ユーザー依頼「今は屋台めししかないから生成しましょう／
  //   衣装はそれぞれのクラスに応じたそれっぽいミミに」→「既存の意匠から選んで欲しかった」）。
  //   ★衣装は勝手に作らず、OUTFITS（data_assets.js）に実在するものから選ぶ。
  //     その衣装の立ち絵そのものを参照に渡して描いてあるので、モールで着られる服と一致する。
  //     段が上がるほど格も上がる並びにした。
  //       track   屋台をはしご     … sukanpin   素寒貧ミミ（既存の絵を流用）
  //       home    わが家の味       … darugi     ゆるだぼルーム着
  //       gourman 皿の主役を見抜く … dara       きれいめコーデ
  //       shinbo  隠し味を当てる   … departgirl デパートガール
  //     ※ drago（DRADAを着た女）でも試したが、生成側でNSFW判定に弾かれた。
  //       露出の多い衣装はこの経路を通らないので、選ぶときは注意。
  //   欠けても画面は壊さない（onerror で枠ごと消える）。
  const MEAL_HERO = { track: "hero_track", home: "hero_home", gourman: "hero_gourman", shinbo: "hero_shinbo" };
  const _heroFile = MEAL_HERO[_mealTab] || MEAL_HERO.track;
  // ?v は絵の版。差し替えたら進める（index.html の ?v= は画像には効かない）。
  _mealHero.innerHTML = `<img src="images/meals/${_heroFile}.webp?v=2" alt="" decoding="async" onerror="this.closest('.meal-hero').remove()">`;
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
  // 空腹のあいだだけ、どの皿がいま食べられるかを一言（金の枠＝下の can-eat）。
  if (_hungry && tiers.some(t => _tUnlocked(t.id) && mealsByTier(t.id).some(_eatHere))) {
    app.appendChild(el("div", "as-hint2 meal-eat-hint", `🍚 おなか <b>${_hungryNow}</b>／100　<span class="meal-eat-key">金の枠</span>の皿は、ここですぐ食べられます。`));
  }
  // 負けた日のおごり（1品無料）が残っていれば、皿を選ぶ前に知らせる（hunger.js hungerFreeMealOk を読むだけ）。
  try {
    if (_hungry && typeof hungerFreeMealOk === "function" && hungerFreeMealOk())
      app.appendChild(el("div", "as-hint2 meal-eat-hint", `🍜 きょうは1品、<b>店のおごり</b>です（負けた日だけ）。`));
  } catch (e) {}

  // 一枚のカード（段のグリッドと、下の「前回の一皿」の両方で使う）
  const _mealCard = m => {
      const un = mealUnlocked(m);
      const everyday = !m.where && !m.quiz;
      const card = el("button", "meal-card" + (un ? " got" : "") + ((_hungry && _eatHere(m)) ? " can-eat" : ""));
      const thumb = (un && m.photo)
        ? `<span class="meal-card-thumb"><img src="${m.photo}" alt="" decoding="async"></span>`
        : `<span class="meal-card-ic">${un ? m.icon : "❔"}</span>`;
      // ★値段の横に、おなかの回復量も出す（2026-11-13）。初見の皿は名前を伏せるので、走れる状態へ戻したいときに
      //   「どれが効くか」を開かないと分からなかった（Codex の通し試験）。既存の回復量（hunger.js mealHeal）を読むだけ。
      const _cardPrice = (!m.quiz && typeof mealPrice === "function")
        ? `<span class="meal-card-price">🪙${mealPrice(m).toLocaleString("ja-JP")}` +
          ((typeof mealHeal === "function" && (un || !m.where)) ? `<i class="meal-card-heal">🍚+${mealHeal(m)}` +
            // 走れない（＝食べに来た）ときだけ、この皿であと何戦走れるかを添える。数字の意味が「走れる回数」で読める。
            ((_hungry && typeof hungerRacesAt === "function") ? `<em>あと${hungerRacesAt(_hungryNow + mealHeal(m))}戦</em>` : "") + `</i>` : "") + `</span>` : "";
      const mood = everyday ? String(m.scent || m.desc || "").replace(/<[^>]*>/g, "").slice(0, 38) : "";
      card.innerHTML = `${thumb}<span class="meal-card-nm">${un || everyday ? m.name : "？？？"}${mood ? `<small class="meal-card-mood">${mood}</small>` : ""}${_cardPrice}</span>`;
      // ★B改・出会いの設計（2026-08-02・ユーザー決裁「選ぶ段階がつまらない。探し出す喜び・
      //   出会う喜びを」）：where を持つ未食の品は、**ここ（一覧）からは食べられない**。
      //   タップすると出会いのヒント（場所×時間の噂）だけが出る＝島へ探しに行く動機になる。
      //   出会った後はいつでもここから食べ直せる（おなか回復のテンポは不変）。
      //   where の無い品（自宅ごはん等）は従来どおり＝食えない品が生まれない fail-safe。
      if (!un && m.where && !m.quiz) {
        card.onclick = () => { if (typeof showInfoPopup === "function") showInfoPopup("👃 うわさ",
          `<div class="mm-row"><span class="mm-ic">❔</span><div><b>まだ出会っていない一皿</b><small>${m.scent || "……いい匂いがするらしい。"}<br>うわさ：<u>${m.where}</u>${m.time ? "（" + m.time.join("・") + "の刻）" : ""}にあるとか。</small></div></div>`); };
      } else {
        card.onclick = () => showMealDetail(m);
      }
      return card;
  };
  // ★おなかが空いて来たら、前回の一皿を先頭に1枚（2026-11-13・Codex 3回め）。いちばん安い皿で食いつなぐ人は
  //   毎回12枚の中から同じ皿を探していた（「何を食べよう」が「先へ進むための確認係」になる）。
  //   出すのは、すぐ食べられる皿（もう出会った・当てる段でない・段が開いている）のときだけ。押すと同じ窓が開く。
  try {
    const _lastId = _hungry && state.player && state.player._lastMealId;
    const _last = _lastId && (typeof MEALS !== "undefined") ? MEALS.find(x => x.id === _lastId) : null;
    if (_last && _eatHere(_last) && _tUnlocked(_last.tier)) {
      const again = el("div", "meal-again");
      again.appendChild(el("div", "meal-again-t", "🔁 前回の一皿"));
      const g = el("div", "meal-grid");
      g.appendChild(_mealCard(_last));
      again.appendChild(g);
      app.appendChild(again);
    }
  } catch (e) {}
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
    mealsByTier(t.id).forEach(m => grid.appendChild(_mealCard(m)));
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
  const _closeMeal = () => {
    ov.remove();
    if (state.ui.screen === "meals" && typeof renderMeals === "function") renderMeals();
    else if (typeof window.refreshIslandLifePanels === "function") window.refreshIslandLifePanels();
    if (typeof window.refreshIslandCareOffers === "function") window.refreshIslandCareOffers();
  };
  // ★B改・出会いの演出（2026-08-02）：where を持つ品は、食べるまで名前も写真も伏せる。
  //   屋台で「？？？＋気配」→ 食べた瞬間に名前と全力の講評が開く＝発見が遊びの山になる。
  //   この関数内で食べた直後の1回だけ「出会った！」バナーを立てる。
  let _justFound = false;
  let _ateNow = false;   // この窓の中で食べた（下の「このまま、レースへ」を出す合図）
  let _lastPaid = 0;     // いま食べた一皿に払った額（おごりなら0）。食べたあとの窓は「払った結果」を出す
  const _wasEaten = !m.quiz && mealEaten(m.id);   // この窓を開く前から食べたことがある（＝感想はもう読んだ皿）
  // ★はじめての一皿の会話（event_registry.js milestone_meal_*）を、料理の窓の裏で始めない（2026-11-13・Codex 3回め）。
  //   会話（.dlg-overlay z-index 200）は窓（.navpop-ov 9200）より下にあり、窓に隠れて送れず、
  //   「このまま、レースへ」を押した先のレース選択で現れていた。食べた直後に会話が始まったら、窓をいったん伏せ、
  //   会話が閉じたら戻す＝食べる → ミミの一言 → 窓（発見・あと何戦・レースへ）の順になる。会話が始まらなければ何もしない。
  const _yieldToDialogue = () => {
    if (!(window.Dialogue && Dialogue.isOpen)) return;
    const t0 = Date.now(); let seen = false;
    (function tick() {
      if (!document.body.contains(ov)) return;
      const open = Dialogue.isOpen() || (Dialogue.isHolding && Dialogue.isHolding());
      if (open && !seen) { seen = true; ov.style.visibility = "hidden"; }
      if (seen && !open) { ov.style.visibility = ""; return; }
      if (!seen && Date.now() - t0 > 900) return;            // 会話は始まらなかった（2品目以降など）
      if (seen && Date.now() - t0 > 120000) { ov.style.visibility = ""; return; }   // 永久に伏せない
      setTimeout(tick, seen ? 250 : 60);
    })();
  };
  const _mystery = () => !mealEaten(m.id) && !!m.where && !m.quiz;
  const head = () => (_mystery()
    ? `<div class="meal-pop-ic">❔</div><div class="navpop-t">？？？</div>`
    : (m.photo
      ? `<img class="meal-pop-photo" src="${m.photo}" alt="" decoding="async"><div class="meal-pop-ic meal-pop-ic--over">${m.icon}</div><div class="navpop-t">${m.name}</div>`
      : `<div class="meal-pop-ic">${m.icon}</div><div class="navpop-t">${m.name}</div>`));
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
      // ★前に食べたことのある皿は、感想と豆知識を畳む（2026-11-13・Codex 3回め：同じ皿を食べ直すたびに、読んだ講評を
      //   通ってからボタンへ下りていた）。写真・名前・値段と、食べる／レースへのボタンが先に見える。開けばいつでも読める。
      //   はじめて食べたその窓では、これまでどおり全部見せる（発見の山）。
      _html += eaten
        ? (_wasEaten
          ? `<details class="meal-more"><summary>📖 前に食べたときの感想</summary><div class="meal-react">${m.react}</div><div class="meal-note">📖 ${m.note}</div></details>`
          : (_justFound ? `<div class="meal-found">🎉 あたらしい一皿と、出会った！</div>` : "") +
            `<div class="meal-react">${m.react}</div><div class="meal-note">📖 ${m.note}</div>`)
        : (m.where && m.scent
          ? `<div class="meal-scent">${m.scent}</div><div class="meal-prompt">ひとくち、いってみる？</div>`
          : `<div class="meal-prompt">ひとくち、いってみる？</div>`);
      // ★食べたあとの窓は「払った結果」を出す（2026-11-13・Codex 3回め）。以前は食べたあとも「次の一皿」の予告
      //   （「🍽 70コイン／所持 900 → 残り 830」）のままで、おごりで食べたのに払ったように、払ったのにさらに引かれるように読めた。
      //   いま払った額・いまのおなか・いまの所持と、あと何戦。もう一品の値段は「もう一品」のボタンに書く。数字は読むだけ。
      if (_ateNow) {
        // 短く（375px で「支払い 40コ／イン」「おなか 30／／100」と折れたため）。いくら残ったかは下の「所持」で読める。
        const _paidTxt = _lastPaid > 0 ? "✅ −" + _lastPaid.toLocaleString("ja-JP") + "コイン" : "✅ おごり";
        _html += `<div class="meal-buy"><div class="meal-buy-row"><span class="meal-buy-cost">${_paidTxt}</span><span class="meal-buy-heal">🍚 おなか ${_hunger}</span></div>` +
          ((typeof hungerRacesAt === "function") ? `<div class="meal-buy-races">いまのおなかで、あと <b>${hungerRacesAt(_hunger)}戦</b> 走れる</div>` : "") +
          `<small>所持 ${_bal}</small></div>`;
      } else
      _html += `<div class="meal-buy${(_short || _full) ? " short" : ""}"><div class="meal-buy-row"><span class="meal-buy-cost">${_priceTxt}</span><span class="meal-buy-heal">🍚 おなか +${_heal}</span></div>` +
        // この皿を食べると、あと何戦走れるか（hunger.js hungerRacesAt）。値段と回復量の行とは分けて1行で。
        ((!_full && typeof hungerRacesAt === "function") ? `<div class="meal-buy-races">食べると、あと <b>${hungerRacesAt(_hunger + _heal)}戦</b> 走れる</div>` : "") +
        `<small>${_balTxt}</small></div>`;
      box.innerHTML = _html;
      _wirePhotoZoom();
      const btns = el("div", "navpop-btns");
      // 食べたあとの「もう一度」は、値段をボタンに書く（上の箱は払った結果を出しているので、ここで次の一皿の額が分かる）
      const _eatLabel = !eaten ? "🍴 いただきます！"
        : (_ateNow && !_full) ? "🍴 もう一品（" + (_free ? "おごり" : _price.toLocaleString("ja-JP") + "コイン") + "）"
        : "🍴 もう一度食べる";
      const eat = el("button", "navpop-go" + (_full ? " is-off" : ""), _eatLabel);
      if (_full) eat.disabled = true;
      else eat.onclick = () => {
        _justFound = !mealEaten(m.id) && !!m.where;
        const _h0 = (typeof hungerGet === "function") ? hungerGet() : 0;
        const _c0 = (state.player && state.player.coins) || 0;
        const _outcome = eatMeal(m.id);
        const _ok = _outcome === true || (_outcome !== false && ((typeof hungerGet === "function") ? hungerGet() > _h0 : true));
        _justFound = _justFound && _ok;
        if (_ok) {
          _lastPaid = Math.max(0, _c0 - ((state.player && state.player.coins) || 0));
          // 食事の一覧の先頭に出す「前回の一皿」（renderMeals）。表示のための印だけ。
          try { state.player._lastMealId = m.id; if (typeof saveGame === "function") saveGame(); } catch (e) {}
        }
        _ateNow = _ateNow || _ok;
        if (window.Sfx) Sfx.play(_justFound ? "unlock" : "coin");
        render();
        if (_ok) _yieldToDialogue();
      };
      const later = el("button", "navpop-cancel", eaten ? "閉じる" : "また今度"); later.onclick = () => _closeMeal();
      // ★食べて走れるようになったら、ここからそのままレースへ（2026-11-13）。以前は、食べたあと窓を閉じ、
      //   12枚のカードのいちばん下まで送って「次のレースへ」を探すか、ホームへ戻ってから進むかだった。
      //   空腹のたびに食事へ送るようにしたぶん（ui_render.js hungryNeedsMeal）、帰り道も1手にする。
      //   主役がレースになるので、「もう一度食べる」は脇へ（押せるのはそのまま）。hunger.js を読むだけ。
      const _canGo = _ateNow && (typeof hungerCanRace !== "function" || hungerCanRace()) && typeof renderRaceSelect === "function";
      if (_canGo) {
        const go = el("button", "navpop-go meal-go-race", "🐉 このまま、レースへ ▶");
        go.onclick = () => { ov.remove(); renderRaceSelect(); };
        box.appendChild(go);
        eat.className = "navpop-cancel" + (_full ? " is-off" : "");
      }
      btns.appendChild(eat); btns.appendChild(later); box.appendChild(btns);
    } else {
      // ── 当てる（食材／隠し味） ──
      if (mealSolved(m.id)) {
        box.innerHTML = head() + `<div class="meal-desc">${m.desc}</div><div class="meal-react meal-hit">${m.quiz.hit}</div><div class="meal-note">📖 ${m.note}</div>`;
        _wirePhotoZoom();
        const eaten = mealEaten(m.id), full = eaten && typeof hungerGet === "function" && hungerGet() >= 100;
        const price = typeof mealPrice === "function" ? mealPrice(m) : 0, heal = typeof mealHeal === "function" ? mealHeal(m) : 0;
        const free = typeof hungerFreeMealOk === "function" && hungerFreeMealOk();
        const info = el("div", "meal-buy");
        info.innerHTML = _ateNow ? `<b>✅ ${_lastPaid ? "−" + _lastPaid.toLocaleString("ja-JP") + "コイン" : "店のおごり"} · 一皿を味わった</b><p>おなか ${typeof hungerGet === "function" ? hungerGet() : ""}／100。${_justFound ? "初めての味を、食べ歩きの記録へ。" : ""}</p>` : `<b>${eaten ? "また味わう" : "味がわかったら、一皿を注文する"}</b><p>${free ? "店のおごり" : price.toLocaleString("ja-JP") + "コイン"} · おなか +${heal}</p>`;
        box.appendChild(info);
        const btns = el("div", "navpop-btns"), order = el("button", "navpop-go", full ? "おなかいっぱい" : (eaten ? "もう一度味わう" : "この一皿を味わう") + (free ? "・おごり" : "・" + price.toLocaleString("ja-JP") + "枚"));
        order.disabled = full;
        order.onclick = () => {
          const was = mealEaten(m.id), coins = state.player.coins || 0;
          if (eatMeal(m.id) !== true) return;
          _ateNow = true; _justFound = !was; _lastPaid = Math.max(0, coins - (state.player.coins || 0)); state.player._lastMealId = m.id;
          if (typeof saveGame === "function") saveGame(); if (window.Sfx) Sfx.play(was ? "coin" : "unlock"); render(); _yieldToDialogue();
        };
        const close = el("button", "navpop-cancel", _ateNow ? "ごちそうさま" : "今は味の記録だけ残す"); close.onclick = _closeMeal;
        btns.appendChild(order); btns.appendChild(close); box.appendChild(btns);
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
    if (_ateNow && typeof appendIslandLifeMealExit === "function") appendIslandLifeMealExit(box, () => ov.remove());
  };
  render();
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) _closeMeal(); };
  document.body.appendChild(ov);
}
