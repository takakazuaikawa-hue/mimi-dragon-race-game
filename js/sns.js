// =========================================================================
// sns.js — ミミのミニSNS「ぴょこったー」（日替わりで遊べる参加型SNS・すべて表示専用メタ）。
// =========================================================================
// 受動的な“投稿一覧＋いいね”から、毎日触って遊べる本物っぽいSNSへ：
//   ・日替わり生フィード … 毎日ちがう投稿が流れる（日付シードで巡回）＋複数リアクション＋リプライ
//   ・デイリーお題投票    … その日のお題に投票→島のみんなの反応を%で表示（翌日更新）
//   ・自分で投稿してバズる … テンプレから投稿→フォロワー連動でリアクションが伸び“バズ”
//   ・連続ログインごほうび … SNSを開いた連続日数を記録→称号バッジ（コスメ・コイン非干渉）
// ★レースの着順・オッズ・配当・経済には一切干渉しない（[[race-math-immutable]]）。
//   記録は state.player.sns（reacts / replies / votes / myPosts / checkin / readLetters）だけ。
// 追加方法：SNS_DAILY / SNS_POSTS / SNS_POLLS / POST_TEMPLATES / FAN_LETTERS に1件足すだけ。
// =========================================================================

// ── 進行値ヘルパ（未定義でも落ちない・表示用） ──
function _snsP() { return (typeof state !== "undefined" && state.player) ? state.player : {}; }
function _snsRank() { return _snsP().rank || 1; }
function _snsWins() { return _snsP().wins || 0; }
function _snsRaces() { return _snsP().completedRaces || 0; }
function _snsMaxCoins() { return _snsP().maxCoinsReached || _snsP().coins || 0; }
function _snsFlag(f) { return (typeof getStoryFlag === "function") ? !!getStoryFlag(f) : false; }
function _snsFollowers() { return (typeof goalFollowers === "function") ? goalFollowers() : (800 + _snsRaces() * 15 + _snsWins() * 40); }

// ── 日付（堅牢な通日番号＝_epochDay流用／シード用の整数） ──
function _snsDay() { try { return (typeof _epochDay === "function") ? _epochDay() : Math.floor(Date.now() / 86400000); } catch (e) { return 0; } }
function _snsSeed(salt) { var d = _snsDay(); var h = (d * 2654435761 + (salt || 0) * 40503) >>> 0; return h; }
function _snsRandFrom(seed) { // 0..1 の決定的擬似乱数
  var x = (seed ^ 0x9e3779b9) >>> 0; x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return (x % 100000) / 100000;
}
// 配列から日替わりで n 件を決定的に選ぶ（重複なし）。
function _snsDailyPick(arr, n, salt) {
  var idx = arr.map(function (_, i) { return i; });
  // Fisher-Yates（日付シード）
  for (var i = idx.length - 1; i > 0; i--) {
    var r = Math.floor(_snsRandFrom(_snsSeed((salt || 0) + i)) * (i + 1));
    var t = idx[i]; idx[i] = idx[r]; idx[r] = t;
  }
  return idx.slice(0, Math.min(n, arr.length)).map(function (i) { return arr[i]; });
}
function _snsText(v) { return (typeof v === "function") ? v() : v; }

// ── リアクション種別（複数から選べる＝本物っぽさ） ──
var SNS_REACTS = [
  { k: "like", e: "❤️", lb: "すき" },
  { k: "fire", e: "🔥", lb: "アツい" },
  { k: "lol", e: "😂", lb: "わら" },
  { k: "wow", e: "😮", lb: "おどろき" },
  { k: "clap", e: "👏", lb: "ぱちぱち" }
];

// ── 投稿写真（Instagram風＝画像主体）。投稿主(handle)ごとに世界観の画像を割り当て、id でブレずに1枚選ぶ。 ──
var SNS_IMGS = {
  "@mimi_yosou":     ["images/39_char_mimi-keyvisual-racetrack.png", "images/homebg/beach_day.webp", "images/homebg/balcony_night.webp"],
  "@usamimi_fc":     ["images/homebg/beach_day.webp", "images/home_vista_day.jpg"],
  "@sake_oyakata":   ["images/cast/stand/sake.webp"],
  "@oshi_dragon":    ["images/racebg/fire.webp", "images/12_stage_seiryu-street-sunset_v2.png"],
  "@mizu_market":    ["images/cast/stand/mizu.webp"],
  "@sumika_village": ["images/homebg/market_day.webp"],
  "@makura_live":    ["images/12_stage_seiryu-street-sunset_v2.png", "images/racebg/fire.webp"],
  "@poro_naki":      ["images/cast/stand/poro.webp?v=2"],
  "@shima_weather":  ["images/home_vista_day.jpg", "images/homebg/beach_day.webp"],
  "@shima_gohan":    ["images/homebg/market_day.webp"],
  "@dragon_news":    ["images/10_stage_seiryu-street-night.png"],
  "@rival_yosou":    ["images/14_stage_seiryu-street-day_v1.png"],
  "@aya_no_hibi":    ["images/homebg/balcony_night.webp"],
  "@celestia_sky":   ["images/cast/stand/celestia.webp"],
  "@ryusha_news":    ["images/cast/stand/poro.webp?v=2", "images/home_vista_day.jpg"]
};
var SNS_IMG_FALLBACK = ["images/home_vista_day.jpg", "images/12_stage_seiryu-street-sunset_v2.png", "images/homebg/beach_day.webp"];
function _snsHash(s) { var h = 0, t = String(s || ""); for (var i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) >>> 0; } return h; }
// ★立ち絵の門番台帳：未登場キャラの“顔”はどの投稿写真にも出さない（名前を伏せても顔が出れば同じこと）。
//   新しい立ち絵を SNS_IMGS に足すときは、ここにも1行足すこと（既定は素通し＝表示なので登録漏れが唯一の穴）。
var SNS_STAND_GATE = [
  { m: "/stand/poro", g: "@poroFound" },    // ポロ＝発見後だけ（顔が出ると「泣き虫ポロ」の命名オチが割れる）
  { m: "/stand/celestia", g: "celestia" },  // セレスティア＝第5話まで顔も封印（伏線段階は“知らないお姉さん”）
  { m: "/stand/mizu", g: "mizu" },
  { m: "/stand/sumika", g: "sumika" },
  { m: "/stand/makura", g: "makura" }
];
function _snsImgOk(url) {
  var u = String(url || "");
  for (var i = 0; i < SNS_STAND_GATE.length; i++) if (u.indexOf(SNS_STAND_GATE[i].m) >= 0) return _snsCastOk(SNS_STAND_GATE[i].g);
  return true;   // 風景・街並みなど（キャラの正体を含まない絵）は常時OK
}
function _snsPostImg(po) {
  if (po && po.img) return po.img;
  var pool = ((po && SNS_IMGS[po.handle]) || SNS_IMG_FALLBACK).filter(_snsImgOk);
  // ★fail-closed：プールが立ち絵1枚だけの相手（例 @poro_naki）は全滅する。ここで元のプールへ戻すと
  //   門番が素通しになる（ui_sns.js のストーリーは handle 直指定で呼ぶため実際に露出していた）。
  //   全滅時は元へ戻さず、立ち絵を含まない共通フォールバック（風景）へ倒す。
  if (!pool.length) pool = SNS_IMG_FALLBACK;
  return pool[_snsHash(po && po.id) % pool.length];
}
// 自分の投稿で選べる“カメラロール”（写真＋既定キャプション）。gate＝門番（"@フラグ" or 顧問キー）。
var SNS_CAMERA_ALL = [
  { img: "images/39_char_mimi-keyvisual-racetrack.png", cap: "カメラロールから、レース場の一枚📸" },
  { img: "images/homebg/beach_day.webp", cap: "島のビーチの写真🏖️" },
  { img: "images/homebg/balcony_night.webp", cap: "夜のバルコニーの写真🌙" },
  { img: "images/racebg/fire.webp", cap: "炎のコースの写真🔥" },
  { img: "images/home_vista_day.jpg", cap: "晴れた島を写した一枚☀️" },
  { img: "images/12_stage_seiryu-street-sunset_v2.png", cap: "夕暮れの聖龍街🌇" },
  // ★BUGFIX（出会う前のキャラが出る）：発見前のカメラロールに「ポロ」の名前も立ち絵も出さない。
  { img: "images/cast/stand/poro.webp?v=2", cap: "相棒のポロと📷 泣き虫だけど最高の子", gate: "@poroFound" },
  { img: "images/homebg/market_day.webp", cap: "市場のカメラロールから🍢" }
];
// ui_sns.js は SNS_CAMERA を配列として直接読むので、中身を“その場で”入れ替えて同期する（snsCheckin から毎描画）。
var SNS_CAMERA = [];
function snsSyncCamera() {
  var ok = SNS_CAMERA_ALL.filter(function (c) { return _snsCastOk(c.gate); });
  SNS_CAMERA.length = 0;
  for (var i = 0; i < ok.length; i++) SNS_CAMERA.push(ok[i]);
  return SNS_CAMERA;
}
snsSyncCamera();   // 読み込み時にも中身を入れておく（state未生成でも門番はfalse側＝安全に倒れる）

