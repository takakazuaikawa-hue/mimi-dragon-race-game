/**
 * state.js — central player state, save/load, progression hooks.
 *
 * Holds the only mutable runtime store (`state`) plus helpers that mutate it:
 * collection records, village exp/level, rank progression, milestone events.
 *
 * Depends on: utils.js (fmtCoins), data_ranks.js (RANK_UNLOCK, VILLAGE_MULT,
 * RESCUE_COINS), event_hooks.js (runEventHooks for level-up / rank-up triggers).
 *
 * EXTENSION POINT: when adding new persistent fields, also extend
 * `resetGame()`, `state.player` initial object, and bump SAVE_VERSION below if
 * the new field changes save layout in a non-backwards-compatible way.
 */
const SAVE_KEY = "mimi_dragon_race_v0_1";
const SAVE_VERSION = "1.2.0";  // 資産の二値化: totalAssets=現在の純資産 / assetsPeak=到達最高（解放判定）

const state = {
  player: {
    coins: 1000,
    // §30 §3.1 — progression uses the all-time coin high-water mark, never the
    // current (bettable) balance, so a losing bet never rolls back the story.
    maxCoinsReached: 1000,
    totalAssets: 0,   // 現在の純資産（recomputeAssetsが再計算・増減する＝表示用）
    assetsPeak: 0,    // 到達最高（解放判定の正本・減らない）
    rank: 1,
    villageLevel: 1,  // shortcut to village.level (kept for backwards compat)
    completedRaces: 0,
    wins: 0,
    // §08 §17 progression
    completedByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    hitsByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },   // ★ランク実力レール：帯別の的中数（式別不問）
    featuredDoneDay: null, collectionRewards: [],   // §37 注目レース日次ボーナス + 図鑑コンプ報酬
    winsByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    biggestPayout: 0,
    // §37 Tier 2 — win streak (連勝): consecutive bet hits (any type).
    streak: 0, bestStreak: 0,
    lastLoginDay: null, loginStreak: 0,   // §37 daily login reward
    brokeCount: 0,   // 終章伏線：0円落ち込み（無心）の回数。3回超で「知らないお姉さん」登場（js/epilogue_engine.js）
    // ★フラグ台帳（E1一本化・正本=docs/GAME_FLOW_REDESIGN.md §2）：
    //   ここ（player.flags）＝「自動の統計マイルストーン」専用。直接代入で set する。
    //   物語・解放の進行フラグの正本は setStoryFlag/getStoryFlag（village.storyFlags に保存）＝
    //   _chapter_intro_*・metMakura・phoneBought・poroFound・dragonScout/StableUnlocked・
    //   gameCleared・poroGourmetRaceUnlocked・celestiaStrangerSeen・_unlocked_<id>（解放通知済み）等。
    //   ※下の poro系〜gameCleared 等の重複キーは旧設計の名残＝実運用は storyFlags 側（getStoryFlag が両読み）。
    //   　削除せず false のまま温存（将来の統計用に予約）。このリストは resetGame() と常に一致させること。
    flags: {
      seenFirstRaceTutorial: false,
      seenFirstWideTutorial: false,
      reachedCoins_10000: false,
      reachedCoins_100000000: false,
      everHit: false,              // 初的中（📖図鑑の解放条件・settleRace で set）
      firstWideHit: false,         // 単勝以外の初的中（目標「ワイド/複勝を当てる」）
      firstRankUp: false,
      mallIntroSeen: false,        // モール初訪問VN再生済み（ゲート条件ではない）
      sakeGiftSeen: false,         // 初陣祝いVN（サケ→ジャングルバニー贈与）再生済み
      // ▼旧設計の名残（実運用は storyFlags 側）＝予約。
      poroFound: false,
      poroAppraisalStarted: false,
      poroAppraisalCompleted: false,
      poroConfirmedNotSacredDragon: false,
      dragonScoutUnlocked: false,
      dragonStableUnlocked: false,
      metMakura: false,
      gameCleared: false,
      poroGourmetRaceUnlocked: false
    },
    // §09 §4 VillageState (V1 minimal — §26 forward compatibility)
    village: {
      level: 1,
      name: "泣き虫ドラゴン村",
      rescueCoinBase: 300,
      facilities: {
        paddock: 0, newspaper: 0, grandstand: 0,
        riderPost: 0, dragonStable: 0, exchange: 0
      },
      unlockedDragonIds: [],
      favoriteDragonIds: [],
      storyFlags: {},
      eventFlags: {}
    },
    // §09 §9 dragon collection — per-dragon records
    collection: {}  // dragonId -> { seen, unlocked, favorite, records: {...}, notesUnlocked: {...} }
  },
  // §30 §13.1 total-asset / lifestyle store (kept separate from player.coins).
  // Values are recomputed by recomputeAssets() (assets_engine.js); the defaults
  // here are inlined (not from data_assets.js) so state.js has no load-order dep.
  assets: {
    villageValue: 0, facilityValue: 0, livingValue: 0,
    fameValue: 0, dragonValue: 0,
    islandValue: 0,           // ★島づくり投資の累計（2026-07-30・投資は資産に形を変える）
    lifeItems: [],            // owned purchasable cosmetics
    unlockedLifeStages: 0,    // high-water asset level (story gate; never drops)
    rescueBonus: 0            // flat rescue add from unlocked life assets
  },
  // §38 — 暮らしスキルツリー（くらしツリー）の解放状態。完全に表示専用のメタ進行で、
  // コイン・着順・オッズ・配当・経済には一切干渉しない（暮らしPは総資産から導出）。
  lifeTree: { unlocked: {} },   // { unlocked: { "<ノードのtitle>": true } }
  ui: {
    screen: "home",           // home | race_select | race_detail | bet | race_run | result | analysis
    debug: false,
    // §07 §8 infoDisplayLevel: simple | standard | advanced | expert
    infoLevel: "standard"
  },
  current: null  // { race, entries, oddsData, raceResult, bet, ... }
};

