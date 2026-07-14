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
  "@poro_naki":      ["images/cast/stand/poro.webp"],
  "@shima_weather":  ["images/home_vista_day.jpg", "images/homebg/beach_day.webp"],
  "@shima_gohan":    ["images/homebg/market_day.webp"],
  "@dragon_news":    ["images/10_stage_seiryu-street-night.png"],
  "@rival_yosou":    ["images/14_stage_seiryu-street-day_v1.png"],
  "@aya_no_hibi":    ["images/homebg/balcony_night.webp"],
  "@celestia_sky":   ["images/cast/stand/celestia.webp"],
  "@ryusha_news":    ["images/cast/stand/poro.webp", "images/home_vista_day.jpg"]
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
  { img: "images/39_char_mimi-keyvisual-racetrack.png", cap: "きょうのわたし📸 配信たのしかった！" },
  { img: "images/homebg/beach_day.webp", cap: "島のビーチでひとやすみ🏖️" },
  { img: "images/homebg/balcony_night.webp", cap: "夜のバルコニーから。いい風🌙" },
  { img: "images/racebg/fire.webp", cap: "今日のレース場、熱かった🔥" },
  { img: "images/home_vista_day.jpg", cap: "いい天気！ 竜たちもごきげん☀️" },
  { img: "images/12_stage_seiryu-street-sunset_v2.png", cap: "聖龍街の夕暮れ、すきだなぁ🌇" },
  // ★BUGFIX（出会う前のキャラが出る）：発見前のカメラロールに「ポロ」の名前も立ち絵も出さない。
  { img: "images/cast/stand/poro.webp", cap: "相棒のポロと📷 泣き虫だけど最高の子", gate: "@poroFound" },
  { img: "images/homebg/market_day.webp", cap: "食べ歩き中〜🍢 なに食べよ" }
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
  { id: "d_morning", ic: "🐰", name: "ミミ", handle: "@mimi_yosou", base: 420,
    text: "おはよ〜！ 今日もいっしょに竜たち応援しよ？ 耳ぴょこっとしながら待ってるね🐰",
    replies: [{ choice: "おはよう！", back: "えへへ、来てくれてうれしい！" }, { choice: "ねむい…", back: "わかる〜。甘いもの食べて、いこ？" }] },
  { id: "d_weather", ic: "🌤️", name: "島の天気よほう", handle: "@shima_weather", base: 88,
    text: "本日の島は晴れ、午後から風つよめ。翼の強い竜にはおいかぜ、かも？🍃" },
  { id: "d_oshi", ic: "🔥", name: "推し竜ガチ勢", handle: "@oshi_dragon", base: 156,
    text: "今日の本命、どの子にする？ 俺はもう決めてる。…まあ、当たるとは言ってない。",
    replies: [{ choice: "本命教えて！", back: "それは秘密。外したら笑われるからな…！" }, { choice: "穴党です", back: "わかってる人だ……！ 一緒に夢見よう。" }] },
  { id: "d_sake", ic: "🍶", name: "サケ・ウダダ", handle: "@sake_oyakata", base: 120,
    text: "脚質ってのはな、性格だ。逃げる奴、待つ奴、差す奴。竜にも生き方がある。…よく見てやれ。" },
  { id: "d_mizu", ic: "💧", name: "ミズ", handle: "@mizu_market", base: 134,
    text: "人気が集まる竜ほど、配当はしぼむ。…みんなが見てない“価値”は、いつも端っこに落ちてるわ。あはん。" },
  { id: "d_poro", ic: "🐉", name: "ポロ", handle: "@poro_naki", base: 240,
    text: "きょうもおねえちゃんのはいしん、みにきたよ。ぐすっ、たのしみ……！",
    replies: [{ choice: "ポロえらい！", back: "えへへ……っ、ぼく、がんばる！" }, { choice: "なでなで", back: "ふぁ……きもちいい。ありがと、おねえちゃん。" }] },
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
    text: "ミミの予想、今日もチェックしてる。…言っとくが、参考にしてるわけじゃない。たまたまだ。" },
  { id: "d_aya", ic: "💬", name: "常連のアヤ", handle: "@aya_no_hibi", base: 95,
    text: "ミミちゃんの「ぱほぱほ〜」聞くと、なんか今日もがんばれる気がするんだよね。ふしぎ。" },
  { id: "d_celes", ic: "🌌", name: "セレスティア", handle: "@celestia_sky", base: 333,
    text: "……今日も、ちっぽけな灯りがよく燃えている。さて、どこまで視えるかしらね。" }
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
var SNS_DAILY_GATE = { d_sake: "sake", d_mizu: "mizu", d_makura: "makura", d_sumika: "sumika", d_celes: "celestia", d_poro: "@poroFound" };
function _snsDailyOk(po) { return _snsCastOk(SNS_DAILY_GATE[po.id]); }