// =========================================================================
// 日替わり“生フィード”の投稿プール（毎日ここから巡回して数件流れる）。
//   base=元のリアクション数の目安。replies=リプライ選択肢[{choice, back}]（任意）。
// =========================================================================
var SNS_DAILY = [
  { id: "d_weather", ic: "🌤️", name: "島の天気よほう", handle: "@shima_weather", base: 88,
    text: "本日の島は晴れ、午後から風つよめ。翼の強い竜にはおいかぜ、かも？🍃" },
  { id: "d_oshi", ic: "🔥", name: "推し竜ガチ勢", handle: "@oshi_dragon", base: 156,
    text: "今日の本命、どの子にする？ 俺はもう決めてる。…まあ、当たるとは言ってない。",
    replies: [{ choice: "本命教えて！", back: "それは秘密。外したら笑われるからな…！" }, { choice: "穴党です", back: "わかってる人だ……！ 一緒に夢見よう。" }] },
  { id: "d_sake", ic: "🍶", name: "サケ・ウダダ", handle: "@sake_oyakata", base: 120,
    text: "脚質ってのはな、性格だ。逃げる奴、待つ奴、差す奴。竜にも生き方がある。…よく見てやれ。" },
  { id: "d_mizu", ic: "💧", name: "ミズ", handle: "@mizu_market", base: 134,
    text: "人気が集まる竜ほど、配当はしぼむ。…みんなが見てない“価値”は、いつも端っこに落ちてるわ。あはん。" },
  { id: "d_gohan", ic: "🍙", name: "島ごはん部", handle: "@shima_gohan", base: 73,
    text: "レース場の屋台、今日は焼きとうもろこしの日！ 醤油の焦げる匂い、罪すぎる……🌽" },
  { id: "d_makura", ic: "🎤", name: "実況マクラ", handle: "@makura_live", base: 198,
    text: "さあ今日も竜が駆ける！ 画面の前のキミの声援が、あの子たちの翼になるんだ。いくぞ——！🐉" },
  { id: "d_sumika", ic: "🏘️", name: "スミカ・ラグナ", handle: "@sumika_village", base: 64,
    text: "ミミ様。今日も村は平和です。みんな、配信のコメントの練習をしているとか……ふふ。" },
  { id: "d_fan2", ic: "🌸", name: "うさ耳ファンクラブ", handle: "@usamimi_fc", base: 188,
    text: "きょうの“ぴょこ占い”🔮 ラッキー脚質は【差し】！ 後ろから伸びる子に、ご縁があるかも？",
    replies: [{ choice: "信じる！", back: "その素直さがミミちゃんに届くんだよ〜🐰" }, { choice: "占い苦手", back: "ふふ、当たっても外れても、楽しんだもん勝ち！" }] },
  { id: "d_news", ic: "📰", name: "竜レース速報", handle: "@dragon_news", base: 102,
    text: "【速報】本日のメインレース、出走表が公開。波乱の予感に場内ざわめく。あなたの予想は？" },
  { id: "d_rival", ic: "🐲", name: "好敵手の予想家", handle: "@rival_yosou", base: 117,
    text: function () {
      const articles = _snsP().kikoArts;
      const raceStory = Array.isArray(articles) && articles.find(a => a && /^ka[1-9]\d*$/.test(a.id) &&
        ["win", "lose", "bigwin"].includes(a.cut) && Number.isInteger(a.race) && a.race > 0 && a.race <= _snsRaces() &&
        typeof a.headline === "string" && a.headline.trim() && Array.isArray(a.paras) && a.paras.some(p => typeof p === "string" && p.trim()));
      if (raceStory) return (raceStory.cut === "lose" ? "ミミの紀行の敗戦記、読んだぞ。" : "ミミの紀行、当てた一戦の話を読んだぞ。") + "……俺の出走表は俺が書く。読み比べたくて開いただけだ。";
      return "こっちでも予想の話ができるんだな。俺はまず枠順を見る。そっちは、何から見る？";
    } },
  { id: "d_aya", ic: "💬", name: "常連のアヤ", handle: "@aya_no_hibi", base: 95,
    text: "ミミちゃんの「ぱほぱほ〜」聞くと、なんか今日もがんばれる気がするんだよね。ふしぎ。" },
  { id: "d_celes", ic: "🌌", name: "セレスティア", handle: "@celestia_sky", base: 333,
    text: "……今日も、ちっちゃな灯りがよく燃えてるね。さて、どこまで視えるかな。" }
];
// ★BUGFIX（出会う前のキャラが投稿する）：顧問/ポロの投稿・手紙は「出会った後」だけ出す。
//   門番の正本＝顧問は advisorMet(castKey)（総資産＋その章の既読）／"@フラグ"はストーリーフラグ（例：ポロ＝poroFound）。
//   それ以外（ミミ・島民・モブ・新聞・屋台）は常時OK。SNSは本名・ハンドル・立ち絵が一度に出る最悪の露出面なので、
//   advisorMet が未定義（読み込み順の事故など）のときは “出さない” 側に倒す＝fail-closed（ネタバレは取り返しがつかない）。
function _snsCastOk(gate) {
  if (!gate) return true;
  if (gate.charAt(0) === "@") return _snsFlag(gate.slice(1));
  return (typeof advisorMet === "function") ? !!advisorMet(gate) : false;
}
var SNS_DAILY_GATE = { d_sake: "sake", d_mizu: "mizu", d_makura: "makura", d_sumika: "sumika", d_celes: "celestia" };
function _snsDailyOk(po) { return _snsCastOk(SNS_DAILY_GATE[po.id]); }

