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

// ★1文字ぶんの時間は、画面の更新（約16.7ms）の整数倍にする。
//   半端な値にすると1コマ後と2コマ後に交互に落ちて、送りがかくかくして見える。
const SR_MS_CHAR   = 33;    // 通常の1文字＝2コマ（約30字/秒）
const SR_MS_COMMA  = 150;   // 読点のあとの息継ぎ
const SR_MS_PERIOD = 300;   // 句点のあとの間
const _srNow = () => (window.performance && performance.now) ? performance.now() : Date.now();
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
    // ★一枚絵は切らずに全部見せる（853×1280の縦長）。余った余白は同じ絵を
    //   ぼかして敷いて埋める＝黒帯を作らない。文字は絵の上に浮かせた札に置く。
    `<div class="sr-art">` +
      `<img class="sr-art-blur" src="${srArtSrc(ch)}" alt="" aria-hidden="true"` +
        ` onerror="this.onerror=null;this.src='images/story/${ch.id}.jpg'">` +
      `<img class="sr-art-main" src="${srArtSrc(ch)}" alt=""` +
        ` onerror="this.onerror=null;this.src='images/story/${ch.id}.jpg'">` +
    `</div>` +
    `<div class="sr-head"><span class="sr-ep">${ch.title || ""}</span>` +
      (cast ? `<span class="sr-cast">${cast.symbol || ""} ${cast.name || ""}</span>` : "") + `</div>` +
    `<div class="sr-panel"><p class="sr-line" id="sr-line"></p></div>` +
    `<div class="sr-cue" id="sr-cue"></div>` +
    `<button class="sr-x" aria-label="閉じる">×</button>`;
  document.body.appendChild(ov);

  const line = ov.querySelector("#sr-line");
  const cue = ov.querySelector("#sr-cue");
  let pi = 0, alive = true, typing = false, raf = 0;

  const close = (finished) => {
    if (!alive) return;
    alive = false;
    if (raf) { try { cancelAnimationFrame(raf); } catch (err) {} raf = 0; }
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
    // ★1文字＝1span（にじんで浮かぶ・VNのC案と同じ様式／2026-08-03）。
    //   数字と英字の連なりは1つにまとめる＝inline-block を1字ずつにすると
    //   「297万」が行末で 29／7万 に割れるため（日本語はどこで折れてよい）。
    const cells = [];
    for (let ci = 0; ci < text.length;) {
      const m = /^[0-9A-Za-z][0-9A-Za-z.,%\-]*/.exec(text.slice(ci));
      const chunk = (m && m[0].length > 1) ? m[0] : text[ci];
      const sp = document.createElement("span");
      sp.className = "srch"; sp.textContent = chunk;
      line.appendChild(sp);
      for (let k = 0; k < chunk.length; k++) cells.push(sp);   // 文字index→span（既存の刻みをそのまま使う）
      ci += chunk.length;
    }

    // ★文字送りは画面の更新に乗せる（setTimeout で回さない）。
    //   以前は setTimeout(1000/32 = 31.25ms) で1文字ずつ出していた。
    //   画面の更新は約16.7msごとなので、31.25msの待ちは1コマ後か2コマ後の
    //   どちらかに落ちる。実測すると文字の間隔が 17ms と 33ms で不規則に
    //   混ざっていて、速くなったり遅くなったりして見えた
    //   （ユーザー指摘：文字送りがかくかく）。
    //   ここでは経過時間から「いま何文字目まで出すべきか」を決める。
    //   1文字＝ちょうど2コマ（33ms）にしたので、刻みが一定になる。
    let shown = 0, due = 0, prevT = _srNow();
    const frame = () => {
      if (!alive || !ov.isConnected) { alive = false; return; }
      const now = _srNow();
      // タブが裏に回って戻ったときに一気に飛ばさないよう、1回ぶんは頭打ちに
      const dt = Math.min(96, now - prevT);
      prevT = now;
      due -= dt;
      while (due <= 0 && shown < text.length) {
        const c = text[shown++];
        // 句点は長め、読点は短めに間を取る＝読む呼吸に合わせる
        due += /[。！？]/.test(c) ? SR_MS_PERIOD
             : /[、…]/.test(c)   ? SR_MS_COMMA
             : SR_MS_CHAR;
      }
      for (let k = 0; k < shown; k++) { const sp = cells[k]; if (sp) sp.classList.add("in"); }
      if (shown >= text.length) {
        typing = false;
        line.classList.add("on");
        cue.textContent = (pi >= paras.length) ? "▼ 読み終える" : "▼ つづき";
        cue.classList.add("ready");
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
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
