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
  var HOME_TRACKS = [
    "bgm/homebgm/くつろぎ.mp3",
    "bgm/homebgm/ホームカントリー.mp3"
  ];
  var MALL_TRACKS = [
    "bgm/mallbgm/mallでお買い物.mp3",
    "bgm/mallbgm/ドラゴンモールで爆買いバニー.mp3",
    "bgm/mallbgm/バニーガールメンタルで買い物モールは最高.mp3"
  ];
  // ホーム系ゾーン＝落ち着いた立ち寄り画面（賭け前の選択/詳細も“待ち”の時間なので含む）。
  var HOME_ZONE = {
    home: 1, race_select: 1, race_detail: 1, assets: 1, life_tree: 1, life_collection: 1,
    active_skills: 1, meals: 1, goals: 1, story: 1, story_read: 1, consult: 1, collection: 1,
    village: 1, stable: 1, scout: 1, poro_gourmet: 1, help: 1, settings: 1, sns: 1, timeline: 1, fanletters: 1
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

  function apply(force) {
    if (typeof state === "undefined" || !state.ui) return;
    if (sceneOwnsBgm()) return;
    var z = zoneOf(state.ui.screen);
    if (!force && z === curZone) return;
    var R = window.RaceBgm;
    if (R && R.playFile) {
      if (z === "home") { curTrack = pick(HOME_TRACKS, curTrack); try { R.playFile(curTrack); } catch (e) {} }
      else if (z === "mall") { curTrack = pick(MALL_TRACKS, curTrack); try { R.playFile(curTrack); } catch (e) {} }
      else if (z === "title") { try { R.stop(); } catch (e) {} curTrack = null; }
      // "other"(race/ending) は audio に触れない
    }
    curZone = z;
  }

  // 画面変化をポーリングで追従（多様な遷移経路を確実に拾う・軽量）。
  function tick() {
    if (typeof state === "undefined" || !state.ui) return;
    if (state.ui.screen !== lastScreen) { lastScreen = state.ui.screen; apply(false); }
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

  if (typeof window !== "undefined") window.ZoneBgm = { apply: apply, zoneOf: zoneOf };
})();