// =========================================================================
// マイルストーン投稿（進行で“永続解放”・節目の祝福）。日替わりとは別に上位に出る。
// =========================================================================
var SNS_POSTS = [
  { id: "p_firstwin", ic: "🌸", name: "うさ耳ファンクラブ", handle: "@usamimi_fc", base: 240,
    text: function () { return `🎉 ミミちゃん${_snsWins()}勝目おめでとう！ 予想が当たった瞬間のしっぽ、見た？ ぴょんって跳ねたよね！`; },
    unlock: function () { return (typeof unlockDelayDay === "function") ? unlockDelayDay("p_firstwin", _snsWins() >= 1) : _snsWins() >= 1; } },   // ★D9-11: 勝利当日はVN/toast→投稿は翌日
  { id: "p_rank2", ic: "🎤", name: "実況マクラ", handle: "@makura_live", base: 158,
    text: function () { return `ミミ、ランク${_snsRank()}到達！ 新しい地域のレースにも挑めるぞ。視聴者みんなで応援だ！`; },
    unlock: function () { return _snsRank() >= 2; } },
  { id: "p_followers", ic: "🔥", name: "推し竜ガチ勢", handle: "@oshi_dragon", base: 207,
    text: function () { return `フォロワー${_snsFollowers().toLocaleString()}人突破！？ もう立派な“予想界の星”じゃん。最初から見てる俺、誇らしい。`; },
    unlock: function () { return _snsFollowers() >= 3000; } },
  { id: "p_scout", ic: "🐲", name: "竜舎だより", handle: "@ryusha_news", base: 144,
    text: "新しい竜が龍舎にやってきた！ ミミのスカウト、目利きがすごいって評判だよ。", unlock: function () { return _snsFlag("dragonScoutUnlocked"); } },
  { id: "p_rich", ic: "💧", name: "ミズ", handle: "@mizu_market", base: 188,
    text: "総資産が、ずいぶん厚くなったわね。…お金は使い方で品が出る。あなたなら、わかるでしょ？", unlock: function () { return _snsMaxCoins() >= 1000000; } },
  { id: "p_veteran", ic: "🍶", name: "サケ・ウダダ", handle: "@sake_oyakata", base: 176,
    text: function () { return `${_snsRaces()}戦、よく走った。…的中も外しも、ぜんぶお前の血肉だ。胸を張れ。`; },
    unlock: function () { return _snsRaces() >= 30; } },
  { id: "p_makura_legend", ic: "🎤", name: "実況マクラ", handle: "@makura_live", base: 402,
    text: "もはやミミの予想は“当てもの”じゃない。物語だ。この島の誰もが、次の一戦を待っている。", unlock: function () { return _snsRank() >= 5; } },
  // ★BUGFIX（正体バレ）：伏線段階（celestiaStrangerSeen＝破産で見た“知らないお姉さん”）では出さない。
  //   本名・@celestia_sky・立ち絵は第5話（advisorMet("celestia")）まで封印＝SNS_POST_GATE が唯一の門番。
  { id: "p_celestia", ic: "🌌", name: "セレスティア", handle: "@celestia_sky", base: 666,
    text: "……面白い灯りだね。消えそうで、消えない。あなたの“視る目”、わたしがちゃんと見ててあげる。",
    // ★D15: 第5話VN→(+1走)手紙→(+3走)この投稿、の時差解禁。門番SNS_POST_GATEは従来どおり併用。
    unlock: function () { var c = (typeof advisorMet === "function") && advisorMet("celestia"); return (typeof unlockDelayRace === "function") ? unlockDelayRace("p_celestia", c, 3) : c; } },
  // ── 暮らし還流（docs/KURASHI_STORY_WEAVE.md B）──
  { id: "p_walker", ic: "📷", name: "聖龍日報・文化面", handle: "@seiryu_bunka", base: 121,
    text: "本日の「島を歩く人」——予想家ミミ。レースのない日、彼女は島のどこかを歩いている。市場の湯気の中に、崖の風の中に。",
    unlock: function () { var c = Object.keys((((typeof state !== "undefined" && state.player) || {}).kurashi || {}).spotsSeen || {}).length >= 8; return (typeof unlockDelayDay === "function") ? unlockDelayDay("p_walker", c) : c; } },   // ★D9-11: 號外(+1レース)とさらに時差
  { id: "p_gourmet", ic: "🍜", name: "屋台のおやじ", handle: "@yatai_oyaji", base: 96,
    text: "また来たよ、あの子。うちの新作、いちばんうまそうに食うんだ。……悪い気はしねえ。（グルメ面『みみしんぼ』連載中）",
    unlock: function () { var c = typeof mealEatenCount === "function" && mealEatenCount(_snsP()) >= 10; return (typeof unlockDelayDay === "function") ? unlockDelayDay("p_gourmet", c) : c; } },   // ★D9-11: toast即時→號外+1レース→投稿+1日

  // ── R4：島でやったことを、SNSが**実名で**拾う（docs/REWARD_LOOP_DESIGN.md）──
  // ★既存の p_walker / p_gourmet は「島を歩く人」「よく食う子」と**匿名の一般論**だった。
  //   ここで足すのは**行った場所・食べた品の固有名**を出す投稿＝「見られている」実感の核。
  // ★unlock() で名前が引けることまで確かめる＝穴あき投稿（「、うまそうに食う」）を出さない。
  // ★_r4* は event_registry.js 定義（呼び出し時解決なので読み込み順に依存しない）。
  // ★文面は「最近／このごろ」＝現在進行の観測にする。text は毎回評価されるので、
  //   「〜に行った」と過去形で固定名を書くと、次の外出で**過去の投稿が書き換わって**見える。
  // ★表示専用＝着順・オッズ・配当には触れない。
  { id: "p_x_spot", ic: "🏝", name: "島の掲示板", handle: "@konron_bbs", base: 88,
    text: function () { return `最近、${_r4LastSpotName()}のあたりでうさ耳の子を見かけるって話。……あの予想家、ほんとに島を歩いてるんだな。`; },
    unlock: function () {
      var c = typeof _r4LastSpotName === "function" && !!_r4LastSpotName() && _r4SpotCount() >= 3;
      return (typeof unlockDelayDay === "function") ? unlockDelayDay("p_x_spot", c) : c;
    } },
  { id: "p_x_meal", ic: "🍚", name: "崑崙たべあるき", handle: "@konron_tabe", base: 134,
    text: function () { return `${_r4LastMealName()}、あの子が食ってるの見て並んだ人が今日も居た。……予想より先に、飯を当てられてる。`; },
    unlock: function () {
      var c = typeof _r4LastMealName === "function" && !!_r4LastMealName() && _r4MealCount() >= 3;
      return (typeof unlockDelayDay === "function") ? unlockDelayDay("p_x_meal", c) : c;
    } },
  { id: "p_x_photo", ic: "📸", name: "崑崙フォト部", handle: "@konron_photo", base: 152,
    text: function () { return `今月の★3、${_r4Masterpieces()}枚。竜を「速い生き物」じゃなく「きれいな生き物」として撮る人、ほんとに少ないんですよ。`; },
    unlock: function () {
      var c = typeof _r4Masterpieces === "function" && _r4Masterpieces() >= 1;
      return (typeof unlockDelayDay === "function") ? unlockDelayDay("p_x_photo", c) : c;
    } },
  { id: "p_x_stable", ic: "🐲", name: "竜舎だより", handle: "@ryusha_news", base: 163,
    text: function () { return `ミミの龍舎、${_r4Scouted()}頭になりました。どの子も、名前で呼ばれると耳を動かします。……見てもらえてる竜の顔だ。`; },
    unlock: function () { return typeof _r4Scouted === "function" && _r4Scouted() >= 2; } },
  { id: "p_x_walker20", ic: "🗺", name: "崑崙観光協会", handle: "@konron_kanko", base: 118,
    text: function () { return `島${_r4SpotCount()}か所踏破。……あの、もう観光ガイド書いてもらえませんか。真面目に。`; },
    unlock: function () { return typeof _r4SpotCount === "function" && _r4SpotCount() >= 20; } }
];
// ★BUGFIX（マイルストーンだけ素通し）：日替わり(SNS_DAILY_GATE)は守れていたのに、rank/コインだけで解放される
//   マイルストーン投稿は顧問の登場判定を通っておらず、「日替わりのマクラは出ないのに投稿はする」矛盾が起きていた。
//   顧問に紐づく投稿はここに登録し、unlock と AND で判定する（ミミ/島民/モブ/新聞/屋台/竜舎は対象外＝常時OK）。
var SNS_POST_GATE = {
  p_rank2: "makura", p_makura_legend: "makura",   // 実況マクラ＝第4話
  p_rich: "mizu",                                 // ミズ＝第2話
  p_veteran: "sake",                              // サケ＝第1話（最初から会っている）
  p_celestia: "celestia"                          // セレスティア＝第5話（伏線段階では本名も立ち絵も出さない）
};

