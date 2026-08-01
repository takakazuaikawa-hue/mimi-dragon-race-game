/**
 * event_registry.js — all event registrations.
 *
 * Pure data, no system logic. Add new dialogue / story beats here. Groups
 * are organised by spec phase so the file maps 1:1 to §10 §11 (Story Scope
 * by Development Phase).
 *
 * EXTENSION POINT — adding a new event:
 *   registerEvent({
 *     id: "unique_string",
 *     hook: "<one of eventHooks keys>",
 *     condition: { once?, raceId?, region?, weather?, rankAtLeast?, betType?,
 *                  tag?, requiredFlag?, forbiddenFlag?, test?(ctx) },
 *     priority: <number, default 0; higher fires first>,
 *     actions: [
 *       { type: "dialogue" | "tutorial_message" | "panyu_message" |
 *               "system_message" | "coin_rescue" | "rank_unlock_note",
 *         speaker: "mimi" | "sake_udada" | "announcer" | "system" |
 *                  "dragon_villager",
 *         text: "..." | (ctx) => "..." }
 *     ],
 *     effects: { setFlags: { flagName: true } }    // optional
 *   });
 *
 * Sections below correspond to spec phases. Append within the matching block.
 */

// =========================================================================
// ★ キャラクターの役割と声（追加・編集時も厳守）
//   ミミ(mimi)        … 来訪者(転生者)。世界の競竜/市場/生活の“常識を説明する側”では
//                       ない。反応・驚き・質問・学びを担う（「〜です/ます」「〜っ！」）。
//                       コース/分析/生活の断定・講釈はさせない。
//   サケ・ウダダ(sake_udada) … コースの説明＝馬場/地域/距離/脚質/竜の見方＋賭けのルール
//                       （「〜だ」「〜しろ」。息・気配・現場）。
//   ミズ(mizu)        … 分析情報＝オッズ/人気/期待値/価値/市場の歪み（「〜わ」「あはん」）。
//   スミカ(sumika)    … 生活情報＝住居/食事/施設/総資産/村の立て直し（「ミミ様」「〜です/ください」）。
//   マクラ(makura)=観客/実況/熱狂、セレスティア(celestia)=価値/淘汰/世界の天井。
// =========================================================================

// ===== V1 sample events (§14 §25 + §10 §11 "V1") =====

// ★D1/D2解消＋do-then-explain（NARRATIVE_DESIGN P2）：講義をやめ「まず賭けさせる」。
//   賭式のルール定義はここから撤去し、各賭式の初選択時チュートリアル（beforeBet・下の3本）に分割。
registerEvent({
  id: "first_race_intro_mimi",
  hook: "beforeRaceSelect",
  condition: { once: true },
  priority: 10,
  actions: [
    { type: "tutorial_message", speaker: "mimi", expr: "panic",
      text: "レース場、ひろ……ひろい！　どこ見たらいいの、これ……サケさん、助けて！" },
    { type: "tutorial_message", speaker: "sake_udada",
      text: "講義はしない。まず一回、好きな竜に賭けてこい。……話は、その後だ。" }
  ]
});

// ★ミズのオッズ講釈は上から分離（元は first_race_intro_mimi の3行目）。
//   同居のままだと、ミミ＋サケは初回から登場済み＝イベントが発火して once を消費し、
//   未登場のミズの行だけが落ちて「二度と出ない」。第2話を読んだ後の初レース選択で出す。
registerEvent({
  id: "first_race_intro_mizu",
  hook: "beforeRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_2" },
  priority: 9,
  actions: [
    { type: "tutorial_message", speaker: "mizu",
      text: "そしてオッズは勝率ではないわ、あはん。人気と価値を、分けて見ることね。" }
  ]
});

// （旧 first_race_intro＝afterRaceSelect の二重intro は D1 で削除：上の intro_mimi に一本化）

registerEvent({
  id: "sake_overbet_favorite_warning",
  hook: "afterEntryList",
  condition: { once: true, raceId: "race_grandclock_1" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "前で勝った竜は、買われる。……今日のコースに合うかは、別の話だ。" }
  ]
});

// ★D2：賭式のルールは「その賭式を初めて選んだ瞬間」に1回だけ（分割投与・P8）。
registerEvent({
  id: "first_win_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "win" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "単竜。1着を当てる、いちばん熱い札だ。……信じた一頭に、まっすぐ張れ。" }
  ]
});
registerEvent({
  id: "first_place_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "place" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "複竜は3着以内に入れば当たり。配当は薄いが、飯代は守れる。" }
  ]
});
registerEvent({
  id: "first_wide_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "wide" },
  actions: [
    { type: "tutorial_message", speaker: "sake_udada",
      text: "ワイド竜は、選んだ2頭がどっちも3着以内なら当たり。……穴を拾う時に効く。" }
  ]
});

registerEvent({
  id: "mimi_strong_wind_first",
  hook: "afterRaceSelect",
  condition: { once: true, weather: "strong_wind" },
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "panic",
      text: "強風です……耳が横に持っていかれますっ！" },
    { type: "dialogue", speaker: "sake_udada",
      text: "こういう日は翼の強さだけじゃない。風に煽られても、気性で立て直せる竜を見ろ。" }
  ]
});

registerEvent({
  id: "panyu_after_tense_preview",
  hook: "afterDragonPreview",
  condition: { once: false, tag: "tense_race" },
  actions: [
    { type: "panyu_message", speaker: "mimi", text: "ぱほぱほ！ 場が和んだ！" }
  ]
});

// ★D3解消：毎レースの hit/miss VN は削除。リアクションは結果画面のミミ講評（recap_engine の
//   buildMimiRecap＝声表準拠の池）が一手に担う。VNの割り込み（二重リアクション）を根絶。

