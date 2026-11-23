#!/usr/bin/env node
"use strict";

// Real classic-script engine, isolated state and in-memory storage only.
// Run: node tools/check_epilogue_balance.cjs
// This is a progression regression check, not a win-rate or playtime simulation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const FILES = ["data_ranks", "data_assets", "state", "assets_engine", "event_hooks", "island", "epilogue_engine"];

function fresh() {
  const storage = new Map();
  const noop = () => {};
  const ctx = vm.createContext({
    console,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)) },
    document: { querySelector: () => null, querySelectorAll: () => [] },
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop
  });
  ctx.window = ctx;
  for (const name of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, "js", name + ".js"), "utf8"), ctx, { filename: name + ".js" });
  ctx.read = source => vm.runInContext(source, ctx);
  ctx.read("state.player.coins = 100000000; state.player.assetsPeak = 100000000; state.player.flags._chapter_intro_5 = true;");
  return ctx;
}
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.message.slice(0, 700)); }
}
function wardrobe(ctx, count) {
  ctx.__count = count;
  ctx.read("state.player.outfitsBought = OUTFITS.filter(o => o.acquire && o.acquire.price != null).slice(0, __count).map(o => o.id);");
}
function snapshot(ctx) {
  return ctx.read("JSON.stringify({ player: state.player, assets: state.assets, lifeTree: state.lifeTree, current: state.current })");
}

test("outfit contribution is pure and counts catalog ownership, not duplicate or unknown IDs", () => {
  const ctx = fresh();
  wardrobe(ctx, 6);
  const before = snapshot(ctx);
  const credit = ctx.read("epOutfitContribution(state.player)");
  assert.equal(snapshot(ctx), before);
  assert.ok(credit >= 0 && credit <= 12);
  ctx.read("state.player.outfitsWon = state.player.outfitsBought.concat(['not_a_catalog_outfit']); state.player.outfitsBought.push(state.player.outfitsBought[0]);");
  assert.equal(ctx.read("epOutfitContribution(state.player)"), credit);
});

test("pure ownership matches outfitOwned across free, assets, purchased, won and unavailable rewards", () => {
  const ctx = fresh();
  for (const peak of [0, 49999, 50000, 100000000]) {
    ctx.__peak = peak;
    ctx.read("state.player.assetsPeak=__peak; state.player.totalAssets=0; state.player.outfitsBought=['buniqro','dara']; state.player.outfitsWon=['jungle','dragonrobe','konron_photographer'];");
    const expected = ctx.read("Math.min(12, Math.floor(OUTFITS.filter(o => !o.acquire.free && outfitOwned(o)).length/3)*3)");
    const before = snapshot(ctx);
    assert.equal(ctx.read("epOutfitContribution(state.player)"), expected, "assetsPeak " + peak);
    assert.equal(snapshot(ctx), before);
  }
  ctx.read("state.player.assetsPeak=0; state.player.totalAssets=100000000;");
  const expected = ctx.read("Math.min(12, Math.floor(OUTFITS.filter(o => !o.acquire.free && outfitOwned(o)).length/3)*3)");
  assert.equal(ctx.read("epOutfitContribution(state.player)"), expected, "current assets can exceed the stored peak");
});

test("the same wardrobe earned before or after chapter 5 gives the same meter and credit", () => {
  const before = fresh(), after = fresh();
  wardrobe(before, 14);
  before.read("epilogueStart();");
  after.read("epilogueStart();");
  const ids = plain(before.read("state.player.outfitsBought"));
  after.__ids = ids;
  after.read("__ids.forEach(id => { const result = buyOutfit(id); if (!result.ok) throw new Error('purchase failed: ' + id); });");
  assert.equal(before.read("epData().meter"), after.read("epData().meter"));
  assert.equal(before.read("epData().outfitCredit"), after.read("epData().outfitCredit"));
  assert.equal(before.read("epData().finalReady"), false);
});

test("14 cheap outfits cannot unlock the finale, and repeated sync or rejected purchases pay nothing twice", () => {
  const ctx = fresh();
  ctx.read("epilogueStart();");
  ctx.read("OUTFITS.filter(o => o.acquire && o.acquire.price != null).sort((a,b) => a.acquire.price-b.acquire.price).slice(0,14).forEach(o => buyOutfit(o.id));");
  assert.equal(ctx.read("epData().outfitCredit"), 12);
  assert.equal(ctx.read("epData().meter"), 68);
  assert.equal(ctx.read("epData().finalReady"), false);
  const before = snapshot(ctx);
  ctx.read("for (let i=0;i<20;i++) { epSyncOutfits(); epPush('mallBuy'); buyOutfit(state.player.outfitsBought[0]); }");
  assert.equal(snapshot(ctx), before);
});

test("legacy active saves establish credit without retroactively moving their meter or clear flags", () => {
  for (const meter of [0, 10, 80, 104, 159]) {
    const ctx = fresh();
    wardrobe(ctx, 14);
    ctx.__meter = meter;
    ctx.read("state.player.epilogue = { active:true, meter:__meter, finalReady:false, edFlag:false, cycle:3 }; epSyncOutfits();");
    assert.equal(ctx.read("epData().meter"), meter);
    assert.equal(ctx.read("epData().finalReady"), false);
    assert.equal(ctx.read("epData().cycle"), 3);
    assert.equal(ctx.read("epData().outfitCredit"), 12);
    const before = snapshot(ctx);
    ctx.read("epSyncOutfits(); epPush('mallBuy');");
    assert.equal(snapshot(ctx), before);
  }
});

