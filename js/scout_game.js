// =============================================================================
// scout_game.js — 竜スカウトの遊び本体（話しかけ → ダンス）
// =============================================================================
// ★なぜ作り直したか
//   旧実装は「しぐさを読む → 手札から正しい交渉術を選ぶ」の繰り返しだった。
//   これはクイズであってゲームではない。押す前に答えが決まっていて、
//   指の動きにも間合いにも意味が無い（ユーザー指摘「選ぶだけはマジでゲームじゃない」）。
//   設計は docs/SCOUT_GAME_REDESIGN.md。
//
// ★遊びの骨格
//   フェーズ1「話しかけ」…竜がふと向いた方向＝いま気が向いている方向。
//     十字キーの同じ方向を、窓が閉じる前に押す。押せれば話が刺さって興味が上がる。
//     フェイント・飽き・加速・竜ごとの好みで、読みと反応が要る勝負にする。
//   フェーズ2「ダンス」…興味が満ちたら、流れてくるステップをタイミングで打つ。
//     出来が良ければ成立、悪ければ興ざめして決裂。
//
// ★このファイルの約束
//   ・レースの着順/オッズ/配当には一切触らない（表示専用メタ）
//   ・判定と抽選は純関数に切り出す（画面なしでNodeから検証できるように）
//   ・画面を離れたらループは必ず自分で止まる（固まると成立も決裂もできなくなる）
// =============================================================================

// ── 方向 ────────────────────────────────────────────────────────────────
// 十字キーの4方向。竜の動きと1対1で対応する。
const SG_DIRS = ["up", "right", "down", "left"];
const SG_DIR_JA = { up: "うえ", right: "みぎ", down: "した", left: "ひだり" };

// ── 難度の目盛り ────────────────────────────────────────────────────────
// ★数字はここに集約する。画面側に散らすと調整のたびに探し回ることになる。
const SG_TUNE = {
  windowMs0: 1250,      // チャンス窓の長さ（開始時）
  windowMsMin: 620,     // 興味が満ちる頃の窓（ここまで短くなる＝後半は難しい）
  gapMs0: 780,          // 次に竜が向くまでの間（開始時）
  gapMsMin: 420,        // 同（終盤）
  feintMs: 340,         // フェイントの見せ時間（これだけで引っ込む）
  feintRate0: 0.10,     // フェイント率（気まぐれで増える）
  hitTrust: 11,         // 刺さったときの興味
  favBonus: 6,          // 好みのジャンルなら上乗せ
  boreStep: 0.45,       // 同じジャンルを続けたときの減衰（1回ごとに掛かる）
  missTrust: -4,        // 押し間違い／逃したときの興味
  missWary: 9,          // 同・警戒
  feintWary: 6,         // フェイントに釣られたときの警戒
  danceSteps: 12,       // ダンスのステップ数
  danceFallMs0: 1500,   // ステップが降りてくる時間（前半）
  danceFallMsMin: 900,  // 同（終盤・加速する）
  hitGreatMs: 130,      // ピッタリの判定幅（前後）
  hitGoodMs: 300,       // おしいの判定幅
  danceClear: 0.5       // 成立に必要な出来（great=1.0 good=0.5 の平均）
                        // ★「全部おしい」＝全ノート拾えたら通す線にしてある。
                        //   ここまで来るのに話しかけを10手以上こなしているので、
                        //   拾い切ったのに落とすのは酷。精度は結果文で称える。
};

// ── 純ロジック（画面なしで動く） ────────────────────────────────────────

// 竜が次に向く方向と、それが本気かフェイントかを決める。
// ★同じ方向が続くと読みが単調になるので、直前と同じ方向は出にくくする。
function sgRollTurn(sess, prevDir) {
  const r = (typeof _scoutRand === "function") ? _scoutRand(sess) : Math.random();
  const cand = SG_DIRS.filter(d => d !== prevDir);
  const dir = cand[Math.floor(r * cand.length)] || SG_DIRS[0];
  const fickle = (sess && sess.persona && sess.persona.fickle) || 0;
  const fr = SG_TUNE.feintRate0 + fickle * 0.07;
  const r2 = (typeof _scoutRand === "function") ? _scoutRand(sess) : Math.random();
  return { dir, feint: r2 < fr };
}

