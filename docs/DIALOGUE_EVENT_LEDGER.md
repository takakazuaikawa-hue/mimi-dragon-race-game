# DIALOGUE_EVENT_LEDGER — 会話イベント台帳（2026-07）

> 全会話イベントの現物一覧。**セリフを編集する時はまずここで場所を引く。**
> トーン・声表・演出の書き方は docs/NARRATIVE_DESIGN.md §2（声表）と §1（原則）。
> 幕×種類のマッピング・重複削除(D1-D16)・不足追加(G1-G11)は NARRATIVE_DESIGN §3。

All source files inventoried. Here is the complete ledger.

# 会話イベント台帳（コード棚卸し・全件）

対象リポジトリ: `C:/Users/takakazu/projects/mimi_dragon_race_game`
凡例（口調の問題）: **舞台調**=決め台詞・口上っぽい／**説明調**=UI・ルールをキャラが読む／**声ブレ**=語尾・口癖の揺れ／**定型連発**=同文の反復。VN表示は全て `js/dialogue.js` の `Dialogue.play()` 一点経路（紙芝居演出③を直すならここ1箇所）。

---

## A. フック駆動VN（js/event_registry.js・全41件）

発火機構=`js/event_hooks.js`（話者ゲート`speakerAllowed`・once消費・優先度）。フック呼び出し元は `ui_render.js`（renderRaceDetail 1624/1646/1659-1661行 ほか）。

