"use strict";
// Real SNS/map/meal functions, isolated state, no browser or user save access.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const read = name => fs.readFileSync(path.join(__dirname, "../js", name), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
class Node {
  constructor(tag, cls, html) { this.tag = tag; this.className = cls || ""; this.innerHTML = html || ""; this.textContent = ""; this.children = []; }
  appendChild(node) { this.children.push(node); return node; }
  remove() { this.removed = true; }
}
const body = new Node("body");
const ctx = vm.createContext({
  state: { player: { coins: 12345, assetsPeak: 2000000, wins: 10, completedRaces: 70, kikoFans: 456,
    meals: { eaten: {}, solved: {} }, kurashi: { spotsSeen: {}, photoStars: {} }, flags: {}, sns: {} }, ui: {},
    current: { order: ["rubel", "poro"], odds: [1.2, 3.5] } },
  assetsPeak: state => state.player.assetsPeak, saveGame: () => {}, _epochDay: () => 20775, goalFollowers: () => 1500,
  el: (tag, cls, html) => new Node(tag, cls, html),
  document: { body, createElement: tag => new Node(tag), createTextNode: text => Object.assign(new Node("#text"), { textContent: text }) }
});
ctx.window = ctx;
for (const file of ["meals.js", "ui_konron_map.js", "sns.js", "ui_sns.js"]) vm.runInContext(read(file), ctx, { filename: file });
const data = vm.runInContext("KONRON_SPOTS", ctx);
const ref = (spotId, kind = "photo") => ({ spotId, kind });
const add = (spotId, kind = "photo", text = "この場所が気になる") => ctx.addMyPost(text, data[spotId][kind], ref(spotId, kind));
const replies = post => plain(ctx.myPostReplies(post));
const nativeState = () => { const p = plain(ctx.state.player); delete p.sns; return JSON.stringify({ player: p, current: ctx.state.current }); };
const flatten = node => [node, ...node.children.flatMap(flatten)];
const visibleText = node => flatten(node).map(n => n.textContent + n.innerHTML).join(" ");

const beforePosting = nativeState();
const viewed = add("backbistro", "gourmet", "おいしかった！ 絶対また食べたい");
assert.equal(viewed.source.visited, false);
assert.equal(viewed.source.mealId, null, "caption text was mistaken for actual eating");
assert.equal(replies(viewed).length, 1);
assert.match(replies(viewed)[0].by, /ビストロの近所の人/);
assert.match(replies(viewed)[0].back, /気になった/);
assert.doesNotMatch(replies(viewed)[0].back, /味わったことがある|足を運んでくれた|☆/);
assert.match(ctx.snsPlacePostCaption(ref("backbistro", "gourmet"), data.backbistro.gourmet), /気になる一皿/);
assert.equal(nativeState(), beforePosting, "a post changed native meals, discoveries, wallet, readers, or race data");

const oldReply = JSON.stringify(replies(viewed));
ctx.state.player.meals.eaten.g_pasta = true;
ctx.state.player.kurashi.spotsSeen.backbistro = 1;
const actual = add("backbistro", "gourmet");
assert.equal(actual.source.mealId, "g_pasta");
assert.match(replies(actual)[0].back, /味わったことがある/);
assert.match(ctx.snsPlacePostCaption(ref("backbistro", "gourmet"), data.backbistro.gourmet), /前に味わった/);
assert.equal(JSON.stringify(replies(viewed)), oldReply, "a later meal was backfilled into an earlier post");
const archived = plain(actual);
delete ctx.state.player.meals.eaten.g_pasta;
assert.deepEqual(replies(archived), replies(actual), "reload lost the reply captured at publication");

ctx.state.player.kurashi.spotsSeen.sena = 1;
const visit = add("sena");
assert.match(replies(visit)[0].back, /足を運んでくれた/);
assert.match(replies(visit)[0].back, /白砂とラグーン/);
ctx.state.player.kurashi.photoStars.sena = 3;
const photo = add("sena");
assert.equal(photo.source.photoStars, 3);
assert.match(replies(photo)[0].back, /☆3/);
assert.equal(replies(visit)[0].back.includes("☆3"), false);
assert.equal(add("sena", "gourmet").source.photoStars, 0, "a landscape score was attributed to an unrelated meal photo");

const bare = ctx.addMyPost("ビストロで食べた", data.backbistro.gourmet);
assert.equal(bare.source, undefined, "a library photo acquired provenance from its image or caption");
assert.deepEqual(replies(bare), []);
assert.deepEqual(replies({ id: "old", text: "食べた", img: data.backbistro.gourmet, day: 20774 }), []);
assert.equal(ctx.snsPlacePostSource(ref("backbistro", "photo"), data.sena.photo), null);
assert.equal(ctx.snsPlacePostSource(ref("missing"), data.sena.photo), null);
assert.equal(ctx.snsPlacePostSource(ref("sena", "invented"), data.sena.photo), null);
assert.equal(ctx.snsPlacePostSource(ref("hoshimi"), data.hoshimi.photo), null, "a locked location became a confirmed source");
assert.equal(ctx.snsPlacePostSource(ref("ura_bistro"), data.ura_bistro.photo), null, "a hidden location leaked before its condition");
ctx.state.player.wins = 0;
assert.equal(ctx.snsPlacePostSource(ref("market"), data.market.photo), null);
ctx.state.player.wins = 10;

