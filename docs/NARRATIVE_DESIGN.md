# NARRATIVE_DESIGN — 物語・会話・演出の正本（2026-07）

> ゲーム全体の「プレイヤーの楽しい時間」を設計する最上位ドキュメントのひとつ。
> 会話を書く時・演出を足す時・進行を変える時は必ずここを通る。
> 個々の会話イベントの現物一覧は docs/DIALOGUE_EVENT_LEDGER.md（台帳）。
> 立ち絵・背景アセットの生成指示は docs/CAST_ART_BRIEF.md。

# 「プレイヤーの楽しい時間」再設計 実装計画（統合版）

対象: `C:\Users\takakazu\projects\mimi_dragon_race_game`（表示/メタ層のみ。着順・オッズ・配当＝レース数値は全編通して不変）

---

## 1. 設計原則（10箇条）

| # | 原則（1行） | 根拠出典 |
|---|---|---|
| P1 | 会話の1画面目は事件の途中から始め、疑問1個で引く。状況説明で開けない | John Yorke "In medias res" / Save the Cat |
| P2 | 先にやらせ、後で名づける。講義は全廃し「今起きたことへの実況・ツッコミ・後追い解説」にする | FTUE do-then-explain（Udonis / Game Developer） |
| P3 | 会話1本＝起承転結4ビート（4〜8画面）。「転」のないイベントは没にする | 起承転結研究（timmykokke / Fawkes）＋任天堂4段設計 |
| P4 | Wikipedia口調は常に禁止。既知情報を言わせるなら感情・利害・嘘のどれかを必ず乗せる | stormwritingschool「As you know, Bob」 |
| P5 | ネームレステスト合格まで直す。名前タグを隠して誰の台詞か分かる「声表」を単一正本にする | writerslife / K.M. Weiland |
| P6 | 言わずに見つけさせる。観光は説明でなく発見（覗き込むと何かある箱庭）で作る | 宮本茂 hakoniwa（Good Blood / levitylab） |
| P7 | ごほうびは出口とワンセット。獲得と同時に使い道が開くよう解放台帳を突き合わせる | 桜井政博 C03（貯める系は消費とワンセット） |
| P8 | 1到着1概念。同一の瞬間・同一の閾値に会話/通知を2本以上発火させない | FTUE分割投与（AC&A）＋既存「1到着1モーダル」則 |
| P9 | 紙芝居の解毒はテキスト外の層。間・表情・入退場・SEを台本データに添えて書く | Cygames ウマ娘スクリプト演出（cgworld） |
| P10 | ハルウララ原則。プレイヤーの行動履歴（集めた八竜・食べた飯・行った場所）をセリフが拾って初めて物語になる | ウマ娘シナリオ評（note/inside-games）＋SDT関係性 |

---

## 2. 会話トーンガイド（声表）

**共通ルール（舞台調→自然な口語の機械的手順）**
1. 声に出して読む。詰まったら書き直し
2. 1台詞2文以内。長台詞はしぐさ・相手の相槌で割ってキャッチボール化
3. 完全文法を崩す（言い差し「それは、その…」・省略・体言止め）。ただし「えっと」「あのー」の実会話再現は禁止＝整音された口語
4. 呼びかけ・ツッコミで必ず相手に向ける（独白の連続禁止）
5. 抽象語を具体物に替える（「経済が悪化」→「串焼きが2枚から1枚になった」）
6. **全キャラ共通禁止**: UI名の発話（「分析画面を見て」）／システム文の読み上げ／感情の直言（「悲しい」）／脈絡なしの決め台詞単独行（DLG.CHAPTER型）／カーテンコール（自分のテーマの要約読み）
7. 目標トーンの正本5つ: poroDiscoveryScript・章本文（聖龍日報）・STRANGER_FIRST・se_moveup・ENDING_VN

**声表（一人称/語尾は既存VN正本＝poroDiscoveryScript・ENDING_VN から採録して固定。以下は構造の定義）**

### ミミ（主人公・常設ツッコミ）
- 語彙: 食べ物・お金・耳。リズム: 短文の畳みかけ→最後に一拍。口癖: 話が飯に着地する
- 一人称「わたし」（新聞記事のみ書き言葉「私」で可）。禁止: ミズ語尾「〜わ」・コーチ口調・自分に「おめでとう」
- 悪→良①（rank_up_celebration）: 「ランクアップ！これで上位レースに挑めるわ！おめでとう！」→「え、うそ、上のクラス……行ける？行けちゃう？……よし、行く前に腹ごしらえ！」
- 悪→良②（mimi_miss_reaction）: 「外れちゃった。分析画面を見れば次のヒントがあるかも」→「〜〜っ、惜しくもない外れ方がいちばん悔しい！……見てなさいよ、次。」

### サケ（竜王女・親方肌・第1話）
- 語彙: 竜と王家のメタファー・飯。リズム: 短文・断定・命令形（標準語に統一。號外の江戸弁「〜もんじゃねえ」は廃止し全面改稿）。圧を受けると: 黙って茶を飲む
- 禁止: ルールの定義文（「単竜は1着を当てる賭けだ」）・ハイプ注意の説教変奏
- 悪→良①（rank4_first_intro）: 「大地域杯だ。看板竜の過剰人気に注意しろ」→「……客の声、聞こえるか。ああいう日は竜より先に財布が熱くなる。」
- 悪→良②（first_race_intro）: 「出走表とオッズを見ろ」→「講義はしない。まず一回、好きに賭けてこい。話はその後だ。」

### ミズ（エコノミスト・第2話）
- 語彙: 金と相場。リズム: 余裕の長め1文→短い刺し。口癖「あはん」は**1イベント1回まで・山場限定**（現状20回超は全削減）。癖: 説明の途中で必ず損得勘定を始める
- 悪→良①: 「あはん、オッズは勝率じゃないのよ。市場の期待が作る数字なの」→「その8.2倍、みんなが『来ない』と思ってる値段。……わたしは、安いと思うけど？」
- 悪→良②（波乱講評）: 「あはん、波乱ね。人気薄が勝つのが市場よ」→「はい大荒れー。……で、誰が儲けたか、だけど。」

### スミカ（行政秘書・第3話）
- 語彙: 書類と規則。リズム: 丁寧語・定型→最後に半歩だけ私情が漏れる。呼称は常に「ミミ様」（「あんた」「〜だね」はバグ、k_tree5/15を修正）。ギャップ: 実は賭けに一番熱い（登場2イベント目以降で解禁）
- 悪→良①（village_levelup_generic）: 「村レベルが3に。賭金倍率と救済コインの基準が更新されました」→「ミミ様。村から届け出が3件……全部、お礼です。処理に困っています。」
- 悪→良②（k_tree5）: 「あんた、暮らしが板についてきたね」→「ミミ様の生活調査票、初めて空欄が埋まりました。……少し、嬉しいです。」

### マクラ（配信者・第4話）
- 語彙: 配信用語と数字（同接・アーカイブ・切り抜き）。リズム: 早口の煽り→急に素の一言。禁止: 機能列挙ポップの代読
- 悪→良①（SNS解禁案内）: 「SNS・フォロワー・投稿機能が解放されました」→「はい回線チェック！初配信で噛んだら一生アーカイブに残るからね。……嘘。残るのは3日。」
- 悪→良②（consult名刺文）: 「名前を覚えさせたら物語」→「同接より、覚えてもらった名前の数。……ってわけで今日の見どころ、30秒で言うよ？」

### セレスティア（世界の天井・第5話）
- 語彙: 天気・高所・星。リズム: ゆっくり・体言止め。ギャップ: 妙に俗っぽい（下界の飯や配信に興味津々）
- 悪→良①（consult）: 「わたくしが見定めてあげる」→「上から見てるとね、レース場って、いちばん星に似てるの。……で、今日は何が知りたいの？」
- 悪→良②（神眼三重説明の統合先）: 「神眼は単勝1.1倍の代償を要求する」→「答えは教えられる。つまらなくなるのは、あなたの側。……それでも、聞く？」

### ポロ（相棒竜・言葉を持たない）
- セリフ禁止。感情は**しぐさ3層（耳・尻尾・涙）のト書き＋ミミの〔読み〕**で書く（data_scout.jsの仕草→読み形式を正本に）。鳴き声表記は既存アセットの表記から1種に統一し新規発明禁止。役割: 天然の「知らない聞き手」＝説明はポロに向けて話させる（P4の免罪符）
- 悪→良①: 「ポロはうれしそうだ」→「ポロは耳をぴんと立て、尻尾でミミの膝を三回叩いた。（……行く気だ）」
- 悪→良②: 「ポロはないている」→「ポロの目に涙が盛り上がる。……が、今日は、こぼれる前に自分で拭いた。」

---

## 3. 会話イベント台帳の骨格

**幕の定義（マクロ三幕）**: プロローグ+1〜2章=第一幕／3章=ミッドポイント（初勝利・ポロ・暮らし開始）／4章=グラインドと上昇／5章+終章=第三幕／クリア後=後日談。章内の各イベントは起承転結4ビート（P3）。

### マトリクス（既存=id、◆=書き換え、★=新規追加、削除=打消し扱い）

| 幕 | 導入 | システム説明（do-then-explain化） | 掛け合い（転あり） | 余白 |
|---|---|---|---|---|
| プロローグ（開始〜第1話） | ◆first_race_intro_mimi（1本に統合、初レース後に移動） | ◆first_win/place/wide_tutorial（初選択時1回のみ・introからルール定義削除） | ◆recap一本化（VNのhit/miss廃止→recapを声表準拠+池化） | se_firstmorning・se_firstmeal・DLG.login |
| 1章（〜3走） | ◆DLG.CHAPTER1（決め台詞2行→新聞と地続きの4ビート） | sake_overbet_warning◆ | mimi_strong_wind_first（現状維持） | ◆se_sake_tea（江戸弁修正） |
| 2章（ミズ・モール・分析） | first_race_intro_mizu◆ | ◆playMallIntroVN（cutinは誘導のみに=D16） | ★ミズ×サケ初掛け合い「値段と筋」 | SNS_DAILY該当分 |
| 3章（初勝利・スミカ・ツリー・観光・ポロ） | poroDiscoveryScript（正本・不変） | village_first_levelup◆／★hungerの一言（G9: サケ「まず食え」実結線） | poro followups×4／entry_encouragement | se_firstwin・se_poro_promise |
| 4章（100万・マクラ・配信） | buyPhoneAndGoLive（維持） | ★G10 マクラのSNS案内（投票・手紙・バズの遊び方を配信実況で） | ★G5前半: 「連敗の夜」（転=ミズの相場急変）／★G6 マクラ実況デビュー（レース実況に人格） | se_rainy_live・se_makura_backstage |
| 5章（1億） | ◆D15解消: セレスティア関連を時差解禁（VN→翌レース後に手紙→3レース後に投稿） | ◆神眼説明をセレスティア台詞1本に集約（D6） | ★G5後半: 「行政の横槍」（転=スミカ章の事件）／◆rank5/6 intro（教訓変奏をやめ別テーマに） | se_celestia_shadow（★代替トリガー追加=G7） |
| 終章 | STRANGER_FIRST（正本・不変） | showEpilogueMeterHelp（説明役として維持） | ★八竜集結イベント（8頭目成立の瞬間）／◆最終決戦closing（§6で全面改稿） | ★龍舎の前夜（ポロ+八竜のしぐさ） |
| クリア後 | STORY_EXTRA_ISSUE | ― | ★G8 好敵手回収（@rival_yosou が島に来る1本） | ★ポログルメレースに実況一言 |

