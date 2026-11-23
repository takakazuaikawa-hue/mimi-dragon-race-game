#!/usr/bin/env node
"use strict";

// Cosmetic SNS engagement only. No browser storage, network, or race simulation.
// Run: node tools/check_sns_engagement.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../js/sns.js"), "utf8");
const ctx = vm.createContext({
  state: { player: { coins: 12345, kikoFans: 456, completedRaces: 80, wins: 21, sns: {} } },
  saveGame() { throw new Error("reading engagement must not save"); },
  _epochDay() { return ctx.__today; },
  goalFollowers() { return ctx.__followers; },
  __today: 20774,
  __followers: 800
});
ctx.window = ctx;
vm.runInContext(source, ctx, { filename: "js/sns.js" });
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name + ": " + error.message.slice(0, 500)); }
}
function read(post, followers, today) {
  ctx.__post = post;
  ctx.__followers = followers;
  ctx.__today = today;
  return vm.runInContext("({ reactions:myPostReacts(__post), buzzing:myPostBuzzing(__post) })", ctx);
}

const samples = [];
test("actual saved-post IDs and elapsed days have both ordinary and buzzing posts in each audience band", () => {
  for (const followers of [800, 1500, 10000, 1000000]) {
    let count = 0, buzz = 0, oldBuzz = 0, low = Infinity, high = -Infinity;
    let ordinaryExample, buzzingExample;
    // IDs match addMyPost's persisted schema; no hand-picked random overrides.
    for (let day = 20747; day <= 20774; day++) {
      for (let serial = 1; serial <= 40; serial++) {
        const post = { id: `my_${day}_${serial}`, day, text: "島で撮った一枚", img: "images/homebg/beach_day.webp" };
        for (let age = 0; age <= 4; age++) {
          const result = read(post, followers, day + age);
          count++; buzz += Number(result.buzzing);
          oldBuzz += Number(result.reactions >= Math.max(120, followers * 0.08));
          low = Math.min(low, result.reactions); high = Math.max(high, result.reactions);
          const example = { id: post.id, day, age, reactions: result.reactions };
          if (result.buzzing && !buzzingExample) buzzingExample = example;
          if (!result.buzzing && !ordinaryExample) ordinaryExample = example;
        }
      }
    }
    assert.equal(oldBuzz, 0, "old threshold unexpectedly reachable");
    assert.ok(buzz > 0 && buzz < count, "all posts had the same outcome at followers=" + followers);
    samples.push({ followers, threshold: Math.max(45, followers * 0.04), reactionRange: [low, high], oldBuzz, buzz, count, ordinaryExample, buzzingExample });
  }
});

test("reopening the same post on the same day preserves its reactions and badge", () => {
  const post = Object.freeze({ id: "my_20770_12", day: 20770, text: "港の夕暮れ", img: "images/home_vista_day.jpg" });
  for (const followers of [800, 1500, 10000, 1000000]) {
    const first = JSON.stringify(read(post, followers, 20774));
    for (let repeat = 0; repeat < 20; repeat++) assert.equal(JSON.stringify(read(post, followers, 20774)), first);
  }
});

test("the existing reaction formula and legacy text-only posts keep their numbers", () => {
  const posts = [
    { id: "my_20770_1", day: 20770, text: "以前の投稿" },
    { id: "my_20774_40", day: 20774, text: "今日の写真", img: "images/homebg/beach_day.webp" }
  ];
  for (const post of posts) for (const followers of [800, 1500, 10000]) {
    ctx.__post = post; ctx.__followers = followers; ctx.__today = 20774;
    const expected = vm.runInContext(`(() => {
      const seed=_snsRandFrom((__post.id.length*131+(__post.day||0))>>>0);
      const grow=Math.min(1,0.35+Math.max(0,__today-(__post.day||__today))*0.18);
      return Math.floor(__followers*(0.012+seed*0.05)*grow)+3+Math.floor(seed*20);
    })()`, ctx);
    assert.equal(read(post, followers, 20774).reactions, expected);
  }
});

