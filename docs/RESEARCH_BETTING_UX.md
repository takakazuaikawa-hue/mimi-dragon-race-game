# 賭け画面UXリサーチ — 投票体験を商用品質にする作法（2026-07）

対象＝聖龍爆走録ミミの賭けフロー（レース選択→出走表/オッズ→賭式→頭数選択→金額→確認→レース遷移）。
前提：**470px縦固定・コイン（無料）・賭式は単勝/複勝/ワイドの3種固定・オッズ/払戻エンジン不変**（[[race-math-immutable]]）＝表示とフローだけを変える。
出典＝国内投票アプリ（WINTICKET/TIPSTAR/JRAスマッピー/netkeiba/楽天競馬）＋海外（bet365/Sky Bet/William Hill/Racing Post/Betfair/FanDuel）＋ゲーム（ウマ娘/ダビスタ）。URLは§⑤にも集約。

---

## ① ゾーン別パターン集

### Z1. 出走表（レースカード）
- **Z1-1. 縦モバイルは「1頭=1行カード」の縦積み（パレード型）が正解、表組みはPCの遺物。**
  Racing Post Smart Viewは勝負服/馬名/騎手/オッズ/成績を1行に集め、残りを「6本の属性バー（100点満点・信号色）」に圧縮。数百件の1対1インタビューから「初心者の壁を壊しつつ玄人の判断材料を残す」形として2年かけて到達。
  → https://www.racingpost.com/news/smart-view-is-available-on-the-racing-post-app-how-to-read-the-revolutionary-new-racecard-azxP74r0pITi/
- **Z1-2. 過去成績は「直近5走の数字列（form figures）」1行が世界標準の圧縮形。**
  William Hillのquick-formは「直近5走を1行で」表示。netkeibaも「標準⇄新聞(5走)」切替＋横スワイプで密度を選ばせる。
  → https://horseracingsportsbook.com/best-apps/ ／ https://race.netkeiba.com/race/shutuba.html?race_id=202506050811
- **Z1-3. 枠色・勝負服＝走者のアイデンティティを最左端に常設する。**
  JRA馬柱は8枠の枠色が読み取りの起点。Racing Postもsilksを全行常時表示。ミミでは「竜の顔＋パーソナルカラー」がこれに相当し、番号より先に目が行ってよい。
  → https://www.jra.go.jp/JRADB/mikata/index.html ／ https://www.racingpost.com/welcome-to-racing/news/how-to-read-the-racecard/
- **Z1-4. 深いデータは展開式（progressive disclosure）でカード内に畳む。**
  WINTICKET出走表は競走得点/脚質/決まり手/直近・当場・対戦成績まで持つが、タブと展開で階層化して初期表示は薄く保つ。
  → https://keirin-brother.com/touhyou-site/win-ticket/

### Z2. オッズ提示
- **Z2-1. オッズの数字は「読む値」ではなく「押せるボタン」にする（tap-odds-to-slip）。**
  bet365は出走表の分析からワンタップで買い目へ直行＝「分析と購入の間に画面遷移なし」。楽天競馬も「オッズ投票」画面が最も速い経路と評価。
  → https://horse.bet/bet365-horse-racing/ ／ https://app-liv.jp/2751114/
- **Z2-2. 人気順ソートと人気番号の明示は初心者の羅針盤。**
  WINTICKETオッズタブは「人気順」と「オッズ表」を併設。JRAスマッピーにも「人気順選択方式」がある。
  → https://keirin-brother.com/touhyou-site/win-ticket/ ／ https://www.jra.go.jp/kouza/qrbet/howto_odds.html
- **Z2-3. オッズ変動は色フラッシュ＋矢印のマイクロ演出（上げ=緑/下げ=赤）で「生きている数字」に。**
  Betfairは直近成立価格を黄色で示し、上昇で緑・下落で赤に点滅。ライブ系UXでも「色の微細なフラッシュで変化を知らせる」が定石。パリミュチュエルの「締切まで動く」実感の演出に直結（エンジンは触らず表示だけで可能）。
  → https://betting.betfair.com/how-to-use-betfair-exchange/beginner-guides/reading-the-betfair-screen-010819-51.html ／ https://altenar.com/blog/how-to-design-a-sportsbook-user-experience-ux-that-wins-in-live-play/
