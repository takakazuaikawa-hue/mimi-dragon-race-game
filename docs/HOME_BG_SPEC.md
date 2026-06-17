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

## 自宅（myroom）＝進行度で引っ越し
総資産レベル（0..5）に応じて部屋がアップグレード。**`images/homebg/myroom_t<lvl>_{day,night}.webp`**
を置くだけで反映（未生成の段は下の段へ自動フォールバック→最後はbalcony）。床は届き次第
`MYROOM_FLOORS`（ui_render.js）を実測更新。屋内では「床↔奥の壁の境界線＝上端から74%」と読み替え、
火山は**右1/3の窓越し**に見せる。中央±22%は家具禁止（机・棚は左右端のみ）。

| 段 | コンセプト |
|---|---|
| t0 | 素寒貧の納屋（藁の寝床・ひび割れた板壁・ガラス無しの窓穴） |
| t1 | 小さな借り部屋（畳んだ布団・小さな机・紙提灯） |
| t2 | 木のコテージ配信部屋（フェアリーライト・観葉植物・リングライト） |
| t3 | 上等な家（磨かれた木・ガラス窓・本棚と真鍮ランプ） |
| t4 | 豪邸スイート（大理石×ダークウッド・金の装飾・床まで届く大窓） |
| t5 | 天空ヴィラ（眼下に夜の島・一面のガラス壁・金の竜像） |

## 検収チェック（受け取ったら）
1. 74%位置に水平線を引いて床エッジが乗るか（±2%）
2. 縦9:19.5に中央クロップして床/火山が成立するか
3. 中央に近景物が無いか／無人・文字無しか

---

# ★縦構図（ポートレート）背景 — 推奨（背景を最大限に生かす）

横16:9は縦持ち端末で**左右が大きく落ちて全景が見えない**（中央の縦スライスだけが映る）。
さらに大きな前景ミミが中央を覆うため「背景が生かせない」。**縦構図で全景を縦に収める**のが本筋。
現状は **デモとして縦構図のSVG**（`images/homebg/island_portrait_{day,night}.svg`）を `PORTRAIT_DEMO=true`
（`js/ui_home.js`）で常時表示中。**photoreal縦版を同名(.webp)で差し替えるか、`HOME_BGS`に縦エントリを足す**
だけで切替できる。横ロケ・ローテに戻すには `PORTRAIT_DEMO=false`。

## 縦構図の必須数値
| 項目 | 値 | 理由 |
|---|---|---|
| アスペクト | **9:16（例 1152×2048）。可能なら 9:18〜9:19 でより縦長** | 端末枠は約0.46〜0.59。9:16で左右±5〜18%だけ切れ全景は縦に収まる |
| **接地ライン（地平/床の手前エッジ）** | **上から 78%（±3%）** | ミミの足元はメニュー内（下端付近）。地平はメニュー上端あたりに来る |
| 前景の床 | 78%〜下端まで**連続した床**（板/石畳/砂/土） | ミミが立つ面。下20%強はメニューが重なる前提（隠れてOK） |
| 火山 | **右1/3・山頂は上から18〜30%** | 縦でも頭上に島のシンボル |
| 中央の抜け | **横中央±26% は遠景のみ**（近景オブジェクト禁止） | 大きな前景ミミ・吹き出し・ピンが重なる |
| 上部 0〜18% | 空・遠景（重要モチーフ控えめ） | ヘッダー/フロート/目標チップが重なる（暗めのグラデが乗る） |
| 明度 | 上18%と下22%はやや暗めOK（スクリムが乗る） | UI/文字の可読性 |
| 人物・文字 | **無人・文字無し** | 立ち絵とUIが主役 |

## スタイル
**実写フォトリアル**（既存と統一）。`ultra-realistic travel photography, full-frame, 35mm, natural light, HDR`。

## 生成プロンプト（縦・昼／例：島の高台テラス）
```
Ultra-realistic vertical travel photograph (portrait 9:16), no people, no text.
A wooden terrace on a tropical volcanic resort island, overlooking the island.
A continuous walkable wooden-plank floor fills the BOTTOM ~22% of the frame; the floor's
far edge (where it meets the distant view) sits at about 78% from the top.
Keep the horizontal CENTER (±26%) clear of near objects — open distant view only
(a tall foreground subject will stand there). A volcanic mountain stands in the RIGHT third,
its peak around 22% from the top, thin smoke drifting. Lush valley, sea and sky fill the
upper two thirds. Bright daylight, blue sky, HDR, shot on full-frame 35mm. Vertical 9:16.
```
夜版＝末尾を `Warm lantern light, deep blue starry night sky with a moon, the crater glowing
faint orange, distant village/stadium lights twinkling, misty atmosphere` に差し替え。

ロケ差分は横版（balcony/beach/market/onsen/stable/mall）と同じ語彙で、**床=78%・縦9:16**に読み替える。

## 受け取ったら（縦版の組み込み）
1. webp最適化（q82前後）→ `images/homebg/<id>_portrait_{day,night}.webp`
2. `js/ui_home.js` の `HOME_BGS` に縦エントリを足す（または `ISLAND_PORTRAIT` を差し替え）：
   ```js
   { id:"balcony", portrait:true, day:"images/homebg/balcony_portrait_day.webp",
     night:"images/homebg/balcony_portrait_night.webp", floorDay:0.78, floorNight:0.78 }
   ```
3. `portrait:true` のエントリは **接地キャリブレーションをスキップ**し素直な cover 表示（`.hl-bg-img.portrait`）。
   ミミの足元は固定（メニュー内）なので、床=78%で設計すれば自然に立つ。複数縦ロケを入れれば日替わりローテも可。
4. 検収：縦端末で①地平が78%付近②中央±26%が空き③火山が右上④無人・文字無し。
