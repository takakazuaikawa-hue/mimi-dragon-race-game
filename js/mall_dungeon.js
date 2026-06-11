// =========================================================================
// 🗼 モールお買い物ダンジョン — モール内ミニゲーム（ローグライク）
// 閉店後のモールに何度でも潜り、衣装のかけら・モールメダル・アクセ（その回限りのビルド）を
// 集めて持ち帰る。奥深さ＝3つのドアの選択 / 閉店ゲージとの押し引き / アクセのシナジー /
// 5フロアごとのショーケース（衣装ドロップ）/ メダルの恒常強化。
// ★完全に表示メタ：着順・オッズ・配当・レース進行には一切干渉しない（[[race-math-immutable]]）。
//   コインも消費/付与しない（報酬は衣装unlockとダンジョン内通貨のみ）。
// 永続データ: state.player.dungeon = {medals, shards:{c,r,l}, passives:{}, bestF, runs, wins}
//             state.player.outfitsWon = [outfitId...]（outfitOwnedが参照）
// =========================================================================

let MD = null;   // 進行中のラン（画面遷移で破棄＝ローグライク。永続は state.player.dungeon のみ）

function mdData() {
  if (!state.player.dungeon) state.player.dungeon = { medals: 0, shards: { c: 0, r: 0, l: 0 }, passives: {}, bestF: 0, runs: 0, wins: 0 };
  const d = state.player.dungeon;
  if (!d.shards) d.shards = { c: 0, r: 0, l: 0 };
  if (!d.passives) d.passives = {};
  return d;
}
function mdRnd(n) { return Math.floor(Math.random() * n); }
function mdPick(a) { return a[mdRnd(a.length)]; }

// ── アクセ（その回限りのパッシブ。組み合わせ＝ビルド）
const MD_ITEMS = [
  { id: "sneaker", ic: "👟", n: "スニーカー", d: "警備から逃げやすい（被害-1段階）" },
  { id: "bell",    ic: "🔔", n: "迷子の鈴",   d: "警備との遭遇率が下がる" },
  { id: "light",   ic: "🔦", n: "懐中電灯",   d: "暗がりで事故らない＆お宝発見率UP" },
  { id: "gloves",  ic: "🧤", n: "厚手の軍手", d: "マネキンにぶつかっても平気" },
  { id: "magnet",  ic: "🧲", n: "マグネット手袋", d: "売り場のかけら+1" },
  { id: "charm",   ic: "🧿", n: "竜のお守り", d: "ダメージを1回だけ無効（消費）" },
  { id: "map",     ic: "🗺️", n: "フロアマップ", d: "ドアの中身が見える" },
  { id: "watch",   ic: "⌚", n: "古い腕時計", d: "閉店ゲージの進みが少し遅くなる" },
  { id: "coupon",  ic: "🎟️", n: "クーポン帳", d: "ガチャが1回無料（消費）" },
  { id: "vip",     ic: "💳", n: "VIPカード",  d: "ショーケースで2回選べる" },
  { id: "ecobag",  ic: "🛍️", n: "エコバッグ", d: "アクセ所持枠+2" },
  { id: "radio",   ic: "📻", n: "小型ラジオ", d: "休憩所の回復+1" },
];
function mdHas(id) { return MD && MD.items.some(i => i.id === id); }
function mdConsume(id) { const i = MD.items.findIndex(x => x.id === id); if (i >= 0) MD.items.splice(i, 1); }

// ── 部屋（ドア）。w=出現重み、深さで変動。
const MD_ROOMS = [
  { id: "fashion", ic: "👗", n: "服飾売り場",   hint: "かけら／マネキン注意" },
  { id: "variety", ic: "🧸", n: "雑貨売り場",   hint: "アクセが見つかる" },
  { id: "food",    ic: "🍙", n: "食品売り場",   hint: "体力回復" },
  { id: "dark",    ic: "🌑", n: "暗がりの通路", hint: "高レアかけら／事故注意" },
  { id: "guard",   ic: "🤖", n: "警備室",       hint: "メダル多数／警備ロボ" },
  { id: "gacha",   ic: "🎰", n: "ガチャコーナー", hint: "メダルでガチャ" },
  { id: "rest",    ic: "🛋️", n: "休憩所",       hint: "回復＋閉店が遠のく" },
];

