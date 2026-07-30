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

// 正体判明前の仮の姿としてダイアログcast登録。
// ★専用絵(stranger.webp)が無ければ celestia をシルエット加工（.sil＝暗転フィルタ）で表示＝
//   「絵文字で出る」404バグの解消。同一人物のシルエットなので伏線としても正しい（正体は判別不能）。
(function registerStrangerCast() {
  if (typeof window !== "undefined" && window.Dialogue && Dialogue.registerCast) {
    Dialogue.registerCast("stranger", {
      name: "知らないお姉さん", color: "#7a6aa0", symbol: "🌌", side: "left",
      img: ["images/cast/stand/stranger.webp", { src: "images/cast/stand/celestia.webp", sil: true }]
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
// ★G7（NARRATIVE_DESIGN）：破産しない上手いプレイヤーにも伏線を届ける代替トリガー。
//   第4話既読 かつ 絶景（view）スポット初訪問の到着VN直後に、名乗らないまま現れる。
//   同じ celestiaStrangerSeen を立てる＝以後の再会・神眼コンサルト解放は無心ルートと合流。
const STRANGER_VISTA = [
  ["narrator", "展望の先で、風がふいに止む。……いつの間にか、星空みたいなドレスの女(ひと)が、隣で同じ景色を見ていた。"],
  ["stranger", "いい眺め。……ここから見ると、レース場の灯りって、星みたいでしょう。"],
  ["mimi", "わ……！　い、いつの間に……。ど、どちらさま、ですか？", "panic"],
  ["stranger", "ただの通りすがり。……ねえ。あの灯り、いつまで続くと思う？"],
  ["mimi", "え……？　ずっと、続いてほしいです。ごはんも、レースも、ぜんぶ。", "default"],
  ["stranger", "ふふ。そう答える子の顔を、見に来たの。——困ったら、わたしに聞いてごらんなさい。1着くらいなら、視(み)えてしまうの。"],
  ["mimi", "み、視える……？　あの、お名前を……", "default"],
  ["stranger", "いつか、ね。"]
];
function maybeStrangerVista() {
  if (typeof getStoryFlag !== "function" || typeof setStoryFlag !== "function") return false;
  if (getStoryFlag("celestiaStrangerSeen")) return false;              // 既出＝無心ルートで会っている
  if (!getStoryFlag("_chapter_intro_4")) return false;                 // 第4話既読から（終盤の伏線）
  if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
  let script = STRANGER_VISTA.slice();
  if (getStoryFlag("_chapter_intro_5")) script = script.map(ln => ln[0] === "stranger" ? ["celestia", ln[1], ln[2]] : ln);
  setStoryFlag("celestiaStrangerSeen", true);
  Dialogue.play(script, { force: true });
  return true;
}

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
// メーターは 0(=安全/単勝1.1倍) 〜 RANGE(=絶滅/単勝1.0倍)。★起動は“真ん中”(RANGE/2＝1.05倍)から。
// 淘汰(doom)が 1.0 側へ、4活動(push)が 1.1 側へ動かす綱引き。0で最終決戦、RANGEでソフト失敗。
const EP_CONST = {
  RANGE: 160,            // メーター幅（0=安全1.1倍 / RANGE=絶滅1.0倍＝ソフト失敗ライン）
  DOOM_PER_RACE: 3,      // レース確定ごとに絶滅(1.0)側へ
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
// ダイヤル：meter 0＝1.1倍(安全)、RANGE＝1.0倍(絶滅)。実オッズではない演出値。
function epilogueDial() { const e = epData(); const r = Math.max(0, Math.min(1, e.meter / EP_CONST.RANGE)); return (1.1 - 0.1 * r); }
function epilogueProgress() { const e = epData(); return Math.max(0, Math.min(100, Math.round((1 - e.meter / EP_CONST.RANGE) * 100))); } // 0..100（1.1倍＝安全への近さ）

// ===== 文字盤の演出ヘルパー（表示専用）=====
// ゾーン：safe(1.1寄り)/mid/doom(1.0寄り)。数値・枠・針の色分けに使う。
function epilogueZone() {
  const prog = epilogueProgress();
  if (prog >= 66) return "safe";
  if (prog <= 33) return "doom";
  return "mid";
}
// 反応方向：前回HUD表示時から、メーターが淘汰(1.0)側へ増えたら "doom"、安全(1.1)側へ減ったら "push"、不変は ""。
// ★HUD描画ごとに1回だけ呼ぶ（呼ぶたび基準を更新＝変化は次の描画で一度だけ演出）。保存しない＝リロードで初期化（演出のみ）。
let _epLastDialMeter = null;
function epilogueDialReaction() {
  const cur = epData().meter;
  let r = "";
  if (_epLastDialMeter !== null) { if (cur > _epLastDialMeter) r = "doom"; else if (cur < _epLastDialMeter) r = "push"; }
  _epLastDialMeter = cur;
  return r;
}

// =========================================================================
// 絶滅メーターの説明（HUDの「？」からいつでも／初表示時に一度だけ自動で開く）
// =========================================================================
// ★最後の段落で必ず「演出専用＝実レースの着順・オッズ・配当には一切影響しない」と明言する（[[race-math-immutable]]）。
function showEpilogueMeterHelp() {
  if (typeof showInfoPopup !== "function") return;
  showInfoPopup("☄️ 絶滅メーターって？",
    `<div class="mm-flow">▼ 1.0倍（淘汰）　…　1.05倍（いま）　…　1.1倍（安全）▲</div>` +
    `<div class="mm-row"><span class="mm-ic">🎯</span><div><b>これは「綱引き」です</b><small>終章のあいだ、淘汰（絶滅）の圧と、あなたの積み上げが綱を引き合います。メーターは<u>ちょうど真ん中＝単勝1.05倍</u>から始まります。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">☄️</span><div><b>淘汰（1.0倍へ）</b><small>レースを走るたび、淘汰の圧が少しずつ <u>1.0倍（絶滅）側</u> へ進みます。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">🛡️</span><div><b>押し戻し（1.1倍へ）</b><small>🌴スカウト・🏠暮らしの向上・🛍️お買い物・🏅的中——積み上げが <u>1.1倍（安全）側</u> へ押し返します。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">⚔️</span><div><b>1.1倍まで押し切ると最終決戦</b><small>安全（1.1倍）まで押し切れば、ホームに「最終決戦へ」が現れます。逆に1.0倍へ振り切れても<u>仕切り直すだけ（ゲームオーバーなし）</u>。</small></div></div>` +
    `<div class="mm-row"><span class="mm-ic">📌</span><div><b>これは演出メーターです</b><small>このゲージは物語の演出専用。<u>実際のレースの着順・オッズ・配当には一切影響しません</u>。安心して綱を引いてください。</small></div></div>`);
}
// 初めてメーターが表示された時に一度だけ自動で開く（"表示時にしっかり説明"）。既読＝storyFlag "epMeterHelpSeen"。
// VN（.dlg-overlay）や別ポップアップ（.navpop-ov）が出ている間は被せず、次回の表示時に回す。
function maybeShowMeterHelpFirstTime() {
  if (typeof getStoryFlag === "function" && getStoryFlag("epMeterHelpSeen")) return;
  if (typeof showInfoPopup !== "function" || typeof document === "undefined") return;
  if (document.querySelector(".navpop-ov")) return;                       // 別ポップアップが開いている
  if (document.querySelector(".dlg-overlay:not(.hidden)")) return;        // VN再生中
  if (typeof setStoryFlag === "function") setStoryFlag("epMeterHelpSeen", true);
  showEpilogueMeterHelp();
}

// 第5話再生で起動（renderStoryChapter("5") から）。★真ん中(RANGE/2＝1.05倍)スタート。
function epilogueStart() {
  const e = epData(); if (e.active) return;
  e.active = true; e.meter = Math.round(EP_CONST.RANGE / 2); epSave();
}
// レース確定ごとに絶滅(1.0)側へ（settleRace から。終章中のみ内部ガード）。
function doomTick() {
  if (!epiloguePushable()) return;
  const e = epData();
  e.meter = Math.min(EP_CONST.RANGE, e.meter + EP_CONST.DOOM_PER_RACE);
  if (e.meter >= EP_CONST.RANGE) onDoomReached();
  epSave();
}
// 4活動の成果が安全(1.1)側へ押し戻す（各フックから epPush("reason")）。
function epPush(reason) {
  if (!epiloguePushable()) return;
  const e = epData();
  e.meter -= (EP_CONST.PUSH[reason] || 0);
  // ★装束は最終決戦“解放より前”に渡す＝先に判定してから finalReady を見る（順序を入れ替えないこと）。
  if (e.meter > 0) maybeGrantDragonRobe();
  if (e.meter <= 0) { e.meter = 0; e.finalReady = true; onFinalReady(); }
  epSave();
}
// 5章 島づくり（island.js）：事業完成で任意量メーターを押し戻す。押し戻し受付中のみ有効。
function epPushAmount(n) {
  if (!epiloguePushable()) return 0;
  const e = epData();
  const before = e.meter;
  e.meter = Math.max(0, e.meter - (n || 0));
  if (e.meter > 0) maybeGrantDragonRobe();                 // ★装束は最終決戦の解放より前（epPushと同じ順序）
  if (e.meter <= 0) { e.meter = 0; e.finalReady = true; onFinalReady(); }
  epSave();
  return before - e.meter;   // 実際に退いた量
}
// ソフト失敗（絶滅に振り切れた）：詰まらせない。真ん中やや上へ戻して仕切り直し。
function onDoomReached() {
  const e = epData(); e.cycle += 1; e.meter = Math.round(EP_CONST.RANGE * 0.65);
  if (typeof showInfoPopup === "function") showInfoPopup("☄️ 淘汰は終わらない",
    `<div class="mm-row"><span class="mm-ic">🌌</span><div><b>「……まだ、終わらないわ」</b><small>淘汰の圧はぶり返した。それでも、灯りはまだ消えていない。押し戻し続けよう。</small></div></div>`);
}
// =========================================================================
// ⚔️ 竜帝の戴冠衣＝最終決戦の装束（ユーザー指定・2026-07-31）
// =========================================================================
// 「龍帝の衣装は最終イベント用の衣装だから、5章から最終決戦の前のどこかでイベントで手に入るように」。
// 以前は 8万コインでいつでも買える普段着だった（data_assets.js の acquire を epilogue へ変更済）。
// タイミング＝**綱引きを押し戻して安全ゾーンに入った瞬間**。第5話開始（真ん中＝mid）より後で、
// メーター0（＝最終決戦解放）より前に必ず挟まる＝「決戦の前に島から装束を託される」一幕になる。
// ★表示専用＝衣装は立ち絵が変わるだけ。着順・オッズ・配当には非干渉（[[race-math-immutable]]）。
const EP_ROBE_ID = "dragonrobe";
function _epRobeScript() {
  const s = [
    ["narrator", "その日、龍舎の戸を叩いたのは、村のみんなだった。両手に、大きな包み。"],
    ["villager", "ミミちゃん。……その、みんなで、少しずつ出し合ってな。"],
    ["villager", "祭りの旗を縫うばあさん、鱗細工の親父、宝玉磨きの職人——島じゅうから、一枚ずつ持ち寄ったんだ。"],
    ["mimi", "……これ、って……。", "default"],
    ["narrator", "包みをほどくと、聖龍の翼をかたどった一着——竜帝の戴冠衣。"]
  ];
  // ★門番（[[cast-appearance-gate]]）：スミカは出会っていれば一言添える。未登場なら村人だけで回す。
  try {
    if (typeof advisorMet === "function" && advisorMet("sumika"))
      s.push(["sumika", "採寸は済ませてあります。……ミミ様。これは贈り物ではありません。島からの、委任状です。"]);
  } catch (e) {}
  s.push(["villager", "あの星空みたいなドレスのお人に、この島は強いんだって、見せてやってくれ。"]);
  s.push(["mimi", "……はい。ぜったいに、見せてきます。", "happy"]);
  return s;
}
function _epRobeOwned() {
  try {
    const won = (state.player && state.player.outfitsWon) || [];
    return won.indexOf(EP_ROBE_ID) >= 0;
  } catch (e) { return false; }
}
// 安全ゾーンに入っていれば1回だけ授与。VN/ポップアップ中なら見送って次の機会に（重ねない）。
// 呼び元＝epPush / epPushAmount（押し戻した瞬間）と renderHome（見送られた分の拾い直し）。
function maybeGrantDragonRobe() {
  try {
    if (!epilogueOn()) return false;                                     // 終章中だけ
    if (typeof getStoryFlag !== "function" || getStoryFlag("dragonRobeGranted")) return false;
    if (epilogueZone() !== "safe") return false;                         // 押し戻して安全側に入ったら
    if (typeof document === "undefined") return false;
    if (document.querySelector(".navpop-ov")) return false;              // 別ポップアップが開いている
    if (document.querySelector(".dlg-overlay:not(.hidden)")) return false; // VN再生中
    if (!(typeof window !== "undefined" && window.Dialogue && Dialogue.play)) return false;
    setStoryFlag("dragonRobeGranted", true);
    Dialogue.play(_epRobeScript(), { force: true }).then(function () {
      if (!_epRobeOwned()) {
        state.player.outfitsWon = state.player.outfitsWon || [];
        state.player.outfitsWon.push(EP_ROBE_ID);
      }
      epSave();
      if (typeof showInfoPopup === "function") showInfoPopup("⚔️ 竜帝の戴冠衣を授かった",
        `<div class="mm-row"><span class="mm-ic">👗</span><div><b>竜帝の戴冠衣</b>` +
          `<small>聖龍の翼と宝玉をまとう、最上位の正装。島じゅうの職人が一枚ずつ持ち寄って仕立てた、決戦の装束。</small></div></div>` +
        `<div class="mm-row"><span class="mm-ic">🛍️</span><div><b>着替えはモールから</b><small>「特別」の棚に並びます。最後の一戦は、この一着で。</small></div></div>` +
        `<div class="mm-note">※ 衣装は立ち絵が変わるだけです。レースの着順・オッズ・配当は変わりません（表示専用）。</div>`);
      if (typeof renderHome === "function") renderHome();
    });
    return true;
  } catch (e) { return false; }
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

// 最終決戦（Stage2＝積み上げ紹介の演出レース）：前口上 → 走馬灯ショー（積み上げ紹介）→ 最後のレース＋締め
//   → 終章クリア(edFlag) → 既存エンディング。すべて表示専用＝着順/オッズ/配当は不変（普通のレースを
//   演出で祝祭化するだけ・docs/epilogue_extinction_design.md §6）。読むデータは総資産/ランク/完走/図鑑/
//   スカウト/衣装/ポロ/村＝既存のものを参照するだけ（変更しない）。
function finalShowcaseBeats() {
  const p = state.player || {};
  if (typeof recomputeAssets === "function") { try { recomputeAssets(state); } catch (e) {} }
  const fc = (typeof fmtCoins === "function") ? fmtCoins : function (n) { return String(n); };
  const beats = [];
  beats.push({ ic: "🏦", k: "築いた暮らし", v: fc(p.totalAssets || 0), c: "ゼロから、ここまで立て直してきた。" });
  beats.push({ ic: "🏅", k: "駆け抜けた軌跡", v: "ランク" + (p.rank || 1) + "・" + (p.completedRaces || 0) + "走", c: (p.wins || 0) + "勝。負けても、また立った。" });
  // ★P10ハルウララ原則＝固有名詞で振り返る（既存台帳を読むだけ・数値不変）。
  if ((p.biggestPayout || 0) > 0) beats.push({ ic: "💥", k: "忘れない一撃", v: fc(p.biggestPayout) + " コイン", c: "あの日の払戻。手が、震えた。" });
  const dex = (typeof collectionSeenCount === "function") ? collectionSeenCount() : 0;
  if (dex > 0) beats.push({ ic: "📖", k: "出会った竜たち", v: dex + "頭を図鑑に", c: "どの子にも、ちゃんと物語があった。" });
  const roster = (typeof scoutedRoster === "function") ? scoutedRoster() : [];
  if (roster.length > 0) {
    const names = roster.slice(0, 3).map(function (d) { return d.name; }).join("・");
    beats.push({ ic: "🐲", k: "心を通わせた竜", v: (roster.length >= 8) ? "八竜、集結" : roster.length + "頭が龍舎に",
      c: names + (roster.length > 3 ? "……ほか" + (roster.length - 3) + "頭。" : "。") + "強さじゃなく、好きで選んだ。" });
  }
  let mealsGot = 0, mealName = "";
  try {
    if (typeof MEALS !== "undefined" && typeof mealEaten === "function") {
      for (let i = 0; i < MEALS.length; i++) if (mealEaten(MEALS[i].id)) { mealsGot++; mealName = MEALS[i].name; }
    }
  } catch (e) {}
  if (mealsGot > 0) beats.push({ ic: "🍜", k: "食べ歩いた味", v: mealsGot + " 品", c: (mealName ? "「" + mealName + "」も——" : "") + "ぜんぶ、おいしかった。" });
  const fol = (typeof goalFollowers === "function") ? goalFollowers() : 0;
  if (fol > 0) beats.push({ ic: "💗", k: "見てくれた人", v: fol.toLocaleString() + " 人", c: "無一文のうさぎを、ここまで連れてきてくれた。" });
  const outfits = (p.outfitsBought || []).length;
  if (outfits > 0) beats.push({ ic: "👗", k: "着てきた晴れ着", v: outfits + "着", c: "今日も、いちばんの一着で。" });
  if (typeof poroFound === "function" && poroFound()) beats.push({ ic: "🐉", k: "いちばんの相棒", v: "ポロ", c: "特別じゃなくても、愛されていい。" });
  const vlv = p.villageLevel || (p.village && p.village.level) || 1;
  beats.push({ ic: "🏘️", k: "灯りを守った島", v: "村レベル " + vlv, c: "この賭場の灯りは、消えなかった。" });
  return beats;
}
// 走馬灯ショー（全画面・自動送り＋タップで先へ）。完了で resolve（→ 締めのVN）。表示専用。
// タイマーはモジュール変数＝外から凍結/掃除できる（神眼カットイン _sgCutinTimer と同流儀）。
let _finShowTimer = null;
function playFinalShowcase() {
  return new Promise(function (resolve) {
    if (!(typeof el === "function" && typeof document !== "undefined")) { resolve(); return; }
    var ex = document.getElementById("fin-show"); if (ex) ex.remove();
    if (_finShowTimer) { clearTimeout(_finShowTimer); _finShowTimer = null; }
    var beats = finalShowcaseBeats();
    beats.push({ ic: "☄️", k: "そして、最後のレース", v: "全員が、沸いた", c: "単勝の正解は動かない。それでも複で、ワイドで、穴で——みんな、まだ笑っていた。", finale: true });
    var ov = el("div", "fin-show"); ov.id = "fin-show";
    ov.innerHTML = '<div class="fin-rays"></div><div class="fin-card"></div>' +
      '<div class="fin-dots">' + beats.map(function () { return "<i></i>"; }).join("") + '</div>' +
      '<div class="fin-skip">タップで進む ▶</div>';
    document.body.appendChild(ov);
    var card = ov.querySelector(".fin-card");
    var dots = ov.querySelector(".fin-dots").children;
    var i = -1;
    function show(b) {
      card.className = "fin-card" + (b.finale ? " finale" : "");
      card.innerHTML = '<div class="fin-ic">' + b.ic + '</div><div class="fin-k">' + b.k + '</div>' +
        '<div class="fin-v">' + b.v + '</div><div class="fin-c">' + b.c + '</div>';
      void card.offsetWidth; card.classList.add("in");
      for (var d = 0; d < dots.length; d++) dots[d].className = (d <= i) ? "on" : "";
    }
    function done() {
      if (_finShowTimer) { clearTimeout(_finShowTimer); _finShowTimer = null; }
      ov.classList.add("out");
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); resolve(); }, 440);
    }
    function next() {
      i++;
      if (i >= beats.length) { done(); return; }
      show(beats[i]);
      if (_finShowTimer) clearTimeout(_finShowTimer);
      _finShowTimer = setTimeout(next, beats[i].finale ? 2800 : 1750);
    }
    ov.onclick = function () { next(); };
    try { if (window.Sfx) Sfx.play("legendary"); } catch (e) {}
    next();
  });
}
// 八竜見参カットイン（NARRATIVE_DESIGN §6-4）。スカウト済みロスターの実スプライト
// (images/dragons/<id>.png) を名前つきで整列させる全画面演出。0頭なら即resolve＝fail-closed、
// 1〜7頭でも「盟友見参」で破綻しない可変長。表示専用＝走るレースには一切触れない。
// スプライトの透過版dataURLを取得。生PNGはグレー無地背景つき＝race_canvasのキー抜きキャッシュ
// （_rcDragonSprite: flood-fillで背景透過＋被写体bbox）をそのまま再利用する（二重実装しない）。
// 未ロード中は null（呼び出し側がポーリング）。race_canvas不在でも安全に null。
function _ecSpriteURL(id) {
  try {
    if (typeof _rcDragonSprite !== "function") return null;
    const e = _rcDragonSprite(id);
    if (!e || !e.ok || e.bad) return null;
    const src = e.cv || e.img;
    const b = e.box || { x: 0, y: 0, w: src.width, h: src.height };
    const c = document.createElement("canvas"); c.width = b.w; c.height = b.h;
    c.getContext("2d").drawImage(src, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return c.toDataURL();
  } catch (err) { return null; }
}
function playEightDragonsCutin() {
  return new Promise(function (resolve) {
    const roster = (typeof scoutedRoster === "function") ? scoutedRoster().slice(0, 8) : [];
    if (!roster.length || !(typeof el === "function" && typeof document !== "undefined")) { resolve(); return; }
    var ex = document.getElementById("eight-cutin"); if (ex) ex.remove();
    const full = roster.length >= 8;
    var ov = el("div", "eight-cutin"); ov.id = "eight-cutin";
    ov.innerHTML = '<div class="ec-flash"></div>' +
      '<div class="ec-title">' + (full ? "八竜見参" : "盟友見参") + '</div>' +
      '<div class="ec-sub">' + (full ? "ミミが心を通わせた八頭、ゲート前にそろい踏み" : "ミミが心を通わせた竜たちが、ゲート前に並ぶ") + '</div>' +
      '<div class="ec-row">' + roster.map(function (d, i) {
        var c = (typeof dragonColor === "function") ? dragonColor(d) : "#888";
        return '<figure class="ec-d" style="--i:' + i + ';--c:' + c + '">' +
          '<img alt="" style="visibility:hidden">' +
          '<figcaption>' + d.name + '</figcaption></figure>';
      }).join("") + '</div>' +
      '<div class="fin-skip">タップで進む ▶</div>';
    document.body.appendChild(ov);
    // キー抜き済みスプライトを流し込む（ロード待ちはポーリング・間に合わない竜は名前プレートのみ）。
    roster.forEach(function (d) { try { if (typeof _rcDragonSprite === "function") _rcDragonSprite(d.id); } catch (e2) {} });
    var figs = ov.querySelectorAll(".ec-d img");
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      var pending = 0;
      for (var i = 0; i < figs.length; i++) {
        if (figs[i].dataset.done) continue;
        var u = _ecSpriteURL(roster[i].id);
        if (u) { figs[i].src = u; figs[i].style.visibility = "visible"; figs[i].dataset.done = "1"; }
        else pending++;
      }
      if (!pending || tries > 25) { clearInterval(poll); poll = null; }
    }, 120);
    try { if (window.Sfx) Sfx.play("legendary"); } catch (e2) {}
    var t = setTimeout(done, 1200 + roster.length * 240 + 2400);
    function done() {
      if (t) { clearTimeout(t); t = null; }
      if (poll) { clearInterval(poll); poll = null; }
      ov.classList.add("out");
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); resolve(); }, 440);
    }
    ov.onclick = done;
  });
}
function startFinalBattle() {
  const e = epData();
  if (e.edFlag) { if (window.Ending && Ending.play) Ending.play(); return; }
  // ① 専用BGM：絶滅のファンファーレ。現在のミュート設定を尊重（音オンなら鳴る）。
  //   エンディング側 confirmAudio→playFile(森のくまさん) が stop() するので、ED開始で自動的に切替わる。
  if (window.RaceBgm && RaceBgm.playFile) { try { RaceBgm.playFile("bgm/絶滅のファンファーレ.mp3"); } catch (e2) {} }
  const who = "celestia";   // 第5話到達済み＝正体判明
  const preamble = [
    ["narrator", "夜明け前の聖龍レース場。最後のレースを前に、歓声がふくらんでいく。"],
    [who, "ねえ、ミミ。……ここまで歩いてきた道を、少しだけ振り返ってみない？", "default"],
    ["mimi", "はいっ。……わたしたちが積み上げてきた、ぜんぶを。", "happy"]
  ];
  // ② 最終レース＝立ち絵連発 → 締め。予想は覆らない／それでも全員が沸く。
  // ★脱カーテンコール（NARRATIVE_DESIGN §6-7・D13/D14解消）：顧問はテーマの要約を読まず、
  //   各人が“プレイヤーの実績”をひとつずつ拾う。数字は既存台帳を読むだけ（数値不変）。
  const p2 = state.player || {};
  const fc2 = (typeof fmtCoins === "function") ? fmtCoins : function (n) { return String(n); };
  const roster = (typeof scoutedRoster === "function") ? scoutedRoster() : [];
  const fol = (typeof goalFollowers === "function") ? goalFollowers() : 0;
  const vlv2 = p2.villageLevel || (p2.village && p2.village.level) || 1;
  const broke = p2.brokeCount || 0;
  const closing = [
    ["narrator", "高らかにファンファーレ。最終レース――島じゅうの視線が、ゲートに集まる。"],
    ["makura", "同時視聴" + fol.toLocaleString() + "人！　島の全員が見てるぞ、実況はこのマクラ！　……ミミ、今日はあんたの配信だ。胸張ってけ！"],
    roster.length
      ? ["sake", "ゲート脇を見ろ。お前が口説き落とした" + (roster.length >= 8 ? "八頭" : roster.length + "頭") + "が、そろって首を伸ばしてやがる。……いい面構えになった。竜も、お前もだ。"]
      : ["sake", "ゲートの竜たちを見ろ。今日は全頭、いい面構えだ。……お前が育てた賭場だからな。"],
    (p2.biggestPayout || 0) > 0
      ? ["mizu", "あなたの最高払戻、" + fc2(p2.biggestPayout) + "コイン。……あの日の伝票、額に入れて飾りたいくらいよ、あはん。"]
      : ["mizu", "堅くても細くても、あなたは張り続けた。……市場はね、続けた人を覚えているのよ、あはん。"],
    ["sumika", "村は、レベル" + vlv2 + "になりました。ミミ様が食べて、住んで、賭けたお金が——ぜんぶ、この灯りになっています。"],
    [who, (broke > 0
      ? "あなたが空っぽから立ち上がった回数、" + broke + "回。ぜんぶ視ていたわ。……1着を当てるより、よほど奇跡よ。"
      : "あなたは一度も、この島を嫌いにならなかった。……ぜんぶ、視ていたわ。"), "default"],
    [who, "……視えている。1着は、動かない。わたしの神眼の、とおりに。", "default"],
    ["narrator", "ゲートが開く。先頭は、セレスティアの読みどおりの一頭。だが――"],
    ["mizu", "見て。単勝はたった1点に潰れても……複勝が、ワイドが、割れて咲いてる。願いの乗った値よ。"],
    ["makura", "2着に伏兵ッ！　3着はなんと万年最下位ァ！　当たり札も、外れ札も、総立ちだァ――！"],
    ["mimi", "……みんな、笑ってる。勝っても、負けても。", "happy"],
    [who, "驚いた。淘汰の前で、ここまで“穴”を残す島は、そうないわ。", "default"],
    ["mimi", "わたし、強い竜を当てたわけじゃないです。……ただ、みんなが、いろんな子を好きでいただけ。", "default"],
    [who, "そう。価値は、1着の上にだけあるんじゃない。──いい賭場。この賭場、壊れなかったね。"],
    ["mimi", "はいっ。……また、見に来てください。", "happy"]
  ];
  const toEnding = function () {
    epilogueClear();
    // ※「終章クリア」告知はエンディング側（confirmAudio→送り出し→ロール）が担うので二重モーダルにしない。
    if (window.Ending && Ending.play) Ending.play();
  };
  const afterShow = function () {
    const playClosing = function () {
      if (window.Dialogue && Dialogue.play) Dialogue.play(closing, { force: true }).then(toEnding);
      else toEnding();
    };
    // 走馬灯のあと、締めVNの前に——集めた竜たちが実スプライトで見参（0頭ならスキップ）。
    if (typeof playEightDragonsCutin === "function") playEightDragonsCutin().then(playClosing);
    else playClosing();
  };
  const runShow = function () {
    if (typeof playFinalShowcase === "function") playFinalShowcase().then(afterShow);
    else afterShow();
  };
  if (window.Dialogue && Dialogue.play) Dialogue.play(preamble, { force: true }).then(runShow);
  else runShow();
}
