# 画面の撮影スクリプト（音を消して撮る）

予想画面・レース画面・答え合わせの見た目を、裏のブラウザ（Playwright・`--mute-audio`）で撮る。
2026-11-26 の v2 作り直しで実際に使ったもの。引き継ぎは `docs/CODEX_ORDER_RACE_SCREENS_V2.md`。

## 準備
```
PORT=8767 node .claude/static_server.js        # 別の端末で動かしたままにする
```
Playwright はこのリポジトリに入れていない（依存ゼロの方針）。どこかに入っているものを使う：
```
PLAYWRIGHT_PATH=C:/path/to/node_modules/playwright node tools/visual/shot_predict.cjs
```
`BASE_URL` でサーバーの場所を変えられる（既定 `http://localhost:8767`）。

## スクリプト
| ファイル | 撮るもの | 出力（`%TEMP%/modern/` か `%TEMP%/frames/`） |
|---|---|---|
| `shot_predict.cjs` | 予想画面：選ぶ前／単勝で1頭選んだ（賭け札は畳んだまま）／賭け札を広げた／ワイド2頭＋「見る」を開いた。390×844・360×640・470×836 | `p2_{a,b,c,d}_{m,s,p}.png`。はみ出した要素と賭け札の高さを表示 |
| `shot_race.cjs` | レース画面：走っている途中と、ゴール直後（「結果を見る」の前）。390×844・360×640 | `v2_mid_*.png`・`v2_end_*.png`。絵の高さ、スクロールの有無、「結果を見る」が画面内か |
| `shot_result.cjs` | 答え合わせ：当たりと外れ。理由の箱（順位の移り変わり）まで送って撮る | `res_{a,b}.png` |
| `shot_race_banners.cjs` | レース中、絵の上の帯の高さだけを細かく連続で撮る（山場の帯の確認用） | `%TEMP%/frames/<名前>_NNN.png` |
| `shot_advisor.cjs` | 予想画面の下の相談役と、「ドラゴン情報」を開いた中 | `adv_{a,b}.png` |

## 注意
- PC が重いと画像の読み込みが遅れて、竜の絵が無いように写ることがある（不具合ではない）。待ち時間を延ばして撮り直す。
- 新しいセーブで撮る（毎回 `localStorage` は空の状態から始まる）。第1話は既読にしてから予想画面を開いている。
