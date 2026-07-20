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

// ── 読める速さ（P1の核心）────────────────────────────────────────
// ★従来は「1行30字を1.0秒」で出していた。これは映像字幕の実務基準(約4字/秒)の
//   7.5倍、黙読の上限(約10字/秒)の3倍で、物理的に読めていない。
//   行数を増減するのではなく、1行を短くして表示時間を字数に比例させる。
const BC_READ_CPS   = 14;     // 読める速さ（字/秒）。字幕基準より速いが、短文＋既知語彙なので成立する
const BC_HOLD_MIN   = 0.60;  // 最短表示秒。これを割ると何字であっても読めない
const BC_BEAT       = { calm: 0.5, normal: 0.3, rush: 0.15 };   // ★無言を作らないため詰めた  // 行間の“間”。局面で使い分ける
const BC_LEN_TARGET = { entry: 16, course: 14, shape: 16, gap: 14, lead: 13, final: 9, goal: 20 };

// 表示に要る秒数 → τ。読める時間を必ず確保するための換算。
function bcHoldTau(text, beat, raceSec) {
  const chars = String(text || "").length;
  const sec = Math.max(BC_HOLD_MIN, chars / BC_READ_CPS) + (beat || BC_BEAT.normal);
  return sec / Math.max(1, raceSec || 46);
}

// 着差の5段階目盛り。★実況・着順ボードで同じ語を使うために一元化する。
// 「接戦」「混戦」は情報量ゼロなので語彙から外した。
const BC_MARGIN_TIER = [
  { max: 0.004, key: "nose",   label: "鼻先" },
  { max: 0.010, key: "neck",   label: "首差" },
  { max: 0.022, key: "half",   label: "半身" },
  { max: 0.055, key: "body",   label: "一体" },
  { max: 99,    key: "big",    label: "大差" }
];
function marginTier(dTau) {
  const d = Math.abs(+dTau || 0);
  for (const t of BC_MARGIN_TIER) if (d <= t.max) return t;
  return BC_MARGIN_TIER[BC_MARGIN_TIER.length - 1];
}

const BC_GAP_CALL  = 0.040;  // 実況の最短間隔（下限。実際は字数から算出した値が優先される）
const BC_GAP_COLOR = 0.050;  // 解説は一拍置く

