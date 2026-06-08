// =====================================================================
// L2_DEMO — builds a layered cartoon dragon entirely in-canvas (no external
// PNG) so the tool animates out-of-the-box. Each part is drawn onto its own
// canvas with a tight bbox, then wrapped as a rig part with a sensible pivot,
// z-order, parent and motion preset. Side-view, head=right / tail=left, gold
// body + dark far-wing + crest — echoing the user's reference dragon.
// =====================================================================
const L2_DEMO = (function () {
  const GOLD = '#e9c178', GOLD_D = '#c79a4e', GOLD_L = '#f6e3b0';
  const DARK = '#3a3a40', DARK_D = '#26262b', INK = '#1a1420';

  // helper: draw onto an offscreen canvas sized w×h, return {canvas, pivot}
  function part(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g, w, h);
    return c;
  }
  function outline(g, fill, lw) { g.lineWidth = lw || 5; g.strokeStyle = INK; g.fillStyle = fill; g.fill(); g.stroke(); }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }

  function toURL(c) { return c.toDataURL('image/png'); }

  // Build the rig. Coordinates are in a 1024×640 canvas space.
  function build() {
    const CW = 1024, CH = 640;
    const rig = L2_RIG.create(CW, CH, 'demo-dragon');
    rig.rootPivot = { x: 540, y: 400 };

    function add(id, role, canvas, absPivot, z, parent) {
      const rect = { x: absPivot.rx, y: absPivot.ry, w: canvas.width, h: canvas.height };
      const p = L2_RIG.makePart(id, role, rect, { x: absPivot.px, y: absPivot.py });
      p.z = z; p.parent = parent || null;
      p.src = toURL(canvas);
      rig.parts.push(p);
    }

    // ---- far wing (dark, behind everything) ----
    const farW = part(360, 320, (g) => {
      poly(g, [[40, 300], [60, 60], [330, 20], [250, 170], [320, 150], [180, 300]]);
      outline(g, DARK_D, 6);
      g.globalAlpha = 0.5; poly(g, [[70, 250], [90, 110], [220, 80]]); outline(g, DARK, 0); g.globalAlpha = 1;
    });
    add('wing_far', 'wing', farW, { rx: 300, ry: 120, px: 330, py: 410 }, 1, 'body');

    // ---- tail (gold, ridged, points left) ----
    const tail = part(360, 200, (g) => {
      poly(g, [[20, 110], [120, 60], [250, 70], [350, 95], [250, 120], [120, 150]]);
      outline(g, GOLD, 6);
      // ridge spikes
      g.fillStyle = GOLD_L;
      for (let i = 0; i < 5; i++) { const x = 60 + i * 55; poly(g, [[x, 70], [x + 24, 30], [x + 40, 74]]); outline(g, GOLD_L, 4); }
    });
    add('tail', 'tail', tail, { rx: 70, ry: 360, px: 410, py: 430 }, 2, 'body');

    // ---- back legs / front legs (gold nubs) ----
    const legF = part(120, 150, (g) => { poly(g, [[30, 10], [90, 20], [80, 120], [60, 140], [40, 120]]); outline(g, GOLD, 5); g.fillStyle = GOLD_D; for (let i = 0; i < 3; i++) { poly(g, [[40 + i * 16, 120], [46 + i * 16, 148], [52 + i * 16, 120]]); outline(g, GOLD_D, 3); } });
    add('leg_far', 'limb', legF, { rx: 560, ry: 430, px: 600, py: 450 }, 3, 'body');
    add('leg_near', 'limb', part(120, 150, (g) => { poly(g, [[30, 10], [90, 20], [80, 120], [60, 140], [40, 120]]); outline(g, GOLD_L, 5); g.fillStyle = GOLD_D; for (let i = 0; i < 3; i++) { poly(g, [[40 + i * 16, 120], [46 + i * 16, 148], [52 + i * 16, 120]]); outline(g, GOLD_D, 3); } }), { rx: 470, ry: 440, px: 510, py: 460 }, 7, 'body');

    // ---- body (dark back + gold belly, ridge spikes) ----
    const body = part(520, 280, (g) => {
      // dark back
      g.beginPath(); g.ellipse(260, 150, 250, 120, 0, 0, Math.PI * 2); outline(g, DARK, 6);
      // gold belly
      g.beginPath(); g.ellipse(260, 200, 220, 80, 0, 0, Math.PI * 2); outline(g, GOLD, 0);
      // ridge spikes along the top
      g.fillStyle = GOLD_L;
      for (let i = 0; i < 7; i++) { const x = 90 + i * 58; poly(g, [[x, 70], [x + 22, 24], [x + 40, 72]]); outline(g, GOLD_L, 4); }
    });
    add('body', 'body', body, { rx: 300, ry: 280, px: 560, py: 400 }, 4, null);

    // ---- chest / bust (two gold bulges on the belly that ぷるぷる jiggle) ----
    function chestBlob(light) {
      return part(150, 160, (g) => {
        g.beginPath(); g.ellipse(75, 82, 62, 70, 0, 0, Math.PI * 2); outline(g, light ? GOLD_L : GOLD, 6);
        g.globalAlpha = 0.55; g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(56, 56, 18, 24, -0.3, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      });
    }
    // far (viewer-left) chest sits slightly behind; near (viewer-right) in front.
    add('chest_far', 'chest', chestBlob(false), { rx: 560, ry: 360, px: 635, py: 362 }, 5, 'body');
    add('chest_near', 'chest', chestBlob(true), { rx: 650, ry: 350, px: 725, py: 352 }, 5, 'body');
    // desync the two sides so they alternate (left bounces a half-cycle after right)
    const cF = L2_RIG.byId(rig, 'chest_far'), cN = L2_RIG.byId(rig, 'chest_near');
    cF.motion.jiggle.phase = Math.PI; cF.motion.jiggle.amp = 0.7;
    cN.motion.jiggle.phase = 0;       cN.motion.jiggle.amp = 0.9;

    // ---- near wing (gold, ribbed, big) ----
    const nearW = part(420, 340, (g) => {
      poly(g, [[30, 320], [120, 40], [400, 30], [330, 150], [410, 130], [200, 320]]);
      outline(g, GOLD, 6);
      g.strokeStyle = GOLD_D; g.lineWidth = 5;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(120 + i * 12, 70 + i * 10); g.lineTo(350 + i * 8, 90 + i * 12); g.stroke(); }
    });
    add('wing_near', 'wing', nearW, { rx: 300, ry: 70, px: 360, py: 390 }, 6, 'body');

    // ---- head (gold, crest, right side) ----
    const head = part(300, 260, (g) => {
      // crest spikes (behind head)
      g.fillStyle = GOLD_L;
      poly(g, [[60, 120], [10, 20], [80, 70]]); outline(g, GOLD_L, 4);
      poly(g, [[110, 90], [90, 0], [150, 60]]); outline(g, GOLD_L, 4);
      poly(g, [[160, 90], [170, 6], [200, 70]]); outline(g, GOLD_L, 4);
      // head blob
      g.beginPath(); g.ellipse(180, 160, 110, 85, 0, 0, Math.PI * 2); outline(g, GOLD, 6);
      // snout
      g.beginPath(); g.ellipse(255, 175, 45, 38, 0, 0, Math.PI * 2); outline(g, GOLD, 0);
      // nostril + mouth line
      g.fillStyle = INK; g.beginPath(); g.arc(285, 165, 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(230, 200); g.lineTo(285, 195); g.stroke();
    });
    add('head', 'head', head, { rx: 720, ry: 360, px: 800, py: 470 }, 8, 'body');

    // ---- eye (blinkable, on the head) ----
    const eye = part(70, 70, (g) => {
      g.beginPath(); g.ellipse(35, 35, 30, 32, 0, 0, Math.PI * 2); outline(g, '#ffffff', 5);
      g.fillStyle = INK; g.beginPath(); g.ellipse(42, 38, 16, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(36, 30, 5, 0, Math.PI * 2); g.fill();
    });
    add('eye', 'eye', eye, { rx: 880, ry: 470, px: 915, py: 505 }, 9, 'head');

    return rig;
  }

  return { build };
})();
