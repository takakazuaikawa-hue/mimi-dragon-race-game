// =========================================================================
// 🔄 ずかんの回転ビューア（G3-6）
//   docs/GENERATIVE_3D_RPG_DIRECTIVE §4 G3-6。
//   ★`<model-viewer>` は外部CDNが要るので使えない（classicスクリプト構成／Pages配信）。
//     指示書どおり **自前の簡易回転ビルボード** で代替する。
//
//   コマの出所は問わない設計：
//     images/rpg/turn/<id>.webp ＝ 横に並べた回転コマ（1コマは正方形。枚数は幅÷高さで自動判定）
//   ↑が無ければ **1枚絵（en_*.webp）を大きく見せるだけ**に自動で落ちる。
//   つまり回転素材があるものは回り、無いものもちゃんと図鑑として成立する。
//
//   表示専用。ずかんの収集状況・弱点・報酬には一切触れない。
// =========================================================================
(function () {
  if (typeof window === "undefined") return;

  var V = "20260728a";
  var TURN_DIR = "images/rpg/turn/";
  var cache = {};                  // id -> {img, frames} / null

  function reduce() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }

  // 回転コマの読み込み（無ければ null＝1枚絵にフォールバック）
  function loadTurn(id, cb) {
    if (cache[id] !== undefined) { cb(cache[id]); return; }
    var im = new Image();
    im.decoding = "async";
    im.onload = function () {
      if (!im.naturalWidth || !im.naturalHeight) { cache[id] = null; cb(null); return; }
      var n = Math.max(1, Math.round(im.naturalWidth / im.naturalHeight));
      cache[id] = { img: im, frames: n, cell: im.naturalHeight };
      cb(cache[id]);
    };
    im.onerror = function () { cache[id] = null; cb(null); };
    im.src = TURN_DIR + id + ".webp?v=" + V;
  }

  function close() {
    var n = document.getElementById("dex-view");
    if (!n) return;
    n.classList.remove("on");
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 240);
  }

  function open(id) {
    if (typeof RPG_MONS === "undefined" || !RPG_MONS[id]) return false;
    var m = RPG_MONS[id];
    close();

    var ov = document.createElement("div");
    ov.id = "dex-view"; ov.className = "dexv";
    ov.innerHTML =
      '<div class="dexv-bd"></div>' +
      '<div class="dexv-card">' +
        '<div class="dexv-stage"><canvas class="dexv-cv"></canvas>' +
          '<div class="dexv-hint">← ドラッグでまわす →</div></div>' +
        '<div class="dexv-name"><span class="dexv-ic">' + (m.ic || "👾") + "</span><b>" + (m.n || "？？？") + "</b></div>" +
        '<div class="dexv-meta"></div>' +
        '<button class="dexv-close">とじる</button>' +
      "</div>";
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("on"); });

    ov.querySelector(".dexv-bd").onclick = close;
    ov.querySelector(".dexv-close").onclick = close;

    // 弱点は「戦って判明した分だけ」出す＝図鑑の約束を崩さない
    try {
      var d = (typeof rpgData === "function") ? rpgData() : null;
      var seen = d && d.codex && d.codex[id];
      var w = (seen && seen.weak && seen.weak.length && typeof RPG_ELEM_IC !== "undefined")
        ? seen.weak.map(function (e) { return RPG_ELEM_IC[e]; }).join("") : "？";
      ov.querySelector(".dexv-meta").textContent = "弱点 " + w;
    } catch (e) {}

    var cv = ov.querySelector(".dexv-cv");
    var ctx = cv.getContext("2d");
    var turn = null, still = null, frame = 0, spin = reduce() ? 0 : 0.22, drag = null, raf = 0;

    still = (typeof rpgEnemyArt === "function") ? rpgEnemyArt(id) : null;
    if (!still && typeof RPG_ENEMY_IMG !== "undefined" && RPG_ENEMY_IMG[id]) {
      still = new Image(); still.src = "images/rpg/" + RPG_ENEMY_IMG[id] + ".webp";
    }
    loadTurn(id, function (t) {
      turn = t;
      var hint = ov.querySelector(".dexv-hint");
      if (!turn && hint) hint.style.display = "none";     // 回らないものに「まわす」とは言わない
      render();                                          // 素材が届いた瞬間にも1枚
    });

    function fit() {
      var r = cv.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      return { w: w, h: h, dpr: dpr };
    }

    // 1コマ描く。★rAF に頼らず「開いた瞬間」と「素材が届いた瞬間」にも必ず呼ぶ。
    //   タブが裏だと rAF は止まるので、これが無いと空のキャンバスが出たままになる（実機で確認）。
    function render() {
      if (!document.getElementById("dex-view")) return;
      var s = fit();
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      if (turn) {
        if (drag === null && spin) frame = (frame + spin) % turn.frames;
        var i = ((Math.round(frame) % turn.frames) + turn.frames) % turn.frames;
        var side = Math.min(s.w, s.h);
        ctx.drawImage(turn.img, i * turn.cell, 0, turn.cell, turn.cell,
          (s.w - side) / 2, (s.h - side) / 2, side, side);
      } else if (still && still.complete && still.naturalWidth) {
        var sd = Math.min(s.w, s.h) * 0.94;
        ctx.drawImage(still, (s.w - sd) / 2, (s.h - sd) / 2, sd, sd);
      }
    }
    function tick() { raf = 0; if (!document.getElementById("dex-view")) return; render(); raf = requestAnimationFrame(tick); }
    render();                                   // 開いた瞬間に1枚
    raf = requestAnimationFrame(tick);
    if (still && !still.complete) still.addEventListener("load", render, { once: true });

    // ドラッグで回す（回転素材があるときだけ）
    function down(e) { if (!turn) return; drag = { x: (e.touches ? e.touches[0].clientX : e.clientX), f: frame }; }
    function move(e) {
      if (drag === null || !turn) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      var r = cv.getBoundingClientRect();
      frame = drag.f + (x - drag.x) / Math.max(40, r.width) * turn.frames * 1.6;
      render();                                   // 指の動きに即その場で追従（rAF待ちにしない）
      if (e.cancelable) e.preventDefault();
    }
    function up() { drag = null; }
    cv.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    ov.addEventListener("DOMNodeRemoved", function () {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    });
    return true;
  }

  window.DexView = { open: open, close: close, dir: TURN_DIR };
})();
