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

// ★優先順位（ユーザー指定）。同じ瞬間に複数の出来事が競合したとき、これで決める。
//   ① 勝敗に関わること（自分の賭けの成否・決着）が最優先
//   ② 抜いた抜かれた＝レースの骨格。ここは絶対に落とさない
//   ③ それ以外の出来事
//   ④ 合間の話題（場・条件・竜の豆知識）＝空いた時間にだけ入る「詰め物」
//   数字が大きいほど強い。話題(TOPIC)を20台に置くことで、構造上
//   「豆知識が抜いた抜かれたを押しのける」ことが起きないようにしている。
const BEAT_PRI = {
  goal: 100, zoneIn: 98, zoneOut: 96,      // ①勝敗
  overtake: 90, lastSpurt: 84, battle: 80, // ②抜いた抜かれた・競り合い
  collapse: 74, stumble: 72, surge: 70,    // ③レースの出来事
  goodStart: 62, slowStart: 60, start: 58,
  section: 50, underdog: 48, favorite: 46,
  topic: 20                                // ④合間の話題（詰め物）
};
function beatPri(kind) { return BEAT_PRI[kind] != null ? BEAT_PRI[kind] : 40; }

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
  GOAL:       "goal",        // 決着
  TOPIC:      "topic"        // ★合間の話題（場・条件・竜の豆知識）＝レース外の素材
};

// ── 合間の話題（TOPIC）の材料 ────────────────────────────────────────
// ★実際のレース中継は、順位の読み上げだけでなく、合間に「今日の馬場」「この馬の血統」
//   「厩舎の話」などを絶えず織り込んでいる（調査済み）。それが無いと、順位を読むだけの
//   痩せた実況になる。ここではゲーム内に既にある素材を話題として棚卸しする。
//   ★あくまで詰め物。優先度20なので、抜いた抜かれた等を押しのけることはない。
//   data には「何について話すか」だけを入れ、文章は手順4で書く（ここに文言は置かない）。
const TOPIC_SUBJECT = {
  VENUE:     "venue",      // この地域・コースの成り立ち
  WEATHER:   "weather",    // 今日の天候と、効いてくる能力
  DISTANCE:  "distance",   // 距離帯と、消耗の出方
  TERRAIN:   "terrain",    // いま走っている区間の地形
  LORE:      "lore",       // その竜の伝承（図鑑で解禁済みのものだけ）
  TRAIT:     "trait",      // その竜の売り（脚質・二つ名・得意条件）
  FORM:      "form",       // 当日の気配（試走の出来）＝パドックに相当
  HISTORY:   "history",    // 自分とその竜の因縁（過去に当てた/外した）
  POPULARITY:"popularity"  // 人気の理由（新聞印・話題性・前走）
};

/**
 * 合間に挟む話題を集める。tau は持たせない（空いた時間に後段が差し込む）。
 * ★門番：伝承は図鑑で解禁済みのものだけ＝未解禁の物語を先に喋らない。
 */
