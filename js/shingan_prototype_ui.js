(function () {
  "use strict";
  const E = window.ShinganPrototype, app = document.getElementById("prototype");
  if (!E) { app.textContent = "試作を読み込めませんでした。ページを再読み込みしてください。"; return; }
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(n || 0);
  const signed = n => (n >= 0 ? "+" : "−") + num(Math.abs(n));
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = motionPreference.matches;
  const dialog = $("#game-dialog"), dialogBody = $("#dialog-body");
  const bridge = window.ShinganTrialBridge, carried = bridge && bridge.fromHash(location.hash);
  const makeGame = (mode, scenarioId) => { const state = E.createState(mode, scenarioId); return carried ? bridge.apply(state, carried) : state; };
  let game = makeGame("arrival", "coast"), phase = "prepare", plan = [null, null, null], activeSlot = 0;
  let inspected = null, result = null, watched = false, animation = 0, toastTimer = 0, soundOn = false, audio = null;
  const trialHistory = new Map();
  let comparison = null, preparationEcho = null;
  let evidence = {};
  const annotations = () => plan.map(id => id && evidence[id] ? evidence[id] : null);
  motionPreference.addEventListener("change", event => { reduce = event.matches; if (reduce && phase === "result" && !watched) completeRace(); });
  const spriteCache = new Map();
  const view = () => E.getView(game);
  const chosen = () => plan.filter(Boolean);
  function sound(kind) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
      const frequencies = { pick: [420, 680], remove: [560, 380], prep: [520, 920], issue: [280, 740], win: [660, 990] };
      const f = frequencies[kind] || frequencies.pick;
      osc.type = "sine"; osc.frequency.setValueAtTime(f[0], t); osc.frequency.exponentialRampToValueAtTime(f[1], t + .1);
      gain.gain.setValueAtTime(.045, t); gain.gain.exponentialRampToValueAtTime(.001, t + .15);
      osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .16);
    } catch (e) {}
  }
  function announce(message) { $("#announcer").textContent = message; }
  function toast(message) {
    document.querySelectorAll(".toast").forEach(x => x.remove()); clearTimeout(toastTimer);
    const node = document.createElement("div"); node.className = "toast"; node.textContent = message; document.body.appendChild(node);
    announce(message); toastTimer = setTimeout(() => node.remove(), 1800);
  }
  function modal(html) { dialogBody.innerHTML = html; if (!dialog.open) dialog.showModal(); enhanceArt(dialogBody); }
  $(".dialog-close").onclick = () => dialog.close();
  dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  $("#help-toggle").onclick = showHelp;
  $("#sound-toggle").onclick = () => {
    soundOn = !soundOn; const button = $("#sound-toggle");
    button.setAttribute("aria-pressed", String(soundOn)); button.setAttribute("aria-label", soundOn ? "音をオフにする" : "音をオンにする");
    button.innerHTML = soundOn ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/></svg>';
    sound("pick");
  };
  function showHelp() {
    modal('<h2>予言の先にも、島の朝を。</h2><p>ライオウが1着になる。セレスティアの神眼は、正確です。ミミの仕事は、ほかの竜にもある走りの魅力を読み、根拠のある予想を届けること。</p>' +
      '<h3>島の備え → 3つの読者へ → 公正な決戦</h3><p>港で読者を迎え、市場の営業を戻し、スカウトで得た竜の記録を紙面へ。カードをタップするか、空いた枠へドラッグして一面を組みます。読みを信じる人、配当を探す人、竜を応援する人で反応が違います。枠を選び直せば差し替えられます。</p>' +
      '<h3>勝負の条件</h3><p>3枚の予想のうち2枚以上を的中させ、島の一日の運営収支を0以上に。単勝・複勝・ワイドは別々の売上です。単勝の票は予言の一頭に集まったまま。市場やほかの券種で島を支えます。</p>' +
      '<h3>予想の意味</h3><p>この試作の複勝は2着以内、ワイドは2頭とも3着以内。カードの倍率は「的中した場合」の見込みで、利益の保証ではありません。同じ予想に読者が集まるほど配当は薄くなります。</p>' +
      '<h3>旅で覚えたことを、最後の一面へ</h3><p>古布屋、仕立て屋、祭りの食卓。寄り道で持ち帰った記憶を表紙に添えると、その人に縁のある応援客を招けます。各予想には出会いと理論をひとつずつ結び、結果の後に届く返事を読めます。すべて巡る必要はありません。</p>' +
      '<h3>中盤で残した、自分の読みも</h3><p>本編の第3話以降、結果で残した「読みの手帖」を持ち込めます。一面にカードを置いて根拠を開くと、以前の一戦を添えられます。別の竜への応用もできますが、過去の的中は今回の的中を保証しません。本編の複勝は3着以内、この試作の記事は2着以内です。</p>' +
      '<h3>この試作について</h3><p>本編の島投資・竜の収集を短縮した、独立した体験版です。本編のセーブ・財布・着順の計算は読み書きしません。600コインと予想の売上は試作用。古布の手掛かり探し・祭りの食卓での出会いは、この試作で新設した話です。旅や食事の既存イラストを再利用しています。装いは試作用の所持設定で、本編の衣装・思い出CGを解放しません。レースは検証用の固定結果を一定速度で再生し、プレイヤーの準備や予想で走りは変わりません。</p>' +
      '<button class="secondary" id="demo-prepared">島の備えをそろえて、続きから試す</button><button class="text-button" id="demo-reset">記憶・紙面もリセットして、最初から</button>');
    $("#demo-prepared").onclick = prepareForComparison; $("#demo-reset").onclick = () => reset("arrival");
  }
  function prepareForComparison() {
    game = view().preparations.reduce((state, p) => E.prepare(state, p.id), game);
    result = null; watched = false; phase = "edit"; dialog.close(); render(true); toast("旅の記憶と紙面を残して、島の備えをそろえました。");
  }
  function reset(mode) { game = makeGame(mode, game.scenarioId); plan = [null, null, null]; evidence = {}; activeSlot = 0; inspected = null; result = null; comparison = null; preparationEcho = null; trialHistory.clear(); phase = mode === "prepared" ? "edit" : "prepare"; watched = false; dialog.close(); render(true); }
  function image(id, cls, alt) { return `<img class="${cls}" data-dragon="${esc(id)}" src="images/dragons/${esc(id)}.png" alt="${esc(alt || "")}" decoding="async">`; }
  // Existing neutral-background sprites are keyed at render time, like the main
  // game's renderer. Source artwork is never modified or replaced on disk.
  function sprite(id) {
    if (spriteCache.has(id)) return spriteCache.get(id);
    const promise = new Promise(resolve => {
      const img = new Image(); img.onload = () => {
        try {
          const cv = document.createElement("canvas"), scale = Math.min(1, 640 / Math.max(img.width, img.height));
          cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
          const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, cv.width, cv.height);
          const pixels = cx.getImageData(0, 0, cv.width, cv.height), d = pixels.data, w = cv.width, h = cv.height;
          if (d[3] > 200 && Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) < 34) {
            const base = [d[0], d[1], d[2]], stack = [0, w - 1, (h - 1) * w, w * h - 1], seen = new Uint8Array(w * h);
            while (stack.length) {
              const at = stack.pop(); if (seen[at]) continue; seen[at] = 1;
              const p = at * 4, delta = (d[p] - base[0]) ** 2 + (d[p + 1] - base[1]) ** 2 + (d[p + 2] - base[2]) ** 2;
              if (!d[p + 3] || delta > 34 * 34) continue;
              d[p + 3] = 0; const x = at % w;
              if (x) stack.push(at - 1); if (x < w - 1) stack.push(at + 1); if (at >= w) stack.push(at - w); if (at < w * (h - 1)) stack.push(at + w);
            }
            cx.putImageData(pixels, 0, 0);
          }
          resolve(cv.toDataURL());
        } catch (e) { resolve(img.src); }
      }; img.onerror = () => resolve(null); img.src = "images/dragons/" + id + ".png";
    });
    spriteCache.set(id, promise); return promise;
  }
  function enhanceArt(root) {
    root.querySelectorAll("img[data-dragon]").forEach(img => {
      sprite(img.dataset.dragon).then(src => { if (!img.isConnected) return; if (src) img.src = src; else img.remove(); });
      img.onerror = () => img.remove();
    });
  }
  function render(top) {
    if(fieldCourseId!==null&&fieldCourseId!==game.scenarioId){Object.keys(fieldEvidence).forEach(id=>delete fieldEvidence[id]);publishedFieldReads=[];}
    fieldCourseId=game.scenarioId;
    cancelAnimationFrame(animation);
    document.querySelectorAll(".steps button").forEach(button => { button.classList.toggle("active", button.dataset.step === phase); button.setAttribute("aria-current", button.dataset.step === phase ? "step" : "false"); button.disabled = button.dataset.step === "result" && !result; });
    if (phase === "prepare") renderPreparation(); else if (phase === "edit") renderEditor(); else renderResult();
    if (phase !== "result" && carried && carried.lifeMemory) app.insertAdjacentHTML("afterbegin", lifeMemoryHTML(false));
    if (phase !== "result") app.insertAdjacentHTML("afterbegin", discoveryMemoryHTML(false));
    if (carried) {
      app.insertAdjacentHTML("afterbegin", `<button class="carried-history" id="read-carried"><span>この島で歩いてきた記録</span><b>${carried.scouted.length}頭との縁 · ${num(carried.races)}戦の経験</b><small>${E.getReadingNotes(game).length ? "読みの手帖 " + E.getReadingNotes(game).length + "戦も持ち込み済み · " : ""}持ち込み内容を見る ›</small></button>`);
      $("#read-carried").onclick = showCarried;
    }
    enhanceArt(app);
    if (top) window.scrollTo({ top: 0, behavior: "instant" });
  }
  function showCarried() {
    const names = { furununo: "夜市の古布屋", arcade: "商店街", rondo: "ロンド元宮", hoshimi: "星見の展望台", susufuka: "聖域の遠景" };
    const dragons = view().dragons.filter(d => carried.scouted.includes(d.id));
    modal('<h2>あなたの島から、最後の一面へ。</h2>' +
      `<div class="carried-row"><b>島に整えたもの</b><p>${carried.island.infra >= 1 ? "港の桟橋：準備済みとして持ち込み。" : "桟橋は、この試遊でも整えられます。"}<br>${carried.island.commerce >= 4 ? "市場の拡張：営業の備えとして持ち込み。" : "市場の備えは、この試遊で試せます。"}</p></div>` +
      `<div class="carried-row"><b>迎えた竜と、見てきた走り</b><p>${dragons.length ? dragons.map(d => esc(d.name) + (carried.observations[d.id] ? " · 観察" + num(carried.observations[d.id]) + "回" : "")).join("<br>") : "本編のスカウト記録はまだありません。"}</p></div>` +
      `<div class="carried-row"><b>島での暮らし</b><p>初めて食べた料理 ${carried.meals}品。${carried.visits.length ? "訪ねた場所：" + carried.visits.map(id => esc(names[id])).join("・") + "。" : ""}</p></div>` +
      (carried.mizuMet ? '<div class="carried-row"><b>ミズさんから教わったこと</b><p>人気と実力は、同じではない。この理論を、今回出会う記憶にも結べます。</p></div>' : "") +
      (E.getReadingNotes(game).length ? '<div class="carried-row"><b>中盤から残した、読みの手帖</b>' + E.getReadingNotes(game).map(n => `<p><strong>${esc(n.title)}</strong><br>${esc(n.reviewText)}<br>${esc(n.observation)}</p>`).join("") + '<p>一面の各予想で「根拠」を開くと、この記録を添えられます。</p></div>' : "") +
      '<p>済ませた桟橋修理・市場拡張は、支払い済みの備えとして使います。迎えた竜の予想カードも開きます。残る竜は「取材記録」で試遊用の資料を無料で持ち込めます。</p><p>古布探しや食卓の新しい出会いは、ここで体験する話です。試遊は600コインから始まり、本編の財布・進行・クリア記録は変わりません。</p>');
  }
  function lifeMemoryHTML(resultPhase, success) {
    if (!carried || !carried.lifeMemory || !window.IslandLifeLoop) return "";
    const memory = window.IslandLifeLoop.normalizeMemory(carried.lifeMemory), echo = memory && window.IslandLifeLoop.finishEcho(memory);
    if (!memory || !echo) return "";
    return `<section class="life-purpose${resultPhase ? " life-purpose-result" : ""}"><img src="${esc(memory.image)}" alt="${esc(memory.placeName)}"><div><small>${resultPhase ? success ? "この一日に、つないだ日常" : "もう一度、つなぎたい日常" : "中盤で、わたしの好きになったもの"}</small><h3>${esc(memory.experience.name)}</h3><p>${esc(resultPhase ? echo.body : memory.quote)}</p>${!resultPhase ? `<details><summary>アヤに返した、本音</summary><p>${esc(memory.returnLine)}</p></details>` : ""}</div></section>`;
  }
  function discoveryMemoryHTML(resultPhase) {
    if (!carried || !window.IslandDiscovery) return "";
    const records = window.IslandDiscovery.normalizeExport(carried.discoveries).map(r => window.IslandDiscovery.describeDiscovery(r)).filter(Boolean);
    if (!records.length) return "";
    const cards=records.map(r=>{const f=r.finding,person=f.companionId&&window.IslandDiscoveryStories?.companions[f.companionId];const echo=resultPhase&&person?window.IslandDiscoveryStories.dialogue(f.id,'return',f.companionId).map(l=>`<p>${esc(l.t)}</p>`).join(''):'';return `<article class="discovery-carried"><img src="${esc(f.image)}" alt="${esc(f.title)}"><div><h3>${esc(f.title)}</h3><p>${esc(resultPhase?f.reply:f.body)}</p>${person?`<small>${esc(person.short)}と、一緒に見つけた記憶</small>`:''}${f.souvenir?`<p><b>旅の手帖に残ったもの：${esc(f.souvenir.name)}</b><br>${esc(f.souvenir.body)}</p>`:''}${echo}${r.plan?`<p><b>自分が残した企画：${esc(r.plan.label)}</b><br>${esc(r.plan.detail)}</p>`:''}</div></article>`;}).join('');
    return `<details class="discovery-purpose"${resultPhase?' open':''}><summary>${resultPhase?'勝負の先にも、続いてほしい島':'自分で見つけた、島を支えるもの'} · ${records.length}件</summary>${cards}<p class="discovery-carried-note">調査した暮らしの記録です。企画は提案として持ち込み、今回の収益や工事の完了には加算しません。</p></details>`;
  }
  document.querySelectorAll(".steps button").forEach(button => { button.onclick = () => { if (button.dataset.step === "result" && !result) return; phase = button.dataset.step; render(true); }; });
  function hero() {
    const v = view();
    return '<section class="hero"><img class="hero-scene" src="images/story/late/arena_before_dawn.webp" alt="夜明け前の聖龍レース場">' + image("poro", "hero-dragon", "相棒のポロ") +
      `<div class="hero-copy"><h2>最後の一面</h2><p>${esc(v.scenario.condition)}<span class="condition">神眼の予言：ライオウ、1着。</span></p></div></section>`;
  }
  function prepStrip() {
    return '<div class="prep-strip">' + [["harbor", "港の桟橋"], ["market", "市場の灯り"], ["scout", "竜との縁"]].map(([id, title]) => `<span class="${game.prepared[id] ? "lit" : ""}">${game.prepared[id] ? "✓" : "○"} <strong>${title}</strong></span>`).join("") + '<button id="review-prep">見直す</button></div>';
  }
  function bindReview() { const b = $("#review-prep"); if (b) b.onclick = () => { phase = "prepare"; render(true); }; }
  function showScoutNotes() {
    const v = view();
    modal('<h2>竜と出会った日の記録</h2><p>強さを変えるのではなく、走りを知る。コースの条件と、迎えた竜の個性を読み比べよう。</p>' +
      `<div class="notebook-course"><b>${esc(v.scenario.title)}</b><p>${esc(v.scenario.condition)}</p></div>` +
      '<div class="scout-gallery">' + v.dragons.map(d => `<article class="scout-note">${image(d.id, "", "")}<b>${esc(d.name)}</b>${carried ? `<small class="record-source">${carried.scouted.includes(d.id) ? "本編で迎えた竜" + (carried.observations[d.id] ? " · 観察" + num(carried.observations[d.id]) + "回" : "") : "試遊用の取材資料"}</small>` : ""}<p><strong>${esc(d.trait)}</strong><br>${esc(d.note)}</p></article>`).join("") + '</div>' +
      (game.prepared.scout ? '<button class="primary" id="close-notebook">この記録で、読みを考える</button>' : '<button class="primary" id="confirm-scout">この記録を、一面へ持ち込む ' + arrow + '</button>'));
    const confirm = $("#confirm-scout"), close = $("#close-notebook");
    if (confirm) confirm.onclick = () => { applyPreparation("scout"); dialog.close(); };
    if (close) close.onclick = () => dialog.close();
  }
  function renderPreparation() {
    const v = view(), symbols = { harbor: "⚓", market: "灯", scout: "竜" }, labels = { harbor: "港", market: "市場", scout: "取材" };
    const done = Object.values(game.prepared).filter(Boolean).length;
    app.innerHTML = '<section class="island-view"><img src="images/story/late/island_pressure.webp" alt="星空の下で灯りを守る島" style="filter:brightness(' + (1 + done * .05) + ')">' +
      '<div class="island-title"><h2>この島で、迎えよう。</h2><p>港に人を、市場に灯りを。<br>竜たちを知る記録も、最後の紙面の力になる。</p></div>' +
      v.preparations.map(p => `<button class="island-pin${p.done ? " done" : ""}" data-prep="${p.id}" aria-label="${esc(p.title)}${p.done ? "・準備済み" : ""}">${p.done ? "✓" : symbols[p.id]}</button>`).join("") + '</section>' +
      `<div class="prep-account"><span>島の支度に使えるコイン</span><b>${num(v.coins)} <small>枚</small></b></div>` +
      '<section class="prep-list">' + v.preparations.map(p => `<button class="prep-task${p.done ? " done" : ""}" data-prep="${p.id}"><span class="prep-symbol">${symbols[p.id]}</span><span class="prep-copy"><b>${esc(p.title)}</b><small>${esc(p.description)}</small></span><span class="prep-cost">${p.done ? "準備済み" : p.cost ? num(p.cost) + " 枚" : "記録を開く"}</span></button>`).join("") + '</section>' +
      preparationImpactHTML() + journeyHTML() + '<p class="prep-foot">この試作では、本編での島づくりとスカウトを短縮して体験します。先に済ませた準備も、同じ力として使えます。</p>' +
      '<div class="prep-actions"><button class="primary" id="to-editor">予想を組む ' + arrow + '</button><button class="text-button" id="compare-prepared">島の備えをそろえて、続きから試す</button></div>';
    app.querySelectorAll("[data-prep]").forEach(b => { b.onclick = () => {
      const p = v.preparations.find(x => x.id === b.dataset.prep);
      if (p.id === "scout") { showScoutNotes(); return; }
      if (p.done) { modal(`<h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><p>この準備はすでに紙面と島の運営へ反映されています。</p>`); return; }
      {
        modal(`<h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><p>支度のコイン <b>${num(game.coins)} → ${num(game.coins - p.cost)}枚</b></p><button class="primary" id="confirm-prep">${labels[p.id]}を整える・${num(p.cost)}枚 ${arrow}</button>`);
        $("#confirm-prep").disabled = game.coins < p.cost;
        $("#confirm-prep").onclick = () => { applyPreparation(p.id); dialog.close(); };
      }
    }; });
    $("#to-editor").onclick = () => { phase = "edit"; render(true); };
    $("#compare-prepared").onclick = prepareForComparison;
    bindJourney();
  }
  function journeyHTML() {
    if (!E.getJourneyView) return "";
    const j = E.getJourneyView(game), owned = j.memories.filter(m => m.owned);
    return '<section class="journey-section"><div class="section-head"><h3>決戦の前に、島を歩く。</h3><p>持ち帰った記憶 ' + owned.length + ' / ' + j.memories.length + '</p></div>' +
      '<p class="journey-intro">あの人の言葉を、最後の一面へ。<br>気になる場所をひとつ。すべて巡らなくても出発できます。</p><div class="journey-places">' +
      j.places.map(p => `<button class="journey-place" data-journey-place="${esc(p.id)}"><img src="${esc(p.image)}" alt="" loading="lazy"><small>${p.complete ? "もう一度、会いに" : "島の寄り道"}</small><b>${esc(p.title)}</b><p>${esc(p.subtitle)}</p>${p.complete ? '<span class="journey-stamp">一頁を持ち帰った</span>' : ""}</button>`).join("") + '</div>' +
      (owned.length ? `<details class="journey-shelf" id="journey-notebook"><summary>旅の手帖 · ${owned.length}つの出会いと、今日の装い</summary><div><p class="cover-effect">表紙に添える記憶をひとつ選ぶと、その人に縁のある応援客を招きます。人数の上乗せではなく、誰を迎えるかの選択です。</p>` +
        `<button class="memory-cover" data-cover-memory="" aria-pressed="${!j.coverMemory}">旅の記憶を添えない<small>通常の応援客を迎える</small></button>` +
        owned.map(m => `<button class="memory-cover" data-cover-memory="${esc(m.id)}" aria-pressed="${j.coverMemory === m.id}"><span>${j.coverMemory === m.id ? "表紙に採用中" : "表紙に添える"}</span><b>${esc(m.title)}</b><small>${esc(m.person)}「${esc(m.quote)}」</small><small>${esc(m.readerGroup.label)} · ${m.readerGroup.fans.map(f => esc(f.name)).join("・")}</small></button>`).join("") +
        '<h3>今日の装い</h3><p class="cover-effect">気分で選ぶ、最後の一日の姿。着替えは自由です。</p><div class="journey-wardrobe">' + j.outfits.filter(o => o.owned).map(o => `<button class="outfit-option" data-wear="${esc(o.id)}" aria-pressed="${o.equipped}"><img src="${esc(o.image)}" alt="${esc(o.title)}" loading="lazy"><b>${esc(o.title)}${o.equipped ? " · 着用中" : ""}</b></button>`).join("") + '</div></div></details>' : "") + '</section>';
  }
  function bindJourney() {
    app.querySelectorAll('[data-journey-place]').forEach(b => { b.onclick = () => { game = E.visitJourney(game, b.dataset.journeyPlace); showJourneyScene(); }; });
    app.querySelectorAll('[data-cover-memory]').forEach(b => { b.onclick = () => {
      game = E.selectCoverMemory(game, b.dataset.coverMemory || null); result = null; watched = false;
      render(false); const shelf = $("#journey-notebook"); if (shelf) shelf.open = true; sound("pick"); toast("この一面で迎える人を、選びました。");
    }; });
    app.querySelectorAll('[data-wear]').forEach(b => { b.onclick = () => { game = E.wearOutfit(game, b.dataset.wear); render(false); const shelf = $("#journey-notebook"); if (shelf) shelf.open = true; sound("pick"); toast("今日の装いを、選びました。"); }; });
  }
  function showJourneyScene() {
    const j = E.getJourneyView(game), scene = j.activeScene;
    if (!scene) { dialog.close(); result = null; watched = false; render(false); sound("prep"); toast("島での一頁を、手帖へ。"); return; }
    const cloth = scene.placeId === "furununo" && scene.choices.some(c => c.id === "turn_hem");
    modal(`<div class="journey-picture"><img class="journey-scene${scene.image.includes('/cast/') ? " portrait" : ""}" src="${esc(scene.image)}" alt="${cloth ? "古布屋の店先。金糸と裾の印をタップして調べられます" : ""}">` +
      (cloth ? '<button class="cloth-hotspot gold" data-journey-choice="look_gold"><i></i>金糸を調べる</button><button class="cloth-hotspot hem" data-journey-choice="turn_hem"><i></i>ほつれた裾</button>' : "") +
      `</div><p class="scene-kicker">決戦までの、小さな旅</p><h2>${esc(scene.title)}</h2><p class="scene-dialogue">${esc(scene.body).replace(/\n/g, "<br>")}</p>` +
      (j.notice && j.notice.kind === "hint" ? `<div class="journey-discovery"><h3>${esc(j.notice.title)}</h3><p>${esc(j.notice.body).replace(/\n/g, "<br>")}</p></div>` : "") +
      '<div class="journey-choices">' + scene.choices.map(c => {
        const outfit = c.id === "keep_traveler" ? j.outfits.find(o => o.id === "traveler") : c.id === "tailor_newspaper" ? j.outfits.find(o => o.id === "newspaper") : null;
        return `<button class="journey-choice${outfit ? " outfit-choice" : ""}" data-journey-choice="${esc(c.id)}">${outfit ? `<img src="${esc(outfit.image)}" alt="">` : ""}<span>${esc(c.label)}${c.detail ? `<small>${esc(c.detail)}</small>` : ""}</span></button>`;
      }).join("") + '</div>');
    dialogBody.querySelectorAll('[data-journey-choice]').forEach(b => { b.onclick = () => {
      try { game = E.chooseJourney(game, b.dataset.journeyChoice); result = null; watched = false; render(false); sound("pick"); showJourneyScene(); }
      catch (error) { toast(error.message); }
    }; });
    dialogBody.scrollTop = 0; dialog.scrollTop = 0;
  }
  function coverHTML() {
    if (!E.getJourneyView) return "";
    const j = E.getJourneyView(game), memory = j.memories.find(m => m.id === j.coverMemory && m.owned);
    return `<section class="cover-in-editor"><img src="${esc(j.currentOutfit.image)}" alt="${esc(j.currentOutfit.title)}"><div><small>旅から持ち帰った、今日の一面</small><b>${memory ? esc(memory.title) : "あの人の言葉を、予想の根拠へ。"}</b><p>${memory ? esc(memory.person) + "との記憶 · " + esc(memory.readerGroup.label) : "島を歩くと、出会いと読みの手掛かりが残る。"}</p></div><button id="return-journey">島を歩く</button></section>`;
  }
  const fieldEvidence = {};
  let fieldCourseId=null,publishedFieldReads=[];
  function fieldRecords() { return carried && window.IslandDiscovery ? window.IslandDiscovery.normalizeExport(carried.discoveries).filter(r=>['dragon_trace','legend_ring'].includes(r.caseId)).map(r=>window.IslandDiscovery.describeDiscovery(r)).filter(Boolean) : []; }
  function fieldReason(id){return id==='dragon_trace'?'羽色だけで決めず、止まった向きと風を一緒に見た。今回の竜はセラムとは別。取材記録のしぐさとコース条件を合わせて考える。':'伝説の名だけでなく、傷と使い方を照合した。今回も評判だけで決めず、区間の記録と運営の条件まで確かめる。';}
  function showFieldEvidence(index){
    const id=plan[index],offer=view().offers.find(o=>o.id===id);if(!offer)return;
    modal(`<h2>${esc(offer.title)}に、島で覚えた見方を</h2><p>この経験を思い出して、今回の取材記録をどう読む？</p>`+fieldRecords().map(r=>`<button class="evidence-memory-card field-pick" data-field-pick="${esc(r.finding.id)}"><img src="${esc(r.finding.image)}" alt=""><b>${esc(r.finding.title)}</b><small>${esc(fieldReason(r.finding.id))}</small></button>`).join('')+'<p>観察の方法を添える記録です。今回の着順・配当・読者数は変わりません。</p><button class="text-button" id="clear-field-evidence">この経験を外す</button>');
    dialogBody.querySelectorAll('[data-field-pick]').forEach(b=>b.onclick=()=>showFieldLens(index,b.dataset.fieldPick));
    $('#clear-field-evidence').onclick=()=>{delete fieldEvidence[id];dialog.close();renderKeepingTray();};
  }
  function captureFieldRead(index,read){const v=view();return window.IslandFieldRead?.capture(read.caseId,read.lensId,{sourceTitle:fieldRecords().find(r=>r.finding.id===read.caseId)?.finding.title||'',offer:v.offers.find(o=>o.id===plan[index]),dragons:v.dragons,scenario:v.scenario,slot:v.editorSlots[index],slotIndex:index,planOffers:plan.map(id=>v.offers.find(o=>o.id===id)).filter(Boolean)});}
  function buildFieldReads(){return plan.map((id,index)=>{const read=fieldEvidence[id];return read&&read.courseId===game.scenarioId?captureFieldRead(index,read):null;}).filter(Boolean);}
  function showFieldLens(index,caseId){
    if(!fieldRecords().some(r=>r.finding.id===caseId)||!window.IslandFieldRead)return;
    const options=window.IslandFieldRead.options(caseId);let lensId=fieldEvidence[plan[index]]?.caseId===caseId?fieldEvidence[plan[index]].lensId:'';
    modal('<h2>今回の、何と何を照合する？</h2>'+options.map(l=>`<button class="field-lens" data-field-lens="${esc(l.id)}">${esc(l.label)}</button>`).join('')+'<div class="field-read-preview" aria-live="polite"></div><button class="primary" id="save-field-read" disabled>この見立てを、発行する読みへ</button><button class="text-button" id="back-field-memory">思い出す経験を選び直す</button>');
    const update=()=>{const read=lensId&&captureFieldRead(index,{caseId,lensId});dialogBody.querySelectorAll('[data-field-lens]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fieldLens===lensId)));$('.field-read-preview').innerHTML=read?'<small>今回の公開取材と、的中条件</small>'+read.facts.map(f=>`<p>${esc(f)}</p>`).join('')+`<blockquote>${esc(read.claim)}</blockquote><small>この見立てを発行時に残し、実着順と並べて振り返ります。</small>`:'';$('#save-field-read').disabled=!read;};
    dialogBody.querySelectorAll('[data-field-lens]').forEach(b=>b.onclick=()=>{lensId=b.dataset.fieldLens;update();});update();
    const rethink=document.createElement('button');rethink.className='secondary';rethink.id='rethink-field-plan';rethink.textContent='掲載を見直すため、紙面に戻る';rethink.onclick=()=>{delete fieldEvidence[plan[index]];activeSlot=index;dialog.close();renderKeepingTray();toast('この枠の予想を選び直せます。');};$('#save-field-read').insertAdjacentElement('afterend',rethink);
    $('#save-field-read').textContent=lensId==='overlap'?'この重なり方を選んで、掲載する':'この見立てを選んで、掲載する';
    dialogBody.querySelectorAll('[data-field-lens]').forEach(b=>b.addEventListener('click',()=>{$('#save-field-read').textContent=b.dataset.fieldLens==='overlap'?'この重なり方を選んで、掲載する':b.dataset.fieldLens==='conditions'?'持ち味を期待して、この予想を掲載する':b.dataset.fieldLens==='limits'?'気になる条件も承知で、この予想を残す':'この読者への届け方を選んで、掲載する';}));
    $('#save-field-read').onclick=()=>{fieldEvidence[plan[index]]={caseId,lensId,courseId:game.scenarioId};result=null;watched=false;dialog.close();renderKeepingTray();toast('今回の資料と照合する見立てを残した。');};
    $('#back-field-memory').onclick=()=>showFieldEvidence(index);
  }
  function fieldEvidenceResultHTML(r){return publishedFieldReads.length?'<section class="field-result"><h3>発行した見立てと、今回の答え合わせ</h3>'+publishedFieldReads.map(read=>{const p=r.predictions[read.slotIndex];if(!p)return '';return `<article><b>${esc(read.offerTitle)}</b><small>${esc(read.courseTitle)} · ${esc(read.slotTitle)}</small><small>思い出した経験：${esc(read.sourceTitle)}</small><blockquote>${esc(read.claim)}</blockquote><p class="field-actual">実着順：${read.ids.map(id=>{const row=r.race.rows.find(row=>row.id===id);return row?esc(row.name)+row.rank+'着':'';}).join('・')} ／ ${p.hit?'今回の予想は的中':'今回は届かなかった'}</p>${read.lensId==='audience'?`<p>この予想への投票量 ${num(p.stake)}枚。一日全体の運営収支 ${signed(r.operatingProfit)}枚。</p>`:''}<p>着順だけで、この見方そのものが正しかったとは決めません。発行前に比べた資料も振り返ろう。</p><details><summary>発行時に比べた公開資料</summary>${read.facts.map(f=>`<p>${esc(f)}</p>`).join('')}</details></article>`;}).join('')+'</section>':'';}
  function evidenceHTML(id, index) {
    if (!id || !E.getJourneyView) return "";
    const j = E.getJourneyView(game), notes = E.getReadingNotes(game),fields=fieldRecords(); if (!j.memories.some(m => m.owned) && !notes.length&&!fields.length) return "";
    const e = evidence[id], m = e && j.memories.find(m => m.id === e.memoryId), t = e && j.theories.find(t => t.id === e.theoryId), n = e && notes.find(n => n.id === e.readingNoteId);
    const read=fieldEvidence[id]&&captureFieldRead(index,fieldEvidence[id]);
    return `<button class="evidence-button${m && t || n ? " woven" : ""}" data-evidence="${index}">${n ? "第" + n.completedRace + "戦の「" + esc(n.reasonLabel) + "」を、今回へ" : m && t ? esc(m.title) + " × " + esc(t.title) : "＋ " + (notes.length ? "中盤で残した読みを、今回の根拠に" : "出会いと理論を、読みの根拠に添える")}</button>`+(fields.length?`<button class="evidence-button field-evidence-button${read?' woven':''}" data-field-evidence="${index}">${read?'✓ '+esc(read.lensLabel):'＋ 竜の痕跡や伝説の探索を、今回の読みへ'}</button>${read?`<p class="field-draft">発行する見立て：${esc(read.claim)}</p>`:''}`:'');
  }
  function showEvidence(index) {
    const id = plan[index], offer = view().offers.find(o => o.id === id), j = E.getJourneyView(game);
    if (!offer) return;
    const current = evidence[id] || {}, memories = j.memories.filter(m => m.owned), theories = j.theories.filter(t => t.owned), notes = E.getReadingNotes(game);
    let memoryId = current.memoryId || "", theoryId = current.theoryId || "", readingNoteId = current.readingNoteId || "";
    modal(`<p class="scene-kicker">0${index + 1} · ${esc(view().editorSlots[index].title)}</p><h2>${esc(offer.title)}<br>なぜ、そう読む？</h2><p>旅で残した自分の読みも、出会った人の言葉も。今回の予想に、どの経験を結びつける？</p>` +
      (notes.length ? '<p class="evidence-label">中盤からの、わたしの読み</p><div class="journal-evidence-notes" role="group" aria-label="本編で残した読み">' + notes.map(n => `<button class="journal-evidence-note" data-journal-pick="${esc(n.id)}" aria-pressed="${readingNoteId === n.id}">${image(n.selections[0].dragonId, "", "")}<span><small>第${n.completedRace}戦 · ${esc(n.reasonLabel)}</small><b>${esc(n.raceName)}</b><small>${n.selections.map(s => esc(s.name) + s.rank + "着").join("・")} · ${n.hit ? "的中した読み" : "外れた読み"}</small></span></button>`).join("") + '</div><p class="evidence-description" id="journal-description"></p>' : "") +
      `<div class="evidence-sections${memories.length ? "" : " no-memories"}${theories.length ? "" : " no-theories"}"><p class="evidence-label">思い出す出会い</p><div class="evidence-memories" role="group" aria-label="思い出す出会い">` +
      memories.map(m => `<button class="evidence-memory-card" data-memory-pick="${esc(m.id)}" aria-pressed="${memoryId === m.id}"><img src="${esc(m.image)}" alt=""><b>${esc(m.title)}</b><small>${esc(m.person)}</small></button>`).join("") + '</div><p class="evidence-description" id="memory-description"></p><p class="evidence-label">その経験から、どう考える？</p><div class="evidence-theories" role="group" aria-label="使う理論">' +
      theories.map(t => `<button class="theory-pick" data-theory-pick="${esc(t.id)}" aria-pressed="${theoryId === t.id}">${esc(t.title)}</button>`).join("") + '</div><p class="evidence-description" id="theory-description"></p></div><div class="woven-preview" id="woven-preview" aria-live="polite"></div><p class="evidence-summary">実際の走りと読者の反応で振り返るための根拠です。過去の的中も理論も、今回の的中率を変えません。</p><button class="primary" id="save-evidence">この経験を、読みの根拠にする</button><button class="text-button" id="clear-evidence">根拠を外す</button>');
    const update = () => {
      const m = memories.find(m => m.id === memoryId), t = theories.find(t => t.id === theoryId);
      $("#memory-description").textContent = m ? m.person + "「" + m.quote + "」 " + m.body : notes.length ? "出会いの記憶を重ねることもできます。手帖の一戦だけでも添えられます。" : "島で持ち帰った記憶から選べます。";
      $("#theory-description").textContent = t ? t.body + " — " + t.source.replace(/（試作の取材）|（本編の出会いを振り返る）/g, "") : notes.length ? "理論は任意。手帖の一戦だけでも、今回の根拠に添えられます。" : "出会いを通じて学んだ理論から選べます。";
      const n = notes.find(n => n.id === readingNoteId);
      $("#save-evidence").disabled = !(m && t || n);
      if ($("#journal-description")) $("#journal-description").textContent = n ? n.reviewText + " " + n.observation : "以前の一戦を選ぶと、今回の別の竜へ読み方を応用できます。もう一度押すと外せます。";
      dialogBody.querySelectorAll('[data-journal-pick]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.journalPick === readingNoteId)));
      dialogBody.querySelectorAll('[data-memory-pick]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.memoryPick === memoryId)));
      dialogBody.querySelectorAll('[data-theory-pick]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.theoryPick === theoryId)));
      const draft = annotations(); draft[index] = m && t || n ? { memoryId: m ? memoryId : null, theoryId: t ? theoryId : null, readingNoteId: n ? readingNoteId : null } : null;
      const preview = E.preview(game, plan, draft), feature = preview.valid && preview.features.find(f => f.id === id), e = feature && feature.evidence;
      $("#woven-preview").innerHTML = e ? `<small>あなたの一面に添える読み</small><b>${esc(e.claim)}</b><p>${esc(e.connection)}</p>` : notes.length ? '<small>手帖の一戦、または出会いの記憶と理論を選ぶと、今回の読みにつながります。</small>' : '<small>記憶と理論がそろうと、ひとつの読みになる。</small>';
    };
    dialogBody.querySelectorAll('[data-memory-pick]').forEach(b => { b.onclick = () => { memoryId = b.dataset.memoryPick; sound("pick"); update(); }; });
    dialogBody.querySelectorAll('[data-journal-pick]').forEach(b => { b.onclick = () => { readingNoteId = b.dataset.journalPick === readingNoteId ? "" : b.dataset.journalPick; sound("pick"); update(); }; });
    dialogBody.querySelectorAll('[data-theory-pick]').forEach(b => { b.onclick = () => { theoryId = b.dataset.theoryPick; sound("pick"); update(); }; }); update();
    $("#save-evidence").onclick = () => { evidence[id] = { memoryId: memoryId || null, theoryId: theoryId || null, readingNoteId: readingNoteId || null }; result = null; watched = false; dialog.close(); renderKeepingTray(); sound("prep"); toast("旅の記憶が、ひとつの読みになった。"); };
    $("#clear-evidence").onclick = () => { delete evidence[id]; result = null; watched = false; dialog.close(); renderKeepingTray(); };
  }
  function applyPreparation(id) {
    try {
      const before = game, oldReport = E.preview(before, plan);
      game = E.prepare(game, id);
      preparationEcho = { id, before: oldReport, after: E.preview(game, plan), oldOffers: E.getView(before).offers.filter(o => !o.locked).length, newOffers: view().offers.filter(o => !o.locked).length };
      result = null; watched = false; sound("prep"); render(false); app.querySelectorAll('[data-prep="' + id + '"]').forEach(x => x.classList.add("prep-flash")); toast("島の備えが、ひとつ整った。");
    }
    catch (e) { toast("支度のコインが足りません。"); }
  }
  function preparationImpactHTML() {
    const p = preparationEcho; if (!p) return "";
    let copy = p.id === "scout" ? `迎えた竜の記録で、選べる予想が ${p.oldOffers} → ${p.newOffers}枚に。` : p.id === "market" ? "市場が営業を再開。賭けの当たり外れとは別に、食事や買い物が島を支える。" : "桟橋を直した港に、島の外から一面を読みに来る人が増えた。";
    if (p.before.valid && p.after.valid) {
      if (p.before.commerceIncome !== p.after.commerceIncome) copy += ` 営業収入の見込み ${num(p.before.commerceIncome)} → ${num(p.after.commerceIncome)}枚。`;
      if (chosen().length && p.before.audience.readers !== p.after.audience.readers) copy += ` 今の紙面が届く読者 ${num(p.before.audience.readers)} → ${num(p.after.audience.readers)}人。`;
    }
    return `<div class="preparation-impact"><b>積み上げた備えが、この一日に。</b><p>${esc(copy)}</p></div>`;
  }
  function slotHTML(offer, index, audience) {
    const extra = evidenceHTML(offer && offer.id, index);
    return `<div class="feature-slot${offer ? " filled" : ""}${extra ? " has-evidence" : ""}${index === activeSlot ? " active" : ""}" data-audience="${esc(audience ? audience.id : "")}" data-slot="${index}"><span class="slot-number">0${index + 1}</span>` +
      (offer ? image(offer.ids[offer.ids.length - 1], "slot-art", "") : "") +
      `<button class="slot-target" aria-label="一面の${index + 1}枠目${audience ? "・" + esc(audience.title) : ""}${offer ? "・" + esc(offer.title) : "・空き"}" aria-pressed="${index === activeSlot}">${audience ? `<span class="slot-role">${esc(audience.title)}</span>` : ""}<span class="slot-title">${offer ? esc(offer.title) : "予想をここへ"}</span><span class="slot-sub">${offer ? offer.type === "place" ? "複勝 · 2着以内を読む" : "ワイド · 2頭の上位を読む" : "下のカードをタップして配置"}</span></button>` +
      (offer ? `<button class="slot-remove" data-remove="${index}" aria-label="${index + 1}枠目の予想を外す">×</button>` : "") + extra + '</div>';
  }
  function renderEditor() {
    const v = view(), report = E.preview(game, plan, annotations());
    if (!inspected) inspected = chosen()[0] || v.offers.find(o => !o.locked).id;
    const offer = v.offers.find(o => o.id === inspected);
    app.innerHTML = hero() + prepStrip() + coverHTML() + fanInterestHTML(v) + trialMemoryHTML(report) + '<div class="section-head"><h3>3つの読者へ、あなたの一面を。</h3><p>' + chosen().length + ' / 3</p></div>' +
      '<section class="editor-slots" aria-label="一面の予想">' + plan.map((id, i) => slotHTML(v.offers.find(o => o.id === id), i, v.editorSlots && v.editorSlots[i])).join("") + '</section>' +
      '<div class="editing-guidance"><p class="editing-hint">2枚以上的中 ＋ 島の運営収支0以上が目標。<br>同じ予想でも、届ける読者で票と配当が変わる。</p><button class="text-button" id="read-notebook">取材ノート</button><button class="text-button" id="read-audiences">枠の違い</button></div>' +
      '<div class="offer-tray" aria-label="取材から選ぶ予想カード">' + v.offers.map(o =>
        `<button class="offer-card ${o.type}${plan.includes(o.id) ? " selected" : ""}${o.locked ? " locked" : ""}" data-offer="${o.id}" draggable="${!o.locked}" aria-pressed="${plan.includes(o.id)}" aria-label="${esc(o.title)}${o.locked ? "・取材記録が必要" : "を一面に載せる"}"><span class="card-world"></span>` +
        image(o.ids[0], "offer-art", "") + (o.ids[1] ? image(o.ids[1], "offer-art pair-art", "") : "") +
        `<span class="offer-text"><span class="offer-type">${o.locked ? "取材前" : o.type === "place" ? "複勝" : "ワイド"}</span><strong class="offer-name">${esc(o.title)}</strong><span class="offer-risk">${esc(o.ids.map(id => v.dragons.find(d => d.id === id).trait).join(" "))}</span>${candidateOdds(o)}</span></button>`).join("") + '</div>' +
      `<div class="reason-panel"><p><b>${offer ? esc(offer.title) : ""}</b><br>${offer ? esc(offer.risk) : ""} <button id="inspect-offer">記録と見込みを見る</button></p></div>` +
      `<div class="story-quote">${esc(v.scenario.condition)}<b>今日のコース — ${esc(v.scenario.title)}</b></div>` +
      correlationHTML() + poolHTML(report) + (report.valid ? report.warnings.map(w => `<p class="alert">${esc(w)}</p>`).join("") : "") +
      '<div class="publish-dock"><div class="forecast-row"><span>一日の運営収支・見込み</span>' + (report.valid ? `<b class="${report.estimatedProfit.min < 0 ? "risk" : ""}">${signed(report.estimatedProfit.min)} 〜 ${signed(report.estimatedProfit.max)} 枚</b>` : '<b>予想を選んでください</b>') +
      '</div>' + liveFeatureHTML(report) + '<button class="primary" id="publish"' + (chosen().length !== 3 || !report.valid ? " disabled" : "") + '>この一面を届ける ' + arrow + '</button><button class="dock-secondary" id="review-dock">島の備えを見直す</button></div>';
    bindReview();
    const journeyButton = $("#return-journey"); if (journeyButton) journeyButton.onclick = () => { phase = "prepare"; render(true); const section = $(".journey-section"); if (section) section.scrollIntoView({ block: "start", behavior: reduce ? "instant" : "smooth" }); };
    app.querySelectorAll('[data-evidence]').forEach(b => { b.onclick = () => showEvidence(+b.dataset.evidence); });
    app.querySelectorAll('[data-field-evidence]').forEach(b => { b.onclick = () => showFieldEvidence(+b.dataset.fieldEvidence); });
    $("#read-notebook").onclick = showScoutNotes;
    $("#read-audiences").onclick = () => {
      modal('<h2>誰に、この予想を届ける？</h2>' + (v.editorSlots || []).map(slot => `<h3>${esc(slot.title)}</h3><p>${esc(slot.description)}</p>`).join("") + '<h3>応援の多さと、勝ち負けは別</h3><p>ファンが多い竜でも、予想が的中するとは限りません。取材とコース条件で走りを読み、その読みを誰に届けるか選びましょう。</p>');
    };
    $("#review-dock").onclick = () => { phase = "prepare"; render(true); };
    app.querySelectorAll(".slot-target").forEach(button => { button.onclick = () => { activeSlot = Number(button.parentElement.dataset.slot); if (plan[activeSlot]) inspected = plan[activeSlot]; renderKeepingTray(); }; });
    app.querySelectorAll("[data-remove]").forEach(button => { button.onclick = () => { const index = +button.dataset.remove; plan[index] = null; activeSlot = index; result = null; watched = false; sound("remove"); renderKeepingTray(); announce((index + 1) + "枠目だけを空けました。他の記事の届け先は変わりません"); }; });
    app.querySelectorAll("[data-offer]").forEach(button => {
      button.onclick = () => chooseOffer(button.dataset.offer, button.getBoundingClientRect());
      button.ondragstart = event => { if (button.draggable) { event.dataTransfer.setData("text/plain", button.dataset.offer); event.dataTransfer.effectAllowed = "move"; } else event.preventDefault(); };
    });
    app.querySelectorAll("[data-slot]").forEach(slot => {
      slot.ondragover = event => { event.preventDefault(); slot.classList.add("drop-ready"); };
      slot.ondragleave = () => slot.classList.remove("drop-ready");
      slot.ondrop = event => { event.preventDefault(); activeSlot = +slot.dataset.slot; chooseOffer(event.dataTransfer.getData("text/plain")); };
    });
    $("#inspect-offer").onclick = () => showOffer(inspected);
    $("#publish").onclick = publish;
  }
  function fanInterestHTML(v) {
    const fans = (v.scenario.fanInterest || []).slice().sort((a, b) => b.interest - a.interest).slice(0, 2);
    if (!fans.length) return "";
    return `<div class="fan-interest"><span>今日の応援客</span><b>${fans.map(f => esc(f.name)).join("・")}</b><small>応援の多さ ≠ 的中率</small></div>`;
  }
  function trialMemoryHTML(report) {
    const old = trialHistory.get(game.scenarioId); if (!old) return "";
    return `<details class="trial-memory"><summary>前回 ${old.result.hits}/3 的中・収支 ${signed(old.result.operatingProfit)}枚<span>比べる</span></summary><p>同じ公正なレースの記録です。紙面の選び方と届け方を変えて比べられます。</p>` +
      old.result.predictions.map(p => `<div class="memory-pick"><span>${p.hit ? "✓" : "×"} ${esc(p.title)}</span><small>${p.ids.map(id => { const d = old.result.race.rows.find(r => r.id === id); return esc(d.name) + d.rank + "着"; }).join("・")}</small></div>`).join("") +
      (report.valid ? `<div class="memory-comparison"><span>読者 前回 ${num(old.result.audience.readers)} → 今回見込み ${num(report.audience.readers)}人</span><span>市場 前回 ${num(old.result.commerceIncome)} → 今回見込み ${num(report.commerceIncome)}枚</span><span>今回の運営収支見込み ${signed(report.estimatedProfit.min)}〜${signed(report.estimatedProfit.max)}枚</span></div>` : "") + '</details>';
  }
  function correlationHTML() {
    const v = view(), cards = chosen().map(id => v.offers.find(o => o.id === id));
    const dependencies = v.dragons.filter(d => d.id !== v.scenario.oracleWinner).map(d => ({ dragon: d, cards: cards.filter(o => o.ids.includes(d.id)) })).filter(x => x.cards.length >= 2);
    if (!dependencies.length) return "";
    return '<div class="linked-predictions">' + dependencies.map(x => `<p><b>${esc(x.dragon.name)}に${x.cards.length}枚が連動。</b> ${esc(x.dragon.name)}が${x.cards.every(o => o.type === "place") ? "2" : "3"}着外なら、この${x.cards.length}枚は一緒に外れます。</p>`).join("") + '</div>';
  }
  function liveFeatureHTML(report) {
    const feature = report.valid && report.features.find(f => f.id === inspected);
    if (!feature) return '<div class="dock-feature">竜を知る記録から、あなたの予想を選ぼう。</div>';
    return `<div class="dock-feature"><span>${esc(feature.title)}${feature.audienceLabel ? " · " + esc(feature.audienceLabel) : ""}</span><b>読者見込み ${num(feature.readers)}人 · 的中時 ${num(feature.odds.min)}${feature.odds.max !== feature.odds.min ? "–" + num(feature.odds.max) : ""}倍</b><small>${esc(feature.reaction)}</small></div>`;
  }
  function candidateOdds(offer) {
    if (offer.locked) return '<span class="card-odds muted">記録があれば、読める。</span>';
    const report = E.preview(game, planWithOffer(offer.id, activeSlot));
    const feature = report.valid && report.features.find(f => f.id === offer.id);
    if (!feature) return "";
    return `<span class="card-odds"><small>選択中の枠で、的中時</small><b>${num(feature.odds.min)}${feature.odds.max !== feature.odds.min ? "–" + num(feature.odds.max) : ""}<small> 倍</small></b></span>`;
  }
  function poolHTML(report) {
    if (!report.valid) return "";
    const totals = ["win", "place", "wide"].map(k => report.pools[k].total), max = Math.max(...totals);
    return '<details class="pool-view"><summary>読者の反応と、券種ごとの売上</summary>' + ["win", "place", "wide"].map((k, i) => `<div class="pool-row"><span>${["単勝", "複勝", "ワイド"][i]}</span><div class="pool-bar"><i style="width:${Math.max(2, totals[i] / max * 100)}%;background:${["#78849f", "#a49cff", "#83d9da"][i]}"></i></div><small>${num(totals[i])}枚</small></div><p class="pool-detail">最多の予想へ ${Math.round(report.pools[k].concentration * 100)}%の票 · 運営取り分見込み ${signed(report.pools[k].estimatedNet.min)}〜${signed(report.pools[k].estimatedNet.max)}枚</p>`).join("") +
      `<p class="pool-note">特集を読む人 ${num(report.audience.readers)}人 ／ 市場の営業収入 ${num(report.commerceIncome)}枚。<br>単勝はライオウに集中したまま。ほかの券種の売上とは混ぜません。</p></details>`;
  }
  function renderKeepingTray() {
    const tray = $(".offer-tray"), offset = tray ? tray.scrollLeft : 0, y = window.scrollY;
    const focused = document.activeElement;
    const key = focused && focused.dataset ? (focused.dataset.offer ? '[data-offer="' + focused.dataset.offer + '"]' : null) : null;
    render(false); if ($(".offer-tray")) $(".offer-tray").scrollLeft = offset; window.scrollTo(0, y);
    if (key && $(key)) $(key).focus({ preventScroll: true });
  }
  function chooseOffer(id, fromRect) {
    const offer = view().offers.find(o => o.id === id); if (!offer) return;
    if (offer.locked) { modal('<h2>この竜の取材資料を開こう</h2><p>この試遊では、残る竜の資料を無料で補えます。本編でスカウトをやり直す必要はありません。得意な走りとコースを比べて、予想を考えましょう。</p><button class="primary" id="go-scout">無料の取材資料を開く ' + arrow + '</button>'); $("#go-scout").onclick = showScoutNotes; return; }
    const target = activeSlot;
    plan = planWithOffer(id, target); inspected = id; result = null; watched = false;
    const placedIndex = plan.indexOf(id);
    const empty = plan.indexOf(null); activeSlot = empty >= 0 ? empty : target;
    sound("pick"); renderKeepingTray();
    const destination = app.querySelector('[data-slot="' + placedIndex + '"]'); destination.classList.add("just-placed");
    if (fromRect && !reduce) {
      const end = destination.getBoundingClientRect(), ghost = document.createElement("div"); ghost.className = "fly-card";
      Object.assign(ghost.style, { left: fromRect.left + "px", top: fromRect.top + "px", width: fromRect.width + "px", height: fromRect.height + "px", opacity: ".6" }); document.body.appendChild(ghost);
      requestAnimationFrame(() => { Object.assign(ghost.style, { left: end.left + "px", top: end.top + "px", width: end.width + "px", height: end.height + "px", opacity: "0" }); }); setTimeout(() => ghost.remove(), 400);
    }
    announce(offer.title + "を" + (placedIndex + 1) + "枠目に載せました");
  }
  function planWithOffer(id, target) {
    const next = plan.slice(), old = next.indexOf(id), displaced = next[target];
    if (old >= 0 && old !== target) next[old] = displaced || null;
    next[target] = id;
    return next;
  }
  function showOffer(id) {
    const v = view(), offer = v.offers.find(o => o.id === id); if (!offer) return;
    const preview = E.preview(game, plan), feature = preview.valid && preview.features.find(f => f.id === id);
    modal(`<h2>${esc(offer.title)}</h2>${image(offer.ids[0], "dialog-dragon", "")}<p><strong>${esc(offer.ids.map(id => v.dragons.find(d => d.id === id).trait).join(" "))}</strong></p><p>${esc(offer.reason)}</p><p>${esc(offer.risk)}</p>` +
      (feature ? `<p>この記事に集まる予想券：${num(feature.directedStake)}枚<br>的中した場合の払戻見込み：${num(feature.odds.min)}〜${num(feature.odds.max)}倍</p><p>${esc(feature.reaction)}</p>` : '<p>一面に載せると、届く読者と配当の見込みを確認できます。</p>'));
  }
  function publish() {
    const fieldReads=buildFieldReads();
    const next = E.resolve(game, plan, annotations());
    if (!next.valid) { toast(next.errors[0]); return; }
    publishedFieldReads=fieldReads;
    comparison = trialHistory.get(game.scenarioId) || null;
    trialHistory.set(game.scenarioId, { result: next, state: JSON.parse(JSON.stringify(game)), plan: chosen().slice() });
    result = next; phase = "result"; watched = false; sound("issue"); render(true);
  }
  function renderResult() {
    if (!result) { phase = "edit"; render(true); return; }
    const r = result;
    app.innerHTML = '<section class="race-stage"><h2>神眼は、外れない。</h2><span class="race-caption">1着の予言：ライオウ。ほかの竜の走りを、見届ける。</span><div class="race-lanes">' +
      view().dragons.map(d => `<div class="race-lane" data-runner="${d.id}"><span class="lane-label">${esc(d.name)}</span>${image(d.id, "race-dragon" + (d.id === "poro" ? " buddy" : ""), d.name)}</div>`).join("") + '</div></section><div class="race-progress"><i></i></div>' +
      '<div class="race-controls"><span>公正な固定レース・短縮再生</span><button class="secondary" id="race-control">' + (watched ? "もう一度見る" : "結果へ進む") + '</button></div><div id="settlement">' + (watched ? settlementHTML(r) : '<p class="boot">あなたの一面を持って、客がレースを見守っている。</p>') + '</div>';
    $("#race-control").onclick = () => { if (watched) { watched = false; render(false); } else completeRace(); };
    if (watched) { positionRace(1); bindResults(); }
    else playRace();
  }
  function positionRace(progress) {
    const time = progress * result.race.rows[0].time;
    result.race.rows.forEach(row => {
      const img = app.querySelector('[data-runner="' + row.id + '"] .race-dragon'); if (!img) return;
      // Uniform-speed replay of the engine's fixed times. No invented passing,
      // no influence from audience, preparation, card order, or UI gestures.
      const distance = time / row.time;
      const zoom = 1 + 20 * Math.max(0, (progress - .7) / .3);
      img.style.left = (20 + progress * 80 - (progress - distance) * 80 * zoom) + "%";
      if (!reduce && progress < 1) img.style.marginBottom = Math.sin(progress * 70 + row.rank) * 1.5 + "px";
    });
    $(".race-progress i").style.width = progress * 100 + "%";
  }
  function playRace() {
    if (reduce) { completeRace(); return; }
    let last = 0, elapsed = 0;
    function frame(now) {
      if (phase !== "result" || watched || !$(".race-stage")) return;
      if (last && !document.hidden) elapsed += Math.min(now - last, 90); last = now;
      const progress = Math.min(1, elapsed / 6500); positionRace(progress);
      if (progress >= 1) completeRace(); else animation = requestAnimationFrame(frame);
    }
    animation = requestAnimationFrame(frame);
  }
  function completeRace() {
    cancelAnimationFrame(animation); watched = true; positionRace(1);
    $(".race-caption").textContent = "ゴール前を拡大。ライオウの1着予言は、正確だった。";
    $("#settlement").innerHTML = settlementHTML(result); $("#race-control").textContent = "もう一度見る";
    enhanceArt(app); bindResults(); sound(result.success ? "win" : "pick");
    announce(result.success ? "二枚以上の予想が届き、島の運営を支えられました" : "結果を見比べ、紙面と島の備えを見直せます");
  }
  function settlementHTML(r) {
    const sideSupport = (r.settlement.place.refundSupport || 0) + (r.settlement.wide.refundSupport || 0);
    const economicReason = sideSupport > 0 ? `複勝・ワイドの最低払戻に${num(sideSupport)}枚の補填が必要だった。` : "この紙面の売上では運営費を賄えなかった。";
    const economicNext = game.prepared.market ? "読者への届け先と、票の集中を比べよう。" : "市場の備えと、読者への届け方を比べよう。";
    const explanation = r.success ? "予言は当たった。それでも、客はほかの走りを楽しみ、島に一日が続いた。" : r.hits >= 2 ? `${r.hits}枚の予想は的中。それでも、運営費に${num(-r.operatingProfit)}枚届かなかった。${economicReason}${economicNext}` : r.operatingProfit >= 0 ? `運営は支えられたが、的中は${r.hits}枚。取材ノートとコース条件から、次の予想を選ぼう。` : `的中は${r.hits}枚、運営費も${num(-r.operatingProfit)}枚不足。予想の根拠と、島の備えを分けて見直そう。`;
    return `<div class="result-head ${r.success ? "success" : "failure"}"><h2>${r.success ? "灯りは、消えなかった。" : r.operatingProfit < 0 ? "まだ、朝には届かない。" : "収支は守れた。信頼は、まだ。"}</h2><p>${explanation}</p></div>` +
      '<div class="finish-leaders">' + r.race.rows.slice(0, 3).map(row => `<div><small>${row.rank}着</small>${image(row.id, "", "")}<b>${esc(row.name)}</b></div>`).join("") + '</div>' +
      '<div class="section-head"><h3>あなたが届けた、3枚の予想</h3><p>' + r.hits + ' / 3 的中</p></div><section class="prediction-results">' + r.predictions.map(p => `<div class="prediction-result${p.hit ? " hit" : ""}"><span>${esc(p.title)}<small class="prediction-reason">${p.ids.map(id => { const row = r.race.rows.find(x => x.id === id); return esc(row.name) + row.rank + "着"; }).join("・")} ／ ${p.type === "place" ? "2着以内が的中" : "2頭とも3着以内が的中"}</small><small>読者の予想券 ${num(p.stake)}枚 → 払戻 ${num(p.payout)}枚</small></span><strong>${p.hit ? "的中 " + num(p.odds) + "倍" : "届かず"}</strong></div>`).join("") + '</section>' +
      fieldEvidenceResultHTML(r) + lifeMemoryHTML(true, r.success) + discoveryMemoryHTML(true) + chronicleHTML(r) + resultComparisonHTML(r) + '<section class="balance-sheet"><h3>島の一日 — 運営の答え合わせ</h3>' + ["win", "place", "wide"].map((key, i) => {
        const pool = r.settlement[key];
        const explainSupport = pool.houseNet < 0 || (r.operatingProfit < 0 && key !== "win" && pool.refundSupport > 0);
        return `<details class="pool-settlement"${explainSupport ? " open" : ""}><summary><span>${["単勝", "複勝", "ワイド"][i]}の運営収支</span><b>${signed(pool.houseNet)}枚</b></summary><div class="ledger-row"><span>売上 → 払戻</span><b>${num(pool.total)} → ${num(pool.payout)}枚</b></div><div class="ledger-row"><span>通常の配分原資（売上の80%）</span><b>${num(pool.distributable == null ? pool.total * .8 : pool.distributable)}枚</b></div><div class="ledger-row${pool.refundSupport > 0 ? " support" : ""}"><span>最低1倍を守るための補填</span><b>${num(pool.refundSupport || 0)}枚</b></div></details>`;
      }).join("") +
      `<div class="ledger-row"><span>市場の営業収入</span><b>+${num(r.commerceIncome)}枚</b></div><div class="ledger-row"><span>一日の運営費</span><b>−${num(r.operatingCost)}枚</b></div><div class="ledger-row total${r.operatingProfit < 0 ? " loss" : ""}"><span>今回の収支</span><b>${signed(r.operatingProfit)}<small> 枚</small></b></div>` +
      '<p class="pool-note">読者の払戻と、島の運営収支は別です。補填額は各プールの収支にすでに含まれており、追加で差し引きません。別券種で単勝の配当を上げることもありません。</p></section>' +
      '<ul class="feedback-list">' + r.feedback.map(f => `<li>${esc(f)}</li>`).join("") + '</ul>' +
      '<details class="review-order"><summary>公正なレースの着順</summary>' + r.race.rows.map(row => `<div class="finish-row"><span>${row.rank}着 ${esc(row.name)}</span><span>${row.time.toFixed(2)}秒</span></div>`).join("") + '</details>' +
      '<div class="result-actions">' + (r.success ? '<button class="primary" id="next-scenario">別のコースで、読みを試す ' + arrow + '</button><button class="secondary" id="retry-plan">同じレースで、紙面を比べる</button>' : '<button class="primary" id="retry-plan">同じレースで、紙面を比べる ' + arrow + '</button><button class="secondary" id="next-scenario">別のコースで、読みを試す</button>') + '<button class="secondary" id="retry-prep">島の備えを見直す</button></div>' +
      '<p class="footer-note">再挑戦でコインや仲間は失いません。<br>同じコースでは、公正なレースの結果も同じです。</p>';
  }
  function chronicleHTML(r) {
    const c = r.chronicle;
    if (!c || (!c.entries.length && !c.cover)) return '<p class="chronicle-empty">島で出会った人の言葉を、予想の根拠に添えてみよう。結果の後、その人からあなたの読みへの返事が届きます。</p>';
    const memories = E.getJourneyView(game).memories, used = [...new Set(c.entries.map(e => e.memoryId).concat(c.cover ? [c.cover.id] : []))].map(id => memories.find(m => m.id === id)).filter(Boolean);
    const archived = [...new Map(c.entries.filter(e => e.readingNote).map(e => [e.readingNote.id, e.readingNote])).values()];
    return '<section class="chronicle"><div class="chronicle-banner"><img src="images/story/late/island_new_dawn.webp" alt="朝を迎えた島">' +
      (c.outfit ? `<img class="chronicle-mimi" src="${esc(c.outfit.image)}" alt="${esc(c.outfit.title)}のミミ">` : "") + '</div><div class="chronicle-heading"><small>旅の手帖 · 最後の一面</small><h3>この島で、覚えたこと。</h3>' +
      (c.cover ? `<p>表紙に添えたのは、${esc(c.cover.title)}。<br>${esc(c.cover.person)}との縁を、今日の読者へ。</p>` : "") + '</div>' +
      '<div class="chronicle-photos">' + archived.map(n => `<figure class="chronicle-past">${image(n.selections[0].dragonId, "", "")}<figcaption>第${n.completedRace}戦の「${esc(n.reasonLabel)}」</figcaption></figure>`).join("") + used.map(m => `<figure><img src="${esc(m.image)}" alt=""><figcaption>${esc(m.title)}</figcaption></figure>`).join("") + '</div>' +
      c.entries.map((e, i) => `<article class="chronicle-letter"><small>0${e.slot + 1} · ${esc(e.memoryTitle)}</small><h4>${esc(e.title)}</h4>` +
        readingComparisonHTML(e, r) +
        `<blockquote>今回のわたしの読み：${esc(e.claim)}</blockquote><details class="personal-letter"${i === 0 && e.memoryId ? " open" : ""}><summary>${e.memoryId ? esc(e.person) + "から届いた返事" : "あの時の読みを、今日の自分へ"}</summary><p>${esc(e.reply.replace(e.person + "からの返事：\n", ""))}</p></details><details class="chronicle-reason"><summary>学んだ理論と、実際の走りを振り返る</summary><p><b>${esc(e.theoryTitle)}</b></p><p>${esc(e.observation)}</p><p>${esc(e.connection)}</p><p>${esc(e.resultLine)}</p>${e.review ? `<p>${esc(e.review)}</p>` : ""}</details></article>`).join("") + `<p class="chronicle-close">${esc(c.closing)}</p></section>`;
  }
  function readingComparisonHTML(entry, report) {
    const n = entry.readingNote; if (!n) return "";
    const trace = n.trace, focus = trace && n.selections.find(s => s.dragonId === trace.dragonId);
    const prediction = report.predictions.find(p => p.id === entry.predictionId);
    const current = prediction.ids.map(id => report.race.rows.find(row => row.id === id));
    return `<div class="chronicle-history"><small>中盤・第${n.completedRace}戦から、今回へ</small><div class="reading-compare-row"><span>あの一戦</span><div><b>${focus ? esc(focus.name) : n.selections.map(s => esc(s.name)).join("・")}</b><strong>${focus ? `序盤${trace.earlyRank} → 中盤${trace.midRank} → ${focus.rank}着` : n.selections.map(s => s.rank + "着").join("・")}</strong><p>${trace ? esc(trace.section) + (trace.stat ? " · " + esc(trace.stat) : "") : "途中順位の記録なし"}</p></div></div><div class="reading-compare-row"><span>今回の一戦</span><div><b>${current.map(row => esc(row.name)).join("・")}</b><strong>${current.map(row => row.rank + "着").join("・")}</strong><p>${esc(view().scenario.condition)}</p><small>短縮再生の試作：区間順位の記録なし</small></div></div><p class="reading-compare-rule">${n.betType === "place" && prediction.type === "place" ? "本編の複勝は3着以内、今回は2着以内。" : "対象と条件を、今回の資料で読み直す。"}</p></div>`;
  }
  function resultComparisonHTML(r) {
    if (!comparison) return "";
    const old = comparison.result;
    return `<section class="result-comparison"><h3>前の一面から、何が変わった？</h3><div><span>的中</span><b>${old.hits} → ${r.hits}枚</b></div><div><span>届いた読者</span><b>${num(old.audience.readers)} → ${num(r.audience.readers)}人</b></div>` +
      ["place", "wide"].map((key, i) => `<div><span>${["複勝", "ワイド"][i]}の取り分</span><b>${signed(old.settlement[key].houseNet)} → ${signed(r.settlement[key].houseNet)}枚</b></div><div><span>最低払戻の補填</span><b>${num(old.settlement[key].refundSupport || 0)} → ${num(r.settlement[key].refundSupport || 0)}枚</b></div>`).join("") +
      `<div><span>市場の営業収入</span><b>${num(old.commerceIncome)} → ${num(r.commerceIncome)}枚</b></div><div><span>一日の運営収支</span><b>${signed(old.operatingProfit)} → ${signed(r.operatingProfit)}枚</b></div></section>`;
  }
  function bindResults() {
    const retry = $("#retry-plan"); if (!retry) return;
    retry.onclick = () => { phase = "edit"; render(true); };
    $("#retry-prep").onclick = () => { phase = "prepare"; render(true); };
    $("#next-scenario").onclick = () => {
      const scenarios = view().scenarios, index = scenarios.findIndex(s => s.id === game.scenarioId);
      game = Object.assign({}, game, { scenarioId: scenarios[(index + 1) % scenarios.length].id });
      plan = [null, null, null]; evidence = {}; activeSlot = 0; inspected = null; result = null; watched = false; phase = "edit"; render(true);
    };
  }
  window.addEventListener("pagehide", () => { cancelAnimationFrame(animation); clearTimeout(toastTimer); if (audio) audio.close().catch(() => {}); });
  render(false);
})();
