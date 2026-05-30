// Course section definitions. Weights per spec 03 §7.
// Each section has stat weights (sum = 1.0), terrain cost tag, and a display label.

const EARLY_SECTIONS = {
  long_straight_start: {
    label: "長直線スタート",
    weights: { speed:0.35, nerve:0.20, fire:0.15, wing:0.10, stamina:0.10, turn:0.10 },
    terrain: null
  },
  uphill_start: {
    label: "上り坂スタート",
    weights: { stamina:0.30, nerve:0.20, speed:0.20, fire:0.15, wing:0.05, turn:0.10 },
    terrain: { stat: "stamina", coef: 0.20 }
  },
  narrow_start: {
    label: "狭路スタート",
    weights: { nerve:0.30, turn:0.25, speed:0.15, stamina:0.10, fire:0.10, wing:0.10 },
    terrain: { stat: "nerve", coef: 0.15 }
  },
  fire_gate_start: {
    label: "火門スタート",
    weights: { fire:0.35, nerve:0.25, speed:0.20, stamina:0.10, turn:0.05, wing:0.05 },
    terrain: { stat: "nerve", coef: 0.10 }
  },
  mist_start: {
    label: "霧中スタート",
    weights: { nerve:0.35, turn:0.20, speed:0.15, stamina:0.10, wing:0.10, fire:0.10 },
    terrain: { stat: "nerve", coef: 0.18 }
  }
};

const MID_SECTIONS = {
  grand_turn: {
    label: "大旋回",
    weights: { turn:0.35, wing:0.20, nerve:0.20, speed:0.10, stamina:0.10, fire:0.05 },
    terrain: null
  },
  repeated_small_turns: {
    label: "小回り連続",
    weights: { turn:0.40, nerve:0.20, stamina:0.15, speed:0.15, wing:0.05, fire:0.05 },
    terrain: { stat: "turn", coef: 0.18 }
  },
  aerial_wind_lane: {
    label: "上空風路",
    weights: { wing:0.40, nerve:0.20, stamina:0.15, speed:0.10, turn:0.10, fire:0.05 },
    terrain: { stat: "wing", coef: 0.20 }
  },
  rolling_terrain: {
    label: "起伏地帯",
    weights: { stamina:0.35, nerve:0.20, speed:0.15, turn:0.15, wing:0.05, fire:0.10 },
    terrain: { stat: "stamina", coef: 0.15 }
  },
  crowded_bridge: {
    label: "混戦橋",
    weights: { nerve:0.30, turn:0.25, fire:0.20, speed:0.10, stamina:0.10, wing:0.05 },
    terrain: { stat: "nerve", coef: 0.15 }
  }
};

const LATE_SECTIONS = {
  long_final_straight: {
    label: "長い直線",
    weights: { speed:0.30, wing:0.25, stamina:0.25, nerve:0.10, turn:0.05, fire:0.05 },
    terrain: null
  },
  short_final_straight: {
    label: "短い直線",
    weights: { speed:0.30, nerve:0.20, stamina:0.20, fire:0.10, turn:0.10, wing:0.10 },
    terrain: null
  },
  final_grand_turn: {
    label: "最終大旋回",
    weights: { turn:0.35, nerve:0.20, stamina:0.20, wing:0.10, speed:0.10, fire:0.05 },
    terrain: { stat: "turn", coef: 0.15 }
  },
  tailwind_straight: {
    label: "追い風直線",
    weights: { wing:0.35, speed:0.25, stamina:0.20, nerve:0.10, turn:0.05, fire:0.05 },
    terrain: null
  },
  volcanic_finish: {
    label: "火山フィニッシュ",
    weights: { fire:0.35, nerve:0.25, stamina:0.20, speed:0.10, turn:0.05, wing:0.05 },
    terrain: { stat: "fire", coef: 0.12, also: { stat: "nerve", coef: 0.12 } }
  }
};

function getSection(phase, key) {
  if (phase === "early") return EARLY_SECTIONS[key];
  if (phase === "mid")   return MID_SECTIONS[key];
  if (phase === "late")  return LATE_SECTIONS[key];
  return null;
}
