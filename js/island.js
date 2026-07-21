// =========================================================================
// island.js — 5章「島づくり」（docs/ISLAND_INVEST_DESIGN.md）。
// =========================================================================
// 体験の芯＝「施設を少しずつ育てる → 島が変わる → 絶滅メーターが退く」。
// ★投資はレベル制（逓増コスト）＝一括購入は先が見えず挫折するため。常に今すぐ買える次の一手＋
//   進捗バー＋節目のご褒美。レーダーは手薄マップ（副）。
// レースの着順/オッズ/配当/FinalPower は不変。担うのは①コインシンク②メーター押し戻し③テキスト進化。
// 状態：state.player.island = { lv:{facId:level}, dev:number }（initガード・既存セーブ互換）。

var ISLAND_CATS = [
  { id: "infra",    ic: "🏗", name: "施設",     color: "#57b1dd", base: 1500000, growth: 1.72, maxLv: 8,
    milestones: {
      1: { name: "港の桟橋を直す",   doom: 8,  react: ["ミミ", "がたがたの桟橋、やっと直った！ 船が安心して着ける島って、それだけで豊かだ。"] },
      4: { name: "谷に橋を架ける",   doom: 14, react: ["スミカ・ラグナ", "ミミ様。橋の向こうの村と、やっと行き来ができます。……島がひとつに繋がりました。"] },
      8: { name: "大通りを石畳に",   doom: 24, react: ["ミミ", "泥だらけだった大通りが、石畳に。雨の日も、みんなが胸を張って歩ける。"] }
    } },
  { id: "commerce", ic: "🏪", name: "商業",     color: "#e6b24a", base: 1800000, growth: 1.74, maxLv: 8,
    milestones: {
      1: { name: "屋台に補助金",     doom: 8,  react: ["屋台のおやじ", "補助金だと……？ ふん、その分うまいもん作らにゃ罰が当たる。見てろよ。"] },
      4: { name: "市場を拡張する",   doom: 15, react: ["ミズ", "市場が広がれば、価値の巡りも太くなる。……あなた、商人の才もあるのね。あはん。"] },
      8: { name: "百貨店を誘致する", doom: 24, react: ["ミミ", "島に百貨店……！ 昔の私が見たら、目を回して気絶するやつだ。"] }
    } },
  { id: "race",     ic: "🏟", name: "レース",   color: "#d6452f", base: 2200000, growth: 1.74, maxLv: 8,
    milestones: {
      1: { name: "観客席を増やす",   doom: 8,  react: ["実況マクラ", "席が増えた分だけ、歓声も増える！ この島のレースは、まだまだ熱くなるぞ——！"] },
      4: { name: "ナイター照明をつける", doom: 15, react: ["ミミ", "夜のレース……！ 火山の赤と、照明の白。あの子たちが星みたいに駆けるんだ。"] },
      8: { name: "大競技場を建てる", doom: 25, react: ["実況マクラ", "世界の天井さえ覗きにくる大舞台だ！ ここが……聖龍レースの、心臓になる。"] }
    } },
  { id: "dragon",   ic: "🐲", name: "竜",       color: "#9a6ad0", base: 2000000, growth: 1.74, maxLv: 8,
    milestones: {
      // ★声表：ポロは言葉を持たない＝語り手をミミにして、ポロのしぐさを描く（セリフ化しない）
      1: { name: "竜の宿舎を建てる", doom: 9,  react: ["ミミ", "新しい宿舎の藁に、ポロが真っ先にもぐりこんだ。……鼻先だけ出して、動かない。気に入ったらしい。"] },
      4: { name: "竜の牧場を拓く",   doom: 16, react: ["ミミ", "竜たちが自由に走れる牧場。レースじゃない、ただ幸せそうな姿……いいなあ。"] },
      8: { name: "竜の療養所を作る", doom: 24, react: ["スミカ・ラグナ", "傷ついた竜も、歳をとった竜も、ここで穏やかに。……島は、勝者だけのものではありません。"] }
    } },
  { id: "public",   ic: "⛲", name: "公共",     color: "#49c89c", base: 1500000, growth: 1.72, maxLv: 8,
    milestones: {
      1: { name: "井戸を掘る",       doom: 8,  react: ["村の子ども", "みず、いっぱいでるよ！ ミミおねえちゃん、まほうつかいみたい！"] },
      4: { name: "診療所を建てる",   doom: 16, react: ["スミカ・ラグナ", "お医者様が常駐してくださる。……もう、熱を出した子を抱えて夜通し歩かなくていい。"] },
      8: { name: "学校を建てる",     doom: 25, react: ["ミミ", "子どもたちが、字を覚えて、予想も覚えて……いつか私を負かすのかな。それも、楽しみ。"] }
    } },
  { id: "industry", ic: "🏭", name: "産業",     color: "#caa44a", base: 1800000, growth: 1.74, maxLv: 8,
    milestones: {
      1: { name: "畑を耕す",         doom: 8,  react: ["ミミ", "島の畑！ 採れたての野菜って、こんなに甘いんだ。屋台のおやじが泣いて喜んでた。"] },
      4: { name: "漁港を整備する",   doom: 15, react: ["漁師", "いい漁港だ。これで時化の日も船が守れる。……島の飯が、もっとうまくなるぞ。"] },
      8: { name: "工房街をひらく",   doom: 24, react: ["ミズ", "作る力は、いちばん強い価値。……この島は、もう誰かに淘汰される島ではないわ。"] }
    } }
];
var ISLAND_GEN_DOOM = 3;   // 通常Lv（節目でない）の押し戻し量