### 重複削除リスト（D1〜D16の処置）

| # | 処置 |
|---|---|
| D1 | first_race_intro（afterRaceSelect側）を削除。intro_mimi 1本に統合 |
| D2 | intro_mimiから賭式定義を削除。各賭式の初選択時チュートリアル3本だけ残す |
| D3 | mimi_hit/miss_reaction（VN）を削除。recap_engine側を声表準拠に書き換え+4分岐→12種の池に |
| D4 | rank4/5/6 introを「別の転」に書き分け（4=群衆、5=ミズの妙味、6=祭りの空気とサケの過去） |
| D5 | STORY_RACE_VOICEを画面別3変奏に分割（レース詳細=分析、ホーム=雑談、相談=導入） |
| D6 | 神眼1.1倍の説明はセレスティア台詞1本+メーターヘルプの2箇所のみに |
| D7/D8/D12 | 手紙（l_mizu/l_rescued/l_shihan）を書き直し、號外と「同じ出来事の別視点」に（同文禁止） |
| D9〜D11 | 同閾値三重発火を時差化: toast=即時、號外=+1レース後、SNS投稿=+1日後（P8） |
| D13 | 持ちネタ1行の5面再演を禁止。consult/RACE_VOICE/談話/ED/ロールを全て別文に |
| D14 | 最終レース三度語りを役割分担: closing=現在形の実況、ED章=翌日の新聞、finStory=削除しロール後は一枚絵+一行のみ |
| D15 | 上表の通り時差解禁 |
| D16 | cutinは「モールが開いた→行こう」誘導のみ。開店説明はVN側1本 |

### 不足追加リスト（どの瞬間に何を足すか）

| # | 瞬間 | 追加する会話 |
|---|---|---|
| G1 | 8頭目スカウト成立の直後 | 八竜集結VN（§6）。終章前なら「その時が来たら、この子たちが」の予告に |
| G2 | 各スカウト成立の直後 | 竜ごとの加入ひとこと（しぐさ+ミミの読み1行、52頭ぶんはデータ駆動で3型×個体差し込み）＋龍舎初対面でポロとの絡み1行 |
| G3 | 観光スポット初訪問 | 到着ミニVN（§5） |
| G5 | 100万→1億のグラインド帯 | 「連敗の夜」「行政の横槍」＋総資産の中間点（500万/5000万）に顧問掛け合い各1本 |
| G6 | 第4話既読後の全レース | commentary_engineにマクラ人格レイヤ（口調変換+固有フレーズ挿入。文言のみ、抽選や結果に不干渉） |
| G7 | 破産しない上手いプレイヤー | STRANGER_FIRSTの代替トリガー追加: 「第4話既読 かつ 観光の絶景スポット初訪問」でもカメオ発火（brokeCountとOR） |
| G8 | クリア後 | 好敵手が島に来て予想対決する號外+VN1本（SNSの伏線回収） |
| G9 | 空腹ピル初表示時 | サケの「まず食え」1行（hunger UIとキャラの結線） |
| G10 | 配信解禁ポップの直後 | マクラの実演ツアー（投票を1回一緒にやる do-then-explain） |
| G11 | 未対応27着の衣装 | DLG.OUTFITをバッチ別に追補（素寒貧/水着/地雷系は優先。汎用文は最後の砦として維持） |

**機構ガード（恒久対策）**: event_hooks.js に「同一ティック内でVNは1本まで（優先度勝ち・残りは次レース後へ繰り越し）」のキューを追加。解放台帳（progression.js）を単一の真実とし、會話が言及する機能は必ず門番（advisorMet/castNameSafe と同じ fail-closed）を通す。

---

## 4. 演出強化計画（dialogue.js 拡張・優先順）

方針: 行フィールドの**任意追加**（`{s,t,e,side,fx,se,bg,w,zoom}`）で既存台本は全部無改修動作。全て表示専用。

| 優先 | 施策 | 内容 | ファイル |
|---|---|---|---|
| 1 | stranger.webp 404修正 | `images/cast/stand/stranger.webp` が存在せず絵文字表示（バグ級・最優先） | images/cast/stand/ |
| 2 | 顧問表情差分の registerCast オブジェクト化 | `data_dialogue.js:93-97` を `img:{default,smile,happy,panic}` 形式に。imgChainは対応済み・欠損は404フォールバックで揃った表情から順次投入可。**紙芝居感の最大要因をエンジン改修ゼロで解消** | js/data_dialogue.js + アセット |
| 3 | クロスフェード+話者ズーム+スライドイン | loadIntoダブルバッファ化・`.active{scale:1.05}`・左右別入場アニメ・退場アニメ | js/dialogue.js, style.css |
| 4 | fx/se 行フィールド | `fx:'shake'|'hop'|'nod'|'flash'`＋FX_SE自動対応表（shake→miss, hop→paho）。Sfx既存18種を初結線。fxはtranslate/rotateで書き .active のscaleと衝突回避。REDUCE(reduced-motion)で無効化 | js/dialogue.js, style.css |
| 5 | bg 背景レイヤ | scrimの下に `images/bg/`（竜舎/夜市/浜辺/パドック/医務室…6〜10枚・下1/3はセリフ枠で隠れる構図）をクロスフェード。観光・食事イベントで場面が立つ | js/dialogue.js, style.css, images/bg/ |
| 6 | インラインウェイト+オート送り | `t:"……そっか。{w:600}うん、行こう！"`・行末 `w:`・3文字ごとtick音・`opts.autoAdvance` | js/dialogue.js |

アセット生成（IMAGE_GEN指示書粒度）: サケ/ミズ/スミカ/マクラ/セレスティア各3〜4表情（ルート直下の未結線素材 v2-wink/v3-think/pose_v4/galaxy_FINAL 等を背景除去で転用）、stranger本体+フード2種、ポロ happy/eat/sleepy、ミミ angry/cry/shy/決め顔（主要衣装先行）＋inferExprルール追加、実況・村人バストアップ、背景6〜10枚。すべて透過webp・stand/と同頭身・下端接地。

---

## 5. 観光の旅行体験化計画

現状の診断: ui_konron_map.js に Dialogue.play 呼び出し0件・移動演出なし・到着=写真1枚・食事と未結線（§A調査）。「地図UIの操作」を「旅」に変える4本柱。

1. **ガイド役（キャラの同行）** — KM_CATSカテゴリ別に担当を割当: 港/奥地=サケ、食べ歩き/ショッピング=ミズ、行政/宿泊=スミカ、レース観戦/推し活=マクラ、絶景=セレスティア（第5話後）、温泉=ポロ同行。**必ず advisorMet 門番で fail-closed**（未登場キャラはミミ+ポロの二人旅にフォールバック）。初訪問時のみ到着ミニVN 3〜4行（起=移動の一言/承=第一印象/転=スポット固有の小さな驚き/結=写真かグルメへの誘い）。2回目以降は吹き出し1行。P6に従い「魅力の説明」禁止＝発見のリアクションのみ
2. **到着演出** — ピンタップ→即DOM描画を廃し、ワイプ+bgフェードイン+到着ジングル（Sfx既存流用）+スタンプ押印を1本の到着シークエンスに。スポットの `s.time` を `_kmIslandNow` の実時刻と結線し、時間帯一致なら「いまが見頃」バッジ+ガイドの特別な一言（表示のみ）
3. **コメディ** — 到着VNはフリ→ボケ→ツッコミの3点で書く（ボケ=ガイド役の職業病: ミズは名物の原価を言う、スミカは行列に整理券を配り始める、ツッコミ=ミミ常設）。エリア制覇時に天丼1回
4. **グルメ結線（P7）** — スポットID↔MEALS対応表を新設（g_paella↔ryoshimeshi、溶岩ステーキ↔竜窯…）。食スポット詳細に「ここで食べる」ボタン→meals実食フローへ直結し eaten 記録→スポット写真に実食済みバッジ・號外/SNSの食ネタが「どこで食べたか」を拾う（P10）。§7-Bの解放引き下げが前提
5. **コンテンツ充당** — KONRON_CONTENT未執筆26スポット（lounge/cafe/patisserie/jogai/ennichi/lodge/wagashi等）を補完。ただしガイドブック文体をやめ「ミミの旅メモ」一人称に統一
6. **小さな駆け引き（第12条）** — 日替わりフォトミッションに「当て」要素（3択の撮影ポイント、当たりで限定キャプション）。報酬は表示・図鑑のみ

ファイル: js/ui_konron_map.js・js/konron_content.js・js/meals.js・js/sns.js・js/dialogue.js(bg利用)・images/bg/

---

## 6. 終章の燃える展開計画（八竜結線・レース数値不変）

現状の診断: 最終決戦は完全VN・スカウト竜は「N頭」の数字のみ・備え4軸は飾り（§B/C調査）。憲法: c案（実出走表への注入）は不採用。a案+b案の複合。

1. **八竜ロスターAPI（土台）** — `scoutedRoster()`: `Object.keys(collection).filter(id=>col[id].scouted)` を affection 降順ソートし `dragonById` で個体データ返却。表示専用の読み取りのみ
2. **「8頭そろった」瞬間イベント（G1）** — 8頭目成立時に集結VN: 龍舎に8頭が並ぶ（rcDrawDragonスプライト整列+個体色+名前）。ポロが真ん中で胸を張るしぐさ。終章未到達なら「予告」トーン
3. **決戦前夜の意味づけ** — `_finalPrepList`（ui_economy.js:186-198）の判定は一切変えず、達成状況が決戦演出の豪華さに反映されることを予告文で示す（「集めた竜が、当日ゲート前に並ぶ」）
4. **八竜見参カットイン（a案）** — startFinalBattle の closing 配列に動的行を splice: 「ゲート前に、ミミが心を通わせた竜たちが並ぶ——」+ 各竜の名前・意匠・加入時の一言の再演（0〜8頭いずれでも破綻しない可変長。0頭ならポロだけの行に fail-closed） |
5. **エキシビション走（b案・目玉）** — race_timeline/race_canvas の描画だけ再利用した賭け対象外・配当なしの演出専用走を最終決戦に挿入。八竜+ポロ+神眼の答えの竜が走る「絵」。race-math-immutable に不抵触（既存の自動レース検証手順でオッズ/配当のハッシュ一致を確認して完了とする）
6. **走馬灯の個人化（P10）** — finalShowcaseBeats を集計カードから「固有名詞カード」へ: 八竜の名前・最初に勝った竜・一番食べた店・最初の写真スポット・島の建てた施設名。データは全て既存台帳（collection/meals/spotsSeen/island）から読むだけ
7. **closing の脱カーテンコール** — 顧問5人の「テーマ要約読み」を全廃し、各人がプレイヤーの実績を1つずつ拾う台詞に（ミズ=最高配当の数字、スミカ=村の変化、マクラ=フォロワー数、サケ=八竜、セレスティア=無心の回数すら）。D13/D14を同時解消
8. **緊張と開放の対（第10条）** — 絶滅メーター振り切れ（onDoomReached）の直後にポロの甘えイベントを必ず対で置く

