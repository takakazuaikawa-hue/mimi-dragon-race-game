// =========================================================================
// poro.js — 泣き虫竜ポロ：相棒キャラ／物語アーク／解放フラグ（表示専用メタ）
// =========================================================================
// 仕様書「泣き虫竜ポロ 実装仕様書」に基づく。★最重要の前提：
//   - ポロは既に DRAGONS（data_dragons.js）に「出走する人気竜」として存在する。
//     その出走・オッズ・配当・図鑑・既存の登場イベント(§10)は一切変更しない。
//   - 本モジュールが足すのは “相棒としてのポロ” ＝ 発見/聖龍幼体説/鑑定の物語、
//     龍舎・スカウト・グルメレースの解放フラグ、ダイアログ上の立ち絵キャラ登録。
//     すべて表示専用メタ。着順/オッズ/配当（race/odds/betting）には非干渉。
//
// 公開（グローバル関数・classic script）：
//   poroFound()            … ポロを発見済みか
//   poroScoutUnlocked()    … 竜スカウト解放済みか
//   poroStableUnlocked()   … 龍舎解放済みか
//   poroGourmetUnlocked()  … ポロのグルメレース解放済みか
//   maybePlayPoroArc(chId) … 第4章を開いた初回に発見〜鑑定アークを再生（renderStoryChapterから呼ぶ）
//   PORO_PROFILE           … 仕様のプロフィール（後続フェーズで参照）
// =========================================================================

// 仕様 §9 のプロフィール（表示専用・参照用）。
const PORO_PROFILE = {
  id: "poro",
  displayName: "ポロ",
  title: "泣き虫竜",
  species: "ムラサキマルチビ竜",
  growthStage: "juvenile",
  isSacredDragon: false,
  canRace: false,          // ＝“相棒システム経由では出走させない”の意。既存のレース出走ポロとは別レイヤ。
  canFly: false,
  temperament: "timid",
  favoriteFoods: ["紫色の果実", "甘い木の実", "柔らかい根菜", "屋台の菓子", "特製ポロ饅頭"],
  dislikedThings: ["歓声", "雷鳴", "発走ベル", "怒鳴り声", "単独行動"],
  cries: ["ぽろ……", "きゅるる……", "ぴゃあっ！", "ぽろぉぉぉ……！", "……ぽろっ！"],
  mascotRole: true
};

// ── フラグ（state.player.flags に保存。getStoryFlag/setStoryFlag は event_hooks.js） ──
function poroFound() { return typeof getStoryFlag === "function" && getStoryFlag("poroFound"); }
function poroScoutUnlocked() { return typeof getStoryFlag === "function" && getStoryFlag("dragonScoutUnlocked"); }
function poroStableUnlocked() { return typeof getStoryFlag === "function" && getStoryFlag("dragonStableUnlocked"); }
function poroGourmetUnlocked() { return typeof getStoryFlag === "function" && getStoryFlag("poroGourmetRaceUnlocked"); }
// 図鑑は「第4話＝マクラ(枕)と推し竜文化」に到達してから解放（ユーザー指定）。metMakura は
// renderStoryChapter("4") で立つ。_chapter_intro_4 は既に第4話を開いた既存セーブの救済。
function dexUnlocked() {
  if (typeof getStoryFlag !== "function") return false;
  return getStoryFlag("metMakura") || getStoryFlag("_chapter_intro_4");
}

// ── ダイアログ立ち絵キャラとして登録（紫＝仕様の体色。立ち絵 webp が無ければ絵文字へ自動FB） ──
(function registerPoroCast() {
  if (typeof window !== "undefined" && window.Dialogue && Dialogue.registerCast) {
    Dialogue.registerCast("poro", {
      name: "ポロ", color: "#9a6ad0", symbol: "🥹", side: "left",
      // 紫ポロ立ち絵（ユーザー提供・512×768透過）。表情差分：default/cry/surprise。未配置時はsymbolへ。
      img: {
        default: "images/cast/stand/poro.webp",
        cry: "images/cast/stand/poro_cry.webp",
        surprise: "images/cast/stand/poro_surprise.webp"
      }
    });
  }
})();

