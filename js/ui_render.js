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
  story: 3, consult: 3, race_detail: 3, life_tree: 3, life_collection: 3, active_skills: 3, economy: 3, collection_score: 3, poro_gourmet: 3,
  story_read: 4, race_run: 4, result: 5, analysis: 6
};
let _prevScreen = null;
let _heroRect = null;   // rect of a tapped card, to expand from on the next screen

function beginScreen() {
  const app = $("app");
  const screen = state.ui.screen;
  const prev = _prevScreen;
  app.classList.remove("nav-fwd", "nav-back", "nav-same", "nav-racestart", "kt-page", "lr-page", "hl-clip");   // 観光(.kt-page)/暮らし(.lr-page)の明色テーマ・ホームのはみ出しクリップ(hl-clip)を他画面へ漏らさない
  if (screen !== "home") document.body.classList.remove("home-mode");   // ホーム以外は#header表示
  if (typeof syncVolumeFab === "function") syncVolumeFab();              // 🔊 全画面常設の音量ボタンを画面に合わせて表示/非表示
  var _scmBn = document.getElementById("scm-bnav-host"); if (_scmBn) _scmBn.remove();   // モールのフロート下部ナビ(body直下fixed)を毎遷移で外す（モールで再設置）
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
    poro_gourmet: "home",   // クリア後ミニゲームも迷子にしない（mall_rpgはラン中断防止のため意図的に無し＝race_runと同じ例外）
    sns: "home", konron_map: "home",   // SNSは戻る導線が無かった／観光は自前バックが画面下＝上部stickyを補う
    life_tree: "assets", life_collection: "assets", active_skills: "assets", economy: "assets", collection_score: "assets", story_read: "story",
    konron_guide: "konron_map", konron_gallery: "konron_map"
  };
  const BACK_TGT = {
    home: { l: "← ホーム", f: renderHome }, assets: { l: "← 暮らし", f: renderAssets }, story: { l: "← 物語", f: renderStory },
    konron_map: { l: "← 観光", f: (typeof renderKonronMap === "function" ? renderKonronMap : renderHome) }
  };
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
    <div class="title-photo">${typeof photoOr === "function" ? photoOr("images/title_bg.webp?v=orig1", "") : ""}</div>
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
  // ★第2話「ミズの分析」を読むと開放＝単一条件（E3解消・docs/GAME_FLOW_REDESIGN.md §1）。
  //   mallIntroSeen は「サケの衣装ギフトVNを再生済み」の印としてだけ使う（ゲート条件ではない）。
  return !!(typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_2"));
}

// 🛍️ モール開通のお祝いVN（サケが使い方を解説→『ジャングルバニー』贈与→着替えお披露目）。
// 呼び出し＝モール初訪問時（ui_mall.js）。ホームではVNを出さない鉄則があるため、
// ホーム側は cut-in（progression.js）→「今すぐ見る▸」→ここ、の順で繋ぐ。表示メタのみ・コイン非消費。
function playMallIntroVN() {
  const f = state.player.flags || (state.player.flags = {});
  if (f.mallIntroSeen || !window.Dialogue) return false;
  f.mallIntroSeen = true;
  Dialogue.play([
    ["sake", "オッズの読み方、覚えてきたな。……ところでミミ、いつまでそのボロを着てるつもりだ？"],
    ["mimi", "え、ボロって……こ、これしか持ってないんですっ！", "panic"],
    ["sake", "島の連中は験を担ぐ。装いは「今日の自分は勝てる」って気配を作る道具だ。──ここがそのモールだ。稼いだコインで好きに選べ。試着は自由、着替えは無料だ。"],
    ["sake", "それと、開店祝いだ。『ジャングルバニー』──葉っぱと馬券で武装した、お前の勝負服第一号だ。受け取れ。", "happy"]
  ]).then(() => {
    try {
      if (!state.player.outfitsWon) state.player.outfitsWon = [];
      if (state.player.outfitsWon.indexOf("jungle") < 0 && !outfitOwned(outfitById("jungle"))) state.player.outfitsWon.push("jungle");
      if (typeof wearOutfit === "function") wearOutfit("jungle"); else state.player.outfit = "jungle";
      if (typeof saveGame === "function") saveGame();
      try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
      Dialogue.play([["mimi", "わぁ……！ ありがとうございます、サケさんっ！ ──じゃーん！ どう、ですか？ 似合います……？", "happy"]]);
      if (typeof rerenderCurrent === "function") rerenderCurrent();
    } catch (e) {}
  });
  if (typeof saveGame === "function") saveGame();
  return true;
}

