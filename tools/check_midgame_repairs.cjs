#!/usr/bin/env node
"use strict";

// Real meal/mall code in isolated VMs; no real save, network, or browser access.
// Run: node tools/check_midgame_repairs.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const src = name => fs.readFileSync(path.join(ROOT, "js", name + ".js"), "utf8");
const noop = () => {};
function element() {
  return {
    style: {}, dataset: {}, children: [], innerHTML: "", classList: { add: noop, remove: noop, toggle: noop },
    appendChild(child) { this.children.push(child); return child; }, remove: noop, addEventListener: noop,
    querySelector() { return element(); },
    querySelectorAll(selector) {
      if (selector !== ".mex-buy") return [];
      if (this._buttonsHtml === this.innerHTML) return this._buttons;
      this._buttonsHtml = this.innerHTML;
      this._buttons = [...this.innerHTML.matchAll(/data-i="(\d+)"/g)].map(match => {
        const button = element(); button.getAttribute = () => match[1]; return button;
      });
      return this._buttons;
    }
  };
}
function context(files) {
  const ctx = vm.createContext({
    console, state: { player: { coins: 10000, hunger: 20, assetsPeak: 1000000, totalAssets: 1000000, rank: 4, flags: {}, collection: {} }, current: null },
    document: { createElement: element, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, body: element() },
    Image: element, Audio: element,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    el: element, updateHeader: noop, showInfoPopup: noop, _showUnlockToast: noop,
    materials: [], lifeEvents: [], field: {}, saves: 0,
    saveGame() { ctx.saves++; },
    assetsPeak(st) { const p = st.player; return Math.max(p.assetsPeak || 0, p.totalAssets || 0); },
    chapterRead(id) { return !!ctx.state.player.flags["_chapter_intro_" + id]; },
    kikoMatPush(type, data) { ctx.materials.push({ type, data }); },
    recordIslandLifeEvent(event) { ctx.lifeEvents.push(event); },
    FieldStats: { bump(key) { ctx.field[key] = (ctx.field[key] || 0) + 1; } }
  });
  ctx.window = ctx;
  ctx.read = code => vm.runInContext(code, ctx);
  for (const file of files) vm.runInContext(src(file), ctx, { filename: "js/" + file + ".js" });
  return ctx;
}
function food() {
  const ctx = context(["meals", "hunger"]);
  // Load the real hidden-spot predicates without booting the whole map UI.
  const map = src("ui_konron_map"), start = map.indexOf("const KM_HIDDEN ="), end = map.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start, "hidden-spot declaration not found");
  ctx.read(map.slice(start, end + 3));
  ctx.read("mealData();");
  return ctx;
}
function mall() {
  const ctx = context(["mall_rpg", "mall_express"]);
  // Only presentation and animation are stubbed; inventory, shops, currency,
  // migration, reward rolls, and battle-item effects use the real functions.
  ctx.read("rpgSfx=function(){}; rpgBLog=function(){}; rpgPlayerPt=function(){return {x:0,y:0};}; rpgFx.spot=function(){}; rpgFx.flash=function(){}; mexPopup=function(){}; mexPopupEl=function(t,b){window.lastPopupBody=b;};");
  ctx.read("rpgData();");
  return ctx;
}
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.message.slice(0, 600)); }
}
function foodSnapshot(ctx) { return JSON.stringify({ coins:ctx.state.player.coins, hunger:ctx.state.player.hunger, meals:ctx.state.player.meals, materials:ctx.materials, lifeEvents:ctx.lifeEvents, field:ctx.field }); }

test("low-asset chapter readings open their travel destinations and food tiers while hidden meals still need a real tasting", () => {
  const ctx = context(["meals", "ui_konron_map"]);
  const p = ctx.state.player;
  p.totalAssets = 0;
  for (const [peak, chapter, expected] of [
    [2999, 3, [false, false, false, false, false]],
    [3000, 3, [true, false, false, false, false]],
    [3600, 4, [true, true, false, true, false]],
    [3600, 5, [true, true, true, true, true]],
    [1000000, 3, [true, true, false, true, false]],
    [100000000, 3, [true, true, true, true, false]]
  ]) {
    p.assetsPeak = peak;
    p.flags._chapter_intro_4 = chapter >= 4;
    p.flags._chapter_intro_5 = chapter >= 5;
    const actual = ctx.read("[_kmSpotOpen(KONRON_SPOTS.tanada),_kmSpotOpen(KONRON_SPOTS.kazami_yagura),_kmSpotOpen(KONRON_SPOTS.rondo),mealTierUnlocked('gourman'),mealTierUnlocked('shinbo')]");
    assert.deepEqual(Array.from(actual), expected);
    assert.equal(ctx.read("_kmHiddenQuiet('ura_bistro')"), false);
    assert.equal(p.totalAssets, 0);
    assert.equal(p.assetsPeak, peak);
  }
});

