// =========================================================================
// ending_engine.js — エンディング演出＆スタッフロールの「演出エンジン」
// =========================================================================
// 役割：data_ending.js（ENDING_CONFIG / ENDING_VN / STAFF_ROLL）を読み取り、
//   ① 顧問たちの送り出しVN（Dialogue.play）→ ② スタッフロールのスクロール、
//   を再生する。中身（文言・順番・背景）はデータ側で完結し、ここは触らない想定。
//
// 表示専用・コスメ演出。着順・オッズ・配当（race/odds/betting）には非干渉。
//
// 公開API（window.Ending）：
//   Ending.play(opts)      … 送り出しVN→ロール（opts.skipVN:true でVN省略）→Promise
//   Ending.playRoll()      … ロールだけ再生→Promise
//   Ending.close()         … 強制終了して閉じる
// =========================================================================
(function (global) {
  "use strict";

  var OVERLAY_ID = "ending-overlay";

  function cfg() { return (typeof ENDING_CONFIG === "object" && ENDING_CONFIG) || {}; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 顧問IDから { name, color, symbol } を引く（STORY_CAST 優先）。
  function castInfo(id) {
    try {
      if (typeof STORY_CAST === "object" && STORY_CAST && STORY_CAST[id]) {
        var s = STORY_CAST[id];
        return { name: s.name, color: s.color, symbol: s.symbol, tag: s.tag };
      }
    } catch (e) {}
    return { name: id, color: "#caa24a", symbol: "🐲", tag: "" };
  }

  // ── ブロック → HTML ───────────────────────────────────────────
  function rowHTML(role, name, color) {
    var dot = color ? '<span class="edr-dot" style="background:' + color + '"></span>' : "";
    var nm = name ? '<span class="edr-row-nm">' + esc(name) + "</span>" : "";
    return '<div class="edr-row">' + dot +
      '<span class="edr-row-role">' + esc(role) + "</span>" + nm + "</div>";
  }

  function blockHTML(b) {
    switch (b.type) {
      case "gap":
        return '<div class="edr-gap edr-gap-' + (b.size || "md") + '"></div>';
      case "title":
        return '<div class="edr-title">' + esc(b.text) +
          (b.sub ? '<span class="edr-title-sub">' + esc(b.sub) + "</span>" : "") + "</div>";
      case "head":
        return '<div class="edr-head"><span>【 ' + esc(b.text) + " 】</span></div>";
      case "role":
        return rowHTML(b.role, b.name || "", null);
      case "note":
        return '<div class="edr-note">' + esc(b.text) + "</div>";
      case "voice": {
        var c = castInfo(b.who);
        return '<div class="edr-voice" style="border-color:' + c.color + '">' +
          '<span class="edr-voice-tx">' + esc(b.text) + "</span>" +
          '<span class="edr-voice-by" style="color:' + c.color + '">' +
          (c.symbol || "") + " " + esc(c.name) + "</span></div>";
      }
      case "cast":
        return castBlockHTML(b.from);
      case "credits":
        return creditsBlockHTML(b.from);
      case "fin":
        return '<div class="edr-fin">' + esc(b.text) +
          (b.sub ? '<span class="edr-fin-sub">' + esc(b.sub) + "</span>" : "") + "</div>";
      default:
        return "";
    }
  }

  // 顧問5人 or 登場竜を自動展開。
  function castBlockHTML(from) {
    var out = "";
    if (from === "STORY_CAST") {
      try {
        var order = ["sake", "mizu", "sumika", "makura", "celestia"];
        for (var i = 0; i < order.length; i++) {
          var s = (typeof STORY_CAST === "object" && STORY_CAST[order[i]]);
          if (!s) continue;
          out += rowHTML((s.symbol ? s.symbol + " " : "") + s.name, s.tag || "", s.color);
        }
      } catch (e) {}
    } else if (from === "DRAGONS") {
      try {
        var ds = (typeof DRAGONS !== "undefined" && DRAGONS) || [];
        for (var j = 0; j < ds.length; j++) {
          var d = ds[j];
          var sub = (d.traits && d.traits.length) ? d.traits.join("・") : "";
          var col = (typeof dragonColor === "function") ? dragonColor(d) : (d.color || null);
          out += rowHTML("🐉 " + d.name, sub, col);
        }
      } catch (e2) {}
    }
    return out;
  }

  function creditsBlockHTML(from) {
    if (from !== "REAL") return "";
    var list = (cfg().realCredits) || [];
    var out = "";
    for (var i = 0; i < list.length; i++) out += rowHTML(list[i].role, list[i].name || "", null);
    return out;
  }

  function buildScrollHTML() {
    var blocks = (typeof STAFF_ROLL !== "undefined" && STAFF_ROLL) || [];
    var html = "";
    for (var i = 0; i < blocks.length; i++) html += blockHTML(blocks[i]);
    return html;
  }

  // ── ロール再生 ────────────────────────────────────────────────
  var _activeResolve = null;

  function reduceMotion() {
    try { return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  function playRoll() {
    close(); // 二重再生ガード
    return new Promise(function (resolve) {
      _activeResolve = resolve;
      var c = cfg();

      var overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.className = "edr-overlay";
      if (c.bg) overlay.style.setProperty("--edr-bg", "url('" + c.bg + "')");

      var view = document.createElement("div");
      view.className = "edr-view";

      var scroll = document.createElement("div");
      scroll.className = "edr-scroll";
      scroll.innerHTML = buildScrollHTML();

      var secs = Math.max(8, +c.scrollSeconds || 48);
      if (reduceMotion()) {
        // 動きを抑える設定では自動スクロールせず、手動スクロール可能に。
        view.classList.add("edr-static");
      } else {
        scroll.style.animationDuration = secs + "s";
      }

      view.appendChild(scroll);
      overlay.appendChild(view);

      // 🔊 音量ボタン生成（操作バー用・グローバルの音量パネルを開く）。
      function makeVolBtn() {
        var b = document.createElement("button");
        b.className = "edr-btn edr-vol"; b.textContent = "🔊"; b.title = "音量";
        b.onclick = function () { if (typeof showVolumePanel === "function") showVolumePanel(); };
        return b;
      }
      // 操作バー：スキップ／（終了後）もう一度・閉じる
      var bar = document.createElement("div");
      bar.className = "edr-bar";
      var skip = document.createElement("button");
      skip.className = "edr-btn edr-skip";
      skip.textContent = "スキップ ✕";
      skip.onclick = function () { finish(); };
      bar.appendChild(skip);
      bar.appendChild(makeVolBtn());                 // 🔊 エンディング中も音量調整（表示専用）
      overlay.appendChild(bar);

      // 終了後パネル（最後のカードで停止 → もう一度／閉じる）
      function finish() {
        if (!overlay.parentNode) return;
        bar.innerHTML = "";
        var again = document.createElement("button");
        again.className = "edr-btn"; again.textContent = "🔁 もう一度";
        again.onclick = function () { close(); playRoll(); };
        var done = document.createElement("button");
        done.className = "edr-btn edr-done"; done.textContent = "🏠 とじる";
        done.onclick = function () { close(); };
        bar.appendChild(again); bar.appendChild(done); bar.appendChild(makeVolBtn());
        scroll.style.animationPlayState = "paused";
        overlay.classList.add("edr-ended");
      }

      scroll.addEventListener("animationend", finish);

      // BGM 流用（任意・指定があれば）
      try {
        if (c.bgm && global.RaceBgm && RaceBgm.play) RaceBgm.play(c.bgm);
      } catch (e) {}

      document.body.appendChild(overlay);
      // フェードイン
      requestAnimationFrame(function () { overlay.classList.add("edr-show"); });
    });
  }

  function close() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    try { if (cfg().bgm && global.RaceBgm && RaceBgm.stop) RaceBgm.stop(); } catch (e) {}
    if (_activeResolve) { var r = _activeResolve; _activeResolve = null; r(); }
  }

  // ── 送り出しVN → ロール ───────────────────────────────────────
  function play(opts) {
    opts = opts || {};
    var c = cfg();
    var vnOn = c.playVN && !opts.skipVN &&
      (typeof ENDING_VN !== "undefined") && global.Dialogue && Dialogue.play;
    var chain = vnOn ? Dialogue.play(ENDING_VN, { force: true }) : Promise.resolve();
    return chain.then(function () { return playRoll(); });
  }

  global.Ending = { play: play, playRoll: playRoll, close: close };
})(typeof window !== "undefined" ? window : this);
