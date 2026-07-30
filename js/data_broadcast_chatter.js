// =============================================================================
// data_broadcast_chatter.js — 解説の雑談・うんちくの引き出し
// =============================================================================
// ★なぜ要るか（実測）
//   局面ごとに解説者1人あたり台詞が1本しかなかったため、同じ人が担当すると
//   毎回そっくり同じことを喋っていた。120レース測ったところ、
//   連続する2レースで解説の中身が約50%重なっていた（マクラは述べ239行で
//   実際は38種類しかなかった）。「毎回違う解説が入るように」という要望は
//   ここを埋めることで満たす。
//
// ★ここに入れるもの
//   竜のうんちく／レース場と地域／島と町／島の歴史／グルメ／天気／
//   そして「ただの世間話」。くしゃみ、風邪気味、母がカレーを作っている、
//   意味の分からないダジャレ。情報ではない行も等しく価値がある。
//
// ★守ること
//   ・賭けの当たり外れには触れない（レース中も決着後も）
//   ・レース展開の説明はしない。それは実況と既存の解説行の仕事
//   ・未登場のキャラの名前は出さない（門番を通せない話題は書かない）
//
// ★増やし方（1行足すだけ）
//   { id: 一意の名前, cm: 解説者, topic: 話題, at: 出す場所, line: 台詞 }
//   region を書けばその地域のレースだけ、weather を書けばその天気だけ。
//
//   cm     … sake / mizu / sumika / makura / celestia / unme
//   topic  … dragon（竜）/ course（レース場）/ island（島と町）/
//            history（島の歴史）/ gourmet（食）/ life（世間話・体調・家族）/
//            pun（ダジャレ）
//   at     … entry（パレード中）/ mid（中盤の谷）
// =============================================================================

// 持ち球を一巡するまで同じ台詞を出さない仕組みなので、この本数は目安。
// （検査が「用意した本数に対してどれだけ出たか」を見るのに使う）
const BC_CHATTER_WINDOW = 40;

