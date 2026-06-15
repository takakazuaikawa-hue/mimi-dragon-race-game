// =============================================================================
// ui_story.js — 物語・相談の画面（CODEMAP §6・分割第3弾）。
// =============================================================================
// ★ui_render.js から無改変で抽出：renderStory / renderStoryChapter / renderConsult。
//   参照（STORY_CHAPTERS/STORY_CAST/Dialogue/DLG/getStoryFlag/epilogueStart/playShinganCutin/
//   photoOr/showStoryArt/chapterDisplayTitle/celestiaSectionEl/advisorVoiceEl 等）はグローバル共有で不変。
//   呼び出しは renderHome のナビ・nav.js から call-time。renderHelp等は ui_render に残置。
// =============================================================================

function renderStory() {
  state.ui.screen = "story";
  recomputeAssets(state);
  const total = state.player.totalAssets;
  const app = beginScreen();
  app.appendChild(el("h2", null, "ストーリー"));

  const intro = el("div", "card story-intro");
  const unlockedCount = STORY_CHAPTERS.filter(ch => total >= storyUnlockAt(ch.id)).length;
  intro.innerHTML =
    `<p class="story-intro-sub">借金まみれのバニー・ミミが、霧と火山の聖龍レース島で出会う5人と、5つの視点。総資産を育てると、新しい話が解放されます。</p>` +
    `<div class="story-progress">解放：<b>${unlockedCount}</b> / ${STORY_CHAPTERS.length} 話</div>`;
  app.appendChild(intro);

  // コンパクトな一覧（CGサムネ＋タイトル＋話者）。本文は読む画面へ遷移（スクロール減）。
  const list = el("div", "story-list");
  STORY_CHAPTERS.forEach(ch => {
    const unlocked = total >= storyUnlockAt(ch.id);
    const cast = STORY_CAST[ch.cast];
    const row = el("button", "story-row" + (unlocked ? "" : " locked"));
    if (cast) row.style.setProperty("--cg", cast.color);
    row.innerHTML =
      `<span class="story-row-cg">${unlocked ? photoOr("images/story/" + ch.id + ".jpg", `<span>${cast ? cast.symbol : "🐲"}</span>`) : "<span>🔒</span>"}</span>` +
      `<span class="story-row-tx"><span class="story-row-t">${chapterDisplayTitle(ch)}</span>` +
        `<span class="story-row-s">${unlocked ? (ch.id === "ED" ? "次の物語へ" : ch.title) : "総資産 " + fmtCoins(storyUnlockAt(ch.id)) + " で解放"}</span></span>` +
      (unlocked ? `<span class="story-row-ch">›</span>` : "");
    if (unlocked) row.onclick = () => renderStoryChapter(ch.id);
    list.appendChild(row);
  });
  app.appendChild(list);

  const actions = el("div", "actions");
  const consultBtn = el("button", "secondary", "💬 相談する"); consultBtn.onclick = () => renderConsult();
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(consultBtn);
  if (state.ui && state.ui.debug && typeof Dialogue !== "undefined") {
    const demoBtn = el("button", "secondary", "▶ 立ち絵セリフ デモ"); demoBtn.onclick = () => Dialogue.demo();
    actions.appendChild(demoBtn);
  }
  actions.appendChild(back);
  app.appendChild(actions);
}

