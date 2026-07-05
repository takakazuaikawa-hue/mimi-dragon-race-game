// =========================================================================
// hunger.js — おなか＆お金の使い道（docs/HUNGER_ECONOMY_DESIGN.md・E1）。
// =========================================================================
// レース数値（着順/オッズ/配当/FinalPower）は不変。担うのは「コインのシンク」と
// 「出走前ゲート」だけ（スマホ購入・衣装購入と同種の既存パターン）。
// meals.js は他作業と競合しないよう直接編集せず、eatMeal を後勝ちラップで拡張する
// （ui_mall_rpg / ui_scout と同じこのコードベースの流儀）。

// ── 状態（initガード＝既存セーブは満腹100から） ──
function hungerGet() {
  const p = (typeof state !== "undefined" && state.player) || {};
  if (typeof p.hunger !== "number") p.hunger = 100;
  return p.hunger;
}
function hungerSet(v) {
  state.player.hunger = Math.max(0, Math.min(100, Math.round(v)));
  if (typeof saveGame === "function") try { saveGame(); } catch (e) {}
}
function hungerSpend(n) { hungerSet(hungerGet() - n); }
function hungerSpendRace() { hungerSpend(25); }          // 出走＝一番おなかが減る
// FTUE保護：最初の3レースはゲート無効（減りはするが止めない＝最初の5分を守る）
function hungerFtueSafe() { return ((state.player && state.player.completedRaces) || 0) < 3; }
function hungerCanRace() { return hungerFtueSafe() || hungerGet() > 0; }

// ── 価格（生活段位スケール＝暮らしが上がると外食も高級化・HUNGER_ECONOMY_DESIGN §2） ──
function hungerBaseUnit() {
  try {
    const a = (state.player && state.player.totalAssets) || 0;
    if (a >= 100000000) return 10000;
    if (a >= 1000000) return 2000;
    if (a >= 100000) return 300;
    return 50;
  } catch (e) { return 50; }
}
var MEAL_GRADE = { track: 1, home: 2, gourman: 6, shinbo: 20 };
var MEAL_HEAL  = { track: 40, home: 55, gourman: 80, shinbo: 100 };
function mealPrice(m) { return hungerBaseUnit() * (MEAL_GRADE[(m && m.tier)] || 1); }
function mealHeal(m) { return MEAL_HEAL[(m && m.tier)] || 40; }

// ── 詰み回避①：負け飯の無料枠（ハズレた日は1品おごり） ──
function _hDay() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function hungerFreeMealOk() {
  try {
    const lastMiss = state.current && state.current.betResult && state.current.betResult.hit === false;
    return !!lastMiss && state.player._freeMealDay !== _hDay();
  } catch (e) { return false; }
}

function _hToast(msg) { try { if (typeof _showUnlockToast === "function") _showUnlockToast(msg); } catch (e) {} }

// ── eatMeal 後勝ちラップ：初回実食に課金＋満腹回復。再読/既食は無料のまま ──
(function () {
  if (typeof eatMeal !== "function") return;
  const _origEat = eatMeal;
  eatMeal = function (id) {
    try {
      const m = (typeof MEALS !== "undefined") ? MEALS.find(function (x) { return x.id === id; }) : null;
      const eaten = (typeof mealEaten === "function") && mealEaten(id);
      if (m && !eaten) {
        if (hungerFreeMealOk()) {
          state.player._freeMealDay = _hDay();
          _hToast("🍜 今日は店のおごりだ。「……次は勝てよ」　おなか +" + mealHeal(m));
        } else {
          const price = mealPrice(m);
          if ((state.player.coins || 0) < price) {
            if (typeof showInfoPopup === "function") showInfoPopup("🍽 持ち合わせが足りない…",
              `<div class="mm-row"><span class="mm-ic">💸</span><div><b>${price.toLocaleString("ja-JP")} コイン 必要</b>` +
              `<small>レースで稼ぐか、安い屋台から。ハズレた日は1品「店のおごり」が出ます。</small></div></div>`);
            return;   // 食べない＝収集も満腹も進まない（ゲートは出走のみ・ここは「買えない」だけ）
          }
          state.player.coins -= price;
          if (typeof updateHeader === "function") try { updateHeader(); } catch (e) {}
          _hToast("🍽 −" + price.toLocaleString("ja-JP") + " コイン　おなか +" + mealHeal(m));
        }
        hungerSet(hungerGet() + mealHeal(m));
      }
    } catch (e) {}
    return _origEat(id);
  };
})();
