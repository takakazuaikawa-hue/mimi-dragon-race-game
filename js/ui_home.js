// =============================================================================
// ui_home.js — ホーム（配信風トップ）画面（CODEMAP §6・分割第4弾）。
// =============================================================================
// ★ui_render.js から無改変で抽出：renderHome ＋ 専用helper（startMimiIdle / startDragonWarp /
//   _dailyMissionText ＋ _mimiGaze / _mimiIdleRAF）。中身は一切変えていない（686行を丸ごと移動）。
//   renderHome が呼ぶものは全てグローバル共有で不変（renderMeals/renderGoals=ui_meta、renderAssets=ui_assets、
//   renderStory=ui_story、renderMall/renderSettings/showMushinOverlay=ui_render、epilogue_engine 等は call-time）。
//   startDragonWarp/startMimiIdle は dragon_live2d.js からも参照されるがグローバルなので不変。
// =============================================================================

// ホームのミミのアイドル演出（研究反映：Inochi2D/Live2D系の手法を参考）。
// 多重サイン呼吸（非整数比で非反復）＋体重移動の揺れ＋位相ずらし＋バネ式視線追従。
// 単一rAFループで全軸を合成。ホームを離れる/要素が消えると自動停止（リーク無し）。表示演出のみ。
let _mimiGaze = { tx: 0, ty: 0, cx: 0, cy: 0, vx: 0, vy: 0 };
let _mimiIdleRAF = null;
function startMimiIdle(frame, img) {
  if (_mimiIdleRAF) { cancelAnimationFrame(_mimiIdleRAF); _mimiIdleRAF = null; }
  const amp = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? 0 : 1;
  const TAU = Math.PI * 2;
  function loop(t) {
    if (!document.contains(frame) || state.ui.screen !== "home") { _mimiIdleRAF = null; return; }
    const s = t / 1000;
    // 呼吸：周期4.5sと5.3sの非整数比サインを合成 → 機械的な反復に聞こえない有機的な揺らぎ
    const breath = Math.sin(s * TAU / 4.5) * 0.6 + Math.sin(s * TAU / 5.3) * 0.4;   // -1..1
    const sway = Math.sin(s * TAU / 7.0 + 0.6);                                      // 体重移動（横・位相ずらし）
    const rot = Math.sin(s * TAU / 9.0 + 1.2);                                       // 体のゆっくりした傾き
    // 視線：バネ（剛性k・減衰dmp）でカーソルへ寄り、離すと少しオーバーシュートして戻る
    const k = 0.08, dmp = 0.82;
    _mimiGaze.vx += (_mimiGaze.tx - _mimiGaze.cx) * k; _mimiGaze.vx *= dmp; _mimiGaze.cx += _mimiGaze.vx;
    _mimiGaze.vy += (_mimiGaze.ty - _mimiGaze.cy) * k; _mimiGaze.vy *= dmp; _mimiGaze.cy += _mimiGaze.vy;
    const tx = (sway * 2.2 + _mimiGaze.cx * 6) * amp;
    const ty = (-breath * 1.1 + _mimiGaze.cy * 4) * amp;
    const rz = (rot * 0.6 + _mimiGaze.cx * 1.6) * amp;
    frame.style.transform = "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) rotate(" + rz.toFixed(2) + "deg)";
    if (img) { const sc = 1 + (breath * 0.5 + 0.5) * 0.02 * amp; img.style.transform = "scaleY(" + sc.toFixed(4) + ")"; }
    _mimiIdleRAF = requestAnimationFrame(loop);
  }
  _mimiIdleRAF = requestAnimationFrame(loop);
}

// ソフトボディ・ワープ（研究反映：Live2Dの bend ＝帯分割＋累進オフセットの考え方）。
// 透過PNGをcanvasに縦帯で分割し、端（羽/尾）ほど大きく上下に波打たせる＋ゆるい呼吸スケール。
// ドラゴン(ref.pngは透過)に適用。単一rAF・ホーム離脱で自動停止・prefers-reduced-motion配慮。表示のみ。
function startDragonWarp(canvas, img, screen) {
  if (canvas._warpRAF) cancelAnimationFrame(canvas._warpRAF);   // per-canvas RAF＝複数の竜(ホーム/レース)が互いに干渉しない
  const SCR = screen || "home";   // どの画面で動かすか（home / race_run など）。画面離脱で自動停止
  const reduce = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const TAU = Math.PI * 2, STRIPS = 30, ctx = canvas.getContext("2d");
  // ref.png のドラゴンは顔が右側。顔は剛体（無歪み）のまま、ワープは顔から遠いほど（尾・羽の先）
  // u² で増やす（顔=root）。全体は僅かな回転＋上下＋呼吸の“剛体”モーションで生命感を出す＝顔は歪まない。
  const FACE_AT = 1;   // 0=左 / 1=右（このドラゴンは右が顔）
  function draw(t) {
    if (!document.contains(canvas) || state.ui.screen !== SCR) { canvas._warpRAF = null; return; }
    const W = canvas.width, H = canvas.height, iw = img.naturalWidth || W, ih = img.naturalHeight || H, s = t / 1000;
    ctx.clearRect(0, 0, W, H);
    const breath = reduce ? 0 : (Math.sin(s * TAU / 4.0) * 0.5 + Math.sin(s * TAU / 5.1) * 0.5);
    // 剛体モーション（顔を歪めない）：下中心を軸にごく僅か回転＋上下＋呼吸スケール
    const rot = reduce ? 0 : Math.sin(s * TAU / 6.5) * 0.9 * Math.PI / 180;   // ±0.9°
    const bob = reduce ? 0 : Math.sin(s * TAU / 4.3) * 1.4;                    // ±1.4px
    const sc = 1 + (reduce ? 0 : (breath * 0.5 + 0.5) * 0.012);
    ctx.save();
    ctx.translate(W / 2, H * 0.96); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-W / 2, -H * 0.96 + bob);
    // 局所ベンド：顔(root)は amp 0、顔から遠いほど u² で増加 → 尾・羽の先だけ柔らかく揺れる
    const isw = iw / STRIPS, dsw = W / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const u = i / (STRIPS - 1), fromFace = Math.abs(u - FACE_AT);            // 0=顔 .. 1=反対端
      const amp = reduce ? 0 : 4.2 * fromFace * fromFace;
      const dy = amp * Math.sin(s * 0.8 * TAU / 3 + u * 1.3 * TAU);
      ctx.drawImage(img, i * isw, 0, isw, ih, i * dsw, dy, dsw + 0.7, H);
    }
    ctx.restore();
    canvas._warpRAF = requestAnimationFrame(draw);
  }
  canvas._warpRAF = requestAnimationFrame(draw);
}

// ③ デイリーミッション（ライブ告知風・表示のみ＝報酬なし・レース数値に非干渉）。
// 日付が変わったらその時点の戦績を基準にリセット。コメント送信は _youSay が记録。
function _dailyMissionText() {
  const p = state.player;
  let today = ""; try { today = new Date().toISOString().slice(0, 10); } catch (e) {}
  if (!p.dailyM || p.dailyM.date !== today) {
    p.dailyM = { date: today, races0: p.completedRaces || 0, wins0: p.wins || 0, cmt: 0 };
    if (typeof saveGame === "function") saveGame();
  }
  const m = p.dailyM;
  const r = Math.min(1, (p.completedRaces || 0) - m.races0);
  const w = Math.min(1, (p.wins || 0) - m.wins0);
  const mk = (v, label) => (v ? "✓" : "") + label + ` ${v}/1`;
  // 💬コメントは配信モード限定＝静かモードでは項目を出さない（永久0/1の“詰み日課”に見えるのを防ぐ）。
  const live = (typeof broadcastOn === "function") && broadcastOn();
  const items = [mk(r, "出走"), mk(w, "単勝")];
  let done = r + w, need = 2;
  if (live) { const c = Math.min(1, m.cmt || 0); items.push(mk(c, "💬コメント")); done += c; need = 3; }
  return `きょうのミッション　${items.join("・")}` + (done >= need ? "　🎉コンプ！" : "");
}

