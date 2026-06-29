// =========================================================================
// ui_konron_map.js — 崑崙島 観光マップ統合ハブ（表示専用メタ・レース数値に非干渉）
// =========================================================================
// 土台＝設定の聖典の最終版「崑崙島 地形・道路整理図 V3.3」をnano img2imdで実写級3Dジオラマ化
//   (images/konron/island_map.webp・レイアウトは公式図を保持)。
// ★ピンは“密集して重なる”のを避けるため【エリア単位】に集約（公式図の位置に少数を離して配置）。
//   エリアをタップ→そのエリアのスポット一覧→スポット詳細(写真カード)＋既存機能ポータルへドリルダウン。
//   ＝タップしやすく、地名を詰め込みすぎない（ハンドオフ40の方針）。総資産で各スポット段階解放。
// ★着順・オッズ・配当には一切触れない。poro.js の後に読み込み＝renderScout等はcall-time解決。
// =========================================================================

// 7分類（スポットの色分け・凡例）
const KM_CATS = {
  port:  { name: "港・街歩き",   ic: "⛵", color: "#5aa6d6" },
  food:  { name: "食べ歩き",     ic: "🍢", color: "#e08a3a" },
  shop:  { name: "ショッピング", ic: "🛍️", color: "#d46aa8" },
  race:  { name: "レース観戦",   ic: "🏁", color: "#e2604a" },
  onsen: { name: "温泉",         ic: "♨️", color: "#36a892" },
  view:  { name: "絶景・自然",   ic: "🏞️", color: "#5cb35e" },
  oshi:  { name: "推し活・SNS",  ic: "📣", color: "#b069c8" },
  okuchi:{ name: "奥地・秘境",   ic: "🌫️", color: "#8a7bb0" }
};

// 解放しきい値（総資産＝高水位。序章0／第2話3千／第4話100万／終章1億）。表示専用ゲート。
const KM_TIER_AT = [0, 3000, 1000000, 100000000];

