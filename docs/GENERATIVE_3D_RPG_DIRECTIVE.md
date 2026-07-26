# 生成×3D×RPG化 統括指示書（正本・2026-07-26）

> **目的**：Higgsfield MCP（クレジット1,200・Plus）を使い、①モールダンジョンの3D化＋キャラ配置（必須）
> ②島めぐりを「歩いて探索するスーファミRPG品質」へ ③ミニアニメ・3D生成物で全体の説得力を上げる。
> **実装担当**：Opus 5（新セッション・1フェーズ1セッション目安）。**このファイルだけで作業完結すること。**
> 親＝docs/MINIGAME_LEVELUP_DIRECTIVE.md（M0〜T3・K1は実装済み）・GAME_EXPERIENCE_DESIGN.md（傘）。
>
> **絶対規律は MINIGAME_LEVELUP_DIRECTIVE §0 の8条をそのまま適用**（レース数値不可侵／通貨不増／門番／
> spec#30／文章規律／perl+両ブランチデプロイ／検証してから完了と言う／スコープ規律）。
> ★特に第7条：**本書の前身セッションで「実装した」と偽る幻覚事故が実際に起きた**。編集のたびに
> grep でファイル実体を確認し、コミット後に git log を確認してから完了と言うこと。

---

## 0. 検証済みの土台（2026-07-26 実測・このまま信じてよい）

### Higgsfield MCP の実測
- `balance` → **credits: 1200**（月次回復済み）。
- **アップロード経路は実証済み**：`media_upload`（presigned URL発行）→ curl PUT（HTTP 200）→
  `media_confirm` → media_id 取得。ミミ立ち絵 `images/cast/mimi/mimi_buniqro_default.png` を
  media_id `befe7523-eccd-44aa-a721-4ab0694bc0c4` としてアップロード済み（再利用可）。
- **モデルカタログ（models_explore で確認済み）**：
  - `nano_banana_pro`（画像・最高品質・1k/2k/4k・image-to-image可）／`seedream_v4_5`（4K精密編集）
  - `image_to_3d`（Meshy）：**単画像→GLB。texture/PBR/rig/animation（clip 0-696）**。
    ※過去の試合3D化で実績あり（[[match-3d-players-pivot]]・baseball_pitching=393・品質良好）
  - `multi_image_to_3d`（2-4視点で精度向上）／`3d_rigging`（既存GLBのリグ）／`sam_3_3d`／`tripo_h3_1`
  - `animation_actions` ツールで678種のアニメクリップ検索
  - `autosprite`（等角5方向 idle/walk/run スプライトシート）：**カタログには在るが
    `generate_image` は「Job set type not supported」を返した（実測）**。使うなら
    `apps_search`/`apps_invoke` 経由を試す→駄目なら §4 の代替案で進める（ここで止まらない）。
  - `seedance_2_0`/`veo3_1_lite`（動画）／`upscale_image`（2k/4k）／`remove_background`
- コスト目安：nano_banana_pro 1k×4枚=2cr（実測）。**生成前に必ず `get_cost:true` でプリフライト**。
  3D系は高コスト想定＝1体ずつ検収してから量産。

### コード側の土台（実装済み・壊さない）
- `js/mall_view_3d.js`：一人称3Dレンダラの**実証実装が既にある**（既定OFF・`?mall3d`で切替）。
- `js/mall_rpg.js`：探索/戦闘/ワゴン/エレベーター（M0〜M3改修済み）。敵画像台帳=`RPG_ENEMY_IMG`。
- `js/photo_game.js`＋`js/ui_konron_map.js`：撮影/シャッターチャンス/旅ノート/隠しスポット（T0〜T3済み）。
- `docs/scene_engine_and_mall_redesign.md`：**canvasシーン基盤の設計書が既にある**（2026-06合意・未実装）。
  「歩けるマップ」はこの設計を土台にする（ゼロから設計しない）。
- Live2Dリグ（L2_RIG）と race_canvas のトレース描画＝キャラ表現の既存資産。

---

## 1. 全体像（3フェーズ群・優先順）

