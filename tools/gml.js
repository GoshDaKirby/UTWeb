// GML (GameMaker Studio 1.4) -> JavaScript translator.
// Handles the subset of GML produced by the Undertale decompilation, plus loose hand-written GML.
'use strict';

// ---------------------------------------------------------------- lexer
const PUNCT = ['<<=', '>>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '^^',
  '++', '--', '<<', '>>', '<>', ':=',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '(', ')', '[', ']', '{', '}', ',', ';', '.', ':', '?', '@'];

function lex(src) {
  const toks = [];
  let i = 0; const n = src.length; let line = 1;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const seg = src.slice(i, e < 0 ? n : e + 2); line += (seg.match(/\n/g) || []).length; i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1; let s = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < n) {
          const d = src[j + 1];
          if (d === '\\' || d === '"' || d === "'") { s += d; j += 2; continue; }
          s += '\\'; j += 1; continue;
        }
        if (src[j] === '\n') line++;
        s += src[j]; j++;
      }
      toks.push({ t: 'str', v: s, line }); i = j + 1; continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      let j = i; while (j < n && /[0-9.]/.test(src[j])) j++;
      if ((src[j] === 'e' || src[j] === 'E') && /[0-9+-]/.test(src[j + 1] || '')) { j += 2; while (j < n && /[0-9]/.test(src[j])) j++; }
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)), line }); i = j; continue;
    }
    if (c === '$' && /[0-9a-fA-F]/.test(src[i + 1] || '')) {
      let j = i + 1; while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
      toks.push({ t: 'num', v: parseInt(src.slice(i + 1, j), 16), line }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      toks.push({ t: 'id', v: w, line }); i = j; continue;
    }
    let p = null;
    for (const q of PUNCT) if (src.startsWith(q, i)) { p = q; break; }
    if (!p) { i++; continue; } // skip junk char
    toks.push({ t: 'p', v: p, line }); i += p.length;
  }
  toks.push({ t: 'eof', v: '', line });
  return toks;
}

// ---------------------------------------------------------------- parser
const KW = new Set(['if', 'else', 'while', 'repeat', 'with', 'switch', 'case', 'default', 'break', 'continue', 'exit', 'return', 'var', 'globalvar', 'do', 'until', 'for', 'then', 'begin', 'end']);

