// =========================================================================
// 🗝️ モール地下大迷宮 — 一人称ダンジョンRPG（女神転生風・グリッド一人称）
// モール地下に広がる迷宮を1歩ずつ探索。ランダムエンカウントで魔物と戦い、弱点を突いて
// 「もう1回！」を奪い、ボスを倒して衣装を得る。弱点は戦って判明＝魔物図鑑に記録。
// ★表示メタ：着順・オッズ・配当には一切干渉しない（[[race-math-immutable]]）。冒険の報酬は内部通貨ゴールド
//   （消耗品・ガチャに使う）＋衣装(outfitsWon=着替えに反映・無償ドロップ)。★E3通貨統一：お土産ショップの
//   購入だけは所持コイン(state.player.coins)で払う＝経済を一本化（rpgBuyGoods）。それ以外はコイン非干渉。
// 永続: state.player.rpg = {lv,exp,hp,mp,maxhp,maxmp,gold,skills[],items{},cleared,codex{},best{}}
// =========================================================================

let RPG = null;   // 進行中の探索（永続は state.player.rpg）

// ── 永続キャラ（遅延初期化＝state.js非依存・後方互換）
function rpgData() {
  const p = state.player;
  if (!p.rpg) {
    p.rpg = {
      lv: 1, exp: 0, maxhp: 32, maxmp: 18, hp: 32, mp: 18, gold: 0,
      skills: ["atk", "fire", "heal"], items: { potion: 3, ether: 1 },
      cleared: false, codex: {}, best: { lv: 1 }
    };
  }
  const d = p.rpg;
  if (!d.items) d.items = { potion: 0, ether: 0, calm: 0 };
  if (d.items.calm == null) d.items.calm = 0;   // 🔕 静けさのお香（しばらくエンカウントしない）
  if (!d.codex) d.codex = {};
  if (!d.skills) d.skills = ["atk"];
  if (!d.best) d.best = { lv: d.lv || 1 };
  if (d.tickets == null) d.tickets = 2;              // ガチャチケット
  if (!d.records) d.records = { lv: d.lv || 1, floor: d.best.floor || 0, combo: 0, score: 0, pulls: 0, depth: 0 };
  if (d.records.depth == null) d.records.depth = 0;
  if (d.daily == null) d.daily = "";                 // 最終ログボ受取日
  if (d.rep == null) d.rep = 0;                       // ✨みがき（自分磨きの資源）
  if (d.tutSeen == null) d.tutSeen = false;           // 初回の操作ガイド（rpgFx.tutorial）を出したか
  if (!d.up) d.up = {};                               // 自分磨きレベル
  if (!d.shop) d.shop = {};                           // 🛍️ ショッピング・コレクション（買った品）
  return d;
}
// ── ✨ 自分磨き（モール内で完結する恒久成長）：ぼうけんのたびに✨みがきがたまり、つかうとミミが少しずつ成長する
//    ＝「失敗した回も前進」というロゲライトの鉄則＋ゴールドとは別の“使い道のある成長”。世界観＝リゾートで自分を磨く
const RPG_UP = [
  { id: "pow",  ic: "💪", n: "ぱほぱほ特訓", d: "ぱほぱほの威力 +2/Lv",  max: 8, cost: l => 4 + l * 3 },
  { id: "hp",   ic: "🌿", n: "健康づくり",   d: "たいりょく(最大HP) +8/Lv", max: 8, cost: l => 4 + l * 3, stat: { maxhp: 8 } },
  { id: "mp",   ic: "🧘", n: "こころの余裕", d: "集中(最大MP) +4/Lv",   max: 6, cost: l => 4 + l * 3, stat: { maxmp: 4 } },
  { id: "def",  ic: "🎀", n: "身のこなし",   d: "うけるダメージ -6%/Lv", max: 5, cost: l => 6 + l * 4 },
  { id: "luck", ic: "🍀", n: "運気みがき",   d: "おたから運がよくなる",   max: 5, cost: l => 7 + l * 5 },
  { id: "gold", ic: "👛", n: "やりくり上手", d: "ぼうけん開始 +50G/Lv",  max: 5, cost: l => 5 + l * 3 },
];
function rpgUpLv(id) { const d = rpgData(); return (d.up && d.up[id]) || 0; }
function rpgBuyUp(id) {
  const d = rpgData(), def = RPG_UP.find(u => u.id === id); if (!def) return;
  const lv = rpgUpLv(id); if (lv >= def.max) { rpgSfx("tick"); return; }
  const cost = def.cost(lv);
  if ((d.rep || 0) < cost) { rpgSfx("tick"); rpgFx.banner("✨みがきが足りない…", "bad"); return; }
  d.rep -= cost; d.up = d.up || {}; d.up[id] = lv + 1;
  if (def.stat) { if (def.stat.maxhp) { d.maxhp += def.stat.maxhp; d.hp += def.stat.maxhp; } if (def.stat.maxmp) { d.maxmp += def.stat.maxmp; d.mp += def.stat.maxmp; } }
  rpgSfx("unlock"); rpgFx.banner("💖 自分磨き！ " + def.n, "levelup"); rpgSave(); renderMallRpg();
}
// 探索の成果 → ⭐に変換してバンク（leave／気絶／タワー降りのすべてで必ず前進）
function rpgEndRun(quiet) {
  if (!RPG) return 0;
  const d = rpgData();
  const floors = RPG.tower ? (RPG.depth || 1) : ((RPG.fi || 0) + 1);
  const rep = Math.max(1, floors * 2 + (RPG.runKills || 0) + (RPG.runMissions || 0) * 3 + (RPG.tower ? floors : 0));
  d.rep = (d.rep || 0) + rep; rpgSave();
  if (!quiet) rpgFx.banner("✨ みがき +" + rep, "victory");   // サマリー画面に出すときは二重表示を避ける
  return rep;
}
// 📦 ランの成果サマリー：開始時スナップショットとの差分で「今回の冒険」を一覧化（憲法§3）。
function rpgRunSnap() {
  const d = rpgData(), tot = rpgShopTotalOwned();
  return { gold: d.gold | 0, lv: d.lv | 0, exp: d.exp | 0, rep: d.rep | 0,
    tickets: d.tickets | 0, shop: tot.o, calm: (d.items && d.items.calm) | 0,
    outfits: ((state.player && state.player.outfitsWon) || []).length };
}
// つぎの目標（あと◯◯＝ゴールグラデーション）。ハブとサマリーで共通利用。
function rpgNextGoalText() {
  const d = rpgData(), rec = d.records || {}, topI = RPG_FLOORS.length - 1, tot = rpgShopTotalOwned();
  if (!d.cleared) { const bf = rec.floor || 0; return bf < topI ? `🎯 屋上をめざそう：あと <b>${topI - bf}</b> フロアで制覇！` : `🎯 屋上のボスを倒せば制覇！`; }
  if (tot.o < tot.t) return `🛍️ ショッピング・コンプまで あと <b>${tot.t - tot.o}</b> 品！`;
  return `🌟 エンドレスタワー 最深 <b>${rec.depth || 0}</b> 層を更新しよう！`;
}
// スナップショット差分→台帳の行（増えたものだけ名前を付けて返す）
function rpgRunLedger() {
  const d = rpgData(), s = RPG.snap || {}, tot = rpgShopTotalOwned();
  const outfitsNow = ((state.player && state.player.outfitsWon) || []).length;
  const rows = [];
  const goldD = (d.gold | 0) - (s.gold || 0);
  rows.push({ ic: "🪙", label: "ゴールド収支", val: (goldD >= 0 ? "+" : "") + goldD + "G", cls: goldD >= 0 ? "good" : "" });
  const lvD = (d.lv | 0) - (s.lv || 0);
  if (lvD > 0) rows.push({ ic: "⬆️", label: "レベルアップ", val: `Lv${s.lv}→${d.lv}`, cls: "lv" });
  if (RPG.runKills) rows.push({ ic: "⚔️", label: "魔物を撃破", val: `${RPG.runKills}体` });
  const floors = RPG.tower ? (RPG.depth || 1) : ((RPG._maxFi != null ? RPG._maxFi : (RPG.fi || 0)) + 1);
  rows.push({ ic: "🏁", label: RPG.tower ? "のぼった高さ" : "踏破フロア", val: RPG.tower ? `${floors}層` : `${floors}/${RPG_FLOORS.length}F` });
  if (RPG.runMissions) rows.push({ ic: "🎯", label: "ミッション達成", val: `${RPG.runMissions}件` });
  const chests = Object.keys(RPG.collected || {}).length;
  if (chests) rows.push({ ic: "📦", label: "宝箱を開けた", val: `${chests}個` });
  const shopD = tot.o - (s.shop || 0);
  if (shopD > 0) rows.push({ ic: "🛍️", label: "お買い物", val: `+${shopD}品（${tot.o}/${tot.t}）`, cls: "lv" });
  const outD = outfitsNow - (s.outfits || 0);
  if (outD > 0) rows.push({ ic: "👗", label: "衣装GET", val: `+${outD}着`, cls: "lv" });
  const calmD = ((d.items && d.items.calm) | 0) - (s.calm || 0);
  if (calmD > 0) rows.push({ ic: "🔕", label: "静けさのお香", val: `+${calmD}個` });
  const repD = (d.rep | 0) - (s.rep || 0);
  if (repD > 0) rows.push({ ic: "✨", label: "みがき", val: `+${repD}`, cls: "good" });
  const tkD = (d.tickets | 0) - (s.tickets || 0);
  if (tkD > 0) rows.push({ ic: "🎟️", label: "おたから券", val: `+${tkD}枚` });
  return rows;
}
// ランの締め（退場／気絶／出口クリア共通）：⭐をバンクし、📦サマリー画面へ。
function rpgFinishRun(reason) {
  if (!RPG) { renderMallRpg(); return; }
  if (RPG._autoT) { clearTimeout(RPG._autoT); RPG._autoT = null; RPG.auto = false; }
  rpgEndRun(true);
  RPG.summary = { reason: reason, rows: rpgRunLedger(), next: rpgNextGoalText(), cleared: !!rpgData().cleared };
  RPG.mode = "summary"; RPG.battle = null; RPG.busy = false;
  rpgSfx(reason === "lost" ? "nav" : "unlock");
  renderMallRpg();
}
function rpgToday() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "x"; } }
function rpgSave() { if (typeof saveGame === "function") saveGame(); }
function rpgRnd(a, b) { return a + Math.random() * (b - a); }
function rpgPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rpgSfx(id, rate) { try { if (window.Sfx) Sfx.play(id, rate); } catch (e) {} }
// 連発する戦闘音の単調さ回避＝毎回ピッチを±6%ゆらす
function rpgSfxV(id) { rpgSfx(id, 0.94 + Math.random() * 0.12); }
// ♿ アクセシビリティ：モーション控えめ設定なら画面シェイク/フラッシュを止める（数字・HP表示は残す）
function rpgReduce() { try { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
// canvasの描画バッファを表示サイズ（×DPR）に追従させる＝縦型フレームを余白なく埋める
function rpgFitCanvas(cv) {
  if (!cv || !cv.getBoundingClientRect) return;
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (Math.abs(cv.width - w) > 1 || Math.abs(cv.height - h) > 1) { cv.width = w; cv.height = h; }
}

// ── 属性・スキル（戦闘専用の独立計算。レース数式とは無関係）
const RPG_ELEM = { phys: "物理", fire: "火", ice: "氷", elec: "電", force: "力", heal: "回復" };
const RPG_ELEM_IC = { phys: "⚔️", fire: "🔥", ice: "❄️", elec: "⚡", force: "🌀", heal: "💚" };
const RPG_EL_BURST = { phys: "#ffffff", fire: "#ff8a3c", ice: "#7fd8ff", elec: "#ffe04a", force: "#c08bff", heal: "#7af0a0" };
const RPG_SKILLS = {
  atk:   { n: "ぱほっ！",   el: "phys", mp: 0, pow: 9 },
  fire:  { n: "ぱファ！",   el: "fire", mp: 4, pow: 13 },
  ice:   { n: "ぱきーん！", el: "ice",  mp: 4, pow: 13 },
  elec:  { n: "ぱちぱち！", el: "elec", mp: 4, pow: 13 },
  force: { n: "ぱわー！",   el: "force", mp: 5, pow: 14 },
  heal:  { n: "ぱふぅ♪",   el: "heal", mp: 6, heal: 30 },
};
// レベルで覚える
const RPG_LEARN = { 3: ["ice"], 5: ["elec"], 7: ["force"] };

// ── 状態異常（ミミにかかる・戦闘中のみ。回復薬で全快）
const RPG_STATUS = {
  stun:    { ic: "💫", n: "めまい",   d: "1ターン動けない" },
  defdown: { ic: "😵", n: "ぐったり", d: "受けるダメージ↑" },
  dazzle:  { ic: "✨", n: "チカチカ", d: "たまに攻撃を外す" },
  seal:    { ic: "🍙", n: "まんぷく", d: "MP技が出せない" },
};

// ── 敵キャラ（★浮かれた観光客が多数・モンスターは少数）
const RPG_MONS = {
  // 🎫 浮かれた観光客（メイン）
  baku:     { n: "爆買いツアー客", ic: "🛍️", kind: "tourist", hp: 18, atk: 6, exp: 7, gold: 12, weak: ["elec"], resist: [], nul: [], el: "phys", act: "両手いっぱいの紙袋がぶつかった！", sp: { name: "紙袋ラッシュ", status: "defdown", dur: 3, chance: 0.3, msg: "ぐったりして守りが下がった…" } },
  selfie:   { n: "自撮り女子",     ic: "🤳", kind: "tourist", hp: 14, atk: 6, exp: 6, gold: 9,  weak: ["force"], resist: [], nul: [], el: "phys", act: "自撮り棒がビュンと飛んできた！", sp: { name: "フラッシュ撮影", status: "dazzle", dur: 2, chance: 0.35, msg: "目がチカチカする…！" } },
  gourmet:  { n: "食べ歩き勢",     ic: "🍢", kind: "tourist", hp: 20, atk: 7, exp: 8, gold: 10, weak: ["ice"], resist: [], nul: [], el: "fire", act: "アツアツたこ焼きを口に押し込んできた！", sp: { name: "おすそわけ攻め", status: "seal", dur: 2, chance: 0.3, msg: "おなかいっぱいで技が出せない！" } },
  stroller: { n: "ベビーカー隊",   ic: "👶", kind: "tourist", hp: 24, atk: 7, exp: 9, gold: 11, weak: ["phys"], resist: ["force"], nul: [], el: "phys", act: "ベビーカーで猛突進！" },
  oldies:   { n: "団体のおば様",   ic: "📷", kind: "tourist", hp: 22, atk: 6, exp: 9, gold: 14, weak: ["fire"], resist: [], nul: [], el: "phys", act: "おしゃべりの渦に巻き込んできた！", sp: { name: "質問ぜめ", status: "stun", dur: 1, chance: 0.28, msg: "話につかまって動けない！" } },
  kid:      { n: "はぐれっ子",     ic: "🧒", kind: "tourist", hp: 10, atk: 5, exp: 5, gold: 6,  weak: ["fire", "ice", "elec", "force"], resist: [], nul: [], el: "phys", act: "泣きわめいて気をひいてきた！" },
  // 🛍️ アラモアナ拡張の観光客（モール各所に出現）
  luxe:     { n: "ハイブランド客", ic: "👜", kind: "tourist", hp: 26, atk: 8, exp: 11, gold: 18, weak: ["force"], resist: ["phys"], nul: [], el: "phys", act: "重い紙袋でなぎ払い！", sp: { name: "見栄ばり", status: "defdown", dur: 2, chance: 0.3, msg: "気おされて守りが下がった…" } },
  hula:     { n: "フラ見物客",     ic: "💃", kind: "tourist", hp: 22, atk: 7, exp: 10, gold: 13, weak: ["ice"], resist: [], nul: [], el: "phys", act: "のりのりで巻き込んできた！", sp: { name: "総踊り", status: "stun", dur: 1, chance: 0.3, msg: "リズムにつられて動けない！" } },
  madam:    { n: "デパ地下マダム", ic: "👛", kind: "tourist", hp: 24, atk: 7, exp: 10, gold: 16, weak: ["elec"], resist: [], nul: [], el: "phys", act: "試食をぐいぐい勧めてきた！", sp: { name: "値切り交渉", status: "seal", dur: 2, chance: 0.28, msg: "気圧されて技が出せない！" } },
  influencer:{ n: "インフルエンサー", ic: "📸", kind: "tourist", hp: 18, atk: 7, exp: 9, gold: 12, weak: ["fire"], resist: [], nul: [], el: "phys", act: "ライブ配信に巻き込んできた！", sp: { name: "バズり狙い", status: "dazzle", dur: 2, chance: 0.32, msg: "映え光で目がチカチカ！" } },
  // 👾 モンスター（少数）
  slime:    { n: "マヨイスライム", ic: "🟢", kind: "monster", hp: 20, atk: 7, exp: 9, gold: 10, weak: ["fire"], resist: ["ice"], nul: [], el: "phys", act: "ベタベタ体当たり！" },
  mannequin:{ n: "うごくマネキン", ic: "🤖", kind: "monster", hp: 28, atk: 9, exp: 14, gold: 16, weak: ["elec"], resist: ["phys"], nul: [], el: "phys", act: "マネキンチョップ！" },
  escalator:{ n: "暴走エスカレーター", ic: "🛗", kind: "monster", hp: 36, atk: 11, exp: 18, gold: 20, weak: ["elec"], resist: ["phys"], nul: [], el: "phys", act: "逆走して巻き込んだ！" },
  // 🐲 崑崙島の住人（ドラゴンモールならではの固有モンスター）
  kowako:   { n: "はぐれ子竜",     ic: "🐲", kind: "monster", hp: 24, atk: 8, exp: 12, gold: 14, weak: ["ice"], resist: ["fire"], nul: [], el: "fire", act: "ちいさな火の息を「ぷしゅー」！", sp: { name: "甘えん坊ブレス", status: "dazzle", dur: 2, chance: 0.3, msg: "可愛さに見とれて目がチカチカ…！" } },
  shisa:    { n: "門番の石獅子",   ic: "🦁", kind: "monster", hp: 34, atk: 10, exp: 16, gold: 18, weak: ["force"], resist: ["phys"], nul: [], el: "phys", act: "石の前足でドンと一撃！", sp: { name: "睨みの構え", status: "stun", dur: 1, chance: 0.28, msg: "睨まれて足がすくんだ！" } },
  kumonosei:{ n: "雲の精",         ic: "☁️", kind: "monster", hp: 22, atk: 9, exp: 13, gold: 12, weak: ["elec"], resist: ["ice"], nul: [], el: "ice", act: "ひんやりした霧で包んできた！", sp: { name: "もやもや化", status: "seal", dur: 2, chance: 0.3, msg: "霧で技が見えない…！" } },
  // 🎡 ボス（屋上）
  boss1:    { n: "観覧車ゴーレム", ic: "🎡", kind: "monster", hp: 110, atk: 13, exp: 80, gold: 200, weak: ["elec"], resist: ["fire", "ice"], nul: [], el: "phys", boss: true, act: "巨大ゴンドラが回転しながら突撃！", sp: { name: "大回転プレス", status: "defdown", dur: 3, chance: 0.4, msg: "おしつぶされて守りが下がった…", dmg: true } },
};
const RPG_TOURISTS = ["baku", "selfie", "gourmet", "stroller", "oldies", "kid", "luxe", "hula", "madam", "influencer"];
const RPG_MONSTERS_MINOR = ["slime", "mannequin", "escalator"];
const RPG_KUNLUN = ["kowako", "shisa", "kumonosei"];   // 崑崙島の固有モンスター（図鑑・タワー出現に合流）
// 🔊 フロア別の環境音（さざ波／ざわめき／上品なベル）。索引＝フロア番号。
const RPG_AMB = ["amb_wave", "amb_wave", "amb_crowd", "amb_wave", "amb_chime", "amb_chime", "amb_crowd", "amb_wave"];
function rpgAmbient(force) {
  if (!RPG || RPG.mode !== "explore" || !window.state || state.ui.screen !== "mall_rpg") return;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (!force && now < (RPG._ambNext || 0)) return;
  RPG._ambNext = now + 8500 + Math.random() * 5000;     // 8.5〜13.5秒ごとにそっと鳴らす
  rpgSfx(RPG_AMB[(RPG.tower ? 0 : RPG.fi) % RPG_AMB.length]);
}

// ── 迷宮マップ（# 壁 / . 床 / S 入口 / T 宝 / F=上り階段 or ボス出口）。
// 連結確認済みの基本形を回転/反転して各フロアに展開（変形は連結性を保つ）。
const RPG_BASE = [
  "#########",
  "#S......#",
  "#.#####.#",
  "#.#.T.#.#",
  "#.#.#.#.#",
  "#.#.#...#",
  "#.#.###.#",
  "#...#..F#",
  "#########",
];
// 島のリゾートモール・1F→屋上。far: U=上り階段 / E=ボス(屋上)。accent=フロアのテーマ色
// 🏝️ アラモアナを手本にした巨大オープンエア・モール（全7階＋屋上）。屋上=ボス（最終）
const RPG_FLOORS = [
  { name: "1F 🏄 龍鱗ビーチ通り",    t: "id",        far: "U", accent: [38, 196, 176], foes: ["selfie", "kid", "hula", "baku", "kowako"], nushi: { base: "hula", n: "フラ大会の主", ic: "💃" }, goal: { type: "defeat", n: 3, label: "観光客をもてなす", ic: "😌" } },
  { name: "2F 🏊 雲海プールデッキ",   t: "mirrorH",   far: "U", accent: [64, 176, 235], foes: ["kid", "selfie", "stroller", "hula", "kumonosei"], nushi: { base: "stroller", n: "プールデッキの主", ic: "🌊" }, goal: { type: "explore", n: 70, label: "フロアを踏破", ic: "🗺️" } },
  { name: "3F 🍱 崑崙グルメ横丁",     t: "mirrorV",   far: "U", accent: [255, 140, 90], foes: ["gourmet", "oldies", "baku", "madam", "gourmet"], nushi: { base: "gourmet", n: "食べ歩きの主", ic: "🍢" }, goal: { type: "gold", n: 250, label: "グルメで稼ぐ", ic: "🪙" } },
  { name: "4F 🐬 海竜アドベンチャー", t: "rot180",   far: "U", accent: [40, 130, 210], foes: ["stroller", "kid", "gourmet", "kowako", "slime"], nushi: { base: "kowako", n: "海竜の主", ic: "🐉" }, goal: { type: "weak", n: 5, label: "弱点を突く", ic: "⚡" } },
  { name: "5F 💎 龍玉ラグジュアリー大通り", t: "transpose", far: "U", accent: [222, 150, 192], foes: ["luxe", "madam", "influencer", "mannequin"], nushi: { base: "luxe", n: "爆買いの主", ic: "👜" }, goal: { type: "gold", n: 450, label: "ハイブランドで散財", ic: "👜" } },
  { name: "6F 🏬 崑崙百貨店",         t: "id",        far: "U", accent: [150, 120, 210], foes: ["madam", "oldies", "luxe", "mannequin", "shisa"], nushi: { base: "shisa", n: "百貨店の門番", ic: "🦁" }, goal: { type: "explore", n: 75, label: "デパートを巡る", ic: "🛗" } },
  { name: "7F 🎪 龍神フェスステージ", t: "mirrorH",   far: "U", accent: [255, 170, 70], foes: ["hula", "influencer", "baku", "selfie", "kumonosei"], nushi: { base: "influencer", n: "バズりの主", ic: "📸" }, goal: { type: "defeat", n: 6, label: "フェスの人波をさばく", ic: "💃" } },
  { name: "🌅 雲頂サンセットテラス",  t: "transpose", far: "E", accent: [255, 120, 150], sky: true, foes: ["influencer", "luxe", "kowako", "mannequin", "kumonosei"], goal: { type: "boss", n: 1, label: "ボスを倒す", ic: "👑" } },
];
function rpgTransform(base, kind) {
  const m = base.map(r => r.split("")), n = m.length;
  let o;
  if (kind === "mirrorH") o = m.map(row => row.slice().reverse());
  else if (kind === "mirrorV") o = m.slice().reverse();
  else if (kind === "rot180") o = m.slice().reverse().map(row => row.slice().reverse());
  else if (kind === "transpose") { o = []; for (let x = 0; x < n; x++) { o[x] = []; for (let y = 0; y < n; y++) o[x][y] = m[y][x]; } }
  else o = m.map(row => row.slice());
  return o.map(row => row.join(""));
}
// フロア情報（5層を超えたら🌟エンドレスタワーを手続き生成）
const RPG_TWR_T = ["id", "mirrorH", "mirrorV", "rot180", "transpose"];
const RPG_TWR_PAL = [[255, 120, 150], [120, 116, 214], [64, 176, 235], [255, 140, 90], [38, 196, 176]];
function rpgFloorMeta(i) {
  if (i < RPG_FLOORS.length) return RPG_FLOORS[i];
  const k = i - RPG_FLOORS.length;
  return { name: "🌟 タワー " + (k + 1) + "層", t: RPG_TWR_T[i % 5], far: "U", accent: RPG_TWR_PAL[i % 5], sky: (i % 5 === 0), tower: true, goal: { type: "defeat", n: 3 + Math.floor(k / 2), label: "魔物を蹴散らす", ic: "💥" } };
}
function rpgBuildFloor(i) {
  const meta = rpgFloorMeta(i);
  let kind = meta.t;
  if (RPG && RPG.daily && RPG._frng) kind = RPG_TWR_T[(RPG._frng() * RPG_TWR_T.length) | 0];   // 🗓️デイリー＝日替わりで床の変形も決まる（同じ合言葉なら同じ構造）
  return rpgTransform(RPG_BASE, kind).map(r => r.replace("F", meta.far));
}
// 🎲 シード式PRNG（mulberry32）＝デイリーラン用。Math.random非依存・5行・依存ゼロ。
function rpgMulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rpgHashStr(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }   // FNV-1a
function rpgHash(a, b) { return (Math.imul((a >>> 0) ^ 0x9E3779B9, 2654435761) ^ Math.imul((b + 1) >>> 0, 40503)) >>> 0; }   // (seed, floor)→サブシード
// 今日の合言葉（実日付。端末をまたいで同一）。
function rpgTodaySeed() { try { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); } catch (e) { return "default"; } }
const RPG_DV = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W
// マップ上で (sx,sy)→(gx,gy) が壁を通らずに到達可能か（閉鎖の連結性チェック用・BFS）
function rpgConnected(map, sx, sy, gx, gy) {
  const h = map.length, w = map[0].length, seen = {}, q = [[sx, sy]]; seen[sx + "," + sy] = 1;
  while (q.length) {
    const cur = q.shift(); if (cur[0] === gx && cur[1] === gy) return true;
    for (let d = 0; d < 4; d++) {
      const nx = cur[0] + RPG_DV[d][0], ny = cur[1] + RPG_DV[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[nx + "," + ny] || map[ny][nx] === "#") continue;
      seen[nx + "," + ny] = 1; q.push([nx, ny]);
    }
  }
  return false;
}
// 🚧 ランダム通路閉鎖：潜るたびに一部の通路を塞いで道順を変える（連結性＝入口→階段/宝は必ず保つ）。
function rpgApplyClosures() {
  RPG.closed = {}; RPG._closedN = 0;
  if (RPG.tower) return;                                  // タワーは手続き生成のままにする
  const map = RPG.map, h = RPG.h, w = RPG.w;
  let gx = RPG.px, gy = RPG.py, treas = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (map[y][x] === "U" || map[y][x] === "E") { gx = x; gy = y; }
    else if (map[y][x] === "T") treas.push([x, y]);
  }
  const cands = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (map[y][x] === ".") cands.push([x, y]);
  const rnd = (RPG.daily && RPG._frng) ? RPG._frng : Math.random;   // 🗓️デイリーは閉鎖もシードで決定
  for (let i = cands.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
  const want = (rnd() * 4) | 0;                           // 0〜3か所（0なら全開放＝“閉鎖されてたりされてなかったり”）
  for (let c = 0; c < cands.length && RPG._closedN < want; c++) {
    const x = cands[c][0], y = cands[c][1]; map[y][x] = "#";          // 仮に閉鎖
    let ok = rpgConnected(map, RPG.px, RPG.py, gx, gy);
    if (ok) for (let k = 0; k < treas.length; k++) if (!rpgConnected(map, RPG.px, RPG.py, treas[k][0], treas[k][1])) { ok = false; break; }
    if (ok) { RPG.closed[x + "," + y] = 1; RPG._closedN++; } else { map[y][x] = "."; }   // ダメなら戻す
  }
}
const RPG_DIRNAME = ["北", "東", "南", "西"];

// ── 探索の開始
function rpgStartRun() {
  RPG = {
    fi: 0, map: [], w: 9, h: 9, px: 1, py: 1, dir: 1,
    mode: "explore", steps: 0, grace: 1,
    explored: {}, collected: {},
    log: [], battle: null, flash: null, auto: false,
    runKills: 0, runMissions: 0, _maxFi: 0,
  };
  RPG.snap = rpgRunSnap();   // 📦今回の冒険サマリー用の開始時スナップショット
  rpgLoadFloor(0);
  const sg = rpgUpLv("gold") * 50; if (sg) { rpgData().gold += sg; rpgLog(`👛 やりくり上手で +${sg}G で出発！`, "good"); }   // 👛やりくり上手（自分磨き）
  rpgLog("🏝️ リゾート探検へ！ ▲で進む・↰↱で向き（▶でオートにも切替）", "good");
  rpgFx.floorCard(RPG_FLOORS[0].name, rpgGoalCardSub(RPG_FLOORS[0]), RPG_FLOORS[0].accent);
  rpgMaybeShowTutorial();
  renderMallRpg();
}
// 初回の冒険だけ、フロアカードの余韻が明けたタイミングで操作ガイドをそっと表示（2回目以降は出ない）
function rpgMaybeShowTutorial() {
  const d = rpgData();
  if (d.tutSeen) return;
  d.tutSeen = true; rpgSave();
  setTimeout(() => rpgFx.tutorial("💡 ▲で進む・↰↱で向きを変える。🛗階段で次の階へ、🛍️お店の前で入店できるよ！"), 2500);
}
// 🗓️ デイリーラン：合言葉（既定＝今日の日付）で“床の変形＋通路閉鎖”が端末をまたいで同一になる固定ダンジョン。
// 入口は競合中のハブを避け、URL ?daily=YYYYMMDD（値なし＝今日）と window.rpgStartDaily(seed) から起動。
function rpgStartDaily(seedStr) {
  const s = (seedStr && String(seedStr).trim()) || rpgTodaySeed();
  RPG = {
    fi: 0, map: [], w: 9, h: 9, px: 1, py: 1, dir: 1,
    mode: "explore", steps: 0, grace: 1,
    explored: {}, collected: {},
    log: [], battle: null, flash: null, auto: false,
    runKills: 0, runMissions: 0, _maxFi: 0,
    daily: true, seed: rpgHashStr(s), seedStr: s,
  };
  RPG.snap = rpgRunSnap();
  rpgLoadFloor(0);
  const sg = rpgUpLv("gold") * 50; if (sg) { rpgData().gold += sg; rpgLog(`👛 やりくり上手で +${sg}G で出発！`, "good"); }
  rpgLog(`🗓️ デイリーラン（合言葉「${s}」）開始！ 同じ合言葉なら誰でも同じ構造`, "good");
  rpgFx.floorCard(RPG_FLOORS[0].name, "🗓️ DAILY " + s, RPG_FLOORS[0].accent);
  rpgMaybeShowTutorial();
  renderMallRpg();
}
if (typeof window !== "undefined") window.rpgStartDaily = rpgStartDaily;
// フロア読み込み（fi=フロア番号）
function rpgLoadFloor(i) {
  RPG.fi = i;
  // 🗓️デイリーは (合言葉, フロア) からシードを作り、床の変形→閉鎖を同じ順で引く＝端末をまたいで同一構造。
  RPG._frng = (RPG.daily && RPG.seed != null) ? rpgMulberry(rpgHash(RPG.seed, i)) : null;
  RPG.map = rpgBuildFloor(i).map(r => r.split(""));
  RPG.w = RPG.map[0].length; RPG.h = RPG.map.length;
  let sx = 1, sy = 1;
  for (let y = 0; y < RPG.h; y++) for (let x = 0; x < RPG.w; x++) if (RPG.map[y][x] === "S") { sx = x; sy = y; }
  RPG.px = sx; RPG.py = sy; RPG.dir = 1;
  rpgApplyClosures();                       // 🚧 この潜入だけの通路閉鎖（道順がランダムに変わる）
  RPG.explored = {}; RPG.explored[sx + "," + sy] = 1;
  if (RPG._closedN > 0) rpgLog(`🚧 きょうは通路が${RPG._closedN}か所 閉鎖中。道が変わってる！`, "good");
  RPG._ambNext = 0; setTimeout(() => rpgAmbient(true), 400);   // 🔊 フロアの環境音を入場時にそっと
  const d = rpgData();
  // フロア・ミッション（任意＋達成ボーナス）：入場のたびに進捗リセット
  const g = rpgFloorMeta(i).goal;
  RPG.goal = g ? { type: g.type, n: g.n, label: g.label, ic: g.ic, prog: 0, done: false, base: g.type === "gold" ? d.gold : 0 } : null;
  const s0 = rpgShopFor(i), nleft = s0.length - rpgShopOwnedN(s0);
  if (nleft > 0) rpgLog(`🛍️ お店に ${s0[0].ic}${s0[0].n} など${nleft}品！「お店」ボタンでお買い物♪`, "good");
  if (!RPG.tower && (d.best.floor == null || i > d.best.floor)) { d.best.floor = i; rpgSave(); }
  if (!RPG.tower && (RPG._maxFi == null || i > RPG._maxFi)) RPG._maxFi = i;   // 📦サマリーの踏破フロア数
}
// ミッション表示用テキスト（HUDチップ／フロアカード）
function rpgGoalUnit(t) { return t === "explore" ? "%" : (t === "gold" ? "G" : ""); }
function rpgGoalChip(g) { if (!g) return ""; return `${g.ic || "🎯"} ${g.label} ${Math.min(g.prog, g.n)}/${g.n}${rpgGoalUnit(g.type)}`; }
function rpgGoalCardSub(meta) { const g = meta && meta.goal; return g ? `🎯 ${g.label} ${g.n}${rpgGoalUnit(g.type)}` : "NEXT FLOOR"; }
// パッシブ型（gold/explore）の進捗を現状から再計算し、達成判定する
function rpgGoalSync() {
  const g = RPG && RPG.goal; if (!g || g.done) return;
  if (g.type === "gold") g.prog = Math.max(0, rpgData().gold - g.base);
  else if (g.type === "explore") {
    let tiles = 0; for (let y = 0; y < RPG.h; y++) for (let x = 0; x < RPG.w; x++) if (RPG.map[y][x] !== "#") tiles++;
    g.prog = Math.round(Object.keys(RPG.explored).length / Math.max(1, tiles) * 100);
  }
  rpgGoalCheck();
}
// アクティブ型（defeat/weak/boss）の加算
function rpgGoalBump(type, k) { const g = RPG && RPG.goal; if (!g || g.done || g.type !== type) return; g.prog += k; rpgGoalCheck(); }
// 達成 → ボーナス＋演出＋記録（任意ミッション＝据え置きの最終目標とは別）
function rpgGoalCheck() {
  const g = RPG && RPG.goal; if (!g || g.done || g.prog < g.n) return;
  g.done = true;
  const d = rpgData();
  RPG.runMissions = (RPG.runMissions || 0) + 1;   // ⭐評判の算出に反映
  const bonusG = 50 + RPG.fi * 30, bonusE = 15 + RPG.fi * 10;
  d.gold += bonusG; d.exp += bonusE;
  d.records = d.records || {}; d.records.missions = (d.records.missions || 0) + 1;
  d.best.missionsDone = d.best.missionsDone || {}; d.best.missionsDone[RPG.fi] = true;
  (RPG.battle ? rpgBLog : rpgLog)(`🎯 ミッション達成！「${g.label}」 ごほうび 🪙+${bonusG}・EXP+${bonusE}`, "win");
  rpgFx.banner("🎯 ミッション達成！", "levelup"); rpgSfx("unlock");
  rpgSave();
}
// 上り階段（エレベーター演出）
function rpgGoUp() {
  if (RPG.tower) { rpgTowerAscendPrompt(); return; }     // タワーは「さらに上 or 降りる」選択
  if (RPG.fi + 1 >= RPG_FLOORS.length) { renderMallRpg(); return; }
  RPG.busy = true; rpgSfx("nav");
  const ni = RPG.fi + 1, nm = rpgFloorMeta(ni);
  rpgFx.floorCard(nm.name, rpgGoalCardSub(nm), nm.accent, () => {
    rpgLoadFloor(ni);
    rpgLog(`🛗 ${rpgFloorMeta(RPG.fi).name} に上ってきた！`, "good");
    RPG.busy = false;
    renderMallRpg();
  });
}
function rpgLog(t, cls) { if (!RPG) return; RPG.log.unshift({ t, cls: cls || "" }); RPG.log = RPG.log.slice(0, 5); }

// 🔕 静けさのお香：たくと一定歩数のあいだ魔物が寄ってこない（探索の小休止＝クリア報酬の主役）
const RPG_CALM_STEPS = 12;
function rpgUseCalm() {
  const d = rpgData();
  if (!RPG || (d.items.calm || 0) <= 0 || (RPG.calm || 0) > 0) return;
  d.items.calm--; RPG.calm = RPG_CALM_STEPS;
  rpgLog(`🔕 静けさのお香をたいた。${RPG_CALM_STEPS}歩のあいだ魔物が寄ってこない…`, "good");
  rpgFx.banner("🔕 平和 " + RPG_CALM_STEPS + "歩", "victory");
  rpgSfx("nav"); rpgSave(); renderMallRpg();
}
// 🏁 フロア踏破：階段に初到達した瞬間（この潜入で1回だけ）報酬を返す。タワーは対象外。
function rpgFloorClear() {
  if (!RPG || RPG.tower) return;
  RPG._clearedFloors = RPG._clearedFloors || {};
  if (RPG._clearedFloors[RPG.fi]) return;
  RPG._clearedFloors[RPG.fi] = 1;
  const d = rpgData();
  const g = 30 + RPG.fi * 20;                                  // 踏破ボーナス（小・上階ほど増）
  d.gold += g;
  const drop = Math.random() < (0.34 + RPG.fi * 0.05);        // 🔕お香のドロップ（上階ほど出やすい）
  if (drop) d.items.calm = (d.items.calm || 0) + 1;
  rpgFx.banner(`🏁 ${RPG.fi + 1}F 踏破！`, "victory");
  rpgLog(`🏁 ${rpgFloorMeta(RPG.fi).name} を踏破！ 🪙+${g}${drop ? "・🔕静けさのお香 ×1" : ""}`, "win");
  rpgSfx("unlock"); rpgSave();
}

// ── 🌟 エンドレスタワー（屋上クリア後・どこまで上れるか＋プレスユアラック）
function rpgStartTower() {
  RPG = {
    fi: RPG_FLOORS.length, map: [], w: 9, h: 9, px: 1, py: 1, dir: 1,
    mode: "explore", steps: 0, grace: 1, explored: {}, collected: {},
    log: [], battle: null, flash: null, tower: true, depth: 1, towerLuck: 0.2, auto: false,
    runKills: 0, runMissions: 0, _maxFi: 0,
  };
  RPG.snap = rpgRunSnap();
  rpgLoadFloor(RPG_FLOORS.length);
  rpgLog("🌟 エンドレスタワーに挑戦！ どこまで上れる？", "good");
  renderMallRpg();
}
function rpgTowerAscendPrompt() { if (!RPG) return; RPG.mode = "ascend"; rpgSfx("nav"); renderMallRpg(); }
function rpgTowerAscend() {
  if (!RPG) return;
  RPG.depth++; RPG.towerLuck += 0.18; RPG.busy = true; rpgSfx("nav");
  const d = rpgData(); if (RPG.depth > (d.records.depth || 0)) { d.records.depth = RPG.depth; rpgBumpRecords(); }
  const tm = rpgFloorMeta(RPG.fi + 1);
  rpgFx.floorCard(tm.name, rpgGoalCardSub(tm), tm.accent, () => {
    if (!RPG) return;
    rpgLoadFloor(RPG.fi + 1); RPG.mode = "explore"; RPG.busy = false;
    rpgLog(`🌟 ${RPG.depth}層へ！ レア度UP・敵も強化`, "good");
    renderMallRpg();
  });
}
function rpgTowerDescend() {
  if (!RPG) return;
  const d = rpgData();
  if (RPG.depth > (d.records.depth || 0)) d.records.depth = RPG.depth;
  rpgBumpRecords();
  const n = Math.min(5, 1 + Math.floor(RPG.depth / 2)), luck = RPG.towerLuck;
  const items = []; for (let i = 0; i < n; i++) items.push(rpgGrantReward(rpgRollRarity(luck)));
  rpgEndRun();   // 深く上るほど⭐も増える
  rpgSave();
  RPG.tower = false;
  rpgReveal(items, { title: `🏁 ${RPG.depth}層クリアのごほうび！`, onDone: () => { if (RPG && RPG._autoT) clearTimeout(RPG._autoT); RPG = null; renderMallRpg(); } });
}

// ── マップ参照（範囲外は壁）
function rpgCell(x, y) {
  if (!RPG || y < 0 || y >= RPG.h || x < 0 || x >= RPG.w) return "#";
  return RPG.map[y][x];
}
function rpgIsWall(c) { return c === "#"; }
// 視点からの相対セル（depth=前方距離, lat=横 -1左/+1右）
function rpgAhead(depth, lat) {
  const f = RPG_DV[RPG.dir], r = RPG_DV[(RPG.dir + 1) % 4];
  return rpgCell(RPG.px + f[0] * depth + r[0] * lat, RPG.py + f[1] * depth + r[1] * lat);
}

// ── 移動
function rpgTurn(d) {
  if (!RPG || RPG.mode !== "explore" || RPG.busy) return;
  RPG.dir = (RPG.dir + d + 4) % 4;
  RPG._stepFx = d < 0 ? "turnL" : "turnR";
  rpgSfx("tick");
  renderMallRpg();
}
function rpgForward(sign) {
  if (!RPG || RPG.mode !== "explore" || RPG.busy) return;
  const f = RPG_DV[RPG.dir];
  const nx = RPG.px + f[0] * sign, ny = RPG.py + f[1] * sign;
  if (rpgIsWall(rpgCell(nx, ny))) { rpgLog("🧱 壁だ。", ""); renderMallRpg(); return; }
  RPG.px = nx; RPG.py = ny; RPG.steps++;
  RPG.explored[nx + "," + ny] = 1;
  RPG._stepFx = sign > 0 ? "fwd" : "back";
  rpgSfx("tick");
  const here = rpgCell(nx, ny);
  if (here === "T") { rpgTreasure(nx, ny); return; }
  if (here === "U") {   // 階段＝自動で上らない。オートは一旦停止して「上る？残る？」を選ばせる
    rpgFloorClear();    // 🏁 踏破（初回のみ報酬：ゴールド＋🔕お香）
    if (RPG.auto) { RPG.auto = false; if (RPG._autoT) { clearTimeout(RPG._autoT); RPG._autoT = null; } }
    rpgLog("🛗 階段に着いた。『上の階へ』で上れる（残ってお買い物・ミッションもOK）", "good"); rpgSfx("nav"); renderMallRpg(); return;
  }
  if (here === "E") { rpgReachExit(); return; }
  // ランダムエンカウント
  if ((RPG.calm || 0) > 0) {   // 🔕 静けさのお香：効果中は遭遇しない（grace も消費しない）
    RPG.calm--;
    if (RPG.calm === 0) rpgLog("🔕 お香の効き目が切れた。気をひきしめて。", "");
  }
  else if (RPG.grace > 0) RPG.grace--;
  else if (Math.random() < 0.22) {
    const fm = rpgFloorMeta(RPG.fi);   // 🐲 フロアの主（未討伐なら一定確率で出現）
    const isNushi = fm.nushi && !(RPG._nushiBeat && RPG._nushiBeat[RPG.fi]) && Math.random() < 0.2;
    RPG.busy = true;                   // 予兆の一拍は操作/オート歩行を止める（戦闘開始で解除）
    renderMallRpg();                   // 踏み込んだ一歩を先に見せてから予兆を出す
    rpgFx.telegraph(isNushi ? "nushi" : "enc", () => {
      if (!RPG) return;
      if (RPG.mode !== "explore") { RPG.busy = false; return; }   // 画面を離れていたら戦闘は出さずロック解除
      if (isNushi) rpgEncounter("nushi"); else rpgEncounter();
    });
    return;
  }
  renderMallRpg();
}
// ── オート歩行（左手法で迷宮を自動探索。戦闘/演出中は自動停止し、終わると再開）
function rpgToggleAuto() {
  if (!RPG) return;
  RPG.auto = !RPG.auto;
  if (RPG.auto) rpgAutoLoop(); else if (RPG._autoT) { clearTimeout(RPG._autoT); RPG._autoT = null; }
  renderMallRpg();
}
function rpgAutoStep() {
  if (!RPG || RPG.mode !== "explore" || RPG.busy || RPG_REVEAL) return;
  // 壁づたい（同方向ループ）をやめ、未踏マスを優先しつつランダムに分岐＝探索が前に進む。
  const back = (RPG.dir + 2) % 4, cands = [];
  for (let dd = 0; dd < 4; dd++) {
    const nx = RPG.px + RPG_DV[dd][0], ny = RPG.py + RPG_DV[dd][1];
    if (rpgIsWall(rpgCell(nx, ny))) continue;
    cands.push({ dir: dd, fresh: !RPG.explored[nx + "," + ny], isBack: dd === back });
  }
  if (!cands.length) return;
  const pick = a => a[(Math.random() * a.length) | 0];
  let pool = cands.filter(c => c.fresh && !c.isBack);   // ①未踏かつ後戻りでない＝最優先
  if (!pool.length) pool = cands.filter(c => c.fresh);   // ②未踏（袋小路からの引き返し含む）
  if (!pool.length) pool = cands.filter(c => !c.isBack); // ③既踏でも前進方向を優先
  if (!pool.length) pool = cands;                        // ④行き止まり＝引き返す
  RPG.dir = pick(pool).dir;
  rpgForward(1);
}
function rpgAutoLoop() {
  if (!RPG || !RPG.auto) { if (RPG) RPG._autoT = null; return; }
  // ★移動だけ自動。戦闘は手動・リザルト/リスク選択はプレイヤーが操作。
  if (!RPG.busy && !RPG_REVEAL && RPG.mode === "explore") rpgAutoStep();
  if (RPG && RPG.auto) RPG._autoT = setTimeout(rpgAutoLoop, 460); else if (RPG) RPG._autoT = null;
}
// オート戦闘AI：低HPなら回復、弱点があれば突く、無ければ最善属性で最弱の敵を狙う
function rpgAutoBattleStep() {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy) return;
  if (d.hp < d.maxhp * 0.3) {
    if (d.skills.indexOf("heal") >= 0 && d.mp >= RPG_SKILLS.heal.mp && b.pstatus.seal <= 0) { b.sub = null; return rpgUseSkill("heal"); }
    if ((d.items.potion || 0) > 0) { b.sub = null; return rpgUseItem("potion"); }
  }
  let bestScore = -1e9, bestSid = "atk", bestTi = b.target;
  b.enemies.forEach((e, i) => {
    if (!e.alive) return;
    d.skills.forEach(sid => {
      const sk = RPG_SKILLS[sid]; if (sk.el === "heal") return;
      if (sk.mp > 0 && (d.mp < sk.mp || b.pstatus.seal > 0)) return;
      const m = rpgMult(e.ref, sk.el); if (m <= 0) return;
      const score = m * 100 - e.hp * 0.4 - sk.mp;
      if (score > bestScore) { bestScore = score; bestSid = sid; bestTi = i; }
    });
  });
  b.target = bestTi; b.sub = null;
  rpgUseSkill(bestSid);
}
function rpgTreasure(x, y) {
  const key = RPG.fi + ":" + x + "," + y;
  if (RPG.collected[key]) { rpgLog("📦 からっぽの宝箱だ。", ""); renderMallRpg(); return; }
  RPG.collected[key] = 1;
  rpgLog("📦 宝箱を見つけた！ なにが出るかな…", "good");
  rpgChestPull(x, y, RPG.fi * 0.12);     // 上の階ほどレア度UP
}
function rpgReachExit() {
  const d = rpgData();
  if (!d.cleared) { rpgEncounter(true); return; }   // 初回はボス戦
  rpgFinishRun("exit");                              // 制覇後の出口＝📦今回の冒険サマリーへ
}