// 区間キー → 「そこで効く能力」。data_courses の weights から機械的に出す。
// ★旧 race_beats.js から移設。あちらの buildRaceBeats は「自分の賭けが的中圏内へ
//   入った/外れた」を最優先級のビートとして持っており、レース中に賭け竜へ言及しない
//   という方針に構造的に反していた。生きていたのはこの1関数だけなので引き取り、
//   旧ファイルごと読み込みから外す（禁句チェックでは拾えない“構造の違反”を根から断つ）。
function beatSectionStats(race, phaseKey) {
  try {
    const sec = getSection(phaseKey, race[phaseKey]);
    if (!sec || !sec.weights) return { label: "", stats: [], terrain: null };
    const JP = { speed: "速さ", stamina: "底力", fire: "闘志", wing: "翼", turn: "旋回", nerve: "気性" };
    const stats = Object.keys(sec.weights)
      .filter(k => sec.weights[k] > 0)
      .sort((a, b) => sec.weights[b] - sec.weights[a])
      .slice(0, 2).map(k => JP[k] || k);
    return { label: sec.label || "", stats, terrain: sec.terrain || null };
  } catch (e) { return { label: "", stats: [], terrain: null }; }
}

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
  [0.34, 0.42, 0.50, 0.58].forEach(t => {
    const s = A.samples.reduce((best, x) => Math.abs(x.tau - t) < Math.abs(best.tau - t) ? x : best, A.samples[0]);
    A.shape.push({ tau: t, first: s.order[0], second: s.order[1], third: s.order[2] });
  });

  // ★終盤の「実況の連続記録」。
  //   畳みかけるとは文字を減らすことではなく、中身のある情報を速く続けて出すこと。
  //   誰が前で、誰が来ていて、差がどれだけか——を一定間隔で読み上げられるよう、
  //   決着までの区間を細かく刻んで素材にする（無言の時間を作らないため）。
  A.drive = [];
  for (let i = 0; i < A.samples.length; i++) {
    const s = A.samples[i];
    if (s.tau < 0.60) continue;
    const p1 = timeline.progressAt(s.order[0], s.tau);
    const p2 = timeline.progressAt(s.order[1], s.tau);
    A.drive.push({
      tau: s.tau, first: s.order[0], second: s.order[1], third: s.order[2],
      gap: Math.max(0, p1 - p2)
    });
  }

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

  // ★自分の賭け竜への言及は、レース中はしない（ユーザー指定）。
  //   限られた行数を賭け竜に使うと、そのぶん隊列や競り合いの話が消え、
  //   レース展開が見えなくなる。実況が伝えるべきは着順の行方であって、
  //   誰に賭けたかではない。（入場での紹介だけは、走る前なので別枠で残す）

  // 先頭と2番手の差の推移＝レース展開そのもの。
  // ★「誰が前か」だけでは平坦なので、その差が開いているのか詰まっているのかを
  //   語れるようにする。これが分かると、逃げ切りそうなのか捕まりそうなのかが伝わる。
  A.gaps = [];
  A.samples.forEach(s => {
    const p1 = timeline.progressAt(s.order[0], s.tau);
    const p2 = timeline.progressAt(s.order[1], s.tau);
    A.gaps.push({ tau: s.tau, gap: Math.max(0, p1 - p2), first: s.order[0], second: s.order[1] });
  });
  // 中盤〜終盤で、差がはっきり動いた瞬間を1つだけ拾う（多用すると数字の実況になる）
  A.gapMove = null;
  for (let i = 0; i < A.gaps.length; i++) {
    const g = A.gaps[i];
    if (g.tau < 0.36 || g.tau > 0.80) continue;
    const prev = A.gaps[Math.max(0, i - 6)];
    if (!prev || prev.first !== g.first) continue;
    const d = g.gap - prev.gap;
    if (Math.abs(d) < 0.010) continue;
    if (!A.gapMove || Math.abs(d) > Math.abs(A.gapMove.d)) {
      A.gapMove = { tau: g.tau, d, widening: d > 0, first: g.first, second: g.second };
    }
  }

  // ★決着点＝1着がゴールした瞬間。台本の基準はここ。
  //   τ=1.0 は「最下位が着くまで」であって勝負の終わりではない。基準を取り違えると、
  //   決め台詞が決着の8秒後に出る台本になる（実測で発覚：1着37.7秒／τ1.0は46秒）。
  A.decideTau = (() => {
    try {
      const w = (timeline.dragons || []).find(d => d.id === A.winner);
      return (w && w.finishTau) || 0.9;
    } catch (e) { return 0.9; }
  })();
  // 決着直前の「山場」＝ここが最も熱く、いちばん行を厚くすべき区間。
  A.climaxFrom = Math.max(BC_MID_END, A.decideTau - 0.20);

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

  // ═══════════════════════════════════════════════════════════════════
  // 決め手の算出 — 「この勝ち方は何がすごいのか」を数値から決める
  // ═══════════════════════════════════════════════════════════════════
  // ★ゴール後に大写しになるのは1着の竜。だから語るべきは「2着との差」ではなく
  //   「どんな勝ち方だったか」。大穴だったのか、大逆転だったのか、死闘だったのか。
  //   それを毎回その場の勘で選ぶのではなく、観測値から機械的に決める。
  //   （ここまで台詞の選択が場当たりで、同じ言い方が続いていた）
  A.drama = (() => {
    const d = {};
    // ①人気（何番人気が勝ったか）とオッズ＝波乱の度合い
    try {
      const od = (ctx.oddsResult && ctx.oddsResult.oddsData) || [];
      const w = od.find(o => o.dragonId === A.winner) || {};
      d.popRank = w.popularityRank || 4;
      d.odds = w.odds || 5;
    } catch (e) { d.popRank = 4; d.odds = 5; }
    // ②どこまで下がっていたか＝逆転の大きさ
    let worst = 1;
    A.samples.forEach(s => {
      if (s.tau < 0.10 || s.tau > 0.95) return;
      const r = s.order.indexOf(A.winner) + 1;
      if (r > worst) worst = r;
    });
    d.worstRank = worst;
    d.comeback = worst - 1;                    // 何番手から巻き返したか
    // ③先頭が何回替わったか＝レースの荒れ具合
    d.leadChanges = A.leadChanges.length;
    // ④着差
    d.marginKey = marginTier(
      (() => {
        const wd = (timeline.byId || {})[A.winner] || {};
        const sd = (timeline.byId || {})[A.second] || {};
        return (sd.finishTau != null && wd.finishTau != null) ? sd.finishTau - wd.finishTau : 0.02;
      })()
    ).key;
    // ⑤ずっと先頭だったか
    d.wire = (A.frontRunner === A.winner && A.frontRunnerShare > 0.75);

    // ── 盛り上がり度（0-100）。表示はしないが、決め手の選択と語気に使う ──
    d.score = Math.min(100, Math.round(
      (d.popRank - 1) * 9                                  // 人気薄ほど盛り上がる（最大63）
      + Math.min(3, d.comeback) * 8                        // 巻き返しの大きさ（最大24）
      + Math.min(4, d.leadChanges) * 4                     // 先頭交代の多さ（最大16）
      + (d.marginKey === "nose" ? 18 : d.marginKey === "neck" ? 12 : d.marginKey === "half" ? 6 : 0)
    ));

    // ── 決め手の見出し＝いちばん珍しい事実を1つ選ぶ ──
    //   複数当てはまるときは、珍しい順（＝観客がいちばん驚く順）に優先する。
    d.headline =
        (d.popRank >= 6 || d.odds >= 15)            ? "bigUpset"   // 大穴
      : (d.comeback >= 4)                            ? "comeback"   // 大逆転
      : (d.marginKey === "nose")                     ? "photo"      // 鼻先の死闘
      : (d.leadChanges >= 4)                         ? "warOfAttrition" // 荒れた叩き合い
      : (d.popRank >= 4)                             ? "upset"      // 伏兵
      : (d.wire && d.marginKey === "big")            ? "perfect"    // 完全逃走
      : (d.popRank === 1 && d.marginKey === "big")   ? "dominant"   // 王者の圧勝
      : (d.marginKey === "neck" || d.marginKey === "half") ? "hardFought" // 競り勝ち
      : "solid";
    return d;
  })();

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
  // ★ctx.bet はここで一切読まない。賭け情報を持ち込まなければ、うっかり
  //   賭け竜を主役にする実装ミスが構造上できなくなる。
  const script = [];
  let lastCall = -1, lastColor = -1;
  let lastCallNeed = 0, lastColorNeed = 0;   // 直前の行が読み終わるまでに要る時間（τ）
  const used = { call: [], color: [] };
  let seed = 3;

  const pick = (pool, side) => {
    if (!pool || !pool.length) return null;
    for (let k = 0; k < pool.length; k++) {
      const c = pool[(seed + k) % pool.length];
      if (!used[side].includes(c)) return c;
    }
    // ★引き出しが枯れたら黙る。既出を返すと同じ台詞が二度出る（実測で8件）。
    //   同じことを繰り返すくらいなら、その行は無い方がよい。
    return null;
  };
  // レースの実尺（秒）。表示時間を字数から決めるのに要る。
  const raceSec = (timeline && timeline.durationSecHint) || 46;
  // 局面ごとの“間”。終盤は詰めて畳みかけ、入場と余韻はゆったり。
  const beatOf = (tag) =>
    (tag === "final" || tag === "goal") ? BC_BEAT.rush
    : (tag === "entry" || tag === "course") ? BC_BEAT.calm
    : BC_BEAT.normal;

  // ★候補を貯めてから詰める（budgetPack）。
  //   従来は say() が「必ず後ろへずらす・絶対に落とさない」設計だったため、
  //   終盤が混むと押し出しが連鎖し、決着の台詞が決着の6〜8秒後に出ていた（実測）。
  //   正しくは「時間は有限。入らない行は優先度の低いものから捨てる」。
  const cand = [];
  const PRI = {
    goal: 100,     // 決着＝絶対に落とさない／必ず決着点に置く
    cutin: 95,     // ★割り込み＝上位を争う追い抜き。待たせる価値がない
    final: 88,     // 終盤の攻防
    lead: 76,      // 1位交代
    start: 70,     // 発走
    entry: 64,     // 入場
    shape: 58,     // 展開（いま上位が誰か）
    gap: 52,       // 差の開閉
    signature: 46, // 本領発揮
    course: 34     // コース説明＝いちばん先に削ってよい
  };
  const say = (tau, side, tpl, vars, tag) => {
    if (!tpl) return false;
    const line = String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : ""));
    cand.push({ tau, side, line, tag, pri: PRI[tag] != null ? PRI[tag] : 50 });
    // ★記録するのは「差し込み前の型」。
    //   pick() は型を照合しているのに、ここで差し込み後の文を記録していたため、
    //   {n} を含む行では一度も一致せず、重複防止が効いていなかった（実測で発覚）。
    used[side].push(tpl);
    return true;
  };
  // 旧経路（未使用・参照が残っていた場合の保険）
  const _sayImmediate = (tau, side, tpl, vars, tag) => {
    if (!tpl) return false;
    const line = String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : ""));
    // ★表示時間は字数から決める。固定間隔だと、長い行は読めず短い行は間延びする。
    const need = bcHoldTau(line, beatOf(tag), raceSec);
    const lastT = side === "color" ? lastColor : lastCall;
    const lastNeed = side === "color" ? lastColorNeed : lastCallNeed;
    // ★決着の3行は、押し出さずに決着点のそばへ置く。
    //   通常どおり「前の行を読み終わるまで」待たせると、解説の締めが決着の
    //   8秒後に飛ぶ（実測48.4秒／決着40.4秒）。決着は畳みかけて言い切る場面なので、
    //   ここだけは最小間隔で詰める。
    let at = (tag === "goal")
      ? Math.max(tau, lastT + 0.006)
      : Math.max(tau, lastT + lastNeed);
    // ★実況と解説を同時に切り替えない。52px×2段が同時に変わると
    //   一瞬の認知負荷が倍になり、どちらを読めばいいか分からなくなる。
    const otherT = side === "color" ? lastCall : lastColor;
    if (Math.abs(at - otherT) < 0.012) at = otherT + 0.014;
    if (at > 0.995 && tag !== "goal") return false;
    used[side].push(line);   // ★1レース内で同じ文は二度使わない（直近4本だけでは足りなかった）
    script.push({ tau: at, side, line, tag, hold: need });
    if (side === "color") { lastColor = at; lastColorNeed = need; }
    else { lastCall = at; lastCallNeed = need; }
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
  // ★解説は一言ごとに相槌を打たない。
  //   実況1行につき解説1行を機械的に返すと、掛け合いではなく往復の作業になり、
  //   解説が実況の影になる。解説が口を開くのは「言うべきことがある時」だけ。
  //   ここでは、ミミが場と条件を続けて言い切ってから、解説が一度だけ受ける。
  call(0.000, "entry", "venue", { label: race.region || "" }, "entry");
  call(0.008, "entry", "condition",
       { w: weather ? weather.label : "", d: dist ? dist.label : "" }, "entry");
  color(0.014, "entry", "condition",
        { w: weather ? weather.label : "", s: (weather ? Object.keys(weather.weights || {}).slice(0, 1) : []).join("") }, "entry");

  // 注目の竜＝人気上位2頭だけ。★誰に賭けたかは一切参照しない。
  //   以前は「1番人気＋自分の賭け竜」を選んでいた。中立的な言葉で描写していても、
  //   賭け竜を主役に選出している時点で構造的な違反になる（禁句チェックでは拾えない）。
  //   実況が伝えるのは着順の行方であって、誰に賭けたかではない。
  const pops = (() => {
    try {
      return (ctx.oddsResult.oddsData || [])
        .slice().sort((a, b) => (a.popularityRank || 99) - (b.popularityRank || 99))
        .slice(0, 2).map(o => o.dragonId).filter(Boolean);
    } catch (e) { return []; }
  })();
  A.notable = pops;

  // ═══════════════════════════════════════════════════════════════════
  // 予言 — 解説者が入場で見立てを言い切り、決着で答え合わせする
  // ═══════════════════════════════════════════════════════════════════
  // ★これが解説の描き分けと笑いの両方を担う中核。
  //   ・見立ての「中身」が人によって違う＝物差しの違いがそのまま個性になる
  //     （性格の形容詞ではなく、何で世界を測るかで分ける）
  //   ・オチはレース結果が毎回無料で供給する。台詞を足さなくても摩耗しない
  //   ★公正であること：予言は入場時点で分かる情報（人気・脚質）だけで選ぶ。
  //     結果を見てから当たる予言を選んだら、ただのやらせになる。
  const prophecy = (() => {
    if (!cmt) return null;
    const fav = pops[0], rival = pops[1];
    if (!fav) return null;
    const styleOf = (id) => { const d = timeline.byId && timeline.byId[id]; return d ? d.style : null; };
    // 解説者ごとに「何を予言するか」が違う＝物差しの違い
    const P = {
      // 気配で見る → この竜は前で受けて立つ、と言う
      sake:     { target: fav,   kind: "leadsAtSomePoint" },
      // 市場の歪みで見る → 人気は過大評価だ、と言う
      mizu:     { target: fav,   kind: "favFlops" },
      // 消耗で見る → 前で使う竜は最後に沈む、と言う
      sumika:   { target: null,  kind: "frontFades" },
      // 熱で見る → 今日は荒れる、と言う
      makura:   { target: null,  kind: "chaos" },
      // 俯瞰で見る → 後ろから来た子が主役になる、と言う
      celestia: { target: null,  kind: "closerWins" },
      // 運で見る → 勘で1頭を名指しする
      unme:     { target: rival || fav, kind: "namedWins" }
    };
    const p = P[cmt.key];
    if (!p) return null;
    p.targetName = p.target ? nameOf(p.target) : "";
    p.targetStyle = p.target ? styleJP(p.target) : "";
    return p;
  })();
  A.prophecy = prophecy;
  pops.forEach((id, i) => {
    const t = 0.016 + i * 0.008;
    call(t, "entry", i === 0 ? "favorite" : "rival", { n: nameOf(id), st: styleJP(id) }, "entry");
    // ★解説は2頭とも論評しない。1番人気に一度だけ見立てを述べる＝
    //   「この人はこういう物差しで見る」が伝わればそれで足りる。
    if (i === 0) color(t + 0.006, "entry", "favorite", { n: nameOf(id), st: styleJP(id) }, "entry");
  });

  // ★解説者の自己紹介＝「この人は何で世界を測るか」を毎回名乗る。
  //   6人をランダムで出すのに名乗りが無いと、誰が喋っているのか分からない。
  color(0.032, "intro", "self", {}, "entry");
  // ★そして見立てを言い切る。これが決着で答え合わせされる＝第二の賭け。
  if (prophecy) {
    color(0.040, "prophecy", cmt.key, {
      t: prophecy.targetName, st: prophecy.targetStyle
    }, "entry");
  }

  // ── 序盤（〜0.30）＝隊列が決まるまで ────────────────────────────
  // ★「並んでいる」は言わない。序盤に並んでいるのは当たり前で報せる価値がない。
  //   空いた時間で、今日のコースがどういう舞台なのかを解説に語らせる。
  // ★発走に解説は付けない。ゲートが開く瞬間は実況の一言だけで持つ場面で、
  //   ここに相槌を挟むと緊張が薄まる。
  call(0.045, "start", "go", {}, "start");
  // 序盤はコースの説明を解説に預ける（実況は名前を告げるだけ）
  // 発走直後の空きを埋める（誰が出たかは、この時点でいちばん知りたい情報）
  call(0.075, "midway", "lead", (function () {
    const d = A.samples.reduce((b, x) => Math.abs(x.tau - 0.075) < Math.abs(b.tau - 0.075) ? x : b, A.samples[0]);
    const g = Math.max(0, timeline.progressAt(d.order[0], d.tau) - timeline.progressAt(d.order[1], d.tau));
    return { n1: nameOf(d.order[0]), n2: nameOf(d.order[1]), n3: nameOf(d.order[2]), m: marginTier(g).label };
  })(), "shape");
  call(0.13, "course", "intro", { label: early.label }, "course");
  color(0.125, "course", "detail",
        { label: early.label, s: (early.stats || []).join("と") }, "course");

  // 逃げ竜が主張しているなら、それは隊列の話なので序盤に言う価値がある
  const sigFront = A.signatures.find(s => s.kind === "front");
  if (sigFront) {
    call(0.20, "signature", "front",
         { n: nameOf(sigFront.id), st: styleJP(sigFront.id) }, "signature");
  }

  // ── 中盤（0.30〜0.62）＝展開を語る ───────────────────────────────
  // ★いちばん要るのは「いま上位が誰か」。抜いた抜かれたより、隊列の形。
  call(0.31, "course", "intro", { label: mid.label }, "course");

  // ★序盤から中盤へ渡る隙間を埋める（実測でここに3.5秒の無言が残っていた）。
  //   隊列の速報を2本挟む。情報は落とさず、間だけを埋める。
  [0.22, 0.27].forEach((t, idx) => {
    const d = A.samples.reduce((b, x) => Math.abs(x.tau - t) < Math.abs(b.tau - t) ? x : b, A.samples[0]);
    const g = Math.max(0, timeline.progressAt(d.order[0], d.tau) - timeline.progressAt(d.order[1], d.tau));
    call(t, "midway", "lead", {
      n1: nameOf(d.order[0]), n2: nameOf(d.order[1]), n3: nameOf(d.order[2]),
      m: marginTier(g).label
    }, "shape");
  });

  A.shape.forEach((sh, i) => {
    const vars = { n1: nameOf(sh.first), n2: nameOf(sh.second), n3: nameOf(sh.third),
                   st1: styleJP(sh.first) };
    call(sh.tau, "shape", i === 0 ? "first" : "update", vars, "shape");
    // ★隊列は4回示すが、解説が受けるのは最初の1回だけ。
    //   毎回論評させると「実況が言う→解説が言い直す」の往復になり、
    //   同じ情報を二度読まされることになる。
    if (i === 0) color(sh.tau + 0.016, "shape", "first", vars, "shape");
    // ★隊列と隊列のあいだが空くので、そこに差の状況を入れて無言を作らない。
    //   数字ではなく着差の目盛り（鼻先/首差/半身/一体/大差）で言う。
    if (i < A.shape.length - 1) {
      const mid2 = (sh.tau + A.shape[i + 1].tau) / 2;
      const d = A.samples.reduce((best, x) =>
        Math.abs(x.tau - mid2) < Math.abs(best.tau - mid2) ? x : best, A.samples[0]);
      const g = Math.max(0, timeline.progressAt(d.order[0], d.tau) - timeline.progressAt(d.order[1], d.tau));
      call(mid2, "midway", i % 3 === 0 ? "lead" : (i % 3 === 1 ? "third" : "tight"), {
        n1: nameOf(d.order[0]), n2: nameOf(d.order[1]), n3: nameOf(d.order[2]),
        m: marginTier(g).label
      }, "shape");
    }
  });

  // 差が開いた／詰まった＝展開が動いた瞬間を1本だけ。
  if (A.gapMove) {
    const gv = { n1: nameOf(A.gapMove.first), n2: nameOf(A.gapMove.second) };
    call(A.gapMove.tau, "gap", A.gapMove.widening ? "widen" : "close", gv, "gap");
    // ★ここは解説が入る価値がある場面。差が動いた「理由」は実況が言えないので、
    //   解説にしか出せない情報になる（相槌ではなく仕事）。
    color(A.gapMove.tau + 0.020, "gap", A.gapMove.widening ? "widen" : "close", gv, "gap");
  }
  // 中盤の締めに、解説がレース全体の読みを一度だけ入れる（実況とは独立した拍）
  color(0.55, "shape", "why", {
    n1: nameOf(A.shape[1] ? A.shape[1].first : A.winner)
  }, "shape");

  // 中盤で語る入れ替わりは「1位が替わったとき」だけ。
  A.leadChanges.filter(c => c.tau > BC_EARLY_END && c.tau <= BC_MID_END).slice(0, 2).forEach(c => {
    call(c.tau, "lead", "change",
         { n: nameOf(c.to), n2: nameOf(c.from) }, "lead");
    // 先頭交代は「なぜ替わったか」を解説が言える数少ない場面なので受ける
    color(c.tau + 0.020, "lead", "change",
          { n: nameOf(c.to), n2: nameOf(c.from) }, "lead");
  });

  // ── 終盤（0.62〜決着点）＝いちばん熱い区間。ここを最も厚くする ──────
  // ★従来ここは条件つきの数本しか置いておらず、実測で「9.2秒に2行・最長8.3秒の沈黙」
  //   になっていた。盛り上がる場所が最も静かという逆立ちした配分だったので、
  //   決着点(A.decideTau)から逆算して、必ず埋まる形に組み直す。
  const D = A.decideTau;
  // 位置は決着点からの逆算（レースごとに決着点が違うので固定τでは合わない）
  const back = (sec) => Math.max(BC_MID_END + 0.01, D - sec / raceSec);

  // ★終盤に入ったら解説はほぼ黙る。ここから先は実況が続けて刻む場面で、
  //   一言ごとに相槌が入ると畳みかけの速度が殺される。
  //   解説が口を開くのは、差し竜が来た一度と、決着の締めだけ。
  call(back(11.0), "course", "intro", { label: late.label }, "course");

  // 逃げている竜（先頭を長く守っていれば）
  if (A.frontRunnerShare > 0.35) {
    call(back(8.6), "final", "escape",
         { n: nameOf(A.frontRunner), st: styleJP(A.frontRunner) }, "final");
    // ★終盤に解説を重ねない。ここは実況が短く畳みかける場面で、解説を挟むと
    //   押し出しが連鎖し、決着の締めが決着点を8秒も越えてしまう（実測48.4秒／
    //   決着40.4秒）。終盤の解説は差し竜の1本と、決着の締めだけに絞る。
  }
  // 差してきている竜
  if (A.closer && A.closerGain >= 1) {
    call(back(6.8), "final", "closing",
         { n: nameOf(A.closer), st: styleJP(A.closer) }, "final");
    color(back(6.2), "final", "closing",
          { n: nameOf(A.closer), st: styleJP(A.closer) }, "final");
  }
  // ★直線宣言は必ず出す（区切りの合図）
  call(back(5.0), "final", "straight", {}, "final");

  // 直線に入ってからの先頭交代（あれば最後の1回）
  A.leadChanges.filter(c => c.tau > back(5.0) && c.tau < D).slice(-1).forEach(c => {
    call(Math.min(D - 0.02, c.tau), "final", "leadFlip",
         { n: nameOf(c.to), n2: nameOf(c.from) }, "final");
  });
  // ★決着までの連続記録。無言の時間を作らないよう、一定間隔で必ず埋める。
  //   ただの叫びではなく「誰が前・誰が来た・差はいくつ」を毎回載せる。
  //   （畳みかける＝文字を減らすことではない、というユーザー指摘への対応）
  let prevGap = null;
  for (let sec = 18.0; sec >= 1.0; sec -= 1.0) {
    // ★下限で頭打ちにしない。back() は BC_MID_END で clamp するので、
    //   決着まで遠い回は全部そこへ潰れ、同じ位置に積まれて packing で落ちる。
    //   結果 τ0.7 付近に穴が空いていた（実測：無言3.5秒）。
    //   届かない回は素直に飛ばし、入る位置からだけ刻む。
    const t = A.decideTau - sec / raceSec;
    if (t < BC_MID_END) continue;
    const d = A.drive.reduce((best, x) =>
      Math.abs(x.tau - t) < Math.abs(best.tau - t) ? x : best, A.drive[0]);
    if (!d) break;
    const m = marginTier(d.gap).label;
    // 差が詰まっているのか、動かないのか、開いているのかで言い方を変える
    let key = "lead";
    if (prevGap != null) {
      if (d.gap < prevGap - 0.004) key = "chase";
      else if (Math.abs(d.gap - prevGap) <= 0.002) key = "locked";
    }
    prevGap = d.gap;
    call(t, "drive", key, {
      n1: nameOf(d.first), n2: nameOf(d.second), n3: nameOf(d.third), m
    }, "final");
  }

  // ── 決着＝どう決まったのかを言う ────────────────────────────────
  // ★位置は決着点そのもの。τ=1.0（最下位のゴール）に置くと、実測で8秒以上
  //   遅れて出る台本になっていた。
  // ★大写しになるのは1着の竜。だから最後に叫ぶのは「どんな勝ち方だったか」。
  //   2着との差で締めると、画面の主役と言葉の主役がずれる（ユーザー指摘）。
  //   順番：①決まり方（逃げ切った/差し切った）→②着差（際どい時だけ）→
  //         ③決め台詞＝A.drama から算出した「この勝ちの何がすごいか」
  const dm = A.drama || {};
  const dv = {
    n: nameOf(A.winner), n2: nameOf(A.second), st: styleJP(A.winner),
    p: dm.popRank, o: dm.odds, w: dm.worstRank, lc: dm.leadChanges
  };
  say(D, "call", pick(poolOf("decide", A.pattern, "call"), "call"), dv, "goal");
  // 着差は「際どかった時」だけ言う。大差の時に差を語っても盛り上がらない。
  if (dm.marginKey === "nose" || dm.marginKey === "neck") {
    say(D + 0.010, "call", pick(poolOf("margin", A.margin, "call"), "call"), dv, "goal");
  }
  // ★最後の一行＝決め台詞。ここで終わる。
  say(D + 0.014, "call", pick(poolOf("climax", dm.headline || "solid", "call"), "call"), dv, "goal");
  // ★解説のゴール台詞は「讃える」。自分の見立ての話はしない。
  //   大写しになっているのは勝った竜。その走りを、その人の物差しで讃える。
  //   （物差しが違うから、讃え方も6人で違う＝それが描き分けになる）
  say(D + 0.006, "color",
      pick(poolOf("praise", (dm.score >= 70 ? "big" : "normal"), "color"), "color"),
      dv, "goal");

  // ★予言の答え合わせ。当たれば勝ち誇り、外れれば自爆する。
  //   判定は確定済みの結果を読むだけ（新しい判定は作らない）。
  if (prophecy) {
    const hit = (() => {
      switch (prophecy.kind) {
        case "leadsAtSomePoint":   // 名指しの竜が一度でも先頭に立ったか
          return A.samples.some(s => s.order[0] === prophecy.target);
        case "favFlops":           // 1番人気が3着を外したか
          return [A.winner, A.second, A.third].indexOf(prophecy.target) < 0;
        case "frontFades":         // 序盤の先頭が3着を外したか
          return (() => {
            const early = A.samples.find(s => s.tau >= 0.15);
            const lead = early ? early.order[0] : null;
            return lead ? [A.winner, A.second, A.third].indexOf(lead) < 0 : false;
          })();
        case "chaos":              // 4番人気以下が勝ったか
          return (A.drama && A.drama.popRank >= 4);
        case "closerWins":         // 後ろから来た竜が勝ったか
          return (A.drama && A.drama.comeback >= 2);
        case "namedWins":          // 期待した竜が3着以内に来たか
          // ★「勝つ」の断定ではなく「期待できる」なので、判定も甘くする。
          //   1着かどうかで裁くと、解説がプレイヤーの予想と張り合う形になる。
          return [A.winner, A.second, A.third].indexOf(prophecy.target) >= 0;
        default: return false;
      }
    })();
    A.prophecyHit = hit;
    // ★答え合わせは決着では言わない。
    //   画面には勝った竜が大写しになっている。そこで解説が自分の予想の採点を
    //   始めるのは筋違い（ユーザー指摘）。見立ての当否は、決着の少し前に
    //   一言だけ触れて済ませる。決着の場は、竜を讃えるために空ける。
    const vv = { n: nameOf(A.winner), t: prophecy.targetName, st: prophecy.targetStyle };
    say(D - 0.030, "color", pick(poolOf("verdict", hit ? "hit" : "miss", "color"), "color"), vv, "final");
  }

  // ── カットイン ──────────────────────────────────────────────────
  // ★通常の流れに割り込んで、その瞬間だけ叫ぶ（ユーザー提案）。
  //   台本は先に組んであるので、大事な瞬間が「順番待ち」で埋もれることがある。
  //   上位を争う追い抜きは待たせる価値がないので、優先度を最上位にして
  //   その時刻に割り込ませる（詰め込みの段で他の行を押しのける）。
  //   ★条件は厳しくする。多用すると割り込みの価値が消える。
  (() => {
    const cuts = [];
    let prevOrder = null;
    A.samples.forEach(s => {
      if (s.tau < 0.25 || s.tau > A.decideTau - 0.02) { prevOrder = s.order; return; }
      if (prevOrder) {
        for (let r = 0; r < 3; r++) {          // 1〜3番手に入る動きだけを見る
          const now = s.order[r], was = prevOrder[r];
          if (now && was && now !== was) {
            const from = prevOrder.indexOf(now) + 1;
            if (from > r + 1) cuts.push({ tau: s.tau, id: now, to: r + 1, from, jump: from - (r + 1) });
            break;
          }
        }
      }
      prevOrder = s.order;
    });
    // いちばん大きい動きを最大2つだけ。近すぎるものは1つに絞る。
    cuts.sort((a, b) => b.jump - a.jump || a.tau - b.tau);
    const chosen = [];
    cuts.forEach(c => {
      if (chosen.length >= 2) return;
      if (chosen.some(x => Math.abs(x.tau - c.tau) < 0.10)) return;
      chosen.push(c);
    });
    A.cutins = chosen;
    chosen.forEach((c, i) => {
      const vars = { n: nameOf(c.id), to: c.to, from: c.from };
      say(c.tau, "call", pick(poolOf("cutin", c.to === 1 ? "toLead" : "toPodium", "call"), "call"), vars, "cutin");
      // ★解説が受けるのは最初の1回だけ。2回とも受けさせると同じ驚き方を
      //   繰り返すことになり、割り込みの価値が薄れる（実測で重複した）。
      if (i === 0) color(c.tau + 0.016, "cutin", c.to === 1 ? "toLead" : "toPodium", vars, "cutin");
    });
  })();

  // ── 詰め込み ────────────────────────────────────────────────────
  // 時間は有限。読める時間を確保しながら、入らない行は優先度の低いものから捨てる。
  // ★決着の3行は先に場所を押さえる（あとから来た行に押し出されないように）。
  const packed = [];
  const dropped = [];
  ["call", "color"].forEach(side => {
    const mine = cand.filter(c => c.side === side).sort((a, b) => a.tau - b.tau);
    const goals = mine.filter(c => c.tag === "goal");
    const rest  = mine.filter(c => c.tag !== "goal");

    // ①決着を先に確定（決着点から順に、読める間隔で並べる）
    let gAt = A.decideTau;
    goals.forEach(g => {
      g.at = gAt;
      // ★決着は畳みかけて言い切る場面。字数ぶんの尺を取ると3行で3秒以上に
      //   なり、決め台詞が決着から離れる（実測3.2秒遅れ）。ここは固定で詰める。
      g.hold = 0.9 / raceSec;
      gAt = g.at + g.hold;
      packed.push(g);
    });
    const goalStart = goals.length ? goals[0].at : 2;

    // ②残りを時間順に詰める。決着枠に食い込む行と、前の行と重なる行は捨てる。
    let cursor = -1;
    rest.forEach(c => {
      const hold = bcHoldTau(c.line, beatOf(c.tag), raceSec);
      let at = Math.max(c.tau, cursor);
      // ★決着枠に食い込むなら、まず「前へ詰められないか」を試す。
      //   従来は即座に捨てていたため、終盤の行が1レースで14件も落ち、
      //   決着直前に3秒以上の無言が空いていた（実測）。
      //   終盤は最も埋めたい区間なので、捨てるのは本当に入らない時だけにする。
      if (at + hold > goalStart - 0.004) {
        const fit = goalStart - 0.004 - hold;
        if (fit >= cursor && fit >= c.tau - hold * 2) at = fit;
        else { dropped.push(c); return; }
      }
      // ★「本来の位置から離れすぎ」で捨ててよいのは、時機を外すと意味を失う
      //   低優先の行だけ（コース説明・差の開閉・本領発揮）。
      //   入場は τ が名目値で、実際はパレード側が間合いを取り直すので対象外。
      //   発走・終盤・1位交代は多少ずれても価値が残るので落とさない。
      // ★位置ズレを理由に落とすのはやめた。読み切れないことより、言うべきことを
      //   言わないことの方が損（ユーザー判断）。決着枠に食い込む場合だけ捨てる。
      c.at = at; c.hold = hold; cursor = at + hold;
      packed.push(c);
    });
  });
  // 実況と解説が同時に切り替わらないよう、解説側だけ微調整する
  const callTaus = packed.filter(p => p.side === "call").map(p => p.at);
  packed.filter(p => p.side === "color" && p.tag !== "goal").forEach(p => {
    if (callTaus.some(t => Math.abs(t - p.at) < 0.010)) p.at += 0.012;
  });

  packed.forEach(p => script.push({ tau: p.at, side: p.side, line: p.line, tag: p.tag, hold: p.hold }));
  script.sort((a, b) => a.tau - b.tau);
  A.dropped = dropped.map(d => ({ tag: d.tag, line: d.line }));   // 何を捨てたかは検証で見る
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
const RC_LOAD_MAX_MS = 3600;   // 何かが詰まっても、ここで必ず走り出す
const RC_LOAD_IMG_MS = 1100;   // 背景の先読みを待つ上限（返事が来ない実装でも止まらない）
const RC_LOAD_DRAGON_MS = 1600;// 出走竜のスプライトを待つ上限（揃わないと別の竜が一瞬映る）

