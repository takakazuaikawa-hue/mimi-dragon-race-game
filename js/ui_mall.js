// =========================================================================
// ui_mall.js — ショッピングモール「MIMI MALL」＝実在SCサイト(station SQUARE)風のライト・ポータル。
// =========================================================================
// 参考：相模大野ステーションスクエア。白基調＋オレンジ差し色＋細い線画アイコン＋ヒーロー(自動送り)＋
//   3列アイコンメニュー＋画像カード＋オレンジ角丸ピルのサービス案内＋下部オレンジナビ(中央MENU)＋SNS縦タブ。
// ★完全に表示専用メタ（着順/オッズ/配当に非干渉＝[[race-math-immutable]]）。衣装の購入/着替えロジックは流用。
// renderMall を ui_render.js から本ファイルへ移設（CODEMAP §6 の分割）。
// =========================================================================

// 細い線画アイコン（station SQUARE風アウトライン・currentColor）。
function _scmIcon(name) {
  var I = {
    search: '<circle cx="10.5" cy="10.5" r="6.4"/><line x1="15.3" y1="15.3" x2="21" y2="21"/>',
    floor: '<path d="M12 3 21 8 12 13 3 8Z"/><path d="M4.2 11.5 12 15.8 19.8 11.5"/><path d="M4.2 15 12 19.3 19.8 15"/>',
    hanger: '<path d="M12 7.1a1.9 1.9 0 1 1 1.5.7c-.9.4-1.5 1-1.5 1.9v.5"/><path d="M12 10.8 4.2 17a1 1 0 0 0 .6 1.8h14.4a1 1 0 0 0 .6-1.8L12 10.8"/>',
    lock: '<rect x="5" y="10.4" width="14" height="9.6" rx="2"/><path d="M8 10.4V7a4 4 0 0 1 8 0v3.4"/>',
    tag: '<path d="M3.6 11V4.6a1 1 0 0 1 1-1h6.4a1.4 1.4 0 0 1 1 .4l8 8a1.5 1.5 0 0 1 0 2.1l-6.3 6.3a1.5 1.5 0 0 1-2.1 0l-8-8a1.4 1.4 0 0 1-.4-1Z"/><circle cx="7.6" cy="7.6" r="1.2"/>',
    flag: '<line x1="5.2" y1="3" x2="5.2" y2="21"/><path d="M5.2 4h12.3l-2.7 4 2.7 4H5.2"/>',
    shop: '<path d="M4 9.4 5.2 4.9A1.3 1.3 0 0 1 6.5 3.9h11a1.3 1.3 0 0 1 1.3 1l1.2 4.5"/><path d="M4 9.4h16v9.7a1.3 1.3 0 0 1-1.3 1.3H5.3A1.3 1.3 0 0 1 4 19.1Z"/><path d="M9.6 20.4v-4.8h4.8v4.8"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7v5.2l3.4 2"/>',
    dine: '<path d="M6.5 3v6.5a2 2 0 0 0 4 0V3M8.5 9.5V21"/><path d="M16.5 3c-1.4 0-2.3 2.2-2.3 4.8 0 2.1.9 3.4 2.3 3.4s2.3-1.3 2.3-3.4C18.8 5.2 17.9 3 16.5 3ZM16.5 11.2V21"/>',
    menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
    news: '<rect x="3" y="5" width="13.5" height="14" rx="1.4"/><path d="M16.5 8.5H20a1 1 0 0 1 1 1v7.5a2 2 0 0 1-2 2"/><line x1="6" y1="9" x2="13" y2="9"/><line x1="6" y1="12.5" x2="13" y2="12.5"/><line x1="6" y1="16" x2="10" y2="16"/>',
    smile: '<circle cx="12" cy="12" r="8.4"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>',
    service: '<rect x="3.5" y="4" width="7" height="7" rx="1.2"/><rect x="13.5" y="4" width="7" height="7" rx="1.2"/><rect x="3.5" y="14" width="7" height="6" rx="1.2"/><rect x="13.5" y="14" width="7" height="6" rx="1.2"/>',
    paw: '<circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="7" r="1.7"/><circle cx="17" cy="9" r="1.6"/><path d="M8.5 14.5c1-1.6 2-2.4 3.5-2.4s2.5.8 3.5 2.4c1 1.6.4 3.4-1.4 3.6-1 .1-1.4-.4-2.1-.4s-1.1.5-2.1.4c-1.8-.2-2.4-2-1.4-3.6Z"/>'
  };
  return '<svg class="scm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[name] || I.shop) + '</svg>';
}
function _scmScrollTo(sel) { var e = document.querySelector(sel); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }

