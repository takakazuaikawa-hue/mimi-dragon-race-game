// =============================================================================
// audit_facts.js — 「画面に出る事実」がコードとズレていないかの監査
// =============================================================================
// 使い方:  node tools/audit_facts.js        （リポジトリのルートで）
//
// ★なぜ要るか（実測）
//   「モール探検専用のメダル・かけら」という説明文が残っていたが、メダルという通貨は
//   コードのどこにも存在しなかった（実際は 🪙G/🎟️チケット/✨評判、しかも衣装はコイン購入）。
//   同様に「資産＝コイン＋村＋施設＋暮らし＋名声＋竜」の説明は、islandValue を足した後も
//   古いまま残っていた。**文章の中に事実を直書きすると、コードを変えても文章は黙って古びる。**
//
// ★この監査で拾えるもの / 拾えないもの
//   拾える : 参照しているのに存在しないアセット、読み書きの噛み合わないフラグ
//   拾えない: 「300枚」のような裸の数字がどの定数を指しているか（機械には判断不能）
//   → だから**根治は監査ではなく「定数から文を生成する」**こと。この監査は保険。
//
// ★誤検知をなくすために必要だったこと（最初の素朴版は7件中6件が誤検知だった）
//   ①コメントを除外する      … 使用例のパス（images/cast/rival.png）を実参照と誤認した
//   ②動的キーを理解する      … setStoryFlag("_chapter_intro_" + id) を見落として永久ロック扱いした
//   ③ラッパー関数を追う      … _seFlag(...) 経由の読み取りを見落とした
// =============================================================================

const fs = require("fs");
const path = require("path");

const JS_DIR = "js";
// ★キーは必ず "js/xxx.js"（スラッシュ）で持つ。path.join だと Windows で "js\xxx.js" になり、
//   下の RULES の照合が静かに全部すり抜ける（実際に一度それで全件誤検知した）。
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith(".js")).map(f => JS_DIR + "/" + f);

