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
        if (typeof _kmHiddenQuiet === "function" && !_kmHiddenQuiet(id)) return;   // 見つける前の隠しスポットは枚数に入れない
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
      tag: "たべある記", title: `${m.icon || m.ic || "🍜"} ${m.name}、たべた！`,
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
  html += `<div class="kiko-post-tags">#${art.tag} #崑崙島 #ドラゴンレース` + (art.fans ? `<span class="kiko-art-fans">この記事で 読者 +${art.fans}人</span>` : "") + `</div>`;
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

// ── 🐦 あゆみの「◯◯のころ」＝その目標を達成した時期（2026-11-13）──
//   以前は目標が置かれている段（goals.js の phase）をそのまま名乗っていた。「相棒を見つける（2勝）」は
//   第3話の段にあるので、1戦めの直後に達成しても「第3話のころ」と出ていた（通しプレイで発覚）。
//   達成をはじめて見たときに、そのとき読んでいた話を控える（段より先には進めない＝既存のセーブは段か現在の早いほう）。
//   表示のための控えだけ（state.player.kikoAyumi）。目標の判定・報酬には触れない。
function _kikoAyumiWhen(g) {
  let n = g.phase || 1;
  try {
    const p = state.player, rec = (p.kikoAyumi = p.kikoAyumi || {});
    if (rec[g.id] == null) {
      const ch = Math.min(5, Math.max(1, (typeof kurashiChapter === "function") ? kurashiChapter() : 1));
      rec[g.id] = Math.min(g.phase || ch, ch);
      if (typeof saveGame === "function") saveGame();
    }
    n = rec[g.id];
  } catch (e) {}
  const ph = (typeof GOAL_PHASES !== "undefined" && GOAL_PHASES.find(x => x.id === n)) || null;
  return ph ? ph.label.split(" ")[0] : "島のどこか";
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
  fol100k:    "3万人。……3万人！？💗💗 島いちばんの予想家、目指します",
  protect:    "この島は、渡さない。ぜったいに。🏝️"
};

// =========================================================================
// 📖 連載「島ぐらし」の紙面（データと進行は kiko_serial.js）
// =========================================================================
function _kikoSecHead(title, sub, extra) {
  const h = el("div", "kk-sec");
  h.innerHTML = `<h2 class="kk-sec-t">${title}</h2>` + (sub ? `<span class="kk-sec-s">${sub}</span>` : "") + (extra || "");
  return h;
}

// 表紙（マストヘッド）。写真の上に題字・著者・読者数を重ねる。
function _kikoMasthead(fol, earned, rd) {
  let cover = "images/konron/island_aerial.webp", coverCap = "崑崙島";
  try {
    for (let i = KIKO_SERIAL.length - 1; i >= 0; i--) {
      if (kikoSerialDone(KIKO_SERIAL[i].id)) { const sp = kikoSerialSpot(KIKO_SERIAL[i]); cover = sp.photo; coverCap = sp.name; break; }
    }
  } catch (e) {}
  const _av = (typeof mimiAvatarStyle === "function") ? mimiAvatarStyle() : "";
  const head = el("div", "kk-mast");
  head.innerHTML =
    `<img class="kk-mast-img" src="${cover}" alt="" decoding="async" onerror="this.remove()">` +
    `<div class="kk-mast-shade"></div>` +
    `<div class="kk-mast-in">` +
      `<div class="kk-mast-k">KONRON ISLAND JOURNAL</div>` +
      `<h1 class="kk-mast-t">ドラゴンレース紀行</h1>` +
      `<div class="kk-mast-by"><span class="kk-av" style="${_av}"></span><span>文・写真　ミミ・パホパホ</span><span class="kk-live">連載中</span></div>` +
      `<div class="kk-mast-st"><span>読者 <b>${fol.toLocaleString("ja-JP")}</b> 人</span><i></i><span>累計売上 <b>${fmtCoins(earned)}</b></span></div>` +
      (rd ? `<div class="kk-mast-delta">前回から <b>+${rd.diff.toLocaleString("ja-JP")}</b> 人${rd.why ? `（${rd.why}）` : ""}</div>` : "") +
    `</div>` +
    `<span class="kk-mast-cap">表紙：${coverCap}</span>`;
  return head;
}

