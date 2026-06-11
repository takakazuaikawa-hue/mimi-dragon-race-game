/**
 * bgm.js — レースBGM（レース中にランダムな曲を再生）。
 *
 * 静的ホスティング（GitHub Pages）は実行時にフォルダ一覧を取得できないため、
 * 再生できる曲は下の RACE_BGM_TRACKS に「ファイル名だけ」を列挙する方式にする。
 * bgm/racebgm/ に音声ファイル（.mp3 / .m4a / .ogg / .wav）を置き、その名前を
 * RACE_BGM_TRACKS に足すだけでよい。レースごとに1曲ランダムに選ばれ、レースが
 * 終わって画面を離れるまでループ再生される。
 *
 * ・全体ミュート（Sfx と同じ "mimi_muted"）を尊重する。
 * ・レース結果・オッズ・配当には一切触れない、純粋な音声機能（HARD制約を厳守）。
 * ・曲が未設置（配列が空）のときは何も鳴らさない安全な no-op。
 *
 * フォルダから一覧を再生成（PowerShell・プロジェクト直下で実行）:
 *   Get-ChildItem bgm/racebgm -File | ForEach-Object { '  "' + $_.Name + '",' }
 */
const RACE_BGM_DIR = "bgm/racebgm/";
// ファイル名はすべてASCIIに統一（静的配信でのUnicode正規化差による404を避けるため）。
// 元の日本語名 → 改名後:
//   the・ファンファーレ.mp3            → the-fanfare.mp3
//   ある日森の中ドラゴンに出会った.mp3 → dragon-in-the-forest.mp3
// 追加改名: 空の英雄→sky-hero / 負けられない戦い→unlosable-battle / 霧裂く旗→fog-cutting-flag
// （dragon-in-the-forest はローカルで削除されたためローテーションから除外）
const RACE_BGM_TRACKS = [
  "crown-of-thunder.mp3",
  "the-fanfare.mp3",
  "sky-hero.mp3",
  "unlosable-battle.mp3",
  "fog-cutting-flag.mp3"
];

var RaceBgm = (function () {
  var audio = null;
  var MUTE_KEY = "mimi_muted";
  var lastIdx = -1;   // 直前と同じ曲を避けて選ぶ

  function isMuted() {
    try {
      if (typeof Sfx !== "undefined" && Sfx.isMuted) return Sfx.isMuted();
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch (e) { return false; }
  }

  // ランダムに1曲。曲が2つ以上あれば直前と違う曲を選ぶ。
  function pickIndex() {
    var n = RACE_BGM_TRACKS.length;
    if (n <= 0) return -1;
    if (n === 1) return 0;
    var i = Math.floor(Math.random() * n);
    if (i === lastIdx) i = (i + 1) % n;   // 連続重複を回避
    return i;
  }

  function stop() {
    if (audio) {
      try { audio.pause(); audio.src = ""; audio.load(); } catch (e) {}
      audio = null;
    }
  }

  // ゴール時：音量をなめらかに絞ってから停止（歓声に重ねてフェードアウト）。
  function fadeOut(ms) {
    if (!audio) return;
    var a = audio;
    audio = null;                 // 次レースが新規 start できるよう即デタッチ
    try {
      var dur = ms || 1400, steps = 20, i = 0, v0 = a.volume;
      var iv = setInterval(function () {
        i++;
        try { a.volume = Math.max(0, v0 * (1 - i / steps)); } catch (e) {}
        if (i >= steps) { clearInterval(iv); try { a.pause(); a.src = ""; a.load(); } catch (e) {} }
      }, dur / steps);
    } catch (e) { try { a.pause(); } catch (e2) {} }
  }

  function start() {
    stop();
    if (isMuted()) return;
    var idx = pickIndex();
    if (idx < 0) return;                 // 曲が未設置 → 無音の no-op
    lastIdx = idx;
    try {
      var a = new Audio(RACE_BGM_DIR + encodeURIComponent(RACE_BGM_TRACKS[idx]));
      a.loop = true;                     // レースの長さに合わせてループ
      a.volume = 0.42;                   // 効果音(Sfx master 0.42)に埋もれない程度
      var p = a.play();
      if (p && p.catch) p.catch(function () {});   // 自動再生がブロックされても無視
      audio = a;
    } catch (e) { audio = null; }
  }

  // ミュート時は即停止（レース中にミュートされても止まるように）。
  function setMuted(m) { if (m) stop(); }

  return {
    start: start,
    stop: stop,
    fadeOut: fadeOut,
    setMuted: setMuted,
    isPlaying: function () { return !!audio; },
    trackCount: function () { return RACE_BGM_TRACKS.length; }
  };
})();
if (typeof window !== "undefined") window.RaceBgm = RaceBgm;