// ── コメントと文字列の分離 ───────────────────────────────────────────────
// 行コメント・ブロックコメントを空白に潰す。文字列の中の // を消さないよう、
// 素朴に走査する（テンプレートリテラルもまとめて文字列として扱う）。
function stripComments(src) {
  let out = "", i = 0, n = src.length;
  let inS = null, inLine = false, inBlock = false;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (inLine) { if (c === "\n") { inLine = false; out += c; } else out += " "; i++; continue; }
    if (inBlock) { if (c === "*" && c2 === "/") { inBlock = false; out += "  "; i += 2; } else { out += (c === "\n" ? c : " "); i++; } continue; }
    if (inS) {
      out += c;
      if (c === "\\") { out += (c2 || ""); i += 2; continue; }
      if (c === inS) inS = null;
      i++; continue;
    }
    if (c === "/" && c2 === "/") { inLine = true; i += 2; out += "  "; continue; }
    if (c === "/" && c2 === "*") { inBlock = true; i += 2; out += "  "; continue; }
    if (c === '"' || c === "'" || c === "`") { inS = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

const code = new Map();   // file -> コメントを除いたソース
for (const f of files) code.set(f, stripComments(fs.readFileSync(f, "utf8")));

let problems = 0;
const say = (s) => console.log(s);
const bad = (s) => { problems++; console.log("  ✗ " + s); };

// ── ① アセット参照 ─────────────────────────────────────────────────────
say("── ① 参照しているのに存在しないファイル ──");
{
  const refs = new Map();
  const re = /["'`](images\/[^"'`\s]+\.(?:webp|png|jpg|jpeg|svg)|bgm\/[^"'`\s]+\.mp3)["'`]/g;
  for (const [f, s] of code) for (const m of s.matchAll(re)) {
    if (!refs.has(m[1])) refs.set(m[1], new Set());
    refs.get(m[1]).add(path.basename(f));
  }
  let miss = 0, dyn = 0;
  for (const [p, where] of [...refs].sort()) {
    if (p.indexOf("${") >= 0) { dyn++; continue; }   // ★テンプレートリテラルは実行時にしか決まらない＝対象外
    if (!fs.existsSync(p)) { bad(p + "   ← " + [...where].join(", ")); miss++; }
  }
  say("  静的参照 " + (refs.size - dyn) + " 種類 / 欠落 " + miss + (miss ? "" : "  ✓") + "（動的パス " + dyn + " 件は対象外）");
}

// ── ② 物語フラグ ───────────────────────────────────────────────────────
say("");
say("── ② フラグの読み書き ──");
{
  // ラッパー: 引数をそのまま getStoryFlag/setStoryFlag に渡す関数名を自動収集する。
  const wrapRead = new Set(["getStoryFlag"]), wrapWrite = new Set(["setStoryFlag"]);
  for (const [, s] of code) {
    for (const m of s.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[^}]{0,200}?getStoryFlag\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) wrapRead.add(m[1]);
    for (const m of s.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[^}]{0,200}?setStoryFlag\s*\(\s*([A-Za-z_$][\w$]*)\s*,/g)) wrapWrite.add(m[1]);
  }
  const litRe = (names) => new RegExp("(?:" + [...names].join("|") + ")\\s*\\(\\s*[\"']([^\"']+)[\"']", "g");
  // 動的キー（"_prefix_" + x）は「族」として扱う＝その接頭辞で始まるキーは相手側も存在するとみなす
  const dynRe = (names) => new RegExp("(?:" + [...names].join("|") + ")\\s*\\(\\s*[\"']([^\"']+)[\"']\\s*\\+", "g");

  const read = new Map(), write = new Map(), readPre = new Set(), writePre = new Set();
  for (const [f, s] of code) {
    for (const m of s.matchAll(litRe(wrapRead)))  { if (!read.has(m[1])) read.set(m[1], new Set()); read.get(m[1]).add(path.basename(f)); }
    for (const m of s.matchAll(litRe(wrapWrite))) { if (!write.has(m[1])) write.set(m[1], new Set()); write.get(m[1]).add(path.basename(f)); }
    for (const m of s.matchAll(dynRe(wrapRead)))  readPre.add(m[1]);
    for (const m of s.matchAll(dynRe(wrapWrite))) writePre.add(m[1]);
    // ★①フラグ名を**引数で受け取るヘルパ**への実引数（例 _playPoroFollowup(script, "poroMizuSceneSeen")）
    //   ②state.player.flags.X = true という**直接代入**（例 firstWideHit）
    //   どちらも setStoryFlag を通らないので、上の走査だけでは「立てていない」に見えてしまう。
    for (const m of s.matchAll(/\bflags\s*\.\s*([A-Za-z_$][\w$]*)\s*=[^=]/g)) { if (!write.has(m[1])) write.set(m[1], new Set()); write.get(m[1]).add(path.basename(f) + "(直接代入)"); }
    for (const m of s.matchAll(/\bflags\s*\[\s*["']([^"']+)["']\s*\]\s*=[^=]/g)) { if (!write.has(m[1])) write.set(m[1], new Set()); write.get(m[1]).add(path.basename(f) + "(直接代入)"); }
    // ★直接読み取りも対称に拾う。書き込みだけ見て読み取りを見ないと、
    //   f.sakeGiftSeen のように直接読まれるフラグを「死にフラグ」と誤検知する（実際した）。
    //   flags を経由しない短縮参照（const f = p.flags; f.xxx）も拾えるよう、既知のキーで再走査する。
    for (const m of s.matchAll(/\bflags\s*\.\s*([A-Za-z_$][\w$]*)\b(?!\s*=[^=])/g)) { if (!read.has(m[1])) read.set(m[1], new Set()); read.get(m[1]).add(path.basename(f) + "(直接参照)"); }
  }
  // フラグ名が「データ表の値」や「ヘルパの実引数」として現れていれば、書き手がいるとみなす。
  // （名前だけの出現でも、読み取り箇所以外に現れるなら結線されている可能性が高い＝fail-open にする。
  //   ここを厳しくすると誤検知が増えて、監査そのものが信用されなくなる。）
  const mentionedElsewhere = (k) => {
    for (const [f, s] of code) {
      const re = new RegExp("[\"']" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\"']", "g");
      for (const m of s.matchAll(re)) {
        const before = s.slice(Math.max(0, m.index - 40), m.index);
        if (!/(?:getStoryFlag|_seFlag|_gFlag|_poroSeen|_scoutChap|_snsFlag)\s*\(\s*$/.test(before)) return path.basename(f);
      }
    }
    return null;
  };
  const coveredBy = (k, pres) => [...pres].some(p => k.startsWith(p));

  const neverSet = [...read.keys()].filter(k => !write.has(k) && !coveredBy(k, writePre)).sort();
  const neverRead = [...write.keys()].filter(k => !read.has(k) && !coveredBy(k, readPre)).sort();

  say("  ラッパー(読) " + [...wrapRead].join(", "));
  say("  ラッパー(書) " + [...wrapWrite].join(", "));
  if (readPre.size || writePre.size) say("  動的キーの接頭辞 " + [...new Set([...readPre, ...writePre])].join(", "));
  if (!neverSet.length) say("  読むが誰も立てないフラグ: 0  ✓");
  neverSet.forEach(k => {
    const via = mentionedElsewhere(k);
    if (via) say("  … " + k + " は " + via + " に実引数/データとして出現（結線ありとみなす）");
    else bad("永久ロックの疑い（読むだけ）: " + k + "   ← " + [...read.get(k)].join(", "));
  });
  if (!neverRead.length) say("  立てるが誰も読まないフラグ: 0  ✓");
  neverRead.forEach(k => {
    // 短縮参照（const f = p.flags; ... f.xxx）は上の正規表現では拾えないので、キー名で最終確認する。
    let via = null;
    for (const [f2, s2] of code) {
      const re = new RegExp("\\.\\s*" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b(?!\\s*=[^=])", "g");
      if (re.test(s2)) { via = path.basename(f2); break; }
    }
    if (via) say("  … " + k + " は " + via + " で直接参照されている（結線ありとみなす）");
    else bad("死にフラグ（立てるだけ）: " + k + "   → " + [...write.get(k)].join(", "));
  });
}

// ── ③ 画面の文章に直書きされた事実（人力で宣言した分だけ照合）──────────
say("");
say("── ③ 説明文と定数の一致 ──");
{
  // 「この文言が出るなら、この値も同じ画面に出ているはず」という弱い検査。
  // ★根治は「定数から文を生成する」こと。ここは書き忘れの保険。
  const RULES = [
    { file: "js/ui_render.js", must: "assetPartsLabel", why: "お金のしくみの資産内訳は ASSET_PARTS から生成する" },
    { file: "js/ui_render.js", must: "RESCUE_COINS",    why: "救済の説明は RESCUE_COINS から生成する" },
    { file: "js/ui_assets.js", must: "assetPartsOf",    why: "資産の内訳バーは ASSET_PARTS から引く" }
  ];
  for (const r of RULES) {
    const s = code.get(r.file) || "";
    if (s.indexOf(r.must) < 0) bad(r.file + " に " + r.must + " が無い — " + r.why);
  }
  // 直書きが復活していないかの見張り（既知の地雷ワード）
  const BANNED = [
    { file: "js/ui_render.js", word: "メダル・かけら", why: "存在しない通貨。モールは 🪙G/🎟️チケット/✨評判" }
  ];
  for (const b of BANNED) {
    const s = fs.readFileSync(b.file, "utf8");
    if (s.indexOf(b.word) >= 0) bad(b.file + " に「" + b.word + "」が復活している — " + b.why);
  }
  if (!problems) say("  ✓");
}

say("");
say(problems ? ("結果: " + problems + " 件の指摘") : "結果: 問題なし ✓");
process.exit(problems ? 1 : 0);
