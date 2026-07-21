// =============================================================================
// ui_story.js — 物語・相談の画面（CODEMAP §6・分割第3弾）。
// =============================================================================
// ★2026-07-18 コンセプト一新：「異世界新聞・聖龍日報」→ 密着ドキュメンタリー『ミミ、爆走中。』
//   リサーチ（推し活プラットフォームWeverse/bubble・Netflixの話数閲覧・FUDGE系WEBマガジン）より、
//   若い読者が熱心に読む3要素＝①推しとの距離の近さ ②大サムネ＋EP番号の「次を見たくなる」導線
//   ③余白と太い短い見出し。ホーム＝TikTok配信と同じ世界（ミミは配信者）なので、物語＝
//   「彼女の公式密着ドキュメンタリー」が最も自然。章＝EPISODE・小イベント＝OFF SHOT・
//   相談役＝MENTORS（証言者）。記事体の本文は「取材ノート＋証言」としてそのまま活きる。
//   renderStory / renderStoryChapter / renderConsult / showStoryEvent。クラス名（.news-*）は
//   互換のため維持（スキンはstyle.cssで全面刷新）。参照（STORY_CHAPTERS/STORY_CAST/Dialogue/DLG/
//   getStoryFlag/epilogueStart/playShinganCutin/photoOr/showStoryArt/chapterDisplayTitle/
//   storyUnlockAt/castUnlockAt/fmtCoins 等）は不変。
//   ★完全に表示専用＝着順・オッズ・配当・経済に非干渉（[[race-math-immutable]]）。
// =============================================================================

// シリーズヒーロー（旧・新聞題字）。leftMeta/rightMeta＝ロゴ下のメタ情報チップ2つ。
function _newsMast(leftMeta, rightMeta) {
  const m = el("div", "news-mast");
  m.innerHTML =
    `<div class="news-mast-top"><span>MIMI&nbsp;OFFICIAL</span><span class="live-dot"></span><span>DOCUMENTARY&nbsp;SERIES</span></div>` +
    `<div class="news-title">ミミ、爆走中<span class="ttl-dot">。</span></div>` +
    `<div class="news-sub">RUN,&nbsp;BUNNY,&nbsp;RUN</div>` +
    `<div class="news-mast-rule">${leftMeta ? `<span>${leftMeta}</span>` : ""}${rightMeta ? `<span>${rightMeta}</span>` : ""}</div>`;
  return m;
}
// 見出し罫（rubric）。labelHTML はHTML可（件数バッジ等）。
function _newsRubric(labelHTML) { return el("div", "news-rubric", labelHTML); }

// ★門番の薄いラッパ（正本は data_assets.js の advisorMet/castNameSafe/castSymbolSafe/castColorSafe/castStrangerSeen）。
//   読み込み順の事故で未定義でも落とさず「伏せる側」へ倒す＝fail-closed（ネタバレは取り消せない・非表示は無害）。
function _csMet(k)      { return (typeof advisorMet === "function") ? !!advisorMet(k) : false; }
function _csName(k)     { return (typeof castNameSafe === "function") ? castNameSafe(k) : "？？？"; }
function _csSym(k)      { return (typeof castSymbolSafe === "function") ? castSymbolSafe(k) : "❓"; }
function _csColor(k)    { return (typeof castColorSafe === "function") ? castColorSafe(k) : "#8a8175"; }
function _csStranger()  { return (typeof castStrangerSeen === "function") ? !!castStrangerSeen() : false; }

