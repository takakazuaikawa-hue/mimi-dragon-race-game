// The official festival issue uses the same public forecasts and tote as the
// independent trial. Only submitted inputs are saved. Regular tickets and the
// player's wallet are never settled here.
(function (root) {
  "use strict";
  const COURSE = "coast";
  const emptyPlan = () => [null, null, null];
  let endingInProgress = false;

  function record(player) {
    const entry = player && player.shingan && player.shingan.official;
    return entry && entry.version === 1 ? entry : null;
  }
  function editRecord() {
    const legacy = shinganData();
    if (!record(state.player)) legacy.official = { version: 1, legacyCleared: !legacy.official && legacy.cleared === true,
      draft: emptyPlan(), ferry: false, issue: null };
    return legacy.official;
  }
  function capture() {
    return ShinganTrialBridge.capture(state.player, { poroFound: shinganScouted("poro"), mizuMet: advisorMet("mizu") });
  }
  function draftOf(entry) {
    return entry && Array.isArray(entry.draft) && entry.draft.length === 3 ? entry.draft.slice() : emptyPlan();
  }
  function scenario(scouted, harbor, market, notes) {
    const game = ShinganPrototype.createState("arrival", COURSE);
    game.coins = 0;
    game.scouted = scouted.slice();
    game.prepared = { harbor, market, scout: scouted.length === SHINGAN_ROSTER.length };
    game.readingNotes = notes || [];
    return game;
  }
  function liveScenario(snapshot, entry) {
    return scenario(snapshot.scouted, snapshot.island.infra >= 1 || entry.ferry === true,
      snapshot.island.commerce >= 4, snapshot.readingNotes);
  }
  function annotations(noteId) { return noteId ? [{ readingNoteId: noteId }, null, null] : []; }
  function fieldSources(raw) {
    if (typeof IslandDiscovery === "undefined" || typeof IslandFieldRead === "undefined") return [];
    return IslandDiscovery.normalizeExport(raw)
      .filter(record => IslandFieldRead.options(record.caseId).length)
      .map(record => ({ record, finding: IslandDiscovery.describeDiscovery(record).finding }));
  }
  function fieldPicks(raw, plan, sources) {
    return plan.map((offerId, i) => {
      const pick = Array.isArray(raw) && raw[i];
      if (!offerId || !pick || pick.offerId !== offerId || !sources.some(s => s.record.caseId === pick.caseId) ||
        !IslandFieldRead.options(pick.caseId).some(lens => lens.id === pick.lensId)) return null;
      return { offerId, caseId: pick.caseId, lensId: pick.lensId };
    });
  }
  function fieldRead(pick, index, plan, view, sources) {
    if (!pick) return null;
    const offer = view.offers.find(o => o.id === pick.offerId && !o.locked);
    const source = sources.find(s => s.record.caseId === pick.caseId);
    const planOffers = plan.map(id => view.offers.find(o => o.id === id)).filter(Boolean);
    return IslandFieldRead.capture(pick.caseId, pick.lensId, {
      sourceTitle: source.finding.title, offer, dragons: view.dragons, scenario: view.scenario,
      slot: view.editorSlots[index], slotIndex: index, planOffers
    });
  }
  function resolveIssue(issue) {
    if (!issue || issue.version !== 1 || issue.course !== COURSE || !Array.isArray(issue.plan) || issue.plan.length !== 3 ||
      typeof issue.harbor !== "boolean" || typeof issue.market !== "boolean" || typeof issue.ferry !== "boolean" ||
      !(issue.harbor || issue.ferry) || (issue.harbor && issue.ferry)) return null;
    const game = scenario(SHINGAN_ROSTER.map(d => d.id), true, issue.market, issue.notes);
    const result = ShinganPrototype.resolve(game, issue.plan, annotations(issue.noteId));
    return result.valid ? result : null;
  }
  function getOutcome(player) {
    const entry = record(player || state.player);
    return entry ? resolveIssue(entry.issue) : null;
  }
  function publish() {
    if (!shinganUnlocked() || !shinganAllScouted()) return false;
    const entry = editRecord();
    if (getOutcome(state.player)) return false;
    const snap = capture(), harbor = snap.island.infra >= 1;
    const note = snap.readingNotes.find(n => n.id === entry.noteId);
    const issue = { version: 1, course: COURSE, plan: draftOf(entry), harbor, ferry: !harbor && entry.ferry === true,
      market: snap.island.commerce >= 4, noteId: note ? note.id : null, notes: note ? [note] : [] };
    const sources = fieldSources(snap.discoveries), picks = fieldPicks(entry.fieldDraft, issue.plan, sources);
    if (picks.some(Boolean)) issue.fieldReading = { version: 1, picks,
      discoveries: sources.filter(s => picks.some(p => p && p.caseId === s.record.caseId)).map(s => s.record) };
    const result = resolveIssue(issue);
    if (!result) return false;
    entry.issue = issue;
    saveGame();
    return true;
  }

  function element(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(parent, text, action, cls) {
    const b = element("button", cls || "secondary", text);
    b.type = "button"; b.onclick = action; parent.appendChild(b); return b;
  }
  function card(parent, title, tag) {
    const box = element(tag || "section", "card sgo-card");
    box.appendChild(element(tag === "details" ? "summary" : "h3", "", title));
    parent.appendChild(box); return box;
  }
  function add(parent, text, cls) { parent.appendChild(element("p", cls, text)); }
  function amount(value) { return value.toLocaleString("ja-JP", { maximumFractionDigits: 2 }); }
  function signed(value) { return (value > 0 ? "+" : "") + amount(value); }
  function option(select, value, text) {
    const opt = element("option", "", text); opt.value = value; select.appendChild(opt); return opt;
  }
  function portrait(parent, d) {
    const item = element("div", "sgo-dragon");
    const img = element("img"); img.src = d.image; img.alt = ""; img.loading = "lazy";
    const text = element("div"); text.appendChild(element("b", "", d.name)); add(text, d.trait);
    item.append(img, text); parent.appendChild(item);
  }
  function showFieldRead(host, read, view, projection) {
    add(host, "思い出した経験　" + read.sourceTitle, "sgo-muted");
    const facts = element("ul", "sgo-field-facts");
    read.facts.forEach(fact => facts.appendChild(element("li", "", fact)));
    host.appendChild(facts);
    if (read.lensId === "overlap") {
      add(host, "一着予言のライオウ以外で重なる竜　" + (read.sharedIds.map(id => view.dragons.find(d => d.id === id).name).join("・") || "なし"));
    }
    if (read.lensId === "audience" && projection && projection.valid) {
      const feature = projection.features.find(f => f.slot === read.slotIndex);
      if (feature) add(host, feature.reaction + " 見込み読者 " + feature.readers + "人 ／ この予想への見込み票 " + feature.directedStake + "枚");
    }
    host.appendChild(element("blockquote", "sgo-field-claim", read.claim));
  }
  function showGate(app) {
    const box = card(app, "取材に出る八頭");
    const missing = SHINGAN_ROSTER.filter(d => !shinganScouted(d.id));
    add(box, "迎えた竜 " + (SHINGAN_ROSTER.length - missing.length) + "／" + SHINGAN_ROSTER.length + "頭。走る姿を知ってから、一面を届けよう。");
    missing.forEach(d => {
      if (d.id === "poro") {
        add(box, typeof poroRaceLead === "function" ? poroRaceLead() : "相棒との出会いと鑑定は、レースの結果画面で進みます。");
        if (typeof renderRaceSelect === "function") button(box, "相棒との出会いへ · レースを選ぶ", renderRaceSelect);
        return;
      }
      const dragon = typeof dragonById === "function" && dragonById(d.id);
      const loc = dragon && typeof scoutDragonHome === "function" && typeof scoutLocation === "function" ? scoutLocation(scoutDragonHome(dragon)) : null;
      add(box, "未取材の竜 · " + (loc && loc.name || d.locName));
    });
    if (missing.some(d => d.id !== "poro") && (typeof poroScoutUnlocked !== "function" || poroScoutUnlocked())) button(box, "スカウトの行き先を見る", renderScout);
  }
  function references(app, view, snap) {
    const reports = card(app, "八頭の取材帳を開く", "details");
    const list = element("div", "sgo-field");
    view.dragons.forEach(d => portrait(list, d));
    reports.appendChild(list);
    const memories = snap.discoveries.map(d => IslandDiscovery.describeDiscovery(d)).filter(Boolean);
    if (!memories.length && !snap.lifeMemory && !view.readingNotes.length) return;
    const box = card(app, "島で残した記録を読む", "details");
    for (const m of memories) add(box, m.finding.title + "　" + m.finding.body);
    if (snap.lifeMemory) add(box, IslandLifeLoop.finishEcho(snap.lifeMemory).body);
    for (const note of view.readingNotes) add(box, note.raceName + "　" + note.reviewText);
  }
  function prep(app, entry, snap) {
    const box = card(app, "読者を迎える");
    if (snap.island.infra >= 1) add(box, "港の桟橋は修理済み。島外から読者の船が着きます。");
    else if (entry.ferry) add(box, "船頭が今日だけの渡船を出してくれます。島外の読者も会場に来られます。");
    else {
      add(box, "桟橋はまだ修理前。島外の読者を迎えるため、船頭に今日だけの渡船を頼めます。");
      button(box, "今日の渡船を頼む", () => { entry.ferry = true; saveGame(); renderShinganFairRace(); });
    }
    add(box, snap.island.commerce >= 4 ? "拡張した市場も営業。店の売上が今日の運営を支えます。" :
      "今日は券の売上で運営します。市場の拡張まで済ませると、店の収入も加わります。", "sgo-muted");
  }
  function editor(app, entry, snap) {
    const game = liveScenario(snap, entry), view = ShinganPrototype.getView(game);
    const course = card(app, view.scenario.title);
    add(course, view.scenario.condition);
    add(course, "セレスティアの予言はライオウの一着。その後ろへ来るのはどの竜だろう。");
    prep(app, entry, snap);
    references(app, view, snap);
    const box = card(app, "三つの読者層へ、一枚ずつ");
    add(box, "この決戦の複勝は2着以内。ワイドは選んだ2頭とも3着以内。異なる予想を三枚載せます。");
    add(box, "二枚以上が的中し、開催の収支が0コイン以上なら、次の開催を約束できます。売上も支払いも、島の開催会計で精算します。ミミの所持金はそのままです。");
    const draft = draftOf(entry);
    const sources = fieldSources(snap.discoveries);
    const controls = [], descriptions = [], portraits = [], fieldControls = [];
    function updateDraft() {
      const current = controls.map(sel => sel.value || null);
      const previous = fieldPicks(entry.fieldDraft, draftOf(entry), sources);
      if (sources.length) entry.fieldDraft = current.map(id => previous.find(pick => pick && pick.offerId === id) || null);
      entry.draft = current;
      saveGame();
      refresh();
    }
    view.editorSlots.forEach((slot, i) => {
      const label = element("div", "sgo-choices");
      label.appendChild(element("b", "", slot.title)); add(label, slot.description);
      const chosenArt = element("div", "sgo-picked-art hidden"); portraits.push(chosenArt); label.appendChild(chosenArt);
      const select = element("select", "sgo-picks"); option(select, "", "予想を選んでください");
      select.setAttribute("aria-label", slot.title + "の予想");
      view.offers.filter(o => !o.locked).forEach(o => option(select, o.id, o.type === "wide" ? "ワイド　" + o.title : o.title));
      select.value = draft[i] || ""; controls.push(select); label.appendChild(select);
      const hint = element("small", "sgo-choice-note"); descriptions.push(hint); label.appendChild(hint);
      if (i > 0) button(label, "上の読者層と予想を入れ替える", () => {
        const current = controls.map(sel => sel.value || null);
        [current[i - 1], current[i]] = [current[i], current[i - 1]];
        controls.forEach((sel, n) => { sel.value = current[n] || ""; });
        updateDraft();
      }, "secondary sgo-swap");
      if (sources.length) {
        const host = element("div", "sgo-field-reading hidden");
        const field = element("label", "sgo-field-label");
        field.appendChild(element("b", "", "島で覚えた見方を添える（任意）"));
        const pick = element("select", "sgo-field-pick");
        option(pick, "", "今回は添えない");
        const lenses = [];
        for (const source of sources) {
          const group = element("optgroup"); group.label = source.finding.title;
          for (const lens of IslandFieldRead.options(source.record.caseId)) {
            const caseId = source.record.caseId, value = caseId + "/" + lens.id;
            lenses.push({ caseId, lensId: lens.id, value }); option(group, value, lens.label);
          }
          pick.appendChild(group);
        }
        pick.onchange = () => {
          const current = controls.map(sel => sel.value || null);
          const picks = fieldPicks(entry.fieldDraft, current, sources), lens = lenses.find(l => l.value === pick.value);
          picks[i] = lens && current[i] ? { offerId: current[i], caseId: lens.caseId, lensId: lens.lensId } : null;
          entry.fieldDraft = picks; saveGame(); refresh();
        };
        field.appendChild(pick); host.appendChild(field);
        const preview = element("div", "sgo-field-preview"); preview.setAttribute("aria-live", "polite");
        host.appendChild(preview); label.appendChild(host);
        fieldControls.push({ host, pick, preview });
      }
      box.appendChild(label);
      select.onchange = updateDraft;
    });
    if (view.readingNotes.length) {
      const label = element("label", "sgo-choices");
      label.appendChild(element("b", "", "一枚目に添える、以前の読み（任意）"));
      const pick = element("select"); option(pick, "", "今回は添えない");
      view.readingNotes.forEach(n => option(pick, n.id, n.raceName + " · " + n.reasonLabel));
      pick.value = entry.noteId || ""; pick.onchange = () => { entry.noteId = pick.value || null; saveGame(); refresh(); };
      label.appendChild(pick); box.appendChild(label);
    }
    const forecast = element("div", "sgo-preview"); forecast.setAttribute("aria-live", "polite"); box.appendChild(forecast);
    let lastForecast = null, previousForecast = null;
    const send = button(box, "予想を発行して、レース結果を見る", () => {
      if (publish()) renderShinganFairRace("result");
    }, "sgo-cta");
    function refresh() {
      const current = controls.map(sel => sel.value || null);
      controls.forEach((sel, i) => {
        Array.from(sel.options).forEach(opt => { opt.disabled = !!opt.value && opt.value !== sel.value && current.includes(opt.value); });
        const offer = view.offers.find(o => o.id === current[i]);
        portraits[i].replaceChildren(); portraits[i].classList.toggle("hidden", !offer);
        if (offer) offer.ids.forEach(id => {
          const dragon = view.dragons.find(item => item.id === id), img = element("img");
          img.src = dragon.image; img.alt = dragon.name; portraits[i].appendChild(img);
        });
        descriptions[i].textContent = offer ? offer.ids.map(id => {
          const d = view.dragons.find(item => item.id === id); return d.name + "は" + d.trait;
        }).join("　") + "　" + offer.risk : "";
      });
      const noteId = view.readingNotes.some(n => n.id === entry.noteId) ? entry.noteId : null;
      const projection = ShinganPrototype.preview(game, current, annotations(noteId));
      fieldPicks(entry.fieldDraft, current, sources).forEach((pick, i) => {
        const field = fieldControls[i]; if (!field) return;
        field.host.classList.toggle("hidden", !current[i]); field.pick.disabled = !current[i];
        field.pick.value = pick ? pick.caseId + "/" + pick.lensId : "";
        field.preview.replaceChildren();
        const read = fieldRead(pick, i, current, view, sources);
        if (read) showFieldRead(field.preview, read, view, projection);
      });
      const count = current.filter(Boolean).length;
      forecast.replaceChildren();
      if (projection.valid) {
        add(forecast, count + "／3枚　見込み読者 " + projection.audience.readers + "人");
        if (count) {
          add(forecast, "運営収支の見込み " + signed(projection.estimatedProfit.min) + " ～ " + signed(projection.estimatedProfit.max) + "コイン");
          if (count === 3) {
            if (!lastForecast || lastForecast.ids.join() !== current.join()) {
              previousForecast = lastForecast;
              lastForecast = { ids: current.slice(), readers: projection.audience.readers, min: projection.estimatedProfit.min, max: projection.estimatedProfit.max };
            }
            if (previousForecast) {
              const sameCards = previousForecast.ids.slice().sort().join() === current.slice().sort().join();
              add(forecast, (sameCards ? "同じ三枚・前の届け方" : "前の紙面") + "：" + previousForecast.readers + "人 ／ " + signed(previousForecast.min) + " ～ " + signed(previousForecast.max) + "コイン", "sgo-muted");
            }
          }
          add(forecast, "開催費 " + amount(projection.operatingCost) + "コイン。読者の票と払戻、市場の売上で収支が決まります。", "sgo-muted");
          if (projection.estimatedProfit.max < 0) add(forecast, "この届け方は、どの着順でも赤字の見込みです。同じ三枚でも、読者層を入れ替えると票の集まり方が変わります。", "sgo-warning");
          const feature = projection.features.find(f => f.evidence);
          if (feature) add(forecast, feature.evidence.connection, "sgo-muted");
        }
      } else add(forecast, projection.errors.join(" "));
      send.disabled = !game.prepared.harbor || !projection.valid || count !== 3;
      if (!game.prepared.harbor) add(forecast, "発行前に「今日の渡船を頼む」で、読者の来場を手配してください。");
    }
    refresh();
  }
  function showResult(app, entry, result) {
    const box = card(app, result.success ? "明日も、この島で開催できる" : "発行した一面を振り返る");
    box.classList.add("sgo-result");
    add(box, "実着順　" + result.race.rows.slice(0, 3).map(r => r.rank + "着 " + r.name).join("　"), "sgo-standing");
    const podium = element("div", "sgo-podium");
    result.race.rows.slice(0, 3).forEach(row => {
      const place = element("div", "sgo-podium-place");
      const img = element("img"); img.src = "images/dragons/" + row.id + ".png"; img.alt = row.name;
      place.append(element("small", "", row.rank + "着"), img, element("b", "", row.name));
      if (Number.isFinite(row.gap)) place.appendChild(element("small", "", row.rank === 1 ? "先頭" : "+" + row.gap.toFixed(2) + "秒"));
      podium.appendChild(place);
    });
    box.appendChild(podium);
    add(box, "的中 " + result.hits + "／3枚　運営収支 " + signed(result.operatingProfit) + "コイン");
    for (const p of result.predictions) {
      const names = p.ids.map(id => { const row = result.race.rows.find(r => r.id === id); return row.name + " " + row.rank + "着"; });
      add(box, (p.hit ? "的中　" : "外れ　") + p.title + "（" + names.join("・") + "）");
    }
    const issue = entry.issue, saved = issue.fieldReading;
    if (saved && saved.version === 1) {
      const sources = fieldSources(saved.discoveries), picks = fieldPicks(saved.picks, issue.plan, sources);
      if (picks.some(Boolean)) {
        const view = ShinganPrototype.getView(scenario(SHINGAN_ROSTER.map(d => d.id), true, issue.market, issue.notes));
        const comparison = card(app, "島で覚えた見方と、今回の結果");
        picks.forEach((pick, i) => {
          const read = fieldRead(pick, i, issue.plan, view, sources);
          if (!read) return;
          const article = element("article", "sgo-field-reading");
          article.appendChild(element("h4", "", read.offerTitle + " · " + read.slotTitle));
          showFieldRead(article, read, view);
          const selected = result.predictions.find(p => p.id === read.offerId);
          const ranks = selected.ids.map(id => result.race.rows.find(row => row.id === id));
          add(article, "実着順　" + ranks.map(row => row.name + " " + row.rank + "着").join("・") + " ／ " + (selected.hit ? "的中" : "外れ"));
          if (read.lensId === "overlap") result.predictions.filter(p => read.relatedOfferIds.includes(p.id))
            .forEach(p => add(article, "同じ竜を含む予想　" + p.title + " ／ " + (p.hit ? "的中" : "外れ")));
          if (read.lensId === "audience") add(article, "この予想への票 " + selected.stake + "枚 ／ 当日全体の運営収支 " + signed(result.operatingProfit) + "コイン");
          comparison.appendChild(article);
        });
      }
    }
    const receipts = card(app, "当日の会計と着順", "details");
    add(receipts, "開催費も売上も島の帳簿に記録します。ミミの所持金はそのままです。");
    Object.entries(result.settlement).forEach(([key,p]) => add(receipts, ({ win: "単勝", place: "複勝", wide: "ワイド" })[key] +
      "　売上 " + amount(p.total) + "コイン ／ 払戻 " + amount(p.payout) + "コイン"));
    add(receipts, "市場の売上 " + amount(result.commerceIncome) + "コイン ／ 開催費 " + amount(result.operatingCost) + "コイン");
    add(receipts, result.race.rows.map(r => r.rank + "着 " + r.name).join("　"));
    if (result.chronicle.entries.length) {
      const note = card(app, "掲載前の読みと答え合わせ", "details");
      result.chronicle.entries.forEach(e => { add(note, e.connection); add(note, e.review); });
    }
    if (result.success) {
      add(box, "セレスティア「一着、わたしの言ったとおりだね。……それで、この島は明日も続くんだ？」");
      add(box, "ミミ「はいっ。次はどの子を見ようかって、みんなもう話してます！」");
      button(box, "島の夜明けを見届ける", finish, "sgo-cta");
    } else {
      if (result.hits === 3) add(box, "三枚とも、走りの予想は届いています。予想を捨てる前に、この三枚をどの読者層へ届けるか見直してみよう。", "sgo-warning");
      add(box, result.feedback.slice(result.hits === 3 ? 2 : 1).join(" "));
      button(box, "同じ開催を振り返り、紙面を組み直す", () => {
        entry.draft = issue.plan.slice();
        entry.fieldDraft = saved && saved.version === 1 ? fieldPicks(saved.picks, issue.plan, fieldSources(saved.discoveries)) : [];
        entry.issue = null; saveGame(); renderShinganFairRace("edit");
      }, "sgo-cta");
      button(box, "島の備えを見に行く", renderIslandBuild);
    }
  }
  async function finish() {
    const alreadyCleared = state.player.epilogue && state.player.epilogue.edFlag;
    if (endingInProgress || (!alreadyCleared && (!shinganUnlocked() || !shinganAllScouted()))) return;
    const result = getOutcome(state.player);
    if (!result || !result.success) return;
    endingInProgress = true;
    try {
      shinganData().cleared = true;
      epilogueClear();
      saveGame();
      if (typeof playFinalShowcase === "function") await playFinalShowcase();
      if (typeof playEightDragonsCutin === "function") await playEightDragonsCutin();
      await Ending.play();
      markGameCleared();
    } finally { endingInProgress = false; }
  }
  function renderShinganFairRace(focus) {
    state.ui.screen = "shingan";
    const app = element("section", "sgo-page"); beginScreen().appendChild(app);
    const hero = element("header", "sgo-hero");
    const art = element("img"); art.src = "images/story/late/arena_before_dawn.webp"; art.alt = "";
    const title = element("h2"); title.append(element("small", "", "神眼レース"), element("span", "", "最後の一面"));
    hero.append(art, title); app.appendChild(hero);
    const result = getOutcome(state.player);
    const alreadyCleared = state.player.epilogue && state.player.epilogue.edFlag;
    if (alreadyCleared && result && result.success) showResult(app, record(state.player), result);
    else if (!shinganUnlocked() && alreadyCleared) add(app, "以前に見届けた決戦のクリア記録が残っています。エンディングは設定のおまけから読み返せます。");
    else if (!shinganUnlocked()) add(app, "第5話を読み、総資産10億に到達するか、絶滅メーターを押し戻すと決戦を迎えます。");
    else if (!shinganAllScouted()) showGate(app);
    else {
      const entry = editRecord();
      if (result) showResult(app, entry, result); else editor(app, entry, capture());
    }
    const actions = element("div", "actions sgo-actions"); button(actions, "ホームへ戻る", renderHome); app.appendChild(actions);
    if (focus && app.querySelector) {
      const target = app.querySelector(focus === "result" ? ".sgo-result h3" : ".sgo-picks");
      if (target) { target.tabIndex = focus === "result" ? -1 : 0; target.focus(); target.scrollIntoView({ block: "center" }); }
    }
  }
  // V1 remains available only to display a verified historical success. A
  // missing V2 script must not silently reopen the retired scoring/retry rules.
  root.ShinganOfficialV1 = { getOutcome };
  root.renderShinganLegacyIssue = renderShinganFairRace;
  root.ShinganOfficial = root.ShinganOfficialV1;
  root.renderShinganFairRace = function () {
    if (typeof showInfoPopup === "function") showInfoPopup("決戦の読み込み", "<p>開催の画面を読み込めませんでした。ページを再読み込みしてください。</p>");
  };
})(typeof window !== "undefined" ? window : globalThis);
