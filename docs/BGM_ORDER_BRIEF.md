# 🎼 サウンドトラック発注指示書（Suno・全画面版）＝**音楽の正本**

> 目的は「BGMを足す」ことではなく、**『音楽がいいゲーム』と言われる**こと。
> そのために本書は **①1本の音楽的背骨（モチーフと楽器パレット）→②画面ごとの発注 →③採用基準 →④結線**
> の順で書く。曲は Suno でユーザーが作り、**届いたら結線はこちら（実装側）でやる**。
>
> ## 👉 **実際にSunoへ貼るときは [BGM_SUNO_PASTE_SHEET.md](BGM_SUNO_PASTE_SHEET.md)**
> （Sunoの入力欄と1対1・Title/Styles/Excludeを読まずに上から貼れる作業用シート）。
> **本書は設計の理屈**＝なぜその楽器・その速度・その長さなのか、と採用基準。迷ったときに戻る場所。
>
> 既存の `docs/BGM_SUNO_BRIEF.md` はモール3曲（納品済み `mall-day/boss/fever`）の発注書。
> **本書がそれを含む全体の正本**。以後BGMの話はここに集約する。
> 関連：[[audio-volume-control]]（🔊スライダ）・`js/bgm.js`（TRACK_GAIN＝曲別ゲイン）・`js/bgm_zones.js`（ゾーン割り当て）。

---

## 0. いまの「音の穴」（2026-07-30・コード実測。推測ではない）

| 状態 | 画面 |
|---|---|
| ✅ 音がある | レース実況（6曲ランダム）／モール・お買い物ダンジョン（通常4＋ボス＋フィーバー）／エンディング／終章の最終決戦 |
| 🔔 ジングルだけ | 結果画面（**的中時だけ** `fanfare-days.mp3`。外れは無音） |
| ❌ 無音 | **タイトル**／**ホーム（静か・配信の両モード）**／レース選択・レース詳細（賭け）・分析／暮らし・くらしツリー・習い事・食事・暮らしコレクション・島の経済・島づくり／村・図鑑・龍舎・竜スカウト・ポロのグルメレース／**物語・各話・相談**／目標・予想入門・設定／SNS／観光（地図・ガイド・写真・歩いてまわる） |

> ホームBGMは検証の邪魔になるので意図的に切っていた（`js/bgm_zones.js` の `HOME_TRACKS` がコメントアウト）。
> つまり **プレイヤーが一番長く見ている画面（ホーム＋島の暮らし＋物語）が、まるごと無音**。ここが最大の穴。

**穴の埋め方の方針**：画面ごとに1曲ずつ作ると30曲になり、統一感が壊れて破綻する。
**「ゾーン（部屋）」単位で14曲**にまとめ、**同じモチーフを楽器だけ替えて配る**。これが本書の設計思想。

---

## 1. 音楽的背骨（★全曲共通・ここが命）

### 1-1. 世界の音色 — 3つのレイヤー

崑崙島＝**中華神話の霊山（崑崙）× 竜と亜人の南国リゾート × 賭博場**。だから楽器も3層で持つ。

| レイヤー | 使う楽器 | 出る画面 |
|---|---|---|
| **A 島の日常** | マリンバ／ウクレレ／スチールパン／ナイロン弦ギター／ブラシのドラム／口笛／指パッチン | ホーム・暮らし・食事・観光・村 |
| **B 崑崙の神話** | 二胡（erhu）／古筝（guzheng）／笛子（dizi）／大鼓・締太鼓／寺の鐘／低い男女混声のパッド | 物語・終章・スカウト奥地・タイトル |
| **C 賭博場** | ビッグバンドの金管／ウッドベース／ハモンドオルガン／タンバリン／手拍子／パイプオルガン（聖龍レースだけ） | レース選択・賭け・レース実況・結果 |
| **D 配信（現代）** | ローファイのドラムループ／ローズピアノ／テープヒス／レコードノイズ／サイドチェインのベース | 配信ホーム・SNS |

