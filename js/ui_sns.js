// =========================================================================
// ui_sns.js — ミニSNS「ぴょこったー」の描画（本物のSNSアプリ風・3タブ）。js/sns.js のデータを表示。
// =========================================================================
// 🏠ホーム（連続ログイン＋デイリーお題投票＋いまどうしてる投稿＋日替わり生フィード:リアクション/リプライ）
// 👤プロフィール（ミミのプロフィール＋自分の投稿＝バズる）／✉️レター（ファンレター=DM風）。
// 完全に表示専用メタ（[[race-math-immutable]]）。ホームのナビは「📱 SNS」1枠から開く。
// =========================================================================

let _snsTab = "home";

function renderSns(tab) {
  if (tab) _snsTab = (tab === "timeline") ? "home" : (tab === "fanletters") ? "letters" : tab;
  if (["home", "profile", "letters"].indexOf(_snsTab) < 0) _snsTab = "home";
  state.ui.screen = "sns";
  const app = beginScreen();

  // ── アプリのヘッダー（ブランド＋連続ログインチップ） ──
  const ci = (typeof snsCheckin === "function") ? snsCheckin() : { streak: 0, isNew: false };
  const badge = (typeof snsStreakBadge === "function") ? snsStreakBadge(ci.streak) : { e: "🌱", t: "" };
  const bar = el("div", "sns-appbar");
  bar.innerHTML =
    `<div class="sns-brand"><span class="sns-logo">🐰</span><b>ぴょこったー</b></div>` +
    `<div class="sns-streakchip" title="${badge.t}">${badge.e} <b>${ci.streak}</b>日</div>`;
  app.appendChild(bar);

  // ── タブ ──
  const unread = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
  const tabs = el("div", "sns-tabbar");
  const mkTab = (id, label) => {
    const t = el("button", "sns-tab" + (id === _snsTab ? " on" : ""));
    t.innerHTML = label;
    t.onclick = () => { _snsTab = id; renderSns(); };
    return t;
  };
  tabs.appendChild(mkTab("home", "🏠 ホーム"));
  tabs.appendChild(mkTab("profile", "👤 プロフィール"));
  tabs.appendChild(mkTab("letters", `✉️ レター${unread ? ` <span class="sns-tabbadge">${unread}</span>` : ""}`));
  app.appendChild(tabs);

  if (_snsTab === "profile") _snsProfile(app);
  else if (_snsTab === "letters") _snsLetters(app);
  else _snsHome(app, ci);
}

// =========================== 🏠 ホーム ===========================
function _snsHome(app, ci) {
  // 連続ログインのお祝い（その日はじめて開いた時だけ）。
  if (ci && ci.isNew) {
    const b = (typeof snsStreakBadge === "function") ? snsStreakBadge(ci.streak) : { e: "🔥", t: "" };
    const banner = el("div", "sns-checkin");
    banner.innerHTML = `<span class="sns-ci-ic">${b.e}</span><span class="sns-ci-tx"><b>${ci.streak}日連続ログイン！</b><small>${b.t}・また明日も覗いてね</small></span>`;
    app.appendChild(banner);
  }

  // いまどうしてる？（自分で投稿してバズる入口）
  const compose = el("button", "sns-compose");
  compose.innerHTML = `<span class="sns-compose-av">🐰</span><span class="sns-compose-ph">いまどうしてる？ ぽすっと投稿…</span><span class="sns-compose-go">投稿</span>`;
  compose.onclick = () => _snsCompose();
  app.appendChild(compose);

  // デイリーお題（投票）
  const poll = (typeof todayPoll === "function") ? todayPoll() : null;
  if (poll) app.appendChild(_snsPollCard(poll));

  // 日替わり生フィード
  app.appendChild(el("div", "sns-feedlabel", "📡 きょうのタイムライン"));
  const posts = (typeof timelinePosts === "function") ? timelinePosts() : [];
  const feed = el("div", "sns-feed");
  posts.forEach(po => feed.appendChild(_snsPostCard(po)));
  if (!posts.length) feed.appendChild(el("div", "as-hint2", "まだ投稿がありません。"));
  app.appendChild(feed);
}

