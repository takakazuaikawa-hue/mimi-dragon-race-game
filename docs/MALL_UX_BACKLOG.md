# モール（巨大モール大冒険）品質・視認性・UX 改善バックログ

新規セッション（Sonnet 5等）が本ドキュメントだけを読んで実装に着手できるよう、
問題・根拠・修正方針・受け入れ基準を1項目ずつ自己完結でまとめた。

## 前提（着手前に必ず読むこと）
- 本リポジトリの絶対ルールは `/CLAUDE.md` に従う。特に：
  - **レースの数値は変更禁止**：`race_engine.js` / `odds_engine.js` / `betting_engine.js` に触れない。
  - **CSS/JSを変更したら `index.html` の `?v=YYYYMMDDx` を全箇所一括更新**してから同時にコミット
    （現在ライブの版数は `git show origin/main:index.html | grep -oE '\?v=20[0-9]{6}[a-z]'` で確認し、前方更新）。
  - main への push は即デプロイ（GitHub Pages）。壊れたコードを push しない。
  - 新機能には「？導線／🆕バッジ／既定で閉じる」の3点セット、数値報酬は既存6通貨（コイン/総資産/暮らしP/ランク/メダル系/衣装）のどれかに落とす
    （`docs/GAME_DESIGN_NUMBERS.md` 参照。ただしモール内通貨＝ゴールド/チケット/みがき/衣装は「モール専用・コイン非干渉」で完結しており、これは別レイヤーの既存ルール）。
- モールの主要ファイル：
  - `js/mall_rpg.js` … 探索/戦闘/ショップ/報酬ロジック＋2D描画本体（最大ファイル）
  - `js/mall_view_3d.js` … 一人称ビューの3Dレンダラ（実証・既定OFF）
  - `js/ui_mall_rpg.js` … **`mall_rpg.js` の後に読み込まれ、`rpgRenderHub` を丸ごと再定義（後勝ち）**。他の画面（探索/戦闘/ショップ等）には触れない。
  - `style.css` 内 `.rpg-*` クラス群（モール本体）／`.scm*` クラス群（`ui_mall_rpg.js` のハブ専用スタイル）
- 検証：`node -c <file>` で構文確認。ローカルプレビュー不可な環境では、変更前後で該当関数の呼び出し関係が壊れていないか目視で追う。

---

## P0（重大：実装済み機能がプレイヤーに届いていない／README記載の仕様が壊れている）

### 1. ハブ画面の🏅称号・フロア進捗帯が実プレイヤーに一切見えていない
- **事象**：`js/mall_rpg.js` の `rpgRenderHub()`（称号セクション：`rpgTitles()`/`rpgTopTitle()` 呼び出し部、フロア帯：`rpg-floorstrip` を組み立てる部分）に称号・踏破フロア帯のUIがあるが、**`js/ui_mall_rpg.js:10` の `rpgRenderHub(app)` がこれを完全に上書き定義**しており（classicスクリプトは「後勝ち」＝`index.html`で`ui_mall_rpg.js`は`mall_rpg.js`の後に読み込まれる）、実際に画面に出るのは `ui_mall_rpg.js` 版のみ。称号一覧・フロア帯・🔕静けさのお香に関する言及はこのファイルに一切無い。
- **なぜ問題か**：称号システム（モール制覇者/お買い物名人/ドラゴンモールの主/天空の登頂者/すれちがい博士）とフロア踏破の可視化は、やり込み要素の中核（クリアの達成感の演出）。実装済みなのに誰の目にも触れていない状態。
- **修正方針**：`js/ui_mall_rpg.js` の `rpgRenderHub()` に、`js/mall_rpg.js` 側で定義済みの `rpgTitles()` / `rpgTopTitle()` を呼び出すセクションを移植する。
  - 見た目は `ui_mall_rpg.js` の `.scm*` トーン（station SQUARE風ライト）に合わせて新規クラス（例：`.scmr-titles`, `.scmr-title-row`）を追加する（`.rpg-titles`/`.rpg-title-row` をそのまま流用せず、既存の `.scm*` デザイン言語に寄せる）。
  - 挿入位置の目安：「🏆 きろく」アコーディオンの直前（`js/ui_mall_rpg.js:138` 付近）に「🏅 称号」アコーディオンを追加。
  - フロア帯（`1F▸2F▸…▸屋上`、到達=点灯／次=強調）も同様に、ステータスカードの直後（`js/ui_mall_rpg.js:50` の「つぎの目標」の下）に軽量な帯として追加。
  - **`rpgData()`/`rpgShopTotalOwned()`/`RPG_FLOORS` 等の既存ヘルパーをそのまま使い回す**（新規ロジックを作らない。`rpgTitles()`はロジックそのままでOK、描画だけを`.scm*`向けに書く）。
