// =============================================================================
// photo_game.js — 島めぐりの撮影ミニゲーム（構図3択 → シャッター → ☆評価）
// =============================================================================
// ★なぜ作るか（docs/MINIGAME_LEVELUP_DIRECTIVE.md §5.2）
//   島めぐりは「読む観光」だった。タップ＝自動達成で、選択も乱数も遊びも無い。
//   ここに「撮る旅」を入れる。着いたら構図を選び、シャッターの一瞬を狙う。
//   同じ場所が見頃で違う顔を見せ、☆3＝傑作はSNSで跳ねる。失敗状態は無い
//   （A Short Hike：☆1でも訪問・スタンプは成立。下手でも旅は続く）。
//
// ★遊びの骨格（2手＋結果）
//   1. 構図3択：同じ写真を〈引き / 寄り / ナナメ〉に切って見せ、その日の正解を選ぶ。
//      正解は日替わり（日付+spotIdハッシュ＝決定的）。ヒント＝ガイドの一言＋撮れるもの。
//   2. シャッター：閉じてくるフォーカスリングが基準リングに重なる瞬間にタップ。
//      ジャスト±130ms / グッド±300ms（スカウトのダンス scout_game.js と同じ手ざわり）。
//   3. ☆評価：基礎1＋構図正解1＋ジャスト1＝☆1〜3。見頃(time一致)なら グッド→ジャスト昇格。
//
// ★このファイルの約束
//   ・レースの着順/オッズ/配当には一切触らない（表示専用メタ）。
//   ・判定と抽選は純関数に切り出す（画面なしでNodeから検証できる＝tools/audit_photo_game.js）。
//   ・画面を離れたらループは必ず自分で止まる（固まると結果が出せなくなる）。
// =============================================================================

// ── 構図（3択）────────────────────────────────────────────────────────────
// key＝内部名／ja＝表示／crop＝サムネイルと本番の切り取り（CSS transform・新規画像は不要）。
var PG_ANGLES = [
  { key: "wide",  ja: "引き",   ic: "🏞", crop: "scale(1.0)" },
  { key: "tight", ja: "寄り",   ic: "🔍", crop: "scale(1.7)" },
  { key: "tilt",  ja: "ナナメ", ic: "🎞", crop: "scale(1.25) rotate(-6deg)" }
];

// ヒント文（正解アングルを“それとなく”示す。これを読めば当てられる＝当て要素になる）。
// 監査（audit_photo_game.js）：各アングルのセリフが、そのアングルを正しく示唆していること。
var PG_HINT_LINES = {
  wide:  ["今日は景色まるごと入れたい気分。", "広く引いて、空の広さまで見せたいな。", "余白が主役の日。ぜんぶ入れよう。"],
  tight: ["ぐっと寄って、細部を見せたい。", "今日は主役だけを大きく切り取ろう。", "近づいて、質感で勝負する日。"],
  tilt:  ["ちょっと斜めから狙うと粋かも。", "傾けて、動きを出したい日。", "定番を外して、斜めのリズムで。"]
};

// ── 難度の目盛り（数字はここに集約）──────────────────────────────────────
var PG_TUNE = {
  shutterMs: 1500,   // リングが閉じきる（＝基準に重なる）までの時間
  justMs: 130,       // ジャストの判定幅（前後）
  goodMs: 300,       // グッドの判定幅
  ringFrom: 2.6,     // 収縮リングの開始スケール
  ringTo: 0.35       // 閉じきりのスケール（基準リング=1.0 をこの間に通過する）
};

