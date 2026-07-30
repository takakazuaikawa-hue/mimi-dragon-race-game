// =========================================================================
// ui_kiko.js — 📖『ドラゴンレース紀行』ブログ ＋ 📱メディアハブ（2026-07-30・柱A/IA再編）
// =========================================================================
// 紀行＝ミミが書く側のWEB連載ブログ（決裁：本メタファー禁止・おしゃれ女子ブロガー調・
// ノリがよくて健康的な明るさ）。メディアの三面：
//   📖 紀行ブログ＝書く（この画面・収入源）／🎬 物語＝撮られる（既存）／📱 SNS＝流れる（既存）
// 記事・数字はすべて既存データの流用（MEALS.react/note・DRAGON_LORE・KONRON_*・collectionScoreParts）。
// ★完全に表示専用＝レースの着順・オッズ・配当には一切非干渉（[[race-math-immutable]]）。
// 正本：docs/KIKO_READER_IA_REDESIGN.md §4。
// =========================================================================

// ── 初回VN（サケの勧めで執筆開始＝タイトル回収）。ホームの売上ポップと紀行画面の両方から
//    入れるので共通化。1回きり（kikoStarted）・サケは第1話から登場済み＝門番OK。
function playKikoIntro(done) {
  try {
    if (typeof getStoryFlag === "function" && getStoryFlag("kikoStarted")) { if (done) done(); return; }
    if (!(window.Dialogue && Dialogue.play)) { if (done) done(); return; }
    if (typeof setStoryFlag === "function") setStoryFlag("kikoStarted", true);
    Dialogue.play([
      ["sake_udada", "……おい、ミミ。あんた、飯の味も竜の顔も、一度見たら忘れないだろう。それ、書き留めてみな。旅の見聞録ってやつだ。島の外の連中が、金を払ってでも読みたがる。"],
      ["mimi", "私が、本を……！　た、確かに食べたものは全部言えます。おとといの塩パスタ、麺は太めでした！", "happy"],
      ["sake_udada", "名付けて『ドラゴンレース紀行』だ！"],
      ["mimi", "なるほど、昨今では珍しい、早めのタイトル回収ですね！", "happy"],
      { s: "narrator", t: "こうしてミミは、レースの合間に筆を執ることになった。島でのあらゆる見聞が『紀行』のネタになり、毎日すこしずつ、売上が届く。" }
    ]).then(() => { if (done) done(); });
  } catch (e) { if (done) done(); }
}

// ── カテゴリ（チップ）＝既存コレクション画面への入口。stat は開けるときだけ数える。──
function _kikoCats() {
  const cats = [];
  const push = (tag, ic, stat, go, locked, lockNote) =>
    cats.push({ tag, ic, stat, go, locked: !!locked, lockNote: lockNote || "" });
  // #たべある記（みみしんぼ）
  try { const m = mealStatsAll(); push("たべある記", "🍜", `${m.got}/${m.total}`, () => renderMeals()); } catch (e) {}
  // #竜ずかん
  try {
    const tot = (typeof _gDexTotal === "function") ? _gDexTotal() : 8;
    const seen = (typeof collectionSeenCount === "function") ? collectionSeenCount() : 0;
    const open = (typeof dexUnlocked !== "function") || dexUnlocked();
    push("竜ずかん", "🐲", open ? `${seen}/${tot}` : "🔒", () => renderCollection(), !open, "はじめて当てると開く");
  } catch (e) {}
  // #島さんぽ（崑崙ガイドブック）
  try {
    const open = (typeof konronMapUnlocked !== "function") || konronMapUnlocked();
    let g = "", t = 0, o = 0;
    if (open && typeof KONRON_GUIDE !== "undefined" && typeof _kmTotal === "function") {
      KONRON_GUIDE.forEach(c => c.entries.forEach(e => { t++; if (_kmTotal() >= (KM_TIER_AT[e.tier] || 0)) o++; }));
      g = `${o}/${t}`;
    }
    push("島さんぽ", "🏝️", open ? (g || "→") : "🔒", () => renderKonronGuide(), !open, "はじめて勝つと開く");
  } catch (e) {}
  // #フォト日記
  try {
    const open = (typeof konronMapUnlocked !== "function") || konronMapUnlocked();
    let g = "";
    if (open && typeof KONRON_SPOTS !== "undefined" && typeof _kmSpotOpen === "function") {
      let t = 0, o = 0;
      Object.keys(KONRON_SPOTS).forEach(id => {
        const s = KONRON_SPOTS[id];
        if (s.photo) { t++; if (_kmSpotOpen(s)) o++; }
        if (s.gourmet) { t++; if (_kmSpotOpen(s)) o++; }
      });
      g = `${o}/${t}`;
    }
    push("フォト日記", "📷", open ? (g || "→") : "🔒", () => renderKonronGallery(), !open, "はじめて勝つと開く");
  } catch (e) {}
  // #ひとびと（物語の小イベント＝物語ページ下部）
  try { const s = storyEventsStats(); push("ひとびと", "✨", `${s.got}/${s.total}`, () => renderStory()); } catch (e) {}
  // #おかいもの（生活資産コレクション）
  try {
    const owned = LIFE_ASSETS.filter(it => isLifeAssetUnlocked(state, it, (state.assets && state.assets.unlockedLifeStages) || 0)).length;
    push("おかいもの", "🎁", `${owned}/${LIFE_ASSETS.length}`, () => renderLifeCollection());
  } catch (e) {}
  return cats;
}

