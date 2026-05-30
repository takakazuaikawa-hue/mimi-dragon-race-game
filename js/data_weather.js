// Weather definitions per spec 03 §9.
const WEATHERS = {
  clear: {
    label: "晴れ",
    weights: { speed:0.30, fire:0.20, wing:0.15, stamina:0.15, nerve:0.10, turn:0.10 }
  },
  rain: {
    label: "雨",
    weights: { stamina:0.30, nerve:0.25, turn:0.15, wing:0.10, speed:0.10, fire:0.10 }
  },
  strong_wind: {
    label: "強風",
    weights: { wing:0.45, nerve:0.30, stamina:0.15, speed:0.10, turn:0.00, fire:0.00 }
  },
  thunder: {
    label: "雷",
    weights: { nerve:0.40, stamina:0.20, wing:0.15, speed:0.10, turn:0.10, fire:0.05 }
  },
  fog: {
    label: "霧",
    weights: { nerve:0.35, turn:0.25, stamina:0.15, wing:0.10, speed:0.10, fire:0.05 }
  }
};
