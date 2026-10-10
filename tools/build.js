#!/usr/bin/env node
// Build script: reads the decompiled GameMaker project (undertale-master) and writes
// data/game_data.js (resources, rooms, masks) and data/game_code.js (translated GML).
// Usage: node tools/build.js [path/to/undertale-master] [outdir]
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const gml = require('./gml.js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'undertale-master'));
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'data'));
const FIX_ORIGINAL_BUGS = !process.argv.includes('--no-bugfix');
const maps = JSON.parse(fs.readFileSync(path.join(__dirname, 'maps.json'), 'utf8'));
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, 'extra.json'), 'utf8'));
// same for sounds (anchored by scr_getmusindex, which names every music file with its sound number)
for (const [n, name] of Object.entries(extra.soundIndexFixes || {})) {
  const i = +n, j = maps.sounds.indexOf(name);
  if (j < 0) { console.warn('soundIndexFixes: unknown sound ' + name); continue; }
  if (i === j) continue;
  const t = maps.sounds[i]; maps.sounds[i] = name; maps.sounds[j] = t;
}
// fix guessed index-map entries for bare sprite numbers (swap names so the map stays one-to-one)
for (const [n, name] of Object.entries(extra.spriteIndexFixes || {})) {
  const i = +n, j = maps.sprites.indexOf(name);
  if (j < 0) { console.warn('spriteIndexFixes: unknown sprite ' + name); continue; }
  if (i === j) continue;
  const t = maps.sprites[i]; maps.sprites[i] = name; maps.sprites[j] = t;
}

function rd(p) { return fs.readFileSync(path.join(SRC, p), 'utf8'); }
function unesc(s) { return s.replace(/&#xA;/g, '\n').replace(/&#xD;/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
function tag(s, t) { const m = new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(s); return m ? unesc(m[1]) : null; }
function attrs(s) { const o = {}; s.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { o[k] = unesc(v); }); return o; }
const num = (v, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));

// ------------------------------------------------------------------ name -> index tables
const res = new Map();
const idx = {};
for (const kind of ['sprites', 'sounds', 'backgrounds', 'paths', 'scripts', 'fonts', 'objects', 'rooms']) {
  idx[kind] = new Map();
  maps[kind].forEach((n, i) => { idx[kind].set(n, i); if (!res.has(n)) res.set(n, i); });
}
const scriptNames = new Set(maps.scripts);

// ------------------------------------------------------------------ source fix-ups
const fixLog = [];
function fixSource(where, code) {
  const before = code;
  // 1. decompiler mangled the single-backslash string "\" into  "\" + chr(ord('"'))  (+ " + ")
  code = code.replace(/"\\" \+ chr\(ord\('"'\)\)(\s*\+\s*" \+ ")?/g, '"\\\\"');
  if (code !== before) fixLog.push(where + ': repaired mangled backslash string');
  if (where === 'SCRIPT SCR_TEXTTYPE' || where === 'SCRIPT SCR_TEXTTYPE_f') {
    // 2. decimals written with a comma by the decompiler (locale bug): "1,2" -> "1.2"
    const c2 = code.replace(/(\s)(\d+),(\d+)(?=,)/g, '$1$2.$3');
    if (c2 !== code) fixLog.push(where + ': repaired decimal commas'); code = c2;
  }
  if (where === 'obj_dialoguer :: Destroy_0' || where === 'obj_dialoguer :: Step_0') {
    // decompiler inverted "if (instance_exists(obj_face)) with (obj_face) instance_destroy();"
    const c2 = code.split('if(!instance_exists(774/* obj_face */))').join('if(instance_exists(774/* obj_face */))');
    if (c2 !== code) fixLog.push(where + ': repaired inverted face cleanup condition'); code = c2;
  }
  {
    // 4. the decompiler inverted instance_exists() guards: "a && instance_exists(o) && o.field" was written as
    //    "a && !instance_exists(o) && o.field", which reads a field of an instance that does not exist
    const c2 = code.split('\n').map((line) => line.replace(/!instance_exists\((\d+)\/\* (\w+) \*\/\)/g, (m, n, name, off) => {
      const rest = line.slice(off + m.length).split('{')[0];
      return new RegExp('\\b' + name + '\\.\\w').test(rest) ? m.slice(1) : m;
    })).join('\n');
    if (c2 !== code) fixLog.push(where + ': repaired inverted instance_exists guard'); code = c2;
  }
  if (where === 'SCRIPT scr_newvapordata') {
    // 3. raw line breaks inside the run-length dust data stand for the letter "m" (24 blank pixels)
    code = code.replace(/mydata= "([\s\S]*?)";/g, (m, d) => 'mydata= "' + d.replace(/\r?\n/g, 'm') + '";');
    fixLog.push(where + ': restored "m" characters in vapor data');
  }
  const objOf = where.split(' :: ')[0];
  if (extra.faceSprites && extra.faceSprites[objOf]) {
    const map = extra.faceSprites[objOf];
    const c2 = code.replace(/real\((\d+)\)/g, (m, n) => map[n] || m);
    if (c2 !== code) fixLog.push(where + ': named face sprites'); code = c2;
  }
  for (const f of (extra.restorations || [])) {
    if (f.where !== where) continue;
    if (!code.includes(f.find)) { console.warn('restoration pattern not found', where, f.find); continue; }
    code = code.split(f.find).join(f.replace); fixLog.push(where + ': ' + f.note);
  }
  if (FIX_ORIGINAL_BUGS) {
    for (const f of extra.bugfixes) {
      if (f.where !== where) continue;
      if (!code.includes(f.find)) { console.warn('bugfix pattern not found', where, f.find); continue; }
      code = code.split(f.find).join(f.replace); fixLog.push(where + ': ' + f.note);
    }
  }
  return code;
}