class Parser {
  constructor(toks) { this.toks = toks; this.i = 0; }
  peek(o = 0) { return this.toks[this.i + o]; }
  next() { return this.toks[this.i++]; }
  isP(v) { const t = this.peek(); return t.t === 'p' && t.v === v; }
  isId(v) { const t = this.peek(); return t.t === 'id' && t.v === v; }
  eatP(v) { if (this.isP(v)) { this.i++; return true; } return false; }
  expectP(v) { if (!this.eatP(v)) throw new Error('Expected ' + v + ' got ' + JSON.stringify(this.peek()) + ' at line ' + this.peek().line); }
  program() { const body = []; while (this.peek().t !== 'eof') { const s = this.statement(); if (s) body.push(s); } return { type: 'Block', body }; }
  block() {
    if (this.eatP('{') || this.isId('begin') && this.next()) {
      const body = [];
      while (!this.isP('}') && !this.isId('end') && this.peek().t !== 'eof') { const s = this.statement(); if (s) body.push(s); }
      this.next();
      return { type: 'Block', body };
    }
    return null;
  }
  statement() {
    const t = this.peek();
    if (t.t === 'p' && t.v === ';') { this.i++; return null; }
    if (t.t === 'p' && t.v === '{') return this.block();
    if (t.t === 'id') {
      switch (t.v) {
        case 'begin': return this.block();
        case 'if': {
          this.i++; const cond = this.expr(); this.eatP(';'); if (this.isId('then')) this.i++;
          const cons = this.statement(); this.eatP(';');
          let alt = null; if (this.isId('else')) { this.i++; alt = this.statement(); }
          return { type: 'If', cond, cons, alt };
        }
        case 'while': { this.i++; const cond = this.expr(); if (this.isId('do')) this.i++; const body = this.statement(); return { type: 'While', cond, body }; }
        case 'do': { this.i++; const body = this.statement(); this.eatP(';'); if (!this.isId('until')) throw new Error('until expected'); this.i++; const cond = this.expr(); this.eatP(';'); return { type: 'DoUntil', cond, body }; }
        case 'for': {
          this.i++; this.expectP('(');
          const init = this.isP(';') ? null : this.simpleStatement(); this.eatP(';');
          const cond = this.isP(';') ? null : this.expr(); this.eatP(';');
          const step = this.isP(')') ? null : this.simpleStatement(); this.expectP(')');
          const body = this.statement();
          return { type: 'For', init, cond, step, body };
        }
        case 'repeat': { this.i++; const count = this.expr(); const body = this.statement(); return { type: 'Repeat', count, body }; }
        case 'with': { this.i++; const target = this.expr(); if (this.isId('do')) this.i++; const body = this.statement(); return { type: 'With', target, body }; }
        case 'switch': {
          this.i++; const disc = this.expr(); this.expectP('{');
          const cases = []; let cur = null;
          while (!this.isP('}') && this.peek().t !== 'eof') {
            if (this.isId('case')) { this.i++; const test = this.expr(); if (!this.eatP(':')) this.eatP(';'); cur = { test, body: [] }; cases.push(cur); continue; }
            if (this.isId('default')) { this.i++; this.eatP(':'); cur = { test: null, body: [] }; cases.push(cur); continue; }
            const s = this.statement(); if (s) { if (!cur) { cur = { test: undefined, body: [] }; cases.push(cur); } cur.body.push(s); }
          }
          this.expectP('}');
          return { type: 'Switch', disc, cases };
        }
        case 'break': this.i++; this.eatP(';'); return { type: 'Break' };
        case 'continue': this.i++; this.eatP(';'); return { type: 'Continue' };
        case 'exit': this.i++; this.eatP(';'); return { type: 'Exit' };
        case 'return': {
          this.i++;
          if (this.isP(';') || this.isP('}')) { this.eatP(';'); return { type: 'Return', arg: null }; }
          const arg = this.expr(); this.eatP(';'); return { type: 'Return', arg };
        }
        case 'var': case 'globalvar': {
          const g = t.v === 'globalvar'; this.i++;
          const decls = [];
          do {
            const name = this.next().v; let init = null;
            if (this.eatP('=') || this.eatP(':=')) init = this.expr();
            decls.push({ name, init });
          } while (this.eatP(','));
          this.eatP(';');
          return { type: g ? 'GlobalVar' : 'Var', decls };
        }
      }
    }
    const s = this.simpleStatement(); this.eatP(';'); return s;
  }
  simpleStatement() {
    // assignment, inc/dec, or expression (call)
    if (this.isP('++') || this.isP('--')) { const op = this.next().v; const target = this.postfix(); return { type: 'IncDec', op, target }; }
    const target = this.postfix();
    const t = this.peek();
    if (t.t === 'p' && ['=', ':=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='].includes(t.v)) {
      this.i++; const value = this.expr();
      return { type: 'Assign', op: t.v === ':=' ? '=' : t.v, target, value };
    }
    if (t.t === 'p' && (t.v === '++' || t.v === '--')) { this.i++; return { type: 'IncDec', op: t.v, target }; }
    return { type: 'ExprStmt', expr: target };
  }
  // precedence climbing
  expr() { return this.ternary(); }
  ternary() {
    const c = this.or();
    if (this.eatP('?')) { const a = this.expr(); this.expectP(':'); const b = this.expr(); return { type: 'Cond', c, a, b }; }
    return c;
  }
  or() { let l = this.xor(); while (this.isP('||') || this.isId('or')) { this.next(); l = { type: 'Logic', op: '||', l, r: this.xor() }; } return l; }
  xor() { let l = this.and(); while (this.isP('^^') || this.isId('xor')) { this.next(); l = { type: 'Logic', op: '^^', l, r: this.and() }; } return l; }
  and() { let l = this.cmp(); while (this.isP('&&') || this.isId('and')) { this.next(); l = { type: 'Logic', op: '&&', l, r: this.cmp() }; } return l; }
  cmp() {
    let l = this.bitor();
    for (;;) {
      const t = this.peek();
      if (t.t === 'p' && ['==', '!=', '<', '>', '<=', '>=', '=', '<>'].includes(t.v)) {
        this.i++; let op = t.v; if (op === '=') op = '=='; if (op === '<>') op = '!=';
        l = { type: 'Cmp', op, l, r: this.bitor() };
      } else break;
    }
    return l;
  }
  bitor() { let l = this.bitxor(); while (this.isP('|')) { this.next(); l = { type: 'Bin', op: '|', l, r: this.bitxor() }; } return l; }
  bitxor() { let l = this.bitand(); while (this.isP('^')) { this.next(); l = { type: 'Bin', op: '^', l, r: this.bitand() }; } return l; }
  bitand() { let l = this.shift(); while (this.isP('&')) { this.next(); l = { type: 'Bin', op: '&', l, r: this.shift() }; } return l; }
  shift() { let l = this.add(); while (this.isP('<<') || this.isP('>>')) { const op = this.next().v; l = { type: 'Bin', op, l, r: this.add() }; } return l; }
  add() { let l = this.mul(); while (this.isP('+') || this.isP('-')) { const op = this.next().v; l = { type: 'Bin', op, l, r: this.mul() }; } return l; }
  mul() {
    let l = this.unary();
    for (;;) {
      if (this.isP('*') || this.isP('/') || this.isP('%')) { const op = this.next().v; l = { type: 'Bin', op, l, r: this.unary() }; }
      else if (this.isId('div')) { this.next(); l = { type: 'Bin', op: 'div', l, r: this.unary() }; }
      else if (this.isId('mod')) { this.next(); l = { type: 'Bin', op: '%', l, r: this.unary() }; }
      else break;
    }
    return l;
  }
  unary() {
    if (this.isP('!') || this.isId('not')) { this.next(); return { type: 'Not', arg: this.unary() }; }
    if (this.isP('-')) { this.next(); return { type: 'Neg', arg: this.unary() }; }
    if (this.isP('+')) { this.next(); return this.unary(); }
    if (this.isP('~')) { this.next(); return { type: 'BitNot', arg: this.unary() }; }
    if (this.isP('++') || this.isP('--')) { const op = this.next().v; const target = this.postfix(); return { type: 'PreIncExpr', op, target }; }
    return this.postfix();
  }
  postfix() {
    let e = this.primary();
    for (;;) {
      if (this.isP('.')) {
        this.next(); const name = this.next();
        if (name.t !== 'id') throw new Error('bad member at line ' + name.line);
        e = { type: 'Dot', obj: e, name: name.v };
      } else if (this.isP('[')) {
        this.next(); if (this.isP('@')) this.next();
        const idx = [this.expr()]; while (this.eatP(',')) idx.push(this.expr());
        this.expectP(']'); e = { type: 'Index', base: e, idx };
      } else break;
    }
    return e;
  }
  primary() {
    const t = this.next();
    if (t.t === 'num') return { type: 'Num', v: t.v };
    if (t.t === 'str') return { type: 'Str', v: t.v };
    if (t.t === 'p' && t.v === '(') { const e = this.expr(); this.expectP(')'); return e; }
    if (t.t === 'id') {
      if (this.isP('(')) {
        this.next(); const args = [];
        if (!this.isP(')')) { do { args.push(this.expr()); } while (this.eatP(',')); }
        this.expectP(')');
        return { type: 'Call', name: t.v, args };
      }
      return { type: 'Ident', name: t.v };
    }
    throw new Error('Unexpected token ' + JSON.stringify(t));
  }
}

