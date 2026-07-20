# アイコンボタンの中央ズレを実機で洗い出す

記号ひと文字（← ✕ ▶ 🙂 …）だけのボタンは、`padding` や `line-height` の
実測値で寄せると、フォントや文字が変わった瞬間に光学中心がズレる。
正本は style.css の **★ICON-BTN CENTERING** のセレクタ一覧で、
新しいアイコンボタンはそこに足す約束になっている。

**足し忘れるとそのボタンだけ静かにズレる。** 実際に表情ボタン
（`.mv-expr` / `.scm-expr-b`）が未登録で、横10〜11px・縦2.5〜6px ずれていた。
目視では気づきにくいので、下のコードをブラウザのコンソールに貼って測る。

やっていることは「ボタンの箱の中心」と「実際の字形の中心」を比べるだけ。
1.5px を超えてズレていたら、そのクラスを ICON-BTN CENTERING に足す。

```js
(async()=>{
var W=ms=>new Promise(r=>setTimeout(r,ms));
var found={};
function measure(){
  [].slice.call(document.querySelectorAll("button, .mv-expr, .scm-expr-b")).forEach(function(b){
    if(!b.offsetParent) return;
    var t=(b.textContent||"").trim();
    if(!t || Array.from(t).length>2) return;      // 記号1〜2文字だけが対象
    if(b.querySelector("img,svg")) return;         // 画像アイコンは別問題
    var cls=(b.className||"").split(" ").filter(Boolean).join(".");
    if(!cls||found[cls]) return;
    var r=b.getBoundingClientRect();
    var node=[].slice.call(b.childNodes).find(n=>n.nodeType===3&&n.textContent.trim());
    if(!node) return;
    var rg=document.createRange(); rg.selectNodeContents(node);
    var tr=rg.getBoundingClientRect();
    found[cls]={dx:+(((tr.left+tr.right)/2)-((r.left+r.right)/2)).toFixed(1),
                dy:+(((tr.top+tr.bottom)/2)-((r.top+r.bottom)/2)).toFixed(1)};
  });
}
var screens=["home","mall","assets","meals","race_select","sns","story","konron_map","scout","dex"];
for(var i=0;i<screens.length;i++){ try{goto(screens[i]);}catch(e){} await W(500); measure(); }
try{ renderHome(); await W(400); document.querySelector(".hl-dress").click(); await W(600); measure(); }catch(e){}
var bad=Object.keys(found).filter(k=>Math.abs(found[k].dx)>1.5||Math.abs(found[k].dy)>1.5);
console.log("調べた種類:",Object.keys(found).length);
console.log("ズレている:",bad.length?bad.map(k=>k+" 横"+found[k].dx+" 縦"+found[k].dy):"なし");
})()
```

最後に測った結果（2026-07-21）: 17種・ズレなし。
