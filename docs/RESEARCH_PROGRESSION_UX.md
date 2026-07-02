# 進行と見せ方のUXリサーチ — 商用品質に見せる作法（2026-07）

対象＝聖龍爆走録ミミ（縦型9:16・単発無課金・表示/ゲート/文言のみ変更可＝[[race-math-immutable]]）。
「商用品質」＝売る仕組みではなく**磨かれた商用モバイルゲームの手触り**のこと。
出典は2023-2026の業界記事＋定番のGDC講演/UX原典（URLは§③）。主要な主張（8語ルール・PvZの遅延導入・NN/gの開示原則・
アポイント4軸・Crossy Road事例）は原文で確認済み。それ以外の一部は検索結果要約ベース。

---

## ① 原則リスト

### 1. FTUE（初回セッション）

- **P1-1. 5分以内にコアループを一周させ、面白さで引き留める。**
  モバイルは「コアループを見せて続ける気にさせる」猶予が5分未満、勝負は最初の30分とされる。
  最初の1周＝賭け→レース→払戻。説明はその後でいい。
  → https://keewano.com/blog/first-time-user-experience-ftue-mobile-games/ ／ https://www.gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games

- **P1-2. 読ませず、やらせる（実操作＝選択のあるチュートリアル）。**
  「ボタンを押せ」だけの一本道チュートリアルは最悪とされ、序盤から小さな選択・小さなリスクを与えるべき。
  George Fan（PvZ）のGDC講演も「Do, don't read」＝実際にやらせるのが最良の学習と説く。
  → https://www.gamedeveloper.com/design/best-practices-for-a-successful-ftue-first-time-user-experience- ／ https://www.gamedeveloper.com/design/gdc-2012-10-tutorial-tips-from-i-plants-vs-zombies-i-creator-george-fan

- **P1-3. 画面上の指示文は極小に（同講演の目安「一度に8語まで」）。**
  文字量を絞るほど読まれる。台詞3行より、盤面上の1行＋実操作。
  → https://www.gdcvault.com/play/1015541/How-I-Got-My-Mom

- **P1-4. 教えは全編に分散し、メタ機能は最初の5分に入れない。**
  PvZは基本概念（お金）ですら10レベル以降に遅延導入した。序盤に暮らし/図鑑/収集の説明を重ねない。
  → https://www.gamedeveloper.com/design/gdc-2012-10-tutorial-tips-from-i-plants-vs-zombies-i-creator-george-fan

- **P1-5. 常に「開いたループ」を1本だけ見せる（目標＋報酬→達成→次のループ）。**
  FTUEの定石＝小さなgoal+rewardの連鎖。1本ずつ、達成のたび次がわずかに大きくなる。
  → https://www.gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games

### 2. 解放ペースと段階的開示（progressive disclosure）

- **P2-1. 段階的開示＝初期表示を最小にし、上級機能を後から。ただし「先がある」ことは見せる。**
  UX原典（NN/g）：初期選択を絞ると学習性・効率・エラー減。**ただし二次機能には「見える入口＋期待を作るラベル」が必須**
  （＝隠すのではなく、入口を見せて条件を書く）。ゲームでは「徐々に解放＝発見の喜び＋認知負荷減」。
  → https://www.nngroup.com/articles/progressive-disclosure/ ／ https://www.designthegame.com/learning/tutorial/mastering-user-retention-mobile-video-games

- **P2-2. 既定は「見せてロック（条件明示）」、サプライズ級だけ完全に隠す。**
  見えている未完・未解放（🔒＋条件、？？？枠、n/m進捗）は先読みの期待と再訪動機を作る。
  物語のどんでん返しや大変身（配信化など）だけは隠して驚かせる、の2層規律。
  → https://80.lv/articles/how-to-solve-player-drop-off-in-modern-mobile-game-design ／ https://www.ux-bulletin.com/zeigarnik-effect-ux/

- **P2-3. 解放の律動：序盤は毎セッション新要素、以降は漸減カーブ。**
  導入のケイデンス（何をいつ解くか）が離脱を左右する。基礎→自信がついた頃に複雑系。
  5-10時間の進行なら（実務目安）序盤1時間＝3-5個、以降はセッションあたり1個→2-3セッションに1個。
  → https://80.lv/articles/how-to-solve-player-drop-off-in-modern-mobile-game-design ／ https://medium.com/googleplaydev/understanding-games-that-retain-1847b16c86a7

