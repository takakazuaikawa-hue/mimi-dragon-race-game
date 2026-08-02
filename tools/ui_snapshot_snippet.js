// =========================================================================
// tools/ui_snapshot_snippet.js — 見た目の指紋（UI土台工事の検証ゲート・2026-08-02）
// =========================================================================
// index.html からは読み込まない開発用スニペット。使い方：
//   1) 工事前：ブラウザのコンソール（または javascript_tool）にこのIIFEを貼って実行
//      → 18画面の {n, h} が返る。これを控える（基準）。明細は localStorage.__uiBase へ。
//   2) CSSを変更 → ?v をバンプしてリロード
//   3) 同じコードをもう一度実行 → h が基準と**全画面一致**すれば「見た目は変わっていない」。
//      1画面でも違えば localStorage.__uiBase と突き合わせてどの要素か特定する。
// ★工事前に必ずA/Aテスト（何も変えずに2回測って一致）で計測器自体を検証すること。
// ★transform/opacity/filter はアニメで揺れるので測らない＝そこを触る工事には使えない。
// 実績：2026-08-02 角丸トークン化で --r-4 の衝突（4px→22px化け）をこのゲートが検出した。
// 見た目の指紋：各画面のDOMを歩き、デザインに関わる計算済みスタイルをハッシュ化する。
// ★日付の罠（2026-08-03 実測）：SNSの日替わりフィードは _epochDay で回転する。基準と照合を
//   **同じ日**に行うこと。日をまたぐと sns だけ「1要素挿入→以降ハッシュ玉突き」の形の差分が出る
//   （返信つき投稿が並んだ日は ig-comlink ボタンが増える等）。それはCSSの罪ではない＝
//   その日の基準を取り直してから工事する。
// アニメで揺れる transform/opacity/filter は除外（トークン置換はそこに触らないため）。
(function(){
  var SCREENS=["race_select","meals","assets","life_tree","collection","story","goals","help","settings","economy","kiko","media","village","mall","konron_guide","konron_gallery","sns","home"];
  var PROPS=["borderRadius","paddingTop","paddingRight","paddingBottom","paddingLeft",
             "borderTopWidth","borderTopStyle","borderTopColor","borderBottomColor",
             "backgroundColor","backgroundImage","boxShadow","color","fontSize","fontWeight"];
  function fnv(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h*16777619)>>>0; } return h>>>0; }
  // 状態を毎回同じに作る
  resetGame();
  state.player.completedRaces=40; state.player.wins=15; state.player.coins=9000000; state.player.maxCoins=9000000;
  ["_chapter_intro_2","_chapter_intro_3","_chapter_intro_4","assetsRevealed","assetsIntroSeen","phoneBought","poroFound","kikoStarted"].forEach(function(f){ setStoryFlag(f,true); });
  state.player.flags.everHit=true;
  if(typeof recomputeAssets==="function") recomputeAssets(state);
  var d=mealData(); MEALS.slice(0,15).forEach(function(m){ if(m.quiz) d.solved[m.id]=true; else d.eaten[m.id]=true; });
  kikoMaybeWrite();

  var out={}, detail={};
  SCREENS.forEach(function(id){
    try{
      goto(id);
      var app=document.getElementById("app");
      var rows=[];
      var els=app.querySelectorAll("*");
      for(var i=0;i<els.length;i++){
        var e=els[i];
        // 揺れる部分は飛ばす（ホームの配信コメント・ハート・視聴者数・音量FAB）
        if(e.closest && e.closest(".hl-comments,.hl-hearts,.hl-viewers,#vol-fab,.hl-bubble")) continue;
        var s=getComputedStyle(e);
        var line=e.tagName+"."+(e.className&&e.className.baseVal!==undefined?"svg":String(e.className||""));
        for(var p=0;p<PROPS.length;p++) line+="|"+s[PROPS[p]];
        rows.push(fnv(line).toString(36));
      }
      out[id]={ n: rows.length, h: fnv(rows.join(",")).toString(36) };
      detail[id]=rows;
    }catch(err){ out[id]={ err: String(err).slice(0,40) }; }
  });
  try{ localStorage.setItem("__uiBase", JSON.stringify(detail)); }catch(e){}
  resetGame();
  return JSON.stringify(out);
})()
