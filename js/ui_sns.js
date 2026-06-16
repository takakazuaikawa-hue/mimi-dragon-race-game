// =========================================================================
// ui_sns.js — SNS画面（📱タイムライン ／ ✉️ファンレターを1画面にタブ統合）。js/sns.js のデータを表示。
// =========================================================================
// ホームのナビ（hl-rail）は「📱 SNS」1枠だけ（予想入門・相談を外した枠に配置）。
// 中で上部タブ＝タイムライン/ファンレターを切替（compact＋drill-down／[[ui-compact-drilldown]]）。
// 完全に表示専用メタ（[[race-math-immutable]]）。参照（beginScreen/el/state/SNS系/Sfx）はグローバル共有。
// =========================================================================

let _snsTab = "timeline";

// 📱 SNS＝1画面。上部タブでタイムライン/ファンレターを切替。
function renderSns(tab) {
  if (tab) _snsTab = tab;
  if (_snsTab !== "timeline" && _snsTab !== "fanletters") _snsTab = "timeline";
  state.ui.screen = "sns";
  const app = beginScreen();
  app.appendChild(el("h2", null, "📱 SNS"));
  const unread = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;

  // 上部タブ（食事画面と同じ meal-tabs 流用）
  const tabs = el("div", "meal-tabs sns-tabs");
  const mkTab = (id, ic, label) => {
    const t = el("button", "meal-tab" + (id === _snsTab ? " on" : ""));
    t.innerHTML = `<span class="meal-tab-ic">${ic}</span><span class="meal-tab-p">${label}</span>`;
    t.onclick = () => { _snsTab = id; renderSns(); };
    return t;
  };
  tabs.appendChild(mkTab("timeline", "📱", "タイムライン"));
  tabs.appendChild(mkTab("fanletters", "✉️", "ファンレター" + (unread ? `（${unread}）` : "")));
  app.appendChild(tabs);

  if (_snsTab === "fanletters") _snsInbox(app); else _snsFeed(app);
}

// タイムライン本体：解放済み投稿のフィード。❤️で“いいね”を集める。
function _snsFeed(app) {
  app.appendChild(el("div", "as-hint2", "島のみんなの声。進めるほど投稿が増えていきます。❤️でリアクション。"));
  const posts = (typeof timelinePosts === "function") ? timelinePosts() : [];
  const feed = el("div", "sns-feed");
  posts.forEach(po => {
    const card = el("div", "sns-post");
    const txt = (typeof _snsText === "function") ? _snsText(po.text) : (typeof po.text === "function" ? po.text() : po.text);
    card.innerHTML =
      `<div class="sns-av">${po.ic}</div>` +
      `<div class="sns-body">` +
        `<div class="sns-pmeta"><b class="sns-pname">${po.name}</b><span class="sns-phandle">${po.handle}</span><span class="sns-pago">· ${po.ago}</span></div>` +
        `<div class="sns-ptext">${txt}</div>` +
        `<div class="sns-actions"></div>` +
      `</div>`;
    const actions = card.querySelector(".sns-actions");
    const like = el("button", "sns-like" + (postLiked(po.id) ? " on" : ""));
    const paint = () => { like.innerHTML = `${postLiked(po.id) ? "❤️" : "🤍"} <b>${postLikeCount(po).toLocaleString()}</b>`; like.classList.toggle("on", postLiked(po.id)); };
    paint();
    like.onclick = () => { likePost(po.id); if (window.Sfx) Sfx.play(postLiked(po.id) ? "coin" : "tick"); paint(); };
    actions.appendChild(like);
    feed.appendChild(card);
  });
  if (!posts.length) feed.appendChild(el("div", "as-hint2", "まだ投稿がありません。レースを走ると、みんなが反応してくれます。"));
  app.appendChild(feed);
}

// ファンレター本体：マイルストーンで届く手紙の受信箱。開封で既読＝いつでも読み返せる。
function _snsInbox(app) {
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

// 手紙の詳細（開封＝既読化）。閉じる時にSNS画面なら再描画して未読バッジを更新。
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
  const ok = el("button", "navpop-go", "読んだよ");
  ok.onclick = () => close();
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) close(); };
  document.body.appendChild(ov);
  if (window.Sfx) Sfx.play("tick");
}

// 後方互換（旧 ?go=timeline / ?go=fanletters・既存の呼び出し）：1画面の該当タブを開く。
function renderTimeline() { renderSns("timeline"); }
function renderFanletters() { renderSns("fanletters"); }
