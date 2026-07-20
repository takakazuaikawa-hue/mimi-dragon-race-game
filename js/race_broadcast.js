// =============================================================================
// race_broadcast.js — 実況エンジン（レース1本ぶんの放送台本を先に書く）
// =============================================================================
// ★なぜ作り直したか
//   従来（race_beats.js）は「起きた出来事に反応して喋る」だけだった。その結果：
//     ・序盤に「並んでる」を連呼する（序盤に並んでいるのは当たり前で、報せる価値がない）
//     ・中盤に「いま誰が上位か」という展開の説明が一度も無い（いちばん要る情報）
//     ・4番手⇔5番手のような、勝敗に関係ない入れ替わりを延々と読み上げる
//     ・ゴールが「ゴールイン！」だけで、どう決まったのかが分からない
//   実際の中継は、出来事の羅列ではなく「展開を語り、節目で盛り上げる」もの。
//   そこで、レースを最初に全部読み切って（解析）、局面ごとに何を語るべきかを
//   決めてから（構成）、台詞を割り当てる（執筆）という順に作り替えた。
//
// ★絶対規律
//   ここは表示層。着順・オッズ・配当・FinalPower には一切触れない。
//   タイムラインを読むだけで、新しい判定は作らない（[[race-math-immutable]]）。
//
// ★出力
//   { script: [{ tau, side:"call"|"color", line, tag }], analysis: {...} }
//   side  call=実況（ミミ・左） / color=解説（右）
//   tag   何のための一行か（デバッグと検証用）
//
// EXTENSION POINT: 語りたい局面を足すときは analyze() に観測を1つ、
//   compose() に「その局面で何を語るか」を1ブロック足す。文言は
//   data_race_lines.js 側に置く（ここに文章を書かない）。
// =============================================================================

// 局面の区切り（τ）。入場は τ<0 の扱いで別枠。
const BC_EARLY_END = 0.30;   // 序盤＝隊列が決まるまで
const BC_MID_END   = 0.62;   // 中盤＝展開を語る時間
// 終盤は BC_MID_END 〜 最終直線、そこからゴールまでが決着。

const BC_GAP_CALL  = 0.040;  // 実況の最短間隔（読める速さの下限）
const BC_GAP_COLOR = 0.050;  // 解説は一拍置く

