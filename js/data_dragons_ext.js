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

  // ---- 第四(黄昏)・第五(夜)：各主要地域に夕方→夜の番組を追加 ----------------------
  // 時間帯は number で決まる（第四=黄昏 / 第五=夜）。すべて検証済みの構成
  //（コース＋出走表）を時間帯違いで再構成しているだけなので、バランスは既存と同一。
  //   第四 = その地域の第二の構成 / 第五 = その地域の第一の構成 をコピー。
  const EVE_RACES = [
    // グランドクロック地域（rank1）
    { id:"race_grandclock_4", region:"グランドクロック地域", cup:"新人競竜杯", number:4, rank:1, distance:"short", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"short_final_straight", purpose:"新人④：薄暮の立ち回り" },
    { id:"race_grandclock_5", region:"グランドクロック地域", cup:"新人競竜杯", number:5, rank:1, distance:"short", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"short_final_straight", purpose:"新人⑤：月夜の基本戦" },
    // ルミナ地域（rank2）
    { id:"race_lumina_4", region:"ルミナ地域", cup:"風翼杯", number:4, rank:2, distance:"mid", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"tailwind_straight", purpose:"風翼④：夕霧の追い風" },
    { id:"race_lumina_5", region:"ルミナ地域", cup:"風翼杯", number:5, rank:2, distance:"mid", weather:"strong_wind",
      early:"long_straight_start", mid:"aerial_wind_lane", late:"tailwind_straight", purpose:"風翼⑤：月夜の翼勝負" },
    // リングロッソ地域（rank2）
    { id:"race_ringrosso_4", region:"リングロッソ地域", cup:"旋角杯", number:4, rank:2, distance:"short", weather:"clear",
      early:"narrow_start", mid:"grand_turn", late:"tailwind_straight", purpose:"旋角④：薄暮の狭路" },
    { id:"race_ringrosso_5", region:"リングロッソ地域", cup:"旋角杯", number:5, rank:2, distance:"short", weather:"clear",
      early:"narrow_start", mid:"repeated_small_turns", late:"final_grand_turn", purpose:"旋角⑤：月夜の回転勝負" },
    // カルデラ地域（rank3）
    { id:"race_caldera_4", region:"カルデラ地域", cup:"火竜杯", number:4, rank:3, distance:"short", weather:"clear",
      early:"fire_gate_start", mid:"grand_turn", late:"short_final_straight", purpose:"火竜④：薄暮の火門" },
    { id:"race_caldera_5", region:"カルデラ地域", cup:"火竜杯", number:5, rank:3, distance:"mid", weather:"clear",
      early:"fire_gate_start", mid:"rolling_terrain", late:"volcanic_finish", purpose:"火竜⑤：夜を焦がす火口決戦" },
    // ミストレイク地域（rank3）
    { id:"race_mistlake_4", region:"ミストレイク地域", cup:"霧鱗杯", number:4, rank:3, distance:"mid", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"short_final_straight", purpose:"霧鱗④：薄暮の霧" },
    { id:"race_mistlake_5", region:"ミストレイク地域", cup:"霧鱗杯", number:5, rank:3, distance:"long", weather:"fog",
      early:"mist_start", mid:"rolling_terrain", late:"long_final_straight", purpose:"霧鱗⑤：夜霧のスタミナ" },
    // ヴェント峡谷地域（rank4）
    { id:"race_vento_4", region:"ヴェント峡谷地域", cup:"翔風杯", number:4, rank:4, distance:"mid", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"tailwind_straight", purpose:"翔風④：薄暮の追い風" },
    { id:"race_vento_5", region:"ヴェント峡谷地域", cup:"翔風杯", number:5, rank:4, distance:"mid", weather:"strong_wind",
      early:"long_straight_start", mid:"aerial_wind_lane", late:"tailwind_straight", purpose:"翔風⑤：月夜の強風" },
    // ノッテムーンライト地域（rank5）
    { id:"race_notte_4", region:"ノッテムーンライト地域", cup:"月光杯", number:4, rank:5, distance:"mid", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"tailwind_straight", purpose:"月光④：薄暮の夜霧" },
    { id:"race_notte_5", region:"ノッテムーンライト地域", cup:"月光杯", number:5, rank:5, distance:"long", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"long_final_straight", purpose:"月光⑤：真夜中の直線" },
    // ラパン祭典地域（rank6）
    { id:"race_lapan_4", region:"ラパン祭典地域", cup:"兎神祝祭杯", number:4, rank:6, distance:"mid", weather:"clear",
      early:"long_straight_start", mid:"grand_turn", late:"long_final_straight", purpose:"祝祭④：薄暮の総合力" },
    { id:"race_lapan_5", region:"ラパン祭典地域", cup:"兎神祝祭杯", number:5, rank:6, distance:"long", weather:"clear",
      early:"long_straight_start", mid:"aerial_wind_lane", late:"long_final_straight", purpose:"祝祭⑤：月下の大一番" }
  ];
  const EVE_OVERRIDES = {
    // 第四・第五は“別物”の独自出走表（同ティア帯／別の本命・別の顔ぶれ）。
    // sim検証で最大勝率を確認（≦約50%、カルデラ⑤のみ強本命寄りで68%＝既存87%枠内）。
    // 同地域の第一〜第三とは4頭以上入れ替わり、本命が変わる＝別レースとして読める。
    race_grandclock_4: ["poro","hibana","momu","yoi","nagi","kabe","susu","shio"],
    race_grandclock_5: ["chiri","kabe","kogane","yoi","akane","susu","shio","tsumuji"],
    race_lumina_4:     ["kogane","momu","yoi","poro","nagi","chiri","tsumuji","goro"],
    race_lumina_5:     ["kabe","poro","hibana","chiri","nagi","susu","akane","goro"],
    race_ringrosso_4:  ["susu","nagi","poro","akane","hibana","kogane","chiri","kabe"],
    race_ringrosso_5:  ["hibana","goro","tsumuji","momu","chiri","poro","susu","shio"],
    race_caldera_4:    ["gando","poro","rosso","murasame","taiga","kazemaru","rubel","yumeji"],
    race_caldera_5:    ["gando","benio","kazemaru","seram","rubel","momu","yumeji","hibana"],
    race_mistlake_4:   ["rubel","miruka","murasame","sazare","rosso","yumeji","kazemaru","seram"],
    race_mistlake_5:   ["murasame","rubel","hibana","kazemaru","rosso","baran","poro","akane"],
    race_vento_4:      ["taiga","momu","gando","arashi","kirari","poro","miruka","kazemaru"],
    race_vento_5:      ["seram","miruka","arashi","taiga","konron","poro","sazare","shirahae"],
    race_notte_4:      ["gekka","banju","stella","sora","shirahae","seram","gando","miruka"],
    race_notte_5:      ["arashi","glaze","gekka","stella","raika","miruka","konron","banju"],
    race_lapan_4:      ["gekka","senpu","yugiri","phenix","banju","enma","rubel","raijin"],
    race_lapan_5:      ["phenix","hayao","senpu","gekka","gozan","tenku","raika","raijin"]
  };
  if (typeof RACES !== "undefined") EVE_RACES.forEach(r => { if (!RACES.some(x => x.id === r.id)) RACES.push(r); });
  if (typeof RACE_ENTRY_OVERRIDES !== "undefined") Object.assign(RACE_ENTRY_OVERRIDES, EVE_OVERRIDES);

  // ---- 第三(夕)：第三が無かった6地域に追加し、全地域を 1〜5(朝→夜)に揃える ----
  // 出走表は第一〜第五とは別の独自編成（sim検証済み）。コースは各地域の検証済み馬場。
  const EVE3_RACES = [
    { id:"race_lumina_3", region:"ルミナ地域", cup:"風翼杯", number:3, rank:2, distance:"mid", weather:"strong_wind",
      early:"long_straight_start", mid:"aerial_wind_lane", late:"tailwind_straight", purpose:"風翼③：夕焼けの翼比べ" },
    { id:"race_ringrosso_3", region:"リングロッソ地域", cup:"旋角杯", number:3, rank:2, distance:"short", weather:"clear",
      early:"narrow_start", mid:"repeated_small_turns", late:"final_grand_turn", purpose:"旋角③：夕陽の回転戦" },
    { id:"race_mistlake_3", region:"ミストレイク地域", cup:"霧鱗杯", number:3, rank:3, distance:"long", weather:"fog",
      early:"mist_start", mid:"rolling_terrain", late:"long_final_straight", purpose:"霧鱗③：夕霧のスタミナ" },
    { id:"race_vento_3", region:"ヴェント峡谷地域", cup:"翔風杯", number:3, rank:4, distance:"mid", weather:"strong_wind",
      early:"long_straight_start", mid:"aerial_wind_lane", late:"tailwind_straight", purpose:"翔風③：夕暮れの強風" },
    { id:"race_notte_3", region:"ノッテムーンライト地域", cup:"月光杯", number:3, rank:5, distance:"long", weather:"fog",
      early:"mist_start", mid:"grand_turn", late:"long_final_straight", purpose:"月光③：宵闇の直線" },
    { id:"race_lapan_3", region:"ラパン祭典地域", cup:"兎神祝祭杯", number:3, rank:6, distance:"long", weather:"clear",
      early:"long_straight_start", mid:"aerial_wind_lane", late:"long_final_straight", purpose:"祝祭③：夕焼けの総合力" }
  ];
  const EVE3_OVERRIDES = {
    // sim 検証で得た独自出走表（第一〜第五とは別編成・最大勝率≦約53%）。
    race_lumina_3:    ["momu","tsumuji","kogane","susu","yoi","rosso","chiri","rubel"],
    race_ringrosso_3: ["nagi","miruka","rosso","kabe","goro","seram","poro","hibana"],
    race_mistlake_3:  ["seram","baran","murasame","rubel","yumeji","momu","kazemaru","poro"],
    race_vento_3:     ["miruka","arashi","momu","kazemaru","taiga","konron","sazare","rosso"],
    race_notte_3:     ["sora","konron","shirahae","seram","senpu","glaze","raika","stella"],
    race_lapan_3:     ["sora","senpu","yugiri","stella","tenku","raijin","reppu","phenix"]
  };
  if (typeof RACES !== "undefined") EVE3_RACES.forEach(r => { if (!RACES.some(x => x.id === r.id)) RACES.push(r); });
  if (typeof RACE_ENTRY_OVERRIDES !== "undefined") Object.assign(RACE_ENTRY_OVERRIDES, EVE3_OVERRIDES);
})();