// スポット（写真スポットカード＋ポータル）。位置は持たない＝エリアに属する。
const KONRON_SPOTS = {
  mistra:    { name: "ミストラ湾",       cat: "port", tier: 1, time: "朝〜夕", shoot: "湾の全景・港とアレドラウ山・朝霧の船影", line: "島に着いた瞬間、旅が始まる霧と光の玄関口。" },
  kirimina:  { name: "霧港",             cat: "port", tier: 1, time: "夕〜夜", shoot: "提灯と漁船・港の屋台・干物と小舟", line: "潮の匂いと提灯の灯りが混ざる、崑崙島の生活の入口。" },
  market:    { name: "霧待ち市場",       cat: "food", tier: 0, portal: "renderMeals", time: "夜", shoot: "屋台の湯気・竜まんじゅう・ファイヤマンゴーかき氷・ミストラソーダ", line: "勝っても負けても、まずここへ。崑崙島の夜は市場の湯気から。" },
  ohzuba:    { name: "大翼通り",         cat: "port", tier: 1, time: "昼前", shoot: "レース場へ続く人波・推し竜旗・魔導掲示板", line: "港からレース場へ、島いちばん賑やかな大通り。" },
  mall:      { name: "崑崙ショッピングモール", cat: "shop", tier: 1, portal: "renderMall", time: "昼〜夜", shoot: "公式推し竜ショップ・土産袋・ぬいぐるみ・フードコート", line: "レースの思い出は、袋いっぱいに持ち帰れる。島いちばんの買い物拠点。" },
  arcade:    { name: "ミストラ・ブランドアーケード", cat: "shop", tier: 2, portal: "renderMall", time: "夕〜夜", shoot: "金色の照明・聖龍アクセサリー・高級土産袋", line: "勝った夜は、少しだけ背伸びしたくなる。" },
  donryu:    { name: "ドン竜キホーテ",   cat: "shop", tier: 2, portal: "renderMall", time: "深夜", shoot: "謎の推し竜グッズ・安売り衣装・変な土産", line: "なぜ買ったのか、明日の朝にはわからない。それも旅。" },
  kachimeshi:{ name: "勝ち飯横丁",       cat: "food", tier: 1, portal: "renderMeals", time: "レース後", shoot: "的中券と串焼き・祝勝皿・乾杯", line: "大勝ちじゃなくても今日は勝ち。ちょっとだけ豪華に。" },
  makemeshi: { name: "負け飯屋台",       cat: "food", tier: 0, portal: "renderMeals", time: "レース後〜夜", shoot: "外れ券と大盛り飯・反省茶・負け麺", line: "負けても腹は減る。明日の勝負は、まず一杯の飯から。" },
  racecourse:{ name: "中央聖龍レース場", cat: "race", tier: 0, portal: "renderRaceSelect", time: "昼〜夕", shoot: "火山を背にした観戦席・推し竜旗・的中券", line: "火山の風を切って、聖龍が駆ける。崑崙島最大の熱狂。" },
  tanryu:    { name: "単竜ひろば",       cat: "race", tier: 0, portal: "renderRaceSelect", time: "昼前", shoot: "初心者掲示板・番号札・はじめてのレース券", line: "まずは一着を選ぶ。旅の勝負はここから。" },
  oshigoods: { name: "推し竜グッズ売り場", cat: "oshi", tier: 1, portal: "renderSns", time: "終日", shoot: "推し竜旗・ぬいぐるみ・タオル・冠名グッズ", line: "レース体験を“自分の旅の記念品”に変える。" },
  ryusha:    { name: "竜舎林・竜スカウト", cat: "oshi", tier: 1, portal: "renderScout", time: "—", shoot: "—", line: "レース場の奥、竜たちの棲む森。野の竜と出会いにいく。" },
  dakon:     { name: "ダコン湖外縁",     cat: "view", tier: 3, time: "早朝", shoot: "霧の湖面・火山影・静かな湖畔（遠景のみ）", line: "見えるけれど、踏み込みすぎてはいけない、島の奥に眠る神秘。" },
  lumina:    { name: "ルミナ瀑布",       cat: "view", tier: 2, time: "午前〜昼", shoot: "密林の緑と滝・飛沫・谷の奥行き", line: "谷を越えた先で、島の水音に出会う。崑崙島随一の秘境。" },
  uroko:     { name: "ウロコトロ温泉郷", cat: "onsen", tier: 1, time: "夕〜夜", shoot: "湖畔の露天風呂・湯けむり・温泉街の灯り", line: "湯けむりと湖畔の静けさにほどける、火山島のご褒美時間。" },
  kibishis:  { name: "キビシス崖線",     cat: "view", tier: 2, time: "昼〜午後", shoot: "海へ落ちる崖・風の展望台・翼竜の遠い影", line: "空が近い。ここは翼のための場所。息を呑むスケール。" },
  sena:      { name: "サナ湾／セナ浜",   cat: "view", tier: 2, time: "昼", shoot: "白砂とラグーン・ミストラソーダ・ファイヤマンゴーアイス", line: "白砂と青い海、旅気分が一気に高まる開放的ビーチ。" },
  bangara:   { name: "バンガラ溶岩海岸", cat: "view", tier: 2, time: "夕方", shoot: "黒い溶岩と白波・遊歩道・アニキ岩礁遠景", line: "黒い溶岩と荒波がぶつかる、野性味むき出しの絶景海岸。" },
  hoshiuo:   { name: "エサナ入江／ホシウオ村", cat: "port", tier: 2, time: "朝", shoot: "小舟・干物・魚箱・竜餌用の魚", line: "観光地の奥に、島の暮らしがある。素朴な漁村。" },
  // ── 奥地・霧の彼方（聖典：簡単に入れない神秘＝終盤解放のteaser・遠景のみ・出しすぎない） ──
  dadake:    { name: "ダダケ村",     cat: "okuchi", tier: 3, time: "—", shoot: "段々畑と古い竜小屋・無口な村人（遠景）", line: "市街と火山のあいだ、霧に隠れた古い村。地図には載るが、道はすぐ霧に消える。" },
  susufuka:  { name: "スス深回廊",   cat: "okuchi", tier: 3, time: "—", shoot: "黒い岩の回廊・苔と燐光（遠景）", line: "火山の体内へ続く黒い回廊。奥から熱と、低い唸りが届く。踏み込む者は少ない。" },
  rondo:     { name: "ロンド元宮",   cat: "okuchi", tier: 3, time: "—", shoot: "沈んだ盆地の祭祀場跡・霧の参道（遠景）", line: "カルデラの底、ダコン湖のほとりに眠る最初の宮。竜と人が契りを交わした場所。" },
  gwaruga:   { name: "グワルガ北岸", cat: "okuchi", tier: 3, time: "—", shoot: "道なき荒岩海岸・砕ける波（遠景）", line: "島の北。道は無い。荒い岩と波だけが、人を寄せつけず在りつづける。" },
  kyokai:    { name: "饗会の影",     cat: "okuchi", tier: 3, time: "—", shoot: "—", line: "島の裏でだけ囁かれる名。表の崑崙からは、その気配が時おり霧に混じるばかり。" }
};