// ---------------------------------------------------------------- code generation
const INST_VARS = new Set(('x y xprevious yprevious xstart ystart hspeed vspeed direction speed friction gravity gravity_direction ' +
  'path_index path_position path_positionprevious path_speed path_scale path_orientation path_endaction ' +
  'object_index id solid persistent mask_index visible sprite_index sprite_width sprite_height sprite_xoffset sprite_yoffset ' +
  'image_number image_index image_speed depth image_xscale image_yscale image_angle image_alpha image_blend ' +
  'bbox_left bbox_right bbox_top bbox_bottom timeline_index timeline_position timeline_speed timeline_running timeline_loop').split(' '));
const INST_ARRAYS = new Set(['alarm']);
const GLOBAL_VARS = new Set(('room room_first room_last room_width room_height room_caption room_speed room_persistent ' +
  'score lives health show_score show_lives show_health caption_score caption_lives caption_health ' +
  'keyboard_key keyboard_lastkey keyboard_lastchar keyboard_string mouse_x mouse_y mouse_button mouse_lastbutton ' +
  'view_enabled view_current background_color background_showcolor ' +
  'current_time current_year current_month current_day current_weekday current_hour current_minute current_second ' +
  'fps fps_real os_type os_device os_browser os_version working_directory program_directory temp_directory game_id ' +
  'application_surface instance_count debug_mode delta_time cursor_sprite transition_kind event_type event_number event_object secure_mode').split(' '));
