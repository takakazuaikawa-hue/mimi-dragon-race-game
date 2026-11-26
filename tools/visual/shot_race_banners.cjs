// レースを最初から最後まで、0.7秒ごとに走る絵(canvas)だけを撮る。音は消す。 node frames.cjs <prefix>
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const pre = process.argv[2] || 'f';
const D = process.env.TEMP + '/frames/';
require('fs').mkdirSync(D, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto((process.env.BASE_URL || 'http://localhost:8767') + '/?vnfast=1'); await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)); const T = b => b.textContent.trim().replace(/\s+/g, ' ');
    const B = re => [...document.querySelectorAll('button')].find(b => b.offsetParent && !b.disabled && re.test(T(b)) && !/🔊|スキップ/.test(T(b)));
    setStoryFlag('_chapter_intro_1', true); state.player.completedRaces = 3;
    renderRaceDetail(nextRaceSuggestion().race); await sleep(1200);
    for (let i = 0; i < 40 && Dialogue.isOpen(); i++) { document.querySelector('[class*=dlg]')?.click(); await sleep(100); }
    B(/^単勝/)?.click(); await sleep(100); document.querySelectorAll('.bet-pick-card')[3].click(); await sleep(200);
    for (let k = 0; k < 8 && state.ui.screen === 'race_detail'; k++) { (B(/千切って出走/) || B(/好み$/) || B(/出走直前/) || B(/わかった|閉じる/))?.click(); await sleep(600); }
    const two = [...document.querySelectorAll('.rc-spd')][0]; two && two.click();
  });
  await p.waitForSelector('#rc-canvas', { timeout: 30000 }); const cv = await p.$('#rc-canvas');
  let i = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const done = await p.evaluate(() => state.ui.screen !== 'race_run' || !!document.querySelector('.rc-wrap.rc-ended'));
    await p.screenshot({ path: D + pre + '_' + String(i).padStart(3, '0') + '.png', clip: { x: 0, y: 150, width: 390, height: 260 } });
    i++; void done;
    await p.waitForTimeout(150);
  }
  console.log(JSON.stringify({ frames: i, errs: errs.slice(0, 3) }));
  await b.close();
})();