| id | 場所 | トリガー | 話者 | 行数 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| first_race_intro_mimi | event_registry.js:42 | beforeRaceSelect・once | ミミ→サケ | 2 | 初レース選択でルール説明（単竜/複竜/ワイド竜の定義） | 説明調。ミミの質問が「説明を引き出すための質問」で不自然 |
| first_race_intro_mizu | :58 | beforeRaceSelect・once・第2話既読 | ミズ | 1 | オッズ≠勝率の初回講釈 | 「あはん」定型 |
| first_race_intro | :69 | afterRaceSelect・once・race_grandclock_1 | サケ→ミミ | 2 | 「出走表とオッズを見ろ」 | ★上と同一フローで連続発火＝ほぼ同じ内容を2連発（重複D1） |
| sake_overbet_favorite_warning | :81 | afterEntryList・once・初レース | サケ | 1 | 前走勝ち竜の過剰人気に注意 | 説明調 |
| first_wide_tutorial | :91 | beforeBet・once・wide | サケ | 1 | ワイドのルール | ★introで既に説明済（重複D2） |
| mimi_strong_wind_first | :101 | afterRaceSelect・once・強風 | ミミ→サケ | 2 | 強風の日の見方 | 可（耳ネタ良い） |
| panyu_after_tense_preview | :113 | afterDragonPreview・毎回・tense_race | ミミ | 1 | 「ぱほぱほ！場が和んだ！」 | 定型連発（onceなし＝接戦のたび同文） |
| mimi_hit_reaction | :122 | afterRaceResult・毎回・的中 | ミミ | 1 | 的中の喜び | 定型連発（全レース同文）＋recapのミミ一言と二重（重複D3） |
| mimi_miss_reaction | :131 | afterRaceResult・毎回・外れ | ミミ | 1 | 「分析画面を見れば次のヒントが」 | ★説明調（UI名「分析画面」をセリフで発話）・定型連発 |
| first_bankruptcy_rescue | :141 | onBankruptcy・毎回 | サケ | 1 | 『無心する』ボタンへ誘導 | 説明調（UIボタン名を発話） |
| rank_up_celebration | :153 | onRankUp・毎回 | ミミ | 1 | ランクアップ祝い | ★声ブレ確定：ミミが「〜挑めるわ！」（ミズ語尾）＋自分に「おめでとう！」＋システム文読み上げ |
| milestone_10k | :163 | onMilestone・once・1万 | ミミ | 1 | 1万コイン到達 | 可 |
| milestone_100m | :172 | onMilestone・once・1億 | サケ | 1 | 1億到達・神兎大レース予告 | 可 |
| milestone_first_wide_hit | :181 | onMilestone・once・初ワイド | サケ | 1 | 初ワイド的中の講評 | 説明調 |
| first_visit_grand_clock〜first_visit_lapan | :194-249 | afterRaceSelect・once×8地域 | サケ×6/ミズ×2 | 各1 | 8地域の初訪問紹介 | ★定型連発：全部「地域名だ。特徴。教訓しろ」の同型ガイド文。旅情ゼロ（不満④の根） |
| first_win_bet_tutorial | :252 | beforeBet・once・win | サケ | 1 | 単勝ルール | ★introで説明済（重複D2） |
| first_place_bet_tutorial | :259 | beforeBet・once・place | サケ | 1 | 複勝ルール | 同上 |
| sake_upset_comment | :268 | afterRaceResult・毎回・人気薄勝利 | ミズ | 1 | 波乱の講評 | id が sake なのに話者ミズ（保守罠）。「あはん」定型連発 |
| sake_favorite_holds | :276 | afterRaceResult・毎回・1番人気的中 | ミズ | 1 | 順当決着の講評 | 同上 |
| poro_first_sight | :296 | afterEntryList・once・発見後にポロ出走 | ミミ | 1 | 出走表のポロに気づく | 可 |
| poro_condition_unlock | :307 | afterRaceAnalysis・once・ポロ3戦観察 | サケ→ミミ | 2 | ポロの気性は安定の教え | 可 |
| poro_first_place | :323 | afterRaceResult・once・ポロ3着内 | ミミ | 1 | ポロ好走に涙 | 可 |
| village_first_levelup | :336 | onVillageUpdate・once | スミカ | 1 | 村の成長報告 | 説明調 |
| village_levelup_generic | :344 | onVillageUpdate・毎回 | スミカ | 1 | 「村レベルがNに。賭金倍率と救済コインの基準が…」 | ★完全なシステム文の読み上げ・定型連発 |
| rank4_first_intro | :359 | afterRaceSelect・once・R4 | サケ | 1 | 大地域杯＝ハイプ注意 | 説明調。R5/R6と同じ教訓の3変奏（重複D4） |
| rank5_first_intro | :366 | afterRaceSelect・once・R5 | ミズ | 1 | 竜王杯＝過剰人気の裏に妙味 | 同上 |
| rank6_first_intro_festival | :375 | afterRaceSelect・once・R6 | サケ | 1 | 祝祭級＝看板竜の過剰人気 | 同上 |
| rank7_first_intro_shinto | :383 | afterRaceSelect・once・神兎大レース | ミミ→サケ | 2 | 頂点到達の感慨 | 可（舞台調気味だが場に合う） |
| rank7_first_intro_shinto_mizu | :398 | 同上・once | ミズ | 1 | 巨額配当の妙味 | 「あはん」 |
| rival_intro_phenix | :409 | afterEntryList・once | ミミ | 1 | フェニックス初見 | 可 |
| rival_intro_phenix_mizu | :422 | 同上・once | ミズ | 1 | 過剰人気を疑え | 説明調 |
| rival_intro_raika | :432 | afterEntryList・once | サケ | 1 | ライカ紹介 | 図鑑文の読み上げ調 |
| rival_intro_stella | :440 | 同上 | サケ | 1 | ステラ紹介 | ★声ブレ：「安定しとる」（サケは他所では標準語「〜だ」） |
| rival_intro_glaze | :448 | 同上 | サケ | 1 | グレイズ紹介 | 図鑑文調 |

## B. 立ち絵台本（js/data_dialogue.js・DLG）

| id | 場所 | トリガー | 話者 | 行数 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| DLG.OUTFIT（12種+汎用） | data_dialogue.js:27 | 着替え/購入時（ui_mall.js:175,182） | ミミ | 各1 | 衣装ごとの一言 | 可（キャッチー）。ただし衣装39着中12着分しか無い＝27着は汎用文 |
| DLG.CHAPTER（6章分） | :48 | 章を開いた初回（ui_story.js:205） | 顧問+ミミ | 各2 | 章導入VN | ★舞台調の典型：「その熱、観客に届けな！ショーの時間だぜ？」等、脈絡なしの決め台詞2行だけ。本文（新聞記事）と温度差 |
| DLG.login | :64 | ホーム初回（ui_home.js:467・吹き出し表示） | ミミ | 1 | 時間帯挨拶 | 可 |
| DLG.preRace（4セット+大勝負） | :76 | 出走直前（ui_render.js:2354） | ミミ/実況 | 1-2 | レース前の煽り | 定型連発（4種ローテ・すぐ枯れる） |