// 深さ→かけらの帯（c=ふつう / r=レア / l=高級）
function mdShardTier(f) {
  if (f >= 15) return Math.random() < 0.55 ? "l" : "r";
  if (f >= 10) return Math.random() < 0.6 ? "r" : "c";
  if (f >= 5) return Math.random() < 0.35 ? "r" : "c";
  return "c";
}
const MD_TIER_LABEL = { c: "布のかけら", r: "銀糸のかけら", l: "金糸のかけら" };
const MD_TIER_IC = { c: "🧵", r: "🪡", l: "✨" };

// 価格帯→衣装の帯（ダンジョン産unlockの対象。assets解放・free・既所持は除外）
function mdOutfitPool(band) {
  const ranges = { c: [0, 8000], r: [8001, 30000], l: [30001, Infinity] };
  const [lo, hi] = ranges[band];
  return OUTFITS.filter(o => o.acquire && o.acquire.price != null && o.acquire.price >= lo && o.acquire.price <= hi && !outfitOwned(o));
}
function mdGrantOutfit(band, allowMermes) {
  let pool = mdOutfitPool(band);
  if (!allowMermes) pool = pool.filter(o => o.id !== "mermes");
  if (!pool.length) return null;
  const o = mdPick(pool);
  if (!state.player.outfitsWon) state.player.outfitsWon = [];
  state.player.outfitsWon.push(o.id);
  mdData().wins++;
  if (typeof saveGame === "function") saveGame();
  try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
  return o;
}

// ── 恒常強化（モールメダル・買い切り）
const MD_PASSIVES = [
  { id: "hp",    ic: "❤️", n: "丈夫なからだ",     d: "体力の上限+1",            cost: 80 },
  { id: "bag",   ic: "🎒", n: "大きなリュック",   d: "アクセ所持枠+2",          cost: 60 },
  { id: "start", ic: "🎁", n: "開店前の準備",     d: "アクセ1つ持ってスタート", cost: 100 },
  { id: "slow",  ic: "🕰️", n: "閉店延長の交渉",   d: "閉店ゲージ-12からスタート", cost: 120 },
  { id: "gacha", ic: "🪙", n: "ガチャ常連",       d: "ガチャ費用が半額",        cost: 90 },
];

// ── ラン開始
function mdStart() {
  const d = mdData();
  d.runs++;
  const hpMax = 3 + (d.passives.hp ? 1 : 0);
  MD = {
    f: 1, hp: hpMax, hpMax,
    bagMax: 4 + (d.passives.bag ? 2 : 0),
    gauge: d.passives.slow ? -12 : 0,
    items: [], log: [],
    gain: { medals: 0, shards: { c: 0, r: 0, l: 0 }, outfits: [] },
    mode: "doors", doors: [], boss: null, over: null,
  };
  if (d.passives.start) MD.items.push(mdPick(MD_ITEMS.filter(i => !["vip", "charm", "coupon"].includes(i.id))));
  mdNewDoors();
  if (typeof saveGame === "function") saveGame();
  renderMallDungeon();
}
function mdBagMax() { return MD.bagMax + (mdHas("ecobag") ? 2 : 0); }
function mdLog(t, cls) { MD.log.unshift({ t, cls: cls || "" }); MD.log = MD.log.slice(0, 4); }

function mdNewDoors() {
  if (MD.f % 5 === 0) { MD.mode = "boss"; MD.boss = { tries: mdHas("vip") ? 2 : 1, keys: 3 }; return; }
  MD.mode = "doors";
  const deck = MD_ROOMS.slice();
  // 深いほど 暗がり/警備 が出やすく、休憩は出にくい
  const ws = deck.map(r => {
    if (r.id === "dark") return 1 + MD.f * 0.12;
    if (r.id === "guard") return 1 + MD.f * 0.10;
    if (r.id === "rest") return Math.max(0.4, 1.2 - MD.f * 0.05);
    return 1;
  });
  MD.doors = [];
  while (MD.doors.length < 3) {
    let t = ws.reduce((a, b) => a + b, 0) * Math.random(), k = 0;
    while (t > ws[k]) { t -= ws[k]; k++; }
    if (!MD.doors.includes(deck[k])) MD.doors.push(deck[k]);
  }
}

