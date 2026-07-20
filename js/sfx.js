/**
 * sfx.js — tiny procedural sound engine (spec #37, Tier 1).
 *
 * ALL sounds are synthesized live with the WebAudio API — there are NO audio
 * files (consistent with the project's "no asset files" rule). Everything is
 * wrapped in try/catch so audio can never break the game; if WebAudio is
 * missing or blocked, calls are silent no-ops.
 *
 * Browsers require a user gesture before an AudioContext can make sound, so we
 * self-install one-time unlock listeners (pointerdown/keydown/touchstart) that
 * create + resume the context on the player's first interaction. By the time a
 * result screen is reached (after clicking through betting + race), audio is
 * unlocked.
 *
 * Public API:
 *   Sfx.play(name)      — fire a named cue (win / bigwin / legendary / miss /
 *                         coin / tick / click / streak / unlock)
 *   Sfx.setMuted(bool)  — mute/unmute (persisted to localStorage)
 *   Sfx.isMuted()       — current mute state
 *   Sfx.unlock()        — ensure + resume the context (called on user gesture)
 */
var Sfx = (function () {
  var ctx = null;
  var master = null;
  var muted = false;
  var crowd = null;                 // sustained goal-crowd controller (loops until stopped)
  var MUTE_KEY = "mimi_muted";
  var VOL_KEY = "mimi_sfxvol";
  var SFX_BASE = 0.42;          // チューニング済みの基準音量（=従来の master 値）
  var sfxLevel = 1;             // ユーザー音量 0..1（1.0=従来の音量）
  var pr = 1;                   // ピッチ倍率（play の第2引数。1=従来どおり。連発音の単調さ回避用）

  // restore mute preference
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { muted = false; }
  // restore SFX volume preference
  try { var _sv = parseFloat(localStorage.getItem(VOL_KEY)); if (_sv >= 0 && _sv <= 1) sfxLevel = _sv; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = SFX_BASE * sfxLevel;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function resume() {
    try { if (ctx && ctx.state === "suspended") ctx.resume(); } catch (e) {}
  }

  // one oscillator "blip" with an attack/decay envelope
  function tone(freq, t0, dur, type, gain, glideTo) {
    if (!ctx) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq * pr, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo * pr, t0 + dur);
      var peak = (gain == null ? 0.3 : gain);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }

  // short filtered-noise burst (sparkle / coin shimmer)
  function noise(t0, dur, gain, freq) {
    if (!ctx) return;
    try {
      var n = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = (freq || 4000) * pr; bp.Q.value = 0.8;
      var g = ctx.createGain(); g.gain.value = (gain == null ? 0.12 : gain);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  // crowd-roar swell: flat noise → bandpass → a rise/hold/fall gain envelope
  // (the goal "ワーッ"). Layer several at different bands for a fuller crowd.
  function noiseSwell(t0, dur, peak, freq, q) {
    if (!ctx) return;
    try {
      var n = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(); src.buffer = buf;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = freq || 1500; bp.Q.value = (q == null ? 0.7 : q);
      var g = ctx.createGain();
      var p = (peak == null ? 0.18 : peak);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p, t0 + dur * 0.30);        // swell up
      g.gain.exponentialRampToValueAtTime(p * 0.82, t0 + dur * 0.6);  // hold
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);          // fade
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.03);
    } catch (e) {}
  }

  // simple major arpeggio helper
  function arp(freqs, t0, step, dur, type, gain) {
    for (var i = 0; i < freqs.length; i++) tone(freqs[i], t0 + i * step, dur, type, gain);
  }

  var C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568.0;

  function play(name, rate) {
    if (muted) return;
    if (!ensure()) return;
    resume();
    pr = (rate > 0 ? rate : 1);             // 任意のピッチ倍率（連発音の単調さ回避）。既定1=従来どおり
    var t = ctx.currentTime + 0.01;
    try {
      switch (name) {
        case "win": // pleasant rising triad
          arp([C5, E5, G5], t, 0.08, 0.2, "triangle", 0.28);
          noise(t + 0.18, 0.18, 0.06, 5200);
          break;
        case "bigwin": // brighter fanfare + sparkle tail
          arp([C5, E5, G5, C6], t, 0.085, 0.28, "sawtooth", 0.22);
          arp([G5, C6, E6], t + 0.42, 0.07, 0.22, "triangle", 0.22);
          noise(t + 0.4, 0.35, 0.1, 6000);
          break;
        case "legendary": // full fanfare, octave stack, long sparkle
          arp([C5, E5, G5, C6], t, 0.09, 0.34, "sawtooth", 0.22);
          arp([E6, G6, C6 * 2], t + 0.5, 0.08, 0.3, "square", 0.16);
          tone(C5 / 2, t, 0.9, "sine", 0.18);
          for (var i = 0; i < 8; i++) noise(t + 0.45 + i * 0.07, 0.12, 0.08, 5000 + i * 350);
          break;
        case "coin": // single coin "ting"
          tone(988, t, 0.05, "square", 0.22);
          tone(1319, t + 0.04, 0.09, "square", 0.18);
          break;
        case "tick": // count-up tick (very soft)
          tone(1200, t, 0.02, "square", 0.05);
          break;
        case "streak": // streak-up swoop
          tone(440, t, 0.18, "triangle", 0.22, 880);
          tone(660, t + 0.1, 0.16, "triangle", 0.18, 1100);
          break;
        case "unlock": // reward/unlock chime
          arp([G5, C6, E6], t, 0.1, 0.3, "triangle", 0.24);
          noise(t + 0.25, 0.3, 0.08, 6500);
          break;
        case "click": // soft UI tap
          tone(330, t, 0.03, "sine", 0.12);
          break;
        case "paho": // ミミの「ぱほぱほ♪」風 — 軽いふた跳ねのかわいい合いの手
          tone(740, t, 0.07, "triangle", 0.20, 980);
          tone(620, t + 0.09, 0.10, "triangle", 0.18, 830);
          noise(t + 0.02, 0.04, 0.035, 5200);
          break;
        case "nav": // soft navigation swoosh (screen change)
          tone(520, t, 0.08, "sine", 0.10, 820);
          break;
        case "miss": // gentle low "とすっ" — never harsh
          tone(220, t, 0.22, "sine", 0.22, 150);
          tone(165, t + 0.05, 0.28, "sine", 0.16, 120);
          break;
        case "start": // レーススタートの号砲「パーンッ」（鋭い破裂音）
          noise(t, 0.09, 0.45, 1600);                       // 破裂の胴
          noise(t, 0.07, 0.48, 3400);                       // 明るい芯（パッ）
          noise(t, 0.045, 0.36, 6500);                      // エア感の立ち上がり
          tone(1850, t + 0.006, 0.16, "square", 0.18, 900); // 短いリング（…ーンッ）一瞬で落ちる
          tone(2750, t + 0.006, 0.11, "square", 0.10, 1500);// リング上層
          break;
        case "cheer": // ゴールの歓声「ワーッ」（観客のどよめき・スウェル）
          noiseSwell(t,        1.6, 0.16, 650,  0.5);  // 低いどよめき
          noiseSwell(t + 0.05, 1.5, 0.20, 1500, 0.7);  // 主体
          noiseSwell(t + 0.12, 1.3, 0.10, 3000, 0.9);  // 明るい上層
          break;
        case "amb_wave": // 🌊 さざ波／そよ風（やわらかいスウェル・環境音）
          noiseSwell(t,        1.3, 0.05, 480,  0.45);
          noiseSwell(t + 0.18, 1.0, 0.03, 1100, 0.7);
          break;
        case "amb_crowd": // 👥 遠いざわめき（人波のフロア）
          noiseSwell(t,        1.5, 0.045, 700,  0.6);
          noiseSwell(t + 0.12, 1.2, 0.025, 1700, 0.85);
          break;
        case "amb_chime": // 🔔 上品なベル（高級フロア・館内放送ふう）
          tone(1318.5, t,        0.55, "sine", 0.045);
          tone(1760.0, t + 0.14, 0.6,  "sine", 0.035);
          tone(2093.0, t + 0.30, 0.5,  "sine", 0.025);
          break;
        case "alert": // ⚠ 戦闘の予兆スティング「ヒュンッ…ジャッ」（危険の予告・短く緊張感）
          noise(t, 0.05, 0.13, 2600);                       // 立ち上がりの“スッ”
          tone(880, t, 0.16, "sawtooth", 0.15, 300);        // 危険のひゅ〜ん（急降下）
          tone(174.6, t + 0.02, 0.22, "square", 0.11);      // 低い胴鳴り（緊張）
          tone(370, t + 0.13, 0.10, "square", 0.10, 280);   // 締めの“ジャッ”
          break;
      }
    } catch (e) {}
    pr = 1;                                  // 次の呼び出しに持ち越さない（既定へ戻す）
  }

  // ---- sustained crowd roar (goal celebration) — loops until stopCrowd() ----
  // ゴールで「ワーッ」と湧き、結果を見る（stopCrowd）まで鳴り続ける厚い歓声。
  // 帯域の違うループノイズを重ね、各層をゆっくり揺らして“生きた群衆”にする。
  // 歓声の長さ（秒）。うるさければ CROWD_HOLD を縮めるだけでよい。
  var CROWD_HOLD = 4.4;    // 湧いてから持続する長さ（主LFO 約2.2秒/波 × 2波・ユーザー指定）
  var CROWD_TAIL = 2.0;    // そこから引くまでの余韻（長めに取って余韻を残す・ユーザー指定）
  var _crowdEndT = null;   // 自動終了のタイマー（音源の後始末用）
  function startCrowd() {
    if (muted) return;
    if (!ensure()) return;
    resume();
    stopCrowd(true);                                            // 念のため前の歓声を消す
    try {
      var now = ctx.currentTime;
      var out = ctx.createGain();
      // ★歓声は「湧いて・3回うねって・引く」で終わらせる（ユーザー指摘：ループだとうるさい）。
      //   実体は連続ノイズなので“回数”は主LFO（約0.45Hz≒2.2秒/波）のうねりで数える。
      //   3波ぶん＝約6.6秒を持続させ、そのあと1.6秒かけて自然に引く。
      //   ★包絡線で書く（JSタイマーではなく）＝フレーム落ちや裏画面でもズレない。
      out.gain.setValueAtTime(0.0001, now);
      out.gain.exponentialRampToValueAtTime(0.58, now + 0.35);  // ワーッ！と湧く頂点（前に出す）
      out.gain.exponentialRampToValueAtTime(0.40, now + 1.4);   // 持続レベル（前に出す）
      out.gain.setValueAtTime(0.40, now + CROWD_HOLD);          // ここまで持続（3波ぶん）
      out.gain.exponentialRampToValueAtTime(0.0001, now + CROWD_HOLD + CROWD_TAIL);   // 余韻を残して引く
      out.connect(master);
      var len = Math.floor(ctx.sampleRate * 2);                 // 2秒ループのホワイトノイズ
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // 低域を厚く＝地鳴りのような重さ。サブ＆ロー帯を足し、高域は控えめに。
      var bands = [
        { f: 110,  q: 0.4, g: 0.78 },   // 地鳴り（サブ）
        { f: 260,  q: 0.5, g: 0.68 },   // 低いどよめき
        { f: 600,  q: 0.6, g: 0.60 },   // 主体・下
        { f: 1300, q: 0.8, g: 0.50 },   // 主体・上
        { f: 2600, q: 1.0, g: 0.26 },   // 明るい層
        { f: 3800, q: 1.2, g: 0.14 }    // きらめき（控えめ）
      ];
      var nodes = [];
      bands.forEach(function (b, k) {
        var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        src.playbackRate.value = 0.85 + k * 0.12;               // 層ごとに微妙にずらして厚く
        var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = b.f; bp.Q.value = b.q;
        var g = ctx.createGain(); g.gain.value = b.g;
        var lfo = ctx.createOscillator(); lfo.type = "sine";
        lfo.frequency.value = 0.45 + k * 0.33;                  // ゆっくりした波（生きた群衆）
        var lfoG = ctx.createGain(); lfoG.gain.value = b.g * 0.4;
        lfo.connect(lfoG); lfoG.connect(g.gain);
        src.connect(bp); bp.connect(g); g.connect(out);
        src.start(now); lfo.start(now);
        nodes.push(src, lfo);
      });
      crowd = { out: out, nodes: nodes };
      // 包絡線が引き切ったら音源を止めて片付ける（鳴らないノードを回し続けない）。
      // 明示的な stopCrowd が先に走った場合は crowd が差し替わっているので何もしない。
      var mine = crowd;
      nodes.forEach(function (n) { try { n.stop(now + CROWD_HOLD + CROWD_TAIL + 0.1); } catch (e) {} });
      if (_crowdEndT) clearTimeout(_crowdEndT);
      _crowdEndT = setTimeout(function () {
        if (crowd === mine) crowd = null;   // 自然終了：以後の stopCrowd は何もしない
      }, (CROWD_HOLD + CROWD_TAIL + 0.2) * 1000);
    } catch (e) { crowd = null; }
  }
  function stopCrowd(immediate) {
    if (!crowd) return;
    var c = crowd; crowd = null;
    try {
      var now = ctx ? ctx.currentTime : 0;
      var rel = immediate ? 0.05 : 0.4;
      if (ctx && c.out) {
        var cur = 0.27;
        try { cur = Math.max(0.0001, c.out.gain.value); } catch (e) {}
        c.out.gain.cancelScheduledValues(now);
        c.out.gain.setValueAtTime(cur, now);
        c.out.gain.exponentialRampToValueAtTime(0.0001, now + rel);
      }
      c.nodes.forEach(function (n) { try { n.stop(now + rel + 0.05); } catch (e) {} });
    } catch (e) {}
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
    if (muted) stopCrowd(true);                                 // ミュートで歓声ループも止める
    if (!muted) { ensure(); resume(); }
  }

  // ユーザー音量 0..1。master へ即反映＋localStorage 保存（表示専用＝着順/オッズ/配当に非干渉）。
  function setVolume(v) {
    sfxLevel = Math.max(0, Math.min(1, (v == null ? 1 : v)));
    try { localStorage.setItem(VOL_KEY, String(sfxLevel)); } catch (e) {}
    if (master) { try { master.gain.value = SFX_BASE * sfxLevel; } catch (e) {} }
  }
  function getVolume() { return sfxLevel; }

  // ── iPhone のサイレントスイッチを尊重させる ───────────────────────────
  // ★実機で「本体を消音にしてもBGMだけ鳴る」報告への対処。
  //   iOS Safari の仕様（調査済み・出典 adactio.com/journal/19929 ほか）：
  //     ・Web Audio API   … サイレントスイッチに従う（消音なら鳴らない）
  //     ・HTML <audio> 要素 … サイレントスイッチを無視して鳴る
  //   このゲームは 効果音=Web Audio / BGM=new Audio() なので、BGMだけが鳴り続けていた。
  //   Audio Session API（iOS 16.4+）で種別を "ambient" にすると、ページ全体が
  //   iOS の AVAudioSessionCategoryAmbient 相当＝サイレントスイッチに従い、
  //   他アプリの音楽とも共存する（ゲームのBGMとして望ましい既定）。
  //   ★非対応環境では何も起こらない安全な no-op。
  // ★どちらを上位にするかはプレイヤーが決める（Webに消音スイッチの状態を読むAPIは無いので、
  //   「いま消音中です」と正確に出すことはできない。できるのは主導権を選ばせることだけ）。
  //   既定は OFF＝端末を尊重（マナーモードなのに突然鳴る事故を起こさない）。
  //   ON にすると "playback"＝消音スイッチを無視して鳴らす（本人が明示的に選んだ場合のみ）。
  var OVR_KEY = "mimi_force_sound";
  var forceSound = false;
  try { forceSound = localStorage.getItem(OVR_KEY) === "1"; } catch (e) {}
  function applyAudioSession() {
    try {
      if (navigator.audioSession && "type" in navigator.audioSession) {
        navigator.audioSession.type = forceSound ? "playback" : "ambient";
        return true;
      }
    } catch (e) {}
    return false;
  }
  // 「端末が消音でも鳴らす」の切り替え。即座に反映し、保存する。
  function setForceSound(on) {
    forceSound = !!on;
    try { localStorage.setItem(OVR_KEY, forceSound ? "1" : "0"); } catch (e) {}
    applyAudioSession();
    try { if (typeof RaceBgm !== "undefined" && RaceBgm.reapplySession) RaceBgm.reapplySession(); } catch (e) {}
    return forceSound;
  }
  function isForceSound() { return forceSound; }
  applyAudioSession();
  // 復帰時に既定へ戻る実装があるため、画面が戻るたびに念のため貼り直す。
  try {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) applyAudioSession();
    });
  } catch (e) {}

  // self-installing unlock on first user gesture
  function unlock() { try { applyAudioSession(); ensure(); resume(); } catch (e) {} }
  try {
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { passive: true });
    });
  } catch (e) {}

  return {
    play: play,
    startCrowd: startCrowd,
    stopCrowd: stopCrowd,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    // 実機診断用：iOSのサイレントスイッチ対応が効いているかを外から確認できるようにする。
    //   supported=false … iOS 16.4 未満など未対応（BGMは消音でも鳴る可能性が残る）
    //   type="ambient"  … 適用済み＝本体の消音に従う
    setForceSound: setForceSound,
    isForceSound: isForceSound,
    audioSessionInfo: function () {
      var t = null, sup = false;
      try { sup = !!(navigator.audioSession && "type" in navigator.audioSession); if (sup) t = navigator.audioSession.type; } catch (e) {}
      return { supported: sup, type: t };
    },
    setVolume: setVolume,
    getVolume: getVolume,
    unlock: unlock,
    // ★BGM(HTML audio)を Web Audio 経由へ流し込むために共有する。
    //   iOS は HTML audio だけサイレントスイッチを無視するので、Web Audio を通せば
    //   BGMも本体の消音に従うようになる（bgm.js の routeThroughWebAudio が使う）。
    context: function () { try { return ensure(); } catch (e) { return null; } }
  };
})();
if (typeof window !== "undefined") window.Sfx = Sfx;