// =========================================================================
// マイルストーン投稿（進行で“永続解放”・節目の祝福）。日替わりとは別に上位に出る。
// =========================================================================
var SNS_POSTS = [
  { id: "p_firstwin", ic: "🌸", name: "うさ耳ファンクラブ", handle: "@usamimi_fc", base: 240,
    text: function () { return `🎉 ミミちゃん${_snsWins()}勝目おめでとう！ 予想が当たった瞬間のしっぽ、見た？ ぴょんって跳ねたよね！`; },
    unlock: function () { return _snsWins() >= 1; } },
  { id: "p_rank2", ic: "🎤", name: "実況マクラ", handle: "@makura_live", base: 158,
    text: function () { return `ミミ、ランク${_snsRank()}到達！ 新しい地域のレースにも挑めるぞ。視聴者みんなで応援だ！`; },
    unlock: function () { return _snsRank() >= 2; } },
  { id: "p_poro", ic: "🐉", name: "ポロ", handle: "@poro_naki", base: 311,
    text: "ぐすっ……ミミお姉ちゃんが、ぼくのこと見つけてくれた日のこと、まだ覚えてる。だいすき。", unlock: function () { return _snsFlag("poroFound"); } },
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
    text: "……面白い灯りね。消えそうで、消えない。あなたの“視る目”、わたしが見定めてあげる。", unlock: function () { return true; } },
  { id: "p_thanks", ic: "🐰", name: "ミミ", handle: "@mimi_yosou", base: 888,
    text: "いつも見てくれて、ほんとにありがとう。わたし、この世界に来てよかった。…これからも、いっしょに当てようね！", unlock: function () { return _snsRaces() >= 10; } },
  // ── 暮らし還流（docs/KURASHI_STORY_WEAVE.md B）──
  { id: "p_walker", ic: "📷", name: "聖龍日報・文化面", handle: "@seiryu_bunka", base: 121,
    text: "本日の「島を歩く人」——予想家ミミ。レースのない日、彼女は島のどこかを歩いている。市場の湯気の中に、崖の風の中に。",
    unlock: function () { return Object.keys((((typeof state !== "undefined" && state.player) || {}).kurashi || {}).spotsSeen || {}).length >= 8; } },
  { id: "p_gourmet", ic: "🍜", name: "屋台のおやじ", handle: "@yatai_oyaji", base: 96,
    text: "また来たよ、あの子。うちの新作、いちばんうまそうに食うんだ。……悪い気はしねえ。（グルメ面『みみしんぼ』連載中）",
    unlock: function () { return Object.keys(((typeof state !== "undefined" && state.player) || {}).meals || {}).length >= 10; } }
];
// ★BUGFIX（マイルストーンだけ素通し）：日替わり(SNS_DAILY_GATE)は守れていたのに、rank/コインだけで解放される
//   マイルストーン投稿は顧問の登場判定を通っておらず、「日替わりのマクラは出ないのに投稿はする」矛盾が起きていた。
//   顧問に紐づく投稿はここに登録し、unlock と AND で判定する（ミミ/島民/モブ/新聞/屋台/竜舎は対象外＝常時OK）。
var SNS_POST_GATE = {
  p_rank2: "makura", p_makura_legend: "makura",   // 実況マクラ＝第4話
  p_rich: "mizu",                                 // ミズ＝第2話
  p_veteran: "sake",                              // サケ＝第1話（最初から会っている）
  p_celestia: "celestia",                         // セレスティア＝第5話（伏線段階では本名も立ち絵も出さない）
  p_poro: "@poroFound"                            // ポロ＝単勝2勝目の発見後だけ
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
  // ── 暮らし還流（docs/KURASHI_STORY_WEAVE.md B）──
  { id: "l_shihan", ic: "🎫", from: "習い事の師範より", subject: "免許皆伝につき",
    body: "ミミ殿。\nよくぞ、ここまで続けられた。才ではない。あなたは、休まなかっただけだ。\nそれが才よりも尊いことを、わたしは長い師範生活で知っている。\nもう教えることはない。……いや、ひとつだけ。\n極めた者ほど、基本に戻りなさい。竜を見て、飯を食い、よく眠ること。\n免許皆伝、おめでとう。",
    unlock: function () { try { var as = ((typeof state !== "undefined" && state.player) || {}).activeSkills || {}; return typeof ACTIVE_SKILLS !== "undefined" && ACTIVE_SKILLS.some(function (s) { return (as[s.id] || 0) >= s.levels.length; }); } catch (e) { return false; } } },
  { id: "l_walker", ic: "📷", from: "写真館のばあばより", subject: "あんたの歩いた道",
    body: "ミミちゃんへ。\nうちの店の前を、あんたが何度も通るのを見てたよ。市場も、崖も、温泉も。\n島の人間でも、そんなに歩く子はいない。\nあんたが見てくれた景色はね、みんな、誰かのふるさとなんだ。\nありがとうね。今度、寄っていきな。いちばんいい笑顔を、一枚撮ってあげる。",
    unlock: function () { return Object.keys((((typeof state !== "undefined" && state.player) || {}).kurashi || {}).spotsSeen || {}).length >= 20; } },
  // ★BUGFIX（正体バレ）：伏線段階では届かない。第5話で出会ってから届く手紙にする（門番＝SNS_LETTER_GATE）。
  { id: "l_celestia", ic: "🌌", from: "セレスティア", subject: "天井の、その先へ",
    body: "ちっぽけな予想家へ。\nこの世界には“天井”がある。価値の届かぬものは、淘汰される。\n——だけど、あなたは。その理に、まっすぐ抗ってみせた。\n面白い。あなたの物語の結末、最後まで見届けてあげる。",
    unlock: function () { return true; } }
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
function myPosts() { return snsData().myPosts.slice().reverse(); }   // 新しい順
function addMyPost(text, img) {
  var s = snsData();
  s.myPosts.push({ id: "my_" + _snsDay() + "_" + (s.myPosts.length + 1), text: String(text || "").slice(0, 140), img: img || SNS_CAMERA[0].img, day: _snsDay() });
  if (s.myPosts.length > 40) s.myPosts = s.myPosts.slice(-40);   // 上限
  _snsSave();
}
// 投稿のリアクション数＝フォロワー連動＋経過日で“じわっと伸びる”（コスメ）。
function myPostReacts(post) {
  var age = Math.max(0, _snsDay() - (post.day || _snsDay()));
  var f = _snsFollowers();
  var grow = Math.min(1, 0.35 + age * 0.18);                 // 時間でじわ伸び（最大1）
  var seed = _snsRandFrom((post.id.length * 131 + (post.day || 0)) >>> 0);
  var n = Math.floor(f * (0.012 + seed * 0.05) * grow) + 3 + Math.floor(seed * 20);
  return n;
}
function myPostBuzzing(post) { return myPostReacts(post) >= Math.max(120, _snsFollowers() * 0.08); }
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
