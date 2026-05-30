// Sample races for V1 (3 required + 2 optional).
// assetIds per §11 §15 reserved as null. Region color theme from §11 §23.
const REGION_THEME = {
  "グランドクロック地域": { from: "#5d4828", to: "#3a2818", accent: "#d4a850" }, // brass/gold
  "ルミナ地域":           { from: "#264068", to: "#1a2848", accent: "#80b0f0" }, // sky blue
  "リングロッソ地域":     { from: "#4a1820", to: "#28080c", accent: "#d44048" }, // red/black/gold
  "カルデラ地域":         { from: "#4e1a0a", to: "#280808", accent: "#ff7028" }, // volcanic
  "ミストレイク地域":     { from: "#2a3a4a", to: "#181f28", accent: "#a0b8c8" }  // misty
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
  }
];

function raceFullName(r) {
  return `${r.region} ${r.cup} 第${r.number}レース`;
}
