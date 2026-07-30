// =========================================================================
// shingan_race.js — ☄️ 神眼レース（終章の最終イベント・M3・2026-07-30）
// =========================================================================
// 決裁（docs/ENDGAME_ECONOMY_REDESIGN.md 柱C＋ユーザー回答）：
//   ・解放＝第5話既読 ∧（総資産(到達最高)10億 ∨ 絶滅メーター押し切り(finalReady)）
//   ・出走＝固定8頭。**その竜のスカウトが必要**と明示し、スカウト成立後に育成（訓練）できる
//   ・訓練＝能力を上げ下げ両方できる（回数無制限・無料＝終盤はパズルに集中させる）
//   ・レース＝**能力だけで決まる決定的シミュレーション**（乱数なし。同じ能力→同じ結果）
//   ・クリア＝上位3頭のゴール差が 0.10秒以内（三頭同着）→ 絶滅の神眼を打ち破る
//     → 赤目ミミ → 走馬灯/八竜見参（既存演出流用）→ edFlag → エンディング
// ★賭け・オッズ・配当・既存レースエンジンには一切触れない独立モード（[[race-math-immutable]]）。
// パズルの核＝「3頭とも同じ数値」では揃わない：竜ごとの固定の得意/苦手（mult）と、
// 順位・差分に反応する“特性”（動的係数）が非線形の写像を作る。試走の着差を頼りに詰める。
// =========================================================================

// ── コース（5区間・合計3400m） ─────────────────────────────────────────
const SHINGAN_SEGS = [
  { id: "start", name: "ゲート",   ic: "🚪", len: 200 },
  { id: "flat",  name: "海岸平地", ic: "🌊", len: 1000 },
  { id: "climb", name: "火山登り", ic: "🌋", len: 800 },
  { id: "dive",  name: "峡谷降り", ic: "🪂", len: 800 },
  { id: "spurt", name: "最終直線", ic: "🏁", len: 600 }
];
const SHINGAN_ABL = ["出足", "地力", "登り", "降り", "末脚"];
const SHINGAN_TIE = 0.10;   // 同着の許容差（秒）＝クリア条件

// ── 固定8頭（全6ロケを跨ぐ＝スカウトが終盤の必須コンテンツ・人選はM3設計で確定） ──
//   mult＝生まれつきの得意/苦手（訓練で変わらない・区間係数）。quirk＝動的な特性（下の _sgQuirk）。
//   ab0＝初期能力（0..100）。★数値はこのモード内で完結＝レース本編のstatsとは独立。
const SHINGAN_ROSTER = [
  { id: "kogane", loc: "grass",   locName: "草むら",   ic: "🌾",
    q: "強欲の輝き", qd: "最終直線を先頭で迎えると末脚が燃える（×1.10）。先頭でなければ少し萎える（×0.97）。",
    mult: [1, 1.02, 0.98, 1, 1], ab0: [60, 62, 45, 50, 66] },
  { id: "yugiri", loc: "jungle",  locName: "密林",     ic: "🌳",
    q: "霧隠れ", qd: "近く（前後0.8秒）に2頭以上いると紛れて速い（×1.04）。単独だと迷う（×0.98）。",
    mult: [1, 1, 1.03, 1.03, 0.98], ab0: [50, 55, 58, 60, 48] },
  { id: "konron", loc: "cliff",   locName: "崖",       ic: "🪨",
    q: "山の主", qd: "登りがめっぽう得意（×1.12）、降りは苦手（×0.94）。気分に流されない安定株。",
    mult: [1, 1, 1.12, 0.94, 1], ab0: [46, 52, 70, 40, 50] },
  { id: "goka",   loc: "volcano", locName: "火山地帯", ic: "🌋",
    q: "業火の癇癪", qd: "直前の区間で順位を落とすと怒って速い（×1.08）。上げると満足して緩む（×0.99）。",
    mult: [1, 1.02, 1.02, 1, 1], ab0: [55, 60, 52, 55, 58] },
  { id: "yomi",   loc: "sea",     locName: "水中",     ic: "🌊",
    q: "黄泉還り", qd: "前半（ゲート・平地）は眠く（×0.96）、降り以降でよみがえる（×1.07）。",
    mult: [0.96, 0.96, 1, 1.07, 1.07], ab0: [42, 50, 55, 66, 60] },
  { id: "souten", loc: "sky",     locName: "空中",     ic: "☁️",
    q: "王の余裕", qd: "2番手以内だと手を抜き（×0.98）、3番手以下だと本気を出す（×1.06）。",
    mult: [1, 1.02, 1, 1, 1.02], ab0: [65, 66, 60, 62, 64] },
  { id: "gekka",  loc: "sky",     locName: "空中",     ic: "🌙",
    q: "月の満ち欠け", qd: "訓練値の合計が偶数だと満ちて速い（×1.03）、奇数だと欠けて鈍い（×0.98）。",
    mult: [1, 1, 1, 1.02, 1.02], ab0: [52, 58, 50, 56, 57] },
  { id: "phenix", loc: "sky",     locName: "空中",     ic: "🔥",
    q: "不死の翼", qd: "出遅れ癖（ゲート×0.90）。だが最終直線で燃え上がる（×1.15）。絶滅を知らない鳥。",
    mult: [0.90, 1, 1, 1, 1.15], ab0: [40, 55, 48, 52, 72] }
];