function saveGame() {
  try {
    const data = {
      version: SAVE_VERSION,
      player: state.player,
      assets: state.assets,   // §30 total-asset / lifestyle store
      lifeTree: state.lifeTree,   // §38 暮らしスキルツリーの解放状態
      settings: { infoLevel: state.ui.infoLevel },   // persisted UI preferences
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("save failed", e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && data.player) {
      Object.assign(state.player, data.player);
      if (data.assets) Object.assign(state.assets, data.assets);
      if (data.lifeTree && data.lifeTree.unlocked) state.lifeTree = data.lifeTree;   // §38
      if (!state.lifeTree || !state.lifeTree.unlocked) state.lifeTree = { unlocked: {} };
      if (data.settings && data.settings.infoLevel) state.ui.infoLevel = data.settings.infoLevel;
      // §30 migration: pre-1.1 saves lack maxCoinsReached — seed it from coins
      // so an existing player's progression isn't reset to zero.
      if (state.player.maxCoinsReached == null) state.player.maxCoinsReached = state.player.coins || 0;
      // ★資産の二値化 移行：旧セーブの totalAssets は「到達最高」の意味だったので、
      //   そのまま assetsPeak（解放判定の正本）へ引き継ぐ。totalAssets は直後の
      //   recomputeAssets() で現在の純資産として計算し直されるため、ここでは触らない。
      //   これを忘れると、既存プレイヤーの解放済みの章・スポットが一斉に閉じる。
      if (state.player.assetsPeak == null) state.player.assetsPeak = state.player.totalAssets || 0;
      // ★ブニクロ普段着の有料化 移行：旧仕様では free だったので、既に第2話まで進んだ
      //   セーブは「持っていたのに買った履歴が無い」状態になる。そのままだと手持ちの服が
      //   消え、さらに第2話の新条件（購入済み）も満たせなくなるため、購入済みとして引き継ぐ。
      if (typeof getStoryFlag === "function" && getStoryFlag("_chapter_intro_2")) {
        if (!Array.isArray(state.player.outfitsBought)) state.player.outfitsBought = [];
        if (state.player.outfitsBought.indexOf("buniqro") < 0) state.player.outfitsBought.push("buniqro");
      }
      // 旧「サケの開店祝いVN」を見ている＝勝負服はもう受け取っている。初陣祝いを再生しない。
      if ((state.player.flags || {}).mallIntroSeen && state.player.flags.sakeGiftSeen == null) {
        state.player.flags.sakeGiftSeen = true;
      }
      // ★ランク3本レール移行：旧セーブは hitsByRank を持たない。過去の的中履歴は帯別に
      //   復元できないため 0 から積む（獲得済みランクは下がらない設計なので不利益は「次の昇格が
      //   新基準になる」ことのみ＝リリース前につき許容・progression-redesign 方針）。
      if (!state.player.hitsByRank) state.player.hitsByRank = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 };
      // §37 migration: pre-streak saves lack the streak fields.
      if (state.player.streak == null) state.player.streak = 0;
      if (state.player.bestStreak == null) state.player.bestStreak = 0;
      if (state.player.lastLoginDay === undefined) state.player.lastLoginDay = null;
      if (state.player.loginStreak == null) state.player.loginStreak = 0;
      if (state.player.featuredDoneDay === undefined) state.player.featuredDoneDay = null;
      if (!Array.isArray(state.player.collectionRewards)) state.player.collectionRewards = [];
      // Durability: a race confirmed but abandoned before its 答え合わせ left an owed
      // payout (settleRace never ran). Credit it now so no winning ticket is lost.
      if (state.player.pendingPayout > 0) {
        state.player.coins += state.player.pendingPayout;
        if (state.player.coins > (state.player.maxCoinsReached || 0)) state.player.maxCoinsReached = state.player.coins;
      }
      state.player.pendingPayout = 0;
      return true;
    }
  } catch (e) {
    console.warn("load failed", e);
  }
  return false;
}