test("unsolved quizzes, unopened tiers, unknown meals and insufficient funds return false without consuming anything", () => {
  for (const setup of [
    "var __meal='g_pasta';", // unlocked tier, unsolved quiz
    "var __meal='s_ramen'; solveMeal(__meal);", // chapter 5 is still closed
    "var __meal='g_pasta'; solveMeal(__meal); state.player.coins=0;",
    "var __meal='not_a_meal';"
  ]) {
    const ctx = food(); ctx.read(setup);
    const before = foodSnapshot(ctx);
    assert.equal(ctx.read("eatMeal(__meal)"), false);
    assert.equal(foodSnapshot(ctx), before);
  }
});

test("solving pasta alone neither eats it nor generates material nor opens the hidden seat", () => {
  const ctx = food();
  ctx.read("solveMeal('g_pasta');");
  assert.equal(ctx.read("mealSolved('g_pasta')"), true);
  assert.equal(ctx.read("mealEaten('g_pasta')"), false);
  assert.equal(ctx.read("KM_HIDDEN.ura_bistro.cond()"), false);
  assert.equal(ctx.materials.length, 0);
  assert.equal(ctx.state.player.coins, 10000);
  assert.equal(ctx.state.player.hunger, 20);
});

test("explicitly eating solved pasta pays, fills hunger, creates one first-taste material and opens the hidden seat", () => {
  const ctx = food();
  ctx.read("solveMeal('g_pasta');");
  const cost = ctx.read("mealPrice(MEALS.find(m=>m.id==='g_pasta'))");
  const heal = ctx.read("mealHeal(MEALS.find(m=>m.id==='g_pasta'))");
  assert.equal(ctx.read("eatMeal('g_pasta')"), true);
  assert.equal(ctx.state.player.coins, 10000-cost);
  assert.equal(ctx.state.player.hunger, Math.min(100, 20+heal));
  assert.equal(ctx.read("KM_HIDDEN.ura_bistro.cond()"), true);
  assert.equal(ctx.materials.filter(row=>row.type==="newMeal").length, 1);
  assert.equal(ctx.field.tourEats, 1);
  ctx.state.player.hunger = 10;
  assert.equal(ctx.read("eatMeal('g_pasta')"), true);
  assert.equal(ctx.state.player.coins, 10000-2*cost);
  assert.equal(ctx.materials.filter(row=>row.type==="newMeal").length, 1);
  assert.equal(ctx.field.tourEats, 1);
});

test("first tasting at full hunger succeeds, but a repeated full-hunger order does not charge or notify", () => {
  const ctx = food(); ctx.state.player.hunger = 100;
  assert.equal(ctx.read("eatMeal('h_onigiri')"), true);
  assert.equal(ctx.state.player.hunger, 100);
  assert.equal(ctx.materials.length, 1);
  const before = foodSnapshot(ctx);
  assert.equal(ctx.read("eatMeal('h_onigiri')"), false);
  assert.equal(foodSnapshot(ctx), before);
});

test("food repairs leave actual results, odds, payouts and unrelated player progress untouched", () => {
  const ctx = food();
  ctx.state.current = { betResult:{hit:true,payout:350,wager:100}, raceResult:{entries:[{id:"poro",rank:2}]}, oddsResult:{win:3.5} };
  const protectedData = () => JSON.stringify({ current:ctx.state.current, rank:ctx.state.player.rank, collection:ctx.state.player.collection, peak:ctx.state.player.assetsPeak });
  const before = protectedData();
  ctx.read("solveMeal('g_pasta'); eatMeal('g_pasta');");
  assert.equal(protectedData(), before);
});

test("legacy express item aliases merge once and preserve existing quantities and unrelated items", () => {
  const ctx = mall();
  ctx.read("state.player.rpg.items={potion:3,ether:2,pot:4,eth:5,calm:6,souvenir:9}; rpgData();");
  const items = JSON.parse(ctx.read("JSON.stringify(rpgData().items)"));
  assert.deepEqual(items, { potion:7, ether:7, calm:6, souvenir:9 });
  ctx.read("rpgData(); rpgData();");
  assert.deepEqual(JSON.parse(ctx.read("JSON.stringify(rpgData().items)")), items);
});

