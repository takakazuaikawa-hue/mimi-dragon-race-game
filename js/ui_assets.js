// =============================================================================
// ui_assets.js — 暮らしと資産の画面群（CODEMAP §6・分割第2弾）。
// =============================================================================
// ★ui_render.js から無改変で抽出：renderAssets / renderActiveSkills /
//   showSkillTitleCutin / renderLifeTree / renderLifeCollection ＋ _lifeTab / _ltJustUnlocked。
//   参照（state / el / recomputeAssets / LIFE_* / lifetree_engine 関数 / showLifeCutin(ui_render) 等）は
//   すべてグローバル共有なので別ファイルでも不変。呼び出しは renderHome のナビ・nav.js から call-time。
// =============================================================================

let _lifeTab = null;   // 選択中の枝（null は自動選択）

// 🏦 資産の内訳＝計算式をそのまま見せるポップアップ。
// ★これが「資産」という数字への唯一の説明責任。合計だけ大きく出して中身を隠すと、
//   増えた/減った理由が分からず、プレイヤーは数字を追うのをやめてしまう。
//   六成分を実データから並べ、足すと合計に一致することを目で確認できるようにする。
function showAssetBreakdown() {
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  const p = state.player, a = state.assets;
  const rows = [
    ["🪙", "手持ちのコイン", p.coins || 0, "いま賭けに使えるお金。"],
    ["🏘", "村", a.villageValue || 0, "村のレベルが上がると増える。"],
    ["🏗", "施設", a.facilityValue || 0, "島に建てた施設の価値。投資するとここが増える。"],
    ["🛋", "暮らし", a.livingValue || 0, "手に入れた生活用品や住まいの価値。"],
    ["📣", "名声", a.fameValue || 0, "ランク・勝利数・最高配当から決まる評判の値打ち。"],
    ["🐲", "竜", a.dragonValue || 0, "図鑑に載せた竜・推し竜の数。"],
    ["🏝", "島づくり投資", a.islandValue || 0, "島に注いだ投資の累計。投資は消えない＝資産に形を変える。"]
  ];
  const sum = rows.reduce((s, r) => s + r[2], 0);
  const body =
    rows.map(r =>
      `<div class="mm-row"><span class="mm-ic">${r[0]}</span><div><b>${r[1]}　${fmtCoins(r[2])}</b><small>${r[3]}</small></div></div>`
    ).join("") +
    `<div class="mm-row mm-sum"><span class="mm-ic">🏦</span><div><b>合計＝資産　${fmtCoins(sum)}</b>` +
      `<small>これらを足しただけの数字です。コインで島に投資すれば、コインが減って投資が増える＝合計はほとんど変わりません。ごはんなどで使い切った分だけ、本当に減ります。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🔓</span><div><b>お話やお店が開く条件は、減りません</b>` +
      `<small>解放の判定には「これまでに届いた最高額（${fmtCoins((typeof assetsPeak === "function") ? assetsPeak(state) : sum)}）」を使います。資産を使ったせいで、読めた話が読めなくなることはありません。</small></div></div>`;
  if (typeof showInfoPopup === "function") showInfoPopup("🏦 資産の内訳", body);
}

// 暮らし＝コンパクトなダッシュボード。状態は小さくグラフィカルに、情報量の多いもの
//（スキルツリー＝約200ノード／コレクション＝約200点）は専用画面へ遷移させてスクロールを抑える。
// 🎯 目標（クエスト）／🍽️ 食事（みみしんぼ）の画面は js/ui_meta.js へ抽出済み（CODEMAP §6・分割第1弾）。
//   renderGoals / renderMeals / showMealDetail / _mealTab はそちら。ロジックは無改変で移動しただけ。

// お部屋のミミのミニ絵＝いま着ている衣装のもの。
// ★衣装idとファイル名が同名という約束（images/cast/mimi/mimi_<id>_mini.png）。
//   衣装の取得に失敗しても、絵が欠けていても、既定の1枚に落として必ず何かを返す。
function _lrRoomMimiSrc() {
  const FALLBACK = "images/cast/mini/mimi_loading1_mini.png";
  try {
    const id = (typeof currentOutfitId === "function")
      ? currentOutfitId()
      : (state && state.player ? state.player.outfit : null);
    return id ? `images/cast/mimi/mimi_${id}_mini.png` : FALLBACK;
  } catch (e) { return FALLBACK; }
}