// デイリーお題カード（投票→%表示）。
function _snsPollCard(poll) {
  const card = el("div", "sns-poll");
  const render = () => {
    const voted = (typeof pollVoted === "function") ? pollVoted(poll) : null;
    card.innerHTML = `<div class="sns-poll-head">📊 きょうのお題</div><div class="sns-poll-q">${poll.q}</div>`;
    const wrap = el("div", "sns-poll-opts");
    if (voted == null) {
      poll.options.forEach((o, i) => {
        const b = el("button", "sns-poll-opt", o.t);
        b.onclick = () => { if (typeof votePoll === "function") votePoll(poll, i); if (window.Sfx) Sfx.play("tick"); render(); };
        wrap.appendChild(b);
      });
    } else {
      const res = (typeof pollResults === "function") ? pollResults(poll) : poll.options.map(() => 0);
      poll.options.forEach((o, i) => {
        const row = el("div", "sns-poll-res" + (i === voted ? " mine" : ""));
        row.innerHTML = `<span class="sns-poll-rt">${o.t}${i === voted ? " ✓" : ""}</span><span class="sns-poll-bar"><i style="width:${res[i]}%"></i></span><span class="sns-poll-pct">${res[i]}%</span>`;
        wrap.appendChild(row);
      });
      wrap.appendChild(el("div", "sns-poll-note", "あなたの一票も反映されました。結果は毎日かわります。"));
    }
    card.appendChild(wrap);
  };
  render();
  return card;
}

// 投稿カード（リアクション＋リプライ）。
function _snsPostCard(po) {
  const card = el("div", "sns-post");
  const txt = (typeof _snsText === "function") ? _snsText(po.text) : (typeof po.text === "function" ? po.text() : po.text);
  card.innerHTML =
    `<div class="sns-av">${po.ic}</div>` +
    `<div class="sns-body">` +
      `<div class="sns-pmeta"><b class="sns-pname">${po.name}</b><span class="sns-phandle">${po.handle}</span>${po.ago ? `<span class="sns-pago">· ${po.ago}</span>` : ""}</div>` +
      `<div class="sns-ptext">${txt}</div>` +
      `<div class="sns-foot"></div>` +
    `</div>`;
  const foot = card.querySelector(".sns-foot");
  foot.appendChild(_snsReactBar(po));
  // リプライ
  if (po.replies && po.replies.length) {
    const replied = (typeof postReplied === "function") ? postReplied(po.id) : null;
    if (replied == null) {
      const rep = el("button", "sns-replybtn", "💬 リプライする");
      rep.onclick = () => {
        const ch = el("div", "sns-reply-choices");
        po.replies.forEach((r, i) => {
          const cb = el("button", "sns-reply-choice", r.choice);
          cb.onclick = () => { if (typeof replyPost === "function") replyPost(po.id, i); if (window.Sfx) Sfx.play("coin"); _snsRerenderCard(card, po); };
          ch.appendChild(cb);
        });
        rep.replaceWith(ch);
      };
      foot.appendChild(rep);
    } else {
      card.querySelector(".sns-body").appendChild(_snsThread(po, replied));
    }
  }
  return card;
}
function _snsThread(po, idx) {
  const r = po.replies[idx];
  const t = el("div", "sns-thread");
  t.innerHTML =
    `<div class="sns-thread-mine"><span class="sns-th-av">🐰</span><div><b>あなた</b> <span class="sns-th-tx">${r.choice}</span></div></div>` +
    `<div class="sns-thread-back"><span class="sns-th-av">${po.ic}</span><div><b>${po.name}</b> <span class="sns-th-tx">${r.back}</span></div></div>`;
  return t;
}
function _snsRerenderCard(card, po) { const nu = _snsPostCard(po); card.replaceWith(nu); }

