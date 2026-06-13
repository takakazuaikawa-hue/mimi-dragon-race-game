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

  const rerenderCurrent = () => {
    const map = {
      title: renderTitle, home: renderHome, race_select: renderRaceSelect,
      race_detail: () => renderRaceDetail(state.current.race),
      race_run: renderRaceRun, result: renderResult, analysis: renderAnalysis,
      assets: renderAssets, village: renderVillage, collection: renderCollection, help: renderHelp,
      story: renderStory, consult: renderConsult, settings: renderSettings, mall: renderMall,
      mall_rpg: renderMallRpg
    };
    if (map[state.ui.screen]) map[state.ui.screen]();
  };

  // Debug toggle
  document.getElementById("debug-toggle").addEventListener("change", (e) => {
    state.ui.debug = e.target.checked;
    rerenderCurrent();
  });
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

  renderTitle();
});
