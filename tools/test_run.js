// Headless test driver: node tools/test_run.js <script.json> [outdir]
// script: [{wait: frames} | {press: "Z"} | {hold: "ArrowDown", frames: n} | {shot: "name"} | {eval: "js"}]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const script = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const out = process.argv[3] || '/tmp/utshots';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const logs = [];
  page.on('console', m => { const t = m.text(); if (!/missing image|Failed to load resource/.test(t)) logs.push('[' + m.type() + '] ' + t); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?autostart&errors&seed=12345';
  await page.goto(url);
  await page.waitForFunction(() => window.UT && UT.running, null, { timeout: 120000 });
  // take manual control of frames for determinism
  await page.evaluate(() => { UT.paused = true; });
  const frames = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) UT.frame(); }, n);
  const keycode = (k) => ({ Z: 90, X: 88, C: 67, Enter: 13, Shift: 16, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Escape: 27 }[k] || k.charCodeAt(0));
  for (const st of script) {
    if (st.wait) await frames(st.wait);
    if (st.press) { const k = keycode(st.press); await page.evaluate((k) => UT.input.press(k), k); await frames(1); await page.evaluate((k) => UT.input.release(k), k); await frames(st.after || 1); }
    if (st.hold) { const k = keycode(st.hold); await page.evaluate((k) => UT.input.press(k), k); await frames(st.frames || 10); await page.evaluate((k) => UT.input.release(k), k); await frames(1); }
    if (st.type) { for (const ch of st.type) { const k = keycode(ch.toUpperCase()); await page.evaluate((k) => UT.input.press(k), k); await frames(1); await page.evaluate((k) => UT.input.release(k), k); await frames(1); } }
    if (st.goto) { await page.evaluate((n) => { const i = UT.D.rooms.findIndex(r => r.name === n); UT.gotoRoom(i); }, st.goto); await frames(st.frames || 20); }
    if (st.walkto) {
      const r = await page.evaluate(([tx, ty, maxf]) => {
        const mc = () => UT.firstOf(UT.objIndexByName.get('obj_mainchara'));
        let stuck = 0, last = null; const startRoom = UT.R.room;
        for (let f = 0; f < maxf; f++) {
          if (UT.R.room !== startRoom) { for (const k of [37, 38, 39, 40]) UT.input.release(k); for (let q = 0; q < 30; q++) UT.frame(); return { ok: true, roomchange: UT.D.rooms[UT.R.room].name }; }
          const m = mc(); if (!m) { UT.frame(); continue; }
          const dx = tx - m.x, dy = ty - m.y;
          if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) { for (const k of [37, 38, 39, 40]) UT.input.release(k); UT.frame(); return { ok: true, x: m.x, y: m.y, f }; }
          const want = new Set();
          if (dx > 2) want.add(39); else if (dx < -2) want.add(37);
          if (dy > 2) want.add(40); else if (dy < -2) want.add(38);
          for (const k of [37, 38, 39, 40]) { if (want.has(k)) { if (!UT.input.down(k)) UT.input.press(k); } else if (UT.input.down(k)) UT.input.release(k); }
          UT.frame();
          const m2 = mc(); const pos = m2 ? m2.x + ',' + m2.y : '';
          if (pos === last) { if (++stuck > 30) { for (const k of [37, 38, 39, 40]) UT.input.release(k); return { ok: false, stuck: true, x: m2 && m2.x, y: m2 && m2.y, room: UT.D.rooms[UT.R.room].name }; } } else stuck = 0;
          last = pos;
        }
        for (const k of [37, 38, 39, 40]) UT.input.release(k);
        const m = mc(); return { ok: false, x: m && m.x, y: m && m.y, room: UT.D.rooms[UT.R.room].name };
      }, [st.walkto[0], st.walkto[1], st.max || 600]);
      console.log('walkto', JSON.stringify(st.walkto), JSON.stringify(r));
      await frames(1);
    }
    if (st.talk) { for (let i = 0; i < st.talk; i++) { await page.evaluate(() => UT.input.press(90)); await frames(1); await page.evaluate(() => UT.input.release(90)); await frames(st.gap || 20); } }
    if (st.until) {
      const r = await page.evaluate(([expr, z, maxf]) => {
        const f = new Function('return (' + expr + ')');
        for (let i = 0; i < maxf; i++) {
          let ok = false; try { ok = f(); } catch (e) { ok = false; }
          if (ok) return { ok: true, i };
          if (z && i % 12 === 0) UT.input.press(90);
          UT.frame();
          if (z && i % 12 === 0) UT.input.release(90);
        }
        return { ok: false, room: UT.D.rooms[UT.R.room].name };
      }, [st.until, !!st.z, st.max || 3000]);
      console.log('until', st.until.slice(0, 60), JSON.stringify(r));
    }
    if (st.eval) { const r = await page.evaluate(st.eval); if (r !== undefined) console.log('eval:', st.full ? JSON.stringify(r) : JSON.stringify(r).slice(0, 2000)); }
    if (st.shot) { await page.screenshot({ path: path.join(out, st.shot + '.png'), clip: { x: 0, y: 0, width: 640, height: 480 } }); }
    if (st.state) {
      const s = await page.evaluate(() => ({ room: UT.D.rooms[UT.R.room].name, frame: UT.R.frame, n: UT.R.instances.length, objs: [...new Set(UT.R.instances.map(i => UT.D.objects[i.object_index].name))].slice(0, 40) }));
      console.log('state:', JSON.stringify(s));
    }
  }
  const errs = await page.evaluate(() => [...UT.R.errors.entries()].map(([k, v]) => v + 'x ' + k));
  console.log('--- GML errors (' + errs.length + ')'); errs.slice(0, 60).forEach(e => console.log(e));
  console.log('--- console'); logs.slice(0, 40).forEach(l => console.log(l));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
