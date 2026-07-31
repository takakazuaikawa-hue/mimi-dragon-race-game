// =========================================================================
// poro_gourmet.js — クリア後スーパーミニゲーム「ポロのグルメレース」（表示専用）
// =========================================================================
// 仕様書 §7。横スクロールのスコアアタック：ポロが走り、好物を集め、障害を避ける。
// 完全にコミカルな息抜きコンテンツ。★レース本編（着順/オッズ/配当）には一切非干渉。
// 解放＝game_cleared && poroFound（poroGourmetRaceUnlocked）。設定の「おまけ」から起動。
//
// 操作：タップ / Space / ↑ ＝ ジャンプ（長押しで少しふんわり浮く＝羽ばたき）。
//       「泣きダッシュ」ボタン or Shift ＝ ゲージ満タンで一定時間 加速＆無敵。
// =========================================================================

// ── 永続データ（表示専用メタ・state.player.poroGourmet） ──
function pgData() {
  const p = state.player;
  if (!p.poroGourmet) p.poroGourmet = { best: 0, bestRank: "-", bestCombo: 0, plays: 0, delivered: 0, rewards: {} };
  return p.poroGourmet;
}

// ランク（仕様 §ランク C/B/A/S/SS/Poro）。スコア閾値は表示専用のたたき台。
const PG_RANKS = [
  { r: "Poro", min: 9000 }, { r: "SS", min: 6000 }, { r: "S", min: 4000 },
  { r: "A", min: 2500 }, { r: "B", min: 1200 }, { r: "C", min: 0 }
];
function pgRank(score) { for (const x of PG_RANKS) if (score >= x.min) return x.r; return "C"; }

// ごほうび（仕様 §報酬・表示専用フラグ）。ランク到達で解放。
const PG_REWARDS = [
  { id: "ribbon", rank: "B", ic: "🎀", name: "ポロの赤リボン差分" },
  { id: "expr", rank: "A", ic: "😻", name: "ポロの表情差分" },
  { id: "deco", rank: "S", ic: "🏮", name: "龍舎の飾り" },
  { id: "title", rank: "SS", ic: "🏅", name: "称号「グルメの友」" },
  { id: "gallery", rank: "Poro", ic: "🖼️", name: "ギャラリー画像" }
];
function pgRankIndex(r) { return ["C", "B", "A", "S", "SS", "Poro"].indexOf(r); }

// =========================================================================
// P-8 ブラッシュアップ（2026-08-01）
// =========================================================================
// ★いちばん大きかった問題＝**専用アートが納品済みなのに、ゲームは絵文字を描いていた**。
//   images/poro_race/ に走る/跳ぶ/転ぶポロ・食べ物5種・背景3枚がある（asset_manifest.json）。
//   まずこれを結線する。作り込みより先に、既にあるものを使う。
// ★手触りの直し（跳ぶゲームの基本・ここを外すと「反応が悪い」と感じる）：
//   ①コヨーテタイム＝地面を離れた直後の数フレームは跳べる（崖際で跳べない不満を消す）
//   ②ジャンプバッファ＝着地の直前に押した入力を覚えて着地で発火（早押しが捨てられない）
//   ③出現を決定的な剰余からPRNGへ。旧実装は roll=(dist+score*7+…)%100 で、
//     **スコアで配置が変わる**＝腕が上がるほど地形が別物になる、という妙な挙動だった。
//   ④跳んでも避けられない配置を作らない（直前の障害から最低間隔を空ける）。
// ★演出：取得パーティクル・スコアポップ・被弾で画面ゆれ・ダッシュ中のスピード線。
// ★表示専用＝本編のレース（着順/オッズ/配当/FinalPower）には一切非干渉。スコアも表示メタ。
// =========================================================================

// ── アート（納品済みを使う。読み込めなければ絵文字へフォールバック）──
const PG_ART_DIR = "images/poro_race/";
const PG_ART = { poro: {}, food: {}, bg: [], ready: false };
function pgLoadArt() {
  if (PG_ART._started) return; PG_ART._started = true;
  const img = (f) => { const i = new Image(); i.src = PG_ART_DIR + f; return i; };
  PG_ART.poro.run = img("poro_run.webp");
  PG_ART.poro.jump = img("poro_jump.webp");
  PG_ART.poro.stumble = img("poro_stumble.webp");
  ["food_fruit", "food_nut", "food_poro_bun", "food_root", "food_sweet"].forEach(k => { PG_ART.food[k] = img(k + ".webp"); });
  PG_ART.bg = ["bg_night_market.jpg", "bg_orchard.jpg", "bg_food_storage.jpg"].map(img);
}
function pgOk(i) { return i && i.complete && i.naturalWidth > 0; }

