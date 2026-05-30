// Sample races. V1 has Rank 1-3; Phase 9 (v0.9 Content Expansion) adds
// Rank 4-7 races, more regions, festival races, and 神兎大レース.
// Region color theme per §11 §23 (8 regions total).
const REGION_THEME = {
  "グランドクロック地域": { from: "#5d4828", to: "#3a2818", accent: "#d4a850" }, // brass/gold
  "ルミナ地域":           { from: "#264068", to: "#1a2848", accent: "#80b0f0" }, // sky blue
  "リングロッソ地域":     { from: "#4a1820", to: "#28080c", accent: "#d44048" }, // red/black/gold
  "カルデラ地域":         { from: "#4e1a0a", to: "#280808", accent: "#ff7028" }, // volcanic
  "ミストレイク地域":     { from: "#2a3a4a", to: "#181f28", accent: "#a0b8c8" }, // misty
  "ヴェント峡谷地域":     { from: "#2c4a4a", to: "#162828", accent: "#b0e0c8" }, // wind gorge
  "ノッテムーンライト地域": { from: "#22184a", to: "#0e0828", accent: "#a080d4" }, // moonlit night
  "ラパン祭典地域":       { from: "#4a4628", to: "#28220e", accent: "#ffd870" }  // festival gold
};

function raceAssetIds(r) {
  const slug = r.id.replace(/^race_/, "");
  return {
    background: null,       // future: `bg_region_${region_slug}`
    courseBanner: null,     // future: `bg_race_${slug}`
    earlyIcon: null,        // future: `icon_section_${r.early}`
    midIcon: null,
    lateIcon: null,
    _slug: slug
  };
}

