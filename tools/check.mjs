#!/usr/bin/env node
// =========================================================================
// tools/check.mjs — ビルド無しプロジェクトの軽量ガード（依存ゼロ・Node標準のみ）
//
//   実行:  node tools/check.mjs
//   目的:  「本番pushで即デプロイ」なので、壊れたコード/キャッシュ事故を出す前に拾う。
//
//   チェック内容:
//     1) 全 js（+ live2d/js）を `node --check` で構文検証
//     2) index.html の全 ?v= トークンが 1 種類に揃っているか（版数の割れ＝スマホ
//        キャッシュ事故の元。過去に 20260704q / 20260705-meals が混在した実績あり）
//     3) js/css/html に Git 競合マーカーが残っていないか
//     4) index.html の <script> 開閉タグ数が一致しているか
//
//   終了コード: 問題があれば 1（CI/フックからそのまま使える）。
// =========================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
let failures = 0;
const fail = (msg) => { failures++; console.error("  ✗ " + msg); };
const ok = (msg) => console.log("  ✓ " + msg);

// ---- 対象ファイル収集（node_modules等は無いが念のため .git は除外） ----
function walk(dir, exts, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, acc);
    else if (exts.includes(extname(name))) acc.push(p);
  }
  return acc;
}

// ---- 1) JS 構文チェック ----
console.log("1) JS 構文チェック (node --check)");
const jsFiles = walk(ROOT, [".js", ".mjs"]).filter(p => !p.includes("/tools/"));
let synErr = 0;
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { synErr++; fail(`構文NG: ${f.replace(ROOT + "/", "")}\n      ${String(e.stderr || e).split("\n")[0]}`); }
}
if (!synErr) ok(`${jsFiles.length} 個のJSすべて構文OK`);

// ---- 2) index.html の ?v= 一貫性 ----
console.log("2) index.html の ?v= 版数が揃っているか");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const vers = [...html.matchAll(/\?v=([0-9a-zA-Z-]+)/g)].map(m => m[1]);
const uniq = [...new Set(vers)];
if (vers.length === 0) fail("?v= が index.html に見つからない");
else if (uniq.length > 1) fail(`?v= が ${uniq.length} 種類に割れている: ${uniq.join(", ")}`);
else ok(`?v=${uniq[0]} で統一（${vers.length} 箇所）`);

// ---- 3) 競合マーカー ----
console.log("3) Git 競合マーカーの残存");
const srcFiles = walk(ROOT, [".js", ".css", ".html"]);
let conf = 0;
for (const f of srcFiles) {
  const txt = readFileSync(f, "utf8");
  if (/^(<{7}|={7}|>{7})/m.test(txt)) { conf++; fail(`競合マーカー残存: ${f.replace(ROOT + "/", "")}`); }
}
if (!conf) ok("競合マーカーなし");

// ---- 4) <script> タグ開閉 ----
console.log("4) index.html の <script> 開閉タグ数");
const open = (html.match(/<script[\s>]/g) || []).length;
const close = (html.match(/<\/script>/g) || []).length;
if (open !== close) fail(`<script> 開 ${open} / 閉 ${close} が不一致`);
else ok(`<script> 開閉ともに ${open}`);

// ---- 結果 ----
console.log("");
if (failures) { console.error(`❌ ${failures} 件の問題が見つかりました`); process.exit(1); }
console.log("✅ すべてのチェックを通過");
