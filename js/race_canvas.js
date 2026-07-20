/**
 * race_canvas.js — the smooth <canvas> race player.
 *
 * Animates the continuous timeline (race_timeline_engine.js) so the player can
 * actually SEE the race: dragons move by true distance on a scrolling track,
 * trade places moment to moment, speed up / slow down, stumble, dig in, tire —
 * and the winner breaks the tape at a real ゴール line. The numbers are never
 * touched here; the on-screen finish order equals raceResult exactly because the
 * timeline guarantees it.
 *
 * Layering: the track + dragons + particles + finish are painted on <canvas>;
 * the HUD (phase / weather / 残り距離 / live rank bar / bet), the Mimi telop, and
 * the buttons are DOM on top (crisp text, reuse existing styles).
 *
 * Public:  startRaceCanvas(container, ctx) → controller (also state.current.racePlayer)
 *          stopRacePlayer()                → stop & detach the active player
 *
 * Depends on: utils.js (el, clamp, fmtCoins), data_dragons.js (dragonColor),
 *   commentary_data.js (commentaryName), data_races.js (raceFullName),
 *   data_weather.js (WEATHERS), race_timeline_engine.js (buildRaceTimeline).
 */

let RC_ACTIVE = null;

function stopRacePlayer() {
  if (RC_ACTIVE) { RC_ACTIVE.stop(); RC_ACTIVE = null; }
  if (typeof RaceBgm !== "undefined") RaceBgm.stop();   // レースBGMも止める
  if (window.Sfx && Sfx.stopCrowd) Sfx.stopCrowd();     // ゴールの歓声ループも止める
}

// ===== 時間帯別の遠景ベース（_bg_render.html「Liminal Horizons」を移植）=====
// 画像アセットではなくゲームのcanvasに直接描く（同じCanvas APIなので雲のblurまで
// 再現／書き出し不要）。レース開始時にオフスクリーンへ一度焼いて毎フレーム転写する。
// この上に既存の地形演出（火山/霧/風…）が重なって「時間帯×地形」になる。
// 地平線(hor)を基準に全要素を配置（馬場上端 ≈ g.top に合わせ、遠景の稜線/聖龍門が
// 馬場の手前に出るようにする）。
var RC_SKY_HOR = 0.40;
var RC_SKY_CONF = {
  morning: { sky:[[0,'#3f6ea3'],[0.3,'#7ba0c4'],[0.6,'#cdd3cf'],[0.82,'#f3dcb8'],[1,'#f7c79a']],
    cel:{x:0.26,y:0.84,r:26,core:'#fff6e0',glow:'#ffd9a0',rays:0.18,moon:0},
    cloud:{lit:'#fff3e2',sh:'#b9b6c0',y:0.42,cover:0.9}, mtnFar:'#9fb0b8',mtnNear:'#5a6f6b',rim:'#ffe7c0',snow:0.25,haze:'#f3dcc0',stars:0,milky:0,grade:['#ffe7c0',0.05] },
  day: { sky:[[0,'#2f72b8'],[0.4,'#5d98cf'],[0.76,'#a8cbe0'],[1,'#dde9e6']],
    cel:{x:0.73,y:0.22,r:20,core:'#ffffff',glow:'#fff6cf',rays:0.12,moon:0},
    cloud:{lit:'#ffffff',sh:'#b4c2cf',y:0.34,cover:1.1}, mtnFar:'#9bbcc4',mtnNear:'#52786a',rim:'#eaffe0',snow:0.4,haze:'#dbe8e2',stars:0,milky:0,grade:['#cfe6ff',0.04] },
  sunset: { sky:[[0,'#21305f'],[0.26,'#5b4a86'],[0.5,'#a55c83'],[0.74,'#e8825a'],[0.9,'#f7b65c'],[1,'#ffd778']],
    cel:{x:0.31,y:0.93,r:40,core:'#fff0c4',glow:'#ff8c45',rays:0.5,moon:0},
    cloud:{lit:'#ffd0a0',sh:'#7c5a78',y:0.44,cover:1.0}, mtnFar:'#9a6f86',mtnNear:'#3a2a40',rim:'#ffb066',snow:0,haze:'#f6a866',stars:0,milky:0,grade:['#ff9a55',0.06] },
  dusk: { sky:[[0,'#10183a'],[0.3,'#2c2a5e'],[0.58,'#5e3f74'],[0.8,'#a85a6e'],[1,'#e08a5a']],
    cel:{x:0.72,y:0.97,r:30,core:'#ffe2b0',glow:'#d66a5e',rays:0.34,moon:0},
    cloud:{lit:'#e7a48c',sh:'#3a2f54',y:0.4,cover:0.85}, mtnFar:'#5a4f7a',mtnNear:'#241d38',rim:'#c87a86',snow:0,haze:'#a85e5a',stars:70,milky:0.25,grade:['#7a5e9a',0.06] },
  night: { sky:[[0,'#05081c'],[0.4,'#0c1336'],[0.74,'#1a2350'],[1,'#2a3463']],
    cel:{x:0.76,y:0.28,r:30,core:'#f4f7ff',glow:'#aac0ee',rays:0,moon:1},
    cloud:{lit:'#5a6694',sh:'#161d3c',y:0.31,cover:0.5}, mtnFar:'#222a52',mtnNear:'#12173e',rim:'#aac0ee',snow:0.2,haze:'#2a3158',stars:220,milky:1,grade:['#1a2a5a',0.05] }
};
function rcHx2(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c;}).join('');var n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255];}
function rcMix2(a,b,t){var A=rcHx2(a),B=rcHx2(b);return'rgb('+Math.round(A[0]+(B[0]-A[0])*t)+','+Math.round(A[1]+(B[1]-A[1])*t)+','+Math.round(A[2]+(B[2]-A[2])*t)+')';}
function rcRgba(h,a){var c=rcHx2(h);return'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
function rcRidgeY(px,W,baseY,amp,seed){var u=px/W;return baseY-amp*(0.5*Math.sin(u*5.2+seed)+0.26*Math.sin(u*11.4+seed*1.7)+0.14*Math.sin(u*22.3+seed*2.3)+0.08*Math.sin(u*41+seed*3.1));}
// ===== レース背景画（Ember Nocturne）。images/racebg/<slug>.webp を地域別ドロップインで
// 差し替え可（RC_BG_SLUG に地域→slug を追記・無ければ fire.webp へ自動フォールバック）。
// 読込完了時 onReady → buildSkyBase 再焼き。表示のみ・レース数値不変。=====
var RC_BG_SLUG = { "カルデラ地域": "fire" };
var _rcBgCache = {};
function rcBgForSlug(slug, fbSlug, onReady) {
  var e = _rcBgCache[slug];
  if (!e) {
    e = _rcBgCache[slug] = { img: new Image(), ok: false, cbs: [] };
    e.img.onload = function () { e.ok = true; e.cbs.splice(0).forEach(function (f) { try { f(); } catch (_) {} }); };
    e.img.onerror = function () {
      if (fbSlug && slug !== fbSlug) { e.img.onerror = null; e.img.src = "images/racebg/" + fbSlug + ".webp"; }   // 代替絵へ
      else e.cbs.length = 0;                                                                                      // 無ければプロシージャル維持
    };
    e.img.src = "images/racebg/" + slug + ".webp";
  }
  if (!e.ok && onReady) e.cbs.push(onReady);
  return e.ok ? e.img : null;
}
function rcBgFor(race, onReady) { return rcBgForSlug(RC_BG_SLUG[race && race.region] || "stadium", "stadium", onReady); }

// ===== R8-W1: 3層パララックス背景 v2（images/racebg_v2/<slug>_L1..L3.webp）=====
// 夜系（夕/黄昏/夜）のレースで一枚絵ベースに代わり、遠景/中景/近景帯を別レートで流す。
// ここは生画像の読込だけ——描画サイズへの焼き込み（ループ化クロスフェード込み）はプレイヤー側 bakePara()。
// 3枚揃わない/読込失敗の地域は従来経路へ自動フォールバック。表示のみ・レース数値不変。
var RC_PARA_SLUG = { "グランドクロック地域": "grandclock", "ルミナ地域": "lumina", "リングロッソ地域": "ringrosso", "カルデラ地域": "caldera", "ミストレイク地域": "mistlake", "ヴェント峡谷地域": "vento", "ノッテムーンライト地域": "notte", "ラパン祭典地域": "lapan" };
// R8-W7: 地域の「光の粒」色（加算発光の漂うモート＝熾火/蛍/星屑/提灯の火の粉…・表示のみ）
var RC_PARA_MOTE = { stadium: "#ffe9a8", grandclock: "#ffd98a", lumina: "#7cd8ff", ringrosso: "#ff9a6a", mistlake: "#9ad2c8", caldera: "#ff9a4d", vento: "#e8d9a8", notte: "#a98fe8", lapan: "#ffb35c" };
var _rcParaCache = {};
// ゲーム時間帯→納品フォルダ（images/racebg_v2_time/<dir>/・5時間帯×9地域×3層=135枚検品済）。
// 納品の evening=夕焼け（明るく赤い）・dusk=黄昏（暗い紫）＝画素実測で対応を決定。
var RC_TIME_DIR = { morning: "morning", day: "noon", sunset: "evening", dusk: "dusk", night: "night" };
function rcParaFor(race, onReady, timeDir) {
  // e.slug は常にベース地域名（旗ゲート/光の粒の色引きが時間帯に依存しないように）。
  // 読込失敗は fail→従来経路（一枚絵/プロシージャル）へ自動フォールバック。
  var base = RC_PARA_SLUG[race && race.region] || "stadium";
  var dir = timeDir || "night";
  var key = dir + "/" + base;
  var e = _rcParaCache[key];
  if (!e) {
    e = _rcParaCache[key] = { slug: base, ok: false, fail: false, n: 0, imgs: [], cbs: [] };
    ["L1", "L2", "L3"].forEach(function (k, i) {
      var im = new Image();
      im.onload = function () { if (++e.n === 3 && !e.fail) { e.ok = true; e.cbs.splice(0).forEach(function (f) { try { f(); } catch (_) {} }); } };
      im.onerror = function () { e.fail = true; e.cbs.length = 0; };
      im.src = "images/racebg_v2_time/" + key + "_" + k + ".webp";
      e.imgs[i] = im;
    });
  }
  if (!e.ok && !e.fail && onReady) e.cbs.push(onReady);
  return e;
}
function rcRenderSkyBase(x, W, H, time, bgImg) {
  var c = RC_SKY_CONF[time] || RC_SKY_CONF.night;
  var hor = H * RC_SKY_HOR, sc = W / 1536;
  var cel = c.cel, sx = cel.x * W, sy = cel.y * hor, isMoon = !!cel.moon;
  var g = x.createLinearGradient(0, 0, 0, hor + H * 0.04); c.sky.forEach(function (s) { g.addColorStop(s[0], s[1]); }); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 背景画があれば：cover配置（絵の地平線≈62%を hor に合わせる）→時間帯トーンで馴染ませる。
  // 絵が描く稜線/火山/都市を使うため、プロシージャルの雲/星/稜線/聖龍門はスキップ。
  var hasBg = !!(bgImg && bgImg.naturalWidth);
  if (hasBg) {
    var iw = bgImg.naturalWidth, ih = bgImg.naturalHeight, IH_HOR = 0.62;
    var s2 = Math.max(W / iw, (hor / IH_HOR) / ih, H / ih);
    var dw = iw * s2, dh = ih * s2;
    var dx = (W - dw) / 2, dy = hor - dh * IH_HOR;
    if (dy > 0) dy = 0; if (dy + dh < H) dy = H - dh;
    x.drawImage(bgImg, dx, dy, dw, dh);
    x.save();
    x.globalCompositeOperation = "soft-light"; x.globalAlpha = 0.6; x.fillStyle = g; x.fillRect(0, 0, W, H);   // 時間帯の色相へ
    // 朝/昼は昼の絵を使うため明度持ち上げは僅かに（夜絵を無理に明るくしない）
    var lift = time === "day" ? 0.05 : time === "morning" ? 0.09 : time === "sunset" ? 0.14 : time === "dusk" ? 0.07 : 0;
    if (lift > 0) { x.globalCompositeOperation = "screen"; x.globalAlpha = 1; x.fillStyle = rcRgba(c.haze, lift); x.fillRect(0, 0, W, H); }
    x.restore();
  }
  if (!hasBg && c.milky) { x.save(); x.translate(W * 0.5, hor * 0.42); x.rotate(-0.5);
    var mw = x.createLinearGradient(0, -H * 0.16, 0, H * 0.16); mw.addColorStop(0, 'rgba(120,140,210,0)'); mw.addColorStop(0.5, rcRgba('#7c8fd6', 0.10 * c.milky)); mw.addColorStop(1, 'rgba(120,140,210,0)'); x.fillStyle = mw; x.fillRect(-W, -H * 0.16, W * 2, H * 0.32);
    x.filter = 'blur(22px)'; for (var mi = 0; mi < 5; mi++) { x.fillStyle = rcRgba(mi % 2 ? '#6a5aa8' : '#4a6ab0', 0.06 * c.milky); x.beginPath(); x.ellipse(-W * 0.4 + mi * W * 0.22, (mi % 2 ? -1 : 1) * H * 0.03, W * 0.16, H * 0.05, 0, 0, 7); x.fill(); } x.filter = 'none'; x.restore(); }
  if (!hasBg && c.stars) { for (var i = 0; i < c.stars; i++) { var rx = ((i * 73.13) % 1), ry = ((i * 131.7) % 1), px = rx * W, py = ry * hor * 0.96, br = 0.25 + ((i * 37) % 100) / 100 * 0.75, big = (i % 17 === 0), r = big ? 1.7 * sc : 0.8 * sc; x.fillStyle = 'rgba(255,255,255,' + (br * (big ? 1 : 0.8)) + ')'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); if (big) { x.strokeStyle = 'rgba(255,255,255,' + (br * 0.5) + ')'; x.lineWidth = 0.6 * sc; x.beginPath(); x.moveTo(px - 3 * sc, py); x.lineTo(px + 3 * sc, py); x.moveTo(px, py - 3 * sc); x.lineTo(px, py + 3 * sc); x.stroke(); } } }
  if (hasBg) { cel = null; }   // 絵に光源（熔岩/月）が描かれている＝太陽/月の二重表示を防ぐ
  var cor; if (cel) { cor = x.createRadialGradient(sx, sy, 0, sx, sy, (cel.r * sc) * 7.5); cor.addColorStop(0, rcRgba(cel.glow, isMoon ? 0.5 : 0.7)); cor.addColorStop(0.3, rcRgba(cel.glow, isMoon ? 0.18 : 0.3)); cor.addColorStop(1, rcRgba(cel.glow, 0)); x.fillStyle = cor; x.fillRect(0, 0, W, H); }
  if (cel && cel.rays > 0) { x.save(); x.translate(sx, sy); x.globalCompositeOperation = 'lighter'; for (var ri = 0; ri < 14; ri++) { var a = ri / 14 * Math.PI * 2 + 0.3, len = (cel.r * sc) * (7 + (ri % 3) * 3); var gr = x.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); gr.addColorStop(0, rcRgba(cel.glow, 0.10 * cel.rays)); gr.addColorStop(1, rcRgba(cel.glow, 0)); x.fillStyle = gr; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - 0.05) * len, Math.sin(a - 0.05) * len); x.lineTo(Math.cos(a + 0.05) * len, Math.sin(a + 0.05) * len); x.closePath(); x.fill(); } x.restore(); }
  if (cel) {
    var disc = x.createRadialGradient(sx - cel.r * sc * 0.3, sy - cel.r * sc * 0.3, cel.r * sc * 0.2, sx, sy, cel.r * sc); disc.addColorStop(0, cel.core); disc.addColorStop(0.7, cel.core); disc.addColorStop(1, rcMix2(cel.core, cel.glow, 0.5)); x.fillStyle = disc; x.beginPath(); x.arc(sx, sy, cel.r * sc, 0, 7); x.fill();
    if (isMoon) { x.fillStyle = rcRgba('#b8c4e0', 0.35); [[0.3, -0.2, 0.22], [-0.25, 0.15, 0.16], [0.1, 0.35, 0.13], [-0.35, -0.3, 0.1]].forEach(function (cr) { x.beginPath(); x.arc(sx + cr[0] * cel.r * sc, sy + cr[1] * cel.r * sc, cr[2] * cel.r * sc, 0, 7); x.fill(); }); }
  }
  function cloud(cx, cy, s, seed) { var rnd = seed || 1, rand = function () { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; }; x.save(); x.filter = 'blur(9px)'; var n = 12 + Math.floor(rand() * 6); for (var i = 0; i < n; i++) { var fx = cx + (rand() - 0.5) * s * 2.4, fy = cy + rand() * s * 0.36, rr = s * (0.24 + rand() * 0.52); x.fillStyle = rcRgba(c.cloud.sh, 0.15); x.beginPath(); x.arc(fx, fy, rr, 0, 7); x.fill(); } for (var j = 0; j < n; j++) { var fx2 = cx + (rand() - 0.5) * s * 2.0, fy2 = cy - rand() * s * 0.52, rr2 = s * (0.2 + rand() * 0.46); x.fillStyle = rcRgba(c.cloud.lit, 0.18); x.beginPath(); x.arc(fx2, fy2, rr2, 0, 7); x.fill(); } x.restore(); }
  if (!hasBg && c.cloud.cover > 0) { var cv2 = c.cloud.cover; cloud(W * 0.17, c.cloud.y * hor, 122 * sc * cv2, 131); cloud(W * 0.50, (c.cloud.y - 0.06) * hor, 94 * sc * cv2, 937); cloud(W * 0.82, (c.cloud.y + 0.03) * hor, 138 * sc * cv2, 613); if (time === 'day' || time === 'morning') { cloud(W * 0.37, (c.cloud.y + 0.12) * hor, 80 * sc, 271); cloud(W * 0.66, (c.cloud.y + 0.02) * hor, 66 * sc, 455); } }
  function range(baseY, amp, seed, col, rimA, snowA) { x.beginPath(); x.moveTo(0, H); var pts = []; for (var px = 0; px <= W; px += 3) { var y = rcRidgeY(px, W, baseY, amp, seed); pts.push([px, y]); x.lineTo(px, y); } x.lineTo(W, H); x.closePath(); x.fillStyle = col; x.fill(); if (rimA > 0) { x.save(); x.lineWidth = 1.6 * sc; x.strokeStyle = rcRgba(c.rim, rimA); x.beginPath(); for (var i = 0; i < pts.length; i++) { if (i === 0) x.moveTo(pts[i][0], pts[i][1]); else x.lineTo(pts[i][0], pts[i][1]); } x.stroke(); x.restore(); } if (snowA > 0) { x.fillStyle = rcRgba('#ffffff', snowA); for (var k = 2; k < pts.length - 2; k++) { var p = pts[k]; if (p[1] < pts[k - 2][1] && p[1] < pts[k + 2][1] && p[1] < baseY - amp * 0.55) { x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] - 4 * sc, p[1] + 7 * sc); x.lineTo(p[0] + 4 * sc, p[1] + 7 * sc); x.closePath(); x.fill(); } } } }
  if (!hasBg) {
    range(hor - 30 * sc, 44 * sc, 1.3, rcMix2(c.mtnFar, c.haze, 0.55), 0.22, 0);
    range(hor - 12 * sc, 60 * sc, 2.6, rcMix2(c.mtnFar, c.mtnNear, 0.4), 0.34, 0);
    range(hor + 12 * sc, 84 * sc, 3.7, c.mtnNear, 0.55, c.snow);
    (function () { var gx = W * 0.6, gy = hor - 2 * sc, col = rcMix2(c.mtnNear, '#000000', 0.3); x.fillStyle = rcRgba(col, 0.95); x.fillRect(gx - 46 * sc, gy - 58 * sc, 9 * sc, 58 * sc); x.fillRect(gx + 37 * sc, gy - 58 * sc, 9 * sc, 58 * sc); x.fillRect(gx - 60 * sc, gy - 66 * sc, 120 * sc, 9 * sc); x.fillRect(gx - 50 * sc, gy - 52 * sc, 100 * sc, 6 * sc); x.beginPath(); x.moveTo(gx - 150 * sc, gy); x.quadraticCurveTo(gx - 188 * sc, gy - 30 * sc, gx - 228 * sc, gy); x.closePath(); x.fill(); x.beginPath(); x.ellipse(gx + 150 * sc, gy, 60 * sc, 24 * sc, 0, Math.PI, 0); x.fill(); x.strokeStyle = rcRgba(c.rim, 0.5); x.lineWidth = 1.2 * sc; x.strokeRect(gx - 60 * sc, gy - 66 * sc, 120 * sc, 2 * sc); })();
  }
  var hb = x.createLinearGradient(0, hor - 90 * sc, 0, hor + 24 * sc); hb.addColorStop(0, rcRgba(c.haze, 0)); hb.addColorStop(0.75, rcRgba(c.haze, 0.32)); hb.addColorStop(1, rcRgba(c.haze, 0.62)); x.save(); x.fillStyle = hb; x.fillRect(0, hor - 90 * sc, W, 114 * sc); x.restore();
  x.save(); x.globalCompositeOperation = 'soft-light'; x.fillStyle = rcRgba(c.grade[0], c.grade[1]); x.fillRect(0, 0, W, H); x.restore();
  var vg = x.createRadialGradient(W / 2, hor * 0.6, H * 0.3, W / 2, hor * 0.6, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,6,14,0.34)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
}
// 時間帯はレース番号で進行：第一=朝 → 第二=昼 → 第三=夕 → 第四=黄昏 → 第五=夜
// （1日の番組が朝から夜へ進むイメージ。演出のみ・結果には無関係）
function rcRaceTime(race) {
  var n = (race && race.number) || 1;
  return n <= 1 ? "morning" : n === 2 ? "day" : n === 3 ? "sunset" : n === 4 ? "dusk" : "night";
}

// Phase-entry banners — a big sweeping caption the instant the field rolls into
// a new act of the race. Indexed to timeline.phaseIndexAt() (序盤/中盤/展開/終盤/
// ゴール前). Index 0 is intentionally blank so the opening act doesn't double up
// with the GO！ burst. Pure presentation: tune freely, the result never changes.
const RC_PHASE_BANNERS = ["", "隊列形成", "中盤の攻防", "直線勝負！", "ゴール前！"];

// ---------- colour helpers ----------
function rcHexToRgb(hex) {
  let h = (hex || "#888").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rcShade(hex, pct) {
  const c = rcHexToRgb(hex);
  const f = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  const r = Math.round((f - c.r) * p) + c.r;
  const g = Math.round((f - c.g) * p) + c.g;
  const b = Math.round((f - c.b) * p) + c.b;
  return `rgb(${r},${g},${b})`;
}
function rcRgba(hex, a) { const c = rcHexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; }
function rcMix(a, b, t) {        // blend two hex colours (t: 0→a, 1→b)
  const ca = rcHexToRgb(a), cb = rcHexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}

// =========================================================================
// Course terrain — turns each race's real early/mid/late SECTION
// (data_courses.js: 上り坂 / 狭路 / 火門 / 霧中 / 大旋回 / 小回り連続 / 上空風路 /
// 起伏地帯 / 混戦橋 / 火山フィニッシュ …) into a DISTINCT on-track look: sky &
// ground tint, a backdrop silhouette, scrolling roadside props, and ambient
// particles. Purely presentational — it reads the already-decided section data
// and never touches progress, odds, payouts or the result.
// =========================================================================
function rcThemeOf(sectionKey) {
  const k = sectionKey || "";
  if (/uphill/.test(k))                return "uphill";
  if (/narrow/.test(k))                return "narrow";
  if (/fire|volcanic/.test(k))         return "fire";
  if (/mist|fog/.test(k))              return "mist";
  if (/aerial|tailwind|wind/.test(k))  return "wind";
  if (/turn/.test(k))                  return "turn";
  if (/rolling/.test(k))               return "rolling";
  if (/bridge/.test(k))                return "bridge";
  return "straight";
}
// sky = 3 gradient stops; ground = 3 stops; accent tints props/particles.
const RC_THEME = {
  straight: { sky: ["#10162e", "#1d2547", "#2a2140"], ground: ["#34502f", "#3c5a37", "#22361f"], accent: "#cfe6ff", amb: null },
  uphill:   { sky: ["#15192f", "#242c4d", "#2d2342"], ground: ["#3b4f2b", "#43562e", "#27371c"], accent: "#bfe0a8", amb: null },
  narrow:   { sky: ["#0e1326", "#1a1f38", "#241d31"], ground: ["#3b4630", "#434a32", "#251f16"], accent: "#e0cf9a", amb: null },
  fire:     { sky: ["#22101f", "#3d1620", "#491f17"], ground: ["#423424", "#4a2f22", "#2a1712"], accent: "#ff9a52", amb: "ember" },
  mist:     { sky: ["#1b2436", "#29334a", "#343c50"], ground: ["#33473a", "#3a4d40", "#21302a"], accent: "#d6e4ee", amb: "fog" },
  wind:     { sky: ["#10203a", "#1d3556", "#27496b"], ground: ["#2f4a3a", "#356040", "#1f3a2a"], accent: "#c4e8ff", amb: "gust" },
  turn:     { sky: ["#121831", "#212b4f", "#2a2344"], ground: ["#33502f", "#3a5a37", "#21361f"], accent: "#ffe06a", amb: null },
  rolling:  { sky: ["#13192e", "#232d49", "#2b2540"], ground: ["#37502e", "#405a35", "#23361d"], accent: "#c2e2aa", amb: "leaf" },
  bridge:   { sky: ["#0f1a30", "#1b2c4a", "#243a52"], ground: ["#2d3f49", "#324a55", "#1c2b33"], accent: "#bcd8e8", amb: null }
};
// Terrain identity for the watcher: an icon for the HUD + the section sign, and a
// translucent full-scene wash so each course's character is felt at a glance. The
// race result is untouched — this is purely how the fixed run is dressed on screen.
const RC_TERRAIN = {
  straight: { icon: "🏁", word: "直線",   tint: null,                     turn: 0 },
  uphill:   { icon: "⛰️", word: "上り坂", tint: "rgba(170,130,70,0.10)",  turn: 0 },
  narrow:   { icon: "🪨", word: "狭路",   tint: "rgba(50,38,24,0.16)",    turn: 0 },
  fire:     { icon: "🌋", word: "火山",   tint: "rgba(255,70,20,0.15)",   turn: 0 },
  mist:     { icon: "🌫️", word: "霧",     tint: "rgba(208,222,234,0.16)", turn: 0 },
  wind:     { icon: "💨", word: "強風",   tint: "rgba(150,200,255,0.09)", turn: 0 },
  turn:     { icon: "🌀", word: "旋回",   tint: "rgba(255,224,106,0.07)", turn: 1 },
  rolling:  { icon: "🏞️", word: "起伏",   tint: "rgba(130,180,100,0.08)", turn: 0 },
  bridge:   { icon: "🌉", word: "橋上",   tint: "rgba(150,200,220,0.10)", turn: 0 }
};
function rcTerrainInfo(key) { return RC_TERRAIN[key] || RC_TERRAIN.straight; }

// =========================================================================
// Pixel dragon, drawn on canvas. Keeps the cute identity (base colour + belly +
// spine), but is fully parameterised so body language reflects the timeline:
// gait tempo & lean from speed, wing flap, head-down + sweat when tiring,
// rotation when stumbling, glow when surging.
// =========================================================================
// =========================================================================
// Pixel-art dragon sprite (DQ-style chibi). The dragon is defined as a few simple
// shapes rasterised ONCE onto a low-res grid with a crisp outline + tight palette,
// then recoloured per dragon and drawn as filled rects. A short wing-flap cycle gives
// the flight animation; a floating bob / lean / tumble are applied at draw time.
// =========================================================================
const RC_DRG = {
  // dims/anchor/eye are filled in by _rcLoadTracedDragon() from images/dragon_ref/ref.png;
  // these defaults match that trace (150×59) so portraits size correctly even before it loads.
  GW: 150, GH: 59, anchorX: 82, anchorY: 56, eyeX: 134, eyeY: 46,
  px: 0.55,                   // on-screen cell size = scale * px (keeps the old in-race footprint width)
  P: {}                       // (legacy; the procedural shape builder below is no longer used)
};
const _RC_INRACE = 0.86;      // in-race sprite scale = _RC_INRACE * laneDepth (raised from 0.66 so the long, low traced dragon reads bigger)
function _rcInEll(gx, gy, cx, cy, rx, ry) { const dx = (gx - cx) / rx, dy = (gy - cy) / ry; return dx * dx + dy * dy <= 1; }
function _rcInRect(gx, gy, x, y, w, h) { return gx >= x && gx < x + w && gy >= y && gy < y + h; }
function _rcSgn(ax, ay, bx, by, cx, cy) { return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy); }
function _rcInTri(px, py, A, B, C) { const d1 = _rcSgn(px, py, A[0], A[1], B[0], B[1]), d2 = _rcSgn(px, py, B[0], B[1], C[0], C[1]), d3 = _rcSgn(px, py, C[0], C[1], A[0], A[1]); return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0))); }
function _rcInPoly(px, py, pts) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
// ---- neon recolour: push the base hue to a vivid, luminous neon ----
function _rcHexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _rcRgbHex(r, g, b) { const f = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); return '#' + f(r) + f(g) + f(b); }
function _rcNeon(hex) {
  let c = _rcHexRgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0, s = 0; const l = (mx + mn) / 2;
  if (d !== 0) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? (((g - b) / d) % 6) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4); h *= 60; if (h < 0) h += 360; }
  s = Math.min(1, s * 1.7 + 0.4); const L = 0.56;
  const cc = (1 - Math.abs(2 * L - 1)) * s, X = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = L - cc / 2;
  let rr, gg, bb;
  if (h < 60) { rr = cc; gg = X; bb = 0; } else if (h < 120) { rr = X; gg = cc; bb = 0; } else if (h < 180) { rr = 0; gg = cc; bb = X; } else if (h < 240) { rr = 0; gg = X; bb = cc; } else if (h < 300) { rr = X; gg = 0; bb = cc; } else { rr = cc; gg = 0; bb = X; }
  return _rcRgbHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}
function _rcDragonShapes(P, flap) {
  // Reference-based dashing two-tone wyvern (facing right): cream belly/wing-upper +
  // charcoal back/wing-membrane, big eye, radiating crest, spiky fish-tail, running legs.
  // Laid out directly in the 72×42 grid space; `flap` (0..1) drives the wing-beat.
  const lift = ((flap == null ? 0.5 : flap) - 0.5) * 5.0;
  const S = [];
  const bx = 34, by = 26.5, brx = 13, bry = 5.3;            // body (low, long)
  const hx = 55.5, hy = 22.0, hr = 7.6;                     // head (forward-right, slightly up)
  const sx = hx + hr * 0.72, sy = hy + hr * 0.5;            // snout tip
  const sh = [bx + brx * 0.52, by - bry * 0.7];             // shoulder

  // FAR wing (behind, darkest) for depth
  { const W = [bx - brx * 0.02, by - bry * 2.9 + lift * 0.7], T = [bx - brx * 0.78, by - bry * 3.7 + lift];
    S.push({ k: 'k', t: 'poly', p: [[sh[0] - 1.4, sh[1]], W, T, [bx - brx * 1.0, by - bry * 1.3 + lift * 0.4], [bx - brx * 0.05, by - bry * 0.2]] }); }

  // TAIL — taper left, cream fin-spikes on top, fish-tail cluster at the tip
  { const tr = bx - brx * 0.92, ty = by, tip = [tr - brx * 1.42, by + bry * 0.8];
    S.push({ k: 'B', t: 'poly', p: [[tr, ty - bry * 0.5], [tr - brx * 0.86, by - bry * 0.05], [tip[0] + 0.5, tip[1] - 1.0], [tip[0] + 0.5, tip[1] + 0.8], [tr - brx * 0.78, by + bry * 0.72], [tr, ty + bry * 0.55]] });
    S.push({ k: 'M', t: 'poly', p: [[tr - brx * 0.24, ty + bry * 0.3], [tr - brx * 0.86, by + bry * 0.52], [tip[0] + 0.6, tip[1] + 0.5], [tip[0] + 1.8, tip[1] - 0.3]] });
    const fb = [[tr - 0.6, ty - bry * 0.42], [tr - brx * 0.5, by - bry * 0.26], [tr - brx * 1.0, by - bry * 0.02], [tr - brx * 1.46, by + bry * 0.32]];
    fb.forEach((p, i) => { const h = 3.2 - i * 0.35; S.push({ k: 'C', t: 'tri', p: [[p[0] - 0.9, p[1] + 0.4], [p[0] + 1.1, p[1] - h], [p[0] + 1.5, p[1] + 0.6]] }); });
    S.push({ k: 'C', t: 'tri', p: [[tip[0] + 1.5, tip[1] - 0.4], [tip[0] - 3.0, tip[1] - 2.9], [tip[0] - 0.3, tip[1] - 0.6]] });
    S.push({ k: 'C', t: 'tri', p: [[tip[0] + 1.5, tip[1] + 0.2], [tip[0] - 3.4, tip[1] + 0.4], [tip[0] - 0.2, tip[1] + 1.2]] });
    S.push({ k: 'M', t: 'tri', p: [[tip[0] + 1.3, tip[1] - 0.2], [tip[0] - 1.3, tip[1] - 0.6], [tip[0] - 1.0, tip[1] + 0.5]] }); }

  // FAR legs (tucked, darker, bent)
  [[-0.42, -1], [0.6, 1]].forEach(d => { const hipx = bx + brx * d[0], hy0 = by + bry * 0.8;
    S.push({ k: 'M', t: 'poly', p: [[hipx, hy0], [hipx + d[1] * 1.3, hy0 + bry * 1.05], [hipx + d[1] * 2.1, hy0 + bry * 0.95], [hipx + d[1] * 0.85, hy0 + bry * 1.95], [hipx + d[1] * 1.45, hy0 + bry * 2.0], [hipx + d[1] * 2.7, hy0 + bry * 0.85], [hipx + d[1] * 1.25, hy0 - bry * 0.1]] }); });

  // BODY
  S.push({ k: 'B', t: 'ell', p: [bx, by, brx, bry] });
  S.push({ k: 'K', t: 'poly', p: [[bx - brx * 1.0, by - bry * 0.05], [bx - brx * 0.55, by - bry * 0.82], [bx + brx * 0.55, by - bry * 0.88], [bx + brx * 1.0, by - bry * 0.02], [bx + brx * 0.55, by - bry * 0.3], [bx - brx * 0.5, by - bry * 0.26]] });   // dark back
  S.push({ k: 'L', t: 'ell', p: [bx + brx * 0.08, by + bry * 0.54, brx * 0.82, bry * 0.5] });   // belly light
  S.push({ k: 'M', t: 'ell', p: [bx - brx * 0.12, by + bry * 0.68, brx * 0.6, bry * 0.3] });    // belly shade
  [-0.5, -0.16, 0.18, 0.5].forEach(fx => { S.push({ k: 'C', t: 'tri', p: [[bx + brx * fx - 0.9, by - bry * 0.78], [bx + brx * fx, by - bry * 1.32], [bx + brx * fx + 0.9, by - bry * 0.78]] }); });   // back ridge

  // NEAR legs (bent running) + claws
  { S.push({ k: 'B', t: 'poly', p: [[bx - brx * 0.32, by + bry * 0.6], [bx - brx * 0.58, by + bry * 1.5], [bx - brx * 0.86, by + bry * 1.4], [bx - brx * 0.96, by + bry * 2.15], [bx - brx * 0.58, by + bry * 2.25], [bx - brx * 0.42, by + bry * 1.5], [bx - brx * 0.04, by + bry * 0.95]] });
    S.push({ k: 'k', t: 'tri', p: [[bx - brx * 1.0, by + bry * 2.1], [bx - brx * 1.32, by + bry * 2.58], [bx - brx * 0.62, by + bry * 2.48]] });
    S.push({ k: 'B', t: 'poly', p: [[bx + brx * 0.6, by + bry * 0.55], [bx + brx * 0.86, by + bry * 1.4], [bx + brx * 1.2, by + bry * 1.3], [bx + brx * 1.32, by + bry * 2.1], [bx + brx * 0.98, by + bry * 2.2], [bx + brx * 0.8, by + bry * 1.45], [bx + brx * 0.86, by + bry * 0.7]] });
    S.push({ k: 'k', t: 'tri', p: [[bx + brx * 0.94, by + bry * 2.05], [bx + brx * 1.5, by + bry * 2.45], [bx + brx * 1.34, by + bry * 2.62]] }); }

  // NECK + HEAD
  S.push({ k: 'B', t: 'poly', p: [[sh[0] - 1.6, sh[1] + 1.0], [hx - hr * 0.84, hy - hr * 0.3], [hx - hr * 0.28, hy + hr * 0.55], [sh[0] + 0.8, sh[1] + 2.8]] });
  S.push({ k: 'K', t: 'poly', p: [[sh[0] - 1.6, sh[1] + 0.5], [hx - hr * 0.9, hy - hr * 0.48], [hx - hr * 0.52, hy - hr * 0.04], [sh[0] - 0.2, sh[1] + 1.4]] });   // dark nape
  S.push({ k: 'B', t: 'ell', p: [hx, hy, hr, hr * 0.88] });
  S.push({ k: 'K', t: 'poly', p: [[hx - hr * 0.92, hy - hr * 0.16], [hx - hr * 0.2, hy - hr * 0.72], [hx + hr * 0.46, hy - hr * 0.48], [hx - hr * 0.28, hy - hr * 0.06]] });   // dark crown
  S.push({ k: 'L', t: 'ell', p: [hx - hr * 0.1, hy + hr * 0.46, hr * 0.64, hr * 0.4] });   // cheek light
  S.push({ k: 'B', t: 'ell', p: [sx - hr * 0.4, sy - hr * 0.04, hr * 0.58, hr * 0.44] });   // muzzle
  S.push({ k: 'L', t: 'ell', p: [sx - hr * 0.48, sy - hr * 0.26, hr * 0.3, hr * 0.17] });   // nose bridge
  S.push({ k: 'n', t: 'rect', p: [sx + hr * 0.08, sy - hr * 0.06, 1.1, 1.1] });             // nostril
  S.push({ k: 'o', t: 'poly', p: [[sx + hr * 0.08, sy + hr * 0.34], [sx + hr * 0.08, sy + hr * 0.46], [sx - hr * 0.92, sy + hr * 0.5], [sx - hr * 0.92, sy + hr * 0.38]] });   // mouth line

  // EYE + brow
  const ex = hx + hr * 0.26, ey = hy - hr * 0.02;
  S.push({ k: 'o', t: 'poly', p: [[ex - hr * 0.5, ey - hr * 0.5], [ex + hr * 0.5, ey - hr * 0.64], [ex + hr * 0.5, ey - hr * 0.44], [ex - hr * 0.5, ey - hr * 0.32]] });   // brow
  S.push({ k: 'e', t: 'ell', p: [ex, ey, hr * 0.4, hr * 0.46] });
  S.push({ k: 'p', t: 'ell', p: [ex + hr * 0.1, ey + hr * 0.1, hr * 0.27, hr * 0.32] });
  S.push({ k: 'g', t: 'ell', p: [ex - hr * 0.12, ey - hr * 0.14, hr * 0.11, hr * 0.13] });

  // NEAR wing — dark membrane + cream radiating bones + scalloped trailing edge
  { const S0 = [sh[0] - 0.4, sh[1] + 0.7];
    const W0 = [bx - brx * 0.04, by - bry * 3.4 + lift * 0.82];
    const T0 = [bx - brx * 0.72, by - bry * 4.4 + lift];
    const f1 = [bx - brx * 1.1, by - bry * 2.8 + lift * 0.5];
    const f2 = [bx - brx * 0.96, by - bry * 1.5 + lift * 0.26];
    const f3 = [bx - brx * 0.58, by - bry * 0.46 + lift * 0.06];
    const f4 = [bx + brx * 0.46, by - bry * 0.12];
    const c1 = [(W0[0] + f1[0]) / 2 + 1.0, (W0[1] + f1[1]) / 2 + 1.2];
    const c2 = [(W0[0] + f2[0]) / 2 + 1.5, (W0[1] + f2[1]) / 2 + 1.1];
    const c3 = [(W0[0] + f3[0]) / 2 + 1.7, (W0[1] + f3[1]) / 2 + 0.85];
    const c4 = [(W0[0] + f4[0]) / 2 + 1.1, (W0[1] + f4[1]) / 2 + 0.5];
    S.push({ k: 'K', t: 'poly', p: [S0, W0, T0, f1, c1, f2, c2, f3, c3, f4, c4] });   // dark membrane (scalloped)
    const u1 = [W0[0] * 0.55 + T0[0] * 0.45, W0[1] * 0.55 + T0[1] * 0.45 + 1.4];
    const u2 = [S0[0] * 0.5 + W0[0] * 0.5 + 0.8, S0[1] * 0.5 + W0[1] * 0.5 + 1.6];
    S.push({ k: 'B', t: 'poly', p: [S0, W0, T0, u1, u2] });                            // cream upper band
    S.push({ k: 'L', t: 'poly', p: [S0, W0, T0, [(T0[0] + u1[0]) / 2, (T0[1] + u1[1]) / 2], [(S0[0] + u2[0]) / 2, (S0[1] + u2[1]) / 2]] });   // highlight
    [f1, f2, f3, f4].forEach(f => { S.push({ k: 'C', t: 'tri', p: [[W0[0], W0[1]], [f[0], f[1]], [f[0] + 0.95, f[1] + 0.85]] }); });   // cream bones
    S.push({ k: 'C', t: 'poly', p: [[S0[0] - 0.5, S0[1] - 0.4], [W0[0] - 0.5, W0[1] - 0.4], [T0[0] + 0.2, T0[1] + 0.2], [T0[0] + 1.0, T0[1] + 0.9], [W0[0] + 0.6, W0[1] + 0.7], [S0[0] + 0.6, S0[1] + 0.5]] }); }   // leading-edge bone

  // CREST mane (bright, drawn on top) + nape + jaw barbel
  { const cx0 = hx - hr * 0.04, cy0 = hy - hr * 0.72;
    const fan = [[1.0, -2.0], [0.6, -2.5], [0.16, -2.85], [-0.32, -2.9], [-0.82, -2.65], [-1.34, -2.28], [-1.86, -1.82]];
    fan.forEach(d => { const ox = cx0 + d[0] * hr * 0.22, oy = cy0 + Math.max(0, -d[0]) * 0.18; const tx = ox + d[0] * 1.9, ty = oy + d[1] * 1.7;
      S.push({ k: 'C', t: 'tri', p: [[ox - 1.05, oy + 0.7], [tx, ty], [ox + 1.15, oy + 0.6]] }); });
    [[hx - hr * 1.02, hy - hr * 0.24, 3.0], [hx - hr * 1.5, hy - hr * 0.0, 2.6]].forEach(p => { S.push({ k: 'C', t: 'tri', p: [[p[0] + 0.8, p[1] + 0.55], [p[0] - p[2] * 0.7, p[1] - p[2]], [p[0] - 0.3, p[1] - 0.1]] }); });
    S.push({ k: 'C', t: 'tri', p: [[hx - hr * 0.44, hy + hr * 0.78], [hx - hr * 1.12, hy + hr * 1.12], [hx - hr * 0.38, hy + hr * 1.08]] }); }
  return S;
}
function _rcCover(s, gx, gy) { const cx = gx + 0.5, cy = gy + 0.5; return s.t === 'ell' ? _rcInEll(cx, cy, s.p[0], s.p[1], s.p[2], s.p[3]) : s.t === 'rect' ? _rcInRect(cx, cy, s.p[0], s.p[1], s.p[2], s.p[3]) : s.t === 'poly' ? _rcInPoly(cx, cy, s.p) : _rcInTri(cx, cy, s.p[0], s.p[1], s.p[2]); }
function _rcBuildGrid(P, legDX) {
  const sh = _rcDragonShapes(P, legDX), GW = RC_DRG.GW, GH = RC_DRG.GH;
  const g = []; for (let y = 0; y < GH; y++) g.push(new Array(GW).fill(null));
  for (const s of sh) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (_rcCover(s, x, y)) g[y][x] = s.k; }
  const og = g.map(r => r.slice());
  const fil = (x, y) => x >= 0 && x < GW && y >= 0 && y < GH && g[y][x] != null;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (g[y][x] == null && (fil(x - 1, y) || fil(x + 1, y) || fil(x, y - 1) || fil(x, y + 1))) og[y][x] = 'o'; }
  return og;
}
// ---------------------------------------------------------------------------
// The dragon sprite is a TRACE of the reference art (images/dragon_ref/ref.png),
// digitised at load into a key-grid, then recoloured per dragon. We ship the PNG
// and trace it in-browser (Canvas getImageData) so the sprite is the real reference
// shape, not an approximation. RC_DRAGON_FRAMES stays null until the trace finishes.
// ---------------------------------------------------------------------------
let RC_DRAGON_FRAMES = null;