// =========================================================================
// 戦闘
// =========================================================================
// ── 演出（FXレイヤーは body 直下＝画面再描画に影響されない）
const rpgFx = {
  layer() { let l = document.getElementById("rpg-fx"); if (!l) { l = document.createElement("div"); l.id = "rpg-fx"; document.body.appendChild(l); } return l; },
  at(elm, text, cls) { if (!elm) return; const r = elm.getBoundingClientRect(); this.spot(r.left + r.width / 2, r.top + r.height * 0.4, text, cls); },
  spot(x, y, text, cls) { const n = document.createElement("div"); n.className = "rpg-fxnum " + (cls || ""); n.textContent = text; n.style.left = x + "px"; n.style.top = y + "px"; this.layer().appendChild(n); setTimeout(() => n.remove(), 950); },
  banner(text, cls) { const n = document.createElement("div"); n.className = "rpg-fxbanner " + (cls || ""); n.textContent = text; this.layer().appendChild(n); setTimeout(() => n.remove(), 950); },
  turn(text, cls) { const n = document.createElement("div"); n.className = "rpg-fxturn " + (cls || ""); n.textContent = text; this.layer().appendChild(n); setTimeout(() => n.remove(), 850); },
  hit(elm) { if (!elm) return; elm.classList.remove("rpg-hit"); void elm.offsetWidth; elm.classList.add("rpg-hit"); },
  shakeApp() { if (rpgReduce()) return; const a = document.getElementById("app"); if (!a) return; a.classList.remove("rpg-shake"); void a.offsetWidth; a.classList.add("rpg-shake"); setTimeout(() => a.classList.remove("rpg-shake"), 420); },
  flash(cls) { if (rpgReduce()) return; const n = document.createElement("div"); n.className = "rpg-fxflash " + (cls || ""); this.layer().appendChild(n); setTimeout(() => n.remove(), 520); },
  cover(cls, ms, cb) { const n = document.createElement("div"); n.className = "rpg-fxcover " + (cls || ""); this.layer().appendChild(n); if (cb) setTimeout(cb, ms * 0.45); setTimeout(() => n.remove(), ms); },
  // バトル突入トランジション：上下のバーが閉じて開く＋フラッシュ＋ラベルズーム（kind: enc/boss/rare）
  encounter(kind) {
    const n = document.createElement("div"); n.className = "rpg-enc " + (kind || "enc");
    const label = kind === "boss" ? "👹 BOSS" : (kind === "rare" ? "✨ おたからチャンス ✨" : "⚔ バトル！");
    n.innerHTML = '<div class="enc-flash"></div><div class="enc-bar top"></div><div class="enc-bar bot"></div><div class="enc-seam"></div><div class="enc-label"></div>';
    n.querySelector(".enc-label").textContent = label;
    this.layer().appendChild(n);
    setTimeout(() => n.remove(), 1050);
  },
  // バトル予兆：踏み込んだ瞬間に画面の縁が“ドクッ”と脈打ち、身構える一拍をつくる（突然の即死戦の理不尽さを和らげる）
  // reduced-motion時は視覚演出を出さず、ほぼ間を置かずに戦闘へ。kind: enc/nushi/boss
  telegraph(kind, cb) {
    rpgSfx("alert", kind === "nushi" ? 0.72 : 0.82);   // 予兆＝低めの“遠い警告”（接敵時の通常ピッチ＝一撃と差別化）
    if (rpgReduce()) { setTimeout(cb, 120); return; }
    const n = document.createElement("div"); n.className = "rpg-tele " + (kind || "enc");
    this.layer().appendChild(n);
    setTimeout(() => n.remove(), 620);
    setTimeout(cb, 470);
  },
  // 敵の名前カットイン：突入後にアイコン＋名前が左右から“ポンポン”と飛び込む（敵に目が向くように）
  cutins(refs, boss) {
    const layer = this.layer(), N = refs.length;
    refs.forEach((m, i) => {
      const n = document.createElement("div");
      n.className = "rpg-cutin " + (boss ? "boss " : "") + (i % 2 ? "r" : "l");
      n.style.setProperty("--d", (0.34 + i * 0.16) + "s");
      n.style.setProperty("--y", (N > 1 ? 30 + i * 13 : 40) + "%");
      const ic = document.createElement("span"); ic.className = "ci-ic"; ic.textContent = m.ic || "👾";
      const nm = document.createElement("span"); nm.className = "ci-nm"; nm.textContent = m.n || "なぞの影";
      n.appendChild(ic); n.appendChild(nm);
      layer.appendChild(n);
      setTimeout(() => { try { rpgSfx(boss ? "alert" : "tick"); } catch (e) {} }, (0.34 + i * 0.16) * 1000 + 40);
      setTimeout(() => n.remove(), 1550 + i * 160);
    });
  },
  // フロア切替の余韻：ゆっくり暗転→フロア名がふわっと浮かぶ→明転（cbは暗転しきった頃に呼ぶ）
  floorCard(name, sub, accent, cb) {
    const ac = accent ? "rgb(" + accent[0] + "," + accent[1] + "," + accent[2] + ")" : "#7fd0ff";
    const n = document.createElement("div"); n.className = "rpg-floorcard"; n.style.setProperty("--fc", ac);
    n.innerHTML = '<div class="fc-bg"></div><div class="fc-inner"><div class="fc-sub"></div><div class="fc-name"></div><div class="fc-line"></div></div>';
    n.querySelector(".fc-sub").textContent = sub || ""; n.querySelector(".fc-name").textContent = name || "";
    this.layer().appendChild(n);
    if (cb) setTimeout(cb, 850);
    setTimeout(() => n.remove(), 2300);
  },
  // 初回だけ操作ガイドをそっと出す（？を能動的にタップしなくても一度は目に入るように・オンボーディング3点セット）
  tutorial(text) {
    if (document.getElementById("rpg-tut-toast")) return;   // 二重表示防止
    const n = document.createElement("div"); n.id = "rpg-tut-toast"; n.className = "rpg-tut-toast"; n.textContent = text;
    this.layer().appendChild(n);
    setTimeout(() => n.remove(), 5200);
  },

};
// SPゲージ加算＝MAX到達の瞬間に「ぱほぱほMAX！」を一度だけ告知（演出の欠落を補う）
function rpgAddGauge(b, amt) {
  if (!b) return; const was = b.gauge || 0;
  b.gauge = Math.min(100, was + amt);
  if (was < 100 && b.gauge >= 100) { rpgFx.banner("✨ ぱほぱほMAX！", "victory"); rpgSfx("streak"); }
}
// 🎯 自動ターゲット：弱点が判明していて手持ち技で突ける敵を優先、いなければHP最少の敵（パズドラ式＝狙いのタップ不要）
function rpgAutoPickTarget() {
  const b = RPG && RPG.battle; if (!b) return;
  const d = rpgData();
  const alive = b.enemies.map((e, i) => ({ e, i })).filter(o => o.e.alive);
  if (!alive.length) return;
  const weak = alive.find(o => { const w = d.codex[o.e.id] && d.codex[o.e.id].weak; return w && w.some(el => d.skills.some(id => RPG_SKILLS[id].el === el && d.mp >= RPG_SKILLS[id].mp)); });
  const target = weak || alive.reduce((a, o) => (o.e.hp < a.e.hp ? o : a), alive[0]);
  b.target = target.i;
}
// 🤖 オートバトル：頻発戦闘をノーストレスに（必殺優先→低HPなら回復→弱点技→通常）。手で技を押せばその場だけ手動。
function rpgAutoBattleTick() {
  const b = RPG && RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy || !b.auto) return;
  if ((b.gauge || 0) >= 100) { rpgUltimate(); return; }
  if (d.hp <= d.maxhp * 0.3 && d.skills.indexOf("heal") >= 0 && d.mp >= RPG_SKILLS.heal.mp && b.pstatus.seal <= 0) { rpgUseSkill("heal"); return; }
  rpgAutoPickTarget();
  const tg = b.enemies[b.target], known = tg && d.codex[tg.id] && d.codex[tg.id].weak ? d.codex[tg.id].weak : [];
  let pick = null;
  for (let k = 0; k < d.skills.length; k++) { const sk = RPG_SKILLS[d.skills[k]]; if (sk.el !== "heal" && known.indexOf(sk.el) >= 0 && d.mp >= sk.mp) { pick = d.skills[k]; break; } }
  rpgUseSkill(pick || "atk");
}
function rpgToggleBtlAuto() { const b = RPG && RPG.battle; if (!b) return; b.auto = !b.auto; rpgSfx("nav"); renderMallRpg(); }
function rpgEnemyEl(i) { return document.getElementById("rpg-enemy-" + i); }
function rpgPlayerEl() { return document.getElementById("rpg-mimichar") || document.getElementById("rpg-bhud"); }
// canvas戦闘の座標→画面座標（FX配置用）
function rpgScenePt(sx, sy) { const cv = RPG && RPG._btlCv; if (!cv || !cv.getBoundingClientRect) return { x: (window.innerWidth || 360) / 2, y: (window.innerHeight || 600) / 2 }; const r = cv.getBoundingClientRect(); return { x: r.left + sx / cv.width * r.width, y: r.top + sy / cv.height * r.height }; }
function rpgEnemyPt(i) { const cv = RPG && RPG._btlCv, nn = RPG.battle ? RPG.battle.enemies.length : 1; const L = rpgIsoLayout(cv ? cv.width : 520, cv ? cv.height : 300, nn); const s = L.slots[i] || L.slots[0]; return rpgScenePt(s.x, s.y - 30); }
function rpgPlayerPt() { const cv = RPG && RPG._btlCv, nn = RPG.battle ? RPG.battle.enemies.length : 1; const L = rpgIsoLayout(cv ? cv.width : 520, cv ? cv.height : 300, nn); return rpgScenePt(L.mimi.x, L.mimi.y - 30); }

