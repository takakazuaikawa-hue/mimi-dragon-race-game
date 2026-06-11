// =========================================================================
// 🏝️ リゾートモール探検 — モール内ミニゲーム（昼間のお買い物デー）
// 島の巨大リゾートモールを開店から閉店まで自由に歩き回る。フロアを移動し、実名の店をのぞき、
// 館内放送のフィーバーに駆けつけ、スタンプを集めて閉店前の景品抽選で衣装を狙う。
// 罰やダメージは無し＝「時間内にどれだけ回れるか」「今日はどの店が熱いか」のわくわくが核。
// ★完全に表示メタ：着順・オッズ・配当・コインには一切干渉しない（[[race-math-immutable]]）。
// 永続: state.player.dungeon = {medals, shards:{c,r,l}, passives:{}, bestF(=最多スタンプ), runs, wins}
//       state.player.outfitsWon = [outfitId...]（outfitOwnedが参照）
// =========================================================================

let MD = null;   // 進行中のお買い物デー（永続は state.player.dungeon のみ）

function mdData() {
  if (!state.player.dungeon) state.player.dungeon = { medals: 0, shards: { c: 0, r: 0, l: 0 }, passives: {}, bestF: 0, runs: 0, wins: 0 };
  const d = state.player.dungeon;
  if (!d.shards) d.shards = { c: 0, r: 0, l: 0 };
  if (!d.passives) d.passives = {};
  return d;
}
function mdRnd(n) { return Math.floor(Math.random() * n); }
function mdPick(a) { return a[mdRnd(a.length)]; }
function mdLuck(p) { return Math.random() < p + (MD ? MD.tension * 0.04 : 0); }   // テンションが運を底上げ

// ── アクセ（その日限りの持ち物。ビルド要素）
const MD_ITEMS = [
  { id: "sneaker", ic: "👟", n: "歩きやすい靴",   d: "フロア移動の時間ゼロ" },
  { id: "card",    ic: "💳", n: "ポイントカード", d: "お店でもらえるメダル+1" },
  { id: "map",     ic: "🗺️", n: "館内図",         d: "全フロアのセール/行列が見える" },
  { id: "watch",   ic: "⌚", n: "腕時計",         d: "行列に並ばずスイスイ" },
  { id: "eye",     ic: "🧐", n: "お買い物上手",   d: "かけらの獲得+1" },
  { id: "charm",   ic: "🧿", n: "竜のお守り",     d: "はずれを1回だけ当たりに（消費）" },
  { id: "coupon",  ic: "🎟️", n: "ガチャ無料券",   d: "ガチャが1回タダ（消費）" },
  { id: "vip",     ic: "✨", n: "VIP会員証",      d: "閉店前の抽選で2回引ける" },
  { id: "ecobag",  ic: "🛍️", n: "エコバッグ",     d: "持ち物の枠+2" },
  { id: "gourmet", ic: "📖", n: "グルメ手帳",     d: "食べ物のテンション+1" },
  { id: "radio",   ic: "📻", n: "小型ラジオ",     d: "フィーバーが長持ちする" },
  { id: "fan",     ic: "🪭", n: "リゾートうちわ", d: "テンションが下がらない気がする（お守り）" },
];
function mdHas(id) { return MD && MD.items.some(i => i.id === id); }
function mdConsume(id) { const i = MD.items.findIndex(x => x.id === id); if (i >= 0) MD.items.splice(i, 1); }
function mdBagMax() { return 4 + (mdData().passives.bag ? 2 : 0) + (mdHas("ecobag") ? 2 : 0); }

