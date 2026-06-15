// =========================================================================
// sns.js — ミミのSNS（📱タイムライン ＋ ✉️ファンレター）。
// =========================================================================
// 配信風ホームの世界観に合わせた“SNS”。すべて表示専用メタ：
//   ・タイムライン … 島/竜/NPC/ファンの投稿が進行に応じて解放され、❤️で集める。
//   ・ファンレター … マイルストーンで届く手紙。開封すると既読になり、いつでも読み返せる。
// ★レースの着順・オッズ・配当・経済には一切干渉しない（[[race-math-immutable]]）。
//   記録は state.player.sns（liked / readLetters）だけ。テキストは進行値を読むだけの表示。
// 追加方法：SNS_POSTS / FAN_LETTERS に1件足すだけ（unlock(s) で解放条件、text は文字列か s=>文字列）。
// =========================================================================

// 進行値をやさしく読むヘルパ（未定義でも落ちない）。
function _snsP() { return (typeof state !== "undefined" && state.player) ? state.player : {}; }
function _snsRank() { return _snsP().rank || 1; }
function _snsWins() { return _snsP().wins || 0; }
function _snsRaces() { return _snsP().completedRaces || 0; }
function _snsMaxCoins() { return _snsP().maxCoinsReached || _snsP().coins || 0; }
function _snsFlag(f) { return (typeof getStoryFlag === "function") ? !!getStoryFlag(f) : false; }
function _snsFollowers() { return (typeof goalFollowers === "function") ? goalFollowers() : (800 + _snsRaces() * 15 + _snsWins() * 40); }

// ── タイムライン投稿（配列の後ろほど“新しい”＝上に表示） ──
var SNS_POSTS = [
  { id: "p_welcome", ic: "🌸", name: "うさ耳ファンクラブ", handle: "@usamimi_fc", ago: "たった今", likes: 128,
    text: "ミミちゃんの配信、今日も来たよ〜！🐰 はじめての人も、コメントで挨拶しよ！", unlock: function () { return true; } },
  { id: "p_sake_tip", ic: "🍶", name: "サケ・ウダダ", handle: "@sake_oyakata", ago: "5分前", likes: 86,
    text: "予想ってのはな、人気を見るんじゃない。脚質と気配を見るんだ。…まあ、ミミは筋がいい。", unlock: function () { return true; } },
  { id: "p_fan_first", ic: "🔥", name: "推し竜ガチ勢", handle: "@oshi_dragon", ago: "12分前", likes: 64,
    text: "ミミちゃんの実況、初心者にやさしくて好き。耳ぴょこんって動くの反則でしょ……", unlock: function () { return true; } },
  { id: "p_mizu_hint", ic: "💧", name: "ミズ", handle: "@mizu_market", ago: "30分前", likes: 73,
    text: "オッズは勝率じゃないわ、あはん。人気と価値を、分けて見ること。…ふふ、わかる子は伸びる。", unlock: function () { return true; } },
  { id: "p_sumika_warm", ic: "🏘️", name: "スミカ・ラグナ", handle: "@sumika_village", ago: "1時間前", likes: 51,
    text: "ミミ様、今日もお疲れさまです。村のみんな、配信を楽しみにしているんですよ。", unlock: function () { return true; } },
  { id: "p_makura_hype", ic: "🎤", name: "実況マクラ", handle: "@makura_live", ago: "1時間前", likes: 92,
    text: "さあ今日も竜たちが駆ける！　この興奮、画面の前のキミにも届け！🐉🔥", unlock: function () { return true; } },

  { id: "p_firstwin", ic: "🌸", name: "うさ耳ファンクラブ", handle: "@usamimi_fc", ago: "たった今", likes: 240,
    text: function () { return `🎉 ミミちゃん${_snsWins()}勝目おめでとう！　予想が当たった瞬間のしっぽ、見た？ ぴょんって跳ねたよね！`; },
    unlock: function () { return _snsWins() >= 1; } },
  { id: "p_rank2", ic: "🎤", name: "実況マクラ", handle: "@makura_live", ago: "3分前", likes: 158,
    text: function () { return `ミミ、ランク${_snsRank()}到達！　新しい地域のレースにも挑めるぞ。視聴者みんなで応援だ！`; },
    unlock: function () { return _snsRank() >= 2; } },
  { id: "p_poro", ic: "🐉", name: "ポロ", handle: "@poro_naki", ago: "10分前", likes: 311,
    text: "ぐすっ……ミミお姉ちゃんが、ぼくのこと見つけてくれた日のこと、まだ覚えてる。だいすき。", unlock: function () { return _snsFlag("poroFound"); } },
  { id: "p_followers", ic: "🔥", name: "推し竜ガチ勢", handle: "@oshi_dragon", ago: "20分前", likes: 207,
    text: function () { return `フォロワー${_snsFollowers().toLocaleString()}人突破！？　もう立派な“予想界の星”じゃん。最初から見てる俺、誇らしい。`; },
    unlock: function () { return _snsFollowers() >= 3000; } },
  { id: "p_scout", ic: "🐲", name: "竜舎だより", handle: "@ryusha_news", ago: "30分前", likes: 144,
    text: "新しい竜が龍舎にやってきた！　ミミのスカウト、目利きがすごいって評判だよ。", unlock: function () { return _snsFlag("dragonScoutUnlocked"); } },
  { id: "p_rich", ic: "💧", name: "ミズ", handle: "@mizu_market", ago: "45分前", likes: 188,
    text: "総資産が、ずいぶん厚くなったわね。…お金は使い方で品が出る。あなたなら、わかるでしょ？", unlock: function () { return _snsMaxCoins() >= 1000000; } },
  { id: "p_veteran", ic: "🍶", name: "サケ・ウダダ", handle: "@sake_oyakata", ago: "1時間前", likes: 176,
    text: function () { return `${_snsRaces()}戦、よく走った。…的中も外しも、ぜんぶお前の血肉だ。胸を張れ。`; },
    unlock: function () { return _snsRaces() >= 30; } },

  { id: "p_makura_legend", ic: "🎤", name: "実況マクラ", handle: "@makura_live", ago: "5分前", likes: 402,
    text: "もはやミミの予想は“当てもの”じゃない。物語だ。この島の誰もが、次の一戦を待っている。", unlock: function () { return _snsRank() >= 5; } },
  { id: "p_celestia", ic: "🌌", name: "セレスティア", handle: "@celestia_sky", ago: "ついさっき", likes: 666,
    text: "……面白い灯りね。消えそうで、消えない。あなたの“視る目”、わたしが見定めてあげる。", unlock: function () { return _snsFlag("celestiaStrangerSeen"); } },
  { id: "p_thanks", ic: "🐰", name: "ミミ", handle: "@mimi_yosou", ago: "たった今", likes: 888,
    text: "いつも見てくれて、ほんとにありがとう。わたし、この世界に来てよかった。…これからも、いっしょに当てようね！", unlock: function () { return _snsRaces() >= 10; } }
];