ファイル: js/epilogue_engine.js・js/ui_economy.js・js/poro.js・js/race_canvas.js(描画流用)・js/ending_engine.js

---

## 7. 進行整合の修正リスト（優先順）

| 優先 | 修正 | 箇所 |
|---|---|---|
| A【確定バグ】 | 食べ歩きN品判定が `Object.keys(state.player.meals)`（常に2）→ `mealStatsAll().got` に置換。k_meals10/25・みみしんぼ號外・SNS投稿が復活 | progression.js:96,99 / data_story_events.js:72 / sns.js:201 |
| B【本丸】 | 上級グルメ(gourman)を総資産1億→「100万 OR 第4話既読」（観光tier2と同じ物差し）。shinboのみ終章維持し `chapterAvailable("5")` 相当に（K同時解消） | meals.js:322-327 |
| D | 目標「屋台のごはん」判定を総資産1万→ `mealStatsAll().got>=1` | goals.js:94 |
| E | 目標「ワンルームへ引っ越す」判定を総資産10万→ `roomLevel()>=1` | goals.js:108 |
| F | 化石テキスト「総資産3千で第2話」等を `chapterUnlockHint()` に差し替え | ui_mall.js:40 / mall_rpg.js:1266 / ui_assets.js:53,186,199 / ui_render.js:1766,3663 |
| G | 次目標バーの章進捗を実ゲート（第2話=races/3、第3話=wins/1）で算出 | ui_render.js:3240-3247 |
| C | くらしツリーに総資産帯ゲート1行追加（`node.at > totalAssets → "prereq"`）。コイン長者と食事の逆転解消 | lifetree_engine.js:222 |
| I | 生活ステージを物語に整合（level3=100万、level4=1億） | data_assets.js:26-27 |
| H | 観光ポータルの「開いてる見た目→跳ね返される」解消（閉なら「鍵アイコン+◯◯で開く」表示） | ui_konron_map.js:559-563 |
| J | 基準単価の6倍クリフをLIFE_TIER連動の階段（50/100/300/800/2,000/5,000/10,000）に | hunger.js:29-32 |
| L【触らない】 | ランク解放（state.js:338）は賭け経済直結のため変更禁止。スカウト断崖3万も現状維持 | ― |

---

## 8. 実装ウェーブ分割

### W1: 土台の嘘とバグを消す（整合+声ブレ即修正）
- ファイル: progression.js / data_story_events.js / sns.js / meals.js / goals.js / data_assets.js / ui_mall.js / mall_rpg.js / ui_assets.js / ui_render.js / lifetree_engine.js / hunger.js / event_registry.js(声ブレ行のみ) / recap_engine.js / images/cast/stand/stranger.webp
- 内容: §7のA〜J全部＋確定バグ級声ブレ4件（rank_up_celebration・k_tree5/15・buildMimiRecap・サケ江戸弁）＋stranger.webp配置＋D1/D2/D3/D16の重複削除
- 完了条件: 食10品で號外「みみしんぼ・外伝」が実際に出る／屋台飯を食べた瞬間に目標達成／引っ越しで目標達成／全画面の解禁ヒント文が実ゲートと一致／お姉さんが絵で出る（実機確認）

### W2: 演出エンジン（dialogue.js拡張＋表情アセット）
- ファイル: js/dialogue.js / style.css / js/data_dialogue.js / images/cast/stand/ / images/bg/
- 内容: §4の優先2〜6（registerCastオブジェクト化→クロスフェード/ズーム/スライド→fx/se→bg→ウェイト/オート送り）＋アセット生成バッチ1（顧問smile/panic・stranger・背景4枚）
- 完了条件: 既存台本（DLG/event_registry/poro/epilogue/ending）が無改修で全部動く回帰確認／fx・se・bg・{w:}を使ったデモ台本が実機で動く／表情webpを1枚置くだけで自動で切り替わる／reduced-motionでfx無効

### W3: 台本総書き換え＋台帳整備
- ファイル: js/event_registry.js / js/data_dialogue.js / js/data_story_events.js / js/sns.js / js/data_assets.js(consult/RACE_VOICE) / js/event_hooks.js / js/commentary_engine.js / js/hunger.js(一言結線)
- 内容: §2声表を全41件+DLG.CHAPTER+consult/RACE_VOICEに適用（新演出フィールド活用）／D4〜D15の重複解消／不足追加 G5・G6・G7・G9・G10・G11／event_hooksに1ティック1VNキュー
- 完了条件: ネームレステスト合格（名前を隠した台本読み合わせ）／D1〜D16チェックリスト全消込／マトリクスの空マスなし（余白列除く）／マクラ実況が第4話後の実レースで聞こえ結果数値は不変

### W4: 観光の旅行化
- ファイル: js/ui_konron_map.js / js/konron_content.js / js/meals.js / js/sns.js / images/bg/(追加)
- 内容: §5の4本柱＋コンテンツ26件補完＋スポット↔MEALS対応表＋時間帯結線＋フォトミッション3択
- 完了条件: 初訪問で到着演出+ガイドVNが出る（未登場顧問はミミ+ポロにfail-closed）／食スポット→実食→eaten記録→バッジまで一気通貫／content空スポット0件／閉ポータルが鍵表示

### W5: 終章・八竜の総決算
- ファイル: js/epilogue_engine.js / js/ui_economy.js / js/poro.js / js/ending_engine.js / js/ui_scout.js(成立VN=G2)
- 内容: §6の1〜8（ロスターAPI→集結イベント→見参カットイン→エキシビション走→走馬灯個人化→closing改稿）＋スカウト成立の個別ひとこと（G2）＋クリア後の好敵手回収（G8）
- 完了条件: 8頭目成立で集結イベント発火／最終決戦で自分が集めた竜の名前と姿が出る（0頭/3頭/8頭の3パターンで破綻しない）／既存の自動レース検証手順でオッズ・配当・着順のハッシュが改修前後で一致／D13/D14解消をED通し実機で確認

**横断ルール**: 全ウェーブ表示専用（race-math-immutable厳守）／新規コンテンツは必ず門番（advisorMet/castNameSafe）を通す fail-closed／各ウェーブ末に「機能の核」を実機で実証してから完了宣言（例: W2=表情が実際に切り替わる動画確認、W5=決戦通しプレイ）。

---

# 付録A: ストーリーテリングのリサーチ全文

# リサーチ結果: プロのストーリーテリング作法 → モバイルゲーム会話イベント設計への翻訳

## 1. フック（冒頭で引き込む技術）

**Save the Cat（Blake Snyder）**
- Opening Image（1ページ目）: 物語のトーンと「現状」を1枚のスナップショットで見せ、ラストと対になる画にする。最初の10ページ（≒最初の数分）で観客が乗るか降りるか決まる。
- 「Save the Cat」の瞬間: 主人公を地獄に落とす前に、序盤で共感できる行動（猫を助ける）を1つやらせて観客を味方につける。
- 出典: https://www.studiobinder.com/blog/save-the-cat-beat-sheet/ / https://reedsy.com/blog/guide/story-structure/save-the-cat-beat-sheet/

**In medias res（事件の途中から始める）**
- 説明を受け身で聞かせるのでなく「何が起きてる？」「この人は誰？」という疑問を先に立てて引っ張る。F2P・サブスク時代は即時エンゲージメントが死活問題なので特に有効（Skyrimのドラゴン襲撃、Uncharted 2の列車ぶら下がり）。
- リスク2つ: ①チュートリアルと衝突する（混乱中は操作説明が頭に入らない→Half-Life式に「平常を一瞬見せてから」壊す）②「前」を省くと感情の賭け金が消える。
- 情報開示は「as you know」でなく、環境で語る／リアクションで匂わす／回想は任意再生／不要な背景設定は容赦なく削る。
- 出典: https://www.johnyorkestory.com/2025/01/in-medias-res-when-and-why-to-use-it-in-video-game-stories/

**翻訳**: 会話イベントの1画面目は状況説明禁止。「事件の途中」＋疑問1個から始め、平常→異変の落差が要る話だけ平常を1〜2画面で先出しする。

## 2. 起承転結・三幕構成 → 章解放型ゲームへの写像

- 三幕構成=対立駆動（設定→対決→解決）。起承転結=対立不要、「前半で作った基準線」と「転のコントラスト」で駆動する。日常回・飯回・観光回に最適（敵がいなくても話が成立する）。
- 任天堂のレベルデザイン写像: 起=安全に新要素を学ぶ／承=深化・反復／転=予想外のひねりで習熟を試す／結=総仕上げ・ご褒美。Super Mario 3D Worldで実証済みの定石。
- 二層構造の定石（Spy x Family型）: **マクロは三幕（シリーズ全体の対立）、章・各話レベルは起承転結**。章ごとに小さな起承転結の弧を完結させつつ、全体の三幕を前進させる。
- 出典: https://timmykokke.com/blog/2023/2023-05-17-kishotenketsu/ / https://www.septembercfawkes.com/2026/02/kishotenketsu-story-structure-explained.html / https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu

**翻訳**: 全5章＝三幕（1-2話=第一幕、3話末=ミッドポイント反転、4話=どん底、終章=クライマックス）。個々の会話イベント＝起承転結の4ビート（目安4〜8画面）。「転」のないイベントは書かない。

## 3. Show, don't tell をセリフに適用（説明セリフの殺し方）

- 「As you know, Bob」（互いに知ってる事を読者向けに言う）は自律性喪失・テンポ悪化・没入切れの三重罪。出典: https://stormwritingschool.com/exposition-in-dialogue/ / https://kosiboro.work/avoid-exposition-dialogue/
- 殺し方3種: ①描写で見せる（「戦争で人口半減」→廃墟と雑草を見せる）②「知らない人」を置く（ハリー・ポッター式の無知な聞き手）③そもそも説明しない（謎のまま先送り＝好奇心が燃料）。
- 「あえて説明させる」免罪符4種: 職業として説明が自然（教師・医者）／感情・トラウマを乗せた独白に昇華（「10年だぞ。夜になると聞こえるんだ」）／嘘・ミスリード／あらすじ圧縮。**Wikipedia口調は常に禁止、偏見と欲を混ぜる**。
- 感情の直言（「私は悲しい」）は話題すり替えで消す:「今日の風は、少しだけ目に染みるな」。仕草（机の下で拳を握る）が言葉より雄弁。出典: https://note.com/serene_hebe1710/n/n75c8302fba2a / https://racheljrowlands.com/2020/04/18/how-to-avoid-exposition/

## 4. キャラクターボイスの書き分け／舞台調の直し方

