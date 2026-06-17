// =========================================================================
// nav.js — 画面レジストリ＋集中ナビ＋直接ジャンプ（開発・プレビュー高速化）。
// =========================================================================
// 目的：散らばっていた renderX() 呼び出しを“画面名→描画関数”の1枚マップに集約し、
//   ① goto(name)        … どの画面へも1関数でジャンプ（ナビ/再描画の単一経路）
//   ② rerenderCurrent() … 現在画面を再描画（main.js のローカル版を置換・全画面網羅）
//   ③ ?go=<screen>      … URLで任意画面へ直接起動（プレビュー検証が激速に。?debug=1も）
//   ④ SCREEN_INDEX      … 画面の一覧（番号つき）。設定デバッグの「画面ジャンプ」やコードマップの単一情報源。
// ★描画関数は呼び出し時(typeof guard)に解決＝読み込み順に依存しない。ロジックは一切変えない（routing集約のみ）。
// 関連：docs/CODEMAP.md（全体地図）。新画面を足したら SCREEN_INDEX に1行足すだけ。
// =========================================================================

// 画面の一覧（番号・名前・ラベル・分類）。★ここが画面の単一情報源。
var SCREEN_INDEX = [
  { no: 1,  id: "title",           label: "タイトル",          group: "起動" },
  { no: 2,  id: "home",            label: "ホーム(配信)",       group: "拠点" },
  { no: 3,  id: "race_select",     label: "レース選択",         group: "レース" },
  { no: 4,  id: "race_detail",     label: "レース詳細/賭け",     group: "レース" },
  { no: 5,  id: "race_run",        label: "レース実況",         group: "レース" },
  { no: 6,  id: "result",          label: "結果",              group: "レース" },
  { no: 7,  id: "analysis",        label: "分析",              group: "レース" },
  { no: 8,  id: "assets",          label: "暮らしと資産",       group: "暮らし" },
  { no: 9,  id: "life_tree",       label: "くらしツリー",       group: "暮らし" },
  { no: 10, id: "life_collection", label: "暮らしコレクション",  group: "暮らし" },
  { no: 11, id: "active_skills",   label: "習い事",            group: "暮らし" },
  { no: 12, id: "meals",           label: "食事(みみしんぼ)",    group: "暮らし" },
  { no: 13, id: "mall",            label: "モール(着替え)",      group: "モール" },
  { no: 14, id: "mall_rpg",        label: "お買い物ダンジョン",  group: "モール" },
  { no: 15, id: "village",         label: "村",               group: "拠点" },
  { no: 16, id: "collection",      label: "図鑑",              group: "竜" },
  { no: 17, id: "stable",          label: "龍舎",              group: "竜" },
  { no: 18, id: "scout",           label: "竜スカウト",         group: "竜" },
  { no: 19, id: "poro_gourmet",    label: "ポロのグルメレース",  group: "竜" },
  { no: 20, id: "story",           label: "物語(一覧)",         group: "物語" },
  { no: 21, id: "story_read",      label: "物語(各話)",         group: "物語" },
  { no: 22, id: "consult",         label: "相談(顧問)",         group: "物語" },
  { no: 23, id: "goals",           label: "目標(クエスト)",      group: "拠点" },
  { no: 24, id: "help",            label: "予想入門",          group: "情報" },
  { no: 25, id: "settings",        label: "設定",              group: "情報" },
  { no: 26, id: "sns",             label: "SNS(TL/手紙)",       group: "SNS" },
  { no: 27, id: "economy",         label: "島の経済",           group: "暮らし" },
  { no: 28, id: "collection_score", label: "コレクション(やり込み)", group: "暮らし" }
];

// 画面名 → 描画を呼ぶ thunk。呼び出し時に解決（全描画関数が定義済みの状態で動く）。
// レース系は state.current が無い時はレース選択へフォールバック（直接ジャンプでも壊れない）。
function screenMap() {
  var hasRace = !!(typeof state !== "undefined" && state.current && state.current.race);
  function opt(fn, fb) { return (typeof window[fn] === "function") ? window[fn] : (window[fb] || renderHome); }
  return {
    title:           function () { renderTitle(); },
    home:            function () { renderHome(); },
    race_select:     function () { renderRaceSelect(); },
    race_detail:     function () { hasRace ? renderRaceDetail(state.current.race) : renderRaceSelect(); },
    race_run:        function () { hasRace ? renderRaceRun() : renderRaceSelect(); },
    result:          function () { hasRace ? renderResult() : renderRaceSelect(); },
    analysis:        function () { hasRace ? renderAnalysis() : renderRaceSelect(); },
    assets:          function () { renderAssets(); },
    economy:         function () { opt("renderEconomy", "renderAssets")(); },
    collection_score: function () { opt("renderCollectionScore", "renderAssets")(); },
    life_tree:       function () { opt("renderLifeTree", "renderAssets")(); },
    life_collection: function () { opt("renderLifeCollection", "renderAssets")(); },
    active_skills:   function () { opt("renderActiveSkills", "renderAssets")(); },
    meals:           function () { opt("renderMeals", "renderHome")(); },
    mall:            function () { renderMall(); },
    mall_rpg:        function () { opt("renderMallRpg", "renderMall")(); },
    village:         function () { renderVillage(); },
    collection:      function () { renderCollection(); },
    stable:          function () { opt("renderStable", "renderHome")(); },
    scout:           function () { opt("renderScout", "renderHome")(); },
    poro_gourmet:    function () { opt("renderPoroGourmet", "renderHome")(); },
    story:           function () { renderStory(); },
    story_read:      function () { renderStory(); },   // 各話は章指定が要る＝既定は物語一覧へ
    consult:         function () { renderConsult(); },
    goals:           function () { opt("renderGoals", "renderHome")(); },
    help:            function () { renderHelp(); },
    settings:        function () { renderSettings(); },
    sns:             function () { opt("renderSns", "renderHome")(); },
    timeline:        function () { opt("renderSns", "renderHome")("timeline"); },     // 後方互換（旧?go=）
    fanletters:      function () { opt("renderSns", "renderHome")("fanletters"); }
  };
}

// どの画面へもジャンプ（単一経路）。成功で true。
function goto(name) {
  var m = screenMap();
  if (m[name]) { try { m[name](); return true; } catch (e) { try { console.warn("goto failed:", name, e); } catch (_) {} } }
  return false;
}
// 現在画面を再描画（イベント反映用。main.js のローカル版を置換）。
function rerenderCurrent() { return goto((typeof state !== "undefined" && state.ui && state.ui.screen) || "home"); }

// URLで起動時に直接ジャンプ：?go=<screen>（&debug=1 でデバッグON）。開発・プレビュー高速化用。
// 例: index.html?go=meals / ?go=settings&debug=1
function applyStartupRoute() {
  try {
    var p = new URLSearchParams(location.search);
    if (p.get("debug") === "1" && state.ui) state.ui.debug = true;
    var go = p.get("go");
    if (go && screenMap()[go]) return goto(go);
  } catch (e) {}
  return false;
}

if (typeof window !== "undefined") {
  window.goto = goto; window.rerenderCurrent = rerenderCurrent;
  window.screenMap = screenMap; window.SCREEN_INDEX = SCREEN_INDEX; window.applyStartupRoute = applyStartupRoute;
}