// 興味の進み具合（0→1）。窓の長さと竜の動く速さがこれで決まる。
function sgProgress(sess) {
  const goal = (typeof SCOUT_TRUST_GOAL !== "undefined") ? SCOUT_TRUST_GOAL : 100;
  return Math.max(0, Math.min(1, (sess.trust || 0) / goal));
}
function sgWindowMs(sess) {
  const p = sgProgress(sess);
  return Math.round(SG_TUNE.windowMs0 + (SG_TUNE.windowMsMin - SG_TUNE.windowMs0) * p);
}
function sgGapMs(sess) {
  const p = sgProgress(sess);
  return Math.round(SG_TUNE.gapMs0 + (SG_TUNE.gapMsMin - SG_TUNE.gapMs0) * p);
}

// この竜が好むジャンル。persona.favCat（交渉術のカテゴリ）から素直に割り当てる。
// ★新しい対応表を作らない。既にある性格づけを使い回して、竜ごとの違いを出す。
const SG_FAV_BY_CAT = { "身": "tabi", "声": "uwasa", "間": "sora", "贈": "gohan",
                        "真似": "tabi", "遊": "sora", "技": "uwasa" };
function sgFavGenre(sess) {
  const cat = (sess && sess.persona && sess.persona.favCat) || "身";
  return SG_FAV_BY_CAT[cat] || "sora";
}

// 話しかけの判定＝この一手で興味と警戒がどう動くか。
//   kind: "hit"（窓の内に正しい方向）/ "wrong"（違う方向）/ "late"（逃した）/ "feint"（釣られた）
// ★純関数。sess を書き換えず、変化量だけ返す。画面側が反映する。
function sgJudgeTalk(sess, kind, genre, recentGenres) {
  const out = { dt: 0, dw: 0, fav: false, bored: 0 };
  if (kind === "hit") {
    const fav = (genre === sgFavGenre(sess));
    // 直近で同じジャンルを何回使ったか＝飽き
    const bore = (recentGenres || []).filter(g => g === genre).length;
    const mul = Math.pow(SG_TUNE.boreStep, Math.max(0, bore - 1));
    out.dt = Math.round((SG_TUNE.hitTrust + (fav ? SG_TUNE.favBonus : 0)) * mul);
    out.dw = -Math.round(2 + (fav ? 2 : 0));
    out.fav = fav; out.bored = bore;
  } else if (kind === "feint") {
    out.dt = Math.round(SG_TUNE.missTrust * 0.5);
    out.dw = SG_TUNE.feintWary;
  } else {
    out.dt = SG_TUNE.missTrust;
    out.dw = SG_TUNE.missWary;
  }
  return out;
}

// ダンスの判定＝押した時刻と、そのステップの本来の時刻とのズレ（ミリ秒）から。
function sgJudgeStep(deltaMs) {
  const a = Math.abs(deltaMs);
  if (a <= SG_TUNE.hitGreatMs) return { key: "great", score: 1.0, label: "ピッタリ！" };
  if (a <= SG_TUNE.hitGoodMs) return { key: "good", score: 0.5, label: "おしい！" };
  return { key: "miss", score: 0, label: "ミス…" };
}

