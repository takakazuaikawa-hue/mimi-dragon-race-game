// =========================================================================
// ui_konron_map.js — 崑崙島 観光マップ統合ハブ（表示専用メタ・レース数値に非干渉）
// =========================================================================
// 土台＝設定の聖典の最終版マップ「崑崙島 地形・道路整理図 V3.3」(images/konron/island_map.jpg)。
//   ピンは“この公式マップの位置どおり”に配置（mx,my＝画像に対する%）。自己流の地形生成はしない。
//   タップ→写真スポットカード＋既存機能ポータル（食事/モール/レース/SNS/竜スカウト）。総資産で段階解放。
// ★絶対ルール：ショッピング最大値＝崑崙モール／SNS映えは食・買・推し・戦利品も／奥地は出しすぎない。
// ★着順・オッズ・配当には一切触れない。poro.js の後に読み込み＝renderScout等はcall-time解決。
// =========================================================================

// 7分類（ハンドオフ40 §1）
const KM_CATS = {
  port:  { name: "港・街歩き",   ic: "⛵", color: "#5aa6d6" },
  food:  { name: "食べ歩き",     ic: "🍢", color: "#e08a3a" },
  shop:  { name: "ショッピング", ic: "🛍️", color: "#d46aa8" },
  race:  { name: "レース観戦",   ic: "🏁", color: "#e2604a" },
  onsen: { name: "温泉",         ic: "♨️", color: "#36a892" },
  view:  { name: "絶景・自然",   ic: "🏞️", color: "#5cb35e" },
  oshi:  { name: "推し活・SNS",  ic: "📣", color: "#b069c8" }
};

// 解放しきい値（総資産＝高水位。序章0／第2話3千／第4話100万／終章1億）。表示専用ゲート。
const KM_TIER_AT = [0, 3000, 1000000, 100000000];