const BC_CHATTER = [
  { id: "sumika_dragon_01", cm: "sumika", topic: "dragon", at: "entry", line: "竜の鱗は月に一度、乾いた布で拭くとよく持ちます。" },
  { id: "sumika_dragon_02", cm: "sumika", topic: "dragon", at: "entry", line: "竜も人と同じで、寝不足の日は瞳の艶が違うのでございます。" },
  { id: "sumika_dragon_03", cm: "sumika", topic: "dragon", at: "entry", line: "竜の爪は伸びすぎると本人が痛がります。手入れが肝心ですね。" },
  { id: "sumika_dragon_04", cm: "sumika", topic: "dragon", at: "mid", line: "翼の付け根は汗をかきやすく、洗うのが大変でございます。" },
  { id: "sumika_dragon_05", cm: "sumika", topic: "dragon", at: "entry", line: "竜の食事量は体重の一割ほど。台所を預かる身には恐ろしい話です。" },
  { id: "sumika_dragon_06", cm: "sumika", topic: "dragon", at: "mid", line: "抜けた鱗は磨いて鍋敷きに。捨てるところがございません。" },
  { id: "sumika_dragon_07", cm: "sumika", topic: "dragon", at: "mid", line: "竜の吐息で乾かした洗濯物は、少し焦げた匂いがいたします。" },
  { id: "sumika_dragon_08", cm: "sumika", topic: "dragon", at: "mid", line: "気性の荒い竜ほど、撫でられると存外おとなしくなるものですね。" },
  { id: "sumika_dragon_09", cm: "sumika", topic: "dragon", at: "entry", line: "竜の寿命は人の三倍ほど。長く付き合う相手でございます。" },
  { id: "sumika_dragon_10", cm: "sumika", topic: "dragon", at: "mid", line: "冬毛の抜けかわる季節は、厩舎の掃除が三倍になります。ご苦労さま。" },
  { id: "sumika_course_01", cm: "sumika", topic: "course", at: "entry", region: "グランドクロック地域", line: "真鍮の柵は指紋が目立ちますから、毎朝磨いておいでのようですね。" },
  { id: "sumika_course_02", cm: "sumika", topic: "course", at: "entry", region: "ルミナ地域", line: "光が強い日は日焼けいたします。日傘をお持ちになると安心です。" },
  { id: "sumika_course_03", cm: "sumika", topic: "course", at: "mid", region: "リングロッソ地域", line: "赤と黒の砂は服につくと落ちません。白い上着はお控えくださいませ。" },
  { id: "sumika_course_04", cm: "sumika", topic: "course", at: "entry", region: "カルデラ地域", line: "灰が降りますから洗濯物は室内に。お帰りは肩を払ってくださいませ。" },
  { id: "sumika_course_05", cm: "sumika", topic: "course", at: "mid", region: "ミストレイク地域", line: "霧の日は喉を痛めます。温かいものを一口いかがでございましょう。" },
  { id: "sumika_course_06", cm: "sumika", topic: "course", at: "mid", region: "ヴェント峡谷地域", line: "風が強うございます。帽子は手にお持ちになるのが賢明ですね。" },
  { id: "sumika_course_07", cm: "sumika", topic: "course", at: "mid", region: "ノッテムーンライト地域", line: "夜露で足元が滑ります。靴の裏をよくご覧になってくださいませ。" },
  { id: "sumika_course_08", cm: "sumika", topic: "course", at: "entry", region: "ラパン祭典地域", line: "金色の紙吹雪は掃除が本当に大変です。係の皆さま、お疲れさま。" },
  { id: "sumika_course_09", cm: "sumika", topic: "course", at: "entry", line: "観客席の板は年に一度、油を塗り直すのだと伺っております。" },
  { id: "sumika_course_10", cm: "sumika", topic: "course", at: "mid", line: "どの会場も水飲み場の位置を覚えておくと、後が楽でございますよ。" },
  { id: "sumika_island_01", cm: "sumika", topic: "island", at: "entry", line: "港町の乾物屋は昼過ぎに値が下がります。家計が助かりますね。" },
  { id: "sumika_island_02", cm: "sumika", topic: "island", at: "mid", line: "島の水は硬うございます。お茶は少し長めに蒸らすのがよろしいかと。" },
  { id: "sumika_island_03", cm: "sumika", topic: "island", at: "mid", line: "坂の多い町ですから、履き慣れた靴でお出かけくださいませ。" },
  { id: "sumika_island_04", cm: "sumika", topic: "island", at: "entry", line: "島の市場は三日に一度立ちます。買い出しはその日に済ませますね。" },
  { id: "sumika_island_05", cm: "sumika", topic: "island", at: "mid", region: "ミストレイク地域", line: "古い井戸のある通りは、夏でもひんやりして過ごしやすいのです。" },
  { id: "sumika_island_06", cm: "sumika", topic: "island", at: "entry", line: "島の郵便は船待ちですから、返事は気長にお待ちいただくものですね。" },
  { id: "sumika_island_07", cm: "sumika", topic: "island", at: "mid", line: "潮風で金具が錆びますので、鍵は月に一度油をひいております。" },
  // ★終章（三頭同着）の伏線＝環境音の層。レース中にふと耳に入って「聞いたことがある」の下地を作る。
  //   ⚠️この表には「賭けの当たり外れに触れない」規約があり、tools/audit_broadcast.js が
  //   /あなたの(一票|予想|賭け|竜)|賭け(た|金|竜)|的中|払戻/ を検出する。だから「払い戻し」等は
  //   使わず、**帳場が止まった／数字が入っていない頁**という情景だけで同じことを伝える。
  { id: "mizu_history_deadheat_01", cm: "mizu", topic: "history", at: "entry", line: "同着の日はね、配当が1.0倍になるのよ。この島の、古い決まり。" },
  { id: "mizu_history_deadheat_02", cm: "mizu", topic: "history", at: "mid", line: "同着は竜の名誉にも勝敗にもならない。……だから、増えも減りもしないの。" },
  { id: "makura_history_deadheat_01", cm: "makura", topic: "history", at: "mid", line: "一着がならぶと1.0倍なんだってさ。勝ちも負けもナシ、って決まりらしいよ。" },
  { id: "sumika_history_01", cm: "sumika", topic: "history", at: "entry", line: "この島の会場は、もともと荷揚げの広場だったと伺っております。" },
  { id: "sumika_history_02", cm: "sumika", topic: "history", at: "entry", line: "昔は竜に荷を運ばせておりました。走らせるのは後の話でございます。" },
  { id: "sumika_history_03", cm: "sumika", topic: "history", at: "mid", line: "百年前の大火の後、屋根はすべて瓦に替えられたそうでございます。" },
  { id: "sumika_history_04", cm: "sumika", topic: "history", at: "mid", line: "古い記録では、島の祭りは収穫を祝うものだったとか。" },
  { id: "sumika_history_05", cm: "sumika", topic: "history", at: "entry", region: "リングロッソ地域", line: "先代の頃は木の柵でしたが、竜が壊すので鉄になったと聞きます。" },
  { id: "sumika_history_06", cm: "sumika", topic: "history", at: "entry", region: "グランドクロック地域", line: "島に時計が来たのは思いのほか新しく、祖母の代のことでございます。" },
  { id: "sumika_history_07", cm: "sumika", topic: "history", at: "mid", line: "昔の厩務員は素手で鱗を磨いたそうで。手が荒れたでしょうに。" },
  { id: "sumika_gourmet_01", cm: "sumika", topic: "gourmet", at: "entry", line: "干し杏は日持ちがいたします。旅の折には二つ三つ、鞄へ入れますね。" },
  { id: "sumika_gourmet_02", cm: "sumika", topic: "gourmet", at: "mid", line: "屋台の汁物は塩が濃うございます。水を一杯添えるとちょうどよいかと。" },
  { id: "sumika_gourmet_03", cm: "sumika", topic: "gourmet", at: "mid", region: "カルデラ地域", line: "島の芋は蒸すより地熱で焼くほうが甘くなります。手間もかかりません。" },
  { id: "sumika_gourmet_04", cm: "sumika", topic: "gourmet", at: "entry", line: "梅の塩漬けは三年物が一番でございます。急がずお待ちくださいませ。" },
  { id: "sumika_gourmet_05", cm: "sumika", topic: "gourmet", at: "mid", line: "焦げた鍋は重曹で煮ると落ちます。捨てるのはまだ早うございますよ。" },
  { id: "sumika_gourmet_06", cm: "sumika", topic: "gourmet", at: "mid", line: "冷めた握り飯は、軽く炙るだけで見違えるものでございます。" },
  { id: "sumika_gourmet_07", cm: "sumika", topic: "gourmet", at: "entry", line: "残った野菜は酢に漬けておきますと、翌週まで持ってくれますね。" },
  { id: "sumika_life_01", cm: "sumika", topic: "life", at: "entry", line: "この時期は膝が痛みます。年を重ねるとは、そういうことですね。" },
  { id: "sumika_life_02", cm: "sumika", topic: "life", at: "mid", line: "うちの坊ちゃんが、また靴下に穴を開けてお戻りになりました。" },
  { id: "sumika_life_03", cm: "sumika", topic: "life", at: "mid", line: "繕い物は日の高いうちに。夜は針の穴が見えないのでございます。" },
  { id: "sumika_life_04", cm: "sumika", topic: "life", at: "entry", line: "奥さまが今日はよく眠れたと仰っておりました。何よりでございます。" },
  { id: "sumika_life_05", cm: "sumika", topic: "life", at: "entry", line: "疲れは湯より眠りで取るものです。皆さまも早めにお休みくださいませ。" },
  { id: "sumika_life_06", cm: "sumika", topic: "life", at: "mid", line: "隣の家の物干し竿が、今朝から傾いたままなのが気になっております。" },
  { id: "sumika_life_07", cm: "sumika", topic: "life", at: "mid", line: "お茶を淹れる湯は、沸かしてから少し置くのがよろしいのですよ。" },
  { id: "sumika_life_08", cm: "sumika", topic: "life", at: "entry", line: "買い出しの帰りは荷が重うございます。二度に分けるのが正解ですね。" },
  { id: "sumika_life_09", cm: "sumika", topic: "life", at: "mid", line: "肩が凝りましたら、湯に浸した布を当てるだけでも違います。" },
  { id: "sumika_life_10", cm: "sumika", topic: "life", at: "entry", line: "口うるさいと言われますが、皆さまが息災なら私はそれで結構です。" },
  { id: "sumika_pun_01", cm: "sumika", topic: "pun", at: "mid", line: "竜の尾を掴むと申しますが、洗うと縮みます。……失礼いたしました。" },
  { id: "sumika_pun_02", cm: "sumika", topic: "pun", at: "mid", line: "布団が吹っ飛びました。……いえ、干していただけでございます。" },
  { id: "sumika_pun_03", cm: "sumika", topic: "pun", at: "entry", line: "母が今夜はカレーだと申しておりました。……楽しみでございます。" },
  { id: "sumika_pun_04", cm: "sumika", topic: "pun", at: "mid", line: "……くしゅん。失礼いたしました。埃が立っておりますね。" },
  { id: "makura_dragon_01", cm: "makura", topic: "dragon", at: "entry", line: "竜の鱗って光でめっちゃ色変わるじゃん。何回見てもヤバいって。" },
  { id: "makura_dragon_02", cm: "makura", topic: "dragon", at: "mid", line: "竜のあくび見たことある？口でかすぎて逆に笑うんだって。" },
  { id: "makura_dragon_03", cm: "makura", topic: "dragon", at: "entry", line: "竜って耳いいらしくて、会場の音量ちゃんと分かってるんだって。" },
  { id: "makura_dragon_04", cm: "makura", topic: "dragon", at: "entry", line: "翼のばさっていう音、あれマイクに乗るとマジで気持ちいいんだよ。" },
  { id: "makura_dragon_05", cm: "makura", topic: "dragon", at: "mid", line: "竜の目、近くで見ると宝石じゃん。え、待って、盛ってないって。" },
  { id: "makura_dragon_06", cm: "makura", topic: "dragon", at: "mid", line: "でかい竜ほど寝相ひどいらしいよ。映像で見た。ほんと無理。" },
  { id: "makura_dragon_07", cm: "makura", topic: "dragon", at: "mid", line: "竜の鳴き声って地面に響くんだって。腹に来るやつ。すご。" },
  { id: "makura_dragon_08", cm: "makura", topic: "dragon", at: "entry", line: "竜の背中の熱、冬はストーブ代わりになるらしい。飼いたすぎって。" },
  { id: "makura_dragon_09", cm: "makura", topic: "dragon", at: "mid", line: "竜が首かしげるやつ、あれ絶対こっちのこと分かってるって。" },
  { id: "makura_dragon_10", cm: "makura", topic: "dragon", at: "entry", region: "リングロッソ地域", line: "竜の爪の跡、壁に残ってるとこあるじゃん。あれ映えるんだよな。" },
  { id: "makura_course_01", cm: "makura", topic: "course", at: "entry", region: "グランドクロック地域", line: "この真鍮の柱、光が回ると全部金に見えるんだって。撮り放題じゃん。" },
  { id: "makura_course_02", cm: "makura", topic: "course", at: "entry", region: "ルミナ地域", line: "空色の壁がさ、昼と夕方で別物になるの。夕方来たほうが絶対いい。" },
  { id: "makura_course_03", cm: "makura", topic: "course", at: "mid", region: "リングロッソ地域", line: "ここの歓声、赤い壁に反射して倍になるんだよ。耳やられるって。" },
  { id: "makura_course_04", cm: "makura", topic: "course", at: "mid", region: "カルデラ地域", line: "溶岩の赤が下から照らしてくるの。もう画面が勝手に仕上がるじゃん。" },
  { id: "makura_course_05", cm: "makura", topic: "course", at: "mid", region: "ミストレイク地域", line: "霧でさ、向こうの席が見えないの。逆にエモいって、これは。" },
  { id: "makura_course_06", cm: "makura", topic: "course", at: "mid", region: "ヴェント峡谷地域", line: "風で帽子飛ばされてる人いた。あれ毎回起きてるらしいよ。" },
  { id: "makura_course_07", cm: "makura", topic: "course", at: "entry", region: "ノッテムーンライト地域", line: "月とここの照明、色そろえてるんだって。凝りすぎでしょ。" },
  { id: "makura_course_08", cm: "makura", topic: "course", at: "mid", region: "ラパン祭典地域", line: "金の紙吹雪でさ、視界が全部きらきらになるの。え、なに今の。" },
  { id: "makura_course_09", cm: "makura", topic: "course", at: "mid", line: "会場の音量って場所で全然違うんだよ。上の席のほうが響くって。" },
  { id: "makura_course_10", cm: "makura", topic: "course", at: "entry", line: "どこの会場も、開場直後が一番いい席取れるからマジおすすめ。" },
  { id: "makura_island_01", cm: "makura", topic: "island", at: "entry", line: "港の朝市、六時集合とかいうやつ。無理。でも行くと楽しいんだよな。" },
  { id: "makura_island_02", cm: "makura", topic: "island", at: "entry", line: "坂の上のとこ、島が全部見えるんだよ。撮るならあそこ一択。" },
  { id: "makura_island_03", cm: "makura", topic: "island", at: "mid", line: "島の路地さ、猫みたいな竜の子が寝てんの。あれ見た人いる？" },
  { id: "makura_island_04", cm: "makura", topic: "island", at: "mid", region: "ノッテムーンライト地域", line: "この島、夜になると急に人出るじゃん。あの感じ好きなんだよな。" },
  { id: "makura_island_05", cm: "makura", topic: "island", at: "mid", region: "カルデラ地域", line: "東の浜、砂が黒いの。理由は知らん。でも映えるって。" },
  { id: "makura_island_06", cm: "makura", topic: "island", at: "entry", line: "船着き場の屋台がさ、最近急に増えたらしいよ。ぜんぶ回りたい。" },
  { id: "makura_island_07", cm: "makura", topic: "island", at: "mid", line: "島の坂道、下りは楽しいけど上りで人生を考えるって。" },
  { id: "makura_history_01", cm: "makura", topic: "history", at: "mid", line: "この会場、昔は倉庫だったらしいよ。え、それすごくない？" },
  { id: "makura_history_02", cm: "makura", topic: "history", at: "entry", line: "百年前の火事の話、じいちゃん世代がまだ語るんだって。重いって。" },
  { id: "makura_history_03", cm: "makura", topic: "history", at: "entry", line: "昔は竜に荷物運ばせてたって聞いた。今と全然違うじゃん。" },
  { id: "makura_history_04", cm: "makura", topic: "history", at: "entry", line: "この島の祭り、もともと収穫祝いなんだって。今の熱量おかしいって。" },
  { id: "makura_history_05", cm: "makura", topic: "history", at: "mid", line: "昔の会場って柵が木だったらしい。それ普通に危なくない？" },
  { id: "makura_history_06", cm: "makura", topic: "history", at: "entry", region: "グランドクロック地域", line: "時計塔が建った日は島中が集まったって。想像しただけで鳥肌。" },
  { id: "makura_history_07", cm: "makura", topic: "history", at: "mid", line: "古い壁の落書き、百年前のやつ残ってるんだよ。先輩すぎるって。" },
  { id: "makura_gourmet_01", cm: "makura", topic: "gourmet", at: "entry", line: "屋台の串焼き、三本目からが本番だって。二本でやめるのもったいな。" },
  { id: "makura_gourmet_02", cm: "makura", topic: "gourmet", at: "mid", line: "揚げ芋に塩だけって最強じゃん。凝ったやつより手が止まらん。" },
  { id: "makura_gourmet_03", cm: "makura", topic: "gourmet", at: "mid", region: "ラパン祭典地域", line: "ここの甘味、蜜が濃いんだよ。歯にくるけどやめられないって。" },
  { id: "makura_gourmet_04", cm: "makura", topic: "gourmet", at: "entry", line: "朝の焼きたてパン、匂いだけで並ぶ価値あるって。マジで。" },
  { id: "makura_gourmet_05", cm: "makura", topic: "gourmet", at: "mid", line: "汁物の屋台さ、器が熱すぎて毎回持てないの。学習しないアタシ。" },
  { id: "makura_gourmet_06", cm: "makura", topic: "gourmet", at: "entry", line: "食べ歩きは片手で持てるやつ一択。両手ふさがると詰むって。" },
  { id: "makura_gourmet_07", cm: "makura", topic: "gourmet", at: "mid", region: "ルミナ地域", line: "冷たい果実水、これ夏に飲むと生き返るから。ほんと生き返る。" },
  { id: "makura_life_01", cm: "makura", topic: "life", at: "mid", line: "昨日寝てないんだよね。え、待って、これ言うとこじゃないか。" },
  { id: "makura_life_02", cm: "makura", topic: "life", at: "mid", line: "最近ずっと同じ曲聴いてる。飽きるまでいくタイプなんだよ。" },
  { id: "makura_life_03", cm: "makura", topic: "life", at: "entry", line: "喉、朝から死んでるんだけど。声出すの仕事なのに終わってる。" },
  { id: "makura_life_04", cm: "makura", topic: "life", at: "entry", line: "母親から連絡来ててさ、ちゃんと食べてるかって。食べてるって。" },
  { id: "makura_life_05", cm: "makura", topic: "life", at: "entry", line: "アタシさ、来週から早起きするって決めたんだよ。決めただけ。" },
  { id: "makura_life_06", cm: "makura", topic: "life", at: "mid", line: "手袋どっか行った。片方だけあるの、あれ何なんだろうね。" },
  { id: "makura_life_07", cm: "makura", topic: "life", at: "mid", line: "端末の充電、今日もう二回してるんだけど。おかしくない？" },
  { id: "makura_life_08", cm: "makura", topic: "life", at: "mid", line: "背中がバキバキ。若いから平気って言われるけど平気じゃない。" },
  { id: "makura_life_09", cm: "makura", topic: "life", at: "entry", line: "新しい靴、まだ足になじんでなくてさ。かっこいいけど痛い。" },
  { id: "makura_life_10", cm: "makura", topic: "life", at: "entry", line: "夜更かしのつけって次の日じゃなくて三日後に来るらしいよ。" },
  { id: "makura_pun_01", cm: "makura", topic: "pun", at: "mid", line: "竜だけに、リュウーってね。……あ、今の無し。無しでお願い。" },
  { id: "makura_pun_02", cm: "makura", topic: "pun", at: "mid", line: "布団が吹っ飛んだ。……え、なんでアタシ今これ言った？" },
  { id: "makura_pun_03", cm: "makura", topic: "pun", at: "mid", line: "……はくしょん。ごめん、以上です。何も言うことない。" },
  { id: "makura_pun_04", cm: "makura", topic: "pun", at: "entry", line: "カレー食べたい。以上。アタシの話、だいたいこれなんだよね。" },
  { id: "sake_dragon_01", cm: "sake", topic: "dragon", at: "entry", line: "竜の息が浅い日はな、無理をさせんのがわしの流儀じゃ。" },
  { id: "sake_dragon_02", cm: "sake", topic: "dragon", at: "entry", line: "皮の照りを見れば、朝に何を食うたか分かるもんじゃ。" },
  { id: "sake_dragon_03", cm: "sake", topic: "dragon", at: "entry", line: "首の根に汗が浮いとる竜は、腹の据わっとる証拠でのう。" },
  { id: "sake_dragon_04", cm: "sake", topic: "dragon", at: "mid", line: "翼を畳む音でな、その竜の育ちが大体分かるんじゃよ。" },
  { id: "sake_dragon_05", cm: "sake", topic: "dragon", at: "mid", line: "わしの婆さんは竜の鼻息だけで天気を読んどったのう。" },
  { id: "sake_dragon_06", cm: "sake", topic: "dragon", at: "entry", line: "血筋の良い竜はな、立っとるだけで首の線が違うんじゃ。" },
  { id: "sake_dragon_07", cm: "sake", topic: "dragon", at: "mid", line: "若い竜は瞼が薄うてな、光の強い日はよう瞬きしよる。" },
  { id: "sake_dragon_08", cm: "sake", topic: "dragon", at: "mid", line: "竜の爪は月に一度削るもんじゃ。放っとくと割れての。" },
  { id: "sake_dragon_09", cm: "sake", topic: "dragon", at: "mid", line: "餌を替えると三日は腹が鳴る。竜も人と同じでのう。" },
  { id: "sake_dragon_10", cm: "sake", topic: "dragon", at: "entry", line: "鱗の間に指を入れて温さを見る。これがわしの物差しじゃ。" },
  { id: "sake_course_01", cm: "sake", topic: "course", at: "entry", region: "グランドクロック地域", line: "真鍮の柱は朝と昼で温みが違うんじゃ。妙なもんでのう。" },
  { id: "sake_course_02", cm: "sake", topic: "course", at: "entry", region: "ルミナ地域", line: "この空色の砂はな、目に沁みるほど白い光を跳ね返すんじゃ。" },
  { id: "sake_course_03", cm: "sake", topic: "course", at: "mid", region: "リングロッソ地域", line: "赤黒い壁に囲まれると、竜の息が妙に響いて聞こえるのう。" },
  { id: "sake_course_04", cm: "sake", topic: "course", at: "entry", region: "カルデラ地域", line: "地面から立つ熱でな、鼻の奥がひりつく。竜も同じじゃろ。" },
  { id: "sake_course_05", cm: "sake", topic: "course", at: "mid", region: "ミストレイク地域", line: "霧の日はな、耳を澄ませば水の匂いまで分かるもんじゃ。" },
  { id: "sake_course_06", cm: "sake", topic: "course", at: "mid", region: "ヴェント峡谷地域", line: "谷の風は上からも下からも来る。頬で向きを読むんじゃ。" },
  { id: "sake_course_07", cm: "sake", topic: "course", at: "entry", region: "ノッテムーンライト地域", line: "月あかりの下ではな、竜の影のほうが濃く見えるんじゃ。" },
  { id: "sake_course_08", cm: "sake", topic: "course", at: "entry", region: "ラパン祭典地域", line: "金の飾りが揺れる音でな、わしゃ祭りの日を思い出すのう。" },
  { id: "sake_course_09", cm: "sake", topic: "course", at: "mid", line: "土の硬さは足の裏で覚えるもんじゃ。目では分からんでの。" },
  { id: "sake_course_10", cm: "sake", topic: "course", at: "mid", line: "柵の塗り直しがまだじゃな。わしの若い頃と同じ色じゃが。" },
  { id: "sake_island_01", cm: "sake", topic: "island", at: "entry", line: "港の橋はな、わしが若い頃に一度架け替えとるんじゃよ。" },
  { id: "sake_island_02", cm: "sake", topic: "island", at: "mid", line: "島の東の坂道はきつうてな、腰にこたえるんじゃ。" },
  { id: "sake_island_03", cm: "sake", topic: "island", at: "mid", line: "町の井戸水は冷とうてのう。夏はあれが何より旨い。" },
  { id: "sake_island_04", cm: "sake", topic: "island", at: "entry", line: "崑崙島は日暮れが早い。灯りの油も昔より安うなった。" },
  { id: "sake_island_05", cm: "sake", topic: "island", at: "entry", line: "山の上の鐘は、霧が濃い日ほど遠くまで届くんじゃ。" },
  { id: "sake_island_06", cm: "sake", topic: "island", at: "entry", line: "島の犬は竜を怖がらん。生まれた時から見とるからのう。" },
  { id: "sake_island_07", cm: "sake", topic: "island", at: "mid", line: "海沿いの道は塩気で錆びる。金物屋が忙しいわけじゃ。" },
  { id: "sake_history_01", cm: "sake", topic: "history", at: "entry", line: "昔はな、竜を走らせる道は畑の畦道だったんじゃよ。" },
  { id: "sake_history_02", cm: "sake", topic: "history", at: "entry", line: "わしの師匠は、竜に名を付けるのは三年待てと言うとった。" },
  { id: "sake_history_03", cm: "sake", topic: "history", at: "entry", line: "島に時計塔が建った年はな、えらい雪が降ったんじゃ。" },
  { id: "sake_history_04", cm: "sake", topic: "history", at: "mid", line: "昔の竜使いは裸足でのう。足の裏で土を読んどったんじゃ。" },
  { id: "sake_history_05", cm: "sake", topic: "history", at: "entry", line: "祭りの太鼓は元は漁の合図でな、竜とは関わりなかったのう。" },
  { id: "sake_history_06", cm: "sake", topic: "history", at: "entry", line: "百年前の絵図には、翼のない竜が描かれとるそうじゃ。" },
  { id: "sake_history_07", cm: "sake", topic: "history", at: "mid", line: "わしが子供の頃はな、竜の水浴びを見るのが遊びじゃった。" },
  { id: "sake_gourmet_01", cm: "sake", topic: "gourmet", at: "mid", line: "焼いた芋に塩をふるだけでのう。歯がなくても食えるでな。" },
  { id: "sake_gourmet_02", cm: "sake", topic: "gourmet", at: "mid", line: "干し魚は硬いんじゃ。入れ歯にはちと難儀するんじゃよ。" },
  { id: "sake_gourmet_03", cm: "sake", topic: "gourmet", at: "entry", line: "婆さんの煮物はな、味が濃いのに翌朝も喉が渇かんかった。" },
  { id: "sake_gourmet_04", cm: "sake", topic: "gourmet", at: "mid", line: "熱い汁はゆっくり飲むもんじゃ。舌を焼くと三日味が消える。" },
  { id: "sake_gourmet_05", cm: "sake", topic: "gourmet", at: "entry", line: "この時季の貝はよう肥えとる。砂を吐かせるのが肝心での。" },
  { id: "sake_gourmet_06", cm: "sake", topic: "gourmet", at: "entry", line: "餅は腹に溜まってええが、竜に食わせるものではないのう。" },
  { id: "sake_gourmet_07", cm: "sake", topic: "gourmet", at: "mid", line: "茶は二煎目が旨い。一煎目は目が覚めすぎていかんのじゃ。" },
  { id: "sake_life_01", cm: "sake", topic: "life", at: "mid", line: "うむ？今なんと言うた。こっちの耳は遠うてのう。" },
  { id: "sake_life_02", cm: "sake", topic: "life", at: "mid", line: "腰がのう。昨日から曲がったまま伸びんのじゃ。" },
  { id: "sake_life_03", cm: "sake", topic: "life", at: "entry", line: "孫が背を追い越してしもうた。もう頭を撫でられんわい。" },
  { id: "sake_life_04", cm: "sake", topic: "life", at: "mid", line: "朝はな、膝が鳴ってから起きるのが決まりでのう。" },
  { id: "sake_life_05", cm: "sake", topic: "life", at: "mid", line: "入れ歯を置き忘れてな、探すのに半刻かかったわい。" },
  { id: "sake_life_06", cm: "sake", topic: "life", at: "entry", line: "婆さんに帽子を持たされた。日射しがきついそうじゃ。" },
  { id: "sake_life_07", cm: "sake", topic: "life", at: "entry", line: "夜中に三度も目が覚めてのう。歳は取りたくないもんじゃ。" },
  { id: "sake_life_08", cm: "sake", topic: "life", at: "mid", line: "近ごろは名前が出てこん。顔は覚えとるんじゃがのう。" },
  { id: "sake_life_09", cm: "sake", topic: "life", at: "entry", line: "湯につかると眠うなってな、ここで寝たら怒られるわい。" },
  { id: "sake_life_10", cm: "sake", topic: "life", at: "mid", line: "……はっくしょい。いや、失礼。風が変わったようじゃ。" },
  { id: "sake_pun_01", cm: "sake", topic: "pun", at: "mid", line: "竜の背に乗って、りゅうと風を切る……いや、なんでもない。" },
  { id: "sake_pun_02", cm: "sake", topic: "pun", at: "mid", line: "うちの婆さんが、今日の晩は芋じゃと言うとった。以上じゃ。" },
  { id: "sake_pun_03", cm: "sake", topic: "pun", at: "entry", line: "……はっくしょい。うむ、それだけじゃ。気にせんでくれ。" },
  { id: "sake_pun_04", cm: "sake", topic: "pun", at: "mid", line: "鱗をな、うろこうろしとると言うたら孫に笑われたわい。" },
  { id: "mizu_dragon_01", cm: "mizu", topic: "dragon", at: "entry", line: "竜の体温はね、人より二度ほど高いのよ。触ると分かるわ。" },
  { id: "mizu_dragon_02", cm: "mizu", topic: "dragon", at: "entry", line: "翼の幅は背丈の一倍半が平均。それより広いと目立つのよ。" },
  { id: "mizu_dragon_03", cm: "mizu", topic: "dragon", at: "mid", line: "竜が瞬きする回数、あたくし数えたことがあるの。あはん。" },
  { id: "mizu_dragon_04", cm: "mizu", topic: "dragon", at: "entry", line: "羽ばたきは一分に四十回前後。落ち着いた竜の目安なのよ。" },
  { id: "mizu_dragon_05", cm: "mizu", topic: "dragon", at: "entry", line: "鱗の色は三十七種に分けられるって、市場の帳面にあったわ。" },
  { id: "mizu_dragon_06", cm: "mizu", topic: "dragon", at: "mid", line: "竜も湿度が七割を超えると、途端に不機嫌になるものよ。" },
  { id: "mizu_dragon_07", cm: "mizu", topic: "dragon", at: "mid", line: "餌代はね、一頭でうちの一家四人ぶんを軽く超えるのよ。" },
  { id: "mizu_dragon_08", cm: "mizu", topic: "dragon", at: "entry", line: "尻尾の長さと体重は、きれいに比例するって聞いたわ。" },
  { id: "mizu_dragon_09", cm: "mizu", topic: "dragon", at: "mid", line: "生まれて百日で歯が生え替わるの。人間より気が早いわね。" },
  { id: "mizu_dragon_10", cm: "mizu", topic: "dragon", at: "mid", line: "竜の睫毛って意外と長いのよ。近くで見ると驚くわ。" },
  { id: "mizu_course_01", cm: "mizu", topic: "course", at: "entry", region: "グランドクロック地域", line: "この時計塔、日に十二度鳴るの。数えた客は三人だけよ。" },
  { id: "mizu_course_02", cm: "mizu", topic: "course", at: "entry", region: "ルミナ地域", line: "空色の壁は光をよく返すから、日焼け止めが倍売れるのよ。" },
  { id: "mizu_course_03", cm: "mizu", topic: "course", at: "mid", region: "リングロッソ地域", line: "赤と黒の壁ね。あたくしの口紅と同じ配合よ。あはん。" },
  { id: "mizu_course_04", cm: "mizu", topic: "course", at: "entry", region: "カルデラ地域", line: "ここの気温は町より四度高いの。水売りの列が長いわけね。" },
  { id: "mizu_course_05", cm: "mizu", topic: "course", at: "mid", region: "ミストレイク地域", line: "霧の朝は湿度が九割超え。髪がまとまらなくて困るのよ。" },
  { id: "mizu_course_06", cm: "mizu", topic: "course", at: "entry", region: "ヴェント峡谷地域", line: "谷の風は秒速八まで出るの。帽子は押さえておきなさいね。" },
  { id: "mizu_course_07", cm: "mizu", topic: "course", at: "entry", region: "ノッテムーンライト地域", line: "月夜の照明代、年に相当なものよ。それでも客足は絶えないわ。" },
  { id: "mizu_course_08", cm: "mizu", topic: "course", at: "mid", region: "ラパン祭典地域", line: "祭りの金箔、去年より一割値上がりしたのよ。ひどい話ね。" },
  { id: "mizu_course_09", cm: "mizu", topic: "course", at: "entry", line: "客席の傾きは十二度。設計した人は目が良かったのね。" },
  { id: "mizu_course_10", cm: "mizu", topic: "course", at: "mid", line: "この砂は隣の浜から運ぶの。一袋の値段、聞いたら驚くわよ。" },
  { id: "mizu_island_01", cm: "mizu", topic: "island", at: "entry", line: "港の朝市はね、日の出の四十分前が一番いい品が並ぶのよ。" },
  { id: "mizu_island_02", cm: "mizu", topic: "island", at: "entry", line: "島の人の数、この十年で二割増えたって。家賃も上がったわ。" },
  { id: "mizu_island_03", cm: "mizu", topic: "island", at: "mid", line: "町の靴屋は三軒。どれも坂道用の底を厚くしているのよ。" },
  { id: "mizu_island_04", cm: "mizu", topic: "island", at: "entry", line: "崑崙島の郵便は週に二度。急ぎの用には向かないわね。" },
  { id: "mizu_island_05", cm: "mizu", topic: "island", at: "entry", line: "この島、雨の日が年に六十日ほど。傘は良いのを買うことね。" },
  { id: "mizu_island_06", cm: "mizu", topic: "island", at: "mid", line: "北の宿は湯が熱すぎるの。あたくし、一度で懲りたわ。" },
  { id: "mizu_island_07", cm: "mizu", topic: "island", at: "mid", line: "夜市の灯りは三百と少し。数えた夜があったのよ。あはん。" },
  { id: "mizu_history_01", cm: "mizu", topic: "history", at: "entry", line: "この島に最初の石橋が架かったのは、二百年ほど前だそうよ。" },
  { id: "mizu_history_02", cm: "mizu", topic: "history", at: "entry", line: "昔は塩と布の島だったの。今は見る影もないわね。" },
  { id: "mizu_history_03", cm: "mizu", topic: "history", at: "entry", line: "百年前の帳面には、値段が今の三十分の一で書いてあるわ。" },
  { id: "mizu_history_04", cm: "mizu", topic: "history", at: "entry", line: "祭りが今の形になったのは、案外新しくて六十年前なのよ。" },
  { id: "mizu_history_05", cm: "mizu", topic: "history", at: "mid", line: "時計塔を建てた職人は島の外から来たって話。粋な仕事ね。" },
  { id: "mizu_history_06", cm: "mizu", topic: "history", at: "entry", line: "昔の女は市場に立てなかったのよ。あたくしなら耐えられないわ。" },
  { id: "mizu_history_07", cm: "mizu", topic: "history", at: "mid", line: "火山が最後に鳴ったのは四十年前。年寄りはよく覚えているわ。" },
  { id: "mizu_gourmet_01", cm: "mizu", topic: "gourmet", at: "mid", line: "揚げ菓子の屋台、開いて十分で列が二十人になるのよ。" },
  { id: "mizu_gourmet_02", cm: "mizu", topic: "gourmet", at: "entry", line: "今年の果実は甘いわ。日照りが去年より二割長かったから。" },
  { id: "mizu_gourmet_03", cm: "mizu", topic: "gourmet", at: "mid", line: "貝の汁は塩を足しちゃ駄目。旨みの数字が狂うのよ。" },
  { id: "mizu_gourmet_04", cm: "mizu", topic: "gourmet", at: "mid", line: "流行りは辛い豆の煮込み。三日続けて食べたら胃が痛んだわ。" },
  { id: "mizu_gourmet_05", cm: "mizu", topic: "gourmet", at: "entry", line: "焼き串は一本で十六文。二本で三十文にするのが商売上手ね。" },
  { id: "mizu_gourmet_06", cm: "mizu", topic: "gourmet", at: "mid", line: "あたくしね、甘いものは午前中と決めているの。太らないのよ。" },
  { id: "mizu_gourmet_07", cm: "mizu", topic: "gourmet", at: "entry", line: "夜の麺屋は湯気で店内が三度上がるの。冬はありがたいわね。" },
  { id: "mizu_life_01", cm: "mizu", topic: "life", at: "mid", line: "この靴、今朝おろしたばかりなの。もう踵が痛いわ。" },
  { id: "mizu_life_02", cm: "mizu", topic: "life", at: "mid", line: "髪をひとつ短くしたの。気づいた人は今日で二人目よ。" },
  { id: "mizu_life_03", cm: "mizu", topic: "life", at: "mid", line: "うちの妹がね、また出かける前に鏡の前で三十分よ。" },
  { id: "mizu_life_04", cm: "mizu", topic: "life", at: "entry", line: "あたくし、朝は白湯を二杯。これで十年風邪知らずなのよ。" },
  { id: "mizu_life_05", cm: "mizu", topic: "life", at: "entry", line: "常連さんに孫が生まれたそうよ。祝いの品を選ばなくちゃ。" },
  { id: "mizu_life_06", cm: "mizu", topic: "life", at: "mid", line: "この扇、去年の夏に買ったの。今年もまだ働いてくれるわ。" },
  { id: "mizu_life_07", cm: "mizu", topic: "life", at: "entry", line: "日焼けは大敵よ。一日で三年ぶん老けるって言うでしょう。" },
  { id: "mizu_life_08", cm: "mizu", topic: "life", at: "mid", line: "隣の家の猫が毎朝六時に鳴くの。目覚ましは要らないわね。" },
  { id: "mizu_life_09", cm: "mizu", topic: "life", at: "entry", line: "あたくしね、数を数えていないと落ち着かない質なのよ。" },
  { id: "mizu_life_10", cm: "mizu", topic: "life", at: "mid", line: "指輪を外して洗い物をしたら、どこへ置いたか忘れたわ。" },
  { id: "mizu_pun_01", cm: "mizu", topic: "pun", at: "mid", line: "市場で酢を買ったら、すっと気が晴れたのよ。あはん。" },
  { id: "mizu_pun_02", cm: "mizu", topic: "pun", at: "mid", line: "霧が濃いわね。きりがないってこういうことかしら。" },
  { id: "mizu_pun_03", cm: "mizu", topic: "pun", at: "entry", line: "母が今日は辛い煮込みだと言っていたわ。それだけよ。" },
  { id: "mizu_pun_04", cm: "mizu", topic: "pun", at: "mid", line: "屋台の飴が高くて、あたくし飴然としてしまったわ。" },
  { id: "celestia_dragon_01", cm: "celestia", topic: "dragon", at: "entry", line: "竜の鱗はね、百年に一度だけ色を深めるのよ。ふふ。" },
  { id: "celestia_dragon_02", cm: "celestia", topic: "dragon", at: "entry", line: "赤翼竜ルベルの祖先は、千年前の空を渡っていたのね。" },
  { id: "celestia_dragon_03", cm: "celestia", topic: "dragon", at: "mid", line: "竜は眠るとき、心臓を半分だけ止めるの。器用なこと。" },
  { id: "celestia_dragon_04", cm: "celestia", topic: "dragon", at: "entry", line: "バランのような黒い鱗は、地層の底の色に似ているのよ。" },
  { id: "celestia_dragon_05", cm: "celestia", topic: "dragon", at: "mid", line: "竜の寿命は星の瞬きほど。私にはそう見えるのね。" },
  { id: "celestia_dragon_06", cm: "celestia", topic: "dragon", at: "entry", line: "アカネの目は、朝焼けを千回見た者の色をしているのよ。" },
  { id: "celestia_dragon_07", cm: "celestia", topic: "dragon", at: "entry", line: "竜の翼の骨はね、私らの指と同じ数だけあるのよ。ふふ。" },
  { id: "celestia_dragon_08", cm: "celestia", topic: "dragon", at: "mid", line: "ムラサメの鳴き声は、雨の日だけ低くなるのね。不思議。" },
  { id: "celestia_dragon_09", cm: "celestia", topic: "dragon", at: "mid", line: "竜は千年生きても、名前を忘れないのよ。律儀なこと。" },
  { id: "celestia_dragon_10", cm: "celestia", topic: "dragon", at: "mid", line: "ロッソの体温は、溶けた鉄と同じくらいあるのね。" },
  { id: "celestia_course_01", cm: "celestia", topic: "course", at: "entry", region: "グランドクロック地域", line: "この時計塔はね、千年ぶん歯車を回し続けているのよ。" },
  { id: "celestia_course_02", cm: "celestia", topic: "course", at: "mid", region: "ルミナ地域", line: "ルミナの空色は、潮の満ち引きで少しだけ変わるのね。" },
  { id: "celestia_course_03", cm: "celestia", topic: "course", at: "entry", region: "リングロッソ地域", line: "赤と黒の石畳は、古い誓いの色を写しているのよ。ふふ。" },
  { id: "celestia_course_04", cm: "celestia", topic: "course", at: "entry", region: "カルデラ地域", line: "この山の下ではね、百年前の火がまだ眠っているのよ。" },
  { id: "celestia_course_05", cm: "celestia", topic: "course", at: "mid", region: "ミストレイク地域", line: "霧の湖は、千年前の雨をまだ抱えているのね。" },
  { id: "celestia_course_06", cm: "celestia", topic: "course", at: "mid", region: "ヴェント峡谷地域", line: "峡谷の風はね、地層を削るのに千年かけたのよ。" },
  { id: "celestia_course_07", cm: "celestia", topic: "course", at: "entry", region: "ノッテムーンライト地域", line: "月の光は、届くまでに少しだけ時間がかかるのね。ふふ。" },
  { id: "celestia_course_08", cm: "celestia", topic: "course", at: "mid", region: "ラパン祭典地域", line: "金の飾りはね、祭りのたびに一枚ずつ増えるのよ。" },
  { id: "celestia_course_09", cm: "celestia", topic: "course", at: "entry", line: "どの走路もね、もとは竜が踏み固めた獣道なのよ。" },
  { id: "celestia_course_10", cm: "celestia", topic: "course", at: "mid", line: "石畳の継ぎ目には、百年ぶんの砂が眠っているのね。" },
  { id: "celestia_island_01", cm: "celestia", topic: "island", at: "entry", line: "この島の名は、山の名を借りたものなのよ。ふふ。" },
  { id: "celestia_island_02", cm: "celestia", topic: "island", at: "entry", line: "港の灯りはね、昔は貝殻を並べて作っていたのね。" },
  { id: "celestia_island_03", cm: "celestia", topic: "island", at: "mid", line: "町の井戸は、島の骨の隙間から水を汲んでいるのよ。" },
  { id: "celestia_island_04", cm: "celestia", topic: "island", at: "entry", line: "島の坂道はね、竜の背に合わせて作られているのよ。" },
  { id: "celestia_island_05", cm: "celestia", topic: "island", at: "mid", line: "市場の屋根瓦の色は、百年で三度変わったのね。" },
  { id: "celestia_island_06", cm: "celestia", topic: "island", at: "entry", line: "島の南の岬にはね、まだ名前がないままの岩があるのよ。" },
  { id: "celestia_island_07", cm: "celestia", topic: "island", at: "mid", line: "この島は少しずつ沈んでいるのよ。あと万年は平気ね。" },
  { id: "celestia_history_01", cm: "celestia", topic: "history", at: "entry", line: "この島に人が住みつく前から、竜はここを走っていたのね。" },
  { id: "celestia_history_02", cm: "celestia", topic: "history", at: "entry", line: "最初の走路はね、祈りのために引かれた線だったのよ。" },
  { id: "celestia_history_03", cm: "celestia", topic: "history", at: "entry", line: "千年前の島の古老は、竜の足跡で暦を数えていたのね。" },
  { id: "celestia_history_04", cm: "celestia", topic: "history", at: "mid", line: "大きな噴火が三度あってね、島の形は今の方が丸いのよ。" },
  { id: "celestia_history_05", cm: "celestia", topic: "history", at: "entry", line: "昔の島には橋がなくてね、皆で泳いで渡っていたのよ。ふふ。" },
  { id: "celestia_history_06", cm: "celestia", topic: "history", at: "mid", line: "この祭りの起源はね、誰も覚えていないのよ。私も少し。" },
  { id: "celestia_history_07", cm: "celestia", topic: "history", at: "mid", line: "古い石碑には、竜と人が並んで立つ絵が彫ってあるのね。" },
  { id: "celestia_gourmet_01", cm: "celestia", topic: "gourmet", at: "entry", line: "島の塩はね、千年かけて岩から染み出したものなのよ。" },
  { id: "celestia_gourmet_02", cm: "celestia", topic: "gourmet", at: "mid", line: "この果実は百年に一度しか実らないの。今日は違うのね。" },
  { id: "celestia_gourmet_03", cm: "celestia", topic: "gourmet", at: "entry", line: "熱い茶は、冷める速さで時間の長さがわかるのよ。ふふ。" },
  { id: "celestia_gourmet_04", cm: "celestia", topic: "gourmet", at: "mid", line: "海藻の煮物はね、私はいくらでも食べられるのよ。" },
  { id: "celestia_gourmet_05", cm: "celestia", topic: "gourmet", at: "entry", line: "島の蜜は、月の出ている夜に採ると澄むと言うのね。" },
  { id: "celestia_gourmet_06", cm: "celestia", topic: "gourmet", at: "mid", line: "焼いた芋の匂いは、千年前とまるで変わらないのよ。" },
  { id: "celestia_gourmet_07", cm: "celestia", topic: "gourmet", at: "mid", line: "冷たい麺をね、私は少しだけ長く噛むのが好きなのよ。" },
  { id: "celestia_life_01", cm: "celestia", topic: "life", at: "mid", line: "私はね、今朝から左の肩が少しだけ重いのよ。ふふ。" },
  { id: "celestia_life_02", cm: "celestia", topic: "life", at: "entry", line: "星の巡りを数えていたら、朝になっていたのね。" },
  { id: "celestia_life_03", cm: "celestia", topic: "life", at: "mid", line: "百年前に借りた本をね、まだ返していないのよ。" },
  { id: "celestia_life_04", cm: "celestia", topic: "life", at: "entry", line: "昨日、履物の紐が切れたのよ。千年ぶりのことね。" },
  { id: "celestia_life_05", cm: "celestia", topic: "life", at: "mid", line: "私の袖はね、風があると少しだけ邪魔になるのよ。" },
  { id: "celestia_life_06", cm: "celestia", topic: "life", at: "entry", line: "眠りは短くていいの。かわりに長く座っているのね。" },
  { id: "celestia_life_07", cm: "celestia", topic: "life", at: "entry", line: "昔の友がね、島を出たきり戻らないのよ。まだ待つのね。" },
  { id: "celestia_life_08", cm: "celestia", topic: "life", at: "mid", line: "湯を沸かす音は、いつ聞いても好ましいこと。ふふ。" },
  { id: "celestia_life_09", cm: "celestia", topic: "life", at: "mid", line: "髪を結うのに、今朝は三度もやり直したのよ。" },
  { id: "celestia_life_10", cm: "celestia", topic: "life", at: "entry", line: "島の子らはね、私を見ると必ず手を振るのよ。嬉しいこと。" },
  { id: "celestia_pun_01", cm: "celestia", topic: "pun", at: "mid", line: "竜が立つ。……私は今、何か言った気がするのね。ふふ。" },
  { id: "celestia_pun_02", cm: "celestia", topic: "pun", at: "mid", line: "鱗が光る。光るから、ひかりもの。……違うのね。" },
  { id: "celestia_pun_03", cm: "celestia", topic: "pun", at: "entry", line: "千年を、千年。ふふ。二度言うと長く感じるのよ。" },
  { id: "celestia_pun_04", cm: "celestia", topic: "pun", at: "mid", line: "霧が濃い。濃い霧。……私には同じに聞こえるのね。" },
  { id: "unme_dragon_01", cm: "unme", topic: "dragon", at: "mid", line: "竜って寝相が悪いんですって。知らんけど！" },
  { id: "unme_dragon_02", cm: "unme", topic: "dragon", at: "entry", line: "バランは朝が弱いって、ウンメちゃん知ってましたよぉ。" },
  { id: "unme_dragon_03", cm: "unme", topic: "dragon", at: "entry", line: "竜の鱗、爪で弾くといい音がするんですよぉ。たぶん。" },
  { id: "unme_dragon_04", cm: "unme", topic: "dragon", at: "entry", line: "アカネって名前、朝焼けから来てるらしいですって。" },
  { id: "unme_dragon_05", cm: "unme", topic: "dragon", at: "mid", line: "竜は好きな匂いがあると鼻を鳴らすんですよぉ。ほら。" },
  { id: "unme_dragon_06", cm: "unme", topic: "dragon", at: "entry", line: "ポロはよく泣くんですって。ウンメちゃんも昔そうでしたぁ。" },
  { id: "unme_dragon_07", cm: "unme", topic: "dragon", at: "mid", line: "竜の翼、畳むとけっこう小さくなるんですよぉ。意外！" },
  { id: "unme_dragon_08", cm: "unme", topic: "dragon", at: "mid", line: "ムラサメの尻尾、九割が筋肉らしいですって。知らんけど！" },
  { id: "unme_dragon_09", cm: "unme", topic: "dragon", at: "mid", line: "竜って人の顔を三年は覚えてるらしいですよぉ。怖い！" },
  { id: "unme_dragon_10", cm: "unme", topic: "dragon", at: "entry", line: "ロッソは熱いところが好きって、前にも言いましたっけ。" },
  { id: "unme_course_01", cm: "unme", topic: "course", at: "mid", region: "グランドクロック地域", line: "この時計塔、たまに二分ずれるんですって。知らんけど！" },
  { id: "unme_course_02", cm: "unme", topic: "course", at: "entry", region: "ルミナ地域", line: "ルミナの空、写した絵はぜんぶ喜ばれるらしいですよぉ。" },
  { id: "unme_course_03", cm: "unme", topic: "course", at: "entry", region: "リングロッソ地域", line: "この赤黒い壁、塗り直すのに三日かかるんですって。" },
  { id: "unme_course_04", cm: "unme", topic: "course", at: "mid", region: "カルデラ地域", line: "ここ、卵を置いとくと勝手にゆで上がるんですよぉ。" },
  { id: "unme_course_05", cm: "unme", topic: "course", at: "mid", region: "ミストレイク地域", line: "霧が濃い日は、係の人も迷子になるらしいですって。" },
  { id: "unme_course_06", cm: "unme", topic: "course", at: "entry", region: "ヴェント峡谷地域", line: "ここの風、帽子を三つ持っていかれましたウンメちゃん。" },
  { id: "unme_course_07", cm: "unme", topic: "course", at: "mid", region: "ノッテムーンライト地域", line: "月夜の走路って、足元が青く見えるんですよぉ。素敵！" },
  { id: "unme_course_08", cm: "unme", topic: "course", at: "entry", region: "ラパン祭典地域", line: "祭りの金紙、あとで拾い集める係がいるんですって。" },
  { id: "unme_course_09", cm: "unme", topic: "course", at: "entry", line: "どの走路も、実は微妙に長さが違うらしいですよぉ。" },
  { id: "unme_course_10", cm: "unme", topic: "course", at: "mid", line: "石畳の掃除、朝の四時からやってるんですって。偉い！" },
  { id: "unme_island_01", cm: "unme", topic: "island", at: "entry", line: "港の食堂、二階の窓際がいちばん風が気持ちいいですよぉ。" },
  { id: "unme_island_02", cm: "unme", topic: "island", at: "mid", line: "この島の坂、上りより下りのほうが疲れるんですって。" },
  { id: "unme_island_03", cm: "unme", topic: "island", at: "mid", line: "町の時計、三つとも別の時間を指してるんですよぉ。" },
  { id: "unme_island_04", cm: "unme", topic: "island", at: "entry", line: "市場の呼び込み、朝はみんな声が高いんですって。ほんと。" },
  { id: "unme_island_05", cm: "unme", topic: "island", at: "mid", line: "島の南のほう、まだ行ったことないんですよぉウンメちゃん。" },
  { id: "unme_island_06", cm: "unme", topic: "island", at: "entry", line: "宿の主人が言うには、今年は風が早いらしいですって。" },
  { id: "unme_island_07", cm: "unme", topic: "island", at: "mid", line: "この島、猫より竜のほうが多いらしいですよぉ。知らんけど！" },
  { id: "unme_history_01", cm: "unme", topic: "history", at: "mid", line: "昔ここ、ぜんぶ湖だったらしいですって。知らんけど！" },
  { id: "unme_history_02", cm: "unme", topic: "history", at: "entry", line: "島の古老が言うには、走路は祈りから始まったとか。" },
  { id: "unme_history_03", cm: "unme", topic: "history", at: "entry", line: "百年前の走路、今より狭かったらしいですよぉ。窮屈！" },
  { id: "unme_history_04", cm: "unme", topic: "history", at: "mid", line: "昔の人も同じこと言ってたって、前にも言いましたっけ。" },
  { id: "unme_history_05", cm: "unme", topic: "history", at: "entry", line: "この島の祭り、三回くらい中止になったんですって。" },
  { id: "unme_history_06", cm: "unme", topic: "history", at: "entry", line: "大昔の噴火のとき、みんな船で逃げたらしいですよぉ。" },
  { id: "unme_history_07", cm: "unme", topic: "history", at: "mid", line: "古い石碑の字、誰も読めないんですって。ウンメちゃんも無理！" },
  { id: "unme_gourmet_01", cm: "unme", topic: "gourmet", at: "entry", line: "港の焼き魚、皮のところがいちばん美味しいんですよぉ。" },
  { id: "unme_gourmet_02", cm: "unme", topic: "gourmet", at: "mid", line: "母が今日はカレーだと言っていました。それだけですぅ。" },
  { id: "unme_gourmet_03", cm: "unme", topic: "gourmet", at: "mid", line: "島の蜜菓子、二個目からが本番なんですって。" },
  { id: "unme_gourmet_04", cm: "unme", topic: "gourmet", at: "mid", line: "屋台の汁物、猫舌のウンメちゃんには早すぎますぅ。" },
  { id: "unme_gourmet_05", cm: "unme", topic: "gourmet", at: "entry", line: "冷たい麺に熱い茶、この組み合わせ発明したのウンメちゃん。" },
  { id: "unme_gourmet_06", cm: "unme", topic: "gourmet", at: "entry", line: "祭りの飴、色が七つあるらしいですよぉ。全部同じ味！" },
  { id: "unme_gourmet_07", cm: "unme", topic: "gourmet", at: "mid", line: "朝ごはん抜いてきたんですけど、今それを後悔してますぅ。" },
  { id: "unme_life_01", cm: "unme", topic: "life", at: "mid", line: "昨日から右のまぶたがぴくぴくするんですよぉ。知らんけど！" },
  { id: "unme_life_02", cm: "unme", topic: "life", at: "entry", line: "この髪型、朝に十分かけてるんですって。ウンメちゃんがです。" },
  { id: "unme_life_03", cm: "unme", topic: "life", at: "mid", line: "履物の紐、今朝ほどけて三回結び直しましたぁ。" },
  { id: "unme_life_04", cm: "unme", topic: "life", at: "entry", line: "実はウンメちゃん、こう見えて肩こりがひどいんですよぉ。" },
  { id: "unme_life_05", cm: "unme", topic: "life", at: "entry", line: "昔の友に手紙を書こうと思って、三年経ちましたぁ。" },
  { id: "unme_life_06", cm: "unme", topic: "life", at: "mid", line: "昨夜よく眠れましてね、夢の内容は覚えてませんけど。" },
  { id: "unme_life_07", cm: "unme", topic: "life", at: "mid", line: "こういう日って前にもありましたよねぇ。ありました？" },
  { id: "unme_life_08", cm: "unme", topic: "life", at: "entry", line: "ウンメちゃん、寒いのが苦手でしてぇ。暑いのも苦手ですぅ。" },
  { id: "unme_life_09", cm: "unme", topic: "life", at: "entry", line: "母から連絡が来ましてね、元気かって、それだけですぅ。" },
  { id: "unme_life_10", cm: "unme", topic: "life", at: "mid", line: "今日の袖の丈、ちょっと短かったかもしれませんねぇ。" },
  { id: "unme_pun_01", cm: "unme", topic: "pun", at: "mid", line: "運が良い、つまりウンメが良い。……今の、聞きました？" },
  { id: "unme_pun_02", cm: "unme", topic: "pun", at: "mid", line: "竜と、たつ。……はい、次いきましょう。知らんけど！" },
  { id: "unme_pun_03", cm: "unme", topic: "pun", at: "mid", line: "はっ、はっ、……くしゅん。はい、以上ですぅ。" },
  { id: "unme_pun_04", cm: "unme", topic: "pun", at: "entry", line: "霧、きり、きりがない。……もうやめますぅ。" },
];

