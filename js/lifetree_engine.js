// =========================================================================
// §38 — 暮らしスキルツリー（くらしツリー）エンジン
// 「ばかばかしいけど真面目」な仕様：生活の方向ごとの枝（食・住まい・装い・移動&旅・
// 趣味&遊び・格&世界）に沿って、約200個の生活アップグレード（＝LIFE_MILESTONES）を
// レースで稼いだコインでひとつずつ買っていく。
//
// ★かつては「暮らしP」という専用ポイントで買う設計だったが、支払いをコイン一本に
//   統一した時点で暮らしPは残高が減らない飾りになったため、指標ごと廃止した。
//   ノードの cost は「コイン価格の係数」と「資産帯ゲートの段」として現役なので残す。
//
// 重要：完全に表示専用のメタ進行。コイン残高以外——着順・オッズ・配当・賭け経済には
//       一切干渉しない（HARD制約を厳守）。
//       解放はノードのフラグ（state.lifeTree.unlocked[title]=true）を立てるだけ。
// =========================================================================

// 6 本の枝（生活の方向）。色は style.css のティア配色と揃える。
const LIFE_BRANCHES = [
  { id: "food",   name: "食",          icon: "🍚", color: "#e0552e" },
  { id: "home",   name: "住まい",      icon: "🏠", color: "#49c89c" },
  { id: "attire", name: "装い",        icon: "👗", color: "#ec7fb9" },
  { id: "move",   name: "移動・旅",    icon: "🚗", color: "#57b1dd" },
  { id: "play",   name: "趣味・遊び",  icon: "🎉", color: "#e6b24a" },
  { id: "status", name: "格・世界",    icon: "👑", color: "#9a6ad0" }
];

// キーワード分類（食→住→装→移→遊 の順で判定、外れたら status へ）。
const LIFE_BRANCH_KEYWORDS = {
  food:   ["食べ物","ごちそう","食パン","缶詰","カップ麺","卵","おにぎり","のり弁","からあげ","ブランド米",
           "スイーツ","野菜","鍋","酒","コーヒー","食材","寿司","外食","シャンパン","高級店","ミシュラン",
           "ワイン","シェフ","朝食","レストラン","ブドウ","グルメ","ケーキ","紅茶","バー","フライパン"],
  home:   ["電気","電球","椅子","布団","部屋","一間","冷蔵庫","テレビ","ソファ","観葉植物","湯船","1K","1DK",
           "2LDK","3LDK","ベッド","洗濯機","プロジェクター","物件","庭","家具","別荘","豪邸","ビル","城",
           "引っ越","住む","屋敷","ペントハウス"],
  attire: ["トイレットペーパー","靴下","歯ブラシ","パンツ","石けん","手袋","上着","シャンプー","カミソリ",
           "クリーニング","美容院","スニーカー","デパコス","腕時計","バッグ","スーツ","宝飾","宝石","ドレス",
           "スタイリスト","普段使い","下着"],
  move:   ["自転車","旅行","温泉","マイカー","新幹線","飛行機","海外","リゾート","バカンス","ビジネスクラス",
           "新車","タクシー","車","ヘリ","ボート","クルーザー","スポーツカー","ジェット","ガレージ","運転手",
           "ヨット","客船","宇宙旅行","小旅行"],
  play:   ["ラジオ","イヤホン","ギガ","古本","趣味","ライブ","ゲーム","カメラ","猫","犬","ペット","家事代行",
           "エステ","料理教室","人間ドック","トレーナー","ゴルフ","アート","演奏","ポートレート","乗馬","映画",
           "馬主","動物園","サーキット","楽団","アトラクション","競走竜","牧場","掃除する余裕","チケット"]
  // status は明示キーワードを持たず、上のどれにも当たらない壮大・社交・人生系を受け止める。
};