- **P2-4. アポイント（時間で来させる）とアチーブメント（実績で解く）は別の道具。**
  アポイント設計の4軸＝時間間隔・関与度・進行性・ランダム性。単発無課金では実績ゲートを主軸に、
  時間ゲートは「軽い日課」止まりにする（罰・ストリーク切れの喪失感を作らない。入れるなら「取り逃し回収」を併設）。
  → https://www.gamerefinery.com/keep-your-players-in-game-with-appointment-mechanics/ ／ https://gameworldobserver.com/2019/06/10/appointment-mechanics

- **P2-5. 解放は「目標」に紐づけ、条件は具体的な行動＋数値で予告する。**
  リテンションするゲームの共通項＝目標と進行の可視性。条件不明のロックはただの壁になる。
  → https://medium.com/googleplaydev/understanding-games-that-retain-1847b16c86a7

### 3. 解放のお祝い・通知

- **P3-1. 通知は3段階に層別する：フル画面セレブレーション／トースト／dotバッジ。**
  実例ライブラリ（Game UI Database「Unlocks & Achievements」）でも様式はこの3層に大別される。
  新モード解放＝フル画面、小さな追加＝トースト（3秒自動消滅・非ブロック）、受動的変化＝バッジ。
  → https://gameuidatabase.com/index.php?scrn=158 ／ https://mobbin.com/glossary/toast

- **P3-2. バッジは「数」より「変化があった」を伝えるdotが基本。**
  カウントバッジは未読圧を生む。中身1種につきバッジ1種・多用しない。
  → https://www.setproduct.com/blog/badge-ui-design

- **P3-3. 祝ったら、その場でワンタップで試させる（単一CTA→当該画面へ直行）。**
  解放通知に選択肢を2つ以上載せない。「今すぐ見る▸」1本で新機能へルーティング。
  → https://gameuidatabase.com/index.php?scrn=158 ／ https://benrajalu.net/articles/ux-of-notification-toasts

- **P3-4. セッション開始時にモーダルを積まない（1回1枚・キュー・アイドル時表示）。**
  ポップアップは同時に重ねない＋頻度キャップが定石（キャップありはうんざり率が大きく下がる）。
  祝いは「達成の瞬間」に文脈内で出し、起動時にまとめて出さない。
  → https://www.poper.ai/blog/game-popups/ ／ https://popupsmart.com/blog/popup-timing

- **P3-5. 通知疲れの受け皿を用意する（重要=モーダル、その他=受信箱へ落とす）。**
  全部をその場で見せず、低優先はフィード/受信箱に流して能動的に読ませる。
  → https://www.setproduct.com/blog/notifications-ui-design

### 4. 無収益・単発ゲームのリテンション

- **P4-1. 日課は「ログイン褒美」でなく「コアループに沿う軽い行動ミッション」。**
  日次報酬は最普及の習慣化装置（韓国モバイル調査で95%が採用）だが、無課金単発では
  喪失感で縛るのでなく、1-3個の軽い行動（出走/的中/一品）で「今日のやること」を作るに留める。
  → https://arxiv.org/html/2504.10714v1 ／ https://www.gamerefinery.com/keep-your-players-in-game-with-appointment-mechanics/

- **P4-2. コレクションの「見える欠け」（n/m＋？？？シルエット）が最強の再訪動機。**
  収集完了欲＋サンクコスト（積み上げた記録）が課金なしでも継続を支える。
  → https://www.blog.udonis.co/mobile-marketing/mobile-games/psychology-behind-user-retention

- **P4-3. 「次の目標」を常時1つだけ、進捗バー付きで見せる。**
  マイクロゴールの頻打ち＝小さな達成の連続が満足度と再訪を作る。一覧は別画面、常設は1本。
  → https://gamedesignskills.com/game-design/player-retention/ ／ https://medium.com/googleplaydev/understanding-games-that-retain-1847b16c86a7

