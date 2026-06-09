// =====================================================================
// L2_AI — browser-side ML helpers (NO API key; loaded from CDN on demand).
//   removeBackground(img, onStatus) -> { canvas } : RMBG-1.4 high-quality matte.
// transformers.js (@huggingface/transformers) は ESM。初回のみ CDN からライブラリ＋
// モデル(数十MB)を取得しブラウザ内で推論（GitHub Pages の静的配信でも動く＝キー不要）。
// 失敗時(オフライン/非対応)は呼び出し側で従来の四隅フラッド背景除去にフォールバック。
// =====================================================================
const L2_AI = (function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
  let _tf = null, _rmbg = null, _proc = null;

  async function _tflib() {
    if (_tf) return _tf;
    _tf = await import(CDN);
    try { if (_tf.env) _tf.env.allowLocalModels = false; } catch (e) {}
    return _tf;
  }

  async function _ensureRMBG(onStatus) {
    const tf = await _tflib();
    if (_rmbg && _proc) return tf;
    const prog = (p) => {
      if (!onStatus || !p || !p.status) return;
      const pct = (typeof p.progress === 'number') ? ' ' + Math.round(p.progress) + '%' : '';
      onStatus('モデル読込中…' + (p.file ? ' ' + String(p.file).split('/').pop() : '') + pct);
    };
    _rmbg = await tf.AutoModel.from_pretrained('briaai/RMBG-1.4', { progress_callback: prog });
    _proc = await tf.AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
      // 明示config（ハブ側configに依存せず確実に動かす）
      config: {
        do_normalize: true, do_pad: false, do_rescale: true, do_resize: true,
        image_mean: [0.5, 0.5, 0.5], image_std: [1, 1, 1],
        feature_extractor_type: 'ImageFeatureExtractor', resample: 2,
        size: { width: 1024, height: 1024 }
      }
    });
    return tf;
  }

  // 画像(HTMLImageElement)を受け取り、背景を透過した canvas を返す。
  async function removeBackground(img, onStatus) {
    const tf = await _ensureRMBG(onStatus);
    const RawImage = tf.RawImage;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = h;
    const cx = cnv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
    const idata = cx.getImageData(0, 0, w, h);
    onStatus && onStatus('背景を解析中…');
    const raw = new RawImage(idata.data.slice(0), w, h, 4).rgb();   // モデルは3ch入力
    const out = await _proc(raw);
    const res = await _rmbg({ input: out.pixel_values });
    const tensor = res.output || res.logits || res.alphas || (res[Object.keys(res)[0]]);
    const matte = await RawImage.fromTensor(tensor[0].mul(255).to('uint8')).resize(w, h);
    const a = matte.data;                                            // grayscale, length w*h
    for (let i = 0; i < w * h; i++) idata.data[i * 4 + 3] = a[i];    // alpha = matte
    cx.putImageData(idata, 0, 0);
    return { canvas: cnv, width: w, height: h };
  }

  // ---- MediaPipe 姿勢推定（人物の関節検出・キー不要・CDN） ----
  let _pose = null;
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
  async function _ensurePose(onStatus) {
    if (_pose) return _pose;
    onStatus && onStatus('姿勢AIライブラリ読込中…');
    const vision = await import(MP);
    const fileset = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
    onStatus && onStatus('姿勢モデル読込中…');
    _pose = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' },
      runningMode: 'IMAGE', numPoses: 1
    });
    return _pose;
  }
  // 画像→主要関節をピクセル座標で返す。検出失敗 or 両肩/両腰が低信頼なら null（呼び出し側で幾何リグへ）。
  async function detectPose(img, onStatus) {
    const pose = await _ensurePose(onStatus);
    onStatus && onStatus('姿勢を解析中…');
    const res = pose.detect(img);
    const lm = res && res.landmarks && res.landmarks[0];
    if (!lm) return null;
    const need = [11, 12, 23, 24];   // 両肩・両腰は必須
    for (let n = 0; n < need.length; n++) { const k = need[n]; if (!lm[k] || (lm[k].visibility != null && lm[k].visibility < 0.5)) return null; }
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility == null ? 1 : lm[i].visibility });
    return { w: w, h: h, nose: P(0), eyeL: P(2), eyeR: P(5),
      Lsh: P(11), Rsh: P(12), Lel: P(13), Rel: P(14), Lwr: P(15), Rwr: P(16),
      Lhip: P(23), Rhip: P(24), Lkn: P(25), Rkn: P(26), Lank: P(27), Rank: P(28) };
  }

  return { removeBackground, detectPose, _tflib };
})();