// -----------------------------------------------------------------------------
// 1) 解析 — レースを最初に全部読む
// -----------------------------------------------------------------------------
function bcAnalyze(timeline, ctx) {
  const A = { samples: [], leadChanges: [], signatures: [], shape: [] };
  const STEP = 0.02;
  let prevTop = null;

  for (let tau = 0; tau <= 1.0001; tau += STEP) {
    const t = Math.min(1, +tau.toFixed(4));
    const st = timeline.standingsAt(t);
    A.samples.push({ tau: t, order: st });
    if (prevTop && st[0] !== prevTop) {
      A.leadChanges.push({ tau: t, from: prevTop, to: st[0] });
    }
    prevTop = st[0];
  }

  const last = A.samples[A.samples.length - 1].order;
  A.winner = last[0]; A.second = last[1]; A.third = last[2];

  // 先頭に立っていた時間の長さ（＝逃げていた竜を見つける）
  const ledCount = {};
  A.samples.forEach(s => { ledCount[s.order[0]] = (ledCount[s.order[0]] || 0) + 1; });
  A.frontRunner = Object.keys(ledCount).sort((a, b) => ledCount[b] - ledCount[a])[0];
  A.frontRunnerShare = (ledCount[A.frontRunner] || 0) / A.samples.length;

  // 後半にいちばん順位を上げた竜（＝差してきた竜）。上位に来た竜だけを見る。
  const rankAt = (t, id) => {
    const s = A.samples.reduce((best, x) => Math.abs(x.tau - t) < Math.abs(best.tau - t) ? x : best, A.samples[0]);
    return s.order.indexOf(id) + 1;
  };
  let bestGain = 0; A.closer = null;
  [A.winner, A.second, A.third].forEach(id => {
    if (!id) return;
    const gain = rankAt(0.55, id) - rankAt(0.98, id);
    if (gain > bestGain) { bestGain = gain; A.closer = id; }
  });
  A.closerGain = bestGain;

  // 展開スナップショット＝「いま上位が誰か」。中盤で必ず語るための素材。
  [0.34, 0.46, 0.58].forEach(t => {
    const s = A.samples.reduce((best, x) => Math.abs(x.tau - t) < Math.abs(best.tau - t) ? x : best, A.samples[0]);
    A.shape.push({ tau: t, first: s.order[0], second: s.order[1], third: s.order[2] });
  });

  // 本領発揮＝「その竜の脚質が、いちばん活きる場面で活きた」瞬間。
  //   逃げ/先行 … 序盤で先頭に立っている
  //   差し/追込 … 後半で順位を上げている
  // ★新しい判定ではなく、確定済みの順位推移と既存の脚質を読むだけ。
  for (const dr of (timeline.dragons || [])) {
    const style = dr.style;
    if (style === "escape" || style === "front") {
      const early = A.samples.find(s => s.tau >= 0.18);
      if (early && early.order.indexOf(dr.id) <= 1) {
        A.signatures.push({ tau: 0.20, id: dr.id, style, kind: "front" });
      }
    } else if (style === "late" || style === "chase") {
      const g = rankAt(0.50, dr.id) - rankAt(0.90, dr.id);
      if (g >= 2) A.signatures.push({ tau: 0.72, id: dr.id, style, kind: "closing", gain: g });
    }
  }

  // 決着の形＝どう決まったか。実況の決め手を選ぶために使う。
  const wd = (timeline.byId && timeline.byId[A.winner]) || {};
  const sd = (timeline.byId && timeline.byId[A.second]) || {};
  const diff = (sd.finishTau != null && wd.finishTau != null) ? (sd.finishTau - wd.finishTau) : 0.02;
  A.margin = diff < 0.006 ? "photo" : diff < 0.020 ? "close" : diff < 0.055 ? "clear" : "rout";
  const finalLeadChange = A.leadChanges.filter(c => c.tau > 0.70).length > 0;
  const wonFromBehind = rankAt(0.55, A.winner) >= 3;
  A.pattern = A.frontRunner === A.winner && A.frontRunnerShare > 0.6 ? "wire"
            : wonFromBehind ? "late"
            : finalLeadChange ? "duel" : "steady";
  A.leadChangeCount = A.leadChanges.length;
  return A;
}

