/**
 * utils.js — module-free shared helpers.
 *
 * Pure utility functions used across engines, data, and UI. Keep this file
 * dependency-free so any other module can rely on it without ordering issues.
 *
 * EXTENSION POINT: add new small helpers here rather than duplicating them
 * across engines.
 */

// ===== Numeric helpers =====
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randRange(min, max) { return min + Math.random() * (max - min); }

// Weighted sum of stats by a {statName: weight} map. Used by course/weather
// engines to score a dragon against a section profile.
function weightedStat(stats, weights) {
  let s = 0;
  for (const k in weights) s += (stats[k] || 0) * weights[k];
  return s;
}

// ===== Display helpers =====
/**
 * 0–100 stat value → S/A/B/C/D/E rank per spec §03 §3.2.
 * EXTENSION POINT: adjust thresholds if a future expansion needs finer ranks.
 */
function statRank(v) {
  if (v >= 90) return "S";
  if (v >= 75) return "A";
  if (v >= 60) return "B";
  if (v >= 45) return "C";
  if (v >= 30) return "D";
  return "E";
}

/**
 * Coin formatter (§08 §15). Comma-formats < 10,000; uses Japanese
 * large-number units (万/億/兆/京) above that.
 */
function fmtCoins(n) {
  if (typeof n !== "number") return String(n);
  const abs = Math.abs(n);
  if (abs < 10000) return n.toLocaleString("ja-JP");
  const sign = n < 0 ? "-" : "";
  const units = [
    { v: 1e16, u: "京" },
    { v: 1e12, u: "兆" },
    { v: 1e8,  u: "億" },
    { v: 1e4,  u: "万" }
  ];
  for (const { v, u } of units) {
    if (abs >= v) {
      const num = abs / v;
      const display = num >= 100
        ? Math.floor(num).toLocaleString("ja-JP")
        : num.toFixed(2).replace(/\.?0+$/, "");
      return `${sign}${display}${u}`;
    }
  }
  return sign + Math.floor(abs).toLocaleString("ja-JP");
}

// ===== DOM helpers (used only after document is ready) =====
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
