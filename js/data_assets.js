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
// ★物語のしきい値と整合（NARRATIVE_DESIGN §7-I）：level3=100万（第4話と同時）・level4=1億（第5話と同時）。
//   旧値（1千万/10億）は章と無関係の孤立した崖で「解放度が合わない」体感ズレの原因だった。
//   unlockedLifeStages は高水位＝既存セーブは下がらない。部屋の購入はコイン制（ROOM_MOVE_COST）なので費用不変。
const ASSET_LEVELS = [
  { level: 1, threshold: 10000 },
  { level: 2, threshold: 100000 },
  { level: 3, threshold: 1000000 },
  { level: 4, threshold: 100000000 },
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

// ── 引っ越し（自宅の部屋レベル 0..5）──────────────────────────────
// ★くらしツリーと同じ作法：部屋は「コインを払って引っ越す」。総資産では自動で上がらない。
//   既存セーブは今の総資産レベルをそのまま引き継ぐ（部屋が下がることはない）。
const ROOM_MOVE_COST = [0, 500, 5000, 50000, 1000000, 50000000];   // 目標Lvごとの引っ越し費用（🪙）。調整はここだけ。
const ROOM_NAMES = ["下宿の一間", "小さな借家", "陽当たりの家", "丘の一軒家", "見晴らしの邸宅", "崑崙の大屋敷"];

function roomLevel() {
  const p = state.player;
  if (typeof p.roomLevel !== "number") p.roomLevel = assetLevelOf(p.totalAssets || 0);   // 移行：今の部屋を維持
  return Math.max(0, Math.min(5, p.roomLevel));
}
function roomName(lv) { return ROOM_NAMES[Math.max(0, Math.min(5, lv))]; }
function canMoveRoom() { return roomLevel() < 5; }
function roomMovePrice() { return ROOM_MOVE_COST[roomLevel() + 1] || 0; }
function tryMoveRoom() {
  if (!canMoveRoom()) return { ok: false, maxed: true };
  const price = roomMovePrice();
  const coins = state.player.coins || 0;
  if (coins < price) return { ok: false, broke: true, price: price, coins: coins };
  state.player.coins = coins - price;
  state.player.roomLevel = roomLevel() + 1;
  if (typeof saveGame === "function") saveGame();
  return { ok: true, level: state.player.roomLevel, price: price };
}

// §30 §7 — story unlocks by 総資産 (thresholds in STORY_UNLOCK_AT below), not by
// complex flags. 5 話 + ED. Texts are the canonical 一文「件。」 style from the
// story-event spec; each chapter introduces one advisor (STORY_CAST) and carries
// a 一枚絵 scene caption.
// `level` here is ONLY the chapter's 0-indexed display order — it is NOT a gate.
// The real unlock threshold lives in STORY_UNLOCK_AT.
// ★2026-07 全面再執筆（ユーザー承認済み・docs/GAME_FLOW_REDESIGN.md §3）：聖龍日報の記事体。
//   headline=大見出し（記事の芸）／lead=旧「一文・件。スタイル」を凝縮したリード（ブランドの芸を継承）／
//   body=場面ごとの段落（\n区切り・.news-text は pre-line）＋談話（章の顧問の一言で締める）。
//   キャラの声：サケ=短い命令＋情／ミズ=「〜のであるわ、あはん」／スミカ=丁寧語で殴る／
//   マクラ=配信テンション／セレスティア=世間話のような天災（第5話のみコメディ抑制）。
const STORY_CHAPTERS = [
  { id: "1",  level: 0, cast: "sake",     title: "第1話　竜王女サケに拾われる",
    headline: "「所持金、涙のみ」——霧の島に本日、バニー一名漂着",
    scene: "聖龍レース場の入口で、倒れかけたミミをサケ・ウダダが拾う",
    lead: "借金と空腹と請求書だけを抱えて聖竜の島に流れ着いたバニーの私が、レース場の入口で行き倒れ名所になりかけたところを竜王女サケ・ウダダに拾われ、温かいスープと容赦ない現実を同時に流し込まれて、人生最初の聖龍レースへ放り込まれる件。",
    body: "財布は軽いのに、人生だけがやたら重い。そんな積み荷で船を降りたのが、運の尽きだった。何千年も火山と霧に閉ざされ、ドラゴンが群れを成すという聖域の島。観光案内には「活気あふれる竜の楽園」とあったが、桟橋に立った私にあふれていたのは借金の利息だけだった。\n手作り感の残る聖龍レース場の入口で、視界が急に狭くなった。ああ、これは。観光名所より先に、行き倒れ名所として島の地図に載るやつだ。膝から崩れた私の耳に、地面より先に声が落ちてきた。\n「まず食え。泣くな。」\n竜王女サケ・ウダダ。面倒見の良さと、命と現場への厳しさを同じ鍋に放り込んで煮詰めたような人だった。差し出されたスープは熱く、続いた言葉はもっと熱かった。「借金は泣いても減らん。だが、勝つ竜を当てれば明日の飯くらいは増えるかもしれん」。女神かと思った次の瞬間には、現実を丼で出してくる人だった。\n食べ終わる頃には、なぜか観客席にいた。助けられたはずなのに、連行されていた。「まずは一着になる竜を選ぶ。単勝だ。難しく考えるな、お前が信じる一頭を選べ」。出走表の数字はまだ呪文にしか見えない。それでも湯気の向こうで竜たちが翼を広げた瞬間、空腹とは別の何かが、お腹の底で鳴った。\nこうして私は、島に着いたその日に、人生最初の賭け札を握らされた。逃げ場はない。というか、帰りの船賃がない。\n\n【談話】サケ・ウダダ「拾ったからには死なせん。だが甘やかしもせん。まず一頭、自分で選べ。話はそれからだ。」" },
  { id: "2",  level: 1, cast: "mizu",     title: "第2話　ミズの分析予想",
    headline: "「ラッキー番号教」本日破産——新人予想家、分析へ強制入信",
    scene: "ミミとミズが同じ竜を見ているが、見ているものが違う",
    lead: "サケさんに単勝だけは元気よく覚えた私が、ラッキーそうな番号に明日のご飯代を捧げ続けて財布と自信をまとめてへし折られたところへ、名刺だけやたら強そうなミズ・アオラが現れ、数字お祈り予想を資本主義ごと粉砕して、分析型予想へ強制アップデートしてくる件。",
    body: "白状すると、勝てた気でいた。単勝＝一着の竜を当てる。ルールを覚えた翌日の私は、もう予想家のつもりだった。7は幸運、3も悪くない、耳がピンと立った竜は来る。私の理論は完璧で、財布だけが毎日薄くなった。\n「当たった気がしたレース」ほど、きれいに外れるのはなぜなのか。観客席で頭を抱えていた私の隣に、その人はすっと座った。ミズ・アオラ。差し出された名刺はやたら立派で、本人は少し頼りなさそうに笑う。のに——オッズ表を開いた瞬間、目だけが据わった。\n「その理論で勝てるなら、投資商会はとっくに神社に吸収合併されているのであるわ。あはん。」\n私のラッキー番号教は、資本主義ごと粉砕された。\nミズさんの講義は容赦なかった。オッズは飾りの数字ではなく、みんなの賭け札が作る「群衆の祈りの成れの果て」。人気が集まれば配当は薄くなり、見向きもされない竜の脚質に、時々「妙味」という名の宝が眠る。数字は、祈るものではなく読むもの。\nその夜、私は生まれて初めて出走表を「読んだ」。脚質、コース、天気、これまでの走り。呪文だった数字が、少しずつ竜の顔に見えてくる。……見えてきたところで当たるとは限らないのが、この島の意地悪なところなのだけど。\n\n【談話】ミズ・アオラ「オッズは祈りではないの。群衆の祈りの、成れの果てなのであるわ。読める者だけが、その先へ行ける。あはん。」" },
  { id: "3",  level: 2, cast: "sumika",   title: "第3話　スミカと総資産",
    headline: "「貧困ではなく遭難です」——行政窓口、新人予想家を保護",
    scene: "村の行政窓口で、スミカが住居・食事・竜舎・施設の選択肢を案内する",
    lead: "たまに単勝が当たるようになり、勝ったコインを気持ちよく次のレースへ吸い込ませかけた私が、村の行政を一手に握る敏腕秘書スミカ・ラグナに捕獲され、丁寧語と帳簿で現実を殴られて、総資産という「負けても終わらない構え」を仕込まれる件。",
    body: "昨日より財布が少し重い。それだけで、人生まで軽くなった気がしていた。借金完済、床ではなく布団、スープには具、バニーには未来。勝利の生活再建コースが見えた気がして、私は勝ち分をぜんぶ、次のレースへ流し込もうとしていた。\nその手首を、帳簿の角がそっと押さえた。「ミミ様。少々よろしいでしょうか」。村の住居も食事も竜舎も会計も再起支援も一手に握る行政秘書、スミカ・ラグナ。優しい窓口の人だと思った。次の一言までは。\n「現在の生活状態は、貧困ではなく遭難です。」\n窓口に座らされた私は、丁寧語で殴られ続けた。帰る部屋がない。食事は屋台の残り物。竜舎も知らない。それで勝負だけ続けるのは、命綱なしで火山に登るのと同じでございます——ぐうの音も出なかった。ぐう。\nスミカさんの処方箋は明快だった。手持ちのコインを増やすだけでなく、住居・食事・施設・名声・生活の資産まで含めた「総資産」を育てること。それが、負けた夜にも人生が終わらないための、本当の準備なのだと。\n帰り際、竜舎の隅から小さな泣き声がした気がした。スミカさんは帳簿から顔も上げずに言った。「ああ、最近入った子です。泣き虫で。……ミミ様と気が合うかもしれませんね」。失礼な。……ちょっと気になった。\n\n【談話】スミカ・ラグナ「勝負運は天気ですが、暮らしは屋根でございます。まず屋根を。話はそれからです、ミミ様。」" },
  { id: "4",  level: 3, cast: "makura",   title: "第4話　マクラと推し竜文化",
    headline: "「賭けてる？ 生きてる？」——クラウン劇場、レース場を配信の渦に",
    scene: "マクラが配信しながら、人気竜・地方・コースの魅力を見せつける",
    lead: "リゾートの顔をし始めたレース場で妄想を肥大化させていた私が、配信者マクラ・クラウン・バズーカーに魔導カメラごと巻き込まれ、「当てるだけなら予想、叫ばせたらショー、名前を覚えさせたら物語だぜ？」を浴びて、推し竜文化の沼へずぶずぶ沈み始める件。",
    body: "気づけばレース場が「うちはリゾートですけど？」という顔をしていた。屋台、観光客、ピカピカの魔導掲示板。ここまで育った島の熱の中に、ほんの少し、自分の賭け札も混ざっている——そう思ったら、団子が三割増しで美味しくなった。\n「賭けてる？ 生きてる？ クラウン劇場、緊急で動画回してます！」\n派手な声と魔導カメラが、私の横顔を勝手に抜いた。マクラ・クラウン・バズーカー。島いちばんの配信者は、コメントの渦を引き連れて笑っていた。「ミミちゃん、つまんない勝ち方してんね」\n失礼すぎる。でも、続く言葉が抜けなかった。「当てるだけなら予想。叫ばせたらショー。名前を覚えさせたら——物語だぜ？」。そのまま配信に巻き込まれた私は、生まれて初めて、配当の数字ではなく「竜の名前」で歓声が起きる瞬間を見た。\nその夜、私は図鑑とコース伝承を朝まで読み漁った。冠名の由来、地方ごとの走り、あの子の癖、この子の好物。ただの金額表だったはずの出走表が、物語の目次に見えてくる。朝焼けの中で「この子の走り、ちょっと見たいかも」と呟いた私は、もう戻れないところにいた。\nちなみにマクラさんの配信アーカイブには、私の後ろで竜舎の泣き虫が一瞬映り込んでいて、コメント欄が「今の子だれ！？」で埋まっていた。……先を越された気がして、ちょっと悔しい。\n帰り際、マクラさんは私のポケットの薄さを見抜いた顔で言った。「スマホ、持ちなよ。お前の予想、村の外まで届くぜ」\n\n【談話】マクラ・クラウン・バズーカー「つまんない勝ち方すんな、って言ったろ？ 明日から面白い勝ち方しようぜ。カメラはこっちだ、ミミちゃん！」" },
  { id: "5",  level: 4, cast: "celestia", title: "第5話　セレスティアの神眼",
    headline: "気さくな旅人、正体は「絶滅」——神眼、賭場の答えをひとつに淘汰",
    scene: "星空ドレスのセレスティアが、観光客のようにレース場へふらっと現れる",
    lead: "レース場の灯りが消えないことを願う面倒なバニーになっていた私の前に、親切で気さくな旅人が現れ、その正体は生命淘汰の神眼で竜の「生き残る順番」が見えてしまう最強のレースギャンブラー、セレスティア・ブラックメテオ。世間話の軽さで告げられた一頭に、島じゅうの賭け札が吸い込まれていく件。",
    body: "その人は、屋台の場所を聞くみたいな軽さで現れた。星空みたいなドレスで、観光客のように笑って、私の予想ノートを「いいね、それ」と褒めた。心強い味方が増えた——最初は本当に、そう思った。\n違和感は小さかった。この人だけ、賭け場に「来た」のではなく、賭け場を「見物しに来た」顔をしている。台風が海水浴場を眺めるときの、あの顔だ。\nセレスティア・ブラックメテオ。世界の天井の一人にして、最強のレースギャンブラー。生命淘汰の神眼——竜たちの「生き残る順番」が、見えてしまう人。\n彼女が世間話のように一頭の名を口にした瞬間、島が変わった。観客も予想屋も、私の常連さんたちも、同じ竜へ賭け札を重ねていく。昨日まで誰の手にもあったはずの「応え」が、たった一つの正解へ淘汰されていく。オッズ表が、みるみる痩せていく。\n「この賭場は、壊れないといいな」。彼女はそう呟いて、ド級の隕石を落としていった。悪意はなかったのだと思う。台風に悪意がないのと、同じ意味で。\n\n【談話】セレスティア・ブラックメテオ「あら。私はただ、見えたものを言っただけよ。……ねえ、この賭場は、どんな答えを返すのかしら。」" },
  { id: "ED", level: 5, cast: "celestia", title: "エンディング　次の物語へ",
    headline: "夜明け前、賭場は答えた——「正解は、ひとつじゃない」",
    scene: "発展した島とレース場を背景に、ミミが大量の資産と聖龍の加護を得て再出発する",
    lead: "隕石の夜、勝つ竜の名を知っただけで勝った気になっていた自分を団子ごと飲み込んだ私が、単勝では薄すぎる正解のまわりに複勝とワイドで席を探し、オッズの端の小さな歪みまでかき集めて、震える手で最後の賭け札を切り直す件。",
    body: "正解は、もう全員が知っていた。神眼の告げた一頭。単勝はどこまでも薄くなり、賭場は「考えること」をやめかけていた。私は団子を飲み込んで、ノートを開いた。サケさんの、一頭を選ぶ勇気。ミズさんの、数字の読み。スミカさんの、負けても終わらない構え。マクラさんの、物語の愛し方。\n単勝で乗れないなら、複勝で残る席を探す。ワイドで、まだ沈んでいない組み合わせを拾う。オッズの端に残った小さな歪みを、ぜんぶかき集める。「これが私の全部です」。震える手で、最後の賭け札を切り直した。\n夜明け前の聖龍レース場に、もう一度だけ歓声が爆発した。正解へ一直線ではない、ばらばらで、にぎやかで、誰のものでもある歓声が。振り向いたセレスティアさんは、少しだけ嬉しそうだった。「この賭場、壊れなかったね」\nそれからの島は、朝まで灯りの消えないレースリゾートに育った。最後のレースを走り切った竜たちが、なぜか全員こっちを見て鳴いた。え、これ祝福ですか、請求書じゃなくて？ と震えていたら、本当に聖龍の加護が降った。屋台も宿も竜舎も観覧席も、まとめて総資産に化けていく。けたを数えるのは、途中であきらめた。\nあの日、レース場の入口で拾われた私は、今度は自分で島の出口を選ぶ。朝の桟橋。霧の向こう。次の物語へ——まず食べてから、行きます。\n\n【談話】セレスティア・ブラックメテオ「壊れなかったね、ここ。……ふふ。次はどこの賭場を、見に行こうかな。」" }
];

// ★クリア後「特別號」（B3解消＝ED後の送り出し・docs/GAME_FLOW_REDESIGN.md §3）。
// 物語画面で edFlag 後に表示する特集面。表示専用＝各画面への goto 導線だけを持つ。
const STORY_EXTRA_ISSUE = {
  headline: "特別號——島はまだ、遊び足りない",
  lead: "物語をひとつ走り切った島とバニーに、まだ灯りの消えない遊び場が三つ残っている件。",
  articles: [
    { icon: "🏃", go: "poro_gourmet", title: "ポロのグルメレース、開催中",
      body: "竜舎の泣き虫ポロが、なぜか「食」の道で覚醒した。勝敗は出ない。出るのは食レポだけ。" },
    { icon: "🗼", go: "mall", title: "モールの上に、塔が生えた",
      body: "エンドレスタワー——登れば登るほど、戦利品と後悔が増える押せ押せダンジョン。挑戦はモールから。" },
    { icon: "🏆", go: "collection_score", title: "島じゅうのコレクションに、得点がついた",
      body: "図鑑、食べ歩き、観光フォト、衣装、竜のなかまたち。埋めたくなったら、それはもう島の住人である。" }
  ],
  quote: "【談話】ミミ「借金は返しました。でも島に、返しきれない楽しさが残ってるんですよね。……もうちょっとだけ、いようかな。」"
};

// §30+ 習い事（アクティブスキル）— ミミが「通う」と上達していく暮らしの活動。
// 称号＋フレーバー専用のメタ進行で、コイン・総資産・レース結果/オッズ/配当には一切触れない。
const ACTIVE_SKILLS = [
  { id: "english", icon: "💬", name: "英会話", tag: "話せると世界が広がる",
    levels: ["Hello! 自己紹介だけは完璧になった。", "屋台で外国人観光客に道案内できた。", "予想の根拠を英語で説明してみた。", "海外の競竜事情まで語り合えるように。"],
    title: "バイリンガルうさぎ" },
  { id: "gym", icon: "💪", name: "会員制ジム", tag: "心も体も立て直す",
    levels: ["体験入会。三日で挫けかけた。", "三日坊主を卒業、通うのが習慣に。", "体幹が安定して姿勢が良くなった。", "鏡の前で、少し自信がついた。"],
    title: "しなやかバニー" },
  { id: "cooking", icon: "🍳", name: "お料理教室", tag: "ちゃんと食べて生きる",
    levels: ["卵をきれいに割れた。", "だしが引けるようになった。", "三品を同時に仕上げられた。", "サケさんに手料理を振る舞えた。"],
    title: "まかない名人" },
  { id: "invest", icon: "📈", name: "投資懇談会", tag: "お金と向き合う",
    levels: ["専門用語が少し分かってきた。", "家計簿が三日以上続いた。", "分散と長期の意味を理解した。", "今度は誰かに教える側へ回れた。"],
    title: "再起の設計士" },
  { id: "tea", icon: "🍵", name: "茶道", tag: "心を静める",
    levels: ["正座で足がしびれた。", "所作が少し様になってきた。", "一服の間で呼吸が整う。", "客人をもてなせるように。"],
    title: "一服の達人" },
  { id: "yoga", icon: "🧘", name: "ヨガ", tag: "呼吸をととのえる",
    levels: ["息を吐くのが下手だと知った。", "朝のひと伸びが気持ちいい。", "ぐらつかず片足で立てた。", "レース前も平常心でいられる。"],
    title: "呼吸の達人" },
  { id: "reading", icon: "📚", name: "読書会", tag: "知をたくわえる",
    levels: ["積読を一冊だけ崩した。", "感想を人前で言えた。", "違うジャンルにも手が伸びた。", "本棚がちょっと誇らしい。"],
    title: "積読卒業うさぎ" },
  { id: "volunteer", icon: "🤲", name: "ボランティア", tag: "誰かの役に立つ",
    levels: ["ゴミ拾いに参加してみた。", "村の子に予想を教えた。", "祭りの設営を手伝った。", "村のみんなに名前を覚えられた。"],
    title: "村の人気者" }
];

// §30+ ショッピングモールの衣装（きせかえ）。ミミの立ち絵を実際に差し替えるコスメ。
// 入手はコイン購入＋条件解放のハイブリッド、着替え自体は無料。所持後はいつでも切替可。
// images/cast/mimi/mimi_<id>_<expr>.png（expr: default / smile / panic / happy …）。
// 表示専用：着順・オッズ・配当には非干渉（コイン購入は既存の生活資産と同じ買い物方式の消費）。
const OUTFITS = [
  { id: "buniqro",   name: "ブニクロ普段着",   flavor: "トートとスニーカーの、肩の力が抜けた休日コーデ。", acquire: { free: true } },
  { id: "newspaper", name: "予想新聞ドレス",   flavor: "競竜新聞をまとった、予想家ミミの正装。",         acquire: { assets: 50000 } },
  { id: "dara",      name: "きれいめコーデ",   flavor: "ジャケットを羽織って、ちょっとおでかけ気分。",   acquire: { price: 5000 } },
  { id: "jungle",    name: "ジャングルバニー", flavor: "葉っぱと馬券で武装した、探検スタイル。",         acquire: { price: 15000 } },
  { id: "tarzan",    name: "野生児ターザン",   flavor: "ヒョウ柄をまとった、聖龍島サバイバル仕様。",     acquire: { price: 40000 } },
  { id: "gymhigh",    name: "トレーニングギア", flavor: "絞れた体で、レース前の追い込みも気分から。",       acquire: { price: 10000 } },
  { id: "drago",      name: "DRADAを着た女",   flavor: "黒で固めたハイブランドDRADA。背伸びした女の貫禄。", acquire: { price: 25000 } },
  { id: "dragonrobe", name: "竜帝の戴冠衣",     flavor: "聖龍の翼と宝玉をまとう、最上位の正装。",           acquire: { price: 80000 } },
  { id: "maumau",    name: "プレッピーカジュアル", flavor: "きれいめトラッドな、お嬢様風プレッピー。",       acquire: { price: 6000 } },
  { id: "gymlow",    name: "スポーティMIX",     flavor: "シャツを腰に巻いた、動きやすい運動着。",           acquire: { price: 8000 } },
  { id: "gymmiddle", name: "アクティブフィット", flavor: "絞った体に映える、ベージュのジムスタイル。",       acquire: { price: 9000 } },
  { id: "leonmall",  name: "モールでお買い物",   flavor: "ふわふわカーデで、モールへおでかけ気分。",         acquire: { price: 12000 } },
  { id: "darugi",    name: "ゆるだぼルーム着",   flavor: "おうちでだらける日の、ゆるゆる部屋着。",           acquire: { price: 7000 } },
  { id: "mannel",    name: "USANNEL",           flavor: "あったかフランネルが看板のブランド USANNEL。",     acquire: { price: 9500 } },
  { id: "merine",    name: "フランスブランド",   flavor: "やわらか上質ニットの、フレンチメゾン仕立て。",     acquire: { price: 14000 } },
  { id: "draspo",    name: "ドラゴスポーティ",   flavor: "竜モチーフのスポーツミックス。",                   acquire: { price: 16000 } },
  { id: "doraqi",    name: "ドラキー・ホーテ",   flavor: "なんでも揃う殿堂のノリで、小悪魔いたずらMIX。",   acquire: { price: 18000 } },
  { id: "drajela",   name: "メゾン・ドラジェラ", flavor: "ひらりと揺れる竜飾り、メゾンの一着。",             acquire: { price: 22000 } },
  { id: "mermes",    name: "メルメス・バニー",   flavor: "最高級メゾンの黒バニー。一生モノの輝き。",         acquire: { price: 120000 } },
  // ── 追加バッチ：素寒貧スタート＋ファッション/ショッピング系（全表情の透過確認済みのみ登録） ──
  { id: "sukanpin",      name: "素寒貧ミミ",         flavor: "借金と空腹だけを抱えて流れ着いた、ボロ布一枚の出発点。", acquire: { free: true } },
  { id: "fashioncenter", name: "ファッションセンター", flavor: "両手にプチプラの大きな袋。賢くおしゃれ、が合言葉。",     acquire: { price: 1500 } },
  { id: "DU",            name: "DUプチプラMIX",      flavor: "ロゴトートにデニムショートパンツ。今どきの古着MIX。",   acquire: { price: 2000 } },
  { id: "amekaji",       name: "アメカジ",           flavor: "デニムシャツを腰に巻いた、こなれアメリカンカジュアル。", acquire: { price: 4000 } },
  { id: "departgirl",    name: "デパートガール",     flavor: "クリーム色のセットアップ。一流デパートの制服みたいな品。", acquire: { price: 30000 } },
  // ── 透過修正バッチ（全表情の透過確認済み） ──
  { id: "denim",         name: "デニムスタイル",     flavor: "白Tにハイウエストデニム。清潔感のど真ん中。",           acquire: { price: 3000 } },
  { id: "swimsuitCHEAP", name: "お手頃水着",         flavor: "シンプルなビキニにビーサン。海開きの定番。",           acquire: { price: 3000 } },
  { id: "street",        name: "ストリート古着",     flavor: "ビッグカーデにロックT、チェック巻きスカート。",         acquire: { price: 3500 } },
  { id: "suit",          name: "就活スーツ",         flavor: "社員証をぶら下げた、きっちりリクルートスタイル。",       acquire: { price: 5000 } },
  { id: "darapike",      name: "もこもこルームウェア", flavor: "ふわふわパイル地で、おうち時間がとろける。",            acquire: { price: 7000 } },
  { id: "bangya",        name: "バンギャ",           flavor: "病みかわパンクに網タイツ。今夜はライブ参戦。",           acquire: { price: 9000 } },
  { id: "swimsuitMID",   name: "リゾート水着",       flavor: "シアー羽織りとトロピカルカクテルで南国気分。",           acquire: { price: 12000 } },
  { id: "taipei",        name: "台北チャイナドレス", flavor: "深紅のチャイナにタッセル。夜市の主役。",               acquire: { price: 18000 } },
  { id: "swimsuitHIGH",  name: "VIP水着",            flavor: "金糸あしらいのラグジュアリー水着とシャンパン。",         acquire: { price: 45000 } },
  { id: "kigurumi",      name: "遊園地",             flavor: "セイリュランドのうさぎ着ぐるみ。一日中アトラクション気分。", acquire: { price: 6000 } },
  { id: "jirai",         name: "地雷系",             flavor: "病みかわピンク×黒に量産ベア。儚げで危うい夜の装い。",   acquire: { price: 9000 } },
  { id: "secret_sukanpin", name: "素寒貧・夜",       flavor: "あの日のボロ布を、なぜか色っぽく着崩して。総資産1億の隠し。", acquire: { assets: 100000000 } }
];
const DEFAULT_OUTFIT = "sukanpin";   // ゲーム開始当初は素寒貧（無料・新規プレイヤーの既定。既存セーブは保存済みoutfitを維持）

function outfitById(id) { return OUTFITS.find(o => o.id === id) || OUTFITS.find(o => o.id === DEFAULT_OUTFIT); }
function currentOutfitId() { return (state.player && state.player.outfit) || DEFAULT_OUTFIT; }
function outfitImg(id, expr) { return "images/cast/mimi/mimi_" + id + "_" + (expr || "default") + ".webp"; }   // 軽量WebP（PNG原本も保持）
// 相棒ドラゴンの画像ソース（拡張ポイント）。将来 state.player.buddyDragon に画像パス／IDを持たせて
// ホームの相棒を切り替え可能にする。今は既定の ref.webp を返すだけ＝表示専用・レース数値には無関係。
function buddyDragonSrc() { return (state.player && state.player.buddyDragon) || "images/dragon_ref/ref.webp"; }
function outfitOwned(o) {
  if (!o) return false;
  if (o.acquire.free) return true;
  const won = (state.player && state.player.outfitsWon) || [];   // モールお買い物ダンジョンの戦利品（表示メタ）
  if (won.indexOf(o.id) >= 0) return true;
  if (o.acquire.assets != null) return ((state.player && state.player.totalAssets) || 0) >= o.acquire.assets;
  const bought = (state.player && state.player.outfitsBought) || [];
  return bought.indexOf(o.id) >= 0;
}
function buyOutfit(id) {
  const o = outfitById(id);
  if (!o || o.acquire.price == null) return { ok: false, reason: "notbuy" };
  if (outfitOwned(o)) return { ok: false, reason: "owned" };
  if ((state.player.coins || 0) < o.acquire.price) return { ok: false, reason: "poor" };
  state.player.coins -= o.acquire.price;           // コイン消費（既存の生活資産購入と同じ・着順/オッズ/配当には非干渉）
  if (!state.player.outfitsBought) state.player.outfitsBought = [];
  state.player.outfitsBought.push(id);
  if (typeof epPush === "function") epPush("mallBuy");   // 終章：買い物が灯り＝絶滅メーターを押し戻す（終章中のみ・表示メタ）
  if (typeof saveGame === "function") saveGame();
  if (typeof updateHeader === "function") updateHeader();
  return { ok: true };
}
function wearOutfit(id) {
  const o = outfitById(id);
  if (!o || !outfitOwned(o)) return { ok: false };
  state.player.outfit = id;
  if (typeof saveGame === "function") saveGame();
  return { ok: true };
}

// Character cast (spec 31). Each advisor unlocks with their chapter and gives
// Mimi a new "perspective". Display/flavor only — never touches race math.
// `level` = the advisor's 0-indexed introduction order (= their chapter index);
// it is NOT a gate — actual availability uses castUnlockAt() → STORY_UNLOCK_AT.
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
// ED aligns to the shared "summit" (1兆 / 1e12): the same total at which the
// final rank (神兎大レース) and the top life tier (聖龍級) unlock, so every
// system agrees the player has reached the top. (Previously 1京/1e16, which
// sat 10,000× beyond every other ceiling and made the next-goal pointer jump
// off-scale after 第5話.) The 一京 in the ED text is the 聖龍の加護 flourish
// layered on top of that summit, not the unlock gate.
const STORY_UNLOCK_AT = { "1": 0, "2": 3000, "3": 30000, "4": 1000000, "5": 100000000, "ED": 1000000000000 };
function storyUnlockAt(chapterId) { const v = STORY_UNLOCK_AT[chapterId]; return v == null ? 0 : v; }
// 総資産 needed for an advisor (= their introducing chapter's threshold).
function castUnlockAt(castKey) { const ch = STORY_CHAPTERS.find(c => c.cast === castKey); return ch ? storyUnlockAt(ch.id) : 0; }
// ★BUGFIX（ミズが出会う前に登場する）：顧問の“登場”は総資産だけでなく「その章を読んだ」ことも要る。
//   従来 total>=castUnlockAt だけで判定＝新規スタートが総資産3000（=ミズ閾値）のため、第2話を
//   読む前からミズが結果画面/相談/SNS/市況に現れていた。総資産閾値 AND 該当章の既読フラグで判定。
//   サケ（第1話）は最初から。表示用のしきい値テキストは castUnlockAt を引き続き使う。
function advisorMet(castKey) {
  try {
    const ch = STORY_CHAPTERS.find(c => c.cast === castKey);
    if (!ch) return true;
    if (ch.id === "1") return true;   // サケ＝物語の出発点（最初から会っている）
    // ★「出会った」＝その章を読んだこと（読むには chapterAvailable を通る＝ペースは章側で担保）。
    //   旧実装は total>=storyUnlockAt も要求していたが、解放を実績ベースに変えたため読了フラグだけで判定する。
    return typeof getStoryFlag === "function" && !!getStoryFlag("_chapter_intro_" + ch.id);
  } catch (e) { return false; }
}

// ── 章の解放ペース（正本・単一の述語）────────────────────────────────
// ★ユーザー指示：1レースの高配当で2〜3話がまとめて解放されるのは急すぎる。
//   ①前の章を読むまで次の章は出さない（＝未読は常に1章まで＝まとめ解放が原理的に起きない）
//   ②序盤は総資産でなく“実績”（走った回数・勝ち）で刻む＝幸運な高配当で飛ばない。物語本文の流れとも一致
//     （1話サケの基礎→数レース走って勘に詰まる→2話ミズ→初勝利→3話スミカ→島がリゾート→4話マクラ→世界の天井→5話）。
// 章の解放判定は全画面この chapterAvailable() を唯一の入口にする（storyUnlockAt は表示テキスト用に残す）。
function chapterRead(id) { try { return typeof getStoryFlag === "function" && !!getStoryFlag("_chapter_intro_" + id); } catch (e) { return false; } }
function chapterAvailable(chId) {
  try {
    const p = state.player || {};
    const total = p.totalAssets || 0, races = p.completedRaces || 0, wins = p.wins || 0;
    switch (String(chId)) {
      case "1":  return true;                                       // サケ＝島に着いた最初から
      case "2":  return chapterRead("1") && races >= 3;             // ミズ＝1話を読み、数レース走って勘に詰まってから
      case "3":  return chapterRead("2") && wins >= 1;             // スミカ＝2話を読み、初勝利で勝ち分の守り方に直面してから
      case "4":  return chapterRead("3") && total >= 1000000;      // マクラ＝島がリゾートに育つ頃（総資産100万）
      case "5":  return chapterRead("4") && total >= 100000000;    // セレスティア＝世界の天井が見える頃（総資産1億）
      case "ED": return chapterRead("5") && (!!(p.epilogue && p.epilogue.edFlag) || total >= storyUnlockAt("ED"));
      default:   return false;
    }
  } catch (e) { return false; }
}
// 解放の人間向け条件テキスト（次號予告・目標ヒント用）。固有名は出さない（未登場ゲートR7）。
function chapterUnlockHint(chId) {
  switch (String(chId)) {
    case "2":  return "第1話を読み、レースを数戦こなすと解禁";
    case "3":  return "第2話を読み、はじめて単勝を当てると解禁";
    case "4":  return "第3話を読み、総資産 " + fmtCoins(1000000) + " で解禁";
    case "5":  return "第4話を読み、総資産 " + fmtCoins(100000000) + " で解禁";
    case "ED": return "第5話を読み、最終決戦をクリアすると解禁";
    default:   return "";
  }
}
// いま読める最も手前の未読章（無ければ null）。ED も含む。バッジ/追いつき告知の共通入口。
function nextUnreadChapter() {
  try {
    for (const ch of STORY_CHAPTERS) { if (!chapterRead(ch.id) && chapterAvailable(ch.id)) return ch; }
  } catch (e) {}
  return null;
}
function storyHasUnread() { return !!nextUnreadChapter(); }

// ★門番ヘルパ（正本・全画面共通）──────────────────────────────
//   「未登場の顧問の“正体”を画面に出さない」ための唯一の入口。名前・記号・テーマ色を出す箇所は
//   STORY_CAST[k].name を直接読まず、必ず castNameSafe/castSymbolSafe/castColorSafe を通す。
//   ・顧問（STORY_CAST のキー）＝ advisorMet() が真のときだけ本名。
//   ・セレスティアだけ2段：celestiaStrangerSeen（破産の伏線）で「あのお姉さん🌌」、
//     第5話（_chapter_intro_5）で正体解禁。伏線段階で本名・☄️・立ち絵を出さない。
//   ・fail-closed：例外や未定義のときは伏せる側（？？？）に倒す。ネタバレは不可逆・非表示は無害。
function castStrangerSeen() {
  try { return typeof getStoryFlag === "function" && !!getStoryFlag("celestiaStrangerSeen"); } catch (e) { return false; }
}
function castNameSafe(castKey) {
  try {
    if (advisorMet(castKey)) return (STORY_CAST[castKey] || {}).name || "？？？";
    if (castKey === "celestia" && castStrangerSeen()) return "あのお姉さん";
  } catch (e) {}
  return "？？？";
}
function castSymbolSafe(castKey) {
  try {
    if (advisorMet(castKey)) return (STORY_CAST[castKey] || {}).symbol || "❓";
    if (castKey === "celestia" && castStrangerSeen()) return "🌌";
  } catch (e) {}
  return "❓";
}
function castColorSafe(castKey) {
  try { if (advisorMet(castKey)) return (STORY_CAST[castKey] || {}).color || "#8a8175"; } catch (e) {}
  return "#8a8175";   // 未登場＝無彩色（テーマ色でキャラを推測させない）
}

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

// §30 §6b — 「暮らしのステップ」: 総資産で刻む 約200段階のフレーバー。表示専用で、
// レース結果・オッズ・配当・解放ロジックには一切影響しない（純粋な“生活感”の演出）。
// 生活のあらゆる方向（食・住・衣・移動・衛生・趣味・心・見栄…）でクスっとさせる。
// 次の1段だけが見え、その先はロック（ミステリー）。しきい値はティア帯ごとに自動生成。
const LIFE_TIERS = [
  { name: "どん底",       min: 0,               color: "#8d897c" },
  { name: "その日暮らし", min: 10000,           color: "#b58a5c" },
  { name: "慎ましい暮らし", min: 100000,        color: "#49c89c" },
  { name: "ちょっと余裕", min: 1000000,         color: "#57b1dd" },
  { name: "小金持ち",     min: 10000000,        color: "#e6b24a" },
  { name: "金持ち",       min: 100000000,       color: "#ffd877" },
  { name: "大金持ち",     min: 1000000000,      color: "#d6452f" },
  { name: "富豪",         min: 10000000000,     color: "#9a6ad0" },
  { name: "大富豪",       min: 100000000000,    color: "#ec7fb9" },
  { name: "聖龍級",       min: 1000000000000,   color: "#ffcf52" }
];
function lifeTierFor(at) {
  let t = LIFE_TIERS[0];
  for (let i = 0; i < LIFE_TIERS.length; i++) { if (at >= LIFE_TIERS[i].min) t = LIFE_TIERS[i]; }
  return t;
}

const MILESTONE_ITEMS = [
  [ // どん底
    { icon: "🕳️", title: "借金とともに夜が明ける", desc: "所持金より借用書のほうが分厚い。生きてるだけ、それが今日の全資産。" },
    { icon: "🪱", title: "ミミズが食べ物に見える", desc: "空腹の限界。地面のミミズがちょっと旨そうに見える。食べない理性、えらい。" },
    { icon: "🚰", title: "公園の水がごちそう", desc: "蛇口の水をがぶ飲みして空腹をごまかす。高等テク、習得。" },
    { icon: "🍞", title: "食パンの耳をもらえる", desc: "パン屋で「耳ください」が言えた。タダの主食、ありがたい。" },
    { icon: "🧻", title: "トイレットペーパーを買える", desc: "公共トイレから拝借する日々に、そっとさよなら。" },
    { icon: "🥫", title: "半額の缶詰を狩る", desc: "賞味期限ギリギリの缶詰が、本日のメインディッシュ。" },
    { icon: "🧦", title: "穴の空いてない靴下", desc: "親指がこんにちはしない靴下を一足。世界が少し優しい。" },
    { icon: "🪥", title: "自分の歯ブラシを持つ", desc: "指で磨く生活、卒業。口の中が文明に追いついた。" },
    { icon: "🩲", title: "きれいなパンツをはける", desc: "ゴムの伸びてない下着デビュー。言えないけど、確かな勝ち。" },
    { icon: "☕", title: "缶コーヒーを飲み残せる", desc: "一気飲みしなくていい。残す“余白”こそ、心の余裕。" },
    { icon: "🍙", title: "おにぎりを温めてもらう", desc: "「温めますか？」に「はい」と言える、ささやかな贅沢。" },
    { icon: "🔌", title: "電気を止められない月", desc: "ロウソク生活、終了。スイッチひとつで部屋が明るい。" },
    { icon: "🛁", title: "銭湯に行ける", desc: "シャワーすらない部屋でも、たまの湯船で生き返る。" },
    { icon: "🧼", title: "詰め替えの石けんを買う", desc: "拾った石けんのカケラを卒業。泡立ちが、ぜんぜん違う。" },
    { icon: "🍜", title: "素のカップ麺デビュー", desc: "お湯を注ぐだけのごちそう。3分が待ち遠しい。" },
    { icon: "🧤", title: "軍手じゃない手袋", desc: "冬の指先がかじかまない。防寒という概念を知る。" },
    { icon: "📻", title: "ラジオで実況を聴く", desc: "中古ラジオから流れるミミの声。これがいまの娯楽だ。" },
    { icon: "🪑", title: "拾わずに椅子を買う", desc: "粗大ゴミ卒業。脚が4本そろった椅子に座る幸せ。" },
    { icon: "🥚", title: "卵をカップ麺に落とせる", desc: "生卵ひとつで生活の質が爆上がり。黄身は希望の色。" },
    { icon: "🧥", title: "古着屋で上着を選ぶ", desc: "拾った服じゃない。サイズの合う上着で冬を越せる。" }
  ],
  [ // その日暮らし
    { icon: "🍱", title: "のり弁を買える", desc: "スーパーの一番安い弁当。でも温かい白米は、正義。" },
    { icon: "🧴", title: "詰め替えじゃないシャンプー", desc: "ボトルのまま買う贅沢。香りで今日の自分の格を確かめる。" },
    { icon: "🛏️", title: "床じゃなく布団で寝る", desc: "せんべい布団でも、床直よりは天国。腰が静かに生き返る。" },
    { icon: "📱", title: "ギガを気にせず実況を観る", desc: "月末にカクつかない。ミミの実況をフル画質で何度でも。" },
    { icon: "🍙", title: "値段を見ずにコンビニ会計", desc: "おにぎり2個とお茶。レジ前で暗算をやめた日。" },
    { icon: "🧺", title: "コインランドリーを使える", desc: "手洗い卒業。乾燥機のふかふかタオルに頬ずり。" },
    { icon: "🍳", title: "フライパンを買う", desc: "自炊デビュー。目玉焼きが焦げても、自由の味がする。" },
    { icon: "🐟", title: "食材を“さん付け”できる", desc: "「今夜はサバさん」。余裕が出ると、食べ物にまで優しい。" },
    { icon: "☔", title: "ビニール傘を即買いできる", desc: "急な雨に走らない。傘を“消耗品”にできる身分。" },
    { icon: "🧦", title: "靴下をまとめ買い", desc: "片方なくなっても平気。引き出しに替えがある安心。" },
    { icon: "🍗", title: "たまにお惣菜のからあげ", desc: "半額じゃない揚げ物を、定価で買える夜がある。" },
    { icon: "🛒", title: "まとめ買いができる", desc: "「特売だから」と多めに買う。冷蔵庫に“余裕”の概念。" },
    { icon: "🎧", title: "イヤホンを新調", desc: "片耳だけ卒業。両耳でミミの実況を浴びる贅沢。" },
    { icon: "🪒", title: "ちゃんとしたカミソリ", desc: "切れ味の悪い安物を卒業。肌を傷つけない、すべすべの朝。" },
    { icon: "🍚", title: "ブランド米を炊く", desc: "安い古米卒業。つやつや新米で、おかずがいらない。" },
    { icon: "💡", title: "部屋の電球を全部つける", desc: "一部屋一灯生活、終了。明るい部屋でくつろぐ。" },
    { icon: "🧥", title: "冬にちゃんとした上着", desc: "重ね着で耐える冬の終わり。「暖かい」ってこういうことか。" },
    { icon: "🧖", title: "サウナまで入れる", desc: "番台で「サウナも」と言える。ととのうという贅沢。" },
    { icon: "📚", title: "古本を新刊で買う", desc: "100円棚を卒業。発売日に本を買う、あの喜び。" },
    { icon: "🍦", title: "コンビニスイーツを我慢しない", desc: "レジ横のスイーツをカゴへ。ちいさな反逆。" }
  ],
  [ // 慎ましい暮らし
    { icon: "🏠", title: "6畳一間に引っ越す", desc: "玄関とトイレが別。それだけで人権を取り戻した気がする。" },
    { icon: "🥦", title: "もやし以外の野菜を買う", desc: "冷蔵庫に緑が戻る。今夜は野菜炒め、具だくさんで。" },
    { icon: "🪑", title: "拾った家具を卒業", desc: "引き出しが全部ちゃんと閉まる。脚のガタつかない机に乾杯。" },
    { icon: "🧊", title: "自分の冷蔵庫を持つ", desc: "共用じゃない。アイスを買い置きできる、人生の余裕。" },
    { icon: "🚲", title: "中古の自転車を買う", desc: "行動範囲が一気に広がる。風を切る通勤、爽快。" },
    { icon: "🎮", title: "趣味にお金を使える", desc: "生活費以外の出費。“好き”に払える数百円が人生を彩る。" },
    { icon: "🍰", title: "誕生日に自分でケーキ", desc: "ホールじゃなくていい。ひと切れのケーキで、自分を祝える。" },
    { icon: "🧹", title: "週末に掃除する余裕", desc: "働きづめ卒業。床にモノのない休日を取り戻す。" },
    { icon: "📺", title: "ちゃんとしたテレビ", desc: "砂嵐の小型テレビ卒業。大画面でレース中継を観る。" },
    { icon: "🛋️", title: "二人がけソファ", desc: "来客を座らせられる。ひとり暮らしに“余白”の家具。" },
    { icon: "☕", title: "ドリップコーヒーを淹れる", desc: "インスタント卒業。豆を挽く香りで、朝が始まる。" },
    { icon: "👟", title: "ちゃんとしたスニーカー", desc: "底のすり減った靴卒業。歩くのが楽しくなる一足。" },
    { icon: "🍲", title: "鍋セットを揃える", desc: "友だちを呼んで鍋ができる。ひとり用土鍋からの卒業。" },
    { icon: "🧳", title: "一泊の小旅行", desc: "近場の温泉に一泊。布団じゃなく、旅館で寝る贅沢。" },
    { icon: "💈", title: "美容院でカットする", desc: "千円カット卒業。鏡の前で「おまかせで」と言える。" },
    { icon: "🪴", title: "部屋に観葉植物", desc: "生き物を育てる余裕。緑のある部屋で深呼吸。" },
    { icon: "🍶", title: "いいお酒を一本", desc: "安酒の流し込み卒業。味わうための一杯を選べる。" },
    { icon: "🎫", title: "ライブのチケットを取る", desc: "配信卒業。現地でミミの実況イベントに参戦。" },
    { icon: "🧥", title: "クリーニングに出す", desc: "自分で洗えない服を持てる。パリッとしたコートで外出。" },
    { icon: "🛁", title: "毎日湯船に浸かれる", desc: "シャワーで済ます日々卒業。湯船で一日の疲れを流す。" }
  ],
  [ // ちょっと余裕
    { icon: "🛋️", title: "1Kでひとり暮らし", desc: "寝室と台所が別。来客を呼べる“ちゃんとした部屋”になった。" },
    { icon: "👟", title: "ブランド店員にビビらない", desc: "試着だけして手ぶらで出られる。店員さんの視線に、もう動じない。" },
    { icon: "🍣", title: "回らない寿司に行ける", desc: "カウンターで“おまかせ”。時価という文字が、こわくない夜。" },
    { icon: "🚗", title: "中古でもマイカー", desc: "雨の日にタクシー代を計算しない。屋根のある移動は、最高だ。" },
    { icon: "♨️", title: "温泉旅行を即決できる", desc: "「来週ふらっと行く？」が会話で完結。気分で決める。" },
    { icon: "🧹", title: "たまに家事代行", desc: "掃除を“買える”。床にモノのない休日という、自由。" },
    { icon: "🍽️", title: "外食を我慢しない週末", desc: "自炊疲れの夜に「今日は外で」。罪悪感ゼロ。" },
    { icon: "⌚", title: "そこそこの腕時計", desc: "電池の心配がない時計。腕元で“整った大人”を演出。" },
    { icon: "🛒", title: "値段を見ずにスーパー", desc: "カゴに入れる手が止まらない。特売を待たない買い物。" },
    { icon: "🕹️", title: "最新ゲーム機を発売日に", desc: "型落ち中古卒業。並んででも、発売日に手に入れる。" },
    { icon: "🚄", title: "新幹線で指定席", desc: "自由席で立つ旅卒業。窓側でゆったり、駅弁を広げる。" },
    { icon: "🐱", title: "猫を迎える", desc: "帰ると誰かが待っている。命を預かれる蓄えと、心の余裕。" },
    { icon: "💺", title: "飛行機で旅行できる", desc: "夜行バス卒業。空の上で、旅の始まりにわくわくする。" },
    { icon: "🍷", title: "行きつけのバー", desc: "「いつもの」で通じる店。名前で呼ばれる夜の心地よさ。" },
    { icon: "💄", title: "デパコスを使う", desc: "ドラッグストア卒業。鏡の前の自分が、少し好きになる。" },
    { icon: "📷", title: "趣味のカメラを買う", desc: "「いつか欲しい」を今買える。休日に景色を切り取る。" },
    { icon: "🎟️", title: "いい席でライブ観戦", desc: "後方席卒業。アリーナ前方でミミの晴れ舞台を浴びる。" },
    { icon: "🛏️", title: "ちゃんとしたベッド", desc: "万年床卒業。低反発マットレスで腰が生まれ変わる。" },
    { icon: "🧺", title: "ドラム式洗濯機", desc: "干す手間からの解放。乾燥まで全自動という文明の極み。" },
    { icon: "🍶", title: "取り寄せグルメ", desc: "「ご当地の味」をお取り寄せ。家にいながら全国を食べる。" }
  ],
  [ // 小金持ち
    { icon: "📽️", title: "1DKにプロジェクター", desc: "壁が映画館。ミミの大レースを100インチで全力応援。" },
    { icon: "⌚", title: "ちゃんとした腕時計", desc: "電池切れに怯えない時計。腕元で“整った大人”を完成。" },
    { icon: "🍸", title: "行きつけのバーができる", desc: "“いつもの”で通じる店。名前で呼ばれる夜の心地よさ。" },
    { icon: "🧳", title: "海外旅行をパッと予約", desc: "パスポートの出番が増える。連休の使い方が一段リッチに。" },
    { icon: "🐶", title: "ペットを迎える余裕", desc: "命を預かれるだけの蓄え。帰ると、誰かが待っている暮らし。" },
    { icon: "🚙", title: "そこそこの新車", desc: "中古卒業。納車の日、新車のにおいで少しにやける。" },
    { icon: "🏝️", title: "リゾートでバカンス", desc: "安宿卒業。ビーチ付きホテルで、何もしない贅沢を知る。" },
    { icon: "👔", title: "オーダーメイドのスーツ", desc: "吊るし卒業。自分の体に合わせた一着で、背筋が伸びる。" },
    { icon: "🍴", title: "月イチで高級店", desc: "記念日じゃなくても三ツ星。コース名を噛まずに言える。" },
    { icon: "🎸", title: "大人の趣味に投資", desc: "楽器でも釣りでも、本気の道具を揃える余裕。" },
    { icon: "💆", title: "月イチでエステ", desc: "体のメンテを“買える”。整った自分で毎日に挑む。" },
    { icon: "🚕", title: "タクシーを“足”にする", desc: "終電を気にしない夜。手を上げれば、家まで一直線。" },
    { icon: "🏠", title: "2LDKに広げる", desc: "趣味部屋ができる。モノを置くための部屋という贅沢。" },
    { icon: "🍾", title: "シャンパンで乾杯", desc: "発泡酒卒業。祝いの夜、栓を抜く音で気分が上がる。" },
    { icon: "👜", title: "ハイブランドのバッグ", desc: "ショーケースの中から選ぶ側へ。ひとつ“本物”を持つ。" },
    { icon: "⛷️", title: "シーズンで趣味を満喫", desc: "スキーでもゴルフでも、シーズン券で遊び倒す。" },
    { icon: "🧑‍🍳", title: "料理教室に通う", desc: "自己流卒業。プロに習って、おもてなしできる腕前に。" },
    { icon: "✈️", title: "ビジネスクラスを試す", desc: "エコノミー卒業。フラットシートで、旅の前から優雅に。" },
    { icon: "🏡", title: "駅近の物件に住む", desc: "通勤地獄からの解放。徒歩5分の立地を“買える”。" },
    { icon: "💍", title: "自分へのご褒美に宝飾品", desc: "値札を見ない買い物を、年イチで自分に許可する。" }
  ],
  [ // 金持ち
    { icon: "🏢", title: "3LDKに引っ越す", desc: "部屋が余る贅沢。竜レース観戦“専用ルーム”まで作ってしまった。" },
    { icon: "🛍️", title: "ブランドを普段使い", desc: "ショーケースの中から選ぶ側へ。店員さんが、奥から出てくる。" },
    { icon: "🚙", title: "新車を一括で買う", desc: "ローンという概念を、置いてきた。納車日に、ちょっと泣く。" },
    { icon: "🍽️", title: "ミシュランを予約できる", desc: "三ツ星の席を“記念日に”。気軽に予約を入れられる。" },
    { icon: "🩺", title: "人間ドックを毎年", desc: "健康を“買う”。フルコースの検査で、自分を整備する。" },
    { icon: "🏖️", title: "別荘候補を見に行く", desc: "不動産屋に「セカンドハウスを」と言える側に。" },
    { icon: "💪", title: "専属のトレーナー", desc: "体づくりを外注。理想の自分を、プロと一緒に作る。" },
    { icon: "🍷", title: "ワインセラーを持つ", desc: "“寝かせる”を覚える。価値の上がる一本を待つ楽しみ。" },
    { icon: "👗", title: "パーティードレスを誂える", desc: "招かれる側になる。場にふさわしい一着を仕立てる。" },
    { icon: "🚗", title: "二台目の車を持つ", desc: "平日用と週末用。気分で乗り換える、車のある生活。" },
    { icon: "🧳", title: "家族を旅行に連れて行く", desc: "自分だけじゃなく、大切な人にも贅沢を配れる。" },
    { icon: "🖼️", title: "趣味でアートを買う", desc: "壁に“好き”を飾る。値段じゃなく、心で選ぶ余裕。" },
    { icon: "🏌️", title: "ゴルフ会員権", desc: "「メンバーです」と言える。週末の社交場を手に入れる。" },
    { icon: "🍣", title: "大将と顔なじみの寿司屋", desc: "予約なしでカウンターへ。「いつもの握りを」。" },
    { icon: "🚁", title: "ヘリ遊覧を体験", desc: "一度きりの贅沢に手が届く。空から島を見下ろす日。" },
    { icon: "💳", title: "ブラックカードに憧れない", desc: "もう必要ない。欲しいものは、現金でさらりと。" },
    { icon: "🏡", title: "庭付きの家", desc: "ベランダ菜園卒業。本物の庭でバーベキューができる。" },
    { icon: "🧑‍🎨", title: "ポートレートを描いてもらう", desc: "画家に自分を描かせる。玄関に飾る一枚の贅沢。" },
    { icon: "⛵", title: "ボートを一日チャーター", desc: "海に出る側へ。デッキでシャンパン、波の上の休日。" },
    { icon: "🎻", title: "一流の演奏を特等席で", desc: "オーケストラを最前列で。音に包まれる夜を買う。" }
  ],
  [ // 大金持ち
    { icon: "🏖️", title: "海の見える別荘", desc: "週末だけの二つ目の家。波の音で目が覚める自分になれる。" },
    { icon: "🛥️", title: "クルーザーでレース観戦", desc: "海上の特等席。波の上でグラス片手に、推し竜を見送る。" },
    { icon: "👔", title: "専属スタイリスト", desc: "服を選ぶ時間を買う。今日の私は、誰かのコーデで完成する。" },
    { icon: "🏎️", title: "スポーツカーが“足”", desc: "走るために乗る車。エンジン音で、近所に存在を知らせる。" },
    { icon: "🍱", title: "専属シェフが家にいる", desc: "冷蔵庫を開けない暮らし。「今日は何を召し上がりますか」。" },
    { icon: "🧖", title: "自宅にサウナ", desc: "銭湯卒業。整いたい時に、いつでも“ととのう”。" },
    { icon: "🪑", title: "オーダー家具で揃える", desc: "既製品卒業。部屋に合わせて、家具を“作らせる”。" },
    { icon: "🐎", title: "乗馬を趣味にする", desc: "馬と通う休日。自分の鞍を、クラブに置いてもらう。" },
    { icon: "🍳", title: "朝食をホテルのように", desc: "自宅の食卓が高級ホテル。毎朝が“優雅”で始まる。" },
    { icon: "🛫", title: "プライベートジェットを試す", desc: "空港の行列卒業。時間に合わせて、空が飛ぶ。" },
    { icon: "🏝️", title: "島のリゾートを貸し切り", desc: "他の客がいない海。プールも砂浜も、今日は全部自分の。" },
    { icon: "👑", title: "VIPルームが当たり前", desc: "どこへ行っても通される個室。行列を見ることがない。" },
    { icon: "🎩", title: "執事を雇う", desc: "「いかがなさいますか」。暮らしの段取りを、まるごと任せる。" },
    { icon: "💎", title: "本物の宝石を日常に", desc: "ガラスケースの中身が、自分の引き出しに収まる。" },
    { icon: "🚗", title: "ガレージにコレクション", desc: "名車が並ぶ車庫。気分で選ぶ、動く資産たち。" },
    { icon: "🏔️", title: "別荘を複数持つ", desc: "海と山に一つずつ。季節で住む場所を選ぶ暮らし。" },
    { icon: "🍷", title: "ヴィンテージワインを開ける", desc: "“もったいない”が消える。最高の一本を、惜しまず。" },
    { icon: "🎬", title: "自主映画を撮らせる", desc: "道楽で映画を一本。エンドロールに、自分の名を入れる。" },
    { icon: "🧑‍✈️", title: "お抱え運転手", desc: "ハンドルを握らない移動。後部座席が、自分のオフィス。" },
    { icon: "🏇", title: "馬主デビュー", desc: "自分の馬を走らせる側へ。ターフに、自分の勝負服がはためく。" }
  ],
  [ // 富豪
    { icon: "🏰", title: "丘の上に豪邸", desc: "門から玄関まで車で移動。庭に竜が一頭、遊びに来る。" },
    { icon: "🚁", title: "移動はヘリ", desc: "渋滞という概念の卒業式。空からレース場へ直行する。" },
    { icon: "🎨", title: "美術品を集めだす", desc: "壁にかかるのは“資産”。来客に値段を聞かれて、ただ微笑む。" },
    { icon: "🏝️", title: "無人島を一つ買う", desc: "地図に自分の地名が増える。聖龍島の隣に、ちいさな“ミミ島”。" },
    { icon: "🍇", title: "自分のブドウ畑", desc: "ワインを“造る”側へ。ラベルに、自分の名前を刷る。" },
    { icon: "🖼️", title: "私設ギャラリーを開く", desc: "集めた名画を人に見せる。入場無料の、道楽の殿堂。" },
    { icon: "⛵", title: "大型ヨットを所有", desc: "海に浮かぶ別荘。寝室もバーもある、動く我が家。" },
    { icon: "🦓", title: "私設動物園をつくる", desc: "庭に珍獣たち。子どもの夢を、大人の財力で叶える。" },
    { icon: "🍽️", title: "お抱えのレストラン", desc: "自分のためだけの店。シェフチームが今夜も腕をふるう。" },
    { icon: "🏎️", title: "サーキットを借りて走る", desc: "公道じゃ出せない速度を、貸し切りコースで解放。" },
    { icon: "🎻", title: "専属の楽団を抱える", desc: "気が向けば生演奏。食卓の横で、いつでもオーケストラ。" },
    { icon: "🗼", title: "自分のビルを建てる", desc: "街に自分の建物。最上階のペントハウスから街を見下ろす。" },
    { icon: "🛩️", title: "専用機を持つ", desc: "チャーター卒業。尾翼に自分のマークが入った機体で空へ。" },
    { icon: "🐴", title: "競走馬の牧場を持つ", desc: "走らせるだけじゃない。育てる側に回る、馬産のロマン。" },
    { icon: "🏖️", title: "ビーチを買い取る", desc: "海岸線ごと所有。プライベートビーチで、誰にも会わない。" },
    { icon: "🎢", title: "庭にアトラクション", desc: "観覧車でもメリーゴーランドでも。庭が小さな遊園地に。" },
    { icon: "🍶", title: "酒蔵を一つ持つ", desc: "利き酒が高じて、蔵ごと。世界に出す一本を仕込む。" },
    { icon: "🏯", title: "城を買って住む", desc: "歴史ある城が我が家。観光名所に、表札をかける。" },
    { icon: "🚀", title: "宇宙旅行を予約", desc: "旅行先に“軌道上”が加わる。窓の外は、聖龍島の全景。" },
    { icon: "🥂", title: "社交界の主催者", desc: "招かれる側から、招く側へ。今夜の主役は、いつも自分。" }
  ],
  [ // 大富豪
    { icon: "🐉", title: "競走竜のオーナーに", desc: "自前の竜を走らせる側へ。勝てば配当、いつでも物語の主役。" },
    { icon: "🏟️", title: "レースの冠スポンサー", desc: "大会名に自分の名が冠される。電光掲示板が、挨拶してくる。" },
    { icon: "🏝️", title: "島を丸ごと買う", desc: "別荘でも無人島でもない。住民のいる島の、主になる。" },
    { icon: "🏆", title: "自分の名を冠した大会", desc: "「ミミ杯」開催。竜たちが、自分の名のもとに走る。" },
    { icon: "🏦", title: "銀行を持つ", desc: "お金を“貸す”側へ。経済の血流の、元栓を握る。" },
    { icon: "🏙️", title: "街を一つ開発する", desc: "更地に街を描く。道も建物も、自分の構想で生まれる。" },
    { icon: "🛰️", title: "人工衛星を打ち上げる", desc: "自分の衛星が空に。夜空に“資産”が一つ増える。" },
    { icon: "🎓", title: "学校を建てる", desc: "学びの場を寄付。次の世代に、自分の名の校舎を残す。" },
    { icon: "🏥", title: "病院を建てる", desc: "救える命に投資。かつて自分が欲しかった安心を、誰かに。" },
    { icon: "🌉", title: "橋や道を寄贈する", desc: "インフラに名を刻む。渡るたび、誰かが自分を思い出す。" },
    { icon: "🏛️", title: "美術館を設立", desc: "集めた名品を、永久に公開。文化の守り手になる。" },
    { icon: "🚄", title: "鉄道を一本通す", desc: "不便な町に線路を。時刻表に、自分の引いた路線が載る。" },
    { icon: "🎬", title: "映画スタジオを持つ", desc: "道楽が産業に。世界に届く物語を、自分の名で作る。" },
    { icon: "🛳️", title: "豪華客船を所有", desc: "海に浮かぶ街。世界一周しながら、船上で暮らす。" },
    { icon: "🗿", title: "駅前に銅像が建つ", desc: "自分の像が待ち合わせ場所に。鳩に頭を借りられても、誇らしい。" },
    { icon: "📡", title: "放送局を持つ", desc: "電波を握る。ミミの実況を、自分の局から世界へ流す。" },
    { icon: "🏝️", title: "列島を所有する", desc: "島ひとつじゃ足りない。点在する島々を、群島ごと。" },
    { icon: "🛕", title: "神殿を再建する", desc: "朽ちた聖地に資金を。信仰の場を、自分の手でよみがえらせる。" },
    { icon: "🌋", title: "火山を観測所ごと持つ", desc: "噴火を見張る権利。島の鼓動を、自分が見守る。" },
    { icon: "👑", title: "名誉島民第一号", desc: "島の歴史書に名が載る。建国の恩人として記録される。" }
  ],
  [ // 聖龍級
    { icon: "✨", title: "聖龍に名を覚えられる", desc: "島の守り神が「やあ、ミミ」と挨拶。資産が、信仰の域に届く。" },
    { icon: "🌋", title: "火山ごと買い取る", desc: "噴火の権利者。聖龍島の絶景は、もう半分わたしのもの。" },
    { icon: "🏛️", title: "ミミ財団を設立", desc: "稼ぐから“配る”側へ。次のどん底の誰かを、今度は自分が拾う。" },
    { icon: "🌊", title: "海をひとつ名づける", desc: "地図の青に、自分の名。船乗りが“ミミ海”と呼ぶ。" },
    { icon: "🛰️", title: "宇宙ステーションを持つ", desc: "軌道上の別荘。地球を見下ろす窓辺で、今日もひと息つく。" },
    { icon: "🏙️", title: "国際都市を築く", desc: "世界中から人が集う街。自分の理想を、都市の形で残す。" },
    { icon: "🐉", title: "聖龍と契約を交わす", desc: "守り神と肩を並べる。伝説の一頭が、自分の相棒に。" },
    { icon: "🌐", title: "経済を一言で動かす", desc: "ミミがつぶやくとオッズが揺れる。世界が、耳を澄ます存在に。" },
    { icon: "🗺️", title: "国を買えるほどの地主", desc: "島も海も山も。地図の広い範囲が、自分の色に染まる。" },
    { icon: "🎆", title: "島の祭りを主催する", desc: "年に一度、空が花火で埋まる。島民みんなが、自分を祝う。" },
    { icon: "🗽", title: "巨大モニュメントを建てる", desc: "ランドマークが自分の像。海から見える、希望の灯。" },
    { icon: "🌋", title: "噴火を鎮める儀式の主", desc: "島の安寧を担う者。自然の機嫌すら、責任の範囲に入る。" },
    { icon: "📜", title: "神話に名が刻まれる", desc: "語り継がれる物語の登場人物。生きながら、伝説になる。" },
    { icon: "👑", title: "生ける伝説になる", desc: "単位が大きすぎてピンとこない。誰もが名を知るのに、自分は自分のまま。" },
    { icon: "🌟", title: "星に名前をつける", desc: "夜空の一等星が“ミミ星”。見上げれば、いつでも自分がいる。" },
    { icon: "🌏", title: "世界遺産を守る基金", desc: "地球の宝を未来へ。人類の記憶の、後ろ盾になる。" },
    { icon: "🚀", title: "別の島を開拓する", desc: "海の果てに新天地。第二の聖龍島を、ゼロから育てる。" },
    { icon: "🛸", title: "空に浮かぶ都市を造る", desc: "重力すら設計図に。雲の上で暮らす街の、創設者。" },
    { icon: "☄️", title: "時代に名を残す", desc: "教科書に載る一人に。何百年先の子どもが、自分を学ぶ。" },
    { icon: "🌌", title: "物語の“神”になる", desc: "数字はもう意味をなさない。それでも——缶コーヒーは、やっぱり少し残す。" }
  ]
];

// niceRound — 表示が読みやすいよう 2 桁有効数字に丸める（fmtCoins が 万/億/兆 表記に整える）。
function niceRound(n) {
  if (n < 100) return Math.round(n);
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

// LIFE_MILESTONES — 各ティア帯 [min, 次のmin) に項目を対数等間隔で割り付け、約200段を自動生成。
// しきい値は計算で出すので単調増加が保証され、文言・アイコンだけ書けばよい。完全に表示専用。
const LIFE_MILESTONES = (function () {
  const out = [];
  for (let t = 0; t < LIFE_TIERS.length; t++) {
    const lo = LIFE_TIERS[t].min;
    const hi = (t + 1 < LIFE_TIERS.length) ? LIFE_TIERS[t + 1].min : 1e15;
    const items = MILESTONE_ITEMS[t] || [];
    const K = items.length;
    for (let j = 0; j < K; j++) {
      const at = (lo <= 0)
        ? Math.round(hi * Math.pow(j / K, 1.7))          // 最下層は 0 からゆるやかに立ち上げる
        : Math.round(lo * Math.pow(hi / lo, j / K));      // 対数等間隔
      out.push({ at: niceRound(at), icon: items[j].icon, title: items[j].title, desc: items[j].desc });
    }
  }
  for (let i = 1; i < out.length; i++) { if (out[i].at <= out[i - 1].at) out[i].at = out[i - 1].at + 1; }
  return out;
})();

// reached = 到達済みの段数（= 次に解放される段の index でもある）。総資産は単調なので
// 配列は昇順前提で先頭から数えるだけでよい。
function lifeMilestoneReached(total) {
  let n = 0;
  for (let i = 0; i < LIFE_MILESTONES.length; i++) { if (total >= LIFE_MILESTONES[i].at) n++; else break; }
  return n;
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