// -----------------------------------------------------------------------------
// 2) 構成＋執筆 — 局面ごとに「何を語るか」を決めて台詞を割り当てる
// -----------------------------------------------------------------------------
function buildBroadcast(timeline, ctx, opts) {
  opts = opts || {};
  const nameOf = opts.nameOf || (id => id);
  const cmt = opts.commentator;
  const ckey = cmt && cmt.key;
  const A = bcAnalyze(timeline, ctx);
  const race = ctx.race || {};
  const mine = (ctx.bet && ctx.bet.selections) || [];
  const script = [];
  let lastCall = -1, lastColor = -1;
  const used = { call: [], color: [] };
  let seed = 3;

  const pick = (pool, side) => {
    if (!pool || !pool.length) return null;
    for (let k = 0; k < pool.length; k++) {
      const c = pool[(seed + k) % pool.length];
      if (!used[side].includes(c)) return c;
    }
    return pool[seed % pool.length];
  };
  const say = (tau, side, tpl, vars, tag) => {
    if (!tpl) return false;
    const line = String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : ""));
    const gap = side === "color" ? BC_GAP_COLOR : BC_GAP_CALL;
    const lastT = side === "color" ? lastColor : lastCall;
    let at = Math.max(tau, lastT + gap);
    if (at > 0.995 && tag !== "goal") return false;
    used[side].push(line); if (used[side].length > 4) used[side].shift();
    script.push({ tau: at, side, line, tag });
    if (side === "color") lastColor = at; else lastCall = at;
    return true;
  };
  // ★実況と解説は別の引き出しから引く。同じ配列を共有すると、解説が
  //   実況と同じ調子で事実を繰り返すだけになり、掛け合いにならない。
  //   解説側は解説者ごと。無ければ _ （共通）に落ちる。
  const poolOf = (group, key, side) => {
    const g = (typeof BC_LINES !== "undefined") && BC_LINES[group];
    const e = g && g[key];
    if (!e) return null;
    if (side === "color") return (e.color && (e.color[ckey] || e.color._)) || null;
    return e.call || null;
  };
  const call  = (tau, group, key, vars, tag) => {
    seed++; return say(tau, "call", pick(poolOf(group, key, "call"), "call"), vars, tag);
  };
  const color = (tau, group, key, vars, tag) => {
    seed++; return say(tau, "color", pick(poolOf(group, key, "color"), "color"), vars, tag);
  };

  // 区間の名前と、そこで効く能力
  const sec = (k) => (typeof beatSectionStats === "function") ? beatSectionStats(race, k) : { label: "", stats: [] };
  const early = sec("early"), mid = sec("mid"), late = sec("late");
  const styleJP = (id) => {
    const dr = timeline.byId && timeline.byId[id];
    return (typeof STYLE_LABEL !== "undefined" && dr) ? (STYLE_LABEL[dr.style] || "") : "";
  };

  // ── 入場（τ 0.00〜0.03）─────────────────────────────────────────
  // ★語るのは「場」「今日の条件」「注目の竜だけ」。8頭ぜんぶは紹介しない。
  //   そしてミミが口火を切り、解説が受ける（解説が黙って始まらないように）。
  const weather = (typeof WEATHERS !== "undefined" && WEATHERS[race.weather]) || null;
  const dist    = (typeof DISTANCE !== "undefined" && DISTANCE[race.distance]) || null;
  call(0.000, "entry", "venue", { label: race.region || "" }, "entry");
  color(0.004, "entry", "venue", { label: race.region || "" }, "entry");
  call(0.008, "entry", "condition",
       { w: weather ? weather.label : "", d: dist ? dist.label : "" }, "entry");
  color(0.012, "entry", "condition",
        { w: weather ? weather.label : "", s: (weather ? Object.keys(weather.weights || {}).slice(0, 1) : []).join("") }, "entry");

  // 注目の竜＝1番人気と、自分が賭けた竜。最大2頭まで。
  const favId = (() => {
    try { return (ctx.oddsResult.oddsData.find(o => o.popularityRank === 1) || {}).dragonId; } catch (e) { return null; }
  })();
  const notable = [];
  if (favId) notable.push({ id: favId, why: "fav" });
  mine.forEach(id => { if (id !== favId && notable.length < 2) notable.push({ id, why: "mine" }); });
  A.notable = notable.map(x => x.id);
  notable.forEach((nb, i) => {
    const t = 0.016 + i * 0.008;
    call(t, "entry", nb.why === "fav" ? "favorite" : "mine",
         { n: nameOf(nb.id), st: styleJP(nb.id) }, "entry");
    color(t + 0.004, "entry", nb.why === "fav" ? "favorite" : "mine",
          { n: nameOf(nb.id), st: styleJP(nb.id) }, "entry");
  });

  // ── 序盤（〜0.30）＝隊列が決まるまで ────────────────────────────
  // ★「並んでいる」は言わない。序盤に並んでいるのは当たり前で報せる価値がない。
  //   空いた時間で、今日のコースがどういう舞台なのかを解説に語らせる。
  call(0.045, "start", "go", {}, "start");
  color(0.055, "start", "go", {}, "start");
  call(0.10, "course", "intro", { label: early.label }, "course");
  color(0.115, "course", "detail",
        { label: early.label, s: (early.stats || []).join("と") }, "course");

  // 逃げ竜が主張しているなら、それは隊列の話なので序盤に言う価値がある
  const sigFront = A.signatures.find(s => s.kind === "front");
  if (sigFront) {
    call(0.20, "signature", "front",
         { n: nameOf(sigFront.id), st: styleJP(sigFront.id) }, "signature");
    color(0.215, "signature", "front",
          { n: nameOf(sigFront.id), st: styleJP(sigFront.id) }, "signature");
  }

  // ── 中盤（0.30〜0.62）＝展開を語る ───────────────────────────────
  // ★いちばん要るのは「いま上位が誰か」。抜いた抜かれたより、隊列の形。
  call(0.31, "course", "intro", { label: mid.label }, "course");
  color(0.325, "course", "detail",
        { label: mid.label, s: (mid.stats || []).join("と") }, "course");

  A.shape.forEach((sh, i) => {
    const vars = { n1: nameOf(sh.first), n2: nameOf(sh.second), n3: nameOf(sh.third),
                   st1: styleJP(sh.first) };
    // ★解説は実況と同じ局面の引き出しから引く。以前は毎回 "why" 固定で、
    //   3回とも同じ台詞になっていた（実測で発覚）。
    const key = i === 0 ? "first" : (i === 1 ? "update" : "why");
    call(sh.tau, "shape", i === 0 ? "first" : "update", vars, "shape");
    color(sh.tau + 0.014, "shape", key, vars, "shape");
  });

  // 中盤で語る入れ替わりは「1位が替わったとき」だけ。
  A.leadChanges.filter(c => c.tau > BC_EARLY_END && c.tau <= BC_MID_END).slice(0, 2).forEach(c => {
    call(c.tau, "lead", "change",
         { n: nameOf(c.to), n2: nameOf(c.from) }, "lead");
    color(c.tau + 0.014, "lead", "change",
          { n: nameOf(c.to), n2: nameOf(c.from) }, "lead");
  });

  // ── 終盤（0.62〜）＝逃げる竜と差す竜を盛り上げる ────────────────
  call(0.64, "course", "intro", { label: late.label }, "course");
  color(0.655, "course", "detail",
        { label: late.label, s: (late.stats || []).join("と") }, "course");

  // 逃げている竜
  if (A.frontRunnerShare > 0.4) {
    call(0.70, "final", "escape",
         { n: nameOf(A.frontRunner), st: styleJP(A.frontRunner) }, "final");
    color(0.715, "final", "escape",
          { n: nameOf(A.frontRunner), st: styleJP(A.frontRunner) }, "final");
  }
  // 差してきている竜
  if (A.closer && A.closerGain >= 1) {
    call(0.76, "final", "closing",
         { n: nameOf(A.closer), st: styleJP(A.closer) }, "final");
    color(0.775, "final", "closing",
          { n: nameOf(A.closer), st: styleJP(A.closer) }, "final");
  }
  // 最終直線の宣言と、1位2位の攻防
  call(0.82, "final", "straight", {}, "final");
  color(0.835, "final", "straight", {}, "final");
  A.leadChanges.filter(c => c.tau > 0.82).slice(-1).forEach(c => {
    call(Math.min(0.93, c.tau), "final", "leadFlip",
         { n: nameOf(c.to), n2: nameOf(c.from) }, "final");
  });
  call(0.90, "final", "duel",
       { n1: nameOf(A.winner), n2: nameOf(A.second) }, "final");

  // ── ゴール＝どう決まったのかを言う ──────────────────────────────
  // ★「ゴールイン！」だけでは決め手にならない。決着の形（逃げ切り/差し切り/
  //   叩き合い）と着差（大差/明確/際どい/ほぼ同時）を組み合わせて言う。
  const dv = { n: nameOf(A.winner), n2: nameOf(A.second), st: styleJP(A.winner) };
  say(0.985, "call", pick(poolOf("decide", A.pattern, "call"), "call"), dv, "goal");
  say(0.992, "call", pick(poolOf("margin", A.margin, "call"), "call"), dv, "goal");
  say(0.996, "color", pick(poolOf("decide", A.pattern, "color"), "color"), dv, "goal");

  script.sort((a, b) => a.tau - b.tau);
  return { script, analysis: A };
}

