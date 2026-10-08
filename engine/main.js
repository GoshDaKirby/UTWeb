// Undertale web port - page bootstrap: asset loading, main loop, window chrome
'use strict';
(function () {
  const UT = window.UT;
  const cfg = window.UT_CONFIG || {};
  const base = cfg.assetBase || 'undertale-master/';
  const $ = (id) => document.getElementById(id);

  function setStatus(t) { const el = $('status'); if (el) el.textContent = t; }

  function fit() {
    const wrap = $('screen'); const c = UT.G.canvas;
    // on touch devices the on-screen controls take the sides (landscape) or the bottom (portrait)
    let area = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    if (UT.touch && UT.touch.active) area = UT.touch.layout();
    Object.assign($('wrap').style, { left: area.x + 'px', top: area.y + 'px', width: area.w + 'px', height: area.h + 'px', right: 'auto', bottom: 'auto' });
    const W = area.w, H = area.h;
    let scale = Math.min(W / 640, H / 480);
    if (cfg.integerScale !== false && scale >= 1) scale = Math.max(1, Math.floor(scale * 100) / 100);
    c.style.width = Math.floor(640 * scale) + 'px'; c.style.height = Math.floor(480 * scale) + 'px';
    wrap.style.width = c.style.width; wrap.style.height = c.style.height;
  }
  UT.applyWindowOffset = function () {
    const o = UT.windowOffset || [0, 0];
    $('screen').style.transform = 'translate(' + o[0] + 'px,' + o[1] + 'px)';
  };
  UT.setFullscreen = function (on) {
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) { /* ignore */ }
  };
  UT.gameEnded = function () {
    UT.running = false;
    if (UT.audio) UT.audio.stopAll();
    const ov = $('ended'); if (ov) ov.style.display = 'flex';
  };
  UT.onError = function (msg) {
    const box = $('errors'); if (!box) return;
    if (!cfg.showErrors) return;
    box.style.display = 'block';
    const d = document.createElement('div'); d.textContent = msg; box.appendChild(d);
    while (box.childNodes.length > 8) box.removeChild(box.firstChild);
  };

  // fixed 30 fps loop driven by requestAnimationFrame
  let acc = 0, last = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!UT.running || UT.paused) { last = t; return; }
    const dt = Math.min(250, t - (last || t)); last = t;
    const step = 1000 / (UT.R.room_speed || 30);
    acc += dt;
    let n = 0;
    while (acc >= step && n < 4) { acc -= step; n++; UT.frame(); if (!UT.running) break; }
    if (n === 4) acc = 0;
  }
  UT.startLoop = function () { UT.running = true; last = 0; acc = 0; requestAnimationFrame(loop); };

  async function start() {
    const c = UT.G.canvas = $('game');
    c.width = 640; c.height = 480;
    UT.G.ctx = c.getContext('2d', { alpha: false });
    UT.G.ctx.imageSmoothingEnabled = false;
    fit(); window.addEventListener('resize', fit); window.addEventListener('orientationchange', () => setTimeout(fit, 150));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    if (!window.UT_DATA || !window.UT_CODE) { setStatus('Game data missing: run the build step (see README).'); return; }
    UT.D = window.UT_DATA;
    UT.audio.base = base;
    setStatus('Loading graphics...');
    const failures = await UT.loadAssets(base, (d, t) => setStatus('Loading graphics... ' + Math.floor(d / t * 100) + '%'));
    const total = UT.D.sprites.reduce((a, s) => a + s.frames.length, 0) + UT.D.backgrounds.length + UT.D.fonts.length;
    if (failures > total * 0.9) {
      setStatus('Could not find the game files. Put the "undertale-master" folder next to index.html (see README).');
      return;
    }
    if (failures > 0) {
      console.warn(failures + ' images failed to load');
      if (failures > 100) {
        setStatus(failures + ' images failed to load. Reload the page, or add ?par=4 to the address to load fewer at once (see README).');
        return;
      }
    }
    UT.assetsReady = true;
    setStatus(UT.touch && UT.touch.active ? 'Tap to start' : 'Click or press any key to start');
    $('start').style.display = 'flex';
    const go = (e) => {
      // clicks and key presses on the save buttons belong to them, not to starting the game
      const inSaves = e && e.target && e.target.closest && e.target.closest('#saves');
      if (inSaves && (e.type === 'pointerdown' || e.key === 'Enter' || e.key === ' ')) return;
      if (UT.started) return; UT.started = true;
      $('start').style.display = 'none'; setStatus('');
      window.removeEventListener('keydown', go, true); window.removeEventListener('pointerdown', go, true);
      // prime audio (browser autoplay rules need a gesture)
      try { const a = new Audio(); a.play().catch(() => {}); } catch (e) { /* ignore */ }
      UT.input.clearAll();
      UT.boot();
      UT.startLoop();
    };
    wireSaves();
    if (cfg.autostart) { go(); return; }
    window.addEventListener('keydown', go, true); window.addEventListener('pointerdown', go, true);
  }
  // Export / import buttons on the start screen. They only exist before the game starts, so the game never
  // has a save file open while it is being replaced.
  function wireSaves() {
    const msg = (t) => { $('saveMsg').textContent = t; };
    const n = UT.saves.count();
    msg(n ? '' : 'No save data in this browser yet.');
    $('saveExport').onclick = () => {
      $('saveExport').blur();
      if (!UT.saves.count()) { msg('There is no save data to export yet.'); return; }
      const blob = new Blob([UT.saves.exportText()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'undertale_save_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      msg('Save exported (' + UT.saves.count() + ' files).');
    };
    $('saveImport').onclick = () => { $('saveImport').blur(); $('saveFile').value = ''; $('saveFile').click(); };
    $('saveFile').onchange = () => {
      const f = $('saveFile').files[0]; if (!f) return;
      if (UT.saves.count() && !window.confirm('Importing replaces the save data currently in this browser. Continue?')) return;
      f.text().then((t) => {
        try { const k = UT.saves.importText(t); msg('Save imported (' + k + ' files). Start the game to continue from it.'); }
        catch (err) { msg(err.message); }
      });
    };
  }
  UT.restartFromEnded = function () { $('ended').style.display = 'none'; UT.restartGame(); UT.startLoop(); };
  window.addEventListener('DOMContentLoaded', start);
})();
