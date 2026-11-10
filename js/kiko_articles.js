// =========================================================================
// kiko_articles.js — 📖『ドラゴンレース紀行』記事エンジン（2026-08-02）
// =========================================================================
// 芯＝「自分のプレイだけの記事が書かれる」。実プレイの出来事（勝った・大穴を当てた・
// 連敗した・初めて食べた・☆写真を撮った・物語が動いた）を素材にして、ホームへ帰った
// タイミングで1本だけ記事が書かれる。★実時間には一切依存しない（1日1本は却下済み＝
// 何日遊べばいいか分からなくなるため）。素材が薄い日も 3レースごとに「日常回」を保証。
//
// 正本＝docs/KIKO_MEALS_APPEAL_DIRECTIVE.md Part A ／ 手順＝docs/OPUS5_NEXT_BATCH_DIRECTIVE.md §1
// ★完全に表示専用＝着順・オッズ・配当・FinalPower には一切非干渉（[[race-math-immutable]]）。
// ★計器は置かない（進捗バー／残り％／目標カウンタ禁止）。記事は読み物であって計器ではない。
// =========================================================================

var KIKO_MAT_MAX = 20;    // 素材キューの上限（古いものから捨てる）
var KIKO_ART_MAX = 5;     // 通常記事の保持数（殿堂は別枠・上限なし）
var KIKO_DAILY_EVERY = 3; // 素材ゼロでも、この戦数ごとに日常回を1本（下限保証）

// ── 素材キュー ────────────────────────────────────────────────────────
//   { t: 種別, d: データ, race: そのときの通算レース数 }
function kikoMatPush(t, d) {
  try {
    var p = state && state.player; if (!p || !t) return;
    var q = p.kikoMat || (p.kikoMat = []);
    q.push({ t: t, d: d || {}, race: p.completedRaces || 0 });
    while (q.length > KIKO_MAT_MAX) q.shift();
  } catch (e) {}
}

function _kikoFlag(name) {
  try {
    if (typeof getStoryFlag === "function" && getStoryFlag(name)) return true;
    return !!(state.player && state.player.flags && state.player.flags[name]);
  } catch (e) { return false; }
}

// ── 物語の素材は「フラグの見張り」で拾う ──────────────────────────────
//   イベント側に手を入れず、立ったフラグを後から拾う（どの経路で立っても取りこぼさない・
//   fail-safe）。★ここに並べてよいのは「そのフラグが立った時点で登場済みが確定する人物」だけ。
var KIKO_STORY_WATCH = [
  { flag: "assetsRevealed",       key: "assets" },   // 完済＋資産の概念が開く（ミズ or サケ）
  { flag: "sakeDebtSettled",      key: "repay"  },   // サケへの恩返し
  { flag: "poroFound",            key: "poro"   },   // 相棒ポロ
  { flag: "phoneBought",          key: "phone"  },   // スマホ購入＝配信開始
  { flag: "dragonScoutUnlocked",  key: "scout"  },   // 竜スカウト開始
  // 借金の発覚（event_registry.js debt_intro＝初レースの結果後に必ず1回）。専用フラグが無いので
  //   「1戦走った＆まだ借りが残っている」で拾う。語り手はミミと師匠（第1話から登場済み）だけ。
  { flag: "_kikoDebtTold", key: "debt", test: function () {
      try { return (state.player.completedRaces || 0) >= 1 && typeof mimiDebtLeft === "function" && mimiDebtLeft() > 0; } catch (e) { return false; } } }
];

function _kikoScanStory() {
  try {
    var p = state.player;
    var seen = p.kikoSeenFlags || (p.kikoSeenFlags = {});
    for (var i = 0; i < KIKO_STORY_WATCH.length; i++) {
      var w = KIKO_STORY_WATCH[i];
      if (seen[w.flag]) continue;
      if (w.test ? !w.test() : !_kikoFlag(w.flag)) continue;
      seen[w.flag] = 1;
      kikoMatPush("story", { key: w.key });
    }
  } catch (e) {}
}

// ── 小道具 ────────────────────────────────────────────────────────────
function _kikoSeed(s) {
  var h = 2166136261; s = String(s);
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}
function _kikoPick(arr, seed) { return (arr && arr.length) ? arr[_kikoSeed(seed) % arr.length] : ""; }
function _kikoCoins(n) { try { return (typeof fmtCoins === "function") ? fmtCoins(n) : (n + "コイン"); } catch (e) { return n + "コイン"; } }
function _kikoFind(mats, t) { for (var i = mats.length - 1; i >= 0; i--) if (mats[i].t === t) return mats[i]; return null; }

