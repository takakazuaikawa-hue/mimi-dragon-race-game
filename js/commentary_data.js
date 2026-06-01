/**
 * commentary_data.js — lookup data + tiny pure helpers for the Mimi race
 * commentary engine (spec #28).
 *
 * No race-result mutation, no DOM. This file only TELLS the engine how to
 * phrase what already happened. It provides:
 *   - commentaryName(id)     → dragon name WITHOUT honorifics (§28 §3.2)
 *   - DRAGON_PERSONA[id]     → per-dragon flavor fragments (§28 §11)
 *   - sectionWhy(race, key)  → why this section moves the order (§28 §6.2/§7.3)
 *   - sectionLabelOf(...)    → the section's display label
 *   - weatherFlavor(weather) → how weather shapes the race (§28 §7.4)
 *   - paceFlavor(paceType)   → race-flow phrasing, not numbers (§28 §6.5/§7.8)
 *   - distancePhrase(m)      → 残り距離 callout
 *
 * EXTENSION POINT: new dragon → add DRAGON_PERSONA entry; new section → add to
 * SECTION_FLAVOR; new weather → add to WEATHER_FLAVOR.
 */

// §28 §3.2 — race commentary drops the prefix kanji + 竜 and uses NO honorific
// (kept serious / 呼び捨て). 赤翼竜ルベル → ルベル / 鳳凰竜フェニックス → フェニックス.
function commentaryName(id) {
  const d = (typeof DRAGONS !== "undefined") && DRAGONS.find(x => x.id === id);
  if (!d) return id;
  const m = d.name.match(/竜(.+)$/);
  return m ? m[1] : d.name;
}

// §28 §11 — per-dragon commentary personality. Fragments are picked by the
// engine according to what the dragon is doing this phase. Keep them short and
// serious; the cute register is reserved for story/events, never the race call.
//   lead    — when leading
//   rising  — when gaining positions
//   holding — when holding a forward position / 粘り
//   fading  — when losing positions / tiring
//   back    — when sitting at the rear by design (closers)
//   trait   — a neutral identity line usable any time
const DRAGON_PERSONA = {
  rubel: {
    lead:   "ルベル、先頭を譲らない。",
    rising: "ルベルが前へ出る。",
    fading: "ルベル、前半の速さが残り脚に響くか。",
    trait:  "逃げ脚で押し切る形。"
  },
  seram: {
    rising: "セラムが外から伸びる。",
    holding:"セラム、好位で脚をためる。",
    fading: "セラム、伸びを欠く。",
    trait:  "翼を生かす差し脚。"
  },
  poro: {
    rising: "ポロがじわりと前へ。",
    holding:"ポロ、内でしぶとく粘る。",
    fading: "ポロ、ここで一杯か。",
    trait:  "泣き虫だが走りは崩れない。"
  },
  gando: {
    rising: "ガンドがじわじわ押し上げる。",
    holding:"ガンド、重い流れでも脚色は変わらない。",
    trait:  "スタミナで粘り込む形。"
  },
  miruka: {
    rising: "ミルカが静かに上がる。",
    holding:"ミルカ、落ち着いて運ぶ。",
    trait:  "霧でも乱れない気性。"
  },
  baran: {
    lead:   "バランが果敢に前を取る。",
    fading: "バラン、力みが出たか。",
    trait:  "火を背に流れを引き上げる。"
  },
  rosso: {
    rising: "ロッソが内を突く。",
    holding:"ロッソ、小回りで詰める。",
    trait:  "旋回の利く器用な脚。"
  },
  momu: {
    back:   "モムはまだ後方で脚をためる。",
    rising: "モムが大外から伸びる。",
    trait:  "見た目以上の終い脚。"
  },
  // Phase 9 high-rank challengers (derived from traits; no §11 entry).
  phenix: {
    lead:   "フェニックス、格の違いを見せる。",
    rising: "フェニックスが力強く上がる。",
    trait:  "炎と翼を兼ね備えた本命。"
  },
  raika: {
    lead:   "ライカが一気に飛ばす。",
    fading: "ライカ、気性が顔を出すか。",
    trait:  "電光石火の逃げ。"
  },
  stella: {
    rising: "ステラが大外から差す。",
    holding:"ステラ、安定して脚を伸ばす。",
    trait:  "夜と霧に強い翼。"
  },
  glaze: {
    holding:"グレイズ、淡々と脚を運ぶ。",
    rising: "グレイズがじわりと前へ。",
    trait:  "崩れない耐久型。"
  }
};

