// =========================================================================
// shingan_race.js — ☄️ 神眼レース（終章の最終イベント・M3・2026-07-30）
// =========================================================================
// 決裁（docs/ENDGAME_ECONOMY_REDESIGN.md 柱C＋ユーザー回答）：
//   ・解放＝第5話既読 ∧（総資産(到達最高)10億 ∨ 絶滅メーター押し切り(finalReady)）
//   ・出走＝固定8頭。**その竜のスカウトが必要**と明示し、スカウト成立後に育成（訓練）できる
//   ・訓練＝能力を上げ下げ両方できる（回数無制限・無料＝終盤はパズルに集中させる）
//   ・レース＝**能力だけで決まる決定的シミュレーション**（乱数なし。同じ能力→同じ結果）
//   ・クリア＝上位3頭のゴール差が 0.10秒以内（三頭同着）→ 絶滅の神眼を打ち破る
//     → 赤目ミミ → 走馬灯/八竜見参（既存演出流用）→ edFlag → エンディング
// ★賭け・オッズ・配当・既存レースエンジンには一切触れない独立モード（[[race-math-immutable]]）。
// パズルの核＝「3頭とも同じ数値」では揃わない：竜ごとの固定の得意/苦手（mult）と、
// 順位・差分に反応する“特性”（動的係数）が非線形の写像を作る。試走の着差を頼りに詰める。
// =========================================================================

// ── コース（5区間・合計3400m） ─────────────────────────────────────────
const SHINGAN_SEGS = [
  { id: "start", name: "ゲート",   ic: "🚪", len: 200 },
  { id: "flat",  name: "海岸平地", ic: "🌊", len: 1000 },
  { id: "climb", name: "火山登り", ic: "🌋", len: 800 },
  { id: "dive",  name: "峡谷降り", ic: "🪂", len: 800 },
  { id: "spurt", name: "最終直線", ic: "🏁", len: 600 }
];
const SHINGAN_ABL = ["出足", "地力", "登り", "降り", "末脚"];
const SHINGAN_TIE = 0.10;   // 同着の許容差（秒）＝クリア条件

// ── 固定8頭（全6ロケを跨ぐ＝スカウトが終盤の必須コンテンツ・人選はM3設計で確定） ──
//   mult＝生まれつきの得意/苦手（訓練で変わらない・区間係数）。quirk＝動的な特性（下の _sgQuirk）。
//   ab0＝初期能力（0..100）。★数値はこのモード内で完結＝レース本編のstatsとは独立。
const SHINGAN_ROSTER = [
  { id: "goka",   loc: "volcano", locName: "火山地帯", ic: "🌋",
    q: "業火の癇癪", qd: "直前の区間で順位を落とすと怒って速い（×1.08）。順位を上げると満足して緩む（×0.99）。",
    mult: [1, 1.02, 1.02, 1, 1], ab0: [55, 60, 52, 55, 58] },
  // 雷王＝速度94・逃げ。先頭に立っている間だけ伸び続ける＝**同着から最も遠い竜**。
  { id: "raiou",  loc: "sky",     locName: "空中",     ic: "⚡",
    q: "劫雷の先陣", qd: "先頭に立っている区間は雷を纏って加速（×1.06）。捕まると気落ちする（×0.95）。",
    mult: [1.08, 1.05, 1, 0.98, 0.94], ab0: [72, 68, 55, 52, 45] },
  { id: "souten", loc: "sky",     locName: "空中",     ic: "☁️",
    q: "王の余裕", qd: "2番手以内だと手を抜く（×0.98）。3番手以下だと本気を出す（×1.06）。",
    mult: [1, 1.02, 1, 1, 1.02], ab0: [65, 66, 60, 62, 64] },
  { id: "yomi",   loc: "sea",     locName: "水中",     ic: "🌊",
    q: "黄泉還り", qd: "前半（ゲート・平地）は眠い（×0.96）。降り以降でよみがえる（×1.07）。",
    mult: [0.96, 0.96, 1, 1.07, 1.07], ab0: [42, 50, 55, 66, 60] },
  { id: "phenix", loc: "sky",     locName: "空中",     ic: "🔥",
    q: "不死の翼", qd: "ゲートで出遅れる（×0.90）。最終直線で燃え上がる（×1.15）。",
    mult: [0.90, 1, 1, 1, 1.15], ab0: [40, 55, 48, 52, 72] },
  // 不岳＝持久94・鉄壁。★このレース唯一「クセを持たない」竜＝順位にも差にも一切反応しない。
  //   他の七頭が揺れる中で動かない基準点になるので、詰めるときの物差しとして機能する。
  { id: "fugaku", loc: "cliff",   locName: "崖",       ic: "🪨",
    q: "不動", qd: "順位にも差にも反応しない。登りは島いちばん（×1.14）、降りは苦手（×0.96）。",
    mult: [1, 1.03, 1.14, 0.96, 1], ab0: [52, 70, 72, 45, 52] },
  // 氷甲＝この八頭で唯一の「氷」。持久92・気性◎。★フガクと役割が被らないよう、
  //   フガク＝**自分が**動じない、グレイズ＝**周りを**動じさせない、と対にした。
  //   伝承「夏バテした子竜が寄りかかりに来る」「グレイズの複勝は、貯金」＝面倒見のいい兄貴分。
  { id: "glaze",  loc: "sea",     locName: "水中",     ic: "❄️",
    q: "氷甲の冷気", qd: "自分は順位にも差にも反応しない。前後0.8秒にいる他の竜のクセの振れ幅を半分にする（×0.5）。",
    mult: [1.02, 1.03, 1, 1.02, 0.96], ab0: [56, 68, 58, 60, 44] },
  // ★八頭目＝相棒のポロ。スカウトではなく「見つけた」竜なので解放条件だけ別扱い（下の shinganScouted）。
  //   正典の性格＝先行・気性安定・**複系狙い**（data_dragons.js: traits）。1着を獲りにいかず上位に
  //   食らいつく竜＝この舞台の主役にふさわしい。クセもそこから引いた。
  { id: "poro",   loc: "poro",    locName: "相棒",     ic: "💧",
    q: "涙の伴走", qd: "先頭との差が0.5秒以内なら泣きながら食らいつく（×1.07）。離されると心が折れる（×0.96）。",
    mult: [1.04, 1, 0.94, 1, 0.98], ab0: [58, 60, 44, 55, 50] }
];

