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

// ── 曲別ゲイン（B-2：素材ごとのラウドネス差を均す） ────────────────────────
// 納品mp3のラウドネスは曲ごとにバラバラで、同じ a.volume でも体感の大きさが倍近く違った
// （＝「モールの音が大きすぎる」の正体）。WebAudio の decodeAudioData で全曲のRMSを実測し、
// **一番静かな曲を1.0**として、他をRMS比で**下げるだけ**（上げない＝クリップさせない）。
// 実測は docs/FLOW_AUDIO_AUDIT_DIRECTIVE.md B-2 の表を参照。キーは**ファイル名だけ**。
// 曲を足したときは、ここに1行足さなければ 1.0（=素の音量）として鳴る。
// 実測（2026-07-30・全曲をdecodeAudioDataしてRMS）：基準＝一番静かな lets-do-this.mp3（RMS 0.1195 / -18.45dBFS）。
// gain = 0.1195 / その曲のRMS（＝どの曲も体感で同じ大きさに揃う／下げるだけなのでクリップしない）。
const TRACK_GAIN = {
  // bgm/racebgm/                          RMS      dBFS
  "crown-of-thunder.mp3": 0.80,         // 0.1502  -16.47
  "the-fanfare.mp3": 0.79,              // 0.1514  -16.40
  "sky-hero.mp3": 0.84,                 // 0.1425  -16.92
  "unlosable-battle.mp3": 0.76,         // 0.1564  -16.12
  "fog-cutting-flag.mp3": 0.88,         // 0.1364  -17.31
  "lets-do-this.mp3": 1.00,             // 0.1195  -18.45 ← 基準（一番静か）
  "fanfare-days.mp3": 0.83,             // 0.1445  -16.80
  // bgm/mallbgm/
  "mall-day.mp3": 0.81,                 // 0.1467  -16.67
  "mall-boss.mp3": 0.74,                // 0.1620  -15.81
  "mall-fever.mp3": 0.85,               // 0.1411  -17.01
  "mallでお買い物.mp3": 0.75,            // 0.1599  -15.92
  "ドラゴンモールで爆買いバニー.mp3": 0.59,  // 0.2026  -13.87 ← 一番大きい（「モールがうるさい」の主犯）
  "バニーガールメンタルで買い物モールは最高.mp3": 0.75,   // 0.1599  -15.92
  // bgm/homebgm/（いまは無音運用・鳴らすときのために測っておく）
  "くつろぎ.mp3": 0.86,                  // 0.1389  -17.15
  "ホームカントリー.mp3": 0.85,           // 0.1411  -17.01
  // bgm/（終章・エンディング）
  "絶滅のファンファーレ.mp3": 0.99,        // 0.1205  -18.38
  "ある日森の中ドラゴンに出会った.mp3": 0.84  // 0.1424  -16.93
};