- **受け入れ基準**：ハブ画面（`renderMall()` → 大冒険入口）を開いたとき、称号セクションとフロア帯が見え、称号未獲得は「あと◯◯」のヒントが出る。既存の他セクション（ガチャ/自分磨き/ショッピング帳等）の見た目・挙動は変えない。

### 2. 敵アート差し込み口（`rpgEnemyVisual`）が戦闘描画から呼ばれておらず、README記載の仕様が機能していない
- **事象**：`images/rpg/README.md` は「ここに画像を置くだけで、コード変更なしに絵文字→アートへ自動で切り替わります」と明記し、`RPG_ART_ENEMIES`（`js/mall_rpg.js:2129`、現状は空配列）にidを足せば `images/rpg/enemies/<id>.webp` が反映される、と案内している。しかし実際の戦闘描画 `rpgDrawBattle()`（`js/mall_rpg.js:1924`）は敵アイコンを **`ctx.font=...; ctx.fillText(e.ref.ic, ex, cy)`（`js/mall_rpg.js:2010`）で直接描画**しており、画像用の `rpgEnemyVisual()`（`js/mall_rpg.js:2138`、DOM `<img>` または `rpgMakeSprite()` の `<canvas>` を返す関数）を一切呼んでいない。
- **なぜ問題か**：README通りに `enemies/slime.webp` を置いて `RPG_ART_ENEMIES=["slime"]` としても、戦闘画面には絵文字のまま——**ドキュメントに書かれた仕様が実際には動かない**。将来アートを追加する際に必ず踏む地雷。
- **注意（重要な設計上の制約）**：`rpgEnemyVisual()` は **DOM要素（`<img>`/`<canvas>`）を返す**設計（ショップ等のDOM描画向け）。一方 `rpgDrawBattle()` は**単一の`<canvas>`に直接ctx描画**するループ。DOM要素をそのままcanvasには描けないため、「呼び出すだけ」では直らない。修正は以下のいずれかの方針で行う：
  - **(a) 推奨**：戦闘描画専用に、`id → HTMLImageElement` の**画像キャッシュ**を新設し（`race_canvas.js` の `rcBgForSlug()` の画像キャッシュパターンを参考に、`onload`で`ok`フラグを立てて再描画、`onerror`でフォールバック＝絵文字のまま）、`RPG_ART_ENEMIES.indexOf(id)>=0` かつ画像ロード済みなら `ctx.drawImage()`、そうでなければ現状どおり `ctx.fillText(emoji)`。
  - (b) 代替：`rpgEnemyVisual` 自体は変えず、戦闘専用の並行関数（例：`rpgBattleEnemyImg(id)`）を新設し、同じ`images/rpg/enemies/<id>.webp`パスと`RPG_ART_ENEMIES`配列を参照する。
  - いずれの場合も **404を出さない**（画像が無い/エラー時は絵文字にフォールバックし、コンソールエラーを握りつぶす＝try/catchかonerrorで処理）ことをREADMEの約束どおり維持する。
- **受け入れ基準**：`RPG_ART_ENEMIES` にidを1つ追加し対応する `images/rpg/enemies/<id>.webp`（ダミーでよい）を置いた状態で戦闘に入ると、その敵がアイコン画像で描画される。配列に無いidは従来どおり絵文字。ダメージ計算・HP等の数値には一切触れない（描画分岐のみ）。

---

## P1（品質・視認性）

