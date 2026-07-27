// =========================================================================
// 🚶 歩いてまわる崑崙島（G2a 縦切り＝港町・市街エリア1枚）
//   共通シーン基盤 js/scene_engine.js（設計書 §1）の上に乗る最初のシーン。
//
//   ★設計の芯（GENERATIVE_3D_RPG_DIRECTIVE §3）
//   - スーファミRPGの探索＝タイル移動＋「調べる/話す/入る」＋見えない壁のない小さな箱庭。
//   - **新しい駅は作らない**：歩けるマップは「島時間」駅の新しい“入り方”であって、
//     既存機能の置き換えではない。従来のピン式（renderKonronMap）は不変のまま残す。
//   - 建物の入口に着いたら **中身は全部既存機能**へ渡す＝箱庭はただの導線。
//
//   表示専用。レースの着順・オッズ・配当・所持コインには一切触れない。
// =========================================================================

// ── 背景（1920×1440）に対する当たり判定＝32×24のマス目。'#'=入れない / '.'=歩ける
//   背景画を10%グリッドで実測して起こした。マスは横3.125%・縦4.167%。
const KW_COLS = 32, KW_ROWS = 24;
const KW_MAP = [
  "################################", // r0  上段＝倉庫と建物の屋根（入れない）
  "################################", // r1
  "################################", // r2
  "################################", // r3
  "################################", // r4
  "################################", // r5
  "################################", // r6  この帯の中央にモールのアーチ
  "################################", // r7
  "########....##....##############", // r8  広場の上端。アーチの真下まで行ける
  "########.##.###....#############", // r9  市場の露店（左列/右列）と、その間の小径
  "#####....##.###....#############", // r10 上の桟橋
  "#####....##.###....#############", // r11
  "########.##.###........#########", // r12 右手が開けて宿の前へ
  "########.##.###...##############", // r13 宿がはじまる
  "#####....##.###...##############", // r14 下の桟橋
  "#####....##.###...##############", // r15
  "######............##############", // r16 露店が終わって広場が横に広がる
  "######............##############", // r17
  "#########.####.........#########", // r18 見晴らし台／下の家／浜の椰子
  "#########.####.........#########", // r19
  "#########.####.........#########", // r20
  "#########.####.........#########", // r21
  "################################", // r22 下の石塀
  "################################", // r23
];
const KW_MAPW = 1920, KW_MAPH = 1440;
const KW_CW = KW_MAPW / KW_COLS, KW_CH = KW_MAPH / KW_ROWS;

