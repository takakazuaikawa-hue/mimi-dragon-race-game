/**
 * dialogue.js — データ駆動の「立ち絵つきセリフ」システム（ビジュアルノベル風）
 * =========================================================================
 * 目的：ミミや顧問たちが各場面で“立ち絵つきで”しゃべる演出を、台本（データ）の
 * 追加・削除だけで網羅的に実装できるようにする。表示専用 —— 着順・オッズ・配当
 * には一切干渉しない（演出のみ）。他プロジェクトへも丸ごと持ち出せる独立モジュール。
 *
 * ┌─ 使い方（最小） ──────────────────────────────────────────────┐
 * │ Dialogue.play([                                                  │
 * │   { s:'sake', e:'default', t:'まず食え、泣くな。' },             │
 * │   { s:'mimi', e:'happy',   t:'……はいっ！' }                     │
 * │ ]);                                                              │
 * │ // → Promise を返す（再生完了/スキップで解決）。await 可。       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * 台本の1行（line）の形：
 *   { s:話者ID, t:'セリフ', e:表情, side:'left'|'right'（任意・立ち絵の左右上書き） }
 *   省略形タプルも可： ['mimi','セリフ','happy'] / ['mimi','セリフ']
 *   t が空/未定義の行は自動的に無視。
 *
 * ── 話者ID（s）について ───────────────────────────────────────────
 *   ・'mimi'                … 現在の衣装の立ち絵を自動使用（表情=e）
 *   ・STORY_CAST のキー      … sake / mizu / sumika / makura / celestia（自動取込）
 *   ・追加キャラ             … 下の EXTRA_CAST（実況/村人/ナレーション等）
 *   ・別名                   … sake_udada→sake などは ALIAS で吸収
 *   未知IDでも落ちない（名前=ID、絵は絵文字💬にフォールバック）。
 *
 * ── 立ち絵の画像解決 ──────────────────────────────────────────────
 *   ・ミミ      : outfitImg(現在の衣装, 表情)。透過 _cut を優先し、無ければ
 *                 smile→default→絵文字へ自動フォールバック。
 *   ・他キャラ  : 既定で images/cast/<id>.png（顔アイコン）。表情差分を後で
 *                 足すなら、登録時に img:{default:'...',happy:'...'} を渡すだけ。
 *   ・全て 404 なら絵文字シンボルに自動フォールバック（壊れない）。
 *
 * ┌─ 追加・削除（網羅的に） ──────────────────────────────────────┐
 * │ ① キャラを足す/差し替える：                                      │
 * │    Dialogue.registerCast('rival', {                             │
 * │      name:'ライバル', color:'#c060a0', symbol:'😼',             │
 * │      side:'left', img:'images/cast/rival.png' });               │
 * │ ② 名前つき台本を登録（あちこちから呼べる）：                     │
 * │    Dialogue.register('opening', [ ...lines ]);                  │
 * │    Dialogue.play('opening');                                    │
 * │ ③ その場で配列を渡してもよい（登録不要）：Dialogue.play([...]) │
 * │ 削除はオブジェクトから消すだけ（delete Dialogue.scripts.x 等）。 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * 依存：utils.js(el,$)・data_assets.js(STORY_CAST,outfitImg,currentOutfitId)。
 * これらが未定義でも play 時に安全側へフォールバックする。
 */
