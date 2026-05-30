// Entry point — wire everything up.
window.addEventListener("DOMContentLoaded", () => {
  loadGame();
  updateHeader();

  const rerenderCurrent = () => {
    const map = {
      home: renderHome, race_select: renderRaceSelect,
      race_detail: () => renderRaceDetail(state.current.race),
      race_run: renderRaceRun, result: renderResult, analysis: renderAnalysis,
      village: renderVillage, collection: renderCollection, help: renderHelp
    };
    if (map[state.ui.screen]) map[state.ui.screen]();
  };

  // Debug toggle
  document.getElementById("debug-toggle").addEventListener("change", (e) => {
    state.ui.debug = e.target.checked;
    rerenderCurrent();
  });
  // Info level selector
  document.getElementById("info-level").addEventListener("change", (e) => {
    state.ui.infoLevel = e.target.value;
    rerenderCurrent();
  });

  // Event overlay close
  document.getElementById("event-close").addEventListener("click", () => {
    document.getElementById("event-overlay").classList.add("hidden");
    setTimeout(flushEventQueue, 50);
  });

  renderHome();
});