// ── 純関数（Nodeから検証可能）─────────────────────────────────────────────
function pgDayKey(d) {
  d = d || (typeof _pgToday === "function" ? _pgToday() : null);
  if (!d) { var n = new Date(); d = n.getFullYear() * 10000 + (n.getMonth() + 1) * 100 + n.getDate(); }
  return d;
}
// FNV-1a 風の決定的ハッシュ（日付+spotId→正解アングル）。
function pgAnswer(spotId, dayKey) {
  var s = String(spotId) + ":" + String(dayKey);
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return (h >>> 0) % PG_ANGLES.length;
}
// その日の正解と、ヒント一言。ヒントは必ず正解アングルを示すセリフを返す。
function pgHint(spotId, dayKey) {
  var ans = pgAnswer(spotId, dayKey);
  var angle = PG_ANGLES[ans];
  var lines = PG_HINT_LINES[angle.key];
  var h = ((dayKey >>> 0) ^ 0x9e3779b9) >>> 0;
  var line = lines[h % lines.length];
  return { ans: ans, angleKey: angle.key, angleJa: angle.ja, line: line };
}
// シャッターのタイミング判定（基準リングと重なった瞬間からのズレ）。
function pgJudgeShutter(deltaMs) {
  var a = Math.abs(deltaMs);
  if (a <= PG_TUNE.justMs) return { key: "just", label: "ジャスト！" };
  if (a <= PG_TUNE.goodMs) return { key: "good", label: "グッド" };
  return { key: "miss", label: "ぶれちゃった" };
}
// ☆評価（1〜3）。失敗状態は無い＝最低でも☆1。見頃ならグッド→ジャスト昇格。
function pgStars(o) {
  o = o || {};
  var shutter = o.shutterKey;
  if (o.inSeason && shutter === "good") shutter = "just";   // 見頃の一枚は、惜しくても“いい光”が拾う
  var s = 1;                                                 // 基礎（下手でも一枚は撮れる）
  if (o.composeOk) s++;                                      // 構図が正解
  if (shutter === "just") s++;                               // シャッターがジャスト
  return Math.max(1, Math.min(3, s));
}

// Node からも使えるように（検証用）
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PG_ANGLES: PG_ANGLES, PG_HINT_LINES: PG_HINT_LINES, PG_TUNE: PG_TUNE,
                     pgDayKey: pgDayKey, pgAnswer: pgAnswer, pgHint: pgHint,
                     pgJudgeShutter: pgJudgeShutter, pgStars: pgStars };
}

// =============================================================================
// ここから下は画面側。1枚のモーダルで 構図3択 → シャッター → 結果 を回す。
// =============================================================================
var _pgRun = null;   // 進行中の撮影（1つだけ）。閉じたら必ず止める。

function _pgNow() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

function pgStop() {
  if (_pgRun) {
    if (_pgRun.raf) { try { cancelAnimationFrame(_pgRun.raf); } catch (e) {} }
    _pgRun.dead = true;
    if (_pgRun.ov && _pgRun.ov.parentNode) _pgRun.ov.remove();
    _pgRun = null;
  }
}

// 撮影対象の見頃か（time と現在時間帯のゆるい一致）。
function pgInSeason(spot) {
  try {
    if (!spot || !spot.time || spot.time === "—") return false;
    var now = (typeof _kmIslandNow === "function") ? (_kmIslandNow().k || "") : "";
    var map = { "朝": ["朝", "早朝", "午前"], "昼": ["昼", "午前", "午後"], "夕暮れ": ["夕", "夕暮れ", "午後"],
                "宵": ["宵", "夜"], "夜": ["夜", "宵"], "未明": ["未明", "夜"] };
    var keys = map[now] || [now];
    for (var i = 0; i < keys.length; i++) { if (spot.time.indexOf(keys[i]) >= 0) return true; }
    return false;
  } catch (e) { return false; }
}

// 撮影で使うヒントのガイド（門番：未登場ならミミの直感にフォールバック）。
function _pgGuideName(spot) {
  try {
    var cat = spot.cat;
    var gid = (typeof KM_GUIDE !== "undefined") ? KM_GUIDE[cat] : null;
    if (gid && typeof advisorMet === "function" && advisorMet(gid) && typeof castNameSafe === "function") {
      return castNameSafe(gid);
    }
  } catch (e) {}
  return "ミミの直感";
}