// ── 入口（世界座標のマス指定）。**中身は全部既存機能**＝ここは導線でしかない。
const KW_DOORS = [
  { c: 14, r: 8,  ic: "🏬", n: "崑崙モール", hint: "アーチをくぐる", stay: false,
    go: function () { if (typeof renderMall === "function") renderMall(); } },
  { c: 11, r: 12, ic: "🍢", n: "霧待ち市場", hint: "屋台をのぞく", stay: false,
    go: function () { if (typeof renderMeals === "function") renderMeals(); } },
  // 撮影は**オーバーレイ**（pgOpen）＝画面遷移ではない。シーンを壊すと閉じた後に
  // キャンバスの無い抜け殻が残るので、この場に留まったまま上に開く（実機で踏んだ不具合）。
  { c: 9,  r: 19, ic: "📷", n: "ミストラ湾の見晴らし台", hint: "写真をとる", stay: true,
    go: function () { if (typeof _kmStartShoot === "function") _kmStartShoot("mistra"); } },
  { c: 20, r: 18, ic: "🏨", n: "灯りの宿", hint: "声をかける", stay: true,
    go: function () { kwTalk(); } },
  { c: 5,  r: 10, ic: "⛴️", n: "桟橋（島の地図へ）", hint: "船着き場から戻る", stay: false,
    go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
];

let KW = null;   // 現在のシーン状態（表示専用）

function kwCell(c, r) {
  if (c < 0 || r < 0 || c >= KW_COLS || r >= KW_ROWS) return "#";
  const row = KW_MAP[r];
  return row ? (row[c] || "#") : "#";
}
function kwBlocked(wx, wy) { return kwCell(Math.floor(wx / KW_CW), Math.floor(wy / KW_CH)) === "#"; }
function kwDoorAt(wx, wy) {
  const c = Math.floor(wx / KW_CW), r = Math.floor(wy / KW_CH);
  return KW_DOORS.find(d => Math.abs(d.c - c) <= 1 && Math.abs(d.r - r) <= 1) || null;
}

// 宿の人の一言＝門番を通す（未登場のキャラの名前は出さない／[[cast-appearance-gate]]）
function kwTalk() {
  const who = (typeof rpgKeeperMet === "function" && rpgKeeperMet()) ? "スミカ" : "宿の人";
  const line = (who === "スミカ")
    ? "ミミ様。おかえりなさいませ。——港のほうが、今日はにぎやかですわ。"
    : "いらっしゃい。ここらは歩いて回れるからね、ゆっくりしていきな。";
  kwToast("🏨 " + who + "「" + line + "」");
}
function kwToast(msg) {
  if (!KW || !KW.hud) return;
  const n = KW.hud.querySelector(".kw-toast");
  if (!n) return;
  n.textContent = msg;
  n.classList.add("on");
  clearTimeout(KW._toastT);
  KW._toastT = setTimeout(() => n.classList.remove("on"), 3600);
}

function kwExit() {
  if (KW && KW.scene) { try { KW.scene.destroy(); } catch (e) {} }
  KW = null;
}

// ── 画面：歩いてまわる（β）
function renderKonronWalk() {
  if (typeof konronMapUnlocked === "function" && !konronMapUnlocked()) { renderKonronMap(); return; }
  if (typeof Scene === "undefined" || !Scene.create) { renderKonronMap(); return; }
  state.ui.screen = "konron_walk";
  const app = beginScreen();
  app.classList.add("kw-page");

  const hud = document.createElement("div");
  hud.className = "kw-hud";
  hud.innerHTML =
    '<button class="kw-back">← 島の地図へ</button>' +
    '<div class="kw-title">🚶 港町・市街をあるく <span class="kw-beta">β</span></div>' +
    '<div class="kw-toast"></div>' +
    '<div class="kw-prompt"></div>';
  app.appendChild(hud);
  hud.querySelector(".kw-back").onclick = () => { kwExit(); renderKonronMap(); };

  const stage = document.createElement("div");
  stage.className = "kw-stage";
  app.appendChild(stage);

  const scene = Scene.create({
    mount: stage,
    assets: { images: { city: "images/scene/konron/city.webp?v=20260727c", mimi: "images/scene/konron/mimi_walk.webp?v=20260727c" } },
    onLoad: function (a, S) { kwSetup(a, S); },
    onUpdate: function (dt, S) { kwUpdate(dt, S); },
    onDraw: function (ctx, cam, layer, S, t) { kwDraw(ctx, cam, layer, S, t); },
    onAct: function () { kwAct(); },
    onExit: function () { KW = null; },
  });

  KW = { scene: scene, hud: hud, mimi: null, near: null, dir: 0, step: 0, moving: false };
}

function kwSetup(a, S) {
  if (!KW) return;
  // 広場のまんなかから始める（どの入口へも歩いて行ける位置＝r11c16）
  KW.mimi = { x: KW_CW * 16.5, y: KW_CH * 11.5 };
  if (kwBlocked(KW.mimi.x, KW.mimi.y)) {                 // 万一ふさがっていたら近くの歩ける所へ逃がす
    outer: for (let r = 8; r < KW_ROWS; r++) for (let c = 0; c < KW_COLS; c++) {
      if (kwCell(c, r) === ".") { KW.mimi = { x: (c + 0.5) * KW_CW, y: (r + 0.5) * KW_CH }; break outer; }
    }
  }
  KW.sheet = a.mimi || null;
  KW.bg = a.city || null;
}

// ワールド→画面のスケール：横に約760ワールドpx見える＝キャラと建物の対比がSNESの町らしくなる
function kwScale(S) { return Math.max(0.28, S.vw / 760); }

function kwUpdate(dt, S) {
  if (!KW || !KW.mimi) return;
  const sp = 210 * dt;                                    // ワールドpx/秒
  const i = S.input;
  let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
  let dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }           // 斜めが速くならない
  KW.moving = !!(dx || dy);
  if (dy < 0) KW.dir = 1; else if (dy > 0) KW.dir = 0; else if (dx) KW.dir = 2;
  KW.face = dx < 0 ? -1 : (dx > 0 ? 1 : (KW.face || 1));

  // 軸ごとに判定＝壁ぞいに滑れる（角で引っかからない）
  const m = KW.mimi;
  if (dx) { const nx = m.x + dx * sp; if (!kwBlocked(nx, m.y)) m.x = nx; }
  if (dy) { const ny = m.y + dy * sp; if (!kwBlocked(m.x, ny)) m.y = ny; }
  m.x = Math.max(4, Math.min(KW_MAPW - 4, m.x));
  m.y = Math.max(4, Math.min(KW_MAPH - 4, m.y));

  KW.step = KW.moving ? (KW.step + dt * 7.5) : 0;

  // カメラ＝ミミを中心に、地図の外は見せない
  const sc = kwScale(S), vw = S.vw / sc, vh = S.vh / sc;
  S.camera.x = Math.max(0, Math.min(Math.max(0, KW_MAPW - vw), m.x - vw / 2));
  S.camera.y = Math.max(0, Math.min(Math.max(0, KW_MAPH - vh), m.y - vh / 2));
  S.camera.sc = sc; S.camera.vw = vw; S.camera.vh = vh;

  // 入口の近さ→プロンプト
  const d = kwDoorAt(m.x, m.y);
  if (d !== KW.near) {
    KW.near = d;
    const p = KW.hud && KW.hud.querySelector(".kw-prompt");
    if (p) {
      if (d) { p.innerHTML = '<span class="kw-p-ic">' + d.ic + "</span><b>" + d.n + "</b><small>🔍 で" + d.hint + "</small>"; p.classList.add("on"); }
      else p.classList.remove("on");
    }
  }
}