// ダンスの譜面を作る。★終盤ほど速く、たまに間を飛ばす（フェイント）。
function sgBuildChart(sess) {
  const n = SG_TUNE.danceSteps;
  const chart = [];
  let t = 900;                                   // 最初の1歩までの助走
  let prev = null;
  for (let i = 0; i < n; i++) {
    const p = i / Math.max(1, n - 1);
    const fall = Math.round(SG_TUNE.danceFallMs0 + (SG_TUNE.danceFallMsMin - SG_TUNE.danceFallMs0) * p);
    const r = (typeof _scoutRand === "function") ? _scoutRand(sess) : Math.random();
    const cand = SG_DIRS.filter(d => d !== prev);
    const dir = cand[Math.floor(r * cand.length)] || SG_DIRS[0];
    prev = dir;
    chart.push({ i, dir, at: t, fall });
    // 拍の間隔。終盤は詰まる。ときどき一拍おいて「溜め」を作る（単調さ避け）
    const r2 = (typeof _scoutRand === "function") ? _scoutRand(sess) : Math.random();
    const beat = Math.round(fall * 0.52);
    t += (r2 < 0.16) ? Math.round(beat * 1.7) : beat;
  }
  return chart;
}

// ダンスの総合成績→成立かどうか。
function sgDanceResult(scores) {
  const n = scores.length || 1;
  const sum = scores.reduce((a, b) => a + b, 0);
  const rate = sum / n;
  return { rate, ok: rate >= SG_TUNE.danceClear };
}

// Node からも使えるように（検証用）
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SG_DIRS, SG_TUNE, sgRollTurn, sgJudgeTalk, sgJudgeStep,
                     sgBuildChart, sgDanceResult, sgWindowMs, sgGapMs, sgFavGenre };
}

// =============================================================================
// ここから下は画面側。ループを回して竜を動かし、入力を受ける。
// =============================================================================
// ★再描画で作り直さないこと。1手ごとに画面全体を描き直すとループが止まり、
//   竜の動きが途切れて手ざわりが死ぬ。ここは「その場で書き換える」方式にする。

let _sgRun = null;      // 進行中のゲーム（1つだけ）。画面を離れたら必ず止める。

function sgStop() {
  if (_sgRun) { _sgRun.dead = true; _sgRun = null; }
  try { document.removeEventListener("keydown", _sgKey); } catch (e) {}
}
function _sgKey(ev) {
  const m = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left" };
  const d = m[ev.key]; if (!d || !_sgRun) return;
  ev.preventDefault();
  sgPress(d);
}
const _sgNow = () => (window.performance && performance.now) ? performance.now() : Date.now();

// ── 組み立て：話しかけフェーズの器を作って回しはじめる ──────────────────
function sgMountTalk(host, sess, d, onWin, onLose) {
  sgStop();
  const wrap = document.createElement("div");
  wrap.className = "sg-wrap";
  const dirs = SCOUT_TOPIC_DIRS;
  wrap.innerHTML =
    `<div class="sg-say" id="sg-say">竜のうごきを見て、その向きの話をしてあげよう。</div>` +
    `<div class="sg-pad">` +
      SG_DIRS.map(k => {
        const t = dirs[k];
        return `<button class="sg-key sg-${k}" data-dir="${k}" style="--kc:${t.color}">` +
               `<span class="sg-key-ic">${t.ic}</span><b>${t.name}</b></button>`;
      }).join("") +
      `<div class="sg-pad-mid" id="sg-mid">👀</div>` +
    `</div>`;
  host.appendChild(wrap);

  const run = {
    dead: false, phase: "talk", sess: sess, d: d,
    dir: null, feint: false, openAt: 0, closeAt: 0, answered: true,
    recentGenres: [], recentTexts: [], onWin: onWin, onLose: onLose,
    host: host, wrap: wrap, hits: 0, misses: 0
  };
  _sgRun = run;
  wrap.querySelectorAll(".sg-key").forEach(b => {
    b.onclick = () => sgPress(b.getAttribute("data-dir"));
  });
  document.addEventListener("keydown", _sgKey);
  _sgNextTurn(320);
  return wrap;
}