test("restarting or loading a current save cannot grant wardrobe credit a second time", () => {
  const ctx = fresh();
  wardrobe(ctx, 9);
  ctx.read("epilogueStart(); doomTick(); saveGame();");
  // loadGame also migrates unrelated legacy fields such as pendingPayout.
  const progress = "JSON.stringify({ep:state.player.epilogue,coins:state.player.coins,bought:state.player.outfitsBought,won:state.player.outfitsWon,collection:state.player.collection})";
  const before = ctx.read(progress);
  ctx.read("loadGame(); epilogueStart(); epSyncOutfits();");
  assert.equal(ctx.read(progress), before);
});

test("non-finite legacy credits are baselined without creating progress", () => {
  for (const value of [NaN, Infinity]) {
    const ctx = fresh();
    wardrobe(ctx, 14);
    ctx.__credit = value;
    ctx.read("state.player.epilogue={active:true,meter:104,finalReady:false,edFlag:false,cycle:2,outfitCredit:__credit}; epSyncOutfits();");
    assert.equal(ctx.read("epData().meter"), 104);
    assert.equal(ctx.read("epData().outfitCredit"), 12);
    assert.equal(ctx.read("epData().finalReady"), false);
  }
});

test("a migrated save earns only the next new wardrobe milestone", () => {
  const ctx = fresh();
  wardrobe(ctx, 3);
  ctx.read("state.player.epilogue={active:true,meter:104,finalReady:false,edFlag:false,cycle:2}; epSyncOutfits();");
  const credited = ctx.read("epData().outfitCredit");
  assert.equal(credited, 3); // Three purchased plus the two asset-unlocked clothes.
  ctx.read("buyOutfit(OUTFITS.filter(o => o.acquire && o.acquire.price != null)[3].id);");
  assert.equal(ctx.read("epData().outfitCredit"), 6);
  assert.equal(ctx.read("epData().meter"), 101);
  ctx.read("epilogueStart(); epSyncOutfits();");
  assert.equal(ctx.read("epData().meter"), 101);
});

test("friendship is not economic credit; asset-level, hit, win and doom retain their progression", () => {
  for (const [reason, points] of [["scoutNew",0], ["assetLevel",16], ["hit",6], ["win",11]]) {
    const ctx = fresh();
    ctx.read("epilogueStart(); epData().meter=80;");
    ctx.__reason = reason;
    ctx.read("epPush(__reason); doomTick();");
    assert.equal(ctx.read("epData().meter"), 80-points+3, reason);
  }
});

test("epilogue progress never changes a settled race, odds, payout, wallet or dragon records", () => {
  const ctx = fresh();
  ctx.read("state.current={raceResult:{entries:[{id:'poro',rank:2,time:123.45}]},oddsData:{poro:{win:12.3,place:2.4}},betResult:{hit:true,payout:240,wager:100}}; state.player.collection={poro:{records:{racesSeen:12,playerHitCount:4}}}; epilogueStart();");
  const protectedState = "JSON.stringify({current:state.current,coins:state.player.coins,collection:state.player.collection})";
  const before = ctx.read(protectedState);
  ctx.read("epPush('hit'); epPush('scoutNew'); epPushAmount(3); doomTick(); epSyncOutfits();");
  assert.equal(ctx.read(protectedState), before);
});

test("four new scouts cannot declare the island rescued or complete its preparation meter", () => {
  const ctx = fresh();
  ctx.read("epilogueStart(); for(let i=0;i<4;i++) epPush('scoutNew');");
  assert.equal(ctx.read("epData().meter"), 80);
  assert.equal(ctx.read("epData().finalReady"), false);
});

test("island-only preparation can still finish with 35.25 million liquid coins and 12 upgrades", () => {
  const ctx = fresh();
  ctx.read("epilogueStart(); state.player.coins=35250000; var __plan={infra:2,commerce:2,race:2,dragon:4,public:1,industry:1}; Object.keys(__plan).forEach(id => { for(let i=0;i<__plan[id];i++) { if(!islandInvest(islandCat(id))) throw new Error('investment failed: '+id); } });");
  assert.equal(ctx.read("state.player.coins"), 0);
  assert.equal(ctx.read("computeIslandValue(state)"), 35250000);
  assert.equal(ctx.read("islandDevTotal()"), 12);
  assert.equal(ctx.read("epData().meter"), 0);
  assert.equal(ctx.read("epData().finalReady"), true);
});

test("ready or cleared finales do not resume doom or accept further progress", () => {
  for (const flag of ["finalReady", "edFlag"]) {
    const ctx = fresh();
    wardrobe(ctx, 14);
    ctx.__flag = flag;
    ctx.read("epilogueStart(); epData()[__flag]=true; epData().meter=0;");
    const before = snapshot(ctx);
    ctx.read("epPush('scoutNew'); epPush('win'); epPush('mallBuy'); epSyncOutfits(); epPushAmount(25); doomTick();");
    assert.equal(snapshot(ctx), before);
  }
});

console.log(`${passed} passed; ${failed} failed. Isolated VM only; no real browser save was accessed.`);
process.exitCode = failed ? 1 : 0;
