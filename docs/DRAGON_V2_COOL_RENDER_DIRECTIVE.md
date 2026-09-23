# 指示書：レース竜52頭「かっこよさ最優先」刷新（V2）——計画・工程・委任仕様

目的＝**レースの竜52頭を「もっとかっこよく・最高の出来」に作り直し、竜ごとのリグで綺麗に動かす**（ユーザー決定 2026-09-23：リグ化は必須）。
Higgsfield（MCP・自動化）と ChatGPT（gpt-image／判定役）を使い分けて量産し、
**レース数値には一切触れない**（表示素材の差し替えのみ＝CLAUDE.md 絶対ルール1）。

---

## 0. 現状と結論（先に読む）

| 項目 | 現状 |
|---|---|
| 素材 | `images/dragons/<id>.png`（実体はWebP・1200×896・約30KB・52頭）＝HD-2Dドット絵（Octopath級・可視グリッド） |
| 表示サイズ | レース中 **46px高**（`RC_DSP_H`・470px枠）／馬券カード「▾見る」**96px**／勝者ウィニングカット **150px**／エピローグ整列 |
| 描画 | `js/race_canvas.js` `_rcDragonSprite`：四隅flood-fillでグレー背景をキー抜き→bbox→**翼根ギャップ自動検出**で上下スライス羽ばたき。3D風でも同じ経路で動く |
| 背景 | `images/racebg/`＝**リアル寄りスタイライズド3Dレンダー・シネマティック夜景**（Ember Nocturne）。**ドット絵の竜と画風が噛み合っていない**のが「かっこよくない」最大の原因 |
| 意匠 | 52頭の**デザインは確定済み**（色hex・角・尾・翼・脚質姿勢＝`docs/codex_dragon_kit/race_dragons_52_master_list_v1_0.json`＋`confirmed_dragons.md`） |
| 旧3D | `images/plush_3d_ref/`＝ぬいぐるみ調3D（不採用済み）。**今回は「ぬいぐるみ」ではなく「かっこいい」方向**＝別物 |


**現行素材の実測で見つかった粗（V2で同時に直る）**：`tools/dragon_v2_sheet.py` を現行52頭に掛けると、
①**翼と背の間の灰色が四隅と繋がっていないため抜けずに残っている**（実機でも翼の下に灰色の窓が出ている）
②その結果 **翼根ギャップ検出が52頭すべて flapClean=false** ＝羽ばたき振幅が常に30%に落ちている。
V2 を**透過PNGで納品**すれば両方とも自動で解消する（コード変更なし）。

**結論（推奨方針）＝「意匠はそのまま、描画だけを"シネマティック・スタイライズド・レンダー"へ i2i 変換」**
- 52頭分のデザイン決めをやり直さない。既存HD-2Dスプライトを**画像参照（i2i）**に入れ、「この竜を、この画風で描き直せ」と指示する。
- 出来を決めるのは **①画風の基準1枚（STYLE_BASE）** と **②プロンプト雛形** の2つだけ。ここに全工数の3割を使い、残りは機械的量産。
- 全頭が揃うまで**本番差し替えはしない**（1レースにドット竜と3D竜が混在すると最悪）。

---

## 1. 「かっこいい」の定義（画風仕様＝STYLE_BASE の合格条件）

- **最優先＝「別の竜にならない」「全頭が同じ顔にならない」**（2026-09-23 ユーザー指示の真意＝1:1の忠実さではない）。
  **強い変更は歓迎**（画風・ライティング・筋肉・翼膜・表情）。ただし個体の識別要素＝色hex・角/尾/翼の種類・体格アーキタイプ・
  頭の大きさ・進行姿勢（前傾/水平）は必ず残す。参照画風の竜（rubel 等）に顔や骨格が寄って**全頭が同じ竜に収束する**のが最大の失敗。
  → seedream は参照竜の骨格に寄せがち（A/B は顔が rubel 化）なので本線から外し、**nano_banana_pro** を本線にする（§2c）。