- **Z2-4. 発走までのカウントダウン（MTP）をヘッダーに常設する。**
  FanDuel/TVGは「Races starting soon」にMTP（Minutes To Post）を常時表示。本物の締切なので偽の緊急性にならず倫理的にも正当——ただし残り僅少時の色変化までにし、パニック点滅はさせない。
  → https://www.fanduel.com/tvg ／ https://medium.com/design-bootcamp/the-stress-of-countdown-clocks-understanding-panic-inducing-timers-in-ux-psychology-b8d1a6333691

### Z3. 賭式選択
- **Z3-1. 賭式は1タップ切替のセグメント、選択状態は「チェック＋色」で明示。**
  WINTICKETは賭式ボタン押下で「チェックマーク表示＋色変化」。3種固定のミミなら常設セグメント3択（単勝/複勝/ワイド）が最短。
  → https://www.winticket.jp/support/bet
- **Z3-2. 賭式を切り替えても選択と金額を捨てない（やり直しゼロ）。**
  WINTICKETは「賭式や金額を変える際に都度戻ってやり直す必要がない」「3連単と3連複を同時に投票できる」ことがユーザー評価の核。
  → https://app-liv.jp/5302973/
- **Z3-3. 各賭式に8語以内のサブラベルを常設（専門用語＝新規の壁）。**
  Racing Postの研究結論は「従来出走表の専門性が新規ファンの参入障壁」。ワイド=「2頭えらぶ・両方3着以内」を選択画面に書き続ける。
  → https://www.racingpost.com/welcome-to-racing/news/smart-view/

### Z4. 2頭選択（ワイド）
- **Z4-1. 行のチェック（タップ）で頭を選ぶ→選び切ると買い目が下に「生成」される2段構え。**
  WINTICKET/スマッピーとも「選手にチェック→対象の組合せが下に表示→不要を外す→かごに追加」。ワイド2頭なら「2頭タップで買い目カードが出現」が最短翻訳。
  → https://www.winticket.jp/support/bet ／ https://www.jra.go.jp/kouza/qrbet/howto_odds.html
- **Z4-2. 選択のたび、その組合せのオッズを即時提示する。**
  スマッピーは「チェックすると各買い目のオッズが自動計算」。選ぶ→数字が返る、の往復が予想の楽しさ本体。
  → https://www.jra.go.jp/kouza/qrbet/howto_odds.html
- **Z4-3. ボックス/ながし/フォーメーション等の「方式」レイヤーは、3賭式・少頭数なら持ち込まない。**
  方式は多点買いのための追加抽象で、国内アプリでも初心者講座が必要な難所。ミミは直接タップ2頭で足りる＝1階層削れる。
  → https://keirin-brother.com/method/wide/

### Z5. 金額入力
- **Z5-1. プリセットチップ（+100/+500/+1000/全额系）＋例外用テンキー、が成熟モバイルの証。**
  「quick-stakeボタン（€5/€10/€20/custom）＋stake込みの払戻総額表示＋1タップ確定」が最良ベットスリップの要件とされる。
  → https://bet-worldwide.com/blog/best-apps-bet-sports-user-experiences ／ https://oddsmatrix.com/betting-user-experience/
- **Z5-2. 単位の割り切りで打鍵数を減らす（スマッピーは「1」=100円）。**
  JRA公式ツールは100円単位入力に割り切る。コイン経済なら最小ベット単位=チップ最小刻みに揃え、手入力を例外経路に。
  → https://www.jra.go.jp/kouza/qrbet/howto.html
- **Z5-3. 「一括」と「1件ごと」の2モード（複数買い目時）。**
  WINTICKET投票ボックスは上段で一括入力→「展開する」で買い目別入力。スマッピーは一括/1件ごと/予算の3方式。ワイド＋単勝を同時に持つミミにそのまま効く。
  → https://www.winticket.jp/support/bet ／ https://www.jra.go.jp/kouza/qrbet/howto.html
- **Z5-4. 金額を動かすたび「的中時払戻（見込み）」を最大級の数字で即時更新。**
  potential returnの即時表示はベットスリップの第一要件。パリミュチュエルは「確定は締切時」の1行注記で正直に（表示のみ・エンジン不変）。
  → https://oddsmatrix.com/betting-user-experience/