// スポット定義。mx,my＝公式マップ画像(1800×1158)に対する位置(%)。★「崑崙島 地形・道路整理図 V3.3」に準拠。
// portal＝既存画面の描画関数名（無ければ写真カード詳細）。small＝小ピン。time/shoot/line＝写真スポットカード(41)。
const KONRON_SPOTS = [
  // 港・街歩き（西岸 ミストラ湾）
  { id: "mistra",  name: "ミストラ湾",       cat: "port", mx: 12, my: 40, tier: 1, time: "朝〜夕", shoot: "湾の全景・港とアレドラウ山・朝霧の船影", line: "島に着いた瞬間、旅が始まる霧と光の玄関口。" },
  { id: "kirimina",name: "霧港",             cat: "port", mx: 17, my: 45, tier: 1, time: "夕〜夜", shoot: "提灯と漁船・港の屋台・干物と小舟", line: "潮の匂いと提灯の灯りが混ざる、崑崙島の生活の入口。" },
  { id: "ohzuba",  name: "大翼通り",         cat: "port", mx: 26, my: 50, tier: 1, time: "昼前", shoot: "レース場へ続く人波・推し竜旗・魔導掲示板", line: "港からレース場へ、島いちばん賑やかな大通り。" },
  // 食べ歩き（霧待ち市場＝みみしんぼ）
  { id: "market",  name: "霧待ち市場",       cat: "food", mx: 14, my: 51, tier: 0, portal: "renderMeals", time: "夜", shoot: "屋台の湯気・竜まんじゅう・ファイヤマンゴーかき氷・ミストラソーダ", line: "勝っても負けても、まずここへ。崑崙島の夜は市場の湯気から。" },
  { id: "kachimeshi", name: "勝ち飯横丁",    cat: "food", mx: 30, my: 61, tier: 1, small: true, portal: "renderMeals", time: "レース後", shoot: "的中券と串焼き・祝勝皿・乾杯", line: "大勝ちじゃなくても今日は勝ち。ちょっとだけ豪華に。" },
  { id: "makemeshi",  name: "負け飯屋台",    cat: "food", mx: 22, my: 56, tier: 0, small: true, portal: "renderMeals", time: "レース後〜夜", shoot: "外れ券と大盛り飯・反省茶・負け麺", line: "負けても腹は減る。明日の勝負は、まず一杯の飯から。" },
  // ショッピング（崑崙モール＝最大値）
  { id: "mall",    name: "崑崙ショッピングモール", cat: "shop", mx: 19, my: 54, tier: 1, portal: "renderMall", time: "昼〜夜", shoot: "公式推し竜ショップ・土産袋・ぬいぐるみ・フードコート", line: "レースの思い出は、袋いっぱいに持ち帰れる。島いちばんの買い物拠点。" },
  { id: "arcade",  name: "ミストラ・ブランドアーケード", cat: "shop", mx: 26, my: 56, tier: 2, small: true, portal: "renderMall", time: "夕〜夜", shoot: "金色の照明・聖龍アクセサリー・高級土産袋", line: "勝った夜は、少しだけ背伸びしたくなる。" },
  { id: "donryu",  name: "ドン竜キホーテ",   cat: "shop", mx: 17, my: 59, tier: 2, small: true, portal: "renderMall", time: "深夜", shoot: "謎の推し竜グッズ・安売り衣装・変な土産", line: "なぜ買ったのか、明日の朝にはわからない。それも旅。" },
  // レース観戦（中央聖龍レース場）
  { id: "racecourse", name: "中央聖龍レース場", cat: "race", mx: 33, my: 57, tier: 0, portal: "renderRaceSelect", time: "昼〜夕", shoot: "火山を背にした観戦席・推し竜旗・的中券", line: "火山の風を切って、聖龍が駆ける。崑崙島最大の熱狂。" },
  { id: "tanryu", name: "単竜ひろば",        cat: "race", mx: 38, my: 60, tier: 0, small: true, portal: "renderRaceSelect", time: "昼前", shoot: "初心者掲示板・番号札・はじめてのレース券", line: "まずは一着を選ぶ。旅の勝負はここから。" },
  // 推し活・SNS（竜スカウト＝竜舎林 / 推し竜グッズ）
  { id: "oshigoods", name: "推し竜グッズ売り場", cat: "oshi", mx: 36, my: 52, tier: 1, small: true, portal: "renderSns", time: "終日", shoot: "推し竜旗・ぬいぐるみ・タオル・冠名グッズ", line: "レース体験を“自分の旅の記念品”に変える。" },
  { id: "ryusha", name: "竜舎林・竜スカウト", cat: "oshi", mx: 42, my: 47, tier: 1, portal: "renderScout", time: "—", shoot: "—", line: "レース場の奥、竜たちの棲む森。野の竜と出会いにいく。" },
  // 温泉
  { id: "uroko", name: "ウロコトロ温泉郷",  cat: "onsen", mx: 41, my: 62, tier: 1, time: "夕〜夜", shoot: "湖畔の露天風呂・湯けむり・温泉街の灯り", line: "湯けむりと湖畔の静けさにほどける、火山島のご褒美時間。" },
  // 絶景・自然
  { id: "lumina", name: "ルミナ瀑布",        cat: "view", mx: 30, my: 24, tier: 2, time: "午前〜昼", shoot: "密林の緑と滝・飛沫・谷の奥行き", line: "谷を越えた先で、島の水音に出会う。崑崙島随一の秘境。" },
  { id: "kibishis", name: "キビシス崖線",    cat: "view", mx: 76, my: 34, tier: 2, time: "昼〜午後", shoot: "海へ落ちる崖・風の展望台・翼竜の遠い影", line: "空が近い。ここは翼のための場所。息を呑むスケール。" },
  { id: "sena", name: "サナ湾／セナ浜",      cat: "view", mx: 19, my: 79, tier: 2, time: "昼", shoot: "白砂とラグーン・ミストラソーダ・ファイヤマンゴーアイス", line: "白砂と青い海、旅気分が一気に高まる開放的ビーチ。" },
  { id: "bangara", name: "バンガラ溶岩海岸", cat: "view", mx: 44, my: 80, tier: 2, time: "夕方", shoot: "黒い溶岩と白波・遊歩道・アニキ岩礁遠景", line: "黒い溶岩と荒波がぶつかる、野性味むき出しの絶景海岸。" },
  { id: "hoshiuo", name: "エサナ入江／ホシウオ村", cat: "port", mx: 60, my: 72, tier: 2, small: true, time: "朝", shoot: "小舟・干物・魚箱・竜餌用の魚", line: "観光地の奥に、島の暮らしがある。素朴な漁村。" },
  { id: "dakon", name: "ダコン湖外縁",       cat: "view", mx: 46, my: 37, tier: 3, time: "早朝", shoot: "霧の湖面・火山影・静かな湖畔（遠景のみ）", line: "見えるけれど、踏み込みすぎてはいけない、島の奥に眠る神秘。" }
];

