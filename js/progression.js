// =============================================================================
// progression.js — 解放台帳（単一の真実）＋解放お祝い通知エンジン（2026-07）
// =============================================================================
// 正本＝docs/GAME_FLOW_REDESIGN.md §1-2。全て表示/ゲート層＝レースの着順・オッズ・
// 配当・FinalPower には一切触れない（[[race-math-immutable]]）。
//
// 設計（リサーチ準拠 docs/RESEARCH_PROGRESSION_UX.md）：
//  - ロック表現は2種だけ：「条件明示ロック」（入口を見せ解放条件を明記）／「？？？ミステリー枠」
//  - 通知3段階：cut-in（新画面の解放のみ・CTA1個）／toast（既存画面への追加）／badge（受動）
//  - ★ホーム到着1回につきモーダル(cut-in)は1件まで。残りは次のホーム到着へ持ち越し。
//  - 通知済み＝storyフラグ `_unlocked_<id>`（setStoryFlag）で1回だけ。
// =============================================================================

// 解放台帳。cond() は毎回評価（保存値に依存しない＝巻き戻り安全）。
// tier: "cutin"＝全画面お祝い＋「今すぐ見る▸」／"toast"＝軽い帯通知のみ。
// notifyFn があれば cut-in の代わりにそれを呼ぶ（例：モール＝サケの衣装ギフトVN）。
const UNLOCKS = [
  { id: "dex", icon: "📖", label: "図鑑", tier: "cutin", go: "collection",
    cond: function () { return (typeof dexUnlocked === "function") && dexUnlocked(); },
    teaser: "はじめて当てると解放",
    notifyTitle: "📖 図鑑が解放！",
    notifyBody: "予想が当たった！　賭けた竜たちの記録が「図鑑」で見られるようになりました。竜を知ることが、次の予想の武器になります。" },
  { id: "konron", icon: "🏝️", label: "観光", tier: "cutin", go: "konron_map",
    cond: function () { return ((state.player && state.player.wins) || 0) >= 1; },
    teaser: "はじめて勝つと解放",
    notifyTitle: "🏝️ 観光が解放！",
    notifyBody: "初勝利のお祝いに、島のみんなが崑崙島をあちこち案内してくれることに。食べ歩き・買い物・絶景・推し活——島じゅうが遊び場です。" },
  { id: "mall", icon: "🛍️", label: "モール", tier: "cutin", go: "mall",
    cond: function () { return (typeof mallUnlocked === "function") && mallUnlocked(); },
    teaser: "第2話を読むと解放",
    notifyTitle: "🛍️ モールが解放！",
    notifyBody: "ショッピングモールが開きました。衣装を買って、ミミを自由に着替えられます。開店祝いは、サケさんから直接。" },
  { id: "lifetree", icon: "🌱", label: "くらしツリー", tier: "cutin", go: "life_tree",
    cond: function () { return (typeof getStoryFlag === "function") && !!getStoryFlag("_chapter_intro_3"); },
    teaser: "第3話を読むと解放",
    notifyTitle: "🌱 くらしツリーが解放！",
    notifyBody: "暮らしポイントで生活を育てる「くらしツリー」と生活資産が使えるようになりました。負けた夜にも人生が終わらない、本当の準備を。" },
  // --- toast（既存画面への追加。モーダルは出さない） ---
  // ★M3 余白の尊重：ロケ名と生息竜はスカウト画面が ？？？ で伏せて「行って確かめる」発見にしている
  //   （ui_scout.js）。toast でロケ名まで先に明かすと発見を先食いするので、「新しい行き先が増えた」だけ告知。
  { id: "scoutloc_cliff", icon: "🔭", label: "スカウト新ロケ", tier: "toast",
    cond: function () { return _scoutLocOpen("cliff"); },
    notifyBody: "🔭 竜スカウトに新しい行き先が増えました。どこへ行けるかは、スカウト画面で。" },
  { id: "scoutloc_volcano", icon: "🔭", label: "スカウト新ロケ", tier: "toast",
    cond: function () { return _scoutLocOpen("volcano"); },
    notifyBody: "🔭 竜スカウトにまた新しい行き先が。次はどんな竜がいるか——確かめに行ってみて。" },
  { id: "scoutloc_sky", icon: "🔭", label: "スカウト新ロケ", tier: "toast",
    cond: function () { return _scoutLocOpen("sky"); },
    notifyBody: "🔭 竜スカウトに、最後の行き先がひらきました。その空に何がいるかは、あなたの目で。" },
  { id: "mealtier", icon: "🍽️", label: "上級グルメ", tier: "toast",
    cond: function () { return (typeof mealEndgameOpen === "function") && mealEndgameOpen(); },
    notifyBody: "🍽️ 食事に「上級グルメ」のティアが解放！　島の食の頂点へ。" }
];

