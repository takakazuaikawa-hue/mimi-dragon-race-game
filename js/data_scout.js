// =========================================================================
// data_scout.js — 竜スカウト「発見＆交渉」ゲームの純データ（表示専用メタ）
// =========================================================================
// 設計：docs/SCOUT_NEGOTIATION_DESIGN.md
//   竜は人語を話さず「しぐさ＝心情(mood)」で気持ちを仕掛けてくる。プレイヤーは
//   しぐさを読み、数十通りの交渉術(approach)から最適を選んで心を開かせる。
// ★ここは純データ＋ラベルのみ。ロジック（割当/PRNG/判定）は scout_engine.js。
// ★レース計算には一切非干渉（着順/オッズ/配当は不変）。
// =========================================================================

// ── 1. ロケーション（場）：段階開放＋マスク ────────────────────────────
//   unlock は scout_engine.js の scoutLocationUnlocked(locId) が判定（章/総資産）。
//   ここには表示用の解放ラベルだけ持たせる。pool は arch/traits から決定的に割当。
const SCOUT_LOCATIONS = [
  { id: "grass",   name: "草むら",     ic: "🌾", tier: "序盤", mood: "やわらかな陽だまり。人なつこい竜が顔を出す。",
    unlockLabel: "スカウト解放で開放（2勝）",                  archs: ["allrounder", "turn_tech"] },
  { id: "jungle",  name: "密林",       ic: "🌳", tier: "序盤", mood: "湿った緑の奥。隠れたがりの竜の気配。",
    unlockLabel: "スカウト解放で開放（2勝）",                  archs: ["cloud_chaser", "fog_mystic"] },
  { id: "cliff",   name: "崖",         ic: "🪨", tier: "中盤", mood: "切り立った岩棚。頑固で誇り高い竜の住処。",
    unlockLabel: "総資産3万で開放（第3話・くらし）",            archs: ["stamina_tank"] },
  { id: "volcano", name: "火山地帯",   ic: "🌋", tier: "中盤", mood: "熱気と火の粉。気の立った竜が多い。難所。",
    unlockLabel: "総資産100万で開放（第4話）",                 archs: ["fire_bruiser", "speed_escape"] },
  { id: "sea",     name: "水中",       ic: "🌊", tier: "中盤", mood: "青い静寂。動きはゆるやか、しぐさは読みやすい。",
    unlockLabel: "総資産100万で開放（第4話）",                 archs: ["wing_closer"] },
  { id: "sky",     name: "空中",       ic: "☁️", tier: "終盤", mood: "雲の高み。高潔な竜が翼を休める。最難。",
    unlockLabel: "終章で開放（第5話・総資産1億）",              archs: ["speed_dragon", "_star"] }
];

