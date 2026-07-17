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

    /* ③ ストーリー各話の導入（章を開いた時・1回だけ）------------------
       章ID→行の配列。行は [話者,セリフ,表情] の短縮形 か {s,t,e,fx,se,w} オブジェクト
       （fx=立ち絵アニメ shake/hop/nod/flash・{w:ms}=文中タメ・dialogue.js §normalize）。
       ★声表準拠（docs/NARRATIVE_DESIGN §2）＝決め台詞の単独行でなく、転のある掛け合いに。 */
    CHAPTER: {
      "1": [
        { s: "narrator", t: "レース場裏の路地。破産したてのうさ耳が、段ボールの上で行き倒れている。" },
        { s: "sake", t: "おい。……生きてるか。死んでるなら、片すぞ。" },
        { s: "mimi", t: "い、生きてますっ！　生きてますけど、無一文です……！", e: "panic", fx: "shake" },
        { s: "sake", t: "なら、まず食え。{w:420}……話は、その後だ。" },
        { s: "mimi", t: "（こわい人だ……。でもこの串焼き、あったかい……）", e: "default" }
      ],
      "2": [
        { s: "mizu", t: "ねえ。あなたが昨日握りつぶした8.2倍、あれ、いくらの価値があったと思う？", bg: "images/bg/nightmarket.webp" },
        { s: "mimi", t: "え……む、むずかしい話ですか？　わたし、算数は食べ物の値段しか……", e: "panic" },
        { s: "mizu", t: "ふふ、その顔が見たかったのよ、あはん。{w:420}——人気と価値は、別物。ここから先は、それがわかる子だけ儲かるの。" },
        { s: "mimi", t: "（お金の話なのに……なんだろう、ちょっとわくわくしてる。）", e: "default" }
      ],
      "3": [
        { s: "sumika", t: "ミミ様。本日、届け出が2件ございます。……1件は住所不定の是正勧告。もう1件は——わたくしからの、お願いです。", bg: "images/bg/office.webp" },
        { s: "mimi", t: "こ、この島、路上生活にも書類がいるんだ……。", e: "panic" },
        { s: "sumika", t: "賭けは水物。ですが、屋根と食事は裏切りません。{w:380}……まず、住むところから整えましょう。" },
        { s: "mimi", t: "はいっ。……あの、ちなみに家賃って、おいくらですか？", e: "default" }
      ],
      "4": [
        { s: "makura", t: "見ーつけた！　場外で予想を叫んでた耳の子！　あんた声いいね、マイク持ったことある？", bg: "images/bg/studio.webp" },
        { s: "mimi", t: "えっ、な、ないですけど……！", e: "panic" },
        { s: "makura", t: "よし採用、今から初配信。噛んだら一生アーカイブに残るからね。{w:420}……嘘。残るのは3日。" },
        { s: "mimi", t: "3日も残るんですか！？", e: "panic", fx: "hop" }
      ],
      "5": [
        { s: "celestia", t: "いい眺めでしょう、ここ。島でいちばん、レース場が星に近い席。", bg: "images/bg/shrine.webp" },
        { s: "mimi", t: "あ……！　あなたは、あのときの……。", e: "panic" },
        { s: "celestia", t: "ええ。今度こそ、名乗るわ。{w:500}——セレスティア。勝つ竜の名前が視えてしまう、つまらない女よ。" },
        { s: "mimi", t: "（星空のドレス……やっぱり、あの夜のお姉さんだ。）", e: "default" }
      ],
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
      var body = ["競竜場へようこそ、ミミです！", "今日も、いい賭けを見つけましょ♪", "さあ、運命の竜に会いにいこ！"];
      return [L("mimi", hello + " " + pick(body, h), "smile")];
    },

    /* ⑤ レース直前の煽り（出走の瞬間・短く）-------------------------- */
    preRace: function (race, bet) {
      var w = (bet && bet.wager) || 0;
      if (w >= 500) return [L("mimi", "大勝負……！ 心臓が口から出そう。", "panic"), L("mimi", "でも、いくっ！", "happy")];
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
