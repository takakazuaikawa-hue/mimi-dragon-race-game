// =====================================================================
// L2_APP — entry point: tab wiring, drag-drop, demo-dragon, Player tab.
// =====================================================================
(function () {
  const U = L2_UTIL;
  let editor = null, playerCtrl = null;

  function init() {
    // tabs
    const tabEd = U.$('tab-editor'), tabPl = U.$('tab-player');
    const paneEd = U.$('pane-editor'), panePl = U.$('pane-player');
    function show(which) {
      const ed = which === 'editor';
      paneEd.style.display = ed ? '' : 'none';
      panePl.style.display = ed ? 'none' : '';
      tabEd.classList.toggle('on', ed); tabPl.classList.toggle('on', !ed);
      if (ed && editor) editor.stopPreview();
    }
    tabEd.onclick = () => show('editor');
    tabPl.onclick = () => show('player');

    // editor
    editor = L2_ED.create({
      canvas: U.$('ed-canvas'), overlay: U.$('ed-overlay'),
      toolbar: U.$('ed-toolbar'), panel: U.$('ed-parts'),
      status: U.$('ed-status'), previewCanvas: U.$('ed-preview'), steps: U.$('ed-steps')
    });
    window.L2_EDITOR = editor;   // デバッグ/自動テスト用ハンドル（読み取り専用に利用）

    // editor buttons
    U.$('btn-load-test').onclick = () => editor.loadFromSrc('../images/cast/mimi/loading9.png', 'mimi').then(() => { editor.autoRig(); editor.startPreview(U.$('ed-preview')); }).catch(err => alert('テスト画像の読み込みに失敗: ' + err.message + '\nローカルサーバ経由で開いてください。'));
    U.$('btn-demo').onclick = () => loadDemo();
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

    // deep-link affordance: #player plays the demo dragon full-size on load.
    if (location.hash === '#player') { show('player'); U.$('btn-pl-demo').click(); }
    else { show('editor'); loadDemo(); } // editor starts with the demo dragon already rigged
  }

  function loadFile(file) {
    U.fileToDataURL(file).then(durl => editor.loadFromSrc(durl, (file.name || 'dragon').replace(/\.[^.]+$/, '')));
  }
  function loadDemo() {
    // デモドラゴン＝サンプル画像(images/dragon/sample.png)を読み込み、ワンクリック自動リグ→プレビュー。
    // 取得に失敗した場合のみ従来の手続きデモにフォールバック。
    editor.loadFromSrc('../images/dragon/sample.png', 'dragon').then(() => {
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