function islandState() {
  const p = state.player;
  if (!p.island) p.island = { lv: {}, dev: 0 };
  if (!p.island.lv) p.island.lv = {};
  if (typeof p.island.dev !== "number") p.island.dev = 0;
  return p.island;
}
function islandCat(id) { return ISLAND_CATS.find(function (c) { return c.id === id; }); }
function islandLevel(id) { return islandState().lv[id] || 0; }
// 次のLvのコスト（cost(lv)=base×growth^lv・現在Lv基点）。最大なら null。
function islandNextCost(cat) {
  const lv = islandLevel(cat.id);
  if (lv >= cat.maxLv) return null;
  return Math.round(cat.base * Math.pow(cat.growth, lv) / 10000) * 10000;   // 万単位で丸め
}
// このLvアップが節目か（milestone定義があるか）。
function islandMilestoneAt(cat, lv) { return cat.milestones && cat.milestones[lv]; }
// 次に来る節目（Lv）と名前＝目標の可視化。
function islandNextMilestone(cat) {
  const lv = islandLevel(cat.id);
  const keys = Object.keys(cat.milestones).map(Number).sort(function (a, b) { return a - b; });
  for (let i = 0; i < keys.length; i++) if (keys[i] > lv) return { lv: keys[i], name: cat.milestones[keys[i]].name };
  return null;
}
function islandCatProgress(catId) { const c = islandCat(catId); return c ? islandLevel(catId) / c.maxLv : 0; }
function islandDevTotal() { let s = 0; ISLAND_CATS.forEach(function (c) { s += islandLevel(c.id); }); return s; }
function islandDevMax() { let s = 0; ISLAND_CATS.forEach(function (c) { s += c.maxLv; }); return s; }
function islandTier() {
  const r = islandDevMax() ? islandDevTotal() / islandDevMax() : 0;
  return r >= 0.85 ? 3 : r >= 0.5 ? 2 : r >= 0.2 ? 1 : 0;
}
var ISLAND_TIER_NAME = ["芽ぶきの島", "育ちゆく島", "栄える島", "極まりの島"];

// I2 テキスト進化：分野ごとに、育つほど島の“いま”を語る3段の一文（Lv1-3 / 4-7 / 8）。表示専用・数値不変。
var ISLAND_EVOLVE = {
  infra:    ["桟橋が直り、船がまっすぐ着くようになった。", "谷に橋が架かり、島がひと続きになった。", "石畳の大通りを、みんなが胸を張って歩く。"],
  commerce: ["屋台に活気が戻り、いい匂いが路地に満ちる。", "広がった市場に、人とお金がよく巡る。", "百貨店の灯りが、島の夜をあたたかく照らす。"],
  race:     ["観客席が増え、歓声がひと回り大きくなった。", "ナイター照明の下、竜が星のように駆ける。", "大競技場は、聖龍レースの心臓になった。"],
  dragon:   ["あたたかい宿舎で、竜たちが安心して眠る。", "牧場では、竜がただ幸せそうに走っている。", "療養所ができ、老いた竜も穏やかに暮らせる。"],
  public:   ["井戸から水があふれ、子どもらが笑う。", "診療所ができ、熱の夜に歩かなくてよくなった。", "学校からは、字を覚える子どもの声がする。"],
  industry: ["畑の野菜が甘い。屋台のおやじが泣いた。", "漁港が整い、島の食がもっと豊かになった。", "工房街がひらき、島は自分の手で価値を作る。"]
};
function islandEvolveLine(catId) {
  const arr = ISLAND_EVOLVE[catId]; if (!arr) return "";
  const lv = islandLevel(catId);
  if (lv >= 8) return arr[2];
  if (lv >= 4) return arr[1];
  if (lv >= 1) return arr[0];
  return "";
}
// 発展済みの分野を「育っている順」に並べ、その“いま”の一文つきで返す（島の景色カード用）。
function islandEvolveScenes(limit) {
  return ISLAND_CATS
    .map(function (c) { return { ic: c.ic, name: c.name, lv: islandLevel(c.id), line: islandEvolveLine(c.id) }; })
    .filter(function (x) { return x.lv >= 1 && x.line; })
    .sort(function (a, b) { return b.lv - a.lv; })
    .slice(0, limit || 3);
}

