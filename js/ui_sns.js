// =========================================================================
// ui_sns.js — ミミのSNS「Pyogram」＝Instagram風に忠実（写真主体）。js/sns.js のデータを表示。
// =========================================================================
// 3セクション：🏠フィード（ストーリーズ＋写真フィード）／👤プロフィール（3カラムグリッド）／💬DM（ファンレター）。
// 日替わりで遊べる要素はInstagramの文法に載せ替え：
//   ・ストーリーズ … ミミのストーリー＝その日の「お題（投票スティッカー）」。
//   ・フィード     … 日替わりの写真投稿。ダブルタップ/♡でいいね、💬でコメント（選択肢→返信）。
//   ・自分で投稿   … カメラロールから写真＋キャプション→プロフィールのグリッドに増え、いいねが伸びてバズる。
//   ・連続ログイン … プロフィールのハイライト＋バッジ（コスメ・コイン非干渉）。
// 完全に表示専用メタ（[[race-math-immutable]]）。ホームのナビ「📱 SNS」1枠から開く。
// =========================================================================

let _snsTab = "feed";

function renderSns(tab) {
  if (tab) _snsTab = ({ timeline: "feed", home: "feed", fanletters: "dm", letters: "dm", profile: "profile" }[tab]) || tab;
  if (["feed", "profile", "dm"].indexOf(_snsTab) < 0) _snsTab = "feed";
  state.ui.screen = "sns";
  const app = beginScreen();
  const ig = el("div", "ig-app");

  // 連続ログイン（その日はじめて開いた時のチェックイン）
  const ci = (typeof snsCheckin === "function") ? snsCheckin() : { streak: 0, isNew: false };

  // 上：ブランドバー（Pyogramロゴ）
  const top = el("div", "ig-topbar");
  top.innerHTML = `<span class="ig-logo">Pyogram</span>`;
  const dmBtn = el("button", "ig-top-dm");
  const unread = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
  dmBtn.innerHTML = `✉️${unread ? `<span class="ig-dmbadge">${unread}</span>` : ""}`;
  dmBtn.onclick = () => { _snsTab = "dm"; renderSns(); };
  top.appendChild(dmBtn);
  ig.appendChild(top);

  const body = el("div", "ig-body");
  if (_snsTab === "profile") _igProfile(body, ci);
  else if (_snsTab === "dm") _igDM(body);
  else _igFeed(body, ci);
  ig.appendChild(body);

  // 下：ナビ（ホーム/プロフィール/DM）
  const nav = el("div", "ig-nav");
  const mkNav = (id, on, label) => {
    const b = el("button", "ig-nav-b" + (id === _snsTab ? " on" : ""));
    b.innerHTML = `<span class="ig-nav-ic">${on}</span><span class="ig-nav-lb">${label}</span>`;
    b.onclick = () => { _snsTab = id; renderSns(); };
    return b;
  };
  nav.appendChild(mkNav("feed", "🏠", "フィード"));
  nav.appendChild(mkNav("profile", "👤", "プロフィール"));
  const dn = mkNav("dm", "✉️", "メッセージ");
  if (unread) { const d = el("span", "ig-nav-dot"); dn.appendChild(d); }
  nav.appendChild(dn);
  ig.appendChild(nav);

  app.appendChild(ig);
  // M2：一日の締め（SNS→ホームへ）。docs/GAME_EXPERIENCE_DESIGN §3。IG風画面に明示的な戻りが
  // 無いので、ループ結線と「配信を閉じる」出口を兼ねる。
  try { const _nx = (typeof nextSuggestRow === "function") && nextSuggestRow("sns"); if (_nx) app.appendChild(_nx); } catch (e) {}
}

// =========================== 🏠 フィード ===========================
function _igFeed(body, ci) {
  // ストーリーズ
  body.appendChild(_igStories(ci));
  // フィード投稿
  const posts = (typeof timelinePosts === "function") ? timelinePosts() : [];
  posts.forEach(po => body.appendChild(_igPost(po)));
  if (!posts.length) body.appendChild(el("div", "ig-empty", "まだ投稿がありません。"));
}