function _sgSay(text, cls) {
  const e = document.getElementById("sg-say"); if (!e) return;
  e.className = "sg-say" + (cls ? " " + cls : "");
  e.innerHTML = text;
}
function _sgLean(dir) {
  const w = document.querySelector(".sc-drg-wrap"); if (!w) return;
  SG_DIRS.forEach(k => w.classList.remove("sg-lean-" + k));
  if (dir) w.classList.add("sg-lean-" + dir);
}
function _sgLight(dir, on) {
  const b = document.querySelector('.sg-key[data-dir="' + dir + '"]');
  if (b) b.classList.toggle("on", !!on);
}
function _sgClearLights() { SG_DIRS.forEach(k => _sgLight(k, false)); }

// ── 竜が次に向く ────────────────────────────────────────────────────────
function _sgNextTurn(delay) {
  const run = _sgRun; if (!run || run.dead) return;
  setTimeout(() => {
    if (!_sgRun || _sgRun !== run || run.dead) return;
    // ★ダンスに移ったら話しかけの予約は捨てる。
    //   これが無いと2つのループが同時に走り、裏で「間に合わなかった」判定が
    //   積もって警戒が満タンになる（ダンスを全部ピッタリで決めても決裂した）。
    if (run.phase !== "talk") return;
    if (!run.wrap.isConnected) { sgStop(); return; }   // 画面を離れた＝自停止
    const t = sgRollTurn(run.sess, run.dir);
    run.dir = t.dir; run.feint = t.feint; run.answered = false;
    run.openAt = _sgNow();
    const win = t.feint ? SG_TUNE.feintMs : sgWindowMs(run.sess);
    run.closeAt = run.openAt + win;
    _sgLean(t.dir); _sgLight(t.dir, true);
    const mid = document.getElementById("sg-mid");
    if (mid) mid.textContent = SCOUT_TOPIC_DIRS[t.dir].ic;
    // 窓が閉じる
    setTimeout(() => {
      if (!_sgRun || _sgRun !== run || run.dead) return;
      if (run.phase !== "talk") return;   // ダンス中なら何もしない（同上）
      _sgLean(null); _sgClearLights();
      if (mid) mid.textContent = "👀";
      if (run.answered) return;
      run.answered = true;
      if (t.feint) {                       // フェイントは放っておくのが正解
        _sgSay("……竜はすぐ目をそらした。<i>（今のは、ひっかけ）</i>", "sg-say--calm");
        _sgNextTurn(sgGapMs(run.sess));
      } else {
        _sgApply("late", null);
      }
    }, win);
  }, delay);
}

// ── 押された ────────────────────────────────────────────────────────────
function sgPress(dir) {
  const run = _sgRun; if (!run || run.dead) return;
  if (run.phase === "dance") { _sgDancePress(dir); return; }
  if (run.answered) return;                 // 窓が閉じている間の連打は無反応
  run.answered = true;
  _sgLean(null); _sgClearLights();
  if (run.feint) { _sgApply("feint", dir); return; }
  _sgApply(dir === run.dir ? "hit" : "wrong", dir);
}

// 判定を反映して、次のターンへ。
function _sgApply(kind, dir) {
  const run = _sgRun; if (!run || run.dead) return;
  if (run.phase !== "talk") return;   // ダンス中に話しかけの判定を通さない
  const sess = run.sess;
  const genre = dir ? SCOUT_TOPIC_DIRS[dir].g : null;
  const j = sgJudgeTalk(sess, kind, genre, run.recentGenres);
  sess.trust = Math.max(0, Math.min(SCOUT_TRUST_GOAL, sess.trust + j.dt));
  sess.wary = Math.max(0, Math.min(SCOUT_WARY_MAX, sess.wary + j.dw));

  if (kind === "hit") {
    run.hits++;
    run.recentGenres.push(genre); if (run.recentGenres.length > 3) run.recentGenres.shift();
    const tp = (typeof scoutTopicPick === "function") ? scoutTopicPick(genre, run.recentTexts) : null;
    if (tp) { run.recentTexts.push(tp.t); if (run.recentTexts.length > 8) run.recentTexts.shift(); }
    const tail = j.fav ? `<i class="sg-fav">✨ この子、この話が大好きみたい！</i>`
               : (j.bored >= 2 ? `<i class="sg-bore">……その話は、さっきも聞いたかも</i>` : "");
    _sgSay(`「${tp ? tp.t : "……ねえ、聞いて。"}」${tail}`, "sg-say--hit");
    try { if (window.Sfx) Sfx.play(j.fav ? "legendary" : "coin"); } catch (e) {}
  } else if (kind === "feint") {
    run.misses++;
    _sgSay("あっ……竜はもう、そっぽを向いていた。", "sg-say--miss");
    try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
  } else if (kind === "wrong") {
    run.misses++;
    _sgSay("竜は不思議そうに首をかしげた。<i>（向きが、ちがった）</i>", "sg-say--miss");
    try { if (window.Sfx) Sfx.play("click"); } catch (e) {}
  } else {
    run.misses++;
    _sgSay("……間に合わなかった。竜の気が、それてしまう。", "sg-say--miss");
  }
  _sgSyncMeters(j.dt, j.dw);

  if (sess.wary >= SCOUT_WARY_MAX) { sess.status = "lose"; sgStop(); run.onLose(); return; }
  if (sess.trust >= SCOUT_TRUST_GOAL) { _sgToDance(); return; }
  _sgNextTurn(sgGapMs(sess));
}