// ★§2接続：まだ出会っていない一皿の「うわさ」を1行だけ拾う（食レポ回の結びに置く）。
//   ネタバレしない＝品名は出さず、場所と刻だけ。無ければ空文字（記事はそのまま成立する）。
function _kikoRumor() {
  try {
    if (typeof MEALS === "undefined" || typeof mealUnlocked !== "function") return "";
    var yet = MEALS.filter(function (m) { return m.where && !m.quiz && !mealUnlocked(m); });
    if (!yet.length) return "";
    var m = yet[_kikoSeed("r" + yet.length + (state.player.completedRaces || 0)) % yet.length];
    // 刻の指定がある品だけ「その時間にしか出ない」と言う（無い品に言うと嘘になる）
    var body = (m.time && m.time.length)
      ? (m.where + "に、" + m.time[0] + "から" + m.time[m.time.length - 1] + "のあいだにしか出ない一皿があるそうです。")
      : (m.where + "に、わたしがまだ知らない一皿があるそうです。");
    return "ところで、まだ食べたことのないものの話を聞きました。" + body + "……行きます。ぜったい行きます。";
  } catch (e) { return ""; }
}

// =========================================================================
// 切り口テンプレ 8本（データ駆動）
//   take(mats) → 使う素材（無ければ null）／ headline(d, ctx) / paras(d, ctx)
//   文体＝ミミ：短文の畳みかけ → 一拍 → だいたい飯に着地。自分に「おめでとう」は言わない。
//   ★差し込むのは必ず“そのプレイヤーの実データ”（レース名・実オッズ・品名・スポット名）。
// =========================================================================
var KIKO_CUTS = [
  // ── 💥 大穴バズ回（殿堂入り） ──
  {
    id: "bigwin", rare: true, tag: "大穴",
    take: function (m) { return _kikoFind(m, "bigwin"); },
    headline: function (d, c) {
      return _kikoPick([
        "💥 " + d.mult + "倍。手が、まだ震えてる",
        "💥 " + d.mult + "倍。窓口のお姉さんに、二度見されました",
        "💥 " + d.mult + "倍。うさぎは、驚くと固まります"
      ], "bw" + c.seq);
    },
    paras: function (d, c) {
      var v = _kikoSeed("bwp" + c.seq) % 3;
      if (v === 1) return [
        d.race + "、" + d.dragon + "、" + d.odds + "倍。当たり券を窓口に出したら、お姉さんが券とわたしの顔を、交互に二回見ました。わたしも、自分の顔が見たかったです。",
        "買った理由を聞かれても困ります。前の日、あの子だけ、ごはんを残していなかったんです。それだけ。……食べる子は走る。これはわたしの人生の、数少ない確信です。",
        _kikoCoins(d.payout) + "。数えているあいだに、三回まちがえました。帰りの屋台で「今日はいちばん高いのを」と言ったら、いちばん高いのが、いつものと同じ値段でした。この屋台が好きです。"
      ];
      if (v === 2) return [
        "当たりました。" + d.odds + "倍。" + d.race + "の、" + d.dragon + "。ゴールの瞬間、わたしは立ったまま固まっていたそうです。となりの人が、目の前で手を振ってくれました。",
        "みんなが見ていなかった子でした。パドックのいちばん端で、ひとりだけ空を見ていた。変な子だなと思って、変な子に賭けました。変な子どうし、通じるものがあったのかもしれません。",
        "戻ってきたのは" + _kikoCoins(d.payout) + "。大金です。大金なので、こわくなって、すぐ半分を別のポケットに移しました。両方のポケットが重いのは、生まれてはじめてです。歩きかたが、変になりました。"
      ];
      return [
        d.race + "。" + d.dragon + "。" + d.odds + "倍。——書き写しておいて、まだ字のほうが信じられません。",
        "みんなが本命を見ていました。わたしは、掲示板のいちばん端にいた子を見ていました。理屈はあったような、なかったような。ただ、あの子の脚だけ、ほかと違う速さで畳まれていたんです。",
        "戻ってきたのは" + _kikoCoins(d.payout) + "。お祝いに屋台で一本だけ多く頼んだら、おじさんに「今日はどうした」と聞かれて、うまく説明できませんでした。……笑ってごまかしました。"
      ];
    }
  },
  // ── 🙏 すっからかん回（無心した）＝この連載でいちばん正直な回 ──
  //   貧乏と失敗の笑いどころを記録に残す（やらかした日ほど、読みものになる）。
  {
    id: "broke", tag: "すっからかん",
    take: function (m) { return _kikoFind(m, "broke"); },
    headline: function (d) { return (d.n || 1) >= 2 ? ("🙏 すっからかん、" + d.n + "回め。もう慣れてきました") : "🙏 すっからかんに、なりました"; },
    paras: function (d) {
      var n = d.n || 1;
      return [
        n >= 2
          ? ("正直に書きます。また、お財布が空になりました。通算" + n + "回めです。数えているあたり、まだ余裕があります。")
          : "正直に書きます。お財布が、空になりました。逆さにして振ったら、外れ券が一枚だけ落ちてきました。",
        "村のみんなのところへ行って、頭を下げました。ぱほぱほ、と。……みんな、なにも聞かずに、" + _kikoCoins(d.amt || 0) + "を握らせてくれました。聞かれないのが、いちばんこたえます。",
        "「返さなくていいから、当てな」と言われました。返さなくていいお金ほど、重いものはありません。次は当てます。……と、前にも書いた気がします。今日は屋台に寄りませんでした。前を通っただけです。匂いは、ただなので。"
      ];
    }
  },
  // ── 📜 物語回 ──
  {
    id: "story", tag: "島のできごと",
    take: function (m) { return _kikoFind(m, "story"); },
    headline: function (d) { return (KIKO_STORY_ARTS[d.key] || KIKO_STORY_ARTS._def).h; },
    paras: function (d) { return (KIKO_STORY_ARTS[d.key] || KIKO_STORY_ARTS._def).p; }
  },
  // ── 🏅 クラスが上がった回（勝っていないのに上がる“皆勤賞”も、そのまま書く）──
  {
    id: "rankup", tag: "暮らしの記録",
    take: function (m) { return _kikoFind(m, "rankup"); },
    headline: function (d) { return (d.wins || 0) === 0 ? "🏅 勝っていないのに、上のクラスへ" : "🏅 上のクラスに、行けることになりました"; },
    paras: function (d) {
      return [
        (d.wins || 0) === 0
          ? "上のクラスに上がりました。……勝っていないのに、です。走った数だけで上がったそうです。皆勤賞。学校でももらったことがないものを、賭場でもらいました。"
          : "上のクラスに上がりました。師匠に報告したら、「竜がでかくなるぞ」とだけ言われました。お祝いの言葉としては、だいぶ変わっています。",
        "賭けられる額も、大きくなるそうです。大きいほうの話です。わたしの財布は小さいほうで忙しいので、当面は関係ありません。でも、使わない引き出しが増えたみたいで、ちょっと気分がいいです。",
        "知らないコースも、走れるようになりました。知らない竜、知らない歓声、知らない屋台。……最後のひとつが、じつはいちばん楽しみです。"
      ];
    }
  },
  // ── 👗 服を買った回 ──
  {
    id: "outfit", tag: "おかいもの",
    take: function (m) { return _kikoFind(m, "outfit"); },
    headline: function (d) { return "👗 " + (d.name || "新しい服") + "を、買ってしまいました"; },
    paras: function (d) {
      return [
        (d.name || "新しい服") + "。買いました。" + _kikoCoins(d.price || 0) + "。値札を三回見て、財布を二回見て、店員さんの顔を一回見て、買いました。",
        "服を買うと、ごはんが減ります。これは算数です。でも、鏡の前に立ったら、算数のことは忘れました。似合うかどうかは、わかりません。耳が勝手に立っていたので、たぶん、うれしいんだと思います。",
        "帰りに屋台の前を通ったら、おじさんに二度見されました。「誰かと思った」。……前の格好がどれだけだったのか、という話です。今日は見るだけにして帰りました。服は、食べられないので。"
      ];
    }
  },
  // ── 🌙 連敗しみじみ回（5連敗以上） ──
  {
    id: "slump", tag: "しみじみ",
    take: function (m) { var x = _kikoFind(m, "lose3"); return (x && (x.d.run || 0) >= 5) ? x : null; },
    headline: function (d) { return "🌙 " + d.run + "つづき。それでも、明日ゲートは開く"; },
    paras: function (d) {
      return [
        d.run + "連敗です。ここまで来ると、もう天気の話をするみたいな顔で書けます。",
        "外し続けて折れるのは、当てる自信じゃなくて、見る目のほうなんだと知りました。「わたし、ほんとうは何も見えてないのかも」って。……でも竜は、毎日おなじ顔で走ってくるんです。折れてるのは、いつもこっちだけ。",
        "だから今日は予想をやめて、ただ走るのを見ました。速かった。それだけで、ちょっと戻ってきました。帰りに屋台へ寄ったのは、まあ、いつものことです。"
      ];
    }
  },
  // ── 📉 敗戦記 ──
  {
    id: "lose", tag: "敗戦記",
    take: function (m) { return _kikoFind(m, "lose3"); },
    headline: function (d, c) {
      return _kikoPick([
        "📉 " + d.run + "連敗。ちゃんと書きます",
        "📉 " + d.run + "連敗。外れ券で、しおりが作れます",
        "📉 " + d.run + "連敗。竜は悪くありません"
      ], "ls" + c.seq);
    },
    paras: function (d, c) {
      var v = _kikoSeed("lsp" + c.seq) % 3;
      if (v === 1) return [
        d.run + "連敗です。外れ券がたまってきたので、ノートのしおりにしています。いま、しおりのほうがページより多いです。",
        (d.race ? d.race + "。" : "") + "買った子は、スタートでくしゃみをしました。竜も、くしゃみをするんですね。知りませんでした。知りたくなかったです、あのタイミングでは。",
        "負け飯屋台のおじさんが、外れ券の束を見て、だまって薬味を足してくれました。ここまで来ると、券は通貨です。……おいしかったです。それがまた、くやしい。"
      ];
      if (v === 2) return [
        d.run + "回、つづけて外しました。先に言っておくと、竜は悪くありません。あの子たちは、いつもどおり一生けんめい走っています。おかしいのは、わたしの選びかたのほうです。",
        "今日は、名前がおいしそうな子にしました。理由はそれだけです。……書いていて、自分でもどうかと思います。予想家を名乗るのは、もう少し先にします。",
        "帰りに、いちばん安い串を一本だけ買いました。一本だけ、というのが、今日のわたしにできる精いっぱいの反省です。二本めは、明日の自分にゆずります。"
      ];
      return [
        "負けました。" + d.run + "回つづけて。勝った日の記事より、こっちのほうが読み物として面白いはずなので、正直に書きます。",
        (d.race ? d.race + "。" : "") + "直線で、わたしの本命だけが止まって見えました。ゲート前に「これはいける」と思った自分の顔を、いまは思い出したくないです。",
        "帰り道、屋台の湯気がやけに白く見えました。……食べました。おいしかったです。人間、そういうものです。うさぎですけど。"
      ];
    }
  },
  // ── 🏆 勝利回 ──
  {
    id: "win", tag: "勝った日",
    take: function (m) { return _kikoFind(m, "win"); },
    headline: function (d) { return "🏆 " + d.dragon + "だけ、線がまっすぐだった"; },
    paras: function (d) {
      return [
        "勝ちました。書いておかないと明日の自分が信じてくれないので、先に書いておきます。" + d.race + "、" + d.type + d.odds + "倍、" + d.dragon + "。",
        "ゲートが開いた瞬間、あの子だけ、進む線がまっすぐでした。ほかの子はみんな、ちょっとだけ迷っていた。……理屈は後から付けます。とにかく、まっすぐだったんです。",
        "払い戻しは" + _kikoCoins(d.payout) + "。はい、もう半分は今日のごはんに消えます。悔いはありません。"
      ];
    }
  },
  // ── 🍜 食レポ回 ──
  {
    id: "meal", tag: "たべある記",
    take: function (m) { return _kikoFind(m, "newMeal"); },
    headline: function (d) { return (d.ic || "🍜") + " " + d.name + "に、出会ってしまった"; },
    paras: function (d) {
      var lead = d.where ? (d.where + "で、" + d.name + "。") : ("島で、" + d.name + "。");
      var out = [
        lead + "——出会ってしまいました。",
        d.react || d.note || "ひとくちで、その日の順位がどうでもよくなる味でした。",
        (d.note && d.react ? d.note + "　" : "") + "おいしいものを見つけた日は、負けていても記事が1本増えるので、実質勝ちです。……実質。"
      ];
      var rumor = _kikoRumor();   // まだ出会っていない一皿の噂（§2接続・品名は伏せる）
      if (rumor) out.push(rumor);
      return out;
    }
  },
  // ── 📷 絶景回（☆3） ──
  {
    id: "view", tag: "フォト日記",
    take: function (m) { var x = _kikoFind(m, "photo"); return (x && (x.d.stars || 0) >= 3) ? x : null; },
    headline: function (d) { return "📷 " + d.spot + "で、いちばんの一枚が撮れた"; },
    paras: function (d) {
      return [
        d.spot + "。☆3、出ました。自分で言うのもなんですが、これは、いい。",
        "シャッターを押す前の一拍が、ぜんぶだと思うんです。待って、待って、「いま」と思ったところで押す。……竜を見るときと、たぶん同じ。だからわたし、写真が好きなのかもしれません。",
        "帰ってから何度も見返しました。そのあいだに、おなかが鳴りました。"
      ];
    },
    photo: function (d) { return d.src || ""; }
  },
  // ── 🏝️ 散歩回 ──
  {
    id: "walk", tag: "島さんぽ",
    take: function (m) { return _kikoFind(m, "photo"); },
    headline: function (d) { return "🏝️ " + d.spot + "まで、歩いてきました"; },
    paras: function (d) {
      return [
        "とくに用事もなく、" + d.spot + "まで。☆" + (d.stars || 1) + "の一枚を置いておきます。",
        "この島はレース場だけじゃない、というのを、わたしはすぐ忘れます。歩くと足の裏から思い出す。今日みたいな日が、たぶんいちばん贅沢なんだと思います。",
        "帰りに寄り道して、結局なにか食べました。いつもの。"
      ];
    },
    photo: function (d) { return d.src || ""; }
  },
  // ── 🐰 日常回（下限保証・素材ゼロでも書く） ──
  {
    id: "daily", tag: "平常運転", eatsAll: true,
    take: function () { return { t: "daily", d: {} }; },
    headline: function (d, c) {
      return _kikoPick([
        "🐰 ここまで" + c.races + "戦。今日は、平常運転",
        "🐰 なんにもなかった日のことを書きます",
        "🐰 " + c.races + "戦めの、朝ごはんの話",
        "🐰 とくに書くことがない、という記事"
      ], "d" + c.seq);
    },
    paras: function (d, c) {
      var mid = c.wins > 0
        ? ("ここまで" + c.races + "戦して" + c.wins + "勝。数字にするとあっさりしていますが、1戦ずつ、ぜんぶ心臓に悪かったです。あとから見ると、負けた日のほうがよく思い出せるのは、なんででしょうね。")
        : ("ここまで" + c.races + "戦。まだ勝ちはありません。でも、竜の見分けがつくようになってきました。あの子は前に出たがる、この子は最後まで力を隠す。……そういうのが分かると、外しても、ちょっと楽しいです。");
      return [
        "とくべつな日じゃない日のことも書いておきます。連載なので。",
        mid,
        _kikoPick([
          "今日はよく寝て、よく食べました。それだけです。それが、いちばんむずかしいって、最近わかってきました。",
          "夕方、風が変わりました。明日は走りやすい日になりそうです。……という気がするだけです。",
          "洗濯物を干して、耳を乾かして、屋台の匂いに負けて、結局食べました。そういう日。"
        ], "e" + c.seq)
      ];
    }
  }
];

