#!/usr/bin/env node
// =============================================================================
// tools/audit_broadcast.js — 実況エンジンをNodeだけで検証する
// =============================================================================
// ★なぜこれが要るか
//   エンジン化の目的は「実機を触らずデータで確かめられること」。
//   ブラウザを立ち上げてクリックして確認していたのでは、その目的を果たせない。
//   ここは vanilla JS のスクリプト群（module化されていない）を、必要な分だけ
//   読み込んで実行する。ブラウザ固有のもの（document / localStorage / Audio）は
//   薄いスタブで埋める。ゲーム本体には一切手を入れない。
//
// 使い方:
//   node tools/audit_broadcast.js          … 60レースを検査
//   node tools/audit_broadcast.js 200      … 本数を指定
//   node tools/audit_broadcast.js 60 -v    … 違反の中身も出す
//
// EXTENSION POINT: 規則を足すときは RULES に1つ関数を足すだけ。
//   引数は { race, script, A, sec, call, color } の1つのオブジェクト。
// =============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const N = parseInt(process.argv[2], 10) || 60;
const VERBOSE = process.argv.includes("-v");

// ── ブラウザのふりをする最小限の器 ──────────────────────────────
// ★本物のDOMは要らない。エンジンは計算しかしないので、
//   「呼ばれても落ちない」ことだけ保証すればよい。
const noop = () => {};
const fakeEl = () => new Proxy({}, {
  get: (t, k) => (k === "style" || k === "dataset" || k === "classList")
    ? fakeEl() : (typeof k === "string" && k in t ? t[k] : noop),
  set: () => true
});
const sandbox = {
  console,
  window: {},
  document: {
    createElement: fakeEl, querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, addEventListener: noop, body: fakeEl(),
    documentElement: fakeEl()
  },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: "node", maxTouchPoints: 0 },
  location: { search: "", href: "" },
  Image: function () { return fakeEl(); },
  Audio: function () { return { play: () => Promise.resolve(), pause: noop, addEventListener: noop }; },
  requestAnimationFrame: noop, cancelAnimationFrame: noop,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop })
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// ── エンジンに要るファイルだけを読む ────────────────────────────
// ★index.html の順序どおり。UI・音・演出は読まない（要らないし、重い）。
const FILES = [
  "js/utils.js",
  "js/data_dragons.js", "js/data_courses.js", "js/data_weather.js",
  "js/data_ranks.js", "js/data_races.js", "js/data_dragons_ext.js",
  "js/race_engine.js", "js/odds_engine.js",
  "js/broadcast_engine.js",   // phaseScore（タイムラインが使う）
  "js/commentary_data.js",    // commentaryName
  "js/race_timeline_engine.js",
  "js/data_commentators.js",
  "js/race_broadcast.js", "js/data_broadcast_lines.js", "js/data_broadcast_rare.js",
  "js/data_broadcast_chatter.js"
];
// ★全ファイルを「1つのスクリプト」として評価する。
//   ファイルごとに実行すると、トップレベルの const / let が
//   グローバルに乗らず互いに見えない（window.state と同じ罠）。
//   本番の <script> 群と同じく、同一スコープに並べるのが正しい再現。
const loaded = [];
const parts = [
  // state はゲーム本体のものを使わず最小限を自前で用意する
  // （エンジンが読むのは図鑑の解禁状況くらい。無ければ安全側に倒れる作り）
  "var state = { player: { collection: {}, lastCommentator: null } };"
];
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error("見つからない: " + f); continue; }
  parts.push("\n//# " + f + "\n" + fs.readFileSync(p, "utf8"));
  loaded.push(f);
}
// 末尾で必要な記号だけを取り出す（同一スコープなので const も見える）
parts.push(`
;({
  RACES: typeof RACES !== "undefined" ? RACES : undefined,
  runRace: typeof runRace !== "undefined" ? runRace : undefined,
  simulateMarket: typeof simulateMarket !== "undefined" ? simulateMarket : undefined,
  buildRaceTimeline: typeof buildRaceTimeline !== "undefined" ? buildRaceTimeline : undefined,
  buildBroadcast: typeof buildBroadcast !== "undefined" ? buildBroadcast : undefined,
  bcEntrySchedule: typeof bcEntrySchedule !== "undefined" ? bcEntrySchedule : undefined,
  BC_RARE: typeof BC_RARE !== "undefined" ? BC_RARE : undefined,
  BC_CATCHPHRASE: typeof BC_CATCHPHRASE !== "undefined" ? BC_CATCHPHRASE : undefined,
  BC_RARE_SEAL: typeof BC_RARE_SEAL !== "undefined" ? BC_RARE_SEAL : undefined,
  BC_CHATTER: typeof BC_CHATTER !== "undefined" ? BC_CHATTER : undefined,
  BC_CHATTER_WINDOW: typeof BC_CHATTER_WINDOW !== "undefined" ? BC_CHATTER_WINDOW : undefined,
  BC_LINES: typeof BC_LINES !== "undefined" ? BC_LINES : undefined,
  RACE_COMMENTATORS: typeof RACE_COMMENTATORS !== "undefined" ? RACE_COMMENTATORS : undefined,
  commentaryName: typeof commentaryName !== "undefined" ? commentaryName : undefined
})`);