registerEvent({
  id: "first_bankruptcy_rescue",
  hook: "onBankruptcy",
  condition: { once: false },
  // §38 — 自動支給はやめ、ホームの「無心する」ボタンから受け取る方式に変更。
  // （rescue の額・計算は不変。受け取り方を“無心”の演出にしただけ。）
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ミミ、コインが尽きたな。…まだ終わりじゃない。ホームで『無心する』んだ。村のみんなが、基準額をそっと握らせてくれるさ。" }
  ]
});

registerEvent({
  id: "rank_up_celebration",
  hook: "onRankUp",
  condition: { once: false },
  actions: [
    // ★声表準拠（ミミ＝短文の畳みかけ→一拍→飯に着地。自分に「おめでとう」と言わせない・システム文の読み上げ禁止）
    // ★実機プレイ指摘（2026-08-02）：ランクは3本レール（実力/皆勤/大勝）なので**全敗でも上がる**のが正常。
    //   その時に「うそ！行けちゃう？」と喜ぶのは実績と噛み合わず違和感。台詞が戦績を見て分岐する。
    //   全敗昇格＝喜びでなく「場数を踏んだ手応え」のテンションで（ユーザー言「慣れてきたな、ミミ」）。
    { type: "dialogue", speaker: "mimi", e: "happy",
      text: function () {
        const w = (state.player && state.player.wins) || 0;
        if (w === 0) return "上のクラス……勝ってないのに？　……ううん、場数だ。走った数だけ、慣れてきたんだ。……ごはん食べて、次いこ。";
        return "え、うそ、上のクラス……行ける？ 行けちゃう？　……よし、行く前に腹ごしらえ！";
      } }
  ]
});

// ★序盤の連敗ケア（2026-08-02・実機プレイ指摘「序盤に負け続けるとプレイヤーが苦しい。
//   ほめたり解説したり励ましたり、複勝やワイドを勧める必要がある」）。
//   既存「連敗の夜」(g5_losing_night) は第4話後＋ミズの門番つき＝序盤には出ない。
//   これは**最初から会っているサケ**が3連敗（未勝利）で一度だけ言う。
//   賭式の推奨は会話のみ＝レース数値・オッズ・配当に非干渉。
registerEvent({
  id: "early_losing_care",
  hook: "afterRaceResult",
  condition: { once: true,
    test: ctx => ((state.player && state.player.missRun) || 0) >= 3
               && ((state.player && state.player.wins) || 0) === 0 },
  priority: 7,
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "3連敗か。……いい経験しているな、ミミ。外した数だけ、竜の見方は増える。" },
    { type: "dialogue", speaker: "mimi", expr: "sad",
      text: "でも師匠、お財布が……単勝、ぜんぜん当たらないです……。" },
    { type: "dialogue", speaker: "sake_udada",
      text: "単勝は一番むずかしい賭式だ。1着をぴたりと当てるんだからな。……まずは複勝でいい。3着までに入れば拾える。" },
    { type: "dialogue", speaker: "sake_udada",
      text: "ワイドもいいぞ。2頭選んで、両方が3着以内なら的中だ。当てる感覚を体に入れてから、単勝に戻ってこい。" },
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "拾い方から、覚える……。よし、次は複勝でいってみます！" }
  ]
});

registerEvent({
  id: "milestone_10k",
  hook: "onMilestone",
  condition: { once: true, test: ctx => ctx && ctx.kind === "coins_10000" },
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "1万コイン……！ わたし、ここまで来られたんだ。よーし、もっと上を目指すぞっ！" }
  ]
});
registerEvent({
  id: "milestone_100m",
  hook: "onMilestone",
  condition: { once: true, test: ctx => ctx && ctx.kind === "coins_100000000" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "1億コインか…ここまで来ると、もう村の主だな。神兎大レースも見えてくる頃合いだ。" }
  ]
});
registerEvent({
  id: "milestone_first_wide_hit",
  hook: "onMilestone",
  condition: { once: true, test: ctx => ctx && ctx.kind === "first_wide_hit" },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "初ワイド竜的中、見事だ。本命と穴の組合せで勝つのが、この賭けの妙味だ。" }
  ]
});

// ===== §10 Phase 2: More reactions / Region first-visit / Bet tutorials =====

// 8 region first-visit comments.
registerEvent({
  id: "first_visit_grand_clock",
  hook: "afterRaceSelect",
  condition: { once: true, region: "グランドクロック地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "グランドクロック地域だ。竜レースの基本を学ぶ場所。時計塔の下で、まずは予想を組み立てる癖をつけよう。" }]
});
registerEvent({
  id: "first_visit_lumina",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ルミナ地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ルミナだ。空が広く、風が強い。翼の安定した竜でないと、ここでは流される。" }]
});
registerEvent({
  id: "first_visit_ring_rosso",
  hook: "afterRaceSelect",
  condition: { once: true, region: "リングロッソ地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "リングロッソ。回転と気性の世界だ。スピードだけじゃ勝てん。" }]
});
registerEvent({
  id: "first_visit_caldera",
  hook: "afterRaceSelect",
  condition: { once: true, region: "カルデラ地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "カルデラだ。熱気で火力自慢が人気を集めるが、最後までスタミナが保つかを見極めろ。" }]
});
registerEvent({
  id: "first_visit_mistlake",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ミストレイク地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ミストレイク。視界が悪い時こそ、気性と回転で走れる竜が活きる。" }]
});
registerEvent({
  id: "first_visit_vento",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ヴェント峡谷地域" },
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "ヴェント峡谷だ。崖から風が吹き上がる。翼性能が、そのまま順位に出る。" }]
});
registerEvent({
  id: "first_visit_notte",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ノッテムーンライト地域" },
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "ノッテムーンライト。夜は観客が興奮し、人気が偏るわ、あはん。市場の熱を冷ましてから、値を読みなさい。" }]
});
registerEvent({
  id: "first_visit_lapan",
  hook: "afterRaceSelect",
  condition: { once: true, region: "ラパン祭典地域" },
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "ラパン祭典地域。祭りの熱気がオッズを大きく歪めるわ、あはん。歪みこそ、価値の在り処よ。" }]
});