function rpgEncounter(kind) {
  const boss = kind === true || kind === "boss";        // 屋上ボス
  const nushi = kind === "nushi";                        // 🐲 フロアの主（ミニボス）
  const ncfg = nushi ? (rpgFloorMeta(RPG.fi) || {}).nushi : null;
  let ids;
  if (boss) ids = ["boss1"];
  else if (nushi && ncfg) ids = [ncfg.base];
  else {
    const pool = (rpgFloorMeta(RPG.fi) || {}).foes;   // フロア別テーマの出現テーブル（無ければ従来の全体抽選）
    const n = Math.random() < 0.45 ? 2 : 1;
    ids = []; for (let i = 0; i < n; i++) ids.push(pool && pool.length ? rpgPick(pool) : (Math.random() < 0.82 ? rpgPick(RPG_TOURISTS) : rpgPick(RPG_MONSTERS_MINOR.concat(RPG_KUNLUN))));
  }
  const sc = 1 + RPG.fi * 0.22, scR = 1 + RPG.fi * 0.3;   // 上の階ほど手応えUP
  const enemies = ids.map(id => {
    const m = RPG_MONS[id];
    let hp = boss ? m.hp : Math.round(m.hp * sc), atk = boss ? m.atk : Math.round(m.atk * sc), exp = Math.round(m.exp * scR), gold = Math.round(m.gold * scR), ref = m;
    if (nushi && ncfg) {                                  // 主＝強化＋固有名・大きめ報酬
      hp = Math.round(hp * 2.0); atk = Math.round(atk * 1.35); exp = Math.round(exp * 2.6); gold = Math.round(gold * 2.3);
      ref = Object.assign({}, m, { n: ncfg.n, ic: ncfg.ic, nushi: true });
    }
    return { id, ref, hp, maxhp: hp, alive: true, atk, exp, gold };
  });
  const rare = !boss && !nushi && Math.random() < 0.1;   // ✨おたからチャンス（射幸性）
  RPG.battle = { enemies, target: 0, extra: false, acts: 1, combo: 0, gauge: 0, guard: false, log: [], boss: !!boss, nushi: !!nushi, phase: "cmd", sub: null, rare: rare, introT0: (typeof performance !== "undefined" ? performance.now() : Date.now()),
    pstatus: { stun: 0, defdown: 0, dazzle: 0, seal: 0 } };
  RPG.mode = "battle"; RPG.busy = false;
  rpgComputeIntents();               // 敵の行動予告（読み合い）
  rpgBLog(boss ? `🎡 ${enemies[0].ref.n} が立ちはだかった！` : (nushi ? `👑 フロアの主「${enemies[0].ref.n}」が現れた！` : (rare ? `✨ おたからチャンス！ ${enemies.map(e => e.ref.n).join("・")}（ごほうび倍）` : `🎫 ${enemies.map(e => e.ref.n).join("・")} に囲まれた！`)));
  rpgSfx(rare ? "win" : "alert");
  rpgFx.encounter(boss || nushi ? "boss" : (rare ? "rare" : "enc"));   // バトル突入トランジション
  rpgFx.cutins(enemies.map(e => e.ref), boss || nushi);               // 敵名カットイン（ポンポン）
  rpgFx.shakeApp();
  renderMallRpg();
}
function rpgBLog(t, cls) { if (RPG && RPG.battle) { RPG.battle.log.unshift({ t, cls: cls || "" }); RPG.battle.log = RPG.battle.log.slice(0, 6); } }
function rpgAliveEnemies() { return RPG.battle.enemies.filter(e => e.alive); }
function rpgPlayerPow() { return 5 + rpgData().lv * 2 + rpgUpLv("pow") * 2; }

// 弱点・耐性の倍率
function rpgMult(mon, el) {
  if (el === "phys" && mon.nul.indexOf("phys") >= 0) return 0;
  if (mon.nul.indexOf(el) >= 0) return 0;
  if (mon.weak.indexOf(el) >= 0) return 1.9;
  if (mon.resist.indexOf(el) >= 0) return 0.5;
  return 1;
}
function rpgCodexLearn(id, el) {
  const d = rpgData();
  if (!d.codex[id]) d.codex[id] = { weak: [] };
  if (d.codex[id].weak.indexOf(el) < 0) { d.codex[id].weak.push(el); return true; }
  return false;
}

function rpgSelectTarget(i) {
  if (!RPG || RPG.mode !== "battle" || RPG.busy) return;
  if (RPG.battle.enemies[i] && RPG.battle.enemies[i].alive) { RPG.battle.target = i; renderMallRpg(); }
}
function rpgOpenSkills() { if (RPG && RPG.battle && RPG.battle.phase === "cmd" && !RPG.busy) { RPG.battle.sub = "skills"; renderMallRpg(); } }
function rpgOpenItems() { if (RPG && RPG.battle && RPG.battle.phase === "cmd" && !RPG.busy) { RPG.battle.sub = "items"; renderMallRpg(); } }
function rpgCmdBack() { if (RPG && RPG.battle && !RPG.busy) { RPG.battle.sub = null; renderMallRpg(); } }

function rpgUseSkill(id) {
  const b = RPG.battle, d = rpgData(), sk = RPG_SKILLS[id];
  if (!b || b.phase !== "cmd" || RPG.busy || !sk) return;
  if (sk.mp > 0 && b.pstatus.seal > 0) { rpgBLog("🍙 おなかいっぱいで技が出せない！", ""); renderMallRpg(); return; }
  if (d.mp < sk.mp) { rpgBLog("MPが足りない！", ""); renderMallRpg(); return; }
  b.sub = null;
  // ✨チカチカ：攻撃がたまに外れる（回復はミスしない・MPは消費しない）
  if (sk.el !== "heal" && b.pstatus.dazzle > 0 && Math.random() < 0.3) {
    rpgBLog("✨ 目がチカチカして攻撃を外した！", "");
    rpgFx.banner("MISS", "miss");
    RPG.busy = true; b.phase = "anim"; rpgSave();
    setTimeout(() => rpgAfterAct(false), 380);
    return;
  }
  d.mp -= sk.mp;
  if (sk.el === "heal") {
    const h = sk.heal + d.lv * 2;
    d.hp = Math.min(d.maxhp, d.hp + h);
    rpgBLog(`💚 ${sk.n}！ HPが${h}回復した。`, "good");
    rpgSfx("unlock");
    RPG.busy = true; b.phase = "anim";
    (function(){ const p = rpgPlayerPt(); rpgFx.spot(p.x, p.y, "+" + h, "heal"); })(); rpgFx.flash("heal");
    rpgSave();
    setTimeout(() => rpgAfterAct(false), 440);
    return;
  }
  // 攻撃（モーション：予備動作→踏み込み→着弾＝ヒットストップ→戻り）
  let tgt = b.enemies[b.target];
  if (!tgt || !tgt.alive) tgt = rpgAliveEnemies()[0];
  if (!tgt) { rpgAfterAct(false); return; }
  const ti = b.enemies.indexOf(tgt);
  const mult = rpgMult(tgt.ref, sk.el), weakHit = mult >= 1.9;
  const dmg = mult === 0 ? 0 : Math.max(1, Math.round((sk.pow + rpgPlayerPow() * 0.6) * mult * rpgRnd(0.9, 1.1)));
  const now0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const freeze = weakHit ? 120 : (dmg ? 70 : 40), total = 240 + freeze + (weakHit ? 90 : 220);   // 弱点は戻りを短縮＝もう1回へ素早く
  b.anim = { who: "mimi", tIdx: ti, t0: now0, contactAt: now0 + 240, freeze: freeze, knock: weakHit ? 18 : 12, shakeMag: weakHit ? 14 : 8, burst: { col: RPG_EL_BURST[sk.el] || "#fff", n: weakHit ? 16 : 12, r: 34 } };
  RPG.busy = true; b.phase = "anim"; rpgSfx("tick"); rpgSave();
  setTimeout(() => {   // ── 着弾
    if (!RPG || !RPG.battle) return;
    const ep = rpgEnemyPt(ti);
    if (mult === 0) { rpgBLog(`${RPG_ELEM_IC[sk.el]} ${sk.n}！ …${tgt.ref.n}には効かない！`, ""); rpgSfx("tick"); rpgFx.spot(ep.x, ep.y, "NULL", "nullx"); }
    else {
      tgt.hp -= dmg; tgt._flash = (typeof performance !== "undefined" ? performance.now() : Date.now());
      rpgAddGauge(b, weakHit ? 22 : 12);
      let tag = "";
      if (weakHit) { tag = " 弱点!"; b.combo = (b.combo || 0) + 1; rpgGoalBump("weak", 1);
        const hh = 5 + Math.floor(d.lv * 0.8); d.hp = Math.min(d.maxhp, d.hp + hh); const pp = rpgPlayerPt(); rpgFx.spot(pp.x, pp.y - 16, "+" + hh, "heal");   // 弱点ヒット＝巧く戦うと回復（反射タイミングではなく戦略）
        if (rpgCodexLearn(tgt.id, sk.el)) rpgBLog(`📖 ${tgt.ref.n}の弱点「${RPG_ELEM[sk.el]}」を見つけた！`, "good"); }
      else if (mult === 0.5) tag = " 耐性…";
      rpgBLog(`${RPG_ELEM_IC[sk.el]} ${sk.n}！ ${tgt.ref.n}に${dmg}ダメージ${tag}`, weakHit ? "good" : "");
      rpgSfxV(weakHit ? "win" : "tick");
      rpgFx.spot(ep.x, ep.y, "-" + dmg, weakHit ? "weak" : (mult === 0.5 ? "resist" : "dmg"));
      if (weakHit) rpgFx.banner("WEAK!", "weak");
      if (tgt.hp <= 0) { tgt.alive = false; tgt._deadAt = (typeof performance !== "undefined" ? performance.now() : Date.now()); b.combo = (b.combo || 0) + 1; const tourist = tgt.ref.kind === "tourist"; rpgBLog(`${tourist ? "😌" : "💥"} ${tgt.ref.n}${tourist ? "は満足して帰っていった！" : "を倒した！"}`, "good"); rpgSfxV("coin"); rpgFx.spot(ep.x, ep.y - 34, tourist ? "満足♪" : "撃破！", "weak"); rpgFx.shakeApp();
        if (tgt.ref.nushi) { RPG._nushiBeat = RPG._nushiBeat || {}; RPG._nushiBeat[RPG.fi] = 1; rpgFx.banner("👑 主を討伐！", "victory"); rpgSfx("unlock"); rpgBLog(`👑 フロアの主「${tgt.ref.n}」を討伐！ ✨評判UP`, "win"); RPG.runMissions = (RPG.runMissions || 0) + 1; } }
      if ((b.combo || 0) >= 3) rpgFx.banner("COMBO ×" + b.combo, "more");
    }
    rpgSave();
  }, 240);
  setTimeout(() => { if (RPG && RPG.battle) { b.anim = null; rpgAfterAct(weakHit); } }, total);
}
function rpgUseItem(kind) {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy) return;
  let fx = null;
  if (kind === "potion") {
    if ((d.items.potion || 0) <= 0) return;
    d.items.potion--; d.hp = Math.min(d.maxhp, d.hp + 40);
    const had = b.pstatus.stun || b.pstatus.defdown || b.pstatus.dazzle || b.pstatus.seal;
    b.pstatus.stun = b.pstatus.defdown = b.pstatus.dazzle = b.pstatus.seal = 0;
    rpgBLog("🧪 回復薬！ HP+40。" + (had ? "（状態もすっきり！）" : ""), "good"); fx = "+40";
  } else if (kind === "ether") {
    if ((d.items.ether || 0) <= 0) return;
    d.items.ether--; d.mp = Math.min(d.maxmp, d.mp + 20);
    rpgBLog("🔵 マナ水！ MP+20。", "good"); fx = "MP+20";
  } else return;
  b.sub = null; rpgSfx("unlock");
  RPG.busy = true; b.phase = "anim";
  if (fx) { (function(){ const p = rpgPlayerPt(); rpgFx.spot(p.x, p.y, fx, "heal"); })(); rpgFx.flash("heal"); }
  rpgSave();
  setTimeout(() => rpgAfterAct(false), 440);
}
function rpgFlee() {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy) return;
  if (b.boss) { rpgBLog("ボスからは逃げられない！", ""); rpgFx.banner("逃げられない！", "bad"); renderMallRpg(); return; }
  RPG.busy = true;
  if (Math.random() < 0.5 + d.lv * 0.02) {
    rpgBLog("🏃 うまく逃げ切った！", "good");
    RPG.battle = null; RPG.mode = "explore"; RPG.grace = 2; RPG.busy = false;
    renderMallRpg();
  } else {
    rpgBLog("逃げられなかった…！", "");
    b.phase = "anim"; renderMallRpg();
    setTimeout(() => rpgEnemyTurn(), 360);
  }
}
// プレイヤー1行動の締め（weakHit=弱点ヒットしたか）。弱点で+1行動（最大3）。
function rpgAfterAct(weakHit) {
  if (!RPG || !RPG.battle) return;
  const b = RPG.battle;
  if (rpgAliveEnemies().length === 0) { RPG.busy = true; b.phase = "anim"; setTimeout(() => { if (RPG && RPG.battle) rpgBattleWin(); }, 560); return; }   // 撃破の余韻を見せてから勝利へ
  if (weakHit && (b.acts || 1) < 3) { b.acts = (b.acts || 1) + 1; rpgFx.banner("1 MORE!", "more"); rpgBLog("✨ 弱点を突いた！ もう1回！", "good"); }
  b.acts = (b.acts || 1) - 1;
  if (b.acts > 0) { b.phase = "cmd"; RPG.busy = false; rpgSave(); renderMallRpg(); return; }
  rpgEnemyTurn();
}
// 敵の行動予告（インテント）：このあと攻撃か特技かを事前決定して見せる＝読み合い
function rpgComputeIntents() {
  const b = RPG.battle; if (!b) return;
  b.enemies.forEach(e => {
    if (!e.alive) { e.intent = null; return; }
    const sp = e.ref.sp;
    if (sp && Math.random() < sp.chance) e.intent = { sp: true, status: sp.status, name: sp.name, dmg: sp.dmg ? Math.round((e.atk || e.ref.atk) * 0.8) : 0 };
    else e.intent = { sp: false, dmg: Math.round(e.atk || e.ref.atk) };
  });
}
// 敵ターン＝1体ずつ順番に演出
function rpgEnemyTurn() {
  if (!RPG || !RPG.battle) return;
  const b = RPG.battle;
  b.phase = "enemy"; RPG.busy = true; b.sub = null;
  rpgFx.turn("ENEMY TURN", "foe");
  rpgSave(); renderMallRpg();                 // 敵HPを反映＆コマンドを隠す
  b._eq = rpgAliveEnemies().slice();
  setTimeout(() => rpgEnemyStep(0), 460);
}
function rpgEnemyStep(idx) {
  if (!RPG || !RPG.battle || RPG.mode !== "battle") return;
  const b = RPG.battle, d = rpgData(), list = b._eq || [];
  if (idx >= list.length) { rpgSave(); rpgToPlayer(); return; }
  const e = list[idx];
  if (!e.alive) { rpgEnemyStep(idx + 1); return; }
  const ei = b.enemies.indexOf(e);
  const gf = b.guard ? 0.5 : 1, dmgMult = (b.pstatus.defdown > 0 ? 1.5 : 1) * gf;
  const sp = e.ref.sp, useSp = !!((e.intent || {}).sp && sp);
  let dealt = 0;
  if (useSp) { if (sp.dmg) dealt = Math.max(1, Math.round((e.atk || e.ref.atk) * 0.8 * dmgMult * rpgRnd(0.85, 1.15) - Math.floor(d.lv * 0.6))); }
  else dealt = Math.max(1, Math.round((e.atk || e.ref.atk) * dmgMult * rpgRnd(0.85, 1.15) - Math.floor(d.lv * 0.6)));
  if (dealt > 0) dealt = Math.max(1, Math.round(dealt * (1 - rpgUpLv("def") * 0.06)));   // 🛡️守りの心得（恒久強化）
  e.intent = null;
  const now0 = (typeof performance !== "undefined" ? performance.now() : Date.now()), freeze = 70, total = 230 + freeze + 200;
  b.anim = { who: "enemy", aIdx: ei, t0: now0, contactAt: now0 + 230, freeze: freeze, knock: dealt > 0 ? 12 : 0, shakeMag: dealt > 0 ? 9 : 0, burst: dealt > 0 ? { col: "#ff6b6b", n: 12, r: 30 } : null };
  setTimeout(() => {   // ── 着弾
    if (!RPG || !RPG.battle) return;
    if (useSp) {
      b.pstatus[sp.status] = Math.max(b.pstatus[sp.status] || 0, sp.dur);
      let line = `${e.ref.ic} ${sp.name}！ ${RPG_STATUS[sp.status].ic}${sp.msg}`;
      if (sp.dmg) { d.hp -= dealt; line += ` ${dealt}ダメージ。`; }
      rpgBLog(line, "bad"); rpgFx.banner(RPG_STATUS[sp.status].ic + " " + RPG_STATUS[sp.status].n + "！", "bad");
    } else {
      d.hp -= dealt;
      rpgBLog(`${e.ref.ic} ${e.ref.act || (e.ref.n + "の攻撃！")}${b.guard ? "（ガード）" : ""} ${dealt}ダメージ。`, "bad");
    }
    if (dealt > 0) {
      b.combo = 0; rpgAddGauge(b, 15); const p = rpgPlayerPt(); rpgFx.spot(p.x, p.y, "-" + dealt, "pdmg"); rpgFx.flash("hurt"); rpgSfxV("tick");
      // 低HP警告：25%以下に踏み込んだ瞬間に一度だけ「ピンチ！」
      const hpWas = d.hp + dealt;
      if (d.hp > 0 && d.hp <= d.maxhp * 0.25 && hpWas > d.maxhp * 0.25) { rpgFx.banner("⚠️ ピンチ！", "bad"); rpgFx.flash("hurt"); rpgSfx("alert"); }
    }
    rpgSave();
    if (d.hp <= 0) { d.hp = 0; b.anim = null; setTimeout(() => rpgBattleLose(), 380); }
  }, 230);
  setTimeout(() => { if (!RPG || !RPG.battle || d.hp <= 0) return; b.anim = null; rpgEnemyStep(idx + 1); }, total);
}
// 敵ターン後→プレイヤーへ（状態の持続処理＋めまいで行動スキップ）
function rpgToPlayer() {
  const b = RPG.battle;
  ["defdown", "dazzle", "seal"].forEach(k => { if (b.pstatus[k] > 0) b.pstatus[k]--; });
  b.sub = null;
  if (b.pstatus.stun > 0) {
    b.pstatus.stun--; b.phase = "wait"; RPG.busy = true;
    rpgBLog("💫 目がまわって動けない！", "bad"); rpgFx.banner("💫 めまい…", "bad");
    rpgSave(); renderMallRpg();
    setTimeout(() => { if (RPG && RPG.battle && RPG.mode === "battle") rpgEnemyTurn(); }, 900);
    return;
  }
  b.guard = false;                                   // ガードは1ターンで解除
  b.phase = "cmd"; b.acts = 1; RPG.busy = false;
  rpgFx.turn("YOUR TURN", "you");
  rpgComputeIntents();                               // 次の敵の行動を予告
  rpgSave(); renderMallRpg();
}
// 🛡️ ガード（被ダメ半減＋ゲージ）
function rpgGuard() {
  const b = RPG.battle;
  if (!b || b.phase !== "cmd" || RPG.busy) return;
  b.guard = true; rpgAddGauge(b, 12); b.sub = null;
  rpgBLog("🛡️ みをまもった！", "good"); rpgSfx("unlock");
  RPG.busy = true; b.phase = "anim"; rpgSave();
  setTimeout(() => rpgAfterAct(false), 300);
}
// ✨ 必殺技「スーパーぱほぱほ」＝全体に大ダメージ（ゲージ満タンで）
function rpgUltimate() {
  const b = RPG.battle, d = rpgData();
  if (!b || b.phase !== "cmd" || RPG.busy || (b.gauge || 0) < 100) return;
  b.gauge = 0; b.sub = null;
  rpgBLog("✨ スーパーぱほぱほ！！", "win"); rpgFx.banner("✨ぱほぱほ✨", "victory"); rpgSfx("win");
  b.enemies.forEach((e, i) => {
    if (!e.alive) return;
    const mult = Math.max(1, rpgMult(e.ref, "force"));   // 耐性無視（最低等倍）
    const dmg = Math.max(1, Math.round((34 + rpgPlayerPow() * 1.4) * mult * rpgRnd(0.95, 1.1)));
    e.hp -= dmg;
    e._flash = (typeof performance !== "undefined" ? performance.now() : Date.now()); const ep2 = rpgEnemyPt(i); rpgFx.spot(ep2.x, ep2.y, "-" + dmg, "weak");
    if (e.hp <= 0) { e.alive = false; e._deadAt = (typeof performance !== "undefined" ? performance.now() : Date.now()); const tourist = e.ref.kind === "tourist"; rpgBLog(`${tourist ? "😌" : "💥"} ${e.ref.n}${tourist ? "は満足して帰っていった！" : "を倒した！"}`, "good"); rpgSfxV("coin"); rpgFx.spot(ep2.x, ep2.y - 34, tourist ? "満足♪" : "撃破！", "weak"); }
  });
  rpgFx.shakeApp();
  RPG.busy = true; b.phase = "anim"; rpgSave();
  setTimeout(() => rpgAfterAct(false), 620);
}
function rpgBattleWin() {
  const b = RPG.battle, d = rpgData();
  let exp = 0, gold = 0;
  b.enemies.forEach(e => { exp += (e.exp || e.ref.exp); gold += (e.gold || e.ref.gold); });
  const combo = b.combo || 0, cmult = 1 + Math.min(combo, 25) * 0.06;
  exp = Math.round(exp * cmult); gold = Math.round(gold * cmult);
  if (b.rare) { gold = Math.round(gold * 2.5); exp = Math.round(exp * 1.5); }   // ✨おたからチャンス
  d.exp += exp; d.gold += gold;
  if (RPG) RPG.runKills = (RPG.runKills || 0) + b.enemies.length;   // ⭐評判の算出に反映
  rpgGoalBump("defeat", b.enemies.length); if (b.boss) rpgGoalBump("boss", 1); rpgGoalSync();   // フロア・ミッション進捗
  if (combo > (d.records.combo || 0)) d.records.combo = combo;
  rpgBLog(`🎉 勝利！ EXP+${exp}・ゴールド+${gold}` + (b.rare ? `（✨おたからチャンス！）` : "") + (combo >= 2 ? `（COMBO×${combo}・報酬+${Math.round((cmult - 1) * 100)}%）` : ""), "win");
  // ボス：図鑑クリア＋衣装ドロップ
  let outfit = null;
  if (b.boss) {
    d.cleared = true;
    d.items.calm = (d.items.calm || 0) + 2;   // 🔕 制覇のごほうび：静けさのお香（探索が一気にラクに）
    outfit = rpgGrantOutfit("r") || rpgGrantOutfit("c");
    if (outfit) rpgBLog(`👑 屋上制覇！ ごほうびの衣装「${outfit.name}」と🔕静けさのお香×2を手に入れた！`, "win");
    else rpgBLog(`👑 屋上制覇！ ごほうびに🔕静けさのお香×2を手に入れた！`, "win");
  } else if (Math.random() < 0.06) {
    outfit = rpgGrantOutfit("c");
    if (outfit) rpgBLog(`👑 魔物が衣装「${outfit.name}」を落とした！`, "win");
  }
  // レベルアップ判定
  const ups = rpgCheckLevel();
  RPG.mode = "won"; RPG.busy = false;
  RPG.flash = { exp, gold, ups, outfit, boss: b.boss, combo };
  rpgBumpRecords();
  rpgSfx("win"); rpgSave();
  rpgFx.banner(b.boss ? "👑 CLEAR!" : "VICTORY!", "victory");
  if (combo >= 5) setTimeout(() => rpgFx.banner("COMBO ×" + combo + "!", "more"), 360);
  if (ups.length) setTimeout(() => rpgFx.banner("LEVEL UP!", "levelup"), 620);
  renderMallRpg();
}
function rpgBattleLose() {
  const d = rpgData();
  rpgBLog("…目の前が真っ暗になった。", "bad");
  RPG.mode = "lost"; RPG.busy = false;
  rpgSfx("alert"); rpgSave();
  rpgFx.banner("DOWN…", "down");
  renderMallRpg();
}
function rpgExpNext(lv) { return 12 + lv * lv * 6; }
function rpgCheckLevel() {
  const d = rpgData(); const gained = [];
  while (d.exp >= rpgExpNext(d.lv)) {
    d.exp -= rpgExpNext(d.lv);
    d.lv++;
    d.maxhp += 8; d.maxmp += 4;
    d.hp = d.maxhp; d.mp = d.maxmp;          // レベルアップで全回復
    const learn = RPG_LEARN[d.lv] || [];
    learn.forEach(s => { if (d.skills.indexOf(s) < 0) d.skills.push(s); });
    gained.push({ lv: d.lv, learn });
    if (d.lv > (d.best.lv || 1)) d.best.lv = d.lv;
  }
  return gained;
}
function rpgGrantOutfit(band) {
  if (typeof OUTFITS === "undefined") return null;
  const ranges = { c: [0, 8000], r: [8001, 30000], l: [30001, Infinity] };
  const [lo, hi] = ranges[band] || ranges.c;
  const pool = OUTFITS.filter(o => o.acquire && o.acquire.price != null && o.acquire.price >= lo && o.acquire.price <= hi && !outfitOwned(o));
  if (!pool.length) return null;
  const o = rpgPick(pool);
  if (!state.player.outfitsWon) state.player.outfitsWon = [];
  state.player.outfitsWon.push(o.id);
  rpgSave();
  return o;
}