function showRaceLoading(host, c, onReady) {
  // ★ここで落ちるとロード画面のまま止まって復帰できないので、必ず先へ進める。
  if (!c) { try { onReady(); } catch (e) {} return; }
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
          '" alt="" onerror="rcLoadArtRetry(this)"></div>'
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
  // 出走する竜のスプライトを先に読む。
  // ★これが無いと、レース開始の一瞬だけ「別の竜」が出る（ユーザー指摘）。
  //   竜の絵は images/dragons/<id>.png を非同期で読み、間に合わない間は
  //   手続き描画の竜で代用する作りになっている。つまり読み込みが終わる前に
  //   走り出すと、最初の数フレームだけ違う姿の竜が描かれてしまう。
  //   ロード画面はまさにこれを解消するための場所なので、ここで待つ。
  const preloadDragons = (cb) => {
    try {
      const ids = ((c.timeline && c.timeline.dragons) || []).map(d => d.id).filter(Boolean);
      if (!ids.length || typeof _rcDragonSprite !== "function") { cb(); return; }
      setNote("出走竜を呼んでいます……");
      ids.forEach(id => { try { _rcDragonSprite(id); } catch (e) {} });
      const t0 = Date.now();
      const tick = () => {
        const ready = ids.every(id => {
          const e = (typeof RC_DSPRITE !== "undefined") ? RC_DSPRITE[id] : null;
          return e && (e.ok || e.bad);          // 読めた／無い のどちらかで決着
        });
        if (ready || Date.now() - t0 > RC_LOAD_DRAGON_MS) { cb(); return; }
        setTimeout(tick, 40);
      };
      tick();
    } catch (e) { cb(); }
  };

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
      // ★竜のスプライトは背景より優先度が高い。ここが揃う前に走り出すと
      //   「最初の一瞬だけ別の竜」になるので、必ず待ってから発走する。
      preloadDragons(() => {
        const rest = Math.max(0, RC_LOAD_MIN_MS - (Date.now() - started));
        setNote("まもなく発走です");
        setTimeout(go, rest);
      });
    });
  }, 60);

  setTimeout(go, RC_LOAD_MAX_MS);   // 最終防衛線：何があっても走り出す
}

