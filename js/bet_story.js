// =========================================================================
// bet_story.js — 結果画面の「理由への返事」を、見た竜と区間の名指しにする（表示専用）
// =========================================================================
// 経緯（2026-11-12・Codex の通し試験 docs/PLAYTEST_REPORT_20261112.md §8）：
//   「能力は嘘をつかなかった」「今日は流れに乗れなかった」は総括でしかなく、能力の名前すら
//   言っていなかった。予想の理由を選ばせるなら、その理由に対して具体的に答える。
//
// ★ここは「確定済みの事実」を読み替えるだけ。新しい判定・確率・数値は作らない。
//   読むもの＝着順（raceResult.entries）／画面の順位表と同じ出どころ（timeline.standingsAt）／
//   コースの区間名と、その区間でいちばん問われる能力（data_courses.js の weights）／
//   人気順（oddsResult.oddsData）／ペース（raceResult.pace）／脚質。
//   着順・オッズ・配当・抽選には一切書き込まない。
//
// ★「序盤／中盤」の位置＝先頭がコースの 1/3・2/3 に達した瞬間の順位。
//   レース画面の区間の切り替え（race_canvas.js thirdAtP）と同じ区切りなので、
//   ここで言う「中盤の大旋回で3番手から先頭へ」は、画面の順位表で見えていた動きと一致する。
//
// ★4つの理由は「見る場所」が違う。返事もその見る場所で答える：
//   好み＝その子の見せ場／能力データ＝区間で問われた能力の名前／
//   レース展開＝ペースと脚質／うまみ＝人気と着順のズレ。
// =========================================================================

const BS_STAT_JP = { speed: "速さ", stamina: "底力", fire: "闘志", wing: "翼", turn: "旋回", nerve: "気性" };
const BS_PACE_JP = { slow: "スロー", standard: "標準", high: "ハイ", very_high: "超ハイ" };
const BS_SEG_JP = ["序盤", "中盤", "終盤"];

function _bsPos(n) { return n === 1 ? "先頭" : n + "番手"; }

// 自分の竜を1頭に決める。ワイドは2頭なので、外れなら「届かなかったほう」、当たりなら「上の着順のほう」。
function _bsPickMine(c, hit) {
  const sel = (c.bet && c.bet.selections) || [];
  const ordered = c.raceResult.entries;
  const idx = sel.map(id => ordered.findIndex(e => e.dragon.id === id)).filter(i => i >= 0);
  if (!idx.length) return -1;
  return hit ? Math.min.apply(null, idx) : Math.max.apply(null, idx);
}

// この一戦の「自分の竜の道のり」。読めなければ null（呼び元は従来の総括文へ落ちる）。
// 結果は raceResult ごとに1回だけ作って c に持たせる（タブ切替の再描画で作り直さない）。
function betStoryOf(c) {
  try {
    if (!c || !c.raceResult || !c.bet || !c.betResult) return null;
    if (c._betStory && c._betStory.rr === c.raceResult) return c._betStory.story;
    const story = _bsBuild(c);
    c._betStory = { rr: c.raceResult, story };
    return story;
  } catch (e) { return null; }
}

