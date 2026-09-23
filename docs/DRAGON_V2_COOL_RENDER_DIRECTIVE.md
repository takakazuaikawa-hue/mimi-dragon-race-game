# 指示書：レース竜52頭「かっこよさ最優先」刷新（V2）——計画・工程・委任仕様

目的＝**レースの竜52頭を「もっとかっこよく・最高の出来」に作り直す**。
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

**判定してほしいこと**：①どのモデルが「かっこいい」か ②大きな丸い眼を残したままで良いか（もっと鋭くするか）
③翼膜の透け・リム光の強さ ④ドットのシルエットをどこまで忠実に保つか（忠実＝安全、崩す＝より格好良いが再審査が増える）。

> ⚠ クラウド環境の制約：生成結果のCDN `d8j0ntlcm91z4.cloudfront.net`（結果）と `d2ol7oe51mr4n9.cloudfront.net`（入力）が
> ネットワークポリシーで遮断されているため、**この環境では画像をリポジトリへ取り込めない**。量産セッションは
> 「環境設定→ネットワークで上記2ホストを許可」した環境か、PC側（衣装CGを作った経路）で実行すること。
> Higgsfield の `sandbox_exec` はDLと加工（背景除去・WebP化・コンタクトシート）ができるが、リポジトリへは書けない。

---

## 3. 工程（ゲート付き・ユーザー承認は G1〜G4 の4回だけ）

### Phase 1：画風ロック（Opus 5.5 担当・判断が要る）
1. パイロットの勝者モデルで **kogane（allrounder＝全頭の基準形）** をプロンプト微調整しながら 3〜4案。
2. ユーザーが1枚選ぶ → **`images/dragons_v2_staging/_STYLE_BASE_kogane.png`** として保存（**G1**）。
3. 以降の全生成は **画像参照を2枚**渡す：`[その竜のHD-2D（意匠）, STYLE_BASE（画風）]`。プロンプトで「1枚目の竜を、2枚目の画風で」と明示。
4. 眼の大きさ／リムの強さ／忠実度の3つを G1 で数値的に固定し、雛形（§4）の該当語を確定。

### Phase 2：固有12頭（Opus 5.5・各2案→ユーザー選択＝**G2**）
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
（kogane は Phase 1 で完成済み）。**バッチ＝ generate_image_batch 12件まで → jobs_wait → show_generation_by_ids 1回**。
各アーキタイプ完了ごとにコンタクトシート（原寸／96px／46px の3段）を出してユーザー確認（**G3**・7回だがまとめて可）。

### Phase 4：後処理（機械的・下位モデル）
1. `remove_background`（Higgsfield）→ 透過PNG。※既存のflood-fillキー抜きは「四隅が不透明な時だけ」動くので、透過納品ならそのまま素通りする（コード変更不要）。
2. `tools/dragon_v2_sheet.py`（本書と同時に追加）で **bbox・翼根ギャップ・46px縮小の可読性**を機械チェック＋シートを出力。
3. WebP化（lossy q85・幅1200px程度・**1頭 ≤100KB 目標**、52頭で ≤5MB）。ファイル名は現行どおり `<id>.png`（中身WebPで動く実績あり・コード無変更）。
4. `images/dragons_v2_staging/` に全52頭を揃える（旧 `images/dragons/` はこの時点では触らない）。

### Phase 5：結線＋デプロイ（Opus 5.5・**G4**＝52頭シートで最終承認後）
1. `images/dragons/` を一括置換（旧版は `images/dragons_hd2d_work/archive_v1/` へ退避）。
2. `js/race_canvas.js` の `'images/dragons/' + id + '.png?v=1'` を `?v=2` へ（スプライトのキャッシュ破り）。
3. 羽ばたき：翼と背に隙間が無い竜は自動で振幅30%に落ちる。目視で不自然なら `RC_FLAP_CUT[id]`（翼根ライン比率）を個別指定。
4. `RC_SIZE_MUL` は据え置き（poro小さく／tier7大きく）。
5. `node tools/check.mjs` → `index.html` の `?v=` を「今ライブの次」へ → 1コミット → main。

---

## 4. プロンプト雛形（英語・全頭共通＋差分スロット）