// ── 状態（表示専用メタ・saveGameで永続） ─────────────────────────────────
function shinganData() {
  const p = state.player;
  if (!p.shingan) p.shingan = { ab: {}, intro: false, cleared: false, best: null, failShown: false };
  return p.shingan;
}
function shinganAb(id) {
  const d = shinganData();
  const r = SHINGAN_ROSTER.find(x => x.id === id);
  if (!d.ab[id]) d.ab[id] = r.ab0.slice();
  return d.ab[id];
}
function shinganScouted(id) {
  // ★ポロだけは「スカウト」ではなく物語で見つける相棒なので、判定が別（scoutedRoster も
  //   poro を明示的に除外している）。poroFound() が唯一の正。
  if (id === "poro") { try { return (typeof poroFound === "function") ? !!poroFound() : false; } catch (e) { return false; } }
  try { const e = (state.player.collection || {})[id]; return !!(e && e.scouted); } catch (e) { return false; }
}
function shinganAllScouted() { return SHINGAN_ROSTER.every(d => shinganScouted(d.id)); }
// 解放＝第5話既読 ∧（到達最高10億 ∨ メーター押し切り）
function shinganUnlocked() {
  try {
    const read5 = (typeof chapterRead === "function") ? chapterRead("5") : false;
    if (!read5) return false;
    const peak = (typeof assetsPeak === "function") ? assetsPeak(state) : 0;
    const fin = !!(state.player.epilogue && state.player.epilogue.finalReady);
    return peak >= ((typeof storyUnlockAt === "function" && storyUnlockAt("ED")) || 1000000000) || fin;
  } catch (e) { return false; }
}

