// =========================================================================
// data_ending.js — エンディング演出＆スタッフロールの「中身（台本データ）」
// =========================================================================
// ★ここは“中身”だけ。演出ロジックは ending_engine.js（そちらは原則さわらない）。
//   後から差し替えたい文言・順番・背景・秒数は、ぜんぶこのファイルで完結する。
//
// 表示専用・コスメ／メタ進行。着順・オッズ・配当（race/odds/betting）には
// 一切干渉しない（CLAUDE.md 絶対ルール①を厳守）。
//
// ─ 差し替える場所 ───────────────────────────────────────────────
//   ENDING_CONFIG … 背景・スクロール秒数・送り出しVNのON/OFF・実在クレジット
//   ENDING_VN     … 顧問たちの「送り出し」セリフ（[話者, セリフ, 表情] のタプル）
//   STAFF_ROLL    … スタッフロールの中身（ブロックを上から順に並べるだけ）
//
// ─ STAFF_ROLL のブロック型（type）─────────────────────────────────
//   { type:"title",  text, sub }       … 大見出し（ロゴ的に大きく）
//   { type:"head",   text }            … セクション見出し（【CAST】等）
//   { type:"role",   role, name }      … 「役割 …… 名前」の1行（name省略可）
//   { type:"voice",  who, text }       … 担当キャラの一言（区切り演出・who=顧問ID）
//   { type:"cast",   from:"STORY_CAST" } … 顧問5人を自動展開（名前＋肩書）
//   { type:"cast",   from:"DRAGONS" }    … 登場竜を自動展開（名前＋脚質）
//   { type:"credits",from:"REAL" }       … ENDING_CONFIG.realCredits を展開
//   { type:"note",   text }            … 中央寄せの文章（謝辞など）
//   { type:"gap",    size:"sm|md|lg" } … 余白
//   { type:"fin",    text, sub }       … 最後のカード（大きく中央）
// =========================================================================

// 全体設定（背景・テンポ・送り出しVNの有無・実在クレジット）。
const ENDING_CONFIG = {
  bg: "images/home_vista_day.jpg",   // ロールの背景（発展した島の遠景。後で差し替え可）
  finBg: "images/story/ED.jpg",      // 最後のカードの背景（夜明けの桟橋）
  scrollSeconds: 48,                 // ロールが流れ切るまでの秒数（小さく＝速い）
  playVN: true,                      // true: 先に顧問たちの送り出しVNを流す
  bgm: null,                         // RACE_BGM_TRACKS のIDを入れると流用再生（null=無音）
  // 実在クレジット（{ type:"credits", from:"REAL" } で展開）。お好みで書き換え。
  realCredits: [
    { role: "企画・原案",                 name: "あいかわ" },
    { role: "脚本・実装・演出（ほか全般）", name: "Claude Code" },
    { role: "画像制作",                   name: "ChatGPT" },
    { role: "音楽",                       name: "Suno" }
  ]
};

// ───────────────────────────────────────────────────────────────
// 送り出しVN（在りし日の声で・各キャラ一言）。Dialogue 台本＝[話者ID, セリフ, 表情]。
// 表情を省くと自動推定。narrator はナレーション（立ち絵なし）。
// ───────────────────────────────────────────────────────────────
const ENDING_VN = [
  ["narrator",  "総資産、一兆。霧と火山の島は、灯りの消えない聖龍レースリゾートへ育った。"],
  ["sake",      "行くのか。……まず食え、は最後まで言わせろ。泣くな、勝つ竜はもう自分で選べるだろう。"],
  ["mimi",      "はいっ……サケさんに拾われた日のスープ、まだ覚えてます。", "smile"],
  ["mizu",      "あはん、餞別にひとつ。オッズは祈りじゃない――でも、あなたの旅は、たぶん祈っていいわ。"],
  ["mimi",      "ミズさんがそれ言うの、ずるいですっ！", "happy"],
  ["sumika",    "ミミ様。総資産は、整いました。次は“帰る場所”のほうを、どうかお忘れなく。"],
  ["makura",    "当てるだけなら予想、名前を覚えさせたら物語だぜ？ ミミちゃんはもう、物語のほうだ。"],
  ["celestia",  "この賭場、壊れなかったね。……次にあなたが落とす隕石、見に行こうかな。"],
  ["mimi",      "え、それ祝福ですか、請求書じゃなくて……っ！", "panic"],
  ["narrator",  "あの日、入口で拾われたバニーは、今度は自分で出口を選ぶ。"]
];

// ───────────────────────────────────────────────────────────────
// スタッフロール本体。上から順に流れる。並べ替え・追加・削除はここだけで完結。
// ───────────────────────────────────────────────────────────────
const STAFF_ROLL = [
  { type: "gap",   size: "lg" },
  { type: "title", text: "聖龍爆走録ミミ", sub: "― STAFF ROLL ―" },
  { type: "gap",   size: "lg" },

  { type: "head",  text: "CAST" },
  { type: "role",  role: "ミミ", name: "異世界からの来訪者" },
  { type: "cast",  from: "STORY_CAST" },
  { type: "gap",   size: "md" },

  { type: "head",  text: "八頭の聖龍" },
  { type: "cast",  from: "DRAGONS" },
  { type: "gap",   size: "md" },

  { type: "head",  text: "STORY" },
  { type: "voice", who: "sake", text: "息を見ろ。脚より先に、息で崩れる。" },
  { type: "role",  role: "全5話＋エンディング" },
  { type: "gap",   size: "sm" },

  { type: "head",  text: "RACE ENGINE" },
  { type: "role",  role: "FinalPower 7成分／スタミナシステム" },

  { type: "head",  text: "ODDS & MARKET" },
  { type: "voice", who: "mizu", text: "オッズは勝率じゃない。観客の願望が混ざった値であるわ、あはん。" },
  { type: "role",  role: "5000回 市場シミュレーション" },

  { type: "head",  text: "LIFE & ASSETS" },
  { type: "voice", who: "sumika", text: "住居・食事・名声まで含めた総資産が、再起の土台です。" },
  { type: "role",  role: "暮らしツリー／総資産メタ進行" },

  { type: "head",  text: "ART & LIVE2D" },
  { type: "role",  role: "ミミ立ち絵 全19衣装／自作Live2D風リグ" },

  { type: "head",  text: "SOUND" },
  { type: "role",  role: "合成SE／レースBGM" },

  { type: "gap",   size: "md" },
  { type: "head",  text: "SPECIAL THANKS" },
  { type: "note",  text: "この島に灯りを絶やさなかった、予想家のあなたへ。" },
  { type: "voice", who: "makura", text: "名前を覚えさせたら物語だぜ？……最高の物語だったぜ。" },

  { type: "gap",   size: "md" },
  { type: "head",  text: "CREDITS" },
  { type: "credits", from: "REAL" },

  { type: "gap",   size: "lg" },
  { type: "fin",   text: "次の物語へ", sub: "またね。― ミミ" },
  { type: "gap",   size: "lg" }
];
