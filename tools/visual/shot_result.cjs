// 答え合わせ：当たり・外れの両方を作り、理由の箱（順位の移り変わり）まで送って撮る。音は消す。
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const D = process.env.TEMP + '/modern/';
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio'] });
  for (const [idx, tag] of [[0, 'a'], [7, 'b']]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto((process.env.BASE_URL || 'http://localhost:8767') + '/?vnfast=1'); await p.waitForTimeout(2500);
    await p.evaluate(async (idx) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)); const T = b => b.textContent.trim().replace(/\s+/g, ' ');
      const B = re => [...document.querySelectorAll('button')].find(b => b.offsetParent && !b.disabled && re.test(T(b)) && !/🔊|スキップ/.test(T(b)));
      setStoryFlag('_chapter_intro_1', true); state.player.completedRaces = 3;
      renderRaceDetail(nextRaceSuggestion().race); await sleep(1200);
      for (let i = 0; i < 40 && Dialogue.isOpen(); i++) { document.querySelector('[class*=dlg]')?.click(); await sleep(100); }
      document.querySelector('.bet-tabs button[data-type=place]').click(); await sleep(100);
      document.querySelectorAll('.bet-pick-card')[idx].click(); await sleep(200);
      for (let k = 0; k < 8 && state.ui.screen === 'race_detail'; k++) { (B(/千切って出走/) || B(/好み$/) || B(/出走直前/) || B(/わかった|閉じる/))?.click(); await sleep(600); }
      await sleep(1500); document.querySelector('.rc-skip')?.click();
      const t0 = Date.now(); while (state.ui.screen !== 'result' && Date.now() - t0 < 60000) { (B(/結果を見る/) || document.querySelector('.rc-skip'))?.click(); await sleep(600); }
      await sleep(3500);
      const r = document.querySelector('.rs-reason'); if (r) { r.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }
      await sleep(400);
    }, idx);
    await p.screenshot({ path: D + 'res_' + tag + '.png' });
    console.log(tag, errs.slice(0, 3));
    await p.close();
  }
  await b.close();
})();