let S;
try {
  S = vm.runInContext(parts.join("\n"), sandbox, { filename: "audit-bundle.js" });
} catch (e) {
  console.error("読み込みで失敗: " + e.message);
  process.exit(1);
}
const need = ["RACES", "runRace", "simulateMarket", "buildRaceTimeline",
              "buildBroadcast", "bcEntrySchedule", "BC_LINES", "RACE_COMMENTATORS", "commentaryName"];
const missing = need.filter(k => typeof S[k] === "undefined");
if (missing.length) {
  console.error("必要なものが読めていない: " + missing.join(", "));
  process.exit(1);
}

// ── 規則（これまでユーザーからいただいた指摘を全部ここに置く）────
// ★1つの規則＝1つの関数。増やすときはここに足すだけ。
const RULES = [
  { key: "非日本語の混入", fn: c => {
      const m = c.text.match(/[Ѐ-ӿ가-힣]|[A-Za-z]{3,}/g);
      return m ? [...new Set(m)].join(",") : null; } },
  { key: "台詞の重複", fn: c => {
      const seen = {}, d = [];
      c.script.forEach(x => { const k = x.side + "|" + x.line;
        if (seen[k]) d.push(seen[k] + "→" + x.tag + " " + x.line.slice(0, 20));
        seen[k] = x.tag; });
      return d.length ? d[0] : null; } },
  { key: "序盤の並走描写", fn: c => {
      const t = c.script.filter(x => x.tau < 0.30).map(x => x.line).join("");
      return /並ん|雁行|譲らない/.test(t) ? "序盤に並走を語っている" : null; } },
  { key: "中盤の展開説明なし", fn: c =>
      c.script.some(x => x.tag === "shape" && x.tau >= 0.30 && x.tau <= 0.62)
        ? null : "上位が誰か示されないまま" },
  { key: "下位の入れ替わり", fn: c => {
      const low = c.call.filter(x => /[5-8]番手/.test(x.line) &&
        x.tag !== "cutin" && x.tag !== "goal");
      return low.length ? low[0].line : null; } },
  { key: "着差で締めている", fn: c => {
      const g = c.script.filter(x => x.tag === "goal" && x.side === "call");
      if (!g.length) return null;
      const last = g[g.length - 1].line;
      return /^(鼻先|首差|半身|一体|大差)/.test(last) && !/[！—]$/.test(last) ? last : null; } },
  { key: "決め台詞が遅い", fn: c => {
      const g = c.script.filter(x => x.tag === "goal");
      if (!g.length) return null;
      const late = (Math.max(...g.map(x => x.tau)) - c.A.decideTau) * c.sec;
      return late > 3.0 ? late.toFixed(1) + "秒遅れ" : null; } },
  { key: "無言が長い", fn: c => {
      // ★実機の流れに合わせて測る。台本のτをそのまま並べると測り漏らす：
      //   ・入場ぶんはパレード中に別の間合いで流れる（レース中の無言ではない）
      //   ・スタートの行はゲート開放の瞬間に発火する（台本のτ0.045ではなくτ=0）
      //   これを補正せずに測っていたため、発走直後の10.4秒の無言を
      //   「違反なし」と報告していた（ユーザーが体感で気づいた）。
      // ★スタートの行だけをτ=0へ動かすと、そこから次の行までが「無言」に見える。
      //   実際にはゲート開放の直後に発走直後の実況が続く。
      //   正しくは「ゲート開放を起点として、その後の行の間隔」を測ること。
      //   最初の実装はτ=0へ移すだけで並べ替えておらず、全レースで
      //   9.9秒の無言を誤検出していた（台本は埋まっているのに）。
      const ts = c.script
        .filter(x => x.tag !== "entry" && x.tag !== "countdown" && x.tag !== "start")
        .map(x => x.tau)
        .filter(t => t <= c.A.decideTau)
        .sort((a, b) => a - b);
      // ゲート開放（τ=0）から最初の実況までも測る
      if (ts.length) ts.unshift(0);
      let mx = 0, at = 0;
      for (let i = 1; i < ts.length; i++) {
        if (ts[i] - ts[i - 1] > mx) { mx = ts[i] - ts[i - 1]; at = ts[i - 1]; }
      }
      return mx * c.sec > 3.0
        ? (mx * c.sec).toFixed(1) + "秒 @τ" + at.toFixed(2) : null; } },
  // ★発走までの間合いを実機と同じ計算で測る。
  //   入場→カウントダウン→ゲート開放の継ぎ目は台本のτには現れないので、
  //   この規則が無かった間は実機を1分ずつ回して確かめるしかなかった。
  //   パレード尺(ENTRY_DUR)はコースで変わるので、短い場合と長い場合の
  //   両端で確かめる。
  { key: "発走前に無言がある", fn: c => {
      const ent = c.script.filter(x => x.tag === "entry");
      if (!ent.length) return null;
      for (const dur of [7, 10, 14, 18]) {
        const at = S.bcEntrySchedule(ent, dur);
        const ev = at.map((t, i) => ({ t, hold: Math.max(1.5, ent[i].line.length / 13 + 0.5) }));
        ev.push({ t: dur + 0.1, hold: 2 });     // カウントダウンの煽り
        ev.push({ t: dur + 3.0, hold: 1 });     // ゲート開放＝スタートの行
        ev.sort((a, b) => a.t - b.t);
        let mx = 0, prev = 0;
        for (const e of ev) { if (e.t - prev > mx) mx = e.t - prev; prev = Math.max(prev, e.t + e.hold); }
        if (mx > 3.0) return "パレード" + dur + "秒で" + mx.toFixed(1) + "秒の無言";
        const over = at[at.length - 1] > dur - 0.3;
        if (over) return "パレード" + dur + "秒で入場の行が発走にはみ出す";
      }
      return null; } },
  // ★解説が「誰がやっても同じ」になっていないか。
  //   ユーザーの指摘「解説はキャラごとの差異もちゃんと出てない」に対応する規則。
  //   BC_LINES の color は解説者キーごとの引き出しと、共通の受け皿 _ を持つ。
  //   _ ばかりが流れているなら、6人いる意味が無い。
  //   差し込み枠 {n} は何にでも化けるので、型に戻してから照合する。
  { key: "解説が誰でも同じ", fn: c => {
      if (!c.cmKey) return null;
      const B = S.BC_LINES;
      const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const toRe = t => new RegExp("^" + esc(t).replace(/\\\{[a-z0-9]+\\\}/g, ".+") + "$");
      let own = 0, gen = 0;
      const genTags = {};
      c.color.forEach(x => {
        let hit = "";
        for (const g of Object.keys(B)) for (const u of Object.keys(B[g])) {
          const co = B[g][u] && B[g][u].color; if (!co) continue;
          // ★prophecy は use のキー自体が解説者名（prophecy.sake のような形）。
          //   その場合は _ に入っていても「その人固有」なので、汎用に数えない。
          const own = (co[c.cmKey] || []).concat(u === c.cmKey ? (co._ || []) : []);
          if (own.some(t => toRe(t).test(x.line))) hit = "own";
          else if (hit !== "own" && (co._ || []).some(t => toRe(t).test(x.line))) hit = "gen";
        }
        if (hit === "own") own++;
        else if (hit === "gen") { gen++; genTags[x.tag] = (genTags[x.tag] || 0) + 1; }
      });
      const tot = own + gen;
      if (tot < 4) return null;
      const rate = own / tot;
      if (rate >= 0.80) return null;   // 実測90〜92%。落ちたら気づけるように締めてある
      const worst = Object.entries(genTags).sort((a, b) => b[1] - a[1])
        .slice(0, 3).map(x => x[0] + "×" + x[1]).join(" ");
      return "固有" + own + "／汎用" + gen + "（固有率" +
        Math.round(rate * 100) + "%）汎用が多い局面: " + worst; } },
  { key: "解説が相槌になっている", fn: c =>
      c.color.length > c.call.length * 0.75
        ? "実況" + c.call.length + "／解説" + c.color.length : null },
  { key: "決着で解説が自分語り", fn: c => {
      const gc = c.script.filter(x => x.tag === "goal" && x.side === "color");
      const bad = gc.filter(x => /見立て|読み|予想|わたしの|あたくしの/.test(x.line));
      return bad.length ? bad[0].line : null; } },
  { key: "空の行", fn: c => c.script.some(x => !x.line || !x.line.trim()) ? "空文字" : null },
  { key: "差し込み枠の未展開", fn: c => {
      const m = c.text.match(/\{\w+\}/g);
      return m ? [...new Set(m)].join(",") : null; } },
  { key: "賭け竜への言及", fn: c => {
      // ★エンジンに賭け情報を渡していないので構造上あり得ないが、
      //   将来うっかり戻したときに気づけるよう検査は残す。
      // ★「{n}、あなたは今日の主役よ」は竜への呼びかけ。違反ではない。
      //   プレイヤーの賭けを指す語だけを拾う。
      const m = c.text.match(/あなたの(一票|予想|賭け|竜)|賭け(た|金|竜)|的中|払戻/);
      return m ? m[0] : null; } }
];

