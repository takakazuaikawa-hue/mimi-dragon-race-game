// =========================================================================
// rival.js — 「あの竜に負けた」を次のレースへ持ち越す（C-4リベンジ／C-2図鑑導線）
// =========================================================================
// 正本: docs/CORE_LOOP_UX_BRIEF.md（C-4「次への渇望」の未実装ぶん）
//
// ★着手前の実測（指示書を鵜呑みにしない＝[[research-before-asserting]]）：
//   ・C-1「着順発表のタメ」は **既に実装済み**だった。ゴールの瞬間に写真判定の静止1拍
//     （`S.photoT` / `timeline.photoFinish`・race_canvas.js）が入り、ラベルも描画される。
//     さらに3着→2着→1着の“順出し”は、**レースを見ている以上そもそも起きている**
//     （crossings ごとに「N着」がフロートする）。結果を見た後に伏せて出し直すのは
//     偽のタメになるので作らない。
//   ・C-4 の `state.player.rival` は grep で1件も無く、**本当に未実装**だった。ここを作る。
//
// ★設計の芯：**負けた相手に名前を与える**。「今日は流れに乗れなかった」で終わらせず、
//   誰に負けたかを覚えて、その竜が次に出てきたときに ⚔️ を出す。
//   人は「次も走る」より「あいつがまた居る」で戻ってくる。
//
// ★表示専用の徹底＝レースの着順・オッズ・配当・FinalPower には一切触れない。
//   ライバルが居ても出走表の中身も確率も変わらない。**印が付くだけ**。
// ★オオカミ少年にしない：古い遺恨は RIVAL_TTL 走で自然に消える（いつまでも
//   ⚔️ が付き続けると意味が薄れる）。
// =========================================================================

const RIVAL_TTL = 12;   // この走数を過ぎたら遺恨は流す

function _rvP() { try { return state.player || {}; } catch (e) { return {}; } }
function _rvRaces() { try { return _rvP().completedRaces || 0; } catch (e) { return 0; } }

// いま生きているライバル（期限切れは null＝表示もされない）
function rivalGet() {
  try {
    const r = _rvP().rival;
    if (!r || !r.id) return null;
    if (_rvRaces() - (r.at || 0) > RIVAL_TTL) return null;
    return r;
  } catch (e) { return null; }
}
function rivalIs(id) { const r = rivalGet(); return !!(r && r.id === id); }
function rivalClear() { try { if (_rvP().rival) delete state.player.rival; } catch (e) {} }

// ── 「自分を負かした竜」を1頭に決める ────────────────────────────────
// ★ここが体験の質を決める。**単に1着を返さない**。
//   単勝で2着だったなら憎いのは1着だが、複勝で4着だったなら憎いのは“3着に入った竜”＝
//   自分を締め出した最後の1頭。ボーダーの竜を返すのが自然な恨み方になる。
function rivalPickFrom(c) {
  try {
    const myId = c && c.bet && c.bet.selections && c.bet.selections[0];
    const ordered = c && c.raceResult && c.raceResult.entries;
    if (!myId || !ordered || !ordered.length) return null;
    const myIdx = ordered.findIndex(e => e.dragon.id === myId);
    if (myIdx < 0) return null;
    const need = (c.bet.type === "win") ? 1 : 3;      // 何着以内が必要だったか
    if (myIdx + 1 <= need) return null;               // 当たっている＝恨む相手は居ない
    const border = ordered[need - 1];                 // 自分を締め出した最後の1頭
    const d = (border && border.dragon) || (ordered[0] && ordered[0].dragon);
    return d || null;
  } catch (e) { return null; }
}

// ── 結果画面から1回だけ呼ぶ（記録＋リベンジ成立の判定）──────────────
// 戻り値 { revenged: bool, name } … revenged=true の時だけ「借りを返した」を出す。
// ★二重計上を防ぐのは呼び元（c._rivalScored）。ここは素直に実行する。
function rivalSettle(c, hit) {
  const out = { revenged: false, name: "" };
  try {
    const prev = rivalGet();
    // ① この一戦にライバルが出走していて、かつ的中した＝借りを返した
    if (prev && hit) {
      const ran = (c.raceResult.entries || []).some(e => e.dragon.id === prev.id);
      if (ran) { out.revenged = true; out.name = prev.name; rivalClear(); return out; }
    }
    // ② 外した＝負かした相手を（上書きで）覚える
    if (!hit) {
      const d = rivalPickFrom(c);
      if (d) state.player.rival = { id: d.id, name: d.name, at: _rvRaces() };
    }
  } catch (e) {}
  return out;
}

// 出走表に出す印（該当しなければ空文字＝何も足さない）
function rivalTagHtml(id) {
  return rivalIs(id) ? `<span class="bp-rival" title="前に自分を負かした竜">⚔️ リベンジ</span>` : "";
}

if (typeof window !== "undefined") {
  window.rivalGet = rivalGet; window.rivalIs = rivalIs; window.rivalSettle = rivalSettle;
  window.rivalTagHtml = rivalTagHtml; window.rivalPickFrom = rivalPickFrom;
}
