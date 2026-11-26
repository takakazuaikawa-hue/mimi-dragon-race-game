// 予想画面 v2 を撮る：選ぶ前／単勝で1頭選んだ（賭け札は畳んだまま）／賭け札を広げた／ワイド＋見る。音は消す。
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const D = process.env.TEMP + '/modern/';
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio'] });
  for (const [W, H, tag] of [[390, 844, 'm'], [360, 640, 's'], [470, 836, 'p']]) {
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto((process.env.BASE_URL || 'http://localhost:8767') + '/?vnfast=1'); await p.waitForTimeout(2500);
    const sleep = ms => p.waitForTimeout(ms);
    await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      setStoryFlag('_chapter_intro_1', true); state.player.completedRaces = 3; state.ui.slipOpen = false;
      renderRaceDetail(nextRaceSuggestion().race); await sleep(1200);
      for (let i = 0; i < 40 && Dialogue.isOpen(); i++) { document.querySelector('[class*=dlg]')?.click(); await sleep(100); }
      window.scrollTo(0, 0);
    });
    await sleep(300); await p.screenshot({ path: D + 'p2_a_' + tag + '.png' });
    await p.evaluate(() => document.querySelectorAll('.bet-pick-card')[1].click()); await sleep(300);
    await p.screenshot({ path: D + 'p2_b_' + tag + '.png' });
    await p.evaluate(() => document.getElementById('slip-mini').click()); await sleep(300);
    await p.screenshot({ path: D + 'p2_c_' + tag + '.png' });
    const info = await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      document.getElementById('slip-fold').click();
      document.querySelector('.bet-tabs button[data-type=wide]').click(); await sleep(150);
      const cards = [...document.querySelectorAll('.bet-pick-card')]; cards[2].click(); await sleep(100);
      const mb = cards[3].querySelector('.bp-more'); mb.click(); await sleep(100); mb.click(); await sleep(500);
      cards[0].scrollIntoView({ block: 'start' }); window.scrollBy(0, -170); await sleep(300);
      const over = [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1); }).slice(0, 4).map(e => e.className);
      const slipH = Math.round(document.querySelector('.bd-slip').getBoundingClientRect().height);
      return { over, slipH, docW: document.documentElement.scrollWidth };
    });
    await p.screenshot({ path: D + 'p2_d_' + tag + '.png' });
    console.log(tag, JSON.stringify(info), errs.slice(0, 3));
    await p.close();
  }
  await b.close();
})();
