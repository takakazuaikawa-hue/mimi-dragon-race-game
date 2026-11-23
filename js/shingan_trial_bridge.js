// A small, read-only handoff. Never loads, saves, or changes the main game.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShinganTrialBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const IDS = ["raiou", "fugaku", "glaze", "poro", "yomi", "souten", "phenix", "goka"];
  const SPOTS = ["furununo", "arcade", "rondo", "hoshimi", "susufuka"];
  const integer = (n, max) => typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
  function readingNotes(raw) {
    const journal = typeof module === "object" && module.exports ? require("./reading_journal.js") : typeof ReadingJournal !== "undefined" ? ReadingJournal : null;
    return journal ? journal.normalizeNotes(raw) : [];
  }
  function lifeLoop() { return typeof module === "object" && module.exports ? require("./island_life_loop.js") : typeof IslandLifeLoop !== "undefined" ? IslandLifeLoop : null; }
  function lifeMemory(raw) { const loop = lifeLoop(); return loop ? loop.normalizeMemory(raw) : null; }
  function discovery() { return typeof module === "object" && module.exports ? require("./island_discovery.js") : typeof IslandDiscovery !== "undefined" ? IslandDiscovery : null; }
  function normalize(raw) {
    if (!raw || raw.version !== 1) return null;
    return {
      version: 1,
      island: { infra: integer(raw.island && raw.island.infra, 8), commerce: integer(raw.island && raw.island.commerce, 8) },
      scouted: IDS.filter(id => Array.isArray(raw.scouted) && raw.scouted.includes(id)),
      observations: Object.fromEntries(IDS.map(id => [id, integer(raw.observations && raw.observations[id], 1000000)])),
      visits: SPOTS.filter(id => Array.isArray(raw.visits) && raw.visits.includes(id)),
      meals: integer(raw.meals, 1000), races: integer(raw.races, 1000000),
      mizuMet: raw.mizuMet === true, readingNotes: readingNotes(raw.readingNotes), lifeMemory: lifeMemory(raw.lifeMemory), discoveries: discovery() ? discovery().normalizeExport(raw.discoveries) : []
    };
  }
  function capture(player, context) {
    const p = player || {}, c = context || {}, collection = p.collection || {}, lv = (p.island || {}).lv || {};
    return normalize({ version: 1, island: lv,
      scouted: IDS.filter(id => id === "poro" ? c.poroFound === true : !!(collection[id] && collection[id].scouted)),
      observations: Object.fromEntries(IDS.map(id => [id, collection[id] && collection[id].records && collection[id].records.racesSeen])),
      visits: SPOTS.filter(id => !!(((p.kurashi || {}).spotsSeen || {})[id])),
      meals: Object.values((p.meals || {}).eaten || {}).filter(Boolean).length,
      races: p.completedRaces, mizuMet: c.mizuMet === true, readingNotes: p.readingNotes, lifeMemory: lifeLoop() ? lifeLoop().exportMemory(p.islandLife) : null, discoveries: discovery() ? discovery().exportDiscoveries(p.islandDiscovery) : []
    });
  }
  function toURL(snapshot) {
    const data = normalize(snapshot);
    return "shingan-prototype.html" + (data ? "#island=" + encodeURIComponent(JSON.stringify(data)) : "");
  }
  function fromHash(hash) {
    if (typeof hash !== "string" || hash.length > 60000 || !hash.startsWith("#island=")) return null;
    try { return normalize(JSON.parse(decodeURIComponent(hash.slice(8)))); } catch (e) { return null; }
  }
  function apply(state, snapshot) {
    const s = normalize(snapshot), next = JSON.parse(JSON.stringify(state));
    if (!s) return next;
    // Only the exact existing milestones count, not every infrastructure level.
    next.prepared.harbor = next.prepared.harbor || s.island.infra >= 1;
    next.prepared.market = next.prepared.market || s.island.commerce >= 4;
    next.scouted = IDS.filter(id => next.scouted.includes(id) || s.scouted.includes(id));
    next.prepared.scout = next.scouted.length === IDS.length;
    if (s.mizuMet && next.journey && !next.journey.theories.includes("market")) next.journey.theories.push("market");
    next.readingNotes = readingNotes(s.readingNotes);
    next.lifeMemory = lifeMemory(s.lifeMemory);
    next.discoveries = discovery() ? discovery().normalizeExport(s.discoveries) : [];
    return next;
  }
  return { capture, normalize, toURL, fromHash, apply };
});
