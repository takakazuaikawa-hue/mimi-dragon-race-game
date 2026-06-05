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
  var MUTE_KEY = "mimi_muted";

  // restore mute preference
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { muted = false; }

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.42;
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
      o.frequency.setValueAtTime(freq, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
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
      bp.frequency.value = freq || 4000; bp.Q.value = 0.8;
      var g = ctx.createGain(); g.gain.value = (gain == null ? 0.12 : gain);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  // simple major arpeggio helper
  function arp(freqs, t0, step, dur, type, gain) {
    for (var i = 0; i < freqs.length; i++) tone(freqs[i], t0 + i * step, dur, type, gain);
  }

  var C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568.0;

  function play(name) {
    if (muted) return;
    if (!ensure()) return;
    resume();
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
        case "nav": // soft navigation swoosh (screen change)
          tone(520, t, 0.08, "sine", 0.10, 820);
          break;
        case "miss": // gentle low "とすっ" — never harsh
          tone(220, t, 0.22, "sine", 0.22, 150);
          tone(165, t + 0.05, 0.28, "sine", 0.16, 120);
          break;
      }
    } catch (e) {}
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
    if (!muted) { ensure(); resume(); }
  }

  // self-installing unlock on first user gesture
  function unlock() { try { ensure(); resume(); } catch (e) {} }
  try {
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { passive: true });
    });
  } catch (e) {}

  return {
    play: play,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    unlock: unlock
  };
})();
if (typeof window !== "undefined") window.Sfx = Sfx;
