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
// Texts are the canonical 一文「件。」 style from the story-event spec; each
// chapter introduces one advisor (STORY_CAST) and carries a 一枚絵 scene caption.
// `level` is the asset level required to unlock the chapter.
const STORY_CHAPTERS = [
  { id: "1",  level: 0, cast: "sake",     title: "第1話　竜王女サケに拾われる",
    scene: "聖龍レース場の入口で、倒れかけたミミをサケ・ウダダが拾う",
    body: "第1話：借金と空腹と請求書だけを抱え、財布は軽いのに人生だけはやたら重いバニーの私が、何千年も火山と霧に閉ざされ独自進化したドラゴンたちが群れを成す聖域みたいな島へ流れ着き、まだ村おこしの熱と手作り感が残る聖龍レース場の入口で、このままでは観光名所より先に行き倒れ名所として登録されてしまうと白目をむいていたところを、面倒見がよすぎるくせに命と現場の判断だけは妙に厳しい竜王女サケ・ウダダに拾われ、この人もしかして女神ではと思った次の瞬間、まず食え、泣くな、借金は泣いても減らんが勝つ竜を当てれば明日の飯くらいは増えるかもしれん、と温かい食事と容赦ない現実を同時に押しつけられ、助けられたはずなのになぜかそのままレース場の席へ連行され、まずは一着になる竜を選ぶ単竜からだと、人生最初の聖龍レースへ放り込まれる件。" },
  { id: "2",  level: 1, cast: "mizu",     title: "第2話　ミズの分析予想",
    scene: "ミミとミズが同じ竜を見ているが、見ているものが違う",
    body: "第2話：サケさんに教わった私は、まずは勝つ竜を当てればいいんだよねと単竜だけは元気よく理解したものの、ラッキーそうな番号に明日のご飯代を雑に捧げ続けた結果、当たった気がしたレースほどきれいに外して財布と自信とバニー耳の角度をまとめてへし折られ、そこへ名刺だけやたら強そうなのに本人は少し頼りなさそうなミズ・アオラが現れ、オッズ表を見た瞬間だけ急に据わった目になり、その理論で勝てるなら投資商会は神社に吸収合併されているのであるわ、あはん、と頼んでいないのに私の数字信仰を資本主義ごと粉砕し、数字お祈り単竜予想を分析型予想へ強制アップデートしてくる件。" },
  { id: "3",  level: 2, cast: "sumika",   title: "第3話　スミカと総資産",
    scene: "村の行政窓口で、スミカが住居・食事・竜舎・施設の選択肢を案内する",
    body: "第3話：たまに単竜が当たるようになり、昨日より財布が少し重いだけで人生まで軽くなった気がしてきた私は、これはもう借金完済、床ではなく布団、スープには具、財布には中身、バニーには未来、みたいな勝利の生活再建コースへ入ったのでは、と勝ったコインを次のレースへ気持ちよく吸い込ませかけたところを、村の住居も食事も竜舎も会計も再起支援も一手に握る敏腕行政秘書スミカ・ラグナに捕まり、最初は優しい窓口の人だと思ったのに、ミミ様、現在の生活状態は貧困ではなく遭難です、勝負の前にまず帰る部屋と食事と竜舎と村施設と再起支援を整えてください、と丁寧語と帳簿で現実を殴られ、手持ちコインを増やすだけではなく住居・食事・施設価値・名声・生活資産まで含めた総資産を育てることこそ、この島で負けても終わらないための本当の準備だと理解させられる件。" },
  { id: "4",  level: 3, cast: "makura",   title: "第4話　マクラと推し竜文化",
    scene: "マクラが配信しながら、人気竜・地方・コースの魅力を見せつける",
    body: "第4話：昨日まで手作り感でなんとか押し切っていた聖龍レース場が、屋台と観光客とピカピカの魔導掲示板で急に「うちはリゾートですけど？」みたいな顔をし始めたのを見た私は、これはもしや村長選に出るか政党でも立ち上げる未来もあるのではと欲深げに妄想を肥大化させて団子を噛みしめていたところ、賭けてる？ 生きてる？ クラウン劇場、緊急で動画回してます！……ミミちゃん、つまんない勝ち方してんね。とマクラ・クラウン・バズーカーが乱入し、魔導カメラに横顔を抜かれ、湧き出したコメント欄ごと配信の渦へ巻き込まれ、当てるだけなら予想、叫ばせたらショー、名前を覚えさせたら物語だぜ？ と浴びせられた勢いで出走表を開き直してみれば、さっきまで配当の数字にしか見えなかった竜もコースも妙に語り出した気がして、気づけば夜を明かしてドラゴン図鑑とコース伝承を読み漁り、朝焼けの中でこの子の走りちょっと見たいかもとか言い出していて、ただの金額表だったはずの出走表が冠名つきドラゴン図鑑とコース伝承と推し竜文化の沼へずぶずぶ沈み始める件。" },
  { id: "5",  level: 4, cast: "celestia", title: "第5話　セレスティアの神眼",
    scene: "星空ドレスのセレスティアが、観光客のようにレース場へふらっと現れる",
    body: "第5話：聖龍レースももはや、熱狂の隆盛を極め始め、島の看板リゾートみたいな顔で勝手に背筋を伸ばし始める中、明日のご飯代だけを追っていたはずの私まで、いつの間にかレース場の灯りが消えないことを願う面倒なバニーになっていた頃、親切で気さくな旅人がふらりと現れ、屋台の場所を聞くみたいな軽さで相談に乗ってくれそうに笑うものだから、最初は普通に心強い味方が増えたと思って安心しかけたのに、よく見るとこの人だけ賭け場に来たのではなく賭け場を見物しに来た天災みたいな顔をしていて、実は世界の天井の一人にして最強のレースギャンブラー、生命淘汰の神眼で竜たちの「生き残る順番」が見えてしまう絶滅のブラックメテオ、セレスティア・ブラックメテオで、世間話みたいな軽さで勝つ竜の名を告げた瞬間、観客も予想屋も同じ竜へ賭け札を重ね、誰の手にもあったはずの「応え」がたった一頭の正解へ淘汰され、この賭場は、壊れないといいな、と呟くセレスティアにド級の隕石を落とされる件。" },
  { id: "ED", level: 5, cast: "celestia", title: "エンディング　次の物語へ",
    scene: "発展した島とレース場を背景に、ミミが大量の資産と聖龍の加護を得て再出発する",
    body: "エンディング：ド級の隕石を落とされた夜、私は勝つ竜の名を知っただけで勝った気になっていた自分を団子ごと飲み込み、単竜では薄くなりすぎた正解のまわりに、複竜で残る席を探し、ワイド竜でまだ沈んでいない組み合わせを拾い、オッズの端に残った小さな歪みまでかき集めて、これが私の全部ですと震える手で最後の賭け札を切り直し、夜明け前の聖龍レース場にもう一度だけ歓声を爆発させたことで、絶滅のブラックメテオに、この賭場、壊れなかったね、と少しだけ嬉しそうに去られ、霧と火山の島は朝まで灯りの消えない聖龍レースリゾートへ育ち、最後のレースを走り切った竜たちがなぜか全員こっちを見て鳴いたので、え、これもしかして祝福ですか、請求書じゃなくて？ と震えていたら本当に聖龍の加護が降り、屋台も宿も竜舎も観覧席もまとめて総資産に化けていく中、これもう借金返済どころか島ごと決算書に載ってない？ という怖すぎる現実と一京規模の資産を抱え、あの日レース場の入口で拾われた私は、今度は自分で島の出口を選び、朝の桟橋から霧の向こうの次の物語へ再出発する件。" }
];

