// =============================================================================
// race_beats.js — レースの「出来事台帳」（実況・解説・エフェクトの共通の源）
// =============================================================================
// ★これは何のためにあるか
//   従来、三つの表現はバラバラの入力から動いていた：
//     竜の動き／エフェクト … タイムラインの events と順位変動
//     実況               … フェーズ集計を τ で等間隔に配置しただけ
//     解説               … 同上＋合いの手を固定位置に挿入
//   その結果「竜がつまずいた瞬間に実況が別の話をしている」状態になり、
//   三つが噛み合わなかった。ここで出来事を1本の列にまとめ、三つとも
//   この台帳を見て動くようにする＝同じ瞬間に、絵と実況と解説が揃う。
//
// ★絶対規律
//   ここは「確定済みの結果を読み替えるだけ」の表示層。着順・オッズ・配当・
//   FinalPower には一切触れない（[[race-math-immutable]]）。新しい判定も作らない。
//
// ★台帳の1件（beat）
//   { tau, kind, id, rank, mag, data }
//     tau  … レース時刻 0..1（この瞬間に起きる）
//     kind … 出来事の種類（下の BEAT_KIND）
//     id   … 主役の竜（無い出来事は null）
//     rank … その時点の順位（分かるものだけ）
//     mag  … 強さ 0..1（演出の大きさ・言葉の熱量に使う）
//     data … 種類ごとの付帯情報
//
// EXTENSION POINT: 出来事を足す → BEAT_KIND に1行、buildRaceBeats に検出を1つ。
//   文言は data_commentary_lines.js 側で kind をキーに書く（ここには文章を置かない）。
// =============================================================================

const BEAT_KIND = {
  START:      "start",       // ゲートが開いた
  GOOD_START: "goodStart",   // 好発進
  SLOW_START: "slowStart",   // 出遅れ
  SECTION:    "section",     // 区間が変わった（地形の切り替わり）
  SURGE:      "surge",       // 仕掛けた・伸びた
  STUMBLE:    "stumble",     // つまずいた
  COLLAPSE:   "collapse",    // 失速（脚が上がった）
  OVERTAKE:   "overtake",    // 順位が入れ替わった
  BATTLE:     "battle",      // 接戦（横並び）
  ZONE_IN:    "zoneIn",      // 自分の賭けが的中圏内へ入った
  ZONE_OUT:   "zoneOut",     // 圏内から外れた
  UNDERDOG:   "underdog",    // 人気薄が上位に来ている
  FAVORITE:   "favorite",    // 1番人気が先頭を守っている
  LAST_SPURT: "lastSpurt",   // 最終直線に入った
  GOAL:       "goal"         // 決着
};

// 区間キー → 「そこで効く能力」。data_courses の weights から機械的に出す。
// ★手書きの対応表を別に持たない＝コースを足しても説明が古びない。
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

// その竜が、その区間の要求能力をどれだけ備えているか（0..1）。
// ★新しい判定ではなく、既存の能力値と既存の weights を読むだけ＝結果には影響しない。
function beatFitness(dragon, phaseKey, race) {
  try {
    const sec = getSection(phaseKey, race[phaseKey]);
    if (!sec || !sec.weights || !dragon) return 0.5;
    let sum = 0, wsum = 0;
    for (const k in sec.weights) {
      const w = sec.weights[k]; if (!w) continue;
      const v = (dragon[k] != null ? dragon[k] : 50);
      sum += (v / 100) * w; wsum += w;
    }
    return wsum ? Math.max(0, Math.min(1, sum / wsum)) : 0.5;
  } catch (e) { return 0.5; }
}

/**
 * レース1本ぶんの出来事台帳を作る。
 * @param {object} timeline   race_timeline_engine の出力（確定済み）
 * @param {object} ctx        { race, bet, oddsResult, raceResult }
 * @returns {Array} tau昇順の beat 配列
 */