## C. ui_render.js 直呼びVN・演出

| id | 場所 | トリガー | 話者 | 行数 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| playMallIntroVN | ui_render.js:240（play 244,256） | モール初訪問 | サケ→ミミ | 5 | 開店解説+ジャングルバニー贈与 | やや説明調（試着自由・着替え無料の仕様読み）だが情があり可 |
| buyPhoneAndGoLive | :273（script 292） | 🎯チップ「スマホを買って配信」 | マクラ⇔ミミ | 7 | スマホ購入→配信デビューVN＋解禁ポップ | 可（マクラの声良い）。直後の infopop が解禁一覧の説明調 |
| showMushinOverlay/runMushin/finishMushin | :429/447/465 | ホーム0コイン→無心 | 地の文+ぱほ | 3+ | 「ぱほぱほ。。。」小芝居→受領 | 可（名演出） |
| LT_CUTIN_LINES | :493 | くらしツリー解放カットイン | 地の文 | 8種 | 「伝説は、こうして紡がれる。」等 | 意図的なバカバカしさ＝可 |
| playShinganCutin | :531 | 第5話導入VN直後・一度 | 演出 | 3 | 神眼開眼カットイン | 可 |
| advisorVoiceEl | :581（使用 1702） | レース詳細・出会い済み最上位顧問 | 顧問 | 1 | STORY_RACE_VOICE の定型講釈 | ★定型連発：毎レース同一文（重複D5） |
| celestiaSectionEl / consultCelestia | :628/619 | レース詳細・第5話後 or お姉さん遭遇後 | セレスティア | 2-3 | 神眼「1着を聞く」の段階開示と代償 | 1.1倍ルールの説明が相談ページ・メーター説明と三重（重複D6） |
| entry_encouragement（ポロ推薦） | :1636（データ=data_races.js:242） | race_lapan_festival・村Lv2・once | ミミ⇔サケ | 2 | 祝祭級にポロを推薦出走 | 可。ただし全ゲームで唯一の推薦イベント＝孤立 |

## D. ポロ（js/poro.js）

| id | 場所 | トリガー | 話者 | 行数 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| poroDiscoveryScript | poro.js:72（再生 144-166） | 単勝2勝目（結果画面）or 第3/4章FB | 語り/ミミ/ポロ/村人/サケ | 21 | 発見→聖龍幼体説→鑑定→命名オチ | 良質。全VN中最も「生きて」いる。基準にすべき |
| poroMizuFollowupScript | :103 | 発見済+第2話既読・初回1回 | ミズ | 5 | 紫の布が三倍・期待と価値 | 可 |
| poroSumikaFollowupScript | :113 | 発見済+第3話既読 | スミカ | 5 | 竜は情緒でなく設備 | 可（スミカの芯） |
| poroMakuraFollowupScript | :123 | 発見済+第4話既読 | マクラ | 5 | バズらせたい | 可 |
| poroCelestiaFollowupScript | :133 | 発見済+第5話既読 | セレスティア | 5 | 「ただの」が一番強い | 可 |
| showPoroUnlockNotice | :284 | 発見アーク完了 | ポップ | 4 | 龍舎/スカウト解放通知 | 説明調（役割上OK） |
| PORO_REACTIONS / PORO_STABLE_EVENTS / pickPoroPet | :340/436/444 | スカウト画面/龍舎/なでる | 地の文 | 6/5/3 | ポロの仕草フレーバー | 可・ローテ枯れ気味 |

## E. 號外コラム（js/data_story_events.js・STORY_EVENTS 全15件）

閲覧=物語画面「✨島の小話」（ui_story.js:120-140・showStoryEvent 161）。