// 施設を1Lv育てる＝コスト消費＋メーター押し戻し＋発展度更新。節目なら完成カットイン、通常なら軽トースト。
function islandInvest(cat) {
  try {
    const lv = islandLevel(cat.id);
    if (lv >= cat.maxLv) return false;
    const cost = islandNextCost(cat);
    if ((state.player.coins || 0) < cost) {
      if (typeof showInfoPopup === "function") showInfoPopup("🏗 富が足りない…",
        `<div class="mm-row"><span class="mm-ic">💸</span><div><b>${cost.toLocaleString("ja-JP")} コイン 必要（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）</b>` +
        `<small>レースで稼いで、また島に注ごう。少しずつでいい——あなたの一勝が、島を延ばす。</small></div></div>`);
      return false;
    }
    const newLv = lv + 1;
    const ms = islandMilestoneAt(cat, newLv);
    const doom = ms ? ms.doom : ISLAND_GEN_DOOM;
    state.player.coins -= cost;
    islandState().lv[cat.id] = newLv;
    islandState().dev = islandDevTotal();
    const pushed = (typeof epPushAmount === "function") ? epPushAmount(doom) : 0;
    if (typeof updateHeader === "function") try { updateHeader(); } catch (e) {}
    if (typeof saveGame === "function") try { saveGame(); } catch (e) {}
    if (ms) _islandMilestoneCutin(cat, ms, pushed);
    else {
      if (typeof _showUnlockToast === "function") _showUnlockToast(`🏗 ${cat.name}を整備（Lv${newLv}）　☄️ 絶滅 −${pushed}`);
      if (state.ui.screen === "island_build") renderIslandBuild();
    }
    return true;
  } catch (e) { return false; }
}

function _islandMilestoneCutin(cat, ms, pushed) {
  try {
    const ov = el("div", "navpop-ov");
    const box = el("div", "navpop isl-done");
    box.innerHTML =
      `<div class="isl-done-t">${cat.ic} 「${ms.name}」が叶った！</div>` +
      `<div class="isl-done-say"><b>${ms.react[0]}</b>「${ms.react[1]}」</div>` +
      (pushed > 0 ? `<div class="isl-done-doom">☄️ 絶滅メーターを <b>${pushed}</b> 押し戻した</div>` : "");
    const btn = el("button", "navpop-go", "島が、また育った");
    btn.onclick = function () { ov.remove(); if (state.ui.screen === "island_build" && typeof renderIslandBuild === "function") renderIslandBuild(); };
    box.appendChild(btn);
    ov.appendChild(box); document.body.appendChild(ov);
    if (window.Sfx) try { Sfx.play("bigwin"); } catch (e) {}
  } catch (e) {}
}