- **プレミアム・スタイライズド3D／厚塗り調のクリーチャー・レンダー**（AAAモンスター育成RPGの図鑑絵の質感）。ドット・ベクター・ぬいぐるみ・チビ化は不可。
- **解剖**：筋肉の起伏・引き締まった胴・鋭いシルエット。首〜尾のS字ライン。
- **材質**：鱗は1枚1枚の面が読める／角・爪はグロッシー／翼膜は**逆光で透ける**（翼脈が見える）／火・雷・雲・霧は「体の一部」としてのみ。
- **ライティング**：シネマティック3点照明。**キー＝冷たいティール、リム＝下右から暖色の燠（ember）**＝レース背景（Ember Nocturne）と同じ光源設計。
- **顔**：**大きな丸い眼は維持**（46pxで顔が識別の核）。かっこよさは眉／瞼の角度・口元の「決意」で出す（牙むき・スリット目は不可）。
- **姿勢（不変）**：右向き・水平スプライト・**逃げ/先行＝前傾（頭＜尾）／差し/追込＝水平〜頭やや上**。前脚は胸元に畳む・後脚は後方へ流す・翼は背の上から後方スイープ（体より下へ垂らさない）。
- **背景**：無地フラット。**納品は透過PNG（remove_background 済み）**。文字・影・エフェクト・スピード線なし。
- **色**：JSONのhexを厳守（パステル化・白飛び禁止）。tier7のみ控えめな虹シマーを体の一部に。

---

## 2. パイロット（本セッションで実施済み・ユーザー判定待ち）

同一プロンプトでモデル比較。Higgsfield のギャラリー（show_generation_by_ids で表示済み）で確認できる。
i2i の元＝既存HD-2D（kogane / rubel）。job_id は次工程で **そのまま画像参照に再利用可**。

| index | 竜 | モデル | job_id | 費用 |
|---|---|---|---|---|
| 0 | kogane | seedream_v5_pro (2k) | `b63d980f-6118-41eb-a136-367200a6ae73` | 2.5cr |
| 1 | kogane | nano_banana_pro 指定→**nano_banana_2 で実行された**（要注意） | `35070989-ed76-49e4-aaf6-9ae515e150e7` | 2cr |
| 2 | kogane | gpt_image_2 (2k/high) | `910f5a8e-4d89-4f17-bc33-ebc1951b1bd7` | 6.5cr |
| 3 | rubel | seedream_v5_pro (2k) | `23997f90-3805-4c7e-b03b-b9ee8a354a3d` | 2.5cr |

元画像 media_id：kogane `3d0706b5-9803-4920-bbf0-dd5ae070070d`／rubel `c84ec158-b1d9-4860-97e9-5709549aa90c`

**ユーザー判定（2026-09-23）＝「4 → 2 の順にかっこいい」**（4＝rubel seedream、2＝kogane nano_banana）。
目視所見：4は赤×ティール・リム光×険しい表情で最も「かっこいい」。1（kogane seedream）は体周りにグローが出て指示違反。
3（gpt_image_2）は質感は最もリアルだが光が平板で魅力薄。→ **量産モデル＝ seedream_v5_pro に確定。gpt_image_2 は落選**。
⚠ nano_banana 系は指定IDが勝手に落ちる（pro→2→flash と実行モデルが変わった）ため、**本線には使わない**。

### 2b. 画風ロック（Phase 1）の結果＝G1候補（ユーザー選択待ち）
画像参照を **[kogane HD-2D（意匠）, パイロット4 rubel（画風）]** の2枚にし、「画風だけ取れ・赤や意匠は取るな」＋
「fierce, determined expression」で kogane を生成 → **2枚とも rubel と同じ"家族"に見える仕上がり**（2参照方式が機能する実証）。

| 候補 | モデル | job_id | 保存先 |
|---|---|---|---|
| A | seedream_v5_pro | `b10a2c49-72b8-44db-941a-9fc31804be96` | `docs/dragon_v2_kit/refs/STYLEBASE_A_kogane_seedream.webp` |
| B（陰影強め） | seedream_v5_pro | `83d751cb-fd1d-400b-a82b-589d28ae4ce3` | `docs/dragon_v2_kit/refs/STYLEBASE_B_kogane_seedream.webp` |
| X（不採用） | nano_banana → flash に降格・ぬいぐるみ寄り | `65ddf6ad-224b-476e-81a7-036895e671cd` | `..._REJECT.webp` |

パイロット4枚も `docs/dragon_v2_kit/refs/PILOT{1..4}_*.webp` に保存済み（**PILOT4_rubel_seedream_STYLE.webp が画風の正**）。

~~G1 確定＝A~~ → **撤回（同日）**。ユーザー所見「nano_banana 版の方が元の絵（姿勢など）を尊重している」。A/B は姿勢・体型を再解釈しており、
忠実さの点で不採用。seedream A は `docs/dragon_v2_kit/refs/STYLEBASE_A_*` に「ドラマ性の参考」として残すのみ。

