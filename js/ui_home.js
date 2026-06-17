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
  const c = Math.min(1, m.cmt || 0);
  const mk = (v, label) => (v ? "✓" : "") + label + ` ${v}/1`;
  return `きょうのミッション　${mk(r, "出走")}・${mk(w, "単勝")}・${mk(c, "💬")}` + (r + w + c >= 3 ? "　🎉コンプ！" : "");
}

function renderHome() {
  state.ui.screen = "home";
  document.body.classList.remove("title-mode");
  const app = beginScreen();
  document.body.classList.add("home-mode");   // グローバル#headerを隠す（資産/ランクはホーム独自ヘッダー＋フロートへ集約）
  const p = state.player;
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  // daily login reward — checked once per session, shown just after home paints
  let _doGreet = false;   // 挨拶はVNではなく“配信の吹き出し”で（大立ち絵と二重にしない）
  if (!window._mimiLoginChecked) {
    window._mimiLoginChecked = true;
    try {
      const _lb = (typeof checkDailyLogin === "function") && checkDailyLogin();
      if (_lb) setTimeout(() => showLoginBonus(_lb), 420);
      else _doGreet = true;
    } catch (e) {}
  }
  const rankLabel = (RANKS[p.rank] && RANKS[p.rank].label) || "";
  const winRate = p.completedRaces > 0 ? Math.round((p.wins / p.completedRaces) * 100) : 0;
  const total = p.totalAssets || 0;
  const nextT = (typeof nextAssetThreshold === "function") ? nextAssetThreshold(total) : null;
  const fillPct = nextT ? Math.max(5, Math.min(100, total / nextT * 100)) : 100;
  let stageLabel = "";
  try { const st = (typeof lifeStageFor === "function" && state.assets) ? lifeStageFor(state.assets.unlockedLifeStages) : null; stageLabel = (st && (st.label || st.name || st.title)) || ""; } catch (e) {}
  let nearest = null;
  try { const goals = (typeof nextGoals === "function") ? nextGoals(state) : []; nearest = goals[0] || null; } catch (e) {}

  // ===== TikTokライブ風ホーム =====================================
  // コンセプト：ミミの“配信”を見ている画面。背景ぶち抜き（全画面）＋大立ち絵＋
  // ライブ演出（LIVEバッジ/視聴者数/流れるコメント/ハート）。すべて表示専用 ——
  // レース数値・進行・経済には一切干渉しない。ホーム離脱でタイマー/演出は自動停止。
  let goalLine = nearest ? `${nearest.icon} ${nearest.label}　${nearest.sub}`
    : (stageLabel ? "暮らし：" + stageLabel : "");
  if (nextT) goalLine += (goalLine ? "　" : "") + "（次まで " + fmtCoins(Math.max(0, nextT - total)) + "）";
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
  const HOME_BGS = [
    // floorDay/floorNight＝床の接地ライン（上端からの比率・実測）。無ければ floor。
    // 屋外ロケ（日替わりローテーション）。images/homebg/<id>_{day,night}.webp。
    { id: "balcony", day: "images/homebg/balcony_day.webp", night: "images/homebg/balcony_night.webp", floorDay: 0.73, floorNight: 0.70 },
    { id: "beach",   day: "images/homebg/beach_day.webp",   night: "images/homebg/beach_night.webp",   floorDay: 0.64, floorNight: 0.64 },
    { id: "market",  day: "images/homebg/market_day.webp",  night: "images/homebg/market_night.webp",  floorDay: 0.62, floorNight: 0.60 },
    { id: "onsen",   day: "images/homebg/onsen_day.webp",   night: "images/homebg/onsen_night.webp",   floorDay: 0.73, floorNight: 0.72 },
    { id: "stable",  day: "images/homebg/stable_day.webp",  night: "images/homebg/stable_night.webp",  floorDay: 0.60, floorNight: 0.60 },
    { id: "mall",    day: "images/homebg/mall_day.webp",    night: "images/homebg/mall_night.webp",    floorDay: 0.64, floorNight: 0.63 },
    // 自宅＝進行度（総資産レベル0..5）で豪華な部屋へ引っ越し。images/homebg/myroom_t<lvl>_{day,night}.webp。
    { id: "myroom", myroom: true },
  ];
  const MYROOM_FLOORS = [0.63, 0.63, 0.63, 0.66, 0.72, 0.64];   // t0..t5（実測）
  const bg = el("div", "hl-bg");
  bg.innerHTML = `<img class="hl-bg-img" alt="" decoding="async"><div class="hl-bg-scrim"></div>`;
  (function () {
    let hour = 20, dayIdx = 0;
    try { const now = new Date(); hour = now.getHours(); dayIdx = Math.floor(now.getTime() / 86400000); } catch (e) {}
    const night = !(hour >= 6 && hour < 18);
    // 配分：偶数日＝自宅(myroom・ホームベース＝引っ越し進行を見せる)／奇数日＝屋外ロケを順番に。
    const myroomEntry = HOME_BGS.find(b => b.myroom);
    const outdoor = HOME_BGS.filter(b => !b.myroom);
    const set = (dayIdx % 2 === 0 && myroomEntry) ? myroomEntry : outdoor[(dayIdx >> 1) % outdoor.length];
    let floorUsed, chain;
    if (set.myroom) {
      // 自宅：現在の総資産レベルの部屋→無ければ下の段→最後はバルコニー/旧背景へ
      const lvl = Math.min(5, (typeof assetLevelOf === "function") ? assetLevelOf(state.player.totalAssets || 0) : 0);
      const tiers = k => { const a = []; for (let t = lvl; t >= 0; t--) a.push(`images/homebg/myroom_t${t}_${k}.webp`); return a; };
      floorUsed = MYROOM_FLOORS[lvl] || 0.74;
      chain = night
        ? [...tiers("night"), "images/homebg/balcony_night.webp", "images/home_bg.webp", "images/racebg/fire.webp"]
        : [...tiers("day"), "images/homebg/balcony_day.webp", "images/home_bg_day.webp", "images/home_bg.webp", "images/racebg/fire.webp"];
    } else {
      floorUsed = (night ? set.floorNight : set.floorDay) || set.floor || 0.74;
      chain = night
        ? [set.night, "images/home_bg.webp", "images/racebg/fire.webp"]
        : [set.day, set.night, "images/home_bg_day.webp", "images/home_bg.webp", "images/racebg/fire.webp"];
    }
    const im = bg.querySelector(".hl-bg-img");
    let i = 0;
    im.onerror = () => { i++; if (i < chain.length) im.src = chain[i]; };
    // 接地キャリブレーション：画像の床ラインをミミの足元へ（縦のcover余白=±6vh内でだけ動かす）
    function calibrate() {
      try {
        const vh = window.innerHeight, vw = window.innerWidth;
        const boxH = vh * 1.12, boxW = vw * 1.12;
        if (!im.naturalWidth) return;
        if ((boxW / boxH) >= (im.naturalWidth / im.naturalHeight)) { im.style.top = ""; return; }   // 横長クロップ時は既定のまま
        const mimiEl = document.querySelector(".hl-mimi");
        if (!mimiEl) return;
        const feet = mimiEl.getBoundingClientRect().bottom;
        let top = feet - floorUsed * boxH;                    // 床ライン(floorUsed)が足元に来るtop(px)
        top = Math.max(-0.12 * vh, Math.min(0, top));         // 画像が画面から剥がれない範囲にクランプ
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
  // 1画面フィット：dvh/vhは環境差が大きい（WebViewで実視界より小さく解決される例あり）ので
  // 実測 innerHeight で .hl の高さを確定（リサイズ追従・ホーム再描画で旧リスナは差し替え）。
  function _fitHl() { wrap.style.minHeight = Math.max(420, window.innerHeight - 30) + "px"; }
  _fitHl();
  if (window._hlResize) window.removeEventListener("resize", window._hlResize);
  window._hlResize = _fitHl;
  window.addEventListener("resize", _fitHl);

  // ── ヘッダー（バー型・ブランド入り）：🐲ブランド｜プロフィール(称号切替)｜資産情報｜相棒ボタン｜⋯
  const top = el("div", "hl-top");
  top.appendChild(el("div", "hl-brand", `<span class="hl-brand-crest">🐲</span><b>聖龍爆走録<i>ミミ</i></b>`));
  const prof = el("button", "hl-prof");
  prof.innerHTML =
    `<span class="hl-prof-av">🐰</span>` +
    `<span class="hl-prof-tx"><b>予想家ミミ<i class="hl-prof-title">🏅${eqTitle || "称号"}<span class="hl-prof-caret">▾</span></i></b>` +
    `<small>ランク${p.rank}<span class="hl-prof-rl">${rankLabel ? " " + rankLabel : ""}</span>${p.streak >= 2 ? `・🔥${p.streak}連勝` : ""}</small></span>`;
  prof.title = "取得済みの称号を切り替える";
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

  // 相棒ドラゴンをヘッダーに小さくボタン化（将来は相棒変更の入口・今はタップで一言）
  const buddySrc = (typeof buddyDragonSrc === "function") ? buddyDragonSrc() : "images/dragon_ref/ref.webp";
  const buddyBtn = el("button", "hl-buddy-btn");
  buddyBtn.title = "相棒ドラゴン";
  const buddyCv = document.createElement("canvas");
  buddyCv.width = 384; buddyCv.height = 256;
  buddyBtn.appendChild(buddyCv);
  if (window.DragonL2) DragonL2.mountOrWarp(buddyCv, buddySrc, "home");
  else { const _dImg = new Image(); _dImg.onload = function () { startDragonWarp(buddyCv, _dImg); }; _dImg.onerror = function () { buddyBtn.innerHTML = "<span class='hl-dragon-fallback'>🐉</span>"; }; _dImg.src = buddySrc; }
  buddyBtn.onclick = () => { try { mimiSay("この子はわたしの相棒なんだ！"); } catch (e) {} };
  top.appendChild(buddyBtn);

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
  // 👗 きせかえ＝明示ボタン。ラベルに“今の衣装名”を出して「表示（今の衣装）＋操作（着替え）」の二役に。
  const _curOutfit = (typeof outfitById === "function") ? outfitById(oid) : null;
  const _outfitNm = (_curOutfit && _curOutfit.name) ? _curOutfit.name : "きせかえ";
  const dressBtn = el("button", "hl-dress");
  dressBtn.innerHTML = `<span class="hl-dress-ic">👗</span><span class="hl-dress-nm">${_outfitNm}</span>`;
  dressBtn.title = `いまの衣装：${_outfitNm}（タップできせかえ）`;
  dressBtn.onclick = (e) => { e.stopPropagation(); if (typeof showMimiViewer === "function") showMimiViewer(); };
  stage.appendChild(dressBtn);

  // 出走情報・ランク情報を背景に“浮かせる”フロート（配信オーバーレイ風・半透明・右上）。
  // 新規プレイヤーのゼロ統計はノイズなので非表示。🎯目標は📌ピン留めコメントへ移設。
  const floatBox = el("div", "hl-float");
  const viewersEl = el("div", "hl-viewers", "👁 <b></b>");
  // ④ フォロワー数＝名声・戦績と連動（表示専用）
  const _folV = 800 + Math.floor(((state.assets && state.assets.fameValue) || 0) * 2) + p.completedRaces * 15 + p.wins * 40;
  const _fmtF = v => v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString("ja-JP");
  // ランクは左上プロフィールへ（顔の右上を覆わない）。フロートは LIVE＋フォロワー（＋PCのみ戦績）
  floatBox.innerHTML =
    `<div class="hl-float-live"><span class="hl-live">LIVE</span></div>` +
    `<div class="hl-float-fol">💗 <b>${_fmtF(_folV)}</b> フォロワー</div>` +
    (p.completedRaces > 0 ? `<div class="hl-float-rec">出走${p.completedRaces}・単勝${p.wins}・勝率${winRate}%・最高${fmtCoins(p.biggestPayout || 0)}</div>` : "");
  floatBox.querySelector(".hl-float-live").appendChild(viewersEl);
  stage.appendChild(floatBox);

  // 🎯 目標（クエスト）チップ：ステージ左上に常設。終章中は「絶滅メーター」を“今の目標”として統合表示し、
  //   タップで🏦島の経済（メーター詳細＋？説明）へ。★別チップは作らない＝ホームのドックを膨らませない（崩れ防止）。表示専用。
  {
    const _epOn = (typeof epilogueOn === "function") && epilogueOn();
    const _ep = _epOn ? epData() : null;
    let _html = null, _cls = "hl-goal", _onclick = null;
    if (_epOn && !_ep.finalReady) {
      const _dial = epilogueDial().toFixed(2); const _prog = epilogueProgress();
      const _zone = (typeof epilogueZone === "function") ? epilogueZone() : "mid";
      _cls += " hl-goal--ep hl-goal--ep-" + _zone;
      _html =
        `<span class="hl-goal-k">☄️ 終章のもくひょう</span>` +
        `<span class="hl-goal-t">絶滅メーターを押し戻す</span>` +
        `<span class="hl-goal-p"><i style="width:${_prog}%"></i></span>` +
        `<span class="hl-goal-n">答えの単勝 ${_dial}倍 ・ くわしく ▸</span>`;
      _onclick = () => { if (typeof renderEconomy === "function") renderEconomy(); else if (typeof renderGoals === "function") renderGoals(); };
    } else if (typeof nextGoal === "function") {
      const _ng = nextGoal(); const _gs = (typeof goalsStats === "function") ? goalsStats() : { done: 0, total: 0 };
      _html = _ng
        ? `<span class="hl-goal-k">🎯 つぎの目標</span><span class="hl-goal-t">${_ng.icon} ${_ng.title}</span><span class="hl-goal-p"><i style="width:${_gs.total ? Math.round(_gs.done / _gs.total * 100) : 0}%"></i></span><span class="hl-goal-n">${_gs.done}/${_gs.total} 達成 ▸</span>`
        : `<span class="hl-goal-k">🎯 目標</span><span class="hl-goal-t">✨ すべて達成しました！</span><span class="hl-goal-n">${_gs.done}/${_gs.total} ▸</span>`;
      _onclick = () => { if (typeof renderGoals === "function") renderGoals(); };
    }
    if (_html) {
      const goalBtn = el("button", _cls);
      goalBtn.innerHTML = _html;
      if (_onclick) goalBtn.onclick = _onclick;
      stage.appendChild(goalBtn);
    }
  }

  // 背景の火の粉（CSSのみで常時ゆらめく・reduced-motionでは非表示）＝画面が止まって見えない
  const emb = el("div", "hl-embers");
  emb.innerHTML = "<span></span><span></span><span></span><span></span><span></span><span></span><span></span>";
  stage.appendChild(emb);

  // 左下カラム：📌ピン留め（次の目標）＋📋デイリーミッション（ライブ告知風・表示のみ）＋流れるコメント
  const left = el("div", "hl-left");
  if (goalLine) left.appendChild(el("div", "hl-pin", "📌 " + goalLine));
  left.appendChild(el("div", "hl-pin hl-missions", "📋 " + _dailyMissionText()));
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
  const _vB = viewersEl.querySelector("b");
  _vB.textContent = _fmtV(_viewers);
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") { window._hlTimers.forEach(clearInterval); return; }
    _viewers = Math.max(120, Math.round(_viewers * (1 + (Math.random() - 0.48) * 0.05)));
    _vB.textContent = _fmtV(_viewers);
  }, 2600));

  const _CMN = ["竜見の村人", "観客アヤ", "常連のジジ", "旅の予想屋", "バニー推し", "島っ子", "屋台のおやじ", "夜勤あけ", "遠征組", "はじめて見た",
    "竜舎の常連", "村の子ども", "予想ノート勢", "観光客さん", "ベテラン勢", "屋台の常連", "通りすがり", "町外れの占い師"];
  const _CMC = ["#57b1dd", "#6ac06a", "#e0a0c0", "#caa44a", "#9a6ad0", "#ff9a5c"];
  const _CMT = ["ミミちゃん今日も推す！", "初見です！よろしく！", "🐲🐲🐲", "ぱほぱほ〜！", "今日こそ波乱こい", "本命党です", "穴党ですが何か", "耳ぴょこぴょこかわいい", "その衣装どこで買ったの？", "レースまだかな", "🔥🔥🔥", "💖💖", "ポロちゃん推し", "オッズ見てから来た", "村から応援してます", "🥕どうぞ", "昨日の波乱すごかった", "おやつ持ってきた", "今日の本命教えて", "かわいいの域を超えてる",
    "今日も配信おつかれ！", "ミミちゃんの予想たより", "次のレースわくわく", "本命か穴か悩む〜", "耳ぴょこんかわいすぎ", "今日の調子どう？", "いっしょにドキドキしたい", "竜たちかっこいい！", "また来ちゃった！", "投げ銭しちゃう🪙", "実況たのしみ", "推し竜に全ツッパ", "コメント読んでくれる？", "ぱほぱほ言って〜", "癒やされる〜", "がんばれミミちゃん！", "今日のラッキー竜は？", "村の誇りだよ"];
  function _addCm(name, color, text, cls) {
    const d = el("div", "hl-cm" + (cls ? " " + cls : ""), `<b style="color:${color}">${name}</b>${text}`);
    cms.appendChild(d);
    while (cms.children.length > 6) cms.removeChild(cms.firstChild);
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
      const met = Object.keys(STORY_CAST).filter(k => (p.totalAssets || 0) >= castUnlockAt(k));
      if (met.length && Math.random() < 0.16) {
        const c = STORY_CAST[met[Math.floor(Math.random() * met.length)]];
        let t = (STORY_RACE_VOICE && STORY_RACE_VOICE[c.key]) || c.gives;
        if (t.length > 34) t = t.slice(0, 33) + "…";
        _addCm(c.symbol + c.name.split("・")[0], c.color, t);
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
    _addCm(_CMN[Math.floor(Math.random() * _CMN.length)], _CMC[Math.floor(Math.random() * _CMC.length)], _CMT[Math.floor(Math.random() * _CMT.length)]);
  }
  _randCm(); setTimeout(_randCm, 900);
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") return;
    if (Math.random() < 0.7) _randCm();
  }, 3300));

  function _heart(x, y, ch) {
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

  // 入場通知（TikTokの "joined" 風・表示専用）：ときどき誰かが遊びに来る
  function _joinCm() {
    const nm = _CMN[Math.floor(Math.random() * _CMN.length)];
    _addCm("🌟" + nm, "#b9a0ff", " が遊びにきた！", "join");
  }
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") return;
    if (Math.random() < 0.4) _joinCm();
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
  window._hlTimers.push(setInterval(() => {
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

  // ── 下段（固定ドック）：レースへ進む → ナビ のみ。★進行で出入りする可変要素（コメント/いいね・無心・最終決戦）は
  //   この上の独立フロート層(.hl-actionbar)へ分離＝出入りしても固定ドックを圧縮しない（ユーザー指摘）。stage(flex:1)が伸縮を吸収。
  const dock = el("div", "hl-dock");
  const actionFloat = el("div", "hl-actionbar");

  // コメントバー（TikTok風の参加UI・完全に表示専用）：定型コメントを「あなた」として流す＋❤️いいね
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
  // ❤️いいね：タップでカウント＋ハート噴出。自動でもじわじわ増える（ライブ感・表示専用）
  let _likes = 1200 + Math.floor(_viewers * 6) + p.completedRaces * 15;
  const _fmtL = v => v >= 10000 ? (v / 10000).toFixed(1) + "万" : v.toLocaleString("ja-JP");
  const likeBtn = el("button", "hl-likebtn", `❤️<b>${_fmtL(_likes)}</b>`);
  const _setLike = () => { const b = likeBtn.querySelector("b"); if (b) b.textContent = _fmtL(_likes); };
  likeBtn.onclick = () => {
    _likes += 1; _setLike();
    if (!_reduce) { const r = stage.getBoundingClientRect(); if (r.width) for (let i = 0; i < 2; i++) _heart(r.width * (0.78 + Math.random() * 0.16), r.height * (0.55 + Math.random() * 0.3)); }
    if (Math.random() < 0.07) mimiSay("いいね、ありがとっ！");
  };
  window._hlTimers.push(setInterval(() => {
    if (state.ui.screen !== "home") return;
    if (Math.random() < 0.7) { _likes += 1 + Math.floor(Math.random() * 3); _setLike(); }
  }, 2600));
  cmbar.appendChild(likeBtn);
  cmwrap.appendChild(qr); cmwrap.appendChild(cmbar);
  actionFloat.appendChild(cmwrap);   // コメント/いいねバー＝フロート層の最下段（レースへ進むの直上に浮く）

  // §38 — 破産時：最優先で「無心」導線（フロート層・コメントバーの上に積む）
  if (p.coins <= 0) {
    const begAmt = (typeof calculateRescueCoins === "function") ? calculateRescueCoins(state, p.rank) : 300;
    const broke = el("button", "hl-broke", `🙏 無心する　基準額 ${fmtCoins(begAmt)} 相当`);
    broke.onclick = () => showMushinOverlay();
    actionFloat.insertBefore(broke, cmwrap);
  }

  // 終章：最終決戦の準備が整ったらフロート層の最上段に目立つCTA。綱引き中の絶滅メーターは🎯目標チップに統合済み。
  //   詳細は🏦島の経済へ。表示専用＝実オッズ非干渉。
  if (typeof epilogueOn === "function" && epilogueOn() && epData().finalReady) {
    const fin = el("button", "hl-final", `⚔️ 最終決戦へ ▶`);
    fin.onclick = () => { if (typeof startFinalBattle === "function") startFinalBattle(); };
    actionFloat.insertBefore(fin, actionFloat.firstChild);
  }
  // 可変要素は stage(flex:1) と 固定dock の間の独立フロート層へ＝出入りしても固定ドックを圧縮しない。
  if (actionFloat.children.length) wrap.appendChild(actionFloat);

  const raceBtn = el("button", "hl-race", "🐉 レースへ進む");
  raceBtn.onclick = () => renderRaceSelect();
  dock.appendChild(raceBtn);

  const rail = el("div", "hl-rail");
  const navItem = (icon, label, desc, go) => {
    const b = el("button", "hl-item", `<span class="ic">${icon}</span><span class="lb">${label}</span>`);
    b.onclick = () => showNavConfirm(icon, label, desc, go);
    return b;
  };
  rail.appendChild(navItem("🏠", "暮らし", "総資産と暮らしの歩みを確認します。", () => renderAssets()));
  if (typeof renderMeals === "function") rail.appendChild(navItem("🍽️", "食事", "ミミの食べ歩きコレクション。食べて・当てて集めます。", () => renderMeals()));
  if (mallUnlocked()) {
    rail.appendChild(navItem("🛍️", "モール", "ミミの衣装を買って、自由に着替えます。", () => renderMall()));
  } else {
    // 初的中で解放（解放時はサケの解説＋プレゼントつき）
    const lockedMall = el("button", "hl-item locked", `<span class="ic">🔒</span><span class="lb">モール</span>`);
    lockedMall.onclick = () => showInfoPopup("🛍️ ショッピングモール",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて的中</u>すると解放されます。勝てば、いいことがあるかも？</small></div></div>`);
    rail.appendChild(lockedMall);
  }
  // 竜まわりナビ：龍舎(ポロ発見=2勝)が解放済みなら🐲龍舎（図鑑・竜スカウトは龍舎の中の導線に集約）。
  // 図鑑は「第4話＝マクラと推し竜文化」に会ってから解放（ユーザー指定）。龍舎前にマクラに会った稀ケースの
  // みここで図鑑を単独ナビに。アイコンは🐲（🏠暮らしと重複回避）。
  if (typeof poroStableUnlocked === "function" && poroStableUnlocked()) {
    rail.appendChild(navItem("🐲", "龍舎", "ポロと出会った竜たちの拠点。なでて仲良く＋竜スカウト＋（図鑑）。", () => renderStable()));
  } else if (typeof dexUnlocked === "function" && dexUnlocked()) {
    rail.appendChild(navItem("📖", "図鑑", "出会った竜の記録を見ます。", () => renderCollection()));
  }
  rail.appendChild(navItem("📜", "物語", "ミミと5人の物語を読み進めます。", () => renderStory()));
  // 📱 SNS＝タイムライン＋ファンレターを1画面にタブ統合（予想入門・相談は設定/暮らしへ移設済）。
  if (typeof renderSns === "function") {
    const unread = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
    rail.appendChild(navItem("📱", "SNS", unread ? `島の投稿＋ファンレター（未読 ${unread} 通）。` : "島のみんなの投稿とファンレター。", () => renderSns()));
  }
  rail.appendChild(navItem("⚙️", "設定", "サウンド・情報量・村のようす・データ。", () => renderSettings()));
  rail.appendChild(navItem("📣", "シェア", "友達にこのゲームを教えます。", () => shareGameInfo()));
  // 列数を“実際の項目数”に追従させ、右に空きセル（隙間）ができるのを防ぐ。8以下は1行、9以上は2行に均等割り。
  const _rn = rail.children.length;
  rail.style.gridTemplateColumns = "repeat(" + (_rn <= 8 ? _rn : Math.ceil(_rn / 2)) + ", 1fr)";
  dock.appendChild(rail);
  wrap.appendChild(dock);

  app.appendChild(wrap);
}