test("cosmetic reads leave wallets, followers, royalties, posts and race data untouched", () => {
  ctx.state.current = { raceResult: { winner: "poro" }, odds: { poro: 2.3 }, betResult: { payout: 230 } };
  ctx.state.player.lastLoginDay = 20774;
  ctx.state.player.sns.myPosts = [{ id: "my_20774_1", day: 20774, text: "島の一枚" }];
  const before = JSON.stringify(ctx.state);
  for (const row of samples) {
    const post = { id: row.buzzingExample.id, day: row.buzzingExample.day, text: "島の一枚" };
    read(post, row.followers, post.day + row.buzzingExample.age);
  }
  assert.equal(JSON.stringify(ctx.state), before);
});

test("posting past the forty-post window retains independent IDs, likes and replies after reload", () => {
  ctx.__today = 20774;
  ctx.state.player.sns = {};
  ctx.saveGame = () => {};
  const posts = Array.from({ length: 83 }, (_, i) => ctx.addMyPost("投稿" + i));
  assert.equal(new Set(posts.map(p => p.id)).size, posts.length);
  assert.equal(ctx.myPosts().length, 40);
  ctx.likePost(posts[80].id);
  ctx.replyPost(posts[81].id, 0);
  assert.equal(ctx.postLiked(posts[81].id), false);
  assert.equal(ctx.postReplied(posts[80].id), null);
  ctx.state.player.sns = JSON.parse(JSON.stringify(ctx.state.player.sns));
  const next = ctx.addMyPost("再開後");
  assert.ok(!posts.some(p => p.id === next.id));
  assert.equal(ctx.postReplied(posts[81].id), 0);
});

test("legacy duplicates keep their content and shared historical key without assigning its reaction to a particular post", () => {
  const shared = "my_20774_41", unique = "my_20774_40", expired = "my_20774_42";
  const old = [{ id: unique, day: 20774, text: "残る投稿" }, { id: shared, day: 20774, text: "先の投稿" },
    { id: shared, day: 20774, text: "後の投稿", replies: [{ by: "住民", back: "写真への返事" }] }];
  ctx.state.player.sns = { myPosts: old, liked: { [shared]: true }, reacts: { [unique]: "like" }, replies: { [shared]: 0, [expired]: 1 } };
  const oldCount = ctx.myPostReacts(old[1]);
  const [newer, older, other] = ctx.myPosts();
  assert.equal(other.id, unique);
  assert.equal(ctx.postLiked(unique), true);
  assert.equal(ctx.postLiked(shared), true);
  assert.equal(ctx.postReplied(shared), 0);
  assert.equal(ctx.postReplied(expired), 1);
  assert.equal(newer.text, "後の投稿");
  assert.equal(newer.replies[0].back, "写真への返事");
  assert.equal(older.text, "先の投稿");
  assert.equal(new Set([newer.id, older.id, unique, shared, expired]).size, 5);
  for (const post of [newer, older]) {
    assert.equal(post.legacyPostId, shared);
    assert.equal(ctx.myPostReacts(post), oldCount);
    assert.equal(ctx.postReplied(post.id), null);
    assert.equal(ctx.postLiked(post.id), false);
  }
  ctx.likePost(older.id);
  ctx.replyPost(newer.id, 1);
  const migrated = JSON.stringify(ctx.state.player.sns);
  ctx.state.player.sns = JSON.parse(migrated);
  assert.equal(ctx.myPosts()[0].id, newer.id);
  assert.equal(JSON.stringify(ctx.state.player.sns), migrated);
  assert.equal(ctx.postLiked(newer.id), false);
  assert.equal(ctx.postReplied(older.id), null);
});

for (const row of samples) console.log(JSON.stringify({ followers:row.followers, threshold:row.threshold, reactions:row.reactionRange, oldBuzzRate:"0%", newBuzzRate:(100*row.buzz/row.count).toFixed(1)+"%", ordinary:row.ordinaryExample, buzzing:row.buzzingExample }));
console.log(`${passed} passed; ${failed} failed. Rates describe this fixed sample, not all players or future dates.`);
process.exitCode = failed ? 1 : 0;
