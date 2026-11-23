// Independent playable research surface. No main-game save, currency or globals.
(function () {
  'use strict';
  const host = document.getElementById('lab'), E = window.ShinganEconomyLab;
  if (!E) { host.textContent = '試作を読み込めませんでした。ページを再読み込みしてください。'; return; }
  const n = value => Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  const signed = value => (value > 0 ? '+' : '') + n(value);
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  let investment = 'low', known = 'all', lastTrait = '', message = '';
  const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  let sessionSeed = seed();
  let state = E.createState({ seed: sessionSeed, investment });
  let catalog = E.getView(state).dragons;
  function start() {
    state = E.createState({ seed: sessionSeed, investment, scouted: known === 'all' ? catalog.map(d => d.id) : catalog.slice(0, 3).map(d => d.id) });
  }
  start();
  function rerender() { const y = scrollY; render(); scrollTo(0, y); }
  function button(parent, title, action, cls) { const b = el('button', cls, title); b.type = 'button'; b.onclick = () => { try { message = ''; action(); } catch (error) { message = error.message; } rerender(); }; parent.appendChild(b); return b; }
  function panel(parent, step, title) { const box = el('section', 'panel'); if (step) box.appendChild(el('span', 'step', step)); box.appendChild(el('h2', '', title)); parent.appendChild(box); return box; }
  function list(parent, rows) { const ul = el('ul', 'ledger'); rows.forEach(([label, value]) => { const li = el('li'); li.append(el('span', '', label), el('b', '', value)); ul.appendChild(li); }); parent.appendChild(ul); }
  function picture(id, name) { const img = el('img'); img.src = 'images/dragons/' + id + '.png'; img.alt = name || ''; return img; }
  function name(id) { return catalog.find(d => d.id === id)?.name || id; }
  function select(parent, label, choices, current, update, disabled) {
    const wrap = el('label', '', label), control = el('select'); control.setAttribute('aria-label', label);
    choices.forEach(([value, text]) => { const option = el('option', '', text); option.value = value; option.selected = value === current; control.appendChild(option); });
    control.disabled = disabled; control.onchange = () => { update(control.value); rerender(); }; wrap.appendChild(control); parent.appendChild(wrap);
  }
  function choose(parent, view, type) {
    const values = type === 'place' ? [view.plan.place] : view.plan.wide || [];
    const grid = el('div', 'dragons'); parent.appendChild(grid);
    view.dragons.forEach(d => {
      const selected = values.includes(d.id);
      const b = button(grid, '', () => {
        lastTrait = d.name + '：' + d.trait + (d.observation ? ' ' + d.observation : '');
        if (type === 'place') state = E.edit(state, { place: selected ? null : d.id });
        else {
          const wide = (view.plan.wide || []).filter(Boolean);
          if (selected) wide.splice(wide.indexOf(d.id), 1);
          else if (wide.length < 2) wide.push(d.id);
          else { message = 'ワイドは二頭の組合せです。入れ替える竜を一度外してください。'; return; }
          state = E.edit(state, { wide });
        }
      }, 'dragon');
      b.setAttribute('aria-pressed', String(selected)); b.setAttribute('aria-label', (type === 'place' ? '複勝 ' : 'ワイド ') + d.name);
      b.title = d.trait + (d.observation ? ' ' + d.observation : ''); b.disabled = view.published || !d.scouted;
      b.append(picture(d.id, ''), el('strong', '', d.name));
      if (selected) b.appendChild(el('span', 'selected', '選択'));
      if (!d.scouted) b.appendChild(el('small', '', '未取材'));
    });
    parent.appendChild(el('p', 'dragon-note', lastTrait || '竜に触れると、このコースでの観察メモが開きます。特徴と条件を見比べて選びます。'));
    const article = E.preview(state).articles?.find(a => a.type === type);
    if (article && article.winningOdds) {
      const odds = article.winningOdds;
      parent.appendChild(el('p', 'article-return', '的中した場合の払戻：' + n(odds.min) + ' ～ ' + n(odds.max) + '倍'));
      parent.appendChild(el('p', 'explain', 'この予想への総票 ' + n(article.stake) + '枚。そのうち紹介を読んで向かう票 ' + n(article.directedStake) + '枚。外れた場合の払戻はありません。'));
    }
  }
  function comparisons(parent, forecast) {
    if (!forecast.baseline || !forecast.beforeOracle) return;
    const table = el('table', 'receipt'), head = el('thead'), header = el('tr');
    ['同じ客・同じ財布', '予言の前', '予言の後', '今回の案'].forEach(t => header.appendChild(el('th', '', t))); head.appendChild(header); table.appendChild(head);
    const body = el('tbody'), before = forecast.beforeOracle, after = forecast.baseline;
    const side = ['place', 'wide'].reduce((s, key) => ({ min: s.min + forecast.pools[key].minNet, max: s.max + forecast.pools[key].maxNet }), { min: 0, max: 0 });
    [['単勝の取り分', n(before.win.houseNet), n(after.win.houseNet), n(forecast.pools.win.minNet)],
      ['複勝・ワイドの取り分', '0', '0', n(side.min) + ' ～ ' + n(side.max)],
      ['店の粗利', n(before.commerce.net), n(after.commerce.net), n(forecast.commerce.net)],
      ['開催費', n(before.cost), n(after.cost), n(forecast.cost)],
      ['運営収支', signed(before.operatingProfit), signed(after.operatingProfit), signed(forecast.net.min) + ' ～ ' + signed(forecast.net.max)]].forEach(cells => {
        const row = el('tr'); cells.forEach(text => row.appendChild(el('td', '', text))); body.appendChild(row);
      });
    table.appendChild(body); parent.appendChild(table);
  }
  function receipt(parent, result, compact) {
    if (!compact) {
      const podium = el('div', 'podium');
      result.order.slice(0, 3).forEach((id, i) => { const item = el('div', 'rank'); item.append(el('span', '', (i + 1) + '着'), picture(id, name(id)), el('strong', '', name(id))); podium.appendChild(item); });
      parent.appendChild(podium);
      const hits = el('div', 'hits');
      result.predictions.forEach(p => {
        const line = el('div', 'hit'); line.append(el('b', p.hit ? 'positive' : 'negative', p.hit ? '的中' : '外れ'), document.createTextNode((p.type === 'place' ? '複勝 ' : 'ワイド ') + p.ids.map(name).join(' × ')));
        line.appendChild(el('p', 'explain', p.ids.map(id => name(id) + ' ' + (result.order.indexOf(id) + 1) + '着').join(' ／ ')));
        if (Number.isFinite(p.stake)) line.appendChild(el('p', 'explain', '総票 ' + n(p.stake) + '枚 → 払戻 ' + n(p.payout) + '枚' + (p.hit ? '（' + n(p.odds) + '倍）' : '') + '。受け取るのは、その券を買った客です。'));
        if (!result.pools[p.type].sales) line.appendChild(el('p', 'explain', '参考欄・販売なし。この窓口では扱っていない予想です。'));
        if (!p.addsInformation) line.appendChild(el('p', 'explain', '神眼で既に確定していた範囲です。'));
        hits.appendChild(line);
      }); parent.appendChild(hits);
    }
    const table = el('table', 'receipt'), head = el('thead'), tr = el('tr');
    ['券種', '売上', '払戻', '運営に残る'].forEach(t => tr.appendChild(el('th', '', t))); head.appendChild(tr); table.appendChild(head);
    const body = el('tbody');
    ['win', 'place', 'wide'].forEach(key => { const pool = result.pools[key], row = el('tr'); [({ win: '単勝', place: '複勝', wide: 'ワイド' })[key], n(pool.sales), n(pool.payout), n(pool.houseNet)].forEach(t => row.appendChild(el('td', '', t))); body.appendChild(row); });
    table.appendChild(body); parent.appendChild(table);
    if (result.commerce) list(parent, [['店の売上', n(result.commerce.sales)], ['店の原価', n(result.commerce.cost)], ['店の粗利', n(result.commerce.net)]]);
    list(parent, [['開催費', n(result.cost)], ['当日の運営収支', signed(result.operatingProfit)]]);
    if (result.explanation) parent.appendChild(el('p', 'explain', result.explanation));
  }
  function render() {
    const view = E.getView(state), forecast = E.preview(state), result = view.lastResult;
    catalog = view.dragons; host.replaceChildren();
    const hero = el('section', 'hero'), art = el('img'); art.src = 'images/story/late/arena_before_dawn.webp'; art.alt = '';
    const copy = el('div'); copy.append(el('span', 'eyebrow', 'MIMI / ISLAND TOMORROW'), el('h1', '', '神眼が当たっても、\n島の灯りは消させない。'), el('p', '', '一着は、セレスティアの言うとおり。まだ決まっていない席を竜の個性から読み、島を訪れる人たちと明日の開催をつなぐ。'));
    hero.append(art, copy); host.appendChild(hero);
    host.appendChild(el('p', 'scope', '経済と駆け引きを確かめる独立試作です。数値は仮説として比較中。本編のセーブ・所持金・クリアには接続しません。'));
    if (message) { const notice = el('div', 'notice'); notice.setAttribute('role', 'status'); notice.textContent = message; host.appendChild(notice); }
    const layout = el('div', 'layout'), left = el('div'), right = el('aside', 'sticky'); layout.append(left, right); host.appendChild(layout);
    const prep = panel(left, '01 / ISLAND', 'どんな島で、迎えるか');
    const setup = el('div', 'setup'); prep.appendChild(setup);
    select(setup, '島の整備', [['low', '小さな会場・整備前'], ['high', '来訪・市場の受け入れを整備済み']], investment, value => { investment = value; start(); }, view.published);
    select(setup, '持ち込む取材記録', [['all', '八頭を知っている'], ['few', '三頭から考える']], known, value => { known = value; start(); }, view.published);
    prep.appendChild(el('p', 'explain', '同じ友情は、築いた時期で価値を変えません。整備は競走の着順を変えず、来られる客と会場の条件に作用します。'));
    prep.appendChild(el('p', 'explain', '整備済みは比較用の初期状態です。整備費・投資回収・そこに至る本編の時間は、この試作ではまだ計算していません。'));
    if (view.meeting) { prep.appendChild(el('h3', '', view.meeting.title)); prep.appendChild(el('p', '', view.meeting.condition)); }
    const race = panel(left, '03 / FORECAST', 'まだ見えていない二着、その先へ');
    race.append(el('small', '', view.eventId), el('div', 'course-title', view.course.title), el('p', '', view.course.condition));
    const oracle = el('div', 'oracle'), prophecy = el('p'); prophecy.append(el('strong', '', '一着予言：' + view.oracle.name), el('small', '', '一着は確定。二着以降を教える予言ではありません。')); oracle.append(picture(view.oracle.id, ''), prophecy); race.appendChild(oracle);
    if (view.plan.desk !== 'win') { race.appendChild(el('h3', '', '複勝で読む一頭')); choose(race, view, 'place'); }
    else race.appendChild(el('p', 'explain', '単勝窓口は、一着の券だけを扱います。一着以外の読みを届けるには、複勝か両窓口を選べます。'));
    if (view.plan.desk === 'mixed') { race.appendChild(el('h3', '', 'ワイドで読む二頭')); choose(race, view, 'wide'); }
    const desk = panel(left, '02 / FESTIVAL', '楽しみを、どう届けるか'); left.insertBefore(desk, race);
    const desks = el('div', 'desks'); desk.appendChild(desks);
    view.desks.forEach(d => {
      const b = button(desks, '', () => { state = E.edit(state, { desk: d.id }); }, 'desk');
      b.setAttribute('aria-pressed', String(view.plan.desk === d.id)); b.disabled = view.published; b.append(el('strong', '', d.label), el('span', '', d.description));
    });
    if (forecast.segments?.length) {
      const audience = panel(right, 'VISITORS', '来る人と、持ってきた予算');
      forecast.segments.forEach(s => {
        const group = el('div', 'budget-group'); group.appendChild(el('p', '', s.label + ' ' + n(s.count) + '人／持参 ' + n(s.budget)));
        if (s.away) group.appendChild(el('small', '', '来訪を希望 ' + n(s.potential) + '人・受け入れられず ' + n(s.away) + '人'));
        group.appendChild(el('small', '', '単勝 ' + n(s.win) + ' ・複勝 ' + n(s.place) + ' ・ワイド ' + n(s.wide) + ' ・買物 ' + n(s.shopping) + ' ・未使用 ' + n(s.unspent)));
        audience.appendChild(group);
      });
      audience.appendChild(el('p', 'explain', '予言前・予言後との比較は同じ人数・財布です。整備条件を変えるときは、来場人数の違いも別に確かめます。'));
    }
    const finance = panel(right, 'BEFORE THE RACE', '発行前の会計');
    finance.appendChild(el('p', 'explain', '単位は試作用コイン。来場者の財布は一人10コインです。'));
    if (forecast.pools) list(finance, ['win', 'place', 'wide'].map(key => [({ win: '単勝', place: '複勝', wide: 'ワイド' })[key] + 'の売上', n(forecast.pools[key].sales)]));
    list(finance, [['開催費', n(forecast.cost)]]);
    if (forecast.commerce) list(finance, [['店の売上', n(forecast.commerce.sales)], ['店の原価', n(forecast.commerce.cost)], ['店の粗利', n(forecast.commerce.net)]]);
    if (forecast.net) { const metric = el('div', 'metric'); metric.append(el('span', '', '着順がまだ見えていない段階の収支範囲'), el('strong', forecast.net.max < 0 ? 'negative' : '', signed(forecast.net.min) + ' ～ ' + signed(forecast.net.max))); finance.appendChild(metric); }
    finance.appendChild(el('p', 'explain', '範囲は的中確率や期待収益ではありません。売上と払戻を分け、全員が当たる券種では運営の取り分がなくなる場合も確かめます。'));
    const compare = el('details', 'archive'); compare.appendChild(el('summary', '', '予言で何が変わり、この案は何を戻すか')); comparisons(compare, forecast); finance.appendChild(compare);
    if (forecast.errors?.length) forecast.errors.forEach(error => finance.appendChild(el('p', 'explain warning', error)));
    if (!view.published) { const send = button(finance, 'この予想で発行し、開催を見届ける', () => { state = E.publish(state); }, 'cta'); send.disabled = !forecast.ready; }
    else finance.appendChild(el('p', 'notice', 'この開催は発行済みです。予想と結果を残し、次は別の開催へ進みます。'));
    if (result) {
      const results = panel(left, '04 / AFTER THE RACE', result.success ? '予言は当たった。島も、続く。' : 'どこで、明日につながらなかったか');
      if (result.meeting) results.appendChild(el('p', 'explain', result.meeting.title));
      receipt(results, result, false);
      results.appendChild(el('p', result.substantiveHit ? 'positive' : 'negative', '予言の外の読み：' + (result.substantiveHit ? '開いた窓口で的中した' : '開いた窓口では届かなかった')));
      results.appendChild(el('p', result.operatingProfit >= 0 ? 'positive' : 'negative', '開催の継続：' + (result.operatingProfit >= 0 ? '当日の費用を賄えた' : '当日の費用を賄えなかった')));
      if (Array.isArray(result.feedback)) result.feedback.forEach(line => results.appendChild(el('p', '', line)));
      results.appendChild(el('p', 'explain', '読みの答え合わせと、開催を続けられた理由は別々に見返します。次の挑戦は別開催で、見た着順への再提出は行いません。'));
      button(results, '別の開催条件で、もう一度読む', () => { state = E.nextEvent(state); lastTrait = ''; }, 'cta');
      button(results, '島の条件を変えて、新しい検証を始める', () => { sessionSeed = seed(); start(); lastTrait = ''; }, 'secondary');
    }
    const history = view.history || [];
    if (history.length) { const archive = panel(left, '', '残してきた開催'); const details = el('details', 'archive'); details.appendChild(el('summary', '', history.length + '開催の紙面と会計を読む')); history.slice().reverse().forEach(r => { const article = el('article'); article.appendChild(el('p', '', r.course?.title || r.eventId)); receipt(article, r, true); details.appendChild(article); }); archive.appendChild(details); }
  }
  try { render(); } catch (error) { host.replaceChildren(el('p', 'error', '試作の表示に問題が見つかりました：' + error.message)); throw error; }
})();
