// =============================================================================
// story_reveal.js — 物語を「全画面の絵＋大きな文字」で読ませる
// =============================================================================
// ★なぜこの形か（ユーザー指摘の履歴）
//   ① 「読んでも大したことがない文章が多い。読ませたい場面はスキップできないよう
//      ゆっくり文字表示するとか、しっかりやって」
//      → 文字送りを入れた。
//   ② 「押すたびにどんどん下に伸びて読みにくい」
//      → 段落を下へ足す作りが原因。高さの決まった窓に変えた。
//   ③ 「この小さいゲーム画面で文章をしっかり読ませるなら、立ち絵全画面表示の上に
//      しっかり文字を大きく乗せた方がよい。読みにくいよ」
//      → ②でも足りなかった。記事のレイアウト（見出し＋リード＋写真＋小さな本文）を
//        縦の小さい画面に詰めること自体が間違い。全画面の絵の上に、大きな字で、
//        1段落ずつ出す形にした。これが今の実装。
//
// ★作り
//   ・章の絵を画面いっぱいに敷く。文字は下半分に大きく置く。
//   ・1段落ずつ<入れ替え>で出す。だからスクロールが要らない。
//   ・出し切るまで送れない＝流し読みで飛ばせない。
//   ・読み終えたら記事ページへ戻り、以後は全文をいつでも読み返せる。
// =============================================================================

const SR_CPS = 32;          // 1秒あたりの文字数（黙読よりすこし遅い＝読ませる速さ）
const SR_GAP = 220;         // 段落を送るときの間

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

function srParagraphs(body) {
  return String(body || "")
    .split(/\n{1,}|<br\s*\/?>/)
    .map(s => s.trim())
    .filter(Boolean);
}

// 章の絵。webp優先、無ければjpg。読めなければ絵なしで文字だけ（壊れない）。
function srArtSrc(ch) {
  return "images/story/" + (ch && ch.id) + ".webp";
}

// ── 全画面の読み物を開く ────────────────────────────────────────────────
// onDone は読み終えた（または閉じた）ときに呼ばれる。
function srOpenReader(ch, onDone) {
  if (!ch) { if (onDone) onDone(); return; }
  const paras = srParagraphs(ch.body);
  const cast = (typeof STORY_CAST !== "undefined" && ch.cast) ? STORY_CAST[ch.cast] : null;

  const ex = document.getElementById("sr-reader"); if (ex) ex.remove();
  const ov = document.createElement("div");
  ov.className = "sr-reader"; ov.id = "sr-reader";
  if (cast && cast.color) ov.style.setProperty("--cg", cast.color);
  ov.innerHTML =
    `<div class="sr-art"><img src="${srArtSrc(ch)}" alt=""` +
      ` onerror="this.onerror=null;this.src='images/story/${ch.id}.jpg';this.classList.add('sr-art-fb')"></div>` +
    `<div class="sr-scrim"></div>` +
    `<div class="sr-head"><span class="sr-ep">${ch.title || ""}</span>` +
      (cast ? `<span class="sr-cast">${cast.symbol || ""} ${cast.name || ""}</span>` : "") + `</div>` +
    `<div class="sr-panel"><p class="sr-line" id="sr-line"></p></div>` +
    `<div class="sr-cue" id="sr-cue"></div>` +
    `<button class="sr-x" aria-label="閉じる">×</button>`;
  document.body.appendChild(ov);

  const line = ov.querySelector("#sr-line");
  const cue = ov.querySelector("#sr-cue");
  let pi = 0, alive = true, typing = false;

  const close = (finished) => {
    if (!alive) return;
    alive = false;
    if (finished) srMarkRead(ch.id);
    ov.classList.add("out");
    setTimeout(() => { ov.remove(); if (onDone) onDone(finished); }, 220);
  };
  ov.querySelector(".sr-x").onclick = (e) => { e.stopPropagation(); close(false); };

  const showNext = () => {
    if (!alive) return;
    if (pi >= paras.length) { close(true); return; }
    const text = paras[pi++];
    line.textContent = "";
    line.classList.remove("on");
    cue.textContent = "";
    cue.classList.remove("ready");
    typing = true;
    let i = 0;
    const step = () => {
      if (!alive || !ov.isConnected) { alive = false; return; }
      line.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        typing = false;
        line.classList.add("on");
        cue.textContent = (pi >= paras.length) ? "▼ 読み終える" : "▼ つづき";
        cue.classList.add("ready");
        return;
      }
      const c = text[i - 1];
      // 句点は長め、読点は短めに間を取る＝読む呼吸に合わせる
      const wait = /[。！？]/.test(c) ? 400 : (/[、…]/.test(c) ? 190 : 1000 / SR_CPS);
      setTimeout(step, wait);
    };
    step();
  };

  // 送りは「出し切ったあと」だけ効く＝途中でスキップできない
  ov.addEventListener("click", () => {
    if (!alive || typing || !cue.classList.contains("ready")) return;
    cue.classList.remove("ready");
    setTimeout(showNext, SR_GAP);
  });

  setTimeout(showNext, 420);   // 絵を一瞬見せてから語りはじめる
}

// ── 記事ページ側：既読の本文を静かに置く（読み返し用）────────────────────
function srRevealInto(host, body, chapterId) {
  if (!host) return Promise.resolve();
  host.innerHTML = "";
  host.classList.add("sr-body");
  srParagraphs(body).forEach(t => {
    const e = document.createElement("p");
    e.className = "sr-p"; e.textContent = t; host.appendChild(e);
  });
  return Promise.resolve();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { srParagraphs, srRead, srOpenReader, srRevealInto };
}
