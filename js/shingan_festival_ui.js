// Official entry for the island's frozen festival book. Main saves are written here.
(function (root) {
  'use strict';
  const F = root.ShinganFestival;
  const oldRender = root.renderShinganLegacyIssue;
  const oldOutcome = root.ShinganOfficialV1 && root.ShinganOfficialV1.getOutcome;
  let ending = false;
  let initializing = false, externalSaveChanged = false;
  if (root.addEventListener) root.addEventListener('storage', event => {
    if (typeof SAVE_KEY !== 'undefined' && event.key === SAVE_KEY && event.newValue !== event.oldValue) externalSaveChanged = true;
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const money = value => Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  // The book is in thousands of the existing coin, not an additional currency.
  const amount = value => money(value * 1000) + 'コイン';
  const signed = value => (value > 0 ? '+' : '') + amount(value);
  const coinForecast = range => money(range.min) + (range.min === range.max ? '' : ' ～ ' + money(range.max)) + 'コイン';
  const seed = () => { const values = crypto.getRandomValues(new Uint32Array(2)); return { drawSeed: values[0], nonce: values[1] }; };
  function record(p) { return F.restore(p); }
  function snapshot(p) { return F.capture(p, { poroFound: typeof poroFound === 'function' && poroFound() }); }
  function assertCurrentSave(p) {
    if (state.player !== p) throw Error('保存が切り替わりました。現在の開催を開き直してください。');
    if (externalSaveChanged) throw Error('別のタブで保存が更新されました。再読み込みして最新の開催を開いてください。');
    if (typeof SAVE_KEY !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SAVE_KEY), stored = raw ? JSON.parse(raw) : null;
      if (JSON.stringify(stored?.player?.shingan?.festival || null) !== JSON.stringify(p.shingan?.festival || null)) throw Error('開催の保存が更新されました。再読み込みして最新の号を確認してください。');
    }
  }
  const locked = action => root.navigator?.locks ? root.navigator.locks.request('mimi-festival-save', action) : Promise.resolve().then(action);
  function save(p, r) {
    assertCurrentSave(p);
    const hadShingan = Object.hasOwn(p, 'shingan'), previous = p.shingan, hadBook = !!previous && Object.hasOwn(previous, 'festival'), oldBook = previous?.festival;
    (p.shingan || (p.shingan = {})).festival = r;
    try {
      if (saveGame() === false) throw Error('帳簿を保存できませんでした。今回の操作は進めていません。空き容量やブラウザーの保存設定を確かめて、もう一度操作してください。');
    } catch (error) {
      if (!hadShingan) delete p.shingan;
      else { p.shingan = previous; if (previous) { if (hadBook) previous.festival = oldBook; else delete previous.festival; } }
      throw error;
    }
    return true;
  }
  function outcome(p) {
    const player = p || state.player;
    if (!F || !player.shingan || !player.shingan.festival) return oldOutcome ? oldOutcome(player) : null;
    try { return F.outcome(record(player)); } catch (_) { return null; }
  }
  function button(parent, label, action, cls) {
    const b = el('button', cls || 'secondary', label); b.type = 'button';
    b.onclick = async () => { try { await action(); } catch (error) { showInfoPopup('開催の記録', '<p>' + String(error.message).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) + '</p>'); } };
    parent.appendChild(b); return b;
  }
  function panel(parent, title) { const box = el('section', 'sf-card'); box.appendChild(el('h3', '', title)); parent.appendChild(box); return box; }
  function rows(parent, values) { const list = el('dl', 'sf-ledger'); values.forEach(([label, value]) => { list.append(el('dt', '', label), el('dd', '', value)); }); parent.appendChild(list); }
  function art(id, name) { const img = el('img'); img.src = 'images/dragons/' + id + '.png'; img.alt = name || ''; return img; }
  function name(view, id) { return view.dragons.find(d => d.id === id)?.name || id; }
  async function mutate(p, eventId, revision, fn) {
    await locked(() => {
      assertCurrentSave(p);
      const current = record(p), v = F.view(current);
      if (v.eventId !== eventId || v.revision !== revision) return;
      save(p, fn(current));
    });
    if (state.player === p && state.ui.screen === 'shingan') { const y = scrollY; render(); scrollTo(0, y); }
  }
  async function initialize(p, open) {
    if (initializing) return;
    initializing = true; let completed = false;
    try {
      await locked(() => { assertCurrentSave(p); let current = record(p); if (open) current = F.open(current, snapshot(p), seed()); save(p, current); });
      completed = true;
    } catch (error) {
      if (state.player === p && state.ui.screen === 'shingan') showInfoPopup('開催の記録', '<p>' + String(error.message).replace(/[&<>]/g, '') + '</p>');
    } finally { initializing = false; }
    if (completed && state.player === p && state.ui.screen === 'shingan') render();
  }
  function initializePanel(app, p, open) {
    app.appendChild(el('p', 'sf-muted', open ? '本日の公示を記録しています……' : '開催の記録を準備しています……'));
    button(app, 'もう一度、開催の記録を保存する', () => initialize(p, open));
    button(app, 'ホームへ戻る', renderHome, 'sf-back');
    initialize(p, open);
  }
  function sourcePicker(parent, p, view) {
    if (!view.sources.length && !view.notes.length) return;
    const details = el('details', 'sf-details'); details.appendChild(el('summary', '', '島で集めた記録を持ち込む'));
    for (const [key, title, choices] of [['sourceId', '当日の呼びかけ・現地の工夫', view.sources], ['readingId', '前に残した一戦', view.notes]]) {
      if (!choices.length) continue;
      const label = el('label', 'sf-label', title), select = el('select'); select.setAttribute('aria-label', title);
      const empty = el('option', '', '今回は持ち込まない'); empty.value = ''; select.appendChild(empty);
      choices.forEach(source => { const option = el('option', '', source.label || source.raceName || source.id); option.value = source.id; select.appendChild(option); });
      select.value = view.plan[key] || ''; select.onchange = () => mutate(p, view.eventId, view.revision, r => F.edit(r, view.eventId, { [key]: select.value || null }));
      label.appendChild(select); details.appendChild(label);
      const selected = choices.find(s => s.id === view.plan[key]);
      if (selected) details.appendChild(el('p', 'sf-muted', selected.detail ||
        ReadingJournal.oracleAccount(selected) + (selected.selections || []).map(s => s.name + ' ' + s.rank + '着').join(' ／ ')));
    }
    if (view.lifeMemory) details.appendChild(el('p', 'sf-muted', view.lifeMemory.quote || '島で残してきた日常の記憶も、手元にある。'));
    details.appendChild(el('p', 'sf-muted', '企画書だけで工事は完成しません。紀行の個人売上を、当日の運営収入に足すこともありません。'));
    parent.appendChild(details);
  }
  function choices(parent, p, view, preview, type) {
    const selected = type === 'place' ? [view.plan.place] : view.plan.wide;
    const title = el('h4', '', type === 'place' ? '複勝で読む一頭' : 'ワイドで読む二頭'); parent.appendChild(title);
    const grid = el('div', 'sf-dragons'); parent.appendChild(grid);
    view.dragons.forEach(d => {
      const active = selected.includes(d.id);
      const b = button(grid, '', () => {
        if (type === 'place') mutate(p, view.eventId, view.revision, r => F.edit(r, view.eventId, { place: active ? null : d.id }));
        else {
          const ids = view.plan.wide.filter(Boolean);
          if (active) ids.splice(ids.indexOf(d.id), 1); else if (ids.length < 2) ids.push(d.id); else return;
          mutate(p, view.eventId, view.revision, r => F.edit(r, view.eventId, { wide: ids }));
        }
      }, 'sf-dragon');
      b.setAttribute('aria-label', (type === 'place' ? '複勝 ' : 'ワイド ') + d.name); b.setAttribute('aria-pressed', String(active)); b.disabled = !d.scouted;
      b.append(art(d.id), el('strong', '', d.name));
      if (active) b.appendChild(el('small', 'sf-tag', '選択'));
    });
    const notes = view.dragons.filter(d => selected.includes(d.id));
    notes.forEach(d => parent.appendChild(el('p', 'sf-observation', d.name + '：' + d.trait + (d.observation ? ' ' + d.observation : ''))));
    const article = preview.articles?.find(a => a.type === type);
    if (article?.winningOdds) parent.appendChild(el('p', 'sf-odds', '的中した場合 ' + money(article.winningOdds.min) + ' ～ ' + money(article.winningOdds.max) + '倍'));
  }
  function finances(parent, preview) {
    const box = panel(parent, '本日の客と、開催の帳簿');
    preview.segments.forEach(s => { const item = el('div', 'sf-group'); item.append(el('b', '', s.label + ' ' + s.count + '人'), el('p', 'sf-muted', '持参 ' + amount(s.budget) + '／単勝 ' + amount(s.win) + '・複勝 ' + amount(s.place) + '・ワイド ' + amount(s.wide) + '・買物 ' + amount(s.shopping) + '・未使用 ' + amount(s.unspent))); if (s.away) item.appendChild(el('p', 'sf-muted', '希望者のうち ' + s.away + '人は、本日の設備では受け入れられません。')); box.appendChild(item); });
    rows(box, [['店の売上／原価', amount(preview.commerce.sales) + ' ／ ' + amount(preview.commerce.cost)], ['店の粗利', amount(preview.commerce.net)], ['開催費', amount(preview.cost)], ['運営収支の幅', signed(preview.net.min) + ' ～ ' + signed(preview.net.max)]]);
    const compare = el('details', 'sf-details'); compare.appendChild(el('summary', '', '神眼の前後で、何が変わったか'));
    rows(compare, [['同じ客・予言前の単勝開催', signed(preview.beforeOracle.operatingProfit)], ['同じ客・予言後の単勝開催', signed(preview.baseline.operatingProfit)], ['今回の案', signed(preview.net.min) + ' ～ ' + signed(preview.net.max)]]);
    compare.appendChild(el('p', 'sf-muted', '複勝・ワイドは単勝と別の財布です。別券種へ票が流れても、単勝の払戻が厚くなるわけではありません。'));
    box.appendChild(compare); return box;
  }
  async function finish() {
    const p = state.player, result = outcome(p), already = !!p.epilogue?.edFlag;
    if (ending || !result?.success || (!already && (!shinganUnlocked() || !shinganAllScouted()))) return;
    ending = true;
    try {
      await locked(() => { assertCurrentSave(p); shinganData().cleared = true; epilogueClear(); saveGame(); });
      if (typeof playFinalShowcase === 'function') await playFinalShowcase();
      if (state.player !== p) return;
      if (typeof playEightDragonsCutin === 'function') await playEightDragonsCutin();
      if (state.player !== p) return;
      await Ending.play(); if (state.player === p) await locked(() => { assertCurrentSave(p); markGameCleared(); });
    } finally { ending = false; }
  }
  // The seasonal account is in main-game coins, unlike the daily book's thousands.
  function recoveryPanel(parent, p, view) {
    const r = record(p), recovery = F.recoveryView(r, snapshot(p));
    if (!recovery?.required) return;
    const box = panel(parent, recovery.complete ? '次の開催を、自分たちの資金で迎えられる' : '島の仕事を、次の季節へ');
    box.classList.add('sf-recovery');
    const scene = el('img', 'sf-recovery-art'); scene.src = 'images/konron/discovery/cargo_exchange.webp'; scene.alt = '港と工房をつなぐ島の仕事'; box.appendChild(scene);
    box.appendChild(el('p', '', '当日の予想は届きました。ここからは、店と港への受渡しを続け、借りた分を返して、次の開催費を残します。'));
    rows(box, [['営業口座の現金', money(recovery.cash) + 'コイン'], ['この事業の借入／未払', money(recovery.debt) + ' ／ ' + money(recovery.arrears) + 'コイン'], ['次の開催に残す資金', money(recovery.reserve) + 'コイン'], ['回収して保管中の空瓶', recovery.bottles + '本'], ['封をして次季へ残す果実酢', (recovery.packedStock || 0) + '本']]);
    if (Number.isFinite(recovery.periodNet)) rows(box, [['直近の四季の純収支', money(recovery.periodNet) + 'コイン' + (recovery.history.length < 4 ? '（現在' + recovery.history.length + '季）' : '')]]);
    if (recovery.partnerReply) box.appendChild(el('p', 'sf-partner', recovery.partnerReply));
    if (recovery.last) box.appendChild(el('p', 'sf-muted', '前季の純収支 ' + money(recovery.last.net) + 'コイン。荷受所へ ' + money(recovery.last.standingPaid || 0) + 'コインを支払い、季末の未払は ' + money(recovery.last.arrears) + 'コインです。'));
    if (recovery.complete) {
      box.appendChild(el('p', 'sf-hit', '平日と祭日の営業を続け、四季ひと巡りの事業収支は黒字。借入と未払を清算し、次の一窓口を開く資金が残りました。'));
      box.appendChild(el('p', 'sf-muted', 'この事業を続けられる形まで、島の人たちと立て直しました。'));
      button(box, '島の夜明けを見届ける', finish, 'sf-primary');
    } else {
      box.append(el('h4', '', recovery.periodLabel), el('p', '', recovery.condition));
      const draft = { ...(recovery.previousPlan || { desk: 'place', contract: 'local' }) };
      if (!recovery.choices.contracts.some(c => c.id === draft.contract && c.available)) draft.contract = 'local';
      const selections = el('div', 'sf-recovery-choices'), quoteBox = el('div', 'sf-recovery-quote'); box.append(selections, quoteBox);
      function showQuote() {
        quoteBox.replaceChildren();
        const q = F.quoteRecovery(record(p), draft, snapshot(p));
        const unit = draft.contract === 'local' ? '口' : '本';
        quoteBox.appendChild(el('h4', '', 'この受渡しの見通し'));
        rows(quoteBox, [['受注希望／渡せる品', q.ordered + ' ／ ' + q.deliverable + unit], ['品の仕入れ（瓶を含む）', money(q.goodsCost) + 'コイン'], ['運送費／開催前払', money(q.freight) + ' ／ ' + money(q.setup) + 'コイン'], ['荷受所の保管・伝票業務', money(q.standingCost || 0) + 'コイン'], ['受け取る予約前金', money(q.shopAdvance) + 'コイン'], ['必要な追加借入', money(q.draw) + 'コイン'], ['引渡しで受け取る売上', money(q.revenue) + 'コイン']]);
        const stockedAdvance = Math.min(q.shopAdvance, q.goodsCost + q.freight);
        quoteBox.appendChild(el('p', 'sf-muted', '予約前金のうち ' + money(stockedAdvance) + 'コインを仕入れと運送に充てます。' + (q.shopAdvance > stockedAdvance ? '残る ' + money(q.shopAdvance - stockedAdvance) + 'コインは、品を渡すまで預かります。' : '') + '会場の前払には使えません。'));
        if (q.raceOutlook) {
          const ahead = q.raceOutlook;
          quoteBox.appendChild(el('p', '', '開催の来場見込み：島の客 ' + ahead.locals + '人、船の客 ' + ahead.visitors + '人。' + (ahead.away ? '設備の枠により ' + ahead.away + '人は迎えられません。' : '')));
          rows(quoteBox, [['納入の収支見通し', money(q.tradeNet) + 'コイン'], ['開催の収支見通し', coinForecast(ahead)], ['維持費と利息を引いた今季の収支', coinForecast(q.netOutlook)]]);
        }
        if (draft.contract !== 'local') quoteBox.appendChild(el('p', 'sf-muted', '在庫から納める果実酢 ' + (q.fromStock || 0) + '本。新瓶の輸入 ' + q.imported + '本 ／ 空瓶の再利用 ' + q.reused + '本。仕入れ費を払った未売の果実酢 ' + (q.packedStock || 0) + '本は、次季へ残します。'));
        if (q.missed) quoteBox.appendChild(el('p', 'sf-miss', '今回は ' + q.missed + unit + 'の希望に応えられません。受け取れない注文を売上には入れていません。'));
        q.notes.forEach(note => quoteBox.appendChild(el('p', 'sf-observation', note)));
        quoteBox.appendChild(el('p', 'sf-muted', '借入上限 ' + money(q.creditLimit) + 'コイン。予約前金と借入は売上に上乗せせず、引渡しと返済を帳簿に残します。'));
        quoteBox.appendChild(el('p', 'sf-muted', '荷受所の保管と伝票担当への支払いは季末。足りない分も未払として次季へ残ります。'));
        const settle = button(quoteBox, 'この段取りで、営業と引渡しを進める', () => mutate(p, view.eventId, view.revision, current => F.settleRecovery(current, view.eventId, view.revision, { ...draft }, snapshot(p))), 'sf-primary');
        settle.disabled = !q.operates;
        if (!q.operates) quoteBox.appendChild(el('p', 'sf-miss', '前払が信用枠を超えます。窓口や契約を選び直してください。'));
      }
      for (const [key, label, items] of [['desk', '来場する人を、どう迎える？', recovery.choices.desks], ['contract', '島の誰へ、何を届ける？', recovery.choices.contracts]]) {
        const group = el('fieldset', 'sf-contract-group'); group.appendChild(el('legend', '', label));
        items.forEach(item => {
          const b = button(group, '', () => { draft[key] = item.id; for (const sibling of group.querySelectorAll('button')) sibling.setAttribute('aria-pressed', String(sibling === b)); showQuote(); }, 'sf-desk');
          b.setAttribute('aria-label', item.label); b.setAttribute('aria-pressed', String(draft[key] === item.id)); b.disabled = item.available === false;
          b.append(el('b', '', item.label), el('small', '', item.detail));
          if (item.available === false) b.appendChild(el('small', 'sf-miss', '港と工房の受渡しを、現地で確かめると選べます。'));
        });
        selections.appendChild(group);
      }
      showQuote();
      if (recovery.remaining.length) { const detail = el('details', 'sf-details'); detail.appendChild(el('summary', '', '事業を立て直すために、残っていること')); recovery.remaining.forEach(text => detail.appendChild(el('p', 'sf-muted', text))); box.appendChild(detail); }
      button(box, '島を歩いて、次の段取りを探す', () => typeof renderKonronMap === 'function' ? renderKonronMap() : renderIslandBuild());
      button(box, '施設に投資して、次の供給を増やす', renderIslandBuild);
    }
    const history = el('details', 'sf-details'); history.appendChild(el('summary', '', '営業の帳簿を読み返す'));
    rows(history, [['最初の公示までの開催収支', money(recovery.opening.net) + 'コイン'], ['その時点の現金／未払', money(recovery.opening.cash) + ' ／ ' + money(recovery.opening.arrears) + 'コイン']]);
    for (const entry of recovery.history) {
      const item = el('section', 'sf-group'); item.appendChild(el('b', '', entry.periodLabel));
      item.appendChild(el('p', 'sf-muted', recovery.choices.desks.find(d => d.id === entry.plan.desk)?.label + ' ／ ' + recovery.choices.contracts.find(c => c.id === entry.plan.contract)?.label));
      rows(item, [['納入した品／売上', entry.deliverable + (entry.plan.contract === 'local' ? '口' : '本') + ' ／ ' + money(entry.revenue) + 'コイン'], ['商いの収支／開催の収支', money(entry.tradeNet) + ' ／ ' + money(entry.raceNet) + 'コイン'], ['荷受所への請求／実際の支払', money(entry.standingCost || 0) + ' ／ ' + money(entry.standingPaid || 0) + 'コイン'], ['支払った利息／返した元金', money(entry.interestPaid) + ' ／ ' + money(entry.repaid) + 'コイン'], ['今季の純収支／残った未払', money(entry.net) + ' ／ ' + money(entry.arrears) + 'コイン'], ['営業口座の残高', money(entry.cash) + 'コイン']]);
      if (entry.race) {
        const detail = el('details', 'sf-details'); detail.appendChild(el('summary', '', 'この季の競走と払戻を見る'));
        detail.appendChild(el('p', 'sf-muted', 'セレスティアの一着予言：' + name(view, entry.race.oracleId) + '。実際の着順：' + entry.race.order.slice(0, 3).map(id => name(view, id)).join(' → ')));
        rows(detail, ['win', 'place', 'wide'].map(key => [({ win: '単勝', place: '複勝', wide: 'ワイド' })[key] + ' 売上／払戻', money(entry.race.pools[key].sales) + ' ／ ' + money(entry.race.pools[key].payout) + 'コイン']));
        item.appendChild(detail);
      }
      item.appendChild(el('p', 'sf-partner', entry.partnerReply)); history.appendChild(item);
    }
    box.appendChild(history);
  }
  function resultPanel(parent, p, view) {
    const result = view.lastResult;
    const daily = result.success && view.recoveryRequired ? el('details', 'sf-details sf-daily-archive') : parent;
    if (daily !== parent) { daily.appendChild(el('summary', '', '届いた予想と、最初の開催帳簿を読む')); parent.appendChild(daily); }
    const box = panel(daily, result.success ? '神眼は当たった。一着の外にも、読みが届いた。' : '予想と営業を、別々に振り返る'); box.classList.add('sf-result');
    const podium = el('div', 'sf-podium');
    result.order.slice(0, 3).forEach((id, i) => { const tile = el('div'); tile.append(el('small', '', (i + 1) + '着'), art(id), el('strong', '', name(view, id))); podium.appendChild(tile); }); box.appendChild(podium);
    result.predictions.forEach(prediction => {
      const text = el('p', prediction.hit ? 'sf-hit' : 'sf-miss', (prediction.hit ? '的中　' : '外れ　') + (prediction.type === 'place' ? '複勝 ' : 'ワイド ') + prediction.ids.map(id => name(view, id) + ' ' + (result.order.indexOf(id) + 1) + '着').join(' × '));
      box.appendChild(text); if (Number.isFinite(prediction.payout)) box.appendChild(el('p', 'sf-muted', 'その券を買った客へ ' + amount(prediction.payout) + 'の払戻。'));
      if (!result.pools[prediction.type].sales) box.appendChild(el('p', 'sf-muted', '参考欄・販売なし。この窓口では扱っていません。'));
    });
    rows(box, ['win', 'place', 'wide'].map(key => [({ win: '単勝', place: '複勝', wide: 'ワイド' })[key] + ' 売上／払戻', amount(result.pools[key].sales) + ' ／ ' + amount(result.pools[key].payout)]).concat([['店の粗利', amount(result.commerce.net)], ['開催費', amount(result.cost)], ['当日の運営収支', signed(result.operatingProfit)]]));
    box.append(el('p', '', '予言の外の読み：' + (result.substantiveHit ? '開いた窓口で届いた' : '開いた窓口では届かなかった')), el('p', '', '開催の継続：' + (result.operatingProfit >= 0 ? '費用を賄えた' : '費用を賄えなかった')));
    if (result.reading?.oracleDragonId) box.appendChild(el('p','sf-muted','持ち込んだ手帖「' + result.reading.raceName + '」。' + ReadingJournal.oracleAccount(result.reading)));
    if (result.success && view.recoveryRequired) recoveryPanel(parent, p, view);
    else if (result.success) button(box, '島の夜明けを見届ける', finish, 'sf-primary');
    else {
      box.appendChild(el('p', 'sf-muted', 'この号と着順は記録に残ります。見た着順に再提出せず、島の備えや読みを次の開催で確かめます。'));
      button(box, '次の開催の公示を見る', () => mutate(p, view.eventId, view.revision, r => F.next(r, view.eventId, snapshot(p), seed())), 'sf-primary');
    }
    button(box, '島づくりへ戻る', renderIslandBuild);
  }
  function render() {
    state.ui.screen = 'shingan'; const p = state.player, app = el('section', 'sf-page'); beginScreen().appendChild(app);
    const hero = el('header', 'sf-hero'), image = el('img'); image.src = 'images/story/late/arena_before_dawn.webp'; image.alt = ''; hero.append(image, el('small', '', '神眼レース / 島の明日'), el('h2', '', '一着の、その先へ。')); app.appendChild(hero);
    if (!F) { app.appendChild(el('p', '', '開催の画面を読み込めませんでした。ページを再読み込みしてください。')); return; }
    try {
      let r = record(p), view = F.view(r);
      if (!p.shingan?.festival) { initializePanel(app, p, false); return; }
      if (!view.eventId && view.legacy.receipt?.success && oldRender) { oldRender(); return; }
      if (!view.eventId && view.legacy.legacyCleared) { app.appendChild(el('p', '', '以前に見届けた決戦のクリア記録が残っています。設定のおまけから読み返せます。')); }
      else if (!shinganUnlocked() && !(p.epilogue?.edFlag && view.lastResult?.success)) app.appendChild(el('p', '', '第5話を読み、決戦の備えを整えると公示を迎えます。'));
      else if (!view.eventId && !shinganAllScouted()) {
        const gate = panel(app, '八頭の取材を、持ち寄る');
        SHINGAN_ROSTER.filter(d => !shinganScouted(d.id)).forEach(d => { const row = el('div', 'sf-gate'); row.append(art(d.id), el('b', '', d.name)); button(row, d.id === 'poro' ? 'ポロとの出会いを振り返る' : '取材へ向かう', () => d.id !== 'poro' && typeof stalkReportDepart === 'function' ? stalkReportDepart(d.id) : renderScout()); gate.appendChild(row); });
      } else {
        if (!view.eventId && typeof maybeGrantDragonRobe === 'function' && maybeGrantDragonRobe(() => { if (state.player === p && state.ui.screen === 'shingan') render(); })) { app.appendChild(el('p', 'sf-muted', '島から託された装いを受け取って、本番へ……')); return; }
        if (!view.eventId) { initializePanel(app, p, true); return; }
        const heading = panel(app, view.meeting.title); heading.append(el('p', '', view.meeting.condition), el('p', 'sf-muted', '第' + r.sequence + '回の公示。本日の準備は公示時点の記録です。整備や新しい発見は次の開催へ引き継ぎます。'));
        const equipment = el('details', 'sf-details'); equipment.appendChild(el('summary', '', '島で整えてきたものを見る'));
        const grid = el('div', 'sf-facilities'); view.facilities.forEach(f => { const tile = el('article'); tile.append(el('b', '', f.label + ' Lv.' + f.level), el('p', '', f.milestone || 'これから整える'), el('small', '', f.role)); if (f.id === 'public' && view.care?.waterCarrier) tile.appendChild(el('small', '', '水番と運び架を手入れ済み')); grid.appendChild(tile); }); equipment.appendChild(grid); heading.appendChild(equipment);
        if (view.published) resultPanel(app, p, view);
        else {
          const preview = F.preview(r), edits = panel(app, 'この開催で、どう迎えるか');
          const deskCopy = { win: '一着予言を知った客の単勝を受け付ける。', place: '単勝に加え、二着に残る一頭の見立てを届ける。', mixed: '二着の読みと、二頭を応援する組合せを届ける。' };
          const desks = el('div', 'sf-desks'); view.desks.forEach(d => { const b = button(desks, '', () => mutate(p, view.eventId, view.revision, current => F.edit(current, view.eventId, { desk: d.id })), 'sf-desk'); b.setAttribute('aria-pressed', String(view.plan.desk === d.id)); b.append(el('b', '', d.label), el('small', '', '開催費 ' + amount(d.cost) + '。' + deskCopy[d.id])); }); edits.appendChild(desks);
          sourcePicker(edits, p, view);
          const race = panel(app, view.course.title); race.append(el('p', '', view.course.condition), el('p', 'sf-oracle', 'セレスティアの一着予言：' + view.oracle.name));
          if (view.plan.desk !== 'win') choices(race, p, view, preview, 'place');
          if (view.plan.desk === 'mixed') choices(race, p, view, preview, 'wide');
          const finance = finances(app, preview);
          if (preview.facilityEffects?.length) { const effects = el('details', 'sf-details'); effects.appendChild(el('summary', '', '施設・企画が当日に活きる場所')); preview.facilityEffects.forEach(f => effects.appendChild(el('p', 'sf-muted', f.label + '：' + f.detail))); finance.appendChild(effects); }
          preview.errors.forEach(text => finance.appendChild(el('p', 'sf-miss', text)));
          const publish = button(finance, '予想を発行して、開催を見届ける', () => mutate(p, view.eventId, view.revision, current => F.publish(current, view.eventId, view.revision)), 'sf-primary'); publish.disabled = !preview.ready;
          finance.appendChild(el('p', 'sf-muted', 'これは島の開催帳簿です。票の売上や払戻をミミ個人の所持金へ入れません。'));
        }
        if (view.history.length || view.legacy.receipt) {
          const history = panel(app, '過去号を残して、次へ');
          if (view.legacy.receipt) {
            const old = view.legacy.receipt, details = el('details', 'sf-details'); details.appendChild(el('summary', '', '以前の開催を、当時の帳簿で読む'));
            old.predictions.forEach(prediction => details.appendChild(el('p', 'sf-muted', (prediction.hit ? '的中　' : '外れ　') + prediction.title + ' ／ 払戻 ' + money(prediction.payout) + 'コイン')));
            details.appendChild(el('p', 'sf-muted', '当時の運営収支 ' + money(old.operatingProfit) + 'コイン。方式の違う記録として保管し、採点し直しません。')); history.appendChild(details);
          }
          view.history.forEach((issue, index) => {
            const details = el('details', 'sf-details'); details.appendChild(el('summary', '', '記録' + (index + 1) + ' · ' + issue.course.title + ' ／ ' + signed(issue.operatingProfit)));
            details.appendChild(el('p', 'sf-muted', issue.meeting.title + '。' + issue.course.condition));
            issue.predictions.forEach(prediction => details.appendChild(el('p', 'sf-muted', (prediction.hit ? '的中　' : '外れ　') + prediction.ids.map(id => name(view, id) + ' ' + (issue.order.indexOf(id) + 1) + '着').join(' × ') + ' ／ 払戻 ' + amount(prediction.payout))));
            rows(details, [['店の粗利', amount(issue.commerce.net)], ['開催費', amount(issue.cost)], ['運営収支', signed(issue.operatingProfit)]]); history.appendChild(details);
          });
        }
      }
    } catch (error) { app.appendChild(el('p', 'sf-miss', '開催の記録を確認できませんでした。元の保存は保持しています。' + error.message)); }
    button(app, 'ホームへ戻る', renderHome, 'sf-back');
  }
  root.ShinganOfficial = { getOutcome: outcome };
  root.renderShinganFairRace = render;
})(typeof window !== 'undefined' ? window : globalThis);