var RaceBgm = (function () {
  var audio = null;
  var MUTE_KEY = "mimi_muted";
  var VOL_KEY = "mimi_bgmvol";
  var BGM_BASE = 0.42;          // チューニング済みの基準音量（=従来値）
  var bgmLevel = 1;             // ユーザー音量 0..1（1.0=従来）
  try { var _bv = parseFloat(localStorage.getItem(VOL_KEY)); if (_bv >= 0 && _bv <= 1) bgmLevel = _bv; } catch (e) {}
  var lastIdx = -1;   // 直前と同じ曲を避けて選ぶ

  // ── 「鳴っているaudioは常に1本」の不変条件 ────────────────────────────────
  // ★事故の実態（実測して確定・2026-07-30）：旧 fadeOut() は `audio = null` してから
  //   1.4〜3秒かけて**参照を失ったaudio**をフェードしていた。そのあいだに playFile()／stop()／
  //   setMuted() が来ても、それらは新しい（または存在しない）audio しか見ないので、
  //   古い曲は**止める手段のないまま鳴り続けた**。実測での再現：
  //     ゴール fadeOut(3000) → 結果画面のファンファーレ → モールへ移動 で **同時再生2本**
  //     （レース曲 t=24.66s v=0.273 と mall-day v=0.42 が並走）。
  //     さらに フェード中の stop() でも消えず／フェード中の ミュート でも消えなかった。
  // ★構造的な直し：フェード中も `audio` は**その要素を指したまま**にし、音量は
  //   「基準 × ユーザー音量 × 曲別ゲイン × ダッキング × フェード」の掛け算で一元管理する。
  //   差し替え・停止は必ず _detach()（pause＋src=""）を通り、世代番号(gen)で古いタイマーを黙らせる。
  var gen = 0;        // 世代番号。audio を差し替える／止めるたびに進む
  var fadeIv = null;  // 進行中のフェードアウト（同時に1本だけ）
  var fadeMul = 1;    // フェードの係数 1→0
  var curGain = 1;    // いま鳴っている曲の TRACK_GAIN
  var duckMul = 1;    // ダッキングの係数（効果音の瞬間だけ 0.35 へ）
  var duckT = null, duckIv = null;

  function _gainOf(relPath) {
    try {
      var base = decodeURIComponent(String(relPath).split("/").pop());
      var g = TRACK_GAIN[base];
      return (g > 0 && g <= 1) ? g : 1;
    } catch (e) { return 1; }
  }
  // いま鳴っているaudioへ音量を反映（掛け算はここ1箇所だけ＝フェード/ダッキング/スライダが喧嘩しない）。
  function _applyVolume() {
    if (!audio) return;
    try { audio.volume = Math.max(0, Math.min(1, BGM_BASE * bgmLevel * curGain * duckMul * fadeMul)); } catch (e) {}
  }
  function _detach(a) { try { a.pause(); a.src = ""; a.load(); } catch (e) {} }
  function _clearFade() { if (fadeIv) { clearInterval(fadeIv); fadeIv = null; } fadeMul = 1; }
  function _clearDuck() {
    if (duckT) { clearTimeout(duckT); duckT = null; }
    if (duckIv) { clearInterval(duckIv); duckIv = null; }
    duckMul = 1;
  }
  // 新しい曲を主役に据える共通口（start/playFile はこれだけを通る）。
  function _adopt(a, relPath) {
    curGain = _gainOf(relPath);
    audio = a;
    _applyVolume();
  }
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
    gen++;                          // ★進行中のフェードを黙らせる（下のタイマーは何もしなくなる）
    _clearFade();
    _clearDuck();
    if (audio) { _detach(audio); audio = null; }
  }

  // ゴール時：音量をなめらかに絞ってから停止（歓声に重ねてフェードアウト）。
  // ★フェード中も audio はこの要素を指したまま＝stop()／playFile()／setMuted() が必ず届く
  //   （＝新しい曲が始まった瞬間に古い曲は消える＝二重再生が原理的に起きない）。
  function fadeOut(ms) {
    pending = null;               // フェード終了後に勝手に復帰しない
    if (!audio) return;
    var a = audio, myGen = ++gen;
    _clearFade();                 // 二重フェードで音量が飛ぶのを防ぐ（直前のフェードは畳む）
    var dur = ms || 1400, steps = 20, i = 0;
    var iv = setInterval(function () {
      if (myGen !== gen || audio !== a) { clearInterval(iv); return; }   // 世代交代済み＝もう主役ではない
      i++;
      fadeMul = Math.max(0, 1 - i / steps);
      _applyVolume();
      if (i >= steps) { clearInterval(iv); if (fadeIv === iv) fadeIv = null; stop(); }
    }, dur / steps);
    fadeIv = iv;
  }

  // ★B-3 ダッキング：勝利/レジェンダリー等の効果音が鳴る瞬間だけBGMを下げ、静かに戻す。
  //   触るのは**BGMの音量だけ**（効果音側は一切変えない）。曲の再生位置もそのまま。
  var DUCK_MUL = 0.35, DUCK_HOLD = 200, DUCK_BACK = 1200;
  function duck() {
    if (!audio) return;
    _clearDuck();
    duckMul = DUCK_MUL;
    _applyVolume();
    duckT = setTimeout(function () {
      duckT = null;
      var i = 0, steps = 12;
      duckIv = setInterval(function () {
        i++;
        duckMul = DUCK_MUL + (1 - DUCK_MUL) * (i / steps);
        if (i >= steps) { duckMul = 1; clearInterval(duckIv); duckIv = null; }
        _applyVolume();
      }, DUCK_BACK / steps);
    }, DUCK_HOLD);
  }

  function start() {
    stop();
    pending = { kind: "race" };          // ミュート中でも「レースBGMを鳴らすべき」を覚える
    if (isMuted()) return;
    var idx = pickIndex();
    if (idx < 0) return;                 // 曲が未設置 → 無音の no-op
    lastIdx = idx;
    try {
      var name = RACE_BGM_TRACKS[idx];
      var a = new Audio(RACE_BGM_DIR + encodeURIComponent(name));
      a.loop = true;                     // レースの長さに合わせてループ
      routeThroughWebAudio(a);             // ★旧iOS向けの保険（新APIがある環境では何もしない）
      _adopt(a, name);                   // 音量＝基準×ユーザー音量×曲別ゲイン（効果音に埋もれない程度）
      var p = a.play();
      if (p && p.catch) p.catch(function () {});   // 自動再生がブロックされても無視
    } catch (e) { audio = null; }
  }

  // ミュート＝一時停止（曲と再生位置は保持）／解除＝その場で再開。
  // 再生中でなければ pending の意図（レースBGM/指定ファイル）から復帰する。
  // 旧実装（mute=破棄・解除=何もしない）は「一度消すとBGMが二度と鳴らない」バグ。
  function setMuted(m) {
    if (m) {
      // ★フェード中のミュートは「そのまま止める」＝復帰先(pending)は fadeOut が既に消しているので、
      //   一時停止でお茶を濁すと**消したのに鳴り続ける**（実測済のバグ）。
      if (fadeIv) { stop(); return; }
      if (audio) { try { audio.pause(); } catch (e) {} }
    } else {
      if (audio) {
        try { _applyVolume(); var p = audio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
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
    _applyVolume();   // 曲別ゲイン・フェード・ダッキングを保ったままスライダぶんだけ反映
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
      routeThroughWebAudio(a);             // ★旧iOS向けの保険（新APIがある環境では何もしない）
      _adopt(a, relPath);                  // 音量＝基準×ユーザー音量×曲別ゲイン
      var p = a.play(); if (p && p.catch) p.catch(function () {});
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
    duck: duck,           // ★効果音の瞬間だけBGMを下げる（sfx.js から呼ばれる・音量以外は触らない）
    // 「端末が消音でも鳴らす」を切り替えた直後に呼ばれる。旧iOSでは経路（Web Audio経由か否か）
    // が変わるため、鳴らし直さないと新しい設定が効かない。意図(pending)から作り直す。
    reapplySession: function () {
      if (!audio || !pending) return;
      var k = pending.kind, p = pending.path, o = pending.once;
      stop();
      if (k === "file" && p) playFile(p, { once: o }); else start();
    },
    isPlaying: function () { return !!audio; },
    trackCount: function () { return RACE_BGM_TRACKS.length; },
    // 検証用の覗き窓（表示専用・ゲームは読まない）。混在バグの再発を機械確認するために置く。
    debugState: function () {
      return { gen: gen, fading: !!fadeIv, curGain: curGain, duckMul: +duckMul.toFixed(3),
               fadeMul: +fadeMul.toFixed(3), vol: audio ? +audio.volume.toFixed(3) : null,
               src: audio ? decodeURIComponent((audio.src || "").split("/").pop()) : null };
    }
  };
})();
if (typeof window !== "undefined") window.RaceBgm = RaceBgm;
