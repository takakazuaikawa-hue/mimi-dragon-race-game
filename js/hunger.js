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
// ── 食事の価格＝品ごとの現実価格（自宅=最安）×緩い生活段位スケール。おなか回復は品ごと固定（資産で増減しない）。──
var MEAL_PRICE_BASE = {   // 基本価格（コイン）。自宅40〜300／屋台300〜750。
  h_toast: 50, h_banana: 40, h_onigiri: 60, h_tkg: 80, h_natto: 90, h_ochazuke: 100,
  h_yakimeshi: 120, h_sausage: 130, h_cupmen: 150, h_medama: 200, h_curry: 250, h_nabe: 300,
  t_amazake: 350, t_wataame: 350, t_dango: 350, t_nikuman: 350, t_kakigori: 350, t_corn: 350,
  t_dog: 400, t_yakitori: 450, t_takoyaki: 450, t_dote: 500, t_ikayaki: 500, t_ramen: 750
};
var MEAL_FILL = {         // おなか回復（品ごと・固定）。バナナ/綿あめは小、鍋/ラーメンは大。
  h_toast: 20, h_banana: 15, h_onigiri: 30, h_tkg: 30, h_natto: 35, h_ochazuke: 25,
  h_yakimeshi: 45, h_sausage: 30, h_cupmen: 35, h_medama: 45, h_curry: 50, h_nabe: 55,
  t_amazake: 20, t_wataame: 10, t_dango: 25, t_nikuman: 40, t_kakigori: 15, t_corn: 30,
  t_dog: 45, t_yakitori: 45, t_takoyaki: 45, t_dote: 50, t_ikayaki: 40, t_ramen: 60
};
var MEAL_TIER_BASE = { track: 400, home: 120, gourman: 700, shinbo: 1500 };  // データ未登録idのフォールバック価格
var MEAL_HEAL_TIER = { track: 40, home: 45, gourman: 80, shinbo: 100 };      // 同・回復
function hungerScale() {  // 生活段位（総資産）で外食が少しだけ高級化＝緩め。基本価格は現実的なまま維持。
  try {
    const a = (state.player && state.player.totalAssets) || 0;
    if (a >= 100000000) return 2.5;
    if (a >= 10000000) return 2.0;
    if (a >= 1000000) return 1.6;
    if (a >= 100000) return 1.3;
    return 1.0;
  } catch (e) { return 1.0; }
}
function mealPrice(m) {
  const base = (m && MEAL_PRICE_BASE[m.id]) || (m && MEAL_TIER_BASE[m.tier]) || 100;
  return Math.round(base * hungerScale() / 10) * 10;   // 10コイン単位に丸め
}
function mealHeal(m) { return (m && MEAL_FILL[m.id]) || (m && MEAL_HEAL_TIER[m.tier]) || 40; }

// ── 詰み回避①：負け飯の無料枠（ハズレた日は1品おごり） ──
function _hDay() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function hungerFreeMealOk() {
  try {
    const lastMiss = state.current && state.current.betResult && state.current.betResult.hit === false;
    return !!lastMiss && state.player._freeMealDay !== _hDay();
  } catch (e) { return false; }
}

function _hToast(msg) { try { if (typeof _showUnlockToast === "function") _showUnlockToast(msg); } catch (e) {} }