| id | 場所 | 解放条件 | 語り手 | 内容 | 口調の問題 |
|---|---|---|---|---|---|
| se_firstmorning | :26 | 常時 | ミミ | 漂着の朝 | 可 |
| se_firstmeal | :29 | 1走 | ミミ | 場外ラーメン | 可 |
| se_sake_tea | :32 | 3走 | サケ | 渋茶と「筋がいい」 | ★声ブレ：サケが江戸弁「当てるもんじゃねえ」（VNでは標準語命令形） |
| se_firstwin | :35 | 初勝利 | ミミ | 初勝利の夜 | 可 |
| se_mizu_market | :38 | 総資産50万+ミズ | ミズ | 市場は嘘をつく | ★手紙 l_mizu とほぼ同文（重複D7） |
| se_poro_promise | :41 | ポロ発見 | ポロ | やくそく | 可 |
| se_rainy_live | :44 | 15走 | ミミ | 雨の日の配信 | 可 |
| se_sumika_letter | :47 | 総資産500万+スミカ | スミカ | 村人の手紙「夜が明るくなった」 | ★手紙 l_rescued と同ネタ同フレーズ（重複D8） |
| se_makura_backstage | :50 | ランク4+マクラ | マクラ | 実況席の裏側 | 可 |
| se_celestia_shadow | :56 | celestiaStrangerSeen | あのお姉さん | 天井の影 | ★破産3回超でしか立たないフラグ＝上手い人は永久に読めない（不足G7） |
| se_tree_interview | :64 | ツリー15節+スミカ | スミカ | 文化面の取材 | ★KURASHI_WATCH k_tree15 と同閾値・同ネタ（重複D9） |
| se_moveup | :68 | LIFE_TIERS[2] | ミミ | 引っ越しの日 | 良質 |
| se_gourmet_gaiden | :71 | 食10品 | ミミ | みみしんぼ外伝 | ★SNS p_gourmet・k_meals10 と三重（重複D10） |
| se_island_walker | :74 | 写真8か所 | ミミ | 島を歩く人 | ★SNS p_walker・k_spots8 と三重（重複D11） |
| se_shihan_day | :77 | 習い事1つ皆伝 | サケ | 師範の日 | ★手紙 l_shihan・k_skillmax と三重（重複D12） |

## F. 終章（js/epilogue_engine.js）

| id | 場所 | トリガー | 話者 | 行数 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| STRANGER_FIRST | :25（再生 46） | 無心4回目完了後 | お姉さん⇔ミミ | 10 | 伏線初対面「消えていないのね」 | 良質 |
| STRANGER_AGAIN | :38 | 5回目以降の無心 | 同 | 3 | 再会短縮版 | 可 |
| showEpilogueMeterHelp | :109 | メーター初表示/？ | ポップ | 6段 | 綱引きルール説明 | 説明調（役割上OK。ただし神眼1.1倍の説明が三重＝D6） |
| onDoomReached | :162 | メーター振り切れ | ポップ | 1 | 「まだ、終わらないわ」 | 可 |
| onFinalReady | :168 | メーター0 | ポップ | 1 | 最終決戦解放 | 可 |
| startFinalBattle preamble | :248 | ⚔️最終決戦 | 語り/セレスティア/ミミ | 3 | 振り返りへの導入 | 可 |
| finalShowcaseBeats/playFinalShowcase | :181/202 | 同上 | カード演出 | 約8枚 | 走馬灯（総資産/戦績/図鑑/スカウトN頭/衣装/ポロ/村） | ★スカウト竜は「N頭」の数字のみ＝八竜の顔が出ない（不足G1） |
| closing（最終レースVN） | :254 | 走馬灯後 | マクラ/サケ/セレスティア/ミズ/スミカ/ミミ | 13 | 立ち絵連発の最終決戦 | ★カーテンコール調：各顧問が自分のテーマを1行ずつ要約読み（舞台調の頂点）。八竜不在 |

## G. エンディング（js/data_ending.js + ending_engine.js）

| id | 場所 | トリガー | 話者 | 行数 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| ENDING_VN | data_ending.js:57（再生 ending_engine.js:348） | ED再生（音声確認後） | 全顧問+ミミ | 10 | 送り出しVN | 良質（「請求書じゃなくて…っ！」）。ただしスミカ・マクラ台詞は持ちネタの再演（D13） |
| STAFF_ROLL voice×3 | :115/119/131 | ロール中 | ミズ/スミカ/マクラ | 各1 | 持ちネタ引用 | ★consult/RACE_VOICEと同文（D13） |
| 章の一枚絵キャプション×5 | :91-95 | ロール中 | 地の文 | 5 | 各話の要約 | 可 |
| finStory | :34（表示 ending_engine.js:272） | ロール完走後 | 地の文 | 6 | 最後の賭けの再話 | ★ED章本文・closingと同一場面の三度目の再話（D14） |

