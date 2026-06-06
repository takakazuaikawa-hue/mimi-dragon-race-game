/**
 * data_dragons_ext.js — §39 図鑑コンプリート拡張：出走竜を +40頭 と、それらが出る
 * レース（第2・第3…）を追加する。data_dragons.js / data_races.js の後に読み込む。
 *
 * 設計の要：
 *  - 能力は「アーキタイプ(脚質・得意)」×「ティア(=出走ランク帯)」から自動生成し、
 *    既存12頭と同じ数値レンジ（speed等 ~50-94 / classBonus 58-90）に必ず収まる。
 *    → どのレースも“競った8頭”になり、レース結果・オッズ・配当の設計は不変。
 *  - 人気(publicImage/fanBias/recent)は hype で別途与え、強さと人気のズレ＝妙味を作る。
 *  - 見た目(意匠)はアーキタイプ既定＋色で差別化。画像は未配置でもCSSスプライトで成立。
 *  - 各レースは EARLY/MID/LATE セクション×天候×距離の組み合わせを変え、コース個性を出す。
 *  - 新40頭は全員どこかの“到達可能なレース”に必ず出走 → 図鑑コンプが到達可能。
 *
 * 既存への影響：なし（既存レースは明示8頭リストのまま）。図鑑/コレクション/コンプ報酬は
 * DRAGONS.length 基準なので自動スケール。レース計算式・オッズ式は無改変。
 */