function personaLine(id, kind) {
  const p = DRAGON_PERSONA[id];
  return (p && p[kind]) || null;
}

// §28 §7.3 — "なぜこの区間で順位が動くか" by section key. Keyed by the section
// id stored on the race (race.early / race.mid / race.late).
const SECTION_FLAVOR = {
  // early
  long_straight_start: "速度のある竜が前を取りやすい立ち上がり。",
  uphill_start:        "上り坂、入りからスタミナを使う。",
  narrow_start:        "狭く、気性と捌きが問われる。",
  fire_gate_start:     "火門、火力のある竜に勢いがつく。",
  mist_start:          "霧の中、気性の安定が物を言う。",
  // mid
  grand_turn:           "大きな旋回、回転と翼が効く。",
  repeated_small_turns: "小回りの連続、器用な竜が立ち回る。",
  aerial_wind_lane:     "上空の風路、翼の強い竜が伸びやすい。",
  rolling_terrain:      "起伏区間、ここでスタミナが削られる。",
  crowded_bridge:       "混戦の橋、気性勝負になりやすい。",
  // late
  long_final_straight:  "長い直線、速度と持久力の総力戦。",
  short_final_straight: "短い直線、一瞬の反応が勝負。",
  final_grand_turn:     "最終旋回、回転の利く竜が抜け出す。",
  tailwind_straight:    "追い風の直線、翼が大きく効く。",
  volcanic_finish:      "火山フィニッシュ、火力と気性が試される。"
};

function sectionKeyOf(race, phaseSectionKey) {
  return race[phaseSectionKey]; // "early"|"mid"|"late" → stored section id
}

function sectionLabelOf(race, phaseSectionKey) {
  const sec = getSection(phaseSectionKey, race[phaseSectionKey]);
  return sec ? sec.label : "";
}

function sectionWhy(race, phaseSectionKey) {
  return SECTION_FLAVOR[race[phaseSectionKey]] || null;
}

// §28 §7.4 — how the weather shapes the race (展開として伝える).
const WEATHER_FLAVOR = {
  clear:       "今日は晴れ。素直に力を出せる流れ。",
  rain:        "雨で脚元が重い。我慢比べになりやすい。",
  strong_wind: "強い風。外を回る竜には難しいが、翼を使える竜には味方する。",
  thunder:     "雷を含む空模様。気性の安定が問われる。",
  fog:         "深い霧。気性の落ち着いた竜が冷静に運べる。"
};

function weatherFlavor(weather) {
  return WEATHER_FLAVOR[weather] || null;
}

// §28 §6.5/§7.8 — pace as flow, never as a number.
const PACE_FLAVOR = {
  slow:      ["前半は落ち着いた流れ。", "前が止まらなければ逃げ・先行に有利。"],
  standard:  ["流れはまずまず標準。", "大きな無理のないペース。"],
  high:      ["前が速い。", "差し・追込に流れが向きそうだ。"],
  very_high: ["前半からかなり速い流れ。", "前残りは厳しく、後ろの脚に出番が出る。"]
};

function paceFlavor(paceType) {
  return PACE_FLAVOR[paceType] || PACE_FLAVOR.standard;
}

function distancePhrase(remaining) {
  if (remaining > 0) return `残り${remaining}。`;
  return "ゴール前。";
}
