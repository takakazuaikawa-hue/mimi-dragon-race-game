# 🎤 Suno 貼り付けシート（1曲＝3ブロックをコピペするだけ）

> 設計の理屈（モチーフ・楽器パレット・技術要件・採用基準）は **[BGM_ORDER_BRIEF.md](BGM_ORDER_BRIEF.md)** に。
> **こちらは作業用**。Sunoの入力欄と1対1で並べてあるので、読まずに上から貼れます。

## 使い方（毎曲この5手）

1. Suno → **Create** → **Custom** モードにする
2. **Instrumental を ON**（歌なし。★モール曲とエンディングだけは例外＝歌あり既存曲）
3. **Styles** 欄 ← 下の「Styles」ブロックを貼る
4. **Exclude styles** 欄 ← 下の「Exclude」ブロックを貼る（この欄が無いバージョンなら**飛ばしてOK**。Stylesだけで成立します）
5. **Title** 欄 ← 下の「Title」を貼る → Create（1曲2〜3テイク出して選ぶ）

**選んだあと**：⑥ Extend で **90〜120秒**に伸ばす（フェードアウトで終わらせない）→ ⑦ mp3ダウンロード
→ ⑧ 下の「保存名」に**リネーム**して指定フォルダへ → ⑨ 私に「◯◯届いた」と言ってください（結線とゲイン調整をやります）

### ★最初に1回だけやってほしいこと（これで14曲が“同じ作曲家の仕事”になります）
**T1 を最初に作り、気に入ったテイクから Persona（スタイル人格）を作成**。
**以降の13曲は、そのPersonaを選んだ状態で** Styles を貼ってください。
これをやらないと曲ごとに音色がバラけて、アルバムになりません。

### 迷ったときの判断（3つだけ）
- **前奏が長いテイクは採らない**（ゲームは毎周おなじ頭から鳴る＝必ず飽きる）
- **10分ループして邪魔にならないか**（濃い旋律より薄い方が勝ち）
- **既存の `lets-do-this.mp3` と並べて同じか少し小さい音量**（大きいテイクは実装側で下げるので損）

---
---

# 🥇 P0 ＝ まずこの6曲

## T1 タイトル画面「崑崙島へ」

**Title**
```
Toward Mount Konron
```
**Styles**
```
cinematic east asian fantasy, erhu, guzheng, dizi flute, taiko, low choir pad, temple bells, majestic, mystical, B minor to D major, 76 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, silence at start, modern drums, dubstep
```
- 保存名 → `bgm/uibgm/title-konron.mp3`
- 狙い：起動3秒で世界を決める。霊山の靄 → 竜の羽音 → 祭りの気配、の順に開く。

---

## T2 ホーム（静かモード）「島の朝」★一番長く聞く曲

**Title**
```
Island Morning
```
**Styles**
```
warm tropical morning theme, marimba, ukulele, nylon guitar, brushed drums, upright bass, sparse and spacious, calm, hopeful, D major, 98 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, epic climax, heavy drums, dramatic strings
```
- 保存名 → `bgm/homebgm/home-morning.mp3`
- 狙い：**良い曲より飽きない曲**。旋律は薄く、余白多め、展開は1回だけ。考えごとの邪魔をしない。

---

## T3 ホーム（配信モード）「ミミ・オン・エア」

**Title**
```
Mimi On Air
```
**Styles**
```
lofi hip hop, dusty rhodes piano, boom bap drums, vinyl crackle, sidechained sub bass, muted trumpet, tape hiss, cute, laid back, D major, 88 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, orchestral, aggressive
```
- 保存名 → `bgm/homebgm/home-onair.mp3`
- 狙い：同じモチーフが**ローファイに着替える**＝「ミミは変わっていないのに世界の見え方が変わった」。

---

## T4 レース選択・賭け・分析「オッズの匂い」

