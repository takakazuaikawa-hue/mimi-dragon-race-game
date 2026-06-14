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
  ["stranger", "ふふ。……薄い見込みで立つ子は、嫌いじゃない。次も、その薄さで立ってごらんなさい。きっと、見ていて飽きないわ。"],
  ["mimi", "あの……お名前を、聞いても？", "default"],
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