### 2c. 画風ロック やり直し＝ nano_banana_pro 忠実版（G1 候補・ユーザー選択待ち）
プロンプトに「image 1 を**ほぼ1:1で重なるほど忠実に**（姿勢・体型・頭の大きさ・翼・尾・脚・シルエット）」を先頭で明示し、
画風参照（rubel パイロット4）は「ライティングと質感だけ」と限定。結果＝**元絵に忠実なまま、険しい眉・鱗の面・翼膜の透けが入った**。

| 候補 | 要求モデル→実行表示 | job_id | 保存先 | 所見 |
|---|---|---|---|---|
| N1 | nano_banana_pro → 表示 nano_banana_2 | `cfef9354-670c-43f7-ae9b-963a73edef98` | `refs/STYLEBASE_N1_kogane_nanobanana_pro_faithful.webp` | 姿勢1:1・無地グレー背景・光はやや平板 |
| N2 | nano_banana_2 → 表示 nano_banana_flash | `e9030828-3688-444e-be4e-dc47ba0f87eb` | `refs/STYLEBASE_N2_kogane_nanobanana_flash_faithful.webp` | 姿勢1:1・リム光は少し強い・下位モデル |
| N3 | nano_banana_pro（ライティング強調版） | `ccbea301-ab0c-4b23-8054-f2dfa82a5e3c` | `refs/STYLEBASE_N3_kogane_nanobanana_pro_lit.webp` | 光は良いが**画面右下に参照竜（rubel）の赤い頭が混入＝不合格**。参照竜の混入は起きうる→§5に検査項目追加 |

### 2d. 「別の竜にならない」検証（rubel × STYLE_BASE=N1 kogane・同一性ロック雛形・nano_banana_pro・2案）
| 案 | job_id | 保存先 | 結果 |
|---|---|---|---|
| a | `420d9070-882f-48cc-9b16-f7493040c12a` | `refs/TEST_rubel_nanopro_identity_a.webp` | **合格**：赤・クリーム腹・燠の尾・前傾・体格が rubel のまま、鱗/翼膜/光だけ強く格上げ |
| b | `84207703-1444-49d5-af22-5327902ee3ce` | `refs/TEST_rubel_nanopro_identity_b.webp` | **不合格**：角が kogane の長角に、姿勢が水平に、色が橙寄りに＝参照竜（kogane）に引かれて別の竜化 |

**含意（計画への反映）**：画風参照に「竜の絵」を使う限り、**2回に1回程度は参照竜へ引かれる**。対策は雛形の文言ではなく運用で取る：
- 全頭 **2案生成**し、§5 の「別の竜になっていない／参照竜が混入していない」で選ぶ（不合格なら再生成・1頭3回まで）＝Phase 2/3 の前提（費用は §7 に織り込み済み）。
- 引かれ方が強い竜（体格が kogane と遠い岩系・雲系・ポロ）は、画風参照を外して **本人HD-2D 1枚＋テキストの画風指定だけ**で生成する選択肢を先に試す（パイロット2＝1枚参照でも画風は出ていた）。

**モデルIDの挙動（実測）**：`nano_banana_pro` を要求すると実行表示は `nano_banana_2`、`nano_banana_2` を要求すると `nano_banana_flash` になる
（表示名が1段ずれるだけで、要求IDごとに品質は一定）。**量産は必ず `nano_banana_pro` を要求する**（2cr/枚・2k・image_references 複数可）。
パイロット2（ユーザー2位）も `nano_banana_pro` 要求で作ったもの＝同じ系統。

**G1 確定（ユーザー判定 2026-09-23）＝ N1**。`images/dragons_v2_staging/_STYLE_BASE_kogane.webp` を N1 に差し替え済み（N3 は混入で不可）。以降の全頭は `[本人HD-2D, STYLE_BASE(N1 kogane)]` の2参照＋§4 の同一性ロック雛形で生成。
画風参照を **rubel ではなく無彩色に近い kogane にする**のは、赤や rubel の顔が他の竜へ漏れるのを防ぐため。
（rubel 本人の生成時だけは参照2枚目が kogane になるが、それで問題ない＝画風だけ取る）