// ── お店（島の巨大リゾートモール・実名）。f=フロア
const MD_SHOPS = [
  { id: "bakery",  f: 1, ic: "🥖", n: "ドラゴベーカリー",   tag: "焼きたての匂い" },
  { id: "cafe",    f: 1, ic: "☕", n: "海風テラスカフェ",   tag: "波の音とラテ" },
  { id: "info",    f: 1, ic: "ℹ️", n: "観光案内所",         tag: "島の情報ならここ" },
  { id: "boutique",f: 2, ic: "👗", n: "バニーブティック",   tag: "新作ぞくぞく" },
  { id: "vintage", f: 2, ic: "👒", n: "古着屋ふるどら",     tag: "ワゴンに掘り出し物" },
  { id: "acc",     f: 2, ic: "💍", n: "アクセ「竜の鱗」",   tag: "きらきら" },
  { id: "gacha",   f: 3, ic: "🎰", n: "ガチャガチャの森",   tag: "回したら止まらない" },
  { id: "game",    f: 3, ic: "🕹️", n: "ゲームコーナー",     tag: "景品ねらい" },
  { id: "zakka",   f: 3, ic: "🧸", n: "雑貨りゅうの夜店",   tag: "ふしぎな品ぞろえ" },
  { id: "food",    f: 4, ic: "🍜", n: "島めしフードコート", tag: "名物・竜骨ラーメン" },
  { id: "soft",    f: 4, ic: "🍦", n: "ソフト竜の渦巻き",   tag: "映えの聖地" },
  { id: "yatai",   f: 4, ic: "🍡", n: "屋台ストリート",     tag: "食べ歩き天国" },
  { id: "event",   f: 5, ic: "🎡", n: "屋上イベント広場",   tag: "日替わり開催" },
  { id: "garden",  f: 5, ic: "🌺", n: "展望ガーデン",       tag: "島がぜんぶ見える" },
];
const MD_FLOORS = [[1, "1F"], [2, "2F"], [3, "3F"], [4, "4F"], [5, "RF"]];

const MD_TIER_LABEL = { c: "布のかけら", r: "銀糸のかけら", l: "金糸のかけら" };
const MD_TIER_IC = { c: "🧵", r: "🪡", l: "✨" };
function mdShardTier() { const r = Math.random(); return r < 0.6 ? "c" : (r < 0.9 ? "r" : "l"); }

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

// ── 恒常強化（モールメダル・買い切り。idは旧版から維持＝購入済みを引き継ぐ）
const MD_PASSIVES = [
  { id: "hp",    ic: "👟", n: "履きなれた靴",   d: "閉店まで+45分ぶん回れる", cost: 80 },
  { id: "slow",  ic: "🌅", n: "開店ダッシュ",   d: "朝イチ入店でさらに+45分", cost: 120 },
  { id: "bag",   ic: "🎒", n: "大きなリュック", d: "持ち物の枠+2",            cost: 60 },
  { id: "start", ic: "🎁", n: "モール会員証",   d: "持ち物1つ持ってスタート", cost: 100 },
  { id: "gacha", ic: "🪙", n: "ガチャ常連",     d: "ガチャ費用が半額",        cost: 90 },
];

