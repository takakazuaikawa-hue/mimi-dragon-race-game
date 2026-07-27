// =========================================================================
// 🚶 歩いてまわる崑崙島（G2a 縦切り → G2b エリア拡張）
//   共通シーン基盤 js/scene_engine.js（設計書 §1）の上に乗るシーン。
//
//   ★設計の芯（GENERATIVE_3D_RPG_DIRECTIVE §3）
//   - スーファミRPGの探索＝タイル移動＋「調べる/話す/入る」＋見えない壁のない小さな箱庭。
//   - **新しい駅は作らない**：歩けるマップは「島時間」駅の新しい“入り方”であって、
//     既存機能の置き換えではない。従来のピン式（renderKonronMap）は不変のまま残す。
//   - 建物の入口に着いたら **中身は全部既存機能**へ渡す＝箱庭はただの導線。
//
//   G2b で足したもの：エリア3枚（港町→レース場→温泉郷）／時間帯パレット（_kmIslandNow連動）／
//   すれちがいNPC／ポロ随行（poroFound後）／隠しスポットの「？」（fail-closed）。
//
//   表示専用。レースの着順・オッズ・配当・所持コインには一切触れない。
// =========================================================================

const KW_COLS = 32, KW_ROWS = 24;
const KW_MAPW = 1920, KW_MAPH = 1440;
const KW_CW = KW_MAPW / KW_COLS, KW_CH = KW_MAPH / KW_ROWS;
const KW_V = "20260727d";

