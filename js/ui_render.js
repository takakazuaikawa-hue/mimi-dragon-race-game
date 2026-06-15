/**
 * ui_render.js — all screen renderers.
 *
 * Screens implemented (in render-function form, dispatched by main.js):
 *   home / race_select / race_detail / race_run / result / analysis /
 *   village / collection / help.
 *
 * DOM helpers `$` and `el` live in utils.js.
 *
 * EXTENSION POINT — new screen:
 *   1. Add render<NewScreen>() following the pattern (set state.ui.screen,
 *      clear #app, append elements, end with .actions buttons).
 *   2. Wire it into the rerenderCurrent map in main.js.
 *   3. Add a navigation button on the home screen (or wherever entry lives).
 */

function updateHeader() {
  const coinEl = $("coin-display");
  const next = fmtCoins(state.player.coins);
  // Pop the counter whenever the balance actually changes (win / spend), so the
  // header gives a beat of feedback instead of silently swapping numbers.
  if (coinEl && coinEl.dataset.v != null && coinEl.dataset.v !== next) {
    coinEl.classList.remove("coin-bump"); void coinEl.offsetWidth; coinEl.classList.add("coin-bump");
  }
  if (coinEl) { coinEl.textContent = next; coinEl.dataset.v = next; }
  $("rank-display").textContent = state.player.rank;
}

// =====================================================================
// Screen transition controller — gives navigation a sense of depth and a
// tactile feel, so moving between menus reads like a polished app instead
// of a hard cut. Every screen render routes its app.innerHTML="" through
// beginScreen(), which picks a forward/back slide (by screen depth), a
// "into the race" zoom, or an expand-from-the-tapped-card hero transition.
// =====================================================================
const SCREEN_DEPTH = {
  title: 0, home: 1,
  race_select: 2, village: 2, collection: 2, assets: 2, help: 2, settings: 2, mall: 2, stable: 2, scout: 2,
  story: 3, consult: 3, race_detail: 3, life_tree: 3, life_collection: 3, active_skills: 3, poro_gourmet: 3,
  story_read: 4, race_run: 4, result: 5, analysis: 6
};
let _prevScreen = null;
let _heroRect = null;   // rect of a tapped card, to expand from on the next screen

function beginScreen() {
  const app = $("app");
  const screen = state.ui.screen;
  const prev = _prevScreen;
  app.classList.remove("nav-fwd", "nav-back", "nav-same", "nav-racestart");
  if (screen !== "home") document.body.classList.remove("home-mode");   // ホーム以外は#header表示
  if (typeof syncVolumeFab === "function") syncVolumeFab();              // 🔊 全画面常設の音量ボタンを画面に合わせて表示/非表示
  if (prev !== screen) window.scrollTo(0, 0);   // start every new screen at the top

  // Hero "expand from the tapped card" (race card → detail) takes priority.
  if (_heroRect && screen === "race_detail") {
    const from = _heroRect; _heroRect = null;
    app.innerHTML = "";
    _prevScreen = screen;
    requestAnimationFrame(() => flipExpand(app, from));
    return app;
  }

  let cls = "nav-same";
  if (prev !== screen) {
    if (screen === "race_run") {
      cls = "nav-racestart";                 // anticipation zoom into the broadcast
    } else {
      const a = SCREEN_DEPTH[prev] != null ? SCREEN_DEPTH[prev] : 0;
      const b = SCREEN_DEPTH[screen] != null ? SCREEN_DEPTH[screen] : 0;
      cls = b >= a ? "nav-fwd" : "nav-back";
    }
    if (window.Sfx) Sfx.play(screen === "race_run" ? "streak" : "nav");
  }
  app.classList.add(cls);
  app.innerHTML = "";
  _prevScreen = screen;
  // quick back button pinned at the very top of sub-pages (sticky), so you don't have to
  // scroll to the bottom. Menu pages → ホーム / drill-downs → their parent. (Bottom stays too.)
  const TOP_BACK = {
    race_select: "home", assets: "home", village: "home", collection: "home", help: "home", story: "home", consult: "home", settings: "home", mall: "home", stable: "home", scout: "home", goals: "home", meals: "home",
    life_tree: "assets", life_collection: "assets", active_skills: "assets", story_read: "story"
  };
  const BACK_TGT = { home: { l: "← ホーム", f: renderHome }, assets: { l: "← 暮らし", f: renderAssets }, story: { l: "← 物語", f: renderStory } };
  const bt = BACK_TGT[TOP_BACK[screen]];
  if (bt) {
    const tb = el("div", "topback");
    const b = el("button", "topback-btn", bt.l);
    b.onclick = () => bt.f();
    tb.appendChild(b);
    app.appendChild(tb);
  }
  return app;
}

// FLIP "container transform": animate the freshly-rendered screen out from
// the rect of the element that was tapped (translateY/scale only — never
// touches layout, so it's safe to run over canvas-backed screens too).
function flipExpand(app, from) {
  const to = app.getBoundingClientRect();
  if (!from || !to.width || !to.height) return;
  const sx = Math.max(0.05, from.width / to.width);
  const sy = Math.max(0.05, from.height / to.height);
  const tx = from.left - to.left;
  const ty = from.top - to.top;
  app.style.transformOrigin = "top left";
  app.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + sx + "," + sy + ")";
  app.style.opacity = "0.55";
  void app.offsetWidth;                       // commit the start frame
  app.style.transition = "transform .28s cubic-bezier(.22,.61,.36,1), opacity .24s ease";
  app.style.transform = "none";
  app.style.opacity = "1";
  window.setTimeout(() => {
    app.style.transition = ""; app.style.transformOrigin = "";
    app.style.transform = ""; app.style.opacity = "";
  }, 320);
}

// =========================================================================
// Title screen — the commercial first impression. No image files (hard
// constraint): the key art is pure CSS (night sky, moon, stars, gradient
// logo) plus an animated pixel-dragon mascot rendered on a canvas by reusing
// the race sprite. Hides the dev HUD header for a clean opening beat.
// =========================================================================
function renderTitle() {
  state.ui.screen = "title";
  document.body.classList.add("title-mode");
  const app = beginScreen();
  const wrap = el("div", "title-screen");
  wrap.innerHTML = `
    <div class="title-bg"></div>
    <div class="title-stars"></div>
    <div class="title-moon"></div>
    <div class="title-photo">${typeof photoOr === "function" ? photoOr("images/title_bg.webp", "") : ""}</div>
    <div class="title-inner">
      <div class="title-head">
        <h1 class="title-logo"><span class="tl-main">聖龍爆走録</span> <span class="tl-mimi">ミミ</span></h1>
        <div class="title-novel">転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件</div>
        <canvas id="title-dragon" class="title-dragon" width="184" height="120"></canvas>
      </div>
      <div class="title-actions"></div>
    </div>`;
  app.appendChild(wrap);

  const acts = wrap.querySelector(".title-actions");
  const start = el("button", "title-cta", "▶ はじめる");
  start.onclick = () => renderHome();
  acts.appendChild(start);

  // §40 — 一枚絵を“全景”で鑑賞するモード：テキスト/UIを任意に隠して全画面表示。
  // タップでテキストに戻る。表示専用（状態は変えない）。
  const artBtn = el("button", "title-artbtn", "🖼 イラストを全画面で見る");
  artBtn.onclick = (e) => { e.stopPropagation(); wrap.classList.add("art-only"); };
  acts.appendChild(artBtn);
  wrap.appendChild(el("div", "title-artback", "タップでテキストを表示"));
  wrap.addEventListener("click", () => { if (wrap.classList.contains("art-only")) wrap.classList.remove("art-only"); });

  // animated pixel-dragon mascot (reuses the race sprite); self-stops on screen change
  const cv = document.getElementById("title-dragon");
  if (cv && cv.getContext && typeof rcDrawDragon === "function") {
    const tctx = cv.getContext("2d");
    let g = 1.7;
    (function frame() {
      if (!document.body.contains(cv)) return;
      tctx.clearRect(0, 0, cv.width, cv.height);
      g += 0.11;
      rcDrawDragon(tctx, {
        x: cv.width / 2 + 7, y: cv.height / 2 + 28 + Math.sin(g * 0.5) * 5, scale: 1.9, noBuild: true,
        color: "#ffd54a", style: "escape", gait: g, flap: g * 0.6, lean: 0.5, glow: 0.6
      });
      requestAnimationFrame(frame);
    })();
  }
}

// 称号スイッチャー（ホーム左上のプロフィールから）：取得済み（習い事を極めた）称号を
// ホーム表示用に切り替える。表示専用＝着順/オッズ/配当・経済には一切干渉しない。
function showTitleSwitcher() {
  const p = state.player;
  const as = p.activeSkills || {};
  const earned = (typeof ACTIVE_SKILLS !== "undefined" ? ACTIVE_SKILLS : []).filter(s => (as[s.id] || 0) >= s.levels.length);
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop titlepop");
  const close = () => ov.remove();
  if (!earned.length) {
    box.innerHTML =
      `<div class="navpop-ic">🏅</div><div class="navpop-t">称号をえらぶ</div>` +
      `<div class="navpop-d">まだ称号がありません。<br>「習い事」を極めると獲得できます。</div>`;
    const btns = el("div", "navpop-btns");
    const cancel = el("button", "navpop-cancel", "閉じる"); cancel.onclick = close;
    const go = el("button", "navpop-go", "習い事へ ▶"); go.onclick = () => { close(); renderActiveSkills(); };
    btns.appendChild(cancel); btns.appendChild(go); box.appendChild(btns);
  } else {
    box.innerHTML =
      `<div class="navpop-ic">🏅</div><div class="navpop-t">称号をえらぶ</div>` +
      `<div class="navpop-d">ホームに飾る称号を切り替えます。</div>`;
    const list = el("div", "titlepop-list");
    const cur = p.equippedTitle || null;
    const mkRow = (id, label) => {
      const on = (cur === id);
      const b = el("button", "titlepop-row" + (on ? " on" : ""), `<span>${label}</span>${on ? `<span class="titlepop-chk">✓</span>` : ""}`);
      b.onclick = () => {
        p.equippedTitle = id;
        if (typeof saveGame === "function") saveGame();
        close();
        if (typeof updateHeader === "function") updateHeader();
        renderHome();
      };
      return b;
    };
    list.appendChild(mkRow(null, "🚫 称号なし"));
    earned.forEach(s => list.appendChild(mkRow(s.id, `${s.icon} ${s.title}`)));
    box.appendChild(list);
    const btns = el("div", "navpop-btns");
    const cancel = el("button", "navpop-cancel", "閉じる"); cancel.onclick = close;
    btns.appendChild(cancel); box.appendChild(btns);
  }
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.appendChild(ov);
}

// 🛍️ モール解放判定：レースで初めて的中すると解放（flags.everHit）。既存セーブ救済として
// 単勝勝利歴・衣装の購入/入手歴・着替え歴があれば解放済み扱い（巻き戻さない）。表示専用。
function mallUnlocked() {
  const p = state.player || {}; const f = p.flags || {};
  return !!(f.everHit || f.mallIntroSeen || (p.wins || 0) >= 1 ||
    (p.outfitsBought && p.outfitsBought.length) || (p.outfitsWon && p.outfitsWon.length) ||
    (p.outfit && typeof DEFAULT_OUTFIT !== "undefined" && p.outfit !== DEFAULT_OUTFIT));
}

// 汎用インフォポップアップ（？ボタン用）：説明はふだん隠し、気になった時だけ読む（オンボーディング方針）。
function showInfoPopup(title, html) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop infopop");
  box.innerHTML = `<div class="navpop-t">${title}</div><div class="infopop-body">${html}</div>`;
  const btns = el("div", "navpop-btns");
  const ok = el("button", "navpop-go", "わかった！"); ok.onclick = () => ov.remove();
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

// 🔊 音量パネル（都度呼び出し）。BGM／効果音の音量スライダー＋ミュート。
// 表示専用＝着順・オッズ・配当には一切非干渉（音だけ）。設定は localStorage に保存。
function showVolumePanel() {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop vol-panel");
  const isMuted = () => !!(window.Sfx && Sfx.isMuted && Sfx.isMuted());
  const bgmV = Math.round(((window.RaceBgm && RaceBgm.getVolume) ? RaceBgm.getVolume() : 1) * 100);
  const sfxV = Math.round(((window.Sfx && Sfx.getVolume) ? Sfx.getVolume() : 1) * 100);
  box.innerHTML =
    `<div class="navpop-t">🔊 音量</div>` +
    `<div class="vol-mute-row"><span class="vol-mute-lb">${isMuted() ? "🔇 ミュート中" : "🔊 サウンド ON"}</span>` +
      `<button class="set-toggle${isMuted() ? "" : " on"} vol-mute-btn">${isMuted() ? "OFF" : "ON"}</button></div>` +
    `<div class="vol-row"><span class="vol-ic">🎵</span><span class="vol-lb">BGM</span>` +
      `<input type="range" class="vol-slider vol-bgm" min="0" max="100" value="${bgmV}"><span class="vol-pct vol-bgm-pct">${bgmV}%</span></div>` +
    `<div class="vol-row"><span class="vol-ic">🔊</span><span class="vol-lb">効果音</span>` +
      `<input type="range" class="vol-slider vol-sfx" min="0" max="100" value="${sfxV}"><span class="vol-pct vol-sfx-pct">${sfxV}%</span></div>` +
    `<div class="vol-note">レースの結果・オッズ・配当には影響しません</div>`;
  const btns = el("div", "navpop-btns");
  const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => ov.remove();
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);

  const bgmS = box.querySelector(".vol-bgm"), sfxS = box.querySelector(".vol-sfx");
  const bgmP = box.querySelector(".vol-bgm-pct"), sfxP = box.querySelector(".vol-sfx-pct");
  const muteBtn = box.querySelector(".vol-mute-btn");
  const syncMuted = () => { const m = isMuted(); bgmS.disabled = m; sfxS.disabled = m; box.classList.toggle("vol-muted", m); };
  syncMuted();
  bgmS.oninput = () => { const v = +bgmS.value; bgmP.textContent = v + "%"; if (window.RaceBgm && RaceBgm.setVolume) RaceBgm.setVolume(v / 100); };
  sfxS.oninput = () => { const v = +sfxS.value; sfxP.textContent = v + "%"; if (window.Sfx && Sfx.setVolume) Sfx.setVolume(v / 100); };
  sfxS.onchange = () => { if (window.Sfx && Sfx.play && !isMuted()) Sfx.play("tick"); };  // 離した瞬間に試聴
  muteBtn.onclick = () => {
    const m = !isMuted();
    if (window.Sfx && Sfx.setMuted) Sfx.setMuted(m);
    if (window.RaceBgm && RaceBgm.setMuted) RaceBgm.setMuted(m);
    muteBtn.textContent = m ? "OFF" : "ON";
    muteBtn.classList.toggle("on", !m);
    box.querySelector(".vol-mute-lb").textContent = m ? "🔇 ミュート中" : "🔊 サウンド ON";
    if (!m && window.Sfx && Sfx.play) Sfx.play("click");
    syncMuted();
  };
}
// 🔊 グローバル常設の音量ボタン（全画面で同じ位置＝既存作品の作法／consistent placement）。
// body直下に1つだけ常駐。z-index は VN(200)・モーダル/カットイン(9000+)・エンディング(4000) より低い 150 なので、
// それらの最中は覆われて自然に隠れ、閉じれば再び現れる（明示的な開閉ロジック不要）。
function mountVolumeFab() {
  let fab = document.getElementById("vol-fab");
  if (!fab) {
    fab = el("button", "vol-fab", "🔊"); fab.id = "vol-fab"; fab.title = "音量";
    fab.onclick = (e) => { e.stopPropagation(); if (typeof showVolumePanel === "function") showVolumePanel(); };
    document.body.appendChild(fab);
  }
  return fab;
}
// 画面に応じて表示/非表示（beginScreen から毎遷移で呼ぶ）。ホームはナビに⚙️設定（🎚音量）があり
// 下部が密なので隠す。タイトル・レース・物語・結果・設定など他の全画面では表示。
function syncVolumeFab() {
  const fab = mountVolumeFab();
  const screen = state.ui && state.ui.screen;
  fab.style.display = (screen === "home") ? "none" : "flex";
}

// 💰 お金のしくみ（通貨マップ）：どの数字が何のためにあり、何につながるかを1枚で明示。
// 設計：1通貨1役割／コイン→総資産→解放（物語・ランク・暮らしP）の一方向の流れを見せる。
function showMoneyMap() {
  showInfoPopup("💰 お金のしくみ", `
    <div class="mm-flow">🪙 勝つ → 🏦 育つ → 🔓 解放される</div>
    <div class="mm-row"><span class="mm-ic">🪙</span><div><b>コイン</b><small>賭けるお金。配当・ログボで増え、賭け・お買い物で減る。<u>減っても物語は戻らない</u>。</small></div></div>
    <div class="mm-row"><span class="mm-ic">🏦</span><div><b>総資産</b><small>人生の最高到達点（下がらない）。コインの最高記録＋生活資産＋名声。<u>物語・衣装・ランクを解放するカギ</u>。</small></div></div>
    <div class="mm-row"><span class="mm-ic">🌱</span><div><b>暮らしP</b><small>総資産が伸びると貯まる。くらしツリーの解放に使う。</small></div></div>
    <div class="mm-row"><span class="mm-ic">🏅</span><div><b>ランク</b><small>出走と勝利で昇格。新しいレースが解放される。</small></div></div>
    <div class="mm-row"><span class="mm-ic">🎫</span><div><b>メダル・かけら</b><small>モール探検専用。常連特典と衣装交換に。コインとは別のお財布。</small></div></div>
    <div class="mm-row"><span class="mm-ic">💗</span><div><b>視聴者・いいね</b><small>配信のにぎわい（飾り）。勝負には影響しない。</small></div></div>`);
}

// Minimal-text nav: tapping a menu button opens a small description popup with
// 進む（proceed）/ キャンセル, so the home stays uncluttered but every button explains itself.
function showNavConfirm(icon, title, desc, onGo) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop");
  box.innerHTML =
    `<div class="navpop-ic">${icon}</div><div class="navpop-t">${title}</div><div class="navpop-d">${desc}</div>` +
    `<div class="navpop-btns"><button class="navpop-cancel">キャンセル</button><button class="navpop-go">進む ▶</button></div>`;
  ov.appendChild(box);
  document.body.appendChild(ov);
  const close = () => ov.remove();
  box.querySelector(".navpop-cancel").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  box.querySelector(".navpop-go").onclick = () => { close(); onGo(); };
}

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
  // 本体タップ＝鑑賞＆きせかえビューア（大きい立ち絵＋説明、スワイプ/◀▶で所持衣装めくり・無料着替え）。
  // きせかえ専用ボタンは廃止（モールはナビ🛍️とビューア内「モールで買う」から）。
  mimi.title = "タップで鑑賞＆きせかえ";
  mimi.onclick = (e) => { e.stopPropagation(); showMimiViewer(); };
  stage.appendChild(mimi);

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

  // 🎯 目標（クエスト）チップ：ステージ左上に常設。現在の目標＋進捗。タップで一覧へドリルダウン（表示専用・js/goals.js）。
  if (typeof nextGoal === "function") {
    const _ng = nextGoal(); const _gs = (typeof goalsStats === "function") ? goalsStats() : { done: 0, total: 0 };
    const goalBtn = el("button", "hl-goal");
    goalBtn.innerHTML = _ng
      ? `<span class="hl-goal-k">🎯 つぎの目標</span><span class="hl-goal-t">${_ng.icon} ${_ng.title}</span><span class="hl-goal-p"><i style="width:${_gs.total ? Math.round(_gs.done / _gs.total * 100) : 0}%"></i></span><span class="hl-goal-n">${_gs.done}/${_gs.total} 達成 ▸</span>`
      : `<span class="hl-goal-k">🎯 目標</span><span class="hl-goal-t">✨ すべて達成しました！</span><span class="hl-goal-n">${_gs.done}/${_gs.total} ▸</span>`;
    goalBtn.onclick = () => { if (typeof renderGoals === "function") renderGoals(); };
    stage.appendChild(goalBtn);
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

  // ── 下段ドック（すっきり）：コメントバー → (破産時)無心 → レースCTA → ナビ。
  // 資産情報はヘッダー、出走/ランク/目標はステージ上のフロートへ移動済み＝ミミの領域を最大化。
  const dock = el("div", "hl-dock");

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
  dock.appendChild(cmwrap);

  // §38 — 破産時：最優先で「無心」導線
  if (p.coins <= 0) {
    const begAmt = (typeof calculateRescueCoins === "function") ? calculateRescueCoins(state, p.rank) : 300;
    const broke = el("button", "hl-broke", `🙏 無心する　基準額 ${fmtCoins(begAmt)} 相当`);
    broke.onclick = () => showMushinOverlay();
    dock.appendChild(broke);
  }

  // 終章：絶滅メーター（綱引き）HUD＋最終決戦の導線（終章中のみ・表示専用＝実オッズ非干渉）。js/epilogue_engine.js
  if (typeof epilogueOn === "function" && epilogueOn()) {
    const e = epData(); const dial = epilogueDial().toFixed(2); const prog = epilogueProgress();
    if (e.finalReady) {
      const fin = el("button", "hl-final", `⚔️ 最終決戦へ ▶`);
      fin.onclick = () => { if (typeof startFinalBattle === "function") startFinalBattle(); };
      dock.appendChild(fin);
    } else {
      const zone = (typeof epilogueZone === "function") ? epilogueZone() : "mid";
      const react = (typeof epilogueDialReaction === "function") ? epilogueDialReaction() : "";
      const hud = el("div", "ep-hud ep-hud--" + zone + (react ? " ep-react-" + react : ""));
      hud.innerHTML =
        `<div class="ep-hud-top"><span class="ep-hud-ttl">☄️ 絶滅メーター <button class="info-q" title="絶滅メーターって？">？</button></span>` +
        `<span class="ep-hud-odds">答えの単勝 <b class="ep-dial-num">${dial}</b><span class="ep-dial-x">倍</span></span></div>` +
        `<div class="ep-dial"><div class="ep-dial-track"><span class="ep-dial-needle" style="left:${prog}%"></span></div>` +
        `<div class="ep-dial-scale"><span class="ep-tk ep-tk-doom">1.0<small>淘汰</small></span>` +
        `<span class="ep-tk ep-tk-mid">1.05</span>` +
        `<span class="ep-tk ep-tk-safe">1.1<small>安全</small></span></div></div>` +
        `<div class="ep-hud-note">スカウト・暮らし・買い物・的中で押し戻す（0で最終決戦）</div>`;
      const _q = hud.querySelector(".info-q");
      if (_q) _q.onclick = (ev) => { ev.stopPropagation(); if (typeof showEpilogueMeterHelp === "function") showEpilogueMeterHelp(); };
      dock.appendChild(hud);
      if (typeof maybeShowMeterHelpFirstTime === "function") maybeShowMeterHelpFirstTime();  // 初表示時に一度だけ自動で説明
    }
  }

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
  rail.appendChild(navItem("💬", "相談", "顧問から予想の視点をもらいます。", () => renderConsult()));
  rail.appendChild(navItem("🎓", "予想入門", "賭けの基礎をやさしく学びます。", () => renderHelp()));
  rail.appendChild(navItem("⚙️", "設定", "サウンド・情報量・村のようす・データ。", () => renderSettings()));
  rail.appendChild(navItem("📣", "シェア", "友達にこのゲームを教えます。", () => shareGameInfo()));
  // 列数を“実際の項目数”に追従させ、右に空きセル（隙間）ができるのを防ぐ。8以下は1行、9以上は2行に均等割り。
  const _rn = rail.children.length;
  rail.style.gridTemplateColumns = "repeat(" + (_rn <= 8 ? _rn : Math.ceil(_rn / 2)) + ", 1fr)";
  dock.appendChild(rail);
  wrap.appendChild(dock);

  app.appendChild(wrap);
}

// =========================================================================
// §30 — 暮らしと資産 (total-asset / lifestyle) screen.
// Two layers (§9): A. numeric breakdown, B. ミミの生活. Plus story progress +
// the life-asset list (auto-unlocked + purchasable cosmetics). This screen is
// read/cosmetic only — it never changes coins except via an explicit purchase,
// and never touches race results.
// =========================================================================
// =========================================================================
// §38 — 「無心する」演出（破産リカバリー）。ホームの無心ボタンから呼ぶ。受け取る額 =
// calculateRescueCoins（基準の救済額）。額の計算は一切変えず、“受け取り方”を黒背景の
// 「ぱほぱほ。。。」という小芝居にしただけ（着順/オッズ/配当には非干渉）。
// =========================================================================
function showMushinOverlay() {
  if (document.getElementById("mushin-ov")) return;
  const ov = el("div", "mushin-overlay"); ov.id = "mushin-ov";
  const amt = (typeof calculateRescueCoins === "function") ? calculateRescueCoins(state, state.player.rank) : 300;
  ov.innerHTML =
    `<div class="mushin-card">` +
      `<div class="mushin-q">村のみんなに……</div>` +
      `<div class="mushin-title">無心する？</div>` +
      `<div class="mushin-sub">そっと頭を下げて、基準額をお願いする。<br>賭けに使えるコインを <b>${fmtCoins(amt)}</b> もらえます。</div>` +
    `</div>`;
  const card = ov.querySelector(".mushin-card");
  const go = el("button", "mushin-go", "🙏 無心する");
  go.onclick = () => runMushin(ov, amt);
  card.appendChild(go);
  document.body.appendChild(ov);
}

