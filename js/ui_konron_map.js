// =========================================================================
// ui_konron_map.js — 崑崙島 観光マップ統合ハブ（表示専用メタ・レース数値に非干渉）
// =========================================================================
// 設定の聖典：OneDrive\KONRON_ISLAND_CLAUDE_CODE_HANDOFF_SET（37地形/39観光12選/40マップ/41写真カード）。
//   ・崑崙島の地形を stylized SVG で描き、7分類のスポットを“地理位置”にピン配置。
//   ・タップ→写真スポットカード＋既存機能へのポータル（食事/モール/レース/SNS/スカウト）。
//   ・進行（総資産）で段階解放。奥地（ダダケ村/スス深回廊/ロンド元宮/グワルガ/饗会）は出しすぎない＝薄い「？神秘の奥」のみ。
//   ・★絶対ルール：ショッピング最大値＝崑崙ショッピングモール／SNS映えは食・買・推し・戦利品も同格／地名を詰め込まず観光導線優先。
// ★着順・オッズ・配当には一切触れない。
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

// スポット定義。x,y＝SVG(1000×640)上の地理位置。portal＝既存画面の描画関数名（無ければ写真カード詳細）。
// small＝小ピン。time/shoot/line＝写真スポットカード（41）。tier＝解放段階(0序盤..3終盤)。
const KONRON_SPOTS = [
  // 港・街歩き（西岸 ミストラ湾）
  { id: "mistra",  name: "ミストラ湾",       cat: "port", x: 150, y: 300, tier: 1, time: "朝〜夕", shoot: "湾の全景・港とアレドラウ山・朝霧の船影", line: "島に着いた瞬間、旅が始まる霧と光の玄関口。" },
  { id: "kirimina",name: "霧港",             cat: "port", x: 205, y: 352, tier: 1, time: "夕〜夜", shoot: "提灯と漁船・港の屋台・干物と小舟", line: "潮の匂いと提灯の灯りが混ざる、崑崙島の生活の入口。" },
  { id: "ohzuba",  name: "大翼通り",         cat: "port", x: 360, y: 300, tier: 1, time: "昼前", shoot: "レース場へ続く人波・推し竜旗・魔導掲示板", line: "港からレース場へ、島いちばん賑やかな大通り。" },
  // 食べ歩き（霧待ち市場＝みみしんぼ）
  { id: "market",  name: "霧待ち市場",       cat: "food", x: 272, y: 300, tier: 0, portal: "renderMeals", time: "夜", shoot: "屋台の湯気・竜まんじゅう・ファイヤマンゴーかき氷・ミストラソーダ", line: "勝っても負けても、まずここへ。崑崙島の夜は市場の湯気から。" },
  { id: "kachimeshi", name: "勝ち飯横丁",    cat: "food", x: 512, y: 318, tier: 1, small: true, portal: "renderMeals", time: "レース後", shoot: "的中券と串焼き・祝勝皿・乾杯", line: "大勝ちじゃなくても今日は勝ち。ちょっとだけ豪華に。" },
  { id: "makemeshi",  name: "負け飯屋台",    cat: "food", x: 418, y: 346, tier: 0, small: true, portal: "renderMeals", time: "レース後〜夜", shoot: "外れ券と大盛り飯・反省茶・負け麺", line: "負けても腹は減る。明日の勝負は、まず一杯の飯から。" },
  // ショッピング（崑崙モール＝最大値）
  { id: "mall",    name: "崑崙ショッピングモール", cat: "shop", x: 345, y: 360, tier: 1, portal: "renderMall", time: "昼〜夜", shoot: "公式推し竜ショップ・土産袋・ぬいぐるみ・フードコート", line: "レースの思い出は、袋いっぱいに持ち帰れる。島いちばんの買い物拠点。" },
  { id: "arcade",  name: "ミストラ・ブランドアーケード", cat: "shop", x: 296, y: 402, tier: 2, small: true, portal: "renderMall", time: "夕〜夜", shoot: "金色の照明・聖龍アクセサリー・高級土産袋", line: "勝った夜は、少しだけ背伸びしたくなる。" },
  { id: "donryu",  name: "ドン竜キホーテ",   cat: "shop", x: 392, y: 408, tier: 2, small: true, portal: "renderMall", time: "深夜", shoot: "謎の推し竜グッズ・安売り衣装・変な土産", line: "なぜ買ったのか、明日の朝にはわからない。それも旅。" },
  // レース観戦（中央聖龍レース場）
  { id: "racecourse", name: "中央聖龍レース場", cat: "race", x: 468, y: 276, tier: 0, portal: "renderRaceSelect", time: "昼〜夕", shoot: "火山を背にした観戦席・推し竜旗・的中券", line: "火山の風を切って、聖龍が駆ける。崑崙島最大の熱狂。" },
  { id: "tanryu", name: "単竜ひろば",        cat: "race", x: 436, y: 314, tier: 0, small: true, portal: "renderRaceSelect", time: "昼前", shoot: "初心者掲示板・番号札・はじめてのレース券", line: "まずは一着を選ぶ。旅の勝負はここから。" },
  // 推し活・SNS（竜スカウト＝竜舎林 / 推し竜グッズ）
  { id: "oshigoods", name: "推し竜グッズ売り場", cat: "oshi", x: 414, y: 244, tier: 1, small: true, portal: "renderSns", time: "終日", shoot: "推し竜旗・ぬいぐるみ・タオル・冠名グッズ", line: "レース体験を“自分の旅の記念品”に変える。" },
  { id: "ryusha", name: "竜舎林・竜スカウト", cat: "oshi", x: 520, y: 214, tier: 1, portal: "renderScout", time: "—", shoot: "—", line: "レース場の奥、竜たちの棲む森。野の竜と出会いにいく。" },
  // 温泉
  { id: "uroko", name: "ウロコトロ温泉郷",  cat: "onsen", x: 624, y: 352, tier: 1, time: "夕〜夜", shoot: "湖畔の露天風呂・湯けむり・温泉街の灯り", line: "湯けむりと湖畔の静けさにほどける、火山島のご褒美時間。" },
  // 絶景・自然
  { id: "lumina", name: "ルミナ瀑布",        cat: "view", x: 470, y: 176, tier: 2, time: "午前〜昼", shoot: "密林の緑と滝・飛沫・谷の奥行き", line: "谷を越えた先で、島の水音に出会う。崑崙島随一の秘境。" },
  { id: "kibishis", name: "キビシス崖線",    cat: "view", x: 822, y: 248, tier: 2, time: "昼〜午後", shoot: "海へ落ちる崖・風の展望台・翼竜の遠い影", line: "空が近い。ここは翼のための場所。息を呑むスケール。" },
  { id: "sena", name: "サナ湾／セナ浜",      cat: "view", x: 372, y: 522, tier: 2, time: "昼", shoot: "白砂とラグーン・ミストラソーダ・ファイヤマンゴーアイス", line: "白砂と青い海、旅気分が一気に高まる開放的ビーチ。" },
  { id: "bangara", name: "バンガラ溶岩海岸", cat: "view", x: 520, y: 540, tier: 2, time: "夕方", shoot: "黒い溶岩と白波・遊歩道・アニキ岩礁遠景", line: "黒い溶岩と荒波がぶつかる、野性味むき出しの絶景海岸。" },
  { id: "hoshiuo", name: "エサナ入江／ホシウオ村", cat: "port", x: 668, y: 498, tier: 2, small: true, time: "朝", shoot: "小舟・干物・魚箱・竜餌用の魚", line: "観光地の奥に、島の暮らしがある。素朴な漁村。" },
  { id: "dakon", name: "ダコン湖外縁",       cat: "view", x: 566, y: 388, tier: 3, time: "早朝", shoot: "霧の湖面・火山影・静かな湖畔（遠景のみ）", line: "見えるけれど、踏み込みすぎてはいけない、島の奥に眠る神秘。" }
];