function _scoutLocOpen(id) {
  try { return (typeof poroScoutUnlocked === "function") && poroScoutUnlocked() &&
    (typeof scoutLocationUnlocked === "function") && scoutLocationUnlocked(id); } catch (e) { return false; }
}

// ===== 暮らし×物語 結線（正本 docs/KURASHI_STORY_WEAVE.md）=====
// kurashiChapter()＝現在章（既読済み最大章。ED後=6）。暮らし各画面が「いま何話か」で
// 声やお題を変えるための共通ヘルパ（表示のみ・レース数値不変）。
function kurashiChapter() {
  try {
    if (state.player && state.player.epilogue && state.player.epilogue.edFlag) return 6;
    for (let n = 5; n >= 1; n--) if (getStoryFlag("_chapter_intro_" + n)) return n;
  } catch (e) {}
  return 1;
}
// E4（docs/HUNGER_ECONOMY_DESIGN.md §5・GAME_EXPERIENCE_DESIGN 2章）：分析・予想は第2話
// 「ミズの分析」で解禁。1章は“勘レース”＝分析タブ/詳しい分析/相談を伏せ、負けて覚える手触りに。
// 表示ゲートのみ＝レースの着順/オッズ/配当/FinalPower は不変（賭け画面の人気/オッズは常時表示）。
function analysisUnlocked() {
  try { return typeof getStoryFlag === "function" && !!getStoryFlag("_chapter_intro_2"); } catch (e) { return false; }
}
// 暮らし還流台帳：暮らしの行動（育てる/引っ越す/食べる/習う）に物語側が反応する。
// 形は UNLOCKS の toast と同じ（1到着1件・_unlocked_フラグで一度きり・表示のみ）。
const KURASHI_WATCH = [
  { id: "k_tree5", tier: "toast",
    cond: function () { return Object.keys((state.lifeTree && state.lifeTree.unlocked) || {}).length >= 5; },
    notifyBody: "🌱 くらしツリーが5節目。スミカ「ミミ様の生活調査票、初めて空欄が埋まりました。日報の文化面が取材したいそうです」" },   // ★声表: スミカ=丁寧語・呼称ミミ様
  { id: "k_tree15", tier: "toast",
    cond: function () { return Object.keys((state.lifeTree && state.lifeTree.unlocked) || {}).length >= 15; },
    notifyBody: "🌳 くらしツリーが15節目！　スミカ「ミミ様の生活調査票、空欄がほとんど埋まりました。……少し、嬉しいです」" },   // ★声表: スミカ=丁寧語・呼称ミミ様（「あんた」は声ブレ）
  { id: "k_tree30", tier: "toast",
    cond: function () { return Object.keys((state.lifeTree && state.lifeTree.unlocked) || {}).length >= 30; },
    notifyBody: "🌳 くらしツリーが30節目！！　枝の先まで灯りがともる。日報いわく「島でいちばん豊かな木」。" },
  // 暮らし向上＝LIFE_TIERS（総資産の生活段位）到達。島の経済の景気ティアと同じ物差し。
  { id: "k_tier2", tier: "toast",
    cond: function () { return typeof LIFE_TIERS !== "undefined" && ((state.player && state.player.totalAssets) || 0) >= LIFE_TIERS[2].min; },
    notifyBody: "🏠 暮らしが「" + (typeof LIFE_TIERS !== "undefined" ? LIFE_TIERS[2].name : "慎ましい暮らし") + "」に！　聖龍日報・暮らし面「あの新人、屋根のある暮らしへ」。" },
  { id: "k_tier3", tier: "toast",
    cond: function () { return typeof LIFE_TIERS !== "undefined" && LIFE_TIERS[3] && ((state.player && state.player.totalAssets) || 0) >= LIFE_TIERS[3].min; },
    notifyBody: "🏡 暮らしがまた一段上がりました。日報いわく「崑崙の丘に、竜の見える家」。ご近所さんが増えました。" },
  { id: "k_meals10", tier: "toast",
    cond: function () { return (typeof mealStatsAll === "function") && mealStatsAll().got >= 10; },   // ★BUGFIX: player.meals は {eaten,solved} の2キー固定＝旧式は永遠に偽だった
    notifyBody: "🍽️ 食べ歩き10品目！　グルメ面「みみしんぼ」外伝が載りました。屋台のおやじが照れてます。" },
  { id: "k_meals25", tier: "toast",
    cond: function () { return (typeof mealStatsAll === "function") && mealStatsAll().got >= 25; },   // ★BUGFIX: 同上
    notifyBody: "🍽️ 食べ歩き25品！　グルメ面いわく「この島の味を、彼女はぜんぶ知っている」。" },
  { id: "k_spots8", tier: "toast",
    cond: function () { return Object.keys(((state.player || {}).kurashi || {}).spotsSeen || {}).length >= 8; },
    notifyBody: "📷 島の写真を8か所ぶん見ました。日報の文化面「島を歩く人」欄にミミの名前が載っています。" },
  { id: "k_spots20", tier: "toast",
    cond: function () { return Object.keys(((state.player || {}).kurashi || {}).spotsSeen || {}).length >= 20; },
    notifyBody: "📷 島の写真20か所！　文化面いわく「観光案内より詳しい配信者」。ファンレターも届いています。" },
  { id: "k_skillmax", tier: "toast",
    cond: function () {
      try {
        const as = (state.player && state.player.activeSkills) || {};
        return typeof ACTIVE_SKILLS !== "undefined" && ACTIVE_SKILLS.some(function (s) { return (as[s.id] || 0) >= s.levels.length; });
      } catch (e) { return false; }
    },
    notifyBody: "🎫 習い事をひとつ極めました！　師範が目を細めています。「もう教えることはない……いや、まだあるか」" }
];