function renderHome() {
  state.ui.screen = "home";
  document.body.classList.remove("title-mode");
  const app = beginScreen();
  document.body.classList.add("home-mode");   // グローバル#headerを隠す（資産/ランクはホーム独自ヘッダー＋フロートへ集約）
  // ★ミミを「枠の中」でなく「UIの後ろ」に：立ち絵ステージのクリップを開き(#app.hl-clip .hl-stage=overflow visible)、
  //   代わりに枠(#app)側でクリップする。ドック(z5)が脚に重なって隠すので足元が硬く切れず、ミミがUIの背後に立つ。
  //   ★home限定（beginScreenでhl-clipを外す＝他画面はoverflow:autoのままスクロール可能）。_fitHlで枠にぴたり収まる前提。
  app.classList.add("hl-clip");
  const p = state.player;
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  // daily login reward — checked once per session, shown just after home paints
  // ★D4解消（FTUE保護）：初出走前は文脈のない報酬ポップを出さない＝初回導線（→レースへ）に集中させる。
  let _doGreet = false;   // 挨拶はVNではなく“配信の吹き出し”で（大立ち絵と二重にしない）
  if (!window._mimiLoginChecked && (p.completedRaces || 0) >= 1) {
    window._mimiLoginChecked = true;
    try {
      const _lb = (typeof checkDailyLogin === "function") && checkDailyLogin();
      if (_lb) setTimeout(() => showLoginBonus(_lb), 420);
      else _doGreet = true;
    } catch (e) {}
  } else if (!window._mimiLoginChecked) {
    window._mimiLoginChecked = true; _doGreet = true;   // 新規：ログボは出さないが挨拶の吹き出しは出す
  }
  const rankLabel = (RANKS[p.rank] && RANKS[p.rank].label) || "";
  const winRate = p.completedRaces > 0 ? Math.round((p.wins / p.completedRaces) * 100) : 0;
  const total = assetsPeak(state);   // 次の解放までの進捗＝到達最高（解放条件と同じ物差し）
  const nextT = (typeof nextAssetThreshold === "function") ? nextAssetThreshold(total) : null;
  const fillPct = nextT ? Math.max(5, Math.min(100, total / nextT * 100)) : 100;

  // ===== TikTokライブ風ホーム =====================================
  // コンセプト：ミミの“配信”を見ている画面。背景ぶち抜き（全画面）＋大立ち絵＋
  // ライブ演出（LIVEバッジ/視聴者数/流れるコメント/ハート）。すべて表示専用 ——
  // レース数値・進行・経済には一切干渉しない。ホーム離脱でタイマー/演出は自動停止。
  // ★2026-07：旧「📌ピン」（nextGoals()＝ランク進捗/暮らし段階の別系統）は撤去。
  //   🎯目標チップ（goals.js の GOALS＝rankUp/oneRoom 等を含む一本化された優先度付きシステム）と
  //   完全に内容が重複しており、「次にやること」を2つの別チップで同時に主張する“進捗表示の重複”
  //   （リサーチ済＝hierarchy collapse）になっていたため。nextGoals()自体は結果画面(recap)の
  //   「次の目標」表示で今も使うので関数は残す＝ホームでの呼び出しだけ削除。
  let eqTitle = "";
  try {
    const _eq = p.equippedTitle;
    if (_eq && typeof ACTIVE_SKILLS !== "undefined") {
      const _sk = ACTIVE_SKILLS.find(s => s.id === _eq);
      if (_sk && p.activeSkills && (p.activeSkills[_sk.id] || 0) >= _sk.levels.length) eqTitle = _sk.title;
    }
  } catch (e) {}

  // ── ホーム背景：複数ロケーションの日替わりローテーション＋昼夜切替＋接地キャリブレーション ──
  // 追加方法：images/homebg/<id>_day.webp / <id>_night.webp を置き、HOME_BGS に1行追加するだけ。
  // floor = 画像内の「床の接地ライン」位置（上端からの比率）。ミミの足元がこのラインに合うよう
  // 背景の縦位置を自動調整する（±4%の遊びの範囲・cover縦余白を利用。仕様は docs/HOME_BG_SPEC.md）。
  // focusX＝画像内の「見せたい横位置」（左端0〜右端1・実測）。縦持ちの狭い横幅では cover の
  //   既定(中央50%)だと構図の主役（右1/3の火山）が画面外へ丸ごと消えることが多い＝背景が画面サイズと
  //   合っていない問題の本体。object-position で「その横位置を優先して見せる」よう静的に補正する。
  const HOME_BGS = [
    // floorDay/floorNight＝床の接地ライン（上端からの比率・実測）。無ければ floor。
    // 屋外ロケ（日替わりローテーション）。images/homebg/<id>_{day,night}.webp。
    { id: "balcony", day: "images/homebg/balcony_day.webp", night: "images/homebg/balcony_night.webp", floorDay: 0.74, floorNight: 0.74, focusX: 0.77 },
    { id: "beach",   day: "images/homebg/beach_day.webp",   night: "images/homebg/beach_night.webp",   floorDay: 0.64, floorNight: 0.64, focusX: 0.80 },
    { id: "market",  day: "images/homebg/market_day.webp",  night: "images/homebg/market_night.webp",  floorDay: 0.62, floorNight: 0.60, focusX: 0.71 },
    { id: "onsen",   day: "images/homebg/onsen_day.webp",   night: "images/homebg/onsen_night.webp",   floorDay: 0.73, floorNight: 0.72, focusX: 0.79 },
    { id: "stable",  day: "images/homebg/stable_day.webp",  night: "images/homebg/stable_night.webp",  floorDay: 0.60, floorNight: 0.60, focusX: 0.78 },
    { id: "mall",    day: "images/homebg/mall_day.webp",    night: "images/homebg/mall_night.webp",    floorDay: 0.64, floorNight: 0.63, focusX: 0.71 },
    // 自宅＝進行度（総資産レベル0..5）で豪華な部屋へ引っ越し。images/homebg/myroom_t<lvl>_{day,night}.webp。
    { id: "myroom", myroom: true },
  ];
  const MYROOM_FLOORS = [0.63, 0.63, 0.63, 0.66, 0.72, 0.64];   // t0..t5（実測）
  const MYROOM_FOCUS_X = 0.80;   // 自宅は窓越しの火山がさらに右寄り（実測t0/t3の平均目安）
  const FOCUS_X_DEFAULT = 0.76;  // 未実測フォールバック画像用
  // ★縦構図の背景（全景が縦に収まる）。横16:9は縦持ちで左右が大きく落ち全景が見えない＝背景が生かせない問題への対応。
  //   当面デモとして常時表示。photoreal縦版を images/homebg/island_portrait_{day,night}.webp で差し替え可
  //   （docs/HOME_BG_SPEC.md「縦構図」節の仕様/プロンプト）。PORTRAIT_DEMO=false で従来の横ロケ・ローテに戻る。
  const PORTRAIT_DEMO = false;
  const ISLAND_PORTRAIT = { id: "island", portrait: true,
    day: "images/homebg/island_portrait_day.svg", night: "images/homebg/island_portrait_night.svg",
    floorDay: 0.80, floorNight: 0.80 };
  const bg = el("div", "hl-bg");
  bg.innerHTML = `<img class="hl-bg-img" alt="" decoding="async"><div class="hl-bg-scrim"></div>`;
  (function () {
    let hour = 20, dayIdx = 0;
    try { const now = new Date(); hour = now.getHours(); dayIdx = Math.floor(now.getTime() / 86400000); } catch (e) {}
    const night = !(hour >= 6 && hour < 18);
    // 配分：偶数日＝自宅(myroom・ホームベース＝引っ越し進行を見せる)／奇数日＝屋外ロケを順番に。
    const myroomEntry = HOME_BGS.find(b => b.myroom);
    const outdoor = HOME_BGS.filter(b => !b.myroom);
    const set = PORTRAIT_DEMO ? ISLAND_PORTRAIT
      : (dayIdx % 2 === 0 && myroomEntry) ? myroomEntry : outdoor[(dayIdx >> 1) % outdoor.length];
    let floorUsed, focusUsed, chain;
    if (set.myroom) {
      // 自宅：現在の総資産レベルの部屋→無ければ下の段→最後はバルコニー/旧背景へ
      const lvl = (typeof roomLevel === "function") ? roomLevel() : 0;
      const tiers = k => { const a = []; for (let t = lvl; t >= 0; t--) a.push(`images/homebg/myroom_t${t}_${k}.webp`); return a; };
      floorUsed = MYROOM_FLOORS[lvl] || 0.74;
      focusUsed = MYROOM_FOCUS_X;
      chain = night
        ? [...tiers("night"), "images/homebg/balcony_night.webp", "images/home_bg.webp", "images/racebg/fire.webp"]
        : [...tiers("day"), "images/homebg/balcony_day.webp", "images/home_bg_day.webp", "images/home_bg.webp", "images/racebg/fire.webp"];
    } else {
      floorUsed = (night ? set.floorNight : set.floorDay) || set.floor || 0.74;
      focusUsed = set.focusX || FOCUS_X_DEFAULT;
      chain = night
        ? [set.night, "images/home_bg.webp", "images/racebg/fire.webp"]
        : [set.day, set.night, "images/home_bg_day.webp", "images/home_bg.webp", "images/racebg/fire.webp"];
    }
    const im = bg.querySelector(".hl-bg-img");
    if (set.portrait) im.classList.add("portrait");   // 縦構図＝素直なcover（接地はSVG側のfloorで設計）
    else im.style.objectPosition = (focusUsed * 100).toFixed(0) + "% 50%";   // 横位置の再フレーミング（画面幅が狭くても主役を切らない）
    let i = 0;
    im.onerror = () => { i++; if (i < chain.length) im.src = chain[i]; };
    // 接地キャリブレーション：画像の床ラインをミミの足元へ（縦のcover余白=±6%内でだけ動かす）
    // ★座標系は「枠(#app)基準」。旧実装は window.innerWidth/Height 基準だったため、PCの固定縦枠
    //   （ウィンドウは横長・枠は453px）では常に「横長クロップ」扱いで早期returnし、接地合わせが
    //   一度も走らず部屋ティアによって足元が浮いた／めり込んだ（ユーザー報告「キャラが浮いてる」）。
    function calibrate() {
      if (set.portrait) { im.style.top = ""; return; }   // 縦構図はcover任せ＝接地はSVGのfloor(約78%)で設計
      try {
        // ★座標系＝背景画像の入れ物(.hl-bg)そのもの。im の top はこの箱基準なので、
        //   window基準(旧)や#app基準(暫定)のような座標系ズレが原理的に起きない（PC枠/スマホ共通）。
        const box = im.parentElement.getBoundingClientRect();
        const boxH = box.height * 1.12, boxW = box.width * 1.12;   // .hl-bg-img = 箱の112%
        if (!im.naturalWidth || !box.height) return;
        if ((boxW / boxH) >= (im.naturalWidth / im.naturalHeight)) { im.style.top = ""; return; }   // 横長クロップ時は既定のまま
        const mimiEl = document.querySelector(".hl-mimi");
        if (!mimiEl) return;
        const feet = mimiEl.getBoundingClientRect().bottom - box.top;   // 箱内Y座標
        let top = feet - floorUsed * boxH;                     // 床ライン(floorUsed)が足元に来るtop(px)
        top = Math.max(-0.12 * box.height, Math.min(0, top));  // 画像が箱から剥がれない範囲にクランプ
        im.style.top = top + "px";
      } catch (e) {}
    }
    im.onload = () => { requestAnimationFrame(calibrate); setTimeout(calibrate, 450); };
    if (window._hlBgCal) window.removeEventListener("resize", window._hlBgCal);
    window._hlBgCal = calibrate;
    window.addEventListener("resize", calibrate);
    im.src = chain[0];
  })();
  app.appendChild(bg);

  const wrap = el("div", "hl");
  // 1画面フィット：dvh/vhは環境差が大きい（WebViewで実視界より小さく解決される例あり）ので実測で確定。
  // ★基準は「実際の枠(#app)の内寸」＝PCの固定9:16フレームでは innerHeight(全ビューポート)より小さい。
  //   旧実装は window.innerHeight-30 で組んでいたため PC枠(#app=836)より高い880になり、はみ出して
  //   スクロールバーが出ていた（ユーザー指摘）。#app の client 高さ−上下padding に合わせる（枠にぴたり収まる）。
  // ★スマホ実測バグの根治（2026-07-18）：#app はスマホでは高さ指定が無く「中身の高さ」になる。
  //   それを基準に .hl の高さを決めると自己参照になり、初回描画のたまたまの値（実測555px）で
  //   固定→UIが上に圧縮・下半分が床だけ・ミミが浮く（ユーザー報告）。
  //   → PC枠(min-width:540 の 9:16 端末化)のときだけ #app 内寸を使い、スマホは実ビューポート基準。
  function _fitHl() {
    var frame = document.getElementById("app");
    var framed = !!(window.matchMedia && window.matchMedia("(min-width: 540px)").matches);
    var h;
    if (framed && frame && frame.clientHeight) {
      var fcs = getComputedStyle(frame);
      h = frame.clientHeight - (parseFloat(fcs.paddingTop) || 0) - (parseFloat(fcs.paddingBottom) || 0);
    } else {
      h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
      if (frame) {
        var fr = frame.getBoundingClientRect();
        h -= Math.max(0, fr.top);   // ヘッダー等で枠が下がっている分
        var fcs2 = getComputedStyle(frame);
        h -= (parseFloat(fcs2.paddingTop) || 0) + (parseFloat(fcs2.paddingBottom) || 0);
      } else {
        h -= 30;
      }
    }
    wrap.style.minHeight = Math.max(420, h) + "px";
  }
  _fitHl();
  if (window._hlResize) window.removeEventListener("resize", window._hlResize);
  window._hlResize = _fitHl;
  window.addEventListener("resize", _fitHl);

  // ── ヘッダー（バー型・ブランド入り）：🐲ブランド｜プロフィール(称号切替)｜資産情報｜相棒ボタン｜⋯
  const top = el("div", "hl-top");
  top.appendChild(el("div", "hl-brand", `<span class="hl-brand-crest">🐲</span><b><i>ミミ</i>のドラゴンレース紀行</b>`));
  const prof = el("button", "hl-prof");
  // ヘッダー端正化：詰め込みで名前が「予想家ミ」に切れていたのを解消。
  //  ①名前は単独行で必ず全表示 ②ランクはアバター角のバッジへ（テキスト行から外す）
  //  ③2行目は称号のみ（タップ＝称号切替と一致＝一貫性）。杯名/連勝は暮らしで見る。
  prof.innerHTML =
    `<span class="hl-prof-av">🐰<i class="hl-prof-lv" title="プレイヤーランク">${p.rank}</i></span>` +
    `<span class="hl-prof-tx"><b>予想家ミミ</b>` +
    `<small><i class="hl-prof-title">🏅${eqTitle || "称号"}<span class="hl-prof-caret">▾</span></i>${p.streak >= 2 ? ` <span class="hl-prof-streak">🔥${p.streak}</span>` : ""}</small></span>`;
  prof.title = "取得済みの称号を切り替える／ランク" + p.rank + (rankLabel ? "・" + rankLabel : "");
  prof.onclick = () => showTitleSwitcher();
  top.appendChild(prof);

  // 資産情報をヘッダーへ（コイン＋総資産バー・タップで暮らし）
  const money = el("button", "hl-money");
  money.innerHTML =
    `<span class="hl-money-coin">🪙 <b>${fmtCoins(p.coins)}</b></span>` +
    `<span class="hl-money-as"><span class="t">総資産 <b>${fmtCoins(total)}</b></span>` +
      `<span class="bar"><span style="width:${fillPct}%"></span></span></span>`;
  money.title = "暮らし（総資産）へ";
  money.onclick = () => renderAssets();
  top.appendChild(money);

  // E1（docs/HUNGER_ECONOMY_DESIGN.md）：🍖おなかピル。出走で減り・ごはんで回復。
  // 25以下で赤＝「食べないと走れない」の予告。タップで🍽ごはんへ。
  if (typeof hungerGet === "function") {
    const _hg = hungerGet();
    const hpill = el("button", "hl-hunger" + (_hg <= 25 ? " low" : ""), `🍖<b>${_hg}</b>`);
    hpill.title = "おなか（出走で減る・ごはんで回復）";
    hpill.onclick = () => renderMeals();
    top.appendChild(hpill);
  }

  // （相棒ドラゴンのヘッダーボタンは不要のため撤去：ユーザー指定。竜canvasのループも起動しなくなる）

  // 🔊 音量＝ホームはBGMが鳴るので、深いメニューに潜らず“すぐ”調整できるよう上部に常設（1タップでパネル）。
  if (typeof showVolumePanel === "function") {
    const _muted = (window.Sfx && Sfx.isMuted && Sfx.isMuted());
    const volBtn = el("button", "hl-sys hl-vol", _muted ? "🔇" : "🔊");
    volBtn.title = "音量を調整"; volBtn.style.marginLeft = "auto";
    volBtn.onclick = () => showVolumePanel();
    top.appendChild(volBtn);
  }

  const sysWrap = el("div", "hl-syswrap");
  const sysBtn = el("button", "hl-sys", "⋯");
  const sysDd = el("div", "hl-dd hidden");
  const ddMoney = el("button", null, "💰 お金のしくみ");
  ddMoney.onclick = () => { sysDd.classList.add("hidden"); showMoneyMap(); };
  sysDd.appendChild(ddMoney);
  const ddTitle = el("button", null, "🏠 タイトルへ"); ddTitle.onclick = () => renderTitle();
  // ⛶ 全画面（Android Chrome等＝ステータスバーごと隠せる。iOS Safariは非対応のため非表示）
  if (document.documentElement.requestFullscreen) {
    const ddFs = el("button", null, "⛶ 全画面 切り替え");
    ddFs.onclick = () => {
      try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {}
      sysDd.classList.add("hidden");
    };
    sysDd.appendChild(ddFs);
  }
  // H1: 設定/シェアをヘッダー⋯へ常設（配信モードのタブバー統合の受け皿・静かモードでも便利）
  const ddSet = el("button", null, "⚙️ 設定");
  ddSet.onclick = () => { sysDd.classList.add("hidden"); renderSettings(); };
  const ddShare = el("button", null, "📣 友達にシェア");
  ddShare.onclick = () => { sysDd.classList.add("hidden"); shareGameInfo(); };
  sysDd.appendChild(ddSet); sysDd.appendChild(ddShare);
  const ddReset = el("button", null, "🔄 データをリセット");
  ddReset.onclick = () => { if (confirm("プレイヤー状態をリセットしますか？")) { resetGame(); updateHeader(); renderHome(); } };
  sysDd.appendChild(ddTitle); sysDd.appendChild(ddReset);
  sysBtn.onclick = (e) => { e.stopPropagation(); sysDd.classList.toggle("hidden"); };
  sysWrap.appendChild(sysBtn); sysWrap.appendChild(sysDd);
  top.appendChild(sysWrap);
  wrap.appendChild(top);

  // ── ステージ：ミミの大立ち絵（中央やや右・タップ＝モール）＋竜マスコット＋コメント＋ハート
  const stage = el("div", "hl-stage");
  const oid = (typeof currentOutfitId === "function") ? currentOutfitId() : "buniqro";
  // 外側=配置（left/translateX）・内側=アイドル演出のtransform先 — 競合させない
  const mimi = el("div", "hl-mimi");
  const mimiIn = el("div", "hl-mimi-in");
  // 基本はデフォルト表情。flipラッパー＝カード回転演出用（アイドルtransformとは分離）
  const _defSrc = (typeof outfitImg === "function") ? outfitImg(oid, "default") : "";
  const _smileSrc = (typeof outfitImg === "function") ? outfitImg(oid, "smile") : "";
  mimiIn.innerHTML =
    "<div class='hl-mimi-flip'><img alt='ミミ' src='" + _defSrc + "' onerror=\"this.onerror=null;this.src='" + _smileSrc + "'\"></div>";
  mimi.appendChild(mimiIn);
  // 本体タップ＝ミミの反応（声＋表情＋ハート／配信者をタップ＝リアクションの作法）。
  // 以前は本体タップ＝きせかえビューアだったが「毎回ビューアが開いて煩わしい」ため反応に変更。
  // きせかえ（鑑賞＆無料着替え）は下の専用👗ボタンから（モールはナビ🛍️とビューア内「モールで買う」）。
  mimi.title = "タップでミミが反応";
  mimi.onclick = (e) => { e.stopPropagation(); try { _mimiTalk(); } catch (err) {} };
  stage.appendChild(mimi);
  stage.appendChild(el("div", "hl-topscrim"));   // ★上端スクリム（目標/LIVEをクリーンな面に載せる・下端と対称）
  // 👗 きせかえ＝明示ボタン。ラベルに“今の衣装名”を出して「表示（今の衣装）＋操作（着替え）」の二役に。
  const _curOutfit = (typeof outfitById === "function") ? outfitById(oid) : null;
  const _outfitNm = (_curOutfit && _curOutfit.name) ? _curOutfit.name : "きせかえ";
  const dressBtn = el("button", "hl-dress");
  // ★デザイン刷新：立ち絵中央に浮いていた「衣装名つきラベル」→ 右下の小さな👗アイコンへ（入力行の面に統合）。
  dressBtn.innerHTML = `<span class="hl-dress-ic"><img src="images/nav/outfit.svg?v=20260715j" alt=""></span>`;
  dressBtn.title = `きせかえ（いまの衣装：${_outfitNm}）`;
  dressBtn.onclick = (e) => { e.stopPropagation(); if (typeof showMimiViewer === "function") showMimiViewer(); };
  stage.appendChild(dressBtn);

  // ★配信モード判定：スマホ購入(第4話マクラ後)で配信ホーム化。静かモードでは LIVE/視聴者/フォロワー/
  //   コメント入力/ハート/ギフト/SNS を出さず、立ち絵・独り言・背景・目標・村人の声だけ残す。docs/PROGRESSION_DESIGN.md
  const broadcast = (typeof broadcastOn === "function") ? broadcastOn() : true;
  const _metMakura = (typeof getStoryFlag === "function") && getStoryFlag("metMakura");

  // ★top overlay ＝ 目標チップ(左・可変幅)＋LIVE帯(右・自然幅・優先) を1本の flex 行に収める。
  //   これで帯にフォロワーを戻しても、数値がいくら大きくても帯は必ず全部見え、目標側が幅を譲って
  //   省略表示になる＝枠外はみ出しが原理的に起きない（ユーザー指摘＝フォロワーは帯に必要）。goalBtn は下で append。
  const topRow = el("div", "hl-toprow");
  stage.appendChild(topRow);
  let viewersEl = null;
  if (broadcast) {
    const floatBox = el("div", "hl-float");
    const _folV = 800 + Math.floor(((state.assets && state.assets.fameValue) || 0) * 2) + p.completedRaces * 15 + p.wins * 40;
    const _fmtF = v => v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString("ja-JP");
    // ★TikTok Live 右上クラスタ：赤LIVEバッジ＋ガラスの視聴者ピル（重なった視聴者アバター＋👁人数＋💗フォロワー）。
    //   横一列・コンパクト＝TikTokの「配信を見ている観客」感（縦積みのスタッツ盤面から戻す・ユーザー指摘）。
    floatBox.innerHTML =
      `<span class="hl-live"><i class="hl-live-dot"></i>LIVE</span>` +
      `<span class="hl-vpill">` +
        `<span class="hl-avs"><i></i><i></i><i></i></span>` +
        `<span class="hl-float-v">👁 <b></b></span>` +
        `<span class="hl-float-fol">💗 <b>${_fmtF(_folV)}</b></span>` +
      `</span>`;
    viewersEl = floatBox.querySelector(".hl-float-v b");
    topRow.appendChild(floatBox);
  }

  // 🎯 目標（クエスト）チップ：ステージ左上に常設＝「いま次にやること」を1つだけ表示。
  //   ★優先順位：⚔️最終決戦 ＞ 🙏無心(0コイン) ＞ ☄️絶滅メーター(綱引き中) ＞ 🎯通常の目標。
  //   無心/最終決戦も「必ず次にやること」なのでここに統合（ユーザー指摘）＝別CTAは出さない＝ミミの上もスッキリ・立ち位置不変。
  //   チップはステージ左上の絶対配置＝出入りしてもレイアウト（ミミ/ドック）を一切動かさない。表示専用。
  {
    const _epOn = (typeof epilogueOn === "function") && epilogueOn();
    const _ep = _epOn ? epData() : null;
    const _broke = p.coins <= 0;
    let _title = null, _cls = "hl-goal", _onclick = null;
    // ★単一行に簡素化（ユーザー指摘＝もっとシンプルに入りきるように）：アイコン＋やること＋常設の▸だけ。
    //   長いときは末尾を…省略し▸は常に残る（flex行で幅を譲る側＝LIVE帯を必ず優先表示）。
    if (_epOn && _ep.finalReady) {
      _cls += " hl-goal--act hl-goal--final";
      _title = "⚔️ 最終決戦へ";
      _onclick = () => { if (typeof startFinalBattle === "function") startFinalBattle(); };
    } else if (_broke) {
      _cls += " hl-goal--act hl-goal--broke";
      _title = "🙏 無心する";
      _onclick = () => { if (typeof showMushinOverlay === "function") showMushinOverlay(); };
    } else if (_metMakura && !broadcast) {
      _cls += " hl-goal--act hl-goal--phone";
      _title = "📱 スマホを買って配信を始める";
      _onclick = () => { if (typeof buyPhoneAndGoLive === "function") buyPhoneAndGoLive(); };
    } else if (_epOn) {
      const _zone = (typeof epilogueZone === "function") ? epilogueZone() : "mid";
      _cls += " hl-goal--ep hl-goal--ep-" + _zone;
      _title = "☄️ 絶滅メーターを押し戻す";
      _onclick = () => { if (typeof renderEconomy === "function") renderEconomy(); else if (typeof renderGoals === "function") renderGoals(); };
    } else if (typeof nextGoal === "function") {
      const _ng = nextGoal();
      // ★門番：目標タイトルは未登場キャラの名前・章題を含む（例「スミカと総資産（第3話）」）ので、
      //   g.title を直読みせず goalTitleSafe() でマスク版を得る（未登場なら「？？？」）。typeofは読込順の保険。
      const _gt = _ng ? ((typeof goalTitleSafe === "function") ? goalTitleSafe(_ng) : _ng.title) : "";
      _title = _ng ? `${_ng.icon} ${_gt}` : "✨ すべて達成しました！";
      _onclick = () => { if (typeof renderGoals === "function") renderGoals(); };
    }
    if (_title) {
      const goalBtn = el("button", _cls);
      goalBtn.innerHTML = `<span class="hl-goal-t">${_title}</span><span class="hl-goal-caret">▸</span>`;
      if (_onclick) goalBtn.onclick = _onclick;
      topRow.appendChild(goalBtn);
      // C4解消：☄️メーターチップの“ホーム初出”時に一度だけ自動説明（従来は島の経済画面でしか出なかった）。
      //   500ms＝progressionCheckOnHome(700ms)より先に出す→1到着1モーダルルールで解放通知側が譲る。
      if (_cls.indexOf("hl-goal--ep") >= 0 && typeof maybeShowMeterHelpFirstTime === "function") {
        setTimeout(() => { try { if (state.ui.screen === "home") maybeShowMeterHelpFirstTime(); } catch (e) {} }, 500);
      }
    }
  }

  // 背景の火の粉（CSSのみで常時ゆらめく・reduced-motionでは非表示）＝画面が止まって見えない
  const emb = el("div", "hl-embers");
  emb.innerHTML = "<span></span><span></span><span></span><span></span><span></span><span></span><span></span>";
  stage.appendChild(emb);

  // 左下カラム：流れるコメントのみ。★デザイン刷新：📋ミッション帯はヒーローから撤去（🎯目標チップと
  //   内容重複＋立ち絵上の低コントラスト帯が雑然の主因だった。ミッションはSNS/目標画面で確認）。
  const left = el("div", "hl-left");
  const cms = el("div", "hl-comments");
  left.appendChild(cms);
  stage.appendChild(left);

  // ミミの吹き出し（配信トーク）。挨拶＋タップ反応＋ときどき小ネタ。VN立ち絵は出さない。
  const speech = el("div", "hl-speech hidden");
  stage.appendChild(speech);
  let _speechT = 0;
  // 吹き出しが邪魔な時はタップで即消し（フェードアウト）。ミミ本体のタップ（鑑賞）とは独立。
  speech.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(_speechT);
    speech.classList.add("out");
    setTimeout(() => speech.classList.add("hidden"), 420);
  });
  function mimiSay(text, ms) {
    if (!text) return;
    // （ホームのSEは撤去：mimiSayは自動バンター/ギフト/反応で頻発し「うるさい」ため鳴らさない）
    clearTimeout(_speechT);
    speech.textContent = text;
    speech.classList.remove("hidden", "out");
    void speech.offsetWidth;
    _speechT = setTimeout(() => { speech.classList.add("out"); }, ms || 4200);
  }
  if (_doGreet && window.DLG && DLG.login) {
    try { setTimeout(() => mimiSay((DLG.login(state.player)[0] || {}).t || "ようこそ！", 5200), 500); } catch (e) {}
  }
  const _BANTER = ["今日はどの竜を推す〜？", "コメントありがとっ！", "いっしょに当てようね！", "耳、さわっていいよ？ うそうそ。", "オッズ、よーく見てね。", "ぱほぱほ〜♪", "推し竜、見つかった？", "差し入れ、うれしいな♪"];
  const _banter = () => mimiSay(_BANTER[Math.floor(Math.random() * _BANTER.length)]);
  // ミミ本体タップ＝状況に合わせて一言（来訪者ミミの口調・表情リアクション付き）。表示専用＝レース数値不変。
  const _MIMI_SAY = ["わっ、見てくれてるの…？ えへへ。", "今日もいっしょにドキドキしよ？", "コメント、ぜんぶ読んでるよ！", "ぱほぱほ〜♪", "耳、さわっちゃだめ……ちょっとだけならいいかも？", "この世界、まだ慣れないけど…がんばるっ！", "次はどの子に賭けようかな…", "応援、すっごく力になるんだ！", "わたし、予想家ミミです。よろしくねっ", "ふぁ…ちょっとねむい、かも？"];
  function _mimiTalk() {
    if (state.ui.screen !== "home") return;
    let line, mood = "smile";
    if (p.streak >= 3) { line = `${p.streak}連勝だって…！ すごくない？`; mood = "happy"; }
    else if (p.coins <= 0) { line = "うぅ、コインがピンチかも…！"; mood = "panic"; }
    else if (p.coins >= 100000000) { line = "コイン、こんなに……！ どうしよ〜！"; mood = "happy"; }
    else if (Math.random() < 0.55) { line = _MIMI_SAY[Math.floor(Math.random() * _MIMI_SAY.length)]; mood = /[！]/.test(line) ? "happy" : "smile"; }
    else { line = _BANTER[Math.floor(Math.random() * _BANTER.length)]; }
    mimiSay(line);
    try { _flipTo(mood); setTimeout(() => { if (state.ui.screen === "home") _flipTo("default"); }, 2300); } catch (e) {}
    try { if (!_reduce) { const r = stage.getBoundingClientRect(); if (r.width) { _heart(r.width * 0.5, r.height * 0.42); _heart(r.width * 0.5 + 22, r.height * 0.47); } } } catch (e) {}
  }

  wrap.appendChild(stage);

  // アイドル演出（多重サイン呼吸＋体重移動＋バネ式視線追従）。pointerはgaze目標だけ更新。
  const _mimiImg = mimiIn.querySelector("img");
  stage.addEventListener("pointermove", function (e) {
    const r = mimi.getBoundingClientRect(); if (!r.width) return;
    _mimiGaze.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
    _mimiGaze.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
  });
  stage.addEventListener("pointerleave", function () { _mimiGaze.tx = 0; _mimiGaze.ty = 0; });
  startMimiIdle(mimiIn, _mimiImg);

  // ── ライブ演出（表示専用）：視聴者数・コメント・ハート。離脱でタイマー停止。
  if (window._hlTimers) window._hlTimers.forEach(clearInterval);
  window._hlTimers = [];
  const _reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const _fame = (state.assets && state.assets.fameValue) || 0;
  let _viewers = 380 + p.rank * 260 + ((p.villageLevel || 1) * 180) + Math.min(4000, p.completedRaces * 6) + Math.floor(_fame / 50);
  const _fmtV = v => v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString("ja-JP");
  if (broadcast && viewersEl) {   // ★視聴者数は配信モードのみ（viewersEl は帯内の <b> 要素そのもの）
    const _vB = viewersEl;
    _vB.textContent = _fmtV(_viewers);
    window._hlTimers.push(setInterval(() => {
      if (state.ui.screen !== "home") { window._hlTimers.forEach(clearInterval); return; }
      _viewers = Math.max(120, Math.round(_viewers * (1 + (Math.random() - 0.48) * 0.05)));
      _vB.textContent = _fmtV(_viewers);
    }, 2600));
  }

  const _CMN = ["竜見の村人", "観客アヤ", "常連のジジ", "旅の予想屋", "バニー推し", "島っ子", "屋台のおやじ", "夜勤あけ", "遠征組", "はじめて見た",
    "竜舎の常連", "村の子ども", "予想ノート勢", "観光客さん", "ベテラン勢", "屋台の常連", "通りすがり", "町外れの占い師"];
  const _CMC = ["#57b1dd", "#6ac06a", "#e0a0c0", "#caa44a", "#9a6ad0", "#ff9a5c"];
  const _CMT = ["ミミちゃん今日も推す！", "初見です！よろしく！", "🐲🐲🐲", "ぱほぱほ〜！", "今日こそ波乱こい", "本命党です", "穴党ですが何か", "耳ぴょこぴょこかわいい", "その衣装どこで買ったの？", "レースまだかな", "🔥🔥🔥", "💖💖", "ポロちゃん推し", "オッズ見てから来た", "村から応援してます", "🥕どうぞ", "昨日の波乱すごかった", "おやつ持ってきた", "今日の本命教えて", "かわいいの域を超えてる",
    "今日も配信おつかれ！", "ミミちゃんの予想たより", "次のレースわくわく", "本命か穴か悩む〜", "耳ぴょこんかわいすぎ", "今日の調子どう？", "いっしょにドキドキしたい", "竜たちかっこいい！", "また来ちゃった！", "投げ銭しちゃう🪙", "実況たのしみ", "推し竜に全ツッパ", "コメント読んでくれる？", "ぱほぱほ言って〜", "癒やされる〜", "がんばれミミちゃん！", "今日のラッキー竜は？", "村の誇りだよ"];
  // ★門番：ポロは poroFound()（単勝2勝目）で出会うまで名前を出さない＝「ポロちゃん推し」が
  //   発見前に流れると命名のオチが潰れる。fail-closed＝門番が無ければポロ入りの台詞は出さない。
  const _CMT_OK = (typeof poroFound === "function" && poroFound()) ? _CMT : _CMT.filter(t => t.indexOf("ポロ") < 0);
  function _addCm(name, color, text, cls) {
    const d = el("div", "hl-cm" + (cls ? " " + cls : ""), `<b style="color:${color}">${name}</b>${text}`);
    cms.appendChild(d);
    while (cms.children.length > 8) cms.removeChild(cms.firstChild);   // ★最新8件（縦の表示領域+60%分・ユーザー指示③）
  }
  // 状況連動コメント：今のプレイ状況（連勝/コイン/ランク/勝率/時間帯/衣装…）に合う台詞を集める（表示専用）
  function _ctxCm() {
    const out = [];
    const wr = p.completedRaces > 0 ? Math.round(p.wins / p.completedRaces * 100) : 0;
    let hour = 12; try { hour = new Date().getHours(); } catch (e) {}
    if (p.streak >= 5) out.push("連勝とまらないっ！", "もう伝説の域では？", "この流れ乗るしかない");
    else if (p.streak >= 3) out.push(`${p.streak}連勝とかすごっ`, "波に乗ってるね〜", "ミミちゃん絶好調！");
    else if (p.streak >= 2) out.push("お、連勝きてる？", "いい流れ〜");
    if (p.coins <= 0) out.push("ミミちゃんドンマイ！", "次があるさ……！", "村のみんなで支える🥕", "ここからの巻き返し見たい");
    else if (p.coins < 300) out.push("コインピンチ…がんばれ！", "ここは慎重にいこ？");
    if (p.coins >= 100000000) out.push("億超えてて草", "金銭感覚バグってる笑", "ミミ様とお呼びしたい");
    else if (p.coins >= 10000000) out.push("コイン持ちすぎでは…！", "羽振りよすぎる〜");
    if (p.rank >= 6) out.push("さすが上級者の風格", "格が違うわ…", "予想家の鑑");
    else if (p.rank <= 1) out.push("これからこれから！", "応援してるよ〜！");
    if (p.completedRaces >= 10 && wr >= 50) out.push(`的中率${wr}%えぐい`, "予想の鬼や…");
    if (p.completedRaces >= 50) out.push("歴戦のミミちゃん", "ベテランの貫禄だ");
    if ((p.biggestPayout || 0) >= 100000) out.push("あの大穴当てた人だ！", "伝説の配当みたわ");
    if (hour >= 5 && hour < 11) out.push("おはよ〜ミミちゃん", "朝から配信えらい！");
    else if (hour >= 22 || hour < 4) out.push("夜更かし配信？", "夜のミミもいいね", "ねむくないの〜？");
    try { const o = outfitById(oid); if (o && o.name) out.push(`その「${o.name}」似合ってる！`, "今日の衣装かわいい〜"); } catch (e) {}
    return out;
  }
  function _randCm() {
    // 出会い済みの顧問がたまに登場（雰囲気のみ・表示専用）
    try {
      // ★門番：総資産だけで判定していたため、第5話未読でも総資産1億を超えた瞬間にセレスティアが
      //   本名・専用色・固有セリフでコメント欄に流れ、正体がバレていた（他画面は「あのお姉さん」でマスク中）。
      //   登場の唯一の述語＝advisorMet()。表示名/記号/色も castNameSafe/castSymbolSafe/castColorSafe を必ず通す。
      const met = (typeof advisorMet === "function")
        ? Object.keys(STORY_CAST).filter(k => advisorMet(k)) : [];   // fail-closed：門番が無ければ誰も出さない
      if (met.length && Math.random() < 0.16) {
        const k = met[Math.floor(Math.random() * met.length)];
        let t = ((typeof storyVoiceLine === "function") && storyVoiceLine(k, "race")) || (STORY_CAST[k] || {}).gives || "";
        if (t.length > 34) t = t.slice(0, 33) + "…";
        _addCm(castSymbolSafe(k) + castNameSafe(k).split("・")[0], castColorSafe(k), t);
        return;
      }
    } catch (e) {}
    // 状況連動を優先（約35%）→ 残りは汎用プールから
    try {
      const ctx = _ctxCm();
      if (ctx.length && Math.random() < 0.35) {
        _addCm(_CMN[Math.floor(Math.random() * _CMN.length)], _CMC[Math.floor(Math.random() * _CMC.length)], ctx[Math.floor(Math.random() * ctx.length)]);
        return;
      }
    } catch (e) {}
    _addCm(_CMN[Math.floor(Math.random() * _CMN.length)], _CMC[Math.floor(Math.random() * _CMC.length)], _CMT_OK[Math.floor(Math.random() * _CMT_OK.length)]);
  }
  // ★流れる視聴者コメントは配信モードのみ（スマホ購入＝SNS解放より前は出さない）。
  //   静かモードはミミの独り言(_banter)と背景・目標だけ＝“配信”はまだ始まっていない、という状態を守る。
  if (broadcast) {
    _randCm(); setTimeout(_randCm, 900);
    window._hlTimers.push(setInterval(() => {
      if (state.ui.screen !== "home") return;
      if (Math.random() < 0.7) _randCm();
    }, 3300));
  }

  function _heart(x, y, ch) {
    if (!broadcast) return;   // ★ハート(いいね)は配信モードのみ＝全発生をここで一括ゲート（独り言/タップ反応は別途維持）
    const h = document.createElement("span");
    h.className = "hl-heart";
    h.textContent = ch || ["💖", "💛", "🧡", "💚", "💙", "🤍", "✨"][Math.floor(Math.random() * 7)];
    h.style.left = x + "px"; h.style.top = y + "px";
    h.style.setProperty("--dx", (Math.random() * 48 - 24).toFixed(0) + "px");
    h.style.setProperty("--rz", (Math.random() * 40 - 20).toFixed(0) + "deg");
    h.style.fontSize = (15 + Math.random() * 14).toFixed(0) + "px";
    stage.appendChild(h);
    h.addEventListener("animationend", () => h.remove());
  }
  stage.addEventListener("pointerdown", (e) => {
    // ステージ余白タップ＝ハートのみ（ミミ本体タップは _mimiTalk が一言を担当・二重発火しない）
    if (_reduce) return;
    const r = stage.getBoundingClientRect();
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) _heart(e.clientX - r.left + (Math.random() * 18 - 9), e.clientY - r.top);
  });
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") return;
    if (!speech.classList.contains("hidden") && !speech.classList.contains("out")) return;  // まだ喋っている間は重ねない
    if (Math.random() < 0.5) _banter();
  }, 13000));
  if (!_reduce) window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") return;
    const r = stage.getBoundingClientRect();
    if (r.width) _heart(r.width * (0.84 + Math.random() * 0.1), r.height * (0.55 + Math.random() * 0.3));
  }, 3800));

  // 入場通知（TikTokの "joined" 風・表示専用）：ときどき誰かが遊びに来る。
  // まれにVIPが金の入場バナー＋⭐バーストで来る＝配信の「おっ」という瞬間（表示のみ）。
  const _VIPS = ["👑 推し竜団長", "🐉 竜好きの長老", "💎 島いちの太客"];
  // ★門番：マクラの「お忍び入場」は出会った後だけ（未登場の顧問の固有名を配信に出さない）。
  //   実運用では配信＝スマホ購入＝第4話後だが、フラグの前後関係に依存せず advisorMet() で明示的に塞ぐ。
  if (typeof advisorMet === "function" && advisorMet("makura")) {
    _VIPS.push(castSymbolSafe("makura") + " " + castNameSafe("makura").split("・")[0] + "（お忍び）");
  }
  function _joinCm(vip) {
    if (vip) {
      const vnm = _VIPS[Math.floor(Math.random() * _VIPS.length)];
      _addCm(vnm, "#ffd34d", " が入場しました！", "join vipjoin");
      if (!_reduce) {
        const r = stage.getBoundingClientRect();
        if (r.width) for (let i = 0; i < 5; i++) ((d) => setTimeout(() => {
          if (state.ui.screen === "home") _heart(r.width * (0.2 + Math.random() * 0.6), r.height * (0.38 + Math.random() * 0.38), "⭐");
        }, d))(i * 110);
      }
      return;
    }
    const nm = _CMN[Math.floor(Math.random() * _CMN.length)];
    _addCm("🌟" + nm, "#b9a0ff", " が遊びにきた！", "join");
  }
  if (broadcast) window._hlTimers.push(setInterval(() => {   // ★入場通知は配信モードのみ
    if (state.ui.screen !== "home") return;
    if (Math.random() < 0.4) _joinCm(Math.random() < 0.12);
  }, 9500));

  // ギフト演出（投げ銭ごっこ・完全に表示専用＝コインは1枚も動かない）：
  // コメント＋絵文字が舞い上がる。レアギフト(💎)は大きく舞ってミミが必ずお礼。
  const _GIFTS = [
    { e: "🥕", n: "ニンジン", w: 5 }, { e: "🍖", n: "ドラゴンミート", w: 3 },
    { e: "🌸", n: "花束", w: 3 }, { e: "🍩", n: "ドーナツ", w: 2 }, { e: "💎", n: "竜の宝石", w: 1 }];
  const _GIFT_THX = ["わ〜！ありがとうっ！", "だいじにするねっ！", "ぱほぱほ〜！感謝です！", "えへへ、うれしい〜！"];
  function _giftCm() {
    const pool = []; _GIFTS.forEach(g => { for (let i = 0; i < g.w; i++) pool.push(g); });
    const g = pool[Math.floor(Math.random() * pool.length)];
    const nm = _CMN[Math.floor(Math.random() * _CMN.length)];
    const rare = g.e === "💎";
    _addCm("🎁" + nm, "#ffcf6e", ` が ${g.n}${g.e} を投げた！`, "gift");
    if (!_reduce) {
      const r = stage.getBoundingClientRect();
      const n = rare ? 12 : 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        ((d) => setTimeout(() => {
          if (state.ui.screen !== "home" || !r.width) return;
          _heart(r.width * (0.25 + Math.random() * 0.5), r.height * (0.4 + Math.random() * 0.35), g.e);
        }, d))(i * 90);
      }
    }
    if (rare && !_reduce) {   // ② レアギフトは全画面フラッシュ＋広がるリング
      const fx = document.createElement("div");
      fx.className = "hl-flashfx";
      stage.appendChild(fx);
      fx.addEventListener("animationend", () => fx.remove());
    }
    if (rare || Math.random() < 0.35) {
      mimiSay(_GIFT_THX[Math.floor(Math.random() * _GIFT_THX.length)]);
      try { _flipTo("happy"); setTimeout(() => { if (state.ui.screen === "home") _flipTo("default"); }, 2300); } catch (e) {}
    }
  }
  if (broadcast) window._hlTimers.push(setInterval(() => {   // ★ギフト演出は配信モードのみ
    if (state.ui.screen !== "home") return;
    if (Math.random() < 0.55) _giftCm();
  }, 21000));
  window._hlFx = { join: _joinCm, gift: _giftCm };   // 動作確認用フック（表示専用）

  // ミミの表情カードフリップ：基本は default、時々クルッと回転して別表情→また回転して戻る。
  // 回転は .hl-mimi-flip（アイドル演出のtransformとは別レイヤ）で行い、直角(90°)の瞬間に画像を差し替える。
  // 「急に切り替わる」対策：対象表情を事前プリロードし、ロード済みのものだけ回す＝無回転ポップを防止。
  const _flipEl = mimiIn.querySelector(".hl-mimi-flip");
  const _flipImg = _flipEl ? _flipEl.querySelector("img") : null;
  const _ALT_EX = ["smile", "happy", "panic"];
  const _exReady = { default: true };
  _ALT_EX.forEach(ex => { const im = new Image(); im.onload = () => { _exReady[ex] = true; }; im.src = outfitImg(oid, ex); });
  const FLIP_MS = 230;            // CSS .hl-mimi-flip の transition と一致（真横で差し替え）
  let _exprNow = "default";
  let _flipping = false;          // 回転中の再入ガード（タイマー競合で二重トグルしない）
  function _flipTo(ex) {
    if (!_flipEl || !_flipImg || _flipping || ex === _exprNow) return;
    if (!_exReady[ex]) return;    // 未ロードなら今回は見送り（次の機会に・ポップ回避）
    _flipping = true;
    const src = outfitImg(oid, ex);
    if (_reduce) { _flipImg.src = src; _exprNow = ex; _flipping = false; return; }
    _flipEl.classList.add("flipping");                         // 0→90°（エッジオンへ）
    setTimeout(() => {
      if (!document.contains(_flipEl)) { _flipping = false; return; }
      _flipImg.src = src; _exprNow = ex;                       // 真横の瞬間に差し替え（プリロード済み＝即時）
      _flipEl.classList.remove("flipping");                    // 90→0°（新しい面が回って出てくる）
      setTimeout(() => { _flipping = false; }, FLIP_MS);
    }, FLIP_MS);
  }
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home" || _flipping) return;
    if (_exprNow === "default") {
      if (Math.random() < 0.6) _flipTo(_ALT_EX[Math.floor(Math.random() * _ALT_EX.length)]);
    } else {
      _flipTo("default");   // 数秒見せたらデフォルトへ戻る
    }
  }, 5200));

  // ── 下段（固定ドック）：レースへ進む → ナビ のみ。
  //   ・コメント/いいねバー＝常設なので flex の独立層(.hl-actionbar)（stageとdockの間・足元の接地は保つ）。
  //   ・🙏無心 / ⚔️最終決戦＝「いま次にやること」なので🎯目標チップに統合済み（上の goalBtn）＝
  //     ここでは作らない＝ミミの上に被るCTAなし・立ち位置不変（ユーザー指摘）。
  const dock = el("div", "hl-dock");
  const actionFloat = el("div", "hl-actionbar");

  // 💬コメント入力＋❤️いいねバー（TikTok風の参加UI）＝★配信モードのみ（あなたが視聴者として参加）。静かモードでは非表示。
  if (broadcast) {
  const cmwrap = el("div", "hl-cmbar-wrap");
  const qr = el("div", "hl-qr hidden");
  const QRS = ["がんばれー！", "ミミちゃんかわいい", "本命きめた？", "🐲🐲🐲", "ぱほぱほ〜！"];
  const _YOU_THX = ["コメントありがとっ！", "わっ、うれしい！", "読んだよ〜！ありがとう♪", "えへへ、がんばるねっ"];
  let _qrT = 0;
  function _youSay(t) {
    _addCm("✨あなた", "#ffd34d", " " + t, "you");
    qr.classList.add("hidden");
    try {   // ③ ミッション「コメント1回」を達成記録し、ピン表示を即時更新
      if (state.player.dailyM && !state.player.dailyM.cmt) {
        state.player.dailyM.cmt = 1;
        if (typeof saveGame === "function") saveGame();
        const mp = document.querySelector(".hl-missions");
        if (mp) mp.textContent = "📋 " + _dailyMissionText();
      }
    } catch (e) {}
    if (Math.random() < 0.55) {
      mimiSay(_YOU_THX[Math.floor(Math.random() * _YOU_THX.length)]);
      try { _flipTo(Math.random() < 0.5 ? "smile" : "happy"); setTimeout(() => { if (state.ui.screen === "home") _flipTo("default"); }, 2300); } catch (e) {}
    }
  }
  QRS.forEach(t => { const b = el("button", "hl-qr-b", t); b.onclick = () => _youSay(t); qr.appendChild(b); });
  const cmbar = el("div", "hl-cmbar");
  const cmInput = el("button", "hl-cminput", "💬 コメントする…");
  cmInput.onclick = () => {
    qr.classList.toggle("hidden");
    clearTimeout(_qrT);
    if (!qr.classList.contains("hidden")) _qrT = setTimeout(() => qr.classList.add("hidden"), 7000);
  };
  cmbar.appendChild(cmInput);
  // 🎁ギフト：視聴者が投げるギフト演出を自分でも起こせる（TikTokの入力行＝[コメント][🎁][❤️]。
  // 投げ銭ごっこ＝表示専用・コインは1枚も動かない）
  const giftBtn = el("button", "hl-giftbtn", "🎁");
  giftBtn.title = "ギフトを投げる（ごっこ・無料）";
  giftBtn.onclick = () => { try { _giftCm(); } catch (e) {} };
  cmbar.appendChild(giftBtn);
  // ❤️いいね：タップでカウント＋ハート噴出。自動でもじわじわ増える（ライブ感・表示専用）
  let _likes = 1200 + Math.floor(_viewers * 6) + p.completedRaces * 15;
  const _fmtL = v => v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString("ja-JP");
  const likeBtn = el("button", "hl-likebtn", `❤️<b>${_fmtL(_likes)}</b>`);
  const _setLike = () => { const b = likeBtn.querySelector("b"); if (b) b.textContent = _fmtL(_likes); };
  likeBtn.onclick = () => {
    _likes += 1; _setLike();
    likeBtn.classList.remove("bump"); void likeBtn.offsetWidth; likeBtn.classList.add("bump");   // 数字がポンと跳ねる
    if (!_reduce) { const r = stage.getBoundingClientRect(); if (r.width) for (let i = 0; i < 2; i++) _heart(r.width * (0.78 + Math.random() * 0.16), r.height * (0.55 + Math.random() * 0.3)); }
    if (Math.random() < 0.07) mimiSay("いいね、ありがとっ！");
  };
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") return;
    if (Math.random() < 0.7) { _likes += 1 + Math.floor(Math.random() * 3); _setLike(); }
  }, 2600));
  cmbar.appendChild(likeBtn);
  cmwrap.appendChild(qr); cmwrap.appendChild(cmbar);
  actionFloat.appendChild(cmwrap);   // コメント/いいねバー（レースへ進むの直上に浮く）
  }   // ← end if(broadcast)：コメント入力/いいねバー

  // ※「次の一戦」台座はドック内（レースCTAの直上）に置く＝CTAと横幅が厳密に一致する（下部 raceBtn の直前で生成）。

  // 🙏無心(0コイン) / ⚔️最終決戦 は「いま次にやること」＝🎯目標チップ（上の goalBtn）に統合済み＝ここでは作らない。
  // コメント/いいねバーだけが常設フロート層＝出入りが無いのでミミの立ち位置も固定ドックも不動（ユーザー指摘）。
  if (actionFloat.children.length) wrap.appendChild(actionFloat);

  // H3磨き3：タブ/CTA押下→130msのフェードで次画面へ（遷移の連続性＝ガタつかせない）。
  // reduced-motion時と静かモードは即遷移のまま。表示のみ。
  const _tikGo = (fn) => {
    const appEl = document.getElementById("app");
    const reduce = (typeof matchMedia === "function") && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!appEl || !broadcast || reduce) { fn(); return; }
    appEl.classList.add("scr-fade");
    setTimeout(() => {
      try { fn(); } finally { requestAnimationFrame(() => appEl.classList.remove("scr-fade")); }
    }, 130);
  };
  // 🐉「次の一戦」台座＝★静かモードのみ・ドック内でCTAの直上に。CTAと同じ dock に入るので横幅が厳密に一致。
  //   ★表示専用＝featuredRaceToday() を読むだけ（レース生成・着順・オッズ・配当には触れない）。
  //   1行・レース名だけ（時刻/距離/天気の詰め込みと途中改行を廃止＝「何の一戦か」だけを静かに示す台座）。
  if (!broadcast) {
    try {
      const _nr = (typeof featuredRaceToday === "function") ? featuredRaceToday() : null;
      const _nm = (_nr && typeof raceFullName === "function") ? raceFullName(_nr) : "";
      if (_nm) {
        const _grade = (typeof gradeBadgeHTML === "function") ? gradeBadgeHTML(_nr.rank) : "";
        const nextBtn = el("button", "hl-nextrace");
        nextBtn.innerHTML =
          `<span class="hl-nextrace-tag">次の一戦</span>` +
          (_grade ? `<span class="hl-nextrace-grade">${_grade}</span>` : "") +
          `<span class="hl-nextrace-nm">${_nm}</span>` +
          `<span class="hl-nextrace-go">›</span>`;
        nextBtn.title = "レース選択へ";
        nextBtn.onclick = () => _tikGo(() => renderRaceSelect());   // CTA(.hl-race)と同じ遷移
        dock.appendChild(nextBtn);
      }
    } catch (e) {}   // 読めなければ静かに省略＝台座を出さないだけ（壊すより出さない）
  }

  const raceBtn = el("button", "hl-race", "🐉 レースへ進む");
  raceBtn.onclick = () => _tikGo(() => renderRaceSelect());
  dock.appendChild(raceBtn);

  // ★ナビ＝常時10枠固定（docs/GAME_FLOW_REDESIGN.md §1・D1/D3/A4解消）。
  //   出入りで枠数が変わらない＝配信化してもレイアウトがガタつかない。ロック表現は2種だけ：
  //   ・条件明示ロック＝実アイコン＋🔒ラベル＋タップで解放条件（観光/モール/図鑑）
  //   ・？？？ミステリー枠＝サプライズ性が価値のもの（龍舎=ポロ・SNS=配信変身）
  // ★固定5タブ＝両モード共通（docs/HOME_COMMERCIAL_REDESIGN・バグ修正：静かモードが旧10ボタンの
  //   まま古かったのを解消）。配信=.tik（ライブ演出＋5番目SNS）／静か=クリーンなバー＋5番目図鑑。
  //   統合＝食べ歩き/買い物/龍舎→🏝島ハブ・物語/経済/ツリー/習い事/相談→🌳暮らしハブ・
  //   設定/シェア→ヘッダー⋯。タブは即遷移（配信のみフェード）。解放の見せ場（🔒＋条件ポップ）は維持。
  if (broadcast) wrap.classList.add("tik");
  const bar = el("div", "tik-bar");
  // ★箱方式：専用アイコン images/nav/<key>.svg があれば絵文字を差し替える（無ければwebp→絵文字＝安全）。
  //   差し替え時は NAV_ICON_V を bump してキャッシュ撃破。5枚：island/kurashi/meal/sns/stable（dexは早期用）。
  const NAV_ICON_V = "20260715j";
  const tikTab = (icon, label, go, opts) => {
    opts = opts || {};
    const b = el("button", "tik-tab" + (opts.center ? " center" : "") + (opts.locked ? " locked" : ""));
    b.innerHTML = `<span class="ic">${icon}</span><span class="lb">${label}</span>` + (opts.dot ? `<i class="dot"></i>` : "");
    if (opts.img) {   // SVG優先。無ければ旧webp、それも無ければ絵文字のまま
      const ic = b.querySelector(".ic");
      const im = new Image();
      im.onload = () => { if (ic) { ic.textContent = ""; im.className = "tik-ic-img"; im.alt = ""; ic.appendChild(im); b.classList.add("has-img"); } };
      im.onerror = () => {
        im.onerror = null;
        im.src = `images/nav/${opts.img}.webp?v=${NAV_ICON_V}`;
      };
      im.src = `images/nav/${opts.img}.svg?v=${NAV_ICON_V}`;
    }
    b.onclick = opts.locked ? go : () => _tikGo(go);   // 遷移はフェード（配信のみ）・ロックのポップは即時
    return b;
  };
  // ★フッター＝“行き先”タブだけ（レースは上のゴールドCTA「レースへ進む」が唯一の導線＝
  //   二重導線バグを解消／ユーザー指摘）。中央強調も廃止＝全タブ等価。行き先：島/暮らし/ごはん/SNS/図鑑。
  // 🏝島（初勝利で解放・中に食べ歩き/買い物/龍舎）
  if (typeof konronMapUnlocked === "function" && konronMapUnlocked()) {
    bar.appendChild(tikTab("🏝️", "島", () => renderKonronMap(), { img: "island" }));
  } else {
    bar.appendChild(tikTab("🏝️", "島", () => showInfoPopup("🏝️ 島",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて勝つ</u>と、島のみんなが崑崙島を案内してくれます（食べ歩き・買い物・龍舎もここから）。</small></div></div>`), { locked: true, img: "island" }));
  }
  // 🌳暮らし＝物語もこの中。新しい話が読める時は未読ドットで気づかせる（レース直後のモーダルの代わり）。
  const _storyNew = (typeof storyHasUnread === "function") && storyHasUnread();
  bar.appendChild(tikTab("🌳", "暮らし", () => renderAssets(), { img: "kurashi", dot: _storyNew }));   // 経済/ツリー/習い事/物語/相談/コレクション
  bar.appendChild(tikTab("🍽️", "ごはん", () => renderMeals(), { img: "meal" }));          // 勝ち飯/負け飯＝高頻度ループを1タップ
  // 📱SNS＝配信モードのみ（未読ドット）
  if (broadcast) {
    const _unreadL = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
    bar.appendChild(tikTab("📱", "SNS", () => renderSns(), { dot: _unreadL > 0, img: "sns" }));
  }
  // 5番目＝竜のハブ「龍舎」（スカウト/図鑑/ポロを集約）。図鑑は龍舎の中にある＝単独タブにしない
  //   （ユーザー指摘：図鑑は竜舎から行けばよい）。龍舎が開く前(2勝目/ポロ発見前)は図鑑単体を出し、
  //   龍舎解放で龍舎へ“昇格”＝図鑑が消える窓を作らない。
  if (typeof poroStableUnlocked === "function" && poroStableUnlocked()) {
    bar.appendChild(tikTab("🏠", "龍舎", () => renderStable(), { img: "stable" }));
  } else if (typeof dexUnlocked === "function" && dexUnlocked()) {
    bar.appendChild(tikTab("📖", "図鑑", () => renderCollection(), { img: "dex" }));
  } else {
    bar.appendChild(tikTab("📖", "図鑑", () => showInfoPopup("📖 図鑑",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて当てる</u>と、賭けた竜たちの記録が見られるようになります（のちに「龍舎」に集約）。</small></div></div>`), { locked: true, img: "dex" }));
  }
  dock.appendChild(bar);
  wrap.appendChild(dock);

  app.appendChild(wrap);

  // 🔓 解放お祝いチェック（progression.js・ホーム到着1回につきモーダル1件まで）。
  //   FTUE保護＝初出走前は何も出さない（最初の5分は核ループに集中させる・リサーチ①）。
  if (typeof progressionCheckOnHome === "function" && (p.completedRaces || 0) >= 1) {
    setTimeout(() => { try { if (state.ui.screen === "home") progressionCheckOnHome(); } catch (e) {} }, 700);
  }
}

