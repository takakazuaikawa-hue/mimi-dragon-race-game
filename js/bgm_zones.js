// =========================================================================
// bgm_zones.js — ホーム/モール等の“ゾーンBGM”を画面に追従して自動再生。
// =========================================================================
// RaceBgm（単一audioを共有）を流用するので：
//   ・音量スライダー(setVolume)・ミュート(setMuted)・停止(stop/fadeOut)がそのまま効く
//   ・レースBGM／エンディング曲とは自動で排他（同じaudioを奪い合うので“重ならない”）
// 画面が“変わった時だけ”ゾーン判定して切替＝静的オーバーレイ（エンディングのスタッフロール等）は
//   state.ui.screen を変えないので自然に無干渉。さらにエンディング/終章フィナーレ中はガードする。
// ★完全に表示専用（レースの着順・オッズ・配当に非干渉＝[[race-math-immutable]]）。
// 追加方法：bgm/homebgm/ ・ bgm/mallbgm/ にmp3を置き、下の TRACKS 配列に1行足すだけ。
// =========================================================================

(function () {
  // ★2026-07-30 Suno納品13曲を全画面へ結線（docs/BGM_ORDER_BRIEF.md／[[audio-volume-control]]）。
  //   ゾーン＝「部屋」単位。曲は bgm/uibgm/ に置かれた実ファイルだけを使い、**未納品のゾーンは無音**
  //   （probeZone で実在チェック→無ければ stop＝置く前に結線しても壊れない・1曲届くたびに自然に鳴りだす）。
  //   ★未納品（2026-07-30時点）＝T1 title-konron.mp3（タイトル）/ T2 home-morning.mp3（静かホーム）。
  //     この2つが入ると、下の TRACKS に書いてあるパスがそのまま有効になる（コード変更は不要）。
  var HOME_TRACKS = [
    "bgm/homebgm/home-morning.mp3"        // T2 島の朝（静かホーム・★未納品なら自動で無音）
  ];
  var TRACKS = {
    title:   ["bgm/uibgm/title-konron.mp3"],      // T1 崑崙島へ（★未納品なら無音）
    onair:   ["bgm/uibgm/home-onair.mp3"],        // T3 ミミ・オン・エア（配信ホーム）
    bet:     ["bgm/uibgm/bet-lobby.mp3"],         // T4 オッズの匂い（レース選択/賭け/分析）
    story:   ["bgm/uibgm/documentary.mp3"],       // T5 密着（物語/各話/相談）
    life:    ["bgm/uibgm/island-life.mp3"],       // T6 暮らしの帳面（暮らし/経済/村/図鑑…）
    walk:    ["bgm/uibgm/konron-stroll.mp3"],     // T7 崑崙そぞろ歩き（観光）
    onsen:   ["bgm/uibgm/onsen-uroko.mp3"],       // T12 うろこ湯（温泉スポット滞在時）
    scout:   ["bgm/uibgm/scout-stalk.mp3"],       // T8 けはいを追って（スカウト）
    stable:  ["bgm/uibgm/poro-nap.mp3"],          // T9 ポロと昼寝（龍舎/グルメレース）
    result:  ["bgm/uibgm/after-race.mp3"],        // T10 答え合わせ（結果画面＝外れでも寄り添う）
    sns:     ["bgm/uibgm/timeline.mp3"],          // T11 タイムラインの海（SNS/メディア）
    kiko:    ["bgm/uibgm/timeline.mp3"],          // 紀行ブログ＝同系（WEB媒体の空気）
    doom:    ["bgm/uibgm/doom-countdown.mp3"]     // T13 淘汰のカウントダウン（神眼レース/終章）
  };
  // 実在チェック（ゾーン単位・1回だけ）。null=判定中／true=鳴らす／false=無音のまま。
  var zoneOk = {};
  function probeZone(z) {
    var path = (TRACKS[z] || [])[0];
    if (!path) return false;
    if (zoneOk[z] !== undefined) return zoneOk[z];
    zoneOk[z] = null;
    try {
      var a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = function () { zoneOk[z] = true; };
      a.onerror = function () { zoneOk[z] = false; };
      a.src = path;
    } catch (e) { zoneOk[z] = false; }
    return zoneOk[z];
  }
  var MALL_TRACKS = [
    "bgm/mallbgm/mall-day.mp3",
    "bgm/mallbgm/mallでお買い物.mp3",
    "bgm/mallbgm/ドラゴンモールで爆買いバニー.mp3",
    "bgm/mallbgm/バニーガールメンタルで買い物モールは最高.mp3"
  ];
  // ★G3-5：モールの中だけ“気分”で曲を差し替える（ボス／主の戦い＝boss、おたからチャンス＝fever）。
  //   mall_rpg.js には触らない。下のポーリングが RPG の状態を見て切り替える＝結線は一方向で済む。
  //   ファイルが無い／読めない時は**普段の曲のまま**（差し替えを諦める）＝置く前に入れても壊れない。
  var MOOD_TRACKS = { boss: "bgm/mallbgm/mall-boss.mp3", fever: "bgm/mallbgm/mall-fever.mp3" };
  var moodOk = {};                       // 実在チェックの結果（null=判定中 / true / false）
  function probeMood(m) {
    if (moodOk[m] !== undefined) return moodOk[m];
    moodOk[m] = null;
    try {
      var a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = function () { moodOk[m] = true; };
      a.onerror = function () { moodOk[m] = false; };
      a.src = MOOD_TRACKS[m];
    } catch (e) { moodOk[m] = false; }
    return moodOk[m];
  }
  // いまのモール内の気分。戦闘中でなければ ""（＝普段の曲）。
  function moodOf() {
    try {
      if (typeof RPG === "undefined" || !RPG || RPG.mode !== "battle" || !RPG.battle) return "";
      if (RPG.battle.boss || RPG.battle.nushi) return "boss";
      if (RPG.battle.rare) return "fever";
    } catch (e) {}
    return "";
  }
  // ★画面→ゾーンの割り当て（1画面1ゾーン・docs/BGM_ORDER_BRIEF.md §2の「担当画面」と一致）。
  //   ホーム(home)は配信/静かの2モードで曲が変わるので zoneOf 内で分岐する。
  var SCREEN_ZONE = {
    // 賭け場のロビー（走る前の“待ち”＝期待の時間）
    race_select: "bet", race_detail: "bet", analysis: "bet",
    // 結果＝答え合わせ（★勝っても負けても寄り添う中立のベッド。的中のファンファーレは別に単発で鳴る）
    result: "result",
    // 物語＝密着ドキュメンタリー
    story: "story", story_read: "story", consult: "story",
    // 暮らし（する側）＋台帳・記録の画面
    assets: "life", life_tree: "life", life_collection: "life", active_skills: "life",
    economy: "life", island_build: "life", collection_score: "life", goals: "life",
    village: "life", collection: "life", meals: "life", help: "life", settings: "life",
    // 観光（歩く・ガイド・写真）
    konron_map: "walk", konron_guide: "walk", konron_gallery: "walk", konron_walk: "walk",
    // 竜まわり
    scout: "scout", stable: "stable", poro_gourmet: "stable",
    // メディア系
    sns: "sns", timeline: "sns", fanletters: "sns", media: "sns", kiko: "kiko",
    // 終章の最終イベント
    shingan: "doom"
  };
  var MALL_ZONE = { mall: 1, mall_rpg: 1 };

  // race_run(=レースが自前でBGM管理)・未知(=エンディング等)は "other"＝audioに触れない。
  function zoneOf(s) {
    if (!s) return "other";
    if (s === "title") return "title";
    if (MALL_ZONE[s]) return "mall";
    if (s === "home") {
      // ★配信モード（スマホ購入後）はローファイの配信曲、静かモードは島の朝。
      try { if (typeof getStoryFlag === "function" && getStoryFlag("phoneBought")) return "onair"; } catch (e) {}
      return "home";
    }
    if (SCREEN_ZONE[s]) return SCREEN_ZONE[s];
    return "other";
  }
  function pick(list, avoid) {
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    var i = Math.floor(Math.random() * list.length);
    if (list[i] === avoid) i = (i + 1) % list.length;   // 直前と同じ曲を避ける
    return list[i];
  }
  // エンディング/終章フィナーレが自前BGMを鳴らしている間は奪わない（保険）。
  function sceneOwnsBgm() {
    if (document.getElementById("ending-overlay")) return true;
    try { if (window.epData && epData().active && epData().finalReady) return true; } catch (e) {}
    return false;
  }

  var curZone = null, curTrack = null, lastScreen = null, kicked = false;
  var curMood = "", mallBase = null;      // mallBase＝戦闘前に流れていた普段の曲（戦い終わりに戻す先）

  function apply(force) {
    if (typeof state === "undefined" || !state.ui) return;
    if (sceneOwnsBgm()) return;
    var z = zoneOf(state.ui.screen);
    var mood = (z === "mall") ? moodOf() : "";
    if (!force && z === curZone && mood === curMood) return;
    var R = window.RaceBgm;
    if (R && R.playFile) {
      if (z === "home") {
        // 静かホーム＝T2「島の朝」。★未納品なら無音（判定待ちのあいだも何もしない＝一瞬だけ鳴る事故を防ぐ）。
        var hOk = probeZone("home");
        if (hOk === null) return;
        var hWant = hOk ? HOME_TRACKS[0] : null;
        if (hWant !== curTrack) { curTrack = hWant; try { if (hWant) R.playFile(hWant); else R.stop(); } catch (e) {} }
      }
      else if (TRACKS[z]) {
        // ★ゾーン曲（賭け/物語/暮らし/観光/スカウト/龍舎/結果/SNS/紀行/終章/配信ホーム）。
        //   実在チェック未了なら何もしない＝曲が入っていないゾーンは静かなまま（結線を先に入れても壊れない）。
        var zOk = probeZone(z);
        if (zOk === null) return;
        var want2 = zOk ? pick(TRACKS[z], curTrack) : null;
        if (want2 !== curTrack) { curTrack = want2; try { if (want2) R.playFile(want2); else R.stop(); } catch (e) {} }
        mallBase = null;
      }
      else if (z === "mall") {
        // 気分の曲が使えるならそれ。使えない／普段に戻る時は、戦闘前と同じ曲へ戻す。
        var want = null;
        if (mood) {
          var ok = probeMood(mood);
          if (ok === null) return;             // ★実在チェックがまだ＝**何も切り替えない**。
          //   ここで普段の曲へ落とすと、判定が付いた次の瞬間に気分の曲へ跳ぶ＝一瞬だけ別の曲が挟まる
          //   （実機のログで確認した）。答えが出るまで今の曲のまま待つ。
          if (ok === true) want = MOOD_TRACKS[mood];
        }
        if (!want) {
          if (!mallBase || curZone !== "mall") mallBase = pick(MALL_TRACKS, mallBase);
          want = mallBase;
          mood = "";                       // 差し替えられなかった＝気分は「普段」として憶える
        } else if (curZone === "mall" && !curMood) {
          mallBase = curTrack;             // いま鳴っている普段の曲を控えておく
        }
        if (want !== curTrack) { curTrack = want; try { R.playFile(curTrack); } catch (e) {} }
      }
      // "other"(race_run/ending) は audio に触れない。title は TRACKS.title を持つので上の分岐で処理される。
    }
    curZone = z; curMood = mood;
  }

  // 画面変化＋モール内の気分の変化＋ゾーンの変化をポーリングで追従（軽量）。
  function tick() {
    if (typeof state === "undefined" || !state.ui) return;
    if (state.ui.screen !== lastScreen) { lastScreen = state.ui.screen; apply(false); return; }
    // ★同じ画面でもゾーンが変わることがある（ホームでスマホを買った瞬間＝静か→配信）。
    if (zoneOf(state.ui.screen) !== curZone) { apply(false); return; }
    if (curZone === "mall" && moodOf() !== curMood) apply(false);   // 戦闘に入った／終わった
  }
  setInterval(tick, 600);

  // 自動再生がブロックされても、最初のユーザー操作で確実に鳴らす（タイトル→ホームのタップ等）。
  function kick() {
    if (kicked) return; kicked = true;
    apply(true);
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    window.addEventListener(ev, kick, { once: true, passive: true });
  });

  // 実在チェックは**起動時に全ゾーンぶん済ませておく**（画面に入ってから調べると判定待ちで一瞬遅れる）。
  try {
    probeMood("boss"); probeMood("fever");
    probeZone("home");
    Object.keys(TRACKS).forEach(function (z) { probeZone(z); });
  } catch (e) {}

  if (typeof window !== "undefined") window.ZoneBgm = { apply: apply, zoneOf: zoneOf, _probe: probeZone, _tracks: TRACKS };
})();