// =========================================================================
// デイリーお題（投票・その日のものを1つ／options.share=反応の基準%＝コスメ）。
// =========================================================================
var SNS_POLLS = [
  { id: "poll_kyaku", q: "今日、ご縁がありそうな脚質は？", options: [{ t: "逃げ", share: 30 }, { t: "差し", share: 34 }, { t: "追込", share: 22 }, { t: "自在", share: 14 }] },
  { id: "poll_kibun", q: "きょうの賭けの気分は？", options: [{ t: "本命でかたく", share: 41 }, { t: "穴をねらう", share: 33 }, { t: "ワイドで安全に", share: 18 }, { t: "今日は見るだけ", share: 8 }] },
  { id: "poll_oshi", q: "推し竜のタイプといえば？", options: [{ t: "炎の暴れん坊", share: 28 }, { t: "風の優等生", share: 26 }, { t: "霧の職人", share: 19 }, { t: "岩の重戦車", share: 27 }] },
  { id: "poll_oua", q: "レース観戦のお供は？", options: [{ t: "焼き鳥", share: 35 }, { t: "ラーメン", share: 24 }, { t: "かき氷", share: 16 }, { t: "甘酒", share: 25 }] },
  { id: "poll_mimi", q: "ミミの“ぱほぱほ”、好きな瞬間は？", options: [{ t: "的中したとき", share: 44 }, { t: "外して照れるとき", share: 31 }, { t: "耳ぴょこ", share: 25 }] },
  { id: "poll_time", q: "レースを観るなら何曜が好き？", options: [{ t: "週末の昼", share: 38 }, { t: "夜のナイター", share: 36 }, { t: "平日のすきま", share: 26 }] },
  { id: "poll_lucky", q: "あなたのゲン担ぎは？", options: [{ t: "同じ席で観る", share: 22 }, { t: "推しの色を着る", share: 29 }, { t: "団子を食べる", share: 27 }, { t: "特になし", share: 22 }] },
  { id: "poll_dream", q: "もし1日だけ竜になれたら？", options: [{ t: "空をかけたい", share: 46 }, { t: "レースで勝ちたい", share: 33 }, { t: "ひなたで寝たい", share: 21 }] }
];

// =========================================================================
// 自分で投稿するテンプレ（バズる用・進行で内容が動く・選んで投稿）。
// =========================================================================
var POST_TEMPLATES = [
  { id: "t_today", text: "今日もレース、たのしむぞ〜！ みんなはどの子を応援する？" },
  { id: "t_win", text: function () { return `やった、${_snsWins()}勝目！ 当たると、しっぽが勝手にぴょんってなる🐰`; }, when: function () { return _snsWins() >= 1; } },
  { id: "t_rank", text: function () { return `ランク${_snsRank()}になりました！ ここまで来られたの、みんなのおかげだよ。`; }, when: function () { return _snsRank() >= 2; } },
  { id: "t_oshi", text: "推し竜、見つかった？ わたしは…今日もぜんぶ可愛くて選べないっ！" },
  { id: "t_gohan", text: "レース場で食べ歩き中。今日のお供、なに食べよっかな〜🍢" },
  { id: "t_paho", text: "ぱほぱほ〜♪ 今日も場をなごませていくよ！" },
  { id: "t_thanks", text: "いつも応援ありがとう！ コメント、ぜんぶ読んでるからね。" },
  { id: "t_night", text: "今日も一日おつかれさま。明日も、いっしょに当てようね。おやすみ🌙" },
  { id: "t_poro", text: "ポロといっしょに配信なう。この子ほんと泣き虫で、ほんと可愛い🐉", when: function () { return _snsFlag("poroFound"); } },
  { id: "t_dress", text: "新しい衣装、おろしてみた！ …どうかな、似合ってる？", when: function () { return (_snsP().outfitsBought || []).length >= 1; } }
];

