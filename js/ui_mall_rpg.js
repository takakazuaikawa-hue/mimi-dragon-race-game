// =========================================================================
// ui_mall_rpg.js — 大冒険ハブ(rpgRenderHub)を station SQUARE 風ライト・ポータルに“上書き定義”。
// =========================================================================
// ★クラウドが活発に拡張する mall_rpg.js は一切触らず、後から読み込む本ファイルで rpgRenderHub だけを
//   再定義（classic scriptは後勝ち）。データ/ロジック(rpgData/rpgStartRun/rpgGachaPull/rpgBuyUp/…)は
//   全てグローバル流用＝**振る舞いは不変**、見た目だけモール(.scm)に統一。探索/戦闘等の本体画面は不変。
// レース数値に非干渉＝[[race-math-immutable]]。_scmIcon は js/ui_mall.js（先に読込）から流用。
// =========================================================================
// ⚠️【重要】これが実際に画面へ出るハブの本体（mall_rpg.js の rpgRenderHub を後勝ちで置き換える）。
//   mall_rpg.js 側のハブに機能を足しても、こちらに入れないとプレイヤーには表示されません。
//   ハブへ機能追加する時は必ず mall_rpg.js と本ファイルの両方に反映すること
//   （称号・フロア帯が消えていた事例＝docs/MALL_UX_BACKLOG.md P0-1）。