// ── お買い物デー開始
function mdStart() {
  const d = mdData();
  d.runs++;
  let closeAt = 480 + (d.passives.hp ? 45 : 0) + (d.passives.slow ? 45 : 0);   // 10:00起点・基本8時間
  MD = {
    t: 0, closeAt, floor: 1, tension: 0,
    items: [], stamps: [], log: [],
    gain: { medals: 0, shards: { c: 0, r: 0, l: 0 }, outfits: [] },
    sale: mdPick(MD_SHOPS).id,                    // 今日のセール店（報酬2倍）
    queue: mdPick(MD_SHOPS).id,                   // 行列店（+20分。腕時計で回避）
    fever: null, feverUntil: 0,                   // 館内放送フィーバー
    rumor: null, mode: "map", shop: null, lottery: null, over: null,
  };
  if (d.passives.start) MD.items.push(mdPick(MD_ITEMS.filter(i => !["charm", "coupon", "vip"].includes(i.id))));
  mdLog("🏝️ リゾートモール開店！ きょうはどこから回ろう？", "good");
  if (typeof saveGame === "function") saveGame();
  renderMallDungeon();
}
function mdClock() { const m = 600 + MD.t; return Math.floor(m / 60) + ":" + ("0" + (m % 60)).slice(-2); }
function mdLog(t, cls) { MD.log.unshift({ t, cls: cls || "" }); MD.log = MD.log.slice(0, 4); }
function mdTension(n) { MD.tension = Math.max(0, Math.min(5, MD.tension + n)); }
function mdMedal(n) { if (n > 0 && mdHas("card")) n += 1; MD.gain.medals += n; }
function mdShard(tier, n) {
  if (mdHas("eye")) n += 1;
  if (MD.fever === MD.shop || MD.sale === MD.shop) n *= 2;
  MD.gain.shards[tier] += n;
  mdLog(`${MD_TIER_IC[tier]} ${MD_TIER_LABEL[tier]} ×${n}！`, "good");
}
function mdItem() {
  if (MD.items.length >= mdBagMax()) { mdLog("🎒 バッグがいっぱい…泣く泣く諦めた", ""); return; }
  const pool = MD_ITEMS.filter(i => !mdHas(i.id));
  if (!pool.length) return;
  const it = mdPick(pool);
  MD.items.push(it);
  mdLog(`${it.ic} 「${it.n}」を手に入れた — ${it.d}`, "good");
}
function mdSpend(min) {
  MD.t += min;
  // 館内放送：たまに鳴る（フィーバー＝その店の報酬2倍）
  if (!MD.over && Math.random() < 0.3) {
    const s = mdPick(MD_SHOPS);
    MD.fever = s.id; MD.feverUntil = MD.t + (mdHas("radio") ? 150 : 90);
    mdLog(`📢「ただいま ${MD_FLOORS[s.f - 1][1]} ${s.n} にてフィーバー開催中！」`, "fever");
  }
  if (MD.fever && MD.t > MD.feverUntil) MD.fever = null;
  if (MD.t >= MD.closeAt) mdEnd();
}

// ── 移動と来店
function mdGoFloor(f) {
  if (!MD || MD.over || MD.floor === f) return;
  MD.floor = f;
  mdSpend(mdHas("sneaker") ? 0 : 15);
  renderMallDungeon();
}
function mdVisit(id) {
  if (!MD || MD.over) return;
  const s = MD_SHOPS.find(x => x.id === id);
  if (!s) return;
  MD.shop = id;
  let cost = 45;
  if (MD.queue === id && !mdHas("watch")) { cost += 20; mdLog("🚶 行列に並んだ…（+20分）", ""); }
  if (MD.stamps.indexOf(id) < 0) { MD.stamps.push(id); mdLog(`🎫 スタンプGET！（${MD.stamps.length}個目）`, "good"); }
  MD.mode = "shop"; MD._cost = cost;
  renderMallDungeon();
}