// ── 2. 心情(mood)：竜のしぐさで表す10種 ───────────────────────────────
//   gestures＝竜が見せるしぐさ文（複数からPRNGで選ぶ）。reads＝〔観察〕で出るミミの読み。
const SCOUT_MOODS = {
  intim:  { name: "威嚇", ic: "😾", color: "#d4604a",
    gestures: ["ぐるるっ……と喉の奥で低く鳴り、牙をのぞかせた。", "ばさりと翼を広げ、自分を大きく見せてくる。", "首をもたげ、まっすぐにこちらを睨みつけた。"],
    reads: ["（怒ってる……？ ここは引いたほうがいいのかも）", "（大きく見せてくる。刺激しちゃだめだ）"] },
  guard:  { name: "警戒", ic: "🫥", color: "#c89a5a",
    gestures: ["横目でこちらを窺いながら、半歩あとずさった。", "身を低くして、いつでも逃げられる構えをとる。", "鼻先だけをこちらへ向け、じっと動かない。"],
    reads: ["（まだ、信じてくれてない……）", "（急に動いたら逃げちゃいそう）"] },
  anx:    { name: "不安", ic: "🥺", color: "#7aa0c8",
    gestures: ["尾を体に巻きつけ、くぅん……と心細げに鳴いた。", "おどおどと足踏みして、視線が定まらない。", "小さく身を縮め、ふるふると震えている。"],
    reads: ["（こわがってる。そばにいてあげなきゃ）", "（不安なんだ。大きな音は禁物）"] },
  curio:  { name: "好奇", ic: "👀", color: "#5ab0a0",
    gestures: ["こてん、と首をかしげ、鼻先をこちらへ伸ばしてくる。", "きょろきょろと辺りを見て、くんくん匂いを嗅いだ。", "ぱちりと目を見開いて、こちらの手元をのぞきこむ。"],
    reads: ["（興味ありそう……！ なにか見せてみる？）", "（こっちに気をひかれてる）"] },
  amae:   { name: "甘え", ic: "🥰", color: "#e08aa8",
    gestures: ["すり……と頭をこちらの手にこすりつけてきた。", "ごろんと寝転がって、やわらかいお腹を見せる。", "ぐるぐると喉を鳴らして、そっと寄り添ってきた。"],
    reads: ["（甘えてる……！ 受け止めてあげたい）", "（懐きはじめてる）"] },
  play:   { name: "遊び心", ic: "😆", color: "#6cc28a",
    gestures: ["ぴょこんと飛び跳ね、尾をぶんぶん振っている。", "誘うように後ろへ跳ね、こちらを振り返った。", "前足で地面をちょいちょい掻いて、そわそわしている。"],
    reads: ["（遊びたいんだ！ 乗ってあげようかな）", "（はしゃいでる。一緒に動こう）"] },
  proud:  { name: "誇示", ic: "😤", color: "#d0a24a",
    gestures: ["ぐっと胸を張り、翼を扇のように美しく広げた。", "高らかに咆哮し、自慢げに首を反らす。", "ゆっくり一周してみせ、鱗のきらめきを誇示する。"],
    reads: ["（自慢したいんだ。褒めてほしいのかも）", "（堂々としてる。称えてあげよう）"] },
  bored:  { name: "退屈", ic: "🥱", color: "#9a9488",
    gestures: ["ふぁ……と大きなあくびをして、そっぽを向いた。", "前足で地面をだらだらと掘りはじめる。", "興味なさげに、遠くをぼんやり眺めている。"],
    reads: ["（退屈してる……？ なにか惹きつけなきゃ）", "（飽きられてる。動きで気をひこう）"] },
  hungry: { name: "空腹", ic: "🤤", color: "#c0883a",
    gestures: ["ふんふんと鼻を鳴らし、匂いのもとを探している。", "物欲しげにこちらの手元を見つめ、よだれをこぼした。", "くぅ……とお腹を鳴らして、しょんぼり見上げてくる。"],
    reads: ["（おなかすいてる！ なにか食べ物……）", "（食い意地が出てる。餌で釣れそう）"] },
  sleepy: { name: "眠気", ic: "😴", color: "#8a86b0",
    gestures: ["とろん、と目を細め、こっくりこっくりしはじめた。", "その場にぺたりと伏せ、うとうとしている。", "大きなあくびのあと、まぶたが重そうに落ちてくる。"],
    reads: ["（眠そう……。穏やかにいこう）", "（うとうとしてる。静かにね）"] }
};
const SCOUT_MOOD_ORDER = ["intim", "guard", "anx", "curio", "amae", "play", "proud", "bored", "hungry", "sleepy"];