// リアクションバー（タップで5種からえらぶ・もう一度で取り消し）。
function _snsReactBar(po) {
  const wrap = el("div", "sns-reactwrap");
  const cur = (typeof postReact === "function") ? postReact(po.id) : null;
  const curE = cur ? (SNS_REACTS.find(r => r.k === cur) || {}).e : null;
  const btn = el("button", "sns-react" + (cur ? " on" : ""));
  const paint = () => {
    const c = (typeof postReact === "function") ? postReact(po.id) : null;
    const e = c ? (SNS_REACTS.find(r => r.k === c) || {}).e : null;
    btn.innerHTML = `${e || "🤍"} <b>${(typeof postReactCount === "function") ? postReactCount(po).toLocaleString() : (po.base || 0)}</b>`;
    btn.classList.toggle("on", !!c);
  };
  paint();
  btn.onclick = () => {
    let pop = wrap.querySelector(".sns-react-pop");
    if (pop) { pop.remove(); return; }
    pop = el("div", "sns-react-pop");
    (typeof SNS_REACTS !== "undefined" ? SNS_REACTS : []).forEach(r => {
      const pe = el("button", "sns-react-pick" + (cur === r.k ? " on" : ""), r.e);
      pe.title = r.lb;
      pe.onclick = (ev) => {
        ev.stopPropagation();
        if (typeof setReact === "function") setReact(po.id, r.k);
        if (window.Sfx) Sfx.play("tick");
        pop.remove(); paint();
      };
      pop.appendChild(pe);
    });
    wrap.appendChild(pop);
  };
  wrap.appendChild(btn);
  return wrap;
}

// 「いまどうしてる？」投稿モーダル（テンプレ選択＋自由入力・140字）。
function _snsCompose() {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop sns-compose-pop");
  box.innerHTML = `<div class="navpop-t">📝 投稿する</div><div class="sns-cp-sub">@mimi_yosou としてつぶやく</div>`;
  const ta = el("textarea", "sns-cp-input");
  ta.setAttribute("maxlength", "140");
  ta.setAttribute("placeholder", "いまどうしてる？ テンプレを選んでもOK！");
  box.appendChild(ta);
  const counter = el("div", "sns-cp-count", "0 / 140");
  ta.oninput = () => { counter.textContent = `${ta.value.length} / 140`; };
  box.appendChild(counter);
  // テンプレチップ
  const chips = el("div", "sns-cp-chips");
  (typeof postTemplates === "function" ? postTemplates() : []).forEach(t => {
    const txt = (typeof _snsText === "function") ? _snsText(t.text) : t.text;
    const c = el("button", "sns-cp-chip", txt.length > 20 ? txt.slice(0, 19) + "…" : txt);
    c.title = txt;
    c.onclick = () => { ta.value = txt; counter.textContent = `${ta.value.length} / 140`; ta.focus(); };
    chips.appendChild(c);
  });
  box.appendChild(el("div", "sns-cp-chiplabel", "テンプレ（タップで入力）"));
  box.appendChild(chips);
  // ボタン
  const btns = el("div", "navpop-btns");
  const post = el("button", "navpop-go", "🐰 ぽすっ！");
  post.onclick = () => {
    const v = ta.value.trim();
    if (!v) { ta.focus(); return; }
    if (typeof addMyPost === "function") addMyPost(v);
    if (window.Sfx) Sfx.play("bigwin");
    ov.remove();
    _snsTab = "profile"; renderSns();   // 自分の投稿へ誘導
    _snsToast("投稿したよ！ バズるかな…？🐰");
  };
  const cancel = el("button", "navpop-cancel", "やめる"); cancel.onclick = () => ov.remove();
  btns.appendChild(post); btns.appendChild(cancel); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  setTimeout(() => ta.focus(), 30);
}
function _snsToast(msg) {
  const t = el("div", "sns-toast", msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1900);
}