function _igStories(ci) {
  const row = el("div", "ig-stories");
  // あなた（投稿する）
  const you = el("button", "ig-story");
  you.innerHTML = `<span class="ig-story-ring you"><span class="ig-story-av">🐰</span><span class="ig-story-plus">＋</span></span><span class="ig-story-nm">あなた</span>`;
  you.onclick = () => _igCompose();
  row.appendChild(you);
  // ミミのストーリー＝きょうのお題（投票）
  const poll = (typeof todayPoll === "function") ? todayPoll() : null;
  if (poll) {
    const voted = (typeof pollVoted === "function") ? (pollVoted(poll) != null) : false;
    const st = el("button", "ig-story");
    st.innerHTML = `<span class="ig-story-ring${voted ? " seen" : ""}"><span class="ig-story-av">📊</span></span><span class="ig-story-nm">きょうのお題</span>`;
    st.onclick = () => _igStoryPoll(poll);
    row.appendChild(st);
  }
  // NPCのストーリー（軽い・タップで画像＋ひとこと）
  const npc = [
    { ic: "🐰", nm: "mimi", h: "@mimi_yosou", t: "きょうも配信するよ〜！見にきてね🐰" },
    { ic: "🔥", nm: "推し竜", h: "@oshi_dragon", t: "本命は決めた。…当たるとは言ってない。" },
    { ic: "🐉", nm: "ポロ", h: "@poro_naki", t: "おねえちゃん、きょうもみにきたよ。ぐすっ" },
    { ic: "🎤", nm: "マクラ", h: "@makura_live", t: "さあ今日も竜が駆ける——！🐉🔥" }
  ];
  npc.forEach((n, i) => {
    const st = el("button", "ig-story");
    st.innerHTML = `<span class="ig-story-ring"><span class="ig-story-av">${n.ic}</span></span><span class="ig-story-nm">${n.nm}</span>`;
    st.onclick = () => _igStorySimple(n);
    row.appendChild(st);
  });
  return row;
}

