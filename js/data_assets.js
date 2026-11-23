/**
 * data_assets.js — total-asset & lifestyle progression DATA (spec #30).
 *
 * Pure lookup tables + tiny pure helpers. No state mutation, no DOM.
 * The engine (assets_engine.js) reads these to compute 総資産, unlock lifestyle
 * assets, gate story chapters, and size the bankruptcy rescue.
 *
 * Design rules from spec #30:
 *   - 手持ちコイン (betting) is SEPARATE from 総資産 (progression). (§2.1)
 *   - 解放判定は assetsPeak（到達最高）を使うので、負けても解放は巻き戻らない。旧: 総資産 uses maxCoinsReached, never current coins, so a losing bet never
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
  { level: 5, threshold: 1000000000 }   // ★2026-07-30 頂＝10億（旧1兆。docs/ENDGAME_ECONOMY_REDESIGN.md）
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
  if (typeof p.roomLevel !== "number") p.roomLevel = assetLevelOf(assetsPeak(state));   // 移行：今の部屋を維持
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
// ED copy reads verified outcomes only; it never promotes a preview or writes progress.
function storyEndingNarrative() {
  let sg = null;
  try { sg = typeof state !== "undefined" && state.player ? state.player.shingan : null; } catch (e) {}
  let kind = "neutral", festivalIssue = false, recoveryProof = null;
  const festival = sg && sg.festival && sg.festival.version === 2;
  if (festival || (sg && sg.official && sg.official.issue)) {
    try {
      if (typeof ShinganOfficial !== "undefined" && typeof ShinganOfficial.getOutcome === "function") {
        const result = ShinganOfficial.getOutcome();
        if (result && result.success === true) {
          kind = "fair";
          festivalIssue = result.provenance === "festival-v2";
          if (result.recovery?.complete) recoveryProof = result.recovery;
        }
      }
    } catch (e) { /* Missing or unverifiable new outcomes must not become old ties. */ }
  }
  // Once the new mode exists, only its captured origin can prove an old tie.
  // A failed new issue must not erase that history or invent it from cleared.
  if (kind === "neutral" && sg && (festival ? sg.festival.legacy?.legacyCleared === true : sg.official
    ? sg.official.version === 1 && sg.official.legacyCleared === true
    : sg.cleared === true)) {
    kind = "legacyTie";
  }
  if (kind === "fair") return {
    kind: kind,
    headline: "予言どおりの一着、その先へ——島に、次の営業日",
    scene: "発行した一面と読者の払戻を見届け、ミミが島の朝を迎える",
    lead: "神眼の一着は変わらなかった。私が出した一面を手に、読者はそれぞれの札を選んだ。" + (recoveryProof ? "そのあとも季節ごとの受渡しを続け、借りた分を返し、次の開催費を残した。" : "結果と帳面を確かめたあとに、明日の店の話が続いた。"),
    body: "竜たちは、それぞれの走りでゴールした。私の紙面が走りを変えたわけではないし、セレスティアさんの眼が曇ったわけでもない。予言の一着は、最後まで正しかった。\n私が出したのは、" + (festivalIssue ? "この窓口に来た人へ、予言の先の読みを伝える一面" : "三つの予想を載せた一面") + "だった。何を信じて選ぶか、誰に届けるか。決めたあとも、読者が手にした札を見ていると、指先が落ち着かなかった。\nレースのあと、一面と結果を並べた。どの予想が当たり、読者へいくら戻ったか。島の営業を続けるだけの収支が残ったか。歓声だけを記事にせず、その数字も確かめた。次も同じ紙面でうまくいくとは限らない。\n店先では、明日の仕込みの話が始まっていた。セレスティアさんがそちらを見て、少し笑った。「わたしは当てた。でも、この賭場は続くんだね」。私はうなずいた。ここまでなら、引き分けと呼んでもいいだろうか。\n朝の桟橋で、発行した紙を折り直す。この島で見つけたものを、次の場所でも思い出せるように。霧の向こうへ行く前に、まずは朝ご飯にしよう。\n\n【談話】セレスティア・ブラックメテオ「次の一着も、きっと視えるよ。その先であなたが何を話すかは、また聞きたいな。」",
    finStory: [
      "神眼が告げた一着は、最後まで正しかった。",
      "ミミの一面を手に、読者がそれぞれの札を選ぶ。竜たちは、自分の走りで駆け抜けた。",
      recoveryProof ? "季節ごとの納入と平日・祭日の営業を続けた。借入と未払を清算し、次の開催費を自分たちの口座に残した。" : "予想の結果と読者への払戻、そして島の営業収支を確かめた。",
      "夜が明ける。店先には、明日の仕込みを話す声がある。",
      "「わたしは当てた。でも、この賭場は続くんだね」——それを、二人は引き分けと呼んだ。",
      "ミミは一面を折り直す。霧の向こうの、次の物語へ。"
    ]
  };
  if (kind === "legacyTie") return {
    kind: kind,
    headline: "三頭同着、神眼も見届けた結末——夜明けの聖龍レース場",
    scene: "三頭同着の結末を正確に見届けたセレスティアが、引き分けを認める",
    lead: "三頭が同着となった。セレスティアさんも、その結末を正確に視ていた。予言を外したのではなく、二人の勝負を引き分けとして認めてくれた。",
    body: "ゴールの判定は、三頭同着だった。歓声が重なり、私は息を吸うのを忘れていたことに気づいた。セレスティアさんの眼が視えなくなったのではない。彼女は、この結末まで正確に見届けていた。\nそのうえで、私との勝負を引き分けとして認めた。神眼を破った、と書けば派手な見出しになる。でも、それではあの人が見たものも、選んだことも違ってしまう。記事には、三頭同着と書いた。\nレース場を出るころには、空の色が変わっていた。さっきまでの声が、少しずつ朝の物音に混じっていく。私はノートを閉じ、セレスティアさんと石段の下を見た。\n朝の桟橋。霧の向こうには、まだ知らない場所がある。次の話を始める前に、まず何か食べていこう。\n\n【談話】セレスティア・ブラックメテオ「うん、引き分け。この結末を、あなたと見届けられたね。」",
    finStory: [
      "ゴールの判定は、三頭同着だった。",
      "セレスティアの神眼は、その結末まで正確に視ていた。",
      "そのうえで彼女は、ミミとの勝負を引き分けとして認めた。",
      "歓声のあとに朝が来る。ミミは、見届けた結末をノートに残した。",
      "朝の桟橋、霧の向こうへ。——まず食べてから、次の物語へ。"
    ]
  };
  return {
    kind: kind,
    headline: "朝の桟橋——次の物語へ",
    scene: "島の朝と、霧の向こうへ続く桟橋を眺めるミミ",
    lead: "朝の桟橋に、潮の匂いが届く。ミミはノートを開き、次に書く頁を指で押さえた。",
    body: "朝の桟橋。波の音の向こうで、船の鐘が鳴った。ミミはノートを開き、潮風から頁を押さえる。\nこれから何を見て、誰と話し、何を食べるのか。書き始めるには、まだ早い。まずは、自分で歩いて確かめよう。\n「行く前に、朝ご飯ですね」\nミミはノートをしまい、店の灯りの方へ向いた。霧の向こうの物語は、もう少しだけ待ってもらう。",
    finStory: [
      "朝の桟橋に、潮の匂いが届く。",
      "ミミはノートを開き、次に書く頁を押さえた。",
      "何を見て、誰と話すのか。まずは、自分で歩いて確かめよう。",
      "霧の向こうの、次の物語へ。——朝ご飯を食べてから。"
    ]
  };
}
const STORY_CHAPTERS = [
  { id: "1",  level: 0, cast: "sake",     title: "第1話　竜王女サケに拾われる",
    headline: "拾われたのは、丼のこちら側——聖龍レース場、入口の一席",
    scene: "レース場の入口で、サケが腰掛けと熱いスープを差し出す",
    lead: "名前を聞かれる前に、お腹の音を聞かれた。差し出された丼には条件がなく、門の向こうには、まだ知らない竜たちがいた。",
    body: "丼の縁には、小さな欠けがあった。飲み口を探して回すと、反対側にもある。何度も誰かがここで食べた器なのだろう。私一人のために用意された特別な救済より、その使い込まれ方に、少し息が楽になった。\nサケさんは鍋のそばへ戻ると、私の返事を待たずに自分の分をよそった。助けてもらった理由も、立派なお礼の言葉も、急いで用意しなくてよかった。ただ、落とさないように丼を持つ。そのくらいなら、今の私にもできた。\n膝に載せた出走表には、湯気のしずくが一つ落ちていた。まだ読めない数字の横で、竜の名前だけは読める。門をくぐる前に、どの子を見たいか考えてみる。誰かに決めてもらわずに。\n「戻ったら聞かせろ」と言われたことが、あとから効いてきた。勝ったらでも、稼げたらでもない。見てきたものが一つあれば、ここへ戻って話せる。\nこの島で最初に覚えたのは、竜の名前でも数字でもなかった。入口に置かれた、木の腰掛けのことだった。\n\n【談話】サケ・ウダダ「丼は逃げん。慌てて食って舌をやるなよ。」" },
  { id: "2",  level: 1, cast: "mizu",     title: "第2話　ミズの分析予想",
    headline: "丸印の隣に、空欄あり——予想家の手帳を押さえた夜",
    scene: "夜市の風からミズの手帳を守り、ミミが空欄の理由を尋ねる",
    lead: "すごい予想家の手帳は、答えで埋まっていると思っていた。けれど気になったのは、丸の数より、何度も消して空いた場所だった。",
    body: "別れ際、ミズさんは鉛筆の芯を爪で確かめた。紙に押しつけると、先が欠けていたらしい。「今日の確かな損失はこれね」。たったそれだけを、少し悔しそうに言った。何でもお見通しの人だと思いかけていた私は、そこでようやく笑えた。\nもらった紙の裏には、私の引いた曲がった線が残っている。左は見たこと。右はまだわからないこと。右側を空けておくのは、勉強不足を見せるようで、ちょっと恥ずかしい。ミズさんの手帳にも同じ空白があったと思うと、そのまま持っていていい気がした。\nオッズは皆の賭け札が作る数字で、人気が集まれば配当は痩せる。それでも、人気のない竜なら何でもよいわけではない。脚質とコースと天気、これまでの走り。その竜を選ぶ理由は、数字の外からも持ってこなくてはいけない。\n次に読み違えたら、丸ごと消さずに持っていこう。あの人は私の正解を買うと言ったのではなく、見てきたことを聞きたがっていた。風で頁が閉じそうになったら、今度は先に鉛筆を一本置いておこうと思う。\n\n【談話】ミズ・アオラ「わからないことを隠すより、確かめる場所を覚えておく方が安上がりよ。」" },
  { id: "3",  level: 2, cast: "sumika",   title: "第3話　スミカと総資産",
    headline: "買わずに帰れる相談窓口——地図の余白に、一本の遠回り",
    scene: "行政窓口で、ミミが増やすものより先になくしたくないものを尋ねる",
    lead: "まだ何も決めていない相談用紙に、「継続」の印がついた。渡された地図には、施設の値段だけでなく、スミカさんの好きな道が一本増えていた。",
    body: "窓口の椅子を戻すと、脚の下に布が巻いてあった。引くたびに大きな音がしないように、ということらしい。申込書や印鑑ばかり見ていた目に、帰り際になってそういうものが入ってきた。\nスミカさんの机には、何度も貼り直した島の地図がある。新しい建物を書き足すだけなら、こんなに折り目は傷まない。迷った人の前へ広げ、畳んで、また広げてきた地図なのだと思う。\n手元のお金を増やすことと、暮らしを残すことは、似ているようで違う。住まいも食事も、これから欲しいものも、もう持っているものもある。全部をいっぺんに立派にする相談でなくてよい、と聞けたのはありがたかった。\n私は借りた写しを、相談用紙と一緒に折った。余白の遠回りは、まだ歩いていない。だから今は、よい道だったとは書かない。歩いて確かめて、気に入ったらそう伝えたいし、別の道がよかったら、それも話してみたい。\n次に窓口へ来る理由が、困り事だけでなくなった。あの鉛筆の線について、一言返すために戻ってもいいのだ。\n\n【談話】スミカ・ラグナ「地図の余白は残しておいてくださいませ。ミミ様が見つけた道も、教えていただきたいので。」" },
  { id: "4",  level: 3, cast: "makura",   title: "第4話　マクラと推し竜文化",
    headline: "録音の合図は、こちらから——配信小屋で旗の表を向けた日",
    scene: "応援旗を支えたミミが、マクラと条件を確かめて声の録音を試す",
    lead: "カメラの灯は、最初からついていたわけではない。私がうなずいて初めて、マイクがこちらを向いた。「当たる」以外に何を話すか、考える時間があった。",
    body: "小屋を出る前に、マクラさんは録音を止めたまま、旗を結び直していた。結び目は見栄えが悪くても、表が風に負けない方がいいらしい。さっきまで「ばっちり」と笑っていた人が、こういうところでは何度でもやり直す。\n録った声は、二人で聞くためのものとして手元に残した。誰かに届けるかは、私が確かめてから決める。それを待ってもらえるとわかると、もう少し話したいことが出てくるのが不思議だった。\n先頭の竜を追えば、映像はわかりやすい。けれど後ろで踏ん張っている子の名前も、応援旗には書いてある。私が最後まで見たいと思った理由を、マクラさんは「その方が人気が出る」とは言わなかった。ただ、もう一度聞いてくれた。\n島には、まだ名前しか知らない竜も、通り過ぎただけの場所もある。知っているふりで紹介するより、気になったところから確かめて、次の話を持っていきたい。画面に映らないときのあの人にも、聞いてほしい。\n小屋の外で振り返ると、旗の名前はちゃんとこちらを向いていた。\n\n【談話】マクラ・クラウン・バズーカー「聞いてから、次のカットを決める。……今日はあたしも、それ忘れないようにする。」" },
  { id: "5",  level: 4, cast: "celestia", title: "第5話　セレスティアの神眼",
    headline: "神眼の旅人が、白い頁に書いたこと——答えのある島で、話を続ける",
    scene: "レース場を見下ろす石段で、セレスティアがミミに隣の席を空ける",
    lead: "勝つ竜を視る人の手帳に、書けない頁があった。そこへ最初に戻ってきたのは、もうない賭場の勝ち負けではなく、熱いスープを出した人の話だった。",
    body: "手帳に書かれた文字は小さかった。セレスティアさんは、店の人がどちら側に座っていたか、少し考えてから余白へ椅子を描き足した。未来の勝者が視える人も、昔の食卓を思い出すときは手を止める。その違いが、私には忘れられそうになかった。\n神眼の答えは、外れるから恐ろしいのではない。当たる答えへみんなが集まったあと、この島でどんな声が残るのか。それを考えようとすると、頭の中の出走表より先に、屋台や窓口の顔が浮かんだ。\nあの人は、まだこの頁に島の結末を書いていない。だからといって安心できるわけではない。今まで閉じてきた賭場の話は、鉛筆の先を少し止めただけでは変わらない。熱いスープの思い出が一つ戻っても、それで次の店を守れたことにはならない。\nそれでも、次に会ったときに話すことはできた。私がこの島で何を見て、誰の話を聞いたのか。答えを教えてもらうためだけに近づくのではなく、こちらから持っていくものがある。\n手帳をしまうと、セレスティアさんはリュックの肩紐を直した。石段の下には、まだ店の灯りがあった。私はその方へ体を向けた。\n\n【談話】セレスティア・ブラックメテオ「この島の話、次はどこから聞こうかな。急がなくていいよ。まだ、ここにいるから。」" },
  { id: "ED", level: 5, cast: "celestia", title: "エンディング　次の物語へ",
    get headline() { return storyEndingNarrative().headline; },
    get scene() { return storyEndingNarrative().scene; },
    get lead() { return storyEndingNarrative().lead; },
    get body() { return storyEndingNarrative().body; } }
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
  // ★ブニクロ普段着は「モールで最初に買う服」＝進行の節目。無料配布をやめて有料にした。
  //   この価格がモール解放のしきい値も兼ねる（mallUnlocked／buniqroPrice）ので、
  //   序盤のテンポを変えたいときは、ここ1か所だけを動かせばよい。
  // ★2,000 → 1,500（2026-11-13・ユーザーから一任されて決定。計測＝tools/sim_early_wallet.mjs・ゲームが薦めるとおりに走らせた値）。
  //   2,000：自分の所持金ではほぼ届かない。届く道は事実上「破産して無心（約5,600）」だけで、無心の直後に買えた人が
  //     慎重（単勝100固定）93%・財布の2割賭け97%・最大賭け90%。届く戦は 最大7戦め／2割賭け21戦め／慎重24戦め＝慎重な人ほど遅い。
  //     （ランク1は賭金の上限が100。1番人気の勝率は16〜27%。1,000 から賭けで 2,000 にはならない）
  //   1,500：1戦めの注目ボーナス（+300）と2戦めの図鑑25%（+500）で、勝ち負けに関係なく全員が2戦のあとに届く（無心経由 0%）。
  //     買うと財布はほぼ空になり、次の1戦で無心へ＝「全財産で服を買う→空っぽ→無心」が最初の5分に全員に起きる。
  //     第2話の条件（3戦以上）はそのまま＝3戦めで第2話が読める。
  //   1,700〜1,800 は「序盤に1〜2回当てた人だけ」になり、残りは 2,000 と同じ遅い道に落ちるので採らない。
  //   レースの着順・オッズ・配当、無心の額には触れていない。
  { id: "buniqro",   name: "ブニクロ普段着",   flavor: "トートとスニーカーの、肩の力が抜けた休日コーデ。", acquire: { price: 1500 } },
  { id: "newspaper", name: "予想新聞ドレス",   flavor: "競竜新聞をまとった、予想家ミミの正装。",         acquire: { assets: 50000 } },
  { id: "dara",      name: "きれいめコーデ",   flavor: "ジャケットを羽織って、ちょっとおでかけ気分。",   acquire: { price: 5000 } },
  { id: "jungle",    name: "ジャングルバニー", flavor: "葉っぱと馬券で武装した、探検スタイル。",         acquire: { price: 15000 } },
  { id: "tarzan",    name: "野生児ターザン",   flavor: "ヒョウ柄をまとった、聖龍島サバイバル仕様。",     acquire: { price: 40000 } },
  { id: "gymhigh",    name: "トレーニングギア", flavor: "絞れた体で、レース前の追い込みも気分から。",       acquire: { price: 10000 } },
  { id: "drago",      name: "DRADAを着た女",   flavor: "黒で固めたハイブランドDRADA。背伸びした女の貫禄。", acquire: { price: 25000 } },
  // ★買えない（ユーザー指定・2026-07-31）：竜帝の戴冠衣は**最終決戦の装束**なので、8万コインで
  //   いつでも買える普段着ではなく、終章（第5話〜最終決戦の前）のイベントでだけ手に入る。
  //   付与＝epilogue_engine.js maybeGrantDragonRobe（絶滅メーターを押し戻して安全ゾーンに入った時）。
  { id: "dragonrobe", name: "竜帝の戴冠衣",     flavor: "聖龍の翼と宝玉をまとう、最上位の正装。",           acquire: { epilogue: true } },
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
  { id: "secret_sukanpin", name: "素寒貧・夜",       flavor: "あの日のボロ布を、なぜか色っぽく着崩して。総資産1億の隠し。", acquire: { assets: 100000000 } },
  // ★T3 旅ノートの全エリア制覇でだけ手に入る記念衣装（買えない＝旅の証）。付与は _kmGrantTravelOutfit。
  { id: "konron_photographer", name: "崑崙路の写真家", flavor: "島じゅうを歩いて撮った者だけが羽織れる旅装。ポケットには使い切ったフィルム。", acquire: { travel: true } }
];
const DEFAULT_OUTFIT = "sukanpin";   // ゲーム開始当初は素寒貧（無料・新規プレイヤーの既定。既存セーブは保存済みoutfitを維持）

