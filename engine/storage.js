// Undertale web port - save files (file_text_*, ini_*) backed by localStorage
'use strict';
(function () {
  const UT = window.UT;
  const PREFIX = 'undertale_web:';
  const mem = new Map();
  let ls = null;
  try { ls = window.localStorage; ls.setItem(PREFIX + '__probe', '1'); ls.removeItem(PREFIX + '__probe'); } catch (e) { ls = null; }
  // Read-only files that shipped next to the original executable but are not part of the decompiled project.
  // credits.txt held the backer names shown in the final credits; a short stand-in list is used instead.
  const BUNDLED = {
    'credits.txt': ['UNDERTALE', 'by Toby Fox', 'Thank you for playing', 'Web rebuild', 'for local play only', 'Stay determined', '%%%', ''].join('\r\n'),
  };
  const norm = (n) => String(n).replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  const FS = UT.fs = {
    exists(n) { n = norm(n); return ls ? ls.getItem(PREFIX + n) !== null : mem.has(n); },
    read(n) {
      n = norm(n); const v = ls ? ls.getItem(PREFIX + n) : (mem.has(n) ? mem.get(n) : null);
      if (v !== null && v !== undefined) return v;
      const b = n.split('/').pop(); return Object.prototype.hasOwnProperty.call(BUNDLED, b) ? BUNDLED[b] : null;
    },
    write(n, s) { n = norm(n); if (ls) { try { ls.setItem(PREFIX + n, s); } catch (e) { mem.set(n, s); } } else mem.set(n, s); },
    remove(n) { n = norm(n); if (ls) ls.removeItem(PREFIX + n); mem.delete(n); },
    list() { const out = []; if (ls) { for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length)); } } else out.push(...mem.keys()); return out; },
    clearAll() { for (const n of FS.list()) FS.remove(n); },
  };

  // ------------------------------------------------------------------ text files
  const handles = new Map(); let nextHandle = 1;
  UT.textFile = {
    openRead(n) { const s = FS.read(n); if (s === null) return -1; const h = nextHandle++; handles.set(h, { mode: 'r', name: n, data: s, pos: 0 }); return h; },
    openWrite(n) { const h = nextHandle++; handles.set(h, { mode: 'w', name: n, data: '' }); return h; },
    openAppend(n) { const h = nextHandle++; handles.set(h, { mode: 'w', name: n, data: FS.read(n) || '' }); return h; },
    close(h) { const f = handles.get(h); if (!f) return; if (f.mode === 'w') FS.write(f.name, f.data); handles.delete(h); },
    writeString(h, s) { const f = handles.get(h); if (f) f.data += String(s); },
    writeReal(h, v) { const f = handles.get(h); if (f) { if (f.data.length && !/[\n ]$/.test(f.data)) f.data += ' '; f.data += String(UT.$num(v)); } },
    writeln(h) { const f = handles.get(h); if (f) f.data += '\r\n'; },
    readString(h) {
      const f = handles.get(h); if (!f) return '';
      let e = f.data.indexOf('\n', f.pos); if (e < 0) e = f.data.length;
      let s = f.data.slice(f.pos, e); if (s.endsWith('\r')) s = s.slice(0, -1);
      f.pos = e; return s;
    },
    readReal(h) {
      const f = handles.get(h); if (!f) return 0;
      const m = /^[ \t]*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/.exec(f.data.slice(f.pos, f.pos + 64));
      if (!m) return 0;
      f.pos += m[0].length; return Number(m[1]);
    },
    readln(h) { const f = handles.get(h); if (!f) return ''; let e = f.data.indexOf('\n', f.pos); if (e < 0) { f.pos = f.data.length; return ''; } f.pos = e + 1; return ''; },
    eof(h) { const f = handles.get(h); if (!f) return 1; return f.pos >= f.data.length ? 1 : 0; },
  };

  // ------------------------------------------------------------------ ini files
  let ini = null;
  function parseIni(s) {
    const o = {}; let sec = '';
    for (const raw of (s || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line[0] === ';') continue;
      const m = /^\[(.*)\]$/.exec(line); if (m) { sec = m[1]; o[sec] = o[sec] || {}; continue; }
      const k = line.indexOf('='); if (k < 0) continue;
      let v = line.slice(k + 1).trim(); if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
      (o[sec] = o[sec] || {})[line.slice(0, k).trim()] = v;
    }
    return o;
  }
  function serialize(o) {
    let s = '';
    for (const sec of Object.keys(o)) { s += '[' + sec + ']\r\n'; for (const k of Object.keys(o[sec])) s += k + '="' + o[sec][k] + '"\r\n'; }
    return s;
  }
  UT.ini = {
    open(n) { if (ini) UT.ini.close(); ini = { name: n, data: parseIni(FS.read(n)), dirty: false }; return 1; },
    close() { if (!ini) return ''; const s = serialize(ini.data); if (ini.dirty) FS.write(ini.name, s); ini = null; return s; },
    readReal(sec, key, def) { if (!ini) return def; const v = ini.data[sec] && ini.data[sec][key]; if (v === undefined) return def; const n = Number(v); return isNaN(n) ? def : n; },
    readString(sec, key, def) { if (!ini) return def; const v = ini.data[sec] && ini.data[sec][key]; return v === undefined ? def : v; },
    write(sec, key, v) { if (!ini) return; (ini.data[sec] = ini.data[sec] || {})[key] = typeof v === 'number' ? String(v) : String(v); ini.dirty = true; },
    sectionExists(sec) { return ini && ini.data[sec] ? 1 : 0; },
  };
})();
