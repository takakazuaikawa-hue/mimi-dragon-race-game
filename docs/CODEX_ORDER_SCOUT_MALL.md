# CODEX_ORDER — スカウト/モール画像発注（生成担当:Codex / 2026-07-18）

> 契約は docs/CAST_ART_BRIEF.md v3 の「§0 契約」を全条適用:
> 納品=画像のみ・コード変更禁止・迷ったらスキップ報告・⚠️images/dragons/には触れない・1枚ずつ配置可。

## A. スカウト舞台絵 6枚（優先★★★）
- 配置先: `images/scoutbg/`（新規フォルダ）・**縦9:16（720×1280）不透過webp**
- 構図: 主役は上2/3・下1/3は竜スプライトと吹き出しが載るため暗め/静か。人物・竜は描かない。
- トーン参照: `images/bg/`（既納品のVN背景）と同一画風。

| ファイル名 | 場面 | ENプロンプト種 |
|---|---|---|
| grass.webp | 陽だまりの草むら・花と足跡 | sunny meadow with faint animal tracks, warm light |
| jungle.webp | 湿った密林の奥・木漏れ日と霧 | deep humid jungle, god rays through mist |
| cliff.webp | 切り立つ崖線・風と巣の影 | sheer sea cliffs, wind-swept ledges, distant nest |
| sea.webp | 白砂の入江・浅瀬のきらめき | white sand cove, sparkling shallows |
| volcano.webp | 黒溶岩原・地熱の湯気と赤い実 | black lava field, geothermal steam, red berries |
| sky.webp | 雲海の上の岩峰・朝光 | rock spire above sea of clouds, dawn light |

共通尾部: `vertical 9:16, subject in upper two thirds, calm dark lower third, no people no dragons no text, painterly-realistic tropical fantasy`

## B. 交渉術カテゴリアイコン 7個（優先★★）
- 配置先: `images/nav/cat_<key>.svg`（既存navアイコンと同じ作法=単色ベース+金/ジェイドの差し色・線の太さを合わせる。参照: images/nav/island.svg 等）
- key/意味: mi=身(そっと寄る) / koe=声(呼びかけ) / ma=間(待つ・砂時計) / okuri=贈(贈り物) / mane=真似(鏡合わせ) / asobi=遊(ボール) / waza=技(光る爪)

## C. モール敵・店長スプライト 8枚（優先★★）
- 配置先: `images/rpg/`・**512×512 透過webp**・コミカルなデフォルメ（レース竜のHD-2Dとは別物でよいが色数と輪郭の柔らかさは images/cast/stand/poro.webp に寄せる）
- 敵6: `en_cartrat.webp`(カート暴走ネズミ) `en_pricetag.webp`(値札ゴースト) `en_bagslime.webp`(袋スライム) `en_mannequin.webp`(歩くマネキン) `en_coupon.webp`(クーポン鳥) `en_sale_golem.webp`(セール台ゴーレム)
- 店長2: `boss_donryu.webp`(ドン竜キホーテ店長=派手な竜人) `boss_maison.webp`(高級店マダム=上品な獣人)

## D. ハプニングイベント絵 4枚（優先★・任意）
- 配置先: `images/rpg/ev_<n>.webp`・512×512透過: 試食の山/迷子の子竜/福引きガラポン/閉店セールの群衆(シルエット)

## QA（配置前・毎回）
①指定寸法 ②A以外は四隅透過 ③既納品と画風が揃う ④ファイル名一字一句一致。完了報告に配置一覧とスキップ理由。