## H. 章本文・相談（js/ui_story.js + js/data_assets.js）

| id | 場所 | トリガー | 語り手 | 内容 | 口調の問題 |
|---|---|---|---|---|---|
| STORY_CHAPTERS 1〜5+ED 本文 | data_assets.js:79-109（表示 ui_story.js:181） | chapterAvailable()（1話=即/2話=1話既読+3走/3話=2話既読+初勝利/4話=3話既読+100万/5話=4話既読+1億/ED=5話既読+決戦） | ミミ一人称記事+【談話】 | 聖龍日報の記事体・各話約5段落 | 良質（2026-07再執筆済・コメディが効く）。VN側との文体差＝一人称「私」（VNは「わたし」） |
| STORY_EXTRA_ISSUE | :114 | EDクリア後 | 記事 | クリア後の遊び場3件案内 | 可 |
| STORY_CAST.consult×5 | :243-253（表示 ui_story.js:263 renderConsult） | 相談画面・出会い済み | 各顧問 | 決め台詞1行+効果説明 | ★舞台調の名刺文。RACE_VOICE/ロール/EDと使い回し（D13） |
| STORY_RACE_VOICE×5 | :357 | レース詳細/ホームコメント/相談 | 各顧問 | 定型講釈1行 | ★3画面で同文使い回し（D5） |
| chapterIntro読み飛ばしガード | ui_story.js:193 | 順番飛ばし | ポップ | 「ミミが置いてけぼりで泣いちゃう」 | 可 |

## I. ホームの声（js/ui_home.js）

| id | 場所 | トリガー | 話者 | 規模 | 内容 | 口調の問題 |
|---|---|---|---|---|---|---|
| ログイン挨拶 | :467 | ホーム初回 | ミミ吹き出し | 1 | DLG.login流用 | 可 |
| _BANTER | :470 | 13秒毎50% | ミミ | 8種 | 配信の独り言 | ★「耳、さわっていいよ？」⇔ _MIMI_SAY「耳、さわっちゃだめ」で矛盾 |
| _MIMI_SAY/_mimiTalk | :473/474 | ミミ本体タップ | ミミ | 10種+状況3種 | タップ反応（連勝/破産/大金） | 可 |
| _CMN/_CMT | :516/519 | 3.3秒毎（配信時） | 視聴者18名 | 38種 | 流れるコメント | 可（ポロ門番済） |
| _ctxCm | :530 | 同上35% | 視聴者 | 約30種 | 状況連動コメント | 良質 |
| 顧問コメント | :551-565 | 同上16% | 出会い済顧問 | 5種 | STORY_RACE_VOICE切り詰め | ★同文使い回し（D5） |
| _joinCm/_VIPS | :625/619 | 9.5秒毎40% | 入場者 | 4種 | 入場通知（マクラお忍び含む） | 可 |
| _GIFTS/_GIFT_THX | :647/650 | 21秒毎55% | 視聴者/ミミ | 5+4種 | 投げ銭ごっこ | 可 |
| QRS/_YOU_THX | :729/730 | コメント入力 | あなた/ミミ | 5+4種 | クイックリプライ | 可 |

## J. SNS（js/sns.js）

| プール | 場所 | 件数 | 解放 | 口調の問題 |
|---|---|---|---|---|
| SNS_DAILY | :119 | 14 | 日替わり6件・顧問/ポロは門番 | 良質（d_rival好敵手が良い） |
| SNS_POSTS | :168 | 12 | 実績マイルストーン | p_gourmet/p_walker が號外・toastと三重（D10/D11） |
| SNS_POLLS | :217 | 8 | 日替わり1問 | 可 |
| POST_TEMPLATES | :231 | 10 | 進行連動 | 可 |
| FAN_LETTERS | :247 | 10 | 実績+門番 | l_mizu=se_mizu_market重複（D7）／l_rescued=se_sumika_letter重複（D8）／l_shihan=se_shihan_day重複（D12）／l_rival「かつての好敵手」は本編に一切登場しない宙ぶらりん |
| SNS_CAMERA_ALL | :94 | 8 | 投稿用写真+キャプション | 可 |

## K. 準会話システム（隣接・参考）