(function () {
  if (typeof DRAGONS === "undefined") return;   // load-order guard

  // ---- アーキタイプ：脚質・能力配分(0-1)・コース適性 ----
  const ARCH = {
    speed_escape: { style: "escape", emph: { speed:1.0, fire:0.72, wing:0.55, stamina:0.5, nerve:0.48, turn:0.4 },
      course: { fire:62, straight:86, wind:55, turn:45, fog:42 } },
    fire_bruiser: { style: "escape", emph: { fire:1.0, speed:0.8, stamina:0.6, nerve:0.52, wing:0.4, turn:0.4 },
      course: { fire:90, straight:72, wind:45, turn:46, fog:36 } },
    stamina_tank: { style: "front",  emph: { stamina:1.0, nerve:0.82, fire:0.55, turn:0.55, speed:0.48, wing:0.42 },
      course: { fire:60, straight:66, wind:50, turn:60, fog:64, rolling:88 } },
    wing_closer:  { style: "late",   emph: { wing:1.0, stamina:0.68, nerve:0.62, speed:0.58, turn:0.52, fire:0.4 },
      course: { fire:45, straight:78, wind:90, turn:64, fog:72 } },
    turn_tech:    { style: "late",   emph: { turn:1.0, speed:0.62, nerve:0.62, stamina:0.55, wing:0.5, fire:0.42 },
      course: { fire:50, straight:60, wind:56, turn:90, fog:60 } },
    fog_mystic:   { style: "late",   emph: { nerve:1.0, turn:0.72, speed:0.56, stamina:0.56, wing:0.48, fire:0.36 },
      course: { fire:35, straight:60, wind:55, turn:76, fog:90 } },
    cloud_chaser: { style: "chase",  emph: { stamina:0.9, wing:0.82, nerve:0.72, turn:0.56, speed:0.5, fire:0.34 },
      course: { fire:40, straight:68, wind:76, turn:62, fog:74 } },
    allrounder:   { style: "front",  emph: { speed:0.72, stamina:0.72, turn:0.7, wing:0.7, fire:0.62, nerve:0.72 },
      course: { fire:62, straight:72, wind:66, turn:66, fog:60 } }
  };
  // アーキタイプ既定の意匠（色で個体差。特殊個体は seed.design で上書き）。
  const ARCH_DESIGN = {
    speed_escape: { build:"sleek",  wing:"membrane", wingSize:1.18, horn:"swept",   tail:"spade", body:"scale",  face:"fierce", eye:1.0,  accent:"spark" },
    fire_bruiser: { build:"sturdy", wing:"membrane", wingSize:1.1,  horn:"back",    tail:"flame", body:"scale",  face:"wild",   eye:1.0,  accent:"ember" },
    stamina_tank: { build:"heavy",  wing:"stub",     wingSize:0.72, horn:"rocky",   tail:"club",  body:"stone",  face:"stoic",  eye:0.92, accent:"none" },
    wing_closer:  { build:"sleek",  wing:"feather",  wingSize:1.4,  horn:"swept",   tail:"fin",   body:"smooth", face:"calm",   eye:1.1,  accent:"wind" },
    turn_tech:    { build:"sleek",  wing:"membrane", wingSize:1.04, horn:"swept",   tail:"fin",   body:"scale",  face:"sharp",  eye:1.02, accent:"wind", claw:"big" },
    fog_mystic:   { build:"sleek",  wing:"membrane", wingSize:1.0,  horn:"tall",    tail:"fin",   body:"smooth", face:"serene", eye:1.12, accent:"mist" },
    cloud_chaser: { build:"fluffy", wing:"fluffy",   wingSize:0.98, horn:"none",    tail:"cloud", body:"smooth", face:"sleepy", eye:0.66, accent:"sleep" },
    allrounder:   { build:"sleek",  wing:"membrane", wingSize:1.05, horn:"swept",   tail:"spade", body:"scale",  face:"calm",   eye:1.04, accent:"sparkle" }
  };
  function tierKnobs(t) {
    return { peak: 80 + (t - 1) * 2.3, floor: 48 + (t - 1) * 2, cb: Math.round(58 + (t - 1) * 5.3) };
  }
  const HYPE = {
    star:  { img:[80,92], fan:[74,90], rec:[78,92], mood:80, crowd:82, mark:"○" },
    solid: { img:[56,70], fan:[46,62], rec:[58,74], mood:60, crowd:56, mark:"▲" },
    dark:  { img:[42,54], fan:[34,48], rec:[48,60], mood:46, crowd:44, mark:"△" }
  };
  function build(seed) {
    const A = ARCH[seed.arch], T = tierKnobs(seed.tier);
    const st = {};
    ["speed", "stamina", "turn", "wing", "fire", "nerve"].forEach(k => {
      const e = (A.emph[k] != null) ? A.emph[k] : 0.5;
      let v = Math.round(T.floor + e * (T.peak - T.floor));
      if (seed.tweak && seed.tweak[k]) v += seed.tweak[k];
      st[k] = Math.max(34, Math.min(98, v));
    });
    st.classBonus = T.cb + (seed.cbAdj || 0);
    const H = HYPE[seed.hype || "solid"];
    let h = 0; for (let i = 0; i < seed.id.length; i++) h = (h * 31 + seed.id.charCodeAt(i)) >>> 0;
    const pick = (r, salt) => r[0] + ((h + salt) % (r[1] - r[0] + 1));
    return {
      id: seed.id, name: seed.name, color: seed.color, style: A.style, stats: st,
      publicImage: pick(H.img, 1), courseReputation: Object.assign({}, A.course),
      fanBias: pick(H.fan, 7), recentResult: pick(H.rec, 13),
      newspaperMark: seed.mark || H.mark, visualMood: H.mood, crowdReaction: seed.crowd || H.crowd,
      traits: seed.traits, portraitTone: seed.tone
    };
  }

  // ---- 40頭のシード（id, 名, 色, arch, tier, hype, traits, tone, 任意: mark/design/tweak） ----
  const SEEDS = [
    // tier1 (新人級)
    { id:"kogane", name:"金鱗竜コガネ",   color:"#e0b94a", arch:"allrounder",   tier:1, hype:"star",  traits:["先行","素直","人気"],     tone:"小金の鱗" },
    { id:"susu",   name:"煤煙竜スス",     color:"#7a6a5a", arch:"fire_bruiser",  tier:1, hype:"dark",  traits:["逃げ","燻し","地味"],     tone:"煤の燻り" },
    { id:"nagi",   name:"凪翼竜ナギ",     color:"#8fd0c0", arch:"wing_closer",   tier:1, hype:"solid", traits:["差し","風待ち","終い"],   tone:"凪の翼" },
    { id:"goro",   name:"轟岩竜ゴロー",   color:"#9a8466", arch:"stamina_tank",  tier:1, hype:"solid", traits:["先行","頑丈","長め"],     tone:"轟く岩" },
    { id:"chiri",  name:"塵雲竜チリ",     color:"#a99bc0", arch:"cloud_chaser",  tier:1, hype:"dark",  traits:["追込","ふらり","大穴"],   tone:"塵の雲", mark:"×" },
    // tier2
    { id:"akane",  name:"茜翼竜アカネ",   color:"#e8714a", arch:"speed_escape",  tier:2, hype:"star",  traits:["逃げ","快速","華"],       tone:"茜の翼" },
    { id:"tsumuji",name:"旋風竜ツムジ",   color:"#6cc28a", arch:"turn_tech",     tier:2, hype:"solid", traits:["差し","小回り","技"],     tone:"旋風の爪" },
    { id:"yoi",    name:"宵霧竜ヨイ",     color:"#9aa6c8", arch:"fog_mystic",    tier:2, hype:"dark",  traits:["差し","霧","気性◎"],     tone:"宵の霧" },
    { id:"hibana", name:"火花竜ヒバナ",   color:"#f0863a", arch:"fire_bruiser",  tier:2, hype:"solid", traits:["逃げ","火力","気性難"],   tone:"火花の尾" },
    { id:"shio",   name:"潮翼竜シオ",     color:"#4aa8d0", arch:"wing_closer",   tier:2, hype:"solid", traits:["差し","風","安定"],       tone:"潮の翼" },
    { id:"kabe",   name:"岩壁竜カベ",     color:"#8a7a64", arch:"stamina_tank",  tier:2, hype:"dark",  traits:["先行","耐久","地味"],     tone:"岩壁の重" },
    // tier3
    { id:"benio",  name:"紅尾竜ベニオ",   color:"#e24a52", arch:"fire_bruiser",  tier:3, hype:"star",  traits:["逃げ","火力本命","華"],   tone:"紅の尾", mark:"◎" },
    { id:"kazemaru",name:"疾風竜カゼマル",color:"#5ac0e0", arch:"speed_escape",  tier:3, hype:"solid", traits:["逃げ","軽量","快速"],     tone:"疾風の翼" },
    { id:"sazare", name:"細波竜サザレ",   color:"#58c272", arch:"turn_tech",     tier:3, hype:"solid", traits:["差し","技巧","小回り"],   tone:"細波の爪" },
    { id:"murasame",name:"叢雨竜ムラサメ",color:"#8e9ad6", arch:"fog_mystic",    tier:3, hype:"dark",  traits:["差し","雨霧","渋い"],     tone:"叢雨の角" },
    { id:"taiga",  name:"大牙竜タイガ",   color:"#a07850", arch:"stamina_tank",  tier:3, hype:"solid", traits:["先行","スタミナ","長"],   tone:"大牙の巌" },
    { id:"yumeji", name:"夢路竜ユメジ",   color:"#9d88d0", arch:"cloud_chaser",  tier:3, hype:"dark",  traits:["追込","眠","大穴"],       tone:"夢路の雲", mark:"×" },
    // tier4
    { id:"shakunetsu",name:"灼熱竜シャク",color:"#f06028", arch:"fire_bruiser",  tier:4, hype:"star",  traits:["逃げ","灼熱","本命"],     tone:"灼熱の鬣" },
    { id:"hayate", name:"颯竜ハヤテ",     color:"#48b0e8", arch:"speed_escape",  tier:4, hype:"solid", traits:["逃げ","電光","気性難"],   tone:"颯の閃" },
    { id:"arashi", name:"嵐翼竜アラシ",   color:"#5a8ad8", arch:"wing_closer",   tier:4, hype:"star",  traits:["差し","強風本命","翼"],   tone:"嵐の大翼" },
    { id:"konron", name:"崑崙竜コンロン", color:"#8e7a5c", arch:"stamina_tank",  tier:4, hype:"solid", traits:["先行","重厚","起伏◎"],   tone:"崑崙の岩" },
    { id:"shirahae",name:"白南風竜シラハエ",color:"#a0b0d0",arch:"fog_mystic",   tier:4, hype:"dark",  traits:["差し","霧◎","人気薄"],   tone:"白南風の霧" },
    { id:"kirari", name:"煌竜キラリ",     color:"#5cc888", arch:"turn_tech",     tier:4, hype:"solid", traits:["差し","技巧","小回り◎"], tone:"煌の旋" },
    // tier5 (竜王級)
    { id:"guren",  name:"紅蓮竜グレン",   color:"#e0463e", arch:"fire_bruiser",  tier:5, hype:"star",  traits:["逃げ","紅蓮","竜王級"],   tone:"紅蓮の業火", mark:"◎" },
    { id:"raijin", name:"雷迅竜ライジン", color:"#6a64e8", arch:"speed_escape",  tier:5, hype:"star",  traits:["逃げ","雷速","気性難"],   tone:"雷迅の角" },
    { id:"sora",   name:"蒼穹竜ソラ",     color:"#4a92dc", arch:"wing_closer",   tier:5, hype:"solid", traits:["差し","蒼穹","翼安定"],   tone:"蒼穹の翼" },
    { id:"banju",  name:"磐樹竜バンジュ", color:"#7a8a5c", arch:"stamina_tank",  tier:5, hype:"dark",  traits:["先行","不沈","渋い"],     tone:"磐樹の幹" },
    { id:"gekka",  name:"月華竜ゲッカ",   color:"#a088d4", arch:"fog_mystic",    tier:5, hype:"solid", traits:["差し","月夜","霧◎"],     tone:"月華の靄" },
    { id:"senpu",  name:"穿風竜センプ",   color:"#54c096", arch:"turn_tech",     tier:5, hype:"solid", traits:["差し","穿つ","小回り"],   tone:"穿風の爪" },
    // tier6 (祝祭級)
    { id:"enma",   name:"炎魔竜エンマ",   color:"#e84028", arch:"fire_bruiser",  tier:6, hype:"star",  traits:["逃げ","炎魔","祝祭本命"], tone:"炎魔の獄火", mark:"◎" },
    { id:"hayao",  name:"疾風皇竜ハヤオ", color:"#3aa0e0", arch:"speed_escape",  tier:6, hype:"star",  traits:["逃げ","皇速","看板"],     tone:"疾風皇の閃", mark:"◎" },
    { id:"tenku",  name:"天空竜テンク",   color:"#4a86e0", arch:"wing_closer",   tier:6, hype:"star",  traits:["差し","天翼","本命"],     tone:"天空の大翼" },
    { id:"gozan",  name:"豪山竜ゴウザン", color:"#8a7252", arch:"stamina_tank",  tier:6, hype:"solid", traits:["先行","豪壮","長◎"],     tone:"豪山の巌" },
    { id:"yugiri", name:"夕霧竜ユウギリ", color:"#9888c8", arch:"fog_mystic",    tier:6, hype:"dark",  traits:["差し","夕霧","妙味"],     tone:"夕霧の帳" },
    { id:"reppu",  name:"裂風竜レップウ", color:"#50c884", arch:"turn_tech",     tier:6, hype:"solid", traits:["差し","裂く","小回り◎"], tone:"裂風の刃爪" },
    // tier7 (神兎大レース級)
    { id:"goka",   name:"業火神竜ゴウカ", color:"#f03820", arch:"fire_bruiser",  tier:7, hype:"star",  traits:["逃げ","神火","最高峰"],   tone:"業火の神焔", mark:"◎", design:{ aura:"#ff7a3a" } },
    { id:"raiou",  name:"雷王竜ライオウ", color:"#6058f0", arch:"speed_escape",  tier:7, hype:"star",  traits:["逃げ","雷王","神速"],     tone:"雷王の劫雷", mark:"◎", design:{ aura:"#9a8cff" } },
    { id:"souten", name:"蒼天神竜ソウテン",color:"#3a80ea", arch:"wing_closer",  tier:7, hype:"star",  traits:["差し","蒼天","神翼"],     tone:"蒼天の神翼", mark:"◎", design:{ aura:"#8fb8ff" } },
    { id:"fugaku", name:"不岳竜フガク",   color:"#8c7858", arch:"stamina_tank",  tier:7, hype:"solid", traits:["先行","不動","鉄壁"],     tone:"不岳の鉄巌" },
    { id:"yomi",   name:"黄泉霧竜ヨミ",   color:"#9080c0", arch:"fog_mystic",    tier:7, hype:"dark",  traits:["差し","黄泉霧","伏兵"],   tone:"黄泉の霧", design:{ aura:"#7a6aa8" } }
  ];

  SEEDS.forEach(seed => {
    if (DRAGONS.some(d => d.id === seed.id)) return;        // 二重登録防止
    DRAGONS.push(build(seed));
    if (typeof DRAGON_ASSET_BASE !== "undefined") DRAGON_ASSET_BASE[seed.id] = "dragon_" + seed.id;
    if (typeof DRAGON_DESIGN !== "undefined")
      DRAGON_DESIGN[seed.id] = Object.assign({}, ARCH_DESIGN[seed.arch], seed.design || {});
  });

  // ---- 新レース（第2・第3…）。コース＝EARLY/MID/LATE×天候×距離 を変えて個性を出す ----
  // コース＝各stat を最大1セクションだけで効かせる“バランス型”に統一（独走/全滅を防ぐ）。
  // 個性は early/late・天候・距離・出走メンツの違いで出す。距離は持久メンツ以外は mid 以下。
  const NEW_RACES = [
    { id:"race_grandclock_2", region:"グランドクロック地域", cup:"新人競竜杯", number:2, rank:1, distance:"short", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"short_final_straight", purpose:"新人②：直線→旋回→直線の基本戦" },
    { id:"race_grandclock_3", region:"グランドクロック地域", cup:"新人競竜杯", number:3, rank:1, distance:"short", weather:"clear",
      early:"uphill_start", mid:"grand_turn", late:"short_final_straight", purpose:"新人③：上り坂と立ち回り" },
    { id:"race_lumina_2", region:"ルミナ地域", cup:"風翼杯", number:2, rank:2, distance:"mid", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"tailwind_straight", purpose:"風翼②：霧→旋回→追い風" },
    { id:"race_ringrosso_open", region:"リングロッソ地域", cup:"旋角杯", number:2, rank:2, distance:"short", weather:"clear",
      early:"narrow_start", mid:"grand_turn", late:"tailwind_straight", purpose:"旋角②：狭路→旋回→追い風" },
    { id:"race_mistlake_2", region:"ミストレイク地域", cup:"霧鱗杯", number:2, rank:3, distance:"mid", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"short_final_straight", purpose:"霧鱗②：霧の中の総合力" },
    { id:"race_caldera_karyu2", region:"カルデラ地域", cup:"火竜杯", number:2, rank:3, distance:"short", weather:"clear",
      early:"fire_gate_start", mid:"grand_turn", late:"short_final_straight", purpose:"火竜②：火門→旋回→直線の短距離戦" },
    { id:"race_vento_2", region:"ヴェント峡谷地域", cup:"翔風杯", number:2, rank:4, distance:"mid", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"tailwind_straight", purpose:"翔風②：直線→旋回→追い風" },
    { id:"race_notte_2", region:"ノッテムーンライト地域", cup:"月光杯", number:2, rank:5, distance:"mid", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"tailwind_straight", purpose:"月光②：竜王級の夜霧" },
    { id:"race_lapan_2", region:"ラパン祭典地域", cup:"兎神祝祭杯", number:2, rank:6, distance:"mid", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"long_final_straight", purpose:"祝祭②：看板竜の総合力勝負" },
    { id:"race_shinto_2", region:"ラパン祭典地域", cup:"神兎大レース", number:2, rank:7, distance:"marathon", weather:"clear",
      early:"long_straight_start", mid:"rolling_terrain", late:"tailwind_straight", purpose:"神兎②：最高峰の頂上決戦" }
  ];
  // 各レースの出走8頭（同ティア帯＝競った勝負。新40頭は全員どこかに必ず登場）。
  const NEW_OVERRIDES = {
    // 同パワー帯の新竜中心＋穏当な既存(poro/momu)を filler。極端な専門家(gando/seram/rosso)は外す。
    race_grandclock_2:  ["kogane","nagi","susu","goro","chiri","poro","akane","momu"],
    race_grandclock_3:  ["goro","kogane","nagi","chiri","susu","poro","tsumuji","momu"],
    race_lumina_2:      ["akane","shio","yoi","tsumuji","hibana","kabe","kogane","poro"],
    race_ringrosso_open:["tsumuji","yoi","kabe","akane","hibana","shio","nagi","momu"],
    race_mistlake_2:    ["benio","kazemaru","sazare","murasame","taiga","yumeji","hibana","poro"],
    race_caldera_karyu2:["benio","taiga","kazemaru","sazare","yumeji","murasame","akane","momu"],
    race_vento_2:       ["shakunetsu","hayate","arashi","konron","shirahae","kirari","benio","taiga"],
    race_notte_2:       ["guren","raijin","sora","banju","gekka","senpu","shakunetsu","arashi"],
    // 高ランクのみ既存エリート(phenix/stella/raika)を同格として混走。
    race_lapan_2:       ["enma","hayao","tenku","gozan","yugiri","reppu","guren","stella"],
    race_shinto_2:      ["goka","raiou","souten","fugaku","yomi","phenix","hayao","raika"]
  };

  if (typeof RACES !== "undefined") {
    NEW_RACES.forEach(r => { if (!RACES.some(x => x.id === r.id)) RACES.push(r); });
  }
  if (typeof RACE_ENTRY_OVERRIDES !== "undefined") Object.assign(RACE_ENTRY_OVERRIDES, NEW_OVERRIDES);
})();