const GLOBAL_ARRAYS = new Set(('view_visible view_xview view_yview view_wview view_hview view_xport view_yport view_wport view_hport view_angle ' +
  'view_hborder view_vborder view_hspeed view_vspeed view_object view_surface_id ' +
  'background_visible background_foreground background_index background_x background_y background_width background_height ' +
  'background_htiled background_vtiled background_xscale background_yscale background_hspeed background_vspeed background_blend background_alpha').split(' '));
const CONSTANTS = {
  true: 1, false: 0, pi: Math.PI, noone: -4, all: -3, self: -1, other: -2, global: -5,
  c_aqua: 16776960, c_black: 0, c_blue: 16711680, c_dkgray: 4210752, c_fuchsia: 16711935, c_gray: 8421504, c_green: 32768,
  c_lime: 65280, c_ltgray: 12632256, c_maroon: 128, c_navy: 8388608, c_olive: 32896, c_orange: 4235519, c_purple: 8388736,
  c_red: 255, c_silver: 12632256, c_teal: 8421376, c_white: 16777215, c_yellow: 65535,
  fa_left: 0, fa_center: 1, fa_right: 2, fa_top: 0, fa_middle: 1, fa_bottom: 2,
  bm_normal: 0, bm_add: 1, bm_max: 2, bm_subtract: 3,
  vk_nokey: 0, vk_anykey: 1, vk_enter: 13, vk_return: 13, vk_shift: 16, vk_control: 17, vk_alt: 18, vk_escape: 27, vk_space: 32,
  vk_left: 37, vk_up: 38, vk_right: 39, vk_down: 40, vk_backspace: 8, vk_tab: 9, vk_f1: 112, vk_f4: 115,
  os_windows: 0, os_macosx: 1, os_linux: 6,
  path_action_stop: 0, path_action_restart: 1, path_action_continue: 2, path_action_reverse: 3,
  room0: 0, sprite0: 0,
};