// ── ✍️ 今日の更新：集めた記録から1本、ブログ文体の短い記事を自動生成（日替わり・決定的）。──
function _kikoTodaysPost() {
  const day = (typeof _epochDay === "function") ? _epochDay() : 0;
  const posts = [];
  // 食べたもの（MEALS.react＝実食コメントがそのままブログ向きのテンション）
  try {
    MEALS.forEach(m => { if (mealUnlocked(m)) posts.push({
      tag: "たべある記", title: `${m.ic || "🍜"} ${m.name}、たべた！`,
      body: (m.react || "") + (m.note ? `　${m.note}` : "")
    }); });
  } catch (e) {}
  // 竜の断章（スカウトで解禁した伝承＝取材メモとして）
  try {
    const col = state.player.collection || {};
    Object.keys(col).forEach(id => {
      const lv = (col[id] && col[id].loreLv) || 0;
      const lore = (typeof DRAGON_LORE !== "undefined") && DRAGON_LORE[id];
      const d = (typeof DRAGONS !== "undefined") && DRAGONS.find(x => x.id === id);
      if (lv >= 1 && lore && lore[0] && d) posts.push({
        tag: "竜のはなし", title: `🐲 ${d.name}の取材メモ`, body: lore[0]
      });
    });
  } catch (e) {}
  if (!posts.length) {
    const p = state.player;
    return { tag: "ごあいさつ", title: "🐰 連載、はじめました！",
      body: `崑崙島でドラゴンレースと暮らしはじめたミミです！ ここまで${p.completedRaces || 0}戦。おいしいもの、はやい竜、ぜんぶ書いていきます。よろしくね！` };
  }
  return posts[((day % posts.length) + posts.length) % posts.length];
}

