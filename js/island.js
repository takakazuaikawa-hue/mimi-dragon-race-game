// =========================================================================
// island.js — 5章「島づくり」（docs/ISLAND_INVEST_DESIGN.md）。
// =========================================================================
// 体験の芯＝「事業に富を注ぐ → 島が変わる → 絶滅メーターが退く」。レーダーは手薄マップ（副役）。
// レースの着順/オッズ/配当/FinalPower は不変。担うのは①コインシンク②メーター押し戻し③テキスト進化。
// 状態：state.player.island = { done:{projectId:1}, dev:number }（initガード・既存セーブ互換）。

var ISLAND_CATS = [
  { id: "infra",    ic: "🏗", name: "施設",     color: "#57b1dd" },
  { id: "commerce", ic: "🏪", name: "商業",     color: "#e6b24a" },
  { id: "race",     ic: "🏟", name: "レース",   color: "#d6452f" },
  { id: "dragon",   ic: "🐲", name: "竜",       color: "#9a6ad0" },
  { id: "public",   ic: "⛲", name: "公共",     color: "#49c89c" },
  { id: "industry", ic: "🏭", name: "産業",     color: "#caa44a" }
];

// 事業（安→高／各分野3件）。cost=富の出口・doom=完成でメーターを退かせる量（レース毎+3に対し中8/大25）。
// react=完成の一言（キャラ声）・evolve=この事業が書き換える島の断片（I2で各所へ結線）。weight=発展度への寄与。
var ISLAND_PROJECTS = [
  // 🏗 施設
  { cat: "infra", id: "inf_pier",  name: "港の桟橋を直す",   cost: 2000000,  doom: 8,  weight: 1, react: ["ミミ", "がたがたの桟橋、やっと直った！ 船が安心して着ける島って、それだけで豊かだ。"] },
  { cat: "infra", id: "inf_bridge", name: "谷に橋を架ける",   cost: 12000000, doom: 14, weight: 2, react: ["スミカ・ラグナ", "ミミ様。橋の向こうの村と、やっと行き来ができます。……島がひとつに繋がりました。"] },
  { cat: "infra", id: "inf_road",  name: "大通りを石畳に",   cost: 60000000, doom: 22, weight: 3, react: ["ミミ", "泥だらけだった大通りが、石畳に。雨の日も、みんなが胸を張って歩ける。"] },
  // 🏪 商業
  { cat: "commerce", id: "com_subsidy", name: "屋台に補助金", cost: 2500000,  doom: 8,  weight: 1, react: ["屋台のおやじ", "補助金だと……？ ふん、その分うまいもん作らにゃ罰が当たる。見てろよ。"] },
  { cat: "commerce", id: "com_market",  name: "市場を拡張する", cost: 18000000, doom: 15, weight: 2, react: ["ミズ", "市場が広がれば、価値の巡りも太くなる。……あなた、商人の才もあるのね。あはん。"] },
  { cat: "commerce", id: "com_depart",  name: "百貨店を誘致する", cost: 80000000, doom: 24, weight: 3, react: ["ミミ", "島に百貨店……！ 昔の私が見たら、目を回して気絶するやつだ。"] },
  // 🏟 レース
  { cat: "race", id: "rac_seats", name: "観客席を増やす",   cost: 3000000,  doom: 8,  weight: 1, react: ["実況マクラ", "席が増えた分だけ、歓声も増える！ この島のレースは、まだまだ熱くなるぞ——！"] },
  { cat: "race", id: "rac_light", name: "ナイター照明をつける", cost: 20000000, doom: 15, weight: 2, react: ["ミミ", "夜のレース……！ 火山の赤と、照明の白。あの子たちが星みたいに駆けるんだ。"] },
  { cat: "race", id: "rac_dome",  name: "大競技場を建てる",  cost: 90000000, doom: 25, weight: 3, react: ["実況マクラ", "世界の天井さえ覗きにくる大舞台だ！ ここが……聖龍レースの、心臓になる。"] },
  // 🐲 竜
  { cat: "dragon", id: "drg_barn", name: "竜の宿舎を建てる", cost: 3000000,  doom: 9,  weight: 1, react: ["ポロ", "あったかいおうち……！ ぼくたち竜も、ゆっくりねむれるよ。ありがと、おねえちゃん。"] },
  { cat: "dragon", id: "drg_ranch", name: "竜の牧場を拓く",  cost: 22000000, doom: 16, weight: 2, react: ["ミミ", "竜たちが自由に走れる牧場。レースじゃない、ただ幸せそうな姿……いいなあ。"] },
  { cat: "dragon", id: "drg_clinic", name: "竜の療養所を作る", cost: 85000000, doom: 24, weight: 3, react: ["スミカ・ラグナ", "傷ついた竜も、歳をとった竜も、ここで穏やかに。……島は、勝者だけのものではありません。"] },
  // ⛲ 公共
  { cat: "public", id: "pub_well",   name: "井戸を掘る",     cost: 2000000,  doom: 8,  weight: 1, react: ["村の子ども", "みず、いっぱいでるよ！ ミミおねえちゃん、まほうつかいみたい！"] },
  { cat: "public", id: "pub_clinic", name: "診療所を建てる", cost: 20000000, doom: 16, weight: 2, react: ["スミカ・ラグナ", "お医者様が常駐してくださる。……もう、熱を出した子を抱えて夜通し歩かなくていい。"] },
  { cat: "public", id: "pub_school", name: "学校を建てる",   cost: 80000000, doom: 25, weight: 3, react: ["ミミ", "子どもたちが、字を覚えて、予想も覚えて……いつか私を負かすのかな。それも、楽しみ。"] },
  // 🏭 産業
  { cat: "industry", id: "ind_farm",  name: "畑を耕す",       cost: 2500000,  doom: 8,  weight: 1, react: ["ミミ", "島の畑！ 採れたての野菜って、こんなに甘いんだ。屋台のおやじが泣いて喜んでた。"] },
  { cat: "industry", id: "ind_port",  name: "漁港を整備する", cost: 18000000, doom: 15, weight: 2, react: ["漁師", "いい漁港だ。これで時化の日も船が守れる。……島の飯が、もっとうまくなるぞ。"] },
  { cat: "industry", id: "ind_craft", name: "工房街をひらく", cost: 85000000, doom: 24, weight: 3, react: ["ミズ", "作る力は、いちばん強い価値。……この島は、もう誰かに淘汰される島ではないわ。"] }
];

