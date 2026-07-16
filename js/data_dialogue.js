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
      leonmall:   "もこもこニット、ふわっふわ〜。モールいこ！"
    },
    outfit: function (o) {
      var line = (o && DLG.OUTFIT[o.id]) || (((o && o.name) || "新しい服") + "に着替えた！ どうかな？");
      return [L("mimi", line, "happy")];
    },

    /* ③ ストーリー各話の導入（章を開いた時・1回だけ）------------------
       章ID→[ [話者,セリフ,表情], ... ]。話者は STORY_CAST のキー or mimi/narrator。 */
    CHAPTER: {
      "1":  [["sake", "うぐぐ……生きとるな。まず食え、話はそれからだ。"], ["mimi", "た、助けて……くれるんですか？", "panic"]],
      "2":  [["mizu", "人気と価値は別物よ、あはん。教えてあげる。"], ["mimi", "市場を読む目……わたしにも、わかるかな。", "default"]],
      "3":  [["sumika", "ミミ様、再起の土台は生活です。背筋を伸ばして。"], ["mimi", "住む場所から、立て直すんですね。", "smile"]],
      "4":  [["makura", "その熱、観客に届けな！ ショーの時間だぜ？"], ["mimi", "わたしの声で……みんなを沸かせる！", "happy"]],
      "5":  [["celestia", "勝つ竜の名を知っても、価値が残るとは限らない。"], ["mimi", "世界は……こんなに広かったんだ。", "default"]],
      "ED": [["mimi", "ここまで来られたのは、みんなのおかげです。", "happy"]]
    },
    chapterIntro: function (ch, cast) {
      var pre = ch && DLG.CHAPTER[ch.id];
      if (pre) return pre.map(function (x) { return L(x[0], x[1], x[2]); });
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
        panic: base + "_panic.webp"
      } });
    });
  }
})(window);