- **P4-4. セッションの終わりに「あと少し」を残す（ツァイガルニク効果）。**
  未完了タスクは記憶に残る。終了地点で未完の進捗（あと2勝で解放）を見せてから帰す。
  人工的な足止め（わざと未完にさせる摩擦）は逆効果なので、実在の進捗だけ見せる。
  → https://www.ux-bulletin.com/zeigarnik-effect-ux/ ／ https://medium.com/design-bootcamp/product-design-and-psychology-the-zeigarnik-effect-in-video-game-design-81cb97133af7

### 5. 縦型（9:16）UI規範 2024-2026

- **P5-1. 縦持ち＝片手・親指操作。主要操作は下1/3（親指圏）・タップ目標44px以上。**
  日本の実務ガイドも「親指が届く範囲に操作を集中」「最低44px」を明記。
  → https://cewigames.com/507/

- **P5-2. 骨格＝上：状態/戻る、中央：主コンテンツ、下：主CTA＋ナビ（ドック）。**
  現代モバイルはbottom-nav収斂。戻るは常に同位置（左上）で迷子を作らない。
  → https://www.designstudiouiux.com/blog/mobile-navigation-ux/

- **P5-3. safe-area insets（ノッチ/ホームバー）をenv()で必ず確保。**
  上下端に操作を置くならsafe-area必須（既にRESPONSIVE_GUARDRAILSに規定あり＝正しい）。
  → https://blog.felgo.com/cross-platform-app-development/notch-developer-guide-ios-android

- **P5-4. 配信風オーバーレイのゾーニング（TikTok Live標準）。**
  上帯＝LIVEバッジ/視聴者、中央＝主役（立ち絵）を侵さない、下1/3＝チャット/ゴールウィジェット、
  下隅＝リアクション/CTA。重要ビジュアルはチャットと衝突しないセーフゾーン内に。
  → https://ttwise.live/blog/tiktok-overlay-template-using-tiktory-and-tikfinity-2025

- **P5-5. ヘッダー/フッター/リスト/ステータス枠をコンポーネント化し全画面で共通化。**
  日本のゲームUI実務：共通パーツの組み替えで画面追加コストを下げ、統一感（＝商用感）を出す。
  → https://bakenekonoseitai.com/engineering/20210418-gameui/

### 6. 「商用に見える」低予算ゲームが磨いた点（事例）

- **Crossy Road（Hipster Whale・実質2-3人・12週間）**：「良いモバイルゲームは何が気持ちよく・何で共有されるか」の分析から出発。
  **リザルト画面（終了バナー）を「ゲーム本体の外では最重要のシステム」と位置づけて磨き**、キャラの見せ方（お試し＋ボーナス）という
  **提示だけの変更**で行動比率を大きく動かした＝表示層の磨きが商用感と成果を作る実証。Apple Design Award受賞。
  → https://gdcvault.com/play/1021897/Crossy-Road-A-Whale-of ／ https://www.gamedeveloper.com/design/what-design-lessons-can-we-learn-from-crossy-road-
- **音のバリエーションと即応**：同一SEをピッチ違いで複数持ち単調さを消す・音量バランス調整に時間を割く
  （個人開発2年ポストモーテム）。→ https://www.valadria.com/my-2-year-indie-postmortem/
- **「Juice it or Lose it」「Why your death animation sucks」系の磨き**：入力への即時反応・
  画面の揺れ/発光/数字の弾み等、少数のフィードバック強化が体感品質を最も安く上げる（定番講演群のまとめ）。
  → https://www.glowingeyegames.com/great-post-mortems-for-indie-developers/
- 共通する主張＝**スコープを絞り、コアループ周辺のフィードバック（音・アニメ・演出）に集中投資**。

---

## ② このゲームへの適用提案（画面/機能名で）