// Character cast (spec 31). Each advisor unlocks with their chapter and gives
// Mimi a new "perspective". Display/flavor only — never touches race math.
// `level` = asset level at which the advisor becomes available (= chapter level).
const STORY_CAST = {
  sake:     { key: "sake",     name: "サケ・ウダダ",                 tag: "竜王女",       level: 0, gives: "竜を見る目",       focus: "現場・竜・気配",        color: "#e0584a", symbol: "🐲",
              consult: "うぐぐ……まず食え、泣くな。息を見ろ、竜は脚より先に息で崩れる。人気じゃなく、現場の気配で選べ。" },
  mizu:     { key: "mizu",     name: "ミズ・アオラ",                 tag: "エコノミスト", level: 1, gives: "市場を見る目",     focus: "市場・オッズ・期待値",  color: "#3f7fd0", symbol: "📊",
              consult: "このオッズは勝率ではない。観客の願望が価格に混入した市場反応であるわ、あはん。人気と価値を混同した時点で、賭けは投資ではなく祈りになる。" },
  sumika:   { key: "sumika",   name: "スミカ・ラグナ",               tag: "行政秘書",     level: 2, gives: "生活を立て直す土台", focus: "生活・住居・総資産",    color: "#6ac06a", symbol: "🏠",
              consult: "ミミ様、現在の生活状態は貧困ではなく遭難です。手持ちだけでなく、住居・食事・施設・名声まで含めた総資産を育ててください。" },
  makura:   { key: "makura",   name: "マクラ・クラウン・バズーカー", tag: "配信者",       level: 3, gives: "声を届ける力",     focus: "観客・実況・熱狂",      color: "#caa44a", symbol: "🎤",
              consult: "賭けてる？ 生きてる？ 当てるだけなら予想、叫ばせたらショー、名前を覚えさせたら物語だぜ？ その人気、実力か物語か、見極めな。" },
  celestia: { key: "celestia", name: "セレスティア・ブラックメテオ", tag: "世界の天井",   level: 4, gives: "世界の大きさ",     focus: "神眼・淘汰・市場の歪み", color: "#9a6ad0", symbol: "☄️",
              consult: "勝つ竜の名なら、教えてあげる。……でもね、その答えが配当を消すの。1着を知ることと、価値を残すことは違うわ。" }
};