// ── 物語回の中身（フラグごと）。★ここに書く人物は、そのフラグ時点で必ず登場済み ──
var KIKO_STORY_ARTS = {
  debt: {
    h: "🧾 借金が、300万あるそうです",
    p: [
      "初レースのあと、師匠に呼ばれました。ほめられるのかなと思って行ったら、帳面を見せられました。船賃、宿代、装備の立て替え。合計、300万。",
      "さんびゃくまん。……声に出したら、桁が口に入りきりませんでした。わたしは着いた日から、大借金のうさぎだったんです。知らないうちに。",
      "そのうち297万は、師匠が黙って立て替えてくれていました。わたしの持ちぶんは、3万。3万なら返せそう、と思ってしまった自分がこわいです。感覚が、もうおかしい。……とりあえず、屋台でいちばん安いものを食べました。借金があっても、おなかは減ります。"
    ]
  },
  assets: {
    h: "🏦 わたしに、値段がついていたらしい",
    p: [
      "村への借り、ぜんぶ返し終わりました。……その報告のつもりで行ったら、まったく別の話をされました。",
      "「あなた、もう値がついてるのよ」。暮らしも、評判も、走った記録も、ぜんぶ足したものを『資産』と呼ぶんだそうです。わたしが積んできたものが、勝手に数字になっていました。",
      "こわい話のようで、うれしい話でした。ゼロから始めた人間に、目盛りができたということなので。……今夜はちょっといいものを食べます。"
    ]
  },
  repay: {
    h: "🍶 297万、返しに行きました",
    p: [
      "師匠に立て替えてもらっていた297万。資産が300万を超えたので、返しに行きました。封筒まで用意して。",
      "受け取ってもらえませんでした。「帳場はとっくに黒字だ。お前の走りが島に客を呼んだ、その分でな」って。……ずるいです、そういうの。",
      "「借りを気にする暇があったら、次を勝て」。はい。ぜんぶ、走りで返します。まずは今日のごはんからです。"
    ]
  },
  poro: {
    h: "🐲 相棒ができました。泣き虫です",
    p: [
      "竜と暮らすことになりました。よく泣きます。というか、ほとんど泣いています。",
      "言葉は話しません。かわりに、しっぽで膝を叩いたり、鼻先で背中を押したりして、言いたいことを全部伝えてきます。……こっちのほうが伝わるので、困ります。",
      "ごはんはわたしの倍たべます。それでも、いてくれるほうが、ずっといい。"
    ]
  },
  phone: {
    h: "📱 スマホを買いました。配信、はじめます",
    p: [
      "買いました。人生ではじめての、自分の端末。手が震えて、開封に5分かかりました。",
      "画面の向こうに人がいるのが、まだ信じられません。わたしのぱほぱほを聞きたい人が、この島の外にもいるらしい。……ほんとうに？",
      "とりあえず、屋台の湯気を撮って送ってみました。それが記念すべき一本目です。内容は、ない。"
    ]
  },
  scout: {
    h: "🌋 竜を、探しに行けるようになりました",
    p: [
      "レース場の外へ、竜を探しに行っていいと言われました。……いいんですか、そんなことして。",
      "竜は喋りません。でも、耳の向き、しっぽの高さ、こちらを見る間の長さ。ぜんぶが返事です。読み違えると、すっと消えます。",
      "きょうは一頭も連れて帰れませんでした。でも、目が合ったので、たぶん、また会えます。"
    ]
  },
  _def: {
    h: "📖 島で、なにかが動いた日",
    p: [
      "うまく言葉にできない日のことも、書き残しておきます。",
      "たぶん、あとから振り返ったときに「あの日だったな」と思う類の一日でした。",
      "とりあえず、ごはんはおいしかったです。"
    ]
  }
};

