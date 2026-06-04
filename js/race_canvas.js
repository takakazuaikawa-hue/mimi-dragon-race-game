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

// Phase-entry banners — a big sweeping caption the instant the field rolls into
// a new act of the race. Indexed to timeline.phaseIndexAt() (序盤/中盤/展開/終盤/
// ゴール前). Index 0 is intentionally blank so the opening act doesn't double up
// with the GO！ burst. Pure presentation: tune freely, the result never changes.
const RC_PHASE_BANNERS = ["", "隊列形成", "中盤の攻防", "直線勝負！", "ゴール前！"];

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
// Terrain identity for the watcher: an icon for the HUD + the section sign, and a
// translucent full-scene wash so each course's character is felt at a glance. The
// race result is untouched — this is purely how the fixed run is dressed on screen.
const RC_TERRAIN = {
  straight: { icon: "🏁", word: "直線",   tint: null,                     turn: 0 },
  uphill:   { icon: "⛰️", word: "上り坂", tint: "rgba(170,130,70,0.10)",  turn: 0 },
  narrow:   { icon: "🪨", word: "狭路",   tint: "rgba(50,38,24,0.16)",    turn: 0 },
  fire:     { icon: "🌋", word: "火山",   tint: "rgba(255,70,20,0.15)",   turn: 0 },
  mist:     { icon: "🌫️", word: "霧",     tint: "rgba(208,222,234,0.16)", turn: 0 },
  wind:     { icon: "💨", word: "強風",   tint: "rgba(150,200,255,0.09)", turn: 0 },
  turn:     { icon: "🌀", word: "旋回",   tint: "rgba(255,224,106,0.07)", turn: 1 },
  rolling:  { icon: "🏞️", word: "起伏",   tint: "rgba(130,180,100,0.08)", turn: 0 },
  bridge:   { icon: "🌉", word: "橋上",   tint: "rgba(150,200,220,0.10)", turn: 0 }
};
function rcTerrainInfo(key) { return RC_TERRAIN[key] || RC_TERRAIN.straight; }

// =========================================================================
// Pixel dragon, drawn on canvas. Keeps the cute identity (base colour + belly +
// spine), but is fully parameterised so body language reflects the timeline:
// gait tempo & lean from speed, wing flap, head-down + sweat when tiring,
// rotation when stumbling, glow when surging.
// =========================================================================
// =========================================================================
// Pixel-art dragon sprite (DQ-style chibi). The dragon is defined as a few simple
// shapes rasterised ONCE onto a low-res grid with a crisp outline + tight palette,
// then recoloured per dragon and drawn as filled rects. A short wing-flap cycle gives
// the flight animation; a floating bob / lean / tumble are applied at draw time.
// =========================================================================
const RC_DRG = {
  GW: 44, GH: 28,
  anchorX: 24, anchorY: 16,   // grid cell mapped to the dragon's (x,y) position (body centre, flying)
  px: 1.78,                    // on-screen cell size = scale * px
  P: { hx: 28, hy: 9, hr: 6.6, bx: 20, by: 16, brx: 6.6, bry: 5.6, eyeK: 0.9, pupK: 0.66 }
};
function _rcInEll(gx, gy, cx, cy, rx, ry) { const dx = (gx - cx) / rx, dy = (gy - cy) / ry; return dx * dx + dy * dy <= 1; }
function _rcInRect(gx, gy, x, y, w, h) { return gx >= x && gx < x + w && gy >= y && gy < y + h; }
function _rcSgn(ax, ay, bx, by, cx, cy) { return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy); }
function _rcInTri(px, py, A, B, C) { const d1 = _rcSgn(px, py, A[0], A[1], B[0], B[1]), d2 = _rcSgn(px, py, B[0], B[1], C[0], C[1]), d3 = _rcSgn(px, py, C[0], C[1], A[0], A[1]); return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0))); }
function _rcInPoly(px, py, pts) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
// ---- neon recolour: push the base hue to a vivid, luminous neon ----
function _rcHexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _rcRgbHex(r, g, b) { const f = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); return '#' + f(r) + f(g) + f(b); }
function _rcNeon(hex) {
  let c = _rcHexRgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0, s = 0; const l = (mx + mn) / 2;
  if (d !== 0) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? (((g - b) / d) % 6) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4); h *= 60; if (h < 0) h += 360; }
  s = Math.min(1, s * 1.7 + 0.4); const L = 0.56;
  const cc = (1 - Math.abs(2 * L - 1)) * s, X = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = L - cc / 2;
  let rr, gg, bb;
  if (h < 60) { rr = cc; gg = X; bb = 0; } else if (h < 120) { rr = X; gg = cc; bb = 0; } else if (h < 180) { rr = 0; gg = cc; bb = X; } else if (h < 240) { rr = 0; gg = X; bb = cc; } else if (h < 300) { rr = X; gg = 0; bb = cc; } else { rr = cc; gg = 0; bb = X; }
  return _rcRgbHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}
