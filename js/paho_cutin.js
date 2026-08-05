// =============================================================================
// paho_cutin.js — ✨《ぱほぱほ》のカットイン（2026-08-05）
// =============================================================================
// ★完全に表示専用。ダメージ・信頼・成立判定・報酬には一切さわらない。
//
// ■ 素材
//   images/cast/mimi/mimi_paho_sprite.webp ＝ 1コマ 260x466 を横に8枚並べたシート。
//   もとは Higgsfield で作った5秒の動画。そのまま置くと3.2MBあるので、コマを抜いて
//   スプライトにした（108KB）。既にこのコードベースで使っている観客アニメと同じ方式。
//   最後のコマが「目を開いてこちらを見る」＝止め絵として一番いい所で終わる並びにしてある。
//
// ■ 置き場所（どちらも“今”到達できることを確認済み）
//   A モールRPGの必殺技「スーパーぱほぱほ」  … rpgUltimate()（SPゲージ100で出るボタン）
//   B しのびあしの成立                        … _stalkWin()（話しかけ3択の正解）
//   ※ 旧スカウト交渉（ui_scout.js の _scoutAct）にも一度入れたが、しのびあしの全ロケ展開で
//     到達不能になっていたため撤去した。ここへ足すときは必ず「その画面に行けるか」を先に確かめる。
// =============================================================================

var PAHO_FRAMES = 8;

// opts: { word: 見出し文字, ms: 表示時間, loop: くり返すか }
function pahoCutin(opts) {
  try {
    opts = opts || {};
    var ms = opts.ms || 1500;
    document.getElementById("paho-cut") && document.getElementById("paho-cut").remove();

    var ov = document.createElement("div");
    ov.className = "paho-cut" + (opts.loop ? " loop" : "");
    ov.id = "paho-cut";
    ov.innerHTML =
      '<div class="paho-cut-fig" aria-hidden="true"></div>' +
      (opts.word ? '<div class="paho-cut-word">' + opts.word + "</div>" : "");

    var kill = function () { try { ov.remove(); } catch (e) {} };
    ov.addEventListener("click", kill);          // タップで即スキップ
    document.body.appendChild(ov);
    setTimeout(kill, ms);
  } catch (e) { /* 演出が出なくても本編は進む */ }
}

if (typeof window !== "undefined") window.pahoCutin = pahoCutin;