// ── 直近に出したものを覚えておく台帳 ────────────────────────
// state.player.bcChat = { q: [id, id, ...] }（新しいものが後ろ）
// ★壊れていても落とさない。読めなければ「何も出していない」に倒す。
//   繰り返しが増えることはあっても、レースが止まらない方が良い。
function bcChatterLedger() {
  try {
    const p = (typeof state !== "undefined" && state && state.player) ? state.player : null;
    if (!p) return { n: 0, used: {}, save: null };
    let L = p.bcChat;
    if (!L || typeof L !== "object" || typeof L.n !== "number" ||
        !L.used || typeof L.used !== "object") {
      L = { n: 0, used: {} };
      p.bcChat = L;
    }
    return { n: L.n, used: L.used, save: L };
  } catch (e) { return { n: 0, used: {}, save: null }; }
}

// 条件（region / weather / dragon）がこのレースに合うか
function bcChatterFits(rec, sit) {
  if (!rec) return false;
  if (rec.region && (!sit || String(sit.region || "").indexOf(rec.region) < 0)) return false;
  if (rec.weather && (!sit || String(sit.weather || "").indexOf(rec.weather) < 0)) return false;
  if (rec.dragon && (!sit || !(sit.dragons || []).some(d => d === rec.dragon))) return false;
  return true;
}