function buildRaceTopics(timeline, ctx) {
  const out = [];
  const race = ctx.race || {};
  const add = (subject, id, data) => out.push({ kind: BEAT_KIND.TOPIC, subject, id: id || null, data: data || {} });

  // 場と条件（レース開始前〜序盤に効く）
  if (race.region) add(TOPIC_SUBJECT.VENUE, null, { region: race.region, cup: race.cup });
  try {
    const w = (typeof WEATHERS !== "undefined") && WEATHERS[race.weather];
    if (w) {
      const JP = { speed: "速さ", stamina: "底力", fire: "闘志", wing: "翼", turn: "旋回", nerve: "気性" };
      const top = Object.keys(w.weights || {}).sort((a, b) => w.weights[b] - w.weights[a]).slice(0, 2).map(k => JP[k] || k);
      add(TOPIC_SUBJECT.WEATHER, null, { label: w.label, stats: top });
    }
  } catch (e) {}
  try {
    const d = (typeof DISTANCE !== "undefined") && DISTANCE[race.distance];
    if (d) add(TOPIC_SUBJECT.DISTANCE, null, { label: d.label, mult: d.mult });
  } catch (e) {}
  ["early", "mid", "late"].forEach(k => {
    const s = beatSectionStats(race, k);
    if (s.label) { const win = k === "early" ? [0, 0.34] : k === "mid" ? [0.34, 0.67] : [0.67, 1];
      add(TOPIC_SUBJECT.TERRAIN, null, { phaseKey: k, label: s.label, stats: s.stats, terrain: s.terrain, win }); }
  });

  // 出走者の背景（1頭ずつ）
  const col = (state && state.player && state.player.collection) || {};
  for (const dr of (timeline.dragons || [])) {
    const d = dr.dragon || {};
    if (d.traits && d.traits.length) add(TOPIC_SUBJECT.TRAIT, dr.id, { traits: d.traits, style: dr.style, tone: d.portraitTone });
    if (d.newspaperMark || d.publicImage != null) {
      add(TOPIC_SUBJECT.POPULARITY, dr.id, { mark: d.newspaperMark, fame: d.publicImage, recent: d.recentResult });
    }
    // 伝承＝図鑑で解禁済みの断章だけ（未解禁の物語を先に漏らさない）
    try {
      const lv = (col[dr.id] && col[dr.id].loreLv) || 0;
      const lore = (typeof DRAGON_LORE !== "undefined") && DRAGON_LORE[dr.id];
      if (lv > 0 && lore && lore.length) add(TOPIC_SUBJECT.LORE, dr.id, { text: lore[Math.min(lv, lore.length) - 1] });
    } catch (e) {}
    // 当日の気配＝賭け画面で見せている試走の出来（パドックに相当）
    try {
      const tf = (ctx.trialForms || {})[dr.id];
      if (tf != null) add(TOPIC_SUBJECT.FORM, dr.id, { form: tf });
    } catch (e) {}
    // 自分とこの竜の因縁
    try {
      const rec = col[dr.id] && col[dr.id].records;
      if (rec && (rec.top3Seen || rec.betHit || rec.betMiss)) {
        add(TOPIC_SUBJECT.HISTORY, dr.id, { seen: rec.top3Seen || 0, hit: rec.betHit || 0, miss: rec.betMiss || 0 });
      }
    } catch (e) {}
  }
  return out;
}

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
                 rank: null, mag: mag == null ? 0.5 : mag,
                 pri: beatPri(kind),          // ★競合したときの強さ（勝敗＞抜いた抜かれた＞その他＞話題）
                 data: data || {} });
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
  // ★全頭・全順位を見る（上位4頭だけでは後方の攻防が丸ごと落ちる）。
  //   実況が拾える素材は多いほどよく、選ぶのは後段の仕事＝ここでは取りこぼさない。
  const STEP = 0.015;
  let prev = null;
  for (let tau = 0.08; tau <= 0.99; tau += STEP) {
    let st; try { st = timeline.standingsAt(tau); } catch (e) { break; }
    if (prev) {
      for (let i = 0; i < st.length; i++) {
        const id = st[i], now = i + 1, was = prev.indexOf(id) + 1;
        if (was > 0 && now < was) {
          // 前で起きた入れ替わりほど大きく扱う（mag が演出と言葉の熱量になる）
          const rankW = now <= 3 ? 1 : now <= 5 ? 0.7 : 0.45;
          push(tau, BEAT_KIND.OVERTAKE, id, Math.min(1, ((was - now) / 3) * rankW), { from: was, to: now });
        }
      }
      // 接戦＝隣り合う2頭が肉薄している。先頭だけでなく上位5組まで見る。
      for (let i = 0; i + 1 < Math.min(6, st.length); i++) {
        try {
          const a = timeline.progressAt(st[i], tau), b = timeline.progressAt(st[i + 1], tau);
          if (Math.abs(a - b) < 0.006) {
            push(tau, BEAT_KIND.BATTLE, st[i], i === 0 ? 0.9 : 0.55, { rival: st[i + 1], place: i + 1 });
          }
        } catch (e) {}
      }
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

  // ★間引きは「同じ竜の同じ話が連続で潰れる」最小限だけに留める（ユーザー決定：濃く）。
  //   レース中継は本来うるさいもので、接戦なら「まだ並んでる！」「離れない！」と
  //   繰り返し煽るのが自然。読み切れないぶんは流れてよい、と割り切る。
  //   ★初版で 35→16 まで削ったのは私の誤りだった。厚くする依頼に対して薄くしていた。
  // ★「抜いた抜かれた」は絶対に落とさない（ユーザー指定）。overtake は間引きの対象外にする。
  //   接戦のような“状態”だけ、同じ組み合わせが連続で潰れるぶんをまとめる。
  const NEVER_THIN = { overtake: true, goal: true, zoneIn: true, zoneOut: true };
  const COOLDOWN = { battle: 0.05, surge: 0.04, stumble: 0.03 };
  const lastAt = {};
  return beats.filter(b => {
    if (NEVER_THIN[b.kind]) return true;
    const cd = COOLDOWN[b.kind];
    if (!cd) return true;
    const key = b.kind + "|" + (b.id || "");
    if (lastAt[key] != null && b.tau - lastAt[key] < cd) return false;
    lastAt[key] = b.tau;
    return true;
  });
}

// =============================================================================
// buildBeatTelop — 台帳（出来事＋話題）を、実況／解説の2本の口に配る
// =============================================================================
// ★ここが「三つが織りなす」の結び目。竜の動きとエフェクトは、すでに同じ瞬間を
//   キャンバス側が自前で検知して弾けている（かわした！／仕掛けた！／画面揺れ）。
//   同じ出来事から言葉も生やすことで、揺れ・叫び・理由が同じ瞬間に重なる。
//
// ★読める速さの上限がある。出来事は毎レース90件以上あるが、全部を喋ると
//   1行0.5秒で流れて誰も読めない。そこで「間引く」のではなく「配る」：
//     ・実況と解説は別々の口＝それぞれ独立した間隔予算を持つ
//     ・勝敗と抜いた抜かれたは必ず実況の口へ（落とさない。詰まったら後ろへずらす）
//     ・それ以外は空いている口へ
//     ・どちらの口も長く黙ったら、そこへ話題を差し込む＝沈黙を知識で埋める
//   厚みは行数ではなく「毎行が今この瞬間の話である」ことから出る。
// =============================================================================
const TELOP_GAP_CALL  = 0.040;   // 実況の最短間隔（τ）。読める速さの下限。
const TELOP_GAP_COLOR = 0.052;   // 解説は一拍置く＝掛け合いに聞こえる。
const TELOP_QUIET     = 0.070;   // これだけ黙ったら話題を差す。
// ★最後の直線＝ここから先は「決着を争っている話」だけにする。
const FINAL_FROM      = 0.72;

// その出来事は、最後の直線で言う価値があるか。
//   言う  … 決着そのもの／自分の賭けの成否／自分が賭けた竜の話／上位争いの入れ替わりと競り合い
//   言わない … 下位の入れ替わり、場や豆知識の説明、人気や区間の解説
function isFinalWorthy(b, opts) {
  if (b.kind === "goal" || b.kind === "zoneIn" || b.kind === "zoneOut" || b.kind === "lastSpurt") return true;
  const mine = (opts && opts.betIds) || [];
  if (b.id && mine.includes(b.id)) return true;                 // 自分が賭けた竜は最後まで追う
  if (b.data && mine.includes(b.data.rival)) return true;
  const CONTEND = 4;                                            // 上位争い＝4番手以内
  if (b.kind === "overtake") return (b.data.to || 99) <= CONTEND;
  if (b.kind === "battle")   return (b.data.place || 99) <= CONTEND;
  if (b.kind === "surge" || b.kind === "collapse" || b.kind === "stumble") return false;
  return false;                                                 // 区間説明・人気・話題はここでは黙る
}

// 配列から決定的に1本選ぶ（同じレースを見直しても同じ台詞＝録画と食い違わない）。
function pickLine(arr, seed) {
  if (!arr || !arr.length) return null;
  return arr[Math.abs(seed | 0) % arr.length];
}
function fillLine(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : ""));
}

