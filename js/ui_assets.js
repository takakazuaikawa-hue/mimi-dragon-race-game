// =============================================================================
// ui_assets.js — 暮らしと資産の画面群（CODEMAP §6・分割第2弾）。
// =============================================================================
// ★ui_render.js から無改変で抽出：renderAssets / renderActiveSkills /
//   showSkillTitleCutin / renderLifeTree / renderLifeCollection ＋ _lifeTab / _ltJustUnlocked。
//   参照（state / el / recomputeAssets / LIFE_* / lifetree_engine 関数 / showLifeCutin(ui_render) 等）は
//   すべてグローバル共有なので別ファイルでも不変。呼び出しは renderHome のナビ・nav.js から call-time。
// =============================================================================

let _lifeTab = null;   // 選択中の枝（null は自動選択）

// 暮らし＝コンパクトなダッシュボード。状態は小さくグラフィカルに、情報量の多いもの
//（スキルツリー＝約200ノード／コレクション＝約200点）は専用画面へ遷移させてスクロールを抑える。
// 🎯 目標（クエスト）／🍽️ 食事（みみしんぼ）の画面は js/ui_meta.js へ抽出済み（CODEMAP §6・分割第1弾）。
//   renderGoals / renderMeals / showMealDetail / _mealTab はそちら。ロジックは無改変で移動しただけ。

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
    `<img class="lr-room-mimi" src="images/cast/mini/mimi_mini.png" alt="ミミ" decoding="async">` +
    `<div class="lr-room-info"><div class="lr-room-lbl">ミミの再起度（総資産）</div>` +
      `<div class="lr-room-total">${fmtCoins(total)}</div>` +
      `<div class="lr-room-p">暮らしP ◇${st.available}</div></div>`;
  app.appendChild(hero);
  // 暮らしP表示：タップで反映（解放済みならくらしツリーへ・未解放なら他の箇所と同じ🔒案内）。
  const _roomPEl = hero.querySelector(".lr-room-p");
  _roomPEl.style.cursor = "pointer";
  _roomPEl.onclick = () => {
    if (_ch3unlocked) { renderLifeTree(); return; }
    if (typeof showInfoPopup === "function") showInfoPopup("🌱 くらしツリー・生活資産",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small><u>第3話「スミカと総資産」</u>を読むと、くらしツリー（暮らしP）と生活資産が開放されます（総資産3万で第3話が解禁）。</small></div></div>`);
  };

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

  const _avA = advisorVoiceEl("assets"); if (_avA) app.appendChild(_avA);

  // 内訳（小さなセグメントバー＝グラフィカル）
  const parts = [
    ["最大到達", p.maxCoinsReached, "#e6b24a"], ["村", a.villageValue, "#49c89c"], ["施設", a.facilityValue, "#57b1dd"],
    ["生活", a.livingValue, "#caa44a"], ["名声", a.fameValue, "#d6452f"], ["ドラゴン", a.dragonValue, "#9a6ad0"]
  ].filter(x => x[1] > 0);
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
  const unlockedCh = STORY_CHAPTERS.filter(ch => total >= storyUnlockAt(ch.id)).length;
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
    ch.id !== "ED" && total >= storyUnlockAt(ch.id) &&
    !(typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_" + ch.id))) : null;
  if (_nextCh) todo.push({ ic: "📖", label: "新しい話が読める", sub: _nextCh.title, onClick: () => renderStory() });
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
  const _chNowMini = Math.min((typeof kurashiChapter === "function") ? kurashiChapter() : 1, 6);
  const _shihanMini = (skillId) => {
    const m = (typeof _shihanOf === "function") ? _shihanOf(skillId) : null;
    return (m && _chNowMini >= m.ch) ? `images/cast/mini/${m.id}_mini.png` : null;
  };
  // 🏦 島の経済：島の景気・名声・フォロワー・レース経済を一望（終章中は絶滅メーター本体もここに）。js/ui_economy.js
  if (typeof renderEconomy === "function") {
    const epOn = (typeof epilogueOn === "function") && epilogueOn();
    ent.appendChild(entry("🏦", "島の経済", epOn ? "総資産・名声・村の景気… ＋ ☄️絶滅メーターの綱引き" : "総資産・名声・フォロワー・村の景気＝島の経済状態", epOn ? "☄️終章" : "", () => renderEconomy()));
  }
  // 「できること」＝実際に今できることだけ。未開放は locked に分けて別見出しへ（ここに混ぜると「できる」が嘘になる＝ユーザー指摘）。
  const locked = el("div", "as-entries");
  // 🏆 コレクション・やり込み（各収集の達成度＝得点＋クリア後ミニゲーム）。js/ui_collection_score.js
  if (typeof renderCollectionScore === "function") {
    const _cleared = (typeof kurashiChapter === "function") && kurashiChapter() >= 6;
    if (_cleared) {
      ent.appendChild(entry("🏆", "コレクション", "図鑑・衣装・食・小イベント… 達成度（得点）＋ミニゲーム", "", () => renderCollectionScore()));
    } else {
      locked.appendChild(entry("🔒", "？？？", "終章のあとで——島での日々の、すべてが得点になる。", "", () => {
        if (typeof showInfoPopup === "function") showInfoPopup("🏆 ？？？",
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small>物語を最後まで見届けると開放されます。図鑑も、衣装も、食べ歩きも——島での日々のすべてが、ここで振り返れるようになります。</small></div></div>`);
      }));
    }
  }
  // ★くらしツリー・生活資産は第3話「スミカと総資産」を読むと開放（progression再設計・docs/PROGRESSION_DESIGN.md）。_ch3unlocked は上（すべきこと判定）で確定済み。
  if (_ch3unlocked) {
    ent.appendChild(entry("🌳", "くらしスキルツリー", `暮らしP ◇${st.available} 残り ・ 解放 ${st.unlockedCount}/${st.totalNodes}`, ready ? "振れる!" : "", () => renderLifeTree()));
    ent.appendChild(entry("🎁", "生活資産コレクション", `${colOwned} / ${LIFE_ASSETS.length} 解放`, "", () => renderLifeCollection()));
  } else {
    locked.appendChild(entry("🔒", "くらしツリー・生活資産", "第3話「スミカと総資産」を読むと開放", "", () => {
      if (typeof showInfoPopup === "function") showInfoPopup("🌱 くらしツリー・生活資産",
        `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ開いていません</b><small><u>第3話「スミカと総資産」</u>を読むと、くらしツリー（暮らしP）と生活資産が開放されます（総資産3万で第3話が解禁）。</small></div></div>`);
    }));
  }
  // 習い事：次に通える師範のミニ肖像を添える（未登場の師範なら無し＝ネタバレしない）。
  ent.appendChild(entry("🎫", "習い事（アクティブスキル）", `称号 ${skTitles} / ${ACTIVE_SKILLS.length} 獲得 ・ ミミの暮らしの記録`, skTitles >= ACTIVE_SKILLS.length ? "コンプ!" : "", () => renderActiveSkills(), _nextSkill ? _shihanMini(_nextSkill.id) : null));
  ent.appendChild(entry("📖", "物語", `${unlockedCh} / ${STORY_CHAPTERS.length} 話 解放`, "", () => renderStory()));
  // 相談（顧問）はホームのナビから移設＝暮らしハブに配置（予想の視点をもらう・任意）。
  // E4：予想の相談も第2話「ミズの分析」で解禁（1章は勘レース）。表示ゲートのみ・数値不変。
  if (typeof renderConsult === "function") {
    if (typeof analysisUnlocked === "function" && !analysisUnlocked()) {
      locked.appendChild(entry("🔒", "相談（顧問）", "第2話「ミズの分析」を読むと、予想の相談ができます。", "", () => {
        if (typeof showInfoPopup === "function") showInfoPopup("💬 相談（顧問）",
          `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ相談できません</b><small><u>第2話「ミズの分析」</u>を読むと、サケ・ミズ・スミカに予想の視点をもらえます（総資産3千で第2話が解禁）。いまはカンで勝負！</small></div></div>`);
      }));
    } else {
      // 分析（相談）を最初に開いたミズを代表として添える。
      ent.appendChild(entry("💬", "相談（顧問）", "サケ・ミズ・スミカから、予想の視点をもらいます。", "", () => renderConsult(), "images/cast/mini/mizu_mini.png"));
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
// 完全な表示専用メタ進行。コイン・総資産・暮らしP・着順・オッズ・配当には一切触れない。
function renderActiveSkills() {
  state.ui.screen = "active_skills";
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
    const dots = Array.from({ length: max }, (_, i) => `<span class="askill-dot${i < lv ? " on" : ""}"></span>`).join("");
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
  app.appendChild(el("div", "as-hint2", `暮らしP ◇<b>${st.available}</b> 残り ／ 解放 ${st.unlockedCount}/${st.totalNodes}　<span class="as-hint">レースで総資産が増える＝暮らしPが貯まる</span>`));

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
      const box = el("div", "card sh-box");
      box.innerHTML =
        `<div class="sh-t">🏘️ スミカの宿題 <small>${ch >= 6 ? "クリア後" : "第" + ch + "話"}</small></div>` +
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
    if (confirm("解放をすべて解除して、暮らしPを振り直しますか？\n（総資産・コインはそのまま。ノードはいつでも取り直せます）")) {
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
