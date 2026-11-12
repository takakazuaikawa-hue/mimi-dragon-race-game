#!/usr/bin/env node
// 序盤の財布を、本物のゲームの式で測る（確認専用・ゲームの数値は変えない）。
// ゲームをブラウザ（画面なし・消音）で開き、画面は描かずに「賭ける→走る→精算」の実関数だけを回す。
//   使い方: node tools/sim_early_wallet.mjs <url> [人数=150] [戦数=30] [1日の戦数=8] [服の値段を仮に替える]
//   例:     node tools/sim_early_wallet.mjs http://localhost:8767/ 150 30 8
// 賭け方5通り（慎重＝単勝100固定／複勝100固定／財布の2割／財布の半分を3番人気／最大）ごとに、
//   最初の服（ブニクロ普段着）に届く戦・無心の回数と額・ランク2の戦・借金が消える戦と、そのときの勝ち数を出す。
// ★Playwright は別プロジェクトのものを借りる（このリポジトリは依存ゼロ）。
import { createRequire } from "node:module";
const require = createRequire("C:/Users/takakazu/projects/mimi_gamble_guild/");
const { chromium } = require("playwright");
const [url, nS, rS, dS, pS] = process.argv.slice(2);
const N = +nS || 150, R = +rS || 30, PER_DAY = +dS || 8, PRICE = +pS || 0;   // PRICE＝最初の服の値段を仮に替えて測る（0＝ゲームの値のまま）
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage(); page.setDefaultTimeout(0);
const errs = []; page.on("pageerror", e => { if (errs.length < 5) errs.push(String(e).slice(0, 200)); });
await page.goto(url, { waitUntil: "load" }); await page.waitForTimeout(2500);

