// Undertale web port - GameMaker Studio 1.4 runtime core (instances, events, rooms, main loop)
'use strict';
(function () {
  const UT = window.UT = window.UT || {};

  // ------------------------------------------------------------------ value helpers used by generated code
  const EPS = 1e-5;
  function $t(v) { return typeof v === 'number' ? v > 0.5 : (typeof v === 'boolean' ? v : !!v); }
  function $n(v) { return typeof v === 'boolean' ? (v ? 1 : 0) : v; }
  function $eq(a, b) {
    if (typeof a === 'boolean') a = a ? 1 : 0;
    if (typeof b === 'boolean') b = b ? 1 : 0;
    if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) < EPS;
    if (a === undefined || b === undefined) return (a === undefined ? 0 : a) == (b === undefined ? 0 : b);
    return a === b;
  }
  function $num(v) { v = $n(v); return typeof v === 'number' ? v : (Number(v) || 0); }
  function $mod(a, b) { return $n(a) % $n(b); }
  function $div(a, b) { return Math.trunc($n(a) / $n(b)); }
  function $ix(i) { i = $n(i); return i < 0 ? 0 : Math.floor(i); }
  function $ar(arr, i) {
    if (!Array.isArray(arr)) return (i === 0 && arr !== 0 && arr !== undefined) ? arr : 0;
    const v = arr[$ix(i)];
    return v === undefined ? 0 : v;
  }
  function $ar2(arr, i, j) {
    if (!Array.isArray(arr)) return 0;
    const row = arr[$ix(i)];
    if (!Array.isArray(row)) return 0;
    const v = row[$ix(j)];
    return v === undefined ? 0 : v;
  }
  function $aw(holder, name, i, v) {
    let arr = holder[name];
    if (!Array.isArray(arr) || !Object.prototype.hasOwnProperty.call(holder, name)) {
      const old = Object.prototype.hasOwnProperty.call(holder, name) ? arr : undefined;
      arr = [];
      if (old !== undefined && !Array.isArray(old)) arr[0] = old;
      holder[name] = arr;
    }
    arr[$ix(i)] = v;
    return v;
  }
  function $aw2(holder, name, i, j, v) {
    let arr = holder[name];
    if (!Array.isArray(arr) || !Object.prototype.hasOwnProperty.call(holder, name)) { arr = []; holder[name] = arr; }
    const ii = $ix(i);
    let row = arr[ii]; if (!Array.isArray(row)) { row = []; arr[ii] = row; }
    row[$ix(j)] = v;
    return v;
  }
  function $swv(v) { if (typeof v === 'boolean') return v ? 1 : 0; return v; }

  // ------------------------------------------------------------------ globals object (unset -> 0)
  const FALLBACK = new Proxy({}, {
    get(t, k) { if (typeof k === 'symbol' || k === 'then' || k === 'toJSON' || k === 'constructor') return undefined; return 0; },
  });
  function makeGlobals() { return Object.create(FALLBACK); }

  // ------------------------------------------------------------------ runtime state
  const R = UT.R = {
    instances: [], byId: new Map(), nextId: 200000, room: 0, room_speed: 30, frame: 0,
    pendingRoom: -1, restartRequested: false, endRequested: false,
    view_enabled: 0, view_current: 0,
    view_visible: [], view_xview: [], view_yview: [], view_wview: [], view_hview: [], view_xport: [], view_yport: [], view_wport: [], view_hport: [],
    view_angle: [], view_hborder: [], view_vborder: [], view_hspeed: [], view_vspeed: [], view_object: [], view_surface_id: [],
    background_visible: [], background_foreground: [], background_index: [], background_x: [], background_y: [],
    background_width: [], background_height: [], background_htiled: [], background_vtiled: [], background_xscale: [], background_yscale: [],
    background_hspeed: [], background_vspeed: [], background_blend: [], background_alpha: [],
    background_color: 0, background_showcolor: 1,
    score: 0, lives: 0, health: 100, keyboard_lastkey: 0, keyboard_lastchar: '', keyboard_string: '', keyboard_key: 0,
    mouse_x: 0, mouse_y: 0, mouse_button: 0, mouse_lastbutton: 0,
    os_type: 0, os_device: 0, os_browser: -1, os_version: 0, working_directory: '', program_directory: '', temp_directory: '', game_id: 0,
    application_surface: -2, debug_mode: 0, delta_time: 33333, cursor_sprite: -1, fps: 30, fps_real: 30, secure_mode: 0, transition_kind: 0,
    event_type: 0, event_number: 0, event_object: -1, room_caption: 'UNDERTALE',
    get room_first() { return 0; }, get room_last() { return UT.D.rooms.length - 1; },
    get room_width() { return R.roomW; }, get room_height() { return R.roomH; },
    get room_persistent() { return R.roomPersistent[R.room] ? 1 : 0; }, set room_persistent(v) { R.roomPersistent[R.room] = $t(v); },
    get instance_count() { let n = 0; for (const i of R.instances) if (!i.$dead && !i.$deact) n++; return n; },
    get current_time() { return Math.floor(performance.now()); },
    get current_year() { return new Date().getFullYear(); }, get current_month() { return new Date().getMonth() + 1; },
    get current_day() { return new Date().getDate(); }, get current_weekday() { return new Date().getDay(); },
    get current_hour() { return new Date().getHours(); }, get current_minute() { return new Date().getMinutes(); },
    get current_second() { return new Date().getSeconds(); },
    roomW: 640, roomH: 480, roomPersistent: [], savedRooms: new Map(), tiles: [], tileLayerOffsets: new Map(), hiddenLayers: new Set(),
    otherStack: [], errors: new Map(),
  };
  R.GL = makeGlobals();

  // ------------------------------------------------------------------ objects / inheritance
  let D = null; // UT_DATA
  let CODE = null; // {OBJ, IC}
  const eventCache = new Map(); // obj -> Map(key -> {fn, owner})
  let descendants = []; // obj index -> array of obj indices (self + descendants)
  let ancestors = []; // obj index -> Set of self + ancestors
  const collisionPairs = []; // obj index -> array of [targetObj, key]

  function setupObjects() {
    const n = D.objects.length;
    descendants = Array.from({ length: n }, (_, i) => [i]);
    ancestors = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n; i++) {
      let p = i; const seen = new Set();
      while (p >= 0 && !seen.has(p)) { seen.add(p); ancestors[i].add(p); if (p !== i) descendants[p].push(i); p = D.objects[p].parent; }
    }
    for (let i = 0; i < n; i++) {
      // collision events available to this object (own + inherited)
      const pairs = new Map();
      let p = i; const seen = new Set();
      while (p >= 0 && !seen.has(p)) {
        seen.add(p);
        for (const k of D.objects[p].events) if (k.startsWith('Collision_')) { const t = +k.slice(10); if (!pairs.has(t)) pairs.set(t, k); }
        p = D.objects[p].parent;
      }
      collisionPairs[i] = [...pairs.entries()];
    }
  }
  function findEvent(obj, key) {
    let m = eventCache.get(obj);
    if (!m) { m = new Map(); eventCache.set(obj, m); }
    if (m.has(key)) return m.get(key);
    let p = obj; let found = null; const seen = new Set();
    while (p >= 0 && !seen.has(p)) {
      seen.add(p);
      const ev = CODE.OBJ[p];
      if (ev && ev[key]) { found = { fn: ev[key], owner: p }; break; }
      p = D.objects[p].parent;
    }
    m.set(key, found);
    return found;
  }
  function hasEvent(obj, key) { return !!findEvent(obj, key); }
  function isA(obj, target) { return obj >= 0 && ancestors[obj] ? ancestors[obj].has(target) : false; }

  function reportError(where, e) {
    const k = where + ': ' + (e && e.message);
    const c = (R.errors.get(k) || 0) + 1;
    R.errors.set(k, c);
    if (c === 1) { console.error('[GML error] ' + where, e); if (UT.onError) UT.onError(k); }
  }

  function runEventFn(inst, found, key, other) {
    const prevEv = R.curEvent;
    R.curEvent = key;
    try { found.fn(inst, other === undefined ? inst : other); }
    catch (e) { if (e === HALT) throw e; reportError(D.objects[found.owner].name + ' :: ' + key, e); }
    R.curEvent = prevEv;
  }
  function runEvent(inst, key, other) {
    if (inst.$dead && key !== 'Destroy_0') return;
    const found = findEvent(inst.object_index, key);
    if (found) runEventFn(inst, found, key, other);
  }
  const HALT = { halt: true };
  UT.HALT = HALT;

  function $inherited(self, other, objName, key) {
    const oi = objIndexByName.get(objName);
    if (oi === undefined) return 0;
    const parent = D.objects[oi].parent;
    if (parent < 0) return 0;
    const found = findEvent(parent, key);
    if (found) found.fn(self, other);
    return 0;
  }

  // ------------------------------------------------------------------ instances
  class Instance {
    constructor(obj, x, y, id) {
      const od = D.objects[obj];
      this.id = id; this.object_index = obj;
      this.x = x; this.y = y; this.xstart = x; this.ystart = y; this.xprevious = x; this.yprevious = y;
      this._hs = 0; this._vs = 0; this._spd = 0; this._dir = 0;
      this.friction = 0; this.gravity = 0; this.gravity_direction = 270;
      this._spr = od.sprite; this.image_index = 0; this.image_speed = 1;
      this.image_xscale = 1; this.image_yscale = 1; this.image_angle = 0; this.image_alpha = 1; this.image_blend = 16777215;
      this.mask_index = od.mask; this.depth = od.depth; this.visible = od.visible ? 1 : 0; this.solid = od.solid ? 1 : 0;
      this.persistent = od.persistent ? 1 : 0;
      this.alarm = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
      this.path_index = -1; this.path_position = 0; this.path_positionprevious = 0; this.path_speed = 0; this.path_scale = 1;
      this.path_orientation = 0; this.path_endaction = 0; this._pathAbs = false; this._pathX = 0; this._pathY = 0;
      this.timeline_index = -1; this.timeline_position = 0; this.timeline_speed = 1; this.timeline_running = 0; this.timeline_loop = 0;
      this.$dead = false; this.$deact = false; this.$order = 0;
    }
    get sprite_index() { return this._spr; }
    set sprite_index(v) { v = $num(v); if (v !== this._spr) { this._spr = v; } }
    get hspeed() { return this._hs; }
    set hspeed(v) { this._hs = $num(v); this._syncFromHV(); }
    get vspeed() { return this._vs; }
    set vspeed(v) { this._vs = $num(v); this._syncFromHV(); }
    get speed() { return this._spd; }
    set speed(v) { this._spd = $num(v); this._syncFromSD(); }
    get direction() { return this._dir; }
    set direction(v) { v = $num(v) % 360; if (v < 0) v += 360; this._dir = v; this._syncFromSD(); }
    _syncFromHV() {
      this._spd = Math.sqrt(this._hs * this._hs + this._vs * this._vs);
      if (this._hs !== 0 || this._vs !== 0) { let d = Math.atan2(-this._vs, this._hs) * 180 / Math.PI; if (d < 0) d += 360; this._dir = d; }
    }
    _syncFromSD() {
      const r = this._dir * Math.PI / 180;
      this._hs = this._spd * Math.cos(r); this._vs = -this._spd * Math.sin(r);
      if (Math.abs(this._hs) < 1e-10) this._hs = 0; if (Math.abs(this._vs) < 1e-10) this._vs = 0;
    }
    get image_number() { const s = D.sprites[this._spr]; return s ? s.frames.length : 0; }
    get sprite_width() { const s = UT.spriteInfo(this._spr); return s ? s.w * this.image_xscale : 0; }
    get sprite_height() { const s = UT.spriteInfo(this._spr); return s ? s.h * this.image_yscale : 0; }
    get sprite_xoffset() { const s = UT.spriteInfo(this._spr); return s ? s.xo * this.image_xscale : 0; }
    get sprite_yoffset() { const s = UT.spriteInfo(this._spr); return s ? s.yo * this.image_yscale : 0; }
    get bbox_left() { return UT.bbox(this)[0]; }
    get bbox_top() { return UT.bbox(this)[1]; }
    get bbox_right() { return UT.bbox(this)[2]; }
    get bbox_bottom() { return UT.bbox(this)[3]; }
  }
  Object.setPrototypeOf(Instance.prototype, FALLBACK);
  UT.Instance = Instance;

  let orderCounter = 0;
  function createInstance(obj, x, y, id, runCreate = true) {
    if (id === undefined || id === null) id = R.nextId++;
    const inst = new Instance(obj, x, y, id);
    inst.$order = orderCounter++;
    R.instances.push(inst);
    R.byId.set(id, inst);
    if (runCreate) runEvent(inst, 'Create_0');
    return inst;
  }
  function destroyInstance(inst, runDestroy = true) {
    if (inst.$dead) return;
    if (runDestroy) runEvent(inst, 'Destroy_0');
    inst.$dead = true;
    R.dirty = true;
  }
  function purgeDead() {
    if (!R.dirty) return;
    R.dirty = false;
    const keep = [];
    for (const i of R.instances) { if (i.$dead) R.byId.delete(i.id); else keep.push(i); }
    R.instances = keep;
  }
  // iterate live instances of an object (with descendants)
  function* each(obj) {
    const list = R.instances;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (!i.$dead && !i.$deact && isA(i.object_index, obj)) yield i;
    }
  }
  function firstOf(obj) { for (const i of each(obj)) return i; return null; }
  // resolve a GML "instance or object" value to an instance (for reads)
  function $inst(v, self, other) {
    v = $n(v);
    if (v === -1) return self;
    if (v === -2) return other;
    if (v === -5) return R.GL;
    if (v >= 100000) { const i = R.byId.get(v); return i && !i.$dead ? i : (i || DEAD_INST); }
    const i = firstOf(v);
    return i || DEAD_INST;
  }
  const DEAD_INST = Object.create(FALLBACK);
  DEAD_INST.alarm = [];
  function $rd(target, name, self, other) {
    if (target instanceof Instance) return target[name];
    const inst = $inst(target, self, other);
    if (inst === DEAD_INST) { reportError('read ' + name + ' of missing instance/object ' + target, new Error('missing')); return 0; }
    return inst[name];
  }
  function targets(v, self, other) {
    v = $n(v);
    if (v === -1) return [self];
    if (v === -2) return [other];
    if (v === -3) return R.instances.filter(i => !i.$dead && !i.$deact);
    if (v === -4) return [];
    if (v === -5) return [R.GL];
    if (v >= 100000) { const i = R.byId.get(v); return i && !i.$dead ? [i] : []; }
    return [...each(v)];
  }
  function $wr(target, name, val, self, other) {
    if (target instanceof Instance) { target[name] = val; return val; }
    for (const i of targets(target, self, other)) i[name] = val;
    return val;
  }
  function $wrop(target, name, fn, self, other) {
    for (const i of targets(target, self, other)) i[name] = fn(i[name]);
    return 0;
  }
  function $withList(v, self, other) {
    if (v instanceof Instance) return [v];
    return targets(v, self, other);
  }

  // ------------------------------------------------------------------ rooms
  let objIndexByName = new Map();
  function setViewsFromRoom(rd) {
    R.view_enabled = rd.views_enabled ? 1 : 0;
    for (let i = 0; i < 8; i++) {
      const v = rd.views[i] || { visible: false, obj: -4, xview: 0, yview: 0, wview: 640, hview: 480, xport: 0, yport: 0, wport: 640, hport: 480, hborder: 32, vborder: 32, hspeed: -1, vspeed: -1 };
      R.view_visible[i] = v.visible ? 1 : 0; R.view_xview[i] = v.xview; R.view_yview[i] = v.yview; R.view_wview[i] = v.wview; R.view_hview[i] = v.hview;
      R.view_xport[i] = v.xport; R.view_yport[i] = v.yport; R.view_wport[i] = v.wport; R.view_hport[i] = v.hport;
      R.view_hborder[i] = v.hborder; R.view_vborder[i] = v.vborder; R.view_hspeed[i] = v.hspeed; R.view_vspeed[i] = v.vspeed;
      R.view_object[i] = v.obj; R.view_angle[i] = 0;
    }
  }
  function setBackgroundsFromRoom(rd) {
    R.background_color = rd.colour; R.background_showcolor = rd.showcolour ? 1 : 0;
    for (let i = 0; i < 8; i++) {
      const b = rd.backgrounds[i] || { visible: false, foreground: false, bg: -1, x: 0, y: 0, htiled: true, vtiled: true, hspeed: 0, vspeed: 0, stretch: false };
      R.background_visible[i] = b.visible ? 1 : 0; R.background_foreground[i] = b.foreground ? 1 : 0; R.background_index[i] = b.bg;
      R.background_x[i] = b.x; R.background_y[i] = b.y; R.background_htiled[i] = b.htiled ? 1 : 0; R.background_vtiled[i] = b.vtiled ? 1 : 0;
      R.background_hspeed[i] = b.hspeed; R.background_vspeed[i] = b.vspeed; R.background_xscale[i] = 1; R.background_yscale[i] = 1;
      R.background_blend[i] = 16777215; R.background_alpha[i] = 1; R.background_stretch = R.background_stretch || []; R.background_stretch[i] = b.stretch;
      const bd = b.bg >= 0 ? D.backgrounds[b.bg] : null;
      R.background_width[i] = bd ? bd.w : 0; R.background_height[i] = bd ? bd.h : 0;
    }
  }

  function enterRoom(ri, isGameStart) {
    const rd = D.rooms[ri];
    R.room = ri; R.roomW = rd.w; R.roomH = rd.h; R.room_speed = rd.speed;
    if (R.roomPersistent[ri] === undefined) R.roomPersistent[ri] = !!rd.persistent;
    let saved = R.savedRooms.get(ri);
    if (saved && !R.roomPersistent[ri]) {
      // made non-persistent since it was left (room_set_persistent(room, false), as loading a save does after a
      // battle): GameMaker throws the stored state away and builds the room fresh
      for (const inst of saved.instances) inst.$dead = true;
      R.savedRooms.delete(ri); saved = null;
    }
    if (saved) {
      // persistent room: restore state
      R.savedRooms.delete(ri);
      for (const inst of saved.instances) { R.instances.push(inst); R.byId.set(inst.id, inst); }
      R.tiles = saved.tiles; R.tileLayerOffsets = saved.tileLayerOffsets; R.hiddenLayers = saved.hiddenLayers;
      setViewsFromRoom(rd); Object.assign(R, saved.viewState);
      for (const inst of R.instances.slice()) if (!inst.$dead) runEvent(inst, 'Other_4');
      return;
    }
    setViewsFromRoom(rd);
    setBackgroundsFromRoom(rd);
    R.tiles = rd.tiles.map(t => ({ ...t, visible: true }));
    R.tileLayerOffsets = new Map(); R.hiddenLayers = new Set();
    const created = [];
    for (const idef of rd.instances) {
      if (R.byId.has(idef.id) && !R.byId.get(idef.id).$dead) continue; // persistent instance already exists
      const inst = createInstance(idef.obj, idef.x, idef.y, idef.id, false);
      inst.image_xscale = idef.sx; inst.image_yscale = idef.sy; inst.image_angle = idef.rot;
      if (idef.col !== 4294967295) inst.image_blend = idef.col & 0xFFFFFF;
      created.push([inst, idef]);
    }
    // GMS 1.4 order: create event, then instance creation code
    for (const [inst, idef] of created) {
      if (inst.$dead) continue;
      runEvent(inst, 'Create_0');
      if (idef.code >= 0 && !inst.$dead) { try { CODE.IC[idef.code](inst, inst); } catch (e) { reportError('creation code ' + rd.name, e); } }
    }
    if (isGameStart) for (const inst of R.instances.slice()) runEvent(inst, 'Other_2');
    if (rd.code >= 0) { try { CODE.IC[rd.code](DEAD_INST, DEAD_INST); } catch (e) { reportError('room code ' + rd.name, e); } }
    for (const inst of R.instances.slice()) if (!inst.$dead) runEvent(inst, 'Other_4');
  }

  function leaveRoom() {
    for (const inst of R.instances.slice()) if (!inst.$dead) runEvent(inst, 'Other_5');
    purgeDead();
    const ri = R.room;
    const keep = [], stay = [];
    for (const inst of R.instances) (inst.persistent ? keep : stay).push(inst);
    if (R.roomPersistent[ri]) {
      R.savedRooms.set(ri, {
        instances: stay, tiles: R.tiles, tileLayerOffsets: R.tileLayerOffsets, hiddenLayers: R.hiddenLayers,
        viewState: { view_xview: R.view_xview.slice(), view_yview: R.view_yview.slice(), view_visible: R.view_visible.slice(), view_object: R.view_object.slice(), background_color: R.background_color, background_showcolor: R.background_showcolor, background_visible: R.background_visible.slice(), background_index: R.background_index.slice(), background_x: R.background_x.slice(), background_y: R.background_y.slice(), background_foreground: R.background_foreground.slice(), background_htiled: R.background_htiled.slice(), background_vtiled: R.background_vtiled.slice(), background_hspeed: R.background_hspeed.slice(), background_vspeed: R.background_vspeed.slice(), background_width: R.background_width.slice(), background_height: R.background_height.slice(), background_alpha: R.background_alpha.slice(), background_blend: R.background_blend.slice(), background_xscale: R.background_xscale.slice(), background_yscale: R.background_yscale.slice() },
      });
      for (const inst of stay) R.byId.delete(inst.id);
    } else {
      for (const inst of stay) { inst.$dead = true; R.byId.delete(inst.id); }
    }
    R.instances = keep;
  }

  function gotoRoom(ri) {
    if (ri < 0 || ri >= D.rooms.length) { reportError('room_goto', new Error('bad room ' + ri)); return; }
    R.pendingRoom = ri;
  }

  // ------------------------------------------------------------------ main step
  // GameMaker Studio dispatches step, alarm and keyboard events object by object in resource order
  // (then by creation within an object), not purely in creation order. Some scenes depend on it, e.g.
  // the dialogue box (lower index) must notice its text ended before the speaker's step looks for it.
  function byObject() { return R.instances.slice().sort((a, b) => (a.object_index - b.object_index) || (a.$order - b.$order)); }
  function stepAll(key) {
    const list = byObject();
    for (const inst of list) if (!inst.$dead && !inst.$deact) runEvent(inst, key);
  }

  function doAlarms() {
    const list = byObject();
    for (const inst of list) {
      if (inst.$dead || inst.$deact) continue;
      const a = inst.alarm;
      for (let k = 0; k < 12; k++) {
        const v = a[k];
        if (typeof v === 'number' && v > 0) {
          const nv = v - 1;
          a[k] = nv;
          if (nv <= 0) {
            a[k] = -1;
            runEvent(inst, 'Alarm_' + k);
            if (inst.$dead) break;
          }
        }
      }
    }
  }

  function doKeyboardEvents() {
    const inp = UT.input;
    const list = byObject();
    for (const inst of list) {
      if (inst.$dead || inst.$deact) continue;
      const evs = D.objects[inst.object_index];
      // quick reject: most objects have no keyboard events (check inherited through cache)
      if (!inst.$kbd) inst.$kbd = kbdEventsFor(inst.object_index);
      for (const [type, code, key] of inst.$kbd) {
        if (inst.$dead) break;
        let fire = false;
        if (type === 'Keyboard') fire = !!UT.F.keyboard_check(null, null, code);
        else if (type === 'KeyPress') fire = !!UT.F.keyboard_check_pressed(null, null, code);
        else if (type === 'KeyRelease') fire = !!UT.F.keyboard_check_released(null, null, code);
        if (fire) runEvent(inst, key);
      }
    }
  }
  const kbdCache = new Map();
  function kbdEventsFor(obj) {
    if (kbdCache.has(obj)) return kbdCache.get(obj);
    const keys = new Set();
    let p = obj; const seen = new Set();
    while (p >= 0 && !seen.has(p)) { seen.add(p); for (const k of D.objects[p].events) if (/^(Keyboard|KeyPress|KeyRelease)_/.test(k)) keys.add(k); p = D.objects[p].parent; }
    const out = [...keys].map(k => { const [t, c] = k.split('_'); return [t, +c, k]; });
    kbdCache.set(obj, out);
    return out;
  }

  function doMovement() {
    for (const inst of R.instances) {
      if (inst.$dead || inst.$deact) continue;
      // friction
      if (inst.friction !== 0 && inst._spd !== 0) {
        let s = inst._spd;
        if (s > 0) { s -= inst.friction; if (s < 0 && inst.friction > 0) s = 0; }
        else { s += inst.friction; if (s > 0 && inst.friction > 0) s = 0; }
        inst._spd = s; inst._syncFromSD();
      }
      if (inst.gravity !== 0) {
        const r = inst.gravity_direction * Math.PI / 180;
        inst._hs += inst.gravity * Math.cos(r); inst._vs -= inst.gravity * Math.sin(r); inst._syncFromHV();
      }
      if (inst.path_index >= 0 && UT.pathStep) UT.pathStep(inst);
      else if (inst._hs !== 0 || inst._vs !== 0) { inst.x += inst._hs; inst.y += inst._vs; }
    }
  }

  function doAnimation() {
    const list = R.instances.slice();
    for (const inst of list) {
      if (inst.$dead || inst.$deact) continue;
      const n = inst.image_number;
      if (inst.image_speed !== 0 && n > 0) {
        inst.image_index += inst.image_speed;
        if (inst.image_index >= n) { inst.image_index -= n; runEvent(inst, 'Other_7'); }
        else if (inst.image_index < 0) { inst.image_index += n; runEvent(inst, 'Other_7'); }
      }
    }
  }

  function doCollisions() {
    // GameMaker handles collision events object by object in resource order, not in instance creation order.
    // That matters: e.g. the talking rock (lower index) must see Frisk touch it before Frisk's own wall
    // collision pushes Frisk back out.
    const list = byObject();
    for (const inst of list) {
      if (inst.$dead || inst.$deact) continue;
      const pairs = collisionPairs[inst.object_index];
      if (!pairs.length) continue;
      for (const [target, key] of pairs) {
        for (const other of each(target)) {
          if (other === inst || inst.$dead) continue;
          if (other.$dead) continue;
          if (UT.instancesCollide(inst, other)) {
            // GameMaker puts BOTH instances back where they were when either one is solid
            if (other.solid || inst.solid) { inst.x = inst.xprevious; inst.y = inst.yprevious; other.x = other.xprevious; other.y = other.yprevious; }
            runEvent(inst, key, other);
          }
        }
        if (inst.$dead) break;
      }
    }
  }

  function doOutsideAndViews() {
    // Outside room (Other_0)
    const list = R.instances.slice();
    for (const inst of list) {
      if (inst.$dead || inst.$deact) continue;
      if (!hasEvent(inst.object_index, 'Other_0')) continue;
      // GameMaker quirk: an instance with no sprite or mask has an empty bounding box and counts as outside the
      // room every step. Several controllers use the Outside Room event as a step event because of this.
      if ($num(inst.sprite_index) < 0 && $num(inst.mask_index) < 0) { runEvent(inst, 'Other_0'); continue; }
      const b = UT.bbox(inst);
      const outside = b[2] < 0 || b[0] > R.roomW || b[3] < 0 || b[1] > R.roomH;
      if (outside) runEvent(inst, 'Other_0');
    }
    // background scrolling
    for (let i = 0; i < 8; i++) { R.background_x[i] += $num(R.background_hspeed[i]); R.background_y[i] += $num(R.background_vspeed[i]); }
    // view following
    if (R.view_enabled) for (let v = 0; v < 8; v++) {
      if (!R.view_visible[v]) continue;
      const o = R.view_object[v];
      if (o === undefined || o < 0) continue;
      const inst = o >= 100000 ? R.byId.get(o) : firstOf(o);
      if (!inst) continue;
      let vx = R.view_xview[v], vy = R.view_yview[v]; const vw = R.view_wview[v], vh = R.view_hview[v];
      // a border wider than half the view keeps the object centred
      const hb = Math.min(R.view_hborder[v], vw / 2), vb = Math.min(R.view_vborder[v], vh / 2);
      if (inst.x - hb < vx) vx = inst.x - hb; if (inst.x + hb > vx + vw) vx = inst.x + hb - vw;
      if (inst.y - vb < vy) vy = inst.y - vb; if (inst.y + vb > vy + vh) vy = inst.y + vb - vh;
      vx = Math.max(0, Math.min(vx, R.roomW - vw)); vy = Math.max(0, Math.min(vy, R.roomH - vh));
      R.view_xview[v] = vx; R.view_yview[v] = vy;
    }
  }

  function frame() {
    R.frame++;
    for (const inst of R.instances) { inst.xprevious = inst.x; inst.yprevious = inst.y; }
    stepAll('Step_1'); purgeDead();
    doAlarms(); purgeDead();
    doKeyboardEvents(); purgeDead();
    stepAll('Step_0'); purgeDead();
    doMovement();
    doAnimation(); purgeDead();
    doCollisions(); purgeDead();
    stepAll('Step_2'); purgeDead();
    doOutsideAndViews(); purgeDead();
    UT.drawFrame();
    purgeDead();
    if (UT.audio) UT.audio.update();
    UT.input.endFrame();
    handleRoomChange();
  }

  function handleRoomChange() {
    if (R.endRequested) { R.endRequested = false; UT.gameEnded(); return; }
    if (R.restartRequested) { R.restartRequested = false; restartGame(); return; }
    let guard = 0;
    while (R.pendingRoom >= 0 && guard++ < 10) {
      const ri = R.pendingRoom; R.pendingRoom = -1;
      leaveRoom();
      enterRoom(ri, false);
      purgeDead();
    }
  }

  function restartGame() {
    for (const inst of R.instances) inst.$dead = true;
    R.instances = []; R.byId.clear(); R.savedRooms.clear(); R.roomPersistent = [];
    for (const k of Object.keys(R.GL)) delete R.GL[k];
    if (UT.audio) UT.audio.stopAll();
    R.pendingRoom = -1;
    enterRoom(0, true);
    purgeDead();
    handleRoomChange();
  }

  // ------------------------------------------------------------------ boot
  UT.boot = function () {
    D = UT.D = window.UT_DATA;
    objIndexByName = new Map(D.objects.map((o, i) => [o.name, i]));
    UT.objIndexByName = objIndexByName;
    setupObjects();
    const RT = {
      R, F: UT.F, S: UT.S, GL: R.GL, $t, $eq, $num, $mod, $div, $ar, $ar2, $aw, $aw2, $rd, $wr, $wrop, $inst, $withList, $swv, $inherited, $ix,
      $unknownFn: (n) => { reportError('unknown function ' + n, new Error(n)); return 0; },
      $translateError: (m) => { reportError('translate', new Error(m)); },
    };
    CODE = UT.CODE = window.UT_CODE(RT);
    restartGame();
  };

  UT.frame = frame;
  Object.assign(UT, { createInstance, destroyInstance, runEvent, findEvent, hasEvent, isA, each, firstOf, targets, $inst, gotoRoom, purgeDead, reportError, DEAD_INST, restartGame, $n, $num, $t, $eq, FALLBACK, makeGlobals, descendantsOf: (o) => descendants[o] || [] });
})();
