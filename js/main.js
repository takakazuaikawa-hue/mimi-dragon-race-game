/**
 * main.js — entry point and event wiring.
 *
 * Loaded last so all engines, data, and UI render functions are defined.
 * Responsible for: load save → initial header → wire UI toggles → render
 * home screen.
 *
 * EXTENSION POINT — new top-level UI control (e.g. settings dropdown):
 *   1. Add the HTML in index.html header.
 *   2. Wire its listener inside DOMContentLoaded below.
 *   3. Call rerenderCurrent() at the end of the listener if the change is
 *      visible on the current screen.
 */
window.addEventListener("DOMContentLoaded", () => {
  loadGame();
  // §30 — initialize total-asset progression from the loaded save (seeds
  // maxCoinsReached / 総資産 / unlocked lifestyle stage before first render).
  bumpMaxCoins();
  recomputeAssets(state);
  updateHeader();
  // Restore the persisted "情報量" preference into its selector on boot.
  const _infoSel = document.getElementById("info-level");
  if (_infoSel && state.ui.infoLevel) _infoSel.value = state.ui.infoLevel;

  // 画面の再描画・ジャンプは js/nav.js の rerenderCurrent()/goto()/SCREEN_INDEX に集約（全画面網羅）。
  // ここでは nav.js のグローバル rerenderCurrent() をそのまま使う（ローカルの画面マップは廃止）。

  // Debug toggle
  document.getElementById("debug-toggle").addEventListener("change", (e) => {
    state.ui.debug = e.target.checked;
    rerenderCurrent();
  });
  // ヘッダーのタイトル（ブランド）＝タップでホームへ（“ロゴ＝ホーム”の王道。ホームではヘッダー自体が非表示なので重複なし）。
  const _brand = document.querySelector(".hd-brand");
  if (_brand) {
    _brand.setAttribute("title", "ホームへ戻る");
    _brand.setAttribute("role", "button");
    _brand.addEventListener("click", () => {
      if (typeof goto === "function") goto("home");
      else if (typeof renderHome === "function") renderHome();
    });
  }
  // Info level selector (情報量 is now changed from the ⚙️設定 screen; the header
  // <select> was removed for a cleaner HUD, so this binding is optional/guarded).
  const _infoLevelEl = document.getElementById("info-level");
  if (_infoLevelEl) _infoLevelEl.addEventListener("change", (e) => {
    state.ui.infoLevel = e.target.value;
    saveGame();              // persist the preference across reloads
    rerenderCurrent();
  });

  // Esc closes the event overlay (keyboard parity with the 次へ button).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const ov = document.getElementById("event-overlay");
      if (ov && !ov.classList.contains("hidden")) {
        ov.classList.add("hidden");
        setTimeout(flushEventQueue, 50);
      }
    }
  });

  // Event overlay close
  document.getElementById("event-close").addEventListener("click", () => {
    document.getElementById("event-overlay").classList.add("hidden");
    setTimeout(flushEventQueue, 50);
  });

  // Soft tap feedback on any interactive control (paired with the screen
  // transition swoosh in beginScreen). Delegated so it covers re-rendered UI.
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("button, .race-card, .bet-pick-card, .consult-mark, .uc-head")) {
      if (window.Sfx && !(t.closest("button") && t.closest("button").disabled)) Sfx.play("click");
    }
  });

  // 🗓️ ?daily=<合言葉>（値なし＝今日）でデイリーランへ直行。入口は競合中のハブを避けてURLに置く。
  try {
    const _dp = new URLSearchParams(location.search);
    if (_dp.has("daily") && typeof rpgStartDaily === "function") { rpgStartDaily(_dp.get("daily")); return; }
  } catch (e) {}
  // ?go=<screen> があれば、その画面で直接起動（開発・プレビュー高速化）。無ければ通常どおりタイトルから。
  if (!(typeof applyStartupRoute === "function" && applyStartupRoute())) renderTitle();
});