// ── ダメージ共通（お守り→スニーカーの順で軽減）
function mdHurt(n, why) {
  if (mdHas("charm")) { mdConsume("charm"); mdLog(`🧿 竜のお守りが${why}を防いだ！（お守りは砕けた）`, "good"); return; }
  MD.hp -= n;
  mdLog(`💥 ${why}！ 体力-${n}`, "bad");
  if (MD.hp <= 0) mdEnd("hp");
}
function mdShard(tier, n) {
  MD.gain.shards[tier] += n;
  mdLog(`${MD_TIER_IC[tier]} ${MD_TIER_LABEL[tier]} ×${n} を手に入れた`, "good");
}
function mdItem() {
  if (MD.items.length >= mdBagMax()) { mdLog("🎒 バッグがいっぱいで諦めた…", "bad"); return; }
  const pool = MD_ITEMS.filter(i => !mdHas(i.id));
  if (!pool.length) { mdLog("🎒 めぼしい物はなかった", ""); return; }
  const it = mdPick(pool);
  MD.items.push(it);
  mdLog(`${it.ic} アクセ「${it.n}」を拾った — ${it.d}`, "good");
}

// ── 部屋の解決（選択→結果。シナジーはここで判定）
function mdEnter(room) {
  if (!MD || MD.over) return;
  switch (room.id) {
    case "fashion": {
      const n = 1 + (Math.random() < 0.4 ? 1 : 0) + (mdHas("magnet") ? 1 : 0);
      mdShard(mdShardTier(MD.f), n);
      if (Math.random() < 0.30 && !mdHas("gloves")) mdHurt(1, "動くマネキンにぶつかった");
      else if (mdHas("gloves") && Math.random() < 0.30) mdLog("🧤 軍手のおかげでマネキンを受け流した", "good");
      break;
    }
    case "variety": mdItem(); break;
    case "food": {
      const heal = 1;
      MD.hp = Math.min(MD.hpMax, MD.hp + heal);
      mdLog(`🍙 試食コーナーで体力+${heal}`, "good");
      if (Math.random() < 0.25) { MD.gain.medals += 3; mdLog("🪙 レジ下にメダル3枚！", "good"); }
      break;
    }
    case "dark": {
      const safe = mdHas("light");
      if (safe || Math.random() < 0.55) {
        mdShard(MD.f >= 8 ? "l" : "r", 1);
        if (safe && Math.random() < 0.5) mdShard("r", 1);
      } else mdHurt(1, "暗がりで段差にころんだ");
      MD.gauge += 4;
      break;
    }
    case "guard": {
      const meet = Math.random() < (mdHas("bell") ? 0.30 : 0.55);
      MD.gain.medals += 6 + mdRnd(6);
      mdLog("🪙 警備室の引き出しからメダルをたっぷり回収", "good");
      if (meet) {
        if (mdHas("sneaker")) mdLog("👟 警備ロボに見つかったがダッシュで振り切った！", "good");
        else mdHurt(1, "警備ロボに追いつかれた");
      }
      break;
    }
    case "gacha": {
      const d = mdData();
      const cost = d.passives.gacha ? 5 : 10;
      if (mdHas("coupon")) { mdConsume("coupon"); mdGachaRoll(); mdLog("🎟️ クーポンで無料ガチャ！", "good"); }
      else if (MD.gain.medals + 0 >= cost) { MD.gain.medals -= cost; mdGachaRoll(); }
      else mdLog(`🎰 メダル不足（${cost}枚必要）…またこんど`, "");
      break;
    }
    case "rest": {
      const heal = 1 + (mdHas("radio") ? 1 : 0);
      MD.hp = Math.min(MD.hpMax, MD.hp + heal);
      MD.gauge = Math.max(0, MD.gauge - 10);
      mdLog(`🛋️ ひと休み。体力+${heal}・閉店ゲージ-10`, "good");
      break;
    }
  }
  if (MD.over) { renderMallDungeon(); return; }
  MD.mode = "after";
  renderMallDungeon();
}
function mdGachaRoll() {
  const r = Math.random();
  if (r < 0.45) mdItem();
  else if (r < 0.8) mdShard(mdShardTier(MD.f + 3), 1);
  else { MD.gain.medals += 15; mdLog("🎰 大当たり！ メダル15枚！", "good"); }
}