// ── 食材・障害の定義 ──
// ★sprite があればそれを、無ければ ic（絵文字）を描く。得点は据え置き。
const PG_GOOD = [
  { ic: "🍇", sp: "food_fruit",    pt: 120, purple: true },   // 紫の果実＝ボーナス
  { ic: "🌰", sp: "food_nut",      pt: 60 },
  { ic: "🍠", sp: "food_root",     pt: 60 },
  { ic: "🍡", sp: "food_poro_bun", pt: 80 },
  { ic: "🍩", sp: "food_sweet",    pt: 80 }
];
const PG_BAD = [{ ic: "🌶️" }, { ic: "🍃" }, { ic: "🍽️" }];   // 辛い実/苦い葉/空の皿＝減速
const PG_OBST = [{ ic: "🔔" }, { ic: "🎈" }];                  // 発走ベル/大きな風船＝障害（跳んで避ける）

// ── セッション状態 ──
let PG = null;
let PG_RAF = 0;

const PG_W = 480, PG_H = 270, PG_GROUND = 222, PG_PX = 72;
const PG_COYOTE = 90;    // ms・地面を離れてから跳べる猶予
const PG_BUFFER = 120;   // ms・着地前の入力を覚えておく長さ
const PG_STAGE_LEN = 5200;   // この距離ごとに背景が変わる（夜市→果樹園→食糧庫）

// 小さなPRNG（実行ごとに違う地形／スコアには依存させない）
function pgRnd() { PG.seed = (PG.seed * 1664525 + 1013904223) >>> 0; return PG.seed / 4294967296; }

function pgReset() {
  pgLoadArt();
  PG = {
    running: false, over: false, last: 0, time: 30000,   // 30秒
    py: PG_GROUND, vy: 0, onGround: true, hold: false, flutter: 0,
    score: 0, combo: 0, bestCombo: 0, delivered: 0,
    speed: 0.18, items: [], spawn: 0, dist: 0,
    dash: 0, dashOn: 0, stumble: 0, frameSkip: 0,
    // ★手触り
    coyote: PG_COYOTE, buffer: 0, lastObstX: -9999,
    // ★演出（すべて表示専用）
    parts: [], pops: [], shake: 0, flash: 0, runT: 0,
    seed: ((Date.now() ^ (pgData().plays * 2654435761)) >>> 0) || 12345
  };
}