| システム | 場所 | 内容 | 備考 |
|---|---|---|---|
| レース実況 | commentary_data.js（DRAGON_PERSONA ほか）+ commentary_engine.js | 呼び捨て・無人格の実況文 | ★マクラ＝実況キャラなのに実レース実況は誰の声でもない（不足G6） |
| 観客の応援 | race_canvas.js:3625 | 推し竜への状況連動フロート（12種） | 可 |
| ミミのリキャップ | recap_engine.js:274 buildMimiRecap | 結果画面の一言4分岐 | ★声ブレ：「読みどころがきれいにつながりました」＝コーチ口調でミミの声でない。VNのhit/miss反応と二重（D3） |
| 解放通知 | progression.js UNLOCKS(:17)+KURASHI_WATCH(:78) | cutin4+toast5+還流toast10 | ★k_tree5/k_tree15でスミカが「〜だね」「あんた」＝声ブレ確定（他所は「ミミ様」+丁寧語） |
| 竜スカウト交渉 | data_scout.js（MOODS 10種×仕草3+読み2、APPROACHES 37種） | 竜は仕草のみ・ミミの〔読み〕 | 良質。ただし成立時の個別VNなし（不足G2） |
| 観光スポット | konron_content.js KONRON_CONTENT | 見どころ/名物/豆知識のガイド文 | ★全部三人称ガイドブック文＝ミミの反応・同行者の声ゼロ（不満④の本体・不足G3） |
| 食事 | meals.js（44品・実食/講評文） | 1-2段=実食コミカル/3-4段=当てゲーム | 3-4段は終章ゲート（:319 mealEndgameOpen） |
| ポログルメレース | poro_gourmet.js | クリア後ミニゲーム | 会話なし（スコアのみ） |

---

## L. 重複一覧（同じ情報を2回以上説明している組）

| # | 重複 | 箇所 |
|---|---|---|
| D1 | 初レースで「出走表を見ろ」を2連発 | first_race_intro_mimi（beforeRaceSelect）→ first_race_intro（afterRaceSelect）が同一フローで連続 |
| D2 | 賭式ルールの二重説明 | first_race_intro_mimi で単/複/ワイドを定義済 → first_win/place/wide_tutorial で再説明 |
| D3 | 的中/外れへのミミの反応が二重 | mimi_hit/miss_reaction（VN）＋ buildMimiRecap（結果画面）が毎回両方出る |
| D4 | 「ハイプに釣られるな」3変奏 | rank4/rank5/rank6_first_intro がほぼ同じ教訓 |
| D5 | STORY_RACE_VOICE の同文使い回し | レース詳細(ui_render:1702)/ホームコメント(ui_home:561)/相談フォールバック の3画面で完全同文 |
| D6 | 神眼1.1倍ルールの三重説明 | celestiaSectionEl(catchTx+warn)/renderConsult CONSULT_EFFECT/showEpilogueMeterHelp |
| D7 | ミズ「市場は嘘をつく…お気に入り」ほぼ同文 | se_mizu_market（號外）× l_mizu（手紙） |
| D8 | 村人の手紙「夜が明るくなった」同ネタ同句 | se_sumika_letter（號外）× l_rescued（手紙） |
| D9 | くらしツリー15節の取材ネタ | se_tree_interview（號外・閾値15）× k_tree15（toast・閾値15）＝同時発火 |
| D10 | みみしんぼ外伝（食10品） | se_gourmet_gaiden × SNS p_gourmet × k_meals10 ＝同閾値で三重発火 |
| D11 | 島を歩く人（写真8か所） | se_island_walker × SNS p_walker × k_spots8 ＝同閾値で三重発火 |
| D12 | 師範「基本に戻れ」皆伝ネタ | se_shihan_day × l_shihan × k_skillmax ＝三重 |
| D13 | 顧問の「持ちネタ」1行が5面で再演 | STORY_CAST.consult ≒ STORY_RACE_VOICE ≒ 章本文【談話】≒ ENDING_VN ≒ STAFF_ROLL voice（特にミズ「オッズは勝率じゃない」・スミカ「総資産が再起の土台」・マクラ「名前を覚えさせたら物語」） |
| D14 | 最終レースの三度語り | ED章本文（新聞）× startFinalBattle closing（VN）× finStory（ロール後）が同一場面 |
| D15 | セレスティア解禁時の同時多発 | 第5話既読の瞬間に p_celestia（投稿）+ l_celestia（手紙）+ 神眼UI + d_celes（日替わり）が一斉解禁＝「見定めてあげる」系が畳みかけ |
| D16 | モール解放の二重告知 | progression cutin「モールが解放！」→ 初訪問で playMallIntroVN（サケが再度開店説明） |