// =========================================================================
// 生成本体：ホーム到着時に1本まで
// =========================================================================
function kikoMaybeWrite() {
  try {
    var p = state && state.player; if (!p) return null;
    if ((p.completedRaces || 0) < 1) return null;             // 初出走前は連載が始まっていない
    if (typeof getStoryFlag === "function" && !getStoryFlag("kikoStarted")) return null;  // 命名VN前は書かない
    _kikoScanStory();

    var mats = p.kikoMat || (p.kikoMat = []);
    var races = p.completedRaces || 0;
    // 1件あればすぐ1本になる素材（勝ち・物語に加えて、すっからかん／クラス昇格／服＝暮らしの節目）
    var strong = mats.filter(function (m) { return m.t === "bigwin" || m.t === "win" || m.t === "story" || m.t === "broke" || m.t === "rankup" || m.t === "outfit"; });
    var floorDue = (races - (p.kikoLastRace == null ? -KIKO_DAILY_EVERY : p.kikoLastRace)) >= KIKO_DAILY_EVERY;
    if (!(mats.length >= 2 || strong.length >= 1 || floorDue)) return null;

    var arts = p.kikoArts || (p.kikoArts = []);
    var lastCut = arts.length ? arts[0].cut : "";
    // 該当する切り口を集め、直前と同じ顔にならないほうを選ぶ（同じ一日でも記事の顔が変わる）
    var picked = null, fallback = null;
    for (var i = 0; i < KIKO_CUTS.length; i++) {
      var cut = KIKO_CUTS[i], mat = null;
      try { mat = cut.take(mats); } catch (e) { mat = null; }
      if (!mat) continue;
      if (cut.id === "daily" && !floorDue && mats.length) continue;   // 素材があるのに日常回で潰さない
      if (!fallback) fallback = { cut: cut, mat: mat };
      if (cut.id !== lastCut) { picked = { cut: cut, mat: mat }; break; }
    }
    if (!picked) picked = fallback;
    if (!picked) return null;

    var seq = (p.kikoSeq || 0) + 1; p.kikoSeq = seq;
    var ctx = { races: races, wins: p.wins || 0, seq: seq };
    var d = picked.mat.d || {};
    var art = {
      id: "ka" + seq, cut: picked.cut.id, tag: picked.cut.tag, race: races,
      headline: String(picked.cut.headline(d, ctx) || ""),
      paras: (picked.cut.paras(d, ctx) || []).map(function (x) { return String(x || ""); }).filter(Boolean),
      photo: (picked.cut.photo ? (picked.cut.photo(d) || "") : ""),
      rare: !!picked.cut.rare
    };
    if (!art.headline || !art.paras.length) return null;

    // 使った素材を落とす（日常回はキューをまとめて掃除）
    if (picked.cut.eatsAll) { p.kikoMat = []; }
    else {
      var ix = mats.indexOf(picked.mat);
      if (ix >= 0) mats.splice(ix, 1);
    }
    p.kikoLastRace = races;
    arts.unshift(art);
    while (arts.length > KIKO_ART_MAX) arts.pop();
    if (art.rare) { var hof = p.kikoHof || (p.kikoHof = []); hof.unshift(art); }
    p.kikoUnread = true;
    // 👀 書いたぶんだけ読者が増える（紀行の仕様＝やったことが記録される→読者が増える→印税になる）。
    //   殿堂入りはよく読まれる。数は記事に持たせて、紙面で「この記事で +◯人」と見せる。
    art.fans = kikoFansAdd(art.rare ? KIKO_FANS_RARE : KIKO_FANS_ART);
    try { if (typeof saveGame === "function") saveGame(); } catch (e) {}
    return art;
  } catch (e) { return null; }
}