function buildBeatTelop(beats, topics, opts) {
  opts = opts || {};
  const nameOf = opts.nameOf || (id => id);
  const cmt = opts.commentator;
  const colorSet = (cmt && typeof COLOR_LINES !== "undefined") ? COLOR_LINES[cmt.key] : null;
  const out = [];
  let seed = 7;
  let lastCall = -1, lastColor = -1;

  // ★同じ台詞の連発を防ぐ。接戦が続くと「まだ並んでる」ばかりになり、
  //   実況が本当に薄く聞こえる（実測で発覚）。直近に言った文は使わない。
  const recent = { call: [], color: [] };
  const say = (tau, side, line, force) => {
    if (!line) return false;
    const key = side === "color" ? "color" : "call";
    // ★force＝勝敗と抜いた抜かれた。ここだけは重複でも言い切る。
    //   同じ言い回しが続く不格好さより、抜いた事実が消える害の方がはるかに大きい。
    if (!force && recent[key].includes(line)) return false;
    recent[key].push(line); if (recent[key].length > 3) recent[key].shift();
    // ★上限で潰さない。0.999 で頭打ちにすると複数行が同じ位置に重なり、
    //   間隔ゼロ＝一瞬で流れて読めなくなる（実測で発覚）。入らないなら言わない。
    if (tau > 0.995 && !force) return false;
    out.push({ tau: Math.max(0, tau), line, side, fired: false });
    if (key === "color") lastColor = tau; else lastCall = tau;
    return true;
  };

  const sorted = beats.slice().sort((a, b) => a.tau - b.tau);
  // ★「最後の直線」は決め打ちせず、台帳の lastSpurt から取る。
  //   定数で決めると実際の直線開始とズレ、「直線に入った！」が終盤の8番目に
  //   出るような順序の破綻が起きる（実測で発覚）。
  const _ls = sorted.find(b => b.kind === "lastSpurt");
  const finalFrom = _ls ? _ls.tau : FINAL_FROM;
  for (const b of sorted) {
    seed++;
    const vars = {
      n: b.id ? nameOf(b.id) : "", n2: b.data.rival ? nameOf(b.data.rival) : "",
      from: b.data.from, to: b.data.to, r: b.data.place || b.rank || "",
      label: b.data.label || "", s: (b.data.stats || []).join("と")
    };
    const mustKeep = b.pri >= 84;          // ①勝敗 と ②勝敗を分ける入れ替わり
    let tau = b.tau;
    // ★最後の直線では、決着を争っている話だけをする。
    //   ここで7番手→6番手の入れ替わりや豆知識を挟むと、いちばん見たい競り合いから
    //   目と耳が逸れる。実況が下位の説明をしないのは実際の中継でも同じ。
    if (tau >= finalFrom && !isFinalWorthy(b, opts)) continue;
    // ★連発防止で「抜いた」が黙らされては本末転倒。同じ文になりそうなら別の言い回しを探す。
    const freshFrom = (pool, sd, side) => {
      if (!pool || !pool.length) return null;
      for (let k = 0; k < pool.length; k++) {
        const cand = fillLine(pool[(Math.abs(sd | 0) + k) % pool.length], vars);
        if (!recent[side].includes(cand)) return cand;
      }
      return fillLine(pickLine(pool, sd), vars);
    };

    // --- 実況側 ---
    // ★ゴールだけは決着の「形」で言葉を変える（独走/大接戦/差し切り/大波乱/的中…）。
    let callPool = (typeof CALL_LINES !== "undefined") ? CALL_LINES[b.kind] : null;
    if (b.kind === "goal" && opts.goalSit && typeof GOAL_CALL !== "undefined") {
      callPool = GOAL_CALL[opts.goalSit] || GOAL_CALL.normal || callPool;
    }
    let spoke = false;
    if (callPool) {
      // ★「最後の直線！」は区切りの合図。ずらすと他の行の後ろへ回り、
      //   直線に入って9行目に「直線に入った！」と言う破綻が起きる（実測）。
      //   ここだけは必ずその時刻に、間隔を無視して置く。
      if (b.kind === "lastSpurt") {
        spoke = say(tau, "call", freshFrom(callPool, seed, "call"), true);
      } else if (tau - lastCall >= TELOP_GAP_CALL) {
        spoke = say(tau, "call", freshFrom(callPool, seed, "call"), mustKeep);
      } else if (mustKeep) {
        // ★落とさない。詰まっているだけなので、読める間隔まで後ろへずらして必ず言う。
        //   ただし「ずらした先」が最後の直線に食い込むなら、そこで下位の入れ替わりを
        //   喋ることになるので言わない（実測で7件も紛れ込んでいた）。
        const at = lastCall + TELOP_GAP_CALL;
        if (at < finalFrom || isFinalWorthy(b, opts)) {
          spoke = say(at, "call", freshFrom(callPool, seed, "call"), true);
        }
      }
    }

    // --- 解説側 ---
    let colorPool = colorSet && colorSet[b.kind];
    if (b.kind === "goal" && opts.goalSit && cmt && typeof GOAL_COLOR !== "undefined") {
      const gc = GOAL_COLOR[cmt.key];
      if (gc && gc[opts.goalSit]) colorPool = gc[opts.goalSit];
    }
    // ★間合いは「実況が実際に喋った時刻」で測る。詰まって後ろへずらした場合、
    //   ずらす前の時刻で測ると解説だけ過去に取り残され、掛け合いが痩せる（実測で発覚）。
    const atNow = spoke ? lastCall : tau;
    if (colorPool && atNow - lastColor >= TELOP_GAP_COLOR) {
      say(atNow + (spoke ? 0.012 : 0), "color", freshFrom(colorPool, seed * 3, "color"));
    }
  }

  // --- 沈黙へ話題を差し込む ---
  // 実況が黙っている区間を探し、そこへ「今日の場」「この竜の売り」を置く。
  if (topics && topics.length && typeof TOPIC_LINES !== "undefined") {
    const marks = out.filter(o => o.side === "call").map(o => o.tau).sort((a, b) => a - b);
    const gaps = [];
    let prev = 0.03;
    for (const m of marks.concat([1.0])) {
      if (m - prev >= TELOP_QUIET) gaps.push(prev + (m - prev) / 2);
      prev = m;
    }
    let ti = 0;
    const usedTopic = new Set();
    for (const g of gaps) {
      // ★その時刻に言って“事実として正しい”話題だけを選ぶ。
      //   地形の話題は自分の区間の中でしか言わない（実測で「大旋回を走りながら
      //   『ここは長直線スタート』」という嘘が出た）。一度使った話題も繰り返さない。
      let tp = null;
      for (let k = 0; k < topics.length; k++) {
        const cand = topics[(ti + k) % topics.length];
        if (usedTopic.has(cand)) continue;
        const w = cand.data && cand.data.win;
        if (w && (g < w[0] || g > w[1])) continue;
        tp = cand; ti = ti + k + 1; break;
      }
      if (g >= finalFrom) continue;   // ★最後の直線に豆知識は差さない
      if (!tp) continue;
      usedTopic.add(tp);
      const set = TOPIC_LINES[tp.subject];
      if (!set) continue;
      const d = tp.data || {};
      const vars = {
        n: tp.id ? nameOf(tp.id) : "", label: d.label || d.region || "",
        s: (d.stats || []).join("と"), t: (d.traits || [])[0] || "",
        mark: d.mark || "", f: d.form || "", seen: d.seen || 0, text: d.text || ""
      };
      // 話題も実況と解説の掛け合いで出す＝ひとりごとにしない
      say(g, "call", fillLine(pickLine(set.call, ti), vars));
      if (set.color && g - lastColor >= TELOP_GAP_COLOR) {
        say(g + 0.016, "color", fillLine(pickLine(set.color, ti * 5), vars));
      }
    }
  }

  return out.sort((a, b) => a.tau - b.tau);
}