// All reply authors are local anonymous residents: no unencountered cast is
// pulled from an account/avatar pool or inferred from narrative progress.
for (const post of [viewed, actual, visit, photo]) {
  assert.doesNotMatch(JSON.stringify(replies(post)), /アヤ|ミズ|セレスティア|マクラ|スミカ|ポロ|stand\//);
  const withoutSource = { ...plain(post) }; delete withoutSource.source;
  assert.deepEqual(replies(withoutSource), []);
  const oldStyle = { ...plain(post) }; delete oldStyle.replies;
  assert.deepEqual(replies(oldStyle), []);
  const withoutReply = { ...plain(post) }; delete withoutReply.replies;
  assert.equal(ctx.myPostReacts(post), ctx.myPostReacts(withoutReply), "a resident reply changed engagement numbers");
}

// Exercise the actual UI functions with a minimal DOM sink. Own posts show
// incoming resident speech; NPC posts keep the existing choice/back dialogue.
const incoming = { id: photo.id, handle: "@mimi_yosou", ic: "🐰", text: photo.text, _mine: true, replies: replies(photo) };
ctx.state.player.sns.replies[photo.id] = 0; // Old IDs can already have a user reply.
ctx._igComments(incoming, null);
let overlay = body.children.at(-1);
assert.match(visibleText(overlay), /近所の人/);
assert.match(visibleText(overlay), /☆3/);
assert.equal(flatten(overlay).some(n => n.className === "ig-cm-pick"), false);
assert.equal(flatten(overlay).some(n => n.className === "ig-com" && n.children[0].textContent.includes("近所の人")), true);
ctx._igMyPostDetail(photo);
assert.match(visibleText(body.children.at(-1)), /近所の人/);
const npc = { id: "npc_reply_test", handle: "@island_local", ic: "🌴", text: "こんにちは", replies: [{ choice: "気になるね", back: "また見においで" }] };
ctx._igComments(npc, null);
overlay = body.children.at(-1);
const choice = flatten(overlay).find(n => n.className === "ig-cm-pick");
assert.ok(choice, "NPC reply choices disappeared");
choice.onclick();
assert.equal(ctx.postReplied(npc.id), 0);
assert.match(visibleText(overlay), /また見においで/);
assert.match(visibleText(overlay), /island_local/);

const beforeMorePosts = nativeState();
for (let i = 0; i < 50; i++) add("sena");
assert.equal(ctx.snsData().myPosts.length, 40);
assert.ok(ctx.snsData().myPosts.every(post => replies(post).length === 1));
assert.equal(nativeState(), beforeMorePosts, "repeated posting farmed native progression");
assert.deepEqual(replies(null), []);
// Real outfit and dragon catalogs, map gates, and discovery journal.
for (const file of ['data_assets.js','data_dragons.js','island_discovery_stories.js','island_discovery.js'])
  vm.runInContext(read(file),ctx,{filename:file});
ctx.chapterRead = id => id === '3';
const player = ctx.state.player;
player.collection = {rubel:{seen:true}};
const dragon = {kind:'dragon',id:'rubel'}, dragonImg='images/dragons/rubel.png';
assert.deepEqual(replies(ctx.addMyPost('もう親友だよ',dragonImg,dragon)),[]);
player.collection.rubel.scouted = true;
assert.deepEqual(replies(ctx.addMyPost('他の写真',data.sena.photo,dragon)),[]);
const friend = ctx.addMyPost('自由な本文',dragonImg,dragon);
assert.equal(replies(friend)[0].by,'竜舎の餌番');
assert.equal(replies(friend)[0].spotId,'ryusha');
delete player.collection.rubel;
assert.deepEqual(replies(JSON.parse(JSON.stringify(friend))),replies(friend));
const suit = {kind:'outfit',id:'sukanpin'};
const attire = ctx.addMyPost('今日は何も買っていない',ctx.outfitImg(suit.id),suit);
assert.equal(replies(attire)[0].by,'夜市の繕い屋');
assert.equal(replies(attire)[0].spotId,'furununo');
assert.deepEqual(replies(ctx.addMyPost('着たつもり',ctx.outfitImg('buniqro'),{kind:'outfit',id:'buniqro'})),[]);
const originalRoute = JSON.stringify(replies(attire));
player.islandDiscovery = {version:1,evidence:['cloth_marks']};
const followed = ctx.addMyPost('見つけた',ctx.outfitImg(suit.id),suit);
assert.equal(replies(followed)[0].spotId,'shiranami');
player.islandDiscovery.evidence.push('gate_seaward');
assert.match(replies(ctx.addMyPost('もう一度',ctx.outfitImg(suit.id),suit))[0].back,/写しといまの布/);
assert.equal(JSON.stringify(replies(attire)),originalRoute);
player.meals.eaten.g_pasta=true;
assert.equal(replies(add('backbistro','gourmet'))[0].spotId,'market');
player.meals.eaten.g_pasta='unknown';
assert.equal(add('backbistro','gourmet').source.mealId,null);
player.wins=0;
assert.equal(replies(ctx.addMyPost('施錠中',ctx.outfitImg(suit.id),suit))[0].spotId,undefined);
assert.equal(ctx.snsRouteOpen('furununo'),false);
assert.deepEqual(replies({...friend,img:data.market.photo}),[]);
console.log(JSON.stringify({ ok: true, subjectRequiresOwnershipAndExactImage: true, realRoutesAndRevisits:true, sourceCapturedAtPublication: true, noCaptionInference: true, viewVisitPhotoMealDistinct: true,
  noLegacyBackfill: true, unknownCastExcluded: true, residentNotMimi: true, npcReplyChoicesPreserved: true, postLimit: 40, nativeStateAndEngagementUnchanged: true }));
