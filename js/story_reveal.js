// =============================================================================
// story_reveal.js — 物語の本文を「読ませる」ために、ゆっくり出す
// =============================================================================
// ★なぜ要るか
//   ユーザー指摘：「読んでも大したことがない文章がありすぎて読む気が失せる。
//   …文章を読ませたい場面なら、スキップできないようにゆっくり文字表示するとか、
//   しっかりやってください」
//
//   物語の本文は400〜688字ある。これを一度に壁で出すと、量に負けて
//   読まずに閉じられる。逆に、読ませたい文章はここしかない。
//   だから本文だけは「送り」のある読み物にする。
//
// ★作法
//   ・初読は1段落ずつ、文字を送って出す。出し切るまで先へ進めない
//     （＝流し読みで飛ばせない）。読み終えたら次へ。
//   ・一度読んだ章は、次からは即座に全文。二度目も縛るのは苦痛なだけ。
//   ・「読んだ」印は state に持つ。壊れていても落ちない（読めなければ初読扱い）。
// =============================================================================

const SR_CPS = 34;          // 1秒あたりの文字数（黙読よりすこし遅い＝読ませる速さ）
const SR_PARA_GAP = 260;    // 段落を送るときの間

// この章を読み終えたか
function srRead(id) {
  try { return !!(state.player.flags || {})["_story_read_" + id]; } catch (e) { return false; }
}
function srMarkRead(id) {
  try {
    const f = state.player.flags || (state.player.flags = {});
    f["_story_read_" + id] = true;
    if (typeof saveGame === "function") saveGame();
  } catch (e) { /* 記録できなくても読書は成立する */ }
}

// 本文を段落へ割る。空行・改行で切り、短すぎる断片はくっつける。
function srParagraphs(body) {
  return String(body || "")
    .split(/\n{1,}|<br\s*\/?>/)
    .map(s => s.trim())
    .filter(Boolean);
}

// 本文を host に出す。初読なら送り読み、既読なら即座に全文。
// 返り値は「読み終わった」ことを知らせる Promise（呼び出し側は待たなくてもよい）。
function srRevealInto(host, body, chapterId) {
  const paras = srParagraphs(body);
  if (!host) return Promise.resolve();
  host.innerHTML = "";
  host.classList.add("sr-body");

  // ★既読は即座に全文。読み返しに手間をかけさせない。
  if (srRead(chapterId) || !paras.length) {
    paras.forEach(p => { const e = document.createElement("p"); e.className = "sr-p on"; e.textContent = p; host.appendChild(e); });
    return Promise.resolve();
  }

  return new Promise(resolve => {
    let pi = 0, alive = true;
    const next = el2 => { /* 進行の合図（下で差し替える） */ };

    // 「▼ つづき」の合図。段落を出し切ってから現れる＝途中では押せない。
    const cue = document.createElement("div");
    cue.className = "sr-cue";
    cue.textContent = "▼ つづきを読む";
    host.appendChild(cue);

    // ★「一度画面に載ったあとに消えた」ときだけ止める。
    //   最初から isConnected を見ると、まだ親に付けていない器を渡された瞬間に
    //   終わってしまう（実際にそれで本文が出なかった）。
    let everOn = false;
    const stopIfGone = () => {
      if (host.isConnected) { everOn = true; return false; }
      if (!everOn) return false;            // まだ載る前＝待つ
      alive = false; resolve(); return true;
    };

    const showPara = () => {
      if (!alive || stopIfGone()) return;
      if (pi >= paras.length) {                       // 全部読み終えた
        cue.textContent = "";
        cue.classList.add("done");
        srMarkRead(chapterId);
        alive = false;
        resolve();
        return;
      }
      const text = paras[pi++];
      const p = document.createElement("p");
      p.className = "sr-p";
      host.insertBefore(p, cue);
      cue.classList.remove("ready");
      cue.textContent = "";                           // 出し切るまで合図は出さない

      let i = 0;
      const step = () => {
        if (!alive || stopIfGone()) return;
        // 1フレームで1文字。句読点のあとは少しためる（読点の呼吸）。
        p.textContent = text.slice(0, ++i);
        if (i >= text.length) {
          p.classList.add("on");
          cue.textContent = (pi >= paras.length) ? "▼ 読み終える" : "▼ つづきを読む";
          cue.classList.add("ready");
          return;
        }
        const c = text[i - 1];
        const wait = /[。！？]/.test(c) ? 420 : (/[、…]/.test(c) ? 200 : 1000 / SR_CPS);
        setTimeout(step, wait);
      };
      step();
    };

    // 送りは「出し切ったあと」だけ効く＝途中でスキップできない。
    const onTap = () => {
      if (!alive) return;
      if (!cue.classList.contains("ready")) return;   // まだ出し切っていない
      cue.classList.remove("ready");
      setTimeout(showPara, SR_PARA_GAP);
    };
    host.addEventListener("click", onTap);
    cue.addEventListener("click", onTap);

    showPara();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { srParagraphs, srRevealInto, srRead };
}