// 【エリア】＝公式図の位置に“よく離して”配置（mx,my＝画像%）。重なり/タップ不能を解消。
const KONRON_AREAS = [
  { id: "city",    name: "港町・市街",   ic: "🏙️", color: "#5aa6d6", mx: 15, my: 46, spots: ["mistra", "kirimina", "market", "ohzuba", "mall", "arcade", "donryu", "kachimeshi", "makemeshi"] },
  { id: "falls",   name: "ルミナ瀑布",   ic: "🏞️", color: "#5cb35e", mx: 30, my: 22, spots: ["lumina"] },
  { id: "race",    name: "聖龍レース場", ic: "🏁", color: "#e2604a", mx: 33, my: 60, spots: ["racecourse", "tanryu", "oshigoods"] },
  { id: "sanctum", name: "竜舎林・ダコン湖", ic: "🐉", color: "#b069c8", mx: 46, my: 42, spots: ["ryusha", "dakon"] },
  { id: "onsen",   name: "ウロコトロ温泉郷", ic: "♨️", color: "#36a892", mx: 46, my: 63, spots: ["uroko"] },
  { id: "cliff",   name: "キビシス崖線", ic: "🪨", color: "#9aa05a", mx: 77, my: 33, spots: ["kibishis"] },
  { id: "beach",   name: "南岸ビーチ",   ic: "🏖️", color: "#e0b84a", mx: 27, my: 81, spots: ["sena", "bangara"] },
  { id: "fishing", name: "ホシウオ村",   ic: "🎣", color: "#e08a3a", mx: 60, my: 72, spots: ["hoshiuo"] },
  { id: "okuchi",  name: "奥地・霧の彼方", ic: "🌫️", color: "#8a7bb0", mx: 61, my: 27, spots: ["dadake", "susufuka", "rondo", "gwaruga", "kyokai"] }
];

function konronMapUnlocked() { return true; }
function _kmTotal() { return (state.player && state.player.totalAssets) || 0; }
function _kmSpotOpen(s) { return _kmTotal() >= (KM_TIER_AT[(s && s.tier) || 0] || 0); }
function _kmTierLabel(t) { return ["序盤", "中盤", "後半", "終盤"][t] || ""; }

