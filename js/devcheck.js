// =========================================================================
// devcheck.js — 開発用レスポンシブ自己診断（表示専用・本番挙動に非干渉）
// =========================================================================
// 監査(docs/RESPONSIVE_AUDIT.md)で“手で”見つけた問題を、以後は“機械が”継続検出して
// デグレ（先祖返り）を防ぐための常設ガードレール。設定デバッグの「🩺自己診断」から実行。
//   responsiveSelfCheck()      … 今いる画面＋全体(input/CSS100vh)を即チェック（同期・確実）
//   responsiveSelfCheckAll()   … 全画面を巡回チェック（非同期・各画面の遷移アニメ後に実測）
// 検出：①横スクロール ②スクロール不能レイアウトでの操作部クリップ（横向きでドック消失等）
//       ③input自動ズーム(16px未満) ④壊れ表示(undefined/NaN/${/「が ？ に」等) ⑤CSSの100vh残存
// ★race数値には一切触れない（[[race-math-immutable]]）。診断のみ。
// =========================================================================

(function () {
  function clsOf(el) { return (el.className && el.className.toString().slice(0, 26)) || el.tagName; }

  // ① 横はみ出し（実スクロールが出ている時だけ犯人を特定＝clip済み全幅背景での誤検出を防ぐ）
  function checkHOverflow() {
    var de = document.documentElement, cw = de.clientWidth, over = de.scrollWidth - cw, offenders = [], seen = {};
    if (over > 2) {
      var all = document.querySelectorAll("body *");
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (r.right > cw + 1) { var c = clsOf(all[i]); if (!seen[c]) { seen[c] = 1; offenders.push(c + "(right " + Math.round(r.right) + ">" + cw + ")"); } }
      }
    }
    return { ok: over <= 2, overflowPx: over, offenders: offenders.slice(0, 6) };
  }

  // ② スクロール不能レイアウト(home/title=body fixed)で、必ず触れるべき操作部が画面外に出ていないか
  function checkClip() {
    if (getComputedStyle(document.body).position !== "fixed") return { ok: true, note: "scrollable" };
    var crit = [".hl-dock", ".hl-rail", ".hl-race", ".hl-cmbar", ".title-start", ".sv-start", ".sv-hint", "[data-start]"];
    var vh = window.innerHeight, clipped = [];
    crit.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.height > 0 && (r.bottom > vh + 2 || r.top < -2)) clipped.push(sel + "(bottom " + Math.round(r.bottom) + "/vh " + vh + ")");
      });
    });
    return { ok: clipped.length === 0, fixedNoScroll: true, clipped: clipped };
  }

  // ③ input自動ズーム：iOSは font-size<16px のテキスト入力でフォーカス時に勝手にズームする
  function checkInputs() {
    var bad = [];
    document.querySelectorAll("input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable='true']").forEach(function (el) {
      var fs = parseFloat(getComputedStyle(el).fontSize) || 16;
      if (fs < 16) bad.push(clsOf(el) + " " + fs + "px");
    });
    return { ok: bad.length === 0, under16px: bad };
  }

  // ④ 壊れ表示（未補間テンプレ・数値欠落）：undefined/NaN/${/[object/「が ？ に」/「： ？」
  function checkBrokenText() {
    var re = /undefined|NaN|\$\{|\[object|：\s*？|が\s+？\s/, hits = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var t = n.nodeValue;
      if (t && re.test(t)) { var s = t.trim().slice(0, 40); if (s && hits.indexOf(s) < 0) hits.push(s); if (hits.length >= 8) break; }
    }
    return { ok: hits.length === 0, suspicious: hits };
  }

  // ⑤ 高さに 100vh が残っていないか（モバイルでURLバー分ズレる。100dvh/svh推奨）。
  //   transform:translateY(100vh) 等の演出用途は誤検出しないよう、height/inset/top/bottom文脈に限定。
  var VH_RE = /(?:^|[;{\s])(?:min-|max-)?height\s*:\s*[^;}]*100vh|(?:^|[;{\s])(?:inset|top|bottom)\s*:\s*[^;}]*100vh/;
  function checkVh() {
    var found = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules; try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
      if (!rules) continue;
      (function scan(list) {
        for (var j = 0; j < list.length; j++) {
          var r = list[j];
          if (r.cssRules) { scan(r.cssRules); continue; }
          var c = r.cssText || "";
          if (c.indexOf("100vh") >= 0 && VH_RE.test(c)) { var sel = (r.selectorText || c).slice(0, 46); if (found.indexOf(sel) < 0) found.push(sel); }
        }
      })(rules);
    }
    return { ok: found.length === 0, vh100: found.slice(0, 12) };
  }

  function perScreen(label) { return { screen: label, hOverflow: checkHOverflow(), clip: checkClip(), brokenText: checkBrokenText() }; }

  function aggregate(report) {
    var p = [];
    if (!report.inputs.ok) p.push("input<16px(iOSズーム): " + report.inputs.under16px.join(", "));
    if (!report.css100vh.ok) p.push("CSS 100vh残存: " + report.css100vh.vh100.join(", "));
    report.screens.forEach(function (s) {
      if (!s.hOverflow.ok) p.push("[" + s.screen + "] 横溢れ " + s.hOverflow.overflowPx + "px: " + s.hOverflow.offenders.join(", "));
      if (!s.clip.ok) p.push("[" + s.screen + "] 操作部クリップ(スクロール不可): " + s.clip.clipped.join(", "));
      if (!s.brokenText.ok) p.push("[" + s.screen + "] 壊れ表示: " + s.brokenText.suspicious.join(" / "));
    });
    report.problems = p;
    report.verdict = p.length ? ("⚠ " + p.length + "件の要確認") : "✅ 問題なし";
    try { console.log("%c🩺 responsiveSelfCheck " + report.verdict + " @" + report.viewport, "font-weight:bold;color:#e6b24a", report); } catch (e) {}
    return report;
  }

  function curScreen() { return (window.state && state.ui && state.ui.screen) || "current"; }

  function responsiveSelfCheck() {
    return aggregate({ viewport: window.innerWidth + "x" + window.innerHeight, framed: window.innerWidth >= 540,
      inputs: checkInputs(), css100vh: checkVh(), screens: [perScreen(curScreen())] });
  }

  // 全画面巡回（遷移アニメ後に実測するため非同期）。race状態が要る画面は除外。
  function responsiveSelfCheckAll() {
    return new Promise(function (resolve) {
      var report = { viewport: window.innerWidth + "x" + window.innerHeight, framed: window.innerWidth >= 540,
        inputs: checkInputs(), css100vh: checkVh(), screens: [] };
      if (typeof SCREEN_INDEX === "undefined" || typeof goto !== "function") { resolve(aggregate({ ...report, screens: [perScreen(curScreen())] })); return; }
      var skip = { race_run: 1, result: 1, analysis: 1, race_detail: 1 };
      var cur = curScreen();
      var ids = SCREEN_INDEX.map(function (s) { return s.id || s; }).filter(function (id) { return !skip[id]; });
      var i = 0;
      // ★入場アニメ(translateX)の途中を測ると全画面が“右に18pxあふれ”に見える誤検出が出る（実測で確認）。
      //   さらにバックグラウンドタブではCSSアニメがスロットルされ「待っても終わらない」ため、
      //   待つのではなく finite アニメを終端へ強制送り（finish()）してから測る＝環境非依存の確定測定。
      function afterAnims(cb) {
        setTimeout(function () {
          try {
            document.getElementById("app").getAnimations({ subtree: true }).forEach(function (a) {
              try { if ((a.effect.getTiming().iterations || 1) !== Infinity) a.finish(); } catch (e) {}
            });
          } catch (e) {}
          setTimeout(cb, 60);   // rAFはバックグラウンドタブで止まる＝使わない（finish()後のスタイル反映は同期）
        }, 120);
      }
      (function step() {
        if (i >= ids.length) { try { goto(cur); } catch (e) {} resolve(aggregate(report)); return; }
        try { goto(ids[i]); } catch (e) {}
        afterAnims(function () { report.screens.push(perScreen(ids[i])); i++; step(); });
      })();
    });
  }

  if (typeof window !== "undefined") { window.responsiveSelfCheck = responsiveSelfCheck; window.responsiveSelfCheckAll = responsiveSelfCheckAll; }
})();