// 📱 配信モード判定：スマホ購入（第4話マクラ後）で配信ホーム化＝LIVE/視聴者/フォロワー/コメント入力/ハート/
// ギフト/SNSが解禁。それまでは静かモード（立ち絵/独り言/背景/目標/村人の声は残す）。docs/PROGRESSION_DESIGN.md。
// 表示専用＝レース数値に非干渉。
function broadcastOn() {
  return typeof getStoryFlag === "function" && !!getStoryFlag("phoneBought");
}
// 📱 スマホを買って配信を始める＝マクラに背中を押される一幕(VN)→ phoneBought を立てて配信ホーム化
// （LIVE/視聴者/フォロワー/コメント/SNS解禁）。買える額(3千)なら支払い／足りなければマクラが立て替え（無料）。
// ★表示専用＝レース着順/オッズ/配当には非干渉（コインの支払いは衣装購入と同じメタ消費）。docs/PROGRESSION_DESIGN.md
function buyPhoneAndGoLive() {
  if (typeof getStoryFlag === "function" && getStoryFlag("phoneBought")) return;
  // 実行中ガード：VN再生中に🎯チップを再タップすると購入VNが直列に二重で積まれる（実測）。
  // 30秒で自動解除＝VNを途中離脱（＝購入不成立）してもCTAが死なない。
  if (window._phoneBuying) return;
  window._phoneBuying = true;
  setTimeout(function () { window._phoneBuying = false; }, 30000);
  var _finish = function () {
    var p = state.player; var cost = 3000;
    if ((p.coins || 0) >= cost) p.coins = p.coins - cost;   // 買えるなら支払い／足りなければマクラが立て替え
    if (typeof setStoryFlag === "function") setStoryFlag("phoneBought", true);
    if (typeof saveGame === "function") saveGame();
    try { if (window.Sfx) Sfx.play("legendary"); } catch (e) {}
    if (typeof renderHome === "function") renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("📱 配信、はじめました！",
      `<div class="mm-row"><span class="mm-ic">📱</span><div><b>配信デビュー！</b><small>ミミはスマホを手に入れ、配信を開始。ホームが“放送中”になり、👁視聴者・💬コメント・💗フォロワー・📱SNS が解禁されました。</small></div></div>`,
      function () {
        // ★G10（NARRATIVE_DESIGN）：機能列挙の代読でなく、マクラの実演ツアー＝説明より先に
        //   1回さわらせる（do-then-explain）。VN後にSNSタイムラインへ直行。表示専用。
        if (window.Dialogue && Dialogue.play) {
          Dialogue.play([
            ["makura", "よし、開通ついでにタイムライン見せてもらうよ。ほら——これがお前の巣だ。", "default"],
            ["mimi", "わ……もう、コメントついてる……！", "happy"],
            ["makura", "いいね1個は拍手1回。ファンレターは……まあ、読めば泣く。バズったら？　その日は飯が旨い。", "default"],
            ["makura", "難しいことはいい。まず1回、好きな投稿に🔥つけてこい。……話は、その後だ。", "default"],
            ["mimi", "それ、サケさんの真似ですか？", "smile"]
          ], { force: true }).then(function () {
            try { if (typeof goto === "function") goto("sns"); } catch (e) {}
          });
        }
      });
  };
  var afford = (state.player.coins || 0) >= 3000;
  if (window.Dialogue && Dialogue.play && typeof STORY_CAST !== "undefined") {
    var script = [
      ["makura", "ミミ。お前の予想、村の中だけにしとくのは……もったいねえな。", "default"],
      ["mimi", "え？　マクラさん、それって……", "default"],
      ["makura", "これだ。スマホ。これさえありゃ“配信”ができる。お前のぱほぱほ、島の外まで届くぞ。", "default"],
      ["mimi", "わ、わたしが配信なんて……できるかな……", "panic"],
      ["makura", "できるさ。もう村のみんなが応援してる。あとは、世界に見せるだけだ。", "default"],
      afford ? ["mimi", "……うん。やってみますっ！　えいっ、買っちゃう！", "happy"]
             : ["makura", "金は気にすんな。最初はおれが立て替えとく。さ、デビューだ。", "default"],
      ["mimi", "ありがとうございますっ……！　よーし——配信、はじめます！", "happy"]
    ];
    Dialogue.play(script, { force: true }).then(_finish);
  } else { _finish(); }
}

// 汎用インフォポップアップ（？ボタン用）：説明はふだん隠し、気になった時だけ読む（オンボーディング方針）。
// onClose（任意）＝閉じた時に1回だけ呼ぶ。スカウト成立→八竜集結VN、配信開通→マクラのツアー等の
// 「ポップの後に続きを再生する」結線が使う（従来は第3引数が黙って無視されていた）。
function showInfoPopup(title, html, onClose) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop infopop");
  box.innerHTML = `<div class="navpop-t">${title}</div><div class="infopop-body">${html}</div>`;
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    ov.remove();
    if (typeof onClose === "function") { try { onClose(); } catch (e) {} }
  };
  const btns = el("div", "navpop-btns");
  const ok = el("button", "navpop-go", "わかった！"); ok.onclick = close;
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) close(); };
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
    if (typeof mountVolumeFab === "function") mountVolumeFab();   // FABアイコンも即同期
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
  // アイコンは常にミュート状態を映す（🔇のまま🔊表示…の食い違いを防ぐ）
  fab.textContent = (window.Sfx && Sfx.isMuted && Sfx.isMuted()) ? "🔇" : "🔊";
  return fab;
}
// 画面に応じて表示/非表示（beginScreen から毎遷移で呼ぶ）。ホームはナビに⚙️設定（🎚音量）があり
// 下部が密なので隠す。タイトル・レース・物語・結果・設定など他の全画面では表示。
function syncVolumeFab() {
  const fab = mountVolumeFab();
  const screen = state.ui && state.ui.screen;
  // ホーム＝ナビに音量があり下部が密／モール＝没入ミニゲームで戦闘デッキやD-padと重なるため隠す
  fab.style.display = (screen === "home" || screen === "mall") ? "none" : "flex";
  fab.style.bottom = "";
}