function renderStory() {
  state.ui.screen = "story";
  recomputeAssets(state);
  const total = assetsPeak(state);   // 公開条件の進捗＝解放判定と同じ到達最高で見せる（バーとロックがズレない）
  const app = beginScreen();

  const news = el("div", "news");
  const issue = (state.player.completedRaces || 0) + 1;
  const unlockedCount = STORY_CHAPTERS.filter(ch => (typeof chapterAvailable === "function") ? chapterAvailable(ch.id) : (total >= storyUnlockAt(ch.id))).length;

  // シリーズヒーロー
  news.appendChild(_newsMast(`配信 ${issue} 日目`, `EP ${unlockedCount}／${STORY_CHAPTERS.length} 公開中`));

  // シノプシス（あらすじ）
  const lead = el("div", "news-lead");
  lead.innerHTML =
    `借金まみれで島に流れ着いたバニー娘が、竜レースで人生を取り返すまで。` +
    `本人も知らなかった舞台裏を、<b>5人の証言</b>と未公開映像で追う。総資産を積むほど、次のエピソードが公開される。`;
  news.appendChild(lead);

  // EPISODES（章一覧）＝話数カード
  news.appendChild(_newsRubric(`EPISODES <span class="news-rub-n">本編・全${STORY_CHAPTERS.length}話</span>`));
  const arts = el("div", "news-arts");
  STORY_CHAPTERS.forEach((ch, _ci) => {
    // ★「解禁（＝読める）」と「登場（＝読んだ）」は別物。ここを混同していたのが本丸の穴。
    //   新規スタートの総資産は 1000+村2000＝3000＝第2話のしきい値ちょうど。旧コードは unlocked だけで
    //   カードを開いていたため、1行も読まないうちに chapterDisplayTitle（＝STORY_CAST.name の本名）で
    //   「ミズ・アオラ」、肩書「エコノミスト」、顔写真、テーマ色が一面に出ていた（第5話も総資産1億で
    //   「セレスティア・ブラックメテオ／世界の天井／神眼」が未読のまま露出＝R3違反）。
    //   未読の記事は「読める」ことだけ伝え、寄稿者の名・顔・記号・肩書・章題（章題にも名が入る）は伏せる。
    const unlocked = (typeof chapterAvailable === "function") ? chapterAvailable(ch.id) : (total >= storyUnlockAt(ch.id));   // 「読める」か（前章既読＋実績・正本）
    const met = _csMet(ch.cast);                      // 出会ったか（しきい値 AND その章を読んだ・R1）
    const cast = STORY_CAST[ch.cast];
    const art = el("button", "news-art" + (unlocked ? "" : " locked"));
    // テーマ色も門番経由（未登場は無彩色）。解禁済みでも未読なら寄稿者はまだ他人＝色でも正体を出さない。
    if (cast) art.style.setProperty("--na", _csColor(ch.cast));
    const photo = !unlocked
      ? `<span class="news-photo-s locked"><span class="sym">🔒</span></span>`
      : met
        ? `<span class="news-photo-s">${photoOr("images/story/" + ch.id + ".jpg", `<span class="sym">${cast ? _csSym(ch.cast) : "🐲"}</span>`)}</span>`
        // 未読＝顔写真を出さない。記号は門番経由（❓／セレスティアの伏線段階だけ🌌）。
        : `<span class="news-photo-s"><span class="sym">${cast ? _csSym(ch.cast) : "🐲"}</span></span>`;
    // EP番号＝カードの主役（Netflix式の話数導線）。EDはFINAL。
    const epNo = ch.id === "ED" ? "FINAL" : `EP.${String(_ci + 1).padStart(2, "0")}`;
    const kicker = !unlocked ? `${epNo} ─ COMING SOON`
      : met ? `${epNo} ─ ${cast ? cast.tag : (ch.id === "ED" ? "最終回" : "特報")}`
      : `${epNo} <span class="news-stamp">NEW</span>`;
    const head = !unlocked ? `<span class="news-censor">■■■■■■</span>`
      : met ? chapterDisplayTitle(ch)
      // 未視聴の見出しは「第N話」だけ（ED は元から名を含まない）。固有名を出さずに予告する（R7）。
      : (ch.id === "ED" ? "エンディング" : `第${ch.id}話　<span class="news-censor">■■■■</span>`);
    const lead2 = !unlocked
      ? `公開条件 ／ ${(typeof chapterUnlockHint === "function" && chapterUnlockHint(ch.id)) || ("総資産 " + fmtCoins(storyUnlockAt(ch.id)) + " で公開")}`
      : met ? (ch.id === "ED" ? "次なる物語へ——最終話。" : ch.title)
      : "未視聴 ／ タップで再生";
    art.innerHTML = photo +
      `<span class="news-art-tx"><span class="news-kicker">${kicker}</span>` +
        `<span class="news-head">${head}</span><span class="news-lead2">${lead2}</span></span>` +
      (unlocked ? `<span class="news-art-go">▶</span>` : `<span class="news-art-seal">🔒</span>`);
    if (unlocked) art.onclick = () => renderStoryChapter(ch.id);
    arts.appendChild(art);
  });
  news.appendChild(arts);

  // ★特別號＝クリア後の送り出し（B3解消・docs/GAME_FLOW_REDESIGN.md §3）。ED到達後のみ掲載。
  //   物語の側から「次はこれで遊べる」を記事として案内する（表示専用・goto導線のみ）。
  // edFlagの実体は state.player.epilogue（epilogue_engine.js epData()）＝ state.epilogue ではない
  // （誤パス参照だと実EDで特別號が出ない＝QAで自分が偽パスを作って自己合格していた反省込み）。
  const _edReached = (typeof epData === "function") ? !!epData().edFlag
    : !!(state.player && state.player.epilogue && state.player.epilogue.edFlag);
  if (typeof STORY_EXTRA_ISSUE !== "undefined" && _edReached) {
    news.appendChild(_newsRubric(`SPECIAL <span class="news-rub-n">クリア後の島</span>`));
    const ex = el("div", "news-lead");
    ex.textContent = STORY_EXTRA_ISSUE.lead;
    news.appendChild(ex);
    const exArts = el("div", "news-arts");
    STORY_EXTRA_ISSUE.articles.forEach(a => {
      const art = el("button", "news-art");
      art.innerHTML =
        `<span class="news-photo-s"><span class="sym">${a.icon}</span></span>` +
        `<span class="news-art-tx"><span class="news-kicker">AFTER STORY</span>` +
          `<span class="news-head">${a.title}</span><span class="news-lead2">${a.body}</span></span>` +
        `<span class="news-art-go">▸</span>`;
      art.onclick = () => { if (typeof goto === "function") goto(a.go); };
      exArts.appendChild(art);
    });
    news.appendChild(exArts);
    news.appendChild(el("div", "news-quote", STORY_EXTRA_ISSUE.quote));
  }

  // 號外コラム（小イベント＝短い挿話・進行で解放・再読可）。js/data_story_events.js
  if (typeof storyEvents === "function") {
    const evs = storyEvents();
    const st = (typeof storyEventsStats === "function") ? storyEventsStats() : { got: evs.length, total: evs.length, unread: 0 };
    news.appendChild(_newsRubric(`OFF SHOT <span class="news-rub-n">こぼれ話 ${st.got}／${st.total}${st.unread ? `・NEW ${st.unread}` : ""}</span>`));
    if (!evs.length) {
      news.appendChild(el("div", "news-empty", "——撮れ高はこれから。物語が進むと、カメラに映らなかった小さな話が届く。"));
    } else {
      const briefs = el("div", "news-briefs");
      evs.forEach(e => {
        const read = (typeof storyEventRead === "function") ? storyEventRead(e.id) : true;
        const b = el("button", "news-brief" + (read ? "" : " unread"));
        b.innerHTML =
          `<span class="news-brief-h">${read ? "" : `<span class="news-stamp">NEW</span>`}<span class="news-brief-ic">${e.ic || "✨"}</span>${e.title}</span>` +
          (e.who ? `<span class="news-brief-b">── ${e.who}</span>` : "");
        b.onclick = () => showStoryEvent(e);
        briefs.appendChild(b);
      });
      news.appendChild(briefs);
    }
  }

  // フッター（操作ボタン）
  const foot = el("div", "news-foot");
  const btns = el("div", "news-btns");
  const consultBtn = el("button", "news-btn", "🎙 MENTORS ─ 証言者たち"); consultBtn.onclick = () => renderConsult();
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
    `<div class="news-clip-mast"><span>OFF&nbsp;SHOT</span><span>ミミ、爆走中。</span><span>こぼれ話</span></div>` +
    `<div class="news-clip-ic">${e.ic || "✨"}</div>` +
    `<div class="news-clip-head">${e.title}</div>` +
    (e.who ? `<div class="news-clip-by">── ${e.who}</div>` : "") +
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
  if (!ch || ((typeof chapterAvailable === "function") ? !chapterAvailable(ch.id) : (assetsPeak(state) < storyUnlockAt(ch.id)))) { renderStory(); return; }
  // 読み飛ばしガード：手前に“解禁済みなのに未読”の話が残っていたら、先にそこから読んでもらう（順番厳守）。
  //   ＝総資産だけで終章へ飛び、配信も体験しないまま結末のセリフを踏む断絶を防ぐ（表示のみ・レース数値に非干渉）。
  if (typeof getStoryFlag === "function") {
    var _order = ["1", "2", "3", "4", "5", "ED"], _i = _order.indexOf(chId);
    for (var _k = 0; _k < _i; _k++) {
      var _pid = _order[_k];
      if ((typeof chapterAvailable === "function") ? !chapterAvailable(_pid) : (assetsPeak(state) < storyUnlockAt(_pid))) continue;   // まだ解禁前の話は飛ばして良い
      if (!getStoryFlag("_chapter_intro_" + _pid)) {
        if (typeof showInfoPopup === "function") showInfoPopup("📖 先に前のお話を",
          `<div class="mm-row"><span class="mm-ic">📖</span><div><b>ちょっと待って！</b><small>いきなり結末まで飛ぶと、ミミが置いてけぼりで泣いちゃう。まずは手前のお話から、順番にどうぞ。</small></div></div>`);
        renderStory();
        return;
      }
    }
  }
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
  // 小出しⒷⒸ：ポロ発見済み＆該当章(4=マクラ/5=セレスティア)を読んだ後、初回だけ後日談を再生。
  if (typeof maybePlayPoroFollowupOnChapter === "function") maybePlayPoroFollowupOnChapter(ch.id);
  // 第4話「マクラと推し竜文化」を開く＝図鑑（推し竜の記録）を解放。
  if (ch.id === "4" && typeof setStoryFlag === "function" && !getStoryFlag("metMakura")) setStoryFlag("metMakura", true);
  // 第5話「セレスティアの神眼」を開く＝終章（絶滅メーターの綱引き）起動。
  if (ch.id === "5" && typeof epilogueStart === "function") epilogueStart();
  // ▲▲ 物語ロジックここまで ▲▲

  const app = beginScreen();   // 上部に「← 物語」
  const news = el("div", "news news-article");

  // EPバッジ（話数）＋エピソードタイトル（headline）。旧タイトルは肩の subhead に降ろす。
  const _epIdx = STORY_CHAPTERS.findIndex(c => c.id === ch.id);
  const _epNo = ch.id === "ED" ? "FINAL EPISODE" : `EPISODE ${String(_epIdx + 1).padStart(2, "0")}`;
  news.appendChild(el("div", "news-kicker news-kicker-lg",
    `${_epNo}${cast ? `<span class="ep-cast"> ─ ${cast.tag}</span>` : ""}`));
  news.appendChild(el("div", "news-headline", ch.headline || chapterDisplayTitle(ch)));
  news.appendChild(el("div", "news-subhead", ch.title));
  if (cast) news.appendChild(el("div", "news-byline", `出演：${cast.name}（${cast.tag}）　／　授けるもの＝${cast.gives}`));
  // リード＝あらすじ（本文の前に1段）
  if (ch.lead) news.appendChild(el("div", "news-lead", ch.lead));

  // キービジュアル（タップで全画面）
  const photo = el("div", "news-photo viewable");
  photo.innerHTML =
    `<div class="news-photo-img">${photoOr("images/story/" + ch.id + ".jpg", `<span class="sym">${cast ? cast.symbol : "🐲"}</span>`)}` +
      `<span class="news-photo-zoom">🔍 全画面</span></div>` +
    `<div class="news-cap"><span class="news-cap-tag">SCENE</span>${ch.scene || ""}</div>`;
  photo.onclick = () => showStoryArt(ch);
  news.appendChild(photo);

  // 本文（明朝＝ナレーションの声・両端揃え）
  // ★本文は「読ませる」場面。初読は段落ごとに文字を送って出し、出し切るまで
  //   先へ進めない（流し読みで飛ばせない）。既読なら即座に全文。js/story_reveal.js
  const bodyEl = el("div", "news-text");
  news.appendChild(bodyEl);

  // フッター
  const foot = el("div", "news-foot");
  const btns = el("div", "news-btns");
  const back = el("button", "news-btn prim", "◀ エピソード一覧へ"); back.onclick = () => renderStory();
  btns.appendChild(back);
  foot.appendChild(btns);
  news.appendChild(foot);
  app.appendChild(news);

  // ★読み上げは「画面に載せたあと」に始める。載せる前に始めると、本文がまだ
  //   親に繋がっておらず「画面から消えた」と誤判定して即終了する（実際そうなった）。
  if (typeof srRevealInto === "function") srRevealInto(bodyEl, ch.body, ch.id);
  else bodyEl.textContent = ch.body || "";
}