// 紀行タブのドット＝未読の新記事、または連載の取材に行ける（どちらも「開けば何かある」状態）。
// =========================================================================
// 👀 書いて増えた読者（state.player.kikoFans）。goalFollowers（goals.js）が足しこむ。
//   紀行の仕様＝島でやったことが記録される → 読者が増える → 印税（state.js checkDailyLogin）になる。
//   ★足すのは読者の数だけ。印税の式そのものには触れない（読者×記録の充実、のまま）。
//   記事1本 +40／殿堂入り +250／連載は回が進むほど大きく（kiko_serial.js）。
// =========================================================================
var KIKO_FANS_ART = 40, KIKO_FANS_RARE = 250;
function kikoFansAdd(n) {
  try {
    n = Math.max(0, Math.floor(n || 0));
    var p = state.player; p.kikoFans = (p.kikoFans || 0) + n;
    return n;
  } catch (e) { return 0; }
}
function kikoHasUnread() {
  try { if (state.player && state.player.kikoUnread) return true; } catch (e) {}
  try { if (typeof kikoSerialReady === "function" && kikoSerialReady()) return true; } catch (e) {}
  try { if (state.player && state.player.kikoSerial && state.player.kikoSerial.fresh) return true; } catch (e) {}
  return false;
}

// =========================================================================
// 読者コメント（既存SNSのファン名資産を流用）。
// ★ここで使うのは全員モブ／ファンのアカウント＝顧問（サケ・ミズ・マクラ・スミカ・
//   セレスティア）とポロは出さない。門番の要らない相手だけを並べることで fail-closed。
// =========================================================================
var KIKO_VOICES = {
  win: [
    { h: "@oshi_dragon", n: "推し竜ガチ勢", ic: "🔥", t: "うおおお獲ったか！ 俺は3着に泣いた。悔しい。でも、うれしい。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "「線がまっすぐ」って言い方、ミミちゃんにしか書けないんだよなあ🐰" },
    { h: "@rival_yosou", n: "好敵手の予想家", ic: "🐲", t: "……その買い目、俺も持ってた。言っとくが、参考にしたわけじゃない。" },
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "半分ごはんに消えるの、ほんと好き。そういうとこだよ。" }
  ],
  bigwin: [
    { h: "@dragon_news", n: "竜レース速報", ic: "📰", t: "【本日の波乱】この配当を的中させた読者がいるとの報。……この記事のことか。" },
    { h: "@oshi_dragon", n: "推し竜ガチ勢", ic: "🔥", t: "保存した。額縁に入れる。俺の分まで当ててくれてありがとう。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "屋台で一本多く頼むだけなの、慎ましすぎて泣いた🌸" },
    { h: "@rival_yosou", n: "好敵手の予想家", ic: "🐲", t: "……端っこを見てた、か。覚えておく。" }
  ],
  lose: [
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "こういう日もあるよ。というか、こういう日のほうが多い。ごはん食べな。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "負けた日にちゃんと書く人、信用できる🐰 明日も読みます" },
    { h: "@oshi_dragon", n: "推し竜ガチ勢", ic: "🔥", t: "湯気が白く見える日、あるよな。わかる。" },
    { h: "@shima_gohan", n: "島ごはん部", ic: "🍙", t: "そういう日はうちの煮込みです。汁まで飲んでください。" }
  ],
  meal: [
    { h: "@shima_gohan", n: "島ごはん部", ic: "🍙", t: "うちの部の推し品です！ 見つけてくれてありがとう🍜" },
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "え、そこ知らなかった。今晩ぜったい行く。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "食レポ回のミミちゃん、語彙が3倍になるの好き🌸" },
    { h: "@shima_weather", n: "島の天気よほう", ic: "🌤️", t: "本日夜は冷えます。あたたかいものを食べる判断、正解です。" }
  ],
  view: [
    { h: "@shima_weather", n: "島の天気よほう", ic: "🌤️", t: "この光、たぶん風が抜けた直後ですね。よく待ちました。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "待ち受けにしました。もう3日変えてない🐰" },
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "島に住んでるのに、こんな顔してるとこ、知らなかった。" },
    { h: "@dragon_news", n: "竜レース速報", ic: "📰", t: "写真の使用許諾についてご相談させてください。（真面目な打診）" }
  ],
  story: [
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "……ちょっと涙出た。今日はこれ読めてよかった。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "最初から見てるファンとしては、感慨しかないです🐰" },
    { h: "@dragon_news", n: "竜レース速報", ic: "📰", t: "この島の記録として、この記事は残ると思います。" },
    { h: "@oshi_dragon", n: "推し竜ガチ勢", ic: "🔥", t: "こういうのが書けるやつが、結局いちばん強いんだよな。" }
  ],
  broke: [
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "頭を下げられる人は、強いよ。次の屋台は、わたしがおごる。" },
    { h: "@shima_gohan", n: "島ごはん部", ic: "🍙", t: "「匂いは、ただ」。名言です。……明日は煮込みを多めに作っておきます。" },
    { h: "@oshi_dragon", n: "推し竜ガチ勢", ic: "🔥", t: "すっからかんを連載に書くやつ、はじめて見た。逆に信用できる。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "ぱほぱほ……🐰（意味はわからないけど、泣きました）" }
  ],
  rank: [
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "皆勤賞、ばかにできないよ。来つづけるのが、いちばんむずかしいんだから。" },
    { h: "@rival_yosou", n: "好敵手の予想家", ic: "🐲", t: "……上で待っている、と言いたいが、俺もまだ下にいる。" },
    { h: "@oshi_dragon", n: "推し竜ガチ勢", ic: "🔥", t: "上のクラスの竜は、でかいぞ。首が疲れるから覚悟しとけ。" },
    { h: "@shima_gohan", n: "島ごはん部", ic: "🍙", t: "知らない屋台を楽しみにしている人を、当部は全力で応援します。" }
  ],
  fit: [
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "耳が立ってるの、目に浮かびます🌸 写真も、いつかお願いします。" },
    { h: "@shima_gohan", n: "島ごはん部", ic: "🍙", t: "服は食べられない。そのとおりです。なので、明日はちゃんと食べてください。" },
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "二度見されるの、いい買い物の証拠だよ。" },
    { h: "@rival_yosou", n: "好敵手の予想家", ic: "🐲", t: "……値札を三回見るのは、普通だ。俺は五回見る。" }
  ],
  daily: [
    { h: "@aya_no_hibi", n: "常連のアヤ", ic: "💬", t: "なんにもない日の記事、いちばん好きかもしれない。" },
    { h: "@shima_weather", n: "島の天気よほう", ic: "🌤️", t: "明日は北寄りの風。走りやすい日になりそうです。" },
    { h: "@usamimi_fc", n: "うさ耳ファンクラブ", ic: "🌸", t: "よく寝てよく食べる。それが最強です🐰" },
    { h: "@shima_gohan", n: "島ごはん部", ic: "🍙", t: "結局食べたの、めちゃくちゃ健全でよいと思います。" }
  ]
};
// 切り口→声のプール（無い切り口は近いものへ寄せる）
var KIKO_VOICE_MAP = { broke: "broke", rankup: "rank", outfit: "fit", win: "win", bigwin: "bigwin", lose: "lose", slump: "lose", meal: "meal", view: "view", walk: "view", story: "story", daily: "daily" };

