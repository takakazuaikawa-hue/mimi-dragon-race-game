// =============================================================================
// devcheck_broadcast.js — 実況エンジンの自己監査
// =============================================================================
// ★なぜ作ったか
//   ユーザーに細切れで確認させるたび、新しい粗が出ていた。原因は、指摘が
//   その場の修正で終わり、次のレースで再発しても気づけなかったこと。
//   ここまでにいただいた指摘を全部「毎回機械で検査できる規則」にする。
//   → 仕上げてから出す。出す前にこれを通す。
//
// 使い方（コンソール）: bcAudit(30)   ← 30レース分を検査
// =============================================================================
function bcAudit(n) {
  n = n || 20;
  const R = [];
  const casters = (typeof RACE_COMMENTATORS !== "undefined") ? RACE_COMMENTATORS : [];
  const races = (typeof RACES !== "undefined" && RACES.length) ? RACES : [state.current && state.current.race].filter(Boolean);
  const fails = [];
  const note = (race, rule, detail) => fails.push({ race, rule, detail });

  for (let i = 0; i < n; i++) {
    const race = races[i % races.length];
    if (!race) break;
    let rr, or_, tl, bc, cmt;
    try {
      rr = runRace(race);
      or_ = (typeof simulateMarket === "function") ? simulateMarket(race) : state.current.oddsResult;
      tl = buildRaceTimeline(race, rr, or_, null);
      cmt = casters[i % Math.max(1, casters.length)] || null;
      bc = buildBroadcast(tl, { race, oddsResult: or_, raceResult: rr },
        { commentator: cmt, nameOf: (id) => commentaryName(id) });
    } catch (e) { note(race.id, "組み立てで例外", e.message); continue; }

    const S = bc.script, A = bc.analysis, sec = tl.durationSecHint, D = A.decideTau;
    const call = S.filter(x => x.side === "call");
    const color = S.filter(x => x.side === "color");
    const txt = S.map(x => x.line).join("\n");

    // ① 非日本語の混入（何度もやらかしている）
    const junk = txt.match(/[Ѐ-ӿ가-힯]|[A-Za-z]{3,}/g);
    if (junk) note(race.id, "非日本語の混入", [...new Set(junk)].join(","));

    // ② 同じ台詞の重複
    const dup = S.length - new Set(S.map(x => x.side + x.line)).size;
    if (dup > 0) note(race.id, "台詞の重複", dup + "件");

    // ③ 序盤に「並んでいる」を言わない
    if (/並ん|雁行|譲らない/.test(S.filter(x => x.tau < 0.30).map(x => x.line).join(""))) {
      note(race.id, "序盤の並走描写", "禁止のはず");
    }

    // ④ 中盤に上位の隊列が示されているか
    if (!S.some(x => x.tag === "shape" && x.tau >= 0.30 && x.tau <= 0.62)) {
      note(race.id, "中盤の展開説明なし", "上位が誰か不明のまま");
    }

    // ⑤ 下位（4番手以下）の入れ替わりを語らない
    // ★「7番手から来た」は巻き返しの称賛であって下位の実況ではない。
    //   検査するのはレース中の順位報告だけ（決着・カットインは除外）。
    const low = call.filter(x => /[5-8]番手/.test(x.line) && x.tag !== "cutin" && x.tag !== "goal");
    if (low.length) note(race.id, "下位の入れ替わり", low[0].line);

    // ⑥ 決め台詞が最後に来ているか（着差で終わらない）
    const goals = S.filter(x => x.tag === "goal" && x.side === "call");
    // ★「首の上げ下げ」「鼻先——！」は鼻先勝負の決め台詞であって着差報告ではない。
    //   締めが climax（勝ち方を叫ぶ行）かどうかで判定する。
    const lastGoal = goals[goals.length - 1];
    const isClimax = lastGoal && /[！—]$/.test(lastGoal.line);
    if (goals.length && !isClimax && /^(鼻先|首差|半身|一体|大差)/.test(lastGoal.line)) {
      note(race.id, "着差で締めている", goals[goals.length - 1].line);
    }

    // ⑦ 決め台詞の位置＝決着点から離れすぎない
    if (goals.length) {
      const late = (Math.max(...goals.map(x => x.tau)) - D) * sec;
      if (late > 3.0) note(race.id, "決め台詞が遅い", late.toFixed(1) + "秒遅れ");
    }

    // ⑧ 無言が長すぎない
    const ts = S.map(x => x.tau).filter(t => t <= D).sort((a, b) => a - b);
    let mx = 0; for (let k = 1; k < ts.length; k++) mx = Math.max(mx, ts[k] - ts[k - 1]);
    if (mx * sec > 3.0) note(race.id, "無言が長い", (mx * sec).toFixed(1) + "秒");

    // ⑨ 解説が実況の一言ごとに相槌を打っていないか
    if (color.length > call.length * 0.75) {
      note(race.id, "解説が多すぎ", "実況" + call.length + "／解説" + color.length);
    }

    // ⑩ 決着の解説が「自分の話」になっていないか
    const gc = S.filter(x => x.tag === "goal" && x.side === "color");
    if (gc.some(x => /見立て|読み|予想|わたしの|あたくしの/.test(x.line))) {
      note(race.id, "決着で解説が自分語り", gc.map(x => x.line).join(" / "));
    }

    // ⑪ 空文字の行が混ざっていないか
    if (S.some(x => !x.line || !x.line.trim())) note(race.id, "空の行", "");

    R.push({ race: race.id, 行: S.length, 実況: call.length, 解説: color.length,
             決着: A.drama.headline, 盛上: A.drama.score });
  }
  const byRule = {};
  fails.forEach(f => { (byRule[f.rule] = byRule[f.rule] || []).push(f.detail); });
  return {
    検査したレース: R.length,
    違反の総数: fails.length,
    規則ごと: Object.keys(byRule).map(k => k + " ×" + byRule[k].length + "（例: " + byRule[k][0] + "）"),
    平均: R.length ? {
      行: +(R.reduce((a, b) => a + b.行, 0) / R.length).toFixed(1),
      実況: +(R.reduce((a, b) => a + b.実況, 0) / R.length).toFixed(1),
      解説: +(R.reduce((a, b) => a + b.解説, 0) / R.length).toFixed(1)
    } : null,
    決着の内訳: R.reduce((m, x) => { m[x.決着] = (m[x.決着] || 0) + 1; return m; }, {})
  };
}
if (typeof window !== "undefined") window.bcAudit = bcAudit;