// ── 状態（表示専用メタ・saveGameで永続） ─────────────────────────────────
function shinganData() {
  const p = state.player;
  if (!p.shingan) p.shingan = { ab: {}, intro: false, cleared: false, best: null, failShown: false };
  return p.shingan;
}
function shinganAb(id) {
  const d = shinganData();
  const r = SHINGAN_ROSTER.find(x => x.id === id);
  if (!d.ab[id]) d.ab[id] = r.ab0.slice();
  return d.ab[id];
}
function shinganScouted(id) {
  try { const e = (state.player.collection || {})[id]; return !!(e && e.scouted); } catch (e) { return false; }
}
function shinganAllScouted() { return SHINGAN_ROSTER.every(d => shinganScouted(d.id)); }
// 解放＝第5話既読 ∧（到達最高10億 ∨ メーター押し切り）
function shinganUnlocked() {
  try {
    const read5 = (typeof chapterRead === "function") ? chapterRead("5") : false;
    if (!read5) return false;
    const peak = (typeof assetsPeak === "function") ? assetsPeak(state) : 0;
    const fin = !!(state.player.epilogue && state.player.epilogue.finalReady);
    return peak >= ((typeof storyUnlockAt === "function" && storyUnlockAt("ED")) || 1000000000) || fin;
  } catch (e) { return false; }
}