// ── 決定的シミュレーション ────────────────────────────────────────────
function _sgRanks(cum) {
  const idx = cum.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rank = new Array(cum.length);
  idx.forEach((x, pos) => { rank[x[1]] = pos + 1; });
  return rank;
}
// 動的なクセ。★「引き離す側」と「合わせる側」が混在しているのがパズルの肝。
//   引き離す＝ライオウ(先頭で加速)・ゴウカ(抜かれると怒る)・ソウテン(後ろだと本気)
//   合わせる＝ポロ(先頭に食らいつく)
//   動かない＝フガク(自分が動じない＝物差し)・グレイズ(周りを動じさせない＝下の SG_CHILL)
function _sgQuirk(d, s, i, snap, rank, prevRank) {
  switch (d.id) {
    case "goka":   return (s === 0) ? 1 : (rank[i] > prevRank[i] ? 1.08 : (rank[i] < prevRank[i] ? 0.99 : 1));
    case "raiou":  return (s === 0) ? 1 : (rank[i] === 1 ? 1.06 : 0.95);
    case "souten": return (s === 0) ? 1 : (rank[i] <= 2 ? 0.98 : 1.06);
    // ★ポロ＝先頭に食らいついている間だけ伸びる。置いていかれると泣いて鈍る。
    //   先頭のタイムへ引き寄せる向きに働くので、同着を作る側の竜として素直に効く。
    case "poro": {
      if (s === 0) return 1;
      let lead = snap[0];
      for (let j = 1; j < snap.length; j++) if (snap[j] < lead) lead = snap[j];
      return (snap[i] - lead <= 0.5) ? 1.07 : 0.96;
    }
    default: return 1;   // ★フガク/グレイズ＝自分のクセ無し。ヨミ/フェニックスは mult だけ
  }
}
// ★グレイズ「氷甲の冷気」＝このレース唯一の“他の竜に効く”特性。
//   近く（前後0.8秒）にいる竜のクセの振れ幅を半分に鎮める。1.06→1.03、0.95→0.975 のように
//   1.0へ寄せるので、気性の荒い竜（ライオウ/ゴウカ/ソウテン）ほど大きく大人しくなる。
//   ＝「暴れる竜の隣にグレイズを置く」という手が生まれる＝同着を作るための道具になる。
//   伝承「夏バテした子竜が寄りかかりに来る」（data_dragon_lore.js: glaze）をそのまま機構にした。
const SG_CHILL_RANGE = 0.8, SG_CHILL_MUL = 0.5;
function _sgChill(q, i, glazeIdx, snap) {
  if (glazeIdx < 0 || i === glazeIdx) return q;
  if (Math.abs(snap[i] - snap[glazeIdx]) > SG_CHILL_RANGE) return q;
  return 1 + (q - 1) * SG_CHILL_MUL;
}
// abOv＝{id:[5つの能力]}（省略時は保存値）。乱数ゼロ＝同じ入力なら必ず同じ結果。
function shinganRun(abOv) {
  const R = SHINGAN_ROSTER;
  const ab = R.map(d => (abOv && abOv[d.id]) || shinganAb(d.id));
  const glazeIdx = R.findIndex(d => d.id === "glaze");   // 居なければ -1＝冷気なしで従来どおり
  const cum = R.map(() => 0);
  let prevRank = R.map(() => 1);
  const passLog = [];
  for (let s = 0; s < SHINGAN_SEGS.length; s++) {
    const snap = cum.slice();
    const rank = _sgRanks(snap);
    for (let i = 0; i < R.length; i++) {
      const m = R[i].mult[s] * _sgChill(_sgQuirk(R[i], s, i, snap, rank, prevRank), i, glazeIdx, snap);
      const v = (20 + ab[i][s] * 0.12) * m;
      cum[i] += SHINGAN_SEGS[s].len / v;
    }
    prevRank = rank;
    passLog.push(_sgRanks(cum).slice());
  }
  const rows = R.map((d, i) => ({ id: d.id, name: _sgName(d.id), ic: d.ic, time: cum[i] }))
    .sort((a, b) => a.time - b.time);
  rows.forEach((r, i) => { r.pos = i + 1; r.gap = r.time - rows[0].time; });
  const spread = rows[2].time - rows[0].time;
  return { rows, spread, clear: spread <= SHINGAN_TIE, passLog };
}
function _sgName(id) {
  try { const d = DRAGONS.find(x => x.id === id); if (d) return d.name; } catch (e) {}
  return id;
}

// ── ミミの予想（徹夜の赤い目）＝この画面の「気づき」の装置 ──────────────────
//   3つの買い方で同じレースを言い換えるだけ。ふつうは 1頭／2頭／3頭 と増えていく。
//   ★肝：1着に並ぶ頭数(lead)だけ、どの予想も広がる。
//     lead=1 … 単勝1・複勝2・ワイド3（ばらばら）
//     lead=2 … 単勝2・複勝2・ワイド3（単勝と複勝が一致しはじめる＝惜しい）
//     lead=3 … 単勝3・複勝3・ワイド3（三行が完全に一致＝もう誰にも決着が言えない）
//   答えを文章で説明せず、この「三行がそろう」画だけで気づかせる。
//   ★説明文は実際の頭数から作る。同着で頭数が増えたとき「この2頭」と書いてあるのに
//     3頭並ぶ、という嘘を出さないため。単勝が「1着に並ぶのはこの3頭」になる違和感が、
//     そのまま気づきの入口になる（仕組みは説明しない）。
const SG_BETS = [
  { k: "tan",  nm: "単勝予想",   sub: n => n === 1 ? "1着になるのはこの竜" : `1着に並ぶのはこの${n}頭` },
  { k: "fuku", nm: "複勝予想",   sub: n => `上位に来るのはこの${n}頭` },
  { k: "wide", nm: "ワイド予想", sub: n => `上位を占めるのはこの${n}頭` }
];
function _sgPredict(res) {
  const rows = res.rows, T = SHINGAN_TIE;
  let lead = 1;
  while (lead < rows.length && (rows[lead].time - rows[0].time) <= T) lead++;
  const take = n => rows.slice(0, Math.max(n, lead));
  return { lead, tan: take(1), fuku: take(2), wide: take(3) };
}
// 決着がどこまで割れているか。tie3＝ワイドすら決まらない＝賭けが成立しない＝勝利。
function _sgOutcome(res) {
  const rows = res.rows, T = SHINGAN_TIE;
  if ((rows[2].time - rows[0].time) <= T) return "tie3";
  if ((rows[1].time - rows[0].time) <= T) return "tie2";
  return "clean";
}
// ★VNの台詞に絵文字は入れない（口に出して読む文字ではないので、喋りが不自然になる）。
//   絵文字を使うのは画面の予想カードだけ。
function _sgList(arr) { return arr.map(r => r.name).join("、"); }
// セレスティアの宣言＝上位3頭を着順つきで。プレイヤーのどの買い方よりも厳しい予想なので、
// 「配当の大小」を比べる必要がなく（ワイドは単勝より当たりやすい＝比べると彼女が格下になる）、
// 素直に“彼女の方が上を当てた”が成立する。★同着に言及させない＝答えを先出ししない。
function _sgOrderCall(res) {
  return res.rows.slice(0, 3).map((r, i) => `${i + 1}着 ${r.name}`).join("、");
}
function _sgBetName(k) { const b = SG_BETS.find(x => x.k === k); return b ? b.nm.replace("予想", "") : "単勝"; }

