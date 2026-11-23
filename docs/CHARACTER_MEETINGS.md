# 第一話からの出会い

2026-11-18。第1〜5話の初対面を、人物紹介とシステム講義から、相手の仕事にミミが関わる場面へ変更。GPT-6 Astraが台本を担当し、別のGPT-6 Astraが実操作で評価する。

| 話 | 出会いの動作 | 関係の始まり |
| --- | --- | --- |
| 1・サケ | 腰掛けとスープを受け取り、丼を返す約束をする | 賭けるよう強制されず、自分の目で竜を見て、気になった竜の話を持ち帰る |
| 2・ミズ | 風にあおられた手帳を押さえ、丸印より空欄を尋ねる | 見たことと未確認を分け、読み違いも話せる相手になる |
| 3・スミカ | 書けない相談用紙から、帰り道とひと息つける場所の話へ移る | 即契約ではなく、決まらないことを持ち帰り、相談を続けられる |
| 4・マクラ | 応援旗の名前を表へ戻し、撮影条件を伝える | ミミ自身の合図で声を録る。公開や端末購入を済ませたことにはしない |
| 5・セレスティア | 石段の隣の席を空けてもらい、消えた賭場の食卓を尋ねる | 正解を乞う関係から外れ、この島の話を続ける。未来の勝者と神眼の危険は変わらない |

既存の声・衣装・表情・章条件を使用する。本文は導入を再演する別バージョンではなく、その日の補完記事とする。所持金、購入、住居、ポロ発見、実際の馬券結果を捏造しない。セレスティアは正規の伏線フラグで初対面と再会を分岐する。

再レビューで全員を穏やかな先生に均さないよう調整。ミズは自分も得をする情報交換、マクラは速い掛け声とミミ自身の合図の両立、セレスティアは心が動いても次の勝者は変わらない距離を残す。実プレイで指摘された第二話と第三話の分類指導、第二話と第五話の飛ぶ紙を拾う導入の反復も分けた。

## 読書と登場の扱い

初ホームに第一話への直接入口を置き、レースへ進む選択肢も残す。初回導入中は `_chapter_intro_N` を立てず、終了後に確定する。明示的なスキップは完了扱い。途中の再読み込みなら未読のまま再生できる。第4話の登場と第5話の終章起動も導入後に行う。過去の既読保存は保持する。

記事上部の「出会いの場面をもう一度」は会話だけを再生し、スカウト・支払い・報酬・終章起動を再実行しない。専用の場面表示と会話履歴は章導入だけに適用し、通常の短い会話の表示を変えない。履歴は送った台詞だけを表示し、未知の先の台詞を見せない。Escapeで履歴を閉じても会話をスキップしない。

本文の初読は従来のゆっくりした文字送りを維持。本文完読は別の `_story_read_N`、本文表示へ切り替えた選択は `_story_skip_N` で区別する。完読後の再読は即全文表示、前段落と左右キーを使える。初読もEnter/Space/右キーで表示済み段落を送れる。閉じ括弧や句読点を前の文字とまとめ、句点だけの独立行を防ぐ。

第五話の神眼の台詞には聞き手の反応を指定し、ミミの装いを保って驚きの表情へ変える。話し手のフォーカスはセレスティアに残し、笑った立ち絵が深刻な話に居残る不一致を防ぐ。

## 第一話の背景

`images/bg/first_meeting_gate.webp` は built-in image_gen の編集で新規作成。参照兼編集対象は `images/story/1.webp`。元画像は保持。人物入りの一枚絵は本文の絵として残し、会話には人物なしの門前とスープの背景を使い、立ち絵との二重表示を避ける。

最終プロンプト:

Use case: precise-object-edit. Asset type: portrait 2:3 background plate for the first character encounter in a premium Japanese fantasy dragon-racing visual novel. Input image 1 is the EDIT TARGET and world/lighting reference. Remove ALL people and ALL dragons, including the giant dragon, the foreground bunny girl and the standing woman, cleanly reconstructing believable architecture and street behind them. Keep the recognizable tropical volcanic island, warm sunset light, wooden stone racecourse gateway, distant harbor and colorful hillside buildings, material richness and cinematic painterly realism. Remove the large foreground written notices, betting charts and readable signs; no lettering, logos, HUD or frames. Recompose as a quiet eye-level view from a small soup stand just OUTSIDE the racecourse entrance: a plain wooden stool and a small steaming earthenware bowl on a low ledge at lower left, a partly visible communal soup pot at the extreme lower edge, open flagstone walkway across the center. Central 70 percent must be uncluttered to place two separate character sprites in front, and lower quarter fairly dark for dialogue. Warm humane late afternoon, beautiful atmospheric depth, not a war zone, no debris. This is a background-only plate: absolutely no humans, humanoids, animals, dragons, shadows shaped like people or silhouettes. Preserve the island setting and art quality of the reference. Fully opaque background.