// ── ファンレター（マイルストーンで届く手紙・開封で既読） ──
var FAN_LETTERS = [
  { id: "l_first", ic: "🌸", from: "はじめてのファンより", subject: "応援しています！",
    body: "ミミさんへ。\n配信、毎回楽しみにしています。予想が当たっても外れても、まっすぐ竜を見るミミさんが好きです。\nこれからも、わたしのヒーローでいてください。\n\n——耳ぴょこ、だいすきな一人より🐰",
    unlock: function () { return true; } },
  { id: "l_kid", ic: "🧒", from: "村の子どもより", subject: "ぼくもよそうかになりたい！",
    body: "ミミおねえちゃんへ。\nぼく、ミミおねえちゃんみたいに竜のことがわかるようになりたいです。\nきのう、はじめて『きはい』ってことばをおぼえました。サケのおじさんがおしえてくれた！\nまたはいしん、みにいきます。",
    unlock: function () { return _snsRaces() >= 5; } },
  { id: "l_sake", ic: "🍶", from: "サケ・ウダダ", subject: "（不器用な殴り書き）",
    body: "ミミ。\nこういうのは柄じゃねえが、一度だけ書いておく。\nお前、最初は右も左もわからん顔してたが、今じゃ立派に竜を見る目をしてる。\n…誇りに思うぞ。次の一戦も、気配を見ろ。それだけだ。",
    unlock: function () { return _snsWins() >= 3; } },
  { id: "l_rescued", ic: "🏘️", from: "立て直った村人より", subject: "灯りを、ありがとう",
    body: "ミミ様。\nあなたが賭場の灯りを守ってくれたおかげで、わたしたちの村は、今日も笑っています。\n総資産だの名声だの、難しいことはわかりません。でも、あなたが来てから、夜が明るくなった。\nそれだけは、確かです。",
    unlock: function () { return _snsMaxCoins() >= 100000; } },
  { id: "l_poro", ic: "🐉", from: "ポロ", subject: "おねえちゃんへ（なみだのあと）",
    body: "ミミおねえちゃん。\nぼく、泣き虫だけど、おねえちゃんといると、ちょっとだけ勇気が出るんだ。\nグルメレース、いっしょに走ってくれてありがとう。\nつぎは、ぼくがおねえちゃんを応援する番だね。ぐすっ、えへへ。",
    unlock: function () { return _snsFlag("poroFound"); } },
  { id: "l_rival", ic: "🐲", from: "かつての好敵手より", subject: "次は負けない",
    body: "ミミへ。\nお前の予想に、何度も悔しい思いをさせられた。\nだが、おかげで俺も腕を上げた。お前がいなけりゃ、ここまで来られなかった。\n……礼は言わん。次のレースで、ぜんぶ返す。覚悟しておけ。",
    unlock: function () { return _snsRank() >= 4; } },
  { id: "l_mizu", ic: "💧", from: "ミズ", subject: "あなたへ、ひとつだけ",
    body: "ミミ。\n市場は嘘をつくわ。人気も、オッズも、ぜんぶ“誰かの願望”の影。\nでも、あなたの目は、その奥の“ほんとう”を見ようとする。\n…その目を、曇らせないで。あはん、わたしの数少ない、お気に入りなんだから。",
    unlock: function () { return _snsMaxCoins() >= 5000000; } },
  { id: "l_celestia", ic: "🌌", from: "セレスティア", subject: "天井の、その先へ",
    body: "ちっぽけな予想家へ。\nこの世界には“天井”がある。価値の届かぬものは、淘汰される。\n——だけど、あなたは。その理に、まっすぐ抗ってみせた。\n面白い。あなたの物語の結末、最後まで見届けてあげる。",
    unlock: function () { return _snsFlag("celestiaStrangerSeen"); } }
];

