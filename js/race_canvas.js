/**
 * race_canvas.js — the smooth <canvas> race player.
 *
 * Animates the continuous timeline (race_timeline_engine.js) so the player can
 * actually SEE the race: dragons move by true distance on a scrolling track,
 * trade places moment to moment, speed up / slow down, stumble, dig in, tire —
 * and the winner breaks the tape at a real ゴール line. The numbers are never
 * touched here; the on-screen finish order equals raceResult exactly because the
 * timeline guarantees it.
 *
 * Layering: the track + dragons + particles + finish are painted on <canvas>;
 * the HUD (phase / weather / 残り距離 / live rank bar / bet), the Mimi telop, and
 * the buttons are DOM on top (crisp text, reuse existing styles).
 *
 * Public:  startRaceCanvas(container, ctx) → controller (also state.current.racePlayer)
 *          stopRacePlayer()                → stop & detach the active player
 *
 * Depends on: utils.js (el, clamp, fmtCoins), data_dragons.js (dragonColor),
 *   commentary_data.js (commentaryName), data_races.js (raceFullName),
 *   data_weather.js (WEATHERS), race_timeline_engine.js (buildRaceTimeline).
 */

let RC_ACTIVE = null;

function stopRacePlayer() {
  if (RC_ACTIVE) { RC_ACTIVE.stop(); RC_ACTIVE = null; }
}