// ── 3. 交渉術(approach)：数十通り・7カテゴリ ──────────────────────────
//   helps/hurts＝その術が効く／逆効果になる心情。cat＝カテゴリ。fl＝ミミの所作。
//   special: "reveal"(観察) / "soothe"(ぱほぱほ・1回) / "interpret"(ポロ通訳) は常設。
const SCOUT_APPROACHES = [
  // 身（姿勢）
  { id: "crouch",   name: "しゃがむ",         ic: "🧎", cat: "身", helps: ["anx", "guard"],          hurts: ["proud"],               fl: "そっと身を低くして目線を合わせる" },
  { id: "submit",   name: "伏せて服従",       ic: "🙇", cat: "身", helps: ["intim", "guard"],        hurts: ["play", "proud"],       fl: "敵意がないと、伏せて示す" },
  { id: "turnback", name: "背を向けて待つ",   ic: "🔙", cat: "身", helps: ["guard", "intim"],        hurts: ["amae", "anx"],         fl: "あえて背を向け、警戒を解く" },
  { id: "blink",    name: "ゆっくり瞬き",     ic: "😌", cat: "身", helps: ["anx", "guard", "sleepy"], hurts: ["play"],                fl: "ゆっくりまばたきして安心を伝える" },
  { id: "offerhand",name: "手を差し出す",     ic: "🤲", cat: "身", helps: ["curio", "amae"],         hurts: ["intim", "guard"],      fl: "そっと手のひらを差し出す" },
  { id: "stroke",   name: "そっと撫でる",     ic: "✋", cat: "身", helps: ["amae", "sleepy"],        hurts: ["intim", "guard", "hungry"], fl: "やさしく首すじを撫でる" },
  { id: "embrace",  name: "抱きしめる",       ic: "🫂", cat: "身", helps: ["amae"],                  hurts: ["intim", "guard", "anx"], fl: "ぎゅっと抱きしめる" },
  { id: "liedown",  name: "一緒に寝そべる",   ic: "🛌", cat: "身", helps: ["amae", "sleepy"],        hurts: ["play", "hungry"],      fl: "となりにごろんと寝そべる" },
  { id: "standtall",name: "胸を張って堂々と", ic: "🧍", cat: "身", helps: ["proud"],                 hurts: ["anx", "guard"],        fl: "対等に、堂々と向き合う" },
  { id: "avert",    name: "視線をそらす",     ic: "🙈", cat: "身", helps: ["intim", "guard"],        hurts: ["curio", "proud"],      fl: "刺激しないよう目をそらす" },
  // 声
  { id: "softvoice",name: "やさしく声をかける", ic: "💬", cat: "声", helps: ["anx", "guard"],         hurts: ["proud"],               fl: "「だいじょうぶだよ」とささやく" },
  { id: "lullaby",  name: "子守唄を歌う",     ic: "🎵", cat: "声", helps: ["anx", "sleepy"],         hurts: ["play"],                fl: "ふるさとの子守唄を口ずさむ" },
  { id: "callname", name: "そっと名を呼ぶ",   ic: "🗣️", cat: "声", helps: ["curio", "amae"],         hurts: ["intim"],               fl: "やさしく呼びかける" },
  { id: "whistle",  name: "口笛を吹く",       ic: "😗", cat: "声", helps: ["curio", "play"],         hurts: ["intim", "sleepy"],     fl: "ぴゅう、と軽やかに口笛" },
  { id: "praise",   name: "褒めそやす",       ic: "👏", cat: "声", helps: ["proud"],                 hurts: ["guard", "hungry"],     fl: "「きれい……！」と褒めたたえる" },
  { id: "purr",     name: "喉を鳴らす真似",   ic: "😸", cat: "声", helps: ["amae", "guard"],         hurts: ["proud"],               fl: "ごろごろ、と喉を鳴らしてみせる" },
  { id: "silent",   name: "静かに沈黙する",   ic: "🤫", cat: "声", helps: ["guard", "sleepy"],       hurts: ["bored", "play"],       fl: "なにも言わず、静かに在る" },
  // 間（距離・待ち）
  { id: "stepin",   name: "そっと一歩近づく", ic: "👣", cat: "間", helps: ["curio", "amae"],         hurts: ["intim", "guard", "anx"], fl: "ゆっくり、一歩だけ近づく" },
  { id: "backaway", name: "距離を取る",       ic: "↩️", cat: "間", helps: ["intim", "guard"],        hurts: ["amae", "bored"],       fl: "そっと距離をあける" },
  { id: "freeze",   name: "動かず固まる",     ic: "🧊", cat: "間", helps: ["guard", "intim"],        hurts: ["bored", "play"],       fl: "石のように、じっと動かない" },
  { id: "wait",     name: "待つ・時間をあげる", ic: "⏳", cat: "間", helps: ["anx", "guard"],         hurts: ["bored", "hungry"],     fl: "焦らず、相手の時間を待つ" },
  // 贈（贈り物）
  { id: "fruit",    name: "果実を見せる",     ic: "🍎", cat: "贈", helps: ["hungry", "curio"],       hurts: ["proud"],               fl: "色づいた果実をそっと見せる" },
  { id: "placegift",name: "贈り物を置く",     ic: "🎁", cat: "贈", helps: ["hungry", "guard", "curio"], hurts: ["play"],             fl: "贈り物を置いて、半歩下がる" },
  { id: "shiny",    name: "光るものを見せる", ic: "💎", cat: "贈", helps: ["curio", "bored", "proud"], hurts: ["intim", "sleepy"],   fl: "きらめく石を陽にかざす" },
  { id: "sweets",   name: "菓子を差し出す",   ic: "🍬", cat: "贈", helps: ["hungry", "amae"],        hurts: ["intim"],               fl: "屋台の甘い菓子を差し出す" },
  { id: "water",    name: "水を分ける",       ic: "💧", cat: "贈", helps: ["hungry", "anx", "sleepy"], hurts: ["play"],              fl: "手のひらに水をすくって分ける" },
  // 真似
  { id: "mirror",   name: "しぐさを真似る",   ic: "🪞", cat: "真似", helps: ["curio", "play", "proud"], hurts: ["intim"],            fl: "相手のしぐさをそっくり真似る" },
  { id: "mimcry",   name: "鳴き声を真似る",   ic: "🔊", cat: "真似", helps: ["curio", "amae", "anx"],  hurts: ["intim", "bored"],     fl: "竜の鳴き声をまねて返す" },
  // 遊
  { id: "chase",    name: "追いかけっこ",     ic: "🏃", cat: "遊", helps: ["play", "curio"],         hurts: ["intim", "guard", "sleepy"], fl: "誘うように駆けてみせる" },
  { id: "throwstick",name: "棒きれを投げる",  ic: "🦴", cat: "遊", helps: ["play", "bored"],         hurts: ["intim", "anx"],        fl: "ぽーいと棒きれを投げる" },
  { id: "spin",     name: "くるりと回る",     ic: "🌀", cat: "遊", helps: ["play", "curio", "bored"], hurts: ["intim", "sleepy"],    fl: "くるりと回って気を引く" },
  { id: "mockrun",  name: "一緒に駆ける真似", ic: "💨", cat: "遊", helps: ["play", "proud"],         hurts: ["anx", "sleepy"],       fl: "並んで走るそぶりを見せる" },
  { id: "dance",    name: "楽しげに踊る",     ic: "💃", cat: "遊", helps: ["play", "proud", "bored"], hurts: ["guard", "anx"],       fl: "ステップを踏んで踊ってみせる" },
  { id: "gaze",     name: "じっと見つめる",   ic: "👁️", cat: "技", helps: ["proud", "curio"],        hurts: ["intim", "guard", "anx"], fl: "まっすぐ、瞳をのぞきこむ" },
  // 常設（手札に常に出る特殊）
  { id: "observe",  name: "観察する",         ic: "🔍", cat: "技", helps: [], hurts: [], special: "reveal",    fl: "しぐさをじっと観察する（次の心情がわかる）" },
  { id: "pahopaho", name: "ぱほぱほ",         ic: "✨", cat: "技", helps: [], hurts: [], special: "soothe",    fl: "ミミの汎用スキル。場をやわらげる（1回だけ）" },
  { id: "interpret",name: "ポロに通訳",       ic: "🥹", cat: "技", helps: [], hurts: [], special: "interpret", fl: "ポロに気持ちを通訳してもらう" }
];

