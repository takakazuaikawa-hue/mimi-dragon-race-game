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
function _seAssets() { return assetsPeak(state); }   // ★解放判定＝到達最高
function _seFlag(f) { return (typeof getStoryFlag === "function") ? !!getStoryFlag(f) : false; }

// 配列の後ろほど“新しい”。who=語り手の表示名・色は accent。
// ★cast＝そのイベントが“誰に出会っていること”を前提にしているか（1語 or 配列）。
//   談話・語り手・題材がその人物に依存する記事は cast を付ける＝出会う前は一覧に出さない
//   （unlock は資産/ランク/回数しか見ないので、それだけでは未登場キャラの名が漏れる）。
//   顧問＝STORY_CAST のキー（advisorMet が門番）／ポロ＝"poro"（poroFound が門番）。
//   ミミ・村人・モブ・屋台のおやじ等は門番対象外なので cast 不要。
var STORY_EVENTS = [
  { id: "se_firstmorning", ic: "🌅", who: "ミミ", color: "#e58fb0",
    title: "はじめての朝", unlock: function () { return true; },
    body: "霧の匂いで目が覚めた。\n知らない天井、知らない島、知らないわたし。…でも、窓のむこうで竜が空を駆けてる。\nうそでしょ、かっこよすぎ。\n借金まみれのバニーガールだけど——なんだか、ここでならやっていける気がするんだ。" },
  { id: "se_firstmeal", ic: "🍜", who: "ミミ", color: "#e58fb0",
    title: "場外のラーメン", unlock: function () { return _seRaces() >= 1; },
    body: "はじめてのレース、つかれた〜。\n場外のラーメン屋で、ずるずる。背脂がぶわっ。\n…単勝、溶けちゃったけど。この一杯さえあれば、明日もがんばれる気がする。ごちそうさまっ！" },
  { id: "se_sake_tea", ic: "🍶", who: "サケ・ウダダ", color: "#c9a24a", cast: "sake",
    title: "親方の渋茶", unlock: function () { return _seRaces() >= 3; },
    body: "「茶、飲むか」\nサケさんが、ぶっきらぼうに湯呑みを差し出してきた。にがい。でも、あったかい。\n「予想は、当てるものじゃない。竜を、ちゃんと見るものだ。……お前は、筋がいい」\n……照れるから、やめてほしい。でも、ちょっと、うれしい。" },
  { id: "se_firstwin", ic: "🎉", who: "ミミ", color: "#e58fb0",
    title: "初勝利の夜", unlock: function () { return (typeof unlockDelayRace === "function") ? unlockDelayRace("se_firstwin", _seWins() >= 1) : _seWins() >= 1; },   // ★D9-11: 勝利の瞬間はお祝いVN/toastに譲り、號外は翌レース後
    body: "当たった。…当たっちゃった！\nしっぽが勝手にぴょんって跳ねて、気づいたら場内で叫んでた。はずかしい。\nでも、あの竜が一着でゴールした瞬間の景色、ぜったい忘れない。\nわたし、予想家ミミ。…ちょっとだけ、本気で名乗れる気がしてきた。" },
  { id: "se_mizu_market", ic: "💧", who: "ミズ", color: "#5aa0d0", cast: "mizu",
    title: "市場のささやき", unlock: function () { return _seAssets() >= 500000; },
    // ★声表スイープ：ミズの持ちネタ（市場は嘘をつく／願望の影）はD7で手紙から外した文と重複していた。
    //   ここは「市場を歩きながら値を読む」実演に差し替え＝同じ思想を別の見せ方で。
    body: "市場の裏路地。ミズが、干物の値札を指でとんとん叩いた。\n「昨日より二割高い。……なぜだと思う？」\n人気が出たから、ですか？\n「不正解。昨日、雨で船が出なかったから。数が減っただけ。味は同じよ」\n扇子のかげで、くすっと笑う。\n「値段は、ものの良さじゃなく“事情”でできてるの。……オッズも、おんなじ」\n干物の匂いのなかで、なぜかいちばん腑に落ちた。" },
  { id: "se_poro_promise", ic: "🐉", who: "ポロ", color: "#7bbf8a", cast: "poro",
    title: "ポロとのやくそく", unlock: function () { return (typeof unlockDelayRace === "function") ? unlockDelayRace("se_poro", _seFlag("poroFound")) : _seFlag("poroFound"); },   // ★D9-11: 発見VN直後の多重を避け+1レース
    // ★声表スイープ：ポロは言葉を持たない（セリフ禁止）。しぐさ3層＝耳・尻尾・涙＋ミミの〔読み〕で書く。
    body: "ぐすっ、と鼻を鳴らして、ポロがわたしの袖をくわえた。\n引っぱるでもなく、ただ、くわえたまま動かない。\n（……つよくなれるかな、って顔してる）\nだいじょうぶ。だって、こんなにやさしいんだもん。\nそう言ったら、耳がぴんと立って、尻尾が三回、地面を叩いた。\n（やくそく、ってことでいい？）\nうん。ずっと、いっしょだよ。" },
  { id: "se_rainy_live", ic: "🌧️", who: "ミミ", color: "#e58fb0",
    title: "雨の日の配信", unlock: function () { return _seRaces() >= 15; },
    body: "雨。レースはお休み。\nでも、配信はやる。「こんな日は、まったり予想トークしよ？」\nコメントがぽつぽつ流れて、画面のむこうのみんなと、傘の下でおしゃべりしてるみたい。\n…そうだ。わたし、ひとりじゃないんだ。雨の音が、ちょっとだけ、すきになった。" },
  { id: "se_sumika_letter", ic: "🏘️", who: "スミカ・ラグナ", color: "#b08fd0", cast: "sumika",
    title: "村からの便り", unlock: function () { return _seAssets() >= 5000000; },
    body: "「ミミ様。村のみんなが、これを」\nスミカが、不器用に折りたたまれた手紙の束を差し出す。子どもの字、お年寄りの字。\n『はいしん、みてます』『よる、あかるくなった』『ありがとう』。\n……総資産だの名声だの、難しいことはわからない。でも、わたしが来てから、この島の夜が、ちょっとだけ明るくなったらしい。\nそれだけで、もう、じゅうぶんだ。" },
  { id: "se_makura_backstage", ic: "🎤", who: "実況マクラ", color: "#e0a050", cast: "makura",
    title: "実況席の裏側", unlock: function () { return _seRank() >= 4; },
    // ★声表スイープ：マクラは「配信用語と数字」→「急に素」。抽象的な熱弁を、実務＋素の一言に。
    body: "「今日の同接、ピークで四千二百。三コーナーで一気に跳ねた」\n実況席のマクラが、汗だくでマイクを置いて数字を見せてくる。\n「跳ねた瞬間、おれ何て言ったか覚えてるか？　……覚えてないんだよ、毎回」\n喉に湿布を貼りながら、ぼそりと続けた。\n「考えて言ってる時は、伸びない。……なんでだろうな」\nこの人の熱は、たぶん、計算じゃない。" },
  // ★伏線イベント（cast を付けない＝第5話前にも読める“知らないお姉さん”の記事）。ただし話者名・記号・色は
  //   門番ヘルパ越しに引く＝伏線段階は「あのお姉さん🌌／無彩色」、第5話で本名「セレスティア…☄️」に変わる。
  //   （getter なので描画のたびに評価される＝章を読んだ瞬間に表示が正体へ切り替わる。）
  { id: "se_celestia_shadow",
    get ic() { try { return typeof castSymbolSafe === "function" ? castSymbolSafe("celestia") : "🌌"; } catch (e) { return "🌌"; } },
    get who() { try { return typeof castNameSafe === "function" ? castNameSafe("celestia") : "あのお姉さん"; } catch (e) { return "あのお姉さん"; } },
    get color() { try { return typeof castColorSafe === "function" ? castColorSafe("celestia") : "#8a8175"; } catch (e) { return "#8a8175"; } },
    title: "天井の影", unlock: function () { return _seFlag("celestiaStrangerSeen"); },
    // ★声表スイープ：旧文は手紙 l_celestia とほぼ同文だった（D7＝同じ持ちネタの再演）。
    //   ここは「星空の下で交わした短いやりとり」＝手紙とは別の出来事・別の切り口に。
    body: "夜の展望台。星空みたいなドレスの女(ひと)が、手すりに寄りかかっていた。\n「星って、いくつ見える？」\nええと……数えたこと、ないです。\n「わたしもよ。数えられるようになったら、たぶん、つまらない」\n遠くでレースの歓声が上がる。お姉さんは、そっちを見なかった。\n「見えすぎるのも、退屈なものよ。……あなたは、まだ数えないでいなさい」\nどういう意味ですか、と聞く前に、風で声が流れた。" },

  // ── 暮らし還流（docs/KURASHI_STORY_WEAVE.md B）：暮らしの行動に日報が反応する ──
  { id: "se_tree_interview", ic: "🌳", who: "スミカ・ラグナ", color: "#b08fd0", cast: "sumika",
    title: "文化面の取材", unlock: function () { return Object.keys(((typeof state !== "undefined" && state.lifeTree) || {}).unlocked || {}).length >= 15; },
    body: "「ミミ様。日報の記者が、その……ツリーを、見たいと」\nスミカが申し訳なさそうに連れてきたのは、文化面の記者さん。\nわたしのくらしツリーをしばらく眺めて、ひとこと。「暮らしって、育つんですね」\n翌朝の文化面の見出しは『負けた夜にも、人生は続く』。\n……ちょっと泣いた。" },
  // 語り手はミミだが本文にスミカとポロが出る＝両方に会うまで伏せる（解放は総資産10万＝第3話やポロ発見より先に来うる）。
  { id: "se_moveup", ic: "🏡", who: "ミミ", color: "#e58fb0", cast: ["sumika", "poro"],
    title: "引っ越しの日", unlock: function () { return typeof LIFE_TIERS !== "undefined" && _seAssets() >= LIFE_TIERS[2].min; },
    body: "段ボール、みっつ。わたしの全財産は、意外と軽い。\n新しい部屋は、窓から竜の飛ぶ空が見える。\nスミカが「カーテンはこれ」と譲らず、ポロが箱をひとつ運んで力尽きた。\n夜、まっさらな床に寝転んで思う。\n——借金まみれだったわたしが、屋根の心配をしなくていい。それって、すごいことだ。" },
  { id: "se_gourmet_gaiden", ic: "🍜", who: "ミミ", color: "#e58fb0",
    title: "みみしんぼ・外伝", unlock: function () { var c = (typeof mealStatsAll === "function") && mealStatsAll().got >= 10; return (typeof unlockDelayRace === "function") ? unlockDelayRace("se_gourmet", c) : c; },   // ★D9-11: 食10品はtoast即時→號外は+1レース
    body: "グルメ面の隅に、小さな連載が始まった。『みみしんぼ』。\n「うまいものは、勝った日のためにあるんじゃない。明日も走るためにある」\n……これ、わたしが屋台で言ったやつだ。おやじさん、載せたな！？\n恥ずかしい。でも、切り抜いて、部屋に貼った。" },
  { id: "se_island_walker", ic: "📷", who: "ミミ", color: "#e58fb0",
    title: "島を歩く人", unlock: function () { var c = Object.keys((((typeof state !== "undefined" && state.player) || {}).kurashi || {}).spotsSeen || {}).length >= 8; return (typeof unlockDelayRace === "function") ? unlockDelayRace("se_walker", c) : c; },   // ★D9-11
    body: "文化面の投稿欄「島を歩く人」に、わたしの名前があった。\n『あの配信者、レースのない日は島のあちこちにいる。市場で、崖の上で、温泉街で』\n……見られてた。\nでも、いいんだ。この島は、歩くたびに好きになる。それを知ってる人が、また増えた。" },
  { id: "se_shihan_day", ic: "🎫", who: "サケ・ウダダ", color: "#c9a24a", cast: "sake",
    title: "師範の日", unlock: function () {
      var c = false;
      try { var as = ((typeof state !== "undefined" && state.player) || {}).activeSkills || {};
        c = typeof ACTIVE_SKILLS !== "undefined" && ACTIVE_SKILLS.some(function (s) { return (as[s.id] || 0) >= s.levels.length; }); } catch (e) { c = false; }
      return (typeof unlockDelayRace === "function") ? unlockDelayRace("se_shihan", c) : c;   // ★D9-11: 免許皆伝は師範の手紙(+1日)と時差
    },
    body: "「……もう、教えることはねえな」\n習い事の師範が、湯呑みを置いて、ぽつり。\n「いや。ひとつだけある。極めたやつほど、基本に戻れ。竜を見ろ。飯を食え。よく寝ろ」\nそれ、最初の日に言われたやつだ。\n一周まわって、同じ言葉が、ぜんぜん違う重さで届く。" }
];