// Bet type tutorials (win/place; wide already in V1 block).
registerEvent({
  id: "first_win_bet_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "win" },
  actions: [{ type: "tutorial_message", speaker: "sake_udada",
    text: "単竜は一着を当てる賭けだ。自信がある時は強いが、迷うなら複竜やワイド竜も見ろ。" }]
});
registerEvent({
  id: "first_place_bet_tutorial",
  hook: "beforeBet",
  condition: { once: true, betType: "place" },
  actions: [{ type: "tutorial_message", speaker: "sake_udada",
    text: "複竜は、選んだ竜が3着以内に入れば的中だ。配当は低いが、堅実に拾いたい時に効く。" }]
});

// Race result reactions (upset / favorite-holds).
registerEvent({
  id: "sake_upset_comment",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank >= 5 },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "波乱ね、あはん。市場が見落とした価値が、いま顕れたのよ。こういう一戦を拾える者が、勝ち残るの。" }]
});
registerEvent({
  id: "sake_favorite_holds",
  hook: "afterRaceResult",
  condition: { test: ctx => ctx && ctx.popularityRank === 1 && ctx.hit },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "順当な決着ね。人気を素直に買うのも、立派な投資よ。あはん。" }]
});

// ===== §10 Phase 3: Crybaby dragon (Poro) story + Village reactions =====

// ★ポロの門番＝poroFound()（単勝2勝目の発見アーク）が唯一。話者ゲート（顧問＝advisorMet）では塞げない：
//   下の3イベントは speaker が mimi/sake＝常時OKなのに、本文でポロを名指ししているため。
//   さらに poro は ORIGINAL_8＝全レースの既定出走表に居るので、ゲート無しだと「初レースの出走表」で
//   いきなり「泣き虫竜ポロちゃん」と出て、発見アークの命名オチが潰れる（once も空撃ちで消費）。
//   poro.js は event_registry.js より後に読み込まれるため typeof で確認し、判定不能なら出さない側に倒す。
function poroKnownForEvents() {
  try { return (typeof poroFound === "function") && !!poroFound(); } catch (e) { return false; }
}

registerEvent({
  id: "poro_first_sight",
  hook: "afterEntryList",
  condition: {
    once: true,
    test: ctx => poroKnownForEvents() && ctx && ctx.race && getRaceDragonIds(ctx.race).includes("poro")
  },
  actions: [{ type: "dialogue", speaker: "mimi", expr: "default",
    text: "あ……泣き虫竜ポロちゃん。泣いてるのに……足音は、落ち着いてる気がする。気のせい、かなあ。" }]
});

registerEvent({
  id: "poro_condition_unlock",
  hook: "afterRaceAnalysis",
  condition: {
    once: true,
    test: ctx => poroKnownForEvents() &&
      state.player.collection.poro && state.player.collection.poro.records.racesSeen >= 3
  },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "ポロを3戦見たな。泣いているように見えるが、気性は安定している。複勝・ワイドで穴を拾うなら、覚えておけ。" },
    { type: "tutorial_message", speaker: "mimi", expr: "default",
      text: "……そっか。見た目じゃなくて、足音と試走を見るんですね。ひとつ、おぼえました。" }
  ]
});

registerEvent({
  id: "poro_first_place",
  hook: "afterRaceResult",
  condition: {
    once: true,
    test: ctx => poroKnownForEvents() && ctx && state.current && state.current.raceResult &&
      state.current.raceResult.entries.slice(0,3).some(e => e.dragon.id === "poro")
  },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "mimi",
    text: "ポロちゃん、3着以内に入った……！ 泣いてても走れる、ちゃんと走れるんだね……ぐすっ。" }]
});

// ★称号入りに書き換え（2026-08-01・ユーザー決裁）。昇格の演出はこのVN1本に一本化する
//   （別にカットインを重ねると、昇格のたびにVN→カットインの二重になる）。
//   ★旧称「村レベル」が残っていたのも修正＝用語は「暮らしレベル」に一本化済み。
//   ★称号（LIVING_RANKS）こそ「いまどんな暮らしをしているか」を伝える言葉なので、
//     数字ではなく称号を言わせる。声表：スミカ＝丁寧語・呼称「ミミ様」。
function _lvTitle(ctx) {
  try {
    const lv = (ctx && ctx.newLevel) ||
      (state.player && ((state.player.village && state.player.village.level) || state.player.villageLevel));
    if (!lv) return null;
    const rk = (typeof LIVING_RANKS !== "undefined") ? LIVING_RANKS[lv - 1] : null;
    return { lv: lv, title: rk ? rk.title : null };
  } catch (e) { return null; }
}
registerEvent({
  id: "village_first_levelup",
  hook: "onVillageUpdate",
  condition: { once: true },
  priority: 5,
  actions: [{ type: "dialogue", speaker: "sumika",
    text: ctx => {
      const t = _lvTitle(ctx);
      return (t && t.title)
        ? `ミミ様、暮らしが一段あがりました。いまのミミ様は「${t.title}」です。……胸を張ってよろしいかと。`
        : "ミミ様、暮らしが一段あがりました。生活の土台が、着実に。";
    } }]
});
registerEvent({
  id: "village_levelup_generic",
  hook: "onVillageUpdate",
  condition: { once: false },
  actions: [{ type: "dialogue", speaker: "sumika",
    text: ctx => {
      const t = _lvTitle(ctx);
      if (t && t.title) return `ミミ様、暮らしレベルが ${t.lv}「${t.title}」に上がりました。賭金の上限と救済の基準も上がります。`;
      if (t) return `ミミ様、暮らしレベルが ${t.lv} に上がりました。賭金の上限と救済の基準も上がります。`;
      return "ミミ様、暮らしが一段、育ちました。賭金の上限と救済の基準も上がります。";
    } }]
});