// ── 第4章 発見〜聖龍幼体説〜鑑定〜受容の物語アーク（立ち絵セリフ） ──
// キャラの声（[[mimi-costume-mall]] §キャラの役割）：ミミ=来訪者(反応/質問)、サケ=現場/竜を見る、
// ミズ=市場/価値、スミカ=生活/手配、マクラ=観客/熱狂、セレスティア=聖龍の意味/世界の天井。
function poroDiscoveryScript() {
  return [
    ["narrator", "雷雨の去ったレース場の裏手。資材置き場、木箱の陰で——なにかが、ちいさく震えていた。"],
    ["mimi", "……あれ？ なにか、ふるえてる……。", "default"],
    ["poro", "……ぽろ……ぴゃっ……！", "surprise"],
    ["mimi", "わわっ、ごめんね。こわくないよ。ほら……おいで。", "happy"],
    ["poro", "……ぽろぉ……。", "cry"],
    ["mimi", "あったかい……。ちっちゃな竜さん。どこから来たの？", "default"],
    ["villager", "っ……その紫の体に、宝石みたいな鱗……ま、まさか、聖龍の幼体じゃ……！？"],
    ["makura", "出たァ！ 雨上がり・聖龍レース当日・祭祀布にくるまれた紫の仔竜！ こいつぁバズらせない手はないぜ！？"],
    ["mimi", "せ、聖龍……？ この子が……？", "panic"],
    ["celestia", "聖龍。世界の淘汰を生き残り、頂点に立つ竜。……その名は、軽々しく与えるものではない。"],
    ["mizu", "落ち着きなさい。魔力測定器は異常値を示した——けれど、あの機械、この子の涙と鼻水でショートしただけよ。あはん。"],
    ["sake", "だが妙だ。この仔、人の不安によく耳が動く。音と匂いと、地の震えを拾っている。そこだけは、本物だ。"],
    ["mimi", "じゃあ……ほんとうに、聖龍なんですか……？", "default"],
    ["sumika", "ミミ様。憶測では育てられません。きちんと鑑定を取りましょう。——結果が、出ました。"],
    ["narrator", "＜鑑定結果＞　種族：ムラサキマルチビ竜／成長段階：幼体／希少指定：なし／聖龍との血縁：なし／特殊能力：なし／……食べ過ぎ傾向：あり。"],
    ["makura", "……な〜んだ。ぜんぶ、ふつうの仔竜かぁ。聖龍ちゃうんかい。"],
    ["mizu", "紫も、宝石の鱗も、この地方では珍しくない。祭祀布は夜市の古布屋の品。開催日に現れたのも——屋台の果物が目当て。市場が、勝手に夢を見ただけ。"],
    ["poro", "……ぽろ？", "default"],
    ["mimi", "……。", "default"],
    ["mimi", "じゃあ、世界を救わなくていいんですね。", "smile"],
    ["mimi", "よかった。ポロは、ポロのままでいいです。", "happy"],
    ["sake", "……ふん。名は？"],
    ["mimi", "ポロ。泣き虫の、ポロです。わたしの……相棒。", "happy"],
    ["poro", "……ぽろっ！"]
  ];
}

// 発見アークの再生（1回だけ）。完了後にフラグ確定＋解放通知。window._poroArcPlayingで二重起動ガード。
function _playPoroArc() {
  if (poroFound()) return false;
  if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
  if (window._poroArcPlaying) return false;
  window._poroArcPlaying = true;
  Dialogue.play(poroDiscoveryScript(), { force: true }).then(function () {
    window._poroArcPlaying = false;
    completePoroDiscovery();
  });
  return true;
}
// ★出会い＝序盤の「2勝目」（ユーザー指定）。ポロは第3・4章の一枚絵に既に登場するため、章開放
//   （総資産100万＝第4章）より前に加入させる。wins＝単勝的中数。結果画面(renderResult)から呼ぶ。
function maybePlayPoroArcOnWin() {
  if (poroFound()) return false;
  if (((state.player && state.player.wins) || 0) < 2) return false;
  return _playPoroArc();
}
// フォールバック：万一2勝より先に第3/4章へ到達していたら、章を開いた時に出会いを再生（取りこぼし防止）。
function maybePlayPoroArcOnChapter(chId) {
  if (chId !== "3" && chId !== "4") return false;
  if (poroFound()) return false;
  return _playPoroArc();
}

// 発見完了＝フラグ確定（poroFound＋鑑定＋スカウト/龍舎を同時解放）。仕様 §8・§12。
function completePoroDiscovery() {
  if (typeof setStoryFlag !== "function") return;
  setStoryFlag("poroFound", true);
  setStoryFlag("poroAppraisalStarted", true);
  setStoryFlag("poroAppraisalCompleted", true);
  setStoryFlag("poroConfirmedNotSacredDragon", true);
  setStoryFlag("dragonScoutUnlocked", true);
  setStoryFlag("dragonStableUnlocked", true);
  showPoroUnlockNotice();
}

