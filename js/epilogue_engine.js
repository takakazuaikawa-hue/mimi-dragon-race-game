// =========================================================================
// epilogue_engine.js — 終章（第5話セレスティア〜エンディング）の心臓
// =========================================================================
// 設計：docs/epilogue_extinction_design.md ／ 思想の背骨：docs/PARIMUTUEL_ORACLE_VS_HOUSE.md
// ★すべて表示メタ。着順・オッズ・配当（race/odds/betting）には一切非干渉（[[race-math-immutable]]）。
//
// Phase①（本ファイル初版）＝伏線：0円落ち込み（無心）が3回を超えると、星空ドレスの
//   「知らないお姉さん」（＝正体セレスティア・ブラックメテオ）が名乗らず現れる。
//   救済額（calculateRescueCoins）や計算には一切触れない。演出（立ち絵セリフ）を重ねるだけ。
// 後続フェーズ＝絶滅メーター綱引き（doom/push/net）・最終バトルレース・EDゲート差し替えは
//   ここに追記していく（定数表＋関数を集約する想定）。
// =========================================================================

// 正体判明前の仮の姿としてダイアログcast登録（後ろ姿シルエット。アート未配置時は絵文字🌌へ自動FB）。
(function registerStrangerCast() {
  if (typeof window !== "undefined" && window.Dialogue && Dialogue.registerCast) {
    Dialogue.registerCast("stranger", {
      name: "知らないお姉さん", color: "#7a6aa0", symbol: "🌌", side: "left",
      img: "images/cast/stand/stranger.webp"
    });
  }
})();

// 初対面（4回目の破産）。名乗らず、淘汰の気配だけを匂わせる伏線。声＝穏やかで掴みどころがない。
const STRANGER_FIRST = [
  ["narrator", "村のみんなの手のぬくもりが、まだ指に残っている。……ふと顔を上げると、星空みたいなドレスの女(ひと)が、いつの間にか隣に立っていた。"],
  ["stranger", "あら。……また、ぜんぶ無くしたの？"],
  ["mimi", "うぅ……はい。お恥ずかしながら、すっからかんです……。ど、どちらさま、ですか？", "panic"],
  ["stranger", "ただの通りすがり。……でも、不思議な子ね。ふつう、ここまで負けの込んだ子は、とっくにこの島から“消えて”いるものなのに。"],
  ["mimi", "消えて……？", "default"],
  ["stranger", "なのに、あなたはまた立つ。勝てる見込みなんて、もうずいぶん薄いでしょうに。──なぜ？"],
  ["mimi", "……明日のご飯代が、要るので。あと、このレース場の灯りが消えたら、きっと寂しいから。", "default"],
  ["stranger", "ふふ。……薄い見込みで立つ子は、嫌いじゃない。──ねえ、困ったら、わたしに聞いてごらんなさい。1着くらいなら、視(み)えてしまうの。ぜんぶ無くしてしまう前に、ね。"],
  ["mimi", "み、視える……？ あの、お名前を……", "default"],
  ["stranger", "いつか、ね。"]
];
// 再会（5回目以降）。短く。
const STRANGER_AGAIN = [
  ["stranger", "また会ったわね。……まだ、消えないのね。"],
  ["mimi", "うぅ、またゼロからです……でも、やめませんっ！", "default"],
  ["stranger", "ふふ。その薄い見込み、わたしは好きよ。"]
];

// 破産(無心)が3回を“超えた”ら登場。runMushin→finishMushin の「立て直す」後に呼ぶ。
// 戻り値 true ＝ VNを再生した（呼び出し側は renderHome を二重にしない）。
function maybeStrangerCameo() {
  if (((state.player && state.player.brokeCount) || 0) <= 3) return false;
  if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
  const first = !(typeof getStoryFlag === "function" && getStoryFlag("celestiaStrangerSeen"));
  // 第5話を読んで正体判明済みなら、本人（セレスティア）として出す。
  const revealed = typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_5");
  let script = (first ? STRANGER_FIRST : STRANGER_AGAIN).slice();
  if (revealed) script = script.map(ln => ln[0] === "stranger" ? ["celestia", ln[1], ln[2]] : ln);
  if (first && typeof setStoryFlag === "function") setStoryFlag("celestiaStrangerSeen", true);
  Dialogue.play(script, { force: true }).then(function () { if (typeof renderHome === "function") renderHome(); });
  return true;
}