// ── 各店の選択肢（2〜3択・ぜんぶ前向き＝失敗してもちょっと楽しい）
function mdChoices(id) {
  const d = mdData();
  const gachaCost = d.passives.gacha ? 5 : 10;
  const C = {
    bakery: [
      ["🍞 焼きたてを試食する", "テンションUP", () => { mdTension(1 + (mdHas("gourmet") ? 1 : 0)); mdLog("🥖 はふはふ…！ テンションUP！", "good"); }],
      ["🐲 限定ドラゴンメロンパン（🪙4）", "ごほうび", () => { if (MD.gain.medals >= 4) { mdMedal(-4); mdTension(2); mdLog("🐲 もちもち…しあわせ…！", "good"); } else mdLog("🪙 メダルが足りなかった…", ""); }],
      ["💬 店主とおしゃべり", "うわさ話", () => { const s = mdPick(MD_SHOPS); MD.rumor = s.id; mdLog(`💬「${s.n}に掘り出し物が出てたよ」`, "good"); }],
    ],
    cafe: [
      ["☕ 海を見ながらひと息", "テンションUP", () => { mdTension(2); mdLog("🌊 波の音…さいこう…", "good"); }],
      ["🍰 季節のケーキセット（🪙3）", "ちいさな幸せ", () => { if (MD.gain.medals >= 3) { mdMedal(-3); mdTension(1); mdShard("c", 1); } else mdLog("🪙 メダルが足りない…", ""); }],
    ],
    info: [
      ["🗺️ 館内図をもらう", "便利", () => { if (!mdHas("map")) { MD.items.push(MD_ITEMS.find(i => i.id === "map")); mdLog("🗺️ 館内図GET！ セールが見える！", "good"); } else { mdMedal(2); mdLog("🪙 アンケートに答えてメダル2枚", "good"); } }],
      ["🎁 観光福引きにちょうせん", "運だめし", () => { if (mdLuck(0.4)) { mdMedal(5); mdLog("🎁 あたり！ メダル5枚！", "good"); } else { mdTension(1); mdLog("🎁 ポケットティッシュだった（なごみ）", ""); } }],
    ],
    boutique: [
      ["👗 試着チャレンジ", "かけらの本命", () => { if (mdLuck(0.5)) mdShard(mdShardTier(), 1 + (mdLuck(0.3) ? 1 : 0)); else { mdTension(1); mdLog("👗 迷いに迷って時間切れ…でも楽しい", ""); } }],
      ["🪞 新作をうっとり眺める", "目の保養", () => { mdTension(1); if (mdLuck(0.15)) mdShard("r", 1); else mdLog("🪞 ためいきが出るかわいさ…", "good"); }],
    ],
    vintage: [
      ["🧺 ワゴンを漁る", "掘り出し物", () => { const hot = MD.rumor === "vintage"; if (hot || mdLuck(0.45)) { mdShard(hot ? "r" : "c", 1); MD.rumor = null; } else mdItem(); }],
      ["👒 帽子を試す", "にあう？", () => { mdTension(1); mdLog("👒 店主『にあうねえ！』 えへへ", "good"); }],
    ],
    acc: [
      ["💍 アクセを買う（🪙6）", "持ち物GET", () => { if (MD.gain.medals >= 6) { mdMedal(-6); mdItem(); } else mdLog("🪙 メダルが足りない…", ""); }],
      ["✨ ショーケースを見るだけ", "タダ", () => { if (mdLuck(0.12)) { mdShard("r", 1); mdLog("✨ 端切れをおまけしてもらった！", "good"); } else mdLog("✨ きらきら…目が幸せ", ""); }],
    ],
    gacha: [
      [`🎰 ガチャを回す（🪙${gachaCost}）`, "なにが出るかな", () => {
        if (mdHas("coupon")) { mdConsume("coupon"); mdLog("🎟️ 無料券を使った！", "good"); }
        else if (MD.gain.medals >= gachaCost) mdMedal(-gachaCost);
        else { mdLog("🪙 メダルが足りない…", ""); return; }
        const r = Math.random();
        if (r < 0.45) mdItem(); else if (r < 0.8) mdShard(mdShardTier(), 1); else { mdMedal(15); mdLog("🎰 大当たり！ メダル15枚！", "good"); }
      }],
      ["👀 人の回すのを見守る", "ドキドキ", () => { mdTension(1); mdLog("👀 となりの子が大当たりしてた！", ""); }],
    ],
    game: [
      ["🕹️ クレーンゲーム（🪙3）", "景品ねらい", () => { if (MD.gain.medals < 3) { mdLog("🪙 メダルが足りない…", ""); return; } mdMedal(-3); if (mdLuck(0.4)) { Math.random() < 0.5 ? mdItem() : mdShard("c", 1); } else { mdTension(1); mdLog("🕹️ おしい！ でも楽しい！", ""); } }],
      ["🏆 ハイスコアに挑戦", "腕前", () => { if (mdLuck(0.3)) { mdMedal(8); mdLog("🏆 ランキング1位！ メダル8枚！", "good"); } else { mdTension(1); mdLog("🏆 あと一歩！", ""); } }],
    ],
    zakka: [
      ["🧸 ふしぎな棚をさがす", "掘り出し物", () => { const hot = MD.rumor === "zakka"; if (hot || mdLuck(0.4)) { mdShard(hot ? "r" : "c", 1); MD.rumor = null; } else { mdTension(1); mdLog("🧸 へんてこな置物と目が合った", ""); } }],
      ["🐉 竜のお守りを買う（🪙5）", "保険", () => { if (MD.gain.medals >= 5 && !mdHas("charm")) { mdMedal(-5); MD.items.push(MD_ITEMS.find(i => i.id === "charm")); mdLog("🧿 お守りGET！", "good"); } else mdLog("🪙 買えなかった…", ""); }],
    ],
    food: [
      ["🍜 名物・竜骨ラーメン（🪙3）", "うまい", () => { if (MD.gain.medals >= 3) { mdMedal(-3); mdTension(2 + (mdHas("gourmet") ? 1 : 0)); mdLog("🍜 ずぞぞ…五臓六腑にしみる…", "good"); } else mdLog("🪙 メダルが足りない…", ""); }],
      ["🔥 大盛りチャレンジ", "テンション3以上", () => { if (MD.tension < 3) { mdLog("🔥 今日はおなかが受け付けない…", ""); return; } if (mdLuck(0.45)) { mdMedal(10); mdLog("🔥 完食！ 賞金メダル10枚！！", "good"); } else { mdTension(-1); mdLog("🔥 ざんねん…おなかいっぱい", ""); } }],
    ],
    soft: [
      ["🍦 渦巻きソフトを食べる", "映え", () => { mdTension(1 + (mdHas("gourmet") ? 1 : 0)); mdLog("🍦 ひんやりあまい〜！", "good"); }],
      ["📸 映え写真を撮る", "いいねがつく", () => { if (mdLuck(0.5)) { mdMedal(4); mdLog("📸 バズった！ お祝いメダル4枚", "good"); } else mdLog("📸 とれ高はいまいち…でもかわいい", ""); }],
    ],
    yatai: [
      ["🍡 はしご食べ歩き（🪙2）", "とまらない", () => { if (MD.gain.medals >= 2) { mdMedal(-2); mdTension(2); mdLog("🍡 もぐもぐ…足が止まらない！", "good"); } else mdLog("🪙 メダルが足りない…", ""); }],
      ["✊ 屋台のじゃんけん大会", "倍率ドン", () => { if (mdLuck(0.5)) { mdMedal(6); mdLog("✊ 3連勝！ メダル6枚！", "good"); } else { mdTension(1); mdLog("✊ まけたー！ でも盛り上がった", ""); } }],
    ],
    event: [
      ["🎡 日替わりイベントに参加", "今日はなに？", () => {
        const ev = mdPick(["show", "flea", "bingo"]);
        if (ev === "show") { mdTension(2); mdLog("🐲 竜の曲芸ショー！ 大歓声！", "good"); }
        else if (ev === "flea") { mdItem(); mdLog("🧺 屋上フリマを物色！", "good"); }
        else { if (mdLuck(0.5)) { mdMedal(8); mdLog("🎱 ビンゴ！ メダル8枚！", "good"); } else mdLog("🎱 リーチ止まり…！", ""); }
      }],
      ["🎫 スタンプ台を探す", "ラリー用", () => { mdMedal(2); mdLog("🎫 記念スタンプぽんっ。メダル2枚", "good"); }],
    ],
    garden: [
      ["🌺 島を一望してのびをする", "リフレッシュ", () => { mdTension(2); MD.t = Math.max(0, MD.t - 15); mdLog("🌺 ふう…時間がゆっくり流れる（-15分）", "good"); }],
      ["🔭 望遠鏡をのぞく（🪙1）", "なにか見える", () => { if (MD.gain.medals >= 1) { mdMedal(-1); const s = mdPick(MD_SHOPS); MD.rumor = s.id; mdLog(`🔭 ${s.n} がにぎわってるのが見えた！`, "good"); } else mdLog("🪙 メダルが…", ""); }],
    ],
  };
  return C[id] || [];
}
function mdChoice(i) {
  if (!MD || MD.mode !== "shop") return;
  const ch = mdChoices(MD.shop)[i];
  if (!ch) return;
  ch[2]();
  const cost = MD._cost || 45;
  MD.mode = "map"; MD.shop = null;
  mdSpend(cost);
  renderMallDungeon();
}
function mdShopBack() { if (MD && MD.mode === "shop") { MD.mode = "map"; MD.shop = null; renderMallDungeon(); } }