// 進捗（表示専用メタ）。
function snsData() {
  var p = _snsP();
  if (!p.sns) p.sns = {};
  if (!p.sns.liked) p.sns.liked = {};
  if (!p.sns.readLetters) p.sns.readLetters = {};
  return p.sns;
}
function _snsText(v) { return (typeof v === "function") ? v() : v; }

// 解放済み投稿を新しい順（配列後ろ＝新しい）で。
function timelinePosts() {
  var out = [];
  for (var i = SNS_POSTS.length - 1; i >= 0; i--) {
    var po = SNS_POSTS[i];
    var ok = true; try { ok = po.unlock ? po.unlock() : true; } catch (e) { ok = true; }
    if (ok) out.push(po);
  }
  return out;
}
function postLiked(id) { return !!snsData().liked[id]; }
function likePost(id) { var d = snsData(); d.liked[id] = !d.liked[id]; if (typeof saveGame === "function") saveGame(); return d.liked[id]; }
function postLikeCount(po) { return (po.likes || 0) + (postLiked(po.id) ? 1 : 0); }

// 解放済みファンレター（新しい＝配列後ろ）。
function fanLetters() {
  var out = [];
  for (var i = FAN_LETTERS.length - 1; i >= 0; i--) {
    var l = FAN_LETTERS[i];
    var ok = true; try { ok = l.unlock ? l.unlock() : true; } catch (e) { ok = true; }
    if (ok) out.push(l);
  }
  return out;
}
function letterRead(id) { return !!snsData().readLetters[id]; }
function readLetter(id) { var d = snsData(); if (!d.readLetters[id]) { d.readLetters[id] = true; if (typeof saveGame === "function") saveGame(); } }
function snsUnreadLetters() { var n = 0, ls = fanLetters(); for (var i = 0; i < ls.length; i++) if (!letterRead(ls[i].id)) n++; return n; }
function snsStats() { return { posts: timelinePosts().length, letters: fanLetters().length, unread: snsUnreadLetters() }; }

if (typeof window !== "undefined") { window.SNS_POSTS = SNS_POSTS; window.FAN_LETTERS = FAN_LETTERS; }