// ── ショーケース（ボス）：3つの鍵から正解を引くと衣装。VIPカードで2回。
function mdBossPick(k) {
  if (!MD || MD.mode !== "boss") return;
  const hitP = 0.34 + Math.min(0.16, MD.f * 0.008);   // 深いほど少し当たりやすい
  const hit = Math.random() < hitP;
  if (hit) {
    const band = MD.f >= 15 ? "l" : (MD.f >= 10 ? "r" : "c");
    const o = mdGrantOutfit(band, MD.f >= 20);
    if (o) {
      MD.gain.outfits.push(o);
      mdLog(`👑 ショーケースが開いた！ 衣装「${o.name}」を手に入れた！！`, "win");
    } else {
      mdShard("l", 2);
      mdLog("👑 ショーケースは空…代わりに金糸のかけら×2", "good");
    }
    MD.boss = null; MD.mode = "after";
  } else {
    MD.boss.tries--;
    if (MD.boss.tries > 0) { mdLog("🔑 鍵が合わない…VIPカードでもう一度！", ""); }
    else {
      mdLog("🚨 鍵を間違えて警報が鳴った！", "bad");
      mdHurt(1, "駆けつけた警備ロボ");
      MD.gauge += 12;
      if (!MD.over) { MD.boss = null; MD.mode = "after"; }
    }
  }
  renderMallDungeon();
}

// ── フロア前進／帰還／終了
function mdNext() {
  if (!MD || MD.over) return;
  MD.f++;
  let inc = 8 + mdRnd(6);
  if (mdHas("watch")) inc = Math.ceil(inc * 0.6);
  MD.gauge += inc;
  if (MD.gauge >= 100) { mdEnd("close"); renderMallDungeon(); return; }
  mdNewDoors();
  renderMallDungeon();
}
function mdLeave() { if (MD && !MD.over) { mdEnd("leave"); renderMallDungeon(); } }
function mdEnd(why) {
  MD.over = why;
  const d = mdData();
  let keep = 1;
  if (why === "close") keep = 0.5;     // 閉店に巻き込まれた＝戦利品半分
  if (why === "hp") keep = 0.3;        // 捕まった＝3割しか持ち帰れない
  const g = MD.gain;
  MD.result = {
    medals: Math.floor(g.medals * keep),
    shards: { c: Math.floor(g.shards.c * keep), r: Math.floor(g.shards.r * keep), l: Math.floor(g.shards.l * keep) },
    outfits: g.outfits, keep, why, f: MD.f,
  };
  d.medals += MD.result.medals;
  d.shards.c += MD.result.shards.c; d.shards.r += MD.result.shards.r; d.shards.l += MD.result.shards.l;
  d.bestF = Math.max(d.bestF || 0, MD.f);
  if (typeof saveGame === "function") saveGame();
}

// ── かけら交換（ハブ）：c×3/r×3/l×3（高級・メルメス除く）/l×6（メルメス）
function mdExchange(tier) {
  const d = mdData();
  const need = tier === "lx" ? 6 : 3;
  const key = tier === "lx" ? "l" : tier;
  if (d.shards[key] < need) return;
  let o = null;
  if (tier === "lx") {
    const m = OUTFITS.find(x => x.id === "mermes");
    if (m && !outfitOwned(m)) { d.shards.l -= 6; if (!state.player.outfitsWon) state.player.outfitsWon = []; state.player.outfitsWon.push("mermes"); d.wins++; o = m; }
  } else {
    const pool = mdOutfitPool(tier).filter(x => x.id !== "mermes");
    if (pool.length) { d.shards[tier] -= 3; o = mdPick(pool); if (!state.player.outfitsWon) state.player.outfitsWon = []; state.player.outfitsWon.push(o.id); d.wins++; }
    else { d.shards[tier] -= 3; d.medals += 40; }   // 帯が全部所持済→メダル40に変換
  }
  if (typeof saveGame === "function") saveGame();
  try { if (o && window.Sfx) Sfx.play("unlock"); } catch (e) {}
  renderMallDungeon(o ? { won: o } : { medal40: !o });
}
function mdBuyPassive(id) {
  const d = mdData(); const ps = MD_PASSIVES.find(x => x.id === id);
  if (!ps || d.passives[id] || d.medals < ps.cost) return;
  d.medals -= ps.cost; d.passives[id] = 1;
  if (typeof saveGame === "function") saveGame();
  renderMallDungeon();
}