// 連載のしくみ（？ボタン）。常設の説明は置かず、ここに畳む。
function _kikoSerialHelp() {
  if (typeof showInfoPopup !== "function") return;
  showInfoPopup("連載「島ぐらし」",
    `<div class="mm-row"><span class="mm-ic">✍️</span><div><b>島で暮らす話を、順番に書いていく連載</b><small>全${KIKO_SERIAL.length}回。書いた回は、いつでも読みかえせます。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏝️</span><div><b>回ごとに「取材先」がある</b><small>条件がそろったら、<u>おでかけ</u>でその場所へ。スポットの画面に「ここで書き上げる」が出ます。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏟️</span><div><b>コースの回は、そこで走ると書ける</b><small>8つの開催地域それぞれに1回。その地域のレースを走る（回によっては当てる）のが条件です。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏁</span><div><b>1回書いたら、次は1戦走ってから</b><small>書くことは、暮らしのなかでたまっていきます。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">👀</span><div><b>書くと、読者が増える</b><small>読者が増えるほど、毎日の売上が増えます。レースの勝ち負けには影響しません。</small></div></div>`);
}

// 取材へ出かける（地図のそのスポットを開く）。島へ出られない間は紀行に留まる。
function _kikoGoSpot(spotId) {
  try {
    if (typeof kmGotoSpot === "function" && kmGotoSpot(spotId)) return;
    if (typeof renderKonronMap === "function") renderKonronMap();
  } catch (e) {}
}

// 回を書く → その回を開く（書き上げた直後の演出つき）。
function _kikoWriteAndOpen(id) {
  const ep = (typeof kikoSerialWrite === "function") ? kikoSerialWrite(id) : null;
  if (!ep) return false;
  try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
  renderKikoEpisode(ep.id, { fresh: true });
  return true;
}