const unknownFns = new Set();
const allCalls = new Set();
// builtins = every called name that is not a script
function makeCtx(objName, eventKey, isScript, switchMode) {
  return { res, scripts: scriptNames, builtins: BUILTINS, objName, eventKey, isScript, unknownFns, switchMode };
}
let BUILTINS = new Set();

function translate(where, code, objName, eventKey, isScript) {
  code = fixSource(where, code);
  const switchMode = where === 'SCRIPT SCR_TEXT' ? 'rot' : 'rev';
  try {
    return gml.translate(code, makeCtx(objName, eventKey, isScript, switchMode));
  } catch (e) {
    console.error('TRANSLATE FAIL', where, e.message);
    return '  $translateError(' + JSON.stringify(where + ': ' + e.message) + ');\n';
  }
}

// ------------------------------------------------------------------ collect all called function names first
{
  const re = /\b([A-Za-z_]\w*)\s*\(/g;
  const scan = (s) => { let m; while ((m = re.exec(s))) allCalls.add(m[1]); };
  for (const o of maps.objects) scan(rd('objects/' + o + '.object.gmx'));
  for (const s of maps.scripts) scan(rd('scripts/' + s + '.gml'));
  for (const r of [...(extra.restorations || []), ...(extra.bugfixes || [])]) scan(r.replace);
  const kw = new Set(['if', 'while', 'repeat', 'with', 'switch', 'return', 'exit', 'for', 'until']);
  BUILTINS = new Set([...allCalls].filter(n => !scriptNames.has(n) && !kw.has(n)));
}

// ------------------------------------------------------------------ objects
const EVT = { 0: 'Create', 1: 'Destroy', 2: 'Alarm', 3: 'Step', 4: 'Collision', 5: 'Keyboard', 6: 'Mouse', 7: 'Other', 8: 'Draw', 9: 'KeyPress', 10: 'KeyRelease', 11: 'Trigger' };
const codeOut = [];
const objectsData = [];
maps.objects.forEach((name, oi) => {
  const s = rd('objects/' + name + '.object.gmx');
  const o = {
    name,
    sprite: idx.sprites.has(tag(s, 'spriteName')) ? idx.sprites.get(tag(s, 'spriteName')) : -1,
    solid: num(tag(s, 'solid')) !== 0,
    visible: num(tag(s, 'visible')) !== 0 && !(extra.invisibleObjects || []).includes(name),
    depth: num(tag(s, 'depth')),
    persistent: num(tag(s, 'persistent')) !== 0,
    parent: idx.objects.has(tag(s, 'parentName')) ? idx.objects.get(tag(s, 'parentName')) : -1,
    mask: idx.sprites.has(tag(s, 'maskName')) ? idx.sprites.get(tag(s, 'maskName')) : -1,
    events: [],
  };
  const evs = [];
  const evRe = /<event (eventtype="(\d+)"(?: enumb="(\d+)")?(?: ename="([^"]*)")?)>([\s\S]*?)<\/event>/g;
  let m;
  while ((m = evRe.exec(s))) {
    const et = +m[2]; const en = m[3]; const ename = m[4]; const body = m[5];
    let key;
    if (et === 4) { if (!idx.objects.has(ename)) { console.warn('collision with unknown object', name, ename); continue; } key = 'Collision_' + idx.objects.get(ename); }
    else key = EVT[et] + '_' + en;
    let code = '';
    const actRe = /<action>([\s\S]*?)<\/action>/g; let a;
    while ((a = actRe.exec(body))) {
      const act = a[1]; const id = tag(act, 'id');
      const args = [...act.matchAll(/<string>([\s\S]*?)<\/string>/g)].map(x => unesc(x[1]));
      if (id === '603') code += (args[0] || '') + '\n';
      else if (id === '109') code += 'x+= ' + args[0] + ';\ny+= ' + args[1] + ';\n'; // action_move_to (relative in practice)
      else if (id === '103') code += 'hspeed= ' + args[0] + ';\n';
      else console.warn('unhandled action', id, name, key);
    }
    const js = translate(name + ' :: ' + key, code, name, key, false);
    // extra.eventRenames: events the decompiler filed under the wrong type (screen wavers whose capture-and-draw
    // code came out as Outside Room; they only work when run in the draw pass at their depth)
    const rn = (extra.eventRenames || {})[name + ' :: ' + key];
    evs.push([rn || key, js]);
    o.events.push(key);
  }
  objectsData.push(o);
  codeOut.push('OBJ[' + oi + '] = {\n' + evs.map(([k, js]) => '  ' + JSON.stringify(k) + ': function(self, other) {\n' + js + '  }').join(',\n') + '\n};\n');
});

// ------------------------------------------------------------------ scripts
const scriptsData = [];
maps.scripts.forEach((name, si) => {
  const code = rd('scripts/' + name + '.gml');
  const js = translate('SCRIPT ' + name, code, '', '', true);
  codeOut.push('S[' + JSON.stringify(name) + '] = function(self, other, $a) {\n' + js + '  return 0;\n};\n');
  scriptsData.push(name);
});

// ------------------------------------------------------------------ rooms
const icode = [];
const roomsData = maps.rooms.map((name, ri) => {
  if (extra.syntheticRooms[name]) {
    const r = JSON.parse(JSON.stringify(extra.syntheticRooms[name]));
    r.name = name;
    r.instances = r.instances.map(i => ({ ...i, obj: idx.objects.get(i.obj) }));
    r.tiles = r.tiles.map(t => ({ ...t, bg: idx.backgrounds.get(t.bg) }));
    r.backgrounds = (r.backgrounds || []).map(b => ({ ...b, bg: b.bg ? idx.backgrounds.get(b.bg) : -1 }));
    r.views = r.views.map(v => ({ ...v, obj: typeof v.obj === 'string' ? idx.objects.get(v.obj) : v.obj }));
    delete r.note;
    return r;
  }
  const s = rd('rooms/' + name + '.room.gmx');
  const r = {
    name, w: num(tag(s, 'width')), h: num(tag(s, 'height')), speed: num(tag(s, 'speed'), 30),
    persistent: num(tag(s, 'persistent')) !== 0, colour: num(tag(s, 'colour')), showcolour: num(tag(s, 'showcolour')) !== 0,
    views_enabled: num(tag(s, 'enableViews')) !== 0, clearViewBackground: num(tag(s, 'clearViewBackground')) !== 0,
    views: [], backgrounds: [], instances: [], tiles: [], code: -1,
  };
  const rc = tag(s, 'code');
  if (rc && rc.trim()) { r.code = icode.length; icode.push(translate('ROOMCODE ' + name, rc, '', '', false)); }
  for (const vm of s.matchAll(/<view ([^>]*)\/>/g)) {
    const a = attrs(vm[1]);
    r.views.push({ visible: num(a.visible) !== 0, obj: idx.objects.has(a.objName) ? idx.objects.get(a.objName) : -4, xview: num(a.xview), yview: num(a.yview), wview: num(a.wview), hview: num(a.hview), xport: num(a.xport), yport: num(a.yport), wport: num(a.wport), hport: num(a.hport), hborder: num(a.hborder), vborder: num(a.vborder), hspeed: num(a.hspeed), vspeed: num(a.vspeed) });
  }
  for (const bm of s.matchAll(/<background ([^>]*)\/>/g)) {
    const a = attrs(bm[1]);
    r.backgrounds.push({ visible: num(a.visible) !== 0, foreground: num(a.foreground) !== 0, bg: idx.backgrounds.has(a.name) ? idx.backgrounds.get(a.name) : -1, x: num(a.x), y: num(a.y), htiled: num(a.htiled) !== 0, vtiled: num(a.vtiled) !== 0, hspeed: num(a.hspeed), vspeed: num(a.vspeed), stretch: num(a.stretch) !== 0 });
  }
  if (extra.roomViews && extra.roomViews[name]) {
    for (const [vi, vv] of Object.entries(extra.roomViews[name])) r.views[+vi] = { ...r.views[+vi], ...vv };
  }
  if (extra.roomBackgrounds && extra.roomBackgrounds[name]) {
    const ov = extra.roomBackgrounds[name];
    ov.forEach((b, i) => { r.backgrounds[i] = { ...b, bg: idx.backgrounds.get(b.bg) }; if (r.backgrounds[i].bg === undefined) throw new Error('bad bg override ' + b.bg); });
  }
  for (const im of s.matchAll(/<instance ([^>]*)\/>/g)) {
    const a = attrs(im[1]);
    if (!idx.objects.has(a.objName)) { console.warn('room', name, 'unknown object', a.objName); continue; }
    const inst = { obj: idx.objects.get(a.objName), x: num(a.x), y: num(a.y), id: Number(a.name.replace('inst_', '')), sx: num(a.scaleX, 1), sy: num(a.scaleY, 1), col: num(a.colour, 4294967295), rot: num(a.rotation), code: -1 };
    if (a.code && a.code.trim()) { inst.code = icode.length; icode.push(translate('INSTCODE ' + name + ' ' + a.name, a.code, maps.objects[inst.obj], '', false)); }
    r.instances.push(inst);
  }
  for (const tm of s.matchAll(/<tile ([^>]*)\/>/g)) {
    const a = attrs(tm[1]);
    if (!idx.backgrounds.has(a.bgName)) { console.warn('room', name, 'unknown bg', a.bgName); continue; }
    r.tiles.push({ bg: idx.backgrounds.get(a.bgName), x: num(a.x), y: num(a.y), w: num(a.w), h: num(a.h), xo: num(a.xo), yo: num(a.yo), id: num(a.id), depth: num(a.depth), sx: num(a.scaleX, 1), sy: num(a.scaleY, 1), col: num(a.colour, 4294967295) });
  }
  // The decompiler dropped every room's "view follows object" setting. The game's own code restores
  // view_object[0] = obj_mainchara after cutscenes, and obj_mainchara centres the view each step relying on
  // GameMaker's follow logic to clamp it to the room, so overworld rooms must follow the player.
  const mcIdx = idx.objects.get('obj_mainchara');
  if (r.views[0] && r.views[0].visible && r.views[0].obj === -4 && r.instances.some(i => i.obj === mcIdx)) r.views[0].obj = mcIdx;
  return r;
});
icode.forEach((js, i) => codeOut.push('IC[' + i + '] = function(self, other) {\n' + js + '};\n'));

// ------------------------------------------------------------------ PNG decoding (for collision masks)
function decodePNG(buf) {
  let p = 8; let w, h, bitDepth, colorType, interlace; const idat = []; let palette = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') palette = data; else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || interlace) throw new Error('unsupported png ' + bitDepth + ' ' + interlace);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch; const out = Buffer.alloc(w * h * ch); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (colorType === 6) alpha[i] = out[i * 4 + 3];
    else if (colorType === 4) alpha[i] = out[i * 2 + 1];
    else if (colorType === 3) alpha[i] = trns && out[i] < trns.length ? trns[out[i]] : 255;
    else alpha[i] = 255;
  }
  return { w, h, alpha };
}

