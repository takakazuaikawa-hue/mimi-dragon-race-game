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

// ── 食材・障害の定義（絵文字で表現・あとでドット絵に差し替え可） ──
const PG_GOOD = [
  { ic: "🍇", pt: 120, purple: true },   // 紫色の果実＝ボーナス
  { ic: "🌰", pt: 60 }, { ic: "🍠", pt: 60 }, { ic: "🍡", pt: 80 }, { ic: "🍩", pt: 80 }
];
const PG_BAD = [{ ic: "🌶️" }, { ic: "🍃" }, { ic: "🍽️" }];   // 辛い実/苦い葉/空の皿＝減速
const PG_OBST = [{ ic: "🔔" }, { ic: "🎈" }];                  // 発走ベル/大きな風船＝障害（跳んで避ける）

// ── セッション状態 ──
let PG = null;
let PG_RAF = 0;

const PG_W = 480, PG_H = 270, PG_GROUND = 222, PG_PX = 72;

function pgReset() {
  PG = {
    running: false, over: false, last: 0, time: 30000,   // 30秒
    py: PG_GROUND, vy: 0, onGround: true, hold: false, flutter: 0,
    score: 0, combo: 0, bestCombo: 0, delivered: 0,
    speed: 0.18, items: [], spawn: 0, dist: 0,
    dash: 0, dashOn: 0, stumble: 0, frameSkip: 0
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
  app.appendChild(el("div", "as-hint2", "ポロが大好きな食べ物を集めて走る、息抜きスコアアタック（表示専用・レースには影響しません）。"));

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

function pgJump(press) {
  if (!PG || !PG.running || PG.over) return;
  if (PG.onGround) { PG.vy = -10.4; PG.onGround = false; PG.hold = true; PG.flutter = 320; }
  else if (press) { PG.hold = true; }   // 空中での長押し＝ふんわり（重力減）
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
  PG.vy += g * f;
  PG.py += PG.vy * f;
  if (PG.py >= PG_GROUND) { PG.py = PG_GROUND; PG.vy = 0; PG.onGround = true; PG.hold = false; }

  // 出現
  PG.spawn -= dt;
  if (PG.spawn <= 0) {
    PG.spawn = 620 - Math.min(300, PG.dist / 220);   // だんだん密に
    const roll = Math.floor((PG.dist + PG.score * 7 + PG.items.length * 13) % 100);
    let kind, def, y;
    if (roll < 55) { kind = "good"; def = PG_GOOD[(PG.score + PG.items.length) % PG_GOOD.length]; y = PG_GROUND - (roll % 3) * 46 - 8; }
    else if (roll < 78) { kind = "obst"; def = PG_OBST[roll % PG_OBST.length]; y = PG_GROUND - 4; }
    else { kind = "bad"; def = PG_BAD[roll % PG_BAD.length]; y = PG_GROUND - (roll % 2) * 50 - 8; }
    PG.items.push({ x: PG_W + 30, y: y, kind: kind, def: def, hit: false });
  }

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
        PG.score += Math.round(it.def.pt * mult) + (it.def.purple ? 60 : 0);
        PG.delivered += 1;
        if (window.Sfx && Sfx.play) Sfx.play("coin");
      } else if (it.kind === "bad") {
        PG.combo = 0; PG.stumble = 600; PG.score = Math.max(0, PG.score - 40);
        if (window.Sfx && Sfx.play) Sfx.play("miss");
      } else { /* obstacle */
        if (PG.dashOn > 0) { /* ダッシュ中は無敵で吹き飛ばす */ it.smash = true; }
        else { PG.combo = 0; PG.stumble = 700; PG.score = Math.max(0, PG.score - 30); if (window.Sfx && Sfx.play) Sfx.play("miss"); }
      }
    }
  }
  PG.items = PG.items.filter(it => it.x > -40 && !(it.hit && it.kind !== "obst"));
}

function pgDraw(ctx, stage) {
  // 背景（夜市〜果樹園のグラデ）
  const g = ctx.createLinearGradient(0, 0, 0, PG_H);
  g.addColorStop(0, "#241a3a"); g.addColorStop(0.6, "#3a2a4e"); g.addColorStop(1, "#1c2230");
  ctx.fillStyle = g; ctx.fillRect(0, 0, PG_W, PG_H);
  // 遠景の提灯（パララックス）
  const off = (PG ? PG.dist : 0) * 0.2 % 120;
  ctx.globalAlpha = 0.5;
  for (let i = -1; i < 5; i++) { ctx.font = "20px serif"; ctx.fillText("🏮", i * 120 - off + 40, 52); }
  ctx.globalAlpha = 1;
  // 地面
  ctx.fillStyle = "#171c24"; ctx.fillRect(0, PG_GROUND + 18, PG_W, PG_H);
  ctx.strokeStyle = "rgba(230,205,134,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, PG_GROUND + 18); ctx.lineTo(PG_W, PG_GROUND + 18); ctx.stroke();
  // アイテム
  if (PG) for (const it of PG.items) { if (it.smash) continue; ctx.font = "28px serif"; ctx.textAlign = "center"; ctx.fillText(it.def.ic, it.x, it.y + 10); }
  // ポロ（絵文字。ダッシュ中は光る）
  ctx.save();
  if (PG && PG.dashOn > 0) { ctx.shadowColor = "#ffd24a"; ctx.shadowBlur = 18; }
  ctx.font = "34px serif"; ctx.textAlign = "center";
  ctx.fillText(PG && PG.stumble > 0 ? "😵" : (PG && !PG.onGround ? "🥹" : "🥹"), PG_PX, (PG ? PG.py : PG_GROUND) + 12);
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