// ── 📖 紀行ブログ本体 ─────────────────────────────────────────────────
function renderKiko() {
  const p = state.player;
  if ((p.completedRaces || 0) < 1) {
    if (typeof showInfoPopup === "function") showInfoPopup("📖 ？？？",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ始まっていません</b><small>まずは1戦、走ってみよう。島の姉御が、なにか勧めてくるらしい。</small></div></div>`);
    return;
  }
  // 初回はサケの命名VNから（ホームの売上ポップより先にここへ来た人も、同じ入口をくぐる）
  if (typeof getStoryFlag === "function" && !getStoryFlag("kikoStarted")) { playKikoIntro(() => renderKiko()); return; }

  state.ui.screen = "kiko";
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const app = beginScreen();
  app.classList.add("kiko-page");   // ★明るいWEBメディア面（画面スコープ・前例=kt-page/lr-page）

  const fol = (typeof goalFollowers === "function") ? goalFollowers() : 0;
  const earned = p.kikoEarned || 0;
  const cs = (typeof collectionScoreParts === "function") ? collectionScoreParts() : { pct: 0 };

  // ヘッダー＝ブログの顔（ロゴ・著者・読者数・累計売上）
  const head = el("div", "kiko-head");
  head.innerHTML =
    `<div class="kiko-logo">📖 ドラゴンレース紀行</div>` +
    `<div class="kiko-byline">by ミミ🐰 <span class="kiko-badge">連載中</span></div>` +
    `<div class="kiko-stats"><span>👀 読者 <b>${fol.toLocaleString("ja-JP")}</b>人</span>` +
    `<span>💰 累計売上 <b>${fmtCoins(earned)}</b></span></div>`;
  app.appendChild(head);

  // ✍️ 今日の更新
  const post = _kikoTodaysPost();
  const art = el("div", "kiko-post");
  art.innerHTML =
    `<div class="kiko-post-k">✍️ 今日の更新</div>` +
    `<div class="kiko-post-t">${post.title}</div>` +
    `<div class="kiko-post-b">${post.body}</div>` +
    `<div class="kiko-post-tags">#${post.tag} #崑崙島 #ドラゴンレース</div>`;
  app.appendChild(art);

  // カテゴリ（チップ→既存画面へ）
  app.appendChild(el("div", "kiko-sec", "カテゴリ"));
  const chips = el("div", "kiko-chips");
  _kikoCats().forEach(c => {
    const b = el("button", "kiko-chip" + (c.locked ? " locked" : ""),
      `<span class="kc-ic">${c.ic}</span><span class="kc-tag">#${c.tag}</span><span class="kc-n">${c.stat}</span>`);
    b.onclick = c.locked
      ? () => { if (typeof showInfoPopup === "function") showInfoPopup(`${c.ic} #${c.tag}`,
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ書けないカテゴリ</b><small>${c.lockNote}。ネタができたら、ここに記事がたまっていきます。</small></div></div>`); }
      : c.go;
    chips.appendChild(b);
  });
  app.appendChild(chips);

  // 📈 ブログのあゆみ（充実度＝売上の理由・終章後はやり込み得点への入口もここ）
  app.appendChild(el("div", "kiko-sec", "ブログのあゆみ"));
  const ayumi = el("div", "kiko-ayumi");
  ayumi.innerHTML =
    `<div class="kiko-ay-row"><span>記事の充実度</span><div class="kiko-ay-bar"><i style="width:${cs.pct}%"></i></div><b>${cs.pct}%</b></div>` +
    `<div class="kiko-ay-note">島で食べて・出会って・撮って・集めるほど記事が増え、<b>毎日の売上</b>が上がります。</div>`;
  app.appendChild(ayumi);
  try {
    const cleared = (typeof kurashiChapter === "function") && kurashiChapter() >= 6;
    const row = el("button", "kiko-score" + (cleared ? "" : " locked"),
      cleared ? `🏆 やり込み得点（総集編）を見る ›` : `🔒 総集編 — 物語を最後まで見届けると、日々のすべてが得点になる`);
    row.onclick = cleared ? () => renderCollectionScore()
      : () => { if (typeof showInfoPopup === "function") showInfoPopup("🏆 ？？？",
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>物語を最後まで見届けると開放されます。</small></div></div>`); };
    app.appendChild(row);
  } catch (e) {}

  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ── 📱 メディアハブ：ミミをめぐる3つのメディアの入口（物語＋SNS＋手紙）──
function renderMediaHub() {
  state.ui.screen = "media";
  const app = beginScreen();
  app.appendChild(el("h2", null, "📱 メディア"));
  app.appendChild(el("div", "media-lead", "ミミをめぐる、島のメディアたち。"));
  const ent = el("div", "as-entries");
  const entry = (ic, label, sub, badge, onClick) => {
    const b = el("button", "as-entry",
      `<span class="as-entry-ic">${ic}</span><span class="as-entry-tx"><span class="as-entry-l">${label}${badge ? ` <span class="as-entry-badge">${badge}</span>` : ""}</span>` +
      `<span class="as-entry-s">${sub}</span></span><span class="as-entry-ch">›</span>`);
    b.onclick = onClick; return b;
  };
  // 🎬 物語＝密着ドキュメンタリー（撮られる側・最初から）
  const unread = (typeof storyHasUnread === "function") && storyHasUnread();
  ent.appendChild(entry("🎬", "ミミ、爆走中。", "密着ドキュメンタリー — ミミの物語", unread ? "🆕" : "", () => renderStory()));
  // 📱 SNS（流れる側・スマホ購入で解禁）
  const bc = (typeof getStoryFlag === "function") && getStoryFlag("phoneBought");
  if (bc) {
    const dm = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
    ent.appendChild(entry("📱", "タイムライン", "島のみんなの投稿・ミミの配信のこだま", "", () => renderSns("feed")));
    ent.appendChild(entry("✉️", "ファンレター", "届いた手紙を読む", dm > 0 ? `未読${dm}` : "", () => renderSns("dm")));
  } else {
    const lk = el("button", "as-entry",
      `<span class="as-entry-ic">🔒</span><span class="as-entry-tx"><span class="as-entry-l">？？？</span>` +
      `<span class="as-entry-s">スマホを手に入れると、ここに新しいメディアが増える。</span></span><span class="as-entry-ch">›</span>`);
    lk.onclick = () => { if (typeof showInfoPopup === "function") showInfoPopup("📱 ？？？",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>物語が進み、<u>スマホを買う</u>と解禁されます。</small></div></div>`); };
    ent.appendChild(lk);
  }
  app.appendChild(ent);
  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

if (typeof window !== "undefined") {
  window.renderKiko = renderKiko;
  window.renderMediaHub = renderMediaHub;
  window.playKikoIntro = playKikoIntro;
}
