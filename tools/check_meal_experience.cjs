"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

const ctx = vm.createContext({ state: { player: { flags: {}, meals: { eaten: { unknown_dish: true } } } },
  registerEvent() {}, saveGame() {}, unlockDelayDay: (_key, eligible) => eligible });
ctx.window = ctx;
const run = source => vm.runInContext(source, ctx);
for (const name of ["meals", "kiko_serial", "goals", "ui_kiko", "event_registry", "sns"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", name + ".js"), "utf8"), ctx, { filename: name + ".js" });
}
const check = n => {
  assert.equal(run("mealEatenCount()"), n);
  assert.equal(run("_r4MealCount()"), n);
  assert.equal(run("GOALS.find(g => g.id === 'firstMeal').done()"), n > 0);
  assert.equal(run("kikoSerialById('s10').need().length === 0"), n >= 5);
  assert.equal(run("SNS_POSTS.find(p => p.id === 'p_gourmet').unlock()"), n >= 10);
  assert.equal(run("_kikoCats().find(c => c.tag === 'たべある記').stat"), n + "/" + run("MEALS.length"));
};
run("const dishes = MEALS.filter(m => m.tier === 'gourman' && m.quiz)");
run("dishes.slice(0,5).forEach(m => solveMeal(m.id))");
assert.equal(run("mealStatsAll().got"), 5);
check(0);
run("dishes.slice(5,10).forEach(m => solveMeal(m.id))");
assert.equal(run("mealStatsAll().got"), 10);
check(0);
run("eatMeal(dishes[0].id); eatMeal(dishes[0].id)");
check(1);
run("dishes.slice(1,5).forEach(m => eatMeal(m.id))");
check(5);
run("dishes.slice(5,10).forEach(m => eatMeal(m.id))");
check(10);
assert.equal(run("mealStatsAll().got"), 10);
console.log("Meal journal, serial, dialogue, first-meal goal and SNS follow actual distinct meals while preserving quiz knowledge.");