> ✅ 解決済み（2026-09-23 ユーザーが環境設定で2ホストを許可）。旧記録：生成結果のCDN `d8j0ntlcm91z4.cloudfront.net`（結果）と `d2ol7oe51mr4n9.cloudfront.net`（入力）が
> ネットワークポリシーで遮断されているため、**この環境では画像をリポジトリへ取り込めない**。量産セッションは
> 「環境設定→ネットワークで上記2ホストを許可」した環境か、PC側（衣装CGを作った経路）で実行すること。
> Higgsfield の `sandbox_exec` はDLと加工（背景除去・WebP化・コンタクトシート）ができるが、リポジトリへは書けない。

---

## 3. 工程（ゲート付き・ユーザー承認は G1〜G4 の4回だけ）

### Phase 1：画風ロック（Opus 5.5 担当・判断が要る）
1. ✅ 実施済み：seedream_v5_pro で **kogane** を `[kogane HD-2D, PILOT4 rubel]` の2参照＋fierce 文言で生成（§2b の A/B）。
2. ✅ **G1 確定＝N1**（job `cfef9354-670c-43f7-ae9b-963a73edef98`）→ `images/dragons_v2_staging/_STYLE_BASE_kogane.webp` に保存済み。
3. 以降の全生成は **画像参照を2枚**渡す：`[その竜のHD-2D（意匠）, STYLE_BASE（画風）]`。プロンプトで「1枚目の竜を、2枚目の画風で」と明示。
4. 眼の大きさ／リムの強さ／忠実度の3つを G1 で数値的に固定し、雛形（§4）の該当語を確定。

### Phase 2：固有12頭（Opus 5.5・各2案→ユーザー選択＝**G2**）＋**採用案の「翼なし版」を同時生成**（Phase 6 の素材・§11）
rubel / seram / poro / gando / miruka / baran / rosso / momu / phenix / raika / stella / glaze。
特殊条件：poro＝小さい・涙目・赤蝶ネクタイ／momu＝雲の翼と雲尾・眠たい大きめ半目／phenix＝羽毛翼・前足畳み／
stella＝金星チップの羽毛翼・彗星尾・宇宙鱗／raika＝稲妻角・電気ヴェイン／glaze＝結晶装甲・控えめ虹屈折。

### Phase 3：図鑑40頭＝アーキタイプ別バッチ（下位モデルで可・1案→不合格のみ再生成）
| 順 | archetype | 頭数 | 脚質→姿勢 | id |
|---|---|---|---|---|
| ① | fire_bruiser | 7 | 逃げ→前傾 | susu hibana benio shakunetsu guren enma goka |
| ② | speed_escape | 6 | 逃げ→前傾 | akane kazemaru hayate raijin hayao raiou |
| ③ | stamina_tank | 7 | 先行→前傾 | goro kabe taiga konron banju gozan fugaku |
| ④ | wing_closer | 6 | 差し→水平 | nagi shio arashi sora tenku souten |
| ⑤ | turn_tech | 5 | 差し→水平 | tsumuji sazare kirari senpu reppu |
| ⑥ | fog_mystic | 6 | 差し/追込→水平 | yoi murasame shirahae gekka yugiri yomi |
| ⑦ | cloud_chaser | 2 | 追込→水平・半目可 | chiri yumeji |
（kogane は Phase 1 で完成済み・翼なし版は未生成）。**バッチ＝ generate_image_batch 12件まで → jobs_wait → show_generation_by_ids 1回**。
各頭：本体2案 → 合格案を選ぶ → その案の**翼なし版1枚**（§11 の編集プロンプト）→ 両方を remove_background。
各アーキタイプ完了ごとにコンタクトシート（原寸／96px／46px の3段）を出してユーザー確認（**G3**・7回だがまとめて可）。

### Phase 4：後処理（機械的・下位モデル）
0. 翼なし版と本体版の差分から翼レイヤーを切り出し、`tools/dragon_v2_rig.py`（§11・Phase 6 で作る）で `images/dragons_v2_rigs/<id>/rig.json`＋`parts/*.webp` を生成。
1. `remove_background`（Higgsfield）→ 透過PNG。※既存のflood-fillキー抜きは「四隅が不透明な時だけ」動くので、透過納品ならそのまま素通りする（コード変更不要）。
2. `tools/dragon_v2_sheet.py`（本書と同時に追加）で **bbox・翼根ギャップ・46px縮小の可読性**を機械チェック＋シートを出力。
3. WebP化（**透過ありlossy・幅1000px・q82**＝候補Aで実測 約100KB。1200px/q85 だと134KB）。**1頭 ≤110KB 目標**、52頭で ≤6MB。ファイル名は現行どおり `<id>.png`（中身WebPで動く実績あり・コード無変更）。
4. `images/dragons_v2_staging/` に全52頭を揃える（旧 `images/dragons/` はこの時点では触らない）。