**混ぜ方の掟**：1曲の主役は必ず1レイヤー。ただし**隣のレイヤーの楽器を1つだけ客演させる**
（例：日常の曲に二胡が1フレーズだけ顔を出す＝「ここは崑崙島なんだ」が音で分かる）。

### 1-2. モチーフ（★これが統一感の正体）

**「ミミの動機」＝上がって帰ってこない4音：D → F# → A → B**（ニ長調の ド・ミ・ソ・ラ）。
最後が6度で終わる＝**解決しない＝まだ続きがある**。借金まみれで島に来た娘の話に合う。

- **全曲のStyleプロンプトに、次の1行をそのまま入れる**（Sunoに家族的な似姿を作らせるための呪文）：
  ```
  recurring 4-note rising motif (D F# A B), left unresolved on the sixth
  ```
- 変奏の担当：タイトル＝二胡で堂々と／ホーム＝マリンバで軽く／物語＝ピアノで一音ずつ／
  レース＝金管でファンファーレ化／終章＝短調（D F A♭ B♭）に崩す。

### 1-3. 調と速度の家系（＝画面をまたいでも喧嘩しない）

- **調はニ（D）を中心に固定**。日常＝Dメジャー、神話＝Bマイナー、レース＝Dミクソリディアン（お祭り）、
  終章＝Dフリジアン（不吉）。→ 画面遷移で曲が変わっても**同じ家の中を移動している**音になる。
- 速度：**静 72–84**（物語・終章の待ち）／**日常 96–112**（ホーム・暮らし・観光）／
  **賑わい 124–138**（配信・モール・SNS）／**熱 150–168**（レース・戦闘）。

### 1-4. ⚠️ 技術要件（守られないと実装側で直せない）

| 項目 | 指定 | 理由 |
|---|---|---|
| 形式 | **mp3** | 既存と同じ |
| 長さ | **90〜120秒** | ループ前提。長すぎると読み込みが重い |
| **前奏は4秒以内** | 頭からすぐ本題へ | `<audio loop>` は毎周**頭から**鳴る。長い前奏は毎周聞かされる＝必ず飽きる |
| 終わり方 | **フェードアウト禁止**。最後の小節を鳴らし切って止める | 頭とつながる |
| 歌 | **インスト（歌なし）が原則**。歌ありは**モールとエンディングだけ**（既存曲がそう） | 長時間画面で歌詞は疲れる。実況の声とぶつかる |
| ラウドネス | **RMS −17dBFS 前後・トゥルーピーク −1dBTP 以下** | 実測で既存曲は −13.9〜−18.5dBFS とバラバラだった。実装側で `TRACK_GAIN` により**下げて**揃えるので、**大きく作るほど損** |
| ファイル名 | **半角英数のみ**（例 `home-morning.mp3`） | 日本語名がNFD（分解形）で保存され、ローカルもライブも404になった事故がある |
| 帯域 | 中低域を厚くしすぎない。**1–3kHzを少し空ける** | ここに実況の声・効果音が乗る。空けておくと「音が団子」にならない |
| モノ確認 | スマホの片側スピーカーで芯が消えないこと | 実機は縦持ちスマホが主戦場 |

### 1-5. ★Sunoの使い方で差が出るところ（これをやると「アルバム」になる）

1. **最初に `T1 タイトル曲` を作り切る**。ここで世界の音色を決める。
2. 気に入ったテイクから **Persona（スタイルの人格）を作成**し、**以降の全曲をそのPersonaで生成**する。
   → 楽器・録り音・空気感が揃い、14曲が「同じ作曲家の仕事」になる。**曲ごとに一から作ると必ずバラバラになる。**
3. 1曲につき **2〜3テイク**出して選ぶ。迷ったら §3 の採用基準に当てる。
4. 決まったら **Extend で90〜120秒に整える**（短いまま採らない／フェードで終わらせない）。

---

