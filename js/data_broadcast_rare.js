// =============================================================================
// data_broadcast_rare.js — 解説者のレア台詞と、レースを跨ぐ決め台詞
// =============================================================================
// ★なぜ分けるか
//   汎用行（data_broadcast_lines.js）は「毎レース出る」ことが前提で、
//   摩耗しないように味を抑えてある。対してここに置くのは
//   「滅多に出ない条件でだけ出る、その解説者にしか言えない一言」。
//   出やすくすると即座に摩耗するので、封印回数で守る。
//
// ★2種類ある（運用が正反対なので混ぜない）
//   rare  … 一度出たら SEAL レース封印。出るたび新鮮。
//   fixed … 封印しない。厳格な条件でだけ出て、一字も変えない。
//           繰り返し出会うことで「来た！」が育つのが目的（決め台詞）。
//
// ★条件(when)は宣言だけで書く。関数を持たせない。
//   データだけで完結していれば、監査が全レースぶん機械で確かめられる。
//   使える鍵（すべて A.drama の値と突き合わせる）:
//     headline    … 決着の見出し（bigUpset/comeback/photo/warOfAttrition/
//                    upset/perfect/dominant/hardFought/solid）の配列
//     margin      … 着差（nose/neck/half/body/big）の配列
//     popRankMin  … 何番人気以上の伏兵か（例 6 なら6番人気以下の勝ち）
//     comebackMin … 何番手から巻き返したか
//     leadChgMin  … 先頭が何回替わったか
//     wire        … true なら逃げ切りのときだけ
//
// ★語りの決まり（汎用行と同じ。ここでも破らない）
//   ・解説は讃える人。自分の見立ての採点をしない。
//   ・レース中・決着とも、賭けの当たり外れには触れない。
//   ・毒舌には必ずねぎらいをセットにする（スミカ）。
// =============================================================================

// 一度出たら何レース封印するか
const BC_RARE_SEAL = 30;

const BC_RARE = [
  // ── サケ（竜使い・気配と呼吸・わし）─────────────────────────
  { id: "sake_comeback", cm: "sake", when: { comebackMin: 4 },
    line: "後ろにいる間、あいつは息を殺しとった。……ずっと待っとったんじゃ、この一瞬を。" },
  { id: "sake_nose", cm: "sake", when: { margin: ["nose"] },
    line: "最後は肺の強さじゃ。あの最後のひと息が、他とは違うとった。" },
  // ★条件に "big"（大差）を使わないこと。着差の目盛り上は存在するが、
  //   レース側がそこまで開くことが実際には無く（300レース測って0本）、
  //   big を待つ台詞は永久に出ない。実際に開く上限は "body"（一体）。
  { id: "sake_wire", cm: "sake", when: { wire: true, margin: ["body"] },
    line: "前に出てから一度も呼吸が乱れとらん。竜使いとして、これは惚れる走りじゃ。" },

  // ── ミズ（市場の女・倍率と確率・あたくし）────────────────────
  { id: "mizu_bigupset", cm: "mizu", when: { popRankMin: 6 },
    line: "市場が丸ごと外れた日ですわ。……あはん、こういう日があるから面白いのよ。" },
  { id: "mizu_nose", cm: "mizu", when: { margin: ["nose"] },
    line: "この一完歩に、どれだけの計算が乗っていたか。……数字では書けない場所ね。" },
  { id: "mizu_war", cm: "mizu", when: { leadChgMin: 4 },
    line: "先頭が入れ替わるたび、値が付け直されていたわ。生きた相場そのものね。" },

  // ── スミカ（家政婦・金と消耗・私。毒のあとに必ずねぎらい）──────
  { id: "sumika_comeback", cm: "sumika", when: { comebackMin: 4 },
    line: "あれだけ脚を使って、よく保ちました。……ええ、本当によく頑張りました。" },
  { id: "sumika_war", cm: "sumika", when: { leadChgMin: 4 },
    line: "全頭ぶんの消耗を思うと、後片付けが目に浮かびます。……皆さま、お疲れさまでした。" },
  { id: "sumika_nose", cm: "sumika", when: { margin: ["nose"] },
    line: "この差に、あれだけの日々が要るのですね。……いえ、二頭ともねぎらいたい。" },

  // ── マクラ（配信者・熱と観客・オレ）────────────────────────
  { id: "makura_bigupset", cm: "makura", when: { popRankMin: 6 },
    line: "うわ、うわ、うわ！ 今の見た!? 見たよね!? オレ今日のこと一生言うわ！" },
  { id: "makura_comeback", cm: "makura", when: { comebackMin: 4 },
    line: "後ろから、後ろから来たって！ こんなん声出るって！ 出るに決まってるって！" },
  { id: "makura_nose", cm: "makura", when: { margin: ["nose"] },
    line: "ちょ、待って、待って、今の……無理、語彙が、語彙が消えた。すご。" },

  // ── セレスティア（神話スケール・俯瞰・我）───────────────────
  { id: "celestia_wire", cm: "celestia", when: { wire: true },
    line: "先頭を守り続けるというのは、ずっと風に削られ続けるということ。……よく耐えたこと。" },
  { id: "celestia_bigupset", cm: "celestia", when: { popRankMin: 6 },
    line: "誰も名を呼ばなかった一頭が、今日の名前になったのね。……そういう日を、我は好むわ。" },
  { id: "celestia_war", cm: "celestia", when: { leadChgMin: 4 },
    line: "何度も入れ替わって、それでも終わりは一つ。……今日も、きちんと決まったのね。" },

  // ── ウンメ（既知感と運・わたくし）─────────────────────────
  { id: "unme_comeback", cm: "unme", when: { comebackMin: 4 },
    line: "後ろにいる時点でこうなる運命だったんですよぉ。……いや今考えました。知らんけど！" },
  { id: "unme_bigupset", cm: "unme", when: { popRankMin: 6 },
    line: "こういう日が来るって言ってましたっけ? 言ってない? まあ来たので良しとしましょ！" },
  { id: "unme_wire", cm: "unme", when: { wire: true, margin: ["body"] },
    line: "最初から最後まで運を離さないの、いちばん難しいんですからね。ほんとに。" }
];