**Title**
```
Scent of the Odds
```
**Styles**
```
smoky swing lounge, walking upright bass, brushed snare, muted big band brass, hammond organ, vibraphone, finger snaps, sly, expectant, D mixolydian, 104 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, heroic fanfare, edm
```
- 保存名 → `bgm/uibgm/bet-lobby.mp3`
- 狙い：**まだ賭けていない時間**の高揚。熱くしすぎない（熱いのは実況曲の仕事）。期待と少しの後ろめたさ。

---

## T5 物語・各話・相談「密着」

**Title**
```
Run Bunny Run
```
**Styles**
```
observational documentary underscore, felt piano, string pad, soft synth bass, ticking percussion, one erhu long tone, restrained, intimate, B minor, 78 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, soaring strings, tearjerker, big climax
```
- 保存名 → `bgm/uibgm/documentary.mp3`
- 狙い：媒体は密着ドキュメンタリー『ミミ、爆走中。』。劇伴ではなく**取材の音**。主役は間（ま）。台詞を邪魔しない。

---

## T6 暮らし・資産・食事・村・図鑑「暮らしの帳面」

**Title**
```
The Ledger of Small Days
```
**Styles**
```
cozy bookkeeping theme, pizzicato strings, marimba ostinato, toy piano, woodblock, triangle, accordion, tuba bass, methodical, slightly comical, D major, 106 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, epic, sad
```
- 保存名 → `bgm/uibgm/island-life.mp3`
- 狙い：数字と持ち物を眺める時間。几帳面で少し可笑しい。小さな音がコツコツ重なる編曲。

---
---

# 🥈 P1 ＝ 穴埋めの本体（5曲）

## T7 観光・歩いてまわる「崑崙そぞろ歩き」

**Title**
```
Konron Stroll
```
**Styles**
```
island sightseeing theme, steel pan, marimba, ukulele, whistling melody, bongo, shaker, flugelhorn, guzheng sprinkle, carefree, sunny, D major, 110 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, dark, tense
```
- 保存名 → `bgm/uibgm/konron-stroll.mp3`

---

## T8 竜スカウト（しのびあし）「けはいを追って」

**Title**
```
On Its Trail
```
**Styles**
```
stealth tracking underscore, muted kalimba pulse, bass flute, brushed frame drum, high harmonic drone, leaf rustle texture, sparse, suspenseful, quiet, B minor, 84 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, loud percussion, horror, jump scare
```
- 保存名 → `bgm/uibgm/scout-stalk.mp3`
- 狙い：**息を殺す時間**。全体を控えめに（大きいと「見つかった！」の効果音が埋もれる）。

---

## T9 龍舎・ポロのグルメレース「ポロと昼寝」

**Title**
```
Nap with Poro
```
**Styles**
```
gentle lullaby, celesta, music box, nylon guitar, humming cello, woodblock steps, wind chimes, tender, a little silly, D major, 84 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, drums, intense
```
- 保存名 → `bgm/uibgm/poro-nap.mp3`

---

## T10 結果画面「答え合わせ」★外れの時も鳴る中立の音

**Title**
```
Checking the Answer
```
**Styles**
```
neutral aftermath theme, electric piano chords, warm pad, light tambourine, muted trumpet single notes, low upright bass, reflective, D major, 92 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, victory fanfare, sad piano
```
- 保存名 → `bgm/uibgm/after-race.mp3`
- 狙い：勝っても負けても座っていられる音。**判定を下さない**（的中のファンファーレは今のまま別に鳴ります）。

---

## T11 SNS「タイムラインの海」

**Title**
```
Endless Timeline
```
**Styles**
```
bright scrolling feed theme, plucked synth arpeggio, lofi drums, rhodes chords, bubbly blips, soft clap, light, endless, D major, 124 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, heavy bass, aggressive
```
- 保存名 → `bgm/uibgm/timeline.mp3`

---
---

# 🥉 P2 ＝ 仕上げ（3曲）

## T12 温泉「うろこ湯」