// ── 戦闘後の遷移
function rpgAfterWin() {
  if (!RPG) return;
  RPG.battle = null; RPG.flash = null; RPG.grace = 1;
  RPG.mode = "explore";
  renderMallRpg();
}
function rpgAfterLose() {
  const d = rpgData();
  d.hp = Math.max(1, Math.floor(d.maxhp * 0.5));   // ソフト：気絶して入口へ（罰は軽め）
  rpgFinishRun("lost");   // 倒れても📦今回の成果を見せる（持ち帰った物を可視化）
}

// =========================================================================
// 休息・店（ハブ）
// =========================================================================
function rpgRest() { const d = rpgData(); d.hp = d.maxhp; d.mp = d.maxmp; rpgSave(); renderMallRpg(); }
function rpgBuy(kind) {
  const d = rpgData();
  const price = { potion: 20, ether: 30, calm: 80 }[kind];
  if (price == null || d.gold < price) return;
  d.gold -= price;
  d.items[kind] = (d.items[kind] || 0) + 1;
  rpgSfx("unlock"); rpgSave();
  renderMallRpg();
}

// =========================================================================
// 🛍️ ショッピング（モールに来る理由＝買い物を楽しむ。各フロア限定の品＝次の階へ行きたくなる引き）
//    着る👗／飾る🪴／集める🐚／食べ歩き🍧 の4カテゴリ。すべて表示・コレクション（レース数値に非干渉）
// =========================================================================
const RPG_SHOP_CAT = { wear: { ic: "👗", n: "ファッション" }, decor: { ic: "🪴", n: "ざっか" }, souv: { ic: "🐚", n: "おみやげ" }, food: { ic: "🍧", n: "グルメ" } };
const RPG_SHOPS = [
  [ // 1F ビーチサイド
    { id: "b_hat", ic: "👒", n: "むぎわら帽子", cat: "wear", price: 80 },
    { id: "b_sandal", ic: "🩴", n: "ビーチサンダル", cat: "wear", price: 60 },
    { id: "b_shell", ic: "🐚", n: "貝がらネックレス", cat: "souv", price: 70 },
    { id: "b_parasol", ic: "⛱️", n: "ビーチパラソル", cat: "decor", price: 120 },
    { id: "b_ice", ic: "🍉", n: "スイカバー", cat: "food", price: 40 },
  ],
  [ // 2F プールデッキ
    { id: "p_sun", ic: "🕶️", n: "サングラス", cat: "wear", price: 90 },
    { id: "p_swim", ic: "👙", n: "リゾート水着", cat: "wear", price: 150 },
    { id: "p_float", ic: "🛟", n: "フラミンゴ浮き輪", cat: "decor", price: 110 },
    { id: "p_flam", ic: "🦩", n: "フラミンゴの置物", cat: "decor", price: 130 },
    { id: "p_drink", ic: "🍹", n: "ブルーラグーン", cat: "food", price: 60 },
  ],
  [ // 3F マカイ・フードコート（アンカー＝品ぞろえ豊富）
    { id: "g_kakigori", ic: "🍧", n: "レインボーかき氷", cat: "food", price: 50 },
    { id: "g_skewer", ic: "🍢", n: "屋台の串焼き", cat: "food", price: 45 },
    { id: "g_coco", ic: "🥥", n: "ココナッツジュース", cat: "food", price: 55 },
    { id: "f_shrimp", ic: "🍤", n: "ガーリックシュリンプ", cat: "food", price: 75 },
    { id: "f_poke", ic: "🐟", n: "ポケ丼", cat: "food", price: 80 },
    { id: "f_malasada", ic: "🍩", n: "マラサダ", cat: "food", price: 40 },
    { id: "g_lantern", ic: "🏮", n: "横丁のちょうちん", cat: "decor", price: 100 },
    { id: "g_tenugui", ic: "🎏", n: "グルメ手ぬぐい", cat: "souv", price: 80 },
  ],
  [ // 4F マリンアドベンチャー
    { id: "m_dolph", ic: "🐬", n: "イルカのぬいぐるみ", cat: "souv", price: 180 },
    { id: "m_fish", ic: "🐠", n: "熱帯魚の標本", cat: "decor", price: 140 },
    { id: "m_map", ic: "🧭", n: "宝の海図", cat: "souv", price: 120 },
    { id: "m_conch", ic: "🐚", n: "大きなほら貝", cat: "souv", price: 90 },
    { id: "m_snack", ic: "🦐", n: "海鮮スナック", cat: "food", price: 60 },
  ],
  [ // 5F ラグジュアリー大通り（ハイブランド・高価格）
    { id: "l_bag", ic: "👜", n: "高級バッグ「リューカ」", cat: "wear", price: 520 },
    { id: "l_watch", ic: "⌚", n: "スイス製の腕時計", cat: "wear", price: 480 },
    { id: "l_scarf", ic: "🧣", n: "シルクのスカーフ", cat: "wear", price: 260 },
    { id: "l_perfume", ic: "🧴", n: "南国の香水", cat: "decor", price: 300 },
    { id: "l_choco", ic: "🍫", n: "ショコラ・ボックス", cat: "food", price: 120 },
    { id: "l_ring", ic: "💍", n: "ダイヤのリング", cat: "wear", price: 680 },
  ],
  [ // 6F ハレ百貨店（アンカー＝デパ地下/コスメ/ギフト）
    { id: "d_cosme", ic: "💄", n: "デパコスのリップ", cat: "wear", price: 150 },
    { id: "d_teaset", ic: "🫖", n: "高級茶器セット", cat: "decor", price: 240 },
    { id: "d_sweets", ic: "🍰", n: "デパ地下スイーツ", cat: "food", price: 80 },
    { id: "d_towel", ic: "🧺", n: "今治タオルギフト", cat: "decor", price: 130 },
    { id: "d_bear", ic: "🧸", n: "限定くまのぬいぐるみ", cat: "souv", price: 200 },
    { id: "d_gift", ic: "🎁", n: "のし付きギフト", cat: "souv", price: 160 },
  ],
  [ // 7F センターステージ（フラ・ライブ）
    { id: "s_lei", ic: "💐", n: "生花のレイ", cat: "wear", price: 110 },
    { id: "s_skirt", ic: "🌿", n: "フラのパウスカート", cat: "wear", price: 170 },
    { id: "s_uku", ic: "🪕", n: "ウクレレ", cat: "decor", price: 260 },
    { id: "s_ticket", ic: "🎫", n: "ライブのチケット半券", cat: "souv", price: 100 },
    { id: "s_photo", ic: "📸", n: "フラ記念フォト", cat: "souv", price: 90 },
    { id: "s_music", ic: "🎶", n: "オルゴール", cat: "decor", price: 150 },
  ],
  [ // 屋上 サンセットテラス
    { id: "r_photo", ic: "🌅", n: "夕日のフォト", cat: "souv", price: 200 },
    { id: "r_hat", ic: "👒", n: "つば広サンハット", cat: "wear", price: 170 },
    { id: "r_cocktail", ic: "🥂", n: "サンセットカクテル", cat: "food", price: 90 },
    { id: "r_candle", ic: "🕯️", n: "アロマキャンドル", cat: "decor", price: 150 },
    { id: "r_ring", ic: "💍", n: "記念のリング", cat: "wear", price: 320 },
  ],
];
const RPG_SHOP_TOWER = [
  { id: "t_star", ic: "⭐", n: "タワーのお守り", cat: "souv", price: 130 },
  { id: "t_crystal", ic: "🔮", n: "ふしぎな水晶", cat: "decor", price: 170 },
  { id: "t_tea", ic: "🍵", n: "天空のお茶", cat: "food", price: 85 },
];
function rpgShopFor(i) { return (i != null && i >= 0 && i < RPG_SHOPS.length) ? RPG_SHOPS[i] : RPG_SHOP_TOWER; }
function rpgOwned(id) { const d = rpgData(); return !!(d.shop && d.shop[id]); }
function rpgShopOwnedN(arr) { let o = 0; arr.forEach(it => { if (rpgOwned(it.id)) o++; }); return o; }
function rpgShopTotalOwned() { let o = 0, t = 0; RPG_SHOPS.forEach(a => a.forEach(it => { t++; if (rpgOwned(it.id)) o++; })); return { o, t }; }
function rpgOpenShop() {
  if (!RPG) return;
  RPG._ret = RPG.mode; RPG.mode = "shop";
  RPG._haggle = {};                                   // 値切り結果（来店ごとにリセット）
  const left = rpgShopFor(RPG.fi).filter(x => !rpgOwned(x.id));
  RPG._dealId = left.length ? rpgPick(left).id : null; // 本日のタイムセール（未購入から1品）
  RPG._shopMsg = "";
  rpgSfx("nav"); renderMallRpg();
}
function rpgCloseShop() { if (!RPG) return; RPG.mode = RPG._ret || "explore"; renderMallRpg(); }
// 実売価格＝定価 ×セール ×値切り（10円刻み）
function rpgItemPrice(it) {
  let p = it.price;
  if (RPG && RPG._dealId === it.id) p *= 0.8;
  const h = RPG && RPG._haggle && RPG._haggle[it.id];
  if (h) p *= h.mul;
  return Math.max(10, Math.round(p / 10) * 10);
}
// 値切り交渉（1品1回・リスクは“強気すぎ”で逆に高くなる）＝買い物をミニゲーム化
function rpgHaggle(id) {
  if (!RPG) return;
  const it = rpgShopFor(RPG.fi).find(x => x.id === id);
  if (!it || rpgOwned(id)) return;
  RPG._haggle = RPG._haggle || {}; if (RPG._haggle[id]) return;
  const r = Math.random(); let mul, msg, tag, cls;
  if (r < 0.18)      { mul = 0.7; msg = "まあ、ミミ様ったらお上手！ 特別お値引きですわ✨"; tag = "おまけしちゃう！"; cls = "victory"; rpgSfx("coin"); }
  else if (r < 0.60) { mul = 0.85; msg = "しょうがないですね…少しだけお勉強しますわ"; tag = "値切り成功！"; cls = "weak"; rpgSfx("coin"); }
  else if (r < 0.85) { mul = 1.0; msg = "うーん、これ以上はごめんなさいね？"; tag = "渋い顔…"; cls = "miss"; rpgSfx("tick"); }
  else               { mul = 1.1; msg = "あらあら、強気ですこと！ むしろ正規で、ね？"; tag = "ちょい高め…"; cls = "bad"; rpgSfx("tick"); }
  RPG._haggle[id] = { mul: mul }; RPG._shopMsg = msg;
  const np = rpgItemPrice(it), sv = it.price - np;   // 浮いた額（マイナスなら強気で割高）を明示
  rpgFx.banner(tag + (sv > 0 ? ` −${fmtCoins(sv)}` : (sv < 0 ? ` +${fmtCoins(-sv)}` : "")), cls);
  renderMallRpg();
}
function rpgBuyGoods(id) {
  const d = rpgData(), it = rpgShopFor(RPG ? RPG.fi : 0).find(x => x.id === id);
  if (!it || rpgOwned(id)) return;
  const price = rpgItemPrice(it);
  // ★E3 通貨統一：お土産は所持コイン（レースで稼ぐお金）で買う＝経済を一本化。消耗品/ガチャは冒険で稼ぐ
  //   ゴールドのまま（戦闘のシンクを残す）、衣装は戦利品として無償ドロップのまま（拾う快感を残す）。
  const coins = state.player.coins || 0;
  if (coins < price) { rpgSfx("tick"); if (RPG) RPG._shopMsg = "あら、コインが足りないみたい…"; renderMallRpg(); return; }
  const save = Math.max(0, it.price - price);           // 値切り/セールで浮いた額（成功体験を明示）
  state.player.coins = coins - price; d.shop = d.shop || {}; d.shop[id] = true;
  if (RPG) { RPG._shopMsg = save > 0 ? `お買い上げ♪ ${fmtCoins(save)}もお得でしたわね、ミミ様！` : "お買い上げ、ありがとうございますっ♪ お似合いですわ"; rpgLog(`🛍️ ${it.ic} ${it.n} を ${fmtCoins(price)} で買った！${save > 0 ? `（−${fmtCoins(save)}）` : ""}`, "good"); }
  rpgSfx("coin"); rpgFx.banner(it.ic + " おかいあげ！" + (save > 0 ? ` −${fmtCoins(save)}` : ""), "victory");
  if (typeof updateHeader === "function") updateHeader();   // 財布ヘッダ更新（通常モールの buyOutfit と同じ作法）
  rpgShopFloorReward(RPG ? RPG.fi : 0);                  // 🎀 そのフロアの品を全部そろえたら一度きりのごほうび
  rpgGrandCompCheck();                                   // 👑 全48品コンプで記念衣装＋最上位称号
  rpgSave(); renderMallRpg();
}
// 🎀 フロア・コンプ報酬：その階の品を全部そろえた瞬間（各階1回）に 🎟️＋✨ を返す（買い集めの達成感）
function rpgShopFloorReward(fi) {
  const d = rpgData(), arr = rpgShopFor(fi);
  if (!arr.length || rpgShopOwnedN(arr) < arr.length) return;
  d.shopDone = d.shopDone || {};
  if (d.shopDone[fi]) return;
  d.shopDone[fi] = true;
  d.tickets = (d.tickets || 0) + 1; d.rep = (d.rep || 0) + 5;
  const nm = rpgFloorMeta(fi).name.replace(/ .*/, "");
  rpgFx.banner(`🎀 ${nm} お買い物マスター！`, "victory");
  if (RPG) { RPG._shopMsg = `${nm}の品をぜんぶ！ さすがミミ様♪ ごほうびですわ`; rpgLog(`🎀 ${nm} コンプリート！ ごほうび 🎟️+1・✨+5`, "win"); }
  setTimeout(() => rpgSfx("unlock"), 220);
}
// 👑 グランドコンプ：全フロアの品(=48品)を制覇した瞬間（1回）に記念衣装＋大量ごほうび＋最上位称号。
function rpgGrandCompCheck() {
  const d = rpgData(), tot = rpgShopTotalOwned();
  if (tot.o < tot.t || d.grandComp) return;
  d.grandComp = true;
  d.tickets = (d.tickets || 0) + 3; d.rep = (d.rep || 0) + 20;
  const o = rpgGrantOutfit("l") || rpgGrantOutfit("r") || rpgGrantOutfit("c");   // 記念衣装（既存OUTFITSの上位帯から）
  rpgFx.banner("👑 グランドコンプリート！", "victory");
  if (RPG) { RPG._shopMsg = "ぜ、ぜんぶ…！ ミミ様こそ“モールの主”ですわ…！👑"; rpgLog(`👑 全${tot.t}品コンプ！ 称号「ドラゴンモールの主」＋🎟️×3・✨×20${o ? `・記念衣装「${o.name}」` : ""}`, "win"); }
  setTimeout(() => rpgSfx("legendary"), 300);
}
// 📖 ずかんの収集状況（称号の判定に使う）
function rpgCodexCount() {
  const d = rpgData(), ids = RPG_TOURISTS.concat(RPG_MONSTERS_MINOR, RPG_KUNLUN, ["boss1"]);
  let seen = 0; ids.forEach(id => { if (d.codex && d.codex[id]) seen++; });
  return { seen: seen, total: ids.length };
}
// 🏅 称号（トロフィー）：既存の進行から導出（保存はマイルストン到達のみ）。あと◯◯のヒント付き。
function rpgTitles() {
  const d = rpgData(), rec = d.records || {}, topI = RPG_FLOORS.length - 1;
  const tot = rpgShopTotalOwned(), cx = rpgCodexCount();
  const anyFloorComp = !!(d.shopDone && Object.keys(d.shopDone).some(k => d.shopDone[k]));
  return [
    { ic: "🌿", n: "モール制覇者", got: !!d.cleared, hint: `屋上まで あと${Math.max(0, topI - (rec.floor || 0))}フロア` },
    { ic: "🎀", n: "お買い物名人", got: anyFloorComp, hint: "どこか1フロアをコンプ" },
    { ic: "👑", n: "ドラゴンモールの主", got: tot.o >= tot.t, hint: `全品まで あと${tot.t - tot.o}品` },
    { ic: "🌟", n: "天空の登頂者", got: (rec.depth || 0) >= 10, hint: `タワー10層（いま${rec.depth || 0}層）` },
    { ic: "📖", n: "すれちがい博士", got: cx.seen >= cx.total, hint: `ずかん あと${cx.total - cx.seen}体` },
  ];
}
// いま名乗れる最上位の称号（ハブのチップ用・優先度＝主＞登頂者＞博士＞制覇者＞名人）
function rpgTopTitle() {
  const t = rpgTitles(), order = ["ドラゴンモールの主", "天空の登頂者", "すれちがい博士", "モール制覇者", "お買い物名人"];
  for (const n of order) { const m = t.find(x => x.n === n && x.got); if (m) return m; }
  return null;
}