// ── 構造の検査（台本ではなく実装そのものを見る）──────────────
// ★台本のデータ検査では拾えない種類の不具合がある。実際に2件出した：
//   ①視差背景を先読みしていなくて、走り出してから絵が差し替わる
//   ②山場の演出を親要素に掛けていて、画面全体が揺れる
//   どちらも「見れば分かるが、データには出ない」。だからコードの形を検査する。
//   再発したらここで落ちる。
function structureChecks() {
  const bad = [];
  const read = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return ""; } };
  const bc = read("js/race_broadcast.js");
  const css = read("style.css");

  // ①発走前に待つべきもの：竜スプライト・一枚絵背景・視差背景
  // ★「その名前が出てくるか」だけでは甘い。実際に呼んで待っているかを見る。
  //   （故意に壊す試験で、呼び出しを消しても素通りしたため厳しくした）
  const preloadBlock = (bc.match(/const preload = \(cb\) => \{[\s\S]*?\n  \};/) || [""])[0];
  const dragonBlock  = (bc.match(/const preloadDragons = \(cb\) => \{[\s\S]*?\n  \};/) || [""])[0];
  [[preloadBlock, /rcBgFor\s*\(/,        "一枚絵背景"],
   [preloadBlock, /rcParaFor\s*\(/,      "視差背景"],
   [dragonBlock,  /_rcDragonSprite\s*\(/, "竜スプライト"]]
    .forEach(([block, re, name]) => {
      if (!block) { bad.push("先読みの処理そのものが無い: " + name); return; }
      if (!re.test(block)) bad.push("発走前に待っていない: " + name);
    });

  // ②山場の演出は盤面だけに掛ける（親に掛けると画面全体が揺れる）
  const climax = css.match(/\.rc-wrap\.rc-climax[^{]*\{/g) || [];
  climax.forEach(sel => {
    if (!/\.rc-stage/.test(sel)) bad.push("山場の演出が盤面の外に及ぶ: " + sel.trim());
  });

  // ③解説者は1回だけ抽選する（2回引くと名前と台詞が別人になる）
  const canvas = read("js/race_canvas.js");
  const picks = (canvas.match(/pickCommentator\(/g) || []).length;
  if (picks > 1) bad.push("レース画面で解説者を複数回抽選している（" + picks + "回）");
  if (!canvas.includes("ctx.raceCommentator")) {
    bad.push("台本を書いたときの解説者を受け取っていない");
  }
  return bad;
}

// ── 実行 ────────────────────────────────────────────────────────
const fails = [];
const stats = [];
const rareSeq = [];   // レア台詞の封印はレースを跨ぐので、並び順に記録しておく
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const race = S.RACES[i % S.RACES.length];
  if (!race) break;
  let bc, tl, cmt;
  try {
    const rr = S.runRace(race);
    const or_ = S.simulateMarket(race);
    tl = S.buildRaceTimeline(race, rr, or_, null);
    cmt = S.RACE_COMMENTATORS[i % S.RACE_COMMENTATORS.length];
    bc = S.buildBroadcast(tl, { race, oddsResult: or_, raceResult: rr },
      { commentator: cmt, nameOf: id => S.commentaryName(id) });
  } catch (e) {
    fails.push({ race: race.id, rule: "組み立てで例外", detail: e.message });
    continue;
  }
  const ctx = {
    race, script: bc.script, A: bc.analysis,
    cmKey: cmt && cmt.key,
    sec: tl.durationSecHint,
    call: bc.script.filter(x => x.side === "call"),
    color: bc.script.filter(x => x.side === "color"),
    text: bc.script.map(x => x.line).join("\n")
  };
  RULES.forEach(r => {
    let d = null;
    try { d = r.fn(ctx); } catch (e) { d = "検査で例外: " + e.message; }
    if (d) fails.push({ race: race.id, caster: cmt && cmt.name, rule: r.key, detail: d });
  });
  stats.push({ 行: ctx.script.length, 実況: ctx.call.length, 解説: ctx.color.length,
               決着: bc.analysis.drama.headline });
  rareSeq.push({ cmKey: cmt && cmt.key,
                 call: ctx.call.map(x => x.line), color: ctx.color.map(x => x.line),
                 chat: bc.script.filter(x => x.tag === "chat" || (x.tag === "entry" && x.side === "color")).map(x => x.line),
                 goalColor: bc.script.filter(x => x.tag === "goal" && x.side === "color")
                              .map(x => x.line) });
}

// ── レア台詞の検査（レースを跨ぐので、規則ではなくここで見る）──────
// ★封印はレース1本ずつ数える約束。1レース内では確かめられない。
function rareChecks(seq) {
  const bad = [];
  const R = S.BC_RARE || [], C = S.BC_CATCHPHRASE || [];
  const byLine = {};
  R.forEach(r => byLine[r.line] = { id: r.id, fixed: false, cm: r.cm });
  C.forEach(r => byLine[r.line] = { id: r.id, fixed: true, cm: r.cm });
  const lastAt = {}, count = {};
  seq.forEach((s, i) => {
    const hit = s.goalColor.map(l => byLine[l]).filter(Boolean)[0];
    if (!hit) return;
    count[hit.id] = (count[hit.id] || 0) + 1;
    if (hit.cm !== s.cmKey) bad.push("担当外の解説者が喋った: " + hit.id + " を " + s.cmKey);
    if (!hit.fixed) {
      const prev = lastAt[hit.id];
      if (prev != null && i - prev < S.BC_RARE_SEAL)
        bad.push("封印が効いていない: " + hit.id + " が " + (i - prev) + "レース間隔で再出（" +
                 S.BC_RARE_SEAL + "レース封印のはず）");
      lastAt[hit.id] = i;
    }
  });
  // ★一度も出ない台詞＝書いた意味がない。
  //   実際に "big"（大差）を待つ台詞が3本、永久に出ない状態で入っていた
  //   （レース側が大差まで開かないため）。同じことを繰り返さないための検査。
  //   少ない本数では偶然出ないだけなので、300本以上のときだけ違反にする。
  const never = R.concat(C).filter(r => !count[r.id]).map(r => r.id);
  if (never.length && seq.length >= 300)
    bad.push("一度も出ないレア台詞がある（条件が現実に起きない疑い）: " + never.join(","));
  else if (never.length > R.concat(C).length * 0.5)
    bad.push("半分以上のレア台詞が一度も出ていない: " + never.join(",") + " ほか");
  const used = Object.values(count).reduce((a, b) => a + b, 0);
  console.log("■ レア台詞: " + seq.length + "レース中 " + used + "本発火（" +
    Object.keys(count).length + "種／全" + (R.length + C.length) + "種）" +
    (never.length ? " ／未発火 " + never.length + "種: " + never.join(",") : ""));
  return bad;
}
const rareBad = rareChecks(rareSeq);
rareBad.forEach(d => fails.push({ race: "(レア)", rule: "レア台詞の運用", detail: d }));

// ── 雑談・うんちくの検査 ──────────────────────────────────────
// ★ここは本数が多く、しかも人の手で書き足していく場所なので、
//   書いた端から機械が見る形にしておく。作法違反の混入が一番起きやすい。
function chatterChecks(seq) {
  const bad = [];
  const C = S.BC_CHATTER || [];
  const CM = ["sake", "mizu", "sumika", "makura", "celestia", "unme"];
  const REG = ["グランドクロック", "ルミナ", "リングロッソ", "カルデラ",
               "ミストレイク", "ヴェント峡谷", "ノッテムーンライト", "ラパン祭典"];
  if (!C.length) { console.log("■ 雑談: まだ1本も入っていない"); return bad; }

  const ids = {};
  C.forEach(r => {
    const at = "雑談[" + (r.id || "id無し") + "] ";
    if (!r.id) bad.push(at + "id が無い");
    else if (ids[r.id]) bad.push(at + "id が重複している");
    ids[r.id] = 1;
    if (CM.indexOf(r.cm) < 0) bad.push(at + "解説者キーが不正: " + r.cm);
    if (r.at !== "entry" && r.at !== "mid") bad.push(at + "出す場所が不正: " + r.at);
    const L = String(r.line || "");
    if (!L) bad.push(at + "台詞が空");
    if (L.length > 56) bad.push(at + "長すぎる（" + L.length + "文字）: " + L.slice(0, 20));
    if (/[Ѐ-ӿ가-힣]|[A-Za-z]{3,}/.test(L)) bad.push(at + "非日本語が混じっている: " + L.slice(0, 24));
    if (/\{|\}/.test(L)) bad.push(at + "差し込み枠は使えない: " + L.slice(0, 24));
    // ★賭けの話は禁止。レース中に賭けへ言及しない約束はここにも掛かる。
    if (/オッズ|配当|当た|外れ|人気|賭け|儲/.test(L))
      bad.push(at + "賭けに触れている: " + L.slice(0, 24));
    // ★展開の説明は実況の仕事。雑談枠が事実を語ると二重になる。
    // ★「抜い」だけを見ると「朝ごはんを抜いてきた」まで拾ってしまう。
    //   実況が使う語に絞る。広く網を張ると、正しい台詞を弾いて損をする。
    if (/先頭|追い上げ|追い抜|抜き去|番手|着差|逃げ切/.test(L))
      bad.push(at + "レース展開を説明している: " + L.slice(0, 24));
    if (r.region && !REG.some(x => r.region.indexOf(x) >= 0))
      bad.push(at + "知らない地域名: " + r.region);
  });

  // 実際にどれだけ出たか。出ないなら置いた意味がない。
  // ★声が崩れていないか。本数を増やすほど、ここが最初に壊れる。
  //   各人の口調の印が出ているか／他人の一人称を使っていないかを見る。
  // ★印は「その人らしさが1つでも出ているか」を見るためのもの。
  //   狭く書くと正しい台詞を弾く。丁寧語の「ます／いたします」や
  //   女性語尾の「〜わ。」を入れ忘れて、正しい43本を誤検出した。
  const VOICE = {
    sake:     { mark: /じゃ|のう|わし|とる|わい|でな|んじゃ/,
                ng: /あたくし|オレ|わたくし|ございます|ですよぉ/ },
    mizu:     { mark: /わ。|のよ|わね|かしら|あたくし|あはん|なさい|だけよ|のね/,
                ng: /わし|オレ|わたくし|ございます|じゃよ/ },
    sumika:   { mark: /ござい|ます|です|いたし|私|くださいませ/,
                ng: /わし|オレ|あたくし|知らんけど|じゃん/ },
    makura:   { mark: /じゃん|って|オレ|マジ|ヤバ|だよ|くない|んだ|すぎ/,
                ng: /わし|あたくし|わたくし|ございます|のじゃ/ },
    celestia: { mark: /のね|のよ|我|ふふ|こと。|なのよ/,
                ng: /わし|オレ|あたくし|わたくし|ございます/ },
    unme:     { mark: /です|ますぅ|わたくし|知らんけど|ましたぁ|ですって|ねぇ|よぉ/,
                ng: /わし|オレ|あたくし|ございます|じゃよ/ }
  };
  const noMark = {}, wrongVoice = [];
  C.forEach(r => {
    const v = VOICE[r.cm]; if (!v) return;
    const L = String(r.line || "");
    if (!v.mark.test(L)) noMark[r.cm] = (noMark[r.cm] || 0) + 1;
    if (v.ng.test(L)) wrongVoice.push(r.id + ": " + L.slice(0, 22));
  });
  wrongVoice.slice(0, 4).forEach(x => bad.push("他の解説者の口調が混じっている " + x));
  Object.keys(noMark).forEach(k => {
    const tot = C.filter(r => r.cm === k).length;
    // 3割を超えて口調の印が無いなら、その人らしさが薄れている
    if (noMark[k] > tot * 0.3)
      bad.push("口調の印が薄い: " + k + " の " + noMark[k] + "/" + tot + "本に語尾も一人称も出ていない");
  });

  // ★似すぎた台詞が無いか。数を追うと、言い回しだけ変えた重複が増える。
  //   二文字の並びをどれだけ共有しているかで測る（人手で読み比べるのは無理）。
  const bg = s => { const a = new Set(); for (let i = 0; i < s.length - 1; i++) a.add(s.substr(i, 2)); return a; };
  const grams = C.map(r => ({ id: r.id, cm: r.cm, line: r.line, g: bg(String(r.line || "")) }));
  const dup = [];
  for (let i = 0; i < grams.length; i++) for (let j = i + 1; j < grams.length; j++) {
    if (grams[i].cm !== grams[j].cm) continue;
    let share = 0;
    grams[i].g.forEach(x => { if (grams[j].g.has(x)) share++; });
    const r = share / Math.max(1, Math.min(grams[i].g.size, grams[j].g.size));
    if (r >= 0.62) dup.push(grams[i].id + " と " + grams[j].id + "（" + Math.round(r * 100) + "%一致）: " + grams[j].line.slice(0, 20));
  }
  dup.slice(0, 5).forEach(x => bad.push("台詞が似すぎている " + x));

  // ★数えるのは雑談として登録された行だけ。
  //   入場の解説行をまとめて数えていたため、1レース6行という
  //   実態とかけ離れた数字が出ていた（実際に置いた枠は2つ）。
  const lines = {};
  C.forEach(r => lines[r.line] = r.id);
  const used = {};
  seq.forEach(s => s.chat.forEach(l => { if (lines[l]) used[l] = (used[l] || 0) + 1; }));
  const fired = Object.keys(used).length;
  const per = seq.length ? (Object.values(used).reduce((a, b) => a + b, 0) / seq.length).toFixed(1) : 0;
  console.log("■ 雑談: 全" + C.length + "本中 " + fired + "種が発火（1レースあたり" + per + "行）");
  if (seq.length >= 60 && fired === 0)
    bad.push("雑談が1本も出ていない（枠が繋がっていない疑い）");

  // ★同じ話を続けて聞かされないこと。これが今回の眼目。
  let repeat = 0;
  for (let i = 1; i < seq.length; i++) {
    const prev = new Set(seq[i - 1].chat.filter(l => lines[l]));
    if (seq[i].chat.filter(l => lines[l]).some(l => prev.has(l))) repeat++;
  }
  if (seq.length > 10 && repeat > seq.length * 0.1)
    bad.push("連続するレースで雑談が繰り返されている: " + repeat + "/" + seq.length + "回");
  return bad;
}
// ── ★同じ解説者に再び当たったとき、どれだけ中身が変わるか ──────
// これがプレイヤーの「また同じだ」に直結する、いちばん大事な指標。
//
// ★以前は「連続する2レース」を比べて重複0%と報告していた。だが連続する
//   レースは担当者が違うので、違うことを言うのは当たり前で、あの数字は
//   何も証明していなかった。その誤った指標のせいで、実際には解説の45%が
//   前回と同じままなのに「解決した」と報告してしまった（ユーザーが実機で
//   「最初の一言が変わってるだけ」と気づいた）。
//   比べるべきは、同じ人が再び担当した回どうしである。
function sameCasterChecks(seq) {
  const bad = [];
  const BY = {};
  seq.forEach(s => { if (s.cmKey) (BY[s.cmKey] = BY[s.cmKey] || []).push(s); });
  let sumCall = 0, sumColor = 0, n = 0;
  Object.keys(BY).forEach(k => {
    const rs = BY[k]; if (rs.length < 2) return;
    let sc = 0, so = 0, m = 0;
    for (let i = 1; i < rs.length; i++) {
      const pc = new Set(rs[i - 1].call), po = new Set(rs[i - 1].color);
      sc += rs[i].call.filter(x => pc.has(x)).length / Math.max(1, rs[i].call.length);
      so += rs[i].color.filter(x => po.has(x)).length / Math.max(1, rs[i].color.length);
      m++;
    }
    sumCall += sc / m; sumColor += so / m; n++;
  });
  if (!n) return bad;
  const call = sumCall / n * 100, color = sumColor / n * 100;
  console.log("■ 同じ解説者の前回と比べて同じ台詞: 実況 " + call.toFixed(0) +
              "% ／ 解説 " + color.toFixed(0) + "%");
  if (color > 20) bad.push("解説が前回と " + color.toFixed(0) + "% 同じ（20%以下にすること）");
  if (call > 20) bad.push("実況が前回と " + call.toFixed(0) + "% 同じ（20%以下にすること）");
  return bad;
}
// ── ★プレイヤーの賭けに触れていないか ──────────────────────────
// ★この規則の範囲を一度取り違えた。
//   禁じられていたのは「オッズ・配当・人気という語」ではない。
//   それは賭けレースの実況そのもので、とくにミズの物差し（倍率と確率）は
//   6人の描き分けの根拠になっている。実際いちど全部消してしまい、
//   ミズを無味乾燥にした（ユーザーの指摘で復元）。
//
//   本当に禁じられているのは次の2つ：
//     ・プレイヤーが賭けた竜を主役として扱うこと
//       → これは ctx.bet をエンジンに渡さないことで構造的に防いである
//     ・解説者がゴールで自分の予想の当たり外れを採点すること
//       → 大写しになっているのは勝った竜であって、解説者ではない
function bettingWordCheck() {
  const bad = [];
  // 観客に向かって的中・不的中を語る形だけを弾く
  const RE = /あなたの(賭け|買っ)|お客さまの馬券|的中おめでとう|はずれ(ました|です)/;
  const B = S.BC_LINES || {};
  const K = ["sake", "mizu", "sumika", "makura", "celestia", "unme", "_"];
  Object.keys(B).forEach(g => Object.keys(B[g]).forEach(u => {
    const s = B[g][u];
    (s.call || []).forEach(l => { if (RE.test(l)) bad.push("実況 " + g + "." + u + ": " + l); });
    if (s.color) K.forEach(k => (s.color[k] || []).forEach(l => {
      if (RE.test(l)) bad.push("解説 " + g + "." + u + "[" + k + "]: " + l); }));
  }));
  (S.BC_RARE || []).concat(S.BC_CATCHPHRASE || []).forEach(r => {
    if (RE.test(r.line)) bad.push("レア " + r.id + ": " + r.line); });

  // ★決着の解説で、自分の見立ての採点をしていないか。
  //   大写しになっているのは勝った竜であって解説者ではない、というのが
  //   ユーザーの指示（「最後の決め台詞も自分の話をされても困る」）。
  const SELF = /予想が?(当た|外れ)|見立てが?(当た|外れ)|わたしの読み|言ったとおり|申し上げたとおり/;
  ["praise", "climax", "decide", "margin"].forEach(g => {
    const grp = B[g]; if (!grp) return;
    Object.keys(grp).forEach(u => {
      const co = grp[u].color; if (!co) return;
      K.forEach(k => (co[k] || []).forEach(l => {
        if (SELF.test(l)) bad.push("決着で自分語り " + g + "." + u + "[" + k + "]: " + l); }));
    });
  });
  return bad;
}
bettingWordCheck().forEach(d =>
  fails.push({ race: "(データ)", rule: "賭けへの言及", detail: d }));

const sameBad = sameCasterChecks(rareSeq);
sameBad.forEach(d => fails.push({ race: "(繰り返し)", rule: "同じ解説者の使い回し", detail: d }));

const chatBad = chatterChecks(rareSeq);
chatBad.forEach(d => fails.push({ race: "(雑談)", rule: "雑談の作法", detail: d }));

const structBad = structureChecks();
structBad.forEach(d => fails.push({ race: "(構造)", rule: "実装の形", detail: d }));
const ms = Date.now() - t0;
const byRule = {};
fails.forEach(f => { (byRule[f.rule] = byRule[f.rule] || []).push(f); });
const avg = k => stats.length
  ? +(stats.reduce((a, b) => a + b[k], 0) / stats.length).toFixed(1) : 0;

console.log("");
console.log("=== 実況エンジン 自己監査 ===");
console.log("読み込んだファイル: " + loaded.length + "本");
console.log("検査したレース    : " + stats.length + "本（" + ms + "ms）");
console.log("平均              : 行" + avg("行") + " ／ 実況" + avg("実況") + " ／ 解説" + avg("解説"));
const heads = stats.reduce((m, x) => { m[x.決着] = (m[x.決着] || 0) + 1; return m; }, {});
console.log("決着の内訳        : " + Object.keys(heads).map(k => k + "×" + heads[k]).join(" "));
console.log("");
if (!fails.length) {
  console.log("✅ 違反なし（" + RULES.length + "規則）");
} else {
  console.log("違反 " + fails.length + "件 / " + RULES.length + "規則");
  Object.keys(byRule).forEach(k => {
    console.log("  ❌ " + k + " ×" + byRule[k].length + "  例: " + byRule[k][0].detail);
    if (VERBOSE) byRule[k].slice(0, 5).forEach(f =>
      console.log("       " + f.race + " / " + (f.caster || "-") + " : " + f.detail));
  });
}
console.log("");
process.exit(fails.length ? 1 : 0);