// ------------------------------------------------------------------ trimmed frame placement
// Each exported frame is cropped to its opaque pixels. With automatic bounding boxes (bboxmode 0) the sprite's bbox is
// the union of those crops, which pins most frames exactly; "full image" boxes (mode 1) give the canvas size. Frames
// whose position is still ambiguous are placed by best pixel overlap with a reference frame, defaulting to
// bottom-aligned and horizontally centred (how character animations are drawn).
let placedCount = 0;
function overlapScore(a, ax, ay, b, bx, by) {
  const x1 = Math.max(ax, bx), y1 = Math.max(ay, by), x2 = Math.min(ax + a.w, bx + b.w), y2 = Math.min(ay + a.h, by + b.h);
  let inter = 0;
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) if (a.alpha[(y - ay) * a.w + (x - ax)] && b.alpha[(y - by) * b.w + (x - bx)]) inter++;
  return inter;
}
function placeFrames(pngs, mode, bbox) {
  const n = pngs.length; const offs = pngs.map(() => [0, 0]);
  const ok = pngs.filter(Boolean);
  if (!ok.length) return { offs, W: 0, H: 0 };
  const [bl, bt, br, bb] = bbox; const bw = br - bl + 1, bh = bb - bt + 1;
  const sameSize = ok.every(p => p.w === ok[0].w && p.h === ok[0].h);
  let ranges; // per frame [xlo,xhi,ylo,yhi]
  if (mode === 0 && bw > 0 && bh > 0) {
    const inside = ok.every(p => br < p.w && bb < p.h);
    if (inside) return { offs, W: Math.max(...ok.map(p => p.w)), H: Math.max(...ok.map(p => p.h)) }; // untrimmed
    ranges = pngs.map(p => p ? [...(p.w > bw ? [0, 0] : [bl, br - p.w + 1]), ...(p.h > bh ? [0, 0] : [bt, bb - p.h + 1])] : [0, 0, 0, 0]);
  } else if (mode === 1 && bw > 0 && bh > 0) {
    ranges = pngs.map(p => p ? [0, Math.max(0, br + 1 - p.w), 0, Math.max(0, bb + 1 - p.h)] : [0, 0, 0, 0]);
  } else {
    if (sameSize) return { offs, W: ok[0].w, H: ok[0].h };
    let refw = 0, refh = 0; for (const p of ok) { refw = Math.max(refw, p.w); refh = Math.max(refh, p.h); }
    ranges = pngs.map(p => p ? [0, refw - p.w, 0, refh - p.h] : [0, 0, 0, 0]);
  }
  // reference: a frame with no freedom, else the largest
  let ref = -1;
  for (let i = 0; i < n; i++) if (pngs[i] && ranges[i][0] === ranges[i][1] && ranges[i][2] === ranges[i][3]) { ref = i; break; }
  if (ref < 0) { let best = -1; for (let i = 0; i < n; i++) if (pngs[i] && pngs[i].w * pngs[i].h > best) { best = pngs[i].w * pngs[i].h; ref = i; } }
  const def = (r) => [Math.round((r[0] + r[1]) / 2), r[3]];
  offs[ref] = def(ranges[ref]);
  for (let i = 0; i < n; i++) {
    if (i === ref || !pngs[i]) continue;
    const r = ranges[i]; let [bx, by] = def(r);
    if ((r[0] !== r[1] || r[2] !== r[3]) && pngs[i].w * pngs[i].h <= 40000) {
      let best = -1; const cx = bx, cy = by;
      const xs = [], ys = [];
      for (let x = Math.max(r[0], cx - 12); x <= Math.min(r[1], cx + 12); x++) xs.push(x);
      for (let y = Math.max(r[2], cy - 12); y <= Math.min(r[3], cy + 12); y++) ys.push(y);
      for (const y of ys) for (const x of xs) {
        const sc = overlapScore(pngs[ref], offs[ref][0], offs[ref][1], pngs[i], x, y) * 1000 - Math.abs(x - cx) - Math.abs(y - cy);
        if (sc > best) { best = sc; bx = x; by = y; }
      }
    }
    offs[i] = [bx, by];
  }
  let W = 0, H = 0;
  pngs.forEach((p, i) => { if (p) { W = Math.max(W, offs[i][0] + p.w); H = Math.max(H, offs[i][1] + p.h); } });
  if (mode === 0 || mode === 1) { W = Math.max(W, br + 1); H = Math.max(H, bb + 1); }
  return { offs, W, H };
}