// 個別の上書き（キーワードでは迷う・誤判定するものを手当て）。
const LIFE_BRANCH_OVERRIDE = {
  "缶コーヒーを飲み残せる": "status",   // 飲み残せる“余裕”の象徴 → 心・格
  "ブランド店員にビビらない": "status", // 自信・人付き合い → 格
  "値段を見ずにコンビニ会計": "status",
  "値段を見ずにスーパー": "status",
  "ビニール傘を即買いできる": "status",
  "誕生日に自分でケーキ": "food",
  "自宅にサウナ": "home",
  "サウナまで入れる": "attire",          // 銭湯のサウナ → 装い・身だしなみ枠
  "銭湯に行ける": "attire",
  "毎日湯船に浸かれる": "home",
  "本物の宝石を日常に": "attire",
  "美術品を集めだす": "status",
  "私設ギャラリーを開く": "status",
  "島のリゾートを貸し切り": "move",
  "別荘候補を見に行く": "home",
  "家族を旅行に連れて行く": "move",
  "趣味でアートを買う": "play",
  "ガレージにコレクション": "move",
  "週末に掃除する余裕": "play",
  "一流の演奏を特等席で": "play",
  "コインランドリーを使える": "attire",  // 洗濯 → 身だしなみ枠
  "まとめ買いができる": "food",
  "専用機を持つ": "move",
  "庭にアトラクション": "play"          // 庭(home)に誤吸着するのを遊びへ
};

function lifeBranchOf(title) {
  if (LIFE_BRANCH_OVERRIDE[title]) return LIFE_BRANCH_OVERRIDE[title];
  const order = ["food", "home", "attire", "move", "play"];
  for (let i = 0; i < order.length; i++) {
    const ks = LIFE_BRANCH_KEYWORDS[order[i]];
    for (let j = 0; j < ks.length; j++) if (title.indexOf(ks[j]) >= 0) return order[i];
  }
  return "status";
}

// 経済パラメータ（あとから調整しやすいよう定数に集約）。
// 序盤は枝の浅いノード（安い）を広く取れるが、深い“いい暮らし”はコスト増で取捨選択になる。
const LIFE_COST_STEP  = 6;   // 枝の中で何ノードごとにコストが+1されるか（深いほど高い＝コイン価格も上がる）

// ツリー本体：LIFE_MILESTONES を枝ごとに分け、枝内は総資産しきい値(at)順＝安い順に並べる。
// 各ノードに branch / pos / cost / nodeId を付与（共有オブジェクトを直接拡張）。
function lifeTierIndexOf(at) {
  let idx = 0;
  for (let i = 0; i < LIFE_TIERS.length; i++) { if (at >= LIFE_TIERS[i].min) idx = i; }
  return idx;   // 0..9（どん底..聖龍級）
}

// 手書きの“意味的”クロスリンク（あるスキルが前提のスキル）。値は前提ノードの title。
// しっかり関連を吟味：嗜好の深まり／自信→散財／乗り物の段階／愛好→大規模 など。
// すべて前提は本人より「下の段（安い）」を指す（循環しない）。
const LIFE_EXTRA_PREREQ = {
  // 食：味を知る → 設備 → 生産
  "ワインセラーを持つ": ["いいお酒を一本"],
  "ヴィンテージワインを開ける": ["ワインセラーを持つ"],
  "自分のブドウ畑": ["ワインセラーを持つ"],
  "酒蔵を一つ持つ": ["自分のブドウ畑"],
  "専属シェフが家にいる": ["料理教室に通う"],            // 食 ← 趣味（料理を知ってから）
  "お抱えのレストラン": ["専属シェフが家にいる"],
  // 装い：自信を得てから散財する
  "ハイブランドのバッグ": ["ブランド店員にビビらない"],   // 装 ← 格（度胸）
  "ブランドを普段使い": ["ハイブランドのバッグ"],
  "パーティードレスを誂える": ["オーダーメイドのスーツ"],
  "専属スタイリスト": ["オーダーメイドのスーツ", "ハイブランドのバッグ"],
  "本物の宝石を日常に": ["自分へのご褒美に宝飾品"],
  // 移動：乗り物・空の段階
  "海外旅行をパッと予約": ["飛行機で旅行できる"],
  "ビジネスクラスを試す": ["海外旅行をパッと予約"],
  "プライベートジェットを試す": ["ビジネスクラスを試す"],
  "専用機を持つ": ["プライベートジェットを試す"],
  "二台目の車を持つ": ["新車を一括で買う"],
  "スポーツカーが“足”": ["新車を一括で買う"],
  "ガレージにコレクション": ["スポーツカーが“足”", "二台目の車を持つ"],
  "お抱え運転手": ["新車を一括で買う"],
  "大型ヨットを所有": ["クルーザーでレース観戦"],
  "豪華客船を所有": ["大型ヨットを所有"],
  // 住まい：暮らしの深化
  "自宅にサウナ": ["毎日湯船に浸かれる"],
  "オーダー家具で揃える": ["拾った家具を卒業"],
  "丘の上に豪邸": ["海の見える別荘"],
  // 趣味・遊び：愛好 → 大規模
  "ゴルフ会員権": ["大人の趣味に投資"],
  "趣味でアートを買う": ["大人の趣味に投資"],
  "自主映画を撮らせる": ["趣味でアートを買う"],
  "馬主デビュー": ["乗馬を趣味にする"],
  "競走馬の牧場を持つ": ["馬主デビュー"],
  "私設動物園をつくる": ["ペットを迎える余裕"],
  // 格・世界：道楽 → 公共 → 伝説（枝をまたいで集約）
  "美術品を集めだす": ["趣味でアートを買う"],            // 格 ← 趣味
  "私設ギャラリーを開く": ["美術品を集めだす"],
  "映画スタジオを持つ": ["自主映画を撮らせる"],          // 格 ← 趣味
  "競走竜のオーナーに": ["馬主デビュー"],                // 格 ← 趣味
  "自分の名を冠した大会": ["競走竜のオーナーに"],
  "VIPルームが当たり前": ["ブランド店員にビビらない"],
  "執事を雇う": ["VIPルームが当たり前"],
  "社交界の主催者": ["執事を雇う"],
  "ミミ財団を設立": ["銀行を持つ"],
  "聖龍と契約を交わす": ["聖龍に名を覚えられる"]
};