function islandState() {
  const p = state.player;
  if (!p.island) p.island = { done: {}, dev: 0 };
  if (!p.island.done) p.island.done = {};
  if (typeof p.island.dev !== "number") p.island.dev = 0;
  return p.island;
}
function islandDone(id) { return !!islandState().done[id]; }
// 分野別の投資度（0..1）＝その分野の完成weight / 分野総weight。レーダー軸。
function islandCatProgress(catId) {
  let got = 0, total = 0;
  ISLAND_PROJECTS.forEach(function (pr) { if (pr.cat === catId) { total += pr.weight; if (islandDone(pr.id)) got += pr.weight; } });
  return total ? got / total : 0;
}
// 発展度（完成weight合計）と帯。テキスト進化 islandTier() が参照。
function islandDevTotal() { let s = 0; ISLAND_PROJECTS.forEach(function (pr) { if (islandDone(pr.id)) s += pr.weight; }); return s; }
function islandDevMax() { let s = 0; ISLAND_PROJECTS.forEach(function (pr) { s += pr.weight; }); return s; }
function islandTier() {
  const r = islandDevMax() ? islandDevTotal() / islandDevMax() : 0;
  return r >= 0.85 ? 3 : r >= 0.5 ? 2 : r >= 0.2 ? 1 : 0;   // 0芽 1育 2栄 3極
}
var ISLAND_TIER_NAME = ["芽ぶきの島", "育ちゆく島", "栄える島", "極まりの島"];

// 事業を叶える＝コイン消費＋メーター押し戻し＋発展度更新。払えなければ false。表示専用メタ。
function islandFund(pr) {
  try {
    if (!pr || islandDone(pr.id)) return false;
    if ((state.player.coins || 0) < pr.cost) {
      if (typeof showInfoPopup === "function") showInfoPopup("🏗 富が足りない…",
        `<div class="mm-row"><span class="mm-ic">💸</span><div><b>${pr.cost.toLocaleString("ja-JP")} コイン 必要（所持 ${(state.player.coins || 0).toLocaleString("ja-JP")}）</b>` +
        `<small>レースで稼いで、また島に注ごう。焦らずとも、あなたの一勝が島を延ばす。</small></div></div>`);
      return false;
    }
    state.player.coins -= pr.cost;
    islandState().done[pr.id] = 1;
    islandState().dev = islandDevTotal();
    const pushed = (typeof epPushAmount === "function") ? epPushAmount(pr.doom) : 0;
    if (typeof updateHeader === "function") try { updateHeader(); } catch (e) {}
    if (typeof saveGame === "function") try { saveGame(); } catch (e) {}
    // 完成の瞬間：語り手の一言＋メーターが退いた実感（cut-in流用）。
    _islandCompletionCutin(pr, pushed);
    return true;
  } catch (e) { return false; }
}

function _islandCompletionCutin(pr, pushed) {
  try {
    const who = pr.react[0], line = pr.react[1];
    const ov = el("div", "navpop-ov");
    const box = el("div", "navpop isl-done");
    box.innerHTML =
      `<div class="isl-done-t">🎉 「${pr.name}」が叶った！</div>` +
      `<div class="isl-done-say"><b>${who}</b>「${line}」</div>` +
      (pushed > 0 ? `<div class="isl-done-doom">☄️ 絶滅メーターを <b>${pushed}</b> 押し戻した</div>` : "");
    const btn = el("button", "navpop-go", "島が、また育った");
    btn.onclick = function () { ov.remove(); if (state.ui.screen === "island_build" && typeof renderIslandBuild === "function") renderIslandBuild(); };
    box.appendChild(btn);
    ov.appendChild(box); document.body.appendChild(ov);
    if (window.Sfx) try { Sfx.play("bigwin"); } catch (e) {}
  } catch (e) {}
}