// ── 閉店（or 早帰り）→ スタンプ抽選 → 結果。昼のモールに没収なし＝ぜんぶ持ち帰り。
function mdLeave() { if (MD && !MD.over) { mdEnd(); renderMallDungeon(); } }
function mdEnd() {
  MD.over = true;
  const d = mdData();
  d.medals += MD.gain.medals;
  d.shards.c += MD.gain.shards.c; d.shards.r += MD.gain.shards.r; d.shards.l += MD.gain.shards.l;
  d.bestF = Math.max(d.bestF || 0, MD.stamps.length);
  MD.mode = (MD.stamps.length >= 6) ? "lottery" : "result";
  if (MD.mode === "lottery") MD.lottery = { tries: mdHas("vip") ? 2 : 1 };
  if (typeof saveGame === "function") saveGame();
}
function mdLottery(i) {
  if (!MD || MD.mode !== "lottery") return;
  const n = MD.stamps.length;
  const band = n >= 10 ? "l" : (n >= 8 ? "r" : "c");
  let hit = mdLuck(0.38);
  if (!hit && mdHas("charm")) { mdConsume("charm"); hit = true; mdLog("🧿 お守りが光った！", "good"); }
  if (hit) {
    const o = mdGrantOutfit(band, n >= 12);
    if (o) { MD.gain.outfits.push(o); mdLog(`👑 大当たり！ 衣装「${o.name}」！！`, "win"); }
    else { const d = mdData(); d.shards.l += 2; mdLog("👑 当たり！…でも在庫切れ→✨金糸のかけら×2", "good"); }
    MD.mode = "result";
  } else {
    MD.lottery.tries--;
    if (MD.lottery.tries > 0) mdLog("🎁 はずれ…VIP会員はもう1回！", "");
    else { const d = mdData(); d.shards[band] += 1; if (typeof saveGame === "function") saveGame(); mdLog(`🎁 残念賞：${MD_TIER_IC[band]}かけら×1`, "good"); MD.mode = "result"; }
  }
  if (typeof saveGame === "function") saveGame();
  renderMallDungeon();
}