| 群 | 内容 | 成果物 |
|---|---|---|
| **G1 モール3D化＋キャラ配置**（必須） | mall_view_3d を既定ONに引き上げ、生成テクスチャ＋敵3D/ビルボードを配置 | 3D迷宮で敵が「そこに居る」 |
| **G2 島めぐりRPG化**（スーファミ品質） | scene_engine 実装＋歩ける崑崙の街＋NPC/スポット интеракション | 十字キーで歩く島・話す・入る |
| **G3 生成アセット横断** | 島地図刷新（§7.1発注済み）・rg_2枚再生成・ミニアニメ・BGM | 画の穴が全部埋まる |

**順序**：G1a（3D土台）→ G1b（キャラ配置）→ G2a（scene_engine＋1エリア縦切り）→ G2b（拡張）→ G3は並走可。
**トークン/クレジット規律**：各生成は 1)get_costプリフライト 2)1点検収 3)量産、の3段階。クレジット残を
フェーズ開始時に `balance` で確認し、200を切ったら生成を止めてユーザーに報告。

---

## 2. G1：モールダンジョンの3D化＋キャラ配置（必須）

### G1a. 3Dビューを主役に引き上げる
1. **現状監査から**（コードだけで判断しない）：`?mall3d` で mall_view_3d を実プレイし、
   「何が足りなくて既定OFFなのか」を箇条書きにしてから設計する（MALL_ADVENTURE_BRIEF の教訓）。
2. 期待される不足＝壁/床が手続き単色で質感がない・敵/宝箱/階段の表現が薄い・性能未検証。
3. **生成テクスチャで質感を入れる**：フロアごとに壁/床/天井のタイルテクスチャ（512×512・シームレス）を
   nano_banana_pro で生成。プロンプト核：
   `seamless tileable texture, {1F tropical beach resort mall / 3F food court lanterns / 5F luxury brass and marble...}, game wall texture, soft painterly, no text`
   フロア雛形は RPG_FLOORS の accent 色に合わせる。webp化して `images/rpg/tex/<floor>_<wall|floor>.webp`。
4. mall_view_3d のレイキャスト描画に**テクスチャサンプリング**を足す（canvas ImageData 縦ストライプ方式・
   race_canvas のトレース描画と同系の手法）。`prefers-reduced-motion`/低速端末は現行の単色にフォールバック。
5. 既定ONへの切替は**性能ゲート**（初回に1秒計測→30fps未満は2Dへ自動フォールバック）付きで。

### G1b. キャラクター配置（敵・店主・ミミ）
1. **敵の3D化**：既存納品画 `images/rpg/en_*.webp`（8枚・意匠確定）を `image_to_3d`
   （should_texture:true・target_polycount:8000〜15000＝スマホ向け低ポリ）でGLB化。
   まず **boss_donryu 1体だけ**生成→検収（形が画と一致するか）→合格したら残りを量産。
2. **表示は2段構え**：
   - 軽量path＝GLBを**8方向プリレンダしたビルボードスプライト**にベイク（オフラインで
     スクショ→透過→`images/rpg/bill/<id>_<dir>.webp`）。3Dビュー内で距離スケール描画。実装が単純で確実。
   - リッチpath（余力があれば）＝three.js等は**入れない**方針を維持（classic script構成）。
     自前レイキャスタにGLBは載らないため、**ビルボードが本線**。GLBは図鑑ビューア（回転閲覧）で活用。
3. **店主スミカの配置**：店の前に店主ビルボード（既存立ち絵を remove_background →縮小）＋
   吹き出し。門番=rpgKeeperMet() 経由（実装済みの敬称ロジックを流用）。
4. **ミミの手**：一人称の画面下にミミの手/耳の前景パーツ（立ち絵から切り出し生成）＝「自分がいる」感。
5. 検収基準：3Dビューで 敵接近→戦闘遷移が違和感なく繋がる・375px実機30fps・絵文字フォールバック健在。

### G1c. 戦闘の3D舞台（任意・G1a/bの後）
- 戦闘背景をフロアテクスチャと同系の生成一枚絵に（`images/rpg/btl/<floor>.webp`）。
  敵はビルボード大写し＝rpgDrawBattle の絵文字/画像描画を差し替え。数値・挙動は一切不変。