// 新機能解放通知（仕様 §12「UI上で新機能解放通知が表示される」）。
function showPoroUnlockNotice() {
  if (typeof showInfoPopup !== "function") return;
  showInfoPopup("🐲 ポロが仲間になった！",
    `<div class="mm-row"><span class="mm-ic">🥹</span><div><b>泣き虫竜ポロ</b>` +
      `<small>聖龍ではなかった——ただの、ふつうのムラサキマルチビ竜。それでも、ミミの大切な相棒。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🏠</span><div><b>「龍舎」を解放</b><small>出会った竜を見守り、ポロと過ごす拠点。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🔍</span><div><b>「竜スカウト」を解放</b><small>野に眠る竜を探しにいける。ポロが案内してくれる。</small></div></div>` +
    `<div class="mm-note">※ ポロは競走させません。レースの結果・オッズ・配当は変わりません（表示専用）。</div>`);
}

// =========================================================================
// 表示専用メタの土台：親密度・出会った竜・竜の表示用ラベル
// （着順/オッズ/配当には一切触れない。state.player.collection を流用）
// =========================================================================
function poroColEntry(id) {
  if (typeof ensureCollectionEntry === "function") return ensureCollectionEntry(id);
  // フォールバック（ensureCollectionEntry未定義時）
  state.player.collection = state.player.collection || {};
  if (!state.player.collection[id]) state.player.collection[id] = { dragonId: id, seen: true, records: {} };
  return state.player.collection[id];
}
function dragonAffection(id) { const e = poroColEntry(id); return e.affection || 0; }
function raiseAffection(id, amt) {
  const e = poroColEntry(id);
  e.affection = Math.max(0, Math.min(100, (e.affection || 0) + amt));
  if (typeof saveGame === "function") saveGame();
  return e.affection;
}
function dragonById(id) { return (typeof DRAGONS !== "undefined") ? DRAGONS.find(d => d.id === id) : null; }

const PORO_STYLE_LABEL = { escape: "逃げ", front: "先行", late: "差し", chase: "追込" };
function poroStyleLabel(d) { return (d && PORO_STYLE_LABEL[d.style]) || "オールラウンド"; }
// 得意距離/天候/気性/体調＝既存statから導出した“表示用”の見立て（レース計算には使わない）。
function poroDistLabel(d) { if (!d || !d.stats) return "—"; const s = d.stats; return s.stamina - s.speed >= 12 ? "長距離" : s.speed - s.stamina >= 12 ? "短距離" : "中距離"; }
function poroWeatherLabel(d) {
  const r = (d && d.courseReputation) || {};
  const arr = [["晴/火山", r.fire || 0], ["風", r.wind || 0], ["霧", r.fog || 0]];
  arr.sort((a, b) => b[1] - a[1]);
  return arr[0][1] >= 60 ? arr[0][0] : "オールラウンド";
}
function poroTemperLabel(d) {
  const n = (d && d.stats && d.stats.nerve) || 50;
  return n >= 78 ? "おだやか" : n >= 60 ? "すなお" : n >= 45 ? "きまぐれ" : "気難しい";
}
function poroMoodLabel(d) { const m = (d && d.visualMood) || 50; return m >= 70 ? "絶好調" : m >= 50 ? "ふつう" : "ねむそう"; }

// 出会った竜＝図鑑でseen、またはスカウト済(scouted)。ポロは常に先頭。
function poroMetDragonIds() {
  const col = (state.player && state.player.collection) || {};
  const ids = Object.keys(col).filter(id => col[id] && (col[id].seen || col[id].scouted));
  if (ids.indexOf("poro") < 0 && poroFound()) ids.unshift("poro");
  // ポロを先頭へ
  return ["poro"].concat(ids.filter(id => id !== "poro"));
}

// ポロの反応（仕様 §4.1 案内役・§6 注意：的中情報にはしない＝ランダムな気分）。
const PORO_REACTIONS = [
  "ポロが、その子の足元のにおいをふんふん嗅いでいる。",
  "ポロが、ちょっと隠れた。……人見知り、かな？",
  "ポロが、しっぽをふって近寄っていった。",
  "ポロが、きゅるると小さく鳴いた。",
  "ポロが、リボンを見せびらかすように胸を張った。",
  "ポロが、ふいに涙ぐんだ。……理由は、ポロにしか分からない。"
];
function poroReaction() { const a = PORO_REACTIONS; return a[Math.floor((dragonAffection("poro") + (state.player.completedRaces || 0)) % a.length)]; }

