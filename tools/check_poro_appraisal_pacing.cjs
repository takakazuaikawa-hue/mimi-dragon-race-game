'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function game(races) {
  const pending = [], ctx = { console, DRAGONS: [], state: { player: { coins: 777, wins: 2, completedRaces: races,
    flags: { poroMet: true, _poroBeatAt: 5 }, collection: {} }, ui: { screen: 'collection' } },
    saveGame() {}, setTimeout() {}, Dialogue: { registerCast() {}, play: () => new Promise(resolve => pending.push(resolve)) } };
  ctx.window = ctx; ctx.getStoryFlag = key => !!ctx.state.player.flags[key];
  ctx.setStoryFlag = (key, value) => { ctx.state.player.flags[key] = value; };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(require.resolve('../js/poro.js'), 'utf8'), ctx);
  return { ctx, pending };
}
(async () => {
  const early = game(5);
  assert.equal(early.ctx.poroAppraisalWaiting().left, 1);
  assert.equal(early.ctx.maybePlayPoroBeat(false), false, 'discovery and appraisal stay separate scenes');
  const ready = game(6);
  assert.equal(ready.ctx.poroAppraisalWaiting().left, 0);
  assert.equal(ready.ctx.maybePlayPoroBeat(false), true);
  assert.equal(ready.ctx.maybePlayPoroBeat(false), false, 'a second tap cannot start the same scene twice');
  assert.equal(ready.ctx.poroFound(), false, 'eligibility alone never grants the companion');
  ready.pending[0](); await Promise.resolve();
  assert.equal(ready.ctx.poroFound(), true); assert.equal(ready.ctx.poroScoutUnlocked(), true);
  assert.equal(ready.ctx.state.player.completedRaces, 6); assert.equal(ready.ctx.state.player.coins, 777);
  assert.equal(ready.ctx.poroAppraisalWaiting(), null);
  assert.equal(ready.ctx._poroGapOk({ id: 'fu_mizu' }), false, 'advisor followups retain their two-race spacing');
  ready.ctx.state.player.completedRaces = 7; assert.equal(ready.ctx._poroGapOk({ id: 'fu_mizu' }), false);
  ready.ctx.state.player.completedRaces = 8; assert.equal(ready.ctx._poroGapOk({ id: 'fu_mizu' }), true);
  const switched = game(6); switched.ctx.maybePlayPoroBeat(false);
  switched.ctx.state.player = { wins: 2, completedRaces: 6, coins: 111, flags: {}, collection: {} };
  switched.pending[0](); await Promise.resolve();
  assert.equal(switched.ctx.poroFound(), false, 'a scene from another save does not grant a companion');
  console.log('PASS discovery → one actual race → native appraisal; no early or duplicate grant, unchanged coins/races, two-race followups and cross-save safety');
})().catch(error => { console.error(error); process.exitCode = 1; });