// ── レースを跨ぐ決め台詞 ────────────────────────────────────
// ★封印しない。条件が厳しいので自然と滅多に出ない。
//   出るたび一字も変えないことで「またこれだ」という手応えが育つ。
//   増やしすぎると効かなくなるので、2人ぶんだけに留めてある。
const BC_CATCHPHRASE = [
  // ★仕様書は「スミカ＝大差決着限定」としていたが、大差(big)はレース側で
  //   一度も起きない（300レース測って0本）ので、実際に開く上限の
  //   一体(body)差で、しかも逃げ切ったときに限る。条件の厳しさは保てる。
  { id: "sumika_fixed_rout", cm: "sumika", when: { margin: ["body"], wire: true },
    line: "……危なげのない、良い勝ち方でございました。今夜は少し良いお肉を出します。" },
  { id: "unme_fixed_nose", cm: "unme", when: { margin: ["nose"] },
    line: "はい、鼻先ぃ！ こういうのを運命って言うんですよぉ。わたくし、詳しいので！" }
];

// ── 封印の台帳 ──────────────────────────────────────────────
// state.player.bcRare = { n: 通算レース数, used: { レア台詞id: 使った時の n } }
// ★壊れていても絶対に落とさない。読めなければ「封印なし」に倒す。
//   台詞が出すぎることはあっても、レースが止まることは無い方が良い。
//   保存済みデータに bcRare が無い状態（今までの全プレイヤー）が
//   そのまま「まだ何も使っていない」として通るので、移行処理は要らない。
function bcRareLedger() {
  try {
    const p = (typeof state !== "undefined" && state && state.player) ? state.player : null;
    if (!p) return { n: 0, used: {}, save: null };
    let L = p.bcRare;
    if (!L || typeof L !== "object" || typeof L.n !== "number" ||
        !L.used || typeof L.used !== "object") {
      L = { n: 0, used: {} };
      p.bcRare = L;
    }
    return { n: L.n, used: L.used, save: L };
  } catch (e) {
    return { n: 0, used: {}, save: null };
  }
}

// そのレースで出せるレア台詞・決め台詞を1本選ぶ（無ければ null）。
// ★決め台詞を優先する。封印されないぶん条件が厳しく、出会えたら必ず見せたい。
function bcRarePick(cmKey, dm) {
  if (!cmKey || !dm) return null;
  try {
    const L = bcRareLedger();
    const fixed = BC_CATCHPHRASE.filter(r => r.cm === cmKey && bcRareMatch(r.when, dm));
    if (fixed.length) return { rec: fixed[0], fixed: true };
    const open = BC_RARE.filter(r => {
      if (r.cm !== cmKey || !bcRareMatch(r.when, dm)) return false;
      const at = L.used[r.id];
      return (at == null) || (L.n - at >= BC_RARE_SEAL);   // 封印が明けている
    });
    if (!open.length) return null;
    // 同じ条件で複数あるときは、いちばん長く使っていないものから
    open.sort((a, b) => (L.used[a.id] == null ? -1 : L.used[a.id]) -
                        (L.used[b.id] == null ? -1 : L.used[b.id]));
    return { rec: open[0], fixed: false };
  } catch (e) { return null; }
}

// レースを1本数える。★封印は「レース数」で数えるので、
//   レア台詞を使ったときではなく、レースを組み立てるたびに1つ進める。
//   ここを使用時に進めると「30レース封印」ではなく
//   「レア台詞を30本使うまで封印」になってしまう。
function bcRareTick() {
  try {
    const L = bcRareLedger();
    if (!L.save) return 0;
    L.save.n = (L.save.n || 0) + 1;
    // 台帳が太らないように、封印がとうに明けたぶんは捨てる
    Object.keys(L.save.used).forEach(k => {
      if (L.save.n - L.save.used[k] >= BC_RARE_SEAL * 2) delete L.save.used[k];
    });
    return L.save.n;
  } catch (e) { return 0; }
}

// 使ったことを記録する。★決め台詞は封印しないので記録しない。
function bcRareMark(id, fixed) {
  if (!id || fixed) return;
  try {
    const L = bcRareLedger();
    if (!L.save) return;
    L.save.used[id] = L.save.n || 0;
  } catch (e) { /* 記録に失敗しても進行は止めない */ }
}

// 条件（when）と、そのレースの決着（A.drama）を突き合わせる。
// ★純関数。監査がそのまま呼べるようにしてある。
function bcRareMatch(when, dm) {
  if (!when || !dm) return false;
  if (when.headline && when.headline.indexOf(dm.headline) < 0) return false;
  if (when.margin && when.margin.indexOf(dm.marginKey) < 0) return false;
  if (when.popRankMin != null && !(dm.popRank >= when.popRankMin)) return false;
  if (when.comebackMin != null && !(dm.comeback >= when.comebackMin)) return false;
  if (when.leadChgMin != null && !(dm.leadChanges >= when.leadChgMin)) return false;
  if (when.wire === true && !dm.wire) return false;
  return true;
}