// ===== §10 Phase 4: Rank intros + Major rival intros =====

registerEvent({
  id: "rank4_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 4, test: ctx => ctx && ctx.race && ctx.race.rank === 4 },
  priority: 8,
  // ★D4：教訓の変奏をやめ「別の転」に書き分け（4=群衆／5=ミズの妙味／6=祭りの空気）。声表準拠。
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "……客の声、聞こえるか。ああいう日は竜より先に、財布のほうが熱くなる。" }]
});
registerEvent({
  id: "rank5_first_intro",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 5, test: ctx => ctx && ctx.race && ctx.race.rank === 5 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "mizu",
    text: "竜王杯ね。桁が増えると、みんな急に“名前”で買い始めるの。……名前は走らないのに。ほら、妙味の匂いがしてきた。" }]
});
registerEvent({
  id: "rank6_first_intro_festival",
  hook: "afterRaceSelect",
  condition: { once: true, rankAtLeast: 6, test: ctx => ctx && ctx.race && ctx.race.rank === 6 },
  priority: 8,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "祝祭級だ。……この太鼓の音はな、竜の脚も客の財布も軽くする。浮つくなよ。浮ついた金がいちばん旨いのは、胴元だ。" }]
});
registerEvent({
  id: "rank7_first_intro_shinto",
  hook: "afterRaceSelect",
  condition: { once: true, raceId: "race_lapan_shinto_grand" },
  priority: 10,
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "神兎大レース……竜レース界の、頂点。こんな場所に、わたしが立てるなんて……！" },
    { type: "dialogue", speaker: "sake_udada",
      text: "長距離マラソン、最高峰の竜たち、観衆の熱狂だ。ここまで来たなら、胸を張れ。" }
  ]
});
// ★ミズの行は分離（元は rank7_first_intro_shinto の3行目）。同居のままだと、物語を飛ばして
//   第2話未読のまま神兎大レースへ来た人は「ミミ＋サケだけ出て once 消費」or「イベント全体が持ち越し」に
//   なる。分離すれば、ミミ/サケは頂点の瞬間に喋り、ミズは出会った後の同レースでちゃんと喋る。
registerEvent({
  id: "rank7_first_intro_shinto_mizu",
  hook: "afterRaceSelect",
  condition: { once: true, raceId: "race_lapan_shinto_grand" },
  priority: 9,
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: "妙味は巨額の配当よ、あはん。市場のハイプを冷静に剥がせる者だけが、残るの。" }
  ]
});

registerEvent({
  id: "rival_intro_phenix",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("phenix") },
  priority: 7,
  actions: [
    { type: "dialogue", speaker: "mimi", expr: "happy",
      text: "鳳凰竜フェニックス……！ 黄金の翼の、伝説の竜さん。わぁ、観客が大歓声ですっ！" }
  ]
});
// ★ミズの行は分離（元は rival_intro_phenix の2行目）。フェニックス初出走はランク4＝総資産は足りるが、
//   _chapter_intro_2 は「物語を実際に読んだ」フラグなので、物語を飛ばした人はミズ未登場のまま到達しうる。
//   同居のままだとミミの行だけ出て once を消費し、ミズの講釈が二度と出なくなる。
registerEvent({
  id: "rival_intro_phenix_mizu",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("phenix") },
  priority: 6,   // ミミの行(7)の直後。同点の raika/stella/glaze より先に登録＝並び順は維持。
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: "ただし市場は本命視しすぎるわ、あはん。これだけ買われて、まだ値ごろ……？ 期待値を疑いなさい。" }
  ]
});
registerEvent({
  id: "rival_intro_raika",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("raika") },
  priority: 6,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "雷角竜ライカ。電光石火の逃げ脚だが、気性が荒い。ハイペースを作るが、自分も終盤で苦しくなる。" }]
});
registerEvent({
  id: "rival_intro_stella",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("stella") },
  priority: 6,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "星光竜ステラ。差し脚で、翼も気性も安定しとる。夜や霧でも崩れん、隠れた本格派だ。" }]
});
registerEvent({
  id: "rival_intro_glaze",
  hook: "afterEntryList",
  condition: { once: true, test: ctx => ctx && ctx.race && getRaceDragonIds(ctx.race).includes("glaze") },
  priority: 6,
  actions: [{ type: "dialogue", speaker: "sake_udada",
    text: "氷甲竜グレイズ。地味だが耐久・気性・スタミナが揃ってる。長距離・霧・耐久戦で値段以上を見せるタイプだ。" }]
});

// ===== ★G5（NARRATIVE_DESIGN）: 100万→1億グラインド帯の中間イベント =====
// 空白帯に「転」のある掛け合いを置く（4章既読から・once・表示専用＝レース数値不変）。
// 連敗カウンタ p.missRun は checkEconomyMilestones（state.js）が更新する表示メタ。