// =========================================================================
// 終章＝絶滅メーターの綱引き（第5話セレスティアの神眼で起動）
// =========================================================================
// 仕様（docs/epilogue_extinction_design.md §4-6）：第5話再生で起動。レース確定ごとに
//   絶滅メーターが上昇（doom）。🌴スカウト/🏠暮らし向上/🛍️買い物/🏅評判 が押し戻す（push）。
//   メーターを0まで押し切ると「最終バトルレース」解放→完走でED。失敗してもソフト（仕切り直し）。
// ★メーターは“演出専用の別ゲージ”。実レースのオッズ・配当・着順には一切触れない（[[race-math-immutable]]）。
//   表示は「答えの竜の単勝が 1.1倍 → 1.0倍 へ近づく」体（実オッズではない）。
const EP_CONST = {
  START: 120,            // 第5話起動時のメーター初期値（淘汰の圧）
  MAX: 260,              // これを超えるとソフト失敗（仕切り直し・ゲームオーバーにしない）
  DOOM_PER_RACE: 3,      // レース確定ごとの上昇
  PUSH: { scoutNew: 22, assetLevel: 16, mallBuy: 6, hit: 6, win: 11 }   // 押し戻し配点（要バランス）
};
function epData() {
  const p = state.player;
  if (!p.epilogue) p.epilogue = { active: false, meter: 0, finalReady: false, edFlag: false, cycle: 0 };
  return p.epilogue;
}
function epSave() { if (typeof saveGame === "function") saveGame(); }
function epilogueOn() { const e = epData(); return e.active && !e.edFlag; }                 // 終章中（HUD表示など）
function epiloguePushable() { const e = epData(); return e.active && !e.edFlag && !e.finalReady; } // 押し戻し受付中
// メーターのダイヤル表示：満（START）＝1.0倍(絶滅)、0＝1.1倍(安全)。実オッズではない演出値。
function epilogueDial() { const e = epData(); const r = Math.max(0, Math.min(1, e.meter / EP_CONST.START)); return (1.1 - 0.1 * r); }
function epilogueProgress() { const e = epData(); return Math.max(0, Math.min(100, Math.round((1 - e.meter / EP_CONST.START) * 100))); } // 0..100（押し戻し率）

// 第5話再生で起動（renderStoryChapter("5") から呼ぶ）。
function epilogueStart() {
  const e = epData(); if (e.active) return;
  e.active = true; e.meter = EP_CONST.START; epSave();
}
// レース確定ごとに上昇（settleRace から呼ぶ。終章中のみ内部ガード）。
function doomTick() {
  if (!epiloguePushable()) return;
  const e = epData();
  e.meter = Math.min(EP_CONST.MAX, e.meter + EP_CONST.DOOM_PER_RACE);
  if (e.meter >= EP_CONST.MAX) onDoomReached();
  epSave();
}
// 4活動の成果が押し戻す（各フックから epPush("reason") で呼ぶ）。
function epPush(reason) {
  if (!epiloguePushable()) return;
  const e = epData();
  e.meter -= (EP_CONST.PUSH[reason] || 0);
  if (e.meter <= 0) { e.meter = 0; e.finalReady = true; onFinalReady(); }
  epSave();
}
// ソフト失敗：詰まらせない。少し戻して仕切り直し（押し戻しの積み上げは活きる）。
function onDoomReached() {
  const e = epData(); e.cycle += 1; e.meter = Math.floor(EP_CONST.START * 0.85);
  if (typeof showInfoPopup === "function") showInfoPopup("☄️ 淘汰は終わらない",
    `<div class="mm-row"><span class="mm-ic">🌌</span><div><b>「……まだ、終わらないわ」</b><small>淘汰の圧はぶり返した。それでも、灯りはまだ消えていない。押し戻し続けよう。</small></div></div>`);
}
// メーターを0に押し切った＝最終決戦解放。
function onFinalReady() {
  if (typeof showInfoPopup === "function") showInfoPopup("⚔️ 最終決戦",
    `<div class="mm-row"><span class="mm-ic">☄️</span><div><b>淘汰を、押し返した</b><small>島の灯りは消えなかった。あとは——最後の一戦だけ。ホームから挑もう。</small></div></div>`);
}
// 最終バトルレース完走＝終章クリア→ED解放。
function epilogueClear() {
  const e = epData(); if (e.edFlag) return; e.edFlag = true; epSave();
}

// 最終決戦（Phase②骨）：押し切った後の締めの会話 → 終章クリア(edFlag) → 既存エンディング。
// ※Stage2で「これまで積み上げた全部を紹介する演出レース」に拡張予定（着順/オッズ/配当は不変のまま祝祭化）。
function startFinalBattle() {
  const e = epData();
  if (e.edFlag) { if (window.Ending && Ending.play) Ending.play(); return; }
  const reveal = typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_5");   // 第5話既読＝正体判明
  const who = reveal ? "celestia" : "celestia";  // この時点では第5話到達済みのため常にセレスティア
  const script = [
    ["narrator", "夜明け前の聖龍レース場。歓声が、もう一度だけ爆発する。"],
    [who, "……驚いた。淘汰の前で、ここまで“穴”を残す島は、そうないわ。", "default"],
    ["mimi", "わたし、強い竜を当てたわけじゃないです。……ただ、みんなが、いろんな子を好きでいただけ。", "default"],
    [who, "そう。価値は、1着の上にだけあるんじゃない。──いい賭場。この賭場、壊れなかったね。"],
    ["mimi", "はいっ。……また、見に来てください。", "happy"]
  ];
  const go = function () {
    epilogueClear();
    if (typeof showInfoPopup === "function") showInfoPopup("🎬 終章クリア",
      `<div class="mm-row"><span class="mm-ic">✨</span><div><b>この賭場、壊れなかったね</b><small>エンディングが解放されました。物語の最終話、または設定のおまけからどうぞ。</small></div></div>`);
    if (window.Ending && Ending.play) Ending.play();
  };
  if (window.Dialogue && Dialogue.play) Dialogue.play(script, { force: true }).then(go);
  else go();
}
