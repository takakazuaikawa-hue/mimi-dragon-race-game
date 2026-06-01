/**
 * data_assets.js — total-asset & lifestyle progression DATA (spec #30).
 *
 * Pure lookup tables + tiny pure helpers. No state mutation, no DOM.
 * The engine (assets_engine.js) reads these to compute 総資産, unlock lifestyle
 * assets, gate story chapters, and size the bankruptcy rescue.
 *
 * Design rules from spec #30:
 *   - 手持ちコイン (betting) is SEPARATE from 総資産 (progression). (§2.1)
 *   - 総資産 uses maxCoinsReached, never current coins, so a losing bet never
 *     rolls back the story. (§3.1, §16)
 *   - Lifestyle assets must NOT affect race results — only 総資産 + rescue. (§5.5)
 *   - 《ぱほぱほ》 must NOT affect money/rescue/results. (§12) — nothing here ties
 *     to it; it stays purely cosmetic flavor elsewhere.
 *
 * EXTENSION POINT: new story chapter → add to STORY_CHAPTERS; new lifestyle
 * stage tier → add to LIFE_STAGES; new life asset → add to LIFE_ASSETS; rebalance
 * thresholds → edit ASSET_LEVELS (values are explicitly tunable, §7.1).
 */

// §30 §7.1 — inflation-style asset-level thresholds (tunable).
// assetLevelOf(total) → 0..5. Level N unlocks 第(N+1)話; level 5 unlocks ED.
const ASSET_LEVELS = [
  { level: 1, threshold: 10000 },
  { level: 2, threshold: 100000 },
  { level: 3, threshold: 10000000 },
  { level: 4, threshold: 1000000000 },
  { level: 5, threshold: 1000000000000 }
];

function assetLevelOf(total) {
  let lv = 0;
  for (const t of ASSET_LEVELS) { if (total >= t.threshold) lv = t.level; }
  return lv;
}

// The next threshold the player is climbing toward (null when maxed out).
function nextAssetThreshold(total) {
  for (const t of ASSET_LEVELS) { if (total < t.threshold) return t.threshold; }
  return null;
}

// §30 §7 — story is gated by asset level, not by complex flags. 5 話 + ED.
// `level` is the asset level required to unlock the chapter.
const STORY_CHAPTERS = [
  { id: "1",  level: 0, title: "第1話　借金まみれのバニー",
    body: "転生先はまさかのバニーガール。気づけば借金まみれで、レース場の片隅に放り出されていた。汎用スキル《ぱほぱほ》だけを頼りに、ミミの再起がはじまる。" },
  { id: "2",  level: 1, title: "第2話　泣き虫竜との出会い",
    body: "わずかに暮らしを立て直したミミは、泣き虫の竜と出会う。村の食堂が手を差し伸べ、固いパンと水の日々に、温かいスープが戻ってきた。" },
  { id: "3",  level: 2, title: "第3話　予想屋として認められて",
    body: "市場のオッズと真の実力のズレを読む目が、少しずつ評価されはじめる。常連客がミミの名前を覚え、実況予想屋としての居場所ができてきた。" },
  { id: "4",  level: 3, title: "第4話　人気実況予想屋へ",
    body: "ミミの実況に人が集まる。スポンサーや支援者がつき、ドラゴン村に自分の家を持つまでになった。借金まみれの過去が、遠くなっていく。" },
  { id: "5",  level: 4, title: "第5話　聖龍レースへ",
    body: "実況の舞台はついに聖龍レースへ。聖龍門を望む大舞台で、ミミは大実況者として注目を集める。再起はもう、夢物語ではない。" },
  { id: "ED", level: 5, title: "エンディング　次の冒険へ",
    body: "大量の資金と聖龍の加護を手にしたミミは、借金まみれの底から、ついに抜け出した。バニー衣装に旅装を重ね、次の冒険へと再起していく。" }
];