// 6角レーダー（自前SVG・手薄マップ）＝分野別投資度を多角形で。ライブラリ不要（固定6軸）。
function islandRadarSVG(size) {
  const c = size / 2, R = size * 0.38, N = 6;
  function pt(i, r) { const a = -Math.PI / 2 + i * (Math.PI * 2 / N); return [c + Math.cos(a) * r, c + Math.sin(a) * r]; }
  let g = "";
  // グリッド（3リング＋軸）
  for (let ring = 1; ring <= 3; ring++) {
    let d = "";
    for (let i = 0; i < N; i++) { const p = pt(i, R * ring / 3); d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "; }
    g += `<path d="${d}Z" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1"/>`;
  }
  for (let i = 0; i < N; i++) { const p = pt(i, R); g += `<line x1="${c}" y1="${c}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="rgba(255,255,255,.10)"/>`; }
  // 投資度ポリゴン
  let d = "";
  ISLAND_CATS.forEach(function (cat, i) { const p = pt(i, R * Math.max(0.04, islandCatProgress(cat.id))); d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "; });
  g += `<path d="${d}Z" fill="rgba(255,206,110,.22)" stroke="#ffd34d" stroke-width="1.5"/>`;
  // 軸ラベル（アイコン）
  ISLAND_CATS.forEach(function (cat, i) { const p = pt(i, R + size * 0.075); g += `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" font-size="${size * 0.09}">${cat.ic}</text>`; });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

// 🏗 島づくり画面（島の経済配下・5章解放）。主役＝事業カード、レーダーは上部の手薄マップ。
function renderIslandBuild() {
  state.ui.screen = "island_build";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🏗 島づくり"));
  app.appendChild(el("div", "as-hint2", "勝ち取った富を、島に注ぐ。一つ叶えるたび、島が変わり、迫る絶滅が一歩退く。"));

  // 上部：発展度＋レーダー（手薄マップ）＋メーター
  const tier = islandTier();
  const head = el("div", "card isl-head");
  const meterPct = (typeof epilogueProgress === "function") ? epilogueProgress() : null;
  head.innerHTML =
    `<div class="isl-radar">${islandRadarSVG(132)}</div>` +
    `<div class="isl-head-id"><div class="isl-tier">${["🌱", "🌿", "🌳", "🏝️"][tier]} ${ISLAND_TIER_NAME[tier]}</div>` +
    `<div class="isl-dev">発展度 <b>${islandDevTotal()}</b> / ${islandDevMax()}</div>` +
    (meterPct != null ? `<div class="isl-meter">☄️ 島の余命 <b>${meterPct}%</b><span class="isl-meter-bar"><i style="width:${meterPct}%"></i></span></div>` : "") +
    `<div class="isl-hint">レーダーの凹みが“手薄な分野”。バランスよく育てるほど島は粘り強い。</div></div>`;
  app.appendChild(head);

  // 分野ごとに事業カード
  ISLAND_CATS.forEach(function (cat) {
    const projs = ISLAND_PROJECTS.filter(function (p) { return p.cat === cat.id; });
    const doneN = projs.filter(function (p) { return islandDone(p.id); }).length;
    const sec = el("div", "isl-cat");
    sec.style.setProperty("--ic", cat.color);
    sec.appendChild(el("div", "isl-cat-h", `<span class="isl-cat-ic">${cat.ic}</span><b>${cat.name}</b><small>${doneN}/${projs.length}</small>`));
    projs.forEach(function (pr) {
      const done = islandDone(pr.id);
      const afford = (state.player.coins || 0) >= pr.cost;
      const card = el("div", "isl-proj" + (done ? " done" : ""));
      card.innerHTML =
        `<div class="isl-proj-id"><b>${pr.name}</b><small>${done ? "✓ 叶えた" : "☄️押し戻し " + pr.doom}</small></div>` +
        (done ? `<span class="isl-proj-done">✓</span>`
              : `<button class="isl-proj-buy${afford ? "" : " short"}">🪙${pr.cost.toLocaleString("ja-JP")}</button>`);
      if (!done) { const b = card.querySelector(".isl-proj-buy"); if (b) b.onclick = function () { islandFund(pr); }; }
      sec.appendChild(card);
    });
    app.appendChild(sec);
  });

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 島の経済へ戻る"); back.onclick = function () { if (typeof renderEconomy === "function") renderEconomy(); };
  actions.appendChild(back);
  app.appendChild(actions);
}
if (typeof window !== "undefined") { window.ISLAND_PROJECTS = ISLAND_PROJECTS; window.renderIslandBuild = renderIslandBuild; }
