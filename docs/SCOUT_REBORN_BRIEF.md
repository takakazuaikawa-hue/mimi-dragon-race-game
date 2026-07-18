# SCOUT_REBORN — ドラゴンスカウト全面再生指示書（実装担当:Opus4.8 / 2026-07-18）

> このファイルだけで作業完結すること。リポジトリ=このプロジェクトルート。
> 目的: スカウトを「UX・ゲーム設計・見た目」すべて商業品質のゲームに作り変える。

## 絶対規律（違反=作業無効）
1. **レース数値不変**: 着順/オッズ/配当/FinalPower/賭け判定に一切触れない。全機能は表示メタ。
2. **壊さない既存結線**: 交渉数式(scout_engine.js scoutResolve/scoutHand/persona/seeded PRNG)/伝承3段解禁(data_dragon_lore.js・I遭遇/II信頼50/III成立)/絆・お世話・大好物(poro.js bondRank/stableCare/dragonFavFood)/八竜見参(epilogue_engine.js scoutedRoster)/成立払い出し(collection.scouted+seen＋raiseAffection(+12)＋epPush("scoutNew"))。UI層だけ再構築。
3. **キャラ門番fail-closed**: 顧問の登場述語はadvisorMet()のみ。ポロ=poroFound()。
4. **検証**: コードを読んで「成立✓」は禁止。実プレイ＋スクショ（PC枠と**スマホ375×812のresize両方**）＋コンソールerr0で完了宣言。
5. **資産**: 新画像をコードから参照したら**同コミットでgit add**。完了前にjs/css/htmlの`images/...`参照とgit ls-filesを突合（未追跡=本番404の前科あり）。
6. **CSS**: 本ファイルは多層イテレーションの後勝ち積層あり。上書きが効かない時はCSSOM全走査で後方の勝者行を特定し直接編集（前科: tik-barのsafe-area三重=6463/6924/6953行）。
7. **デプロイ**: `perl -i -pe 's/\?v=OLD/?v=NEW/g' index.html`（PowerShell禁止=文字化け）→対象ファイルのみgit add→commit→push origin main→flying-pixel-dragonsにmerge+push。コミット末尾`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## 現状（live 46b27bc）
- ハブ: 6ロケ（grass/jungle/cliff/sea/volcano/sky・段階解放・旅費）→_scoutTrips+完走数で決定的に1頭遭遇。
- エンカウンター: HD-2Dキー抜きスプライト舞台（SCOUT_LOC_BG=観光写真の転用）＋しぐさ吹き出し＋信頼/警戒ゲージ（成立/逃走マーカー・デルタ・大詰めパルス）＋手札5枚（37交渉術・現心情の正解を必ず1枚含む）＋観察/ぱほぱほ/ポロ通訳。
- 弱点=ユーザー指摘: ①探索感ゼロ（タップ→即遭遇）②毎回同じ選択肢ループで竜ごとの体験差が薄い ③学習/上達の実感がない ④見た目が間に合わせ。

## 再設計（3フェーズ・すべて表示メタ）
### A: 探索「けはい探し」（遭遇前の1手・新規）
- ロケ入場後に3択（例:🐾足跡を追う/🍃風下に回る/🍖餌場に張る）。文言はロケ専用6×3=18本、コメディ混じり・ハズレなし。
- 効果（決定的・既存seeded PRNG流儀）: (a)遭遇竜が変わる=pool内offset (b)初期警戒に-8/±0/+8 (c)たまに小発見=未遭遇竜の断章Iヒント。
### B: 交渉の深化（現画面を拡張）
- **距離演出3段**: 警戒帯域でスプライト遠(小・薄)→中→近(大・鮮明)。「近づいてる」を絵で示す。
- **交渉メモ=学習**: collection[id].memoに効いた技カテゴリを自動記録。既知竜の手札に「前回◎」バッジ。図鑑詳細にメモ表示。
- **手土産**: 入場時に実食済みMEALSから1品持参可（コイン消費=mealPrice）。1回だけ強カード「差し入れ」。大好物なら特大効果+favFound記録（dragonFavFood使用）。
- **決裂の物語化**: 決裂時「今日は〇〇の気分だったらしい」＝心情の正解開示＋学び1行。挫折を攻略情報に。
### C: 見た目統一（Codex納品前提=CODEX_ORDER_SCOUT_MALL.md）
- 6ロケ専用の縦長舞台絵→SCOUT_LOC_BG差し替え（届くまで現行転用・404フォールバック維持）。
- 交渉術カード7カテゴリアイコン（身/声/間/贈/真似/遊/技）＝tik-tab同様「SVG onload置換・無ければ絵文字」。
- 成立演出: スプライト駆け寄り(transform)＋紙吹雪(CSS)＋絆バー→龍舎導線。

## 完了条件
探索3択→遭遇→距離演出→メモ蓄積→手土産（大好物発見）→成立/決裂の全経路を実プレイ・スマホ375スクショ。伝承解禁/払い出し/八竜集結の回帰なし。err0。両ブランチデプロイ。