// =============================================================================
// showRaceLoading — 出走前のロード画面
// =============================================================================
// ★何のためにあるか
//   ①放送台本の組み立て（レースを最初から最後まで読み切る計算）
//   ②背景画像の先読み
//   従来はどちらも走り出してから間に合わせていたため、序盤に絵が差し替わったり、
//   実況の頭が詰まったりしていた。ここで済ませてから走り出す。
//
//   ★体感を人質に取らない：計算が速く終わっても最低限は見せる（一瞬の点滅を防ぐ）が、
//     遅くても上限で打ち切って必ず走り出す（待たせ続けない）。
const RC_LOAD_MIN_MS = 700;    // これ以下だと点滅して見えるので最低限見せる
const RC_LOAD_MAX_MS = 2400;   // 何かが詰まっても、ここで必ず走り出す
const RC_LOAD_IMG_MS = 1100;   // 画像の先読みを待つ上限（返事が来ない実装でも止まらない）

function showRaceLoading(host, c, onReady) {
  const started = Date.now();
  let done = false;
  const go = () => {
    if (done) return; done = true;
    const wrap = host.querySelector(".rcload");
    if (wrap) wrap.remove();
    onReady();
  };

  const box = document.createElement("div");
  box.className = "rcload";
  box.innerHTML =
    '<div class="rcload-in">' +
      '<div class="rcload-cup">' + (c.race && c.race.cup ? c.race.cup : "レース") + '</div>' +
      '<div class="rcload-ttl">出走準備中</div>' +
      '<div class="rcload-bar"><i></i></div>' +
      '<div class="rcload-note">実況席、準備しています……</div>' +
      // ★下部に一枚絵。素材はすでにあるので、待ち時間を絵で持たせる。
      //   今日の舞台に近い風景を選ぶ（読めなければ枠ごと消えるので崩れない）。
      (rcLoadArtFor(c.race)
        ? '<div class="rcload-art"><img src="' + rcLoadArtFor(c.race) +
          '" alt="" onerror="this.closest(&quot;.rcload-art&quot;).remove()"></div>'
        : "") +
    '</div>';
  host.appendChild(box);
  const note = box.querySelector(".rcload-note");
  const setNote = (t) => { if (note) note.textContent = t; };

  // ── ①放送台本を組み立てる ────────────────────────────────
  // 解説者もここで決めて台本に反映する（走り出してから抽選すると台本と食い違う）。
  const build = () => {
    try {
      const cmt = (typeof pickCommentator === "function")
        ? pickCommentator(state.player && state.player.lastCommentator) : null;
      if (cmt) { try { state.player.lastCommentator = cmt.key; } catch (e) {} }
      c.raceCommentator = cmt;
      setNote("展開を読み込んでいます……");
      c.broadcastScript = buildBroadcast(c.timeline,
        { race: c.race, bet: c.bet, oddsResult: c.oddsResult,
          raceResult: c.raceResult, trialForms: c.trialForms },
        { commentator: cmt,
          nameOf: (id) => (typeof commentaryName === "function" ? commentaryName(id) : id) });
    } catch (e) { c.broadcastScript = null; }
  };

  // ── ②背景画像の先読み ──────────────────────────────────
  const preload = (cb) => {
    let pending = 2, fired = false;
    const finish = () => { if (!fired) { fired = true; cb(); } };
    const one = () => { if (--pending <= 0) finish(); };
    try {
      setNote("コースを用意しています……");
      if (typeof rcBgFor === "function") { rcBgFor(c.race, one); } else { one(); }
      // ★ロード画面に出す一枚絵も、実際に読めるまで待つ。
      //   待たずに進むと「絵が出ないままロードが終わり、走り出してから
      //   背景が入れ替わる」状態になる（ユーザー指摘）。
      const art = rcLoadArtFor(c.race);
      if (art) {
        const im = new Image();
        im.onload = one; im.onerror = one;
        im.src = art;
      } else { one(); }
    } catch (e) { finish(); }
    setTimeout(finish, RC_LOAD_IMG_MS);   // ★先読みの完了通知が返らない実装でも、ここで切り上げる
                                          //   （実測：待ち切ると毎レース3.6秒待たされていた）
  };

  // 台本づくりは一拍おいてから（ロード画面を先に見せて、固まって見えないように）
  setTimeout(() => {
    build();
    preload(() => {
      const rest = Math.max(0, RC_LOAD_MIN_MS - (Date.now() - started));
      setNote("まもなく発走です");
      setTimeout(go, rest);
    });
  }, 60);

  setTimeout(go, RC_LOAD_MAX_MS);   // 最終防衛線：何があっても走り出す
}

// ロード画面に出す一枚絵。今日の舞台に近い風景を選ぶ。
// ★素材は既存のものだけを使う（新規生成しない）。読めなければ枠ごと消えるので崩れない。
// EXTENSION POINT: 地域を足したら1行足すだけ。無い地域は競走場の絵に落ちる。
var RC_LOAD_ART = {
  "カルデラ地域":       "images/konron/area_cliff.webp",
  "ミストレイク地域":   "images/konron/area_falls.webp",
  "グランドクロック地域": "images/konron/area_city.webp",
  "シーサイド地域":     "images/konron/area_beach.webp",
  "オンセン地域":       "images/konron/area_onsen.webp",
  "サンクタム地域":     "images/konron/area_sanctum.webp",
  "奥地":               "images/konron/area_okuchi.webp"
};
function rcLoadArtFor(race) {
  try {
    return RC_LOAD_ART[race && race.region] || "images/konron/area_race.webp";
  } catch (e) { return "images/konron/area_race.webp"; }
}
