/**
 * mall_bgm.js — 「巨大モール大冒険」の手続きBGM（音声ファイル無し・WebAudio合成）。
 *
 * sfx.js と同じ「アセット無し」方針で、曲も実行時に合成する小さなシーケンサ。
 * ・探索＝穏やかなペンタトニック、戦闘＝速い短調ドライブ。フロアで根音/テンポが変わる。
 * ・全体ミュート（Sfx と同じ "mimi_muted"）と、RaceBgm と同じ音量キー("mimi_bgmvol")を尊重。
 * ・モール画面を離れる/ミュートされると自動停止（スケジューラが画面を監視）。
 * ・レース結果・オッズ・配当には一切触れない純粋な音声機能（HARD制約厳守・表示専用メタ）。
 */
var MallBgm = (function () {
  var ctx = null, master = null, timer = null;
  var MUTE_KEY = "mimi_muted", VOL_KEY = "mimi_bgmvol";
  var BGM_BASE = 0.26;                 // 効果音より控えめに敷く
  var level = 1;                        // ユーザー音量 0..1（RaceBgmと共有）
  try { var v = parseFloat(localStorage.getItem(VOL_KEY)); if (v >= 0 && v <= 1) level = v; } catch (e) {}

  var curKey = null;                   // 現在の曲キー（mood:floorバケット）。同一なら鳴らし直さない
  var track = null;                    // 現在のトラック・パラメータ
  var step = 0, nextT = 0, bar = 0;

  // 16ステップの旋律（音階の度数。-1=休符）。ランダムでなく“曲”に聞こえるよう固定パターン。
  var MEL_EXPLORE = [0, -1, 2, 4, -1, 2, -1, 4, 5, -1, 4, 2, -1, 0, -1, -1];
  var MEL_BATTLE  = [0, 0, 3, 0, 5, 3, 2, 0, 7, 5, 3, 2, 0, 3, 2, -1];
  var PENTA_MAJ = [0, 2, 4, 7, 9];     // 明るい（探索）
  var PENTA_MIN = [0, 3, 5, 7, 10];    // 緊張（戦闘）

  function muted() {
    try { if (typeof Sfx !== "undefined" && Sfx.isMuted) return Sfx.isMuted(); return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; }
  }
  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = BGM_BASE * level; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function semis(scale, deg) { var n = scale.length; return scale[((deg % n) + n) % n] + 12 * Math.floor(deg / n); }
  function freqOf(root, scale, deg) { return root * Math.pow(2, semis(scale, deg) / 12); }

  // 1音（ADSR付きオシレータ）。
  function note(freq, t, dur, wave, peak) {
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave || "triangle"; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  // 戦闘のキック（低い正弦の落下）。
  function kick(t) {
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
    } catch (e) {}
  }

  // 1ステップぶんを t に予約。
  function schedule(s, t) {
    var beat = track.beat, mel = track.mel, scale = track.scale, root = track.root;
    var deg = mel[s % 16];
    if (deg >= 0) note(freqOf(root, scale, deg + track.melOct), t, beat * (track.legato || 1.6), track.lead, track.battle ? 0.16 : 0.13);
    if (s % 4 === 0) {                                   // 拍頭：ベース
      note(root / 2, t, beat * 1.8, "sine", 0.18);
      if (track.battle) kick(t);
    }
    if (track.battle && s % 2 === 1) note(root / 2, t, beat * 0.5, "square", 0.05);   // 裏拍の刻み
    if (!track.battle && s % 8 === 0) {                  // 探索：2小節ごとに柔らかいパッド和音
      [0, 2, 4].forEach(function (d) { note(freqOf(root, scale, d) / 1, t, beat * 7, "sine", 0.045); });
    }
  }

  function tick() {
    if (!ctx || !track) return;
    if (muted() || !window.state || state.ui.screen !== "mall_rpg") { stop(); return; }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    var horizon = ctx.currentTime + 0.18;
    while (nextT < horizon) {
      schedule(step, nextT);
      nextT += track.beat; step++;
      if (step % 16 === 0) { bar++; track.melOct = (bar % 4 === 3) ? 1 : 0; }   // 時々1オクターブ上げて単調回避
    }
  }

  function makeTrack(mood, fi, tower) {
    var f = tower ? 4 : (fi || 0);
    if (mood === "battle") {
      var bpm = 132 + (f % 4) * 6, beat = 60 / bpm / 2;
      return { battle: true, beat: beat, mel: MEL_BATTLE, scale: PENTA_MIN, lead: "sawtooth",
        root: 196 * Math.pow(2, ((f % 5) - 2) / 12), melOct: 0, legato: 1.1 };
    }
    var bpmE = 82 + (f % 5) * 3, beatE = 60 / bpmE / 2;
    // フロアが上がるほど根音もわずかに上昇（昇っていく感覚）。
    return { battle: false, beat: beatE, mel: MEL_EXPLORE, scale: PENTA_MAJ, lead: "triangle",
      root: 261.6 * Math.pow(2, [0, 2, 3, 5, 7, 8, 10, 12][f % 8] / 12), melOct: 0, legato: 1.8 };
  }

  // mood: "explore" | "battle"。同一トラックなら鳴らし直さない（描画ごとに呼ばれても安全）。
  function play(mood, fi, tower) {
    if (muted()) { stop(); return; }
    var key = mood + ":" + (mood === "battle" ? "b" : (tower ? "t" : (fi || 0)));
    if (key === curKey && timer) return;                 // 既に同じ曲を再生中
    if (!ensure()) return;
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) {}
    curKey = key; track = makeTrack(mood, fi, tower);
    master.gain.value = BGM_BASE * level;
    step = 0; bar = 0; nextT = ctx.currentTime + 0.08;
    if (!timer) timer = setInterval(tick, 25);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    curKey = null; track = null;
    if (master && ctx) { try { master.gain.value = 0.0001; } catch (e) {} }
  }
  function setMuted(m) { if (m) stop(); }
  function setVolume(x) {
    level = Math.max(0, Math.min(1, (x == null ? 1 : x)));
    try { localStorage.setItem(VOL_KEY, String(level)); } catch (e) {}
    if (master) { try { master.gain.value = BGM_BASE * level; } catch (e) {} }
  }
  function getVolume() { return level; }

  return { play: play, stop: stop, setMuted: setMuted, setVolume: setVolume, getVolume: getVolume,
    isPlaying: function () { return !!timer; } };
})();
if (typeof window !== "undefined") window.MallBgm = MallBgm;
