(function (root) {
  'use strict';
  const C = root.IslandCare;
  function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  const coins = n => Number(n).toLocaleString('ja-JP') + 'コイン';
  let visualSequence = 0;
  function carrier(paid) {
    const id = 'care-material-' + (++visualSequence), scene = node('div', 'care-carrier' + (paid ? ' is-repaired' : ''));
    scene.innerHTML = `<svg viewBox="0 0 320 150" role="img" aria-label="${paid ? '留め具を締め、甕を安定して載せた運び架' : '縄と留め具が緩んだ、甕の運び架'}"><defs><linearGradient id="${id}-wood" x2="0" y2="1"><stop stop-color="#d8ad70"/><stop offset=".5" stop-color="#94714b"/><stop offset="1" stop-color="#5b4434"/></linearGradient><linearGradient id="${id}-jar"><stop stop-color="#285665"/><stop offset=".35" stop-color="#8fb8b8"/><stop offset=".7" stop-color="#416f79"/><stop offset="1" stop-color="#23434f"/></linearGradient></defs><ellipse cx="160" cy="137" rx="120" ry="9" fill="#07171c" opacity=".65"/><g fill="url(#${id}-wood)" stroke="#4c382c" stroke-width="2"><path d="M49 35h13v103H49zM258 35h13v103h-13z"/><path d="M39 25h242v14H39zM45 118h229v13H45z"/>${paid ? '<path d="m62 109 5 8 184-70-4-9z"/>' : ''}</g><g stroke="#e4c18b" opacity=".35"><path d="M46 29h228M69 122h184M55 42v69M265 42v69"/></g><path class="care-rope" d="M60 32q100 ${paid ? 6 : 24} 200 0" fill="none" stroke="#c8ab72" stroke-width="4"/><g class="care-jars" fill="url(#${id}-jar)" stroke="#213f49" stroke-width="2"><path d="M93 58h34v10q17 12 13 36l-7 14H88l-6-14q-3-24 11-36zM182 58h34v10q17 12 13 36l-7 14h-45l-6-14q-3-24 11-36z"/><ellipse cx="110" cy="58" rx="17" ry="5" fill="#183942"/><ellipse cx="199" cy="58" rx="17" ry="5" fill="#183942"/><path d="M93 82q16 8 34 0M182 82q16 8 34 0" fill="none" stroke="#bdd4ca" stroke-width="3" opacity=".7"/></g><g class="care-fastener"><circle cx="60" cy="32" r="8" fill="#b99b64" stroke="#e9d09a" stroke-width="2"/><path d="m56 31 8 2" stroke="#514c40" stroke-width="3"/></g><circle cx="265" cy="32" r="5" fill="#d7c198"/></svg>`;
    const inspect = node('button', 'secondary care-inspect', paid ? '直した留め具を、確かめる' : '留め具を、そっと確かめる');
    const response = node('p', 'care-touch-note', paid ? '水番と締めた縄が、甕を支えている。' : '水番が、架をこちらへ寄せてくれた。'); response.setAttribute('aria-live', 'polite');
    inspect.onclick = () => {
      scene.classList.remove('is-testing'); void scene.offsetWidth; scene.classList.add('is-testing');
      response.textContent = paid ? '留め具は動かず、甕も傾かない。水番がうなずいた。「雨の日も、途中で持ち替えずに運べるよ」' : '留め具がずれて、縄がたるんだ。水番が甕を支える。「雨で重くなると、途中で持ち替えなきゃいけないんだ」';
    };
    scene.append(inspect, response); return scene;
  }
  function go() { if (typeof kmGotoSpot === 'function') kmGotoSpot(C.job.spotId); }
  function previews(p) {
    if (!root.ShinganFestival || !root.ShinganRecovery) return [];
    const current = ShinganFestival.capture(p, { poroFound: typeof poroFound === 'function' && poroFound() });
    const snapshot = { ...current, care: null };
    const withCare = { ...snapshot, care: { waterCarrier: { cost: C.job.cost } } };
    const base = ShinganRecovery.view(ShinganRecovery.opening([]), [], snapshot);
    return [1, 2, 3, 4].map(period => {
      const a = ShinganRecovery.quote({ ...base, period }, { desk: 'market', contract: 'local' }, snapshot);
      const b = ShinganRecovery.quote({ ...base, period }, { desk: 'market', contract: 'local' }, withCare);
      return { label: a.periodLabel, before: a.deliverable, after: b.deliverable };
    });
  }
  root.appendIslandCareOffer = function (host, caseId, atPlace) {
    if (!C || caseId && caseId !== C.job.caseId) return;
    const p = state.player, v = C.offer(p);
    if (!v.known) return;
    const box = node('section', 'card care-offer');
    box._refreshIslandCare = () => {
      const parent = box.parentElement, next = box.nextSibling; if (!parent) return;
      box.remove(); const replacement = root.appendIslandCareOffer(parent, caseId, atPlace);
      if (replacement && next?.parentElement === parent) parent.insertBefore(replacement, next);
    };
    box.append(node('small', 'care-kicker', '今ある仕事を、手入れする'), node('h3', '', v.title));
    const image = node('img', 'care-image'); image.src = v.image; image.alt = '手入れを続ける共同配水小屋'; box.appendChild(image);
    if (atPlace) box.appendChild(carrier(v.paid));
    if (v.paid) {
      box.append(node('p', 'care-thanks', '水番は新しい留め具を確かめて、甕を運び架に載せた。「これなら、雨の日も一度で運べる。明日も、あの屋台へ届けるよ」'), node('p', '', '材料代300コインを払い、一緒に直した記録が残っている。雨の朝市では、地元への納入枠が営業日ごとに一口増える。'));
    } else {
      box.append(node('p', '', v.detail), node('p', 'care-budget', '材料代 ' + coins(v.cost) + ' ／ 所持 ' + coins(v.coins) + (v.affordable ? ' → 手元に ' + coins(v.remaining) : ' ／ ' + coins(v.cost - v.coins) + '足りない')));
      box.appendChild(node('p', '', '雨の朝市で、屋台へ渡せる枠が営業日ごとに一口増える。注文がない分まで売れたことにはしない。'));
      if (!atPlace) {
        const visit = node('button', 'secondary', '配水小屋で、水番と実物を見る'); visit.onclick = go; box.appendChild(visit);
      } else {
        const buy = node('button', 'care-buy', '材料代300コインを払い、水番と直す'); buy.disabled = !v.affordable;
        buy.onclick = () => {
          if (state.player !== p) return;
          const result = C.purchase(p);
          if (!result.ok) { showInfoPopup('水番との手入れ', result.error); return; }
          const oldCoins = p.coins, hadCare = Object.hasOwn(p, 'islandCare'), oldCare = p.islandCare;
          p.coins = result.coins; p.islandCare = result.care;
          let saved = false; try { saved = saveGame() !== false; } catch (_) {}
          if (!saved) {
            p.coins = oldCoins; if (hadCare) p.islandCare = oldCare; else delete p.islandCare;
            showInfoPopup('手入れの記録', '記録を保存できませんでした。材料代は引いていません。保存できる状態にして、もう一度お試しください。'); return;
          }
          if (typeof recomputeAssets === 'function') recomputeAssets(state);
          if (typeof updateHeader === 'function') updateHeader();
          if (typeof _kmRenderPanel === 'function') _kmRenderPanel();
        };
        box.appendChild(buy);
        if (!v.affordable) box.appendChild(node('p', '', '今日は見送っても、発見や企画書は残る。'));
      }
    }
    const rows = previews(p);
    if (rows.length) {
      const details = node('details', 'care-forecast'); details.appendChild(node('summary', '', 'どの季節の、何口が変わる？'));
      details.appendChild(node('p', '', 'いまの施設と注文で、地元予約の受渡しを比較。季節ごとに計算した見通しです。'));
      rows.forEach(r => details.appendChild(node('p', '', r.label + '：' + r.before + '口 → ' + r.after + '口' + (r.before === r.after ? '（この季は納入数が変わらない）' : ''))));
      box.appendChild(details);
    }
    if (v.paid && !atPlace) { const visit = node('button', 'secondary', '手入れした配水小屋へ会いに戻る'); visit.onclick = go; box.appendChild(visit); }
    host.appendChild(box);
    return box;
  };
  root.refreshIslandCareOffers = function () {
    document.querySelectorAll('.care-offer').forEach(box => { if (typeof box._refreshIslandCare === 'function') box._refreshIslandCare(); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
