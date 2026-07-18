// =========================================================================
// scout_engine.js — 竜スカウト「発見＆交渉」の純ロジック（表示専用メタ）
// =========================================================================
// 設計：docs/SCOUT_NEGOTIATION_DESIGN.md ／ データ：data_scout.js
//   ・ロケ段階開放／竜のロケ割当（決定的）
//   ・竜ごとの交渉ペルソナ（stats.nerve＋traits由来・決定的）
//   ・seeded PRNG（Math.random不使用＝再現可能・レース非干渉）
//   ・セッション（しぐさ抽選 rollGesture／判定 resolve／勝敗）
// ★着順/オッズ/配当には一切触れない。成立の払い出しは poro.js 側の既存処理。
// =========================================================================

// ── seeded PRNG（mulberry32・決定的） ───────────────────────────────────
function _scoutHash(str) {
  let h = 2166136261 >>> 0;
  str = String(str);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _scoutRand(sess) {                       // sess.rng を1ステップ進めて 0..1
  sess.rng = (sess.rng + 0x6D2B79F5) | 0;
  let t = sess.rng;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function _scoutPick(sess, arr) { return arr[Math.floor(_scoutRand(sess) * arr.length)] || arr[0]; }
function _scoutWPick(sess, pairs) {               // pairs=[[key,weight]...] → key
  let sum = 0; for (const p of pairs) sum += Math.max(0, p[1]);
  if (sum <= 0) return pairs[0][0];
  let r = _scoutRand(sess) * sum;
  for (const p of pairs) { r -= Math.max(0, p[1]); if (r <= 0) return p[0]; }
  return pairs[pairs.length - 1][0];
}

// ── ロケ開放（マスター＝2勝、その上に章/総資産で段階） ───────────────────
function _scoutTotalAssets() { return (state.player && state.player.totalAssets) || 0; }
function _scoutChap(flag) { return typeof getStoryFlag === "function" && getStoryFlag(flag); }
function scoutLocationUnlocked(locId) {
  if (typeof poroScoutUnlocked === "function" && !poroScoutUnlocked()) return false;  // マスター解放（2勝）
  const ta = _scoutTotalAssets();
  switch (locId) {
    case "grass": case "jungle": return true;                                   // 序盤＝マスター解放で開く
    case "cliff": return ta >= 30000 || _scoutChap("_chapter_intro_3");          // 第3話/3万
    case "volcano": case "sea": return ta >= 1000000 || _scoutChap("_chapter_intro_4"); // 第4話/100万
    case "sky": return ta >= 100000000 || _scoutChap("_chapter_intro_5");        // 終章/1億
  }
  return false;
}

// ── 竜→ロケ割当（決定的・テーマスコア最大の場が住処） ───────────────────
function _scoutDragonHay(d) {
  return [(d.arch || ""), (d.traits || []).join(" "), (d.name || ""), (d.tone || d.portraitTone || ""), (d.mark || ""), (d.hype || "")].join(" ");
}
function _scoutThemeScores(d) {
  const hay = _scoutDragonHay(d);
  // 名前・traits・archの元素キーワードでテーマ別スコア（決定的）。最大スコアの場が住処。
  return {
    sky:     (/天|空|鳳|嵐|雷|電|翔|月|星|煌|聖|蒼穹|羽/.test(hay) ? 4 : 0),                       // 空中＝荘厳・嵐・天空系（終盤）
    volcano: (/火|炎|灼|紅|煤|燻|焔|熱|魔|花/.test(hay) ? 4 : 0) + (/fire_bruiser|speed_escape/.test(hay) ? 1 : 0),
    sea:     (/潮|波|水|氷|凪|海|滴|泉|湖|雫|南風/.test(hay) ? 4 : 0) + (/wing_closer|翼|風/.test(hay) ? 2 : 0),
    cliff:   (/岩|山|甲|崑|豪|巌|牙|壁|重|鉱|鋼|耐久|頑丈/.test(hay) ? 4 : 0) + (/stamina_tank/.test(hay) ? 1 : 0),
    jungle:  (/霧|雲|雨|塵|夢|宵|叢|苔|蔦|森|角|眠|ふらり/.test(hay) ? 4 : 0) + (/fog_mystic|cloud_chaser|追込/.test(hay) ? 1 : 0),
    grass:   (/素直|技巧|小回|allrounder|turn_tech|草|芽|穂|なつ/.test(hay) ? 2 : 0) + 1            // +1＝受け皿（必ずどこかへ）
  };
}
function scoutDragonHome(d) {
  const sc = _scoutThemeScores(d);
  let best = "grass", bv = -1;
  // sky→volcano→sea→cliff→jungle→grass の優先順でタイ解決（決定的）
  ["sky", "volcano", "sea", "cliff", "jungle", "grass"].forEach(k => { if (sc[k] > bv) { bv = sc[k]; best = k; } });
  return best;
}
function _scoutAllDragons() {
  return (typeof DRAGONS !== "undefined" ? DRAGONS : []).filter(d => d && d.id !== "poro");
}
// ── 八竜ロスター（NARRATIVE_DESIGN §6-1）────────────────────────────────
// スカウト成立済みの竜を絆(affection)降順で個体データごと返す。読み取り専用＝
// collection/レース数値には一切触れない。終章の見参カットイン・走馬灯・集結VNが読む。
function scoutedRoster() {
  const col = (state.player && state.player.collection) || {};
  return Object.keys(col)
    .filter(id => col[id] && col[id].scouted && id !== "poro")
    .map(id => (typeof dragonById === "function") ? dragonById(id) : null)
    .filter(Boolean)
    .sort((a, b) => {
      const af = (typeof dragonAffection === "function") ? dragonAffection : function () { return 0; };
      return af(b.id) - af(a.id);
    });
}
function dragonsAtLocation(locId) { return _scoutAllDragons().filter(d => scoutDragonHome(d) === locId); }
function unscoutedAtLocation(locId) {
  const col = (state.player && state.player.collection) || {};
  return dragonsAtLocation(locId).filter(d => !(col[d.id] && col[d.id].scouted));
}

// ── 交渉ペルソナ（決定的・stats.nerve＋traits由来） ──────────────────────
function scoutPersona(d) {
  const nerve = (d && d.stats && d.stats.nerve != null) ? d.stats.nerve : 50;
  const tr = (d && d.traits || []).join("");
  const w = { intim: 1, guard: 1, anx: 1, curio: 1, amae: 1, play: 1, proud: 1, bored: 1, hungry: 1, sleepy: 1 };
  let fickle = 0, favCat = "身";
  if (nerve < 45) { w.intim += 2; w.guard += 2; }
  else if (nerve >= 70) { w.curio += 1; w.amae += 1; w.play += 1; }
  if (/気性難|難|火力/.test(tr)) { w.intim += 3; w.guard += 1; fickle += 1; favCat = "間"; }
  if (/素直|気性◎|気性安定|安定/.test(tr)) { w.curio += 2; w.amae += 1; favCat = "声"; }
  if (/華|本命|人気/.test(tr)) { w.proud += 3; favCat = "声"; }
  if (/眠|夢/.test(tr)) { w.sleepy += 3; favCat = "間"; }
  if (/渋い|地味|燻|煤/.test(tr)) { w.bored += 2; w.guard += 1; favCat = "贈"; }
  if (/ふらり|大穴|塵|雲/.test(tr)) { fickle += 2; w.curio += 1; w.bored += 1; }
  if (/快速|軽量|電光|疾風/.test(tr)) { w.play += 1; favCat = "遊"; }
  const wary0 = Math.max(10, Math.min(72, Math.round(30 + (50 - nerve) * 0.5 + (/気性難|難/.test(tr) ? 18 : 0))));
  return { wary0, weights: w, fickle, favCat, nerve };
}

// ── セッション ──────────────────────────────────────────────────────────
const SCOUT_TRUST_GOAL = 100;
const SCOUT_WARY_MAX = 100;
function createScoutSession(dragonId, locId) {
  const d = (typeof dragonById === "function") ? dragonById(dragonId) : null;
  const persona = scoutPersona(d || {});
  const seed = (_scoutHash(dragonId + "|" + (locId || "")) ^ Math.imul((state.player.completedRaces || 0) + 1, 2654435761)) >>> 0;
  const sess = {
    dragonId, locId, persona, rng: seed | 0,
    trust: 0, wary: persona.wary0, round: 0,
    mood: null, gesture: "", revealed: false, usedPaho: false,
    status: "go", history: []
  };
  scoutRollGesture(sess, true);
  return sess;
}
// 次のしぐさ＝心情を抽選（persona重み × wary/trust補正）＋しぐさ文を選ぶ。
function scoutRollGesture(sess, first) {
  const p = sess.persona, w = p.weights;
  const wary = sess.wary, trust = sess.trust;
  const pairs = SCOUT_MOOD_ORDER.map(m => {
    let x = w[m] || 0.2;
    if (m === "intim") x *= (1 + wary / 70);
    if (m === "guard") x *= (1 + wary / 100);
    if (m === "anx") x *= (1 + wary / 140);
    if (m === "amae") x *= (1 + trust / 70);
    if (m === "play") x *= (1 + trust / 110);
    if (m === "proud") x *= (1 + trust / 150);
    if (first && (m === "amae" || m === "play")) x *= 0.3;   // 初手から甘えは出にくく
    return [m, x];
  });
  sess.mood = _scoutWPick(sess, pairs);
  sess.gesture = _scoutPick(sess, SCOUT_MOODS[sess.mood].gestures);
  // fickle＝しぐさが心情と少しズレる（読みにくさ＝観察の価値）。表示文だけ別moodから借りる。
  sess.gestureMisread = false;
  if (!first && p.fickle > 0 && !sess.revealed && _scoutRand(sess) < (0.12 * p.fickle)) {
    const other = _scoutPick(sess, SCOUT_MOOD_ORDER);
    sess.gesture = _scoutPick(sess, SCOUT_MOODS[other].gestures);
    sess.gestureMisread = true;
  }
  return sess.mood;
}

// 交渉術を実行＝判定して trust/wary を更新。result を返す。
function scoutResolve(sess, approachId) {
  if (sess.status !== "go") return { outcome: "end", status: sess.status };
  const a = (typeof scoutApproach === "function") ? scoutApproach(approachId) : null;
  if (!a) return { outcome: "neutral", status: sess.status, trust: sess.trust, wary: sess.wary };
  const moodBefore = sess.mood;
  let outcome, dt = 0, dw = 0, reroll = true, reveal = false;

  if (a.special === "reveal") {
    outcome = "reveal"; dw = 1; reroll = false; reveal = true;          // 観察＝心情を明示・同じしぐさのまま
  } else if (a.special === "interpret") {
    outcome = "interpret"; dt = 4; dw = 0; reroll = false; reveal = true; // ポロ通訳＝読み＋微信頼
  } else if (a.special === "soothe") {
    if (sess.usedPaho) return { outcome: "spent", status: sess.status, trust: sess.trust, wary: sess.wary };
    sess.usedPaho = true; outcome = "soothe"; dt = 8; dw = -25;
  } else {
    if (a.helps.indexOf(moodBefore) >= 0) {
      const great = (a.cat === sess.persona.favCat);
      outcome = great ? "great" : "good"; dt = great ? 20 : 12; dw = -10;
    } else if (a.hurts.indexOf(moodBefore) >= 0) {
      outcome = "bad"; dt = -6; dw = 14;
    } else { outcome = "neutral"; dt = 3; dw = 2; }
  }

  sess.trust = Math.max(0, Math.min(SCOUT_TRUST_GOAL, sess.trust + dt));
  sess.wary = Math.max(0, Math.min(120, sess.wary + dw));
  sess.round++;
  sess.revealed = reveal;
  sess.history.push({ approach: a.id, mood: moodBefore, outcome });

  if (sess.trust >= SCOUT_TRUST_GOAL) sess.status = "win";
  else if (sess.wary >= SCOUT_WARY_MAX) sess.status = "lose";
  else sess.status = "go";

  if (sess.status === "go" && reroll) scoutRollGesture(sess, false);

  const bank = SCOUT_REACTIONS[outcome] || SCOUT_REACTIONS.neutral;
  const reactionText = (outcome === "reveal" || outcome === "interpret")
    ? `〔読み〕${SCOUT_MOODS[moodBefore].name}……${(SCOUT_MOODS[moodBefore].reads || [""])[0]}`
    : _scoutPick(sess, bank);
  return { outcome, status: sess.status, trust: sess.trust, wary: sess.wary, dt, dw, moodBefore, reactionText, great: outcome === "great" };
}

// 手札＝回転する通常術n枚（現心情の正解を必ず1枚含む）＋常設（観察／ぱほぱほ／ポロ通訳）。
function scoutHand(sess, n) {
  n = n || 5;
  const normal = SCOUT_APPROACHES.filter(a => !a.special);
  // シャッフル（決定的）
  const shuffled = normal.map(a => ({ a, k: _scoutRand(sess) })).sort((x, y) => x.k - y.k).map(o => o.a);
  const hand = shuffled.slice(0, n);
  // 現心情に効く術が手札に無ければ1枚差し替え（必ず正解が存在＝理不尽回避）
  if (sess.mood && !hand.some(a => a.helps.indexOf(sess.mood) >= 0)) {
    const fix = shuffled.find(a => a.helps.indexOf(sess.mood) >= 0);
    if (fix) hand[n - 1] = fix;
  }
  const extras = [scoutApproach("observe")];
  if (!sess.usedPaho) extras.push(scoutApproach("pahopaho"));
  if (typeof poroFound === "function" && poroFound()) extras.push(scoutApproach("interpret"));
  return { hand: hand.filter(Boolean), extras: extras.filter(Boolean) };
}

// ── 交渉メモ（学習・SCOUT_REBORN §B）───────────────────────────────────
// 竜ごとに「効いた技カテゴリ」を貯める＝次に会った時の攻略情報。表示専用メタ。
function scoutMemoGet(dragonId) {
  try { const e = poroColEntry(dragonId); return (e && e.memo) || []; } catch (err) { return []; }
}
function scoutMemoAdd(dragonId, cat) {
  try {
    const e = poroColEntry(dragonId); if (!e || !cat) return false;
    e.memo = e.memo || [];
    if (e.memo.indexOf(cat) >= 0) return false;
    e.memo.push(cat);
    if (typeof saveGame === "function") saveGame();
    return true;                                  // 新規記録＝UIで「メモした」演出
  } catch (err) { return false; }
}

// ── 手土産（1回だけの強カード・SCOUT_REBORN §B）─────────────────────────
// scoutResolve とは独立の関数＝既存の判定式には一切干渉しない。
function scoutGift(sess, isFav) {
  if (!sess || sess.status !== "go") return { outcome: "end" };
  if (sess.usedGift) return { outcome: "spent" };
  sess.usedGift = true;
  const dt = isFav ? 34 : 16, dw = isFav ? -30 : -14;
  sess.trust = Math.max(0, Math.min(SCOUT_TRUST_GOAL, sess.trust + dt));
  sess.wary = Math.max(0, Math.min(120, sess.wary + dw));
  sess.round++;
  sess.history.push({ approach: "gift", mood: sess.mood, outcome: isFav ? "great" : "good" });
  if (sess.trust >= SCOUT_TRUST_GOAL) sess.status = "win";
  else scoutRollGesture(sess, false);
  return { outcome: isFav ? "great" : "good", dt, dw, status: sess.status, isFav };
}

// ── 探索の適用（SCOUT_REBORN §A）───────────────────────────────────────
// probe に応じて「出会う竜」をずらし、初期警戒を補正したセッションを作る。
// 竜の選択は従来どおり決定的（_scoutTrips＋完走数）＋probe.ofs。
function scoutStartWithProbe(pool, locId, probe) {
  const base = ((state.player._scoutTrips || 0) + (state.player.completedRaces || 0));
  const idx = ((base + ((probe && probe.ofs) || 0)) % pool.length + pool.length) % pool.length;
  const d = pool[idx];
  const sess = createScoutSession(d.id, locId);
  if (probe && probe.wary) sess.wary = Math.max(6, Math.min(90, sess.wary + probe.wary));
  return { dragon: d, sess: sess };
}
// 小発見＝この地に棲む“別の未遭遇の竜”の名を知る（次に来る動機）。決定的。
function scoutProbeFind(sess, pool, meetId, probe) {
  if (!probe || !probe.find) return null;
  if (_scoutRand(sess) >= probe.find) return null;
  const others = pool.filter(d => d.id !== meetId);
  if (!others.length) return null;
  return _scoutPick(sess, others);
}
