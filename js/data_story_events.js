// =========================================================================
// data_story_events.js — 物語の“小イベント”（短い挿話・本編の章とは別の小さな物語）。
// =========================================================================
// 進行（勝利/レース数/総資産/物語フラグ/ランク）で解放され、物語画面の「✨小イベント」に並ぶ。
// 何度でも読み返せる。★完全に表示専用メタ＝state.player.storyEvents に既読を記録するだけ。
//   着順・オッズ・配当・経済には一切干渉しない（[[race-math-immutable]]）。
// 追加方法：STORY_EVENTS に1件足すだけ（後ろ＝新しい）。unlock(s)＝解放条件、body＝本文（\nで改行）。
// ★キャラの声を厳守：ミミ=来訪者の反応／サケ=現場・気配／ミズ=市場・価値／スミカ=暮らし／
//   マクラ=実況・熱狂／セレスティア=淘汰・世界の天井（event_registry.js 冒頭ガイドと同じ）。
// =========================================================================

function _seP() { return (typeof state !== "undefined" && state.player) ? state.player : {}; }
function _seWins() { return _seP().wins || 0; }
function _seRaces() { return _seP().completedRaces || 0; }
function _seRank() { return _seP().rank || 1; }
function _seAssets() { return _seP().maxCoinsReached || _seP().totalAssets || 0; }
function _seFlag(f) { return (typeof getStoryFlag === "function") ? !!getStoryFlag(f) : false; }