// =========================================================================
// 相談 (consult)：ドキュメンタリーの「MENTORS＝証言者」名鑑。出会った顧問の視点を載せる。
// Flavor only; never affects race math.
// =========================================================================
function renderConsult() {
  state.ui.screen = "consult";
  recomputeAssets(state);
  const total = assetsPeak(state);   // 公開条件の進捗＝解放判定と同じ到達最高で見せる（バーとロックがズレない）
  const app = beginScreen();

  const news = el("div", "news");
  news.appendChild(_newsMast("MENTORS", "5人の証言者"));
  const lead = el("div", "news-lead");
  lead.innerHTML =
    `答えではなく、<b>視点</b>をくれる人たち。ミミが島で出会った5人が、それぞれの眼でレースと暮らしを読み解く。`;
  news.appendChild(lead);

  news.appendChild(_newsRubric(`MENTORS <span class="news-rub-n">証言者名鑑</span>`));
  // C5解消：各顧問の「機能としての効果」を1行明記（特に神眼1.1倍の在り処＝レース詳細画面）。
  const CONSULT_EFFECT = {
    celestia: "🔮 効果：レース詳細の「1着を聞く」＝その竜の単勝・複勝が最低1.1倍で確実（答えは知れ渡り配当は縮む・使うかは任意）",
    _default: "📖 効果：予想の視点を授ける読みもの（レース結果への介入なし）"
  };
  const arts = el("div", "news-arts");
  Object.keys(STORY_CAST).forEach(k => {
    const c = STORY_CAST[k];
    // ★門番：登場の述語は advisorMet（総資産しきい値 AND その章を読んだ）だけ。旧判定 total>=castUnlockAt では
    //   新規スタートの総資産3000＝ミズのしきい値のため、第2話を1行も読まずに名簿へ顔・氏名・肩書・決めゼリフが出ていた。
    const unlocked = _csMet(k);
    const art = el("div", "news-art news-art-consult" + (unlocked ? "" : " locked"));
    art.style.setProperty("--na", _csColor(k));   // 未登場は無彩色＝テーマ色から正体を推測させない
    if (unlocked) {
      const photo = `<span class="news-photo-s">${photoOr("images/cast/" + k + ".png", `<span class="sym">${_csSym(k)}</span>`)}</span>`;
      art.innerHTML = photo +
        `<span class="news-art-tx"><span class="news-kicker">${c.tag}</span>` +
          `<span class="news-head">${_csName(k)}</span>` +
          `<span class="news-lead2">${c.focus}　／　授けるもの＝${c.gives}</span>` +
          `<span class="news-quote">「${c.consult}」</span>` +
          `<span class="news-lead2">${CONSULT_EFFECT[k] || CONSULT_EFFECT._default}</span></span>`;
    } else {
      // 未登場：名前・記号は門番経由のみ（セレスティアの伏線段階だけ「あのお姉さん🌌」＝本名・☄️・肩書・神眼は伏せる）。
      const stranger = (k === "celestia") && _csStranger();
      const chId = (STORY_CHAPTERS.find(x => x.cast === k) || {}).id;
      // 案内の出し分け：しきい値未達なら金額、到達済み・章未読なら「第N話を読むと初登場」（固有名は出さない・R7）。
      const hint = (total >= castUnlockAt(k) && chId)
        ? `第${chId}話を読むと初登場`
        : `総資産 ${fmtCoins(castUnlockAt(k))} にて初登場`;
      art.innerHTML =
        `<span class="news-photo-s locked"><span class="sym">${_csSym(k)}</span></span>` +
        `<span class="news-art-tx"><span class="news-kicker">${stranger ? "素性不明" : "？？？"}</span>` +
          `<span class="news-head">${stranger ? _csName(k) : `<span class="news-censor">■■■■</span>`}</span>` +
          `<span class="news-lead2">${hint}</span></span>`;
    }
    arts.appendChild(art);
  });
  news.appendChild(arts);

  const foot = el("div", "news-foot");
  const btns = el("div", "news-btns");
  const storyBtn = el("button", "news-btn", "🎬 エピソード一覧へ"); storyBtn.onclick = () => renderStory();
  const back = el("button", "news-btn prim", "🏠 ホームへ"); back.onclick = () => renderHome();
  btns.appendChild(storyBtn); btns.appendChild(back);
  foot.appendChild(btns);
  news.appendChild(foot);
  app.appendChild(news);
}