// ツリー（DAG）構築。各ノードに branch / tier / pos / cost / nodeId / prereqs を付与。
// prereqs = 同枝のひとつ手前 ＋ 前段の衣食住ピラー（土台）＋ 手書きクロスリンク。
const LIFE_TREE = {};
const LIFE_NODE_BY_TITLE = {};
(function buildLifeTree() {
  LIFE_BRANCHES.forEach(b => { LIFE_TREE[b.id] = []; });
  // LIFE_MILESTONES は at 昇順。順に枝へ振り分ければ枝内も昇順。
  LIFE_MILESTONES.forEach(m => {
    const bid = lifeBranchOf(m.title);
    (LIFE_TREE[bid] || LIFE_TREE.status).push(m);
    m.branch = bid;
    m.tier = lifeTierIndexOf(m.at);
    m.nodeId = m.title;            // title は一意（重複0検証済み）→ 安定キー
    LIFE_NODE_BY_TITLE[m.title] = m;
  });
  LIFE_BRANCHES.forEach(b => {
    LIFE_TREE[b.id].forEach((m, pos) => { m.pos = pos; m.cost = 1 + Math.floor(pos / LIFE_COST_STEP); });
  });
  // ピラー：各(枝, ティア)で最初に現れる（最安）ノード＝その段の“入口”。
  const pillar = {};
  LIFE_BRANCHES.forEach(b => { pillar[b.id] = {}; });
  LIFE_MILESTONES.forEach(m => { if (pillar[m.branch][m.tier] === undefined) pillar[m.branch][m.tier] = m; });
  function pillarAtOrBelow(branchId, tier) {
    for (let t = tier; t >= 0; t--) { if (pillar[branchId][t]) return pillar[branchId][t]; }
    return null;
  }
  // 依存グラフ生成
  LIFE_MILESTONES.forEach(node => {
    const reqs = [];
    if (node.pos > 0) reqs.push(LIFE_TREE[node.branch][node.pos - 1]);    // 同枝のひとつ手前
    if (node.tier >= 1) {                                                  // 前段の衣食住の土台
      ["food", "home", "attire"].forEach(pb => { const pp = pillarAtOrBelow(pb, node.tier - 1); if (pp) reqs.push(pp); });
    }
    const extra = LIFE_EXTRA_PREREQ[node.title];                           // 手書きクロスリンク
    if (extra) extra.forEach(t => { if (LIFE_NODE_BY_TITLE[t]) reqs.push(LIFE_NODE_BY_TITLE[t]); });
    // 重複除去・自己/上位（循環）除外：前提は必ず at が小さい側のみ
    const seen = {};
    node.prereqs = reqs.filter(r => {
      if (!r || r === node || r.at >= node.at || seen[r.title]) return false;
      seen[r.title] = 1; return true;
    });
  });
})();

