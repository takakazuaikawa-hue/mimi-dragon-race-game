// =========================================================================
// ✨ ミニアニメ（G3-4）＝「ここぞ」の瞬間に2〜3秒だけ光が乗る演出レイヤー
//   docs/GENERATIVE_3D_RPG_DIRECTIVE §4 G3-4。差し込み先は3つ：
//     ・傑作☆3が出た瞬間（photo_game.js）
//     ・モール屋上を制覇した瞬間（mall_rpg.js）
//     ・習い事が開花した瞬間（field_lessons.js）
//
//   ★作りの芯
//   - 素材は**真っ黒の背景に光だけ**が動く動画。これを `mix-blend-mode: screen` で重ねる＝
//     黒は透け、光だけが乗る。アルファ付き動画（webm alpha）の端末差に悩まされない。
//   - 動画が無い／読めない／再生できない／prefers-reduced-motion なら**何も出さない**。
//     つまり演出が落ちても本編は一切変わらない（表示専用・数値不変）。
//   - 同時に1本だけ。連打しても重ならない。
// =========================================================================
(function () {
  if (typeof window === "undefined") return;

  var V = "20260728a";
  // ★形式は mp4/H.264。指示書は webm 指定だったが、この環境に変換器（ffmpeg）が無く、
  //   かつ **iOS Safari は webm の対応が怪しい**＝mp4 の方が実機で確実に鳴らせる。
  //   src は「その瞬間が来て初めて」入れる＝初回読み込みには一切乗らない。
  var CLIPS = {
    masterpiece: "images/fx/clip_masterpiece.mp4",   // 傑作☆3＝フラッシュと金の粒
    conquer:     "images/fx/clip_conquer.mp4",       // 屋上制覇＝紙吹雪と光の筋
    bloom:       "images/fx/clip_bloom.mp4",         // 開花＝光の花がほどける
  };

  var reduce = false;
  try { reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}

  var cur = null;

  // now=true は即時撤去（新しいのを出す前に使う）。既定はふわっと消す。
  function clear(now) {
    cur = null;
    var list = document.querySelectorAll(".mc-fx");
    for (var i = 0; i < list.length; i++) {
      (function (n) {
        if (now) { if (n.parentNode) n.parentNode.removeChild(n); return; }
        n.classList.remove("on");
        setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 420);
      })(list[i]);
    }
  }

  // kind: masterpiece / conquer / bloom
  // opts: { ms=2600, scope=DOM要素（省略時は画面全体） }
  function play(kind, opts) {
    opts = opts || {};
    var src = CLIPS[kind];
    if (!src || reduce) return false;
    clear(true);                                   // 前のは即どかす＝連打しても光が二重に乗らない

    var wrap = document.createElement("div");
    wrap.className = "mc-fx mc-fx--" + kind + (opts.scope ? " mc-fx--scoped" : "");
    var v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.autoplay = true; v.loop = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.src = src + "?v=" + V;
    wrap.appendChild(v);

    var host = opts.scope || document.body;
    host.appendChild(wrap);
    cur = wrap;

    var ok = false;
    v.addEventListener("canplay", function () { ok = true; wrap.classList.add("on"); }, { once: true });
    v.addEventListener("error", function () { if (cur === wrap) clear(); }, { once: true });
    // 自動再生が拒否されたら黙って引っ込む（音は無いので通常は通る）
    try { var p = v.play(); if (p && p.catch) p.catch(function () { if (cur === wrap) clear(); }); } catch (e) {}
    // 読めないまま時間切れなら片付ける＝黒い四角が残らない
    setTimeout(function () { if (!ok && cur === wrap) clear(); }, 1200);
    setTimeout(function () { if (cur === wrap) clear(); }, Math.max(800, opts.ms || 2600));
    return true;
  }

  window.MiniClip = { play: play, clear: clear, clips: CLIPS };
})();
