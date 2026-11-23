// The midgame's own decisions become optional, personal evidence later.
(function () {
  "use strict";
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const available = () => typeof ReadingJournal !== "undefined" && typeof chapterRead === "function" && chapterRead("3");
  function catalog() {
    return DRAGONS.map(d => ({ id: d.id, name: d.id === "poro" && !(typeof poroFound === "function" && poroFound()) ? "泣き虫の竜" : d.name }));
  }
  function notes() { return ReadingJournal.normalizeNotes(state.player.readingNotes, catalog()); }
  function ranks(n) { return n.selections.map(s => esc(s.name) + " " + s.rank + "着").join("・"); }
  function art(n) { return `<img src="images/dragons/${esc(n.selections[0].dragonId)}.png" alt="" decoding="async" onerror="this.hidden=true">`; }
  function help() {
    if (typeof showInfoPopup === "function") showInfoPopup("読みの手帖", '<p>第3話から、結果画面で気になった一戦を6つまで残せます。賭ける前に選んだ理由と、そのレースで実際に見た着順を保存します。当たった経験も、外れた経験も残せます。</p><p>次に同じ竜や地域の出走表を見ると、前の読みを振り返れます。終章の「最後の一面」へも持ち込めます。過去の的中は、次の的中を保証しません。</p><p>手帖に追加報酬や完成ノルマはありません。保存しなくても進行できます。</p>');
  }
  function candidate(c) {
    let trace = null;
    try {
      const s = typeof betStoryOf === "function" && betStoryOf(c);
      const row = s && c.raceResult.entries.find(e => e.dragon.name === s.fullName);
      if (row) trace = { dragonId: row.dragon.id, earlyRank: s.a, midRank: s.b, section: s.sec, stat: s.stat, pace: s.pace, popularity: s.pop };
    } catch (e) {}
    return ReadingJournal.capture(state.player, c, catalog(), { raceName: typeof raceFullName === "function" ? raceFullName(c.race) : c.race.cup, trace });
  }
  window.appendReadingJournalResult = function (app, current) {
    if (!available()) return;
    const n = candidate(current); if (!n) return;
    const saved = notes().some(x => x.id === n.id), box = el("div", "rj-result");
    box.innerHTML = art(n) + `<div><small>${esc(ReadingJournal.oracleAccount(n) || ReadingJournal.reasonLabel(n.reason) + "で選んだ、一戦")}</small><b>${ranks(n)}</b><button class="rj-pin"${saved ? " disabled" : ""}>${saved ? "✓ 読みの手帖に残した" : "この読みを、手帖に残す"}</button></div><button class="rj-help" aria-label="読みの手帖について">？</button>`;
    box.querySelector(".rj-help").onclick = help;
    box.querySelector(".rj-pin").onclick = () => {
      const pinned = ReadingJournal.pin(notes(), n);
      if (pinned.full) { state.ui._openReadingJournal = true; renderKiko(); return; }
      if (pinned.added) {
        state.player.readingNotes = pinned.notes;
        (state.player.flags || (state.player.flags = {})).readingNoteKept = true;
        saveGame();
      }
      const button = box.querySelector(".rj-pin"); button.disabled = true; button.textContent = "✓ 読みの手帖に残した";
      // Keeping this note may complete the island route to the next chapter.
      // Refresh the existing result cue without rerunning settlement/effects.
      if (typeof nextGoal === "function") {
        const goal = nextGoal(), cue = document.querySelector("#app .rs-nextgoal");
        if (goal && cue) {
          const title = cue.querySelector(".rng-t"), hint = cue.querySelector(".rng-h");
          if (title) title.textContent = goalIconSafe(goal) + " " + goalTitleSafe(goal);
          if (hint) hint.textContent = goalHintSafe(goal);
          if (goal.go && (!goal.goIf || goal.goIf()) && (!goal.directIf || goal.directIf())) cue.onclick = () => goal.go();
        }
      }
      if (typeof _showUnlockToast === "function") _showUnlockToast("✍️ この一戦の読みを、手帖に残した。");
    };
    app.appendChild(box);
  };
  window.appendReadingJournalSection = function (app) {
    if (!available()) return;
    const saved = notes(), fresh = !(state.player.flags || {}).readingJournalSeen, box = el("section", "rj-notebook");
    box.innerHTML = `<div class="rj-notebook-head"><div><small>中盤から、積み重なる読み</small><h3>読みの手帖 ${fresh ? '<span class="rj-new">NEW</span>' : ""}</h3></div><button class="rj-help" aria-label="読みの手帖について">？</button></div>` +
      '<p class="rj-intro">あの時の読みを、次の出走表へ。</p>' +
      (saved.length ? `<details class="rj-entries"${state.ui._openReadingJournal ? " open" : ""}><summary>残した一戦を読み返す <small>${saved.length} / 6</small></summary><div class="rj-cards">` + saved.slice().reverse().map(n =>
        `<article class="rj-note">${art(n)}<div class="rj-note-copy"><small>${n.completedRace}戦め · ${esc(n.raceName)}</small><h4>${esc(ReadingJournal.oracleAccount(n) || ReadingJournal.reasonLabel(n.reason) + "で、この子を選んだ。")}</h4><p>${ranks(n)}<br>${n.hit ? "このときの券は的中。" : "このときの券は届かなかった。"}</p>` +
        (n.trace ? `<p class="rj-trace">序盤${n.trace.earlyRank}番手 → 中盤${n.trace.midRank}番手<br>${esc(n.trace.section)}${n.trace.stat ? " · " + esc(n.trace.stat) : ""}</p>` : "") +
        `<button class="rj-remove" data-remove-note="${esc(n.id)}">この一戦を手帖から外す</button></div></article>`).join("") + '</div></details>' : '<p class="rj-empty">結果画面で、残したい一戦を選べます。<br>外れた読みも、次に比べる手掛かりになる。</p>') +
      '<p class="rj-next">この手帖は、終章の「最後の一面」にも持ち込めます。</p>' +
      (state.current && state.current.settled && candidate(state.current) && !saved.some(n => n.id === candidate(state.current).id) ? '<button class="rj-return-result">いまの結果へ戻って、一戦を残す</button>' : "");
    box.querySelector(".rj-help").onclick = help;
    const backToResult = box.querySelector(".rj-return-result"); if (backToResult) backToResult.onclick = () => renderResult();
    const details = box.querySelector("details");
    if (details) details.addEventListener("toggle", () => { if (details.open && !(state.player.flags || {}).readingJournalSeen) { state.player.flags = state.player.flags || {}; state.player.flags.readingJournalSeen = true; const badge = box.querySelector(".rj-new"); if (badge) badge.remove(); saveGame(); } });
    box.querySelectorAll('[data-remove-note]').forEach(button => { button.onclick = () => {
      const previous = notes();
      // 旧セーブで初めて整理する場合も、本人が一戦を選んで残した実績を保つ。
      if (previous.some(note => note.id === button.dataset.removeNote && note.completedRace <= state.player.completedRaces)) {
        (state.player.flags || (state.player.flags = {})).readingNoteKept = true;
      }
      state.player.readingNotes = ReadingJournal.remove(previous, button.dataset.removeNote); state.ui._openReadingJournal = true; saveGame(); const y = window.scrollY; renderKiko(); window.scrollTo(0, y);
    }; });
    state.ui._openReadingJournal = false; app.appendChild(box);
  };
  window.appendReadingJournalReminder = function (app, race) {
    if (!available()) return;
    const ids = typeof getRaceDragons === "function" ? getRaceDragons(race).map(d => d.id) : [];
    const n = ReadingJournal.forRace(notes(), race, ids); if (!n) return;
    const same = n.selections.filter(s => ids.includes(s.dragonId));
    const box = el("details", "rj-reminder");
    box.innerHTML = `<summary>${same.length ? esc(same.map(s => s.name).join("・")) + (n.oracleDragonId ? "が載った、前の一戦。" : "を、前にも読んだ。") : "この地域で残した、前の読み。"}<small>手帖を開く</small></summary><p>${esc(n.raceName)}では、${esc(ReadingJournal.oracleAccount(n) || ReadingJournal.reasonLabel(n.reason) + "で予想した。")}<br>${ranks(n)}。${n.hit ? "そのときは的中した。" : "そのときは届かなかった。"}</p><p>今日は別の一戦。今回の出走表と見比べよう。</p><button class="rj-open-journal">紀行で読み返す</button>`;
    box.querySelector("button").onclick = () => { state.ui._openReadingJournal = true; renderKiko(); };
    app.appendChild(box);
  };
})();