---

## 3. G2：島めぐりのスーファミRPG化（歩ける崑崙島）

### 設計原則（リサーチ済みの要点）
- **スーファミRPGの探索の正体**＝タイル移動＋「調べる/話す/入る」の3動詞＋見えない壁のない小さな箱庭。
  A Short Hike（発見が次の発見を開く・失敗なし）とポケモンスナップ（再訪で変化）は撮影ミニゲームで
  実装済み。G2はそれを「歩く」で包む＝**既存の観光/撮影/食事/スカウトが“町の中の建物”になる**。
- **新しい駅は作らない**（GAME_EXPERIENCE_DESIGN §4）：歩けるマップは「島時間」駅の新しい入り方であって、
  既存機能の置き換えではない。従来のピン式マップも残す（設定でどちらでも）。

### G2a. 縦切り（港町・市街エリア1枚を歩ける化）
1. `js/scene_engine.js` を docs/scene_engine_and_mall_redesign.md §1 のAPIスケッチ通りに実装
   （canvas1枚・固定タイムステップ・レイヤ・Actor・オンスクリーン十字キー・遅延ロード）。
2. **背景**：見下ろし俯瞰の町マップ1枚を nano_banana_pro で生成（2k・気持ちは「聖剣伝説の町」）：
   `top-down 3/4 view JRPG town map, tropical volcanic harbor town, stone paths, market stalls,
   lanterns, palm trees, warm colors, SNES RPG style painted look, game map, no text, no UI`
   → 検収（道が繋がっている/建物の入口が読める）→ `images/scene/konron/city.webp`。
   歩行可否は**コリジョンマスク**（同じ構図で `walkable areas as white, buildings and water as black`
   を image-to-image で生成 or 手動で塗る）＝ `city_mask.png` を getImageData 判定。
3. **ミミのスプライト**：4方向×歩行2-3コマ。入手優先順：
   a) `apps_search`/`apps_invoke` で autosprite 相当を探す（§0の実測エラーの回避路）
   b) nano_banana_pro の image-to-image でミミ立ち絵（media_id 再利用可）から
      `chibi pixel sprite sheet, 4 directions walk cycle, 3 frames each, transparent background`
   c) 最終手段＝Live2Dリグ（L2_RIG）を正面のみ流用＋左右反転
   どれでも**必ず1枚検収してから**先へ。`images/scene/konron/mimi_walk.webp`。
4. **インタラクション**：建物入口に到達→既存画面へ（市場→renderMeals・モール→renderMall・
   写真スポット→_kmStartShoot・NPC→到着VNの一言）。**中身は全部既存機能**＝箱庭が導線になる。
5. 入口：観光ハブに「🚶 歩いてまわる（β）」カード。従来のピン式は不変。
6. 検収：375px実機で歩ける・入口が機能する・30fps・リロード後も壊れない・err0。

### G2b. 拡張（G2a合格後）
- エリア追加（レース場→温泉郷→浜）・時間帯パレット（_kmIslandNowと連動）・
  すれちがいNPC（汎用亜人ビルボード数種を生成）・ポロが後ろをついてくる（poroFound後）。
- 隠しスポット（T3実装済み）の実地発見＝マップ上で「？」の煙が立つ、等の演出はここで。

---

## 4. G3：生成アセット横断（並走可）

| # | 対象 | 手順 | 状態 |
|---|---|---|---|
| G3-1 | **島地図刷新** | MINIGAME_LEVELUP_DIRECTIVE **§7.1 に完全ブリーフ済み**（発注済・最優先） | 未着手 |
| G3-2 | rg_lumina/rg_caldera 写真 | 同 §7.1 のC系プロンプト規範・アートバイブル§0.4厳守（山頂湖NG） | 未着手 |
| G3-3 | モール敵スプライト増補 | 同 §7 の表（en_*.webp 画風アンカー・512透過） | 未着手 |
| G3-4 | ミニアニメ | 傑作☆3の瞬間/モール制覇/開花カットインに2-3秒ループ（seedance_2_0 fast 480p→webm）。※音は generate_audio:false | 未着手 |
| G3-5 | BGM3曲(mall-day/boss/fever) | 同 §7。`generate_audio` 系ツールで90秒ループ | 未着手 |
| G3-6 | GLB図鑑ビューア | G1bのGLBを竜/敵図鑑で回転閲覧（`<model-viewer>`は外部CDN不可＝自前の簡易回転ビルボードで代替） | 未着手 |