// ゴールの決着の「形」を判定する。珍しい形ほど優先＝毎回同じ叫びにならない。
// ★純粋な観測。着順・配当には一切触れない（表示専用）。
function goalSituation(ctx, timeline) {
  const cr = (ctx.raceResult && ctx.raceResult.results) || [];
  if (!cr.length) return "normal";
  const w = cr[0], second = cr[1];
  const bet = ctx.bet, hit = ctx.betHit;
  try {
    // ★finishTau は timeline.dragons の各要素が持つ（メソッドではない）。
    const tauOf = (id) => {
      const d = (timeline.dragons || []).find(x => x.id === id);
      return d ? d.finishTau : null;
    };
    const t1 = tauOf(w.id), t2 = second ? tauOf(second.id) : null;
    if (t1 != null && t2 != null) {
      if (t2 - t1 < 0.006) return "photo";
      if (t2 - t1 > 0.055) return "runaway";
    }
  } catch (e) {}
  if (hit === true) return "hit";
  if (hit === false) {
    const sel = (bet && bet.selections) || [];
    if (cr.slice(1, 3).some(r => sel.includes(r.id))) return "nearMiss";
    return "miss";
  }
  try {
    const pr = (ctx.oddsResult.oddsData.find(o => o.dragonId === w.id) || {}).popularityRank;
    if (pr >= 5) return "upset";
    if (pr === 1) return "chalk";
  } catch (e) {}
  return "normal";
}
