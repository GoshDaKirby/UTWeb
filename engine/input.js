// Undertale web port - keyboard (and optional gamepad) input with GameMaker key codes
'use strict';
(function () {
  const UT = window.UT;
  const down = new Set(), pressed = new Set(), released = new Set();
  const physical = new Set();
  const CODE_MAP = {
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, NumpadEnter: 13, ShiftLeft: 16, ShiftRight: 16,
    ControlLeft: 17, ControlRight: 17, AltLeft: 18, AltRight: 18, Escape: 27, Space: 32, Backspace: 8, Tab: 9,
    Home: 36, End: 35, PageUp: 33, PageDown: 34, Insert: 45, Delete: 46,
  };
  function vk(e) {
    if (CODE_MAP[e.code] !== undefined) return CODE_MAP[e.code];
    if (/^Key[A-Z]$/.test(e.code)) return e.code.charCodeAt(3);
    if (/^Digit[0-9]$/.test(e.code)) return e.code.charCodeAt(5);
    if (/^Numpad[0-9]$/.test(e.code)) return 96 + Number(e.code[6]);
    const f = /^F(\d+)$/.exec(e.code); if (f) return 111 + Number(f[1]);
    return e.keyCode || 0;
  }
  const input = UT.input = {
    enabled: true,
    down: (k) => down.has(k), pressed: (k) => pressed.has(k), released: (k) => released.has(k),
    direct: (k) => physical.has(k) || down.has(k),
    anyDown: () => down.size > 0, anyPressed: () => pressed.size > 0, anyReleased: () => released.size > 0,
    press(k) { if (!down.has(k)) pressed.add(k); down.add(k); UT.R.keyboard_lastkey = k; },
    release(k) { if (down.has(k)) released.add(k); down.delete(k); },
    clear(k) { down.delete(k); pressed.delete(k); released.delete(k); },
    clearAll() { down.clear(); pressed.clear(); released.clear(); },
    endFrame() { pressed.clear(); released.clear(); pollGamepad(); },
  };
  const BLOCK = new Set([37, 38, 39, 40, 32, 13, 8, 9, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 27, 18]);
  window.addEventListener('keydown', (e) => {
    if (!input.enabled) return;
    const k = vk(e);
    if (e.code === 'F11' || (e.ctrlKey && e.code === 'KeyR') || e.metaKey) return; // leave browser shortcuts alone
    if (BLOCK.has(k)) e.preventDefault();
    physical.add(k);
    if (!e.repeat) input.press(k);
    UT.R.keyboard_lastchar = e.key && e.key.length === 1 ? e.key : UT.R.keyboard_lastchar;
  });
  window.addEventListener('keyup', (e) => { const k = vk(e); physical.delete(k); input.release(k); });
  window.addEventListener('blur', () => { for (const k of [...down]) input.release(k); physical.clear(); });

  // ---- gamepad: exposed through GameMaker's joystick_* functions (the game's obj_time maps them to keys)
  let pads = [];
  function pollGamepad() {
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; } catch (e) { pads = []; }
  }
  UT.gamepad = {
    exists: (id) => pads.length >= id && id >= 1,
    pad: (id) => pads[id - 1],
    buttons: (id) => { const p = pads[id - 1]; return p ? p.buttons.length : 0; },
    button: (id, b) => { const p = pads[id - 1]; return p && p.buttons[b - 1] ? (p.buttons[b - 1].pressed ? 1 : 0) : 0; },
    axis: (id, a) => { const p = pads[id - 1]; return p && p.axes[a] !== undefined ? p.axes[a] : 0; },
  };
})();