1. **初回5分KPIを計測**：タイトル→ホーム→race_select→race_detail（賭け）→race_run→result（払戻）までを新規stateで通しプレイし5分以内を保証。超えるなら序章VN（first_race_intro系）を圧縮（P1-1）。
2. **初賭けは「選ばせる」**：race_detailで初回のみ「ウダダのおすすめ2頭」チップを出し、読む前に低額単竜を実際に賭けさせる。tutorial_messageは1画面1行・8語相当まで（P1-2/P1-3）。
3. **最初の5分にメタ説明を入れない**：図鑑（collection）は現行どおり初的中で解放＝最初のメタ接触。暮らし/食事/観光の案内VNは第2話以降に遅延（P1-4）。
4. **hl-railを「見せてロック」に**：未解放のnavItem（モール/くらしツリー等）を非表示でなくグレー＋🔒＋条件1行（「第2話を読む＋総資産3千」）で常設表示。ただしポロ発見・スマホ購入→配信化・終章はサプライズ級なので隠したまま（P2-2の2層規律）。
5. **コレクション枠の統一**：scout（ロケ？？？）・図鑑・meals・崑崙ガイドブックの「枠は見せて中身？？？＋🔒条件」は正解なので全収集画面でn/m進捗を見出しに併記（「食事 28/44」）（P2-2/P4-2）。
6. **解放通知の3段階規律**：(a)新画面解放＝フル画面カットイン1枚＋「今すぐ見る▸」でgoto()直行、(b)品目追加＝トースト3秒、(c)受動変化＝navItemにdotバッジ。event_registryのdialogue連打を層別に置き換え（P3-1/P3-3）。
7. **ホーム到着時のモーダル1枚制限**：event queueは「ホーム描画→アイドル約2秒→1枚だけ」。2枚目以降はSNSタイムライン/ファンレターに投稿として落とす（通知の受け皿）。祝い本体はresult直後の文脈内で（P3-4/P3-5）。
8. **📋きょうのミッションに収集連動枠を1つ**：現行「出走・単勝(・コメント)」に「今日の一品（meals）/今日の一枚（観光）」型の+1タップ日課を追加。ストリークや未達ペナルティは作らない（P4-1）。
9. **result画面下部に「つぎ：」行を常設**：nextGoal()の残り条件（「あと2勝で🐲龍舎」）を払戻直後に見せ、セッション終端の「あと少し」を作る（P4-4）。
10. **🎯目標チップ（hl-goal）は現行設計を維持**：「次の1つ＋進捗バー」は原則通り。達成瞬間にチップが光って次目標へスライドするマイクロ演出だけ追加（P4-3）。
11. **スマホ購入→配信ホーム変身はゲーム最大のフル演出に**：一度きりの大変身はフル画面遷移が正当。ただし直後のSNS/フォロワー/コメントの新要素紹介は1画面1つずつ順送りに（P3-1と[[screen-transition-continuity]]）。
12. **配信ホームのゾーニングをTikTok Live標準に一致**：上帯＝LIVE/👁視聴者、下1/3＝コメント欄＋💬入力、右下＝❤️、中央の立ち絵は覆わない。🔊FABと通知類もこのセーフゾーン規約に従わせる（P5-4）。
13. **縦型骨格の監査項目化**：全31画面（nav.js SCREEN_INDEX）で「戻る＝左上TOP_BACK固定」「主CTA＝下1/3・44px以上」「上下端はsafe-area」をRESPONSIVE_GUARDRAILSのチェックリストに追記し🩺自己診断に組み込む（P5-1/P5-2/P5-3）。
14. **物語（聖龍日報）に「次号予告」欄**：story一覧の末尾に次章の？？？見出し＋解放条件（「総資産3万＋第3話」）＝見せてロックの物語版（P2-2/P2-5）。
15. **磨きの投資先はコアループ周辺に固定**：賭け確定音・払戻の数字の弾み・的中カットインなどrace_detail/result周りのSE/マイクロアニメをピッチ違い等で多重化（§6事例）。新画面を増やすより体感品質が上がる。

---

## ③ 出典一覧

### FTUE
- https://keewano.com/blog/first-time-user-experience-ftue-mobile-games/ — コアループ提示と説得の猶予は5分未満・最初の30分が勝負という業界基準。
- https://www.gameanalytics.com/blog/tips-for-a-great-first-time-user-experience-ftue-in-f2p-games — 最速で遊びに入れる・goal+rewardのオープンループ連鎖。
- https://www.gamedeveloper.com/design/best-practices-for-a-successful-ftue-first-time-user-experience- — 一本道「押せ」型チュートリアルの否定・序盤から選択と小リスクを。
- https://www.gamedeveloper.com/design/gdc-2012-10-tutorial-tips-from-i-plants-vs-zombies-i-creator-george-fan — Do don't read・教えの分散・メカニクスの遅延導入（お金は10レベル後）。
- https://www.gdcvault.com/play/1015541/How-I-Got-My-Mom — 同講演の原典（8語ルール等）。