// マクラの宣言コール。★声＝物語でのマクラ（「〜だぜ」「〜だァ！」の勢いのある実況）。
//   単勝なのに複数頭を読み上げることになったら、実況として必ず引っかかる＝そこを拾わせる。
//   （この時点でプレイヤーは既に同着を作っている＝これは“次の一手”のヒントではなく反応）
function _sgDeclareCall(kind, arr) {
  const nm = _sgList(arr), n = arr.length;
  if (kind === "tan") {
    return n === 1
      ? `さあ来たァ！ ミミちゃんの宣言——単勝、${nm}の一点だ！ この大舞台で一点勝負たァ、いい度胸だぜ！`
      : `さあ来たァ！ ミミちゃんの宣言——単勝、${nm}……ってオイ！ 単勝で${n}頭ってどういう了見だァ！？ そんな買い目、聞いたことねぇぞ！`;
  }
  if (kind === "fuku") return `さあ来たァ！ ミミちゃんの宣言——複勝、${nm}の${n}点だ！`;
  return `さあ来たァ！ ミミちゃんの宣言——ワイド、${nm}！ 上位まるごと指しやがったァ！`;
}

// ── 開発検証用ソルバ（山登り法・解の存在証明。UIからは呼ばない） ──────────
function _sgSolve(iters) {
  const cur = {}; SHINGAN_ROSTER.forEach(d => { cur[d.id] = d.ab0.slice(); });
  let best = shinganRun(cur).spread, bestAb = JSON.parse(JSON.stringify(cur));
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let k = 0; k < (iters || 20000); k++) {
    const d = SHINGAN_ROSTER[Math.floor(rnd() * 8)];
    const a = Math.floor(rnd() * 5);
    const step = [1, -1, 5, -5, 10, -10][Math.floor(rnd() * 6)];
    const old = cur[d.id][a];
    cur[d.id][a] = Math.max(0, Math.min(100, old + step));
    const sp = shinganRun(cur).spread;
    if (sp <= best + (rnd() < 0.1 ? 0.3 : 0)) {   // 焼きなましの緩い受理
      if (sp < best) { best = sp; bestAb = JSON.parse(JSON.stringify(cur)); }
    } else cur[d.id][a] = old;
    if (best <= SHINGAN_TIE * 0.6) break;
  }
  return { best, ab: bestAb };
}

// ── 開発用ショートカット（デバッグ盤／?go=shingan&dev=1 から呼ぶ） ───────────
//   終章まで実機で遊んで到達するのは現実的でないので、ゲートが要求するものだけを
//   最小限で満たす。ここで触るのは解放条件と能力表＝表示専用メタのみで、
//   レースの着順・オッズ・配当には一切触れない（[[race-math-immutable]]）。
//   ★replay:true で intro/cleared/failShown を戻す＝前口上から一枚絵まで通しで再確認できる。
function shinganDevUnlock(opts) {
  const o = opts || {}, p = state.player;
  // ① 第5話既読（chapterRead("5") が見る唯一のフラグ）
  if (typeof setStoryFlag === "function") setStoryFlag("_chapter_intro_5", true);
  // ② 到達最高資産＝ED解放額（assetsPeak は assetsPeak/totalAssets の大きい方）
  const need = (typeof storyUnlockAt === "function" && storyUnlockAt("ED")) || 1000000000;
  p.assetsPeak = Math.max(p.assetsPeak || 0, need);
  p.maxCoinsReached = Math.max(p.maxCoinsReached || 0, need);
  // ③ 8頭すべて出走可能に。★ポロだけはスカウトではなく物語フラグ（poroFound）が正。
  p.collection = p.collection || {};
  SHINGAN_ROSTER.forEach(d => {
    if (d.id === "poro") { if (typeof setStoryFlag === "function") setStoryFlag("poroFound", true); return; }
    p.collection[d.id] = Object.assign({}, p.collection[d.id], { scouted: true, seen: true });
  });
  // ④ 通しで見たいときは演出フラグを戻す
  const sg = shinganData();
  if (o.replay) { sg.intro = false; sg.cleared = false; sg.failShown = false; sg.best = null; }
  if (typeof saveGame === "function") saveGame();
  return { unlocked: shinganUnlocked(), allScouted: shinganAllScouted() };
}