// 反応文（判定結果＝great/good/neutral/bad）。Phase A は心情非依存の汎用。
const SCOUT_REACTIONS = {
  great:   ["ぱぁっと目を輝かせ、ぐいっと距離を詰めてきた！", "うれしそうに身をくねらせ、心をひらきはじめた！", "きゅるるっ！と甘えた声をあげ、すっかり気を許した。"],
  good:    ["ふっと、警戒がゆるんだ。", "ことり、と首をかしげ、こちらを受け入れた。", "そっと、緊張がほどけていく。"],
  neutral: ["きょとんと、反応はうすい。", "……とくに、変化はないみたい。", "ふぅん、と気のない様子だ。"],
  bad:     ["びくっと身を引き、警戒を強めた……！", "しゃあっ！と牙をむいた。怒らせてしまった……。", "ぷいっとそっぽを向かれてしまった。"],
  soothe:  ["ぽわ〜ん……ミミの気配に、竜の肩の力がふっと抜けた。", "ふしぎと、ささくれだった空気がやわらいでいく。"]
};

// カテゴリ→色（手札ボタンの色分け・表示用）
const SCOUT_CAT_COLOR = { "身": "#7aa0c8", "声": "#e08aa8", "間": "#9a9488", "贈": "#c0883a", "真似": "#5ab0a0", "遊": "#6cc28a", "技": "#d0a24a" };

function scoutMood(id) { return SCOUT_MOODS[id] || SCOUT_MOODS.guard; }
function scoutApproach(id) { return SCOUT_APPROACHES.find(a => a.id === id) || null; }
function scoutLocation(id) { return SCOUT_LOCATIONS.find(l => l.id === id) || null; }
