# アセット構成 — フォルダ & 登録

## 推奨フォルダ構成
```
images/
  _ANALYSIS.md / _RENAME_PLAN.md / _INTEGRATION_PLAN.md /
  _ASSET_STRUCTURE.md / _ASSET_GENERATION_PROMPTS.md     ← ドキュメント
  README.md
  01_..39_*.png                                          ← ライブラリ（資料・全保持）
  .gitignore                                             ← 資料はコミット除外
  cast/    sake.png mizu.png sumika.png makura.png celestia.png mimi.png
  story/   1.png 2.png 3.png 4.png 5.png ED.png
  home_vista_day.png  home_ambient.png  title_bg.png
```
- `cast/` `story/` `home_*` `title_bg` = **本番採用のみ／最適化済をコミット**。
- ルートの `NN_*.png` = 資料（設定シート・旧案・別ポーズ）。`.gitignore` で除外、ローカル保持。

### 提案 `images/.gitignore`
```
# 画像ボードの資料（設定シート/旧案/別ポーズ）はコミットしない
/[0-9][0-9]_*.png
!cast/  !story/
# ただし採用finalsは各サブフォルダ＆ルート個別許可で運用
```
（運用が複雑なら「資料は別リポ/ローカルのみ、採用finalsだけ images/ 直下に最適化コピー」が単純）

## 登録（=画像が用意できたら貼るだけ）
既存枠は **コード変更不要**。下表の名前で置けば photoOr が拾う。
| 枠 | パス | 採用元 | 最適化目安 |
|---|---|---|---|
| 顧問 サケ | `images/cast/sake.png` | 34 顔クロップ | 512² PNG |
| 顧問 ミズ | `images/cast/mizu.png` | 28 顔クロップ | 512² |
| 顧問 スミカ | `images/cast/sumika.png` | 21 顔クロップ | 512² |
| 顧問 マクラ | `images/cast/makura.png` | 01 顔クロップ | 512² |
| 顧問 セレスティア | `images/cast/celestia.png` | 19 顔クロップ | 512² |
| ストーリー4 | `images/story/4.png` | 03（ADV UIなし版が理想）| 1280×720 |
| ホーム全画面 | `images/home_ambient.png` | 10 or 13（暗め）| 1080×1920 |
| ホームビスタ | `images/home_vista_day.png` | 14 を横長クロップ | 1200×420 |

新規枠（コード少追加：_INTEGRATION_PLAN §3）：
| 枠 | パス | 採用元 |
|---|---|---|
| タイトル背景 | `images/title_bg.png` | 39（ミミ）or 10/11 |
| ミミ・アバター | `images/cast/mimi.png` | 39 顔クロップ |

## 最適化コマンド例（ImageMagick 等が無い環境向けの方針）
- 本PCには ImageMagick/Node/実Python が無いため、縮小は (a) 既存の画像編集アプリ、(b) ブラウザcanvasでの drawImage→toBlob、(c) オンライン圧縮 のいずれかで。
- 目安：cast=長辺512、背景=長辺1280–1920、JPEG/WebP 75–85% か PNG 圧縮。合計を数MB以内に。