### Z6. ベットスリップ（投票かご）
- **Z6-1. 画面下部の常駐スリップ：選択が入るとバーが浮上→タップでボトムシート展開。**
  sticky bottom slipは親指圏＋「選択を見失わない」の両取りでモバイル定石。WINTICKETも下部ナビ中央の緑丸「投票シート」を一段浮かせて常設。
  → https://medium.com/@adelinabutler684/mobile-first-sportsbook-design-ux-best-practices-for-higher-retention-2eac17dcb435 ／ https://note.com/kunio_terada/n/n08e832cebb9a
- **Z6-2. 「かごに追加」と「投票確定」は別ボタン（2段階）でミスを構造的に防ぐ。**
  WINTICKETは追加≠確定。追加で編集自由、確定で締める。
  → https://www.winticket.jp/support/bet
- **Z6-3. スリップ内で編集が完結する（削除・金額変更・賭式跨ぎの同居）。**
  bet365は複数賭式・組合せベットでも「複数画面を強制しない」。空のときは「買い目を選択してください」の空状態文言で次の一手を教える（WINTICKET）。
  → https://horseracingsportsbook.com/best-apps/ ／ https://note.com/kunio_terada/n/n08e832cebb9a

### Z7. 確認
- **Z7-1. 確認は「選択（顔＋名前）＋賭式＋金額＋的中時払戻」を1カードに集約、確定は1タップ。**
  「コミット前にstake/returnsのリアルタイムプレビュー」「確認ポップアップで誤投票防止」が定石。
  → https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/
- **Z7-2. 少額は確認スキップのquick-bet（設定でON/OFF）も正当。**
  FanDuelは一定額以下を1タップ投票にするトグルでin-play投票が27%増。実害ゼロのゲームでは既定ONも検討可。
  → https://symphony-solutions.com/insights/sportsbook-ux
- **Z7-3. 実マネーの儀式（PIN・法定文言・残高規制）は落とし、「取消不可」だけ正直に残す。**
  WINTICKETの確定はPIN入力必須＝実弾ゆえの摩擦で、ゲームには不要。代わりに完了トースト＋「投票券」半券演出で満足感を返す。
  → https://www.winticket.jp/support/bet

### Z8. 遷移（レース選択→投票→レース）
- **Z8-1. 「静とワクワク」の二相設計：予想中=静（落ち着いた色調・明快な情報設計）、レース/的中=動（インパクト演出）。**
  TIPSTAR刷新の中核思想。全画面をずっと騒がしくしない——投票画面は紙のように静かでよい。
  → https://cocoda.design/yukilogo/p/p35633f4b680a
- **Z8-2. 出走表⇄投票シートの往復を最短化し、ホームから投票まで直行させる。**
  TIPSTARリニューアルは「ホームからすぐ投票」「出走表と投票シート/カートの行き来をスムーズに」を明記した改善点に据えた。
  → https://prtimes.jp/main/html/rd/p/000000678.000025121.html
- **Z8-3. 発走前は「人気順の出走紹介＋ファンファーレ」で期待を溜める。**
  ウマ娘は前口上で出走者を人気順に紹介、ダビスタは本物のJRAファンファーレ採用＝「賭けたからこそ熱く見守る」の増幅装置。
  → https://umamusume.wikiru.jp/index.php?SandBox%2F%E3%82%B4%E3%83%BC%E3%83%AB%E5%AE%9F%E6%B3%81= ／ https://tagosaku88.com/comparison-dabisuta-uipo/
- **Z8-4. 自分の買い目をレース画面へ「持ち込む」（あなたの賭けオーバーレイ）。**
  TIPSTARはライブ映像に皆の賭けが同居し観戦を参加型に変える。買い目の竜がレース中も一目で追えること＝遷移の連続性（[[screen-transition-continuity]]）。
  → https://news.livedoor.com/article/detail/18755765/

---

## ② 名指しの模範例