const RACES = [
  {
    id: "race_grandclock_1",
    region: "グランドクロック地域",
    cup: "新人競竜杯",
    number: 1,
    rank: 1,
    distance: "short",
    weather: "clear",
    early: "long_straight_start",
    mid: "grand_turn",
    late: "short_final_straight",
    purpose: "基本：人気と先行の入門"
  },
  {
    id: "race_lumina_wind",
    region: "ルミナ地域",
    cup: "風翼杯",
    number: 1,
    rank: 2,
    distance: "mid",
    weather: "strong_wind",
    early: "long_straight_start",
    mid: "aerial_wind_lane",
    late: "tailwind_straight",
    purpose: "翼性能と風の読み"
  },
  {
    id: "race_ringrosso_1",
    region: "リングロッソ地域",
    cup: "旋角杯",
    number: 1,
    rank: 2,
    distance: "short",
    weather: "clear",
    early: "narrow_start",
    mid: "repeated_small_turns",
    late: "final_grand_turn",
    purpose: "回転とポジショニング"
  },
  {
    id: "race_caldera_1",
    region: "カルデラ地域",
    cup: "火竜杯",
    number: 1,
    rank: 3,
    distance: "mid",
    weather: "clear",
    early: "fire_gate_start",
    mid: "rolling_terrain",
    late: "volcanic_finish",
    purpose: "火力過剰人気とスタミナ"
  },
  {
    id: "race_mistlake_1",
    region: "ミストレイク地域",
    cup: "霧鱗杯",
    number: 1,
    rank: 3,
    distance: "long",
    weather: "fog",
    early: "mist_start",
    mid: "rolling_terrain",
    late: "long_final_straight",
    purpose: "スタミナと気性"
  },
  // ===== Phase 9: Rank 4 — 大地域杯 =====
  {
    id: "race_vento_1",
    region: "ヴェント峡谷地域",
    cup: "翔風杯",
    number: 1,
    rank: 4,
    distance: "mid",
    weather: "strong_wind",
    early: "long_straight_start",
    mid: "aerial_wind_lane",
    late: "tailwind_straight",
    purpose: "大地域：強風×翼性能、市場の見た目人気が強まる"
  },
  {
    id: "race_caldera_2",
    region: "カルデラ地域",
    cup: "炎将杯",
    number: 2,
    rank: 4,
    distance: "mid",
    weather: "thunder",
    early: "fire_gate_start",
    mid: "crowded_bridge",
    late: "volcanic_finish",
    purpose: "雷+火、気性とスタミナの試練"
  },
  // ===== Phase 9: Rank 5 — 竜王杯 =====
  {
    id: "race_notte_1",
    region: "ノッテムーンライト地域",
    cup: "月光杯",
    number: 1,
    rank: 5,
    distance: "long",
    weather: "fog",
    early: "mist_start",
    mid: "grand_turn",
    late: "long_final_straight",
    purpose: "夜霧と直線、ブランドと前走勝利が強く効く"
  },
  {
    id: "race_ringrosso_2",
    region: "リングロッソ地域",
    cup: "竜王旋杯",
    number: 1,
    rank: 5,
    distance: "mid",
    weather: "rain",
    early: "narrow_start",
    mid: "repeated_small_turns",
    late: "final_grand_turn",
    purpose: "雨×小回り、人気馬の弱点が露呈しやすい"
  },
  // ===== Phase 9: Rank 6 — 祝祭級 =====
  {
    id: "race_lapan_festival",
    region: "ラパン祭典地域",
    cup: "兎神祝祭杯",
    number: 1,
    rank: 6,
    distance: "long",
    weather: "clear",
    early: "long_straight_start",
    mid: "aerial_wind_lane",
    late: "long_final_straight",
    purpose: "祝祭級：観衆熱狂で看板竜が過剰人気、妙味の宝庫"
  },
  {
    id: "race_caldera_grand",
    region: "カルデラ地域",
    cup: "炎帝杯",
    number: 3,
    rank: 6,
    distance: "mid",
    weather: "clear",
    early: "fire_gate_start",
    mid: "rolling_terrain",
    late: "volcanic_finish",
    purpose: "祝祭級カルデラ：火力ブランドが市場を支配"
  },
  // ===== Phase 9: Rank 7 — 神兎大レース (endgame) =====
  {
    id: "race_lapan_shinto_grand",
    region: "ラパン祭典地域",
    cup: "神兎大レース",
    number: 1,
    rank: 7,
    distance: "marathon",
    weather: "clear",
    early: "long_straight_start",
    mid: "rolling_terrain",
    late: "tailwind_straight",
    purpose: "神兎大レース：最高峰。極端なハイプと巨額配当の世界"
  }
];

function raceFullName(r) {
  return `${r.region} ${r.cup} 第${r.number}レース`;
}

// §07 §9 / §14.7 — 8 dragons per race. Each race picks 8 from the dragon pool.
// V1 races (rank 1-3) use the original 8. Phase 9 high-rank races mix in
// rivals to create a different prediction problem.
const ORIGINAL_8 = ["rubel","seram","poro","gando","miruka","baran","rosso","momu"];

const RACE_ENTRY_OVERRIDES = {
  // Rank 4
  race_vento_1:        ["stella","seram","raika","phenix","miruka","poro","rosso","momu"],
  race_caldera_2:      ["phenix","baran","raika","rubel","glaze","gando","seram","poro"],
  // Rank 5
  race_notte_1:        ["stella","seram","miruka","glaze","rosso","gando","momu","raika"],
  race_ringrosso_2:    ["rosso","stella","poro","miruka","glaze","seram","momu","raika"],
  // Rank 6
  race_lapan_festival: ["phenix","stella","raika","rubel","baran","seram","rosso","gando"],
  race_caldera_grand:  ["phenix","baran","rubel","raika","gando","glaze","poro","seram"],
  // Rank 7 神兎大レース — all the strongest names
  race_lapan_shinto_grand: ["phenix","stella","raika","rubel","seram","gando","glaze","rosso"]
};

function getRaceDragonIds(race) {
  return RACE_ENTRY_OVERRIDES[race.id] || ORIGINAL_8;
}
function getRaceDragons(race) {
  return getRaceDragonIds(race).map(id => DRAGONS.find(d => d.id === id));
}
