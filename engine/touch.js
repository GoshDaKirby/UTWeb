// Undertale web port - on-screen controls for phones and tablets.
// A virtual joystick (arrow keys) and Z / X / C buttons are added when the page runs on a touch device. They sit
// beside the game in landscape and below it in portrait, so they never cover the picture, and the layout is
// recalculated whenever the screen is rotated or resized. ?touch=1 forces them on, ?touch=0 turns them off.
'use strict';
(function () {
  const UT = window.UT;
  const q = new URLSearchParams(location.search);
  const forced = q.get('touch');
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  const active = forced === '1' ? true : forced === '0' ? false : (coarse && hasTouch);

  const KEY = { left: 37, up: 38, right: 39, down: 40, z: 90, x: 88, c: 67 };
  const touch = UT.touch = { active, layout: null };
  if (!active) return;

  const css = `
  body.touch { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #tc-stick, #tc-buttons { position: absolute; z-index: 5; touch-action: none; }
  #tc-stick .base { position: absolute; border-radius: 50%; border: 3px solid rgba(255,255,255,.55); background: rgba(255,255,255,.07); }
  #tc-stick .knob { position: absolute; border-radius: 50%; background: rgba(255,255,255,.55); border: 2px solid #fff; pointer-events: none; }
  #tc-buttons .btn { position: absolute; border-radius: 50%; border: 3px solid #fff; color: #fff; background: rgba(0,0,0,.35);
    display: flex; align-items: center; justify-content: center; font: bold 26px monospace; touch-action: none; }
  #tc-buttons .btn.z { border-color: #ff0; color: #ff0; }
  #tc-buttons .btn.on { background: rgba(255,255,255,.35); }
  #tc-buttons .btn small { display: block; font-size: 10px; font-weight: normal; margin-top: -2px; opacity: .8; }
  #tc-full { position: absolute; z-index: 6; width: 34px; height: 34px; border: 2px solid rgba(255,255,255,.6); border-radius: 6px;
    background: rgba(0,0,0,.4); color: #fff; font: 18px monospace; display: flex; align-items: center; justify-content: center; }
  `;

  function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent.appendChild(e); return e; }

  let stick, base, knob, buttons, full, btns = {};
  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.body.classList.add('touch');
    const vp = document.querySelector('meta[name=viewport]');
    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    stick = el('div', '', document.body); stick.id = 'tc-stick';
    base = el('div', 'base', stick); knob = el('div', 'knob', stick);
    buttons = el('div', '', document.body); buttons.id = 'tc-buttons';
    btns.z = el('div', 'btn z', buttons, 'Z<small>OK</small>');
    btns.x = el('div', 'btn x', buttons, 'X<small>BACK</small>');
    btns.c = el('div', 'btn c', buttons, 'C<small>MENU</small>');
    full = el('div', '', document.body, '&#x26F6;'); full.id = 'tc-full';
    full.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); UT.setFullscreen && UT.setFullscreen(!document.fullscreenElement); });
    for (const k of ['z', 'x', 'c']) wireButton(btns[k], KEY[k]);
    wireStick();
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    const st2 = document.querySelectorAll('#start > div');
    if (st2[1]) st2[1].textContent = 'Tap to start';
    if (st2[2]) st2[2].innerHTML = 'Joystick = move &nbsp; Z = confirm &nbsp; X = cancel &nbsp; C = menu';
  }

  // ---- buttons: held while a finger is on them
  function wireButton(b, code) {
    const fingers = new Set();
    const down = (e) => { e.preventDefault(); fingers.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (_) {}
      if (fingers.size === 1) { UT.input.press(code); b.classList.add('on'); } };
    const up = (e) => { if (!fingers.delete(e.pointerId)) return; if (!fingers.size) { UT.input.release(code); b.classList.remove('on'); } };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }

  // ---- joystick: 8 directions mapped onto the arrow keys
  let stickId = null, cx = 0, cy = 0, R = 60;
  const held = new Set();
  function setDirs(dirs) {
    for (const k of [...held]) if (!dirs.has(k)) { UT.input.release(k); held.delete(k); }
    for (const k of dirs) if (!held.has(k)) { UT.input.press(k); held.add(k); }
  }
  function moveKnob(dx, dy) {
    const kr = parseFloat(knob.style.width) / 2 || 20;
    knob.style.left = (cx + dx - kr) + 'px'; knob.style.top = (cy + dy - kr) + 'px';
  }
  function update(e) {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    moveKnob(dx, dy);
    const dirs = new Set();
    if (d > R * 0.28) {
      const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8; // 0 = right, 2 = down, 4 = left, 6 = up
      if (sector === 7 || sector === 0 || sector === 1) dirs.add(KEY.right);
      if (sector >= 1 && sector <= 3) dirs.add(KEY.down);
      if (sector >= 3 && sector <= 5) dirs.add(KEY.left);
      if (sector >= 5 && sector <= 7) dirs.add(KEY.up);
    }
    setDirs(dirs);
  }
  function wireStick() {
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (stickId !== null) return;
      stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (_) {}
      update(e);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) { e.preventDefault(); update(e); } });
    const end = (e) => { if (e.pointerId !== stickId) return; stickId = null; setDirs(new Set()); moveKnob(0, 0); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end);
  }

  function place(node, x, y, w, h) { Object.assign(node.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); }

  // Lays out the controls for the current screen shape and returns the rectangle the game may use.
  touch.layout = function () {
    if (!stick) build();
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W;
    document.body.classList.toggle('portrait', portrait); document.body.classList.toggle('landscape', !portrait);
    let game, left, right;
    if (portrait) {
      const ctrlMin = Math.max(190, H * 0.34);
      const gh = Math.min(W * 0.75, H - ctrlMin);
      game = { x: 0, y: 0, w: W, h: gh };
      // controls sit near the bottom edge where thumbs rest
      const ch = Math.min(H - gh, Math.max(190, W * 0.62));
      const cy0 = H - ch - Math.min(24, (H - gh - ch));
      left = { x: 0, y: cy0, w: W / 2, h: ch };
      right = { x: W / 2, y: cy0, w: W / 2, h: ch };
    } else {
      const sideMin = Math.max(130, Math.min(W * 0.2, 230));
      const side = Math.max(sideMin, (W - H * 4 / 3) / 2);
      game = { x: side, y: 0, w: W - side * 2, h: H };
      left = { x: 0, y: 0, w: side, h: H };
      right = { x: W - side, y: 0, w: side, h: H };
    }
    // joystick fills the left area, centred
    place(stick, left.x, left.y, left.w, left.h);
    const bd = Math.max(90, Math.min(left.w, left.h) * 0.75, 0); const bds = Math.min(bd, 190, left.w * 0.9, left.h * 0.85);
    R = bds / 2; cx = left.w / 2; cy = left.h / 2;
    place(base, cx - R, cy - R, R * 2, R * 2);
    const kd = R * 0.9; knob.style.width = knob.style.height = kd + 'px';
    if (stickId === null) moveKnob(0, 0);
    // buttons in a triangle: Z right, X lower left, C upper left
    place(buttons, right.x, right.y, right.w, right.h);
    const b = Math.max(52, Math.min(84, Math.min(right.w, right.h) * 0.3));
    const mx = right.w / 2, my = right.h / 2, sp = b * 0.95;
    place(btns.z, mx + sp * 0.55 - b / 2, my - b / 2, b, b);
    place(btns.x, mx - sp * 0.75 - b / 2, my + sp * 0.7 - b / 2, b, b);
    place(btns.c, mx - sp * 0.75 - b / 2, my - sp * 0.7 - b / 2, b, b);
    for (const k of ['z', 'x', 'c']) btns[k].style.fontSize = Math.round(b * 0.34) + 'px';
    // fullscreen toggle in the corner of the button area, away from the buttons
    place(full, W - 42, portrait ? game.h + 8 : 8, 34, 34);
    return game;
  };

  // let go of everything if the page loses focus (a call comes in, the app is switched)
  const releaseAll = () => { setDirs(new Set()); for (const k of ['z', 'x', 'c']) { UT.input.release(KEY[k]); btns[k] && btns[k].classList.remove('on'); } };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
})();
