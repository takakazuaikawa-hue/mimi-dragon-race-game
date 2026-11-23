'use strict';
const assert = require('node:assert/strict');
const F = require('../js/shingan_festival.js'), R = require('../js/shingan_recovery.js');
const Life = require('../js/island_life_loop.js');
const copy = x => JSON.parse(JSON.stringify(x));
function player(opinion = 'different') {
  const entry = { id: 'outing-1', routeId: 'warm', startedAtRace: 3, completedRace: 4,
    channel: 'in_person', visited: true, visitedSpotId: 'makemeshi', opinion,
    experience: { kind: 'meal', id: 't_yakitori', name: '勝負めし焼き鳥' } };
  return { completedRaces: 4, meals: { eaten: { t_yakitori: true } }, islandLife: {
    version: 1, seq: 1, firstLocalStory: entry, history: [entry], conversations: { warm: entry },
    favorite: opinion === 'again' ? entry : null
  } };
}
function quote(p) {
  const snapshot = F.capture(p);
  return { snapshot, value: R.quote(R.view(R.opening([]), [], snapshot), { desk: 'market', contract: 'local' }, snapshot) };
}
for (const opinion of ['again', 'different', 'unsure']) {
  const p = player(opinion), captured = quote(p);
  assert.equal(captured.snapshot.mealConversation.opinion, opinion);
  assert(captured.value.notes.some(n => typeof n === 'string' && n.includes({ again: 'また、これ', different: '別の方', unsure: 'まだ、決めない' }[opinion])));
  const later = { id: 'outing-2', routeId: 'style', startedAtRace: 4, completedRace: 4, channel: 'in_person',
    visited: true, visitedSpotId: 'mall', opinion: 'again', experience: { kind: 'outfit', id: 'buniqro', name: '普段着' } };
  p.islandLife.favorite = later; p.islandLife.history = [later]; p.islandLife.conversations = { style: later };
  assert.equal(quote(p).snapshot.mealConversation.opinion, opinion, 'the permanent first local meal survives another favorite and a rolled diary');
}
for (const mutate of [
  e => { e.channel = 'sns'; },
  e => { e.visited = false; },
  e => { e.visitedSpotId = 'invented_stall'; },
  e => { e.completedRace = 5; }
]) {
  const p = player('again');
  for (const e of [p.islandLife.firstLocalStory, ...p.islandLife.history, ...Object.values(p.islandLife.conversations), p.islandLife.favorite]) mutate(e);
  const q = quote(copy(p)); assert.equal(q.snapshot.mealConversation, null);
  assert.equal(q.value.notes.some(n => typeof n === 'string' && n.startsWith('店で')), false);
}
const otherSave = player(); otherSave.meals.eaten = {};
assert.equal(quote(otherSave).snapshot.mealConversation, null);
const lasting = player('different');
const firstOutfit = { id: 'outing-1', routeId: 'style', startedAtRace: 3, completedRace: 3,
  channel: 'in_person', visited: true, visitedSpotId: 'mall', opinion: 'again',
  experience: { kind: 'outfit', id: 'buniqro', name: '普段着' } };
const laterMeal = { ...lasting.islandLife.firstLocalStory, id: 'outing-2' };
lasting.islandLife = Life.normalize({ version: 1, seq: 2, firstLocalStory: firstOutfit, history: [laterMeal], conversations: { warm: laterMeal }, favorite: firstOutfit });
assert.equal(lasting.islandLife.firstLocalMeal.id, 'outing-2');
const laterSNS = { ...laterMeal, id: 'outing-12', channel: 'sns', opinion: 'again' };
lasting.islandLife.history = [laterSNS]; lasting.islandLife.conversations.warm = laterSNS;
lasting.islandLife.favorite = { ...firstOutfit, id: 'outing-13' };
lasting.islandLife = Life.normalize(JSON.parse(JSON.stringify(lasting.islandLife)));
assert.equal(quote(lasting).snapshot.mealConversation.id, 'outing-2', 'an outfit-first player keeps a later real meal after the short diary and place conversation change');
console.log('PASS real on-site meal evidence: three honest responses, lasting memory after another favorite, no SNS-only/unknown-place/future/untried meal claims');
