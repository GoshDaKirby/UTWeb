// Undertale web port - audio (GameMaker audio_* semantics on top of HTMLAudioElement)
'use strict';
(function () {
  const UT = window.UT;
  const A = UT.audio = {
    base: '', assets: [], playing: new Map(), nextId: 1, masterVolume: 1, unlocked: false,
  };
  // per-asset state: gain & pitch (GameMaker lets you set these on the asset index)
  function asset(i) {
    let a = A.assets[i];
    if (!a) {
      const s = UT.D.sounds[i];
      a = A.assets[i] = { idx: i, src: s ? A.base + s.file : '', vol: s && isFinite(s.volume) && s.volume !== null ? s.volume : 1, gain: 1, pitch: 1, fade: null, pool: [] };
    }
    return a;
  }
  // Browsers may refuse to start sounds before (or, in some embedded views, without) a fresh user gesture.
  // Anything refused is remembered and retried on the next key press or click.
  const blocked = new Set();
  function retryBlocked() {
    for (const p of [...blocked]) {
      blocked.delete(p);
      if (p.done || p.paused) continue;
      const pr = p.el.play(); if (pr && pr.catch) pr.catch(() => blocked.add(p));
    }
  }
  window.addEventListener('keydown', retryBlocked, true);
  window.addEventListener('pointerdown', retryBlocked, true);
  let warned = false;
  function warn(msg) {
    if (warned) return; warned = true;
    console.warn('[audio] ' + msg);
    const st = document.getElementById('status'); if (st) { st.textContent = msg; setTimeout(() => { if (st.textContent === msg) st.textContent = ''; }, 8000); }
  }
  A.oggOK = (() => { try { return new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== ''; } catch (e) { return true; } })();
  function makeEl(a) {
    let el = a.pool.pop();
    if (!el) {
      el = new Audio(a.src);
      el.preload = 'auto';
      el.addEventListener('error', () => {
        if (/\.ogg$/i.test(a.src) && !A.oggOK) warn('This browser cannot play the game\'s .ogg music. Use Chrome, Edge or Firefox.');
        else warn('Could not load sound file ' + a.src + ' (is the undertale-master folder complete?)');
      });
    }
    el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false;
    return el;
  }
  function applyVolume(p) {
    const a = p.asset;
    let v = a.vol * a.gain * p.gain * A.masterVolume; v = isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    try { p.el.volume = v; } catch (e) { /* ignore */ }
    const rate = Math.max(0.0625, Math.min(16, a.pitch * p.pitch));
    try { if (p.el.playbackRate !== rate) p.el.playbackRate = rate; } catch (e) { /* ignore */ }
  }
  A.play = function (idx, loop) {
    idx = UT.$num(idx);
    if (!UT.D.sounds[idx]) return -1;
    const a = asset(idx);
    const el = makeEl(a);
    el.loop = !!loop;
    const id = 300000 + A.nextId++;
    const p = { id, asset: a, el, gain: 1, pitch: 1, fade: null, paused: false, done: false };
    A.playing.set(id, p);
    el.currentTime = 0;
    applyVolume(p);
    const pr = el.play();
    if (pr && pr.catch) pr.catch((err) => { if (err && err.name === 'NotAllowedError') blocked.add(p); });
    el.onended = () => { if (!el.loop) finish(p); };
    return id;
  };
  function finish(p) {
    if (p.done) return;
    p.done = true;
    try { p.el.pause(); } catch (e) { /* ignore */ }
    A.playing.delete(p.id);
    blocked.delete(p);
    if (p.asset.pool.length < 8) p.asset.pool.push(p.el);
    else { try { p.el.removeAttribute('src'); p.el.load(); } catch (e) { /* ignore */ } } // free the media player
  }
  // resolve an index-or-instance argument into playing entries
  function entries(x) {
    x = UT.$num(x);
    if (x >= 300000) { const p = A.playing.get(x); return p ? [p] : []; }
    const out = []; for (const p of A.playing.values()) if (p.asset.idx === x) out.push(p); return out;
  }
  A.stop = function (x) { for (const p of entries(x)) finish(p); };
  A.stopAll = function () { for (const p of [...A.playing.values()]) finish(p); };
  A.isPlaying = function (x) { return entries(x).some(p => !p.done && !p.paused) ? 1 : 0; };
  A.pause = function (x) { for (const p of entries(x)) { p.paused = true; try { p.el.pause(); } catch (e) { /* ignore */ } } };
  A.resume = function (x) { for (const p of entries(x)) { if (p.paused) { p.paused = false; const pr = p.el.play(); if (pr && pr.catch) pr.catch((err) => { if (err && err.name === 'NotAllowedError') blocked.add(p); }); } } };
  A.gain = function (x, vol, ms) {
    x = UT.$num(x); vol = UT.$num(vol); ms = UT.$num(ms);
    const target = x >= 300000 ? entries(x) : [asset(x)];
    if (x >= 300000 && !target.length) return;
    for (const t of target) {
      if (ms > 0) t.fade = { from: t.gain, to: vol, start: performance.now(), dur: ms };
      else { t.fade = null; t.gain = vol; }
    }
    if (x < 300000) for (const p of entries(x)) { if (ms <= 0) { p.gain = 1; } }
    for (const p of A.playing.values()) applyVolume(p);
  };
  A.getGain = function (x) { x = UT.$num(x); if (x >= 300000) { const e = entries(x)[0]; return e ? e.gain * e.asset.gain : 0; } return asset(x).gain; };
  A.pitch = function (x, v) {
    x = UT.$num(x); v = UT.$num(v);
    if (x >= 300000) for (const p of entries(x)) p.pitch = v; else asset(x).pitch = v;
    for (const p of A.playing.values()) applyVolume(p);
  };
  A.getPitch = function (x) { x = UT.$num(x); if (x >= 300000) { const e = entries(x)[0]; return e ? e.pitch * e.asset.pitch : 1; } return asset(x).pitch; };
  A.getPos = function (x) { const e = entries(x)[0]; return e ? e.el.currentTime : 0; };
  A.setPos = function (x, t) { for (const e of entries(x)) { try { e.el.currentTime = UT.$num(t); } catch (er) { /* ignore */ } } };
  A.update = function () {
    const now = performance.now();
    const step = (t) => {
      if (!t.fade) return false;
      const k = Math.min(1, (now - t.fade.start) / t.fade.dur);
      t.gain = t.fade.from + (t.fade.to - t.fade.from) * k;
      if (k >= 1) t.fade = null;
      return true;
    };
    let any = false;
    for (const a of A.assets) if (a && step(a)) any = true;
    for (const p of A.playing.values()) if (step(p)) any = true;
    if (any) for (const p of A.playing.values()) applyVolume(p);
  };
  A.setMaster = function (v) { A.masterVolume = v; for (const p of A.playing.values()) applyVolume(p); };
})();