// 解放判定（台帳経由の単一入口）。未知idは false。
function unlockOpen(id) {
  const u = UNLOCKS.find(function (x) { return x.id === id; });
  try { return !!(u && u.cond()); } catch (e) { return false; }
}

function _unlockNotified(id) { return (typeof getStoryFlag === "function") && !!getStoryFlag("_unlocked_" + id); }
function _markNotified(id) { if (typeof setStoryFlag === "function") setStoryFlag("_unlocked_" + id, true); if (typeof saveGame === "function") saveGame(); }

// ★ホーム到着ごとに1回呼ぶ（renderHome 末尾）。cut-in は1件だけ・toast は1件だけ流す。
// 立ち上がり直後のログボ等と喧嘩しないよう、呼び出し側で「初出走前は呼ばない」こと（FTUE保護）。
function progressionCheckOnHome() {
  try {
    if (document.querySelector(".navpop-ov")) return;   // 既に何かのモーダルが出ていたら譲る（1到着1件ルール）
    let cutinDone = false;
    // ★物語の新章＝レース直後にモーダルを出さず、ここ（次のホーム到着）で静かに1件だけ案内する（ユーザー指摘）。
    //   優先度は高め（新しい話は大きな出来事）＝他の解放より先に見せる。1到着1モーダルの枠を消費する。
    if (typeof nextUnreadChapter === "function") {
      const _ch = nextUnreadChapter();
      if (_ch && !_unlockNotified("story_" + _ch.id)) {
        _markNotified("story_" + _ch.id);
        _showStoryCutin(_ch);
        cutinDone = true;
      }
    }
    for (const u of UNLOCKS.concat(KURASHI_WATCH)) {
      if (_unlockNotified(u.id)) continue;
      let open = false; try { open = !!u.cond(); } catch (e) {}
      if (!open) continue;
      if (u.tier === "cutin" && !cutinDone) {
        _markNotified(u.id);
        if (!(u.notifyFn && u.notifyFn())) _showUnlockCutin(u);
        cutinDone = true;   // 1到着1モーダル。残りは次回へ持ち越し
      } else if (u.tier === "toast") {
        _markNotified(u.id);
        _showUnlockToast(u.notifyBody);
        break;   // toastも1到着1件（連発は騒がしい）
      }
    }
  } catch (e) { try { console.warn("progressionCheckOnHome", e); } catch (_) {} }
}