// ------------------------------------------------------------------ sprites
// Collision type was lost in export (every sprite says "precise"). Editor-only sprites (trigger boxes, markers,
// invisible walls) are drawn as hollow outlines, so a precise mask only collides on the outline. Give sprites that
// are only ever used by invisible objects, plus the marker sprites, a plain rectangle like the editor box they are.
const rectMaskSprites = new Set(extra.rectMaskSprites || []);
const invOnlySprites = new Set();
let rectCount = 0;
{
  const vis = new Set(), inv = new Set();
  for (const o of maps.objects) {
    const t = rd('objects/' + o + '.object.gmx'); const sn = tag(t, 'spriteName'); const mn = tag(t, 'maskName');
    const visible = num(tag(t, 'visible')) !== 0 && !(extra.invisibleObjects || []).includes(o);
    if (sn) (visible ? vis : inv).add(sn);
    if (mn && idx.sprites.has(mn)) inv.add(mn);
  }
  for (const n of inv) if (!vis.has(n)) invOnlySprites.add(n);
}
// a shape whose transparent pixels are partly enclosed (an outline drawing) is an editor box, not a real shape
function isHollow(png) {
  if (!png) return false;
  const { w, h, alpha } = png; const seen = new Uint8Array(w * h); const st = [];
  for (let x = 0; x < w; x++) { st.push(x, x + (h - 1) * w); } for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
  let open = 0, reached = 0;
  for (let i = 0; i < w * h; i++) if (!alpha[i]) open++;
  while (st.length) { const i = st.pop(); if (seen[i] || alpha[i]) continue; seen[i] = 1; reached++; const x = i % w, y = (i / w) | 0;
    if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
  return open - reached > (w * h) / 10;
}
const spritesData = maps.sprites.map((name) => {
  const s = rd('sprites/' + name + '.sprite.gmx');
  const frames = [...s.matchAll(/<frame index="\d+">([^<]*)<\/frame>/g)].map(m => m[1].replace(/\\/g, '/'));
  // the decompiler wrote every sprite's frames in reverse order (e.g. digit sprites run 9..0); restore it
  frames.reverse();
  const sp = {
    name, w: num(tag(s, 'width')), h: num(tag(s, 'height')), xo: num(tag(s, 'xorig')), yo: num(tag(s, 'yorigin')),
    bbox: [num(tag(s, 'bbox_left')), num(tag(s, 'bbox_top')), num(tag(s, 'bbox_right')), num(tag(s, 'bbox_bottom'))],
    sep: num(tag(s, 'sepmasks')) !== 0, frames, masks: [],
  };
  // The decompiler exported every frame trimmed to its visible pixels and dropped the trim offsets, so frames
  // must be put back where they sat on the sprite's canvas (see placeFrames). Then build precise masks.
  const pngs = frames.map((f) => { try { return decodePNG(fs.readFileSync(path.join(SRC, 'sprites', f))); } catch (e) { return null; } });
  const place = placeFrames(pngs, num(tag(s, 'bboxmode')), sp.bbox);
  const fo = (extra.frameOffsets || {})[name];
  if (fo) {
    frames.forEach((f, fi) => { const k = path.basename(f, '.png'); if (fo[k]) place.offs[fi] = fo[k].slice(); });
    pngs.forEach((p, i) => { if (p) { place.W = Math.max(place.W, place.offs[i][0] + p.w); place.H = Math.max(place.H, place.offs[i][1] + p.h); } });
  }
  // extra.spriteSizes: canvas size where the trimmed frames cannot reveal it (sprites that must share a width)
  const fsz = (extra.spriteSizes || {})[name];
  if (fsz) { place.W = Math.max(place.W, fsz[0]); place.H = Math.max(place.H, fsz[1]); }
  if (place.offs.some(o => o[0] || o[1]) || place.W !== sp.w || place.H !== sp.h) {
    sp.offs = place.offs; sp.fw = sp.w; sp.fh = sp.h; sp.w = place.W; sp.h = place.H; placedCount++;
  }
  const [bl, bt, br, bb] = sp.bbox; const mw = br - bl + 1, mh = bb - bt + 1;
  if (mw > 0 && mh > 0 && frames.length) {
    const union = new Uint8Array(mw * mh);
    const perFrame = [];
    pngs.forEach((png, fi) => {
      if (!png) { perFrame.push(null); return; }
      const [dx, dy] = place.offs[fi];
      const m = new Uint8Array(mw * mh);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        const px = bl + x - dx, py = bt + y - dy;
        if (px >= 0 && py >= 0 && px < png.w && py < png.h && png.alpha[py * png.w + px] > 0) { m[y * mw + x] = 1; union[y * mw + x] = 1; }
      }
      perFrame.push(m);
    });
    const enc = (m) => {
      if (!m) return 1;
      let full = true; for (let i = 0; i < m.length; i++) if (!m[i]) { full = false; break; }
      if (full) return 1;
      const bytes = Buffer.alloc(Math.ceil(m.length / 8));
      for (let i = 0; i < m.length; i++) if (m[i]) bytes[i >> 3] |= 1 << (i & 7);
      return bytes.toString('base64');
    };
    sp.masks = sp.sep ? perFrame.map(enc) : [enc(union)];
    // The project lost each sprite's collision kind (every sprite says 'precise'). A hand-set bounding box
    // (bboxmode 2) is how the game marks rectangle collision, e.g. Napstablook's box is taller than his image.
    if (num(tag(s, 'bboxmode')) === 2 || rectMaskSprites.has(name) || (invOnlySprites.has(name) && pngs.some(isHollow))) { sp.masks = [1]; rectCount++; }
  }
  return sp;
});