### Phase 5：結線＋デプロイ（Opus 5.5・**G4**＝52頭シートで最終承認後）
1. `images/dragons/` を一括置換（旧版は `images/dragons_hd2d_work/archive_v1/` へ退避）。
2. `js/race_canvas.js` の `'images/dragons/' + id + '.png?v=1'` を `?v=2` へ（スプライトのキャッシュ破り）。
3. 羽ばたき：**リグがある竜はリグ描画（§11）が最優先**。リグ未生成/未ロードの竜だけ従来のスライス羽ばたき（隙間が無い竜は振幅30%・不自然なら `RC_FLAP_CUT[id]` を個別指定）。
4. `RC_SIZE_MUL` は据え置き（poro小さく／tier7大きく）。
5. `node tools/check.mjs` → `index.html` の `?v=` を「今ライブの次」へ → 1コミット → main。

---

## 4. プロンプト雛形（英語・**同一性ロック版**＝§2d の rubel 検証で使った文面。スロットだけ JSON から埋める）

```
Image 1 is the locked design of this dragon ({NAME_EN}, {ONE_LINE_ROLE}). Image 2 is only a STYLE REFERENCE (a different
dragon): copy from it the rendering style, lighting and surface treatment only. Output exactly one dragon, the one from
image 1, and do not include any part, color or feature of the dragon in image 2.
IDENTITY LOCK from image 1 (must survive): {COLOR_DESC} scale color {HEX} with {BELLY}, {HORN}, the {WING_TYPE} wings mounted on
top of the back sweeping backward, {TAIL}, {BUILD}, the large round eye, and its {POSTURE}. {SPECIAL}
Within that identity you may upgrade it STRONGLY: dramatic cinematic lighting (cool teal key light from the upper left on the
wings and back, warm ember rim light from the lower right along the belly, jaw and hind legs), crisp individual scales with a
satin surface (not glossy vinyl, not plush toy), translucent backlit wing membrane with visible veins, sharper claws and horns,
tighter athletic muscle definition, deeper shadows under the wing and along the belly, a fierce determined brow over the big
round eye. It must still read instantly as the same dragon as image 1, not as a generic dragon.
Plain flat neutral mid-gray #808080 background, no vignette, no ground shadow, no glow around the body, no text, no effects,
no speed lines, no particles. Full body in frame with margin, pure side view facing right. NOT chibi, NOT plush toy, NOT pixel art.
```
- モデル：**`nano_banana_pro`**（2k・4:3・2cr）。画像参照は常に **[本人HD-2D（images/dragons/<id>.png を PNG 変換して upload）, STYLE_BASE]** の2枚・この順。
  STYLE_BASE は G1 で選んだ job_id を medias の value にそのまま渡せる（job_id 参照は実証済み）。
- `{POSTURE}`：escape/front → `forward-leaning flying direction with the head lower than the tail`／late/chase → `horizontal gliding direction with the head level or slightly above the tail`
- `{HORN}` `{TAIL}` `{WING_TYPE}` `{BUILD}` `{BELLY}` `{HEX}`：master JSON の該当値を英語で（例 swept-back horns / spade tail with an ember tip / membrane / sleek build / a cream belly）
- `{SPECIAL}`：§3 Phase 2 の特殊条件（poro/momu/phenix/stella/raika/glaze）、tier7 は `a subtle rainbow shimmer confined to the {part}`、雲系は `large sleepy half-closed eye`
- nano_banana_pro は指示どおり**無地グレー背景**を出す（四隅が均一）が、**翼と背の間の灰色ポケットは残る**（現行と同じ粗）
  → **全頭 `remove_background`（1cr）を通す**（透過納品＝ポケット解消＋羽ばたき検出の改善）。
- seedream_v5_pro は参照竜の骨格・顔に寄せる（収束リスク）ため本線外。難物で単発・ユーザー了承時のみ。
- 同アーキタイプの先行完成竜を参照に足さない。参照は本人＋STYLE_BASE(kogane) の2枚だけ。

## 5. 1枚ごとの合格チェック（全項目・落としやすい順）