```
[IMAGE 1 = this dragon's locked design]  [IMAGE 2 = STYLE_BASE, the rendering style to match exactly]
Re-render the dragon from image 1 in exactly the rendering style of image 2: a premium, cool, high-end
stylized 3D game creature render (AAA monster-collecting RPG quality). NOT chibi, NOT plush toy, NOT pixel art.
KEEP from image 1: species design, scale color {HEX}, {HORN}, {WING_TYPE} wings mounted on top of the back
sweeping backward, {TAIL}, {ACCENT}, the large round eye, right-facing {POSTURE}.
Forelegs tucked to the chest, hind legs trailing back, wings never below the body, full body with margin, pure side view.
RENDERING: smooth sculpted forms, crisp individual scales, glossy horn and claw material, translucent backlit wing
membrane with visible veins, cinematic three-point lighting (cool teal key, warm ember rim from lower right), sharp focus.
Powerful, sleek, athletic: tighter muscle definition, sharper silhouette, determined expression (keep the big eye).
{SPECIAL}
Plain flat neutral gray background, no ground shadow, no text, no visual effects, no speed lines, no particles, no extra creatures.
```
スロットは JSON から機械的に埋める：
- `{POSTURE}`：escape/front → `forward-leaning flying pose, head lower than the tail`／late/chase → `horizontal gliding pose, head level or slightly above the tail`
- `{HORN}` `{TAIL}` `{WING_TYPE}` `{ACCENT}`：JSON の horn/tail/wing/accent（membrane／feather／cloud／ice など）
- `{SPECIAL}`：§3 Phase 2 の特殊条件、tier7 は `a subtle rainbow shimmer confined to the {part}`、雲系は `large sleepy half-closed eye`
- **見本竜クローン化の禁止**（過去の却下事例）：同アーキタイプの先行完成竜を参照に足さない。参照は常に「本人HD-2D＋STYLE_BASE」の2枚だけ。

---

## 5. 1枚ごとの合格チェック（全項目・落としやすい順）

□ 右向き・水平スプライト・脚質どおりの前傾/水平 □ 前脚は胸元・後脚は後方 □ 翼は背の上・後方スイープ・体より下に垂れない
□ **大きな丸い眼**（雲系のみ大きめ半目） □ hex色どおり（パステル化なし） □ 角/尾/翼の種類がHD-2D版と一致（別竜になっていない）
□ 画風がSTYLE_BASEと同一（ドット/ベクター/ぬいぐるみに流れていない） □ FXなし・背景無地・文字なし
□ **46pxに縮めてもシルエットと顔が読める**（`tools/dragon_v2_sheet.py` の46px段で確認） □ 翼根に透過ギャップがある（羽ばたきが割れない）
再生成は**1頭3回まで**。3回落ちたら「自信なしリスト」に載せてユーザーへ。

---

## 6. Higgsfield と ChatGPT の使い分け

| 役割 | ツール | 理由 |
|---|---|---|
| 量産（本線） | Higgsfield `seedream_v5_pro`（2.5cr/枚・2k・image_references 複数可） | 立ち絵・衣装CGで実績。i2i の忠実度が高い |
| 安価な代替 | `nano_banana_pro`（2cr）※実行モデルが `nano_banana_2` に落ちる事象あり。品質同等なら③以降に使う | 費用 |
| 画風探索・難物 | `gpt_image_2`（6.5cr/枚・high）＝ChatGPT系 | 指示追従が強い。STYLE_BASE 候補出し／momu・stella・phenix・poro の特殊形に |
| 第三者QA | ChatGPT アプリに4-upシートを貼り §5 で採点させる | 生成者と別の目 |
| 背景除去 | Higgsfield `remove_background` | 透過納品 |
| 加工・シート | `sandbox_exec`（ffmpeg/Pillow）または本リポジトリ `tools/dragon_v2_sheet.py` | 契約外のDLはここで |

## 7. 費用見積（残高 606cr・パイロットで 13.5cr 消費済み）
| 工程 | 枚数 | cr |
|---|---|---|
| Phase 1 画風ロック | 8〜10 | 25〜40 |
| Phase 2 固有12×2案 | 24 | 60 |
| Phase 3 図鑑40＋再生成30% | 52 | 130 |
| 背景除去 52＋予備 | 60 | 〜60 |
| gpt_image_2 難物 | 6 | 40 |
| **合計** | | **約 320〜350cr**（残高内） |

## 8. 委任の分担
- **Opus 5.5**：Phase 1（画風ロック）・Phase 2（固有12）・特殊4頭・Phase 5（結線・羽ばたき調整・デプロイ）。
- **下位モデル**：Phase 3 のアーキタイプ別バッチ（雛形どおり生成→DL→背景除去→WebP→シート→ステージング commit）・Phase 4。
- ゲート G1〜G4 は必ずユーザー判定。**G4 前に `images/dragons/` を触らない**。

## 9. やらないこと
- race_engine / odds_engine / betting_engine の変更。`RC_DSP_H`・`RC_SIZE_MUL` の変更（サイズ感は現行踏襲）。
- 全頭が揃う前の部分差し替え。旧3Dぬいぐるみ調への回帰。スプライトの回転（姿勢は頭と尾の高さで表現）。
