"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const life = require("../js/island_life_loop.js");

const scripts = ["data_dragons", "data_dragons_ext", "data_assets", "meals", "poro", "scout_engine", "epilogue_engine"]
  .map(name => new vm.Script(fs.readFileSync(path.join(__dirname, "../js", name + ".js"), "utf8"), { filename: name + ".js" }));

function showcase(player) {
  const ctx = vm.createContext({ state: { player }, IslandLifeLoop: life });
  for (const script of scripts) script.runInContext(ctx);
  return vm.runInContext("finalShowcaseBeats()", ctx);
}

function mealReply(opinion, raw) {
  const ctx = { enabled: true, completedRaces: 3, openSpots: ["makemeshi"], currentSpotId: "makemeshi",
    meals: [{ id: "t_yakitori", name: "焼き鳥", eaten: true, image: "images/meals/t_yakitori.webp" }] };
  let s = life.start(raw, "warm", ctx);
  s = life.record(s, { type: "visit", spotId: "makemeshi" }, ctx);
  s = life.record(s, { type: "meal", mealId: "t_yakitori" }, ctx);
  return life.respond(s, opinion, "in_person", ctx);
}

const chapterScript = new vm.Script(fs.readFileSync(path.join(__dirname, "../js/data_dialogue.js"), "utf8"));
function chapterFive(player) {
  const ctx = vm.createContext({ state: { player }, IslandLifeLoop: life });
  ctx.window = ctx;
  for (const script of scripts) script.runInContext(ctx);
  chapterScript.runInContext(ctx);
  return vm.runInContext('DLG.chapterIntro({id:"5"})',ctx);
}
for (const [opinion,label] of [["again","また、これがいい"],["different","わたしには、別の方が合いそう"],["unsure","まだ、決めないでおく"]]) {
  test("chapter five returns the actual dish and Aya response before Celestia remembers her soup: " + opinion, () => {
    const player = { completedRaces:3, meals:{eaten:{t_yakitori:true}}, islandLife:mealReply(opinion) };
    const saved = JSON.stringify(player), lines = chapterFive(player);
    const start = lines.findIndex(l=>l.t.includes("明日の灯油"));
    const memory = lines.findIndex(l=>l.t.includes("勝負めし焼き鳥") && l.t.includes(label));
    assert(start >= 0 && memory > start && memory < lines.findIndex(l=>l.t.includes("熱いスープ")));
    assert.equal(lines[memory].s,"narrator");
    assert.equal(lines[memory+1].s,"mimi");
    if(opinion!=="again") assert.doesNotMatch(lines[memory+1].t,/おいし|うまい|もう一度あれを頼みたい/);
    assert.equal(JSON.stringify(player),saved);
  });
}
test("chapter five requires matching evidence in the current save and never backdates a later outing into a replay", () => {
  const food = {eaten:{t_yakitori:true}};
  const first = mealReply("again"), changed = mealReply("different",first);
  const empty = {completedRaces:3};
  const baseline = Array.from(chapterFive(empty),l=>l.t);
  for (const p of [
    {completedRaces:3,meals:food},
    {completedRaces:3,islandLife:changed,meals:{solved:{t_yakitori:true}}},
    {completedRaces:3,meals:food,sns:{myPosts:[{text:"焼き鳥が好き"}]},makuraPostMemory:{text:"また焼き鳥を食べたい"}},
    {completedRaces:2,meals:food,islandLife:changed},
    {completedRaces:3,meals:food,islandLife:changed,flags:{_chapter_intro_5:true}}
  ]) assert.deepEqual(Array.from(chapterFive(p),l=>l.t),baseline);
  assert(chapterFive({completedRaces:3,meals:food,islandLife:changed}).some(l=>l.t.includes("別の方が合いそう")));
  assert(chapterFive({completedRaces:3,meals:food,islandLife:{version:1,firstLocalStory:first.firstLocalStory}}).some(l=>l.t.includes("また、これがいい")));
});

for (const [opinion, expected] of [["different", "しっくりこなかった"], ["unsure", "まだ決められない"], ["again", "また食べたい"]]) {
  test("the ending recalls the player's actual meal response: " + opinion, () => {
    const player = { meals: { eaten: { t_yakitori: true } }, islandLife: mealReply(opinion) };
    const before = JSON.stringify(player);
    const beats = showcase(player);
    const aya = beats.filter(b => b.k === "アヤに返したひと言");
    assert.equal(aya.length, 1);
    assert.equal(aya[0].v, "焼き鳥");
    assert.equal(aya[0].art, "images/meals/t_yakitori.webp");
    assert.ok(aya[0].c.includes(expected));
    assert.ok(aya[0].c.includes("会って"));
    assert.doesNotMatch(beats.map(b => b.c).join(" "), /ぜんぶ、おいしかった/);
    assert.equal(JSON.stringify(player), before);
  });
}

test("an archived first response survives a short diary, and a later change of mind supersedes it", () => {
  const first = mealReply("different");
  const archived = showcase({ islandLife: { version: 1, firstLocalStory: first.firstLocalStory } });
  assert.match(archived.find(b => b.k === "アヤに返したひと言").c, /しっくりこなかった/);
  const changed = showcase({ islandLife: mealReply("unsure", mealReply("again", first)) });
  const replies = changed.filter(b => b.k === "アヤに返したひと言");
  assert.equal(replies.length, 1);
  assert.match(replies[0].c, /まだ決められない/);
});

test("untried food, owned rewards and unmarked contracts never become asserted preferences", () => {
  const player = { outfit: "buniqro", outfitsBought: ["buniqro"], outfitsWon: ["konron_photographer"],
    meals: { solved: { t_yakitori: true } }, collection: { rubel: { scouted: true }, raiou: { scouted: true } } };
  const beats = showcase(player);
  assert.ok(beats.some(b => b.k === "心を通わせた竜"));
  assert.ok(!beats.some(b => ["食事の記録", "アヤに返したひと言", "図鑑のお気に入り"].includes(b.k)));
  const outfit = beats.find(b => b.k === "今日の装い");
  assert.equal(outfit.v, "ブニクロ普段着");
  assert.equal(outfit.art, "images/cast/mimi/mimi_buniqro_default.webp");
  assert.doesNotMatch(beats.map(b => b.c).join(" "), /好きで選んだ|いちばんの一着/);
});

test("a marked but uncontracted dragon can be the favorite while the contract stays its own memory", () => {
  const player = { collection: { rubel: { scouted: false, favorite: true }, raiou: { scouted: true, favorite: false } },
    village: { favoriteDragonIds: ["rubel", "raiou"] } };
  const beats = showcase(player);
  assert.deepEqual(Array.from(beats.find(b => b.k === "図鑑のお気に入り").dragons), ["rubel"]);
  assert.deepEqual(Array.from(beats.find(b => b.k === "心を通わせた竜").dragons), ["raiou"]);
});