// ------------------------------------------------------------------ backgrounds, fonts, sounds, paths
// Background images were exported trimmed too. Tiles that show the whole image (xo = yo = 0) reveal its real size;
// the missing rows/columns go on the side the picture does not touch (a picture whose bottom row is solid was
// trimmed at the top). extra.backgroundPads gives exact [left, top, width, height] where this guess is not enough.
const bgFull = new Map();
for (const r of roomsData) for (const t of r.tiles) if (t.xo === 0 && t.yo === 0) {
  const f = bgFull.get(t.bg) || [0, 0]; bgFull.set(t.bg, [Math.max(f[0], t.w), Math.max(f[1], t.h)]);
}
const bgPadLog = [];
const backgroundsData = maps.backgrounds.map((name, bi) => {
  const s = rd('background/' + name + '.background.gmx');
  const b = { name, w: num(tag(s, 'width')), h: num(tag(s, 'height')), file: 'background/' + tag(s, 'data').replace(/\\/g, '/') };
  const man = (extra.backgroundPads || {})[name];
  if (man) { b.offs = [[man[0], man[1]]]; b.w = man[2]; b.h = man[3]; bgPadLog.push(name + ' manual ' + man.join(',')); return b; }
  const full = bgFull.get(bi);
  if (full && (full[0] > b.w || full[1] > b.h)) {
    let png = null; try { png = decodePNG(fs.readFileSync(path.join(SRC, b.file))); } catch (e) {}
    let dx = 0, dy = 0;
    if (png) {
      const op = (x, y) => png.alpha[y * png.w + x] > 0;
      let top = 0, bot = 0, lef = 0, rig = 0;
      for (let x = 0; x < png.w; x++) { if (op(x, 0)) top++; if (op(x, png.h - 1)) bot++; }
      for (let y = 0; y < png.h; y++) { if (op(0, y)) lef++; if (op(png.w - 1, y)) rig++; }
      if (full[1] > png.h && bot > png.w / 2 && top < png.w / 2) dy = full[1] - png.h;
      if (full[0] > png.w && rig > png.h / 2 && lef < png.h / 2) dx = full[0] - png.w;
    }
    b.offs = [[dx, dy]]; b.w = Math.max(b.w, full[0]); b.h = Math.max(b.h, full[1]);
    bgPadLog.push(name + ' pad ' + dx + ',' + dy + ' -> ' + b.w + 'x' + b.h);
  }
  return b;
});
const fontsData = maps.fonts.map((name) => {
  const s = rd('fonts/' + name + '.font.gmx');
  const glyphs = {};
  for (const g of s.matchAll(/<glyph character="32(\d+)" x="(\d+)" y="(\d+)" w="(\d+)" h="(\d+)" shift="(-?\d+)" offset="(-?\d+)"\/>/g)) {
    glyphs[32 + Number(g[1])] = [+g[2], +g[3], +g[4], +g[5], +g[6], +g[7]];
  }
  return { name, file: 'fonts/' + name + '.png', size: num(tag(s, 'size')), glyphs };
});
const soundsData = maps.sounds.map((name) => {
  const s = rd('sound/' + name + '.sound.gmx');
  // the project names abc_123_a as .mp3 but only an .ogg ships; use whichever file actually exists
  let sfile = 'sound/audio/' + tag(s, 'data');
  if (!fs.existsSync(path.join(SRC, sfile))) {
    const base = sfile.replace(/\.[^.\/]+$/, '');
    const alt = ['.ogg', '.wav', '.mp3'].map(e => base + e).find(f => fs.existsSync(path.join(SRC, f)));
    if (alt) sfile = alt;
  }
  return { name, file: sfile, volume: (() => { const m = /<volume>\s*<volume>([\d.]+)<\/volume>/.exec(s) || /<volume>([\d.]+)<\/volume>/.exec(s); const v = m ? Number(m[1]) : 1; return isFinite(v) ? v : 1; })(), kind: num(tag(s, 'kind')) };
});
const pathsData = maps.paths.map((name) => extra.paths[name] ? { name, ...extra.paths[name] } : { name, points: [], closed: false, smooth: false, precision: 4 });