1. **WINTICKET（競輪/オート）** — 国内投票フローの完成形：賭式チェック→選手選択→買い目生成→投票かご→一括/個別金額→確定。複数賭式の同時保持・やり直しゼロ・下部ナビ中央の「投票シート」常設・空状態の誘導文言まで行き届く。「若者がスマホで楽しむエンタメ」への転換例。→ https://www.winticket.jp/support/bet ／ https://note.com/kunio_terada/n/n08e832cebb9a
2. **TIPSTAR（MIXI）** — ゲームとギャンブルの橋そのもの：無料メダル二重通貨・のっかりベット（他人の予想に回収率/的中実績/収支グラフ付きで乗る）・ライブ映像と賭けの同居。2025刷新で黒基調＋「静とワクワク」二相へ。→ https://cocoda.design/yukilogo/p/p35633f4b680a ／ https://mikocha.com/tipstar/
3. **Racing Post「Smart View」** — 出走表の再発明：silks＋名前＋オッズは残し、深いデータを「6本の100点バー（信号色）」へ視覚化。「人でなくシステムが採点している方が信頼される」というリサーチ知見つき。→ https://www.racingpost.com/news/smart-view-is-available-on-the-racing-post-app-how-to-read-the-revolutionary-new-racecard-azxP74r0pITi/
4. **bet365 Racing** — 密度と速度の王：出走表から買い目までワンタップ・巨大オッズボタン・スリップ内で複合ベット完結・低遅延ストリーム。美観より機能で信頼を作る例。→ https://horseracingsportsbook.com/best-apps/
5. **Sky Bet** — 「英国で最も美しい投票アプリ」評：抑制されたパレット・余白のある racecard・大きなタップ領域。密度を上げずに上質感を出す手本。→ https://horseracingsportsbook.com/best-apps/
6. **Betfair Exchange** — オッズが生きている感の頂点：直近成立価格が黄→上げ緑/下げ赤で点滅、板の深さまで見せる。ミミでは「締切までオッズが動く」演出の参照元。→ https://betting.betfair.com/how-to-use-betfair-exchange/beginner-guides/reading-the-betfair-screen-010819-51.html
7. **JRAスマッピー** — 割り切りの美学：100円単位（「1」=100円）・金額3方式（1件ごと/一括/予算）・チェック→買い目生成。公営の「間違えさせない」設計。→ https://www.jra.go.jp/kouza/qrbet/howto.html
8. **ウマ娘 プリティーダービー** — ゲームUIの骨格見本：全画面共通の4ゾーン構造（固定ヘッダ/可変サブ/親指圏メイン/固定フッタ）と情報整理5手順（抽出→分類→階層→関連→変化）。「迷わず高速周回」の作法。→ https://game.watch.impress.co.jp/docs/kikaku/1366165.html

---

## ③ このゲームへの設計原則（470px縦・コイン・3賭式固定・エンジン不変・コメディ世界観）

1. **画面骨格は4ゾーン固定**（ウマ娘式）：上=レースヘッダ（レース名/距離/締切カウントダウン）、中=出走カードリスト（スクロール）、下=常駐スリップバー、最下=確定CTA。全賭け画面で不変。
2. **1竜=1行カード**：顔アイコン＋パーソナルカラー帯（枠色相当）＋名前＋調子（絵文字/バー）＋単勝オッズボタン。詳細（戦績5走・コメント）はタップ展開。470pxで表組みは組まない。
3. **オッズは全部ボタン**：単勝オッズを押せばその竜の単勝が、複勝タブなら複勝が、即スリップに入る。「分析→購入」の画面遷移をゼロに。
4. **賭式は常設セグメント3択＋8語サブラベル**（単勝「1着をあてる」/複勝「3着以内」/ワイド「2頭とも3着以内」）。切替で選択・金額を破棄しない。
5. **ワイドは「2頭タップ→買い目カード出現」**：方式（ボックス等）レイヤーは導入しない。1頭目選択時に「あと1頭」と明示、2頭目で組オッズを即表示。
6. **金額はコインチップ主導**（+10/+100/+500/倍/MAX等、経済定数はdocs/GAME_DESIGN_NUMBERSに従う）＋長押し/テンキーは例外経路。親指圏（下1/3）に置く。
7. **「的中なら◯◯コイン」を入力と同時に最大の数字で更新**。パリミュチュエルなので「オッズは締切で確定」を小さく1行——数値はエンジンの現在値をそのまま表示するだけ（不変則遵守）。
8. **締切カウントダウンをヘッダー常設**、残りわずかで色相だけ変える。偽の急かし・点滅はしない（実際の締切があるので正当な緊張感で足りる）。
9. **静→動の二相**：出走表〜金額入力は静（紙・整った情報）、投票確定の瞬間から音・モーション解禁、発走演出（人気順紹介＋ファンファーレ）で最高潮へ。
10. **竜の「推し」を一級UIに**：顔・色・調子・ひとことコメント（コメディの人格）をオッズより先に見せてよい。データは竜を選ぶ理由の脇役。silks文化の翻訳。
11. **実マネー儀式は全部落とす**（PIN/年齢/残高規制文言）。残すのは「取消不可」の正直な一言と、確認1カード（顔＋賭式＋金額＋見込み払戻）→完了は投票券半券の演出。
12. **買い目をレースへ運ぶ**：確定した買い目（竜の顔＋賭式＋金額）をレース画面のオーバーレイに常駐させ、視線アンカーを切らさない。的中判定の瞬間はその半券が光る。