class Codegen {
  constructor(ctx) {
    this.ctx = ctx; // {res:{name->index}, scripts:Set, builtins:Set, objName, eventKey, isScript, fixups}
    this.tmp = 0; this.locals = new Set();
    this.unknownFns = ctx.unknownFns || new Set();
  }
  t() { return '_t' + (this.tmp++); }
  // ---- statements
  stmt(s, ind) {
    if (!s) return '';
    const I = '  '.repeat(ind);
    switch (s.type) {
      case 'Block': return I + '{\n' + s.body.map(b => this.stmt(b, ind + 1)).join('') + I + '}\n';
      case 'ExprStmt': return I + this.expr(s.expr) + ';\n';
      case 'Assign': return I + this.assign(s.target, s.op, s.value) + ';\n';
      case 'IncDec': return I + this.assign(s.target, s.op === '++' ? '+=' : '-=', { type: 'Num', v: 1 }) + ';\n';
      case 'If': {
        let r = I + 'if ($t(' + this.expr(s.cond) + '))\n' + this.asBlock(s.cons, ind);
        if (s.alt) r += I + 'else\n' + this.asBlock(s.alt, ind);
        return r;
      }
      case 'While': return I + 'while ($t(' + this.expr(s.cond) + '))\n' + this.loopBody(s.body, ind);
      case 'DoUntil': return I + 'do\n' + this.loopBody(s.body, ind) + I + 'while (!$t(' + this.expr(s.cond) + '));\n';
      case 'For': {
        const init = s.init ? this.simple(s.init) : '';
        const step = s.step ? this.simple(s.step) : '';
        return I + 'for (' + init + '; ' + (s.cond ? '$t(' + this.expr(s.cond) + ')' : '') + '; ' + step + ')\n' + this.loopBody(s.body, ind);
      }
      case 'Repeat': { const v = this.t(); return I + 'for (let ' + v + ' = $num(' + this.expr(s.count) + '); ' + v + ' > 0.5; ' + v + '--)\n' + this.loopBody(s.body, ind); }
      case 'With': {
        const o = this.t(), it = this.t();
        return I + '{ const ' + o + ' = self;\n' + I + 'for (const ' + it + ' of $withList(' + this.expr(s.target) + ', self, other)) {\n' +
          I + '  if (' + it + '.$dead) continue;\n' + I + '  const self = ' + it + ', other = ' + o + ';\n' +
          this.stmt(s.body, ind + 1) + I + '} }\n';
      }
      case 'Switch': {
        // The decompiler printed the case labels of every switch in reverse order relative to the bodies.
        const labeled = s.cases.filter(c => c.test !== null && c.test !== undefined);
        if (this.ctx.switchMode && labeled.length > 1 && labeled.every(c => c.test.type === 'Num')) {
          const rev = labeled.map(c => c.test).reverse();
          const fixed = this.ctx.switchMode === 'rot' ? rev.slice(1).concat([rev[0]]) : rev;
          labeled.forEach((c, k) => { c.test = fixed[k]; });
        }
        let r = I + 'switch ($swv(' + this.expr(s.disc) + ')) {\n';
        for (const c of s.cases) {
          if (c.test === undefined) { r += c.body.map(b => this.stmt(b, ind + 1)).join(''); continue; }
          r += I + (c.test === null ? 'default:\n' : 'case ' + this.caseLabel(c.test) + ':\n');
          r += c.body.map(b => this.stmt(b, ind + 1)).join('');
        }
        return r + I + '}\n';
      }
      case 'Break': return I + 'break;\n';
      case 'Continue': return I + 'continue;\n';
      case 'Exit': return I + (this.ctx.isScript ? 'return 0;\n' : 'return;\n');
      case 'Return': return I + 'return ' + (s.arg ? this.expr(s.arg) : '0') + ';\n';
      case 'Var': {
        let r = '';
        for (const d of s.decls) { this.locals.add(d.name); r += I + this.localName(d.name) + ' = ' + (d.init ? this.expr(d.init) : '0') + ';\n'; }
        return r;
      }
      case 'GlobalVar': {
        let r = ''; for (const d of s.decls) { (this.ctx.globalvars || (this.ctx.globalvars = new Set())).add(d.name); if (d.init) r += I + 'GL.' + d.name + ' = ' + this.expr(d.init) + ';\n'; }
        return r;
      }
    }
    throw new Error('stmt ' + s.type);
  }
  simple(s) {
    if (s.type === 'Assign') return this.assign(s.target, s.op, s.value);
    if (s.type === 'IncDec') return this.assign(s.target, s.op === '++' ? '+=' : '-=', { type: 'Num', v: 1 });
    if (s.type === 'ExprStmt') return this.expr(s.expr);
    if (s.type === 'Var') { return s.decls.map(d => { this.locals.add(d.name); return this.localName(d.name) + ' = ' + (d.init ? this.expr(d.init) : '0'); }).join(', '); }
    throw new Error('simple ' + s.type);
  }
  asBlock(s, ind) { if (s && s.type === 'Block') return this.stmt(s, ind); return this.stmt(s, ind + 1) || '  '.repeat(ind + 1) + ';\n'; }
  loopBody(s, ind) { return this.asBlock(s, ind); }
  caseLabel(e) {
    if (e.type === 'Num') return String(e.v);
    if (e.type === 'Str') return JSON.stringify(e.v);
    if (e.type === 'Neg' && e.arg.type === 'Num') return String(-e.arg.v);
    return '$swv(' + this.expr(e) + ')';
  }
  localName(n) { return '$L' + this.prop(n); }
  // ---- lvalues
  assign(target, op, valueNode) {
    const bop = op === '=' ? null : op.slice(0, -1);
    const val = this.expr(valueNode);
    const combine = (cur) => bop ? this.binop(bop, cur, val) : val;
    switch (target.type) {
      case 'Ident': {
        const n = target.name;
        if (this.locals.has(n)) return this.localName(n) + ' = ' + combine(this.localName(n));
        const acc = this.identAccess(n, true);
        return acc + ' = ' + combine(acc);
      }
      case 'Index': {
        const tb = target.base;
        if (!this._forceHolder && tb.type === 'Dot' && !(tb.obj.type === 'Ident' && (tb.obj.name === 'global' || tb.obj.name === 'self' || tb.obj.name === 'other'))) {
          // GameMaker: obj.arr[i] = v writes to every instance of obj
          const oe = this.expr(tb.obj); const tv = this.t();
          this._forceHolder = tv; this._forceBase = tb;
          const inner = this.assign(target, op, valueNode);
          this._forceHolder = null; this._forceBase = null;
          return '$withList(' + oe + ', self, other).forEach((' + tv + ') => { ' + inner + '; })';
        }
        const { holder, name, special } = this.indexBase(target.base);
        const idx = target.idx.map(e => this.expr(e));
        if (special) {
          const a = special + '[$ix(' + idx[0] + ')]';
          return a + ' = ' + combine(a);
        }
        if (idx.length === 1) {
          if (!bop) return '$aw(' + holder + ', ' + JSON.stringify(name) + ', ' + idx[0] + ', ' + val + ')';
          const iv = this.t();
          return '((' + iv + ') => $aw(' + holder + ', ' + JSON.stringify(name) + ', ' + iv + ', ' + this.binop(bop, '$ar(' + holder + '[' + JSON.stringify(name) + '], ' + iv + ')', val) + '))(' + idx[0] + ')';
        }
        if (!bop) return '$aw2(' + holder + ', ' + JSON.stringify(name) + ', ' + idx[0] + ', ' + idx[1] + ', ' + val + ')';
        return '$aw2(' + holder + ', ' + JSON.stringify(name) + ', ' + idx[0] + ', ' + idx[1] + ', ' + this.binop(bop, '$ar2(' + holder + '[' + JSON.stringify(name) + '], ' + idx[0] + ', ' + idx[1] + ')', val) + ')';
      }
      case 'Dot': {
        const o = target.obj;
        if (o.type === 'Ident' && (o.name === 'global')) { const a = 'GL.' + target.name; return a + ' = ' + combine(a); }
        if (o.type === 'Ident' && o.name === 'self') { const a = this.selfProp(target.name); return a + ' = ' + combine(a); }
        if (o.type === 'Ident' && o.name === 'other') { const a = 'other' + this.prop(target.name); return a + ' = ' + combine(a); }
        const tv = this.expr(o);
        if (!bop) return '$wr(' + tv + ', ' + JSON.stringify(target.name) + ', ' + val + ', self, other)';
        return '$wrop(' + tv + ', ' + JSON.stringify(target.name) + ', (_c) => ' + this.binop(bop, '_c', val) + ', self, other)';
      }
    }
    throw new Error('bad assignment target ' + target.type);
  }
  prop(name) { return /^[A-Za-z_$][\w$]*$/.test(name) ? '.' + name : '[' + JSON.stringify(name) + ']'; }
  selfProp(name) { return 'self' + this.prop(name); }
  // returns {holder, name} for array base, or {special: 'expr'} for builtin arrays
  indexBase(base) {
    if (base.type === 'Ident') {
      const n = base.name;
      if (INST_ARRAYS.has(n)) return { special: 'self.' + n };
      if (GLOBAL_ARRAYS.has(n)) return { special: 'R.' + n };
      if (n === 'argument') return { special: '$a' };
      if (this.locals.has(n)) return { holder: '$L', name: n, local: true };
      if (this.ctx.globalvars && this.ctx.globalvars.has(n)) return { holder: 'GL', name: n };
      return { holder: 'self', name: n };
    }
    if (base.type === 'Dot') {
      const o = base.obj;
      if (o.type === 'Ident' && o.name === 'global') return { holder: 'GL', name: base.name };
      if (o.type === 'Ident' && o.name === 'self') return { holder: 'self', name: base.name };
      if (o.type === 'Ident' && o.name === 'other') return { holder: 'other', name: base.name };
      const hv = (this._forceHolder && base === this._forceBase) ? this._forceHolder : ('$inst(' + this.expr(o) + ', self, other)');
      if (INST_ARRAYS.has(base.name)) return { special: hv + '.' + base.name };
      return { holder: hv, name: base.name };
    }
    throw new Error('bad index base ' + base.type);
  }
  identAccess(n, forWrite) {
    if (this.locals.has(n)) return this.localName(n);
    const m = /^argument(\d+)$/.exec(n);
    if (m) return '$a[' + m[1] + ']';
    if (n === 'argument_count') return '$a.length';
    if (INST_VARS.has(n)) return 'self.' + n;
    if (GLOBAL_VARS.has(n)) return 'R.' + n;
    if (this.ctx.globalvars && this.ctx.globalvars.has(n)) return 'GL.' + n;
    if (!forWrite) {
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, n)) return String(CONSTANTS[n]);
      if (this.ctx.res.has(n)) return String(this.ctx.res.get(n));
    }
    return 'self' + this.prop(n);
  }
  // ---- expressions
  binop(op, a, b) {
    switch (op) {
      case '+': return '(' + a + ' + ' + b + ')';
      case '-': return '(' + a + ' - ' + b + ')';
      case '*': return '(' + a + ' * ' + b + ')';
      case '/': return '(' + a + ' / ' + b + ')';
      case '%': return '$mod(' + a + ', ' + b + ')';
      case 'div': return '$div(' + a + ', ' + b + ')';
      case '|': return '(' + a + ' | ' + b + ')';
      case '&': return '(' + a + ' & ' + b + ')';
      case '^': return '(' + a + ' ^ ' + b + ')';
      case '<<': return '(' + a + ' << ' + b + ')';
      case '>>': return '(' + a + ' >> ' + b + ')';
    }
    throw new Error('binop ' + op);
  }
  expr(e) {
    switch (e.type) {
      case 'Num': return e.v < 0 ? '(' + e.v + ')' : String(e.v);
      case 'Str': return JSON.stringify(e.v);
      case 'Ident': return this.identAccess(e.name, false);
      case 'Bin': return this.binop(e.op, this.expr(e.l), this.expr(e.r));
      case 'Cmp': {
        const a = this.expr(e.l), b = this.expr(e.r);
        switch (e.op) {
          case '==': return '$eq(' + a + ', ' + b + ')';
          case '!=': return '!$eq(' + a + ', ' + b + ')';
          default: return '(' + a + ' ' + e.op + ' ' + b + ')';
        }
      }
      case 'Logic':
        if (e.op === '^^') return '($t(' + this.expr(e.l) + ') !== $t(' + this.expr(e.r) + '))';
        return '($t(' + this.expr(e.l) + ') ' + e.op + ' $t(' + this.expr(e.r) + '))';
      case 'Not': return '!$t(' + this.expr(e.arg) + ')';
      case 'Neg': return '(-' + this.expr(e.arg) + ')';
      case 'BitNot': return '(~' + this.expr(e.arg) + ')';
      case 'Cond': return '($t(' + this.expr(e.c) + ') ? ' + this.expr(e.a) + ' : ' + this.expr(e.b) + ')';
      case 'PreIncExpr': { return '(' + this.assign(e.target, e.op === '++' ? '+=' : '-=', { type: 'Num', v: 1 }) + ')'; }
      case 'Index': {
        const b = this.indexBase(e.base);
        const idx = e.idx.map(x => this.expr(x));
        if (b.special) return '$ar(' + b.special + ', ' + idx[0] + ')';
        const arr = b.holder + this.prop(b.name);
        if (idx.length === 1) return '$ar(' + arr + ', ' + idx[0] + ')';
        return '$ar2(' + arr + ', ' + idx[0] + ', ' + idx[1] + ')';
      }
      case 'Dot': {
        const o = e.obj;
        if (o.type === 'Ident' && o.name === 'global') return 'GL' + this.prop(e.name);
        if (o.type === 'Ident' && o.name === 'self') return this.selfProp(e.name);
        if (o.type === 'Ident' && o.name === 'other') return 'other' + this.prop(e.name);
        return '$rd(' + this.expr(o) + ', ' + JSON.stringify(e.name) + ', self, other)';
      }
      case 'Call': return this.call(e);
    }
    throw new Error('expr ' + e.type);
  }
  call(e) {
    const n = e.name;
    const args = e.args.map(a => this.expr(a));
    if (n === 'event_inherited') return '$inherited(self, other, ' + JSON.stringify(this.ctx.objName || '') + ', ' + JSON.stringify(this.ctx.eventKey || '') + ')';
    if (this.ctx.scripts.has(n)) return 'S.' + n + '(self, other, [' + args.join(', ') + '])';
    if (this.ctx.builtins.has(n)) return 'F.' + n + '(self, other' + (args.length ? ', ' + args.join(', ') : '') + ')';
    this.unknownFns.add(n);
    return '$unknownFn(' + JSON.stringify(n) + ', self, other' + (args.length ? ', ' + args.join(', ') : '') + ')';
  }
}

function parse(src) { return new Parser(lex(src)).program(); }

function translate(src, ctx) {
  const ast = parse(src);
  const cg = new Codegen(ctx);
  // hoist var declarations: collect all 'var' names first so earlier references resolve to locals
  const collect = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(collect); return; }
    if (n.type === 'Var') n.decls.forEach(d => cg.locals.add(d.name));
    for (const k in n) if (k !== 'type') collect(n[k]);
  };
  collect(ast);
  let body = ast.body.map(s => cg.stmt(s, 1)).join('');
  if (cg.locals.size) body = '  const $L = {};\n' + body;
  return body;
}

module.exports = { lex, parse, translate, Codegen, INST_VARS, GLOBAL_VARS, GLOBAL_ARRAYS, CONSTANTS };