function konronMapUnlocked() { return true; }
function _kmTotal() { return (state.player && state.player.totalAssets) || 0; }
function _kmSpotOpen(s) { return _kmTotal() >= (KM_TIER_AT[s.tier || 0] || 0); }
function _kmTierLabel(t) { return ["序盤", "中盤", "後半", "終盤"][t] || ""; }

let _kmSelected = null;

function renderKonronMap() {
  state.ui.screen = "konron_map";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🏝 崑崙島 観光マップ"));
  app.appendChild(el("div", "as-hint2", "霧の火山島リゾート・崑崙島の全景（地形・道路整理図 V3.3）。ピンをタップで写真スポットと各施設へ（表示専用＝レースの結果には影響しません）。"));

  // ── 公式マップ（最終版）を土台に、図の位置どおりピンを重ねる ──
  const stage = el("div", "km-stage");
  stage.innerHTML = `<img class="km-mapimg" src="images/konron/island_map.webp" alt="崑崙島 観光ジオラマ地図（地形・道路整理図V3.3に準拠）" decoding="async">`;
  KONRON_SPOTS.forEach(s => {
    const c = KM_CATS[s.cat] || KM_CATS.port;
    const open = _kmSpotOpen(s);
    const b = el("button", "km-pinbtn" + (open ? "" : " km-pinbtn--locked") + (s.small ? " km-pinbtn--small" : ""), open ? c.ic : "🔒");
    b.style.left = s.mx + "%"; b.style.top = s.my + "%";
    b.style.setProperty("--pc", open ? c.color : "#5a6068");
    b.title = s.name;
    b.setAttribute("data-spot", s.id);
    b.onclick = () => { _kmSelected = s.id; _kmRenderPanel(); _kmMarkSel(stage); };
    stage.appendChild(b);
  });
  app.appendChild(stage);

  // 凡例（7分類）
  const leg = el("div", "km-legend");
  Object.keys(KM_CATS).forEach(k => {
    const c = KM_CATS[k];
    leg.appendChild(el("span", "km-leg", `<i style="background:${c.color}"></i>${c.ic} ${c.name}`));
  });
  app.appendChild(leg);

  // 詳細パネル
  const panel = el("div", "km-panel"); panel.id = "km-panel";
  app.appendChild(panel);
  _kmRenderPanel();

  const actions = el("div", "actions");
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

function _kmMarkSel(stage) {
  stage.querySelectorAll(".km-pinbtn").forEach(b => {
    b.classList.toggle("km-pinbtn--sel", b.getAttribute("data-spot") === _kmSelected);
  });
}

function _kmRenderPanel() {
  const panel = document.getElementById("km-panel"); if (!panel) return;
  const s = KONRON_SPOTS.find(x => x.id === _kmSelected);
  if (!s) {
    panel.innerHTML = `<div class="km-hint">📍 ピンをタップすると、写真スポットと施設が見られます。</div>`;
    return;
  }
  const c = KM_CATS[s.cat] || KM_CATS.port;
  const open = _kmSpotOpen(s);
  panel.style.setProperty("--kmc", c.color);
  let body =
    `<div class="km-card-head"><span class="km-card-ic">${c.ic}</span>` +
      `<div class="km-card-id"><b>${s.name}</b><small>${c.name}${s.time && s.time !== "—" ? "・" + s.time : ""}</small></div></div>`;
  if (!open) {
    body += `<div class="km-card-lock">🔒 まだ行けない場所（<b>${_kmTierLabel(s.tier)}</b>で解放）。総資産 ${KM_TIER_AT[s.tier].toLocaleString("ja-JP")} で開放。</div>`;
  } else {
    body += `<div class="km-card-line">${s.line}</div>`;
    if (s.shoot && s.shoot !== "—") body += `<div class="km-card-shoot">📸 撮れるもの：${s.shoot}</div>`;
    if (s.portal && typeof window[s.portal] === "function") {
      const labelMap = { renderMeals: "🍢 食べ歩きへ", renderMall: "🛍️ ショッピングへ", renderRaceSelect: "🏁 レースへ", renderSns: "📣 SNSへ", renderScout: "🐉 竜スカウトへ" };
      body += `<button class="km-go" data-portal="${s.portal}">${labelMap[s.portal] || "▶ ひらく"}</button>`;
    } else {
      body += `<div class="km-card-photo">🏞️ 撮影スポット（眺めて楽しむ名所）</div>`;
    }
  }
  panel.innerHTML = body;
  const go = panel.querySelector(".km-go");
  if (go) go.onclick = () => { const fn = window[go.getAttribute("data-portal")]; if (typeof fn === "function") fn(); };
}