// ── 撮影を開く ──────────────────────────────────────────────────────────
// spotId のスポットで撮影。onDone(stars, detail) を最後に呼ぶ（結線側が☆を記録）。
function pgOpen(spotId, onDone) {
  pgStop();
  var spot = (typeof KONRON_SPOTS !== "undefined") ? KONRON_SPOTS[spotId] : null;
  var src = spot && spot.photo;
  if (!spot || !src) { if (onDone) onDone(0, null); return; }

  var day = pgDayKey();
  var hint = pgHint(spotId, day);
  var inSeason = pgInSeason(spot);
  var guide = _pgGuideName(spot);
  var shootTx = (typeof _kmShootOf === "function") ? _kmShootOf(spotId, spot) : (spot.shoot || "");

  var ov = document.createElement("div");
  ov.className = "pg-modal";
  document.body.appendChild(ov);
  _pgRun = { ov: ov, spotId: spotId, dead: false, raf: 0, phase: "compose",
             composeOk: false, day: day, ans: hint.ans, inSeason: inSeason };

  // ─ フェーズ1：構図3択 ─
  function renderCompose() {
    if (_pgRun.dead) return;
    var thumbs = PG_ANGLES.map(function (a, i) {
      return '<button class="pg-thumb" data-i="' + i + '">' +
        '<span class="pg-thumb-crop"><img src="' + src + '" alt="" style="transform:' + a.crop + '"></span>' +
        '<span class="pg-thumb-lb">' + a.ic + ' ' + a.ja + '</span></button>';
    }).join("");
    ov.innerHTML =
      '<div class="pg-bd"></div>' +
      '<div class="pg-card">' +
        '<div class="pg-h"><b>📷 ' + spot.name + '</b><button class="pg-x" aria-label="やめる">✕</button></div>' +
        '<div class="pg-step">① どの構図で撮る？' + (inSeason ? '<span class="pg-season">🌟 いまが見頃</span>' : '') + '</div>' +
        '<div class="pg-hint"><span class="pg-hint-who">' + guide + '</span>「' + hint.line + '」</div>' +
        (shootTx && shootTx !== "—" ? '<div class="pg-shoot">📸 撮れるもの：' + shootTx + '</div>' : '') +
        '<div class="pg-thumbs">' + thumbs + '</div>';
    ov.querySelector(".pg-x").onclick = function () { pgStop(); if (onDone) onDone(0, null); };
    ov.querySelector(".pg-bd").onclick = function () { pgStop(); if (onDone) onDone(0, null); };
    ov.querySelectorAll(".pg-thumb").forEach(function (b) {
      b.onclick = function () {
        if (_pgRun.dead || _pgRun.phase !== "compose") return;
        var i = parseInt(b.getAttribute("data-i"), 10);
        _pgRun.composeOk = (i === _pgRun.ans);
        _pgRun.pickedAngle = PG_ANGLES[i];
        if (typeof Sfx !== "undefined" && Sfx.play) Sfx.play("tick");
        renderShutter();
      };
    });
  }

  // ─ フェーズ2：シャッタータイミング ─
  function renderShutter() {
    if (_pgRun.dead) return;
    _pgRun.phase = "shutter";
    var crop = (_pgRun.pickedAngle && _pgRun.pickedAngle.crop) || "scale(1.0)";
    ov.innerHTML =
      '<div class="pg-bd"></div>' +
      '<div class="pg-card">' +
        '<div class="pg-h"><b>📷 ' + spot.name + '</b><button class="pg-x" aria-label="やめる">✕</button></div>' +
        '<div class="pg-step">② シャッター！ 輪が重なった瞬間にタップ</div>' +
        '<div class="pg-view"><span class="pg-view-crop"><img src="' + src + '" alt="" style="transform:' + crop + '"></span>' +
          '<span class="pg-target"></span><span class="pg-ring" id="pg-ring"></span></div>' +
        '<button class="pg-shot" id="pg-shot">📸 いま！</button>';
    ov.querySelector(".pg-x").onclick = function () { pgStop(); if (onDone) onDone(0, null); };
    var ring = ov.querySelector("#pg-ring");
    var shot = ov.querySelector("#pg-shot");
    var start = _pgNow();
    // 基準リング(=1.0)に重なる時刻。scale(t)=from→to の線形で、1.0 を通る t を求める。
    var frac = (PG_TUNE.ringFrom - 1.0) / (PG_TUNE.ringFrom - PG_TUNE.ringTo);
    var targetT = start + PG_TUNE.shutterMs * frac;
    var fired = false;

    function tick() {
      if (_pgRun.dead) return;
      var t = _pgNow() - start;
      var p = Math.min(1, t / PG_TUNE.shutterMs);
      var sc = PG_TUNE.ringFrom + (PG_TUNE.ringTo - PG_TUNE.ringFrom) * p;
      ring.style.transform = "translate(-50%,-50%) scale(" + sc.toFixed(3) + ")";
      if (!fired && p >= 1) { fire(_pgNow()); return; }   // 押さずに閉じきった＝自動でぶれ判定
      _pgRun.raf = requestAnimationFrame(tick);
    }
    function fire(tapT) {
      if (fired || _pgRun.dead) return;
      fired = true;
      if (_pgRun.raf) { try { cancelAnimationFrame(_pgRun.raf); } catch (e) {} }
      var delta = tapT - targetT;
      var j = pgJudgeShutter(delta);
      var stars = pgStars({ composeOk: _pgRun.composeOk, shutterKey: j.key, inSeason: _pgRun.inSeason });
      if (typeof Sfx !== "undefined" && Sfx.play) Sfx.play(stars >= 3 ? "win" : "coin");
      renderResult(stars, j, delta);
    }
    shot.onclick = function () { fire(_pgNow()); };
    _pgRun.raf = requestAnimationFrame(tick);
  }

  // ─ 結果 ─
  function renderResult(stars, j, delta) {
    if (_pgRun.dead) return;
    _pgRun.phase = "result";
    var starStr = "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars);
    var masterpiece = stars >= 3;
    var seasonBumped = _pgRun.inSeason && j.key === "good";
    ov.innerHTML =
      '<div class="pg-bd"></div>' +
      '<div class="pg-card pg-result' + (masterpiece ? " pg-masterpiece" : "") + '">' +
        '<div class="pg-view sm"><span class="pg-view-crop"><img src="' + src + '" alt="" style="transform:' +
          ((_pgRun.pickedAngle && _pgRun.pickedAngle.crop) || "scale(1.0)") + '"></span></div>' +
        '<div class="pg-stars">' + starStr + '</div>' +
        '<div class="pg-verdict">' + (masterpiece ? "傑作！" : j.label) +
          (_pgRun.composeOk ? ' ・構図◎' : ' ・構図…') +
          (seasonBumped ? ' ・見頃で昇格🌟' : '') + '</div>' +
        (masterpiece ? '<div class="pg-mp-note">📣 ぴょこったーが沸いてる。載せてみる？</div>' : '') +
        '<div class="pg-result-bar">' +
          (masterpiece ? '<button class="pg-btn pg-btn--sns" data-act="sns">📣 SNSに載せる</button>' : '') +
          '<button class="pg-btn" data-act="retry">📷 撮り直す</button>' +
          '<button class="pg-btn pg-btn--ok" data-act="ok">これでいい</button>' +
        '</div>';
    var finish = function () {
      var st = stars;
      pgStop();
      if (onDone) onDone(st, { composeOk: _pgRun ? _pgRun.composeOk : false, shutterKey: j.key });
    };
    ov.querySelector('[data-act="ok"]').onclick = finish;
    ov.querySelector('[data-act="retry"]').onclick = function () {
      _pgRun.phase = "compose"; _pgRun.composeOk = false; _pgRun.pickedAngle = null;
      renderCompose();
    };
    var snsBtn = ov.querySelector('[data-act="sns"]');
    if (snsBtn) snsBtn.onclick = function () {
      // 傑作をSNSへ（既存の投稿フローを流用）。投稿後は☆を確定して閉じる。
      if (typeof _kmSnsCompose === "function") _kmSnsCompose(spotId, "photo");
      // ☆記録は閉じる時に。投稿モーダルは別レイヤなので、こちらはokと同じく確定。
    };
  }

  renderCompose();
}
