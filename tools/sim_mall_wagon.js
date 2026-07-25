#!/usr/bin/env node
// =============================================================================
// tools/sim_mall_wagon.js — 未精算ワゴン（プッシュ・ユア・ラック）のバランス検証
// =============================================================================
// 指示書 §4.2-B / §9：「精算派と積み増し派の期待値が拮抗し、積み増し派の分散が大きい」に調整する。
//   ＝どちらの遊び方でも平均リターンはほぼ同じ（人を一方に縛らない）が、
//     積み増しは当たれば大きく外せば全損＝ハイリスク・ハイリターン（射幸のスパイス）。
//
// mall_rpg.js と同じ係数（WAGON_MULT）と、階ごとの気絶率でモデル化。
//   ・各階で g_i ゴールドを稼ぎ、ワゴンに積む。
//   ・精算派：毎階、階段で必ず精算（積み増さない）＝稼いだぶんは確定。
//   ・積み増し派：屋上まで一度も精算せず、最後にまとめて受け取る（気絶したら全損）。
// 気絶率は上階ほど上がる想定。
//
// 使い方: node tools/sim_mall_wagon.js [WAGON_MULT] [基本気絶率]
// =============================================================================
"use strict";
// ★§9採用値：WAGON_MULT=1.3・気絶率0.07で「期待値拮抗＋積み増しは高分散」を確認（mall_rpg.jsと一致）。
const WAGON_MULT = parseFloat(process.argv[2]) || 1.3;
const BASE_KO = parseFloat(process.argv[3]) || 0.07;   // 1階あたりの気絶率の基準
const FLOORS = 8;                                       // 7階＋屋上
const N = 20000;

function rnd(a, b) { return a + Math.random() * (b - a); }
// 各階で稼ぐゴールド（上階ほど増える）
function floorGold(i) { return Math.round((40 + i * 25) * rnd(0.8, 1.2)); }
// 各階の気絶率（上階ほど危険）
function koChance(i) { return Math.min(0.5, BASE_KO + i * 0.03); }

// 精算派：各階で稼いだら即精算＝確定。気絶してもその階までの精算済みは残る（未精算は無いので損失0）。
function runCashOut() {
  let purse = 0;
  for (let i = 0; i < FLOORS; i++) {
    purse += floorGold(i);           // 稼いだ→即精算（確定）
    if (Math.random() < koChance(i)) return purse;   // 気絶しても精算済みは無事
  }
  return purse;
}
// 積み増し派：精算せず屋上まで積む。気絶したら全損。生還したら ×WAGON_MULT^(階数) が乗る。
function runPush() {
  let wagon = 0;
  for (let i = 0; i < FLOORS; i++) {
    wagon = Math.round((wagon + floorGold(i)) * WAGON_MULT);   // 稼いで積む→倍率
    if (Math.random() < koChance(i)) return 0;                 // 気絶＝全損
  }
  return wagon;
}

function stats(fn) {
  let sum = 0, sq = 0, zero = 0, mx = 0;
  for (let i = 0; i < N; i++) { const v = fn(); sum += v; sq += v * v; if (v === 0) zero++; if (v > mx) mx = v; }
  const mean = sum / N, varr = sq / N - mean * mean;
  return { mean, sd: Math.sqrt(Math.max(0, varr)), zeroRate: zero / N, max: mx };
}

const cash = stats(runCashOut);
const push = stats(runPush);

console.log("\n=== 未精算ワゴン バランス検証（WAGON_MULT=" + WAGON_MULT + " 基本気絶率=" + BASE_KO + " ／ " + N + "回）===");
const fmt = s => "平均 " + Math.round(s.mean) + "G ／ ばらつき(SD) " + Math.round(s.sd) + " ／ 全損率 " + (s.zeroRate * 100).toFixed(1) + "% ／ 最高 " + s.max + "G";
console.log("精算派（毎階レジへ）  : " + fmt(cash));
console.log("積み増し派（屋上まで）: " + fmt(push));

const ratio = push.mean / cash.mean;
const okParity = ratio >= 0.85 && ratio <= 1.15;        // 期待値が拮抗（±15%）
const okVariance = push.sd > cash.sd * 1.5;             // 積み増しは分散が大きい
const okThrill = push.zeroRate > 0.15 && push.max > cash.max;   // 全損もあるが上振れも大きい
console.log("");
console.log((okParity ? "✅" : "❌") + " 期待値が拮抗（積み増し/精算 = " + ratio.toFixed(2) + "・0.85〜1.15が目標）");
console.log((okVariance ? "✅" : "❌") + " 積み増し派の分散が大きい（SD " + Math.round(push.sd) + " > 精算 " + Math.round(cash.sd) + "×1.5）");
console.log((okThrill ? "✅" : "❌") + " ハイリスク・ハイリターン（全損率" + (push.zeroRate * 100).toFixed(0) + "%・上振れは精算派超え）");
if (!okParity || !okVariance || !okThrill) { console.log("\n→ WAGON_MULT か 気絶率カーブの再調整が必要"); process.exit(1); }
console.log("\n→ どちらの遊び方も平均は拮抗・積み増しはハイリスク。プッシュ・ユア・ラックとして健全（§9）。");