test("express loot grants usable potion and ether keys", () => {
  const ctx = mall();
  ctx.read("RPG={express:{build:[],loot:[]}}; rpgData().items={potion:0,ether:0,calm:0}; var __rolls=[0.6,0.9]; Math.random=function(){return __rolls.shift();}; mexLoot();");
  assert.equal(ctx.read("rpgData().items.potion"), 1);
  assert.equal(ctx.read("rpgData().items.ether"), 1);
  assert.equal(ctx.read("Object.hasOwn(rpgData().items,'pot')||Object.hasOwn(rpgData().items,'eth')"), false);
});

test("express shop purchases use the same consumable keys and retain normal and discounted costs", () => {
  for (const discounted of [false,true]) {
    const ctx = mall(); ctx.__discounted = discounted;
    ctx.read("RPG={express:{build:__discounted?['nego']:[],loot:[]}}; rpgData().gold=100; rpgData().items={potion:0,ether:0,calm:0}; mexShop(); lastPopupBody.querySelectorAll('.mex-buy')[0].onclick(); lastPopupBody.querySelectorAll('.mex-buy')[1].onclick();");
    assert.equal(ctx.read("rpgData().items.potion"), 1);
    assert.equal(ctx.read("rpgData().items.ether"), 1);
    assert.equal(ctx.read("rpgData().gold"), discounted ? 65 : 50);
    assert.equal(ctx.state.player.coins, 10000);
  }
});

test("the shared battle actually consumes the repaired potion and ether with unchanged healing", () => {
  const ctx = mall();
  ctx.read("var d=rpgData(); d.hp=1; d.mp=0; d.maxhp=100; d.maxmp=50; d.items={potion:2,ether:2}; RPG={battle:{phase:'cmd',pstatus:{stun:1,defdown:1,dazzle:1,seal:1}},busy:false}; rpgUseItem('potion');");
  assert.equal(ctx.read("rpgData().hp"), 41);
  assert.equal(ctx.read("rpgData().items.potion"), 1);
  assert.equal(ctx.read("RPG.battle.pstatus.seal"), 0);
  ctx.read("RPG.busy=false; RPG.battle.phase='cmd'; rpgUseItem('ether');");
  assert.equal(ctx.read("rpgData().mp"), 20);
  assert.equal(ctx.read("rpgData().items.ether"), 1);
  assert.equal(ctx.state.player.coins, 10000);
});

test("16G express earnings go directly to its wallet; regular runs still use the wagon and towers do not", () => {
  for (const [setup, wallet, wagon] of [
    // Battle rewards arrive while the shared engine has mode='battle'.
    ["RPG={mode:'battle',express:{build:[],loot:[],gold0:0,floor:1},wagon:0}",16,0],
    ["RPG={mode:'explore',fi:0,wagon:0}",0,16],
    ["RPG={mode:'explore',tower:true,wagon:0}",16,0]
  ]) {
    const ctx = mall(); ctx.read(setup+"; rpgData().gold=0; rpgGainGold(16);");
    assert.equal(ctx.read("rpgData().gold"), wallet, setup);
    assert.equal(ctx.read("RPG.wagon||0"), wagon, setup);
    assert.equal(ctx.state.player.coins, 10000);
  }
});

test("express exit preserves direct earnings and settles a legacy wagon exactly once", () => {
  for (const legacyWagon of [0,16]) {
    const ctx = mall(); ctx.__wagon = legacyWagon;
    ctx.read("rpgData().gold=5; RPG={mode:'battle',express:{build:[],loot:[],gold0:5,floor:2},wagon:__wagon}; rpgGainGold(16); mexFinish('quit');");
    assert.equal(ctx.read("RPG"), null);
    assert.equal(ctx.read("rpgData().gold"), 21+legacyWagon);
    const before = ctx.read("rpgData().gold");
    ctx.read("mexFinish('quit'); rpgData(); rpgCashOut();");
    assert.equal(ctx.read("rpgData().gold"), before);
    assert.equal(ctx.state.player.coins, 10000);
  }
});

console.log(`${passed} passed; ${failed} failed. Isolated VM only; no real save was read or written.`);
process.exitCode = failed ? 1 : 0;
