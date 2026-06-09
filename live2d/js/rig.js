// =====================================================================
// L2_RIG — rig schema, defaults, validation, (de)serialisation, hydration.
// A rig turns a single PNG into an ordered set of transformable parts.
//
// Two on-disk forms:
//   (A) project / separate-file  — part.file = "parts/<id>.png" (default; diff-friendly for Claude Code)
//   (B) single-file embed        — part.src  = "data:image/png;base64,..." (portable / browser round-trip)
// =====================================================================
const L2_RIG = (function () {
  const FORMAT = 'mimi-live2d-rig';
  const VERSION = 1;
  const ROLES = ['body', 'head', 'jaw', 'eye', 'eyelid', 'hair', 'wing', 'tail', 'horn', 'limb', 'chest', 'accessory', 'other'];

  // role → default idle-motion preset. Tuned for the side-view dragon.
  function defaultMotionForRole(role) {
    switch (role) {
      case 'body': return { breathing: 1.0, blinkable: false, sway: { amp: 0.0, freq: 0.25, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 0, ty: 0 }, flutter: 0 };
      case 'head': return { breathing: 0.5, blinkable: false, sway: { amp: 0.05, freq: 0.30, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 6, ty: 4 }, flutter: 0 };
      case 'jaw': return { breathing: 0.3, blinkable: false, sway: { amp: 0.04, freq: 0.9, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 2, ty: 1 }, flutter: 0 };
      case 'eye': return { breathing: 0.0, blinkable: true, sway: { amp: 0, freq: 1, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 4, ty: 3 }, flutter: 0 };
      case 'eyelid': return { breathing: 0.0, blinkable: true, sway: { amp: 0, freq: 1, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 2, ty: 1 }, flutter: 0 };
      case 'hair': return { breathing: 0.2, blinkable: false, sway: { amp: 0.10, freq: 0.7, phase: 0, axis: 'rot' }, bend: { amp: 0.12, freq: 0.7, axis: 'x', strips: 10, rootEdge: 'left' }, gaze: { tx: 3, ty: 2 }, flutter: 0 };
      case 'wing': return { breathing: 0.3, blinkable: false, sway: { amp: 0.14, freq: 0.9, phase: 0, axis: 'rot' }, bend: { amp: 0.16, freq: 0.9, axis: 'x', strips: 12, rootEdge: 'right' }, gaze: { tx: 0, ty: 0 }, flutter: 0.6 };
      case 'tail': return { breathing: 0.15, blinkable: false, sway: { amp: 0.13, freq: 0.55, phase: 0, axis: 'rot' }, bend: { amp: 0.18, freq: 0.55, axis: 'x', strips: 12, rootEdge: 'right' }, gaze: { tx: 0, ty: 0 }, flutter: 0 };
      case 'horn': return { breathing: 0.2, blinkable: false, sway: { amp: 0.03, freq: 0.6, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 2, ty: 1 }, flutter: 0 };
      case 'limb': return { breathing: 0.2, blinkable: false, sway: { amp: 0.06, freq: 0.8, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 0, ty: 0 }, flutter: 0 };
      // chest / bust — soft "ぷるぷる" jelly bounce (pivot at the top so the lower edge swings most)
      case 'chest': return { breathing: 0.4, blinkable: false, sway: { amp: 0.0, freq: 0.25, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 1, ty: 1 }, flutter: 0, jiggle: { amp: 1.0, freq: 1.4, phase: 0 } };
      default: return { breathing: 0.2, blinkable: false, sway: { amp: 0.04, freq: 0.6, phase: 0, axis: 'rot' }, bend: null, gaze: { tx: 1, ty: 1 }, flutter: 0 };
    }
  }

  function create(canvasW, canvasH, name) {
    return {
      format: FORMAT, version: VERSION, name: name || 'dragon',
      canvas: { w: canvasW | 0, h: canvasH | 0 },
      embed: true,
      rootPivot: { x: Math.round((canvasW || 0) / 2), y: Math.round((canvasH || 0) * 0.6) },
      parts: []
    };
  }

  function makePart(id, role, rect, pivot) {
    return {
      id: id, role: role || 'other', z: 0, parent: null,
      rect: { x: rect.x | 0, y: rect.y | 0, w: rect.w | 0, h: rect.h | 0 },
      pivot: { x: Math.round(pivot ? pivot.x : rect.x + rect.w / 2), y: Math.round(pivot ? pivot.y : rect.y + rect.h / 2) },
      // static design-time transform (independent of motion):
      opacity: 1, scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 }, rot: 0, flip: { h: false, v: false },
      motion: defaultMotionForRole(role || 'other'),
      src: null, file: null
    };
  }

  function localPivot(part) { return { x: part.pivot.x - part.rect.x, y: part.pivot.y - part.rect.y }; }

  function sortedByZ(rig) { return rig.parts.slice().sort((a, b) => (a.z - b.z) || (a.id < b.id ? -1 : 1)); }

  function byId(rig, id) { return rig.parts.find(p => p.id === id) || null; }

  // Resolve a part's parent chain → ordered ancestors (root last). Detects cycles.
  function ancestry(rig, part) {
    const chain = []; const seen = new Set(); let cur = part;
    while (cur && cur.parent) {
      if (seen.has(cur.id)) return { chain, cycle: true };
      seen.add(cur.id);
      const par = byId(rig, cur.parent);
      if (!par) break;
      chain.push(par); cur = par;
    }
    return { chain, cycle: false };
  }

  function validate(rig) {
    const errors = [];
    if (!rig || rig.format !== FORMAT) errors.push('format must be "' + FORMAT + '"');
    if (!rig || !rig.canvas || !rig.canvas.w || !rig.canvas.h) errors.push('canvas.w/h required');
    const ids = new Set();
    (rig.parts || []).forEach(p => {
      if (!p.id) errors.push('part missing id');
      if (ids.has(p.id)) errors.push('duplicate id: ' + p.id);
      ids.add(p.id);
      if (ROLES.indexOf(p.role) < 0) errors.push(p.id + ': invalid role "' + p.role + '"');
      if (!p.rect || p.rect.w <= 0 || p.rect.h <= 0) errors.push(p.id + ': rect must have positive size');
      if (!p.src && !p.file) errors.push(p.id + ': needs src (embed) or file (separate)');
    });
    // parent existence + cycles
    (rig.parts || []).forEach(p => {
      if (p.parent && !ids.has(p.parent)) errors.push(p.id + ': parent "' + p.parent + '" not found');
      if (p.parent && ancestry(rig, p).cycle) errors.push(p.id + ': parent chain has a cycle');
    });
    return { ok: errors.length === 0, errors };
  }

  // Deterministic serialise: stable key order, 2-space indent, rounded numbers.
  function serialize(rig, opts) {
    opts = opts || {};
    const embed = opts.embed != null ? opts.embed : rig.embed;
    const out = {
      format: FORMAT, version: VERSION, name: rig.name || 'dragon',
      canvas: { w: rig.canvas.w | 0, h: rig.canvas.h | 0 },
      embed: !!embed,
      rootPivot: { x: Math.round(rig.rootPivot.x), y: Math.round(rig.rootPivot.y) },
      parts: sortedByZ(rig).map(p => {
        const o = {
          id: p.id, role: p.role, z: p.z | 0, parent: p.parent || null,
          rect: { x: p.rect.x | 0, y: p.rect.y | 0, w: p.rect.w | 0, h: p.rect.h | 0 },
          pivot: { x: Math.round(p.pivot.x), y: Math.round(p.pivot.y) },
          opacity: round2(p.opacity == null ? 1 : p.opacity),
          scale: { x: round2(p.scale ? p.scale.x : 1), y: round2(p.scale ? p.scale.y : 1) },
          offset: { x: Math.round(p.offset ? p.offset.x : 0), y: Math.round(p.offset ? p.offset.y : 0) },
          rot: round3(p.rot || 0),
          flip: { h: !!(p.flip && p.flip.h), v: !!(p.flip && p.flip.v) },
          motion: cleanMotion(p.motion)
        };
        if (embed) o.src = p.src || null; else o.file = p.file || ('parts/' + p.id + '.png');
        return o;
      })
    };
    if (opts.keepEditState) {
      out.parts.forEach((o, i) => { const src = sortedByZ(rig)[i]; if (src._editState) o._editState = src._editState; });
    }
    return JSON.stringify(out, null, 2);
  }

  function cleanMotion(m) {
    m = m || {};
    const sway = m.sway || {};
    const o = {
      breathing: round2(m.breathing || 0),
      blinkable: !!m.blinkable,
      sway: { amp: round3(sway.amp || 0), freq: round2(sway.freq || 0), phase: round2(sway.phase || 0), axis: sway.axis || 'rot' },
      bend: null,
      gaze: { tx: Math.round((m.gaze && m.gaze.tx) || 0), ty: Math.round((m.gaze && m.gaze.ty) || 0) },
      flutter: round2(m.flutter || 0),
      jiggle: null
    };
    if (m.bend) o.bend = { amp: round3(m.bend.amp || 0), freq: round2(m.bend.freq || 0), axis: m.bend.axis || 'x', strips: (m.bend.strips | 0) || 10, rootEdge: m.bend.rootEdge || 'left' };
    if (m.jiggle) o.jiggle = { amp: round3(m.jiggle.amp || 0), freq: round2(m.jiggle.freq || 0), phase: round2(m.jiggle.phase || 0) };
    return o;
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  function deserialize(jsonText) {
    const rig = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    if (rig.format !== FORMAT) throw new Error('not a ' + FORMAT);
    // normalise: ensure every part has the static-transform fields + a motion block.
    rig.parts = (rig.parts || []).map(p => {
      p.scale = p.scale || { x: 1, y: 1 };
      p.offset = p.offset || { x: 0, y: 0 };
      p.flip = p.flip || { h: false, v: false };
      p.opacity = p.opacity == null ? 1 : p.opacity;
      p.rot = p.rot || 0;
      p.motion = cleanMotion(p.motion);
      return p;
    });
    return rig;
  }

  // Decode every part's src/file into part._img (HTMLImageElement). Browser-only.
  // baseURL lets separate-file rigs resolve relative "parts/x.png" paths.
  function hydrate(rig, baseURL) {
    const jobs = rig.parts.map(p => {
      const url = p.src || (baseURL ? (baseURL.replace(/\/$/, '') + '/' + p.file) : p.file);
      if (!url) return Promise.resolve();
      return L2_UTIL.loadImage(url).then(img => { p._img = img; });
    });
    return Promise.all(jobs).then(() => rig);
  }

  return {
    FORMAT, VERSION, ROLES,
    defaultMotionForRole, create, makePart, localPivot, sortedByZ, byId, ancestry,
    validate, serialize, deserialize, hydrate
  };
})();

// Make the rig module usable from the dependency-free Node CLI too.
if (typeof module !== 'undefined' && module.exports) module.exports = L2_RIG;