// =========================================================================
// 画面
// =========================================================================
function renderMallDungeon(flash) {
  state.ui.screen = "mall_dungeon";
  if (window.Dialogue && Dialogue.dismiss) Dialogue.dismiss();
  const app = beginScreen();
  const d = mdData();

  // ラン中＝ランUI / それ以外＝ハブ
  if (MD && !MD.over) { mdRenderRun(app); return; }
  if (MD && MD.over) { mdRenderResult(app); return; }

  app.appendChild(el("h2", null, "🗼 モールお買い物ダンジョン"));
  app.appendChild(el("div", "as-hint2", `閉店後のモールを探索するミニゲーム　<span class="as-hint">レース・コインには影響しません</span>`));

  const st = el("div", "md-stats");
  st.innerHTML =
    `<span class="md-chip">🪙 メダル <b>${d.medals}</b></span>` +
    `<span class="md-chip">🧵 <b>${d.shards.c}</b></span><span class="md-chip">🪡 <b>${d.shards.r}</b></span><span class="md-chip">✨ <b>${d.shards.l}</b></span>` +
    `<span class="md-chip">🏆 最深 <b>B${d.bestF || 0}F</b></span><span class="md-chip">👗 入手 <b>${d.wins || 0}</b></span>`;
  app.appendChild(st);

  if (flash && flash.won) app.appendChild(el("div", "md-flash win", `👑 衣装「${flash.won.name}」を手に入れた！ モールで着られるよ`));
  if (flash && flash.medal40) app.appendChild(el("div", "md-flash", `その帯の衣装はぜんぶ持ってた！ → メダル40枚に変換`));

  const start = el("button", "md-start", "🛒 ダンジョンへ潜る ▶");
  start.onclick = () => mdStart();
  app.appendChild(start);

  // かけら交換
  const ex = el("div", "md-box");
  ex.innerHTML = `<div class="md-box-t">🧶 かけら交換（未所持の衣装からランダム）</div>`;
  const exg = el("div", "md-exgrid");
  [["c", "🧵×3 → ふつう衣装", d.shards.c >= 3], ["r", "🪡×3 → レア衣装", d.shards.r >= 3],
   ["l", "✨×3 → 高級衣装", d.shards.l >= 3], ["lx", "✨×6 → メルメス", d.shards.l >= 6 && !outfitOwned(outfitById("mermes"))]]
    .forEach(([t, label, ok]) => {
      const b = el("button", "md-exbtn" + (ok ? "" : " off"), label);
      b.disabled = !ok; b.onclick = () => mdExchange(t);
      exg.appendChild(b);
    });
  ex.appendChild(exg);
  app.appendChild(ex);

  // 恒常強化
  const ps = el("div", "md-box");
  ps.innerHTML = `<div class="md-box-t">🪙 メダルで恒常強化（買い切り）</div>`;
  const pg = el("div", "md-psgrid");
  MD_PASSIVES.forEach(s => {
    const got = !!d.passives[s.id];
    const b = el("button", "md-ps" + (got ? " got" : (d.medals >= s.cost ? "" : " off")));
    b.innerHTML = `<span class="ic">${s.ic}</span><span class="tx"><b>${s.n}</b><small>${s.d}</small></span><span class="cost">${got ? "✓" : s.cost}</span>`;
    b.disabled = got || d.medals < s.cost;
    b.onclick = () => mdBuyPassive(s.id);
    pg.appendChild(b);
  });
  ps.appendChild(pg);
  app.appendChild(ps);

  const how = el("details", "md-how");
  how.innerHTML = `<summary>📖 遊び方</summary><div>3つのドアからひとつ選んで探索。<b>閉店ゲージが100%になる前に帰ろう</b>（巻き込まれると戦利品半分・つかまると3割）。アクセを組み合わせて深く潜り、<b>5フロアごとのショーケース</b>で衣装を狙おう。かけらは交換でも衣装になる。</div>`;
  app.appendChild(how);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← モールへ戻る"); back.onclick = () => renderMall();
  actions.appendChild(back);
  app.appendChild(actions);
}