// =========================================================================
// ファンレター（マイルストーンで届く手紙・開封で既読＝DM風）。
// =========================================================================
var FAN_LETTERS = [
  { id: "l_first", ic: "🌸", from: "はじめてのファンより", subject: "応援しています！",
    body: "ミミさんへ。\n島のレース場に来ると、応援旗にいろんな竜の名前があるでしょう。私も端っこの席で一本振っています。\nいつか気になる子がいたら、お名前を聞かせてください。\n\n——スタンドの端のファンより🐰",
    unlock: function () { return true; } },
  { id: "l_kid", ic: "🧒", from: "村の子どもより", subject: "ぼくもよそうかになりたい！",
    body: "ミミおねえちゃんへ。\nぼく、ミミおねえちゃんみたいに竜のことがわかるようになりたいです。\nきのう、はじめて『きはい』ってことばをおぼえました。竜のどこを見たら、ぼくにもわかるかな。\nいつかはいしんでも、おしえてください。",
    unlock: function () { return _snsRaces() >= 5; } },
  { id: "l_sake", ic: "🍶", from: "サケ・ウダダ", subject: "（不器用な殴り書き）",
    body: "ミミ。\nこういうのは柄じゃないが、一度だけ書く。\nお前、最初は右も左もわからん顔をしていた。今は、竜を見る目をしている。\n……誇りに思う。次の一戦も、気配を見ろ。それだけだ。",
    unlock: function () { return _snsWins() >= 3; } },
  // ★D8（NARRATIVE_DESIGN）：抽象語（灯り/総資産）の礼状→具体物（串の枚数）で語る別視点に改稿。
  { id: "l_rescued", ic: "🏘️", from: "串屋のおやじより", subject: "串、2枚に戻します",
    body: "ミミ様へ。\nむずかしいことはわかりません。ただ、うちの炭が、去年より早く減ります。\nレース帰りの客が増えたからです。あなたが勝った日も、負けた日も、みんな寄ってくれる。\n女房と話して、串を2枚に戻すことにしました。2枚です。1枚に減らした、あの冬からやっと。\nそれだけ、お伝えしたくて。",
    unlock: function () { return _snsMaxCoins() >= 100000; } },
  // poroAppraisalScript で実際に届いた紙の控え。既読の l_poro を保持する。
  { id: "l_poro", ic: "🐉", from: "鑑定所", subject: "仔竜の鑑定結果（控え）",
    body: "ミミ様\n先日お届けした鑑定結果の控えです。\n\n種族　ムラサキマルチビ竜\n成長段階　幼体\n希少指定　なし\n聖龍との血縁　なし\n特殊能力　なし\n備考　食べ過ぎ傾向あり\n\n鑑定所",
    unlock: function () { return (typeof unlockDelayDay === "function") ? unlockDelayDay("l_poro", _snsFlag("poroFound")) : _snsFlag("poroFound"); } },   // ★D9-11: 発見の翌日に届く
  { id: "l_rival", ic: "🐲", from: "かつての好敵手より", subject: "次は負けない",
    body: "ミミへ。\nお前の予想に、何度も悔しい思いをさせられた。\nだが、おかげで俺も腕を上げた。お前がいなけりゃ、ここまで来られなかった。\n……礼は言わん。次のレースで、ぜんぶ返す。覚悟しておけ。",
    unlock: function () { return _snsRank() >= 4; } },
  // ★D7：持ちネタ（市場は嘘をつく）の再演→「最初の伝票」という具体の思い出で語る私信に改稿。
  { id: "l_mizu", ic: "💧", from: "ミズ", subject: "帳簿の、いちばん下から",
    body: "ミミ。\n手紙なんて柄じゃないけど、帳簿を締めていたら、あなたの最初の伝票が出てきたの。\nたしか、300コインの複勝。窓口で、手が震えてたわね。\n今のあなたの張り方——金額は増えたのに、あの頃と同じ目をしてる。濁ってない。\nそれだけ。……なくさないでね、それ。",
    unlock: function () { return _snsMaxCoins() >= 5000000; } },
  // ── 暮らし還流（docs/KURASHI_STORY_WEAVE.md B）──
  // ★D12：免許皆伝の要約読み→誰も見ていない「雑巾がけ」の目撃談（同じ出来事の別視点）に改稿。
  { id: "l_shihan", ic: "🎫", from: "習い事の師範より", subject: "免許皆伝につき",
    body: "ミミ殿。\n免状は渡した。だからこれは師範としてではなく、ただの年寄りの手紙だ。\nあなたは稽古のあと、毎回、道場の雑巾がけをして帰っただろう。誰も見ていないつもりだったようだが。\n才ある者は何人も見てきた。雑巾がけを最後まで続けた者は、あなたで二人目だ。\n一人目は、わたしだ。……つまり、そういうことだ。\n基本に戻りなさい。竜を見て、飯を食い、よく眠ること。",
    unlock: function () { var c = false; try { var as = ((typeof state !== "undefined" && state.player) || {}).activeSkills || {}; c = typeof ACTIVE_SKILLS !== "undefined" && ACTIVE_SKILLS.some(function (s) { return (as[s.id] || 0) >= s.levels.length; }); } catch (e) { c = false; } return (typeof unlockDelayDay === "function") ? unlockDelayDay("l_shihan", c) : c; } },   // ★D9-11: 皆伝の翌日に届く（號外「師範の日」は+1レース）
  { id: "l_walker", ic: "📷", from: "写真館のばあばより", subject: "あんたの歩いた道",
    body: "ミミちゃんへ。\nうちの店の前を、あんたが何度も通るのを見てたよ。市場も、崖も、温泉も。\n島の人間でも、そんなに歩く子はいない。\nあんたが見てくれた景色はね、みんな、誰かのふるさとなんだ。\nありがとうね。今度、寄っていきな。いちばんいい笑顔を、一枚撮ってあげる。",
    unlock: function () { return Object.keys((((typeof state !== "undefined" && state.player) || {}).kurashi || {}).spotsSeen || {}).length >= 20; } },
  // ★BUGFIX（正体バレ）：伏線段階では届かない。第5話で出会ってから届く手紙にする（門番＝SNS_LETTER_GATE）。
  { id: "l_celestia", ic: "🌌", from: "セレスティア", subject: "天井の、その先へ",
    body: "小さな予想家さんへ。\nこの世界にはね、“天井”があるの。価値が届かないものは、淘汰されちゃう。\n——でも、あなたは。そのルールに、まっすぐ抗ってみせたよね。\n面白いなって思った。あなたの物語の結末、最後まで見届けさせてね。",
    // ★D15: 第5話VNの翌レース後に届く（門番SNS_LETTER_GATEは従来どおり併用）。
    unlock: function () { var c = (typeof advisorMet === "function") && advisorMet("celestia"); return (typeof unlockDelayRace === "function") ? unlockDelayRace("l_celestia", c, 1) : c; } }
];
// ★手紙の門番（投稿と同じ規約）。値が顧問キーなら差出人名も castNameSafe() で解決する（未登場なら？？？に倒れる）。
var SNS_LETTER_GATE = { l_sake: "sake", l_mizu: "mizu", l_celestia: "celestia", l_poro: "@poroFound" };

// =========================================================================
// 進捗ストア（表示専用メタ）。
// =========================================================================
function snsData() {
  var p = _snsP();
  if (!p.sns) p.sns = {};
  var s = p.sns;
  if (!s.reacts) s.reacts = {};        // {postId: reactKey}
  if (!s.liked) s.liked = {};          // 旧データ互換（❤️として扱う）
  if (!s.replies) s.replies = {};      // {postId: choiceIndex}
  if (!s.votes) s.votes = {};          // {pollKeyByDay: optionIndex}
  if (!s.myPosts) s.myPosts = [];      // [{id, text, day}]
  if (!s.checkin) s.checkin = { streak: 0, lastDay: null };
  if (!s.readLetters) s.readLetters = {};
  return s;
}
function _snsSave() { if (typeof saveGame === "function") saveGame(); }

// ── リアクション ──
function postReact(id) { var s = snsData(); return s.reacts[id] || (s.liked[id] ? "like" : null); }
function setReact(id, key) {
  var s = snsData();
  if (s.reacts[id] === key) { delete s.reacts[id]; } else { s.reacts[id] = key; }
  if (s.liked[id]) delete s.liked[id];   // 旧like→新reactへ吸収
  _snsSave(); return s.reacts[id] || null;
}
function postReactCount(po) { return (po.base || po.likes || 0) + (postReact(po.id) ? 1 : 0); }