// 6角レーダー（自前SVG・手薄マップ）＝施設別Lv/maxLvを多角形で。ライブラリ不要（固定6軸）。
function islandRadarSVG(size) {
  const c = size / 2, R = size * 0.38, N = 6;
  function pt(i, r) { const a = -Math.PI / 2 + i * (Math.PI * 2 / N); return [c + Math.cos(a) * r, c + Math.sin(a) * r]; }
  let g = "";
  for (let ring = 1; ring <= 3; ring++) {
    let d = "";
    for (let i = 0; i < N; i++) { const p = pt(i, R * ring / 3); d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "; }
    g += `<path d="${d}Z" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1"/>`;
  }
  for (let i = 0; i < N; i++) { const p = pt(i, R); g += `<line x1="${c}" y1="${c}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="rgba(255,255,255,.10)"/>`; }
  let d = "";
  ISLAND_CATS.forEach(function (cat, i) { const p = pt(i, R * Math.max(0.04, islandCatProgress(cat.id))); d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "; });
  g += `<path d="${d}Z" fill="rgba(255,206,110,.22)" stroke="#ffd34d" stroke-width="1.5"/>`;
  ISLAND_CATS.forEach(function (cat, i) { const p = pt(i, R + size * 0.075); g += `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" font-size="${size * 0.09}">${cat.ic}</text>`; });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

// 🏗 島づくり画面（島の経済配下・5章解放）。主役＝施設カード（Lvバー＋今すぐ買える次の一手）。
function renderIslandBuild() {
  state.ui.screen = "island_build";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🏗 島づくり"));
  app.appendChild(el("div", "as-hint2", "富を島に注ぐ。育てるほど、島が変わる。"));

  const tier = islandTier();
  const head = el("div", "card isl-head");
  const meterPct = (typeof epilogueProgress === "function") ? epilogueProgress() : null;
  head.innerHTML =
    `<div class="isl-radar">${islandRadarSVG(132)}</div>` +
    `<div class="isl-head-id"><div class="isl-tier">${["🌱", "🌿", "🌳", "🏝️"][tier]} ${ISLAND_TIER_NAME[tier]}</div>` +
    `<div class="isl-dev">発展度 <b>${islandDevTotal()}</b> / ${islandDevMax()}</div>` +
    (meterPct != null ? `<div class="isl-meter">☄️ 島の余命 <b>${meterPct}%</b><span class="isl-meter-bar"><i style="width:${meterPct}%"></i></span></div>` : "") +
    `<div class="isl-hint">レーダーの凹みが“手薄な分野”。安いLvから少しずつ、バランスよく。</div></div>`;
  app.appendChild(head);

  // 施設カード＝Lvバー＋次の節目の予告＋「投資する（次Lvのコスト）」
  ISLAND_CATS.forEach(function (cat) {
    const lv = islandLevel(cat.id), maxed = lv >= cat.maxLv;
    const nextCost = islandNextCost(cat);
    const afford = nextCost != null && (state.player.coins || 0) >= nextCost;
    const nm = islandNextMilestone(cat);
    const curMs = islandMilestoneAt(cat, lv);   // 今の到達名（あれば）
    const card = el("div", "isl-fac" + (maxed ? " maxed" : ""));
    card.style.setProperty("--ic", cat.color);
    // 進捗バー（Lv/maxLv・節目位置に印）
    let pips = "";
    for (let i = 1; i <= cat.maxLv; i++) pips += `<span class="isl-pip${i <= lv ? " on" : ""}${cat.milestones[i] ? " ms" : ""}"></span>`;
    card.innerHTML =
      `<div class="isl-fac-top"><span class="isl-fac-ic">${cat.ic}</span>` +
        `<span class="isl-fac-id"><b>${cat.name}</b><small>${curMs ? curMs.name : (lv > 0 ? "整備中" : "手つかず")}</small></span>` +
        `<span class="isl-fac-lv">${maxed ? "極" : "Lv" + lv}<small>/${cat.maxLv}</small></span></div>` +
      `<div class="isl-fac-bar">${pips}</div>` +
      (nm ? `<div class="isl-fac-next">次の見どころ：<b>Lv${nm.lv} ${nm.name}</b></div>` : (maxed ? `<div class="isl-fac-next done">🏆 この分野は極まった</div>` : "")) +
      (maxed ? "" :
        `<button class="isl-fac-buy${afford ? "" : " short"}">` +
          `<span class="isl-fac-buy-lv">Lv${lv}→${lv + 1}${cat.milestones[lv + 1] ? " ★" : ""}</span>` +
          `<span class="isl-fac-buy-cost">🪙${nextCost.toLocaleString("ja-JP")}</span>` +
          `<span class="isl-fac-buy-doom">☄️−${cat.milestones[lv + 1] ? cat.milestones[lv + 1].doom : ISLAND_GEN_DOOM}</span>` +
        `</button>`);
    if (!maxed) { const b = card.querySelector(".isl-fac-buy"); if (b) b.onclick = function () { islandInvest(cat); }; }
    app.appendChild(card);
  });

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 島の経済へ戻る"); back.onclick = function () { if (typeof renderEconomy === "function") renderEconomy(); };
  actions.appendChild(back);
  app.appendChild(actions);
}
if (typeof window !== "undefined") { window.ISLAND_CATS = ISLAND_CATS; window.renderIslandBuild = renderIslandBuild; }
