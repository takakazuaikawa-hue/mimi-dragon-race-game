'use strict';
const assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const F = require('../js/shingan_festival.js'), P = require('../js/shingan_prototype_engine.js');
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.attrs = {}; this.classList = { add: name => { this.className += ' ' + name; } }; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelectorAll(selector) { return this.all().filter(n => n.tag === selector); }
  setAttribute(key, value) { this.attrs[key] = value; }
  all() { return [this, ...this.children.flatMap(n => n.all ? n.all() : [])]; }
}
function harness(official) {
  const catalog = P.getView(P.createState()).dragons;
  const player = { coins: 751, completedRaces: 30, flags: { poroFound: true }, collection: Object.fromEntries(catalog.filter(d => d.id !== 'poro').map(d => [d.id, { scouted: true }])), island: { lv: { infra: 4, commerce: 4, race: 4, dragon: 4, public: 4, industry: 4 } }, epilogue: {} };
  if (official) player.shingan = { official };
  const state = { player, ui: {} }, storage = new Map(), listeners = {}, ctx = {
    state, console, ShinganFestival: F, SAVE_KEY: 'test-save', scrollY: 0, scrollTo() {},
    document: { createElement: tag => new Node(tag) },
    localStorage: { getItem: key => storage.get(key) || null },
    crypto: { getRandomValues: values => { values[0] = 19; values[1] = 97; return values; } },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    saveGame: () => storage.set('test-save', JSON.stringify({ player: state.player })),
    beginScreen: () => (ctx.app = new Node('main')), showInfoPopup: (title, body) => { ctx.popups.push([title, body]); },
    renderHome() {}, renderScout() {}, renderIslandBuild() {}, poroFound: () => true,
    shinganUnlocked: () => true, shinganAllScouted: () => catalog.every(d => d.id === 'poro' || state.player.collection[d.id]?.scouted),
    shinganScouted: id => id === 'poro' || !!state.player.collection[id]?.scouted,
    SHINGAN_ROSTER: catalog, shinganData: () => state.player.shingan || (state.player.shingan = {}),
    epilogueClear: () => { state.player.epilogue.edFlag = true; }, markGameCleared: () => { ctx.marks++; },
    Ending: { play: async () => {} }, popups: [], legacyCalls: 0, marks: 0,
    ShinganOfficialV1: { getOutcome: () => null }, renderShinganLegacyIssue: () => { ctx.legacyCalls++; }
  };
  ctx.window = ctx; vm.createContext(ctx); ctx.saveGame();
  vm.runInContext(fs.readFileSync(require.resolve('../js/shingan_festival_ui.js'), 'utf8'), ctx);
  const all = () => ctx.app.all();
  const click = async (text, className) => { const b = all().find(n => n.tag === 'button' && (className ? n.className === className && n.children.some(c => c.textContent === text) : n.textContent === text)); assert(b && !b.disabled, text); await b.onclick(); };
  const ready = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const render = async () => { ctx.renderShinganFairRace(); await ready(); };
  return { ctx, state, player, storage, listeners, all, click, render, ready };
}
(async () => {
  const initialFailure = harness(), initialSave = initialFailure.ctx.saveGame;
  initialFailure.ctx.saveGame = () => false; await initialFailure.render();
  assert.equal(initialFailure.player.shingan, undefined);
  assert(initialFailure.all().some(n => n.textContent === 'もう一度、開催の記録を保存する'));
  assert(initialFailure.all().some(n => n.textContent === 'ホームへ戻る'));
  initialFailure.ctx.saveGame = initialSave;
  await initialFailure.click('もう一度、開催の記録を保存する'); await initialFailure.ready();
  assert(F.view(initialFailure.player.shingan.festival).eventId, 'an initial refused save has a usable in-page retry');
  const h = harness(); await h.render();
  let view = F.view(h.player.shingan.festival);
  assert(view.eventId); assert.equal(view.facilities.length, 6);
  assert(view.facilities.every(f => f.level === 4)); assert.equal(Object.hasOwn(view, 'order'), false);
  const originalWallet = h.player.coins;
  await h.click('一窓口で単勝・複勝', 'sf-desk');
  const stale = h.all().find(n => n.attrs['aria-label'] === '複勝 グレイズ');
  const choose = h.all().find(n => n.attrs['aria-label'] === '複勝 フガク'); await choose.onclick();
  assert.equal(F.view(h.player.shingan.festival).plan.place, 'fugaku');
  await stale.onclick(); assert.equal(F.view(h.player.shingan.festival).plan.place, 'fugaku', 'an old rendered revision must not overwrite the new selection');
  assert.equal(h.all().filter(n => /^ワイド /.test(n.attrs['aria-label'] || '')).length, 0);
  await h.click('単勝窓口', 'sf-desk');
  const publish = h.all().find(n => n.textContent === '予想を発行して、開催を見届ける'); await publish.onclick();
  const receipt = h.ctx.ShinganOfficial.getOutcome(); assert.equal(receipt.success, false);
  assert.equal(receipt.provenance, 'festival-v2'); assert.equal(h.player.epilogue.edFlag, undefined);
  const issued = JSON.stringify(h.player.shingan.festival); await publish.onclick();
  assert.equal(JSON.stringify(h.player.shingan.festival), issued, 'a stale publish callback must not reissue the meeting');
  await h.click('次の開催の公示を見る'); view = F.view(h.player.shingan.festival);
  assert.equal(view.history.length, 1); assert.equal(view.lastResult, null); assert.equal(h.player.coins, originalWallet);
  const current = JSON.stringify(h.player.shingan.festival);
  const desk = h.all().find(n => n.className === 'sf-desk');
  h.listeners.storage({ key: 'test-save', oldValue: 'older', newValue: 'newer' }); await desk.onclick();
  assert.equal(JSON.stringify(h.player.shingan.festival), current); assert.match(h.ctx.popups.at(-1)[1], /別のタブ/);
  console.log('PASS official V2: actual facilities, frozen first meeting, stale input/publish rejection, independent next meeting, no wallet or early-clear writes, external-save rejection');

  function v1(plan) { return { version: 1, legacyCleared: false, draft: plan, ferry: true, issue: { version: 1, course: 'coast', plan, harbor: false, ferry: true, market: false, notes: [], noteId: null } }; }
  const oldWin = harness(v1(['p_raiou', 'p_fugaku', 'p_glaze'])); await oldWin.render();
  assert.equal(oldWin.ctx.legacyCalls, 1); assert.equal(oldWin.player.shingan.festival.active, null);
  assert.equal(oldWin.ctx.ShinganOfficial.getOutcome().provenance, 'official-v1');
  const oldFail = harness(v1(['p_glaze', 'p_goka', 'p_yomi'])), source = JSON.stringify(oldFail.player.shingan.official);
  await oldFail.render(); assert.equal(oldFail.ctx.legacyCalls, 0); assert(F.view(oldFail.player.shingan.festival).eventId);
  assert.equal(JSON.stringify(oldFail.player.shingan.official), source);
  console.log('PASS V1 migration: historical success resumes its own ending; historical failure retains its original issue and enters an unseen V2 meeting');

  const season = harness(); await season.render();
  const persistedSave = season.ctx.saveGame, beforeFailure = JSON.stringify(season.player.shingan.festival);
  const storedBeforeFailure = season.storage.get('test-save');
  season.ctx.SAVE_VERSION = 'qa';
  const stateSource = fs.readFileSync(require.resolve('../js/state.js'), 'utf8');
  vm.runInContext(stateSource.slice(stateSource.indexOf('function saveGame()'), stateSource.indexOf('function loadGame()')), season.ctx);
  const saveWarnings = [];
  season.ctx.console = { ...console, warn: (...args) => saveWarnings.push(args) };
  season.ctx.localStorage.setItem = () => { throw Error('QuotaExceededError'); };
  await season.click('一窓口で単勝・複勝', 'sf-desk');
  assert.equal(JSON.stringify(season.player.shingan.festival), beforeFailure, 'a refused save rolls the in-memory book back');
  assert.equal(season.storage.get('test-save'), storedBeforeFailure, 'a refused save preserves the prior stored book');
  assert.match(season.ctx.popups.at(-1)[1], /帳簿を保存できません/);
  assert.equal(saveWarnings.length, 1, 'the real save function reports its storage failure');
  season.ctx.localStorage.setItem = (key, value) => season.storage.set(key, value);
  await season.click('一窓口で単勝・複勝', 'sf-desk');
  assert.equal(F.view(season.player.shingan.festival).plan.desk, 'place', 'the same operation can be retried after storage is available');
  season.ctx.saveGame = persistedSave;
  for (let i = 0; i < 30 && !F.view(season.player.shingan.festival).lastResult?.success; i++) {
    let book = season.player.shingan.festival, v = F.view(book);
    const candidates = v.dragons.filter(d => d.id !== v.oracle.id).sort((a, b) => Number(b.observation.match(/適性 (\d+)/)[1]) - Number(a.observation.match(/適性 (\d+)/)[1]));
    book = F.edit(book, v.eventId, { desk: 'mixed', place: candidates[0].id, wide: [v.oracle.id, candidates[0].id] });
    book = F.publish(book, v.eventId, book.revision);
    if (!F.view(book).lastResult.success) book = F.next(book, v.eventId, F.capture(season.player, { poroFound: true }), 19 + i);
    season.player.shingan.festival = book; season.ctx.saveGame();
  }
  assert(F.view(season.player.shingan.festival).lastResult.success, 'a valid day-success fixture must be reached');
  await season.render();
  assert.equal(season.ctx.ShinganOfficial.getOutcome().success, false, 'one day is not a seasonal rescue');
  assert.equal(season.all().some(n => n.textContent === '島の夜明けを見届ける'), false);
  const firstPeriod = season.all().find(n => n.textContent === 'この段取りで、営業と引渡しを進める');
  assert(firstPeriod && !firstPeriod.disabled); await firstPeriod.onclick();
  assert.equal(F.recoveryView(season.player.shingan.festival).history.length, 1);
  const periodOne = JSON.stringify(season.player.shingan.festival); await firstPeriod.onclick();
  assert.equal(JSON.stringify(season.player.shingan.festival), periodOne, 'a held callback cannot settle the next period');
  const reloaded = JSON.parse(season.storage.get('test-save')).player;
  assert.equal(F.recoveryView(F.restore(reloaded)).history.length, 1, 'the seasonal account survives a save/load');
  for (let i = 0; i < 12 && !F.recoveryView(season.player.shingan.festival).complete; i++) await season.click('この段取りで、営業と引渡しを進める');
  assert.equal(season.ctx.ShinganOfficial.getOutcome().success, true, 'the published day plus the completed business qualifies');
  assert(season.all().some(n => n.textContent === '島の夜明けを見届ける'));
  assert.equal(season.player.coins, originalWallet); assert.equal(season.player.epilogue.edFlag, undefined);
  assert.equal(season.ctx.marks, 0, 'completion only exposes the player-triggered ending; it does not set clear flags during settlement');
  console.log('PASS seasonal UI: no premature ending, finite coin amounts, stale-period rejection, save/load, and completed business opens the ending without wallet writes');

  const missing = { window: null, showInfoPopup: () => { missing.messages++; }, messages: 0 };
  missing.window = missing; vm.createContext(missing);
  vm.runInContext(fs.readFileSync(require.resolve('../js/shingan_official.js'), 'utf8'), missing);
  missing.renderShinganFairRace(); assert.equal(missing.messages, 1); assert.equal(missing.state, undefined);
  console.log('PASS missing V2 script: normal entry reports reload guidance instead of reopening retired V1 scoring');
})().catch(error => { console.error(error); process.exitCode = 1; });
