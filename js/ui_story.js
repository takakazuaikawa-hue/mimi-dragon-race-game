// =============================================================================
// ui_story.js — 物語・相談の画面（CODEMAP §6・分割第3弾）。
// =============================================================================
// ★見た目を「異世界新聞（聖龍日報）」風に統一＝明朝体・クリーム紙・罫線・号外コラム・
//   ハーフトーン写真。renderStory / renderStoryChapter / renderConsult / showStoryEvent。
//   参照（STORY_CHAPTERS/STORY_CAST/Dialogue/DLG/getStoryFlag/epilogueStart/playShinganCutin/
//   photoOr/showStoryArt/chapterDisplayTitle/storyUnlockAt/castUnlockAt/fmtCoins 等）は不変。
//   ★完全に表示専用＝着順・オッズ・配当・経済に非干渉（[[race-math-immutable]]）。
// =============================================================================

// 新聞の題字（マストヘッド）。leftMeta=號数、rightMeta=面の種類など。
function _newsMast(leftMeta, rightMeta) {
  const m = el("div", "news-mast");
  m.innerHTML =
    `<div class="news-mast-top"><span>${leftMeta || ""}</span><span>聖龍暦 二三七年</span><span>${rightMeta || ""}</span></div>` +
    `<div class="news-title"><span class="crest">🐲</span><span>聖龍日報</span><span class="crest">🐉</span></div>` +
    `<div class="news-sub">THE&nbsp;SACRED&nbsp;DRAGON&nbsp;TIMES</div>` +
    `<div class="news-mast-rule"><span>霧島本社</span><span>◆</span><span>発行 ミミ通信社</span><span>◆</span><span>天候 霧のち快晴</span></div>`;
  return m;
}
// 見出し罫（rubric）。labelHTML はHTML可（件数バッジ等）。
function _newsRubric(labelHTML) { return el("div", "news-rubric", labelHTML); }

function renderStory() {
  state.ui.screen = "story";
  recomputeAssets(state);
  const total = state.player.totalAssets;
  const app = beginScreen();

  const news = el("div", "news");
  const issue = (state.player.completedRaces || 0) + 1;
  const unlockedCount = STORY_CHAPTERS.filter(ch => total >= storyUnlockAt(ch.id)).length;

  // 題字
  news.appendChild(_newsMast(`第 ${issue} 號`, `本紙連載 ${unlockedCount}／${STORY_CHAPTERS.length} 話`));

  // 発行のことば（リード・ドロップキャップ）
  const lead = el("div", "news-lead");
  lead.innerHTML =
    `<span class="news-dropcap">霧</span>けむる聖龍レース島より、本紙が綴る——借金まみれのバニー娘ミミが、島で出会う五人の証言と、五つの視点。` +
    `総資産を積むほど、未公開の続報が解禁される。`;
  news.appendChild(lead);

  // 連載（章一覧）＝記事の見出し群
  news.appendChild(_newsRubric("聖龍五人衆 ・ 連載記事"));
  const arts = el("div", "news-arts");
  STORY_CHAPTERS.forEach(ch => {
    const unlocked = total >= storyUnlockAt(ch.id);
    const cast = STORY_CAST[ch.cast];
    const art = el("button", "news-art" + (unlocked ? "" : " locked"));
    if (cast) art.style.setProperty("--na", cast.color);
    const photo = unlocked
      ? `<span class="news-photo-s">${photoOr("images/story/" + ch.id + ".jpg", `<span class="sym">${cast ? cast.symbol : "🐲"}</span>`)}</span>`
      : `<span class="news-photo-s locked"><span class="sym">🔒</span></span>`;
    const kicker = cast ? cast.tag : (ch.id === "ED" ? "最終回" : "特報");
    const head = unlocked ? chapterDisplayTitle(ch) : `<span class="news-censor">■■■■■■</span>`;
    const lead2 = unlocked
      ? (ch.id === "ED" ? "次なる物語へ——結びの一面。" : ch.title)
      : `次號予告 ／ 総資産 ${fmtCoins(storyUnlockAt(ch.id))} にて解禁`;
    art.innerHTML = photo +
      `<span class="news-art-tx"><span class="news-kicker">${kicker}</span>` +
        `<span class="news-head">${head}</span><span class="news-lead2">${lead2}</span></span>` +
      (unlocked ? `<span class="news-art-go">▸</span>` : `<span class="news-art-seal">未</span>`);
    if (unlocked) art.onclick = () => renderStoryChapter(ch.id);
    arts.appendChild(art);
  });
  news.appendChild(arts);

  // 號外コラム（小イベント＝短い挿話・進行で解放・再読可）。js/data_story_events.js
  if (typeof storyEvents === "function") {
    const evs = storyEvents();
    const st = (typeof storyEventsStats === "function") ? storyEventsStats() : { got: evs.length, total: evs.length, unread: 0 };
    news.appendChild(_newsRubric(`號外コラム ・ 島の小話 <span class="news-rub-n">${st.got}／${st.total}${st.unread ? `・速報 ${st.unread}` : ""}</span>`));
    if (!evs.length) {
      news.appendChild(el("div", "news-empty", "——続報を待て。物語を進めると、小さな記事が舞い込む。"));
    } else {
      const briefs = el("div", "news-briefs");
      evs.forEach(e => {
        const read = (typeof storyEventRead === "function") ? storyEventRead(e.id) : true;
        const b = el("button", "news-brief" + (read ? "" : " unread"));
        b.innerHTML =
          `<span class="news-brief-h">${read ? "" : `<span class="news-stamp">速報</span>`}<span class="news-brief-ic">${e.ic || "✨"}</span>${e.title}</span>` +
          (e.who ? `<span class="news-brief-b">── ${e.who} 談</span>` : "");
        b.onclick = () => showStoryEvent(e);
        briefs.appendChild(b);
      });
      news.appendChild(briefs);
    }
  }

  // 発行欄（フッター＝操作ボタン）
  const foot = el("div", "news-foot");
  foot.appendChild(el("div", "news-foot-pub", "聖龍日報　発行：ミミ通信社　◆　無断転載を禁ず"));
  const btns = el("div", "news-btns");
  const consultBtn = el("button", "news-btn", "💬 寄稿者に相談"); consultBtn.onclick = () => renderConsult();
  btns.appendChild(consultBtn);
  if (state.ui && state.ui.debug && typeof Dialogue !== "undefined") {
    const demoBtn = el("button", "news-btn", "▶ 立ち絵デモ"); demoBtn.onclick = () => Dialogue.demo();
    btns.appendChild(demoBtn);
  }
  const back = el("button", "news-btn prim", "🏠 ホームへ"); back.onclick = () => renderHome();
  btns.appendChild(back);
  foot.appendChild(btns);
  news.appendChild(foot);

  app.appendChild(news);
}