// =========================== 👤 プロフィール ===========================
function _snsProfile(app) {
  const followers = (typeof _snsFollowers === "function") ? _snsFollowers() : 0;
  const ci = snsData ? snsData().checkin : { streak: 0 };
  const badge = (typeof snsStreakBadge === "function") ? snsStreakBadge((ci && ci.streak) || 0) : { e: "🌱", t: "" };
  const mine = (typeof myPosts === "function") ? myPosts() : [];
  const posts = mine.length;

  const card = el("div", "sns-profile");
  card.innerHTML =
    `<div class="sns-prof-cover"></div>` +
    `<div class="sns-prof-av">🐰</div>` +
    `<div class="sns-prof-name"><b>予想家ミミ</b><span class="sns-prof-handle">@mimi_yosou</span></div>` +
    `<div class="sns-prof-bio">バニーガール予想家。竜とみんなを応援してます。ぱほぱほ〜♪</div>` +
    `<div class="sns-prof-badges"><span class="sns-prof-badge">${badge.e} ${badge.t || "常連"}</span></div>` +
    `<div class="sns-prof-stats">` +
      `<span class="sns-prof-stat"><b>${followers.toLocaleString()}</b>フォロワー</span>` +
      `<span class="sns-prof-stat"><b>${(42 + (_snsRank ? _snsRank() : 1) * 3)}</b>フォロー中</span>` +
      `<span class="sns-prof-stat"><b>${posts}</b>投稿</span>` +
    `</div>`;
  app.appendChild(card);

  app.appendChild(el("div", "sns-feedlabel", "🐰 自分の投稿"));
  const list = el("div", "sns-feed");
  if (!mine.length) {
    const empty = el("div", "sns-myempty");
    empty.innerHTML = `まだ投稿がありません。<br>ホームの「いまどうしてる？」から、ぽすっと投稿してみよう！`;
    const go = el("button", "navpop-go", "📝 投稿してみる"); go.onclick = () => _snsCompose();
    empty.appendChild(go);
    list.appendChild(empty);
  } else {
    mine.forEach(p => {
      const reacts = (typeof myPostReacts === "function") ? myPostReacts(p) : 0;
      const buzz = (typeof myPostBuzzing === "function") ? myPostBuzzing(p) : false;
      const card2 = el("div", "sns-post sns-mypost");
      card2.innerHTML =
        `<div class="sns-av">🐰</div>` +
        `<div class="sns-body">` +
          `<div class="sns-pmeta"><b class="sns-pname">予想家ミミ</b><span class="sns-phandle">@mimi_yosou</span>${buzz ? `<span class="sns-buzz">🔥バズ中</span>` : ""}</div>` +
          `<div class="sns-ptext">${String(p.text).replace(/</g, "&lt;")}</div>` +
          `<div class="sns-myreacts">❤️🔥👏 <b>${reacts.toLocaleString()}</b> 件のリアクション</div>` +
        `</div>`;
      list.appendChild(card2);
    });
  }
  app.appendChild(list);
}

// =========================== ✉️ レター ===========================
function _snsLetters(app) {
  const ls = (typeof fanLetters === "function") ? fanLetters() : [];
  const unread = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
  app.appendChild(el("div", "as-hint2", `あなたに届いた手紙。${ls.length} 通${unread ? `・未読 ${unread}` : "（すべて既読）"}`));
  const box = el("div", "sns-inbox");
  ls.forEach(l => {
    const read = letterRead(l.id);
    const row = el("button", "sns-letter" + (read ? "" : " unread"));
    row.innerHTML =
      `<span class="sns-lt-av">${l.ic}</span>` +
      `<span class="sns-lt-tx"><b class="sns-lt-subj">${l.subject}</b><small class="sns-lt-from">${l.from}</small></span>` +
      `<span class="sns-lt-st">${read ? "既読" : "🔴 未読"}</span>`;
    row.onclick = () => showLetterDetail(l);
    box.appendChild(row);
  });
  if (!ls.length) box.appendChild(el("div", "as-hint2", "まだ手紙は届いていません。レースを重ねると、みんなから届きます。"));
  app.appendChild(box);
}

function showLetterDetail(l) {
  if (typeof readLetter === "function") readLetter(l.id);
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop sns-letter-pop");
  const close = () => { ov.remove(); if (state.ui.screen === "sns" && typeof renderSns === "function") renderSns(); };
  box.innerHTML =
    `<div class="sns-lp-av">${l.ic}</div>` +
    `<div class="navpop-t">${l.subject}</div>` +
    `<div class="sns-lp-from">${l.from}</div>` +
    `<div class="sns-lp-body">${String(l.body).replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>`;
  const btns = el("div", "navpop-btns");
  const ok = el("button", "navpop-go", "読んだよ"); ok.onclick = () => close();
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.appendChild(ov);
  if (window.Sfx) Sfx.play("tick");
}

// 後方互換（旧 ?go=timeline / fanletters・既存呼び出し）。
function renderTimeline() { renderSns("home"); }
function renderFanletters() { renderSns("letters"); }