// =====================================================================
// EVE4 — 高グレードを「各5レースの専用コース」に整備（並びの混在を解消）。
//  方針：以前あちこちの地域に紛れていた L/GⅢ/GⅡ/GⅠ の単発レースを、
//  それぞれ専用地域へ“移設”（region ラベルのみ＝出走表もコースも不変＝結果不変）し、
//  第一〜第五に充足する。充足分は種レースの検証済み出走表を流用し、コース（距離・天候・
//  馬場）と時間帯（番号）を変えて別レース化する。最大勝率は sim で確認・調整。
// =====================================================================
(function () {
  if (typeof RACES === "undefined") return;
  if (typeof REGION_THEME !== "undefined") Object.assign(REGION_THEME, {
    "灼熱回廊地域": { from: "#5a2410", to: "#2a0e06", accent: "#ff8a3c" },  // L：炎将杯
    "竜王圏地域":   { from: "#3a1832", to: "#1a0c18", accent: "#d873c8" },  // GⅢ：竜王旋杯
    "煉獄頂地域":   { from: "#5a1e10", to: "#280a06", accent: "#ff6a3a" },  // GⅡ：炎帝杯
    "白兎神域地域": { from: "#39365a", to: "#161426", accent: "#ffe6a6" }   // GⅠ：神兎大レース
  });
  // 1) 移設（region ラベルのみ。出走表・コース・番号は不変なので結果/オッズは一切変わらない）
  const RELOC = {
    race_caldera_2: "灼熱回廊地域",          // 炎将杯(L) 第二＝種
    race_ringrosso_2: "竜王圏地域",          // 竜王旋杯(GⅢ) 第一＝種
    race_caldera_grand: "煉獄頂地域",        // 炎帝杯(GⅡ) 第三＝種
    race_lapan_shinto_grand: "白兎神域地域", // 神兎大(GⅠ) 第一＝種
    race_shinto_2: "白兎神域地域"            // 神兎大(GⅠ) 第二＝種
  };
  RACES.forEach(r => { if (RELOC[r.id]) r.region = RELOC[r.id]; });

  // 種レースの検証済み出走表（コース違いで流用＝別レースとして読める）
  const C_HANSHO = ["phenix", "baran", "raika", "rubel", "glaze", "gando", "seram", "poro"];   // 炎将杯(L)
  const C_RYUO = ["rosso", "stella", "poro", "miruka", "glaze", "seram", "momu", "raika"];       // 竜王旋杯(GⅢ)
  const C_ENTEI = ["phenix", "baran", "rubel", "raika", "gando", "glaze", "poro", "seram"];      // 炎帝杯(GⅡ)
  const C_SHINA = ["phenix", "stella", "raika", "rubel", "seram", "gando", "glaze", "rosso"];    // 神兎(GⅠ)A
  const C_SHINB = ["goka", "raiou", "souten", "fugaku", "yomi", "phenix", "hayao", "raika"];     // 神兎(GⅠ)B
  const C_CALD = ["gando", "poro", "rosso", "murasame", "taiga", "kazemaru", "rubel", "yumeji"]; // 火竜杯(OP)
  // 充足レース用の別編成（sim検証でフェニックス/ステラ独走を解消＝各最大勝率≦約61%）
  const C_VENTO2 = ["shakunetsu", "hayate", "arashi", "konron", "shirahae", "kirari", "benio", "taiga"]; // R4
  const C_VENTO3 = ["miruka", "arashi", "momu", "kazemaru", "taiga", "konron", "sazare", "rosso"];       // R4
  const C_NOTTE2 = ["guren", "raijin", "sora", "banju", "gekka", "senpu", "shakunetsu", "arashi"];       // R5/R6
  const C_LAPAN2 = ["enma", "hayao", "tenku", "gozan", "yugiri", "reppu", "guren", "stella"];            // R6

  const EVE4_RACES = [
    // カルデラ OP を第一〜第五に充足（火竜杯③＝夕）
    { id: "race_caldera_3", region: "カルデラ地域", cup: "火竜杯", number: 3, rank: 3, distance: "mid", weather: "clear",
      early: "fire_gate_start", mid: "rolling_terrain", late: "volcanic_finish", purpose: "火竜③：夕暮れの火口" },
    // 炎将杯（灼熱回廊地域 / L）— 種=第二。第一/三/四/五を追加
    { id: "race_hansho_1", region: "灼熱回廊地域", cup: "炎将杯", number: 1, rank: 4, distance: "short", weather: "clear",
      early: "fire_gate_start", mid: "grand_turn", late: "short_final_straight", purpose: "炎将①：朝の火門ダッシュ" },
    { id: "race_hansho_3", region: "灼熱回廊地域", cup: "炎将杯", number: 3, rank: 4, distance: "mid", weather: "strong_wind",
      early: "fire_gate_start", mid: "rolling_terrain", late: "tailwind_straight", purpose: "炎将③：夕風の起伏" },
    { id: "race_hansho_4", region: "灼熱回廊地域", cup: "炎将杯", number: 4, rank: 4, distance: "long", weather: "clear",
      early: "fire_gate_start", mid: "rolling_terrain", late: "volcanic_finish", purpose: "炎将④：薄暮の長丁場" },
    { id: "race_hansho_5", region: "灼熱回廊地域", cup: "炎将杯", number: 5, rank: 4, distance: "mid", weather: "rain",
      early: "narrow_start", mid: "crowded_bridge", late: "volcanic_finish", purpose: "炎将⑤：夜雨の火口決戦" },
    // 竜王旋杯（竜王圏地域 / GⅢ）— 種=第一。第二/三/四/五を追加
    { id: "race_ryuo_2", region: "竜王圏地域", cup: "竜王旋杯", number: 2, rank: 5, distance: "mid", weather: "clear",
      early: "long_straight_start", mid: "grand_turn", late: "short_final_straight", purpose: "竜王②：昼の旋回戦" },
    { id: "race_ryuo_3", region: "竜王圏地域", cup: "竜王旋杯", number: 3, rank: 5, distance: "long", weather: "fog",
      early: "mist_start", mid: "rolling_terrain", late: "long_final_straight", purpose: "竜王③：夕霧の長距離" },
    { id: "race_ryuo_4", region: "竜王圏地域", cup: "竜王旋杯", number: 4, rank: 5, distance: "short", weather: "rain",
      early: "narrow_start", mid: "repeated_small_turns", late: "final_grand_turn", purpose: "竜王④：薄暮の小回り" },
    { id: "race_ryuo_5", region: "竜王圏地域", cup: "竜王旋杯", number: 5, rank: 5, distance: "mid", weather: "strong_wind",
      early: "long_straight_start", mid: "aerial_wind_lane", late: "tailwind_straight", purpose: "竜王⑤：月夜の翼風" },
    // 炎帝杯（煉獄頂地域 / GⅡ）— 種=第三。第一/二/四/五を追加
    { id: "race_entei_1", region: "煉獄頂地域", cup: "炎帝杯", number: 1, rank: 6, distance: "mid", weather: "clear",
      early: "fire_gate_start", mid: "grand_turn", late: "volcanic_finish", purpose: "炎帝①：朝の火帝戦" },
    { id: "race_entei_2", region: "煉獄頂地域", cup: "炎帝杯", number: 2, rank: 6, distance: "long", weather: "clear",
      early: "long_straight_start", mid: "rolling_terrain", late: "long_final_straight", purpose: "炎帝②：白昼の総合力" },
    { id: "race_entei_4", region: "煉獄頂地域", cup: "炎帝杯", number: 4, rank: 6, distance: "mid", weather: "thunder",
      early: "fire_gate_start", mid: "crowded_bridge", late: "volcanic_finish", purpose: "炎帝④：薄暮の雷火" },
    { id: "race_entei_5", region: "煉獄頂地域", cup: "炎帝杯", number: 5, rank: 6, distance: "long", weather: "strong_wind",
      early: "long_straight_start", mid: "aerial_wind_lane", late: "long_final_straight", purpose: "炎帝⑤：夜嵐の頂上" },
    // 神兎大レース（白兎神域地域 / GⅠ）— 種=第一・第二。第三/四/五を追加
    { id: "race_shinto_3", region: "白兎神域地域", cup: "神兎大レース", number: 3, rank: 7, distance: "marathon", weather: "clear",
      early: "long_straight_start", mid: "aerial_wind_lane", late: "long_final_straight", purpose: "神兎③：夕焼けの長征" },
    { id: "race_shinto_4", region: "白兎神域地域", cup: "神兎大レース", number: 4, rank: 7, distance: "long", weather: "strong_wind",
      early: "long_straight_start", mid: "rolling_terrain", late: "tailwind_straight", purpose: "神兎④：薄暮の神域" },
    { id: "race_shinto_5", region: "白兎神域地域", cup: "神兎大レース", number: 5, rank: 7, distance: "marathon", weather: "fog",
      early: "mist_start", mid: "rolling_terrain", late: "long_final_straight", purpose: "神兎⑤：神話の夜" }
  ];
  const EVE4_OVERRIDES = {
    race_caldera_3: C_CALD.slice(),                                                                  // 58%
    race_hansho_1: C_VENTO2.slice(), race_hansho_3: C_VENTO3.slice(), race_hansho_4: C_VENTO2.slice(), race_hansho_5: C_VENTO3.slice(), // ≦61%
    race_ryuo_2: C_NOTTE2.slice(), race_ryuo_3: C_RYUO.slice(), race_ryuo_4: C_RYUO.slice(), race_ryuo_5: C_NOTTE2.slice(),             // ≦64%
    race_entei_1: C_ENTEI.slice(), race_entei_2: C_LAPAN2.slice(), race_entei_4: C_NOTTE2.slice(), race_entei_5: C_LAPAN2.slice(),      // ≦59%
    race_shinto_3: C_SHINA.slice(), race_shinto_4: C_SHINB.slice(), race_shinto_5: C_SHINA.slice()  // ≦55%
  };
  void C_HANSHO;  // 炎将杯の第二（種=race_caldera_2）は既存の検証済み構成のまま使用
  EVE4_RACES.forEach(r => { if (!RACES.some(x => x.id === r.id)) RACES.push(r); });
  if (typeof RACE_ENTRY_OVERRIDES !== "undefined") Object.assign(RACE_ENTRY_OVERRIDES, EVE4_OVERRIDES);
})();