## 2. 発注リスト（14曲＋任意3）

優先度：**P0＝これだけで体験が変わる（先に作る）／P1＝穴埋めの本体／P2＝仕上げ**。
「担当画面」は `js/bgm_zones.js` のゾーンにそのまま対応させる。

---

### 🥇 P0（6曲）— まずこの6曲

#### T1 `title-konron.mp3` — タイトル「崑崙島へ」
**担当画面**：タイトル（現在＝無音）
**この曲の役目**：初回起動の3秒で世界を決める。**霊山の靄 → 竜の羽音 → 祭りの気配**の順に開く。
```
cinematic east-asian fantasy main theme, instrumental, erhu lead over guzheng arpeggios,
dizi flute answers, low mixed choir pad, taiko heartbeat entering at half time,
distant festival bells, B minor to D major lift, slow majestic 76 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
warm analog reverb, intro under 4 seconds, no fade-out, loopable, no vocals
```
構成の希望：`[0-4s] 二胡の第一声 → [4-30s] 古筝の波 → [30-60s] 太鼓が入り開ける → [60-90s] 主題を全奏 → 頭へ`

#### T2 `home-morning.mp3` — ホーム（静かモード）「島の朝」
**担当画面**：ホーム（静か）／目標／予想入門／設定
**この曲の役目**：**一番長く聞く曲**。だから「良い曲」より**飽きない曲**。旋律は薄く、余白を多く、
展開は1回だけ。プレイヤーが考えごと（次はどのレース？）をしても邪魔しない。
```
gentle tropical morning theme, instrumental, marimba and ukulele, nylon string guitar,
soft brushed drums, warm upright bass, one distant erhu phrase as a guest,
sparse arrangement with lots of space, major key, calm and hopeful, 98 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
no big climax, intro under 4 seconds, no fade-out, loopable, no vocals
```
避けたいこと：主張の強い旋律、派手なドラムフィル、泣かせにくる展開。

#### T3 `home-onair.mp3` — ホーム（配信モード）「ミミ・オン・エア」
**担当画面**：ホーム（配信）
**この曲の役目**：スマホを買って配信を始めた**別世界感**。同じモチーフが**ローファイに着替える**＝
「ミミは変わっていないのに、世界の見え方が変わった」を音でやる。
```
lofi hip hop stream theme, instrumental, dusty rhodes piano, boom bap drums with vinyl crackle,
sidechained sub bass, muted trumpet fill, tape hiss, shaker, chopped marimba sample,
laid back and cute, 88 BPM, recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T4 `bet-lobby.mp3` — 賭け場のロビー「オッズの匂い」
**担当画面**：レース選択／レース詳細（賭け）／分析
**この曲の役目**：**まだ賭けていない時間**の高揚。走り出す前の、財布と欲を睨む数十秒。
熱くしすぎない（熱いのは実況曲の仕事）。**期待と少しの後ろめたさ**。
```
smoky swing betting lounge theme, instrumental, walking upright bass, brushed snare,
muted big band brass stabs, hammond organ comping, vibraphone melody, finger snaps,
D mixolydian, confident with a sly grin, 104 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T5 `documentary.mp3` — 物語「密着」
**担当画面**：物語（一覧）／各話／相談（顧問）
**この曲の役目**：媒体は**密着ドキュメンタリー『ミミ、爆走中。』**。だから劇伴ではなく**取材の音**。
主役は間（ま）。台詞（立ち絵の声）を邪魔しないよう、旋律は下に沈める。
```
observational documentary underscore, instrumental, single felt piano, sustained string pad,
soft pulsing synth bass, minimal ticking percussion, occasional erhu long tone,
restrained and intimate, 78 BPM, low-mid focus leaving room for dialogue,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```
避けたいこと：感動的な弦の全奏（＝安いドラマになる）。

