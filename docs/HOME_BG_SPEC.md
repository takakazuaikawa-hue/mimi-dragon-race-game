# ホーム背景の規格 — 接地ラインと構図の数値仕様

ホーム背景は cover 表示のため端末ごとに切り抜きが変わる。**ミミが「立っている」ように見せる**には、
画像側を以下の数値で作ることが必須（コード側の接地キャリブレーションは±4%しか補正できない）。

## 必須数値（全ロケーション共通）
| 項目 | 値 | 理由 |
|---|---|---|
| アスペクト | **16:9（1792×1008 以上）** | 縦持ちでは左右が落ちる前提の構図にする |
| **床の接地ライン** | **上端から 74%（±2%）** | ミミの足元（ドック直上）と一致する高さ |
| 床面の見え | 接地ラインから下端まで**連続した床**（板/石畳/砂） | 足が乗る面。74%より下に手すり・柵・家具を置かない（置くなら左右端のみ） |
| 火山 | **右側1/3・山頂が上端から18〜28%** | どの端末でも「島のシンボル」が頭上に見える |
| 中央の抜け | **横方向の中央±22%は遠景のみ**（近景オブジェクト禁止） | 立ち絵・吹き出し・ピンが重なる |
| 上部1/4 | 空・遠景（重要モチーフを置かない） | ヘッダー/フロートが重なる |
| 人物・文字 | **無人・文字無し** | UIと立ち絵が主役 |
| 明度 | 中央上〜中段はやや暗め or 均質（白文字が読める） | スクリムは入れるが頼りすぎない |

## スタイル（ユーザー決定）
**実写に近いフォトリアル**。「ultra-realistic travel photography, shot on full-frame camera, 35mm,
natural lighting, high dynamic range」系の指定。アニメ塗り・厚塗りは使わない。

## ファイル名と登録（1ロケーション＝昼夜2枚）
```
images/homebg/<id>_day.png   （昼 6:00–17:59 に表示）
images/homebg/<id>_night.png （夜に表示）
```
→ webp最適化後、`js/ui_render.js` の `HOME_BGS` に1行追加（`floor:` は実測で記入）：
```js
{ id: "beach", day: "images/homebg/beach_day.webp", night: "images/homebg/beach_night.webp", floor: 0.74 },
```
ローテーションは**日替わり**（日数 % 登録数）。昼夜は時刻で自動。

## ロケーション案（島のいろんな楽しみ＝6種）
1. **balcony** — レース場を見下ろす木のバルコニー（現行の置き換え・床=ウッドデッキ）
2. **beach** — 白砂のビーチと桟橋（床=砂浜、奥に海と火山）
3. **market** — 夜市・屋台ストリート（床=石畳、提灯の列は左右端）
4. **onsen** — 露天の温泉テラス（床=石タイル、湯気、火山が湯の向こう）
5. **stable** — 竜舎の前庭（床=土と藁、柵と竜のシルエットは左右端）
6. **mallplaza** — モール前の広場（床=磨かれた石、噴水は端、ガラス越しに店明かり）

## 共通プロンプトテンプレート（昼）
```
Ultra-realistic travel photograph, no people, no text. {LOCATION_LINE}
A continuous walkable {FLOOR_MATERIAL} floor fills the bottom 26% of the frame —
the floor's far edge (where ground meets the view) sits at exactly 74% from the top.
Keep the horizontal CENTER of the frame clear of near objects (open view only).
A volcanic mountain stands in the RIGHT third, its peak around 20-25% from the top,
{VOLCANO_LINE}. Bright daylight, blue sky, tropical resort island atmosphere,
shot on full-frame camera 35mm, natural lighting, HDR, 16:9.
```
夜版＝末尾を `Warm lantern light, deep blue night sky with stars and moon, the volcano's
crater glowing faint orange, city/stadium lights twinkling in the distance` に差し替え。

### {…}差分（例）
- balcony: 「wooden balcony terrace overlooking a dragon-racing stadium far below」/ wood plank / volcano with thin smoke
- beach: 「white sand beach with a long wooden pier on the left edge, turquoise sea」/ white sand / volcano across the bay
- market: 「resort island night-market street, food stalls and red lanterns along BOTH edges only」/ wet cobblestone / volcano at the street's end
- onsen: 「open-air hot-spring terrace, steam drifting at the edges」/ smooth stone tile / volcano beyond the water
- stable: 「dragon stable front yard, wooden fences at the edges, hay piles」/ packed earth / volcano behind rolling hills
- mallplaza: 「plaza in front of a glass resort shopping mall (lights inside), fountain at the right edge」/ polished stone / volcano reflected in the glass

## 検収チェック（受け取ったら）
1. 74%位置に水平線を引いて床エッジが乗るか（±2%）
2. 縦9:19.5に中央クロップして床/火山が成立するか
3. 中央に近景物が無いか／無人・文字無しか