// ②「いまの崑崙島」＝時刻(実時計)・天候(日替わり・決定的)・賑わい。表示専用の空気演出。
function _kmIslandNow() {
  var d = new Date(), h = d.getHours();
  var slot = (h < 5)  ? { k: "未明",   ic: "🌌", nigiwai: "奥地の竜だけが目覚める、静かな刻。" }
           : (h < 10) ? { k: "朝",     ic: "🌅", nigiwai: "霧港に船が入り、市場が荷をひらく頃。" }
           : (h < 15) ? { k: "昼",     ic: "☀️", nigiwai: "レース場がいちばん沸く、勝負の時間。" }
           : (h < 18) ? { k: "夕暮れ", ic: "🌇", nigiwai: "勝ち負けの差が、灯りはじめる頃。" }
           : (h < 22) ? { k: "宵",     ic: "🏮", nigiwai: "霧待ち市場の湯気と提灯が主役の刻。" }
           :            { k: "夜",     ic: "🌙", nigiwai: "温泉郷の灯りだけが、湖面に揺れる。" };
  var wx = ["快晴", "晴れときどき霧", "霧ふかし", "通り雨のち晴れ", "薄曇り", "夕焼け雲", "海風つよし"];
  var doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return { k: slot.k, ic: slot.ic, weather: wx[doy % wx.length], nigiwai: slot.nigiwai };
}

let _kmArea = null;   // 選択中のエリアid
let _kmSpot = null;   // 選択中のスポットid