// ---------- colour helpers ----------
function rcHexToRgb(hex) {
  let h = (hex || "#888").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rcShade(hex, pct) {
  const c = rcHexToRgb(hex);
  const f = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  const r = Math.round((f - c.r) * p) + c.r;
  const g = Math.round((f - c.g) * p) + c.g;
  const b = Math.round((f - c.b) * p) + c.b;
  return `rgb(${r},${g},${b})`;
}
function rcRgba(hex, a) { const c = rcHexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; }
function rcMix(a, b, t) {        // blend two hex colours (t: 0→a, 1→b)
  const ca = rcHexToRgb(a), cb = rcHexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}

// =========================================================================
// Course terrain — turns each race's real early/mid/late SECTION
// (data_courses.js: 上り坂 / 狭路 / 火門 / 霧中 / 大旋回 / 小回り連続 / 上空風路 /
// 起伏地帯 / 混戦橋 / 火山フィニッシュ …) into a DISTINCT on-track look: sky &
// ground tint, a backdrop silhouette, scrolling roadside props, and ambient
// particles. Purely presentational — it reads the already-decided section data
// and never touches progress, odds, payouts or the result.
// =========================================================================
function rcThemeOf(sectionKey) {
  const k = sectionKey || "";
  if (/uphill/.test(k))                return "uphill";
  if (/narrow/.test(k))                return "narrow";
  if (/fire|volcanic/.test(k))         return "fire";
  if (/mist|fog/.test(k))              return "mist";
  if (/aerial|tailwind|wind/.test(k))  return "wind";
  if (/turn/.test(k))                  return "turn";
  if (/rolling/.test(k))               return "rolling";
  if (/bridge/.test(k))                return "bridge";
  return "straight";
}
// sky = 3 gradient stops; ground = 3 stops; accent tints props/particles.
const RC_THEME = {
  straight: { sky: ["#10162e", "#1d2547", "#2a2140"], ground: ["#34502f", "#3c5a37", "#22361f"], accent: "#cfe6ff", amb: null },
  uphill:   { sky: ["#15192f", "#242c4d", "#2d2342"], ground: ["#3b4f2b", "#43562e", "#27371c"], accent: "#bfe0a8", amb: null },
  narrow:   { sky: ["#0e1326", "#1a1f38", "#241d31"], ground: ["#3b4630", "#434a32", "#251f16"], accent: "#e0cf9a", amb: null },
  fire:     { sky: ["#22101f", "#3d1620", "#491f17"], ground: ["#423424", "#4a2f22", "#2a1712"], accent: "#ff9a52", amb: "ember" },
  mist:     { sky: ["#1b2436", "#29334a", "#343c50"], ground: ["#33473a", "#3a4d40", "#21302a"], accent: "#d6e4ee", amb: "fog" },
  wind:     { sky: ["#10203a", "#1d3556", "#27496b"], ground: ["#2f4a3a", "#356040", "#1f3a2a"], accent: "#c4e8ff", amb: "gust" },
  turn:     { sky: ["#121831", "#212b4f", "#2a2344"], ground: ["#33502f", "#3a5a37", "#21361f"], accent: "#ffe06a", amb: null },
  rolling:  { sky: ["#13192e", "#232d49", "#2b2540"], ground: ["#37502e", "#405a35", "#23361d"], accent: "#c2e2aa", amb: "leaf" },
  bridge:   { sky: ["#0f1a30", "#1b2c4a", "#243a52"], ground: ["#2d3f49", "#324a55", "#1c2b33"], accent: "#bcd8e8", amb: null }
};

// =========================================================================
// Pixel dragon, drawn on canvas. Keeps the cute identity (base colour + belly +
// spine), but is fully parameterised so body language reflects the timeline:
// gait tempo & lean from speed, wing flap, head-down + sweat when tiring,
// rotation when stumbling, glow when surging.
// =========================================================================
function rcDrawDragon(ctx, o) {
  const s = o.scale;
  const base = o.color;
  const dark  = rcShade(base, -40), mid = rcShade(base, -16),
        light = rcShade(base, 30),  belly = rcShade(base, 60),
        horn  = rcShade(base, -54);
  const gait = o.gait || 0;
  const lean = o.lean || 0;
  const bank = o.bank || 0;        // banking into a turn
  const spread = o.spread || 0;    // wing spread on wind lanes (0..1)

  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.tumble) ctx.rotate(o.tumble);
  ctx.scale(s, s);
  ctx.rotate(-lean * 0.16 + bank * 0.13);   // lean forward when fast, tilt into turns

  // ---- surge aura (radial, fades out) ----
  if (o.glow > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 * o.glow;
    const ag = ctx.createRadialGradient(-1, -6, 2, -1, -6, 27);
    ag.addColorStop(0, rcRgba(base, 0.95));
    ag.addColorStop(1, rcRgba(base, 0));
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.ellipse(-1, -6, 27, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const bob = o.down ? 1.6 : Math.abs(Math.sin(gait)) * 1.35;
  const headY = o.down ? -3 : -9 - bob;
  const flap = Math.sin(o.flap || 0);

  // ---- far wing (behind body) ----
  const wf = flap * (6 + spread * 7) + spread * 3;
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.moveTo(-3, -9 + bob);
  ctx.quadraticCurveTo(-15 - spread * 6, -19 - wf, -2, -23 - wf);
  ctx.quadraticCurveTo(3, -14, -3, -9 + bob);
  ctx.fill();

  // ---- tail (sways with gait, finned tip) ----
  const tsw = Math.sin(gait * 0.8) * 3;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-12, -6 + bob);
  ctx.quadraticCurveTo(-25, -5 - tsw, -29, 2 - tsw);
  ctx.lineTo(-32, -2 - tsw);                                // tail fin upper
  ctx.quadraticCurveTo(-27, 2 - tsw, -31, 7 - tsw);        // tail fin lower
  ctx.quadraticCurveTo(-22, 3 - tsw, -11, -1 + bob);
  ctx.fill();

  // ---- legs (run cycle) + claws ----
  ctx.strokeStyle = dark; ctx.lineWidth = 3.3; ctx.lineCap = "round";
  const sw = o.down ? 1.1 : 3.3;
  const a1 = Math.sin(gait) * sw, a2 = Math.sin(gait + Math.PI) * sw;
  const legY = 4 + bob;
  ctx.beginPath();
  ctx.moveTo(-5, legY); ctx.lineTo(-5 + a1, legY + 8.5);
  ctx.moveTo(-1, legY); ctx.lineTo(-1 + a2, legY + 8.5);
  ctx.moveTo(5, legY);  ctx.lineTo(5 + a2, legY + 8.5);
  ctx.moveTo(9, legY);  ctx.lineTo(9 + a1, legY + 8.5);
  ctx.stroke();
  ctx.strokeStyle = light; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-5 + a1, legY + 8.5); ctx.lineTo(-3 + a1, legY + 9.8);
  ctx.moveTo(9 + a1, legY + 8.5);  ctx.lineTo(11 + a1, legY + 9.8);
  ctx.stroke();

  // ---- torso (vertical gradient: lit back → shaded under) ----
  const bg = ctx.createLinearGradient(0, -14 + bob, 0, 6 + bob);
  bg.addColorStop(0, light);
  bg.addColorStop(0.55, base);
  bg.addColorStop(1, mid);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, -4 + bob, 14.5, 9.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // belly plate
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(2, -1 + bob, 9, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // scale hints
  ctx.strokeStyle = rcRgba(dark, 0.45); ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.arc(i * 5 + 1, -3 + bob, 4, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
  }
  // rim light along the back
  ctx.strokeStyle = rcRgba(light, 0.7); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(0, -4 + bob, 14.5, 9.2, 0, Math.PI * 1.08, Math.PI * 1.62); ctx.stroke();

  // ---- dorsal spines ----
  ctx.fillStyle = dark;
  for (let i = 0; i < 4; i++) {
    const sx = -9 + i * 5;
    ctx.beginPath();
    ctx.moveTo(sx, -10.5 + bob);
    ctx.lineTo(sx + 2, -15.5 + bob);
    ctx.lineTo(sx + 4, -10.5 + bob);
    ctx.closePath(); ctx.fill();
  }

  // ---- near wing (shoulder, in front of torso; membrane + ribs) ----
  ctx.save();
  ctx.translate(0, -8 + bob);
  ctx.rotate(-0.08 - spread * 0.22);
  const wn = flap * (7 + spread * 10);
  const wg = ctx.createLinearGradient(0, 2, 4, -26 - wn);
  wg.addColorStop(0, base);
  wg.addColorStop(1, light);
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-9 - spread * 6, -22 - wn, 7, -26 - wn);
  ctx.quadraticCurveTo(12, -19 - wn * 0.6, 11, -6);
  ctx.quadraticCurveTo(7, -9, 0, 0);
  ctx.fill();
  ctx.strokeStyle = rcRgba(dark, 0.55); ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(1, -3); ctx.lineTo(5, -24 - wn);
  ctx.moveTo(1, -3); ctx.lineTo(10, -18 - wn * 0.6);
  ctx.stroke();
  ctx.restore();

  // ---- neck + head ----
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(7, -7 + bob);
  ctx.quadraticCurveTo(12, -6 + bob, 12, headY + 3);
  ctx.lineTo(8, headY + 4);
  ctx.quadraticCurveTo(6, -4 + bob, 7, -7 + bob);
  ctx.fill();
  // head
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(12.5, headY, 8, 6.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // snout / jaw
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(16.5, headY - 2.2);
  ctx.quadraticCurveTo(23, headY - 0.2, 20.5, headY + 2.6);
  ctx.quadraticCurveTo(17.5, headY + 3.4, 15.5, headY + 2);
  ctx.closePath(); ctx.fill();
  // brow ridge
  ctx.fillStyle = mid;
  ctx.beginPath(); ctx.ellipse(11.5, headY - 3.6, 5, 2.1, -0.2, 0, Math.PI * 2); ctx.fill();
  // cheek frill
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.moveTo(8.5, headY + 0.5); ctx.lineTo(4.5, headY + 1.5);
  ctx.lineTo(8, headY + 4); ctx.closePath(); ctx.fill();
  // horns (swept back)
  ctx.strokeStyle = horn; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, headY - 5);   ctx.quadraticCurveTo(6, headY - 11, 8.5, headY - 13.5);
  ctx.moveTo(13.5, headY - 5.5); ctx.quadraticCurveTo(11, headY - 12, 13.5, headY - 14);
  ctx.stroke();

  // ---- eye / expression ----
  if (o.down) {
    ctx.strokeStyle = "#16202e"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(10.5, headY - 1); ctx.lineTo(13, headY - 2.6); ctx.lineTo(15.5, headY - 1); ctx.stroke();
  } else {
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(13.4, headY - 0.8, 2.4, 2.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#16202e";
    ctx.beginPath(); ctx.arc(14.0, headY - 0.6, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(14.6, headY - 1.5, 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // open mouth + fang when pushing hard / at the line
  if (o.effort) {
    ctx.fillStyle = "#7a1f2b";
    ctx.beginPath(); ctx.ellipse(18.5, headY + 2.4, 2.2, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(17.6, headY + 1.4); ctx.lineTo(18.4, headY + 2.8); ctx.lineTo(19.2, headY + 1.4);
    ctx.closePath(); ctx.fill();
  }

  ctx.restore();
}

// =========================================================================
// Player
// =========================================================================
function startRaceCanvas(container, ctx) {
  stopRacePlayer();

  const { race, raceResult, oddsResult, bet, timeline, commentary, broadcast } = ctx;
  const dragons = timeline.dragons;

  // stable lane assignment (varied, not by rank) for vertical separation
  const laneOrder = dragons
    .map((dr, i) => ({ dr, k: tlHash(dr.id) }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.dr);
  const laneOf = {};
  laneOrder.forEach((dr, i) => { laneOf[dr.id] = i; });

  // popularity / bet lookups
  const popRank = {};
  (oddsResult.oddsData || []).forEach(o => { popRank[o.dragonId] = o.popularityRank; });
  const betSet = new Set((bet && bet.selections) || []);

  // ---- DOM shell ----
  container.innerHTML = "";
  const wrap = el("div", "rc-wrap");
  wrap.innerHTML = `
    <div class="rc-hud">
      <div class="rc-hud-left">
        <span class="rc-phase" id="rc-phase">序盤</span>
        <span class="rc-section" id="rc-section"></span>
        <span class="rc-race">${raceFullName(race)}</span>
      </div>
      <div class="rc-hud-right">
        <span class="rc-weather">${(WEATHERS[race.weather] || {}).label || ""}</span>
        <span class="rc-remain" id="rc-remain">残り ${timeline.distanceMeters}m</span>
      </div>
    </div>
    <div class="rc-rankbar" id="rc-rankbar"></div>
    <div class="rc-stage">
      <canvas id="rc-canvas"></canvas>
      <div class="rc-bet" id="rc-bet" style="display:none"></div>
      <button class="rc-play" id="rc-play" title="再生/一時停止">⏸</button>
    </div>
    <div class="rc-telop" id="rc-telop"><div class="lines" id="rc-lines"></div></div>
    <div class="rc-controls" id="rc-controls"></div>
    <div class="rc-finishstrip" id="rc-finishstrip" style="display:none"></div>
    <div class="rc-log" id="rc-log" style="display:none"></div>
  `;
  container.appendChild(wrap);

  const canvas = wrap.querySelector("#rc-canvas");
  const cctx = canvas.getContext("2d");
  const remainEl = wrap.querySelector("#rc-remain");
  const phaseEl = wrap.querySelector("#rc-phase");
  const sectionEl = wrap.querySelector("#rc-section");
  const rankbarEl = wrap.querySelector("#rc-rankbar");
  const betEl = wrap.querySelector("#rc-bet");
  const linesEl = wrap.querySelector("#rc-lines");
  const controlsEl = wrap.querySelector("#rc-controls");
  const finishStripEl = wrap.querySelector("#rc-finishstrip");
  const logEl = wrap.querySelector("#rc-log");
  const playBtn = wrap.querySelector("#rc-play");

  // ---- responsive canvas sizing (devicePixelRatio aware) ----
  let cw = 0, ch = 0, dpr = 1;
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    cw = Math.max(280, rect.width);
    ch = Math.max(280, Math.min(480, Math.round(cw * 0.55)));
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const onResize = () => { resize(); draw(); };
  window.addEventListener("resize", onResize);
  resize();

  // ---- playback state ----
  const S = {
    tau: 0,
    speed: 1,
    playing: true,
    finished: false,
    raf: null,
    last: 0,
    camL: -0.66 * 0.3,
    started: 0,
    // --- dynamic camera ---
    zoom: 1, zoomT: 1,          // eased push-in (1 = wide)
    camY: 0, camYT: 0,          // eased vertical follow-pan (px, world space)
    shake: 0, shakeX: 0, shakeY: 0,  // impulse screen-shake
    _winw: 0.3,
    gait: {},          // per-dragon gait clock
    particles: [],
    ambT: 0,           // ambient-particle spawn accumulator
    floats: [],
    crossedSet: new Set(),
    tapeBroken: false,
    showLog: false,
    finishedAnnounced: false,
    countdown: 1.0      // brief スタート flash
  };
  dragons.forEach(dr => { S.gait[dr.id] = Math.random() * Math.PI * 2; });

  // ---- telop scheduling: spread each phase's commentary across its τ-span ----
  const telopSchedule = [];
  if (commentary && commentary.length) {
    let prevT = 0;
    for (let p = 0; p < commentary.length; p++) {
      const endT = (p < TL_PHASE_TAU.length) ? TL_PHASE_TAU[p] : 1.0;
      const lines = (commentary[p] && commentary[p].lines) || [];
      const span = Math.max(0.0001, endT - prevT);
      lines.forEach((line, i) => {
        const at = prevT + span * ((i + 0.5) / Math.max(1, lines.length));
        telopSchedule.push({ tau: Math.min(0.999, at), line, fired: false });
      });
      prevT = endT;
    }
  }
  const shownLines = [];
  function pumpTelop() {
    let changed = false;
    for (const t of telopSchedule) {
      if (!t.fired && S.tau >= t.tau) { t.fired = true; shownLines.push(t.line); changed = true; }
    }
    if (changed) {
      linesEl.innerHTML = "";
      shownLines.slice(-3).forEach((line, i, arr) => {
        const d = document.createElement("div");
        d.className = i === arr.length - 1 ? "line is-latest" : "line-prev";
        d.textContent = line;
        linesEl.appendChild(d);
      });
    }
  }

  // ---- floating shout / placement text ----
  function addFloat(x, y, text, color, big) {
    S.floats.push({ x, y, text, color: color || "#fff", life: 1, vy: -18, big: !!big });
  }
  function spawnDust(x, y, n, intensity) {
    for (let i = 0; i < n; i++) {
      S.particles.push({
        x: x - 8 - Math.random() * 6, y: y + 6 + Math.random() * 3,
        vx: -20 - Math.random() * 30 * intensity, vy: -8 - Math.random() * 14,
        life: 1, max: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3, kind: "dust"
      });
    }
  }
  function spawnSpark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      S.particles.push({
        x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 10,
        life: 1, max: 0.4 + Math.random() * 0.3, size: 1.5 + Math.random() * 2, kind: "spark", color
      });
    }
  }

  // ---- camera (smoothed follow + dynamic zoom / vertical pan) ----
  function updateCamera() {
    let leaderP = 0, lastP = 1, leaderId = null;
    for (const dr of dragons) {
      const p = timeline.progressAt(dr.id, S.tau);
      if (p > leaderP) { leaderP = p; leaderId = dr.id; }
      if (p < lastP) lastP = p;
    }
    const WINW = clamp((leaderP - lastP) + 0.12, 0.20, 0.55);
    const targetL = leaderP - 0.66 * WINW;
    S.camL += (targetL - S.camL) * 0.12;
    S._winw = WINW;

    // push in near the finish and when the field bunches up; pull back when spread
    const finishProx = clamp((leaderP - 0.74) / 0.26, 0, 1);
    const bunch = clamp(1 - (leaderP - lastP) / 0.22, 0, 1);
    S.zoomT = S.finished ? 1.2 : (1 + 0.13 * finishProx + 0.05 * bunch);
    S.zoom += (S.zoomT - S.zoom) * 0.06;

    // gentle vertical pan toward the leader's lane → the camera "follows"
    const g = trackGeom();
    const centerY = (g.top + g.bottom) / 2;
    let leadLaneY = centerY;
    if (leaderId) { const dr = timeline.byId[leaderId]; if (dr) leadLaneY = laneY(dr, g); }
    S.camYT = clamp((centerY - leadLaneY) * 0.22, -ch * 0.05, ch * 0.05);
    S.camY += (S.camYT - S.camY) * 0.05;

    return { leaderP, lastP, WINW, leaderId };
  }

  // ---- layout helpers ----
  function trackGeom() {
    const top = ch * 0.34, bottom = ch * 0.965;
    return { top, bottom, laneH: (bottom - top) / 8 };
  }
  // subtle depth: back lanes (top of screen) a touch smaller/dimmer than near
  // lanes (bottom), so the field reads with perspective without hurting rank legibility.
  function laneDepth(dr) { return 0.93 + (laneOf[dr.id] / 7) * 0.17; }
  function screenX(P, WINW) {
    const usableLeft = cw * 0.08, usableRight = cw * 0.94;
    const frac = (P - S.camL) / WINW;
    return usableLeft + frac * (usableRight - usableLeft);
  }
  function laneY(dr, g) {
    return g.bottom - (laneOf[dr.id] + 0.5) * g.laneH;
  }

  // ---- terrain helpers: which SECTION is at a given track fraction ----
  function thirdAtP(P) { return P < 1 / 3 ? 0 : P < 2 / 3 ? 1 : 2; }
  function sectionKeyAtThird(t) { return t === 0 ? race.early : t === 1 ? race.mid : race.late; }
  function phaseOfThird(t) { return t === 0 ? "early" : t === 1 ? "mid" : "late"; }
  function themeKeyAtP(P) { return rcThemeOf(sectionKeyAtThird(thirdAtP(clamp(P, 0, 1)))); }
  function sectionLabelAtP(P) {
    const t = thirdAtP(clamp(P, 0, 1));
    const sec = (typeof getSection === "function") ? getSection(phaseOfThird(t), sectionKeyAtThird(t)) : null;
    return sec ? sec.label : "";
  }
  // blended theme around the leader (soft cross-fade across section boundaries)
  function themeBlendAtP(P) {
    const x = clamp(P, 0, 1) * 3;
    const i = Math.min(2, Math.floor(x));
    const frac = x - i;
    let j = i, t = 0;
    if (frac > 0.82 && i < 2) { j = i + 1; t = (frac - 0.82) / 0.18; }
    else if (frac < 0.18 && i > 0) { j = i - 1; t = (0.18 - frac) / 0.18; }
    const keyA = rcThemeOf(sectionKeyAtThird(i));
    const keyB = rcThemeOf(sectionKeyAtThird(j));
    return { keyA, keyB, a: RC_THEME[keyA], b: RC_THEME[keyB], t: t * 0.5 };
  }

  function rcCloud(x, y, r) {
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.arc(x + r * 0.9, y + 3, r * 0.7, 0, Math.PI * 2);
    cctx.arc(x - r * 0.9, y + 4, r * 0.6, 0, Math.PI * 2);
    cctx.fill();
  }
  // distant silhouette that gives each terrain its identity (screen space, parallax)
  function drawThemeBackdrop(key, g, alpha) {
    if (alpha <= 0.02) return;
    const hz = g.top;
    cctx.save();
    cctx.globalAlpha = alpha;
    if (key === "fire") {
      const vx = cw * 0.5 - ((S.camL * 90) % (cw * 1.5));
      cctx.fillStyle = "#2a1410";
      cctx.beginPath();
      cctx.moveTo(vx - 76, hz); cctx.lineTo(vx - 18, hz - 70);
      cctx.lineTo(vx + 18, hz - 70); cctx.lineTo(vx + 76, hz); cctx.closePath(); cctx.fill();
      const gl = cctx.createLinearGradient(vx, hz - 70, vx, hz - 28);
      gl.addColorStop(0, "rgba(255,150,60,0.9)"); gl.addColorStop(1, "rgba(255,90,40,0)");
      cctx.fillStyle = gl;
      cctx.beginPath();
      cctx.moveTo(vx - 16, hz - 68); cctx.lineTo(vx + 16, hz - 68);
      cctx.lineTo(vx + 10, hz - 40); cctx.lineTo(vx - 10, hz - 40); cctx.closePath(); cctx.fill();
    } else if (key === "wind") {
      cctx.fillStyle = "rgba(196,214,238,0.45)";
      for (let i = 0; i < 4; i++) {
        const cx = (((i * 190 - S.camL * 240) % (cw + 220)) + cw + 220) % (cw + 220) - 110;
        rcCloud(cx, hz - 34 - (i % 2) * 16, 24 + (i % 2) * 8);
      }
    } else if (key === "mist") {
      const mg = cctx.createLinearGradient(0, hz - 44, 0, hz + 12);
      mg.addColorStop(0, "rgba(210,224,236,0)"); mg.addColorStop(1, "rgba(202,218,232,0.5)");
      cctx.fillStyle = mg; cctx.fillRect(0, hz - 44, cw, 56);
    } else if (key === "bridge") {
      cctx.strokeStyle = "rgba(150,175,195,0.6)"; cctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const px = cw * 0.34 * i + (((-S.camL * 130) % (cw * 1.02)) + cw * 1.02) % (cw * 1.02) - cw * 0.1;
        cctx.beginPath(); cctx.moveTo(px, hz); cctx.lineTo(px, hz - 58); cctx.stroke();
        cctx.beginPath(); cctx.moveTo(px - 54, hz - 6); cctx.quadraticCurveTo(px, hz - 52, px + 54, hz - 6); cctx.stroke();
      }
    } else if (key === "uphill" || key === "rolling") {
      cctx.fillStyle = "rgba(26,40,24,0.78)";
      cctx.beginPath(); cctx.moveTo(0, hz);
      for (let x = 0; x <= cw; x += 36) cctx.lineTo(x, hz - 20 - 14 * Math.sin((x + S.camL * 220) / 88));
      cctx.lineTo(cw, hz); cctx.closePath(); cctx.fill();
    } else if (key === "narrow") {
      cctx.fillStyle = "rgba(30,26,20,0.82)";
      cctx.beginPath();
      cctx.moveTo(0, hz); cctx.lineTo(0, hz - 60); cctx.lineTo(cw * 0.15, hz - 28); cctx.lineTo(cw * 0.15, hz); cctx.closePath(); cctx.fill();
      cctx.beginPath();
      cctx.moveTo(cw, hz); cctx.lineTo(cw, hz - 60); cctx.lineTo(cw * 0.85, hz - 28); cctx.lineTo(cw * 0.85, hz); cctx.closePath(); cctx.fill();
    }
    cctx.restore();
  }
  // surface treatment painted within the running band (world space)
  function drawGroundOverlay(key, g, WINW) {
    if (key === "mist") {
      cctx.fillStyle = "rgba(200,214,228,0.12)";
      cctx.fillRect(0, g.top, cw, g.bottom - g.top);
    } else if (key === "fire") {
      cctx.strokeStyle = "rgba(255,120,50,0.10)"; cctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const yy = g.top + (i + 0.5) * (g.bottom - g.top) / 5;
        const off = ((S.camL * 300) + i * 40) % 60;
        cctx.beginPath();
        for (let x = -off; x < cw; x += 60) { cctx.moveTo(x, yy); cctx.lineTo(x + 26, yy + (i % 2 ? 3 : -3)); }
        cctx.stroke();
      }
    } else if (key === "bridge") {
      cctx.strokeStyle = "rgba(120,142,156,0.16)"; cctx.lineWidth = 2;
      const step = 0.03, startP = Math.floor(S.camL / step) * step;
      for (let P = startP; P < S.camL + WINW + step; P += step) {
        const x = screenX(P, WINW);
        cctx.beginPath(); cctx.moveTo(x, g.top); cctx.lineTo(x, g.bottom); cctx.stroke();
      }
    }
  }
  // roadside props, placed by absolute track position so they scroll correctly
  function drawProp(key, x, g, j) {
    const topY = g.top, botY = g.bottom;
    if (key === "turn") {
      cctx.strokeStyle = "rgba(220,225,235,0.55)"; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, topY); cctx.lineTo(x, topY - 18); cctx.stroke();
      cctx.fillStyle = j > 0.5 ? "#d64b4b" : "#e8e8e8";
      cctx.fillRect(x, topY - 18, 10, 7);
    } else if (key === "fire") {
      if (j < 0.55) return;
      cctx.strokeStyle = "#5a4632"; cctx.lineWidth = 3;
      cctx.beginPath(); cctx.moveTo(x, topY); cctx.lineTo(x, topY - 15); cctx.stroke();
      const fy = topY - 21 + Math.sin(performance.now() / 120 + x) * 1.5;
      const fg = cctx.createRadialGradient(x, fy, 1, x, fy, 8);
      fg.addColorStop(0, "#fff1a8"); fg.addColorStop(0.5, "#ff9a40"); fg.addColorStop(1, "rgba(255,80,30,0)");
      cctx.fillStyle = fg; cctx.beginPath(); cctx.ellipse(x, fy, 5.5, 9, 0, 0, Math.PI * 2); cctx.fill();
    } else if (key === "narrow") {
      cctx.fillStyle = "rgba(40,34,26,0.9)";
      cctx.beginPath(); cctx.moveTo(x - 5, topY); cctx.lineTo(x - 1, topY - 20 - j * 8); cctx.lineTo(x + 4, topY); cctx.closePath(); cctx.fill();
    } else if (key === "wind") {
      if (j < 0.5) return;
      cctx.strokeStyle = "rgba(180,200,225,0.5)"; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, topY); cctx.lineTo(x, topY - 20); cctx.stroke();
      cctx.fillStyle = "rgba(150,200,255,0.6)";
      cctx.beginPath(); cctx.moveTo(x, topY - 20); cctx.lineTo(x + 14, topY - 17); cctx.lineTo(x, topY - 13); cctx.closePath(); cctx.fill();
    } else if (key === "rolling" || key === "uphill") {
      if (j < 0.5) return;
      cctx.fillStyle = "rgba(30,52,30,0.8)";
      cctx.beginPath(); cctx.arc(x, topY - 3, 5 + j * 4, Math.PI, 0); cctx.fill();
    } else if (key === "bridge") {
      cctx.strokeStyle = "rgba(150,170,185,0.5)"; cctx.lineWidth = 2;
      cctx.beginPath(); cctx.moveTo(x, botY); cctx.lineTo(x, botY - 12); cctx.stroke();
    }
  }
  function drawProps(g, WINW) {
    const step = 0.05, startP = Math.floor(S.camL / step) * step;
    for (let P = startP; P < S.camL + WINW + step; P += step) {
      if (P < 0 || P > 1) continue;
      const key = themeKeyAtP(P);
      const j = Math.abs(Math.sin(P * 99.7));
      drawProp(key, screenX(P, WINW), g, j);
    }
  }
  // ambient terrain particles (embers / gusts / leaves); mist is an overlay
  function spawnAmbient(key, g) {
    if (key === "fire") {
      S.particles.push({ amb: true, kind: "ember", x: Math.random() * cw, y: g.bottom - Math.random() * (g.bottom - g.top),
        vx: -10 - Math.random() * 18, vy: -24 - Math.random() * 24, life: 1, max: 0.8 + Math.random() * 0.6, size: 1.4 + Math.random() * 1.8 });
    } else if (key === "wind") {
      S.particles.push({ amb: true, kind: "gust", x: cw + 10, y: g.top + Math.random() * (g.bottom - g.top) * 0.65,
        vx: -160 - Math.random() * 120, vy: 0, life: 1, max: 0.5 + Math.random() * 0.3, size: 10 + Math.random() * 14 });
    } else if (key === "leaf") {
      S.particles.push({ amb: true, kind: "leaf", x: Math.random() * cw, y: g.top - 4,
        vx: -18 - Math.random() * 20, vy: 16 + Math.random() * 16, life: 1, max: 1.2, size: 2 + Math.random() * 2 });
    }
  }

  // =====================================================================
  // DRAW
  // =====================================================================
  function draw() {
    const cam = updateCamera();
    const WINW = cam.WINW;
    const leaderP = cam.leaderP;
    const g = trackGeom();

    // per-frame shake offset (decays in update)
    S.shakeX = S.shake > 0.05 ? (Math.random() * 2 - 1) * S.shake : 0;
    S.shakeY = S.shake > 0.05 ? (Math.random() * 2 - 1) * S.shake : 0;

    // blended terrain theme around the leader → tints the whole scene
    const tb = themeBlendAtP(leaderP);
    const stadium = /straight|turn|uphill|narrow|rolling/.test(tb.keyA);

    // --- sky (themed) ---
    const sky = cctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0,    rcMix(tb.a.sky[0], tb.b.sky[0], tb.t));
    sky.addColorStop(0.55, rcMix(tb.a.sky[1], tb.b.sky[1], tb.t));
    sky.addColorStop(1,    rcMix(tb.a.sky[2], tb.b.sky[2], tb.t));
    cctx.fillStyle = sky;
    cctx.fillRect(0, 0, cw, ch);

    // moon
    cctx.fillStyle = "rgba(255,247,224,0.92)";
    cctx.beginPath(); cctx.arc(cw * 0.82, ch * 0.16, 22, 0, Math.PI * 2); cctx.fill();
    cctx.fillStyle = "rgba(255,247,224,0.10)";
    cctx.beginPath(); cctx.arc(cw * 0.82, ch * 0.16, 34, 0, Math.PI * 2); cctx.fill();

    // distant terrain identity (volcano / clouds / hills / canyon / pylons)
    drawThemeBackdrop(tb.keyA, g, 1);
    if (tb.keyB !== tb.keyA) drawThemeBackdrop(tb.keyB, g, tb.t);

    // stadium dressing (skyline + clock tower + crowd) only on ground courses
    if (stadium) {
      const skl = (S.camL * 220) % 60;
      cctx.fillStyle = "rgba(20,26,52,0.9)";
      for (let i = -1; i < cw / 60 + 1; i++) {
        const x = i * 60 - skl;
        const h = 18 + ((i * 37) % 5) * 6;
        cctx.fillRect(x, g.top - h - 6, 44, h);
      }
      cctx.fillStyle = "rgba(40,46,78,0.95)";
      const tx = cw * 0.62 - (S.camL * 120 % cw);
      cctx.fillRect(tx, g.top - 64, 26, 64);
      cctx.fillStyle = "rgba(255,240,200,0.85)";
      cctx.beginPath(); cctx.arc(tx + 13, g.top - 50, 7, 0, Math.PI * 2); cctx.fill();
      cctx.fillStyle = "#181d33";
      cctx.fillRect(0, g.top - 6, cw, 10);
      const crowdScroll = (S.camL * 600) % 14;
      for (let x = -crowdScroll; x < cw; x += 14) {
        cctx.fillStyle = ["#3a4474", "#46406e", "#523b5e", "#3e4a6b"][(Math.floor(x) % 4 + 4) % 4];
        cctx.beginPath(); cctx.arc(x, g.top - 2, 3, 0, Math.PI * 2); cctx.fill();
      }
    }

    // ============ WORLD GROUP (dynamic camera: zoom + pan + shake) ============
    const fx = clamp(screenX(leaderP, WINW), cw * 0.2, cw * 0.8);
    const fy = (g.top + g.bottom) / 2;
    cctx.save();
    cctx.translate(fx, fy); cctx.scale(S.zoom, S.zoom); cctx.translate(-fx, -fy);
    cctx.translate(S.shakeX, S.camY + S.shakeY);

    // --- track ground (themed turf, apron below to survive pan/zoom) ---
    const grd = cctx.createLinearGradient(0, g.top, 0, g.bottom);
    grd.addColorStop(0,   rcMix(tb.a.ground[0], tb.b.ground[0], tb.t));
    grd.addColorStop(0.5, rcMix(tb.a.ground[1], tb.b.ground[1], tb.t));
    grd.addColorStop(1,   rcMix(tb.a.ground[2], tb.b.ground[2], tb.t));
    cctx.fillStyle = grd;
    cctx.fillRect(0, g.top, cw, (ch - g.top) + 12);
    // mowed-stripe banding for a groomed-turf look
    cctx.fillStyle = "rgba(255,255,255,0.020)";
    for (let i = 0; i < 8; i += 2) cctx.fillRect(0, g.top + i * g.laneH, cw, g.laneH);
    // theme surface treatment (fog veil / lava cracks / bridge planks)
    drawGroundOverlay(tb.keyA, g, WINW);

    // lane stripes
    cctx.strokeStyle = "rgba(255,255,255,0.06)";
    cctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const y = g.top + i * g.laneH;
      cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(cw, y); cctx.stroke();
    }
    // scrolling distance ticks (every 5% of track) → ground speed sensation
    cctx.fillStyle = "rgba(255,255,255,0.10)";
    const firstTick = Math.ceil(S.camL / 0.05) * 0.05;
    for (let P = firstTick; P < S.camL + WINW + 0.05; P += 0.05) {
      const x = screenX(P, WINW);
      cctx.fillRect(x - 1, g.top, 2, g.bottom - g.top);
    }
    // rails (far + near) frame the running surface
    cctx.strokeStyle = "rgba(180,200,230,0.35)";
    cctx.lineWidth = 2;
    cctx.beginPath(); cctx.moveTo(0, g.top + 1); cctx.lineTo(cw, g.top + 1); cctx.stroke();
    cctx.strokeStyle = "rgba(210,225,245,0.30)";
    cctx.beginPath(); cctx.moveTo(0, g.bottom - 1); cctx.lineTo(cw, g.bottom - 1); cctx.stroke();

    // roadside props for the current terrain (torches, turn flags, rocks, …)
    drawProps(g, WINW);

    // --- finish gate (when in view) ---
    const goalX = screenX(1, WINW);
    if (goalX < cw + 40 && goalX > -40) {
      // checkered band
      const bw = 9, rows = 10, rh = (g.bottom - g.top) / rows;
      for (let r = 0; r < rows; r++) {
        cctx.fillStyle = (r % 2 === 0) ? "#f4f4f4" : "#1c2030";
        cctx.fillRect(goalX - bw, g.top + r * rh, bw, rh);
        cctx.fillStyle = (r % 2 === 0) ? "#1c2030" : "#f4f4f4";
        cctx.fillRect(goalX, g.top + r * rh, bw, rh);
      }
      // posts + banner
      cctx.fillStyle = "#c9b27a";
      cctx.fillRect(goalX - bw - 4, g.top - 22, 4, g.bottom - g.top + 22);
      cctx.fillRect(goalX + bw, g.top - 22, 4, g.bottom - g.top + 22);
      cctx.fillStyle = "#b23b3b";
      cctx.fillRect(goalX - bw - 4, g.top - 22, bw * 2 + 8, 16);
      cctx.fillStyle = "#fff";
      cctx.font = "bold 11px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillText("ゴール", goalX, g.top - 14);
      // finish tape (a bright line spanning the gate) until the leader breaks it
      if (!S.tapeBroken) {
        cctx.strokeStyle = "rgba(255,255,255,0.85)";
        cctx.lineWidth = 2;
        cctx.beginPath(); cctx.moveTo(goalX, g.top); cctx.lineTo(goalX, g.bottom); cctx.stroke();
      }
    }

    // --- dragons (draw far lanes first for overlap) ---
    const standings = timeline.standingsAt(S.tau);
    const standMap = {}; standings.forEach((id, i) => { standMap[id] = i + 1; });

    const drawList = [...dragons].sort((a, b) => laneOf[b.id] - laneOf[a.id]);
    for (const dr of drawList) {
      const P = timeline.progressAt(dr.id, S.tau);
      const v = timeline.speedAt(dr.id, S.tau);
      const intensity = clamp((v - 0.85) / 0.55, 0, 1.4);
      const ownU = Math.min(1, S.tau / dr.finishTau);

      let x = screenX(P, WINW);
      const baseY = laneY(dr, g);
      const bob = Math.sin(S.gait[dr.id]) * (1.6 + intensity);
      const y = baseY + bob;

      const offLeft = x < cw * 0.04;
      const drawX = clamp(x, cw * 0.05, cw * 0.97);

      // states
      const tired = dr.collapse && ownU > 0.62;
      const slow = intensity < 0.2;
      const down = tired || slow;
      // stumble window
      let tumble = 0, stumbling = false;
      if (dr.stumbleU > 0 && Math.abs(ownU - dr.stumbleU) < 0.04 && P < 1) {
        stumbling = true;
        const k = 1 - Math.abs(ownU - dr.stumbleU) / 0.04;
        tumble = Math.sin(performance.now() / 40) * 0.35 * k;
      }
      // surge window
      let glow = 0, surging = false;
      for (const ev of dr.events) {
        if (ev.type === "surge" && Math.abs(ownU - ev.u) < 0.06 && P < 1) {
          surging = true; glow = Math.max(glow, 1 - Math.abs(ownU - ev.u) / 0.06);
        }
      }
      const effort = (intensity > 0.95) || surging || (P > 0.9 && P < 1);
      const finishedNow = P >= 1;

      // speed lines behind
      if (intensity > 0.5 && !down) {
        cctx.strokeStyle = rcRgba(dr.color, 0.18 + 0.12 * intensity);
        cctx.lineWidth = 1.5;
        for (let l = 0; l < 3; l++) {
          const ly = y - 6 + l * 5;
          cctx.beginPath();
          cctx.moveTo(drawX - 16 - l * 4, ly);
          cctx.lineTo(drawX - 30 - intensity * 18 - l * 6, ly);
          cctx.stroke();
        }
      }

      // dust at feet (scale with speed)
      if (!down && intensity > 0.3 && Math.random() < 0.4) spawnDust(drawX, baseY + 14, 1, intensity);
      if (surging && Math.random() < 0.5) spawnSpark(drawX, y - 4, dr.color);

      // gait advance handled in update(); draw sprite (depth-scaled)
      const dep = laneDepth(dr);
      const sprScale = 1.28 * dep;
      // soft contact shadow grounds the dragon on the turf
      cctx.fillStyle = "rgba(0,0,0,0.18)";
      cctx.beginPath();
      cctx.ellipse(drawX, baseY + 15 * dep, 15 * dep, 4 * dep, 0, 0, Math.PI * 2);
      cctx.fill();
      // terrain shapes body language: bank into turns, spread wings on wind lanes
      const tkey = themeKeyAtP(P);
      const bank = tkey === "turn" ? clamp(0.25 + intensity * 0.4, 0, 0.8) : 0;
      const spread = tkey === "wind" ? clamp(0.45 + intensity * 0.4, 0, 1) : 0;
      rcDrawDragon(cctx, {
        x: drawX, y: y, scale: sprScale,
        color: dr.color, style: dr.style,
        gait: S.gait[dr.id], flap: S.gait[dr.id] * 0.6,
        lean: intensity, down: down, tumble: tumble, glow: glow, effort: effort,
        bank: bank, spread: spread
      });

      // sweat when tired
      if (down) {
        cctx.fillStyle = "rgba(150,200,255,0.85)";
        cctx.beginPath(); cctx.arc(drawX + 14 * dep, y - 12 * dep, 1.9, 0, Math.PI * 2); cctx.fill();
      }
      // bet reticle (player's pick)
      if (betSet.has(dr.id)) {
        cctx.strokeStyle = "#ffd34d"; cctx.lineWidth = 2.5;
        cctx.beginPath(); cctx.arc(drawX, y - 4, 26 * dep, 0, Math.PI * 2); cctx.stroke();
      }
      // rank tag (live standing) — dark halo for legibility on turf
      const rk = standMap[dr.id] || dr.rank;
      const tagY = y - 30 * dep;
      cctx.font = "bold 13px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "alphabetic";
      cctx.lineWidth = 3; cctx.strokeStyle = "rgba(8,10,20,0.85)";
      cctx.strokeText(rk, drawX, tagY);
      cctx.fillStyle = betSet.has(dr.id) ? "#ffd34d" : (popRank[dr.id] === 1 ? "#7fd1ff" : "#ffffff");
      cctx.fillText(rk, drawX, tagY);
      // name plate under the dragon
      const nm = commentaryName(dr.id);
      cctx.font = "10px system-ui, sans-serif";
      cctx.lineWidth = 3; cctx.strokeStyle = "rgba(8,10,20,0.8)";
      cctx.strokeText(nm, drawX, baseY + 22);
      cctx.fillStyle = "rgba(255,255,255,0.95)";
      cctx.fillText(nm, drawX, baseY + 22);
      // off-screen-behind indicator
      if (offLeft) {
        cctx.fillStyle = "rgba(255,255,255,0.6)";
        cctx.font = "10px system-ui, sans-serif";
        cctx.fillText("◀", cw * 0.03, y);
      }
    }

    // --- particles (dust / spark + ambient embers / gusts / leaves) ---
    for (const p of S.particles) {
      const a = clamp(p.life, 0, 1);
      if (p.kind === "dust") {
        cctx.fillStyle = `rgba(180,170,150,${0.5 * a})`;
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size * (1 + (1 - a)), 0, Math.PI * 2); cctx.fill();
      } else if (p.kind === "ember") {
        cctx.fillStyle = `rgba(255,${150 + Math.floor(80 * a)},80,${0.85 * a})`;
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); cctx.fill();
      } else if (p.kind === "gust") {
        cctx.strokeStyle = `rgba(205,226,255,${0.22 * a})`; cctx.lineWidth = 2;
        cctx.beginPath(); cctx.moveTo(p.x, p.y); cctx.lineTo(p.x + p.size, p.y); cctx.stroke();
      } else if (p.kind === "leaf") {
        cctx.fillStyle = `rgba(120,170,90,${0.7 * a})`;
        cctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
      } else {
        cctx.fillStyle = p.color ? rcRgba(p.color, a) : `rgba(255,230,150,${a})`;
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); cctx.fill();
      }
    }

    cctx.restore();   // ============ end WORLD GROUP ============

    // --- floating texts (screen space) ---
    cctx.textAlign = "center";
    for (const f of S.floats) {
      cctx.globalAlpha = clamp(f.life, 0, 1);
      cctx.fillStyle = f.color;
      cctx.font = (f.big ? "bold 20px" : "bold 13px") + " system-ui, sans-serif";
      cctx.fillText(f.text, f.x, f.y);
    }
    cctx.globalAlpha = 1;

    // --- start flash ---
    if (S.countdown > 0) {
      cctx.globalAlpha = clamp(S.countdown, 0, 1);
      cctx.fillStyle = "#fff";
      cctx.font = "bold 30px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillText("スタート！", cw / 2, ch * 0.3);
      cctx.globalAlpha = 1;
    }

    // --- finish flash overlay ---
    if (S.finished) {
      cctx.fillStyle = "rgba(8,10,20,0.30)";
      cctx.fillRect(0, 0, cw, ch);
      cctx.fillStyle = "#ffe9a8";
      cctx.font = "bold 26px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillText("ゴールイン！", cw / 2, ch * 0.26);
      const winner = timeline.crossings[0];
      cctx.fillStyle = "#fff";
      cctx.font = "bold 16px system-ui, sans-serif";
      cctx.fillText("1着  " + commentaryName(winner.id), cw / 2, ch * 0.26 + 30);
    }

    // HUD updates
    phaseEl.textContent = ["序盤", "中盤", "展開", "終盤", "ゴール前"][timeline.phaseIndexAt(S.tau)] || "";
    sectionEl.textContent = sectionLabelAtP(leaderP);
    remainEl.textContent = "残り " + timeline.distanceRemainingAt(S.tau) + "m";
    updateRankbar(standings, standMap);
    updateBet(standMap);
  }

  function updateRankbar(standings, standMap) {
    let html = "";
    standings.forEach((id, i) => {
      const isT = betSet.has(id);
      const cls = isT ? "t" : (popRank[id] === 1 ? "f" : "");
      html += `<span class="rc-pos ${cls}">${i + 1} ${commentaryName(id)}</span>`;
    });
    rankbarEl.innerHTML = html;
  }
  function updateBet(standMap) {
    if (!bet || !betSet.size) { betEl.style.display = "none"; return; }
    betEl.style.display = "";
    const parts = [...betSet].map(id => `${commentaryName(id)} ${standMap[id] || "-"}番手`);
    const typeLabel = bet.type === "win" ? "単竜" : bet.type === "place" ? "複竜" : "ワイド竜";
    betEl.textContent = "🎯 " + typeLabel + "：" + parts.join(" / ");
  }

  // =====================================================================
  // UPDATE
  // =====================================================================
  function update(dt) {
    // gait clocks advance with each dragon's current speed
    for (const dr of dragons) {
      const v = timeline.speedAt(dr.id, S.tau);
      const rate = (v < 0.2) ? 3 : 9 + v * 6;
      S.gait[dr.id] += dt * rate;
    }
    // particles — dust/spark fall under gravity; ambient embers rise, gusts/leaves drift
    for (const p of S.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.amb) p.vy += 60 * dt;
      else if (p.kind === "ember") p.vy -= 9 * dt;
      p.life -= dt / p.max;
    }
    S.particles = S.particles.filter(p => p.life > 0);
    // floats
    for (const f of S.floats) { f.y += f.vy * dt; f.life -= dt * 0.7; }
    S.floats = S.floats.filter(f => f.life > 0);
    if (S.countdown > 0) S.countdown -= dt * 1.3;
    // screen-shake impulse decays
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 14);

    if (!S.playing || S.finished) return;
    // ambient terrain particles (embers / gusts / leaves) for the current section
    S.ambT -= dt;
    if (S.ambT <= 0) {
      S.ambT = 0.07;
      spawnAmbient(themeKeyAtP(timeline.leaderProgressAt(S.tau)), trackGeom());
    }
    // pause while a Mimi/Sake modal is open (don't race behind a dialogue)
    const ov = document.getElementById("event-overlay");
    if (ov && !ov.classList.contains("hidden")) return;

    const prevTau = S.tau;
    S.tau = Math.min(1, S.tau + dt * S.speed / timeline.durationSecHint);

    // detect crossings between prevTau and S.tau
    for (const cr of timeline.crossings) {
      if (!S.crossedSet.has(cr.id) && S.tau >= cr.tau) {
        S.crossedSet.add(cr.id);
        const dr = timeline.byId[cr.id];
        const g = trackGeom();
        const gx = screenX(1, S._winw || 0.3);
        const y = laneY(dr, g) - 14;
        addFloat(gx, y, cr.place + "着", cr.place === 1 ? "#ffe06a" : "#cfe6ff", cr.place === 1);
        if (cr.place === 1) {
          S.tapeBroken = true;
          S.shake = Math.max(S.shake, 5);
          spawnSpark(gx, y, "#ffffff");
          addFloat(cw / 2, ch * 0.34, timeline.photoFinish ? "きわどい！" : "テープを切った！", "#fff");
        }
      }
    }
    // shout on stumble/surge moments (once each)
    for (const dr of dragons) {
      const ownU = Math.min(1, S.tau / dr.finishTau);
      const prevU = Math.min(1, prevTau / dr.finishTau);
      for (const ev of dr.events) {
        if (ev._shouted) continue;
        if (ev.type === "stumble" && prevU < ev.u && ownU >= ev.u) {
          ev._shouted = true;
          S.shake = Math.max(S.shake, 2.5);
          const gp = trackGeom(); const y = laneY(dr, gp) - 18;
          addFloat(screenX(timeline.progressAt(dr.id, S.tau), S._winw || 0.3), y, "つまずいた！", "#ff9a8a");
        }
        if (ev.type === "surge" && prevU < ev.u && ownU >= ev.u && dr.rank <= 4) {
          ev._shouted = true;
          const gp = trackGeom(); const y = laneY(dr, gp) - 18;
          addFloat(screenX(timeline.progressAt(dr.id, S.tau), S._winw || 0.3), y, "伸びる！", "#aef2b0");
        }
      }
    }

    pumpTelop();

    if (S.tau >= 1 && !S.finishedAnnounced) onAllFinished();
  }

  function onAllFinished() {
    S.finished = true;
    S.finishedAnnounced = true;
    S.shake = Math.max(S.shake, 4);
    playBtn.style.display = "none";
    renderControls();
    renderFinishStrip();
  }

  // =====================================================================
  // LOOP
  // =====================================================================
  function frame(now) {
    if (!RC_ACTIVE || RC_ACTIVE.id !== loopId) return;        // superseded
    if (state.ui.screen !== "race_run") { stopRacePlayer(); return; }
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    S.last = now;
    update(dt);
    draw();
    S.raf = requestAnimationFrame(frame);
  }

  // =====================================================================
  // CONTROLS
  // =====================================================================
  function renderControls() {
    controlsEl.innerHTML = "";
    if (!S.finished) {
      const sp = makeBtn(`速度 ${S.speed}×`, () => {
        S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1;
        renderControls();
      }, { secondary: S.speed === 1 });
      if (S.speed > 1) sp.classList.add("speed-active");
      controlsEl.appendChild(sp);
      controlsEl.appendChild(makeBtn("⏭ スキップ", () => { stopRacePlayer(); if (typeof renderResult === "function") renderResult(); }, { secondary: true }));
    }
    controlsEl.appendChild(makeBtn("📜 全ログ", () => {
      S.showLog = !S.showLog;
      logEl.style.display = S.showLog ? "" : "none";
      if (S.showLog) renderLog();
    }, { secondary: true }));
    if (S.finished) {
      controlsEl.appendChild(makeBtn("結果を見る", () => { stopRacePlayer(); if (typeof renderResult === "function") renderResult(); }));
    }
  }
  function renderLog() {
    logEl.innerHTML = "";
    (broadcast.phases || []).forEach((p, i) => {
      logEl.appendChild(el("div", "log-phase", `【${p.label} ${p.sectionName}】`));
      ((commentary[i] && commentary[i].lines) || []).forEach(line => logEl.appendChild(el("div", "log-line", line)));
    });
  }
  function renderFinishStrip() {
    finishStripEl.style.display = "";
    let html = `<div class="rc-fs-title">着順</div>`;
    timeline.crossings.forEach(cr => {
      const isT = betSet.has(cr.id);
      html += `<div class="rc-fs-row ${isT ? "t" : ""}"><b>${cr.place}</b> ${commentaryName(cr.id)}${isT ? " 🎯" : ""}</div>`;
    });
    finishStripEl.innerHTML = html;
  }

  playBtn.onclick = () => {
    S.playing = !S.playing;
    playBtn.textContent = S.playing ? "⏸" : "▶";
  };

  renderControls();

  // =====================================================================
  // controller
  // =====================================================================
  const loopId = Symbol("rc");
  const controller = {
    id: loopId,
    stop() {
      if (S.raf) cancelAnimationFrame(S.raf);
      S.raf = null;
      window.removeEventListener("resize", onResize);
    },
    // Pause and jump to a normalized race time (0..1). Used by the replay
    // scrubber / verification; settles the eased camera so the static frame is
    // framed correctly.
    seek(t) {
      S.playing = false;
      if (playBtn) playBtn.textContent = "▶";
      S.countdown = 0;
      S.tau = Math.max(0, Math.min(1, t));
      for (let i = 0; i < 80; i++) updateCamera();
      draw();
    }
  };
  RC_ACTIVE = controller;
  state.current.racePlayer = controller;

  S.last = performance.now();
  S.raf = requestAnimationFrame(frame);
  return controller;
}
