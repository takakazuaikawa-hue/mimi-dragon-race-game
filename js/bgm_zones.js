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
  // ★ホームBGMは一時的に無音（音源が好みでないため）。いい音源が手に入ったら下の2行のコメントを外すだけで復活。
  var HOME_TRACKS = [
    // "bgm/homebgm/くつろぎ.mp3",
    // "bgm/homebgm/ホームカントリー.mp3"
  ];
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
  // ホーム系ゾーン＝落ち着いた立ち寄り画面（賭け前の選択/詳細も“待ち”の時間なので含む）。
  var HOME_ZONE = {
    home: 1, race_select: 1, race_detail: 1, assets: 1, life_tree: 1, life_collection: 1,
    active_skills: 1, meals: 1, goals: 1, story: 1, story_read: 1, consult: 1, collection: 1,
    village: 1, stable: 1, scout: 1, poro_gourmet: 1, help: 1, settings: 1, sns: 1, timeline: 1, fanletters: 1,
    // ★崑崙の観光まわり（歩けるマップ含む）＝ここが抜けていて zone が "other" になり、
    //   モールから歩いて出ても**買い物の曲が鳴りっぱなし**だった（実機で確認）。ホーム系として扱う。
    //   いま HOME_TRACKS は空＝ホームと同じ無音になる（＝前の画面の曲が居残らないのが正しい状態）。
    //   島歩き専用の曲を入れるときは、ここに混ぜず WALK 用のゾーンを足すこと。
    konron_map: 1, konron_guide: 1, konron_gallery: 1, konron_walk: 1,
    kiko: 1, media: 1,   // 📖紀行ブログ・📱メディアハブ（2026-07-30 IA再編）＝ホーム系ゾーン
    shingan: 1           // ☄️神眼レース＝静かな緊張（前画面の曲を持ち込まない）
  };
  var MALL_ZONE = { mall: 1, mall_rpg: 1 };

  // race_run/result/analysis(=レースが自前でBGM管理)・未知(=エンディング等)は "other"＝audioに触れない。
  function zoneOf(s) {
    if (!s) return "other";
    if (s === "title") return "title";
    if (MALL_ZONE[s]) return "mall";
    if (HOME_ZONE[s]) return "home";
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
      if (z === "home") { curTrack = pick(HOME_TRACKS, curTrack); try { if (curTrack) R.playFile(curTrack); else R.stop(); } catch (e) {} }   // 音源が無ければ無音（停止）
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
      else if (z === "title") { try { R.stop(); } catch (e) {} curTrack = null; mallBase = null; }
      // "other"(race/ending) は audio に触れない
    }
    curZone = z; curMood = mood;
  }

  // 画面変化＋モール内の気分の変化をポーリングで追従（軽量）。
  function tick() {
    if (typeof state === "undefined" || !state.ui) return;
    if (state.ui.screen !== lastScreen) { lastScreen = state.ui.screen; apply(false); return; }
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

  // 気分の曲の実在チェックは**起動時に済ませておく**（戦闘が始まってから調べると判定待ちが挟まる）。
  try { probeMood("boss"); probeMood("fever"); } catch (e) {}

  if (typeof window !== "undefined") window.ZoneBgm = { apply: apply, zoneOf: zoneOf };
})();