- 声の決定レバー（K.M. Weiland）: 語彙・文の長さ・リズム（畳みかけ vs ぽつぽつ）・**メタファー系統（職業/出身/心理から比喩と悪態を採る）**・口癖・一人称/語尾・圧を受けた時の防衛反射（沈黙/皮肉/怒り）・何の話題に食いつくか。最強はリズム。出典: https://www.helpingwritersbecomeauthors.com/character-voices/
- **ネームレステスト**: 名前タグを全部隠して読み、誰のセリフか分かるまで直す。出典: https://writerslife.org/distinct-character-dialogue/
- 舞台調→自然な口語の具体手順（日本語圏の実務知）: ①声に出して読む（不自然さが一発で分かる）②長台詞を割って地の文・仕草を挟む（キャッチボール化）③完全な文法をやめる＝言い差し・省略・体言止め④呼びかけ・ツッコミで相手に向ける⑤抽象語を具体物に替える。ただし現実会話の再現（えっと、あのさー）はテンポを殺すのでNG＝「整音された口語」を書く。出典: https://enomotomethod.jp/column/conversationalsentences/ / https://genbu-shobo.com/novel/novel-serifu-kakikata/
- 一人称＋語尾は「指紋」: 俺/私/僕/わたくし、〜だぜ/〜ですわ だけで属性が立つ。出典: https://note.com/serene_hebe1710/n/n75c8302fba2a

## 5. コメディの作法と日本のソシャゲの当たり例

- 笑いの基本構造=**フリ（話題提起）→ボケ（脱線・誤った概念）→ツッコミ（本線に戻す）**の3点セット。ボケっぱなしは事故（スカシ＝あえてツッコまないのは意図的にのみ）。出典: https://enomotomethod.jp/column/comedy-gag/
- ボケ14種・ツッコミ9種のカタログ: かぶせ/キレボケ/ながらボケ/大げさ/裏切り…×例えツッコミ/ノリツッコミ/無視/説明ツッコミ等。**天丼**＝前半でウケたボケを終盤にもう一度乗せる（最初にウケてこそ爆発する）。出典: https://lifedata1.com/comedy-technique-070/ / https://waraitext.com/post-19/
- 冒頭からいきなり大ボケしない＝ジャブで「笑っていい空気」を先に作る。ギャップ＝極端な記号（真面目すぎる等）×意外な一面（強面が甘党）が最も安い高火力。
- ウマ娘の会話が「生きてる」理由はテキストだけではない: 1500超のモーション＋表情＋間＋カメラ＋SEをタイムライン式エディタで演出し、ライターがキャラ性格をスクリプターに監修共有。縦画面の日常会話と横画面のストーリーで演出密度を変える。＝**紙芝居の解毒はテキスト外の「間と動き」の層**。出典: https://cgworld.jp/flashnews/202307-cygames-um-script.html / https://magazine.cygames.co.jp/archives/27947
- ウマ娘で最も評価が高いのは「ゲームシステムと物語が一致した」シナリオ（ハルウララ=繰り返し育成をタイムリープとして物語化）。出典: https://note.com/ten_ko_chan/n/n13d2015966ff / https://www.inside-games.jp/article/2023/06/18/146632.html

---

# このゲームの会話を書くときの実践ルール15箇条

1. **1画面目は事件の途中から。** 状況説明で開けない。「疑問1個」を最初のタップで立てる（例:「──で、なんでポロが泣いてるの？」から始めて理由は後）。
2. **イベント冒頭10秒以内に「らしさの出る具体的行動」を1つ。** ミミなら借金まみれでも飯を分ける、サケなら竜の話になると早口になる。共感は行動で買う（Save the Cat）。
3. **会話イベント1本＝起承転結の4ビート（4〜8画面）。「転」の無いイベントは没にする。** 日常回・飯回・観光回は対立不要、コントラスト（いつもの→今日だけ違う）で駆動してよい。
4. **マクロは三幕、章内は起承転結（Spy x Family方式）。** 3話末＝反転、4話＝どん底、終章＝クライマックスに感情曲線を固定し、各章の解放イベントはその章の温度に合わせる。
5. **「お前も知っての通り」型セリフは全削除。** 既知情報を口にさせるなら、感情・利害・嘘のどれかを必ず乗せる。Wikipedia口調は常に禁止。
6. **説明はポロに聞かせる。** ポロ（喋らない・しぐさで反応）は天然の「知らない聞き手」＝説明が自然になる文脈製造機。しぐさのリアクションでShowも同時に達成。
7. **職業に語らせる時だけ講義は合法。** ミズ＝経済、スミカ＝行政、サケ＝竜学。ただし各人の偏見と欲を混ぜる（ミズは説明の途中で必ず損得勘定を始める、等）。
8. **1イベント＝新情報1個。残りは謎のまま次の解放へ。** イベントが言及する機能・キャラ・食事等は進行台帳（門番）を単一の真実として参照し、解放度のズレをfail-closedで根絶する（不満②の恒久対策）。
9. **感情の直言禁止。**「悲しい」「嬉しい」を言わせず、具体物・仕草・話題すり替えで見せる（「今日の風、目に染みるね」＋演出指定「視線を海へ」）。
10. **ネームレステストに合格するまで直す。** 6人＋ポロの「声表」を1枚作る: 一人称/語尾/文長/リズム/メタファー系統（サケ=竜と王家、ミズ=金と相場、スミカ=書類と規則、マクラ=配信用語と数字、セレスティア=天気と高所）/圧を受けた時の癖/食いつく話題。
11. **舞台調殺しの機械的手順**: 声に出して読む→1台詞を2文以内に割る→完全文法を崩す（言い差し「それは、その…」・省略）→呼びかけ・ツッコミで相手に向ける→抽象語を具体物に替える（「経済が悪化」→「今朝、串焼きが2枚から1枚になった」）。ただし「えっと」「あのー」の実会話再現はテンポを殺すので入れない。
12. **笑いはフリ→ボケ→ツッコミの3点で書き、ミミを常設ツッコミにする。** ボケっぱなし禁止（スカシは狙った時だけ）。冒頭から大ボケせず、ジャブ→本ボケ。ウケたボケは同イベント終盤で天丼（1回だけ）。
13. **ギャップ＝記号×意外な一面を全キャラに1個。**「世界の天井」セレスティアが妙に俗っぽい、行政秘書スミカが賭けに一番熱い、等。ただしキャラ崩しはそのキャラの「通常」が定着した後（登場2イベント目以降）。
14. **紙芝居の解毒はテキスト外の層（ウマ娘方式）。** セリフデータに演出メタ（間ms/表情/入退場スライド/SE/揺れ）を添えて書く。日常会話は演出軽め・山場は密度を上げる、のメリハリ自体が演出。立ち絵の「同時表示＋話者ハイライト＋間」だけでも紙芝居感は激減する（不満③）。
15. **ハルウララ原則＝プレイヤーの行動履歴を物語の弾にする。** スカウトで集めた八竜は名前・実データごと終章の絶滅メーター綱引きに実結線し、「お前が集めた8頭が来る」を最終決戦の転にする（不満⑤）。観光も同じ: 食べた飯・行った場所の記録をセリフが拾って初めて「旅行」になる（不満④）。

## 主要出典
- https://www.studiobinder.com/blog/save-the-cat-beat-sheet/
- https://reedsy.com/blog/guide/story-structure/save-the-cat-beat-sheet/
- https://www.johnyorkestory.com/2025/01/in-medias-res-when-and-why-to-use-it-in-video-game-stories/
- https://timmykokke.com/blog/2023/2023-05-17-kishotenketsu/
- https://www.septembercfawkes.com/2026/02/kishotenketsu-story-structure-explained.html
- https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
- https://stormwritingschool.com/exposition-in-dialogue/
- https://kosiboro.work/avoid-exposition-dialogue/
- https://note.com/serene_hebe1710/n/n75c8302fba2a
- https://racheljrowlands.com/2020/04/18/how-to-avoid-exposition/
- https://www.helpingwritersbecomeauthors.com/character-voices/
- https://writerslife.org/distinct-character-dialogue/
- https://enomotomethod.jp/column/conversationalsentences/
- https://enomotomethod.jp/column/comedy-gag/
- https://genbu-shobo.com/novel/novel-serifu-kakikata/
- https://lifedata1.com/comedy-technique-070/
- https://waraitext.com/post-19/
- https://cgworld.jp/flashnews/202307-cygames-um-script.html
- https://magazine.cygames.co.jp/archives/27947
- https://note.com/ten_ko_chan/n/n13d2015966ff
- https://www.inside-games.jp/article/2023/06/18/146632.html

---

# 付録B: ゲームデザインのリサーチ全文

リサーチ完了。以下が成果物です。

# Webリサーチ結果: ゲームデザイナーの金言 → 聖龍爆走録ミミへの翻訳

## リサーチ要旨（出典つき）