// 1本選ぶ。出せるものが無ければ null（そのレースは雑談なしで通る）。
// ★直近に出したものを除く。全部除かれてしまったら、いちばん古いものから戻す
//   （枯れても黙らない。プールが小さいうちも破綻しない作り）。
// ★「まだ一度も出していないもの」を最優先し、次に「最後に出したのが
//   いちばん古いもの」を選ぶ。これで持ち球を一巡してから繰り返しに入る。
//
//   以前は直近N本を除いた上で配列の先頭から取っていた。除外の窓から
//   外れた行がまた先頭に戻ってくるため、配列の頭にある竜の話ばかりが
//   回り続け、その先の地域・島・食・世間話に一度も到達しなかった
//   （330本用意して実際に出たのは48種、しかも全部が竜の話だった）。
function bcChatterPick(cmKey, at, sit) {
  try {
    if (!cmKey || !BC_CHATTER.length) return null;
    const L = bcChatterLedger();
    const pool = BC_CHATTER.filter(r =>
      r.cm === cmKey && r.at === at && bcChatterFits(r, sit));
    if (!pool.length) return null;
    const at_ = r => (L.used[r.id] == null ? -1 : L.used[r.id]);
    let best = pool[0];
    for (let i = 1; i < pool.length; i++) if (at_(pool[i]) < at_(best)) best = pool[i];
    return best;
  } catch (e) { return null; }
}

function bcChatterMark(id) {
  if (!id) return;
  try {
    const L = bcChatterLedger();
    if (!L.save) return;
    L.save.n = (L.save.n || 0) + 1;
    L.save.used[id] = L.save.n;
  } catch (e) { /* 記録に失敗しても進行は止めない */ }
}