□ 右向き・水平スプライト・脚質どおりの前傾/水平 □ 前脚は胸元・後脚は後方 □ 翼は背の上・後方スイープ・体より下に垂れない
□ **大きな丸い眼**（雲系のみ大きめ半目） □ hex色どおり（パステル化なし） □ 角/尾/翼の種類がHD-2D版と一致（別竜になっていない）
□ 画風がSTYLE_BASEと同一（ドット/ベクター/ぬいぐるみに流れていない） □ FXなし・背景無地・文字なし
□ **竜は1頭だけ**（参照竜の頭や体の一部が混入していない＝N3 の失敗） □ **同アーキタイプの完成竜と並べて顔・骨格が同一になっていない**（収束チェック・G3 のシートで）
□ **46pxに縮めてもシルエットと顔が読める**（`tools/dragon_v2_sheet.py` の46px段で確認） □ 翼根に透過ギャップがある（羽ばたきが割れない）
再生成は**1頭3回まで**。3回落ちたら「自信なしリスト」に載せてユーザーへ。

---

## 6. Higgsfield と ChatGPT の使い分け

| 役割 | ツール | 理由 |
|---|---|---|
| 量産（本線） | Higgsfield **`nano_banana_pro`**（2cr/枚・2k・image_references 複数可） | **元絵の姿勢・体型を1:1で保つ**（ユーザー指示の最優先事項）。無地背景も指示どおり出る |
| ドラマ性の代替 | `seedream_v5_pro`（2.5cr）※姿勢・体型を再解釈する | 難物で単発・ユーザー了承時のみ |
| 画風探索・難物 | `gpt_image_2`（6.5cr/枚・high）＝ChatGPT系 | 指示追従が強い。STYLE_BASE 候補出し／momu・stella・phenix・poro の特殊形に |
| 第三者QA | ChatGPT アプリに4-upシートを貼り §5 で採点させる | 生成者と別の目 |
| 背景除去 | Higgsfield `remove_background` | 透過納品 |
| 加工・シート | `sandbox_exec`（ffmpeg/Pillow）または本リポジトリ `tools/dragon_v2_sheet.py` | 契約外のDLはここで |

## 7. 費用見積（2026-09-23 時点の残高 約471cr。本件の消費＝パイロット13.5＋画風ロックA/B 7＋背景除去1＋nano検証 N1〜N3 6＋rubel検証 4＝**31.5cr**。※同日15:51の Kling v3.0 動画×11本≒95cr は本件外）
| 工程 | 枚数 | cr |
|---|---|---|
| Phase 1 画風ロック | 8〜10 | 25〜40 |
| Phase 2 固有12×2案（nano_banana_pro 2cr） | 24 | 48 |
| Phase 3 図鑑40×2案＋再生成 | 100 | 200 |
| 背景除去 52＋予備（実測 1cr/枚） | 60 | 60 |
| Phase 6 翼なし版 52＋背景除去 52 | 104 | 156 |
| gpt_image_2 難物（落選のため原則不使用） | 0〜6 | 0〜40 |
| **合計** | | **約 450〜490cr**（残高 約471cr に対し**ぎりぎり〜不足**。対策：Phase 3 は1案先行・不合格のみ再生成（−40cr）、Phase 2 の不採用案は背景除去しない（−12cr）。それでも足りなければ Phase 3 途中で報告してクレジット追加を判断） |

## 8. 委任の分担
- **Opus 5.5**：Phase 1（画風ロック）・Phase 2（固有12）・特殊4頭・Phase 5（結線・羽ばたき調整・デプロイ）。
- **下位モデル**：Phase 3 のアーキタイプ別バッチ（雛形どおり生成→DL→背景除去→WebP→シート→ステージング commit）・Phase 4。
- ゲート G1〜G4 は必ずユーザー判定。**G4 前に `images/dragons/` を触らない**。

## 9. やらないこと
- race_engine / odds_engine / betting_engine の変更。`RC_DSP_H`・`RC_SIZE_MUL` の変更（サイズ感は現行踏襲）。
- 全頭が揃う前の部分差し替え。旧3Dぬいぐるみ調への回帰。スプライトの回転（姿勢は頭と尾の高さで表現）。

## 10. 次セッションへの委任プロンプト（最終版・そのまま貼る・Opus 5.5 想定）