// ── かけら交換／恒常強化（ハブ）
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
    else { d.shards[tier] -= 3; d.medals += 40; }
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
  if (MD && !MD.over) { mdRenderDay(app); return; }
  if (MD && MD.over && MD.mode === "lottery") { mdRenderLottery(app); return; }
  if (MD && MD.over) { mdRenderResult(app); return; }

  // ── ハブ
  app.appendChild(el("h2", null, "🏝️ リゾートモール探検"));
  app.appendChild(el("div", "as-hint2", `島いちばんの巨大モールでお買い物デー　<span class="as-hint">レース・コインには影響しません</span>`));
  const st = el("div", "md-stats");
  st.innerHTML =
    `<span class="md-chip">🪙 メダル <b>${d.medals}</b></span>` +
    `<span class="md-chip">🧵<b>${d.shards.c}</b></span><span class="md-chip">🪡<b>${d.shards.r}</b></span><span class="md-chip">✨<b>${d.shards.l}</b></span>` +
    `<span class="md-chip">🎫 最多スタンプ <b>${d.bestF || 0}</b></span><span class="md-chip">👗 入手 <b>${d.wins || 0}</b></span>`;
  app.appendChild(st);
  if (flash && flash.won) app.appendChild(el("div", "md-flash win", `👑 衣装「${flash.won.name}」を手に入れた！ モールで着られるよ`));
  if (flash && flash.medal40) app.appendChild(el("div", "md-flash", `その帯の衣装はぜんぶ持ってた！ → メダル40枚に変換`));
  const start = el("button", "md-start", "🛍️ お買い物デーへ出発 ▶");
  start.onclick = () => mdStart();
  app.appendChild(start);

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

  const ps = el("div", "md-box");
  ps.innerHTML = `<div class="md-box-t">🪙 メダルで常連特典（買い切り）</div>`;
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
  how.innerHTML = `<summary>📖 遊び方</summary><div>開店10:00〜閉店18:00、お店をめぐって<b>かけら・メダル・スタンプ</b>を集めよう。📢館内放送のフィーバー店は報酬2倍！ <b>スタンプ6個以上で閉店前の景品抽選</b>（多いほど豪華・10個で高級衣装帯）。テンション⭐が高いと運もアップ。没収は無し＝ぜんぶ持ち帰り。</div>`;
  app.appendChild(how);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← モールへ戻る"); back.onclick = () => renderMall();
  actions.appendChild(back);
  app.appendChild(actions);
}