function _kikoSerialSection(app) {
  if (typeof KIKO_SERIAL === "undefined" || typeof kikoSerialNext !== "function") return;
  const total = KIKO_SERIAL.length, done = kikoSerialDoneCount(), nx = kikoSerialNext();
  const d = kikoSerialData();

  const head = _kikoSecHead("連載　島ぐらし", done ? `第${done}回まで ／ 全${total}回` : `全${total}回`,
    `<button class="kk-q" aria-label="連載のしくみ">？</button>`);
  head.querySelector(".kk-q").onclick = _kikoSerialHelp;
  app.appendChild(head);

  // ── 次の取材先 ──
  if (nx) {
    const sp = kikoSerialSpot(nx.ep);
    let spotOpen = !!nx.ep.direct;
    try { if (!spotOpen) spotOpen = konronMapUnlocked() && _kmSpotOpen(KONRON_SPOTS[nx.ep.spot]); } catch (e) { spotOpen = false; }
    const _gainN = (typeof kikoSerialFansFor === "function") ? kikoSerialFansFor(nx.no) : (150 + 50 * nx.no);
    const card = el("div", "ks-next" + (nx.ready ? " ready" : "") + (spotOpen ? "" : " veil"));
    card.innerHTML =
      `<div class="ks-next-ph"><img src="${sp.photo}" alt="" decoding="async" onerror="this.remove()">` +
        `<span class="ks-next-no">第${nx.no}回</span>` +
        (nx.ready ? `<span class="ks-next-flag">${nx.ep.direct ? "書ける" : "取材に行ける"}</span>` : "") + `</div>` +
      `<div class="ks-next-b">` +
        `<div class="ks-next-k">${nx.ready ? "次の取材先" : "次の取材先（準備中）"}</div>` +
        `<div class="ks-next-pl">${sp.name}${sp.area !== sp.name ? `<small>${sp.area}</small>` : ""}</div>` +
        `<p class="ks-next-memo">${nx.ep.memo}</p>` +
        (nx.needs.length ? `<ul class="ks-need">` + nx.needs.map(t => `<li>${t}</li>`).join("") + `</ul>` : "") +
        // ★押す前に、書き上げると何が起きるかを言う（2026-11-13）。以前は「第1回を書く」を押した瞬間に
        //   「書き上げた／編集部へ送りました／読者 +200人」になり、何のための操作かが後から分かる順だった
        //   （Codex の通し試験）。増える人数は既存の決まり（kiko_serial.js kikoSerialFansFor）を読むだけ。
        `<div class="ks-next-gain">✍️ 書き上げると <b>読者 +${_gainN.toLocaleString("ja-JP")}人</b><small>読者が増えるほど、毎日の売上が上がります。</small></div>` +
        (nx.ready ? `<button class="ks-cta">${nx.ep.direct ? `第${nx.no}回を書き上げる` : "取材へ出かける"}</button>`
                  : (spotOpen && !nx.ep.direct ? `<button class="ks-cta ghost">下見に行く</button>` : "")) +
      `</div>`;
    const cta = card.querySelector(".ks-cta");
    if (cta) cta.onclick = (nx.ready && nx.ep.direct) ? () => _kikoWriteAndOpen(nx.ep.id) : () => _kikoGoSpot(nx.ep.spot);
    app.appendChild(card);
  } else {
    app.appendChild(el("div", "ks-fin", `<b>連載「島ぐらし」完結</b><span>全${total}回、書き上げました。島の毎日は、このあとも「日々の記事」につづきます。</span>`));
  }

  // ── あしあと（島の地図に、書いた回の取材先を順に結ぶ）──
  if (done > 0) {
    const map = el("div", "ks-map");
    let pts = "", dots = "";
    let lastAt = null, nAt = 0;
    KIKO_SERIAL.forEach((ep, i) => {
      if (!kikoSerialDone(ep.id) || !ep.at) return;   // コースの回（at 無し）は下の「走ったコース」に並ぶ
      lastAt = ep.at; nAt++;
      pts += (pts ? " " : "") + ep.at[0] + "," + ep.at[1];
      dots += `<button class="ks-dot${d.fresh === ep.id ? " fresh" : ""}" style="left:${ep.at[0]}%;top:${ep.at[1]}%" data-ep="${ep.id}" aria-label="第${i + 1}回">${i + 1}</button>`;
    });
    if (nx && nx.ep.at) dots += `<span class="ks-dot next${nx.ready ? " ready" : ""}" style="left:${nx.ep.at[0]}%;top:${nx.ep.at[1]}%">${nx.no}</span>`;
    map.innerHTML =
      `<img class="ks-map-img" src="images/konron/island_map.webp?v=20260727a" alt="崑崙島の地図" decoding="async">` +
      `<svg class="ks-map-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
        (nAt > 1 ? `<polyline points="${pts}" />` : "") +
        (nx && nx.ep.at && lastAt ? `<line class="to" x1="${lastAt[0]}" y1="${lastAt[1]}" x2="${nx.ep.at[0]}" y2="${nx.ep.at[1]}" />` : "") +
      `</svg>` + dots +
      `<span class="ks-map-cap">あしあと — 書いた回の取材先</span>`;
    map.querySelectorAll("button.ks-dot").forEach(b => { b.onclick = () => renderKikoEpisode(b.getAttribute("data-ep")); });
    app.appendChild(map);
  }

  // ── 走ったコース（8つの開催地域の印。書いた回は写真が入り、まだの回は名前だけ）──
  //   連載の題は『ドラゴンレース紀行』＝島のあしあとと、走ったコースの二本立てで進む。
  try {
    const courses = KIKO_SERIAL.filter(ep => ep.region);
    if (courses.length && (done > 0 || (nx && nx.ep.region))) {
      const strip = el("div", "ks-courses");
      let h = `<div class="ks-courses-k">走ったコース<b>${courses.filter(ep => kikoSerialDone(ep.id)).length} / ${courses.length}</b></div><div class="ks-courses-row">`;
      courses.forEach(ep => {
        const dn = kikoSerialDone(ep.id), sp = kikoSerialSpot(ep), nm = ep.region.replace(/地域$/, "");
        const isNext = nx && nx.ep.id === ep.id;
        // まだ走れない地域（ランク不足）の名前は伏せる＝先のコースを先に見せない
        let known = dn || isNext; try { known = known || ((state.player.rank || 1) >= _ksRegionRank(ep.region)); } catch (e) {}
        // 書いた回だけが押せる（まだの回は札＝ボタンにしない。押せないボタンの枠を並べない）
        const tag = dn ? "button" : "span";
        h += `<${tag} class="ks-course${dn ? " done" : ""}${isNext ? " next" : ""}"${dn ? ` data-ep="${ep.id}"` : ""}>` +
          `<span class="ks-course-ph">${dn ? `<img src="${sp.photo}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}</span>` +
          `<span class="ks-course-n">${known ? nm : "？？？"}</span></${tag}>`;
      });
      strip.innerHTML = h + `</div>`;
      strip.querySelectorAll("button[data-ep]").forEach(b => { b.onclick = () => renderKikoEpisode(b.getAttribute("data-ep")); });
      app.appendChild(strip);
    }
  } catch (e) {}

  // ── 書いた回（順番に並ぶ表紙の列。いちばん新しい回が右端）──
  if (done > 0) {
    const rail = el("div", "ks-rail");
    KIKO_SERIAL.forEach((ep, i) => {
      if (!kikoSerialDone(ep.id)) return;
      const sp = kikoSerialSpot(ep);
      const c = el("button", "ks-card" + (d.fresh === ep.id ? " fresh" : ""));
      c.innerHTML = `<img src="${sp.photo}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` +
        `<span class="ks-card-no">第${i + 1}回</span>` + (d.fresh === ep.id ? `<span class="ks-card-new">NEW</span>` : "") +
        `<span class="ks-card-t">${ep.title}</span><span class="ks-card-pl">${sp.name}</span>`;
      c.onclick = () => renderKikoEpisode(ep.id);
      rail.appendChild(c);
    });
    if (nx) rail.appendChild(el("div", "ks-card more", `<span class="ks-card-more">つづく</span><span class="ks-card-rest">あと ${total - done} 回</span>`));
    app.appendChild(rail);
    // いちばん新しい回が見えるところまで送る（順に読みたい人は左へ戻れる）
    setTimeout(() => { try { rail.scrollLeft = rail.scrollWidth; } catch (e) {} }, 0);
  }
}