// 能力表のプリセット。kind="tie" で同着解（クリア演出の確認用）、
// kind="near" で惜敗レンジ（敗北の一枚絵の確認用）。どちらも実行時にソルバで解くので、
// ロスターやクセを調整してもプリセットが古びない（実測：60000手で約60ms＝スマホでも即時）。
function shinganDevPreset(kind) {
  const sg = shinganData();
  SHINGAN_ROSTER.forEach(d => shinganAb(d.id));          // 未初期化を埋める
  const sol = _sgSolve(60000);
  if (kind !== "near") {
    sg.ab = JSON.parse(JSON.stringify(sol.ab));
    if (typeof saveGame === "function") saveGame();
    return { kind: "tie", spread: shinganRun(null).spread };
  }
  // 同着解を1目盛だけ崩して惜敗レンジ（0.15〜1.00秒）へ落とす＝「あと少し」を再現
  const ids = SHINGAN_ROSTER.map(d => d.id);
  for (let step = 1; step <= 6; step++) {
    for (const id of ids) for (let a = 0; a < 5; a++) for (const sign of [-1, 1]) {
      const ab = JSON.parse(JSON.stringify(sol.ab));
      ab[id][a] = Math.max(0, Math.min(100, ab[id][a] + sign * step * 5));
      sg.ab = ab;
      const sp = shinganRun(null).spread;
      if (sp >= 0.15 && sp <= SG_FAIL_AT) {
        if (typeof saveGame === "function") saveGame();
        return { kind: "near", spread: sp };
      }
    }
  }
  sg.ab = JSON.parse(JSON.stringify(sol.ab));             // 見つからなければ同着解のまま
  if (typeof saveGame === "function") saveGame();
  return { kind: "tie-fallback", spread: shinganRun(null).spread };
}

// ── UI ─────────────────────────────────────────────────────────────────
var _sgOpen = null;      // 訓練アコーディオンの開いている竜
var _sgLast = null;      // 直近の予想（＝決定的シミュレーションの結果）
var _sgChoice = null;    // 挑んだ買い方（"tan"/"fuku"/"wide"）