// §37 — daily login reward. _epochDay() is a local-midnight day index so
// "consecutive days" is robust; page code may use Date freely.
const LOGIN_DAY_MULT = [1, 1.5, 2, 2.5, 3, 4, 7];   // 7-day escalating cycle
function _epochDay(d) {
  d = d || new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}
// ★2026-07-30 ログインボーナス →『ドラゴンレース紀行』のきょうの売上へ（柱A・ユーザー決裁）。
//   設定：第1話でサケに勧められ、ミミは島の見聞録『ドラゴンレース紀行』の作者になる（タイトル回収）。
//   島をめぐるあらゆる行動＝紀行のネタ＝売上。式は2本立て（表示メタのみ・レース数値に非干渉）：
//     📖 紀行の印税 = フォロワー ×（0.5 ＋ 2×充実度）… 人望×コンテンツ。充実度=コレクション総合達成率
//     🏦 資産の実り = 総資産（現在）×（0.1% ＋ 0.1%×島の景気ティア0..3）… 資産と島づくり投資が働く
//   規模感（実測ベース）：序盤=数百コイン／中盤=数万／終盤（資産10億級・達成度高）=数百万×7日倍率。
//   旧式（到達最高コイン×0.5%）は「何もしなくても最高額だけで増える」＝行動と結びつかなかった。
function checkDailyLogin() {
  const today = _epochDay();
  const last = state.player.lastLoginDay;
  if (last === today) return null;                       // already claimed today
  let streak;
  if (last == null || today > last + 1) streak = 1;       // first ever / chain broke
  else streak = (state.player.loginStreak || 0) + 1;      // last === today-1 → consecutive
  const cycleDay = ((streak - 1) % 7) + 1;
  let fill = 0, fol = 0, tier = 0;
  try { if (typeof collectionScoreParts === "function") fill = (collectionScoreParts().pct || 0) / 100; } catch (e) {}
  try { if (typeof goalFollowers === "function") fol = goalFollowers() || 0; } catch (e) {}
  try { if (typeof islandTier === "function") tier = islandTier() || 0; } catch (e) {}
  const royalty = Math.floor(fol * (0.5 + 2 * fill));                                    // 📖 紀行の印税
  const yld = Math.floor(Math.max(0, state.player.totalAssets || 0) * (0.001 + 0.001 * tier));   // 🏦 資産の実り
  const base = Math.max(200, royalty + yld);
  const bonus = Math.floor(base * LOGIN_DAY_MULT[cycleDay - 1]);
  return { today, streak, cycleDay, bonus, royalty, yield: yld, base, fill, tier };
}
function claimDailyLogin(info) {
  if (!info) return;
  state.player.coins += info.bonus;
  state.player.lastLoginDay = info.today;
  state.player.loginStreak = info.streak;
  if (typeof bumpMaxCoins === "function") bumpMaxCoins();
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  saveGame();
  if (typeof updateHeader === "function") updateHeader();
}