// =========================================================================
// 龍舎（仕様 §4.2）— 表示専用の管理拠点。ポロ常駐＋出会った竜の閲覧・親密度・お気に入り。
// =========================================================================
function renderStable() {
  if (!poroStableUnlocked()) { if (typeof renderHome === "function") renderHome(); return; }
  state.ui.screen = "stable";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🏠 龍舎"));
  app.appendChild(el("div", "as-hint2", "ポロと、出会った竜たちの拠点。なでて仲良くなろう（表示専用・レースには影響しません）。"));

  // ── ポロ常駐カード（マスコット＋親密度＋なでる＋小イベント） ──
  const af = dragonAffection("poro");
  const poroCard = el("div", "card stable-poro");
  poroCard.innerHTML =
    `<div class="stable-poro-fig">${poroStandeeHTML(96)}</div>` +
    `<div class="stable-poro-info">` +
      `<div class="stable-poro-nm">🥹 泣き虫竜ポロ <span class="stable-tag">相棒</span></div>` +
      `<div class="stable-poro-sub">ムラサキマルチビ竜・幼体／気性：臆病でやさしい</div>` +
      `<div class="stable-aff"><span>なかよし度</span><div class="stable-aff-bar"><i style="width:${af}%"></i></div><b>${af}</b></div>` +
      `<div class="stable-poro-ev" id="stable-poro-ev">${poroStableEvent()}</div>` +
    `</div>`;
  const pet = el("button", "stable-pet", "🫳 なでる");
  pet.onclick = () => {
    const v = raiseAffection("poro", 3);
    if (window.Sfx && Sfx.play) Sfx.play("paho");
    poroCard.querySelector(".stable-aff-bar i").style.width = v + "%";
    poroCard.querySelector(".stable-aff b").textContent = v;
    const ev = document.getElementById("stable-poro-ev");
    if (ev) ev.textContent = pickPoroPet(v);
  };
  poroCard.querySelector(".stable-poro-info").appendChild(pet);
  app.appendChild(poroCard);

  // ── スカウト／図鑑への導線（トップナビから龍舎に集約） ──
  const subnav = el("div", "stable-subnav");
  if (poroScoutUnlocked()) {
    const scoutRow = el("button", "stable-scout-cta", "🔍 竜スカウトへ行く");
    scoutRow.onclick = () => renderScout();
    subnav.appendChild(scoutRow);
  }
  if (typeof renderCollection === "function" && dexUnlocked()) {   // 図鑑は第4話マクラに会ってから
    const dexRow = el("button", "stable-scout-cta stable-dex-cta", "📖 図鑑（記録・ごほうび）");
    dexRow.onclick = () => renderCollection();
    subnav.appendChild(dexRow);
  }
  app.appendChild(subnav);

  // ── 出会った竜の一覧 ──
  const met = poroMetDragonIds().filter(id => id !== "poro");
  app.appendChild(el("div", "stable-sec", `🐉 出会った竜 <span>${met.length}</span>`));
  if (!met.length) {
    app.appendChild(el("div", "stable-empty", "まだポロのほかに竜はいません。レースで竜を見たり、竜スカウトで出会えます。"));
  } else {
    const grid = el("div", "stable-grid");
    met.forEach(id => {
      const d = dragonById(id); if (!d) return;
      const e = poroColEntry(id);
      const af2 = e.affection || 0;
      const card = el("button", "stable-card" + (e.favorite ? " fav" : ""),
        `<span class="stable-card-dot" style="background:${d.color || "#caa24a"}"></span>` +
        `<span class="stable-card-nm">${d.name}</span>` +
        `<span class="stable-card-sub">${poroStyleLabel(d)}・${poroTemperLabel(d)}${e.scouted ? " ・🔍" : ""}</span>` +
        `<span class="stable-card-aff"><i style="width:${af2}%"></i></span>`);
      card.onclick = () => showDragonDetail(id);
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }

  const actions = el("div", "actions");
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ポロ立ち絵（webpがあれば画像、無ければ絵文字）。size=px。
function poroStandeeHTML(size) {
  return `<img class="poro-img" src="images/cast/stand/poro.webp" alt="ポロ" ` +
    `style="height:${size}px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
    `<span class="poro-emoji" style="display:none;font-size:${Math.round(size * 0.7)}px">🥹</span>`;
}
const PORO_STABLE_EVENTS = [
  "ポロが飼料箱に頭を突っ込んで、抜けなくなっている。",
  "ポロが入口で、ミミの帰りをじっと待っていたみたい。",
  "ポロが新入りの竜に、こわごわリボンを見せている。",
  "大きな竜のくしゃみに驚いて、ポロがぴょんと浮いた。",
  "ポロが果物の数を、こっそり誤魔化そうとしている。"
];
function poroStableEvent() { const a = PORO_STABLE_EVENTS; return a[Math.floor((state.player.completedRaces || 0 + dragonAffection("poro")) % a.length)]; }
function pickPoroPet(v) {
  if (v >= 90) return "ポロが、ぐりぐり頭をすりつけてくる。だいすき、って顔。";
  if (v >= 50) return "ポロが、きゅるんと目を細めて甘えてきた。";
  return "ポロが、おそるおそる近づいて、ほっぺをくっつけた。";
}

// 個体詳細（表示専用）。
function showDragonDetail(id) {
  const d = dragonById(id); if (!d || typeof showInfoPopup !== "function") return;
  const e = poroColEntry(id);
  const rec = e.records || {};
  const af = e.affection || 0;
  showInfoPopup(`${id === "poro" ? "🥹 " : "🐉 "}${d.name}`,
    `<div class="dd-flavor">${d.portraitTone || ""}</div>` +
    `<div class="dd-row"><span>脚質</span><b>${poroStyleLabel(d)}</b></div>` +
    `<div class="dd-row"><span>得意距離</span><b>${poroDistLabel(d)}</b></div>` +
    `<div class="dd-row"><span>得意天候</span><b>${poroWeatherLabel(d)}</b></div>` +
    `<div class="dd-row"><span>気性</span><b>${poroTemperLabel(d)}</b></div>` +
    `<div class="dd-row"><span>体調</span><b>${poroMoodLabel(d)}</b></div>` +
    `<div class="dd-row"><span>人気度</span><b>${d.publicImage != null ? d.publicImage : "—"}</b></div>` +
    (d.traits && d.traits.length ? `<div class="dd-traits">${d.traits.map(t => `<span>${t}</span>`).join("")}</div>` : "") +
    `<div class="dd-row"><span>なかよし度</span><b>${af}</b></div>` +
    (rec.racesSeen ? `<div class="dd-rec">観戦${rec.racesSeen}・3着内${rec.top3Seen || 0}・あなたの的中${rec.playerHitCount || 0}</div>` : "") +
    `<div class="mm-note">※ 表示専用。レースの結果・オッズ・配当には影響しません。</div>`);
}

// =========================================================================
// 竜スカウト（仕様 §4.1）— 表示専用の発見/収集。候補抽選→契約で龍舎コレクションへ。
// ★賭けレースの出走表・オッズ・配当は一切変えない（getRaceDragons等は不変）。
// =========================================================================
const SCOUT_SPOTS = [
  { id: "wild", name: "島の野生地", ic: "🌿", cost: 600, note: "人里離れた竜の通り道。" },
  { id: "market", name: "夜市の裏通り", ic: "🏮", cost: 1200, note: "流れの竜使いが集まる。" },
  { id: "ruin", name: "古い祭祀場跡", ic: "⛩️", cost: 2500, note: "由緒ありげな竜と出会えるかも。" }
];
// その地点の“まだ出会っていない竜”から候補を抽選（DRAGONSは不変・collectionにメタを足すだけ）。
function poroScoutCandidates(spot, n) {
  const col = (state.player && state.player.collection) || {};
  const pool = (typeof DRAGONS !== "undefined" ? DRAGONS : []).filter(d => d.id !== "poro" && !(col[d.id] && col[d.id].scouted));
  // 抽選は決定的（Math.random不使用）：プレイ状況＋地点でシャッフル。
  const seed = (state.player.completedRaces || 0) * 7 + (state.player.coins || 0) % 97 + spot.id.length * 13;
  const sorted = pool.map((d, i) => ({ d, k: (i * 31 + seed * (i + 3)) % 1000 })).sort((a, b) => a.k - b.k).map(o => o.d);
  return sorted.slice(0, n);
}

function renderScout() {
  if (!poroScoutUnlocked()) { if (typeof renderHome === "function") renderHome(); return; }
  state.ui.screen = "scout";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🔍 竜スカウト"));
  app.appendChild(el("div", "as-hint2", "野に眠る竜を探しにいく。ポロが案内してくれる（出会いは表示専用＝レースには出走しません）。"));

  // 出会った頭数＝龍舎の規模
  const owned = poroMetDragonIds().filter(id => id !== "poro").length;
  const bar = el("div", "scout-bar", `🏠 龍舎の竜：<b>${owned}</b>頭　｜　🪙 <b>${(state.player.coins || 0).toLocaleString("ja-JP")}</b>`);
  app.appendChild(bar);

  app.appendChild(el("div", "stable-sec", "📍 スカウト地点をえらぶ"));
  SCOUT_SPOTS.forEach(spot => {
    const canPay = (state.player.coins || 0) >= spot.cost;
    const row = el("button", "scout-spot" + (canPay ? "" : " poor"),
      `<span class="scout-spot-ic">${spot.ic}</span>` +
      `<span class="scout-spot-tx"><b>${spot.name}</b><small>${spot.note}</small></span>` +
      `<span class="scout-spot-cost">🪙${spot.cost.toLocaleString("ja-JP")}</span>`);
    row.onclick = () => {
      if ((state.player.coins || 0) < spot.cost) {
        showInfoPopup("🔍 竜スカウト", `<div class="mm-row"><span class="mm-ic">🪙</span><div><b>コインが足りません</b><small>${spot.name}には ${spot.cost.toLocaleString("ja-JP")} コイン必要です。</small></div></div>`);
        return;
      }
      state.player.coins -= spot.cost;            // コイン消費（衣装購入と同じ＝着順/オッズ/配当には非干渉）
      if (typeof updateHeader === "function") updateHeader();
      if (typeof saveGame === "function") saveGame();
      showScoutResult(spot);
    };
    app.appendChild(row);
  });

  const actions = el("div", "actions");
  const stBtn = el("button", "secondary", "🏠 龍舎へ"); stBtn.onclick = () => renderStable();
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(stBtn); actions.appendChild(back);
  app.appendChild(actions);
}

// スカウト結果＝候補カード→契約/見送り（契約で collection に scouted を立てる＝表示専用）。
function showScoutResult(spot) {
  const cands = poroScoutCandidates(spot, 3);
  const ov = el("div", "navpop-ov");
  const box = el("div", "navpop scout-pop");
  if (!cands.length) {
    box.innerHTML = `<div class="navpop-t">${spot.ic} ${spot.name}</div><div class="scout-empty">…今日は、もう新しい竜には出会えなかった。すべての竜と出会ったのかも。</div>`;
    const ok = el("button", "navpop-go", "もどる"); ok.onclick = () => { ov.remove(); renderScout(); };
    const btns = el("div", "navpop-btns"); btns.appendChild(ok); box.appendChild(btns);
  } else {
    box.innerHTML = `<div class="navpop-t">${spot.ic} ${spot.name}で出会った竜</div>` +
      `<div class="scout-react">${poroReaction()}</div>`;
    const list = el("div", "scout-cands");
    cands.forEach(d => {
      const c = el("div", "scout-cand");
      c.innerHTML =
        `<span class="scout-cand-dot" style="background:${d.color || "#caa24a"}"></span>` +
        `<div class="scout-cand-info"><b>${d.name}</b>` +
          `<small>${poroStyleLabel(d)}・${poroDistLabel(d)}・気性${poroTemperLabel(d)}・人気${d.publicImage != null ? d.publicImage : "—"}</small>` +
          `<small class="scout-cand-cm">${d.portraitTone || ""}</small></div>`;
      const take = el("button", "scout-take", "契約する");
      take.onclick = () => {
        const e = poroColEntry(d.id);
        e.scouted = true; e.seen = true;
        raiseAffection(d.id, 10);
        if (window.Sfx && Sfx.play) Sfx.play("coin");
        c.classList.add("done");
        take.textContent = "✓ 龍舎へ"; take.disabled = true;
      };
      c.appendChild(take);
      list.appendChild(c);
    });
    box.appendChild(list);
    const btns = el("div", "navpop-btns");
    const ok = el("button", "navpop-go", "とじる"); ok.onclick = () => { ov.remove(); renderScout(); };
    btns.appendChild(ok); box.appendChild(btns);
  }
  ov.appendChild(box);
  ov.onclick = (e) => { if (e.target === ov) { ov.remove(); renderScout(); } };
  document.body.appendChild(ov);
}