function _igPost(po) {
  const card = el("div", "ig-post");
  const txt = (typeof _snsText === "function") ? _snsText(po.text) : (typeof po.text === "function" ? po.text() : po.text);
  const img = (typeof _snsPostImg === "function") ? _snsPostImg(po) : "";
  const liked = (typeof postLiked === "function") ? postLiked(po.id) : false;
  const replied = (typeof postReplied === "function") ? postReplied(po.id) : null;

  card.innerHTML =
    `<div class="ig-post-head">` +
      `<span class="ig-post-av">${po.ic}</span>` +
      `<span class="ig-post-who"><b>${(po.handle || "").replace(/^@/, "")}</b>${po.ago ? `<small>${po.ago}</small>` : ""}</span>` +
      `<span class="ig-post-more">⋯</span>` +
    `</div>` +
    `<div class="ig-post-imgwrap"><img class="ig-post-img" src="${img}" alt="" loading="lazy" decoding="async"><span class="ig-heart-burst">🤍</span></div>` +
    `<div class="ig-post-actions"><span class="ig-act-left"><button class="ig-like${liked ? " on" : ""}">${liked ? "❤️" : "🤍"}</button><button class="ig-comment">💬</button><button class="ig-share">✈️</button></span><button class="ig-save">🔖</button></div>` +
    `<div class="ig-likes"><b>${(typeof postLikeCount === "function" ? postLikeCount(po) : (po.base || 0)).toLocaleString()}</b> 件のいいね！</div>` +
    `<div class="ig-cap"><b>${(po.handle || "").replace(/^@/, "")}</b> ${txt}</div>` +
    `<div class="ig-comline"></div>` +
    `<div class="ig-post-time">${po.ago || "今日"}</div>`;

  // いいね（♡ボタン＋写真ダブルタップ）
  const likeBtn = card.querySelector(".ig-like");
  const imgEl = card.querySelector(".ig-post-img");
  const burst = card.querySelector(".ig-heart-burst");
  const paintLike = () => {
    const lk = postLiked(po.id);
    likeBtn.textContent = lk ? "❤️" : "🤍"; likeBtn.classList.toggle("on", lk);
    card.querySelector(".ig-likes b").textContent = (typeof postLikeCount === "function" ? postLikeCount(po) : 0).toLocaleString();
  };
  likeBtn.onclick = () => { if (typeof likePost === "function") likePost(po.id); if (window.Sfx) Sfx.play("tick"); paintLike(); };
  let _lastTap = 0;
  imgEl.onclick = () => {
    const now = (window.performance && performance.now) ? performance.now() : 0;
    if (now - _lastTap < 320) {  // ダブルタップ＝いいね
      if (!postLiked(po.id) && typeof likePost === "function") { likePost(po.id); paintLike(); if (window.Sfx) Sfx.play("coin"); }
      burst.textContent = "❤️"; burst.classList.remove("go"); void burst.offsetWidth; burst.classList.add("go");
    }
    _lastTap = now;
  };
  // コメント行
  const comline = card.querySelector(".ig-comline");
  const paintComments = () => {
    comline.innerHTML = "";
    if (po.replies && po.replies.length) {
      const r2 = postReplied(po.id);
      if (r2 == null) {
        const a = el("button", "ig-comlink", "コメントする…");
        a.onclick = () => _igComments(po, card);
        comline.appendChild(a);
      } else {
        const r = po.replies[r2];
        comline.innerHTML = `<div class="ig-com"><b>${(po.handle || "").replace(/^@/, "")}</b> ${r.back}</div><div class="ig-com mine"><b>あなた</b> ${r.choice}</div>`;
        const a = el("button", "ig-comlink", "コメントを見る");
        a.onclick = () => _igComments(po, card);
        comline.appendChild(a);
      }
    }
  };
  paintComments();
  card.querySelector(".ig-comment").onclick = () => _igComments(po, card);
  return card;
}

// コメント（IGのコメント欄風モーダル：相手の本文＋あなたの選べる返信）。
function _igComments(po, card) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop ig-comments");
  const txt = (typeof _snsText === "function") ? _snsText(po.text) : po.text;
  const render = () => {
    const replied = (typeof postReplied === "function") ? postReplied(po.id) : null;
    box.innerHTML = `<div class="ig-cm-head"><span class="ig-post-av">${po.ic}</span><div><b>${(po.handle || "").replace(/^@/, "")}</b><div class="ig-cm-cap">${txt}</div></div></div>`;
    const list = el("div", "ig-cm-list");
    if (replied != null) {
      const r = po.replies[replied];
      list.innerHTML = `<div class="ig-cm-row mine"><span class="ig-post-av sm">🐰</span><div><b>あなた</b> ${r.choice}</div></div>` +
        `<div class="ig-cm-row"><span class="ig-post-av sm">${po.ic}</span><div><b>${(po.handle || "").replace(/^@/, "")}</b> ${r.back}</div></div>`;
      box.appendChild(list);
      const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => { ov.remove(); if (card) _igRefreshPost(po, card); }; btns.appendChild(ok); box.appendChild(btns);
    } else {
      box.appendChild(list);
      box.appendChild(el("div", "ig-cm-pick-lb", "コメントを選ぶ"));
      const pick = el("div", "ig-cm-picks");
      (po.replies || []).forEach((r, i) => {
        const b = el("button", "ig-cm-pick", r.choice);
        b.onclick = () => { if (typeof replyPost === "function") replyPost(po.id, i); if (window.Sfx) Sfx.play("coin"); render(); };
        pick.appendChild(b);
      });
      box.appendChild(pick);
      const btns = el("div", "navpop-btns"); const c = el("button", "navpop-cancel", "やめる"); c.onclick = () => ov.remove(); btns.appendChild(c); box.appendChild(btns);
    }
  };
  render();
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) { ov.remove(); if (card) _igRefreshPost(po, card); } };
  document.body.appendChild(ov);
}
function _igRefreshPost(po, card) { const nu = _igPost(po); card.replaceWith(nu); }

