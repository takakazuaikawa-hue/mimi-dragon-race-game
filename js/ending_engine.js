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
      case "records":
        return recordsHTML();
      case "outfitsOwned":
        return outfitsOwnedHTML();
      case "lifeOwned":
        return lifeOwnedHTML();
      case "fin":
        return '<div class="edr-fin">' + esc(b.text) +
          (b.sub ? '<span class="edr-fin-sub">' + esc(b.sub) + "</span>" : "") + "</div>";
      case "image":
        return '<div class="edr-image"><img src="' + esc(b.src) + '" alt="">' +
          (b.cap ? '<span class="edr-image-cap">' + esc(b.cap) + "</span>" : "") + "</div>";
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
        var ds = ((typeof DRAGONS !== "undefined" && DRAGONS) || []).filter(function (d) { return d.id !== "poro"; });
        var dcol = (typeof state !== "undefined" && state.player && state.player.collection) || {};
        var lockedN = 0;
        for (var j = 0; j < ds.length; j++) {
          var d = ds[j];
          if (dcol[d.id] && dcol[d.id].scouted) {   // ★スカウト済みだけ正体を見せる
            var sub = (d.traits && d.traits.length) ? d.traits.join("・") : "";
            var col = (typeof dragonColor === "function") ? dragonColor(d) : (d.color || null);
            out += rowHTML("🐉 " + d.name, sub, col);
          } else lockedN++;
        }
        if (lockedN > 0) out += rowHTML("── まだ見ぬ聖龍", "？？？？？？ ×" + lockedN, "#5a5a66");   // 未スカウトはまとめてマスク
      } catch (e2) {}
    }
    return out;
  }

  // ── プレイヤーの実績ブロック（戦績・手に入れたもの。未取得は ？？？？？？）──
  function recordsHTML() {
    try {
      var p = state.player; if (typeof recomputeAssets === "function") recomputeAssets(state);
      var run = p.completedRaces || 0, win = p.wins || 0, rate = run > 0 ? Math.round(win / run * 100) : 0;
      var fc = (typeof fmtCoins === "function") ? fmtCoins : function (n) { return String(n); };
      var dexT = (typeof DRAGONS !== "undefined") ? DRAGONS.filter(function (d) { return d.id !== "poro"; }).length : 0;
      var dexS = (typeof collectionSeenCount === "function") ? collectionSeenCount() : 0;
      var scouted = Object.values(p.collection || {}).filter(function (e) { return e && e.scouted; }).length;
      var ob = (p.outfitsBought || []).length + ((p.outfitsWon || []).length);
      var ot = (typeof OUTFITS !== "undefined") ? OUTFITS.length : 0;
      var rows = [
        ["完走", run + "戦 " + win + "勝（勝率 " + rate + "％）"],
        ["総資産", fc(p.totalAssets || 0)],
        ["図鑑", dexS + " ／ " + dexT + " 頭"],
        ["スカウト", scouted + " 頭を龍舎へ"],
        ["晴れ着", Math.min(ob, ot) + " ／ " + ot + " 着"],
        // ★旧称「村レベル」→「暮らし」。数字だけでなく称号を出す（LIVING_RANKS）。
        ["暮らし", (function(){ var lv = p.villageLevel || (p.village && p.village.level) || 1;
          var rk = (typeof LIVING_RANKS !== "undefined") ? LIVING_RANKS[lv-1] : null;
          return rk ? ("Lv." + lv + "　" + rk.title) : String(lv); })()]
      ];
      if (typeof poroFound === "function" && poroFound()) rows.push(["相棒", "ポロと出会えた"]);
      var html = "";
      for (var i = 0; i < rows.length; i++) html += rowHTML(rows[i][0], rows[i][1], "#caa24a");
      return html;
    } catch (e) { return ""; }
  }
  // 集めた晴れ着（所持を列挙＋未所持はまとめて ？？？？？？）。
  function outfitsOwnedHTML() {
    try {
      var list = (typeof OUTFITS !== "undefined" && OUTFITS) || [];
      var html = "", lockedN = 0;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if ((typeof outfitOwned === "function") && outfitOwned(o)) html += rowHTML("👗 " + o.name, "", "#ec7fb9");
        else lockedN++;
      }
      if (html === "") html += rowHTML("👗 ？？？？？？", "まだ集めていない", "#5a5a66");
      if (lockedN > 0) html += rowHTML("── 未入手の晴れ着", "？？？？？？ ×" + lockedN, "#5a5a66");
      return html;
    } catch (e) { return ""; }
  }
  // 暮らしで手に入れたもの（解放済みを列挙＋未解放はまとめて ？？？？？？）。
  function lifeOwnedHTML() {
    try {
      var u = (state.lifeTree && state.lifeTree.unlocked) || {};
      var got = Object.keys(u).filter(function (k) { return u[k]; });
      var total = (typeof LIFE_MILESTONES !== "undefined") ? LIFE_MILESTONES.length : 0;
      var cap = 14, html = "";
      if (!got.length) {
        html += rowHTML("🌱 ？？？？？？", "まだ暮らしを育てていない", "#5a5a66");
      } else {
        for (var i = 0; i < Math.min(got.length, cap); i++) html += rowHTML("🌱 " + got[i], "", "#6ac06a");
        if (got.length > cap) html += rowHTML("ほか " + (got.length - cap) + " 品", "手に入れた", "#6ac06a");
      }
      var locked = Math.max(0, total - got.length);
      if (locked > 0) html += rowHTML("── まだ見ぬ暮らし", "？？？？？？ ×" + locked, "#5a5a66");
      return html;
    } catch (e) { return ""; }
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
  var _endAudioOn = true;   // エンディングの音声ON/OFF（confirmAudioで決定・既定=音あり）

  function reduceMotion() {
    try { return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  // 一枚絵の先読み（読み込み完了 or 失敗 or タイムアウトで cb）。スクロール開始前に高さを確定させる。
  function preloadImages(scrollEl, cb) {
    var imgs = [].slice.call(scrollEl.querySelectorAll("img"));
    var remaining = imgs.length;
    if (!remaining) { cb(); return; }
    var done = false;
    function finish() { if (!done) { done = true; cb(); } }
    function one() { remaining -= 1; if (remaining <= 0) finish(); }
    imgs.forEach(function (im) {
      if (im.complete && im.naturalWidth) { one(); return; }
      im.addEventListener("load", one, { once: true });
      im.addEventListener("error", one, { once: true });
    });
    setTimeout(finish, 2500);   // 遅延・失敗でも止まらない保険
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
        scroll.style.animationPlayState = "paused";   // 先読み完了まで止める（途中ロードのガタつき防止）
      }

      view.appendChild(scroll);
      overlay.appendChild(view);
      // 一枚絵を先読みしてから流し始める＝スクロール中に画像が遅れて入りレイアウトがずれる「ガタガタ」を防ぐ。
      if (!reduceMotion()) preloadImages(scroll, function () { if (scroll.parentNode) scroll.style.animationPlayState = "running"; });

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
        // ロール完走後の「ED一枚絵＋締めの物語」フィナーレ（held・流れ去らず読める・一度だけ）。
        if (!overlay.querySelector(".edr-finale")) {
          var cF = cfg();
          var artHTML = cF.finBg ? '<div class="edr-finale-art"><img src="' + cF.finBg + '" alt=""></div>' : "";
          var storyHTML = ((cF.finStory) || []).map(function (s) { return "<p>" + esc(s) + "</p>"; }).join("");
          var fnl = document.createElement("div");
          fnl.className = "edr-finale";
          fnl.innerHTML = artHTML + '<div class="edr-finale-tx"><div class="edr-finale-ttl">― 次の物語へ ―</div>' + storyHTML + "</div>";
          overlay.insertBefore(fnl, bar);
        }
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

      // スタッフロールBGM（音ありを選んだ時だけ・任意ファイル＝「ある日森の中ドラゴンに出会った」）。
      try {
        if (_endAudioOn && c.bgm && global.RaceBgm && RaceBgm.playFile) RaceBgm.playFile(c.bgm);
      } catch (e) {}

      document.body.appendChild(overlay);
      // フェードイン
      requestAnimationFrame(function () { overlay.classList.add("edr-show"); });
    });
  }

  function close() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    try { if (global.RaceBgm && RaceBgm.fadeOut) RaceBgm.fadeOut(700); } catch (e) {}   // スタッフロールBGMをなめらかに絞って停止
    if (_activeResolve) { var r = _activeResolve; _activeResolve = null; r(); }
  }

  // エンディング前の確認：「音声を出しますか？」（没入のため・音楽つきを促す）。
  // 音あり=ミュート解除（スタッフロールBGMが流れる）／音なし=ミュート。選ぶと resolve。
  function confirmAudio() {
    return new Promise(function (resolve) {
      var ov = document.createElement("div"); ov.className = "navpop-ov";
      var box = document.createElement("div"); box.className = "navpop";
      box.innerHTML =
        '<div class="navpop-ic">🔊</div>' +
        '<div class="navpop-t">音声を出しますか？</div>' +
        '<div class="navpop-d">エンディングは音楽つきがおすすめです。<br>スタッフロールに曲が流れます。</div>';
      var btns = document.createElement("div"); btns.className = "navpop-btns";
      var yes = document.createElement("button"); yes.className = "navpop-go"; yes.textContent = "🔊 音ありで観る";
      var no = document.createElement("button"); no.className = "navpop-cancel"; no.textContent = "🔇 音なしで観る";
      function done(on) {
        _endAudioOn = on;
        try {
          if (global.Sfx && Sfx.setMuted) Sfx.setMuted(!on);
          if (global.RaceBgm && RaceBgm.setMuted) RaceBgm.setMuted(!on);
        } catch (e) {}
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        resolve();
      }
      yes.onclick = function () { done(true); };
      no.onclick = function () { done(false); };
      btns.appendChild(yes); btns.appendChild(no);
      box.appendChild(btns); ov.appendChild(box);
      document.body.appendChild(ov);
    });
  }

  // ── 送り出しVN → ロール ───────────────────────────────────────
  function play(opts) {
    opts = opts || {};
    return confirmAudio().then(function () {
      var c = cfg();
      var vnOn = c.playVN && !opts.skipVN &&
        (typeof ENDING_VN !== "undefined") && global.Dialogue && Dialogue.play;
      var chain = vnOn ? Dialogue.play(ENDING_VN, { force: true }) : Promise.resolve();
      return chain.then(function () { return playRoll(); });
    });
  }

  global.Ending = { play: play, playRoll: playRoll, close: close };
})(typeof window !== "undefined" ? window : this);
