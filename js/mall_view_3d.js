// =========================================================================
// 🕶️ モール一人称ビュー：3Dレンダラ（実証・ブラックルーム調）
//   "黒い部屋＋ネオンの輪郭線で奥へ伸びる回廊"（クラシックな一人称DRPGの質感）。
//   外部ライブラリ無し・純キャンバスで一点透視のパース投影＝ビルド無しのまま動く。
//
//   差し替えの作法（docs/RENDERER_ABSTRACTION.md）に従い、mall_rpg.js は無改変。
//   window.MallRender.backends["3d"] に登録するだけ。既定は "2d" のまま。
//   切替：URLに ?mall3d を付ける／コンソールで mallView3D(true)／window.MALL_RENDERER="3d"
//   ※ scene は rpgBuildViewScene() の純データ（accent / dusk / openAir / sunset / ahead / cell）。
//      数値計算には一切触れない（表示専用）。
// =========================================================================
(function () {
  if (typeof window === "undefined") return;

  var MAXD = 5;        // 何セル先まで見えるか
  var P = 0.62;        // 透視の縮小率（1セット奥へ＝×P）
  var VY = 0.46;       // 消失点の高さ（画面比）

  function isWall(c) { return (typeof rpgIsWall === "function") ? rpgIsWall(c) : (c === "#"); }
  function fit(cv) { if (typeof rpgFitCanvas === "function") rpgFitCanvas(cv); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

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

  function drawDungeon3D(cv, scene, t) {
    fit(cv);
    var ctx = cv.getContext("2d");
    var W = cv.width, H = cv.height, cx = W / 2, cy = H * VY, u = W / 470;   // u=DPR込みの寸法単位
    var ac = scene.accent || [120, 160, 200];
    // ネオン強め：加算量UP＋発光(shadowBlur)/線幅を太らせ、暗い部屋の中で管が光っているように見せる
    var bright = "rgba(" + clamp(ac[0] + 112, 0, 255) + "," + clamp(ac[1] + 112, 0, 255) + "," + clamp(ac[2] + 124, 0, 255) + ",";
    var lineW = 2.1 * u, blur = 15 * u;

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
    var glow = ctx.createRadialGradient(cx, cy, 2 * u, cx, cy, H * 0.5);
    glow.addColorStop(0, bright + "0.32)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // ── どこまで奥に壁があるか（前方の最初の壁＝行き止まり）
    var stop = MAXD, hitFront = false;
    for (var d = 1; d <= MAXD; d++) { if (isWall(scene.cell(d, 0))) { stop = d; hitFront = true; break; } }

    // ── 行き止まりの正面壁（最も奥＝先に描く）
    if (hitFront) {
      var fo = opening(W, H, cx, cy, stop), k = 0.14 * Math.pow(0.74, stop);
      fillQuad(ctx, [[fo.l, fo.t], [fo.r, fo.t], [fo.r, fo.b], [fo.l, fo.b]],
        "rgb(" + (ac[0] * k | 0) + "," + (ac[1] * k | 0) + "," + (ac[2] * k | 0) + ")");
      neon(ctx, [[[fo.l, fo.t], [fo.r, fo.t]], [[fo.r, fo.t], [fo.r, fo.b]], [[fo.r, fo.b], [fo.l, fo.b]], [[fo.l, fo.b], [fo.l, fo.t]]], bright + "0.95)", lineW * 1.15, blur * 1.2);
    }

    // ── 床/天井の奥行きライン（消失点へ集まる回廊の格子＝ブラックルームの骨格）
    var depthN = hitFront ? stop : MAXD;
    for (var z = 1; z <= depthN; z++) {
      // 減衰カーブを緩め、奥の方まで管の光が届くように（ネオン強め）
      var o = opening(W, H, cx, cy, z), a = 0.62 * Math.pow(0.8, z - 1);
      neon(ctx, [[[o.l, o.b], [o.r, o.b]]], bright + (a * 1.0).toFixed(3) + ")", 1.5 * u, 9 * u);   // 床ライン
      neon(ctx, [[[o.l, o.t], [o.r, o.t]]], bright + (a * 0.62).toFixed(3) + ")", 1.4 * u, 8 * u);  // 天井ライン
    }
    // 四隅から消失点へ伸びる稜線
    var o0 = opening(W, H, cx, cy, 0), oE = opening(W, H, cx, cy, depthN);
    neon(ctx, [
      [[o0.l, o0.b], [oE.l, oE.b]], [[o0.r, o0.b], [oE.r, oE.b]],
      [[o0.l, o0.t], [oE.l, oE.t]], [[o0.r, o0.t], [oE.r, oE.t]],
    ], bright + "0.58)", 1.5 * u, 9 * u);

    // ── 側壁（左右）：手前0..stop-1 セル。壁のある側だけ台形で塞ぐ（無い側＝横道の暗がり）。
    for (var dd = 0; dd < (hitFront ? stop : MAXD); dd++) {
      var nO = opening(W, H, cx, cy, dd), fO = opening(W, H, cx, cy, dd + 1);
      var kk = 0.16 * Math.pow(0.72, dd);
      var wallCol = "rgb(" + (ac[0] * kk | 0) + "," + (ac[1] * kk | 0) + "," + (ac[2] * kk | 0) + ")";
      if (isWall(scene.cell(dd, -1))) {
        fillQuad(ctx, [[nO.l, nO.t], [fO.l, fO.t], [fO.l, fO.b], [nO.l, nO.b]], wallCol);
        neon(ctx, [[[nO.l, nO.t], [fO.l, fO.t]], [[fO.l, fO.b], [nO.l, nO.b]], [[fO.l, fO.t], [fO.l, fO.b]]], bright + (0.78 * Math.pow(0.86, dd)).toFixed(3) + ")", lineW, blur);
      }
      if (isWall(scene.cell(dd, 1))) {
        fillQuad(ctx, [[nO.r, nO.t], [fO.r, fO.t], [fO.r, fO.b], [nO.r, nO.b]], wallCol);
        neon(ctx, [[[nO.r, nO.t], [fO.r, fO.t]], [[fO.r, fO.b], [nO.r, nO.b]], [[fO.r, fO.t], [fO.r, fO.b]]], bright + (0.78 * Math.pow(0.86, dd)).toFixed(3) + ")", lineW, blur);
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

    // ── ビネット（縁を締めて没入）
    var vg = ctx.createRadialGradient(cx, cy, H * 0.30, cx, cy, H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.64)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ── レジストリへ登録（mall_rpg.js のあとに読み込まれる前提。念のため軽くリトライ）
  function register() {
    if (window.MallRender && window.MallRender.backends) { window.MallRender.backends["3d"] = drawDungeon3D; return true; }
    return false;
  }
  if (!register()) { var tries = 0, iv = setInterval(function () { if (register() || ++tries > 50) clearInterval(iv); }, 50); }

  // ── 切替ヘルパー：?mall3d で起動時ON／コンソールから mallView3D(true/false)
  try { if (/[?&](mall3d|view3d)(=1|=on|=true)?(&|$)/.test(location.search)) window.MALL_RENDERER = "3d"; } catch (e) {}
  window.mallView3D = function (on) {
    window.MALL_RENDERER = (on === false) ? "2d" : "3d";
    if (typeof renderMallRpg === "function") { try { renderMallRpg(); } catch (e) {} }
    return window.MALL_RENDERER;
  };
})();
