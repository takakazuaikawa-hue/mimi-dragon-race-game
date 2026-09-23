# ChatGPT でお願いする「翼なし版」8頭（Phase 2 の残り）

Higgsfield は Phase 2 の上限 110cr に達したため（§13）、残り8頭の**翼なし版**だけ ChatGPT で作ります（ユーザー指示 2026-09-23「上限超えたらChatGPTで補え」）。
本体（翼あり）は8頭とも完成済み＝ `images/dragons_v2_staging/<id>.png`（透過）。

対象：**miruka・baran・rosso・momu・phenix・raika・stella・glaze**

## 手順（1頭ずつ・新しいチャットで）
1. ChatGPT の画像生成に **本体の透過PNG** を1枚添付（Claude がチャットで渡した `<id>.png`。無ければ `images/dragons_v2_staging/<id>.png` を拡張子 `.webp` にして添付）。
2. 下のプロンプトをそのまま貼る。
3. 出てきた画像を **`<id>_nowing.png`** という名前で保存。
4. 届け方はどちらか：
   - このセッションのチャットに画像を貼って「<id> 届いた」と送る
   - GitHub で `claude/busy-mayer-pm8ld7` ブランチの `images/dragons_v2_staging/` にアップロード
5. 以降（検収・WebP化・リグ生成・validate）は Claude が行う。

## プロンプト（8頭共通）

```
Edit image 1 with minimal changes: remove BOTH wings completely and fill the exposed back and flank with the dragon's own scales, matching the existing lighting; keep everything else pixel-identical (pose, head, legs, tail, colors, framing). Output exactly one dragon, no wings, same framing. Output a PNG with a fully transparent background.
```

## 合格の目安（Claude が機械で検収）
- 翼だけが消え、頭・脚・尾・色・位置は元のまま（`tools/dragon_v2_rig.py` が「翼の外側のズレ」を測る。3% を超えたら作り直し）
- 背中の塗り足しが鱗としてなじんでいる／竜が1頭だけ
- momu の雲の翼、phenix・stella の羽毛翼は**翼だけ**を消す（momu の頭と首の雲フリル、雲の尾は残す。phenix の孔雀の冠と尾も残す）
- 透過で出なかった場合は、灰色の無地背景ならこちらで抜ける。グラデーション背景なら作り直し