// ── 決定的シミュレーション ────────────────────────────────────────────
function _sgRanks(cum) {
  const idx = cum.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rank = new Array(cum.length);
  idx.forEach((x, pos) => { rank[x[1]] = pos + 1; });
  return rank;
}
function _sgQuirk(d, s, i, snap, rank, prevRank, abSum) {
  switch (d.id) {
    case "kogane": return (s === 4) ? (rank[i] === 1 ? 1.10 : 0.97) : 1;
    case "yugiri": {
      if (s === 0) return 1;
      let near = 0;
      for (let j = 0; j < snap.length; j++) if (j !== i && Math.abs(snap[j] - snap[i]) <= 0.8) near++;
      return near >= 2 ? 1.04 : 0.98;
    }
    case "goka":   return (s === 0) ? 1 : (rank[i] > prevRank[i] ? 1.08 : (rank[i] < prevRank[i] ? 0.99 : 1));
    case "souten": return (s === 0) ? 1 : (rank[i] <= 2 ? 0.98 : 1.06);
    case "gekka":  return (abSum % 2 === 0) ? 1.03 : 0.98;
    default: return 1;   // konron / yomi / phenix ＝ mult（固定の得意/苦手）だけ
  }
}
// abOv＝{id:[5つの能力]}（省略時は保存値）。乱数ゼロ＝同じ入力なら必ず同じ結果。
function shinganRun(abOv) {
  const R = SHINGAN_ROSTER;
  const ab = R.map(d => (abOv && abOv[d.id]) || shinganAb(d.id));
  const gekkaIdx = R.findIndex(d => d.id === "gekka");
  const gekkaSum = ab[gekkaIdx].reduce((a, x) => a + x, 0);
  const cum = R.map(() => 0);
  let prevRank = R.map(() => 1);
  const passLog = [];
  for (let s = 0; s < SHINGAN_SEGS.length; s++) {
    const snap = cum.slice();
    const rank = _sgRanks(snap);
    for (let i = 0; i < R.length; i++) {
      const m = R[i].mult[s] * _sgQuirk(R[i], s, i, snap, rank, prevRank, gekkaSum);
      const v = (20 + ab[i][s] * 0.12) * m;
      cum[i] += SHINGAN_SEGS[s].len / v;
    }
    prevRank = rank;
    passLog.push(_sgRanks(cum).slice());
  }
  const rows = R.map((d, i) => ({ id: d.id, name: _sgName(d.id), ic: d.ic, time: cum[i] }))
    .sort((a, b) => a.time - b.time);
  rows.forEach((r, i) => { r.pos = i + 1; r.gap = r.time - rows[0].time; });
  const spread = rows[2].time - rows[0].time;
  return { rows, spread, clear: spread <= SHINGAN_TIE, passLog };
}
function _sgName(id) {
  try { const d = DRAGONS.find(x => x.id === id); if (d) return d.name; } catch (e) {}
  return id;
}

// ── 開発検証用ソルバ（山登り法・解の存在証明。UIからは呼ばない） ──────────
function _sgSolve(iters) {
  const cur = {}; SHINGAN_ROSTER.forEach(d => { cur[d.id] = d.ab0.slice(); });
  let best = shinganRun(cur).spread, bestAb = JSON.parse(JSON.stringify(cur));
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let k = 0; k < (iters || 20000); k++) {
    const d = SHINGAN_ROSTER[Math.floor(rnd() * 8)];
    const a = Math.floor(rnd() * 5);
    const step = [1, -1, 5, -5, 10, -10][Math.floor(rnd() * 6)];
    const old = cur[d.id][a];
    cur[d.id][a] = Math.max(0, Math.min(100, old + step));
    const sp = shinganRun(cur).spread;
    if (sp <= best + (rnd() < 0.1 ? 0.3 : 0)) {   // 焼きなましの緩い受理
      if (sp < best) { best = sp; bestAb = JSON.parse(JSON.stringify(cur)); }
    } else cur[d.id][a] = old;
    if (best <= SHINGAN_TIE * 0.6) break;
  }
  return { best, ab: bestAb };
}

// ── UI ─────────────────────────────────────────────────────────────────
var _sgOpen = null;      // 訓練アコーディオンの開いている竜
var _sgLast = null;      // 直近の試走結果

