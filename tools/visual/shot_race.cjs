// レース中の画面全体と、ゴール直後（結果を見る の前）を撮る。音は消す。
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const D = process.env.TEMP + '/modern/';
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio'] });
  for (const [W, H, tag] of [[390, 844, 'm'], [360, 640, 's']]) {
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto((process.env.BASE_URL || 'http://localhost:8767') + '/?vnfast=1'); await p.waitForTimeout(2500);
    await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)); const T = b => b.textContent.trim().replace(/\s+/g, ' ');
      const B = re => [...document.querySelectorAll('button')].find(b => b.offsetParent && !b.disabled && re.test(T(b)) && !/🔊|スキップ/.test(T(b)));
      setStoryFlag('_chapter_intro_1', true); state.player.completedRaces = 3;
      renderRaceDetail(nextRaceSuggestion().race); await sleep(1200);
      for (let i = 0; i < 40 && Dialogue.isOpen(); i++) { document.querySelector('[class*=dlg]')?.click(); await sleep(100); }
      B(/^ワイド/)?.click(); await sleep(100); const c = document.querySelectorAll('.bet-pick-card'); c[1].click(); c[4].click(); await sleep(200);
      for (let k = 0; k < 8 && state.ui.screen === 'race_detail'; k++) { (B(/千切って出走/) || B(/好み$/) || B(/出走直前/) || B(/わかった|閉じる/))?.click(); await sleep(600); }
    });
    await p.waitForTimeout(16000);
    await p.screenshot({ path: D + 'v2_mid_' + tag + '.png' });
    const m = await p.evaluate(() => ({ docH: document.documentElement.scrollHeight, vh: innerHeight, stage: Math.round(document.querySelector('.rc-stage').getBoundingClientRect().height) }));
    await p.evaluate(async () => { const sp = [...document.querySelectorAll('.rc-spd')][2]; sp && sp.click(); });
    await p.waitForFunction(() => !!document.querySelector('.rc-wrap.rc-ended'), null, { timeout: 120000 });
    await p.waitForTimeout(4500);
    await p.screenshot({ path: D + 'v2_end_' + tag + '.png' });
    const m2 = await p.evaluate(() => ({ docH: document.documentElement.scrollHeight, vh: innerHeight, next: !!document.querySelector('.rc-next') && document.querySelector('.rc-next').getBoundingClientRect().bottom <= innerHeight }));
    console.log(tag, JSON.stringify({ m, m2, errs: errs.slice(0, 3) }));
    await p.close();
  }
  await b.close();
})();
