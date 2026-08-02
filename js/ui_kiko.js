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

// ── ✍️ 記事カードの組み立て（kiko_articles.js が書いた記事を紙面にする）──────
//   最新記事は開いた状態、過去記事はタップで開閉。読者コメントは最新＋殿堂だけに付ける
//   （過去記事まで全部に付けると紙面がコメントで埋まって、記事が読めなくなるため）。
function _kikoArtCard(art, opts) {
  opts = opts || {};
  const card = el("div", "kiko-art" + (art.rare ? " rare" : "") + (opts.fold ? " fold" : ""));
  const kicker = opts.kicker || (art.rare ? "💥 殿堂入りの記事" : "✍️ 最新記事");
  let html =
    `<div class="kiko-post-k">${kicker}</div>` +
    `<div class="kiko-art-t">${art.headline}</div>`;
  if (art.photo) html += `<div class="kiko-art-ph"><img src="${art.photo}" alt="" decoding="async" onerror="this.closest('.kiko-art-ph').remove()"></div>`;
  html += `<div class="kiko-art-b">` + art.paras.map(p => `<p>${p}</p>`).join("") + `</div>`;
  html += `<div class="kiko-post-tags">#${art.tag} #崑崙島 #ドラゴンレース</div>`;
  if (opts.comments) {
    const cs = (typeof kikoComments === "function") ? kikoComments(art) : [];
    if (cs.length) {
      html += `<div class="kiko-cmt-h">💬 読者から</div>`;
      cs.forEach(c => {
        html += `<div class="kiko-cmt"><span class="kcm-av">${c.ic}</span><div class="kcm-b">` +
          `<div class="kcm-h"><b>${c.n}</b><span>${c.h}</span></div>` +
          `<div class="kcm-t">${c.t}</div><div class="kcm-f">★ ${c.fav}</div></div></div>`;
      });
    }
  }
  card.innerHTML = html;
  if (opts.fold) {
    const t = card.querySelector(".kiko-art-t");
    if (t) t.onclick = () => card.classList.toggle("fold");
  }
  return card;
}