var _mallFilter = "all";        // all / new / locked / owned
var _scmHeroTimer = null;       // ヒーロー自動送りのタイマー

// ── モールへ入るときの読み込み画面 ────────────────────────────────
// ★なぜ要るか
//   モールは試着室の大きな立ち絵＋衣装カード37枚を一度に並べる。描画は
//   一瞬で終わるが画像は後から流れ込むので、入った直後は絵が虫食いのまま
//   になる（着替えビューアから入ると特に目立つ＝ユーザー指摘）。
//   主役の絵だけ先に読み終えてから見せる。カードは lazy のままでよい。
//
// ★止まらない作りにすること。読めない絵があっても必ず先へ進む
//   （上限時間で打ち切り／例外は握って通す）。レース側と同じ約束。
const MALL_LOAD_MIN_MS = 260;    // これ未満だと一瞬光って逆に目障り
const MALL_LOAD_MAX_MS = 2600;   // これを過ぎたら待たずに見せる
function showMallLoading(host, onReady) {
  let done = false;
  const go = () => {
    if (done) return; done = true;
    const w = host.querySelector(".mallload"); if (w) w.remove();
    try { onReady(); } catch (e) { /* 描画で落ちても画面は戻す */ }
  };
  try {
    const box = document.createElement("div");
    box.className = "mallload";
    box.innerHTML =
      '<div class="mallload-in">' +
        '<div class="mallload-ic">🛍️</div>' +
        '<div class="mallload-ttl">ショッピングモール</div>' +
        '<div class="mallload-bar"><i></i></div>' +
        '<div class="mallload-note">試着室を用意しています……</div>' +
      '</div>';
    host.appendChild(box);

    // 先に読むもの＝試着室に出る一枚と、その予備（表情違いで失敗したとき用）
    const sel = (typeof outfitById === "function")
      ? outfitById(state.ui.mallSel || (typeof currentOutfitId === "function" ? currentOutfitId() : null)) : null;
    const srcs = [];
    if (sel && typeof outfitImg === "function") {
      srcs.push(outfitImg(sel.id, (state.ui && state.ui.mallExpr) || "smile"));
      srcs.push(outfitImg(sel.id, "smile"));
    }
    const uniq = srcs.filter((s, i) => s && srcs.indexOf(s) === i);
    if (!uniq.length) { setTimeout(go, MALL_LOAD_MIN_MS); return; }

    let left = uniq.length;
    const one = () => { if (--left <= 0) setTimeout(go, MALL_LOAD_MIN_MS); };
    uniq.forEach(s => {
      const im = new Image();
      im.onload = one; im.onerror = one;     // 読めなくても数を減らす＝止まらない
      im.src = s;
      if (im.complete) one();                // 既に持っている絵は即座に消化
    });
    setTimeout(go, MALL_LOAD_MAX_MS);        // 保険：何があっても開く
  } catch (e) { go(); }
}

