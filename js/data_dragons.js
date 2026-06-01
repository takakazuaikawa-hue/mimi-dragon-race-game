/**
 * data_dragons.js — dragon roster (V1 base 8 + Phase 9 high-rank 4).
 *
 * Stats are internal 0-100. ClassBonus scales with rank/experience.
 * assetIds (§11 §15) remain null in V1; slot keys reserved for asset injection.
 * Placeholder visual = style color disc + name initial (§11 §19).
 *
 * EXTENSION POINT — adding a new dragon:
 *   1. Append entry to DRAGONS array (use ORIGINAL_8 ordering convention or
 *      tag as a Phase 9+ rival via the "high-rank challengers" section).
 *   2. Add asset base name to DRAGON_ASSET_BASE map.
 *   3. If you want them in default V1 races, replace one of ORIGINAL_8 in
 *      data_races.js. Otherwise add per-race RACE_ENTRY_OVERRIDES.
 *   4. Optionally add a rival-intro event in event_registry.js.
 */

// §11 §7 archetype → asset ID base name map.
const DRAGON_ASSET_BASE = {
  rubel:  "dragon_red_wing_lubel",
  seram:  "dragon_blue_wing_seram",
  poro:   "dragon_crybaby_poro",
  gando:  "dragon_stone_scale_gando",
  miruka: "dragon_mist_horn_milka",
  baran:  "dragon_fire_tail_baran",
  rosso:  "dragon_turn_claw_rosso",
  momu:   "dragon_sleepy_cloud_momu",
  // Phase 9 — high-rank challengers
  phenix: "dragon_phoenix_phenix",
  raika:  "dragon_thunder_horn_raika",
  stella: "dragon_starlight_stella",
  glaze:  "dragon_ice_glaze_glaze"
};

// §11 §19: placeholder dragon-icon CSS color by style.
const STYLE_COLOR = {
  escape: "#d44040", front: "#d4a040", late: "#4080d4", chase: "#a060d4"
};

function dragonAssetIds(id) {
  const base = DRAGON_ASSET_BASE[id] || `dragon_${id}`;
  return {
    icon: null,        // future: `${base}_icon`
    portrait: null,    // future: `${base}_portrait`
    chibi: null,       // future: `${base}_chibi`
    raceSilhouette: null,
    _base: base
  };
}