function kikoComments(art) {
  var out = [];
  try {
    var pool = KIKO_VOICES[KIKO_VOICE_MAP[art.cut] || "daily"] || KIKO_VOICES.daily;
    var n = 2 + (_kikoSeed(art.id) % 2);            // 2〜3件
    var start = _kikoSeed(art.id + "c") % pool.length;
    var fol = (typeof goalFollowers === "function") ? goalFollowers() : 800;
    for (var i = 0; i < n && i < pool.length; i++) {
      var v = pool[(start + i) % pool.length];
      out.push({ h: v.h, n: v.n, ic: v.ic, t: v.t, fav: 3 + (_kikoSeed(art.id + v.h) % Math.max(12, Math.floor(fol / 60))) });
    }
  } catch (e) {}
  return out;
}

// =========================================================================
// M4 理由つき前回比：紀行を開いたとき、前回訪問からの読者の増分を“理由ごと”に出す。
//   式＝goalFollowers（800 + 名声×2 + 完走×15 + 勝利×40）。増えた分だけ帰属表示する。
//   ★グラフも目標カウンタも置かない（計器禁止）。1行の読み物として出す。
// =========================================================================
function kikoReaderDelta() {
  try {
    var p = state.player;
    var now = (typeof goalFollowers === "function") ? goalFollowers() : 0;
    var snap = p.kikoFolSnap || null;
    var cur = { races: p.completedRaces || 0, wins: p.wins || 0, fol: now, fans: p.kikoFans || 0 };
    p.kikoFolSnap = cur;
    if (!snap) return null;                                   // 初回は比較対象が無い
    var diff = now - (snap.fol || 0);
    if (diff <= 0) return null;
    var parts = [];
    var dw = (cur.wins - (snap.wins || 0)), dr = (cur.races - (snap.races || 0));
    if (dw > 0) parts.push("勝利のニュース +" + (dw * 40));
    if (dr - dw > 0) parts.push("完走の記録 +" + ((dr - dw) * 15));
    var dfan = Math.max(0, cur.fans - (snap.fans || 0));
    if (dfan > 0) parts.unshift("連載と記事 +" + dfan);
    var rest = diff - dw * 40 - Math.max(0, dr - dw) * 15 - dfan;
    if (rest > 0) parts.push("島での評判 +" + rest);
    return { diff: diff, why: parts.join("／") };
  } catch (e) { return null; }
}

if (typeof window !== "undefined") {
  window.kikoMatPush = kikoMatPush;
  window.kikoMaybeWrite = kikoMaybeWrite;
  window.kikoHasUnread = kikoHasUnread;
  window.kikoComments = kikoComments;
  window.kikoReaderDelta = kikoReaderDelta;
  window.kikoFansAdd = kikoFansAdd;
  window.KIKO_CUTS = KIKO_CUTS;
}
