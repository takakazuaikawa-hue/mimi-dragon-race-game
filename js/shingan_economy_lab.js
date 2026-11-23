// Standalone experiment. The figures describe this island, not a real tote.
(function (root, factory) {
  const lab = factory();
  if (typeof module === "object" && module.exports) module.exports = lab;
  else root.ShinganEconomyLab = lab;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const dragons = [
    ["raiou", "ライオウ", "先頭に立つと雷をまとって伸びる。"],
    ["fugaku", "フガク", "長い登りで位置を守る持久型。"],
    ["glaze", "グレイズ", "前の竜が忙しくなる流れでも歩調が乱れにくい。"],
    ["poro", "ポロ", "流れが落ち着くと先団を追い続ける。"],
    ["yomi", "ヨミ", "長い下りから勢いがつく後半型。"],
    ["souten", "ソウテン", "前に目標が残る長い直線で追い上げる。"],
    ["phenix", "フェニックス", "出遅れやすいが、開けた直線で鋭く伸びる。"],
    ["goka", "ゴウカ", "先団の入れ替わりに反応し、競り合いで粘る。"]
  ].map(([id, name, trait]) => ({ id, name, trait }));
  const ids = dragons.map(d => d.id), oracle = dragons[0];
  // These suitability scores and the variation are public experimental rules.
  // The winner is given by the prophecy. Positions 2–8 are independent of votes.
  const courses = [
    { title: "潮風の登り坂", condition: "長い登りから向かい風の短い直線へ。持久力と乱れにくさが生きる。", fit: [8,7,5,2,3,2,6] },
    { title: "霧が晴れる峡谷", condition: "前半はゆっくり。長い下りで勢いがつき、先団が入れ替わる。", fit: [3,5,6,8,4,3,7] },
    { title: "雲の上の直線", condition: "前半は先行勢が競り、広い直線が長く続く。追う側も届く。", fit: [4,4,2,6,8,7,5] }
  ];
  const meetings = [
    { id: "weekday", title: "平日・仕事前の朝市", condition: "一窓口で二着の一頭を読む島の客が多い。島外客の便は小さく、朝のうちに仕事へ戻る。",
      demand: { faithful: 20, locals: 18, visitors: 12 } },
    { id: "festival", title: "祭日・連絡船の到着後", condition: "二頭を一緒に応援したい客が連絡船で来る。ワイドを扱わない日は、浮いた予算を持ち帰る。",
      demand: { faithful: 20, locals: 22, visitors: 26 } }
  ];
  function publicMeeting(meeting) {
    return { id: meeting.id, title: meeting.title, condition: meeting.condition };
  }
  const desks = [
    { id: "win", label: "単勝窓口", description: "一着の券を扱う。開催費は24コイン。", cost: 24 },
    { id: "place", label: "一窓口で単勝・複勝", description: "常設の一窓口で二着の読みも扱う。会場18＋窓口6で開催費は24コイン。", cost: 24 },
    { id: "mixed", label: "複勝・ワイドの相談窓口", description: "単勝に加え、二着以内の竜と三着以内の組合せを紹介。開催費は38コイン。", cost: 38 }
  ];
  const pair = (a, b) => [a, b].sort().join("+");
  const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map(b => pair(a, b)));
  const money = n => Math.round(n * 100) / 100;
  const copy = value => JSON.parse(JSON.stringify(value));
  function random(seed) {
    let counter = seed >>> 0;
    return function () {
      counter = (Math.imul(counter, 1664525) + 1013904223) >>> 0;
      return counter / 4294967296;
    };
  }
  function round(seed, number) {
    let key = (seed ^ Math.imul(number, 2654435761)) >>> 0;
    key = Math.imul(key ^ (key >>> 16), 2246822507);
    const next = random((key ^ (key >>> 13)) >>> 0);
    const course = courses[Math.floor(next() * courses.length)];
    const field = ids.slice(1).map((id, i) => ({ id, score: course.fit[i] + next() * 7 }));
    field.sort((a, b) => b.score - a.score);
    const meeting = meetings[(number - 1 + Math.floor(seed / 16)) % meetings.length];
    return { course, meeting, eventId: "島祭-" + number, order: [oracle.id, ...field.map(d => d.id)] };
  }
  // A handle exposes no sealed result; clients get a fresh public view or receipt.
  // No persistent storage, main-game functions, or global race state are accessed.
  const data = new WeakMap();
  function handle(value) { const key = Object.freeze({}); data.set(key, value); return key; }
  function get(state) {
    const s = data.get(state);
    if (!s) throw Error("無効な開催です。");
    return s.publishedMeetings.get(s.number) || s;
  }
  function createState(options) {
    const o = options || {};
    const seed = o.seed === undefined ? Math.floor(Math.random() * 4294967296) : o.seed;
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error("seed must be an unsigned integer");
    const investment = o.investment || "low";
    if (!["low", "high"].includes(investment)) throw Error("未知の島の備えです。");
    const scouted = o.scouted || [];
    if (!Array.isArray(scouted) || scouted.some(id => !ids.includes(id))) throw Error("未知の取材相手です。");
    return handle({ seed, number: 1, event: round(seed, 1), publishedMeetings: new Map(), investment, scouted: [...new Set(scouted)],
      plan: { desk: "win", place: null, wide: [null, null] }, history: [], published: false });
  }
  function requireOpen(s) { if (s.published) throw Error("発行済みの開催です。"); }
  function edit(state, change) {
    const s = get(state); requireOpen(s);
    const patch = change || {}, plan = { ...s.plan };
    if ("desk" in patch) {
      if (!desks.some(d => d.id === patch.desk)) throw Error("未知の窓口です。");
      plan.desk = patch.desk;
    }
    if ("place" in patch) {
      if (patch.place !== null && !ids.includes(patch.place)) throw Error("未知の複勝候補です。");
      plan.place = patch.place;
    }
    if ("wide" in patch) {
      if (!Array.isArray(patch.wide) || patch.wide.length > 2 ||
        patch.wide.some(id => id !== null && !ids.includes(id))) throw Error("ワイドは二頭を選びます。");
      plan.wide = [patch.wide[0] || null, patch.wide[1] || null];
    }
    return handle({ ...s, plan });
  }
  function scout(state, id) {
    const s = get(state); requireOpen(s);
    if (!ids.includes(id)) throw Error("未知の取材相手です。");
    return s.scouted.includes(id) ? state : handle({ ...s, scouted: [...s.scouted, id] });
  }
  function getView(state) {
    const s = get(state), c = s.event.course;
    return copy({ eventId: s.event.eventId, course: { title: c.title, condition: c.condition },
      meeting: publicMeeting(s.event.meeting),
      oracle: { id: oracle.id, name: oracle.name }, investment: s.investment,
      dragons: dragons.map((d, i) => ({ ...d, scouted: s.scouted.includes(d.id),
        observation: s.scouted.includes(d.id) && i ? "このコースへの適性 " + c.fit[i - 1] + "／8。走行時の揺れ幅は全頭共通で0以上7未満。" : null })),
      desks, plan: s.plan, published: s.published, history: s.history,
      lastResult: s.published ? s.history[s.history.length - 1] : null });
  }
  // All groups have the same ten-coin wallet. Only a fraction of visitors take
  // a new market seriously. Personal bets, shopping and unspent cash stay visible.
  // Columns are win/place/wide; shopping comes out of the unspent remainder.
  const groups = [
    { id: "faithful", label: "神眼を信じる常連", low: 20, high: 20, shop: 0,
      win: [8,0,0], place: [8,0,0], mixed: [8,0,0], follows: 0 },
    { id: "locals", label: "自分の推しがいる島の客", low: 16, high: 22, shop: 1,
      win: [6,0,0], place: [3,4,0], mixed: [2,3,3], follows: 0.25 },
    { id: "visitors", label: "券を比べる来訪客", low: 16, high: 26, shop: 1,
      win: [4,0,0], place: [2,6,0], mixed: [1,4,4], follows: 0.5 }
  ];
  function funding(investment, desk, meeting) {
    return groups.map(g => {
      const potential = meeting.demand[g.id];
      // The small weekday boat has ten seats. On the holiday the regular boat
      // can land sixteen even without the upgraded landing and market.
      const capacity = meeting.id === "weekday" && g.id === "visitors" && investment === "low" ? 10 : g[investment];
      const count = Math.min(potential, capacity), shop = investment === "high" ? g.shop : 0;
      let tickets = g[desk];
      if (meeting.id === "festival" && g.id === "visitors") {
        if (desk === "place") tickets = [2,2,0];
        if (desk === "mixed") tickets = [1,2,6];
      }
      const [w, p, x] = tickets;
      return { id: g.id, label: g.label, count, potential, away: potential-count, budgetPerPerson: 10, budget: count * 10,
        win: count*w, place: count*p, wide: count*x, shopping: count*shop, unspent: count*(10-w-p-x-shop) };
    });
  }
  function empty(keys) { return Object.fromEntries(keys.map(id => [id, 0])); }
  function distribute(stakes, keys, amount, offset) {
    const base = Math.floor(amount / keys.length), extra = amount % keys.length;
    keys.forEach((_, i) => { stakes[keys[(i + offset) % keys.length]] += base + (i < extra ? 1 : 0); });
  }
  function buildBooks(s, desk, prophecy) {
    const segments = funding(s.investment, desk, s.event.meeting);
    const bets = { win: empty(ids), place: empty(ids), wide: empty(pairs) };
    const selected = { place: s.plan.place, wide: pair(...s.plan.wide) };
    const directed = { place: 0, wide: 0 };
    segments.forEach((g, i) => {
      const offset = i * 3 + s.number;
      if (prophecy) bets.win[oracle.id] += g.win;
      else distribute(bets.win, ids, g.win, offset);
      for (const [type, keys] of [["place", ids], ["wide", pairs]]) {
        const candidate = selected[type], follows = keys.includes(candidate) ? Math.floor(g[type] * groups[i].follows) : 0;
        if (follows) bets[type][candidate] += follows;
        directed[type] += follows;
        distribute(bets[type], keys, g[type] - follows, offset);
      }
    });
    const shop = segments.reduce((total, g) => total + g.shopping, 0);
    return { segments, bets, directed, cost: desks.find(d => d.id === desk).cost,
      commerce: { sales: shop, cost: shop / 2, net: shop / 2 } };
  }
  // Fictional settlement: protect all winning principals first. Split remaining
  // distribution equally across backed winning selections. Do not manufacture a
  // loss by overpaying one winner while another needs its principal guaranteed.
  function settlePool(stakes, winningKeys) {
    const entries = Object.entries(stakes);
    if (entries.some(([,n]) => !Number.isSafeInteger(n) || n < 0)) throw Error("票は非負の整数です。");
    const sales = entries.reduce((total, entry) => total + entry[1], 0);
    const winners = [...new Set(winningKeys)].filter(id => stakes[id] > 0).sort();
    const principal = winners.reduce((total, id) => total + stakes[id], 0);
    const targetCents = sales * 80, guaranteedCents = principal * 100;
    if (!winners.length) {
      // No backed winning selection: refund the whole pool to its purchasers.
      return { sales, payout: sales, houseNet: 0, refundSupport: 0, principal: 0, void: sales > 0, odds: {}, payouts: { ...stakes } };
    }
    const surplus = Math.max(0, targetCents - guaranteedCents), payouts = {}, odds = {};
    winners.forEach((id, i) => {
      payouts[id] = (stakes[id]*100 + Math.floor(surplus/winners.length) + (i < surplus%winners.length ? 1 : 0)) / 100;
      odds[id] = money(payouts[id] / stakes[id]);
    });
    const payout = Math.max(targetCents, guaranteedCents) / 100;
    return { sales, payout, houseNet: money(sales-payout), refundSupport: Math.max(0, guaranteedCents-targetCents)/100, principal, void: false, odds, payouts };
  }
  function settlement(b, order) {
    const [a,b2,c] = order;
    const pools = { win: settlePool(b.bets.win,[a]), place: settlePool(b.bets.place,[a,b2]),
      wide: settlePool(b.bets.wide,[pair(a,b2),pair(a,c),pair(b2,c)]) };
    return { pools, segments: b.segments, commerce: b.commerce, cost: b.cost,
      operatingProfit: money(Object.values(pools).reduce((sum,p) => sum + p.houseNet, 0) + b.commerce.net - b.cost) };
  }
  function issues(s) {
    const plan = s.plan;
    const errors = [];
    if (plan.desk !== "win" && !plan.place) errors.push("複勝で読む一頭を選んでください。");
    if (plan.desk === "mixed" && (!plan.wide[0] || !plan.wide[1])) errors.push("ワイドで読む異なる二頭を選んでください。");
    if (plan.wide[0] && plan.wide[0] === plan.wide[1]) errors.push("ワイドには異なる二頭を選んでください。");
    if ([plan.place,...plan.wide].some(id => id && !s.scouted.includes(id))) errors.push("予想に載せる竜を先に取材してください。");
    return errors;
  }
  function benchmark(s, prophecy) {
    const b = buildBooks(s,"win",prophecy);
    // For this benchmark only single-winner bets exist. The public winner
    // suffices to settle them; no information about second or third is used.
    const win = settlePool(b.bets.win,[oracle.id]);
    return { segments: b.segments, win, cost: b.cost, commerce: b.commerce,
      operatingProfit: money(win.houseNet + b.commerce.net - b.cost) };
  }
  function preview(state) {
    const s = get(state), b = buildBooks(s,s.plan.desk,true), errors = issues(s);
    const pools = {}, net = { min: Infinity, max: -Infinity };
    const articles = [];
    if (s.plan.place) articles.push({ type: "place", key: s.plan.place });
    if (s.plan.wide.every(Boolean) && s.plan.wide[0] !== s.plan.wide[1]) articles.push({ type: "wide", key: pair(...s.plan.wide) });
    for (const a of articles) {
      a.stake = b.bets[a.type][a.key] || 0;
      a.directedStake = b.directed[a.type];
      a.winningOdds = null;
    }
    for (const second of ids.slice(1)) for (const third of ids.slice(1)) {
      if (second === third) continue;
      const result = settlement(b,[oracle.id,second,third]);
      net.min = Math.min(net.min,result.operatingProfit); net.max = Math.max(net.max,result.operatingProfit);
      for (const [type,p] of Object.entries(result.pools)) {
        const bounds = pools[type] || (pools[type] = { sales: p.sales, minNet: Infinity, maxNet: -Infinity });
        bounds.minNet = Math.min(bounds.minNet,p.houseNet); bounds.maxNet = Math.max(bounds.maxNet,p.houseNet);
      }
      for (const a of articles) {
        const odds = result.pools[a.type].odds[a.key];
        if (!odds) continue;
        if (!a.winningOdds) a.winningOdds = { min: odds, max: odds };
        else {
          a.winningOdds.min = Math.min(a.winningOdds.min,odds);
          a.winningOdds.max = Math.max(a.winningOdds.max,odds);
        }
      }
    }
    return { ready: !s.published && !errors.length, errors, meeting: publicMeeting(s.event.meeting),
      segments: b.segments, pools, articles, cost: b.cost, commerce: b.commerce, net,
      stakes: b.bets, baseline: benchmark(s,true), beforeOracle: benchmark(s,false) };
  }
  function publish(state) {
    const s = get(state); requireOpen(s);
    const errors = issues(s); if (errors.length) throw Error(errors.join(" "));
    const order = s.event.order, b = buildBooks(s,s.plan.desk,true), finance = settlement(b,order);
    const predictions = [];
    if (s.plan.place) predictions.push({ type: "place", ids: [s.plan.place],
      hit: order.slice(0,2).includes(s.plan.place), addsInformation: s.plan.place !== oracle.id });
    if (s.plan.wide.every(Boolean)) predictions.push({ type: "wide", ids: s.plan.wide.slice(),
      hit: s.plan.wide.every(id => order.slice(0,3).includes(id)), addsInformation: true });
    for (const p of predictions) {
      const selected = p.type === "place" ? p.ids[0] : pair(...p.ids);
      p.stake = b.bets[p.type][selected];
      p.directedStake = b.directed[p.type];
      p.odds = finance.pools[p.type].odds[selected] || 0;
      p.payout = finance.pools[p.type].payouts[selected] || 0;
    }
    const helped = predictions.some(p => p.hit && p.addsInformation && finance.pools[p.type].sales > 0);
    const { title, condition } = s.event.course;
    const receipt = { ...finance, eventId: s.event.eventId, course: { title, condition }, meeting: publicMeeting(s.event.meeting), order: order.slice(),
      plan: copy(s.plan), predictions, substantiveHit: helped, success: helped && finance.operatingProfit >= 0,
      stakes: b.bets, baseline: benchmark(s,true), beforeOracle: benchmark(s,false) };
    const issued = { ...s, published: true, history: [...s.history, receipt] };
    // All drafts of this one session/meeting resolve to the same published issue.
    // A caller retaining an earlier draft cannot reopen it after seeing the result.
    s.publishedMeetings.set(s.number, issued);
    return handle(issued);
  }
  function nextEvent(state) {
    const s = get(state);
    if (!s.published) throw Error("現在の開催を発行してから次へ進めます。");
    const number = s.number + 1;
    return handle({ ...s, number, event: round(s.seed,number), published: false,
      plan: { desk: s.plan.desk, place: null, wide: [null,null] } });
  }
  return { createState, getView, edit, scout, preview, publish, nextEvent, settlePool };
});