function renderShinganRace() {
  if (!shinganUnlocked()) {
    if (typeof showInfoPopup === "function") showInfoPopup("☄️ ？？？",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ視えない</b><small>第5話を読み、総資産10億（または絶滅メーターを押し切る）に届いた者だけが、この舞台に立てる。</small></div></div>`);
    if (state.ui.screen !== "home") renderHome();
    return;
  }
  const sg = shinganData();
  if (!sg.intro) { sg.intro = true; if (typeof saveGame === "function") saveGame(); _sgIntroVN(() => renderShinganRace()); return; }

  state.ui.screen = "shingan";
  const app = beginScreen();
  app.classList.add("sg-page");

  const head = el("div", "sg-head");
  head.innerHTML =
    `<div class="sg-title">☄️ 神眼レース</div>` +
    `<div class="sg-sub">決着の視える眼に、決着の無い結末を。</div>` +
    `<div class="sg-rule">スカウトしてきた<b>最高クラスの七頭</b>と、<b>相棒のポロ</b>。竜舎で説得して鍛え上げろ。<br>` +
    `徹夜の赤い目で、ミミはレース結果を<b>ある程度予想できる</b>。<br>` +
    `<b>セレスティアが当てられない組み合わせ</b>になったら、勝負を挑め。</div>`;
  app.appendChild(head);
  if (sg.cleared) app.appendChild(el("div", "sg-cleared", "👁️‍🗨️ 神眼は破られた — クリア済み（何度でも予想できます）"));

  // ── 8頭：スカウト状態と訓練 ──
  const allIn = shinganAllScouted();
  if (!allIn) app.appendChild(el("div", "sg-need", "🐲 出走には<b>8頭全員のスカウト</b>が必要です。足りない竜は各ロケーションで心を通わせてこよう。"));
  const list = el("div", "sg-list");
  SHINGAN_ROSTER.forEach(d => {
    const ok = shinganScouted(d.id);
    const card = el("div", "sg-card" + (ok ? "" : " locked") + (_sgOpen === d.id ? " open" : ""));
    const ab = shinganAb(d.id);
    let h =
      `<button class="sg-card-h">` +
      `<span class="sg-d-ic">${ok ? d.ic : "❔"}</span>` +
      `<span class="sg-d-tx"><b>${ok ? _sgName(d.id) : "？？？"}</b>` +
      `<small>${ok ? `${d.q} — ${d.qd}`
        : (d.id === "poro" ? "🔒 まだ出会っていない相棒（島のどこかで泣いている）"
                           : `🔒 この竜のスカウトが必要（${d.ic} ${d.locName}）`)}</small></span>` +
      `<span class="sg-d-ch">${ok ? (_sgOpen === d.id ? "▾" : "▸") : "▶"}</span></button>`;
    if (ok && _sgOpen === d.id) {
      h += `<div class="sg-train">` + SHINGAN_ABL.map((nm, k) =>
        `<div class="sg-ab"><span class="sg-ab-n">${nm}</span>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="-10">−10</button>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="-1">−1</button>` +
        `<b class="sg-ab-v">${ab[k]}</b>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="1">＋1</button>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="10">＋10</button></div>`).join("") +
        `</div>`;
    }
    card.innerHTML = h;
    const hd = card.querySelector(".sg-card-h");
    hd.onclick = ok
      ? () => { _sgOpen = (_sgOpen === d.id) ? null : d.id; renderShinganRace(); }
      : () => { if (d.id === "poro") { if (typeof renderHome === "function") renderHome(); }   // ポロはスカウト画面にいない
                else if (typeof renderScout === "function") renderScout(); };
    card.querySelectorAll(".sg-st").forEach(btn => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const a = shinganAb(btn.dataset.d);
        a[+btn.dataset.a] = Math.max(0, Math.min(100, a[+btn.dataset.a] + (+btn.dataset.s)));
        if (typeof saveGame === "function") saveGame();
        renderShinganRace();
      };
    });
    list.appendChild(card);
  });
  app.appendChild(list);

  // ── 予想する ──
  const runBtn = el("button", "sg-run" + (allIn ? "" : " off"), allIn ? "🔮 予想する（何度でも）" : "🔒 8頭そろったら予想できる");
  runBtn.onclick = allIn ? () => {
    _sgLast = shinganRun(null);
    _sgChoice = null;                     // 予想し直したら挑戦の選択はリセット
    renderShinganRace();
    try { if (window.Sfx) Sfx.play("nav"); } catch (e) {}
  } : () => {};
  app.appendChild(runBtn);

  if (_sgLast) {
    // ── ミミの予想（3つの買い方）＝タップで勝負を挑む ──
    const pr = _sgPredict(_sgLast);
    const box = el("div", "sg-pred");
    box.appendChild(el("div", "sg-pred-h", "🔮 ミミの予想 <small>——挑む買い方を選ぶ</small>"));
    SG_BETS.forEach(b => {
      const arr = pr[b.k];
      const btn = el("button", "sg-bet" + (_sgChoice === b.k ? " on" : ""),
        `<span class="sg-bet-n">${b.nm}</span>` +
        `<span class="sg-bet-d">${arr.map(r => `<i>${r.ic}</i>${r.name}`).join("")}</span>` +
        `<span class="sg-bet-s">${b.sub(arr.length)}</span>`);
      btn.onclick = () => _sgChallenge(b.k);
      box.appendChild(btn);
    });
    app.appendChild(box);

    // ── 走ってみた結果（着順・タイム・着差）＝同着を詰める唯一の手がかり ──
    const res = el("div", "sg-res");
    res.innerHTML = `<div class="sg-res-h">走らせてみた結果</div>` +
      _sgLast.rows.map(r =>
        `<div class="sg-row${r.pos <= 3 ? " top3" : ""}"><span class="p">${r.pos}着</span><span class="ic">${r.ic}</span>` +
        `<span class="n">${r.name}</span><span class="t">${_sgFmt(r.time)}</span>` +
        `<span class="g">${r.pos === 1 ? "—" : "+" + r.gap.toFixed(2)}</span></div>`).join("");
    app.appendChild(res);
  }

  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}
function _sgFmt(t) {
  const m = Math.floor(t / 60), s = (t - m * 60);
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}

// ── 前口上（初回のみ）：勝負の申し込み ───────────────────────────────────
//   ★ここで答え（＝三頭同着）は絶対に言わない。ミミは「あなたが勝てないことを証明する」としか
//     言わず、方法はプレイヤーが予想欄を見て自分で気づく（この画面の設計の核）。
function _sgIntroVN(done) {
  if (!(window.Dialogue && Dialogue.play)) { done(); return; }
  Dialogue.play([
    ["narrator", "夜明け前の聖龍レース場。最高クラスの八頭のための、最後のゲートが組まれていく。"],
    ["mimi", "セレスティアさん。今度の大レースで、わたしと勝負をしてください。", "default"],
    ["celestia", "いいけれど。……どんな勝負？", "default"],
    ["mimi", "この島が本当に強くて、あなたが勝てないことを証明する勝負です。", "default"],
    ["celestia", "いいよ。でも、私が勝てないなんてことは、たぶんないと思うよ。", "default"],
    ["celestia", "この賭場も、いいところだけど。……きっと、壊れちゃう。", "default"],
    ["mimi", "それでも。……わたしは、負けたくないんです。", "default"],
    ["celestia", "そう。楽しみだな。うん。", "default"],
    ["celestia", "——赤い目のウサギさん。私に、その魂を見せてみて。", "default"],
    // ★八頭目の発表＝この舞台のもうひとつの山。最高クラスが七頭、そして——
    ["makura", "出走表が出たぜェ！ 最高クラスが……七頭！ そんでもって、八頭目はァ——"],
    ["makura", "……は？ ポ、ポロ！？ あの泣き虫が、この大舞台にィ！？"],
    ["mimi", "……はい。ポロが、走りたいって。", "default"],
    ["celestia", "ふふ。……いいんじゃない。その子、いちばん人の隣にいるのが上手だもの。", "default"]
  ], { force: true }).then(done);
}

// ── 神眼レースの一枚絵（赤目ミミ）＝全画面カード。タップ／自動で閉じて次へ。 ──
//   kind="clear" → images/story/shingan_clear.webp（三頭同着＝ゲームクリア）
//   kind="fail"  → images/story/shingan_fail.webp （惜敗＝光は届いたが決着が生まれた）
//   ★画像が無い環境でも進行が止まらないよう、onerror でカードを閉じて先へ進める。
const SG_KV = {
  // ★キャプション修正（2026-07-31）：以前は「視るべき決着を失った」＝神眼が視られなかった、
  //   と書いていたが誤り。セレスティアの神眼は最後まで正確に視ている。彼女は**当てたうえで、
  //   引き分けを良しとしてあげた**（負けたのではなく、許した）。そこを取り違えない。
  clear: { img: "shingan_clear.webp", cap: "三頭同着。——絶滅の神眼は、その引き分けを良しとした。", sfx: "legendary", ms: 6200 },
  fail:  { img: "shingan_fail.webp",  cap: "届かない。——叫びは光になっても、決着は、生まれてしまう。", sfx: "streak",    ms: 5200 }
};
function _sgKeyVisual(kind) {
  const conf = SG_KV[kind] || SG_KV.clear;
  return new Promise(function (resolve) {
    var done = false;
    function close() {
      if (done) return; done = true;
      try { ov.classList.add("out"); } catch (e) {}
      setTimeout(function () { try { ov.remove(); } catch (e) {} resolve(); }, 420);
    }
    var ov = el("div", "sg-kv" + (kind === "fail" ? " fail" : ""));
    ov.innerHTML =
      '<div class="sg-kv-flash"></div>' +
      '<img class="sg-kv-img" alt="">' +
      '<div class="sg-kv-cap">' + conf.cap + '</div>' +
      '<div class="fin-skip">タップで進む ▶</div>';
    var img = ov.querySelector(".sg-kv-img");
    img.onerror = function () { close(); };                  // 画像未納品でも詰まらせない
    img.src = "images/story/" + conf.img;
    document.body.appendChild(ov);
    try { if (window.Sfx) Sfx.play(conf.sfx); } catch (e) {}
    ov.onclick = close;
    setTimeout(close, conf.ms);                              // 自動で先へ（長居させない）
  });
}

// ── 勝負を挑む＝この画面の山場 ─────────────────────────────────────────
//   ★誤解しないこと：**セレスティアの神眼は一度も曇らない**。最後まで正確に視ている。
//     彼女は当てたうえで、最後に**引き分けを良しとしてあげる**（負けたのではなく、許した）。
//     以前ここに「視力が三段階で崩れる」と書いていたのは私の誤読（2026-07-31 修正）。
//   台詞では同着にも決着にも触れさせず、盤面の変化だけを見せる＝答えはプレイヤーが自分で気づく。
//     clean … 着順まで完全に当てる（＝手も足も出ない）
//     tie2  … 一着が並ぶ。彼女は動じず「まだ視えるよ」＝あと一段だとプレイヤーが察する
//     tie3  … 三頭が並ぶ。掟により1.0倍の元返し＝勝敗が成立しない。彼女はそれを良しとする
const SG_FAIL_AT = 1.00;   // 一枚絵を出す「惜しい」の目安（上位3頭の差・秒）
function _sgChallenge(kind) {
  if (!_sgLast) return;
  _sgChoice = kind;
  const res = _sgLast, out = _sgOutcome(res), sg = shinganData();
  const pr = _sgPredict(res);
  const mine = _sgList(pr[kind]), betNm = _sgBetName(kind), order = _sgOrderCall(res);
  try { if (window.Sfx) Sfx.play("nav"); } catch (e) {}

  if (out === "tie3") { _sgClear(kind, mine, betNm); return; }

  const vn = [
    ["makura", _sgDeclareCall(kind, pr[kind])],
    ["celestia", `じゃあ私は、一着から三着まで。${order}。……順番も、この通り。`, "default"]
  ];
  if (out === "tie2") {
    vn.push(["narrator", "——ゲートが開く。八つの影が、火山へ、峡谷へ、最終直線へ。"]);
    vn.push(["makura", "ゴォォール！ ……お、おおっと！？ 一着が——二頭ォォ！ 写真判定、写真判定ィ！"]);
    vn.push(["makura", `二頭同着ゥゥ！ 一着が、決まらないィィ！`]);
    // ★仕組みは絶対に説明させない（「ワイドなら決まる」「三着までの顔ぶれ」等は
    //   次の一手を言葉で教えてしまう＝この画面の設計を殺す）。割れたことを認めて、
    //   それでも視えると言うだけ。あと一段という推測はプレイヤーに残す。
    vn.push(["celestia", "……あら。", "default"]);
    vn.push(["celestia", "ふふ。おもしろい子。——でも、まだ視えるよ。", "default"]);
    vn.push(["mimi", "……まだ。まだ、足りない。", "panic"]);   // sad は全衣装に無い＝404でsmileに落ちる
  } else {
    vn.push(["narrator", "——ゲートが開く。八つの影が、火山へ、峡谷へ、最終直線へ。"]);
    vn.push(["makura", `ゴォォール！ ${order}——寸分たがわず、宣言どおりだァ！`]);
    vn.push(["celestia", "同じ予想だったけど。……私は、負けてないね。", "default"]);
    vn.push(["celestia", "また何度でも挑戦してきていいよ。", "default"]);
    vn.push(["mimi", "……はい。まだ、終わりません。", "default"]);
  }

  // 一枚絵は一度だけ（毎回出すと挑戦のテンポを殺す）。tie2＝本当に手が届きかけた回を優先。
  const showArt = !sg.cleared && !sg.failShown && (out === "tie2" || res.spread <= SG_FAIL_AT);
  const runVN = () => {
    const back = () => { _sgChoice = null; renderShinganRace(); };
    if (window.Dialogue && Dialogue.play) Dialogue.play(vn, { force: true }).then(back); else back();
  };
  if (showArt) {
    sg.failShown = true;
    if (typeof saveGame === "function") saveGame();
    _sgKeyVisual("fail").then(runVN);
  } else runVN();
}

// ── クリア：赤目の同着 → 走馬灯/八竜（既存流用）→ edFlag → エンディング ────
function _sgClear(kind, mine, betNm) {
  const sg = shinganData();
  sg.cleared = true; sg.best = _sgLast ? _sgLast.spread : 0;
  if (typeof saveGame === "function") saveGame();
  const top3 = _sgLast ? _sgLast.rows.slice(0, 3).map(r => r.name).join("・") : "三頭";
  const order = _sgLast ? _sgOrderCall(_sgLast) : "";
  const vn = [
    ["makura", `さあ挑戦者の宣言だァ！ ミミ選手——「${betNm || "ワイド"}、${mine || top3}」ッ！`],
    ["celestia", `じゃあ私は、一着から三着まで。${order}。……順番も、この通り。`, "default"],
    ["narrator", "——ゲートが開く。八つの影が、火山へ、峡谷へ、最終直線へ。"],
    ["makura", "ゴォォール！ ……えっ。えっ！？ しゃ、写真判定！ 写真判定ンンン！！"],
    ["makura", "さ、三頭同着ォォォ！？ 神兎大レース史上、初ゥゥゥ！！"],
    ["narrator", `${top3}。三頭の鼻先は、寸分の狂いなく、同じ線の上にあった。`],
    ["celestia", "…………すごい。", "default"],
    ["celestia", "同着ってことは、払い戻しだね。", "default"],
    ["celestia", "私、勝てなかったよ。", "default"],
    ["mimi", "……っ、はぁ。……はぁ。", "happy"],
    ["celestia", "この賭場も、貴方の魂も。……見せてもらえたね。", "default"],
    ["narrator", "絶滅の神眼は、決着なき決着の前に——静かに、閉じた。"]
  ];
  const toEnd = () => {
    if (typeof epilogueClear === "function") epilogueClear();
    else { const e = state.player.epilogue || (state.player.epilogue = {}); e.edFlag = true; if (typeof saveGame === "function") saveGame(); }
    if (window.Ending && Ending.play) Ending.play(); else renderHome();
  };
  const afterShow = () => {
    if (typeof playEightDragonsCutin === "function") playEightDragonsCutin().then(toEnd); else toEnd();
  };
  const runShow = () => {
    if (typeof playFinalShowcase === "function") playFinalShowcase().then(afterShow); else afterShow();
  };
  // 一枚絵（赤目ミミ）→ 同着VN → 走馬灯 → 八竜 → ED
  _sgKeyVisual("clear").then(() => {
    if (window.Dialogue && Dialogue.play) Dialogue.play(vn, { force: true }).then(runShow);
    else runShow();
  });
}

if (typeof window !== "undefined") {
  window.renderShinganRace = renderShinganRace;
  window.shinganUnlocked = shinganUnlocked;
  window.shinganRun = shinganRun;
  window._sgSolve = _sgSolve;
  window.shinganDevUnlock = shinganDevUnlock;
  window.shinganDevPreset = shinganDevPreset;
}