// ── 値札に怯むミミの一言（章別の暮らしアーク＝HUNGER_ECONOMY_DESIGN §5・テキストの声） ──
// 段位1=どん底の哀愁コメディ／2=庶民の背伸び／3以上=いい暮らしのうっかり。追加はここに1行。
var HUNGER_BROKE_LINES = {
  1: ["うっ……ゼロがひとつ多い。み、水でいいや。水はタダだし。",
      "（値札を三度見して、そっと店を出た）",
      "お腹の音、実況みたいに大きい。……はずかしい。",
      "いつか絶対食べる。ノートの『いつかリスト』に書いた。"],
  2: ["これが庶民の壁……！ でも今日の壁は、明日の目標。",
      "は、半分だけ……は売ってないですよね。ですよね〜。",
      "店員さんの笑顔がまぶしい。「またのご来店を」……うん、また来る。絶対。"],
  3: ["あれ、足りない。……観光で使いすぎたな！ 楽しかったからいいけど！",
      "明日の私が稼ぐので、今日の私は我慢です。これぞ計画性。",
      "ふっ、大人には「あえて頼まない」という選択肢があるのです。（強がり）"]
};
function _hBrokeLine() {
  const u = hungerBaseUnit();
  const k = u >= 2000 ? 3 : u >= 300 ? 2 : 1;
  const arr = HUNGER_BROKE_LINES[k] || HUNGER_BROKE_LINES[1];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── E2：習い事の月謝（基準単価×2）＝「通う」1回の費用（HUNGER_ECONOMY §3）。習い事に振り直しは
//    無いので毎回の実費。UI（ui_assets.js renderActiveSkills）から呼ぶ。払えたら true。──
function lessonFee() { return hungerBaseUnit() * 2; }
function tryPayLesson(skillName) {
  const fee = lessonFee();
  if ((state.player.coins || 0) < fee) {
    if (typeof showInfoPopup === "function") showInfoPopup("🎫 月謝が足りない…",
      `<div class="mm-row"><span class="mm-ic">💸</span><div><b>${fee.toLocaleString("ja-JP")} コイン 必要（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）</b>` +
      `<small>${_hBrokeLine()}　レースで稼いでから、また通おう。</small></div></div>`);
    return false;
  }
  state.player.coins -= fee;
  if (typeof updateHeader === "function") try { updateHeader(); } catch (e) {}
  _hToast("🎫 −" + fee.toLocaleString("ja-JP") + " コイン　" + (skillName || "習い事") + "に通った");
  return true;
}

// ── E2：くらしツリー ノード初回解放にコイン（基準単価×P費）＝「新しい暮らしを覚える一度きりの
//    出費」。振り直し後の再取得は無料（P振り分けの実験は自由・お金の二重取り防止）。──
function lifeNodePrice(node) { return hungerBaseUnit() * ((node && node.cost) || 1); }
function lifeNodeBought(node) { try { return !!(state.lifeTree && state.lifeTree.bought && state.lifeTree.bought[node.nodeId]); } catch (e) { return false; } }
(function () {
  if (typeof unlockLifeNode !== "function") return;
  const _origUnlock = unlockLifeNode;
  unlockLifeNode = function (node) {
    try {
      const lt = state.lifeTree || (state.lifeTree = { unlocked: {} });
      const bought = lt.bought || (lt.bought = {});
      if (node && !bought[node.nodeId] && typeof lifeNodeState === "function" && lifeNodeState(node) === "ready") {
        const price = lifeNodePrice(node);
        if ((state.player.coins || 0) < price) {
          if (typeof showInfoPopup === "function") showInfoPopup("🌳 暮らしにもお金がかかる",
            `<div class="mm-row"><span class="mm-ic">💸</span><div><b>${price.toLocaleString("ja-JP")} コイン 必要（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）</b>` +
            `<small>${_hBrokeLine()}　レースで稼いでから、また育てよう。</small></div></div>`);
          return { ok: false, broke: true };
        }
        const r = _origUnlock(node);
        if (r.ok) {
          state.player.coins -= price;
          bought[node.nodeId] = 1;
          if (typeof updateHeader === "function") try { updateHeader(); } catch (e) {}
          _hToast("🌳 −" + price.toLocaleString("ja-JP") + " コイン　「" + (node.title || "暮らし") + "」を身につけた");
          if (typeof saveGame === "function") try { saveGame(); } catch (e) {}
        }
        return r;
      }
    } catch (e) {}
    return _origUnlock(node);   // 既購入ノードの再取得＝無料（振り直し後の実験）
  };
})();
(function () {
  if (typeof respecLifeTree !== "function") return;
  const _origRespec = respecLifeTree;
  respecLifeTree = function () {
    const keep = (state.lifeTree && state.lifeTree.bought) || {};   // 支払い履歴は残す
    _origRespec();
    state.lifeTree.bought = keep;
    if (typeof saveGame === "function") try { saveGame(); } catch (e) {}
  };
})();

// ── eatMeal 後勝ちラップ：初回実食に課金＋満腹回復。再読/既食は無料のまま ──
(function () {
  if (typeof eatMeal !== "function") return;
  const _origEat = eatMeal;
  eatMeal = function (id) {
    try {
      const m = (typeof MEALS !== "undefined") ? MEALS.find(function (x) { return x.id === id; }) : null;
      if (m) {
        const discovered = (typeof mealEaten === "function") && mealEaten(id);
        // 既食＆満腹＝再注文しない（コインの無駄食い防止）。初回発見は満腹でも許容（収集のため）。
        if (discovered && hungerGet() >= 100) { _hToast("🈵 おなかいっぱい。今は食べなくて大丈夫。"); return; }
        if (hungerFreeMealOk()) {
          state.player._freeMealDay = _hDay();
          _hToast("🍜 今日は店のおごりだ。「……次は勝てよ」　おなか +" + mealHeal(m));
        } else {
          const price = mealPrice(m);
          if ((state.player.coins || 0) < price) {
            if (typeof showInfoPopup === "function") showInfoPopup("🍽 持ち合わせが足りない…",
              `<div class="mm-row"><span class="mm-ic">💸</span><div><b>${price.toLocaleString("ja-JP")} コイン 必要（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）</b>` +
              `<small>${_hBrokeLine()}</small></div></div>` +
              `<div class="mm-row"><span class="mm-ic">💡</span><div><small>レースで稼ぐか、安い自宅ごはんから。ハズレた日は1品「店のおごり」が出ます。</small></div></div>`);
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
