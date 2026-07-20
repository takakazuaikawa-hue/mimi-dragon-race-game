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
  "fog-cutting-flag.mp3",
  "lets-do-this.mp3"   // 「やったるで」＝気合い曲。レース実況のローテーションに追加（ASCII名でNFD404回避）
];

var RaceBgm = (function () {
  var audio = null;
  var MUTE_KEY = "mimi_muted";
  var VOL_KEY = "mimi_bgmvol";
  var BGM_BASE = 0.42;          // チューニング済みの基準音量（=従来値）
  var bgmLevel = 1;             // ユーザー音量 0..1（1.0=従来）
  try { var _bv = parseFloat(localStorage.getItem(VOL_KEY)); if (_bv >= 0 && _bv <= 1) bgmLevel = _bv; } catch (e) {}
  var lastIdx = -1;   // 直前と同じ曲を避けて選ぶ
  // 「いま何を鳴らしている/鳴らすべきか」の意図。ミュート中に start()/playFile() されても
  // ここに残るので、ミュート解除時に正しく復帰できる（旧実装は解除時に何もせず
  // 「一度消すと二度と鳴らない」バグだった）。stop()/fadeOut() で消える。
  var pending = null;   // null | {kind:'race'} | {kind:'file', path:string}

  // ── iPhoneの消音でBGMだけ鳴ってしまう問題への二段構えの対処 ──────────────
  // iOS Safari は「HTML <audio> はサイレントスイッチを無視／Web Audio は従う」という
  // 非対称な仕様を持つ。本作は BGM だけが HTML <audio> なので、そこだけ消音を無視していた。
  //   ① 新しめのiOS(16.4+) … sfx.js が navigator.audioSession.type="ambient" を宣言済み。
  //      これでページ全体が消音に従うので、追加の細工は不要（むしろ触らない方が安全）。
  //   ② それ以前のiOS       … ①のAPIが無い。そこで BGM の音を Web Audio へ通す。
  //      Web Audio は消音に従うので、経由させるだけでBGMも従うようになる。
  // ★保険は「効かない環境」だけに当てる。効いている環境で二重に細工すると、
  //   AudioContext が未解錠のときに無音になる等の別事故を招くため。
  function _isIOS() {
    try {
      var ua = navigator.userAgent || "";
      return /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);   // iPadOS
    } catch (e) { return false; }
  }
  function _audioSessionOK() {
    try { return !!(navigator.audioSession && "type" in navigator.audioSession); } catch (e) { return false; }
  }
  var _routed = new WeakSet ? new WeakSet() : null;   // 同じ要素に二度つなぐと例外になるので記録
  function routeThroughWebAudio(a) {
    // ★「端末が消音でも鳴らす」がONなら保険を当てない＝HTML audio のまま＝消音を無視して鳴る。
    //   （旧iOSではこれが唯一の「鳴らす」手段になる）
    try { if (typeof Sfx !== "undefined" && Sfx.isForceSound && Sfx.isForceSound()) return; } catch (e) {}
    if (!_isIOS() || _audioSessionOK()) return;        // ①で足りる環境／iOS以外は何もしない
    try {
      if (_routed && _routed.has(a)) return;
      var c = (typeof Sfx !== "undefined" && Sfx.context) ? Sfx.context() : null;
      if (!c || !c.createMediaElementSource) return;
      var src = c.createMediaElementSource(a);
      src.connect(c.destination);
      if (_routed) _routed.add(a);
      if (c.state === "suspended" && c.resume) { try { c.resume(); } catch (e) {} }
    } catch (e) { /* 失敗しても素の再生に落ちるだけ＝音が消えることはない */ }
  }

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
    pending = null;                 // 意図ごと止める（画面離脱・明示停止）
    if (audio) {
      try { audio.pause(); audio.src = ""; audio.load(); } catch (e) {}
      audio = null;
    }
  }

  // ゴール時：音量をなめらかに絞ってから停止（歓声に重ねてフェードアウト）。
  function fadeOut(ms) {
    pending = null;               // フェード終了後に勝手に復帰しない
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
    pending = { kind: "race" };          // ミュート中でも「レースBGMを鳴らすべき」を覚える
    if (isMuted()) return;
    var idx = pickIndex();
    if (idx < 0) return;                 // 曲が未設置 → 無音の no-op
    lastIdx = idx;
    try {
      var a = new Audio(RACE_BGM_DIR + encodeURIComponent(RACE_BGM_TRACKS[idx]));
      a.loop = true;                     // レースの長さに合わせてループ
      a.volume = BGM_BASE * bgmLevel;    // 効果音(Sfx master 0.42)に埋もれない程度（×ユーザー音量）
      routeThroughWebAudio(a);             // ★旧iOS向けの保険（新APIがある環境では何もしない）
      var p = a.play();
      if (p && p.catch) p.catch(function () {});   // 自動再生がブロックされても無視
      audio = a;
    } catch (e) { audio = null; }
  }

  // ミュート＝一時停止（曲と再生位置は保持）／解除＝その場で再開。
  // 再生中でなければ pending の意図（レースBGM/指定ファイル）から復帰する。
  // 旧実装（mute=破棄・解除=何もしない）は「一度消すとBGMが二度と鳴らない」バグ。
  function setMuted(m) {
    if (m) {
      if (audio) { try { audio.pause(); } catch (e) {} }
    } else {
      if (audio) {
        try { audio.volume = BGM_BASE * bgmLevel; var p = audio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      } else if (pending) {
        if (pending.kind === "file" && pending.path) playFile(pending.path, { once: pending.once });
        else start();
      }
    }
  }

  // ユーザー音量 0..1。再生中の audio へ即反映＋localStorage 保存（表示専用）。
  function setVolume(v) {
    bgmLevel = Math.max(0, Math.min(1, (v == null ? 1 : v)));
    try { localStorage.setItem(VOL_KEY, String(bgmLevel)); } catch (e) {}
    if (audio) { try { audio.volume = BGM_BASE * bgmLevel; } catch (e) {} }
  }
  function getVolume() { return bgmLevel; }

  // 任意ファイルをBGMとして再生（エンディングの「ある日森の中ドラゴンに出会った」等）。
  // audio を共有するので、音量スライダー(setVolume)・ミュート(setMuted)・停止(stop/fadeOut)がそのまま効く。
  function playFile(relPath, opts) {
    opts = opts || {};
    stop();
    pending = { kind: "file", path: relPath, once: !!opts.once };   // ミュート中でも意図を覚える→解除で復帰
    if (isMuted()) return;
    try {
      var parts = String(relPath).split("/");
      parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]);   // 日本語/空白のファイル名を安全に
      var a = new Audio(parts.join("/"));
      a.loop = !opts.once;   // once=true＝ループしない単発ジングル（結果画面のファンファーレ等）
      a.volume = BGM_BASE * bgmLevel;
      routeThroughWebAudio(a);             // ★旧iOS向けの保険（新APIがある環境では何もしない）
      var p = a.play(); if (p && p.catch) p.catch(function () {});
      audio = a;
    } catch (e) { audio = null; }
  }

  return {
    start: start,
    stop: stop,
    fadeOut: fadeOut,
    setMuted: setMuted,
    setVolume: setVolume,
    getVolume: getVolume,
    playFile: playFile,
    // 「端末が消音でも鳴らす」を切り替えた直後に呼ばれる。旧iOSでは経路（Web Audio経由か否か）
    // が変わるため、鳴らし直さないと新しい設定が効かない。意図(pending)から作り直す。
    reapplySession: function () {
      if (!audio || !pending) return;
      var k = pending.kind, p = pending.path, o = pending.once;
      stop();
      if (k === "file" && p) playFile(p, { once: o }); else start();
    },
    isPlaying: function () { return !!audio; },
    trackCount: function () { return RACE_BGM_TRACKS.length; }
  };
})();
if (typeof window !== "undefined") window.RaceBgm = RaceBgm;