// 小イベントを読む（再読可・開封で既読・閉じたら物語画面を再描画して速報バッジ更新）。號外の切り抜き風。
function showStoryEvent(e) {
  if (typeof readStoryEvent === "function") readStoryEvent(e.id);
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop news-clip");
  const close = () => { ov.remove(); if (state.ui.screen === "story" && typeof renderStory === "function") renderStory(); };
  box.innerHTML =
    `<div class="news-clip-mast"><span>號外</span><span>聖龍日報</span><span>島の小話</span></div>` +
    `<div class="news-clip-ic">${e.ic || "✨"}</div>` +
    `<div class="news-clip-head">${e.title}</div>` +
    (e.who ? `<div class="news-clip-by">── ${e.who} 談</div>` : "") +
    `<div class="news-clip-body">${String(e.body || "").replace(/[<>&]/g, m => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m])).replace(/\n/g, "<br>")}</div>`;
  const btns = el("div", "news-btns");
  const ok = el("button", "news-btn prim", "とじる"); ok.onclick = () => close();
  btns.appendChild(ok); box.appendChild(btns);
  ov.appendChild(box); ov.onclick = (ev) => { if (ev.target === ov) close(); };
  document.body.appendChild(ov);
  if (window.Sfx) Sfx.play("tick");
}

