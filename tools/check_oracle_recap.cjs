'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const ctx = vm.createContext({ console, Math });
for (const file of ['bet_story', 'recap_engine']) vm.runInContext(fs.readFileSync(require.resolve('../js/' + file + '.js'), 'utf8'), ctx);
const known = { dragonId: 'rosso', _celestia: true, popularityRank: 6, winOdds: 1.1 };
const result = { entries: [{ dragon: { id: 'rosso', name: 'ロッソ' }, rank: 1 }, { dragon: { id: 'other', name: '別の竜' }, rank: 4 }] };
for (const type of ['win', 'place', 'wide']) {
  const bet = { type, selections: type === 'wide' ? ['rosso', 'other'] : ['rosso'], wager: 200 };
  for (const hit of type === 'wide' ? [true, false] : [true]) {
    const c = { _celestiaRevealed: 'rosso', oddsResult: { oddsData: [known] }, raceResult: result, bet, betResult: { hit, payout: hit ? 220 : 0 } };
    const before = JSON.stringify(c);
    for (const key of ['kan', 'data', 'tell', 'value']) {
      const line = ctx.reasonReplyLine(c, key); assert.match(line, /予言/); assert.doesNotMatch(line, /うまみを拾|読み切った|人気の裏/);
    }
    const recap = ctx.buildMimiRecap(bet, c.betResult, result, { rosso: known });
    assert.match(recap, /教わ/); assert.doesNotMatch(recap, /数字より竜|わたしだけ|誰も掘|豪華/);
    assert.equal(JSON.stringify(c), before, 'oracle-result prose never changes bets, odds, results or payouts');
  }
}
const ordinaryBet = { type: 'win', selections: ['other'] };
const ordinaryRecap = ctx.buildMimiRecap(ordinaryBet, { hit: true }, result, { rosso: known, other: { popularityRank: 1 } });
assert.doesNotMatch(ordinaryRecap, /教わった/);
console.log('PASS oracle-backed win/place and partial wide are described honestly; other picks retain ordinary dialogue and all numerical inputs remain unchanged');