function renderAssets() {
  state.ui.screen = "assets";
  recomputeAssets(state);
  const p = state.player, a = state.assets;
  const total = p.totalAssets;
  const level = Math.max(0, Math.min(a.unlockedLifeStages || 0, 5));
  const st = lifeTreeStats();
  const app = beginScreen();
  app.classList.add("lr-page");   // J-URBAN風の紙質感はこの画面だけに限定（他画面のas-entry/as-breakは不変）。
  const _h2 = el("h2", null, `暮らしと資産 <button class="info-q" title="お金のしくみ">？</button>`);
  _h2.querySelector(".info-q").onclick = () => showMoneyMap();
  app.appendChild(_h2);

  // ★くらしツリー・生活資産は第3話「スミカと総資産」を読むと開放（progression再設計・docs/PROGRESSION_DESIGN.md）。
  // ※部屋ヒーローの暮らしP表示のタップ導線でも使うため、先に確定させる。
  const _ch3unlocked = (typeof getStoryFlag === "function") && getStoryFlag("_chapter_intro_3");

  // いまのお部屋ヒーロー（J-URBAN=室内を主役に）。部屋tier=assetLevelOf(総資産)＝ホームと同じ基準（ui_home.js:185）。
  const _roomT = (typeof roomLevel === "function") ? roomLevel() : 0;
  const _hr = (new Date()).getHours(); const _dn = (_hr >= 6 && _hr < 18) ? "day" : "night";
  const hero = el("div", "card lr-room");
  hero.style.backgroundImage = `url('images/homebg/myroom_t${_roomT}_${_dn}.webp')`;
  hero.innerHTML =
    `<span class="lr-room-seal">${(typeof roomName === "function") ? roomName(_roomT) : "いまのお部屋"}<b>Lv.${_roomT}</b></span>` +
    // ★お部屋のミミは、いま着ている衣装のミニ絵にする。
    //   ここは mimi_loading1_mini.png を直書きしていたため、モールで
    //   着替えても暮らし画面だけ昔の服のままだった（ユーザー指摘）。
    //   ミニ絵は images/cast/mimi/mimi_<衣装id>_mini.png（衣装idと同名）。
    //   未納品の衣装があるので onerror で既定の1枚に落とす（欠けても壊さない）。
    `<img class="lr-room-mimi" src="${_lrRoomMimiSrc()}" alt="ミミ" decoding="async"` +
      ` onerror="this.onerror=null;this.src='images/cast/mini/mimi_loading1_mini.png'">` +
    `<div class="lr-room-info"><div class="lr-room-lbl">資産</div>` +
      `<div class="lr-room-total">${fmtCoins(total)}</div>` +
      `<div class="lr-room-p">内訳を見る ▸</div></div>`;
  app.appendChild(hero);
  // 旧「暮らしP ◇n」の枠を、資産の内訳（計算式）への入口に置き換え。
  // 残高が出るのに減らない指標を見せるより、「何がいくらで合計いくらか」を開ける方が役に立つ。
  const _roomPEl = hero.querySelector(".lr-room-p");
  _roomPEl.style.cursor = "pointer";
  _roomPEl.onclick = () => { if (typeof showAssetBreakdown === "function") showAssetBreakdown(); };

  // ★引っ越し：コインで部屋を一段上げる（総資産では自動で上がらない）。くらしツリーと同じ「コインで解放」の作法。
  if (typeof canMoveRoom === "function") {
    const _mvNext = _roomT + 1;
    const _mvPrice = roomMovePrice();
    const _mvOK = (p.coins || 0) >= _mvPrice;
    const mv = el("button", "lr-move" + (canMoveRoom() ? (_mvOK ? "" : " short") : " maxed"));
    mv.innerHTML = canMoveRoom()
      ? `<span class="lr-move-ic">🚚</span><span class="lr-move-tx">` +
          `<b>「${roomName(_mvNext)}」へ引っ越す（Lv.${_mvNext}）</b>` +
          `<small>${_mvOK
            ? `費用 ${fmtCoins(_mvPrice)} ／ 引っ越すと残り ${fmtCoins((p.coins || 0) - _mvPrice)}`
            : `費用 ${fmtCoins(_mvPrice)} ／ 所持 ${fmtCoins(p.coins || 0)}（足りない）`}</small>` +
        `</span><span class="as-entry-ch">›</span>`
      : `<span class="lr-move-ic">🏯</span><span class="lr-move-tx"><b>「${roomName(5)}」——これ以上の家はない</b>` +
        `<small>ミミの暮らしは、島のてっぺんまで来た。</small></span>`;
    mv.onclick = () => {
      const r = tryMoveRoom();
      if (r.ok) {
        try { if (window.Sfx) Sfx.play("coin"); } catch (e) {}
        if (typeof showInfoPopup === "function") showInfoPopup("🚚 引っ越し完了！",
          `<div class="mm-row"><span class="mm-ic">🏠</span><div><b>「${roomName(r.level)}」（Lv.${r.level}）に移りました</b>` +
          `<small>−${fmtCoins(r.price)}　ホームの背景も、新しいお部屋になります。</small></div></div>`);
        renderAssets();
      } else if (r.broke && typeof showInfoPopup === "function") {
        showInfoPopup("🚚 まだ引っ越せない",
          `<div class="mm-row"><span class="mm-ic">🪙</span><div><b>コインが足りません</b>` +
          `<small>「${roomName(_mvNext)}」の費用は ${fmtCoins(r.price)}。いまの所持は ${fmtCoins(r.coins)}。レースで稼いで戻ってきてね。</small></div></div>`);
      }
    };
    app.appendChild(mv);
  }

  // 🏅 暮らしレベル（旧「村Lv」）。★表示だけの再構成＝数値も伸び方も不変。
  //   「村Lv」は 専用画面・設定の重複カード・資産の内訳 の3箇所に散っていたので、
  //   暮らしを正面の置き場所にして、称号・恩恵・次の条件を1枚にまとめた。
  //   ★次の条件は state.js gainVillageExp の実式（的中で rank×15／しきい値 Lv×100）から出す。
  //     ここに「スキルツリーを進めよう」等の実在しない条件を書かない（文章だけ古びる事故の元）。
  if (typeof livingRankOf === "function" && typeof livingRankProgress === "function") {
    const pr = livingRankProgress(state);
    const rk = livingRankOf(pr.lv);
    const _rescue = (typeof RESCUE_COINS !== "undefined" && RESCUE_COINS[pr.lv]) || 0;
    const _mult = (typeof VILLAGE_MULT !== "undefined" && VILLAGE_MULT[pr.lv]) || 1.0;
    const nextRk = pr.max ? null : livingRankOf(pr.lv + 1);
    const card = el("div", "card lrank");
    card.innerHTML =
      `<div class="lrank-h">🏅 暮らしレベル</div>` +
      `<div class="lrank-top"><span class="lrank-lv">Lv.${pr.lv}</span>` +
        `<span class="lrank-title">${rk.title}</span></div>` +
      `<div class="lrank-note">${rk.note}</div>` +
      `<div class="lrank-gain"><span>💛 救済 <b>${fmtCoins(_rescue)}</b></span>` +
        `<span>🎰 賭金の上限 <b>×${_mult}</b></span></div>` +
      (pr.max
        ? `<div class="lrank-next">この島で、これ以上の暮らしは無い。</div>`
        : `<div class="lrank-bar${pr.blocked ? " blocked" : ""}"><div style="width:${pr.pct}%"></div></div>` +
          // ★expが満ちている（＝あと0）ときに「あと0」と出すと、なぜ上がらないのか分からない。
          //   満ちているなら「修行はじゅうぶん」と言い切り、理由は下のブロックに任せる。
          `<div class="lrank-next">次は <b>Lv.${pr.lv + 1}「${nextRk.title}」</b>　` +
            (pr.exp >= pr.need
              ? `<b>レースの経験はもうじゅうぶん</b>`
              : `あと <b>${pr.need - pr.exp}</b>（レースで<u>的中</u>すると貯まる／上のランクほど大きい）`) +
          `</div>` +
          // ★頭打ちの理由と、必要なノード数を必ず出す。ここが見えないと「なぜ上がらないのか
          //   分からない」＝理不尽になる（ツリーは一本道を1つずつ進める形なので特に）。
          (pr.blocked
            ? `<button class="lrank-block"><span>🌳 <b>暮らしが追いついていない</b>` +
                `<small>くらしスキルツリーを <b>あと${pr.needNodes}個</b> 進めると Lv.${pr.lv + 1} が開きます` +
                `（いま ${pr.nodes}／${pr.lv * 20} 個）</small></span><span class="as-entry-ch">›</span></button>`
            : ""));
    if (pr.blocked) {
      const b = card.querySelector(".lrank-block");
      if (b) b.onclick = () => { if (typeof renderLifeTree === "function") renderLifeTree(); };
    }
    app.appendChild(card);
  }

  const _avA = advisorVoiceEl("assets"); if (_avA) app.appendChild(_avA);

  // 内訳（小さなセグメントバー＝グラフィカル）
  // ★内訳は assets_engine.js の ASSET_PARTS（合計計算と同じ正本）から引く＝ラベルの二重管理をやめた。
  //   新しい資産項目を足すときは ASSET_PARTS に1行足すだけで、合計・バー・説明文が同時に追従する。
  const parts = ((typeof assetPartsOf === "function") ? assetPartsOf(state) : []).filter(x => x[1] > 0);
  const sum = parts.reduce((s, x) => s + x[1], 0) || 1;
  const _asBreak = el("div", "card as-break",   // ※「できること」の後（詳細）に配置するため、ここでは組むだけ。
    `<div class="as-break-bar">${parts.map(x => `<div style="width:${x[1] / sum * 100}%;background:${x[2]}"></div>`).join("")}</div>` +
    `<div class="as-break-legend">${parts.map(x => `<span><i style="background:${x[2]}"></i>${x[0]} ${fmtCoins(x[1])}</span>`).join("")}</div>` +
    `<div class="as-break-rescue">💛 破産しても安心 — 救済見込み <b>${fmtCoins(calculateRescueCoins(state, p.rank))}</b></div>`);

  // 情報量が多いものは専用画面へ遷移（小さなグラフィカルな入口）
  // ★解放はコインのみ（暮らしP撤廃）。readyは「prereq充足」だけでなく「コインで実際に払えるか」も見る。
  let ready = false; let _readyNodeForTodo = null;
  LIFE_BRANCHES.forEach(b => {
    const pr = lifeBranchProgress(b.id);
    if (pr.next && lifeNodeState(pr.next) === "ready" &&
        (p.coins || 0) >= ((typeof lifeNodePrice === "function") ? lifeNodePrice(pr.next) : 0)) {
      ready = true; if (!_readyNodeForTodo) _readyNodeForTodo = pr.next;
    }
  });
  const colOwned = LIFE_ASSETS.filter(it => isLifeAssetUnlocked(state, it, level)).length;
  const unlockedCh = STORY_CHAPTERS.filter(ch => (typeof chapterAvailable === "function") ? chapterAvailable(ch.id) : (total >= storyUnlockAt(ch.id))).length;
  const skTitles = ACTIVE_SKILLS.filter(s => ((p.activeSkills || {})[s.id] || 0) >= s.levels.length).length;
  const entry = (ic, label, sub, badge, onClick, avatarSrc) => {
    const avatar = avatarSrc ? `<img class="as-entry-mini" src="${avatarSrc}" alt="" onerror="this.remove()">` : "";
    const b = el("button", "as-entry",
      `<span class="as-entry-ic">${ic}</span><span class="as-entry-tx"><span class="as-entry-l">${label}${badge ? ` <span class="as-entry-badge">${badge}</span>` : ""}</span>` +
        `<span class="as-entry-s">${sub}</span></span>${avatar}<span class="as-entry-ch">›</span>`);
    b.onclick = onClick; return b;
  };
  const ent = el("div", "as-entries");
  // _ch3unlocked は冒頭（部屋ヒーローの暮らしPタップ導線）で確定済み。

  // ── すべきこと（今アクションがある時だけ・動的に上部へ）：迷わず次の一手。無ければ非表示。 ──
  const todo = [];
  const _nextCh = (typeof STORY_CHAPTERS !== "undefined") ? STORY_CHAPTERS.find(ch =>
    ch.id !== "ED" && ((typeof chapterAvailable === "function") ? chapterAvailable(ch.id) : (total >= storyUnlockAt(ch.id))) &&
    !(typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_" + ch.id))) : null;
  // ★門番：_nextCh は定義上「未読の章」＝その章の顧問はまだ未登場。章題そのものに固有名が入っている
  //   （「第2話　ミズの分析予想」「第5話　セレスティアの神眼」＝本名も“神眼”も露出）ので、出会っている
  //   顧問の章だけ章題を出し、それ以外は「第N話」までに伏せる（R7：予告はするが固有名は出さない）。
  if (_nextCh) {
    const _ncMet = (typeof advisorMet === "function") && advisorMet(_nextCh.cast);   // 未定義なら伏せる側（fail-closed）
    todo.push({ ic: "📖", label: "新しい話が読める", sub: _ncMet ? _nextCh.title : `第${_nextCh.id}話`, onClick: () => renderStory() });
  }
  if (_ch3unlocked && ready && _readyNodeForTodo) {
    const _rtPrice = (typeof lifeNodePrice === "function") ? lifeNodePrice(_readyNodeForTodo) : 0;
    todo.push({ ic: "🌳", label: "くらしツリーが取り入れられる", sub: `${_readyNodeForTodo.title}・🪙${_rtPrice.toLocaleString("ja-JP")}`, onClick: () => renderLifeTree() });
  }
  const _nextSkill = ACTIVE_SKILLS.find(s => ((p.activeSkills || {})[s.id] || 0) < s.levels.length);
  const _fee = (typeof lessonFee === "function") ? lessonFee() : 0;
  if (_nextSkill && (p.coins || 0) >= _fee) todo.push({ ic: "🎫", label: "習い事に通える", sub: `${_nextSkill.name}・🪙${_fee.toLocaleString("ja-JP")}で通える`, onClick: () => renderActiveSkills() });
  if (todo.length) {
    app.appendChild(el("div", "lr-sec lr-sec--todo", `<span>すべきこと</span>`));
    const td = el("div", "lr-todo");
    todo.forEach(t => {
      const b = el("button", "lr-todo-item",
        `<span class="lr-todo-ic">${t.ic}</span><span class="lr-todo-tx"><b>${t.label}</b><small>${t.sub}</small></span><span class="as-entry-ch">›</span>`);
      b.onclick = t.onClick; td.appendChild(b);
    });
    app.appendChild(td);
  }
  // ── できること：常設機能。担当師範がいる行はminiを添える（images/cast/mini/・第◯話で会うと表示）。 ──
  // ★門番は advisorMet() に一本化する。
  //   ここだけ「章番号が進んでいるか」で判定していたため、同じ画面の中で
  //   判定が二通りに分かれていた（すぐ下の相談行は advisorMet を使っている）。
  //   章が解放されただけで“まだ読んでいない”顧問のミニキャラが出てしまう。
  //   advisorMet は章を読了したフラグで判定し、読めない時は false に倒れる
  //   （fail-closed）ので、未登場のキャラが漏れることが構造的に無くなる。
  const _shihanMini = (skillId) => {
    const m = (typeof _shihanOf === "function") ? _shihanOf(skillId) : null;
    if (!m) return null;
    const met = (typeof advisorMet === "function") ? advisorMet(m.id) : false;
    return met ? `images/cast/mini/${m.id}_mini.png` : null;
  };
  // 🏦 島の経済：島の景気・名声・フォロワー・レース経済を一望（終章中は絶滅メーター本体もここに）。js/ui_economy.js
  if (typeof renderEconomy === "function") {
    const epOn = (typeof epilogueOn === "function") && epilogueOn();
    ent.appendChild(entry("🏦", "島の経済", epOn ? "総資産・名声・村の景気… ＋ ☄️絶滅メーターの綱引き" : "総資産・名声・フォロワー・村の景気＝島の経済状態", epOn ? "☄️終章" : "", () => renderEconomy()));
  }
  // 🏘️ 竜の村＝暮らしレベルの中身（施設ロードマップ・解放竜）。★設定にあった重複カードを撤去した
  //   受け皿。暮らしレベルのカードから自然に降りられる位置に置く。
  if (typeof renderVillage === "function") {
    const _v = state.player.village || {};
    const _dn = (typeof DRAGONS !== "undefined") ? DRAGONS.length : 0;
    ent.appendChild(entry("🏘️", _v.name || "竜の村",
      `施設と解放竜　🐉 ${((_v.unlockedDragonIds || []).length)}/${_dn}`, "", () => renderVillage()));
  }
  // 「できること」＝実際に今できることだけ。未開放は locked に分けて別見出しへ（ここに混ぜると「できる」が嘘になる＝ユーザー指摘）。
  // ★2026-07-30 IA再編（docs/KIKO_READER_IA_REDESIGN.md §4）：暮らし＝「する」専用に痩せた。
  //   移動先＝📖物語→📱メディアタブ／🎁生活資産コレクション→📖紀行#おかいもの／🏆コレクション得点→📖紀行のあゆみ。
  const locked = el("div", "as-entries");
  // ★くらしツリー・生活資産は第3話「スミカと総資産」を読むと開放（progression再設計・docs/PROGRESSION_DESIGN.md）。_ch3unlocked は上（すべきこと判定）で確定済み。
  if (_ch3unlocked) {
    ent.appendChild(entry("🌳", "くらしスキルツリー", `解放 ${st.unlockedCount}/${st.totalNodes} ・ いま取れる ${st.readyCount}`, ready ? "振れる!" : "", () => renderLifeTree()));
  } else {
    // ★同上：第3話未読＝スミカ未登場なので、章の副題（固有名）を伏せた予告にする（R7）。
    locked.appendChild(entry("🔒", "くらしツリー・生活資産", "第3話を読むと開放", "", () => {
      // 解禁条件の文は chapterUnlockHint（実績ゲートの正本）から引く＝旧「総資産3万」の化石テキスト排除。
      const _enH3 = (typeof chapterUnlockHint === "function" && chapterUnlockHint("3")) || "";
      if (typeof showInfoPopup === "function") showInfoPopup("🌱 くらしツリー・生活資産",
        `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small><u>第3話</u>を読むと、くらしツリーと生活資産が開放されます${_enH3 ? `（第3話は${_enH3}）` : ""}。</small></div></div>`);
    }));
  }
  // 習い事：次に通える師範のミニ肖像を添える（未登場の師範なら無し＝ネタバレしない）。
  ent.appendChild(entry("🎫", "習い事（アクティブスキル）", `称号 ${skTitles} / ${ACTIVE_SKILLS.length} 獲得 ・ ミミの暮らしの記録`, skTitles >= ACTIVE_SKILLS.length ? "コンプ!" : "", () => renderActiveSkills(), _nextSkill ? _shihanMini(_nextSkill.id) : null));
  // （📖物語は📱メディアタブへ移設＝2026-07-30 IA再編。unlockedCh は他表示で使用中のため残置）
  // 相談（顧問）はホームのナビから移設＝暮らしハブに配置（予想の視点をもらう・任意）。
  // E4：予想の相談も第2話「ミズの分析」で解禁（1章は勘レース）。表示ゲートのみ・数値不変。
  if (typeof renderConsult === "function") {
    if (typeof analysisUnlocked === "function" && !analysisUnlocked()) {
      // ★ロック案内では未登場の顧問名（＝第2話の副題も含む）を出さない。予告は「第2話」まで（R7）。
      locked.appendChild(entry("🔒", "相談（顧問）", "第2話を読むと、予想の相談ができます。", "", () => {
        // 解禁条件の文は chapterUnlockHint（実績ゲートの正本）から引く＝旧「総資産3千」の化石テキスト排除。
        const _coH2 = (typeof chapterUnlockHint === "function" && chapterUnlockHint("2")) || "";
        if (typeof showInfoPopup === "function") showInfoPopup("💬 相談（顧問）",
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ相談できません</b><small><u>第2話</u>を読むと、出会った顧問に予想の視点をもらえます${_coH2 ? `（第2話は${_coH2}）` : ""}。いまはカンで勝負！</small></div></div>`);
      }));
    } else {
      // ★門番：誘い文に並べるのは「もう出会った顧問」だけ（遷移先の相談画面は未登場を？？？で伏せている＝そこと矛盾させない）。
      const _metNames = ["sake", "mizu", "sumika", "makura", "celestia"]
        .filter(k => (typeof advisorMet === "function") && advisorMet(k))
        .map(k => ((typeof castNameSafe === "function") ? castNameSafe(k) : "？？？").split("・")[0]);
      const _consultSub = _metNames.length
        ? `${_metNames.join("・")}から、予想の視点をもらいます。`
        : "顧問から、予想の視点をもらいます。";
      // 分析（相談）を最初に開いたミズを代表として添える（未登場なら肖像も出さない＝ネタバレしない）。
      const _mizuMet = (typeof advisorMet === "function") && advisorMet("mizu");
      ent.appendChild(entry("💬", "相談（顧問）", _consultSub, "", () => renderConsult(), _mizuMet ? "images/cast/mini/mizu_mini.png" : null));
    }
  }
  app.appendChild(el("div", "lr-sec", `<span>できること</span>`));
  app.appendChild(ent);
  if (locked.children.length) {
    app.appendChild(el("div", "lr-sec lr-sec--locked", `<span>この先で解放されること</span>`));
    app.appendChild(locked);
  }
  app.appendChild(_asBreak);   // 内訳＝詳細として下に。

  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// K3-A4（docs/KURASHI_STORY_WEAVE.md A4）：師範制＝各習い事に物語人物の師範を紐付け。
// 登場章前は「？？？」（progressionのロック2表現）。紋は images/kurashi/shihan_<id>.webp
// （CODEX納品スロット・未着なら絵文字にフォールバック）。表示専用・レース数値不変。
const SKILL_SHIHAN = {
  sake:   { name: "サケ・ウダダ",   ic: "🍶", color: "#c9a24a", ch: 1, skills: ["tea", "gym"],
            word: "体と肚が据わりゃ、目も据わる。" },
  mizu:   { name: "ミズ",           ic: "💧", color: "#5aa0d0", ch: 2, skills: ["invest", "english"],
            word: "価値はね、言葉と数字でできてるの。" },
  sumika: { name: "スミカ・ラグナ", ic: "🏘️", color: "#b08fd0", ch: 3, skills: ["cooking", "volunteer"],
            word: "暮らしの手仕事が、いちばんの才能です。" },
  makura: { name: "実況マクラ",     ic: "🎤", color: "#e0a050", ch: 4, skills: ["reading", "yoga"],
            word: "声と物語は、鍛えた分だけ遠くへ届く。" }
};
function _shihanOf(skillId) {
  for (const k in SKILL_SHIHAN) if (SKILL_SHIHAN[k].skills.indexOf(skillId) >= 0) return Object.assign({ id: k }, SKILL_SHIHAN[k]);
  return null;
}

// 専用画面：習い事（アクティブスキル）。通うとレベルが上がり、効果テキストと称号がつくだけの
// 完全な表示専用メタ進行。コイン・資産・着順・オッズ・配当には一切触れない。
function renderActiveSkills() {
  state.ui.screen = "active_skills";
  // ★K1：師範と出会った章で画面を開いたら、積んでいた実地経験を「開花」させる（fail-closed）。
  if (typeof fieldBloom === "function") fieldBloom();
  if (!state.player.activeSkills) state.player.activeSkills = {};
  const as = state.player.activeSkills;
  const app = beginScreen();
  app.appendChild(el("h2", null, "習い事（アクティブスキル）"));

  // ── 師範ボード（章連動・表示のみ）：誰に何を教わるかが物語と繋がる ──
  try {
    const chNow = Math.min((typeof kurashiChapter === "function") ? kurashiChapter() : 1, 6);
    const board = el("div", "shihan-board");
    Object.keys(SKILL_SHIHAN).forEach(id => {
      const m = SKILL_SHIHAN[id];
      const met = chNow >= m.ch;
      const mastered = m.skills.filter(sid => {
        const sk = ACTIVE_SKILLS.find(x => x.id === sid);
        return sk && (as[sid] || 0) >= sk.levels.length;
      }).length;
      const kaiden = met && mastered >= m.skills.length;
      const chip = el("div", "shihan-chip" + (kaiden ? " kaiden" : "") + (met ? "" : " unmet"));
      chip.style.setProperty("--shc", m.color);
      chip.innerHTML = met
        ? `<span class="shihan-crest"><img src="images/kurashi/shihan_${id}.webp" alt="" onerror="this.remove()"><i>${m.ic}</i></span>` +
          `<span class="shihan-id"><b>${m.name}</b><small>${kaiden ? "🎓 免許皆伝！" : "皆伝 " + mastered + "/" + m.skills.length}</small></span>` +
          `<span class="shihan-word">“${m.word}”</span>`
        : `<span class="shihan-crest"><i>❓</i></span>` +
          `<span class="shihan-id"><b>？？？</b><small>第${m.ch}話で出会う</small></span>`;
      board.appendChild(chip);
    });
    app.appendChild(board);
  } catch (e) {}
  // C7解消：この画面の目的と称号の関係を1行で明示（無説明で放置されない）。
  app.appendChild(el("div", "as-hint2", "「通う」を選ぶほど上達していく、ミミの暮らしの記録。極めると<b>称号</b>を獲得＝ホーム左上のプロフィール（🏅▾）で付け替えられます。コイン・総資産・レース結果には影響しません。"));

  const titles = ACTIVE_SKILLS.filter(s => (as[s.id] || 0) >= s.levels.length).length;
  app.appendChild(el("div", "as-hint2",
    `称号 <b>${titles} / ${ACTIVE_SKILLS.length}</b> 獲得　` +
    `<span class="as-hint">通うほど上達。レース結果には影響しない、ミミの“暮らしの記録”です。</span>`));

  // ホームに飾っている称号（ロードアウト式・表示専用）
  const eq = state.player.equippedTitle || null;
  if (eq) {
    const ek = ACTIVE_SKILLS.find(s => s.id === eq);
    if (ek && (as[ek.id] || 0) >= ek.levels.length) {
      app.appendChild(el("div", "askill-eqbanner", `🏅 ホームに飾り中：称号「${ek.title}」`));
    }
  }

  const grid = el("div", "askill-grid");
  ACTIVE_SKILLS.forEach(s => {
    const max = s.levels.length;
    const lv = Math.min(as[s.id] || 0, max);
    const maxed = lv >= max;
    const isEq = eq === s.id;
    // ★K1：実地で上げたレベルは金ドット（遊びで身についた分が一目で分かる）。左詰めで実地→月謝の順に塗る。
    const _gold = (typeof fieldGoldDots === "function") ? Math.min(fieldGoldDots(s.id), lv) : 0;
    const dots = Array.from({ length: max }, (_, i) => `<span class="askill-dot${i < lv ? (i < _gold ? " on field" : " on") : ""}"></span>`).join("");
    const card = el("div", "askill" + (maxed ? " maxed" : "") + (isEq ? " equipped" : ""));
    // K3-A4: 師範チップ（登場章前は？？？＝誰に教わるかも物語の楽しみ）
    const _m = (typeof _shihanOf === "function") ? _shihanOf(s.id) : null;
    const _chNow2 = Math.min((typeof kurashiChapter === "function") ? kurashiChapter() : 1, 6);
    // 師範とまだ出会っていない習い事は通えない（「師範？？？」なのに通えるのは矛盾＝ユーザー指摘）。
    const _shihanMet = !_m || _chNow2 >= _m.ch;
    const _mTag = _m ? (_shihanMet
      ? `<span class="askill-shihan" style="--shc:${_m.color}">${_m.ic} 師範 ${_m.name}</span>`
      : `<span class="askill-shihan unmet">❓ 師範 ？？？</span>`) : "";
    card.innerHTML =
      `<div class="askill-top">` +
        `<span class="askill-ic">${s.icon}</span>` +
        `<span class="askill-id"><span class="askill-nm">${s.name}</span><span class="askill-tag">${s.tag}</span>${_mTag}</span>` +
        `<span class="askill-lv">${maxed ? "極" : "Lv" + lv}</span>` +
      `</div>` +
      `<div class="askill-dots">${dots}</div>` +
      // ★K1 実地の由来（遊びで上がった分がある時だけ・金色）
      (_gold > 0 ? `<div class="askill-field">✨ 実地で ${_gold} つ上達（遊びの成果）</div>` : "") +
      `<div class="askill-effect">${maxed
        ? `🏅 称号「${s.title}」を獲得！`
        : !_shihanMet ? `師範とまだ出会っていない。` : (lv > 0 ? s.levels[lv - 1] : "まだ通っていない。")}</div>` +
      (!maxed && _shihanMet ? `<div class="askill-next"><span>次</span>${s.levels[lv]}</div>` : "");
    if (!maxed && !_shihanMet) {
      card.classList.add("locked");
      const go = el("button", "askill-go locked", "🔒 師範とまだ出会っていない");
      go.onclick = () => {
        if (typeof showInfoPopup === "function") showInfoPopup("❓ 師範 ？？？",
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ通えません</b><small>第${_m.ch}話で師範と出会うと、「${s.name}」に通えるようになります。</small></div></div>`);
      };
      card.appendChild(go);
    } else if (!maxed) {
      // E2：月謝制（基準単価×2）。払えたら1回通う。価格をボタンに明示。
      const _fee = (typeof lessonFee === "function") ? lessonFee() : 0;
      const go = el("button", "askill-go", (lv > 0 ? "また通う" : "通ってみる") + `　🪙${_fee.toLocaleString("ja-JP")}`);
      go.onclick = () => {
        if (typeof tryPayLesson === "function" && !tryPayLesson(s.name)) return;   // 月謝が払えなければ通えない
        const nv = Math.min((as[s.id] || 0) + 1, max);
        as[s.id] = nv;
        if (typeof saveGame === "function") saveGame();
        if (nv >= max) showSkillTitleCutin(s);
        renderActiveSkills();
      };
      card.appendChild(go);
    } else {
      const eqBtn = el("button", "askill-equip" + (isEq ? " on" : ""), isEq ? "✓ ホームに飾り中" : "🏅 称号を飾る");
      eqBtn.onclick = () => {
        state.player.equippedTitle = isEq ? null : s.id;
        if (typeof saveGame === "function") saveGame();
        renderActiveSkills();
      };
      card.appendChild(eqBtn);
    }
    grid.appendChild(card);
  });
  app.appendChild(grid);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}

// 称号獲得カットイン（表示専用・約1.1秒／タップで即スキップ）。showLifeCutin と同じ見た目を流用。
function showSkillTitleCutin(skill) {
  try {
    const ex = document.getElementById("lt-cutin"); if (ex) ex.remove();
    if (_ltCutinTimer) { clearTimeout(_ltCutinTimer); _ltCutinTimer = null; }
    const ov = el("div", "lt-cutin"); ov.id = "lt-cutin";
    ov.style.setProperty("--bc", "#e6b24a");
    ov.innerHTML =
      `<div class="lt-cutin-flash"></div><div class="lt-cutin-lines"></div>` +
      `<div class="lt-cutin-band"><div class="lt-cutin-inner">` +
        `<div class="lt-cutin-ic">${skill.icon}</div>` +
        `<div class="lt-cutin-tx">` +
          `<div class="lt-cutin-kicker">${skill.name}・極めた！</div>` +
          `<div class="lt-cutin-title">称号「${skill.title}」</div>` +
          `<div class="lt-cutin-sub">ミミ、また一歩……！</div>` +
        `</div>` +
      `</div></div>`;
    ov.onclick = () => { if (_ltCutinTimer) { clearTimeout(_ltCutinTimer); _ltCutinTimer = null; } ov.remove(); };
    document.body.appendChild(ov);
    try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
    _ltCutinTimer = setTimeout(() => {
      const o = document.getElementById("lt-cutin");
      if (o) { o.classList.add("out"); setTimeout(() => { if (o) o.remove(); }, 260); }
      _ltCutinTimer = null;
    }, 1150);
  } catch (e) {}
}

// 専用画面：くらしスキルツリー（枝タブ＋星座チェーン＋振り直し）
// 直近に解放したノード（点灯ポップ演出を一度だけ再生するためのフラグ）
let _ltJustUnlocked = null;
// K3-A2（docs/KURASHI_STORY_WEAVE.md A2）：スミカの宿題＝章連動の推奨チェックリスト。
// b=LIFE_BRANCHES のインデックス・n=目標節数。達成表示のみ・報酬なし（表示専用メタ）。
const SUMIKA_HOMEWORK = {
  3: { note: "まずは食と住から。倒れない暮らしが、いい予想を作るんです。", items: [{ b: 0, n: 2 }, { b: 1, n: 2 }] },
  4: { note: "配信の時代ですから。装いと遊びにも、少しだけ投資を。", items: [{ b: 2, n: 3 }, { b: 4, n: 3 }] },
  5: { note: "ここまで来たら、全部の枝を。暮らしの厚みが、島の底力になります。", items: [{ b: 0, n: 4 }, { b: 3, n: 4 }, { b: 5, n: 4 }] },
  6: { note: "……もう宿題はありません。あなたの暮らしが、みんなのお手本です。", items: [] }
};
function renderLifeTree() {
  state.ui.screen = "life_tree";
  recomputeAssets(state);
  const st = lifeTreeStats();
  const app = beginScreen();   // 上部に「← 暮らし」が付く
  app.appendChild(el("h2", null, "くらしスキルツリー"));
  app.appendChild(el("div", "as-hint2", `解放 <b>${st.unlockedCount}</b>/${st.totalNodes} ／ いま取れる <b>${st.readyCount}</b>　<span class="as-hint">レースで稼いだコインで、ひとつずつ暮らしを買っていく</span>`));

  // ── スミカの宿題（章連動・表示のみ）──
  try {
    const ch = Math.min(Math.max((typeof kurashiChapter === "function") ? kurashiChapter() : 3, 3), 6);
    const hw = SUMIKA_HOMEWORK[ch];
    if (hw) {
      const rows = hw.items.map(it => {
        const b = LIFE_BRANCHES[it.b]; if (!b) return "";
        const pr = lifeBranchProgress(b.id);
        const ok = pr.done >= it.n;
        return `<div class="sh-row${ok ? " ok" : ""}"><span>${ok ? "☑" : "☐"}</span> ${b.icon} ${b.name}の枝を ${it.n} 節まで <i>（いま ${pr.done}）</i></div>`;
      }).join("");
      // ★門番：宿題の主（スミカ）の名前も castNameSafe 経由（この画面は第3話既読が前提だが、名前は必ず門番を通す＝fail-closed）。
      const _swName = ((typeof castNameSafe === "function") ? castNameSafe("sumika") : "？？？").split("・")[0];
      const box = el("div", "card sh-box");
      box.innerHTML =
        `<div class="sh-t">🏘️ ${_swName}の宿題 <small>${ch >= 6 ? "クリア後" : "第" + ch + "話"}</small></div>` +
        `<div class="sh-note">「${hw.note}」</div>` + rows;
      app.appendChild(box);
    }
  } catch (e) {}

  if (!_lifeTab || !LIFE_TREE[_lifeTab]) {
    _lifeTab = LIFE_BRANCHES[0].id;
    for (let i = 0; i < LIFE_BRANCHES.length; i++) {
      const pr = lifeBranchProgress(LIFE_BRANCHES[i].id);
      if (pr.next && lifeNodeState(pr.next) === "ready") { _lifeTab = LIFE_BRANCHES[i].id; break; }
    }
  }
  const tabs = el("div", "lt-tabs");
  LIFE_BRANCHES.forEach(b => {
    const pr = lifeBranchProgress(b.id);
    const tab = el("button", "lt-tab" + (b.id === _lifeTab ? " on" : ""),
      `<span class="lt-tab-ic">${b.icon}</span><span class="lt-tab-nm">${b.name}</span><span class="lt-tab-pg">${pr.done}/${pr.total}</span>`);
    tab.style.setProperty("--bc", b.color);
    if (pr.next && lifeNodeState(pr.next) === "ready") tab.classList.add("ready");
    tab.onclick = () => { _lifeTab = b.id; renderLifeTree(); };
    tabs.appendChild(tab);
  });
  app.appendChild(tabs);

  const branch = LIFE_BRANCHES.find(b => b.id === _lifeTab);
  const chain = el("div", "lt-chain");
  chain.style.setProperty("--bc", branch.color);
  // フロンティア（次に狙える最初の未解放ノード）からの距離で段階開示する
  const _frPr = lifeBranchProgress(_lifeTab);
  const frontierPos = _frPr.next ? _frPr.next.pos : LIFE_TREE[_lifeTab].length;
  LIFE_TREE[_lifeTab].forEach(node => {
    const stt = lifeNodeState(node);
    const dot = stt === "prereq" ? "🔒" : node.icon;
    // 星座＋段階開示クラス：解放済=点灯／フロンティア=次の星／その先は距離で減衰
    let cz = "";
    if (stt === "unlocked") cz = " is-lit";
    else if (node.pos === frontierPos) cz = " is-next";
    else if (node.pos > frontierPos) { const d = node.pos - frontierPos; cz = d >= 3 ? " is-far3" : (d === 2 ? " is-far2" : " is-far1"); }
    if (node.nodeId === _ltJustUnlocked) cz += " just";
    let desc;
    if (stt === "prereq") {
      const miss = lifeNodeMissingPrereqs(node);
      const names = miss.slice(0, 2).map(pr => {
        const bb = LIFE_BRANCHES.find(b => b.id === pr.branch);
        return `${bb ? bb.icon : ""}${pr.title}`;
      }).join("／");
      desc = `<span class="lt-locked">🔒 ${names}${miss.length > 2 ? ` ほか${miss.length - 2}件` : ""} が必要</span>`;
    } else {
      desc = node.desc;
    }
    // ★解放はコインのみ（暮らしPは解放条件から撤廃・ユーザー指示）。振り直し後の再取得（既購入）は無料。
    const _bought = (typeof lifeNodeBought === "function") && lifeNodeBought(node);
    const _coin = (typeof lifeNodePrice === "function") ? lifeNodePrice(node) : 0;
    const _coinTag = (!_bought && _coin) ? ` 🪙${_coin.toLocaleString("ja-JP")}` : "";
    let right;
    if (stt === "unlocked") right = `<span class="lt-node-cost done">✓</span>`;
    else if (stt === "ready") right = `<button class="lt-buy">取り入れる<b>${_coinTag || " 🪙0"}</b></button>`;
    else right = `<span class="lt-node-cost lock">${_coinTag || "🪙0"}</span>`;
    const row = el("div", "lt-node " + stt + cz,
      `<div class="lt-node-rail"><div class="lt-node-dot">${dot}</div></div>` +
      `<div class="lt-node-body"><div class="lt-node-title">${node.title}</div>` +
        `<div class="lt-node-desc">${desc}</div></div>` +
      `<div class="lt-node-right">${right}</div>`);
    if (stt === "ready") {
      const btn = row.querySelector(".lt-buy");
      if (btn) btn.onclick = () => { const r = unlockLifeNode(node); if (r.ok) { _ltJustUnlocked = node.nodeId; renderLifeTree(); showLifeCutin(node); } };
    } else if (stt === "unlocked") {
      // 解放済みノードはタップで回想ポップ（ユーザー指摘：タップしても無反応だった）。
      row.style.cursor = "pointer";
      row.onclick = () => {
        if (typeof showInfoPopup === "function") showInfoPopup(`${node.icon} ${node.title}`,
          `<div class="mm-row"><span class="mm-ic">✓</span><div><b>解放済み</b><small>${node.desc}</small></div></div>`);
      };
    }
    chain.appendChild(row);
  });
  _ltJustUnlocked = null;   // 演出は一度だけ
  app.appendChild(chain);

  const respec = el("button", "lt-respec", "↺ いつでも無料で振り直す");
  respec.onclick = () => {
    if (confirm("解放をすべて解除して、選び直しますか？\n（資産・コインはそのまま。ノードはいつでも取り直せます）")) {
      respecLifeTree(); renderLifeTree();
    }
  };
  app.appendChild(respec);
  app.appendChild(el("div", "lt-respec-note", "💡 振り直しは無料。総資産もコインも減りません — 気軽に色々な暮らしを試せます。"));

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}

// 専用画面：生活資産コレクション（所持＝金／未解放＝灰）
function renderLifeCollection() {
  state.ui.screen = "life_collection";
  recomputeAssets(state);
  const a = state.assets;
  const level = Math.max(0, Math.min(a.unlockedLifeStages || 0, 5));
  const app = beginScreen();   // 上部に「← 暮らし」
  app.appendChild(el("h2", null, "生活資産コレクション"));
  const owned = LIFE_ASSETS.filter(it => isLifeAssetUnlocked(state, it, level)).length;
  app.appendChild(el("div", "as-hint2", `所持 <b>${owned} / ${LIFE_ASSETS.length}</b>　<span class="as-hint">🛒＝コインで購入可／Lv＝資産段階で自動解放</span>`));
  const itemsWrap = el("div", "as-items");
  const CAT_IC = { housing: "🏠", food: "🍽️", outfit: "👗", tool: "🎤", decor: "🖼️", supporter: "🤝" };
  LIFE_ASSETS.forEach(item => {
    const own = isLifeAssetUnlocked(state, item, level);
    const right = item.unlockType === "auto" ? (own ? "✓" : `Lv${item.unlockAssetLevel}`) : (own ? "✓" : "🛒");
    const cell = el("div", "as-item " + (own ? "owned" : "lock"),
      `<span class="as-item-ic">${CAT_IC[item.category] || "📦"}</span><span class="as-item-nm">${item.name}</span><span class="as-item-tag">${right}</span>`);
    if (item.unlockType !== "auto" && !own) {
      cell.classList.add("buyable");
      cell.title = `購入 ${fmtCoins(item.price)}`;
      cell.onclick = () => { const res = buyLifeItem(item.id); if (res.ok) renderLifeCollection(); else if (res.reason === "poor") alert("コインが足りません。"); };
    }
    itemsWrap.appendChild(cell);
  });
  app.appendChild(itemsWrap);

  const actions = el("div", "actions");
  const back = el("button", "secondary", "← 暮らしへ戻る"); back.onclick = () => renderAssets();
  actions.appendChild(back);
  app.appendChild(actions);
}