function resetGame() {
  state.player = {
    coins: 1000, maxCoinsReached: 1000, totalAssets: 0, assetsPeak: 0,
    rank: 1, villageLevel: 1,
    completedRaces: 0, wins: 0,
    completedByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    hitsByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },   // ★ランク実力レール：帯別の的中数（式別不問）
    featuredDoneDay: null, collectionRewards: [],   // §37 注目レース日次ボーナス + 図鑑コンプ報酬
    winsByRank: { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    biggestPayout: 0,
    streak: 0, bestStreak: 0,
    lastLoginDay: null, loginStreak: 0,   // §37 daily login reward
    brokeCount: 0,   // 終章伏線：0円落ち込み（無心）の回数。3回超で「知らないお姉さん」登場（js/epilogue_engine.js）
    flags: {   // ★初期定義（上の台帳コメント）と同一リストに揃える（E1）
      seenFirstRaceTutorial:false, seenFirstWideTutorial:false,
      reachedCoins_10000:false, reachedCoins_100000000:false,
      everHit:false, firstWideHit:false, firstRankUp:false, mallIntroSeen:false, sakeGiftSeen:false,
      poroFound:false, poroAppraisalStarted:false, poroAppraisalCompleted:false,
      poroConfirmedNotSacredDragon:false, dragonScoutUnlocked:false, dragonStableUnlocked:false,
      metMakura:false, gameCleared:false, poroGourmetRaceUnlocked:false
    },
    village: {
      level: 1, name: "泣き虫ドラゴン村", rescueCoinBase: 300,
      // ★施設は初期構想の名残で、値を0から上げる機能は結局作られていない
      //   （ゲームはスカウト・モール・暮らしへ育った）。竜の村の画面に6枠を
      //   「未解放」で並べて「順次アップデート」と告知していたのを撤去済み。
      //   assets_engine の facilityValue が読むので枠だけ残す（常に0＝総資産に不干渉）。
      //   ここを埋める機能を作るときは、画面にも同時に出すこと。
      facilities: { paddock:0, newspaper:0, grandstand:0, riderPost:0, dragonStable:0, exchange:0 },
      unlockedDragonIds: [], favoriteDragonIds: [],
      storyFlags: {}, eventFlags: {}
    },
    collection: {}
  };
  state.assets = {
    villageValue: 0, facilityValue: 0, livingValue: 0,
    fameValue: 0, dragonValue: 0, islandValue: 0,
    lifeItems: [], unlockedLifeStages: 0, rescueBonus: 0
  };
  state.lifeTree = { unlocked: {} };   // §38 reset 暮らしツリー
  if (typeof recomputeAssets === "function") recomputeAssets(state);
  saveGame();
  if (typeof updateHeader === "function") updateHeader();
}

// §09 §9 collection record helpers
function ensureCollectionEntry(dragonId) {
  if (!state.player.collection[dragonId]) {
    state.player.collection[dragonId] = {
      dragonId,
      seen: false, unlocked: false, favorite: false,
      records: {
        racesSeen: 0, winsSeen: 0, top3Seen: 0,
        playerBetCount: 0, playerHitCount: 0
      },
      notesUnlocked: {
        basic: false, condition: false, courseFit: false,
        marketBias: false, story: false
      }
    };
  }
  return state.player.collection[dragonId];
}

function updateCollectionFromRace(raceResult, bet, betResult) {
  // Record every dragon that ran (seen + race counter), winner/top3,
  // and the player's bet/hit per selected dragon (§9 records schema).
  let newDragons = 0;
  raceResult.entries.forEach(e => {
    const entry = ensureCollectionEntry(e.dragon.id);
    const wasNew = !entry.seen;
    entry.seen = true;
    entry.unlocked = true;  // V1: unlock on first race seen
    entry.records.racesSeen += 1;
    if (e.rank === 1) entry.records.winsSeen += 1;
    if (e.rank <= 3) entry.records.top3Seen += 1;
    if (!state.player.village.unlockedDragonIds.includes(e.dragon.id)) {
      state.player.village.unlockedDragonIds.push(e.dragon.id);
    }
    if (wasNew) newDragons += 1;
    unlockCollectionNotes(entry);
  });
  raceResult._newDragonsThisRace = newDragons;
  if (bet && bet.selections) {
    bet.selections.forEach(id => {
      const entry = ensureCollectionEntry(id);
      entry.records.playerBetCount += 1;
      if (betResult && betResult.hit) entry.records.playerHitCount += 1;
      unlockCollectionNotes(entry);
    });
  }
}

// §09 §11: Progressive note unlocking by player familiarity.
function unlockCollectionNotes(entry) {
  const seen = entry.records.racesSeen;
  const bet = entry.records.playerBetCount;
  // 1 race seen → basic info known
  if (seen >= 1) entry.notesUnlocked.basic = true;
  // 3 races seen → condition (足取り・気性) shown
  if (seen >= 3) entry.notesUnlocked.condition = true;
  // 5 races seen → course fit (適性) shown
  if (seen >= 5) entry.notesUnlocked.courseFit = true;
  // 2 bets placed → market bias shown
  if (bet >= 2) entry.notesUnlocked.marketBias = true;
  // 8 races seen + top3 history → story flavor
  if (seen >= 8 && entry.records.top3Seen >= 1) entry.notesUnlocked.story = true;
}

