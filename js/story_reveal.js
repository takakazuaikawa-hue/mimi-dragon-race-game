// =============================================================================
// story_reveal.js — 物語の本文を「読ませる」ために、ゆっくり出す
// =============================================================================
// ★なぜ要るか
//   ユーザー指摘：「読んでも大したことがない文章がありすぎて読む気が失せる。
//   …文章を読ませたい場面なら、スキップできないようにゆっくり文字表示するとか、
//   しっかりやってください」
//
//   物語の本文は500〜700字ある。一度に壁で出すと量に負けて読まずに閉じられる。
//   だから本文だけは「送り」のある読み物にする。
//
// ★最初の実装が失敗した理由（ユーザー指摘：押すたびに下へ伸びて読みにくい）
//   段落を下に足していく作りにしたら、ページがどんどん伸び、
//   実測で2段落目から「▼つづきを読む」が画面の外に出ていた（Y=913 > 画面910）。
//   読者は毎回スクロールして合図を探すことになる。文字送りの前に、
//   「読む姿勢を崩さない」ことのほうが大事だった。
//
// ★いまの作り
//   ・本文は高さの決まった<窓>。ページは伸びない。
//   ・新しい段落は窓の中で下から現れ、古い段落は上へ流れて残る（文脈は消さない）。
//   ・送りの合図は窓の<外>に置く。だから位置が絶対に動かない＝追いかけなくていい。
//   ・出し切るまで合図は出ない＝流し読みで飛ばせない。
//   ・読み終えたら窓の縛りを外して全文を表示。既読の章は最初から全文。
// =============================================================================

const SR_CPS = 34;          // 1秒あたりの文字数（黙読よりすこし遅い＝読ませる速さ）
const SR_PARA_GAP = 240;    // 段落を送るときの間

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

// 本文を段落へ割る
function srParagraphs(body) {
  return String(body || "")
    .split(/\n{1,}|<br\s*\/?>/)
    .map(s => s.trim())
    .filter(Boolean);
}

// 本文を host に出す。初読なら送り読み、既読なら即座に全文。
function srRevealInto(host, body, chapterId) {
  const paras = srParagraphs(body);
  if (!host) return Promise.resolve();
  host.innerHTML = "";
  host.classList.add("sr-body");

  const scroller = document.createElement("div");
  scroller.className = "sr-scroll";
  host.appendChild(scroller);

  const putAll = () => {
    paras.forEach(t => {
      const e = document.createElement("p");
      e.className = "sr-p on"; e.textContent = t; scroller.appendChild(e);
    });
  };

  // ★既読は即座に全文。読み返しに手間をかけさせない。
  if (srRead(chapterId) || !paras.length) {
    host.classList.add("sr-done");      // 高さの縛りを外す
    putAll();
    return Promise.resolve();
  }

  // 送りの合図は「窓の外」に置く。ここが動かないから、目線が迷わない。
  const cue = document.createElement("div");
  cue.className = "sr-cue";
  if (host.parentNode) host.parentNode.insertBefore(cue, host.nextSibling);

  return new Promise(resolve => {
    let pi = 0, alive = true, everOn = false;

    const stopIfGone = () => {
      if (host.isConnected) { everOn = true; return false; }
      if (!everOn) return false;           // まだ画面に載る前＝待つ
      alive = false; resolve(); return true;
    };
    // 窓の中で、いま書いている行がいつも見えるようにする
    const follow = () => { try { scroller.scrollTop = scroller.scrollHeight; } catch (e) {} };

    const finish = () => {
      alive = false;
      cue.remove();
      host.classList.add("sr-done");       // 縛りを外して全文が読める形に戻す
      srMarkRead(chapterId);
      resolve();
    };

    const showPara = () => {
      if (!alive || stopIfGone()) return;
      if (pi >= paras.length) { finish(); return; }
      const text = paras[pi++];
      const p = document.createElement("p");
      p.className = "sr-p";
      scroller.appendChild(p);
      cue.classList.remove("ready");
      cue.textContent = "";                // 出し切るまで合図は出さない

      let i = 0;
      const step = () => {
        if (!alive || stopIfGone()) return;
        p.textContent = text.slice(0, ++i);
        follow();
        if (i >= text.length) {
          p.classList.add("on");
          cue.textContent = (pi >= paras.length) ? "▼ 読み終える" : "▼ つづきを読む";
          cue.classList.add("ready");
          return;
        }
        const c = text[i - 1];
        // 句点は長め、読点は短めに間を取る＝読む呼吸に合わせる
        const wait = /[。！？]/.test(c) ? 420 : (/[、…]/.test(c) ? 200 : 1000 / SR_CPS);
        setTimeout(step, wait);
      };
      step();
    };

    // 送りは「出し切ったあと」だけ効く＝途中でスキップできない
    const onTap = () => {
      if (!alive || !cue.classList.contains("ready")) return;
      cue.classList.remove("ready");
      setTimeout(showPara, SR_PARA_GAP);
    };
    host.addEventListener("click", onTap);
    cue.addEventListener("click", onTap);

    // ★読み始めに、本文の窓と合図が目の前に来るよう一度だけ寄せる。
    //   記事の見出し・リード・写真のぶん、窓は画面の下に置かれている。
    //   合図の位置は以後動かないので、この一回で読む姿勢が決まる。
    setTimeout(() => {
      try { if (host.isConnected) host.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
    }, 120);

    showPara();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { srParagraphs, srRevealInto, srRead };
}