---

## ④ デザイン方向性・3案

### A案「モダン投票アプリ」型（WINTICKET/TIPSTAR系）
- **骨子**：白or淡色ベースのカードUI。ヘッダ=レース情報＋締切、中央=1竜1行カード（顔/色/調子/オッズボタン）、下部=浮上式スリップバー→ボトムシート展開。
- **スリップ**：かご型（追加⇄確定の2段階）。チップ金額入力＋見込み払戻の大数字。
- **強み**：国内で実証済みの投票UX・学習コスト最小・470px縦と最も相性が良い・実装が既存DOM構造の延長で済む。
- **弱み**：素のままだと無機質でコメディ世界観が乗りにくい→色・文言・竜の顔で味付け必須。

### B案「海外ブックメーカー・オッズボード」型（bet365/Betfair系）
- **骨子**：ダーク地に発光する数字ボタンのグリッド。オッズ変動フラッシュ（緑/赤）・板っぽい密度・silks的な竜エンブレム。
- **スリップ**：フローティングバッジ→ドロワー展開。quick-bet（確認スキップ）標準。
- **強み**：「本物の賭博場」の熱と高級感・オッズが主役なので変動演出が最も映える・夜のレース場と好相性。
- **弱み**：470pxでは密度過多になりやすい・英字文化の直訳感・明るいコメディ世界観と衝突しがち・初心者の壁が最も高い。

### C案「聖龍日報×実況中継」ハイブリッド型（競馬新聞×ゲーム演出）
- **骨子**：出走表=新聞紙面（既存の聖龍日報様式＝明朝/紙地/二重罫/網点の竜写真）で世界観に没入→賭け操作はその上の「窓口」メタファのモダンレイヤー→締切で紙面が「実況中継」へ放送切替する遷移演出。
- **スリップ**：画面下の「投票券」が物理チケットとして育つ（選ぶたび印字が増える）→確定でスタンプ→レースへ半券を持ち込む。
- **強み**：既存アート資産（聖龍日報）と直結し独自性最大・「券」メタファで確認/的中が直感的・静(紙)→動(放送)の二相が構造として内蔵される。
- **弱み**：新聞密度と可読性の両立が難題（Racing Postが2年かけた領域）・印字/放送切替の実装コストが3案中最大・タップ領域を紙面装飾が圧迫しやすい。

**推奨**：**A案を骨格に、C案の演出資産（投票券・新聞見出し・放送切替）を段階導入**。操作系（カードリスト/セグメント/チップ/かご）は実証済みのAで固め、世界観はCの「券と紙」で纏う。Bは470pxの制約とコメディ調に合わず、変動フラッシュ等の部品だけ拝借する。

---

## ⑤ 出典一覧