const DRAGONS = [
  {
    id: "rubel",
    name: "赤翼竜ルベル",
    style: "escape",
    // stamina/nerve adjusted per §14.18 ("can be adjusted later") so that the
    // overpopular favorite still wins sometimes (§12.12 #2 / §12.10 target feel).
    stats: { speed: 88, stamina: 82, turn: 55, wing: 70, fire: 78, nerve: 65, classBonus: 70 },
    publicImage: 88,    // flashy/famous
    courseReputation: { fire: 75, straight: 80, wind: 60, turn: 50, fog: 45 },
    fanBias: 75,
    recentResult: 92,   // recent win → overhyped
    newspaperMark: "◎",
    visualMood: 80,
    crowdReaction: 85,
    traits: ["逃げ", "短距離強", "前走勝利"],
    portraitTone: "炎の赤翼"
  },
  {
    id: "seram",
    name: "青翼竜セラム",
    style: "late",
    stats: { speed: 72, stamina: 78, turn: 68, wing: 90, fire: 40, nerve: 72, classBonus: 65 },
    publicImage: 62,
    courseReputation: { fire: 40, straight: 70, wind: 88, turn: 60, fog: 65 },
    fanBias: 55,
    recentResult: 60,
    newspaperMark: "▲",
    visualMood: 65,
    crowdReaction: 60,
    traits: ["差し", "強風強", "終い良い"],
    portraitTone: "蒼翼の伸び"
  },
  {
    id: "poro",
    name: "泣き虫竜ポロ",
    style: "front",
    stats: { speed: 68, stamina: 72, turn: 70, wing: 60, fire: 38, nerve: 82, classBonus: 60 },
    publicImage: 70,    // cute underdog
    courseReputation: { fire: 50, straight: 60, wind: 65, turn: 70, fog: 75 },
    fanBias: 80,        // beloved by fans
    recentResult: 58,
    newspaperMark: "△",
    visualMood: 55,
    crowdReaction: 88,  // crowd loves the crybaby
    traits: ["先行", "気性安定", "複系狙い"],
    portraitTone: "涙の青鱗"
  },
  {
    id: "gando",
    name: "岩鱗竜ガンド",
    style: "front",
    stats: { speed: 60, stamina: 92, turn: 62, wing: 50, fire: 65, nerve: 78, classBonus: 68 },
    publicImage: 55,
    courseReputation: { fire: 60, straight: 65, wind: 50, turn: 60, fog: 65, rolling: 88 },
    fanBias: 45,
    recentResult: 70,
    newspaperMark: "○",
    visualMood: 60,
    crowdReaction: 55,
    traits: ["先行", "スタミナ型", "長距離強"],
    portraitTone: "灰岩の重戦"
  },
  {
    id: "miruka",
    name: "霧角竜ミルカ",
    style: "late",
    stats: { speed: 70, stamina: 68, turn: 75, wing: 55, fire: 35, nerve: 88, classBonus: 62 },
    publicImage: 50,
    courseReputation: { fire: 35, straight: 60, wind: 55, turn: 78, fog: 90 },
    fanBias: 40,
    recentResult: 55,
    newspaperMark: "△",
    visualMood: 52,
    crowdReaction: 48,
    traits: ["差し", "気性◎", "霧強"],
    portraitTone: "霧の白角"
  },
  {
    id: "baran",
    name: "火尾竜バラン",
    style: "escape",
    stats: { speed: 82, stamina: 76, turn: 50, wing: 55, fire: 92, nerve: 60, classBonus: 66 },
    publicImage: 85,    // flashy fire
    courseReputation: { fire: 92, straight: 70, wind: 45, turn: 45, fog: 35 },
    fanBias: 70,
    recentResult: 78,
    newspaperMark: "○",
    visualMood: 78,
    crowdReaction: 80,
    traits: ["逃げ", "火力型", "カルデラ向き"],
    portraitTone: "炎尾の暴走"
  },
  {
    id: "rosso",
    name: "旋爪竜ロッソ",
    style: "late",
    stats: { speed: 74, stamina: 70, turn: 92, wing: 58, fire: 55, nerve: 70, classBonus: 64 },
    publicImage: 60,
    courseReputation: { fire: 50, straight: 60, wind: 55, turn: 92, fog: 60 },
    fanBias: 55,
    recentResult: 72,
    newspaperMark: "○",
    visualMood: 60,
    crowdReaction: 60,
    traits: ["差し", "小回り◎", "技巧派"],
    portraitTone: "旋風の爪"
  },
  {
    id: "momu",
    name: "眠雲竜モム",
    style: "chase",
    stats: { speed: 65, stamina: 80, turn: 68, wing: 70, fire: 35, nerve: 80, classBonus: 58 },
    publicImage: 45,    // sleepy looking
    courseReputation: { fire: 40, straight: 65, wind: 70, turn: 65, fog: 70 },
    fanBias: 35,
    recentResult: 50,
    newspaperMark: "×",
    visualMood: 40,    // looks sleepy → undervalued
    crowdReaction: 38,
    traits: ["追込", "複穴狙い", "気性安定"],
    portraitTone: "雲の眠竜"
  },
  // ===== Phase 9 high-rank challengers =====
  {
    id: "phenix",
    name: "鳳凰竜フェニックス",
    style: "front",
    stats: { speed: 90, stamina: 85, turn: 70, wing: 88, fire: 90, nerve: 75, classBonus: 90 },
    publicImage: 95,    // legendary name
    courseReputation: { fire: 90, straight: 85, wind: 75, turn: 60, fog: 50 },
    fanBias: 92,        // huge fan support
    recentResult: 95,
    newspaperMark: "◎",
    visualMood: 92,
    crowdReaction: 95,
    traits: ["先行", "高ランク本命", "炎×翼"],
    portraitTone: "黄金の鳳凰"
  },
  {
    id: "raika",
    name: "雷角竜ライカ",
    style: "escape",
    stats: { speed: 92, stamina: 70, turn: 60, wing: 75, fire: 60, nerve: 50, classBonus: 80 },
    publicImage: 80,
    courseReputation: { fire: 65, straight: 88, wind: 70, turn: 55, fog: 45 },
    fanBias: 70,
    recentResult: 85,
    newspaperMark: "○",
    visualMood: 82,
    crowdReaction: 78,
    traits: ["逃げ", "電光石火", "気性難"],
    portraitTone: "稲妻の角"
  },
  {
    id: "stella",
    name: "星光竜ステラ",
    style: "late",
    stats: { speed: 80, stamina: 82, turn: 75, wing: 90, fire: 50, nerve: 85, classBonus: 82 },
    publicImage: 78,
    courseReputation: { fire: 55, straight: 80, wind: 90, turn: 75, fog: 80 },
    fanBias: 75,
    recentResult: 80,
    newspaperMark: "○",
    visualMood: 80,
    crowdReaction: 80,
    traits: ["差し", "翼安定", "夜・霧強"],
    portraitTone: "星の翼"
  },
  {
    id: "glaze",
    name: "氷甲竜グレイズ",
    style: "front",
    stats: { speed: 70, stamina: 92, turn: 80, wing: 65, fire: 45, nerve: 90, classBonus: 78 },
    publicImage: 55,    // quiet, not flashy
    courseReputation: { fire: 35, straight: 70, wind: 65, turn: 80, fog: 88 },
    fanBias: 50,
    recentResult: 75,
    newspaperMark: "▲",
    visualMood: 58,
    crowdReaction: 50,
    traits: ["先行", "耐久型", "気性◎"],
    portraitTone: "氷の甲"
  }
];