// ── 🐦 あゆみ（昔のTwitter風）のつぶやき文面。目標id→当時のミミのツイート。──
//   声表：短文の畳みかけ・！多め・飯に着地しがち・自分に「おめでとう」と言わない。
//   ★未登場キャラの固有名は書かない（表示側でも goalMasked で二重に防護）。
var _KIKO_TWEETS = {
  firstRace:  "はじめてレース出た！！ 心臓が竜より速く走ってた。おなかすいた。",
  firstHit:   "当たった。当たったよ！？ 記念に屋台で一本追加した🍢",
  firstWin:   "単勝、獲った……！！ 🏆 今日のごはんはおかず二品です",
  firstMeal:  "島のごはん、はじめて食べた。泣いた。おかわりした🍙",
  firstOutfit:"はじめて自分の服買った！！👗 ボロ卒業。姿見の前から動けない",
  readCh2:    "オッズって生き物なんだ……📊 市場、こわい。でもおもしろい",
  changeFit:  "着替えると気分まで替わるの、なんで？👗",
  wideHit:    "ワイド当てた✨ “妙味”ってやつ、ちょっとわかってきたかも",
  rankUp:     "上のクラス、行けた🏅 竜の迫力がぜんぜん違う。ごはん食べて出直します",
  readCh3:    "総資産の話を聞いた🏠 暮らしを立てるって、こういうことか……",
  buddy:      "相棒ができました。泣き虫。でも、いちばん強い子🐲",
  lifeTree:   "くらしツリー始めた🌱 生活が積み上がってくの、うれしい",
  oneRoom:    "引っ越した！！🛏️ じぶんの部屋！！ 床で寝ない生活！！",
  meetMakura: "実況の人に会った📣 声だけで景色が見えるのすごい",
  buyPhone:   "スマホ買いました📱 配信、はじめます。手が震えてる",
  fol10k:     "フォロワー1万人……！？💗 みんな、ほんとにありがとう。今日は勝負めし！",
  dexHalf:    "図鑑、半分埋まった📖 竜はぜんぶ顔がちがう。ぜんぶ好き",
  meetCelestia:"……すごい人に、会った。🌌 世界の天井、見えた気がする",
  scout3:     "新しい土地で3頭も友だちになれた🌋 旅はつづく",
  fol100k:    "10万人。……10万人！？💗💗 島いちばんの予想家、目指します",
  protect:    "この島は、渡さない。ぜったいに。🏝️"
};

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
  // ★M4 理由つき前回比＝前回ここを開いてから増えた読者を「なぜ増えたか」つきで1行だけ。
  //   グラフも目標カウンタも置かない（計器禁止）。増えていない時は何も出さない。
  const rd = (typeof kikoReaderDelta === "function") ? kikoReaderDelta() : null;
  head.innerHTML =
    `<div class="kiko-logo">📖 ドラゴンレース紀行</div>` +
    `<div class="kiko-byline">by ミミ🐰 <span class="kiko-badge">連載中</span></div>` +
    `<div class="kiko-stats"><span>👀 読者 <b>${fol.toLocaleString("ja-JP")}</b>人</span>` +
    `<span>💰 累計売上 <b>${fmtCoins(earned)}</b></span></div>` +
    (rd ? `<div class="kiko-delta">前回から <b>+${rd.diff.toLocaleString("ja-JP")}</b> 人${rd.why ? `（${rd.why}）` : ""}</div>` : "");
  app.appendChild(head);

  // ✍️ 記事（実プレイの出来事から書かれたもの）。まだ1本も無ければ、従来の「今日の更新」。
  const arts = (p.kikoArts && p.kikoArts.length) ? p.kikoArts : null;
  if (arts) {
    app.appendChild(_kikoArtCard(arts[0], { comments: true }));
    if (arts.length > 1) {
      app.appendChild(el("div", "kiko-sec", "これまでの記事"));
      for (let i = 1; i < arts.length; i++)
        app.appendChild(_kikoArtCard(arts[i], { fold: true, kicker: `📄 ${arts[i].race}戦めのころ` }));
    }
  } else {
    const post = _kikoTodaysPost();
    const art = el("div", "kiko-post");
    art.innerHTML =
      `<div class="kiko-post-k">✍️ 今日の更新</div>` +
      `<div class="kiko-post-t">${post.title}</div>` +
      `<div class="kiko-post-b">${post.body}</div>` +
      `<div class="kiko-post-tags">#${post.tag} #崑崙島 #ドラゴンレース</div>`;
    app.appendChild(art);
  }
  // 💥 殿堂＝大穴を当てた日の記事だけが残る（通算5本の回転から外れる・収集）
  if (p.kikoHof && p.kikoHof.length) {
    app.appendChild(el("div", "kiko-sec", "殿堂入り"));
    p.kikoHof.forEach((a, i) => app.appendChild(_kikoArtCard(a, { fold: i > 0, comments: i === 0 })));
  }
  // 開いた＝既読（ホームの紀行タブのドットが消える）
  try { p.kikoUnread = false; if (typeof saveGame === "function") saveGame(); } catch (e) {}

  // カテゴリ（チップ→既存画面へ）
  app.appendChild(el("div", "kiko-sec", "カテゴリ"));
  const chips = el("div", "kiko-chips");
  _kikoCats().forEach(c => {
    const b = el("button", "kiko-chip" + (c.locked ? " locked" : ""),
      `<span class="kc-ic">${c.ic}</span><span class="kc-tag">#${c.tag}</span><span class="kc-n">${c.stat}</span>`);
    b.onclick = c.locked
      ? () => { if (typeof showInfoPopup === "function") showInfoPopup(`${c.ic} #${c.tag}`,
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ書けないカテゴリ</b><small>${c.lockNote}。ネタができたら、ここに記事がたまっていきます。</small></div></div>`); }
      : () => { state.ui._kikoBack = true; c.go(); };   // ★行き先の上部stickyが「← 📖 紀行」になる（beginScreen）
    chips.appendChild(b);
  });
  app.appendChild(chips);

  // 🐦 紀行のあゆみ＝昔のTwitter風タイムライン（ユーザー決裁2026-07-30）。
  //   達成済みの目標（goals.js）を「当時のつぶやき」として新しい順に流す。文面は _KIKO_TWEETS、
  //   無ければ goalTitleSafe（門番つき＝未登場キャラの名は出ない）。📌固定ツイート＝充実度（売上の理由）。
  app.appendChild(el("div", "kiko-sec", "紀行のあゆみ"));
  const tl = el("div", "kiko-tl");
  let tlHtml =
    `<div class="ktw-prof"><span class="ktw-av big">🐰</span><div><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span></div>` +
    `<div class="ktw-fol"><b>${fol.toLocaleString("ja-JP")}</b><span>フォロワー</span></div></div>` +
    `<div class="ktw pinned"><span class="ktw-av">🐰</span><div class="ktw-b">` +
      `<div class="ktw-pin">📌 固定されたツイート</div>` +
      `<div class="ktw-h"><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span></div>` +
      `<div class="ktw-t">記事の充実度、いま <b>${cs.pct}%</b>！ 島で食べて・出会って・撮って・集めるほど記事が増えて、毎日の売上が上がるよ📈 がんばる！</div>` +
      `<div class="ktw-a"><span>返信</span><span>リツイート</span><span class="fav">★ ふぁぼ</span></div></div></div>`;
  try {
    const done = GOALS.filter(g => goalDone(g));
    const recent = done.slice(-6).reverse();   // 新しい実績が上（昔のTLと同じ・最新が先頭）
    recent.forEach((g, i) => {
      const masked = (typeof goalMasked === "function") && goalMasked(g);
      const text = (!masked && _KIKO_TWEETS[g.id]) || `${(typeof goalIconSafe === "function") ? goalIconSafe(g) : ""} ${(typeof goalTitleSafe === "function") ? goalTitleSafe(g) : g.title}、達成！`;
      const ph = (typeof GOAL_PHASES !== "undefined" && GOAL_PHASES.find(x => x.id === g.phase)) || null;
      const when = ph ? ph.label.split(" ")[0] : "島のどこか";
      const rt = 2 + ((i * 7 + (done.length * 3)) % 29);
      const fav = 5 + ((i * 13 + fol) % 97);
      tlHtml +=
        `<div class="ktw"><span class="ktw-av">🐰</span><div class="ktw-b">` +
        `<div class="ktw-h"><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span><i>・${when}のころ</i></div>` +
        `<div class="ktw-t">${text}</div>` +
        `<div class="ktw-a"><span>返信</span><span>リツイート ${rt}</span><span class="fav">★ ${fav}</span></div></div></div>`;
    });
    if (!recent.length) tlHtml += `<div class="ktw"><span class="ktw-av">🐰</span><div class="ktw-b">` +
      `<div class="ktw-h"><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span></div>` +
      `<div class="ktw-t">アカウント作った！ これから島でのこと、ぜんぶ書いていくよ🐣</div>` +
      `<div class="ktw-a"><span>返信</span><span>リツイート</span><span class="fav">★</span></div></div></div>`;
  } catch (e) {}
  tl.innerHTML = tlHtml;
  app.appendChild(tl);
  try {
    const cleared = (typeof kurashiChapter === "function") && kurashiChapter() >= 6;
    // ★文言修正（2026-08-02・実機プレイ指摘「得点になるって書いてあるけど意味不明」）。
    //   実体＝クリア後に開く「コレクション採点」画面。何が起きる場所なのかを具体で言う。
    const row = el("button", "kiko-score" + (cleared ? "" : " locked"),
      cleared ? `🏆 総集編 — 旅の集めもの、ぜんぶ採点 ›` : `🔒 総集編 — クリア後に開放（集めた竜・食べた品・撮った写真をふり返って採点）`);
    row.onclick = cleared ? () => { state.ui._kikoBack = true; renderCollectionScore(); }
      : () => { if (typeof showInfoPopup === "function") showInfoPopup("🏆 総集編とは",
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>クリア後に開きます</b><small>物語を最後まで見届けると、それまでに集めた竜・食べた品・撮った写真などを、まとめてふり返って採点できる画面です。</small></div></div>`); };
    app.appendChild(row);
  } catch (e) {}

  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ── 📱 メディアハブ＝YouTubeの登録チャンネル風（ユーザー決裁2026-07-30）──
//   ミミをめぐるメディアを「登録チャンネル一覧」として並べる：丸アイコン＋チャンネル名＋
//   登録者数＋新着バッジ＋「登録済み」ピル。ダークな動画アプリ面（画面スコープ .yt-page）。
function renderMediaHub() {
  state.ui.screen = "media";
  const app = beginScreen();
  app.classList.add("yt-page");
  const fol = (typeof goalFollowers === "function") ? goalFollowers() : 800;

  const head = el("div", "yt-head");
  head.innerHTML = `<div class="yt-title">📱 メディア</div><div class="yt-sub">登録チャンネル</div>`;
  app.appendChild(head);

  const list = el("div", "yt-list");
  const ch = (avIc, avCls, name, handle, meta, badge, onClick) => {
    const b = el("button", "yt-ch",
      `<span class="yt-av ${avCls}">${avIc}</span>` +
      `<span class="yt-tx"><span class="yt-nm">${name}${badge ? ` <i class="yt-new">${badge}</i>` : ""}</span>` +
      `<span class="yt-hd">${handle}</span><span class="yt-mt">${meta}</span></span>` +
      `<span class="yt-btn">登録済み</span>`);
    b.onclick = onClick; return b;
  };
  // 🎬 物語＝密着ドキュメンタリー（撮られる側・最初から登録済み）
  const unread = (typeof storyHasUnread === "function") && storyHasUnread();
  let ep = 1;
  try { ep = STORY_CHAPTERS.filter(c => (typeof chapterAvailable === "function") && chapterAvailable(c.id)).length; } catch (e) {}
  list.appendChild(ch("🎬", "red", "ミミ、爆走中。", "@mimi_official_docs",
    `登録者 ${(fol * 3 + 1200).toLocaleString("ja-JP")}人 ・ EP ${Math.min(ep, 6)}/6 公開中`,
    unread ? "新着" : "", () => renderStory()));
  // 📱 SNS（流れる側・スマホ購入で解禁）
  const bc = (typeof getStoryFlag === "function") && getStoryFlag("phoneBought");
  if (bc) {
    const dm = (typeof snsUnreadLetters === "function") ? snsUnreadLetters() : 0;
    list.appendChild(ch("🏝️", "teal", "崑崙タイムライン", "@konron_now",
      `島のみんなの投稿 ・ ミミの配信のこだま`, "", () => renderSns("feed")));
    list.appendChild(ch("✉️", "pink", "ファンレター便", "@fanletter_post",
      dm > 0 ? `未読 ${dm}通 が届いています` : "届いた手紙を読む", dm > 0 ? "新着" : "", () => renderSns("dm")));
  } else {
    const lk = el("button", "yt-ch locked",
      `<span class="yt-av grey">🔒</span>` +
      `<span class="yt-tx"><span class="yt-nm">？？？</span><span class="yt-hd">@???</span>` +
      `<span class="yt-mt">スマホを手に入れると、登録チャンネルが増える。</span></span>`);
    lk.onclick = () => { if (typeof showInfoPopup === "function") showInfoPopup("📱 ？？？",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>物語が進み、<u>スマホを買う</u>と解禁されます。</small></div></div>`); };
    list.appendChild(lk);
  }
  app.appendChild(list);

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