- WINTICKET 投票ヘルプ（公式・投票フロー全段）: https://www.winticket.jp/support/bet
- WINTICKET UI模写ノート（画面構造/投票シート/空状態）: https://note.com/kunio_terada/n/n08e832cebb9a
- WINTICKET 使い方イラスト解説（出走表/オッズ/AI予想）: https://keirin-brother.com/touhyou-site/win-ticket/
- WINTICKET レビュー（同時投票・やり直しゼロ評価）: https://app-liv.jp/5302973/
- TIPSTAR デザイン刷新の記録（静とワクワク・デザインシステム）: https://cocoda.design/yukilogo/p/p35633f4b680a
- TIPSTAR フルリニューアル発表（黒基調・出走表⇄カート）: https://prtimes.jp/main/html/rd/p/000000678.000025121.html
- TIPSTAR 体験レビュー（メダル/のっかり/ゲーム感）: https://mikocha.com/tipstar/ ／ https://news.livedoor.com/article/detail/18755765/
- JRA スマッピー基本の購入（100円単位・金額3方式）: https://www.jra.go.jp/kouza/qrbet/howto.html
- JRA スマッピー・オッズを見ながらの購入: https://www.jra.go.jp/kouza/qrbet/howto_odds.html
- JRA 馬柱の見方（枠色・出馬表要素）: https://www.jra.go.jp/JRADB/mikata/index.html
- netkeiba 出馬表（標準⇄新聞5走切替の実例）: https://race.netkeiba.com/race/shutuba.html?race_id=202506050811
- 楽天競馬 レビュー（オッズ投票の速さ）: https://app-liv.jp/2751114/
- Racing Post Smart View 解説（属性バー/リサーチ過程）: https://www.racingpost.com/news/smart-view-is-available-on-the-racing-post-app-how-to-read-the-revolutionary-new-racecard-azxP74r0pITi/ ／ https://www.racingpost.com/welcome-to-racing/news/smart-view/
- 英国競馬アプリ実測比較（bet365/Sky Bet/WH/Betfair等の racecard・スリップ評）: https://horseracingsportsbook.com/best-apps/
- bet365 Racing レビュー（tap-to-slip・分析→購入直結）: https://horse.bet/bet365-horse-racing/
- Betfair 画面の読み方（黄/緑/赤の価格変動表示）: https://betting.betfair.com/how-to-use-betfair-exchange/beginner-guides/reading-the-betfair-screen-010819-51.html
- FanDuel/TVG（MTPカウントダウン）: https://www.fanduel.com/tvg
- Sportsbook UX（quick-bet 27%・マイクロ演出）: https://symphony-solutions.com/insights/sportsbook-ux ／ https://altenar.com/blog/how-to-design-a-sportsbook-user-experience-ux-that-wins-in-live-play/
- ベットスリップ定石（quick-stake/払戻表示/1タップ確定）: https://bet-worldwide.com/blog/best-apps-bet-sports-user-experiences ／ https://oddsmatrix.com/betting-user-experience/ ／ https://prometteursolutions.com/blog/user-experience-and-interface-in-sports-betting-apps/
- モバイル・スポーツベットUX（sticky bottom slip）: https://medium.com/@adelinabutler684/mobile-first-sportsbook-design-ux-best-practices-for-higher-retention-2eac17dcb435
- カウントダウンの心理学（偽の緊急性を避ける）: https://medium.com/design-bootcamp/the-stress-of-countdown-clocks-understanding-panic-inducing-timers-in-ux-psychology-b8d1a6333691
- ウマ娘 UI設計の根幹（GAME Watch・4ゾーン/情報整理5手順）: https://game.watch.impress.co.jp/docs/kikaku/1366165.html
- ウマ娘 レース前口上（人気順紹介）: https://umamusume.wikiru.jp/index.php?SandBox%2F%E3%82%B4%E3%83%BC%E3%83%AB%E5%AE%9F%E6%B3%81=
- ダビスタ×ウイポ比較（馬券があるから熱い・本物ファンファーレ）: https://tagosaku88.com/comparison-dabisuta-uipo/
- 競輪ワイドの買い方（方式レイヤーの複雑さ）: https://keirin-brother.com/method/wide/

※本文中の主要主張（WINTICKET投票フロー・TIPSTAR二相思想・Smart View属性バー・Betfair色表示・スマッピー金額方式・ウマ娘4ゾーン・英アプリ比較）は原文フェッチで確認済み。それ以外の一部（quick-bet 27%等）は検索結果要約ベース。
