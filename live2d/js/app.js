// =====================================================================
// L2_APP — entry point: tab wiring, drag-drop, demo-dragon, Player tab.
// =====================================================================
(function () {
  const U = L2_UTIL;
  let editor = null, playerCtrl = null, previewCtrl = null;
  const pvOpts = { zoom: 0.92, bgMode: 'transparent', pivots: false, playing: true };  // ②大プレビューの設定（タブ往復で保持）
  let pvResizeRAF = 0;

  function init() {
    // tabs（①エディタ / ②プレビュー(大) / ③再生）
    const tabEd = U.$('tab-editor'), tabPv = U.$('tab-preview'), tabPl = U.$('tab-player');
    const paneEd = U.$('pane-editor'), panePv = U.$('pane-preview'), panePl = U.$('pane-player');
    function show(which) {
      paneEd.style.display = which === 'editor' ? '' : 'none';
      panePv.style.display = which === 'preview' ? '' : 'none';
      panePl.style.display = which === 'player' ? '' : 'none';
      tabEd.classList.toggle('on', which === 'editor');
      tabPv.classList.toggle('on', which === 'preview');
      tabPl.classList.toggle('on', which === 'player');
      // サイドバー小プレビューは編集タブのときだけ動かす
      if (which === 'editor') { if (editor) editor.fitView(); if (editor && editor.hasRig()) editor.startPreview(U.$('ed-preview')); }
      else if (editor) editor.stopPreview();
      // 大プレビューは②のときだけ生成、それ以外は停止
      if (which === 'preview') startLargePreview(); else stopLargePreview();
    }
    window.__l2show = show;   // デバッグ/自動テスト用
    tabEd.onclick = () => show('editor');
    tabPv.onclick = () => show('preview');
    tabPl.onclick = () => show('player');

    // editor
    editor = L2_ED.create({
      canvas: U.$('ed-canvas'), overlay: U.$('ed-overlay'),
      toolbar: U.$('ed-toolbar'), panel: U.$('ed-parts'),
      status: U.$('ed-status'), previewCanvas: U.$('ed-preview'), steps: U.$('ed-steps')
    });
    window.L2_EDITOR = editor;   // デバッグ/自動テスト用ハンドル（読み取り専用に利用）

    // editor buttons
    U.$('btn-load-test').onclick = () => editor.loadFromSrc('../images/cast/mimi/loading9.webp', 'mimi').then(() => { editor.autoRig(); editor.startPreview(U.$('ed-preview')); }).catch(err => alert('テスト画像の読み込みに失敗: ' + err.message + '\nローカルサーバ経由で開いてください。'));
    U.$('btn-demo').onclick = () => loadDemo();
    U.$('btn-ai-bg').onclick = () => editor.aiRemoveBg();
    U.$('btn-ai-rig').onclick = () => editor.aiPoseRig();
    U.$('btn-export-embed').onclick = () => editor.exportRig(true);
    U.$('btn-export-files').onclick = () => editor.exportRig(false);
    U.$('btn-preview').onclick = () => editor.startPreview(U.$('ed-preview'));
    U.$('btn-preview-stop').onclick = () => editor.stopPreview();

    // file input + drag-drop (editor)
    const fileInput = U.$('ed-file');
    fileInput.onchange = () => { const f = fileInput.files[0]; if (f) loadFile(f); };
    U.$('btn-open').onclick = () => fileInput.click();
    setupDrop(U.$('pane-editor'), loadFile);

    // player tab: drop a rig.json (or embed) → animate
    setupDropJSON(U.$('pane-player'), loadRigJSON);
    U.$('pl-file').onchange = () => { const f = U.$('pl-file').files[0]; if (f) f.text().then(loadRigJSON); };
    U.$('btn-pl-open').onclick = () => U.$('pl-file').click();
    U.$('btn-pl-demo').onclick = () => { const rig = L2_DEMO.build(); playRig(L2_RIG.deserialize(JSON.parse(L2_RIG.serialize(rig, { embed: true })))); };
    U.$('pl-pivots').onchange = () => { if (playerCtrl) playerCtrl.setShowPivots(U.$('pl-pivots').checked); };

    // ② preview tab：操作バー（再生/ズーム/背景/ピボット）＋ ⛶拡大 ＋ 戻る
    U.$('btn-enlarge').onclick = () => show('preview');
    U.$('pv-to-editor').onclick = () => show('editor');
    U.$('pv-play').onclick = () => {
      pvOpts.playing = !pvOpts.playing;
      U.$('pv-play').textContent = pvOpts.playing ? '⏸ 一時停止' : '▶ 再生';
      if (previewCtrl) { if (pvOpts.playing) previewCtrl.start(); else previewCtrl.stop(); }
    };
    const pvZoom = U.$('pv-zoom');
    pvZoom.oninput = () => {
      pvOpts.zoom = +pvZoom.value; U.$('pv-zoom-val').textContent = (+pvZoom.value).toFixed(2);
      if (previewCtrl) { previewCtrl.setZoom(pvOpts.zoom); if (!pvOpts.playing) previewCtrl.redraw(); }
    };
    Array.prototype.forEach.call(U.$('pv-bg').querySelectorAll('button'), b => {
      b.onclick = () => {
        pvOpts.bgMode = b.getAttribute('data-bg');
        Array.prototype.forEach.call(U.$('pv-bg').querySelectorAll('button'), x => x.classList.toggle('on', x === b));
        applyPreviewBg();
      };
    });
    U.$('pv-pivots').onchange = () => {
      pvOpts.pivots = U.$('pv-pivots').checked;
      if (previewCtrl) { previewCtrl.setShowPivots(pvOpts.pivots); if (!pvOpts.playing) previewCtrl.redraw(); }
    };
    window.addEventListener('resize', () => {
      if (!isPreviewVisible() || !previewCtrl) return;
      if (pvResizeRAF) return;
      pvResizeRAF = requestAnimationFrame(() => { pvResizeRAF = 0; sizePreviewCanvas(); previewCtrl.layout(); if (!pvOpts.playing) previewCtrl.redraw(); });
    });

    // deep-link: #player=③再生デモ / #preview=②大プレビュー / 既定=①エディタ＋デモ竜
    if (location.hash === '#player') { show('player'); U.$('btn-pl-demo').click(); }
    else if (location.hash === '#preview') { show('editor'); loadDemo().then(() => show('preview')); }
    else { show('editor'); loadDemo(); } // editor starts with the demo dragon already rigged
  }

  function loadFile(file) {
    U.fileToDataURL(file).then(durl => editor.loadFromSrc(durl, (file.name || 'dragon').replace(/\.[^.]+$/, '')))
      .catch(err => alert('画像の読み込みに失敗しました: ' + ((err && err.message) || err)));
  }
  function loadDemo() {
    // デモドラゴン＝サンプル画像(images/dragon/sample.png)を読み込み、ワンクリック自動リグ→プレビュー。
    // 取得に失敗した場合のみ従来の手続きデモにフォールバック。
    return editor.loadFromSrc('../images/dragon/sample.webp', 'dragon').then(() => {
      editor.autoRig();
      editor.startPreview(U.$('ed-preview'));
      U.$('ed-status').textContent = 'サンプル竜を自動リグしました。右で各パーツの role/motion を調整 / 「アイドル再生」で動きを確認。実PNGは「画像を開く」かドラッグ&ドロップで。';
    }).catch(() => {
      const rig = L2_DEMO.build();
      editor.loadRig(L2_RIG.deserialize(JSON.parse(L2_RIG.serialize(rig, { embed: true }))));
      editor.startPreview(U.$('ed-preview'));
      U.$('ed-status').textContent = 'デモドラゴン（手続き生成）を読み込みました。実PNGは「画像を開く」かドラッグ&ドロップで。';
    });
  }

  // ---- ②大プレビュー（app.js所有：editorの現在リグを大画面で再生。サイドバー小プレビューとは別コントローラ） ----
  function isPreviewVisible() { const p = U.$('pane-preview'); return !!(p && p.style.display !== 'none'); }
  function sizePreviewCanvas() {
    const cv = U.$('pv-canvas'); if (!cv) return;
    const stage = cv.parentElement;
    const w = Math.max(320, (stage.clientWidth || 800) - 24);
    const h = Math.max(240, Math.round((window.innerHeight || 800) * 0.70));
    cv.width = w; cv.height = h;                 // bitmap属性のみ設定（L2_PLY.layout() が参照）。
    // 表示サイズは CSS（max-width:100%; height:auto）に任せる＝狭幅でも縦横比を崩さない。
  }
  function applyPreviewBg() {
    const stage = U.$('pv-stage'); if (!stage) return;
    stage.classList.remove('bg-dark', 'bg-light', 'bg-checker');
    if (pvOpts.bgMode === 'dark') stage.classList.add('bg-dark');
    else if (pvOpts.bgMode === 'light') stage.classList.add('bg-light');
    else if (pvOpts.bgMode === 'checker') stage.classList.add('bg-checker');
  }
  function stopLargePreview() { if (previewCtrl) { previewCtrl.stop(); previewCtrl = null; } }
  function startLargePreview() {
    stopLargePreview();
    const cv = U.$('pv-canvas'); if (!cv) return;
    applyPreviewBg();
    U.$('pv-play').textContent = pvOpts.playing ? '⏸ 一時停止' : '▶ 再生';
    if (!editor || !editor.hasRig()) { U.$('pv-status').textContent = 'まず ①エディタ で画像を開き「✨自動リグ」でリグを作成してください。'; return; }
    sizePreviewCanvas();
    const rig = editor.serializeForPreview();
    if (!rig) { U.$('pv-status').textContent = 'リグがありません。'; return; }
    L2_RIG.deserialize(rig);
    L2_RIG.hydrate(rig).then(() => {
      if (!isPreviewVisible()) return;            // hydrate中にタブ離脱→生成しない（孤立コントローラ防止）
      previewCtrl = L2_PLY.createController(cv, { bg: null, zoom: pvOpts.zoom });
      previewCtrl.setRig(rig);
      previewCtrl.setShowPivots(pvOpts.pivots);
      sizePreviewCanvas(); previewCtrl.layout();
      if (pvOpts.playing) previewCtrl.start(); else previewCtrl.redraw();
      U.$('pv-status').textContent = 'プレビュー中: ' + (rig.name || 'rig') + '（' + rig.parts.length + 'パーツ）。カーソルで視線が動きます。' + (pvOpts.playing ? '' : '（一時停止中）');
      window.__L2_PV = () => previewCtrl;          // デバッグ/自動テスト用
    }).catch(e => { U.$('pv-status').textContent = 'プレビューの生成に失敗: ' + e.message; });
  }

  function loadRigJSON(text) {
    try { const rig = L2_RIG.deserialize(text); playRig(rig); }
    catch (e) { alert('rig.json の読み込みに失敗: ' + e.message); }
  }
  function playRig(rig) {
    const v = L2_RIG.validate(rig);
    if (!v.ok) { alert('検証エラー: ' + v.errors.join('\n')); return; }
    L2_RIG.hydrate(rig).then(() => {
      const canvas = U.$('pl-canvas');
      if (playerCtrl) playerCtrl.stop();
      playerCtrl = L2_PLY.createController(canvas, { zoom: 0.92 });
      playerCtrl.setRig(rig); playerCtrl.setShowPivots(U.$('pl-pivots').checked); playerCtrl.start();
      U.$('pl-status').textContent = 'アイドル再生中: ' + rig.name + '（' + rig.parts.length + 'パーツ）。カーソルで視線が動きます。';
    }).catch(e => alert('画像のhydrateに失敗: ' + e.message));
  }

  // ---- drag/drop helpers ----
  function setupDrop(node, onFile) {
    node.addEventListener('dragover', e => { e.preventDefault(); node.classList.add('drag'); });
    node.addEventListener('dragleave', () => node.classList.remove('drag'));
    node.addEventListener('drop', e => {
      e.preventDefault(); node.classList.remove('drag');
      const f = e.dataTransfer.files[0]; if (f && /image\//.test(f.type)) onFile(f);
    });
  }
  function setupDropJSON(node, onText) {
    node.addEventListener('dragover', e => { e.preventDefault(); node.classList.add('drag'); });
    node.addEventListener('dragleave', () => node.classList.remove('drag'));
    node.addEventListener('drop', e => {
      e.preventDefault(); node.classList.remove('drag');
      const f = e.dataTransfer.files[0]; if (f) f.text().then(onText);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