### 3. 死蔵CSS「バトルUIリニューアル」ブロックと、戦闘中HP表示が小さいまま
- **事象**：`style.css:5854`〜`5924`付近に「⚔️バトルUIリニューアル：大きなHP／タイミングバー」ブロック（`.rpg-hp2`, `.hp2-val{font-size:28px}`, `.mpsp`, `.rpg-beat`, `.beat-zone`等）があるが、**JS側（`js/mall_rpg.js`）からは一切参照されていない**（`grep -n "rpg-hp2" js/mall_rpg.js` は0件）。実際に戦闘中に使われるHP表示は `js/mall_rpg.js` の `.rpg-me .me-stat.hp` で、`style.css:5969` の `.rpg-me .me-stat.hp b { font-size:15px }` と小さく、コメントで「HP管理が楽になったのでHPは"読める範囲で控えめ"に」と意図的に縮小されている。
- **なぜ問題か**：戦闘中の最重要情報（自分のHP）が小さく、かつ「大きく見せる」ために作られたCSSが完全に死蔵＝今後の改修者を混乱させるノイズ。
- **修正方針（どちらか選択、両方はやらない）**：
  - **(a) 推奨・軽量**：死蔵CSS（`.rpg-hp2`/`.mpsp`/`.rpg-beat`/`.beat-zone`関連、未使用と確認できた範囲のみ）を削除し、代わりに現行の `.rpg-me .me-stat.hp b` の `font-size` を15px→20px程度に上げ、低HP時（`d.hp <= d.maxhp*0.25`）の警告色をより明確にする（既存の`.me-stat.hp.low`相当のクラスがあれば流用）。
  - (b) 本格改修：死蔵CSSを活かす形で `.rpg-me` を `.rpg-hp2` ベースに作り直す（工数大・慎重に）。
- **受け入れ基準**：戦闘画面でHP数値が明確に読み取れる大きさになる。死蔵CSSが削除された場合は他画面に影響が無いことを`grep`で確認（削除対象クラス名が他で使われていないこと）。

### 4. ハブ画面（`ui_mall_rpg.js`版）の補助テキストがコントラスト不足
- **事象**：`style.css:2352` で `--scm-sub: #8a8178`（薄いグレーベージュ）を定義し、`style.css:2359,2480,2504,2518,2520,2523,2524,2529,2534,2541` など多数の10.5〜11.5px の小さい補助テキストに使用。白系カード背景に対してコントラスト比が低く（目測で概ねWCAG AA基準4.5:1を下回る）、屋外や視力の弱いユーザーには読みにくい。
- **修正方針**：`--scm-sub` の値を、背景とのコントラスト比が4.5:1以上になる色（例：`#6b6259`程度まで暗く）に調整する。1変数の変更で影響箇所全てに波及するため低リスク。
- **受け入れ基準**：`--scm-sub` を使う全箇所（上記行）で文字が僅かに濃くなり読みやすくなる。他の色変数（`--scm-org`/`--scm-ink`/`--scm-line`）は変えない。

### 5. ミニマップのアイコンがDPR非対応でぼやける
- **事象**：`rpgMiniMap()`（`js/mall_rpg.js:2148`付近）は `cell=14` の固定値で `canvas.width/height` を設定し、`devicePixelRatio` を一切考慮しない（他の描画関数 `rpgFitCanvas()` はDPR対応済みなのと対照的）。さらに `style.css` の `.rpg-mini.ov canvas { width:76px; height:auto; }` でCSS表示サイズを縮小しているため、Retina等の高DPR端末では二重にぼやける。
- **修正方針**：`rpgFitCanvas()` と同様のDPRスケーリングを `rpgMiniMap()` にも適用する：`canvas.width = RPG.w*cell*dpr`, `canvas.height = RPG.h*cell*dpr`（`dpr=Math.min(2, devicePixelRatio||1)`）とし、描画時に `ctx.scale(dpr,dpr)` するか、`cell`自体を`dpr`倍にして描画後にCSSで元のサイズへ縮小表示する。既存の階段シェブロン等の線幅（`ctx.lineWidth=1.4`等）もdpr倍する。
- **受け入れ基準**：高DPR端末（もしくはブラウザのデバイスピクセル比シミュレーション）でミニマップの階段/出口/宝箱アイコンがくっきり見える。既存の色分け・レイアウトは変えない。

### 6. お店の「買う／値切る」ボタンのタップ域が小さい
- **事象**：`style.css:4925` `.good-acts .gbuy, .good-acts .ghaggle { padding:6px 4px; font-size:12px; }` で実測高さ約26〜28px。モバイル推奨最小タップ域（44px）を大きく下回り、密集した2列グリッド（`.rpg-shopwall`）内で誤タップしやすい。
- **修正方針**：`.good-acts .gbuy, .good-acts .ghaggle` に `min-height:40px`程度を追加し、`padding`を`8px 4px`程度に増やす。カードの縦幅が増える分、`.rpg-good` のレイアウトが崩れないか併せて確認。
- **受け入れ基準**：ショップ画面で「買う」「値切る」ボタンが指で押しやすい大きさになり、カード全体のグリッドレイアウトは崩れない。