// spec 32 §9 — story chapters unlock by 総資産 (DECOUPLED from the lifestyle
// ASSET_LEVELS, so story pacing follows the spec without touching the
// economy / lifestyle / rescue thresholds). chapter id → 総資産 needed.
const STORY_UNLOCK_AT = { "1": 0, "2": 3000, "3": 30000, "4": 1000000, "5": 100000000, "ED": 10000000000000000 };
function storyUnlockAt(chapterId) { const v = STORY_UNLOCK_AT[chapterId]; return v == null ? 0 : v; }
// 総資産 needed for an advisor (= their introducing chapter's threshold).
function castUnlockAt(castKey) { const ch = STORY_CHAPTERS.find(c => c.cast === castKey); return ch ? storyUnlockAt(ch.id) : 0; }

// (b) contextual one-liners — shown as an "advisor voice" on gameplay screens
// once the advisor is met. Flavor / perspective only; never affects race math.
const STORY_RACE_VOICE = {
  sake:     "息を見ろ。人気でも数字でもなく、竜の気配で選べ。",
  mizu:     "オッズは勝率じゃない。観客の願望が混ざった値であるわ。人気と価値を分けて見るのよ、あはん。",
  makura:   "その人気、実力か物語か？ 盛られてるだけの竜を高値で掴むなよ？",
  sumika:   "勝っても負けても、住居・食事・名声まで含めた総資産が再起の土台です。",
  celestia: "1着を知っても、配当が消えれば意味がない。価値の残る賭けを探しなさい。"
};

// §30 §6 — lifestyle stages by asset level (index 0..5). Drives the
// "ミミの生活" panel. Cosmetic/flavor only; never touches race math.
const LIFE_STAGES = [
  { // §6.1 初期
    housing: "仮眠小屋・簡素な寝床", food: "固いパンと水", outfit: "くたびれたバニー衣装",
    decor: "むき出しの床", tool: "使い古しのメガホン", supporter: "支援者はいない",
    fame: "名声はほぼない", village: "さびれた村のはずれ",
    summary: "借金と空腹のどん底。サケに拾われ、再起がはじまる。" },
  { // §6.2 序盤成長
    housing: "小さな実況者の部屋", food: "温かいスープ", outfit: "新人実況バニー衣装",
    decor: "小さな丸テーブル", tool: "新しいメガホン", supporter: "村の食堂が気にかけてくれる",
    fame: "新人実況予想屋", village: "活気の戻りはじめた村",
    summary: "数字お祈りを卒業し、暮らしに温かいスープが戻ってきた。" },
  { // §6.3 中盤成長
    housing: "村の一室", food: "焼き菓子と紅茶", outfit: "レース実況衣装",
    decor: "予想ボードと本棚", tool: "予想新聞付きの実況席", supporter: "常連客がつきはじめる",
    fame: "常連に名前を覚えられる", village: "にぎわう竜の村",
    summary: "総資産という足場を覚え、生活が整ってきた。" },
  { // §6.4 後半成長
    housing: "ドラゴン村の家", food: "祝祭料理", outfit: "華やかな実況ドレス",
    decor: "受賞プレートの並ぶ棚", tool: "中継用の実況ブース", supporter: "スポンサー・支援者がつく",
    fame: "人気実況予想屋", village: "祝祭でにぎわう村",
    summary: "推し竜文化に沼り、支援者と熱狂に囲まれてきた。" },
  { // §6.5 終盤
    housing: "立派な屋敷", food: "ラパン祝祭フルコース", outfit: "聖龍実況ドレス",
    decor: "聖龍をかたどった装飾", tool: "聖龍レース公式実況席", supporter: "聖龍レース関係者",
    fame: "聖龍レース関係者から注目される", village: "聖龍門を望む大きな村",
    summary: "島の看板リゾートへ。世界の天井さえ覗きにくる大舞台に。" },
  { // §6.6 エンディング
    housing: "再出発の支度部屋", food: "旅立ちのごちそう", outfit: "再出発の冒険バニー衣装",
    decor: "旅装の整った部屋", tool: "旅の相棒メガホン", supporter: "聖龍と仲間たち",
    fame: "聖龍の加護を受けた語り部", village: "見送る竜たちの村",
    summary: "答えの先の価値を掴み、聖龍の加護とともに次の物語へ。" }
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