// 連敗の夜（転＝ミズは負けた夜の数字を「市場が返す借用書」と読む）
registerEvent({
  id: "g5_losing_night",
  hook: "afterRaceResult",
  condition: { once: true, requiredFlag: "_chapter_intro_4",
    test: ctx => ((state.player && state.player.missRun) || 0) >= 4 },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "mizu", text: "4連敗。……ふふ、いい顔になってきたじゃない。" },
    { type: "dialogue", speaker: "mimi", expr: "panic", text: "笑いごとじゃないですよぅ……お財布が、軽い……。" },
    { type: "dialogue", speaker: "mizu", text: "覚えておきなさい。相場はね、痛かった夜の数字だけ、ちゃんと返してくるの。" },
    { type: "dialogue", speaker: "mimi", expr: "default", text: "……返して、くれますかね。" },
    { type: "dialogue", speaker: "mizu", text: "返させるのよ。——荒れた日は、値札が嘘をつく。……拾いに行くわよ、ミミ。" }
  ]
});
// 中間点500万（サケ＝金が増えたときこそ飯の心配をする親方肌）
registerEvent({
  id: "g5_mid_5m",
  hook: "afterRaceResult",
  condition: { once: true, requiredFlag: "_chapter_intro_4",
    test: () => assetsPeak(state) >= 5000000 },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "sake_udada", text: "総資産500万。……ハッ、あの行き倒れがな。" },
    { type: "dialogue", speaker: "mimi", expr: "happy", text: "えへへ、それ、褒めてます？" },
    { type: "dialogue", speaker: "sake_udada", text: "褒めてない。……飯は食ってるか。金が増えると、飯を忘れる奴が出る。" },
    { type: "dialogue", speaker: "mimi", expr: "smile", text: "食べてます！　むしろ、食べる量は増えました！" },
    { type: "dialogue", speaker: "sake_udada", text: "なら、いい。" }
  ]
});
// 行政の横槍＝中間点5000万（転＝スミカ章の事件。聴取の通達が「島に数えられた」証になる）
registerEvent({
  id: "g5_admin_audit",
  hook: "afterRaceResult",
  condition: { once: true, requiredFlag: "_chapter_intro_4",
    test: () => assetsPeak(state) >= 50000000 },
  priority: 6,
  actions: [
    { type: "dialogue", speaker: "sumika", text: "ミミ様。行政より通達です。……『個人資産の急拡大について、聴取を行う』と。" },
    { type: "dialogue", speaker: "mimi", expr: "panic", text: "ちょ、聴取!?　わたし、脱税してませんよ!?　領収書、ぜんぶ枕の下です！" },
    { type: "dialogue", speaker: "sumika", text: "保管場所から是正しましょう。……ですがご安心を。書類はわたくしが巻きます。" },
    { type: "dialogue", speaker: "sumika", text: "それに、これは好機です。行政が目をつけた——島の経済で、無視できない大きさになったということですから。" },
    { type: "dialogue", speaker: "mimi", expr: "smile", text: "……そっか。わたし、島に数えられてるんだ。" },
    { type: "dialogue", speaker: "sumika", text: "はい。……次は、数える側に回りましょう、ミミ様。" }
  ]
});

// ===== ★G8（NARRATIVE_DESIGN）: クリア後＝好敵手の再来（ファンレター l_rival の伏線回収）=====
// 終章クリア（edFlag）後の日常レースに、手紙の主が静かに現れる。顔なし（narrator経由）＝
// 新キャスト追加なしで cast/gate 契約を守る。表示専用＝予想対決は雰囲気のみ・数値不変。
registerEvent({
  id: "g8_rival_return",
  hook: "afterRaceSelect",
  condition: { once: true,
    test: () => !!(state.player && state.player.epilogue && state.player.epilogue.edFlag) },
  priority: 7,
  actions: [
    { type: "dialogue", speaker: "narrator", text: "レース場の出口。予想板の前に、旅装の男がひとり。……ミミの顔を見て、ふっと笑った。" },
    { type: "dialogue", speaker: "narrator", text: "「手紙は、読んだか。——次のレース、俺は自分の目で選ぶ。お前もそうしろ」　それだけ言って、男は窓口へ歩いていく。" },
    { type: "dialogue", speaker: "mimi", expr: "panic", text: "え……あの人、まさか、手紙の……！" },
    { type: "dialogue", speaker: "mimi", expr: "default", text: "……受けて立ちます。わたしは、わたしの目で選ぶだけ！" },
    { type: "dialogue", speaker: "narrator", text: "好敵手との静かな再戦が、日常のレースに混ざっていく。——島の賭場は、今日も平常運転。" }
  ]
});

// ===== EXTENSION POINT — §10 Phase 5+: Full story arcs go here =====
// Append additional dialogue/story beats for future phases below.

// =============================================================================
// 🏝 島側の行動の見返り＝「節目」（2026-08-01・R3／正本 docs/REWARD_LOOP_DESIGN.md）
// =============================================================================
// ★原則（ユーザー決裁）：「プレイヤーが何かをやるたびに、その見返りとしてイベントが見られる」。
// ★個別の反応は既にある（食べれば react、服は DLG.OUTFIT、スポットは到着VN、撮影は☆評価、
//   ノードは showLifeCutin、スカウトは竜ごとの一言）。ここで足すのは**節目**だけ。
//   個別を置き換えない＝上に重なる。
// ★門番（[[cast-appearance-gate]]）：未登場の顧問は喋らせない。fail-closed で
//   advisorMet が無い/偽なら、そのイベントは発火しない。
// ★表示専用＝レースの着順・オッズ・配当には非干渉。
const _met = k => { try { return typeof advisorMet === "function" && advisorMet(k); } catch (e) { return false; } };

// ── 🍜 食べる ────────────────────────────────────────────────────────
registerEvent({
  id: "milestone_meal_first", hook: "onMeal", condition: { once: true }, priority: 10,
  actions: [
    { type: "dialogue", speaker: "mimi", text: ctx => `${(ctx && ctx.meal && ctx.meal.name) || "屋台のごはん"}……っ、おいしい。ちゃんとした、ごはんだ……。` },
    { type: "dialogue", speaker: "sake_udada", text: "そうだ。まず食え。……島は、腹が減っていると狭く見える。" }
  ]
});
registerEvent({
  id: "milestone_meal_5", hook: "onMeal",
  condition: { once: true, test: ctx => ctx && ctx.totalEaten >= 5 },
  actions: [{ type: "dialogue", speaker: "mimi", text: "5品目。……この島、食べ物の名前を覚えるだけで一日終わっちゃう。" }]
});
registerEvent({
  id: "milestone_meal_10", hook: "onMeal",
  condition: { once: true, test: ctx => ctx && ctx.totalEaten >= 10 && _met("sumika") },
  actions: [{ type: "dialogue", speaker: "sumika", text: "ミミ様。食べ歩きの記録が10品を超えました。……食費ではなく、これは取材費として計上いたします。" }]
});
registerEvent({
  id: "milestone_meal_25", hook: "onMeal",
  condition: { once: true, test: ctx => ctx && ctx.totalEaten >= 25 && _met("makura") },
  actions: [{ type: "dialogue", speaker: "makura", text: "25品！？ もうグルメ配信者だろそれ。竜より飯で有名になるぞ！" }]
});