// メーターをその場で書き換える（全体再描画をしない）。
function _sgSyncMeters(dt, dw) {
  const run = _sgRun; if (!run) return;
  const set = (cls, val, max) => {
    // ★バーの中身は .sc-meter-t > i（既存の作り）。ここを取り違えると
    //   ゲージが動かないのに気づきにくい。
    const bar = document.querySelector("." + cls + " .sc-meter-t > i");
    if (bar) bar.style.width = Math.max(0, Math.min(100, Math.round(val / max * 100))) + "%";
  };
  set("sc-trust", run.sess.trust, SCOUT_TRUST_GOAL);
  set("sc-wary", run.sess.wary, SCOUT_WARY_MAX);
  const w = document.querySelector(".sc-drg-wrap");
  if (w) {   // 警戒が下がるほど竜が近づいて見える（既存の距離演出を使う）
    w.classList.remove("sc-far", "sc-mid", "sc-near");
    w.classList.add(run.sess.wary >= 55 ? "sc-far" : (run.sess.wary >= 28 ? "sc-mid" : "sc-near"));
  }
}

// ── フェーズ2：ダンス ───────────────────────────────────────────────────
// 興味が満ちた＝竜が体を揺らしはじめた。ここで一緒に踊りに持ち込む。
// 流れてくるステップが判定ラインに重なった瞬間に、同じ方向を押す。
function _sgToDance() {
  const run = _sgRun; if (!run || run.dead) return;
  run.phase = "dance";
  _sgLean(null); _sgClearLights();
  _sgSay("竜が、ゆらり……と体を揺らしはじめた。<b>いっしょに踊ろう！</b>", "sg-say--dance");
  const w = document.querySelector(".sc-drg-wrap"); if (w) w.classList.add("sg-dancing");

  // 器をダンス用に差し替える（十字キーはそのまま使う＝操作を変えない）
  const wrap = run.wrap;
  const old = wrap.querySelector(".sg-lane"); if (old) old.remove();
  const lane = document.createElement("div");
  lane.className = "sg-lane";
  lane.innerHTML =
    `<div class="sg-lane-line"></div>` +
    SG_DIRS.map(k => `<div class="sg-col" data-col="${k}"></div>`).join("") +
    `<div class="sg-judge" id="sg-judge"></div>` +
    `<div class="sg-combo" id="sg-combo"></div>`;
  wrap.insertBefore(lane, wrap.querySelector(".sg-pad"));

  run.chart = sgBuildChart(run.sess);
  run.scores = [];
  run.combo = 0; run.best = 0;
  run.t0 = _sgNow();
  run.notes = run.chart.map(n => {
    const e = document.createElement("div");
    e.className = "sg-note sg-note-" + n.dir;
    e.innerHTML = SCOUT_TOPIC_DIRS[n.dir].ic;
    e.style.setProperty("--nc", SCOUT_TOPIC_DIRS[n.dir].color);
    lane.querySelector('.sg-col[data-col="' + n.dir + '"]').appendChild(e);
    return { n: n, el: e, done: false };
  });
  _sgDanceTick();
}