// 黒背景に「ぱほぱほ。。。」を少しずつ出してから、受け取り画面へ。
function runMushin(ov, amt) {
  ov.classList.add("dark");
  ov.innerHTML = `<div class="mushin-paho" id="mushin-paho"></div>`;
  const box = ov.querySelector("#mushin-paho");
  const lines = ["ぱほ。。。", "ぱほぱほ。。。", "ぱほぱほ。。。ぱほぱほ。。。"];
  let i = 0;
  (function step() {
    if (i < lines.length) {
      box.appendChild(el("div", "paho-line", lines[i]));
      try { if (window.Sfx) Sfx.play("tick"); } catch (e) {}
      i++;
      setTimeout(step, 760);
    } else {
      setTimeout(() => finishMushin(ov, amt), 720);
    }
  })();
}

function finishMushin(ov, amt) {
  state.player.coins += amt;                          // 額・計算は不変（基準の救済額）
  state.player.brokeCount = (state.player.brokeCount || 0) + 1;   // 終章伏線：破産回数（救済額には非干渉・演出のみ）
  if (typeof bumpMaxCoins === "function") bumpMaxCoins();
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  if (typeof saveGame === "function") saveGame();
  try { if (window.Sfx) Sfx.play("coin"); } catch (e) {}
  ov.classList.remove("dark"); ov.classList.add("done");
  ov.innerHTML =
    `<div class="mushin-card">` +
      `<div class="mushin-got-ic">💰</div>` +
      `<div class="mushin-got">村のみんなが、そっと握らせてくれた</div>` +
      `<div class="mushin-amt">+${fmtCoins(amt)}<span> コイン</span></div>` +
      `<div class="mushin-sub">ありがとう。…次は、当てる。</div>` +
    `</div>`;
  const done = el("button", "mushin-go", "立て直す ▶");
  done.onclick = () => {
    ov.remove();
    if (typeof updateHeader === "function") updateHeader();
    // 終章伏線：破産3回超で「知らないお姉さん」が現れる（VN再生時は内部で renderHome する）。
    if (typeof maybeStrangerCameo === "function" && maybeStrangerCameo()) return;
    renderHome();
  };
  ov.querySelector(".mushin-card").appendChild(done);
}

// §38 — スキルツリー解放カットイン。地味な生活アップグレードを大げさに祝う“ばかばかしさ”。
// 表示専用：状態は一切変えない。約1.1秒で自動消滅／タップで即スキップ。
const LT_CUTIN_LINES = [
  "ミミ、また一歩……！", "これが、再起の証……！", "暮らしが、進化した。", "村が、どよめいた。",
  "伝説は、こうして紡がれる。", "世界が、ミミに気づきはじめる。", "今日も、生きててえらい。", "聖龍も、頷いている。"
];
let _ltCutinTimer = null;
function showLifeCutin(node) {
  try {
    const ex = document.getElementById("lt-cutin"); if (ex) ex.remove();
    if (_ltCutinTimer) { clearTimeout(_ltCutinTimer); _ltCutinTimer = null; }
    const branch = (typeof LIFE_BRANCHES !== "undefined") ? LIFE_BRANCHES.find(b => b.id === node.branch) : null;
    const color = (branch && branch.color) || "#e6b24a";
    const sub = LT_CUTIN_LINES[Math.floor(Math.random() * LT_CUTIN_LINES.length)];
    const ov = el("div", "lt-cutin"); ov.id = "lt-cutin";
    ov.style.setProperty("--bc", color);
    ov.innerHTML =
      `<div class="lt-cutin-flash"></div><div class="lt-cutin-lines"></div>` +
      `<div class="lt-cutin-band"><div class="lt-cutin-inner">` +
        `<div class="lt-cutin-ic">${node.icon}</div>` +
        `<div class="lt-cutin-tx">` +
          `<div class="lt-cutin-kicker">${branch ? branch.icon + " " + branch.name + "・解放！" : "解放！"}</div>` +
          `<div class="lt-cutin-title">${node.title}</div>` +
          `<div class="lt-cutin-sub">${sub}</div>` +
        `</div>` +
      `</div></div>`;
    ov.onclick = () => { if (_ltCutinTimer) { clearTimeout(_ltCutinTimer); _ltCutinTimer = null; } ov.remove(); };
    document.body.appendChild(ov);
    try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
    _ltCutinTimer = setTimeout(() => {
      const o = document.getElementById("lt-cutin");
      if (o) { o.classList.add("out"); setTimeout(() => { if (o) o.remove(); }, 260); }
      _ltCutinTimer = null;
    }, 1150);
  } catch (e) {}
}

// 第5話「セレスティアの神眼」開眼カットイン。生命淘汰の神眼が開く荘厳な一枚（表示専用＝状態は一切変えない）。
// 約2.6秒で自動消滅／タップで即スキップ。showLifeCutin と同じ流儀（body直下オーバーレイ・SFX・自動消滅）。
let _sgCutinTimer = null;
function playShinganCutin() {
  try {
    const ex = document.getElementById("sg-cutin"); if (ex) ex.remove();
    if (_sgCutinTimer) { clearTimeout(_sgCutinTimer); _sgCutinTimer = null; }
    const ov = el("div", "sg-cutin"); ov.id = "sg-cutin";
    ov.innerHTML =
      `<div class="sg-flash"></div><div class="sg-rays"></div>` +
      `<div class="sg-meteors"><i></i><i></i><i></i></div>` +
      `<div class="sg-eye-wrap"><div class="sg-eye"><div class="sg-iris"><div class="sg-pupil"></div></div></div><div class="sg-ring"></div></div>` +
      `<div class="sg-text"><div class="sg-kicker">☄️ 生命淘汰の神眼</div><div class="sg-title">開 眼</div>` +
        `<div class="sg-sub">竜の「生き残る順番」が、視える——</div></div>` +
      `<div class="sg-skip">タップでスキップ</div>`;
    const close = () => {
      if (_sgCutinTimer) { clearTimeout(_sgCutinTimer); _sgCutinTimer = null; }
      const o = document.getElementById("sg-cutin");
      if (o) { o.classList.add("out"); setTimeout(() => { if (o) o.remove(); }, 320); }
    };
    ov.onclick = close;
    document.body.appendChild(ov);
    try { if (window.Sfx) Sfx.play("legendary"); } catch (e) {}
    _sgCutinTimer = setTimeout(close, 2600);
  } catch (e) {}
}

// §30/§38 — 暮らしと資産：総資産から貯まる「暮らしポイント」を生活の方向（食/住/装/移/遊/格）に
// 振り分けて、約200の生活アップグレードを解放していく“くらしスキルツリー”。完全に表示専用のメタ進行で、
// コイン・着順・オッズ・配当・賭け経済には一切触れない（暮らしPは総資産＝再起度から導出するだけ）。

// =========================================================================
// Story-unlock popup (a) — shown when a 総資産 threshold is crossed during a
// race. Reuses the same CG placeholder slot. `chapters` is an array; it chains
// via 次へ so multiple unlocks in one race show one after another.
// =========================================================================
function showStoryUnlock(chapters, idx) {
  idx = idx || 0;
  const ch = chapters[idx];
  if (!ch) return;
  const cast = STORY_CAST[ch.cast];
  const ex = document.getElementById("story-unlock"); if (ex) ex.remove();
  const ov = el("div", "story-unlock-overlay"); ov.id = "story-unlock";
  const modal = el("div", "card story-unlock-modal");
  if (cast) modal.style.setProperty("--cg", cast.color);
  modal.innerHTML =
    `<div class="su-badge">✦ 新エピソード解放 ✦</div>` +
    `<div class="story-cg viewable"><div class="story-cg-art">${photoOr("images/story/" + ch.id + ".jpg", `<span class="story-cg-sym">${cast ? cast.symbol : "🐲"}</span>`)}<span class="story-cg-zoom">🔍 全画面</span></div>` +
      `<div class="story-cg-cap"><span class="story-cg-tag">一枚絵</span>${ch.scene || ""}</div></div>` +
    `<div class="su-title">${ch.title}</div>` +
    (cast ? `<div class="su-cast"><span class="su-cast-sym" style="--cg:${cast.color}">${photoOr("images/cast/" + ch.cast + ".png", cast.symbol)}</span>${cast.name}<small>（${cast.tag}）</small></div>` : "") +
    `<div class="su-body">${ch.body}</div>`;
  // 解放ポップアップでも一枚絵をタップ→全画面ビューア（renderStory と同じ挙動）。
  // story-viewer(z-index 9200) は解放オーバーレイ(1000)の上に出る。
  const cgEl = modal.querySelector(".story-cg");
  if (cgEl) cgEl.onclick = () => { if (typeof showStoryArt === "function") showStoryArt(ch); };
  const btn = el("button", "su-close", idx < chapters.length - 1 ? "次へ ▶" : "とじる");
  btn.onclick = () => { ov.remove(); if (idx < chapters.length - 1) showStoryUnlock(chapters, idx + 1); };
  modal.appendChild(btn);
  ov.appendChild(modal);
  document.body.appendChild(ov);
}

// (b) advisor "voice" element for a gameplay screen, or null if none met yet.
//   context "race"   → most-advanced race advisor met (Sake→Mizu→Makura→Celestia)
//   context "assets" → Sumika (lifestyle / 総資産)
function advisorVoiceEl(context) {
  const total = state.player.totalAssets || 0;
  const order = context === "assets" ? ["sumika"] : ["celestia", "makura", "mizu", "sake"];
  let key = null;
  for (const k of order) { if (STORY_RACE_VOICE[k] && total >= castUnlockAt(k)) { key = k; break; } }
  if (!key) return null;
  const c = STORY_CAST[key];
  const box = el("div", "card advisor-voice");
  box.style.setProperty("--cg", c.color);
  box.innerHTML =
    `<span class="av-sym">${c.symbol}</span>` +
    `<span class="av-body"><span class="av-name">${c.name}<small>（${c.tag}）</small></span>` +
    `<span class="av-line">${STORY_RACE_VOICE[key]}</span></span>`;
  return box;
}

// Image drop-in (1)(2): returns `fallbackHTML` plus an <img> that loads a real
// asset from `src` if present (fades in over the fallback) and removes itself on
// 404 so only the placeholder shows. See images/README.md for the convention.
function photoOr(src, fallbackHTML) {
  return fallbackHTML +
    `<img class="photo-fill" alt="" loading="lazy" decoding="async" src="${src}" onload="this.classList.add('loaded')" onerror="this.remove()">`;
}

