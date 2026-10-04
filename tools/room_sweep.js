// Visit every room after starting a new game, run frames, collect GML errors per room and thumbnails.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp/sweep'; const from = +(process.argv[3] || 0), to = +(process.argv[4] || 9999);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const logs = []; page.on('pageerror', e => logs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?autostart&errors&seed=1');
  await page.waitForFunction(() => window.UT && UT.running, null, { timeout: 120000 });
  await page.evaluate(() => { UT.paused = true; for (let i = 0; i < 30; i++) UT.frame(); });
  const n = await page.evaluate(() => UT.D.rooms.length);
  const res = [];
  for (let r = from; r < Math.min(n, to); r++) {
    const info = await page.evaluate((r) => {
      const before = new Map(UT.R.errors);
      let exc = null;
      try {
        UT.R.GL.interact = 0; UT.gotoRoom(r);
        for (let i = 0; i < 90; i++) { UT.frame(); if (!UT.running) { UT.running = true; } }
      } catch (e) { exc = String(e && e.message || e); }
      const errs = [...UT.R.errors.entries()].filter(([k, v]) => (before.get(k) || 0) !== v).map(([k]) => k);
      return { r, name: UT.D.rooms[r].name, now: UT.D.rooms[UT.R.room].name, n: UT.R.instances.length, errs, exc };
    }, r);
    res.push(info);
    if (info.errs.length || info.exc) console.log(r, info.name, '->', info.now, JSON.stringify(info.errs).slice(0, 600), info.exc || '');
    await page.screenshot({ path: path.join(out, String(r).padStart(3, '0') + '_' + info.name + '.png') });
  }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(res, null, 1));
  console.log('pageerrors', logs.slice(0, 20));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