function _sgDanceTick() {
  const run = _sgRun; if (!run || run.dead || run.phase !== "dance") return;
  if (!run.wrap.isConnected) { sgStop(); return; }   // 画面を離れた＝自停止
  const t = _sgNow() - run.t0;
  let remaining = 0;
  run.notes.forEach(o => {
    if (o.done) return;
    remaining++;
    const dt = o.n.at - t;                    // 判定時刻までの残り
    // 落下：fall ミリ秒かけて上から判定ラインへ。0で線上、負で通り過ぎ。
    const p = 1 - (dt / o.n.fall);
    o.el.style.transform = "translateY(" + Math.round(Math.max(-0.15, Math.min(1.25, p)) * 100) + "%)";
    o.el.style.opacity = (p < -0.05) ? "0" : "1";
    if (dt < -SG_TUNE.hitGoodMs) {            // 判定幅を過ぎた＝見逃し
      o.done = true; o.el.classList.add("gone");
      run.scores.push(0); run.combo = 0;
      _sgJudgeFx("miss", "ミス…");
      _sgCombo();
    }
  });
  if (!remaining) { _sgDanceEnd(); return; }
  run.raf = requestAnimationFrame(_sgDanceTick);
}

function _sgDancePress(dir) {
  const run = _sgRun; if (!run || run.phase !== "dance") return;
  const t = _sgNow() - run.t0;
  // その方向の、まだ判定していないノートのうち、いちばん近いもの
  let best = null, bestAbs = 1e9;
  run.notes.forEach(o => {
    if (o.done || o.n.dir !== dir) return;
    const a = Math.abs(o.n.at - t);
    if (a < bestAbs) { bestAbs = a; best = o; }
  });
  if (!best || bestAbs > SG_TUNE.hitGoodMs) {   // 空振り（近くに何も無い）
    _sgJudgeFx("miss", "から振り"); run.combo = 0; _sgCombo(); return;
  }
  const j = sgJudgeStep(best.n.at - t);
  best.done = true;
  best.el.classList.add("hit-" + j.key);
  run.scores.push(j.score);
  if (j.score > 0) { run.combo++; run.best = Math.max(run.best, run.combo); }
  else run.combo = 0;
  _sgJudgeFx(j.key, j.label);
  _sgCombo();
  if (j.key === "great") {
    const w = document.querySelector(".sc-drg-wrap"); if (w) { w.classList.remove("sg-hop"); void w.offsetWidth; w.classList.add("sg-hop"); }
    try { if (window.Sfx) Sfx.play("coin"); } catch (e) {}
  }
}

function _sgJudgeFx(key, label) {
  const e = document.getElementById("sg-judge"); if (!e) return;
  e.className = "sg-judge sg-judge--" + key;
  e.textContent = label;
  void e.offsetWidth;
  e.classList.add("pop");
  setTimeout(() => { if (e) e.classList.remove("pop"); }, 260);
}
function _sgCombo() {
  const run = _sgRun; const e = document.getElementById("sg-combo"); if (!e || !run) return;
  e.textContent = run.combo >= 3 ? (run.combo + " れんぞく！") : "";
  e.classList.toggle("hot", run.combo >= 5);
}

function _sgDanceEnd() {
  const run = _sgRun; if (!run || run.dead) return;
  const res = sgDanceResult(run.scores);
  const w = document.querySelector(".sc-drg-wrap"); if (w) w.classList.remove("sg-dancing");
  run.sess.danceRate = res.rate; run.sess.danceBest = run.best;
  sgStop();
  if (res.ok) { run.sess.status = "win"; run.onWin(res); }
  else { run.sess.status = "lose"; run.onLose(res); }
}
