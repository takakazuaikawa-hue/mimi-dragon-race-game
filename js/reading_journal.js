// Remember the player's real, settled decisions. No new prediction or reward.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReadingJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const REASONS = { kan: "好み", data: "能力データ", tell: "レース展開", value: "うまみ" };
  const integer = (n, min, max) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
  const text = (s, max) => typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "";
  const validId = id => typeof id === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(id);
  function oracleSelection(current) {
    const id = current?._celestiaRevealed || current?.oddsResult?.oddsData?.find(o => o._celestia)?.dragonId;
    return validId(id) && current.bet?.selections?.includes(id) ? id : null;
  }
  function oracleAccount(note) {
    const named = note?.selections?.find(s => s.dragonId === note.oracleDragonId);
    if (!named) return "";
    const partner = note.selections.find(s => s !== named);
    return partner ? "一着は神眼が告げた" + named.name + "。ワイドの相手には、自分で" + partner.name + "を選んだ。"
      : "神眼が一着に挙げた" + named.name + "の" + (note.betType === "place" ? "複勝" : "単勝") + "を買った。";
  }
  function normalizeNotes(raw, catalog) {
    if (!Array.isArray(raw)) return [];
    const lookup = Array.isArray(catalog) ? new Map(catalog.map(d => [d.id, d.name])) : null, out = [], ids = new Set();
    raw.slice(0, 100).forEach(n => {
      if (!n || !integer(n.completedRace, 1, 1000000) || n.id !== "race-" + n.completedRace || ids.has(n.id) || !validId(n.raceId) || !Object.hasOwn(REASONS, n.reason) || !["win", "place", "wide"].includes(n.betType) || typeof n.hit !== "boolean" || !Array.isArray(n.selections)) return;
      const selections = n.selections.map(s => s && validId(s.dragonId) && integer(s.rank, 1, 64) && (!lookup || lookup.has(s.dragonId)) ? { dragonId: s.dragonId, name: text(lookup ? lookup.get(s.dragonId) : s.name, 64), rank: s.rank } : null);
      if (selections.length !== (n.betType === "wide" ? 2 : 1) || selections.some(s => !s || !s.name) || new Set(selections.map(s => s.dragonId)).size !== selections.length) return;
      if (new Set(selections.map(s => s.rank)).size !== selections.length || n.hit !== selections.every(s => s.rank <= (n.betType === "win" ? 1 : 3))) return;
      const raceName = text(n.raceName, 100), region = text(n.region, 50); if (!raceName) return;
      const t = n.trace;
      const trace = t && selections.some(s => s.dragonId === t.dragonId) && integer(t.earlyRank, 1, 64) && integer(t.midRank, 1, 64)
        ? { dragonId: t.dragonId, earlyRank: t.earlyRank, midRank: t.midRank, section: text(t.section, 70), stat: text(t.stat, 20), pace: text(t.pace, 20), popularity: integer(t.popularity, 1, 64) ? t.popularity : 0 } : null;
      const oracle = selections.some(s => s.dragonId === n.oracleDragonId && s.rank === 1) ? {oracleDragonId:n.oracleDragonId} : {};
      ids.add(n.id); out.push({ id: n.id, completedRace: n.completedRace, raceId: n.raceId, raceName, region, reason: n.reason, betType: n.betType, hit: n.hit, selections, trace, ...oracle });
    });
    return out.sort((a, b) => a.completedRace - b.completedRace).slice(-6);
  }
  function capture(player, current, catalog, details) {
    const p = player || {}, c = current || {}, d = details || {};
    if (!c.settled || !c.betResult || !c.raceResult || !c.race || !c.bet || !Array.isArray(c.raceResult.entries)) return null;
    const selections = (c.bet.selections || []).map(id => {
      const e = c.raceResult.entries.find(row => row.dragon && row.dragon.id === id);
      return e ? { dragonId: id, name: e.dragon.name, rank: e.rank } : null;
    });
    return normalizeNotes([{ id: "race-" + p.completedRaces, completedRace: p.completedRaces, raceId: c.race.id,
      raceName: d.raceName || c.race.cup || c.race.id, region: c.race.region || "", reason: c.betReasonUsed,
      betType: c.bet.type, hit: c.betResult.hit, selections, trace: d.trace || null, oracleDragonId:oracleSelection(c) }], catalog)[0] || null;
  }
  function pin(raw, candidate) {
    const notes = normalizeNotes(raw), note = normalizeNotes([candidate])[0];
    if (!note) return { notes, added: false, full: false };
    if (notes.some(n => n.id === note.id)) return { notes, added: false, full: false };
    if (notes.length >= 6) return { notes, added: false, full: true };
    return { notes: normalizeNotes(notes.concat(note)), added: true, full: false };
  }
  function remove(raw, id) { return normalizeNotes(raw).filter(n => n.id !== id); }
  function forRace(raw, race, dragonIds) {
    const notes = normalizeNotes(raw), ids = new Set(dragonIds || []);
    return notes.slice().reverse().find(n => n.selections.some(s => ids.has(s.dragonId))) || notes.slice().reverse().find(n => race && n.region === race.region) || null;
  }
  return { normalizeNotes, capture, pin, remove, forRace, oracleSelection, oracleAccount, reasonLabel: key => Object.hasOwn(REASONS, key) ? REASONS[key] : "" };
});