// ストーリー：お題（投票スティッカー）。
function _igStoryPoll(poll) {
  const ov = el("div", "ig-story-ov");
  const box = el("div", "ig-story-card");
  const render = () => {
    const voted = (typeof pollVoted === "function") ? pollVoted(poll) : null;
    box.innerHTML = `<div class="ig-st-bar"><i></i></div>` +
      `<div class="ig-st-head"><span class="ig-story-av sm">📊</span><b>きょうのお題</b><button class="ig-st-x">✕</button></div>`;
    const sticker = el("div", "ig-st-sticker");
    sticker.innerHTML = `<div class="ig-st-q">${poll.q}</div>`;
    const opts = el("div", "ig-st-opts");
    if (voted == null) {
      poll.options.forEach((o, i) => {
        const b = el("button", "ig-st-opt", o.t);
        b.onclick = () => { if (typeof votePoll === "function") votePoll(poll, i); if (window.Sfx) Sfx.play("tick"); render(); };
        opts.appendChild(b);
      });
    } else {
      const res = (typeof pollResults === "function") ? pollResults(poll) : poll.options.map(() => 0);
      poll.options.forEach((o, i) => {
        const r = el("div", "ig-st-res" + (i === voted ? " mine" : ""));
        r.innerHTML = `<i style="width:${res[i]}%"></i><span class="ig-st-rt">${o.t}${i === voted ? " ✓" : ""}</span><span class="ig-st-rp">${res[i]}%</span>`;
        opts.appendChild(r);
      });
    }
    sticker.appendChild(opts);
    if (voted != null) sticker.appendChild(el("div", "ig-st-note", "みんなの回答。明日はちがうお題だよ。"));
    box.appendChild(sticker);
    box.querySelector(".ig-st-x").onclick = () => ov.remove();
  };
  render();
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
// ストーリー：NPCの軽いやつ（画像＋ひとこと）。
function _igStorySimple(n) {
  const ov = el("div", "ig-story-ov");
  const box = el("div", "ig-story-card");
  const img = (typeof _snsPostImg === "function") ? _snsPostImg({ handle: n.h, id: n.h }) : "";
  box.innerHTML = `<div class="ig-st-bar"><i></i></div>` +
    `<div class="ig-st-head"><span class="ig-story-av sm">${n.ic}</span><b>${(n.h || "").replace(/^@/, "")}</b><button class="ig-st-x">✕</button></div>` +
    `<div class="ig-st-photo" style="background-image:url('${img}')"></div>` +
    `<div class="ig-st-cap">${n.t}</div>`;
  box.querySelector(".ig-st-x").onclick = () => ov.remove();
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

// 投稿する（カメラロール→写真選択＋キャプション）。
function _igCompose() {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop ig-compose");
  let picked = 0;
  const cam = (typeof SNS_CAMERA !== "undefined") ? SNS_CAMERA : [];
  box.innerHTML = `<div class="navpop-t">新しい投稿</div>`;
  const prev = el("div", "ig-cp-prev");
  const ta = el("textarea", "ig-cp-cap"); ta.setAttribute("maxlength", "140"); ta.setAttribute("placeholder", "キャプションを書く…");
  const roll = el("div", "ig-cp-roll");
  const paint = () => {
    prev.style.backgroundImage = cam[picked] ? `url('${cam[picked].img}')` : "none";
    [].forEach.call(roll.children, (c, i) => c.classList.toggle("on", i === picked));
  };
  cam.forEach((c, i) => {
    const t = el("button", "ig-cp-thumb"); t.style.backgroundImage = `url('${c.img}')`;
    t.onclick = () => { picked = i; if (!ta.value.trim()) ta.value = c.cap; paint(); };
    roll.appendChild(t);
  });
  box.appendChild(prev);
  box.appendChild(el("div", "ig-cp-rolllabel", "カメラロール（写真を選ぶ）"));
  box.appendChild(roll);
  box.appendChild(ta);
  const btns = el("div", "navpop-btns");
  const post = el("button", "navpop-go", "シェアする");
  post.onclick = () => {
    const cap = ta.value.trim() || (cam[picked] ? cam[picked].cap : "📷");
    if (typeof addMyPost === "function") addMyPost(cap, cam[picked] ? cam[picked].img : null);
    if (window.Sfx) Sfx.play("bigwin");
    ov.remove(); _snsTab = "profile"; renderSns();
    _snsToast("シェアしたよ！ いいね、増えるかな…？🐰");
  };
  const cancel = el("button", "navpop-cancel", "やめる"); cancel.onclick = () => ov.remove();
  btns.appendChild(post); btns.appendChild(cancel); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  if (cam[0]) ta.value = cam[0].cap;
  paint();
}
function _snsToast(msg) {
  const t = el("div", "sns-toast", msg); document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1900);
}

// =========================== 👤 プロフィール ===========================
function _igProfile(body, ci) {
  const followers = (typeof _snsFollowers === "function") ? _snsFollowers() : 0;
  const mine = (typeof myPosts === "function") ? myPosts() : [];
  const streak = (ci && ci.streak) || (snsData ? snsData().checkin.streak : 0) || 0;
  const badge = (typeof snsStreakBadge === "function") ? snsStreakBadge(streak) : { e: "🌱", t: "" };
  // グリッドに出す画像：自分の投稿＋日替わり/マイルストーンの写真。
  const tl = (typeof timelinePosts === "function") ? timelinePosts() : [];
  const gridItems = mine.map(p => ({ img: p.img, my: true, post: p }))
    .concat(tl.map(po => ({ img: (typeof _snsPostImg === "function") ? _snsPostImg(po) : "", po: po })));
  const postCount = mine.length;

  const head = el("div", "ig-prof-head");
  head.innerHTML =
    `<span class="ig-prof-ring"><span class="ig-prof-av">🐰</span></span>` +
    `<div class="ig-prof-stats">` +
      `<span class="ig-prof-stat"><b>${postCount}</b><small>投稿</small></span>` +
      `<span class="ig-prof-stat"><b>${_igNum(followers)}</b><small>フォロワー</small></span>` +
      `<span class="ig-prof-stat"><b>${42 + (typeof _snsRank === "function" ? _snsRank() : 1) * 3}</b><small>フォロー中</small></span>` +
    `</div>`;
  body.appendChild(head);

  const info = el("div", "ig-prof-info");
  info.innerHTML = `<div class="ig-prof-name">予想家ミミ <span class="ig-verif">✔</span></div>` +
    `<div class="ig-prof-cat">予想家・配信者</div>` +
    `<div class="ig-prof-bio">バニーガール予想家🐰 竜とみんなを応援してます。ぱほぱほ〜♪<br>🏁 きょうも当てにいく</div>`;
  body.appendChild(info);

  const acts = el("div", "ig-prof-btns");
  const edit = el("button", "ig-prof-btn", "プロフィールを編集");
  edit.onclick = () => _snsToast("（プロフィールは自動でみんなの応援を反映してるよ🐰）");
  const share = el("button", "ig-prof-btn", "シェア");
  share.onclick = () => { if (typeof shareGameInfo === "function") shareGameInfo(); };
  const add = el("button", "ig-prof-btn add", "＋");
  add.onclick = () => _igCompose();
  acts.appendChild(edit); acts.appendChild(share); acts.appendChild(add);
  body.appendChild(acts);

  // ハイライト（連続ログイン＋固定）
  const hi = el("div", "ig-highlights");
  const mkHi = (e, lb) => `<span class="ig-hi"><span class="ig-hi-c">${e}</span><span class="ig-hi-lb">${lb}</span></span>`;
  hi.innerHTML = mkHi(badge.e, `${streak}日連続`) + mkHi("🏆", "名場面") + mkHi("🐉", "推し竜") + mkHi("🍢", "グルメ");
  body.appendChild(hi);

  // タブ（グリッド）
  const gtab = el("div", "ig-gridtab");
  gtab.innerHTML = `<span class="on">▦</span><span>🏷</span>`;
  body.appendChild(gtab);

  // 3カラムグリッド
  const grid = el("div", "ig-grid");
  gridItems.forEach(it => {
    const cell = el("button", "ig-cell");
    cell.style.backgroundImage = it.img ? `url('${it.img}')` : "none";
    if (it.my) cell.appendChild(el("span", "ig-cell-mine", "🐰"));
    cell.onclick = () => it.my ? _igMyPostDetail(it.post) : _igPostDetailFromTL(it.po);
    grid.appendChild(cell);
  });
  if (!gridItems.length) grid.appendChild(el("div", "ig-empty", "まだ投稿がありません。＋から投稿しよう！"));
  body.appendChild(grid);
}
function _igNum(n) { return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + "万" : n.toLocaleString(); }

// グリッドのタップ：自分の投稿の詳細（いいね数＝バズ）。
function _igMyPostDetail(p) {
  const reacts = (typeof myPostReacts === "function") ? myPostReacts(p) : 0;
  const buzz = (typeof myPostBuzzing === "function") ? myPostBuzzing(p) : false;
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop ig-detail");
  box.innerHTML =
    `<div class="ig-post-head"><span class="ig-post-av">🐰</span><span class="ig-post-who"><b>mimi_yosou</b></span>${buzz ? `<span class="ig-buzz">🔥バズ中</span>` : ""}</div>` +
    `<div class="ig-post-imgwrap"><img class="ig-post-img" src="${p.img || ""}" alt=""></div>` +
    `<div class="ig-likes"><b>${reacts.toLocaleString()}</b> 件のいいね！</div>` +
    `<div class="ig-cap"><b>mimi_yosou</b> ${String(p.text).replace(/</g, "&lt;")}</div>`;
  const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => ov.remove(); btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
function _igPostDetailFromTL(po) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop ig-detail");
  box.appendChild(_igPost(po));
  const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => ov.remove(); btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

// =========================== 💬 DM（ファンレター） ===========================
function _igDM(body) {
  const ls = (typeof fanLetters === "function") ? fanLetters() : [];
  const unread = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
  body.appendChild(el("div", "ig-dm-head", `メッセージ${unread ? `・未読 ${unread}` : ""}`));
  const box = el("div", "ig-dm-list");
  ls.forEach(l => {
    const read = letterRead(l.id);
    const row = el("button", "ig-dm-row" + (read ? "" : " unread"));
    row.innerHTML =
      `<span class="ig-dm-av">${l.ic}</span>` +
      `<span class="ig-dm-tx"><b>${l.from}</b><small>${l.subject}</small></span>` +
      `${read ? "" : `<span class="ig-dm-dot"></span>`}`;
    row.onclick = () => showLetterDetail(l);
    box.appendChild(row);
  });
  if (!ls.length) box.appendChild(el("div", "ig-empty", "まだメッセージはありません。レースを重ねると届きます。"));
  body.appendChild(box);
}

function showLetterDetail(l) {
  if (typeof readLetter === "function") readLetter(l.id);
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop ig-dm-pop");
  const close = () => { ov.remove(); if (state.ui.screen === "sns" && typeof renderSns === "function") renderSns(); };
  box.innerHTML =
    `<div class="ig-dm-pop-head"><span class="ig-dm-av">${l.ic}</span><b>${l.from}</b></div>` +
    `<div class="ig-dm-bubble">${String(l.body).replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>`;
  const btns = el("div", "navpop-btns"); const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => close(); btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.appendChild(ov);
  if (window.Sfx) Sfx.play("tick");
}

// 後方互換（旧 ?go=timeline / fanletters・既存呼び出し）。
function renderTimeline() { renderSns("feed"); }
function renderFanletters() { renderSns("dm"); }
