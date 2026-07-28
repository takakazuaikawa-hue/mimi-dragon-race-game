// =========================================================================
// 🕶️ モール一人称ビュー：3Dレンダラ（既定ON・テクスチャ質感＋ネオン輪郭）
//   "生成テクスチャの壁/床＋ネオンの管で奥へ伸びる回廊"。
//   外部ライブラリ無し・純キャンバスで一点透視のパース投影＝ビルド無しのまま動く。
//
//   差し替えの作法（docs/RENDERER_ABSTRACTION.md）に従い、mall_rpg.js は無改変。
//   window.MallRender.backends["3d"] に登録するだけ。
//   ★既定＝"3d"（ユーザー決裁 2026-07-26）。ただし初回1秒の実測fpsが30未満なら
//     自動で "2d" にフォールバック（性能ゲート）。手動退避は ?mall2d ／ mallView3D(false)。
//   ※ scene は rpgBuildViewScene() の純データ（accent / dusk / openAir / sunset / ahead / cell）。
//      数値計算には一切触れない（表示専用）。
//
//   テクスチャ：images/rpg/tex/<slug>_<wall|floor|ceil>.webp（512シームレス）。
//   無い／読めない／低速端末／prefers-reduced-motion のときは**現行の単色**に自動フォールバック。
// =========================================================================
(function () {
  if (typeof window === "undefined") return;

  var MAXD = 5;        // 何セル先まで見えるか
  var P = 0.62;        // 透視の縮小率（1セット奥へ＝×P）
  var VY = 0.46;       // 消失点の高さ（画面比）
  var LNP = Math.log(P);

  function isWall(c) { return (typeof rpgIsWall === "function") ? rpgIsWall(c) : (c === "#"); }
  function fit(cv) { if (typeof rpgFitCanvas === "function") rpgFitCanvas(cv); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ── テクスチャ台帳 ─────────────────────────────────────────────
  var TEX_V = "20260728b";   // ceil追加時にバンプ（旧URLの404が挟まらないように）                       // キャッシュ撃破
  var TEX_DIR = "images/rpg/tex/";
  // RPG_FLOORS の並び（1F..屋上）。タワー層など範囲外は "tower" を共用。
  var TEX_SLUG = ["beach", "pool", "gourmet", "sea", "luxe", "depart", "fes", "sunset"];
  var texCache = {};                              // key -> {img:Image|null, ok:bool}
  var TEX_OK = true;                              // 端末側の許可（低速/reduced-motionで落とす）
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) TEX_OK = false;
    if (navigator && navigator.deviceMemory && navigator.deviceMemory <= 2) TEX_OK = false;
  } catch (e) {}

  function texOf(floor, kind) {
    if (!TEX_OK) return null;
    var slug = TEX_SLUG[floor] || "tower";
    var key = slug + "_" + kind;
    var e = texCache[key];
    if (e === undefined) {
      e = texCache[key] = { img: null, ok: false };
      var im = new Image();
      im.decoding = "async";
      im.onload = function () { if (im.naturalWidth > 0) { e.img = im; e.ok = true; } };
      im.onerror = function () { e.ok = false; e.img = null; };
      im.src = TEX_DIR + key + ".webp?v=" + TEX_V;
    }
    return e.ok ? e.img : null;
  }

  // depth z(>=0) の「開口（セル境界）」矩形。z=0 は画面いっぱい、奥ほど小さく中心へ。
  function opening(W, H, cx, cy, z) {
    var s = Math.pow(P, z);
    return { l: cx - W * 0.5 * s, r: cx + W * 0.5 * s, t: cy - H * 0.5 * s, b: cy + H * 0.5 * s, s: s };
  }

  function fillQuad(ctx, pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  // ネオンの輪郭線（発光）。segs=[[ [x,y],[x,y] ], ...]
  function neon(ctx, segs, col, w, blur) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
    ctx.shadowColor = col; ctx.shadowBlur = blur;
    ctx.beginPath();
    for (var i = 0; i < segs.length; i++) { ctx.moveTo(segs[i][0][0], segs[i][0][1]); ctx.lineTo(segs[i][1][0], segs[i][1][1]); }
    ctx.stroke(); ctx.restore();
  }

  // ── 側壁テクスチャ：縦ストライプで奥行きサンプリング（レイキャスタと同系の手法）
  //    側壁は depth dd..dd+1 の台形。画面xから s→z を逆算し、u=z-dd で texture 列を引く。
  function texSideWall(ctx, tex, nO, fO, side, dd, W, H, cx, cy) {
    var x0 = side < 0 ? nO.l : nO.r, x1 = side < 0 ? fO.l : fO.r;
    var dir = x1 >= x0 ? 1 : -1, tw = tex.width, th = tex.height;
    var step = 1, half = W * 0.5, hh = H * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nO[side < 0 ? "l" : "r"], nO.t); ctx.lineTo(fO[side < 0 ? "l" : "r"], fO.t);
    ctx.lineTo(fO[side < 0 ? "l" : "r"], fO.b); ctx.lineTo(nO[side < 0 ? "l" : "r"], nO.b);
    ctx.closePath(); ctx.clip();
    for (var x = x0; dir > 0 ? x <= x1 : x >= x1; x += dir * step) {
      var s = side * (x - cx) / half;
      if (s <= 0.0001) continue;
      var z = Math.log(s) / LNP;
      var u = clamp(z - dd, 0, 0.9999);
      var top = cy - hh * s, bot = cy + hh * s;
      ctx.drawImage(tex, u * tw, 0, 1, th, x, top, step + 1, bot - top);
    }
    ctx.restore();
  }

  // ── 床/天井テクスチャ：横ストライプで焼き込み（サイズ×フロアでキャッシュ＝毎フレーム再計算しない）
  var bakeCache = {};
  function bakedPlane(W, H, cx, cy, tex, key, isFloor) {
    var ck = key + "|" + W + "x" + H + "|" + (isFloor ? "f" : "c");
    if (bakeCache[ck]) return bakeCache[ck];
    var off = document.createElement("canvas"); off.width = W; off.height = H;
    var c = off.getContext("2d");
    var tw = tex.width, th = tex.height, half = W * 0.5, hh = H * 0.5;
    var yEnd = isFloor ? H : 0, dirY = isFloor ? 1 : -1;
    var y0 = isFloor ? Math.ceil(cy + hh * Math.pow(P, MAXD)) : Math.floor(cy - hh * Math.pow(P, MAXD));
    for (var y = y0; isFloor ? y < yEnd : y > yEnd; y += dirY) {
      var s = Math.abs(y - cy) / hh;
      if (s <= 0.0001) continue;
      var z = Math.log(s) / LNP;
      var v = z - Math.floor(z);
      var xl = cx - half * s, xr = cx + half * s;
      c.drawImage(tex, 0, v * th, tw, 1, xl, y, xr - xl, 1);
    }
    bakeCache[ck] = off;
    if (Object.keys(bakeCache).length > 24) bakeCache = {};   // 際限なく貯めない
    return off;
  }

  // ── 敵の“接近する影”（G1b）─────────────────────────────────────
  //   この迷宮の敵は**ランダムエンカウント**で、床に置かれて歩き回るわけではない。
  //   ＝敵は必ず正面から見える。だから8方向ビルボードは要らず、既存の512透過アートを
  //     そのまま回廊に立てれば「そこに居る」が出る。
  //   出す窓＝rpgFx.telegraph の予兆（踏み込んでから戦闘突入までの一拍）。
  //   まだ敵は抽選されていないので、そのフロアの出現表から1体を選んで**影**として見せる
  //   （正体は突入後の名前カットインで割れる＝既存の流れを壊さない）。
  var tele = null;                       // {t0, dur, id, ic}
  var silCache = {};                     // id -> 影にした offscreen canvas
  var warmed = {};                       // フロア別：出現表の敵アートを先読み済みか

  // 予兆はわずか470ms。そこで初めて画像を読み始めると最初の数コマだけ絵文字が出て“切り替わり”が見える。
  // フロアを描き始めた時点で出現表ぶんを読ませておく（rpgEnemyArt が内部でキャッシュする）。
  function warmFoes(fi) {
    if (warmed[fi]) return;
    warmed[fi] = 1;
    try {
      var fl = (typeof rpgFloorMeta === "function") ? rpgFloorMeta(fi) : null;
      if (!fl || typeof rpgEnemyArt !== "function") return;
      (fl.foes || []).forEach(function (id) { rpgEnemyArt(id); });
      if (fl.nushi && fl.nushi.base) rpgEnemyArt(fl.nushi.base);
    } catch (e) {}
  }

  function silhouetteOf(id) {
    if (silCache[id] !== undefined) return silCache[id];
    var img = (typeof rpgEnemyArt === "function") ? rpgEnemyArt(id) : null;
    if (!img) return null;               // まだ読めていない＝次のフレームで再挑戦（キャッシュしない）
    var o = document.createElement("canvas");
    o.width = img.naturalWidth || 512; o.height = img.naturalHeight || 512;
    var c = o.getContext("2d");
    c.drawImage(img, 0, 0, o.width, o.height);
    c.globalCompositeOperation = "source-in";     // αを保ったまま真っ黒に塗る＝影
    c.fillStyle = "#05070c"; c.fillRect(0, 0, o.width, o.height);
    silCache[id] = o;
    return o;
  }
  // 絵文字しか無い敵の影：ctx.filter に頼ると灰色の塊になって形が読めなかった（実測）。
  // 絵文字を一度オフスクリーンに描いてから source-atop で暗く沈める＝輪郭が残る。
  var emoSil = {};
  function emojiSilhouette(ic) {
    if (emoSil[ic]) return emoSil[ic];
    var S = 256, o = document.createElement("canvas");
    o.width = S; o.height = S;
    var c = o.getContext("2d");
    c.font = Math.round(S * 0.8) + "px serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(ic, S / 2, S * 0.54);
    c.globalCompositeOperation = "source-atop";   // グリフの上だけ暗く（αは触らない）
    c.fillStyle = "rgba(5,7,12,0.93)"; c.fillRect(0, 0, S, S);
    emoSil[ic] = o;
    return o;
  }

  function drawTele(ctx, W, H, cx, cy, u, bright, t) {
    if (!tele) return;
    var p = (t - tele.t0) / tele.dur;
    if (p < 0 || p > 1) { if (p > 1) tele = null; return; }
    var z = 3.0 - 2.85 * p;                        // 奥(3セル)から手前(0.15セル)へ一気に寄ってくる
    var o = opening(W, H, cx, cy, z);
    var hh = (o.b - o.t) * 0.72, cw = hh;          // 床に立つ大きさ
    var by = o.b - (o.b - o.t) * 0.06;
    var sil = silhouetteOf(tele.id) || (tele.ic ? emojiSilhouette(tele.ic) : null);
    if (!sil) return;
    ctx.save();
    ctx.globalAlpha = 0.34 + 0.60 * p;
    ctx.shadowColor = bright + "0.9)"; ctx.shadowBlur = (10 + 26 * p) * u;   // 逆光のふち
    ctx.drawImage(sil, cx - cw / 2, by - hh, cw, hh);
    ctx.restore();
    // 足元の影（浮いて見せない）
    ctx.save();
    ctx.globalAlpha = 0.26 + 0.3 * p;
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx, by, cw * 0.34, hh * 0.055, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ── ミミの前景（G1b）＝一人称の画面下にミミ自身の手と紙袋。「自分がいる」感を出す。
  //   衣装は決裁済みの leonmall 固定（指示書 §5.5）。画像が無ければ何も描かない＝壊れない。
  var fgCache;
  function mimiFg() {
    if (fgCache === undefined) {
      fgCache = null;
      var im = new Image();
      im.decoding = "async";
      im.onload = function () { if (im.naturalWidth > 0) fgCache = im; };
      im.onerror = function () { fgCache = null; };
      im.src = "images/rpg/fg/mimi_hand.webp?v=" + TEX_V;
    }
    return fgCache;
  }
  function drawMimiFg(ctx, W, H, t) {
    var im = mimiFg();
    if (!im) return;
    var h = H * 0.46, w = h * (im.naturalWidth / im.naturalHeight);
    var bob = TEX_OK ? Math.sin(t / 1000 * 1.7) * H * 0.012 : 0;   // 歩きのゆれ（reduced-motionでは止める）
    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.drawImage(im, -w * 0.06, H - h + bob, w, h);
    ctx.restore();
  }

  // rpgFx.telegraph を包む（mall_rpg.js は無改変のまま予兆の中身を受け取るための唯一の接点）。
  function hookTelegraph() {
    if (typeof rpgFx === "undefined" || !rpgFx || typeof rpgFx.telegraph !== "function" || rpgFx.__tele3d) return false;
    var orig = rpgFx.telegraph.bind(rpgFx);
    rpgFx.telegraph = function (kind, cb) {
      try {
        if (window.MALL_RENDERER === "3d" && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          var fl = (typeof rpgFloorMeta === "function" && typeof RPG !== "undefined") ? rpgFloorMeta(RPG.fi) : null;
          var id = null;
          if (kind === "nushi" && fl && fl.nushi) id = fl.nushi.base;
          else if (fl && fl.foes && fl.foes.length) id = fl.foes[(Math.random() * fl.foes.length) | 0];
          if (id) {
            var m = (typeof RPG_MONS !== "undefined") ? RPG_MONS[id] : null;
            tele = { t0: (typeof performance !== "undefined" ? performance.now() : 0), dur: 470, id: id, ic: m && m.ic };
            window.MALL_TELE = tele;
          }
        }
      } catch (e) { tele = null; }
      return orig(kind, cb);
    };
    rpgFx.__tele3d = true;
    return true;
  }

  // ── 性能の目安（★2Dへ自動で落とすのは廃止）
  //    以前は「最初の1秒が30fps未満なら2Dへ退避」していたが、その1秒はテクスチャの復号と
  //    床/天井の焼き込みが重なる**一番重い区間**なので、速い端末でも誤判定した。
  //    実害＝せっかくの3Dが一瞬映って2Dに切り替わる（ユーザー報告）。
  //    ★決裁：ロード時間がかかっても3Dを出す。よってここでは**測るだけ**で、描画方式は変えない。
  //    本当に重い端末は ?mall2d または window.mallView3D(false) で手動退避できる（従来どおり）。
  var gate = { n: 0, acc: 0, last: 0, done: false, skip: 8 };
  function fpsGate(t) {
    if (gate.done) return;
    if (typeof document !== "undefined" && document.hidden) { gate.last = 0; return; }
    if (gate.skip > 0) { gate.skip--; gate.last = t; return; }   // 起動直後のジャンクは数えない
    if (!gate.last) { gate.last = t; return; }
    var dt = t - gate.last; gate.last = t;
    if (dt <= 0 || dt > 500) return;                    // 中断・非表示スロットリングのコマは無視
    gate.acc += dt; gate.n++;
    if (gate.acc < 1000 || gate.n < 12) return;
    gate.done = true;
    window.MALL3D_FPS = Math.round((gate.n * 1000 / gate.acc) * 10) / 10;   // 目安の記録のみ
  }

  function drawDungeon3D(cv, scene, t) {
    fit(cv);
    fpsGate(typeof t === "number" ? t : 0);
    var ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height, cx = W / 2, cy = H * VY, u = W / 470;   // u=DPR込みの寸法単位
    var ac = scene.accent || [120, 160, 200];
    // ネオン強め：加算量UP＋発光(shadowBlur)/線幅を太らせ、暗い部屋の中で管が光っているように見せる
    var bright = "rgba(" + clamp(ac[0] + 112, 0, 255) + "," + clamp(ac[1] + 112, 0, 255) + "," + clamp(ac[2] + 124, 0, 255) + ",";
    var lineW = 2.1 * u, blur = 15 * u;
    var fi = scene.floor | 0;
    warmFoes(fi);                                                   // 予兆に間に合わせる先読み
    var texW = texOf(fi, "wall"), texF = texOf(fi, "floor"), texC = texOf(fi, "ceil");
    var lit = !!texW;                       // テクスチャが載っている時は塗り/線を控えめに

    // ── 背景＝黒い部屋。床/天井をうっすらグラデ、消失点に微かな発光。
    ctx.clearRect(0, 0, W, H);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    if (scene.openAir) {                                  // 屋外フロアは天井側をほんのり明るく
      sky.addColorStop(0, "rgba(" + (ac[0] * 0.18 | 0) + "," + (ac[1] * 0.2 | 0) + "," + (ac[2] * 0.26 | 0) + ",1)");
    } else {
      sky.addColorStop(0, "#04050a");
    }
    sky.addColorStop(0.46, "#05060b");
    sky.addColorStop(0.47, "#070910");
    sky.addColorStop(1, "rgba(" + (ac[0] * 0.10 | 0) + "," + (ac[1] * 0.12 | 0) + "," + (ac[2] * 0.16 | 0) + ",1)");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // ── 床/天井テクスチャ（焼き込み済みを1枚貼るだけ）＋奥ほど暗く落とすフォグ
    if (texF) { ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(bakedPlane(W, H, cx, cy, texF, "f" + fi, true), 0, 0); ctx.restore(); }
    if (texC) { ctx.save(); ctx.globalAlpha = 0.72; ctx.drawImage(bakedPlane(W, H, cx, cy, texC, "c" + fi, false), 0, 0); ctx.restore(); }
    if (texF || texC) {                                   // 消失点へ向かって暗くする（奥行き感）
      var fog = ctx.createRadialGradient(cx, cy, H * 0.02, cx, cy, H * 0.72);
      fog.addColorStop(0, "rgba(2,3,6,0.88)"); fog.addColorStop(1, "rgba(2,3,6,0)");
      ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
    }

    var glow = ctx.createRadialGradient(cx, cy, 2 * u, cx, cy, H * 0.5);
    glow.addColorStop(0, bright + (lit ? "0.20)" : "0.32)")); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // ── どこまで奥に壁があるか（前方の最初の壁＝行き止まり）
    var stop = MAXD, hitFront = false;
    for (var d = 1; d <= MAXD; d++) { if (isWall(scene.cell(d, 0))) { stop = d; hitFront = true; break; } }

    // ── 行き止まりの正面壁（最も奥＝先に描く）
    if (hitFront) {
      var fo = opening(W, H, cx, cy, stop), k = 0.14 * Math.pow(0.74, stop);
      if (texW) {
        ctx.drawImage(texW, 0, 0, texW.width, texW.height, fo.l, fo.t, fo.r - fo.l, fo.b - fo.t);
        fillQuad(ctx, [[fo.l, fo.t], [fo.r, fo.t], [fo.r, fo.b], [fo.l, fo.b]],
          "rgba(2,3,6," + (1 - Math.pow(0.72, stop)).toFixed(3) + ")");
      } else {
        fillQuad(ctx, [[fo.l, fo.t], [fo.r, fo.t], [fo.r, fo.b], [fo.l, fo.b]],
          "rgb(" + (ac[0] * k | 0) + "," + (ac[1] * k | 0) + "," + (ac[2] * k | 0) + ")");
      }
      neon(ctx, [[[fo.l, fo.t], [fo.r, fo.t]], [[fo.r, fo.t], [fo.r, fo.b]], [[fo.r, fo.b], [fo.l, fo.b]], [[fo.l, fo.b], [fo.l, fo.t]]], bright + "0.95)", lineW * 1.15, blur * 1.2);
    }

    // ── 床/天井の奥行きライン（消失点へ集まる回廊の格子＝ブラックルームの骨格）
    var depthN = hitFront ? stop : MAXD;
    for (var z2 = 1; z2 <= depthN; z2++) {
      // 減衰カーブを緩め、奥の方まで管の光が届くように（ネオン強め）
      var o = opening(W, H, cx, cy, z2), a = (lit ? 0.42 : 0.62) * Math.pow(0.8, z2 - 1);
      neon(ctx, [[[o.l, o.b], [o.r, o.b]]], bright + (a * 1.0).toFixed(3) + ")", 1.5 * u, 9 * u);   // 床ライン
      neon(ctx, [[[o.l, o.t], [o.r, o.t]]], bright + (a * 0.62).toFixed(3) + ")", 1.4 * u, 8 * u);  // 天井ライン
    }
    // 四隅から消失点へ伸びる稜線
    var o0 = opening(W, H, cx, cy, 0), oE = opening(W, H, cx, cy, depthN);
    neon(ctx, [
      [[o0.l, o0.b], [oE.l, oE.b]], [[o0.r, o0.b], [oE.r, oE.b]],
      [[o0.l, o0.t], [oE.l, oE.t]], [[o0.r, o0.t], [oE.r, oE.t]],
    ], bright + (lit ? "0.36)" : "0.58)"), 1.5 * u, 9 * u);

    // ── 側壁（左右）：手前0..stop-1 セル。壁のある側だけ台形で塞ぐ（無い側＝横道の暗がり）。
    for (var dd = 0; dd < (hitFront ? stop : MAXD); dd++) {
      var nO = opening(W, H, cx, cy, dd), fO = opening(W, H, cx, cy, dd + 1);
      var kk = 0.16 * Math.pow(0.72, dd);
      var wallCol = "rgb(" + (ac[0] * kk | 0) + "," + (ac[1] * kk | 0) + "," + (ac[2] * kk | 0) + ")";
      var fogA = (1 - Math.pow(0.74, dd + 1)).toFixed(3);
      if (isWall(scene.cell(dd, -1))) {
        if (texW) {
          texSideWall(ctx, texW, nO, fO, -1, dd, W, H, cx, cy);
          fillQuad(ctx, [[nO.l, nO.t], [fO.l, fO.t], [fO.l, fO.b], [nO.l, nO.b]], "rgba(2,3,6," + fogA + ")");
        } else {
          fillQuad(ctx, [[nO.l, nO.t], [fO.l, fO.t], [fO.l, fO.b], [nO.l, nO.b]], wallCol);
        }
        neon(ctx, [[[nO.l, nO.t], [fO.l, fO.t]], [[fO.l, fO.b], [nO.l, nO.b]], [[fO.l, fO.t], [fO.l, fO.b]]], bright + ((lit ? 0.55 : 0.78) * Math.pow(0.86, dd)).toFixed(3) + ")", lineW, blur);
      }
      if (isWall(scene.cell(dd, 1))) {
        if (texW) {
          texSideWall(ctx, texW, nO, fO, 1, dd, W, H, cx, cy);
          fillQuad(ctx, [[nO.r, nO.t], [fO.r, fO.t], [fO.r, fO.b], [nO.r, nO.b]], "rgba(2,3,6," + fogA + ")");
        } else {
          fillQuad(ctx, [[nO.r, nO.t], [fO.r, fO.t], [fO.r, fO.b], [nO.r, nO.b]], wallCol);
        }
        neon(ctx, [[[nO.r, nO.t], [fO.r, fO.t]], [[fO.r, fO.b], [nO.r, nO.b]], [[fO.r, fO.t], [fO.r, fO.b]]], bright + ((lit ? 0.55 : 0.78) * Math.pow(0.86, dd)).toFixed(3) + ")", lineW, blur);
      }
    }

    // ── 前方アイコン（宝箱/階段/出口/ボス）＝ビルボード（発光付き）
    var icons = { treasure: "📦", stairs: "🛗", boss: "🎡", exit: "🚪", wall: null, floor: null };
    if (!cv._noIcons && scene.ahead) {
      for (var ai = 0; ai < scene.ahead.length; ai++) {
        var it = scene.ahead[ai], ic = icons[it.kind];
        if (it.kind === "wall") { if (it.closed) ic = "🚧"; else break; }
        if (!ic) continue;
        var io = opening(W, H, cx, cy, it.d), bob = Math.sin((t || 0) / 1000 * 2.2) * (io.b - io.t) * 0.03;
        ctx.save(); ctx.shadowColor = bright + "1)"; ctx.shadowBlur = 24 * u;
        if (typeof rpgDrawIcon === "function") rpgDrawIcon(ctx, ic, { t: io.t + bob, b: io.b + bob }, cx, cy);
        ctx.restore();
        break;
      }
    }

    // ── 敵の接近シルエット（予兆の一拍）＝アイコンより手前・ビネットより奥
    drawTele(ctx, W, H, cx, cy, u, bright, (typeof t === "number" ? t : 0));

    // ── ビネット（縁を締めて没入）
    var vg = ctx.createRadialGradient(cx, cy, H * 0.30, cx, cy, H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.64)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // ── ミミの手（最前面＝ビネットの上。プレイヤー自身なので暗く沈めない）
    if (!cv._noIcons) drawMimiFg(ctx, W, H, (typeof t === "number" ? t : 0));
  }

  // ── レジストリへ登録（mall_rpg.js のあとに読み込まれる前提。念のため軽くリトライ）
  function register() {
    if (window.MallRender && window.MallRender.backends) { window.MallRender.backends["3d"] = drawDungeon3D; return true; }
    return false;
  }
  function boot() { var a = register(), b = hookTelegraph(); return a && b; }
  if (!boot()) { var tries = 0, iv = setInterval(function () { if (boot() || ++tries > 50) clearInterval(iv); }, 50); }

  // ── 既定＝3D（決裁済）。?mall2d／?view2d で従来の2Dへ退避。?mall3d は互換のため残す。
  try {
    var q = location.search || "";
    if (/[?&](mall2d|view2d)(=1|=on|=true)?(&|$)/.test(q)) window.MALL_RENDERER = "2d";
    else window.MALL_RENDERER = "3d";
  } catch (e) { window.MALL_RENDERER = "3d"; }
  window.mallView3D = function (on) {
    window.MALL_RENDERER = (on === false) ? "2d" : "3d";
    if (on !== false) { gate.done = false; gate.n = 0; gate.acc = 0; gate.last = 0; gate.skip = 8; }   // 手動ONは再計測
    if (typeof renderMallRpg === "function") { try { renderMallRpg(); } catch (e) {} }
    return window.MALL_RENDERER;
  };
})();