function konronMapUnlocked() {
  // ホーム到達（序章）で開く。実質いつでも見られる観光ハブ。
  return true;
}
function _kmTotal() { return (state.player && state.player.totalAssets) || 0; }
function _kmSpotOpen(s) { return _kmTotal() >= (KM_TIER_AT[s.tier || 0] || 0); }
function _kmTierLabel(t) { return ["序盤", "中盤", "後半", "終盤"][t] || ""; }

let _kmSelected = null;

function renderKonronMap() {
  state.ui.screen = "konron_map";
  const app = beginScreen();
  app.appendChild(el("h2", null, "🏝 崑崙島 観光マップ"));
  app.appendChild(el("div", "as-hint2", "霧の火山島リゾート・崑崙島。<b>食べて、賭けて、買って、癒やされる</b>。ピンをタップで写真スポットと各施設へ（表示専用＝レースの結果には影響しません）。"));

  // ── 地図（stylized SVG・地形は道路整理図V3.3に準拠）──
  const wrap = el("div", "km-wrap");
  let pins = "";
  KONRON_SPOTS.forEach(s => {
    const c = KM_CATS[s.cat] || KM_CATS.port;
    const open = _kmSpotOpen(s);
    const r = s.small ? 11 : 15;
    const fill = open ? c.color : "#5a6068";
    const sel = (_kmSelected === s.id) ? ' km-pin--sel' : '';
    pins +=
      `<g class="km-pin${sel}" data-spot="${s.id}" tabindex="0" role="button" aria-label="${s.name}">` +
        `<circle cx="${s.x}" cy="${s.y}" r="${r + 3}" fill="rgba(0,0,0,.28)"/>` +
        `<circle cx="${s.x}" cy="${s.y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="2.5"/>` +
        `<text x="${s.x}" y="${s.y + (s.small ? 4 : 5)}" text-anchor="middle" font-size="${s.small ? 13 : 17}">${open ? c.ic : "🔒"}</text>` +
      `</g>`;
  });
  wrap.innerHTML =
    `<svg class="km-map" viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="崑崙島の観光マップ">` +
      // 海
      `<rect x="0" y="0" width="1000" height="640" fill="#16323e"/>` +
      `<rect x="0" y="0" width="1000" height="640" fill="url(#kmSea)"/>` +
      `<defs>` +
        `<radialGradient id="kmSea" cx="50%" cy="42%" r="75%"><stop offset="0%" stop-color="#1b4250"/><stop offset="100%" stop-color="#122a34"/></radialGradient>` +
        `<radialGradient id="kmVolc" cx="50%" cy="30%" r="70%"><stop offset="0%" stop-color="#a65a40"/><stop offset="100%" stop-color="#6e4434"/></radialGradient>` +
      `</defs>` +
      // 島本体
      `<path d="M 170,250 C 170,150 310,92 490,92 C 690,92 880,150 886,300 C 892,432 762,560 500,566 C 286,566 156,470 168,360 C 171,330 170,300 170,250 Z" fill="#cdb87e" stroke="#8a7a52" stroke-width="3"/>` +
      // 緑（密林・内陸）
      `<path d="M 360,150 C 470,120 620,130 700,200 C 760,260 740,360 650,400 C 520,455 360,430 320,330 C 295,260 300,175 360,150 Z" fill="#7ba85a" opacity="0.85"/>` +
      // 南の砂浜帯
      `<path d="M 250,500 C 360,560 560,575 690,520 C 600,560 460,575 360,560 C 320,552 270,530 250,500 Z" fill="#e6d6a4" opacity="0.9"/>` +
      // 西の湾（ミストラ湾＝海色で切り欠き）
      `<ellipse cx="150" cy="338" rx="78" ry="66" fill="#163a47"/>` +
      `<ellipse cx="150" cy="338" rx="78" ry="66" fill="url(#kmSea)"/>` +
      // 中央火山 アレドラウ山
      `<path d="M 520,140 L 600,300 C 560,320 480,320 440,300 Z" fill="url(#kmVolc)" stroke="#5a3a2c" stroke-width="2"/>` +
      `<ellipse cx="520" cy="152" rx="26" ry="11" fill="#c0563a"/>` +
      `<ellipse cx="520" cy="150" rx="14" ry="6" fill="#e88a4a"/>` +
      // カルデラ湖 ダコン湖
      `<ellipse cx="556" cy="372" rx="48" ry="26" fill="#2f6a86" opacity="0.92"/>` +
      `<ellipse cx="556" cy="368" rx="30" ry="14" fill="#3f86a8" opacity="0.7"/>` +
      // 観光導線（霧待ち市場→大翼通り→レース場）
      `<path d="M 272,300 Q 360,288 468,276" fill="none" stroke="#ffe6a8" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.8"/>` +
      // 奥地＝薄い「？神秘の奥」（出しすぎない）
      `<text x="556" y="300" text-anchor="middle" font-size="15" fill="#cbb6d8" opacity="0.55">？ ダコン・ロンド聖域</text>` +
      `<text x="540" y="120" text-anchor="middle" font-size="12" fill="#9fb0b8" opacity="0.45">グワルガ北岸（通行なし）</text>` +
      pins +
    `</svg>`;
  app.appendChild(wrap);

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

  // ピンのクリック配線
  wrap.querySelectorAll("[data-spot]").forEach(g => {
    const act = () => { _kmSelected = g.getAttribute("data-spot"); _kmRenderPanel(); _kmMarkSel(wrap); };
    g.addEventListener("click", act);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
  });
  _kmRenderPanel();

  const actions = el("div", "actions");
  const back = el("button", null, "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}

function _kmMarkSel(wrap) {
  wrap.querySelectorAll(".km-pin").forEach(g => {
    g.classList.toggle("km-pin--sel", g.getAttribute("data-spot") === _kmSelected);
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