// 画面（タイトル/プレイ/結果を1画面で出し分け）
function renderPoroGourmet() {
  if (!(typeof poroGourmetUnlocked === "function" && poroGourmetUnlocked())) {
    if (typeof renderHome === "function") renderHome();
    // ★このロック案内が出る＝未解放＝ポロ未発見のこともある。相棒の名前は伏せる（命名オチ・R4）。
    const _pgFound = (typeof poroFound === "function") && poroFound();
    if (typeof showInfoPopup === "function") showInfoPopup(_pgFound ? "🏃 ポロのグルメレース" : "🏃 ？？？のミニゲーム",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>本編をクリア（エンディングを観る）すると解放されます。</small></div></div>`);
    return;
  }
  pgStopLoop();
  state.ui.screen = "poro_gourmet";
  const app = beginScreen();
  const d = pgData();
  app.appendChild(el("h2", null, "🏃 ポロのグルメレース"));
  app.appendChild(el("div", "as-hint2", "ポロの好物を集めて走る、息抜きの一走り。"));

  // ベスト記録
  app.appendChild(el("div", "pg-best",
    `🏆 ベスト <b>${d.best.toLocaleString("ja-JP")}</b>（${d.bestRank}）　最大コンボ <b>${d.bestCombo}</b>　プレイ <b>${d.plays}</b>回`));

  // キャンバス＋HUD
  const stage = el("div", "pg-stage");
  stage.innerHTML =
    `<canvas class="pg-canvas" width="${PG_W}" height="${PG_H}"></canvas>` +
    `<div class="pg-hud"><span class="pg-score">0</span><span class="pg-combo"></span><span class="pg-time">⏱ 30.0</span></div>` +
    `<div class="pg-dashwrap"><span>泣きダッシュ</span><div class="pg-dashbar"><i></i></div></div>` +
    `<div class="pg-startveil"><button class="pg-startbtn">▶ スタート</button><div class="pg-howto">タップ／Space＝ジャンプ（長押しでふんわり）<br>ゲージ満タンで 泣きダッシュ（加速＆無敵）</div></div>`;
  app.appendChild(stage);

  // 操作ボタン（モバイル）
  const ctrl = el("div", "pg-ctrl");
  const jumpB = el("button", "pg-btn pg-jump", "⬆ ジャンプ");
  const dashB = el("button", "pg-btn pg-dash", "😢 泣きダッシュ");
  ctrl.appendChild(jumpB); ctrl.appendChild(dashB);
  app.appendChild(ctrl);

  // ごほうび一覧
  const rew = el("div", "pg-rewards");
  rew.innerHTML = `<div class="stable-sec">🎁 ごほうび</div>`;
  PG_REWARDS.forEach(r => {
    const got = d.rewards[r.id];
    rew.appendChild(el("div", "pg-rew" + (got ? " got" : ""),
      `<span class="pg-rew-ic">${got ? r.ic : "🔒"}</span><span class="pg-rew-nm">${r.name}</span><span class="pg-rew-rk">${r.rank}</span>`));
  });
  app.appendChild(rew);

  const actions = el("div", "actions");
  const back = el("button", null, "← もどる"); back.onclick = () => { pgStopLoop(); renderSettings(); };
  actions.appendChild(back);
  app.appendChild(actions);

  // 配線
  const canvas = stage.querySelector(".pg-canvas");
  const ctx = canvas.getContext("2d");
  pgReset();
  pgDraw(ctx, stage);   // 初期フレーム（待機）

  const startBtn = stage.querySelector(".pg-startbtn");
  startBtn.onclick = () => { stage.querySelector(".pg-startveil").style.display = "none"; pgStart(ctx, stage); };

  // 入力（ジャンプ＝タップ/Space、長押しでふんわり）
  const jumpDown = (e) => { if (e) e.preventDefault(); pgJump(true); };
  const jumpUp = () => { if (PG) PG.hold = false; };
  canvas.addEventListener("pointerdown", jumpDown);
  window.addEventListener("pointerup", jumpUp);
  jumpB.addEventListener("pointerdown", jumpDown);
  jumpB.addEventListener("pointerup", jumpUp);
  dashB.addEventListener("pointerdown", (e) => { e.preventDefault(); pgDash(); });

  function onKey(e) {
    if (state.ui.screen !== "poro_gourmet") return;
    if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); pgJump(true); }
    else if (e.key === "Shift") { e.preventDefault(); pgDash(); }
  }
  function onKeyUp(e) { if (e.key === " " || e.key === "ArrowUp") { if (PG) PG.hold = false; } }
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  PG_KEYCLEAN = () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("pointerup", jumpUp); };
}
let PG_KEYCLEAN = null;

// ★コヨーテタイム＋ジャンプバッファ（跳ぶゲームの手触りの土台）。
//   地面に居なくても coyote が残っていれば跳べる／跳べない場面の入力は buffer に貯めて
//   着地の瞬間に発火させる（pgUpdate 側）。これが無いと「押したのに跳ばない」が起きる。
function pgJump(press) {
  if (!PG || !PG.running || PG.over) return;
  if (PG.onGround || PG.coyote > 0) {
    PG.vy = -10.4; PG.onGround = false; PG.coyote = 0; PG.hold = true; PG.flutter = 320; PG.buffer = 0;
    if (window.Sfx && Sfx.play) Sfx.play("tap");
  } else {
    PG.buffer = PG_BUFFER;                 // 早すぎた入力を捨てない
    if (press) PG.hold = true;             // 空中での長押し＝ふんわり（重力減）
  }
}
function pgDash() {
  if (!PG || !PG.running || PG.over) return;
  if (PG.dash >= 100 && PG.dashOn <= 0) { PG.dashOn = 1600; PG.dash = 0; if (window.Sfx && Sfx.play) Sfx.play("streak"); }
}

function pgStart(ctx, stage) {
  pgReset();
  PG.running = true;
  pgData().plays += 1;
  if (typeof saveGame === "function") saveGame();
  PG.last = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
  const loop = (ts) => {
    if (!PG || !PG.running || state.ui.screen !== "poro_gourmet") { pgStopLoop(); return; }
    let dt = ts - PG.last; if (!(dt > 0)) dt = 16; if (dt > 60) dt = 60;   // 大きなギャップは丸める
    PG.last = ts;
    pgUpdate(dt);
    pgDraw(ctx, stage);
    if (PG.over) { pgStopLoop(); pgShowResult(stage); return; }
    PG_RAF = requestAnimationFrame(loop);
  };
  PG_RAF = requestAnimationFrame(loop);
}
function pgStopLoop() { if (PG_RAF) { cancelAnimationFrame(PG_RAF); PG_RAF = 0; } if (PG) PG.running = false; if (PG_KEYCLEAN) { PG_KEYCLEAN(); PG_KEYCLEAN = null; } }

function pgUpdate(dt) {
  const f = dt / 16.67;   // フレーム正規化（60fps基準）
  // タイマー
  PG.time -= dt; if (PG.time <= 0) { PG.time = 0; PG.over = true; return; }
  // スピード（時間で加速・ダッシュ中はさらに速い・スタンブル中は減速）
  const base = PG.speed + Math.min(0.12, PG.dist / 90000);
  const sp = (PG.dashOn > 0 ? base * 1.7 : base) * (PG.stumble > 0 ? 0.55 : 1);
  PG.dist += sp * dt;
  if (PG.dashOn > 0) PG.dashOn -= dt;
  if (PG.stumble > 0) PG.stumble -= dt;
  if (PG.dashOn <= 0) PG.dash = Math.min(100, PG.dash + 0.018 * dt);   // ダッシュゲージ自然回復

  // ジャンプ物理
  const g = (PG.hold && PG.vy > -2 && PG.flutter > 0) ? 0.28 : 0.62;   // 長押し中はふんわり
  if (PG.flutter > 0) PG.flutter -= dt;
  const wasAir = !PG.onGround;
  PG.vy += g * f;
  PG.py += PG.vy * f;
  if (PG.py >= PG_GROUND) {
    PG.py = PG_GROUND; PG.vy = 0; PG.hold = false;
    if (wasAir) PG.coyote = PG_COYOTE;                 // 着地でコヨーテを充填
    PG.onGround = true;
    if (PG.buffer > 0) { PG.buffer = 0; pgJump(true); }  // ★着地の瞬間にバッファ発火
  } else {
    PG.onGround = false;
    if (PG.coyote > 0) PG.coyote -= dt;                 // 空中に居る間だけ猶予が減る
  }
  if (PG.buffer > 0) PG.buffer -= dt;

  // 出現（★PRNG＝スコアに依存しない。腕が上がっても地形の性質は変わらない）
  PG.spawn -= dt;
  if (PG.spawn <= 0) {
    PG.spawn = 620 - Math.min(300, PG.dist / 220);   // だんだん密に
    const roll = pgRnd();
    // ★避けられない配置を作らない：直前の障害から十分離れていないと障害は置かない。
    //   必要間隔＝1回のジャンプで進める距離。**滞空は実測620ms**（vy=-10.4・長押しの浮き込み）
    //   なので 640ms を基準に、着地の余裕として1.35倍を要求する。
    //   （実測：最善プレイヤーで被弾は10走あたり1回＝配置は理不尽ではない。
    //     早すぎる踏切りだと障害の上に着地するので、体感の難所は配置ではなくタイミング。）
    const jumpSpan = sp * 640;
    const canObst = (PG_W + 30) - PG.lastObstX > jumpSpan * 1.35;
    let kind, def, y;
    if (roll < 0.55 || (!canObst && roll < 0.8)) {
      kind = "good";
      def = PG_GOOD[Math.floor(pgRnd() * PG_GOOD.length)];
      y = PG_GROUND - Math.floor(pgRnd() * 3) * 46 - 8;
    } else if (roll < 0.8) {
      kind = "obst"; def = PG_OBST[Math.floor(pgRnd() * PG_OBST.length)]; y = PG_GROUND - 4;
      PG.lastObstX = PG_W + 30;
    } else {
      // ★苦手な品は「跳べば避けられる」高さに限定（空中で待ち構える置き方をしない）
      kind = "bad"; def = PG_BAD[Math.floor(pgRnd() * PG_BAD.length)]; y = PG_GROUND - 8;
    }
    PG.items.push({ x: PG_W + 30, y: y, kind: kind, def: def, hit: false, t: 0 });
  }
  PG.lastObstX -= sp * dt;

  // 移動＆当たり判定（AABB・ポロは x=PG_PX 固定）
  const move = sp * dt;
  for (const it of PG.items) {
    it.x -= move;
    if (it.hit) continue;
    const dx = Math.abs(it.x - PG_PX), dyv = Math.abs(it.y - PG.py);
    if (dx < 26 && dyv < 28) {
      it.hit = true;
      if (it.kind === "good") {
        PG.combo += 1; if (PG.combo > PG.bestCombo) PG.bestCombo = PG.combo;
        const mult = 1 + Math.min(2.5, PG.combo * 0.1);
        const gain = Math.round(it.def.pt * mult) + (it.def.purple ? 60 : 0);
        PG.score += gain;
        PG.delivered += 1;
        pgBurst(it.x, it.y, it.def.purple ? "#c79bff" : "#ffd24a", it.def.purple ? 14 : 8);
        PG.pops.push({ x: it.x, y: it.y, t: 0, txt: "+" + gain, big: !!it.def.purple });
        if (PG.combo >= 5 && PG.combo % 5 === 0) PG.flash = 240;   // 5コンボごとに画面が沸く
        if (window.Sfx && Sfx.play) Sfx.play("coin");
      } else if (it.kind === "bad") {
        PG.combo = 0; PG.stumble = 600; PG.score = Math.max(0, PG.score - 40);
        PG.shake = 260; pgBurst(it.x, it.y, "#ff7b5a", 8);
        PG.pops.push({ x: it.x, y: it.y - 14, t: 0, txt: "からい！" });
        if (window.Sfx && Sfx.play) Sfx.play("miss");
      } else { /* obstacle */
        if (PG.dashOn > 0) { it.smash = true; pgBurst(it.x, it.y, "#ffe08a", 12); }   // ダッシュ中は無敵で吹き飛ばす
        else {
          PG.combo = 0; PG.stumble = 700; PG.score = Math.max(0, PG.score - 30);
          PG.shake = 320; pgBurst(it.x, it.y, "#9fb4d8", 10);
          if (window.Sfx && Sfx.play) Sfx.play("miss");
        }
      }
    }
  }
  PG.items = PG.items.filter(it => it.x > -40 && !(it.hit && it.kind !== "obst"));

  // ── 演出の進行（すべて表示専用）──
  PG.runT += dt;
  if (PG.shake > 0) PG.shake -= dt;
  if (PG.flash > 0) PG.flash -= dt;
  for (const p of PG.parts) { p.x += p.vx * f - move; p.y += p.vy * f; p.vy += 0.18 * f; p.life -= dt; }
  PG.parts = PG.parts.filter(p => p.life > 0);
  for (const q of PG.pops) { q.t += dt; q.y -= 0.045 * dt; q.x -= move; }
  PG.pops = PG.pops.filter(q => q.t < 800);
}

// 取得/被弾のはじけ（粒は上限つき＝重くしない）
// ★演出の乱数は Math.random。ゲーム用の pgRnd を演出で消費してはいけない。
//   消費すると**描いたフレーム数で地形が変わる**＝端末の速さで難易度が動く。
//   旧実装のスコア依存を潰した意味がなくなるので、ここは必ず分ける。
function pgBurst(x, y, col, n) {
  if (!PG || PG.parts.length > 90) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.6;
    PG.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, life: 380 + Math.random() * 260, col: col, r: 1.5 + Math.random() * 2.2 });
  }
}

// 画像を「高さ基準」で中央に描く（★縦横比は絶対に歪めない＝[[character-aspect-ratio-immutable]]）
function pgDrawImg(ctx, img, cx, by, h) {
  const r = img.naturalWidth / img.naturalHeight;
  const w = h * r;
  ctx.drawImage(img, cx - w / 2, by - h, w, h);
}

function pgDraw(ctx, stage) {
  const dist = PG ? PG.dist : 0;
  ctx.save();
  // ★被弾の画面ゆれ（純表示・当たり判定は動かさない）
  if (PG && PG.shake > 0) {
    const s = PG.shake / 320 * 5;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  // ── 背景（納品済みの3枚を距離で切り替え＋パララックス＋またぎはクロスフェード）──
  const stageF = dist / PG_STAGE_LEN;
  const si = Math.floor(stageF) % 3;
  const ni = (si + 1) % 3;
  const frac = stageF - Math.floor(stageF);
  const fade = frac > 0.92 ? (frac - 0.92) / 0.08 : 0;   // 終盤だけ次の背景へ溶ける
  const drawBg = (img, alpha) => {
    if (!pgOk(img)) return false;
    ctx.globalAlpha = alpha;
    // cover（高さを合わせ、横はループ）— 背景も比率を歪めない
    const h = PG_H, w = h * (img.naturalWidth / img.naturalHeight);
    let off = (dist * 0.14) % w; if (off < 0) off += w;
    for (let x = -off; x < PG_W; x += w) ctx.drawImage(img, x, 0, w, h);
    ctx.globalAlpha = 1;
    return true;
  };
  if (!drawBg(PG_ART.bg[si], 1)) {
    // フォールバック（画像未読込の一瞬）＝従来のグラデ
    const g = ctx.createLinearGradient(0, 0, 0, PG_H);
    g.addColorStop(0, "#241a3a"); g.addColorStop(0.6, "#3a2a4e"); g.addColorStop(1, "#1c2230");
    ctx.fillStyle = g; ctx.fillRect(0, 0, PG_W, PG_H);
  }
  if (fade > 0) drawBg(PG_ART.bg[ni], fade);
  // 手前を少し沈める（キャラと食べ物を前に出すため）
  ctx.fillStyle = "rgba(12,10,24,.30)"; ctx.fillRect(0, 0, PG_W, PG_H);

  // ── 地面（背景より速く流れる＝奥行き）──
  // ★背景画にも床が描いてあるので、帯をベタ塗りすると**画面を横に切る線**ができる。
  //   帯の上に透明→暗のグラデを重ねて、背景の床から地面へ繋げる。
  const gy = PG_GROUND + 18;
  const gg = ctx.createLinearGradient(0, gy - 34, 0, gy + 6);
  gg.addColorStop(0, "rgba(14,17,24,0)"); gg.addColorStop(1, "rgba(14,17,24,.86)");
  ctx.fillStyle = gg; ctx.fillRect(0, gy - 34, PG_W, 40);
  ctx.fillStyle = "rgba(14,17,24,.86)"; ctx.fillRect(0, gy, PG_W, PG_H);
  ctx.strokeStyle = "rgba(230,205,134,.32)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(PG_W, gy); ctx.stroke();
  ctx.strokeStyle = "rgba(230,205,134,.18)"; ctx.lineWidth = 1;
  const goff = (dist * 1.0) % 48;
  for (let x = -goff; x < PG_W; x += 48) { ctx.beginPath(); ctx.moveTo(x, PG_GROUND + 22); ctx.lineTo(x + 18, PG_GROUND + 22); ctx.stroke(); }

  // ── ダッシュ中のスピード線 ──
  if (PG && PG.dashOn > 0) {
    ctx.strokeStyle = "rgba(255,224,138,.5)"; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y = 40 + ((i * 53 + dist * 2.2) % (PG_H - 80));
      const x = (PG_W - ((dist * 3.4 + i * 97) % (PG_W + 160)));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46, y); ctx.stroke();
    }
  }

  // ── アイテム（スプライトがあれば絵、無ければ絵文字）──
  if (PG) for (const it of PG.items) {
    if (it.smash) continue;
    const sp = it.def.sp ? PG_ART.food[it.def.sp] : null;
    if (pgOk(sp)) {
      // 好物はふわっと上下（拾える距離は変えない＝判定は it.y のまま）
      const bob = Math.sin((PG.runT + it.x * 6) / 240) * 3;
      pgDrawImg(ctx, sp, it.x, it.y + 18 + bob, 34);
    } else {
      ctx.font = "28px serif"; ctx.textAlign = "center"; ctx.fillText(it.def.ic, it.x, it.y + 10);
    }
  }

  // ── ポロ（走る／跳ぶ／転ぶ の納品スプライト）──
  ctx.save();
  if (PG && PG.dashOn > 0) { ctx.shadowColor = "#ffd24a"; ctx.shadowBlur = 18; }
  const py = (PG ? PG.py : PG_GROUND);
  const st = PG && PG.stumble > 0 ? "stumble" : (PG && !PG.onGround ? "jump" : "run");
  const spr = PG_ART.poro[st];
  if (pgOk(spr)) {
    // 走りは軽く弾ませる／転倒は前のめりに傾ける（比率は変えず回転だけ）
    const bob = (st === "run" && PG) ? Math.abs(Math.sin(PG.runT / 90)) * 4 : 0;
    ctx.save();
    ctx.translate(PG_PX, py + 22 - bob);
    if (st === "stumble") ctx.rotate(-0.22);
    pgDrawImg(ctx, spr, 0, 0, 58);
    ctx.restore();
  } else {
    ctx.font = "34px serif"; ctx.textAlign = "center";
    ctx.fillText(st === "stumble" ? "😵" : "🥹", PG_PX, py + 12);
  }
  ctx.restore();

  // ── 粒とスコアポップ ──
  if (PG) {
    for (const p of PG.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400));
      ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const q of PG.pops) {
      ctx.globalAlpha = Math.max(0, 1 - q.t / 800);
      ctx.font = (q.big ? "bold 20px" : "bold 15px") + " system-ui, sans-serif";
      ctx.fillStyle = q.big ? "#e5c2ff" : "#ffe9a8";
      ctx.fillText(q.txt, q.x, q.y);
    }
    ctx.globalAlpha = 1;
    // コンボの節目で画面がぱっと明るくなる
    if (PG.flash > 0) { ctx.fillStyle = "rgba(255,215,120," + (PG.flash / 240 * 0.18).toFixed(3) + ")"; ctx.fillRect(0, 0, PG_W, PG_H); }
  }
  ctx.restore();

  // HUD更新
  const sc = stage.querySelector(".pg-score"), cb = stage.querySelector(".pg-combo"), tm = stage.querySelector(".pg-time"), db = stage.querySelector(".pg-dashbar i");
  if (PG) {
    if (sc) sc.textContent = PG.score.toLocaleString("ja-JP");
    if (cb) cb.textContent = PG.combo >= 3 ? "🔥" + PG.combo + "コンボ" : "";
    if (tm) tm.textContent = "⏱ " + (PG.time / 1000).toFixed(1);
    if (db) db.style.width = PG.dash + "%";
  }
}

function pgShowResult(stage) {
  const d = pgData();
  const rank = pgRank(PG.score);
  const isBest = PG.score > d.best;
  if (isBest) { d.best = PG.score; d.bestRank = rank; }
  if (PG.bestCombo > d.bestCombo) d.bestCombo = PG.bestCombo;
  d.delivered += PG.delivered;
  // ごほうび解放（到達ランク以下を全て）
  const newly = [];
  PG_REWARDS.forEach(r => { if (pgRankIndex(rank) >= pgRankIndex(r.rank) && !d.rewards[r.id]) { d.rewards[r.id] = true; newly.push(r); } });
  if (typeof saveGame === "function") saveGame();

  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop pg-result");
  box.innerHTML =
    `<div class="navpop-t">🏁 リザルト</div>` +
    `<div class="pg-res-rank">ランク <b>${rank}</b>${isBest ? ' <span class="pg-res-best">★自己ベスト!</span>' : ''}</div>` +
    `<div class="pg-res-score">${PG.score.toLocaleString("ja-JP")} <small>点</small></div>` +
    `<div class="pg-res-stats">最大コンボ ${PG.bestCombo}　／　ミミへ届けた食材 ${PG.delivered}</div>` +
    (newly.length ? `<div class="pg-res-rew">🎁 ${newly.map(r => r.ic + r.name).join("　")}</div>` : "");
  const btns = el("div", "navpop-btns");
  const again = el("button", "navpop-go", "🔁 もう一度");
  again.onclick = () => { ov.remove(); renderPoroGourmet(); setTimeout(() => { const v = document.querySelector(".pg-startveil"); if (v) v.style.display = "none"; const c = document.querySelector(".pg-canvas"); if (c) pgStart(c.getContext("2d"), document.querySelector(".pg-stage")); }, 30); };
  const done = el("button", "navpop-cancel", "とじる");
  done.onclick = () => { ov.remove(); renderPoroGourmet(); };
  btns.appendChild(again); btns.appendChild(done); box.appendChild(btns);
  ov.appendChild(box);
  document.body.appendChild(ov);
}