// Canonical palette of the reference art. Recolouring hue-rotates this ramp to each
// dragon's colour while preserving the reference's light/shadow STRUCTURE, so every
// dragon is a faithful tonal twin of the original in its own hue.
const _RC_REF = { C: '#fff0c0', B: '#ffd8a8', M: '#d89030', D: '#a86000', K: '#484848', k: '#303030', o: '#181818', e: '#ffffff', p: '#181818' };
function _rcHsl(hex) { const c = rcHexToRgb(hex); let r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0, s = 0, l = (mx + mn) / 2; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? (((g - b) / d) % 6) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4); h *= 60; if (h < 0) h += 360; } return { h: h, s: s, l: l }; }
function _rcHh(v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }
function _rcHslHex(h, s, l) { h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, X = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r, g, b; if (h < 60) { r = c; g = X; b = 0; } else if (h < 120) { r = X; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = X; } else if (h < 240) { r = 0; g = X; b = c; } else if (h < 300) { r = X; g = 0; b = c; } else { r = c; g = 0; b = X; } return '#' + _rcHh((r + m) * 255) + _rcHh((g + m) * 255) + _rcHh((b + m) * 255); }
const _RC_REF_BL = _rcHsl(_RC_REF.B).l;
function _rcLighten(hex, dl) { const h = _rcHsl(hex); return _rcHslHex(h.h, h.s * (1 - dl * 0.35), Math.min(0.98, h.l + dl)); }
function _rcDragonPal(base, bright) {
  const b0 = base || '#8a8a8a', bb = _rcHsl(b0), bh = bb.h, bs = bb.s, bl = bb.l;
  const warm = rk => { const h = _rcHsl(rk); return _rcHslHex(bh, Math.min(1, h.s * bs * 1.5), Math.max(0.06, Math.min(0.97, h.l + (bl - _RC_REF_BL) * 0.55))); };
  const dark = rk => { const h = _rcHsl(rk); return _rcHslHex(bh, Math.min(0.6, 0.08 + 0.3 * bs), Math.max(0.08, Math.min(0.5, h.l + (bl - _RC_REF_BL) * 0.25))); };
  const p = {
    // outline: a soft, slightly hue-tinted dark instead of pure black, so the edge reads
    // less harsh/"黒い" and stays cohesive with each dragon's colour
    'o': _rcHslHex(bh, Math.min(0.3, bs * 0.35), 0.15), 'e': _RC_REF.e, 'p': _rcHslHex(bh, Math.min(0.35, bs * 0.4), 0.16),
    'C': warm(_RC_REF.C), 'B': warm(_RC_REF.B), 'M': warm(_RC_REF.M), 'D': warm(_RC_REF.D),
    'K': dark(_RC_REF.K), 'k': dark(_RC_REF.k)
  };
  // When the sprite is shrunk (in-race), its dark cells (outline + charcoal wing) blend and
  // read heavier/blacker than the big view. Lift ONLY the dark keys so the black density drops
  // while the colour ramp (C/B/M/D) stays exactly as the large view — i.e. colours unchanged.
  if (bright) {
    p['o'] = _rcLighten(p['o'], 0.20);   // outline — lift the harsh black most
    p['p'] = _rcLighten(p['p'], 0.18);   // pupil
    p['k'] = _rcLighten(p['k'], 0.15);   // charcoal wing (dark)
    p['K'] = _rcLighten(p['K'], 0.15);   // charcoal wing (mid)
  }
  return p;
}
// classify one averaged cell colour into a recolour key (mirrors the offline trace)
function _rcClassify(r, g, b) {
  const br = (r + g + b) / 3, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
  if (br < 46) return 'o';
  const warm = (r - b) > 26 && r >= g - 8;
  if (!warm && sat < 32) { if (br >= 224) return 'e'; return br < 60 ? 'k' : 'K'; }
  if (br >= 224) return 'C'; if (br >= 170) return 'B'; if (br >= 104) return 'M'; return 'D';
}
// Build a gentle wing-beat cycle from one traced pose: the region ABOVE the back-line
// (the wing) is scaled vertically toward a pivot at the back, so the wing dips & lifts
// while the body/head/tail stay put. Inverse row-mapping = no gaps/holes. The head sits
// below the pivot so it never bobs from the flap.
function _rcBuildFlapFrames(base, GW, GH) {
  const yp = Math.round(GH * 0.62);                 // pivot ≈ wing root / back-line (head is below this)
  const sUp = [1.0, 0.86, 0.72, 0.86];             // spread → dip → spread (bigger downstroke wing-beat)
  return sUp.map(s => {
    if (s === 1) return base;
    const out = []; for (let y = 0; y < GH; y++) out.push(new Array(GW).fill(null));
    for (let y = 0; y < GH; y++) {
      const r = Math.round(y < yp ? yp + (y - yp) / s : y);
      if (r < 0 || r >= GH) continue;
      const src = base[r], dst = out[y];
      for (let x = 0; x < GW; x++) dst[x] = src[x];
    }
    return out;
  });
}
// trace the reference PNG → key-grid; set RC_DRG dims/anchor/eye + RC_DRAGON_FRAMES
function _rcLoadTracedDragon() {
  const img = new Image();
  img.onload = function () { try {
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const D = x.getImageData(0, 0, W, H).data, bg = o => D[o + 3] < 30;
    const colC = new Int32Array(W), rowC = new Int32Array(H);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const o = (y * W + xx) * 4; if (!bg(o)) { colC[xx]++; rowC[y]++; } }
    let minx = 0; while (minx < W && colC[minx] < 4) minx++; let maxx = W - 1; while (maxx > 0 && colC[maxx] < 4) maxx--;
    let miny = 0; while (miny < H && rowC[miny] < 4) miny++; let maxy = H - 1; while (maxy > 0 && rowC[maxy] < 4) maxy--;
    const bw = maxx - minx + 1, bh = maxy - miny + 1, GW = 150, GH = Math.max(1, Math.round(GW * bh / bw)), grid = [];
    for (let gy = 0; gy < GH; gy++) { const row = new Array(GW).fill(null);
      for (let gx = 0; gx < GW; gx++) {
        const x0 = minx + Math.floor(gx * bw / GW); let x1 = minx + Math.floor((gx + 1) * bw / GW); if (x1 <= x0) x1 = x0 + 1;
        const y0 = miny + Math.floor(gy * bh / GH); let y1 = miny + Math.floor((gy + 1) * bh / GH); if (y1 <= y0) y1 = y0 + 1;
        const hh = {}; let tot = 0, nb = 0, best = null, bestN = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const o = (yy * W + xx) * 4; tot++; if (bg(o)) continue; nb++;
          const q = (D[o] >> 4) + ',' + (D[o + 1] >> 4) + ',' + (D[o + 2] >> 4); let e = hh[q]; if (!e) { e = hh[q] = { n: 0, r: 0, g: 0, b: 0 }; } e.n++; e.r += D[o]; e.g += D[o + 1]; e.b += D[o + 2]; if (e.n > bestN) { bestN = e.n; best = e; } }
        if (tot === 0 || nb / tot < 0.35) continue;
        row[gx] = _rcClassify(best.r / best.n, best.g / best.n, best.b / best.n);
      }
      grid.push(row);
    }
    let sx = 0, sn = 0, lowest = 0, exs = 0, eys = 0, en = 0;
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const k = grid[gy][gx]; if (!k) continue; sx += gx; sn++; if (gy > lowest) lowest = gy; if (k === 'e') { exs += gx; eys += gy; en++; } }
    RC_DRG.GW = GW; RC_DRG.GH = GH; RC_DRG.anchorX = Math.round(sx / sn); RC_DRG.anchorY = lowest - 2;
    RC_DRG.eyeX = en ? Math.round(exs / en) : Math.round(sx / sn); RC_DRG.eyeY = en ? Math.round(eys / en) : Math.round(GH * 0.5);
    for (const k in _rcFrameCache) delete _rcFrameCache[k];   // any colours cached from a stale grid
    RC_DRAGON_FRAMES = _rcBuildFlapFrames(grid, GW, GH);
  } catch (e) { _rcFallbackDragon(); } };
  img.onerror = function () { img.onerror = function () { _rcFallbackDragon(); }; img.src = 'images/dragon_ref/ref.png'; };   // webp→png→手続きfallback（レース数値は不変・表示のみ）
  img.src = 'images/dragon_ref/ref.webp';
}
// minimal silhouette fallback so dragons still render if the trace can't run
function _rcFallbackDragon() {
  const GW = 60, GH = 34; RC_DRG.GW = GW; RC_DRG.GH = GH; RC_DRG.anchorX = 30; RC_DRG.anchorY = 24; RC_DRG.eyeX = 44; RC_DRG.eyeY = 15;
  const g = []; for (let y = 0; y < GH; y++) { const row = new Array(GW).fill(null); for (let x = 0; x < GW; x++) { const dx = (x - 28) / 22, dy = (y - 18) / 8; if (dx * dx + dy * dy <= 1) row[x] = dy < -0.1 ? 'K' : 'B'; } g.push(row); }
  for (const k in _rcFrameCache) delete _rcFrameCache[k];
  RC_DRAGON_FRAMES = [g];
}
// Per-colour frame cache: rasterise each dragon colour's 4 wing-beat frames to a tiny
// offscreen canvas ONCE, then blit (crisp, nearest-neighbour). Keeps the larger grid
// cheap even with a full field on a phone.
const _rcFrameCache = Object.create(null);
function _rcFrameFor(color, fi, bright) {
  const ckey = (color || '#8a8a8a') + (bright ? '!' : '');     // brightened variant cached separately
  let arr = _rcFrameCache[ckey]; if (!arr) arr = _rcFrameCache[ckey] = [];
  let cv = arr[fi];
  if (!cv) {
    const pal = _rcDragonPal(color, bright), grid = RC_DRAGON_FRAMES[fi], GW = RC_DRG.GW, GH = RC_DRG.GH;
    cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
    const x = cv.getContext('2d');
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const k = grid[gy][gx]; if (!k) continue; x.fillStyle = pal[k]; x.fillRect(gx, gy, 1, 1); }
    arr[fi] = cv;
  }
  return cv;
}
_rcLoadTracedDragon();   // kick off the reference trace at load (async; populates RC_DRAGON_FRAMES)
// Per-dragon BUILD: a stable, distinct physique (length × height × overall size) derived from
// the dragon's colour, so each reads as its own body-type even sharing the traced base shape.
// (Procedural v1 — richer per-body silhouettes can be added later as extra traced archetypes.)
const _rcBuildCache = Object.create(null);
const _RC_NOBUILD = { sx: 1, sy: 1, sz: 1 };
function _rcBuildFor(color) {
  const key = color || '#8a8a8a';
  let b = _rcBuildCache[key];
  if (!b) {
    let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h / 4294967296; };
    b = _rcBuildCache[key] = { sx: 0.91 + rnd() * 0.19, sy: 0.92 + rnd() * 0.16, sz: 0.96 + rnd() * 0.08 };  // length / height / size
  }
  return b;
}
// =========================================================================
// Signature ACCENT trail (意匠 design.accent) — each dragon continuously sheds a
// faint world-space particle behind it that matches its design: ember/firegold for
// fire types, spark for the electric speedsters, wind streaks for wing-closers,
// sparkle for the starlight dragon, snow for the ice tank, mist for the fog mystic,
// tear for the crybaby, sleep bubbles for the sleepy cloud — so a field of 8 reads
// as 8 distinct characters at a glance. Emits into the existing S.particles, drawn
// BEHIND the dragons. Purely cosmetic — never touches progress / odds / payouts.
// =========================================================================
const _RC_ACCENT_RATE = {   // seconds between emits (smaller = denser); 'none' = no trail
  ember: 0.085, firegold: 0.07, spark: 0.10, wind: 0.13,
  sparkle: 0.16, snow: 0.16, mist: 0.14, tear: 0.34, sleep: 0.5
};
function _rcMakeAccent(kind, x, y, dep, color, aura) {
  const r = Math.random;
  const p = { acc: true, kind: kind, x: x, y: y, vx: -18 * dep, vy: 0, size: 1.6 * dep, life: 1, max: 0.7, color: color || '#fff' };
  switch (kind) {
    case 'ember':    p.vx -= 6 * dep;  p.vy = -16 * dep - r() * 10 * dep; p.size = (1.3 + r() * 0.9) * dep; p.max = 0.6 + r() * 0.3; break;
    case 'firegold': p.vy = -18 * dep - r() * 12 * dep; p.size = (1.4 + r() * 1.0) * dep; p.color = aura || '#ffcf52'; p.max = 0.55 + r() * 0.3; p.spark = r() < 0.3; break;
    case 'spark':    p.vx = -30 * dep - r() * 20 * dep; p.vy = (r() - 0.5) * 26 * dep; p.size = (1.0 + r() * 0.7) * dep; p.max = 0.28 + r() * 0.16; p.color = _rcLighten(color || '#cfe6ff', 0.32); break;
    case 'wind':     p.vx = -34 * dep; p.vy = (r() - 0.5) * 6 * dep; p.size = (7 + r() * 6) * dep; p.max = 0.5 + r() * 0.3; p.color = _rcLighten(color || '#cfe6ff', 0.4); break;   // size = streak length
    case 'sparkle':  p.vx = -10 * dep; p.vy = (r() - 0.5) * 12 * dep; p.size = (1.7 + r() * 1.3) * dep; p.max = 0.6 + r() * 0.4; p.color = aura || _rcLighten(color || '#fff', 0.42); break;
    case 'snow':     p.vx = -10 * dep + (r() - 0.5) * 8 * dep; p.vy = 12 * dep + r() * 8 * dep; p.size = (1.2 + r() * 1.0) * dep; p.max = 0.9 + r() * 0.5; p.color = '#eaf6ff'; break;
    case 'mist':     p.vx = -14 * dep; p.vy = -4 * dep; p.size = (6 + r() * 6) * dep; p.max = 0.7 + r() * 0.5; p.color = '#cdd9e6'; break;
    case 'tear':     p.vx = -12 * dep; p.vy = 10 * dep; p.size = (1.3 + r() * 0.7) * dep; p.max = 0.6 + r() * 0.3; p.color = '#aee0ff'; break;
    case 'sleep':    p.vx = -6 * dep;  p.vy = -14 * dep - r() * 6 * dep; p.size = (2.2 + r() * 1.4) * dep; p.max = 1.0 + r() * 0.6; p.color = '#dfeaff'; break;
  }
  return p;
}
function _rcEmitAccent(S, design, o) {
  if (!design) return;
  const kind = design.accent;
  if (!kind || kind === 'none' || o.grounded) return;          // austere dragons (gando) + walk-in: no trail
  const base = _RC_ACCENT_RATE[kind]; if (!base) return;
  const iv = base * (1.1 - clamp(o.intensity || 0, 0, 1) * 0.62);   // 少し密に＝署名が「見える」量（表示のみ）
  const now = performance.now() / 1000;
  S.accT = S.accT || {};
  if (now - (S.accT[o.id] || 0) < iv) return;
  S.accT[o.id] = now;
  const dep = o.dep || 1;
  // ★出る位置のこだわり：署名は「尾の後ろ」から吐き出す（鼻先アンカーなので体は左へ伸びる）。
  //   炎尾竜は尾の炎から火の粉、雷竜は尾端から稲妻——体に重ならず、走った軌跡に残る。
  const tw = o.tailW || 18 * dep;
  const rx = o.x - tw * (0.94 + Math.random() * 0.28);
  const ry = o.y - 10 * dep + (Math.random() - 0.5) * 6 * dep;
  S.particles.push(_rcMakeAccent(kind, rx, ry, dep, o.color, design.aura));
  if ((o.intensity || 0) > 0.85) S.particles.push(_rcMakeAccent(kind, rx - 5 * dep, ry + 3, dep, o.color, design.aura));   // 全力時は二重に
}
function _rcDrawAccent(ctx, p, a) {
  const k = p.kind;
  if (k === 'wind') {                                  // pale speed streak
    ctx.strokeStyle = rcRgba(p.color || '#cfe6ff', 0.26 * a); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.size, p.y); ctx.stroke(); return;
  }
  if (k === 'mist') {                                  // soft low-alpha puff
    ctx.fillStyle = rcRgba(p.color || '#cdd9e6', 0.12 * a);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 + (1 - a)), 0, Math.PI * 2); ctx.fill(); return;
  }
  if (k === 'spark') {                                 // ⚡稲妻：ジグザグ＋加算グロー（雷竜の署名）
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sc2 = p.color || '#9fd8ff';
    const g2 = ctx.createRadialGradient(p.x - p.size, p.y, 0, p.x - p.size, p.y, p.size * 4);
    g2.addColorStop(0, rcRgba(sc2, 0.45 * a)); g2.addColorStop(1, rcRgba(sc2, 0));
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x - p.size, p.y, p.size * 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rcRgba('#eaf7ff', 0.95 * a); ctx.lineWidth = 1.4; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.size * 1.6, p.y + p.size * 0.9);
    ctx.lineTo(p.x - p.size * 2.5, p.y - p.size * 0.5);
    ctx.stroke();
    ctx.restore(); return;
  }
  if (k === 'sparkle' || (k === 'firegold' && p.spark)) {   // 4-point twinkle
    rcSparkle(ctx, p.x, p.y, p.size * 1.8, rcRgba(p.color || '#fff', 0.92 * a)); return;
  }
  if (k === 'ember' || k === 'firegold') {             // 🔥火の粉：加算グロー付き（炎竜の署名・HD-2Dブルーム）
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fc = k === 'firegold' ? (p.color || '#ffcf52') : '#ff9a50';
    const gg3 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.1);
    gg3.addColorStop(0, rcRgba(fc, 0.5 * a)); gg3.addColorStop(1, rcRgba(fc, 0));
    ctx.fillStyle = gg3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = k === 'firegold' ? rcRgba(fc, 0.95 * a)
                                     : 'rgba(255,' + (150 + Math.floor(80 * a)) + ',80,' + (0.9 * a) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }
  if (k === 'sleep') {                                 // drifting bubble (hollow)
    ctx.strokeStyle = rcRgba(p.color || '#dfeaff', 0.5 * a); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke(); return;
  }
  ctx.fillStyle = rcRgba(p.color || '#fff', (k === 'tear' ? 0.85 : 0.72) * a);   // snow / tear / default soft dot
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
}
function rcDrawDragonPixel(ctx, o) {
  if (!RC_DRAGON_FRAMES) return;   // trace not ready yet (a few ms at startup)
  let fi;
  if (o.grounded) {
    fi = 0;                                          // wings folded down — a GROUNDED stance (walking, not flying)
  } else {
    fi = Math.floor((o.gait || 0) / (Math.PI / 2)) % RC_DRAGON_FRAMES.length;
    if (fi < 0) fi += RC_DRAGON_FRAMES.length;
  }
  const pxc = (o.scale || 1) * RC_DRG.px;
  const b = o.noBuild ? _RC_NOBUILD : _rcBuildFor(o.color);
  const wsc = pxc * b.sz * b.sx, hsc = pxc * b.sz * b.sy;   // per-dragon build (length × height × size)
  const down = wsc < 0.96;                                  // shrinking (in-race) → smooth + use the brightened palette
  const frame = _rcFrameFor(o.color || '#8a8a8a', fi, down);
  const bob = o.grounded
    ? Math.abs(Math.sin(o.gait || 0)) * 0.5          // small grounded step-bounce (a walk)
    : Math.sin((o.gait || 0) * 0.7) * (o.down ? 0.4 : 1);   // gentle floating (flight)
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.spin) ctx.rotate(o.spin);                                  // full-body spin (a wind gust catches it)
  if (o.tumble) ctx.rotate(o.tumble);
  ctx.rotate(-(o.lean || 0) * 0.06 + (o.bank || 0) * 0.10);
  if (o.squash && o.squash !== 1) {                                // squash & stretch (jump take-off / landing)
    const sq = Math.max(0.7, Math.min(1.3, o.squash));
    ctx.scale(2 - sq, sq);
  }
  ctx.translate(0, -bob * pxc * 0.9);
  // soft luminous halo — keeps the eye-catching "pop" without washing out the colours
  {
    const _au = o.design && o.design.aura;                          // 意匠オーラ色（伝説竜）＞ 既定の映えハロー
    ctx.save(); ctx.globalAlpha = _au ? 0.34 : 0.22;
    const gc = _au || rcShade(o.color || '#888', 46), r = (_au ? 17 : 14) * pxc;
    const ng = ctx.createRadialGradient(0, -pxc, 2, 0, -pxc, r);
    ng.addColorStop(0, rcRgba(gc, _au ? 0.8 : 0.7)); ng.addColorStop(0.6, rcRgba(gc, 0.16)); ng.addColorStop(1, rcRgba(gc, 0));
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, -pxc, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (o.glow > 0) {
    ctx.save(); ctx.globalAlpha = 0.5 * o.glow;
    const ag = ctx.createRadialGradient(0, -8 * pxc, 2, 0, -8 * pxc, 30);
    ag.addColorStop(0, rcRgba(o.color || '#fff', 0.9)); ag.addColorStop(1, rcRgba(o.color || '#fff', 0));
    ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(0, -8 * pxc, 26, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const ox = -RC_DRG.anchorX * wsc, oy = -RC_DRG.anchorY * hsc;
  const sm = ctx.imageSmoothingEnabled;
  // smooth when DOWN-scaling (in-race: 150px grid → ~80px) to kill the jagged/harsh edge;
  // stay crisp when UP-scaling (dex/portraits) so big views keep their clean pixel look.
  ctx.imageSmoothingEnabled = down;
  ctx.drawImage(frame, ox, oy, RC_DRG.GW * wsc, RC_DRG.GH * hsc);
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}

// ===== Live2Dリグ竜（表示専用・色替え）====================================
// 各レース竜を、ツール出力の dragon_rig.json（頭/胴/翼/尾）で描画する。色は竜ごとに
// 色相シフト（金42°基準）。羽ばたき/尾揺れは o.gait 駆動。footprint はグリッド竜に一致。
// window.RC_USE_RIG===false で旧グリッド竜に即切替（比較用）。リグ未ロード中はグリッド竜で繋ぐ。
// レースの着順/オッズ/配当には一切非干渉（描画のみ）。
let RC_RIG = null, _rcRigLoading = false;
function _rcEnsureRig() {
  if (RC_RIG || _rcRigLoading) return;
  _rcRigLoading = true;
  try {
    if (typeof window !== 'undefined' && window.DragonL2 && DragonL2.loadRig) {
      DragonL2.loadRig().then(function (r) { RC_RIG = _rcPrepRig(r); }).catch(function () { _rcRigLoading = false; });
    } else if (typeof L2_RIG !== 'undefined') {
      fetch('images/dragon_ref/dragon_rig.json').then(function (r) { return r.text(); })
        .then(function (t) { return L2_RIG.hydrate(L2_RIG.deserialize(t)); })
        .then(function (r) { RC_RIG = _rcPrepRig(r); }).catch(function () { _rcRigLoading = false; });
    } else { _rcRigLoading = false; }
  } catch (e) { _rcRigLoading = false; }
}
function _rcPrepRig(rig) {
  rig._zsorted = L2_RIG.sortedByZ(rig);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  rig.parts.forEach(function (p) { x0 = Math.min(x0, p.rect.x); y0 = Math.min(y0, p.rect.y); x1 = Math.max(x1, p.rect.x + p.rect.w); y1 = Math.max(y1, p.rect.y + p.rect.h); });
  rig._bbox = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };   // 竜の外接矩形（footprint合わせ用）
  // 目パーツの実中心＋口（スナウト前下方）を rig 空間で保持 → 顔overlay/口の正確な配置に使う
  const _eye = rig.parts.find(function (p) { return p.role === 'eye'; });
  if (_eye) {
    rig._eyeC = { x: _eye.rect.x + _eye.rect.w / 2, y: _eye.rect.y + _eye.rect.h / 2 };
  }
  return rig;
}
function _rcHueDelta(color) {                 // hex色 → 金(約42°)からの最短色相デルタ(deg)
  let c = color || '#caa44a'; if (c[0] === '#') c = c.slice(1);
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return Math.round(((h - 42) + 540) % 360 - 180);
}
// モバイルSafari/一部WebViewは ctx.filter 未対応（設定しても 'none' のまま）→ hue-rotate が無効化され
// 全竜が同じ金色になる。検出して未対応なら、同じ行列（CSS hue-rotate＋saturate(1.1) 相当・W3C定義）を
// 画素単位で一度だけ適用する（キャッシュは共通＝毎フレームコストなし）。
const _rcFilterOK = (function () {
  if (window.RC_FORCE_NOFILTER) return false;   // 検証用フック
  try { const x = document.createElement('canvas').getContext('2d'); x.filter = 'hue-rotate(90deg)'; return x.filter !== 'none' && x.filter !== ''; } catch (e) { return false; }
})();
function _rcTintPixels(c, deg, satMul, briMul) {
  const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
  const m = [   // hue-rotate 行列（filter仕様と同一）
    0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
    0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
    0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
  const S = 1.1 * (satMul || 1), B = (briMul || 1);
  const sr = 0.213 * (1 - S), sg = 0.715 * (1 - S), sb = 0.072 * (1 - S);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const nr = m[0] * r + m[1] * g + m[2] * b, ng = m[3] * r + m[4] * g + m[5] * b, nb = m[6] * r + m[7] * g + m[8] * b;
    let r2 = ((sr + S) * nr + sg * ng + sb * nb) * B, g2 = (sr * nr + (sg + S) * ng + sb * nb) * B, b2 = (sr * nr + sg * ng + (sb + S) * nb) * B;
    d[i] = r2 < 0 ? 0 : r2 > 255 ? 255 : r2;
    d[i + 1] = g2 < 0 ? 0 : g2 > 255 ? 255 : g2;
    d[i + 2] = b2 < 0 ? 0 : b2 > 255 ? 255 : b2;
  }
  x.putImageData(im, 0, 0);
}
// ── 同レース内の“同系色”対策：色相が近い竜に明暗/彩度のバリエーションを自動で割り当てて描き分ける。
// 表示専用（図鑑/データの色は不変）。色相±の微調整も併用し、同系3頭でも 標準/濃い/淡い で判別できる。
function _rcHexHue(hex) {
  let c = hex || '#caa44a'; if (c[0] === '#') c = c.slice(1);
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return h;
}
const RC_TINT_VARS = [null,
  { hue: 14,  sat: 1.3,  bri: 0.78 },   // 2頭目：濃い
  { hue: -14, sat: 0.8,  bri: 1.24 },   // 3頭目：淡い
  { hue: 28,  sat: 1.4,  bri: 0.6 },    // 4頭目：さらに濃い
  { hue: -28, sat: 0.7,  bri: 1.4 },    // 5頭目：さらに淡い
  { hue: 42,  sat: 1.15, bri: 0.92 }];
function rcDistinctColors(list) {
  const hs = list.map(d => ({ id: d.id, h: _rcHexHue(d.color) })).sort((a, b) => a.h - b.h);
  const map = {}; let gi = 0;
  for (let i = 0; i < hs.length; i++) {
    gi = (i > 0 && hs[i].h - hs[i - 1].h <= 22) ? gi + 1 : 0;   // 色相22°以内＝同系グループ（360°跨ぎは稀なので簡略）
    if (gi > 0) map[hs[i].id] = RC_TINT_VARS[Math.min(gi, RC_TINT_VARS.length - 1)];
  }
  return map;
}
function _rcFindOpaque(cv) {                  // 不透明ピクセルを1点探す（中心→四分点の順）
  const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  const pts = [[W >> 1, H >> 1], [W >> 2, H >> 1], [(3 * W) >> 2, H >> 1], [W >> 1, H >> 2], [W >> 1, (3 * H) >> 2]];
  for (let i = 0; i < pts.length; i++) {
    const d = x.getImageData(pts[i][0], pts[i][1], 1, 1).data;
    if (d[3] > 200) return [pts[i][0], pts[i][1], d];
  }
  return null;
}
const _rcRigTint = Object.create(null);       // (色×パーツ×変種)→着色済みcanvas を一度だけ生成（毎フレームfilter回避）
function _rcRigPartImg(color, p, tv) {        // tv＝同系色の描き分けバリエーション（rcDistinctColors）
  const key = (color || '#888') + '|' + p.id + (tv ? '|' + tv.hue + '/' + tv.sat + '/' + tv.bri : '');
  let c = _rcRigTint[key];
  if (!c) {
    const deg = _rcHueDelta(color) + (tv ? tv.hue : 0);
    const sat = 1.1 * (tv ? tv.sat : 1), bri = tv ? tv.bri : 1;
    c = document.createElement('canvas'); c.width = p._img.width; c.height = p._img.height;
    const x = c.getContext('2d');
    if (_rcFilterOK) {
      x.filter = 'hue-rotate(' + deg + 'deg) saturate(' + sat.toFixed(3) + ') brightness(' + bri + ')';
      x.drawImage(p._img, 0, 0);
      // 実証チェック：filter“対応”を申告しつつ描画では無視する端末（iOS系WebKitの一部）を見破る。
      // 元画像と着色結果を1ピクセル比較し、変化していなければピクセル処理で確実に着色する。
      if (Math.abs(deg) > 8 || tv) {
        if (!p._srcCv) {
          p._srcCv = document.createElement('canvas'); p._srcCv.width = c.width; p._srcCv.height = c.height;
          p._srcCv.getContext('2d').drawImage(p._img, 0, 0);
        }
        const s = _rcFindOpaque(p._srcCv);
        if (s) {
          const t = x.getImageData(s[0], s[1], 1, 1).data;
          const diff = Math.abs(t[0] - s[2][0]) + Math.abs(t[1] - s[2][1]) + Math.abs(t[2] - s[2][2]);
          if (diff < 10) { _rcTintPixels(c, deg, tv && tv.sat, tv && tv.bri); window._rcTintFallback = (window._rcTintFallback || 0) + 1; }
        }
      }
    } else {
      x.drawImage(p._img, 0, 0);
      _rcTintPixels(c, deg, tv && tv.sat, tv && tv.bri);
    }
    _rcRigTint[key] = c;
  }
  return c;
}
// 付け根(rootEdge)固定・先端ほど大きく波打つ“しなり”。剛体回転より生物的な羽ばたき/尾揺れ。
function _rcBendStrips(ctx, img, bx, by, phase, amp, rootEdge) {
  const W = img.width, H = img.height, n = 10, step = W / n, rootRight = (rootEdge === 'right');
  for (let i = 0; i < n; i++) {
    let u = (i + 0.5) / n; if (rootRight) u = 1 - u;                 // 0=付け根 .. 1=先端
    const k = u * u;                                                  // 先端ほど大きく（付け根は静止）
    const off = (Math.sin(phase + u * 1.6) + 0.25 * Math.sin(2 * phase + u * 1.6)) * amp * k * H;
    const sx0 = i * step, sw = Math.min(step + 1, W - sx0);
    ctx.drawImage(img, sx0, 0, sw, H, bx + sx0, by + off, sw, H);
  }
}
function _rcDrawRigPart(ctx, p, color, o) {
  const img = _rcRigPartImg(color, p, o.tint), g = o.gait || 0;
  const bx = p.rect.x - p.pivot.x, by = p.rect.y - p.pivot.y;        // 局所ピボット基準のオフセット
  const bend = p.motion && p.motion.bend;
  ctx.save();
  ctx.translate(p.pivot.x, p.pivot.y);
  if (p.role === 'wing') {
    const ws = o.design && o.design.wingSize;                                                // 意匠の翼サイズ（鳳凰=大/岩鱗=小）。ピボット=翼根なので根元固定で伸縮。footprintは不変＝表示専用。
    if (ws && ws !== 1) { const k = 1 + (ws - 1) * 0.7; ctx.scale(k, k); }                    // 過剰を抑えた等比スケール
    _rcBendStrips(ctx, img, bx, by, g, 0.20, (bend && bend.rootEdge) || 'right');           // 羽ばたき（先端しなり）
  } else if (p.role === 'tail') {
    _rcBendStrips(ctx, img, bx, by, g * 0.7 + 0.8, 0.11, (bend && bend.rootEdge) || 'right'); // 尾のしなり
  } else if (p.role === 'head') {
    ctx.rotate(Math.sin(g * 0.5) * 0.03); ctx.drawImage(img, bx, by);                         // 首をごく僅かに
  } else if (p.role === 'body') {
    ctx.scale(1, 1 + Math.sin(g * 0.5) * 0.012); ctx.drawImage(img, bx, by);                  // 呼吸（僅かな伸縮）
  } else if (p.role === 'eye') {
    // 目を mood 別に変形（縦スケール＝まばたき/喜び/見開き、横ずれ＝泳ぐ目）。ピボット中心で変形。
    const m = o.mood; let syE = 1, dx = 0;
    if (m === 'joy' || m === 'relaxed') syE = 0.22;        // 笑い目 ‿
    else if (m === 'tired' || m === 'yawn') syE = 0.42;    // 半目
    else if (m === 'surprised') syE = 1.3;                 // 見開き
    else if (m === 'panic') { syE = 1.12; dx = Math.sin(g * 5) * 3; }  // 泳ぐ目
    else if (m === 'effort' || m === 'serious') syE = 0.86; // 細め（集中）
    // 自然なまばたきを時々（gait位相で全頭ばらける）
    const blink = Math.sin(g * 0.9 + (p.pivot.x % 7));
    if (blink > 0.97) syE *= 0.15;
    const es = Math.max(0.6, Math.min(1.45, (o.design && o.design.eye) || 1));               // 意匠の目サイズ（泣き虫=大/眠雲=小）。ピボット中心で等比＝目中心(_eyeC)不変＝漫符位置はズレない。
    ctx.translate(dx, 0); ctx.scale(es, syE * es); ctx.drawImage(img, bx, by);
  } else {
    ctx.drawImage(img, bx, by);
  }
  ctx.restore();
}
function rcDrawDragonRig(ctx, o) {
  if (!RC_RIG) { _rcEnsureRig(); return rcDrawDragonPixel(ctx, o); }
  const rig = RC_RIG, bb = rig._bbox;
  const px = (o.scale || 1) * RC_DRG.px;
  const b = o.noBuild ? _RC_NOBUILD : _rcBuildFor(o.color);
  const wsc = px * b.sz * b.sx, hsc = px * b.sz * b.sy;
  const sx = (RC_DRG.GW * wsc) / bb.w, sy = (RC_DRG.GH * hsc) / bb.h;          // グリッド竜の footprint に一致
  const ax = bb.x + (RC_DRG.anchorX / RC_DRG.GW) * bb.w, ay = bb.y + (RC_DRG.anchorY / RC_DRG.GH) * bb.h;   // (o.x,o.y)へ来る基準点
  const bob = o.grounded ? Math.abs(Math.sin(o.gait || 0)) * 0.5 : Math.sin((o.gait || 0) * 0.7) * (o.down ? 0.4 : 1);
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.spin) ctx.rotate(o.spin);
  if (o.tumble) ctx.rotate(o.tumble);
  ctx.rotate(-(o.lean || 0) * 0.06 + (o.bank || 0) * 0.10);
  if (o.squash && o.squash !== 1) { const sq = Math.max(0.7, Math.min(1.3, o.squash)); ctx.scale(2 - sq, sq); }
  ctx.translate(0, -bob * px * 0.9);
  { const _au = o.design && o.design.aura; ctx.save(); ctx.globalAlpha = _au ? 0.34 : 0.22; const gc = _au || rcShade(o.color || '#888', 46), rr = (_au ? 17 : 14) * px;   // 意匠オーラ色（伝説竜）＞ 既定の映えハロー
    const ng = ctx.createRadialGradient(0, -px, 2, 0, -px, rr); ng.addColorStop(0, rcRgba(gc, _au ? 0.8 : 0.7)); ng.addColorStop(0.6, rcRgba(gc, 0.16)); ng.addColorStop(1, rcRgba(gc, 0));
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, -px, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.scale(sx, sy);
  ctx.translate(-ax, -ay);
  const parts = rig._zsorted;
  for (let i = 0; i < parts.length; i++) { const p = parts[i]; if (p._img) _rcDrawRigPart(ctx, p, o.color, o); }
  ctx.restore();
}
// =========================================================================
// 3D-render dragon sprites (mimi_dragon_3d_spec_pack v1.0 — 表示専用).
// 各竜に images/dragons/<id>.webp（allrounder基準を最優先参照に忠実リカラーした
// 3Dレンダリング風スプライト・マスターリストの意匠準拠）を用意し、グリッド/リグ竜の
// 代わりに描く。上下動/リーン/バンク/スカッシュ/スピンの体の動きは流用し、署名トレイル
// と伝説オーラはそのまま重なる。読込中・未配置は静かに従来描画へフォールバック。
// 純粋に表示のみ — 画面の着順は raceResult と一致したまま（数値非干渉）。
// =========================================================================
const RC_DSPRITE = Object.create(null);
const RC_DSP_H = 46;                 // 画面上の竜の基準高さ(px)。62→46＝「画面を大きく取り竜は小さく」（ユーザー指定・モック準拠）。scaleで奥行き調整
function _rcDragonSprite(id) {
  if (!id) return null;
  let e = RC_DSPRITE[id];
  if (!e) {
    e = RC_DSPRITE[id] = { img: new Image(), ok: false, bad: false, box: null };
    e.img.onload = function () {
      try {
        // ①グレー無地背景をキー抜き（HD-2D納品は中性グレー背景＝四隅からflood-fillで“繋がった背景だけ”
        //   透過。体内の灰色＝フガクの鉄岩装甲などは連結していないので残る）②被写体bboxを算出。
        const W = e.img.naturalWidth, H = e.img.naturalHeight;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.drawImage(e.img, 0, 0);
        const im = x.getImageData(0, 0, W, H), d = im.data;
        if (d[3] > 200) {                      // 角が不透明＝グレー背景素材→キー抜き（既透過素材はスキップ）
          const cr = d[0], cg = d[1], cb = d[2], TOL2 = 34 * 34;
          const stack = [0, W - 1, (H - 1) * W, (H - 1) * W + W - 1];
          const seen = new Uint8Array(W * H);
          while (stack.length) {
            const i = stack.pop();
            if (seen[i]) continue; seen[i] = 1;
            const q = i * 4;
            if (d[q + 3] === 0) continue;
            const dr = d[q] - cr, dg = d[q + 1] - cg, db = d[q + 2] - cb;
            if (dr * dr + dg * dg + db * db > TOL2) continue;
            d[q + 3] = 0;
            const xx = i % W;
            if (xx > 0) stack.push(i - 1); if (xx < W - 1) stack.push(i + 1);
            if (i >= W) stack.push(i - W); if (i < (H - 1) * W) stack.push(i + W);
          }
          x.putImageData(im, 0, 0);
          e.cv = c;                            // 以後はキー抜き済みcanvasを描画ソースに
        }
        let minx = W, miny = H, maxx = 0, maxy = 0, found = false;
        for (let yy = 0; yy < H; yy += 2) for (let xx = 0; xx < W; xx += 2) {
          if (d[(yy * W + xx) * 4 + 3] > 24) { found = true; if (xx < minx) minx = xx; if (xx > maxx) maxx = xx; if (yy < miny) miny = yy; if (yy > maxy) maxy = yy; }
        }
        e.box = found ? { x: minx, y: miny, w: Math.max(1, maxx - minx), h: Math.max(1, maxy - miny) } : { x: 0, y: 0, w: W, h: H };
        // ★翼根ギャップ自動検出（R8-W6b）：翼はマスタールールで「背中の上の別シェイプ」＝翼の下面と
        // 背の間に透過の隙間がある。背中領域(x=5..62%・頭は除外)で不透明画素が最少の行を探し、
        // そこを羽ばたきのスライス線にする＝竜ごとに正しい位置で割れずに動く。隙間が無い竜
        // （翼と背が接した意匠）は flapClean=false → 振幅を大きく落として破綻を防ぐ。
        if (found) {
          const bx = e.box.x, by = e.box.y, bw = e.box.w, bh = e.box.h;
          const gx0 = Math.round(bx + bw * 0.05), gx1 = Math.round(bx + bw * 0.62);
          let bestY = Math.round(by + bh * 0.40), bestC = 1e9;
          for (let yy = Math.round(by + bh * 0.20); yy <= Math.round(by + bh * 0.58); yy++) {
            let cnt = 0;
            for (let xx = gx0; xx <= gx1; xx += 2) if (d[(yy * W + xx) * 4 + 3] > 24) cnt++;
            if (cnt < bestC) { bestC = cnt; bestY = yy; }
          }
          e.flapK = (bestY - by) / bh;
          e.flapClean = bestC <= Math.ceil(((gx1 - gx0) / 2) * 0.12);   // 交差12%未満＝クリーンな隙間
        }
      } catch (_) { e.box = { x: 0, y: 0, w: e.img.naturalWidth, h: e.img.naturalHeight }; }
      e.ok = true;
    };
    e.img.onerror = function () { e.bad = true; };          // 無ければ従来描画へ（数値・表示とも安全）
    e.img.src = 'images/dragons/' + id + '.png?v=1';
  }
  return e;
}
function rcHasDragonSprite(id) { const e = RC_DSPRITE[id]; return !!(e && e.ok); }
// 描画時の半身幅(px)＝鼻先アンカー(右端=タイムライン位置)から体の中心までの距離。
// ラベル/バッジ/レティクル/ポップを「体の中心」に置くために使う（表示のみ）。
function rcDragonSpriteHalfW(id, scale) {
  const e = RC_DSPRITE[id];
  if (!e || !e.ok || !e.box || !e.box.h) return 0;
  const targetH = RC_DSP_H * (scale || 1) * (RC_SIZE_MUL[id] || 1);
  return (e.box.w * (targetH / e.box.h)) / 2;
}
// 個体サイズ（表示のみ・設定＝小さい竜ポロは小さく／竜王級〜神格はわずかに大きく＝格の表現。
// レース進行/着順/オッズには一切影響しない。基準1.0＝RC_DSP_H）。
const RC_SIZE_MUL = {
  poro: 0.68,                                             // 泣き虫の子竜＝設定どおり小さく（ユーザー指摘）
  chiri: 0.84, tsumuji: 0.88, kogane: 0.94, susu: 0.94, nagi: 0.94, goro: 0.94,   // tier1-2＝若竜は少し小柄
  guren: 1.05, raijin: 1.05, sora: 1.05, banju: 1.05, gekka: 1.05, senpu: 1.05,   // tier5 竜王級
  enma: 1.09, hayao: 1.09, tenku: 1.09, gozan: 1.09, yugiri: 1.09, reppu: 1.09,   // tier6 祝祭級
  goka: 1.14, raiou: 1.14, souten: 1.14, fugaku: 1.14, yomi: 1.14                 // tier7 神格
};
// R8-W6 羽ばたき：翼はマスタールールで「背中の上・後方スイープの別シェイプ」＝bbox上部帯。
// 翼根ラインの比率（上端から）。既定0.40・目視で崩れる竜はここに個別値を足す（表示のみ）。
const RC_FLAP_CUT = {};
function rcDrawDragonSprite(ctx, o) {
  const e = _rcDragonSprite(o.id);
  if (!e || !e.ok) { _rcEnsureRig(); return (RC_RIG ? rcDrawDragonRig : rcDrawDragonPixel)(ctx, o); }
  const img = e.cv || e.img, b = e.box;   // キー抜き済みcanvas優先（グレー背景素材の透過版）
  const px = (o.scale || 1) * RC_DRG.px;
  const targetH = RC_DSP_H * (o.scale || 1) * (RC_SIZE_MUL[o.id] || 1);   // 体の高さで正規化＋個体サイズ
  const sc = targetH / b.h, w = b.w * sc, h = b.h * sc;
  const bob = o.grounded ? Math.abs(Math.sin(o.gait || 0)) * 0.6 : Math.sin((o.gait || 0) * 0.7) * (o.down ? 0.4 : 1);
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.spin) ctx.rotate(o.spin);
  if (o.tumble) ctx.rotate(o.tumble);
  ctx.rotate(-(o.lean || 0) * 0.05 + (o.bank || 0) * 0.10);
  if (o.squash && o.squash !== 1) { const sq = Math.max(0.7, Math.min(1.3, o.squash)); ctx.scale(2 - sq, sq); }
  ctx.translate(0, -bob * px * 0.9);
  // 映え／伝説オーラ（グリッド竜と同じ意図）
  { const _au = o.design && o.design.aura; ctx.save(); ctx.globalAlpha = _au ? 0.34 : 0.20; const gc = _au || rcShade(o.color || '#888', 46), rr = (_au ? 0.62 : 0.5) * Math.max(w, h);
    const ng = ctx.createRadialGradient(0, -h * 0.45, 2, 0, -h * 0.45, rr); ng.addColorStop(0, rcRgba(gc, _au ? 0.8 : 0.6)); ng.addColorStop(0.6, rcRgba(gc, 0.14)); ng.addColorStop(1, rcRgba(gc, 0));
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, -h * 0.45, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  ctx.imageSmoothingEnabled = true;
  // ★鼻先アンカー：タイムラインの位置(o.x)＝竜の鼻先に合わせて描く（右端=鼻がo.x）。
  //   ゴール演出はタイムライン時刻駆動なので、progress=1の瞬間に「1着の鼻先がゴール線上」になる
  //   ＝実レース中継と同じ「鼻先がゴールした時がゴール」（ユーザー指定）。体長差も物理どおり後ろへ伸びる。
  // ★R8-W6 羽ばたき（素材追加なし・52頭対応）：翼根ラインで上下スライスし、上（翼帯）だけ
  //   頭寄りヒンジで周期回転＝翼端(左)ほど大きく上下。体・頭は下スライスで静止＝顔と意匠は
  //   ブレない。翼と背の間は元絵がほぼ透過なので継ぎ目は出ない。gait同期＝速いほど強く。
  const cutK = RC_FLAP_CUT[o.id] != null ? RC_FLAP_CUT[o.id] : (e.flapK != null ? e.flapK : 0.40);
  const srcCut = Math.max(2, Math.round(b.h * cutK));
  const dstCut = srcCut * sc;
  const clean = RC_FLAP_CUT[o.id] != null ? true : (e.flapClean !== false);   // 隙間の無い意匠は控えめに＝背中が割れない
  const amp = (o.grounded ? 0.028 : (o.down ? 0.05 : 0.095)) * (clean ? 1 : 0.30);
  const flap = Math.sin((o.gait || 0) * 1.35) * amp + amp * 0.22;   // 滑空基調＝上げ優位
  const hgx = -w * 0.16, hgy = -h + 2 + dstCut;                     // ヒンジ＝翼根の頭寄り
  ctx.save();
  ctx.translate(hgx, hgy); ctx.rotate(flap); ctx.translate(-hgx, -hgy);
  ctx.drawImage(img, b.x, b.y, b.w, srcCut, -w + 4, -h + 2, w, dstCut + 1);
  ctx.restore();
  ctx.drawImage(img, b.x, b.y + srcCut, b.w, b.h - srcCut, -w + 4, -h + 2 + dstCut, w, h - dstCut);
  ctx.restore();
}
// =========================================================================
// R8-W4 勝者ウィニングカット（表示のみ）：ゴール確定直後、勝者のHD-2D絵を大写しで
// 「生きて」見せる。Live2Dリグはマスコット画像専用（4パーツ座標がrig.json固定）で
// 52頭の多様な体型には適合しないため、キー抜き済みスプライトを縦ストリップに割り、
// 頭（右）を支点に尾へ向かって進行波でうねらせる＝全頭対応・フィッティング不要。
// =========================================================================
function rcDrawWinnerCut(ctx, id, cx, baseY, rt, cw) {
  const e = RC_DSPRITE[id];
  if (!e || !e.ok || !e.box) return false;
  const img = e.cv || e.img, b = e.box;
  const H = Math.min(150, cw * 0.34), sc = H / b.h, W = b.w * sc;
  const inK = Math.min(1, rt / 0.22);
  const a = inK;   // ★出しっぱなし＝結果を見るまで勝者が生き続ける（フェードアウト廃止・ユーザー指定）
  if (a <= 0) return true;
  const now = performance.now() / 1000;
  ctx.save();
  ctx.globalAlpha = a;
  // 背後の金グロー（お立ち台の照明）
  const gy = baseY - H * 0.45;
  const gr = ctx.createRadialGradient(cx, gy, 4, cx, gy, H * 0.95);
  gr.addColorStop(0, "rgba(255,214,110,0.32)"); gr.addColorStop(1, "rgba(255,214,110,0)");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, gy, H * 0.95, 0, Math.PI * 2); ctx.fill();
  // R8-W7: 神々しい回る後光（加算光条・HD-2Dのブルーム）——勝者の背後でゆっくり回る
  ctx.save();
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * 0.5;
  ctx.translate(cx, gy);
  const _rot = now * 0.22;
  for (let ri = 0; ri < 10; ri++) {
    const an = _rot + ri * (Math.PI * 2 / 10);
    const len = H * (1.02 + 0.10 * Math.sin(now * 1.7 + ri));
    const rg2 = ctx.createLinearGradient(0, 0, Math.cos(an) * len, Math.sin(an) * len);
    rg2.addColorStop(0, "rgba(255,224,140,0.30)"); rg2.addColorStop(1, "rgba(255,224,140,0)");
    ctx.fillStyle = rg2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(an - 0.075) * len, Math.sin(an - 0.075) * len);
    ctx.lineTo(Math.cos(an + 0.075) * len, Math.sin(an + 0.075) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // 漂い昇る光の粒（状態レス・sin駆動＝出しっぱなしでも一生きらめく）
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
  for (let si = 0; si < 7; si++) {
    const ph = now * (0.5 + (si % 3) * 0.17) + si * 1.9;
    const sxp = cx + Math.sin(ph) * (W * 0.55 + si * 5);
    const syp = baseY - ((ph * 15) % (H * 1.05)) + Math.sin(ph * 2.3) * 4;
    const tw2 = 0.5 + 0.5 * Math.sin(now * 3 + si * 2.1);
    ctx.fillStyle = "rgba(255,232,160," + (0.30 + 0.45 * tw2).toFixed(2) + ")";
    ctx.beginPath(); ctx.arc(sxp, syp, 1.2 + tw2 * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // 本体＝ストリップ進行波（頭=右は安定・尾=左ほど大きくうねる）＋軽い呼吸ボブ
  const pop = 0.86 + 0.14 * inK;
  const breathe = Math.sin(now * 2.2) * 2;
  ctx.translate(cx, baseY + breathe); ctx.scale(pop, pop);
  const N = 16, sw = b.w / N, dw = W / N;
  for (let i = 0; i < N; i++) {
    // ★頭側38%は完全静止（顔がぐにゃぐにゃしない・ユーザー指摘）。波は尾側だけを走る。
    const tailK = Math.max(0, (1 - i / (N - 1)) - 0.38) / 0.62;      // 1=尾端 … 0=頭側38%全域
    const dy = tailK <= 0 ? 0 : Math.sin(now * 4.6 - i * 0.5) * 3.4 * tailK;
    ctx.drawImage(img, b.x + i * sw, b.y, sw, b.h, -W / 2 + i * dw - 0.5, -H + dy, dw + 1, H);
  }
  ctx.restore();
  // 金リボン「🏆 1着」
  ctx.save();
  ctx.globalAlpha = a;
  const nm = (typeof commentaryName === "function") ? commentaryName(id) : id;
  const label = "🏆 1着　" + nm;
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tw = ctx.measureText(label).width, rw = tw + 34, rh = 26, ry = baseY + 14;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - rw / 2, ry, rw, rh, 13); else ctx.rect(cx - rw / 2, ry, rw, rh);
  const rg = ctx.createLinearGradient(0, ry, 0, ry + rh);
  rg.addColorStop(0, "#ffd465"); rg.addColorStop(1, "#e2a22e");
  ctx.fillStyle = rg; ctx.fill();
  ctx.fillStyle = "#2a1d05"; ctx.fillText(label, cx, ry + rh / 2 + 0.5);
  ctx.restore();
  return true;
}
function rcDrawDragon(ctx, o) {
  if (typeof window !== 'undefined' && window.RC_USE_RIG === false) return rcDrawDragonPixel(ctx, o);
  if (o.id && rcHasDragonSprite(o.id)) return rcDrawDragonSprite(ctx, o);   // 3D絵が用意済み＝最優先（表示専用）
  if (o.id) _rcDragonSprite(o.id);                                          // 先読みkick（次フレームから3D絵に）
  if (RC_RIG) return rcDrawDragonRig(ctx, o);
  _rcEnsureRig();
  return rcDrawDragonPixel(ctx, o);   // ロード完了までグリッド竜で繋ぐ
}

// =========================================================================
// Cute facial EXPRESSIONS — a manga-style mood overlaid on the dragon's head so
// the field reads with personality and you can SEE how each course suits a dragon:
//   joy ✨  (flying / on a section it's built for)   effort 💧 (digging in, pushing)
//   confused ？ (stumbling / a section it's weak at)  weary … (spent / stamina gone)
//   surprise ！ (a sudden trip)                       neutral (default sprite face)
// Small but legible at sprite scale: a floating symbol carries the mood, with a
// light change to the single (side-view) eye. Cosmetic only.
// =========================================================================
function rcSparkle(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - 0.4) * r * 0.38, y + Math.sin(a - 0.4) * r * 0.38);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a + 0.4) * r * 0.38, y + Math.sin(a + 0.4) * r * 0.38);
  }
  ctx.fill();
}
function rcHeart(ctx, x, y, s, col, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.1, y, x - s, y - s * 0.15, x - s, y - s * 0.6);
  ctx.bezierCurveTo(x - s, y - s * 1.05, x - s * 0.35, y - s * 1.1, x, y - s * 0.62);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 1.1, x + s, y - s * 1.05, x + s, y - s * 0.6);
  ctx.bezierCurveTo(x + s, y - s * 0.15, x + s * 0.1, y, x, y + s * 0.35);
  ctx.fill();
  ctx.restore();
}
function rcSweatDrop(ctx, x, y, s, col) {
  ctx.fillStyle = col || "rgba(150,210,255,0.95)";
  ctx.beginPath();
  ctx.moveTo(x, y - 2.4 * s);
  ctx.quadraticCurveTo(x + 1.7 * s, y + 0.4 * s, x, y + 1.9 * s);
  ctx.quadraticCurveTo(x - 1.7 * s, y + 0.4 * s, x, y - 2.4 * s);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath(); ctx.arc(x - 0.5 * s, y, 0.5 * s, 0, Math.PI * 2); ctx.fill();
}
function rcMoodGlyph(ctx, x, y, ch, col, d) {
  // a mood symbol with a soft dark outline + a thin light rim so it reads cleanly (not flat text)
  ctx.save();
  ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "900 " + (12 * d).toFixed(1) + "px 'Hiragino Maru Gothic ProN', 'Trebuchet MS', system-ui, sans-serif";
  ctx.lineWidth = 3.2 * d; ctx.strokeStyle = "rgba(14,11,26,0.92)"; ctx.strokeText(ch, x, y);
  ctx.lineWidth = 1.1 * d; ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.strokeText(ch, x, y);
  ctx.fillStyle = col; ctx.fillText(ch, x, y);
  ctx.restore();
}
function rcDrawDragonFace(ctx, cx, cy, dep, mood, now, col) {
  if (!mood) return;
  // リグ竜では目は“目パーツ”が担う（mood別に変形）。素朴な白目overlayは描かず、漫符/効果だけ重ねる。
  const rigEye = (typeof RC_RIG !== 'undefined' && RC_RIG && (typeof window === 'undefined' || window.RC_USE_RIG !== false));
  const d = Math.max(0.9, dep), t = now / 600;
  const _b = _rcBuildFor(col);                                 // match the sprite's per-dragon build
  const _k = RC_DRG.px * _RC_INRACE;                           // grid-cell → on-screen (in-race scale = _RC_INRACE·dep)
  let ex, ey;
  if (rigEye && RC_RIG && RC_RIG._eyeC) {
    // リグ竜：目/漫符は rcDrawDragonRig と同じ変換で“実際の目パーツ位置”から算出（grid式は約85pxずれる）
    const bb = RC_RIG._bbox, wsc = _k * d * _b.sz * _b.sx, hsc = _k * d * _b.sz * _b.sy;
    const rsx = (RC_DRG.GW * wsc) / bb.w, rsy = (RC_DRG.GH * hsc) / bb.h;
    const ax = bb.x + (RC_DRG.anchorX / RC_DRG.GW) * bb.w, ay = bb.y + (RC_DRG.anchorY / RC_DRG.GH) * bb.h;
    ex = cx + (RC_RIG._eyeC.x - ax) * rsx; ey = cy + (RC_RIG._eyeC.y - ay) * rsy;
  } else {
    ex = cx + (RC_DRG.eyeX - RC_DRG.anchorX) * _k * _b.sz * _b.sx * d;
    ey = cy + (RC_DRG.eyeY - RC_DRG.anchorY) * _k * _b.sz * _b.sy * d;
  }
  const sx = ex + 1 * d, sy = ey - 13 * d + Math.sin(t) * 1.4;  // floating mood symbol above the head
  const INK = "#2a2030", ER = 3.85 * d;                        // soft thin ink; ER = white radius (a little smaller again)
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // super-simple old-manga eye: a big white oval + a plain dark pupil + one tiny highlight + a thin
  // delicate outline. No iris, no eyebrow, no eyelash — light and minimal.
  function openEye(pxo, pyo, scl) {
    if (rigEye) return;                                                  // リグの目パーツが担当
    const s = scl || 1, rx = ER, ry = ER * 1.16, pupR = ER * 0.27 * s;   // small pupil
    const px = ex + (pxo == null ? 0.18 : pxo) * d, py = ey + (pyo == null ? 0.3 : pyo) * d;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(px, py, pupR, 0, 6.2832); ctx.fill();   // a tiny solid-black dot (no highlight)
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8 * d; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, 6.2832); ctx.stroke();
  }
  // a smooth, thin closed/squint eye arc (the eye itself — no lashes)
  function lid(yoff, curve, w) { if (rigEye) return; ctx.strokeStyle = INK; ctx.lineWidth = (w || 1.2) * d; ctx.beginPath(); ctx.moveTo(ex - ER, ey + yoff * d); ctx.quadraticCurveTo(ex, ey + (yoff + curve) * d, ex + ER, ey + yoff * d); ctx.stroke(); }
  if (mood === "joy") {
    lid(0.4, -3.6, 1.2);                                                                  // ‿ happy closed eye (thin)
    rcSparkle(ctx, sx, sy, 4.8 * d, "#fff0a0"); rcSparkle(ctx, sx + 5.5 * d, sy + 5 * d, 2.6 * d, "#fff7cf");
  } else if (mood === "effort") {
    openEye(0.2, 0.7, 0.9);                                                               // determined, pupil low
    rcSweatDrop(ctx, sx, sy + 2 * d, 1.8 * d);
  } else if (mood === "confused") {
    openEye(0.2, 0.3, 0.85);
    rcMoodGlyph(ctx, sx, sy, "?", "#ffd86a", d * 1.2);
  } else if (mood === "tired") {
    lid(0.3, 2.0, 1.2);                                                                   // droopy half-lid (thin)
    rcSweatDrop(ctx, sx - 2.5 * d, sy + 3 * d, 1.4 * d); rcSweatDrop(ctx, sx + 2 * d, sy + 1 * d, 1.15 * d);
  } else if (mood === "surprised") {
    openEye(0, 0.1, 0.9);                                                                 // wide eye
    rcMoodGlyph(ctx, sx, sy, "!", "#ff9a9a", d * 1.25);
  } else if (mood === "serious") {
    openEye(0.24, 0.34, 1.0);                                                             // focused (small dot) + glint
    rcSparkle(ctx, sx + 1 * d, sy + 1 * d, 2.1 * d, "#bfe3ff");
  } else if (mood === "panic") {
    openEye(Math.sin(t * 5) * 0.9, 0.5, 0.9);                                             // darting pupil
    rcSweatDrop(ctx, sx - 3.2 * d, sy + 1.5 * d, 1.7 * d); rcSweatDrop(ctx, sx + 1.2 * d, sy - 1 * d, 1.3 * d);
    rcMoodGlyph(ctx, sx + 4 * d, sy + 3.2 * d, "!?", "#ff9a9a", d * 1.0);
  } else if (mood === "relaxed") {
    lid(-1.0, 3.3, 1.2);                                                                  // ⌣ content eye (thin)
    rcMoodGlyph(ctx, sx, sy, "♪", "#bdf3c6", d * 1.2);
  } else if (mood === "spin") {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * d; ctx.beginPath();
    for (let a = 0; a < Math.PI * 2.6; a += 0.36) { const r = 0.5 * d + a * 0.62 * d; const px = ex + Math.cos(a) * r, py = ey + Math.sin(a) * r; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
    for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.0944; rcSparkle(ctx, sx + Math.cos(a) * 5 * d, sy + Math.sin(a) * 3 * d, 2.0 * d, "#ffe06a"); }
  } else if (mood === "yawn") {
    lid(0.8, -2.7, 1.2);
    ctx.font = "italic 900 " + (9 * d).toFixed(1) + "px system-ui, sans-serif"; ctx.fillStyle = "rgba(190,210,255,0.95)";
    ctx.fillText("z", sx, sy + 1 * d); ctx.fillText("z", sx + 4 * d, sy - 4.5 * d);
  } else {
    openEye();   // neutral — a clean, bright open eye so the dragon never looks blank in-race
  }
  ctx.restore();
}