// 💰 お金のしくみ（通貨マップ）：どの数字が何のためにあり、何につながるかを1枚で明示。
// 設計：1通貨1役割／コイン→総資産→解放（物語・ランク・暮らしP）の一方向の流れを見せる。
function showMoneyMap() {
  showInfoPopup("💰 お金のしくみ", `
    <div class="mm-flow">🪙 勝つ → 🏦 育つ → 🔓 解放される</div>
    <div class="mm-row"><span class="mm-ic">🪙</span><div><b>コイン</b><small>賭けるお金。配当・ログボで増え、賭け・お買い物で減る。<u>減っても物語は戻らない</u>。</small></div></div>
    <div class="mm-row"><span class="mm-ic">🏦</span><div><b>総資産</b><small>人生の最高到達点（下がらない）。コインの最高記録＋生活資産＋名声。<u>物語・衣装・ランクを解放するカギ</u>。</small></div></div>
    <div class="mm-row"><span class="mm-ic">🌱</span><div><b>暮らしP</b><small>総資産が伸びると貯まる、暮らしの充実度。くらしツリーの解放は<u>コイン</u>で行う。</small></div></div>
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

// 章の“予告用”タイトル。章題そのものに顧問の名が入っている（例「第5話　セレスティアの神眼」）ので、
// まだ出会っていない相手の章は章番号だけに伏せる（R7＝予告はしてよいが固有名は出さない）。読めば本来の章題に戻る。
function chapterTeaseTitle(ch) {
  if (!ch) return "";
  const met = (typeof advisorMet === "function") && advisorMet(ch.cast);   // fail-closed：判定できなければ伏せる
  if (met) return ch.title || ("物語 " + ch.id);
  return ch.id === "ED" ? "エンディング" : "第" + ch.id + "話";
}

// =========================================================================
// Story-unlock popup (a) — shown when a 総資産 threshold is crossed during a
// race. Reuses the same CG placeholder slot. `chapters` is an array; it chains
// via 次へ so multiple unlocks in one race show one after another.
// =========================================================================
// ★撤去（2026-07）：レース直後の全画面解放モーダル showStoryUnlock は「いきなり出て雑」（ユーザー指摘）のため廃止。
//   解放告知は結果明細の1行＋物語ナビ🆕バッジ＋次のホーム到着のカットイン（progression.js _showStoryCutin）へ。
//   関連CSS（.story-unlock-*/.su-*/.story-cg-*）は現状未使用だが、.story-cg-art/.su-cast-sym の一部が
//   .consult-port と同じセレクタを共有するため style.css には残置（呼び出しの復活は禁止）。

// (b) advisor "voice" element for a gameplay screen, or null if none met yet.
//   context "race"   → most-advanced race advisor met (Sake→Mizu→Makura→Celestia)
//   context "assets" → Sumika (lifestyle / 総資産)
function advisorVoiceEl(context) {
  const order = context === "assets" ? ["sumika"] : ["celestia", "makura", "mizu", "sake"];
  let key = null;
  for (const k of order) { if (STORY_RACE_VOICE[k] && (typeof advisorMet === "function") && advisorMet(k)) { key = k; break; } }   // ★BUGFIX：既読も要る／fail-closed：判定できなければ喋らせない
  if (!key) return null;
  const c = STORY_CAST[key];
  const box = el("div", "card advisor-voice");
  box.style.setProperty("--cg", c.color);
  box.innerHTML =
    `<span class="av-sym">${c.symbol}</span>` +
    `<span class="av-body"><span class="av-name">${c.name}<small>（${c.tag}）</small></span>` +
    `<span class="av-line">${storyVoiceLine(key, context === "assets" ? "assets" : "race")}</span></span>`;
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
  // 解放＝第5話を読んで出会う（advisorMet）or「救済」＝破産3回超で“知らないお姉さん”に出会った（js/epilogue_engine.js）。
  // ★門番：総資産だけで開けると、第5話を読む前に神眼（＝結果固定＋オッズ1.1倍）まで発動してしまうので advisorMet で判定（fail-closed）。
  const revealed = (typeof advisorMet === "function") && advisorMet("celestia");   // 第5話で正体判明＝本名・☄️・「神眼」解禁
  const stranger = (typeof castStrangerSeen === "function") && castStrangerSeen();
  if (!revealed && !stranger) return null;   // まだ出会っていない
  const sym = (typeof castSymbolSafe === "function") ? castSymbolSafe("celestia") : "🌌";
  const who = String((typeof castNameSafe === "function") ? castNameSafe("celestia") : "あのお姉さん").split("・")[0];
  const box = el("div", "card celestia-box");
  box.style.setProperty("--cg", revealed ? castColorSafe("celestia") : "#7a6aa0");
  if (c._celestiaRevealed) {
    const win = DRAGONS.find(d => d.id === c._celestiaRevealed);
    const nm = win ? win.name : "？";
    box.classList.add("revealed");
    const warn = `……ほら、もう知れ渡った。<b>${nm}</b> の札に人が群がって、単勝も複勝も最低の <b>1.1倍</b>。それでも、教わった1頭の1.1倍は確実。──1着を知ることと、大きく勝つことは、違うでしょう？`;
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
      // ★D6：神眼1.1倍の“説明”はこの台詞1本＋絶滅メーターヘルプの2箇所だけに集約（声表準拠）。
      const catchTx = "答えは、教えられる。つまらなくなるのは、あなたの側よ。……教えた竜には札が殺到して、単勝も複勝も最低の1.1倍。──それでも、聞く？";
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
  // 竜の村フル画面への導線（設定のカードだけだと施設ロードマップに辿り着けなかった＝孤立解消）
  if (typeof renderVillage === "function") {
    const vilWrap = el("div", "set-data");
    const vilOpen = el("button", "secondary", "🏘️ 竜の村をくわしく見る");
    vilOpen.onclick = () => renderVillage();
    vilWrap.appendChild(vilOpen);
    app.appendChild(vilWrap);
  }

  // 予想入門・ヘルプ（ホームのナビから移設＝ここから開く）
  if (typeof renderHelp === "function") {
    app.appendChild(el("div", "as-sec", "予想入門・ヘルプ"));
    const help = el("div", "set-data");
    const bHelp = el("button", "secondary", "🎓 予想入門をひらく"); bHelp.onclick = () => renderHelp();
    help.appendChild(bHelp);
    app.appendChild(help);
  }

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

    // 🩺 レスポンシブ自己診断（js/devcheck.js）：横溢れ/横向きクリップ/16px未満input/壊れ表示/100vh残存を機械検出。
    if (typeof responsiveSelfCheck === "function") {
      const showRep = (rep) => {
        const ov = el("div", "navpop-ov");
        const box = el("div", "navpop");
        const body = (rep.problems && rep.problems.length)
          ? "<ul style='text-align:left;margin:9px 0;padding-left:18px;line-height:1.55;font-size:12px'>" + rep.problems.map(p => "<li>" + String(p).replace(/</g, "&lt;") + "</li>").join("") + "</ul>"
          : "<div style='margin:12px 0;color:#7fd6a0'>この範囲では問題は見つかりませんでした 🎉</div>";
        box.innerHTML = `<div class="navpop-t">🩺 自己診断　${rep.verdict}</div>` +
          `<div style="font-size:11.5px;color:#9fb0b8;margin-bottom:2px">${rep.viewport}　${rep.framed ? "PC/タブレット枠" : "スマホ全幅"}</div>${body}`;
        const btns = el("div", "navpop-btns");
        const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => ov.remove(); btns.appendChild(ok); box.appendChild(btns);
        ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
        document.body.appendChild(ov);
      };
      app.appendChild(el("div", "as-sec", "🩺 レスポンシブ自己診断"));
      const dg = el("div", "set-debug");
      const d1 = el("button", "set-dbg-b", "🩺 今の画面を診断");
      d1.onclick = () => showRep(responsiveSelfCheck());
      const d2 = el("button", "set-dbg-b", "🔁 全画面を巡回診断");
      d2.onclick = () => { if (typeof responsiveSelfCheckAll === "function") responsiveSelfCheckAll().then(showRep); else showRep(responsiveSelfCheck()); };
      dg.appendChild(d1); dg.appendChild(d2);
      app.appendChild(dg);
      app.appendChild(el("div", "as-hint2", "現在の画面サイズで検査します。スマホ実機やプレビューを 360 / 740×360（横）/ 1280 にして実行すると効果的（docs/RESPONSIVE_GUARDRAILS.md）。"));
    }

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

  // おまけ：エンディング＆スタッフロール。★クリア後だけ（未クリアで再生すると顧問5人の立ち絵・全5話の
  // 一枚絵・結末まで丸ごとネタバレし、gameCleared まで立ってしまう＝新規セーブで実際に再生できていた）。
  // 主条件＝最終決戦の完走（epData().edFlag：正規ルート epilogue_engine.js:epilogueClear が立てる唯一の印。
  // gameCleared は正規ルートでは立たないので、これ単独でガードすると永久ロックになる）。
  const edUnlocked = (function () {
    try {
      if (state.ui && state.ui.debug) return true;                                   // デバッグ中は動作確認のため開ける
      if (typeof epData === "function" && epData().edFlag) return true;              // 最終決戦を完走した（正規クリア）
      return (typeof getStoryFlag === "function") && !!getStoryFlag("gameCleared");  // 既に一度クリア済みのセーブ
    } catch (e) { return false; }   // fail-closed：判定できないときは伏せる（ネタバレは取り消せない）
  })();
  app.appendChild(el("div", "as-sec", "おまけ"));
  if (!edUnlocked) {
    // 🔒条件明示（進行の作法）。ネタバレになるので登場人物・結末には触れず、条件だけを出す。
    const edLock = el("div", "set-row",
      `<span class="set-ic">🔒</span><span class="set-tx"><span class="set-nm">エンディングを観る</span><span class="set-sub">最終決戦をクリアすると解放されます</span></span>`);
    const edLockBtn = el("button", "set-toggle", "🔒");
    edLockBtn.disabled = true;
    edLock.appendChild(edLockBtn);
    app.appendChild(edLock);
  } else {
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
  }

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

// §07 §20 Help / Tutorial screen — §10 explains all V1 prediction concepts.
function renderHelp() {
  state.ui.screen = "help";
  const app = beginScreen();
  app.appendChild(el("h2", null, "予想入門"));
  // E4解消：島の話し言葉（単竜/複竜/ワイド竜）と帳面の正式表記（単勝/複勝/ワイド）の対応をここで一度だけ明示。
  app.appendChild(el("div", "as-hint2", "島のみんなは賭式を <b>単竜（＝単勝・1着を当てる）／複竜（＝複勝・3着以内）／ワイド竜（＝ワイド・2頭とも3着以内）</b>と呼びます。呼び名がちがうだけで、中身は同じです。"));

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
// 図鑑専用：HD-2Dスプライトはレースの「鼻先(右端)アンカー」契約のまま(x,y,scale)を図鑑の
// 小さいcanvasにそのまま当てはめると、実画像の縦横比によっては胴体がキャンバス外へはみ出て
// 半分しか映らない（ユーザー指摘）。図鑑では実アスペクト比から余白内にきっちり収まるx/y/scale
// を計算し直す＝レース側のrcDrawDragonSprite本体・座標契約には一切触れない（表示のみ・安全）。
function _dexFitSprite(id, cw, ch, padX, padYTop, padYBottom) {
  try {
    if (typeof _rcDragonSprite !== "function") return null;
    const e = _rcDragonSprite(id);
    if (!e || !e.ok || !e.box) return null;   // 未ロード＝呼び出し側で従来の固定値にフォールバック
    const ar = e.box.w / e.box.h;
    const availH = ch - padYTop - padYBottom, availW = cw - padX * 2;
    let hpx = availH, wpx = hpx * ar;
    if (wpx > availW) { wpx = availW; hpx = wpx / ar; }   // 横長の竜は幅基準に収め直す
    const mul = (typeof RC_SIZE_MUL !== "undefined" && RC_SIZE_MUL[id]) || 1;
    const scale = hpx / ((typeof RC_DSP_H !== "undefined" ? RC_DSP_H : 46) * mul);
    return { x: padX + wpx, y: ch - padYBottom, scale };
  } catch (e) { return null; }
}
// §41 — 図鑑：竜カードの詳細ポップ（大きめスプライト＋特徴＋記録＋解放ノート＋お気に入り）。
let _dexFilter = "all";
function showCollectionDragonDetail(d) {   // ※poro.js の showDragonDetail(id) と名前衝突していたため改名（図鑑=オブジェクト渡し）。
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
    const _fit = _dexFitSprite(d.id, 300, 150, 16, 12, 16);
    const _o = _fit ? { id: d.id, x: _fit.x, y: _fit.y, scale: _fit.scale, color: col, style: d.style, gait: 0, flap: 1.0, lean: 0.25, glow: 0.5 }
      : { id: d.id, x: 161, y: 117, scale: 2.85, color: col, style: d.style, gait: 0, flap: 1.0, lean: 0.25, glow: 0.5 };
    rcDrawDragon(cv.getContext("2d"), _o);
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
  if (typeof dexUnlocked === "function" && !dexUnlocked()) {   // Ⓐ 早期解放を封じる：図鑑は初的中で開く（mall型の案内つき）。
    if (typeof renderHome === "function") renderHome();
    if (typeof showInfoPopup === "function") showInfoPopup("🐉 竜図鑑",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>レースで<u>はじめて的中</u>すると、出会った竜を図鑑に記録できます。</small></div></div>`);
    return;
  }
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
      if (cv && cv.getContext && typeof rcDrawDragon === "function") {
        const _fit2 = _dexFitSprite(d.id, 78, 56, 5, 4, 6);
        const _o2 = _fit2 ? { id: d.id, x: _fit2.x, y: _fit2.y, scale: _fit2.scale, color: dragonColor(d), style: d.style, gait: 0, flap: 1.0, lean: 0.25, glow: 0.4 }
          : { id: d.id, x: 42, y: 38, scale: 0.72, color: dragonColor(d), style: d.style, gait: 0, flap: 1.0, lean: 0.25, glow: 0.4 };
        rcDrawDragon(cv.getContext("2d"), _o2);
      }
      card.onclick = () => showCollectionDragonDetail(d);
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
  // Popularity-sorted entries — shared by the pick cards and the dragon-info table.
  const sorted = [...oddsResult.oddsData].sort((a, b) => a.popularityRank - b.popularityRank);
  const betCap = RANKS[race.rank].maxWager * (VILLAGE_MULT[state.player.villageLevel] || 1.0);

  // ===== ★賭け画面リデザイン（2026-07・A骨格＋C演出＝docs/RESEARCH_BETTING_UX.md）＝
  // 「上=レース情報(sticky) / 中=賭式タブ＋出走カード / 下=常設ベットスリップ(sticky・親指ゾーン)」。
  // 数値エンジン(simulateMarket/betOdds/validateBet/runRace)は不変＝表示/UX層のみ。 =====
  const theme = REGION_THEME[race.region];
  const head = el("div", "bd-head");
  if (theme) {
    head.style.setProperty("--region-from", theme.from);
    head.style.setProperty("--region-to", theme.to);
    head.style.setProperty("--region-accent", theme.accent);
  }
  head.innerHTML = `
    <div class="bd-head-top">
      <button class="bd-back" id="back-race-select" type="button" aria-label="レース選択へ戻る">←</button>
      <div class="bd-title"><b>${raceFullName(race)}</b><span class="bd-sub">${race.purpose || ""}</span></div>
    </div>
    <div class="bd-chips">
      <span class="bd-chip">🏅 R${race.rank} ${RANKS[race.rank].label}</span>
      <span class="bd-chip">📏 ${DISTANCE[race.distance].label}</span>
      <span class="bd-chip">${WEATHERS[race.weather].label}</span>
    </div>
    <div class="bd-course">序盤 ${getSection("early", race.early).label} ▸ 中盤 ${getSection("mid", race.mid).label} ▸ 終盤 ${getSection("late", race.late).label}</div>`;
  app.appendChild(head);
  const _sakeV = advVoiceHeader("sake");
  if (_sakeV) { _sakeV.classList.add("bd-sake"); app.appendChild(_sakeV); }

  // -- advisor voice line, shown atop a panel once that advisor has been met --
  function advVoiceHeader(key) {
    const cast = STORY_CAST[key];
    if (!cast || !((typeof advisorMet === "function") && advisorMet(key))) return null;   // ★BUGFIX：既読も要る／fail-closed：判定できなければ出さない
    const v = el("div", "adv-voice");
    v.style.setProperty("--cg", cast.color);
    v.innerHTML =
      `<span class="adv-voice-sym">${cast.symbol}</span>` +
      `<span class="adv-voice-body"><span class="adv-voice-name">${cast.name.split("・")[0]}<small>（${cast.tag}）</small></span>` +
      `<span class="adv-voice-line">${storyVoiceLine(key, "consult") || cast.consult}</span></span>`;
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
      // ★門番：出走表(マクラ)・財政(スミカ)は“常に見られる中核情報”なのでパネルは開けたままにし、
      //   まだ出会っていない相手の「正体」だけを伏せる（名前・記号・テーマ色は castNameSafe 系を通す）。
      //   従来は gated の無いタブが短絡して advisorMet を一度も見ず、初回の賭け画面から本名が出ていた。
      let locked = !!a.gated && !((typeof advisorMet === "function") && advisorMet(a.key));   // fail-closed：判定できなければロック
      const name = String((typeof castNameSafe === "function") ? castNameSafe(a.key) : "？？？").split("・")[0];
      const sym = (typeof castSymbolSafe === "function") ? castSymbolSafe(a.key) : "❓";
      const color = (typeof castColorSafe === "function") ? castColorSafe(a.key) : "#8a8175";
      // 救済（破産3回超で“お姉さん”に出会う）でも1着は聞ける。正体（本名/☄️）は castNameSafe 側が第5話まで伏せる。
      if (a.key === "celestia" && (typeof castStrangerSeen === "function") && castStrangerSeen()) locked = false;
      const b = el("button", "adv-tab" + (locked ? " locked" : ""));
      b.dataset.key = a.key;
      b.style.setProperty("--cg", color);
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
    const unlocked = (typeof advisorMet === "function") && advisorMet("mizu");   // ★BUGFIX：既読も要る／fail-closed
    if (!unlocked) {
      const wrap = el("div", "card adv-panel adv-locked mizu-locked");
      wrap.style.setProperty("--cg", (typeof castColorSafe === "function") ? castColorSafe("mizu") : "#8a8175");   // 未登場＝無彩色
      wrap.innerHTML =
        `<div class="cel-lock-row"><span class="cel-lock-sym">🔒</span>` +
        `<div class="cel-lock-body"><div class="cel-lock-title">分析予想は、まだ読めない</div>` +
        `<div class="cel-lock-sub">総資産 ${fmtCoins(castUnlockAt("mizu"))} に届いて第2話を読むと、人気の理由を分解した本命・対抗・穴が読めます。</div></div></div>`;
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

  // -- セレスティア：1着を聞く（出会っていれば2段階の神眼、未登場ならロック表示） --
  // 解放＝第5話を読んで出会う（advisorMet）or「救済」＝破産3回超で“知らないお姉さん”に出会う（js/epilogue_engine.js）。
  function buildCelestiaPanel() {
    // ★門番：総資産だけで開くと、第5話未読でも神眼（結果固定＋オッズ1.1倍）というゲーム効果まで発動してしまう。
    //   同じ画面のタブは advisorMet で🔒なので自己矛盾にもなっていた。advisorMet に統一（fail-closed）。
    const met = (typeof advisorMet === "function") && advisorMet("celestia");
    const stranger = (typeof castStrangerSeen === "function") && castStrangerSeen();
    if (met || stranger) { const cel = celestiaSectionEl(); if (cel) return cel; }
    const wrap = el("div", "card adv-panel cel-locked");
    wrap.style.setProperty("--cg", (typeof castColorSafe === "function") ? castColorSafe("celestia") : "#8a8175");   // 未登場＝無彩色（色でキャラを推測させない）
    wrap.innerHTML =
      `<div class="cel-lock-row"><span class="cel-lock-sym">🔒</span>` +
      `<div class="cel-lock-body"><div class="cel-lock-title">“1着を聞ける相手” には、まだ出会っていない</div>` +
      `<div class="cel-lock-sub">総資産 ${fmtCoins(castUnlockAt("celestia"))} に届いて第5話を読むか、何度も無一文になって立ち上がるうち、ふと現れる誰かに出会うかもしれません。</div></div></div>`;
    return wrap;
  }

  // ===== Betting panel — 賭式タブ＋出走カード（読む場所＝選ぶ場所）。
  // 2段ステップは廃止＝下部の常設スリップ（親指ゾーン）に賭金・払戻・出走を集約。
  const effMax = Math.max(1, Math.floor(Math.min(betCap, state.player.coins)));
  const wagerInit = Math.max(1, Math.min((_consultActive && state.current.bet && state.current.bet.wager) || Math.min(100, effMax), effMax));
  const panel = el("div", "bet-panel bd-list");
  panel.innerHTML = `
    <div class="bet-tabs bd-tabs">
      <button data-type="win" class="active">単勝<small>1着をあてる</small></button>
      <button data-type="place">複勝<small>3着以内</small></button>
      <button data-type="wide">ワイド<small>2頭とも3着内</small></button>
    </div>
    <div class="bet-pick">
      <div class="bet-pick-head">
        <span id="pick-instruction"></span>
        <span class="pick-count" id="pick-count"></span>
      </div>
      <div class="bet-pick-grid" id="bet-pick-grid"></div>
    </div>
  `;
  app.appendChild(panel);

  // 深掘り（ミズ分析/出走表/財政/神眼）は出走カードの下＝進行はスリップだけで完結する。
  app.appendChild(buildAdvisorHub());

  // ===== 常設ベットスリップ（sticky bottom・研究②tap-to-slip＋クイック賭金＋払戻ヒーロー） =====
  const slip = el("div", "bd-slip");
  slip.innerHTML = `
    <div class="bet-sel-sum" id="bet-sel-sum"></div>
    <div class="slip-wager">
      <button class="wager-step" id="wager-minus" type="button" aria-label="減らす">−</button>
      <span class="wager-amount"><input id="wager" class="wager-big" type="text" inputmode="numeric" value="${wagerInit}"><span class="wager-unit">コイン</span></span>
      <button class="wager-step" id="wager-plus" type="button" aria-label="増やす">＋</button>
      <span class="wager-quick" id="wager-chips"></span>
    </div>
    <div class="payout-box empty" id="expected-payout"><div class="po-hint">本命と賭金を選ぶと払戻が出ます</div></div>
    <div class="slip-actions"><button id="bet-confirm" type="button" disabled>🎫 投票券を切る</button></div>
    <div class="condition-line slip-note">所持 ${fmtCoins(state.player.coins)} ／ この一戦の上限 ${fmtCoins(betCap)}<span class="cl-note">（村Lv${state.player.villageLevel}補正込）</span></div>
  `;
  app.appendChild(slip);

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
    card.style.setProperty("--waku", dragonColor(d));   // 枠色バー＝竜のアイデンティティ（勝負服相当）
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
      renderPickState();
      updateExpected();
      // オッズ変動フラッシュ（B案から拝借・表示演出のみ）＝賭式切替で参照オッズが変わる瞬間を光らせる
      pickGrid.querySelectorAll(".bp-odds b").forEach(o => { o.classList.remove("flash"); void o.offsetWidth; o.classList.add("flash"); });
    };
  });
  // ---- Stake controls: −/+ stepper + fraction chips（スリップ内・キーボード不要）。 ----
  const stepAmt = betStepSize(effMax);
  const wagerCur = () => { const n = parseInt(String($("wager").value || "").replace(/[^0-9]/g, ""), 10); return Number.isNaN(n) ? 0 : n; };
  function setWager(v) {
    v = Math.round(v); if (Number.isNaN(v)) v = 0;
    v = Math.max(1, Math.min(v, effMax));
    const w = $("wager"); if (w) w.value = v;
    const cg = $("wager-chips"); if (cg) cg.querySelectorAll(".wchip").forEach(c => c.classList.toggle("chosen", +c.dataset.amt === v));
    updateExpected();
  }
  $("wager-minus").onclick = () => setWager(wagerCur() - stepAmt);
  $("wager-plus").onclick = () => setWager(wagerCur() + stepAmt);
  $("wager").oninput = () => updateExpected();          // optional manual typing
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

  // ※ onclickに直接渡すとclickイベントが skipDialog 扱いになり確認（投票券）を飛ばして即出走する
  //   （潜在バグが常設スリップ化で顕在化＝ラッパで明示的に引数なし呼び出し）。
  $("bet-confirm").onclick = () => onConfirmBet();
  $("back-race-select").onclick = renderRaceSelect;

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
    const tL = { win: "単勝", place: "複勝", wide: "ワイド" }[type] || type;
    const nm = id => { const d = DRAGONS.find(x => x.id === id); return d ? d.name : ""; };
    ss.innerHTML =
      `<span class="bss-tix">🎫</span><b class="bss-nm">${nm(a)}${type === "wide" ? " ＋ " + nm(b) : ""}</b>` +
      `<span class="bss-odds">${tL} <b>${odds.toFixed(1)}</b>倍</span>`;
  }
  // 払戻をヒーロー数字に（リスク＝ハズレ時も対で明示）
  box.innerHTML =
    `<div class="po-hero"><span class="pl-k">的中時払戻</span><span class="pl-v">${fmtCoins(payout)}<small>コイン</small></span></div>` +
    `<div class="po-sub"><span class="po-profit">利益 +${fmtCoins(payout - c.bet.wager)}</span><span class="po-loss">ハズレ時 −${fmtCoins(c.bet.wager)}</span></div>`;
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
  // ★このレースの実績反映“前”に、いま読める未読章を控える（レース後に新しく読めるようになった章を差分で出すため）。
  const _availBefore = new Set((typeof chapterAvailable === "function")
    ? STORY_CHAPTERS.filter(ch => chapterAvailable(ch.id) && !chapterRead(ch.id)).map(ch => ch.id) : []);
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
  // 目標「ワイド／複勝を当てる」＝“単勝の外”の的中で立てる（表示専用フラグ・レース数値に非干渉）
  if (betResult.hit && c.bet.type !== "win") state.player.flags.firstWideHit = true;
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
  // (a) story: このレースの実績で「新しく読めるようになった」章（前は読めず、今は読める・未読）。
  //     ★総資産のしきい値跨ぎではなく chapterAvailable の差分＝1レースで複数話がまとめて出ない（前章既読が要る）。
  const justUnlocked = (typeof chapterAvailable === "function")
    ? STORY_CHAPTERS.filter(ch => ch.id !== "ED" && chapterAvailable(ch.id) && !chapterRead(ch.id) && !_availBefore.has(ch.id))
    : [];
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
      // ★台帳の「📜 物語が解放」も章題をそのまま出すと未登場の名が漏れる（例「第5話　セレスティアの神眼」）。
      //   ここに載る章は必ず未読なので、章番号だけの見出しに伏せる（R7）。
      storyUnlocked: justUnlocked.map(ch => chapterTeaseTitle(ch)),
      mission: _mission
    };
  } catch (e) { c.gainLedger = null; }
  saveGame();
  updateHeader();
  // ★レース直後に全画面モーダルは出さない（「いきなり出て雑」＝ユーザー指摘）。
  //   解放は結果明細の1行（storyUnlocked）で静かに触れ、物語ナビのバッジ＋次のホーム到着時のカットインで案内する。
}