// ── エリア台帳。map は背景画（1920×1440）に対する当たり判定＝32×24のマス目。
//   '#'=入れない / '.'=歩ける。背景を10%グリッドで実測して起こし、赤塗り合成で突き合わせて是正した。
const KW_AREAS = {
  city: {
    name: "港町・市街", img: "images/scene/konron/city.webp",
    start: { c: 16, r: 11 },
    map: [
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
    ],
    doors: [
      { c: 14, r: 8, ic: "🏬", n: "崑崙モール", hint: "アーチをくぐる",
        go: function () { if (typeof renderMall === "function") renderMall(); } },
      { c: 11, r: 12, ic: "🍢", n: "霧待ち市場", hint: "屋台をのぞく",
        go: function () { if (typeof renderMeals === "function") renderMeals(); } },
      // 撮影は**オーバーレイ**（pgOpen）＝画面遷移ではない。シーンを壊すと閉じた後に
      // キャンバスの無い抜け殻が残るので、この場に留まったまま上に開く（実機で踏んだ不具合）。
      { c: 9, r: 19, ic: "📷", n: "ミストラ湾の見晴らし台", hint: "写真をとる", stay: true,
        go: function () { kwShoot("mistra"); } },
      { c: 20, r: 18, ic: "🏨", n: "灯りの宿", hint: "声をかける", stay: true,
        go: function () { kwTalkKeeper(); } },
      { c: 5, r: 10, ic: "⛴️", n: "桟橋（島の地図へ）", hint: "船着き場から戻る",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
      { c: 21, r: 12, ic: "🏁", n: "レース場へつづく坂", hint: "坂をのぼる", area: "race" },
      // ★T3 隠しスポット：条件を満たすまで**存在ごと見せない**（fail-closed）。
      { c: 17, r: 16, ic: "❓", n: "路地裏の気配", hint: "路地をのぞく", stay: true, hidden: "ura_bistro",
        go: function () { kwShoot("ura_bistro"); } },
    ],
    npcs: [
      { c: 15, r: 13, s: 0, line: "この広場はね、船が入る朝がいちばん騒がしいんだ。" },
      { c: 12, r: 17, s: 1, line: "市場の湯気、いい匂いでしょう。つい寄っちゃうのよね。" },
      { c: 7, r: 15, s: 2, line: "今日の海は凪だ。桟橋から山がよく見えるよ。" },
    ],
  },

  race: {
    name: "聖龍レース場・前庭", img: "images/scene/konron/race.webp",
    start: { c: 16, r: 11 },
    map: [
      "################################", // r0  客席の外壁（大門もこの帯の中）
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "################################", // r4  c14-c17 が大門のアーチ
      "################################", // r5
      "################################", // r6
      "################################", // r7
      "..###########...................", // r8  券売所と屋台の列／広場の上端
      "....#########...................", // r9
      "....#########...................", // r10
      "................................", // r11 広場
      "................................", // r12
      "##.........###....####.###....##", // r13 椰子の花壇（丸い植え込み）
      "##.........###....####.###....##", // r14
      "##.........###....####.###....##", // r15
      "................................", // r16
      "########........................", // r17 左は厩の柵
      "#############..###########..####", // r18 石の欄干（切れ目＝階段）
      "#############..###########..####", // r19
      "################################", // r20 下の段（画面外扱い）
      "################################", // r21
      "################################", // r22
      "################################", // r23
    ],
    doors: [
      { c: 15, r: 8, ic: "🏟️", n: "中央聖龍レース場", hint: "大門をくぐる",
        go: function () { if (typeof renderRaceSelect === "function") renderRaceSelect(); } },
      { c: 20, r: 17, ic: "📷", n: "欄干からの眺め", hint: "写真をとる", stay: true,
        go: function () { kwShoot("racecourse"); } },
      { c: 8, r: 11, ic: "🍢", n: "場外の屋台", hint: "食べていく",
        go: function () { if (typeof renderMeals === "function") renderMeals(); } },
      { c: 1, r: 9, ic: "🏙️", n: "港町へもどる坂", hint: "坂をくだる", area: "city" },
      { c: 27, r: 17, ic: "♨️", n: "温泉郷へつづく道", hint: "湯けむりの方へ", area: "onsen" },
    ],
    npcs: [
      { c: 13, r: 12, s: 3, line: "ぼく、いつか自分の竜であそこを走るんだ！" },
      { c: 22, r: 16, s: 4, line: "本日の第一。荒れますよ、この風は。" },
    ],
  },

  onsen: {
    name: "ウロコトロ温泉郷", img: "images/scene/konron/onsen.webp",
    start: { c: 21, r: 13 },
    map: [
      "################################", // r0  岩肌と竹林／上段は湯屋2棟
      "################################", // r1
      "################################", // r2
      "################################", // r3
      "############...######.##########", // r4  湯屋のあいだの小径（c12-c14）
      "############...######.##########", // r5
      "############...######.##########", // r6
      "############...######.##########", // r7
      "#############.........##########", // r8  湯屋の前の土間
      "############.............#######", // r9
      "############....################", // r10 板の渡り廊下（c12-c15）と柵
      "############....################", // r11
      "####.........#######.....#######", // r12 中央の湯／右手の開けた地面
      "####.........#######.....#######", // r13
      "############.#######.....#######", // r14 左下の湯がはじまる
      "############.#######........####", // r15
      "############...........#########", // r16 下の広い土間
      "############...........#########", // r17
      "############...........#########", // r18
      "##############....##############", // r19 鳥居の下だけ通れる
      "##############....##############", // r20
      "################################", // r21
      "################################", // r22
      "################################", // r23
    ],
    doors: [
      { c: 20, r: 13, ic: "♨️", n: "湯けむりの露天", hint: "写真をとる", stay: true,
        go: function () { kwShoot("uroko"); } },
      { c: 24, r: 13, ic: "🍵", n: "休憩処", hint: "ひと息つく", stay: true,
        go: function () { kwToast("🍵 湯上がりの甘酒。……ふう、と息が出る。"); } },
      { c: 13, r: 5, ic: "🏁", n: "レース場へもどる道", hint: "小径をもどる", area: "race" },
      { c: 15, r: 19, ic: "🏝️", n: "鳥居をくぐって島の地図へ", hint: "この日の島時間をとじる",
        go: function () { if (typeof renderKonronMap === "function") renderKonronMap(); } },
    ],
    npcs: [
      { c: 21, r: 16, s: 5, line: "湯にはね、負けた日ほど長く浸かるのがいいのよ。" },
      { c: 14, r: 9, s: 1, line: "ここのお湯、竜の鱗にも効くんですって。" },
    ],
  },
};

// 背景の実測がまだのエリア用の安全な既定枠（外周を壁にした広間＝落ちない・進める）
const KW_FALLBACK_MAP = (function () {
  const rows = [];
  for (let r = 0; r < KW_ROWS; r++) {
    let s = "";
    for (let c = 0; c < KW_COLS; c++) s += (r < 8 || r > 21 || c < 4 || c > 27) ? "#" : ".";
    rows.push(s);
  }
  return rows;
})();

let KW = null;   // 現在のシーン状態（表示専用）

function kwArea() { return (KW && KW.area) || KW_AREAS.city; }
function kwMap() { const a = kwArea(); return a.map || KW_FALLBACK_MAP; }
function kwCell(c, r) {
  if (c < 0 || r < 0 || c >= KW_COLS || r >= KW_ROWS) return "#";
  const row = kwMap()[r];
  return row ? (row[c] || "#") : "#";
}
function kwBlocked(wx, wy) { return kwCell(Math.floor(wx / KW_CW), Math.floor(wy / KW_CH)) === "#"; }

// 隠しスポットは条件を満たすまで**存在ごと出さない**（副作用のある _kmHiddenOk ではなく生の条件を見る）
function kwDoorVisible(d) {
  if (!d.hidden) return true;
  try { const h = (typeof KM_HIDDEN !== "undefined") && KM_HIDDEN[d.hidden]; return !!(h && h.cond()); }
  catch (e) { return false; }
}
function kwDoors() { return (kwArea().doors || []).filter(kwDoorVisible); }
function kwDoorAt(wx, wy) {
  const c = Math.floor(wx / KW_CW), r = Math.floor(wy / KW_CH);
  return kwDoors().find(d => Math.abs(d.c - c) <= 1 && Math.abs(d.r - r) <= 1) || null;
}

// ── 時間帯パレット（_kmIslandNow と連動＝島の一日と歩く景色をそろえる）
const KW_TINT = {
  "未明":   { col: "#1b2b55", a: 0.42, mode: "multiply" },
  "朝":     { col: "#ffe9c2", a: 0.14, mode: "source-over" },
  "昼":     { col: "#fff6e0", a: 0.05, mode: "source-over" },
  "夕暮れ": { col: "#ff9a4d", a: 0.22, mode: "source-over" },
  "宵":     { col: "#4a2f6b", a: 0.30, mode: "multiply" },
  "夜":     { col: "#16224a", a: 0.44, mode: "multiply" },
};
function kwNow() {
  try { return (typeof _kmIslandNow === "function") ? _kmIslandNow() : { k: "昼", ic: "☀️" }; }
  catch (e) { return { k: "昼", ic: "☀️" }; }
}

function kwShoot(id) {
  if (typeof _kmStartShoot === "function") _kmStartShoot(id);
  else kwToast("📷 いまは撮れない。");
}
// 宿の人の一言＝門番を通す（未登場のキャラの名前は出さない）
function kwTalkKeeper() {
  const met = (typeof rpgKeeperMet === "function" && rpgKeeperMet());
  const who = met ? "スミカ" : "宿の人";
  const line = met
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
// エリア移動＝シーンを作り直す（設計書 §2「入場でロード／退場で破棄」に従う）
function kwGo(areaId) { kwExit(); renderKonronWalk(areaId); }

// ── 画面：歩いてまわる（β）
function renderKonronWalk(areaId) {
  if (typeof konronMapUnlocked === "function" && !konronMapUnlocked()) { renderKonronMap(); return; }
  if (typeof Scene === "undefined" || !Scene.create) { renderKonronMap(); return; }
  const area = KW_AREAS[areaId] || KW_AREAS.city;
  state.ui.screen = "konron_walk";
  const app = beginScreen();
  app.classList.add("kw-page");

  const now = kwNow();
  const hud = document.createElement("div");
  hud.className = "kw-hud";
  hud.innerHTML =
    '<button class="kw-back">← 島の地図へ</button>' +
    '<div class="kw-title">🚶 ' + area.name + 'をあるく <span class="kw-beta">β</span></div>' +
    '<div class="kw-when">' + now.ic + " " + now.k + "</div>" +
    '<div class="kw-toast"></div>' +
    '<div class="kw-prompt"></div>';
  app.appendChild(hud);
  hud.querySelector(".kw-back").onclick = () => { kwExit(); renderKonronMap(); };

  const stage = document.createElement("div");
  stage.className = "kw-stage";
  app.appendChild(stage);

  const imgs = { bg: area.img + "?v=" + KW_V, mimi: "images/scene/konron/mimi_walk.webp?v=" + KW_V };
  imgs.folk = "images/scene/konron/folk.webp?v=" + KW_V;                    // すれちがいNPC（欠けても動く）
  if (typeof poroFound === "function" && poroFound()) imgs.poro = "images/scene/konron/poro_walk.webp?v=" + KW_V;

  const scene = Scene.create({
    mount: stage,
    assets: { images: imgs },
    onLoad: function (a, S) { kwSetup(a, S); },
    onUpdate: function (dt, S) { kwUpdate(dt, S); },
    onDraw: function (ctx, cam, layer, S, t) { kwDraw(ctx, cam, layer, S, t); },
    onAct: function () { kwAct(); },
    onExit: function () { KW = null; },
  });

  KW = { scene: scene, hud: hud, area: area, mimi: null, near: null, dir: 0, step: 0, moving: false, trail: [], npcs: [] };
}

function kwSetup(a, S) {
  if (!KW) return;
  const ar = KW.area, st = ar.start || { c: 16, r: 11 };
  KW.mimi = { x: (st.c + 0.5) * KW_CW, y: (st.r + 0.5) * KW_CH };
  if (kwBlocked(KW.mimi.x, KW.mimi.y)) {                 // 万一ふさがっていたら近くの歩ける所へ逃がす
    outer: for (let r = 8; r < KW_ROWS; r++) for (let c = 0; c < KW_COLS; c++) {
      if (kwCell(c, r) === ".") { KW.mimi = { x: (c + 0.5) * KW_CW, y: (r + 0.5) * KW_CH }; break outer; }
    }
  }
  KW.sheet = a.mimi || null;
  KW.bg = a.bg || null;
  KW.folk = a.folk || null;
  KW.poroImg = a.poro || null;
  KW.trail = [];
  // すれちがいNPC＝歩ける範囲をゆっくり気ままに歩く
  KW.npcs = (ar.npcs || []).map(function (n) {
    return { x: (n.c + 0.5) * KW_CW, y: (n.r + 0.5) * KW_CH, s: n.s | 0, line: n.line,
             vx: 0, vy: 0, wait: Math.random() * 2, step: Math.random() * 4 };
  });
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

  // ポロ随行＝足あとを溜めて、少し遅れて同じ道をついてくる（poroFound後のみ）。
  //   ★足あとは「フレーム」ではなく「距離」で刻む。壁に押しつけている間は進んでいないので、
  //     フレームで刻むと同じ座標が溜まってポロがミミに重なってしまう（実機で踏んだ）。
  if (KW.poroImg) {
    const last = KW.trail[KW.trail.length - 1];
    if (!last || Math.hypot(m.x - last.x, m.y - last.y) > 7) {
      KW.trail.push({ x: m.x, y: m.y, d: KW.dir, f: KW.face });
      if (KW.trail.length > 13) KW.trail.shift();          // 13点×7px ≒ 90px ぶん後ろをついてくる
    }
    KW.poro = (KW.trail.length >= 13) ? KW.trail[0] : null;
  }

  // NPC＝気ままに一歩ずつ。壁とマップ外には入らない
  for (let k = 0; k < KW.npcs.length; k++) {
    const n = KW.npcs[k];
    n.wait -= dt;
    if (n.wait <= 0) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
      const p = dirs[(Math.random() * dirs.length) | 0];
      n.vx = p[0]; n.vy = p[1];
      n.wait = 0.9 + Math.random() * 1.8;
    }
    if (n.vx || n.vy) {
      const s2 = 52 * dt;
      const nx = n.x + n.vx * s2, ny = n.y + n.vy * s2;
      if (!kwBlocked(nx, n.y)) n.x = nx; else n.vx = 0;
      if (!kwBlocked(n.x, ny)) n.y = ny; else n.vy = 0;
      n.step += dt * 5;
    }
  }

  // カメラ＝ミミを中心に、地図の外は見せない
  const sc = kwScale(S), vw = S.vw / sc, vh = S.vh / sc;
  S.camera.x = Math.max(0, Math.min(Math.max(0, KW_MAPW - vw), m.x - vw / 2));
  S.camera.y = Math.max(0, Math.min(Math.max(0, KW_MAPH - vh), m.y - vh / 2));
  S.camera.sc = sc; S.camera.vw = vw; S.camera.vh = vh;

  // いちばん近いもの（入口 or NPC）→プロンプト
  let target = kwDoorAt(m.x, m.y), kind = "door";
  if (!target) {
    const n = KW.npcs.find(n2 => Math.abs(n2.x - m.x) < KW_CW * 1.1 && Math.abs(n2.y - m.y) < KW_CH * 1.1);
    if (n) { target = n; kind = "npc"; }
  }
  if (target !== KW.near) {
    KW.near = target; KW.nearKind = kind;
    const p = KW.hud && KW.hud.querySelector(".kw-prompt");
    if (p) {
      if (target && kind === "door") {
        p.innerHTML = '<span class="kw-p-ic">' + target.ic + "</span><b>" + target.n + "</b><small>🔍 で" + target.hint + "</small>";
        p.classList.add("on");
      } else if (target) {
        p.innerHTML = '<span class="kw-p-ic">💬</span><b>島の人</b><small>🔍 で話しかける</small>';
        p.classList.add("on");
      } else p.classList.remove("on");
    }
  }
}

function kwAct() {
  if (!KW || !KW.near) { kwToast("🔍 ……とくに何もない。"); return; }
  const d = KW.near;
  try { if (window.Sfx) Sfx.play("nav"); } catch (e) {}
  if (KW.nearKind === "npc") { kwToast("💬 「" + d.line + "」"); return; }
  if (d.area) { kwGo(d.area); return; }                  // エリア移動
  if (d.stay) { try { d.go(); } catch (e) {} return; }   // その場に留まる（オーバーレイ／一言）
  kwExit();
  try { d.go(); } catch (e) { if (typeof renderKonronMap === "function") renderKonronMap(); }
}

// シートから1コマ描く（96×128セル）。row=0正面 1背中 2横（横は左向き素材＝右向きは反転）
function kwDrawCell(ctx, sheet, col, row, sx, sy, H, flip) {
  const W = H * (96 / 128);
  ctx.save();
  if (flip) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
  ctx.drawImage(sheet, col * 96, row * 128, 96, 128, sx - W / 2, sy - H, W, H);
  ctx.restore();
}
function kwShadow(ctx, sx, sy, w, h) {
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(sx, sy, w, h, 0, 0, 7); ctx.fill(); ctx.restore();
}

function kwDraw(ctx, cam, layer, S, t) {
  if (!KW || !KW.mimi) return;
  const sc = cam.sc || kwScale(S);

  if (layer === "bgFar") {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (KW.bg) ctx.drawImage(KW.bg, cam.x, cam.y, cam.vw, cam.vh, 0, 0, S.vw, S.vh);
    else { ctx.fillStyle = "#c8b48a"; ctx.fillRect(0, 0, S.vw, S.vh); }   // 画像が無くても歩ける
    ctx.restore();
    // ★時間帯パレット＝島の一日（_kmIslandNow）と歩く景色をそろえる
    const tint = KW_TINT[kwNow().k];
    if (tint && tint.a > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = tint.mode;
      ctx.globalAlpha = tint.a; ctx.fillStyle = tint.col;
      ctx.fillRect(0, 0, S.vw, S.vh);
      ctx.restore();
    }
    return;
  }
  if (layer !== "world") return;

  const m = KW.mimi;
  const H = 118 * sc;

  // ── すれちがいNPC（ミミより奥の人から順に）
  const folkH = H * 0.94;
  KW.npcs.slice().sort((a, b) => a.y - b.y).forEach(function (n) {
    const px = (n.x - cam.x) * sc, py = (n.y - cam.y) * sc;
    if (px < -60 || py < -80 || px > S.vw + 60 || py > S.vh + 60) return;
    kwShadow(ctx, px, py, folkH * 0.22, folkH * 0.05);
    if (KW.folk) {
      const col = n.s % 3, row = (n.s / 3) | 0;
      ctx.save();
      ctx.drawImage(KW.folk, col * 96, row * 128, 96, 128, px - folkH * (96 / 128) / 2, py - folkH, folkH * (96 / 128), folkH);
      ctx.restore();
    } else {
      ctx.save(); ctx.font = Math.round(folkH * 0.62) + "px serif"; ctx.textAlign = "center";
      ctx.fillText("🧍", px, py); ctx.restore();
    }
  });

  // ── ポロ（ミミの少し後ろを、ちょこちょこ跳ねてついてくる）
  //   ポロの立ち絵は正面1枚しかないので、歩行コマではなく**跳ね**で歩いてる感じを出す。
  if (KW.poro && KW.poroImg) {
    const p = KW.poro;
    const ph = H * 0.60, pw = ph * (KW.poroImg.naturalWidth / KW.poroImg.naturalHeight);
    const hop = (KW.moving && !S.reduce) ? Math.abs(Math.sin(KW.step * 1.6)) * ph * 0.10 : 0;
    const px = (p.x - cam.x) * sc, py = (p.y - cam.y) * sc;
    kwShadow(ctx, px, py, pw * 0.34, ph * 0.055);
    ctx.save();
    if (p.f < 0) { ctx.translate(px, 0); ctx.scale(-1, 1); ctx.translate(-px, 0); }   // 進む向きに体を向ける
    ctx.drawImage(KW.poroImg, px - pw / 2, py - ph - hop, pw, ph);
    ctx.restore();
  }

  // ── ミミ
  const sx = (m.x - cam.x) * sc, sy = (m.y - cam.y) * sc;
  kwShadow(ctx, sx, sy, H * (96 / 128) * 0.30, H * 0.055);
  if (KW.sheet) {
    const col = KW.moving ? [1, 0, 1, 2][Math.floor(KW.step) % 4] : 1;
    kwDrawCell(ctx, KW.sheet, col, KW.dir, sx, sy, H, KW.dir === 2 && KW.face > 0);
  } else {
    ctx.fillStyle = "#ffd7e6"; ctx.fillRect(sx - H * 0.28, sy - H, H * 0.56, H);
  }

  // ── 入口の道標＝ドット絵の町に馴染む「灯り＋下向きの矢」。絵文字はHUDのプロンプト側で見せる。
  //   ★着いた入口には描かない（プロンプトが役目を引き継ぐ／ミミに重ならない）。
  kwDoors().forEach(function (d) {
    if (KW.near === d) return;
    const dx = (d.c + 0.5) * KW_CW, dy = (d.r + 0.5) * KW_CH;
    const px = (dx - cam.x) * sc, py = (dy - cam.y) * sc - 26 * sc;
    if (px < -40 || py < -40 || px > S.vw + 40 || py > S.vh + 40) return;
    const bob = S.reduce ? 0 : Math.sin(t / 520 + d.c) * 2.4 * sc;
    const R = Math.max(3, 4.6 * sc);
    const hid = !!d.hidden;                                  // 隠しは白い「？」の煙として立つ
    ctx.save();
    ctx.translate(px, py + bob);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 3.4);
    if (hid) { g.addColorStop(0, "rgba(220,240,255,.9)"); g.addColorStop(1, "rgba(200,225,255,0)"); }
    else { g.addColorStop(0, "rgba(255,214,140,.85)"); g.addColorStop(1, "rgba(255,190,90,0)"); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 3.4, 0, 7); ctx.fill();
    if (hid) {
      ctx.fillStyle = "#f2f8ff"; ctx.strokeStyle = "rgba(30,40,60,.8)"; ctx.lineWidth = Math.max(1, sc * 0.8);
      ctx.font = "bold " + Math.round(R * 3.2) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeText("？", 0, 0); ctx.fillText("？", 0, 0);
    } else {
      ctx.fillStyle = "#ffe8b0"; ctx.strokeStyle = "rgba(60,34,10,.85)"; ctx.lineWidth = Math.max(1, sc);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-R * 0.85, R * 1.7); ctx.lineTo(R * 0.85, R * 1.7); ctx.lineTo(0, R * 3.0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  });
}