// cut-in＝既存の .navpop 系スタイルを流用した中央モーダル（新規CSSなし・枠内に自動で収まる）。
function _showUnlockCutin(u) {
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop infopop");
  box.innerHTML =
    `<div class="navpop-t">🔓 あたらしい遊びが解放！</div>` +
    `<div class="infopop-body"><div class="mm-row"><span class="mm-ic">${u.icon}</span>` +
    `<div><b>${u.notifyTitle}</b><small>${u.notifyBody}</small></div></div></div>`;
  const btns = el("div", "navpop-btns");
  const later = el("button", "navpop-x", "あとで"); later.onclick = function () { ov.remove(); };
  const go = el("button", "navpop-go", "今すぐ見る ▸");
  go.onclick = function () { ov.remove(); if (typeof goto === "function") goto(u.go); };
  btns.appendChild(later); btns.appendChild(go); box.appendChild(btns);
  ov.appendChild(box);
  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  try { if (window.Sfx) Sfx.play("legendary"); } catch (e) {}
}

// 物語の新章カットイン＝解放の cut-in と同じ枠。章題は伏せる（未読＝顧問未登場・R7）＝固有名を出さない。
function _showStoryCutin(ch) {
  const _title = (typeof chapterTeaseTitle === "function") ? chapterTeaseTitle(ch) : ("第" + ch.id + "話");
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop infopop");
  box.innerHTML =
    `<div class="navpop-t">🎬 新しいエピソード公開</div>` +
    `<div class="infopop-body"><div class="mm-row"><span class="mm-ic">🎬</span>` +
    `<div><b>${_title}</b><small>密着ドキュメンタリー『ミミ、爆走中。』の続きが公開されました。〈物語〉から見られます。</small></div></div></div>`;
  const btns = el("div", "navpop-btns");
  const later = el("button", "navpop-x", "あとで"); later.onclick = function () { ov.remove(); };
  const go = el("button", "navpop-go", "読む ▸");
  go.onclick = function () { ov.remove(); if (typeof renderStory === "function") renderStory(); };
  btns.appendChild(later); btns.appendChild(go); box.appendChild(btns);
  ov.appendChild(box);
  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  try { if (window.Sfx) Sfx.play("unlock"); } catch (e) {}
}

// toast＝下部にすっと出て消える帯（モーダルではない・タップで即消し）。
function _showUnlockToast(text) {
  const t = el("div", "unlock-toast", text);
  t.onclick = function () { t.remove(); };
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 400); }, 4200);
  try { if (window.Sfx) Sfx.play("paho"); } catch (e) {}
}
