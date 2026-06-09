// =====================================================================
// L2_ED — the rigging editor. Load a PNG, paint masks with assisted tools,
// commit parts, set pivot / role / z / motion / static transforms, re-edit,
// check coverage, and export a rig (embed or separate-file form).
// =====================================================================
const L2_ED = (function () {
  const U = L2_UTIL;

  function create(refs) {
    // refs: { canvas, overlay, toolbar, panel, status, fileInput }
    const ctx = refs.canvas.getContext('2d');
    const octx = refs.overlay.getContext('2d');
    const S = {
      img: null, src: null,           // HTMLImageElement + L2_SEG buffer
      w: 0, h: 0, fit: 1, ox: 0, oy: 0,
      rig: null,
      mask: null, hist: new L2_SEG.History(24),
      tool: 'wand', mode: 'add', tol: 36, brush: 24,
      lasso: [], drawing: false,
      selected: null,                 // part id when placing pivot / editing
      placingPivot: false,
      previewCtrl: null,
      advancedOpen: false,            // ツールバー「⚙詳細(手動マスク編集)」の開閉
      cardOpen: new Set()             // パーツカードで「詳細」を開いているidの集合（再描画後も保持）
    };

    // ---------- image load ----------
    function loadFromImage(img, name) {
      S.img = img; S.w = img.width; S.h = img.height;
      refs.canvas.width = S.w; refs.canvas.height = S.h;
      refs.overlay.width = S.w; refs.overlay.height = S.h;
      S.src = L2_SEG.fromImage(img);
      S.mask = L2_SEG.newMask(S.w, S.h);
      S.hist = new L2_SEG.History(24); S.hist.snapshot(S.mask);
      S.rig = L2_RIG.create(S.w, S.h, name || 'dragon');
      S.selected = null;
      try { refine('bg'); } catch (e) {}   // Phase2/B: 読み込み時に背景を自動除去（透過はα、白背景は四隅フラッド）
      fitView(); redraw(); renderParts(); renderSteps();
      status('画像を読み込みました (' + S.w + '×' + S.h + ')。次は ②✨自動リグ が一番かんたん（または部位を選んで「パーツ化」）。');
    }
    function loadFromSrc(src, name) { return U.loadImage(src).then(img => loadFromImage(img, name)); }

    function fitView() {
      // どんなサイズのPNGも収まるよう「コンテナ幅 × ビューポート高60%」の枠に縦横比維持でフィット。
      // 旧実装は canvas 直親(=l2-stage, canvas自身のサイズ)を測っていて大きい画像が収まらなかった。
      if (!S.img) return;
      const wrap = (refs.canvas.parentElement && refs.canvas.parentElement.parentElement) || refs.canvas.parentElement;
      const cw = wrap ? wrap.clientWidth : 0;
      if (!cw) return;   // エディタ非表示時(幅0)は再フィットしない（誤った縮小率＝はみ出しを防ぐ）
      const bw = cw - 24;
      const bh = Math.max(240, Math.round((window.innerHeight || 800) * 0.6));
      const fit = Math.min(bw / S.w, bh / S.h);
      S.fit = (fit > 0 && isFinite(fit)) ? fit : 1;
      refs.canvas.style.width = (S.w * S.fit) + 'px'; refs.canvas.style.height = (S.h * S.fit) + 'px';
      refs.overlay.style.width = refs.canvas.style.width; refs.overlay.style.height = refs.canvas.style.height;
    }

    // ---------- rendering ----------
    function redraw() {
      ctx.clearRect(0, 0, S.w, S.h);
      // checker so transparency is visible
      drawChecker();
      if (S.img) ctx.drawImage(S.img, 0, 0);
      drawOverlay();
    }
    let _checkerPat = null;
    function drawChecker() {
      // 高速化：市松模様は一度だけ CanvasPattern にして fillRect 1回で塗る（旧：毎回数千回の fillRect）
      if (!_checkerPat) {
        const t = 16, oc = document.createElement('canvas'); oc.width = t * 2; oc.height = t * 2;
        const og = oc.getContext('2d');
        og.fillStyle = '#1f2027'; og.fillRect(0, 0, t * 2, t * 2);
        og.fillStyle = '#2a2b33'; og.fillRect(t, 0, t, t); og.fillRect(0, t, t, t);
        _checkerPat = ctx.createPattern(oc, 'repeat');
      }
      ctx.save(); ctx.fillStyle = _checkerPat; ctx.fillRect(0, 0, S.w, S.h); ctx.restore();
    }
    function drawOverlay() {
      octx.clearRect(0, 0, S.w, S.h);
      if (S.mask) octx.putImageData(L2_SEG.maskOverlayImageData(S.mask, S.w, S.h), 0, 0);
      // lasso in-progress
      if (S.tool === 'lasso' && S.lasso.length) {
        octx.strokeStyle = '#ff2a8c'; octx.lineWidth = 1.5 / S.fit; octx.beginPath();
        octx.moveTo(S.lasso[0][0], S.lasso[0][1]);
        for (let i = 1; i < S.lasso.length; i++) octx.lineTo(S.lasso[i][0], S.lasso[i][1]);
        octx.stroke();
      }
      // pivot crosshair for selected part (when placing)
      if (S.placingPivot && S.selected) {
        const p = L2_RIG.byId(S.rig, S.selected);
        if (p) crosshair(octx, p.pivot.x, p.pivot.y);
      }
    }
    function crosshair(g, x, y) {
      g.strokeStyle = '#ffd166'; g.lineWidth = 2 / S.fit; const r = 12 / S.fit;
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.stroke();
    }

    // ---------- pointer → image coords ----------
    function pt(e) {
      const r = refs.overlay.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * S.w;
      const y = (e.clientY - r.top) / r.height * S.h;
      return [Math.max(0, Math.min(S.w - 1, x)), Math.max(0, Math.min(S.h - 1, y))];
    }

    function onDown(e) {
      if (!S.img) return;
      const [x, y] = pt(e);
      if (S.placingPivot && S.selected) {
        const p = L2_RIG.byId(S.rig, S.selected);
        if (p) { p.pivot = { x: Math.round(x), y: Math.round(y) }; S.placingPivot = false; status('ピボットを設定: ' + p.id); renderParts(); drawOverlay(); }
        return;
      }
      S.drawing = true;
      const m = S.mode;
      if (S.tool === 'wand') { L2_SEG.floodFill(S.src, S.mask, x | 0, y | 0, S.tol, m); commitMask(); }
      else if (S.tool === 'lasso') { S.lasso = [[x, y]]; }
      else if (S.tool === 'brush' || S.tool === 'erase') { L2_SEG.brush(S.mask, S.w, S.h, x, y, S.brush, S.tool === 'erase' ? 'subtract' : m); drawOverlay(); }
      else if (S.tool === 'rect') { S._rect = [x, y]; }
    }
    function onMoveCanvas(e) {
      if (!S.drawing) return;
      const [x, y] = pt(e);
      if (S.tool === 'lasso') { S.lasso.push([x, y]); drawOverlay(); }
      else if (S.tool === 'brush' || S.tool === 'erase') { L2_SEG.brush(S.mask, S.w, S.h, x, y, S.brush, S.tool === 'erase' ? 'subtract' : S.mode); drawOverlay(); }
      else if (S.tool === 'rect' && S._rect) { drawOverlay(); octx.strokeStyle = '#ff2a8c'; octx.lineWidth = 1.5 / S.fit; octx.strokeRect(S._rect[0], S._rect[1], x - S._rect[0], y - S._rect[1]); }
    }
    function onUp(e) {
      if (!S.drawing) return; S.drawing = false;
      const [x, y] = pt(e);
      if (S.tool === 'lasso' && S.lasso.length > 2) { L2_SEG.lassoMask(S.mask, S.w, S.h, S.lasso, S.mode); S.lasso = []; commitMask(); }
      else if (S.tool === 'rect' && S._rect) { const rx = Math.min(S._rect[0], x), ry = Math.min(S._rect[1], y), rw = Math.abs(x - S._rect[0]), rh = Math.abs(y - S._rect[1]); L2_SEG.rectMask(S.mask, S.w, S.h, rx, ry, rw, rh, S.mode); S._rect = null; commitMask(); }
      else if (S.tool === 'brush' || S.tool === 'erase') { commitMask(); }
    }
    function commitMask() { S.hist.snapshot(S.mask); drawOverlay(); updateMaskInfo(); }

    function updateMaskInfo() {
      const a = L2_SEG.maskArea(S.mask);
      status('マスク: ' + a + 'px。「パーツ化」で確定 / ツールで追加・削除可。');
    }

    // ---------- mask refinement ----------
    function refine(op) {
      if (!S.mask) return;
      if (op === 'grow') L2_SEG.grow(S.mask, S.w, S.h, 1);
      else if (op === 'shrink') L2_SEG.shrink(S.mask, S.w, S.h, 1);
      else if (op === 'fill') L2_SEG.fillHoles(S.mask, S.w, S.h);
      else if (op === 'despeckle') L2_SEG.removeSpecks(S.mask, S.w, S.h, 64);
      else if (op === 'largest') L2_SEG.keepLargestComponent(S.mask, S.w, S.h);
      else if (op === 'clear') S.mask.fill(0);
      else if (op === 'bg') { // background remove: flood from the four corners, then invert into mask = silhouette
        const bg = L2_SEG.newMask(S.w, S.h);
        [[0, 0], [S.w - 1, 0], [0, S.h - 1], [S.w - 1, S.h - 1]].forEach(c => L2_SEG.floodFill(S.src, bg, c[0], c[1], 28, 'add'));
        for (let i = 0; i < S.mask.length; i++) S.mask[i] = bg[i] ? 0 : 255;
        // keep only opaque-ish pixels
        L2_SEG.alphaThreshold(S.src, S.mask, 8, 'replace');
        for (let i = 0; i < S.mask.length; i++) if (bg[i]) S.mask[i] = 0;
      }
      commitMask();
    }
    function undo() { const m = S.hist.undo(); if (m) { S.mask = m; drawOverlay(); updateMaskInfo(); } }
    function redo() { const m = S.hist.redo(); if (m) { S.mask = m; drawOverlay(); updateMaskInfo(); } }

    // ---------- commit a part ----------
    function makePart() {
      if (!S.mask) return;
      const bbox = L2_SEG.boundingBox(S.mask, S.w, S.h);
      if (!bbox) { status('マスクが空です。ワンド/ブラシで部位を選択してください。'); return; }
      const id = uniqueId(guessRole(bbox));
      const role = guessRole(bbox);
      const cropped = L2_SEG.cropMaskedToCanvas(S.img, S.mask, S.w, S.h, bbox);
      const p = L2_RIG.makePart(id, role, bbox, { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 });
      p.z = S.rig.parts.length;
      p.src = cropped.toDataURL('image/png');
      p._editState = { mask: Array.from(maskRunLength(S.mask)) }; // editor-only sidecar (RLE)
      S.rig.parts.push(p);
      S.selected = id;
      S.mask = L2_SEG.newMask(S.w, S.h); S.hist = new L2_SEG.History(24); S.hist.snapshot(S.mask);
      renderParts(); drawOverlay(); renderSteps(); refreshPreview();
      status('パーツ作成: ' + id + ' (role=' + role + ')。右パネルで role/z/pivot/motion を調整。③で動きを確認できます。');
    }

    // ---------- one-click auto-rig (Phase 4 + v2 / A) ----------
    // 最大連結成分でノイズ(速度線/砂埃)を除去し、縦横比で「人型(縦長)＝頭/胴/脚」か
    // 「側面クリーチャー(横長)＝頭/胴/翼/尾」を自動判別。帯は少し重ねて継ぎ目を隠し、
    // role/既定モーション(竜向けに調整済み)/ピボット/z を自動付与。後で右パネルで微調整可。
    function autoRig(opts) {
      if (!S.img) { status('先に画像を開いてください。'); return; }
      refine('bg');
      L2_SEG.keepLargestComponent(S.mask, S.w, S.h);   // 速度線/砂埃などの小blobを除去（竜本体だけ残す）
      const sil = S.mask;
      const sb = L2_SEG.boundingBox(sil, S.w, S.h);
      if (!sb || sb.w < 8 || sb.h < 8) { status('シルエットが検出できませんでした。背景除去/ワンドで調整してください。'); return; }
      const ovx = Math.max(6, Math.floor(sb.w * 0.02)), ovy = Math.max(6, Math.floor(sb.h * 0.02));
      S.rig = L2_RIG.create(S.w, S.h, (S.rig && S.rig.name) || 'dragon');
      const band = (id, role, xa, xb, ya, yb, pvx, pvy, z, tweak) => {
        const m = L2_SEG.newMask(S.w, S.h);
        const x0 = Math.max(sb.x, xa | 0), x1 = Math.min(sb.x + sb.w, xb | 0);
        const y0 = Math.max(sb.y, ya | 0), y1 = Math.min(sb.y + sb.h, yb | 0);
        for (let y = y0; y < y1; y++) { const row = y * S.w; for (let x = x0; x < x1; x++) if (sil[row + x]) m[row + x] = 255; }
        const bb = L2_SEG.boundingBox(m, S.w, S.h); if (!bb) return;
        const cropped = L2_SEG.cropMaskedToCanvas(S.img, m, S.w, S.h, bb);
        const p = L2_RIG.makePart(uniqueId(id), role, bb, { x: Math.round(pvx), y: Math.round(pvy) });
        p.z = z; p.src = cropped.toDataURL('image/png');
        p._editState = { mask: Array.from(maskRunLength(m)) };
        if (tweak) tweak(p);
        S.rig.parts.push(p);
      };
      // 任意マスクから1パーツ生成（v3の腕/脚分離用）。空マスクはスキップ。
      const partFromMask = (id, role, m, pvx, pvy, z, tweak) => {
        const bb = L2_SEG.boundingBox(m, S.w, S.h); if (!bb) return false;
        const cropped = L2_SEG.cropMaskedToCanvas(S.img, m, S.w, S.h, bb);
        const p = L2_RIG.makePart(uniqueId(id), role, bb, { x: Math.round(pvx), y: Math.round(pvy) });
        p.z = z; p.src = cropped.toDataURL('image/png');
        p._editState = { mask: Array.from(maskRunLength(m)) };
        if (tweak) tweak(p);
        S.rig.parts.push(p); return true;
      };
      let summary;
      if (sb.w / sb.h > 1.15) {
        // 横長＝側面クリーチャー（竜）。頭/尾の向きは複数手がかりの多数決で判定。
        // （単純な「端の高さ」だけだと翼や背びれで尾側が高くなり誤判定するため）
        const massIn = (xa, xb) => { let m = 0; const x0 = Math.max(sb.x, xa | 0), x1 = Math.min(sb.x + sb.w, xb | 0); for (let x = x0; x < x1; x++) for (let y = sb.y; y < sb.y + sb.h; y++) if (sil[y * S.w + x]) m++; return m; };
        const avgColH = (xa, xb) => { let s = 0, k = 0; const x0 = Math.max(sb.x, xa | 0), x1 = Math.min(sb.x + sb.w, xb | 0); for (let x = x0; x < x1; x++) { let t = -1, b = -1; for (let y = sb.y; y < sb.y + sb.h; y++) if (sil[y * S.w + x]) { if (t < 0) t = y; b = y; } if (t >= 0) { s += b - t; k++; } } return k ? s / k : 0; };
        let cmx = 0, cn = 0; for (let x = sb.x; x < sb.x + sb.w; x++) for (let y = sb.y; y < sb.y + sb.h; y++) if (sil[y * S.w + x]) { cmx += x; cn++; }
        cmx = cn ? cmx / cn : sb.x + sb.w / 2;
        const vMass = massIn(sb.x + sb.w * 0.70, sb.x + sb.w) >= massIn(sb.x, sb.x + sb.w * 0.30);       // 頭側＝胴/脚で質量が大
        const vCentroid = cmx > sb.x + sb.w / 2;                                                          // 重心が頭側に寄る
        const vTaper = avgColH(sb.x + sb.w * 0.88, sb.x + sb.w) >= avgColH(sb.x, sb.x + sb.w * 0.12);     // 尾は先細り＝端が低い
        let headRight = ((vMass ? 1 : 0) + (vCentroid ? 1 : 0) + (vTaper ? 1 : 0)) >= 2;
        if (opts && typeof opts.forceHeadRight === 'boolean') headRight = opts.forceHeadRight;            // 「🔁頭⇄尾」での手動反転
        S._headRight = headRight; S._isCreature = true;
        const X = (f) => Math.round(headRight ? sb.x + f * sb.w : sb.x + (1 - f) * sb.w);
        const xr = (a, b) => headRight ? [X(a), X(b)] : [X(b), X(a)];
        const Y = (f) => sb.y + Math.floor(sb.h * f);
        let r;
        r = xr(0, 0.40);     band('tail', 'tail', r[0], r[1], sb.y, sb.y + sb.h, X(0.40), Y(0.55), 0, p => { if (p.motion.bend) p.motion.bend.rootEdge = headRight ? 'right' : 'left'; });
        r = xr(0.30, 0.78);  band('body', 'body', r[0], r[1], Y(0.30), sb.y + sb.h, X(0.54), Y(0.72), 1);
        r = xr(0.30, 0.82);  band('wing', 'wing', r[0], r[1], sb.y, Y(0.52) + ovy, X(0.56), Y(0.50), 2);
        r = xr(0.72, 1.0);   band('head', 'head', r[0], r[1], sb.y, sb.y + sb.h, X(0.72), Y(0.45), 3);
        S.rig.rootPivot = { x: X(0.5), y: Y(0.62) };
        summary = '頭/胴/翼/尾';
      } else {
        S._isCreature = false;
        // 縦長＝人型。v3：首/腰に加え腕(左右)・脚(左右)を分離し、肩/腰のピボットを推定。
        // 対称軸＝胴重心x。肩幅が腰幅より十分広ければ腕あり、腰下に明確な谷があれば脚を左右に割る。
        // 曖昧なら頭/胴/脚（v2相当）へ自動フォールバック。腕未採用ぶんの画素は胴へ統合（取りこぼし防止）。
        const W = S.w, x0 = sb.x, x1 = sb.x + sb.w, y0 = sb.y, y1 = sb.y + sb.h;
        const widths = new Int32Array(sb.h);
        for (let ry = 0; ry < sb.h; ry++) { let c = 0; const row = (y0 + ry) * W; for (let x = x0; x < x1; x++) if (sil[row + x]) c++; widths[ry] = c; }
        const nz0 = Math.floor(sb.h * 0.08), nz1 = Math.max(nz0 + 1, Math.floor(sb.h * 0.42));
        let neckRel = nz0, minW = Infinity; for (let ry = nz0; ry < nz1; ry++) if (widths[ry] < minW) { minW = widths[ry]; neckRel = ry; }
        const neck = y0 + neckRel, hip = y0 + Math.floor(sb.h * 0.58);
        let cmx = 0, cmn = 0; for (let yy = neck; yy < hip; yy++) { const row = yy * W; for (let x = x0; x < x1; x++) if (sil[row + x]) { cmx += x; cmn++; } }
        const axis = cmn ? Math.round(cmx / cmn) : Math.round(x0 + sb.w / 2);   // 左右対称軸
        const low = []; for (let ry = Math.floor(sb.h * 0.45); ry < Math.floor(sb.h * 0.58); ry++) low.push(widths[ry]);
        low.sort((a, b) => a - b); const coreW = low.length ? low[low.length >> 1] : Math.floor(sb.w * 0.5);
        let shoulderW = 0; for (let ry = neckRel; ry < Math.floor(sb.h * 0.45); ry++) if (widths[ry] > shoulderW) shoulderW = widths[ry];
        const hasArms = shoulderW > coreW * 1.30;                               // 肩が腰より広い→腕あり
        const coreHalf = Math.max(8, Math.floor(coreW * 0.5));
        const armX0 = axis - coreHalf, armX1 = axis + coreHalf;
        let splitX = axis, splitMin = Infinity, legAvg = 0, legN = 0;           // 脚の割れ目＝腰下・中央寄りの最小密度x
        const sLo = axis - Math.floor(coreHalf * 0.6), sHi = axis + Math.floor(coreHalf * 0.6);
        for (let x = sLo; x <= sHi; x++) { if (x < 0 || x >= W) continue; let c = 0; for (let yy = hip; yy < y1; yy++) if (sil[yy * W + x]) c++; legAvg += c; legN++; if (c < splitMin) { splitMin = c; splitX = x; } }
        legAvg = legN ? legAvg / legN : 0;
        const mk = () => L2_SEG.newMask(W, S.h);
        const mHead = mk(), mBody = mk(), mArmL = mk(), mArmR = mk(), mLegL = mk(), mLegR = mk();
        let armLn = 0, armRn = 0, legLn = 0, legRn = 0;
        for (let yy = y0; yy < y1; yy++) { const row = yy * W;
          for (let x = x0; x < x1; x++) { if (!sil[row + x]) continue;
            if (yy < neck) mHead[row + x] = 255;
            else if (yy < hip) { if (hasArms && x < armX0) { mArmL[row + x] = 255; armLn++; } else if (hasArms && x > armX1) { mArmR[row + x] = 255; armRn++; } else mBody[row + x] = 255; }
            else { if (x >= splitX) { mLegR[row + x] = 255; legRn++; } else { mLegL[row + x] = 255; legLn++; } }
          }
        }
        const legMin = sb.w * sb.h * 0.008;
        const legsSplit = (splitMin < legAvg * 0.5) && legLn > legMin && legRn > legMin;   // 谷あり＋両脚に十分な面積のときだけ左右割り
        const armMin = sb.w * sb.h * 0.004;
        const armLok = hasArms && armLn > armMin, armRok = hasArms && armRn > armMin;
        if (!armLok) for (let i = 0; i < mArmL.length; i++) if (mArmL[i]) mBody[i] = 255;   // 未採用の腕画素は胴へ
        if (!armRok) for (let i = 0; i < mArmR.length; i++) if (mArmR[i]) mBody[i] = 255;
        partFromMask('body', 'body', mBody, axis, (neck + hip) / 2, 1);
        if (legsSplit) { partFromMask('leg_l', 'limb', mLegL, (x0 + splitX) / 2, hip, 0); partFromMask('leg_r', 'limb', mLegR, (splitX + x1) / 2, hip, 0); }
        else { for (let i = 0; i < mLegR.length; i++) if (mLegR[i]) mLegL[i] = 255; partFromMask('legs', 'limb', mLegL, axis, hip, 0); }
        let arms = 0;
        if (armLok) { partFromMask('arm_l', 'limb', mArmL, armX0, neck + (hip - neck) * 0.12, 2); arms++; }
        if (armRok) { partFromMask('arm_r', 'limb', mArmR, armX1, neck + (hip - neck) * 0.12, 2); arms++; }
        partFromMask('head', 'head', mHead, axis, neck, 3);
        S.rig.rootPivot = { x: axis, y: hip };
        summary = '頭/胴/' + (arms ? '腕×' + arms + '/' : '') + (legsSplit ? '脚×2' : '脚');
      }
      S.selected = null;
      S.mask = L2_SEG.newMask(S.w, S.h); S.hist = new L2_SEG.History(24); S.hist.snapshot(S.mask);
      renderParts(); drawOverlay();
      try { startPreview(refs.previewCanvas); } catch (e) {}   // 保存前に結果をすぐプレビュー
      renderSteps();
      status('✨ 自動リグ完了：' + summary + ' を生成。右上のプレビューで動き確認 → ④⬇書き出し。' + (S._isCreature ? '頭と尾が逆なら「🔁頭⇄尾」、' : '') + '範囲は各パーツの「✎再編集」→「↻再パーツ化」で直せます（プレビュー即反映）。');
    }
    function swapHeadTail() {   // 自動リグの頭/尾判定が逆のときワンクリックで反転（向きを固定して再リグ）
      if (!S.img) { status('先に画像を開いてください。'); return; }
      if (!S._isCreature) { status('頭⇄尾の入れ替えは横長（側面クリーチャー）の自動リグでのみ有効です。'); return; }
      autoRig({ forceHeadRight: !S._headRight });
      status('🔁 頭と尾を入れ替えました（頭＝' + (S._headRight ? '右' : '左') + '）。プレビューで確認してください。');
    }
    function guessRole(b) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (b.w > S.w * 0.45 && b.h > S.h * 0.3) return 'body';
      if (cx > S.w * 0.7) return 'head';
      if (cx < S.w * 0.3) return 'tail';
      if (b.y < S.h * 0.4 && b.w > S.w * 0.2) return 'wing';
      // medium rounded blob in the central torso band → chest/bust (left or right)
      if (b.w < S.w * 0.3 && b.h < S.h * 0.4 && cy > S.h * 0.35 && cy < S.h * 0.75 && cx > S.w * 0.3 && cx < S.w * 0.7) return 'chest';
      return 'other';
    }
    function uniqueId(base) {
      let n = 1, id = base;
      const has = (x) => S.rig.parts.some(p => p.id === x);
      while (has(id)) { id = base + '_' + (++n); }
      return id;
    }
    function maskRunLength(mask) { // simple RLE so editor sidecar stays small
      const out = []; let run = 0, cur = 0;
      for (let i = 0; i < mask.length; i++) { const v = mask[i] ? 1 : 0; if (v === cur) run++; else { out.push(run); cur = v; run = 1; } }
      out.push(run); return out;
    }
    function maskFromRLE(rle, len) { const m = new Uint8Array(len); let i = 0, cur = 0; for (const run of rle) { const v = cur ? 255 : 0; for (let k = 0; k < run && i < len; k++) m[i++] = v; cur ^= 1; } return m; }

    // ---------- part editing ----------
    function reEditPart(id) {
      const p = L2_RIG.byId(S.rig, id); if (!p) return;
      if (p._editState && p._editState.mask) { S.mask = maskFromRLE(p._editState.mask, S.w * S.h); }
      else S.mask = L2_SEG.newMask(S.w, S.h);
      S.hist = new L2_SEG.History(24); S.hist.snapshot(S.mask);
      S.selected = id; drawOverlay();
      status('「' + id + '」を再編集中。ツールでマスクを直して「再パーツ化」。');
    }
    function recommitPart(id) {
      const p = L2_RIG.byId(S.rig, id); if (!p) return;
      const bbox = L2_SEG.boundingBox(S.mask, S.w, S.h);
      if (!bbox) { status('マスクが空です。'); return; }
      const cropped = L2_SEG.cropMaskedToCanvas(S.img, S.mask, S.w, S.h, bbox);
      p.rect = bbox; p.src = cropped.toDataURL('image/png');
      p._editState = { mask: Array.from(maskRunLength(S.mask)) };
      renderParts(); refreshPreview(); status('「' + id + '」を範囲ごと更新しました（プレビュー即反映）。');
    }
    function duplicatePart(id) {
      const p = L2_RIG.byId(S.rig, id); if (!p) return;
      const copy = JSON.parse(JSON.stringify(p));
      copy.id = uniqueId(p.id.replace(/_\d+$/, '')); copy.z = S.rig.parts.length;
      copy.offset = { x: (p.offset.x || 0) + 12, y: (p.offset.y || 0) + 12 };
      S.rig.parts.push(copy); S.selected = copy.id; renderParts();
      status('複製: ' + copy.id + '（反転で左右対称パーツに）');
    }
    function flipPart(id, axis) { const p = L2_RIG.byId(S.rig, id); if (!p) return; if (axis === 'h') p.flip.h = !p.flip.h; else p.flip.v = !p.flip.v; renderParts(); refreshPreview(); }
    function deletePart(id) { S.rig.parts = S.rig.parts.filter(p => p.id !== id); if (S.selected === id) S.selected = null; renderParts(); refreshPreview(); }
    function setRole(id, role) { const p = L2_RIG.byId(S.rig, id); if (!p) return; p.role = role; p.motion = L2_RIG.defaultMotionForRole(role); renderParts(); refreshPreview(); }
    // chest "ぷるぷる" group mode: 'sync' = every chest part shares phase 0 (同時に揺れる),
    // 'alt' = sort by x and alternate phase 0 / π so neighbours bounce out of step (交互).
    function chestParts() { return L2_RIG.sortedByZ(S.rig).filter(p => p.role === 'chest').sort((a, b) => a.pivot.x - b.pivot.x); }
    function setChestJiggleMode(mode) {
      const cs = chestParts(); if (!cs.length) return;
      cs.forEach((p, i) => {
        p.motion.jiggle = p.motion.jiggle || L2_RIG.defaultMotionForRole('chest').jiggle;
        p.motion.jiggle.phase = (mode === 'alt' && (i % 2 === 1)) ? Math.PI : 0;
      });
      renderParts(); refreshPreview(); status('胸のぷるぷる: ' + (mode === 'alt' ? '交互' : '同時') + 'に設定（' + cs.length + 'パーツ）');
    }
    function moveZ(id, dir) {
      const sorted = L2_RIG.sortedByZ(S.rig); const i = sorted.findIndex(p => p.id === id);
      const j = i + dir; if (j < 0 || j >= sorted.length) return;
      const a = sorted[i], b = sorted[j]; const tz = a.z; a.z = b.z; b.z = tz;
      if (a.z === b.z) b.z += dir; renderParts(); refreshPreview();
    }
    function setNum(id, path, val) {
      const p = L2_RIG.byId(S.rig, id); if (!p) return;
      const segs = path.split('.'); let o = p;
      for (let i = 0; i < segs.length - 1; i++) o = o[segs[i]] = o[segs[i]] || {};
      o[segs[segs.length - 1]] = val; refreshPreview();
    }

    // ---------- coverage report ----------
    function coverageReport() {
      // assigned = union of all part rects' masks (approx via part bboxes alpha)
      const assigned = L2_SEG.newMask(S.w, S.h);
      S.rig.parts.forEach(p => { if (p._editState && p._editState.mask) { const m = maskFromRLE(p._editState.mask, S.w * S.h); for (let i = 0; i < m.length; i++) if (m[i]) assigned[i] = 255; } });
      const silhouette = L2_SEG.newMask(S.w, S.h);
      L2_SEG.alphaThreshold(S.src, silhouette, 24, 'replace');
      let unassigned = 0;
      const overlay = L2_SEG.newMask(S.w, S.h);
      for (let i = 0; i < silhouette.length; i++) if (silhouette[i] && !assigned[i]) { unassigned++; overlay[i] = 255; }
      // show the unassigned region
      S.mask = overlay; drawOverlay();
      const total = L2_SEG.maskArea(silhouette);
      status('未割当: ' + unassigned + 'px / シルエット ' + total + 'px (' + (total ? (100 * unassigned / total).toFixed(1) : 0) + '%)。ハイライト部をパーツ化候補に。');
    }

    // ---------- preview ----------
    function startPreview(canvas) {
      stopPreview();
      const rig = JSON.parse(L2_RIG.serialize(S.rig, { embed: true }));
      L2_RIG.deserialize(rig);
      L2_RIG.hydrate(rig).then(() => { S.previewCtrl = L2_PLY.createController(canvas, { bg: null, zoom: 0.92 }); S.previewCtrl.setRig(rig); S.previewCtrl.start(); renderSteps(); });
    }
    function stopPreview() { if (S.previewCtrl) { S.previewCtrl.stop(); S.previewCtrl = null; renderSteps(); } }
    function refreshPreview() { if (S.previewCtrl && refs.previewCanvas) startPreview(refs.previewCanvas); }

    // ---------- export ----------
    function exportRig(embed) {
      const v = L2_RIG.validate(S.rig);
      if (!v.ok) { status('検証エラー: ' + v.errors.join(' / ')); return; }
      const json = L2_RIG.serialize(S.rig, { embed: embed });
      if (embed) { U.downloadText(json, (S.rig.name || 'dragon') + '.rig.json'); status('embed版 rig.json を書き出しました。'); }
      else {
        // separate-file: download json + each part png
        U.downloadText(json, (S.rig.name || 'dragon') + '.rig.json');
        S.rig.parts.forEach(p => { if (p.src) { const blob = dataURLtoBlob(p.src); U.downloadBlob(blob, 'parts/' + p.id + '.png'.replace('parts/', '')); } });
        status('分離版 rig.json + parts/*.png を書き出しました（projects/<name>/ に配置）。');
      }
    }
    function dataURLtoBlob(durl) { const [meta, b64] = durl.split(','); const mime = (meta.match(/:(.*?);/) || [, 'image/png'])[1]; const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); }

    // ---------- UI: toolbar + part list ----------
    function status(msg) { if (refs.status) refs.status.textContent = msg; }

    // ---------- step guide（直感的な手順ナビ。番号＝今やること、クリックでその操作を実行）----------
    function currentStep() {
      if (!S.img) return 0;                               // ① 画像を開く
      if (!S.rig || !S.rig.parts.length) return 1;        // ② 自動リグ / パーツ化
      if (!S.previewCtrl) return 2;                       // ③ 動きを確認
      return 3;                                           // ④ 書き出し
    }
    function renderSteps() {
      if (!refs.steps) return;
      const cur = currentStep();
      const items = [
        ['📂', '画像を開く', '竜やキャラのPNGを読み込む', () => { const b = document.getElementById('btn-open'); if (b) b.click(); }],
        ['✨', '自動リグ', '部位に自動分解＋動きを付与', () => autoRig()],
        ['▶', '動きを確認', '保存前にアイドルをプレビュー', () => startPreview(refs.previewCanvas)],
        ['⬇', '書き出し', 'rig.json を保存', () => exportRig(true)]
      ];
      U.clear(refs.steps);
      items.forEach((it, i) => {
        const b = U.el('button', 'l2-step' + (i === cur ? ' on' : '') + (i < cur ? ' done' : ''),
          '<span class="l2-step-n">' + (i < cur ? '✓' : (i + 1)) + '</span>' +
          '<span class="l2-step-tx"><b>' + it[0] + ' ' + it[1] + '</b><i>' + it[2] + '</i></span>');
        b.onclick = it[3];
        refs.steps.appendChild(b);
        if (i < items.length - 1) refs.steps.appendChild(U.el('span', 'l2-step-arrow', '›'));
      });
    }

    function selectTool(k) { S.tool = k; S.advancedOpen = true; renderToolbar(); }   // ツール選択（ホットキー時も詳細を自動展開）
    function renderToolbar() {
      const tb = refs.toolbar; U.clear(tb);
      const mkBtn = (cls, label, title, on) => { const b = U.el('button', cls, label); if (title) b.title = title; b.onclick = on; return b; };
      // --- 常時表示：本流アクション ---
      const main = U.el('div', 'l2-tb-group');
      main.appendChild(mkBtn('l2-make', '✨ 自動リグ', '画像を部位に自動分解してリグ生成', () => autoRig()));
      main.appendChild(mkBtn('l2-ref', '🔁 頭⇄尾', '自動リグの頭と尾が逆のとき押して反転', swapHeadTail));
      main.appendChild(mkBtn('l2-make', '✓ パーツ化', '選択中のマスクをパーツ化 [Enter]', makePart));
      main.appendChild(U.el('span', 'l2-tb-divider'));
      main.appendChild(mkBtn('l2-ref', '↶ Undo', '取り消し [Ctrl+Z]', undo));
      main.appendChild(mkBtn('l2-ref', '↷ Redo', 'やり直し [Ctrl+Y]', redo));
      tb.appendChild(main);
      // --- 詳細トグル（手動マスク編集：副次的なので既定は閉） ---
      const tg = U.el('button', 'l2-tb-toggle' + (S.advancedOpen ? ' on' : ''), '<span class="l2-caret">▸</span> ⚙ 詳細（手動マスク編集）');
      tg.title = '手動でマスクを塗って部位を作る／微修正する道具';
      tg.onclick = () => { S.advancedOpen = !S.advancedOpen; renderToolbar(); };
      tb.appendChild(tg);
      if (!S.advancedOpen) return;
      // --- 詳細セクション（小見出し付きグループ） ---
      const adv = U.el('div', 'l2-tb-advanced');
      const row = (labelText) => { const r = U.el('div', 'l2-tb-row'); if (labelText) r.appendChild(U.el('span', 'l2-tb-label', labelText)); adv.appendChild(r); return r; };
      const rTool = row('ツール');
      const tools = [['wand', '🪄 ワンド'], ['brush', '🖌 ブラシ'], ['erase', '🧽 消し'], ['lasso', '➰ なげなわ'], ['rect', '▭ 矩形']];
      const tHot = { wand: 'W', brush: 'B', erase: 'E', lasso: 'L', rect: 'R' };
      tools.forEach(([k, label]) => rTool.appendChild(mkBtn('l2-tool' + (S.tool === k ? ' on' : ''), label, label + ' [' + tHot[k] + ']', () => selectTool(k))));
      const rMode = row('モード');
      [['add', '＋追加'], ['subtract', '－削除']].forEach(([k, label]) => rMode.appendChild(mkBtn('l2-mode' + (S.mode === k ? ' on' : ''), label, label + ' [Xで切替]', () => { S.mode = k; renderToolbar(); })));
      const rAdj = row('調整');
      rAdj.appendChild(slider('tol 許容', 1, 120, S.tol, v => S.tol = v));
      rAdj.appendChild(slider('brush 太さ', 2, 120, S.brush, v => S.brush = v));
      const rRef = row('マスク整形');
      [['bg', '背景除去'], ['grow', '拡張'], ['shrink', '収縮'], ['fill', '穴埋め'], ['despeckle', 'ゴミ取'], ['largest', '最大のみ'], ['clear', 'クリア']]
        .forEach(([op, label]) => rRef.appendChild(mkBtn('l2-ref', label, null, () => refine(op))));
      const rChk = row('確認');
      rChk.appendChild(mkBtn('l2-ref', '⚠ 取りこぼし確認', 'シルエットの未割当領域をハイライト', coverageReport));
      tb.appendChild(adv);
    }
    function slider(label, min, max, val, on) {
      const wrap = U.el('label', 'l2-slider'); wrap.appendChild(U.el('span', null, label));
      const inp = U.el('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.value = val;
      const out = U.el('span', 'l2-val', String(val));
      inp.oninput = () => { out.textContent = inp.value; on(+inp.value); }; wrap.appendChild(inp); wrap.appendChild(out); return wrap;
    }

    function renderParts() {
      const panel = refs.panel; U.clear(panel);
      const sorted = L2_RIG.sortedByZ(S.rig).slice().reverse(); // top of list = front
      if (!sorted.length) { panel.appendChild(U.el('div', 'l2-empty', 'まだパーツがありません。左で部位を選び「パーツ化」。')); return; }
      // chest group control: switch 同時 / 交互 jiggle when there are ≥2 chest parts
      if (sorted.filter(p => p.role === 'chest').length >= 2) {
        const bar = U.el('div', 'l2-chest-bar');
        bar.appendChild(U.el('span', null, '胸ぷるぷる'));
        bar.appendChild(btn('同時', () => setChestJiggleMode('sync')));
        bar.appendChild(btn('交互', () => setChestJiggleMode('alt')));
        panel.appendChild(bar);
      }
      sorted.forEach(p => {
        const card = U.el('div', 'l2-part' + (S.selected === p.id ? ' sel' : ''));
        // --- 見出し：id ＋ role ---
        const head = U.el('div', 'l2-part-head');
        head.appendChild(U.el('strong', null, p.id));
        const roleSel = U.el('select', 'l2-role');
        L2_RIG.ROLES.forEach(r => { const o = U.el('option', null, r); o.value = r; if (r === p.role) o.selected = true; roleSel.appendChild(o); });
        roleSel.onchange = () => setRole(p.id, roleSel.value);
        head.appendChild(roleSel);
        card.appendChild(head);
        // --- 基本（常時）：並び順 / ピボット / 反転 / 削除 ＋ 静的トランスフォーム ---
        const row = U.el('div', 'l2-row');
        row.appendChild(btn('▲z', () => moveZ(p.id, 1)));
        row.appendChild(btn('▼z', () => moveZ(p.id, -1)));
        row.appendChild(btn('◎ピボット', () => { S.selected = p.id; S.placingPivot = true; renderParts(); drawOverlay(); status('キャンバスをクリックして「' + p.id + '」のピボットを置く'); }));
        row.appendChild(btn('⇋反転', () => flipPart(p.id, 'h')));
        row.appendChild(btn('🗑', () => deletePart(p.id)));
        card.appendChild(row);
        card.appendChild(mini('opacity', 0, 1, 0.05, p.opacity, v => { p.opacity = v; refreshPreview(); }));
        card.appendChild(mini('scale', 0.3, 2, 0.05, p.scale.x, v => { p.scale.x = v; p.scale.y = v; refreshPreview(); }));
        card.appendChild(mini('rot', -1, 1, 0.02, p.rot, v => { p.rot = v; refreshPreview(); }));
        // --- 詳細トグル（編集・動き。既定は閉。展開状態は S.cardOpen で保持） ---
        const open = S.cardOpen.has(p.id);
        const dtg = U.el('button', 'l2-detail-toggle' + (open ? ' on' : ''), '<span class="l2-caret">▸</span> 詳細（編集・動き）');
        dtg.onclick = (e) => { e.stopPropagation(); if (S.cardOpen.has(p.id)) S.cardOpen.delete(p.id); else S.cardOpen.add(p.id); renderParts(); };
        card.appendChild(dtg);
        if (open) {
          const det = U.el('div', 'l2-part-detail');
          const erow = U.el('div', 'l2-row');
          erow.appendChild(btn('✎再編集', () => reEditPart(p.id)));
          erow.appendChild(btn('↻再パーツ化', () => recommitPart(p.id)));
          erow.appendChild(btn('⧉複製', () => duplicatePart(p.id)));
          det.appendChild(erow);
          const m = p.motion;
          det.appendChild(mini('呼吸', 0, 1, 0.05, m.breathing, v => setNum(p.id, 'motion.breathing', v)));
          det.appendChild(mini('揺れamp', 0, 0.4, 0.01, m.sway.amp, v => setNum(p.id, 'motion.sway.amp', v)));
          det.appendChild(mini('揺れfreq', 0.1, 2, 0.05, m.sway.freq, v => setNum(p.id, 'motion.sway.freq', v)));
          const blink = U.el('label', 'l2-check'); const cb = U.el('input'); cb.type = 'checkbox'; cb.checked = !!m.blinkable; cb.onchange = () => { m.blinkable = cb.checked; refreshPreview(); }; blink.appendChild(cb); blink.appendChild(U.el('span', null, 'まばたき')); det.appendChild(blink);
          // chest-only: ぷるぷる(jiggle) amplitude / speed / phase. phase 0.00=同位相(同時) 0.50=逆位相(交互)
          if (p.role === 'chest') {
            if (!m.jiggle) m.jiggle = L2_RIG.defaultMotionForRole('chest').jiggle;
            det.appendChild(mini('ぷる量', 0, 1.5, 0.05, m.jiggle.amp, v => setNum(p.id, 'motion.jiggle.amp', v)));
            det.appendChild(mini('ぷる速', 0.5, 3, 0.05, m.jiggle.freq, v => setNum(p.id, 'motion.jiggle.freq', v)));
            det.appendChild(mini('位相', 0, 1, 0.05, (m.jiggle.phase || 0) / (Math.PI * 2), v => setNum(p.id, 'motion.jiggle.phase', v * Math.PI * 2), '0=同時 / 0.5=交互'));
          }
          card.appendChild(det);
        }
        card.onclick = (e) => { if (e.target === card || e.target.tagName === 'STRONG') { S.selected = p.id; renderParts(); } };
        panel.appendChild(card);
      });
    }
    function btn(label, on) { const b = U.el('button', 'l2-mini-btn', label); b.onclick = (e) => { e.stopPropagation(); on(); }; return b; }
    function mini(label, min, max, step, val, on, title) {
      const wrap = U.el('label', 'l2-mini'); if (title) wrap.title = title;
      const lab = U.el('span', null, label); if (title) lab.title = title; wrap.appendChild(lab);
      const inp = U.el('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      const out = U.el('span', 'l2-val', (+val).toFixed(2));
      inp.oninput = () => { out.textContent = (+inp.value).toFixed(2); on(+inp.value); };
      wrap.appendChild(inp); wrap.appendChild(out); return wrap;
    }

    // ---------- wire events ----------
    refs.overlay.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMoveCanvas);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', (e) => {
      const edPane = document.getElementById('pane-editor');
      if (edPane && edPane.style.display === 'none') return;   // 編集タブ以外ではホットキー無効（②③での誤作動防止）
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target && e.target.tagName; if (tag && /INPUT|TEXTAREA|SELECT/.test(tag)) return;  // フォーム入力中は無効
      const tmap = { w: 'wand', b: 'brush', e: 'erase', l: 'lasso', r: 'rect' };
      if (tmap[e.key]) { selectTool(tmap[e.key]); e.preventDefault(); }
      else if (e.key === 'x') { S.mode = (S.mode === 'add') ? 'subtract' : 'add'; S.advancedOpen = true; renderToolbar(); e.preventDefault(); }
      else if (e.key === 'Enter') { makePart(); e.preventDefault(); }
      else if (e.key === '[') { S.brush = Math.max(2, S.brush - 4); S.advancedOpen = true; renderToolbar(); e.preventDefault(); }
      else if (e.key === ']') { S.brush = Math.min(120, S.brush + 4); S.advancedOpen = true; renderToolbar(); e.preventDefault(); }
    });

    window.addEventListener('resize', () => { if (S.img) { fitView(); redraw(); } });   // 画面サイズ変更でも収まるよう再フィット
    renderToolbar();
    renderSteps();
    return {
      loadFromImage, loadFromSrc, startPreview, stopPreview, exportRig, fitView, setChestJiggleMode, autoRig,
      // 大プレビュー（app.js所有）が現在のリグを取得する用：startPreview と同じ embed 済みオブジェクトを返す
      serializeForPreview() { return S.rig ? JSON.parse(L2_RIG.serialize(S.rig, { embed: true })) : null; },
      hasRig() { return !!(S.rig && S.rig.parts && S.rig.parts.length); },
      get rig() { return S.rig; }, set rig(r) { S.rig = r; renderParts(); },
      loadRig(rig) { S.rig = rig; S.w = rig.canvas.w; S.h = rig.canvas.h; renderParts(); }
    };
  }

  return { create };
})();