---

## 5. フェーズ表と完了条件

| # | 内容 | 完了条件（検収） |
|---|---|---|
| **G0** | Higgsfield疎通＋G3-1島地図（§7.1） | balance確認・地図4候補→QA→wire→ピン再調整→実機スクショ→両ブランチ |
| **G1a** | 3Dビュー質感＋既定ON | テクスチャ8種検収・30fpsゲート・2Dフォールバック・実機スクショ |
| **G1b** | キャラ配置 | boss_donryu GLB検収→敵8方向ビルボード→店主/ミミ前景・実機スクショ |
| **G2a** | 歩ける港町（縦切り） | scene_engine＋city1枚＋ミミ4方向＋入口5つ機能・実機動画/スクショ |
| **G2b** | エリア拡張 | +2エリア・時間帯・ポロ随行 |
| **G3-x** | 横断アセット | 各行の検収列 |

**毎フェーズ共通**：編集→grep実体確認→構文→実機→ ?v バンプ（perl）→ 両ブランチ → **git log で実在確認**
→ メモリ更新。「たぶん動く」禁止。ツール出力が読めなくなったら**即座に作業を止めてユーザーに報告**
（幻覚事故の再発防止）。

---

## 5.5 ミミの衣装指定（ユーザー決裁済み 2026-07-26・スプライト/前景生成の前提）

**ミニゲーム中のミミは固定衣装**（プレイヤーの着用衣装に追従させない＝全衣装差分は作らない）：
- **モールで大冒険** → `leonmall`「モールでお買い物」（`images/cast/mimi/mimi_leonmall_default.png` 実在）
- **ドラゴンスカウト** → `tarzan`「野生児ターザン」（`images/cast/mimi/mimi_tarzan_default.png` 実在）
- G1bのミミ前景・G2aの歩行スプライト・スカウト画面のミミ表現は、この2枚を生成の source にする
  （media_upload→スプライト化。buniqroのアップロード済みmedia_idは island 汎用に流用可）。
- 島めぐり（G2）の歩行ミミは既定衣装系でよい（指定なし＝buniqro基準）。

## 5.6 レースビジュアルの刷新（ユーザー発注 2026-07-26・刷新できるところから）

レース数値・タイムライン・FinalPowerは**完全不変**のまま、見た目レイヤーだけを順に格上げする：
1. **コース背景**：rg_* 6枚（T0結線済み）と同じ実写級規範で、レース画面の背景帯
   （race_canvas の下30%走路ルール＝[[match-field-stadium-blend]]の中央空け規範）を張り替え候補に。
   既存 images/racebg/ を監査→見劣りする面から §7.1 と同じ QA 手順で再生成。
2. **観客・旗・紙吹雪のミニアニメ**：seedance 2-3秒ループ→webm→発走/ゴールの演出層に合成（表示専用）。
3. **竜の表現**：HD-2Dドット竜52頭は確定画風（[[dragon-visual-overhaul-hd2d]]・別生成禁止）＝**触らない**。
   刷新対象は背景・演出・UIフレームのみ。
4. 検収は毎回「1枚生成→実機で走らせて中央の可読性確認→採用」。一括張り替え禁止。

## 6. ユーザー決裁が必要な点（着手前に確認）

1. **3Dビュー既定ON**の判断基準（30fpsゲートで自動フォールバックがあれば既定ONでよいか）
2. **G2の画風**：SNES風ペイント調（推奨・軽い）vs 実写級ミニチュア調（アートバイブル寄り・重い）
3. クレジット配分の優先順（残1,200。目安：G0=10・G1=150〜300・G2=100〜200・G3=100〜300）
※衣装指定（§5.5）とレースビジュアル刷新（§5.6）は決裁済み。