function mdRenderDay(app) {
  // 時計＋テンション＋持ち物チップ
  const head = el("div", "md-runhead");
  head.innerHTML =
    `<span class="md-chip big">🕐 <b>${mdClock()}</b><small>／閉店${Math.floor((600 + MD.closeAt) / 60)}:00</small></span>` +
    `<span class="md-chip">⭐${MD.tension}<small>テンション</small></span>` +
    `<span class="md-chip">🎫<b>${MD.stamps.length}</b></span>` +
    `<span class="md-chip">🪙<b>${MD.gain.medals}</b></span>` +
    `<span class="md-chip">🧵${MD.gain.shards.c} 🪡${MD.gain.shards.r} ✨${MD.gain.shards.l}</span>`;
  app.appendChild(head);
  const gg = el("div", "md-gauge");
  const pct = Math.min(100, Math.round(MD.t / MD.closeAt * 100));
  gg.innerHTML = `<span class="t">⏳ 営業時間</span><span class="bar"><span style="width:${pct}%"></span></span><b>${pct}%</b>`;
  app.appendChild(gg);

  if (MD.mode === "shop") {
    const s = MD_SHOPS.find(x => x.id === MD.shop);
    app.appendChild(el("div", "md-ask", `${s.ic} ${s.n} — ${s.tag}`));
    const ds = el("div", "md-choices");
    mdChoices(s.id).forEach((c, i) => {
      const b = el("button", "md-choice");
      b.innerHTML = `<b>${c[0]}</b><small>${c[1]}</small>`;
      b.onclick = () => mdChoice(i);
      ds.appendChild(b);
    });
    const back = el("button", "md-choice back", "<b>↩ 店を出る</b><small>時間は使わない</small>");
    back.onclick = () => mdShopBack();
    ds.appendChild(back);
    app.appendChild(ds);
  } else {
    // 館内図：フロアタブ＋その階の店カード（バッジ＝セール/行列/フィーバー/うわさ/✓）
    const tabs = el("div", "md-tabs");
    MD_FLOORS.forEach(([f, label]) => {
      const b = el("button", "md-tab" + (MD.floor === f ? " on" : ""), label);
      b.onclick = () => mdGoFloor(f);
      tabs.appendChild(b);
    });
    app.appendChild(tabs);
    const ds = el("div", "md-doors");
    MD_SHOPS.filter(s => s.f === MD.floor).forEach(s => {
      const fever = MD.fever === s.id, sale = MD.sale === s.id, q = MD.queue === s.id, done = MD.stamps.indexOf(s.id) >= 0;
      let badge = "";
      if (fever) badge = `<span class="md-badge fever">📢 フィーバー!</span>`;
      else if (sale) badge = `<span class="md-badge sale">SALE 2倍</span>`;
      else if (q && !mdHas("watch")) badge = `<span class="md-badge queue">行列</span>`;
      else if (MD.rumor === s.id) badge = `<span class="md-badge rumor">うわさ</span>`;
      const b = el("button", "md-door shop");
      b.innerHTML = `${badge}<span class="ic">${s.ic}</span><b>${s.n}</b><small>${s.tag}${done ? " ・🎫済" : ""}</small>`;
      b.onclick = () => mdVisit(s.id);
      ds.appendChild(b);
    });
    app.appendChild(ds);
    // 他フロアのセール/フィーバー可視化（館内図があれば）
    if (mdHas("map")) {
      const hot = MD_SHOPS.filter(s => s.f !== MD.floor && (MD.fever === s.id || MD.sale === s.id));
      if (hot.length) app.appendChild(el("div", "md-maphint", "🗺️ " + hot.map(s => `${MD_FLOORS[s.f - 1][1]} ${s.n}${MD.fever === s.id ? "📢" : "🏷️"}`).join("　")));
    }
  }

  const lg = el("div", "md-log");
  MD.log.forEach(L => lg.appendChild(el("div", "md-logline " + L.cls, L.t)));
  app.appendChild(lg);
  if (MD.items.length) {
    const iv = el("div", "md-items");
    MD.items.forEach(i => iv.appendChild(el("span", "md-item", `${i.ic} ${i.n}`)));
    app.appendChild(iv);
  }
  const actions = el("div", "actions");
  const lv = el("button", "secondary", "🏠 きょうはここまで（ぜんぶ持ち帰り）");
  lv.onclick = () => mdLeave();
  actions.appendChild(lv);
  app.appendChild(actions);
}

