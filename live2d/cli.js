#!/usr/bin/env node
// =====================================================================
// live2d CLI — dependency-free (Node stdlib only). Lets Claude Code (or you)
// validate / inspect / edit rig.json without a browser. Rendering stays in the
// browser; this operates on the rig JSON + geometry.
//
//   node live2d/cli.js validate <rig.json>
//   node live2d/cli.js inspect  <rig.json>
//   node live2d/cli.js coverage <rig.json>           (reports declared parts/area)
//   node live2d/cli.js part     <rig.json> --id X --set role=wing,z=5,opacity=0.8,flip=h
//   node live2d/cli.js motion   <rig.json> --id X --set sway.amp=0.12,breathing=0.4
//   node live2d/cli.js new      <name> --source path.png   (scaffold projects/<name>/)
// Edits write back in-place (deterministic: 2-space, stable key order).
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const L2_RIG = require('./js/rig.js');

function die(msg, code) { process.stderr.write(msg + '\n'); process.exit(code == null ? 1 : code); }
function readRig(p) { return L2_RIG.deserialize(fs.readFileSync(p, 'utf8')); }
function writeRig(p, rig, embed) { fs.writeFileSync(p, L2_RIG.serialize(rig, { embed: embed != null ? embed : rig.embed }) + '\n'); }

function parseSet(args) {
  // collect --id X and --set k=v,k=v
  const out = { id: null, set: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id') out.id = args[++i];
    else if (args[i] === '--set') {
      String(args[++i] || '').split(',').forEach(kv => { const [k, v] = kv.split('='); if (k) out.set[k.trim()] = (v || '').trim(); });
    } else if (args[i] === '--source') out.source = args[++i];
  }
  return out;
}
function coerce(v) {
  if (v === 'true') return true; if (v === 'false') return false;
  if (v === 'h' || v === 'v') return v;
  const n = Number(v); return isNaN(n) ? v : n;
}
function setPath(obj, dotted, val) {
  const segs = dotted.split('.'); let o = obj;
  for (let i = 0; i < segs.length - 1; i++) o = o[segs[i]] = o[segs[i]] || {};
  o[segs[segs.length - 1]] = val;
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case 'validate': {
    const p = rest[0]; if (!p) die('usage: validate <rig.json>');
    const rig = readRig(p); const v = L2_RIG.validate(rig);
    if (v.ok) { process.stdout.write('OK — ' + rig.parts.length + ' parts, canvas ' + rig.canvas.w + '×' + rig.canvas.h + '\n'); process.exit(0); }
    die('INVALID:\n  - ' + v.errors.join('\n  - '), 2);
    break;
  }
  case 'inspect':
  case 'list-parts': {
    const p = rest[0]; if (!p) die('usage: inspect <rig.json>');
    const rig = readRig(p);
    process.stdout.write('rig "' + rig.name + '"  canvas ' + rig.canvas.w + '×' + rig.canvas.h + '  embed=' + rig.embed + '\n');
    process.stdout.write('rootPivot ' + rig.rootPivot.x + ',' + rig.rootPivot.y + '\n');
    L2_RIG.sortedByZ(rig).forEach(pt => {
      const m = pt.motion || {};
      process.stdout.write(
        ['  z' + pt.z, pt.id.padEnd(12), pt.role.padEnd(8),
          'parent=' + (pt.parent || '-'),
          'pivot=' + pt.pivot.x + ',' + pt.pivot.y,
          'rect=' + pt.rect.w + 'x' + pt.rect.h,
          'breath=' + (m.breathing || 0), 'sway=' + ((m.sway && m.sway.amp) || 0),
          'blink=' + (m.blinkable ? 'Y' : 'n'), 'bend=' + (m.bend ? 'Y' : 'n')
        ].join('  ') + '\n');
    });
    break;
  }
  case 'coverage': {
    const p = rest[0]; if (!p) die('usage: coverage <rig.json>');
    const rig = readRig(p);
    let area = 0; rig.parts.forEach(pt => area += pt.rect.w * pt.rect.h);
    const canvasArea = rig.canvas.w * rig.canvas.h;
    process.stdout.write('parts=' + rig.parts.length + '  sum(rect area)=' + area +
      '  canvas area=' + canvasArea + '  ratio=' + (100 * area / canvasArea).toFixed(1) + '%\n' +
      '(pixel-accurate silhouette coverage is reported in the browser editor ⚠ button)\n');
    break;
  }
  case 'part': {
    const p = rest[0]; const a = parseSet(rest.slice(1));
    if (!p || !a.id) die('usage: part <rig.json> --id X --set role=wing,z=5,opacity=0.8,scale=1.2,flip=h,rot=0.1');
    const rig = readRig(p); const pt = L2_RIG.byId(rig, a.id); if (!pt) die('no part: ' + a.id);
    for (const k in a.set) {
      const v = coerce(a.set[k]);
      if (k === 'scale') { pt.scale = { x: v, y: v }; }
      else if (k === 'flip') { pt.flip = pt.flip || {}; pt.flip[v === 'v' ? 'v' : 'h'] = true; }
      else if (k === 'opacity' || k === 'z' || k === 'rot' || k === 'role' || k === 'parent') pt[k] = v;
      else setPath(pt, k, v);
    }
    writeRig(p, rig); process.stdout.write('updated ' + a.id + '\n');
    break;
  }
  case 'motion': {
    const p = rest[0]; const a = parseSet(rest.slice(1));
    if (!p || !a.id) die('usage: motion <rig.json> --id X --set sway.amp=0.12,breathing=0.4,blinkable=true');
    const rig = readRig(p); const pt = L2_RIG.byId(rig, a.id); if (!pt) die('no part: ' + a.id);
    pt.motion = pt.motion || {};
    for (const k in a.set) setPath(pt.motion, k, coerce(a.set[k]));
    writeRig(p, rig); process.stdout.write('updated motion of ' + a.id + '\n');
    break;
  }
  case 'new': {
    const name = rest[0]; const a = parseSet(rest.slice(1));
    if (!name) die('usage: new <name> --source path.png');
    const dir = path.join('live2d', 'projects', name);
    fs.mkdirSync(path.join(dir, 'parts'), { recursive: true });
    if (a.source && fs.existsSync(a.source)) fs.copyFileSync(a.source, path.join(dir, 'source.png'));
    const rig = L2_RIG.create(512, 512, name); rig.embed = false;
    fs.writeFileSync(path.join(dir, 'rig.json'), L2_RIG.serialize(rig, { embed: false }) + '\n');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ name, created: new Date().toISOString(), log: [] }, null, 2) + '\n');
    process.stdout.write('scaffolded ' + dir + '/{source.png,parts/,rig.json,meta.json}\n');
    break;
  }
  default:
    process.stdout.write('live2d CLI — commands: validate | inspect | coverage | part | motion | new\n' +
      '  node live2d/cli.js validate live2d/samples/dragon.rig.json\n');
}