// §30 §6 — lifestyle stages by asset level (index 0..5). Drives the
// "ミミの生活" panel. Cosmetic/flavor only; never touches race math.
const LIFE_STAGES = [
  { // §6.1 初期
    housing: "仮眠小屋・簡素な寝床", food: "固いパンと水", outfit: "くたびれたバニー衣装",
    decor: "むき出しの床", tool: "使い古しのメガホン", supporter: "支援者はいない",
    fame: "名声はほぼない", village: "さびれた村のはずれ",
    summary: "借金まみれ。どん底からの再起がはじまる。" },
  { // §6.2 序盤成長
    housing: "小さな実況者の部屋", food: "温かいスープ", outfit: "新人実況バニー衣装",
    decor: "小さな丸テーブル", tool: "新しいメガホン", supporter: "村の食堂が気にかけてくれる",
    fame: "新人実況予想屋", village: "活気の戻りはじめた村",
    summary: "少し立て直し、温かい食事にありつけるようになった。" },
  { // §6.3 中盤成長
    housing: "村の一室", food: "焼き菓子と紅茶", outfit: "レース実況衣装",
    decor: "予想ボードと本棚", tool: "予想新聞付きの実況席", supporter: "常連客がつきはじめる",
    fame: "常連に名前を覚えられる", village: "にぎわう竜の村",
    summary: "予想屋として認められ、暮らしが整ってきた。" },
  { // §6.4 後半成長
    housing: "ドラゴン村の家", food: "祝祭料理", outfit: "華やかな実況ドレス",
    decor: "受賞プレートの並ぶ棚", tool: "中継用の実況ブース", supporter: "スポンサー・支援者がつく",
    fame: "人気実況予想屋", village: "祝祭でにぎわう村",
    summary: "人気実況予想屋として、支援者に囲まれるようになった。" },
  { // §6.5 終盤
    housing: "立派な屋敷", food: "ラパン祝祭フルコース", outfit: "聖龍実況ドレス",
    decor: "聖龍をかたどった装飾", tool: "聖龍レース公式実況席", supporter: "聖龍レース関係者",
    fame: "聖龍レース関係者から注目される", village: "聖龍門を望む大きな村",
    summary: "聖龍レースへ。注目を集める大実況者になった。" },
  { // §6.6 エンディング
    housing: "再出発の支度部屋", food: "旅立ちのごちそう", outfit: "再出発の冒険バニー衣装",
    decor: "旅装の整った部屋", tool: "旅の相棒メガホン", supporter: "聖龍と仲間たち",
    fame: "聖龍の加護を受けた語り部", village: "見送る竜たちの村",
    summary: "大量の資金と聖龍の加護を得て、次の冒険へ再起する。" }
];

function lifeStageFor(level) {
  return LIFE_STAGES[Math.max(0, Math.min(level, LIFE_STAGES.length - 1))];
}

// §30 §5 / §13.2 — life assets. Most auto-unlock by asset level; a few are
// purchasable cosmetics. `value` feeds 生活資産 (→ 総資産 + 救済); `rescueBonus`
// is a small flat add to the bankruptcy rescue. Values are kept tiny relative
// to the ASSET_LEVELS thresholds so the living→total→level loop converges fast.
const LIFE_CATEGORY_LABEL = {
  housing: "住居", outfit: "衣装", food: "食事", decor: "部屋飾り",
  tool: "実況道具", supporter: "支援者・名声", village: "村施設"
};

