/* Historical V1 resolver/rendering compatibility. The main entry uses festival V2. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const engine = require("../js/shingan_prototype_engine.js");
const bridge = require("../js/shingan_trial_bridge.js");
const discovery = require("../js/island_discovery.js");
const fieldRead = require("../js/island_field_read.js");
const read = name => fs.readFileSync(path.join(__dirname, "../js", name + ".js"), "utf8");
const fixture = engine.getView(engine.createState()).dragons;

class Node {
  constructor(tag) {
    this.tag = tag; this.children = []; this.value = ""; this.textContent = "";
    this.classList = { add: () => {}, toggle: (_name, force) => !!force };
  }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.append(item); return item; }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {}
  get options() { return this.children; }
  all() { return [this, ...this.children.flatMap(n => n.all())]; }
}

function harness() {
  const player = { coins: 751, assetsPeak: 1000000000, collection: {}, epilogue: { finalReady: false } };
  const state = { player, ui: {} };
  const ctx = { state, read5: true, buddy: true, countResolve: 0, cleared: false, marks: 0, endings: 0, events: [],
    document: { createElement: tag => new Node(tag) }, ShinganTrialBridge: bridge,
    IslandDiscovery: discovery, IslandFieldRead: fieldRead,
    ShinganPrototype: { ...engine, getRace() { throw Error("Unpublished race requested"); }, resolve(...args) { ctx.countResolve++; return engine.resolve(...args); } },
    poroFound: () => ctx.buddy, advisorMet: () => true, chapterRead: () => ctx.read5, assetsPeak: () => state.player.assetsPeak,
    beginScreen: () => (ctx.app = new Node("main")), saveGame() {}, renderHome() {}, renderScout() {}, renderIslandBuild() {},
    epilogueClear: () => { state.player.epilogue.edFlag = true; ctx.events.push("ep"); },
    playFinalShowcase: async () => { ctx.events.push("show"); }, playEightDragonsCutin: async () => { ctx.events.push("dragons"); },
    Ending: { play: async () => { ctx.endings++; ctx.events.push("ed"); } },
    markGameCleared: () => { ctx.marks++; ctx.events.push("mark"); }
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("shingan_race"), ctx); vm.runInContext(read("shingan_official"), ctx);
  for (const d of fixture) if (d.id !== "poro") player.collection[d.id] = { scouted: true };
  const render = () => ctx.renderShinganLegacyIssue();
  const find = (tag, text) => ctx.app.all().find(n => n.tag === tag && n.textContent === text);
  const click = text => {
    const b = find("button", text); assert.ok(b && !b.disabled, text); return b.onclick();
  };
  const draft = plan => {
    const controls = ctx.app.all().filter(n => n.className === "sgo-picks");
    assert.equal(controls.length, 3);
    plan.forEach((p, i) => { controls[i].value = p; controls[i].onchange(); });
  };
  return { ctx, player, state, render, find, click, draft };
}

function fieldFindings() {
  const openSpots = ["ryu_mizunomi", "kazami_yagura", "tsubasa_dana", "furununo", "kirimina"];
  const at = currentSpotId => ({ enabled: true, openSpots, currentSpotId });
  let raw;
  for (const [id, spot] of [["trace_toes", "ryu_mizunomi"], ["trace_quill", "kazami_yagura"],
    ["ring_rubbing", "furununo"], ["ring_mending", "kirimina"]]) raw = discovery.observe(raw, id, at(spot));
  raw = discovery.propose(raw, "dragon_trace", "wind_flags", ["trace_toes", "trace_quill"], at("kazami_yagura"));
  raw = discovery.propose(raw, "legend_ring", "workshop", ["ring_rubbing", "ring_mending"], at("kirimina"));
  const clues = raw;
  raw = discovery.inspect(raw, "dragon_trace", "distance", at("kazami_yagura"));
  raw = discovery.inspect(raw, "legend_ring", "repair", at("kirimina"));
  const incomplete = discovery.tryTool(raw, "legend_ring", "thread", at("kirimina"));
  return { clues, incomplete, complete: discovery.acceptKeepsake(incomplete, "legend_ring", at("kirimina")) };
}

(async () => {
  for (const screen of ["ui_home", "ui_economy"]) {
    assert.doesNotMatch(read(screen), /\bstartFinalBattle\s*\(/, screen + " must not open the legacy ending");
  }
  const send = "予想を発行して、レース結果を見る", end = "島の夜明けを見届ける";
  const h = harness(), { ctx, player, state } = h;
  const treasury = JSON.stringify(player.collection);
  ctx.read5 = false; h.render(); assert.equal(h.find("button", send), undefined);
  ctx.read5 = true; ctx.buddy = false; h.render(); assert.equal(h.find("button", send), undefined);
  ctx.buddy = true; player.collection.glaze.scouted = false; h.render(); assert.equal(h.find("button", send), undefined);
  player.collection.glaze.scouted = true;
  player.shingan = { ab: { goka: [100,100,100,100,100] }, cleared: false };
  h.render(); assert.equal(ctx.ShinganOfficial.getOutcome(), null); assert.ok(h.find("button", send).disabled);
  assert.equal(player.shingan.official.legacyCleared, false);
  const good = ["p_raiou", "p_fugaku", "p_glaze"], bad = ["p_glaze", "p_goka", "p_yomi"];
  h.draft(good); assert.ok(h.find("button", send).disabled);
  h.click("今日の渡船を頼む"); assert.equal(player.island, undefined);
  assert.equal(ctx.countResolve, 0, "editing and forecasts must never resolve a finish");
  assert.equal(ctx.ShinganOfficial.getOutcome(), null);
  h.draft(bad); h.click(send);
  const failed = ctx.ShinganOfficial.getOutcome(); assert.ok(failed && !failed.success);
  assert.equal(h.find("button", end), undefined); assert.equal(player.epilogue.edFlag, undefined);
  assert.equal(player.coins, 751);
  const failedSnapshot = JSON.stringify(player);
  state.player = JSON.parse(failedSnapshot); h.render(); assert.equal(ctx.ShinganOfficial.getOutcome().hits, 0);
  state.player.shingan.official.issue.success = true; state.player.shingan.official.issue.operatingProfit = 9999;
  assert.equal(ctx.ShinganOfficial.getOutcome().success, false);
  h.click("同じ開催を振り返り、紙面を組み直す"); h.draft(good); h.click(send);
  const result = ctx.ShinganOfficial.getOutcome();
  assert.deepEqual([result.success, result.hits, result.operatingProfit], [true,2,49]);
  assert.equal(state.player.shingan.official.issue.ferry, true);
  assert.equal(state.player.shingan.official.issue.harbor, false);
  assert.equal(state.player.epilogue.edFlag, undefined, "result must precede its ending");
  const frozenResult = JSON.stringify(result);
  state.player.island = { lv: { infra: 1, commerce: 4 } };
  state.player.shingan.ab.goka = [0,0,0,0,0]; state.player.shingan.official.draft = bad;
  assert.equal(JSON.stringify(ctx.ShinganOfficial.getOutcome()), frozenResult);
  h.render(); await h.click(end);
  assert.deepEqual(ctx.events, ["ep", "show", "dragons", "ed", "mark"]);
  assert.equal(state.player.coins, 751); assert.equal(JSON.stringify(state.player.collection), treasury);
  ctx.buddy = false; state.player.assetsPeak = 0; h.render(); assert.ok(h.find("button", end), "restore interrupted ending");
  const built = harness(); built.player.island = { lv: { infra: 1, commerce: 4 } };
  built.render(); assert.equal(built.find("button", "今日の渡船を頼む"), undefined); built.draft(good); built.click(send);
  assert.deepEqual([built.player.shingan.official.issue.harbor, built.player.shingan.official.issue.ferry, built.player.shingan.official.issue.market], [true,false,true]);
  assert.equal(built.ctx.ShinganOfficial.getOutcome().commerceIncome, 100);
  built.player.shingan.official.issue.plan = ["p_raiou","p_raiou","unknown"];
  assert.equal(built.ctx.ShinganOfficial.getOutcome(), null);
  const prior = harness(); prior.player.shingan = { cleared: true, ab: {} }; prior.player.epilogue.edFlag = true;
  prior.player.assetsPeak = 0; prior.render();
  assert.equal(prior.ctx.ShinganOfficial.getOutcome(), null); assert.equal(prior.player.shingan.cleared, true);
  assert.equal(prior.player.shingan.official.legacyCleared, true, "the shared eight-scout entry preserves the historical tie origin even at low assets");
  prior.player.assetsPeak = 1000000000; prior.render();
  assert.equal(prior.player.shingan.official.legacyCleared, true);
  prior.click("今日の渡船を頼む"); prior.draft(bad); prior.click(send);
  assert.equal(prior.player.shingan.official.legacyCleared, true);
  assert.equal(prior.ctx.ShinganOfficial.getOutcome().success, false);
  assert.equal(state.player.shingan.official.legacyCleared, false);
  const swapped = harness();
  swapped.player.island = { lv: { infra: 1 } };
  swapped.render();
  swapped.draft(["p_raiou", "p_fugaku", "w_raiou_fugaku"]);
  swapped.click("上の読者層と予想を入れ替える");
  const third = swapped.ctx.app.all().filter(n => n.tag === "select")[2];
  third.value = "p_glaze"; third.onchange();
  const edited = ["p_fugaku", "p_raiou", "p_glaze"];
  assert.deepEqual([...swapped.player.shingan.official.draft], edited, "editing after a swap must keep both moved articles");
  swapped.render();
  assert.deepEqual(swapped.ctx.app.all().filter(n => n.tag === "select").map(n => n.value), edited);
  swapped.click(send);
  assert.deepEqual([...swapped.player.shingan.official.issue.plan], edited);

  const field = harness(), findings = fieldFindings();
  field.player.island = { lv: { infra: 1 } };
  const fieldControls = () => field.ctx.app.all().filter(n => n.className === "sgo-field-pick");
  const attach = (slot, key) => {
    const select = fieldControls()[slot];
    assert.ok(!select.disabled && select.all().some(n => n.tag === "option" && n.value === key));
    select.value = key; select.onchange();
  };
  const visibleReads = () => field.ctx.app.all().filter(n => n.tag === "li" || n.tag === "blockquote").map(n => n.textContent);
  field.player.islandDiscovery = findings.clues;
  field.render(); assert.equal(fieldControls().length, 0, "clues and proposals do not expose the lenses");
  field.player.islandDiscovery = findings.incomplete;
  field.render();
  assert.equal(fieldControls().length, 3);
  assert.equal(fieldControls()[0].disabled, true, "an article must be selected before attaching a lens");
  assert.ok(!fieldControls()[0].all().some(n => String(n.value).startsWith("legend_ring/")), "the tool practice must be accepted first");
  field.player.islandDiscovery = findings.complete;
  field.render();
  const sameOracle = ["p_raiou", "w_raiou_fugaku", "p_glaze"];
  const sameDragon = ["p_raiou", "w_raiou_fugaku", "p_fugaku"];
  field.draft(sameOracle);
  attach(0, "dragon_trace/limits");
  assert.ok(visibleReads().some(t => t.includes("ゴールまで同じ走りが続くか")));
  attach(0, "dragon_trace/conditions");
  attach(1, "legend_ring/overlap");
  attach(2, "legend_ring/audience");
  assert.ok(field.find("p", "一着予言のライオウ以外で重なる竜　なし"));
  assert.ok(visibleReads().some(t => t.includes("共通の竜はいない")));
  assert.ok(!visibleReads().some(t => t.includes("承知で")));
  const beforeAudience = field.ctx.app.all().find(n => n.tag === "li" && n.textContent.startsWith("届ける先：")).textContent;
  const swapAudience = field.ctx.app.all().filter(n => n.className === "secondary sgo-swap")[1];
  swapAudience.onclick();
  assert.equal(fieldControls()[1].value, "legend_ring/audience");
  assert.ok(visibleReads().some(t => t.startsWith("届ける先：配当を探す読者へ")));
  const afterSwap = () => field.ctx.app.all().find(n => n.tag === "p" && n.textContent.startsWith("同じ三枚・前の届け方"));
  const previousForecast = afterSwap().textContent;
  attach(1, "dragon_trace/conditions");
  assert.equal(afterSwap().textContent, previousForecast, "attaching an observation must preserve the previous allocation's forecast");
  attach(1, "legend_ring/audience");
  swapAudience.onclick();
  field.click("上の読者層と予想を入れ替える");
  assert.equal(fieldControls()[0].value, "legend_ring/overlap");
  assert.equal(fieldControls()[1].value, "dragon_trace/conditions");
  field.click("上の読者層と予想を入れ替える");
  field.draft(sameDragon);
  assert.equal(fieldControls()[2].value, "", "changing the article discards its attachment");
  attach(2, "legend_ring/audience");
  assert.ok(field.find("p", "一着予言のライオウ以外で重なる竜　フガク"));
  assert.ok(visibleReads().some(t => t.includes("フガクが4着以下だと、ともに外れる")));
  assert.ok(field.find("li", beforeAudience), "the audience comparison uses the actual destination slot");
  const before = visibleReads();
  const wallet = field.player.coins;
  assert.equal(field.ctx.countResolve, 0, "field comparisons never request unpublished results");
  field.click(send);
  assert.deepEqual(visibleReads(), before, "published readings reproduce each public fact and claim");
  assert.ok(field.ctx.app.all().some(n => n.tag === "p" && n.textContent.startsWith("同じ竜を含む予想")));
  assert.ok(field.ctx.app.all().some(n => n.tag === "p" && n.textContent.includes("当日全体の運営収支")));
  const base = harness();
  base.player.island = { lv: { infra: 1 } }; base.render(); base.draft(sameDragon); base.click(send);
  const baseOutcome = JSON.stringify(base.ctx.ShinganOfficial.getOutcome());
  assert.equal(JSON.stringify(field.ctx.ShinganOfficial.getOutcome()), baseOutcome,
    "attaching field readings does not change any race, settlement or success value");
  assert.equal(field.player.coins, wallet);
  field.state.player = JSON.parse(JSON.stringify(field.player));
  const official = field.state.player.shingan.official;
  delete field.state.player.islandDiscovery;
  official.draft = bad;
  official.fieldDraft = [];
  official.issue.fieldReading.picks[0].claim = "偽の発行文";
  official.issue.fieldReading.discoveries[0].body = "偽の根拠";
  field.render();
  assert.deepEqual(visibleReads(), before, "load uses frozen issue inputs and regenerates prose");
  official.issue.fieldReading.picks[0].lensId = "unknown";
  field.render();
  assert.equal(field.ctx.app.all().filter(n => n.tag === "blockquote").length, 2, "an invalid lens only drops itself");
  official.issue.fieldReading.picks[1].offerId = "p_glaze";
  field.render();
  assert.equal(field.ctx.app.all().filter(n => n.tag === "blockquote").length, 1, "an out-of-position offer cannot attach a reading");
  official.issue.fieldReading.discoveries = [];
  field.render();
  assert.deepEqual(visibleReads(), [], "malformed optional metadata does not display");
  assert.equal(JSON.stringify(field.ctx.ShinganOfficial.getOutcome()), baseOutcome);
  console.log("Historical V1 compatibility passed: original paper and ledger, captured origins, interrupted endings, wallet isolation, and field-reading provenance. The normal entry uses festival V2.");
})().catch(err => { console.error(err); process.exitCode = 1; });