// ── 🏝 出かける ──────────────────────────────────────────────────────
registerEvent({
  id: "milestone_spot_first", hook: "onSpotVisit", condition: { once: true }, priority: 10,
  actions: [{ type: "dialogue", speaker: "mimi", text: "レース場の外にも、島ってこんなに広かったんだ……。" }]
});
registerEvent({
  id: "milestone_spot_5", hook: "onSpotVisit",
  condition: { once: true, test: ctx => ctx && ctx.totalSeen >= 5 },
  actions: [{ type: "dialogue", speaker: "mimi", text: "5か所目。……歩いた道が、ちょっとずつ地図になってきた。" }]
});
registerEvent({
  id: "milestone_spot_15", hook: "onSpotVisit",
  condition: { once: true, test: ctx => ctx && ctx.totalSeen >= 15 && _met("mizu") },
  actions: [{ type: "dialogue", speaker: "mizu", text: "あなた、最近いろんな通りで見かけるわね。……あはん。足で見た情報は、オッズより正直よ。" }]
});
registerEvent({
  id: "milestone_spot_30", hook: "onSpotVisit",
  condition: { once: true, test: ctx => ctx && ctx.totalSeen >= 30 },
  actions: [{ type: "dialogue", speaker: "narrator", text: "30か所。——この島で、ミミの知らない道のほうが少なくなってきた。" }]
});

// ── 📸 撮る ──────────────────────────────────────────────────────────
registerEvent({
  id: "milestone_photo_first", hook: "onPhoto", condition: { once: true }, priority: 10,
  actions: [{ type: "dialogue", speaker: "mimi", text: "撮れた……！ これ、紀行に載せていいやつだよね。" }]
});
registerEvent({
  id: "milestone_photo_star3", hook: "onPhoto",
  condition: { once: true, test: ctx => ctx && ctx.stars >= 3 },
  actions: [{ type: "dialogue", speaker: "mimi", text: "★3……！ わたし、写真の才能あるのでは……？（ないです）" }]
});

// ── 👗 服 ────────────────────────────────────────────────────────────
registerEvent({
  id: "milestone_outfit_5", hook: "onOutfit",
  condition: { once: true, test: ctx => ctx && ctx.totalOwned >= 5 },
  actions: [{ type: "dialogue", speaker: "mimi", text: "5着目。……着るものを選べるって、こんなに気分がちがうんだ。" }]
});
registerEvent({
  id: "milestone_outfit_10", hook: "onOutfit",
  condition: { once: true, test: ctx => ctx && ctx.totalOwned >= 10 && _met("makura") },
  actions: [{ type: "dialogue", speaker: "makura", text: "衣装10着！ 毎回ちがう画が撮れるって、それだけで強いぜ？" }]
});

// ── 🌳 くらしツリー ──────────────────────────────────────────────────
registerEvent({
  id: "milestone_node_first", hook: "onLifeNode", condition: { once: true }, priority: 10,
  actions: [{ type: "dialogue", speaker: "mimi", text: "……これ、生活が一個ぶん、ちゃんとした。" }]
});

// =========================================================================
// R4：横断の見返り＝**島でやったことに、レース場の側が反応する**
// =========================================================================
// 正本: docs/REWARD_LOOP_DESIGN.md
//
// ★ここが本命（R1〜R3で足りなかった層）：
//   個別の反応（食べた瞬間の react 等）＝R1で既にある。節目の反応＝R3で足した。
//   だが**島とレース場が別世界のまま**だった。島を歩いても顧問は何も知らない顔をしていた。
//   顧問が「昨日、灯籠通りに居たでしょう」と**名指しで**触れた瞬間、世界がひとつに繋がる。
//
// ★実装の要点（ここを守ること）：
//   ①**具体名で言う**。「観光してるね」では誰の話でもない。実際に行った場所・食べた品の名前を出す。
//     text は関数を取れる（event_hooks.js:177）ので、発火時に state から実名を引く。
//   ②**名前が引けないときは発火しない**（test で name の存在まで確かめる）。
//     「、行った？」のような穴あき台詞を絶対に出さない。
//   ③**once: true**＝繰り返さない。afterRaceSelect は毎レース通るフックなので、
//     once を外すと顧問が毎回同じ雑談をする＝レースのテンポを壊す。
//   ④**門番（_met）を必ず通す**。未登場の顧問に喋らせない（fail-closed・[[cast-appearance-gate]]）。
//   ⑤表示専用＝レースの着順・オッズ・配当・FinalPower には一切触れない。
// =========================================================================

// ── 島の実績を「実名で」引くヘルパ（引けなければ null＝発火しない）──────
// ★キーの挿入順＝訪問順／実食順なので、末尾＝**いちばん最近**。
//   「昨日〜に居たでしょう」が本当に最近の出来事になる。
function _r4LastSpotName() {
  try {
    if (typeof KONRON_SPOTS === "undefined") return null;
    const ids = Object.keys(((state.player || {}).kurashi || {}).spotsSeen || {}).filter(id => KONRON_SPOTS[id]);
    if (!ids.length) return null;
    const s = KONRON_SPOTS[ids[ids.length - 1]];
    return (s && s.name) || null;
  } catch (e) { return null; }
}
function _r4SpotCount() {
  try { return Object.keys(((state.player || {}).kurashi || {}).spotsSeen || {}).length; } catch (e) { return 0; }
}
function _r4LastMealName() {
  try {
    if (typeof MEALS === "undefined" || typeof mealData !== "function") return null;
    const ids = Object.keys(mealData().eaten || {});
    if (!ids.length) return null;
    const m = MEALS.find(x => x.id === ids[ids.length - 1]);
    return (m && m.name) || null;
  } catch (e) { return null; }
}
function _r4MealCount() { try { return mealStatsAll().got; } catch (e) { return 0; } }
function _r4Masterpieces() { try { return ((state.player || {}).kurashi || {}).masterpieces || 0; } catch (e) { return 0; } }
function _r4Scouted() { try { return scoutedRoster().length; } catch (e) { return 0; } }
function _r4Outfits() { try { return OUTFITS.filter(x => outfitOwned(x)).length; } catch (e) { return 0; } }