// ------------------------------------------------------------------ write
fs.mkdirSync(OUT, { recursive: true });
const data = {
  objects: objectsData, sprites: spritesData, backgrounds: backgroundsData, fonts: fontsData, sounds: soundsData,
  paths: pathsData, rooms: roomsData, scripts: scriptsData, builtins: [...BUILTINS].sort(),
};
fs.writeFileSync(path.join(OUT, 'game_data.js'), '// Generated by tools/build.js - do not edit\nwindow.UT_DATA = ' + JSON.stringify(data) + ';\n');
fs.writeFileSync(path.join(OUT, 'game_code.js'), '// Generated by tools/build.js from the GameMaker project - do not edit\n' +
  'window.UT_CODE = function (RT) {\n"use strict";\nconst { R, F, S, GL, $t, $eq, $num, $mod, $div, $ar, $ar2, $aw, $aw2, $rd, $wr, $wrop, $inst, $withList, $swv, $inherited, $unknownFn, $translateError, $ix } = RT;\n' +
  'const OBJ = [], IC = [];\n' + codeOut.join('') + 'return { OBJ, IC };\n};\n');
fs.writeFileSync(path.join(OUT, 'build_log.txt'), fixLog.join('\n') + '\nunknown functions: ' + [...unknownFns].join(', ') + '\n');
const sz = (f) => (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1) + 'MB';
console.log('background pads:\n  ' + bgPadLog.join('\n  '));
console.log('placed trimmed frames for', placedCount, 'sprites; rectangle masks:', rectCount);
console.log('wrote', sz('game_data.js'), sz('game_code.js'), 'fixes:', fixLog.length, 'unknown fns:', [...unknownFns].join(','));