// §07 §13 Bet confirmation modal.
function showBetConfirm() {
  const c = state.current;
  const typeLabel = { win: "単勝", place: "複勝", wide: "ワイド" }[c.bet.type];
  const sel = c.bet.selections.map(id => DRAGONS.find(d => d.id === id).name).join(" ＋ ");
  const odds = betOdds(c.bet, c.oddsResult);
  const payout = Math.floor(c.bet.wager * odds);
  const overlay = document.getElementById("event-overlay");
  // ★投票券モチーフ（C演出）：半券つきチケット→「千切って出走」。表示のみ＝数値は betOdds のまま。
  const serial = `No.${String(c.race.id || "R").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}-${String((state.player.completedRaces || 0) + 1).padStart(4, "0")}`;
  document.getElementById("event-speaker").textContent = "🎫 聖龍レース投票券";
  document.getElementById("event-text").innerHTML =
    `<div class="tix" id="tix-card">` +
      `<div class="tix-main">` +
        `<div class="tix-head"><span class="tix-brand">聖龍競竜会 公認</span><span class="tix-serial">${serial}</span></div>` +
        `<div class="tix-race">${raceFullName(c.race)}</div>` +
        `<div class="tix-sel"><span class="tix-type">${typeLabel}</span><b>${sel}</b></div>` +
        `<div class="tix-rows">` +
          `<span class="tix-row"><small>賭金</small><b>${fmtCoins(c.bet.wager)}</b></span>` +
          `<span class="tix-row"><small>オッズ</small><b>${odds.toFixed(1)}倍</b></span>` +
          `<span class="tix-row tix-pay"><small>的中払戻</small><b>${fmtCoins(payout)}</b></span>` +
        `</div>` +
      `</div>` +
      `<div class="tix-stub"><span>半券</span><b>${typeLabel}</b><i>${odds.toFixed(1)}</i></div>` +
    `</div>` +
    `<div class="bcf-q">千切ると、出走が確定します。</div>`;
  // Swap close button for two buttons（出走＝主ボタン／やめる＝副）
  const closeBtn = document.getElementById("event-close");
  closeBtn.style.display = "none";
  let existing = document.getElementById("bet-confirm-actions");
  if (existing) existing.remove();
  const actions = document.createElement("div");
  actions.id = "bet-confirm-actions";
  const no = document.createElement("button"); no.textContent = "やめる"; no.className = "secondary";
  no.onclick = () => { closeBetConfirm(); };
  const yes = document.createElement("button"); yes.textContent = "🎫 千切って出走"; yes.className = "bcf-go";
  yes.onclick = () => {
    // E1（docs/HUNGER_ECONOMY_DESIGN.md）：おなかが空っぽなら出走できない（表示ゲートのみ・
    // レース数値不変・FTUE=最初の3レースは素通し）。ごはんへ誘導して中止。
    if (typeof hungerCanRace === "function" && !hungerCanRace()) {
      closeBetConfirm();
      // ★G9：空腹UIとキャラの結線＝第1話の「まず食え」をサケの声で再演（門番advisorMet・fail-closed）。
      const sakeLine = (typeof advisorMet === "function" && advisorMet("sake"))
        ? `<div class="mm-row"><span class="mm-ic">🐲</span><div><b>サケ</b><small>「まず食え。……話は、その後だ。」</small></div></div>` : "";
      if (typeof showInfoPopup === "function") showInfoPopup("🍖 おなかがすいて走れない…",
        sakeLine +
        `<div class="mm-row"><span class="mm-ic">🍽</span><div><b>ごはんを食べよう</b><small>ホームの🍽ごはんへ。ハズレた日は1品「店のおごり」が出ます。</small></div></div>`);
      return;
    }
    const t = document.getElementById("tix-card");
    yes.disabled = true; no.disabled = true;
    if (t) { t.classList.add("tear"); try { if (window.Sfx) Sfx.play("tick"); } catch (e) {} }
    setTimeout(() => {
      closeBetConfirm();
      if (typeof hungerSpendRace === "function") try { hungerSpendRace(); } catch (e) {}   // 出走＝おなか−25
      onConfirmBet(true);
    }, t ? 420 : 0);
  };
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

  // タイムライン（画面の物理位置の source）を先に作り、実況/HUDの順位もこれに合わせる
  // ＝中盤の「先頭/N番手」が画面と一致（表示専用・着順/結果/配当は不変）。
  if (!c.timeline) {
    c.timeline = buildRaceTimeline(c.race, c.raceResult, c.oddsResult, c.bet);
  }
  if (!c.broadcast) {
    c.broadcast = buildBroadcastData(c.race, c.raceResult, c.bet, c.oddsResult, c.timeline);
    c.commentary = buildAllCommentary(c.broadcast, { race: c.race, bet: c.bet, oddsResult: c.oddsResult, raceResult: c.raceResult });
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
    // 🎉 的中時＝結果画面のファンファーレ（「ファンファーレの日々」）。1レースにつき1回だけ・単発（ループ無し）。
    //   結果は zone=other なので bgm_zones は奪わず、ホームへ戻ると自然停止。外れは従来どおり無音。
    if (r.hit && window.RaceBgm && RaceBgm.playFile) { try { RaceBgm.playFile("bgm/racebgm/fanfare-days.mp3", { once: true }); } catch (e) {} }
    c.resultHooksRan = true;
  }

  // 🛍️ モール解放＝第2話既読ゲート（E3解消）。初的中のお祝いは📖図鑑cut-in（progression.js）が担い、
  // サケの衣装ギフトVNはモール初訪問時（ui_mall.js → playMallIntroVN）へ移設した（2026-07）。

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
      if (g.lifePDelta > 0) R("🌱", "暮らしP（総資産で貯まる指標）", "＋" + g.lifePDelta, "asset");
      if (g.rankUp) R("🏅", "ランク昇格！", "ランク" + g.rankUp, "rankup");
      // ★解放は結果画面では静かに1行だけ（章題は出さず「新しい話が届いた」）。詳しい案内は物語ナビ/ホーム側で。
      if (g.storyUnlocked && g.storyUnlocked.length) R("📖", "新しい話が届いた", "〈物語〉へ", "rankup");
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
  // E4：1章は分析/次のヒントを伏せる（勘レース）。現タブが伏せ対象なら結果へ戻す（保険）。
  const _anaOn = (typeof analysisUnlocked !== "function") || analysisUnlocked();
  const _hidden = t => !_anaOn && (t === "analysis" || t === "hints");
  if (_hidden(c.recapTab)) c.recapTab = "result";
  const bar = el("div", "recap-tabs");
  RECAP_TABS.forEach(t => {
    if (_hidden(t.id)) return;
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

  // 次の一手（docs/GAME_EXPERIENCE_DESIGN.md §3・M1）：勝ち飯/負け飯＝「結果→島時間」の結線。
  // 提案チップ1〜2個だけ・押しつけない（下の従来ボタンは常に有効）。表示専用。
  const _nx = (typeof nextSuggestRow === "function")
    ? nextSuggestRow("result", { hit: !!(c.betResult && c.betResult.hit) }) : null;
  if (_nx) app.appendChild(_nx);

  // --- Persistent actions（導線：ホーム／詳しい分析＝副、次のレース＝主CTA） ---
  const actions = el("div", "actions");
  const home2 = el("button", "secondary", "ホーム"); home2.onclick = renderHome;
  actions.appendChild(home2);
  if (_anaOn) {   // E4：詳しい分析は2章解禁（1章は勘レース）
    const detail = el("button", "secondary", "詳しい分析"); detail.onclick = renderAnalysis;
    actions.appendChild(detail);
  }
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
  // next story chapter（★解放は chapterAvailable が正本＝前章既読＋実績。予告に固有名は出さない）
  if (typeof STORY_CHAPTERS !== "undefined" && typeof chapterAvailable === "function") {
    const nextCh = STORY_CHAPTERS.find(ch => !chapterRead(ch.id));   // 未読で最も手前の章
    if (nextCh) {
      const avail = chapterAvailable(nextCh.id);
      // 進捗バー：総資産ゲートの章(4/5/ED)だけ total で見せ、実績ゲート(2/3)は解禁前は控えめに。
      const at = (typeof storyUnlockAt === "function") ? storyUnlockAt(nextCh.id) : 0;
      const pct = avail ? 100 : (at > total ? clamp(total / at * 100, 2, 99) : 40);
      const sub = avail ? "いま読める！" : ((typeof chapterUnlockHint === "function" && chapterUnlockHint(nextCh.id)) || "続きはもう少し");
      goals.push({ kind: "story", icon: "📖", label: chapterTeaseTitle(nextCh), sub: sub, pct: pct });
    }
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
  // ★BUGFIX：顧問の登場は「章を読んだ」ことも要る（advisorMet）。総資産だけの旧判定だと
  //   出会う前のミズ等が結果画面で喋ってしまう。
  const met = k => (typeof advisorMet === "function") && advisorMet(k);   // fail-closed：判定できなければ喋らせない
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
  const hero = el("div", "rs-hero rs-" + info.cls);
  hero.innerHTML =
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

  // （音声操作は全画面共通の🔊FABへ一本化＝rs-mute ボタンは撤去・ユーザー指摘のUX整理）

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
  // E4：1章は“勘レース”。分析予想は第2話を読むと解禁（表示ゲート・数値不変）。
  // ★予告に固有名を出さない：この文面は第2話が未読＝まだ出会っていない時にしか出ないので、章番号だけで案内する。
  if (typeof analysisUnlocked === "function" && !analysisUnlocked()) {
    const app0 = beginScreen();
    app0.appendChild(el("h2", null, "レース後分析"));
    app0.appendChild(el("div", "card",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ「分析」はできません</b>` +
      `<small>いまはカンだけが頼りのミミ。<u>第2話</u>を読むと、オッズの読み方・妙味・次のヒントが手に入ります（総資産3千で第2話が解禁）。</small></div></div>` +
      `<div class="mm-row"><span class="mm-ic">🐰</span><div><small>ミミ「ぶ、分析……？　なにそれおいしいの……？　いまはカン！　カンで勝負だよっ！（震え声）」</small></div></div>`));
    const acts = el("div", "actions");
    const bk = el("button", "secondary", "◀ 結果へ戻る"); bk.onclick = () => renderResult();
    acts.appendChild(bk);
    app0.appendChild(acts);
    return;
  }
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