```
docs/DRAGON_V2_COOL_RENDER_DIRECTIVE.md を最初に全文読んでから着手。レース数値（race_engine/odds_engine/betting_engine）は触らない。
images/dragons/ は G4（52頭完成）まで触らない。確定事項：本線モデル nano_banana_pro／STYLE_BASE＝kogane N1（job_id cfef9354-670c-43f7-ae9b-963a73edef98、
画像参照2枚目に job_id をそのまま渡す）／原則「別の竜にならない・全頭が同じ顔に収束しない」／リグ化（Phase 6）必須。

今回やること＝Phase 2（固有12頭）：rubel seram poro gando miruka baran rosso momu phenix raika stella glaze。
1) 各頭、本人の images/dragons/<id>.png（中身WebP）を PNG 変換→media_upload→media_confirm。
2) §4 の同一性ロック雛形に master JSON（docs/codex_dragon_kit/race_dragons_52_master_list_v1_0.json）と confirmed_dragons.md の意匠を埋め、
   nano_banana_pro（2k・4:3）で各2案。generate_image_batch（12件/回）→ jobs_wait → show_generation_by_ids 1回。
3) §5 で自己審査（竜は1頭だけ／別の竜になっていない／姿勢・翼・眼）。不合格は再生成（1頭3回まで）。両案とも合格なら2案を残す。
4) 合格案を remove_background → DL → tools/dragon_v2_sheet.py で bbox/46px 可読性を確認 → 透過WebP（幅1000・q82）を
   images/dragons_v2_staging/<id>_a.png / <id>_b.png に保存（拡張子 .png・中身WebP）。
5) 12頭のコンタクトシートを tmp/dragon_v2_sheets/ に出し、ユーザーに各頭 a/b の選択を聞く（G2）。ここで一旦止めて報告。
6) G2 の回答後：採用案の翼なし版（§11.1 のプロンプト・参照は採用案の job_id 1枚）を生成→remove_background→
   images/dragons_v2_staging/<id>_nowing.png に保存。tools/dragon_v2_rig.py（§11.2 の仕様で新規作成）で
   images/dragons_v2_rigs/<id>/ を生成し node live2d/cli.js validate を通す。
費用上限：Phase 2 全体で 110cr。超えそうなら止めて報告。ブランチにコミット・push・ドラフトPR。
```
Phase 3（図鑑40頭）は同じ手順を archetype 別に（1案先行・不合格のみ再生成）。Phase 5/6 のランタイム改修は §3 Phase 5 と §11.3 のとおり（Opus 5.5）。

## 11. Phase 6：竜ごとのリグで動かす（**必須・ユーザー決定**）

**現状**：レースの竜は `rcDrawDragonSprite` の"スライス羽ばたき"（翼根ラインで上下に切り、上帯だけヒンジ回転）で動いている。
`live2d/`（自作Live2D風ツール：パーツ分解→呼吸/まばたき/翼flutter/尾bend/視線）はレースでは**未使用**で、`rcDrawDragonRig` は
基準画像1枚用の固定 rig.json（グローバル `RC_RIG`）を色相シフトして使うマスコット専用経路。→ **竜IDごとの rig を読む経路を新設する。**

### 11.1 素材（生成側・Phase 2/3 に組み込み済み）
- 本体版（合格案）＝ `<id>.png`。
- **翼なし版**＝本体版の i2i 編集（nano_banana_pro・2cr・画像参照は本体版の job_id 1枚だけ）：
  ```
  Edit image 1 with minimal changes: remove BOTH wings completely and fill the exposed back and flank with the dragon's own
  scales, matching the existing lighting; keep everything else pixel-identical (pose, head, legs, tail, colors, background).
  Output exactly one dragon, no wings, same framing, same flat gray background.
  ```
  両方を `remove_background`（1cr×2）。→ 追加 **+3cr/頭**。
- 検収：翼なし版を本体版に重ねて**翼以外がズレていない**こと（`tools/dragon_v2_rig.py` が差分率を出す。翼領域外の差分 >3% は再生成）。

### 11.2 パーツ分解（`tools/dragon_v2_rig.py`＝Phase 6 で新規・Pillow・依存はそれだけ）
1. 本体版（透過）と翼なし版（透過）を bbox 合わせで重ね、**差分マスク＝翼**（アルファ差＋色差、膨張2px・穴埋め・最大連結成分のみ）。
2. `wing` パーツ＝本体版から差分マスクで切り出し（縁は本体版の画素）。ピボット＝翼根（マスクの下端中央寄り＝背との接線の中点）。
3. `body` パーツ＝翼なし版そのもの（頭・脚・尾を含む）。ピボット＝胸の中心。
4. `tail` パーツ＝翼なし版の左側を **垂直線 x = bbox.x + 0.34·bbox.w** で切った左部分（尾）。ピボット＝切断線の中点（右端）。
   `body` からは同じ領域を抜く（切断線で1pxオーバーラップ）。`bend.rootEdge = "right"` で根元固定・先端ほど揺れる（既存 `_rcBendStrips` がそのまま効く）。