// =========================================================================
// 描画
// =========================================================================
let _rpgKeyBound = false;
function rpgBindKeys() {
  if (_rpgKeyBound) return; _rpgKeyBound = true;
  document.addEventListener("keydown", (e) => {
    if (state.ui.screen !== "mall_rpg" || !RPG || RPG.mode !== "explore") return;
    if (e.key === "ArrowUp") { rpgForward(1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { rpgForward(-1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { rpgTurn(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { rpgTurn(1); e.preventDefault(); }
  });
}

function renderMallRpg(flash) {
  if (typeof mallUnlocked === "function" && !mallUnlocked()) {   // Ⓑ 親mallと同じ条件でゲート（モールがロック中は大冒険も閉じる）。
    if (typeof renderHome === "function") renderHome();
    // ★ロック案内で章題（＝未登場の顧問名）は出さない。予告は「第N話を読むと開放」までに留める。
    // 解禁条件の文は chapterUnlockHint（data_assets.js・実績ゲートの正本）から引く＝化石テキスト防止。
    const _rpgH2 = (typeof chapterUnlockHint === "function" && chapterUnlockHint("2")) || "";
    if (typeof showInfoPopup === "function") showInfoPopup("🛍️ お買い物ダンジョン",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small><u>第2話</u>を読むとモールが解放されます${_rpgH2 ? `（第2話は${_rpgH2}）` : ""}。</small></div></div>`);
    return;
  }
  state.ui.screen = "mall_rpg";
  if (window.Dialogue && Dialogue.dismiss) Dialogue.dismiss();
  rpgBindKeys();
  const app = beginScreen();
  if (RPG_REVEAL) return rpgRenderReveal(app);          // ガチャ/宝箱の演出は最優先
  if (RPG && RPG.mode === "ascend") return rpgRenderAscend(app);
  if (RPG && RPG.mode === "shop") return rpgRenderShop(app);
  if (RPG && RPG.mode === "explore") return rpgRenderExplore(app);
  if (RPG && RPG.mode === "battle") return rpgRenderBattle(app);
  if (RPG && RPG.mode === "won") return rpgRenderWon(app);
  if (RPG && RPG.mode === "lost") return rpgRenderLost(app);
  if (RPG && RPG.mode === "result") return rpgRenderResult(app);
  if (RPG && RPG.mode === "summary") return rpgRenderSummary(app);
  return rpgRenderHub(app);
}

// ── ハブ（情報の見え方：主役=冒険を1つ立て、副次情報は折りたたみ＋！バッジ・？モーダル）
// ⚠️【重要】この rpgRenderHub は js/ui_mall_rpg.js が後勝ちで“全文再定義”して上書きします
//   （index.html で ui_mall_rpg.js を後に読み込むため、実際に画面へ出るのは向こうの版）。
//   ここにセクションを足しても ui_mall_rpg.js 側にも入れないとプレイヤーには表示されません
//   （過去に称号・フロア帯が丸ごと消えた実績あり＝docs/MALL_UX_BACKLOG.md P0-1）。
//   ハブへ機能追加する時は必ず両方に反映すること。
function rpgRenderHub(app) {
  const d = rpgData();
  const rec = d.records || {};
  const tot = rpgShopTotalOwned();
  const topI = RPG_FLOORS.length - 1;

  // ── ヒーロー（背景＋タイトル＋ステータス2段：キャラ状態／もちもの）
  const hero = el("div", "rpg-hero");
  const resort = el("div", "rpg-resort");
  resort.innerHTML =
    `<div class="rpg-sun"></div>` +
    `<div class="rpg-cloud c1">☁️</div><div class="rpg-cloud c2">⛅</div><div class="rpg-cloud c3">☁️</div>` +
    `<div class="rpg-bird b1">🕊️</div><div class="rpg-bird b2">🕊️</div>` +
    `<div class="rpg-palm pl">🌴</div><div class="rpg-palm pr">🌴</div>` +
    `<div class="rpg-beach"></div><div class="rpg-sea"></div>`;
  hero.appendChild(resort);
  hero.appendChild(el("div", "rpg-hero-title", "🐲 崑崙ドラゴンモール大冒険"));
  const stat = el("div", "rpg-hero-stats");
  stat.innerHTML =
    `<div class="rpg-st char">🧝 Lv<b>${d.lv}</b><span>❤️${d.hp}/${d.maxhp}</span><span>💧${d.mp}/${d.maxmp}</span>${(() => { const tt = rpgTopTitle(); return tt ? `<span class="cl title">${tt.ic}${tt.n}</span>` : (d.cleared ? `<span class="cl">🌿制覇</span>` : ""); })()}</div>` +
    `<div class="rpg-st wallet">🪙<b>${d.gold}</b><span class="tk">🎟️${d.tickets || 0}</span><span class="rep">✨${d.rep || 0}</span><button class="rpg-help" title="もちもの・あそびかた">？</button></div>`;
  hero.appendChild(stat);
  app.appendChild(hero);
  const helpBtn = stat.querySelector(".rpg-help");
  if (helpBtn) helpBtn.onclick = () => rpgShowHelp();

  // ── つぎの目標（あと◯◯：ゴールグラデーション）
  app.appendChild(el("div", "rpg-goal-line", rpgNextGoalText()));

  // ── フロア帯（踏破の可視化：どこまで来たか／屋上まであと何フロアか）
  const reached = d.cleared ? (RPG_FLOORS.length - 1) : (rec.floor || 0);
  const strip = el("div", "rpg-floorstrip");
  strip.innerHTML = RPG_FLOORS.map((f, i) => {
    const top = i === RPG_FLOORS.length - 1, lab = top ? "🏯屋上" : (i + 1) + "F";
    const cls = (d.cleared || i <= reached) ? "done" : (i === reached + 1 ? "now" : "");
    return `<span class="fs-cell ${cls}">${lab}</span>`;
  }).join("");
  app.appendChild(strip);

  // ── ログボ（あれば主役のすぐ上にコンパクトに）
  if (d.daily !== rpgToday()) {
    const dl = el("button", "rpg-daily", "🎁 ログインボーナス（🎟️＋おまけ）を受け取る");
    dl.onclick = () => rpgClaimDaily();
    app.appendChild(dl);
  }

  // ── 主役：冒険（＋タワー）
  const go = el("button", "rpg-start", d.cleared ? "🏬 冒険する ▶（再挑戦）" : "🏬 冒険する ▶");
  go.onclick = () => rpgStartRun();
  app.appendChild(go);
  if (d.cleared) {
    const tw = el("button", "rpg-start tower", `🌟 エンドレスタワー ▶${(rec.depth || 0) ? `（最深 ${rec.depth}層）` : ""}`);
    tw.onclick = () => rpgStartTower();
    app.appendChild(tw);
  }

  // ── 🎰 ガチャ（主要ループ・1箱だけ常時表示）
  const gacha = el("div", "rpg-box gacha-box");
  gacha.innerHTML = `<div class="rpg-box-t">🎰 おたからガチャ <span class="rpg-gacha-rates">伝説0.7% / 激レア2.8% / SR9.5%</span></div>`;
  const gg = el("div", "rpg-gachagrid");
  const g1 = el("button", "rpg-gachabtn" + ((d.tickets || 0) >= 1 ? " ready" : " off"));
  g1.innerHTML = `<b>🎟️ 1回</b><small>チケット×1</small>`;
  g1.disabled = (d.tickets || 0) < 1; g1.onclick = () => rpgGachaPull(1);
  const g10 = el("button", "rpg-gachabtn gold10" + ((d.gold || 0) >= 280 ? " ready" : " off"));
  g10.innerHTML = `<b>💎 10連</b><small>280G・SR以上確定</small>`;
  g10.disabled = (d.gold || 0) < 280; g10.onclick = () => rpgGachaPull(10);
  gg.appendChild(g1); gg.appendChild(g10);
  gacha.appendChild(gg);
  app.appendChild(gacha);

  // ── 💖 自分磨き（折りたたみ・つかえる時は！バッジ）
  const upReady = RPG_UP.some(u => { const lv = rpgUpLv(u.id); return lv < u.max && (d.rep || 0) >= u.cost(lv); });
  const lab = el("details", "rpg-box rpg-sec lab-box");
  let lh = `<summary>💖 自分磨き <span class="sec-r">✨${d.rep || 0}${upReady ? ` <span class="badge-new">！</span>` : ""}</span></summary>`;
  lh += `<div class="rpg-lab-hint">ぼうけんでたまる✨みがきで、ミミがずっと成長するっ！（倒れても持ち帰る）</div>`;
  lab.innerHTML = lh;
  const labg = el("div", "rpg-labgrid");
  RPG_UP.forEach(u => {
    const lv = rpgUpLv(u.id), maxed = lv >= u.max, cost = u.cost(lv), can = (d.rep || 0) >= cost;
    const b = el("button", "rpg-labbtn" + (maxed ? " maxed" : can ? " ready" : " off"));
    b.innerHTML = `<span class="li">${u.ic}</span><b>${u.n}</b><small>${u.d}</small>` +
      `<span class="lv">${maxed ? "MAX" : "Lv" + lv + " / " + u.max}</span><span class="cost">${maxed ? "✓" : "✨" + cost}</span>`;
    if (!maxed) b.onclick = () => rpgBuyUp(u.id);
    labg.appendChild(b);
  });
  lab.appendChild(labg);
  app.appendChild(lab);

  // ── 🛍️ ショッピング帳（折りたたみ）
  const book = el("details", "rpg-box rpg-sec shopbook");
  let bh = `<summary>🛍️ ショッピング帳 <span class="sec-r">${tot.o}/${tot.t}</span></summary><div class="rpg-shopbook-body">`;
  RPG_FLOORS.forEach((f, i) => {
    const arr = rpgShopFor(i), o = rpgShopOwnedN(arr);
    bh += `<div class="sb-floor"><div class="sb-floor-t">${f.name.replace(/ .*/, " ")}<small>${o}/${arr.length}</small></div><div class="sb-items">` +
      arr.map(it => `<span class="sb-it${rpgOwned(it.id) ? " got" : ""}" title="${it.n}">${rpgOwned(it.id) ? it.ic : "❔"}</span>`).join("") + `</div></div>`;
  });
  bh += `</div>`;
  book.innerHTML = bh;
  app.appendChild(book);

  // ── 🧰 おでかけ準備（道具屋＋休む・折りたたみ）
  const prep = el("details", "rpg-box rpg-sec");
  let ph = `<summary>🧰 おでかけ準備</summary><div class="rpg-shopgrid">`;
  [["potion", "🧪 回復薬", "HP+40", 20], ["ether", "🔵 マナ水", "MP+20", 30], ["calm", "🔕 静けさのお香", RPG_CALM_STEPS + "歩エンカ無し", 80]].forEach(([k, n, ds, price]) => {
    ph += `<button class="rpg-shopbtn${d.gold >= price ? "" : " off"}" data-buy="${k}"${d.gold < price ? " disabled" : ""}><b>${n}</b><small>${ds}</small><span class="cost">${price}G</span></button>`;
  });
  ph += `</div>`;
  prep.innerHTML = ph;
  const restBtn = el("button", "rpg-hubbtn", "🛏️ 休む（HP/MP全回復）");
  restBtn.onclick = () => rpgRest();
  prep.appendChild(restBtn);
  prep.querySelectorAll("[data-buy]").forEach(b => { b.onclick = () => rpgBuy(b.getAttribute("data-buy")); });
  app.appendChild(prep);

  // ── 📖 ずかん（折りたたみ）
  const codex = el("details", "rpg-box rpg-sec");
  let rows = "";
  RPG_TOURISTS.concat(RPG_MONSTERS_MINOR, RPG_KUNLUN, ["boss1"]).forEach(id => {
    const m = RPG_MONS[id], seen = d.codex[id];
    const w = seen && seen.weak.length ? seen.weak.map(e => RPG_ELEM_IC[e]).join("") : "？";
    rows += `<div class="rpg-codexrow"><span>${m.ic} ${seen ? m.n : "？？？"}</span><span>弱点 ${w}</span></div>`;
  });
  codex.innerHTML = `<summary>📖 ずかん（すれちがい）</summary><div class="rpg-codexlist">${rows}</div>`;
  app.appendChild(codex);

  // ── 🏅 称号（折りたたみ・やり込みの頂点／あと◯◯のゴールグラデーション）
  const titles = rpgTitles(), gotN = titles.filter(t => t.got).length;
  const trd = el("details", "rpg-box rpg-sec");
  trd.innerHTML = `<summary>🏅 称号 <span class="sec-r">${gotN}/${titles.length}</span></summary>` +
    `<div class="rpg-titles">` +
    titles.map(t => `<div class="rpg-title-row${t.got ? " got" : ""}"><span class="tt-ic">${t.got ? t.ic : "🔒"}</span><span class="tt-n">${t.n}</span><span class="tt-st">${t.got ? "✓ 獲得" : t.hint}</span></div>`).join("") +
    `</div>`;
  app.appendChild(trd);

  // ── 🏆 きろく（折りたたみ）
  const recd = el("details", "rpg-box rpg-sec");
  recd.innerHTML = `<summary>🏆 きろく</summary><div class="rpg-records">` +
    `<div class="rpg-rec"><small>ベストスコア</small><b>${rec.score || 0}</b></div>` +
    `<div class="rpg-rec"><small>最高Lv</small><b>${rec.lv || d.lv}</b></div>` +
    `<div class="rpg-rec"><small>最高到達</small><b>${rec.floor != null ? RPG_FLOORS[Math.min(rec.floor, topI)].name.replace(/ .*/, "") : "—"}</b></div>` +
    `<div class="rpg-rec"><small>最大コンボ</small><b>×${rec.combo || 0}</b></div>` +
    `<div class="rpg-rec"><small>🎯ミッション</small><b>${rec.missions || 0}</b></div>` +
    `</div>`;
  app.appendChild(recd);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← モールへ戻る"); back.onclick = () => renderMall();
  actions.appendChild(back);
  app.appendChild(actions);
}
// もちもの＆あそびかた（？モーダル＝常設説明を隠す）
function rpgShowHelp() {
  const html =
    `<p><b>🪙 ゴールド</b>：探索で稼ぐお金。お店の買い物・道具・10連ガチャに使う。</p>` +
    `<p><b>🎟️ おたから券</b>：ガチャ1回ぶん。ログボや探索で手に入る。</p>` +
    `<p><b>✨ みがき</b>：ぼうけんのたびにたまる成長ポイント。「💖自分磨き」で永久に強くなる（倒れても持ち帰る）。</p>` +
    `<p><b>🔕 静けさのお香</b>：たくと<b>${RPG_CALM_STEPS}歩のあいだ魔物に遭わない</b>探索アイテム。<b>フロアを踏破（🛗階段に到達）すると手に入りやすく</b>、屋上制覇でもごほうび。お店（🧰おでかけ準備）でも買える。階段や宝までを安全に駆け抜けたい時に。</p>` +
    `<hr><p>ここは<b>崑崙島のドラゴンモール</b>（ハワイの巨大オープンエア・モールがモデル）。<b>全7階＋屋上</b>に、龍鱗ビーチ→雲海プール→🍱崑崙グルメ横丁→海竜→💎龍玉ラグジュアリー大通り→🏬崑崙百貨店→🎪龍神フェスステージ…と続く。各フロア限定の品（着る👗・飾る🪴・集める🐚・食べ歩き🍧）を集めよう。通路を進んで<b>お店の前に立つと「🛍️お店に入る」</b>が出る（値切りやセールも）。未所持の最安品には<b>💡おすすめ</b>が付き、<b>その階の品を全部そろえると🎀お買い物マスター（🎟️+1・✨+5）</b>。<b>全フロアの品をコンプすると👑グランドコンプ</b>＝記念衣装＋最上位称号「ドラゴンモールの主」。集めた<b>🏅称号</b>はハブの「称号」で確認できる（あと◯◯も表示）。<b>🛗階段</b>に着いたら「上の階へ」で上れる（残ってお買い物もOK）。観光客や👾と戦うときは<b>弱点(${RPG_ELEM_IC.fire}火/${RPG_ELEM_IC.ice}氷/${RPG_ELEM_IC.elec}電/${RPG_ELEM_IC.force}力)</b>を突くと「もう1回！」。倒れても持ち物はそのまま。</p>` +
    `<hr><p><b>📦 今回の冒険</b>：モールを出る・気絶・制覇のたびに、そのぼうけんの成果（ゴールド収支・撃破・踏破フロア・お買い物・衣装・✨みがきなど）を1枚にまとめて表示。<b>倒れても“持ち帰った物”が見える</b>から、もぐるたびに前進してるのが分かるっ。</p>` +
    `<hr><p><b>🗓️ デイリーラン</b>：URLに <code>?daily</code> を付けて開くと、<b>その日だけの固定ダンジョン</b>（床の変形＋通路閉鎖が日替わり）で遊べます。<code>?daily=合言葉</code> を付ければ友達と<b>同じ構造</b>を共有できる（同じ合言葉＝同じ地形）。</p>`;
  if (typeof showInfoPopup === "function") showInfoPopup("もちもの＆あそびかた", html);
}

// ── 🛍️ フロアのショップ（買い物＝モールに来る理由。店主との値切り・タイムセール＝買い物自体を遊びに）
// ★門番：店主＝スミカは第3話（総資産3万）で出会う顧問。モール解放は第2話なので、出会う前に店へ入れてしまう。
//   会っていない相手の名前も口調（＝ミミの名を知っている「ミミ様」呼び）も出さない＝未登場は「店員さん」＋「お客様」。
//   値切り/購入/フロアコンプ/グランドコンプの _shopMsg も同じ吹き出しに出るので、表示直前のここ1箇所で敬称を差し替える。
function rpgKeeperMet() { return (typeof advisorMet === "function") && !!advisorMet("sumika"); }   // fail-closed（未定義＝出さない側に倒す）
function rpgKeeperName() {
  if (!rpgKeeperMet()) return "店員さん";
  const n = (typeof castNameSafe === "function") ? castNameSafe("sumika") : "？？？";   // 名前は必ず門番ヘルパ経由
  return String(n).split("・")[0];
}
function rpgKeeperLine(s) {
  const t = String(s || "");
  return rpgKeeperMet() ? t : t.replace(/ミミ様/g, "お客様");   // 未登場の店員はミミの名を知らない
}
function rpgRenderShop(app) {
  const d = rpgData();
  const fi = RPG ? RPG.fi : 0, meta = rpgFloorMeta(fi), arr = rpgShopFor(fi);
  const own = rpgShopOwnedN(arr);
  const dealIt = RPG && RPG._dealId ? arr.find(x => x.id === RPG._dealId) : null;

  // 店主（出会った後＝施設・暮らしのスミカ「ミミ様」／出会う前＝名もなき「店員さん」「お客様」）
  const keep = el("div", "rpg-shopkeep");
  const line = rpgKeeperLine((RPG && RPG._shopMsg) ? RPG._shopMsg
    : (dealIt ? `いらっしゃいませ、ミミ様♪ 本日のおすすめは ${dealIt.ic}${dealIt.n} ですわ！` : "いらっしゃいませ、ミミ様♪ ごゆっくりどうぞ"));
  keep.innerHTML = `<div class="sk-face">💁‍♀️</div><div class="sk-bubble"><b>${rpgKeeperName()}</b><span>${line}</span></div>`;
  app.appendChild(keep);

  const head = el("div", "rpg-shop-head");
  const complete = own >= arr.length;
  head.innerHTML = `<div class="rpg-shop-t">🛍️ ${meta.name} のお店</div>` +
    `<div class="rpg-shop-sub"><span>🪙 ${fmtCoins(state.player.coins || 0)}</span><span class="sc${complete ? " done" : ""}">${complete ? "✓ コンプ" : "そろえた"} ${own}/${arr.length}</span></div>`;
  app.appendChild(head);

  // 💡おすすめ＝未所持の最安品（セール品以外）。買う動機を1つに絞る
  const unowned = arr.filter(x => !rpgOwned(x.id) && !(RPG && RPG._dealId === x.id));
  const recId = unowned.length ? unowned.reduce((a, b) => (b.price < a.price ? b : a), unowned[0]).id : null;

  const grid = el("div", "rpg-shopwall");
  arr.forEach(it => {
    const owned = rpgOwned(it.id), price = rpgItemPrice(it);
    const isDeal = RPG && RPG._dealId === it.id, haggled = RPG && RPG._haggle && RPG._haggle[it.id];
    const isRec = it.id === recId, save = Math.max(0, it.price - price);
    const can = (state.player.coins || 0) >= price, cat = RPG_SHOP_CAT[it.cat] || { ic: "🛍️" };
    const card = el("div", "rpg-good" + (owned ? " owned" : can ? " ready" : " off") + (isDeal ? " deal" : "") + (isRec ? " rec" : ""));
    let inner = (isDeal ? `<span class="deal-tag">🎉SALE</span>` : (isRec ? `<span class="rec-tag">💡おすすめ</span>` : "")) +
      `<span class="gic">${it.ic}</span><b>${it.n}</b><span class="gcat">${cat.ic}${cat.n}</span>`;
    if (owned) inner += `<span class="gprice owned">✓ 購入ずみ</span>`;
    else inner += `<span class="gprice">🪙${fmtCoins(price)}${save > 0 ? ` <s>${fmtCoins(it.price)}</s> <span class="gsave">−${fmtCoins(save)}</span>` : (price > it.price ? ` <span class="gover">+${fmtCoins(price - it.price)}</span>` : "")}</span>`;
    card.innerHTML = inner;
    if (!owned) {
      const acts = el("div", "good-acts");
      const buy = el("button", "gbuy" + (can ? "" : " off"), "買う");
      buy.onclick = () => rpgBuyGoods(it.id);
      acts.appendChild(buy);
      if (!haggled) { const hg = el("button", "ghaggle", "💬値切る"); hg.onclick = () => rpgHaggle(it.id); acts.appendChild(hg); }
      card.appendChild(acts);
    }
    grid.appendChild(card);
  });
  app.appendChild(grid);

  // 次の階の予告（好奇心＝前進の引き）
  const nextI = fi + 1, hasNext = RPG && (RPG.tower || nextI < RPG_FLOORS.length);
  if (hasNext) {
    const nm = rpgFloorMeta(nextI), na = rpgShopFor(RPG.tower ? -1 : nextI);
    const peek = na.slice(0, 3).map(x => x.ic + x.n).join("・");
    const tz = el("div", "rpg-shop-teaser");
    tz.innerHTML = `🔼 <b>${RPG.tower ? "上の階" : nm.name}</b> のお店には…<br><span class="pk">${peek} などが並んでるみたい！</span>`;
    app.appendChild(tz);
  } else {
    app.appendChild(el("div", "rpg-shop-teaser", "🌅 ここは最上階。ぜんぶ集めたら自慢できるっ！"));
  }

  const back = el("button", "rpg-start", "↩ 探索にもどる");
  back.onclick = () => rpgCloseShop();
  app.appendChild(back);
}

// ── 探索（一人称）＝没入ステージ（縦いっぱい）＋下部の操作ドック（親指ゾーン）
function rpgRenderExplore(app) {
  const d = rpgData();
  rpgGoalSync();   // gold/踏破型のミッション進捗を反映
  const wrap = el("div", "rpg-explore");

  // 上段HUD：いる場所＋🎯目標＋？ヘルプ／バイタル（C6解消＝ラン中でもルールを確認できる恒常？）
  const head = el("div", "rpg-runhead2");
  head.innerHTML =
    `<div class="rh-top">` +
      `<span class="rpg-chip win">${RPG.tower ? "🌟" : "🏬"} ${rpgFloorMeta(RPG.fi).name}</span>` +
      (RPG.goal ? `<span class="rpg-chip goal${RPG.goal.done ? " done" : ""}">${RPG.goal.done ? "✅ " + RPG.goal.label : rpgGoalChip(RPG.goal)}</span>` : "") +
      `<button class="rpg-chip rpg-runhelp" title="あそびかた">？</button>` +
    `</div>` +
    `<div class="rh-vit">` +
      `<span class="rpg-chip hp">❤️${d.hp}/${d.maxhp}</span>` +
      `<span class="rpg-chip mp">💧${d.mp}/${d.maxmp}</span>` +
      `<span class="rpg-chip">🪙${d.gold}</span>` +
      `<span class="rpg-chip">🧝Lv${d.lv}</span>` +
      ((RPG.calm || 0) > 0 ? `<span class="rpg-chip calm">🔕 平和 ${RPG.calm}歩</span>` : "") +
    `</div>`;
  const _hq = head.querySelector(".rpg-runhelp");
  if (_hq) _hq.onclick = () => rpgShowHelp();
  wrap.appendChild(head);

  // 没入ステージ：一人称ビュー＋ミニマップ＆ログ。タップで“見えているお店”に入る
  const stage = el("div", "rpg-stage");
  const cv = el("canvas", "rpg-view hd" + (RPG._stepFx ? " rpg-step-" + RPG._stepFx : ""));
  RPG._stepFx = null;
  cv.width = 470; cv.height = 430;   // 初期値（以後 rpgFitCanvas が表示枠に追従）
  stage.appendChild(cv);
  const mini = rpgMiniMap(); mini.classList.add("ov"); stage.appendChild(mini);
  const lg = el("div", "rpg-log ov");
  RPG.log.slice(0, 3).forEach(L => lg.appendChild(el("div", "rpg-logline " + L.cls, L.t)));
  stage.appendChild(lg);
  // 文脈フック：目の前が“お店の入口”か判定（壁＝店構え）。タップで世界そのものから入店できる導線を残しつつ、主役は下のボタン。
  const onStairs = rpgCell(RPG.px, RPG.py) === "U";
  const facingShop = !onStairs && rpgIsWall(rpgAhead(1, 0));
  const shopArr = rpgShopFor(RPG.fi), shopLeft = shopArr.length - rpgShopOwnedN(shopArr);
  if (facingShop) {
    const hint = el("div", "rpg-shop-hint" + (shopLeft > 0 ? " has" : ""), `🛍️ 目の前のお店${shopLeft > 0 ? `（未入手 ${shopLeft}品）` : "（コンプ済み）"}`);
    stage.appendChild(hint);
    stage.onclick = () => rpgOpenShop();
  } else {
    stage.onclick = null;
  }
  wrap.appendChild(stage);
  rpgDrawView(cv, (typeof performance !== "undefined" ? performance.now() : 0));
  rpgStartAmbient(cv);

  // 下部ドック（高さ一定）：文脈アクション帯＋D-pad＋オート＋出る。
  const dock = el("div", "rpg-dock");

  // ① 文脈アクション帯（高さ固定でレイアウトを揺らさない）：階段なら『上の階へ』、店の前なら『お店に入る』。
  const ctx = el("div", "rpg-ctx");
  if (onStairs) {
    const last = RPG.fi + 1 >= RPG_FLOORS.length && !RPG.tower;
    const up = el("button", "rpg-movebtn wide stairs", last ? "🛗 上の階へ（ここが最上階）" : "🛗 この階段で上の階へ");
    up.disabled = last; up.onclick = () => { if (RPG && RPG._autoT) { clearTimeout(RPG._autoT); RPG._autoT = null; RPG.auto = false; } rpgGoUp(); };
    ctx.appendChild(up);
  } else if (facingShop) {
    const enter = el("button", "rpg-movebtn wide shopenter" + (shopLeft > 0 ? " has" : ""), shopLeft > 0 ? `🛍️ お店に入る（未入手 ${shopLeft}品）` : "🛍️ お店に入る（コンプ済み）");
    enter.onclick = () => rpgOpenShop();
    ctx.appendChild(enter);
  } else if ((RPG.calm || 0) === 0 && (d.items.calm || 0) > 0) {
    const cb = el("button", "rpg-movebtn wide calm", `🔕 静けさのお香をたく ×${d.items.calm}（${RPG_CALM_STEPS}歩 エンカ無し）`);
    cb.onclick = () => rpgUseCalm();
    ctx.appendChild(cb);
  } else {
    ctx.appendChild(el("div", "rpg-ctx-idle", (RPG.calm || 0) > 0 ? `🔕 静けさのお香 効果中（あと ${RPG.calm}歩）` : "🔍 通路を進んでお店や階段をさがそう"));
  }
  dock.appendChild(ctx);

  const pad = el("div", "rpg-dpad");
  [["↰", () => rpgTurn(-1), "turn"], ["▲", () => rpgForward(1), "fw"], ["↱", () => rpgTurn(1), "turn"]].forEach(([l, f, c]) => { const b = el("button", "rpg-padbtn2 " + c + (RPG.auto ? " dim" : ""), l); b.onclick = f; pad.appendChild(b); });
  dock.appendChild(pad);
  const auto = el("button", "rpg-movebtn wide " + (RPG.auto ? "pause" : "play"), RPG.auto ? "⏸ オートで歩き中（タップで止める）" : "▶ オートで歩く");
  auto.onclick = () => rpgToggleAuto();
  dock.appendChild(auto);
  const leave = el("button", "rpg-actbtn leave wide", "🏠 モールを出る");
  leave.onclick = () => rpgFinishRun("leave");
  dock.appendChild(leave);

  wrap.appendChild(dock);
  app.appendChild(wrap);
}

// ★リッチHD-2D風 一人称シーン（tools/render_scene.js と同一ロジック）
function rpgScene(ctx, env) {
  const W = env.W, H = env.H, cx = W / 2, cy = H * 0.46, maxD = 4, p = 0.6, t = env.t || 0, ph = t / 1000;
  const A = env.accent, sunset = env.sunset;
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const rgba = (a, k, al) => `rgba(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0},${al})`;
  const cell = env.cell, wall = (d, l) => cell(d, l) === "#";
  // 店ごとの差異（日よけ色＋看板）＝“いろんなお店”に見せる
  const SHOP_AWN = [[226, 90, 110], [70, 160, 210], [240, 178, 70], [110, 200, 140], [200, 120, 210], [245, 140, 88], [90, 170, 175]];
  const shopList = (typeof rpgShopFor === "function" && typeof RPG !== "undefined" && RPG && RPG.fi != null) ? rpgShopFor(RPG.fi) : null;
  const SHOP_IC = ["🛍️", "👗", "🍧", "🐚", "🍹", "🎁", "👒", "🧸", "🍩", "💍"];
  // パレット（明るいリゾート基調）
  const WALL = [236, 232, 224], FLOOR = [206, 198, 186], CEIL = [240, 242, 244], TRIM = [120, 112, 100], GLASS = [200, 224, 230];
  // 🏝️ オープンエア：天井を閉じず“開いた空”にする（中央＝空・両脇＝建物の軒）。
  const openAir = env.openAir !== false;
  // 🕖 時間帯：低層=昼の青空 → 上層=黄昏 → 屋上=夕焼け（dusk 0..1で空色を補間）
  const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const dusk = Math.max(0, Math.min(1, env.dusk != null ? env.dusk : (sunset ? 1 : 0)));
  const SKY_HI = lerp3([140, 192, 232], [255, 176, 128], dusk), SKY_LO = lerp3([206, 230, 246], [255, 220, 180], dusk);
  const EAVE = [222, 216, 206];
  const rect = []; for (let d = 0; d <= maxD; d++) { const s = Math.pow(p, d); rect[d] = { l: cx - (W * 0.5) * s, t: cy - (H * 0.5) * s, r: cx + (W * 0.5) * s, b: cy + (H * 0.5) * s }; }
  const yN = (r, f) => r.t + f * (r.b - r.t), xN = (r, f) => r.l + f * (r.r - r.l);
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const line = (x0, y0, x1, y1, c, w) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.stroke(); };
  const sh = d => Math.max(0.55, 1 - d * 0.1);

  // 空（天井）と床のベース・グラデ
  let g = ctx.createLinearGradient(0, 0, 0, cy);
  if (openAir) { g.addColorStop(0, rgb(SKY_HI, 1)); g.addColorStop(1, rgb(SKY_LO, 1)); }
  else { g.addColorStop(0, rgb(CEIL, 0.82)); g.addColorStop(1, rgb(CEIL, 1.0)); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, cy + 1);
  // 開いた空にゆっくり流れる雲（オープンエアの空気感）
  if (openAir) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const cyy = cy * (0.16 + i * 0.17), cw = W * (0.10 + i * 0.03), chh = cw * 0.42;
      const cxx = ((ph * (5 + i * 4) + i * W * 0.45) % (W + cw * 2.4)) - cw * 1.2;
      ctx.fillStyle = rgba(lerp3([255, 255, 255], [255, 224, 202], dusk), 1, 0.66 - dusk * 0.22);
      ctx.beginPath();
      if (ctx.ellipse) { ctx.ellipse(cxx, cyy, cw, chh, 0, 0, 7); ctx.ellipse(cxx + cw * 0.7, cyy + chh * 0.25, cw * 0.66, chh * 0.8, 0, 0, 7); ctx.ellipse(cxx - cw * 0.65, cyy + chh * 0.2, cw * 0.6, chh * 0.7, 0, 0, 7); }
      else { ctx.arc(cxx, cyy, chh, 0, 7); }
      ctx.fill();
    }
    ctx.restore();
  }
  g = ctx.createLinearGradient(0, cy, 0, H); g.addColorStop(0, rgb(FLOOR, 1.02)); g.addColorStop(1, rgb(FLOOR, 0.62)); ctx.fillStyle = g; ctx.fillRect(0, cy, W, H - cy);

  // 海の見える窓
  const oceanWindow = (x0, y0, x1, y1, k) => {
    const midY = y0 + (y1 - y0) * 0.52;
    let sg = ctx.createLinearGradient(0, y0, 0, midY);
    if (sunset) { sg.addColorStop(0, rgb([255, 150, 90], k)); sg.addColorStop(1, rgb([255, 210, 150], k)); }
    else { sg.addColorStop(0, rgb([120, 190, 235], k)); sg.addColorStop(1, rgb([200, 235, 245], k)); }
    ctx.fillStyle = sg; ctx.fillRect(x0, y0, x1 - x0, midY - y0);
    let eg = ctx.createLinearGradient(0, midY, 0, y1);
    if (sunset) { eg.addColorStop(0, rgb([120, 120, 170], k)); eg.addColorStop(1, rgb([60, 80, 140], k)); }
    else { eg.addColorStop(0, rgb([70, 175, 215], k)); eg.addColorStop(1, rgb([30, 120, 175], k)); }
    ctx.fillStyle = eg; ctx.fillRect(x0, midY, x1 - x0, y1 - midY);
    // 太陽＋海面のきらめき
    const scx = x0 + (x1 - x0) * (sunset ? 0.5 : 0.72), scy = y0 + (y1 - y0) * (sunset ? 0.4 : 0.24), sr = Math.max(2, (x1 - x0) * 0.1);
    ctx.fillStyle = sunset ? rgba([255, 180, 110], k, 0.95) : rgba([255, 250, 215], k, 0.95); ctx.beginPath(); ctx.arc(scx, scy, sr, 0, 7); ctx.fill();
    ctx.fillStyle = rgba([255, 245, 210], k, 0.5); ctx.beginPath(); ctx.arc(scx, scy, sr * 1.7, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) { const wy = midY + (y1 - midY) * (0.18 + i * 0.2); ctx.strokeStyle = rgba([255, 255, 255], k, 0.5 - i * 0.08); ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x0; xx <= x1; xx += 2) { const yy = wy + Math.sin(xx * 0.4 + ph * 2 + i) * 1.4; xx === x0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
    // サンの直下に反射の柱
    ctx.fillStyle = rgba([255, 250, 220], k, 0.25); ctx.fillRect(scx - sr * 0.5, midY, sr, y1 - midY);
  };
  // ヤシの植栽
  const palm = (bx, by, s, k) => {
    ctx.fillStyle = rgb([90, 70, 54], k); ctx.fillRect(bx - s * 0.7, by - s * 0.5, s * 1.4, s * 0.5);          // プランター
    ctx.fillStyle = rgb([70, 52, 40], k); ctx.fillRect(bx - s * 0.12, by - s * 2.4, s * 0.24, s * 1.9);         // 幹
    ctx.fillStyle = rgb([46, 150, 90], k);
    for (let a = 0; a < 6; a++) { const ang = -Math.PI / 2 + (a - 2.5) * 0.5; const ex = bx + Math.cos(ang) * s * 1.5, ey = by - s * 2.4 + Math.sin(ang) * s * 1.1; poly([[bx, by - s * 2.4], [ex - s * 0.15, ey], [ex + s * 0.15, ey + s * 0.1]], rgb([46, 150, 90], k * (0.8 + a * 0.04))); }
    ctx.fillStyle = rgb([60, 170, 100], k); ctx.beginPath(); ctx.arc(bx, by - s * 2.4, s * 0.3, 0, 7); ctx.fill();
  };

  // 店先（側壁・グラデ＋日よけ＋ガラス映り込み＋柱＋幅木）
  const storefront = (near, far, left, k, depth) => {
    const nx = left ? near.l : near.r, fx = left ? far.l : far.r;
    const si = depth * 2 + (left ? 0 : 1);                 // 店の通し番号（奥行×左右で別の店）
    const awn = SHOP_AWN[si % SHOP_AWN.length];            // 店ごとに違う日よけ色
    const ic = (shopList && shopList.length) ? shopList[si % shopList.length].ic : SHOP_IC[si % SHOP_IC.length];
    const band = (f0, f1, fill) => poly([[nx, yN(near, f0)], [fx, yN(far, f0)], [fx, yN(far, f1)], [nx, yN(near, f1)]], fill);
    // 壁（縦グラデ：上下AO）
    let wg = ctx.createLinearGradient(0, near.t, 0, near.b); wg.addColorStop(0, rgb(WALL, k * 0.8)); wg.addColorStop(0.5, rgb(WALL, k)); wg.addColorStop(1, rgb(WALL, k * 0.78));
    band(0, 1, wg);
    // 日よけ（店ごとの色・グラデ＋ストライプ）
    let ag = ctx.createLinearGradient(0, yN(near, 0.05), 0, yN(near, 0.26)); ag.addColorStop(0, rgb(awn, k * 1.08)); ag.addColorStop(1, rgb(awn, k * 0.82));
    band(0.05, 0.26, ag);
    line(nx, yN(near, 0.26), fx, yN(far, 0.26), rgba([0, 0, 0], 1, 0.18 * k), 1);
    // ガラス（縦グラデ＋斜めハイライト＋店内シルエット）
    let gg = ctx.createLinearGradient(0, yN(near, 0.30), 0, yN(near, 0.74)); gg.addColorStop(0, rgb(GLASS, k * 1.05)); gg.addColorStop(1, rgb(GLASS, k * 0.82));
    band(0.30, 0.74, gg);
    band(0.40, 0.62, rgba([40, 40, 50], k, 0.18));        // 店内の暗がり
    // ガラスの斜めハイライト（店先の映り込み）
    line(xN({ l: nx, r: fx, b: 0 }, 0.0) + (fx - nx) * 0.2, yN(near, 0.34), nx + (fx - nx) * 0.5, yN(near, 0.70), rgba([255, 255, 255], k, 0.25), 1);
    // 幅木
    band(0.86, 1, rgb([150, 142, 132], k));
    // 柱（手前・奥）
    let cg = ctx.createLinearGradient(nx - 1, 0, nx + 2, 0); cg.addColorStop(0, rgb(TRIM, k * 0.7)); cg.addColorStop(1, rgb([210, 204, 196], k));
    ctx.fillStyle = cg; ctx.fillRect(nx - (left ? 0 : 2), near.t, 2, near.b - near.t);
    line(fx, far.t, fx, far.b, rgba(TRIM, k, 0.8), 1);
    // 看板（店の商品アイコン）＝“何のお店か”を一目で
    const sx = nx + (fx - nx) * 0.30, sy = yN(near, 0.47), fs = Math.max(9, (near.b - near.t) * 0.13);
    try { ctx.save(); ctx.globalAlpha = 0.96 * k; ctx.font = fs + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ic, sx, sy); ctx.restore(); } catch (e) {}
  };

  // 正面＝海の見える大きな窓
  const facade = (r, k) => {
    poly([[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]], rgb(WALL, k));
    let ag = ctx.createLinearGradient(0, yN(r, 0.05), 0, yN(r, 0.24)); ag.addColorStop(0, rgb(A, k * 1.05)); ag.addColorStop(1, rgb(A, k * 0.82));
    ctx.fillStyle = ag; ctx.fillRect(r.l, yN(r, 0.05), r.r - r.l, yN(r, 0.24) - yN(r, 0.05));
    oceanWindow(r.l + 3, yN(r, 0.30), r.r - 3, yN(r, 0.86), k);
    line(r.l, yN(r, 0.58), r.r, yN(r, 0.58), rgba(TRIM, k, 0.7), 1);
    for (let m = 1; m < 4; m++) { const x = xN(r, m / 4); line(x, yN(r, 0.30), x, yN(r, 0.86), rgba(TRIM, k, 0.8), 1); }
    poly([[r.l, yN(r, 0.86)], [r.r, yN(r, 0.86)], [r.r, yN(r, 0.93)], [r.l, yN(r, 0.93)]], rgb([150, 142, 132], k));
  };

  // 奥→手前
  for (let c = maxD; c >= 1; c--) {
    const near = rect[c - 1], far = rect[c], k = sh(c);
    if (wall(c, 0)) { facade(near, sh(c - 1)); }
    else {
      // 床（グラデ＋遠近タイル＋中央グロス＋店色の映り込み）
      let fg = ctx.createLinearGradient(0, far.b, 0, near.b); fg.addColorStop(0, rgb(FLOOR, k * 0.85)); fg.addColorStop(1, rgb(FLOOR, k * 1.05));
      poly([[near.l, near.b], [far.l, far.b], [far.r, far.b], [near.r, near.b]], fg);
      line(far.l, far.b, far.r, far.b, rgba([120, 112, 100], k, 0.5), 1);
      [0.25, 0.5, 0.75].forEach(fr => line(xN(near, fr), near.b, xN(far, fr), far.b, rgba([120, 112, 100], k, 0.35), 1));
      // 反射（店アクセント色を床に薄く）
      if (wall(c, -1)) { ctx.save(); ctx.globalAlpha = 0.12 * k; poly([[near.l, near.b], [far.l, far.b], [xN(far, 0.2), far.b], [xN(near, 0.2), near.b]], rgb(A, 1)); ctx.restore(); }
      if (wall(c, 1)) { ctx.save(); ctx.globalAlpha = 0.12 * k; poly([[xN(near, 0.8), near.b], [xN(far, 0.8), far.b], [far.r, far.b], [near.r, near.b]], rgb(A, 1)); ctx.restore(); }
      // 中央グロス
      ctx.save(); ctx.globalAlpha = 0.10; poly([[xN(near, 0.42), near.b], [xN(far, 0.46), far.b], [xN(far, 0.54), far.b], [xN(near, 0.58), near.b]], "rgb(255,255,255)"); ctx.restore();
      if (openAir) {
        // オープンエア天井＝中央は開いた空（ベース空が見える）、両脇に建物の軒だけ描く
        poly([[near.l, near.t], [far.l, far.t], [xN(far, 0.20), far.t], [xN(near, 0.18), near.t]], rgb(EAVE, k));
        poly([[xN(near, 0.82), near.t], [xN(far, 0.80), far.t], [far.r, far.t], [near.r, near.t]], rgb(EAVE, k));
        // 軒の内側の影＋ワイヤー（吊り装飾）で“通路の上が抜けている”感
        line(xN(near, 0.18), near.t, xN(far, 0.20), far.t, rgba([90, 86, 80], k, 0.45), 1);
        line(xN(near, 0.82), near.t, xN(far, 0.80), far.t, rgba([90, 86, 80], k, 0.45), 1);
        if (c <= 2) { ctx.strokeStyle = rgba([120, 116, 108], k, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xN(near, 0.18), far.t + (near.t - far.t) * 0.5); ctx.quadraticCurveTo(cx, far.t + (near.t - far.t) * 0.62, xN(near, 0.82), far.t + (near.t - far.t) * 0.5); ctx.stroke(); }
      } else {
        // 天井（グラデ＋天窓＋照明パネル＋梁）
        let cg = ctx.createLinearGradient(0, near.t, 0, far.t); cg.addColorStop(0, rgb(CEIL, k)); cg.addColorStop(1, rgb(CEIL, k * 0.9));
        poly([[near.l, near.t], [far.l, far.t], [far.r, far.t], [near.r, near.t]], cg);
        poly([[xN(near, 0.40), near.t], [xN(far, 0.42), far.t], [xN(far, 0.58), far.t], [xN(near, 0.60), near.t]], rgba([255, 252, 240], k, 0.9)); // 天窓
        poly([[xN(near, 0.30), far.t], [xN(far, 0.34), far.t], [xN(far, 0.66), far.t], [xN(near, 0.70), far.t]], rgba([255, 255, 235], 1, 0.8)); // 照明
        line(near.l, near.t, far.l, far.t, rgba([90, 86, 80], k, 0.4), 1);
        line(near.r, near.t, far.r, far.t, rgba([90, 86, 80], k, 0.4), 1);
      }
      // 側壁
      if (wall(c, -1)) storefront(near, far, true, k, c);
      if (wall(c, 1)) storefront(near, far, false, k, c);
      // 吊り照明（中央）
      const lx = cx, ly = far.t + (near.t - far.t) * 0.25;
      ctx.fillStyle = rgba([255, 244, 200], 1, 0.9); ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.5, (near.t - far.t) * 0.04), 0, 7); ctx.fill();
      // ヤシ（手前2段の通路脇）
      if (c <= 2 && !wall(c, -1)) palm(xN(near, 0.12), near.b, (near.b - far.b) * 0.5 + 6, k);
      if (c <= 2 && !wall(c, 1)) palm(xN(near, 0.88), near.b, (near.b - far.b) * 0.5 + 6, k);
    }
  }

  // 👥 通行客（遠景シルエット）＝賑わうモールの空気感（純コスメ・当たり判定なし）
  if (!wall(1, 0) && !wall(2, 0)) {
    const R = rect[2], fh = (R.b - R.t) * 0.42;
    for (let i = 0; i < 3; i++) {
      const sp = 0.05 + i * 0.025, dir = i % 2 ? 1 : -1;
      let f = (ph * sp + i * 0.37) % 1; if (dir < 0) f = 1 - f;
      const wx = xN(R, 0.22 + f * 0.56), wy = R.b + Math.sin(ph * 3 + i) * fh * 0.03;
      const dark = 1 - dusk * 0.4, col = `rgba(${(64 * dark) | 0},${(58 * dark) | 0},${(72 * dark) | 0},0.45)`;
      ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(wx, wy, fh * 0.2, fh * 0.05, 0, 0, 7) : ctx.arc(wx, wy, fh * 0.1, 0, 7); ctx.fill();
      poly([[wx - fh * 0.12, wy], [wx + fh * 0.12, wy], [wx + fh * 0.08, wy - fh * 0.6], [wx - fh * 0.08, wy - fh * 0.6]], col);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(wx, wy - fh * 0.7, fh * 0.11, 0, 7); ctx.fill();
    }
  }
  // 光のシャフト（天窓から床へ）
  ctx.save(); ctx.globalAlpha = 0.10; let ls = ctx.createLinearGradient(0, rect[maxD].t, 0, H); ls.addColorStop(0, "rgb(255,250,225)"); ls.addColorStop(1, "rgba(255,250,225,0)"); ctx.fillStyle = ls; poly([[xN(rect[maxD], 0.42), rect[maxD].t], [xN(rect[maxD], 0.58), rect[maxD].t], [W * 0.72, H], [W * 0.28, H]], ls); ctx.restore();
  // 遠景もや（空気遠近）
  ctx.save(); ctx.globalAlpha = 0.5; let hz = ctx.createLinearGradient(0, cy - 18, 0, cy + 22); hz.addColorStop(0, "rgba(255,255,255,0)"); hz.addColorStop(0.5, dusk > 0.45 ? "rgba(255,220,190,0.5)" : "rgba(225,240,248,0.55)"); hz.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = hz; ctx.fillRect(0, cy - 22, W, 46); ctx.restore();
}

// =========================================================================
// 🎨 レンダラ差し替え点（シーム）── 3Dレンダリングへの移行を見据えた抽象化
//   「シーン記述(何を)」= rpgBuildViewScene() … 純データ（canvas/ctx非依存）
//   「描画手段(どう)」  = MallRender.backends[name](cv, scene, t)
//   既定は "2d"（現行のHD-2Dキャンバス）。3D化時は別ファイルから
//     window.MallRender.backends["3d"] = function(cv, scene, t){ ... };
//     window.MALL_RENDERER = "3d";   // 実行時スイッチ（既存 RC_USE_RIG と同思想）
//   未実装/失敗時は自動で "2d" にフォールバック（壊さない）。
// =========================================================================
// 一人称ダンジョンの「シーン記述」：前方に見えるもの＋フロアの色味/時間帯のみ。
// 描画手段に依存しない純データなので、2D/3Dどちらのバックエンドからも同じものを描ける。
function rpgBuildViewScene() {
  const fl = rpgFloorMeta(RPG.fi) || {};
  const dusk = fl.tower ? 0.2 : (fl.sky ? 1 : RPG.fi / Math.max(1, RPG_FLOORS.length - 1));
  const maxD = 4, ahead = [];
  for (let c = 1; c <= maxD; c++) {
    const tx = RPG.px + RPG_DV[RPG.dir][0] * c, ty = RPG.py + RPG_DV[RPG.dir][1] * c;
    if (rpgIsWall(rpgAhead(c, 0))) { ahead.push({ d: c, kind: "wall", closed: !!(RPG.closed && RPG.closed[tx + "," + ty]) }); break; }
    const cch = rpgAhead(c, 0);
    let kind = "floor";
    if (cch === "T" && !RPG.collected[RPG.fi + ":" + tx + "," + ty]) kind = "treasure";
    else if (cch === "U") kind = "stairs";
    else if (cch === "E") kind = rpgData().cleared ? "exit" : "boss";
    ahead.push({ d: c, kind: kind });
    if (kind !== "floor") break;
  }
  return {
    floor: RPG.fi, dir: RPG.dir, accent: fl.accent || [120, 160, 200],
    sunset: !!fl.sky, dusk: dusk, openAir: !fl.tower, ahead: ahead,
    cell: (d, l) => rpgAhead(d, l),   // 相対セル参照（2Dは側壁/店先に使用。3Dは ahead や RPG.map から幾何を組んでよい）
  };
}
const MallRender = {
  backends: {},
  dungeon(cv, scene, t) {
    const name = (typeof window !== "undefined" && window.MALL_RENDERER) || "2d";
    const fn = this.backends[name] || this.backends["2d"];
    try { fn(cv, scene, t); }
    catch (e) { if (name !== "2d" && this.backends["2d"]) try { this.backends["2d"](cv, scene, t); } catch (e2) {} }
  },
};
if (typeof window !== "undefined") window.MallRender = MallRender;   // 3Dバックエンドを外部ファイルから登録できるよう公開
// 既定バックエンド：現行のHD-2Dキャンバス描画（rpgScene＋前方アイコン＋後処理）
MallRender.backends["2d"] = function (cv, scene, t) {
  rpgFitCanvas(cv);                 // 表示枠いっぱいに描く（縦長フレームを埋める）
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  rpgScene(ctx, { W: cv.width, H: cv.height, t: t, accent: scene.accent, sunset: scene.sunset, dusk: scene.dusk, openAir: scene.openAir, cell: scene.cell });
  // 前方アイコン（宝箱/階段/ボス/出口/閉鎖）＋ふわふわ
  const W = cv.width, H = cv.height, cx = W / 2, cy = H * 0.46, maxD = 4, pp = 0.6, ph = t / 1000;
  const rt = []; for (let d = 0; d <= maxD; d++) { const s = Math.pow(pp, d); rt[d] = { t: cy - H * 0.5 * s, b: cy + H * 0.5 * s }; }
  if (!cv._noIcons) {
    for (let i = 0; i < scene.ahead.length; i++) {
      const a = scene.ahead[i], c = a.d, ym = (rt[c].t + rt[c].b) / 2, bob = Math.sin(ph * 2.2) * (rt[c].b - rt[c].t) * 0.03;
      if (a.kind === "wall") { if (a.closed) rpgDrawIcon(ctx, "🚧", rt[c], cx, ym); break; }
      if (a.kind === "treasure") { rpgDrawIcon(ctx, "📦", rt[c], cx, ym + bob); break; }
      if (a.kind === "stairs") { rpgDrawIcon(ctx, "🛗", rt[c], cx, ym + bob); break; }
      if (a.kind === "boss") { rpgDrawIcon(ctx, "🎡", rt[c], cx, ym + bob); break; }
      if (a.kind === "exit") { rpgDrawIcon(ctx, "🚪", rt[c], cx, ym + bob); break; }
      // floor は次の奥行きへ
    }
  }
  rpgPostFx(cv, ctx);
};
// 一人称ビューの描画エントリ：シーンを組み立て、現在のレンダラに委譲（差し替え点）。
function rpgDrawView(cv, t) {
  MallRender.dungeon(cv, rpgBuildViewScene(), t || 0);
}
// HD-2D風 後処理：ブルーム＋被写界深度(ティルトシフト)＋ビネット（GPUフィルタ・非対応端末は自動スキップ）
function rpgPostFx(cv, ctx) {
  const W = cv.width, H = cv.height, cx = W / 2, cy = H * 0.46;
  if ("filter" in ctx) {
    try {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.3; ctx.filter = "blur(5px) brightness(1.5)"; ctx.drawImage(cv, 0, 0); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.7; ctx.filter = "blur(3px)";
      ctx.drawImage(cv, 0, 0, W, H * 0.28, 0, 0, W, H * 0.28);
      ctx.drawImage(cv, 0, H * 0.86, W, H * 0.14, 0, H * 0.86, W, H * 0.14);
      ctx.restore();
    } catch (e) {}
    ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  const g = ctx.createRadialGradient(cx, cy, H * 0.32, cx, cy, H * 0.92);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ===== アイソメトリック戦闘アリーナ（斜め視点・tools/render_scene.js と同一の幾何） =====
function rpgIsoLayout(W, H, n) {
  const pcx = W * 0.5, pcy = H * 0.64, pw = W * 0.45, pdh = H * 0.16;
  const top = [pcx, pcy - pdh], right = [pcx + pw, pcy], bot = [pcx, pcy + pdh], left = [pcx - pw, pcy];
  const bn = Math.max(1, n), slots = [];
  for (let i = 0; i < bn; i++) {
    const f = bn === 1 ? 0.5 : (0.5 + (i - (bn - 1) / 2) * (0.62 / Math.max(1, bn - 1)));
    slots.push({ x: pcx + (f - 0.5) * pw * 1.05, y: pcy - pdh * 0.34 + (i % 2) * 10 });
  }
  return { pcx, pcy, pw, pdh, top, right, bot, left, slots, mimi: { x: pcx - pw * 0.46, y: pcy + pdh * 0.55 } };
}
function rpgIsoArena(ctx, env) {
  const W = env.W, H = env.H, A = env.accent, sunset = env.sunset, t = env.t || 0, ph = t / 1000, n = env.n || 2;
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const rgba = (a, k, al) => `rgba(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0},${al})`;
  const L = rpgIsoLayout(W, H, n);
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const line = (a, b, c, w) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.stroke(); };
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const ell = (p, rw, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(p.x, p.y, rw, rw * 0.4, 0, 0, 7) : ctx.arc(p.x, p.y, rw, 0, 7); ctx.fill(); };
  let sg = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  if (sunset) { sg.addColorStop(0, "rgb(255,150,95)"); sg.addColorStop(1, "rgb(255,212,165)"); }
  else { sg.addColorStop(0, "rgb(130,198,234)"); sg.addColorStop(1, "rgb(222,240,250)"); }
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.62);
  ctx.fillStyle = sunset ? "rgba(255,200,140,.4)" : "rgba(255,250,225,.4)"; ctx.beginPath(); ctx.arc(W * 0.74, H * 0.24, 42, 0, 7); ctx.fill();
  ctx.fillStyle = sunset ? "rgba(255,178,108,.96)" : "rgba(255,250,220,.96)"; ctx.beginPath(); ctx.arc(W * 0.74, H * 0.24, 24, 0, 7); ctx.fill();
  let se = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.64);
  if (sunset) { se.addColorStop(0, "rgb(120,120,170)"); se.addColorStop(1, "rgb(70,84,128)"); }
  else { se.addColorStop(0, "rgb(72,176,216)"); se.addColorStop(1, "rgb(40,135,185)"); }
  ctx.fillStyle = se; ctx.fillRect(0, H * 0.42, W, H * 0.22);
  for (let i = 0; i < 3; i++) { const wy = H * (0.46 + i * 0.045); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = 0; xx <= W; xx += 3) { const yy = wy + Math.sin(xx * 0.05 + ph * 2 + i) * 1.5; xx === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
  const dp = 16;
  poly([L.left, L.bot, [L.bot[0], L.bot[1] + dp], [L.left[0], L.left[1] + dp]], rgb(A, 0.45));
  poly([L.bot, L.right, [L.right[0], L.right[1] + dp], [L.bot[0], L.bot[1] + dp]], rgb(A, 0.34));
  let pg = ctx.createLinearGradient(0, L.pcy - L.pdh, 0, L.pcy + L.pdh); pg.addColorStop(0, "rgb(196,206,218)"); pg.addColorStop(1, "rgb(238,242,247)");
  poly([L.top, L.right, L.bot, L.left], pg);
  const N = 6, grout = "rgba(120,132,148,0.45)";
  for (let i = 1; i < N; i++) { const f = i / N; line(lerp(L.top, L.left, f), lerp(L.right, L.bot, f), grout, 1); line(lerp(L.top, L.right, f), lerp(L.left, L.bot, f), grout, 1); }
  line(L.left, L.top, rgba(A, 1.2, 0.85), 2); line(L.top, L.right, rgba(A, 1.2, 0.85), 2);
  let spg = ctx.createRadialGradient(L.pcx, L.pcy, 8, L.pcx, L.pcy, L.pw * 0.95); spg.addColorStop(0, "rgba(255,250,225,0.3)"); spg.addColorStop(1, "rgba(255,250,225,0)");
  poly([L.top, L.right, L.bot, L.left], spg);
  L.slots.forEach((s) => ell({ x: s.x, y: s.y }, 28, "rgba(0,0,0,0.30)"));
  ell({ x: L.mimi.x, y: L.mimi.y }, 26, "rgba(0,0,0,0.30)");
  rpgArenaPost(env.cv || null, ctx, W, H);
}
function rpgArenaPost(cv, ctx, W, H) {
  if (cv && "filter" in ctx) {
    try { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.22; ctx.filter = "blur(6px) brightness(1.4)"; ctx.drawImage(cv, 0, 0); ctx.restore(); } catch (e) {}
    ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.95);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ===== 戦闘シーン（全部canvasに描く＝DOM絶対配置のバグを根絶） =====
function rpgRRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); } ctx.closePath(); }
// ★浮かれた観光客＝丸顔のかわいいフラットベクター人物（アロハ＋麦わら帽＋手持ち小物）
function rpgTouristPal(id) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const shirts = [[255, 138, 96], [86, 178, 222], [122, 200, 144], [244, 200, 96], [200, 142, 214], [246, 152, 172]];
  const hats = [[250, 238, 214], [255, 255, 255], [250, 224, 140], [126, 202, 210]];
  const skins = [[255, 224, 196], [244, 206, 174], [228, 188, 158]];
  return { shirt: shirts[h % shirts.length], hat: hats[(h >>> 3) % hats.length], skin: skins[(h >>> 6) % skins.length] };
}
function rpgDrawTourist(ctx, cx, gy, fh, pal, emoji) {
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * (k || 1)) | 0},${Math.min(255, a[1] * (k || 1)) | 0},${Math.min(255, a[2] * (k || 1)) | 0})`;
  const poly = (pts, f) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
  const disc = (x, y, r, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const sh = pal.shirt, sk = pal.skin, ht = pal.hat;
  const rh = fh * 0.2, headY = gy - fh + rh, shoulderY = headY + rh * 1.15, hipY = gy - fh * 0.32, bw = fh * 0.36;
  ctx.fillStyle = rgb([70, 80, 104]); ctx.fillRect(cx - bw * 0.36, hipY, bw * 0.3, gy - hipY - 3); ctx.fillRect(cx + bw * 0.06, hipY, bw * 0.3, gy - hipY - 3);
  ctx.fillStyle = rgb([238, 238, 244]); ctx.fillRect(cx - bw * 0.42, gy - 4, bw * 0.36, 4); ctx.fillRect(cx + bw * 0.06, gy - 4, bw * 0.36, 4);
  disc(cx + bw * 0.52, shoulderY + fh * 0.16, fh * 0.05, rgb(sk, 0.96));
  poly([[cx - bw * 0.5, hipY + 2], [cx + bw * 0.5, hipY + 2], [cx + bw * 0.42, shoulderY], [cx - bw * 0.42, shoulderY]], rgb(sh));
  poly([[cx - bw * 0.12, shoulderY], [cx + bw * 0.12, shoulderY], [cx, shoulderY + fh * 0.08]], rgb(sk));
  for (let i = 0; i < 3; i++) disc(cx - bw * 0.22 + i * bw * 0.22, hipY - fh * 0.06, fh * 0.03, rgb(sh, 0.8));
  disc(cx - bw * 0.52, shoulderY + fh * 0.16, fh * 0.05, rgb(sk));
  ctx.fillStyle = rgb(sk); ctx.fillRect(cx - rh * 0.28, shoulderY - rh * 0.5, rh * 0.56, rh * 0.7);
  disc(cx, headY, rh, rgb(sk));
  disc(cx - rh * 0.36, headY - rh * 0.02, rh * 0.12, "#3a2a22"); disc(cx + rh * 0.36, headY - rh * 0.02, rh * 0.12, "#3a2a22");
  ctx.strokeStyle = "#3a2a22"; ctx.lineWidth = Math.max(1, fh * 0.018); ctx.beginPath(); ctx.arc(cx, headY + rh * 0.12, rh * 0.3, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
  disc(cx - rh * 0.56, headY + rh * 0.24, rh * 0.15, "rgba(255,150,150,0.45)"); disc(cx + rh * 0.56, headY + rh * 0.24, rh * 0.15, "rgba(255,150,150,0.45)");
  const hatY = headY - rh * 0.62;
  poly([[cx - rh * 1.45, hatY], [cx + rh * 1.45, hatY], [cx + rh * 0.95, hatY - rh * 0.12], [cx - rh * 0.95, hatY - rh * 0.12]], rgb(ht, 0.94));
  poly([[cx - rh * 0.82, hatY - rh * 0.06], [cx + rh * 0.82, hatY - rh * 0.06], [cx + rh * 0.58, hatY - rh * 0.82], [cx - rh * 0.58, hatY - rh * 0.82]], rgb(ht));
  ctx.fillStyle = rgb(sh); ctx.fillRect(cx - rh * 0.82, hatY - rh * 0.34, rh * 1.64, rh * 0.16);
  if (emoji) { disc(cx - bw * 0.55, shoulderY + fh * 0.22, fh * 0.14, "rgba(255,252,240,0.95)"); if (ctx.fillText) { ctx.font = (fh * 0.2) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#000"; ctx.fillText(emoji, cx - bw * 0.55, shoulderY + fh * 0.22); } }
}
function rpgDrawBattle(cv, t) {
  const b = RPG && RPG.battle; if (!b) return;
  rpgFitCanvas(cv);                 // 表示枠いっぱいに描く（縦長フレームを埋める）
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = true;
  const W = cv.width, H = cv.height, n = b.enemies.length, fl = rpgFloorMeta(RPG.fi) || {}, A = fl.accent || [80, 160, 200], sunset = !!fl.sky, ph = (t || 0) / 1000;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const an = b.anim || null;
  const rgb = (a, k) => `rgb(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0})`;
  const poly = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const ell = (x, y, rw, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(x, y, rw, rw * 0.4, 0, 0, 7) : ctx.arc(x, y, rw, 0, 7); ctx.fill(); };
  const L = rpgIsoLayout(W, H, n);
  const eIn = u => u * u, eOut = u => 1 - (1 - u) * (1 - u);
  // ── アニメ・オフセット（攻撃モーション）
  function mimiOff() {
    if (!an || an.who !== "mimi") return [0, 0];
    const e = now - an.t0, tA = 140, tL = 100, fz = an.freeze || 80, tR = 220, cA = tA + tL;
    const tg = L.slots[an.tIdx] || L.slots[0], lx = (tg.x - L.mimi.x) * 0.62, ly = (tg.y - L.mimi.y) * 0.62;
    if (e < tA) { const u = e / tA; return [-14 * u, 8 * u]; }
    if (e < cA) { const u = eIn((e - tA) / tL); return [-14 + (lx + 14) * u, 8 + (ly - 8) * u]; }
    if (e < cA + fz) return [lx, ly];
    if (e < cA + fz + tR) { const u = eOut((e - cA - fz) / tR); return [lx * (1 - u), ly * (1 - u)]; }
    return [0, 0];
  }
  function enemyOff(i) {
    if (!an) return [0, 0];
    if (an.who === "mimi" && an.tIdx === i) { const cA = an.contactAt; if (now < cA) return [0, 0]; const e = now - cA, dur = (an.freeze || 80) + 220; if (e > dur) return [0, 0]; const u = e / dur, k = (an.knock || 14) * (1 - u) * Math.cos(u * 4); return [k, -k * 0.25]; }
    if (an.who === "enemy" && an.aIdx === i) { const s = L.slots[i], lx = (L.mimi.x - s.x) * 0.5, ly = (L.mimi.y - s.y) * 0.5, e = now - an.t0, tA = 120, tL = 110, fz = an.freeze || 70, tR = 200, cA = tA + tL; if (e < tA) { const u = e / tA; return [-lx * 0.12 * u, -ly * 0.12 * u]; } if (e < cA) { const u = eIn((e - tA) / tL); return [lx * u, ly * u]; } if (e < cA + fz) return [lx, ly]; if (e < cA + fz + tR) { const u = eOut((e - cA - fz) / tR); return [lx * (1 - u), ly * (1 - u)]; } return [0, 0]; }
    return [0, 0];
  }
  function mimiKnock() { if (!an || an.who !== "enemy") return [0, 0]; const cA = an.contactAt; if (now < cA) return [0, 0]; const e = now - cA, dur = (an.freeze || 70) + 200; if (e > dur) return [0, 0]; const u = e / dur, k = (an.knock || 12) * (1 - u) * Math.cos(u * 4); return [-k * 0.3, k * 0.3]; }
  // シェイク（着弾時・減衰）
  let shx = 0, shy = 0;
  if (an && !rpgReduce()) { const cA = an.contactAt; if (now >= cA && now < cA + 260) { const dec = Math.max(0, 1 - (now - cA) / 260), m = (an.shakeMag || 8) * dec; shx = (Math.random() * 2 - 1) * m; shy = (Math.random() * 2 - 1) * m; } }
  // ── 背景（固定・HD-2D風ジオラマ：暖色の砂石床×寒色の空海／遠景リゾート／前景ヤシ）
  const rgba = (a, k, al) => `rgba(${Math.min(255, a[0] * k) | 0},${Math.min(255, a[1] * k) | 0},${Math.min(255, a[2] * k) | 0},${al})`;
  const ellf = (x, y, rw, rh, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(x, y, rw, rh, 0, 0, 7) : ctx.arc(x, y, rw, 0, 7); ctx.fill(); };
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  // 空（3段グラデ）
  let sg = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  if (sunset) { sg.addColorStop(0, "rgb(255,138,86)"); sg.addColorStop(0.5, "rgb(255,178,120)"); sg.addColorStop(1, "rgb(255,222,180)"); }
  else { sg.addColorStop(0, "rgb(96,176,228)"); sg.addColorStop(0.6, "rgb(160,212,240)"); sg.addColorStop(1, "rgb(224,242,250)"); }
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.64);
  // 雲（やわらかい層雲）
  ctx.globalAlpha = 0.5; for (let i = 0; i < 3; i++) { const cx = (i * 190 + 60) % W, cy = H * (0.1 + i * 0.07); ellf(cx, cy, 54, 11, sunset ? "rgba(255,236,214,0.7)" : "rgba(255,255,255,0.6)"); ellf(cx + 34, cy + 5, 38, 8, sunset ? "rgba(255,228,205,0.55)" : "rgba(248,252,255,0.5)"); } ctx.globalAlpha = 1;
  // 太陽＋ブルーム光輪
  const sux = W * 0.78, suy = H * 0.2;
  ellf(sux, suy, 50, 50, sunset ? "rgba(255,200,140,0.25)" : "rgba(255,250,225,0.3)");
  ellf(sux, suy, 32, 32, sunset ? "rgba(255,210,150,0.45)" : "rgba(255,252,235,0.55)");
  ellf(sux, suy, 21, 21, sunset ? "rgb(255,180,110)" : "rgb(255,252,225)");
  // 遠景リゾートのシルエット
  const hz = H * 0.42;
  ctx.fillStyle = sunset ? "rgba(120,90,120,0.45)" : "rgba(90,140,160,0.4)";
  for (let x = 0; x < W; x += 46) { ctx.fillRect(x + 6, hz - 10, 3, 10); for (let a = 0; a < 5; a++) { const ang = -Math.PI / 2 + (a - 2) * 0.5; ctx.fillRect(x + 7 + Math.cos(ang) * 7, hz - 10 + Math.sin(ang) * 5, 2, 2); } }
  ctx.fillStyle = sunset ? "rgba(120,90,120,0.32)" : "rgba(90,140,160,0.28)"; ctx.fillRect(W * 0.4, hz - 16, 10, 16); ctx.fillRect(W * 0.55, hz - 22, 8, 22);
  // 海＋地平もや＋日光の柱
  let se = ctx.createLinearGradient(0, hz, 0, H * 0.66); if (sunset) { se.addColorStop(0, "rgb(150,130,180)"); se.addColorStop(1, "rgb(64,78,124)"); } else { se.addColorStop(0, "rgb(96,196,228)"); se.addColorStop(1, "rgb(38,128,182)"); } ctx.fillStyle = se; ctx.fillRect(0, hz, W, H * 0.66 - hz);
  ctx.fillStyle = sunset ? "rgba(255,200,150,0.32)" : "rgba(225,245,252,0.38)"; ctx.fillRect(0, hz - 3, W, 7);
  ctx.fillStyle = sunset ? "rgba(255,210,150,0.28)" : "rgba(255,252,230,0.28)"; ctx.fillRect(sux - 14, hz, 28, H * 0.66 - hz);
  for (let i = 0; i < 4; i++) { const wy = hz + (H * 0.66 - hz) * (0.18 + i * 0.2); ctx.strokeStyle = "rgba(255,255,255,.42)"; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = 0; xx <= W; xx += 4) { const yy = wy + Math.sin(xx * 0.05 + ph * 2 + i) * 1.5; xx === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); }
  // ── ステージ（シェイク適用）
  ctx.save(); ctx.translate(shx, shy);
  const dp = 16; poly([L.left, L.bot, [L.bot[0], L.bot[1] + dp], [L.left[0], L.left[1] + dp]], rgb(A, 0.45)); poly([L.bot, L.right, [L.right[0], L.right[1] + dp], [L.bot[0], L.bot[1] + dp]], rgb(A, 0.34));
  let pg = ctx.createLinearGradient(0, L.pcy - L.pdh, 0, L.pcy + L.pdh); pg.addColorStop(0, sunset ? "rgb(206,176,158)" : "rgb(200,196,186)"); pg.addColorStop(1, sunset ? "rgb(232,206,184)" : "rgb(228,222,210)"); poly([L.top, L.right, L.bot, L.left], pg);
  let wg = ctx.createRadialGradient(L.pcx - L.pw * 0.3, L.pcy + L.pdh * 0.4, 6, L.pcx - L.pw * 0.3, L.pcy + L.pdh * 0.4, L.pw); wg.addColorStop(0, sunset ? "rgba(255,196,140,0.4)" : "rgba(255,226,180,0.3)"); wg.addColorStop(1, "rgba(255,226,180,0)"); poly([L.top, L.right, L.bot, L.left], wg);
  for (let i = 1; i < 6; i++) { const f = i / 6; ctx.strokeStyle = "rgba(150,138,120,0.34)"; ctx.lineWidth = 1; const p1 = lerp(L.top, L.left, f), p2 = lerp(L.right, L.bot, f); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); const q1 = lerp(L.top, L.right, f), q2 = lerp(L.left, L.bot, f); ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke(); }
  ctx.strokeStyle = rgba(A, 1.2, 0.85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L.left[0], L.left[1]); ctx.lineTo(L.top[0], L.top[1]); ctx.lineTo(L.right[0], L.right[1]); ctx.stroke();
  let spg = ctx.createRadialGradient(L.pcx, L.pcy, 8, L.pcx, L.pcy, L.pw * 0.95); spg.addColorStop(0, "rgba(255,248,224,0.16)"); spg.addColorStop(1, "rgba(255,248,224,0)"); poly([L.top, L.right, L.bot, L.left], spg);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  b.enemies.forEach((e, i) => {
    const s = L.slots[i] || L.slots[L.slots.length - 1], alive = e.alive, off = enemyOff(i), ex = s.x + off[0];
    const intro = b.introT0 ? Math.min(1, Math.max(0, (now - b.introT0 - i * 70) / 340)) : 1;
    const DDUR = 760, dt = e._deadAt ? now - e._deadAt : 1e9, dying = !alive && dt < DDUR, du = dt / DDUR;
    const tourist = e.ref.kind === "tourist";
    if (alive || dying) ell(s.x, s.y, 25, "rgba(0,0,0," + (0.30 * (alive ? intro : Math.max(0, 1 - du * 1.4))) + ")");
    if (b.target === i && alive && b.phase === "cmd") { ell(s.x, s.y, 33, "rgba(255,95,162,0.20)"); const ay = s.y - 72 + Math.sin(ph * 4) * 3; poly([[s.x, ay], [s.x - 7, ay - 10], [s.x + 7, ay - 10]], "rgb(255,95,162)"); }
    const bob = alive ? Math.sin(ph * 2 + i * 1.3) * 3 : 0, cy = s.y + off[1] - 30 + bob - 18 * (1 - intro);
    if (alive || dying) {
      const riseY = dying ? -du * 32 : 0;
      ctx.save(); ctx.globalAlpha = alive ? intro : Math.max(0, 1 - du * 1.15);
      if (b.rare && alive) { const ga = ctx.createRadialGradient(ex, cy, 4, ex, cy, 42); ga.addColorStop(0, "rgba(255,220,120," + (0.55 * intro) + ")"); ga.addColorStop(1, "rgba(255,220,120,0)"); ctx.fillStyle = ga; ctx.beginPath(); ctx.arc(ex, cy, 42, 0, 7); ctx.fill(); }
      if (alive && e._flash && now - e._flash < 150) { ctx.shadowColor = "#fff"; ctx.shadowBlur = 22; }
      if (alive && e._flash && now - e._flash < 200) { const u = (now - e._flash) / 200, sc = 1 + Math.sin(u * Math.PI) * 0.16; ctx.translate(ex, cy); ctx.scale(sc, sc); ctx.translate(-ex, -cy); }   // 被弾スカッシュ（命中がはっきり読める）
      if (dying) { const sc = 1 + du * 0.28; ctx.translate(ex, s.y + off[1] + riseY); ctx.scale(sc, sc); ctx.translate(-ex, -(s.y + off[1])); }
      if (tourist) {
        e._pal = e._pal || rpgTouristPal(e.id);
        rpgDrawTourist(ctx, ex, s.y + off[1] - bob * 0.5, 62 * (0.5 + 0.5 * intro), e._pal, e.ref.ic);
      } else {
        const sz = (b.boss ? 70 : 48) * (0.45 + 0.55 * intro), art = rpgEnemyArt(e.id);
        if (art) ctx.drawImage(art, ex - sz / 2, cy - sz / 2, sz, sz);
        else { ctx.font = sz + "px serif"; ctx.fillText(e.ref.ic, ex, cy); }
      }
      ctx.shadowBlur = 0; ctx.restore();
    }
    // ── 撃破の余韻（ポップ＋舞い上がるきらめき／ハート＝観光客は満足、モンスターは砕け散る）
    if (dying) {
      const px = ex, py = s.y + off[1] - 34;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - du);
      const ring = tourist ? "rgba(255,196,110," : "rgba(255,255,255,";
      ctx.strokeStyle = ring + (1 - du) + ")"; ctx.lineWidth = (1 - du) * 5 + 1; ctx.beginPath(); ctx.arc(px, py, 6 + du * 40, 0, 7); ctx.stroke();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * 6.283 + 0.5, sp = 12 + (k % 3) * 9, pr = (1 - du) * 3 + 1.6;
        const qx = px + Math.cos(a) * sp * (0.35 + du * 1.1), qy = py + Math.sin(a) * sp * 0.5 - du * 46;
        ctx.fillStyle = tourist ? (k % 2 ? "rgba(255,138,178,0.96)" : "rgba(255,226,120,0.96)") : (k % 2 ? "rgba(206,214,232,0.96)" : "rgba(255,255,255,0.92)");
        ctx.beginPath(); ctx.arc(qx, qy, pr, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = Math.max(0, 1 - du * 1.2); ctx.font = (16 + du * 10) + "px serif"; ctx.fillText(tourist ? "💕" : "💥", px, py - du * 50);
      ctx.restore();
    }
    if (alive) {
      const pct = Math.max(0, e.hp) / e.maxhp;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(ex - 26, s.y + 3, 52, 6);
      ctx.fillStyle = pct > 0.3 ? "#46d06a" : "#e2384f"; ctx.fillRect(ex - 26, s.y + 3, 52 * pct, 6);
      if (e.intent && b.phase === "cmd") { const it = e.intent, ic = it.sp ? (RPG_STATUS[it.status] ? RPG_STATUS[it.status].ic : "✨") : "⚔️"; ctx.font = "17px serif"; ctx.fillText(ic, ex, s.y - 62 + Math.sin(ph * 3 + i) * 2); }
    }
  });
  // ミミ（手前＝プレイヤー）
  const mo = an && an.who === "mimi" ? mimiOff() : (an && an.who === "enemy" ? mimiKnock() : [0, 0]);
  const mx = L.mimi.x + mo[0], myy = L.mimi.y + mo[1];
  ell(L.mimi.x, L.mimi.y, 27, "rgba(0,0,0,0.30)");
  const mbobY = myy - 32 + Math.sin(ph * 1.6) * 3, mart = rpgMimiArt();
  if (mart) { const mw = 92, mh = mw * (mart.naturalHeight / mart.naturalWidth); ctx.drawImage(mart, mx - mw / 2, myy - mh + 8 + Math.sin(ph * 1.6) * 3, mw, mh); }
  else { ctx.font = "60px serif"; ctx.fillText("🐰", mx, mbobY); }
  ctx.fillStyle = "rgba(255,95,162,0.92)"; rpgRRect(ctx, mx - 22, myy + 1, 44, 18, 9); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textBaseline = "middle"; ctx.fillText("ミミ", mx, myy + 10);
  // ── 着弾バースト（放射パーティクル）
  if (an && an.burst && now >= an.contactAt && now < an.contactAt + 260) {
    const e = now - an.contactAt, u = e / 260; let bx, by;
    if (an.who === "mimi") { const s = L.slots[an.tIdx] || L.slots[0], ko = enemyOff(an.tIdx); bx = s.x + ko[0]; by = s.y + ko[1] - 30; } else { bx = mx; by = myy - 30; }
    ctx.save(); ctx.globalAlpha = 1 - u;
    for (let k = 0; k < an.burst.n; k++) { const a = (k / an.burst.n) * 6.28 + u * 1.5, r = an.burst.r * (0.25 + u * 1.3); ctx.fillStyle = an.burst.col; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.9, (1 - u) * 4 + 1.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, an.burst.r * 0.4 * (0.4 + u), 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.restore(); // ステージ終了（シェイク解除）
  // ── 前景ヤシ（被写界深度の手前＝フレーミング）
  const palm = (bx, by, s, k) => {
    ctx.fillStyle = rgb([70, 52, 40], k); ctx.fillRect(bx - s * 0.1, by - s * 2.2, s * 0.2, s * 2.2);
    for (let a = 0; a < 7; a++) { const ang = -Math.PI / 2 + (a - 3) * 0.42, ex = bx + Math.cos(ang) * s * 1.5, ey = by - s * 2.2 + Math.sin(ang) * s; poly([[bx, by - s * 2.2], [ex - s * 0.16, ey], [ex + s * 0.16, ey + s * 0.1]], rgb([40, 120, 80], k * (0.8 + a * 0.03))); }
    ctx.fillStyle = rgb([54, 140, 92], k); ctx.beginPath(); ctx.arc(bx, by - s * 2.2, s * 0.26, 0, 7); ctx.fill();
  };
  palm(W * 0.045, H + 6, 26, 0.74); palm(W * 0.965, H + 8, 28, 0.7);
  // ── HD-2D風ブルーム（明部を加算でにじませて発光感）
  if ("filter" in ctx) { try { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.16; ctx.filter = "blur(5px) brightness(1.32)"; ctx.drawImage(cv, 0, 0); ctx.restore(); } catch (e) {} ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
  // ── UI（固定・最小限：手番はターン切替の一瞬演出で示す）
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const stk = Object.keys(RPG_STATUS).filter(k => b.pstatus[k] > 0);
  if (stk.length) { ctx.font = "18px serif"; stk.forEach((k, i) => ctx.fillText(RPG_STATUS[k].ic, 10 + i * 24, 18)); }
  ctx.textAlign = "center";
  const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.34, W / 2, H * 0.5, H * 0.95); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.34)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
// タップで敵を選択
function rpgBattleTap(ev, cv) {
  if (!RPG || !RPG.battle || RPG.busy) return;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * cv.width, y = (ev.clientY - r.top) / r.height * cv.height;
  const L = rpgIsoLayout(cv.width, cv.height, RPG.battle.enemies.length);
  let best = -1, bd = 1e9;
  RPG.battle.enemies.forEach((e, i) => { if (!e.alive) return; const s = L.slots[i]; const dx = x - s.x, dy = y - (s.y - 30), d = Math.hypot(dx, dy); if (d < bd && d < 52) { bd = d; best = i; } });
  if (best >= 0 && best !== RPG.battle.target) rpgSelectTarget(best);
}
let _rpgBRaf = 0;
function rpgStartBattleRaf(cv) {
  RPG._btlCv = cv;
  if (_rpgBRaf) return;
  const loop = (t) => {
    _rpgBRaf = 0;
    if (RPG && RPG.mode === "battle" && state.ui.screen === "mall_rpg" && RPG._btlCv && RPG._btlCv.isConnected) {
      try { rpgDrawBattle(RPG._btlCv, t); } catch (e) {}
      _rpgBRaf = requestAnimationFrame(loop);
    }
  };
  _rpgBRaf = requestAnimationFrame(loop);
}

let _rpgRaf = 0;
function rpgStartAmbient(cv) {
  RPG._viewCv = cv;
  if (_rpgRaf) return;
  const loop = (t) => {
    _rpgRaf = 0;
    if (RPG && RPG.mode === "explore" && state.ui.screen === "mall_rpg" && RPG._viewCv && RPG._viewCv.isConnected) {
      try { rpgDrawView(RPG._viewCv, t); } catch (e) {}
      rpgAmbient();                                   // 🔊 環境音を周期的にそっと鳴らす（自前スロットル）
      _rpgRaf = requestAnimationFrame(loop);
    }
  };
  _rpgRaf = requestAnimationFrame(loop);
}
function rpgDrawIcon(ctx, ic, r, cx, cy) {
  const size = Math.max(12, (r.b - r.t) * 0.42);
  ctx.font = size + "px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ic, cx, (r.t + r.b) / 2);
}
// 絵文字を低解像canvasに描いてCSSでpixelated拡大＝ドット絵風スプライト
function rpgMakeSprite(emoji, disp, cls) {
  const cv = el("canvas", "rpg-spr" + (cls ? " " + cls : ""));
  const R = 128;                                  // 高解像＝なめらか（アート無し時のフォールバック品質UP）
  cv.width = R; cv.height = R;
  cv.style.width = (disp || 56) + "px"; cv.style.height = (disp || 56) + "px";
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.font = Math.round(R * 0.8) + "px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(emoji, R / 2, R / 2 + 4);
  return cv;
}
// ★アート組み込み口：アートを用意した id をここに足すだけで、絵文字→画像に切替。
//   （未登録なら画像を読みに行かない＝404/コンソールエラーが出ない）
//   例: const RPG_ART_ENEMIES = ["slime", "boss1"];  → images/rpg/enemies/slime.webp 等を表示
const RPG_ART_ENEMIES = [];
// ミミ立ち絵の差し込み口：images/rpg/mimi.webp を置いて true にすると戦闘の手前に立ち絵表示
const RPG_ART_MIMI = false;
let _rpgMimiImg = null;
function rpgMimiArt() {
  if (!RPG_ART_MIMI) return null;
  if (!_rpgMimiImg) { _rpgMimiImg = new Image(); _rpgMimiImg.src = "images/rpg/mimi.webp"; }
  return (_rpgMimiImg.complete && _rpgMimiImg.naturalWidth) ? _rpgMimiImg : null;
}
// 敵アートのcanvas描画（rpgMimiArt()と同じ方式：Image().complete/naturalWidthで判定）。
// 戦闘シーンは単一canvasへの直描きのため、DOM要素を返すrpgEnemyVisual()はここでは使わず、
// 同じ画像パスをcanvas用に直接キャッシュ・drawImageする（RPG_ART_ENEMIES未登録なら読みに行かない＝404を出さない）。
const _rpgEnemyArtCache = {};
function rpgEnemyArt(id) {
  if (RPG_ART_ENEMIES.indexOf(id) < 0) return null;
  let img = _rpgEnemyArtCache[id];
  if (!img) { img = _rpgEnemyArtCache[id] = new Image(); img.src = "images/rpg/enemies/" + id + ".webp"; }
  return (img.complete && img.naturalWidth) ? img : null;
}
function rpgEnemyVisual(id, emoji, disp, cls) {
  if (RPG_ART_ENEMIES.indexOf(id) < 0) return rpgMakeSprite(emoji, disp, cls);
  const img = document.createElement("img");
  img.className = "rpg-spr rpg-img" + (cls ? " " + cls : "");
  img.alt = ""; img.decoding = "async";
  img.style.width = (disp || 56) + "px"; img.style.height = (disp || 56) + "px";
  img.src = "images/rpg/enemies/" + id + ".webp";
  img.onerror = () => { const s = rpgMakeSprite(emoji, disp, cls); if (img.parentNode) img.parentNode.replaceChild(s, img); };
  return img;
}
function rpgMiniMap() {
  const wrap = el("div", "rpg-mini");
  const cell = 14;
  // 高DPR端末でぼやけないよう、CSS表示サイズ(76px固定)は変えずに内部解像度だけdpr倍する
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const cv = el("canvas");
  cv.width = RPG.w * cell * dpr; cv.height = RPG.h * cell * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);   // 以降は従来どおり cell 単位の論理座標で描ける
  // 床/壁/未踏のベース塗り（探索済みは永続表示）
  for (let y = 0; y < RPG.h; y++) for (let x = 0; x < RPG.w; x++) {
    const seen = RPG.explored[x + "," + y];
    const c = rpgCell(x, y);
    // 階段=青／出口=緑／宝=金（開封済は暗色）／床=薄紫。未踏は暗く沈める。
    let col = "#9a8fc0";
    if (c === "#") col = "#5a4d72";
    else if (c === "U") col = "#5aa6e0";
    else if (c === "E") col = "#7ad07a";
    else if (c === "T") col = RPG.collected[RPG.fi + ":" + x + "," + y] ? "#6b5a44" : "#e0b450";
    ctx.fillStyle = !seen ? "#322a46" : col;
    ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
  }
  // 目印アイコン（探索済みセルのみ・canvas直描きで小さくても潰れない）
  for (let y = 0; y < RPG.h; y++) for (let x = 0; x < RPG.w; x++) {
    if (!RPG.explored[x + "," + y]) continue;
    const c = rpgCell(x, y), cx = x * cell + (cell - 1) / 2, cy = y * cell + (cell - 1) / 2;
    if (c === "U") {                                   // 階段＝上向きシェブロン（昇り口）
      ctx.strokeStyle = "#eaf4ff"; ctx.lineWidth = 1.4; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 3.2, cy + 1.6); ctx.lineTo(cx, cy - 1.8); ctx.lineTo(cx + 3.2, cy + 1.6);
      ctx.stroke();
    } else if (c === "T") {                             // 宝＝菱形（未開封=金の塗り／開封済=細い枠だけ）
      const opened = RPG.collected[RPG.fi + ":" + x + "," + y];
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3.2); ctx.lineTo(cx + 3.2, cy); ctx.lineTo(cx, cy + 3.2); ctx.lineTo(cx - 3.2, cy);
      ctx.closePath();
      if (opened) { ctx.strokeStyle = "rgba(220,200,170,.5)"; ctx.lineWidth = 1; ctx.stroke(); }
      else { ctx.fillStyle = "#fff1c4"; ctx.fill(); }
    } else if (c === "E") {                             // 出口＝ドアの白枠
      ctx.strokeStyle = "#eafff0"; ctx.lineWidth = 1.3;
      ctx.strokeRect(cx - 3, cy - 3.4, 6, 6.8);
    }
  }
  // 現在地リング（自分の位置を一目で）
  const px = RPG.px * cell + (cell - 1) / 2, py = RPG.py * cell + (cell - 1) / 2, f = RPG_DV[RPG.dir];
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
  // プレイヤー（向き矢印）
  ctx.fillStyle = "#ff5fa2";
  ctx.beginPath();
  ctx.moveTo(px + f[0] * 5, py + f[1] * 5);
  ctx.lineTo(px - f[1] * 4 - f[0] * 3, py + f[0] * 4 - f[1] * 3);
  ctx.lineTo(px + f[1] * 4 - f[0] * 3, py - f[0] * 4 - f[1] * 3);
  ctx.closePath(); ctx.fill();
  wrap.appendChild(cv);
  return wrap;
}

// ── 戦闘画面（シーンは1枚canvas／コマンドは単純な縦積み＝崩れない）
function rpgRenderBattle(app) {
  const d = rpgData(), b = RPG.battle;
  if (b.phase === "cmd" && !(b.enemies[b.target] && b.enemies[b.target].alive)) rpgAutoPickTarget();   // 狙いは自動
  // ===== 斜め視点シーン（全部canvasに描画） =====
  const scr = el("div", "rpg-battle");   // 縦いっぱい：アリーナ(伸縮)＋コマンド(下部固定＝親指ゾーン)
  const arena = el("div", "rpg-bt-arena");
  const cv = el("canvas", "rpg-bt-cv"); cv.width = 520; cv.height = 380;   // 初期値（以後 rpgFitCanvas が追従）
  arena.appendChild(cv);
  try { rpgDrawBattle(cv, (typeof performance !== "undefined" ? performance.now() : 0)); } catch (e) {}
  cv.onclick = (ev) => rpgBattleTap(ev, cv);
  scr.appendChild(arena);
  rpgStartBattleRaf(cv);

  // ===== コマンドパネル（下部固定・親指ゾーン） =====
  const panel = el("div", "rpg-bt-panel");
  // 敵：1行サマリ（省略表示で崩れない）＋アイコンのみのチップ（複数時のみ）。名前はサマリだけに置き重なりを排除
  const foes = el("div", "rpg-foes");
  const aliveList = rpgAliveEnemies();
  let tgi = (b.enemies[b.target] && b.enemies[b.target].alive) ? b.target : (aliveList[0] ? b.enemies.indexOf(aliveList[0]) : 0);
  const tg0 = b.enemies[tgi];
  if (tg0) {
    const seen = d.codex[tg0.id], wk = seen && seen.weak.length ? seen.weak.map(x => RPG_ELEM_IC[x]).join("") : "？";
    const line = el("div", "foe-line");
    line.innerHTML = `🎯 ${tg0.ref.ic} <b>${tg0.ref.n}</b> <span class="fl-wk">弱点 ${wk}</span> <span class="fl-hp">HP ${Math.max(0, tg0.hp)}/${tg0.maxhp}</span>`;
    foes.appendChild(line);
  }
  if (aliveList.length >= 2) {
    const chips = el("div", "foe-chips");
    b.enemies.forEach((e, i) => {
      if (!e.alive) return;
      const pct = Math.round(Math.max(0, e.hp) / e.maxhp * 100);
      const c = el("button", "foe-chip" + (b.target === i ? " on" : ""));
      c.innerHTML = `<span class="fc-ic">${e.ref.ic}</span><span class="fc-hp"><span style="width:${pct}%"></span></span>`;
      c.onclick = () => rpgSelectTarget(i);
      chips.appendChild(c);
    });
    foes.appendChild(chips);
  }
  panel.appendChild(foes);

  // 自分の状態＝コンパクト1行（HP管理が楽になったのでHPは“読める範囲で控えめ”に）
  const me = el("div", "rpg-me");
  me.innerHTML =
    `<span class="me-name">🧝 ミミ</span>` +
    ((b.combo || 0) >= 2 ? `<span class="rpg-combo lvl${Math.min(5, Math.floor(b.combo / 3) + 1)}">🔥×${b.combo}</span>` : "") +
    `<span class="me-stat hp${d.hp <= d.maxhp * 0.25 ? " low" : ""}"><i>HP</i><span class="me-bar"><span style="width:${Math.round(Math.max(0, d.hp) / d.maxhp * 100)}%"></span></span><b>${Math.max(0, d.hp)}/${d.maxhp}</b></span>` +
    `<span class="me-stat mp"><i>MP</i><span class="me-bar"><span style="width:${Math.round(d.mp / d.maxmp * 100)}%"></span></span><b>${d.mp}</b></span>` +
    `<span class="me-stat sp${(b.gauge || 0) >= 100 ? " full" : ""}"><i>SP</i><span class="me-bar"><span style="width:${Math.round(b.gauge || 0)}%"></span></span><b>${(b.gauge || 0) >= 100 ? "MAX" : Math.round(b.gauge || 0)}</b></span>`;
  panel.appendChild(me);
  const lg = el("div", "rpg-blog fixed1");
  if (b.log[0]) lg.appendChild(el("div", "rpg-logline " + b.log[0].cls + " fresh", b.log[0].t));
  panel.appendChild(lg);

  // 🤖 オートバトル切替（回数の多い雑魚はおまかせ＝ノーストレス）
  const autoBar = el("button", "rpg-autobtn" + (b.auto ? " on" : ""), b.auto ? "🤖 オートでたたかい中（タップで手動にもどる）" : "🤖 オートでたたかう");
  autoBar.onclick = () => rpgToggleBtlAuto();
  panel.appendChild(autoBar);

  // ── ワンタップ・アクションデッキ（多段メニュー廃止＝技も道具も1タップ）
  const cmd = el("div", "rpg-deck");
  if (b.phase !== "cmd") {
    cmd.appendChild(el("div", "rpg-wait", "…"));
  } else {
    if ((b.gauge || 0) >= 100) {
      const ult = el("button", "rpg-act ult full", `<span class="act-ic">✨</span><span class="act-n">スーパーぱほぱほ！</span><span class="act-sub">全体に大ダメージ・SP MAX</span>`);
      ult.onclick = () => rpgUltimate();
      cmd.appendChild(ult);
    }
    const tg = (b.enemies[b.target] && b.enemies[b.target].alive) ? b.enemies[b.target] : rpgAliveEnemies()[0];
    const known = tg && d.codex[tg.id] && d.codex[tg.id].weak ? d.codex[tg.id].weak : [];
    const skl = el("div", "rpg-deck-skills");
    d.skills.forEach(id => {
      const sk = RPG_SKILLS[id];
      const sealed = sk.mp > 0 && b.pstatus.seal > 0;
      const can = d.mp >= sk.mp && !sealed;
      const adv = sk.el !== "heal" && known.indexOf(sk.el) >= 0;
      const btn = el("button", "rpg-act el-" + sk.el + (can ? "" : " off") + (adv ? " adv" : ""));
      btn.innerHTML = (adv ? `<span class="act-weak">弱点!</span>` : "") +
        `<span class="act-ic">${RPG_ELEM_IC[sk.el]}</span><span class="act-n">${sk.n}</span>` +
        `<span class="act-sub">${sealed ? "🍙封じ" : (sk.el === "heal" ? "回復" : RPG_ELEM[sk.el])}${sk.mp ? " MP" + sk.mp : ""}</span>`;
      btn.disabled = !can; btn.onclick = () => rpgUseSkill(id);
      skl.appendChild(btn);
    });
    cmd.appendChild(skl);
    const sub = el("div", "rpg-deck-sub");
    [["potion", "🧪", "回復薬", d.items.potion || 0], ["ether", "🔵", "マナ水", d.items.ether || 0]].forEach(([k, ic, nm, q]) => {
      const btn = el("button", "rpg-act item" + (q > 0 ? "" : " off"));
      btn.innerHTML = `<span class="act-ic">${ic}</span><span class="act-n">${nm}</span><span class="act-sub">×${q}</span>`;
      btn.disabled = q <= 0; btn.onclick = () => rpgUseItem(k);
      sub.appendChild(btn);
    });
    const guard = el("button", "rpg-act guard", `<span class="act-ic">🛡️</span><span class="act-n">まもる</span><span class="act-sub">被ダメ半減</span>`); guard.onclick = () => rpgGuard();
    sub.appendChild(guard);
    const flee = el("button", "rpg-act flee" + (b.boss ? " off" : ""), `<span class="act-ic">🏃</span><span class="act-n">にげる</span><span class="act-sub">${b.boss ? "不可" : "離脱"}</span>`); flee.disabled = !!b.boss; flee.onclick = () => rpgFlee();
    sub.appendChild(flee);
    cmd.appendChild(sub);
  }
  panel.appendChild(cmd);
  scr.appendChild(panel);
  app.appendChild(scr);
  // オート進行ループ（cmd時に次の手を自動で。手動タップが割り込んでもOK）
  if (b.auto && b.phase === "cmd" && !RPG.busy) { clearTimeout(RPG._btlAutoT); RPG._btlAutoT = setTimeout(rpgAutoBattleTick, 430); }
}
function rpgBackBtn() { const b = el("button", "rpg-cmdbtn back", "<b>↩ もどる</b>"); b.onclick = () => rpgCmdBack(); return b; }

// ── 勝利（モダンなリザルト：カウントアップ＋演出）
function rpgRenderWon(app) {
  const f = RPG.flash || {};
  const wrap = el("div", "rpg-won-wrap");
  wrap.appendChild(el("h2", "rpg-won-h", f.boss ? "👑 ボス撃破！" : (f.combo >= 5 ? "🎉 PERFECT VICTORY" : "🎉 VICTORY")));
  const box = el("div", "rpg-resbox good");
  // 一つずつ理解できるよう、行を順番に出す（reveal遅延とカウントアップ開始を同期）
  let rows = `<div class="rpg-res-row rpg-rev" style="animation-delay:.25s"><span>獲得EXP</span><b class="rpg-cu" data-to="${f.exp || 0}" data-delay="250">0</b></div>` +
    `<div class="rpg-res-row rpg-rev" style="animation-delay:.95s"><span>獲得ゴールド</span><b class="rpg-cu" data-to="${f.gold || 0}" data-delay="950">0</b><span class="rpg-cu-suf">G</span></div>`;
  let d = 1.6;
  if ((f.combo || 0) >= 2) { rows += `<div class="rpg-res-row combo rpg-rev" style="animation-delay:${d}s"><span>🔥 最大コンボ</span><b>×${f.combo}（報酬+${Math.round(Math.min(f.combo, 25) * 6)}%）</b></div>`; d += 0.45; }
  box.innerHTML = rows;
  wrap.appendChild(box);
  if (f.ups && f.ups.length) {
    f.ups.forEach(u => { const e = el("div", "rpg-res-lv rpg-rev", `⬆️ LEVEL ${u.lv}！${u.learn && u.learn.length ? " 新スキル「" + u.learn.map(s => RPG_SKILLS[s].n).join("・") + "」習得！" : ""}`); e.style.animationDelay = d + "s"; e.setAttribute("data-sfx", "unlock"); e.setAttribute("data-delay", Math.round(d * 1000)); wrap.appendChild(e); d += 0.5; });
  }
  if (f.outfit) {
    const o = el("div", "rpg-res-outfit rpg-rev"); o.innerHTML = `👑 衣装「${f.outfit.name}」GET！ <small>モールで着られるよ</small>`; o.style.animationDelay = d + "s"; o.setAttribute("data-sfx", "win"); o.setAttribute("data-delay", Math.round(d * 1000)); wrap.appendChild(o); d += 0.5;
  }
  const cont = el("button", "rpg-start rpg-next", "▶ 次へ進む"); // アニメ非依存で常に押せる
  cont.onclick = () => rpgAfterWin();
  wrap.appendChild(cont);
  app.appendChild(wrap);
  // カウントアップ（各行の出現タイミングで開始＝順番に「効いてくる」）
  app.querySelectorAll(".rpg-cu").forEach(elm => {
    const to = parseInt(elm.getAttribute("data-to"), 10) || 0, dl = parseInt(elm.getAttribute("data-delay"), 10) || 0;
    setTimeout(() => {
      if (!(RPG && RPG.mode === "won")) return;
      if (to > 0) rpgSfx("coin");
      let cur = 0; const step = Math.max(1, Math.round(to / 20));
      const iv = setInterval(() => { if (!(RPG && RPG.mode === "won")) { clearInterval(iv); return; } cur += step; if (cur >= to) { cur = to; clearInterval(iv); } elm.textContent = cur; }, 26);
    }, dl);
  });
  // ボーナス行（レベルUP/衣装）が出る瞬間に効果音
  app.querySelectorAll("[data-sfx]").forEach(elm => {
    const dl = parseInt(elm.getAttribute("data-delay"), 10) || 0, s = elm.getAttribute("data-sfx");
    setTimeout(() => { if (RPG && RPG.mode === "won") rpgSfx(s); }, dl);
  });
}
// ── 敗北
function rpgRenderLost(app) {
  app.appendChild(el("h2", "rpg-won-h", "💫 気絶…"));
  const txt = RPG && RPG.tower ? `タワーの宝は手に入らなかった…（Lv・ゴールドは無事）` : `目が覚めたら迷宮の入口だった。<br>（持ち物・ゴールドは無事。HPは半分回復）`;
  const bx = el("div", "rpg-resbox bad", txt); app.appendChild(bx);
  const cont = el("button", "rpg-start rpg-next", "▶ 次へ進む"); // アニメ非依存で常に押せる
  cont.onclick = () => rpgAfterLose();
  app.appendChild(cont);
}
// ── 🌟 タワーの「さらに上 or 降りる」選択（プレスユアラック）
function rpgRenderAscend(app) {
  app.appendChild(el("h2", "rpg-won-h", "🌟 エンドレスタワー"));
  const stars = "⭐".repeat(Math.min(5, 1 + Math.floor(RPG.towerLuck * 4)));
  const pulls = Math.min(5, 1 + Math.floor(RPG.depth / 2));
  const box = el("div", "rpg-resbox good");
  box.innerHTML =
    `<div class="rpg-res-row"><span>現在の高さ</span><b>${RPG.depth}層</b></div>` +
    `<div class="rpg-res-row"><span>いま降りると</span><b>${pulls}回ガチャ</b></div>` +
    `<div class="rpg-res-row combo"><span>ごほうびレア度</span><b>${stars}</b></div>`;
  app.appendChild(box);
  app.appendChild(el("div", "as-hint2", "さらに上はレア度UP・敵も強化。<b>倒れるとタワーの宝は無し</b>（ここまでのLv/ゴールドは残ります）"));
  const up = el("button", "rpg-start", "🔼 さらに上へ（リスク覚悟）");
  up.onclick = () => rpgTowerAscend();
  app.appendChild(up);
  const row = el("div", "rpg-hubrow");
  const down = el("button", "rpg-hubbtn", "🏁 ここで降りて宝を開ける");
  down.onclick = () => rpgTowerDescend();
  row.appendChild(down);
  app.appendChild(row);
}
// ── 出口
function rpgRenderResult(app) {
  app.appendChild(el("h2", null, "🚪 迷宮をあとにした"));
  app.appendChild(el("div", "rpg-resbox good", "またいつでももぐれる。お疲れさま！"));
  const cont = el("button", "rpg-start", "← 入口へ");
  cont.onclick = () => { RPG = null; renderMallRpg(); };
  app.appendChild(cont);
}
// ── 📦 今回の冒険（ランサマリー台帳：退場／気絶／制覇クリア共通・憲法§3）
function rpgRenderSummary(app) {
  const sm = RPG.summary || { rows: [], next: "" };
  const lost = sm.reason === "lost";
  const conquered = sm.reason === "exit" && sm.cleared;
  app.appendChild(el("h2", "rpg-won-h", conquered ? "🏆 モール制覇！" : (lost ? "💫 冒険おわり" : "🏁 冒険おわり")));
  app.appendChild(el("div", "rpg-sum-sub", lost ? "倒れちゃったけど、ちゃんと持ち帰ったよ！" : "おつかれさま！ 今回の成果はこちら"));
  const box = el("div", "rpg-resbox good rpg-ledger");
  box.innerHTML = `<div class="rpg-ledger-t">📦 今回の冒険</div>` +
    (sm.rows || []).map((r, i) => `<div class="rpg-led-row rpg-rev ${r.cls || ""}" style="animation-delay:${(0.15 + i * 0.1).toFixed(2)}s"><span>${r.ic} ${r.label}</span><b>${r.val}</b></div>`).join("");
  app.appendChild(box);
  app.appendChild(el("div", "rpg-sum-next", sm.next || ""));
  const cont = el("button", "rpg-start rpg-next", "← 入口へ");
  cont.onclick = () => { RPG = null; renderMallRpg(); };
  app.appendChild(cont);
}

// =========================================================================
// 🎰 射幸性レイヤー：レアリティ / ガチャ / ルート演出 / ダブルアップ / デイリー
//   ※すべてダンジョン内の独立通貨（ゴールド/チケット）とコスメ(outfitsWon)で完結。
//     プレイヤーのコイン・総資産・レース数式には一切触れない（[[race-math-immutable]]）。
// =========================================================================
const RPG_RARITY = [
  { id: "c",   n: "ふつう",       w: 60,  col: "#b8b2c4" },
  { id: "r",   n: "レア",         w: 27,  col: "#5ec8ff" },
  { id: "sr",  n: "スーパーレア", w: 9.5, col: "#c08bff" },
  { id: "ssr", n: "激レア",       w: 2.8, col: "#ffd24a" },
  { id: "ur",  n: "伝説",         w: 0.7, col: "#ff7ad0", rainbow: true },
];
const RPG_RIDX = { c: 0, r: 1, sr: 2, ssr: 3, ur: 4 };
function rpgRollRarity(luck) {
  luck = (luck || 0) + rpgUpLv("luck") * 0.12;   // 📦宝の目利き（恒久強化）＝全ロールのレア度UP
  const ws = RPG_RARITY.map((R, i) => R.w * (i >= 2 ? (1 + luck * 0.6) : 1));
  let t = ws.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < RPG_RARITY.length; i++) { t -= ws[i]; if (t <= 0) return RPG_RARITY[i]; }
  return RPG_RARITY[0];
}

// レア度→具体ごほうび（即時付与し、演出用データを返す）
function rpgGrantReward(R) {
  const d = rpgData(), ri = RPG_RIDX[R.id];
  // 高レアは衣装（あれば）
  if (ri >= 2) {
    const band = ri >= 3 ? "l" : "r";
    const o = rpgGrantOutfit(band) || rpgGrantOutfit("r") || rpgGrantOutfit("c");
    if (o) return { rarity: R, icon: "👗", label: "衣装「" + o.name + "」", big: true };
  }
  if (R.id === "r" && Math.random() < 0.4) { d.items.ether = (d.items.ether || 0) + 1; return { rarity: R, icon: "🔵", label: "マナ水 ×1" }; }
  if (R.id === "c" && Math.random() < 0.5) { d.items.potion = (d.items.potion || 0) + 1; return { rarity: R, icon: "🧪", label: "回復薬 ×1" }; }
  if (ri >= 2 && Math.random() < 0.3) { d.tickets = (d.tickets || 0) + 1; return { rarity: R, icon: "🎟️", label: "ガチャチケット ×1" }; }
  const base = { c: 25, r: 70, sr: 180, ssr: 600, ur: 2500 }[R.id];
  const g = Math.round(base * (0.8 + Math.random() * 0.6));
  d.gold += g;
  return { rarity: R, icon: "🪙", label: g + " ゴールド", gold: g };
}

// ── 演出（スピン→開封→レア度で光・パーティクル・JACKPOT、必要ならダブルアップ）
let RPG_REVEAL = null;
function rpgReveal(items, opts) {
  RPG_REVEAL = { items, phase: "spin", opts: opts || {}, revealed: 0, _anim: false };
  rpgSfx("streak");
  renderMallRpg();   // シェルを描いて rpgSlotAnim がリールを回す
}
function rpgRevealClose() {
  const done = RPG_REVEAL && RPG_REVEAL.opts.onDone;
  if (RPG_REVEAL && RPG_REVEAL._iv) clearInterval(RPG_REVEAL._iv);
  RPG_REVEAL = null;
  if (done) done(); else renderMallRpg();
}
// ダブルアップ（50%で倍・失敗で没収、最大3段）
function rpgDoubleUp() {
  const rv = RPG_REVEAL; if (!rv || rv.phase !== "done") return;
  const it = rv.items[0]; if (!it || !it.gold) return;
  const d = rpgData();
  rv.stage = (rv.stage || 1);
  if (Math.random() < 0.5) {
    d.gold += it.gold;
    it.gold *= 2; it.label = it.gold + " ゴールド";
    rv.stage++; rpgSfx("win"); rpgFx.banner("WIN! ×2", "more");
    if (rv.stage > 3) { rv.maxed = true; }
  } else {
    d.gold -= it.gold; it.gold = 0; it.label = "0 ゴールド…"; it.busted = true;
    rpgSfx("alert"); rpgFx.banner("BUST…", "down");
  }
  rpgSave(); renderMallRpg();
}
function rpgCardFace(it) {
  return `<div class="rpg-card-ic">${it.icon}</div><div class="rpg-card-rar">${it.rarity.n}</div><div class="rpg-card-lb">${it.label}</div>` + (RPG_RIDX[it.rarity.id] >= 3 ? `<div class="rpg-card-rays"></div>` : "");
}
function rpgRenderReveal(app) {
  const rv = RPG_REVEAL;
  app.appendChild(el("h2", "rpg-reveal-h", rv.opts.title || "🎁 おたから！"));
  const grid = el("div", "rpg-reveal-grid" + (rv.items.length > 4 ? " many" : ""));
  rv._cards = [];
  rv.items.forEach((it, i) => {
    const settled = rv.phase === "done" || i < rv.revealed;
    const card = el("div", "rpg-card " + (settled ? "r-" + it.rarity.id + (it.rarity.rainbow ? " rainbow" : "") + " done" + (it.busted ? " busted" : "") : "spin"));
    card.style.setProperty("--rc", settled ? it.rarity.col : "#9aa6b8");
    card.innerHTML = settled ? rpgCardFace(it) : `<div class="rpg-card-ic reel">🎰</div>`;
    grid.appendChild(card); rv._cards.push(card);
  });
  if (rv.phase !== "done") grid.onclick = () => rpgRevealSkip();
  app.appendChild(grid);
  if (rv.phase === "done") {
    const acts = el("div", "rpg-reveal-acts");
    const single = rv.items.length === 1 ? rv.items[0] : null;
    if (single && single.gold && !single.busted && !rv.maxed && (rv.stage || 1) <= 3) {
      const du = el("button", "rpg-cmdbtn main", `<b>🎲 ダブルアップ</b><small>50%で2倍 / 失敗で没収（現在 ${single.gold}G）</small>`);
      du.onclick = () => rpgDoubleUp(); acts.appendChild(du);
    }
    const ok = el("button", "rpg-start", single && single.busted ? "とほほ…受け取る ▶" : "受け取る ▶");
    ok.onclick = () => rpgRevealClose(); acts.appendChild(ok);
    app.appendChild(acts);
  } else {
    app.appendChild(el("div", "rpg-reveal-hint", "✨ 開封中…（タップで早送り）"));
    rpgSlotAnim();
  }
}
// 本物のリール：アイコン/色を高速で切り替え→1枚ずつ着地
function rpgSlotAnim() {
  const rv = RPG_REVEAL; if (!rv || rv._anim) return; rv._anim = true;
  const pool = ["🎁", "🪙", "🧪", "🔵", "🎟️", "👗", "💎", "⭐", "🌟", "🍹", "🏝️", "🐚"];
  const cols = RPG_RARITY.map(r => r.col);
  let tick = 0;
  rv._iv = setInterval(() => {
    if (!RPG_REVEAL || RPG_REVEAL !== rv) { clearInterval(rv._iv); return; }
    tick++;
    rv._cards.forEach((card, i) => {
      if (i < rv.revealed) return;
      const ic = card.querySelector(".rpg-card-ic");
      if (ic) ic.textContent = pool[(Math.random() * pool.length) | 0];
      card.style.setProperty("--rc", cols[(Math.random() * cols.length) | 0]);
    });
    if (tick % 2 === 0) rpgSfx("tick");
    if (tick > 7 && tick % 3 === 0 && rv.revealed < rv.items.length) rpgRevealOne();
    if (rv.revealed >= rv.items.length) { clearInterval(rv._iv); rv._iv = null; rv._anim = false; rv.phase = "done"; renderMallRpg(); }
  }, 85);
}
function rpgRevealOne() {
  const rv = RPG_REVEAL; const i = rv.revealed, it = rv.items[i], card = rv._cards[i]; if (!card) { rv.revealed++; return; }
  card.className = "rpg-card r-" + it.rarity.id + (it.rarity.rainbow ? " rainbow" : "") + " done" + (it.busted ? " busted" : "");
  card.style.setProperty("--rc", it.rarity.col);
  card.innerHTML = rpgCardFace(it);
  rpgSfx(RPG_RIDX[it.rarity.id] >= 2 ? "win" : "unlock");
  if (RPG_RIDX[it.rarity.id] >= 3) rpgFx.banner("✨ JACKPOT ✨", "victory");
  rv.revealed++;
}
function rpgRevealSkip() {
  const rv = RPG_REVEAL; if (!rv || rv.phase === "done") return;
  if (rv._iv) { clearInterval(rv._iv); rv._iv = null; }
  while (rv.revealed < rv.items.length) rpgRevealOne();
  rv._anim = false; rv.phase = "done"; renderMallRpg();
}

// ── 宝箱＝毎回ガチャ（レア度ロール＋ダブルアップ）
function rpgChestPull(x, y, luck) {
  const R = rpgRollRarity(luck || 0);
  const it = rpgGrantReward(R);
  rpgSave();
  rpgReveal([it], { title: "📦 宝箱を開けた！", onDone: () => { RPG.mode = "explore"; renderMallRpg(); } });
}

// ── ハブのガチャ
function rpgGachaPull(n) {
  const d = rpgData();
  if (n === 1) { if ((d.tickets || 0) < 1) return; d.tickets -= 1; }
  else { const cost = 280; if ((d.gold || 0) < cost) return; d.gold -= cost; }
  d.records.pulls = (d.records.pulls || 0) + n;
  const luck = n >= 10 ? 0.6 : 0;          // 10連は気持ち高レア寄り
  const items = [];
  let guaranteed = n >= 10;                 // 10連はSR以上1枚確定
  for (let i = 0; i < n; i++) {
    let R = rpgRollRarity(luck);
    if (guaranteed && i === n - 1 && RPG_RIDX[R.id] < 2) R = RPG_RARITY[2];
    if (RPG_RIDX[R.id] >= 2) guaranteed = false;
    items.push(rpgGrantReward(R));
  }
  rpgSave();
  rpgReveal(items, { title: n >= 10 ? "🎟️ 10連ガチャ！" : "🎟️ ガチャ！", onDone: () => renderMallRpg() });
}

// ── デイリー・ログインボーナス
function rpgClaimDaily() {
  const d = rpgData();
  if (d.daily === rpgToday()) return;
  d.daily = rpgToday();
  d.tickets = (d.tickets || 0) + 1;
  const R = rpgRollRarity(0.3);
  const it = rpgGrantReward(R);
  rpgSave();
  rpgReveal([{ rarity: RPG_RARITY[1], icon: "🎟️", label: "ログボ：チケット ×1" }, it], { title: "📅 ログインボーナス！", onDone: () => renderMallRpg() });
}

// ── スコア記録の更新（中毒性＝自己ベスト）
function rpgBumpRecords() {
  const d = rpgData(), r = d.records;
  if (d.lv > r.lv) r.lv = d.lv;
  if ((d.best.floor || 0) > (r.floor || 0)) r.floor = d.best.floor || 0;
  const score = (d.lv * 120) + ((d.best.floor || 0) * 300) + (r.combo || 0) * 40 + Math.floor((d.gold || 0) / 10);
  if (score > (r.score || 0)) r.score = score;
  rpgSave();
}
