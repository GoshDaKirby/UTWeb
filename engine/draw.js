// Undertale web port - graphics: asset images, sprites, masks/collisions, drawing primitives, fonts
'use strict';
(function () {
  const UT = window.UT;
  const R = UT.R;
  const G = UT.G = {
    canvas: null, ctx: null, W: 640, H: 480,
    color: 16777215, alpha: 1, font: -1, halign: 0, valign: 0, circlePrecision: 24,
    spriteImgs: [], bgImgs: [], fontImgs: [], dynSprites: new Map(), dynBackgrounds: new Map(), nextDynSprite: 100000, nextDynBg: 100000,
    tintCache: new Map(), maskCache: new Map(), surfaces: new Map(), nextSurface: 1, target: null,
  };

  // ------------------------------------------------------------------ colors
  function css(c, a) {
    c = UT.$num(c);
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    return a === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  UT.css = css;

  // ------------------------------------------------------------------ sprite information
  UT.spriteInfo = function (s) {
    if (s >= 100000) return G.dynSprites.get(s) || null;
    return (s >= 0 && UT.D.sprites[s]) || null;
  };
  function frameImage(s, sub) {
    const info = UT.spriteInfo(s);
    if (!info) return null;
    const n = info.frames.length || (info.imgs ? info.imgs.length : 0);
    if (!n) return null;
    let f = Math.floor(UT.$num(sub)) % n; if (f < 0) f += n;
    if (info.imgs) return info.imgs[f];
    const arr = G.spriteImgs[s];
    return arr ? arr[f] : null;
  }
  UT.frameImage = frameImage;

  // ------------------------------------------------------------------ bounding boxes & masks
  function maskSprite(inst) { return inst.mask_index >= 0 ? inst.mask_index : inst._spr; }
  function localBox(info) { const b = info.bbox; return [b[0] - info.xo, b[1] - info.yo, b[2] + 1 - info.xo, b[3] + 1 - info.yo]; }
  function worldBox(inst) {
    const info = UT.spriteInfo(maskSprite(inst));
    if (!info) return null;
    const [l, t, r, b] = localBox(info);
    const xs = inst.image_xscale, ys = inst.image_yscale, a = inst.image_angle;
    if (!a) {
      let x1 = inst.x + l * xs, x2 = inst.x + r * xs, y1 = inst.y + t * ys, y2 = inst.y + b * ys;
      if (x1 > x2) { const q = x1; x1 = x2; x2 = q; } if (y1 > y2) { const q = y1; y1 = y2; y2 = q; }
      return [x1, y1, x2, y2];
    }
    const rad = -a * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [px, py] of [[l, t], [r, t], [l, b], [r, b]]) {
      const X = px * xs, Y = py * ys;
      const wx = inst.x + X * c - Y * s, wy = inst.y + X * s + Y * c;
      if (wx < minx) minx = wx; if (wx > maxx) maxx = wx; if (wy < miny) miny = wy; if (wy > maxy) maxy = wy;
    }
    return [minx, miny, maxx, maxy];
  }
  UT.bbox = function (inst) {
    const w = worldBox(inst);
    if (!w) return [inst.x, inst.y, inst.x, inst.y];
    return [Math.round(w[0]), Math.round(w[1]), Math.round(w[2]) - 1, Math.round(w[3]) - 1];
  };
  function maskBits(s, frame) {
    const info = UT.spriteInfo(s);
    if (!info || !info.masks || !info.masks.length) return 1;
    const n = info.masks.length;
    let f = n === 1 ? 0 : Math.floor(frame) % n; if (f < 0) f += n;
    const m = info.masks[f];
    if (m === 1) return 1;
    const key = s + ':' + f;
    let bits = G.maskCache.get(key);
    if (!bits) {
      const bin = atob(m); bits = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i);
      G.maskCache.set(key, bits);
    }
    return bits;
  }
  // does world point (px,py) hit the instance's mask?
  function pointHits(inst, px, py, precise) {
    const s = maskSprite(inst);
    const info = UT.spriteInfo(s);
    if (!info) return false;
    let lx = px - inst.x, ly = py - inst.y;
    if (inst.image_angle) {
      const rad = inst.image_angle * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
      const X = lx * c - ly * sn, Y = lx * sn + ly * c; lx = X; ly = Y;
    }
    lx = lx / inst.image_xscale + info.xo; ly = ly / inst.image_yscale + info.yo;
    const b = info.bbox;
    if (lx < b[0] || lx >= b[2] + 1 || ly < b[1] || ly >= b[3] + 1) return false;
    if (!precise) return true;
    const bits = maskBits(s, inst.image_index);
    if (bits === 1) return true;
    const mw = b[2] - b[0] + 1;
    const ix = Math.floor(lx) - b[0], iy = Math.floor(ly) - b[1];
    const k = iy * mw + ix;
    return (bits[k >> 3] >> (k & 7)) & 1;
  }
  UT.instancesCollide = function (a, b) {
    const A = worldBox(a), B = worldBox(b);
    if (!A || !B) return false;
    const x1 = Math.max(A[0], B[0]), y1 = Math.max(A[1], B[1]), x2 = Math.min(A[2], B[2]), y2 = Math.min(A[3], B[3]);
    if (x1 >= x2 || y1 >= y2) return false;
    const ma = maskBits(maskSprite(a), a.image_index), mb = maskBits(maskSprite(b), b.image_index);
    if (ma === 1 && mb === 1 && !a.image_angle && !b.image_angle) return true;
    const sx = Math.floor(x1), sy = Math.floor(y1), ex = Math.ceil(x2), ey = Math.ceil(y2);
    for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (px < x1 || px > x2 || py < y1 || py > y2) continue;
      if (pointHits(a, px, py, true) && pointHits(b, px, py, true)) return true;
    }
    return false;
  };
  UT.pointHits = pointHits;
  UT.worldBox = worldBox;
  UT.rectHits = function (inst, x1, y1, x2, y2, precise) {
    if (x1 > x2) { const q = x1; x1 = x2; x2 = q; } if (y1 > y2) { const q = y1; y1 = y2; y2 = q; }
    const B = worldBox(inst); if (!B) return false;
    const ix1 = Math.max(x1, B[0]), iy1 = Math.max(y1, B[1]), ix2 = Math.min(x2 + 1, B[2]), iy2 = Math.min(y2 + 1, B[3]);
    if (ix1 >= ix2 || iy1 >= iy2) return false;
    const m = maskBits(maskSprite(inst), inst.image_index);
    if (!precise || (m === 1 && !inst.image_angle)) return true;
    for (let y = Math.floor(iy1); y < iy2; y++) for (let x = Math.floor(ix1); x < ix2; x++) if (pointHits(inst, x + 0.5, y + 0.5, true)) return true;
    return false;
  };

  // ------------------------------------------------------------------ tinting
  function tinted(img, color) {
    color = UT.$num(color) & 0xFFFFFF;
    if (color === 0xFFFFFF || !img) return img;
    if (!img.__tid) img.__tid = ++tinted.n;
    const key = img.__tid + ':' + color;
    let c = G.tintCache.get(key);
    if (c) return c;
    const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
    if (!w || !h) return img;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = css(color); x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
    if (G.tintCache.size > 3000) G.tintCache.clear();
    G.tintCache.set(key, c);
    return c;
  }
  tinted.n = 0;
  UT.tinted = tinted;

  // ------------------------------------------------------------------ core drawing
  function ctx() { return G.target ? G.target.ctx : G.ctx; }
  function imgReady(img) { return img && (img.complete === undefined || (img.complete && img.naturalWidth > 0)); }
  UT.drawSpriteExt = function (s, sub, x, y, xs, ys, rot, col, alpha) {
    const info = UT.spriteInfo(s); if (!info) return;
    const img = frameImage(s, sub); if (!imgReady(img)) return;
    const c = ctx();
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, UT.$num(alpha) * G.alphaMul));
    c.translate(x, y);
    if (rot) c.rotate(-UT.$num(rot) * Math.PI / 180);
    c.scale(xs, ys);
    c.drawImage(tinted(img, col), -info.xo, -info.yo);
    c.restore();
  };
  UT.drawSpritePart = function (s, sub, left, top, w, h, x, y, xs, ys, col, alpha) {
    const img = frameImage(s, sub); if (!imgReady(img)) return;
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    left = Math.round(left); top = Math.round(top); w = Math.round(w); h = Math.round(h);
    if (left < 0) { x -= left * xs; w += left; left = 0; } if (top < 0) { y -= top * ys; h += top; top = 0; }
    if (left + w > iw) w = iw - left; if (top + h > ih) h = ih - top;
    if (w <= 0 || h <= 0) return;
    const c = ctx();
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul));
    c.translate(x, y); c.scale(xs, ys);
    c.drawImage(tinted(img, col), left, top, w, h, 0, 0, w, h);
    c.restore();
  };
  UT.drawImageStretched = function (img, x, y, w, h, col, alpha) {
    if (!imgReady(img)) return;
    const c = ctx(); c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul));
    c.drawImage(tinted(img, col), x, y, w, h); c.restore();
  };
  UT.bgImage = function (b) {
    if (b >= 100000) { const d = G.dynBackgrounds.get(b); return d ? d.img : null; }
    return G.bgImgs[b] || null;
  };
  UT.bgInfo = function (b) { if (b >= 100000) return G.dynBackgrounds.get(b) || null; return UT.D.backgrounds[b] || null; };

  function fillRect(x1, y1, x2, y2, color, alpha) {
    const c = ctx(); c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul)); c.fillStyle = css(color);
    if (x1 > x2) { const q = x1; x1 = x2; x2 = q; } if (y1 > y2) { const q = y1; y1 = y2; y2 = q; }
    c.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1); c.restore();
  }
  UT.fillRect = fillRect;
  UT.drawRect = function (x1, y1, x2, y2, outline, col, alpha) {
    x1 = UT.$num(x1); y1 = UT.$num(y1); x2 = UT.$num(x2); y2 = UT.$num(y2);
    if (!UT.$t(outline)) return fillRect(x1, y1, x2, y2, col, alpha);
    if (x1 > x2) { const q = x1; x1 = x2; x2 = q; } if (y1 > y2) { const q = y1; y1 = y2; y2 = q; }
    fillRect(x1, y1, x2, y1, col, alpha); fillRect(x1, y2, x2, y2, col, alpha);
    fillRect(x1, y1, x1, y2, col, alpha); fillRect(x2, y1, x2, y2, col, alpha);
  };
  UT.drawLine = function (x1, y1, x2, y2, w, c1, c2, alpha) {
    const c = ctx(); c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul));
    if (c1 !== c2) { const gr = c.createLinearGradient(x1, y1, x2, y2); gr.addColorStop(0, css(c1)); gr.addColorStop(1, css(c2)); c.strokeStyle = gr; }
    else c.strokeStyle = css(c1);
    c.lineWidth = Math.max(1, w); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x1 + 0.5, y1 + 0.5); c.lineTo(x2 + 0.5, y2 + 0.5); c.stroke(); c.restore();
  };
  UT.drawPoly = function (pts, outline, cols, alpha) {
    const c = ctx(); c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul));
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath();
    if (outline) { c.strokeStyle = css(cols); c.lineWidth = 1; c.stroke(); } else { c.fillStyle = css(cols); c.fill(); }
    c.restore();
  };
  UT.drawEllipse = function (x1, y1, x2, y2, outline, col1, col2, alpha) {
    const c = ctx(); c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul));
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    c.beginPath();
    const n = Math.max(4, G.circlePrecision);
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }
    if (outline) { c.strokeStyle = css(col2); c.lineWidth = 1; c.stroke(); }
    else {
      if (col1 !== col2 && rx > 0 && ry > 0) { const gr = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); gr.addColorStop(0, css(col1)); gr.addColorStop(1, css(col2)); c.fillStyle = gr; }
      else c.fillStyle = css(col2);
      c.fill();
    }
    c.restore();
  };

  // ------------------------------------------------------------------ text
  function fontInfo(f) { return UT.D.fonts[f] || UT.D.fonts[1]; }
  function fontLineHeight(fi) {
    if (fi._lh) return fi._lh;
    let h = 0; for (const k in fi.glyphs) h = Math.max(h, fi.glyphs[k][3]);
    fi._lh = h || fi.size; return fi._lh;
  }
  function splitLines(s) {
    s = String(s);
    // GameMaker 1.x: '#' is a line break, '\#' is a literal '#'
    const out = []; let cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\' && s[i + 1] === '#') { cur += '#'; i++; continue; }
      if (ch === '#' || ch === '\n') { out.push(cur); cur = ''; if (ch === '\n' && s[i + 1] === '\r') i++; continue; }
      if (ch === '\r') { if (s[i + 1] === '\n') i++; out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }
  function lineWidth(fi, line) { let w = 0; for (let i = 0; i < line.length; i++) { const g = fi.glyphs[line.charCodeAt(i)]; if (g) w += g[4]; else { const sp = fi.glyphs[32]; w += sp ? sp[4] : 0; } } return w; }
  function wrapLines(fi, s, maxw) {
    const lines = splitLines(s);
    if (!(maxw > 0)) return lines;
    const out = [];
    for (const ln of lines) {
      const words = ln.split(' '); let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (cur && lineWidth(fi, t) > maxw) { out.push(cur); cur = w; } else cur = t;
      }
      out.push(cur);
    }
    return out;
  }
  UT.stringWidth = function (s) { const fi = fontInfo(G.font); return Math.max(0, ...splitLines(s).map(l => lineWidth(fi, l))); };
  UT.stringHeight = function (s) { const fi = fontInfo(G.font); return splitLines(s).length * fontLineHeight(fi); };
  UT.drawText = function (x, y, s, xs, ys, angle, col, alpha, sep, maxw) {
    if (s === undefined || s === null) return;
    if (typeof s === 'number') s = UT.F.string(null, null, s);
    const fi = fontInfo(G.font);
    const img = G.fontImgs[UT.D.fonts.indexOf(fi)];
    if (!imgReady(img)) return;
    const lh = sep > 0 ? sep : fontLineHeight(fi);
    const lines = wrapLines(fi, s, maxw);
    const c = ctx(); c.save();
    c.globalAlpha = Math.max(0, Math.min(1, alpha * G.alphaMul));
    c.translate(x, y); if (angle) c.rotate(-angle * Math.PI / 180); c.scale(xs, ys);
    const timg = tinted(img, col);
    const totalH = lines.length * lh;
    let oy = G.valign === 1 ? -totalH / 2 : G.valign === 2 ? -totalH : 0;
    for (const ln of lines) {
      const w = lineWidth(fi, ln);
      let ox = G.halign === 1 ? -Math.round(w / 2) : G.halign === 2 ? -w : 0;
      for (let i = 0; i < ln.length; i++) {
        const g = fi.glyphs[ln.charCodeAt(i)];
        if (!g) { const sp = fi.glyphs[32]; ox += sp ? sp[4] : 0; continue; }
        if (g[2] > 0 && g[3] > 0) c.drawImage(timg, g[0], g[1], g[2], g[3], ox + g[5], oy, g[2], g[3]);
        ox += g[4];
      }
      oy += lh;
    }
    c.restore();
  };

  // ------------------------------------------------------------------ frame rendering
  function drawBackgroundLayer(i) {
    const b = R.background_index[i]; if (b === undefined || b < 0) return;
    const img = UT.bgImage(b); if (!imgReady(img)) return;
    const info = UT.bgInfo(b);
    const w = (info ? info.w : img.width) * UT.$num(R.background_xscale[i] || 1), h = (info ? info.h : img.height) * UT.$num(R.background_yscale[i] || 1);
    const c = ctx(); c.save(); c.globalAlpha = Math.max(0, Math.min(1, UT.$num(R.background_alpha[i]))) ;
    const col = R.background_blend[i]; const timg = tinted(img, col === undefined ? 16777215 : col);
    let bx = UT.$num(R.background_x[i]), by = UT.$num(R.background_y[i]);
    if (R.background_stretch && R.background_stretch[i]) { c.drawImage(timg, 0, 0, R.roomW, R.roomH); c.restore(); return; }
    const ht = R.background_htiled[i], vt = R.background_vtiled[i];
    // tile over the visible region
    const vx = G.curView ? G.curView[0] : 0, vy = G.curView ? G.curView[1] : 0, vw = G.curView ? G.curView[2] : R.roomW, vh = G.curView ? G.curView[3] : R.roomH;
    let x0 = bx, y0 = by;
    if (ht && w > 0) x0 = bx - Math.ceil((bx - vx) / w) * w;
    if (vt && h > 0) y0 = by - Math.ceil((by - vy) / h) * h;
    for (let yy = y0; vt ? yy < vy + vh : yy === y0; yy += h) {
      for (let xx = x0; ht ? xx < vx + vw : xx === x0; xx += w) {
        c.drawImage(timg, xx, yy, w, h);
        if (!ht) break;
      }
      if (!vt) break;
    }
    c.restore();
  }
  UT.drawBackgroundLayer = drawBackgroundLayer;

  function drawTile(t) {
    const img = UT.bgImage(t.bg); if (!imgReady(img)) return;
    const off = R.tileLayerOffsets.get(t.depth);
    const x = t.x + (off ? off[0] : 0), y = t.y + (off ? off[1] : 0);
    const c = ctx();
    if (t.col !== 4294967295 && (t.col >>> 24) !== 255) c.globalAlpha = ((t.col >>> 24) & 255) / 255;
    const timg = (t.col & 0xFFFFFF) !== 0xFFFFFF ? tinted(img, t.col & 0xFFFFFF) : img;
    c.drawImage(timg, t.xo, t.yo, t.w, t.h, x, y, t.w * t.sx, t.h * t.sy);
    c.globalAlpha = 1;
  }

  function drawScene(view) {
    // background colour, backgrounds, then depth-sorted instances + tiles, then foregrounds
    const c = ctx();
    for (let i = 0; i < 8; i++) if (R.background_visible[i] && !R.background_foreground[i]) drawBackgroundLayer(i);
    const items = [];
    for (const inst of R.instances) if (!inst.$dead && !inst.$deact) items.push(inst);
    items.sort((a, b) => (b.depth - a.depth) || (a.$order - b.$order));
    const tiles = R.tiles;
    // tiles grouped by depth, drawn when passing their depth (tiles at same depth as instances draw first)
    const tileDepths = [...new Set(tiles.map(t => t.depth))].filter(d => !R.hiddenLayers.has(d)).sort((a, b) => b - a);
    let ti = 0;
    const drawTilesDownTo = (d) => {
      while (ti < tileDepths.length && tileDepths[ti] >= d) {
        const dep = tileDepths[ti++];
        for (const t of tiles) if (t.depth === dep && t.visible !== false) drawTile(t);
      }
    };
    for (const inst of items) {
      drawTilesDownTo(inst.depth);
      if (inst.$dead) continue;
      const ev = UT.findEvent(inst.object_index, 'Draw_0');
      if (ev) { if (inst.visible) { UT.runEvent(inst, 'Draw_0'); } }
      else if (inst.visible && inst._spr >= 0) UT.drawSpriteExt(inst._spr, inst.image_index, inst.x, inst.y, inst.image_xscale, inst.image_yscale, inst.image_angle, inst.image_blend, inst.image_alpha);
    }
    drawTilesDownTo(-Infinity);
    for (let i = 0; i < 8; i++) if (R.background_visible[i] && R.background_foreground[i]) drawBackgroundLayer(i);
  }

  UT.drawFrame = function () {
    const c = G.ctx;
    G.target = null; G.alphaMul = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = '#000'; c.fillRect(0, 0, G.W, G.H);
    const views = [];
    if (R.view_enabled) for (let v = 0; v < 8; v++) if (R.view_visible[v]) views.push(v);
    if (!views.length) {
      // no visible view: GameMaker sizes the application surface to the room and scales it to the window
      R.view_current = 0; G.curView = [0, 0, R.roomW, R.roomH];
      const sc = Math.min(G.W / R.roomW, G.H / R.roomH), ox = (G.W - R.roomW * sc) / 2, oy = (G.H - R.roomH * sc) / 2;
      c.save(); c.beginPath(); c.rect(ox, oy, R.roomW * sc, R.roomH * sc); c.clip();
      if (R.background_showcolor) { c.fillStyle = css(R.background_color); c.fillRect(ox, oy, R.roomW * sc, R.roomH * sc); }
      c.setTransform(sc, 0, 0, sc, ox, oy);
      G.viewTransform = [sc, sc, ox, oy];
      drawScene(null);
      c.restore();
    } else {
      // a view can be switched on by a Draw event of an earlier view in the same frame (GameMaker checks each view
      // as it gets to it), so visibility is re-read here
      for (let v = 0; v < 8; v++) {
        if (!R.view_visible[v]) continue;
        R.view_current = v;
        const vx = UT.$num(R.view_xview[v]), vy = UT.$num(R.view_yview[v]), vw = UT.$num(R.view_wview[v]), vh = UT.$num(R.view_hview[v]);
        const px = R.view_xport[v], py = R.view_yport[v], pw = R.view_wport[v], ph = R.view_hport[v];
        const sx = pw / vw, sy = ph / vh;
        G.curView = [vx, vy, vw, vh];
        c.save();
        c.beginPath(); c.rect(px, py, pw, ph); c.clip();
        if (R.background_showcolor) { c.fillStyle = css(R.background_color); c.fillRect(px, py, pw, ph); }
        c.setTransform(sx, 0, 0, sy, px - vx * sx, py - vy * sy);
        G.viewTransform = [sx, sy, px - vx * sx, py - vy * sy];
        const ang = UT.$num(R.view_angle[v]);
        if (ang) {
          // view_angle turns the view around its centre
          c.setTransform(1, 0, 0, 1, px + pw / 2, py + ph / 2);
          c.rotate(ang * Math.PI / 180);
          c.scale(sx, sy);
          c.translate(-(vx + vw / 2), -(vy + vh / 2));
        }
        drawScene(v);
        c.restore();
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  };

  // ------------------------------------------------------------------ asset loading
  // frames were exported trimmed; put each back on a canvas of the sprite's full size at its original offset
  function placeFrame(info, k, img) {
    if (!info.offs || !img.naturalWidth) return img;
    const o = info.offs[k] || [0, 0];
    const c = document.createElement('canvas'); c.width = Math.max(1, info.w); c.height = Math.max(1, info.h);
    c.getContext('2d').drawImage(img, o[0], o[1]);
    return c;
  }
  UT.loadAssets = function (base, onProgress) {
    const D = UT.D;
    const jobs = [];
    // Slow machines and file:// pages can drop image loads when too many run at once, so the number in flight is
    // limited (?par=N to change it, default 16) and a failed image is retried a few times before giving up.
    const qpar = parseInt(new URLSearchParams(location.search).get('par'), 10);
    const PAR = qpar > 0 ? qpar : 16;
    const once = (url) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(img);
      img.src = base + url;
    });
    const load = async (url) => {
      let img = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt) await new Promise(r => setTimeout(r, 150 * attempt));
        img = await once(url);
        if (img.naturalWidth) return img;
      }
      console.warn('missing image', url);
      return img;
    };
    let done = 0, total = 0;
    D.sprites.forEach((s, i) => { G.spriteImgs[i] = []; s.frames.forEach((f, k) => { total++; jobs.push(['s', i, k, 'sprites/' + f]); }); });
    D.backgrounds.forEach((b, i) => { total++; jobs.push(['b', i, 0, b.file]); });
    D.fonts.forEach((f, i) => { total++; jobs.push(['f', i, 0, f.file]); });
    let failures = 0;
    return new Promise((resolve) => {
      let next = 0; let active = 0;
      const pump = () => {
        while (active < PAR && next < jobs.length) {
          const [t, i, k, url] = jobs[next++]; active++;
          load(url).then((img) => {
            if (!img.naturalWidth) failures++;
            if (t === 's') G.spriteImgs[i][k] = placeFrame(D.sprites[i], k, img); else if (t === 'b') G.bgImgs[i] = placeFrame(D.backgrounds[i], 0, img); else G.fontImgs[i] = img;
            active--; done++;
            if (onProgress && (done % 50 === 0 || done === total)) onProgress(done, total);
            if (done === total) resolve(failures); else pump();
          });
        }
      };
      pump();
    });
  };
})();