// =========================================================================
// (3) Celestia's 神眼 — opt-in consult on the race-detail screen.
// 解放＝総資産1億 か、または「救済」＝破産3回超で“知らないお姉さん”に出会う（js/epilogue_engine.js）。
// 1着を教える代わりに、答えが知れ渡り、その竜の**単勝も複勝も実際の馬券どおり最低の1.1倍**まで弾ける。
// 着順は不変・プレイヤー任意・1レースのみ＝[[race-math-immutable]]の“意図された唯一の例外”。
// ＝「教わった1頭を単勝/複勝で1.1倍は確実に取れる」(救済) かつ「知るだけでは大きく勝てない」(教訓)。
// =========================================================================
function applyCelestiaCollapse(oddsResult, dragonId) {
  const od = oddsResult.oddsData.find(o => o.dragonId === dragonId);
  if (od) {
    od.winOdds = 1.1;                              // 単勝＝最低1.1倍（実際の馬券の最低配当）
    od.placeOdds = Math.min(od.placeOdds, 1.1);    // 複勝＝最低1.1倍まで弾ける
    od._celestia = true;
  }
}
function consultCelestia() {
  const c = state.current;
  if (!c || c._celestiaRevealed) return;
  if (!c._fixedResult) c._fixedResult = runRace(c.race, c.trialForms);  // fix the result so the reveal is TRUE and the race plays to it
  const winId = c._fixedResult.entries[0].dragon.id;
  applyCelestiaCollapse(c.oddsResult, winId);   // 単勝・複勝とも最低1.1倍へ
  c._celestiaRevealed = winId;
  renderRaceDetail(c.race);   // re-render; the consult guard reuses the collapsed odds + fixed forms
}
function celestiaSectionEl() {
  const c = state.current;
  if (!c || !c.race) return null;
  // 解放＝総資産1億 or「救済」＝破産3回超で“知らないお姉さん”に出会った（js/epilogue_engine.js）。
  const rich = (state.player.totalAssets || 0) >= castUnlockAt("celestia");
  const met = (typeof getStoryFlag === "function" && getStoryFlag("celestiaStrangerSeen"));
  if (!rich && !met) return null;   // まだ出会っていない
  const revealed = (typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_5"));   // 第5話で正体判明
  const cast = STORY_CAST.celestia;
  const sym = revealed ? cast.symbol : "🌌";
  const who = revealed ? "セレスティア" : "あのお姉さん";
  const box = el("div", "card celestia-box");
  box.style.setProperty("--cg", revealed ? cast.color : "#7a6aa0");
  if (c._celestiaRevealed) {
    const win = DRAGONS.find(d => d.id === c._celestiaRevealed);
    const nm = win ? win.name : "？";
    box.classList.add("revealed");
    const warn = `……ただし答えは知れ渡った。<b>${nm}</b> の単勝も複勝も、実際の馬券どおり最低の <b>1.1倍</b> まで弾けた。それでも、教わった1頭なら1.1倍は確実。──1着を知ることと、大きく勝つことは違うわ。`;
    box.innerHTML =
      `<div class="cel-head">${sym} ${revealed ? "セレスティアの神眼" : "あのお姉さんの“予想”"}</div>` +
      `<div class="cel-reveal">この一戦、生き残る一頭は <b>${nm}</b>。</div>` +
      `<div class="cel-warn">${warn}</div>`;
  } else {
    // 段階開示：まず小さな「聞いてみる」→押すと“代償”と本当の 聞く/やめる を出す。
    const renderClosed = () => {
      box.classList.remove("cel-open");
      box.innerHTML = `<div class="cel-head">${sym} ${who}に1着を聞く</div>`;
      const ask = el("button", "cel-ask", "🔮 聞いてみる");
      ask.onclick = renderOpen;
      box.appendChild(ask);
    };
    const renderOpen = () => {
      box.classList.add("cel-open");
      const catchTx = "1着を、教えてくれる。ただし開示した瞬間、その竜の単勝も複勝も、最低の1.1倍まで弾ける。──それでも、確実な1.1倍は残るわ。聞く？";
      box.innerHTML =
        `<div class="cel-head">${sym} ${who}に1着を聞く</div>` +
        `<div class="cel-warn">${catchTx}</div>`;
      const row = el("div", "cel-choice");
      const yes = el("button", "cel-ask", "聞く（1.1倍は確実）");
      yes.onclick = () => consultCelestia();
      const no = el("button", "cel-ask ghost", "やめておく");
      no.onclick = renderClosed;
      row.appendChild(yes); row.appendChild(no);
      box.appendChild(row);
    };
    renderClosed();
  }
  return box;
}

// =========================================================================
// Story screen (specs 31–34): a chapter reader with a 一枚絵CG placeholder slot
// per chapter (themed by the introduced advisor; ready to drop real art into
// later) + the long「件。」chapter text. Read/cosmetic only — gated by asset
// level, never touches race math.
// =========================================================================
// §40 — ストーリー一枚絵の全画面ビューア。CGを全景(contain)で見せ、ADV風のテキストを
// 任意に表示/非表示できる（画面タップで切替）。表示専用：状態・物語進行は変えない。
function showStoryArt(ch) {
  if (!ch) return;
  const ex = document.getElementById("story-viewer"); if (ex) ex.remove();
  const cast = (typeof STORY_CAST !== "undefined") ? STORY_CAST[ch.cast] : null;
  const ov = el("div", "story-viewer"); ov.id = "story-viewer";
  if (cast) ov.style.setProperty("--cg", cast.color);
  ov.innerHTML =
    `<div class="sv-art">${typeof photoOr === "function" ? photoOr("images/story/" + ch.id + ".jpg", `<span class="sv-sym">${cast ? cast.symbol : "🐲"}</span>`) : ""}</div>` +
    `<div class="sv-textbox">` +
      `<div class="sv-title">${ch.title || ""}${cast ? ` <span class="sv-cast">— ${cast.name}</span>` : ""}</div>` +
      `<div class="sv-body">${ch.body || ch.scene || ""}</div>` +
    `</div>` +
    `<div class="sv-hint">画面タップで テキスト表示/非表示</div>` +
    `<button class="sv-close" aria-label="閉じる">×</button>`;
  const toggle = () => ov.classList.toggle("text-hidden");
  ov.querySelector(".sv-art").onclick = toggle;
  ov.querySelector(".sv-textbox").onclick = (e) => { e.stopPropagation(); toggle(); };
  ov.querySelector(".sv-close").onclick = (e) => { e.stopPropagation(); ov.remove(); };
  document.body.appendChild(ov);
}

// 物語の表示タイトル＝キャラクター名（エンディングだけ「エンディング」のまま）。
function chapterDisplayTitle(ch) {
  if (ch.id === "ED") return "エンディング";
  const c = STORY_CAST[ch.cast];
  return (c && c.name) || ch.title;
}

// §09 §24 V1 Village screen
function renderVillage() {
  state.ui.screen = "village";
  runEventHooks("onVillageUpdate", { villageLevel: state.player.villageLevel });
  const app = beginScreen();
  const v = state.player.village || { level: 1, name: "泣き虫ドラゴン村", facilities: {}, unlockedDragonIds: [] };
  const rescue = RESCUE_COINS[v.level] || 300;
  const villMult = VILLAGE_MULT[v.level] || 1.0;
  app.appendChild(el("h2", null, "竜の村"));

  // 村ヒーロー：名前＋レベル＋一言
  const hero = el("div", "card vil-hero");
  hero.innerHTML =
    `<div class="vil-hero-top"><div class="vil-hero-id"><div class="vil-name">🏘️ ${v.name}</div>` +
      `<div class="vil-sub">ミミと竜たちが暮らす、再起の拠点。</div></div>` +
      `<div class="vil-lv"><span>村Lv</span><b>${v.level}</b></div></div>`;
  app.appendChild(hero);

  // 村の効果（救済・賭金倍率・解放竜）をタイルで
  const stats = el("div", "vil-stats");
  const stat = (ic, k, val, sub) =>
    `<div class="vil-stat"><div class="vil-stat-ic">${ic}</div><div class="vil-stat-k">${k}</div>` +
    `<div class="vil-stat-v">${val}</div><div class="vil-stat-s">${sub}</div></div>`;
  stats.innerHTML =
    stat("💛", "救済コイン", fmtCoins(rescue), "破産時に支給") +
    stat("🎰", "賭金倍率", "×" + villMult, "上限が広がる") +
    stat("🐉", "解放した竜", `${(v.unlockedDragonIds || []).length}/${DRAGONS.length}`, "図鑑と連動");
  app.appendChild(stats);

  // 施設ロードマップ（解放済み＝色／未解放＝灰）
  app.appendChild(el("div", "as-sec", "村の施設"));
  const facMeta = [
    ["paddock", "竜見せ広場", "🐉", "出走前の竜をじっくり観察できる"],
    ["newspaper", "予想新聞社", "📰", "新聞印と予想記事が読める"],
    ["grandstand", "応援席", "📣", "推し竜の応援で士気が上がる"],
    ["riderPost", "ライダー詰所", "🏇", "騎手情報と詰所の助言"],
    ["dragonStable", "竜舎", "🏚️", "竜の体調・気性を知る"],
    ["exchange", "交換所", "💱", "コインと品を交換する"]
  ];
  const facGrid = el("div", "vil-facs");
  facMeta.forEach(([k, name, ic, desc]) => {
    const lv = (v.facilities && v.facilities[k]) || 0;
    const open = lv > 0;
    facGrid.appendChild(el("div", "vil-fac" + (open ? "" : " locked"),
      `<div class="vil-fac-ic">${ic}</div>` +
      `<div class="vil-fac-tx"><div class="vil-fac-n">${name}</div><div class="vil-fac-d">${desc}</div></div>` +
      `<div class="vil-fac-lv">${open ? "Lv " + lv : "未解放"}</div>`));
  });
  app.appendChild(facGrid);
  app.appendChild(el("div", "condition-line",
    "村レベルが上がると施設が解放され、救済・賭金上限・特典が強化されます（順次アップデート）。"));

  const actions = el("div", "actions");
  const home = el("button", "secondary", "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}

// 専用画面：設定（旧・竜の村の枠）。サウンド／情報量／村のようす／データをまとめる。表示・設定のみ。
function renderSettings() {
  state.ui.screen = "settings";
  const app = beginScreen();   // 上部に「← ホーム」
  app.appendChild(el("h2", null, "⚙️ 設定"));

  // サウンド ON/OFF（効果音・歓声・BGM をまとめて切替）
  const muted = !!(window.Sfx && Sfx.isMuted && Sfx.isMuted());
  const sound = el("div", "set-row",
    `<span class="set-ic">${muted ? "🔇" : "🔊"}</span>` +
    `<span class="set-tx"><span class="set-nm">サウンド</span><span class="set-sub">効果音・歓声・BGM</span></span>`);
  const sBtn = el("button", "set-toggle" + (muted ? "" : " on"), muted ? "OFF" : "ON");
  sBtn.onclick = () => {
    const m = !(window.Sfx && Sfx.isMuted && Sfx.isMuted());
    if (window.Sfx && Sfx.setMuted) Sfx.setMuted(m);
    if (window.RaceBgm && RaceBgm.setMuted) RaceBgm.setMuted(m);
    if (!m && window.Sfx && Sfx.play) Sfx.play("click");
    renderSettings();
  };
  const volBtn = el("button", "set-toggle on set-vol-open", "🎚 音量");
  volBtn.onclick = () => { if (typeof showVolumePanel === "function") showVolumePanel(); };
  sound.appendChild(volBtn);
  sound.appendChild(sBtn);
  app.appendChild(sound);

  // 情報量（ヘッダのセレクタと同じ設定。簡易/標準/詳細/エキスパート）
  app.appendChild(el("div", "as-sec", "情報量（表示する数値の多さ）"));
  const INFO = [["simple", "簡易"], ["standard", "標準"], ["advanced", "詳細"], ["expert", "エキスパート"]];
  const seg = el("div", "set-seg");
  INFO.forEach(pair => {
    const b = el("button", "set-seg-b" + (state.ui.infoLevel === pair[0] ? " on" : ""), pair[1]);
    b.onclick = () => {
      state.ui.infoLevel = pair[0];
      if (typeof saveGame === "function") saveGame();
      const sel = document.getElementById("info-level"); if (sel) sel.value = pair[0];
      renderSettings();
    };
    seg.appendChild(b);
  });
  app.appendChild(seg);

  // 竜の村のようす（救済・賭金倍率・解放竜＝経済情報を残す）
  const v = state.player.village || { level: 1, name: "泣き虫ドラゴン村", facilities: {}, unlockedDragonIds: [] };
  const rescue = (typeof RESCUE_COINS !== "undefined" && RESCUE_COINS[v.level]) || 300;
  const villMult = (typeof VILLAGE_MULT !== "undefined" && VILLAGE_MULT[v.level]) || 1.0;
  const dn = (typeof DRAGONS !== "undefined") ? DRAGONS.length : 0;
  app.appendChild(el("div", "as-sec", "竜の村のようす"));
  app.appendChild(el("div", "card set-village",
    `<div class="set-vil-top">🏘️ ${v.name}　<b>村Lv ${v.level}</b></div>` +
    `<div class="set-vil-stats"><span>💛 救済 <b>${fmtCoins(rescue)}</b></span>` +
      `<span>🎰 賭金 <b>×${villMult}</b></span>` +
      `<span>🐉 解放竜 <b>${(v.unlockedDragonIds || []).length}/${dn}</b></span></div>`));

  // データ
  app.appendChild(el("div", "as-sec", "データ"));
  const data = el("div", "set-data");
  const bTitle = el("button", "secondary", "🏠 タイトルへ"); bTitle.onclick = () => renderTitle();
  const bReset = el("button", "set-danger", "🔄 リセット");
  bReset.onclick = () => { if (confirm("プレイヤー状態をリセットしますか？")) { resetGame(); updateHeader(); renderHome(); } };
  data.appendChild(bTitle); data.appendChild(bReset);
  app.appendChild(data);

  // 🛠 デバッグ（実機=スマホでも使えるよう設定内に常設。ヘッダのチェックと同期）
  // ここでの操作は所持コイン/所持品/ランク等のメタ操作のみ＝レースの着順・オッズ・配当計算には一切触れない。
  app.appendChild(el("div", "as-sec", "デバッグ"));
  const dbgRow = el("div", "set-row",
    `<span class="set-ic">🛠</span><span class="set-tx"><span class="set-nm">デバッグモード</span><span class="set-sub">開発用ツール（コイン付与など）を表示</span></span>`);
  const dBtn = el("button", "set-toggle" + (state.ui.debug ? " on" : ""), state.ui.debug ? "ON" : "OFF");
  dBtn.onclick = () => {
    state.ui.debug = !state.ui.debug;
    const cb = document.getElementById("debug-toggle"); if (cb) cb.checked = state.ui.debug;
    if (typeof saveGame === "function") saveGame();
    renderSettings();
  };
  dbgRow.appendChild(dBtn);
  app.appendChild(dbgRow);
  if (state.ui.debug) {
    const grid = el("div", "set-debug");
    const act = (label, fn) => {
      const b = el("button", "set-dbg-b", label);
      b.onclick = () => {
        fn();
        if (typeof bumpMaxCoins === "function") bumpMaxCoins();
        if (typeof recomputeAssets === "function") recomputeAssets(state);
        if (typeof saveGame === "function") saveGame();
        updateHeader(); renderSettings();
      };
      return b;
    };
    grid.appendChild(act("💰 +1万", () => { state.player.coins += 10000; }));
    grid.appendChild(act("💰 +100万", () => { state.player.coins += 1000000; }));
    grid.appendChild(act("💰 +1億", () => { state.player.coins += 100000000; }));
    grid.appendChild(act("🪙 コインを0に", () => { state.player.coins = 0; }));
    grid.appendChild(act("🏅 ランク+1", () => { state.player.rank = Math.min(7, (state.player.rank || 1) + 1); }));
    grid.appendChild(act("👗 全衣装を所持", () => { state.player.outfitsBought = OUTFITS.filter(o => o.acquire && o.acquire.price != null).map(o => o.id); }));
    // 終章テスト用：第5話は総資産1億で解放。これで一気に開ける状態＋全機能解放にする。
    grid.appendChild(act("🌌 終章テスト準備（総資産2億）", () => {
      state.player.maxCoinsReached = Math.max(state.player.maxCoinsReached || 0, 200000000);
      if (typeof setStoryFlag === "function") ["poroFound", "dragonScoutUnlocked", "dragonStableUnlocked", "metMakura", "celestiaStrangerSeen"].forEach(f => setStoryFlag(f, true));
      if (state.player.flags) state.player.flags.everHit = true;
    }));
    grid.appendChild(act("☄️ 絶滅メーターを残り10に", () => {
      if (typeof epilogueStart === "function") epilogueStart();
      const e = (typeof epData === "function") ? epData() : null;
      if (e) { e.active = true; e.finalReady = false; e.edFlag = false; e.meter = 10; }
    }));
    grid.appendChild(act("👁️ 神眼カットイン再生", () => { if (typeof playShinganCutin === "function") playShinganCutin(); }));
    app.appendChild(grid);
    app.appendChild(el("div", "as-hint2", "※メタ操作のみ（コイン/所持/ランク/物語の解放）。レースの着順・オッズ・配当の計算には触れません。終章メーターも表示専用。"));

    // 🧭 画面ジャンプ：全画面に番号で直接ジャンプ（開発・確認の高速化。js/nav.js SCREEN_INDEX）。
    if (typeof SCREEN_INDEX !== "undefined" && typeof goto === "function") {
      app.appendChild(el("div", "as-sec", "🧭 画面ジャンプ（番号で直接表示）"));
      const jg = el("div", "set-jump");
      SCREEN_INDEX.forEach(s => {
        const b = el("button", "set-jump-b", `<b>${s.no}</b><span>${s.label}</span>`);
        b.title = s.id + "　（URL：?go=" + s.id + "）";
        b.onclick = () => { if (typeof goto === "function") goto(s.id); };
        jg.appendChild(b);
      });
      app.appendChild(jg);
      app.appendChild(el("div", "as-hint2", "URLでも直接起動できます：<code>?go=meals</code> のように画面IDを指定（<code>&debug=1</code> でデバッグもON）。"));
    }
  }

  // おまけ：エンディング＆スタッフロール（表示専用。進行に関係なくいつでも観られる）。
  app.appendChild(el("div", "as-sec", "おまけ"));
  const edRow = el("div", "set-row",
    `<span class="set-ic">🎬</span><span class="set-tx"><span class="set-nm">エンディングを観る</span><span class="set-sub">送り出し＋スタッフロール</span></span>`);
  const edBtn = el("button", "set-toggle on", "▶ 再生");
  edBtn.onclick = () => {
    if (window.Sfx && Sfx.play) Sfx.play("click");
    if (window.Ending && Ending.play) {
      Ending.play().then(() => {
        // 本編クリア＝エンディング完走。ポロを見つけていれば「ポロのグルメレース」解放（仕様§7・表示専用）。
        try {
          if (typeof setStoryFlag === "function" && !getStoryFlag("gameCleared")) {
            setStoryFlag("gameCleared", true);
            if (typeof poroFound === "function" && poroFound()) {
              setStoryFlag("poroGourmetRaceUnlocked", true);
              if (typeof showInfoPopup === "function") showInfoPopup("🏃 ポロのグルメレース 解放！",
                `<div class="mm-row"><span class="mm-ic">🥹</span><div><b>クリアおめでとう！</b><small>おまけに「ポロのグルメレース」が遊べるようになりました。設定のおまけ欄から、いつでもどうぞ。</small></div></div>`);
            }
          }
          if (state.ui.screen === "settings") renderSettings();
        } catch (e) {}
      });
    }
  };
  edRow.appendChild(edBtn);
  app.appendChild(edRow);

  // ポロのグルメレース（クリア後解放・仕様§7）。表示専用ミニゲーム。
  if (typeof poroGourmetUnlocked === "function" && poroGourmetUnlocked()) {
    const pgRow = el("div", "set-row",
      `<span class="set-ic">🏃</span><span class="set-tx"><span class="set-nm">ポロのグルメレース</span><span class="set-sub">食べ物を集めて走る・スコアアタック</span></span>`);
    const pgBtn = el("button", "set-toggle on", "▶ 遊ぶ");
    pgBtn.onclick = () => { if (window.Sfx && Sfx.play) Sfx.play("click"); renderPoroGourmet(); };
    pgRow.appendChild(pgBtn);
    app.appendChild(pgRow);
  }

  app.appendChild(el("div", "set-ver", "聖龍爆走録ミミ"));

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// 専用ポップアップ：ミミの鑑賞＆きせかえビューア（ホームでミミ本体タップ→起動）。
// 大きな立ち絵＋名前＋説明を見せ、◀▶／スワイプ／←→キー／ドットで「所持している衣装」をめくる。
// めくった瞬間に無料で着替わり（wearOutfit）、閉じるとホームへ反映。表示専用＝レース数値不変。
function showMimiViewer() {
  if (document.getElementById("mimi-viewer")) return;
  const owned = OUTFITS.filter(o => outfitOwned(o));
  if (!owned.length) return;
  let idx = Math.max(0, owned.findIndex(o => o.id === currentOutfitId()));
  let expr = "default";
  const EXPRS = [["default", "🙂"], ["smile", "😊"], ["happy", "🌟"], ["panic", "💦"]];

  // 没入フルスクリーン構成：画像を主役（画面いっぱい）に、操作系は上下バーへ薄く重ねる。
  // ★鑑賞モードはホームより大きく見せるのが目的（小さくしない）。
  const ov = el("div", "mv-ov");
  ov.id = "mimi-viewer";
  ov.innerHTML =
    '<div class="mv-top">' +
      '<span class="mv-mode">🪞 鑑賞モード</span>' +
      '<span class="mv-count"></span>' +
      '<button class="mv-x" aria-label="とじる">✕</button>' +
    '</div>' +
    '<button class="mv-nav mv-prev" aria-label="前の衣装">‹</button>' +
    '<div class="mv-imgwrap"><img class="mv-img" alt="ミミ" decoding="async"></div>' +
    '<button class="mv-nav mv-next" aria-label="次の衣装">›</button>' +
    '<div class="mv-bottom">' +
      '<div class="mv-info"><div class="mv-nm"></div><div class="mv-fl"></div></div>' +
      '<div class="mv-exprs"></div>' +
      '<div class="mv-dots"></div>' +
      '<div class="mv-acts"></div>' +
    '</div>';
  document.body.appendChild(ov);

  const img = ov.querySelector(".mv-img");
  const imgwrap = ov.querySelector(".mv-imgwrap");
  const nm = ov.querySelector(".mv-nm");
  const fl = ov.querySelector(".mv-fl");
  const cnt = ov.querySelector(".mv-count");
  const dots = ov.querySelector(".mv-dots");
  const exprRow = ov.querySelector(".mv-exprs");

  // 表情トグル（鑑賞用・表示のみ）
  EXPRS.forEach(([k, lb]) => {
    const b = el("button", "mv-expr" + (k === expr ? " on" : ""), lb);
    b.onclick = (e) => {
      e.stopPropagation();
      expr = k;
      exprRow.querySelectorAll(".mv-expr").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      paint(0);
    };
    exprRow.appendChild(b);
  });

  // 所持衣装ドット（タップでジャンプ）
  owned.forEach((o, i) => {
    const d = el("span", "mv-dot");
    d.title = o.name;
    d.onclick = (e) => { e.stopPropagation(); idx = i; paint(0); };
    dots.appendChild(d);
  });

  // ★立ち絵の透過バウンディングボックスを実測し、“キャラ本体”が画面いっぱいになるよう拡大。
  // 素材は512×768で左右に透過余白あり→contain任せだとキャラが小さい。余白ぶん拡大＝ホームより大きく見せる。
  // 余白は画面外へ（overflow:hidden）。同origin配信なのでgetImageDataは可（透過判定で実績あり）。
  const RATIO = 768 / 512, bboxCache = {};
  function applyFit(bb) {
    const wrap = imgwrap.getBoundingClientRect();
    if (!wrap.width || !wrap.height) return;
    const padTop = 46;                                   // 頭が上バーに隠れない余白
    const availW = wrap.width * 0.96;
    const availH = window.innerHeight - padTop - 56;     // 足元は下パネルのグラデへ沈める前提でフル高近く使う
    let imgW = Math.min(availW / bb.charW, (availH / bb.charH) / RATIO);
    imgW = Math.min(imgW, 760);                          // 過度なアップスケール抑制
    const imgH = imgW * RATIO;
    img.style.maxWidth = "none"; img.style.maxHeight = "none";
    img.style.width = Math.round(imgW) + "px";
    img.style.height = Math.round(imgH) + "px";
    img.style.position = "relative";
    img.style.left = Math.round((0.5 - bb.cx) * imgW) + "px";   // キャラ本体を水平センターへ
    img.style.opacity = "1";
  }
  function fitImage() {
    const o = owned[idx];
    if (bboxCache[o.id]) { applyFit(bboxCache[o.id]); return; }
    const im = new Image();
    im.onload = () => {
      let bb = { cx: 0.5, charW: 0.62, charH: 0.98 };
      try {
        const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let minX = c.width, maxX = 0, minY = c.height, maxY = 0, any = false;
        for (let y = 0; y < c.height; y += 3) for (let xx = 0; xx < c.width; xx += 3) {
          if (d[(y * c.width + xx) * 4 + 3] > 18) { any = true; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (any) bb = { cx: ((minX + maxX) / 2) / c.width, charW: Math.max(0.2, (maxX - minX) / c.width), charH: Math.max(0.5, (maxY - minY) / c.height) };
      } catch (e) {}
      bboxCache[o.id] = bb; applyFit(bb);
    };
    im.onerror = () => applyFit({ cx: 0.5, charW: 0.62, charH: 0.98 });
    im.src = outfitImg(o.id, expr);
  }
  function paint(dir) {
    const o = owned[idx];
    if (typeof wearOutfit === "function") wearOutfit(o.id); else state.player.outfit = o.id;   // 無料で即着替え（保存込み）
    const src = outfitImg(o.id, expr), fbSmile = outfitImg(o.id, "smile"), fbDef = outfitImg(o.id, "default");
    img.style.opacity = "0";
    img.onerror = function () { this.onerror = function () { this.onerror = null; this.src = fbDef; }; this.src = fbSmile; };
    img.src = src;
    fitImage();
    nm.textContent = o.name;
    fl.textContent = o.flavor || "";
    cnt.textContent = (idx + 1) + " / " + owned.length;
    dots.querySelectorAll(".mv-dot").forEach((d, i) => d.classList.toggle("on", i === idx));
    if (dir) {
      imgwrap.classList.remove("mv-slide-l", "mv-slide-r");
      void imgwrap.offsetWidth;
      imgwrap.classList.add(dir > 0 ? "mv-slide-r" : "mv-slide-l");
    }
  }
  function go(d) { idx = (idx + d + owned.length) % owned.length; paint(d); }

  ov.querySelector(".mv-prev").onclick = (e) => { e.stopPropagation(); go(-1); };
  ov.querySelector(".mv-next").onclick = (e) => { e.stopPropagation(); go(1); };
  ov.querySelector(".mv-x").onclick = (e) => { e.stopPropagation(); close(); };

  // アクション：モールで買う（解放後のみ）／この姿でホームへ
  const acts = ov.querySelector(".mv-acts");
  if (typeof mallUnlocked === "function" && mallUnlocked()) {
    const shop = el("button", "mv-shop", "🛍️ モールで新しい服を買う");
    shop.onclick = (e) => { e.stopPropagation(); close(); renderMall(); };
    acts.appendChild(shop);
  }
  const done = el("button", "mv-done", "✓ この姿でホームへ");
  done.onclick = (e) => { e.stopPropagation(); close(); };
  acts.appendChild(done);

  // スワイプ（左右で前後の衣装へ）。スワイプ直後の click で閉じないよう suppressClick でガード。
  let sx = 0, sw = false, suppressClick = false;
  imgwrap.addEventListener("pointerdown", (e) => { sx = e.clientX; sw = true; });
  imgwrap.addEventListener("pointerup", (e) => {
    if (!sw) return; sw = false;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 40) { suppressClick = true; go(dx < 0 ? 1 : -1); }
  });
  imgwrap.addEventListener("pointercancel", () => { sw = false; });

  // キーボード（←→で切替・Escで閉じる）
  function onKey(e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "Escape") close();
  }
  window.addEventListener("keydown", onKey);
  const onResize = () => fitImage();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // 背景（画像の外側＝余白）タップで閉じる。スワイプ直後は閉じない。
  ov.addEventListener("click", (e) => {
    if (suppressClick) { suppressClick = false; return; }
    if (e.target === ov || (e.target.classList && e.target.classList.contains("mv-imgwrap"))) close();
  });

  function close() {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    if (ov.parentNode) ov.remove();
    if (state.ui.screen === "home") renderHome();   // 着替えをホームへ反映
  }

  paint(0);
}

// 専用画面：ショッピングモール（ミミのきせかえ）。コイン購入＋条件解放、着替えは無料。
// 立ち絵を実際に差し替える表示専用コスメ。着順・オッズ・配当には非干渉。
function renderMall() {
  if (!mallUnlocked()) {   // 解放前の直行ガード（ナビは🔒だが保険）
    renderHome();
    showInfoPopup("🛍️ ショッピングモール",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて的中</u>すると解放されます。</small></div></div>`);
    return;
  }
  state.ui.screen = "mall";
  if (window.Dialogue && Dialogue.dismiss) Dialogue.dismiss();   // 取り残されたセリフオーバーレイがタップを塞がないように
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const app = beginScreen();   // 上部に「← ホーム」
  // ブティック内装の背景（images/mall_bg.jpg をドロップインで差し替え可・無ければグラデ）
  const mbg = el("div", "mall-bg");
  mbg.innerHTML = `<img alt="" decoding="async" src="images/mall_bg.webp" onerror="this.remove()"><div class="mall-bg-scrim"></div>`;
  app.appendChild(mbg);
  app.appendChild(el("h2", null, "🛍️ ショッピングモール"));
  // 説明はふだん短く、詳しくは？で（冗長表現を常時出さないオンボーディング方針）
  const _mtop = el("div", "mall-top",
    `<span class="as-hint">未購入はシルエット <button class="info-q" title="モールの遊び方">？</button></span>` +
    `<span class="mall-coins">🪙 <b>${fmtCoins(state.player.coins || 0)}</b></span>`);
  _mtop.querySelector(".info-q").onclick = () => showInfoPopup("🛍️ モールの遊び方",
    `<div class="mm-row"><span class="mm-ic">👤</span><div><b>未購入はシルエット</b><small>買うと姿が見られる。集める楽しみ！</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">👗</span><div><b>着替えは無料</b><small>所持している服はいつでも切替OK。レース結果には影響しない。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏬</span><div><b>巨大モール大冒険</b><small>1Fから屋上まで冒険して衣装GET。コインは使わない。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>解放条件つきの服</b><small>総資産で解放される特別な服もある。</small></div></div>`);
  app.appendChild(_mtop);
  // ミニゲーム「巨大モール大冒険」への入口（一人称ダンジョンRPG・衣装が手に入る・表示メタ）
  if (typeof renderMallRpg === "function") {
    const dg = el("button", "mall-dgbtn");
    const _rpg = (state.player.rpg || {});
    dg.innerHTML = `<span class="mall-dgbtn-ic">🏬</span><span class="mall-dgbtn-tx"><b>巨大モール大冒険</b>` +
      `<small>1Fから🌿屋上まで・観光客や魔物と戦い衣装GET${_rpg.lv ? `　🧝Lv${_rpg.lv}${_rpg.cleared ? "・🌿制覇" : ""}` : ""}</small></span><span class="mall-dgbtn-go">冒険 ▶</span>`;
    dg.onclick = () => renderMallRpg();
    app.appendChild(dg);
  }

  const worn = currentOutfitId();
  if (!state.ui.mallSel || !OUTFITS.some(o => o.id === state.ui.mallSel)) state.ui.mallSel = worn;
  if (!state.ui.mallExpr) state.ui.mallExpr = "smile";
  const sel = outfitById(state.ui.mallSel);
  const owned = outfitOwned(sel);
  const isWorn = sel.id === worn;

  // ── 試着室：大プレビュー（表情切替）＋情報＋CTA。未所持でも試着できる（表示のみ）。
  const fit = el("div", "card mall-fit");
  const stage = el("div", "mall-fit-stage");
  // 未購入はシルエット表示（買うと姿が見られる）。所持/着用中はフルカラー。
  const img = el("div", "mall-fit-img" + (owned ? "" : " silhouette"));
  const _src = outfitImg(sel.id, state.ui.mallExpr);
  const _fb = outfitImg(sel.id, "smile");
  img.innerHTML =
    `<img alt="${sel.name}" src="${_src}" onerror="this.onerror=null;this.src='${_fb}'">` +
    (isWorn ? `<span class="mall-badge worn">✓ 着用中</span>` : (owned ? `<span class="mall-badge owned2">所持</span>` : `<span class="mall-badge lock">🔒 ？</span>`)) +
    (owned ? "" : `<span class="mall-silq">？</span>`);
  stage.appendChild(img);
  const seg = el("div", "mall-expr");
  [["default", "🙂 通常"], ["smile", "😊 にこ"], ["happy", "🌟 よろこび"], ["panic", "💦 あせり"]].forEach(([k, lb]) => {
    const b = el("button", "mall-expr-b" + (state.ui.mallExpr === k ? " on" : ""), lb);
    b.onclick = () => { state.ui.mallExpr = k; renderMall(); };
    seg.appendChild(b);
  });
  stage.appendChild(seg);
  fit.appendChild(stage);

  const info = el("div", "mall-fit-info");
  let acq;
  if (sel.acquire.free) acq = "いつでも着られる基本衣装";
  else if (sel.acquire.price != null) acq = owned ? "購入済み" : `価格 <b>${fmtCoins(sel.acquire.price)}</b>（所持 ${fmtCoins(state.player.coins || 0)}）`;
  else if (sel.acquire.assets != null) acq = owned ? "解放済み" : `総資産 <b>${fmtCoins(sel.acquire.assets)}</b> で解放（現在 ${fmtCoins(state.player.totalAssets || 0)}）`;
  else acq = "";
  info.innerHTML =
    `<div class="mall-fit-nm">${sel.name}</div>` +
    `<div class="mall-fit-fl">${sel.flavor}</div>` +
    `<div class="mall-fit-acq">${acq}</div>`;
  const cta = el("div", "mall-fit-cta");
  if (isWorn) {
    cta.appendChild(el("div", "mall-foot is-worn", "✓ いま着ています"));
    const hb = el("button", "mall-btn home", "🏠 ホームで見る");   // 購入直後（=着用中）にすぐ確認しに行ける
    hb.onclick = () => renderHome();
    cta.appendChild(hb);
  } else if (owned) {
    const wb = el("button", "mall-btn wear", "この服に着替える");
    wb.onclick = () => { wearOutfit(sel.id); if (window.Sfx) Sfx.play("click"); if (window.Dialogue && window.DLG) Dialogue.play(DLG.outfit(sel)); renderMall(); };
    cta.appendChild(wb);
  } else if (sel.acquire.price != null) {
    const poor = (state.player.coins || 0) < sel.acquire.price;
    const bb = el("button", "mall-btn buy" + (poor ? " poor" : ""), `🛒 ${fmtCoins(sel.acquire.price)} で購入して着替える`);
    bb.onclick = () => {
      const r = buyOutfit(sel.id);
      if (r.ok) { wearOutfit(sel.id); if (window.Sfx) Sfx.play("coin"); if (window.Dialogue && window.DLG) Dialogue.play(DLG.outfit(sel)); renderMall(); }
      else if (r.reason === "poor") alert("コインが足りません。");
    };
    cta.appendChild(bb);
  } else if (sel.acquire.assets != null) {
    cta.appendChild(el("div", "mall-foot lock", `🔒 総資産 ${fmtCoins(sel.acquire.assets)} で解放`));
  }
  info.appendChild(cta);
  fit.appendChild(info);
  app.appendChild(fit);

  // ── 衣装一覧（タップで試着室へ反映）
  const grid = el("div", "mall-grid");
  OUTFITS.forEach(o => {
    const oOwned = outfitOwned(o);
    const oWorn = o.id === worn;
    const card = el("button", "mall-card" + (oWorn ? " worn" : "") + (oOwned ? "" : " locked") + (o.id === sel.id ? " sel" : ""));
    let chip;
    if (oWorn) chip = "";                                            // 着用中はコーナーリボンで表現
    else if (oOwned) chip = `<span class="mall-chip owned">所持</span>`;
    else if (o.acquire.price != null) chip = `<span class="mall-chip price">${fmtCoins(o.acquire.price)}</span>`;
    else if (o.acquire.assets != null) chip = `<span class="mall-chip lock">🔒</span>`;
    else chip = "";
    card.innerHTML =
      `<div class="mall-card-img">${photoOr(outfitImg(o.id, "default"), "<span class='mall-fallback'>🐰</span>")}</div>` +
      `<div class="mall-card-nm">${o.name}</div>` + chip;
    card.onclick = () => {
      state.ui.mallSel = o.id; if (window.Sfx) Sfx.play("click");
      renderMall();
      // タップの結果（試着室の切替）が見えるように、ページ上部の試着室へスクロール
      const f = document.querySelector(".mall-fit"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    grid.appendChild(card);
  });
  app.appendChild(grid);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// §07 §20 Help / Tutorial screen — §10 explains all V1 prediction concepts.
function renderHelp() {
  state.ui.screen = "help";
  const app = beginScreen();
  app.appendChild(el("h2", null, "予想入門"));

  // オンボーディング方針：説明は既定で閉じる（読みたい時だけ開く）。🆕/✓で初見かどうか一目で分かり、
  // 開いた項目は既読として保存される。
  if (!state.player.tutSeen) state.player.tutSeen = {};
  const seen = state.player.tutSeen;
  app.appendChild(el("div", "as-hint2", `気になる項目だけ開いて読めます　<span class="as-hint">🆕＝未読 ／ ✓＝読了</span>`));
  const section = (key, title, body) => {
    const d = document.createElement("details");
    d.className = "help-sec" + (seen[key] ? " seen" : "");
    d.innerHTML =
      `<summary><span class="hs-badge">${seen[key] ? "✓" : "🆕"}</span>${title}</summary>` +
      `<div class="hs-body">${body.map(l => `<div>${l}</div>`).join("")}</div>`;
    d.addEventListener("toggle", () => {
      if (d.open && !seen[key]) {
        seen[key] = true;
        if (typeof saveGame === "function") saveGame();
        d.classList.add("seen");
        const b = d.querySelector(".hs-badge"); if (b) b.textContent = "✓";
      }
    });
    return d;
  };

  // 💰 お金のしくみ（共通モーダル）＝数値の関係はいつでもここから
  const mm = el("button", "help-money", "💰 お金のしくみ — コイン・総資産・暮らしPの関係");
  mm.onclick = () => showMoneyMap();
  app.appendChild(mm);

  app.appendChild(section("heart", "このゲームの心臓", [
    "<b>市場のオッズと真の実力のズレを読み、賭けで利益を出す</b>予想カジノです。",
    "1番人気が強いとは限りません。コース・脚質・スタミナ・ペースを読むほど、勝率は上がります。"
  ]));

  app.appendChild(section("types", "賭式は3種類", [
    "<b>単竜</b>：1頭を選び、1着のみ的中。最も高いリターン、最も難しい。",
    "<b>複竜</b>：1頭を選び、3着以内で的中。安全寄り、堅実なリターン。",
    "<b>ワイド竜</b>：2頭を選び、両方が3着以内で的中。本命＋穴の組合せで妙味の塊。"
  ]));

  app.appendChild(section("odds", "オッズの読み方", [
    "オッズは「市場の人気投票」から計算され、真の勝率とは <b>ズレます</b>。",
    "前走勝利・新聞印・派手な見た目・ファン人気で人気が集まり、オッズは下がります。",
    "そのズレ＝<b>妙味</b>。市場が見落としている適性を見つけるのが予想家の仕事です。"
  ]));

  app.appendChild(section("course", "コース3区間", [
    "レースは<b>序盤・中盤・終盤</b>の3セクション。各々で必要な能力が違います。",
    "例：終盤=長い直線 → 速度+翼+スタミナ重視。終盤=最終大旋回 → 回転+気性重視。",
    "出走表で各セクションを確認し、適性を持つ竜を探しましょう。"
  ]));

  app.appendChild(section("pace", "脚質とペース", [
    "<b>逃げ</b>＝早く前へ。<b>先行</b>＝前位安定。<b>差し</b>＝中盤伸び。<b>追込</b>＝最終後方一気。",
    "逃げ・先行が多い＝ペースが上がり、スタミナ薄い前残り型は終盤で <b>崩壊</b> します。",
    "逆にスローペースなら差し・追込が届かず、逃げ・先行が残ります。"
  ]));

  app.appendChild(section("stamina", "スタミナ", [
    "各竜は「スタミナプール」を持ち、レース中にセクションごとに消費。",
    "ハイペース・苦手な区間・距離の長さで消費が増えます。",
    "終盤に残り20%以下＝崩壊判定、ペナルティで大きく失速します。"
  ]));

  app.appendChild(section("value", "妙味の探し方", [
    "1. 1番人気の<b>弱点</b>を探す（今日のコースに合わないステータス）",
    "2. 中位人気で<b>適性が刺さっている</b>竜を探す（オッズ10倍以上で勝率10%なら+EV）",
    "3. <b>ワイド竜</b>で本命＋妙味馬を組む（1着を当てなくても勝てる）",
    "4. 詳細モード以上では「妙味の手がかり」セクションがヒントを出します"
  ]));

  app.appendChild(section("infolv", "情報量レベル", [
    "ヘッダの「情報量」セレクタで表示量を調整できます。",
    "<b>簡易</b>=入門。<b>標準</b>=デフォルト。<b>詳細</b>=妙味手がかり＋分析項目追加。<b>エキスパート</b>=コンポーネント内訳まで。"
  ]));

  app.appendChild(section("rescue", "救済システム", [
    "コインが0になっても安心。サケ・ウダダが村の予備コイン300枚を渡してくれます（村Lv1）。",
    "借金ではありません。小さく賭けて立て直しましょう。"
  ]));

  const actions = el("div", "actions");
  const home = el("button", null, "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}

// §09 §8,§9,§10 Collection screen
// §41 — 図鑑：竜カードの詳細ポップ（大きめスプライト＋特徴＋記録＋解放ノート＋お気に入り）。
let _dexFilter = "all";
function showDragonDetail(d) {
  const entry = (state.player.collection || {})[d.id];
  if (!entry || !entry.seen) return;
  const r = entry.records || {};
  const notes = (typeof getCollectionNoteText === "function") ? getCollectionNoteText(entry, d) : [];
  const ex = document.getElementById("dex-detail"); if (ex) ex.remove();
  const col = (typeof dragonColor === "function") ? dragonColor(d) : (d.color || "#888");
  const ov = el("div", "dex-detail-ov"); ov.id = "dex-detail";
  ov.style.setProperty("--dc", col);
  const rec = (k, v) => `<div class="dd-rec"><span>${k}</span><b>${v || 0}</b></div>`;
  const card = el("div", "card dex-detail");
  card.innerHTML =
    `<button class="dex-detail-x" aria-label="閉じる">×</button>` +
    `<div class="dd-head"><div class="dd-art"><canvas width="300" height="150"></canvas></div>` +
      `<div class="dd-id"><div class="dd-name">${d.name}</div>` +
        `<div class="dd-style style-${d.style}">${STYLE_LABEL[d.style] || ""}</div>` +
        `<div class="dd-traits">${(d.traits || []).map(t => `<span>${t}</span>`).join("")}</div></div></div>` +
    `<div class="dd-records">` + rec("観戦", r.racesSeen) + rec("勝ち", r.winsSeen) + rec("複圏", r.top3Seen) + rec("賭け", r.playerBetCount) + rec("的中", r.playerHitCount) + `</div>` +
    `<div class="dd-notes">${notes.length ? notes.map(n => `<div class="dd-note">📝 ${n}</div>`).join("") : `<div class="dd-note muted">観戦・予想を重ねると、気性・適性・物語が解放されます。</div>`}</div>` +
    `<button class="dd-fav ${entry.favorite ? "on" : ""}">${entry.favorite ? "★ お気に入り" : "☆ お気に入りに追加"}</button>`;
  ov.appendChild(card);
  document.body.appendChild(ov);
  const cv = card.querySelector(".dd-art canvas");
  if (cv && cv.getContext && typeof rcDrawDragon === "function") {
    rcDrawDragon(cv.getContext("2d"), { x: 161, y: 117, scale: 2.85, color: col, style: d.style, gait: 0, flap: 1.0, lean: 0.25, glow: 0.5 });
  }
  card.querySelector(".dex-detail-x").onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  card.querySelector(".dd-fav").onclick = () => {
    const en = ensureCollectionEntry(d.id);
    en.favorite = !en.favorite;
    const list = state.player.village.favoriteDragonIds;
    if (en.favorite && !list.includes(d.id)) list.push(d.id);
    else if (!en.favorite) { const i = list.indexOf(d.id); if (i >= 0) list.splice(i, 1); }
    saveGame(); ov.remove(); renderCollection();
  };
}

function renderCollection() {
  state.ui.screen = "collection";
  const app = beginScreen();
  app.appendChild(el("h2", null, "竜図鑑"));
  const seenCount = Object.values(state.player.collection || {}).filter(e => e.seen).length;
  app.appendChild(el("div", "card", `見た竜: <b>${seenCount}</b> / ${DRAGONS.length} 種`));

  // §37 — 図鑑コンプリート報酬の進捗
  try {
    const total = DRAGONS.length || 1;
    const pct = Math.round(seenCount / total * 100);
    const got = state.player.collectionRewards || [];
    const chips = COLLECTION_MILESTONES.map(m => {
      const claimed = got.indexOf(String(m.frac)) >= 0;
      const reached = seenCount / total + 1e-9 >= m.frac;
      return `<div class="dex-chip ${claimed ? "claimed" : (reached ? "ready" : "")}">${Math.round(m.frac * 100)}%</div>`;
    }).join("");
    const prog = el("div", "card dex-prog");
    prog.innerHTML =
      `<div class="dex-prog-top"><span>図鑑コンプリート報酬</span><b>${pct}%</b></div>` +
      `<div class="dex-prog-bar"><div class="dex-prog-fill" style="width:${pct}%"></div></div>` +
      `<div class="dex-chips">${chips}</div>`;
    app.appendChild(prog);
  } catch (e) {}

  // フィルタ（すべて / 見た / お気に入り）
  const fbar = el("div", "dex-filter");
  [["all", "すべて"], ["seen", "見た"], ["fav", "★"]].forEach(([k, lbl]) => {
    const c = el("button", "dex-fchip" + (_dexFilter === k ? " on" : ""), lbl);
    c.onclick = () => { _dexFilter = k; renderCollection(); };
    fbar.appendChild(c);
  });
  app.appendChild(fbar);

  // 竜カード・グリッド（識別色のミニ竜スプライト＋見た/未発見）
  const grid = el("div", "dex-grid");
  let shown = 0;
  DRAGONS.forEach(d => {
    const entry = (state.player.collection || {})[d.id];
    const seen = !!(entry && entry.seen);
    const fav = !!(entry && entry.favorite);
    if (_dexFilter === "seen" && !seen) return;
    if (_dexFilter === "fav" && !fav) return;
    shown++;
    const rc = (entry && entry.records) || { racesSeen: 0 };
    const card = el("div", "dex-card" + (seen ? "" : " unseen") + (fav ? " fav" : ""));
    card.style.setProperty("--dc", (typeof dragonColor === "function") ? dragonColor(d) : (d.color || "#888"));
    card.innerHTML =
      `<div class="dex-card-art"><canvas width="78" height="56"></canvas>${seen ? "" : `<span class="dex-q">？</span>`}</div>` +
      `<div class="dex-card-name">${seen ? d.name : "？？？"}</div>` +
      (seen
        ? `<div class="dex-card-meta"><span class="dex-style style-${d.style}">${STYLE_LABEL[d.style] || ""}</span><span class="dex-seen">観${rc.racesSeen}</span></div>`
        : `<div class="dex-card-meta"><span class="dex-locked">未発見</span></div>`) +
      (fav ? `<span class="dex-fav">★</span>` : "");
    if (seen) {
      const cv = card.querySelector("canvas");
      if (cv && cv.getContext && typeof rcDrawDragon === "function")
        rcDrawDragon(cv.getContext("2d"), { x: 42, y: 38, scale: 0.72, color: dragonColor(d), style: d.style, gait: 0, flap: 1.0, lean: 0.25, glow: 0.4 });
      card.onclick = () => showDragonDetail(d);
    } else {
      const cv = card.querySelector("canvas"); if (cv) cv.style.display = "none";
    }
    grid.appendChild(card);
  });
  app.appendChild(grid);
  if (shown === 0)
    app.appendChild(el("div", "condition-line", _dexFilter === "fav"
      ? "お気に入りはまだありません（カード詳細から★を付けられます）。"
      : "まだ見た竜がいません。レースを観戦すると図鑑に記録されます。"));
  app.appendChild(el("div", "condition-line",
    "カードをタップで詳細。ノート解放: 1戦=基本 / 3戦=気性 / 5戦=適性 / 2賭=市場印象 / 8戦+複圏=物語"));

  const actions = el("div", "actions");
  const home = el("button", null, "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}

// §37 — 本日の注目レース: a daily-rotating spotlight among unlocked races. Gives
// the day a focal point + a once-daily completion bonus (a meta-reward like the
// login bonus — it does NOT change the race's odds / finish / payout formula).
function featuredRaceToday() {
  const unlocked = RACES.filter(r => r.rank <= state.player.rank);
  const pool = unlocked.length ? unlocked : RACES;
  const day = (typeof _epochDay === "function") ? _epochDay() : 0;
  return pool[((day % pool.length) + pool.length) % pool.length];
}
function featuredBonusAmount() {
  return Math.max(300, Math.floor((state.player.maxCoinsReached || 0) * 0.015));
}

// §37 — 図鑑コンプ報酬: milestone rewards as the dragon collection fills in.
const COLLECTION_MILESTONES = [
  { frac: 0.25, mult: 1, label: "図鑑 25%" },
  { frac: 0.50, mult: 2, label: "図鑑 50%" },
  { frac: 0.75, mult: 3, label: "図鑑 75%" },
  { frac: 1.00, mult: 6, label: "図鑑コンプリート" }
];
function collectionSeenCount() {
  return Object.values(state.player.collection || {}).filter(e => e && e.seen).length;
}
// Grant any newly-reached collection milestones; returns the awards granted this
// call ({label, reward}) so the result screen can celebrate them.
function checkCollectionRewards() {
  const total = DRAGONS.length || 1;
  const frac = collectionSeenCount() / total;
  const got = state.player.collectionRewards || (state.player.collectionRewards = []);
  const base = Math.max(500, Math.floor((state.player.maxCoinsReached || 0) * 0.01));
  const granted = [];
  COLLECTION_MILESTONES.forEach(m => {
    const key = String(m.frac);
    if (frac + 1e-9 >= m.frac && got.indexOf(key) < 0) {
      got.push(key);
      const reward = base * m.mult;
      state.player.coins += reward;
      granted.push({ label: m.label, reward });
    }
  });
  return granted;
}

// reusable photo header banner (image + scrim + title); CSS stone-plate fallback
function screenHeader(title, imgSrc) {
  const h = el("div", "screen-header");
  h.innerHTML =
    (typeof photoOr === "function" ? photoOr(imgSrc, "") : "") +
    `<div class="screen-header-scrim"></div><div class="screen-header-title">${title}</div>`;
  return h;
}

// 格付けバッジ（杯名はそのまま＋格を併記＝案A）。表示のみで収支ロジックは不変。
const RACE_GRADE = { 1: "新人", 2: "1勝", 3: "OP", 4: "L", 5: "GⅢ", 6: "GⅡ", 7: "GⅠ" };
function gradeBadgeHTML(rank) {
  const g = RACE_GRADE[rank] || ("R" + rank);
  const tier = rank >= 7 ? "g1" : rank >= 6 ? "g2" : rank >= 5 ? "g3" : rank >= 4 ? "gl" : "gn";
  return `<span class="grade-badge ${tier}">${g}</span>`;
}
// レース番号＝時間帯（朝→夜）。第一〜第五の並びを直感的に。
const RACE_TIME_LABEL = { 1: "🌅朝", 2: "☀️昼", 3: "🌇夕", 4: "🌆薄暮", 5: "🌙夜" };
function renderRaceSelect() {
  state.ui.screen = "race_select";
  runEventHooks("beforeRaceSelect");
  const app = beginScreen();
  app.appendChild(screenHeader("レース選択", "images/race_header.webp"));

  // 本日の注目レース — a prominent, daily-rotating spotlight
  try {
    const feat = featuredRaceToday();
    if (feat) {
      const claimed = (typeof _epochDay === "function") && state.player.featuredDoneDay === _epochDay();
      const fc = el("div", "feat-race");
      const theme = REGION_THEME[feat.region];
      if (theme) fc.style.setProperty("--region-accent", theme.accent);
      fc.innerHTML =
        `<div class="feat-tag">★ 本日の注目レース ★</div>` +
        `<div class="feat-name">${gradeBadgeHTML(feat.rank)}${raceFullName(feat)}</div>` +
        `<div class="feat-meta">Rank ${feat.rank}　${RANKS[feat.rank].label}　｜　${DISTANCE[feat.distance].label}　｜　${WEATHERS[feat.weather].label}</div>` +
        `<div class="feat-purpose">${feat.purpose}</div>` +
        `<div class="feat-reward ${claimed ? "done" : ""}">${claimed ? "本日の達成ボーナス 受取済み ✓" : "🎁 今日はじめての完走で 達成ボーナス！"}</div>` +
        `<button class="feat-go">注目レースへ ▶</button>`;
      fc.querySelector(".feat-go").onclick = () => renderRaceDetail(feat);
      app.appendChild(fc);
    }
  } catch (e) {}

  // 1枚のレースカード（カード全体タップ＋地方アクセント＋時間帯/距離/天候/上限＋コース早→中→後＋目的）
  // hideRegion: 地域別タブでは見出しに地域名があるので、カード名から冗長な地域接頭辞を外す。
  const buildRaceCard = (r, locked, hideRegion) => {
    const theme = REGION_THEME[r.region];
    const card = el("div", "rs-card" + (locked ? " locked" : ""));
    if (theme) { card.setAttribute("data-region", r.region); card.style.setProperty("--region-accent", theme.accent); }
    const wager = fmtCoins(RANKS[r.rank].maxWager * (VILLAGE_MULT[state.player.villageLevel] || 1));
    let name = raceFullName(r);
    if (hideRegion) {
      // 地域別タブ：見出しに地域名があるので接頭の地域名を外す。さらにグレード章（新人/1勝…）が
      // 続く場合はグレードバッジと重複するので外し、「新人 新人競竜杯」のような二重表記を避ける。
      if (name.indexOf(r.region) === 0) name = name.slice(r.region.length).replace(/^[ 　]+/, "");
      const gl = RACE_GRADE[r.rank];
      if (gl && name.indexOf(gl) === 0) name = name.slice(gl.length).replace(/^[ 　]+/, "");
    }
    card.innerHTML =
      `<div class="rs-card-main">` +
        `<div class="rs-head"><span class="rs-time">${RACE_TIME_LABEL[r.number] || ("第" + r.number)}</span>` +
          `<span class="rs-name">${gradeBadgeHTML(r.rank)}${name}</span></div>` +
        `<div class="rs-meta"><span class="rs-chip">${DISTANCE[r.distance].label}</span>` +
          `<span class="rs-chip">${WEATHERS[r.weather].label}</span>` +
          `<span class="rs-chip wager">上限 ${wager}</span></div>` +
        `<div class="rs-course"><span>${getSection("early", r.early).label}</span><i>→</i><span>${getSection("mid", r.mid).label}</span><i>→</i><span>${getSection("late", r.late).label}</span></div>` +
        (locked ? `<div class="rs-lock">🔒 ランク${r.rank} で解放</div>` : `<div class="rs-purpose">${r.purpose}</div>`) +
      `</div>` +
      `<div class="rs-arrow" aria-hidden="true">${locked ? "🔒" : "▶"}</div>`;
    if (!locked) card.onclick = () => { _heroRect = card.getBoundingClientRect(); renderRaceDetail(r); };
    return card;
  };

  // 選び方を2系統で切替：📍場所（地域）別＝第一〜第五が見やすい ／ 🏆格（ランク）別。
  const byRank = {}, byRegion = {};
  RACES.forEach(r => { (byRank[r.rank] = byRank[r.rank] || []).push(r); (byRegion[r.region] = byRegion[r.region] || []).push(r); });
  const ranks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  const regions = Object.keys(byRegion);   // RACES定義順（おおむねランク昇順）

  // ── 操作バー（sticky）：並べ替え（地域順/格順）＋表示フィルタ（今いける/すべて）。
  //    旧「モード→タブ→カード」の往復をやめ、1スクロールのグループ表示で全体を一望できる。
  let mode = state.ui.raceMode || "region";
  if (state.ui.raceShowLocked == null) state.ui.raceShowLocked = false;
  const ctrl = el("div", "rs-ctrl");
  const sortSeg = el("div", "rs-seg");
  const sRegion = el("button", "rs-seg-b", "📍 地域順");
  const sRank = el("button", "rs-seg-b", "🏆 格順");
  sortSeg.appendChild(sRegion); sortSeg.appendChild(sRank);
  const lockToggle = el("button", "rs-lockbtn", "");
  ctrl.appendChild(sortSeg); ctrl.appendChild(lockToggle);
  app.appendChild(ctrl);

  const listWrap = el("div", "rs-list");
  app.appendChild(listWrap);

  function renderList() {
    listWrap.innerHTML = "";
    const showLocked = state.ui.raceShowLocked;
    const groups = [];
    if (mode === "region") {
      regions.forEach(reg => {
        const races = (byRegion[reg] || []).slice().sort((a, b) => a.number - b.number || a.rank - b.rank);
        groups.push({ title: reg.replace(/地域$/, ""), sub: "第一〜第五（朝→夜）", races, hideRegion: true });
      });
    } else {
      ranks.forEach(rk => {
        const races = (byRank[rk] || []).slice().sort((a, b) => a.region.localeCompare(b.region) || a.number - b.number);
        groups.push({ title: (RANKS[rk] && RANKS[rk].label) || ("ランク" + rk), sub: races.length + "レース", races, grade: rk });
      });
    }
    let shownAny = 0, hiddenLocked = 0;
    groups.forEach(g => {
      const vis = g.races.filter(r => showLocked || r.rank <= state.player.rank);
      hiddenLocked += g.races.length - vis.length;
      if (!vis.length) return;
      shownAny += vis.length;
      const head = el("div", "rs-grp-head",
        `<b>${mode === "rank" ? gradeBadgeHTML(g.grade) : "📍 "}${g.title}</b><span>${g.sub}</span>`);
      listWrap.appendChild(head);
      const body = el("div", "rs-rank-body");
      vis.forEach(r => body.appendChild(buildRaceCard(r, r.rank > state.player.rank, g.hideRegion)));
      listWrap.appendChild(body);
    });
    if (!shownAny) listWrap.appendChild(el("div", "condition-line", "表示できるレースがありません。「すべて表示」で先のレースも見られます。"));
    else if (!showLocked && hiddenLocked > 0) listWrap.appendChild(el("div", "rs-morehint", `🔒 ほか ${hiddenLocked} レースはランクを上げると解放（「すべて表示」でプレビュー）`));
  }
  function syncCtrl() {
    sRegion.classList.toggle("on", mode === "region");
    sRank.classList.toggle("on", mode === "rank");
    lockToggle.classList.toggle("on", state.ui.raceShowLocked);
    lockToggle.innerHTML = state.ui.raceShowLocked ? "🔓 すべて表示中" : "▶ 今いけるレース";
  }
  sRegion.onclick = () => { mode = "region"; state.ui.raceMode = "region"; syncCtrl(); renderList(); };
  sRank.onclick = () => { mode = "rank"; state.ui.raceMode = "rank"; syncCtrl(); renderList(); };
  lockToggle.onclick = () => { state.ui.raceShowLocked = !state.ui.raceShowLocked; syncCtrl(); renderList(); };
  syncCtrl(); renderList();

  const back = el("button", "secondary", "ホームへ"); back.onclick = renderHome;
  app.appendChild(back);
}

// Reusable fold/expand (accordion) section — lets the player control how much of
// each info block is shown, so the bet flow isn't buried under reference data.
function uiCollapsible(headerHTML, openByDefault) {
  const wrap = el("div", "ui-collapse" + (openByDefault ? " open" : ""));
  const head = el("button", "ui-collapse-head",
    `<span class="uc-title">${headerHTML}</span><span class="uc-chev">▾</span>`);
  const body = el("div", "ui-collapse-body");
  head.onclick = () => wrap.classList.toggle("open");
  wrap.appendChild(head); wrap.appendChild(body);
  return { wrap, body };
}

function renderRaceDetail(race) {
  state.ui.screen = "race_detail";
  runEventHooks("afterRaceSelect", { race });

  // §09 §12-16 Entry encouragement opportunity (may modify entries).
  state.current = state.current || {};
  // (3) Celestia consult is per-race: reset its reveal when a NEW race opens.
  const _prevRaceId = state.current.race && state.current.race.id;
  if (_prevRaceId !== race.id) { state.current._celestiaRevealed = null; state.current._fixedResult = null; state.current._openAdvisor = null; }
  const _consultActive = !!state.current._celestiaRevealed && _prevRaceId === race.id;
  const offer = maybeOfferEntryEncouragement(race);
  if (offer) {
    state.current._encouragementOverride = offer;
    // queue the story dialogue — 立ち絵つきのセリフ演出で（未ロード時は従来モーダルへ）
    if (typeof Dialogue !== "undefined" && Dialogue.play) {
      Dialogue.play(offer.offer.dialogue.map(([speaker, text]) => ({ s: speaker, t: text })));
    } else {
      offer.offer.dialogue.forEach(([speaker, text]) => showEvent(speakerLabel(speaker), text));
    }
  } else {
    state.current._encouragementOverride = null;
  }

  // Compute odds (market simulation).
  runEventHooks("beforeEntryList", { race });
  // When Celestia's 神眼 has been consulted this race, REUSE the (collapsed)
  // odds + fixed forms so the reveal stays consistent; otherwise compute fresh.
  const oddsResult = _consultActive ? state.current.oddsResult : simulateMarket(race);
  // Generate trial-run forms shown to the player (cached so they stay
  // consistent during this race-detail session per §07 §11).
  const trialForms = _consultActive ? state.current.trialForms
    : (() => { const tf = {}; getRaceDragons(race).forEach(d => tf[d.id] = generateForm(d)); return tf; })();

  Object.assign(state.current, { race, oddsResult, trialForms, bet: _consultActive && state.current.bet ? state.current.bet : { type: "win", selections: [], wager: 100 } });
  // Tense tag for panyu hook when overpopular favorite has bad fit
  const fav = oddsResult.oddsData.find(o => o.popularityRank === 1);
  const tense = fav && fav.winOdds <= 2.5;
  runEventHooks("afterEntryList", { race, tags: tense ? ["tense_race"] : [] });
  runEventHooks("beforeDragonPreview", { race });
  runEventHooks("afterDragonPreview", { race, tags: tense ? ["tense_race"] : [] });

  const app = beginScreen();
  app.appendChild(el("h2", null, raceFullName(race)));

  // Race info card with region theme (§11 §23)
  const info = el("div", "card race-detail-card");
  const theme = REGION_THEME[race.region];
  if (theme) {
    info.setAttribute("data-region", race.region);
    info.style.setProperty("--region-from", theme.from);
    info.style.setProperty("--region-to", theme.to);
    info.style.setProperty("--region-accent", theme.accent);
  }
  info.innerHTML = `
    <div>
      <div><b>ランク:</b> Rank ${race.rank} (${RANKS[race.rank].label})</div>
      <div><b>距離:</b> ${DISTANCE[race.distance].label}</div>
      <div><b>天候:</b> ${WEATHERS[race.weather].label}</div>
      <div><b>最大賭金:</b> ${fmtCoins(RANKS[race.rank].maxWager)}</div>
    </div>
    <div>
      <div><b>序盤:</b> ${getSection("early",race.early).label}</div>
      <div><b>中盤:</b> ${getSection("mid",race.mid).label}</div>
      <div><b>終盤:</b> ${getSection("late",race.late).label}</div>
      <div class="condition-line">${race.purpose}</div>
    </div>
  `;
  // Popularity-sorted entries — shared by the pick cards and the dragon-info table.
  const sorted = [...oddsResult.oddsData].sort((a, b) => a.popularityRank - b.popularityRank);
  const betCap = RANKS[race.rank].maxWager * (VILLAGE_MULT[state.player.villageLevel] || 1.0);

  // ===== レース条件は常時表示（折りたたまない）。サケの現場眼を一言添える。 =====
  const condWrap = el("div", "race-conditions-always");
  const _sakeV = advVoiceHeader("sake"); if (_sakeV) condWrap.appendChild(_sakeV);
  condWrap.appendChild(info);
  app.appendChild(condWrap);

  // ===== Advisor hub — character "marks" up top, each opening ONE focused panel
  // below. Nothing opens until the player taps a face (progressive disclosure);
  // each lens lives where its mentor would give it:
  //   ミズ＝分析予想 ／ マクラ＝竜の力と試走 ／ スミカ＝賭け金の目安 ／ セレスティア＝神眼。
  // (レース条件は上に常時表示。) Core handicapping info is ALWAYS reachable; meeting an
  // advisor only adds their voice. Mizu's analysis & Celestia's reveal stay gated. =====
  app.appendChild(buildAdvisorHub());

  // -- advisor voice line, shown atop a panel once that advisor has been met --
  function advVoiceHeader(key) {
    const cast = STORY_CAST[key];
    if (!cast || (state.player.totalAssets || 0) < castUnlockAt(key)) return null;
    const v = el("div", "adv-voice");
    v.style.setProperty("--cg", cast.color);
    v.innerHTML =
      `<span class="adv-voice-sym">${cast.symbol}</span>` +
      `<span class="adv-voice-body"><span class="adv-voice-name">${cast.name.split("・")[0]}<small>（${cast.tag}）</small></span>` +
      `<span class="adv-voice-line">${STORY_RACE_VOICE[key] || cast.consult}</span></span>`;
    return v;
  }

  // -- the hub itself: a row of advisor marks + a single panel host below --
  function buildAdvisorHub() {
    const ADVS = [
      { key: "mizu",     label: "分析予想",     build: buildMizuPanel, gated: true },
      { key: "makura",   label: "ドラゴン情報", build: buildDragonPanel },
      { key: "sumika",   label: "財政状況",     build: buildFinancePanel },
      { key: "celestia", label: "1着を聞く",    build: buildCelestiaPanel, gated: true },
    ];
    const hub = el("div", "advisor-hub");
    hub.appendChild(el("div", "adv-hub-cap", "🎴 相談役をタップすると、その視点だけが開きます"));
    const tabRow = el("div", "adv-tabs");
    const host = el("div", "adv-panel-host");
    const btnByKey = {};
    ADVS.forEach(a => {
      const cast = STORY_CAST[a.key];
      let locked = a.gated && (state.player.totalAssets || 0) < castUnlockAt(a.key);
      let name = cast.name.split("・")[0], sym = cast.symbol;
      if (a.key === "celestia") {
        // 救済（破産3回超で“お姉さん”に出会う）でも解放。正体は第5話まで伏せる（名前/記号を隠す）。
        const met = (typeof getStoryFlag === "function" && getStoryFlag("celestiaStrangerSeen"));
        const revealed = (typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_5"));
        if (met) locked = false;
        if (!revealed) { name = "？？？"; sym = "🌌"; }
      }
      const b = el("button", "adv-tab" + (locked ? " locked" : ""));
      b.dataset.key = a.key;
      b.style.setProperty("--cg", cast.color);
      b.innerHTML =
        `<span class="adv-mark">${locked ? "🔒" : sym}</span>` +
        `<span class="adv-tab-label">${a.label}</span>` +
        `<span class="adv-tab-name">${name}</span>`;
      b.onclick = () => setOpen(state.current._openAdvisor === a.key ? null : a.key);
      btnByKey[a.key] = b;
      tabRow.appendChild(b);
    });
    hub.appendChild(tabRow);
    hub.appendChild(host);
    function setOpen(key) {
      state.current._openAdvisor = key || null;
      Object.keys(btnByKey).forEach(k => btnByKey[k].classList.toggle("active", k === key));
      host.innerHTML = "";
      host.classList.toggle("open", !!key);
      if (key) {
        const a = ADVS.find(x => x.key === key);
        if (a) { const p = a.build(); if (p) host.appendChild(p); }
      }
    }
    setOpen(state.current._openAdvisor || null);   // restore across same-race re-renders
    return hub;
  }

  // -- ミズ：分析予想パネル — 人気の理由を分解→はがした実力評価で本命/対抗/穴。
  //    総資産3000でミズと出会うまではロック表示（彼女の章「ミズの分析予想」に対応）。 --
  function buildMizuPanel() {
    const unlocked = (state.player.totalAssets || 0) >= castUnlockAt("mizu");
    if (!unlocked) {
      const cast = STORY_CAST.mizu;
      const wrap = el("div", "card adv-panel adv-locked mizu-locked");
      wrap.style.setProperty("--cg", cast.color);
      wrap.innerHTML =
        `<div class="cel-lock-row"><span class="cel-lock-sym">🔒</span>` +
        `<div class="cel-lock-body"><div class="cel-lock-title">ミズの分析予想は、まだ読めない</div>` +
        `<div class="cel-lock-sub">総資産 ${fmtCoins(castUnlockAt("mizu"))} でミズと出会うと、人気の理由を分解した本命・対抗・穴が読めます。</div></div></div>`;
      return wrap;
    }
    const a = generateMizuAnalysis(race, oddsResult, state.current.trialForms);
    const wrap = el("div", "card adv-panel mizu-panel");
    const v = advVoiceHeader("mizu"); if (v) wrap.appendChild(v);
    // 人気の理由を分解（はがす前）
    const pop = el("div", "mz-pop");
    pop.innerHTML = `<div class="mz-h">人気の理由を分解</div>` +
      a.popular.map(p =>
        `<div class="mz-pop-row${p.overhyped ? " over" : ""}">` +
        `<span class="mz-pop-rank">${p.popRank}番人気</span>` +
        `<span class="mz-pop-body"><b>${p.name}</b><span class="mz-pop-reason">${p.reason}</span></span>` +
        `<span class="mz-pop-verdict">${p.verdict}</span></div>`
      ).join("");
    wrap.appendChild(pop);
    // はがした上での本命・対抗・穴
    const picks = el("div", "mz-picks");
    const card = (role, label, p) =>
      `<div class="mz-pick ${role}">` +
      `<span class="mz-badge">${label}</span>` +
      `<span class="mz-pick-main"><b>${p.name}</b>` +
      `<span class="mz-pick-meta">${p.popRank}番人気・単${p.winOdds.toFixed(1)}・${p.style}</span>` +
      `<span class="mz-pick-why">${p.why}</span></span></div>`;
    picks.innerHTML = `<div class="mz-h">人気をはがした、私の予想</div>` +
      card("honmei", "◎ 本命", a.honmei) +
      card("taikou", "○ 対抗", a.taikou) +
      card("ana", "★ 穴", a.ana);
    wrap.appendChild(picks);
    wrap.appendChild(el("div", "mz-foot", "※ オッズは観客の願望が混ざった値。これは公開情報からの実力評価による予想で、的中を保証するものではありません。"));
    return wrap;
  }

  // -- スミカ：財政状況パネル（所持金から賭け金の目安を提案。タップで賭金へセット） --
  function buildFinancePanel() {
    const wrap = el("div", "card adv-panel fin-panel");
    const v = advVoiceHeader("sumika"); if (v) wrap.appendChild(v);
    const coins = Math.max(0, Math.floor(state.player.coins));
    const cap = Math.floor(betCap);
    const head = el("div", "fin-head");
    head.innerHTML =
      `<div class="fin-stat"><span class="fin-k">所持金</span><span class="fin-v">${fmtCoins(coins)}</span></div>` +
      `<div class="fin-stat"><span class="fin-k">この一戦の上限</span><span class="fin-v">${fmtCoins(cap)}</span></div>`;
    wrap.appendChild(head);
    wrap.appendChild(el("div", "fin-lead", "いまの所持金から、無理なく賭けられる目安です。タップすると賭金にセットします。"));
    const tiers = [
      { label: "手堅く",     pct: 0.05, cls: "t-safe", note: "日々を切らさない最小の勝負" },
      { label: "ほどほど",   pct: 0.10, cls: "t-mid",  note: "生活と両立する標準の賭け" },
      { label: "勝負どころ", pct: 0.20, cls: "t-bold", note: "自信があるときの上限目安" },
    ];
    const amtOf = pct => Math.max(1, Math.min(Math.floor(coins * pct), cap, coins));
    const row = el("div", "fin-tiers");
    const tip = el("div", "fin-tip");
    tiers.forEach(t => {
      const amt = amtOf(t.pct);
      const b = el("button", "fin-tier " + t.cls);
      b.innerHTML =
        `<span class="ft-label">${t.label}</span>` +
        `<span class="ft-amt">${fmtCoins(amt)}</span>` +
        `<span class="ft-pct">所持の${Math.round(t.pct * 100)}%</span>` +
        `<span class="ft-note">${t.note}</span>`;
      b.onclick = () => {
        if (typeof setWager === "function") setWager(amt);   // keeps slider + chips in sync
        else { const w = $("wager"); if (w) w.value = amt; if (typeof updateExpected === "function") updateExpected(); }
        row.querySelectorAll(".fin-tier").forEach(x => x.classList.remove("chosen"));
        b.classList.add("chosen");
        const need = !(state.current.betSel && state.current.betSel.length);
        tip.textContent = `賭金を ${fmtCoins(amt)} コインにセット。${need ? "本命を選んでから" : ""}「賭ける」へ進めます。`;
      };
      row.appendChild(b);
    });
    wrap.appendChild(row);
    wrap.appendChild(tip);
    wrap.appendChild(el("div", "fin-caution", "全額は賭けない——余力が、次の一戦を生みます。"));
    return wrap;
  }

  // -- セレスティア：1着を聞く（解放済みなら2段階の神眼、未解放ならロック表示） --
  // 解放＝総資産1億 or「救済」＝破産3回超で“知らないお姉さん”に出会う（js/epilogue_engine.js）。
  function buildCelestiaPanel() {
    const rich = (state.player.totalAssets || 0) >= castUnlockAt("celestia");
    const met = (typeof getStoryFlag === "function" && getStoryFlag("celestiaStrangerSeen"));
    if (rich || met) { const cel = celestiaSectionEl(); if (cel) return cel; }
    const cast = STORY_CAST.celestia;
    const wrap = el("div", "card adv-panel cel-locked");
    wrap.style.setProperty("--cg", cast.color);
    wrap.innerHTML =
      `<div class="cel-lock-row"><span class="cel-lock-sym">🔒</span>` +
      `<div class="cel-lock-body"><div class="cel-lock-title">“1着を聞ける相手” には、まだ出会っていない</div>` +
      `<div class="cel-lock-sub">総資産 ${fmtCoins(castUnlockAt("celestia"))} に届くか、何度も無一文になって立ち上がるうち、ふと現れる誰かに出会うかもしれません。</div></div></div>`;
    return wrap;
  }

  // ===== Betting panel — placed FIRST so the primary action needs no scrolling.
  // Selection is a grid of tappable dragon cards that fold the key handicapping
  // info (人気・脚質・単/複オッズ・印・近走) into the very thing you tap, so the
  // player reads-and-picks in one place instead of cross-referencing a dropdown.
  app.appendChild(el("h3", null, "賭けパネル"));
  // Wager bounds for the tap/drag stake controls (no number-typing required).
  const effMax = Math.max(1, Math.floor(Math.min(betCap, state.player.coins)));
  const wagerInit = Math.max(1, Math.min((_consultActive && state.current.bet && state.current.bet.wager) || Math.min(100, effMax), effMax));
  const panel = el("div", "card bet-panel");
  panel.innerHTML = `
    <div class="bet-tabs">
      <button data-type="win" class="active">単竜<small>1着</small></button>
      <button data-type="place">複竜<small>3着以内</small></button>
      <button data-type="wide">ワイド竜<small>2頭が3着以内</small></button>
    </div>
    <div class="bet-pick">
      <div class="bet-pick-head">
        <span id="pick-instruction"></span>
        <span class="pick-count" id="pick-count"></span>
      </div>
      <div class="bet-pick-grid" id="bet-pick-grid"></div>
    </div>
    <div class="bet-step1" id="bet-step1">
      <button id="bet-start" class="bet-start-btn" disabled>🐉 この本命で賭ける</button>
      <button id="back-race-select" class="secondary">戻る</button>
    </div>
    <div class="bet-step2" id="bet-step2" style="display:none">
      <div class="bet-sel-sum" id="bet-sel-sum"></div>
      <div class="wager-box">
        <div class="wager-head">
          <span class="wager-label">賭金</span>
          <span class="wager-amount"><input id="wager" class="wager-big" type="text" inputmode="numeric" value="${wagerInit}"><span class="wager-unit">コイン</span></span>
        </div>
        <div class="wager-slider-row">
          <button class="wager-step" id="wager-minus" type="button" aria-label="減らす">−</button>
          <input id="wager-slider" class="wager-slider" type="range" min="1" max="${effMax}" step="1" value="${wagerInit}">
          <button class="wager-step" id="wager-plus" type="button" aria-label="増やす">＋</button>
        </div>
        <div class="wager-quick" id="wager-chips"></div>
      </div>
      <div class="payout-box empty" id="expected-payout"><div class="po-hint">賭金を選ぶと払戻が表示されます</div></div>
      <div class="actions">
        <button id="bet-confirm" disabled>この内容で出走</button>
        <button id="bet-cancel" class="secondary">やめる</button>
      </div>
    </div>
    <div class="condition-line">所持: ${fmtCoins(state.player.coins)}コイン ／ 上限賭金: ${fmtCoins(betCap)}<span class="cl-note">（村Lv${state.player.villageLevel}補正込）</span></div>
  `;
  app.appendChild(panel);

  // ---- tappable dragon selection (replaces the sel-a/sel-b dropdowns) ----
  // Preserve the in-progress pick across a Celestia consult re-render — otherwise
  // asking 神眼 would silently wipe the player's already-tapped selection.
  state.current.betSel = (_consultActive && state.current.bet && state.current.bet.selections)
    ? state.current.bet.selections.slice() : [];      // selected ids, in pick order
  const pickGrid = $("bet-pick-grid");
  const pickCardById = {};
  const maxSelFor = type => (type === "wide" ? 2 : 1);
  const pickInstruction = type =>
    type === "wide" ? "3着以内に入る2頭をタップ"
      : type === "place" ? "3着以内に入る本命を1頭タップ"
        : "1着になる本命を1頭タップ";

  function renderPickState() {
    const type = state.current.bet.type;
    const max = maxSelFor(type);
    const sel = state.current.betSel;
    sorted.forEach(od => {
      const card = pickCardById[od.dragonId];
      const at = sel.indexOf(od.dragonId);
      card.classList.toggle("selected", at >= 0);
      card.setAttribute("aria-pressed", at >= 0 ? "true" : "false");
      const ord = card.querySelector(".bp-order");
      if (at >= 0) { ord.textContent = max > 1 ? (at === 0 ? "①" : "②") : "✓"; ord.style.display = "flex"; }
      else ord.style.display = "none";
      card.querySelector(".bp-win").classList.toggle("dim", type === "place");
      card.querySelector(".bp-place").classList.toggle("dim", type === "win");
    });
    $("pick-instruction").textContent = pickInstruction(type);
    $("pick-count").textContent = `${sel.length} / ${max}`;
    const complete = sel.length === max;
    const startBtn = $("bet-start");
    if (startBtn) {
      startBtn.disabled = !complete;
      // CTAに選択内容を反映＝「誰に賭けるか」を押す瞬間まで見失わせない
      if (complete) {
        const nm = id => { const d = DRAGONS.find(x => x.id === id); return d ? d.name : ""; };
        if (type === "wide") {
          startBtn.innerHTML = `🐉 <b>${nm(sel[0])}</b> ＋ <b>${nm(sel[1])}</b> で賭ける ▶`;
        } else {
          const o = sorted.find(x => x.dragonId === sel[0]);
          const oddsTx = o ? (type === "place" ? `複${o.placeOdds.toFixed(1)}倍` : `単${o.winOdds.toFixed(1)}倍`) : "";
          startBtn.innerHTML = `🐉 <b>${nm(sel[0])}</b> に賭ける${oddsTx ? `（${oddsTx}）` : ""} ▶`;
        }
      } else {
        startBtn.textContent = "🐉 この本命で賭ける";
      }
    }
    if (!complete) showBetStep(1);   // pick broke → fold the wager step back away
  }

  function togglePick(id) {
    const sel = state.current.betSel;
    const max = maxSelFor(state.current.bet.type);
    const at = sel.indexOf(id);
    if (at >= 0) sel.splice(at, 1);                   // tap again to deselect
    else { if (sel.length >= max) sel.shift(); sel.push(id); }  // drop oldest when full
    renderPickState();
    updateExpected();
  }

  sorted.forEach(od => {
    const d = DRAGONS.find(x => x.id === od.dragonId);
    const rk = od.popularityRank;
    const card = el("button", "bet-pick-card");
    card.type = "button";
    card.dataset.id = d.id;
    card.innerHTML = `
      <span class="bp-order" style="display:none"></span>
      <span class="bp-pop p${rk <= 3 ? rk : ""}">${rk}<small>人気</small></span>
      <span class="bp-main">
        <span class="bp-name"><span class="dragon-icon" style="background:${dragonColor(d)}">${d.name.charAt(0)}</span>${d.name}</span>
        <span class="bp-sub"><span class="style-${d.style}">${STYLE_LABEL[d.style]}</span>${d.newspaperMark ? `<span class="bp-mark">${d.newspaperMark}</span>` : ""}<span class="bp-form">${recentResultLabel(d.recentResult)}</span></span>
        <span class="bp-traits">${d.traits.join("・")}</span>
      </span>
      <span class="bp-odds">
        <span class="bp-win"><b>${od.winOdds.toFixed(1)}</b><small>単</small></span>
        <span class="bp-place"><b>${od.placeOdds.toFixed(1)}</b><small>複</small></span>
      </span>
    `;
    card.onclick = () => togglePick(d.id);
    pickCardById[d.id] = card;
    pickGrid.appendChild(card);
  });

  // Tabs — switch bet type, trimming the selection to the new max.
  panel.querySelectorAll(".bet-tabs button").forEach(btn => {
    btn.onclick = () => {
      panel.querySelectorAll(".bet-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.current.bet.type = btn.dataset.type;
      const max = maxSelFor(btn.dataset.type);
      if (state.current.betSel.length > max) state.current.betSel = state.current.betSel.slice(0, max);
      runEventHooks("beforeBet", { race, bet: state.current.bet });
      showBetStep(1);
      renderPickState();
      updateExpected();
    };
  });
  // Two-step bet: pick → 賭ける (commit) → wager + 出走/やめる. Keeps the wager UI
  // hidden until the player has decided to bet, so the panel reads cleanly.
  function showBetStep(n) {
    const s1 = $("bet-step1"), s2 = $("bet-step2");
    if (s1) s1.style.display = n === 1 ? "" : "none";
    if (s2) s2.style.display = n === 2 ? "" : "none";
  }
  // ---- Stake controls: slider + −/+ stepper + fraction chips. Tap or drag to set
  // the wager — no number-typing needed. The field stays editable for power users
  // but is NEVER auto-focused, so the mobile keyboard no longer pops up on every bet. ----
  const stepAmt = betStepSize(effMax);
  const wagerCur = () => { const n = parseInt(String($("wager").value || "").replace(/[^0-9]/g, ""), 10); return Number.isNaN(n) ? 0 : n; };
  function setWager(v) {
    v = Math.round(v); if (Number.isNaN(v)) v = 0;
    v = Math.max(1, Math.min(v, effMax));
    const w = $("wager"); if (w) w.value = v;
    const sl = $("wager-slider"); if (sl) sl.value = v;
    const cg = $("wager-chips"); if (cg) cg.querySelectorAll(".wchip").forEach(c => c.classList.toggle("chosen", +c.dataset.amt === v));
    updateExpected();
  }
  $("wager-slider").oninput = () => setWager(+$("wager-slider").value);
  $("wager-minus").onclick = () => setWager(wagerCur() - stepAmt);
  $("wager-plus").onclick = () => setWager(wagerCur() + stepAmt);
  $("wager").oninput = () => {                         // optional manual typing
    const n = wagerCur(); const sl = $("wager-slider");
    if (sl && n >= 1) sl.value = Math.min(n, effMax);
    updateExpected();
  };
  $("wager").onblur = () => setWager(wagerCur());       // clamp once they finish typing
  const chipsEl = $("wager-chips");
  [{ l: "¼", a: Math.round(effMax * 0.25) }, { l: "½", a: Math.round(effMax * 0.5) }, { l: "最大", a: effMax }].forEach(c => {
    const amt = Math.max(1, Math.min(c.a, effMax));
    const chip = el("button", "wchip");
    chip.type = "button"; chip.dataset.amt = amt;
    chip.innerHTML = `<span class="wchip-amt">${fmtCoins(amt)}</span><span class="wchip-sub">${c.l}</span>`;
    chip.onclick = () => setWager(amt);
    chipsEl.appendChild(chip);
  });

  $("bet-confirm").onclick = onConfirmBet;
  $("back-race-select").onclick = renderRaceSelect;
  $("bet-start").onclick = () => { showBetStep(2); setWager(wagerCur()); };
  $("bet-cancel").onclick = () => showBetStep(1);

  renderPickState();
  updateExpected();   // initial payout hint + confirm-disabled state

  // -- マクラ：ドラゴン情報パネル — 出走表 / 試走 / 妙味 をタブで1つずつ。中身は常に
  //    見られる中核情報。マクラと出会うと彼女の声が上に乗る。 --
  function buildDragonPanel() {
    const wrap = el("div", "card adv-panel");
    const v = advVoiceHeader("makura"); if (v) wrap.appendChild(v);
    const showTrial = state.ui.infoLevel !== "simple";
    const showValue = state.ui.infoLevel === "advanced" || state.ui.infoLevel === "expert";
    const anaTabs = el("div", "ana-tabs");
    anaTabs.innerHTML =
      `<button data-pane="form" class="active">出走表</button>` +
      (showTrial ? `<button data-pane="trial">試走</button>` : "") +
      (showValue ? `<button data-pane="value">妙味</button>` : "");
    wrap.appendChild(anaTabs);

    // -- pane: 出走表 (entry table) --
    const paneForm = el("div", "ana-pane active"); paneForm.dataset.pane = "form";
    const tbl = el("table", "entry-table");
    tbl.innerHTML = `
      <thead><tr>
        <th>人気</th><th>竜名</th><th>脚質</th>
        <th>速</th><th>耐</th><th>回</th><th>翼</th><th>火</th><th>気</th>
        <th>印</th><th>近</th>
        <th>単オッズ</th><th>複オッズ</th>
        <th>特徴</th>
      </tr></thead>
    `;
    const tbody = el("tbody");
    sorted.forEach(od => {
      const d = DRAGONS.find(x => x.id === od.dragonId);
      const tr = el("tr");
      const rk = od.popularityRank;
      tr.innerHTML = `
        <td><span class="popularity-rank p${rk<=3?rk:""}">${rk}</span></td>
        <td><span class="dragon-icon-row">${dragonIconPlaceholder(d)}<b>${d.name}</b></span></td>
        <td class="style-${d.style}">${STYLE_LABEL[d.style]}</td>
        <td class="num rank-${statRank(d.stats.speed)}">${statRank(d.stats.speed)}</td>
        <td class="num rank-${statRank(d.stats.stamina)}">${statRank(d.stats.stamina)}</td>
        <td class="num rank-${statRank(d.stats.turn)}">${statRank(d.stats.turn)}</td>
        <td class="num rank-${statRank(d.stats.wing)}">${statRank(d.stats.wing)}</td>
        <td class="num rank-${statRank(d.stats.fire)}">${statRank(d.stats.fire)}</td>
        <td class="num rank-${statRank(d.stats.nerve)}">${statRank(d.stats.nerve)}</td>
        <td class="mark">${d.newspaperMark || "-"}</td>
        <td class="num">${recentResultLabel(d.recentResult)}</td>
        <td class="num odds-win">${od.winOdds.toFixed(1)}</td>
        <td class="num odds-place">${od.placeOdds.toFixed(1)}</td>
        <td class="dragon-traits">${d.traits.join(" / ")}</td>
      `;
      if (state.ui.debug) {
        tr.appendChild(el("td", "debug-info", `pop=${od.popularityPower.toFixed(1)} winP=${(od.marketWinProb*100).toFixed(1)}% placeP=${(od.marketPlaceProb*100).toFixed(1)}%`));
      }
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    paneForm.appendChild(tbl);
    wrap.appendChild(paneForm);

    // -- pane: 試走サマリー (standard+) --
    if (showTrial) {
      const paneTrial = el("div", "ana-pane"); paneTrial.dataset.pane = "trial";
      const trialTbl = el("table", "trial-table");
      trialTbl.innerHTML = `<thead><tr>
        <th>竜名</th><th>体調</th><th>集中</th>
        <th>試走スタート</th><th>試走旋回</th><th>試走終い</th>
        <th>騎手呼吸</th><th>注釈</th>
      </tr></thead>`;
      const tbody2 = el("tbody");
      sorted.forEach(od => {
        const d = DRAGONS.find(x => x.id === od.dragonId);
        const f = state.current.trialForms[d.id];
        const cls = v => v >= 75 ? "trial-good" : v >= 55 ? "trial-mid" : "trial-bad";
        const note = trialNote(d, f);
        const tr = el("tr");
        tr.innerHTML = `
          <td><b>${d.name}</b></td>
          <td class="${cls(f.bodyCondition)}">${statRank(f.bodyCondition)}</td>
          <td class="${cls(f.focus)}">${statRank(f.focus)}</td>
          <td class="${cls(f.trialStart)}">${statRank(f.trialStart)}</td>
          <td class="${cls(f.trialTurn)}">${statRank(f.trialTurn)}</td>
          <td class="${cls(f.trialFinish)}">${statRank(f.trialFinish)}</td>
          <td class="${cls(f.riderSync)}">${statRank(f.riderSync)}</td>
          <td class="trial-note">${note}</td>
        `;
        tbody2.appendChild(tr);
      });
      trialTbl.appendChild(tbody2);
      paneTrial.appendChild(trialTbl);
      wrap.appendChild(paneTrial);
    }

    // -- pane: 妙味の手がかり (advanced/expert) --
    if (showValue) {
      const paneValue = el("div", "ana-pane"); paneValue.dataset.pane = "value";
      const hints = generateValueHints(race, oddsResult, state.current.trialForms);
      hints.forEach(h => paneValue.appendChild(el("div", "value-hint", h)));
      wrap.appendChild(paneValue);
    }

    // tab wiring — switch the visible pane (scoped to THIS panel)
    anaTabs.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        anaTabs.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        wrap.querySelectorAll(".ana-pane").forEach(p => p.classList.toggle("active", p.dataset.pane === btn.dataset.pane));
      };
    });
    return wrap;
  }

}

// §11 §19 placeholder dragon icon — colored disc + name initial.
function dragonIconPlaceholder(d) {
  const color = dragonColor(d);
  const initial = d.name.charAt(0);
  return `<span class="dragon-icon" style="background:${color}">${initial}</span>`;
}

function trialNote(d, f) {
  const notes = [];
  if (f.bodyCondition >= 75) notes.push("鱗のツヤ良");
  else if (f.bodyCondition < 50) notes.push("足取り重い");
  if (f.trialStart >= 80) notes.push("発走◎");
  else if (f.trialStart < 50) notes.push("出遅れ気味");
  if (f.trialFinish >= 80) notes.push("終い伸びる");
  else if (f.trialFinish < 50) notes.push("終い甘い");
  if (f.trialTurn >= 80) notes.push("旋回滑らか");
  else if (f.trialTurn < 50) notes.push("旋回外膨れ");
  if (f.riderSync >= 80) notes.push("呼吸◎");
  if (notes.length === 0) notes.push("並み");
  return notes.join("／");
}

function generateValueHints(race, oddsResult, trialForms) {
  // Quick rough estimate: weight basePower + coursePower fit, compare to popularityPower
  const hints = [];
  const items = getRaceDragons(race).map(d => {
    const cp = coursePower(d, race);
    const wp = weightedStat(d.stats, WEATHERS[race.weather].weights);
    const f = trialForms[d.id];
    const fp = formPower(f);
    const fit = basePower(d) * 0.35 + cp.total * 0.20 + wp * 0.10 + fp * 0.15;
    const od = oddsResult.oddsData.find(o => o.dragonId === d.id);
    return { d, fit, popularityPower: od.popularityPower, popRank: od.popularityRank, winOdds: od.winOdds };
  });
  // Sort by fit-vs-popularity gap
  items.sort((a,b) => (b.fit - b.popularityPower) - (a.fit - a.popularityPower));
  const top = items.slice(0,2);
  const bot = items.slice(-2);
  top.forEach(it => {
    if (it.fit - it.popularityPower > 5) {
      hints.push(`💡 ${it.d.name} (${it.popRank}番人気・単${it.winOdds.toFixed(1)}): コース適性が市場評価より高い (推定差 +${(it.fit - it.popularityPower).toFixed(1)})`);
    }
  });
  bot.forEach(it => {
    if (it.popularityPower - it.fit > 5) {
      hints.push(`⚠ ${it.d.name} (${it.popRank}番人気・単${it.winOdds.toFixed(1)}): 市場が過剰評価の可能性 (推定差 -${(it.popularityPower - it.fit).toFixed(1)})`);
    }
  });
  if (hints.length === 0) hints.push("今回は市場と実力の差が小さい平穏なレースです。");
  return hints;
}

// ミズの分析予想 — 人気の理由を（公開情報の）成分に分解し、人気バイアスを「はがした」
// 実力評価から本命・対抗・穴を出す。fit は generateValueHints と同じ公開情報ベースの
// 合成値（持ち能力・コース適性・天候・調子）で、レース結果や「このレースで効く力」を
// 明かすものではない＝予想であって正解ではない。
function generateMizuAnalysis(race, oddsResult, trialForms) {
  const items = getRaceDragons(race).map(d => {
    const cp = coursePower(d, race);
    const wp = weightedStat(d.stats, WEATHERS[race.weather].weights);
    const fp = formPower(trialForms[d.id]);
    const fit = basePower(d) * 0.35 + cp.total * 0.20 + wp * 0.10 + fp * 0.15;
    const od = oddsResult.oddsData.find(o => o.dragonId === d.id) || {};
    return { d, fit, pop: od.popularityPower || 0, popRank: od.popularityRank || 99,
             winOdds: od.winOdds || 0, comp: od.components || {} };
  });
  const byFit = [...items].sort((a, b) => b.fit - a.fit);
  byFit.forEach((it, i) => { it.fitRank = i + 1; });
  const byPop = [...items].sort((a, b) => a.popRank - b.popRank);

  // why a favorite is popular — pick the strongest VISIBLE driver (incl. pure hype)
  const reasonFor = it => {
    const c = it.comp, d = it.d, cands = [];
    if ((d.recentResult || 60) >= 88) cands.push(["前走勝ち級の勢い", 3.0]);
    else if ((d.recentResult || 60) >= 74) cands.push(["前走の好走", 2.6]);
    if (d.newspaperMark === "◎") cands.push(["新聞の本命◎印", 2.4]);
    else if (d.newspaperMark === "○") cands.push(["新聞の対抗○印", 2.0]);
    if ((c.visiblePower || 0) >= 72) cands.push(["持ち数字の高さ", 1.9]);
    if ((c.fanBias || 0) >= 68 || (c.publicImage || 0) >= 68) cands.push(["ファン人気・知名度", 1.6]);
    if ((c.courseReputation || 0) >= 72) cands.push(["コース実績の評判", 1.3]);
    if ((c.formImpression || 0) >= 70) cands.push(["パドックの好調感", 1.1]);
    cands.sort((x, y) => y[1] - x[1]);
    return cands.length ? cands[0][0] : "全体的な安定感";
  };
  // Compare ability RANK vs popularity RANK — robust to the fit/pop scale gap
  // (pop weights sum to 1.0, fit to 0.8, so raw pop−fit is always positive).
  const popular = byPop.slice(0, 3).map(it => {
    const gap = it.fitRank - it.popRank;             // +: popularity ahead of ability
    return {
      name: it.d.name, popRank: it.popRank, winOdds: it.winOdds, reason: reasonFor(it),
      overhyped: gap >= 2,
      verdict: gap >= 2 ? `実力評価は${it.fitRank}番手——人気先行`
        : gap <= -1 ? "人気以上に実力上位"
          : "支持に実力が伴う"
    };
  });

  // peel popularity away → rank by ability; 穴 = most undervalued among the unpopular
  const honmei = byFit[0], taikou = byFit[1];
  const anaPool = items.filter(it => it.popRank >= 4 && it !== honmei && it !== taikou);
  const ana = anaPool.length
    ? anaPool.slice().sort((x, y) => (y.popRank - y.fitRank) - (x.popRank - x.fitRank))[0]
    : (byFit.find(it => it !== honmei && it !== taikou) || byFit[2] || byFit[0]);

  const why = (it, role) =>
    role === "honmei" ? `実力評価1番手。${it.popRank <= 2 ? "人気でも中身が伴う" : "人気以上の総合力"}。`
      : role === "taikou" ? "実力評価2番手。展開ひとつで逆転も。"
        : `市場は${it.popRank}番人気と低評価だが、実力評価は${it.fitRank}番手。妙味は十分。`;
  const fmt = (it, role) => ({ name: it.d.name, popRank: it.popRank, winOdds: it.winOdds,
                               style: STYLE_LABEL[it.d.style], why: why(it, role) });
  return { popular, honmei: fmt(honmei, "honmei"), taikou: fmt(taikou, "taikou"), ana: fmt(ana, "ana") };
}

function recentResultLabel(v) {
  if (v >= 90) return "前走◎";
  if (v >= 75) return "好走";
  if (v >= 55) return "普通";
  return "凡走";
}

// Stake stepper increment — a "nice" round step scaled to the effective max, so
// the −/+ buttons feel right whether this race's cap is 100 or 1,000,000.
function betStepSize(max) {
  if (max <= 50) return 5;
  if (max <= 200) return 10;
  if (max <= 1000) return 50;
  if (max <= 5000) return 100;
  if (max <= 20000) return 500;
  if (max <= 100000) return 1000;
  if (max <= 1000000) return 10000;
  return Math.max(1, Math.round(max / 100));
}

function updateExpected() {
  const c = state.current;
  const type = document.querySelector(".bet-tabs button.active").dataset.type;
  const sel = c.betSel || [];                         // tappable-card selection (pick order)
  const a = sel[0] || "";
  const b = sel[1] || "";
  const wager = parseInt($("wager").value, 10);
  c.bet = { type, selections: type === "wide" ? [a, b] : [a], wager: Number.isNaN(wager) ? 0 : wager };

  const box = $("expected-payout");
  const confirmBtn = $("bet-confirm");
  const wagerEl = $("wager");
  box.style.color = "";                             // clear any prior inline error tint
  box.classList.remove("empty", "valid", "invalid");
  if (wagerEl) wagerEl.classList.remove("invalid");
  const setHint = (cls, msg) => {
    box.classList.add(cls);
    box.innerHTML = `<div class="po-hint">${msg}</div>`;
    if (confirmBtn) confirmBtn.disabled = true;
    if (wagerEl && cls === "invalid") wagerEl.classList.add("invalid");   // 入力欄にも赤枠で即時フィードバック
    const _ss = $("bet-sel-sum"); if (_ss) _ss.innerHTML = "";
  };

  // 1) incomplete selection → friendly prompt, confirm stays disabled
  if (!(a && (type !== "wide" || b))) {
    setHint("empty", (type === "wide" ? "2頭" : "竜") + "と賭金を選ぶと払戻が表示されます");
    return;
  }
  // 2) validation (wager range / coins / cap / duplicate) → inline reason
  const err = validateBet(c.bet, c.race);
  if (err) { setHint("invalid", err); return; }
  // 3) valid → structured odds / payout / profit readout
  let odds, payout;
  try {
    odds = betOdds(c.bet, c.oddsResult);
    payout = Math.floor(c.bet.wager * odds);
  } catch (e) { setHint("invalid", "オッズ計算エラー"); return; }
  box.classList.add("valid");
  // ステップ2でも「誰に・どの賭式で」を常時表示（賭金をいじっている間に本命を見失わない）
  const ss = $("bet-sel-sum");
  if (ss) {
    const tL = { win: "単竜", place: "複竜", wide: "ワイド竜" }[type] || type;
    const nm = id => { const d = DRAGONS.find(x => x.id === id); return d ? d.name : ""; };
    ss.innerHTML =
      `<span class="bss-k">本命</span><b class="bss-nm">${nm(a)}${type === "wide" ? " ＋ " + nm(b) : ""}</b>` +
      `<span class="bss-odds">${tL} ${odds.toFixed(1)}倍</span>` +
      `<button type="button" class="bss-edit" id="bet-edit">変更</button>`;
    const be = ss.querySelector("#bet-edit");
    if (be) be.onclick = () => {
      const s1 = $("bet-step1"), s2 = $("bet-step2");
      if (s1) s1.style.display = ""; if (s2) s2.style.display = "none";
    };
  }
  // リスクとリターンを常に対で見せる（ハズレ時の損失も明示）
  box.innerHTML =
    `<div class="po-line"><span class="pl-k">オッズ</span><span class="pl-v">${odds.toFixed(1)} 倍</span></div>` +
    `<div class="po-line"><span class="pl-k">的中時払戻</span><span class="pl-v">${fmtCoins(payout)} コイン</span></div>` +
    `<div class="po-line po-profit"><span class="pl-k">利益（上乗せ）</span><span class="pl-v">+${fmtCoins(payout - c.bet.wager)}</span></div>` +
    `<div class="po-line po-loss"><span class="pl-k">ハズレ時</span><span class="pl-v">−${fmtCoins(c.bet.wager)}</span></div>`;
  if (confirmBtn) confirmBtn.disabled = false;
}

function onConfirmBet(skipDialog) {
  const c = state.current;
  const err = validateBet(c.bet, c.race);
  if (err) {
    const ep = document.getElementById("expected-payout");
    if (ep) { ep.textContent = "エラー: " + err; ep.style.color = "#ff8080"; }
    return;
  }
  // §07 §13 confirmation dialog to prevent accidental bets.
  if (!skipDialog) {
    showBetConfirm();
    return;
  }
  // Deduct wager up-front
  state.player.coins -= c.bet.wager;
  updateHeader();
  saveGame();
  runEventHooks("afterBet", { race: c.race, bet: c.bet });
  // Run race using the trial-run forms shown to the player.
  runEventHooks("duringRace", { race: c.race });
  // (3) reuse the result Celestia's 神眼 already fixed, so the reveal stays true.
  const raceResult = c._fixedResult || runRace(c.race, c.trialForms);
  // Spec #27: broadcast cache invalidated for each new race run.
  c.broadcast = null; c.commentary = null; c.broadcastState = null;
  // Canvas-race rebuild: drop the old timeline + stop any running player.
  c.timeline = null;
  if (typeof stopRacePlayer === "function") stopRacePlayer();
  // Spec #29: recap is rebuilt per race; result-screen hooks fire once.
  // Spec #37: the win-moment celebration also re-arms for the new race.
  c.recap = null; c.recapTab = "result"; c.resultHooksRan = false; c.celebrated = false;
  c.raceResult = raceResult;
  c._fixedResult = null; c._celestiaRevealed = null;   // consult is consumed by the run
  const betResult = resolveBet(c.bet, raceResult, c.oddsResult);
  c.betResult = betResult;
  // Defer the payout + all result-derived progression to the result screen so
  // watching the race never spoils the outcome via the coin counter. settleRace()
  // runs exactly once on 答え合わせ. The up-front wager deduction is already saved.
  c.settled = false;
  // Durability: persist the owed payout so an abandoned race (reload/close mid-watch)
  // is still credited on next load — state.current itself is not persisted.
  state.player.pendingPayout = (c.betResult && c.betResult.payout) || 0;
  saveGame();
  // レース直前の煽り（立ち絵）→ 閉じてからレース映像へ。結果は既に runRace で確定済み・不変。
  if (window.DLG && DLG.PRE_RACE_HYPE && window.Dialogue && Dialogue.play) {
    Dialogue.play(DLG.preRace(c.race, c.bet)).then(renderRaceRun);
  } else {
    renderRaceRun();
  }
}

// §settlement (477a0b7) — apply the race outcome to the wallet + progression
// exactly once, when the result screen (答え合わせ) is reached. Kept out of
// onConfirmBet so the coin counter doesn't reveal the result before the player
// watches the race. state.current is not persisted, so no reload double-settle.
function settleRace() {
  const c = state.current;
  if (c.settled || !c.betResult || !c.raceResult) return;
  c.settled = true;
  state.player.pendingPayout = 0;   // consumed normally — nothing to reconcile on next load
  const betResult = c.betResult, raceResult = c.raceResult;
  // Award payout
  state.player.coins += betResult.payout;
  state.player.completedRaces += 1;
  state.player.completedByRank[c.race.rank] = (state.player.completedByRank[c.race.rank] || 0) + 1;
  if (betResult.hit && c.bet.type === "win") {
    state.player.wins += 1;
    state.player.winsByRank[c.race.rank] = (state.player.winsByRank[c.race.rank] || 0) + 1;
  }
  // §37 Tier 2 — win streak (連勝). Any hit extends it; a miss breaks it. At
  // milestone streaks a "連勝ボーナス" is paid (scaled by THIS payout, so it
  // tracks the bet size / rank). The base payout formula is unchanged.
  const prevStreak = state.player.streak || 0;
  let streakBonus = 0, streakMilestone = 0;
  // 🛍️ モール解放トリガー（初的中）。フラグは即保存系（settle内）、イベント本体は結果画面で再生。
  if (!state.player.flags) state.player.flags = {};
  c.firstHitEver = !!betResult.hit && !state.player.flags.everHit;
  if (betResult.hit) state.player.flags.everHit = true;
  if (betResult.hit) {
    state.player.streak = prevStreak + 1;
    if (state.player.streak > (state.player.bestStreak || 0)) state.player.bestStreak = state.player.streak;
    const f = STREAK_BONUS_FACTOR[state.player.streak];
    if (f) { streakBonus = Math.floor(betResult.payout * f); streakMilestone = state.player.streak; state.player.coins += streakBonus; }
  } else {
    state.player.streak = 0;
  }
  c.streakInfo = {
    streak: state.player.streak, best: state.player.bestStreak || 0, prev: prevStreak,
    broke: (!betResult.hit && prevStreak >= 2), bonus: streakBonus, milestone: streakMilestone
  };
  updateCollectionFromRace(raceResult, c.bet, betResult);
  // §37 — 注目レース日次ボーナス + 図鑑コンプ報酬 (meta-rewards; not part of payout).
  try {
    const fday = (typeof _epochDay === "function") ? _epochDay() : null;
    if (fday != null && c.race && typeof featuredRaceToday === "function" &&
        featuredRaceToday().id === c.race.id && state.player.featuredDoneDay !== fday) {
      state.player.featuredDoneDay = fday;
      const fb = featuredBonusAmount();
      state.player.coins += fb;
      c.featuredBonus = fb;
    }
  } catch (e) {}
  try { c.collectionAwards = (typeof checkCollectionRewards === "function") ? checkCollectionRewards() : []; }
  catch (e) { c.collectionAwards = []; }
  gainVillageExp(c.race, betResult && betResult.hit, raceResult._newDragonsThisRace || 0);
  checkEconomyMilestones(betResult);
  const _rank0 = state.player.rank;
  checkRankProgression();
  // §30 — update total-asset progression from the payout (after coins/village/
  // rank/collection have settled). maxCoinsReached + 総資産 only ever rise.
  bumpMaxCoins();
  const prevStage = state.assets.unlockedLifeStages || 0;
  const prevTotal = state.player.totalAssets || 0;
  const _lifeP0 = (typeof lifeTreeStats === "function") ? lifeTreeStats().earned : 0;
  const ra = recomputeAssets(state);
  const newTotal = state.player.totalAssets || 0;
  // (a) story: any chapter whose 総資産 threshold was crossed THIS race pops up.
  const justUnlocked = STORY_CHAPTERS.filter(ch => prevTotal < storyUnlockAt(ch.id) && newTotal >= storyUnlockAt(ch.id));
  if (ra.level > prevStage || justUnlocked.length) {
    runEventHooks("onStoryUnlock", { stage: ra.level, chapter: ra.unlockedStory, chapters: justUnlocked });
  }
  // 終章：絶滅メーターの綱引き（終章中のみ・内部ガード。表示メタ＝着順/オッズ/配当には非干渉）。
  if (typeof doomTick === "function") {
    doomTick();                                                      // レース確定＝淘汰が前進
    if (betResult.hit) epPush(c.bet.type === "win" ? "win" : "hit"); // 守り手予想家の信頼＝評判
    if (ra.level > prevStage) epPush("assetLevel");                  // 暮らし向上＝経済発展
  }
  // 📦 獲得台帳（このレースで増えたもの一覧＝結果画面の「今回の獲得」。表示専用・数値はここまでで確定済み）
  try {
    const _lifeP1 = (typeof lifeTreeStats === "function") ? lifeTreeStats().earned : _lifeP0;
    let _mission = false;
    if (state.player.dailyM && (state.player.completedRaces - state.player.dailyM.races0) === 1) _mission = true;   // この1走でデイリー「出走」を達成
    c.gainLedger = {
      hit: !!betResult.hit, payout: betResult.payout, wager: betResult.wager,
      streakBonus, featuredBonus: c.featuredBonus || 0,
      collectionCoins: (c.collectionAwards || []).reduce((a, x) => a + (x.reward || 0), 0),
      collectionLabels: (c.collectionAwards || []).map(x => x.label),
      assetsDelta: Math.max(0, newTotal - prevTotal),
      lifePDelta: Math.max(0, _lifeP1 - _lifeP0),
      rankUp: state.player.rank > _rank0 ? state.player.rank : 0,
      storyUnlocked: justUnlocked.map(ch => ch.title),
      mission: _mission
    };
  } catch (e) { c.gainLedger = null; }
  saveGame();
  updateHeader();
  if (justUnlocked.length) showStoryUnlock(justUnlocked);   // popup over the result screen
}

// §07 §13 Bet confirmation modal.
function showBetConfirm() {
  const c = state.current;
  const typeLabel = { win:"単竜", place:"複竜", wide:"ワイド竜" }[c.bet.type];
  const sel = c.bet.selections.map(id => DRAGONS.find(d => d.id === id).name).join(" + ");
  const odds = betOdds(c.bet, c.oddsResult);
  const payout = Math.floor(c.bet.wager * odds);
  const overlay = document.getElementById("event-overlay");
  document.getElementById("event-speaker").textContent = "賭けの確認";
  document.getElementById("event-text").innerHTML =
    `<div class="bcf-row"><span class="k">賭式</span><b>${typeLabel}</b></div>` +
    `<div class="bcf-row"><span class="k">選択</span><b>${sel}</b></div>` +
    `<div class="bcf-row"><span class="k">賭金</span><b>${fmtCoins(c.bet.wager)} コイン</b></div>` +
    `<div class="bcf-row"><span class="k">オッズ</span><b>${odds.toFixed(1)} 倍</b></div>` +
    `<div class="bcf-pay">的中時払戻 <b>${fmtCoins(payout)}</b> コイン</div>` +
    `<div class="bcf-q">この賭けで出走しますか？</div>`;
  // Swap close button for two buttons（出走＝主ボタン／やめる＝副）
  const closeBtn = document.getElementById("event-close");
  closeBtn.style.display = "none";
  let existing = document.getElementById("bet-confirm-actions");
  if (existing) existing.remove();
  const actions = document.createElement("div");
  actions.id = "bet-confirm-actions";
  const no = document.createElement("button"); no.textContent = "やめる"; no.className = "secondary";
  no.onclick = () => { closeBetConfirm(); };
  const yes = document.createElement("button"); yes.textContent = "🐉 出走する"; yes.className = "bcf-go";
  yes.onclick = () => { closeBetConfirm(); onConfirmBet(true); };
  actions.appendChild(no); actions.appendChild(yes);
  closeBtn.parentNode.appendChild(actions);
  overlay.classList.remove("hidden");
}
function closeBetConfirm() {
  const overlay = document.getElementById("event-overlay");
  overlay.classList.add("hidden");
  document.getElementById("event-close").style.display = "";
  const a = document.getElementById("bet-confirm-actions");
  if (a) a.remove();
}

// =========================================================================
// Spec #27: Phase-based pixel race broadcast
// =========================================================================

// Comfortable race-call cadence: ~1 short line per 1.1 seconds at 1x.
// Specs §27 §9.3 imply 6-18 lines per phase, so a 5-phase race fits roughly
// 50-80 lines → 60-90 seconds at 1x with no input required.
const AUTO_TICK_MS = 1100;

/**
 * In-race view (rebuilt as a continuous <canvas> race).
 *
 * The numerical result is decided already; here we only VISUALISE it. We still
 * build the broadcast + commentary (the recap & telop read them), then build a
 * continuous timeline (race_timeline_engine.js) whose finish order is guaranteed
 * identical to raceResult, and hand it to the canvas player (race_canvas.js).
 */
function renderRaceRun() {
  state.ui.screen = "race_run";
  const c = state.current;
  // If a player is already animating this race, don't tear it down on an
  // incidental rerender (e.g. the debug / info-level toggles call us again).
  if (c.racePlayer && document.getElementById("race-canvas-host")) return;

  if (!c.broadcast) {
    c.broadcast = buildBroadcastData(c.race, c.raceResult, c.bet, c.oddsResult);
    c.commentary = buildAllCommentary(c.broadcast, { race: c.race, bet: c.bet, oddsResult: c.oddsResult, raceResult: c.raceResult });
  }
  if (!c.timeline) {
    c.timeline = buildRaceTimeline(c.race, c.raceResult, c.oddsResult, c.bet);
  }
  if (window.Dialogue && Dialogue.dismiss) Dialogue.dismiss();   // 出走直前に保留中の立ち絵セリフを閉じる（レース上に被せない）
  const app = beginScreen();
  const host = el("div"); host.id = "race-canvas-host";
  app.appendChild(host);
  startRaceCanvas(host, {
    race: c.race, raceResult: c.raceResult, oddsResult: c.oddsResult, bet: c.bet,
    betResult: c.betResult,
    timeline: c.timeline, commentary: c.commentary, broadcast: c.broadcast
  });
  // （レース隅のマスコット竜は撤去：レース画面には不要。音量ボタンはグローバル常設 mountVolumeFab）
}

function stopAutoTimer() {
  const bs = state.current && state.current.broadcastState;
  if (bs && bs.timer) { clearTimeout(bs.timer); bs.timer = null; }
  // Canvas race player cleanup (RAF loop + listeners).
  if (typeof stopRacePlayer === "function") stopRacePlayer();
}

function startAutoTimer() {
  const bs = state.current && state.current.broadcastState;
  if (!bs) return;
  stopAutoTimer();
  if (!bs.autoMode) return;
  scheduleNextTick();
}

// §28 §5.2: each phase has its own telop tempo (faster near the finish), so we
// reschedule a one-shot timer using the CURRENT phase's tempoMs rather than a
// fixed interval.
function scheduleNextTick() {
  const c = state.current;
  const bs = c && c.broadcastState;
  if (!bs || !bs.autoMode) return;
  const q = c.commentary[bs.phaseIdx];
  const tempo = (q && q.tempoMs) ? q.tempoMs : AUTO_TICK_MS;
  bs.timer = setTimeout(autoTick, Math.max(140, tempo / bs.speed));
}

function autoTick() {
  const c = state.current;
  const bs = c && c.broadcastState;
  if (!bs) return;
  bs.timer = null;
  if (state.ui.screen !== "race_run") { stopAutoTimer(); return; }
  // Pause while a Mimi/Sake event overlay is showing so we don't talk over it.
  const overlay = document.getElementById("event-overlay");
  if (overlay && !overlay.classList.contains("hidden")) { scheduleNextTick(); return; }
  // End-of-race: stop auto and wait for the user to click "結果を見る".
  const lastPhaseIdx = c.broadcast.phases.length - 1;
  if (bs.phaseIdx === lastPhaseIdx
      && bs.lineIdx >= c.commentary[lastPhaseIdx].lines.length - 1) {
    bs.autoMode = false;
    renderBroadcastScreen();
    return;
  }
  stepLineOrPhase();
  scheduleNextTick();
}

/**
 * Renders/updates the broadcast screen.
 *
 * Two-pass rendering:
 *  1. First call: build the persistent shell (header / scene with 8 dragon
 *     nodes / rank bar / bet / mimi / controls / log).
 *  2. Subsequent calls (and every phase change): update positions, classes,
 *     and content WITHOUT rebuilding DOM, so CSS transitions can animate
 *     "passing / being passed" position changes.
 */
function renderBroadcastScreen() {
  const c = state.current;
  let wrap = document.getElementById("broadcast-wrap");
  if (!wrap || wrap.dataset.raceId !== c.race.id) {
    wrap = buildBroadcastShell(c);
    const app = beginScreen();
    app.appendChild(wrap);
  }
  updateBroadcastFrame(wrap, c);
}

function buildBroadcastShell(c) {
  const wrap = el("div", "broadcast-wrap");
  wrap.id = "broadcast-wrap";
  wrap.dataset.raceId = c.race.id;
  wrap.innerHTML = `
    <div id="bc-header" class="broadcast-header"></div>
    <div id="bc-scene" class="broadcast-scene"></div>
    <div id="bc-rankbar" class="broadcast-rank-bar"></div>
    <div id="bc-bet" class="broadcast-bet" style="display:none"></div>
    <div id="bc-mimi" class="broadcast-mimi">
      <div class="avatar"></div><div class="lines" id="mimi-lines"></div>
    </div>
    <div id="bc-controls" class="broadcast-controls"></div>
    <div id="bc-log" class="broadcast-log" style="display:none"></div>
  `;
  // Layered parallax backdrop (a night dragon-racing stadium). Sits behind the
  // dragons; common to the horizontal camera modes, faded out for the vertical
  // perspective cameras (which paint their own receding road). Pure CSS in
  // style.css under `.scene-bg`.
  const scene = wrap.querySelector("#bc-scene");
  scene.innerHTML = `
    <div class="scene-bg" aria-hidden="true">
      <div class="sky"></div>
      <div class="ridge"></div>
      <div class="moon"></div>
      <div class="tower"></div>
      <div class="skyline"></div>
      <div class="crowd"></div>
      <div class="rail"></div>
      <div class="track"></div>
      <div class="vignette"></div>
    </div>`;
  // Pre-create persistent dragon nodes for all 8 entries so transitions can
  // animate the same DOM elements through every phase change.
  c.raceResult.entries.forEach(entry => {
    const node = buildPixelDragon(entry, c.broadcast.phases[0], c.bet, -30, 30);
    node.dataset.id = entry.dragon.id;
    node.style.opacity = "0";  // start hidden, frame update will reveal
    scene.appendChild(node);
  });
  return wrap;
}

function updateBroadcastFrame(wrap, c) {
  const bs = c.broadcastState;
  const phase = c.broadcast.phases[bs.phaseIdx];
  const phaseQueue = c.commentary[bs.phaseIdx];
  const shownLines = phaseQueue.lines.slice(0, bs.lineIdx + 1);

  // --- Header ---
  wrap.querySelector("#bc-header").innerHTML = `
    <div>
      <div class="phase-label">[${phase.label}] ${phase.sectionName}</div>
      <div>${raceFullName(c.race)}</div>
    </div>
    <div>
      <span class="weather-chip">${WEATHERS[c.race.weather].label}</span>
      <span> 残り ${phase.distanceRemaining}m</span>
    </div>`;

  // --- Scene: update persistent dragons ---
  updateBroadcastScene(wrap.querySelector("#bc-scene"), phase, c.bet);

  // --- Ranking bar ---
  const rankBar = wrap.querySelector("#bc-rankbar");
  rankBar.innerHTML = "";
  phase.orderedEntries.forEach((e, i) => {
    const id = e.dragon.id;
    const popRank = c.oddsResult.oddsData.find(o => o.dragonId === id).popularityRank;
    const isTarget = c.bet && c.bet.selections.includes(id);
    const cls = isTarget ? "target" : (popRank === 1 ? "fav" : "");
    rankBar.appendChild(el("span", `rank-pos ${cls}`,
      `${i + 1}: ${commentaryName(id)}`));
  });

  // --- Bet status ---
  const betEl = wrap.querySelector("#bc-bet");
  if (c.bet && c.bet.selections.length) {
    betEl.style.display = "";
    betEl.textContent = `🎯 ${phase.bettingStatus.summary}`;
  } else {
    betEl.style.display = "none";
  }

  // --- Mimi commentary (§28 §5.1 telop: latest line large, a couple fading
  // prior lines — never a tall growing stack; full text lives in 全ログ). ---
  const linesEl = wrap.querySelector("#mimi-lines");
  linesEl.innerHTML = "";
  const recent = shownLines.slice(-3);
  recent.forEach((line, i) => {
    const isLatest = i === recent.length - 1;
    const d = document.createElement("div");
    d.className = isLatest ? "line is-latest" : "line-prev";
    d.textContent = line;
    linesEl.appendChild(d);
  });
  linesEl.scrollTop = linesEl.scrollHeight;

  // --- Controls ---
  // Watch-mode: the race auto-plays start→finish so the player just watches
  // the dragons (§27 — no pause). Only speed / skip / log conveniences remain.
  const controls = wrap.querySelector("#bc-controls");
  controls.innerHTML = "";
  const atEnd = bs.phaseIdx === c.broadcast.phases.length - 1
      && bs.lineIdx >= c.commentary[bs.phaseIdx].lines.length - 1;
  if (!atEnd) {
    const speedBtn = makeBtn(`速度 ${bs.speed}×`, cycleSpeed, { secondary: bs.speed === 1 });
    if (bs.speed > 1) speedBtn.classList.add("speed-active");
    controls.appendChild(speedBtn);
    controls.appendChild(makeBtn("⏭ スキップ", skipToResult, { secondary: true }));
  }
  controls.appendChild(makeBtn("📜 全ログ", toggleLog, { secondary: true }));
  if (atEnd) {
    controls.appendChild(makeBtn("結果を見る", renderResult));
  }

  // --- Log panel ---
  const logEl = wrap.querySelector("#bc-log");
  if (bs.showLog) {
    logEl.style.display = "";
    logEl.innerHTML = "";
    c.broadcast.phases.forEach((p, i) => {
      logEl.appendChild(el("div", "log-phase", `【${p.label} ${p.sectionName}】`));
      c.commentary[i].lines.forEach(line => logEl.appendChild(el("div", "log-line", line)));
    });
  } else {
    logEl.style.display = "none";
  }
}

/**
 * Update dragon positions in-place so CSS transitions animate the change.
 * Focus entries get on-screen layout slots; non-focus dragons drift to the
 * left edge with low opacity (still mounted, so re-entry animates back).
 */
function updateBroadcastScene(scene, phase, bet) {
  scene.setAttribute("data-mode", phase.visualMode);

  const focusEntries = phase.focusDragonIds
    .map(id => phase.orderedEntries.find(e => e.dragon.id === id))
    .filter(Boolean)
    .sort((a, b) => phase.currRankMap[a.dragon.id] - phase.currRankMap[b.dragon.id]);
  const N = focusEntries.length;
  const layout = phaseLayoutFor(phase.id, N, phase.visualMode);
  const focusSlot = {};
  focusEntries.forEach((entry, i) => {
    focusSlot[entry.dragon.id] = { left: layout.left(i), bottom: layout.bottom(i) };
  });

  // Update every persistent dragon node.
  scene.querySelectorAll(".pixel-dragon").forEach(node => {
    const id = node.dataset.id;
    const entry = phase.orderedEntries.find(e => e.dragon.id === id);
    if (!entry) return;
    const rank = phase.currRankMap[id];
    // Position
    if (focusSlot[id]) {
      node.style.left = focusSlot[id].left + "%";
      node.style.bottom = focusSlot[id].bottom + "px";
      node.style.opacity = "1";
      node.style.zIndex = String(20 - rank);
    } else {
      // Drift off to the left edge while still mounted
      node.style.left = "-18%";
      node.style.bottom = "30px";
      node.style.opacity = "0.0";
    }
    // Rank tag
    const tag = node.querySelector(".rank-tag");
    if (tag) {
      tag.textContent = rank;
      tag.className = `rank-tag r${rank}`;
    }
    // Class flags
    node.classList.toggle("collapsed", !!entry.collapse);
    node.classList.toggle("bet-target", !!(bet && bet.selections.includes(id)));
    // Sprite pose follows camera mode + race state (face us / show backs /
    // exhausted / final-sprint lean / default run).
    node.dataset.pose = poseFor(phase.visualMode, rank, entry, phase.id);
    // Rank class controls bob speed & z-index in CSS
    node.classList.forEach(cn => { if (/^rank-\d+$/.test(cn)) node.classList.remove(cn); });
    node.classList.add(`rank-${rank}`);
  });
}

// §27 §8.2 layout per phase + visual mode (positioning rules independent of CSS camera).
function phaseLayoutFor(phaseId, N, visualMode) {
  // 後方視点: 縦並びでleaderが奥(上)、follower手前(下)。
  if (visualMode === "back_camera") {
    return {
      left:   i => 50 + (i % 2 === 0 ? -8 : 8) - (i * 1),
      bottom: i => 30 + i * 28      // leader top, follower bottom
    };
  }
  // 前方視点: leaderが手前(下大きく)、follower奥(上小さく)。
  if (visualMode === "front_camera") {
    return {
      left:   i => 50 + (i % 2 === 0 ? 6 : -6) + (i * 1),
      bottom: i => 18 + i * 22      // leader bottom, followers receding up
    };
  }
  if (phaseId === "development") {
    return {
      left: i => 80 - (N > 1 ? i * 40 / (N - 1) : 0),
      bottom: i => 32 + (i % 2) * 18 + (i >= 2 ? 4 : 0)
    };
  }
  if (phaseId === "late") {
    // leader anchored at 80% (not 90) so the rank-1/bet-target's glow + 🎯
    // reticle never clip the right edge (sprite box is 56px ≈ 7.5%).
    return {
      left: i => 80 - (N > 1 ? i * 60 / (N - 1) : 0),
      bottom: i => 28 + (i % 2) * 30 + i * 4
    };
  }
  if (phaseId === "finish") {
    return {
      left: i => 78 - (N > 1 ? i * 48 / (N - 1) : 0),
      bottom: i => 30 + (i % 2) * 22 + (i >= 2 ? 6 : 0)
    };
  }
  return {
    left: i => 80 - (N > 1 ? i * 60 / (N - 1) : 0),
    bottom: i => 30 + (i % 2) * 22 + (i >= 2 ? 6 : 0)
  };
}

/**
 * §27: which sprite pose to show. Driven by camera mode + race state so the
 * dragon's body language matches what's happening:
 *   tired  — stamina-collapsed (へばっている), any camera
 *   back   — back_camera (pack breaking away up-track, we see their backs)
 *   front  — front_camera (charging toward the lens, cute faces to viewer)
 *   goal   — leader in the closing stages (ゴール直前, leaning, mouth open)
 *   side   — default right-facing run
 */
function poseFor(visualMode, rank, entry, phaseId) {
  if (entry.collapse) return "tired";
  if (visualMode === "back_camera") return "back";
  if (visualMode === "front_camera") return "front";
  if ((phaseId === "finish" || phaseId === "late") && rank === 1) return "goal";
  return "side";
}

function buildPixelDragon(entry, phase, bet, leftPct, bottomPx) {
  const d = entry.dragon;
  const rank = phase.currRankMap[d.id];
  const color = dragonColor(d);
  const wrap = el("div", "pixel-dragon");
  wrap.dataset.style = d.style;
  wrap.dataset.pose = poseFor(phase.visualMode, rank, entry, phase.id);
  wrap.classList.add(`rank-${rank}`);
  if (bet && bet.selections.includes(d.id)) wrap.classList.add("bet-target");
  if (entry.collapse) wrap.classList.add("collapsed");
  wrap.style.left = leftPct + "%";
  wrap.style.bottom = bottomPx + "px";
  // One cohesive sprite. Every part for every pose is present; CSS shows/hides
  // and re-poses them per [data-pose] / [data-style] so we never rebuild DOM.
  wrap.innerHTML = `
    <span class="rank-tag r${rank}">${rank}</span>
    <div class="shadow"></div>
    <div class="sprite" style="--c:${color}">
      <div class="tail"></div>
      <div class="wing far"></div>
      <div class="wing near"></div>
      <div class="torso"></div>
      <div class="belly"></div>
      <div class="spine"></div>
      <div class="legs"></div>
      <div class="horn l"></div>
      <div class="horn r"></div>
      <div class="brow"></div>
      <div class="eye l"></div>
      <div class="eye r"></div>
      <div class="cheek l"></div>
      <div class="cheek r"></div>
      <div class="mouth"></div>
      <div class="sweat"></div>
    </div>
    <span class="name-tag">${d.name.replace(/^.+竜/, "")}</span>
  `;
  return wrap;
}

function makeBtn(label, onClick, opts) {
  const b = el("button", opts && opts.secondary ? "secondary" : "", label);
  b.onclick = onClick;
  return b;
}

// ---- Playback control ----

function stepLineOrPhase() {
  const c = state.current;
  const bs = c.broadcastState;
  const phaseCommentary = c.commentary[bs.phaseIdx];
  if (bs.lineIdx < phaseCommentary.lines.length - 1) {
    bs.lineIdx += Math.max(1, Math.floor(bs.speed));  // larger steps at higher speed
    bs.lineIdx = Math.min(bs.lineIdx, phaseCommentary.lines.length - 1);
  } else if (bs.phaseIdx < c.broadcast.phases.length - 1) {
    bs.phaseIdx += 1;
    bs.lineIdx = 0;
  } else {
    // End of broadcast — auto-stop
    if (bs.autoMode) toggleAuto();
  }
  renderBroadcastScreen();
}

function stepPhase(delta) {
  const c = state.current;
  const bs = c.broadcastState;
  const next = bs.phaseIdx + delta;
  if (next < 0 || next >= c.broadcast.phases.length) return;
  bs.phaseIdx = next;
  bs.lineIdx = 0;
  renderBroadcastScreen();
}

function toggleAuto() {
  const bs = state.current.broadcastState;
  bs.autoMode = !bs.autoMode;
  startAutoTimer();
  renderBroadcastScreen();
}

function cycleSpeed() {
  const bs = state.current.broadcastState;
  bs.speed = bs.speed === 1 ? 2 : bs.speed === 2 ? 3 : 1;
  startAutoTimer();
  renderBroadcastScreen();
}

function skipToResult() {
  const bs = state.current.broadcastState;
  stopAutoTimer();
  bs.autoMode = false;
  renderResult();
}

function toggleLog() {
  const bs = state.current.broadcastState;
  bs.showLog = !bs.showLog;
  renderBroadcastScreen();
}

function staminaBar(e) {
  const ratio = clamp(e.staminaRatio, 0, 1);
  return `<span class="stamina-bar"><div style="width:${(ratio*100).toFixed(0)}%"></div></span>`;
}

function debugDumpRace(rr) {
  return rr.entries.map(e =>
    `${e.rank}. ${e.dragon.name} | fp=${e.finalPower.toFixed(1)} bp=${e.basePower.toFixed(1)} cp=${e.coursePower.total.toFixed(1)} wp=${e.weatherPower.toFixed(1)} fmp=${e.formPower.toFixed(1)} pp=${e.pacePower.toFixed(1)} pos=${e.positionPower.toFixed(1)} rnd=${e.randomPower.toFixed(1)} stAdj=${e.staminaAdjustment.toFixed(1)} stRem=${e.staminaRemaining.toFixed(1)}`
  ).join("\n") + `\nPace: ${rr.pace.type} (idx=${rr.pace.index.toFixed(1)})`;
}

// =========================================================================
// Spec #29 — post-race recap / 答え合わせ screen (tabbed).
// Tabs: 結果 / 払い戻し / 勝負所 / 分析 / 次のヒント / 実況ログ (§29 §9.1)
// First view shows 着順 + 的中/不的中 + 払い戻し + 短い勝負所 (§29 §9.2).
// The recap NEVER changes the race result or payout (§29 §12).
// =========================================================================
const RECAP_TABS = [
  { id: "result",  label: "結果" },
  { id: "payout",  label: "払い戻し" },
  { id: "highlights", label: "勝負所" },
  { id: "analysis", label: "分析" },
  { id: "hints",   label: "次のヒント" },
  { id: "log",     label: "実況ログ" }
];

function renderResult() {
  state.ui.screen = "result";
  const c = state.current;
  // Settle the wallet + progression now that the race is over — once per race
  // (c.settled guard), before the bankruptcy/reaction hooks that read coins.
  settleRace();
  // Stop any running broadcast auto-timer when leaving the race screen.
  stopAutoTimer();

  // Build the recap once per race (reuses analysis; never mutates result/payout).
  if (!c.recap) {
    c.recap = buildRecap({
      race: c.race, raceResult: c.raceResult, oddsResult: c.oddsResult,
      bet: c.bet, betResult: c.betResult, broadcastData: c.broadcast,
      commentary: c.commentary
    });
  }
  if (!c.recapTab) c.recapTab = "result";

  // Mimi/Sake reaction after race result + bankruptcy — fire exactly once.
  if (!c.resultHooksRan) {
    const r = c.betResult;
    const winnerOd = c.oddsResult.oddsData.find(o => o.dragonId === c.raceResult.entries[0].dragon.id);
    runEventHooks("afterRaceResult", { race: c.race, hit: r.hit, popularityRank: winnerOd.popularityRank, bigLoss: !r.hit && r.wager >= 500 });
    if (state.player.coins <= 0) runEventHooks("onBankruptcy", { race: c.race });
    c.resultHooksRan = true;
  }

  // 🛍️ モール解放イベント（初的中・一度きり）：サケが使い方を解説→『ジャングルバニー』を贈与→
  // ミミがその場で着替えて happy 立ち絵で登場（2段構成）。表示メタのみ・コイン非消費。
  if (c.firstHitEver && !(state.player.flags || {}).mallIntroSeen && !c._mallIntroPlayed && window.Dialogue) {
    c._mallIntroPlayed = true;
    setTimeout(() => {
      Dialogue.play([
        ["sake", "初勝利、見事だったぞ。……ところでミミ、いつまでそのボロを着てるつもりだ？"],
        ["mimi", "え、ボロって……こ、これしか持ってないんですっ！", "panic"],
        ["sake", "島の連中は験を担ぐ。装いは「今日の自分は勝てる」って気配を作る道具だ。──ホームに🛍️モールを開けておいた。稼いだコインで好きに選べ。試着は自由、着替えは無料だ。"],
        ["sake", "それと、初勝利の祝いだ。『ジャングルバニー』──葉っぱと馬券で武装した、お前の勝負服第一号だ。受け取れ。", "happy"]
      ]).then(() => {
        try {
          state.player.flags.mallIntroSeen = true;
          if (!state.player.outfitsWon) state.player.outfitsWon = [];
          if (state.player.outfitsWon.indexOf("jungle") < 0 && !outfitOwned(outfitById("jungle"))) state.player.outfitsWon.push("jungle");
          if (typeof wearOutfit === "function") wearOutfit("jungle"); else state.player.outfit = "jungle";
          if (typeof saveGame === "function") saveGame();
          try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
          // 着替え後の立ち絵（現在衣装=jungle）で登場
          Dialogue.play([["mimi", "わぁ……！ ありがとうございます、サケさんっ！ ──じゃーん！ どう、ですか？ 似合います……？", "happy"]]);
        } catch (e) {}
      });
    }, 600);
  }

  // 🐲 泣き虫竜ポロ 発見イベント：序盤の「2勝目（単勝）」で出会う（第4章開放=総資産100万より前。
  // ポロは第3・4章の一枚絵に既に登場するため、それより前に加入させる）。完了で龍舎/スカウト解放。
  // js/poro.js。既存のレース出走ポロ・オッズ・配当・図鑑は一切不変＝表示専用メタ。
  if (!c._poroArcTried && typeof maybePlayPoroArcOnWin === "function" && typeof poroFound === "function" && !poroFound()) {
    c._poroArcTried = true;
    setTimeout(() => { try { maybePlayPoroArcOnWin(); } catch (e) {} }, 700);
  }

  drawRecapScreen();
}

function showRecapTab(id) {
  state.current.recapTab = id;
  drawRecapScreen();
}

function drawRecapScreen() {
  const c = state.current;
  const recap = c.recap;
  const app = beginScreen();
  app.appendChild(el("h2", null, "答え合わせ"));

  // --- Reward hero: lead with the emotional verdict (spec #37 Tier 1) ---
  const ps = recap.payoutSummary;
  if (ps) {
    app.appendChild(buildResultHero(ps, resultTierOf(ps), c));
  }
  // 📦 今回の獲得（リワード台帳）：配当以外も含め「このレースで何が増えたか」を1枚に明示。
  // ボーナス系バナーもここに統合（桜井流「ごほうびは分かりやすく・まとめて見せる」）。
  try {
    const g = c.gainLedger;
    if (g) {
      const rows = [];
      const R = (ic, label, val, cls) => rows.push(`<div class="rs-lg-row ${cls || ""}"><span class="ic">${ic}</span><span class="lb">${label}</span><b>${val}</b></div>`);
      if (g.hit) R("💰", "配当", "＋" + fmtCoins(g.payout), "gain");
      else R("💸", "賭金", "−" + fmtCoins(g.wager), "loss");
      if (g.streakBonus > 0) R("🔥", "連勝ボーナス", "＋" + fmtCoins(g.streakBonus), "gain");
      if (g.featuredBonus > 0) R("★", "注目レース達成", "＋" + fmtCoins(g.featuredBonus), "gain");
      g.collectionLabels.forEach((lb, i) => R("📖", lb, "＋" + fmtCoins(c.collectionAwards[i].reward), "gain"));
      if (g.assetsDelta > 0) R("🏦", "総資産（最高記録更新）", "＋" + fmtCoins(g.assetsDelta), "asset");
      if (g.lifePDelta > 0) R("🌱", "暮らしP（くらしツリーで使える）", "＋" + g.lifePDelta, "asset");
      if (g.rankUp) R("🏅", "ランク昇格！", "ランク" + g.rankUp, "rankup");
      g.storyUnlocked.forEach(t => R("📜", "物語が解放", t, "rankup"));
      if (g.mission) R("📋", "デイリーミッション「出走」", "達成！", "asset");
      const box = el("div", "rs-ledger");
      box.innerHTML = `<div class="rs-lg-t">📦 今回の獲得</div>` + rows.join("");
      app.appendChild(box);
    } else {
      if (c.featuredBonus) app.appendChild(el("div", "rs-bonus", `★ 注目レース達成ボーナス　<b>＋${fmtCoins(c.featuredBonus)}</b>`));
      (c.collectionAwards || []).forEach(a => app.appendChild(el("div", "rs-bonus rs-bonus-dex", `📖 ${a.label} 達成！　<b>＋${fmtCoins(a.reward)}</b>`)));
    }
  } catch (e) {}
  // living advisor reaction — a character speaks to what just happened (spec #37)
  try {
    const ar = (typeof pickAdvisorReaction === "function") ? pickAdvisorReaction(ps, c) : null;
    if (ar && ar.cast) {
      const card = el("div", "rs-advisor");
      card.style.setProperty("--ac", ar.cast.color || "#2ea884");
      card.innerHTML =
        `<div class="rs-adv-face">${ar.cast.symbol || "🐲"}</div>` +
        `<div class="rs-adv-tx"><div class="rs-adv-name">${ar.cast.name}<span>${ar.cast.tag || ""}</span></div>` +
        `<div class="rs-adv-line">${ar.line}</div></div>`;
      app.appendChild(card);
    }
  } catch (e) {}
  // next-goal nudge (north star) — keep a target in view after every race
  try {
    const goals = (typeof nextGoals === "function") ? nextGoals(state) : [];
    if (goals.length) {
      const g = goals[0];
      app.appendChild(el("div", "rs-nextgoal", `🎯 次の目標：${g.icon} ${g.label} — <b>${g.sub}</b>`));
    }
  } catch (e) {}

  // --- Tab bar ---
  const bar = el("div", "recap-tabs");
  RECAP_TABS.forEach(t => {
    const b = el("button", "recap-tab" + (c.recapTab === t.id ? " active" : ""), t.label);
    b.onclick = () => showRecapTab(t.id);
    bar.appendChild(b);
  });
  app.appendChild(bar);

  // --- Tab body ---
  const body = el("div", "recap-body");
  ({
    result: recapTabResult,
    payout: recapTabPayout,
    highlights: recapTabHighlights,
    analysis: recapTabAnalysis,
    hints: recapTabHints,
    log: recapTabLog
  }[c.recapTab] || recapTabResult)(body, recap, c);
  app.appendChild(body);

  // --- Persistent actions（導線：ホーム／詳しい分析＝副、次のレース＝主CTA） ---
  const actions = el("div", "actions");
  const home2 = el("button", "secondary", "ホーム"); home2.onclick = renderHome;
  actions.appendChild(home2);
  const detail = el("button", "secondary", "詳しい分析"); detail.onclick = renderAnalysis;
  actions.appendChild(detail);
  const next = el("button", null, "次のレースへ ▶"); next.onclick = renderRaceSelect;
  actions.appendChild(next);
  app.appendChild(actions);
}

// =========================================================================
// Spec #37 Tier 1 — the WIN MOMENT. The race result/odds/payout are NEVER
// changed here; this is pure presentation that makes the payout reveal land.
// =========================================================================

// Win tier from the payout odds — the thrill scales with the 穴 you cracked.
function resultTierOf(ps) {
  if (!ps || !ps.hit) return 0;            // miss
  const o = ps.odds || 1;
  if (o >= 15) return 4;                    // 伝説の的中
  if (o >= 7)  return 3;                    // 超的中
  if (o >= 3)  return 2;                    // 大的中
  return 1;                                 // 的中
}

const RESULT_TIER = {
  0: { word: "ハズレ",           cls: "miss", sfx: "miss" },
  1: { word: "的中！",           cls: "t1",   sfx: "win" },
  2: { word: "大的中！",         cls: "t2",   sfx: "bigwin" },
  3: { word: "超的中！！",       cls: "t3",   sfx: "legendary" },
  4: { word: "伝説の的中！！！", cls: "t4",   sfx: "legendary" }
};

// §37 Tier 2 — milestone streak bonus, as a multiple of the race's payout (so
// it scales with the bet size / rank). Paid only when the streak hits a key.
const STREAK_BONUS_FACTOR = { 3: 0.3, 5: 0.7, 7: 1.2, 10: 2.0, 15: 4.0, 20: 7.0, 30: 15.0 };

function fmtSigned(n) { return (n < 0 ? "−" : "+") + fmtCoins(Math.abs(n)); }

// Build the streak line shown in the reward hero (and reused on home).
function streakLineHtml(si) {
  if (!si) return "";
  if (si.bonus > 0) return `🔥 <b>${si.streak}連勝！</b> 連勝ボーナス <b>＋${fmtCoins(si.bonus)}</b>`;
  if (si.streak >= 2) return `🔥 <b>${si.streak}連勝中</b>　最高 ${si.best}`;
  if (si.broke) return `連勝ストップ… （${si.prev}連勝でした）`;
  return "";
}

// §37 — surface the nearest unlocks so there's always a concrete target
// (bridges the geometric dead zones between life-stage thresholds).
function nextGoals(state) {
  const p = state.player, goals = [];
  const coins = p.coins, total = p.totalAssets || 0;
  // rank up
  const nr = p.rank + 1;
  if (typeof RANK_UNLOCK !== "undefined" && RANK_UNLOCK[nr]) {
    const u = RANK_UNLOCK[nr];
    const racesDone = (p.completedByRank && p.completedByRank[p.rank]) || 0;
    const byRaces = Math.max(0, u.completedAtLowerRank - racesDone);
    const byCoins = Math.max(0, u.coins - coins);
    const rl = (RANKS[nr] && RANKS[nr].label) || "";
    if (byRaces === 0 || byCoins === 0) {
      goals.push({ kind: "rank", icon: "🏅", label: `ランク${nr} ${rl}`, sub: "次のレースで解放！", pct: 100 });
    } else {
      goals.push({ kind: "rank", icon: "🏅", label: `ランク${nr} ${rl}`, sub: `あと ${byRaces}戦 または ${fmtCoins(byCoins)}コイン`, pct: clamp(coins / u.coins * 100, 2, 99) });
    }
  }
  // next life stage (総資産)
  const nextT = (typeof nextAssetThreshold === "function") ? nextAssetThreshold(total) : null;
  if (nextT && nextT > total) {
    goals.push({ kind: "stage", icon: "🏠", label: "暮らしの段階アップ", sub: `総資産 あと ${fmtCoins(nextT - total)}`, pct: clamp(total / nextT * 100, 2, 99) });
  }
  // next story chapter
  if (typeof STORY_CHAPTERS !== "undefined" && typeof storyUnlockAt === "function") {
    let best = null, bestAt = Infinity;
    STORY_CHAPTERS.forEach(ch => { const at = storyUnlockAt(ch.id); if (at > total && at < bestAt) { bestAt = at; best = ch; } });
    if (best) goals.push({ kind: "story", icon: "📖", label: best.title || ("物語 " + best.id), sub: `総資産 あと ${fmtCoins(bestAt - total)}`, pct: clamp(total / bestAt * 100, 2, 99) });
  }
  return goals;
}

// §37 — living advisor reactions. The 5 advisors unlock with 総資産 (sake from
// the start, the rest later), and each owns a domain; on the result screen the
// one whose domain best fits what just happened speaks, with a varied line so it
// never feels canned. sake closes every situation list, so the early game always
// has a voice and the chorus fills in as advisors are met. "{n}" → streak count.
const ADVISOR_LINES = {
  legendary: [
    { key: "mizu", lines: [
      "市場のズレ、完璧に突いたわね。これが期待値の勝ちよ、あはん。",
      "誰も見ていない価値を、あなたは見た。お見事であるわ。",
      "人気と実力の差――そこにしかお金は落ちていないの。よく拾ったわね。" ] },
    { key: "celestia", lines: [
      "世界の天井から見ても、見事な一撃。価値の残る賭けだったわね。",
      "市場の歪みを射抜いた。これが神眼に届く予想よ。" ] },
    { key: "sake", lines: [
      "気配だけで選んだな。数字じゃ説明できねぇ、いい目だ。" ] }
  ],
  bigwin: [
    { key: "sumika", lines: [
      "大きいですね。住居も食事も、これで一段と潤います。",
      "総資産がぐっと伸びました。再起の土台が固まりますね。" ] },
    { key: "makura", lines: [
      "うおおお盛り上がってきたァ！今の的中、配信なら切り抜き確定だぜ！",
      "観客のボルテージ最高潮！この熱、視聴者にも伝わってるぜ！" ] },
    { key: "sake", lines: [
      "派手に獲ったな。気配を読み切った証だ。" ] }
  ],
  streak: [
    { key: "makura", lines: [
      "{n}連勝うおおお！会場のボルテージやばいぞ、止まんねぇ！",
      "{n}連勝だ！この流れ、視聴者が見逃すわけねぇ！乗ってけ！" ] },
    { key: "celestia", lines: [
      "{n}連勝――悪くないわ。波に乗っているうちは、的を絞りなさい。" ] },
    { key: "sake", lines: [
      "{n}連勝か。調子いいときほど、竜の気配をよく見ろよ。" ] }
  ],
  favorite_hit: [
    { key: "sake", lines: [
      "本命が順当に。コースの空気も味方したな。",
      "堅く取ったな。こういう積み重ねが土台になる。" ] },
    { key: "mizu", lines: [
      "順当な的中。確実に拾うのも、立派な戦略であるわ。" ] },
    { key: "sumika", lines: [
      "堅実な勝ち。こういう一戦が、暮らしを支えます。" ] }
  ],
  narrow_miss: [
    { key: "makura", lines: [
      "うわー惜しい！あの子、最後まで諦めてなかったぜ…！次だ次！",
      "あと一歩ォ！今のは悔しいが、いい勝負だった！" ] },
    { key: "sake", lines: [
      "際どかったな。展開が少し違えば獲れていた。悪い読みじゃない。" ] },
    { key: "celestia", lines: [
      "惜しい。けれど一着と二着の間には、深い谷があるの。次に活かしなさい。" ] }
  ],
  upset_loss: [
    { key: "sake", lines: [
      "荒れたな。こういう日は誰にも読み切れねぇ。引きずるな。",
      "波乱だ。気配が乱れる日もある。次のレースだ。" ] },
    { key: "celestia", lines: [
      "市場が歪んだわね。読めない波乱もある。価値を見失わないことよ。" ] },
    { key: "mizu", lines: [
      "人気が裏切られたわね。…でも長い目で見れば、期待値は嘘をつかないわ。" ] }
  ],
  miss: [
    { key: "mizu", lines: [
      "今回は外れ。でも一回の結果に意味はないの。試行を重ねれば、価値が効いてくるわ。",
      "ハズレ。大事なのは、その賭けに価値があったかどうかよ、あはん。" ] },
    { key: "sake", lines: [
      "外したか。気にするな、次の竜の気配を見ろ。" ] },
    { key: "sumika", lines: [
      "負けても大丈夫。総資産という土台がある限り、何度でも立て直せます。" ] }
  ]
};

function pickAdvisorReaction(ps, c) {
  if (!ps || typeof STORY_CAST === "undefined") return null;
  const met = k => (typeof castUnlockAt !== "function") || castUnlockAt(k) <= (state.player.totalAssets || 0);
  const tier = (typeof resultTierOf === "function") ? resultTierOf(ps) : 0;
  const streak = state.player.streak || 0;
  let winnerPopRank = 1;
  try {
    const w = c.raceResult.entries[0];
    const od = c.oddsResult.oddsData.find(o => o.dragonId === w.dragon.id);
    winnerPopRank = (od && od.popularityRank) || 1;
  } catch (e) {}
  const pickRank = (ps.selections && ps.selections[0] && ps.selections[0].rank) || 99;
  let situation;
  if (ps.hit && streak >= 3) situation = "streak";
  else if (ps.hit && tier >= 3) situation = "legendary";
  else if (ps.hit && tier === 2) situation = "bigwin";
  else if (ps.hit) situation = "favorite_hit";
  else if (pickRank <= 4) situation = "narrow_miss";
  else if (winnerPopRank >= 4) situation = "upset_loss";
  else situation = "miss";
  const cands = ADVISOR_LINES[situation] || ADVISOR_LINES.miss;
  let chosen = cands.find(cand => met(cand.key));
  if (!chosen) chosen = ADVISOR_LINES.miss.find(x => x.key === "sake");
  const cast = STORY_CAST[chosen.key];
  let line = chosen.lines[Math.floor(Math.random() * chosen.lines.length)];
  line = line.replace("{n}", streak);
  return { cast, line, situation };
}

function buildResultHero(ps, tier, c) {
  const info = RESULT_TIER[tier] || RESULT_TIER[0];
  const hit = !!ps.hit;
  const muteIc = (window.Sfx && Sfx.isMuted()) ? "🔇" : "🔊";
  const hero = el("div", "rs-hero rs-" + info.cls);
  hero.innerHTML =
    `<button class="rs-mute" title="サウンド切替">${muteIc}</button>` +
    `<div class="rs-confetti" aria-hidden="true"></div>` +
    `<div class="rs-stamp">${info.word}</div>` +
    (hit
      ? `<div class="rs-payout"><span class="rs-plus">+</span><span class="rs-count" id="rs-count">0</span><span class="rs-unit">コイン</span></div>`
      : `<div class="rs-payout rs-payout-miss">−${fmtCoins(Math.abs(ps.profit))}<span class="rs-unit"> コイン</span></div>`) +
    `<div class="rs-sub">` +
      (hit
        ? `${ps.typeLabel} × ${ps.odds.toFixed(1)}倍　／　収支 <b>${fmtSigned(ps.profit)}</b>`
        : `${ps.typeLabel}　／　今回は届かず`) +
      `　・　所持 <b>${fmtCoins(state.player.coins)}</b></div>` +
    `<div class="rs-streak" id="rs-streak">${streakLineHtml(c && c.streakInfo)}</div>`;

  const mb = hero.querySelector(".rs-mute");
  if (mb) mb.onclick = (e) => {
    e.stopPropagation();
    if (window.Sfx) {
      Sfx.setMuted(!Sfx.isMuted());
      if (window.RaceBgm) RaceBgm.setMuted(Sfx.isMuted());
      mb.textContent = Sfx.isMuted() ? "🔇" : "🔊";
      if (!Sfx.isMuted()) Sfx.play("click");
    }
  };

  // Celebrate exactly once per race; on later re-renders (tab switches) just
  // show the final number statically.
  if (!c.celebrated) {
    c.celebrated = true;
    // Wait until any Mimi/event popup is dismissed so the confetti + count-up
    // are actually seen (otherwise they'd play hidden under the overlay).
    whenResultVisible(() => celebrateResult(hero, ps, tier, info));
  } else if (hit) {
    const cnt = hero.querySelector("#rs-count");
    if (cnt) cnt.textContent = fmtCoins(ps.payout);
  }
  return hero;
}

// Run cb once the result screen is actually visible — i.e. the modal event
// overlay (Mimi reaction / story / rank-up popups) has been dismissed.
function whenResultVisible(cb) {
  const hidden = () => {
    const ov = document.getElementById("event-overlay");
    return !ov || ov.classList.contains("hidden");
  };
  if (hidden()) { requestAnimationFrame(cb); return; }
  let tries = 0;
  const iv = setInterval(() => {
    if (hidden() || ++tries > 600) { clearInterval(iv); requestAnimationFrame(cb); }
  }, 90);
}

function celebrateResult(hero, ps, tier, info) {
  if (!hero || !document.body.contains(hero)) return;
  const si = state.current && state.current.streakInfo;
  try { if (window.Sfx) Sfx.play(ps.hit ? info.sfx : "miss"); } catch (e) {}
  const stamp = hero.querySelector(".rs-stamp");
  if (stamp) stamp.classList.add("rs-stamp-go");
  if (!ps.hit) return;
  const cnt = hero.querySelector("#rs-count");
  if (cnt) countUp(cnt, ps.payout, 900 + tier * 220);
  const conf = hero.querySelector(".rs-confetti");
  let n = [0, 18, 32, 50, 72][tier] || 18;
  if (si && si.streak >= 3) n += Math.min(si.streak, 12) * 4;   // hotter streaks rain more
  if (conf) spawnConfetti(conf, n, tier);
  // streak milestone bonus → a second confetti burst + a reward chime
  if (si && si.bonus > 0) {
    try { if (window.Sfx) setTimeout(() => Sfx.play("unlock"), 520); } catch (e) {}
    if (conf) setTimeout(() => spawnConfetti(conf, 24, Math.max(tier, 3)), 480);
  }
  if (tier >= 3 || (si && si.streak >= 5)) {
    hero.classList.remove("rs-shake"); void hero.offsetWidth; hero.classList.add("rs-shake");
    setTimeout(() => hero.classList.remove("rs-shake"), 700);
  }
}

// Number count-up through fmtCoins (easeOutCubic), with soft ticks.
function countUp(node, to, dur) {
  if (!node) return;
  to = Math.max(0, Math.round(to));
  const start = performance.now();
  let lastTick = 0;
  (function frame(now) {
    if (!document.body.contains(node)) return;
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = fmtCoins(Math.round(to * eased));
    if (window.Sfx && p < 1 && now - lastTick > 110) { lastTick = now; Sfx.play("tick"); }   // 高額時の連打音を抑制
    if (p < 1) requestAnimationFrame(frame);
    else node.textContent = fmtCoins(to);
  })(start);
}

// Lightweight DOM confetti — no assets, colours from the world palette.
const RS_CONFETTI_COLORS = ["#ffd877", "#e6b24a", "#49c89c", "#2ea884", "#ff6f4d", "#57b1dd", "#f3ecdc"];
function spawnConfetti(container, n, tier) {
  if (!container) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "rs-confetto";
    const left = Math.random() * 100;
    const dur = 1.0 + tier * 0.28 + Math.random() * 1.0;   // 大当たりほど長く舞う
    const delay = Math.random() * 0.5;
    const size = 5 + Math.random() * (tier >= 3 ? 8 : 5);
    const rot = (Math.random() * 720 - 360) | 0;
    const drift = (Math.random() * 60 - 30) | 0;
    p.style.cssText =
      `left:${left}%;width:${size.toFixed(1)}px;height:${(size * (0.5 + Math.random())).toFixed(1)}px;` +
      `background:${RS_CONFETTI_COLORS[(Math.random() * RS_CONFETTI_COLORS.length) | 0]};` +
      `animation-duration:${dur.toFixed(2)}s;animation-delay:${delay.toFixed(2)}s;` +
      `--rs-rot:${rot}deg;--rs-drift:${drift}px;`;
    frag.appendChild(p);
  }
  container.appendChild(frag);
  setTimeout(() => { if (container) container.innerHTML = ""; }, 2800);
}

// §37 — daily login reward modal (shown once per session on home if a new day).
function showLoginBonus(info) {
  if (!info) return;
  const ov = el("div", "login-ov");
  const strip = [1, 2, 3, 4, 5, 6, 7].map(d => {
    const cls = d < info.cycleDay ? "done" : (d === info.cycleDay ? "now" : "");
    return `<div class="lb-day ${cls}">${d === 7 ? "★" : d}</div>`;
  }).join("");
  ov.innerHTML =
    `<div class="login-card">` +
      `<div class="lb-title">✦ ログインボーナス ✦</div>` +
      `<div class="lb-streak">${info.streak}日連続ログイン</div>` +
      `<div class="lb-strip">${strip}</div>` +
      `<div class="lb-amount">＋<b id="lb-count">0</b> コイン</div>` +
      `<button class="lb-claim">受け取る</button>` +
    `</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => {
    try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
    const cnt = ov.querySelector("#lb-count");
    if (cnt) { if (typeof countUp === "function") countUp(cnt, info.bonus, 800); else cnt.textContent = fmtCoins(info.bonus); }
  });
  ov.querySelector(".lb-claim").onclick = () => {
    if (typeof claimDailyLogin === "function") claimDailyLogin(info);
    ov.remove();
    if (state.ui.screen === "home") renderHome();
  };
}

function recapSection(label, lines) {
  const d = el("div", "analysis-section");
  d.appendChild(el("span", "label", label));
  (lines || []).forEach(t => { if (t) d.appendChild(el("div", null, t)); });
  return d;
}

// §29 §9.2 first view: 着順(全8) + 的中/不的中 + 払い戻し + 短い勝負所.
function recapTabResult(body, recap, c) {
  const tbl = el("table", "ranking-table");
  tbl.innerHTML =
    `<tr><th>着</th><th>竜</th><th>人気</th><th>オッズ</th><th>脚質</th><th>短評</th></tr>` +
    recap.resultSummary.map(e => {
      const cls = e.rank <= 3 ? ` class="top${e.rank}"` : "";
      const star = e.isBetTarget ? " ★" : "";
      const od = (e.odds != null) ? e.odds.toFixed(1) : "—";
      const pop = (e.popularityRank != null) ? `${e.popularityRank}番` : "—";
      return `<tr${cls}><td>${e.rank}</td><td>${e.name}${star}</td><td>${pop}</td><td>${od}</td><td>${e.style}</td><td>${e.blurb}</td></tr>`;
    }).join("");
  body.appendChild(tbl);
  body.appendChild(el("div", "recap-note", "★ … あなたの予想竜"));

  // Short 払い戻し one-liner.
  const ps = recap.payoutSummary;
  if (ps) {
    body.appendChild(recapSection("払い戻し", [
      `${ps.typeLabel}／${ps.resultText}`,
      `賭金 ${fmtCoins(ps.wager)} × ${ps.odds.toFixed(1)} → 払戻 ${fmtCoins(ps.payout)}（収支 ${ps.profit >= 0 ? '+' : ''}${fmtCoins(ps.profit)}）`,
      `所持コイン: ${fmtCoins(state.player.coins)}`
    ]));
  }

  // Short 勝負所 — top 2 highlights.
  body.appendChild(recapSection("勝負所", recap.broadcastHighlights.slice(0, 2)));

  // Mimi sign-off (§29 §8).
  const mimi = el("div", "recap-mimi");
  mimi.appendChild(el("span", "speaker", "ミミ"));
  mimi.appendChild(el("span", "line", recap.mimiRecap));
  body.appendChild(mimi);
}

function recapTabPayout(body, recap, c) {
  const ps = recap.payoutSummary;
  if (!ps) { body.appendChild(el("div", null, "賭けの記録がありません。")); return; }
  body.appendChild(recapSection("賭け", [
    `賭式: ${ps.typeLabel}`,
    `選択: ${ps.selections.map(s => s.name).join(" + ")}`,
    `結果: ${ps.resultText}`,
    `${ps.hit ? '的中' : '不的中'}／賭金 ${fmtCoins(ps.wager)}／オッズ ${ps.odds.toFixed(1)}`,
    `払戻: ${fmtCoins(ps.payout)}コイン（収支 ${ps.profit >= 0 ? '+' : ''}${fmtCoins(ps.profit)}）`,
    `所持コイン: ${fmtCoins(state.player.coins)}`
  ]));
  if (recap.betReview && recap.betReview.length) {
    body.appendChild(recapSection("馬券レビュー", recap.betReview));
  }
}

function recapTabHighlights(body, recap, c) {
  body.appendChild(recapSection("実況ハイライト", recap.broadcastHighlights));
}

function recapTabAnalysis(body, recap, c) {
  body.appendChild(recapSection("勝因", recap.winnerReason));
  if (recap.loserReason && recap.loserReason.length) {
    body.appendChild(recapSection("敗因・人気馬", recap.loserReason));
  }
  body.appendChild(recapSection("人気と実力のズレ", recap.marketGap));
  body.appendChild(recapSection("ペース", recap.paceAnalysis));
  if (recap.staminaAnalysis && recap.staminaAnalysis.length) {
    body.appendChild(recapSection("スタミナ", recap.staminaAnalysis));
  }
  if (recap.courseWeatherAnalysis && recap.courseWeatherAnalysis.length) {
    body.appendChild(recapSection("コース・天候", recap.courseWeatherAnalysis));
  }
}

function recapTabHints(body, recap, c) {
  body.appendChild(recapSection("次戦へのヒント", recap.nextHints));
}

function recapTabLog(body, recap, c) {
  const log = el("div", "broadcast-log");
  (recap.commentaryLog || []).forEach(phase => {
    const label = (BROADCAST_PHASES.find(p => p.id === phase.phaseId) || {}).label || phase.phaseId;
    log.appendChild(el("div", "log-phase", label));
    (phase.lines || []).forEach(line => log.appendChild(el("div", "log-line", line)));
  });
  body.appendChild(log);
}

// Game-level share — promotes the game itself rather than a single race result.
const GAME_SHARE_URL = "";  // 公開URLが決まったらここに入れる

function buildGameShareText() {
  const lines = [
    `【聖龍爆走録ミミ】`,
    `転生したらバニーガールだった私の汎用スキル《ぱほぱほ》だけがレベルアップな件`,
    ``,
    `市場のオッズと真の実力のズレを読む、ファンタジー公営龍レース予想カジノ。`,
    `8竜・3賭式（単竜／複竜／ワイド竜）・5レース。`,
    `1番人気が強いとは限らない。読めば勝てる、読まなきゃ負ける。`,
    ``,
    `#聖龍爆走録ミミ #ぱほぱほ`
  ];
  if (GAME_SHARE_URL) lines.push("", GAME_SHARE_URL);
  return lines.join("\n");
}

async function shareGameInfo() {
  const text = buildGameShareText();
  const payload = { title: "聖龍爆走録ミミ", text };
  if (GAME_SHARE_URL) payload.url = GAME_SHARE_URL;
  if (navigator.share) {
    try {
      await navigator.share(payload);
      flashShareToast("シェアしました");
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      flashShareToast("ゲーム紹介文をコピーしました");
      return;
    } catch (e) { /* fall through */ }
  }
  showShareFallback(text, "ゲーム紹介文をコピー");
}

function flashShareToast(msg) {
  let toast = document.getElementById("share-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "share-toast";
    toast.className = "share-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function showShareFallback(text, title) {
  const overlay = document.getElementById("event-overlay");
  document.getElementById("event-speaker").textContent = title || "テキストをコピー";
  document.getElementById("event-text").innerHTML =
    `<div style="font-size:12px;color:#a0a0a0;margin-bottom:8px;">下のテキストを選んでコピーしてください。</div>` +
    `<textarea readonly style="width:100%;height:160px;background:#1a1530;color:#f0e8d0;border:1px solid #604040;border-radius:3px;padding:6px;font-size:13px;">${text.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</textarea>`;
  overlay.classList.remove("hidden");
}

function renderAnalysis() {
  state.ui.screen = "analysis";
  const c = state.current;
  const analysis = buildAnalysis(c.race, c.raceResult, c.oddsResult, c.betResult, c.broadcast);
  const app = beginScreen();
  app.appendChild(el("h2", null, "レース後分析"));
  runEventHooks("afterRaceAnalysis", { race: c.race, analysis });

  const sec = (label, lines) => {
    const d = el("div", "analysis-section");
    d.appendChild(el("span", "label", label));
    lines.forEach(t => d.appendChild(el("div", null, t)));
    return d;
  };

  const lvl = state.ui.infoLevel;
  // §07 §16 level-based analysis display.
  // simple: winner reason + pace + next hint
  // standard: + favorite failure + value notes + bet eval
  // advanced: + stamina + weather notes
  // expert: + component breakdown
  app.appendChild(sec("勝因", analysis.winnerReasons));
  app.appendChild(sec("ペース総括", [analysis.paceSummary]));
  if (lvl !== "simple") {
    app.appendChild(sec("人気馬(竜)分析", analysis.favoriteFailureReasons));
    app.appendChild(sec("妙味・人気とのズレ", analysis.valueNotes));
    if (analysis.broadcastNotes && analysis.broadcastNotes.length) {
      app.appendChild(sec("中継ハイライト", analysis.broadcastNotes));
    }
    if (analysis.betEval && analysis.betEval.length) app.appendChild(sec("今回の賭け評価", analysis.betEval));
  }
  if (lvl === "advanced" || lvl === "expert") {
    app.appendChild(sec("スタミナ", analysis.staminaNotes));
    app.appendChild(sec("天候", analysis.weatherNotes));
  }
  if (lvl === "expert") {
    const top3 = c.raceResult.entries.slice(0,3);
    const lines = top3.map(e =>
      `${e.rank}着 ${e.dragon.name}: BP=${e.basePower.toFixed(1)} CP=${e.coursePower.total.toFixed(1)} WP=${e.weatherPower.toFixed(1)} FP=${e.formPower.toFixed(1)} PaceP=${e.pacePower.toFixed(1)} PosP=${e.positionPower.toFixed(1)} Rnd=${e.randomPower.toFixed(1)} StAdj=${e.staminaAdjustment.toFixed(1)} → Final=${e.finalPower.toFixed(1)}`
    );
    app.appendChild(sec("コンポーネント内訳（エキスパート）", lines));
  }
  app.appendChild(sec("次戦へのヒント", analysis.nextHints));

  const actions = el("div", "actions");
  const next = el("button", null, "次のレースへ"); next.onclick = renderRaceSelect;
  actions.appendChild(next);
  const home = el("button", "secondary", "ホームへ"); home.onclick = renderHome;
  actions.appendChild(home);
  app.appendChild(actions);
}