const out = await page.evaluate(({ N, R, PER_DAY, PRICE }) => {
  if (PRICE) { const o = OUTFITS.find(x => x.id === "buniqro"); if (o) o.acquire.price = PRICE; }   // このページの中だけの仮の値
  // 画面を描く関数・保存・会話は止める（式は触らない）
  try { Sfx.setMuted(true); if (window.Bgm && Bgm.setMuted) Bgm.setMuted(true); } catch (e) {}
  window.renderRaceRun = function () {};
  window.saveGame = function () {};
  window.updateHeader = function () {};
  window.showInfoPopup = function () {};
  if (window.Dialogue) { Dialogue.play = function () { return Promise.resolve(); }; }
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const STR = {
    "A 慎重（単勝100）":   { type: "win",   pick: 1, wager: (coins, cap) => Math.min(100, cap) },
    "B 慎重（複勝100）":   { type: "place", pick: 1, wager: (coins, cap) => Math.min(100, cap) },
    "C ふつう（財布の2割）": { type: "win", pick: 1, wager: (coins, cap) => Math.max(100, Math.min(cap, Math.floor(coins * 0.2 / 100) * 100)) },
    "D 強気（半分を3番人気）": { type: "win", pick: 3, wager: (coins, cap) => Math.max(100, Math.min(cap, Math.floor(coins * 0.5 / 100) * 100)) },
    "E 最大":             { type: "win",   pick: 1, wager: (coins, cap) => cap }
  };
  const price = buniqroPrice();
  const homeMeals = MEALS.filter(m => !m.quiz && !m.where).sort((a, b) => mealPrice(a) - mealPrice(b));
  const res = {};
  for (const name in STR) {
    const st = STR[name];
    const A = { reachBuy: [], never: 0, viaRescue: 0, rescues: [], firstRescueAt: [], firstRescueAmt: [], rank2At: [], debtAt: [], debtWins0: 0, debtNever: 0, stuckFood: 0, coinsAt: { 5: [], 10: [], 15: [], 20: [], 30: [] }, win1At: [], ch2At: [] };
    for (let t = 0; t < N; t++) {
      resetGame();
      const p = state.player; p.flags = p.flags || {}; p.flags.sakeGiftSeen = true;
      state.current = {};
      let bought = false, reach = null, nRescue = 0, firstR = null, rank2 = null, debt0 = null, viaR = false, win1 = null, day = 0;
      for (let n = 1; n <= R; n++) {
        // 日が替わる（注目ボーナスと「負けた日のおごり」が戻る。ログインボーナスと印税は数えない＝控えめな見積もり）
        const d = Math.floor((n - 1) / PER_DAY);
        if (d !== day) { day = d; p.featuredDoneDay = null; p._freeMealDay = null; }
        // 無心
        let rescuedNow = false;
        if (p.coins <= 0) { const amt = calculateRescueCoins(state, p.rank); p.coins += amt; p.brokeCount = (p.brokeCount || 0) + 1; nRescue++; rescuedNow = true; if (firstR == null) { firstR = n; A.firstRescueAt.push(n); A.firstRescueAmt.push(amt); } }
        // 服（買えるなら買う＝第2話の門）
        if (!bought && p.coins >= price) { bought = true; reach = n; if (rescuedNow) viaR = true; p.coins -= price; }
        // ごはん（走れないときだけ、いちばん安い自宅ごはん）
        if (!hungerCanRace()) { for (const m of homeMeals) { const before = hungerGet(); try { eatMeal(m.id); } catch (e) {} if (hungerGet() > before) break; } }
        if (!hungerCanRace()) { A.stuckFood++; if (p.coins > 0) { p.coins = 0; } continue; }   // 食べられず走れない＝手詰まり（次の周で無心へ）
        // レース：はじめの3戦は第1レース、以後はいまのランク帯を順ぐり
        const pool = RACES.filter(r => r.rank === p.rank);
        const race = (p.completedRaces < 3) ? RACES.find(r => r.id === "race_grandclock_1") : pool[(p.completedRaces) % pool.length];
        const or_ = simulateMarket(race);
        const tf = {}; getRaceDragons(race).forEach(dg => { tf[dg.id] = generateForm(dg); });
        const byPop = or_.oddsData.slice().sort((a, b) => a.popularityRank - b.popularityRank);
        const cap = RANKS[race.rank].maxWager * (VILLAGE_MULT[p.villageLevel] || 1);
        const wager = Math.max(1, Math.min(p.coins, st.wager(p.coins, cap)));
        state.current = { race, oddsResult: or_, trialForms: tf, bet: { type: st.type, selections: [byPop[st.pick - 1].dragonId], wager } };
        hungerSpendRace();
        try { onConfirmBet(true); settleRace(); } catch (e) { A.err = String(e).slice(0, 160); break; }
        if (rank2 == null && p.rank >= 2) rank2 = n;
        if (win1 == null && (p.wins || 0) >= 1) win1 = n;
        if (debt0 == null && mimiDebtLeft() <= 0) { debt0 = n; if ((p.wins || 0) === 0) A.debtWins0++; }
        if (A.coinsAt[n]) A.coinsAt[n].push(p.coins);
      }
      if (reach == null) A.never++; else { A.reachBuy.push(reach); if (viaR) A.viaRescue++; }
      A.rescues.push(nRescue);
      if (rank2 != null) A.rank2At.push(rank2);
      if (win1 != null) A.win1At.push(win1);
      if (debt0 != null) A.debtAt.push(debt0); else A.debtNever++;
    }
    res[name] = {
      "服に届く戦（中央/25%/75%）": [med(A.reachBuy), q(A.reachBuy, 0.25), q(A.reachBuy, 0.75)],
      [`${R}戦で届かない人`]: Math.round(A.never / N * 100) + "%",
      "無心の直後に買えた人": Math.round(A.viaRescue / N * 100) + "%",
      "無心の回数（中央/最大）": [med(A.rescues), Math.max.apply(null, A.rescues)],
      "最初の無心の戦と額（中央）": [med(A.firstRescueAt), med(A.firstRescueAmt)],
      "ランク2の戦（中央）": med(A.rank2At),
      "初勝利の戦（中央）と未勝利の人": [med(A.win1At), Math.round((N - A.win1At.length) / N * 100) + "%"],
      "借金が消える戦（中央）": med(A.debtAt), "そのとき0勝だった人": Math.round(A.debtWins0 / N * 100) + "%", "消えない人": Math.round(A.debtNever / N * 100) + "%",
      "所持コインの中央（5/10/15/20/30戦後）": [5, 10, 15, 20, 30].map(k => med(A.coinsAt[k])),
      "食べられず走れなかった回数": A.stuckFood, err: A.err || ""
    };
  }
  return { price, res };
}, { N, R, PER_DAY, PRICE });

console.log(`最初の服の値段=${out.price}  人数=${N}  戦数=${R}  1日=${PER_DAY}戦`);
for (const k in out.res) { console.log("\n【" + k + "】"); for (const m in out.res[k]) if (out.res[k][m] !== "") console.log("  " + m + ": " + JSON.stringify(out.res[k][m])); }
if (errs.length) console.log("\nPAGE ERRORS:", errs.join(" | "));
await browser.close();
