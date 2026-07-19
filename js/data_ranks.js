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

// §08 §13 Rescue coins by village level.
const RESCUE_COINS = { 1:300, 2:1000, 3:5000, 4:30000, 5:100000, 6:1000000, 7:10000000, 8:100000000, 9:1000000000, 10:10000000000 };

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
const RANK_UNLOCK = {
  2: { coins: 2000,          hitsAtLowerRank: 2,  completedAtLowerRank: 5 },
  3: { coins: 10000,         hitsAtLowerRank: 4,  completedAtLowerRank: 10 },
  4: { coins: 100000,        hitsAtLowerRank: 7,  completedAtLowerRank: 17 },
  5: { coins: 10000000,      hitsAtLowerRank: 12, completedAtLowerRank: 30 },
  6: { coins: 1000000000,    hitsAtLowerRank: 20, completedAtLowerRank: 50 },
  7: { coins: 1000000000000, hitsAtLowerRank: 30, completedAtLowerRank: 75 }
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