function mdRenderRun(app) {
  const hearts = "❤️".repeat(MD.hp) + "🖤".repeat(Math.max(0, MD.hpMax - MD.hp));
  const head = el("div", "md-runhead");
  head.innerHTML =
    `<span class="md-chip big">🗼 B<b>${MD.f}</b>F</span>` +
    `<span class="md-chip">${hearts}</span>` +
    `<span class="md-chip">🎒 ${MD.items.length}/${mdBagMax()}</span>` +
    `<span class="md-chip">🪙 ${MD.gain.medals}</span>` +
    `<span class="md-chip">🧵${MD.gain.shards.c} 🪡${MD.gain.shards.r} ✨${MD.gain.shards.l}</span>`;
  app.appendChild(head);

  const gg = el("div", "md-gauge");
  const pct = Math.max(0, Math.min(100, MD.gauge));
  gg.innerHTML = `<span class="t">🌙 閉店ゲージ</span><span class="bar"><span style="width:${pct}%"></span></span><b>${pct}%</b>`;
  app.appendChild(gg);

  // ドア / ボス / 結果後
  if (MD.mode === "doors") {
    app.appendChild(el("div", "md-ask", "どのドアから探索する？"));
    const ds = el("div", "md-doors");
    MD.doors.forEach(r => {
      const b = el("button", "md-door");
      b.innerHTML = `<span class="ic">${r.ic}</span><b>${r.n}</b><small>${mdHas("map") ? r.hint : "？？？"}</small>`;
      b.onclick = () => mdEnter(r);
      ds.appendChild(b);
    });
    app.appendChild(ds);
  } else if (MD.mode === "boss") {
    app.appendChild(el("div", "md-ask boss", `👔 フロアマネージャーのショーケース！ 鍵は3本 — 当たりはひとつ${MD.boss.tries > 1 ? "（VIP：2回選べる）" : ""}`));
    const ds = el("div", "md-doors");
    ["🗝️", "🗝️", "🗝️"].forEach((k, i) => {
      const b = el("button", "md-door key");
      b.innerHTML = `<span class="ic">${k}</span><b>鍵 ${i + 1}</b><small>ショーケースを開ける</small>`;
      b.onclick = () => mdBossPick(i);
      ds.appendChild(b);
    });
    app.appendChild(ds);
  } else {   // after
    const row = el("div", "md-next");
    const nx = el("button", "md-go", `▼ さらに潜る（B${MD.f + 1}Fへ・閉店+8〜13%）`);
    nx.onclick = () => mdNext();
    const lv = el("button", "md-leavebtn", "🛗 エレベーターで帰る（戦利品ぜんぶ持ち帰り）");
    lv.onclick = () => mdLeave();
    row.appendChild(nx); row.appendChild(lv);
    app.appendChild(row);
  }

  // ログ
  const lg = el("div", "md-log");
  MD.log.forEach(L => lg.appendChild(el("div", "md-logline " + L.cls, L.t)));
  if (!MD.log.length) lg.appendChild(el("div", "md-logline", "閉店後のモールはしんと静か……"));
  app.appendChild(lg);

  // 所持アクセ
  if (MD.items.length) {
    const iv = el("div", "md-items");
    MD.items.forEach(i => iv.appendChild(el("span", "md-item", `${i.ic} ${i.n}`)));
    app.appendChild(iv);
  }

  const actions = el("div", "actions");
  const giveup = el("button", "secondary", "✕ 探索をやめる（持ち帰りは半分）");
  giveup.onclick = () => { if (confirm("探索をやめますか？（エレベーター以外からの退店＝戦利品半分）")) { mdEnd("close"); renderMallDungeon(); } };
  actions.appendChild(giveup);
  app.appendChild(actions);
}

function mdRenderResult(app) {
  const r = MD.result;
  const why = { leave: "🛗 ぶじ帰還！", close: "🌙 閉店に巻き込まれた…（戦利品半分）", hp: "🚨 警備につかまった…（戦利品3割）" }[r.why];
  app.appendChild(el("h2", null, "🗼 探索結果"));
  const box = el("div", "md-resbox " + (r.why === "leave" ? "good" : "bad"));
  box.innerHTML =
    `<div class="md-res-why">${why}</div>` +
    `<div class="md-res-f">到達 B${r.f}F</div>` +
    `<div class="md-res-loot">🪙×${r.medals}　🧵×${r.shards.c}　🪡×${r.shards.r}　✨×${r.shards.l}</div>` +
    (r.outfits.length ? `<div class="md-res-outfit">👑 衣装：${r.outfits.map(o => "「" + o.name + "」").join("・")}（没収されない！）</div>` : "");
  app.appendChild(box);
  const again = el("button", "md-start", "🛒 もう一度潜る ▶");
  again.onclick = () => mdStart();
  app.appendChild(again);
  const actions = el("div", "actions");
  const hub = el("button", "secondary", "← ダンジョン入口へ"); hub.onclick = () => { MD = null; renderMallDungeon(); };
  const mall = el("button", "secondary", "🛍️ モールへ"); mall.onclick = () => { MD = null; renderMall(); };
  actions.appendChild(hub); actions.appendChild(mall);
  app.appendChild(actions);
}
