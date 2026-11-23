'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const c = vm.createContext({ console, assert, document: { addEventListener() {} }, state: { player: {} } });
c.window = c;
for (const name of ['data_dragons', 'data_dragons_ext', 'scout_stalk']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), c);
}
vm.runInContext(`
_stalkRender = () => {};
_stalkReachHeart = () => { _stalk.over = true; };
_stalkLose = () => { _stalk.over = true; };
const moves = [[0,-1],[-1,0],[1,0],[0,1],[0,0]];
const records = {}, shared = new Map(), signs = new Set();
function solve(start) {
  const queue = [{ s: start, path: [] }], visited = new Set();
  for (let i = 0; i < queue.length; i++) {
    const { s, path } = queue[i];
    const key = [s.turn,s.mimi.c,s.mimi.r,s.drg.c,s.drg.r,s.drg.dir,s.moveStreak,s.sleeping,s.sweeping].join();
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [dc, dr] of moves) {
      const next = stalkStep(s, dc, dr);
      if (!next || next.alarm || next.loss || next.turn > STALK_TURNS - STALK_TALK_COST) continue;
      const route = [...path, [dc, dr]];
      if (next.reached) return route;
      queue.push({s:next, path:route});
    }
  }
}
for (const d of DRAGONS) {
  if (STALK_FIELD[d.id]) {
    for (const clarified of [false,true]) {
      const text = stalkTalkObservation(d.id, clarified);
      assert(!signs.has(text), 'each of the seven has its own observable gesture');
      signs.add(text);
    }
  }
  for (let map = 0; map < STALK_MAPS.length; map++) for (const dir of [1,3]) {
    _stalkStart('grass', d, 0, false);
    const start = { ..._stalk, map: STALK_MAPS[map], drg: {..._stalk.drg,dir} };
    const [c,r] = STALK_FIELD[d.id] ? STALK_FIELD[d.id].start : [3,1];
    start.drg = { c:start.map[r][c] === '.' ? c : 3,r,dir };
    const key = [STALK_FIELD[d.id] ? d.id : start.temper, map,dir].join();
    const route = shared.get(key) || solve(start);
    assert(route, 'zero-alarm route with talk time ' + [d.id,map,dir]);
    shared.set(key, route);
    _stalk = start;
    for (const [dc,dr] of route) {
      const forecast = stalkStep(_stalk,dc,dr);
      stalkAct(dc || dr ? 'move' : 'wait',dc,dr);
      assert.deepEqual({..._stalk,over:false},{...forecast,over:false});
    }
    assert(_stalk.reached && _stalk.alarm === 0);
    if (STALK_FIELD[d.id]) (records[d.id] ||= []).push(route.length);
  }
}
assert.equal(signs.size, 14);
for (const [name, [id, turn, alarm, dc, dr]] of Object.entries({
  time: ['fugaku',23,0,0,0], alarm: ['goka',2,2,1,0]
})) {
  _stalkStart('grass',DRAGONS.find(d=>d.id===id),0,false);
  _stalk.map = STALK_MAPS[0]; _stalk.drg={c:3,r:1,dir:3};
  _stalk.mimi=name==='alarm'?{c:3,r:2}:{c:3,r:7}; _stalk.turn=turn; _stalk.alarm=alarm; _stalk.moveStreak=1;
  const result=stalkStep(_stalk,dc,dr);
  assert.equal(result.loss,name); if(name==='alarm') assert.equal(result.cause,'sound');
}
console.log('PASS',DRAGONS.length*6,'zero-alarm board routes replayed through stalkAct',JSON.stringify(records));
`, c);