5. `eye` パーツ（任意・まばたき用）＝本体版の顔領域（bbox 右端から 0〜22%・上から 15〜55%）内で**最も暗い円形塊**（黒目）を中心に半径1.6倍の矩形を切り出し。
   見つからなければ eye なし（まばたきは既存の顔オーバーレイに任せる）。
6. 出力＝`images/dragons_v2_rigs/<id>/rig.json`（分離形式・`part.file = "parts/<part>.webp"`）＋ `parts/{wing,body,tail,eye}.webp`（透過・幅は本体版と同じ座標系）。
   `node live2d/cli.js validate images/dragons_v2_rigs/<id>/rig.json` を通す。canvas は本体版の画像サイズ。
7. モーション既定：wing `bend{amp:.18,freq:1.35,rootEdge:"right"}`＋`flutter`、tail `bend{amp:.11,rootEdge:"right"}`、body `breathing:.15`、eye `blinkable:true`。

### 11.3 ランタイム改修（`js/race_canvas.js`・**表示専用**・数値非干渉）
1. `RC_DRIG = Object.create(null)`：`_rcDragonRigV2(id)` が `images/dragons_v2_rigs/<id>/rig.json` を fetch → `L2_RIG.deserialize` → `L2_RIG.hydrate(rig, 'images/dragons_v2_rigs/<id>')`
   → `_rcPrepRig`（既存・_bbox/_eyeC を作る）。404/失敗は `bad=true` で**スプライト描画へフォールバック**（今と同じ見え方）。
2. `rcDrawDragonRigV2(ctx, o)`：変換は **`rcDrawDragonSprite` と同一**（`RC_DSP_H`×`RC_SIZE_MUL`で高さ正規化・鼻先＝右端が o.x・bob/lean/bank/squash/spin/オーラ）。
   その座標系で `rig._zsorted` を `_rcDrawRigPart` で描く。**色相シフトは使わない**（`_rcRigPartImg` を通さず `p._img` を直描き＝`rig._noTint=true` 分岐を追加）。
   wing の `o.design.wingSize` スケールも適用しない（絵に既に反映済み）。
3. `rcDrawDragon` の優先順：**V2リグ（ロード済み）→ スプライト → 旧リグ → グリッド**。`race_broadcast.js` の出走竜プリロードに rig.json も加える（初手フレームで別の竜が出ないように）。
4. 顔オーバーレイ（mood/漫符）：V2リグに eye パーツがあれば `rig._eyeC` を使い、無ければスプライト用の推定位置（現行）。
5. ウィニングカット `rcDrawWinnerCut`：V2リグがあれば同じパーツ描画で**翼を大きくゆっくり羽ばたかせる**（`gait` を遅く）。無ければ現行の縦ストリップ波。
6. `rcDragonSpriteHalfW`（ラベル/バッジ位置）は rig の `_bbox` から同式で算出。`RC_SIZE_MUL`／`RC_DSP_H` は不変。
7. index.html：`live2d/js/rig.js` が既に読み込まれていることを確認（`L2_RIG` 参照）。CSS/JS 変更なので `?v=` を「今ライブの次」へ一括更新。

### 11.4 検収（Phase 6）
□ 翼が背から離れて羽ばたく（継ぎ目なし＝翼なし版の塗り足しが背に馴染む） □ 尾の根元が静止し先端がしなる □ 体の呼吸が僅か
□ 46px で羽ばたきが読める（過剰に速くない） □ リグ未ロード時にスプライトへ落ちて別の竜が出ない □ 着順・オッズ・配当は不変（`node tools/check.mjs`＋レース1本目視）

### 11.5 費用・工数
- 生成：翼なし版 52×2cr＋背景除去 52×1cr ＝ **+156cr**。
- 工数：`tools/dragon_v2_rig.py`（新規）、`race_canvas.js` 改修（上記1〜6）、52頭のリグ目視。Opus 5.5 担当（ランタイムと目視）／下位モデル（生成・切り出し・validate）。
