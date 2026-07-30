/**
 * data_ranks.js — race rank tables, economy multipliers, distance bands.
 *
 * EXTENSION POINT:
 *   - new rank: extend RANKS, RANK_UNLOCK, RESCUE_COINS, VILLAGE_MULT
 *   - new distance band: extend DISTANCE
 *   - new newspaper mark: extend NEWSPAPER_MARK_VALUE
 *   - new running style: extend STYLE_LABEL (and PACE_STYLE_MOD in race_engine.js)
 *
 * Spec refs: §04 §7/§9/§12/§16, §08 §5/§7/§13.
 */
const RANKS = {
  1: {
    label: "新人競竜杯",
    popularityWeights: { visible:0.35, recent:0.10, image:0.10, newspaper:0.10, form:0.20, course:0.10, fan:0.05 },
    hypeNoise: 3,
    capsWin: 15, capsPlace: 5, capsWide: 10,
    maxWager: 100
  },
  2: {
    label: "地方小杯",
    popularityWeights: { visible:0.33, recent:0.15, image:0.10, newspaper:0.12, form:0.15, course:0.10, fan:0.05 },
    hypeNoise: 4,
    capsWin: 30, capsPlace: 8, capsWide: 20,
    maxWager: 1000
  },
  3: {
    label: "地域杯",
    popularityWeights: { visible:0.30, recent:0.18, image:0.12, newspaper:0.15, form:0.12, course:0.08, fan:0.05 },
    hypeNoise: 5,
    capsWin: 50, capsPlace: 12, capsWide: 35,
    maxWager: 10000
  },
  4: {
    label: "大地域杯",
    popularityWeights: { visible:0.27, recent:0.20, image:0.15, newspaper:0.15, form:0.08, course:0.07, fan:0.08 },
    hypeNoise: 6,
    capsWin: 80, capsPlace: 20, capsWide: 60,
    maxWager: 1000000
  },
  5: {
    label: "竜王杯",
    popularityWeights: { visible:0.24, recent:0.22, image:0.18, newspaper:0.16, form:0.06, course:0.05, fan:0.09 },
    hypeNoise: 7,
    capsWin: 100, capsPlace: 30, capsWide: 100,
    maxWager: 100000000
  },
  6: {
    label: "祝祭級",
    popularityWeights: { visible:0.20, recent:0.25, image:0.20, newspaper:0.15, form:0.05, course:0.05, fan:0.10 },
    hypeNoise: 9,
    capsWin: 300, capsPlace: 80, capsWide: 300,
    maxWager: 1000000000000
  },
  7: {
    label: "神兎大レース",
    popularityWeights: { visible:0.18, recent:0.26, image:0.20, newspaper:0.16, form:0.04, course:0.04, fan:0.12 },
    hypeNoise: 12,
    capsWin: 999, capsPlace: 200, capsWide: 999,
    maxWager: 10000000000000000
  }
};

const PAYOUT_RATE = 0.85;
const FLOOR_WIN = 1.3;
const FLOOR_PLACE = 1.1;
const FLOOR_WIDE = 1.3;

const NEWSPAPER_MARK_VALUE = {
  "◎": 95, "○": 82, "▲": 70, "△": 58, "×": 45, "": 35
};

const DISTANCE = {
  // §14.1 §14.2: stamina pool bonus + cost multiplier. Per §14.1 "Alternative"
  // and §12.10 (Target Feel): bonuses widened so long/marathon races at high
  // rank don't collapse every dragon (Phase 9 testing showed 100% collapse).
  short:    { label: "短距離", bonus: -5, mult: 0.85 },
  mid:      { label: "中距離", bonus:  0, mult: 1.00 },
  long:     { label: "長距離", bonus: 25, mult: 1.20 },
  marathon: { label: "特長距離", bonus: 45, mult: 1.40 }
};

// statRank moved to utils.js (used by UI as well as data display).

const STYLE_LABEL = { escape:"逃げ", front:"先行", late:"差し", chase:"追込" };