#### T6 `island-life.mp3` — 暮らし「暮らしの帳面」
**担当画面**：暮らしと資産／くらしツリー／習い事／食事／暮らしコレクション／島の経済／島づくり／村／図鑑／コレクション
**この曲の役目**：数字と持ち物を眺める時間。**几帳面で、少し可笑しい**。
生活が積み上がる感じ＝小さな音がコツコツ重なる編曲。
```
cozy ledger and bookkeeping theme, instrumental, pizzicato strings, marimba ostinato,
toy piano, woodblock and triangle, accordion pad, soft tuba bass notes,
methodical and slightly comical, major key, 106 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```

---

### 🥈 P1（5曲）— 穴埋めの本体

#### T7 `konron-stroll.mp3` — 観光「崑崙そぞろ歩き」
**担当画面**：観光（地図）／崑崙ガイドブック／フォトコレクション／歩いてまわる
```
sunny island sightseeing theme, instrumental, steel pan and marimba duet, ukulele strum,
whistling melody, bongo and shaker groove, warm flugelhorn counter line, guzheng sprinkle,
carefree and touristy, 110 BPM, recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```
※将来エリア別に分けるなら、この曲を**基準**に温泉版（T12）／浜版を派生させる。

#### T8 `scout-stalk.mp3` — 竜スカウト「けはいを追って」
**担当画面**：竜スカウト（しのびあし含む）
**役目**：**息を殺す時間**。ターン制で竜の背後へ回る緊張。打楽器は少なく、**間**と**擦れる音**で作る。
音量が大きいと「見つかった！」の効果音が埋もれるので、全体を控えめに。
```
stealth tracking theme, instrumental, muted kalimba pulse, breathy bass flute,
brushed frame drum on the off beat, high sustained harmonic drone, rustling leaves texture,
sparse and suspenseful but gentle, B minor, 84 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
quiet dynamics, intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T9 `poro-nap.mp3` — 龍舎「ポロと昼寝」
**担当画面**：龍舎／ポロのグルメレース
```
warm lullaby for a crybaby dragon, instrumental, celesta and music box, soft nylon guitar,
humming cello, gentle woodblock steps, faint wind chimes,
tender and a little silly, major key, 84 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T10 `after-race.mp3` — 結果「答え合わせ」
**担当画面**：結果（★**外れの時も含めて**流す中立のベッド。的中の `fanfare-days.mp3` は今のまま残す）
**役目**：勝っても負けても座っていられる音。**判定を下さない**。今は外れると無音で、
負けた時だけ世界が消えるのが体験として冷たい。
```
neutral aftermath theme, instrumental, soft electric piano chords, warm pad,
light tambourine pulse, muted trumpet single notes, upright bass held low,
neither happy nor sad, reflective, 92 BPM,
recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T11 `timeline.mp3` — SNS「タイムラインの海」
**担当画面**：SNS（タイムライン／ファンレター）
```
scrolling feed theme, instrumental, bright plucked synth arpeggio, lofi drums,
rhodes chords, bubbly blips as notification texture, soft clap on 4,
light and endless, 124 BPM, recurring 4-note rising motif (D F# A B), left unresolved on the sixth,
intro under 4 seconds, no fade-out, loopable, no vocals
```

---

### 🥉 P2（3曲）— 仕上げ

#### T12 `onsen-uroko.mp3` — 温泉「うろこ湯」（観光エリア派生）
```
hot spring relaxation theme, instrumental, koto and shakuhachi, water droplet percussion,
warm low strings, distant wooden bucket clacks, steam-like pad,
slow and soothing, 72 BPM, recurring 4-note rising motif (D F# A B),
intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T13 `doom-countdown.mp3` — 終章「淘汰のカウントダウン」
**担当画面**：終章の絶滅メーター周辺（既存の最終決戦曲 `絶滅のファンファーレ.mp3` の**手前**を埋める）
```
creeping extinction countdown, instrumental, D phrygian, low taiko on odd beats,
detuned erhu long tones, ticking clock percussion, church organ low pedal,
choir whisper pad, oppressive but dignified, 80 BPM,
distorted version of the 4-note motif (D F Ab Bb), intro under 4 seconds, no fade-out, loopable, no vocals
```

#### T14 `sacred-race.mp3` — 最上位レース「神兎大レース」（レース曲の第7曲＝ランク7専用の格）
**担当画面**：レース実況（★将来ランク7だけで鳴らす。今のランダム6曲に混ぜない）
```
sacred grand prix theme, instrumental, pipe organ and full brass fanfare,
double taiko gallop, tremolo strings, temple bells, choir shouts as rhythm,
overwhelming and ceremonial, D mixolydian, 164 BPM,
recurring 4-note rising motif (D F# A B) turned into a fanfare,
intro under 4 seconds, no fade-out, loopable, no vocals
```

### （任意）短い当たり音 3本
Sunoは5秒の音が苦手なので **20〜30秒で作って頭6〜8秒を切り出す**運用にする。
`sting-rankup.mp3`（昇格）／`sting-newdragon.mp3`（新しい竜）／`sting-chapter.mp3`（新章）。
```
short triumphant sting, instrumental, brass and bells hit then quick decay,
based on the 4-note rising motif (D F# A B), 30 seconds, no fade-out, no vocals
```

---

## 3. 採用基準（テイク選びのチェックリスト・★ここを妥協すると全部が濁る）

1. **10分テスト**：ループで10分流して、うるさくないか。飽きるのは「旋律が濃い」か「前奏が長い」のどちら
   かが原因。→ 薄いテイクを選ぶ。
2. **頭4秒テスト**：0秒から本題に入っているか。長い前奏のテイクは**採らない**（毎周聞かされる）。
3. **声テスト**：物語・レース・スカウトは、台詞や実況を重ねても言葉が聞き取れるか（1–3kHzが空いているか）。
4. **モノテスト**：スマホの片側スピーカーで芯が残るか。
5. **家族テスト**：T1（タイトル）と続けて聞いて、**同じ島の音**に聞こえるか。聞こえないならPersonaを使い直す。
6. **モチーフテスト**：4音（D F# A B）の面影があるか。無ければプロンプトのその1行を残したまま再生成。
7. **音量テスト**：既存の `lets-do-this.mp3` と並べて、**同じくらいか少し小さい**か（大きいテイクは不利）。

---

## 4. 納品の置き場所（このとおりでお願いします）

```
bgm/homebgm/home-morning.mp3        T2
bgm/homebgm/home-onair.mp3          T3
bgm/uibgm/title-konron.mp3          T1
bgm/uibgm/bet-lobby.mp3             T4
bgm/uibgm/documentary.mp3           T5
bgm/uibgm/island-life.mp3           T6
bgm/uibgm/konron-stroll.mp3         T7
bgm/uibgm/scout-stalk.mp3           T8
bgm/uibgm/poro-nap.mp3              T9
bgm/uibgm/after-race.mp3            T10
bgm/uibgm/timeline.mp3              T11
bgm/uibgm/onsen-uroko.mp3           T12
bgm/uibgm/doom-countdown.mp3        T13
bgm/racebgm/sacred-race.mp3         T14
```
（`bgm/uibgm/` は新設フォルダ。無ければ作る。**半角英数のファイル名を厳守**）

---

## 5. 届いたあとの結線（実装側の作業・記録用）

1. `js/bgm_zones.js` のゾーンを**画面群→曲**の対応に組み替える。いまは `home` と `mall` の2ゾーンしか無いので、
   `title / home_quiet / home_live / bet / story / life / walk / scout / stable / result / sns` を足す。
   **ファイルが無いゾーンは今のまま無音**にガードする（＝1曲ずつ届いても壊れない・全部揃うまで待たない）。
2. `js/bgm.js` の **`TRACK_GAIN` に1行足す**（RMSを実測して `0.1195 ÷ そのRMS`）。
   ここを忘れると新曲だけ大きく鳴る（＝今回の「モールがうるさい」の再発）。
3. ホームは**静か／配信の2モードで別の曲**（`state` のモード判定を1つ読むだけ）。
4. 結果画面は「的中＝ファンファーレ（単発）」「外れ＝T10のベッド」に分ける。
5. 実機で **①鳴る ②画面遷移で1本だけ ③🔊スライダが効く ④効果音でダッキングする ⑤実況の声が埋もれない**
   の5点を確認して完了とする（[[verify-functional-core]]）。

---

## 6. 進行表（発注のたびにここへ ✅ を入れる）

| # | ファイル | 優先 | 発注 | 納品 | 結線 | 実機確認 |
|---|---|---|---|---|---|---|
| T1 | title-konron | P0 | ⬜ | ⬜ | ⬜ | ⬜ |
| T2 | home-morning | P0 | ⬜ | ⬜ | ⬜ | ⬜ |
| T3 | home-onair | P0 | ⬜ | ⬜ | ⬜ | ⬜ |
| T4 | bet-lobby | P0 | ⬜ | ⬜ | ⬜ | ⬜ |
| T5 | documentary | P0 | ⬜ | ⬜ | ⬜ | ⬜ |
| T6 | island-life | P0 | ⬜ | ⬜ | ⬜ | ⬜ |
| T7 | konron-stroll | P1 | ⬜ | ⬜ | ⬜ | ⬜ |
| T8 | scout-stalk | P1 | ⬜ | ⬜ | ⬜ | ⬜ |
| T9 | poro-nap | P1 | ⬜ | ⬜ | ⬜ | ⬜ |
| T10 | after-race | P1 | ⬜ | ⬜ | ⬜ | ⬜ |
| T11 | timeline | P1 | ⬜ | ⬜ | ⬜ | ⬜ |
| T12 | onsen-uroko | P2 | ⬜ | ⬜ | ⬜ | ⬜ |
| T13 | doom-countdown | P2 | ⬜ | ⬜ | ⬜ | ⬜ |
| T14 | sacred-race | P2 | ⬜ | ⬜ | ⬜ | ⬜ |

---

## 付録A. 既存曲の実測ラウドネス（2026-07-30・decodeAudioDataでRMS実測）

新曲を作るときの**目標＝RMS −17dBFS 前後**（下表の中央あたり）。

| 曲 | RMS | dBFS | 採用ゲイン |
|---|---|---|---|
| lets-do-this.mp3（一番静か＝基準） | 0.1195 | −18.45 | 1.00 |
| 絶滅のファンファーレ.mp3 | 0.1205 | −18.38 | 0.99 |
| fog-cutting-flag.mp3 | 0.1364 | −17.31 | 0.88 |
| くつろぎ.mp3 | 0.1389 | −17.15 | 0.86 |
| mall-fever.mp3 / ホームカントリー.mp3 | 0.1411 | −17.01 | 0.85 |
| ある日森の中ドラゴンに出会った.mp3 | 0.1424 | −16.93 | 0.84 |
| sky-hero.mp3 | 0.1425 | −16.92 | 0.84 |
| fanfare-days.mp3 | 0.1445 | −16.80 | 0.83 |
| mall-day.mp3 | 0.1467 | −16.67 | 0.81 |
| crown-of-thunder.mp3 | 0.1502 | −16.47 | 0.80 |
| the-fanfare.mp3 | 0.1514 | −16.40 | 0.79 |
| unlosable-battle.mp3 | 0.1564 | −16.12 | 0.76 |
| mallでお買い物.mp3 / バニーガールメンタル…mp3 | 0.1599 | −15.92 | 0.75 |
| mall-boss.mp3 | 0.1620 | −15.81 | 0.74 |
| **ドラゴンモールで爆買いバニー.mp3** | **0.2026** | **−13.87** | **0.59** |

「モールの音が大きすぎる」の実体＝最下段。基準より **4.6dB（体感1.7倍）**大きかった。