// ── リプライ ──
function postReplied(id) { var s = snsData(); return (id in s.replies) ? s.replies[id] : null; }
function replyPost(id, choiceIdx) { var s = snsData(); s.replies[id] = choiceIdx; _snsSave(); }

// ── 日替わり生フィード（今日の巡回＋永続マイルストーンを新しい順で） ──
var _SNS_AGO = ["たった今", "1分前", "5分前", "12分前", "26分前", "40分前", "1時間前", "2時間前", "3時間前"];
function timelinePosts() {
  // 今日の日替わり：6件を決定的に選ぶ＋擬似的な「◯前」を付与。
  var daily = _snsDailyPick(SNS_DAILY.filter(_snsDailyOk), 6, 1).map(function (po, i) {   // ★BUGFIX：出会った相手だけ
    return { id: po.id, ic: po.ic, name: po.name, handle: po.handle, base: po.base, text: po.text, replies: po.replies, ago: _SNS_AGO[i] || "今日", _daily: true };
  });
  // 永続マイルストーン（解放済み＋★出会った相手だけ）。unlock が投げたら出さない側に倒す（fail-closed）。
  var mile = [];
  for (var i = SNS_POSTS.length - 1; i >= 0; i--) {
    var p = SNS_POSTS[i]; var ok = false; try { ok = p.unlock ? !!p.unlock() : true; } catch (e) { ok = false; }
    if (ok && !_snsCastOk(SNS_POST_GATE[p.id])) ok = false;   // ★BUGFIX：未登場の顧問はマイルストーンでも投稿しない
    if (ok) mile.push({ id: p.id, ic: p.ic, name: p.name, handle: p.handle, base: p.base, text: p.text, replies: p.replies, ago: "" });
  }
  // 日替わりを上、マイルストーンを下（最近の祝福は適度に混ぜる：先頭2件はミドルへ）。
  return daily.concat(mile);
}

// ── デイリーお題（その日の1問） ──
function todayPoll() {
  var po = _snsDailyPick(SNS_POLLS, 1, 7)[0] || SNS_POLLS[0];
  return po ? { id: po.id, dayKey: po.id + "@" + _snsDay(), q: po.q, options: po.options } : null;
}
function pollVoted(poll) { if (!poll) return null; var s = snsData(); return (poll.dayKey in s.votes) ? s.votes[poll.dayKey] : null; }
function votePoll(poll, optIdx) { if (!poll) return; var s = snsData(); s.votes[poll.dayKey] = optIdx; _snsSave(); }
// 投票後の表示用%（基準share＋自分の票を少し上乗せして正規化）。
function pollResults(poll) {
  if (!poll) return [];
  var mine = pollVoted(poll);
  var raw = poll.options.map(function (o, i) { return (o.share || 10) + (i === mine ? 6 : 0); });
  var sum = raw.reduce(function (a, b) { return a + b; }, 0) || 1;
  return raw.map(function (v) { return Math.round(v / sum * 100); });
}