// 専用画面：1話を読む（大きな一枚絵＋話者＋本文）
function renderStoryChapter(chId) {
  const ch = STORY_CHAPTERS.find(c => c.id === chId);
  recomputeAssets(state);
  if (!ch || state.player.totalAssets < storyUnlockAt(ch.id)) { renderStory(); return; }
  state.ui.screen = "story_read";
  const cast = STORY_CAST[ch.cast];
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
  // 通常は結果画面の「2勝目」で出会う（js/poro.js）。既存のレース出走ポロ・図鑑は不変＝表示専用。
  if (typeof maybePlayPoroArcOnChapter === "function") maybePlayPoroArcOnChapter(ch.id);
  // 第4話「マクラと推し竜文化」を開く＝図鑑（推し竜の記録）を解放（ユーザー指定：図鑑は枕に会ってから）。
  if (ch.id === "4" && typeof setStoryFlag === "function" && !getStoryFlag("metMakura")) setStoryFlag("metMakura", true);
  // 第5話「セレスティアの神眼」を開く＝終章（絶滅メーターの綱引き）起動（js/epilogue_engine.js）。
  if (ch.id === "5" && typeof epilogueStart === "function") epilogueStart();
  const app = beginScreen();   // 上部に「← 物語」
  app.appendChild(el("h2", null, chapterDisplayTitle(ch)));
  if (ch.id !== "ED") app.appendChild(el("div", "as-hint2", ch.title));
  const card = el("div", "card story-chapter");
  const cg = el("div", "story-cg viewable");
  if (cast) cg.style.setProperty("--cg", cast.color);
  cg.innerHTML =
    `<div class="story-cg-art">${photoOr("images/story/" + ch.id + ".jpg", `<span class="story-cg-sym">${cast ? cast.symbol : "🐲"}</span>`)}<span class="story-cg-zoom">🔍 全画面</span></div>` +
    `<div class="story-cg-cap"><span class="story-cg-tag">一枚絵</span>${ch.scene || ""}</div>`;
  cg.onclick = () => showStoryArt(ch);
  card.appendChild(cg);
  if (cast) {
    const badge = el("div", "story-cast");
    badge.innerHTML =
      `<span class="story-cast-sym" style="--cg:${cast.color}">${cast.symbol}</span>` +
      `<span class="story-cast-info"><span class="story-cast-name">${cast.name}<small>（${cast.tag}）</small></span>` +
      `<span class="story-cast-gives">授けるもの：${cast.gives}</span></span>`;
    card.appendChild(badge);
  }
  card.appendChild(el("div", "story-ch-body", ch.body));
  app.appendChild(card);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 物語へ戻る"); back.onclick = () => renderStory();
  actions.appendChild(back);
  app.appendChild(actions);
}

// =========================================================================
// 相談 (consult) screen — lists advisors met so far; each gives their
// "perspective" line (spec §10.3). Flavor only; never affects race math.
// =========================================================================
function renderConsult() {
  state.ui.screen = "consult";
  recomputeAssets(state);
  const total = state.player.totalAssets;
  const app = beginScreen();
  app.appendChild(el("h2", null, "相談する"));
  app.appendChild(el("p", "consult-sub", "出会った顧問に話を聞けます。相談は「答え合わせ」ではなく「視点の切り替え」です。"));

  const list = el("div", "consult-list");
  Object.keys(STORY_CAST).forEach(k => {
    const c = STORY_CAST[k];
    const unlocked = total >= castUnlockAt(k);
    const card = el("div", "card consult-card" + (unlocked ? "" : " locked"));
    const port = el("div", "consult-port");
    port.style.setProperty("--cg", c.color);
    port.innerHTML = unlocked
      ? photoOr("images/cast/" + k + ".png", `<span class="consult-sym">${c.symbol}</span>`)
      : `<span class="consult-sym">🔒</span>`;
    card.appendChild(port);
    const body = el("div", "consult-body");
    body.innerHTML = unlocked
      ? `<div class="consult-name">${c.name}<small>（${c.tag}）</small></div>` +
        `<div class="consult-focus">${c.focus}　—　授けるもの：${c.gives}</div>` +
        `<div class="consult-line">「${c.consult}」</div>`
      : `<div class="consult-name muted">？？？</div>` +
        `<div class="consult-focus">総資産 ${fmtCoins(castUnlockAt(k))} で出会う</div>`;
    card.appendChild(body);
    list.appendChild(card);
  });
  app.appendChild(list);

  const actions = el("div", "actions");
  const storyBtn = el("button", "secondary", "📜 ストーリー"); storyBtn.onclick = () => renderStory();
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(storyBtn);
  actions.appendChild(back);
  app.appendChild(actions);
}
