// =====================================================================
// L2_PLY — idle-only "Live2D-like" player. Given a hydrated rig, it runs a
// procedural idle: breathing, blink, wing flutter, head bob/tilt, hair/tail
// sway with soft-bend strips, slow drift, and optional cursor gaze parallax.
//
// Mirrors race_canvas.js conventions: a rAF frame(now) with dt clamp, a
// supersede guard, ctx.save/translate/rotate/scale transform discipline, and
// per-part sine-phase desync (L2_UTIL.phaseOf).
// =====================================================================
const L2_PLY = (function () {
  const U = L2_UTIL;

  // Create a controller bound to a canvas. setRig() swaps the character,
  // start()/stop() drive the rAF loop. Cursor gaze is tracked on the canvas.
  function createController(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const S = {
      rig: null, t: 0, last: 0, raf: 0, active: false, loopId: null,
      gaze: { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 },   // tx/ty = spring-eased target in -1..1 (vx/vy = velocity)
      blink: { next: 1.2, closing: 0, t: 0 },
      fit: 1, ox: 0, oy: 0,
      bg: opts.bg || null, showPivots: false
    };

    function setRig(rig) { S.rig = rig; S.partsZ = rig ? L2_RIG.sortedByZ(rig) : []; layout(); resetBlink(); }
    function resetBlink() { S.blink = { next: 1.2 + Math.random() * 3, closing: 0, t: 0, val: 1 }; }

    // Fit the rig's canvas-space into the display canvas (contain).
    function layout() {
      if (!S.rig) return;
      const cw = canvas.width, ch = canvas.height;
      const rw = S.rig.canvas.w, rh = S.rig.canvas.h;
      const fit = Math.min(cw / rw, ch / rh) * (opts.zoom || 0.92);
      S.fit = fit;
      S.ox = (cw - rw * fit) / 2;
      S.oy = (ch - rh * fit) / 2;
    }

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      S.gaze.x = U.clamp((px - 0.5) * 2, -1, 1);
      S.gaze.y = U.clamp((py - 0.5) * 2, -1, 1);
    }
    function onLeave() { S.gaze.x = 0; S.gaze.y = 0; }

    function start() {
      if (S.active) return;
      S.active = true; S.loopId = {}; S.last = 0;
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('mouseleave', onLeave);
      const id = S.loopId;
      const frame = (now) => {
        if (!S.active || S.loopId !== id) return;          // superseded
        const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
        S.last = now; S.t += dt;
        update(dt);
        draw();
        S.raf = requestAnimationFrame(frame);
      };
      S.raf = requestAnimationFrame(frame);
    }
    function stop() {
      S.active = false; S.loopId = null;
      if (S.raf) cancelAnimationFrame(S.raf);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    }

    function update(dt) {
      // gaze: spring toward target (stiffness/damping) → slight overshoot then settle, instead of a flat lerp
      const gk = 120, gd = 16;
      S.gaze.vx += ((S.gaze.x - S.gaze.tx) * gk - S.gaze.vx * gd) * dt;
      S.gaze.vy += ((S.gaze.y - S.gaze.ty) * gk - S.gaze.vy * gd) * dt;
      S.gaze.tx += S.gaze.vx * dt;
      S.gaze.ty += S.gaze.vy * dt;
      // blink scheduler: closed→open envelope (~120ms)
      const b = S.blink;
      b.t += dt;
      if (b.closing > 0) {
        b.closing -= dt;
        const u = U.clamp(1 - b.closing / 0.12, 0, 1);          // 0 closed → 1 open
        b.val = Math.abs(Math.cos(u * Math.PI));                // 1→0→1 not needed; use eyelid scale below
        if (b.closing <= 0) { b.val = 1; b.next = 2 + Math.random() * 4; b.t = 0; }
      } else if (b.t >= b.next) {
        b.closing = 0.12; b.t = 0;
      }
    }

    // eyelid openness 1=open 0=closed (triangle envelope over the 120ms blink)
    function eyeOpen() {
      const b = S.blink;
      if (b.closing <= 0) return 1;
      const u = 1 - b.closing / 0.12;              // 0..1 across the blink
      return Math.abs(u - 0.5) * 2;                // 1 → 0 → 1
    }

    // ----- per-part transform deltas from the idle channels -----
    function partTransform(p) {
      const t = S.t, ph = U.phaseOf(p.id), m = p.motion || {};
      let rot = 0, sx = 1, sy = 1, tx = 0, ty = 0;

      // breathing — body-weighted gentle squash/stretch + lift
      if (m.breathing) {
        // 非整数比の2サイン合成で“非反復”の有機的な呼吸に（単一サインの機械的反復を回避）
        const br = Math.sin(2 * Math.PI * 0.22 * t) * 0.7 + Math.sin(2 * Math.PI * 0.167 * t + 1.3) * 0.3;
        sy += 0.022 * m.breathing * br;
        sx += 0.012 * m.breathing * br;
        ty += -1.5 * m.breathing * (br * 0.5 + 0.5);
      }
      // sway — rotation (or translation) about the pivot
      if (m.sway && m.sway.amp) {
        const ampMod = 1 + 0.15 * Math.sin(2 * Math.PI * 0.043 * t + ph);   // ±15% のゆっくりした揺らぎで非機械的に
        const s = Math.sin(2 * Math.PI * (m.sway.freq || 0.6) * t + ph + (m.sway.phase || 0)) * ampMod;
        if (m.sway.axis === 'tx') tx += s * m.sway.amp * 30;
        else if (m.sway.axis === 'ty') ty += s * m.sway.amp * 30;
        else rot += s * m.sway.amp;
      }
      // wing flutter — faster secondary flap
      if (m.flutter) {
        rot += Math.sin(2 * Math.PI * 1.6 * t + ph) * 0.05 * m.flutter;
      }
      // jiggle — soft "ぷるぷる" jelly bounce for chest/bust. A primary wobble plus a
      // half-amplitude second harmonic gives the springy, slightly asymmetric feel.
      // Volume-preserving (sy up ↔ sx down) and pivoted at the part's top edge, so the
      // lower edge swings most. Phase is deterministic (NOT per-id desynced) so left/right
      // sides can be driven fully in-sync (同時, same phase) or alternating (交互, phase±π).
      if (m.jiggle && m.jiggle.amp) {
        const f = m.jiggle.freq || 1.5, jp = (m.jiggle.phase || 0), a = m.jiggle.amp;
        const wob = Math.sin(2 * Math.PI * f * t + jp) + 0.35 * Math.sin(2 * Math.PI * 2 * f * t + jp);
        sy += 0.06 * a * wob;
        sx -= 0.04 * a * wob;
        ty += 4.0 * a * wob;
        rot += 0.02 * a * Math.sin(2 * Math.PI * f * t + jp + 0.5);
      }
      // head bob/tilt — handled via sway for rotation; add a slow vertical bob
      if (p.role === 'head' || p.role === 'body') {
        ty += Math.sin(2 * Math.PI * 0.13 * t + ph) * 1.2;
      }
      // gaze parallax
      if (m.gaze && (m.gaze.tx || m.gaze.ty)) {
        tx += S.gaze.tx * m.gaze.tx;
        ty += S.gaze.ty * m.gaze.ty;
      }
      return { rot, sx, sy, tx, ty };
    }

    // ----- draw -----
    function draw() {
      const cw = canvas.width, ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);
      if (S.bg) { ctx.fillStyle = S.bg; ctx.fillRect(0, 0, cw, ch); }
      if (!S.rig) return;

      // whole-character slow drift so it never sits perfectly still
      const driftX = Math.sin(2 * Math.PI * 0.07 * S.t) * 4;
      const driftY = Math.cos(2 * Math.PI * 0.05 * S.t) * 3;

      ctx.save();
      ctx.translate(S.ox + driftX, S.oy + driftY);
      ctx.scale(S.fit, S.fit);

      const parts = S.partsZ || (S.partsZ = L2_RIG.sortedByZ(S.rig));   // 高速化：毎フレームのsort/確保を回避
      for (const p of parts) {
        if (!p._img) continue;
        drawPart(p);
      }
      if (S.showPivots) drawPivots(parts);
      ctx.restore();
    }

    function drawPart(p) {
      const d = partTransform(p);
      const lp = L2_RIG.localPivot(p);
      const ax = p.pivot.x, ay = p.pivot.y;       // absolute pivot in rig space
      const sc = p.scale || { x: 1, y: 1 };
      const off = p.offset || { x: 0, y: 0 };
      const fh = p.flip && p.flip.h ? -1 : 1, fv = p.flip && p.flip.v ? -1 : 1;

      ctx.save();
      ctx.globalAlpha = (p.opacity == null ? 1 : p.opacity);
      // move to pivot, apply motion + static transform around it, then draw the
      // part's bitmap offset so its local pivot lands on the origin.
      ctx.translate(ax + off.x + d.tx, ay + off.y + d.ty);
      ctx.rotate((p.rot || 0) + d.rot);
      ctx.scale(sc.x * d.sx * fh, sc.y * d.sy * fv);

      const eyeScaleY = (p.motion && p.motion.blinkable) ? eyeOpen() : 1;

      if (p.motion && p.motion.bend && p.motion.bend.amp) {
        drawBentPart(p, lp, eyeScaleY);
      } else {
        if (eyeScaleY !== 1) ctx.scale(1, eyeScaleY);
        ctx.drawImage(p._img, -lp.x, -lp.y);
      }
      ctx.restore();
    }

    // Soft-bend: slice the part into N strips along an axis; each strip past the
    // root edge gets a progressive (u^2-eased) perpendicular offset so the part
    // curls organically — a cheap canvas alternative to a WebGL mesh warp.
    function drawBentPart(p, lp, eyeScaleY) {
      const img = p._img, bend = p.motion.bend;
      const W = img.width, H = img.height;
      const n = Math.max(2, bend.strips | 0);
      const amp = bend.amp, freq = bend.freq || 0.6, ph = U.phaseOf(p.id);
      const along = bend.axis === 'y' ? H : W;           // strip along width (x) by default
      const step = along / n;
      const rootRight = bend.rootEdge === 'right';        // tip is on the opposite edge

      for (let i = 0; i < n; i++) {
        // u: 0 at root edge → 1 at tip; ease so the root stays anchored.
        let u = (i + 0.5) / n;
        if (rootRight) u = 1 - u;
        const k = u * u;
        // 基本波＋1/4の2倍音＋ゆっくりした振幅ノイズ → 風になびくような有機的なうねり
        const ampMod = 1 + 0.15 * Math.sin(2 * Math.PI * 0.05 * S.t + ph);
        const wob = (Math.sin(2 * Math.PI * freq * S.t + ph + u * 1.6) + 0.25 * Math.sin(2 * Math.PI * 2 * freq * S.t + ph)) * amp * k * along * 0.55 * ampMod;

        ctx.save();
        if (bend.axis === 'y') {
          const sy0 = i * step, sh = Math.min(step + 1, H - sy0);
          ctx.translate(wob, 0);
          ctx.drawImage(img, 0, sy0, W, sh, -lp.x, sy0 - lp.y, W, sh);
        } else {
          const sx0 = i * step, sw = Math.min(step + 1, W - sx0);
          ctx.translate(0, wob);
          if (eyeScaleY !== 1) ctx.scale(1, eyeScaleY);
          ctx.drawImage(img, sx0, 0, sw, H, sx0 - lp.x, -lp.y, sw, H);
        }
        ctx.restore();
      }
    }

    function drawPivots(parts) {
      for (const p of parts) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,40,140,0.9)'; ctx.lineWidth = 1 / S.fit;
        const x = p.pivot.x, y = p.pivot.y, r = 6 / S.fit;
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
        ctx.restore();
      }
    }

    return {
      setRig, start, stop, layout,
      setShowPivots(v) { S.showPivots = !!v; },
      setBg(c) { S.bg = c; },
      get state() { return S; }
    };
  }

  return { createController };
})();
