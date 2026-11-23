/* Standalone, pure prototype. No main-game globals, storage, race engine or wallets. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShinganPrototype = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;
  const DRAGONS = [
    { id: "raiou", name: "ライオウ", trait: "先頭に立つと雷をまとって伸びる。", note: "先行して持ち味を出す竜。" },
    { id: "fugaku", name: "フガク", trait: "登りに強く、順位に動じない。", note: "平常心で長く力を保つ。" },
    { id: "glaze", name: "グレイズ", trait: "気性が安定した氷甲の竜。", note: "急な順位変化にも乱れにくい。" },
    { id: "poro", name: "ポロ", trait: "人の隣にいるのが上手な相棒。", note: "先団に付けると粘るが、離されると苦しい。" },
    { id: "yomi", name: "ヨミ", trait: "前半は静かで、後半に伸びる。", note: "長い降りと終盤で持ち味が出る。" },
    { id: "souten", name: "ソウテン", trait: "後ろから追うときに本気を出す。", note: "前の竜を目標にする走り。" },
    { id: "phenix", name: "フェニックス", trait: "出遅れを最後の伸びで取り戻す。", note: "長い直線なら追い込みが届く可能性。" },
    { id: "goka", name: "ゴウカ", trait: "抜かれると奮起する火の竜。", note: "競り合いが力になるが、展開に左右される。" }
  ];
  const IDS = DRAGONS.map(d => d.id);
  const SCENARIOS = [
    { id: "coast", title: "海風の最終便", condition: "長い登りの後、海風を受ける直線。先団の持久力に注目。", seed: "fair-coast-001", order: ["raiou", "fugaku", "glaze", "goka", "poro", "souten", "yomi", "phenix"], tempo: [0, 0.48, 0.93, 1.42, 1.78, 2.17, 2.55, 2.91], attention: { fugaku: 1.1, glaze: 1, goka: 1.15, poro: 1.4, yomi: 0.85, souten: 1, phenix: 0.9 } },
    { id: "gorge", title: "霧が晴れる峡谷", condition: "前半は流れが落ち着き、長い降りから短い直線へ。後半型にも出番。", seed: "fair-gorge-002", order: ["raiou", "yomi", "poro", "glaze", "fugaku", "goka", "phenix", "souten"], tempo: [0, 0.39, 0.72, 1.15, 1.66, 2.04, 2.58, 3.05], attention: { fugaku: 0.95, glaze: 1.2, goka: 0.85, poro: 1.4, yomi: 1.1, souten: 0.95, phenix: 1 } },
    { id: "sky", title: "雲を抜ける直線", condition: "登りは短く、最後の直線が長い。後方から追う竜にも余地がある。", seed: "fair-sky-003", order: ["raiou", "souten", "phenix", "yomi", "glaze", "poro", "fugaku", "goka"], tempo: [0, 0.34, 0.69, 1.18, 1.61, 2.08, 2.47, 2.95], attention: { fugaku: 0.85, glaze: 1, goka: 1, poro: 1.4, yomi: 1.15, souten: 1.1, phenix: 1.2 } }
  ];
  const PREPARATIONS = [
    { id: "harbor", title: "港の桟橋を直す", cost: 120, description: "島の外からも読者が来る。特集の届く人数が増える。" },
    { id: "market", title: "市場の灯りを戻す", cost: 150, description: "賭けだけに頼らず、食事や買い物から運営を支える。" },
    { id: "scout", title: "竜たちの取材記録を持ち込む", cost: 0, description: "迎えた竜のしぐさや走りの記録から、予想の選択肢が増える。" }
  ];
  const EDITOR_SLOTS = [
    { id: "trust", title: "読みを信じる読者へ", description: "複勝をじっくり読む客。記事の予想に票が集まりやすい。" },
    { id: "value", title: "配当を探す読者へ", description: "票の薄い組合せに注目し、ほかの予想とも比較して買う客。" },
    { id: "fans", title: "竜を応援する読者へ", description: "今日来たファンに届くと読者が増える。応援の票は集中しやすい。" }
  ];
  const FANS = {
    coast: { goka: 1.6, poro: 1.35, glaze: 1.15 },
    gorge: { glaze: 1.6, poro: 1.35, fugaku: 1.15 },
    sky: { goka: 1.6, phenix: 1.35, poro: 1.15 }
  };
  // New prototype scenes, drawing on existing island places and collection art.
  // These are memories and invited readers, never equipment for the racers.
  const JOURNEY_PLACES = [
    { id: "furununo", title: "古布屋に眠る、旅の布", subtitle: "伝説の名前より、そこに残った跡を。", image: "images/konron/spots/furununo.webp", memoryId: "cloth", theoryId: "terrain" },
    { id: "atelier", title: "最後の一面に、どんな姿で", subtitle: "値札では決まらない、わたしの一張羅。", image: "images/konron/spots/arcade.webp", memoryId: "attire", theoryId: "market" },
    { id: "table", title: "聖龍祭の、小さな食卓", subtitle: "だし巻きを分けると、話の続きが聞ける。", image: "images/meals/s_dashimaki.webp", memoryId: "supper", theoryId: "sharedRisk" }
  ];
  const MEMORIES = [
    { id: "cloth", title: "裾に残った坂道", person: "夜市の布売り", quote: "新しい金糸より、古い擦り切れを見てごらん。", body: "祭祀布を裏返すと、裾に小さな坂道の刺繍が残っていた。伝説の名前より、誰かが歩いてきた跡を持ち帰った。", image: "images/konron/spots/furununo.webp", groupLabel: "古い旅の記録を囲む、島歩きの読者", fans: { fugaku: 1.6, yomi: 1.35, glaze: 1.15 } },
    { id: "attire", title: "値札では選ばなかった日", person: "仕立て屋の店主", quote: "似合う理由は、値札の裏にはないよ。", body: "鏡の前で、今の自分が着たい姿を選んだ。ミズ・アオラから聞いた、人気と実力を同じものにしない話を思い出した。", image: "images/konron/spots/arcade.webp", groupLabel: "自分らしい姿を楽しむ、祭りの読者", fans: { goka: 1.6, souten: 1.35, raiou: 1.15 } },
    { id: "supper", title: "一切れずつ、同じ食卓で", person: "食堂のおばちゃん", quote: "札は違っても、ふたりともあの子を待ってたんだね。", body: "だし巻きを分けるうち、常連が前に買ったポロの複勝の話をした。旅人はライオウ×ポロのワイドだったという。『でも、ポロが3着にも入らなかったら、ふたりとも外れるね』。違う札を手にした二人が、同じ竜を待っていたと気づいた食卓。", image: "images/meals/s_dashimaki.webp", groupLabel: "食卓で会った、島の家族と相棒のファン", fans: { poro: 1.6, glaze: 1.35, phenix: 1.15 } }
  ];
  const THEORIES = [
    { id: "terrain", title: "得意と、今日の舞台を比べる", body: "得意な坂があっても、その先には降りや直線がある。竜の一つの長所だけで、最後の順位まで決めつけない。", source: "古布屋で思い返した、スカウトの観察記録（試作の取材）" },
    { id: "market", title: "人気と実力は、同じではない", body: "ミズさんは、オッズを『群衆の祈りの跡』として読むと教えてくれた。人気が集まるほど配当は薄くなる。読めたと思っても、当たるとは限らない。", source: "旅で出会ったミズ・アオラの言葉（本編の出会いを振り返る）" },
    { id: "sharedRisk", title: "券が違っても、同じ読みかもしれない", body: "同じ竜の複勝と、その竜を含むワイド。一枚ずつに見えても、その竜が届かない日は一緒に外れる。何に頼っているかを、並べて確かめる。", source: "食卓で常連と旅人の賭け札を比べた話（試作の取材）" }
  ];
  const OUTFITS = [
    { id: "traveler", title: "歩いてきた日の旅装", image: "images/cast/mimi/mimi_taipei_default.webp", cost: 0, sourceNote: "この独立試作では、旅で所持していた装いとして貸し出しています。本編の衣装獲得や報酬CGは解放しません。" },
    { id: "newspaper", title: "わたしの記者服", image: "images/cast/mimi/mimi_newspaper_default.webp", cost: 45, sourceNote: "この独立試作では、旅で所持した記者服を店に預けていた想定です。45枚は祭り前の仕立て直し代。本編の衣装獲得や報酬CGは解放しません。" }
  ];
  const copy = x => JSON.parse(JSON.stringify(x));
  const money = x => Math.round(x * 100) / 100;
  const byId = id => DRAGONS.find(d => d.id === id);
  function scenario(id) {
    const s = SCENARIOS.find(x => x.id === id);
    if (!s) throw new Error("Unknown prototype scenario: " + id);
    return s;
  }
  function pair(a, b) { return [a, b].sort().join("+"); }
  function pairs(ids) {
    const out = [];
    ids.forEach((a, i) => ids.slice(i + 1).forEach(b => out.push(pair(a, b))));
    return out;
  }
  function newJourney() {
    return { activePlace: null, stage: null, visited: [], memories: [], theories: [], outfits: ["traveler"], outfit: "traveler", coverMemory: null, notice: null };
  }
  function journey(state) { return state.journey || newJourney(); }
  function memory(id) { return MEMORIES.find(m => m.id === id); }
  function theory(id) { return THEORIES.find(t => t.id === id); }
  function fanWeights(state) {
    const j = journey(state), cover = j.memories.includes(j.coverMemory) && memory(j.coverMemory);
    return cover ? cover.fans : FANS[state.scenarioId];
  }
  function fanList(weights) { return Object.entries(weights).map(([id, interest]) => ({ id, name: byId(id).name, interest })); }
  // Main-game records are copied by the optional bridge. Their historical
  // observations never become finish probabilities or equipment for this race.
  function getReadingNotes(state) {
    let journal = typeof globalThis !== "undefined" ? globalThis.ReadingJournal : null;
    if (!journal && typeof require === "function") {
      try { journal = require("./reading_journal.js"); } catch (e) { /* Older standalone bundle. */ }
    }
    if (!journal || typeof journal.normalizeNotes !== "function") return [];
    const labels = { kan: "好み", data: "能力データ", tell: "レース展開", value: "うまみ" };
    return journal.normalizeNotes((state && state.readingNotes) || []).map(note => {
      const standings = note.selections.map(s => s.name + s.rank + "着").join("・");
      const condition = note.betType === "win" ? "本編の単勝は1着" : note.betType === "place" ? "本編の複勝は3着以内" : "本編のワイドは2頭とも3着以内";
      const trace = note.trace, focus = trace && note.selections.find(s => s.dragonId === trace.dragonId);
      const observation = focus ? focus.name + "：序盤" + trace.earlyRank + "番手→中盤" + trace.midRank + "番手→" + focus.rank + "着。" +
        (trace.section ? trace.section + "を見届けた。" : "") + (trace.stat ? "この区間で問われる能力は「" + trace.stat + "」。" : "") +
        (trace.pace ? "ペースは「" + trace.pace + "」。" : "") + (trace.popularity ? trace.popularity + "番人気だった。" : "") : standings + "。途中の順位は記録していない。";
      const attribution = journal.oracleAccount(note);
      const reasonLabel = attribution ? (note.betType === "wide" ? "予言の一着と自分で選んだ相手" : "神眼が告げた一着") : labels[note.reason];
      return Object.assign({}, note, { title: note.raceName + (attribution ? "で残した、神眼を聞いた一戦" : "で残した、わたしの読み"), sourceLabel: "本編の第" + note.completedRace + "戦・結果から残した実記録",
        reasonLabel, ...(attribution ? {attribution} : {}), observation, reviewText: (attribution || "あのときは「" + reasonLabel + "」を理由に選び、") + standings + "。" + condition + "で、賭けは" + (note.hit ? "的中した。" : "外れた。"),
        suggestedTheoryId: attribution && note.betType !== "wide" ? null : note.reason === "value" ? "market" : note.reason === "data" || note.reason === "tell" ? "terrain" : null,
        image: "images/dragons/" + note.selections[0].dragonId + ".png" });
    });
  }
  function journeyScene(state) {
    const j = journey(state), place = JOURNEY_PLACES.find(p => p.id === j.activePlace);
    if (!place) return null;
    if (j.stage === "found") {
      const m = memory(place.memoryId), t = theory(place.theoryId);
      return { placeId: place.id, title: m.title, image: place.id === "atelier" ? OUTFITS.find(o => o.id === j.outfit).image : m.image,
        body: m.body + "\n\n「" + m.quote + "」——" + m.person + "\n\n持ち帰った理論：" + t.title + "\n" + t.body + "\n\nこの記憶を表紙にすると「" + m.groupLabel + "」を招きます。",
        choices: [{ id: "use_memory", label: "この記憶を、表紙に添える", detail: "招く読者の顔ぶれを替える。来訪効果を積み重ねるものではありません。" }, { id: "leave", label: "手帖にしまって、島へ戻る" }] };
    }
    if (place.id === "furununo" && j.stage === "compare") return { placeId: place.id, title: "布の裏に、何を読んだ？", image: place.image,
      body: "裏には三つの違う跡があった。\n・小さな刺繍の道は、何度も折り返す坂の形。\n・道の折り返しだけ、糸が深く擦り減っている。\n・表の金糸は、その上から新しく縫い足されている。\n\n店主は答えを言わず、こちらを見た。『その三つを見て、どこまでなら言えると思う？』",
      choices: [{ id: "read_paths", label: "同じ坂道を、繰り返し越えた跡だと思う" }, { id: "read_champion", label: "誰より速く走った竜の証だと思う" }, { id: "read_ornament", label: "全部、新しく作った祭りの飾りだと思う" }, { id: "leave", label: "見立てを手帖に置いて、また考える" }] };
    if (place.id === "furununo") return { placeId: place.id, title: "星渡りの祭祀布", image: place.image,
      body: "伝説の布だという。でも、店先には金色に光る布が何枚もある。\n布売りは『昔の旅を知りたいなら、長く風に当たった場所を見るんだ』とだけ言った。どこを確かめよう。",
      choices: [{ id: "look_gold", label: "金色の飾りを透かして見る" }, { id: "turn_hem", label: "ほつれた裾を、裏返してみる" }, { id: "ask_keeper", label: "店主に、旅の跡の見方を聞く" }, { id: "leave", label: "今日は別の場所へ" }] };
    if (place.id === "atelier") return { placeId: place.id, title: "鏡に映る、いまのミミ", image: place.image,
      body: "最後の取材に何を着ていこう。店主は、旅で着ていた服と、預けていた記者服を並べた。\n『どちらも、きみが歩いてきた服だ。今日はどの自分で書く？』\n鏡の向こうで、いつもの耳が少し揺れた。最後の紙面に映る、自分の姿を選ぼう。",
      choices: [{ id: "keep_traveler", label: "歩いてきた日の旅装で行く", detail: "0枚。いつもの自分を、そのまま表紙へ。" }, { id: "tailor_newspaper", label: j.outfits.includes("newspaper") ? "記者服に着替える" : "記者服を仕立て直す・45枚", detail: "預けていた一着を、今日の取材に。仕立て直しは一度だけ。" }, { id: "leave", label: "もう少し、島を歩こう" }] };
    return { placeId: place.id, title: "聖龍祭で分ける、だし巻き", image: place.image,
      body: "箸を入れると、じゅわっと出汁がにじむ。隣の常連は『みりんかな』、旅人は『生地のふわっとしたところが気になる』と言う。\nおばちゃんが笑った。『うちの隠し味は、卵の親戚みたいな台所の調味料さ。もう一口、分けようか』\n\n常連が、前に買ったポロの複勝の話を始めた。旅人は『私はライオウとポロのワイドだった』と身を乗り出す。違う券を買った二人の話にも、もう少し耳を傾けてみたい。",
      choices: [{ id: "taste_mirin", label: "みりんの甘さを、もう一口探す" }, { id: "taste_mayo", label: "ふわっとした口当たり……マヨネーズ？" }, { id: "share_table", label: "答えを急がず、みんなの感想を聞く" }, { id: "leave", label: "食卓に手を振って、島へ戻る" }] };
  }
  function getJourneyView(state) {
    const j = journey(state);
    return { places: JOURNEY_PLACES.map(p => ({ id: p.id, title: p.title, subtitle: p.subtitle, image: p.image, visited: j.visited.includes(p.id), complete: j.memories.includes(p.memoryId) })),
      activeScene: journeyScene(state), notice: copy(j.notice), coverMemory: j.coverMemory,
      memories: MEMORIES.map(m => ({ id: m.id, title: m.title, person: m.person, quote: j.memories.includes(m.id) ? m.quote : "", body: j.memories.includes(m.id) ? m.body : "島で、まだ聞いていない話。", image: m.image, owned: j.memories.includes(m.id), readerGroup: { label: m.groupLabel, fans: fanList(m.fans) } })),
      theories: THEORIES.map(t => Object.assign({}, t, { body: j.theories.includes(t.id) ? t.body : "旅で持ち帰ると読み返せます。", owned: j.theories.includes(t.id) })),
      outfits: OUTFITS.map(o => Object.assign({}, o, { owned: j.outfits.includes(o.id), equipped: j.outfit === o.id })),
      currentOutfit: Object.assign({}, OUTFITS.find(o => o.id === j.outfit), { owned: true, equipped: true }) };
  }
  function visitJourney(state, placeId) {
    const place = JOURNEY_PLACES.find(p => p.id === placeId);
    if (!place) throw new Error("知らない島の場所です。");
    const next = copy(state); next.journey = copy(journey(state));
    const j = next.journey; j.activePlace = placeId; j.notice = null;
    if (!j.visited.includes(placeId)) j.visited.push(placeId);
    j.stage = j.memories.includes(place.memoryId) && placeId !== "atelier" ? "found" : "start";
    return next;
  }
  function selectCoverMemory(state, memoryId) {
    if (memoryId !== null && (!memory(memoryId) || !journey(state).memories.includes(memoryId))) throw new Error("まだ持ち帰っていない記憶です。");
    const next = copy(state); next.journey = copy(journey(state)); next.journey.coverMemory = memoryId; return next;
  }
  function wearOutfit(state, outfitId) {
    if (!OUTFITS.some(o => o.id === outfitId) || !journey(state).outfits.includes(outfitId)) throw new Error("この試作で使える装いではありません。");
    const next = copy(state); next.journey = copy(journey(state)); next.journey.outfit = outfitId; return next;
  }
  function chooseJourney(state, choiceId) {
    const scene = journeyScene(state);
    if (!scene || !scene.choices.some(c => c.id === choiceId)) throw new Error("この場面では選べない行動です。");
    let next = copy(state); next.journey = copy(journey(state));
    const j = next.journey, place = JOURNEY_PLACES.find(p => p.id === scene.placeId);
    j.notice = null;
    if (choiceId === "leave") { j.activePlace = null; j.stage = null; return next; }
    if (choiceId === "use_memory") { next = selectCoverMemory(next, place.memoryId); next.journey.activePlace = null; next.journey.stage = null; return next; }
    if (choiceId === "turn_hem") {
      j.stage = "compare";
      j.notice = { kind: "observation", title: "見つけた。でも、まだ言い切れない。", body: "刺繍、擦れ、修繕。三つの跡を比べて、自分の見立てを店主に返そう。" };
      return next;
    }
    if (choiceId === "read_champion" || choiceId === "read_ornament") {
      j.notice = { kind: "hint", title: "跡から言えることと、言えないこと", body: choiceId === "read_champion" ? "『擦れているのは分かる。でも、速さを比べた時計も、相手の記録もないだろう？』店主は坂の折り返しを指した。観察できたことだけで、もう一度考えよう。" : "『新しい金糸の下にも、擦れた道が続いているね』。飾りを足した日と、この布が使われてきた時間は、同じではなさそうだ。" };
      return next;
    }
    if (choiceId === "look_gold" || choiceId === "ask_keeper" || choiceId === "taste_mirin") {
      j.notice = { kind: "hint", title: "もう少し、確かめてみよう", body: choiceId === "taste_mirin" ? "甘さだけでは説明できない、ふわっとした口当たりが残る。隣の人は『卵でできた調味料だったりして』と首をかしげた。" : "光る金糸は最近の修繕だった。店主は、風でほつれた裾をそっと持ち上げる。『旅の古さは、こっちに残るのさ』" };
      return next;
    }
    if (choiceId === "tailor_newspaper") {
      if (!j.outfits.includes("newspaper")) { if (next.coins < 45) throw new Error("仕立て直しに使う45枚が足りません。旅装でも取材できます。"); next.coins -= 45; j.outfits.push("newspaper"); }
      j.outfit = "newspaper";
    }
    if (choiceId === "keep_traveler") j.outfit = "traveler";
    if (!j.memories.includes(place.memoryId)) j.memories.push(place.memoryId);
    if (!j.theories.includes(place.theoryId)) j.theories.push(place.theoryId);
    j.stage = "found";
    const m = memory(place.memoryId), t = theory(place.theoryId);
    j.notice = { kind: "discovery", title: m.title, body: choiceId === "share_table" ? "正解を急ぐかわりに、みんなの言葉を手帖に残した。おばちゃんは最後に、隠し味のマヨネーズを見せてくれた。\n\n" + t.body : m.body + "\n\n" + t.body };
    return next;
  }
  function getRace(scenarioId) {
    const s = scenario(scenarioId);
    return { seed: s.seed, order: s.order.slice(), oracleWinner: "raiou", rows: s.order.map((id, i) => ({ id, name: byId(id).name, rank: i + 1, time: 120 + s.tempo[i], gap: s.tempo[i] })) };
  }
  function createState(mode, scenarioId) {
    mode = mode || "arrival";
    if (mode !== "arrival" && mode !== "prepared") throw new Error("Unknown demo mode");
    scenario(scenarioId || "coast");
    const state = { version: VERSION, scenarioId: scenarioId || "coast", coins: 600, prepared: { harbor: false, market: false, scout: false }, scouted: ["raiou", "poro"], log: [], journey: newJourney() };
    return mode === "prepared" ? PREPARATIONS.reduce((s, p) => prepare(s, p.id), state) : state;
  }
  function prepare(state, action) {
    const p = PREPARATIONS.find(x => x.id === action);
    if (!p) throw new Error("Unknown preparation: " + action);
    const next = copy(state);
    if (next.prepared[action]) return next;
    if (next.coins < p.cost) throw new Error("Insufficient prototype coins");
    next.coins -= p.cost;
    next.prepared[action] = true;
    if (action === "scout") next.scouted = IDS.slice();
    next.log.push({ action, cost: p.cost });
    return next;
  }
  function offers(state) {
    const list = IDS.map(id => ({ id: "p_" + id, type: "place", ids: [id], title: byId(id).name + "の複勝", reason: byId(id).note, risk: id === "raiou" ? "1着の予言は確実。ただし票が集まると払戻は薄くなる。" : "2着以内に入れば的中。好きな竜でも、届かないことがある。" }));
    [["raiou", "fugaku"], ["raiou", "yomi"], ["raiou", "poro"], ["fugaku", "glaze"], ["yomi", "poro"], ["souten", "phenix"]].forEach(ids => list.push({ id: "w_" + ids.join("_"), type: "wide", ids, title: ids.map(id => byId(id).name).join(" × "), reason: ids.map(id => byId(id).note).join(" "), risk: "2頭とも3着以内なら的中。組合せが外れると払戻はない。" }));
    return list.map(o => Object.assign(o, { locked: o.ids.some(id => !state.scouted.includes(id)), image: "images/dragons/" + o.ids[0] + ".png", key: o.type === "place" ? o.ids[0] : pair(o.ids[0], o.ids[1]) }));
  }
  function getView(state) {
    const s = scenario(state.scenarioId);
    const j = journey(state), cover = j.memories.includes(j.coverMemory) && memory(j.coverMemory);
    return { scenario: { id: s.id, title: s.title, condition: s.condition, oracleWinner: "raiou", fanInterest: fanList(fanWeights(state)), fanSource: cover ? cover.groupLabel : "今日の島に集まった応援客" }, journey: getJourneyView(state), readingNotes: getReadingNotes(state), editorSlots: copy(EDITOR_SLOTS), scenarios: SCENARIOS.map(x => ({ id: x.id, title: x.title })), dragons: DRAGONS.map(d => Object.assign({}, d, { scouted: state.scouted.includes(d.id), image: "images/dragons/" + d.id + ".png" })), offers: offers(state), preparations: PREPARATIONS.map(p => Object.assign({}, p, { done: !!state.prepared[p.id] })), coins: state.coins };
  }
  function validate(state, plan) {
    const errors = [];
    if (!Array.isArray(plan) || plan.length > 3) return ["特集に置ける予想は3枚までです。"];
    const list = offers(state);
    const selected = plan.filter(id => id !== null);
    if (new Set(selected).size !== selected.length) errors.push("同じ予想は一枚だけ載せられます。");
    plan.forEach(id => {
      if (id === null) return;
      const o = list.find(x => x.id === id);
      if (!o) errors.push("見つからない予想です。");
      else if (o.locked) errors.push("この竜の取材記録がまだありません。");
    });
    return errors;
  }
  function validateAnnotations(state, plan, annotations) {
    if (!Array.isArray(annotations) || annotations.length > 3) return ["根拠は紙面の3枠に添えられます。"];
    const errors = [], j = journey(state);
    annotations.forEach((a, slot) => {
      if (a === null || a === undefined || !plan[slot]) return;
      if (typeof a !== "object" || Array.isArray(a)) { errors.push("根拠の記録が読めません。"); return; }
      if (a.memoryId != null && (!memory(a.memoryId) || !j.memories.includes(a.memoryId))) errors.push("まだ持ち帰っていない記憶です。");
      if (a.theoryId != null && (!theory(a.theoryId) || !j.theories.includes(a.theoryId))) errors.push("まだ手帖にない理論です。");
      if (a.readingNoteId != null && !getReadingNotes(state).some(n => n.id === a.readingNoteId)) errors.push("持ち込まれていない本編の記録です。");
    });
    return errors;
  }
  function publicEvidence(state, plan, offer, annotation) {
    if (!annotation || (!annotation.memoryId && !annotation.theoryId && !annotation.readingNoteId)) return null;
    const m = memory(annotation.memoryId), t = theory(annotation.theoryId), s = scenario(state.scenarioId);
    const historical = annotation.readingNoteId ? getReadingNotes(state).find(n => n.id === annotation.readingNoteId) : null;
    const readingNote = historical ? Object.assign({}, historical, { sameDragon: historical.selections.some(d => offer.ids.includes(d.dragonId)) }) : null;
    const names = offer.ids.map(id => byId(id).name);
    const claim = offer.type === "place" ? names[0] + "が2着以内に入る" : names.join("と") + "が、ともに3着以内に入る";
    const observation = offer.ids.map(id => byId(id).name + "：" + byId(id).trait).join(" ／ ");
    const related = offers(state).filter(o => o.id !== offer.id && plan.includes(o.id) && o.ids.some(id => id !== "raiou" && offer.ids.includes(id)));
    let connection;
    if (t && t.id === "terrain") connection = "『" + s.condition + "』と観察記録を重ね、" + claim + "と読んだ。得意な一区間だけで、最後まで決めつけない。";
    else if (t && t.id === "market") connection = "ミズさんの言葉を借りて、人気と走りを分けて考える。" + claim + "という読みと、客の票が集まる理由は、別々に確かめたい。";
    else if (t && t.id === "sharedRisk") connection = related.length ? "この予想は、ほかの" + related.length + "枚と同じ竜の走りに頼っている。" + claim + "という読みが崩れた時、券種が違っても安心とは限らない。" : "この予想と、ほかの記事では予言外の竜が重ならない。" + claim + "という読みを、別の可能性と並べた。ただし両方外れることもある。";
    else connection = "『" + (m ? m.quote : "旅で覚えたこと") + "』を思い返し、" + observation + "という記録から、" + claim + "と考えた。";
    if (readingNote) {
      const method = { kan: "応援する気持ちと、届く着順を分けて見る", data: "一つの能力だけでなく、区間でどう走ったかを確かめる", tell: "序盤・中盤から最後まで、順位の移り変わりを見る", value: "人気の順位と、実際に届いた着順を分けて見る" }[readingNote.reason];
      const past = readingNote.trace;
      const comparison = (past && (past.section || past.stat) ? "前の記録は" + (past.section ? "「" + past.section + "」" : "") + (past.section && past.stat ? "・" : "") + (past.stat ? "問われた能力「" + past.stat + "」" : "") + "。" : "") +
        "今回は「" + s.condition + "」。観察した特徴は「" + observation.replace(/。$/, "") + "」。この舞台で生きるか、前の結果だけで決めずに読み直す。";
      const application = "「" + readingNote.raceName + "」" + (readingNote.attribution ? "。" + readingNote.attribution : "で" + readingNote.selections.map(d => d.name).join("と") + "を選んだ記録。") + (readingNote.sameDragon ? "同じ竜を含む記事でも、今回は別のレース。" : "今回は別の竜・別のレース。") + comparison +
        (readingNote.attribution ? "今度はこの出走表を見て「" : method + "という読み方を使い、今回は「") + claim + "」と考えた。過去の結果は、今回の的中を保証しない。" + (readingNote.betType === "place" && offer.type === "place" ? "本編の複勝は3着以内、今回の記事は2着以内で、条件も違う。" : "");
      connection = m || t ? connection + "\n" + application : application;
    }
    return { memoryId: m ? m.id : null, theoryId: t ? t.id : null, readingNoteId: readingNote ? readingNote.id : null, readingNote, memoryTitle: m ? m.title : readingNote ? readingNote.title : "旅の手帖", person: m ? m.person : "ミミ", quote: m ? m.quote : "教わったことを、自分の読みで確かめたい。", memoryImage: m ? m.image : readingNote ? readingNote.image : null, theoryTitle: t ? t.title : readingNote ? "「" + readingNote.reasonLabel + "」からの読み直し" : "出会いからの見立て", theorySource: t ? t.source : readingNote ? readingNote.sourceLabel : "旅の記憶", observation, claim, connection, relatedIds: related.map(o => o.id) };
  }
  function makeChronicle(state, report, predictions, race, operatingProfit) {
    const j = journey(state), outfit = getJourneyView(state).currentOutfit;
    const cover = j.memories.includes(j.coverMemory) ? memory(j.coverMemory) : null;
    const entries = report.features.filter(f => f.evidence).map(f => {
      const e = f.evidence, p = predictions.find(p => p.id === f.id);
      const standings = p.ids.map(id => byId(id).name + (race.order.indexOf(id) + 1) + "着").join("・");
      const resultLine = standings + "。" + (p.hit ? "予想は的中。" : "予想は届かなかった。") + "読者の" + p.stake + "枚に、払戻" + p.payout + "枚。";
      let reply;
      if (e.theoryId === "market") {
        reply = p.hit ? (p.odds <= 1 ? "当たっても、今回は元返しだったね。" : "今回は" + p.odds + "倍で届いたね。") + "『" + e.claim + "』という読みと、票が作った配当は別のこと。人気と実力を分けるというミズさんの言葉を、数字でも見返せた。"
          : standings + "で、今回は払戻がなかった。『人気と実力は同じではない』は、薄い票なら勝てるという意味でもなかったね。";
      } else if (e.theoryId === "sharedRisk") {
        const related = predictions.filter(other => e.relatedIds.includes(other.id));
        reply = related.length ? "同じ竜の読みを共有した" + (related.length + 1) + "枚のうち、" + (related.filter(other => other.hit).length + Number(p.hit)) + "枚が的中した。" + standings + "。複勝は2着以内、ワイドは2頭とも3着以内で、届く条件も違ったね。券を増やすことと、読みを分けることは同じではなかった。"
          : standings + "。ほかの記事とは違う竜の可能性を見たね。今回は" + (p.hit ? "この読みも届いた" : "この読みは届かなかった") + "けれど、別々に見たから必ず当たるわけではない。一人で決めずに聞いた、あの食卓を思い出したよ。";
      } else {
        reply = standings + "。『" + e.claim + "』という見立ては、今回は" + (p.hit ? "届いたね" : "届かなかったね") + "。覚えていたのは『" + e.observation + "』。その長所だけが結果の理由だと言い切らず、今日のコース全体と一緒に振り返ろう。";
      }
      const review = reply + (e.readingNote ? "\n" + e.readingNote.reviewText + "\n" + e.readingNote.observation + "\n今回は「" + e.claim + "」と読み、" + standings + "。" + (e.readingNote.sameDragon ? "同じ竜を含んでいても、違うレースの結果として比べる。" : "別の竜の走りへ、読み方を持ち込んだ比較。") + "一度の的中や外れで、読み方そのものを証明したとは言わない。" : "");
      if (e.memoryId === "cloth") {
        reply = "「" + standings + "、店のラジオで聞いたよ。あの裏返した布は、" + (operatingProfit >= 0 ? "明日、開ける店先に" : "今夜も灯りのそばに") + "掛けておく。" + (p.hit ? "見つけた坂道が、君の言葉になったんだね" : "読みが外れても、君と見つけた坂道は消えないよ") + "、また続きを見においで」";
      } else if (e.memoryId === "attire") {
        reply = "「" + standings + "、お客さんと一緒に聞いたよ。あの鏡で選んだ『" + outfit.title + "』の君が書いた一面を、店に飾っておいた。" + (p.hit ? "胸を張って帰っておいで" : "外した日も、その服の君が歩いてきたことは変わらない") + "、次のほつれも、ここで直そう」";
      } else if (e.memoryId === "supper") {
        reply = "「" + standings + "、隣の席の人も見ていたよ。" + (p.hit ? "『この読み、あの子が書いたんだね』って、君のだし巻きを一切れ残してある" : "外れた札は畳んでおいで、食卓の君の席は空けてある") + "。" + (operatingProfit >= 0 ? "明日の仕込みもするから、またみんなで分けよう" : "読み直す前に、もう一口をみんなで分けよう") + "」";
      } else if (e.readingNote) {
        reply = "「" + e.readingNote.raceName + (e.readingNote.attribution ? "の手帖を、今日は読み返した。" + e.readingNote.attribution : "で『" + e.readingNote.reasonLabel + "』を理由に選んだ一戦を、今日は読み返した。") + standings + "。" + (e.readingNote.sameDragon ? "同じ竜にも、あの日とは違う走りがある" : "違う竜を見る日にも、あの一戦で見たことを持ってこられた") + "。前の答えを写さず、この違いも手帖に残しておこう」";
      } else {
        reply = "「" + standings + "。教わった言葉を、自分の読みとして書いてみた。" + (p.hit ? "届いたところも" : "届かなかったところも") + "、次に誰かと話すときの、わたしの記録になる」";
      }
      return Object.assign({}, e, { slot: f.slot, predictionId: f.id, title: f.title, resultLine, reply, review });
    });
    return { outfit: copy(outfit), cover: cover ? { id: cover.id, title: cover.title, person: cover.person, image: cover.image, readerGroup: cover.groupLabel } : null, entries,
      closing: entries.length ? "誰かから教わったことを、そのまま正解にはしなかった。" + outfit.title + "で、わたしなりに結び直した一面。その読みも、外れたところも、この島で歩いた続きになる。" : cover ? "『" + cover.title + "』を、最後の表紙に添えた。あの日会った人たちも、予言とは違うところで島の一日を見守っている。" : "この島で会った人の言葉を、次の一面にも持っていこう。" };
  }
  function basePools() {
    return {
      win: { raiou: 1000 },
      place: Object.fromEntries(IDS.map(id => [id, id === "raiou" ? 1200 : 120])),
      wide: Object.fromEntries(pairs(IDS).map(key => [key, key === pair("raiou", "poro") ? 800 : key === pair("raiou", "goka") ? 450 : key === pair("raiou", "fugaku") ? 300 : 30]))
    };
  }
  // A deliberately small fiction-only tote model. Three independent pools;
  // 80% distributable, split equally among winning selections, with 1.0 refunds.
  // This is NOT the main game's odds formula or a model of real-world rules.
  function settlePool(stakes, winningKeys) {
    const total = Object.values(stakes).reduce((a, b) => a + b, 0);
    const winning = winningKeys.filter(key => stakes[key] > 0);
    const allocation = winning.length ? total * 0.8 / winning.length : 0;
    const payouts = {}, odds = {};
    Object.keys(stakes).forEach(key => {
      odds[key] = winning.includes(key) ? Math.max(1, allocation / stakes[key]) : 0;
      payouts[key] = stakes[key] * odds[key];
    });
    const payout = Object.values(payouts).reduce((a, b) => a + b, 0);
    return { total: money(total), payout: money(payout), houseNet: money(total - payout), distributable: money(total * 0.8), refundSupport: money(Math.max(0, payout - total * 0.8)), payouts, odds };
  }
  function outcome(market, order) {
    return {
      win: settlePool(market.win, [order[0]]),
      place: settlePool(market.place, order.slice(0, 2)),
      wide: settlePool(market.wide, pairs(order.slice(0, 3)))
    };
  }
  function preview(state, plan, annotations) {
    annotations = annotations === undefined ? [] : annotations;
    const errors = validate(state, plan);
    if (errors.length) return { valid: false, errors };
    errors.push(...validateAnnotations(state, plan, annotations));
    if (errors.length) return { valid: false, errors };
    const s = scenario(state.scenarioId), list = offers(state), market = basePools(), features = [];
    const fans = fanWeights(state);
    const weights = [1, 0.82, 0.64];
    plan.forEach((id, slot) => {
      if (id === null) return;
      const o = list.find(x => x.id === id);
      const appeal = o.ids.reduce((n, id) => n + (s.attention[id] || 0.8), 0) / o.ids.length;
      const base = basePools()[o.type], baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
      const earlyOdds = Math.max(1, baseTotal * 0.8 / (o.type === "place" ? 2 : 3) / base[o.key]);
      const fanInterest = o.ids.reduce((n, id) => n + (fans[id] || 0.85), 0) / o.ids.length;
      const audienceFactor = slot === 0 ? (o.type === "place" ? 1.12 : 0.85)
        : slot === 1 ? Math.min(1.45, Math.max(0.65, earlyOdds / 3)) : fanInterest;
      const stake = Math.round((state.prepared.harbor ? 340 : 120) * weights[slot] * appeal * audienceFactor / 10) * 10;
      // Readers decide between the published idea and other entrants in that
      // same market; even honest coverage is not an instruction to bet.
      const directed = Math.round(stake * [0.78, 0.50, 0.90][slot]);
      const keys = Object.keys(market[o.type]).filter(k => k !== o.key);
      market[o.type][o.key] += directed;
      keys.forEach(key => { market[o.type][key] += (stake - directed) / keys.length; });
      features.push({ id, slot, type: o.type, ids: o.ids.slice(), title: o.title, key: o.key, stake, directedStake: directed, readers: Math.round(stake / 10), audienceLabel: EDITOR_SLOTS[slot].title, reaction: slot === 0 ? "根拠を読み、記事の予想へ票を寄せる読者です。" : slot === 1 ? "薄い票の組合せを探し、ほかの予想にも分けて買う読者です。" : fanInterest > 1 ? "今日来たファンに届き、応援の票が集中しています。" : "今日の応援客には、この竜のファンが少なめです。", evidence: publicEvidence(state, plan, o, annotations[slot]) });
    });
    const commerceIncome = state.prepared.market ? (state.prepared.harbor ? 100 : 55) : 0;
    // Provisional festival budget. Keep a viable all-correct editorial even
    // without the optional market; extra profit must not require a false pick.
    const operatingCost = 760;
    // Forecast ranges enumerate every still-possible 2nd/3rd finish behind
    // the disclosed winner. No hidden outcome data enters this preview.
    const possibilities = [];
    IDS.filter(id => id !== "raiou").forEach(second => IDS.filter(id => id !== "raiou" && id !== second).forEach(third => {
      const p = outcome(market, ["raiou", second, third]);
      possibilities.push({ p, profit: p.win.houseNet + p.place.houseNet + p.wide.houseNet + commerceIncome - operatingCost });
    }));
    const pools = {};
    ["win", "place", "wide"].forEach(type => {
      const stakes = market[type], total = Object.values(stakes).reduce((a, b) => a + b, 0);
      pools[type] = { total: money(total), stakes: copy(stakes), concentration: Math.max(...Object.values(stakes)) / total, estimatedNet: { min: Math.min(...possibilities.map(x => x.p[type].houseNet)), max: Math.max(...possibilities.map(x => x.p[type].houseNet)) } };
    });
    features.forEach(f => {
      const possible = possibilities.map(x => x.p[f.type].odds[f.key]).filter(n => n > 0);
      f.odds = { min: money(Math.min(...possible)), max: money(Math.max(...possible)) };
    });
    const warnings = [];
    if (pools.place.concentration > 0.55 || pools.wide.concentration > 0.55) warnings.push("ひとつの予想へ票が集中しています。的中しても配当が薄くなる場合があります。");
    if (!state.prepared.market) warnings.push("市場の収入がなく、運営費を券の売上だけで支えています。");
    return { valid: true, errors: [], pools, audience: { readers: features.reduce((n, f) => n + f.readers, 0), newStake: features.reduce((n, f) => n + f.stake, 0), harborOpen: !!state.prepared.harbor }, features, commerceIncome, operatingCost, estimatedProfit: { min: money(Math.min(...possibilities.map(x => x.profit))), max: money(Math.max(...possibilities.map(x => x.profit))) }, warnings };
  }
  function resolve(state, plan, annotations) {
    const report = preview(state, plan, annotations);
    if (!report.valid) return report;
    if (plan.length !== 3 || plan.filter(id => id !== null).length !== 3) return { valid: false, errors: ["3枚の予想を揃えてから発行してください。"] };
    const race = getRace(state.scenarioId);
    const settlement = outcome({ win: report.pools.win.stakes, place: report.pools.place.stakes, wide: report.pools.wide.stakes }, race.order);
    const predictions = report.features.map(f => {
      const odds = settlement[f.type].odds[f.key] || 0;
      return { id: f.id, type: f.type, ids: f.ids.slice(), title: f.title, hit: odds > 0, stake: f.directedStake, payout: money(f.directedStake * odds), odds: money(odds) };
    });
    const operatingProfit = money(Object.values(settlement).reduce((n, p) => n + p.houseNet, 0) + report.commerceIncome - report.operatingCost);
    const hits = predictions.filter(p => p.hit).length;
    // A chronicle must earn readers' trust as well as keep the island open.
    // One guaranteed oracle pick alone cannot satisfy the editorial objective.
    const success = operatingProfit >= 0 && hits >= 2;
    const feedback = ["セレスティアの1着予言は、今回も正確でした。"];
    feedback.push(hits === 3 ? "3枚すべて的中。走りの見立ては届きました。次は、読者の払戻と島の収支を見比べよう。" : hits ? hits + "枚の予想が的中。外れた予想も、取材の記録に残ります。" : "特集の予想は届きませんでした。条件と竜の走りを、もう一度見比べよう。");
    feedback.push(operatingProfit >= 0 ? "市場と券の売上で、この一日の運営を支えられました。" : "この一日は運営費を賄えませんでした。備えと紙面を変えて、同じレースで試せます。");
    if (operatingProfit < 0) {
      const sideSupport = settlement.place.refundSupport + settlement.wide.refundSupport;
      if (sideSupport > 0) feedback.push("複勝・ワイドで最低払戻を支える補填は" + money(sideSupport) + "コイン。届く読者を変えると、票の集まり方と配当が変わります。");
    }
    if (hits < 2) feedback.push("信頼される特集には、3枚中2枚以上の的中が目標です。1着以外の可能性を、取材記録から読んでみよう。");
    if (success) feedback.push("「わたしは当てた。でも、この島の灯りは消えなかったね」——引き分けを、彼女は受け入れた。");
    return Object.assign(report, { race, settlement, predictions, hits, operatingProfit, balanceAfter: money(state.coins + operatingProfit), success, oracleCorrect: race.order[0] === "raiou", feedback, chronicle: makeChronicle(state, report, predictions, race, operatingProfit) });
  }
  function enumeratePlans(state) {
    const ids = offers(state).filter(o => !o.locked).map(o => o.id), out = [];
    ids.forEach(a => ids.filter(b => b !== a).forEach(b => ids.filter(c => c !== a && c !== b).forEach(c => out.push([a, b, c]))));
    return out;
  }
  return { VERSION, createState, prepare, getView, preview, resolve, getRace, enumeratePlans, settlePool, getJourneyView, visitJourney, chooseJourney, wearOutfit, selectCoverMemory, getReadingNotes };
});
