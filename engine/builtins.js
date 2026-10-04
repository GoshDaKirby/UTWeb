// Undertale web port - GameMaker built-in functions used by the game (F.name(self, other, ...args))
'use strict';
(function () {
  const UT = window.UT;
  const R = UT.R, G = UT.G;
  const N = (v) => UT.$num(v);
  const NOONE = -4;
  const F = UT.F = {};
  UT.S = {};

  // ------------------------------------------------------------------ math & random
  let seed = (Math.random() * 2 ** 31) >>> 0;
  function rnd() { // xorshift, reseedable with randomize()
    seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0;
    return seed / 4294967296;
  }
  UT.rnd = rnd;
  const fixedSeed = (window.UT_CONFIG || {}).seed;
  if (fixedSeed) seed = fixedSeed >>> 0;
  F.randomize = () => { if (!fixedSeed) seed = (Math.random() * 2 ** 31) >>> 0 || 1; return 0; };
  F.random = (s, o, n) => rnd() * N(n);
  F.random_range = (s, o, a, b) => N(a) + rnd() * (N(b) - N(a));
  F.irandom = (s, o, n) => Math.floor(rnd() * (Math.floor(N(n)) + 1));
  F.irandom_range = (s, o, a, b) => Math.floor(N(a) + rnd() * (Math.floor(N(b)) - Math.floor(N(a)) + 1));
  F.choose = (s, o, ...a) => a.length ? a[Math.floor(rnd() * a.length)] : 0;
  F.abs = (s, o, x) => Math.abs(N(x));
  F.sign = (s, o, x) => Math.sign(N(x));
  F.floor = (s, o, x) => Math.floor(N(x));
  F.ceil = (s, o, x) => Math.ceil(N(x));
  F.round = (s, o, x) => { x = N(x); const f = Math.floor(x), d = x - f; if (d > 0.5) return f + 1; if (d < 0.5) return f; return f % 2 === 0 ? f : f + 1; };
  F.frac = (s, o, x) => { x = N(x); return x - Math.trunc(x); };
  F.sqrt = (s, o, x) => Math.sqrt(N(x));
  F.sqr = (s, o, x) => N(x) * N(x);
  F.power = (s, o, a, b) => Math.pow(N(a), N(b));
  F.exp = (s, o, x) => Math.exp(N(x));
  F.ln = (s, o, x) => Math.log(N(x));
  F.sin = (s, o, x) => Math.sin(N(x));
  F.cos = (s, o, x) => Math.cos(N(x));
  F.tan = (s, o, x) => Math.tan(N(x));
  F.arctan = (s, o, x) => Math.atan(N(x));
  F.arctan2 = (s, o, y, x) => Math.atan2(N(y), N(x));
  F.degtorad = (s, o, x) => N(x) * Math.PI / 180;
  F.radtodeg = (s, o, x) => N(x) * 180 / Math.PI;
  F.min = (s, o, ...a) => Math.min(...a.map(N));
  F.max = (s, o, ...a) => Math.max(...a.map(N));
  F.mean = (s, o, ...a) => a.reduce((p, c) => p + N(c), 0) / (a.length || 1);
  F.clamp = (s, o, v, a, b) => Math.max(N(a), Math.min(N(b), N(v)));
  F.lerp = (s, o, a, b, t) => N(a) + (N(b) - N(a)) * N(t);
  F.point_direction = (s, o, x1, y1, x2, y2) => { let d = Math.atan2(-(N(y2) - N(y1)), N(x2) - N(x1)) * 180 / Math.PI; if (d < 0) d += 360; return d; };
  F.point_distance = (s, o, x1, y1, x2, y2) => Math.hypot(N(x2) - N(x1), N(y2) - N(y1));
  F.lengthdir_x = (s, o, l, d) => N(l) * Math.cos(N(d) * Math.PI / 180);
  F.lengthdir_y = (s, o, l, d) => -N(l) * Math.sin(N(d) * Math.PI / 180);
  F.make_color_rgb = F.make_colour_rgb = (s, o, r, g, b) => (N(r) & 255) | ((N(g) & 255) << 8) | ((N(b) & 255) << 16);
  F.make_color_hsv = F.make_colour_hsv = (s, o, h, sat, v) => {
    h = N(h) / 255 * 360; sat = N(sat) / 255; v = N(v) / 255;
    const c = v * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return F.make_color_rgb(null, null, Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
  };
  F.merge_color = F.merge_colour = (s, o, c1, c2, a) => {
    c1 = N(c1); c2 = N(c2); a = Math.max(0, Math.min(1, N(a)));
    const m = (sh) => Math.round(((c1 >> sh) & 255) * (1 - a) + ((c2 >> sh) & 255) * a) << sh;
    return m(0) | m(8) | m(16);
  };
  F.color_get_red = (s, o, c) => N(c) & 255;
  F.color_get_green = (s, o, c) => (N(c) >> 8) & 255;
  F.color_get_blue = (s, o, c) => (N(c) >> 16) & 255;

  // ------------------------------------------------------------------ strings
  F.string = (s, o, v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v === undefined || v === null) return '0';
    if (typeof v !== 'number') return String(v);
    if (Number.isInteger(v)) return String(v);
    if (!isFinite(v)) return v > 0 ? 'inf' : (v < 0 ? '-inf' : 'nan');
    const r = v.toFixed(2);
    return r === '-0.00' ? '0.00' : r;
  };
  F.real = (s, o, v) => { if (typeof v === 'number') return v; if (typeof v === 'boolean') return v ? 1 : 0; const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  F.chr = (s, o, c) => String.fromCharCode(N(c));
  F.ord = (s, o, c) => { c = String(c); return c.length ? c.charCodeAt(0) : 0; };
  F.string_length = (s, o, str) => String(str).length;
  F.string_char_at = (s, o, str, i) => { str = String(str); i = Math.floor(N(i)); if (i < 1) i = 1; return i <= str.length ? str[i - 1] : ''; };
  F.string_copy = (s, o, str, i, n) => { str = String(str); i = Math.max(1, Math.floor(N(i))); return str.substr(i - 1, Math.max(0, Math.floor(N(n)))); };
  F.string_delete = (s, o, str, i, n) => { str = String(str); i = Math.max(1, Math.floor(N(i))); return str.slice(0, i - 1) + str.slice(i - 1 + Math.max(0, Math.floor(N(n)))); };
  F.string_insert = (s, o, sub, str, i) => { str = String(str); i = Math.max(1, Math.floor(N(i))); return str.slice(0, i - 1) + String(sub) + str.slice(i - 1); };
  F.string_pos = (s, o, sub, str) => String(str).indexOf(String(sub)) + 1;
  F.string_lower = (s, o, str) => String(str).toLowerCase();
  F.string_upper = (s, o, str) => String(str).toUpperCase();
  F.string_replace = (s, o, str, a, b) => String(str).replace(String(a), String(b));
  F.string_replace_all = (s, o, str, a, b) => String(str).split(String(a)).join(String(b));
  F.string_repeat = (s, o, str, n) => String(str).repeat(Math.max(0, N(n)));
  F.string_digits = (s, o, str) => String(str).replace(/[^0-9]/g, '');
  F.string_letters = (s, o, str) => String(str).replace(/[^A-Za-z]/g, '');
  F.string_count = (s, o, sub, str) => String(str).split(String(sub)).length - 1;
  F.string_format = (s, o, v, tot, dec) => { const r = N(v).toFixed(N(dec)); return r.padStart(N(tot) + (N(dec) > 0 ? N(dec) + 1 : 0), ' '); };
  F.string_width = (s, o, str) => UT.stringWidth(str);
  F.string_height = (s, o, str) => UT.stringHeight(str);

  // ------------------------------------------------------------------ instances
  F.instance_create = (s, o, x, y, obj) => {
    obj = N(obj);
    if (!UT.D.objects[obj]) { UT.reportError('instance_create', new Error('bad object ' + obj)); return NOONE; }
    const inst = UT.createInstance(obj, N(x), N(y));
    return inst.id;
  };
  F.action_create_object = (s, o, obj, x, y) => F.instance_create(s, o, x, y, obj);
  F.instance_destroy = (s, o, target) => {
    if (target === undefined) { if (s && s instanceof UT.Instance) UT.destroyInstance(s); return 0; }
    for (const i of UT.targets(target, s, o)) UT.destroyInstance(i);
    return 0;
  };
  F.action_kill_object = (s) => F.instance_destroy(s);
  F.instance_exists = (s, o, obj) => {
    obj = N(obj);
    if (obj >= 100000) { const i = R.byId.get(obj); return i && !i.$dead && !i.$deact ? 1 : 0; }
    if (obj === -1) return s && !s.$dead ? 1 : 0;
    if (obj === -2) return o && !o.$dead ? 1 : 0;
    if (obj < 0) return 0;
    return UT.firstOf(obj) ? 1 : 0;
  };
  F.instance_number = (s, o, obj) => { let n = 0; for (const i of UT.each(N(obj))) n++; return n; };
  F.instance_find = (s, o, obj, k) => { k = Math.floor(N(k)); let n = 0; for (const i of UT.each(N(obj))) { if (n++ === k) return i.id; } return NOONE; };
  F.instance_nearest = (s, o, x, y, obj) => { let best = NOONE, bd = Infinity; for (const i of UT.each(N(obj))) { const d = Math.hypot(i.x - N(x), i.y - N(y)); if (d < bd) { bd = d; best = i.id; } } return best; };
  F.instance_furthest = (s, o, x, y, obj) => { let best = NOONE, bd = -1; for (const i of UT.each(N(obj))) { const d = Math.hypot(i.x - N(x), i.y - N(y)); if (d > bd) { bd = d; best = i.id; } } return best; };
  F.instance_change = (s, o, obj, perf) => {
    obj = N(obj);
    if (UT.$t(perf)) UT.runEvent(s, 'Destroy_0');
    const od = UT.D.objects[obj];
    s.object_index = obj; s.$kbd = null;
    if (od.sprite >= 0) s.sprite_index = od.sprite;
    s.depth = od.depth; s.visible = od.visible ? 1 : 0; s.solid = od.solid ? 1 : 0; s.persistent = od.persistent ? 1 : 0; s.mask_index = od.mask;
    if (UT.$t(perf)) UT.runEvent(s, 'Create_0');
    return 0;
  };
  F.instance_deactivate_all = (s, o, notme) => { for (const i of R.instances) if (!(UT.$t(notme) && i === s)) i.$deact = true; return 0; };
  F.instance_activate_all = () => { for (const i of R.instances) i.$deact = false; return 0; };
  F.instance_deactivate_object = (s, o, obj) => { for (const i of UT.targets(obj, s, o)) i.$deact = true; return 0; };
  F.instance_activate_object = (s, o, obj) => { obj = N(obj); for (const i of R.instances) if (i.$deact && (i.id === obj || UT.isA(i.object_index, obj))) i.$deact = false; return 0; };
  F.event_user = (s, o, n) => { UT.runEvent(s, 'Other_' + (10 + Math.floor(N(n))), o); return 0; };
  F.event_perform = (s, o, type, num) => {
    const names = { 0: 'Create', 1: 'Destroy', 2: 'Alarm', 3: 'Step', 7: 'Other', 8: 'Draw' };
    UT.runEvent(s, names[N(type)] + '_' + N(num), o); return 0;
  };
  F.script_execute = (s, o, idx, ...args) => {
    const name = typeof idx === 'string' ? idx : UT.D.scripts[N(idx)];
    const fn = UT.S[name];
    if (!fn) { UT.reportError('script_execute', new Error('bad script ' + idx)); return 0; }
    return fn(s, o, args);
  };

  // ------------------------------------------------------------------ motion
  F.move_towards_point = (s, o, x, y, sp) => { s.direction = F.point_direction(s, o, s.x, s.y, x, y); s.speed = N(sp); return 0; };
  F.motion_set = F.action_set_motion = (s, o, dir, sp) => { s.direction = N(dir); s.speed = N(sp); return 0; };
  F.action_set_hspeed = (s, o, v) => { s.hspeed = N(v); return 0; };
  F.action_set_friction = (s, o, v) => { s.friction = N(v); return 0; };
  F.action_set_gravity = (s, o, dir, g) => { s.gravity_direction = N(dir); s.gravity = N(g); return 0; };
  F.action_move_point = (s, o, x, y, sp) => F.move_towards_point(s, o, x, y, sp);
  F.action_move_to = (s, o, x, y) => { s.x = N(x); s.y = N(y); return 0; };
  F.action_move = (s, o, dirs, sp) => {
    // Drag-and-drop "Start moving in a direction": dirs is a 9 char mask "UL U UR L C R DL D DR" (GM order: 0..8)
    const angles = [225, 270, 315, 180, -1, 0, 135, 90, 45];
    const opts = []; String(dirs).split('').forEach((c, i) => { if (c === '1') opts.push(angles[i]); });
    if (!opts.length) return 0;
    const a = opts[Math.floor(rnd() * opts.length)];
    if (a < 0) s.speed = 0; else { s.direction = a; s.speed = N(sp); }
    return 0;
  };
  F.action_set_alarm = (s, o, steps, n) => { s.alarm[Math.floor(N(n))] = N(steps); return 0; };
  F.move_snap = (s, o, h, v) => { h = N(h); v = N(v); if (h > 0) s.x = Math.round(s.x / h) * h; if (v > 0) s.y = Math.round(s.y / v) * v; return 0; };
  F.distance_to_point = (s, o, x, y) => {
    const b = UT.worldBox(s); x = N(x); y = N(y);
    if (!b) return Math.hypot(s.x - x, s.y - y);
    const dx = x < b[0] ? b[0] - x : x > b[2] ? x - b[2] : 0, dy = y < b[1] ? b[1] - y : y > b[3] ? y - b[3] : 0;
    return Math.hypot(dx, dy);
  };
  F.distance_to_object = (s, o, obj) => {
    const a = UT.worldBox(s) || [s.x, s.y, s.x, s.y];
    let best = 1000000;
    for (const i of UT.targets(obj, s, o)) {
      if (i === s) continue;
      const b = UT.worldBox(i) || [i.x, i.y, i.x, i.y];
      const dx = Math.max(0, b[0] - a[2], a[0] - b[2]), dy = Math.max(0, b[1] - a[3], a[1] - b[3]);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  };

  // ------------------------------------------------------------------ collisions
  function candidates(obj, s, o, notme) {
    return UT.targets(obj, s, o).filter(i => !(UT.$t(notme) && i === s));
  }
  F.collision_point = (s, o, x, y, obj, prec, notme) => {
    x = N(x); y = N(y);
    for (const i of candidates(obj, s, o, notme)) if (UT.pointHits(i, x, y, UT.$t(prec))) return i.id;
    return NOONE;
  };
  F.instance_position = (s, o, x, y, obj) => F.collision_point(s, o, x, y, obj, 1, 0);
  F.position_meeting = (s, o, x, y, obj) => F.instance_position(s, o, x, y, obj) !== NOONE ? 1 : 0;
  F.collision_rectangle = (s, o, x1, y1, x2, y2, obj, prec, notme) => {
    for (const i of candidates(obj, s, o, notme)) if (UT.rectHits(i, N(x1), N(y1), N(x2), N(y2), UT.$t(prec))) return i.id;
    return NOONE;
  };
  F.collision_line = (s, o, x1, y1, x2, y2, obj, prec, notme) => {
    x1 = N(x1); y1 = N(y1); x2 = N(x2); y2 = N(y2);
    const len = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    const list = candidates(obj, s, o, notme);
    for (const i of list) {
      const b = UT.worldBox(i); if (!b) continue;
      if (Math.max(x1, x2) < b[0] || Math.min(x1, x2) > b[2] || Math.max(y1, y2) < b[1] || Math.min(y1, y2) > b[3]) continue;
      for (let k = 0; k <= len; k++) { const px = x1 + (x2 - x1) * k / len, py = y1 + (y2 - y1) * k / len; if (UT.pointHits(i, px, py, UT.$t(prec))) return i.id; }
    }
    return NOONE;
  };
  F.collision_circle = (s, o, x, y, r, obj, prec, notme) => {
    x = N(x); y = N(y); r = N(r);
    for (const i of candidates(obj, s, o, notme)) {
      const b = UT.worldBox(i); if (!b) continue;
      const dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3]);
      if (dx * dx + dy * dy > r * r) continue;
      if (!UT.$t(prec)) return i.id;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r && UT.pointHits(i, xx + 0.5, yy + 0.5, true)) return i.id;
      }
    }
    return NOONE;
  };
  F.place_meeting = (s, o, x, y, obj) => {
    const ox = s.x, oy = s.y; s.x = N(x); s.y = N(y);
    let hit = 0; for (const i of candidates(obj, s, o, 1)) if (UT.instancesCollide(s, i)) { hit = 1; break; }
    s.x = ox; s.y = oy; return hit;
  };
  F.place_free = (s, o, x, y) => {
    const ox = s.x, oy = s.y; s.x = N(x); s.y = N(y);
    let hit = 0; for (const i of R.instances) if (i !== s && !i.$dead && i.solid && UT.instancesCollide(s, i)) { hit = 1; break; }
    s.x = ox; s.y = oy; return hit ? 0 : 1;
  };

  // ------------------------------------------------------------------ rooms & game
  F.room_goto = (s, o, r) => { UT.gotoRoom(N(r)); return 0; };
  F.room_goto_next = () => { UT.gotoRoom(R.room + 1); return 0; };
  F.room_goto_previous = () => { UT.gotoRoom(R.room - 1); return 0; };
  F.action_previous_room = F.room_goto_previous;
  F.room_next = (s, o, r) => { r = N(r); return r + 1 < UT.D.rooms.length ? r + 1 : -1; };
  F.room_previous = (s, o, r) => { r = N(r); return r - 1 >= 0 ? r - 1 : -1; };
  F.room_restart = () => { UT.gotoRoom(R.room); return 0; };
  F.room_set_persistent = (s, o, r, v) => { R.roomPersistent[N(r)] = UT.$t(v); return 0; };
  F.game_end = () => { R.endRequested = true; return 0; };
  F.game_restart = () => { R.restartRequested = true; return 0; };

  // ------------------------------------------------------------------ drawing
  const alphaOf = () => G.alpha;
  F.draw_set_color = F.draw_set_colour = (s, o, c) => { G.color = N(c); return 0; };
  F.draw_get_color = F.draw_get_colour = () => G.color;
  F.draw_set_alpha = (s, o, a) => { G.alpha = N(a); return 0; };
  F.draw_get_alpha = () => G.alpha;
  F.draw_set_font = (s, o, f) => { G.font = N(f); return 0; };
  F.draw_set_halign = (s, o, a) => { G.halign = N(a); return 0; };
  F.draw_set_valign = (s, o, a) => { G.valign = N(a); return 0; };
  F.draw_set_circle_precision = (s, o, p) => { G.circlePrecision = N(p); return 0; };
  F.draw_set_blend_mode = () => 0;
  F.texture_set_interpolation = () => 0;
  F.draw_sprite = (s, o, spr, sub, x, y) => { if (N(sub) === -1) sub = s.image_index; UT.drawSpriteExt(N(spr), sub, N(x), N(y), 1, 1, 0, 16777215, alphaOf()); return 0; };
  F.draw_sprite_ext = (s, o, spr, sub, x, y, xs, ys, rot, col, a) => { if (N(sub) === -1) sub = s.image_index; UT.drawSpriteExt(N(spr), sub, N(x), N(y), N(xs), N(ys), N(rot), N(col), N(a)); return 0; };
  F.draw_self = (s) => { UT.drawSpriteExt(s._spr, s.image_index, s.x, s.y, s.image_xscale, s.image_yscale, s.image_angle, s.image_blend, s.image_alpha); return 0; };
  F.draw_sprite_part = (s, o, spr, sub, l, t, w, h, x, y) => { if (N(sub) === -1) sub = s.image_index; UT.drawSpritePart(N(spr), sub, N(l), N(t), N(w), N(h), N(x), N(y), 1, 1, 16777215, alphaOf()); return 0; };
  F.draw_sprite_part_ext = (s, o, spr, sub, l, t, w, h, x, y, xs, ys, col, a) => { if (N(sub) === -1) sub = s.image_index; UT.drawSpritePart(N(spr), sub, N(l), N(t), N(w), N(h), N(x), N(y), N(xs), N(ys), N(col), N(a)); return 0; };
  F.draw_sprite_stretched = (s, o, spr, sub, x, y, w, h) => {
    if (N(sub) === -1) sub = s.image_index;
    const img = UT.frameImage(N(spr), sub); const info = UT.spriteInfo(N(spr)); if (!img || !info) return 0;
    UT.drawImageStretched(img, N(x), N(y), N(w), N(h), 16777215, alphaOf()); return 0;
  };
  F.draw_sprite_stretched_ext = (s, o, spr, sub, x, y, w, h, col, a) => {
    if (N(sub) === -1) sub = s.image_index;
    const img = UT.frameImage(N(spr), sub); if (!img) return 0;
    UT.drawImageStretched(img, N(x), N(y), N(w), N(h), N(col), N(a)); return 0;
  };
  F.draw_background = (s, o, b, x, y) => {
    const img = UT.bgImage(N(b)); const info = UT.bgInfo(N(b)); if (!img || !info) return 0;
    UT.drawImageStretched(img, N(x), N(y), info.w, info.h, 16777215, alphaOf()); return 0;
  };
  F.draw_background_ext = (s, o, b, x, y, xs, ys, rot, col, a) => {
    const img = UT.bgImage(N(b)); const info = UT.bgInfo(N(b)); if (!img || !info) return 0;
    UT.drawImageStretched(img, N(x), N(y), info.w * N(xs), info.h * N(ys), N(col), N(a)); return 0;
  };
  F.draw_background_part_ext = (s, o, b, l, t, w, h, x, y, xs, ys, col, a) => {
    const img = UT.bgImage(N(b)); if (!img || !img.naturalWidth && !img.width) return 0;
    l = Math.round(N(l)); t = Math.round(N(t)); w = Math.round(N(w)); h = Math.round(N(h));
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (l < 0) { w += l; l = 0; } if (t < 0) { h += t; t = 0; } if (l + w > iw) w = iw - l; if (t + h > ih) h = ih - t;
    if (w <= 0 || h <= 0) return 0;
    const c = G.target ? G.target.ctx : G.ctx; c.save(); c.globalAlpha = Math.max(0, Math.min(1, N(a)));
    c.drawImage(UT.tinted(img, N(col)), l, t, w, h, N(x), N(y), w * N(xs), h * N(ys)); c.restore(); return 0;
  };
  F.draw_rectangle = (s, o, x1, y1, x2, y2, outline) => { UT.drawRect(x1, y1, x2, y2, outline, G.color, alphaOf()); return 0; };
  F.draw_rectangle_color = F.draw_rectangle_colour = (s, o, x1, y1, x2, y2, c1, c2, c3, c4, outline) => { UT.drawRect(x1, y1, x2, y2, outline, N(c1), alphaOf()); return 0; };
  F.draw_roundrect = (s, o, x1, y1, x2, y2, outline) => { UT.drawRect(x1, y1, x2, y2, outline, G.color, alphaOf()); return 0; };
  F.draw_line = (s, o, x1, y1, x2, y2) => { UT.drawLine(N(x1), N(y1), N(x2), N(y2), 1, G.color, G.color, alphaOf()); return 0; };
  F.draw_line_width = (s, o, x1, y1, x2, y2, w) => { UT.drawLine(N(x1), N(y1), N(x2), N(y2), N(w), G.color, G.color, alphaOf()); return 0; };
  F.draw_line_color = F.draw_line_colour = (s, o, x1, y1, x2, y2, c1, c2) => { UT.drawLine(N(x1), N(y1), N(x2), N(y2), 1, N(c1), N(c2), alphaOf()); return 0; };
  F.draw_line_width_color = F.draw_line_width_colour = (s, o, x1, y1, x2, y2, w, c1, c2) => { UT.drawLine(N(x1), N(y1), N(x2), N(y2), N(w), N(c1), N(c2), alphaOf()); return 0; };
  F.draw_point = (s, o, x, y) => { UT.fillRect(N(x), N(y), N(x), N(y), G.color, alphaOf()); return 0; };
  F.draw_point_color = F.draw_point_colour = (s, o, x, y, c) => { UT.fillRect(N(x), N(y), N(x), N(y), N(c), alphaOf()); return 0; };
  F.draw_circle = (s, o, x, y, r, outline) => { x = N(x); y = N(y); r = N(r); UT.drawEllipse(x - r, y - r, x + r, y + r, UT.$t(outline), G.color, G.color, alphaOf()); return 0; };
  F.draw_circle_color = F.draw_circle_colour = (s, o, x, y, r, c1, c2, outline) => { x = N(x); y = N(y); r = N(r); UT.drawEllipse(x - r, y - r, x + r, y + r, UT.$t(outline), N(c1), N(c2), alphaOf()); return 0; };
  F.draw_ellipse = (s, o, x1, y1, x2, y2, outline) => { UT.drawEllipse(N(x1), N(y1), N(x2), N(y2), UT.$t(outline), G.color, G.color, alphaOf()); return 0; };
  F.draw_ellipse_color = F.draw_ellipse_colour = (s, o, x1, y1, x2, y2, c1, c2, outline) => { UT.drawEllipse(N(x1), N(y1), N(x2), N(y2), UT.$t(outline), N(c1), N(c2), alphaOf()); return 0; };
  F.draw_triangle = (s, o, x1, y1, x2, y2, x3, y3, outline) => { UT.drawPoly([[N(x1), N(y1)], [N(x2), N(y2)], [N(x3), N(y3)]], UT.$t(outline), G.color, alphaOf()); return 0; };
  F.draw_triangle_color = F.draw_triangle_colour = (s, o, x1, y1, x2, y2, x3, y3, c1, c2, c3, outline) => { UT.drawPoly([[N(x1), N(y1)], [N(x2), N(y2)], [N(x3), N(y3)]], UT.$t(outline), N(c1), alphaOf()); return 0; };
  F.draw_text = (s, o, x, y, str) => { UT.drawText(N(x), N(y), str, 1, 1, 0, G.color, alphaOf()); return 0; };
  F.draw_text_ext = (s, o, x, y, str, sep, w) => { UT.drawText(N(x), N(y), str, 1, 1, 0, G.color, alphaOf(), N(sep), N(w)); return 0; };
  F.draw_text_transformed = (s, o, x, y, str, xs, ys, a) => { UT.drawText(N(x), N(y), str, N(xs), N(ys), N(a), G.color, alphaOf()); return 0; };
  F.draw_text_color = F.draw_text_colour = (s, o, x, y, str, c1, c2, c3, c4, a) => { UT.drawText(N(x), N(y), str, 1, 1, 0, N(c1), N(a)); return 0; };
  F.draw_text_transformed_color = F.draw_text_transformed_colour = (s, o, x, y, str, xs, ys, a, c1, c2, c3, c4, al) => { UT.drawText(N(x), N(y), str, N(xs), N(ys), N(a), N(c1), N(al)); return 0; };
  F.draw_clear = (s, o, c) => { const ctx = G.target ? G.target.ctx : G.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = UT.css(N(c)); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); return 0; };
  F.draw_getpixel = (s, o, x, y) => {
    try {
      const t = G.viewTransform || [1, 1, 0, 0];
      const px = Math.floor(N(x) * t[0] + t[2]), py = Math.floor(N(y) * t[1] + t[3]);
      const d = G.ctx.getImageData(px, py, 1, 1).data; return d[0] | (d[1] << 8) | (d[2] << 16);
    } catch (e) { return 0; }
  };

  // ------------------------------------------------------------------ sprites / backgrounds / surfaces
  F.sprite_exists = (s, o, spr) => UT.spriteInfo(N(spr)) ? 1 : 0;
  F.sprite_get_width = (s, o, spr) => { const i = UT.spriteInfo(N(spr)); return i ? i.w : 0; };
  F.sprite_get_height = (s, o, spr) => { const i = UT.spriteInfo(N(spr)); return i ? i.h : 0; };
  F.sprite_get_number = (s, o, spr) => { const i = UT.spriteInfo(N(spr)); return i ? (i.frames.length || (i.imgs || []).length) : 0; };
  F.sprite_get_xoffset = (s, o, spr) => { const i = UT.spriteInfo(N(spr)); return i ? i.xo : 0; };
  F.sprite_get_yoffset = (s, o, spr) => { const i = UT.spriteInfo(N(spr)); return i ? i.yo : 0; };
  F.sprite_get_name = (s, o, spr) => { const i = UT.spriteInfo(N(spr)); return i ? i.name : '<undefined>'; };
  F.sprite_delete = (s, o, spr) => { spr = N(spr); if (spr >= 100000) G.dynSprites.delete(spr); return 0; };
  F.sprite_collision_mask = () => 0;
  F.sprite_replace = (s, o, spr, fname) => {
    // Flowey loads "external/<name>.png"; the same art is already part of the project's sprites.
    const base = String(fname).replace(/^.*\//, '').replace(/\.(png|gif)$/i, '');
    const src = UT.D.sprites.findIndex(x => x.name === base);
    spr = N(spr);
    if (src >= 0 && src !== spr) { UT.D.sprites[spr] = UT.D.sprites[src]; G.spriteImgs[spr] = G.spriteImgs[src]; }
    return 0;
  };
  F.sprite_create_from_surface = (s, o, surf, x, y, w, h, rb, sm, xo, yo) => {
    x = Math.round(N(x)); y = Math.round(N(y)); w = Math.max(1, Math.round(N(w))); h = Math.max(1, Math.round(N(h)));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const srcCanvas = N(surf) === -2 || !G.surfaces.has(N(surf)) ? G.canvas : G.surfaces.get(N(surf)).canvas;
    c.getContext('2d').drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);
    const id = G.nextDynSprite++;
    G.dynSprites.set(id, { name: 'dyn' + id, w, h, xo: N(xo), yo: N(yo), bbox: [0, 0, w - 1, h - 1], frames: [], imgs: [c], masks: [1] });
    return id;
  };
  F.background_add = () => { const id = G.nextDynBg++; G.dynBackgrounds.set(id, { name: 'dynbg', w: 1, h: 1, img: null }); return id; };
  F.surface_create = (s, o, w, h) => { const id = G.nextSurface++; const c = document.createElement('canvas'); c.width = N(w); c.height = N(h); G.surfaces.set(id, { canvas: c, ctx: c.getContext('2d') }); return id; };
  F.surface_exists = (s, o, id) => G.surfaces.has(N(id)) ? 1 : 0;
  F.surface_free = (s, o, id) => { G.surfaces.delete(N(id)); return 0; };
  F.tile_layer_shift = (s, o, depth, dx, dy) => { depth = N(depth); const cur = R.tileLayerOffsets.get(depth) || [0, 0]; R.tileLayerOffsets.set(depth, [cur[0] + N(dx), cur[1] + N(dy)]); return 0; };
  F.tile_layer_hide = (s, o, depth) => { R.hiddenLayers.add(N(depth)); return 0; };
  F.tile_layer_show = (s, o, depth) => { R.hiddenLayers.delete(N(depth)); return 0; };

  // ------------------------------------------------------------------ keyboard / joystick
  const inp = () => UT.input;
  const keyMap = new Map();
  UT.keyMap = keyMap;
  const mapped = (k) => keyMap.get(k);
  const chk = (fn, k) => {
    k = N(k);
    if (k === 1) return inp()['any' + fn[0].toUpperCase() + fn.slice(1)]() ? 1 : 0;
    if (k === 0) return fn === 'down' ? (inp().anyDown() ? 0 : 1) : 0;
    if (inp()[fn](k)) return 1;
    for (const [from, to] of keyMap) if (to === k && inp()[fn](from)) return 1;
    return 0;
  };
  F.keyboard_check = (s, o, k) => chk('down', k);
  F.keyboard_check_pressed = (s, o, k) => chk('pressed', k);
  F.keyboard_check_released = (s, o, k) => chk('released', k);
  F.keyboard_check_direct = (s, o, k) => { k = N(k); return inp().direct(k) || [...keyMap].some(([f, t]) => t === k && inp().direct(f)) ? 1 : 0; };
  F.keyboard_key_press = (s, o, k) => { inp().press(N(k)); return 0; };
  F.keyboard_key_release = (s, o, k) => { inp().release(N(k)); return 0; };
  F.keyboard_clear = (s, o, k) => { k = N(k); inp().clear(k); for (const [f, t] of keyMap) if (t === k) inp().clear(f); return 0; };
  F.io_clear = () => { inp().clearAll(); return 0; };
  F.keyboard_set_map = (s, o, a, b) => { keyMap.set(N(a), N(b)); return 0; };
  F.joystick_exists = (s, o, id) => UT.gamepad.exists(N(id)) ? 1 : 0;
  F.joystick_buttons = (s, o, id) => UT.gamepad.buttons(N(id));
  F.joystick_check_button = (s, o, id, b) => UT.gamepad.button(N(id), N(b));
  F.joystick_xpos = (s, o, id) => UT.gamepad.axis(N(id), 0);
  F.joystick_ypos = (s, o, id) => UT.gamepad.axis(N(id), 1);
  F.joystick_direction = (s, o, id) => { const x = UT.gamepad.axis(N(id), 0), y = UT.gamepad.axis(N(id), 1); const t = 0.5; const col = x < -t ? 0 : x > t ? 2 : 1, row = y < -t ? 2 : y > t ? 0 : 1; return 97 + row * 3 + col; };
  F.joystick_has_pov = (s, o, id) => { const p = UT.gamepad.pad(N(id)); return p && p.buttons.length >= 16 ? 1 : 0; };
  F.joystick_pov = (s, o, id) => {
    const p = UT.gamepad.pad(N(id)); if (!p || p.buttons.length < 16) return -1;
    const u = p.buttons[12].pressed, d = p.buttons[13].pressed, l = p.buttons[14].pressed, r = p.buttons[15].pressed;
    if (u && r) return 45; if (u && l) return 315; if (d && r) return 135; if (d && l) return 225;
    if (u) return 0; if (r) return 90; if (d) return 180; if (l) return 270; return -1;
  };

  // ------------------------------------------------------------------ audio
  const A = () => UT.audio;
  F.audio_play_sound = (s, o, snd, prio, loop) => A().play(snd, UT.$t(loop));
  F.audio_stop_sound = (s, o, x) => { A().stop(x); return 0; };
  F.audio_stop_all = () => { A().stopAll(); return 0; };
  F.audio_is_playing = (s, o, x) => A().isPlaying(x);
  F.audio_pause_sound = (s, o, x) => { A().pause(x); return 0; };
  F.audio_resume_sound = (s, o, x) => { A().resume(x); return 0; };
  F.audio_sound_gain = (s, o, x, v, ms) => { A().gain(x, v, ms); return 0; };
  F.audio_sound_pitch = (s, o, x, p) => { A().pitch(x, p); return 0; };
  F.audio_sound_get_gain = (s, o, x) => A().getGain(x);
  F.audio_sound_get_pitch = (s, o, x) => A().getPitch(x);
  F.audio_sound_get_track_position = (s, o, x) => A().getPos(x);
  F.audio_sound_set_track_position = (s, o, x, t) => { A().setPos(x, t); return 0; };
  F.audio_channel_num = () => 0;
  F.audio_master_gain = (s, o, v) => { A().setMaster(N(v)); return 0; };

  // ------------------------------------------------------------------ files
  F.file_exists = (s, o, n) => UT.fs.exists(n) ? 1 : 0;
  F.file_delete = (s, o, n) => { UT.fs.remove(n); return 1; };
  F.file_rename = (s, o, a, b) => { const d = UT.fs.read(a); if (d === null) return 0; UT.fs.write(b, d); UT.fs.remove(a); return 1; };
  F.file_text_open_read = (s, o, n) => UT.textFile.openRead(n);
  F.file_text_open_write = (s, o, n) => UT.textFile.openWrite(n);
  F.file_text_open_append = (s, o, n) => UT.textFile.openAppend(n);
  F.file_text_close = (s, o, h) => { UT.textFile.close(N(h)); return 0; };
  F.file_text_write_string = (s, o, h, str) => { UT.textFile.writeString(N(h), str); return 0; };
  F.file_text_write_real = (s, o, h, v) => { UT.textFile.writeReal(N(h), v); return 0; };
  F.file_text_writeln = (s, o, h) => { UT.textFile.writeln(N(h)); return 0; };
  F.file_text_read_string = (s, o, h) => UT.textFile.readString(N(h));
  F.file_text_read_real = (s, o, h) => UT.textFile.readReal(N(h));
  F.file_text_readln = (s, o, h) => UT.textFile.readln(N(h));
  F.file_text_eof = (s, o, h) => UT.textFile.eof(N(h));
  F.ini_open = (s, o, n) => { UT.ini.open(n); return 0; };
  F.ini_close = () => UT.ini.close();
  F.ini_read_real = (s, o, sec, k, d) => UT.ini.readReal(String(sec), String(k), d);
  F.ini_read_string = (s, o, sec, k, d) => UT.ini.readString(String(sec), String(k), d);
  F.ini_write_real = (s, o, sec, k, v) => { UT.ini.write(String(sec), String(k), N(v)); return 0; };
  F.ini_write_string = (s, o, sec, k, v) => { UT.ini.write(String(sec), String(k), String(v)); return 0; };
  F.ini_section_exists = (s, o, sec) => UT.ini.sectionExists(String(sec));
  // Steam cloud: not available in a browser
  F.steam_initialised = () => 0;
  F.steam_file_exists = () => 0;
  F.steam_file_write_file = () => 0;
  F.steam_file_delete = () => 0;

  // ------------------------------------------------------------------ window / misc
  F.window_set_fullscreen = (s, o, v) => { UT.setFullscreen && UT.setFullscreen(UT.$t(v)); return 0; };
  F.window_get_fullscreen = () => (document.fullscreenElement ? 1 : 0);
  F.window_set_caption = (s, o, c) => { document.title = String(c).trim() ? String(c) : '​'; return 0; };
  F.window_center = () => { UT.windowOffset = [0, 0]; UT.applyWindowOffset && UT.applyWindowOffset(); return 0; };
  F.window_get_x = () => (UT.windowOffset || [0, 0])[0] + 1000;
  F.window_get_y = () => (UT.windowOffset || [0, 0])[1] + 1000;
  F.window_set_position = (s, o, x, y) => { UT.windowOffset = [N(x) - 1000, N(y) - 1000]; UT.applyWindowOffset && UT.applyWindowOffset(); return 0; };
  F.date_current_datetime = () => { const d = new Date(); return 25569 + (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000; };
  F.show_debug_message = (s, o, m) => { console.log('[GML]', m); return 0; };
  F.sleep = () => 0;
  F.path_start = (s, o, p, sp, end, abs) => { UT.pathStart(s, N(p), N(sp), N(end), UT.$t(abs)); return 0; };
  F.path_end = (s) => { s.path_index = -1; s.speed = 0; return 0; };
  F.base = () => 0;
})();
