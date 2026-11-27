/**
 * data_dialogue.js — “立ち絵つきセリフ”の台本（イベント駆動でない場面ぶん）
 * =========================================================================
 * レース結果・ランクアップ・節目・地域/ライバル紹介などの反応は **event_registry.js**
 * が持っており、dialogue.js 経由で自動的に立ち絵化される（ここには書かない）。
 * このファイルは“イベントに無い場面”の台本だけ：
 *   ① 着替え反応   ③ ストーリー各話の導入   ④ ログイン挨拶   ⑤ レース直前の煽り
 *
 * ★ 台詞はすべて「たたき台」。ここを自由に編集・追加・削除してください（表示専用）。
 *   行の形： L('話者ID','セリフ','表情')  ／ 表情は default/smile/happy/panic（ミミ）
 *   話者ID： mimi / sake / mizu / sumika / makura / celestia / announcer / narrator
 * レースの着順・オッズ・配当には一切触れません。
 */
(function (global) {
  "use strict";
  function L(s, t, e) { return { s: s, t: t, e: e }; }
  function pick(a, i) { return a[((i % a.length) + a.length) % a.length]; }
  var money = (typeof fmtCoins === "function") ? fmtCoins : function (n) { return n; };

  var DLG = {

    // ⑤ レース直前の煽りを出すか（毎レース1〜2行・スキップ可）。うるさければ false。
    PRE_RACE_HYPE: true,

    /* ① 着替え反応 ----------------------------------------------------
       衣装ID→ミミの一言。新衣装を足したらここに1行追加するだけ。 */
    OUTFIT: {
      buniqro:    "やっぱりこの普段着が一番おちつくな〜。",
      newspaper:  "予想新聞ドレス、装着！ さあ本命を見抜きますよ。",
      dara:       "ちょっとおでかけ気分♪ ……どう、似合ってる？",
      jungle:     "ジャングルバニー参上！ 今日は探検モードだよ〜。",
      tarzan:     "うおー！ 野生のミミ、覚醒ですっ！",
      gymhigh:    "トレーニングギアで気合い入れ直し！ ふんすっ。",
      drago:      "黒で統一……ちょっと大人っぽいでしょ？ えへへ。",
      dragonrobe: "竜帝の戴冠衣……わ、わたしが着ていいのかな。どきどき。",
      maumau:     "ゆるカジで、今日はのんびりいこ〜。",
      gymlow:     "シャツを腰に巻いて、動きやすさ重視！",
      gymmiddle:  "ベージュのジムスタイル、きまったっ！",
      leonmall:   "もこもこニット、ふわっふわ〜。モールいこ！",
      // ★G11追補（NARRATIVE_DESIGN）：未対応だった24着。声表＝飯・お金・耳の語彙で。
      sukanpin:        "……うん、原点。ここから始まったんだよね。……よし、稼ごう。",
      secret_sukanpin: "夜の素寒貧……。あの頃は、星だけがごちそうだったなあ。",
      darugi:          "ゆるだぼ〜。今日はもう何もしない宣言……は、レースの後で。",
      mannel:          "USANNEL！　耳穴あきニットは、うさぎ界の革命だよ。",
      merine:          "フ、フランスの……。汚さないように、今日は汁物禁止です。",
      draspo:          "ドラスポで駆け足！　パドックまで競走ねっ！",
      doraqi:          "ドラキー・ホーテ体制、整いました。安くて強い、わたし好み！",
      drajela:         "メゾン・ドラジェラ……。振り向くたび、いい匂いがする気がする。",
      mermes:          "メ、メルメス……！　転んだら一生後悔するやつだ、これ。",
      fashioncenter:   "ファッションセンター万歳。コスパは正義だよ、うん。",
      DU:              "プチプラでこの完成度！　浮いたお金は、串焼きへ。",
      amekaji:         "アメカジ！　大きめシルエットは、食べても目立たない。……天才？",
      departgirl:      "デパートガール風。「いらっしゃいませ〜」……あ、癖で言っちゃった。",
      denim:           "デニムは相棒。しゃがんでも破れない、いい仕事します。",
      swimsuitCHEAP:   "お手頃水着！　海はタダ。最高のコスパレジャーです。",
      swimsuitMID:     "リゾート仕様〜。波の音を聞きながら、勝ち飯……じゅる。",
      swimsuitHIGH:    "V、VIP水着……。濡らしていいのかなこれ、逆に。",
      street:          "古着は一点もの。この色落ちに、前の持ち主のドラマを感じる〜。",
      suit:            "就活スーツ！　御社が第一志望です。……御社って、どこ？",
      darapike:        "もこもこ〜。着たまま寝たら、朝までワープできる装備。",
      bangya:          "今日は推しの竜に、ぜんぶ捧げる日……！　ヘドバン用の耳、よし。",
      taipei:          "チャイナドレス！　スリットは飾りじゃなくて、走るためです。",
      kigurumi:        "きぐるみ〜！　これで並べば、行列だって遊びの時間だよ。",
      jirai:           "じ、地雷系……？　かわいいは、かわいいの意志でできてるの。"
    },
    outfit: function (o) {
      var line = (o && DLG.OUTFIT[o.id]) || (((o && o.name) || "新しい服") + "に着替えた！ どうかな？");
      return [L("mimi", line, "happy")];
    },
    // ★はじめて自分で買った服（ブニクロ普段着）を買った瞬間だけの反応（2026-11-13）。
    //   上の OUTFIT.buniqro「やっぱりこの普段着が一番おちつくな〜。」は、この服が最初から持っている服だった頃の台詞で、
    //   着替え直すときには合うが、全財産をはたいて買った直後には合わなかった（Codex の通し試験：
    //   「所持金 1,600→100。『ほぼ全財産を使った』重さが、小さな数字の変化でしか伝わらない」）。
    //   left＝買ったあとの所持コイン、price＝払った額。財布がほぼ空（払った額の3割未満）なら、青ざめる一拍を入れる。
    //   ミミは反応するだけ（仕組みは説明しない）。数は確定済みの所持金を読むだけ。
    firstOutfit: function (left, price) {
      var c = (typeof fmtCoins === "function") ? fmtCoins(Math.max(0, left || 0)) : String(left || 0);
      var lines = [L("mimi", "か、買っちゃいました……！　はじめて、自分のコインで買った服ですっ！", "happy")];
      if ((left || 0) < (price || 0) * 0.3) {
        lines.push({ s: "mimi", t: "……お財布、のこり" + c + "コイン。{w:380}ほ、ほぼ、ぜんぶ使いました……！", e: "panic", fx: "shake" });
        lines.push(L("mimi", "で、でも、後悔はしてませんっ。……たぶん！", "smile"));
      } else {
        lines.push(L("mimi", "自分で買うと、着心地までちがう気がします〜。", "smile"));
      }
      return lines;
    },

    /* ③ ストーリー各話の導入（章を開いた時・1回だけ）------------------
       章ID→行の配列。行は [話者,セリフ,表情] の短縮形 か {s,t,e,fx,se,w} オブジェクト
       （fx=立ち絵アニメ shake/hop/nod/flash・{w:ms}=文中タメ・dialogue.js §normalize）。
       ★声表準拠（docs/NARRATIVE_DESIGN §2）＝決め台詞の単独行でなく、転のある掛け合いに。 */
    CHAPTER: {
      "1": [
        { s: "narrator", t: "聖龍レース場の入口。膝から崩れかけたミミの前に、木の腰掛けが差し込まれた。", bg: "images/bg/first_meeting_gate.webp" },
        { s: "sake", name: "腰掛けを出した女", t: "そこに座れ。丼まで落とすなよ。", e: "default" },
        { s: "mimi", t: "ど、丼……？　あ、あったかい。", e: "panic" },
        { s: "sake", name: "腰掛けを出した女", t: "まず食え。話は飲み込んでからだ。", e: "default" },
        // ★2026-11-23 16→11行に（ユーザー指摘「初回の楽しさが分かるまでに読む量が多すぎる」）。最初のレースを早く見せる。
        { s: "mimi", t: "……これ、あなたの分じゃないですか。", e: "default" },
        { s: "sake", name: "腰掛けを出した女", t: "鍋を見ろ。私一人であれを飲む気か。……名前は。", e: "smile" },
        { s: "mimi", t: "ミミです。お腹が鳴る前に、名乗ればよかった。", e: "default" },
        { s: "sake", t: "サケだ。そっちの挨拶の方がよく聞こえたぞ。", e: "smile" },
        { s: "narrator", t: "門を抜けた風に、出走表が一枚めくれた。ミミが押さえた紙の向こうで、竜の翼が開く。", bg: "images/bg/first_meeting_gate.webp", shot: "opening-race-pass" },
        { s: "mimi", t: "この名前の子たちが、飛ぶんですか。……紙より、ずっと大きい。", e: "default", bg: "images/bg/first_meeting_gate.webp", shot: "opening-race-pass" },
        { s: "sake", t: "見てこい。札を買うかは、見てから自分で決めろ。……戻ったら、どの竜が気になったか聞かせろ。", e: "smile", bg: "images/bg/first_meeting_gate.webp", shot: "opening-mimi-walk" }
      ],
      "2": [
        { s: "narrator", t: "夜市の端で、開いた手帳が風にあおられている。女が片手で頁を押さえ、もう片方で飛んだ鉛筆を追った。", bg: "images/bg/nightmarket.webp" },
        { s: "mizu", name: "手帳を押さえる女", t: "そこのあなた、右の角をお願い。今日の仕事が風に買い叩かれるわ。", e: "panic" },
        { s: "mimi", t: "ここですね。……丸をつけた竜なのに、横は空欄なんですか。", e: "default" },
        { s: "mizu", name: "手帳を押さえる女", t: "丸は、気になる値段という印。勝つと決めた印ではないの。", e: "think" },
        { s: "mimi", t: "じゃあ、空いてるところは。", e: "default" },
        { s: "mizu", name: "手帳を押さえる女", t: "まだ確かめていない走り。このコースで、あの脚がどこまで保つか。", e: "default" },
        { s: "mimi", t: "そこは、わからないままなんだ。", e: "default" },
        { s: "mizu", name: "手帳を押さえる女", t: "ええ。わからない欄まで埋めたら、立派な紙くずの完成よ。", e: "smile" },
        { s: "narrator", t: "鉛筆を拾った女は、手帳を閉じなかった。ミミの指の下には、何度も消した薄い跡が残っている。" },
        { s: "mizu", t: "ミズ・アオラ。丸だけ写していく人は多いけれど、空欄を聞いたのはあなたが初めて。", e: "smile" },
        { s: "mimi", t: "ミミです。紙の裏、少し借りていいですか。わたしのも分けてみたいです。", e: "default" },
        { s: "narrator", t: "ミミは紙の裏に線を引き、『見たこと』と『まだわからないこと』と書いた。" },
        { s: "mizu", t: "その左側を増やしていらっしゃい。オッズは皆の賭け札、あなたの目の代わりにはならないわ。", e: "default" },
        { s: "mimi", t: "読み違えた分も、持ってきていいですか。そっちは、たくさん書けそうで。", e: "panic" },
        { s: "mizu", t: "消さないで。同じ読み違いに二度払うのは損だし、私の見落としが見つかれば、こちらも得だもの。あはん。", e: "smile" },
        { s: "mimi", t: "じゃあ、この丸はまだつけません。見てから、またここへ来ます。", e: "smile" }
      ],
      "3": [
        { s: "narrator", t: "行政窓口。名前を書いたミミの鉛筆が、『相談したいこと』の小さな枠で止まった。", bg: "images/bg/office.webp" },
        { s: "sumika", name: "窓口の係員", t: "ミミ様。入りきらなければ、裏もお使いください。", e: "default" },
        { s: "mimi", t: "逆なんです。何から書けばいいか、決まらなくて。", e: "default" },
        { s: "sumika", name: "窓口の係員", t: "では、帰り道から伺いましょう。ここを出たあと、ひと息つける場所はございますか。", e: "default" },
        { s: "mimi", t: "増やす相談じゃなくても、いいですか。なくしたくないものを先に書いても。", e: "default" },
        { s: "sumika", name: "窓口の係員", t: "もちろんです。なくしてからでなければ相談できない窓口には、したくありません。", e: "serious" },
        { s: "narrator", t: "係員は申込書を脇へよけ、島の地図を広げた。折り目には、何度も継ぎ直した細い紙が貼ってある。" },
        { s: "sumika", t: "申し遅れました。スミカ・ラグナと申します。今日は買うものを決めず、お帰りになっても結構です。", e: "default" },
        { s: "mimi", t: "それ、先に聞けてよかったです。椅子に座ったら契約かと思いました。", e: "smile" },
        { s: "sumika", t: "その方式ですと、わたくしが毎日いちばん多く契約することになります。", e: "smile" },
        { s: "narrator", t: "スミカが地図に指を置いた。村の家々の横に、小さく『雨戸の修繕』と書き添えてある。" },
        { s: "mimi", t: "同じお金で、次の札も、雨戸の修理もできるんだ。……わたし、当たったら次はいくら張れるかって、先に考えちゃう。", e: "default" },
        { s: "sumika", t: "雨戸でしたら、次のレースを外した晩にも、ちゃんと閉まりますよ。", e: "default" },
        { s: "mimi", t: "そっか。外してしょんぼり帰っても、布団は乾いたままだ。……その欄、消さずに置いといてください。", e: "smile" },
        { s: "narrator", t: "小さく笑ったスミカは、相談用紙の端に『継続』と印を押した。金額の欄は空いたままだ。" },
        { s: "mimi", t: "まだ、何も決めてないのに。", e: "default" },
        { s: "sumika", t: "次に続きをお話しするための印です。決まらなかったことも、そのままお持ちください。", e: "default" },
        { s: "mimi", t: "なら、この地図を借りたいです。自分で歩いてから、どこに戻りたいか考えます。", e: "smile" },
        { s: "sumika", t: "お渡しできる写しがございます。……帰り道は、こちらも。", e: "default" },
        { s: "narrator", t: "スミカが余白に一本の道を足した。建物の説明とは違う、柔らかい鉛筆の線だった。" },
        { s: "mimi", t: "近道ですか。", e: "default" },
        { s: "sumika", t: "少し遠回りです。昼も日陰が続きますので、わたくしは好きなのです。", e: "smile" }
      ],
      get "4"() {
        var memory = "";
        if (typeof chapterRead === "function" && !chapterRead("4") && typeof chapterFourLifeStatus === "function") {
          var shared = chapterFourLifeStatus();
          if (shared.outing) {
            var opinion = { again: "また選びたい", different: "自分には別の方が合う", unsure: "まだ決められない" }[shared.outing.opinion];
            memory = "「" + shared.outing.experience.name + "」は" + opinion + "。アヤにそう話した帰り道。";
          } else if (shared.findings && typeof IslandDiscovery !== "undefined") {
            var finding = IslandDiscovery.describeDiscovery(IslandDiscovery.exportDiscoveries(state.player.islandDiscovery)[0]);
            if (finding) memory = "手帖の「" + finding.finding.title + "」を、誰かに見せてみたくなった。";
          }
        }
        return [
        { s: "narrator", t: memory ? memory + "配信小屋の前で、倒れかけた応援旗を支えた。竜の名前が表へ向く。カメラの灯は消えている。" : "場外の配信小屋。倒れかけた応援旗をミミが支えると、竜の名前が表へ向いた。カメラの灯は消えている。", bg: "images/bg/studio.webp" },
        { s: "makura", name: "機材を抱えた女", t: "助かった！　そこ、ずっと裏返しで映るとこだった。", e: "happy" },
        { s: "mimi", t: "名前が見えないのは、さみしいかなって。持つの、ここでいいですか。", e: "default" },
        { s: "makura", t: "ばっちり。あたしはマクラ。今の一言、もう一回聞きたいな。", e: "smile" },
        { s: "mimi", t: "ミミです。……もう撮ってます？", e: "panic" },
        { s: "makura", t: "まだ。声だけ録ってみない？　配信じゃなくて、ここで一緒に聞く練習。", e: "default" },
        { s: "mimi", t: "顔は映さないで、出す前には聞かせてください。それなら、やってみたいです。", e: "default" },
        { s: "makura", t: "了解。聞いて嫌なら消そう。カメラは旗へ、マイクだけこっち。", e: "smile" },
        { s: "narrator", t: "ミミがうなずいてから、録音の灯がついた。マクラは口を閉じ、旗の端を一緒に押さえた。" },
        { s: "mimi", t: "この子が勝つかは、まだわかりません。でも、次に走るとき、最後まで見ていたいです。", e: "default" },
        { s: "makura", t: "……はい、止めた。どうして最後まで？", e: "default" },
        { s: "mimi", t: "先頭じゃなくなったら、名前まで見えなくなるのは、いやなので。", e: "default" },
        { s: "makura", t: "そっか。あたし、先頭を追って旗までひっくり返してたな。", e: "default" },
        { s: "narrator", t: "再生した声は、思ったより小さかった。ミミは耳を押さえかけ、途中で手を下ろした。" },
        { s: "mimi", t: "もう一度いいですか。今度は名前から言いたいです。勝つって約束は、できないけど。", e: "default" },
        { s: "makura", t: "よし、二本目！　名前は一番前、息継ぎはそのあと！{w:300}……急がなくていい、合図はミミちゃんから。", e: "happy" },
        { s: "mimi", t: "はい。……今度は、わたしから始めます。", e: "smile" },
        { s: "narrator", t: "柵の向こうを竜たちが引き上げていく。旗の持ち主が一頭を追って叫んだ。「フガク！　あの登り、よく踏ん張ったなあ！」" },
        { s: "mimi", t: "……フガク。今のひと言で、わたしもあの坂を見たくなりました。", e: "smile" },
        { s: "makura", t: "ね。そこに来られなかった人にも、あの坂を見せられたらいいな。ミミちゃん、自分のスマホで撮ってみたい？", e: "default" },
        { s: "mimi", t: "まずは、お値段を聞いてからで……！　さっきの録音は、二人だけで聞く分ですよ。", e: "panic" },
        { s: "makura", t: "もちろん。録音はここまで。配信用のスマホのことは、あとであたしと相談しよ。", e: "smile" }
      ]; },
      get "5"() {
        var seen = typeof castStrangerSeen === "function" && castStrangerSeen();
        const memory = [], player = typeof state !== "undefined" && state.player;
        // The chapter has no dated snapshot. On a replay, today's diary may describe a later outing.
        if (player?.islandLife && !player.flags?._chapter_intro_5 && typeof IslandLifeLoop !== "undefined" && typeof MEALS !== "undefined") {
          const outings = IslandLifeLoop.normalize(player.islandLife);
            const replies = [outings.firstLocalMeal, outings.firstLocalStory, ...outings.history, ...Object.values(outings.conversations)]
            .filter(e => e?.experience?.kind === "meal" && e.completedRace <= (player.completedRaces || 0)
              && player.meals?.eaten?.[e.experience.id] === true)
            .sort((a, b) => Number(b.id.slice(7)) - Number(a.id.slice(7)));
          const reply = replies[0], dish = reply && MEALS.find(m => m.id === reply.experience.id);
          if (dish) {
            const lines = {
              again: ["また、これがいい", "次にあそこへ行ったら、もう一度あれを頼みたい。明日も火を入れてくれるつもりで、そう言ったんだ。"],
              different: ["わたしには、別の方が合いそう", "あのときは、次は何にしようって選べたんです。……灯りが消えてたら、献立の前で迷うこともできないんだ。"],
              unsure: ["まだ、決めないでおく", "もう少し考えて、また覗きに行けばいいって思ってました。次に行ったとき、灯りが消えてるかもしれないなんて。"]
            }[reply.opinion];
            memory.push({ s: "narrator", t: "ミミは自分の手帖を開いた。食べた「" + dish.name + "」の欄に、アヤに返したひと言がある。「" + lines[0] + "」。" },
              { s: "mimi", t: lines[1], e: "default" });
          }
        }
        return [
          { s: "narrator", t: "石段を上がりきり、ミミは膝に手をついた。手帳を開いていた先客が大きなリュックをずらし、隣を空ける。", bg: "images/bg/shrine.webp" },
          { s: "mimi", t: "あ、座ってもいいですか。ここまで来るだけで、お腹が……。", e: "default" },
          { s: "celestia", name: seen ? "あのお姉さん" : "旅の人", t: "どうぞ、下の屋台まで見える席だよ。眺めていると、余計にお腹がすいちゃうけどね。", e: "smile" },
          { s: "mimi", t: seen ? "前に、お名前を聞きそびれたままでしたね。今日は、教えてもらえますか。" : "ここから、ずっと眺めていたんですか。わたし、ミミといいます。", e: "default" },
          { s: "celestia", t: seen ? "うん。名前、まだだったね。セレスティア・ブラックメテオ。" : "セレスティア・ブラックメテオ。旅の途中で、少し長居しているんだ。", e: "smile" },
          { s: "mimi", t: "この頁だけ、何も書いてないんですね。", e: "default" },
          { s: "celestia", t: "もうない賭場の頁。何を書こうか迷って、そのままにしてしまったの。", e: "sad" },
          { s: "narrator", t: "セレスティアは折れた紙の角を、指でゆっくり伸ばした。下のレース場から、いくつもの声が届く。" },
          { s: "mimi", t: "……ここも、そうなるんですか。", e: "default" },
          { s: "celestia", t: "わたしには、勝つ竜が視える。答えを伝えると、みんなの札が同じ方を向くんだ。", e: "serious" },
          { s: "narrator", t: "下の馬場で、夕方の組が門に並んだ。石段の手すり越しに、一人の客が「今日は誰が先に帰ってくる？」と声をかけた。" },
          { s: "celestia", t: "この組なら、ライオウ。……ほら、今の人がもう窓口に着いた。", e: "default" },
          { s: "narrator", t: "「ライオウの単勝、一枚」「こっちもライオウ」。掲示板の同じ欄に札が重なった。やがて門が開き、雷を引く翼が最初に線を越えた。" },
          { s: "mimi", t: "……ほんとに、一着。あれだけ札が売れたら、窓口の人も助かるんじゃ……？", e: "default" },
          { s: "narrator", t: "払い戻しを待つ列は、さっき券を買った列とほとんど同じ長さだった。窓口から「明日の灯油、何缶頼む？」と声がした。「待って。払い戻して、いくら残るか見てから」" },
          { s: "mimi", t: "買った人に戻る分も、あの箱の中なんだ。札がたくさんあるのと、明日の灯りがつくのは、別なんですね。", e: "default" },
          { s: "celestia", t: "前の賭場でも、最初はそんな夕方だった。最後に消えたのは、奥の店の灯り。あそこ、夜も開けてくれてたのに。", e: "sad" },
          ...memory,
          { s: "mimi", t: "その、なくなった賭場で。何を食べたんですか。", e: "default" },
          { s: "celestia", t: "……食べたもの？　熱いスープを。店の人が、冷めるまで隣に座っていたっけ。", e: "default" },
          { s: "mimi", t: "それなら、最初の一行は書けますね。賭場の答えじゃなくて、その人のこと。", e: "default" },
          { s: "narrator", t: "手帳の上で鉛筆が止まった。それから、白かった頁に小さな文字が並び始めた。" },
          { s: "celestia", t: "この一行が増えても、次の勝者は変わらないよ。……それでも、この島の話を続けたい？", e: "default", react: [{ s: "mimi", e: "panic" }] },
          { s: "mimi", t: "はい。まだ、書きたいことがあります。下へ降りませんか。お店の灯りが、見えるうちに。", e: "smile" }
        ];
      },
      "ED": [
        { s: "mimi", t: "ふー……。走って、賭けて、食べて。……ぜんぶ、やりきった！", e: "happy", fx: "hop", bg: "images/bg/home_room.webp" },
        { s: "mimi", t: "ここまで来られたのは——みんなの、おかげです。", e: "smile" }
      ]
    },
    chapterIntro: function (ch, cast) {
      var pre = ch && DLG.CHAPTER[ch.id];
      if (pre) return pre.map(function (x) { return Array.isArray(x) ? L(x[0], x[1], x[2]) : x; });
      var who = (cast && cast.key) || "narrator";
      return [L(who, "第" + (ch ? ch.id : "?") + "話「" + (ch ? ch.title : "") + "」"), L("mimi", "……いよいよ、この話だね。", "default")];
    },

    /* ④ ログイン挨拶（その日/セッション初回・節目ボーナスが無い時）------ */
    login: function (p) {
      var h = (new Date()).getHours();
      var hello = (h < 5) ? "こんな時間まで……無理は禁物だよ？"
        : (h < 11) ? "おはようございます！"
        : (h < 17) ? "こんにちは！"
        : (h < 22) ? "こんばんは！"
        : "夜ふかしさん、ようこそ。";
      var body = ["競竜場へようこそ、ミミです！", "いい賭け、見つけられるかな……っ！", "さあ、運命の竜に会いにいこ！"];   // 「今日も」は初回起動で不自然だったので外した
      return [L("mimi", hello + " " + pick(body, h), "smile")];
    },

    /* ⑤' 最後のコインを全部賭けたとき（2026-11-13）。ランク1は賭金の上限が100なので、「のこり100を全部賭ける」は
       大勝負（賭金500以上）に入らず、いちばん貧乏な勝負どころでミミが何も言わなかった。
       w＝賭けた額（＝それまでの全財産）。n＝これまでに無心した回数（回数で言い方が変わる）。ミミは反応するだけ。 */
    preRaceAllIn: function (bet, n) {
      var w = (bet && bet.wager) || 0;
      var c = (typeof fmtCoins === "function") ? fmtCoins(w) : String(w);
      var sets = [
        [{ s: "mimi", t: "こ、これが、最後の" + c + "コインです……っ。", e: "panic" }, L("mimi", "お願い……当たって……！", "default")],
        [{ s: "mimi", t: "お財布、これで、からっぽです……！", e: "panic" }, L("mimi", "竜さん、たのみますっ……！", "default")],
        [{ s: "mimi", t: "ぜ、全財産です。……ぜんぶ、です。", e: "panic" }, L("mimi", "い、いきますっ！", "happy")]
      ];
      return sets[(n || 0) % sets.length];
    },

    /* ⑤" この一戦で財布が空になったときの、結果画面のミミの一言（2026-11-13）。n＝これまでに無心した回数。
       いつもの外れの感想（recap_engine.js buildMimiRecap）は財布を見ていないので、すっからかんになった一戦でも
       「今日のは読めないって。」のような、ふつうの外れと同じ一言だった。ミミは反応するだけ。 */
    bustLine: function (n) {
      if (!n) return "……あれ。お財布、からっぽです。……からっぽ、ですね……？";
      if (n === 1) return "ま、また、からっぽに……。が、学習しないうさぎで、すみません……っ。";
      var more = [
        "ぜ、ぜんぶ竜に預けました。……返ってきませんでした。",
        "お財布をふっても、音がしません……。ちゃりん、とも……。",
        "お財布さん……また、しばらく会えませんね……。"
      ];
      return more[(n - 2) % more.length];
    },

    /* ⑤ レース直前の煽り（出走の瞬間・短く）-------------------------- */
    preRace: function (race, bet) {
      var w = (bet && bet.wager) || 0;
      // 大勝負は3通り（走った数で回す）。以前は1通りだけで、大きく張る人は毎回同じ二言を送っていた。
      if (w >= 500) {
        var big = [
          [L("mimi", "大勝負……！ 心臓が口から出そう。", "panic"), L("mimi", "でも、いくっ！", "happy")],
          [L("mimi", "こ、こんなに賭けちゃいました……！", "panic"), L("mimi", "も、もう千切っちゃったので、いきますっ！", "happy")],
          [L("mimi", "手が、ふるえてます……っ。", "panic"), L("mimi", "お願い、走って……！", "default")]
        ];
        var n = 0; try { n = (state.player.completedRaces || 0); } catch (e) {}
        return big[n % big.length];
      }
      var sets = [
        [L("mimi", "いっけぇ〜っ！", "happy")],
        [L("announcer", "さあ、出走の刻ですっ！"), L("mimi", "たのむよ、相棒〜！", "happy")],
        [L("mimi", "どきどき……当たれ、当たれっ！", "default")],
        [L("mimi", "この一戦、見せてもらうよ！", "happy")]
      ];
      return pick(sets, w + ((race && race.rank) || 0));
    }
  };

  global.DLG = DLG;

  // 顧問のフル立ち絵をVNセリフに登録。★表情オブジェクト形式（NARRATIVE_DESIGN §4）＝
  // stand/<k>_<expr>.webp を置くだけで自動で表情差分が効く（欠損は default→絵文字へ多段フォールバック）。
  // 生成すべき表情の一覧と指示は docs/CAST_ART_BRIEF.md。
  if (global.Dialogue && global.Dialogue.registerCast) {
    ["sake", "mizu", "sumika", "makura", "celestia"].forEach(function (k) {
      var base = "images/cast/stand/" + k;
      global.Dialogue.registerCast(k, { img: {
        default: base + ".webp",
        smile: base + "_smile.webp",
        happy: base + "_happy.webp",
        panic: base + "_panic.webp",
        think: base + "_think.webp",       // ミズ思案 ほか（CAST_ART_BRIEF §1・欠損はdefaultへFB）
        serious: base + "_serious.webp",   // スミカ眼光・セレスティア神性
        sad: base + "_sad.webp"            // セレスティア憂い
      } });
    });
  }
})(window);