// =========================================================================
// Player
// =========================================================================
function startRaceCanvas(container, ctx) {
  stopRacePlayer();

  const { race, raceResult, oddsResult, bet, betResult, timeline, commentary, broadcast } = ctx;
  const dragons = timeline.dragons;

  // stable lane assignment (varied, not by rank) for vertical separation
  const laneOrder = dragons
    .map((dr, i) => ({ dr, k: tlHash(dr.id) }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.dr);
  const laneOf = {};
  laneOrder.forEach((dr, i) => { laneOf[dr.id] = i; });

  // popularity / bet lookups
  const popRank = {};
  (oddsResult.oddsData || []).forEach(o => { popRank[o.dragonId] = o.popularityRank; });
  const betSet = new Set((bet && bet.selections) || []);

  // --- course fitness: which dragons SUIT each section, so the course's effect on a
  // dragon (and its speed) is visible & legible. For each third, the section's dominant
  // stat is its "demand"; a dragon's standing in that stat among the field marks it
  // suited (+1) / neutral (0) / weak (-1). Presentation only — the timeline already
  // bakes the true effect into the run; this just surfaces the WHY for the player. ---
  const statById = {};
  (typeof getRaceDragons === "function" ? getRaceDragons(race) : []).forEach(d => { if (d && d.stats) statById[d.id] = d.stats; });
  // full personality records (思想) — style / nerve / visualMood drive each dragon's
  // pre-start fidget and in-race flourishes (jumps, wind-spins, the relaxed/serious face).
  const persoById = {};
  (typeof getRaceDragons === "function" ? getRaceDragons(race) : (typeof DRAGONS !== "undefined" ? DRAGONS : [])).forEach(d => { if (d) persoById[d.id] = d; });
  function persoOf(id) { return persoById[id] || {}; }
  function dragonPhase(id) { return ((tlHash(id) % 997) / 997) * Math.PI * 2; }   // desync per dragon
  const STAT_JP = { speed: "速さ", stamina: "底力", fire: "闘志", wing: "翼", turn: "旋回", nerve: "気性" };
  const _sectionStat = [0, 1, 2].map(t => {
    const sec = (typeof getSection === "function") ? getSection(phaseOfThird(t), sectionKeyAtThird(t)) : null;
    if (!sec || !sec.weights) return "speed";
    let best = "speed", bw = -1;
    for (const k in sec.weights) if (sec.weights[k] > bw) { bw = sec.weights[k]; best = k; }
    return best;
  });
  const _fitByThird = [0, 1, 2].map(t => {
    const stat = _sectionStat[t];
    const vals = dragons.map(dr => (statById[dr.id] && statById[dr.id][stat]) || 50).sort((a, b) => a - b);
    const lo = vals[Math.floor((vals.length - 1) * 0.34)], hi = vals[Math.ceil((vals.length - 1) * 0.66)];
    const m = {};
    dragons.forEach(dr => { const v = (statById[dr.id] && statById[dr.id][stat]) || 50; m[dr.id] = (hi > lo && v >= hi) ? 1 : (hi > lo && v <= lo ? -1 : 0); });
    return m;
  });
  function dragonFitnessAtP(id, P) { return (_fitByThird[thirdAtP(clamp(P, 0, 1))] || {})[id] || 0; }
  function sectionStatAtP(P) { return _sectionStat[thirdAtP(clamp(P, 0, 1))]; }

  // ---- per-dragon BEHAVIOR layer (presentation only; never touches order/result) ----
  // Returns motion offsets + a suggested mood for the running phase, from the dragon's
  // 思想 (style/nerve/visualMood) and the live situation (terrain / tired / surge).
  function behaviorOf(dr, P, ownU, intensity, tired, surging) {
    const beh = { jump: 0, spin: 0, squash: 1, down: false, mood: null };
    if (P >= 1) return beh;                       // post-line handled separately
    const id = dr.id, pd = persoOf(id);
    const nerve = (pd.stats && pd.stats.nerve) || 60;
    const wing = (pd.stats && pd.stats.wing) || 60;
    const vmood = pd.visualMood || 55;
    const style = pd.style || dr.style;
    const ph = dragonPhase(id);
    const now = performance.now() / 1000;
    const tkey = themeKeyAtP(P);

    // tired → walk it out, head down
    if (tired) { beh.down = true; beh.mood = "tired"; return beh; }

    // a gust catches a flighty dragon on the wind lanes → it spins (強風で回転)
    if (tkey === "wind" && intensity > 0.25) {
      const prone = clamp((72 - nerve) / 38, 0, 1) * clamp((70 - wing) / 40, 0, 1);
      const win = Math.sin(now * 0.9 + ph * 1.3);                 // slow per-dragon window
      if (prone > 0.18 && win > 0.93) {
        const k = (win - 0.93) / 0.07;                           // 0..1 across the gust
        beh.spin = Math.sin(k * Math.PI) * Math.PI * 2;          // a full eased rotation
        beh.mood = "spin";
        return beh;
      }
    }

    // surge reads via the glow + sparkle + a joyful face (no jump — constant hopping looked too busy)
    if (surging) beh.mood = "joy";
    return beh;
  }

  // ---- ENTRANCE: the field walks in from the left to take its place at the gate. ----
  // Eager 逃げ types stride in first; laid-back chasers amble in last. Cosmetic.
  // ---- ENTRANCE timing: walk in (staggered by 思想), then a BRIEF settle → countdown.
  // ENTRY_DUR is DYNAMIC = (last dragon's arrival) + a short settle, so there's no dead
  // standing-around wait between "everyone's in position" and the count starting. ----
  const ENTRY_WALK = 3.8, ENTRY_STAGGER = 5.0, ENTRY_SETTLE = 0.6;
  function entranceEager(dr) {
    const pd = persoOf(dr.id), vmood = pd.visualMood || 55, style = pd.style || dr.style;
    return clamp((style === "escape" ? 0.85 : style === "front" ? 0.6 : style === "late" ? 0.4 : 0.25) + (vmood - 55) / 150, 0, 1);
  }
  let _entMaxArrival = 0;
  dragons.forEach(dr => { _entMaxArrival = Math.max(_entMaxArrival, (1 - entranceEager(dr)) * ENTRY_STAGGER + ENTRY_WALK); });
  const ENTRY_DUR = _entMaxArrival + ENTRY_SETTLE;

  // pre-race spectacle scales with rank: R1 modest, R7 grand (flashes / beams / glitter / wording).
  const rankHype = clamp(((race.rank || 1) - 1) / 6, 0, 1);
  // 煽り (実況) lines — weave in the COURSE (distance / weather / key terrain & its demand)
  // and the RACE'S 意義 (grade + purpose), grander wording at higher ranks.
  const _hypeLines = (function () {
    const N = dragons.length, r = race.rank || 1;
    const gradeL = (typeof RANKS !== "undefined" && RANKS[r] && RANKS[r].label) ? RANKS[r].label : ("Rank" + r);
    const distL = (typeof DISTANCE !== "undefined" && DISTANCE[race.distance] && DISTANCE[race.distance].label) || "";
    const wxL = (typeof WEATHERS !== "undefined" && WEATHERS[race.weather] && WEATHERS[race.weather].label) || "";
    const midSec = (typeof getSection === "function") ? getSection("mid", race.mid) : null;
    const midLabel = (midSec && midSec.label) || "";
    const midStat = STAT_JP[_sectionStat[1]] || "総合力";
    const lines = [];
    lines.push(`【${gradeL}】${raceFullName(race)}、まもなく発走！`);
    lines.push(midLabel
      ? `舞台は${distL}・${wxL}。中盤の「${midLabel}」、${midStat}が問われる難所だ。`
      : `舞台は${distL}・${wxL}。${N}頭の真価が問われる。`);
    if (race.purpose) lines.push(`この一戦の意義——${race.purpose}。`);
    lines.push(r >= 6 ? "頂点を懸けた、運命の決戦。歴史が動く！"
      : r >= 4 ? "格を懸けた、譲れぬ大一番。"
        : r >= 2 ? "未来へ繋ぐ、大切な一戦。"
          : "ここから、物語が始まる。");
    lines.push(r >= 6 ? "張りつめた空気——いざ、発走！"
      : r >= 4 ? "息を呑む静けさ。さあ、発走だ！"
        : "さあ、運命のゲートが開く。発走！");
    return lines;
  })();
  // ★A-2 入場ロールコール：入場の後半を使って1頭ずつ紹介する。
  //   「斜め整列でも個体が読める」を担保する見せ場＝愛され感の入口。全て表示のみ。
  //   紹介順＝レーン順（laneOrder）＝画面の手前から奥へ。1頭あたり ROLL_EACH 秒。
  // 動きを減らす設定（B の呼吸/首かしげ/残像はここで一括OFF）
  const _reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const ROLL_EACH = 0.8;
  const _rollOrder = laneOrder.slice();                       // 手前(ln=0)から順に
  const ROLL_SPAN = ROLL_EACH * _rollOrder.length;
  const _rollStart = Math.max(0, ENTRY_DUR - ROLL_SPAN - 0.2); // 入場の終盤に寄せる
  let _rollShown = -1;
  function pumpRollCall() {
    const elapsed = ENTRY_DUR - S.entryT;
    if (elapsed < _rollStart) { S.roll = -1; return; }
    const idx = Math.min(_rollOrder.length - 1, Math.floor((elapsed - _rollStart) / ROLL_EACH));
    S.roll = idx;
    if (idx === _rollShown) return;
    _rollShown = idx;
    const dr = _rollOrder[idx];
    if (!dr) return;
    // ★入場の点呼（「◯番人気 ◯◯、入場！」を1頭ずつ）は実況から外した。
    //   8頭を順に読み上げると情報が多すぎて、誰が主役なのか分からなくなる
    //   （ユーザー指摘）。入場で語るのは場・条件・注目の竜だけ＝放送台本の
    //   entry ブロックが担当する。ここは絵として竜が入場するのを見せるだけ。
    // 自分の賭け竜の紹介だけ、音と視聴者の反応を足す（依怙贔屓＝プレイヤーの当事者性）
    if (betSet.has(dr.id)) {
      try { if (window.Sfx) Sfx.play("tick", 1.25); } catch (e) {}
      pushChat("mineUp", commentaryName(dr.id));
      S.pops.push({ x: startTapeX() - 10, y: ch * 0.55, tx: "✨", c: "#ffe9a8",
        t0: performance.now() / 1000, sz: 15 });
    }
  }

  function entranceBehaviorOf(dr) {
    const beh = { jump: 0, spin: 0, squash: 1, down: false, mood: "serious", lean: 0, dx: 0 };
    const id = dr.id, pd = persoOf(id);
    const nerve = (pd.stats && pd.stats.nerve) || 60;
    const vmood = pd.visualMood || 55;
    const style = pd.style || dr.style;
    const ph = dragonPhase(id);
    const now = performance.now() / 1000;
    const elapsed = ENTRY_DUR - S.entryT;                          // seconds into the parade
    const eager = entranceEager(dr);
    const sleepy = vmood < 56 && (style === "chase" || style === "late");
    const startDelay = (1 - eager) * ENTRY_STAGGER;               // eager set off first; the rest amble in later
    const walkProg = clamp((elapsed - startDelay) / ENTRY_WALK, 0, 1);
    // easeInOut → a steady walk at a natural pace (no zoom), settling at the line
    const ease = walkProg < 0.5 ? 2 * walkProg * walkProg : 1 - Math.pow(-2 * walkProg + 2, 2) / 2;
    beh.dx = -(1 - ease) * (cw * 0.46);                            // walk in from off the left
    if (walkProg < 1) {                                           // still walking in
      beh.down = true;
      beh.jump = Math.abs(Math.sin(now * 6 + ph)) * 0.04;          // small walking bob
      beh.mood = sleepy ? "yawn" : "serious";
    } else {                                                       // arrived — wait at the gate, by disposition (calm)
      if (sleepy) { beh.down = true; beh.mood = (Math.sin(now * 0.7 + ph) > 0.3) ? "yawn" : "relaxed"; }
      else if (eager > 0.7) { beh.lean = 0.4; beh.mood = "serious"; beh.jump = Math.max(0, Math.sin(now * 2.4 + ph)) * 0.03; }
      else if (nerve < 60) { beh.mood = (Math.sin(now * 1.2 + ph) > 0.35) ? "panic" : "serious"; }
      else { beh.mood = (Math.sin(now * 0.6 + ph) > 0.5) ? "relaxed" : "serious"; }
    }
    return beh;
  }

  // ---- PRE-START idle: cute, 思想-driven fidget at the gate during the 3-2-1. ----
  // Eager 逃げ types prance & lean forward; calm temperaments stand composed; the
  // sleepy chaser yawns; nervous types fidget. Purely cosmetic — the gun fires the same.
  const PRE_TOTAL = 3.0;
  function prestartBehaviorOf(dr) {
    const beh = { jump: 0, spin: 0, squash: 1, down: false, mood: "serious", lean: 0 };
    const id = dr.id, pd = persoOf(id);
    const nerve = (pd.stats && pd.stats.nerve) || 60;
    const vmood = pd.visualMood || 55;
    const style = pd.style || dr.style;
    const ph = dragonPhase(id);
    const now = performance.now() / 1000;
    const pre = clamp(1 - S.preT / PRE_TOTAL, 0, 1);                 // 0→1 across the countdown
    const eager = (style === "escape" ? 0.9 : style === "front" ? 0.55 : style === "late" ? 0.32 : 0.18) + (vmood - 55) / 120;
    const calm = clamp((nerve - 55) / 45, 0, 1);
    const sleepy = vmood < 56 && (style === "chase" || style === "late");

    // arrival shuffle in the first beat — a couple of settling steps into the gate
    if (pre < 0.22) {
      const k = pre / 0.22;
      beh.jump = Math.abs(Math.sin(now * 9 + ph)) * 0.08 * (1 - k);
      beh.down = true; beh.mood = "serious";
      return beh;
    }
    // idle fidget, by disposition
    if (sleepy) {
      beh.down = true;
      beh.mood = (Math.sin(now * 0.7 + ph) > 0.3) ? "yawn" : "relaxed";
      beh.jump = Math.max(0, Math.sin(now * 0.5 + ph)) * 0.05;       // slow drowsy nod
    } else if (eager > 0.7) {
      const ex = 0.55 + 0.45 * pre;                                  // ramps up as the gun nears
      beh.jump = Math.max(0, Math.sin(now * (3.5 + 2 * pre) + ph)) * 0.05 * ex;   // subtle bob
      beh.lean = 0.6 * ex;                                           // leaning eagerly at the line
      beh.mood = pre > 0.72 ? "panic" : "serious";                   // 焦り right before GO
    } else if (calm > 0.55) {
      beh.mood = (Math.sin(now * 0.6 + ph) > 0.5) ? "relaxed" : "serious";
      beh.jump = Math.max(0, Math.sin(now * 3 + ph)) * 0.03;         // gentle composed sway
    } else {
      beh.jump = Math.max(0, Math.sin(now * 5 + ph)) * 0.05;         // small nervous fidget
      beh.mood = (Math.sin(now * 1.3 + ph) > 0.2) ? "panic" : "serious";
    }
    return beh;
  }

  // ---- POST-GOAL: winners celebrate (joyful leaps), the rest pull up to a walk. ----
  function postgoalBehaviorOf(dr, place) {
    const beh = { jump: 0, spin: 0, squash: 1, down: false, mood: null };
    const ph = dragonPhase(dr.id);
    const now = performance.now() / 1000;
    if (place <= 3) {
      beh.jump = Math.max(0, Math.sin(now * 2.6 + ph)) * (place === 1 ? 0.32 : 0.18);   // gentle happy bob
      beh.mood = "joy";
      if (beh.jump > 0.05) beh.squash = 1 + beh.jump * 0.16;
    } else {
      beh.down = true; beh.mood = "tired";                                            // blowing, pulling up
    }
    return beh;
  }

  // ---- DOM shell ----
  container.innerHTML = "";
  const wrap = el("div", "rc-wrap");
  wrap.innerHTML = `
    <div class="rc-hud">
      <div class="rc-hud-left">
        <span class="rc-phase" id="rc-phase">序盤</span>
        <span class="rc-section" id="rc-section"></span>
        <span class="rc-race">${raceFullName(race)}</span>
      </div>
      <div class="rc-hud-right">
        <span class="rc-weather">${(WEATHERS[race.weather] || {}).label || ""}</span>
        <span class="rc-remain" id="rc-remain">残り ${timeline.distanceMeters}m</span>
        <span class="rc-viewers" id="rc-viewers" title="視聴者数"><i>👁</i><b>0</b></span>
      </div>
    </div>
    <div class="rc-stage">
      <canvas id="rc-canvas"></canvas>
      <!-- ★D3：生中継の徽章。ホーム＝配信・物語＝密着ドキュメンタリーと同じ世界であることを一目で示す -->
      <span class="rc-live" id="rc-live"><i></i>LIVE</span>
      <!-- ゴールの合図＝このデザインされた帯に一本化（canvas側の素の「ゴールイン！」は撤去した）。 -->
      <div class="rc-goalband" id="rc-goalband" hidden>🎉 ゴール！</div>
      <!-- ★CODEX納品：ゴール後に座席から立ち上がる観客の背中（12フレーム・1回再生） -->
      <div class="rc-crowdglow" aria-hidden="true">
        <img src="images/race_live/crowd_glow_sprite.webp" alt="" decoding="async" onerror="this.parentNode.remove()">
      </div>
      <button class="rc-play" id="rc-play" title="再生/一時停止">⏸</button>
    </div>
    <!-- ★RACE_SCREEN_LIVE D1：生着順ボード。画面下半分の主役＝8頭の行がFLIPで入れ替わり続ける。
         旧 rc-rankbar（1行テキスト）と rc-bet（HUD隅の期待メーター）はここへ置換統合した。 -->
    <!-- ★ゆっくり実況ゾーン：左=実況（ミミ固定・事実）／右=解説（毎レース抽選・解釈）。
         ★着順ボードより「上」に置く（ユーザー指示）。走っている絵のすぐ下で二人が喋り、
           その下に順位表が来る＝視線が 絵→声→順位 の順に落ちる。
         ★旧・視聴者コメント（rc-chat）は撤去。匿名の短文は情報も感情も薄く、
           二人の掛け合いに置き換えたほうが読む価値が出るため。 -->
    <div class="rc-yt" id="rc-yt">
      <div class="rc-yt-side rc-yt-l" id="rc-yt-l">
        <div class="rc-yt-bub" id="rc-yt-bub-l"></div>
        <div class="rc-yt-manju">
          <img id="rc-yt-img-l" alt="" decoding="async" onerror="this.parentNode.classList.add('noimg')">
          <span class="rc-yt-name" id="rc-yt-name-l"></span>
        </div>
      </div>
      <div class="rc-yt-side rc-yt-r" id="rc-yt-r">
        <div class="rc-yt-bub" id="rc-yt-bub-r"></div>
        <div class="rc-yt-manju">
          <img id="rc-yt-img-r" alt="" decoding="async" onerror="this.parentNode.classList.add('noimg')">
          <span class="rc-yt-name" id="rc-yt-name-r"></span>
        </div>
      </div>
    </div>
    <div class="rc-board" id="rc-board"></div>
    <div class="rc-controls" id="rc-controls"></div>
    <div class="rc-finishstrip" id="rc-finishstrip" style="display:none"></div>
    <div class="rc-log" id="rc-log" style="display:none"></div>
  `;
  container.appendChild(wrap);

  const canvas = wrap.querySelector("#rc-canvas");
  const cctx = canvas.getContext("2d");
  if (!cctx) {
    // 2D canvas が使えない環境 — 視覚レースを飛ばして結果画面へ直行し、進行を止めない
    if (typeof renderResult === "function") renderResult();
    return null;
  }
  // レースBGM：racebgm フォルダの曲からランダムで1曲ループ再生（曲が無ければ無音）。
  if (typeof RaceBgm !== "undefined") RaceBgm.start();
  const remainEl = wrap.querySelector("#rc-remain");
  const phaseEl = wrap.querySelector("#rc-phase");
  const sectionEl = wrap.querySelector("#rc-section");
  const boardEl = wrap.querySelector("#rc-board");
  const controlsEl = wrap.querySelector("#rc-controls");
  const finishStripEl = wrap.querySelector("#rc-finishstrip");
  const logEl = wrap.querySelector("#rc-log");
  const playBtn = wrap.querySelector("#rc-play");

  // ---- responsive canvas sizing (devicePixelRatio aware) ----
  let cw = 0, ch = 0, dpr = 1;
  // R8-W6c: パララックス時はコース帯そのものが無い＝竜の飛行帯は「絵の世界」いっぱいに
  // 広げる（モック準拠：後方竜は山を背に高く・先頭は手前の道の上を低く飛ぶ）。
  const RC_TRACK_TOP_PARA = 0.30, RC_TRACK_BOT_PARA = 0.92, RC_TRACK_TOP_BASE = 0.34;
  let skyBase = null;            // offscreen time-of-day far-backdrop, rebuilt on resize
  function buildSkyBase() {
    if (!cw || !ch) { skyBase = null; return; }
    try {
      const oc = document.createElement("canvas");
      oc.width = Math.round(cw); oc.height = Math.round(ch);
      // 背景画：夕/黄昏/夜＝夜の絵(地域別→fire)、朝/昼＝昼の絵(day・聖龍島の昼景)。
      // 絵が無ければプロシージャル空。未読込→読込完了で再焼き。
      const t = rcRaceTime(race);
      const rebake = function () { if (document.contains(canvas)) buildSkyBase(); };
      const bgPaint = (t === "sunset" || t === "dusk" || t === "night")
        ? rcBgFor(race, rebake)
        : rcBgForSlug("day", null, rebake);
      rcRenderSkyBase(oc.getContext("2d"), oc.width, oc.height, t, bgPaint);
      skyBase = oc;
    } catch (e) { skyBase = null; }
  }
  // R8-W1: パララックス3層を「描画サイズの焼き済みタイル」にする。
  // ・毎フレーム1600px級を縮小せず小タイルをwrap描画（速度）・セットあたり<1MB（メモリ）
  // ・左端Bpxへ右端をαランプで重ねる＝タイル境界がC0連続の完全ループ（継ぎ目ゼロ）
  // ・時間帯トーンは焼き込み（遠景ほど濃く＝空気遠近）。夜系レースのみ・失敗時 null=従来経路。
  let paraBaked = null;
  function bakePara() {
    paraBaked = null;
    if (!cw || !ch) return;
    const t = rcRaceTime(race);
    // 全時間帯パララックス（racebg_v2_time 納品済）。失敗時は従来経路へ自動フォールバック。
    const e = rcParaFor(race, function () { if (document.contains(canvas)) bakePara(); }, RC_TIME_DIR[t] || "night");
    if (!e || !e.ok) return;
    try {
      const conf = RC_SKY_CONF[t] || RC_SKY_CONF.night;
      // ★モック準拠レイアウト（R8-W6c）：コースの帯を描かず「絵の世界そのもの」が路面。
      //   L1=全画面カバー（空〜地面まで絵が描く）／L2=地平線まわりの中景／
      //   L3=画面下端の最近景帯（×1.0＝竜と同じ路面速度＝これが事実上の地面）。
      const spec = [
        { dh: ch,        anchor: null,      tone: 0.55 },   // L1 全画面
        { dh: ch * 0.62, anchor: ch * 0.80, tone: 0.35 },   // L2 中景（下端=画面80%）
        { dh: ch * 0.34, anchor: ch + 2,    tone: 0.20 },   // L3 最近景（下端=画面下端）
      ];
      const L = [], dw = [], dh = [], dy = [];
      const px = Math.min(2, dpr || 1);                                // 焼き解像度（dpr>2は2で十分）
      for (let i = 0; i < 3; i++) {
        const img = e.imgs[i], s = spec[i];
        const w = Math.max(64, img.naturalWidth * (s.dh / img.naturalHeight));
        const oc = document.createElement("canvas");
        oc.width = Math.max(1, Math.round(w * px)); oc.height = Math.max(1, Math.round(s.dh * px));
        const c2 = oc.getContext("2d");
        c2.drawImage(img, 0, 0, oc.width, oc.height);
        // ループ化クロスフェード：原画右端のB相当を左端へ αランプ(左1→右0) で重ねる
        const B = Math.max(24, Math.round(oc.width * 0.09));
        const strip = document.createElement("canvas");
        strip.width = B; strip.height = oc.height;
        const sc2 = strip.getContext("2d");
        const swSrc = img.naturalWidth * (B / oc.width);
        sc2.drawImage(img, img.naturalWidth - swSrc, 0, swSrc, img.naturalHeight, 0, 0, B, oc.height);
        sc2.globalCompositeOperation = "destination-in";
        const gr = sc2.createLinearGradient(0, 0, B, 0);
        gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        sc2.fillStyle = gr; sc2.fillRect(0, 0, B, oc.height);
        c2.drawImage(strip, 0, 0);
        // 時間帯トーン（soft-light・遠景ほど濃く）＋夕/黄昏は僅かな明度リフト
        c2.save();
        c2.globalCompositeOperation = "soft-light"; c2.globalAlpha = s.tone;
        const tg = c2.createLinearGradient(0, 0, 0, oc.height);
        conf.sky.forEach(function (sv) { tg.addColorStop(sv[0], sv[1]); });
        c2.fillStyle = tg; c2.fillRect(0, 0, oc.width, oc.height);
        const lift = t === "sunset" ? 0.10 : t === "dusk" ? 0.05 : 0;
        if (lift > 0 && i === 0) { c2.globalCompositeOperation = "screen"; c2.globalAlpha = 1; c2.fillStyle = rcRgba(conf.haze, lift); c2.fillRect(0, 0, oc.width, oc.height); }
        c2.restore();
        L.push(oc); dw.push(w); dh.push(s.dh);
        dy.push(s.anchor == null ? 0 : s.anchor - s.dh);
      }
      paraBaked = { slug: e.slug, L: L, dw: dw, dh: dh, dy: dy, rate: [0.15, 0.45, 1.0], haze: conf.haze };
    } catch (_) { paraBaked = null; }
  }
  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;          // canvas が DOM から外れている — リサイズをスキップ
    const rect = parent.getBoundingClientRect();
    cw = Math.max(280, rect.width);
    ch = Math.max(280, Math.min(480, Math.round(cw * 0.55)));
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildSkyBase();
    bakePara();
  }
  const onResize = () => { resize(); draw(); };
  window.addEventListener("resize", onResize);
  resize();

  // ---- playback state ----
  const S = {
    tau: 0,
    speed: 1,
    playing: true,
    finished: false,
    raf: null,
    last: 0,
    camL: -0.66 * 0.3,
    started: 0,
    // --- dynamic camera ---
    zoom: 1, zoomT: 1,          // eased push-in (1 = wide)
    camY: 0, camYT: 0,          // eased vertical follow-pan (px, world space)
    shake: 0, shakeX: 0, shakeY: 0,  // impulse screen-shake
    _winw: 0.3,
    gait: {},          // per-dragon gait clock
    particles: [],
    likes: [], likeCount: 0, likeT: 0,   // livestream-style "いいね" hearts (entrance + on tap)
    ambT: 0,           // ambient-particle spawn accumulator
    floats: [],
    crossedSet: new Set(),
    tapeBroken: false,
    crossClock: {},     // per-dragon seconds since it crossed the wire (run-through)
    crossV: {},         // per-dragon speed at the moment it crossed (coast distance ∝ this)
    showLog: false,
    finishedAnnounced: false,
    rewardT: 0,         // seconds since the goal-moment reward reveal began (spec #37)
    countdown: 0,
    // --- presentation drama ---
    entryT: ENTRY_DUR,  // entrance walk-in (holds τ; the field parades to the gate first)
    mood: {},           // per-dragon held expression {m,t} — debounces face flicker
    preT: 3.0,          // pre-start 3-2-1 countdown (holds τ at the gate)
    goFlash: 0,         // "GO！" burst after the countdown
    zoomBump: 0,        // extra push-in impulse from overtakes / close battles
    photoT: 0,          // R8-W1: フォトフィニッシュ静止1拍の残り秒（>0の間 世界を止める・表示のみ）
    photoUsed: false,   // 1着の鼻先ゴールで一度だけ発火
    flyIn: 0,           // R8-W6d: GOからの秒数——地面スタート→各飛行高度へ舞い上がる演出用（表示のみ）
    tapeAlpha: 1,       // ★A-1 発走テープの不透明度（GOで0へ＝弾けて消える・表示のみ）
    tapeBurst: false,   // テープ破断の粒を1度だけ出すためのフラグ
    roll: -1,           // ★A-2 ロールコールの対象index（-1=なし）。入場中に0..N-1へ進む
    lowSpec: false,     // R8-W5: 低速機の自動縮退（パララックス2層・ポップ2件・ストリーク半減）
    prevStand: null,    // {id: place} last frame, for overtake detection
    cheerT: 1.2,        // throttle for cheer-your-pick callouts
    battleT: 0,         // throttle for 接戦！ callouts
    overT: 0,           // throttle for overtake callouts
    celebrated: false,  // finish confetti fired once
    confettiT: 0,       // ongoing confetti spawn while celebrating
    banner: null,       // {text,t,max} active phase-entry banner
    phaseShown: 0,      // last phase index a banner was raised for
    trioShown: false,   // "三つ巴！" lead-trio callout fired once
    terrainSign: null,  // {icon,label,t,max} section-entry terrain sign
    sectionShown: -1,   // last course third (0/1/2) a terrain sign was raised for
    tilt: 0             // eased camera roll — banks the view through turns
  };
  dragons.forEach(dr => { S.gait[dr.id] = Math.random() * Math.PI * 2; });

  // player's pick (first selection) — used by the cheer treatment
  const pickId = (bet && bet.selections && bet.selections[0]) || null;
  // presentation-only bet-hit check, mirrors resolveBet (win:1st / place:top3 / wide:both top3)
  function computeBetHit() {
    if (!bet || !betSet.size) return null;
    const placeOf = {}; timeline.crossings.forEach(c => { placeOf[c.id] = c.place; });
    const top3 = timeline.crossings.filter(c => c.place <= 3).map(c => c.id);
    if (bet.type === "win")   return placeOf[bet.selections[0]] === 1;
    if (bet.type === "place") return top3.includes(bet.selections[0]);
    if (bet.type === "wide")  return top3.includes(bet.selections[0]) && top3.includes(bet.selections[1]);
    return null;
  }

  // ---- ゆっくり実況：解説者をこのレース1回だけ抽選する ----
  // ★門番は data_commentators 側（availableCommentators）。ここでは結果を受け取るだけ。
  //   直前の解説者は state に覚えておき、同じ人が連続しにくくする（表示専用メタ）。
  const _commentator = (typeof pickCommentator === "function")
    ? pickCommentator(state.player && state.player.lastCommentator) : null;
  if (_commentator) {
    try { state.player.lastCommentator = _commentator.key; } catch (e) {}
  }

  // ---- telop scheduling ----
  // ★本流＝出来事台帳から生やす（race_beats.js）。竜の動きとエフェクトが弾ける
  //   まさにその瞬間に、実況と解説の言葉も出る＝三つが同じ拍で織り合う。
  //   台帳が作れない場合だけ、従来のフェーズ単位の割り付けへ落ちる（安全側）。
  // ★本流＝放送台本（race_broadcast.js）。レースを最初に全部読み切ってから
  //   局面ごとに「何を語るか」を決めた台本を、そのまま流す。
  //   ロード画面の裏で組み立てておいたものがあれば、それを使う（再計算しない）。
  let telopSchedule = [];
  let _bcAnalysis = null;
  try {
    if (typeof buildBroadcast === "function") {
      const pre = ctx.broadcastScript;
      const bc = pre || buildBroadcast(timeline,
        { race, bet, oddsResult, raceResult, trialForms: ctx.trialForms },
        { commentator: _commentator,
          nameOf: (id) => (typeof commentaryName === "function" ? commentaryName(id) : id) });
      telopSchedule = (bc.script || []).map(x => ({ tau: x.tau, line: x.line, side: x.side, tag: x.tag, fired: false }));
      _bcAnalysis = bc.analysis || null;
    }
  } catch (e) { telopSchedule = []; }

  if (!telopSchedule.length && commentary && commentary.length) {
    let prevT = 0;
    for (let p = 0; p < commentary.length; p++) {
      const endT = (p < TL_PHASE_TAU.length) ? TL_PHASE_TAU[p] : 1.0;
      const lines = (commentary[p] && commentary[p].lines) || [];
      const span = Math.max(0.0001, endT - prevT);
      const sides = (commentary[p] && commentary[p].sides) || [];
      lines.forEach((line, i) => {
        const at = prevT + span * ((i + 0.5) / Math.max(1, lines.length));
        // side は engine が付けた担当（color=解説/右・call=実況/左）。未指定なら実況側へ。
        telopSchedule.push({ tau: Math.min(0.999, at), line, side: sides[i] || "call", fired: false });
      });
      // ★解説者の合いの手：そのフェーズの真ん中あたりで1本だけ差し込む。
      //   engine の行に混ぜず独立させることで、抽選で解説者が変わっても
      //   「その人が言いそうなこと」だけが確実にその人の口から出る。
      if (_commentator) {
        const pool = (_commentator.phrases && _commentator.phrases[commentary[p].phaseId]) || [];
        if (pool.length) {
          const ph = pool[(p + (race.id || "").length) % pool.length];   // レースごとに決定的に選ぶ
          telopSchedule.push({ tau: Math.min(0.999, prevT + span * 0.35), line: ph, side: "color", fired: false });
        }
      }
      prevT = endT;
    }
  }
  const shownLines = [];
  // R8-W3 実況の強弱：山場ワードを含む最新行は「絶叫」スタイル（金・大きめ）＝表示のみ
  const TELOP_HOT = /先頭|差し切|抜け出|かわし|接戦|並ん|仕掛け|伸び|ゴール|突き放|猛追|一気|捕らえ/;
  // ---- ゆっくり実況の描画：左右それぞれ「最新の一言」だけを吹き出しに出す ----
  // ★1本ずつしか出さないのは、二人ぶんの履歴を並べると読み切れずに視線が止まるから。
  //   直前の行はテロップ史ではなく「間」で表現する（喋っていない側は吹き出しを薄くする）。
  const _ytEl = {
    l: wrap.querySelector("#rc-yt-l"), r: wrap.querySelector("#rc-yt-r"),
    bl: wrap.querySelector("#rc-yt-bub-l"), br: wrap.querySelector("#rc-yt-bub-r")
  };
  (function setupYukkuri() {
    const imgL = wrap.querySelector("#rc-yt-img-l"), nmL = wrap.querySelector("#rc-yt-name-l");
    const imgR = wrap.querySelector("#rc-yt-img-r"), nmR = wrap.querySelector("#rc-yt-name-r");
    const caster = (typeof RACE_CASTER !== "undefined") ? RACE_CASTER : { name: "ミミ", img: "", color: "#e6b24a" };
    if (imgL) imgL.src = caster.img;
    if (nmL) { nmL.textContent = caster.name; }
    if (_ytEl.l) _ytEl.l.style.setProperty("--c", caster.color);
    if (_commentator) {
      if (imgR) imgR.src = _commentator.img;
      if (nmR) nmR.textContent = _commentator.name;
      if (_ytEl.r) _ytEl.r.style.setProperty("--c", _commentator.color);
    } else if (_ytEl.r) {
      _ytEl.r.hidden = true;      // 解説者が誰も出せない＝実況一人（fail-closed の見た目）
    }
  })();
  // ★各サイドの直近2行を保持して見せる（最新＋ひとつ前）。
  //   1行だけにすると画面上の文字量が一気に減り「実況が薄い」と感じられた（ユーザー指摘）。
  //   ひとつ前を薄く残すと、目を離していても流れが拾える＝読み物としての厚みが出る。
  const _said = { call: [], color: [] };
  function speak(side, line) {
    const isL = side !== "color";
    const key = isL ? "call" : "color";
    const bub = isL ? _ytEl.bl : _ytEl.br;
    const host = isL ? _ytEl.l : _ytEl.r;
    if (!bub || !host || host.hidden) return;
    const arr = _said[key];
    if (arr[arr.length - 1] !== line) arr.push(line);
    // ★出す行は「いまの一言」だけ。
    //   以前は直近2行を出して厚みを補っていたが、実況が台帳駆動で厚くなった今は
    //   「セラムが3番手／セラムが2番手」のような似た行が並ぶだけで、読みにくく冗長。
    //   高さも文字量で動いてレイアウトが揺れる原因になっていた。
    while (arr.length > 1) arr.shift();
    bub.innerHTML = "";
    arr.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = (i === arr.length - 1) ? "rcy-now" : "rcy-prev";
      d.textContent = s;
      bub.appendChild(d);
    });
    bub.classList.toggle("is-hot", isL && TELOP_HOT.test(line));
    // 喋った側を前に出し、もう片方を沈める＝どちらが今しゃべっているか一目で分かる
    if (_ytEl.l) _ytEl.l.classList.toggle("talking", isL);
    if (_ytEl.r) _ytEl.r.classList.toggle("talking", !isL);
    host.classList.remove("pop"); void host.offsetWidth; host.classList.add("pop");
  }
  function renderTelop() {
    const last = shownLines[shownLines.length - 1];
    if (last) speak(last.side, last.line);
  }
  // 決着時に、まだ言っていない行（＝ゴールの決め台詞と、その直前の一言）を吐き出す。
  // ★実況側と解説側の「最後の1本ずつ」だけを出す。全部まとめて流すと一瞬で
  //   上書きされて読めないので、決め台詞が残るようにする。
  function flushTelop() {
    const rest = telopSchedule.filter(t => !t.fired);
    if (!rest.length) return;
    rest.forEach(t => { t.fired = true; });
    const lastOf = (side) => {
      for (let i = rest.length - 1; i >= 0; i--) if (rest[i].side === side) return rest[i];
      return null;
    };
    const c = lastOf("color"), l = lastOf("call");
    if (c) { shownLines.push({ line: c.line, side: "color" }); speak("color", c.line); }
    if (l) { shownLines.push({ line: l.line, side: "call" });  speak("call",  l.line); }
  }
  function pumpTelop() {
    let changed = false;
    for (const t of telopSchedule) {
      if (!t.fired && S.tau >= t.tau) { t.fired = true; shownLines.push({ line: t.line, side: t.side }); changed = true; }
    }
    if (changed) renderTelop();
  }
  // ★入場〜発走前の実況。
  //   従来ここは「8番人気 モム、入場！」と8頭を点呼していた（情報過多で誰が主役か
  //   分からない）ので廃止し、放送台本の entry ブロックに一本化した。
  //   ただし入場中とカウントダウン中は、メインループがテロップ処理へ進む前に
  //   return してしまうため、発走まで実況が無言になり、走り出した瞬間に入場の
  //   台詞が一気に流れて消えていた（ユーザー指摘）。ここで入場ぶんだけを
  //   パレードの進み具合に合わせて自前で送り出す。
  const _entryLines = telopSchedule.filter(t => t.tag === "entry");
  function pumpEntranceTelop() {
    if (!_entryLines.length) return;
    // 入場（パレード）とカウントダウンを合わせて 0→1 の進み具合にする
    const PRE_DUR = 3.0;   // カウントダウンの長さ（S.preT の初期値と揃える）
    const total = ENTRY_DUR + PRE_DUR;
    const spent = (S.entryT > 0) ? (ENTRY_DUR - S.entryT) : (ENTRY_DUR + (PRE_DUR - S.preT));
    const prog = clamp(spent / Math.max(0.001, total), 0, 1);
    let changed = false;
    _entryLines.forEach((t, i) => {
      // 最後の1本が発走直前に来るよう、頭から順に等間隔で置く
      const at = (i + 0.6) / _entryLines.length;
      if (!t.fired && prog >= at) {
        t.fired = true;
        shownLines.push({ line: t.line, side: t.side });
        changed = true;
      }
    });
    if (changed) renderTelop();
  }

  // ---- ゴール後に立ち上がる観客（キャンバス描画版）----
  // 画像そのものは既存のDOM <img>（.rc-crowdglow img）を供給元として使い回す。
  // CSSアニメでコマを送っていたのを、ここで経過時間からコマ番号を出す方式に置き換えた。
  const CROWD_FRAMES = 12, CROWD_STEP_MS = 60;   // 12コマ・1コマ60ms（旧CSSの steps(11,end)/.66s と同等）
  let _crowdT0 = 0;
  function drawCrowdStand() {
    if (!S.finished) { _crowdT0 = 0; return; }          // 走行中は出さない（席は静か）
    const host = wrap.querySelector(".rc-crowdglow");
    const img = host && host.querySelector("img");
    if (!img || !img.complete || !img.naturalWidth) return;   // 未ロード／画像なしは黙って何もしない
    if (!_crowdT0) _crowdT0 = performance.now();
    const fi = Math.min(CROWD_FRAMES - 1, Math.floor((performance.now() - _crowdT0) / CROWD_STEP_MS));
    const fh = img.naturalHeight / CROWD_FRAMES;
    const bandH = ch * 0.36, bandY = ch - bandH;              // 旧CSSと同じ「下36%」
    cctx.save();
    cctx.globalAlpha = 0.55;                                   // 旧 .is-standing と同じ濃さ
    cctx.drawImage(img, 0, fi * fh, img.naturalWidth, fh, 0, bandY, cw, bandH);
    cctx.restore();
  }

  // ---- floating shout / placement text ----
  function addFloat(x, y, text, color, big) {
    S.floats.push({ x, y, text, color: color || "#fff", life: 1, vy: -18, big: !!big });
  }
  function spawnDust(x, y, n, intensity) {
    for (let i = 0; i < n; i++) {
      S.particles.push({
        x: x - 8 - Math.random() * 6, y: y + 6 + Math.random() * 3,
        vx: -20 - Math.random() * 30 * intensity, vy: -8 - Math.random() * 14,
        life: 1, max: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3, kind: "dust"
      });
    }
  }
  function spawnSpark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      S.particles.push({
        x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 10,
        life: 1, max: 0.4 + Math.random() * 0.3, size: 1.5 + Math.random() * 2, kind: "spark", color
      });
    }
  }
  // celebration confetti — colourful ribbons fluttering down from the top (screen space)
  const CONFETTI_COLORS = ["#ff5a7a", "#ffd34d", "#5cc6ff", "#7df29a", "#c79bff", "#ffae5c", "#ffffff"];
  function spawnConfetti(n) {
    for (let i = 0; i < n; i++) {
      S.particles.push({
        scr: true, kind: "confetti",
        x: Math.random() * cw, y: -8 - Math.random() * 30,
        vx: (Math.random() * 2 - 1) * 36, vy: 50 + Math.random() * 70,
        rot: Math.random() * Math.PI, vr: (Math.random() * 2 - 1) * 8,
        life: 1, max: 1.6 + Math.random() * 1.2, size: 4 + Math.random() * 4,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
      });
    }
  }
  // firework burst at a screen point (radial sparks that fade)
  function spawnFirework(x, y, color) {
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, sp = 60 + Math.random() * 50;
      S.particles.push({
        scr: true, kind: "spark",
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, max: 0.7 + Math.random() * 0.5, size: 1.6 + Math.random() * 1.8,
        color: color || CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
      });
    }
  }
  function spawnLike(x, y, opts) {
    opts = opts || {};
    const gold = opts.gold || (rankHype > 0.55 && Math.random() < 0.4);
    const hue = gold ? "#ffd34d" : (Math.random() < 0.5 ? "#ff6a86" : "#ff9ab0");
    S.likes.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 22, vy: -(26 + Math.random() * 26),
      life: 1, max: 1.3 + Math.random() * 0.8, s: opts.big ? 11 : (6.5 + Math.random() * 4),
      hue: hue, sway: Math.random() * Math.PI * 2
    });
    S.likeCount++;
  }
  // tap anywhere on the canvas to send a "いいね" — a little burst of hearts (livestream vibe)
  canvas.addEventListener("click", function (ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    for (let i = 0; i < 6; i++) spawnLike(x + (Math.random() - 0.5) * 24, y - Math.random() * 10, { big: i === 0 });
  });

  // ---- camera (smoothed follow + dynamic zoom / vertical pan) ----
  function updateCamera() {
    const K = (timeline.leadPackSize || 3);
    let leaderP = 0, lastP = 1, leaderId = null;
    const ps = [];
    for (const dr of dragons) {
      const p = visProgress(dr.id);   // extends past 1 during the run-out so the camera follows through the wire
      ps.push(p);
      if (p > leaderP) { leaderP = p; leaderId = dr.id; }
      if (p < lastP) lastP = p;
    }
    // Progress of the current K-th place (the lead-pack tail). Late in the race
    // we slide the frame's lower bound up from lastP toward this, tightening the
    // camera onto the lead trio so trailing dragons drop off-frame — the field
    // visually thins to three. focusT ramps 0 (whole field) → 1 (trio only).
    ps.sort((a, b) => b - a);
    const packTailP = ps[Math.min(K, ps.length) - 1];
    // ramp early & aggressively so the field very visibly thins to the trio
    const focusT = clamp((leaderP - 0.25) / 0.5, 0, 1);
    const focusLowerP = lastP + (packTailP - lastP) * focusT;
    S._focusT = focusT;
    S._finishFade = clamp((leaderP - 0.82) / 0.18, 0, 1);   // last-18%: isolate the lead trio
    // Tighter window than before: a narrower slice of track on screen means the
    // ground (mapped through WINW) scrolls past noticeably faster → real speed,
    // and the field spreads out horizontally instead of clumping.
    const WINW = clamp((leaderP - focusLowerP) * 0.9 + 0.075, 0.135, 0.4);
    const targetL = leaderP - 0.66 * WINW;
    S.camL += (targetL - S.camL) * 0.12;
    S._winw = WINW;

    // push in near the finish and when the field bunches up; pull back when spread
    const finishProx = clamp((leaderP - 0.72) / 0.28, 0, 1);
    const bunch = clamp(1 - (leaderP - lastP) / 0.22, 0, 1);
    // Strong, ACCELERATING push-in for the finish so ゴール直前 is a real close-up,
    // held tight on the trio after the line. The curve (squared) only ramps hard in
    // the final stretch, so there are no mid-race "bumps" that read as a glitch.
    const fpEase = finishProx * finishProx;
    S.zoomT = S.finished ? 1.26 : (1 + 0.28 * fpEase + 0.03 * bunch);
    S.zoom += (S.zoomT - S.zoom) * 0.07;

    // gentle vertical pan toward the leader's lane → the camera "follows"
    const g = trackGeom();
    const centerY = (g.top + g.bottom) / 2;
    let leadLaneY = centerY;
    if (leaderId) { const dr = timeline.byId[leaderId]; if (dr) leadLaneY = laneY(dr, g); }
    S.camYT = clamp((centerY - leadLaneY) * 0.22, -ch * 0.05, ch * 0.05);
    S.camY += (S.camYT - S.camY) * 0.05;

    // bank the camera through turn sections — a subtle roll that reads as a corner
    const tiltTarget = rcTerrainInfo(themeKeyAtP(leaderP)).turn ? 0.02 : 0;
    S.tilt += (tiltTarget - S.tilt) * 0.04;

    return { leaderP, lastP, WINW, leaderId };
  }

  // ---- layout helpers ----
  function trackGeom() {
    // パララックス時＝飛行帯を絵の世界いっぱいに（コース帯は存在しない・モック準拠）。
    const top = ch * (paraBaked ? RC_TRACK_TOP_PARA : RC_TRACK_TOP_BASE);
    const bottom = ch * (paraBaked ? RC_TRACK_BOT_PARA : 0.965);
    return { top, bottom, laneH: (bottom - top) / 8 };
  }

  // ---- run-through ("pull-up") ----------------------------------------------
  // Real horses gallop THROUGH the wire and decelerate over the next stretch — they
  // don't stop on the line. After a dragon crosses, its visual progress keeps growing
  // past 1 (coasting, decelerating) from the moment IT crossed, so the field flows
  // through the line in finishing order. Presentation only: the official order is
  // already fixed by timeline.crossings and the result screen is authoritative.
  const RUNOUT_SMO     = 0.40;  // DEEPEST slow-mo, right at the wire; lifts to 1 over RUNOUT_RELEASE
  const RUNOUT_RELEASE = 0.40;  // coast-clock units over which slow-mo lifts back to NORMAL speed
                                // → slow-motion is only a brief beat AT the goal, then a normal run-through
  const RUNOUT_COAST   = 0.09;  // progress coasted past the wire (tuned so the normal-speed run-out ≈ gallop)
  const RUNOUT_TAU     = 4.6;   // gentle pull-up constant
  const RUNOUT_DUR     = 2.2;   // run-out + post-goal celebration window before the result
  function visProgress(id) {
    const c = S.crossClock[id];
    if (c != null) {
      const v = S.crossV[id] || 1;
      return 1 + v * RUNOUT_COAST * (1 - Math.exp(-c / RUNOUT_TAU));
    }
    return timeline.progressAt(id, S.tau);
  }
  // subtle depth: back lanes (top of screen) a touch smaller/dimmer than near
  // lanes (bottom), so the field reads with perspective without hurting rank legibility.
  // Subtle lane perspective only (was 0.93–1.10 ≈ 18%, which made identical dragons
  // look like different SIZES). Now ~5% so the field reads as one consistent size.
  function laneDepth(dr) { return 0.975 + (laneOf[dr.id] / 7) * 0.05; }
  function screenX(P, WINW) {
    const usableLeft = cw * 0.08, usableRight = cw * 0.94;
    const frac = (P - S.camL) / WINW;
    return usableLeft + frac * (usableRight - usableLeft);
  }
  // ★発走ライン（＝ワールド座標0）の画面x。STARTゲート・発走テープ・待機整列は
  //   すべてこの1つの式を使う。以前はテープと整列だけ cw*0.42 の決め打ちだったため、
  //   カメラ位置によってゲートと別の場所に立ち、黄色い線が2本見えていた。
  //   S._winw はカメラ更新時に保存されるカメラ幅（updateCamera 参照）。
  function startTapeX() {
    const WINW = S._winw || 0.135;
    return screenX(0, WINW);
  }
  // Near the goal, lanes (and the dragons in them) funnel toward the track centre
  // so the climactic battle gathers mid-frame and stays visible under the finish
  // zoom. `convAtP` is the funnel amount at a track fraction P; because a dragon's
  // screen-x corresponds to its own progress, applying convAtP with that progress
  // keeps the dragon sitting exactly ON its funneling lane. Cosmetic only —
  // horizontal progress (= finishing order) is never touched.
  function convAtP(P) {
    const c = clamp((P - 0.6) / 0.4, 0, 1);
    return c * c * 0.28;
  }
  // The course visibly CURVES through turn sections: the running ribbon shifts
  // vertically with progress. Big turns (大旋回 / 最終大旋回) draw ONE large gentle
  // arc; tight turns (小回り連続) draw several quick S-curves; straights stay flat.
  // The bend is 0 with zero slope at each third's boundary, so sections join
  // seamlessly. Cosmetic only — horizontal progress / finishing order is untouched.
  function trackBendY(P) {
    const pc = clamp(P, 0, 1);
    const t = thirdAtP(pc);
    const key = sectionKeyAtThird(t);
    let amp, waves;
    if (key === "grand_turn" || key === "final_grand_turn") { amp = 0.075; waves = 0; }   // big sweep (single arc)
    else if (key === "repeated_small_turns") { amp = 0.05; waves = 5; }                    // tight S-curves
    else return 0;
    const u = pc * 3 - t;                              // 0..1 within this third
    const win = (1 - Math.cos(u * Math.PI * 2)) / 2;   // smooth window: 0 at ends (flat), 1 mid, zero slope
    const shape = waves ? Math.sin(u * Math.PI * waves) * win : win;
    return -amp * ch * shape;                          // negative = ribbon arcs upward
  }
  function laneBaseY(idx, g) { return g.bottom - (idx + 0.5) * g.laneH; }
  function laneY(dr, g) {
    const baseY = laneBaseY(laneOf[dr.id], g);
    const centerY = g.top + (g.bottom - g.top) * 0.5;
    const P = timeline.progressAt(dr.id, S.tau);
    return baseY + (centerY - baseY) * convAtP(P) + trackBendY(P);
  }

  // ---- terrain helpers: which SECTION is at a given track fraction ----
  function thirdAtP(P) { return P < 1 / 3 ? 0 : P < 2 / 3 ? 1 : 2; }
  function sectionKeyAtThird(t) { return t === 0 ? race.early : t === 1 ? race.mid : race.late; }
  function phaseOfThird(t) { return t === 0 ? "early" : t === 1 ? "mid" : "late"; }
  function themeKeyAtP(P) { return rcThemeOf(sectionKeyAtThird(thirdAtP(clamp(P, 0, 1)))); }
  function sectionLabelAtP(P) {
    const t = thirdAtP(clamp(P, 0, 1));
    const sec = (typeof getSection === "function") ? getSection(phaseOfThird(t), sectionKeyAtThird(t)) : null;
    return sec ? sec.label : "";
  }
  // blended theme around the leader (soft cross-fade across section boundaries)
  function themeBlendAtP(P) {
    const x = clamp(P, 0, 1) * 3;
    const i = Math.min(2, Math.floor(x));
    const frac = x - i;
    let j = i, t = 0;
    if (frac > 0.82 && i < 2) { j = i + 1; t = (frac - 0.82) / 0.18; }
    else if (frac < 0.18 && i > 0) { j = i - 1; t = (0.18 - frac) / 0.18; }
    const keyA = rcThemeOf(sectionKeyAtThird(i));
    const keyB = rcThemeOf(sectionKeyAtThird(j));
    return { keyA, keyB, a: RC_THEME[keyA], b: RC_THEME[keyB], t: t * 0.5 };
  }

  function rcCloud(x, y, r) {
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.arc(x + r * 0.9, y + 3, r * 0.7, 0, Math.PI * 2);
    cctx.arc(x - r * 0.9, y + 4, r * 0.6, 0, Math.PI * 2);
    cctx.fill();
  }
  // distant silhouette that gives each terrain its identity (screen space, parallax)
  function drawThemeBackdrop(key, g, alpha) {
    if (alpha <= 0.02) return;
    const hz = g.top;
    const t = performance.now();
    cctx.save();
    cctx.globalAlpha = alpha;
    if (key === "fire") {
      // red sky-glow band along the horizon
      const glow = cctx.createLinearGradient(0, hz - 130, 0, hz + 6);
      glow.addColorStop(0, "rgba(255,70,20,0)"); glow.addColorStop(1, "rgba(255,90,30,0.34)");
      cctx.fillStyle = glow; cctx.fillRect(0, hz - 130, cw, 136);
      // big erupting volcano cone (parallax)
      const vx = cw * 0.64 - ((S.camL * 70) % (cw * 1.7));
      const peak = hz - 108, halfW = 138;
      cctx.fillStyle = "#241010";
      cctx.beginPath();
      cctx.moveTo(vx - halfW, hz); cctx.lineTo(vx - 22, peak + 6);
      cctx.lineTo(vx + 22, peak + 6); cctx.lineTo(vx + halfW, hz); cctx.closePath(); cctx.fill();
      cctx.fillStyle = "rgba(86,42,30,0.55)";   // sunlit flank
      cctx.beginPath();
      cctx.moveTo(vx + 6, peak + 6); cctx.lineTo(vx + 22, peak + 6);
      cctx.lineTo(vx + halfW, hz); cctx.lineTo(vx + halfW * 0.42, hz); cctx.closePath(); cctx.fill();
      // glowing crater + lava fountain
      const cg = cctx.createRadialGradient(vx, peak + 8, 2, vx, peak + 8, 30);
      cg.addColorStop(0, "rgba(255,240,150,0.95)"); cg.addColorStop(0.5, "rgba(255,140,40,0.8)"); cg.addColorStop(1, "rgba(255,80,20,0)");
      cctx.fillStyle = cg; cctx.beginPath(); cctx.ellipse(vx, peak + 8, 27, 17, 0, 0, Math.PI * 2); cctx.fill();
      for (let i = 0; i < 8; i++) {
        const ph = (t / 680 + i * 0.47) % 1;                      // 0..1 rising spatter
        const fx = vx + Math.sin(i * 2.1) * 18 * ph, fy = peak + 8 - ph * 50;
        cctx.fillStyle = "rgba(255," + (190 - ((ph * 130) | 0)) + ",60," + ((1 - ph) * 0.9) + ")";
        cctx.beginPath(); cctx.arc(fx, fy, 3.4 * (1 - ph * 0.4), 0, Math.PI * 2); cctx.fill();
      }
      // lava flows down both flanks
      cctx.strokeStyle = "rgba(255,110,40,0.85)"; cctx.lineWidth = 3;
      for (let s = -1; s <= 1; s += 2) {
        cctx.beginPath(); cctx.moveTo(vx + s * 7, peak + 16);
        cctx.quadraticCurveTo(vx + s * 54, hz - 42, vx + s * (halfW - 30), hz - 2); cctx.stroke();
      }
      // dark smoke plume
      for (let i = 0; i < 5; i++) {
        const ph = (t / 2600 + i * 0.2) % 1;
        const sx = vx + Math.sin(i * 1.7 + t / 1800) * 20 * ph, sy = peak + 4 - ph * 74;
        cctx.fillStyle = "rgba(60,52,52," + ((1 - ph) * 0.5) + ")";
        cctx.beginPath(); cctx.arc(sx, sy, 9 + ph * 24, 0, Math.PI * 2); cctx.fill();
      }
    } else if (key === "turn") {
      // a big banked corner sweeps across the horizon: grandstand + striped curb
      const cx = cw * 0.5, cy = hz - 210, R = 178, a0 = Math.PI * 0.17, a1 = Math.PI * 0.83;
      cctx.strokeStyle = "rgba(26,30,54,0.9)"; cctx.lineWidth = 26;          // grandstand band
      cctx.beginPath(); cctx.arc(cx, cy, R - 20, a0, a1); cctx.stroke();
      cctx.fillStyle = "rgba(132,142,182,0.5)";                              // crowd speckle
      for (let i = 0; i < 36; i++) {
        const a = a0 + (a1 - a0) * (i / 36), rr = R - 14 - (i % 3) * 7;
        cctx.beginPath(); cctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.5, 0, Math.PI * 2); cctx.fill();
      }
      const segs = 30;                                                       // red/white striped curb
      for (let i = 0; i < segs; i++) {
        const b0 = a0 + (a1 - a0) * (i / segs), b1 = a0 + (a1 - a0) * ((i + 1) / segs);
        cctx.strokeStyle = (i % 2 === 0) ? "#d64b4b" : "#eef0f2"; cctx.lineWidth = 9;
        cctx.beginPath(); cctx.arc(cx, cy, R, b0, b1); cctx.stroke();
      }
    } else if (key === "wind") {
      cctx.fillStyle = "rgba(196,214,238,0.5)";                              // layered cloud banks
      for (let i = 0; i < 5; i++) {
        const cx = (((i * 150 - S.camL * 240) % (cw + 260)) + cw + 260) % (cw + 260) - 130;
        rcCloud(cx, hz - 42 - (i % 2) * 20, 28 + (i % 2) * 10);
      }
      cctx.strokeStyle = "rgba(205,228,255,0.5)"; cctx.lineWidth = 2;        // raking wind streaks
      for (let i = 0; i < 7; i++) {
        const yy = hz - 98 + i * 13, off = (t / 6 + i * 80) % (cw + 200);
        cctx.beginPath(); cctx.moveTo(cw - off, yy); cctx.lineTo(cw - off + 72, yy - 6); cctx.stroke();
      }
    } else if (key === "mist") {
      for (let i = 0; i < 4; i++) {                                          // thick stacked fog banks
        const yy = hz - 64 + i * 18;
        const mg = cctx.createLinearGradient(0, yy, 0, yy + 30);
        mg.addColorStop(0, "rgba(206,220,232,0)"); mg.addColorStop(1, "rgba(206,220,232," + (0.22 + i * 0.06) + ")");
        cctx.fillStyle = mg;
        cctx.fillRect(-20 + Math.sin(t / 2600 + i) * 18, yy, cw + 40, 30);
      }
    } else if (key === "bridge") {
      cctx.fillStyle = "rgba(40,70,96,0.5)"; cctx.fillRect(0, hz, cw, 8);    // water below
      cctx.strokeStyle = "rgba(150,200,225,0.35)"; cctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const yy = hz + 2 + (i % 3), off = (t / 30 + i * 60) % (cw + 80);
        cctx.beginPath(); cctx.moveTo(off - 40, yy); cctx.lineTo(off, yy); cctx.stroke();
      }
      const bx = cw * 0.3 - ((S.camL * 110) % (cw * 1.3)), span = cw * 0.6, tH = 76;
      cctx.strokeStyle = "rgba(150,172,188,0.85)"; cctx.lineWidth = 5;       // towers
      [bx, bx + span].forEach(tx => { cctx.beginPath(); cctx.moveTo(tx, hz); cctx.lineTo(tx, hz - tH); cctx.stroke(); });
      cctx.lineWidth = 2.5;                                                   // draped main cable
      cctx.beginPath(); cctx.moveTo(bx, hz - tH); cctx.quadraticCurveTo(bx + span / 2, hz - 16, bx + span, hz - tH); cctx.stroke();
      cctx.lineWidth = 1;                                                     // vertical hangers
      for (let i = 1; i < 10; i++) {
        const hx = bx + span * (i / 10);
        const cyl = hz - 16 - (1 - Math.pow((i / 10 - 0.5) * 2, 2)) * (tH - 16);
        cctx.beginPath(); cctx.moveTo(hx, hz - 6); cctx.lineTo(hx, cyl); cctx.stroke();
      }
    } else if (key === "uphill") {
      cctx.fillStyle = "rgba(30,46,28,0.85)";                                // a big slope to a summit
      cctx.beginPath();
      cctx.moveTo(0, hz); cctx.lineTo(0, hz - 10); cctx.lineTo(cw * 0.72, hz - 84); cctx.lineTo(cw * 0.72, hz); cctx.closePath(); cctx.fill();
      cctx.strokeStyle = "#cfe6ff"; cctx.lineWidth = 2;                      // summit flagpole
      cctx.beginPath(); cctx.moveTo(cw * 0.72, hz - 84); cctx.lineTo(cw * 0.72, hz - 102); cctx.stroke();
      cctx.fillStyle = "#ffe06a";
      cctx.beginPath(); cctx.moveTo(cw * 0.72, hz - 102); cctx.lineTo(cw * 0.72 + 16, hz - 97); cctx.lineTo(cw * 0.72, hz - 92); cctx.closePath(); cctx.fill();
    } else if (key === "rolling") {
      const cols = ["rgba(28,44,26,0.7)", "rgba(34,52,30,0.8)"];            // layered rolling hills
      for (let L = 0; L < 2; L++) {
        cctx.fillStyle = cols[L];
        cctx.beginPath(); cctx.moveTo(0, hz);
        const amp = 16 + L * 12, ph = S.camL * (160 + L * 80);
        for (let x = 0; x <= cw; x += 30) cctx.lineTo(x, hz - 10 - L * 8 - amp * (0.5 + 0.5 * Math.sin((x + ph) / (70 + L * 20))));
        cctx.lineTo(cw, hz); cctx.closePath(); cctx.fill();
      }
    } else if (key === "narrow") {
      const wallH = ch * 0.20;                                               // tall canyon walls closing in
      [0, 1].forEach(side => {
        const baseX = side === 0 ? 0 : cw, inX = side === 0 ? cw * 0.17 : cw * 0.83;
        cctx.fillStyle = "rgba(34,28,20,0.92)";
        cctx.beginPath();
        cctx.moveTo(baseX, hz); cctx.lineTo(baseX, hz - wallH);
        cctx.lineTo(inX, hz - wallH * 0.5); cctx.lineTo(inX, hz); cctx.closePath(); cctx.fill();
        cctx.strokeStyle = "rgba(80,66,48,0.5)"; cctx.lineWidth = 1.5;       // rock striations
        for (let i = 1; i < 4; i++) {
          const yy = hz - wallH * (i / 4);
          cctx.beginPath(); cctx.moveTo(baseX, yy); cctx.lineTo(inX, yy - wallH * 0.12); cctx.stroke();
        }
      });
    }
    cctx.restore();
  }
  // surface treatment painted within the running band (world space)
  function drawGroundOverlay(key, g, WINW) {
    const t = performance.now();
    const band = g.bottom - g.top;
    if (key === "mist") {
      // heavy fog veil over the track + drifting wisps (kills contrast → reads as fog)
      cctx.fillStyle = "rgba(202,216,228,0.26)";
      cctx.fillRect(0, g.top, cw, band);
      cctx.fillStyle = "rgba(222,232,242,0.16)";
      for (let i = 0; i < 4; i++) {
        const y = g.top + (i + 0.5) * band / 4, x = ((t / 40 + i * 130) % (cw + 220)) - 110;
        cctx.beginPath(); cctx.ellipse(x, y, 82, 14, 0, 0, Math.PI * 2); cctx.fill();
      }
    } else if (key === "fire") {
      // glowing lava cracks crawling across the track, pulsing
      const pulse = 0.6 + 0.4 * Math.sin(t / 220);
      for (let i = 0; i < 4; i++) {
        const yy = g.top + (i + 0.5) * band / 4 + Math.sin(i) * 6, off = (S.camL * 300 + i * 47) % 120;
        cctx.lineWidth = 6; cctx.strokeStyle = "rgba(255,200,90," + (0.16 * pulse) + ")";   // hot glow (under)
        cctx.beginPath();
        for (let x = -off; x < cw + 30; x += 30) { const yj = yy + (((x + off) / 30 | 0) % 2 ? 4 : -4); (x === -off) ? cctx.moveTo(x, yj) : cctx.lineTo(x, yj); }
        cctx.stroke();
        cctx.lineWidth = 2.4; cctx.strokeStyle = "rgba(255," + (110 + (pulse * 60 | 0)) + ",40," + (0.55 * pulse) + ")";  // bright crack
        cctx.stroke();
      }
    } else if (key === "turn") {
      // red/white striped curb along the inner (top) edge of the running band
      const cw0 = 22, off = (S.camL * 600) % (cw0 * 2);
      for (let x = -off; x < cw; x += cw0) {
        cctx.fillStyle = ((x + off) / cw0 | 0) % 2 === 0 ? "rgba(214,75,75,0.9)" : "rgba(238,240,242,0.9)";
        cctx.fillRect(x, g.top, cw0, 7);
      }
      // big sweeping chevrons across the track, pointing through the bend
      cctx.strokeStyle = "rgba(255,224,106,0.7)"; cctx.lineWidth = 5;
      const cvW = 60, coff = (S.camL * 500) % cvW;
      for (let x = -coff; x < cw + cvW; x += cvW) {
        cctx.beginPath();
        cctx.moveTo(x, g.top + band * 0.30); cctx.lineTo(x + 26, g.top + band * 0.5); cctx.lineTo(x, g.top + band * 0.70);
        cctx.stroke();
      }
    } else if (key === "uphill") {
      // climbing shade (dark high / warm low) + upward chevrons → reads as a climb
      const sg = cctx.createLinearGradient(0, g.top, 0, g.bottom);
      sg.addColorStop(0, "rgba(0,0,0,0.18)"); sg.addColorStop(1, "rgba(255,240,200,0.05)");
      cctx.fillStyle = sg; cctx.fillRect(0, g.top, cw, band);
      cctx.strokeStyle = "rgba(192,232,172,0.55)"; cctx.lineWidth = 4;
      const cvW = 64, coff = (S.camL * 480) % cvW;
      for (let x = -coff; x < cw + cvW; x += cvW) {
        cctx.beginPath();
        cctx.moveTo(x, g.top + band * 0.62); cctx.lineTo(x + 22, g.top + band * 0.40); cctx.lineTo(x + 44, g.top + band * 0.62);
        cctx.stroke();
      }
    } else if (key === "bridge") {
      // side railings down both edges + plank seams
      cctx.strokeStyle = "rgba(160,182,198,0.7)"; cctx.lineWidth = 3;
      cctx.beginPath(); cctx.moveTo(0, g.top + 3); cctx.lineTo(cw, g.top + 3); cctx.stroke();
      cctx.beginPath(); cctx.moveTo(0, g.bottom - 3); cctx.lineTo(cw, g.bottom - 3); cctx.stroke();
      cctx.strokeStyle = "rgba(150,172,188,0.4)"; cctx.lineWidth = 2;
      const step = 0.03, startP = Math.floor(S.camL / step) * step;
      for (let P = startP; P < S.camL + WINW + step; P += step) {
        const x = screenX(P, WINW);
        cctx.beginPath(); cctx.moveTo(x, g.top); cctx.lineTo(x, g.bottom); cctx.stroke();
        cctx.fillStyle = "rgba(160,182,198,0.6)";
        cctx.fillRect(x - 1, g.top - 6, 2, 9); cctx.fillRect(x - 1, g.bottom - 3, 2, 9);
      }
    } else if (key === "narrow") {
      // jagged rock walls bite into the top & bottom of the runnable band
      const enc = band * 0.17;
      for (let edge = 0; edge < 2; edge++) {
        const yEdge = edge === 0 ? g.top : g.bottom, dir = edge === 0 ? 1 : -1;
        cctx.fillStyle = "rgba(36,30,22,0.86)";
        cctx.beginPath(); cctx.moveTo(0, yEdge);
        for (let x = 0; x <= cw; x += 26) {
          const j = enc * (0.5 + 0.5 * Math.sin((x + S.camL * 300) / 40 + edge * 2));
          cctx.lineTo(x, yEdge + dir * j);
        }
        cctx.lineTo(cw, yEdge); cctx.closePath(); cctx.fill();
      }
    } else if (key === "rolling") {
      // soft undulating shadow waves suggest rises and dips
      cctx.strokeStyle = "rgba(0,0,0,0.10)"; cctx.lineWidth = 10;
      for (let i = 0; i < 3; i++) {
        const ph = S.camL * 260 + i * 70, yb = g.top + band * (0.3 + i * 0.26);
        cctx.beginPath();
        for (let x = 0; x <= cw; x += 22) { const y = yb + Math.sin((x + ph) / 62) * 8; (x === 0) ? cctx.moveTo(x, y) : cctx.lineTo(x, y); }
        cctx.stroke();
      }
    }
  }
  // roadside props, placed by absolute track position so they scroll correctly
  function drawProp(key, x, g, j) {
    const topY = g.top, botY = g.bottom;
    if (key === "turn") {
      cctx.strokeStyle = "rgba(220,225,235,0.55)"; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, topY); cctx.lineTo(x, topY - 18); cctx.stroke();
      cctx.fillStyle = j > 0.5 ? "#d64b4b" : "#e8e8e8";
      cctx.fillRect(x, topY - 18, 10, 7);
    } else if (key === "fire") {
      if (j < 0.55) return;
      cctx.strokeStyle = "#5a4632"; cctx.lineWidth = 3;
      cctx.beginPath(); cctx.moveTo(x, topY); cctx.lineTo(x, topY - 15); cctx.stroke();
      const fy = topY - 21 + Math.sin(performance.now() / 120 + x) * 1.5;
      const fg = cctx.createRadialGradient(x, fy, 1, x, fy, 8);
      fg.addColorStop(0, "#fff1a8"); fg.addColorStop(0.5, "#ff9a40"); fg.addColorStop(1, "rgba(255,80,30,0)");
      cctx.fillStyle = fg; cctx.beginPath(); cctx.ellipse(x, fy, 5.5, 9, 0, 0, Math.PI * 2); cctx.fill();
    } else if (key === "narrow") {
      cctx.fillStyle = "rgba(40,34,26,0.9)";
      cctx.beginPath(); cctx.moveTo(x - 5, topY); cctx.lineTo(x - 1, topY - 20 - j * 8); cctx.lineTo(x + 4, topY); cctx.closePath(); cctx.fill();
    } else if (key === "wind") {
      if (j < 0.5) return;
      cctx.strokeStyle = "rgba(180,200,225,0.5)"; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, topY); cctx.lineTo(x, topY - 20); cctx.stroke();
      cctx.fillStyle = "rgba(150,200,255,0.6)";
      cctx.beginPath(); cctx.moveTo(x, topY - 20); cctx.lineTo(x + 14, topY - 17); cctx.lineTo(x, topY - 13); cctx.closePath(); cctx.fill();
    } else if (key === "rolling" || key === "uphill") {
      if (j < 0.5) return;
      cctx.fillStyle = "rgba(30,52,30,0.8)";
      cctx.beginPath(); cctx.arc(x, topY - 3, 5 + j * 4, Math.PI, 0); cctx.fill();
    } else if (key === "bridge") {
      cctx.strokeStyle = "rgba(150,170,185,0.5)"; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, botY); cctx.lineTo(x, botY - 12); cctx.stroke();
    }
  }
  function drawProps(g, WINW) {
    // denser spacing than before → more roadside objects whip past per second,
    // reinforcing the sense of speed now that the window is tighter.
    const step = 0.038, startP = Math.floor(S.camL / step) * step;
    for (let P = startP; P < S.camL + WINW + step; P += step) {
      if (P < 0 || P > 1) continue;
      const key = themeKeyAtP(P);
      const j = Math.abs(Math.sin(P * 99.7));
      const b = trackBendY(P);   // props ride the curved rail through turns
      drawProp(key, screenX(P, WINW), { top: g.top + b, bottom: g.bottom + b, laneH: g.laneH }, j);
    }
  }
  // ambient terrain particles (embers / gusts / leaves); mist is an overlay
  function spawnAmbient(key, g) {
    if (key === "fire") {
      S.particles.push({ amb: true, kind: "ember", x: Math.random() * cw, y: g.bottom - Math.random() * (g.bottom - g.top),
        vx: -10 - Math.random() * 18, vy: -24 - Math.random() * 24, life: 1, max: 0.8 + Math.random() * 0.6, size: 1.4 + Math.random() * 1.8 });
    } else if (key === "wind") {
      S.particles.push({ amb: true, kind: "gust", x: cw + 10, y: g.top + Math.random() * (g.bottom - g.top) * 0.65,
        vx: -160 - Math.random() * 120, vy: 0, life: 1, max: 0.5 + Math.random() * 0.3, size: 10 + Math.random() * 14 });
    } else if (key === "leaf") {
      S.particles.push({ amb: true, kind: "leaf", x: Math.random() * cw, y: g.top - 4,
        vx: -18 - Math.random() * 20, vy: 16 + Math.random() * 16, life: 1, max: 1.2, size: 2 + Math.random() * 2 });
    }
  }

  // =====================================================================
  // DRAW
  // =====================================================================
  // ---- live position minimap (compact strip: every dragon at a glance) ----
  function drawMinimap() {
    const mx0 = cw * 0.15, mx1 = cw * 0.85, my = ch * 0.05;
    const bx = mx0 - 16, bw = (mx1 - mx0) + 40, by = my - 9, bh = 18;
    cctx.save();
    // backing strip
    cctx.fillStyle = "rgba(10,14,28,0.50)";
    if (cctx.roundRect) { cctx.beginPath(); cctx.roundRect(bx, by, bw, bh, 9); cctx.fill(); }
    else cctx.fillRect(bx, by, bw, bh);
    cctx.strokeStyle = "rgba(255,255,255,0.12)"; cctx.lineWidth = 1;
    if (cctx.roundRect) { cctx.beginPath(); cctx.roundRect(bx, by, bw, bh, 9); cctx.stroke(); }
    else cctx.strokeRect(bx, by, bw, bh);
    // track baseline
    cctx.strokeStyle = "rgba(255,255,255,0.16)"; cctx.lineWidth = 2;
    cctx.beginPath(); cctx.moveTo(mx0, my); cctx.lineTo(mx1, my); cctx.stroke();
    // start tick
    cctx.fillStyle = "rgba(255,255,255,0.45)";
    cctx.fillRect(mx0 - 1, my - 4, 2, 8);
    // finish checker flag
    for (let r = 0; r < 3; r++) {
      cctx.fillStyle = (r % 2) ? "#1c2030" : "#f0f0f0"; cctx.fillRect(mx1 + 2, my - 4 + r * 3, 3, 3);
      cctx.fillStyle = (r % 2) ? "#f0f0f0" : "#1c2030"; cctx.fillRect(mx1 + 5, my - 4 + r * 3, 3, 3);
    }
    // leader (visProgress so the winner stays drawn on top through the run-out)
    let leaderP = -1, leaderId = null;
    for (const dr of dragons) { const p = visProgress(dr.id); if (p > leaderP) { leaderP = p; leaderId = dr.id; } }
    // draw the pack, with pick & leader last so they sit on top
    const order = [...dragons].sort((a, b) =>
      ((a.id === leaderId ? 2 : 0) + (betSet.has(a.id) ? 1 : 0)) -
      ((b.id === leaderId ? 2 : 0) + (betSet.has(b.id) ? 1 : 0)));
    for (const dr of order) {
      const p = clamp(timeline.progressAt(dr.id, S.tau), 0, 1);
      const x = mx0 + p * (mx1 - mx0);
      const isLead = dr.id === leaderId, isPick = betSet.has(dr.id);
      const r = isLead ? 4.5 : 3;
      if (isPick) { cctx.strokeStyle = "#ffd34d"; cctx.lineWidth = 2; cctx.beginPath(); cctx.arc(x, my, r + 3, 0, Math.PI * 2); cctx.stroke(); }
      cctx.fillStyle = dr.color || "#fff";
      cctx.beginPath(); cctx.arc(x, my, r, 0, Math.PI * 2); cctx.fill();
      if (isLead) { cctx.strokeStyle = "#fff"; cctx.lineWidth = 1.5; cctx.beginPath(); cctx.arc(x, my, r + 1.5, 0, Math.PI * 2); cctx.stroke(); }
    }
    cctx.restore();
  }

  function draw() {
    const cam = updateCamera();
    const WINW = cam.WINW;
    const leaderP = cam.leaderP;
    const g = trackGeom();
    // SREF = screen px a fixed ground point travels per unit camL. EVERY scrolling
    // cue (bunting, speed-streaks) is scaled off this so they move at the SAME real
    // rate as the track — no element flies past on a different plane (= natural).
    const SREF = (cw * 0.86) / WINW;

    // Screen-shake is deliberately neutralised: viewport jitter wrecks immersion.
    // Impact now reads from zoom push-in + slow-mo + telop + confetti, never from
    // shaking the camera. (S.shake still accrues harmlessly; it just isn't applied.)
    S.shakeX = 0;
    S.shakeY = 0;

    // blended terrain theme around the leader → tints the whole scene
    const tb = themeBlendAtP(leaderP);
    // Keep the generic grandstand skyline only for the plain straight; every other
    // terrain now shows its own dedicated backdrop so the course reads at a glance.
    const stadium = (tb.keyA === "straight");

    // --- sky: R8-W1 3層パララックス（夜系＆納品地域）→ 一枚絵ベース → プロシージャル ---
    const para = paraBaked;
    if (para) {
      // L1 遠景×0.15 → L2 中景×0.45 → L3 近景帯×0.9（レール旗0.9と同平面＝柵が近景の地面に立つ）。
      // タイルは焼き込みで完全ループ＝境界の継ぎ目なし。カメラが進むほど層の速度差で奥行きが出る。
      for (let li = 0; li < 3; li++) {
        if (S.lowSpec && li === 1) continue;                    // R8-W5: 低速機はL2を省き2層に縮退
        const ox = S.camL * SREF * para.rate[li];
        const dwl = para.dw[li], dhl = para.dh[li], dyl = para.dy[li], tile = para.L[li];
        for (let k = Math.floor(ox / dwl); k * dwl - ox < cw; k++) {
          cctx.drawImage(tile, k * dwl - ox, dyl, dwl, dhl);
        }
      }
      // 地平の靄：絵の地平線（L1の約58%）に薄く敷いて層同士を馴染ませる
      const hzY = ch * 0.58;
      const hb = cctx.createLinearGradient(0, hzY - 30, 0, hzY + 22);
      hb.addColorStop(0, rcRgba(para.haze, 0));
      hb.addColorStop(0.6, rcRgba(para.haze, 0.16));
      hb.addColorStop(1, rcRgba(para.haze, 0));
      cctx.fillStyle = hb; cctx.fillRect(0, hzY - 30, cw, 52);
    } else if (skyBase) {
      // far backdrop incl. sun/moon, clouds, distant ridges, 聖龍門 & grandstand, haze
      cctx.drawImage(skyBase, 0, 0, cw, ch);
    } else {
      const sky = cctx.createLinearGradient(0, 0, 0, ch);
      sky.addColorStop(0,    rcMix(tb.a.sky[0], tb.b.sky[0], tb.t));
      sky.addColorStop(0.55, rcMix(tb.a.sky[1], tb.b.sky[1], tb.t));
      sky.addColorStop(1,    rcMix(tb.a.sky[2], tb.b.sky[2], tb.t));
      cctx.fillStyle = sky;
      cctx.fillRect(0, 0, cw, ch);
      // moon
      cctx.fillStyle = "rgba(255,247,224,0.92)";
      cctx.beginPath(); cctx.arc(cw * 0.82, ch * 0.16, 22, 0, Math.PI * 2); cctx.fill();
      cctx.fillStyle = "rgba(255,247,224,0.10)";
      cctx.beginPath(); cctx.arc(cw * 0.82, ch * 0.16, 34, 0, Math.PI * 2); cctx.fill();
    }

    // distant terrain identity (volcano / clouds / hills / canyon / pylons)
    // （パララックス絵が地形の個性を担っている時はスキップ＝描き足しのつぎはぎ防止）
    if (!para) {
      drawThemeBackdrop(tb.keyA, g, 1);
      if (tb.keyB !== tb.keyA) drawThemeBackdrop(tb.keyB, g, tb.t);
    }

    // stadium dressing (skyline + clock tower + crowd) only on ground courses
    // (skipped when the painted base is active — it already has 聖龍門 + grandstand)
    if (stadium && !skyBase) {
      const skl = (S.camL * 210) % 60;
      cctx.fillStyle = "rgba(20,26,52,0.9)";
      for (let i = -1; i < cw / 60 + 1; i++) {
        const x = i * 60 - skl;
        const h = 18 + ((i * 37) % 5) * 6;
        cctx.fillRect(x, g.top - h - 6, 44, h);
      }
      cctx.fillStyle = "rgba(40,46,78,0.95)";
      const tx = cw * 0.62 - (S.camL * 110 % cw);
      cctx.fillRect(tx, g.top - 64, 26, 64);
      cctx.fillStyle = "rgba(255,240,200,0.85)";
      cctx.beginPath(); cctx.arc(tx + 13, g.top - 50, 7, 0, Math.PI * 2); cctx.fill();
      cctx.fillStyle = "#181d33";
      cctx.fillRect(0, g.top - 6, cw, 10);
      // 観客帯：2列・色とりどり・そわそわ揺れ。ゴールが近づくほど沸く（S._finishFadeで増幅）。
      const tNow = performance.now() / 1000;
      const surge = 0.8 + (S._finishFade || 0) * 2.4;
      const crowdScroll = (S.camL * 560) % 14;
      let ci = 0;
      for (let x = -crowdScroll; x < cw; x += 7, ci++) {
        const row = ci % 2, cy0 = g.top - 2 - row * 4;
        const jig = Math.sin(tNow * (2.2 + row) + x * 0.61) * surge - (row ? 0.6 : 0);
        cctx.fillStyle = ["#3a4474", "#5a4a86", "#6e4a5e", "#3e5a7b", "#4a6a52", "#7a5a40"][((ci * 7 + row * 3) % 6 + 6) % 6];
        cctx.beginPath(); cctx.arc(x, cy0 + jig, row ? 2.4 : 3, 0, Math.PI * 2); cctx.fill();
      }
      // ゴールの沸き：小さな腕が上がる（終盤のみ・表示専用）
      if ((S._finishFade || 0) > 0.5) {
        cctx.strokeStyle = "rgba(255,230,170,0.5)"; cctx.lineWidth = 1;
        for (let x = -crowdScroll + 3; x < cw; x += 21) {
          const a = Math.sin(tNow * 6 + x) * 2;
          cctx.beginPath(); cctx.moveTo(x, g.top - 5); cctx.lineTo(x + a, g.top - 10 - Math.abs(a)); cctx.stroke();
        }
      }
    }

    // back-rail bunting — a string of pennant flags whipping past just above the far
    // rail, on EVERY course. Scrolls with the camera (much faster than the distant
    // backdrop) so "the flags in back" clearly convey speed. Each flag's colour is
    // keyed to its world index (not the frame), so colours never flicker — seamless.
    // Stops naturally when the camera stops (start gate / after finish).
    // （パララックス野外では柵ごと出さない＝モックに無い競技場備品。聖龍スタジアムのみ残す）
    if (!para || para.slug === "stadium") {
      const pGap = 30, pScroll = S.camL * SREF * 0.9;   // ~ground rate (slight parallax) → moves WITH the scene
      const pcols = ["#ff6b8a", "#ffd34d", "#5ad1ff", "#9b8cff", "#7CFFB2"];
      const nC = pcols.length, first = Math.floor(pScroll / pGap), railY = g.top - 8;
      cctx.strokeStyle = "rgba(255,255,255,0.22)"; cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(0, railY); cctx.lineTo(cw, railY); cctx.stroke();
      cctx.globalAlpha = 0.85;
      for (let k = 0; k * pGap <= cw + pGap; k++) {
        const wi = first + k, x = wi * pGap - pScroll;
        cctx.fillStyle = pcols[((wi % nC) + nC) % nC];
        cctx.beginPath();
        cctx.moveTo(x, railY); cctx.lineTo(x + 11, railY); cctx.lineTo(x + 5.5, railY + 8); cctx.closePath();
        cctx.fill();
      }
      cctx.globalAlpha = 1;
      // 柵ポスト：旗と同レートで流れる白い支柱（地面と同平面の速度手掛かり）
      cctx.strokeStyle = "rgba(235,240,255,0.34)"; cctx.lineWidth = 2;
      for (let k = 0; k * 60 <= cw + 60; k++) {
        const wi2 = Math.floor(pScroll / 60) + k, x2 = wi2 * 60 - pScroll;
        cctx.beginPath(); cctx.moveTo(x2, railY); cctx.lineTo(x2, g.top + 2); cctx.stroke();
      }
    }

    // ============ WORLD GROUP (dynamic camera: zoom + pan + shake) ============
    const fx = clamp(screenX(leaderP, WINW), cw * 0.2, cw * 0.8);
    const fy = (g.top + g.bottom) / 2;
    cctx.save();
    cctx.translate(fx, fy); cctx.scale(S.zoom, S.zoom); cctx.rotate(S.tilt); cctx.translate(-fx, -fy);
    cctx.translate(S.shakeX, S.camY + S.shakeY);

    // --- track ground (themed turf) — the running ribbon CURVES through turns: its
    // top edge follows trackBendY(P). The fill runs from that curved top down to the
    // apron so there's never a gap when the ribbon arcs upward. ---
    // R8-W6c: パララックス時はコースの帯を一切描かない＝「絵の世界そのもの」が路面（モック
    // 準拠・ユーザー指定「モック通りコースを無くす」）。竜は絵の上を飛び、方向シェブロン等の
    // 記号だけを世界に重ねる。従来コース（朝昼・未納品地域）は !para 側で完全温存。
    if (!para) {
    const grd = cctx.createLinearGradient(0, g.top, 0, g.bottom);
    grd.addColorStop(0,   rcMix(tb.a.ground[0], tb.b.ground[0], tb.t));
    grd.addColorStop(0.5, rcMix(tb.a.ground[1], tb.b.ground[1], tb.t));
    grd.addColorStop(1,   rcMix(tb.a.ground[2], tb.b.ground[2], tb.t));
    const _turfPath = function () {
      cctx.beginPath();
      let first = true;
      for (let P = S.camL - 0.06; P <= S.camL + WINW + 0.06; P += (WINW + 0.12) / 48) {
        const px = screenX(P, WINW), py = g.top + trackBendY(P);
        if (first) { cctx.moveTo(px, py); first = false; } else cctx.lineTo(px, py);
      }
      cctx.lineTo(cw + 20, ch + 26); cctx.lineTo(-20, ch + 26); cctx.closePath();
    };
    _turfPath(); cctx.fillStyle = grd; cctx.fill();
    // groomed turf detail (two-tone mow bands + depth grade), clipped to the curved surface
    cctx.save(); _turfPath(); cctx.clip();
    for (let i = 0; i < 8; i++) {
      cctx.fillStyle = (i % 2 === 0) ? "rgba(255,255,255,0.030)" : "rgba(0,26,12,0.06)";
      cctx.fillRect(0, g.top + i * g.laneH, cw, g.laneH + 0.5);
    }
    // 路面フレック（小石/土）：世界座標に固定→カメラと一緒に流れる＝地面の速度感。
    // 世界indexの決定的ハッシュで配置（フレーム間でちらつかない）。
    {
      const stepP = 0.004, k0 = Math.floor((S.camL - 0.06) / stepP);
      const nK = Math.ceil((WINW + 0.12) / stepP);
      for (let k = 0; k <= nK; k++) {
        const wi = k0 + k, P = wi * stepP;
        const hx = (((wi * 2654435761) >>> 0) % 10000) / 10000;
        const px = screenX(P, WINW), py = g.top + 2 + hx * (g.bottom - g.top - 4) + trackBendY(P);
        cctx.fillStyle = hx > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,20,10,0.08)";
        cctx.fillRect(px, py, hx > 0.75 ? 2 : 1.3, 1.2);
      }
    }
    {
      const ts = cctx.createLinearGradient(0, g.top, 0, g.bottom);
      ts.addColorStop(0,   "rgba(0,0,0,0.16)");
      ts.addColorStop(0.4, "rgba(0,0,0,0)");
      ts.addColorStop(1,   "rgba(255,255,255,0.045)");
      cctx.fillStyle = ts; cctx.fillRect(0, g.top, cw, g.bottom - g.top);
    }
    cctx.restore();
    }   // ← !para（従来コースの帯描画ここまで。パララックス時は絵の世界が路面＝何も描かない）

    // 進行方向シェブロン（R8-W2・モック準拠）：路面に薄い「>」を世界固定で等間隔＝
    // 走る向きと速度感を常時示す（両モード共通・表示のみ）。
    {
      const stepP = 0.05, k0 = Math.floor((S.camL - 0.08) / stepP);
      const nK = Math.ceil((WINW + 0.16) / stepP);
      const midY = (g.top + g.bottom) / 2;
      const hh = (g.bottom - g.top) * 0.30, ww = hh * 0.55;
      cctx.save();
      cctx.lineWidth = 3; cctx.lineJoin = "round"; cctx.lineCap = "round";
      cctx.strokeStyle = para ? "rgba(255,214,120,0.15)" : "rgba(255,214,120,0.09)";   // 絵の上では少し立てる（モック準拠）
      for (let k = 0; k <= nK; k++) {
        const P = (k0 + k) * stepP;
        const px = screenX(P, WINW), py = midY + trackBendY(P);
        cctx.beginPath(); cctx.moveTo(px - ww, py - hh); cctx.lineTo(px, py); cctx.lineTo(px - ww, py + hh); cctx.stroke();
      }
      cctx.restore();
    }
    // theme surface treatment (fog veil / lava cracks / bridge planks)
    // （パララックス時はスキップ＝絵の路面に手続き模様を重ねない）
    if (!para) drawGroundOverlay(tb.keyA, g, WINW);

    // lane stripes（パララックス時は無し＝絵の世界にレーン白線は存在しない）
    cctx.strokeStyle = para ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.06)";
    cctx.lineWidth = 1;
    const _cy = g.top + (g.bottom - g.top) * 0.5;
    for (let i = 1; i < 8; i++) {
      const baseY = g.top + i * g.laneH;
      cctx.beginPath();
      let first = true;
      for (let P = S.camL - 0.04; P <= S.camL + WINW + 0.04; P += 0.02) {
        const ly = baseY + (_cy - baseY) * convAtP(P) + trackBendY(P);
        const lx = screenX(P, WINW);
        if (first) { cctx.moveTo(lx, ly); first = false; } else cctx.lineTo(lx, ly);
      }
      cctx.stroke();
    }
    // scrolling distance gridlines — subtle structure (the streaks carry the speed),
    // with a slightly brighter line each furlong (0.1) for a sense of measured ground.
    const firstTick = Math.ceil(S.camL / 0.025) * 0.025;
    for (let P = firstTick; P < S.camL + WINW + 0.05; P += 0.025) {
      const x = screenX(P, WINW), b = trackBendY(P);
      const furlong = Math.abs((P / 0.1) - Math.round(P / 0.1)) < 0.002;
      cctx.fillStyle = furlong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)";
      cctx.fillRect(x - (furlong ? 1 : 0.5), g.top + b, furlong ? 2 : 1, g.bottom - g.top);
    }
    // fast ground speed-streaks — screen-space motion blur scrolling well faster
    // than the world, so a long course really reads as a high-speed run. Drawn ONLY
    // while the field is actually running — not during the start countdown (dragons
    // frozen at the gate) nor after the finish (would freeze into a static grid).
    if (S.preT <= 0 && !S.finished) {
      // Two layers of horizontal motion-blur streaks at different speeds/lengths.
      // The near (lower) lanes get longer, brighter, faster streaks so the running
      // surface really tears past the screen — this is the dominant speed cue.
      for (let li = 0; li < 8; li++) {
        if (S.lowSpec && (li % 2)) continue;  // R8-W5: 低速機はストリーク半減
        const depth = li / 7;                 // 0 = far/top, 1 = near/bottom
        const sy = g.top + (li + 0.5) * g.laneH;
        const len = 40 + depth * 56;          // near streaks much longer
        const gap = 38 + depth * 16;          // denser → more streaks tear past
        const mul = 1.2 + depth * 0.55;       // near streaks blur a touch faster than the ground
        const h = depth > 0.6 ? 3 : 2;        // near streaks thicker
        // 絵の世界の上では白線はごく薄い風のスジに（ユーザー指摘「横線をもう少し薄く」）
        const a = ((para ? 0.045 : 0.14) + depth * (para ? 0.05 : 0.16)).toFixed(3);
        cctx.fillStyle = "rgba(255,255,255," + a + ")";
        // scroll keyed to the REAL ground rate (× small blur factor) so streaks read
        // as motion blur ON the track — not objects flying past on another plane.
        const off = (S.camL * SREF * mul + li * 23) % gap;
        for (let sx = -off; sx < cw; sx += gap) {
          cctx.fillRect(sx, sy - 1, len, h);
        }
      }
    }
    // --- running rails follow the curved ribbon: a crisp white far rail with a soft
    // shadow beneath it, and a subtle near rail (premium depth, bends through turns). ---
    const railLine = function (yBase, off) {
      cctx.beginPath();
      let first = true;
      for (let P = S.camL - 0.06; P <= S.camL + WINW + 0.06; P += (WINW + 0.12) / 44) {
        const px = screenX(P, WINW), py = yBase + trackBendY(P) + off;
        if (first) { cctx.moveTo(px, py); first = false; } else cctx.lineTo(px, py);
      }
      cctx.stroke();
    };
    // （パララックス野外ではレール/プロップとも描かない＝空中に柵や旗が浮く不自然を排除。
    //   道具立ては絵の中のもの＋接地したゲートだけ・ユーザー指摘）
    if (!para) {
      cctx.strokeStyle = "rgba(0,0,0,0.16)"; cctx.lineWidth = 3;    railLine(g.top, 3.5);     // shadow under the far rail
      cctx.strokeStyle = "rgba(244,248,255,0.72)"; cctx.lineWidth = 2.5; railLine(g.top, 1.5); // far rail (white)
      cctx.strokeStyle = "rgba(220,230,245,0.26)"; cctx.lineWidth = 1.5; railLine(g.bottom, -1); // near rail (subtle)
      // roadside props for the current terrain (torches, turn flags, rocks, …)
      drawProps(g, WINW);
    }

    // --- finish gate (when in view) ---
    // パララックス野外では「地面から立つ塔門」（浮かせない）。柱は円柱シェーディング＋
    // 頂きに発光オーブ＝HD-2Dのチープさ対策（ユーザー指摘「ポールが安っぽい」）。
    const drawPost3D = function (px, py0, py1, w2, base) {
      const pg2 = cctx.createLinearGradient(px, 0, px + w2, 0);
      pg2.addColorStop(0, rcShade(base, -34)); pg2.addColorStop(0.32, rcShade(base, 42));
      pg2.addColorStop(0.55, rcShade(base, 6)); pg2.addColorStop(1, rcShade(base, -48));
      cctx.fillStyle = pg2; cctx.fillRect(px, py0, w2, py1 - py0);
      cctx.fillStyle = rcRgba(rcShade(base, 60), 0.9);                      // 金の柱頭リング
      cctx.fillRect(px - 1, py0, w2 + 2, 2.5);
    };
    const drawOrb = function (px, py, r, col) {                             // 発光オーブ（ブルーム）
      const t2 = performance.now() / 1000, pl = 0.72 + 0.28 * Math.sin(t2 * 2.6 + px * 0.1);
      cctx.save(); cctx.globalCompositeOperation = "lighter";
      const og = cctx.createRadialGradient(px, py, 0, px, py, r * 3.6);
      og.addColorStop(0, rcRgba(col, 0.7 * pl)); og.addColorStop(0.4, rcRgba(col, 0.2 * pl)); og.addColorStop(1, rcRgba(col, 0));
      cctx.fillStyle = og; cctx.beginPath(); cctx.arc(px, py, r * 3.6, 0, Math.PI * 2); cctx.fill();
      cctx.restore();
      cctx.fillStyle = "#fff8e4"; cctx.beginPath(); cctx.arc(px, py, r, 0, Math.PI * 2); cctx.fill();
    };
    const goalX = screenX(1, WINW);
    const gateBot = para ? ch * 0.95 : g.bottom;
    if (goalX < cw + 40 && goalX > -40) {
      // 接地影（地面に立っている感）
      if (para) { cctx.fillStyle = "rgba(0,0,0,0.35)"; cctx.beginPath(); cctx.ellipse(goalX, gateBot + 2, 21.6, 3.4, 0, 0, Math.PI * 2); cctx.fill(); }
      // checkered band
      const bw = 9, rows = para ? 14 : 10, rh = (gateBot - g.top) / rows;
      for (let r = 0; r < rows; r++) {
        cctx.fillStyle = (r % 2 === 0) ? "#f4f4f4" : "#1c2030";
        cctx.fillRect(goalX - bw, g.top + r * rh, bw, rh);
        cctx.fillStyle = (r % 2 === 0) ? "#1c2030" : "#f4f4f4";
        cctx.fillRect(goalX, g.top + r * rh, bw, rh);
      }
      // posts（円柱シェーディング）＋ 発光オーブ ＋ グラデ幕＋金トリム
      drawPost3D(goalX - bw - 5, g.top - 22, gateBot, 5, "#c9b27a");
      drawPost3D(goalX + bw, g.top - 22, gateBot, 5, "#c9b27a");
      drawOrb(goalX - bw - 2.5, g.top - 25, 2.4, "#ffd34d");
      drawOrb(goalX + bw + 2.5, g.top - 25, 2.4, "#ffd34d");
      const bg2 = cctx.createLinearGradient(0, g.top - 22, 0, g.top - 6);
      bg2.addColorStop(0, "#d4544e"); bg2.addColorStop(1, "#8e2a28");
      cctx.fillStyle = bg2;
      cctx.fillRect(goalX - bw - 5, g.top - 22, bw * 2 + 10, 16);
      cctx.fillStyle = "#ffe9a8";
      cctx.fillRect(goalX - bw - 5, g.top - 22, bw * 2 + 10, 1.5);
      cctx.fillRect(goalX - bw - 5, g.top - 7.5, bw * 2 + 10, 1.5);
      cctx.fillStyle = "#fff";
      cctx.font = "bold 11px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillText("ゴール", goalX, g.top - 14);
      // finish tape (a bright line spanning the gate) until the leader breaks it
      if (!S.tapeBroken) {
        cctx.strokeStyle = "rgba(255,255,255,0.85)";
        cctx.lineWidth = 2;
        cctx.beginPath(); cctx.moveTo(goalX, g.top); cctx.lineTo(goalX, gateBot); cctx.stroke();
      }
      // 最終直線＝ゲートが呼ぶように輝く（接近で強く脈打つ・HD-2D発光）
      if (para && !S.finished) {
        const gk = clamp((leaderP - 0.84) / 0.14, 0, 1);
        if (gk > 0) {
          const t3 = performance.now() / 1000, pl3 = 0.7 + 0.3 * Math.sin(t3 * 3.2);
          cctx.save(); cctx.globalCompositeOperation = "lighter"; cctx.globalAlpha = gk * 0.45 * pl3;
          const gg2 = cctx.createRadialGradient(goalX, (g.top + gateBot) / 2, 6, goalX, (g.top + gateBot) / 2, 95);
          gg2.addColorStop(0, "rgba(255,226,140,0.55)"); gg2.addColorStop(1, "rgba(255,226,140,0)");
          cctx.fillStyle = gg2; cctx.fillRect(goalX - 100, g.top - 30, 200, gateBot - g.top + 60);
          cctx.restore();
        }
      }
    }

    // --- start gate (gantry at the start line) — grows grander with rank; recedes as the field pulls away ---
    const startGX = screenX(0, WINW);
    if (startGX > -90 && startGX < cw + 40 && (S.entryT > 0 || S.preT > 0 || S.tau < 0.06)) {
      const rh = rankHype, gt = g.top, gb = para ? ch * 0.95 : g.bottom;   // 野外は地面まで＝接地した門
      const archH = 22 + rh * 30, postW = 4 + rh * 2, bw = 7;
      const postCol = rh > 0.66 ? "#e8c860" : rh > 0.33 ? "#c9b27a" : "#8a8f9e";
      const bannerCol = rh > 0.66 ? "#cf9a1e" : rh > 0.33 ? "#a85f33" : "#3a4a6a";
      const bannerH = 15 + rh * 6, spanL = startGX - bw - postW, spanW = (bw + postW) * 2;
      if (rh > 0.5) {                                                   // soft golden glow at the top grades
        cctx.save(); cctx.globalAlpha = 0.16 + 0.14 * rh;
        const gg = cctx.createRadialGradient(startGX, gt - archH + 6, 4, startGX, gt - archH + 6, 70 + rh * 40);
        gg.addColorStop(0, "rgba(255,224,120,0.7)"); gg.addColorStop(1, "rgba(255,224,120,0)");
        cctx.fillStyle = gg; cctx.fillRect(startGX - 130, gt - archH - 36, 260, 140); cctx.restore();
      }
      const rows = 12, rhh = (gb - gt) / rows;                          // start band
      for (let r = 0; r < rows; r++) { cctx.fillStyle = (r % 2 === 0) ? "rgba(235,240,255,0.45)" : "rgba(40,46,70,0.45)"; cctx.fillRect(startGX - bw, gt + r * rhh, bw * 2, rhh); }
      // 接地影＋円柱シェーディング柱＋頂きの発光オーブ（HD-2D・チープさ対策）
      if (para) { cctx.fillStyle = "rgba(0,0,0,0.32)"; cctx.beginPath(); cctx.ellipse(startGX, gb + 2, spanW * 0.72, 3.2, 0, 0, Math.PI * 2); cctx.fill(); }
      drawPost3D(spanL, gt - archH, gb, postW, postCol);
      drawPost3D(startGX + bw, gt - archH, gb, postW, postCol);
      drawOrb(spanL + postW / 2, gt - archH - 3, 2.2, rh > 0.5 ? "#ffd34d" : "#9fc4ff");
      drawOrb(startGX + bw + postW / 2, gt - archH - 3, 2.2, rh > 0.5 ? "#ffd34d" : "#9fc4ff");
      const sb2 = cctx.createLinearGradient(0, gt - archH, 0, gt - archH + bannerH);
      sb2.addColorStop(0, rcShade(bannerCol, 26)); sb2.addColorStop(1, rcShade(bannerCol, -26));
      cctx.fillStyle = sb2; cctx.fillRect(spanL, gt - archH, spanW, bannerH);
      if (rh > 0.33) { cctx.fillStyle = "#ffe9a8"; cctx.fillRect(spanL, gt - archH, spanW, 2); cctx.fillRect(spanL, gt - archH + bannerH - 2, spanW, 2); }
      cctx.fillStyle = "#fff"; cctx.font = "bold " + (9 + rh * 3).toFixed(0) + "px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle"; cctx.fillText("START", startGX, gt - archH + bannerH / 2);
      const flags = Math.round(2 + rh * 6), fy = gt - archH - 1, fdiv = (flags - 1) || 1;   // pennant bunting
      for (let i = 0; i < flags; i++) {
        const fx = spanL - 4 + ((spanW + 8) / fdiv) * i;
        cctx.fillStyle = (typeof CONFETTI_COLORS !== "undefined") ? CONFETTI_COLORS[i % CONFETTI_COLORS.length] : "#ffcf6a";
        cctx.beginPath(); cctx.moveTo(fx - 3, fy); cctx.lineTo(fx + 3, fy); cctx.lineTo(fx, fy + 6); cctx.closePath(); cctx.fill();
      }
      if (rh > 0.6) {                                                   // marquee lights along the banner
        for (let i = 0; i < 6; i++) {
          const lx = spanL + (spanW / 5) * i, lb = 0.5 + 0.5 * Math.sin(performance.now() / 200 + i);
          cctx.fillStyle = `rgba(255,236,150,${(0.45 + 0.45 * lb).toFixed(3)})`;
          cctx.beginPath(); cctx.arc(lx, gt - archH + bannerH + 3, 2.2, 0, Math.PI * 2); cctx.fill();
        }
      }
    }

    // ★A-1 斜め発走テープ（RACE_START_FAIR_ALIVE）：整列が斜めでも「全頭の鼻先が同じテープに
    //   触れている」ことで公平さを示す。斜めなのは“遠近”だと目に納得させるため、奥（上）の柱は
    //   細く淡く描く。x式は待機整列と同一（cw*0.34 − ln*7）＝厳密に一致させること。
    //   GOでテープが弾けて光の粒になる（S.tapeFx）。表示のみ・着順不変。
    if (para && S.tapeAlpha > 0.01) {
      // 全頭の鼻先が触れる「発走テープ」＝1本の垂直線。同一xに並ぶので公平さが目に見える。
      // ★BUGFIX（座標系の取り違え）：以前は cw*0.42 という「画面幅の割合」で置いていたため、
      //   ワールド座標に立つ本物のSTARTゲート（screenX(0,WINW)）とカメラ位置によってズレ、
      //   黄色いテープとSTARTポールが別々の場所に2本立って見えていた（実機スクショで判明）。
      //   ゲートと同じ式で位置を出す＝カメラがどこにあっても必ず重なる。
      const tx = startTapeX();
      const tyT = ch * 0.30, tyB2 = ch * 0.92;                           // 飛行帯の上端〜地面
      const sway = Math.sin(performance.now() / 1000 * 1.3) * 1.2;
      cctx.save();
      cctx.globalAlpha = S.tapeAlpha;
      drawPost3D(tx - 2, tyT - 8, tyB2 + 4, 3.6, "#c9b27a");             // 支柱（地面まで）
      // テープ2本＝金の光（微かに揺れる）
      for (let t = 0; t < 2; t++) {
        const ox = t * 5;
        cctx.strokeStyle = t === 0 ? "rgba(255,224,138,0.95)" : "rgba(255,190,90,0.5)";
        cctx.lineWidth = t === 0 ? 2.2 : 1.3;
        cctx.beginPath();
        cctx.moveTo(tx + ox, tyT);
        cctx.quadraticCurveTo(tx + ox + sway, (tyT + tyB2) / 2, tx + ox, tyB2);
        cctx.stroke();
      }
      // 小旗＝お祭り感（テープに沿って等間隔）
      for (let i = 0; i < 6; i++) {
        const fy = tyT + ((tyB2 - tyT) / 5) * i, fx = tx + sway * (i % 2 ? 0.6 : 0.3);
        cctx.fillStyle = (typeof CONFETTI_COLORS !== "undefined") ? CONFETTI_COLORS[i % CONFETTI_COLORS.length] : "#ffcf6a";
        cctx.beginPath(); cctx.moveTo(fx, fy - 2.6); cctx.lineTo(fx, fy + 2.6); cctx.lineTo(fx + 6, fy); cctx.closePath(); cctx.fill();
      }
      cctx.restore();
    }

    // --- leader golden speed trail (world space, behind the field) ---
    if (cam.leaderId && !S.finished && S.preT <= 0) {
      const lp = timeline.progressAt(cam.leaderId, S.tau);
      const lv = timeline.speedAt(cam.leaderId, S.tau);
      if (lv > 0.9 && lp < 1) {
        const ldr = timeline.byId[cam.leaderId];
        const ly = laneY(ldr, g);
        const lx = clamp(screenX(lp, WINW), cw * 0.05, cw * 0.97);
        const len = 36 + (lv - 0.9) * 95;
        const tg = cctx.createLinearGradient(lx - len, ly, lx, ly);
        tg.addColorStop(0, "rgba(255,224,106,0)");
        tg.addColorStop(1, "rgba(255,224,106,0.45)");
        cctx.fillStyle = tg;
        cctx.beginPath();
        cctx.moveTo(lx, ly - 7); cctx.lineTo(lx - len, ly - 2);
        cctx.lineTo(lx - len, ly + 2); cctx.lineTo(lx, ly + 7);
        cctx.closePath(); cctx.fill();
      }
    }

    // --- world-space particles (foot-dust + ambient embers/gusts/leaves) drawn
    // BEFORE the dragons, so kicked-up dust sits behind the field and never paints
    // over a rival in front. (Confetti/fireworks are screen-space, drawn after.) ---
    for (const p of S.particles) {
      if (p.scr) continue;
      const a = clamp(p.life, 0, 1);
      if (p.acc) { _rcDrawAccent(cctx, p, a); continue; }
      if (p.kind === "dust") {
        cctx.fillStyle = `rgba(184,174,154,${0.42 * a})`;
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size * (1 + (1 - a)), 0, Math.PI * 2); cctx.fill();
      } else if (p.kind === "ember") {
        cctx.fillStyle = `rgba(255,${150 + Math.floor(80 * a)},80,${0.85 * a})`;
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); cctx.fill();
      } else if (p.kind === "gust") {
        cctx.strokeStyle = `rgba(205,226,255,${0.22 * a})`; cctx.lineWidth = 2;
        cctx.beginPath(); cctx.moveTo(p.x, p.y); cctx.lineTo(p.x + p.size, p.y); cctx.stroke();
      } else if (p.kind === "leaf") {
        cctx.fillStyle = `rgba(120,170,90,${0.7 * a})`;
        cctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
      } else {
        cctx.fillStyle = p.color ? rcRgba(p.color, a) : `rgba(255,230,150,${a})`;
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); cctx.fill();
      }
    }

    // --- dragons (draw far lanes first for overlap) ---
    const standings = timeline.standingsAt(S.tau);
    const standMap = {}; standings.forEach((id, i) => { standMap[id] = i + 1; });

    // ★世界内イベントポップ（R8-W2・表示のみ）＝順位変動/スパートをその竜の頭上で祝う
    //   （モックの「かわした！」）。レース中のみ・竜ごとクールダウンで騒がしさを抑制。
    S.pops = S.pops || []; S.popCd = S.popCd || {};
    const _popNow = performance.now() / 1000;
    const _popsOn = S.entryT <= 0 && S.preT <= 0 && !S.finished && S.tau > 0.03;
    // R8-W3 観客の反応SE（表示/音のみ）：先頭交代で歓声（7sクールダウン）・最終直線入りで一度どよめく
    if (_popsOn && window.Sfx) {
      const _lead = standings[0];
      if (S._lastLead && _lead !== S._lastLead && _popNow > (S._leadCheerCd || 0)) {
        try { Sfx.play("cheer", 0.96 + Math.random() * 0.08); } catch (e) {}
        S._leadCheerCd = _popNow + 7;
      }
      S._lastLead = _lead;
      if (!S._fsCheered) {
        const _lp = timeline.progressAt(_lead, S.tau);
        if (_lp > 0.82) { S._fsCheered = true; try { Sfx.play("cheer", 1.05); } catch (e) {} }
      }
    }

    const drawList = [...dragons].sort((a, b) => laneOf[b.id] - laneOf[a.id]);
    for (const dr of drawList) {
      const P = timeline.progressAt(dr.id, S.tau);
      const Pvis = visProgress(dr.id);          // extends past 1 during the run-out
      const v = timeline.speedAt(dr.id, S.tau);
      const intensity = clamp((v - 0.85) / 0.55, 0, 1.4);   // FULL effort kept through the run-out (it's slow-mo, not tired)
      const ownU = Math.min(1, S.tau / dr.finishTau);

      let x = screenX(Pvis, WINW);
      let baseY = laneY(dr, g);
      // R8-W6d: 野外（パララックス）では全員「地面」からスタート——入場/カウントダウン中は
      // 画面下端の大地に整列し、GOの瞬間に竜ごとの遅れでぎゅーんと各飛行高度へ舞い上がって
      // ばらける（easeOutBack＝勢い＋ちょい行き過ぎ→すっと収まる）。表示のみ・進行/着順不変。
      if (para) {
        const ln = laneOf[dr.id] || 0;
        // ★2026-07-18改（ユーザー決定）：「最初から浮いていても許容・整列を優先」。
        //   待機中＝スタートラインに沿った斜め縦一列（x=34%cw から奥レーンほど僅かに左、
        //   y=最初から各飛行高度=laneY）＝ゲートの横並びがきれいに揃い全員の体が見える。
        //   GO(eb)でその場から本来のレース座標へ加速して散る。地上グリッド・離陸演出は撤去。
        //   表示のみ＝着順/オッズ/配当は不変。
        const dl = ln * 0.055 + ((((ln + 3) * 2654435761) >>> 0) % 100) / 100 * 0.16;
        const k = clamp((S.flyIn - dl) / 1.05, 0, 1);
        const c1 = 1.25, c3 = c1 + 1;
        const eb = k <= 0 ? 0 : 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
        // ★A-1改：全頭の鼻先を「同一x」に揃える真の縦一列＝スタートの公平さが幾何学的に自明。
        //   高さ(laneY)が竜ごとに違うので縦に積まれ、体は重ならず全員読める。
        //   ★整列するxは発走ラインそのもの（startTapeX）＝テープ・STARTゲートと必ず一致する。
        //     以前は cw*0.42 の決め打ちで、ワールド座標に立つゲートとカメラ次第でズレていた。
        const gx = startTapeX();
        x = gx + (x - gx) * eb;
        // 待機中のホバリング（ふわり上下）＝浮いたまま生きている感。GOで消える
        if (eb < 1) baseY += Math.sin(performance.now() / 1000 * 1.6 + ln) * 3 * (1 - eb);
        // 待機中だけ、たまに感情エモート（眠雲竜💤・泣き虫💧・火竜🔥・他♪✨＝愛らしさ）
        if (eb <= 0 && (S.entryT > 0 || S.preT > 0)) {
          const nw2 = performance.now() / 1000;
          if (nw2 > (S.popCd[dr.id] || 0)) {
            S.popCd[dr.id] = nw2 + 2.3 + ((ln * 37) % 10) / 6;
            if (Math.random() < 0.5) {
              const em = dr.id === "momu" ? "💤" : dr.id === "poro" ? "💧"
                : ({ susu: 1, hibana: 1, benio: 1, shaku: 1, guren: 1, enma: 1, gouka: 1, phenix: 1 }[dr.id] ? "🔥" : (ln % 2 ? "♪" : "✨"));
              S.pops.push({ x: x - 8, y: baseY - 40, tx: em, c: "#ffffff", t0: nw2, sz: 13 });
            }
          }
        }
      }
      const bob = Math.sin(S.gait[dr.id]) * (1.6 + intensity);
      const y = baseY + bob;
      // 順位変動の検知→ポップ生成（standingsはタイムライン由来＝表示のみ・数値非干渉）
      if (_popsOn && S.prevStand && x > cw * 0.06 && x < cw * 0.94) {
        const rkNow = standMap[dr.id], pv = S.prevStand[dr.id];
        const cd = S.popCd[dr.id] || 0;
        // ポップも体の中心へ（鼻先アンカーのぶん左へ寄せる）
        const _phw = rcHasDragonSprite(dr.id) ? rcDragonSpriteHalfW(dr.id, _RC_INRACE * laneDepth(dr)) : 0;
        const px2 = x - _phw;
        if (pv && rkNow < pv && _popNow > cd) {
          S.pops.push({ x: px2, y: y - 46 * laneDepth(dr), tx: "かわした！", c: "#8fe3ff", t0: _popNow });
          S.pops.push({ x: px2 + 16, y: y - 60 * laneDepth(dr), tx: "✨", c: "#fff", t0: _popNow + 0.08, sz: 13 });   // 得意げの煌めき
          S.popCd[dr.id] = _popNow + 3.2;
          if (betSet.has(dr.id) && window.Sfx) { try { Sfx.play("tick", 1.2); } catch (e) {} }   // 自分の竜のUPだけ小さく鳴る
        } else if (pv && rkNow - pv >= 2 && _popNow > cd) {
          S.pops.push({ x: px2, y: y - 46 * laneDepth(dr), tx: "！", c: "#ff6a5e", t0: _popNow });
          S.pops.push({ x: px2 + 14, y: y - 58 * laneDepth(dr), tx: "💦", c: "#fff", t0: _popNow + 0.08, sz: 13 });   // 抜かれた焦り
          S.popCd[dr.id] = _popNow + 3.2;
        } else if (intensity > 0.95 && ownU < 0.92 && _popNow > cd && Math.random() < 0.010) {
          S.pops.push({ x: px2, y: y - 46 * laneDepth(dr), tx: "仕掛けた！", c: "#ffd34d", t0: _popNow });
          S.pops.push({ x: px2 + 16, y: y - 60 * laneDepth(dr), tx: "🔥", c: "#fff", t0: _popNow + 0.08, sz: 13 });   // 闘志
          S.popCd[dr.id] = _popNow + 5.0;
        }
      }

      const offLeft = x < cw * 0.04;
      const drawX = clamp(x, cw * 0.05, cw * 0.97);

      // Backmarkers that fall behind the lead-pack focus dissolve off the left
      // edge — reinforces the "field thins to three" read. Tied to focusT so the
      // whole field stays solid early; only late does the dropped tail fade out.
      const _ef = clamp((x + cw * 0.02) / (cw * 0.26), 0, 1);
      let edgeFade = 1 - (1 - _ef) * (S._focusT || 0);
      // At the finish, dim everything OUTSIDE the lead trio so the centre battle
      // reads cleanly even when the field bunches up (rank-based, ramps with focusT).
      const _K = timeline.leadPackSize || 3;
      if ((standMap[dr.id] || 9) > _K) edgeFade *= (1 - 0.92 * (S._finishFade || 0));
      // the player must ALWAYS be able to watch their own pick — never fade it out,
      // even when it trails the lead trio (it just sits at the edge of frame).
      if (betSet.has(dr.id)) edgeFade = Math.max(edgeFade, 0.88);
      if (edgeFade <= 0.04) continue;             // fully behind → off-screen, skip
      const _prevAlpha = cctx.globalAlpha;
      cctx.globalAlpha = edgeFade;

      // states
      const tired = dr.collapse && ownU > 0.62;
      const slow = intensity < 0.2;
      const down = tired || slow;
      // stumble window
      let tumble = 0, stumbling = false;
      if (dr.stumbleU > 0 && Math.abs(ownU - dr.stumbleU) < 0.04 && P < 1) {
        stumbling = true;
        const k = 1 - Math.abs(ownU - dr.stumbleU) / 0.04;
        tumble = Math.sin(performance.now() / 40) * 0.35 * k;
      }
      // surge window
      let glow = 0, surging = false;
      for (const ev of dr.events) {
        if (ev.type === "surge" && Math.abs(ownU - ev.u) < 0.06 && P < 1) {
          surging = true; glow = Math.max(glow, 1 - Math.abs(ownU - ev.u) / 0.06);
        }
      }
      const effort = (intensity > 0.95) || surging || (P > 0.9 && P < 1);
      const finishedNow = P >= 1;

      // speed lines behind — longer & denser the faster it runs (sense of pace)
      if (intensity > 0.3 && !down) {
        cctx.strokeStyle = rcRgba(dr.color, 0.2 + 0.16 * intensity);
        cctx.lineWidth = 1.5;
        for (let l = 0; l < 5; l++) {
          const ly = y - 9 + l * 4.5;
          cctx.beginPath();
          cctx.moveTo(drawX - 14 - l * 3, ly);
          cctx.lineTo(drawX - 30 - intensity * 34 - l * 7, ly);
          cctx.stroke();
        }
      }

      // dust at feet (scale with speed) — kicked up harder the faster it runs
      if (!down && intensity > 0.3 && Math.random() < (S.crossClock[dr.id] != null ? 0.2 : 0.6)) spawnDust(drawX, baseY + 14, intensity > 0.8 ? 2 : 1, intensity);
      if (surging && Math.random() < 0.5) spawnSpark(drawX, y - 4, dr.color);

      // gait advance handled in update(); draw sprite (depth-scaled). Sized so
      // the whole field reads cleanly at the start without crowding/overlap.
      const dep = laneDepth(dr);
      // ★A-2：ロールコール中の1頭だけ、ふわりと大きく（1.22倍）＝主役の合図。ease-outで戻る。
      const _rollOn = (S.roll >= 0 && _rollOrder[S.roll] && _rollOrder[S.roll].id === dr.id);
      const sprScale = _RC_INRACE * dep * (_rollOn ? 1.22 : 1);
      // per-dragon behavior (entrance walk-in / pre-start fidget / racing / post-goal)
      const beh = (S.entryT > 0) ? entranceBehaviorOf(dr)
                : (S.preT > 0) ? prestartBehaviorOf(dr)
                : (P < 1) ? behaviorOf(dr, P, ownU, intensity, tired, surging)
                : postgoalBehaviorOf(dr, standMap[dr.id] || 9);
      const jumpY = beh.jump * 26 * dep;            // airborne lift
      const spriteY = y - jumpY;
      const dcx = drawX + (beh.dx || 0);            // horizontal offset (entrance walk-in)
      // 体の中心アンカー（鼻先アンカーのスプライトは dcx の左へ伸びる）＝ラベル/マーカー共通
      const _hw2 = rcHasDragonSprite(dr.id) ? rcDragonSpriteHalfW(dr.id, sprScale) : 0;
      const bodyCx = dcx - _hw2;
      const grounded = 1 - 0.5 * beh.jump;          // shadow shrinks as it leaves the turf
      // soft contact shadow grounds the dragon on the turf (stays put during a jump)
      cctx.fillStyle = `rgba(0,0,0,${0.18 * grounded})`;
      cctx.beginPath();
      cctx.ellipse(dcx, baseY + 8 * dep, 8 * dep * grounded, 2.2 * dep * grounded, 0, 0, Math.PI * 2);
      cctx.fill();
      // pick spotlight — a soft, pulsing halo so the eye always tracks your dragon
      if (betSet.has(dr.id) && !finishedNow) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
        const rg = cctx.createRadialGradient(dcx, spriteY - 4, 3, dcx, spriteY - 4, 25 * dep);
        rg.addColorStop(0, `rgba(255,211,77,${0.2 + 0.13 * pulse})`);
        rg.addColorStop(1, "rgba(255,211,77,0)");
        cctx.fillStyle = rg;
        cctx.beginPath(); cctx.arc(dcx, spriteY - 4, 25 * dep, 0, Math.PI * 2); cctx.fill();
      }
      // terrain shapes body language: bank into turns, spread wings on wind lanes
      const tkey = themeKeyAtP(P);
      const bank = tkey === "turn" ? clamp(0.42 + intensity * 0.45, 0, 1.05) : 0;
      const spread = tkey === "wind" ? clamp(0.45 + intensity * 0.4, 0, 1) : 0;
      // facial expression — reflects state, course fitness, AND personality (真剣/焦り/余裕…)
      // ※ rcDrawDragon の前に確定させ、リグの目パーツへ mood を渡して変形させる。
      const _fit = dragonFitnessAtP(dr.id, P);
      const _pd = persoOf(dr.id);
      const _nerve = (_pd.stats && _pd.stats.nerve) || 60;
      const _place = standMap[dr.id] || 9;
      let _mood = "neutral";
      if (P >= 1) _mood = _place <= 3 ? "joy" : "tired";                    // post-line: winners beam, others blow
      else if (beh.mood) _mood = beh.mood;                                  // behavior-driven (entrance / spin / tired / surge-joy)
      else if (stumbling) _mood = "surprised";
      else if (_fit < 0 && intensity < 0.55) _mood = "confused";           // labouring on a weak section
      else if (_place >= dragons.length - 1 && intensity < 0.82 && S.tau > 0.45) _mood = "panic";  // tailed off & flustered late
      else if (surging || (_fit > 0 && intensity > 0.72)) _mood = "joy";   // suited / breaking clear
      else if (_place === 1 && intensity < 0.8 && _nerve < 70) _mood = "relaxed";   // cruising in front, a touch careless
      else if (dr.id === cam.leaderId && intensity > 0.55) _mood = "serious";       // leading & locked in
      else if (intensity > 0.92) _mood = "effort";
      else if (intensity > 0.62) _mood = "serious";
      else if (_fit < 0) _mood = "confused";
      // hold each expression for a beat so it doesn't flicker frame-to-frame
      {
        const _now = performance.now() / 1000;
        const st = S.mood[dr.id] || (S.mood[dr.id] = { m: _mood, t: _now });
        const urgent = _mood === "surprised" || _mood === "spin";
        if (_mood !== st.m && (urgent || _now - st.t >= 1.1)) { st.m = _mood; st.t = _now; }
        _mood = st.m;
      }
      // 賭け竜マーカー＝足元の淡い金リング（体の下に描く＝顔を一切隠さない。丸囲いは廃止＝ユーザー指摘）
      if (betSet.has(dr.id)) {
        const rgx = bodyCx, rgy = baseY + 3, rw = Math.max(20 * dep, _hw2 * 1.05);
        const rg = cctx.createRadialGradient(rgx, rgy, 1, rgx, rgy, rw);
        rg.addColorStop(0, "rgba(255,211,77,0.28)"); rg.addColorStop(0.7, "rgba(255,211,77,0.12)"); rg.addColorStop(1, "rgba(255,211,77,0)");
        cctx.save();
        cctx.fillStyle = rg;
        cctx.beginPath(); cctx.ellipse(rgx, rgy, rw, rw * 0.30, 0, 0, Math.PI * 2); cctx.fill();
        cctx.strokeStyle = "rgba(255,211,77,0.5)"; cctx.lineWidth = 1.5;
        cctx.beginPath(); cctx.ellipse(rgx, rgy, rw * 0.86, rw * 0.26, 0, 0, Math.PI * 2); cctx.stroke();
        cctx.restore();
      }
      // ★B 竜を「生きている」ように見せる画像処理（RACE_START_FAIR_ALIVE B）。すべて表示のみ。
      const _now3 = performance.now() / 1000;
      const _waiting = (S.entryT > 0 || S.preT > 0);
      // B-1 呼吸：待機中だけ縦に±1.5%（走行中は既存の gait bob があるので入れない）
      const _breath = _waiting ? 1 + Math.sin(_now3 * (Math.PI * 2 / 2.2) + dragonPhase(dr.id)) * 0.015 : 1;
      // B-4 首かしげ：待機中、竜ごとの周期で±2.5°を1往復＝「こちらに気づいた」感
      let _tilt = 0;
      if (_waiting && !_reduceMotion) {
        const cyc = 6.5 + (dragonPhase(dr.id) % 3);
        const ph4 = (_now3 + dragonPhase(dr.id) * 2) % cyc;
        if (ph4 < 1.1) _tilt = Math.sin(ph4 / 1.1 * Math.PI) * 2.5 * Math.PI / 180;
      }
      const _drawArgs = {
        x: dcx, y: spriteY, scale: sprScale, id: dr.id,
        color: dr.color, style: dr.style, design: dragonDesign(dr.id),
        tint: (S._cmap || (S._cmap = (typeof rcDistinctColors === 'function' ? rcDistinctColors(dragons) : {})))[dr.id],
        gait: S.gait[dr.id], flap: S.gait[dr.id] * 0.6, mood: _mood,
        lean: intensity + (beh.lean || 0), down: down || beh.down, tumble: tumble, glow: glow, effort: effort,
        bank: bank, spread: spread, spin: beh.spin, squash: (beh.squash || 1) * _breath, grounded: S.entryT > 0
      };
      // B-3 スピード残像：全開の竜だけ後方に2枚（drawImage2回ぶんの低コスト＝キャッシュ不要）
      if (intensity > 0.85 && !down && !_reduceMotion) {
        cctx.save();
        cctx.globalAlpha = _prevAlpha * 0.10;
        rcDrawDragon(cctx, Object.assign({}, _drawArgs, { x: dcx - 6 }));
        cctx.globalAlpha = _prevAlpha * 0.05;
        rcDrawDragon(cctx, Object.assign({}, _drawArgs, { x: dcx - 12 }));
        cctx.restore();
      }
      if (_tilt !== 0) {
        cctx.save();
        cctx.translate(bodyCx, spriteY); cctx.rotate(_tilt); cctx.translate(-bodyCx, -spriteY);
        rcDrawDragon(cctx, _drawArgs);
        cctx.restore();
      } else {
        rcDrawDragon(cctx, _drawArgs);
      }
      _rcEmitAccent(S, dragonDesign(dr.id), { x: dcx, y: spriteY, dep: dep, color: dr.color, intensity: intensity, grounded: S.entryT > 0, id: dr.id,
        tailW: rcHasDragonSprite(dr.id) ? rcDragonSpriteHalfW(dr.id, _RC_INRACE * laneDepth(dr)) * 2 : 18 });   // 署名は尾の後ろから（位置のこだわり）

      if (!rcHasDragonSprite(dr.id)) rcDrawDragonFace(cctx, dcx, spriteY, dep, _mood, performance.now(), dr.color);   // 3D絵は自前の表情を持つので漫符overlayは出さない
      // rank badge — ★没入感優先＝控えめな半透明（ユーザー指摘）。賭け竜だけ淡い金塗り。
      //   識別の主役は竜のスプライト自身・ラベルは「読みたい時に読める」薄さに。
      const rk = standMap[dr.id] || dr.rank;
      const isBet = betSet.has(dr.id);
      // 地上整列中はラベルを出さない（スタートのごちゃごちゃ解消・ユーザー指摘）。
      // 賭け竜だけは常時＝自分の竜は見失わない。離陸(6割上昇)で全員分が戻る。
      const _lEb = para ? ((S._launchEb && S._launchEb[dr.id] != null) ? S._launchEb[dr.id] : 1) : 1;
      if (_lEb > 0.6 || isBet) {
      const tagY = y - 34 * dep;
      const rr2 = (isBet ? 9 : 8) * dep;
      cctx.beginPath(); cctx.arc(bodyCx, tagY, rr2, 0, Math.PI * 2);
      cctx.fillStyle = isBet ? "rgba(255,211,77,0.80)" : "rgba(8,10,20,0.42)"; cctx.fill();
      cctx.lineWidth = 1.3;
      cctx.strokeStyle = isBet ? "rgba(255,243,196,0.7)" : (popRank[dr.id] === 1 ? "rgba(127,209,255,0.5)" : "rgba(255,255,255,0.28)");
      cctx.stroke();
      cctx.font = "bold " + Math.round((isBet ? 11 : 10) * dep) + "px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillStyle = isBet ? "rgba(33,21,3,0.95)" : "rgba(255,255,255,0.82)";
      cctx.fillText(rk, bodyCx, tagY + 0.5);
      cctx.textBaseline = "alphabetic";
      // name plate — 控えめなピル（半透明・小さめ）。賭け竜はほんのり金味。
      const nm = commentaryName(dr.id);
      cctx.font = "9.5px system-ui, sans-serif";
      const nw = cctx.measureText(nm).width;
      const plw = nw + 10, plh = 13, plx = bodyCx - plw / 2, ply = baseY + 12;
      cctx.beginPath();
      if (cctx.roundRect) cctx.roundRect(plx, ply, plw, plh, 6.5); else cctx.rect(plx, ply, plw, plh);
      cctx.fillStyle = "rgba(8,10,20,0.36)"; cctx.fill();
      if (isBet) { cctx.lineWidth = 1; cctx.strokeStyle = "rgba(255,211,77,0.4)"; cctx.stroke(); }
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillStyle = isBet ? "rgba(255,233,176,0.85)" : "rgba(255,255,255,0.68)";
      cctx.fillText(nm, bodyCx, ply + plh / 2 + 0.5);
      cctx.textBaseline = "alphabetic";
      }   // ← ラベル表示ゲート（_lEb）

      // ★A-2 ロールコール：紹介中の1頭だけ、頭上に大きな名札プレートを出す。
      //   「⑦｜旋爪竜ロッソ｜差し・単2.9」＋枠色バー。斜め整列でも個体が読める見せ場。
      if (S.roll >= 0 && _rollOrder[S.roll] && _rollOrder[S.roll].id === dr.id) {
        const od2 = (oddsResult.oddsData || []).find(o => o.dragonId === dr.id) || {};
        const d2 = (typeof DRAGONS !== "undefined") ? DRAGONS.find(x => x.id === dr.id) : null;
        const styleLb = (d2 && typeof STYLE_LABEL !== "undefined") ? (STYLE_LABEL[d2.style] || "") : "";
        const nm2 = commentaryName(dr.id);
        const sub = styleLb + (od2.winOdds != null ? "・単" + od2.winOdds.toFixed(1) : "");
        cctx.save();
        cctx.font = "bold 12px system-ui, sans-serif";
        const w1 = cctx.measureText(nm2).width;
        cctx.font = "9.5px system-ui, sans-serif";
        const w2 = cctx.measureText(sub).width;
        const pw = Math.max(w1, w2) + 34, phh = 30;
        const px3 = bodyCx - pw / 2, py3 = y - 74 * dep;
        // 台座
        cctx.beginPath();
        if (cctx.roundRect) cctx.roundRect(px3, py3, pw, phh, 8); else cctx.rect(px3, py3, pw, phh);
        cctx.fillStyle = "rgba(8,11,17,0.88)"; cctx.fill();
        cctx.lineWidth = 1.4;
        cctx.strokeStyle = isBet ? "rgba(255,214,106,0.95)" : "rgba(255,255,255,0.28)";
        cctx.stroke();
        // 枠色バー（竜のアイデンティティ）
        cctx.fillStyle = dr.color || "#888";
        cctx.beginPath();
        if (cctx.roundRect) cctx.roundRect(px3 + 6, py3 + 6, 3.5, phh - 12, 2); else cctx.rect(px3 + 6, py3 + 6, 3.5, phh - 12);
        cctx.fill();
        // 人気番号
        cctx.textAlign = "left"; cctx.textBaseline = "middle";
        cctx.font = "bold 12px system-ui, sans-serif";
        cctx.fillStyle = "#ffd76a";
        cctx.fillText(String(od2.popularityRank || ""), px3 + 14, py3 + phh / 2);
        cctx.fillStyle = "#fff";
        cctx.fillText(nm2, px3 + 26, py3 + 10);
        cctx.font = "9.5px system-ui, sans-serif";
        cctx.fillStyle = "#aab4c2";
        cctx.fillText(sub, px3 + 26, py3 + 22);
        cctx.textAlign = "center"; cctx.textBaseline = "alphabetic";
        cctx.restore();
      }

      // off-screen-behind indicator
      if (offLeft) {
        cctx.fillStyle = "rgba(255,255,255,0.6)";
        cctx.font = "10px system-ui, sans-serif";
        cctx.fillText("◀", cw * 0.03, y);
      }
      cctx.globalAlpha = _prevAlpha;             // end per-dragon edge fade
    }
    if (_popsOn) S.prevStand = standMap;         // 次フレームの順位変動検知用スナップショット

    // イベントポップ描画（0.95s＝ポップイン→浮き上がり→フェード。世界座標＝竜と一緒に流れる）
    if (S.lowSpec && S.pops.length > 2) S.pops.splice(0, S.pops.length - 2);   // R8-W5: 同時2件まで
    if (S.pops.length) {
      for (let i = S.pops.length - 1; i >= 0; i--) {
        const p = S.pops[i], a = (_popNow - p.t0) / 0.95;
        if (a >= 1) { S.pops.splice(i, 1); continue; }
        const inK = Math.min(1, a / 0.14), rise = 26 * a;
        const al = a < 0.75 ? 1 : 1 - (a - 0.75) / 0.25;
        cctx.save();
        cctx.translate(p.x, p.y - rise);
        cctx.scale(0.6 + 0.4 * inK, 0.6 + 0.4 * inK);
        cctx.font = "bold " + (p.sz || 15) + "px system-ui, sans-serif";
        cctx.textAlign = "center"; cctx.textBaseline = "alphabetic";
        cctx.globalAlpha = al;
        cctx.lineWidth = 4; cctx.strokeStyle = "rgba(8,10,20,0.9)"; cctx.strokeText(p.tx, 0, 0);
        cctx.fillStyle = p.c; cctx.fillText(p.tx, 0, 0);
        cctx.restore();
      }
    }

    // (world-space dust / ambient particles are drawn BEFORE the dragon loop now,
    // so foot-dust sits behind the field and never paints over other dragons.)

    cctx.restore();   // ============ end WORLD GROUP ============

    // --- terrain colour wash: a subtle full-scene grade so each course's mood
    // (volcanic red / misty grey / windy blue) is felt even at a glance ---
    const washA = rcTerrainInfo(tb.keyA).tint;
    if (washA) { cctx.fillStyle = washA; cctx.fillRect(0, 0, cw, ch); }
    if (tb.keyB !== tb.keyA) {
      const washB = rcTerrainInfo(tb.keyB).tint;
      if (washB) { cctx.save(); cctx.globalAlpha = tb.t; cctx.fillStyle = washB; cctx.fillRect(0, 0, cw, ch); cctx.restore(); }
    }

    // --- R8-W7: HD-2Dの光の粒（地域色・加算発光）——夜の空気に漂う熾火/蛍/星屑。
    // 決定的な軌道（ハッシュ＋sin）＝ちらつかず、ゆっくり明滅しながら世界と逆方向に流れる。 ---
    if (para && !S.finished) {
      const mc = RC_PARA_MOTE[para.slug] || "#ffe9a8";
      const tm = performance.now() / 1000;
      const nMote = S.lowSpec ? 6 : 14;                        // R8-W5: 低速機は粒を減らす
      cctx.save(); cctx.globalCompositeOperation = "lighter";
      for (let mi = 0; mi < nMote; mi++) {
        const sp2 = 0.35 + (mi % 4) * 0.16;
        const mx = ((mi * 137.7 - (S.camL * SREF) * 0.35 * sp2 + tm * 6 * sp2) % (cw + 40) + (cw + 40)) % (cw + 40) - 20;
        const my = ch * (0.16 + ((mi * 83) % 62) / 100) + Math.sin(tm * (0.7 + sp2) + mi * 2.4) * 9;
        const pl2 = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(tm * (1.3 + sp2) + mi));
        const mg = cctx.createRadialGradient(mx, my, 0, mx, my, 5.5);
        mg.addColorStop(0, rcRgba(mc, 0.45 * pl2)); mg.addColorStop(1, rcRgba(mc, 0));
        cctx.fillStyle = mg; cctx.beginPath(); cctx.arc(mx, my, 5.5, 0, Math.PI * 2); cctx.fill();
        cctx.fillStyle = rcRgba("#ffffff", 0.45 * pl2);
        cctx.beginPath(); cctx.arc(mx, my, 1.05, 0, Math.PI * 2); cctx.fill();
      }
      cctx.restore();
    }

    // --- R8-W6b: 近景シルエット帯（パララックス時・無機質対策）——画面最下端を岩や草の
    // 影が最速×1.3で流れる＝疾走感と奥行き。決定的ハッシュ配置・下端16px内＝竜は隠さない。 ---
    if (para && !S.finished) {
      const fgScroll = S.camL * SREF * 1.3;
      const stepFg = 34;
      cctx.fillStyle = "rgba(6,7,14,0.88)";
      for (let k = Math.floor(fgScroll / stepFg) - 1; k * stepFg - fgScroll < cw + stepFg; k++) {
        const hxx = (((k * 2654435761) >>> 0) % 1000) / 1000;
        if (hxx < 0.30) continue;                                    // 3割は空白＝疎らに
        const bx2 = k * stepFg - fgScroll + hxx * 14;
        const bw2 = 12 + hxx * 30, bh2 = 5 + hxx * 12;
        cctx.beginPath();
        cctx.moveTo(bx2 - bw2 / 2, ch + 1);
        cctx.quadraticCurveTo(bx2 - bw2 * 0.18, ch - bh2 - (hxx > 0.72 ? 5 : 0), bx2 + bw2 * 0.14, ch - bh2 * 0.55);
        cctx.quadraticCurveTo(bx2 + bw2 * 0.4, ch - bh2 * 0.2, bx2 + bw2 / 2, ch + 1);
        cctx.closePath(); cctx.fill();
      }
    }

    // --- final-straight drama vignette (darkens the corners, pulls the eye in) ---
    const finishProx = clamp((leaderP - 0.72) / 0.28, 0, 1);
    const vig = Math.max(finishProx * 0.9, S.finished ? 0.55 : 0);
    if (vig > 0.02) {
      const rg = cctx.createRadialGradient(cw / 2, ch * 0.56, ch * 0.30, cw / 2, ch * 0.56, ch * 0.92);
      rg.addColorStop(0, "rgba(0,0,0,0)");
      rg.addColorStop(1, `rgba(6,6,16,${0.6 * vig})`);
      cctx.fillStyle = rg; cctx.fillRect(0, 0, cw, ch);
    }

    // --- live position minimap (all dragons at a glance) ---
    drawMinimap();

    // --- finish dim (so confetti & banner pop) ---
    if (S.finished) { cctx.fillStyle = "rgba(8,10,20,0.32)"; cctx.fillRect(0, 0, cw, ch); }

    // --- screen-space FX: confetti ribbons + firework sparks ---
    for (const p of S.particles) {
      if (!p.scr) continue;
      const a = clamp(p.life, 0, 1);
      if (p.kind === "confetti") {
        cctx.save();
        cctx.translate(p.x, p.y); cctx.rotate(p.rot || 0);
        cctx.globalAlpha = a; cctx.fillStyle = p.color;
        cctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
        cctx.restore();
      } else {
        cctx.globalAlpha = a; cctx.fillStyle = p.color || "#ffe9a8";
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); cctx.fill();
      }
    }
    cctx.globalAlpha = 1;

    // --- PRE-RACE ATMOSPHERE during the entrance: the arena dims with a quickening
    // heartbeat and camera flashes pop from the stands — building the ドキドキ tension. ---
    if (S.entryT > 0) {
      const nowA = performance.now() / 1000;
      const ent = clamp(1 - S.entryT / ENTRY_DUR, 0, 1);              // 0→1 across the entrance
      const hbRate = 1.1 + ent * 1.1;                                 // heartbeat quickens (~66→132 bpm)
      const beat = Math.pow(Math.max(0, Math.sin(nowA * Math.PI * hbRate)), 12);
      // spotlight vignette: clear centre, darkening edges, pulsing with the heartbeat (darker at higher rank)
      const dim = 0.20 + ent * 0.14 + beat * 0.12 + rankHype * 0.06;
      const vg = cctx.createRadialGradient(cw / 2, ch * 0.56, ch * 0.14, cw / 2, ch * 0.56, ch * 1.0);
      vg.addColorStop(0, "rgba(6,8,20,0)");
      vg.addColorStop(0.55, `rgba(6,8,20,${(dim * 0.45).toFixed(3)})`);
      vg.addColorStop(1, `rgba(3,5,14,${dim.toFixed(3)})`);
      cctx.fillStyle = vg; cctx.fillRect(0, 0, cw, ch);
      // sweeping spotlight beams from above — grandeur that grows with rank (none at R1)
      const beams = Math.round(rankHype * 4);
      for (let i = 0; i < beams; i++) {
        const apexX = cw * (0.5 + (i - (beams - 1) / 2) * 0.18);
        const sweep = Math.sin(nowA * 0.6 + i * 1.9) * cw * 0.16;
        const baseY = ch * 0.66, halfW = cw * 0.07;
        const bg = cctx.createLinearGradient(apexX, -10, apexX + sweep, baseY);
        bg.addColorStop(0, `rgba(255,246,214,${(0.12 + 0.06 * beat).toFixed(3)})`);
        bg.addColorStop(1, "rgba(255,246,214,0)");
        cctx.fillStyle = bg;
        cctx.beginPath();
        cctx.moveTo(apexX - 5, -10); cctx.lineTo(apexX + 5, -10);
        cctx.lineTo(apexX + sweep + halfW, baseY); cctx.lineTo(apexX + sweep - halfW, baseY);
        cctx.closePath(); cctx.fill();
      }
      // camera flashes from the stands — denser & brighter the higher the rank
      const flashN = Math.round(7 + rankHype * 16);
      for (let i = 0; i < flashN; i++) {
        const fx = ((i * 0.139 + 0.04) % 1) * cw;
        const fy = ch * (0.05 + ((i * 0.37) % 1) * 0.15);
        const fb = Math.pow(Math.max(0, Math.sin(nowA * (2.6 + i * 0.7) + i * 2.3)), 22);
        if (fb > 0.04) {
          const fr = (12 + fb * 6) * (1 + rankHype * 0.4);
          const fg = cctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
          fg.addColorStop(0, `rgba(255,255,255,${(0.8 * fb * (0.5 + 0.5 * ent) * (0.7 + 0.6 * rankHype)).toFixed(3)})`);
          fg.addColorStop(1, "rgba(255,255,255,0)");
          cctx.fillStyle = fg; cctx.beginPath(); cctx.arc(fx, fy, fr, 0, Math.PI * 2); cctx.fill();
        }
      }
      // golden glitter rain — only at the higher grades
      const sparkN = Math.round(rankHype * 14);
      for (let i = 0; i < sparkN; i++) {
        const sxr = ((i * 0.0917 + 0.03) % 1) * cw;
        const fall = (nowA * 0.16 + i * 0.123) % 1;
        const tw = 0.5 + 0.5 * Math.sin(nowA * 4 + i);
        cctx.globalAlpha = (1 - fall) * 0.5 * tw;
        rcSparkle(cctx, sxr, fall * ch * 0.9, 2.3, "#ffe9a0");
      }
      cctx.globalAlpha = 1;
    }

    // --- いいね hearts (livestream reactions rising) + a "♥ N" counter in the pre-show ---
    for (const lk of S.likes) rcHeart(cctx, lk.x, lk.y, lk.s, lk.hue, clamp(lk.life, 0, 1) * 0.92);
    if (S.entryT > 0) {
      const lc = S.likeCount, lcTxt = lc >= 1000 ? (lc / 1000).toFixed(1) + "k" : String(lc);
      const tx = cw - 12, ty = ch * 0.62;
      cctx.save();
      rcHeart(cctx, tx - 3, ty, 8, "#ff6a86", 0.95);
      cctx.textAlign = "right"; cctx.textBaseline = "middle";
      cctx.font = "bold 14px system-ui, sans-serif";
      cctx.lineWidth = 3; cctx.strokeStyle = "rgba(8,10,20,0.7)";
      cctx.strokeText(lcTxt, tx - 16, ty - 3);
      cctx.fillStyle = "#fff"; cctx.fillText(lcTxt, tx - 16, ty - 3);
      cctx.restore();
    }

    // --- floating texts (screen space) ---
    cctx.textAlign = "center";
    for (const f of S.floats) {
      cctx.globalAlpha = clamp(f.life, 0, 1);
      cctx.lineWidth = 3; cctx.strokeStyle = "rgba(8,10,20,0.8)";
      cctx.font = (f.big ? "bold 20px" : "bold 13px") + " system-ui, sans-serif";
      cctx.strokeText(f.text, f.x, f.y);
      cctx.fillStyle = f.color;
      cctx.fillText(f.text, f.x, f.y);
    }
    cctx.globalAlpha = 1;

    // (the entrance 煽り now shows in the 実況 telop below the canvas — see pumpEntranceTelop)
    // --- start 3-2-1 countdown / GO burst ---
    if (S.preT > 0 && S.entryT <= 0) {
      const n = Math.min(3, Math.max(1, Math.ceil(S.preT)));
      const frac = S.preT - Math.floor(S.preT);     // ~1 right after a tick → 0 before next
      const pulse = 0.7 + frac * 0.75;
      cctx.save();
      cctx.globalAlpha = clamp(0.2 + frac, 0, 1);
      cctx.translate(cw / 2, ch * 0.40); cctx.scale(pulse, pulse);
      cctx.font = "bold 66px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.lineWidth = 6; cctx.strokeStyle = "rgba(10,12,24,0.7)";
      cctx.fillStyle = "#fff";
      cctx.strokeText(String(n), 0, 0); cctx.fillText(String(n), 0, 0);
      cctx.restore();
      cctx.globalAlpha = 0.85; cctx.fillStyle = "#ffe9a8";
      cctx.font = "bold 13px system-ui, sans-serif"; cctx.textAlign = "center";
      cctx.fillText("位置について…", cw / 2, ch * 0.40 + 54);
      cctx.globalAlpha = 1;
    } else if (S.goFlash > 0) {
      const k = clamp(S.goFlash / 0.8, 0, 1);
      cctx.save();
      cctx.globalAlpha = k;
      cctx.translate(cw / 2, ch * 0.40); cctx.scale(1 + (1 - k) * 0.9, 1 + (1 - k) * 0.9);
      cctx.font = "bold 72px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.lineWidth = 6; cctx.strokeStyle = "rgba(120,60,0,0.55)";
      cctx.fillStyle = "#ffe06a";
      cctx.strokeText("GO！", 0, 0); cctx.fillText("GO！", 0, 0);
      cctx.restore(); cctx.globalAlpha = 1;
    }

    // --- R8-W1: フォトフィニッシュの1拍 — 白バウンス＋ゴール線ハイライト＋(きわどい時)ラベル ---
    if (S.photoT > 0) {
      const pk = clamp(S.photoT / 0.62, 0, 1);
      cctx.fillStyle = "rgba(255,255,255," + (0.34 * pk * pk).toFixed(3) + ")";
      cctx.fillRect(0, 0, cw, ch);
      const pgx = clamp(screenX(1, S._winw || 0.3), -20, cw + 20);
      cctx.fillStyle = "rgba(255,255,255," + (0.75 * pk).toFixed(3) + ")";
      cctx.fillRect(pgx - 1, 0, 2, ch);
      if (timeline.photoFinish) {
        cctx.save();
        cctx.font = "800 13px system-ui, sans-serif";
        cctx.textAlign = "center"; cctx.textBaseline = "middle";
        const pw = cctx.measureText("📸 写真判定").width + 22;
        cctx.fillStyle = "rgba(14,18,34,0.78)";
        cctx.beginPath();
        if (cctx.roundRect) cctx.roundRect(cw / 2 - pw / 2, ch * 0.20 - 12, pw, 24, 12); else cctx.rect(cw / 2 - pw / 2, ch * 0.20 - 12, pw, 24);
        cctx.fill();
        cctx.strokeStyle = "rgba(255,255,255,0.55)"; cctx.lineWidth = 1; cctx.stroke();
        cctx.fillStyle = "#fff";
        cctx.fillText("📸 写真判定", cw / 2, ch * 0.20 + 1);
        cctx.restore();
      }
    }

    // --- phase-entry banner (slides in from the side, holds, slides out) ---
    // --- terrain sign: an anime-style CUT-IN — a slanted banner that SLAMS in from the
    // left (speed lines + impact flash) as the leader enters a section, then snaps out.
    // Auto-sized & left-anchored, so it dramatises the course info without burying the race. ---
    if (S.terrainSign && !S.finished && S.preT <= 0) {
      const ts = S.terrainSign, t = ts.t, mx = ts.max;
      const inP = clamp(t / 0.26, 0, 1);
      const outP = clamp((mx - t) / 0.3, 0, 1);
      const c1 = 1.8, c3 = c1 + 1;
      const eb = inP >= 1 ? 1 : (1 + c3 * Math.pow(inP - 1, 3) + c1 * Math.pow(inP - 1, 2));  // easeOutBack slam
      const a = Math.min(clamp(inP / 0.35, 0, 1), outP);
      const accent = (RC_THEME[ts.key] || RC_THEME.straight).accent;
      cctx.save();
      cctx.font = "bold 19px system-ui, sans-serif";
      const tw = cctx.measureText(ts.label).width;
      const iconW = 30, padX = 14, h = 42, slant = 14;
      const bw = Math.min(cw * 0.62, iconW + tw + padX * 2 + 16);
      const enterX = -bw - 50, restX = -8;
      let x = enterX + (restX - enterX) * eb;               // slam in (overshoot, settle)
      if (outP < 1) x -= (1 - outP) * (bw + 60);            // snap out to the left
      const y0 = ch * 0.30;
      cctx.globalAlpha = clamp(a, 0, 1);
      // speed lines trailing the slam-in
      if (inP < 1) {
        cctx.strokeStyle = rcRgba(accent, 0.55 * (1 - inP)); cctx.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) { const ly = y0 + 5 + i * 8; cctx.beginPath(); cctx.moveTo(x + bw, ly); cctx.lineTo(x + bw + 26 + i * 16, ly); cctx.stroke(); }
      }
      // slanted banner (parallelogram): top edge sheared right by `slant`
      cctx.fillStyle = "rgba(9,11,22,0.92)";
      cctx.beginPath(); cctx.moveTo(x + slant, y0); cctx.lineTo(x + bw + slant, y0); cctx.lineTo(x + bw, y0 + h); cctx.lineTo(x, y0 + h); cctx.closePath(); cctx.fill();
      cctx.fillStyle = accent;                              // accent slash down the left edge
      cctx.beginPath(); cctx.moveTo(x + slant, y0); cctx.lineTo(x + slant + 7, y0); cctx.lineTo(x + 7, y0 + h); cctx.lineTo(x, y0 + h); cctx.closePath(); cctx.fill();
      cctx.fillStyle = rcRgba(accent, 0.9); cctx.fillRect(x + slant, y0, bw, 1.5); cctx.fillRect(x, y0 + h - 1.5, bw, 1.5);   // top/bottom edges
      // content (upright text on the slanted band)
      const cx = x + slant + 12;
      cctx.textBaseline = "middle"; cctx.textAlign = "center";
      cctx.font = "20px system-ui, sans-serif"; cctx.fillStyle = "#fff";
      cctx.fillText(ts.icon, cx + 9, y0 + h / 2);
      cctx.textAlign = "left"; cctx.fillStyle = "#fff"; cctx.font = "bold 19px system-ui, sans-serif";
      cctx.fillText(ts.label, cx + iconW, y0 + (ts.demand ? 15 : h / 2));
      if (ts.demand) { cctx.fillStyle = accent; cctx.font = "bold 11px system-ui, sans-serif"; cctx.fillText("▶ " + ts.demand, cx + iconW, y0 + 31); }
      // impact flash right after it lands
      const flash = (t >= 0.26) ? clamp(1 - (t - 0.26) / 0.16, 0, 1) : 0;
      if (flash > 0) {
        cctx.globalAlpha = clamp(a, 0, 1) * flash * 0.5; cctx.fillStyle = "#fff";
        cctx.beginPath(); cctx.moveTo(x + slant, y0); cctx.lineTo(x + bw + slant, y0); cctx.lineTo(x + bw, y0 + h); cctx.lineTo(x, y0 + h); cctx.closePath(); cctx.fill();
      }
      cctx.restore(); cctx.globalAlpha = 1;
    }

    if (S.banner && !S.finished && S.preT <= 0) {
      const b = S.banner, u = clamp(b.t / b.max, 0, 1);
      const fade = u < 0.16 ? u / 0.16 : (u > 0.74 ? (1 - u) / 0.26 : 1);
      const slideIn = (1 - Math.min(1, u / 0.16)) * 46;
      const slideOut = u > 0.74 ? ((u - 0.74) / 0.26) * 34 : 0;
      const sx = slideIn - slideOut;
      const by = ch * 0.17;
      cctx.save();
      cctx.globalAlpha = clamp(fade, 0, 1);
      cctx.fillStyle = "rgba(12,14,28,0.46)";
      cctx.fillRect(0, by - 23, cw, 46);
      cctx.fillStyle = "rgba(255,224,106,0.92)";
      cctx.fillRect(0, by - 23, cw, 3);
      cctx.fillRect(0, by + 20, cw, 3);
      cctx.font = "bold 30px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.lineWidth = 5; cctx.strokeStyle = "rgba(8,10,22,0.7)";
      cctx.fillStyle = "#fff";
      cctx.strokeText(b.text, cw / 2 + sx, by);
      cctx.fillText(b.text, cw / 2 + sx, by);
      cctx.restore(); cctx.globalAlpha = 1;
    }

    // --- ゴール後に立ち上がる観客（手前の席）---
    // ★DOMのオーバーレイからキャンバス描画へ移した理由：
    //   観客はキャンバスの前面に置く必要がある（背面だと不透明なキャンバスに隠れて消える）が、
    //   DOMで前面に置くと、この直後にキャンバスへ描く「🏆1着◯◯」「的中！/ハズレ」プレートの
    //   上にも被さってしまう（プレートは ch*0.82＝観客帯の中）。z-index では両立できない。
    //   描画順に組み込めば「観客の手前にプレート」が自然に成立する。
    //   スプライトは12コマ縦積み。ゴールから 0.06s ごとに1コマ進み、最終コマで静止。
    drawCrowdStand();
    // --- finish celebration + goal-moment reward reveal (spec #37) ---
    if (S.finished) {
      const winner = timeline.crossings[0];
      const rt = S.rewardT || 0;
      // ★R8-W4：勝者ウィニングカット（HD-2D絵があれば rt 0〜1.55s に大写し・
      //   見出し/払戻プレートはカットの終盤 rt-1.35s から＝順に語る）。表示のみ。
      const hasCut = rcHasDragonSprite(winner.id);
      if (hasCut) rcDrawWinnerCut(cctx, winner.id, cw / 2, ch * 0.54, rt, cw);
      const rtd = hasCut ? Math.max(0, rt - 1.35) : rt;
      const _fc = (n) => (typeof fmtCoins === "function" ? fmtCoins(n) : String(n));
      cctx.save();
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      // headline fades in first（カット時は「1着〈名前〉」行を省略＝金リボンと重複するため）
      cctx.globalAlpha = Math.min(1, rtd / 0.22);
      // ※「ゴールイン！」の素テキストは撤去（デザイン済みの .rc-goalband 帯と重複するため）。
      //   ゴールの合図は帯に一本化し、canvas側は「1着 ◯◯」と配当プレートに専念する。
      cctx.fillStyle = "#ffe9a8"; cctx.font = "bold 25px system-ui, sans-serif";
      if (!hasCut) {
        cctx.fillStyle = "#fff"; cctx.font = "bold 15px system-ui, sans-serif";
        cctx.fillText("1着  " + commentaryName(winner.id), cw / 2, ch * 0.14 + 24);
      }
      cctx.globalAlpha = 1;
      // the reward plate pops in a beat later, showing the actual payout
      if (betResult) {
        const rp = Math.max(0, Math.min(1, (rtd - 0.18) / 0.4));
        const ease = 1 - Math.pow(1 - rp, 3);
        const overshoot = rp < 1 ? Math.sin(rp * Math.PI) * 0.08 : 0;
        const sc = 0.62 + 0.38 * ease + overshoot;
        const hit = betResult.hit;
        const tier = hit ? ((typeof resultTierOf === "function") ? resultTierOf(betResult)
          : (betResult.odds >= 7 ? 3 : betResult.odds >= 3 ? 2 : 1)) : 0;
        const col = !hit ? "#ff9a8a"
          : tier >= 4 ? "#ffd877" : tier >= 3 ? "#ffb070" : tier >= 2 ? "#ffe09a" : "#8df0a6";
        const word = !hit ? "ハズレ"
          : tier >= 4 ? "伝説の的中！" : tier >= 3 ? "超的中！" : tier >= 2 ? "大的中！" : "的中！";
        const amount = hit ? ("＋" + _fc(betResult.payout) + " コイン")
          : ("−" + _fc(Math.abs(betResult.profit)) + " コイン");
        cctx.save();
        // ★プレートは下段へ＝ウィニングカット（中央）の主役を邪魔しない（ユーザー指定）
        cctx.translate(cw / 2, hasCut ? ch * 0.82 : ch * 0.35);
        cctx.scale(sc, sc);
        cctx.globalAlpha = Math.min(1, rp * 1.4);
        const pw = 252, ph = 70;
        cctx.beginPath();
        if (cctx.roundRect) cctx.roundRect(-pw / 2, -ph / 2, pw, ph, 15);
        else cctx.rect(-pw / 2, -ph / 2, pw, ph);
        cctx.fillStyle = "rgba(8,12,18,0.84)"; cctx.fill();
        cctx.lineWidth = 2.5; cctx.strokeStyle = col;
        if (hit && tier >= 3) { cctx.shadowColor = col; cctx.shadowBlur = 18; }
        cctx.stroke(); cctx.shadowBlur = 0;
        cctx.fillStyle = col; cctx.font = "bold 22px system-ui, sans-serif";
        cctx.fillText(word, 0, -12);
        cctx.fillStyle = "#fff"; cctx.font = "bold 21px system-ui, sans-serif";
        cctx.fillText(amount, 0, 15);
        cctx.restore();
      }
      cctx.restore();
    }

    // HUD updates
    const _pi = timeline.phaseIndexAt(S.tau);
    phaseEl.textContent = ["序盤", "中盤", "展開", "終盤", "ゴール前"][_pi] || "";
    // ★CORE_LOOP_UX B-3「山を3つ」：序盤は静かに→終盤/ゴール前で盤面を締める。
    //   フェーズを盤面に出してCSSで段階的に強める（従来は全区間ほぼ均質だった）。
    if (wrap.dataset.phaseIdx !== String(_pi)) {
      wrap.dataset.phaseIdx = String(_pi);
      if (_pi >= 3) {   // 終盤(3)/ゴール前(4)へ入る一拍だけ締める（毎回揺らすと安っぽい）
        wrap.classList.remove("rc-climax"); void wrap.offsetWidth; wrap.classList.add("rc-climax");
      }
    }
    const _hudKey = themeKeyAtP(leaderP);
    sectionEl.textContent = rcTerrainInfo(_hudKey).icon + " " + sectionLabelAtP(leaderP);
    sectionEl.style.borderLeftColor = (RC_THEME[_hudKey] || RC_THEME.straight).accent;
    remainEl.textContent = "残り " + timeline.distanceRemainingAt(S.tau) + "m";
    const _tNow = (typeof performance !== "undefined" ? performance.now() : Date.now());
    updateBoard(standings, standMap, _tNow);
  }

  // =====================================================================
  // ★RACE_SCREEN_LIVE D1：生着順ボード
  //   8頭ぶんの行DOMを一度だけ作り、以後は「並び替え＋中身の差分更新」だけ行う。
  //   並び替えは FLIP（First-Last-Invert-Play）＝transformのみで動かす＝レイアウト計算を
  //   毎フレーム走らせない。行が入れ替わる動きこそ「数字が生きている」感の本体。
  //   ⚠️着順は timeline で確定済み。ここは standings/standMap を読むだけの表示層。
  // =====================================================================
  const BOARD_ROW_H = 27;                  // 1行の高さ(px)。CSSの --rcb-h と一致させること
  const boardRow = {};                     // dragonId -> 行要素
  let boardPrevRank = {};                  // 直前の順位（▲▼と発光の判定用）
  let boardLastArrange = -1;               // 並び替えの間引き用タイムスタンプ
  let boardHitLineEl = null;               // 的中ラインの要素
  let boardZoneWas = null;                 // 圏内フラグの前回値（入った瞬間だけ光らせる）

  // 賭式ごとの「ここより上なら的中」の境界順位。単勝=1着まで／複勝・ワイド=3着まで。
  const HIT_LINE_RANK = !bet ? 0 : (bet.type === "win" ? 1 : 3);

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.height = (BOARD_ROW_H * dragons.length + 10) + "px";
    // 的中ライン（賭けているときだけ）＝射幸性の本丸。常に「あと何人抜けば的中か」が線で見える。
    if (bet && betSet.size && HIT_LINE_RANK > 0 && HIT_LINE_RANK < dragons.length) {
      boardHitLineEl = el("div", "rcb-hitline");
      boardHitLineEl.innerHTML = `<span class="rcb-hl-tag">ここより上で的中</span>`;
      boardHitLineEl.style.transform = `translateY(${BOARD_ROW_H * HIT_LINE_RANK}px)`;
      boardEl.appendChild(boardHitLineEl);
    }
    dragons.forEach(dr => {
      const row = el("div", "rcb-row");
      row.dataset.id = dr.id;
      if (betSet.has(dr.id)) row.classList.add("mine");
      const od = (oddsResult.oddsData || []).find(o => o.dragonId === dr.id) || {};
      const d = (typeof DRAGONS !== "undefined") ? DRAGONS.find(x => x.id === dr.id) : null;
      const col = (typeof dragonColor === "function" && d) ? dragonColor(d) : "#888";
      const styleLb = (d && typeof STYLE_LABEL !== "undefined") ? (STYLE_LABEL[d.style] || "") : "";
      row.innerHTML =
        `<span class="rcb-pos"></span>` +
        `<span class="rcb-waku" style="background:${col}"></span>` +
        `<span class="rcb-nm">${commentaryName(dr.id)}</span>` +
        `<span class="rcb-style">${styleLb}</span>` +
        `<span class="rcb-odds">${od.winOdds != null ? od.winOdds.toFixed(1) : "-"}</span>` +
        `<span class="rcb-mv"></span>` +
        (betSet.has(dr.id) ? `<span class="rcb-pay"></span>` : "");
      boardEl.appendChild(row);
      boardRow[dr.id] = row;
    });
  }

  function updateBoard(standings, standMap, tNow) {
    // --- 並び替え（FLIP）: 4〜5回/秒に間引く。毎フレームやると重いだけで見た目も変わらない ---
    const doArrange = (tNow - boardLastArrange) > 220;
    standings.forEach((id, i) => {
      const row = boardRow[id]; if (!row) return;
      const rank = i + 1;
      const prev = boardPrevRank[id];

      if (doArrange) {
        const toY = BOARD_ROW_H * i;
        const fromY = row._y != null ? row._y : toY;
        if (fromY !== toY) {
          // Invert→Play：一旦もとの位置に置いてから、次フレームで新しい位置へ流す
          row.style.transition = "none";
          row.style.transform = `translateY(${fromY}px)`;
          void row.offsetWidth;
          row.style.transition = "";
          row.style.transform = `translateY(${toY}px)`;
        } else {
          row.style.transform = `translateY(${toY}px)`;
        }
        row._y = toY;
      }

      // --- 中身の差分更新（変わった時だけ触る＝無駄な再描画を避ける） ---
      if (row._rank !== rank) {
        row._rank = rank;
        row.querySelector(".rcb-pos").textContent = rank;
        row.classList.toggle("top3", rank <= 3);
        // 順位変動の矢印：上がった＝▲（緑）／下がった＝▼（赤）。1.2秒で自然に消す。
        if (prev != null && prev !== rank) {
          const mv = row.querySelector(".rcb-mv");
          const up = rank < prev;
          mv.textContent = up ? "▲" : "▼";
          mv.className = "rcb-mv " + (up ? "up" : "down");
          clearTimeout(row._mvT);
          row._mvT = setTimeout(() => { mv.textContent = ""; mv.className = "rcb-mv"; }, 1200);
        }
      }
      boardPrevRank[id] = rank;
    });
    if (doArrange) boardLastArrange = tNow;

    // --- 自分の竜：期待メーター＋ライブ配当（圏内のときだけ）---
    if (bet && betSet.size) {
      const exp = betExpect(standMap);
      betSet.forEach(id => {
        const row = boardRow[id]; if (!row) return;
        row.classList.toggle("in-zone", exp.inZone);
        const pay = row.querySelector(".rcb-pay");
        if (!pay) return;
        // 圏内のときだけ「いま的中なら +N」を出す（常時出すと的中の重みが薄れる）
        if (exp.inZone) {
          if (row._payShown !== true) {
            row._payShown = true;
            let amt = 0;
            try { amt = Math.floor(bet.wager * betOdds(bet, oddsResult)); } catch (e) { amt = 0; }
            pay.textContent = amt > 0 ? `いま的中なら +${fmtCoins(amt)}` : "";
          }
        } else if (row._payShown !== false) {
          row._payShown = false; pay.textContent = "";
        }
      });
      // 的中ラインを越えた「瞬間」だけ光らせる＋SE（常時光ると麻痺する＝B-2で実証済みの作法）
      if (exp.inZone && boardZoneWas === false) {
        boardEl.classList.remove("zone-hit"); void boardEl.offsetWidth; boardEl.classList.add("zone-hit");
        try { if (window.Sfx) Sfx.play("coin"); } catch (e) {}
        chatOnZone();   // ★D2：圏内突入＝視聴者がざわつく（歓声のピーク）
      }
      boardEl.classList.toggle("in-zone", exp.inZone);
      boardZoneWas = exp.inZone;
    }
  }

  // =====================================================================
  // ★RACE_SCREEN_LIVE D2：視聴者レイヤー（同接カウンタ＋流れるコメント）
  //   「無人の中継画面」を「人が見ている配信」に変える層。全て演出＝結果に非干渉。
  //   コメントは匿名ハンドルのみ（data_race_chat.js）＝キャスト登場門番の事故を構造で防ぐ。
  // =====================================================================
  const viewersEl = wrap.querySelector("#rc-viewers");
  const chatEl = wrap.querySelector("#rc-chat");
  // ★CODEX納品：実況ワイプの表情（base/happy/panic/serious/surprised）。
  //   出来事で一瞬変わり（先頭交代=驚き・自分の竜が後退=あせり）、平常は文脈の基礎表情
  //   （圏内=にこにこ・決着=的中なら喜び/外れなら真剣）へ戻る。すべて演出＝結果に非干渉。
  const casterEl = wrap.querySelector("#rc-caster");
  let _casterCur = "", _casterHoldUntil = 0;
  function setCaster(expr) {
    if (!casterEl || _casterCur === expr) return;
    _casterCur = expr;
    casterEl.src = "images/race_live/mimi_caster" + (expr ? "_" + expr : "") + ".webp";
  }
  function casterFlash(expr, tNow, ms) { setCaster(expr); _casterHoldUntil = tNow + ms; }
  function casterTick(tNow) {
    if (tNow < _casterHoldUntil) return;          // 一瞬の表情を保持中
    setCaster(S.finished ? (computeBetHit() === true ? "happy" : "serious")
      : boardZoneWas ? "happy" : "");
  }
  const CHAT_MAX = 3;                       // 同時表示は3行まで（DOM累積を防ぐ）
  let viewersBase = 0, viewersShown = 0, viewersTargetAdd = 0;
  let chatNextAt = 0, chatPrevLead = null, chatPrevMineRank = null, chatGoalDone = false;
  let _goalChatLeft = 0;   // ゴール後に流す「余韻」コメントの残り本数（0で打ち止め＝静かになる）

  // 同接のベース値＝レースの格（rank）で桁を変える。以降はイベントで積み増す“演出数字”。
  (function initViewers() {
    const rk = (race && race.rank) || 1;
    viewersBase = Math.round((180 + rk * rk * 260) * (0.85 + Math.random() * 0.3));
    viewersShown = viewersBase;
  })();

  // ★視聴者コメントの「表示」は撤去済み（ゆっくり実況の二人に置換）。
  //   ただし同接の増減はこの経路の副作用として生きているので、関数ごとは消さず
  //   描画先が無いときは黙って何もしない（chatEl は null になる）。
  function pushChat(key, dragonName) {
    if (!chatEl) return;
    if (typeof rcChatPick !== "function") return;
    const t = rcChatPick(key, dragonName);
    if (!t) return;
    const line = el("div", "rc-chat-line");
    line.innerHTML = `<b>${(typeof rcChatHandle === "function" ? rcChatHandle() : "視聴者")}</b>${t}`;
    chatEl.appendChild(line);
    while (chatEl.children.length > CHAT_MAX) chatEl.removeChild(chatEl.firstChild);
  }

  // フェーズ/出来事に反応してコメントを流す＋同接を動かす（毎フレームの乱数は使わない）
  function updateChat(standings, standMap, phaseIdx, tNow) {
    const leader = standings[0];
    const mineId = betSet.size ? [...betSet][0] : null;
    const mineName = mineId ? commentaryName(mineId) : null;
    const mineRank = mineId ? (standMap[mineId] || 99) : null;

    // 出来事ドリブン（優先度順に1つだけ）
    let ev = null;
    if (!chatGoalDone && S.finished) { ev = "goal"; chatGoalDone = true; viewersTargetAdd += Math.round(viewersBase * 0.5); }
    else if (chatPrevLead && leader !== chatPrevLead) { ev = "lead"; viewersTargetAdd += Math.round(viewersBase * 0.06); }
    else if (mineRank != null && chatPrevMineRank != null && mineRank < chatPrevMineRank) ev = "mineUp";
    else if (mineRank != null && chatPrevMineRank != null && mineRank > chatPrevMineRank) ev = "mineDown";
    if (ev) pushChat(ev, mineName);
    // 実況ワイプの表情：出来事で一瞬変え、平常は文脈の基礎表情へ（casterTick）
    if (ev === "lead") casterFlash("surprised", tNow, 1600);
    else if (ev === "mineDown") casterFlash("panic", tNow, 1600);
    casterTick(tNow);
    chatPrevLead = leader; chatPrevMineRank = mineRank;

    if (S.finished) {
      // ★ゴール後：余韻コメントを数本だけ、ゆっくり流して打ち止める（走行中の賑やかさを持ち越さない）
      if (_goalChatLeft > 0 && tNow > chatNextAt) {
        chatNextAt = tNow + 1500;
        _goalChatLeft--;
        pushChat("goal", mineName);
      }
    } else {
      // 間が空いたら埋める（フェーズで頻度を変える＝終盤ほど賑やかに）
      const interval = phaseIdx >= 4 ? 900 : phaseIdx >= 3 ? 1300 : 2000;
      if (tNow > chatNextAt) {
        chatNextAt = tNow + interval;
        pushChat(phaseIdx >= 3 ? "final" : (tNow < 3000 ? "start" : "idle"), mineName);
        if (phaseIdx >= 3) viewersTargetAdd += Math.round(viewersBase * 0.03);
      }
    }

    // 同接：目標値へなめらかに寄せる（数字がじわじわ増える＝配信が伸びている感）。
    // ★ゴール後は伸ばさず確定値で止める（中継が終わったのに数字だけ回り続けるのは嘘になる）。
    const b = viewersEl && viewersEl.querySelector("b");
    if (S.finished) {
      if (viewersEl) viewersEl.classList.add("fixed");
      if (b && !viewersEl._fixed) { viewersEl._fixed = true; b.textContent = viewersShown.toLocaleString("ja-JP"); }
      return;
    }
    const target = viewersBase + viewersTargetAdd;
    if (viewersShown < target) viewersShown += Math.max(1, Math.ceil((target - viewersShown) * 0.12));
    if (b) b.textContent = viewersShown.toLocaleString("ja-JP");
  }
  // 圏内に入った時だけ呼ぶ（updateBoard から）＝歓声のピーク
  function chatOnZone() { pushChat("zone", betSet.size ? commentaryName([...betSet][0]) : null); viewersTargetAdd += Math.round(viewersBase * 0.12); }

  // ゴール後：上位3行を金銀銅で固める＝結果画面へのつなぎ（遷移の連続性）
  function freezeBoardPodium(standings) {
    standings.forEach((id, i) => {
      const row = boardRow[id]; if (!row) return;
      if (i < 3) row.classList.add("podium", "p" + (i + 1));
    });
    boardEl.classList.add("final");
  }
  // 決着前へスクラブし戻した時に確定表示を解除（走行中の顔に戻す）
  function unfreezeBoardPodium() {
    if (!boardEl.classList.contains("final")) return;
    boardEl.classList.remove("final");
    Object.keys(boardRow).forEach(id => boardRow[id].classList.remove("podium", "p1", "p2", "p3"));
  }
  // ★CORE_LOOP_UX B-1/B-2：「自分の竜」アンカー＋期待メーター。
  //   いまの並びを読んで「的中まであと何頭か」を可視化する＝当落ではなく“期待”の表示
  //   （パチンコの保留変化に相当）。⚠️着順は timeline で確定済み・ここでは一切触らない。
  function betExpect(standMap) {
    const ids = [...betSet];
    const ranks = ids.map(id => standMap[id] || 99);
    const gauge = gap => Math.max(8, Math.round(100 - gap * 22));   // 離れるほど短い棒（確率ではない）
    let gap;
    if (bet.type === "win") gap = Math.max(0, ranks[0] - 1);
    else if (bet.type === "place") gap = Math.max(0, ranks[0] - 3);
    else gap = ranks.reduce((s, r) => s + Math.max(0, r - 3), 0);
    const inZone = gap === 0;
    const label = inZone
      ? (bet.type === "win" ? "🔥 的中圏内！このまま逃げ切れ"
        : bet.type === "place" ? "🔥 的中圏内！3着以内キープ" : "🔥 2頭とも圏内！")
      : `的中まで あと${gap}頭`;
    return { inZone, gap, pct: gauge(gap), label };
  }
  // ※旧 updateBet（HUD隅の1行メーター）は D1 生着順ボードへ置換統合したため撤去。
  //   期待の可視化は betExpect() のまま＝自分の行の in-zone 表示とライブ配当チップが担う。

  // =====================================================================
  // UPDATE
  // =====================================================================
  function update(dt) {
    // run-out slow-MOTION: once the winner crosses, dilate time so the finish reads as
    // a cinematic slow-mo gallop-through with FULL stride & effort — not the dragons
    // tiring. Applied uniformly to gait / particles / coast / τ so nothing desyncs.
    const _winId = timeline.crossings.length ? timeline.crossings[0].id : null;
    // Goal slow-motion REMOVED — the finish and the gallop-through play at normal
    // speed; the post-goal beat is carried by celebration / pull-up behavior instead.
    const smo = 1;
    const sdt = dt * smo;

    // gait clocks advance with each dragon's speed (slowed in slow-mo, but FULL stride —
    // never a tired cadence drop)
    for (const dr of dragons) {
      const v = timeline.speedAt(dr.id, S.tau);
      const rate = (S.entryT > 0) ? 3.5 : (v < 0.2) ? 3 : 9 + v * 6;   // slow walking cadence during the entrance
      S.gait[dr.id] += sdt * rate;
    }
    // particles — world FX run on slow-mo time so dust hangs during the run-out;
    // screen-space confetti keeps real time
    for (const p of S.particles) {
      const pdt = p.scr ? dt : sdt;
      p.x += p.vx * pdt; p.y += p.vy * pdt;
      if (p.kind === "confetti") {
        p.vy += 26 * dt;                       // gentle fall
        p.vx += Math.sin((p.rot || 0) * 2) * 18 * dt; // flutter sway
        p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      } else if (p.acc) {
        if (p.kind === 'snow' || p.kind === 'tear') p.vy += 16 * pdt;        // 落ちる
        else if (p.kind === 'ember' || p.kind === 'firegold' || p.kind === 'sleep') p.vy -= 10 * pdt;  // 昇る
        p.vx *= (1 - 0.7 * pdt);                                             // 尾を引いて減速
      } else if (!p.amb) { p.vy += 60 * pdt; }
      else if (p.kind === "ember") { p.vy -= 9 * pdt; }
      p.life -= pdt / p.max;
    }
    S.particles = S.particles.filter(p => p.life > 0);
    // いいね hearts rise + sway + fade
    for (const lk of S.likes) {
      lk.sway += dt * 3;
      lk.x += (lk.vx + Math.sin(lk.sway) * 9) * dt;
      lk.y += lk.vy * dt;
      lk.vy += 7 * dt;                 // ease the rise
      lk.life -= dt / lk.max;
    }
    S.likes = S.likes.filter(lk => lk.life > 0);
    // floats
    for (const f of S.floats) { f.y += f.vy * dt; f.life -= dt * 0.7; }
    S.floats = S.floats.filter(f => f.life > 0);
    if (S.countdown > 0) S.countdown -= dt * 1.3;
    // screen-shake impulse decays
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 14);
    // "GO！" flash + overtake push-in impulse fade
    if (S.goFlash > 0) S.goFlash = Math.max(0, S.goFlash - dt);
    if (S.zoomBump > 0) S.zoomBump = Math.max(0, S.zoomBump - dt * 0.22);
    // phase-entry banner ages out (animates even while paused so it can clear)
    if (S.banner) { S.banner.t += dt; if (S.banner.t >= S.banner.max) S.banner = null; }
    if (S.terrainSign) { S.terrainSign.t += dt; if (S.terrainSign.t >= S.terrainSign.max) S.terrainSign = null; }
    // keep sprinkling celebration confetti for a beat after the finish
    if (S.finished && S.confettiT > 0) {
      S.confettiT -= dt;
      if (Math.random() < 0.45) spawnConfetti(3);
    }
    if (S.finished) S.rewardT += dt;   // drives the goal-moment reward pop-in (spec #37)

    if (!S.playing || S.finished) return;
    // ambient terrain particles (embers / gusts / leaves) for the current section
    S.ambT -= dt;
    if (S.ambT <= 0) {
      S.ambT = 0.07;
      spawnAmbient(themeKeyAtP(timeline.leaderProgressAt(S.tau)), trackGeom());
    }
    // pause while a Mimi/Sake modal is open (don't race behind a dialogue)
    const ov = document.getElementById("event-overlay");
    if (ov && !ov.classList.contains("hidden")) return;

    // R8-W1: フォトフィニッシュ静止1拍 — 1着の鼻先がゴールに触れた瞬間、世界ごと止める
    // （τ/歩様/粒子すべて凍結＝写真。描画は続くのでフラッシュだけが減衰する。表示のみ）
    if (S.photoT > 0) { S.photoT -= dt; if (S.photoT > 0) return; S.photoT = 0; }

    // --- entrance: parade the field in from the side before the countdown ---
    if (S.entryT > 0) {
      S.entryT -= dt * S.speed;
      if (S.entryT < 0) S.entryT = 0;
      pumpEntranceTelop();   // the 煽り appears in the 実況 (commentary) as the field parades in
      pumpRollCall();        // ★A-2 入場ロールコール：到着順に1頭ずつ紹介（表示のみ）
      // 入場が終わったら紹介も終了＝名札を必ず片付ける（消し忘れるとレース中ずっと残る・実測）
      if (S.entryT <= 0) S.roll = -1;
      // livestream "いいね" pour in during the entrance — more & faster at higher ranks
      S.likeT -= dt * S.speed;
      const likeIv = 1 / (2.5 + rankHype * 7);
      let guard = 0;
      while (S.likeT <= 0 && guard++ < 12) {
        spawnLike(cw * (0.64 + Math.random() * 0.32), ch * (0.74 + Math.random() * 0.10));
        S.likeT += likeIv;
      }
      return;   // hold at the gate while they walk in; the countdown starts after
    }

    // --- pre-start 3-2-1 countdown: hold τ at the gate, then fire GO ---
    if (S.preT > 0) {
      S.preT -= dt * S.speed;
      pumpEntranceTelop();   // ★カウントダウン中も実況を進める（ここも return するため無言になっていた）
      if (S.preT <= 0) {
        S.preT = 0;
        S.goFlash = 0.85;
        S.shake = Math.max(S.shake, 4);
        spawnSpark(cw / 2, ch * 0.40, "#ffe06a");
        if (window.Sfx) Sfx.play("start");   // スタートの「ドン」
      }
      return;   // the field stays on the line until "GO！"
    }

    // R8-W6d: GOからの経過秒（地面→飛行高度への舞い上がりイージング用・表示のみ）
    if (S.flyIn < 3) S.flyIn += dt * S.speed;

    // ★A-1：GOでテープが弾ける＝光の粒＋急速フェード（ゲート解放の快感）。1度だけ粒を出す。
    if (S.tapeAlpha > 0) {
      if (!S.tapeBurst) {
        S.tapeBurst = true;
        for (let i = 0; i < 6; i++) {
          spawnSpark(startTapeX(), ch * 0.30 + ((ch * 0.92 - ch * 0.30) / 5) * i, "#ffe9a8");   // ★テープと同じ位置で弾ける
        }
      }
      S.tapeAlpha = Math.max(0, S.tapeAlpha - dt * S.speed * 3.2);
    }

    // --- run-through / pull-up: once the winner crosses, advance the global run-out
    // timer and every crossed dragon's coast clock (visProgress reads these to carry
    // them on past the wire). Cut to the result once the lead group has galloped on —
    // we don't wait for the tail-enders. Presentation only; order is already fixed. ---
    for (const dr of dragons) if (S.crossClock[dr.id] != null) S.crossClock[dr.id] += sdt * S.speed;
    if (_winId != null && S.crossClock[_winId] != null && S.crossClock[_winId] >= RUNOUT_DUR && !S.finishedAnnounced) {
      onAllFinished(); return;   // cut to the result once the winner has fully run out (slow-mo)
    }

    const prevTau = S.tau;
    // advance τ at full speed through the wire (goal slow-motion removed — the
    // finish reads as a real gallop-through, then celebration / pull-up behavior)
    let adv = dt * S.speed / timeline.durationSecHint;
    S.tau = Math.min(1, S.tau + adv);

    // --- phase-entry banner: a sweeping caption as the field rolls into a new
    // act of the race (presentation only; cued off the shared race clock) ---
    const phNow = timeline.phaseIndexAt(S.tau);
    if (phNow !== S.phaseShown) {
      S.phaseShown = phNow;
      const lbl = RC_PHASE_BANNERS[phNow];
      if (lbl && S.preT <= 0 && !S.finished) {
        S.banner = { text: lbl, t: 0, max: 1.9 };
        S.zoomBump = Math.min(0.2, (S.zoomBump || 0) + 0.07);
        if (phNow >= 3) S.shake = Math.max(S.shake, 2.5);
      }
    }

    // --- terrain sign: NAME the course feature as the leader rolls into each
    // third (early/mid/late) — tells the watcher outright "ここは 旋回 / 火山" ---
    const leadPnow = timeline.leaderProgressAt(S.tau);
    const third = leadPnow < 1 / 3 ? 0 : leadPnow < 2 / 3 ? 1 : 2;
    if (third !== S.sectionShown && S.preT <= 0 && !S.finished) {
      S.sectionShown = third;
      const tkey = themeKeyAtP(leadPnow), info = rcTerrainInfo(tkey), label = sectionLabelAtP(leadPnow);
      if (label) {
        const dname = STAT_JP[_sectionStat[third]] || "総合力";
        S.terrainSign = { icon: info.icon, label: label, demand: dname + "が問われる", key: tkey, t: 0, max: 2.8 };
        if (info.turn) S.shake = Math.max(S.shake, 1.6);
        // tell the player how THEIR pick fits this section — so the course's effect
        // becomes something they can carry into the next prediction.
        for (const dr of dragons) {
          if (!betSet.has(dr.id)) continue;
          const fit = dragonFitnessAtP(dr.id, leadPnow);
          if (!fit) continue;
          const gp = trackGeom();
          const xx = clamp(screenX(timeline.progressAt(dr.id, S.tau), S._winw || 0.3), cw * 0.12, cw * 0.88);
          const yy = laneY(dr, gp) - 22;
          if (fit > 0) addFloat(xx, yy, dname + "が得意！", "#9bffa0", true);
          else addFloat(xx, yy, dname + "は苦手…", "#9bd4ff", false);
        }
      }
    }

    // detect crossings between prevTau and S.tau
    for (const cr of timeline.crossings) {
      if (!S.crossedSet.has(cr.id) && S.tau >= cr.tau) {
        S.crossedSet.add(cr.id);
        S.crossClock[cr.id] = 0;                                   // begin this dragon's run-through
        S.crossV[cr.id] = Math.max(0.6, timeline.speedAt(cr.id, S.tau));
        const dr = timeline.byId[cr.id];
        const g = trackGeom();
        const gx = screenX(1, S._winw || 0.3);
        const y = laneY(dr, g) - 14;
        addFloat(gx, y, cr.place + "着", cr.place === 1 ? "#ffe06a" : "#cfe6ff", cr.place === 1);
        if (cr.place === 1) {
          S.tapeBroken = true;
          S.shake = Math.max(S.shake, 5);
          spawnSpark(gx, y, "#ffffff");
          addFloat(cw / 2, ch * 0.34, timeline.photoFinish ? "きわどい！" : "テープを切った！", "#fff");
          // R8-W1: 鼻先がゴールした瞬間＝フォトフィニッシュ静止1拍（表示のみ・着順は確定済）
          if (!S.photoUsed) {
            S.photoUsed = true;
            S.photoT = timeline.photoFinish ? 0.62 : 0.38;   // きわどい時は長め＋「写真判定」ラベル
            if (window.Sfx) Sfx.play("tick", 0.55);           // シャッターの一打
          }
        }
      }
    }
    // shout on stumble/surge moments (once each)
    for (const dr of dragons) {
      const ownU = Math.min(1, S.tau / dr.finishTau);
      const prevU = Math.min(1, prevTau / dr.finishTau);
      for (const ev of dr.events) {
        if (ev._shouted) continue;
        if (ev.type === "stumble" && prevU < ev.u && ownU >= ev.u) {
          ev._shouted = true;
          S.shake = Math.max(S.shake, 2.5);
          const gp = trackGeom(); const y = laneY(dr, gp) - 18;
          addFloat(screenX(timeline.progressAt(dr.id, S.tau), S._winw || 0.3), y, "つまずいた！", "#ff9a8a");
          S.pops.push({ x: screenX(timeline.progressAt(dr.id, S.tau), S._winw || 0.3) + 14, y: y - 14, tx: "💫", c: "#fff", t0: performance.now() / 1000, sz: 13 });   // 目回し
        }
        if (ev.type === "surge" && prevU < ev.u && ownU >= ev.u && dr.rank <= 4) {
          ev._shouted = true;
          const gp = trackGeom(); const y = laneY(dr, gp) - 18;
          addFloat(screenX(timeline.progressAt(dr.id, S.tau), S._winw || 0.3), y, "伸びる！", "#aef2b0");
        }
      }
    }

    // --- overtake & close-battle drama (presentation only; order is fixed) ---
    const standNow = timeline.standingsAt(S.tau);
    if (S.overT > 0) S.overT -= dt;
    if (S.prevStand && S.overT <= 0 && S.tau > 0.08 && S.tau < 0.99) {
      for (let i = 0; i < standNow.length; i++) {
        const id = standNow[i], place = i + 1, prevPlace = S.prevStand[id];
        if (prevPlace && place < prevPlace && place <= 4) {
          const dr = timeline.byId[id], gp = trackGeom();
          const xx = screenX(timeline.progressAt(id, S.tau), S._winw || 0.3);
          const yy = laneY(dr, gp) - 20, jump = prevPlace - place, isPick = betSet.has(id);
          const txt = (place === 1) ? "先頭に立った！" : (jump >= 2 ? "ごぼう抜き！" : "かわした！");
          addFloat(xx, yy, txt, isPick ? "#ffd34d" : "#aef2b0", place === 1 || jump >= 2);
          S.overT = 0.5;
          S.zoomBump = Math.min(0.16, (S.zoomBump || 0) + (place === 1 ? 0.12 : 0.08));
          if (place === 1) S.shake = Math.max(S.shake, 2);
          break;   // one callout per beat
        }
      }
    }
    S.prevStand = {}; standNow.forEach((id, i) => { S.prevStand[id] = i + 1; });

    // close battle "接戦！" when the lead pair runs nose-to-nose on the run-in
    if (S.battleT > 0) S.battleT -= dt;
    if (standNow.length >= 2 && S.tau > 0.5 && S.tau < 0.985 && S.battleT <= 0) {
      const gapTop = timeline.progressAt(standNow[0], S.tau) - timeline.progressAt(standNow[1], S.tau);
      if (gapTop < 0.012) {
        addFloat(cw / 2, ch * 0.30, "接戦！", "#ffffff", true);
        S.battleT = 1.8;
        S.zoomBump = Math.min(0.18, (S.zoomBump || 0) + 0.06);
      }
    }

    // --- "三つ巴！" — the field has thinned and the lead trio is fighting it out
    // nose-to-nose into the wire (fires once at the climax; presentation only) ---
    if (!S.trioShown && (S._focusT || 0) > 0.7 && S.tau < 0.99 && standNow.length >= 4) {
      const p1 = timeline.progressAt(standNow[0], S.tau);
      const p3 = timeline.progressAt(standNow[2], S.tau);
      const p4 = timeline.progressAt(standNow[3], S.tau);
      // top-3 bunched AND clearly broken away from 4th → a genuine three-horse duel
      if ((p1 - p3) < 0.055 && (p3 - p4) > 0.02) {
        S.trioShown = true;
        S.banner = { text: "三つ巴！", t: 0, max: 2.1 };
        addFloat(cw / 2, ch * 0.30, "３頭、横一線！", "#ffe06a", true);
        S.shake = Math.max(S.shake, 4);
        S.zoomBump = Math.min(0.24, (S.zoomBump || 0) + 0.13);
      }
    }

    // --- cheer for the player's pick (situation-aware encouragement) ---
    if (S.cheerT > 0) S.cheerT -= dt;
    if (pickId && S.cheerT <= 0 && S.tau > 0.12 && S.tau < 0.97) {
      const dr = timeline.byId[pickId];
      if (dr) {
        const cheerPick = a => a[(Math.random() * a.length) | 0];
        const place = standNow.indexOf(pickId) + 1;
        const myP = timeline.progressAt(pickId, S.tau);
        const gap = timeline.leaderProgressAt(S.tau) - myP;
        let msg;
        if (place === 1) msg = cheerPick(["そのまま！", "逃げ切れ！", "行け行け！"]);
        else if (gap < 0.02) msg = cheerPick(["差せ！", "前へ！", "あと少し！"]);
        else if (gap < 0.06) msg = cheerPick(["がんばれ！", "食らいつけ！", "まだいける！"]);
        else msg = cheerPick(["あきらめないで！", "ここから！", "盛り返せ！"]);
        const gp = trackGeom();
        addFloat(screenX(myP, S._winw || 0.3), laneY(dr, gp) - 24, msg, "#ffd34d", false);
        S.cheerT = 2.4 + Math.random() * 1.3;
      }
    }

    pumpTelop();

    // safety net only: the run-out block ends the race after the winner crosses.
    // This catches the degenerate case where no winner-crossing was ever detected.
    if (S.tau >= 1 && !S.tapeBroken && !S.finishedAnnounced) onAllFinished();
  }

  function onAllFinished() {
    S.finished = true;
    S.finishedAnnounced = true;
    S.shake = Math.max(S.shake, 4);
    // ★決め台詞を必ず言い切る。
    //   ゴール直前の一言（「セラムが上がった、4番手！」など）を出したまま
    //   実況が止まってしまっていた（ユーザー指摘）。原因は、勝者が走り切った
    //   瞬間にここへ直接飛ぶ経路があり、テロップを進める処理を通らないため。
    //   τ の到達に頼らず、決着したこの場で残りを吐き出す。
    flushTelop();
    // celebration! confetti rain + a triple firework over the winner's line
    if (!S.celebrated) {
      S.celebrated = true;
      S.confettiT = 1.5;
      S.rewardT = 0;            // restart the reward pop-in
      // ゴール演出：観客の歓声を鳴らし続け（結果を見るまでループ）＋ BGMを3秒フェードアウト（勝敗不問）
      if (window.Sfx && Sfx.startCrowd) Sfx.startCrowd();
      if (window.RaceBgm) RaceBgm.fadeOut(3000);
      spawnConfetti(90);
      spawnFirework(cw * 0.50, ch * 0.32, "#ffe06a");
      spawnFirework(cw * 0.30, ch * 0.42, "#ff7aa0");
      spawnFirework(cw * 0.70, ch * 0.42, "#7fd1ff");
      // an extra pop when the player's bet lands
      const _betHit = computeBetHit();
      if (_betHit === true) {
        spawnConfetti(60);
        spawnFirework(cw * 0.50, ch * 0.50, "#8df0a6");
      }
      // goal-moment reward sound (spec #37) — synthesized, mutable, no files
      try {
        if (window.Sfx && betResult) {
          if (betResult.hit) {
            const _t = (typeof resultTierOf === "function") ? resultTierOf(betResult)
              : (betResult.odds >= 7 ? 3 : betResult.odds >= 3 ? 2 : 1);
            Sfx.play(_t >= 3 ? "legendary" : _t >= 2 ? "bigwin" : "win");
          } else { Sfx.play("miss"); }
        }
      } catch (e) {}
    }
    playBtn.style.display = "none";
    renderControls();
    renderFinishStrip();
  }

  // =====================================================================
  // LOOP
  // =====================================================================
  function frame(now) {
    if (!RC_ACTIVE || RC_ACTIVE.id !== loopId) return;        // superseded
    if (state.ui.screen !== "race_run") { stopRacePlayer(); return; }
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    // R8-W5: 低速機の自動検知——実フレーム間隔の移動平均が40ms超（<25fps）を2秒続けたら
    // 縮退モードに固定（レース中は戻さない＝ちらつき防止）。タブ復帰等の巨大間隔は無視。
    // window.__rcLowSpec = true で強制（デバッグ用レバー・表示のみ）。
    const rawMs = now - (S.last || now);
    if (!S.lowSpec) {
      if (window.__rcLowSpec) S.lowSpec = true;
      else if (S.last && rawMs > 0 && rawMs < 500) {
        S._fpsAvg = S._fpsAvg == null ? rawMs : S._fpsAvg * 0.9 + rawMs * 0.1;
        if (S._fpsAvg > 40) { S._slowT = (S._slowT || 0) + rawMs; if (S._slowT > 2000) S.lowSpec = true; }
        else S._slowT = 0;
      }
    }
    S.last = now;
    update(dt);
    draw();
    S.raf = requestAnimationFrame(frame);
  }

  // =====================================================================
  // CONTROLS
  // =====================================================================
  function renderControls() {
    controlsEl.innerHTML = "";
    if (!S.finished) {
      // segmented speed control — tap a rate directly (clearer than cycling),
      // so 2× / 3× fast-forward is one obvious tap away.
      const grp = el("div", "rc-speedgrp");
      grp.appendChild(el("span", "rc-ctl-label", "速度"));
      const seg = el("div", "rc-speedseg");
      [1, 2, 3].forEach(v => {
        const b = el("button", "rc-spd" + (S.speed === v ? " on" : ""), v + "×");
        b.onclick = () => { S.speed = v; renderControls(); };
        seg.appendChild(b);
      });
      grp.appendChild(seg);
      controlsEl.appendChild(grp);
      // prominent skip — jump straight to the result whenever the player wants
      const skip = makeBtn("⏭ スキップ", () => { stopRacePlayer(); if (typeof renderResult === "function") renderResult(); }, { secondary: true });
      skip.classList.add("rc-skip");
      controlsEl.appendChild(skip);
    }
    controlsEl.appendChild(makeBtn("📜 全ログ", () => {
      S.showLog = !S.showLog;
      logEl.style.display = S.showLog ? "" : "none";
      if (S.showLog) renderLog();
    }, { secondary: true }));
    // 音声操作は全画面共通の🔊FAB（右下）へ一本化——ボタン二重のUX混乱を解消（ユーザー指摘）。
    // ミュート/音量は showVolumePanel が担い、BGM復帰は RaceBgm.setMuted(false) が面倒を見る。
    if (S.finished) {
      // ★ゴール後の主役CTA。CSSは .rc-next で狙う（:last-child依存は全ログ等の追加で壊れる）
      const nx = makeBtn("結果を見る ▶", () => { stopRacePlayer(); if (typeof renderResult === "function") renderResult(); });
      nx.classList.add("rc-next");
      controlsEl.appendChild(nx);
    }
  }
  function renderLog() {
    logEl.innerHTML = "";
    (broadcast.phases || []).forEach((p, i) => {
      logEl.appendChild(el("div", "log-phase", `【${p.label} ${p.sectionName}】`));
      ((commentary[i] && commentary[i].lines) || []).forEach(line => logEl.appendChild(el("div", "log-line", line)));
    });
  }
  function renderFinishStrip() {
    finishStripEl.style.display = "";
    const cr0 = timeline.crossings[0];                       // 勝者を大きく掲示（DOMのみ・数値は不変）
    const winHit = cr0 && betSet.has(cr0.id);
    let html = cr0
      ? `<div class="rc-fs-winner ${winHit ? "t" : ""}"><span class="rc-fs-tro">🏆</span><span class="rc-fs-wlbl">1着</span><b>${commentaryName(cr0.id)}</b>${winHit ? '<span class="rc-fs-hit">🎯的中</span>' : ""}</div>`
      : "";
    html += `<div class="rc-fs-title">着順</div>`;
    timeline.crossings.forEach(cr => {
      const isT = betSet.has(cr.id);
      html += `<div class="rc-fs-row ${isT ? "t" : ""}"><b>${cr.place}</b> ${commentaryName(cr.id)}${isT ? " 🎯" : ""}</div>`;
    });
    finishStripEl.innerHTML = html;
    // ★D1：ゴール確定に合わせてボード上位3行を金銀銅で固める（結果画面への視覚的な橋渡し）
    freezeBoardPodium(timeline.crossings.map(cr => cr.id));
    // ★B-5 ゴール後のエモート：1着に💕連発・2/3着に👏（既存 S.pops の流儀・popCd間引き不要の一発）
    try {
      const _nw5 = performance.now() / 1000;
      timeline.crossings.slice(0, 3).forEach((cr, i) => {
        const em = i === 0 ? "💕" : "👏";
        const n = i === 0 ? 3 : 1;
        for (let k = 0; k < n; k++) {
          S.pops.push({ x: cw * (0.42 + i * 0.14) + k * 12, y: ch * (0.46 + k * 0.05),
            tx: em, c: "#fff", t0: _nw5 + i * 0.15 + k * 0.12, sz: i === 0 ? 17 : 13 });
        }
      });
    } catch (e) {}
    // ★ゴール後の状態へ切り替える（ユーザー指摘：走行中の賑やかさが鳴り止まないと不自然）。
    //   ①LIVE→中継終了 ②同接カウンタは伸びを止めて確定値で固定 ③観客はスタンディングで1度だけ沸き、
    //   以後は静止 ④視聴者コメントは「余韻」プールへ切替 ⑤盤面をゴール後モードに（着順は畳む）。
    // ゴールの合図＝デザイン済みの帯（赤橙グラデ＋スケールイン）。これが本編の見出し。
    const gb = wrap.querySelector("#rc-goalband");
    if (gb) { gb.hidden = false; gb.classList.remove("show"); void gb.offsetWidth; gb.classList.add("show"); }
    const lv = wrap.querySelector("#rc-live");
    if (lv) lv.classList.add("ended");
    const crowdGlow = wrap.querySelector(".rc-crowdglow");
    if (crowdGlow) {
      crowdGlow.classList.remove("is-standing");
      void crowdGlow.offsetWidth;
      crowdGlow.classList.add("is-standing");
    }
    wrap.classList.add("rc-ended");     // CSS側でゴール後レイアウトに切替（着順を畳む・操作を主役に）
    _goalChatLeft = 3;                  // 余韻コメントを3本だけ流して打ち止め
    chatNextAt = 0;
  }

  playBtn.onclick = () => {
    S.playing = !S.playing;
    playBtn.textContent = S.playing ? "⏸" : "▶";
  };

  renderControls();
  buildBoard();     // ★D1：行DOMを一度だけ生成（以後は並び替えと差分更新のみ）

  // =====================================================================
  // controller
  // =====================================================================
  const loopId = Symbol("rc");
  const controller = {
    id: loopId,
    stop() {
      if (S.raf) cancelAnimationFrame(S.raf);
      S.raf = null;
      window.removeEventListener("resize", onResize);
    },
    // Pause and jump to a normalized race time (0..1). Used by the replay
    // scrubber / verification; settles the eased camera so the static frame is
    // framed correctly.
    seek(t) {
      S.playing = false;
      if (playBtn) playBtn.textContent = "▶";
      S.countdown = 0;
      // skip the start ceremony when scrubbing; re-baseline standings so resuming
      // play doesn't fire a phantom overtake callout on the first frame
      S.preT = 0; S.goFlash = 0; S.prevStand = null;
      S.tau = Math.max(0, Math.min(1, t));
      // don't replay a phase banner from a scrub; re-baseline the phase marker
      S.banner = null; S.phaseShown = timeline.phaseIndexAt(S.tau);
      // Rebuild all presentation/ceremony state from the target time so that
      // scrubbing — including *backward* from a finished race — shows a faithful
      // frame (no stuck finish overlay) and replays callouts cleanly. Order is
      // fixed by the timeline; this only touches visuals.
      S.floats = [];
      S.overT = 0;
      // ★スタート整列と対：flyIn（地面→飛行の離陸イージング）と entryT（入場パレード）も
      //   スクラブ位置に同期。両方 update() でしか進まないため、入場中に seek すると
      //   入場ウォークの巨大なdxオフセット(-46%cw)が乗ったまま＝全員が左端に団子で描かれる
      //   （駒送り検証で顕在化・実測）。scrub先は常に「レース本編」なので入場は終了扱いにする。
      S.entryT = 0;
      S.flyIn = S.tau > 0.01 ? 3 : 0;
      // ★A-1/A-2：発走テープとロールコールもスクラブ位置に同期（GO後はテープ無し・紹介終了）
      S.tapeAlpha = S.tau > 0.01 ? 0 : 1; S.tapeBurst = S.tau > 0.01;
      S.roll = -1;
      S.crossedSet = new Set(timeline.crossings.filter(c => S.tau >= c.tau).map(c => c.id));
      const _winCross = timeline.crossings.find(c => c.place === 1);
      S.tapeBroken = !!(_winCross && S.tau >= _winCross.tau);
      // run-through state, reconstructed from the scrubbed time: each crossed dragon
      // has been coasting past the wire since its OWN crossing (presentation only).
      S.crossClock = {}; S.crossV = {};
      for (const cr of timeline.crossings) {
        if (S.tau >= cr.tau) {
          S.crossClock[cr.id] = clamp((S.tau - cr.tau) * timeline.durationSecHint, 0, RUNOUT_DUR);
          S.crossV[cr.id] = Math.max(0.6, timeline.speedAt(cr.id, cr.tau));
        }
      }
      const _wid = _winCross ? _winCross.id : null;
      const _done = S.tau >= 1 || (_wid != null && S.crossClock[_wid] != null && S.crossClock[_wid] >= RUNOUT_DUR);
      S.finished = _done; S.finishedAnnounced = _done; S.celebrated = _done; S.confettiT = 0;
      S.trioShown = false;   // re-arm the "三つ巴！" callout for a forward replay
      S.terrainSign = null;  // baseline the terrain sign to the scrubbed-to section
      { const _lp = timeline.leaderProgressAt(S.tau); S.sectionShown = _lp < 1 / 3 ? 0 : _lp < 2 / 3 ? 1 : 2; }
      // re-arm per-dragon stumble/surge shouts so already-passed ones stay quiet
      // and still-upcoming ones can fire again on a forward replay
      for (const dr of dragons) {
        const ownU = dr.finishTau ? Math.min(1, S.tau / dr.finishTau) : 1;
        for (const ev of dr.events) ev._shouted = ownU >= ev.u;
      }
      // ★D1：スクラブ先が「決着後」なら生着順ボードも確定表示（金銀銅）に、戻したら解除。
      //   seek は onAllFinished を通らず状態を直接組み直す設計なので、ボードもここで揃える
      //   （そうしないと最後まで飛ばした時にボードだけ走行中の顔のまま残る）。
      if (_done) freezeBoardPodium(timeline.crossings.map(cr => cr.id));
      else unfreezeBoardPodium();
      // ★LIVE徽章・観客・ゴール後レイアウトもスクラブ位置に合わせる（戻したら中継中の顔に戻す）
      { const gb = wrap.querySelector("#rc-goalband"), lv = wrap.querySelector("#rc-live"), crowdGlow = wrap.querySelector(".rc-crowdglow");
        if (gb) { gb.hidden = !_done; if (!_done) gb.classList.remove("show"); }
        if (lv) lv.classList.toggle("ended", _done);
        if (crowdGlow) crowdGlow.classList.toggle("is-standing", _done);
        wrap.classList.toggle("rc-ended", _done);
        if (viewersEl) { viewersEl.classList.toggle("fixed", _done); if (!_done) viewersEl._fixed = false; }
        if (!_done) { chatGoalDone = false; _goalChatLeft = 0; } }
      // ★ゆっくり実況もスクラブ位置へ同期。seek は update() を通らないため pumpTelop が
      //   走らず、駒送りすると二人の吹き出しが入場時の台詞のまま固まる（実測で確認）。
      //   スクラブ先までの行を「もう喋った」ことにして、左右それぞれ最後の一言を復元する。
      try {
        shownLines.length = 0;
        _said.call.length = 0; _said.color.length = 0;   // 2行バッファも巻き戻す（前の行が残らないように）
        telopSchedule.forEach(t => {
          t.fired = S.tau >= t.tau;
          if (t.fired) shownLines.push({ line: t.line, side: t.side });
        });
        // ★左右それぞれ「直近2行」を復元する（1行だけ渡すと駒送り後だけ薄くなる）。
        const lastNOf = (sd, n) => {
          const out = [];
          for (let i = shownLines.length - 1; i >= 0 && out.length < n; i--) {
            if ((shownLines[i].side === "color") === (sd === "color")) out.unshift(shownLines[i].line);
          }
          return out;
        };
        lastNOf("call", 2).forEach(s => speak("call", s));
        lastNOf("color", 2).forEach(s => speak("color", s));
        const last = shownLines[shownLines.length - 1];
        if (last) speak(last.side, last.line);   // 最後に喋った側を前面へ
      } catch (e) {}
      renderControls();   // スクラブ先が決着後なら「結果を見る」を出す（seekはonAllFinishedを通らない）
      for (let i = 0; i < 80; i++) updateCamera();
      draw();
    }
  };
  RC_ACTIVE = controller;
  state.current.racePlayer = controller;

  S.last = performance.now();
  S.raf = requestAnimationFrame(frame);
  return controller;
}
