// Island fieldwork: authored clues, revisable hypotheses, and remembered places.
// Pure metadata only. No construction, money, race, clock, or random outcomes.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.IslandDiscovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const copy = x => JSON.parse(JSON.stringify(x));
  const stories = typeof module === "object" && module.exports ? require("./island_discovery_stories.js") : typeof IslandDiscoveryStories !== "undefined" ? IslandDiscoveryStories : {observations:[],cases:[],companions:{}};
  const company = id => id && id !== 'solo' && Object.hasOwn(stories.companions,id) ? id : null;
  const SPOTS = {
    market: "霧待ち市場", tanada: "ルミナの棚田", uroko: "ウロコトロ温泉郷", mistra: "ミストラ湾",
    ryusha: "竜舎林", kazami_yagura: "風見の櫓", tsubasa_dana: "翼竜の岩棚", ryu_mizunomi: "竜の水のみ場",
    furununo: "夜市の古布屋", shiranami: "白波の鳥居浜", ohzuba: "大翼通り", rondo: "ロンド元宮",
    tsubo_roji: "赤土の壺小路", kirimina: "霧港", mall: "崑崙ショッピングモール", hoshiuo:"ホシウオ村"
  };
  const OBS = [
    { id: "water_jars", spotId: "market", title: "水甕についた、小さな札", body: "同じ朝、離れた屋台の水甕に同じ印がついている。店の人は『飲み水は田の水と分けて、上で手入れしてから運ぶんだ』と札を裏返した。雨の翌日は、交換した日付が細かく書かれている。" },
    { id: "water_fork", spotId: "tanada", title: "田に入る前に、分かれる水", body: "上の田へ入る手前で、水路が二つに分かれている。ひとつは田へ。もうひとつは覆いのある細い道へ続く。野の竜のために残す一枚には、人が柵を立てた跡がない。水の行先と、使ってよい土地は別に確かめたい。" },
    { id: "dragon_carry", spotId: "ryusha", title: "食べずに運ぶ、ひと口", body: "小さな翼竜が、受け取った魚を食べずにくわえて飛び去った。帰りは空の口で、また同じ方へ。世話係は『休むだけの場所と、誰かを待たせている場所は、帰り方が違うよ』と言う。まだ巣を見たわけではない。" },
    { id: "wind_return", spotId: "kazami_yagura", title: "上を向く布、岩陰へ消える影", body: "東風で吹き流しが上を向く。翼竜は風を正面から受ける崖の先ではなく、いったん高度を上げてから岩陰へ消える。魚を持つ影と空の口の影が、同じ岩棚を往復しているようだ。" },
    { id: "rest_ledger", spotId: "ryusha", title: "勝った日にも、休む日にも", body: "竜舎の休養帳には、着順より『水が近い』『走らなくても休める』『雨の日に高い所へ逃げられる』とある。世話係は『野の竜の通り道を塞がずに、そういう場所を見つけたいね』。草が多いだけでは、牧場に向くとは言えない。" },
    { id: "cloth_marks", spotId: "furununo", title: "飾りにしては、不揃いな線", body: "古布の端に、長さの違う横線と舟のような小さな印が繕い残されている。裏には『満ちるまで待つ』。店主は『祭りの飾りにも見えるけど、暮らしで使った印かもしれない』と、写しを取らせてくれた。元宮の聖物だとは断定できない。" },
    { id: "gate_seaward", spotId: "shiranami", title: "港を向いていない鳥居", body: "鳥居は街ではなく沖を向く。足元の古い護岸には高さの違う刻みがあり、新しい舗装の目地とは揃っていない。舟から帰る人の目印と、水位の印。この二つを一緒に読めるだろうか。" },
    { id: "vinegar_crates", spotId: "tsubo_roji", title: "売れなかった実の、次の行先", body: "形が揃わず市場に出せなかった果実が、酢の壺へ入る。瓶詰めの棚には注文札があるのに、空瓶待ちの壺も残っていた。職人は『中身は島にある。外へ送る器が足りない日があるんだ』と言う。" },
    { id: "return_cargo", spotId: "kirimina", title: "行きの荷と、帰りの荷", body: "港には空瓶の入った木箱がすでにある。窯元の封縄がある箱も、手書きの札だけの箱も。隣には封をした果実酢。そのうち一枚の札に『未受領』とあった。工房では瓶を待っているのに、この瓶はどこへ行くのだろう。" }
  ];
  const method = (id, label) => ({ id, label });
  const hypothesis = (id, label, reason, spotId, methods, correct, feedback) => ({ id, label, reason, spotId, methods, correct: !!correct, feedback });
  const CASES = [
    {
      id: "water", title: "屋台の水は、どこを通る？", question: "川があるだけで、街の飲み水は足りるだろうか。田の水と飲み水を分ける場所を探したい。", evidence: ["water_jars", "water_fork"],
      hypotheses: [
        hypothesis("upstream", "田へ入る前の分かれ道を追う", "甕の札と、覆いのある別水路がつながるのでは。", "tanada", [method("trace", "覆いの水路と、手入れの札をたどる"), method("clear", "雨の後の濁りと、田へ入る流れを比べる")], true),
        hypothesis("hot", "温泉の湯を街へ配っている", "温かい水なら、煮沸の手間が省けるかもしれない。", "uroko", [method("trace", "湯の行先を湯守に聞く"), method("clear", "澄んだ湯の見た目を確かめる")], false, "湯守は足湯へ続く溝を指した。これは入浴後の湯を下へ返す流れで、飲み水の甕の札とは別。温かさや透明さだけでは、飲めるかは確かめられない。"),
        hypothesis("bay", "湾で水を汲んで街へ運ぶ", "街から近く、舟でまとめて運べそうだ。", "mistra", [method("trace", "舟の水桶の仕入れ先を聞く"), method("clear", "干潮の水際を眺める")], false, "舟の人は『水桶は出航前に陸で満たす』と言う。目の前の湾は潮の水だ。運びやすい場所と、水を整える場所は同じとは限らない。")
      ], method: "trace", incomplete: "雨で濁った水を田へ回す小さな堰が見えた。農業用の流れはわかったが、屋台へ運ぶ水の手入れはまだ説明できない。甕と同じ札が、別水路の先にないか追ってみよう。",
      finding: { title: "田の上の、共同配水小屋", kind: "waterworks", spotId: "tanada", image: "images/konron/discovery/waterworks.webp", body: "覆いの水路の先に、沈める槽、ろ過床、手入れを記す札と配水の小屋があった。田へ流す水とは別に、担当の人が水を確かめて街へ送っている。市場の一杯を支えていたのは、滝だけではなく、この毎日の仕事だった。", reply: "水番の人は札を掛け直した。『みんなには、水が来るのが当たり前でいてほしいんだ。明日も、あの屋台へ届けるよ』" },
      plans: [{ id: "care", label: "手入れを続ける人を支えたい", detail: "飲み水を確かめ、当番を引き継ぐ日常を優先する企画。井戸を掘ったことにはならない。", investment: "public" }, { id: "route", label: "運ぶ道を途切れさせたくない", detail: "雨の日にも甕を運べる道と橋を優先する企画。配水工事はまだ行わない。", investment: "infra" }]
    },
    {
      id: "nest", title: "あの魚は、誰のところへ？", question: "餌を運ぶ翼竜は、どこへ帰るのだろう。水場で集まる姿と、巣へ戻る姿を見分けたい。", evidence: ["dragon_carry", "wind_return"],
      hypotheses: [
        hypothesis("ledge", "風を避ける岩棚の奥に巣がある", "餌を持つ往路と、空の口の復路が重なる場所を見たい。", "tsubasa_dana", [method("wait", "縄の手前で、往復する先を待つ"), method("feather", "岩棚に残る羽と、足跡の向きを読む")], true),
        hypothesis("water", "水のみ場が、そのまま巣になっている", "竜が繰り返し集まる場所なら、帰る場所かもしれない。", "ryu_mizunomi", [method("wait", "向こう岸から、飲み終えた後を待つ"), method("feather", "足跡の数を比べる")], false, "竜たちは飲み終えると、別々の方向へ去った。通う場所ではあっても、この観察では巣とは言えない。餌をくわえたまま帰る一頭の行先を追おう。"),
        hypothesis("tower", "風見の櫓の真下に巣がある", "翼がよく見える場所だから、近くに寝床があるのでは。", "kazami_yagura", [method("wait", "櫓から、影が止まるか見届ける"), method("feather", "吹き流しに絡んだ羽を眺める")], false, "櫓の下は強い上昇風の通り道で、影は止まらず高度を上げた。羽が落ちていても、巣の証拠にはならない。岩陰へ消えた先がまだ残っている。")
      ], method: "wait", incomplete: "羽は休憩や通過でも落ちる。縄を越えずに待つと、魚を運ぶ一頭がどこで止まるか見分けられそうだ。",
      finding: { title: "縄の向こう、帰るための岩棚", kind: "nest", spotId: "tsubasa_dana", image: "images/konron/spots/tsubasa_dana.webp", body: "見物道の縄の手前で待つと、餌を持つ一頭が岩陰で止まり、小さな首が二つ伸びた。休憩する表の棚のさらに奥に、巣があった。近寄らずに見つけたからこそ、親竜はいつもの往復を続けている。", reply: "見物道の手入れをする人が、声を落とした。『ここからでも見つけたんだね。なら、あの縄の意味も一緒に覚えていて』" },
      plans: [{ id: "quiet", label: "帰れる岩棚の静けさを残す", detail: "竜の暮らしと見物道の境界を守る企画。捕獲やスカウト成功にはしない。", investment: "dragon" }, { id: "watch", label: "近寄らず見られる場所を整える", detail: "人が安全に待てる道と案内を優先する企画。巣へ入れるようにはしない。", investment: "public" }]
    },
    {
      id: "pasture", title: "走らない日も、竜の居場所は？", question: "草、水、雨を避ける場所。野の竜の道や人の田を奪わず、休める土地を見つけたい。", evidence: ["water_fork", "rest_ledger"],
      hypotheses: [
        hypothesis("bank", "水場の人側にある、高い草地を調べる", "水から少し離れた高みなら、通り道を残せるかもしれない。", "ryu_mizunomi", [method("paths", "水際・高み・竜の通り道を見比べる"), method("grass", "草丈と踏み跡から、土地の使われ方を読む")], true),
        hypothesis("rice", "棚田のいちばん上を囲えばよい", "水も餌もあり、竜が食べに来る場所だ。", "tanada", [method("paths", "誰が使う一枚か、田の人に聞く"), method("grass", "広さと水の近さを測る")], false, "そこは野の竜のために刈らずに残す一枚だった。柵で囲えば、今まで来られた竜を締め出してしまう。空いて見える土地にも、すでに役割がある。"),
        hypothesis("cliff", "見晴らしのよい岩棚を牧場にする", "人の建物が少ないので、広く使えそうだ。", "tsubasa_dana", [method("paths", "足場と、竜が出入りする道を見る"), method("grass", "見物道から広さを眺める")], false, "岩棚は翼で出入りする竜のための場所で、水や退避路も揃わない。見物道の外を空地として扱うのは違う。地上で休む竜の条件に戻ろう。")
      ], method: "paths", incomplete: "草丈の低い帯に、竜が繰り返し通る跡があった。空き地ではなく使われている土地だとわかったが、大雨の時にどこへ逃げるかはまだ見えない。水際と高い場所の間を見比べたい。",
      finding: { title: "水場を塞がない、牧場の候補地", kind: "pasture_candidate", spotId: "ryu_mizunomi", image: "images/konron/spots/ryu_mizunomi.webp", body: "人側の高い草地から、水場と林の間に一本の通り道を残せることがわかった。ここを候補として図にした。土地の利用や世話の人、工事はこれからで、まだ牧場が建ったわけではない。", reply: "世話係は図の空白を指した。『ここを空けておけば、野の子も水へ来られる。何を建てるかだけじゃなく、残す道まで考えてくれたんだね』" },
      built: { title: "牧場のために残す、水場への道", kind: "pasture_route", body: "すでに拓いた牧場を念頭に、水場の人側の高みと、野の竜の通り道を図へ残した。既存の牧場を新たに建てた記録ではなく、周囲の水と退避の条件を調べ直した記録だ。" },
      plans: [{ id: "rest", label: "休める場所と、世話する人を支える", detail: "竜の暮らしを優先する企画。未建設なら候補地のまま、既存の竜分野の投資へつなげる。", investment: "dragon" }, { id: "feed", label: "田や水場と、無理なく分け合う", detail: "餌を育てる人と水の使い方を相談する企画。田や野の竜の道を取り上げない。", investment: "industry" }]
    },
    {
      id: "history", title: "古い印は、何を待っていた？", question: "古布の線と、沖を向く鳥居。神秘と決めつける前に、暮らしの中で確かめられる跡を探す。", evidence: ["cloth_marks", "gate_seaward"],
      hypotheses: [
        hypothesis("shore", "浜の印は、潮を待つ暮らしの記録", "布の『満ちるまで』と護岸の高さが対応するのでは。", "shiranami", [method("compare", "潮の濡れ跡の高さと、布の線を比べる"), method("shape", "石の刻みと、布の模様を写し取る")], true),
        hypothesis("street", "新しい街の区画を測った印", "線がいくつもあるので、道の幅を示す図かもしれない。", "ohzuba", [method("compare", "通りの目地と古布の間隔を比べる"), method("shape", "翼形の飾りを探す")], false, "通りの目地は等間隔だが、布の横線はそうではなかった。新しい街の飾りに似ていても、同じ使い道とは言えない。『満ちるまで』の言葉が説明できずに残る。"),
        hypothesis("palace", "古布の印は、元宮の儀礼に関わる", "祭祀布に残る印なら、島の始まりの作法かもしれない。", "rondo", [method("compare", "参道の公開遠景と、写しを比べる"), method("shape", "霧の向こうに似た輪郭を探す")], false, "遠景だけでは、布の線を祭壇の図と結びつけられない。立入りはここまで。古いという理由だけで聖物と決めず、実際に照合できる浜の跡へ戻ろう。")
      ], method: "compare", incomplete: "写しには、同じ幅ではない線が残った。形の対応はあるが、なぜ高さが違うのかはまだ不明だ。石の濡れ跡と『満ちるまで』の言葉を合わせると、用途まで読めるだろうか。",
      finding: { title: "観光の前からあった、潮待ちの目印", kind: "shore_history", spotId: "shiranami", image: "images/konron/spots/furununo.webp", body: "布の写しと護岸の刻みは、低い潮・舟を寄せられる潮の違いを対応させていた。古布屋の店主が、浜で働く人の説明と一緒に記録してくれた。元宮の秘密を解いたのではない。新しい街の下で続く、舟を迎える日常を一つ見つけた。", reply: "店主は古布をたたみ直した。『きれいな柄、で終わらなかったね。明日はこの布の隣に、その潮の話も置いておこう』" },
      plans: [{ id: "record", label: "暮らしの由来を、読める形で残す", detail: "公開の場所で歴史を学べる案内を優先する企画。聖域の開放ではない。", investment: "public" }, { id: "craft", label: "語れる店と、繕う仕事を残す", detail: "古布をただの土産にせず、使い道を伝える商いを支える企画。", investment: "commerce" }]
    },
    {
      id: "trade", title: "島にあるもの、島に足りないもの", question: "名産を作れても、外へ届けられるとは限らない。港の行きと帰りに、何が積まれているのだろう。", evidence: ["vinegar_crates", "return_cargo"],
      hypotheses: [
        hypothesis("roundtrip", "瓶の不足には、港での受け渡しも関係する", "港にある瓶が、工房で使える瓶とは限らない。未受領の札の行先を追いたい。", "kirimina", [method("labels", "入出荷札と、戻り瓶の分類・受渡し先を照合する"), method("count", "積荷の量と、戻った空箱の数を比べる")], true),
        hypothesis("all_local", "輸入瓶を増やせば、工房の瓶不足を解消できる", "注文があるのに器が足りないなら、外の窯元から多く仕入れるのが先では。", "tsubo_roji", [method("labels", "注文に必要な瓶と、職人の受取帳を照合する"), method("count", "空瓶待ちの注文数と、入荷予定を比べる")], false, "職人の受取帳では、新しい瓶が必要な注文と、回収瓶を使える注文が分かれていた。後者は港に戻った数があるのに受取欄が空白だ。『仕分けも、こちらへの引渡しもまだなんだ』。輸入を増やすだけでは、この待ち時間の理由は解けない。"),
        hypothesis("retail", "モールへ運べば、容器不足もなくなる", "大きな売場なら、余ったものをまとめて売れそうだ。", "mall", [method("labels", "売場の入荷票と空瓶の返却先を聞く"), method("count", "陳列棚の広さを比べる")], false, "売場を広げても、島外へ送る瓶が自然に増えるわけではない。店の人は『返せる器は返したい』と話す。売る場所と、物を巡らせる道を分けて考えよう。")
      ], method: "labels", incomplete: "空瓶はあるが、形も返し先も揃っていなかった。箱の数だけでは、今どの工房で使えるかはわからない。新しい瓶、戻り瓶、送り出す品の札と受渡し先を並べてみたい。",
      finding: { title: "港の裏側を巡る、空瓶と果実酢", kind: "trade_route", spotId: "kirimina", image: "images/konron/discovery/cargo_exchange.webp", body: "荷札を照合すると、島外から迎える新しい瓶、島の店から戻る瓶、島の実を加工して送り出す酢がつながった。『未受領』の戻り瓶は、形ごとの仕分けと工房への引渡しを待っている。器そのものが足りない注文と、器が届かず待つ注文は違う。作る力だけでなく、回収と受渡しの流れまで記録した。", reply: "荷役の人は、まだ渡せていない箱に目をやった。『港に着いたら終わりじゃないんだね。あの工房の手に届くまでが、この荷の続きなんだ』" },
      plans: [{ id: "harbor", label: "港から工房への、受渡しを途切れさせない", detail: "小口の荷と戻り瓶の置場・引渡し経路を優先する企画。仕分けが済んだ扱いや貿易収入の発生にはしない。", investment: "infra" }, { id: "makers", label: "工房で使える器を、回収から考える", detail: "瓶の形と用途をそろえ、必要な輸入と再利用を相談する企画。工房建設や売上増を達成扱いにしない。", investment: "industry" }]
    }
  ];
  OBS.push(...stories.observations);
  CASES.push(...stories.cases);
  const caseOf = id => CASES.find(c => c.id === id);
  const obsOf = id => OBS.find(o => o.id === id);
  const hypOf = (c, id) => c && c.hypotheses.find(h => h.id === id);
  const ctxOf = raw => ({ enabled: !!(raw && raw.enabled === true), openSpots: raw && Array.isArray(raw.openSpots) ? Object.keys(SPOTS).filter(id => raw.openSpots.includes(id)) : [], currentSpotId: raw && Object.hasOwn(SPOTS, raw.currentSpotId) ? raw.currentSpotId : null, dragonLevel: raw && Number.isInteger(raw.dragonLevel) ? Math.max(0, Math.min(8, raw.dragonLevel)) : 0, companionId: company(raw && raw.companionId) && Array.isArray(raw.availableCompanions) && raw.availableCompanions.includes(raw.companionId) ? raw.companionId : null });
  const validEvidence = (ids, c, held) => Array.isArray(ids) && ids.length === 2 && new Set(ids).size === 2 && ids.every(id => c.evidence.includes(id) && held.includes(id));
  function normalize(raw) {
    const r = raw && raw.version === 1 ? raw : {};
    const state = { version: 1, evidence: OBS.filter(o => Array.isArray(r.evidence) && r.evidence.includes(o.id)).map(o => o.id), selected: {}, attempts: {}, toolUse:{}, findings: {}, plans: {}, notice: null };
    for (const c of CASES) {
      const s = r.selected && r.selected[c.id], h = hypOf(c, s && s.hypothesisId);
      if (h && validEvidence(s.evidenceIds, c, state.evidence)) state.selected[c.id] = { hypothesisId: h.id, evidenceIds: s.evidenceIds.slice() };
      const seen = new Set();
      state.attempts[c.id] = (r.attempts && Array.isArray(r.attempts[c.id]) ? r.attempts[c.id] : []).filter(a => {
        const ah = hypOf(c, a && a.hypothesisId), key = a && a.hypothesisId + ":" + a.methodId;
        return ah && ah.methods.some(m => m.id === a.methodId) && !seen.has(key) && seen.add(key);
      }).map(a => ({ hypothesisId: a.hypothesisId, methodId: a.methodId }));
      const proof=state.attempts[c.id].some(a=>hypOf(c,a.hypothesisId).correct&&a.methodId===c.method)&&validEvidence(c.evidence,c,state.evidence);
      if(c.practice&&proof){const u=r.toolUse&&r.toolUse[c.id]||{},ids=c.practice.choices.map(a=>a.id),tried=ids.filter(id=>Array.isArray(u.tried)&&u.tried.includes(id));state.toolUse[c.id]={tried,lastAction:tried.includes(u.lastAction)?u.lastAction:null,...(tried.includes(c.practice.success)?{successfulCompanionId:company(u.successfulCompanionId)}:{})};}
      const f = r.findings && r.findings[c.id], fh = hypOf(c, f && f.hypothesisId);
      if (fh && fh.correct && validEvidence(f.evidenceIds, c, state.evidence) && state.attempts[c.id].some(a => a.hypothesisId === fh.id && a.methodId === c.method) && (!f.toolConfirmed||c.practice&&state.toolUse[c.id]?.tried.includes(c.practice.success))) {
        const kind = c.id === "pasture" && f.kind === "pasture_route" ? "pasture_route" : c.finding.kind;
        state.findings[c.id] = { id: c.id, hypothesisId: fh.id, evidenceIds: f.evidenceIds.slice(), kind, companionId: company(f.companionId) };
        if(f.toolConfirmed)state.findings[c.id].toolConfirmed=true;
        const plan = c.plans.find(p => r.plans && p.id === r.plans[c.id]);
        if (plan) state.plans[c.id] = plan.id;
      }
    }
    // Notices are derived from whitelisted actions, never arbitrary save text.
    if (r.notice && ["observation", "proposal", "inspection", "plan", "practice"].includes(r.notice.type)) {
      if (r.notice.type === "observation" && state.evidence.includes(r.notice.id)) state.notice = { type: "observation", id: r.notice.id };
      const c = caseOf(r.notice.id);
      if(c&&r.notice.type==='practice'&&state.toolUse[c.id])state.notice={type:'practice',id:c.id};
      if (c && ((r.notice.type === "proposal" && state.selected[c.id]) || (r.notice.type === "plan" && state.plans[c.id]))) state.notice = { type: r.notice.type, id: c.id };
      if (c && r.notice.type === "inspection" && state.attempts[c.id].some(a => a.hypothesisId === r.notice.hypothesisId && a.methodId === r.notice.methodId)) {
        const result = inspectionResult(c, hypOf(c, r.notice.hypothesisId), r.notice.methodId);
        if (result.outcome !== "found" || state.findings[c.id]) state.notice = { type: "inspection", id: c.id, hypothesisId: r.notice.hypothesisId, methodId: r.notice.methodId };
      }
    }
    return state;
  }
  function observe(raw, observationId, ctx) {
    const s = normalize(raw), c = ctxOf(ctx), o = obsOf(observationId);
    if (!c.enabled || !o || c.currentSpotId !== o.spotId || !c.openSpots.includes(o.spotId)) return s;
    if (!s.evidence.includes(o.id)) s.evidence.push(o.id);
    s.notice = { type: "observation", id: o.id };
    return s;
  }
  function propose(raw, caseId, hypothesisId, evidenceIds, ctx) {
    const s = normalize(raw), cx = ctxOf(ctx), c = caseOf(caseId), h = hypOf(c, hypothesisId);
    if (!cx.enabled || !h || (h.archived && s.selected[c.id]?.hypothesisId !== h.id && !s.attempts[c.id].some(a => a.hypothesisId === h.id)) || !cx.openSpots.includes(h.spotId) || !validEvidence(evidenceIds, c, s.evidence)) return s;
    s.selected[c.id] = { hypothesisId: h.id, evidenceIds: evidenceIds.slice() };
    s.notice = { type: "proposal", id: c.id };
    return s;
  }
  function inspectionResult(c, h, methodId) {
    if (!h.correct) return { outcome: "refuted", title: c.id === "trade" && h.id === "all_local" ? "一部は説明できた。別の待ちもあった" : "この場所では、説明が合わなかった", body: h.feedback };
    if (methodId !== c.method) return { outcome: "inconclusive", title: h.frames ? "印を付けた時、動いたのは……" : "まだ、確かめきれていない", body: h.results?.[methodId] || c.incomplete };
    return { outcome: "found", title: "手掛かりが、ひとつの場所につながった", body: "見つけた場所と、その場所を支える人の話を記録した。" };
  }
  function inspect(raw, caseId, methodId, ctx) {
    const s = normalize(raw), cx = ctxOf(ctx), c = caseOf(caseId), selected = c && s.selected[c.id], h = hypOf(c, selected && selected.hypothesisId);
    if (!cx.enabled || !h || cx.currentSpotId !== h.spotId || !cx.openSpots.includes(h.spotId) || !h.methods.some(m => m.id === methodId)) return s;
    if (c.id === 'dragon_trace' && s.findings[c.id]) return s;
    if (!s.attempts[c.id].some(a => a.hypothesisId === h.id && a.methodId === methodId)) s.attempts[c.id].push({ hypothesisId: h.id, methodId });
    if (inspectionResult(c, h, methodId).outcome === "found" && c.practice && !s.findings[c.id]) {s.toolUse[c.id]=s.toolUse[c.id]||{tried:[],lastAction:null};s.notice={type:'practice',id:c.id};return s;}
    if (inspectionResult(c, h, methodId).outcome === "found" && c.practice && s.findings[c.id]) {s.notice={type:'inspection',id:c.id,hypothesisId:h.id,methodId};return s;}
    if (inspectionResult(c, h, methodId).outcome === "found") s.findings[c.id] = { id: c.id, hypothesisId: h.id, evidenceIds: selected.evidenceIds.slice(), kind: c.id === "pasture" && (cx.dragonLevel >= 4 || s.findings[c.id] && s.findings[c.id].kind === "pasture_route") ? "pasture_route" : c.finding.kind, companionId: s.findings[c.id] ? s.findings[c.id].companionId : cx.companionId };
    s.notice = { type: "inspection", id: c.id, hypothesisId: h.id, methodId };
    return s;
  }
  function tryTool(raw,caseId,actionId,ctx){
    const s=normalize(raw),cx=ctxOf(ctx),c=caseOf(caseId);
    if(!cx.enabled||!c?.practice||!s.toolUse[c.id]||s.findings[c.id]||cx.currentSpotId!==c.finding.spotId||!cx.openSpots.includes(c.finding.spotId)||!c.practice.choices.some(a=>a.id===actionId))return s;
    const u=s.toolUse[c.id];
    if(actionId===c.practice.success&&!u.tried.includes(actionId))u.successfulCompanionId=cx.companionId;
    if(!u.tried.includes(actionId))u.tried.push(actionId);
    u.lastAction=actionId;s.notice={type:'practice',id:c.id};return normalize(s);
  }
  function acceptKeepsake(raw,caseId,ctx){
    const s=normalize(raw),cx=ctxOf(ctx),c=caseOf(caseId);
    if(!cx.enabled||!c?.practice||s.findings[c.id]||!s.toolUse[c.id]?.tried.includes(c.practice.success)||cx.currentSpotId!==c.finding.spotId||!cx.openSpots.includes(c.finding.spotId))return s;
    const a=s.attempts[c.id].find(a=>hypOf(c,a.hypothesisId).correct&&a.methodId===c.method);
    s.findings[c.id]={id:c.id,hypothesisId:a.hypothesisId,evidenceIds:c.evidence.slice(),kind:c.finding.kind,companionId:s.toolUse[c.id].successfulCompanionId,toolConfirmed:true};
    s.notice={type:'inspection',id:c.id,hypothesisId:a.hypothesisId,methodId:a.methodId};return s;
  }
  function plan(raw, caseId, optionId, ctx) {
    const s = normalize(raw), cx = ctxOf(ctx), c = caseOf(caseId), p = c && c.plans.find(p => p.id === optionId);
    if (!cx.enabled || !p || !s.findings[c.id]) return s;
    s.plans[c.id] = p.id; s.notice = { type: "plan", id: c.id }; return s;
  }
  function findingView(c, saved) {
    if (!saved) return null;
    return { id: c.id, ...copy(c.finding), ...copy(hypOf(c, saved.hypothesisId)?.finding || {}), ...(saved.kind === "pasture_route" ? copy(c.built) : {}), ...(c.practice&&!saved.toolConfirmed?{body:'サヨの修理帳と写しで、継ぎ目と工房印が重なった。舟の命綱を結び直した渡し環は、今も網に糸を渡す仕事に使われている。原品は仕事台に残し、旅の記念には練習用の小さな環を受け取った。'}:{}), companionId: company(saved.companionId) };
  }
  function noticeView(s) {
    const n = s.notice; if (!n) return null;
    if (n.type === "observation") { const o = obsOf(n.id); return { title: o.title, body: o.body }; }
    const c = caseOf(n.id);
    if(n.type==='practice'){const u=s.toolUse[c.id];return {title:u.lastAction===c.practice.success?'糸が、向こうの網目に届いた':'道具を借りて、用途を確かめる',body:u.lastAction?c.practice.responses[u.lastAction]:'サヨが練習用の環と糸を差し出した。「写しの傷が、どんな手つきで付いたのか。やってみる？」'};}
    if (n.type === "proposal") { const h = hypOf(c, s.selected[c.id].hypothesisId); return { title: "この見立てを、現地へ持っていく", body: SPOTS[h.spotId] + "で確かめよう。まだ発見したわけではなく、違うとわかっても見立てを直せる。" }; }
    if (n.type === "plan") { const p = c.plans.find(p => p.id === s.plans[c.id]); return { title: "守りたい流れを、企画書に残した", body: p.detail + " 建設や投資はまだ実行していません。" }; }
    const h = hypOf(c, n.hypothesisId), result = inspectionResult(c, h, n.methodId);
    return result.outcome === "found" ? { title: findingView(c, s.findings[c.id]).title, body: findingView(c, s.findings[c.id]).reply } : { title: result.title, body: result.body };
  }
  function getView(raw, ctx) {
    const s = normalize(raw), cx = ctxOf(ctx);
    if (!cx.enabled) return { available: false, observations: [], cases: [], notice: null };
    const cases = CASES.filter(c => c.evidence.some(id => s.evidence.includes(id))).map(c => {
      // Keep the water tutorial's order; later fieldwork must not be solved by
      // always choosing the first button. Rotation is stable, not random.
      const order = CASES.indexOf(c), turn = order === 0 ? 0 : 1 + (order - 1) % 2;
      const rotate = (items, n) => items.slice(n).concat(items.slice(0, n));
      const evidence = c.evidence.filter(id => s.evidence.includes(id)).map(id => copy(obsOf(id))), selected = s.selected[c.id] || null, h = hypOf(c, selected && selected.hypothesisId);
      const visible = c.hypotheses.filter(h => !h.archived || selected?.hypothesisId === h.id || s.attempts[c.id].some(a => a.hypothesisId === h.id));
      const hypotheses = rotate(visible, turn).filter(h => cx.openSpots.includes(h.spotId)).map(h => ({ id: h.id, label: h.label, reason: h.reason, spotId: h.spotId, spotName: SPOTS[h.spotId], available: true }));
      const p = c.plans.find(p => p.id === s.plans[c.id]);
      const closedSources=c.evidence.filter(id=>!s.evidence.includes(id)&&!cx.openSpots.includes(obsOf(id).spotId));
      const gates=ctx&&ctx.spotUnlockAt||{};
      const threshold=Math.max(0,...closedSources.map(id=>{const n=gates[obsOf(id).spotId];return Number.isFinite(n)&&n>=0?n:0;}));
      const question = c.id === 'dragon_trace' && evidence.length < 2
        ? s.evidence.includes('trace_toes') ? '爪先の向いた風上には、風見の櫓が見えた。そこから、風と竜の動きを一緒に見られるだろうか。' : '羽の裏と、風の切れ目で止まる影。水のみ場にも、同じ向きで止まる跡があるだろうか。'
        : c.question;
      return { id: c.id, title: c.title, question, evidence, canPropose: evidence.length >= 2 && hypotheses.length > 0, hypotheses, selected: copy(selected),
        continuationGate:closedSources.length?{requiredAssets:threshold||null}:null,
        practice:c.practice&&s.toolUse[c.id]&&!s.findings[c.id]?{prompt:c.practice.prompt,choices:copy(c.practice.choices),lastAction:s.toolUse[c.id].lastAction,joined:s.toolUse[c.id].tried.includes(c.practice.success),response:s.toolUse[c.id].lastAction?c.practice.responses[s.toolUse[c.id].lastAction]:null,spotId:c.finding.spotId}:null,
        inspection: h && cx.openSpots.includes(h.spotId) ? { spotId: h.spotId, prompt: h.prompt || "見立てを支えるものと、合わないものを現地で確かめる。", frames: h.frames ? copy(h.frames) : null, methods: copy(rotate(h.methods, order % 2)), available: cx.currentSpotId === h.spotId } : null,
        refutations: s.attempts[c.id].map(a => ({ hypothesisId: a.hypothesisId, methodId: a.methodId, spotId: hypOf(c, a.hypothesisId).spotId, ...inspectionResult(c, hypOf(c, a.hypothesisId), a.methodId) })).filter(r => r.outcome !== "found"),
        finding: findingView(c, s.findings[c.id]), plans: s.findings[c.id] ? copy(c.plans) : [], plan: p ? { ...copy(p), status: "proposal" } : null };
    });
    const hints = [];
    if(cx.currentSpotId==='hoshiuo'&&cx.openSpots.includes('hoshiuo')&&s.evidence.includes('ring_rubbing')&&!s.evidence.includes('ring_mending')) hints.push({title:'網を繕う人のことを、漁師に聞く',body:'「古い環を使う人？　この村の網も頼むよ。うちにはいつも居なくて、霧港の荷揚げ場の仕事台にいるんだ」。魚箱の脇に、繕いに出す網が束ねてあった。'});
    if(cx.currentSpotId==='tsubasa_dana'&&cx.openSpots.includes('tsubasa_dana')&&s.evidence.includes('trace_toes')&&!s.evidence.includes('trace_quill')) hints.push({title:'風見の櫓なら、同じ高さで風が見える',body:'岩棚には竜の影がある。ただ、水のみ場の足跡だけでは、どの竜が何を待つのかはわからない。向こうの風見の櫓では、布の旗が影と同じ高さで揺れている。近寄る前に、あそこから向きと風を見比べてみたい。'});
    return { available: true, observations: OBS.filter(o => o.spotId === cx.currentSpotId && cx.openSpots.includes(o.spotId)).map(o => ({ ...copy(o), collected: s.evidence.includes(o.id) })), hints,cases, notice: noticeView(s) };
  }
  function exportDiscoveries(raw) {
    const s = normalize(raw);
    return CASES.filter(c => s.findings[c.id]).map(c => ({ version: 1, caseId: c.id, kind: s.findings[c.id].kind, evidenceIds: s.findings[c.id].evidenceIds.slice(), hypothesisId: s.findings[c.id].hypothesisId, planId: s.plans[c.id] || null, companionId: company(s.findings[c.id].companionId),...(s.findings[c.id].toolConfirmed?{toolConfirmed:true}:{}) }));
  }
  function normalizeExport(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set(), result = [];
    for (const item of raw.slice(0, 20)) {
      const c = caseOf(item && item.caseId), h = hypOf(c, item && item.hypothesisId);
      if (!item || item.version !== 1 || !c || seen.has(c.id) || !h || !h.correct || !validEvidence(item.evidenceIds, c, c.evidence)) continue;
      if (item.kind !== c.finding.kind && !(c.id === "pasture" && item.kind === "pasture_route")) continue;
      if (item.planId != null && !c.plans.some(p => p.id === item.planId)) continue;
      seen.add(c.id);
      result.push({ version: 1, caseId: c.id, kind: item.kind, evidenceIds: item.evidenceIds.slice(), hypothesisId: h.id, planId: item.planId || null, companionId: company(item.companionId),...(c.practice&&item.toolConfirmed===true?{toolConfirmed:true}:{}) });
    }
    return result;
  }
  function describeDiscovery(raw) {
    const item = normalizeExport([raw])[0];
    if (!item) return null;
    const c = caseOf(item.caseId), p = c.plans.find(p => p.id === item.planId);
    return { finding: findingView(c, item), plan: p ? { ...copy(p), status: "proposal" } : null };
  }
  return { normalize, observe, propose, inspect, tryTool, acceptKeepsake, plan, getView, exportDiscoveries, normalizeExport, describeDiscovery };
});