function _bsBuild(c) {
  const hit = !!c.betResult.hit;
  const ordered = c.raceResult.entries;
  const myIdx = _bsPickMine(c, hit);
  if (myIdx < 0) return null;
  const my = ordered[myIdx], d = my.dragon, rank = myIdx + 1;
  const need = c.bet.type === "win" ? 1 : 3;

  // 画面と同じタイムライン（同じ入力なら同じものができる＝決定的）。無ければ作る。読むだけ。
  const tl = c.timeline || (typeof buildRaceTimeline === "function"
    ? buildRaceTimeline(c.race, c.raceResult, c.oddsResult, c.bet) : null);
  if (!tl || typeof tl.standingsAt !== "function") return null;

  // 先頭が 1/3・2/3 に達した時刻を探し、そのときの自分の順位を読む。
  const tauAt = frac => { for (let g = 1; g <= 400; g++) { const t = g / 400; if (tl.leaderProgressAt(t) >= frac) return t; } return 1; };
  const posAt = tau => { const i = tl.standingsAt(tau).indexOf(d.id); return i < 0 ? 0 : i + 1; };
  const a = posAt(tauAt(1 / 3)), b = posAt(tauAt(2 / 3)), f = rank;
  if (!a || !b) return null;

  // 区間の名前と、その区間でいちばん重く問われる能力。
  const keys = [c.race.early, c.race.mid, c.race.late], phases = ["early", "mid", "late"];
  const secs = [0, 1, 2].map(t => {
    const s = (typeof getSection === "function") ? getSection(phases[t], keys[t]) : null;
    if (!s) return null;
    let best = "", bw = -1;
    for (const k in (s.weights || {})) if (s.weights[k] > bw) { bw = s.weights[k]; best = k; }
    return { name: `${BS_SEG_JP[t]}の〈${s.label}〉`, stat: BS_STAT_JP[best] || "" };
  });
  if (secs.some(s => !s)) return null;

  const od = ((c.oddsResult && c.oddsResult.oddsData) || []).find(o => o.dragonId === d.id) || {};
  const style = (typeof STYLE_LABEL !== "undefined" && STYLE_LABEL[d.style]) || "";
  const pace = BS_PACE_JP[(c.raceResult.pace || {}).type] || "";

  const upMid = a - b, upLate = b - f;          // ＋＝その区間で順位を上げた
  let key, move;                                 // key＝名指す区間(0〜2)／move＝そこで起きたこと
  if (hit) {
    // 当たり＝いちばん順位を上げた区間（同じなら後ろの区間＝決め手に近いほう）。
    if (upLate >= 1 && upLate >= upMid) {
      key = 2; move = f === 1 ? `${_bsPos(b)}から差し切った` : `${_bsPos(b)}から${f}着へ上がった`;
    } else if (upMid >= 1) {
      key = 1; move = b === 1 ? `${_bsPos(a)}から先頭に立った` : `${_bsPos(a)}から${_bsPos(b)}へ上がった`;
    } else {
      // どこでも上げていない＝序盤に取った位置で決まった。
      key = 0;
      move = f === 1 ? `${_bsPos(a)}を取り、そのまま押し切った`
           : f <= a ? `${_bsPos(a)}につけ、そのまま守り切った`
           : `${_bsPos(a)}を取り、${f}着に粘り込んだ`;
    }
  } else {
    // 外れ＝「的中の圏内から落ちた区間」を名指す。圏内に一度も居なかったなら、
    //   大きく（2つ以上）落とした区間、それも無ければ序盤の位置が後ろすぎた、と言う。
    //   ★1つ下がっただけの区間を敗因に仕立てない（4→5番手→4着の単勝は、中盤のせいではなく最初から届いていない）。
    const dnMid = -upMid, dnLate = -upLate;
    const late = () => { key = 2; move = (my.collapse ? "脚が止まり、" : "") + `${_bsPos(b)}から${f}着へ下がった`; };
    const mid = () => { key = 1; move = `${_bsPos(a)}から${_bsPos(b)}へ下がった`; };
    if (b <= need) late();
    else if (a <= need) mid();
    else if (dnLate >= 2 && dnLate >= dnMid) late();
    else if (dnMid >= 2) mid();
    else {
      key = 0;
      move = f < a ? `${_bsPos(a)}に置かれ、${f}着まで上げたが届かなかった`
                   : `${_bsPos(a)}に置かれ、最後まで前に届かなかった`;
    }
  }

  // 「好み」の外れに返す見せ場（上げた区間、無ければ3番手以内で抜けた区間。無ければ空）。
  let shine = "", shineKey = -1;
  if (!hit) {
    if (upLate >= 1 && upLate >= upMid) { shineKey = 2; shine = `${secs[2].name}では${f}着まで上げた`; }
    else if (upMid >= 1) { shineKey = 1; shine = `${secs[1].name}では${_bsPos(b)}まで上がった`; }
    else if (Math.min(a, b) <= 3) { shineKey = a <= b ? 0 : 1; shine = a <= b ? `${secs[0].name}は${_bsPos(a)}で抜けた` : `${secs[1].name}は${_bsPos(b)}で抜けた`; }
  }

  // 返事の中では呼び名（「赤翼竜ルベル」→「ルベル」。実況・順位表と同じ切り方）。
  const short = (String(d.name).match(/竜(.+)$/) || [])[1] || d.name;
  return {
    hit, name: short, fullName: d.name, rank, need, a, b, f, key, move,
    sec: secs[key].name, stat: secs[key].stat, shine, shineKey,
    style, pace, pop: od.popularityRank || 0, collapse: !!my.collapse
  };
}

