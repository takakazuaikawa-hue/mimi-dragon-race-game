// 予想画面の下（相談役）を撮る。ミズ・セレスティア解禁前と、ドラゴン情報を開いた状態。音は消す。
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const D = process.env.TEMP + '/modern/';
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto((process.env.BASE_URL || 'http://localhost:8767') + '/?vnfast=1', { timeout: 120000 }); await p.waitForTimeout(4000);
  await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    setStoryFlag('_chapter_intro_1', true); state.player.completedRaces = 3;
    renderRaceDetail(nextRaceSuggestion().race); await sleep(1200);
    for (let i = 0; i < 40 && Dialogue.isOpen(); i++) { document.querySelector('[class*=dlg]')?.click(); await sleep(100); }
    document.querySelector('.advisor-hub').scrollIntoView({ block: 'start' }); window.scrollBy(0, -260); await sleep(300);
  });
  await p.screenshot({ path: D + 'adv_a.png' });
  await p.evaluate(async () => { const t = document.querySelector('.adv-tab[data-key=makura]'); t && t.click(); await new Promise(r => setTimeout(r, 400)); document.querySelector('.advisor-hub').scrollIntoView({ block: 'start' }); window.scrollBy(0, -40); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: D + 'adv_b.png' });
  console.log(errs.slice(0, 3));
  await b.close();
})();