// ── 自分で投稿してバズる ──
function _snsNextPostId(s, day) {
  if (!Number.isSafeInteger(s.myPostSerial) || s.myPostSerial < 0) {
    // Old saves have no counter. Reactions can outlive the forty visible posts.
    s.myPostSerial = 0;
    const ids = s.myPosts.map(p => p.id).concat(Object.keys(s.reacts), Object.keys(s.liked), Object.keys(s.replies));
    for (const id of ids) {
      const match = /^my_-?\d+_(\d+)$/.exec(id);
      if (match) s.myPostSerial = Math.max(s.myPostSerial, Number(match[1]));
    }
  }
  return "my_" + day + "_" + (++s.myPostSerial);
}
function _snsSeparateDuplicatePosts(s) {
  const seen = new Set(), duplicates = new Set();
  for (const p of s.myPosts) {
    if (seen.has(p.id)) duplicates.add(p.id);
    seen.add(p.id);
  }
  if (!duplicates.size) return false;
  // The shared old reaction cannot be attributed to either post. Keep that
  // key and its data intact, and give every member its own ID for future use.
  for (const p of s.myPosts) if (duplicates.has(p.id)) {
    p.legacyPostId = p.id;
    p.id = _snsNextPostId(s, p.day);
  }
  return true;
}
function myPosts() {
  const s = snsData();
  if (_snsSeparateDuplicatePosts(s)) _snsSave();
  return s.myPosts.slice().reverse();
}
// Capture provenance when the player posts from a real map viewer. Reading an
// old post never re-evaluates today's meal album or invents a past visit.
function snsPlacePostSource(ref, img) {
  if (!ref || !/^[a-z][a-z0-9_]{0,60}$/.test(ref.spotId || "") || !["photo", "gourmet"].includes(ref.kind)) return null;
  if (typeof KONRON_SPOTS === "undefined" || !Object.prototype.hasOwnProperty.call(KONRON_SPOTS, ref.spotId)) return null;
  var spot = KONRON_SPOTS[ref.spotId];
  if (!spot[ref.kind] || spot[ref.kind] !== img) return null;
  try {
    if (typeof konronMapUnlocked !== "function" || !konronMapUnlocked() || typeof _kmSpotOpen !== "function" || !_kmSpotOpen(spot)) return null;
    if (typeof _kmHiddenQuiet === "function" && !_kmHiddenQuiet(ref.spotId)) return null;
  } catch (e) { return null; }
  var p = _snsP(), kz = p.kurashi || {};
  var meal = ref.kind === "gourmet" && typeof MEALS !== "undefined" ? MEALS.find(function (m) { return m.spot === ref.spotId; }) : null;
  var tasted = meal && ((p.meals || {}).eaten || {})[meal.id] === true;
  var stars = Number((kz.photoStars || {})[ref.spotId]);
  return { version: 1, spotId: ref.spotId, kind: ref.kind, spotName: spot.name,
    visited: !!(kz.spotsSeen || {})[ref.spotId], photoStars: ref.kind === "photo" && Number.isInteger(stars) && stars >= 1 && stars <= 3 ? stars : 0,
    mealId: tasted ? meal.id : null, mealName: tasted ? meal.name : null };
}
function snsPlacePostCaption(ref, img) {
  var source = snsPlacePostSource(ref, img);
  if (!source) return null;
  if (source.kind === "gourmet") return source.mealId ? "前に味わった「" + source.mealName + "」のお店📸" : source.spotName + "の、気になる一皿📸";
  return source.spotName + (source.photoStars ? "で撮影した一枚📸" : source.visited ? "に寄った記念📸" : "、気になる景色📸");
}
function _snsPlaceReply(source) {
  if (!source) return null;
  var spot = KONRON_SPOTS[source.spotId];
  var tips = {
    market: "市場の湯気は、屋台ごとに匂いが違うんだ。気になったところで足を止めてみて。",
    makemeshi: "負け飯屋台の一杯は、勝負の話をしなくても落ち着くよ。黙って座る日があってもいい。",
    backbistro: "あの無銘の扉、見つけるとうれしいよね。塩パスタが好みだったか、飾らない感想を聞いてみたい。",
    kachimeshi: "横丁の串は、派手なお祝いじゃなくても似合うよ。自分の小さな祝いごとで寄るのも好き。",
    mall: "モールの大屋根は、買い物をしない日の待ち合わせにも使ってる。吹き抜けを眺めているだけでも、ひと休みになるよ。",
    sena: "白砂とラグーン、近くで見ると青の色が違うんだ。浜では急がず眺めてみて。",
    kirimina: "霧港の提灯は、船が動くたび水面でほどけるんだ。港を歩くときは、足元の水も見てみて。",
    furununo: "夜市の古布は、一枚ずつ色の褪せ方が違う。買う物を決めずに眺める時間も好きだよ。",
    ryoshimeshi: "まかない食堂の大鍋を囲む席が好き。漁から帰った人たちの声まで、ごちそうみたいなんだ。",
    kissaten: "みすとの窓辺では、プリンを急いで食べなくていい。海を見ながらスプーンを休める時間も好き。",
    lavasteak: "竜窯の溶岩石グリルは、焼き上がりを待つ間まで熱気が伝わる。あの店らしい景色だよ。",
    quaybar: "船着き場の樽テーブルは、夕陽を見るにはいい場所。鍋を囲まなくても、漁船の帰りを眺めたくなるね。"
  };
  var detail = tips[source.spotId];
  if (!detail) {
    var feature = String(spot.shoot || "").split("・")[0];
    detail = feature && feature !== "—" ? "「" + feature + "」に目が留まったら、急がず眺めてみて。ここらしさが出るところだよ。" : "この景色が気になったんだね。自分のペースで眺めていって。";
  }
  var lead = source.mealId ? "「" + source.mealName + "」を味わったことがあるんだね。" : source.photoStars ? "☆" + source.photoStars + "の一枚、見せてくれてありがとう。" : source.visited ? source.spotName + "に足を運んでくれたんだね。" : source.spotName + "が気になった？　";
  return { by: source.spotName + "の近所の人", ic: "💬", back: lead + detail };
}
// A reply refers to the subject selected at publication. Captions are the
// player's own words and never certify a meal, a visit, or a friendship.
function snsPersonalPostSubject(ref, img, publishing) {
  if (!ref || typeof ref.id !== 'string') return null;
  if (ref.kind === 'outfit' && typeof OUTFITS !== 'undefined') {
    const outfit = OUTFITS.find(o => o.id === ref.id);
    if (outfit && outfitImg(outfit.id) === img && (!publishing || (currentOutfitId() === outfit.id && outfitOwned(outfit))))
      return {kind:'outfit', id:outfit.id, name:outfit.name};
  }
  if (ref.kind === 'dragon' && typeof DRAGONS !== 'undefined') {
    const dragon = DRAGONS.find(d => d.id === ref.id);
    if (dragon && img === 'images/dragons/' + dragon.id + '.png' && (!publishing || _snsP().collection?.[dragon.id]?.scouted === true))
      return {kind:'dragon', id:dragon.id, name:dragon.name};
  }
  if (ref.kind === 'meal' && typeof MEALS !== 'undefined') {
    const meal = MEALS.find(m => m.id === ref.id);
    if (meal?.photo && meal.photo === img && (!publishing || _snsP().meals?.eaten?.[meal.id] === true))
      return {kind:'meal',id:meal.id,name:meal.name};
  }
  return null;
}
const SNS_FIELD_ROUTES = {
  cloth: [
    ['furununo','cloth_marks','古布屋には、わざわざ繕い残した短い線があるの。刺繍にするには間隔が妙でしょう？'],
    ['shiranami','gate_seaward','浜の鳥居の下にも高さ違いの線があるよ。布の線とどう重なるか、私も知りたい。']
  ],
  dragon: [
    ['ryusha','dragon_carry','竜舎で魚を受け取る小さな翼竜がいるよ。食べるのか、どこかへ運ぶのか、口元を見てみて。'],
    ['ryu_mizunomi','trace_toes','水のみ場では、水際より手前で足が止まった跡も探せる。爪先はどちら向きかな。'],
    ['kazami_yagura','trace_quill','櫓なら吹き流しと岩棚が一緒に見える。竜が動く前、布と首のどちらが先に動くかな。']
  ],
  water: [
    ['market','water_jars','屋台の水甕、違う店でも同じ札が下がってる。裏に何が書いてあるか、店先で見ていって。'],
    ['tanada','water_fork','棚田の手前で水が二手に分かれるんだ。ふたのある方は、田んぼには入らないよ。']
  ],
  harbor: [
    ['kirimina','return_cargo','港で「空なのに降ろす箱」を探してみて。荷がどちら向きに旅をするのか、見方が変わるよ。'],
    ['tsubo_roji','vinegar_crates','壺の路地に、注文の札はあるのに詰められない酢があるよ。棚に何が足りないかな。']
  ]
};
function snsRouteOpen(id) {
  if (typeof KONRON_SPOTS === 'undefined' || !Object.hasOwn(KONRON_SPOTS,id)) return false;
  return typeof konronMapUnlocked === 'function' && konronMapUnlocked() && _kmSpotOpen(KONRON_SPOTS[id]) && _kmHiddenQuiet(id);
}
function snsFieldReply(subject, place) {
  let reply, route;
  if (subject?.kind === 'outfit') {
    route = 'cloth'; reply = {by:'夜市の繕い屋',ic:'🧵',back:'「' + subject.name + '」を載せたんだね。私は布を見ると、誰がどこを直して長く着たかが気になるの。'};
  } else if (subject?.kind === 'dragon') {
    route = 'dragon'; reply = {by:'竜舎の餌番',ic:'🐟',back:'「' + subject.name + '」って、名前で紹介してくれたのがうれしいな。うちでも一頭ずつ、餌を受け取ったあとの様子が違うよ。'};
  } else if (subject?.kind === 'meal') {
    route = 'water'; reply = {by:'市場の水汲み当番',ic:'🏺',back:'「' + subject.name + '」の一枚、ありがとう。料理の写真を見ると、店へ最初の水を届ける朝を思い出すよ。'};
  } else if (place) {
    reply = _snsPlaceReply(place);
    if (place.kind === 'gourmet' || ['market','tanada'].includes(place.spotId)) {
      route = 'water';
      if (place.mealId) reply = {by:'市場の水汲み当番',ic:'🏺',back:'「' + place.mealName + '」を味わったことがあるんだね。うちは料理の前に、甕の札を確かめるところから朝が始まるよ。'};
    } else if (['furununo','shiranami','mall'].includes(place.spotId)) route = 'cloth';
    else if (['ryusha','ryu_mizunomi','kazami_yagura','tsubasa_dana'].includes(place.spotId)) route = 'dragon';
    else route = 'harbor';
  }
  if (!reply) return null;
  if (typeof chapterRead !== 'function' || !chapterRead('3')) return reply;
  const records = typeof IslandDiscovery !== 'undefined' ? IslandDiscovery.normalize(_snsP().islandDiscovery) : null;
  const reachable = SNS_FIELD_ROUTES[route].filter(([id]) => snsRouteOpen(id));
  const next = reachable.find(([,clue]) => !records?.evidence.includes(clue));
  if (next) return {...reply, back:reply.back + ' ' + next[2], spotId:next[0]};
  if (reachable.length) {
    const spotId = reachable[0][0];
    const revisits = {
      furununo:'写しといまの布、線が同じ所で途切れるか、見比べられるよ。', shiranami:'手帖の横線を、浜の護岸の高さに重ねてみてね。',
      ryusha:'魚を運ぶ子とその場で食べる子、今度は口元を見分けられるね。', ryu_mizunomi:'手帖の控えと、水際に残る爪の向きを見比べてみて。', kazami_yagura:'今日の風向きと手帖の見取り図、櫓で見比べられるよ。',
      market:'今度は、手帖の控えと甕の札を並べて見られるね。', tanada:'覆いのある方の水路を、手帖の控えでもう一度たどれるよ。',
      kirimina:'もう一度歩くなら、箱の行き先を示す札にも目を向けてみて。', tsubo_roji:'もう一度壺の棚を見たら、実が来る方と瓶を送る方を見比べてみて。'
    };
    return {...reply, back:reply.back + ' ' + revisits[spotId], spotId};
  }
  return reply;
}
function myPostReplies(post) {
  if (!post || !Array.isArray(post.replies)) return [];
  if (!(post.source?.version === 1 && ["photo", "gourmet"].includes(post.source.kind)) && !snsPersonalPostSubject(post.subject,post.img,false)) return [];
  return post.replies.filter(function (r) { return r && typeof r.by === "string" && typeof r.back === "string"; }).slice(0, 1).map(function (r) {
    return { by: r.by.slice(0, 100), ic: typeof r.ic === "string" ? r.ic.slice(0, 12) : "💬", back: r.back.slice(0, 500), ...(Object.values(SNS_FIELD_ROUTES).some(route => route.some(([id]) => id === r.spotId)) ? {spotId:r.spotId} : {}) };
  });
}
function addMyPost(text, img, ref) {
  var s = snsData();
  _snsSeparateDuplicatePosts(s);
  var day = _snsDay();
  var post = { id: _snsNextPostId(s, day), text: String(text || "").slice(0, 140), img: img || SNS_CAMERA[0].img, day: day };
  var source = snsPlacePostSource(ref, post.img);
  if (source) post.source = source;
  const subject = snsPersonalPostSubject(ref,post.img,true);
  if (subject) post.subject = subject;
  const reply = snsFieldReply(subject,source);
  if (reply) post.replies = [reply];
  s.myPosts.push(post);
  if (s.myPosts.length > 40) s.myPosts = s.myPosts.slice(-40);   // 上限
  _snsSave();
  return post;
}
// 投稿のリアクション数＝フォロワー連動＋経過日で“じわっと伸びる”（コスメ）。
function myPostReacts(post) {
  var age = Math.max(0, _snsDay() - (post.day || _snsDay()));
  var f = _snsFollowers();
  var grow = Math.min(1, 0.35 + age * 0.18);                 // 時間でじわ伸び（最大1）
  var seed = _snsRandFrom(((post.legacyPostId || post.id).length * 131 + (post.day || 0)) >>> 0);
  var n = Math.floor(f * (0.012 + seed * 0.05) * grow) + 3 + Math.floor(seed * 20);
  return n;
}
// 反応の多かった投稿を飾る表示だけの印。反応数・読者数・印税は増やさない。
// 旧条件 max(120, 読者×8%) は反応式の上限(読者×6.2%+22)を常に上回り、
// どの投稿も到達できなかった。既存の反応分布の中に届く基準を置く。
function myPostBuzzing(post) { return myPostReacts(post) >= Math.max(45, _snsFollowers() * 0.04); }
function postTemplates() { return POST_TEMPLATES.filter(function (t) { try { return t.when ? t.when() : true; } catch (e) { return true; } }); }