function outfitById(id) { return OUTFITS.find(o => o.id === id) || OUTFITS.find(o => o.id === DEFAULT_OUTFIT); }
function currentOutfitId() { return (state.player && state.player.outfit) || DEFAULT_OUTFIT; }
function outfitImg(id, expr) { return "images/cast/mimi/mimi_" + id + "_" + (expr || "default") + ".webp"; }   // 軽量WebP（PNG原本も保持）
// ミミの顔アイコン（いま着ている衣装の立ち絵から顔だけ切り出す）。インラインstyleで返す＝どのアイコン枠にもそのまま付く。
// 立ち絵は全衣装512×768だが、ポーズで顔の位置が違う → 衣装ごとの顔の中心（smile絵で目視合わせ）。
// ★衣装を足したら1行足す（無ければ標準位置 [254,140]）。切り出しは中心から130px四方。
const MIMI_FACE_POS = {
  buniqro: [256, 148], newspaper: [258, 148], dara: [250, 158], jungle: [254, 152], tarzan: [252, 144], gymhigh: [250, 128],
  drago: [256, 136], dragonrobe: [254, 146], maumau: [250, 146], gymlow: [254, 156], gymmiddle: [252, 152], leonmall: [250, 136],
  darugi: [248, 122], mannel: [256, 122], merine: [252, 132], draspo: [254, 132], doraqi: [252, 134], drajela: [254, 138],
  mermes: [240, 128], sukanpin: [258, 193], fashioncenter: [256, 150], amekaji: [252, 142], departgirl: [256, 148], denim: [254, 142],
  street: [250, 140], suit: [254, 148], darapike: [256, 144], bangya: [224, 141], taipei: [252, 146], kigurumi: [250, 146],
  jirai: [235, 140], secret_sukanpin: [258, 132], konron_photographer: [256, 134]
};
function mimiAvatarStyle(expr) {
  try {
    const id = currentOutfitId(), c = MIMI_FACE_POS[id] || [254, 140], S = 130;
    const px = (c[0] - S / 2) / (512 - S) * 100, py = (c[1] - S / 2) / (768 - S) * 100;
    return "background:#f6e3d3 url('" + outfitImg(id, expr || "smile") + "') " + px.toFixed(1) + "% " + py.toFixed(1) + "%/" + (512 / S * 100).toFixed(0) + "% auto no-repeat";
  } catch (e) { return ""; }
}
// 相棒ドラゴンの画像ソース（拡張ポイント）。将来 state.player.buddyDragon に画像パス／IDを持たせて
// ホームの相棒を切り替え可能にする。今は既定の ref.webp を返すだけ＝表示専用・レース数値には無関係。
function buddyDragonSrc() { return (state.player && state.player.buddyDragon) || "images/dragon_ref/ref.webp"; }
function outfitOwned(o) {
  if (!o) return false;
  if (o.acquire.free) return true;
  const won = (state.player && state.player.outfitsWon) || [];   // モールお買い物ダンジョンの戦利品（表示メタ）
  if (won.indexOf(o.id) >= 0) return true;
  if (o.acquire.assets != null) return assetsPeak(state) >= o.acquire.assets;   // ★解放判定＝到達最高
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
  // ✍️ 紀行の素材：服を買った日。はじめての普段着（buniqro）は連載の回が書くので、ここでは拾わない。
  try { if (id !== "buniqro" && typeof kikoMatPush === "function") kikoMatPush("outfit", { name: o.name, price: o.acquire.price }); } catch (e) {}
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
              // ★声表スイープ（NARRATIVE_DESIGN §2）：ここは日報「論説委員名簿」の決めゼリフ＝各人の“構え”。
              //   相談ハブの挨拶（storyVoiceLine consult）とは別文にする（D13＝持ちネタの多面再演を禁止）。
              consult: "竜は脚より先に、息で崩れる。……見えなかったか？　なら、明日も来い。飯は出す。" },
  mizu:     { key: "mizu",     name: "ミズ・アオラ",                 tag: "エコノミスト", level: 1, gives: "市場を見る目",     focus: "市場・オッズ・期待値",  color: "#3f7fd0", symbol: "📊",
              // ※名簿では「」で囲まれて表示されるため、本文の鉤括弧は〈〉にして入れ子を避ける
              consult: "みんなが〈来ない〉と決めた値段には、たいてい、来る理由が置き去りにされているの。……拾う？" },
  sumika:   { key: "sumika",   name: "スミカ・ラグナ",               tag: "行政秘書",     level: 2, gives: "生活を立て直す土台", focus: "生活・住居・総資産",    color: "#6ac06a", symbol: "🏠",
              consult: "賭けは水物。ですが、屋根と食事は帳簿に残ります。……ミミ様の欄が埋まっていくのを見るのが、わたくしの楽しみでして。" },
  makura:   { key: "makura",   name: "マクラ・クラウン・バズーカー", tag: "配信者",       level: 3, gives: "声を届ける力",     focus: "観客・実況・熱狂",      color: "#caa44a", symbol: "🎤",
              consult: "同接は数字、歓声は熱、名前は記憶。三つ揃って、はじめて“いい日”だ。……なに真面目な顔してんだ、おれが。" },
  celestia: { key: "celestia", name: "セレスティア・ブラックメテオ", tag: "世界の天井",   level: 4, gives: "世界の大きさ",     focus: "神眼・淘汰・市場の歪み", color: "#9a6ad0", symbol: "☄️",
              // ※神眼1.1倍の“説明”はここでは書かない（D6＝レース詳細のセレスティア台詞1本＋メーターヘルプに集約済み）
              consult: "高いところから見てるとね、勝ち負けって天気に似てるんだよ。……ところでさ。下の屋台の、あの匂いって何？" }
};