// Helper for collection UI: text description for each note.
function getCollectionNoteText(entry, dragon) {
  const n = entry.notesUnlocked || {};
  const lines = [];
  if (n.basic) lines.push(`脚質: ${STYLE_LABEL[dragon.style]} / 特徴: ${dragon.traits.join("・")}`);
  if (n.condition) lines.push(`気性${statRank(dragon.stats.nerve)}・体調印象${(dragon.visualMood||50) >= 70 ? "良好" : "並"}`);
  if (n.courseFit) {
    const rep = dragon.courseReputation || {};
    const top = Object.entries(rep).filter(([k,v]) => v >= 75).map(([k,v]) => k).slice(0,3);
    lines.push(`得意: ${top.length ? top.join("/") : "汎用"}`);
  }
  if (n.marketBias) lines.push(`市場印象: 新聞印${dragon.newspaperMark || "－"} / 見た目人気${(dragon.publicImage||50)>=75?"高":(dragon.publicImage||50)<=45?"低":"中"}`);
  if (n.story) lines.push(`物語: ${dragon.portraitTone || "—"}`);
  return lines;
}

// §09 §18 Village level-up logic.
// VillageExp += raceRank*10 + (hit ? raceRank*5 : 0) + (newDragonSeen ? 20 : 0).
// Threshold for next level: level * 100.
function gainVillageExp(race, hit, newDragonsThisRace) {
  const v = state.player.village;
  if (!v.exp) v.exp = 0;
  // ★BUGFIX（レース数で章/暮らしが進む）：村は“成功”で栄える。負けレースでは伸ばさない
  //   （旧 race.rank*10 の参加ボーナスが村Lv→施設価値を押し上げ、負け続けでも総資産が
  //   勝手に進む主犯だった）。的中時のみ育つ＝勝って島を潤す、へ。スカウトは常に加点。
  let gain = (hit ? race.rank * 15 : 0) + (newDragonsThisRace || 0) * 20;
  v.exp += gain;
  const threshold = v.level * 100;
  if (v.exp >= threshold && v.level < 10) {
    v.exp -= threshold;
    v.level += 1;
    state.player.villageLevel = v.level; // sync shortcut
    runEventHooks("onVillageUpdate", { newLevel: v.level, gain });
    saveGame();
    return v.level;
  }
  saveGame();
  return null;
}

// §08 §11 Check rank unlock after race.
// ★3本レールのOR（data_ranks.js RANK_UNLOCK・正本=docs/GAME_DESIGN_NUMBERS.md §9）：
//   実力（帯別の的中）／皆勤（帯別の完走・保険）／大勝（所持コイン・近道）。
function checkRankProgression() {
  const p = state.player;
  for (let r = p.rank + 1; r <= 7; r++) {
    const cond = RANK_UNLOCK[r];
    if (!cond) break;
    const completedLower = p.completedByRank[r - 1] || 0;
    const hitsLower = (p.hitsByRank && p.hitsByRank[r - 1]) || 0;
    if (p.coins >= cond.coins
        || (cond.hitsAtLowerRank != null && hitsLower >= cond.hitsAtLowerRank)
        || completedLower >= cond.completedAtLowerRank) {
      p.rank = r;
      runEventHooks("onRankUp", { newRank: r });
      saveGame();
      return r;
    } else {
      break;
    }
  }
  return null;
}

// §08 §18 Economy milestone events.
function checkEconomyMilestones(betResult) {
  const p = state.player;
  if (p.coins >= 10000) runEventHooks("onMilestone", { kind: "coins_10000" });
  if (p.coins >= 100000000) runEventHooks("onMilestone", { kind: "coins_100000000" });
  if (betResult && betResult.hit && state.current && state.current.bet.type === "wide") {
    runEventHooks("onMilestone", { kind: "first_wide_hit" });
  }
  if (betResult && betResult.payout > p.biggestPayout) {
    p.biggestPayout = betResult.payout;
  }
  // 連敗カウンタ（表示メタのみ＝「連敗の夜」等の会話イベントが読む。レース数値には一切非干渉）。
  if (betResult) p.missRun = betResult.hit ? 0 : ((p.missRun || 0) + 1);
  saveGame();
}

// fmtCoins moved to utils.js (used by many modules, kept dependency-free).
