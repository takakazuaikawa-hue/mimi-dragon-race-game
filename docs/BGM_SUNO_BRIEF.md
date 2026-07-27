# 🎵 モールBGM 発注ブリーフ（Suno・G3-5）

> `docs/GENERATIVE_3D_RPG_DIRECTIVE.md` §4 G3-5 の3曲。
> **この環境の生成ツールでは音楽を作れない**（`generate_audio` は音声合成専用で、
> 「音楽・効果音は一般用途では生成できない／`sonilo_music` はゲーム生成パイプライン専用・単独利用禁止」と
> ツール自身が明示）。既存 `bgm/` と同じく **Suno でユーザーが作る**のが正道
> （設計書 `scene_engine_and_mall_redesign.md` §4 も「音楽=Suno」）。
> ここはそのまま Suno に貼れる形の発注書。**曲が届いたら結線はこちらでやる。**

---

## 0. 全曲に共通の条件（守ってほしいこと）

| 項目 | 指定 |
|---|---|
| 形式 | **mp3** |
| 長さ | **90秒前後**（ループ前提。フェードアウトで終わらせない＝終わりと頭がつながる作り） |
| 歌 | **インスト（歌なし）**。既存のモール曲は歌ありなので、新3曲は歌詞で邪魔しない方向 |
| 音量 | 既存 `bgm/mallbgm/*.mp3` と**同じくらいの体感音量**（極端に大きい／小さいと音量スライダーの意味が薄れる） |
| 雰囲気の芯 | 崑崙島＝**竜と亜人の南国リゾート**。和洋折衷でにぎやか。深刻になりすぎない |

**置き場所とファイル名（このとおりでお願いします）**

```
bgm/mallbgm/mall-day.mp3      … 探索中のふだんの曲
bgm/mallbgm/mall-boss.mp3     … 店長・フロアの主との戦い
bgm/mallbgm/mall-fever.mp3    … 大当たり／フィーバー
```

※日本語ファイル名は**避けてください**。過去に日本語名mp3がNFD（分解形）で保存されて
ローカルもライブも404になった事故があります（[[deploy-method]] の「共通」参照）。半角英数なら安全です。

---

## 1. `mall-day.mp3` — お買い物ダンジョンの探索

**Suno に渡す Style プロンプト（そのまま貼れます）**

```
upbeat tropical shopping mall theme, cheerful instrumental, marimba and steel drum lead,
light bossa nova shuffle, warm electric piano, soft brass stabs, ukulele backing,
gentle hand percussion, major key, playful and breezy, 108 BPM, loopable, no vocals
```

- **どんな時間か**：ミミが紙袋を提げて売り場をうろうろしている時間。1回のランは10〜15分。
  **ずっと流れる曲**なので、主張しすぎず、でも退屈しない程度に動きがほしい。
- **避けたいこと**：シリアス、壮大、泣かせにくる展開。ここは日常。

## 2. `mall-boss.mp3` — 店長・フロアの主との戦い

**Style プロンプト**

```
comedic boss battle theme, energetic instrumental, driving taiko and tom groove,
big band brass hits, tremolo strings, church organ accents, minor key with playful swing,
tense but never scary, cartoonish grandeur, 148 BPM, loopable, no vocals
```

- **どんな時間か**：観覧車ゴーレム／マダム・メゾン／ドン竜キホーテ店長との戦い。
  **怖い曲ではなく「大げさで楽しい」曲**。相手は“買い物の主”であって魔王ではない。
- **ほしい山**：頭8秒で「始まった！」と分かる合図 → 中盤で一度落として溜め → 戻る。

## 3. `mall-fever.mp3` — フィーバー／大当たり

**Style プロンプト**

```
euphoric jackpot fever theme, fast and dazzling instrumental, arpeggiated synth bells,
disco strings, four-on-the-floor drums, bright horn section, hand claps, shimmering chimes,
major key, celebratory and slightly silly, 138 BPM, loopable, no vocals
```

- **どんな時間か**：おたからチャンス・コンボが伸びている瞬間。**短時間しか鳴らない**ので、
  頭から全開でよい（前奏でためない）。

---

## 4. 届いたあとの結線（こちらの作業・記録用）

- `mall-day` … `js/bgm_zones.js` の `MALL_TRACKS` に1行足すだけで、モール画面のゾーンBGMに入る。
- `mall-boss` / `mall-fever` … **今の仕組みには“戦闘中だけ曲を替える”経路が無い**ので、
  `bgm_zones.js` に「ボス戦／フィーバー中は専用トラックへ差し替え、終わったら戻す」処理を足す。
  ファイルが無い間は**何も起きない**ようにガードする（＝先に仕組みだけ入れても壊れない）。
- 曲が揃ってから実機で「鳴る・切り替わる・音量スライダーが効く・レースBGMと喧嘩しない」を確認して完了とする。