// ── 📄 連載の1回を読む（WEBマガジンの記事面）──────────────────────────
function renderKikoEpisode(id, opts) {
  opts = opts || {};
  const ep = (typeof kikoSerialById === "function") ? kikoSerialById(id) : null;
  if (!ep || !kikoSerialDone(id)) { renderKiko(); return; }
  state.ui.screen = "kiko_read";
  state.ui._kikoEp = id;
  const app = beginScreen();
  app.classList.add("kiko-page", "ke-page");
  if (!opts.keepScroll) window.scrollTo(0, 0);

  const no = kikoSerialNo(id), sp = kikoSerialSpot(ep), d = kikoSerialData();
  const wroteAt = d.done[id] || 0;
  const _av = (typeof mimiAvatarStyle === "function") ? mimiAvatarStyle() : "";
  const art = el("article", "ke");

  let html =
    `<header class="ke-hero"><img class="ke-hero-img" src="${sp.photo}" alt="${sp.name}" decoding="async" onerror="this.remove()">` +
    `<div class="ke-hero-shade"></div><div class="ke-hero-in">` +
      `<div class="ke-no">連載　島ぐらし<b>第${no}回</b></div>` +
      `<h1 class="ke-title">${ep.title}</h1>` +
      `<div class="ke-meta">${sp.area !== sp.name ? `<span>${sp.area}</span>` : ""}<span>${sp.name}</span><span>島に来て${wroteAt}戦め</span></div>` +
    `</div></header>`;
  const _fans = (d.fans && d.fans[id]) || 0;
  if (opts.fresh) html += `<div class="ke-fresh"><b>書き上げた</b><span>第${no}回の原稿を、編集部へ送りました。</span>` +
    (_fans ? `<i class="ke-fresh-fans">読者 +${_fans.toLocaleString("ja-JP")}人</i>` : "") + `</div>`;
  html += `<div class="ke-body">` +
    `<p class="ke-lead">${ep.lead}</p>` +
    `<div class="ke-by"><span class="kk-av" style="${_av}"></span><span>文・写真　ミミ・パホパホ</span></div>`;
  // コースの回＝そのコースでの自分の戦績を、取材ノートとして添える（読むたびに今の数字＝通うほど育つ）
  if (ep.region) {
    try {
      const cr = kikoCourseOf(ep.region);
      html += `<div class="ke-course"><div class="ke-course-k">取材ノート — ${ep.region.replace(/地域$/, "")}でのわたし</div>` +
        `<div class="ke-course-r"><span><b>${cr.n}</b>戦</span><span><b>${cr.hit}</b>的中</span>` +
        (cr.last ? `<span class="w">さいごに見た一着<b>${cr.last}</b></span>` : "") + `</div></div>`;
    } catch (e) {}
  }
  ep.paras.forEach((t, i) => {
    html += `<p>${t}</p>`;
    if (i === 1 && ep.sub) html += `<figure class="ke-fig"><img src="${ep.sub.src}" alt="" loading="lazy" decoding="async" onerror="this.closest('.ke-fig').remove()"><figcaption>${ep.sub.cap}</figcaption></figure>`;
    if (i === 2 && ep.quote) html += `<blockquote class="ke-quote">${ep.quote}</blockquote>`;
  });
  html += `<div class="ke-end">第${no}回　おわり</div></div>`;
  art.innerHTML = html;
  app.appendChild(art);
  if (opts.fresh) { try { const f = art.querySelector(".ke-fresh"); if (typeof celebrateFrom === "function") setTimeout(() => celebrateFrom(f, "grant"), 260); else if (typeof celebrate === "function") celebrate("grant"); } catch (e) {} }

  // 次回の取材メモ（いちばん新しい回を読み終えたところにだけ出す＝次の行き先が決まる）
  try {
    const nx = kikoSerialNext();
    if (nx && nx.idx === no) {
      const nsp = kikoSerialSpot(nx.ep);
      const box = el("div", "ke-next" + (nx.ready ? " ready" : ""));
      box.innerHTML = `<div class="ke-next-k">次回の取材メモ</div>` +
        `<p class="ke-next-memo">${nx.ep.memo}</p>` +
        `<div class="ke-next-pl">取材先　<b>${nsp.name}</b>${nsp.area !== nsp.name ? `<small>${nsp.area}</small>` : ""}</div>` +
        (nx.needs.length ? `<ul class="ks-need">` + nx.needs.map(t => `<li>${t}</li>`).join("") + `</ul>` : "");
      app.appendChild(box);
    }
  } catch (e) {}

  // この回で歩いたあたり（寄り道）＝読んだ場所へ、そのまま出かけられる
  try {
    const ids = [ep.spot].concat(ep.detour || []).filter(x => typeof KONRON_SPOTS !== "undefined" && KONRON_SPOTS[x]);
    // ★島へ出られるようになる前は出さない（「？」の札が並ぶだけで、押せるものが何もないため）。
    const mapOpen = (typeof konronMapUnlocked === "function") && konronMapUnlocked();
    if (ids.length && mapOpen) {
      app.appendChild(_kikoSecHead("この回で歩いたあたり", "読んだ場所へ。"));
      const row = el("div", "ke-detour");
      ids.forEach(sid => {
        const s = KONRON_SPOTS[sid];
        let open = false; try { open = mapOpen && _kmSpotOpen(s) && (typeof _kmHiddenQuiet !== "function" || _kmHiddenQuiet(sid)); } catch (e) { open = false; }
        const b = el("button", "ke-spot" + (open ? "" : " lock"));
        b.innerHTML = (open && s.photo ? `<img src="${s.photo}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : `<span class="ke-spot-q">？</span>`) +
          `<span class="ke-spot-n">${open ? s.name : (mapOpen ? s.name : "島のどこか")}</span>` +
          `<span class="ke-spot-s">${open ? "行ってみる" : (mapOpen ? "まだ行けない" : "島へ出られるようになってから")}</span>`;
        if (open) b.onclick = () => _kikoGoSpot(sid);
        row.appendChild(b);
      });
      app.appendChild(row);
    }
  } catch (e) {}

  // 読者から
  try {
    const cs = kikoSerialComments(ep);
    if (cs.length) {
      const box = el("div", "ke-cmts");
      let h = `<div class="kiko-cmt-h">読者から</div>`;
      cs.forEach(c => {
        h += `<div class="kiko-cmt"><span class="kcm-av">${c.ic}</span><div class="kcm-b">` +
          `<div class="kcm-h"><b>${c.n}</b><span>${c.h}</span></div><div class="kcm-t">${c.t}</div><div class="kcm-f">★ ${c.fav}</div></div></div>`;
      });
      box.innerHTML = h;
      app.appendChild(box);
    }
  } catch (e) {}

  // 前の回／次の回
  const nav = el("div", "ke-nav");
  const prev = KIKO_SERIAL[no - 2], next = KIKO_SERIAL[no];
  const mk = (e2, label, cls) => {
    if (!e2 || !kikoSerialDone(e2.id)) return el("span", "ke-nav-b off " + cls, "");
    const b = el("button", "ke-nav-b " + cls, `<small>${label}</small><b>${e2.title}</b>`);
    b.onclick = () => renderKikoEpisode(e2.id);
    return b;
  };
  nav.appendChild(mk(prev, `← 第${no - 1}回`, "prev"));
  nav.appendChild(mk(next, `第${no + 1}回 →`, "next"));
  app.appendChild(nav);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "紀行へ戻る"); back.onclick = () => renderKiko();
  actions.appendChild(back);
  app.appendChild(actions);

  // 書き上げた直後は🆕を残す（紀行へ戻ったとき、どの回が増えたか分かる）。読みかえしたら消える。
  if (!opts.fresh && typeof kikoSerialMarkRead === "function") kikoSerialMarkRead(id);
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
  // 今日の売上（印税）が未受取なら、ここでも受け取れる。
  //   ★以前はホーム初到着のポップだけが受け取り口で、見送った日・日付をまたいだ日は紀行タブのドットが
  //     点きっぱなしなのに開いても何も起きなかった（ドットの行き先が無い）。
  try {
    const _lb = (typeof checkDailyLogin === "function") && checkDailyLogin();
    if (_lb && typeof showLoginBonus === "function") setTimeout(() => { if (state.ui.screen === "kiko") showLoginBonus(_lb); }, 380);
  } catch (e) {}

  const fol = (typeof goalFollowers === "function") ? goalFollowers() : 0;
  const earned = p.kikoEarned || 0;
  const cs = (typeof collectionScoreParts === "function") ? collectionScoreParts() : { pct: 0 };

  // ヘッダー＝ブログの顔。表紙は「いちばん最近書いた連載の取材先」の写真
  //   ＝開くたびに、いまミミが島のどこまで歩いたかが一目でわかる（まだ1回も無ければ島の全景）。
  // ★M4 理由つき前回比＝前回ここを開いてから増えた読者を「なぜ増えたか」つきで1行だけ。
  //   グラフも目標カウンタも置かない（計器禁止）。増えていない時は何も出さない。
  const rd = (typeof kikoReaderDelta === "function") ? kikoReaderDelta() : null;
  app.appendChild(_kikoMasthead(fol, earned, rd));

  // 📖 連載「島ぐらし」＝紀行の背骨（kiko_serial.js）。次の取材先 → あしあと → 書いた回。
  try { _kikoSerialSection(app); } catch (e) { try { console.warn("kiko serial:", e); } catch (_) {} }

  // ✍️ 記事（実プレイの出来事から書かれたもの）。まだ1本も無ければ、従来の「今日の更新」。
  const arts = (p.kikoArts && p.kikoArts.length) ? p.kikoArts : null;
  app.appendChild(_kikoSecHead("日々の記事", "勝った日、負けた日、食べた日。"));
  if (arts) {
    app.appendChild(_kikoArtCard(arts[0], { comments: true }));
    if (arts.length > 1) {
      app.appendChild(el("div", "kiko-sec", "すこし前の記事"));
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
  app.appendChild(_kikoSecHead("カテゴリ", "集めた記録を、読みかえす。"));
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
  app.appendChild(_kikoSecHead("紀行のあゆみ", ""));
  const tl = el("div", "kiko-tl");
  const _kav = (typeof mimiAvatarStyle === "function") ? mimiAvatarStyle() : "";
  let tlHtml =
    `<div class="ktw-prof"><span class="ktw-av big" style="${_kav}"></span><div><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span></div>` +
    `<div class="ktw-fol"><b>${fol.toLocaleString("ja-JP")}</b><span>フォロワー</span></div></div>` +
    `<div class="ktw pinned"><span class="ktw-av" style="${_kav}"></span><div class="ktw-b">` +
      `<div class="ktw-pin">📌 固定されたツイート</div>` +
      `<div class="ktw-h"><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span></div>` +
      `<div class="ktw-t">記事の充実度、いま <b>${cs.pct}%</b>！ 島で食べて・出会って・撮って・集めるほど記事が増えて、毎日の売上が上がるよ📈 がんばる！</div>` +
      `<div class="ktw-a"><span>返信</span><span>リツイート</span><span class="fav">★ ふぁぼ</span></div></div></div>`;
  try {
    const done = GOALS.filter(g => goalDone(g));
    done.forEach(g => _kikoAyumiWhen(g));       // 達成した時期を、はじめて見たときに控える（下の関数）
    const recent = done.slice(-6).reverse();   // 新しい実績が上（昔のTLと同じ・最新が先頭）
    recent.forEach((g, i) => {
      const masked = (typeof goalMasked === "function") && goalMasked(g);
      const text = (!masked && _KIKO_TWEETS[g.id]) || `${(typeof goalIconSafe === "function") ? goalIconSafe(g) : ""} ${(typeof goalTitleSafe === "function") ? goalTitleSafe(g) : g.title}、達成！`;
      const when = _kikoAyumiWhen(g);
      const rt = 2 + ((i * 7 + (done.length * 3)) % 29);
      const fav = 5 + ((i * 13 + fol) % 97);
      tlHtml +=
        `<div class="ktw"><span class="ktw-av" style="${_kav}"></span><div class="ktw-b">` +
        `<div class="ktw-h"><b>ミミ・パホパホ</b><span>@mimi_pahopaho</span><i>・${when}のころ</i></div>` +
        `<div class="ktw-t">${text}</div>` +
        `<div class="ktw-a"><span>返信</span><span>リツイート ${rt}</span><span class="fav">★ ${fav}</span></div></div></div>`;
    });
    if (!recent.length) tlHtml += `<div class="ktw"><span class="ktw-av" style="${_kav}"></span><div class="ktw-b">` +
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

  // ▸ このあとの島時間（M2の出口チップ）＝紀行は「読んで終わる駅」なので行き止まりにしない
  try { const _nx = (typeof nextSuggestRow === "function") && nextSuggestRow("kiko"); if (_nx) app.appendChild(_nx); } catch (e) {}

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
  window.renderKikoEpisode = renderKikoEpisode;
  window.renderMediaHub = renderMediaHub;
  window.playKikoIntro = playKikoIntro;
}