function buildRaceBeats(timeline, ctx) {
  const beats = [];
  const race = ctx.race;
  const dragons = timeline.dragons || [];
  const push = (tau, kind, id, mag, data) => {
    beats.push({ tau: Math.max(0, Math.min(1, tau)), kind, id: id || null,
                 rank: null, mag: mag == null ? 0.5 : mag, data: data || {} });
  };

  // 人気順の索引（人気と実力のズレを語るために使う）
  const pop = {};
  try { (ctx.oddsResult && ctx.oddsResult.oddsData || []).forEach(o => { pop[o.dragonId] = o.popularityRank; }); } catch (e) {}

  // --- 発走 ---
  push(0.02, BEAT_KIND.START, null, 1);

  // --- 竜ごとの出来事（タイムラインが持つ確定済みのもの）---
  for (const dr of dragons) {
    const ft = dr.finishTau || 1;
    for (const ev of (dr.events || [])) {
      const tau = ev.u * ft;                       // 竜ごとの進捗u → レース時刻τ
      if (ev.type === "stumble") push(tau, BEAT_KIND.STUMBLE, dr.id, Math.min(1, (ev.depth || 0.3) * 2.2), {});
      else if (ev.type === "surge") push(tau, BEAT_KIND.SURGE, dr.id, Math.min(1, (ev.amp || 0.1) * 6), {});
      else if (ev.type === "good_start") push(0.05, BEAT_KIND.GOOD_START, dr.id, 0.7, {});
      else if (ev.type === "collapse") push(tau, BEAT_KIND.COLLAPSE, dr.id, 0.9, {});
    }
    // 出遅れ＝スタート直後に後方だった竜（events に無い場合の補完）
    try {
      const st0 = timeline.standingsAt(0.06);
      const i0 = st0.indexOf(dr.id);
      if (i0 >= dragons.length - 2) push(0.06, BEAT_KIND.SLOW_START, dr.id, 0.6, {});
    } catch (e) {}
  }

  // --- 区間の切り替わり（地形が変わる＝効く能力が変わる）---
  const SECTION_AT = [[0.02, "early"], [0.34, "mid"], [0.68, "late"]];
  SECTION_AT.forEach(([tau, key]) => {
    const s = beatSectionStats(race, key);
    if (s.label) push(tau, BEAT_KIND.SECTION, null, 0.5, { phaseKey: key, label: s.label, stats: s.stats, terrain: s.terrain });
  });

  // --- 順位の入れ替わり・接戦（確定済みの standings を時間で走査するだけ）---
  const STEP = 0.02;
  let prev = null;
  for (let tau = 0.08; tau <= 0.99; tau += STEP) {
    let st; try { st = timeline.standingsAt(tau); } catch (e) { break; }
    if (prev) {
      for (let i = 0; i < Math.min(4, st.length); i++) {
        const id = st[i], now = i + 1, was = prev.indexOf(id) + 1;
        if (was > 0 && now < was && (was - now) >= 1 && now <= 3) {
          push(tau, BEAT_KIND.OVERTAKE, id, Math.min(1, (was - now) / 3), { from: was, to: now });
        }
      }
      // 接戦＝先頭2頭の距離が非常に近い
      try {
        const a = timeline.progressAt(st[0], tau), b = timeline.progressAt(st[1], tau);
        if (Math.abs(a - b) < 0.006) push(tau, BEAT_KIND.BATTLE, st[0], 0.8, { rival: st[1] });
      } catch (e) {}
    }
    prev = st;
  }

  // --- 人気と実力のズレ（中盤で1度ずつ）---
  try {
    const mid = timeline.standingsAt(0.5);
    const under = mid.slice(0, 3).find(id => (pop[id] || 9) >= 5);
    if (under) push(0.52, BEAT_KIND.UNDERDOG, under, 0.8, { pop: pop[under] });
    if ((pop[mid[0]] || 9) === 1) push(0.46, BEAT_KIND.FAVORITE, mid[0], 0.6, {});
  } catch (e) {}

  // --- 自分の賭けが圏内へ出入りした瞬間 ---
  try {
    const sel = (ctx.bet && ctx.bet.selections) || [];
    if (sel.length) {
      const need = ctx.bet.type === "win" ? 1 : 3;
      let inZone = null;
      for (let tau = 0.1; tau <= 0.99; tau += STEP) {
        const st = timeline.standingsAt(tau);
        const ok = sel.every(id => (st.indexOf(id) + 1) <= need && st.indexOf(id) >= 0);
        if (inZone === null) { inZone = ok; continue; }
        if (ok !== inZone) {
          push(tau, ok ? BEAT_KIND.ZONE_IN : BEAT_KIND.ZONE_OUT, sel[0], ok ? 1 : 0.7, { need });
          inZone = ok;
        }
      }
    }
  } catch (e) {}

  // --- 最終直線・決着 ---
  push(0.82, BEAT_KIND.LAST_SPURT, null, 0.9, {});
  try {
    const cr = timeline.crossings || [];
    const win = cr[0], second = cr[1];
    let margin = null;
    if (win && second && win.tau != null && second.tau != null) margin = Math.abs(second.tau - win.tau);
    push(1, BEAT_KIND.GOAL, win && win.id, 1, {
      winner: win && win.id, second: second && second.id,
      margin,                                   // τ差。小さいほど僅差
      photo: margin != null && margin < 0.006,  // 写真判定級
      runaway: margin != null && margin > 0.05, // 大差
      winnerPop: win ? (pop[win.id] || null) : null
    });
  } catch (e) {}

  beats.sort((a, b) => a.tau - b.tau);

  // ★間引き：接戦のように「続いている状態」は毎ステップ立つので、そのままだと
  //   同じ話を12回繰り返すことになる（実測）。同種＋同じ主役が近い時刻に並んだら
  //   最初の1件だけ残す。出来事の“重さ”は kind ごとに変える。
  const COOLDOWN = { battle: 0.22, overtake: 0.10, surge: 0.12, stumble: 0.08, section: 0.20 };
  const lastAt = {};
  const thinned = beats.filter(b => {
    const cd = COOLDOWN[b.kind];
    if (!cd) return true;                                  // 一度きりの出来事はそのまま
    const key = b.kind + "|" + (b.id || "");
    if (lastAt[key] != null && b.tau - lastAt[key] < cd) return false;
    lastAt[key] = b.tau;
    return true;
  });

  // 同じ瞬間に出来事が重なりすぎると読めないので、近接する山は強い方を優先して薄める。
  const MIN_GAP = 0.035;
  const out = [];
  for (const b of thinned) {
    const prevB = out[out.length - 1];
    if (prevB && b.tau - prevB.tau < MIN_GAP && b.kind !== "goal") {
      if ((b.mag || 0) > (prevB.mag || 0)) out[out.length - 1] = b;   // 強い方に差し替え
      continue;
    }
    out.push(b);
  }
  return out;
}