// ── 進捗（表示専用メタ）：既読を記録するだけ ──
function storyEventsData() {
  var p = _seP();
  if (!p.storyEvents) p.storyEvents = {};
  if (!p.storyEvents.read) p.storyEvents.read = {};
  return p.storyEvents;
}
// ★キャラの門番（正本）：cast に挙げた人物に“物語で出会う”までイベントを出さない。
//   unlock() は資産/ランク/回数しか見ない＝それだけだと、例えば実況席の裏側はランク4（資産不要）で
//   踏めてしまい、第4話を読む前にマクラの名と談話が漏れていた。顧問は advisorMet()、ポロは poroFound()
//   が唯一の門番（正本ルール）。STORY_CAST に無いキー（村人・モブ等）は門番対象外なので素通し。
function storyEventCastMet(cast) {
  if (!cast) return true;                                   // cast 無し＝ミミ/モブだけの記事＝常時OK
  var keys = (typeof cast === "string") ? [cast] : cast;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === "poro") {                                     // ポロは発見（単勝2勝目）が唯一の門番＝命名オチを潰さない
      if (typeof poroFound !== "function" || !poroFound()) return false;
      continue;
    }
    if (typeof STORY_CAST === "undefined") return false;    // 台帳が無い＝判定不能なら伏せる側へ
    if (!STORY_CAST[k]) continue;                           // 顧問以外（村人・モブ・EXTRA_CAST）はゲート対象外
    if (typeof advisorMet !== "function" || !advisorMet(k)) return false;
  }
  return true;
}
// fail-closed：例外時は「出さない」に倒す（ネタバレは不可逆・非表示は無害）。旧実装は catch で true を返していた。
function storyEventUnlocked(e) {
  try {
    if (!storyEventCastMet(e.cast)) return false;
    return e.unlock ? e.unlock() : true;
  } catch (x) { return false; }
}
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