### 解放ペース・段階的開示
- https://www.nngroup.com/articles/progressive-disclosure/ — 段階的開示の原典（初期表示を絞ると学習性向上）。
- https://www.designthegame.com/learning/tutorial/mastering-user-retention-mobile-video-games — 徐々の解放＝発見と認知負荷減。
- https://80.lv/articles/how-to-solve-player-drop-off-in-modern-mobile-game-design — 導入ケイデンスが離脱を左右・基礎→自信→複雑系。
- https://medium.com/googleplaydev/understanding-games-that-retain-1847b16c86a7 — 目標と進行の可視性がリテンションの共通項（Google Play公式チーム）。
- https://www.gamerefinery.com/keep-your-players-in-game-with-appointment-mechanics/ — アポイント機構の4軸（間隔/関与/進行/ランダム）。
- https://gameworldobserver.com/2019/06/10/appointment-mechanics — 同要約。

### お祝い・通知
- https://gameuidatabase.com/index.php?scrn=158 — 実ゲームの解放/実績通知UIの実例集（様式の層別確認用）。
- https://www.gameuidatabase.com/index.php?scrn=902 — モーダル/ポップアップの実例集。
- https://mobbin.com/glossary/toast — トースト＝非ブロック・自動消滅の確認通知という定義と使い所。
- https://www.setproduct.com/blog/badge-ui-design — dotバッジは「変化があった」通知・カウント乱用の戒め。
- https://www.setproduct.com/blog/notifications-ui-design — 通知疲れの構造と受け皿設計。
- https://benrajalu.net/articles/ux-of-notification-toasts — トーストの適所（場所を奪わない確認）。
- https://www.poper.ai/blog/game-popups/ — ゲーム内ポップアップは重ねない・文脈タイミング。
- https://popupsmart.com/blog/popup-timing — 頻度キャップの効果（キャップなし比で成果2-3倍）。

### リテンション（無収益）
- https://arxiv.org/html/2504.10714v1 — 日次ログイン報酬は最普及（調査対象の95%）等、リテンション機構の学術調査。
- https://www.blog.udonis.co/mobile-marketing/mobile-games/psychology-behind-user-retention — 収集完了欲・サンクコスト・習慣化の心理。
- https://gamedesignskills.com/game-design/player-retention/ — マイクロゴール頻打ちなど17戦術。
- https://www.ux-bulletin.com/zeigarnik-effect-ux/ — 未完了の可視化が再訪を作る（人工的摩擦は逆効果）。
- https://medium.com/design-bootcamp/product-design-and-psychology-the-zeigarnik-effect-in-video-game-design-81cb97133af7 — ゲームでの設計的未完了。

### 縦型UI
- https://ttwise.live/blog/tiktok-overlay-template-using-tiktory-and-tikfinity-2025 — TikTok Liveのゾーニング/セーフゾーン（上=バッジ・下1/3=チャット/ゴール・下隅=CTA）。
- https://cewigames.com/507/ — 日本語実務ガイド：親指圏集中・44px・縦持ち設計。
- https://bakenekonoseitai.com/engineering/20210418-gameui/ — 日本語実務：ヘッダー/フッター等の共通コンポーネント化。
- https://www.designstudiouiux.com/blog/mobile-navigation-ux/ — bottom-nav収斂などモバイルナビ規範（2026版）。
- https://blog.felgo.com/cross-platform-app-development/notch-developer-guide-ios-android — safe-area insetsの技術規範。

### 事例（低予算で商用感）
- https://gdcvault.com/play/1021897/Crossy-Road-A-Whale-of — Crossy Road ポストモーテム（12週間開発・リザルト画面最重要・提示変更の実証）。
- https://www.gamedeveloper.com/design/what-design-lessons-can-we-learn-from-crossy-road- — 同作の設計教訓の解説。
- https://www.valadria.com/my-2-year-indie-postmortem/ — SEのピッチ多重化・音量バランス・スコープ絞りが体感品質を作った個人開発ポストモーテム。
- https://www.glowingeyegames.com/great-post-mortems-for-indie-developers/ — 「Juice it or Lose it」等、磨き系定番講演の案内。