function kwAct() {
  if (!KW || !KW.near) { kwToast("🔍 ……とくに何もない。"); return; }
  const d = KW.near;
  try { if (window.Sfx) Sfx.play("nav"); } catch (e) {}
  if (d.stay) { try { d.go(); } catch (e) {} return; }   // 話しかけるだけ＝この場に留まる
  kwExit();
  try { d.go(); } catch (e) { if (typeof renderKonronMap === "function") renderKonronMap(); }
}

function kwDraw(ctx, cam, layer, S, t) {
  if (!KW || !KW.mimi) return;
  const sc = cam.sc || kwScale(S);
  if (layer === "bgFar") {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (KW.bg) {
      ctx.drawImage(KW.bg, cam.x, cam.y, cam.vw, cam.vh, 0, 0, S.vw, S.vh);
    } else {                                   // 画像が来ていなくても歩ける（設計書＝ダミーでも進む）
      ctx.fillStyle = "#c8b48a"; ctx.fillRect(0, 0, S.vw, S.vh);
    }
    ctx.restore();
    return;
  }
  if (layer !== "world") return;

  const m = KW.mimi;
  const sx = (m.x - cam.x) * sc, sy = (m.y - cam.y) * sc;
  const H = 118 * sc, W = H * (96 / 128);      // シートのセル比

  // 足元の影＝浮いて見せない
  ctx.save();
  ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(sx, sy, W * 0.30, H * 0.055, 0, 0, 7); ctx.fill();
  ctx.restore();

  if (KW.sheet) {
    const FR = [1, 0, 1, 2];                                   // 立ち→左足→立ち→右足
    const col = KW.moving ? FR[Math.floor(KW.step) % 4] : 1;
    const row = KW.dir;                                        // 0=正面 1=背中 2=横
    ctx.save();
    if (row === 2 && KW.face > 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }  // 横は左向き素材を反転
    ctx.drawImage(KW.sheet, col * 96, row * 128, 96, 128, sx - W / 2, sy - H, W, H);
    ctx.restore();
  } else {
    ctx.fillStyle = "#ffd7e6"; ctx.fillRect(sx - W / 2, sy - H, W, H);
  }

  // 入口の道標＝ドット絵の町に馴染む「灯り＋下向きの矢」。絵文字はHUDのプロンプト側で見せる。
  //   ★着いた入口には描かない（プロンプトが役目を引き継ぐ／ミミに重ならない）。
  KW_DOORS.forEach(function (d) {
    if (KW.near === d) return;
    const dx = (d.c + 0.5) * KW_CW, dy = (d.r + 0.5) * KW_CH;
    const px = (dx - cam.x) * sc, py = (dy - cam.y) * sc - 26 * sc;
    if (px < -40 || py < -40 || px > S.vw + 40 || py > S.vh + 40) return;
    const bob = S.reduce ? 0 : Math.sin(t / 520 + d.c) * 2.4 * sc;
    const R = Math.max(3, 4.6 * sc);
    ctx.save();
    ctx.translate(px, py + bob);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 3.4);   // 灯りのにじみ
    g.addColorStop(0, "rgba(255,214,140,.85)"); g.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffe8b0"; ctx.strokeStyle = "rgba(60,34,10,.85)"; ctx.lineWidth = Math.max(1, sc);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath();                                              // 下向きの小さな矢＝ここへ入れる
    ctx.moveTo(-R * 0.85, R * 1.7); ctx.lineTo(R * 0.85, R * 1.7); ctx.lineTo(0, R * 3.0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
}