**Title**
```
Uroko Hot Spring
```
**Styles**
```
hot spring relaxation, koto, shakuhachi, water droplet percussion, low strings, wooden bucket clacks, steam pad, slow, soothing, D major, 72 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, drums, upbeat
```
- 保存名 → `bgm/uibgm/onsen-uroko.mp3`

---

## T13 終章・絶滅メーター「淘汰のカウントダウン」

**Title**
```
Countdown of Extinction
```
**Styles**
```
creeping extinction countdown, low taiko on odd beats, detuned erhu long tones, ticking clock, church organ pedal, whisper choir, oppressive, dignified, D phrygian, 80 bpm
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, major key, cheerful, cute
```
- 保存名 → `bgm/uibgm/doom-countdown.mp3`
- 狙い：既存の最終決戦曲（絶滅のファンファーレ）の**手前**を埋める、じわじわ来る不吉。怖いより荘厳。

---

## T14 ランク7専用レース「神兎大レース」

**Title**
```
The Sacred Grand Prix
```
**Styles**
```
sacred grand prix fanfare, pipe organ, full brass, double taiko gallop, tremolo strings, temple bells, choir shouts, ceremonial, overwhelming, D mixolydian, 164 bpm, motif D F# A B
```
**Exclude**
```
vocals, lyrics, fade out ending, long intro, quiet, ambient
```
- 保存名 → `bgm/racebgm/sacred-race.mp3`
- 狙い：最上位ランクだけで鳴る格。今のレース6曲のローテには混ぜません。

---
---

# （任意）当たり音3本

Sunoは5秒の音が苦手なので、**30秒で作って頭6〜8秒を切り出す**運用にします。同じStylesを3回使い、Titleだけ変えてください。

**Styles**
```
short triumphant sting, brass hit, bells, quick decay, celebratory, D major, motif D F# A B
```
**Exclude**
```
vocals, lyrics, long intro, fade out ending, loop
```
| Title に貼る文字 | 保存名 | 用途 |
|---|---|---|
| `Rank Up Sting` | `bgm/uibgm/sting-rankup.mp3` | ランク昇格 |
| `New Dragon Sting` | `bgm/uibgm/sting-newdragon.mp3` | 新しい竜 |
| `New Chapter Sting` | `bgm/uibgm/sting-chapter.mp3` | 新章 |

---
---

# 全曲まとめ（Stylesだけ一覧・別ツールに流したい時用）

| # | Title | 保存名 |
|---|---|---|
| T1 | Toward Mount Konron | bgm/uibgm/title-konron.mp3 |
| T2 | Island Morning | bgm/homebgm/home-morning.mp3 |
| T3 | Mimi On Air | bgm/homebgm/home-onair.mp3 |
| T4 | Scent of the Odds | bgm/uibgm/bet-lobby.mp3 |
| T5 | Run Bunny Run | bgm/uibgm/documentary.mp3 |
| T6 | The Ledger of Small Days | bgm/uibgm/island-life.mp3 |
| T7 | Konron Stroll | bgm/uibgm/konron-stroll.mp3 |
| T8 | On Its Trail | bgm/uibgm/scout-stalk.mp3 |
| T9 | Nap with Poro | bgm/uibgm/poro-nap.mp3 |
| T10 | Checking the Answer | bgm/uibgm/after-race.mp3 |
| T11 | Endless Timeline | bgm/uibgm/timeline.mp3 |
| T12 | Uroko Hot Spring | bgm/uibgm/onsen-uroko.mp3 |
| T13 | Countdown of Extinction | bgm/uibgm/doom-countdown.mp3 |
| T14 | The Sacred Grand Prix | bgm/racebgm/sacred-race.mp3 |

★**ファイル名は半角英数のみ**（日本語名mp3がNFD＝分解形で保存され、ローカルもライブも404になった事故があります）。
★**1曲届くたびに結線できます**。全部揃うのを待たなくてよい作りにします。