// §08 §7 Village multipliers.
const VILLAGE_MULT = { 1:1.0, 2:1.5, 3:2.0, 4:3.0, 5:5.0, 6:8.0, 7:12.0, 8:20.0, 9:35.0, 10:50.0 };

// ★暮らしレベル（2026-07-31・ユーザー決裁）＝これまで「村Lv」と呼んでいたものの表の顔。
//   RPGなので「段位」ではなく「レベル」。★仕組み・数値・伸び方は一切変えていない。
//   同じ1〜10に称号を与えて、散らばっていた「村Lv」表記を暮らしレベルに一本化しただけ。
//   Lvが上がると：💛救済額（RESCUE_COINS）と 🎰賭金上限の倍率（VILLAGE_MULT）が伸びる。
//   ⚠️伸びるのは**的中したときだけ**（state.js gainVillageExp＝rank×15／しきい値=Lv×100）。
//     負けレースでは伸びない。ここは「負け続けで勝手に進む」を止めた設計なので変えないこと。
//   ★称号と一言は**くらしスキルツリーの実際の中身から**起こしている（想像で書かない）。
//     ツリーの帯は 資産0／1万／10万／100万／1億 で、それぞれ2Lvぶんを開く：
//       Lv1-2  資産0帯  🪱ミミズが食べ物に見える・🚰公園の水がごちそう・🕳️借金とともに夜が明ける
//       Lv3-4  1万帯    🥚卵をカップ麺に落とせる・🧊自分の冷蔵庫・♨️温泉旅行を即決できる
//       Lv5-6  10万帯   🛏️ちゃんとしたベッド・🧳家族を旅行に連れて行く・🐶ペットを迎える余裕
//       Lv7-8  100万帯  🍣回らない寿司・🏡庭付きの家・🛫プライベートジェットを試す
//       Lv9-10 1億帯    🏰丘の上に豪邸・🚀宇宙旅行を予約・🏝️列島を所有する
//     ＝「いまミミがどんな暮らしをしているか」が名前で分かり、次に何を目指すのかが見える。
const LIVING_RANKS = [
  //   ★称号は**あだ名**であって説明文ではない（ユーザー指摘）。基準＝「ドロミズすすりマン」
  //     「トンカツおじさん」の温度＝可笑しくて、少し大げさで、人の呼び名として口に出せること。
  //   ★語尾と形を全部変える。「◯◯な人／客／住人／者」で揃えると説明的で退屈になる。
  //     いまの形＝マン／貴族／主／かぶれ／貼り紙／おじさん／セリフ／もてあまし／短文／短文。
  //   ★称号は**いまの暮らし**を言う（過去形・出来事はNG）。旧「もやし卒業」は“Lv1を抜けた”という
  //     過去の話で、いまどう暮らしているかを言っていなかった。旧「フトン成金」は成金＝急に金持ち
  //     になった人で、床から布団に上がっただけの段と矛盾。旧「バカンス見習い」は見習い＝職業の弟子。
  //     旧「鍵束じゃらじゃら」は擬音だけで人が居らず、鍵束が管理人・用務員に読めた（全てやり直し）。
  { lv: 1,  title: "ドロミズすすりマン", note: "ミミズが食べ物に見える。公園の水がごちそう。ここから始まる。" },
  { lv: 2,  title: "おふとん貴族",       note: "床じゃなく布団で寝られる。電球を全部つけても怒られない。" },
  { lv: 3,  title: "冷蔵庫の主",         note: "自分の冷蔵庫とフライパン。卵をカップ麺に落とせる身分。" },
  { lv: 4,  title: "バカンスかぶれ",     note: "リゾートで数日。タクシーを“足”と呼びはじめた。" },
  { lv: 5,  title: "サラダはじめました", note: "もやし以外の野菜を買う。ちゃんとしたベッドで朝を迎える。" },
  // ★Lv6＝この梯子の「幸せの頂点」（ユーザー案）。上り切った先ではなく真ん中に置くのが肝で、
  //   Lv1「ドロミズすすりマン」と対になる笑いの称号でもある。上（豪邸・宇宙旅行）へ進んでも、
  //   一番幸せだったのはここかもしれない——という含みを残す。
  { lv: 6,  title: "トンカツおじさん",   note: "好きな時にトンカツを食べられる。家族を旅にも誘える。……島の人は言う。これが一番幸せだと。" },
  { lv: 7,  title: "大将、いつもの",     note: "回らない寿司で値段を見ない。行きつけのバーに名前がある。" },
  { lv: 8,  title: "別荘もてあまし",     note: "庭付きの家に、海の見える別荘。帰る場所が増えすぎた。" },
  { lv: 9,  title: "駅前に銅像",         note: "丘の上の豪邸。島のどこからでも、あの灯りが見える。" },
  { lv: 10, title: "宇宙、予約済み",     note: "列島を持ち、船を持ち、空の外まで席を取れる。それ以上は無い。" }
];
function livingRankOf(lv) {
  const n = Math.max(1, Math.min(lv || 1, LIVING_RANKS.length));
  return LIVING_RANKS[n - 1];
}
// ★暮らしレベルの上限＝くらしスキルツリーの解放ノード数（2026-07-31・ユーザー決裁）。
//   ねらい：的中だけを稼いでも、暮らしが伸びていなければレベルは上がらない。
//   式＝1 + floor(解放ノード数 / 20)（最大10）。★ツリーの実構造を精査して決めた：
//     ・全200ノード／前提の連鎖なし／資産帯(0,1万,10万,100万,1億)で開く平らな表
//     ・各帯までに取れる累計＝36/72/108/144/200 に対し、必要ノードは 20/60/100/140/180
//       ＝どの帯でもちょうど2レベルぶん開き、必ず余裕（最小4）が残る＝押し忘れで詰まない
//   ⚠️上限は「これ以上**上がらない**」だけ。すでに得たレベルは絶対に下げない
//     （下げると救済額と賭金上限が縮んで、途中から理不尽になる）。
//   ⚠️ツリーは第3話で開く。それ以前は縛らない（序盤のテンポを損なわないため）。
const LIVING_NODES_PER_LV = 20;
function livingLevelCap(st) {
  const s = st || state;
  try {
    // 第3話（ツリー解放）前は上限なし＝従来どおり的中だけで伸びる
    const treeOpen = (typeof getStoryFlag === "function") && getStoryFlag("_chapter_intro_3");
    if (!treeOpen) return LIVING_RANKS.length;
    const got = (typeof lifeTreeStats === "function") ? (lifeTreeStats().unlockedCount || 0) : 0;
    return Math.max(1, Math.min(LIVING_RANKS.length, 1 + Math.floor(got / LIVING_NODES_PER_LV)));
  } catch (e) { return LIVING_RANKS.length; }   // 判定できないときは縛らない（fail-open）
}
// 次のレベルまでの進み具合。★しきい値は state.js gainVillageExp と同じ式（Lv×100）から引く＝二重管理しない。
function livingRankProgress(st) {
  const s = st || state;
  const v = (s.player || {}).village || {};
  const lv = v.level || 1, exp = v.exp || 0;
  const need = lv * 100;
  const cap = livingLevelCap(s);
  const got = (typeof lifeTreeStats === "function") ? (lifeTreeStats().unlockedCount || 0) : 0;
  // ツリーが足りずに頭打ちか（＝expは満ちているのに上がれない、またはこれ以上上がれない）
  const blocked = lv >= cap && lv < LIVING_RANKS.length;
  const needNodes = blocked ? Math.max(0, lv * LIVING_NODES_PER_LV - got) : 0;   // 次のLvを開くのに要るノード数
  return { lv, exp, need, cap, blocked, nodes: got, needNodes,
           max: lv >= LIVING_RANKS.length,
           pct: Math.max(0, Math.min(100, Math.round(exp / need * 100))) };
}