// 理由（kan/data/tell/value）への返事を1〜2文で。読めなければ null。
function reasonReplyLine(c, key) {
  const s = betStoryOf(c);
  if (!s) return null;
  const core = `${s.sec}で${s.move}`;
  const popTxt = s.pop ? `${s.pop}番人気の` : "";
  if (key === "kan") {
    if (s.hit) return `好きな${s.name}が応えてくれた。${core}。`;
    return s.shine
      ? `好きな${s.name}は届かず。でも${s.shine}。`
      : `好きな${s.name}は見せ場を作れず。でも、推した気持ちは間違いじゃない。`;
  }
  if (key === "data") {
    const q = s.stat ? `〈${s.stat}〉が問われる` : "";
    return s.hit ? `数字どおり。${q}${s.sec}で、${s.name}が${s.move}。`
                 : `数字は裏目。${q}${s.sec}で、${s.name}は${s.move}。`;
  }
  if (key === "tell") {
    const who = (s.style ? s.style + "の" : "") + s.name;
    return s.hit ? `展開を読み切った。${s.pace ? s.pace + "ペースのなか、" : ""}${who}が${core}。`
                 : `展開が違った。${s.pace ? s.pace + "ペースで、" : ""}${who}は${core}。`;
  }
  if (key === "value") {
    return s.hit ? `${s.pop >= 3 ? "うまみを拾った。" : "狙いどおり。"}${popTxt}${s.name}が${core}。`
                 : `うまみ狙いは不発。${popTxt}${s.name}は${core}。`;
  }
  return null;
}

// 道のりの帯（序盤◯番手 ▸ 中盤◯番手 ▸ ゴール◯着）。返事が名指した区間だけ明るくする。読めなければ空文字。
//   「好み」の外れだけは、返事が言うのは敗因ではなく見せ場なので、そちらの区間を明るくする（無ければどこも光らせない）。
function betStoryTraceHtml(c, reasonKey) {
  const s = betStoryOf(c);
  if (!s) return "";
  const k = (reasonKey === "kan" && !s.hit) ? s.shineKey : s.key;
  const cell = (i, lb, v) => `<span class="rsr-tr${k === i ? " key" : ""}">${lb} <b>${v}</b></span>`;
  return `<div class="rsr-trace" aria-label="${s.name}の道のり">` +
    cell(0, "序盤", _bsPos(s.a)) + `<i>▸</i>` + cell(1, "中盤", _bsPos(s.b)) + `<i>▸</i>` + cell(2, "ゴール", s.f + "着") +
    `</div>`;
}

// ★CORE_LOOP_UX C-2：不的中の「あとどれだけだったか」1行（どこで、は上の返事が言う）。
//   以前の「今日は流れに乗れなかった」「途中で失速。展開が合わなかった」は中身が無いので、的中までの頭数に替えた。
function missReasonLine(c) {
  try {
    const ordered = c.raceResult.entries;
    const myIdx = _bsPickMine(c, false);
    if (myIdx < 0) return "";
    const need = c.bet.type === "win" ? 1 : 3;          // 何着以内が必要だったか
    const my = ordered[myIdx], nm = my.dragon.name, rank = myIdx + 1, gap = rank - need;
    if (gap <= 0) return "";
    //   失速（collapse）はここでは言わない＝上の返事が「脚が止まり」と区間つきで言う（二重にしない）。
    if (gap === 1) return `${nm} は${rank}着。あと1頭ぶん、届かなかった。`;
    if (gap === 2) return `${nm} は${rank}着。惜しいところまでは来ていた。`;
    return `${nm} は${rank}着。的中の${need}着までは、あと${gap}頭ぶんあった。`;
  } catch (e) { return ""; }
}

if (typeof window !== "undefined") {
  window.betStoryOf = betStoryOf; window.reasonReplyLine = reasonReplyLine;
  window.betStoryTraceHtml = betStoryTraceHtml; window.missReasonLine = missReasonLine;
}
