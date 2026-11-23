// Small paid care for an existing place; this never constructs a new facility.
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./island_discovery.js') : root.IslandDiscovery);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandCare = api;
})(typeof globalThis === 'object' ? globalThis : this, function (discovery) {
  'use strict';
  const job = { id: 'waterCarrier', caseId: 'water', cost: 300, spotId: 'tanada', title: '水甕を運ぶ架を、水番と直す',
    image: 'images/konron/discovery/waterworks.webp',
    detail: '共同配水小屋にある運び架の留め具と縄を取り替える。水番と、雨の日にも甕を運べるように手入れする。' };
  function knows(p) { return !!discovery?.exportDiscoveries(p?.islandDiscovery).some(d => d.caseId === job.caseId); }
  function paid(p) { return knows(p) && p?.islandCare?.version === 1 && p.islandCare.waterCarrier?.cost === job.cost; }
  function capture(p) { return paid(p) ? { waterCarrier: { cost: job.cost } } : null; }
  function offer(p) {
    const coins = Number.isSafeInteger(p?.coins) ? p.coins : 0;
    return { ...job, known: knows(p), paid: paid(p), affordable: coins >= job.cost, coins, remaining: coins - job.cost };
  }
  function purchase(p) {
    const v = offer(p);
    if (!v.known) return { ok: false, error: 'まず、屋台へ届く飲み水の道を現地で確かめよう。' };
    if (v.paid) return { ok: false, error: '運び架の手入れは、すでに水番と終えている。' };
    if (!v.affordable) return { ok: false, error: '材料代300コインを残せるときに、また水番へ会いに来よう。' };
    return { ok: true, coins: v.remaining, care: { ...(p.islandCare || {}), version: 1, waterCarrier: { cost: job.cost } } };
  }
  return { job, knows, paid, capture, offer, purchase };
});