(function (global) {
  "use strict";

  /* =====================================================================
     1) キャラ登録レジストリ（データ駆動）
     STORY_CAST（顧問5人）は自動で取り込む。ここはミミ＋“顧問以外”の話者。
     EXTENSION POINT: 新キャラはここに足すか、実行時 Dialogue.registerCast()。
     ===================================================================== */
  var EXTRA_CAST = {
    mimi:      { name: "ミミ",        color: "#e6b24a", symbol: "🐰", side: "right", mimi: true },
    announcer: { name: "実況",        color: "#57b1dd", symbol: "📣", side: "left" },
    villager:  { name: "村の竜使い",  color: "#6ac06a", symbol: "🧑‍🌾", side: "left" },
    system:    { name: "システム",    color: "#a9a394", symbol: "⚙️", side: "left" },
    narrator:  { name: "",            color: "#a9a394", symbol: "📖", side: "left", narrator: true }
  };

  // 別名 → 正規ID（既存データ表記ゆれの吸収）。
  var ALIAS = {
    sake_udada: "sake",
    dragon_villager: "villager",
    "": "narrator", null: "narrator", undefined: "narrator"
  };

  // 実行時に追加されたキャラ（registerCast）。
  var RUNTIME_CAST = {};

  function resolveId(id) {
    if (id == null) return "narrator";
    id = String(id);
    return ALIAS[id] || id;
  }

  // STORY_CAST + EXTRA_CAST + RUNTIME を毎回マージ（数件なので軽い／常に最新）。
  function buildCast() {
    var c = {};
    try {
      if (typeof STORY_CAST === "object" && STORY_CAST) {
        for (var k in STORY_CAST) {
          var s = STORY_CAST[k];
          c[k] = { name: s.name, color: s.color, symbol: s.symbol, tag: s.tag, side: "left" };
        }
      }
    } catch (e) {}
    for (var e1 in EXTRA_CAST) c[e1] = assign(assign({}, c[e1]), EXTRA_CAST[e1]);
    for (var e2 in RUNTIME_CAST) c[e2] = assign(assign({}, c[e2]), RUNTIME_CAST[e2]);
    return c;
  }

  function castOf(id) {
    id = resolveId(id);
    var c = buildCast()[id];
    return c || { name: id, color: "#caa24a", symbol: "💬", side: "left" };
  }

  // 立ち絵候補（先頭から順に試し、全滅で絵文字）。
  function imgChain(id, expr) {
    id = resolveId(id);
    var c = castOf(id);
    if (c.mimi) {
      var oid = (typeof currentOutfitId === "function") ? currentOutfitId() : "buniqro";
      var ex = expr || "smile";
      var oi = (typeof outfitImg === "function") ? outfitImg : function (o, x) { return "images/cast/mimi/mimi_" + o + "_" + x + ".webp"; };
      var list = [oi(oid, ex + "_cut"), oi(oid, ex), oi(oid, "smile_cut"), oi(oid, "smile"), oi(oid, "default")];
      return uniq(list);
    }
    if (c.img) {
      if (typeof c.img === "function") { var r = c.img(expr); return r ? [r] : []; }
      if (Array.isArray(c.img)) return c.img.slice();   // ★多段フォールバック（各要素は文字列 or {src,sil}）
      if (typeof c.img === "object") {
        // ★表情差分＋defaultフォールバック（欠損表情は404チェーンでdefaultへ落ちる）
        var p = [];
        if (expr && c.img[expr]) p.push(c.img[expr]);
        if (c.img.default) p.push(c.img.default);
        return p;
      }
      return [c.img];
    }
    return ["images/cast/" + id + ".png"];
  }

  /* ---- 表情の自動選択（②表情差分） ----------------------------------
     優先順位： 行の e（明示） > opts.mood（場面の気分） > 文面からの推定（ミミ） > 'smile'。
     文面推定は“気分で自動的に表情が変わる”ための簡易ヒューリスティック。
     誤爆時は行に e を明示する／play(台本,{auto:false}) で推定オフ。
     EXTENSION POINT: 表情を増やすなら EXPRS と inferExpr のルールを更新。 */
  var EXPRS = ["default", "smile", "happy", "panic"];
  function inferExpr(t) {
    if (!t) return "smile";
    // ★新4表情（Codex納品・CAST_ART_BRIEF §5）。panic/happyより先に判定＝専用の感情を優先。
    if (/悔し|むー|ぷんすか|ずるい|ひどい|もう[!！ー]|怒/.test(t)) return "angry";
    if (/ぐすっ|うぅ|泣け|なみだ|涙|えぐ|しくしく/.test(t)) return "cry";
    if (/えへへ|照れ|はずかし|恥ずかし|てへ|ぽっ/.test(t)) return "shy";
    if (/見てなさい|勝負|受けて立|いざ|覚悟|本気モード|決めて/.test(t)) return "kirin";
    if (/[!！][?？]|[?？][!！]|[?？]{2}|えっ|ええ[ぇっ]|うわ|ひ[っぃ]|やば|まずい|こわ|怖|ピンチ|どうしよ|だめ|ダメ|無理|きゃ/.test(t)) return "panic";
    if (/[!！]|やった|うれし|嬉し|わ[ーぁ]|よっし|最高|だいすき|大好き|ありがと|わくわく|たのし|楽し/.test(t)) return "happy";
    if (/……|‥|ごめん|すみません|ううん|そっか|なるほど|ふぅ|はぁ/.test(t)) return "default";
    return "smile";
  }
  function chooseExpr(line, c) {
    if (line.e) return line.e;                                   // ① 明示が最優先
    if (opts && opts.mood) return opts.mood;                     // ② 場面の気分（既定表情）
    if (c && c.mimi && !(opts && opts.auto === false)) return inferExpr(line.t); // ③ ミミは文面推定
    return undefined;                                            // ④ 他キャラ等は未指定（imgChainで'smile'扱い）
  }

  /* =====================================================================
     2) 台本レジストリ（名前つき台本）＋サンプル
     EXTENSION POINT: 各場面の台本をここに足す（または Dialogue.register）。
     ===================================================================== */
  var SCRIPTS = {
    // サンプル：左右の立ち絵・表情差し替え・ナレーションの実演。
    demo: [
      { s: "narrator", t: "――霧と火山の島。借金まみれのバニーが、ひとり倒れていた。" },
      { s: "sake",  e: "default", t: "うぐぐ……まず食え、泣くな。お前さんはまだ終わっとらん。" },
      { s: "mimi",  e: "panic",   t: "サ、サケさん……！ わたし、借金まみれのバニーガールですよ？" },
      { s: "mimi",  e: "happy",   t: "……でも。もう一度だけ、夢を見てもいいですか。" },
      { s: "mizu",  e: "default", t: "オッズは勝率ではないわ、あはん。人気と価値を、分けて見ることね。" },
      { s: "mimi",  e: "smile",   t: "はいっ！ ミミ、もう一度ここから走ります！" }
    ]
  };

  /* =====================================================================
     3) オーバーレイ（遅延生成・自己完結）
     ===================================================================== */
  var dom = null; // { overlay, stage, slots:{left,right}, name, text, next, skip }

  function mk(tag, cls, html) {
    if (typeof el === "function") return el(tag, cls, html);
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function ensureDom() {
    if (dom) return dom;
    var overlay = mk("div", "dlg-overlay hidden");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-live", "polite");

    var bg = mk("div", "dlg-bg");        // ★背景レイヤ（scrimの下・行の bg:"nightmarket" 等でクロスフェード）
    var scrim = mk("div", "dlg-scrim");
    var stage = mk("div", "dlg-stage");

    function slot(side) {
      var wrap = mk("div", "dlg-standee " + side);
      wrap.appendChild(mk("img", null));
      wrap.appendChild(mk("span", "dlg-standee-sym"));
      stage.appendChild(wrap);
      return { wrap: wrap, img: wrap.querySelector("img"), sym: wrap.querySelector(".dlg-standee-sym"), id: null, expr: null, has: false };
    }
    var slots = { left: slot("left"), right: slot("right") };

    var box = mk("div", "dlg-box");
    var name = mk("span", "dlg-name");
    var text = mk("div", "dlg-text");
    var next = mk("span", "dlg-next", "▼");
    box.appendChild(name);
    box.appendChild(text);
    box.appendChild(next);

    var skip = mk("button", "dlg-skip", "スキップ ✕");

    overlay.appendChild(bg);
    overlay.appendChild(scrim);
    overlay.appendChild(stage);
    overlay.appendChild(box);
    overlay.appendChild(skip);
    document.body.appendChild(overlay);

    // 操作：本文/立ち絵タップ＝送る。スキップ＝最後まで。
    function onTapAdvance(ev) { ev.preventDefault(); ev.stopPropagation(); advance(); }
    scrim.addEventListener("click", onTapAdvance);
    stage.addEventListener("click", onTapAdvance);
    box.addEventListener("click", onTapAdvance);
    skip.addEventListener("click", function (ev) { ev.stopPropagation(); skipAll(); });

    dom = { overlay: overlay, bg: bg, stage: stage, slots: slots, box: box, name: name, text: text, next: next, skip: skip };
    return dom;
  }

  // ★背景のクロスフェード（bg:"stable" → images/bg/stable.webp。パス指定もそのまま通す）。404は静かに無視。
  function setBg(id) {
    if (!dom) return;
    var url = /[/.]/.test(id) ? id : "images/bg/" + id + ".webp";
    if (dom.bg.dataset.cur === url) return;
    dom.bg.dataset.cur = url;
    var im = new Image();
    im.onload = function () {
      dom.bg.appendChild(im);
      // rAFは非アクティブタブで凍結する＝classが付かず透明のままになるため、強制リフローで即時に確実に発火。
      void im.offsetWidth;
      im.classList.add("on");
      while (dom.bg.children.length > 2) dom.bg.removeChild(dom.bg.firstChild);
    };
    im.src = url;
  }
  function clearBg() { if (dom && dom.bg) { dom.bg.innerHTML = ""; delete dom.bg.dataset.cur; } }

  // ★感情アニメ→効果音の自動対応（fx1語で音まで付く）。行の se: 明示が最優先。
  var FX_SE = { shake: "miss", hop: "paho", nod: "tick", flash: "alert" };

  /* =====================================================================
     4) 再生エンジン（直列化・タイプライタ・送り/スキップ）
     ===================================================================== */
  var queue = null, idx = 0, resolveFn = null, opts = {};
  var typing = false, typeTimer = 0, full = "", shown = 0;
  var chain = Promise.resolve(); // 多重 play() を直列化

  var REDUCE = false;
  try { REDUCE = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function normalize(script) {
    if (typeof script === "string") script = SCRIPTS[script];
    if (!Array.isArray(script)) return [];
    var out = [];
    for (var i = 0; i < script.length; i++) {
      var l = script[i];
      if (l == null) continue;
      if (Array.isArray(l)) l = { s: l[0], t: l[1], e: l[2] };
      var t = (l.t != null) ? l.t : l.text;
      if (t == null || t === "") continue;
      // ★演出フィールドは任意（fx=感情アニメ/se=効果音/bg=背景/w=行末の間ms）。既存台本は無指定＝従来どおり。
      out.push({ s: (l.s != null ? l.s : l.speaker), t: String(t), e: (l.e || l.expr), side: l.side,
        fx: l.fx, se: l.se, bg: l.bg, w: l.w });
    }
    return out;
  }

  // ★検証用の「早送り」スイッチ。
  //   ONの間もセリフは通常どおり描画する。変わるのは、クリックを待たずに
  //   自分で次へ進むことだけ。
  //   ★消してしまう作りにはしない：それだとVN自体の検証ができなくなる。
  //     （一度その実装をして、VNの中身を確認する手段を失った）
  //   ?vnfast=1 でも有効。倍率で速さを変えられる（既定=1行あたり0.25秒）。
  var fastMs = 0;
  try {
    var m = location.search.match(/vnfast=(\d*)/);
    if (m) fastMs = m[1] ? parseInt(m[1], 10) : 250;
  } catch (e) {}

  function play(script, options) {
    var lines = normalize(script);
    if (fastMs > 0) options = assign(assign({}, options || {}), { instant: true, autoAdvance: true, autoMs: fastMs });
    chain = chain.then(function () {
      if (!lines.length) return Promise.resolve();
      return run(lines, options || {});
    });
    return chain;
  }

  function run(lines, options) {
    return new Promise(function (resolve) {
      // レース放送中(race_run)はVNの立ち絵を被せない＝レースは画面内テロップで実況する。
      // 直前(出走時)に保留されたセリフがレース開始後に出てしまうのを防ぐ。{force:true}で例外可。
      if (typeof state !== "undefined" && state && state.ui && state.ui.screen === "race_run" && !(options && options.force)) { resolve(); return; }
      queue = lines; idx = 0; opts = options; resolveFn = resolve;
      var d = ensureDom();
      // 立ち絵スロット初期化
      ["left", "right"].forEach(function (s) {
        var sl = d.slots[s]; sl.id = null; sl.expr = null; sl.has = false;
        sl.wrap.classList.remove("active", "dim", "has", "in");
      });
      d.overlay.classList.remove("hidden");
      document.addEventListener("keydown", onKey, true);
      step();
    });
  }

  function step() {
    var d = dom, line = queue[idx];
    if (!line) { finish(); return; }
    var c = castOf(line.s);

    if (line.bg) setBg(line.bg);   // ★場面（背景）は行から切替可能

    // 立ち絵：話者の側に表示。ナレーションは両方暗転＋名前なし。
    var side = line.side || (c.side === "right" ? "right" : "left");
    if (c.narrator) {
      dim("left"); dim("right");
      d.name.style.display = "none";
      d.name.textContent = "";
    } else {
      setSlot(side, line.s, chooseExpr(line, c), c);
      activate(side);
      d.name.style.display = c.name ? "" : "none";
      d.name.textContent = c.name || "";
      d.name.style.setProperty("--cg", c.color || "#caa24a");
      // ★感情アニメ（fx: shake/hop/nod/flash）＝話者の立ち絵imgに一発アニメ。reduced-motionでは無効。
      //   fx無指定の行でも前回のfxクラスを必ず除去（残留すると呼吸アニメが止まるため）。
      var fim = d.slots[side].img;
      fim.classList.remove("fx-shake", "fx-hop", "fx-nod", "fx-flash");
      if (line.fx && !REDUCE) { void fim.offsetWidth; fim.classList.add("fx-" + line.fx); }
    }
    d.box.style.setProperty("--cg", c.color || "#caa24a") ;

    // ★効果音：se: 明示 > fx の自動対応（FX_SE）。Sfx未ロードでも安全。
    var se = line.se || (line.fx && FX_SE[line.fx]);
    if (se && global.Sfx && Sfx.play) { try { Sfx.play(se); } catch (e) {} }

    startType(line.t, line);
  }

  function setSlot(side, id, expr, c) {
    var sl = dom.slots[side];
    id = resolveId(id);
    var sameOccupant = (sl.id === id && sl.expr === (expr || null));
    sl.id = id; sl.expr = expr || null; sl.has = true;
    sl.wrap.classList.add("has");
    sl.wrap.style.setProperty("--cg", c.color || "#caa24a");
    if (sameOccupant) return; // 同一話者連続なら絵を差し替えない（再フェード回避）
    loadInto(sl, imgChain(id, expr), c.symbol);
    if (!REDUCE) { sl.wrap.classList.remove("in"); void sl.wrap.offsetWidth; sl.wrap.classList.add("in"); }
  }

  function loadInto(sl, list, sym) {
    var i = 0, img = sl.img, symEl = sl.sym;
    function tryNext() {
      if (i >= list.length) { img.style.display = "none"; symEl.textContent = sym || "💬"; symEl.style.display = ""; sl.wrap.classList.remove("sil"); return; }
      // ★エントリは 文字列 or {src, sil:true}。sil＝シルエット表示（例: 伏線お姉さん＝celestia を暗く落として正体を隠す）
      var entry = list[i], src = (typeof entry === "object" && entry) ? entry.src : entry, sil = !!(entry && entry.sil);
      img.style.display = ""; symEl.style.display = "none";
      img.onerror = function () { i++; tryNext(); };
      img.onload = function () { sl.wrap.classList.toggle("sil", sil); };
      img.src = src;
    }
    tryNext();
  }

  function activate(side) {
    var other = side === "left" ? "right" : "left";
    var a = dom.slots[side], b = dom.slots[other];
    a.wrap.classList.add("active"); a.wrap.classList.remove("dim");
    if (b.has) { b.wrap.classList.add("dim"); b.wrap.classList.remove("active"); }
  }
  function dim(side) {
    var sl = dom.slots[side];
    if (sl.has) { sl.wrap.classList.add("dim"); sl.wrap.classList.remove("active"); }
  }

  // タイプライタ表示
  var autoTimer = 0;
  function startType(t, line) {
    var d = dom;
    // ★インラインの間：{w:600} をテキスト中に書くと、その位置で600msの溜め（表示テキストからは除去）。
    var waits = {}, buf = "", srcT = String(t), reW = /\{w:(\d+)\}/g, lastW = 0, mW;
    while ((mW = reW.exec(srcT))) {
      buf += srcT.slice(lastW, mW.index);
      waits[buf.length] = (waits[buf.length] || 0) + (parseInt(mW[1], 10) || 0);
      lastW = mW.index + mW[0].length;
    }
    buf += srcT.slice(lastW);
    full = buf; shown = 0; typing = true;
    clearTimeout(autoTimer);
    d.next.style.visibility = "hidden";
    var lineWait = (line && line.w) || 0;   // 行末の間（次行送り前ではなく▼表示までの溜め）
    if (REDUCE || opts.instant) { d.text.textContent = full; typing = false; d.next.style.visibility = "visible"; maybeAuto(); return; }
    d.text.textContent = "";
    clearTimeout(typeTimer);
    var speed = opts.speed || 22;
    (function tick() {
      if (!typing) return;
      shown++;
      d.text.textContent = full.slice(0, shown);
      if (shown % 3 === 0 && global.Sfx && Sfx.play && !opts.silent) { try { Sfx.play("tick"); } catch (e) {} }   // タイプ音（3文字ごと・小さく）
      if (shown >= full.length) {
        typing = false;
        setTimeout(function () { if (!typing) { d.next.style.visibility = "visible"; maybeAuto(); } }, lineWait);
        return;
      }
      typeTimer = setTimeout(tick, speed + (waits[shown] || 0));   // ★{w:ms} の位置で溜める
    })();
  }

  // ★オート送り（opts.autoAdvance=true）：読み切りサイズに応じて自動で次へ。手動タップでキャンセルされない設計
  //   （advance が呼ばれたら次行の startType が autoTimer をクリアする）。
  function maybeAuto() {
    if (!opts.autoAdvance) return;
    clearTimeout(autoTimer);
    // ★検証用の早送りでは autoMs で待ち時間を上書きできる（既定は読み切りサイズに応じた自然な間）。
    var wait = (opts.autoMs != null) ? opts.autoMs : (900 + full.length * 42);
    autoTimer = setTimeout(function () { if (queue && !typing) advance(); }, wait);
  }

  function advance() {
    if (typing) { // タイプ中なら一気に表示
      typing = false; clearTimeout(typeTimer);
      dom.text.textContent = full; dom.next.style.visibility = "visible"; maybeAuto();
      return;
    }
    clearTimeout(autoTimer);
    idx++;
    if (idx >= queue.length) finish();
    else step();
  }

  function skipAll() {
    typing = false; clearTimeout(typeTimer);
    finish();
  }

  function finish() {
    typing = false; clearTimeout(typeTimer); clearTimeout(autoTimer);
    clearBg();   // ★背景は台本ごと＝次の無関係な会話に前の場面を持ち越さない
    if (dom) dom.overlay.classList.add("hidden");
    document.removeEventListener("keydown", onKey, true);
    var r = resolveFn; resolveFn = null; queue = null;
    if (r) r();
  }

  function onKey(ev) {
    if (!dom || dom.overlay.classList.contains("hidden")) return;
    if (ev.key === "Enter" || ev.key === " " || ev.key === "ArrowRight") { ev.preventDefault(); ev.stopPropagation(); advance(); }
    else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); skipAll(); }
  }

  /* ===== small helpers ===== */
  function assign(a, b) { if (b) for (var k in b) if (b[k] !== undefined) a[k] = b[k]; return a; }
  function uniq(arr) { var s = {}, o = []; for (var i = 0; i < arr.length; i++) { if (arr[i] && !s[arr[i]]) { s[arr[i]] = 1; o.push(arr[i]); } } return o; }

  /* =====================================================================
     5) 公開API
     ===================================================================== */
  var Dialogue = {
    play: play,                       // play(台本 or 台本ID, {instant,speed,mood,auto}) → Promise
    register: function (id, script) { SCRIPTS[id] = script; return this; },
    registerCast: function (id, def) { id = resolveId(id); RUNTIME_CAST[id] = assign(RUNTIME_CAST[id] || {}, def); return this; },
    alias: function (from, to) { ALIAS[from] = to; return this; },
    castOf: castOf,
    scripts: SCRIPTS,
    EXPRS: EXPRS,                     // 利用可能な表情リスト
    inferExpr: inferExpr,             // 文面→表情の推定（②表情差分）
    isOpen: function () { return !!(dom && !dom.overlay.classList.contains("hidden")); },
    dismiss: function () { try { finish(); } catch (e) {} },   // 開いているセリフを閉じる（レース開始時など）
    // 検証用：セリフは通常どおり描画したまま、クリックを待たず自動で先へ進める。
    //   ★「出さない」ではなく「早送り」にする。消す作りにするとVN自体を
    //     検証できなくなるため（一度その実装をして中身を確認する手段を失った）。
    //   setFast(true)=1行250ms / setFast(120)=120ms / setFast(false)=通常。?vnfast=1 でも可。
    setFast: function (v) { fastMs = (v === true) ? 250 : (v ? (+v || 250) : 0); },
    isFast: function () { return fastMs > 0; },
    demo: function () { return play("demo"); }
  };
  global.Dialogue = Dialogue;

})(window);