---

## P2（UXの仕上げ）

### 7. `prefers-reduced-motion` 対応の網羅漏れ（`rpgpulse`アニメーションの大半が対象外）
- **事象**：`rpgpulse` アニメーションは `style.css` 内で18箇所ほど使われているが（`.rpg-chip.calm`, `.rpg-chip.goal.done`, `.rpg-start.rpg-next`, `.rpg-ctl-shop.has`, `.rpg-chip.gacha`, `.rpg-auto.on`, `.rpg-movebtn.stairs`, `.rpg-movebtn.shopenter.has`, `.rpg-actbtn.shop.has`, `.rpg-shop-hint.has` 等）、`@media (prefers-reduced-motion: reduce)` でアニメーション無効化されているのは `.rpg-hpbar.low`, `.rpg-act.ult.full`, `.mpsp.sp.full`, `.rpg-hp2.low` のわずか数クラスのみ。
- **修正方針**：`@media (prefers-reduced-motion: reduce)` ブロックに、上記の未対応クラス全てを追加し `animation:none` にする（複数の既存reduced-motionブロックを1箇所にまとめる必要はない。既存のブロックのどれかに追記でよい）。
- **受け入れ基準**：OS/ブラウザの「モーション減らす」設定をONにした状態で、モール内の脈動演出（お香チップ・階段ボタン・ガチャチップ等）が点滅しなくなる。

### 8. 探索画面下部でログとお店ヒントが帯域重複する可能性
- **事象**：`style.css:5707` `.rpg-log.ov { left:8px; right:96px; bottom:8px; z-index:3; }` と `style.css:5938` `.rpg-shop-hint { left:50%; bottom:8px; z-index:3; }` が同じ下端帯域・同じz-indexを使用。店の前でログが2〜3行出ている状態だと、中央のパルスする「🛍️お店に入る」ヒントと視覚的に重なる可能性がある。
- **修正方針**：`.rpg-shop-hint` の `bottom` を `.rpg-log.ov` の想定最大高さ分だけ上にずらす（例：`bottom:8px` → `bottom:64px`程度、要実機確認）か、`.rpg-log.ov` の `right` をもう少し狭めて重ならない配置にする。
- **受け入れ基準**：ログが3行表示された状態でも「お店に入る」ヒントが隠れず読める。

### 9. 初回プレイヤー向けの操作ガイドが弱い
- **事象**：唯一の操作説明は `rpgStartRun()` 内の1行ログ（`js/mall_rpg.js:303`付近「🏝️ リゾート探検へ！ ▲で進む・↰↱で向き…」）で、最大3行しか見えない探索画面のログオーバーレイ（`js/mall_rpg.js:1514`付近）にすぐ埋もれる。ヘルプモーダル（`rpgShowHelp()`）は「？」ボタンを自発的にタップしないと開かない。
- **修正方針**：初回（`state.player.rpg` に「モール大冒険を一度もクリアしていない」等の目印が無い場合）に限り、探索開始直後の1回だけ、操作説明を**軽量なオーバーレイ**（既存の`rpgFx.banner`等の演出パターンを流用）で数秒表示するか、既存の「？」ボタンに🆕バッジを一時的に付与する（CLAUDE.mdの「？/🆕/既定で閉じる」3点セットに準拠）。
- **受け入れ基準**：初回プレイ時に操作方法が能動的なタップ無しで一度目に入る。2回目以降のプレイでは出ない（フラグ管理）。既存のヘルプモーダルの内容は変えない。

---

## 実装時の共通チェックリスト（`GAME_DESIGN_NUMBERS.md` §8 準拠）
1. 新しい数値は既存の枠（ゴールド/チケット/みがき/衣装＝モール専用通貨）に収まっているか（新通貨を作らない）。
2. レースの着順・オッズ・配当（`race_engine.js`/`odds_engine.js`/`betting_engine.js`）に一切触れていないか。
3. CSS/JSを変更したら `index.html` の `?v=` を全箇所前方更新したか。
4. `node -c <変更ファイル>` で構文確認したか。
5. 既存の他画面・他機能の挙動を変えていないか（特に `ui_mall_rpg.js` はハブ画面専用——探索/戦闘/ショップの本体ロジックには触れない）。