function renderShinganRace() {
  if (!shinganUnlocked()) {
    if (typeof showInfoPopup === "function") showInfoPopup("☄️ ？？？",
      `<div class="mm-row"><span class="mm-ic">🔒</span><div><b>まだ視えない</b><small>第5話を読み、総資産10億（または絶滅メーターを押し切る）に届いた者だけが、この舞台に立てる。</small></div></div>`);
    if (state.ui.screen !== "home") renderHome();
    return;
  }
  const sg = shinganData();
  if (!sg.intro) { sg.intro = true; if (typeof saveGame === "function") saveGame(); _sgIntroVN(() => renderShinganRace()); return; }

  state.ui.screen = "shingan";
  const app = beginScreen();
  app.classList.add("sg-page");

  const head = el("div", "sg-head");
  head.innerHTML =
    `<div class="sg-title">☄️ 神眼レース</div>` +
    `<div class="sg-sub">決着の視える眼に、決着の無い結末を。</div>` +
    `<div class="sg-rule">最高クラスの8頭を<b>訓練（上げ下げ）</b>し、<b>上位3頭を同着（差 ${SHINGAN_TIE.toFixed(2)}秒以内）</b>に持ち込め。` +
    `賭けもオッズも無い。能力がすべてを決める——だから、決着を消せる。</div>`;
  app.appendChild(head);
  if (sg.cleared) app.appendChild(el("div", "sg-cleared", "👁️‍🗨️ 神眼は破られた — クリア済み（何度でも試走できます）"));

  // ── 8頭：スカウト状態と訓練 ──
  const allIn = shinganAllScouted();
  if (!allIn) app.appendChild(el("div", "sg-need", "🐲 出走には<b>8頭全員のスカウト</b>が必要です。足りない竜は各ロケーションで心を通わせてこよう。"));
  const list = el("div", "sg-list");
  SHINGAN_ROSTER.forEach(d => {
    const ok = shinganScouted(d.id);
    const card = el("div", "sg-card" + (ok ? "" : " locked") + (_sgOpen === d.id ? " open" : ""));
    const ab = shinganAb(d.id);
    let h =
      `<button class="sg-card-h">` +
      `<span class="sg-d-ic">${ok ? d.ic : "❔"}</span>` +
      `<span class="sg-d-tx"><b>${ok ? _sgName(d.id) : "？？？"}</b>` +
      `<small>${ok ? `${d.q} — ${d.qd}` : `🔒 この竜のスカウトが必要（${d.ic} ${d.locName}）`}</small></span>` +
      `<span class="sg-d-ch">${ok ? (_sgOpen === d.id ? "▾" : "▸") : "▶"}</span></button>`;
    if (ok && _sgOpen === d.id) {
      h += `<div class="sg-train">` + SHINGAN_ABL.map((nm, k) =>
        `<div class="sg-ab"><span class="sg-ab-n">${nm}</span>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="-10">−10</button>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="-1">−1</button>` +
        `<b class="sg-ab-v">${ab[k]}</b>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="1">＋1</button>` +
        `<button class="sg-st" data-d="${d.id}" data-a="${k}" data-s="10">＋10</button></div>`).join("") +
        `</div>`;
    }
    card.innerHTML = h;
    const hd = card.querySelector(".sg-card-h");
    hd.onclick = ok
      ? () => { _sgOpen = (_sgOpen === d.id) ? null : d.id; renderShinganRace(); }
      : () => { if (typeof renderScout === "function") renderScout(); };
    card.querySelectorAll(".sg-st").forEach(btn => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const a = shinganAb(btn.dataset.d);
        a[+btn.dataset.a] = Math.max(0, Math.min(100, a[+btn.dataset.a] + (+btn.dataset.s)));
        if (typeof saveGame === "function") saveGame();
        renderShinganRace();
      };
    });
    list.appendChild(card);
  });
  app.appendChild(list);

  // ── 試走 ──
  const runBtn = el("button", "sg-run" + (allIn ? "" : " off"), allIn ? "🏁 試走する（何度でも）" : "🔒 8頭そろったら出走できる");
  runBtn.onclick = allIn ? () => {
    _sgLast = shinganRun(null);
    const sg = shinganData();
    if (_sgLast.clear && !sg.cleared) { _sgClear(); return; }
    if (!_sgLast.clear && !sg.cleared && !sg.failShown && _sgLast.spread <= SG_FAIL_AT) { _sgFail(); return; }
    renderShinganRace();
    try { if (window.Sfx) Sfx.play(_sgLast.spread < 1 ? "streak" : "nav"); } catch (e) {}
  } : () => {};
  app.appendChild(runBtn);

  if (_sgLast) {
    const res = el("div", "sg-res");
    const sp = _sgLast.spread;
    res.innerHTML =
      `<div class="sg-sp${sp <= SHINGAN_TIE ? " win" : (sp <= 1 ? " near" : "")}">上位3頭の差 <b>${sp.toFixed(2)}秒</b><small>（クリア ${SHINGAN_TIE.toFixed(2)}秒以内）</small></div>` +
      _sgLast.rows.map(r =>
        `<div class="sg-row${r.pos <= 3 ? " top3" : ""}"><span class="p">${r.pos}着</span><span class="ic">${r.ic}</span>` +
        `<span class="n">${r.name}</span><span class="t">${_sgFmt(r.time)}</span>` +
        `<span class="g">${r.pos === 1 ? "—" : "+" + r.gap.toFixed(2)}</span></div>`).join("");
    app.appendChild(res);
  }

  const actions = el("div", "actions");
  const back = el("button", "secondary", "ホームへ戻る"); back.onclick = () => renderHome();
  actions.appendChild(back);
  app.appendChild(actions);
}
function _sgFmt(t) {
  const m = Math.floor(t / 60), s = (t - m * 60);
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2);
}

