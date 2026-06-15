// =========================================================================
// ui_sns.js — SNS画面の描画（📱タイムライン ／ ✉️ファンレター）。js/sns.js のデータを表示するだけ。
// =========================================================================
// ホームのナビ（hl-rail）＝「予想入門・相談」を外した枠に配置。表示専用メタ（[[race-math-immutable]]）。
// 参照（beginScreen / el / state / SNS_POSTS系 / Sfx）はグローバル共有。nav.js screenMap に timeline/fanletters を登録。
// =========================================================================

// 📱 タイムライン：解放済み投稿のフィード。❤️で“いいね”を集める（表示専用）。
function renderTimeline() {
  state.ui.screen = "timeline";
  const app = beginScreen();
  app.appendChild(el("h2", null, "📱 タイムライン"));
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

// ✉️ ファンレター：マイルストーンで届く手紙の受信箱。開封で既読＝いつでも読み返せる。
function renderFanletters() {
  state.ui.screen = "fanletters";
  const app = beginScreen();
  app.appendChild(el("h2", null, "✉️ ファンレター"));
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

// 手紙の詳細（開封＝既読化）。閉じる時にファンレター画面なら再描画して未読バッジを更新。
function showLetterDetail(l) {
  if (typeof readLetter === "function") readLetter(l.id);
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop sns-letter-pop");
  const close = () => { ov.remove(); if (state.ui.screen === "fanletters" && typeof renderFanletters === "function") renderFanletters(); };
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