**1. 桜井政博**
- ゲーム性の定義=「リスクを冒して、リターンを得る！」。リスク=プレイヤーへのイヤなこと/ミス要素、リターン=それを排除し先へ進める利益。両者は「かなり近いところに適切な大きさで配置し、刺激的に織り込むべき」。2003年から一貫する持論（[電ファミ・講演再現記事](https://news.denfaminicogamer.jp/kikakuthetower/171130b) / [YouTube「リスクとリターン【ゲーム性】」](https://www.youtube.com/watch?v=cTSMohV3TgQ)）。
- おもてなし/最初の体験=「とにかくすぐ遊ばせる。映像で待たせると諦められる。**最初の3分で楽しさが分かるように**」（[チャンネルまとめnote](https://note.com/cute_minnow2246/n/n17d1bf9e68dc)）。
- ご褒美論=「ゲームにごほうびは必要不可欠」。ただし**貯める系のごほうびは"消費"とワンセット**、素材は"何かを作る"とワンセット（同上、動画C03「目の前に吊られたごほうび」・B02「ギュッとしてパッと解消」＝ストレス→開放の設計、[回タイトル一覧](https://note.com/mosox2/n/n8bb384686a56)）。

**2. 宮本茂**
- 「アイデアとは複数の問題を一気に解決するもの」。個別対処＝トレードオフの無限ループであり、真のアイデアは問題の根本を掘って一挙に解く（岩田聡による言語化、一次資料=[ほぼ日「アイデアというのはなにか？」2007](https://www.1101.com/iwata/2007-08-31.html)）。
- 箱庭（hakoniwa/miniature garden）=1986年のゼルダ以来「ミニチュアの庭を作っている」と答え続けている。縮減・示唆・遊び・驚きで**想像力と探索を誘う**。物語を押しつけず、覗き込み・見つける自由が主役（[Good Blood "The Question No One Asks Miyamoto"](https://goodblood.games/thequestionnooneasksmiyamoto) / [levitylab "What is a Miniature Garden?"](http://levitylab.com/cog/writing/whatisaminigarden/)）。

**3. FTUE/オンボーディング**
- 読ませず**やらせて学ばせる**（interactive learning / do-then-explain）。数秒で遊ばせ、設定・名前入力は後回し。ビジュアル誘導主体でテキスト最小。D1リテンションを直接左右（[Udonis FTUEガイド](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience) / [Game Developer FTUEベストプラクティス](https://www.gamedeveloper.com/design/best-practices-for-a-successful-ftue-first-time-user-experience-) / [Roblox Onboarding docs](https://create.roblox.com/docs/production/game-design/onboarding)）。
- 高度な概念は初回に詰めず**2セッション目以降に分割投与**（[AC&A Best Practices](https://adriancrook.com/best-practices-for-mobile-game-onboarding/)）。

**4. 目標バランス（やりたい/やれる）**
- 自己決定理論（Ryan & Rigby & Przybylski 2006）: **自律性・有能感・関係性**の3欲求が楽しさと継続を独立に予測（[Springer原論文](https://link.springer.com/article/10.1007/s11031-006-9051-8) / [PENS](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)）。
- 目標カスケード: 小目標が入れ子で大目標へ導く。**中期目標がリテンションの背骨**（セッションをまたぐ橋）（[Stankovic "The princess is in another castle"](https://medium.com/ironsource-levelup/the-princess-is-in-another-castle-understanding-the-player-goals-9ea6bea36dcd) / [Game Wisdom](https://game-wisdom.com/critical/short-long-term-progression-game-design)）。
- 任天堂の起承転結レベル設計（林田宏一/3Dワールド）: **教える→少し複雑に→ひねりで驚かせ→習得を披露させる**の4段を約5分で（[Game Developer](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design) / [Nintendo Life](https://www.nintendolife.com/news/2015/03/video_nintendos_four_step_stage_design_is_why_you_love_super_mario_games_so_much)）。

**5. フロー＆フック**
- Csikszentmihalyi: 挑戦と技能の均衡＋明確な目標＋即時フィードバックでフロー。プレイヤー層ごとにフローゾーンが違う（Chen 2006）（[Game Developer "Flow applied to game design"](https://www.gamedeveloper.com/design/the-flow-applied-to-game-design)）。
- Nir Eyal Hook Model: **トリガー→行動→可変報酬→投資**の4段ループ。可変報酬は「部族(社会的)・狩り(資源)・自己(達成)」の3種（[Mindtools解説](https://www.mindtools.com/aapqtdb/the-hook-model-of-behavioral-design/) / [Yu-kai Chouの批判的検討](https://yukaichou.com/gamification-analysis/hook-model-octalysis-habit-addiction/)）。

---

## このゲームの進行・会話配置の実践原則 12箇条

**第1条【3分で一周】** 初回セッションはコアループ（賭ける→レース→勝ち飯）を3分以内に一周させる。会話はその前に置かず、間に挟む。導入VNが長いなら「まず1レース→勝った後にサケが現れる」順へ（桜井/FTUE）。

**第2条【先にやらせ、後で名づける】** do-then-explain。オッズも交渉術も絶滅メーターも、まず触らせて結果を見せ、説明会話は「今起きたこと」の解説として置く。顧問の講義口調は全廃し「実況・ツッコミ・後追い解説」に変える（FTUE。①セリフの恥ずかしさの根も「体験より先に語る」ことにある）。

**第3条【ごほうびは出口とワンセット】** 通貨・食材・竜・衣装は、獲得と同時に使い道が開くこと。**くらしツリーと食事の解放度が合わない問題はこの条の違反**——「稼いだ直後に使える店が開く」「食材を得た章で調理イベントが開く」よう解放台帳を突き合わせる（桜井C03。②の直接処方）。

**第4条【1イベントで3つ解く】** 新しい会話イベントは「物語進行＋機構の教育＋感情の報酬」の最低2つ、理想3つを同時に果たすものだけ採用する。例:八竜が終章で走る一枚イベント＝⑤の結線＋スカウトの意味づけ＋絶滅メーターの熱、を一挙に解決（宮本のアイデア論）。

**第5条【言わずに見つけさせる】** 観光は説明でなく発見。崑崙島は箱庭＝「案内される旅」でなく「覗き込むと何かある庭」。観光地の魅力は会話で語らせず、行った先の小さな驚き（隠し飯・住民の一言・ポロの反応）で示す（宮本hakoniwa。④の処方）。

**第6条【1到着1概念】** 新概念の投与は1セッション1個まで。既存の「1到着1モーダル」ルールを会話イベントにも適用し、同一画面で複数顧問が別テーマを語る重複を禁止する（FTUE分割投与。②の重複の処方）。

**第7条【章は起承転結】** 各章＝「新機構を教える(起)→少し複雑な使い所(承)→ひねり/事件(転)→習得を披露する見せ場(結)」。転は顧問の担当領域で起こす（ミズ章なら相場急変、スミカ章なら行政の横槍）。結で必ずプレイヤーに「うまくなった自分」を実演させる（kishotenketsu）。

**第8条【中期目標が背骨】** 常に「次のレース(短)/章の目標(中)/借金完済・絶滅メーター(長)」の3層が1画面で見えること。会話イベントは中期目標の節目（章目標の半分・達成直前）に密度を上げて配置する。既存🎯目標チップはこの3層表示に寄せる（目標カスケード）。

**第9条【自律・有能・関係の3点満たし】** 会話の選択肢は飾りでなく「どの顧問に相談するか」「どの竜を推すか」の実選択に（自律）。予想的中・交渉成立には必ず固有の褒め台詞（有能感）。八竜・ポロ・顧問は「あなたを覚えている」反応を持つ——過去の勝利や食事を会話が参照する（関係性/SDT。①の"生きたキャラ"はここで作る）。

**第10条【ギュッとしてパッと】** 会話イベントの感情曲線もフロー設計。緊張イベント（借金取り・連敗・転落）の直後に必ず開放イベント（勝ち飯・温泉・ポロの甘え）を対で置く。緊張だけ・癒しだけの連続配置を禁止（桜井B02/フロー）。

**第11条【会話を可変報酬の池に】** 固定進行の会話だけでなく、レース後に確率で引かれる「ランダム小話プール」（部族=SNS/手紙、狩り=飯・戦利品、自己=記録更新の称賛）を持つ。「次は何が出るか」で帰宅動線を作る。トリガー=次戦予告、投資=竜育成・暮らしが翌セッションのトリガーを強化する（Hook Model。③紙芝居問題も「毎回同じ演出」への飽きが本質——池化で新鮮さを担保）。

**第12条【リスクの無い会話に駆け引きを】** 賭け以外——観光の行き先選び、食材の隠し味あて、交渉術——にも小さなリスク&リターン（外すと小損、当てると美味い）を敷く。ただしレース数値は不変の憲法を守り、報酬は表示・食・会話・図鑑に限る（桜井のリスクとリターン。④観光を「選んで当てる旅」にする鍵）。

**Sources:** [電ファミ桜井講演](https://news.denfaminicogamer.jp/kikakuthetower/171130b)・[桜井YouTube リスクとリターン](https://www.youtube.com/watch?v=cTSMohV3TgQ)・[桜井ch要点note](https://note.com/cute_minnow2246/n/n17d1bf9e68dc)・[回一覧note](https://note.com/mosox2/n/n8bb384686a56)・[ほぼ日 岩田×糸井](https://www.1101.com/iwata/2007-08-31.html)・[Good Blood: Miyamoto hakoniwa](https://goodblood.games/thequestionnooneasksmiyamoto)・[levitylab miniature garden](http://levitylab.com/cog/writing/whatisaminigarden/)・[Udonis FTUE](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience)・[Game Developer FTUE](https://www.gamedeveloper.com/design/best-practices-for-a-successful-ftue-first-time-user-experience-)・[AC&A onboarding](https://adriancrook.com/best-practices-for-mobile-game-onboarding/)・[Roblox onboarding](https://create.roblox.com/docs/production/game-design/onboarding)・[Ryan/Rigby/Przybylski 2006](https://link.springer.com/article/10.1007/s11031-006-9051-8)・[PENS](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)・[Stankovic goal structure](https://medium.com/ironsource-levelup/the-princess-is-in-another-castle-understanding-the-player-goals-9ea6bea36dcd)・[Game Wisdom progression](https://game-wisdom.com/critical/short-long-term-progression-game-design)・[Game Developer: Mario level design](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design)・[Nintendo Life 4-step](https://www.nintendolife.com/news/2015/03/video_nintendos_four_step_stage_design_is_why_you_love_super_mario_games_so_much)・[Game Developer: Flow](https://www.gamedeveloper.com/design/the-flow-applied-to-game-design)・[Mindtools Hook Model](https://www.mindtools.com/aapqtdb/the-hook-model-of-behavioral-design/)・[Yu-kai Chou on Hook Model](https://yukaichou.com/gamification-analysis/hook-model-octalysis-habit-addiction/)

---

# 付録C: 進行ゲート監査全文

監査完了。以下が結果です（すべて表示/メタ層の話。着順/オッズ/配当＝レース数値には一切触れない前提で最小修正案を付けます）。

# 進行ゲート監査：全解放システムの「段階と根拠」

前提メモ: `data_lifetree.js` は存在しない。くらしツリーのデータは `data_assets.js`（LIFE_TIERS/MILESTONE_ITEMS/LIFE_MILESTONES）＋ `js/lifetree_engine.js`（枝/prereq/コスト）＋ `js/hunger.js`（コイン支払いラップ）に分散。

## 1. 解放の時系列（1本のタイムライン）

| # | プレイヤー状態（契機） | 開くもの | 物差し | 根拠 (file:line) |
|---|---|---|---|---|
| 1 | 開始直後 | 第1話／レース(ランク1)／食事コレクション基本2段(レース場飯・自宅飯 全品)／基準単価50 | ― | data_assets.js:296, meals.js:327, hunger.js:32 |
| 2 | 初的中 (everHit) | 図鑑 | 実績 | poro.js:44, progression.js:18 |
| 3 | 3走＋第1話既読 | **第2話**→既読でミズ登場・モール・分析/相談 | 実績 | data_assets.js:297, ui_render.js:231, progression.js:73 |
| 4 | 現在コイン2,000 **OR** 下位3走 | ランク2（以降7まで同型） | **現在コイン**/走数 | state.js:338, data_ranks.js:94 |
| 5 | 初勝利 (wins≥1) | 観光マップ本体（tier0スポット即・tier1は総資産3,000） | 実績＋総資産 | ui_konron_map.js:106,27,108 |
| 6 | 第2話既読＋初勝利 | **第3話**→既読でスミカ・くらしツリー/生活資産 | 実績 | data_assets.js:298, progression.js:33, ui_assets.js:184 |
| 7 | 2勝 | ポロ発見→龍舎・竜スカウト(草原/密林) | 実績 | poro.js:159,274, scout_engine.js:39,42 |
| 8 | 総資産1万 | 生活ステージ1(自動生活資産)・LIFE_TIERS「その日暮らし」・目標「屋台のごはん」達成 | 総資産(高水位) | data_assets.js:24,696-703, goals.js:94 |
| 9 | 総資産3万 OR 第3話既読 | スカウト断崖 | 総資産 or 章 | scout_engine.js:43 |
| 10 | 総資産10万 | 生活ステージ2・LIFE_TIERS2・目標「引っ越す」達成・**基準単価50→300(×6)** | 総資産 | data_assets.js:25, goals.js:108, hunger.js:31 |
| 11 | （随時）現在コイン | 引っ越し(500〜5,000万)・くらしツリーのノード(基準単価×cost, prereqのみ)・衣装(1,500〜12万) | **現在コイン** | data_assets.js:46, hunger.js:117, lifetree_engine.js:220, data_assets.js:161-199 |
| 12 | 総資産100万＋第3話既読 | **第4話**→スマホ購入(3,000)→配信ホーム/SNS/フォロワー。同時: 観光tier2・スカウト火山/海(OR第4話)・基準単価2,000 | 総資産＋章 | data_assets.js:299, ui_render.js:267-283, ui_konron_map.js:27, scout_engine.js:44, hunger.js:30 |
| 13 | 総資産1,000万 | 生活ステージ3（←物語の100万より1桁遅い） | 総資産 | data_assets.js:26 |
| 14 | 総資産1億＋第4話既読 | **第5話/終章**→絶滅メーター・島づくり(コイン150万〜)・スカウト空中・観光tier3・**上級グルメ2段**・隠し衣装・基準単価10,000 | 総資産＋章 | data_assets.js:300, ui_economy.js:88, island.js:11, scout_engine.js:45, meals.js:322-327, data_assets.js:199, hunger.js:29 |
| 15 | 総資産10億 | 生活ステージ4「立派な屋敷」（←終章より後） | 総資産 | data_assets.js:27 |
| 16 | 総資産1兆 or 最終決戦クリア | ED・生活ステージ5・聖龍級・ランク7 | 総資産/実績 | data_assets.js:301,28, data_ranks.js:100 |

物差しが**5本並立**: ①ASSET_LEVELS(1万/10万/**1,000万**/**10億**/1兆) ②LIFE_TIERS(×10刻み10段) ③KM_TIER_AT(3千/100万/1億) ④hungerBaseUnit(10万/100万/1億) ⑤章(実績→100万→1億)。

## 2. 不整合一覧（重要度順・最小修正案つき）

**A.【確定バグ】「食べ歩きN品」系の解放が全部死んでいる。** `state.player.meals` は常に `{eaten:{},solved:{}}`（キー数=2固定）なのに `Object.keys(...).length>=10` で判定 → **k_meals10/25トースト・小イベント「みみしんぼ・外伝」・SNS投稿が永久に出ない**。ユーザー体感「会話イベント不足・暮らしと食の結線が薄い」の直因。
→ 修正: `mealStatsAll().got`（meals.js:312）に置換。**progression.js:96,99 / data_story_events.js:72 / sns.js:201** の3箇所。

**B.【本題】食事の上級グルメ=総資産1億 vs 観光の同じ料理=総資産100万で開く。** 島のミミグルマンの料理は観光スポットのご当地グルメと同一題材（塩パスタ=路地裏ビストロ、溶岩ステーキ=竜窯、パエリア=まかない食堂、リゾット=山小屋…すべて観光tier2=100万、かためプリン=喫茶はtier1=**3千**）。観光では写真鑑賞・投稿までできるのに、食事画面では同じ皿が「終章(1億)」ロック＝体感が100倍ズレる。
→ 修正(最小): **meals.js:326** `mealTierUnlocked` で `gourman` を `total>=1e6 || _chapter_intro_4`（観光tier2と同じ物差し）へ引き下げ、`shinbo` のみ終章維持。

**C.【構造】くらしツリー=現在コイン、食事/観光/物語=総資産(高水位)。** ノードには総資産帯(tier/at)の見た目があるのに、実解放はコイン×prereq連鎖のみ（lifetree_engine.js:220の注釈どおりP/総資産ゲート撤廃済み）→ コイン長者は「専属シェフ」級まで進むのに食事はまだ屋台、という逆転が構造的に発生。
→ 修正(最小): **lifetree_engine.js:222** `lifeNodeState` に `if (node.at > (state.player.totalAssets||0)) return "prereq";` を1行追加（＝帯到達まで待つ）。コイン支払い(hunger.js:117)はそのまま。

**D. 目標「屋台のごはんにありつく」(goals.js:94) が食べる行為と無関係**（判定=総資産1万）。初日に屋台メシを食べても未達成。
→ 修正: done を `mealStatsAll().got>=1` に。

**E. 目標「ワンルームへ引っ越す」(goals.js:108) が引っ越し機能と別台帳**（判定=総資産10万。実機能はコイン払いの roomLevel/tryMoveRoom＝data_assets.js:49-66）。引っ越しても未達成/引っ越さなくても達成。
→ 修正: done を `roomLevel()>=1` に。

**F. 化石テキスト「総資産3千で第2話が解禁」「総資産3万で第3話が解禁」。** 実際は 第2話=第1話既読+3走、第3話=第2話既読+初勝利（data_assets.js:297-298）。
→ 修正: `chapterUnlockHint()`（data_assets.js:307）に差し替え。**ui_mall.js:40 / mall_rpg.js:1266 / ui_assets.js:53,186,199 / ui_render.js:1766,3663**。

**G. 次目標バーの章進捗が旧閾値で嘘をつく。** ui_render.js:3244 が `storyUnlockAt`（旧 STORY_UNLOCK_AT: 第2話=3,000/第3話=30,000）で総資産進捗を表示。実ゲートは走数/勝数。
→ 修正: 第2話は `races/3`、第3話は `wins/1` で pct を出す（ui_render.js:3240-3247）。

**H. 観光スポットのポータルが「開いてる見た目→跳ね返される」。** モールスポット(tier1=3千)→renderMallは第2話ゲートで弾く(ui_mall.js:36)、竜舎林→renderScoutは2勝(ui_scout.js:28)、推しグッズ→renderSnsはスマホ購入=第4話(ui_sns.js:16)。
→ 修正: **ui_konron_map.js:560-563** の portal ボタン生成時に `mallUnlocked/poroScoutUnlocked/broadcastOn` を見て、閉なら「🔒 ◯◯で開く」表示に。

**I. 生活ステージ(ASSET_LEVELS)が物語と1桁ズレ。** 第4話「島がリゾート」(100万)なのにステージ3(常連がつく)は1,000万、終章(1億)なのに「屋敷」は10億。
→ 修正(最小): **data_assets.js:26-27** level3→1,000,000 / level4→100,000,000 に揃える（生活資産valueは万オーダーで総資産閾値近傍に副作用なし・レース非干渉）。

**J. 基準単価のクリフ（×6跳ね）。** hungerBaseUnit が4段しかなく(hunger.js:29-32)、総資産10万/100万/1億で食事・ツリー・月謝が一晩で6倍化。LIFE_TIERSの10段と不釣合い。
→ 修正: hungerBaseUnit を LIFE_TIERS の tierIdx 連動の階段（50/100/300/800/2,000/5,000/10,000）へ（表示専用経済のみ）。

**K.（軽微・OR/AND差）** mealEndgameOpen(meals.js:322)は「第5話既読 **OR** 1億」、第5話解禁は「第4話既読 **AND** 1億」。第4話未読でも上級グルメだけ先に開き得る。B案採用ならgourmanは対象外になるのでshinbo側だけ `chapterAvailable("5")` 相当に。

**L.（認識のみ・触らない）** ランク解放(state.js:338)は「現在コイン OR 走数」で唯一"現在コイン"物差しだが、maxWager＝賭け経済に直結するため**変更禁止**（レース数値不変の絶対条件に隣接）。スカウト断崖の「3万」(scout_engine.js:43)も旧閾値の化石だがOR側に章フラグがあり体感は保たれる＝現状維持可。

**優先順**: A（確定バグ・即効でイベントが増える）→ B（ユーザー指摘の本丸）→ D/E/F（目標と文言の嘘）→ C/I（物差し統一）→ G/H/J/K。

---

# 付録D: 演出エンジン調査全文

調査完了。以下、js/dialogue.js (399行)・style.css の dlg- 系 (1791-1867行)・images/cast/ 実地調査の結果。

# 会話演出エンジン調査報告（聖龍爆走録ミミ）

対象: `C:\Users\takakazu\projects\mimi_dragon_race_game\js\dialogue.js`（399行・自己完結IIFE・表示専用）/ `style.css` 1791–1867行 / 台本=`js/data_dialogue.js`・`js/event_hooks.js`(216行)・`js/event_registry.js`

---

## 1. 現在の表示能力

| 項目 | 現状 |
|---|---|
| 立ち絵スロット | **2固定**（left/right・`dlg-standee`）。bottom固定。3人目は同サイドを上書き |
| 表情差分 | ミミ=4種+自動推定（`inferExpr`: 文面正規表現→default/smile/happy/panic、`e:`明示>opts.mood>推定）。**顧問5人=1枚絵**（`img:"stand/<k>.webp"`文字列登録＝表情無効）。ポロだけ `img:{default,cry,surprise}` 形式 |
| 画像解決 | `imgChain()`: ミミ=`outfitImg(衣装,表情)` で `_cut`→表情→smile→default→絵文字の多段フォールバック。他=登録img→`images/cast/<id>.png`→絵文字。404で壊れない |
| 位置 | 話者のside（cast既定 or 行の`side:`上書き）。話者側=`active`、反対側=`dim`(opacity .52+brightness .6) |
| アニメ | 入場=`dlg-rise`(26px上昇+fade .34s・全員同じ)、話者=`dlg-breathe`(縦3px呼吸)。**退場アニメ無し**（finish()で即hidden）。シェイク/ジャンプ/ズーム/パン=**無し** |
| 背景 | **無し**。`dlg-scrim`=ラジアル暗幕+blur(2px)で「今いる画面」が透ける |
| テキスト | タイプライタ(speed=22ms/字・行内ウェイト無し)・3行分min-height確保(ガタつき防止◎)・`--cg`で話者色の枠/ネームプレート◎ |
| 操作 | タップ/Enter/Space/→=送り、Esc/スキップ釦=全飛ばし。**オート送り無し**・バックログ無し・部分スキップ無し |
| SE | **完全未結線**。`Sfx.play`は18種(click/coin/paho/alert/cheer/win/unlock/tick…)が既存なのに dialogue.js から一度も呼ばれない |
| API | `play(台本orID,{instant,speed,mood,auto,force})→Promise`・直列化chain・`register/registerCast/alias`・race_run中は自動棄却(`force:true`で例外) |

## 2. 「汚い紙芝居」の技術的原因（重い順）

1. **顧問が全員1枚絵**: `data_dialogue.js:93-97` が `img:` を文字列で登録するため、エンジンが対応済みの表情オブジェクト形式(`img:{default,happy,...}`)が使われていない。サケが激怒しても笑っても同じ絵＝紙芝居感の最大要因。**エンジン改修ゼロで直せる**（アセット追加+登録変更のみ）。
2. **背景が無い**: 夜市や浜辺の会話でもホーム画面が透けて見える＝場面と絵が不一致。
3. **画像切替が瞬間ポップ**: `loadInto()` が同じ `<img>` の src を直接差し替え→旧絵が一瞬残ってからパッと変わる。クロスフェード無し。
4. **感情アニメ無し**: 驚き/落胆/怒りでも呼吸3pxだけ。行単位の演出指定フィールド(`fx:`)が存在しない。
5. **話者フォーカスが弱い**: dimはあるがactiveの拡大なし・カメラ(stage)は完全固定。
6. **入場が全員同一の「下から26px」**: サイドからのスライドイン無し、退場アニメ無し（クローズは display 即消え）。
7. **間(ウェイト)制御無し**: `……`の後に溜めが作れない。SE無し・タイプ音無し。
8. **オート送り無し**（`auto` オプションは表情推定トグルであり自動送りではない）。

## 3. 低リスク演出強化の実装案（既存API非破壊）

行フィールドを**任意追加**で拡張（既存台本は全部そのまま動く）: `{ s, t, e, side, fx, se, bg, w, zoom }`

### 3-1. dialogue.js パッチ骨子

```js
// normalize() に追記（240行付近）— 新フィールドを透過
out.push({ s:..., t:..., e:..., side: l.side,
  fx: l.fx, se: l.se, bg: l.bg, w: l.w, zoom: l.zoom });

// ensureDom() — 背景レイヤ(scrimの下)を追加
var bg = mk("div", "dlg-bg");           // overlay.insertBefore(bg, scrim)
dom.bg = bg;

// step() 冒頭に追加
if (line.bg) setBg(line.bg);                       // 行指定 or run() で opts.bg
if (line.se && global.Sfx) try { Sfx.play(line.se); } catch(e){}
if (line.fx && !REDUCE) {                          // 感情アニメ: shake/hop/nod/flash
  var w = dom.slots[side].wrap;
  w.classList.remove("fx-shake","fx-hop","fx-nod"); void w.offsetWidth;
  w.classList.add("fx-" + line.fx);
}

function setBg(id) {                                // クロスフェード背景
  var url = /[/.]/.test(id) ? id : "images/bg/" + id + ".webp";
  if (dom.bg.dataset.cur === url) return;
  dom.bg.dataset.cur = url;
  var im = mk("img"); im.src = url;
  im.onload = function(){ dom.bg.appendChild(im); requestAnimationFrame(function(){ im.classList.add("on"); });
    while (dom.bg.children.length > 2) dom.bg.removeChild(dom.bg.firstChild); };
}

// loadInto() → クロスフェード化（img 2枚のダブルバッファ）
function loadInto(sl, list, sym) {
  var i = 0;
  function tryNext() {
    if (i >= list.length) { /* 従来の絵文字フォールバック */ return; }
    var im = new Image();
    im.onerror = function(){ i++; tryNext(); };
    im.onload = function(){
      var old = sl.img;
      im.className = "dlg-fadein"; sl.wrap.insertBefore(im, sl.sym);
      sl.img = im; sl.sym.style.display = "none";
      requestAnimationFrame(function(){ im.classList.add("on"); });
      setTimeout(function(){ if (old && old.parentNode) old.parentNode.removeChild(old); }, 300);
    };
    im.src = list[i];
  }
  tryNext();
}

// startType() — インラインウェイト {w:400} と行末ウェイト line.w、タイプ音
// full を [{ch, wait}] にプリパースし、tick 内で wait 分 setTimeout を伸ばす。
// 3文字ごとに Sfx.play("tick")（音量は sfx.js 側で既に小さい）。
// 例: t:"……そっか。{w:600}うん、行こう！"

// オート送り: opts.autoAdvance=true なら typing完了後 1200+full.length*30 ms で advance()
```

### 3-2. style.css 追加骨子

```css
.dlg-bg { position:absolute; inset:0; z-index:0; }
.dlg-bg img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  opacity:0; transition:opacity .45s ease; }
.dlg-bg img.on { opacity:1; }
.dlg-scrim { z-index:1; } /* bgの上に暗幕を重ねたまま */

/* 話者ズーム（transform-originを足元に） */
.dlg-standee { transform-origin: 50% 100%; }
.dlg-standee.active { transform: scale(1.05); }
.dlg-standee.dim    { transform: scale(.96); opacity:.45; filter: brightness(.55) saturate(.8); }

/* サイド別スライドイン（.in を左右で出し分け） */
.dlg-standee.left.in  { animation: dlg-in-l .38s cubic-bezier(.2,.8,.25,1) both; }
.dlg-standee.right.in { animation: dlg-in-r .38s cubic-bezier(.2,.8,.25,1) both; }
@keyframes dlg-in-l { from { transform: translateX(-9%) scale(1.05); opacity:0; } }
@keyframes dlg-in-r { from { transform: translateX(9%)  scale(1.05); opacity:0; } }

/* 感情アニメ（fx:'shake'|'hop'|'nod'） */
.fx-shake { animation: dlg-shake .4s ease both; }
.fx-hop   { animation: dlg-hop  .45s cubic-bezier(.3,1.6,.4,1) both; }
.fx-nod   { animation: dlg-nod  .5s ease both; }
@keyframes dlg-shake { 0%,100%{translate:0} 20%{translate:-8px 0} 40%{translate:7px 0} 60%{translate:-5px 0} 80%{translate:3px 0} }
@keyframes dlg-hop   { 0%{translate:0} 35%{translate:0 -22px} 70%{translate:0 3px} 100%{translate:0} }
@keyframes dlg-nod   { 0%,100%{rotate:0deg} 40%{rotate:2.5deg} }
/* 注意: .active の scale と衝突するため fx は translate/rotate プロパティで（transform合成回避） */

/* 立ち絵クロスフェード */
.dlg-standee img.dlg-fadein { opacity:0; transition:opacity .25s ease; position:absolute; bottom:0; }
.dlg-standee img.dlg-fadein.on { opacity:1; }
```

### 3-3. 顧問の表情差分（エンジン改修不要・即効性最大）

`data_dialogue.js:93-97` を変更するだけ（`imgChain` は object 形式対応済み・欠損は default→絵文字フォールバック）:

```js
["sake","mizu","sumika","makura","celestia"].forEach(function (k) {
  global.Dialogue.registerCast(k, { img: {
    default: "images/cast/stand/" + k + ".webp",
    smile:   "images/cast/stand/" + k + "_smile.webp",   // ←生成待ち。無ければ404→default
    happy:   "images/cast/stand/" + k + "_happy.webp",
    panic:   "images/cast/stand/" + k + "_panic.webp"
  }});
});
```
※現状 `imgChain` の object 分岐は `c.img[expr] || c.img.default` の2段で404フォールバック（loadIntoのonerrorチェーン）も効くので、揃った表情から順次投入できる。

### 3-4. SE結線の推奨マップ（Sfx既存18種を流用）

fx:'shake'→`Sfx.play("miss")`、fx:'hop'→`"paho"`、緊迫行→`"alert"`、章導入1行目→`"unlock"`、タイプ音→`"tick"`。fx→SE自動対応表をエンジン内 `FX_SE = {shake:"miss", hop:"paho"}` で持てば台本側は `fx:` 1語で音まで付く。

## 4. 立ち絵アセット現状と不足リスト

**現状 (`images/cast/`)**
- `stand/`（VN正本・webp切り抜き）: sake / mizu / sumika / makura / celestia **各1ポーズのみ**。poro=default+cry+surprise の3種。
- `mimi/`: 約30衣装 × **4表情完備**（default/smile/happy/panic）+ `_mini` チビ絵。ミミだけ表情豊か＝顧問との落差が紙芝居感を増幅。
- ルート直下に未結線の候補素材: mizu v2-wink/v3-think/v4-pen、celestia noise v1-3+galaxy_FINAL、sumika pose_v4/keyart、sake keyart dark/warm、makura v1/v2/keyart（→背景除去すれば表情差分に転用可能な原石）。
- `mini/`: 各キャラ顔アイコン系。
- **バグ級の欠落**: `epilogue_engine.js:19` が `images/cast/stand/stranger.webp` を登録しているが**ファイルが存在しない**（伏線お姉さん＝現在絵文字フォールバックで表示されている）。

**画像生成指示書に書ける粒度の不足リスト**（全て: 全身立ち絵・足元まで・透過webp・stand/既存と同じ頭身/ライティング・下端接地）

| キャラ | 必要表情 | 備考 |
|---|---|---|
| サケ（竜王女・親方肌） | smile(ニカッと豪快笑い) / happy(腕組み高笑い) / panic(目を剥く驚き) / angry(雷を落とす怒り) | 既存 stand/sake.webp をベース参照 |
| ミズ（エコノミスト） | smile(余裕の微笑) / happy(ウィンク※wink v2転用可) / think(顎に手※v3転用可) / panic(メガネずり驚愕) | v2/v3/v4は背景除去+トーン合わせで転用候補 |
| スミカ（行政秘書） | smile(お辞儀気味の淑やか) / happy(手を合わせて喜ぶ) / panic(書類を取り落とす) / serious(眼光鋭く) | pose_v4転用候補 |
| マクラ（配信者） | smile / happy(マイク掲げて絶叫アオリ) / panic(汗) / smug(ドヤ顔) | v1/v2転用候補 |
| セレスティア（世界の天井） | smile(慈愛) / serious(神性・目を閉じる) / sad(憂い) | galaxy_FINAL転用候補。第5話まで封印運用は既存ゲート維持 |
| 伏線お姉さん | **stranger.webp 本体（最優先・現在404）** + フード目深/素顔チラ見せの2種 | セレスティアと同一人物と分からないシルエット |
| ポロ | happy(跳ねて喜ぶ) / eat(ほおばる※poro_eat_raw転用可) / sleepy | ポロ/フォルダに原石多数 |
| ミミ | angry(ぷんすか) / cry(涙目) / shy(照れ) / kirin(キリッ決め顔) | 主要衣装(buniqro/newspaper/dragonrobe)だけ先行でも可。inferExpr のルール追加とセット |
| 実況・村の竜使い | 各1枚（現在絵文字📣/🧑‍🌾のみ） | モブ格なのでバストアップ可 |
| 背景（新設 images/bg/） | 竜舎/夜市/浜辺/レース場パドック/医務室…観光・食事イベントで使う場面 6-10枚 | 縦持ちスマホ用・下1/3はセリフ枠で隠れる構図 |

**実装順の推奨**: ①顧問表情差分の registerCast オブジェクト化（コード5分・絵は順次）→ ②クロスフェード+話者ズーム+スライドイン（CSS中心・低リスク）→ ③fx/se行フィールド+FX_SE表 → ④bg背景レイヤ → ⑤インラインウェイト+オート送り。全て表示専用でレース数値に不干渉、既存台本(`DLG.*`/event_registry/poro/epilogue/ending)は無改修で動作。

---

# 付録E: 観光・終章調査全文

■ コード調査結果（C:/Users/takakazu/projects/mimi_dragon_race_game）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. 観光の現状（js/ui_konron_map.js 611行 + js/konron_content.js 194行）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【規模とデータ構造】
- スポット＝51件の静的辞書 `KONRON_SPOTS`（ui_konron_map.js:30-89）。各スポットは name/cat/tier/time/photo/gourmet(任意)/shoot(撮れるもの)/line(一行コピー) を持つ。位置は持たず9エリア `KONRON_AREAS`（:92-102）に属する。
- カテゴリ＝10分類 `KM_CATS`（:13-24）：港・食べ歩き・ショッピング・レース観戦・温泉・絶景・推し活・奥地・宿泊・行政。
- 解放＝2段ゲート。①観光自体は初勝利 `konronMapUnlocked()` wins>=1（:106）②スポット個別は総資産tier `KM_TIER_AT=[0, 3千, 100万, 1億]`（:27, :107-108）。

【現在のUX動線】`renderKonronMap`（:166-263）
1. ヒーロー全景＋「島で、遊ぶ。」（:179-186）
2. 「いまの崑崙島」＝実時計の時刻帯＋日替わり決定的天候の空気テキスト `_kmIslandNow`（:112-123）
3. いちおし3枚 `KT_FEATURED`（:133, :192-196）
4. カテゴリタブ＋写真カード横レール（:198-209）
5. 日替わりフォトミッション「今日の一枚」（:211-229、抽選 `_kmPhotoMission` :475-482、達成記録は state.player.kurashi.pmDay/pmSpot :483-485）
6. 暗い地図モジュール＝エリアピン→ `_kmRenderPanel`（:495-611）でスポット一覧チップ→スポット詳細
7. スポット詳細＝写真バナー（タップ→フルスクリーンビューア `_kmOpenPhoto` :368-386→SNS投稿 `_kmSnsCompose` :388-412、sns.jsのaddMyPost経由）＋章スタンプ `KM_STAMP`（:458-470）＋スタンプラリー押印（spotsSeen台帳 :511-521, :536-550）＋見どころ/名物/豆知識 `_kmContentHtml`（:419-434）＋ポータルボタン（:559-563）

【フォトミッション/ガイドブックの仕組み】
- スタンプラリー＝spotsSeen台帳（K2還流台帳と共用）。初訪問で押印演出＋通し番号、エリア全収集で「制覇の証」（:535-550, :583-599）。
- ガイドブック `renderKonronGuide`（:266-297）＝`KONRON_GUIDE`（konron_content.js:153-189、歴史/文化/食/竜/地理の5分類24項目）を総資産tierで？？？解放。
- フォトコレクション `renderKonronGallery`（:301-338）＝景色＋グルメ写真のグリッド図鑑。
- スポットの読み物 `KONRON_CONTENT`（konron_content.js:12-149）は51スポット中25件のみ。残り26件（lounge/cafe/patisserie/jogai/ennichi/lodge/wagashi等の新しい波）は konronContentOf が null → 見どころ欄が空。

【「旅行してる感」に欠ける点（実装事実ベース）】
1. **会話ゼロ**：ui_konron_map.js に Dialogue.play 呼び出しが1件も無い（grep確認済）。到着時・写真撮影時・制覇時、すべて静的テキストとポップアップのみ。キャラの関与は「ミズ研究室」の名前差し替え `_kmShootOf`（:440-449）と章スタンプの一行キャプションだけ＝ガイド役が誰もいない。
2. **移動の演出なし**：ピンタップ→ `_kmRenderPanel()` が即時DOM再描画（:240）。移動時間・道中・乗り物・遷移演出が一切なく「地図UIの操作」であって「旅」ではない。
3. **到着＝写真1枚**：スポット体験の核が「写真を見る→SNSに投げる」の1アクション。時間帯 s.time はただのラベルで、`_kmIslandNow` の実時刻と結線していない（夜のスポットを朝に見ても同じ写真）。
4. **食事と未結線**：食スポットのポータルは `renderMeals` へ丸ごとジャンプ（:560）するだけ。meals.js の MEALS は独自tier（track/home/gourman/shinbo、meals.js:23-101）で、スポットIDとの対応が無い。例：g_paella「漁師町のまかないパエリア」(meals.js:57) と ryoshimeshi スポットは題材が同じなのにデータ上他人。スポットの gourmet 写真と MEALS の実食コレクションも別物＝「そこで食べた」体験にならない。
5. **解放軸が総資産のみ**：KM_TIER_AT は総資産だけ。章・物語と結びつくのは表示上の章スタンプのみで、「物語が進んだから新しい場所へ行ける」感が薄い。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
B. 終章の現状（js/epilogue_engine.js 284行 + island.js + ui_economy.js）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【場面ごとの流れ】
1. **伏線**：破産4回目で「知らないお姉さん」カメオ `maybeStrangerCameo`（epilogue_engine.js:46-57、台本 :25-42）。
2. **起動**：第5話再生で `epilogueStart`（:131-134、呼び出し ui_story.js:219 / ui_render.js:890）。メーターは RANGE=160 の真ん中＝単勝1.05倍表示から。
3. **綱引き**：レース確定ごと `doomTick` +3（:136-142、呼び出し ui_render.js:2441）⇔ 押し戻し `epPush`（:144-150）＝スカウト新規22（ui_scout.js:205）/資産レベル16（ui_render.js:2443）/買い物6（data_assets.js:226）/的中6・勝利11（ui_render.js:2442）＋島づくり投資 `epPushAmount`（island.js:127、節目doom8〜25）。振り切れてもソフト失敗 `onDoomReached`（:162-166）で65%へ戻すだけ。
4. **HUD**：ホームは🎯チップ1行（ui_home.js:409-413）→「🏦島の経済」の `_ecoExtinctionPanel`（ui_economy.js:201-239）にダイヤル＋？説明＋「⚔️決戦に持っていくもの」`_finalPrepList`（ui_economy.js:186-198）。
5. **最終決戦** `startFinalBattle`（epilogue_engine.js:241-284）：
   - BGM「絶滅のファンファーレ」（:246）
   - 前口上VN 3行（:248-252）
   - 走馬灯ショー `playFinalShowcase`（:202-240）＝`finalShowcaseBeats`（:181-198）の集計カード自動送り：総資産/ランク・完走/図鑑数/スカウト数/衣装数/ポロ/村レベル＋finaleカード「そして、最後のレース」（:208）
   - 締めVN 13行（:254-268）＝マクラ実況→サケ→セレスティア神眼→ミズ→スミカ→総立ち→ED送り
   - `epilogueClear`→`Ending.play`（:269-273）

【「持てる力をすべてくべる」感の欠如点】
1. **最終レースを走らない**：startFinalBattle は race_engine / race_canvas / 賭けを一切呼ばない。「最終レース」はnarrator台詞（:255, :259）で語られるだけの完全VN。ボタン→VN→カード→VN→ED、プレイヤー入力は「タップで進む」のみ。
2. **積み上げが頭数・金額の集計1枚ずつ**：finalShowcaseBeats はスカウト「N頭」（:190-191）、島は「村レベル」（:195-196。island.jsのislandTier/発展度は読まれない）。個体名・固有の思い出が出ない。
3. **「決戦の備え」が飾り**：_finalPrepList の4軸（竜8頭/島tier2/顧問5人/第5話）はコメントに明記の通り「カタルシスの提示のみ・ここでゲートはしない」（ui_economy.js:220-222）。8頭集めても集めなくても決戦の中身は1文字も変わらない。
4. **締めVNが固定台本**：顧問5人は喋るが、どの竜を集めたか・どの施設を建てたか・相棒ポロすら台本に登場しない（ポロは走馬灯の1カードのみ :194）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
C. 八竜（スカウト8頭）の実装と結線ポイント
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【現状の実装】
- 「竜を集める 8/8頭」の判定＝ ui_economy.js:188-193。`Object.values(state.player.collection).filter(e => e.scouted).length >= 8`。**「どの8頭か」を返すAPIは存在せず、頭数カウントのみ。**
- データの持ち方：`state.player.collection[dragonId] = { seen, scouted, affection }`（生成 poroColEntry poro.js:298、書き込み ui_scout.js:202-203、絆 raiseAffection poro.js:306-310）。IDは DRAGONS の id＝基本12頭（data_dragons.js:59-255）＋拡張40頭（data_dragons_ext.js:81-133、アーキタイプ×ティア自動生成）＝計52頭からポロ除く51頭がスカウト対象。ロケ割当は名前/traits正規表現の決定的スコア `scoutDragonHome`（scout_engine.js:51-76）。
- **最終決戦での役割＝現状ゼロ**。startFinalBattle はcollectionを読まない。スカウト竜が「登場」するのはEDスタッフロールのみ（ending_engine.js:98-112＝スカウト済だけ名前と色で列挙、未スカウトは「？？？？？？×N」）。皮肉にも押し戻し最大配点は scoutNew=22（epilogue_engine.js:72）＝ゲームは終章で竜集めを最も奨励しているのに、決戦で報われない。

【「八竜が登場する」結線の実装ポイント】
1. **8頭の特定**：`Object.keys(col).filter(id => col[id].scouted)` ＋ `dragonById(id)` の1行で竜データが取れる。affection降順ソートで「絆の深い八竜」も選べる。描画資産は既存で完結：個体色 `dragonColor`（data_dragons.js:44-46）、意匠 `DRAGON_DESIGN`（:278-293）、canvasスプライト rcDrawDragon（race_canvas.js）。
2. **レース数値不変との両立（3案）**：
   - **a. 演出登場（最安全）**：走馬灯 finalShowcaseBeats に八竜の個体名ビートを追加、または締めVN前に「八竜見参」カットイン（スプライト8体整列）。closing は普通の配列なので splice で動的行（「ゲート前に、ミミが心を通わせた八頭が並ぶ——」＋各竜名）を差し込める。Dialogue.registerCast の前例（epilogue_engine.js:15-22 のstranger登録）に倣い竜をcast登録して一鳴きさせることも可。数値に一切触れない。
   - **b. 演出専用レース（走らせる）**：最終決戦は現状賭け無し・配当無しなので、race_timeline/race_canvas の描画だけ再利用した「賭け対象外のエキシビション走」を挟めば race-math-immutable（着順/オッズ/配当の不変）に抵触しない。八竜＋神眼の答えの竜で走らせる絵が作れる。
   - **c. 実出走表への注入（非推奨）**：前例は `_encouragementOverride`（data_races.js:227-235 getRaceDragonIds、maybeOfferEntryEncouragement :254-268＝ポロ推薦枠）。ただしこれは実際にオッズ・結果が変わる機構であり「プレイヤーごとに違う8頭」を賭け対象レースに入れると表示専用の枠を超える。採るなら b の演出レースが正道。
3. **備えとの結線**：_finalPrepList（ui_economy.js:186-198）は既に4軸を持つので、「8頭達成→決戦演出で八竜パートが豪華になる」（未達成なら少頭数のまま出す）だけで、既存判定を1個も変えずに「集めた意味」が生まれる。

【関連ファイルの絶対パス】
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\ui_konron_map.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\konron_content.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\epilogue_engine.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\island.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\ui_economy.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\data_dragons.js / data_dragons_ext.js / data_races.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\scout_engine.js / ui_scout.js / poro.js
- C:\Users\takakazu\projects\mimi_dragon_race_game\js\ending_engine.js / ui_home.js / meals.js