// §08 §13 Rescue coins by village level.
// ★2026-07-30 上位を再スケール（旧 Lv8=1億/Lv9=10億/Lv10=100億）。頂が10億の世界では
//   「ゴールより救済が大きい」＝救済だけでEDに届く事故になるため。救済＝再挑戦の種銭の一部、が思想。
const RESCUE_COINS = { 1:300, 2:1000, 3:5000, 4:30000, 5:100000, 6:1000000, 7:10000000, 8:20000000, 9:30000000, 10:50000000 };

// §08 §11 ランク解放しきい値 ★2026-07-18 設計確定（docs/GAME_DESIGN_NUMBERS.md §9 が正本）。
// 3本レールのOR＝どれか1つ満たせば昇格。着順/オッズ/配当には一切非干渉（進行の門だけ）。
//   ①実力レール hitsAtLowerRank：現ランク帯のレースで的中（式別不問）。昇格の“主役”＝腕前の証明。
//   ②皆勤レール completedAtLowerRank：現ランク帯の完走数。①の約2.5倍に設定＝平均的な的中率(45%前後)なら
//     ①が先に発火し、不運な人だけを静かに救う保険（「負けても物語が戻らない」spec#30 の心臓を守る）。
//     旧値(3/3/5/5/7/7)は上位ほど実質唯一の近道になっており、昇格が消化試合化していたのを是正。
//   ③大勝レール coins：所持コイン。各値=「前ランクの上限賭金×オッズ10倍を1発」で届く=“次の時代の元手を
//     自力で作った”証明。旧値のまま変更なし（この対応関係が既にきれいなため）。
//     所持金なので散財すると遠のくが、それは「高い舞台には元手が要る」という賭博の道理として意図的に残す。
// 想定ペース（実測でなく設計目標）：平均的中で累計約165戦・全敗でも約187戦でR7。1戦約2分＝レースだけで6〜7時間、
// 島時間込みでメイン10〜15時間級。安全に複勝を刻む人は早く上がるが儲からず、勝負師は遅くとも富んで上がる＝両立。
// ★2026-07-30 ③大勝レールの上位を「頂＝10億」の世界へ圧縮（R6: 10億→1億／R7: 1兆→5億・ユーザー決裁）。
//   ①実力②皆勤レールは不変＝昇格ペース（実測125〜187戦でR7）は変わらない。③は資産形成の近道のまま、
//   終章の目標額（10億=神眼レース解放）の手前に納める。docs/ENDGAME_ECONOMY_REDESIGN.md 柱B。
const RANK_UNLOCK = {
  2: { coins: 2000,          hitsAtLowerRank: 2,  completedAtLowerRank: 5 },
  3: { coins: 10000,         hitsAtLowerRank: 4,  completedAtLowerRank: 10 },
  4: { coins: 100000,        hitsAtLowerRank: 7,  completedAtLowerRank: 17 },
  5: { coins: 10000000,      hitsAtLowerRank: 12, completedAtLowerRank: 30 },
  6: { coins: 100000000,     hitsAtLowerRank: 20, completedAtLowerRank: 50 },
  7: { coins: 500000000,     hitsAtLowerRank: 30, completedAtLowerRank: 75 }
};

// §08 §6 §20 Allowed maximum wager.
// §37 — early-stakes floor: the flat rank cap (e.g. 100 on a 1,000 bankroll)
// made the first races feel weightless. The player may now always wager up to
// 40% of their bankroll, but never more than 4× the race's rank cap — so rank
// still sets the ceiling at scale (high ranks are unchanged) and the floor only
// lifts the early game. This does not touch odds, finish order, or payout math.
function getAllowedMaxWager(player, race) {
  const rankCap = RANKS[race.rank].maxWager;
  const villMult = VILLAGE_MULT[player.villageLevel] || 1.0;
  const cap = rankCap * villMult;
  const fractionFloor = Math.min(Math.floor(player.coins * 0.4), cap * 4);
  const effective = Math.max(cap, fractionFloor);
  return Math.min(player.coins, effective);
}
