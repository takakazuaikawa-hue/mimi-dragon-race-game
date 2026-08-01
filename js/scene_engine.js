// =========================================================================
// 🎬 共通シーン基盤（docs/scene_engine_and_mall_redesign.md §1 のAPIスケッチどおり）
//   外部ライブラリ無し・canvas 1枚・classicスクリプト構成・自己完結。
//
//   責務（設計書 §1）
//   - <canvas> をコンテナにフィット（DPR対応・上限2倍でスマホ負荷を抑制）
//   - 固定タイムステップ更新＋描画（rAF）。タブ非表示で停止
//   - レイヤ描画：bgFar / bgMid / bgNear → world（アクター・zソート）→ fg → ui
//   - 入力層：pointer/tap → ワールド座標。スマホ用のオンスクリーン十字キーは ui レイヤに
//   - 宣言的マニフェストの遅延ロード（入場でDL・退場で破棄）
//   - prefers-reduced-motion で演出を自動的に控えめへ
//
//   ★状態は持たない（設計書 §1）：進行・報酬は各ゲームの state.player.* が真実。
//     基盤は描画と入力だけを担当する＝レース数値には構造的に触れない。
// =========================================================================
(function () {
  if (typeof window === "undefined") return;

  var LAYERS = ["bgFar", "bgMid", "bgNear", "world", "fg", "ui"];

  function reduceMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }

  // ── 宣言的マニフェストのロード（images のみ。SEは sfx.js の合成／BGMは bgm.js）
  function loadAssets(manifest, onProgress) {
    var imgs = (manifest && manifest.images) || {};
    var keys = Object.keys(imgs), out = {}, done = 0;
    if (!keys.length) return Promise.resolve(out);
    return new Promise(function (resolve) {
      keys.forEach(function (k) {
        var im = new Image();
        im.decoding = "async";
        var fin = function (ok) {
          out[k] = ok ? im : null;                 // 欠損は null＝呼び出し側がフォールバックできる
          done++;
          if (onProgress) { try { onProgress(done / keys.length); } catch (e) {} }
          if (done === keys.length) resolve(out);
        };
        im.onload = function () { fin(im.naturalWidth > 0); };
        im.onerror = function () { fin(false); };
        im.src = imgs[k];
      });
    });
  }

  // ── Actor：{x,y,z, draw(ctx,cam), update(dt)}。zで奥から手前へ並べる（設計書 §1）
  function makeActor(o) {
    o = o || {};
    return {
      x: o.x || 0, y: o.y || 0, z: (o.z != null ? o.z : (o.y || 0)),
      w: o.w || 0, h: o.h || 0,
      sprite: o.sprite || null, anim: o.anim || null, data: o.data || {},
      draw: o.draw || null, update: o.update || null, dead: false,
    };
  }

  var Scene = {
    LAYERS: LAYERS,
    reduceMotion: reduceMotion,
    actor: makeActor,

    create: function (opts) {
      opts = opts || {};
      var mount = opts.mount;
      if (!mount) return null;

      var wrap = document.createElement("div");
      wrap.className = "sc-stage";
      var cv = document.createElement("canvas");
      cv.className = "sc-canvas";
      wrap.appendChild(cv);
      mount.appendChild(wrap);

      var ctx = cv.getContext("2d");
      var S = {
        canvas: cv, wrap: wrap, ctx: ctx,
        assets: {}, actors: [], ready: false, dead: false,
        camera: { x: 0, y: 0, w: 0, h: 0 },
        input: { up: 0, down: 0, left: 0, right: 0, act: 0 },
        vw: 0, vh: 0, dpr: 1,
        reduce: reduceMotion(),
        fps: 0,
      };

      // ── サイズ合わせ（DPR上限2＝スマホ負荷を抑える／設計書 §6）
      function fit() {
        var r = wrap.getBoundingClientRect();
        var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        var dpr = Math.min(2, (window.devicePixelRatio || 1));
        if (S.vw === w && S.vh === h && S.dpr === dpr) return;
        S.vw = w; S.vh = h; S.dpr = dpr;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        S.camera.w = w; S.camera.h = h;
      }
      S.fit = fit;

      // ── 入力：キーボード＋オンスクリーン十字キー（uiレイヤ相当のDOM）
      var KEY = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", " ": "act", Enter: "act" };
      function onKey(e) {
        var k = KEY[e.key];
        if (!k) return;
        S.input[k] = (e.type === "keydown") ? 1 : 0;
        if (k === "act" && e.type === "keydown" && opts.onAct) { try { opts.onAct(); } catch (er) {} }
        e.preventDefault();
      }
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);

      var pad = document.createElement("div");
      pad.className = "sc-pad";
      pad.innerHTML =
        '<div class="sc-dpad">' +
        '<button class="sc-d up" data-k="up" aria-label="上へ">▲</button>' +
        '<button class="sc-d left" data-k="left" aria-label="左へ">◀</button>' +
        '<button class="sc-d right" data-k="right" aria-label="右へ">▶</button>' +
        '<button class="sc-d down" data-k="down" aria-label="下へ">▼</button>' +
        "</div>" +
        '<button class="sc-act" data-k="act" aria-label="しらべる">🔍</button>';
      wrap.appendChild(pad);
      S.pad = pad;

      // ★タップの最短押し時間（2026-08-01・自分で歩いて見つけた不具合）。
      //   pointerdown で1・pointerup で0にしていたので、軽くタップすると**その間に1フレームも
      //   挟まらず、1歩も動かなかった**（実測：方向キーを2回叩いて歩数0）。
      //   指を置いて動かす操作は成立していたが、「とんとん」と押す遊び方が無反応だった。
      //   離しても最低 PAD_MIN_MS だけ入力を保つ＝1タップでほぼ1マス進む（330px/秒 × 0.18秒 ≈ 59px、1マス60px）。
      var PAD_MIN_MS = 180;
      var padAt = {};
      function padRelease(k, b) {
        S.input[k] = 0;
        if (b) b.classList.remove("on");
      }
      function padDown(e) {
        var b = e.target.closest("[data-k]"); if (!b) return;
        var k = b.getAttribute("data-k");
        e.preventDefault();
        if (k === "act") { if (opts.onAct) { try { opts.onAct(); } catch (er) {} } return; }
        S.input[k] = 1; b.classList.add("on");
        padAt[k] = (window.performance && performance.now) ? performance.now() : 0;
      }
      function padUpKey(k, b) {
        if (k === "act") return;
        var held = ((window.performance && performance.now) ? performance.now() : 0) - (padAt[k] || 0);
        if (held >= PAD_MIN_MS) { padRelease(k, b); return; }
        setTimeout(function () { padRelease(k, b); }, PAD_MIN_MS - held);   // ★離しても最低ぶんは歩かせる
      }
      function padUp(e) {
        var b = e.target.closest && e.target.closest("[data-k]");
        if (b) { padUpKey(b.getAttribute("data-k"), b); }
        else {
          ["up", "down", "left", "right"].forEach(function (k) {
            padUpKey(k, pad.querySelector('[data-k="' + k + '"]'));
          });
        }
      }
      pad.addEventListener("pointerdown", padDown);
      pad.addEventListener("pointerup", padUp);
      pad.addEventListener("pointercancel", padUp);
      pad.addEventListener("pointerleave", padUp);
      window.addEventListener("pointerup", padUp);
      window.addEventListener("blur", padUp);

      // ── ループ：固定タイムステップ更新（1/60）＋可変描画。タブ非表示で停止（設計書 §1）
      var raf = 0, last = 0, acc = 0, STEP = 1000 / 60, fpsN = 0, fpsT = 0;
      function frame(t) {
        raf = 0;
        if (S.dead) return;
        if (document.hidden || !cv.isConnected) { last = 0; raf = requestAnimationFrame(frame); return; }
        if (!last) last = t;
        var dt = Math.min(250, t - last);           // 復帰時の大ジャンプを吸収
        last = t; acc += dt;
        fpsN++; fpsT += dt;
        if (fpsT >= 1000) { S.fps = Math.round(fpsN * 1000 / fpsT); fpsN = 0; fpsT = 0; }
        fit();
        var guard = 0;
        while (acc >= STEP && guard++ < 6) {
          acc -= STEP;
          if (S.ready && opts.onUpdate) { try { opts.onUpdate(STEP / 1000, S); } catch (e) {} }
          for (var i = 0; i < S.actors.length; i++) {
            var a = S.actors[i];
            if (a.update) { try { a.update(STEP / 1000, S); } catch (e) {} }
          }
          S.actors = S.actors.filter(function (a) { return !a.dead; });
        }
        draw(t);
        raf = requestAnimationFrame(frame);
      }

      function draw(t) {
        var d = S.dpr;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, S.vw, S.vh);
        if (!S.ready) {                              // ロード中＝進捗だけ出して落ちない
          ctx.fillStyle = "#0b0f16"; ctx.fillRect(0, 0, S.vw, S.vh);
          ctx.fillStyle = "#8fb2c9"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("よみこみ中… " + Math.round((S.progress || 0) * 100) + "%", S.vw / 2, S.vh / 2);
          return;
        }
        var cam = S.camera;
        for (var li = 0; li < LAYERS.length; li++) {
          var name = LAYERS[li];
          if (name === "world") {
            var list = S.actors.slice().sort(function (a, b) { return a.z - b.z; });   // 奥→手前
            for (var i = 0; i < list.length; i++) {
              if (list[i].draw) { try { list[i].draw(ctx, cam, S, t); } catch (e) {} }
            }
          }
          if (opts.onDraw) { try { opts.onDraw(ctx, cam, name, S, t); } catch (e) {} }
        }
      }

      // ── 起動：アセットを読んでから onLoad
      S.progress = 0;
      loadAssets(opts.assets, function (p) { S.progress = p; }).then(function (a) {
        if (S.dead) return;
        S.assets = a;
        S.ready = true;
        if (opts.onLoad) { try { opts.onLoad(a, S); } catch (e) {} }
      });
      fit();
      raf = requestAnimationFrame(frame);

      // ★掃除係：他画面へ移られて canvas が DOM から外れたら**自分で片付ける**。
      //   戻るボタン以外（renderHome 等）で離脱されると、ループと window のキー購読が
      //   生き残って積み上がっていた（実機で確認）。rAF はタブ非表示だと止まるので、
      //   判定は rAF ではなく setInterval に置く＝止まっていても確実に片付く。
      var janitor = setInterval(function () {
        if (S.dead) { clearInterval(janitor); return; }
        if (!cv.isConnected) { S.destroy(); clearInterval(janitor); }
      }, 900);

      // ── 退場：ループ停止・イベント解除・アセット破棄（設計書 §2 遅延ロード/破棄）
      S.destroy = function () {
        if (S.dead) return;
        S.dead = true;
        if (raf) cancelAnimationFrame(raf);
        try { clearInterval(janitor); } catch (e) {}
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        window.removeEventListener("pointerup", padUp);
        window.removeEventListener("blur", padUp);
        if (opts.onExit) { try { opts.onExit(S); } catch (e) {} }
        S.assets = {}; S.actors = [];
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      };
      S.add = function (o) { var a = makeActor(o); S.actors.push(a); return a; };
      S.play = function (id, vol) { try { if (typeof Sfx !== "undefined" && Sfx.play) Sfx.play(id, vol); } catch (e) {} };

      return S;
    },
  };

  window.Scene = Scene;
})();