function rpgRenderHub(app) {
  const d = rpgData();
  const rec = d.records || {};
  const tot = rpgShopTotalOwned();
  const topI = RPG_FLOORS.length - 1;

  const scm = el("div", "scm scmr");

  // ── ヘッダー（ロゴ＋？） ──
  const head = el("div", "scm-head");
  head.innerHTML = `<div class="scm-logo"><small>MIMI MALL・屋上アトラクション</small><b>大冒険<span>&nbsp;ADVENTURE</span></b></div>`;
  const hic = el("div", "scm-headic");
  const hb = el("button", "scm-hbtn"); hb.innerHTML = (typeof _scmIcon === "function") ? _scmIcon("clock") : "？"; hb.title = "あそびかた"; hb.onclick = () => rpgShowHelp();
  hic.appendChild(hb);
  head.appendChild(hic);
  scm.appendChild(head);

  // ── ステータス・カード（Lv/HP/MP ／ 🪙🎟️✨） ──
  const stat = el("div", "scmr-stat");
  const hpPct = Math.max(0, Math.min(100, Math.round((d.hp / Math.max(1, d.maxhp)) * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round((d.mp / Math.max(1, d.maxmp)) * 100)));
  stat.innerHTML =
    `<div class="scmr-char"><span class="scmr-av">🧝</span><div class="scmr-lvl"><b>Lv ${d.lv}</b>${(() => { const tt = rpgTopTitle(); return tt ? `<span class="scmr-clear title">${tt.ic}${tt.n}</span>` : (d.cleared ? `<span class="scmr-clear">🌿制覇</span>` : ""); })()}</div></div>` +
    `<div class="scmr-bars">` +
      `<div class="scmr-bar"><span class="scmr-bk">❤️ HP</span><span class="scmr-bt"><i style="width:${hpPct}%"></i></span><span class="scmr-bv">${d.hp}/${d.maxhp}</span></div>` +
      `<div class="scmr-bar mp"><span class="scmr-bk">💧 MP</span><span class="scmr-bt"><i style="width:${mpPct}%"></i></span><span class="scmr-bv">${d.mp}/${d.maxmp}</span></div>` +
    `</div>` +
    `<div class="scmr-wallet"><span>🪙 <b>${d.gold}</b></span><span>🎟️ <b>${d.tickets || 0}</b></span><span>✨ <b>${d.rep || 0}</b></span></div>`;
  scm.appendChild(stat);

  // ── つぎの目標 ──
  let goal;
  if (!d.cleared) {
    const bf = rec.floor || 0;
    goal = bf < topI ? `屋上をめざそう：あと <b>${topI - bf}</b> フロアで制覇！` : `屋上のボスを倒せば制覇！`;
  } else if (tot.o < tot.t) {
    goal = `ショッピング・コンプまで あと <b>${tot.t - tot.o}</b> 品！`;
  } else {
    goal = `エンドレスタワー 最深 <b>${rec.depth || 0}</b> 層を更新しよう！`;
  }
  scm.appendChild(el("div", "scmr-goal", `🎯 ${goal}`));

  // ── フロア帯（踏破の可視化：mall_rpg.js版rpgRenderHubと同じロジックを.scm意匠で表示）──
  const reached = d.cleared ? (RPG_FLOORS.length - 1) : (rec.floor || 0);
  const strip = el("div", "scmr-floorstrip");
  strip.innerHTML = RPG_FLOORS.map((f, i) => {
    const top = i === RPG_FLOORS.length - 1, lab = top ? "🏯屋上" : (i + 1) + "F";
    const cls = (d.cleared || i <= reached) ? "done" : (i === reached + 1 ? "now" : "");
    return `<span class="scmr-fs-cell ${cls}">${lab}</span>`;
  }).join("");
  scm.appendChild(strip);

  // ── ログインボーナス ──
  if (d.daily !== rpgToday()) {
    const dl = el("button", "scmr-daily", "🎁 ログインボーナス（🎟️＋おまけ）を受け取る");
    dl.onclick = () => rpgClaimDaily();
    scm.appendChild(dl);
  }

  // ── 主役：冒険する（オレンジのヒーローCTA）＋タワー ──
  const cta = el("button", "scmr-cta");
  cta.innerHTML = `<span class="scmr-cta-k">🏬</span><span class="scmr-cta-tx"><b>${d.cleared ? "もう一度 冒険する" : "冒険にでかける"}</b><small>1Fから屋上まで・観光客や魔物と戦って衣装GET</small></span><span class="scmr-cta-go">▶</span>`;
  cta.onclick = () => rpgStartRun();
  scm.appendChild(cta);
  // 🛗 エクスプレス＝3ドア択の短距離ラン（既存の探索ランと併存・別モード／js/mall_express.js）
  if (typeof rpgStartExpress === "function") {
    const ex = el("button", "scmr-cta express");
    ex.innerHTML = `<span class="scmr-cta-k">🛗</span><span class="scmr-cta-tx"><b>エクスプレス</b>` +
      `<small>6フロア・3つの扉から選ぶ短い冒険。店長を倒して「買い物術」を重ねる</small></span><span class="scmr-cta-go">▶</span>`;
    ex.onclick = () => rpgStartExpress();
    scm.appendChild(ex);
  }
  if (d.cleared) {
    const tw = el("button", "scmr-cta tower");
    tw.innerHTML = `<span class="scmr-cta-k">🌟</span><span class="scmr-cta-tx"><b>エンドレスタワー</b><small>${(rec.depth || 0) ? `最深 ${rec.depth}層 を更新しよう` : "どこまで登れる？"}</small></span><span class="scmr-cta-go">▶</span>`;
    tw.onclick = () => rpgStartTower();
    scm.appendChild(tw);
  }

  // ── 🎰 ガチャ（カード） ──
  const gacha = el("div", "scmr-card");
  gacha.appendChild(_scmrTitle("おたからガチャ", "🎰", `<span class="scmr-rates">伝説0.7% / 激レア2.8% / SR9.5%</span>`));
  const gg = el("div", "scmr-gacha");
  const g1 = el("button", "scmr-gbtn" + ((d.tickets || 0) >= 1 ? "" : " off"));
  g1.innerHTML = `<b>🎟️ 1回</b><small>チケット×1</small>`;
  g1.disabled = (d.tickets || 0) < 1; g1.onclick = () => rpgGachaPull(1);
  const g10 = el("button", "scmr-gbtn gold" + ((d.gold || 0) >= 280 ? "" : " off"));
  g10.innerHTML = `<b>💎 10連</b><small>280G・SR以上確定</small>`;
  g10.disabled = (d.gold || 0) < 280; g10.onclick = () => rpgGachaPull(10);
  gg.appendChild(g1); gg.appendChild(g10);
  gacha.appendChild(gg);
  scm.appendChild(gacha);

  // ── 💖 自分磨き（アコーディオン） ──
  const upReady = RPG_UP.some(u => { const lv = rpgUpLv(u.id); return lv < u.max && (d.rep || 0) >= u.cost(lv); });
  const lab = el("details", "scmr-acc");
  lab.innerHTML = `<summary>💖 自分磨き <span class="scmr-acc-r">✨${d.rep || 0}${upReady ? ` <span class="scmr-badge">！</span>` : ""}</span></summary>` +
    `<div class="scmr-hint">ぼうけんでたまる✨みがきで、ミミがずっと成長するっ！（倒れても持ち帰る）</div>`;
  const labg = el("div", "scmr-labgrid");
  RPG_UP.forEach(u => {
    const lv = rpgUpLv(u.id), maxed = lv >= u.max, cost = u.cost(lv), can = (d.rep || 0) >= cost;
    const b = el("button", "scmr-labbtn" + (maxed ? " maxed" : can ? " ready" : " off"));
    b.innerHTML = `<span class="scmr-labic">${u.ic}</span><b>${u.n}</b><small>${u.d}</small><span class="scmr-lablv">${maxed ? "MAX" : "Lv" + lv + " / " + u.max}</span><span class="scmr-labcost">${maxed ? "✓" : "✨" + cost}</span>`;
    if (!maxed) b.onclick = () => rpgBuyUp(u.id);
    labg.appendChild(b);
  });
  lab.appendChild(labg);
  scm.appendChild(lab);

  // ── 🛍️ ショッピング帳 ──
  const book = el("details", "scmr-acc");
  let bh = `<summary>🛍️ ショッピング帳 <span class="scmr-acc-r">${tot.o}/${tot.t}</span></summary><div class="scmr-book">`;
  RPG_FLOORS.forEach((f, i) => {
    const arr = rpgShopFor(i), o = rpgShopOwnedN(arr);
    bh += `<div class="scmr-bfloor"><div class="scmr-bfloor-t">${f.name.replace(/ .*/, " ")}<small>${o}/${arr.length}</small></div><div class="scmr-bitems">` +
      arr.map(it => `<span class="scmr-bit${rpgOwned(it.id) ? " got" : ""}" title="${it.n}">${rpgOwned(it.id) ? it.ic : "❔"}</span>`).join("") + `</div></div>`;
  });
  bh += `</div>`;
  book.innerHTML = bh;
  scm.appendChild(book);

  // ── 🧰 おでかけ準備（道具屋＋休む） ──
  const prep = el("details", "scmr-acc");
  let ph = `<summary>🧰 おでかけ準備</summary><div class="scmr-shopgrid">`;
  [["potion", "🧪 回復薬", "HP+40", 20], ["ether", "🔵 マナ水", "MP+20", 30]].forEach(([k, n, ds, price]) => {
    ph += `<button class="scmr-shopbtn${d.gold >= price ? "" : " off"}" data-buy="${k}"${d.gold < price ? " disabled" : ""}><b>${n}</b><small>${ds}</small><span class="scmr-cost">${price}G</span></button>`;
  });
  ph += `</div>`;
  prep.innerHTML = ph;
  const restBtn = el("button", "scmr-rest", "🛏️ 休む（HP/MP全回復）");
  restBtn.onclick = () => rpgRest();
  prep.appendChild(restBtn);
  prep.querySelectorAll("[data-buy]").forEach(b => { b.onclick = () => rpgBuy(b.getAttribute("data-buy")); });
  scm.appendChild(prep);

  // ── 📖 ずかん ──
  const codex = el("details", "scmr-acc");
  let rows = "";
  RPG_TOURISTS.concat(RPG_MONSTERS_MINOR, RPG_KUNLUN, ["boss1"]).forEach(id => {
    const m = RPG_MONS[id], seen = d.codex[id];
    const w = seen && seen.weak.length ? seen.weak.map(e => RPG_ELEM_IC[e]).join("") : "？";
    rows += `<div class="scmr-codexrow"><span>${m.ic} ${seen ? m.n : "？？？"}</span><span>弱点 ${w}</span></div>`;
  });
  codex.innerHTML = `<summary>📖 ずかん（すれちがい）</summary><div class="scmr-codex">${rows}</div>`;
  scm.appendChild(codex);

  // ── 🏅 称号（やり込みの頂点。mall_rpg.js版のrpgTitles/rpgTopTitleロジックをそのまま流用・見た目だけ.scm意匠）──
  const titles = rpgTitles(), gotN = titles.filter(t => t.got).length;
  const trd = el("details", "scmr-acc");
  trd.innerHTML = `<summary>🏅 称号 <span class="scmr-acc-r">${gotN}/${titles.length}</span></summary>` +
    `<div class="scmr-titles">` +
    titles.map(t => `<div class="scmr-title-row${t.got ? " got" : ""}"><span class="tt-ic">${t.got ? t.ic : "🔒"}</span><span class="tt-n">${t.n}</span><span class="tt-st">${t.got ? "✓ 獲得" : t.hint}</span></div>`).join("") +
    `</div>`;
  scm.appendChild(trd);

  // ── 🏆 きろく ──
  const recd = el("details", "scmr-acc");
  recd.innerHTML = `<summary>🏆 きろく</summary><div class="scmr-records">` +
    `<div class="scmr-rec"><small>ベストスコア</small><b>${rec.score || 0}</b></div>` +
    `<div class="scmr-rec"><small>最高Lv</small><b>${rec.lv || d.lv}</b></div>` +
    `<div class="scmr-rec"><small>最高到達</small><b>${rec.floor != null ? RPG_FLOORS[Math.min(rec.floor, topI)].name.replace(/ .*/, "") : "—"}</b></div>` +
    `<div class="scmr-rec"><small>最大コンボ</small><b>×${rec.combo || 0}</b></div>` +
    `<div class="scmr-rec"><small>🎯ミッション</small><b>${rec.missions || 0}</b></div>` +
    `</div>`;
  scm.appendChild(recd);

  // ── 戻る ──
  const back = el("button", "scmr-back", "← モールへ戻る");
  back.onclick = () => renderMall();
  scm.appendChild(back);

  app.appendChild(scm);
}

function _scmrTitle(jp, ic, right) {
  const t = el("div", "scmr-ctitle");
  t.innerHTML = `<b>${ic ? ic + " " : ""}${jp}</b>${right || ""}`;
  return t;
}