const LIFE_ASSETS = [
  // ---- auto-unlock (progression spine) ----
  // level 1
  { id: "small_room",   category: "housing", name: "小さな実況者の部屋", value: 800,  unlockType: "auto", unlockAssetLevel: 1, rescueBonus: 30,
    description: "雨風をしのげる、小さな自分の部屋。" },
  { id: "warm_soup",    category: "food",    name: "温かいスープ",       value: 500,  unlockType: "auto", unlockAssetLevel: 1, rescueBonus: 50,
    description: "借金まみれのミミが、久しぶりに温かいものを食べられるようになった。" },
  { id: "rookie_outfit",category: "outfit",  name: "新人実況バニー衣装", value: 600,  unlockType: "auto", unlockAssetLevel: 1, rescueBonus: 20,
    description: "くたびれた衣装から、洗いたての新人衣装へ。" },
  { id: "new_megaphone",category: "tool",    name: "新しいメガホン",     value: 400,  unlockType: "auto", unlockAssetLevel: 1, rescueBonus: 10,
    description: "声がよく通る、新しい実況メガホン。" },
  // level 2
  { id: "village_room", category: "housing", name: "村の一室",           value: 3000, unlockType: "auto", unlockAssetLevel: 2, rescueBonus: 60,
    description: "村の中に、落ち着いて暮らせる一室を借りられた。" },
  { id: "tea_sweets",   category: "food",    name: "焼き菓子と紅茶",     value: 2000, unlockType: "auto", unlockAssetLevel: 2, rescueBonus: 80,
    description: "仕事の合間に、焼き菓子と紅茶でひと息つける。" },
  { id: "race_outfit",  category: "outfit",  name: "レース実況衣装",     value: 2500, unlockType: "auto", unlockAssetLevel: 2, rescueBonus: 40,
    description: "実況の場にふさわしい、きちんとした衣装。" },
  { id: "pred_board",   category: "decor",   name: "予想ボードと本棚",   value: 1500, unlockType: "auto", unlockAssetLevel: 2, rescueBonus: 20,
    description: "予想を書き込むボードと、資料の並ぶ本棚。" },
  // level 3
  { id: "village_house",category: "housing", name: "ドラゴン村の家",     value: 20000,  unlockType: "auto", unlockAssetLevel: 3, rescueBonus: 150,
    description: "ドラゴン村に、自分の家を構えられるようになった。" },
  { id: "feast",        category: "food",    name: "祝祭料理",           value: 12000,  unlockType: "auto", unlockAssetLevel: 3, rescueBonus: 200,
    description: "祝祭の日には、ごちそうを囲めるようになった。" },
  { id: "gorgeous_dress",category:"outfit",  name: "華やかな実況ドレス", value: 15000,  unlockType: "auto", unlockAssetLevel: 3, rescueBonus: 120,
    description: "人気実況予想屋にふさわしい、華やかなドレス。" },
  { id: "broadcast_booth",category:"tool",   name: "中継用の実況ブース", value: 10000,  unlockType: "auto", unlockAssetLevel: 3, rescueBonus: 60,
    description: "村の外まで声を届ける、中継用の実況ブース。" },
  // level 4
  { id: "mansion",      category: "housing", name: "立派な屋敷",         value: 200000, unlockType: "auto", unlockAssetLevel: 4, rescueBonus: 400,
    description: "村を見渡す、立派な屋敷を持つまでになった。" },
  { id: "full_course",  category: "food",    name: "ラパン祝祭フルコース", value: 120000, unlockType: "auto", unlockAssetLevel: 4, rescueBonus: 500,
    description: "ラパンの祝祭フルコースを味わえる暮らし。" },
  { id: "holy_dress",   category: "outfit",  name: "聖龍実況ドレス",     value: 150000, unlockType: "auto", unlockAssetLevel: 4, rescueBonus: 300,
    description: "聖龍レースの舞台に立つための、特別なドレス。" },
  // level 5 (ED)
  { id: "adventure_outfit", category: "outfit", name: "再出発の冒険バニー衣装", value: 1000000, unlockType: "auto", unlockAssetLevel: 5, rescueBonus: 800,
    description: "バニー衣装に旅装を重ねた、再出発の装い。" },
  { id: "holy_blessing",    category: "supporter", name: "聖龍の加護",        value: 2000000, unlockType: "auto", unlockAssetLevel: 5, rescueBonus: 1000,
    description: "聖龍の加護。次の冒険を、静かに後押ししてくれる。" },

  // ---- purchasable cosmetics (§5.4 collection/差分; never affects races) ----
  { id: "buy_lantern",  category: "decor", name: "ドラゴン提灯",   value: 300, unlockType: "buy", price: 2000,  rescueBonus: 10,
    description: "部屋を温かく照らす、竜をかたどった提灯。" },
  { id: "buy_mic_gold", category: "tool",  name: "金のマイク飾り", value: 500, unlockType: "buy", price: 8000,  rescueBonus: 0,
    description: "実況マイクの見た目だけが、ちょっと豪華になる。" },
  { id: "buy_title_plate", category: "decor", name: "称号プレート", value: 400, unlockType: "buy", price: 5000, rescueBonus: 20,
    description: "これまでの実況をたたえる、飾りの称号プレート。" }
];