## M. 不足一覧（解放されるのに誰も語らない・章間の空白）

| # | 不足 | 詳細 |
|---|---|---|
| G1 | ★八竜×終章の結線ゼロ（不満⑤） | スカウト成立は epPush("scoutNew") でメーターが動くだけ。走馬灯は「N頭」の数字、STAFF_ROLLは名前列挙のみ。最終決戦VN（epilogue_engine.js:254）に八竜の登場枠が無い。「8頭そろった」瞬間のイベントも存在しない |
| G2 | スカウト成立の個別シーンなし | 37交渉術で口説き落としても、成立→collection書き込みのみ。竜ごとの加入ひとこと・龍舎初対面・ポロとの絡みが無い（龍舎は汎用5文ローテ） |
| G3 | 観光に「旅」の会話がない（不満④） | konron cutin（初勝利）以降、スポット閲覧は KONRON_CONTENT のガイド文のみ。ミミの現地リアクション・顧問/ポロ同行・写真を撮る芝居が皆無。KURASHI_WATCHの事後toastだけが旅の痕跡 |
| G4 | ★くらしツリー×食事の解放度ズレ（不満②） | ごはんタブ=最初から（1-2段）／くらしツリー=第3話／食3-4段=終章(1億)。ところが「みみしんぼ連載開始」號外（食10品）は序盤で発火し、連載の本体（3-4段の当てゲーム）は遥か先。逆にツリー食枝は第3話から全開 |
| G5 | 第3話→第4話（初勝利→100万）・第4話→第5話（100万→1億）の会話空白 | この長いグラインド帯の新規VNはリバル紹介・地域初訪問（序盤消化済みが多い）のみ。號外/SNSはあるがVNイベントが無く「物語が止まった感」が出る帯 |
| G6 | マクラ＝実況の不在 | 第4話でマクラが実況キャラとして立つのに、実レースの実況文（commentary）は無人格のまま。マクラ実況が聴けるのは最終決戦の1回だけ |
| G7 | 伏線「知らないお姉さん」が取り逃し可能 | brokeCount>3 が唯一のトリガー。破産しない上手いプレイヤーは STRANGER_FIRST も se_celestia_shadow も未見のまま第5話で唐突に正体判明 |
| G8 | 「かつての好敵手」の宙ぶらりん | @rival_yosou（SNS）と l_rival（手紙）にだけ存在する好敵手キャラ。本編VN・レース・號外に一切登場せず回収なし |
| G9 | 🍖おなか（hunger）を誰も語らない | E1導入済みだがピルUIのみ。サケ「まず食え」がテーマの世界で、空腹システムとキャラ会話の結線なし |
| G10 | SNS解禁後の中身案内なし | 配信化ポップは機能列挙のみ。投票・手紙・自分の投稿でバズる遊びは無説明（マクラが教えるのが自然な枠） |
| G11 | 衣装リアクションの穴 | DLG.OUTFIT は39着中12着分。追加バッチ（素寒貧・水着・地雷系など）は全部汎用文 |

## N. 口調問題の総括（不満①の分布）

- **確定バグ級の声ブレ**: rank_up_celebration（ミミ「〜わ！」）／progression k_tree5・k_tree15（スミカが「あんた」「〜だね」）／buildMimiRecap（コーチ口調）／サケの江戸弁⇔標準語の揺れ（號外・手紙 vs VN）
- **説明調の巣**: event_registry のチュートリアル系ほぼ全部（UI名・ルールをキャラが発話）
- **舞台調の巣**: DLG.CHAPTER 導入2行／STORY_CAST.consult／最終決戦 closing のカーテンコール
- **口癖過多**: ミズ「あはん」が全システム横断で20回超
- **良い基準**: poroDiscoveryScript・章本文（新聞記事体）・STRANGER_FIRST・se_moveup・ENDING_VN——「書き直す時の目標トーン」はこの5つ