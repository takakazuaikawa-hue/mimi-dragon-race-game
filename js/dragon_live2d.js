/**
 * dragon_live2d.js — ゲーム内で「Live2Dリグ竜」を任意canvasに描画するブリッジ。
 * =========================================================================
 * ツール(live2d/)で作った images/dragon_ref/dragon_rig.json（頭/胴/翼/尾の4パーツ＋
 * 羽ばたき/尾揺れ/呼吸のアイドル）を、L2ランタイム(util/rig/player)で再生する。
 * マスコット（ホーム/レース）で使用。L2が無い/リグ取得失敗時は従来の startDragonWarp に
 * 自動フォールバック。表示専用＝レースの着順/オッズ/配当には一切非干渉。
 *
 * 依存：live2d/js/util.js(L2_UTIL)・rig.js(L2_RIG)・player.js(L2_PLY)（index.htmlで先に読込）。
 */
(function (global) {
  "use strict";

  var _rigPromise = null;   // リグは一度だけ取得＋hydrate（4パーツのbase64画像を復号）してキャッシュ

  function loadRig() {
    if (_rigPromise) return _rigPromise;
    if (typeof L2_RIG === "undefined") return Promise.reject(new Error("L2_RIG missing"));
    _rigPromise = fetch("images/dragon_ref/dragon_rig.json")
      .then(function (r) { if (!r.ok) throw new Error("rig http " + r.status); return r.text(); })
      .then(function (t) { return L2_RIG.hydrate(L2_RIG.deserialize(t)); });
    return _rigPromise;
  }

  // canvas にリグ竜をマウント。指定 screen から離脱／canvasがDOMから外れたら自動停止（リーク防止）。
  function mount(canvas, opts) {
    opts = opts || {};
    var ctrl = L2_PLY.createController(canvas, { zoom: opts.zoom || 0.96, bg: opts.bg || null });
    var screen = opts.screen, stopped = false, guard = 0;
    loadRig().then(function (rig) {
      if (stopped || !document.contains(canvas)) return;
      ctrl.setRig(rig); ctrl.start();
      guard = setInterval(function () {
        var ok = document.contains(canvas) && (!screen || typeof state === "undefined" || !state.ui || state.ui.screen === screen);
        if (!ok) { try { ctrl.stop(); } catch (e) {} stopped = true; clearInterval(guard); }
      }, 700);
    }).catch(function (e) { if (opts.onError) opts.onError(e); });
    return { stop: function () { stopped = true; try { ctrl.stop(); } catch (e) {} if (guard) clearInterval(guard); } };
  }

  // まずリグ竜を試し、ランタイム無し/失敗なら従来のソフトボディwarpへフォールバック。
  function mountOrWarp(canvas, imgSrc, screen, zoom) {
    if (typeof L2_RIG !== "undefined" && typeof L2_PLY !== "undefined") {
      return mount(canvas, { screen: screen, zoom: zoom, onError: function () { _warp(canvas, imgSrc, screen); } });
    }
    _warp(canvas, imgSrc, screen);
    return null;
  }
  function _warp(canvas, imgSrc, screen) {
    if (typeof startDragonWarp !== "function") return;
    var im = new Image();
    im.onload = function () { startDragonWarp(canvas, im, screen); };
    im.onerror = function () { im.onerror = function () {}; im.src = (imgSrc || "images/dragon_ref/ref.webp").replace(".webp", ".png"); };
    im.src = imgSrc || "images/dragon_ref/ref.webp";
  }

  global.DragonL2 = { loadRig: loadRig, mount: mount, mountOrWarp: mountOrWarp };
})(window);