// spec 32 §9 — story chapters unlock by 総資産 (DECOUPLED from the lifestyle
// ASSET_LEVELS, so story pacing follows the spec without touching the
// economy / lifestyle / rescue thresholds). chapter id → 総資産 needed.
// ★2026-07-30 頂＝10億へ圧縮（旧1兆・ユーザー決裁。docs/ENDGAME_ECONOMY_REDESIGN.md）。
//   実測：R5帯の本命は期待値+29%あり、1億→10億は複利15〜30レース＝1兆は本命党には永遠に届かない壁だった。
//   10億は「最後のイベントレース（神眼レース・M3で実装）」の解放額。当面（M1）は従来どおり
//   このしきい値でEDの金額パスが開く。LIFE_TIERS の富豪〜聖龍級（100億〜1兆）はED後の
//   フレーバーとして意図的に残す（コインはED後も増え続けるため）。
const STORY_UNLOCK_AT = { "1": 0, "2": 3000, "3": 30000, "4": 1000000, "5": 100000000, "ED": 1000000000 };
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

function chapterFourLifeStatus(player = state.player) {
  const local = player.islandLife && typeof IslandLifeLoop !== "undefined"
    ? IslandLifeLoop.normalize(player.islandLife).firstLocalStory : null;
  const outing = local && local.completedRace <= (player.completedRaces || 0) ? local : null;
  const findings = player.islandDiscovery && typeof IslandDiscovery !== "undefined"
    ? IslandDiscovery.exportDiscoveries(player.islandDiscovery).length : 0;
  const requirements = [
    { id: "outing", label: "寄り道で実際に試したことを、現地でアヤに話す", done: !!outing, count: outing ? 1 : 0, target: 1 },
    { id: "finding", label: "島で気になったことを調べ、発見を1件確かめる", done: findings > 0, count: findings, target: 1 }
  ];
  return { ready: requirements.some(item => item.done), outing, findings, requirements };
}
function chapterFourEntryMet(st = state) {
  return assetsPeak(st) >= storyUnlockAt("4") || chapterFourLifeStatus(st.player).ready;
}

