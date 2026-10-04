// Undertale web port - path following (path_start / path_end)
'use strict';
(function () {
  const UT = window.UT;
  function pathData(p) { return UT.D.paths[p] || null; }
  function prepare(pd) {
    if (pd._seg) return pd;
    const pts = pd.points.map(q => [q[0], q[1], q[2] === undefined ? 100 : q[2]]);
    if (pd.closed && pts.length > 1) pts.push(pts[0]);
    const seg = []; let len = 0;
    for (let i = 0; i + 1 < pts.length; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); len += d; }
    pd._pts = pts; pd._seg = seg; pd._len = len;
    return pd;
  }
  function pointAt(pd, t) {
    const pts = pd._pts;
    if (!pts.length) return [0, 0, 100];
    if (pts.length === 1 || pd._len === 0) return pts[0];
    let d = Math.max(0, Math.min(1, t)) * pd._len;
    for (let i = 0; i < pd._seg.length; i++) {
      if (d <= pd._seg[i] || i === pd._seg.length - 1) {
        const k = pd._seg[i] ? Math.min(1, d / pd._seg[i]) : 0; const a = pts[i], b = pts[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      }
      d -= pd._seg[i];
    }
    return pts[pts.length - 1];
  }
  UT.pathStart = function (inst, p, speed, endaction, absolute) {
    const pd = pathData(p);
    if (!pd || !pd.points || !pd.points.length) {
      // path data is missing from the decompiled project: end immediately so scripted scenes can continue
      inst.path_index = -1; UT.reportError('path_start', new Error('no data for path ' + (pd ? pd.name : p)));
      UT.runEvent(inst, 'Other_8');
      return;
    }
    prepare(pd);
    inst.path_index = p; inst.path_speed = speed; inst.path_endaction = endaction; inst.path_position = speed < 0 ? 1 : 0; inst.path_positionprevious = inst.path_position;
    inst._pathAbs = absolute;
    const p0 = pointAt(pd, inst.path_position);
    inst._pathX = absolute ? 0 : inst.x - p0[0]; inst._pathY = absolute ? 0 : inst.y - p0[1];
    inst.speed = 0;
    if (absolute) { inst.x = p0[0]; inst.y = p0[1]; }
  };
  UT.pathStep = function (inst) {
    const pd = pathData(inst.path_index); if (!pd || !pd._pts) { inst.path_index = -1; return; }
    const cur = pointAt(pd, inst.path_position);
    const spd = inst.path_speed * cur[2] / 100 * inst.path_scale;
    inst.path_positionprevious = inst.path_position;
    if (spd === 0) return; // a paused path leaves the instance where the code put it
    inst.path_position += pd._len > 0 ? spd / pd._len : 1;
    let ended = false;
    // only the end the path is travelling towards counts (a paused path sitting at 0 has not ended)
    if ((spd > 0 && inst.path_position >= 1) || (spd < 0 && inst.path_position <= 0)) {
      const over = inst.path_position;
      switch (inst.path_endaction) {
        case 1: inst.path_position = over >= 1 ? over - 1 : over + 1; break;
        case 2: { const a = pointAt(pd, 0), b = pointAt(pd, 1); inst._pathX += b[0] - a[0]; inst._pathY += b[1] - a[1]; inst.path_position = over >= 1 ? over - 1 : over + 1; break; }
        case 3: inst.path_speed = -inst.path_speed; inst.path_position = Math.max(0, Math.min(1, over)); break;
        default: inst.path_position = Math.max(0, Math.min(1, over)); ended = true;
      }
    }
    const p = pointAt(pd, inst.path_position);
    const nx = p[0] + inst._pathX, ny = p[1] + inst._pathY;
    if (nx !== inst.x || ny !== inst.y) { const d = Math.atan2(-(ny - inst.y), nx - inst.x) * 180 / Math.PI; inst._dir = d < 0 ? d + 360 : d; }
    inst.x = nx; inst.y = ny;
    if (ended) { inst.path_index = -1; UT.runEvent(inst, 'Other_8'); }
  };
})();
