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

// =========================================================================
// Pixel dragon, drawn on canvas. Keeps the cute identity (base colour + belly +
// spine), but is fully parameterised so body language reflects the timeline:
// gait tempo & lean from speed, wing flap, head-down + sweat when tiring,
// rotation when stumbling, glow when surging.
// =========================================================================
function rcDrawDragon(ctx, o) {
  const s = o.scale;
  const base = o.color, dark = rcShade(base, -34), light = rcShade(base, 28), belly = rcShade(base, 58);
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.tumble) ctx.rotate(o.tumble);
  ctx.scale(s, s);

  // surge glow
  if (o.glow > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 * o.glow;
    ctx.fillStyle = rcRgba(base, 0.9);
    ctx.beginPath(); ctx.ellipse(0, -6, 22, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const lean = o.lean || 0;
  ctx.rotate(-lean * 0.18);            // lean forward when fast

  const gait = o.gait || 0;
  const legSwing = Math.sin(gait) * (o.down ? 1.2 : 3.2);
  const legSwing2 = Math.sin(gait + Math.PI) * (o.down ? 1.2 : 3.2);
  const bodyBob = o.down ? 1.5 : Math.abs(Math.sin(gait)) * 1.3;
  const headY = o.down ? -3 : -8 - bodyBob;

  // tail
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-13, -6 + bodyBob);
  ctx.quadraticCurveTo(-24, -4 - Math.sin(gait) * 3, -22, 3);
  ctx.quadraticCurveTo(-18, -2, -12, -2 + bodyBob);
  ctx.fill();

  // far wing (behind body)
  const flap = Math.sin((o.flap || 0)) * 6;
  ctx.fillStyle = rcShade(base, -12);
  ctx.beginPath();
  ctx.moveTo(-4, -10 + bodyBob);
  ctx.quadraticCurveTo(-14, -20 - flap, -2, -22 - flap);
  ctx.quadraticCurveTo(2, -14, -4, -10 + bodyBob);
  ctx.fill();

  // legs (run cycle)
  ctx.strokeStyle = dark; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  const legY = 4 + bodyBob;
  ctx.beginPath();
  ctx.moveTo(-6, legY); ctx.lineTo(-6 + legSwing, legY + 8);
  ctx.moveTo(-2, legY); ctx.lineTo(-2 + legSwing2, legY + 8);
  ctx.moveTo(5, legY);  ctx.lineTo(5 + legSwing2, legY + 8);
  ctx.moveTo(9, legY);  ctx.lineTo(9 + legSwing, legY + 8);
  ctx.stroke();

  // torso
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(0, -4 + bodyBob, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // belly
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(1, -1 + bodyBob, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // spine ridge
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-8, -10 + bodyBob);
  ctx.lineTo(-4, -14 + bodyBob);
  ctx.lineTo(-2, -10 + bodyBob);
  ctx.lineTo(2, -14 + bodyBob);
  ctx.lineTo(4, -10 + bodyBob);
  ctx.fill();

  // head
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(12, headY, 7.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // snout
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(17, headY + 1, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // horns
  ctx.strokeStyle = rcShade(base, -45); ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, headY - 5); ctx.lineTo(7, headY - 11);
  ctx.moveTo(13, headY - 6); ctx.lineTo(13, headY - 12);
  ctx.stroke();

  // near wing (in front)
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(0, -8 + bodyBob);
  ctx.quadraticCurveTo(-8, -22 - flap, 6, -24 - flap);
  ctx.quadraticCurveTo(8, -12, 0, -8 + bodyBob);
  ctx.fill();

  // eye
  ctx.fillStyle = "#1b2330";
  if (o.down) {
    // tired: ^ eye
    ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(11, headY - 1); ctx.lineTo(13, headY - 2.5); ctx.lineTo(15, headY - 1); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(13.5, headY - 1, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(14.1, headY - 1.7, 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // open mouth when pushing hard / goal
  if (o.effort) {
    ctx.fillStyle = "#7a1f2b";
    ctx.beginPath(); ctx.ellipse(18, headY + 3, 2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
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
    gait: {},          // per-dragon gait clock
    particles: [],
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

  // ---- camera (smoothed) ----
  function updateCamera() {
    let leaderP = 0, lastP = 1;
    for (const dr of dragons) {
      const p = timeline.progressAt(dr.id, S.tau);
      if (p > leaderP) leaderP = p;
      if (p < lastP) lastP = p;
    }
    const WINW = clamp((leaderP - lastP) + 0.12, 0.20, 0.55);
    const targetL = leaderP - 0.66 * WINW;
    S.camL += (targetL - S.camL) * 0.12;
    S._winw = WINW;
    return { leaderP, lastP, WINW };
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

  // =====================================================================
  // DRAW
  // =====================================================================
  function draw() {
    const cam = updateCamera();
    const WINW = cam.WINW;
    const g = trackGeom();

    // --- sky ---
    const sky = cctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, "#10162e");
    sky.addColorStop(0.55, "#1d2547");
    sky.addColorStop(1, "#2a2140");
    cctx.fillStyle = sky;
    cctx.fillRect(0, 0, cw, ch);

    // moon
    cctx.fillStyle = "rgba(255,247,224,0.92)";
    cctx.beginPath(); cctx.arc(cw * 0.82, ch * 0.16, 22, 0, Math.PI * 2); cctx.fill();
    cctx.fillStyle = "rgba(255,247,224,0.10)";
    cctx.beginPath(); cctx.arc(cw * 0.82, ch * 0.16, 34, 0, Math.PI * 2); cctx.fill();

    // parallax skyline (scrolls slowly with camera)
    const skl = (S.camL * 220) % 60;
    cctx.fillStyle = "rgba(20,26,52,0.9)";
    for (let i = -1; i < cw / 60 + 1; i++) {
      const x = i * 60 - skl;
      const h = 18 + ((i * 37) % 5) * 6;
      cctx.fillRect(x, g.top - h - 6, 44, h);
    }
    // distant clock tower
    cctx.fillStyle = "rgba(40,46,78,0.95)";
    const tx = cw * 0.62 - (S.camL * 120 % cw);
    cctx.fillRect(tx, g.top - 64, 26, 64);
    cctx.fillStyle = "rgba(255,240,200,0.85)";
    cctx.beginPath(); cctx.arc(tx + 13, g.top - 50, 7, 0, Math.PI * 2); cctx.fill();

    // crowd band
    cctx.fillStyle = "#181d33";
    cctx.fillRect(0, g.top - 6, cw, 10);
    const crowdScroll = (S.camL * 600) % 14;
    for (let x = -crowdScroll; x < cw; x += 14) {
      cctx.fillStyle = ["#3a4474", "#46406e", "#523b5e", "#3e4a6b"][(Math.floor(x) % 4 + 4) % 4];
      cctx.beginPath(); cctx.arc(x, g.top - 2, 3, 0, Math.PI * 2); cctx.fill();
    }

    // --- track ground (turf, brighter near the camera for depth) ---
    const grd = cctx.createLinearGradient(0, g.top, 0, g.bottom);
    grd.addColorStop(0, "#34502f");
    grd.addColorStop(0.5, "#3c5a37");
    grd.addColorStop(1, "#22361f");
    cctx.fillStyle = grd;
    cctx.fillRect(0, g.top, cw, g.bottom - g.top);
    // mowed-stripe banding for a groomed-turf look
    cctx.fillStyle = "rgba(255,255,255,0.020)";
    for (let i = 0; i < 8; i += 2) cctx.fillRect(0, g.top + i * g.laneH, cw, g.laneH);

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
      rcDrawDragon(cctx, {
        x: drawX, y: y, scale: sprScale,
        color: dr.color, style: dr.style,
        gait: S.gait[dr.id], flap: S.gait[dr.id] * 0.6,
        lean: intensity, down: down, tumble: tumble, glow: glow, effort: effort
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

    // --- particles ---
    for (const p of S.particles) {
      const a = p.life;
      if (p.kind === "dust") cctx.fillStyle = `rgba(180,170,150,${0.5 * a})`;
      else cctx.fillStyle = p.color ? rcRgba(p.color, a) : `rgba(255,230,150,${a})`;
      cctx.beginPath(); cctx.arc(p.x, p.y, p.size * (p.kind === "dust" ? (1 + (1 - a)) : 1), 0, Math.PI * 2); cctx.fill();
    }

    // --- floating texts ---
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
    // particles
    for (const p of S.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt;
      p.life -= dt / p.max;
    }
    S.particles = S.particles.filter(p => p.life > 0);
    // floats
    for (const f of S.floats) { f.y += f.vy * dt; f.life -= dt * 0.7; }
    S.floats = S.floats.filter(f => f.life > 0);
    if (S.countdown > 0) S.countdown -= dt * 1.3;

    if (!S.playing || S.finished) return;
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