// ── 連続ログイン（SNSを開いた連続日数・コスメ専用＝コイン非干渉） ──
function snsCheckin() {
  snsSyncCamera();   // SNS画面を開くたびカメラロールの門番を再評価（発見前のポロを混ぜない・発見後は即出る）
  var s = snsData(); var today = _snsDay(); var info = { streak: s.checkin.streak || 0, isNew: false };
  if (s.checkin.lastDay !== today) {
    if (s.checkin.lastDay != null && today === s.checkin.lastDay + 1) s.checkin.streak = (s.checkin.streak || 0) + 1;
    else s.checkin.streak = 1;
    s.checkin.lastDay = today; info.streak = s.checkin.streak; info.isNew = true; _snsSave();
  }
  return info;
}
var SNS_STREAK_BADGES = [
  { d: 30, e: "👑", t: "ぬしレベルの常連" }, { d: 14, e: "💎", t: "二週間皆勤" },
  { d: 7, e: "🏆", t: "一週間皆勤" }, { d: 3, e: "🔥", t: "3日連続" }, { d: 1, e: "🌱", t: "はじめの一歩" }
];
function snsStreakBadge(streak) {
  for (var i = 0; i < SNS_STREAK_BADGES.length; i++) if ((streak || 0) >= SNS_STREAK_BADGES[i].d) return SNS_STREAK_BADGES[i];
  return SNS_STREAK_BADGES[SNS_STREAK_BADGES.length - 1];
}

// ── ファンレター ──
function fanLetters() {
  var out = [];
  for (var i = FAN_LETTERS.length - 1; i >= 0; i--) {
    var l = FAN_LETTERS[i];
    var g = SNS_LETTER_GATE[l.id];
    var ok = false; try { ok = l.unlock ? !!l.unlock() : true; } catch (e) { ok = false; }   // fail-closed
    if (ok && !_snsCastOk(g)) ok = false;   // ★BUGFIX：未登場の顧問からは手紙も届かない（DMは本名がそのまま出る）
    if (!ok) continue;
    // 差出人名は STORY_CAST を直読みせず castNameSafe() 経由（正本の門番ヘルパ）。原本は書き換えずコピーに載せる。
    if (g && g.charAt(0) !== "@" && typeof castNameSafe === "function") {
      var c = {}; for (var k in l) if (Object.prototype.hasOwnProperty.call(l, k)) c[k] = l[k];
      c.from = castNameSafe(g);
      out.push(c);
    } else out.push(l);
  }
  return out;
}
function letterRead(id) { return !!snsData().readLetters[id]; }
function readLetter(id) { var d = snsData(); if (!d.readLetters[id]) { d.readLetters[id] = true; _snsSave(); } }
function snsUnreadLetters() { var n = 0, ls = fanLetters(); for (var i = 0; i < ls.length; i++) if (!letterRead(ls[i].id)) n++; return n; }

// 旧API互換（他から呼ばれても落ちないよう温存）。
function postLiked(id) { return postReact(id) === "like"; }
function likePost(id) { setReact(id, "like"); return postLiked(id); }
function postLikeCount(po) { return postReactCount(po); }
function snsStats() { return { posts: timelinePosts().length, letters: fanLetters().length, unread: snsUnreadLetters() }; }

if (typeof window !== "undefined") { window.SNS_POSTS = SNS_POSTS; window.SNS_DAILY = SNS_DAILY; window.FAN_LETTERS = FAN_LETTERS; window.SNS_REACTS = SNS_REACTS; }
