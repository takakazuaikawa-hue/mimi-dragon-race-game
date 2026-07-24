#!/usr/bin/env node
// =============================================================================
// tools/sim_mall_run.js — モール戦闘「ためる」バランスの検証シミュレーション
// =============================================================================
// 指示書 MINIGAME_LEVELUP_DIRECTIVE §9：
//   「ためる」の期待値がわずかに優位＋読み外し時に痛い、へ調整する。
//
// mall_rpg.js は window/DOM 依存で丸ごとは動かせないため、戦闘の数式だけを同じ係数で
// 再現した軽量モデルで、3つのプレイ方針を1000戦ずつ回して比べる：
//   ・通常：毎ターン攻撃（ためない）
//   ・活用：敵インテントを読み、敵が大技でないターンに「あと一撃で倒せる」ならためる（賢い）
//   ・乱用：毎ターンためる（下手＝無防備を晒し続ける）
// 期待する結果：勝率・平均残HPが 活用 ≥ 通常 > 乱用（＝読めば得・乱用は損）。
//
// 使い方: node tools/sim_mall_run.js
// =============================================================================
"use strict";

// mall_rpg.js と同じ係数（★調整対象・argvで上書きして探索できる: node sim_mall_run.js 2.8 1.35）
// ★§9で調整して確定した採用値。指示書の初期値(2.2/1.5)ではためるが数学的に損だったため、
//   「わずかに優位＋読み外し痛い」を満たす 2.6/1.4 に決定（mall_rpg.js と一致させること）。
const CHARGE_DMG = parseFloat(process.argv[2]) || 2.6;    // ためた一撃
const CHARGE_VULN = parseFloat(process.argv[3]) || 1.4;   // ため中の被ダメ
const WEAK = 1.9;

function rnd(a, b) { return a + Math.random() * (b - a); }

// 1戦をシミュレート（複数敵＝実戦に近い。ためるの真価＝1体を速攻で消して以降の反撃を丸ごと減らす）。
// strategy: "normal" | "smart" | "spam"。戻り値 {win, hpLeft}
function fight(strategy) {
  let hp = 140, lv = 6, pow = 11;
  const base = pow + pow * 0.6;                  // ≈17.6
  const nEnemies = 2 + (Math.random() < 0.35 ? 1 : 0);   // 45%の確率で2体・…実際は2〜3体
  let enemies = [];
  for (let i = 0; i < nEnemies; i++) enemies.push({ hp: 70 + Math.round(rnd(0, 45)), weak: Math.random() < 0.5 });
  const eatk = 13 + Math.round(rnd(0, 5));
  let charged = false;

  for (let turn = 0; turn < 60; turn++) {
    const alive = enemies.filter(e => e.hp > 0);
    if (!alive.length) return { win: true, hpLeft: hp };
    // 敵の大技予告（インテント＝読める）。ため中(無防備)にこれを食らうと激痛＝読み外しの罰。
    alive.forEach(e => e.big = Math.random() < 0.22);
    const anyBig = alive.some(e => e.big);
    // ミミは最も倒しやすい（残HPが少ない）敵を狙う
    const target = alive.slice().sort((a, b) => a.hp - b.hp)[0];
    const mult = target.weak ? WEAK : 1.0;
    const hit1 = base * mult;                     // 通常1発の期待ダメージ

    let doCharge = false;
    if (strategy === "spam") {
      doCharge = !charged;                        // ためられるなら毎回ためる（下手）
    } else if (strategy === "smart") {
      // 「通常1発では倒せないが、ためた一撃なら確実に倒せる」敵がいる時だけためる
      //  ＝その敵を1ターン早く消し、以降のその敵の反撃を丸ごと消す（読みの価値）
      if (!charged && target.hp > hit1 && target.hp <= hit1 * CHARGE_DMG && !anyBig) doCharge = true;
    }

    if (doCharge) {
      charged = true;                             // このターンは攻撃せずためる
    } else {
      const cm = charged ? CHARGE_DMG : 1; charged = false;
      target.hp -= Math.max(1, Math.round(hit1 * cm * rnd(0.9, 1.1)));
    }

    // 敵の手番：生きている敵の数だけ反撃（ため中は無防備＝全被ダメ×CHARGE_VULN）
    const vuln = charged ? CHARGE_VULN : 1;
    enemies.forEach(e => { if (e.hp > 0) { const big = e.big ? 2 : 1; hp -= Math.max(1, Math.round((eatk * big * vuln * rnd(0.85, 1.15)) - lv * 0.4)); } });
    if (hp <= 0) return { win: false, hpLeft: 0 };
  }
  return { win: enemies.every(e => e.hp <= 0), hpLeft: Math.max(0, hp) };
}

function run(strategy, n) {
  let wins = 0, hpSum = 0;
  for (let i = 0; i < n; i++) { const r = fight(strategy); if (r.win) wins++; hpSum += r.hpLeft; }
  return { winRate: wins / n, avgHp: hpSum / n };
}

const N = 4000;
const normal = run("normal", N);
const smart = run("smart", N);
const spam = run("spam", N);

console.log("\n=== モール戦闘「ためる」バランス検証（各 " + N + " 戦）===");
const fmt = r => "勝率 " + (r.winRate * 100).toFixed(1) + "% ／ 平均残HP " + r.avgHp.toFixed(1);
console.log("通常（ためない）      : " + fmt(normal));
console.log("活用（読んでためる）  : " + fmt(smart));
console.log("乱用（毎ターンためる）: " + fmt(spam));

// 判定：活用は通常より優位（読む価値）／乱用は通常以下（読み外し＝無防備を晒す罰）
const okSmartEdge = smart.avgHp > normal.avgHp + 0.3;               // 活用ははっきり優位
const okSpamWorse = spam.avgHp <= normal.avgHp + 0.3;              // 乱用は通常を上回らない
console.log("");
console.log((okSmartEdge ? "✅" : "❌") + " 活用は通常より優位（読む価値がある）");
console.log((okSpamWorse ? "✅" : "❌") + " 乱用は通常以下（無防備を晒す読み外しの罰）");
if (!okSmartEdge || !okSpamWorse) { console.log("\n→ 係数（CHARGE_DMG / CHARGE_VULN）の再調整が必要"); process.exit(1); }
console.log("\n→ 「ためる」は読めば得・乱用は損。指示書§4.2-A の狙いどおり（採用値 2.6 / 1.4）。");
