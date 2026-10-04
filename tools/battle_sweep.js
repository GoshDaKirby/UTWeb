// Screenshot every battle group: node tools/battle_sweep.js outdir [from] [to]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp/bsweep'; const from = +(process.argv[3] || 1), to = +(process.argv[4] || 120);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 640, height: 480 } });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?autostart&seed=1');
  await p.waitForFunction(() => window.UT && UT.running, null, { timeout: 120000 });
  await p.evaluate(() => { UT.paused = true; for (let i = 0; i < 30; i++) UT.frame(); UT.R.GL.plot = 30; });
  for (let g = from; g <= to; g++) {
    const r = await p.evaluate((g) => {
      const before = new Map(UT.R.errors);
      UT.R.GL.currentroom = UT.D.rooms.findIndex(r => r.name == 'room_ruins3'); UT.R.GL.battlegroup = g; UT.R.GL.hp = 20;
      UT.gotoRoom(UT.D.rooms.findIndex(r => r.name == 'room_battle'));
      for (let i = 0; i < 45; i++) { UT.frame(); if (!UT.running) UT.running = true; }
      const mons = [...new Set(UT.R.instances.map(i => UT.D.objects[i.object_index].name))].filter(n => !/bt$|border|heart$|hpname|battlecontroller|obj_time|obj_screen|WRITER|battlebg/.test(n));
      const errs = [...UT.R.errors.entries()].filter(([k, v]) => (before.get(k) || 0) !== v).map(([k]) => k);
      return { room: UT.D.rooms[UT.R.room].name, mons, errs };
    }, g);
    await p.screenshot({ path: path.join(out, String(g).padStart(3, '0') + '.png') });
    console.log(g, r.room, r.mons.join(','), r.errs.length ? 'ERR ' + r.errs.join(' | ').slice(0, 300) : '');
  }
  await b.close();
})();