// ロード画面の一枚絵。ミミのロード用イラスト（images/cast/mimi/loading*）。
// ★この 46 枚はロード画面のために用意された素材。毎回ランダムで1枚出す。
// EXTENSION POINT: 絵を足したらファイル名をこの配列に1行足すだけ。
var RC_LOAD_DIR = "images/cast/mimi/";
var RC_LOAD_ARTS = [
  "loading1.png", "loading2.png", "loading3.png", "loading4.png",
  "loading5.png", "loading6.png", "loading7.png", "loading8.png",
  "loading9.webp", "loading10.png", "loading11.png", "loading12.png",
  "loading13.png", "loading14.png", "loading15.png", "loading16.png",
  "loading17.png", "loading18.png", "loading19.png", "loading20.png",
  "loading21.png", "loading22.png", "loading23.png", "loading24.png",
  "loading25.png", "loading26.png", "loading27.png", "loading28.png",
  "loading29.png", "loading30.png", "loading31.png", "loading32.webp",
  "loading33.png", "loading34.png", "loading35.png", "loading36.png",
  "loading37.png", "loading38.png", "loading39.png", "loading40.png",
  "loading41.png", "loading42.png", "loading43.png", "loading44.png",
  "loading45.png", "loading46.png"
];
var _rcLoadLast = -1;
function rcLoadArtFor(race) {
  try {
    if (!RC_LOAD_ARTS.length) return null;
    var i = Math.floor(Math.random() * RC_LOAD_ARTS.length);
    if (i === _rcLoadLast && RC_LOAD_ARTS.length > 1) i = (i + 1) % RC_LOAD_ARTS.length;   // 直前と同じ絵を避ける
    _rcLoadLast = i;
    return RC_LOAD_DIR + RC_LOAD_ARTS[i];
  } catch (e) { return null; }
}

// 画像が読めなかったとき、別の絵に差し替える。
// ★ユーザーが「良くない画像はフォルダから削除する」運用のため、
//   配列に残ったまま消えたファイルを引くことが起きる。そのとき枠ごと消すと
//   「ロード画面に絵が無い」状態になるので、別の絵を引き直す。
//   数回試して全部だめなら、そのときだけ枠を畳む（崩れない）。
function rcLoadArtRetry(img) {
  try {
    const tried = (+img.dataset.tried || 0) + 1;
    img.dataset.tried = tried;
    if (tried > 4) { const f = img.closest(".rcload-art"); if (f) f.remove(); return; }
    const next = rcLoadArtFor(null);
    if (next && next !== img.getAttribute("src")) { img.src = next; return; }
    const f2 = img.closest(".rcload-art"); if (f2) f2.remove();
  } catch (e) {
    try { const f = img.closest(".rcload-art"); if (f) f.remove(); } catch (e2) {}
  }
}