function mdRenderLottery(app) {
  app.appendChild(el("h2", null, "🎁 閉店前・スタンプ景品抽選"));
  app.appendChild(el("div", "md-ask boss", `🎫 スタンプ${MD.stamps.length}個！ 箱はみっつ — 当たれば衣装${MD.lottery.tries > 1 ? "（VIP：2回引ける）" : ""}`));
  const ds = el("div", "md-doors");
  ["🎁", "🎁", "🎁"].forEach((k, i) => {
    const b = el("button", "md-door key");
    b.innerHTML = `<span class="ic">${k}</span><b>はこ ${i + 1}</b><small>ドキドキ…</small>`;
    b.onclick = () => mdLottery(i);
    ds.appendChild(b);
  });
  app.appendChild(ds);
  const lg = el("div", "md-log");
  MD.log.forEach(L => lg.appendChild(el("div", "md-logline " + L.cls, L.t)));
  app.appendChild(lg);
}

function mdRenderResult(app) {
  const g = MD.gain;
  app.appendChild(el("h2", null, "🏝️ きょうのお買い物"));
  const box = el("div", "md-resbox good");
  box.innerHTML =
    `<div class="md-res-why">🌇 たのしかった〜！ また来ようね</div>` +
    `<div class="md-res-f">🎫 スタンプ ${MD.stamps.length}個 ・ ⭐テンション${MD.tension}</div>` +
    `<div class="md-res-loot">🪙×${g.medals}　🧵×${g.shards.c}　🪡×${g.shards.r}　✨×${g.shards.l}</div>` +
    (g.outfits.length ? `<div class="md-res-outfit">👑 衣装：${g.outfits.map(o => "「" + o.name + "」").join("・")}</div>` : "");
  app.appendChild(box);
  const again = el("button", "md-start", "🛍️ あしたも行く ▶");
  again.onclick = () => mdStart();
  app.appendChild(again);
  const actions = el("div", "actions");
  const hub = el("button", "secondary", "← 入口へ"); hub.onclick = () => { MD = null; renderMallDungeon(); };
  const mall = el("button", "secondary", "🛍️ モールへ"); mall.onclick = () => { MD = null; renderMall(); };
  actions.appendChild(hub); actions.appendChild(mall);
  app.appendChild(actions);
}