// 配列の後ろほど“新しい”。who=語り手の表示名・色は accent。
var STORY_EVENTS = [
  { id: "se_firstmorning", ic: "🌅", who: "ミミ", color: "#e58fb0",
    title: "はじめての朝", unlock: function () { return true; },
    body: "霧の匂いで目が覚めた。\n知らない天井、知らない島、知らないわたし。…でも、窓のむこうで竜が空を駆けてる。\nうそでしょ、かっこよすぎ。\n借金まみれのバニーガールだけど——なんだか、ここでならやっていける気がするんだ。" },
  { id: "se_firstmeal", ic: "🍜", who: "ミミ", color: "#e58fb0",
    title: "場外のラーメン", unlock: function () { return _seRaces() >= 1; },
    body: "はじめてのレース、つかれた〜。\n場外のラーメン屋で、ずるずる。背脂がぶわっ。\n…単勝、溶けちゃったけど。この一杯さえあれば、明日もがんばれる気がする。ごちそうさまっ！" },
  { id: "se_sake_tea", ic: "🍶", who: "サケ・ウダダ", color: "#c9a24a",
    title: "親方の渋茶", unlock: function () { return _seRaces() >= 3; },
    body: "「茶ァ、飲むか」\nサケのおやじが、ぶっきらぼうに湯呑みを差し出してきた。にがい。でも、あったかい。\n「予想ってのはな、当てるもんじゃねえ。竜を、ちゃんと見るもんだ。…お前は、筋がいい」\n……照れるから、やめてほしい。でも、ちょっと、うれしい。" },
  { id: "se_firstwin", ic: "🎉", who: "ミミ", color: "#e58fb0",
    title: "初勝利の夜", unlock: function () { return _seWins() >= 1; },
    body: "当たった。…当たっちゃった！\nしっぽが勝手にぴょんって跳ねて、気づいたら場内で叫んでた。はずかしい。\nでも、あの竜が一着でゴールした瞬間の景色、ぜったい忘れない。\nわたし、予想家ミミ。…ちょっとだけ、本気で名乗れる気がしてきた。" },
  { id: "se_mizu_market", ic: "💧", who: "ミズ", color: "#5aa0d0",
    title: "市場のささやき", unlock: function () { return _seAssets() >= 500000; },
    body: "「ねえ、気づいた？　あの竜、人気のわりに、誰も“ほんとう”を見てない」\nミズが、扇子のかげでくすっと笑う。\n「市場は嘘をつくの。人気も、オッズも、ぜんぶ誰かの願望の影。…あなたの目は、その奥を見ようとする。あはん、わたしの、お気に入り」\nこの人、ほめてるの？　からかってるの？" },
  { id: "se_poro_promise", ic: "🐉", who: "ポロ", color: "#7bbf8a",
    title: "ポロとのやくそく", unlock: function () { return _seFlag("poroFound"); },
    body: "ぐすっ、と泣き虫竜のポロが、わたしの袖をつかむ。\n「おねえちゃん…ぼく、つよくなれるかな」\nなれるよ。だって、こんなにやさしいんだもん。\n「じゃあ、やくそく。ぼくがおねえちゃんを応援するから、おねえちゃんも、ぼくを応援して」\nうん。ずっと、いっしょだよ。" },
  { id: "se_rainy_live", ic: "🌧️", who: "ミミ", color: "#e58fb0",
    title: "雨の日の配信", unlock: function () { return _seRaces() >= 15; },
    body: "雨。レースはお休み。\nでも、配信はやる。「こんな日は、まったり予想トークしよ？」\nコメントがぽつぽつ流れて、画面のむこうのみんなと、傘の下でおしゃべりしてるみたい。\n…そうだ。わたし、ひとりじゃないんだ。雨の音が、ちょっとだけ、すきになった。" },
  { id: "se_sumika_letter", ic: "🏘️", who: "スミカ・ラグナ", color: "#b08fd0",
    title: "村からの便り", unlock: function () { return _seAssets() >= 5000000; },
    body: "「ミミ様。村のみんなが、これを」\nスミカが、不器用に折りたたまれた手紙の束を差し出す。子どもの字、お年寄りの字。\n『はいしん、みてます』『よる、あかるくなった』『ありがとう』。\n……総資産だの名声だの、難しいことはわからない。でも、わたしが来てから、この島の夜が、ちょっとだけ明るくなったらしい。\nそれだけで、もう、じゅうぶんだ。" },
  { id: "se_makura_backstage", ic: "🎤", who: "実況マクラ", color: "#e0a050",
    title: "実況席の裏側", unlock: function () { return _seRank() >= 4; },
    body: "「いい声、出てたか？」\n実況のマクラが、汗だくでマイクを置く。\n「おれはな、竜が好きで好きでたまらん。だから、画面の前のキミにも、この熱を届けたいんだ」\n熱い。暑苦しいくらい。…でも、この島のレースがこんなに楽しいのは、きっと、この人のおかげでもある。" },
  { id: "se_celestia_shadow", ic: "🌌", who: "セレスティア", color: "#9a6ad0",
    title: "天井の影", unlock: function () { return _seFlag("celestiaStrangerSeen"); },
    body: "夜の展望台に、見知らぬお姉さんが立っていた。\n「この世界には“天井”がある。価値の届かぬものは、淘汰される——それが、理」\n星を映した瞳が、まっすぐにわたしを見た。\n「でも、あなたは。その理に、抗ってみせるのかしら。……面白い。見ていてあげる」\nぞくっとした。…でも、なぜか、目をそらせなかった。" }
];

// ── 進捗（表示専用メタ）：既読を記録するだけ ──
function storyEventsData() {
  var p = _seP();
  if (!p.storyEvents) p.storyEvents = {};
  if (!p.storyEvents.read) p.storyEvents.read = {};
  return p.storyEvents;
}
function storyEventUnlocked(e) { try { return e.unlock ? e.unlock() : true; } catch (x) { return true; } }
function storyEvents() {   // 解放済みを新しい順（配列後ろ＝新しい）で
  var out = [];
  for (var i = STORY_EVENTS.length - 1; i >= 0; i--) if (storyEventUnlocked(STORY_EVENTS[i])) out.push(STORY_EVENTS[i]);
  return out;
}
function storyEventRead(id) { return !!storyEventsData().read[id]; }
function readStoryEvent(id) { var d = storyEventsData(); if (!d.read[id]) { d.read[id] = true; if (typeof saveGame === "function") saveGame(); } }
function storyEventsUnread() { var n = 0, ls = storyEvents(); for (var i = 0; i < ls.length; i++) if (!storyEventRead(ls[i].id)) n++; return n; }
function storyEventsStats() { return { got: storyEvents().length, total: STORY_EVENTS.length, unread: storyEventsUnread() }; }

if (typeof window !== "undefined") window.STORY_EVENTS = STORY_EVENTS;
