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
    const W = window.innerWidth, H = window.innerHeight - (document.fullscreenElement ? 0 : 0);
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
    fit(); window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    if (!window.UT_DATA || !window.UT_CODE) { setStatus('Game data missing: run the build step (see README).'); return; }
    UT.D = window.UT_DATA;
    UT.audio.base = base;
    setStatus('Loading graphics...');
    const failures = await UT.loadAssets(base, (d, t) => setStatus('Loading graphics... ' + Math.floor(d / t * 100) + '%'));
    if (failures > 100) {
      setStatus('Could not find the game files. Put the "undertale-master" folder next to index.html (see README).');
      return;
    }
    UT.assetsReady = true;
    setStatus('Click or press any key to start');
    $('start').style.display = 'flex';
    const go = () => {
      if (UT.started) return; UT.started = true;
      $('start').style.display = 'none'; setStatus('');
      window.removeEventListener('keydown', go, true); window.removeEventListener('pointerdown', go, true);
      // prime audio (browser autoplay rules need a gesture)
      try { const a = new Audio(); a.play().catch(() => {}); } catch (e) { /* ignore */ }
      UT.input.clearAll();
      UT.boot();
      UT.startLoop();
    };
    if (cfg.autostart) { go(); return; }
    window.addEventListener('keydown', go, true); window.addEventListener('pointerdown', go, true);
  }
  UT.restartFromEnded = function () { $('ended').style.display = 'none'; UT.restartGame(); UT.startLoop(); };
  window.addEventListener('DOMContentLoaded', start);
})();