// 専用画面：1話を読む（新聞の特集一面＝大見出し＋寄稿者＋ハーフトーン写真＋本文）
function renderStoryChapter(chId) {
  const ch = STORY_CHAPTERS.find(c => c.id === chId);
  recomputeAssets(state);
  if (!ch || state.player.totalAssets < storyUnlockAt(ch.id)) { renderStory(); return; }
  state.ui.screen = "story_read";
  const cast = STORY_CAST[ch.cast];
  // ▼▼ 物語ロジック（不変・表示専用の演出トリガ）▼▼
  // 各話の導入セリフ（立ち絵）— 章ごとに1回だけ。本文はそのまま下に表示。
  if (window.Dialogue && window.DLG && typeof getStoryFlag === "function" && !getStoryFlag("_chapter_intro_" + ch.id)) {
    const _introP = Dialogue.play(DLG.chapterIntro(ch, cast));
    if (typeof setStoryFlag === "function") setStoryFlag("_chapter_intro_" + ch.id, true);
    // 第5話：導入セリフのあと、神眼開眼のカットインを一度だけ（初回のみ・表示専用）。
    if (ch.id === "5" && typeof playShinganCutin === "function" && _introP && _introP.then) {
      _introP.then(function () { playShinganCutin(); });
    }
  }
  // フォールバック：2勝より先に第3/4章へ到達していた場合のみ、章を開いた時にポロ発見アークを再生。
  if (typeof maybePlayPoroArcOnChapter === "function") maybePlayPoroArcOnChapter(ch.id);
  // 第4話「マクラと推し竜文化」を開く＝図鑑（推し竜の記録）を解放。
  if (ch.id === "4" && typeof setStoryFlag === "function" && !getStoryFlag("metMakura")) setStoryFlag("metMakura", true);
  // 第5話「セレスティアの神眼」を開く＝終章（絶滅メーターの綱引き）起動。
  if (ch.id === "5" && typeof epilogueStart === "function") epilogueStart();
  // ▲▲ 物語ロジックここまで ▲▲

  const app = beginScreen();   // 上部に「← 物語」
  const news = el("div", "news news-article");
  const issue = (state.player.completedRaces || 0) + 1;
  news.appendChild(_newsMast(`第 ${issue} 號`, ch.id === "ED" ? "最終一面" : "特集一面"));

  // 大見出し
  const kicker = cast ? cast.tag : (ch.id === "ED" ? "最終回" : "特報");
  news.appendChild(el("div", "news-kicker news-kicker-lg", kicker));
  news.appendChild(el("div", "news-headline", chapterDisplayTitle(ch)));
  if (ch.id !== "ED") news.appendChild(el("div", "news-subhead", ch.title));
  if (cast) news.appendChild(el("div", "news-byline", `寄稿：${cast.name}（${cast.tag}）　◆　授けるもの＝${cast.gives}`));

  // 本紙写真（ハーフトーン枠・タップで全画面）
  const photo = el("div", "news-photo viewable");
  photo.innerHTML =
    `<div class="news-photo-img">${photoOr("images/story/" + ch.id + ".jpg", `<span class="sym">${cast ? cast.symbol : "🐲"}</span>`)}` +
      `<span class="news-photo-zoom">🔍 全画面</span></div>` +
    `<div class="news-cap"><span class="news-cap-tag">本紙写真部</span>${ch.scene || ""}</div>`;
  photo.onclick = () => showStoryArt(ch);
  news.appendChild(photo);

  // 本文（明朝・両端揃え・ドロップキャップ）
  news.appendChild(el("div", "news-text", ch.body));

  // 発行欄
  const foot = el("div", "news-foot");
  foot.appendChild(el("div", "news-foot-pub", "聖龍日報　発行：ミミ通信社"));
  const btns = el("div", "news-btns");
  const back = el("button", "news-btn prim", "◀ 一面へ戻る"); back.onclick = () => renderStory();
  btns.appendChild(back);
  foot.appendChild(btns);
  news.appendChild(foot);
  app.appendChild(news);
}

// =========================================================================
// 相談 (consult)：新聞の「論説・寄稿者名簿」面。出会った顧問の視点を載せる。
// Flavor only; never affects race math.
// =========================================================================
function renderConsult() {
  state.ui.screen = "consult";
  recomputeAssets(state);
  const total = state.player.totalAssets;
  const app = beginScreen();

  const news = el("div", "news");
  news.appendChild(_newsMast("論説 ・ 寄稿", "識者に問う"));
  const lead = el("div", "news-lead");
  lead.innerHTML =
    `<span class="news-dropcap">識</span>者に問う——相談は「答え合わせ」ではなく「視点の切り替え」。` +
    `出会った論説委員が、それぞれの眼で島を読み解く。`;
  news.appendChild(lead);

  news.appendChild(_newsRubric("論説委員 ・ 寄稿者名簿"));
  const arts = el("div", "news-arts");
  Object.keys(STORY_CAST).forEach(k => {
    const c = STORY_CAST[k];
    const unlocked = total >= castUnlockAt(k);
    const art = el("div", "news-art news-art-consult" + (unlocked ? "" : " locked"));
    if (c) art.style.setProperty("--na", c.color);
    const photo = unlocked
      ? `<span class="news-photo-s">${photoOr("images/cast/" + k + ".png", `<span class="sym">${c.symbol}</span>`)}</span>`
      : `<span class="news-photo-s locked"><span class="sym">🔒</span></span>`;
    art.innerHTML = unlocked
      ? photo + `<span class="news-art-tx"><span class="news-kicker">${c.tag}</span>` +
          `<span class="news-head">${c.name}</span>` +
          `<span class="news-lead2">${c.focus}　／　授けるもの＝${c.gives}</span>` +
          `<span class="news-quote">「${c.consult}」</span></span>`
      : photo + `<span class="news-art-tx"><span class="news-kicker">？？？</span>` +
          `<span class="news-head"><span class="news-censor">■■■■</span></span>` +
          `<span class="news-lead2">総資産 ${fmtCoins(castUnlockAt(k))} にて初登場</span></span>`;
    arts.appendChild(art);
  });
  news.appendChild(arts);

  const foot = el("div", "news-foot");
  foot.appendChild(el("div", "news-foot-pub", "聖龍日報　論説部"));
  const btns = el("div", "news-btns");
  const storyBtn = el("button", "news-btn", "📜 一面へ"); storyBtn.onclick = () => renderStory();
  const back = el("button", "news-btn prim", "🏠 ホームへ"); back.onclick = () => renderHome();
  btns.appendChild(storyBtn); btns.appendChild(back);
  foot.appendChild(btns);
  news.appendChild(foot);
  app.appendChild(news);
}