// ── 前口上（初回のみ）：神眼の宣告 ───────────────────────────────────────
function _sgIntroVN(done) {
  if (!(window.Dialogue && Dialogue.play)) { done(); return; }
  Dialogue.play([
    ["narrator", "夜明け前の聖龍レース場。最高クラスの八頭のための、最後のゲートが組まれていく。"],
    ["celestia", "この舞台に賭けは無い。オッズも、配当も。……能力が、すべてを決める。", "default"],
    ["celestia", "つまり——わたしには、結果が完全に視えている。決着は、動かない。", "default"],
    ["mimi", "……決着が、あれば。ですよね。", "default"],
    ["mimi", "なら、わたしは訓練で竜たちを揃えます。1着も2着も3着も無い——同着なら、視える決着なんて、無い！", "happy"],
    ["narrator", "こうしてミミは、八頭の能力表とにらめっこする日々に入った。……目の下に、クマをつくりながら。"]
  ], { force: true }).then(done);
}

// ── 神眼レースの一枚絵（赤目ミミ）＝全画面カード。タップ／自動で閉じて次へ。 ──
//   kind="clear" → images/story/shingan_clear.webp（三頭同着＝ゲームクリア）
//   kind="fail"  → images/story/shingan_fail.webp （惜敗＝光は届いたが決着が生まれた）
//   ★画像が無い環境でも進行が止まらないよう、onerror でカードを閉じて先へ進める。
const SG_KV = {
  clear: { img: "shingan_clear.webp", cap: "三頭同着。——絶滅の神眼は、視るべき決着を失った。", sfx: "legendary", ms: 6200 },
  fail:  { img: "shingan_fail.webp",  cap: "届かない。——叫びは光になっても、決着は、生まれてしまう。", sfx: "streak",    ms: 5200 }
};
function _sgKeyVisual(kind) {
  const conf = SG_KV[kind] || SG_KV.clear;
  return new Promise(function (resolve) {
    var done = false;
    function close() {
      if (done) return; done = true;
      try { ov.classList.add("out"); } catch (e) {}
      setTimeout(function () { try { ov.remove(); } catch (e) {} resolve(); }, 420);
    }
    var ov = el("div", "sg-kv" + (kind === "fail" ? " fail" : ""));
    ov.innerHTML =
      '<div class="sg-kv-flash"></div>' +
      '<img class="sg-kv-img" alt="">' +
      '<div class="sg-kv-cap">' + conf.cap + '</div>' +
      '<div class="fin-skip">タップで進む ▶</div>';
    var img = ov.querySelector(".sg-kv-img");
    img.onerror = function () { close(); };                  // 画像未納品でも詰まらせない
    img.src = "images/story/" + conf.img;
    document.body.appendChild(ov);
    try { if (window.Sfx) Sfx.play(conf.sfx); } catch (e) {}
    ov.onclick = close;
    setTimeout(close, conf.ms);                              // 自動で先へ（長居させない）
  });
}

