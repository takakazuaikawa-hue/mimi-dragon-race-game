// =========================================================================
// celebrate.js — 🎉 祝祭と触覚（S5・2026-08-03）
// =========================================================================
// リサーチの結論（Knights Chronicle の分解ほか）：商業のスマホゲームは「受け取る」瞬間に
// **紙吹雪・閃光・ファンファーレ**を重ねる＝多層フィードバック。本作は音17種が既にあるのに
// 視覚の祝祭がゼロ・触覚もゼロだった（実測）。ここを埋める。
//
// ★不可侵：レースの着順・オッズ・配当・FinalPower には一切触らない。完全に表示専用。
// ★作法：
//   ・DOMは1回のバーストにつき数十個で、終わったら必ず自分で消える（残骸を残さない）
//   ・pointer-events none／z-index はオーバーレイ(120)より下・粒(40)より上＝45
//   ・prefers-reduced-motion では粒を出さない（音と触覚だけ）
//   ・触覚は navigator.vibrate（非対応端末では黙って何もしない）。長い振動は使わない
// =========================================================================

var CB_KINDS = {
  // kind: 粒の数・色・広がり・振動の型
  win:    { n: 34, colors: ["#ffd877", "#ffe6a8", "#fff4e0", "#e6b24a"], spread: 1.0,  buzz: [18, 40, 26] },
  big:    { n: 56, colors: ["#ffd877", "#ffb14d", "#fff4e0", "#ff7a3a", "#e6b24a"], spread: 1.25, buzz: [24, 50, 34, 50, 24] },
  reward: { n: 26, colors: ["#ffd877", "#ffe6a8", "#9fe0b8"], spread: .9,  buzz: [14, 34, 20] },
  grant:  { n: 22, colors: ["#9fe0b8", "#ffd877", "#e8f5ec"], spread: .85, buzz: [12, 30] }
};

function _cbReduce() {
  try { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

// 触覚：対応端末だけ。ユーザーが音量を切っていても振動は別物なので独立して出す。
function celebrateBuzz(kind) {
  try {
    var k = CB_KINDS[kind] || CB_KINDS.reward;
    if (navigator && typeof navigator.vibrate === "function") navigator.vibrate(k.buzz);
  } catch (e) {}
}

// 祝祭のバースト。origin＝{x,y}（画面座標）。省略時は画面中央のやや上。
function celebrate(kind, origin) {
  try {
    celebrateBuzz(kind);
    if (_cbReduce()) return;
    var k = CB_KINDS[kind] || CB_KINDS.reward;
    var ox = (origin && origin.x != null) ? origin.x : window.innerWidth / 2;
    var oy = (origin && origin.y != null) ? origin.y : window.innerHeight * 0.42;

    var layer = document.createElement("div");
    layer.className = "cb-layer";
    for (var i = 0; i < k.n; i++) {
      var p = document.createElement("i");
      p.className = "cb-p";
      // 上向き扇形にばらまく（真横や真下には飛ばさない＝紙吹雪らしい弧を描かせる）
      var ang = (-90 + (Math.random() * 150 - 75)) * Math.PI / 180;
      var pow = (90 + Math.random() * 190) * k.spread;
      p.style.setProperty("--dx", (Math.cos(ang) * pow).toFixed(1) + "px");
      p.style.setProperty("--dy", (Math.sin(ang) * pow).toFixed(1) + "px");
      p.style.setProperty("--rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
      p.style.setProperty("--dur", (760 + Math.random() * 520).toFixed(0) + "ms");
      p.style.setProperty("--delay", (Math.random() * 90).toFixed(0) + "ms");
      p.style.background = k.colors[(Math.random() * k.colors.length) | 0];
      var w = 4 + Math.random() * 5;
      p.style.width = w.toFixed(1) + "px";
      p.style.height = (w * (0.5 + Math.random() * 1.1)).toFixed(1) + "px";
      p.style.left = ox + "px";
      p.style.top = oy + "px";
      layer.appendChild(p);
    }
    // 閃光は「大穴」だけ＝毎回光らせると安っぽくなる
    if (kind === "big") {
      var fl = document.createElement("div");
      fl.className = "cb-flash";
      layer.appendChild(fl);
    }
    document.body.appendChild(layer);
    setTimeout(function () { try { layer.remove(); } catch (e) {} }, 1700);
  } catch (e) {}
}

// 要素の中心から祝う（受け取りボタン等・押した場所から飛ぶと因果が見える）
function celebrateFrom(el, kind) {
  try {
    if (!el) { celebrate(kind); return; }
    var r = el.getBoundingClientRect();
    celebrate(kind, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  } catch (e) { celebrate(kind); }
}

if (typeof window !== "undefined") {
  window.celebrate = celebrate;
  window.celebrateFrom = celebrateFrom;
  window.celebrateBuzz = celebrateBuzz;
}