// ── 🏝 出かけたことに、顧問が触れる ────────────────────────────────
registerEvent({
  id: "x_mizu_saw_you_out", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("mizu") && _r4SpotCount() >= 3 && !!_r4LastSpotName() },
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: () => `昨日、${_r4LastSpotName()}に居たでしょう。……見てましたよ、あはん。` },
    { type: "dialogue", speaker: "mizu",
      text: "いいことです。竜は島で育つの。島を知らない人の予想は、数字だけになる。" }
  ]
});

registerEvent({
  id: "x_sumika_island_walker", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("sumika") && _r4SpotCount() >= 15 },
  actions: [
    { type: "dialogue", speaker: "sumika",
      text: () => `島を${_r4SpotCount()}か所。……あなた、もう観光客じゃないわね。` },
    { type: "dialogue", speaker: "sumika",
      text: "住んでる人の顔になってきた。悪くないわ、その顔で買いなさい。" }
  ]
});

// ── 🍜 食べたことに、顧問が触れる ──────────────────────────────────
registerEvent({
  id: "x_sake_you_ate", hook: "afterRaceSelect",
  condition: { once: true, test: () => _r4MealCount() >= 5 && !!_r4LastMealName() },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: () => `${_r4LastMealName()}か。……ふん、悪くない選び方をする。` },
    { type: "dialogue", speaker: "sake_udada",
      text: "腹が減った奴の予想は荒れる。食え。それも予想のうちだ。" }
  ]
});

registerEvent({
  id: "x_makura_food_content", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") && _r4MealCount() >= 15 },
  actions: [
    { type: "dialogue", speaker: "makura",
      text: () => `島の飯、${_r4MealCount()}品も食ってんの？ ……それ、コンテンツだよ。` },
    { type: "dialogue", speaker: "makura",
      text: "予想が当たらない日でも、飯の画は伸びる。覚えとけ、それが強さだ。" }
  ]
});

// ── 📸 撮ったことに、顧問が触れる ──────────────────────────────────
registerEvent({
  id: "x_makura_saw_photo", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") && _r4Masterpieces() >= 1 && !!_r4LastSpotName() },
  actions: [
    { type: "dialogue", speaker: "makura",
      text: "おい、あの★3の写真。……あれ、お前が撮ったのか。" },
    { type: "dialogue", speaker: "makura",
      text: "竜を「速い生き物」じゃなく「きれいな生き物」として撮れる奴は、そう多くねぇよ。" }
  ]
});

// ── 🌴 竜を迎えたことに、顧問が触れる ──────────────────────────────
registerEvent({
  id: "x_mizu_stable_grows", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("mizu") && _r4Scouted() >= 2 },
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: () => `龍舎、${_r4Scouted()}頭になったそうね。……あなた、集める側になってきたわ。` },
    { type: "dialogue", speaker: "mizu",
      text: "近くで見た竜の走りは、数字より正確よ。あはん、それはもう分かってるでしょ？" }
  ]
});

// ── 👗 着替えたことに、顧問が触れる ────────────────────────────────
registerEvent({
  id: "x_sumika_dressed_up", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("sumika") && _r4Outfits() >= 3 },
  actions: [
    { type: "dialogue", speaker: "sumika",
      text: "今日の服、いいじゃない。……ちゃんとお金の使い方を覚えたのね。" },
    { type: "dialogue", speaker: "sumika",
      text: "貯めるだけの人は、いつか貯めることが目的になる。使いなさい、生きるために。" }
  ]
});

// ── 🌳 暮らしが整ったことに、顧問が触れる ──────────────────────────
registerEvent({
  id: "x_sake_life_settled", hook: "afterRaceSelect",
  condition: { once: true, test: () => {
    try { return Object.keys((state.lifeTree || {}).unlocked || {}).length >= 8; } catch (e) { return false; }
  } },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "……顔つきが変わったな。寝床が定まった奴の顔だ。" },
    { type: "dialogue", speaker: "sake_udada",
      text: "焦った金は、焦った買い方をする。落ち着いた奴の金は、落ち着いて増える。" }
  ]
});

// =========================================================================
// STEP3（2026-08-01）：いちばん長い区間に、いちばん中身が無い問題への手当て
// =========================================================================
// 正本: docs/PACING_EXECUTION_DIRECTIVE.md STEP3／方針 docs/PACING_DESIGN_RESEARCH.md v2 D6
//
// ★実測で分かっていたこと：顧問の台詞は サケ28／ミズ12／スミカ6／マクラ4／**セレスティア0**。
//   要求は第4話→第5話で×100、第5話→EDで×10と伸びるのに、**中身は逆に減っていく**。
//   終章の主役セレスティアがレース場で一度も喋らないのは、いちばん長い旅がいちばん静かという状態。
// ★ここで足すのは台詞だけ。進行にもレース数値にも触れない（純粋な密度の手当て）。
// ★門番は必ず通す（fail-closed）。表情は _cut→expr→smile→default の自動フォールバックがあるので
//   実在キー（default/smile/serious/sad）を使う。
// =========================================================================