// ---- 暮らしポイント：★廃止 ----
// かつては くらしツリー の支払い手段だったが、解放をコイン一本にした改修で役目を失い、
// 「残高が表示されるのに絶対に減らない通貨」＝プレイヤーを悩ませるだけの表示になっていた
// （実際の支払いは hunger.js の unlockLifeNode ラップがコインを引く）。
// 中身は総資産の単調変換（マイルストーン1段＝5P）で情報量ゼロだったため、指標ごと削除。
// ★node.cost は残すこと：暮らしPのコストではなく、コイン価格の係数（hunger.js の
//   lifeNodePrice）と資産帯ゲート（lifeNodeBandAt）の根拠として現役。

// ---- ノード状態 ----
function lifeNodeUnlocked(node) {
  return !!(state.lifeTree && state.lifeTree.unlocked && state.lifeTree.unlocked[node.nodeId]);
}
function lifeNodePrereqMet(node) {
  const r = node.prereqs || [];
  for (let i = 0; i < r.length; i++) if (!lifeNodeUnlocked(r[i])) return false;
  return true;
}
// まだ解放されていない前提ノード（UIで「何が必要か」を案内するため）。
function lifeNodeMissingPrereqs(node) {
  return (node.prereqs || []).filter(pr => !lifeNodeUnlocked(pr));
}
// "unlocked" | "ready"(振り分け可) | "prereq"(前提待ち)
// ★ユーザー指示：解放はコインのみで判定（暮らしPは総資産から自動で貯まる指標として残すが、
//   解放条件からは撤廃）。実際の支払い可否は hunger.js の unlockLifeNode ラップ（コイン）で判定。
// ★総資産帯ゲート（NARRATIVE_DESIGN §7-C）：コインさえあれば終盤ノードまで買えた＝食事段位（総資産基準）と
//   体感がズレる問題の修正。cost段階→総資産のしきい値は ASSET_LEVELS と同じ物差し
//   （cost1=最初から / 2=1万 / 3=10万 / 4=100万 / 5+=1億=終章全開放）。帯未満は prereq 扱い（既存UIの🔒表示に乗る）。
const LIFE_NODE_BAND = [0, 0, 10000, 100000, 1000000, 100000000];
function lifeNodeBandAt(node) {
  const c = Math.min((node && node.cost) || 1, LIFE_NODE_BAND.length - 1);
  return LIFE_NODE_BAND[c];
}
function lifeNodeState(node) {
  if (lifeNodeUnlocked(node)) return "unlocked";
  if (!lifeNodePrereqMet(node)) return "prereq";
  try { if (assetsPeak(state) < lifeNodeBandAt(node)) return "prereq"; } catch (e) {}   // ★帯ゲート＝到達最高（資産を使っても閉じない）
  return "ready";
}
function unlockLifeNode(node) {
  if (lifeNodeState(node) !== "ready") return { ok: false };
  if (!state.lifeTree) state.lifeTree = { unlocked: {} };
  if (!state.lifeTree.unlocked) state.lifeTree.unlocked = {};
  state.lifeTree.unlocked[node.nodeId] = true;
  if (typeof saveGame === "function") saveGame();
  return { ok: true };
}
function respecLifeTree() {
  state.lifeTree = { unlocked: {} };
  if (typeof saveGame === "function") saveGame();
}

// ---- 集計・枝ごとの進捗 ----
function lifeTreeStats() {
  let unlockedCount = 0;
  const u = (state.lifeTree && state.lifeTree.unlocked) || {};
  for (const t in u) if (u[t] && LIFE_NODE_BY_TITLE[t]) unlockedCount++;
  // ★暮らしP廃止に伴い earned/spent/available は返さない。
  //   「いま取れるノードがあるか」は readyCount で表す（次の一手サジェスト等が使う）。
  let readyCount = 0;
  LIFE_MILESTONES.forEach(n => { if (lifeNodeState(n) === "ready") readyCount++; });
  return { unlockedCount, readyCount, totalNodes: LIFE_MILESTONES.length };
}
function lifeBranchProgress(branchId) {
  const arr = LIFE_TREE[branchId] || [];
  let done = 0, next = null;
  for (let i = 0; i < arr.length; i++) {
    if (lifeNodeUnlocked(arr[i])) done++;
    else if (!next) next = arr[i];     // 次に狙える最初の未解放ノード
  }
  return { done, total: arr.length, next };
}