// 第五話の取材経路。既に行った現地確認・実契約・自分の予想の記録を読む。
function chapterFiveFieldStatus(player = state.player) {
  const findings = player.islandDiscovery && typeof IslandDiscovery !== "undefined"
    ? IslandDiscovery.exportDiscoveries(player.islandDiscovery).length : 0;
  const scouted = typeof DRAGONS === "undefined" ? 0 : DRAGONS.filter(dragon =>
    dragon.id !== "poro" && player.collection?.[dragon.id]?.scouted === true).length;
  const notes = typeof ReadingJournal !== "undefined"
    ? ReadingJournal.normalizeNotes(player.readingNotes, typeof DRAGONS === "undefined" ? undefined : DRAGONS)
      .filter(note => note.completedRace <= (player.completedRaces || 0)).length : 0;
  const hasNote = notes > 0 || player.flags?.readingNoteKept === true;
  const requirements = [
    { id: "findings", label: "島で異なる発見を2件確かめる", count: findings, target: 2, done: findings >= 2 },
    { id: "report", label: "一戦の読みを手帖に残すか、スカウト先で竜1頭と仲よくなる", count: hasNote || scouted ? 1 : 0, target: 1, done: hasNote || scouted > 0 }
  ];
  return { ready: requirements.every(item => item.done), requirements, findings, scouted, notes, hasNote };
}
function makuraPostSubject(post, player = state.player) {
  if (!post) return null;
  if (post.img == null && !post.source) return { name: "文字の投稿", kind: "text" };
  if (typeof post.img !== "string") return null;
  const spots = typeof KONRON_SPOTS === "undefined" ? {} : KONRON_SPOTS;
  if (post.source) {
    const source = post.source, spot = Object.hasOwn(spots, source.spotId) && spots[source.spotId];
    return source.version === 1 && spot && ["photo", "gourmet"].includes(source.kind) && spot[source.kind] === post.img
      ? { name: spot.name, kind: source.kind } : null;
  }
  const dishes = typeof MEALS === "undefined" ? [] : MEALS;
  if (post.subject?.kind === "meal") {
    const dish = dishes.find(m => m.id === post.subject.id && m.photo === post.img);
    return dish && player.meals?.eaten?.[dish.id] === true ? {name:dish.name,kind:"gourmet"} : null;
  }
  // The original review snapshot kept the picture but no structured subject.
  const eaten = dishes.find(m => m.photo === post.img && player.meals?.eaten?.[m.id] === true);
  if (!post.subject && eaten) return {name:eaten.name,kind:"gourmet"};
  const spot = Object.values(spots).find(s => s.photo === post.img || s.gourmet === post.img);
  if (spot) return { name: spot.name, kind: spot.gourmet === post.img ? "gourmet" : "photo" };
  const dragon = typeof DRAGONS !== "undefined" && DRAGONS.find(d => post.img === "images/dragons/" + d.id + ".png");
  if (dragon) return { name: dragon.name, kind: "dragon" };
  const outfit = typeof OUTFITS !== "undefined" && OUTFITS.find(o => post.img === outfitImg(o.id));
  if (outfit) return { name: outfit.name, kind: "outfit" };
  const camera = typeof SNS_CAMERA_ALL !== "undefined" && SNS_CAMERA_ALL.some(c => c.img === post.img);
  return camera ? { name: "カメラロールの一枚", kind: "camera" } : null;
}
function validMakuraPost(post) {
  return validMakuraPostForPlayer(post,state.player);
}
function validMakuraPostForPlayer(post,player) {
  const id = post && typeof post.id === "string" && /^my_(\d+)_(\d+)$/.exec(post.id);
  const today = typeof _epochDay === "function" ? _epochDay() : Math.floor(Date.now() / 86400000);
  return !!id && Number(id[1]) === post.day && Number.isSafeInteger(post.day) && post.day <= today &&
    Number.isSafeInteger(Number(id[2])) && Number(id[2]) > 0 &&
    typeof post.text === "string" && !!post.text.trim() && post.text.length <= 140 && !!makuraPostSubject(post,player);
}
function makuraPostReviewed(player = state.player) {
  const m = player.makuraPostMemory;
  return !!player.flags?.phoneBought && validMakuraPostForPlayer(m,player) && Number.isSafeInteger(m.reacts) && m.reacts > 0;
}
function chapterFiveEntryMet(st = state) {
  return (assetsPeak(st) >= storyUnlockAt("5") || chapterFiveFieldStatus(st.player).ready) && makuraPostReviewed(st.player);
}
// ブニクロ普段着の値段＝「モールが開く額」でもある序盤テンポの単一ノブ（OUTFITS から引く）。
function buniqroPrice() {
  try { const o = OUTFITS.find(x => x.id === "buniqro"); return (o && o.acquire && o.acquire.price) || 2000; }
  catch (e) { return 2000; }
}
function chapterAvailable(chId) {
  try {
    const p = state.player || {};
    // ★不変条件：一度読んだ章は、条件が後から変わっても必ず読み返せる。
    //   解放条件を足すたびに既存プレイヤーの既読章が消える事故を、ここで構造的に防ぐ。
    if (chapterRead(chId)) return true;
    const races = p.completedRaces || 0, wins = p.wins || 0;   // ★章の解放＝到達最高
    switch (String(chId)) {
      case "1":  return true;                                       // サケ＝島に着いた最初から
      // ミズ＝1話を読み、数戦こなし、さらに「初めて自分の服を買う」ところまで到達してから。
      // ★序盤を長く取るための要（ユーザー指示）：初陣→サケの勝負服→稼ぐ→モールが開く→
      //   ブニクロ普段着を買う、という一連の暮らしの立ち上げを、2話より前に置き切る。
      case "2":  return chapterRead("1") && races >= 3
                        && (typeof outfitOwned === "function") && outfitOwned(OUTFITS.find(o => o.id === "buniqro"));
      case "3":  return chapterRead("2") && wins >= 1;             // スミカ＝2話を読み、初勝利で勝ち分の守り方に直面してから
      case "4":  return chapterRead("3") && chapterFourEntryMet();
      case "5":  return chapterRead("4") && chapterFiveEntryMet();
      // ★M3（2026-07-30）：EDの金額バイパスを廃止。総資産10億は「神眼レースの解放額」であって
      //   EDの直行券ではない（クリマックス＝3頭同着のパズルを飛ばせない）。edFlag は
      //   神眼レースのクリア（shingan_race.js _sgClear→epilogueClear）で立つ。
      case "ED": return chapterRead("5") && !!(p.epilogue && p.epilogue.edFlag);
      default:   return false;
    }
  } catch (e) { return false; }
}
// 解放の人間向け条件テキスト（次號予告・目標ヒント用）。固有名は出さない（未登場ゲートR7）。
function chapterUnlockHint(chId) {
  switch (String(chId)) {
    case "2":  return "第1話を読み、数戦こなして「ブニクロ普段着」を買うと解禁";
    case "3":  return "第2話を読み、はじめて単勝を当てると解禁";
    case "4":  return "第3話のあと、寄り道で試したことを現地でアヤに話すか、島の発見を1件確かめる。到達最高資産100万でも読めます。";
    case "5":  return "第4話のあと、自分の投稿への反応をマクラと読む。島で発見2件と予想手帖か竜の取材を重ねるか、到達最高資産1億で島の次の出来事へ。";
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
// ★D5（NARRATIVE_DESIGN）：同一文の多面再演をやめ、画面別3変奏に分割。
//   race=レース系画面の分析ひとこと／consult=相談ハブの導入（呼び水）／assets=暮らし画面。
//   取り出しは storyVoiceLine(key, ctx)（文字列の旧形式もフォールバックで読める）。
const STORY_RACE_VOICE = {
  sake:     { race: "パドックの息を見ろ。数字は、その後でいい。",
              consult: "おう、来たか。……何を迷ってる。言ってみろ。" },
  mizu:     { race: "その倍率、人気のぶんだけ水増しされてる。……で、中身は？",
              consult: "あら、いらっしゃい。相談料は取らないわ。……今のところは。" },
  makura:   { race: "その人気、実力？　それとも切り抜きのバズ？　……見分けてから買いな。",
              consult: "お、来た来た。今日の見どころ、30秒で言うよ？" },
  sumika:   { assets: "勝っても負けても、帰る部屋と温かい食事。……それが、明日も賭けられる理由です。",
              race: "無理のない賭金でしたら、負けは経費です。……帳簿にはそう書きます。",
              consult: "ミミ様、ご相談は何なりと。書類はこちらで巻きますので。" },
  celestia: { race: "答えを知ってる賭けと、答えを探す賭け。……楽しいのは、後のほうだよ。",
              consult: "上から見てるとね、レース場って、いちばん星に似てるの。……で、今日は何が知りたいの？" }
};
function storyVoiceLine(key, ctx) {
  const v = STORY_RACE_VOICE[key];
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[ctx] || v.race || v.consult || v.assets || "";
}

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
    housing: "竜の村の家", food: "祝祭料理", outfit: "華やかな実況ドレス",
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
    { icon: "📜", title: "借金とともに夜が明ける", desc: "所持金より借用書のほうが分厚い。生きてるだけ、それが今日の全資産。" },
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
  { id: "village_house",category: "housing", name: "竜の村の家",       value: 20000,  unlockType: "auto", unlockAssetLevel: 3, rescueBonus: 150,
    description: "竜の村に、自分の家を構えられるようになった。" },
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