function renderKonronMap() {
  state.ui.screen = "konron_map";
  _kmArea = null; _kmSpot = null;
  const app = beginScreen();
  // 全景ヒーロー（A2＝実写級の島の空撮。タイトルを重ねる＝この島の“顔”）。無い環境ではonerrorで自然に消える。
  const hero = el("div", "km-hero");
  hero.innerHTML = `<img class="km-hero-img" src="images/konron/island_aerial.webp" alt="崑崙島 全景" decoding="async" onerror="this.closest('.km-hero').classList.add('km-hero--noimg')">` +
    `<div class="km-hero-cap"><b>🏝 崑崙島 観光マップ</b><span>霧の火山島リゾート、崑崙島へようこそ</span></div>`;
  app.appendChild(hero);
  app.appendChild(el("div", "as-hint2", "<b>エリア</b>をタップすると、その地区の拡大マップ・スポット・各施設が見られます（表示専用＝レースの結果には影響しません）。"));
  // ②「いまの崑崙島」＝時刻・天候・賑わいの空気演出
  var _now = _kmIslandNow();
  app.appendChild(el("div", "km-now", `<span class="km-now-ic">${_now.ic}</span><div class="km-now-tx"><b>いまの崑崙島：${_now.k}・${_now.weather}</b><span>${_now.nigiwai}</span></div>`));

  // 公式マップ準拠ジオラマ ＋ 少数のエリアピン（よく離して配置＝重ならない・押しやすい）
  const stage = el("div", "km-stage");
  stage.innerHTML = `<img class="km-mapimg" src="images/konron/island_map.webp" alt="崑崙島 観光ジオラマ地図（地形・道路整理図V3.3に準拠）" decoding="async">`;
  KONRON_AREAS.forEach(a => {
    const pin = el("button", "km-areapin", `<span class="km-areapin-dot">${a.ic}</span><span class="km-areapin-lbl">${a.name}</span>`);
    pin.style.left = a.mx + "%"; pin.style.top = a.my + "%";
    pin.style.setProperty("--pc", a.color);
    pin.setAttribute("data-area", a.id);
    pin.onclick = () => {
      _kmArea = a.id;
      _kmSpot = (a.spots.length === 1) ? a.spots[0] : null;   // 単一スポットのエリアは直接そのスポットへ
      _kmRenderPanel(); _kmMarkSel(stage);
    };
    stage.appendChild(pin);
  });
  app.appendChild(stage);

  // 凡例（7分類）
  const leg = el("div", "km-legend");
  Object.keys(KM_CATS).forEach(k => {
    const c = KM_CATS[k];
    leg.appendChild(el("span", "km-leg", `<i style="background:${c.color}"></i>${c.ic} ${c.name}`));
  });
  app.appendChild(leg);

  const panel = el("div", "km-panel"); panel.id = "km-panel";
  app.appendChild(panel);
  _kmRenderPanel();

  const actions = el("div", "actions");
  const guide = el("button", null, "📖 崑崙ガイドブック"); guide.onclick = () => renderKonronGuide();
  actions.appendChild(guide);
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

// ④ 崑崙ガイドブック（島の図鑑）：KONRON_GUIDE を分類表示。tier＝総資産で段階解放（未解放は？？？）。表示専用。
function renderKonronGuide() {
  state.ui.screen = "konron_guide";
  const app = beginScreen();
  app.appendChild(el("h2", null, "📖 崑崙ガイドブック"));
  let total = 0, open = 0;
  (typeof KONRON_GUIDE !== "undefined" ? KONRON_GUIDE : []).forEach(c => c.entries.forEach(e => { total++; if (_kmTotal() >= (KM_TIER_AT[e.tier] || 0)) open++; }));
  app.appendChild(el("div", "as-hint2", `崑崙島の歴史・文化・食・竜・地理を集める図鑑。総資産が増えると新しい項目が解放されます（表示専用＝レース結果には影響しません）。<b>${open} / ${total}</b> 解放。`));
  (typeof KONRON_GUIDE !== "undefined" ? KONRON_GUIDE : []).forEach(c => {
    const sec = el("div", "kg-sec");
    let h = `<div class="kg-cat"><span class="kg-cat-ic">${c.ic}</span>${c.cat}</div>`;
    c.entries.forEach(e => {
      const unlocked = _kmTotal() >= (KM_TIER_AT[e.tier] || 0);
      if (unlocked) {
        h += `<div class="kg-entry"><b>${e.title}</b><p>${e.body}</p></div>`;
      } else {
        h += `<div class="kg-entry kg-entry--locked"><b>？？？</b><p>🔒 ${_kmTierLabel(e.tier)}で解放（総資産 ${(KM_TIER_AT[e.tier] || 0).toLocaleString("ja-JP")}）</p></div>`;
      }
    });
    sec.innerHTML = h;
    app.appendChild(sec);
  });
  const actions = el("div", "actions");
  const back = el("button", null, "🏝 観光マップへ戻る"); back.onclick = () => renderKonronMap();
  actions.appendChild(back);
  app.appendChild(actions);
}

function _kmMarkSel(stage) {
  stage.querySelectorAll(".km-areapin").forEach(p => {
    p.classList.toggle("km-areapin--sel", p.getAttribute("data-area") === _kmArea);
  });
}

function _kmAreaOf(spotId) { return KONRON_AREAS.find(a => a.spots.indexOf(spotId) >= 0); }

// 拡大マップのバナー：エリアへ“進む”と、本マップ(ジオラマ)を該当エリアにズームして表示。
// bespokeな専用絵 images/konron/area_<id>.webp があれば自動で全面に差し替わる（onerrorでズーム版にフォールバック）。
function _kmZoomBanner(area) {
  if (!area) return "";
  return `<div class="km-zoom" style="background-image:url('images/konron/island_map.webp');background-position:${area.mx}% ${area.my}%">` +
    `<img class="km-zoom-img" src="images/konron/area_${area.id}.webp?v=2" alt="" decoding="async" onload="this.classList.add('on')" onerror="this.remove()">` +
    `<span class="km-zoom-tag">🔍 ${area.name}・拡大マップ</span></div>`;
}

// スポットの“中身”（見どころ／名物／豆知識）。konron_content.js が未読込でも安全に空を返す。
function _kmContentHtml(spotId) {
  var c = (typeof konronContentOf === "function") ? konronContentOf(spotId) : null;
  if (!c) return "";
  var h = '<div class="km-content">';
  if (c.midokoro && c.midokoro.length) {
    h += '<div class="km-sec"><div class="km-sec-h">✦ 見どころ</div>';
    c.midokoro.forEach(function (m) { h += '<div class="km-md">' + m + '</div>'; });
    h += '</div>';
  }
  if (c.meibutsu) {
    h += '<div class="km-meibutsu"><span class="km-mei-tag">名物</span><div class="km-mei-b"><b>' + c.meibutsu.name + '</b>' +
      (c.meibutsu.note ? '<small>' + c.meibutsu.note + '</small>' : '') + '</div></div>';
  }
  if (c.trivia) h += '<div class="km-trivia">💡 <span>' + c.trivia + '</span></div>';
  return h + '</div>';
}

function _kmRenderPanel() {
  const panel = document.getElementById("km-panel"); if (!panel) return;

  // ① スポット詳細（写真カード＋ポータル）
  if (_kmSpot && KONRON_SPOTS[_kmSpot]) {
    const s = KONRON_SPOTS[_kmSpot];
    const c = KM_CATS[s.cat] || KM_CATS.port;
    const area = _kmAreaOf(_kmSpot);
    const open = _kmSpotOpen(s);
    panel.style.setProperty("--kmc", c.color);
    let body = _kmZoomBanner(area);
    if (area && area.spots.length > 1) body += `<button class="km-areaback" data-back="1">← ${area.name}</button>`;
    body += `<div class="km-card-head"><span class="km-card-ic">${c.ic}</span>` +
      `<div class="km-card-id"><b>${s.name}</b><small>${c.name}${s.time && s.time !== "—" ? "・" + s.time : ""}</small></div></div>`;
    if (!open) {
      body += `<div class="km-card-lock">🔒 まだ行けない場所（<b>${_kmTierLabel(s.tier)}</b>で解放）。総資産 ${KM_TIER_AT[s.tier].toLocaleString("ja-JP")} で開放。</div>`;
    } else {
      body += `<div class="km-card-line">${s.line}</div>`;
      if (s.shoot && s.shoot !== "—") body += `<div class="km-card-shoot">📸 撮れるもの：${s.shoot}</div>`;
      body += _kmContentHtml(_kmSpot);   // 見どころ／名物／豆知識（作りこみ）
      if (s.portal && typeof window[s.portal] === "function") {
        const labelMap = { renderMeals: "🍢 食べ歩きへ", renderMall: "🛍️ ショッピングへ", renderRaceSelect: "🏁 レースへ", renderSns: "📣 SNSへ", renderScout: "🐉 竜スカウトへ" };
        body += `<button class="km-go" data-portal="${s.portal}">${labelMap[s.portal] || "▶ ひらく"}</button>`;
      } else {
        body += `<div class="km-card-photo">🏞️ 撮影スポット（眺めて楽しむ名所）</div>`;
      }
    }
    panel.innerHTML = body;
    const bk = panel.querySelector(".km-areaback");
    if (bk) bk.onclick = () => { _kmSpot = null; _kmRenderPanel(); };
    const go = panel.querySelector(".km-go");
    if (go) go.onclick = () => { const fn = window[go.getAttribute("data-portal")]; if (typeof fn === "function") fn(); };
    return;
  }

  // ② エリア（複数スポット）＝スポット一覧チップ
  if (_kmArea) {
    const area = KONRON_AREAS.find(a => a.id === _kmArea);
    if (area) {
      panel.style.setProperty("--kmc", area.color);
      let body = _kmZoomBanner(area) + `<div class="km-area-head"><span class="km-card-ic">${area.ic}</span><b>${area.name}</b><small>タップでスポットへ</small></div><div class="km-chips">`;
      area.spots.forEach(id => {
        const s = KONRON_SPOTS[id]; if (!s) return;
        const c = KM_CATS[s.cat] || KM_CATS.port;
        const open = _kmSpotOpen(s);
        body += `<button class="km-chip${open ? "" : " km-chip--locked"}" data-spot="${id}" style="--cc:${c.color}">` +
          `<span class="km-chip-ic">${open ? c.ic : "🔒"}</span>${s.name}</button>`;
      });
      body += `</div>`;
      panel.innerHTML = body;
      panel.querySelectorAll(".km-chip").forEach(ch => {
        ch.onclick = () => { _kmSpot = ch.getAttribute("data-spot"); _kmRenderPanel(); };
      });
      return;
    }
  }

  // ③ 既定
  panel.innerHTML = `<div class="km-hint">📍 エリアのピンをタップすると、その地区のスポットと施設が見られます。</div>`;
}