function _rcDragonShapes(P, flap) {
  const hx = P.hx, hy = P.hy, hr = P.hr, bx = P.bx, by = P.by, brx = P.brx, bry = P.bry;
  const sx = hx + hr * 0.86, sy = hy + hr * 0.34, ex = hx + hr * 0.10, ey = hy - hr * 0.10;
  const lift = ((flap == null ? 0.5 : flap) - 0.5) * 5.0;   // wing-tip vertical travel (flap)
  const S = [];
  // far wing (behind, darker) — a fuller dragon wing
  {
    const J = [bx + brx * 0.06, by - bry * 0.32];
    const u1 = [bx - brx * 0.8, by - bry * 2.25 + lift * 0.7];
    const u2 = [bx - brx * 0.28, by - bry * 1.7 + lift * 0.4];
    const u3 = [bx + brx * 0.12, by - bry * 0.9 + lift * 0.15];
    const dp = (a, b) => [(a[0] + b[0]) / 2 * 0.85 + J[0] * 0.15, (a[1] + b[1]) / 2 * 0.85 + J[1] * 0.15];
    S.push({ k: 'D', t: 'poly', p: [J, u1, dp(u1, u2), u2, dp(u2, u3), u3] });
  }
  // tail — SIMPLE: one clean tapering tail (no deep curl, no spade fin)
  {
    const tr = bx - brx;   // root (body back)
    S.push({ k: 'B', t: 'poly', p: [
      [tr + 1.0, by - bry * 0.26], [tr - brx * 1.34, by + bry * 0.6],
      [tr - brx * 1.16, by + bry * 0.82], [tr + 1.0, by + bry * 0.5]
    ]});
    S.push({ k: 'M', t: 'poly', p: [
      [tr - brx * 0.3, by + bry * 0.5], [tr - brx * 1.2, by + bry * 0.78],
      [tr - brx * 1.34, by + bry * 0.6], [tr - brx * 0.55, by + bry * 0.38]
    ]});   // subtle underside shade
  }
  // tiny TUCKED legs (small claw nubs only — it's a FLYING dragon now)
  S.push({ k: 'M', t: 'ell', p: [bx - brx * 0.28, by + bry * 0.82, 1.4, 1.6] });
  S.push({ k: 'M', t: 'ell', p: [bx + brx * 0.34, by + bry * 0.78, 1.4, 1.6] });
  S.push({ k: 'D', t: 'tri', p: [[bx - brx * 0.28 - 1, by + bry * 1.45], [bx - brx * 0.28, by + bry * 1.05], [bx - brx * 0.28 + 1, by + bry * 1.45]] });
  S.push({ k: 'D', t: 'tri', p: [[bx + brx * 0.34 - 1, by + bry * 1.4], [bx + brx * 0.34, by + bry * 1.0], [bx + brx * 0.34 + 1, by + bry * 1.4]] });
  // body + belly
  S.push({ k: 'B', t: 'ell', p: [bx, by, brx, bry] });
  S.push({ k: 'M', t: 'ell', p: [bx, by + bry * 0.45, brx * 0.85, bry * 0.55] });
  S.push({ k: 'b', t: 'ell', p: [bx + brx * 0.06, by + bry * 0.5, brx * 0.62, bry * 0.5] });
  // neck + head
  S.push({ k: 'B', t: 'ell', p: [(bx + hx) / 2 + 1, (by + hy) / 2, 3.0, Math.abs(by - hy) / 2 + 2.2] });
  S.push({ k: 'B', t: 'ell', p: [hx, hy, hr, hr * 0.97] });
  S.push({ k: 'L', t: 'ell', p: [hx - hr * 0.36, hy - hr * 0.4, hr * 0.5, hr * 0.36] });
  S.push({ k: 'B', t: 'ell', p: [sx - hr * 0.06, sy + hr * 0.04, hr * 0.56, hr * 0.48] });   // blunt reptilian muzzle (not a beak)
  S.push({ k: 'L', t: 'ell', p: [sx - hr * 0.16, sy - hr * 0.2, hr * 0.34, hr * 0.18] });    // nose-bridge highlight
  // horns
  // horns — two swept-back horns: a distinct far horn (darker, behind) + a prominent near horn
  S.push({ k: 'H', t: 'poly', p: [[hx - hr * 0.04, hy - hr * 0.56], [hx - hr * 0.82, hy - hr * 1.12], [hx - hr * 0.62, hy - hr * 1.2], [hx + hr * 0.2, hy - hr * 0.5]] });   // far horn
  S.push({ k: 'h', t: 'poly', p: [[hx + hr * 0.16, hy - hr * 0.58], [hx - hr * 0.58, hy - hr * 1.3], [hx - hr * 0.34, hy - hr * 1.36], [hx + hr * 0.44, hy - hr * 0.5]] });   // near horn
  S.push({ k: 'L', t: 'tri', p: [[hx + hr * 0.3, hy - hr * 0.56], [hx - hr * 0.48, hy - hr * 1.28], [hx - hr * 0.3, hy - hr * 1.32]] });   // near-horn highlight
  // eye (sizes from P.eyeK / P.pupK so variants can be compared)
  const eK = P.eyeK || 1, pK = P.pupK || 1;
  S.push({ k: 'e', t: 'ell', p: [ex, ey, hr * 0.46 * eK, hr * 0.52 * eK] });
  S.push({ k: 'p', t: 'ell', p: [ex + hr * 0.16, ey + hr * 0.16, hr * 0.27 * pK, hr * 0.32 * pK] });
  S.push({ k: 'n', t: 'rect', p: [sx + hr * 0.34, sy - hr * 0.12, 1.0, 1.0] });   // nostril
  // CLOSED reptilian mouth — a dark lip line along the lower muzzle (curving up at the
  // back, NOT a beak split) + clear white fangs poking DOWN from the upper lip.
  S.push({ k: 'o', t: 'poly', p: [[sx + hr * 0.52, sy + hr * 0.3], [sx + hr * 0.52, sy + hr * 0.4], [sx - hr * 0.14, sy + hr * 0.46], [sx - hr * 0.18, sy + hr * 0.36]] });   // lip line
  S.push({ k: 'f', t: 'poly', p: [[sx + hr * 0.44, sy + hr * 0.36], [sx + hr * 0.38, sy + hr * 0.66], [sx + hr * 0.5, sy + hr * 0.52]] });   // front fang (big, clear)
  S.push({ k: 'f', t: 'poly', p: [[sx + hr * 0.24, sy + hr * 0.4], [sx + hr * 0.19, sy + hr * 0.64], [sx + hr * 0.31, sy + hr * 0.54]] });   // second fang
  // near wing — SIDE PROFILE, FULL & refined: a leading-edge arm rises from the shoulder
  // to the tip; a BROAD membrane sail trails behind with gentle scallops + finger struts.
  {
    const S0 = [bx + brx * 0.3, by - bry * 0.22];                 // shoulder joint
    const W0 = [bx - brx * 0.28, by - bry * 1.85 + lift * 0.8];   // wrist (mid leading edge)
    const T0 = [bx - brx * 0.66, by - bry * 2.45 + lift];         // wing tip
    const e1 = [bx - brx * 1.02, by - bry * 1.42 + lift * 0.55];  // broad trailing edge (out & back)
    const e2 = [bx - brx * 0.6, by - bry * 0.52 + lift * 0.25];
    const e3 = [bx - brx * 0.08, by - bry * 0.05];               // trailing edge meeting the back
    S.push({ k: 'w', t: 'poly', p: [S0, W0, T0, e1, e2, e3] });   // broad membrane sail
    S.push({ k: 'W', t: 'poly', p: [S0, W0, T0, e1, [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2]] });  // lit membrane
    S.push({ k: 'D', t: 'poly', p: [[S0[0] - 0.5, S0[1] - 0.4], [W0[0] - 0.5, W0[1] - 0.4], [T0[0], T0[1]], [T0[0] + 1.0, T0[1] + 0.9], [W0[0] + 0.6, W0[1] + 0.7], [S0[0] + 0.7, S0[1] + 0.6]] });  // leading-edge arm
    S.push({ k: 'D', t: 'tri', p: [[W0[0], W0[1]], e1, [W0[0] + 0.8, W0[1] + 0.9]] });  // finger strut
    S.push({ k: 'D', t: 'tri', p: [[W0[0], W0[1]], e2, [W0[0] + 0.8, W0[1] + 0.9]] });  // finger strut
  }
  return S;
}
function _rcCover(s, gx, gy) { const cx = gx + 0.5, cy = gy + 0.5; return s.t === 'ell' ? _rcInEll(cx, cy, s.p[0], s.p[1], s.p[2], s.p[3]) : s.t === 'rect' ? _rcInRect(cx, cy, s.p[0], s.p[1], s.p[2], s.p[3]) : s.t === 'poly' ? _rcInPoly(cx, cy, s.p) : _rcInTri(cx, cy, s.p[0], s.p[1], s.p[2]); }
function _rcBuildGrid(P, legDX) {
  const sh = _rcDragonShapes(P, legDX), GW = RC_DRG.GW, GH = RC_DRG.GH;
  const g = []; for (let y = 0; y < GH; y++) g.push(new Array(GW).fill(null));
  for (const s of sh) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (_rcCover(s, x, y)) g[y][x] = s.k; }
  const og = g.map(r => r.slice());
  const fil = (x, y) => x >= 0 && x < GW && y >= 0 && y < GH && g[y][x] != null;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (g[y][x] == null && (fil(x - 1, y) || fil(x + 1, y) || fil(x, y - 1) || fil(x, y + 1))) og[y][x] = 'o'; }
  return og;
}
const _RC_FLAP = [0.12, 0.5, 0.92, 0.5];   // wing-flap cycle: down → mid → up → mid
const RC_DRAGON_FRAMES = _RC_FLAP.map(f => _rcBuildGrid(RC_DRG.P, f));
function _rcDragonPal(base) {
  // Natural (distinguishable) base colours, but keep the "pop": brighter highlights
  // + a deep-violet outline. The luminous halo (drawn separately) carries the glow.
  const b0 = base || '#8a8a8a';
  return { 'o': '#201425', 'D': rcShade(b0, -46), 'M': rcShade(b0, -20), 'B': b0, 'L': rcShade(b0, 40), 'b': rcShade(b0, 82), 'h': '#f1e8cf', 'H': rcShade('#f1e8cf', -42), 'w': rcShade(b0, -6), 'W': rcShade(b0, 36), 'e': '#ffffff', 'p': '#2b39c8', 'f': '#ffffff', 'm': '#4a1018', 'n': '#201425' };
}
function rcDrawDragonPixel(ctx, o) {
  let fi = Math.floor((o.gait || 0) / (Math.PI / 2)) % RC_DRAGON_FRAMES.length;
  if (fi < 0) fi += RC_DRAGON_FRAMES.length;
  const grid = RC_DRAGON_FRAMES[fi];
  const pal = _rcDragonPal(o.color || '#8a8a8a');
  const pxc = (o.scale || 1) * RC_DRG.px;
  const bob = Math.sin((o.gait || 0) * 0.7) * (o.down ? 0.4 : 1);   // gentle floating (flight)
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.tumble) ctx.rotate(o.tumble);
  ctx.rotate(-(o.lean || 0) * 0.06 + (o.bank || 0) * 0.10);
  ctx.translate(0, -bob * pxc * 0.9);
  // soft luminous halo — keeps the eye-catching "pop" without washing out the colours
  {
    ctx.save(); ctx.globalAlpha = 0.22;
    const gc = rcShade(o.color || '#888', 46), r = 14 * pxc;
    const ng = ctx.createRadialGradient(0, -pxc, 2, 0, -pxc, r);
    ng.addColorStop(0, rcRgba(gc, 0.7)); ng.addColorStop(0.6, rcRgba(gc, 0.15)); ng.addColorStop(1, rcRgba(gc, 0));
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, -pxc, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (o.glow > 0) {
    ctx.save(); ctx.globalAlpha = 0.5 * o.glow;
    const ag = ctx.createRadialGradient(0, -8 * pxc, 2, 0, -8 * pxc, 30);
    ag.addColorStop(0, rcRgba(o.color || '#fff', 0.9)); ag.addColorStop(1, rcRgba(o.color || '#fff', 0));
    ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(0, -8 * pxc, 26, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const ox = -RC_DRG.anchorX * pxc, oy = -RC_DRG.anchorY * pxc, GW = RC_DRG.GW, GH = RC_DRG.GH;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = grid[y][x]; if (!k) continue;
    ctx.fillStyle = pal[k]; ctx.fillRect(Math.round(ox + x * pxc), Math.round(oy + y * pxc), Math.ceil(pxc), Math.ceil(pxc));
  }
  ctx.restore();
}

function rcDrawDragon(ctx, o) {
  return rcDrawDragonPixel(ctx, o);
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
  if (!cctx) {
    // 2D canvas が使えない環境 — 視覚レースを飛ばして結果画面へ直行し、進行を止めない
    if (typeof renderResult === "function") renderResult();
    return null;
  }
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
    const parent = canvas.parentElement;
    if (!parent) return;          // canvas が DOM から外れている — リサイズをスキップ
    const rect = parent.getBoundingClientRect();
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
    crossClock: {},     // per-dragon seconds since it crossed the wire (run-through)
    crossV: {},         // per-dragon speed at the moment it crossed (coast distance ∝ this)
    showLog: false,
    finishedAnnounced: false,
    countdown: 0,
    // --- presentation drama ---
    preT: 3.0,          // pre-start 3-2-1 countdown (holds τ at the gate)
    goFlash: 0,         // "GO！" burst after the countdown
    zoomBump: 0,        // extra push-in impulse from overtakes / close battles
    prevStand: null,    // {id: place} last frame, for overtake detection
    cheerT: 1.2,        // throttle for cheer-your-pick callouts
    battleT: 0,         // throttle for 接戦！ callouts
    overT: 0,           // throttle for overtake callouts
    celebrated: false,  // finish confetti fired once
    confettiT: 0,       // ongoing confetti spawn while celebrating
    banner: null,       // {text,t,max} active phase-entry banner
    phaseShown: 0,      // last phase index a banner was raised for
    trioShown: false,   // "三つ巴！" lead-trio callout fired once
    terrainSign: null,  // {icon,label,t,max} section-entry terrain sign
    sectionShown: -1,   // last course third (0/1/2) a terrain sign was raised for
    tilt: 0             // eased camera roll — banks the view through turns
  };
  dragons.forEach(dr => { S.gait[dr.id] = Math.random() * Math.PI * 2; });

  // player's pick (first selection) — used by the cheer treatment
  const pickId = (bet && bet.selections && bet.selections[0]) || null;
  // presentation-only bet-hit check, mirrors resolveBet (win:1st / place:top3 / wide:both top3)
  function computeBetHit() {
    if (!bet || !betSet.size) return null;
    const placeOf = {}; timeline.crossings.forEach(c => { placeOf[c.id] = c.place; });
    const top3 = timeline.crossings.filter(c => c.place <= 3).map(c => c.id);
    if (bet.type === "win")   return placeOf[bet.selections[0]] === 1;
    if (bet.type === "place") return top3.includes(bet.selections[0]);
    if (bet.type === "wide")  return top3.includes(bet.selections[0]) && top3.includes(bet.selections[1]);
    return null;
  }

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
  // celebration confetti — colourful ribbons fluttering down from the top (screen space)
  const CONFETTI_COLORS = ["#ff5a7a", "#ffd34d", "#5cc6ff", "#7df29a", "#c79bff", "#ffae5c", "#ffffff"];
  function spawnConfetti(n) {
    for (let i = 0; i < n; i++) {
      S.particles.push({
        scr: true, kind: "confetti",
        x: Math.random() * cw, y: -8 - Math.random() * 30,
        vx: (Math.random() * 2 - 1) * 36, vy: 50 + Math.random() * 70,
        rot: Math.random() * Math.PI, vr: (Math.random() * 2 - 1) * 8,
        life: 1, max: 1.6 + Math.random() * 1.2, size: 4 + Math.random() * 4,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
      });
    }
  }
  // firework burst at a screen point (radial sparks that fade)
  function spawnFirework(x, y, color) {
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, sp = 60 + Math.random() * 50;
      S.particles.push({
        scr: true, kind: "spark",
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, max: 0.7 + Math.random() * 0.5, size: 1.6 + Math.random() * 1.8,
        color: color || CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
      });
    }
  }

  // ---- camera (smoothed follow + dynamic zoom / vertical pan) ----
  function updateCamera() {
    const K = (timeline.leadPackSize || 3);
    let leaderP = 0, lastP = 1, leaderId = null;
    const ps = [];
    for (const dr of dragons) {
      const p = visProgress(dr.id);   // extends past 1 during the run-out so the camera follows through the wire
      ps.push(p);
      if (p > leaderP) { leaderP = p; leaderId = dr.id; }
      if (p < lastP) lastP = p;
    }
    // Progress of the current K-th place (the lead-pack tail). Late in the race
    // we slide the frame's lower bound up from lastP toward this, tightening the
    // camera onto the lead trio so trailing dragons drop off-frame — the field
    // visually thins to three. focusT ramps 0 (whole field) → 1 (trio only).
    ps.sort((a, b) => b - a);
    const packTailP = ps[Math.min(K, ps.length) - 1];
    // ramp early & aggressively so the field very visibly thins to the trio
    const focusT = clamp((leaderP - 0.25) / 0.5, 0, 1);
    const focusLowerP = lastP + (packTailP - lastP) * focusT;
    S._focusT = focusT;
    S._finishFade = clamp((leaderP - 0.82) / 0.18, 0, 1);   // last-18%: isolate the lead trio
    // Tighter window than before: a narrower slice of track on screen means the
    // ground (mapped through WINW) scrolls past noticeably faster → real speed,
    // and the field spreads out horizontally instead of clumping.
    const WINW = clamp((leaderP - focusLowerP) * 0.9 + 0.075, 0.135, 0.4);
    const targetL = leaderP - 0.66 * WINW;
    S.camL += (targetL - S.camL) * 0.12;
    S._winw = WINW;

    // push in near the finish and when the field bunches up; pull back when spread
    const finishProx = clamp((leaderP - 0.72) / 0.28, 0, 1);
    const bunch = clamp(1 - (leaderP - lastP) / 0.22, 0, 1);
    // Strong, ACCELERATING push-in for the finish so ゴール直前 is a real close-up,
    // held tight on the trio after the line. The curve (squared) only ramps hard in
    // the final stretch, so there are no mid-race "bumps" that read as a glitch.
    const fpEase = finishProx * finishProx;
    S.zoomT = S.finished ? 1.26 : (1 + 0.28 * fpEase + 0.03 * bunch);
    S.zoom += (S.zoomT - S.zoom) * 0.07;

    // gentle vertical pan toward the leader's lane → the camera "follows"
    const g = trackGeom();
    const centerY = (g.top + g.bottom) / 2;
    let leadLaneY = centerY;
    if (leaderId) { const dr = timeline.byId[leaderId]; if (dr) leadLaneY = laneY(dr, g); }
    S.camYT = clamp((centerY - leadLaneY) * 0.22, -ch * 0.05, ch * 0.05);
    S.camY += (S.camYT - S.camY) * 0.05;

    // bank the camera through turn sections — a subtle roll that reads as a corner
    const tiltTarget = rcTerrainInfo(themeKeyAtP(leaderP)).turn ? 0.02 : 0;
    S.tilt += (tiltTarget - S.tilt) * 0.04;

    return { leaderP, lastP, WINW, leaderId };
  }

  // ---- layout helpers ----
  function trackGeom() {
    const top = ch * 0.34, bottom = ch * 0.965;
    return { top, bottom, laneH: (bottom - top) / 8 };
  }

  // ---- run-through ("pull-up") ----------------------------------------------
  // Real horses gallop THROUGH the wire and decelerate over the next stretch — they
  // don't stop on the line. After a dragon crosses, its visual progress keeps growing
  // past 1 (coasting, decelerating) from the moment IT crossed, so the field flows
  // through the line in finishing order. Presentation only: the official order is
  // already fixed by timeline.crossings and the result screen is authoritative.
  const RUNOUT_SMO   = 0.42;   // run-out plays at this fraction of real time = cinematic
                               // slow-MOTION (full stride/effort kept), not "tired & slow"
  const RUNOUT_COAST = 0.13;   // progress coasted past the wire (× crossing speed)
  const RUNOUT_TAU   = 4.6;    // gentle glide constant (≈ constant slow-mo velocity over the run-out)
  const RUNOUT_DUR   = 1.2;    // slow-mo clock units of run-out (≈ 1.2/SMO ≈ 2.9 s real) before the result
  function visProgress(id) {
    const c = S.crossClock[id];
    if (c != null) {
      const v = S.crossV[id] || 1;
      return 1 + v * RUNOUT_COAST * (1 - Math.exp(-c / RUNOUT_TAU));
    }
    return timeline.progressAt(id, S.tau);
  }
  // subtle depth: back lanes (top of screen) a touch smaller/dimmer than near
  // lanes (bottom), so the field reads with perspective without hurting rank legibility.
  function laneDepth(dr) { return 0.93 + (laneOf[dr.id] / 7) * 0.17; }
  function screenX(P, WINW) {
    const usableLeft = cw * 0.08, usableRight = cw * 0.94;
    const frac = (P - S.camL) / WINW;
    return usableLeft + frac * (usableRight - usableLeft);
  }
  // Near the goal, lanes (and the dragons in them) funnel toward the track centre
  // so the climactic battle gathers mid-frame and stays visible under the finish
  // zoom. `convAtP` is the funnel amount at a track fraction P; because a dragon's
  // screen-x corresponds to its own progress, applying convAtP with that progress
  // keeps the dragon sitting exactly ON its funneling lane. Cosmetic only —
  // horizontal progress (= finishing order) is never touched.
  function convAtP(P) {
    const c = clamp((P - 0.6) / 0.4, 0, 1);
    return c * c * 0.28;
  }
  function laneBaseY(idx, g) { return g.bottom - (idx + 0.5) * g.laneH; }
  function laneY(dr, g) {
    const baseY = laneBaseY(laneOf[dr.id], g);
    const centerY = g.top + (g.bottom - g.top) * 0.5;
    const P = timeline.progressAt(dr.id, S.tau);
    return baseY + (centerY - baseY) * convAtP(P);
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
    const t = performance.now();
    cctx.save();
    cctx.globalAlpha = alpha;
    if (key === "fire") {
      // red sky-glow band along the horizon
      const glow = cctx.createLinearGradient(0, hz - 130, 0, hz + 6);
      glow.addColorStop(0, "rgba(255,70,20,0)"); glow.addColorStop(1, "rgba(255,90,30,0.34)");
      cctx.fillStyle = glow; cctx.fillRect(0, hz - 130, cw, 136);
      // big erupting volcano cone (parallax)
      const vx = cw * 0.64 - ((S.camL * 70) % (cw * 1.7));
      const peak = hz - 108, halfW = 138;
      cctx.fillStyle = "#241010";
      cctx.beginPath();
      cctx.moveTo(vx - halfW, hz); cctx.lineTo(vx - 22, peak + 6);
      cctx.lineTo(vx + 22, peak + 6); cctx.lineTo(vx + halfW, hz); cctx.closePath(); cctx.fill();
      cctx.fillStyle = "rgba(86,42,30,0.55)";   // sunlit flank
      cctx.beginPath();
      cctx.moveTo(vx + 6, peak + 6); cctx.lineTo(vx + 22, peak + 6);
      cctx.lineTo(vx + halfW, hz); cctx.lineTo(vx + halfW * 0.42, hz); cctx.closePath(); cctx.fill();
      // glowing crater + lava fountain
      const cg = cctx.createRadialGradient(vx, peak + 8, 2, vx, peak + 8, 30);
      cg.addColorStop(0, "rgba(255,240,150,0.95)"); cg.addColorStop(0.5, "rgba(255,140,40,0.8)"); cg.addColorStop(1, "rgba(255,80,20,0)");
      cctx.fillStyle = cg; cctx.beginPath(); cctx.ellipse(vx, peak + 8, 27, 17, 0, 0, Math.PI * 2); cctx.fill();
      for (let i = 0; i < 8; i++) {
        const ph = (t / 680 + i * 0.47) % 1;                      // 0..1 rising spatter
        const fx = vx + Math.sin(i * 2.1) * 18 * ph, fy = peak + 8 - ph * 50;
        cctx.fillStyle = "rgba(255," + (190 - ((ph * 130) | 0)) + ",60," + ((1 - ph) * 0.9) + ")";
        cctx.beginPath(); cctx.arc(fx, fy, 3.4 * (1 - ph * 0.4), 0, Math.PI * 2); cctx.fill();
      }
      // lava flows down both flanks
      cctx.strokeStyle = "rgba(255,110,40,0.85)"; cctx.lineWidth = 3;
      for (let s = -1; s <= 1; s += 2) {
        cctx.beginPath(); cctx.moveTo(vx + s * 7, peak + 16);
        cctx.quadraticCurveTo(vx + s * 54, hz - 42, vx + s * (halfW - 30), hz - 2); cctx.stroke();
      }
      // dark smoke plume
      for (let i = 0; i < 5; i++) {
        const ph = (t / 2600 + i * 0.2) % 1;
        const sx = vx + Math.sin(i * 1.7 + t / 1800) * 20 * ph, sy = peak + 4 - ph * 74;
        cctx.fillStyle = "rgba(60,52,52," + ((1 - ph) * 0.5) + ")";
        cctx.beginPath(); cctx.arc(sx, sy, 9 + ph * 24, 0, Math.PI * 2); cctx.fill();
      }
    } else if (key === "turn") {
      // a big banked corner sweeps across the horizon: grandstand + striped curb
      const cx = cw * 0.5, cy = hz - 210, R = 178, a0 = Math.PI * 0.17, a1 = Math.PI * 0.83;
      cctx.strokeStyle = "rgba(26,30,54,0.9)"; cctx.lineWidth = 26;          // grandstand band
      cctx.beginPath(); cctx.arc(cx, cy, R - 20, a0, a1); cctx.stroke();
      cctx.fillStyle = "rgba(132,142,182,0.5)";                              // crowd speckle
      for (let i = 0; i < 36; i++) {
        const a = a0 + (a1 - a0) * (i / 36), rr = R - 14 - (i % 3) * 7;
        cctx.beginPath(); cctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.5, 0, Math.PI * 2); cctx.fill();
      }
      const segs = 30;                                                       // red/white striped curb
      for (let i = 0; i < segs; i++) {
        const b0 = a0 + (a1 - a0) * (i / segs), b1 = a0 + (a1 - a0) * ((i + 1) / segs);
        cctx.strokeStyle = (i % 2 === 0) ? "#d64b4b" : "#eef0f2"; cctx.lineWidth = 9;
        cctx.beginPath(); cctx.arc(cx, cy, R, b0, b1); cctx.stroke();
      }
    } else if (key === "wind") {
      cctx.fillStyle = "rgba(196,214,238,0.5)";                              // layered cloud banks
      for (let i = 0; i < 5; i++) {
        const cx = (((i * 150 - S.camL * 240) % (cw + 260)) + cw + 260) % (cw + 260) - 130;
        rcCloud(cx, hz - 42 - (i % 2) * 20, 28 + (i % 2) * 10);
      }
      cctx.strokeStyle = "rgba(205,228,255,0.5)"; cctx.lineWidth = 2;        // raking wind streaks
      for (let i = 0; i < 7; i++) {
        const yy = hz - 98 + i * 13, off = (t / 6 + i * 80) % (cw + 200);
        cctx.beginPath(); cctx.moveTo(cw - off, yy); cctx.lineTo(cw - off + 72, yy - 6); cctx.stroke();
      }
    } else if (key === "mist") {
      for (let i = 0; i < 4; i++) {                                          // thick stacked fog banks
        const yy = hz - 64 + i * 18;
        const mg = cctx.createLinearGradient(0, yy, 0, yy + 30);
        mg.addColorStop(0, "rgba(206,220,232,0)"); mg.addColorStop(1, "rgba(206,220,232," + (0.22 + i * 0.06) + ")");
        cctx.fillStyle = mg;
        cctx.fillRect(-20 + Math.sin(t / 2600 + i) * 18, yy, cw + 40, 30);
      }
    } else if (key === "bridge") {
      cctx.fillStyle = "rgba(40,70,96,0.5)"; cctx.fillRect(0, hz, cw, 8);    // water below
      cctx.strokeStyle = "rgba(150,200,225,0.35)"; cctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const yy = hz + 2 + (i % 3), off = (t / 30 + i * 60) % (cw + 80);
        cctx.beginPath(); cctx.moveTo(off - 40, yy); cctx.lineTo(off, yy); cctx.stroke();
      }
      const bx = cw * 0.3 - ((S.camL * 110) % (cw * 1.3)), span = cw * 0.6, tH = 76;
      cctx.strokeStyle = "rgba(150,172,188,0.85)"; cctx.lineWidth = 5;       // towers
      [bx, bx + span].forEach(tx => { cctx.beginPath(); cctx.moveTo(tx, hz); cctx.lineTo(tx, hz - tH); cctx.stroke(); });
      cctx.lineWidth = 2.5;                                                   // draped main cable
      cctx.beginPath(); cctx.moveTo(bx, hz - tH); cctx.quadraticCurveTo(bx + span / 2, hz - 16, bx + span, hz - tH); cctx.stroke();
      cctx.lineWidth = 1;                                                     // vertical hangers
      for (let i = 1; i < 10; i++) {
        const hx = bx + span * (i / 10);
        const cyl = hz - 16 - (1 - Math.pow((i / 10 - 0.5) * 2, 2)) * (tH - 16);
        cctx.beginPath(); cctx.moveTo(hx, hz - 6); cctx.lineTo(hx, cyl); cctx.stroke();
      }
    } else if (key === "uphill") {
      cctx.fillStyle = "rgba(30,46,28,0.85)";                                // a big slope to a summit
      cctx.beginPath();
      cctx.moveTo(0, hz); cctx.lineTo(0, hz - 10); cctx.lineTo(cw * 0.72, hz - 84); cctx.lineTo(cw * 0.72, hz); cctx.closePath(); cctx.fill();
      cctx.strokeStyle = "#cfe6ff"; cctx.lineWidth = 2;                      // summit flagpole
      cctx.beginPath(); cctx.moveTo(cw * 0.72, hz - 84); cctx.lineTo(cw * 0.72, hz - 102); cctx.stroke();
      cctx.fillStyle = "#ffe06a";
      cctx.beginPath(); cctx.moveTo(cw * 0.72, hz - 102); cctx.lineTo(cw * 0.72 + 16, hz - 97); cctx.lineTo(cw * 0.72, hz - 92); cctx.closePath(); cctx.fill();
    } else if (key === "rolling") {
      const cols = ["rgba(28,44,26,0.7)", "rgba(34,52,30,0.8)"];            // layered rolling hills
      for (let L = 0; L < 2; L++) {
        cctx.fillStyle = cols[L];
        cctx.beginPath(); cctx.moveTo(0, hz);
        const amp = 16 + L * 12, ph = S.camL * (160 + L * 80);
        for (let x = 0; x <= cw; x += 30) cctx.lineTo(x, hz - 10 - L * 8 - amp * (0.5 + 0.5 * Math.sin((x + ph) / (70 + L * 20))));
        cctx.lineTo(cw, hz); cctx.closePath(); cctx.fill();
      }
    } else if (key === "narrow") {
      const wallH = ch * 0.20;                                               // tall canyon walls closing in
      [0, 1].forEach(side => {
        const baseX = side === 0 ? 0 : cw, inX = side === 0 ? cw * 0.17 : cw * 0.83;
        cctx.fillStyle = "rgba(34,28,20,0.92)";
        cctx.beginPath();
        cctx.moveTo(baseX, hz); cctx.lineTo(baseX, hz - wallH);
        cctx.lineTo(inX, hz - wallH * 0.5); cctx.lineTo(inX, hz); cctx.closePath(); cctx.fill();
        cctx.strokeStyle = "rgba(80,66,48,0.5)"; cctx.lineWidth = 1.5;       // rock striations
        for (let i = 1; i < 4; i++) {
          const yy = hz - wallH * (i / 4);
          cctx.beginPath(); cctx.moveTo(baseX, yy); cctx.lineTo(inX, yy - wallH * 0.12); cctx.stroke();
        }
      });
    }
    cctx.restore();
  }
  // surface treatment painted within the running band (world space)
  function drawGroundOverlay(key, g, WINW) {
    const t = performance.now();
    const band = g.bottom - g.top;
    if (key === "mist") {
      // heavy fog veil over the track + drifting wisps (kills contrast → reads as fog)
      cctx.fillStyle = "rgba(202,216,228,0.26)";
      cctx.fillRect(0, g.top, cw, band);
      cctx.fillStyle = "rgba(222,232,242,0.16)";
      for (let i = 0; i < 4; i++) {
        const y = g.top + (i + 0.5) * band / 4, x = ((t / 40 + i * 130) % (cw + 220)) - 110;
        cctx.beginPath(); cctx.ellipse(x, y, 82, 14, 0, 0, Math.PI * 2); cctx.fill();
      }
    } else if (key === "fire") {
      // glowing lava cracks crawling across the track, pulsing
      const pulse = 0.6 + 0.4 * Math.sin(t / 220);
      for (let i = 0; i < 4; i++) {
        const yy = g.top + (i + 0.5) * band / 4 + Math.sin(i) * 6, off = (S.camL * 300 + i * 47) % 120;
        cctx.lineWidth = 6; cctx.strokeStyle = "rgba(255,200,90," + (0.16 * pulse) + ")";   // hot glow (under)
        cctx.beginPath();
        for (let x = -off; x < cw + 30; x += 30) { const yj = yy + (((x + off) / 30 | 0) % 2 ? 4 : -4); (x === -off) ? cctx.moveTo(x, yj) : cctx.lineTo(x, yj); }
        cctx.stroke();
        cctx.lineWidth = 2.4; cctx.strokeStyle = "rgba(255," + (110 + (pulse * 60 | 0)) + ",40," + (0.55 * pulse) + ")";  // bright crack
        cctx.stroke();
      }
    } else if (key === "turn") {
      // red/white striped curb along the inner (top) edge of the running band
      const cw0 = 22, off = (S.camL * 600) % (cw0 * 2);
      for (let x = -off; x < cw; x += cw0) {
        cctx.fillStyle = ((x + off) / cw0 | 0) % 2 === 0 ? "rgba(214,75,75,0.9)" : "rgba(238,240,242,0.9)";
        cctx.fillRect(x, g.top, cw0, 7);
      }
      // big sweeping chevrons across the track, pointing through the bend
      cctx.strokeStyle = "rgba(255,224,106,0.7)"; cctx.lineWidth = 5;
      const cvW = 60, coff = (S.camL * 500) % cvW;
      for (let x = -coff; x < cw + cvW; x += cvW) {
        cctx.beginPath();
        cctx.moveTo(x, g.top + band * 0.30); cctx.lineTo(x + 26, g.top + band * 0.5); cctx.lineTo(x, g.top + band * 0.70);
        cctx.stroke();
      }
    } else if (key === "uphill") {
      // climbing shade (dark high / warm low) + upward chevrons → reads as a climb
      const sg = cctx.createLinearGradient(0, g.top, 0, g.bottom);
      sg.addColorStop(0, "rgba(0,0,0,0.18)"); sg.addColorStop(1, "rgba(255,240,200,0.05)");
      cctx.fillStyle = sg; cctx.fillRect(0, g.top, cw, band);
      cctx.strokeStyle = "rgba(192,232,172,0.55)"; cctx.lineWidth = 4;
      const cvW = 64, coff = (S.camL * 480) % cvW;
      for (let x = -coff; x < cw + cvW; x += cvW) {
        cctx.beginPath();
        cctx.moveTo(x, g.top + band * 0.62); cctx.lineTo(x + 22, g.top + band * 0.40); cctx.lineTo(x + 44, g.top + band * 0.62);
        cctx.stroke();
      }
    } else if (key === "bridge") {
      // side railings down both edges + plank seams
      cctx.strokeStyle = "rgba(160,182,198,0.7)"; cctx.lineWidth = 3;
      cctx.beginPath(); cctx.moveTo(0, g.top + 3); cctx.lineTo(cw, g.top + 3); cctx.stroke();
      cctx.beginPath(); cctx.moveTo(0, g.bottom - 3); cctx.lineTo(cw, g.bottom - 3); cctx.stroke();
      cctx.strokeStyle = "rgba(150,172,188,0.4)"; cctx.lineWidth = 2;
      const step = 0.03, startP = Math.floor(S.camL / step) * step;
      for (let P = startP; P < S.camL + WINW + step; P += step) {
        const x = screenX(P, WINW);
        cctx.beginPath(); cctx.moveTo(x, g.top); cctx.lineTo(x, g.bottom); cctx.stroke();
        cctx.fillStyle = "rgba(160,182,198,0.6)";
        cctx.fillRect(x - 1, g.top - 6, 2, 9); cctx.fillRect(x - 1, g.bottom - 3, 2, 9);
      }
    } else if (key === "narrow") {
      // jagged rock walls bite into the top & bottom of the runnable band
      const enc = band * 0.17;
      for (let edge = 0; edge < 2; edge++) {
        const yEdge = edge === 0 ? g.top : g.bottom, dir = edge === 0 ? 1 : -1;
        cctx.fillStyle = "rgba(36,30,22,0.86)";
        cctx.beginPath(); cctx.moveTo(0, yEdge);
        for (let x = 0; x <= cw; x += 26) {
          const j = enc * (0.5 + 0.5 * Math.sin((x + S.camL * 300) / 40 + edge * 2));
          cctx.lineTo(x, yEdge + dir * j);
        }
        cctx.lineTo(cw, yEdge); cctx.closePath(); cctx.fill();
      }
    } else if (key === "rolling") {
      // soft undulating shadow waves suggest rises and dips
      cctx.strokeStyle = "rgba(0,0,0,0.10)"; cctx.lineWidth = 10;
      for (let i = 0; i < 3; i++) {
        const ph = S.camL * 260 + i * 70, yb = g.top + band * (0.3 + i * 0.26);
        cctx.beginPath();
        for (let x = 0; x <= cw; x += 22) { const y = yb + Math.sin((x + ph) / 62) * 8; (x === 0) ? cctx.moveTo(x, y) : cctx.lineTo(x, y); }
        cctx.stroke();
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
    // denser spacing than before → more roadside objects whip past per second,
    // reinforcing the sense of speed now that the window is tighter.
    const step = 0.038, startP = Math.floor(S.camL / step) * step;
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
  // ---- live position minimap (compact strip: every dragon at a glance) ----
  function drawMinimap() {
    const mx0 = cw * 0.15, mx1 = cw * 0.85, my = ch * 0.05;
    const bx = mx0 - 16, bw = (mx1 - mx0) + 40, by = my - 9, bh = 18;
    cctx.save();
    // backing strip
    cctx.fillStyle = "rgba(10,14,28,0.50)";
    if (cctx.roundRect) { cctx.beginPath(); cctx.roundRect(bx, by, bw, bh, 9); cctx.fill(); }
    else cctx.fillRect(bx, by, bw, bh);
    cctx.strokeStyle = "rgba(255,255,255,0.12)"; cctx.lineWidth = 1;
    if (cctx.roundRect) { cctx.beginPath(); cctx.roundRect(bx, by, bw, bh, 9); cctx.stroke(); }
    else cctx.strokeRect(bx, by, bw, bh);
    // track baseline
    cctx.strokeStyle = "rgba(255,255,255,0.16)"; cctx.lineWidth = 2;
    cctx.beginPath(); cctx.moveTo(mx0, my); cctx.lineTo(mx1, my); cctx.stroke();
    // start tick
    cctx.fillStyle = "rgba(255,255,255,0.45)";
    cctx.fillRect(mx0 - 1, my - 4, 2, 8);
    // finish checker flag
    for (let r = 0; r < 3; r++) {
      cctx.fillStyle = (r % 2) ? "#1c2030" : "#f0f0f0"; cctx.fillRect(mx1 + 2, my - 4 + r * 3, 3, 3);
      cctx.fillStyle = (r % 2) ? "#f0f0f0" : "#1c2030"; cctx.fillRect(mx1 + 5, my - 4 + r * 3, 3, 3);
    }
    // leader (visProgress so the winner stays drawn on top through the run-out)
    let leaderP = -1, leaderId = null;
    for (const dr of dragons) { const p = visProgress(dr.id); if (p > leaderP) { leaderP = p; leaderId = dr.id; } }
    // draw the pack, with pick & leader last so they sit on top
    const order = [...dragons].sort((a, b) =>
      ((a.id === leaderId ? 2 : 0) + (betSet.has(a.id) ? 1 : 0)) -
      ((b.id === leaderId ? 2 : 0) + (betSet.has(b.id) ? 1 : 0)));
    for (const dr of order) {
      const p = clamp(timeline.progressAt(dr.id, S.tau), 0, 1);
      const x = mx0 + p * (mx1 - mx0);
      const isLead = dr.id === leaderId, isPick = betSet.has(dr.id);
      const r = isLead ? 4.5 : 3;
      if (isPick) { cctx.strokeStyle = "#ffd34d"; cctx.lineWidth = 2; cctx.beginPath(); cctx.arc(x, my, r + 3, 0, Math.PI * 2); cctx.stroke(); }
      cctx.fillStyle = dr.color || "#fff";
      cctx.beginPath(); cctx.arc(x, my, r, 0, Math.PI * 2); cctx.fill();
      if (isLead) { cctx.strokeStyle = "#fff"; cctx.lineWidth = 1.5; cctx.beginPath(); cctx.arc(x, my, r + 1.5, 0, Math.PI * 2); cctx.stroke(); }
    }
    cctx.restore();
  }

  function draw() {
    const cam = updateCamera();
    const WINW = cam.WINW;
    const leaderP = cam.leaderP;
    const g = trackGeom();
    // SREF = screen px a fixed ground point travels per unit camL. EVERY scrolling
    // cue (bunting, speed-streaks) is scaled off this so they move at the SAME real
    // rate as the track — no element flies past on a different plane (= natural).
    const SREF = (cw * 0.86) / WINW;

    // Screen-shake is deliberately neutralised: viewport jitter wrecks immersion.
    // Impact now reads from zoom push-in + slow-mo + telop + confetti, never from
    // shaking the camera. (S.shake still accrues harmlessly; it just isn't applied.)
    S.shakeX = 0;
    S.shakeY = 0;

    // blended terrain theme around the leader → tints the whole scene
    const tb = themeBlendAtP(leaderP);
    // Keep the generic grandstand skyline only for the plain straight; every other
    // terrain now shows its own dedicated backdrop so the course reads at a glance.
    const stadium = (tb.keyA === "straight");

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
      const skl = (S.camL * 210) % 60;
      cctx.fillStyle = "rgba(20,26,52,0.9)";
      for (let i = -1; i < cw / 60 + 1; i++) {
        const x = i * 60 - skl;
        const h = 18 + ((i * 37) % 5) * 6;
        cctx.fillRect(x, g.top - h - 6, 44, h);
      }
      cctx.fillStyle = "rgba(40,46,78,0.95)";
      const tx = cw * 0.62 - (S.camL * 110 % cw);
      cctx.fillRect(tx, g.top - 64, 26, 64);
      cctx.fillStyle = "rgba(255,240,200,0.85)";
      cctx.beginPath(); cctx.arc(tx + 13, g.top - 50, 7, 0, Math.PI * 2); cctx.fill();
      cctx.fillStyle = "#181d33";
      cctx.fillRect(0, g.top - 6, cw, 10);
      const crowdScroll = (S.camL * 560) % 14;
      for (let x = -crowdScroll; x < cw; x += 14) {
        cctx.fillStyle = ["#3a4474", "#46406e", "#523b5e", "#3e4a6b"][(Math.floor(x) % 4 + 4) % 4];
        cctx.beginPath(); cctx.arc(x, g.top - 2, 3, 0, Math.PI * 2); cctx.fill();
      }
    }

    // back-rail bunting — a string of pennant flags whipping past just above the far
    // rail, on EVERY course. Scrolls with the camera (much faster than the distant
    // backdrop) so "the flags in back" clearly convey speed. Each flag's colour is
    // keyed to its world index (not the frame), so colours never flicker — seamless.
    // Stops naturally when the camera stops (start gate / after finish).
    {
      const pGap = 30, pScroll = S.camL * SREF * 0.9;   // ~ground rate (slight parallax) → moves WITH the scene
      const pcols = ["#ff6b8a", "#ffd34d", "#5ad1ff", "#9b8cff", "#7CFFB2"];
      const nC = pcols.length, first = Math.floor(pScroll / pGap), railY = g.top - 8;
      cctx.strokeStyle = "rgba(255,255,255,0.22)"; cctx.lineWidth = 1;
      cctx.beginPath(); cctx.moveTo(0, railY); cctx.lineTo(cw, railY); cctx.stroke();
      cctx.globalAlpha = 0.85;
      for (let k = 0; k * pGap <= cw + pGap; k++) {
        const wi = first + k, x = wi * pGap - pScroll;
        cctx.fillStyle = pcols[((wi % nC) + nC) % nC];
        cctx.beginPath();
        cctx.moveTo(x, railY); cctx.lineTo(x + 11, railY); cctx.lineTo(x + 5.5, railY + 8); cctx.closePath();
        cctx.fill();
      }
      cctx.globalAlpha = 1;
    }

    // ============ WORLD GROUP (dynamic camera: zoom + pan + shake) ============
    const fx = clamp(screenX(leaderP, WINW), cw * 0.2, cw * 0.8);
    const fy = (g.top + g.bottom) / 2;
    cctx.save();
    cctx.translate(fx, fy); cctx.scale(S.zoom, S.zoom); cctx.rotate(S.tilt); cctx.translate(-fx, -fy);
    cctx.translate(S.shakeX, S.camY + S.shakeY);

    // --- track ground (themed turf, apron below to survive pan/zoom) ---
    const grd = cctx.createLinearGradient(0, g.top, 0, g.bottom);
    grd.addColorStop(0,   rcMix(tb.a.ground[0], tb.b.ground[0], tb.t));
    grd.addColorStop(0.5, rcMix(tb.a.ground[1], tb.b.ground[1], tb.t));
    grd.addColorStop(1,   rcMix(tb.a.ground[2], tb.b.ground[2], tb.t));
    cctx.fillStyle = grd;
    cctx.fillRect(-20, g.top, cw + 40, (ch - g.top) + 26);   // overscan covers camera tilt/pan
    // groomed turf: alternating two-tone mow bands + a soft depth grade (darker far,
    // a touch lifted near) give the lawn real dimension without adding clutter.
    for (let i = 0; i < 8; i++) {
      cctx.fillStyle = (i % 2 === 0) ? "rgba(255,255,255,0.030)" : "rgba(0,26,12,0.06)";
      cctx.fillRect(0, g.top + i * g.laneH, cw, g.laneH + 0.5);
    }
    {
      const ts = cctx.createLinearGradient(0, g.top, 0, g.bottom);
      ts.addColorStop(0,   "rgba(0,0,0,0.16)");
      ts.addColorStop(0.4, "rgba(0,0,0,0)");
      ts.addColorStop(1,   "rgba(255,255,255,0.045)");
      cctx.fillStyle = ts; cctx.fillRect(0, g.top, cw, g.bottom - g.top);
    }
    // theme surface treatment (fog veil / lava cracks / bridge planks)
    drawGroundOverlay(tb.keyA, g, WINW);

    // lane stripes
    cctx.strokeStyle = "rgba(255,255,255,0.06)";
    cctx.lineWidth = 1;
    const _cy = g.top + (g.bottom - g.top) * 0.5;
    for (let i = 1; i < 8; i++) {
      const baseY = g.top + i * g.laneH;
      cctx.beginPath();
      let first = true;
      for (let P = S.camL - 0.04; P <= S.camL + WINW + 0.04; P += 0.02) {
        const ly = baseY + (_cy - baseY) * convAtP(P);
        const lx = screenX(P, WINW);
        if (first) { cctx.moveTo(lx, ly); first = false; } else cctx.lineTo(lx, ly);
      }
      cctx.stroke();
    }
    // scrolling distance gridlines — subtle structure (the streaks carry the speed),
    // with a slightly brighter line each furlong (0.1) for a sense of measured ground.
    const firstTick = Math.ceil(S.camL / 0.025) * 0.025;
    for (let P = firstTick; P < S.camL + WINW + 0.05; P += 0.025) {
      const x = screenX(P, WINW);
      const furlong = Math.abs((P / 0.1) - Math.round(P / 0.1)) < 0.002;
      cctx.fillStyle = furlong ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)";
      cctx.fillRect(x - (furlong ? 1 : 0.5), g.top, furlong ? 2 : 1, g.bottom - g.top);
    }
    // fast ground speed-streaks — screen-space motion blur scrolling well faster
    // than the world, so a long course really reads as a high-speed run. Drawn ONLY
    // while the field is actually running — not during the start countdown (dragons
    // frozen at the gate) nor after the finish (would freeze into a static grid).
    if (S.preT <= 0 && !S.finished) {
      // Two layers of horizontal motion-blur streaks at different speeds/lengths.
      // The near (lower) lanes get longer, brighter, faster streaks so the running
      // surface really tears past the screen — this is the dominant speed cue.
      for (let li = 0; li < 8; li++) {
        const depth = li / 7;                 // 0 = far/top, 1 = near/bottom
        const sy = g.top + (li + 0.5) * g.laneH;
        const len = 40 + depth * 56;          // near streaks much longer
        const gap = 38 + depth * 16;          // denser → more streaks tear past
        const mul = 1.2 + depth * 0.55;       // near streaks blur a touch faster than the ground
        const h = depth > 0.6 ? 3 : 2;        // near streaks thicker
        const a = (0.14 + depth * 0.16).toFixed(3);
        cctx.fillStyle = "rgba(255,255,255," + a + ")";
        // scroll keyed to the REAL ground rate (× small blur factor) so streaks read
        // as motion blur ON the track — not objects flying past on another plane.
        const off = (S.camL * SREF * mul + li * 23) % gap;
        for (let sx = -off; sx < cw; sx += gap) {
          cctx.fillRect(sx, sy - 1, len, h);
        }
      }
    }
    // --- running rails: a crisp white far-side rail with a soft shadow beneath it,
    // plus a soft near-edge shadow that grounds the field on the turf (premium depth). ---
    cctx.fillStyle = "rgba(0,0,0,0.16)";
    cctx.fillRect(0, g.top + 2.5, cw, 3);                                                          // shadow under the far rail
    cctx.strokeStyle = "rgba(244,248,255,0.72)"; cctx.lineWidth = 2.5;
    cctx.beginPath(); cctx.moveTo(0, g.top + 1.5); cctx.lineTo(cw, g.top + 1.5); cctx.stroke();    // far rail (white)
    const nearSh = cctx.createLinearGradient(0, g.bottom - 16, 0, g.bottom);
    nearSh.addColorStop(0, "rgba(0,0,0,0)"); nearSh.addColorStop(1, "rgba(0,0,0,0.22)");
    cctx.fillStyle = nearSh; cctx.fillRect(0, g.bottom - 16, cw, 16);                               // near-edge shadow
    cctx.strokeStyle = "rgba(220,230,245,0.28)"; cctx.lineWidth = 1.5;
    cctx.beginPath(); cctx.moveTo(0, g.bottom - 1); cctx.lineTo(cw, g.bottom - 1); cctx.stroke();   // near rail (subtle)

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

    // --- leader golden speed trail (world space, behind the field) ---
    if (cam.leaderId && !S.finished && S.preT <= 0) {
      const lp = timeline.progressAt(cam.leaderId, S.tau);
      const lv = timeline.speedAt(cam.leaderId, S.tau);
      if (lv > 0.9 && lp < 1) {
        const ldr = timeline.byId[cam.leaderId];
        const ly = laneY(ldr, g);
        const lx = clamp(screenX(lp, WINW), cw * 0.05, cw * 0.97);
        const len = 36 + (lv - 0.9) * 95;
        const tg = cctx.createLinearGradient(lx - len, ly, lx, ly);
        tg.addColorStop(0, "rgba(255,224,106,0)");
        tg.addColorStop(1, "rgba(255,224,106,0.45)");
        cctx.fillStyle = tg;
        cctx.beginPath();
        cctx.moveTo(lx, ly - 7); cctx.lineTo(lx - len, ly - 2);
        cctx.lineTo(lx - len, ly + 2); cctx.lineTo(lx, ly + 7);
        cctx.closePath(); cctx.fill();
      }
    }

    // --- world-space particles (foot-dust + ambient embers/gusts/leaves) drawn
    // BEFORE the dragons, so kicked-up dust sits behind the field and never paints
    // over a rival in front. (Confetti/fireworks are screen-space, drawn after.) ---
    for (const p of S.particles) {
      if (p.scr) continue;
      const a = clamp(p.life, 0, 1);
      if (p.kind === "dust") {
        cctx.fillStyle = `rgba(184,174,154,${0.42 * a})`;
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

    // --- dragons (draw far lanes first for overlap) ---
    const standings = timeline.standingsAt(S.tau);
    const standMap = {}; standings.forEach((id, i) => { standMap[id] = i + 1; });

    const drawList = [...dragons].sort((a, b) => laneOf[b.id] - laneOf[a.id]);
    for (const dr of drawList) {
      const P = timeline.progressAt(dr.id, S.tau);
      const Pvis = visProgress(dr.id);          // extends past 1 during the run-out
      const v = timeline.speedAt(dr.id, S.tau);
      const intensity = clamp((v - 0.85) / 0.55, 0, 1.4);   // FULL effort kept through the run-out (it's slow-mo, not tired)
      const ownU = Math.min(1, S.tau / dr.finishTau);

      let x = screenX(Pvis, WINW);
      const baseY = laneY(dr, g);
      const bob = Math.sin(S.gait[dr.id]) * (1.6 + intensity);
      const y = baseY + bob;

      const offLeft = x < cw * 0.04;
      const drawX = clamp(x, cw * 0.05, cw * 0.97);

      // Backmarkers that fall behind the lead-pack focus dissolve off the left
      // edge — reinforces the "field thins to three" read. Tied to focusT so the
      // whole field stays solid early; only late does the dropped tail fade out.
      const _ef = clamp((x + cw * 0.02) / (cw * 0.26), 0, 1);
      let edgeFade = 1 - (1 - _ef) * (S._focusT || 0);
      // At the finish, dim everything OUTSIDE the lead trio so the centre battle
      // reads cleanly even when the field bunches up (rank-based, ramps with focusT).
      const _K = timeline.leadPackSize || 3;
      if ((standMap[dr.id] || 9) > _K) edgeFade *= (1 - 0.92 * (S._finishFade || 0));
      // the player must ALWAYS be able to watch their own pick — never fade it out,
      // even when it trails the lead trio (it just sits at the edge of frame).
      if (betSet.has(dr.id)) edgeFade = Math.max(edgeFade, 0.88);
      if (edgeFade <= 0.04) continue;             // fully behind → off-screen, skip
      const _prevAlpha = cctx.globalAlpha;
      cctx.globalAlpha = edgeFade;

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

      // speed lines behind — longer & denser the faster it runs (sense of pace)
      if (intensity > 0.3 && !down) {
        cctx.strokeStyle = rcRgba(dr.color, 0.2 + 0.16 * intensity);
        cctx.lineWidth = 1.5;
        for (let l = 0; l < 5; l++) {
          const ly = y - 9 + l * 4.5;
          cctx.beginPath();
          cctx.moveTo(drawX - 14 - l * 3, ly);
          cctx.lineTo(drawX - 30 - intensity * 34 - l * 7, ly);
          cctx.stroke();
        }
      }

      // dust at feet (scale with speed) — kicked up harder the faster it runs
      if (!down && intensity > 0.3 && Math.random() < (S.crossClock[dr.id] != null ? 0.2 : 0.6)) spawnDust(drawX, baseY + 14, intensity > 0.8 ? 2 : 1, intensity);
      if (surging && Math.random() < 0.5) spawnSpark(drawX, y - 4, dr.color);

      // gait advance handled in update(); draw sprite (depth-scaled). Sized so
      // the whole field reads cleanly at the start without crowding/overlap.
      const dep = laneDepth(dr);
      const sprScale = 0.66 * dep;
      // soft contact shadow grounds the dragon on the turf
      cctx.fillStyle = "rgba(0,0,0,0.18)";
      cctx.beginPath();
      cctx.ellipse(drawX, baseY + 8 * dep, 8 * dep, 2.2 * dep, 0, 0, Math.PI * 2);
      cctx.fill();
      // pick spotlight — a soft, pulsing halo so the eye always tracks your dragon
      if (betSet.has(dr.id) && !finishedNow) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
        const rg = cctx.createRadialGradient(drawX, y - 4, 3, drawX, y - 4, 25 * dep);
        rg.addColorStop(0, `rgba(255,211,77,${0.2 + 0.13 * pulse})`);
        rg.addColorStop(1, "rgba(255,211,77,0)");
        cctx.fillStyle = rg;
        cctx.beginPath(); cctx.arc(drawX, y - 4, 25 * dep, 0, Math.PI * 2); cctx.fill();
      }
      // terrain shapes body language: bank into turns, spread wings on wind lanes
      const tkey = themeKeyAtP(P);
      const bank = tkey === "turn" ? clamp(0.42 + intensity * 0.45, 0, 1.05) : 0;
      const spread = tkey === "wind" ? clamp(0.45 + intensity * 0.4, 0, 1) : 0;
      rcDrawDragon(cctx, {
        x: drawX, y: y, scale: sprScale,
        color: dr.color, style: dr.style, design: dragonDesign(dr.id),
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
      cctx.globalAlpha = _prevAlpha;             // end per-dragon edge fade
    }

    // (world-space dust / ambient particles are drawn BEFORE the dragon loop now,
    // so foot-dust sits behind the field and never paints over other dragons.)

    cctx.restore();   // ============ end WORLD GROUP ============

    // --- terrain colour wash: a subtle full-scene grade so each course's mood
    // (volcanic red / misty grey / windy blue) is felt even at a glance ---
    const washA = rcTerrainInfo(tb.keyA).tint;
    if (washA) { cctx.fillStyle = washA; cctx.fillRect(0, 0, cw, ch); }
    if (tb.keyB !== tb.keyA) {
      const washB = rcTerrainInfo(tb.keyB).tint;
      if (washB) { cctx.save(); cctx.globalAlpha = tb.t; cctx.fillStyle = washB; cctx.fillRect(0, 0, cw, ch); cctx.restore(); }
    }

    // --- final-straight drama vignette (darkens the corners, pulls the eye in) ---
    const finishProx = clamp((leaderP - 0.72) / 0.28, 0, 1);
    const vig = Math.max(finishProx * 0.9, S.finished ? 0.55 : 0);
    if (vig > 0.02) {
      const rg = cctx.createRadialGradient(cw / 2, ch * 0.56, ch * 0.30, cw / 2, ch * 0.56, ch * 0.92);
      rg.addColorStop(0, "rgba(0,0,0,0)");
      rg.addColorStop(1, `rgba(6,6,16,${0.6 * vig})`);
      cctx.fillStyle = rg; cctx.fillRect(0, 0, cw, ch);
    }

    // --- live position minimap (all dragons at a glance) ---
    drawMinimap();

    // --- finish dim (so confetti & banner pop) ---
    if (S.finished) { cctx.fillStyle = "rgba(8,10,20,0.32)"; cctx.fillRect(0, 0, cw, ch); }

    // --- screen-space FX: confetti ribbons + firework sparks ---
    for (const p of S.particles) {
      if (!p.scr) continue;
      const a = clamp(p.life, 0, 1);
      if (p.kind === "confetti") {
        cctx.save();
        cctx.translate(p.x, p.y); cctx.rotate(p.rot || 0);
        cctx.globalAlpha = a; cctx.fillStyle = p.color;
        cctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
        cctx.restore();
      } else {
        cctx.globalAlpha = a; cctx.fillStyle = p.color || "#ffe9a8";
        cctx.beginPath(); cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); cctx.fill();
      }
    }
    cctx.globalAlpha = 1;

    // --- floating texts (screen space) ---
    cctx.textAlign = "center";
    for (const f of S.floats) {
      cctx.globalAlpha = clamp(f.life, 0, 1);
      cctx.lineWidth = 3; cctx.strokeStyle = "rgba(8,10,20,0.8)";
      cctx.font = (f.big ? "bold 20px" : "bold 13px") + " system-ui, sans-serif";
      cctx.strokeText(f.text, f.x, f.y);
      cctx.fillStyle = f.color;
      cctx.fillText(f.text, f.x, f.y);
    }
    cctx.globalAlpha = 1;

    // --- start 3-2-1 countdown / GO burst ---
    if (S.preT > 0) {
      const n = Math.min(3, Math.max(1, Math.ceil(S.preT)));
      const frac = S.preT - Math.floor(S.preT);     // ~1 right after a tick → 0 before next
      const pulse = 0.7 + frac * 0.75;
      cctx.save();
      cctx.globalAlpha = clamp(0.2 + frac, 0, 1);
      cctx.translate(cw / 2, ch * 0.40); cctx.scale(pulse, pulse);
      cctx.font = "bold 66px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.lineWidth = 6; cctx.strokeStyle = "rgba(10,12,24,0.7)";
      cctx.fillStyle = "#fff";
      cctx.strokeText(String(n), 0, 0); cctx.fillText(String(n), 0, 0);
      cctx.restore();
      cctx.globalAlpha = 0.85; cctx.fillStyle = "#ffe9a8";
      cctx.font = "bold 13px system-ui, sans-serif"; cctx.textAlign = "center";
      cctx.fillText("位置について…", cw / 2, ch * 0.40 + 54);
      cctx.globalAlpha = 1;
    } else if (S.goFlash > 0) {
      const k = clamp(S.goFlash / 0.8, 0, 1);
      cctx.save();
      cctx.globalAlpha = k;
      cctx.translate(cw / 2, ch * 0.40); cctx.scale(1 + (1 - k) * 0.9, 1 + (1 - k) * 0.9);
      cctx.font = "bold 72px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.lineWidth = 6; cctx.strokeStyle = "rgba(120,60,0,0.55)";
      cctx.fillStyle = "#ffe06a";
      cctx.strokeText("GO！", 0, 0); cctx.fillText("GO！", 0, 0);
      cctx.restore(); cctx.globalAlpha = 1;
    }

    // --- phase-entry banner (slides in from the side, holds, slides out) ---
    // --- terrain sign: a centred plate that names the course feature on entry ---
    if (S.terrainSign && !S.finished && S.preT <= 0) {
      const ts = S.terrainSign;
      const appear = clamp(ts.t / 0.28, 0, 1);
      const a = Math.min(appear, clamp((ts.max - ts.t) / 0.5, 0, 1));
      const scale = 0.84 + 0.16 * appear;
      const accent = (RC_THEME[ts.key] || RC_THEME.straight).accent;
      const cx = cw / 2, cy = ch * 0.49;
      cctx.save();
      cctx.globalAlpha = clamp(a, 0, 1);
      cctx.translate(cx, cy); cctx.scale(scale, scale); cctx.translate(-cx, -cy);
      cctx.font = "bold 23px system-ui, sans-serif";
      const tw = cctx.measureText(ts.label).width;
      const iconW = 44, padX = 22, h = 48, w = iconW + tw + padX * 2;
      const x0 = cx - w / 2, y0 = cy - h / 2;
      cctx.fillStyle = "rgba(12,12,24,0.9)"; cctx.fillRect(x0, y0, w, h);
      cctx.fillStyle = accent;
      cctx.fillRect(x0, y0, 5, h);                                   // accent spine
      cctx.fillRect(x0, y0, w, 2); cctx.fillRect(x0, y0 + h - 2, w, 2);
      cctx.textBaseline = "middle";
      cctx.font = "26px system-ui, sans-serif"; cctx.textAlign = "center";
      cctx.fillText(ts.icon, x0 + padX + 12, cy + 1);                // terrain icon
      cctx.textAlign = "left"; cctx.fillStyle = "#fff"; cctx.font = "bold 23px system-ui, sans-serif";
      cctx.fillText(ts.label, x0 + iconW + padX, cy + 1);            // section label
      cctx.restore(); cctx.globalAlpha = 1;
    }

    if (S.banner && !S.finished && S.preT <= 0) {
      const b = S.banner, u = clamp(b.t / b.max, 0, 1);
      const fade = u < 0.16 ? u / 0.16 : (u > 0.74 ? (1 - u) / 0.26 : 1);
      const slideIn = (1 - Math.min(1, u / 0.16)) * 46;
      const slideOut = u > 0.74 ? ((u - 0.74) / 0.26) * 34 : 0;
      const sx = slideIn - slideOut;
      const by = ch * 0.17;
      cctx.save();
      cctx.globalAlpha = clamp(fade, 0, 1);
      cctx.fillStyle = "rgba(12,14,28,0.46)";
      cctx.fillRect(0, by - 23, cw, 46);
      cctx.fillStyle = "rgba(255,224,106,0.92)";
      cctx.fillRect(0, by - 23, cw, 3);
      cctx.fillRect(0, by + 20, cw, 3);
      cctx.font = "bold 30px system-ui, sans-serif";
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.lineWidth = 5; cctx.strokeStyle = "rgba(8,10,22,0.7)";
      cctx.fillStyle = "#fff";
      cctx.strokeText(b.text, cw / 2 + sx, by);
      cctx.fillText(b.text, cw / 2 + sx, by);
      cctx.restore(); cctx.globalAlpha = 1;
    }

    // --- finish celebration banner ---
    if (S.finished) {
      const winner = timeline.crossings[0];
      cctx.textAlign = "center"; cctx.textBaseline = "middle";
      cctx.fillStyle = "#ffe9a8"; cctx.font = "bold 27px system-ui, sans-serif";
      cctx.fillText("ゴールイン！", cw / 2, ch * 0.22);
      cctx.fillStyle = "#fff"; cctx.font = "bold 17px system-ui, sans-serif";
      cctx.fillText("1着  " + commentaryName(winner.id), cw / 2, ch * 0.22 + 28);
      const hit = computeBetHit();
      if (hit === true) {
        cctx.fillStyle = "#8df0a6"; cctx.font = "bold 23px system-ui, sans-serif";
        cctx.fillText("🎯 的中！", cw / 2, ch * 0.22 + 60);
      } else if (hit === false) {
        cctx.fillStyle = "#ff9a8a"; cctx.font = "bold 15px system-ui, sans-serif";
        cctx.fillText("残念…次こそ！", cw / 2, ch * 0.22 + 58);
      }
    }

    // HUD updates
    phaseEl.textContent = ["序盤", "中盤", "展開", "終盤", "ゴール前"][timeline.phaseIndexAt(S.tau)] || "";
    const _hudKey = themeKeyAtP(leaderP);
    sectionEl.textContent = rcTerrainInfo(_hudKey).icon + " " + sectionLabelAtP(leaderP);
    sectionEl.style.borderLeftColor = (RC_THEME[_hudKey] || RC_THEME.straight).accent;
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
    // run-out slow-MOTION: once the winner crosses, dilate time so the finish reads as
    // a cinematic slow-mo gallop-through with FULL stride & effort — not the dragons
    // tiring. Applied uniformly to gait / particles / coast / τ so nothing desyncs.
    const _winId = timeline.crossings.length ? timeline.crossings[0].id : null;
    const inRunout = _winId != null && S.crossClock[_winId] != null;
    const smo = inRunout ? RUNOUT_SMO : 1;
    const sdt = dt * smo;

    // gait clocks advance with each dragon's speed (slowed in slow-mo, but FULL stride —
    // never a tired cadence drop)
    for (const dr of dragons) {
      const v = timeline.speedAt(dr.id, S.tau);
      const rate = (v < 0.2) ? 3 : 9 + v * 6;
      S.gait[dr.id] += sdt * rate;
    }
    // particles — world FX run on slow-mo time so dust hangs during the run-out;
    // screen-space confetti keeps real time
    for (const p of S.particles) {
      const pdt = p.scr ? dt : sdt;
      p.x += p.vx * pdt; p.y += p.vy * pdt;
      if (p.kind === "confetti") {
        p.vy += 26 * dt;                       // gentle fall
        p.vx += Math.sin((p.rot || 0) * 2) * 18 * dt; // flutter sway
        p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      } else if (!p.amb) { p.vy += 60 * pdt; }
      else if (p.kind === "ember") { p.vy -= 9 * pdt; }
      p.life -= pdt / p.max;
    }
    S.particles = S.particles.filter(p => p.life > 0);
    // floats
    for (const f of S.floats) { f.y += f.vy * dt; f.life -= dt * 0.7; }
    S.floats = S.floats.filter(f => f.life > 0);
    if (S.countdown > 0) S.countdown -= dt * 1.3;
    // screen-shake impulse decays
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 14);
    // "GO！" flash + overtake push-in impulse fade
    if (S.goFlash > 0) S.goFlash = Math.max(0, S.goFlash - dt);
    if (S.zoomBump > 0) S.zoomBump = Math.max(0, S.zoomBump - dt * 0.22);
    // phase-entry banner ages out (animates even while paused so it can clear)
    if (S.banner) { S.banner.t += dt; if (S.banner.t >= S.banner.max) S.banner = null; }
    if (S.terrainSign) { S.terrainSign.t += dt; if (S.terrainSign.t >= S.terrainSign.max) S.terrainSign = null; }
    // keep sprinkling celebration confetti for a beat after the finish
    if (S.finished && S.confettiT > 0) {
      S.confettiT -= dt;
      if (Math.random() < 0.45) spawnConfetti(3);
    }

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

    // --- pre-start 3-2-1 countdown: hold τ at the gate, then fire GO ---
    if (S.preT > 0) {
      S.preT -= dt * S.speed;
      if (S.preT <= 0) {
        S.preT = 0;
        S.goFlash = 0.85;
        S.shake = Math.max(S.shake, 4);
        spawnSpark(cw / 2, ch * 0.40, "#ffe06a");
      }
      return;   // the field stays on the line until "GO！"
    }

    // --- run-through / pull-up: once the winner crosses, advance the global run-out
    // timer and every crossed dragon's coast clock (visProgress reads these to carry
    // them on past the wire). Cut to the result once the lead group has galloped on —
    // we don't wait for the tail-enders. Presentation only; order is already fixed. ---
    for (const dr of dragons) if (S.crossClock[dr.id] != null) S.crossClock[dr.id] += sdt * S.speed;
    if (_winId != null && S.crossClock[_winId] != null && S.crossClock[_winId] >= RUNOUT_DUR && !S.finishedAnnounced) {
      onAllFinished(); return;   // cut to the result once the winner has fully run out (slow-mo)
    }

    const prevTau = S.tau;
    // advance τ — but ease into slow-motion at the wire on a photo / close finish
    // (pure animation pacing; the finishing order is fixed by the timeline)
    let adv = dt * S.speed / timeline.durationSecHint;
    // Ease into slow-motion as the lead trio hits the wire. Anchored to the
    // leader's crossing (not a fixed τ) so the dead-heat always plays out in
    // slow-mo regardless of where the winner crosses. Pure pacing — order fixed.
    const wireTau = (timeline.crossings && timeline.crossings.length) ? timeline.crossings[0].tau : 0.9;
    const smoStart = wireTau - 0.06;
    if (S.tapeBroken) {
      adv *= smo;   // KEEP the slow-motion running through the run-out (trailers cross in slow-mo too)
    } else if (S.tau > smoStart) {
      const k = clamp((S.tau - smoStart) / Math.max(0.0001, wireTau - smoStart), 0, 1);
      const depth = (timeline.photoFinish || timeline.closeFinish) ? 0.72 : 0.5;
      adv *= (1 - depth * k);   // dramatic slow-mo INTO the winner's crossing
    }
    S.tau = Math.min(1, S.tau + adv);

    // --- phase-entry banner: a sweeping caption as the field rolls into a new
    // act of the race (presentation only; cued off the shared race clock) ---
    const phNow = timeline.phaseIndexAt(S.tau);
    if (phNow !== S.phaseShown) {
      S.phaseShown = phNow;
      const lbl = RC_PHASE_BANNERS[phNow];
      if (lbl && S.preT <= 0 && !S.finished) {
        S.banner = { text: lbl, t: 0, max: 1.9 };
        S.zoomBump = Math.min(0.2, (S.zoomBump || 0) + 0.07);
        if (phNow >= 3) S.shake = Math.max(S.shake, 2.5);
      }
    }

    // --- terrain sign: NAME the course feature as the leader rolls into each
    // third (early/mid/late) — tells the watcher outright "ここは 旋回 / 火山" ---
    const leadPnow = timeline.leaderProgressAt(S.tau);
    const third = leadPnow < 1 / 3 ? 0 : leadPnow < 2 / 3 ? 1 : 2;
    if (third !== S.sectionShown && S.preT <= 0 && !S.finished) {
      S.sectionShown = third;
      const tkey = themeKeyAtP(leadPnow), info = rcTerrainInfo(tkey), label = sectionLabelAtP(leadPnow);
      if (label) {
        S.terrainSign = { icon: info.icon, label: label, key: tkey, t: 0, max: 2.6 };
        if (info.turn) S.shake = Math.max(S.shake, 1.6);
      }
    }

    // detect crossings between prevTau and S.tau
    for (const cr of timeline.crossings) {
      if (!S.crossedSet.has(cr.id) && S.tau >= cr.tau) {
        S.crossedSet.add(cr.id);
        S.crossClock[cr.id] = 0;                                   // begin this dragon's run-through
        S.crossV[cr.id] = Math.max(0.6, timeline.speedAt(cr.id, S.tau));
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

    // --- overtake & close-battle drama (presentation only; order is fixed) ---
    const standNow = timeline.standingsAt(S.tau);
    if (S.overT > 0) S.overT -= dt;
    if (S.prevStand && S.overT <= 0 && S.tau > 0.08 && S.tau < 0.99) {
      for (let i = 0; i < standNow.length; i++) {
        const id = standNow[i], place = i + 1, prevPlace = S.prevStand[id];
        if (prevPlace && place < prevPlace && place <= 4) {
          const dr = timeline.byId[id], gp = trackGeom();
          const xx = screenX(timeline.progressAt(id, S.tau), S._winw || 0.3);
          const yy = laneY(dr, gp) - 20, jump = prevPlace - place, isPick = betSet.has(id);
          const txt = (place === 1) ? "先頭に立った！" : (jump >= 2 ? "ごぼう抜き！" : "かわした！");
          addFloat(xx, yy, txt, isPick ? "#ffd34d" : "#aef2b0", place === 1 || jump >= 2);
          S.overT = 0.5;
          S.zoomBump = Math.min(0.16, (S.zoomBump || 0) + (place === 1 ? 0.12 : 0.08));
          if (place === 1) S.shake = Math.max(S.shake, 2);
          break;   // one callout per beat
        }
      }
    }
    S.prevStand = {}; standNow.forEach((id, i) => { S.prevStand[id] = i + 1; });

    // close battle "接戦！" when the lead pair runs nose-to-nose on the run-in
    if (S.battleT > 0) S.battleT -= dt;
    if (standNow.length >= 2 && S.tau > 0.5 && S.tau < 0.985 && S.battleT <= 0) {
      const gapTop = timeline.progressAt(standNow[0], S.tau) - timeline.progressAt(standNow[1], S.tau);
      if (gapTop < 0.012) {
        addFloat(cw / 2, ch * 0.30, "接戦！", "#ffffff", true);
        S.battleT = 1.8;
        S.zoomBump = Math.min(0.18, (S.zoomBump || 0) + 0.06);
      }
    }

    // --- "三つ巴！" — the field has thinned and the lead trio is fighting it out
    // nose-to-nose into the wire (fires once at the climax; presentation only) ---
    if (!S.trioShown && (S._focusT || 0) > 0.7 && S.tau < 0.99 && standNow.length >= 4) {
      const p1 = timeline.progressAt(standNow[0], S.tau);
      const p3 = timeline.progressAt(standNow[2], S.tau);
      const p4 = timeline.progressAt(standNow[3], S.tau);
      // top-3 bunched AND clearly broken away from 4th → a genuine three-horse duel
      if ((p1 - p3) < 0.055 && (p3 - p4) > 0.02) {
        S.trioShown = true;
        S.banner = { text: "三つ巴！", t: 0, max: 2.1 };
        addFloat(cw / 2, ch * 0.30, "３頭、横一線！", "#ffe06a", true);
        S.shake = Math.max(S.shake, 4);
        S.zoomBump = Math.min(0.24, (S.zoomBump || 0) + 0.13);
      }
    }

    // --- cheer for the player's pick (situation-aware encouragement) ---
    if (S.cheerT > 0) S.cheerT -= dt;
    if (pickId && S.cheerT <= 0 && S.tau > 0.12 && S.tau < 0.97) {
      const dr = timeline.byId[pickId];
      if (dr) {
        const cheerPick = a => a[(Math.random() * a.length) | 0];
        const place = standNow.indexOf(pickId) + 1;
        const myP = timeline.progressAt(pickId, S.tau);
        const gap = timeline.leaderProgressAt(S.tau) - myP;
        let msg;
        if (place === 1) msg = cheerPick(["そのまま！", "逃げ切れ！", "行け行け！"]);
        else if (gap < 0.02) msg = cheerPick(["差せ！", "前へ！", "あと少し！"]);
        else if (gap < 0.06) msg = cheerPick(["がんばれ！", "食らいつけ！", "まだいける！"]);
        else msg = cheerPick(["あきらめないで！", "ここから！", "盛り返せ！"]);
        const gp = trackGeom();
        addFloat(screenX(myP, S._winw || 0.3), laneY(dr, gp) - 24, msg, "#ffd34d", false);
        S.cheerT = 2.4 + Math.random() * 1.3;
      }
    }

    pumpTelop();

    // safety net only: the run-out block ends the race after the winner crosses.
    // This catches the degenerate case where no winner-crossing was ever detected.
    if (S.tau >= 1 && !S.tapeBroken && !S.finishedAnnounced) onAllFinished();
  }

  function onAllFinished() {
    S.finished = true;
    S.finishedAnnounced = true;
    S.shake = Math.max(S.shake, 4);
    // celebration! confetti rain + a triple firework over the winner's line
    if (!S.celebrated) {
      S.celebrated = true;
      S.confettiT = 1.5;
      spawnConfetti(90);
      spawnFirework(cw * 0.50, ch * 0.32, "#ffe06a");
      spawnFirework(cw * 0.30, ch * 0.42, "#ff7aa0");
      spawnFirework(cw * 0.70, ch * 0.42, "#7fd1ff");
      // an extra pop when the player's bet lands
      if (computeBetHit() === true) {
        spawnConfetti(60);
        spawnFirework(cw * 0.50, ch * 0.50, "#8df0a6");
      }
    }
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
      // segmented speed control — tap a rate directly (clearer than cycling),
      // so 2× / 3× fast-forward is one obvious tap away.
      const grp = el("div", "rc-speedgrp");
      grp.appendChild(el("span", "rc-ctl-label", "速度"));
      const seg = el("div", "rc-speedseg");
      [1, 2, 3].forEach(v => {
        const b = el("button", "rc-spd" + (S.speed === v ? " on" : ""), v + "×");
        b.onclick = () => { S.speed = v; renderControls(); };
        seg.appendChild(b);
      });
      grp.appendChild(seg);
      controlsEl.appendChild(grp);
      // prominent skip — jump straight to the result whenever the player wants
      const skip = makeBtn("⏭ スキップ", () => { stopRacePlayer(); if (typeof renderResult === "function") renderResult(); }, { secondary: true });
      skip.classList.add("rc-skip");
      controlsEl.appendChild(skip);
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
      // skip the start ceremony when scrubbing; re-baseline standings so resuming
      // play doesn't fire a phantom overtake callout on the first frame
      S.preT = 0; S.goFlash = 0; S.prevStand = null;
      S.tau = Math.max(0, Math.min(1, t));
      // don't replay a phase banner from a scrub; re-baseline the phase marker
      S.banner = null; S.phaseShown = timeline.phaseIndexAt(S.tau);
      // Rebuild all presentation/ceremony state from the target time so that
      // scrubbing — including *backward* from a finished race — shows a faithful
      // frame (no stuck finish overlay) and replays callouts cleanly. Order is
      // fixed by the timeline; this only touches visuals.
      S.floats = [];
      S.overT = 0;
      S.crossedSet = new Set(timeline.crossings.filter(c => S.tau >= c.tau).map(c => c.id));
      const _winCross = timeline.crossings.find(c => c.place === 1);
      S.tapeBroken = !!(_winCross && S.tau >= _winCross.tau);
      // run-through state, reconstructed from the scrubbed time: each crossed dragon
      // has been coasting past the wire since its OWN crossing (presentation only).
      S.crossClock = {}; S.crossV = {};
      for (const cr of timeline.crossings) {
        if (S.tau >= cr.tau) {
          S.crossClock[cr.id] = clamp((S.tau - cr.tau) * timeline.durationSecHint, 0, RUNOUT_DUR);
          S.crossV[cr.id] = Math.max(0.6, timeline.speedAt(cr.id, cr.tau));
        }
      }
      const _wid = _winCross ? _winCross.id : null;
      const _done = S.tau >= 1 || (_wid != null && S.crossClock[_wid] != null && S.crossClock[_wid] >= RUNOUT_DUR);
      S.finished = _done; S.finishedAnnounced = _done; S.celebrated = _done; S.confettiT = 0;
      S.trioShown = false;   // re-arm the "三つ巴！" callout for a forward replay
      S.terrainSign = null;  // baseline the terrain sign to the scrubbed-to section
      { const _lp = timeline.leaderProgressAt(S.tau); S.sectionShown = _lp < 1 / 3 ? 0 : _lp < 2 / 3 ? 1 : 2; }
      // re-arm per-dragon stumble/surge shouts so already-passed ones stay quiet
      // and still-upcoming ones can fire again on a forward replay
      for (const dr of dragons) {
        const ownU = dr.finishTau ? Math.min(1, S.tau / dr.finishTau) : 1;
        for (const ev of dr.events) ev._shouted = ownU >= ev.u;
      }
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