// ── 惜敗の演出：一度だけ。「あと少し」で本気の敗北を味わわせる ───────────────
//   ★試走は何度でもできるので、毎回出したら邪魔になる。上位3頭が1秒以内に
//     詰まった＝本当に手が届きかけた最初の1回だけ、一枚絵＋短いVNを見せる。
const SG_FAIL_AT = 1.00;
function _sgFail() {
  const sg = shinganData();
  sg.failShown = true;
  if (typeof saveGame === "function") saveGame();
  const vn = [
    ["makura", "写真判定ィィ——……あー、決着。決着です。三頭、わずかに、ずれてる……！"],
    ["celestia", "……視えたわ。ほんの一瞬、視えなくなりかけたけれど。……視えた。", "default"],
    ["mimi", "……っ、はぁ、はぁ。……もう少し。もう少しなんです。", "panic"],   // sad は全衣装に無い＝404でsmileに落ちる
    ["mimi", "寝ません。まだ寝ません。……あの八頭の目盛りを、あと一つだけ、動かせば。", "default"],
    ["narrator", "淘汰は終わらない。——けれど、終わらせ方は、たしかに見えかけている。"]
  ];
  _sgKeyVisual("fail").then(() => {
    const back = () => renderShinganRace();
    if (window.Dialogue && Dialogue.play) Dialogue.play(vn, { force: true }).then(back);
    else back();
  });
}

// ── クリア：赤目の同着 → 走馬灯/八竜（既存流用）→ edFlag → エンディング ────
function _sgClear() {
  const sg = shinganData();
  sg.cleared = true; sg.best = _sgLast ? _sgLast.spread : 0;
  if (typeof saveGame === "function") saveGame();
  const top3 = _sgLast ? _sgLast.rows.slice(0, 3).map(r => r.name).join("・") : "三頭";
  const vn = [
    ["narrator", "——ゴール線上。三つの影が、完全に、重なった。"],
    ["makura", "どっ、同着ゥゥ！？ しゃ、写真判定！ 写真判定ンンン！！ ……さ、三頭同着ォォォ！？ 神兎大レース史上、初ゥゥゥ！！"],
    ["narrator", `${top3}。三頭の鼻先は、寸分の狂いなく、同じ線の上にあった。`],
    ["celestia", "………。視えない。……決着が、無い。", "default"],
    ["mimi", "ふふ、ふふふ。……徹夜三日目の目、なめないでください。", "happy"],
    ["mimi", "決着が無ければ、神眼にも——淘汰にも、なにも視えない……！", "happy"],
    ["celestia", "……あなた、目が真っ赤よ。……ふ。ふふ。あはは！ 参った。わたしの神眼は、あなたの寝不足に負けたわ。", "default"],
    ["narrator", "絶滅の神眼は、決着なき決着の前に——静かに、閉じた。"]
  ];
  const toEnd = () => {
    if (typeof epilogueClear === "function") epilogueClear();
    else { const e = state.player.epilogue || (state.player.epilogue = {}); e.edFlag = true; if (typeof saveGame === "function") saveGame(); }
    if (window.Ending && Ending.play) Ending.play(); else renderHome();
  };
  const afterShow = () => {
    if (typeof playEightDragonsCutin === "function") playEightDragonsCutin().then(toEnd); else toEnd();
  };
  const runShow = () => {
    if (typeof playFinalShowcase === "function") playFinalShowcase().then(afterShow); else afterShow();
  };
  // 一枚絵（赤目ミミ）→ 同着VN → 走馬灯 → 八竜 → ED
  _sgKeyVisual("clear").then(() => {
    if (window.Dialogue && Dialogue.play) Dialogue.play(vn, { force: true }).then(runShow);
    else runShow();
  });
}

if (typeof window !== "undefined") {
  window.renderShinganRace = renderShinganRace;
  window.shinganUnlocked = shinganUnlocked;
  window.shinganRun = shinganRun;
  window._sgSolve = _sgSolve;
}