function renderMall() {
  if (typeof mallUnlocked === "function" && !mallUnlocked()) {
    renderHome();
    // ★ロック案内で章題（＝未登場の顧問名）は出さない。予告は「第N話を読むと開放」までに留める。
    // 解禁条件の文は chapterUnlockHint（data_assets.js・実績ゲートの正本）から引く＝化石テキスト防止。
    const _need = (typeof buniqroPrice === "function") ? buniqroPrice() : 2000;
    const _have = (state.player && state.player.maxCoinsReached) || 0;
    if (typeof showInfoPopup === "function") showInfoPopup("🛍️ ショッピングモール",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>服が一着買えるだけ稼ぐと開きます（${fmtCoins(_need)}／これまでの最高 ${fmtCoins(_have)}）。</small></div></div>`);
    return;
  }
  // ★読み込み画面はモールへ「入るとき」だけ。モールの中での再描画
  //   （表情切替・フィルタ・着替え）で毎回挟むと、かえって鬱陶しい。
  const entering = state.ui.screen !== "mall";
  state.ui.screen = "mall";
  if (entering) { showMallLoading(beginScreen(), _renderMallBody); return; }
  _renderMallBody();
}

function _renderMallBody() {
  if (window.Dialogue && Dialogue.dismiss) Dialogue.dismiss();
  // 初訪問＝サケの開店祝いVN（衣装ギフト）。ホームではVNを出さない鉄則のためここで再生（1回だけ）。
  if (typeof playMallIntroVN === "function" && !(state.player.flags || {}).mallIntroSeen) {
    setTimeout(() => { try { playMallIntroVN(); } catch (e) {} }, 500);
  }
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const app = beginScreen();                 // 上部にゲーム共通の「← ホーム」
  const scm = el("div", "scm");              // ライト・ポータル本体

  // ── ① ヘッダー（ロゴ＋線画アイコン） ──
  const head = el("div", "scm-head");
  head.innerHTML = `<div class="scm-logo"><small>せいりゅう ショッピングセンター</small><b>MIMI&nbsp;<span>MALL</span></b></div>`;
  const hic = el("div", "scm-headic");
  const sBtn = el("button", "scm-hbtn"); sBtn.innerHTML = _scmIcon("search"); sBtn.title = "さがす"; sBtn.onclick = () => _scmSearch();
  const cBtn = el("button", "scm-hbtn scm-hcoins"); cBtn.innerHTML = `${_scmIcon("clock")}<b>🪙${(typeof fmtCoins === "function") ? fmtCoins(state.player.coins || 0) : (state.player.coins || 0)}</b>`;
  cBtn.title = "おさいふ・モールの遊び方"; cBtn.onclick = () => _scmHelp();
  hic.appendChild(sBtn); hic.appendChild(cBtn);
  head.appendChild(hic);
  scm.appendChild(head);

  // ── ② ヒーロー・カルーセル（自動送り） ──
  scm.appendChild(_scmHero());

  // ── ③ アイコンメニュー（3列・線画） ──
  const cats = [
    { ic: "shop", lb: "ショップ", go: () => _scmScrollTo(".scm-shops") },
    { ic: "hanger", lb: "試着室", go: () => _scmScrollTo(".scm-fit") },
    { ic: "floor", lb: "フロアガイド", go: () => { if (typeof renderMallRpg === "function") renderMallRpg(); } },
    { ic: "tag", lb: "新着", go: () => { _mallFilter = "new"; renderMall(); setTimeout(() => _scmScrollTo(".scm-shops"), 30); } },
    { ic: "lock", lb: "特別な服", go: () => { _mallFilter = "locked"; renderMall(); setTimeout(() => _scmScrollTo(".scm-shops"), 30); } },
    { ic: "service", lb: "サービス", go: () => _scmScrollTo(".scm-service") }
  ];
  const grid = el("div", "scm-cats");
  cats.forEach(c => {
    const b = el("button", "scm-cat");
    b.innerHTML = `<span class="scm-cat-ic">${_scmIcon(c.ic)}</span><span class="scm-cat-lb">${c.lb}</span>`;
    b.onclick = c.go;
    grid.appendChild(b);
  });
  scm.appendChild(grid);

  scm.appendChild(_scmFitting());     // ④ 試着室
  scm.appendChild(_scmShops());       // ⑤ ショップ
  scm.appendChild(_scmService());     // ⑥ サービス・案内（オレンジ角丸ピル＝小ネタ）
  scm.appendChild(_scmSnsTab());      // SNS 縦タブ（右端）

  app.appendChild(scm);
  _scmBottomNav();                    // ⑦ 下部オレンジナビ＝body直下にfixedで設置（.scmのtransform外でfloatさせる・beginScreenで掃除）
}

// ヒーロー：横スクロール・カルーセル＋ドット＋自動送り（操作後はしばらく停止）。
function _scmHero() {
  const banners = [
    { cls: "b-adv", k: "🏬", t: "巨大モール大冒険", s: "1Fから屋上まで、冒険して衣装をGET", go: () => { if (typeof renderMallRpg === "function") renderMallRpg(); } },
    { cls: "b-new", k: "✨", t: "新作コーデ、入荷中", s: "きょうの気分の一着を見つけよう", go: () => { _mallFilter = "new"; renderMall(); setTimeout(() => _scmScrollTo(".scm-shops"), 30); } },
    { cls: "b-vip", k: "👑", t: "特別な一着", s: "総資産で解放される、名品コーデも", go: () => { _mallFilter = "locked"; renderMall(); setTimeout(() => _scmScrollTo(".scm-shops"), 30); } }
  ];
  const wrap = el("div", "scm-hero");
  const track = el("div", "scm-hero-track");
  banners.forEach(b => {
    const card = el("button", "scm-banner " + b.cls);
    card.innerHTML = `<span class="scm-banner-k">${b.k}</span><span class="scm-banner-tx"><b>${b.t}</b><small>${b.s}</small></span><span class="scm-banner-go">▶</span>`;
    card.onclick = b.go;
    track.appendChild(card);
  });
  wrap.appendChild(track);
  const dots = el("div", "scm-dots");
  banners.forEach((_, i) => { const d = el("span", "scm-dot" + (i === 0 ? " on" : "")); dots.appendChild(d); });
  wrap.appendChild(dots);
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    [].forEach.call(dots.children, (d, j) => d.classList.toggle("on", j === i));
  });
  // 自動送り（4秒ごと・操作後6秒は休む・要素が消えたら自停止）。
  if (_scmHeroTimer) { clearInterval(_scmHeroTimer); _scmHeroTimer = null; }
  let _lastTouch = 0;
  const _bump = () => { try { _lastTouch = (window.performance && performance.now) ? performance.now() : 0; } catch (e) { _lastTouch = 0; } };
  track.addEventListener("pointerdown", _bump);
  _scmHeroTimer = setInterval(() => {
    if (!document.body.contains(track)) { clearInterval(_scmHeroTimer); _scmHeroTimer = null; return; }
    const now = (window.performance && performance.now) ? performance.now() : (_lastTouch + 99999);
    if (now - _lastTouch < 6000) return;
    const i = (Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) + 1) % banners.length;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }, 4000);
  return wrap;
}

// 試着室：選択中の衣装を大きく＋表情切替＋情報＋CTA。
function _scmFitting() {
  const worn = currentOutfitId();
  if (!state.ui.mallSel || !OUTFITS.some(o => o.id === state.ui.mallSel)) state.ui.mallSel = worn;
  if (!state.ui.mallExpr) state.ui.mallExpr = "smile";
  const sel = outfitById(state.ui.mallSel);
  const owned = outfitOwned(sel);
  const isWorn = sel.id === worn;

  const sec = el("div", "scm-fit");
  sec.appendChild(_scmSecTitle("試着室", "FITTING ROOM"));
  const card = el("div", "scm-fit-card");
  const stage = el("div", "scm-fit-stage");
  const img = el("div", "scm-fit-img" + (owned ? "" : " silhouette"));
  const _src = outfitImg(sel.id, state.ui.mallExpr), _fb = outfitImg(sel.id, "smile");
  img.innerHTML =
    `<img alt="${sel.name}" src="${_src}" onerror="this.onerror=null;this.src='${_fb}'">` +
    (isWorn ? `<span class="scm-badge worn">着用中</span>` : (owned ? `<span class="scm-badge owned">所持</span>` : `<span class="scm-badge lock">🔒</span>`)) +
    (owned ? "" : `<span class="scm-silq">？</span>`);
  stage.appendChild(img);
  const seg = el("div", "scm-expr");
  [["default", "🙂"], ["smile", "😊"], ["happy", "🌟"], ["panic", "💦"]].forEach(([k, lb]) => {
    const b = el("button", "scm-expr-b" + (state.ui.mallExpr === k ? " on" : ""), lb);
    b.onclick = () => { state.ui.mallExpr = k; renderMall(); setTimeout(() => _scmScrollTo(".scm-fit"), 20); };
    seg.appendChild(b);
  });
  stage.appendChild(seg);
  card.appendChild(stage);

  const info = el("div", "scm-fit-info");
  let acq;
  if (sel.acquire.free) acq = "いつでも着られる基本衣装";
  else if (sel.acquire.price != null) acq = owned ? "購入済み" : `価格 <b>${fmtCoins(sel.acquire.price)}</b>`;
  else if (sel.acquire.assets != null) acq = owned ? "解放済み" : `総資産 <b>${fmtCoins(sel.acquire.assets)}</b> で解放`;
  else acq = "";
  info.innerHTML = `<div class="scm-fit-nm">${sel.name}</div><div class="scm-fit-fl">${sel.flavor}</div><div class="scm-fit-acq">${acq}</div>`;
  const cta = el("div", "scm-fit-cta");
  if (isWorn) {
    cta.appendChild(el("div", "scm-worn", "✓ いま着ています"));
    const hb = el("button", "scm-btn ghost", "🏠 ホームで見る"); hb.onclick = () => renderHome();
    cta.appendChild(hb);
  } else if (owned) {
    const wb = el("button", "scm-btn primary", "この服に着替える");
    wb.onclick = () => { wearOutfit(sel.id); if (window.Sfx) Sfx.play("click"); if (window.Dialogue && window.DLG) Dialogue.play(DLG.outfit(sel)); renderMall(); };
    cta.appendChild(wb);
  } else if (sel.acquire.price != null) {
    const poor = (state.player.coins || 0) < sel.acquire.price;
    const bb = el("button", "scm-btn primary" + (poor ? " poor" : ""), `🛒 ${fmtCoins(sel.acquire.price)} で購入`);
    bb.onclick = () => {
      const r = buyOutfit(sel.id);
      if (r.ok) { wearOutfit(sel.id); if (window.Sfx) Sfx.play("coin"); if (window.Dialogue && window.DLG) Dialogue.play(DLG.outfit(sel)); renderMall(); }
      else if (r.reason === "poor") alert("コインが足りません。");
    };
    cta.appendChild(bb);
  } else if (sel.acquire.assets != null) {
    cta.appendChild(el("div", "scm-lockmsg", `🔒 総資産 ${fmtCoins(sel.acquire.assets)} で解放`));
  }
  info.appendChild(cta);
  card.appendChild(info);
  sec.appendChild(card);
  return sec;
}

// ショップ：衣装を画像カードで一覧（フィルタチップつき）。
function _scmShops() {
  const sec = el("div", "scm-shops");
  sec.appendChild(_scmSecTitle(_mallFilter === "new" ? "新着" : _mallFilter === "locked" ? "特別な服" : _mallFilter === "owned" ? "持っている服" : "ショップ", "SHOP"));
  const chips = el("div", "scm-filter");
  [["all", "すべて"], ["new", "新着"], ["owned", "所持"], ["locked", "特別"]].forEach(([k, lb]) => {
    const c = el("button", "scm-chip" + (_mallFilter === k ? " on" : ""), lb);
    c.onclick = () => { _mallFilter = k; renderMall(); setTimeout(() => _scmScrollTo(".scm-shops"), 20); };
    chips.appendChild(c);
  });
  sec.appendChild(chips);

  const worn = currentOutfitId();
  let list = OUTFITS.slice();
  if (_mallFilter === "new") list = list.slice().reverse();
  else if (_mallFilter === "owned") list = list.filter(o => outfitOwned(o));
  else if (_mallFilter === "locked") list = list.filter(o => o.acquire && o.acquire.assets != null);

  const grid = el("div", "scm-grid");
  list.forEach(o => {
    const oOwned = outfitOwned(o);
    const oWorn = o.id === worn;
    const card = el("button", "scm-card" + (oWorn ? " worn" : "") + (oOwned ? "" : " locked") + (o.id === state.ui.mallSel ? " sel" : ""));
    let chip = "";
    if (oWorn) chip = `<span class="scm-cardchip worn">着用中</span>`;
    else if (oOwned) chip = `<span class="scm-cardchip owned">所持</span>`;
    else if (o.acquire.price != null) chip = `<span class="scm-cardchip price">🪙${fmtCoins(o.acquire.price)}</span>`;
    else if (o.acquire.assets != null) chip = `<span class="scm-cardchip lock">🔒</span>`;
    card.innerHTML =
      `<div class="scm-card-img${oOwned ? "" : " silhouette"}"><img alt="${o.name}" src="${outfitImg(o.id, "default")}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">${chip}</div>` +
      `<div class="scm-card-nm">${o.name}</div>`;
    card.onclick = () => { state.ui.mallSel = o.id; if (window.Sfx) Sfx.play("click"); renderMall(); setTimeout(() => _scmScrollTo(".scm-fit"), 30); };
    grid.appendChild(card);
  });
  if (!list.length) grid.appendChild(el("div", "scm-empty", "該当する服がありません。"));
  sec.appendChild(grid);
  return sec;
}

// サービス・案内：オレンジ角丸ピル（押せる小ネタ）。
function _scmService() {
  const sec = el("div", "scm-service");
  sec.appendChild(_scmServiceTitle());
  const items = [
    { ic: "clock", t: "営業時間・定休日のご案内", go: () => _scmInfo("🕐 営業時間", `<div class="mm-row"><span class="mm-ic">⏰</span><div><b>10:00〜25:00（ミミが起きてる間）</b><small>定休日：なし。配信のない夜もこっそり開いてます。</small></div></div>`) },
    { ic: "service", t: "各種サービスのご案内", go: () => _scmInfo("🛎 サービス", `<div class="mm-row"><span class="mm-ic">👗</span><div><b>無料の試着・お着替え</b><small>所持している服はいつでも切替OK。何度でも無料。</small></div></div><div class="mm-row"><span class="mm-ic">🎁</span><div><b>ラッピング</b><small>……は、ありません。ぜんぶ自分で着ます！</small></div></div>`) },
    // ★門番：ポロは発見（単勝2勝目）まで名前も「泣き虫」も出さない＝出会う前に命名オチを潰さない。fail-closed。
    { ic: "smile", t: "お子さま連れのお客さま", go: () => _scmInfo("😊 お子さま連れ",
        ((typeof poroFound === "function" && poroFound())
          ? `<div class="mm-row"><span class="mm-ic">🐉</span><div><b>泣き虫竜ポロも大歓迎</b><small>はぐれたら、たぶん試着室で泣いてます。</small></div></div>`
          : `<div class="mm-row"><span class="mm-ic">🐉</span><div><b>仔竜連れ、大歓迎です</b><small>はぐれたら、たぶん試着室で泣いてます。</small></div></div>`)) },
    { ic: "search", t: "館内のおとしもの", go: () => _scmInfo("🔍 おとしもの", `<div class="mm-row"><span class="mm-ic">🎫</span><div><b>外れ馬券、たくさん届いてます</b><small>心当たりのある方は……まあ、そっとしておきましょう。</small></div></div>`) },
    { ic: "paw", t: "ペット同伴のお客さま", go: () => _scmInfo("🐾 ペット同伴", `<div class="mm-row"><span class="mm-ic">🐲</span><div><b>竜の同伴、歓迎です</b><small>大きい子は屋上の「大冒険」フロアへどうぞ。</small></div></div>`) },
    { ic: "news", t: "スタッフ募集", go: () => _scmInfo("📣 スタッフ募集", `<div class="mm-row"><span class="mm-ic">🐰</span><div><b>ただいま募集はしておりません</b><small>店員はミミ一人。今日も元気に営業中！</small></div></div>`) }
  ];
  const list = el("div", "scm-pills");
  items.forEach(it => {
    const b = el("button", "scm-pill");
    b.innerHTML = `<span class="scm-pill-ic">${_scmIcon(it.ic)}</span><span class="scm-pill-t">${it.t}</span><span class="scm-pill-go">⌄</span>`;
    b.onclick = it.go;
    list.appendChild(b);
  });
  sec.appendChild(list);
  return sec;
}
function _scmServiceTitle() {
  const t = el("div", "scm-bigtitle");
  t.innerHTML = `<b><span>S</span>ERVICE</b><small>施設案内</small>`;
  return t;
}

// 下部オレンジナビ（中央にMENU・参考サイト準拠）。
function _scmBottomNav() {
  const nav = el("div", "scm-bnav");
  const mk = (ic, lb, go, mid) => {
    const b = el("button", "scm-bnav-b" + (mid ? " mid" : ""));
    b.innerHTML = mid ? `<span class="scm-bnav-mid">${_scmIcon("menu")}</span><span class="scm-bnav-lb">MENU</span>`
      : `<span class="scm-bnav-ic">${_scmIcon(ic)}</span><span class="scm-bnav-lb">${lb}</span>`;
    b.onclick = go;
    return b;
  };
  nav.appendChild(mk("dine", "ショップ&グルメ", () => _scmScrollTo(".scm-shops")));
  nav.appendChild(mk("floor", "フロアガイド", () => { if (typeof renderMallRpg === "function") renderMallRpg(); }));
  nav.appendChild(mk(null, "MENU", () => _scmScrollTo(".scm-head") || window.scrollTo({ top: 0, behavior: "smooth" }), true));
  nav.appendChild(mk("flag", "イベント", () => _scmScrollTo(".scm-hero")));
  nav.appendChild(mk("news", "ショップニュース", () => _scmNews()));
  var old = document.getElementById("scm-bnav-host"); if (old) old.remove();
  nav.id = "scm-bnav-host";
  document.body.appendChild(nav);   // body直下＝.scmのtransformの影響を受けず viewport基準でfloat
}
function _scmSnsTab() {
  const t = el("button", "scm-snstab", "S<br>N<br>S");
  t.title = "SNSを見る";
  t.onclick = () => { if (typeof renderSns === "function") renderSns(); };
  return t;
}

function _scmSecTitle(jp, en) { const t = el("div", "scm-sectitle"); t.innerHTML = `<b>${jp}</b><small>${en}</small>`; return t; }

// さがす（衣装名でしぼり込み）。
function _scmSearch() {
  const q = (typeof prompt === "function") ? prompt("衣装名で検索（一部でOK）") : "";
  if (q == null) return;
  const key = String(q).trim();
  if (!key) { _mallFilter = "all"; renderMall(); return; }
  const hit = OUTFITS.find(o => o.name.indexOf(key) >= 0);
  if (hit) { state.ui.mallSel = hit.id; _mallFilter = "all"; renderMall(); setTimeout(() => _scmScrollTo(".scm-fit"), 30); }
  else _scmInfo("🔍 検索", `<div class="mm-row"><span class="mm-ic">😅</span><div><b>「${key}」は見つかりませんでした</b><small>別のキーワードでどうぞ。</small></div></div>`);
}
function _scmNews() {
  const newest = OUTFITS.slice(-4).reverse();
  const rows = newest.map(o => `<div class="mm-row"><span class="mm-ic">🆕</span><div><b>${o.name}</b><small>${o.flavor}</small></div></div>`).join("");
  _scmInfo("📰 ショップニュース", rows + `<div class="mm-row"><span class="mm-ic">🛍️</span><div><b>新作、続々入荷中！</b><small>「新着」フィルタからどうぞ。</small></div></div>`);
}
function _scmInfo(title, html) { if (typeof showInfoPopup === "function") showInfoPopup(title, html); }
function _scmHelp() {
  _scmInfo("🛍️ MIMI MALL の遊び方",
    `<div class="mm-row"><span class="mm-ic">🪙</span><div><b>おさいふ ${fmtCoins(state.player.coins || 0)}</b><small>服はコインで購入。着替えは何度でも無料。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">👤</span><div><b>未購入はシルエット</b><small>買うと姿が見られる。集める楽しみ！</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏬</span><div><b>フロアガイド＝巨大モール大冒険</b><small>1Fから屋上まで冒険して衣装GET。お土産は所持コインで買えます。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏁</span><div><b>レースには影響しません</b><small>見た目だけのお楽しみ（着順・配当は不変）。</small></div></div>`);
}