// ── 🌌 セレスティア：終章の主役に、日常のレースを語らせる ──────────────
// ★答えは絶対に言わせない（神眼は最終決戦の切り札。ここで先に見せない）。
//   「視える人が、視えないことを面白がる」という距離感で書く。
registerEvent({
  id: "x_celes_first_ordinary", hook: "afterRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_5", test: () => _met("celestia") },
  actions: [
    { type: "dialogue", speaker: "celestia", expr: "smile",
      text: "こんな小さなレースにも、ちゃんと来るのね。……ふふ、感心してるのよ。" },
    { type: "dialogue", speaker: "celestia", expr: "serious",
      text: "先が視えるということはね、驚けなくなるということ。あなたはまだ驚ける。それは強さよ。" }
  ]
});
registerEvent({
  id: "x_celes_why_watch", hook: "afterRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_5", test: () => _met("celestia") },
  actions: [
    { type: "dialogue", speaker: "celestia",
      text: "わたしが視ているのは結果。あなたが視ているのは、走っている竜。……同じものを見ていないの。" }
  ]
});
registerEvent({
  id: "x_celes_on_crowd", hook: "afterRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_5", test: () => _met("celestia") },
  actions: [
    { type: "dialogue", speaker: "celestia", expr: "smile",
      text: "この歓声、嫌いじゃないわ。……誰も答えを知らないから、こんなに大きくなるのね。" }
  ]
});
registerEvent({
  id: "x_celes_on_mimi", hook: "afterRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_5", test: () => _met("celestia") },
  actions: [
    { type: "dialogue", speaker: "celestia", expr: "serious",
      text: "あなたの目、だんだん濁らなくなってきた。……最初に会った頃は、もっと数字を見ていたのに。" },
    { type: "dialogue", speaker: "mimi",
      text: "……えっと、それ、褒められてます……？" },
    { type: "dialogue", speaker: "celestia", expr: "smile", text: "さあ。どちらでも。" }
  ]
});
registerEvent({
  id: "x_celes_late_warning", hook: "afterRaceSelect",
  condition: { once: true, requiredFlag: "_chapter_intro_5",
    test: () => _met("celestia") && (((state.player || {}).completedRaces || 0) >= 60) },
  actions: [
    { type: "dialogue", speaker: "celestia", expr: "serious",
      text: "……島の空気が、少し軽くなってきたわ。悪い意味でね。" },
    { type: "dialogue", speaker: "celestia",
      text: "急がなくていい。でも、忘れないで。あなたが走らせているのは、竜だけじゃない。" }
  ]
});

// ── 🎤 マクラ：第4話の長旅を持たせる（4本→計9本）────────────────────
registerEvent({
  id: "x_makura_pace", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") },
  actions: [{ type: "dialogue", speaker: "makura",
    text: "毎日おなじ熱量で叫んでたら、俺、三日で潰れる。……抜くとこ抜くのも技術だ。" }]
});
registerEvent({
  id: "x_makura_picture", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") },
  actions: [{ type: "dialogue", speaker: "makura",
    text: "勝った竜より、負けて泣いてる客のほうが画になる時がある。……悪趣味じゃねぇぞ、それが競技だ。" }]
});
registerEvent({
  id: "x_makura_name", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") && (((state.player || {}).completedRaces || 0) >= 40) },
  actions: [
    { type: "dialogue", speaker: "makura",
      text: "お前の名前、実況席で噛まなくなったよ。最初は「よ、予想家ミミさん」だったのにな。" },
    { type: "dialogue", speaker: "mimi", text: "覚えててくださったんですね……！" },
    { type: "dialogue", speaker: "makura", text: "仕事だからな。……まあ、それだけでもねぇけど。" }
  ]
});
registerEvent({
  id: "x_makura_long_road", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") && (((state.player || {}).completedRaces || 0) >= 70) },
  actions: [{ type: "dialogue", speaker: "makura",
    text: "ここからが長いぞ。伸びが止まったように感じる時期が必ず来る。……そこで辞める奴を、何人も見た。" }]
});
registerEvent({
  id: "x_makura_stream", hook: "afterRaceSelect",
  condition: { once: true, test: () => _met("makura") && (typeof getStoryFlag === "function") && getStoryFlag("phoneBought") },
  actions: [{ type: "dialogue", speaker: "makura",
    text: "配信、始めたんだってな。……見られる側は、外した時が全部残る。それでもやるなら、応援する。" }]
});

// ── 🔄 各章の「転」＝予想を裏切る一撃に台詞を当てる ────────────────────
// ★新しい判定は作らない。afterRaceResult に既に渡っている ctx（hit / popularityRank / bigLoss）だけを見る。
registerEvent({
  id: "x_twist_longshot", hook: "afterRaceResult",
  condition: { once: true, test: ctx => ctx && ctx.popularityRank >= 6 },
  actions: [
    { type: "dialogue", speaker: "mizu",
      text: "……あら。いちばん人気のない子が、いちばん前に居るわ。" },
    { type: "dialogue", speaker: "mizu",
      text: "数字は嘘をつかない。でもね、全部は言わないの。あはん、そこが面白いところ。" }
  ]
});
registerEvent({
  id: "x_twist_fav_fell", hook: "afterRaceResult",
  condition: { once: true, test: ctx => ctx && !ctx.hit && ctx.popularityRank > 1 },
  actions: [
    { type: "dialogue", speaker: "sake_udada",
      text: "本命が飛んだな。……こういう日は、誰の予想も紙くずだ。" },
    { type: "dialogue", speaker: "sake_udada",
      text: "覚えとけ。外れた日にしか見えないものがある。今日の走り、よく思い出しておけ。" }
  ]
});
registerEvent({
  id: "x_twist_big_loss", hook: "afterRaceResult",
  condition: { once: true, test: ctx => ctx && ctx.bigLoss && _met("sumika") },
  actions: [
    { type: "dialogue", speaker: "sumika",
      text: "大きく賭けて、大きく外した。……顔を上げなさい、みっともない。" },
    { type: "dialogue", speaker: "sumika",
      text: "ここで覚えることは一つだけ。減らない場所にお金を置いておくこと。それが暮らしよ。" }
  ]
});
