#!/usr/bin/env node
// macro-sim.js: desk-check simulator for FANUC Custom Macro B programs (like O9030).
//
// It steps through a macro line by line on the PC, the way the control would, for a situation
// written in a test-case file (tool number, offsets, G65 arguments), and reports what the macro
// does: machine blocks it sends (e.g. a touch-off M165 line), alarms (#3000), or return (M99).
//
// It only knows the macro features it was built for. Anything else stops the run with
// "SIM ERROR" naming the line. It never skips or guesses.
//
// Usage:
//   node macro-sim.js --check <macro file>
//       Static checks: % at both ends, O number, comments closed, brackets balanced, no duplicate
//       N numbers, every GOTO lands on an N, ends with M99, REV line, lines that can never run.
//   node macro-sim.js <macro file> <test cases .md> [--case TC3] [--trace]
//       Runs the test cases and compares what the macro did with each case's Expect line.
//   node macro-sim.js <macro file> <test cases .md> --before <older macro file> [--case ..] [--trace]
//       Runs every case on the older and the newer macro and shows SAME / CHANGED per case.
//       PASS / FAIL is judged on the newer macro.
//
// Exit code: 0 when everything passed, 1 when a check or case failed, 2 on bad usage or a file
// that can't be read.

'use strict';
const fs = require('fs');

// G65 argument letters (argument specification I) -> local variable numbers.
const ARG_VARS = { A: 1, B: 2, C: 3, I: 4, J: 5, K: 6, D: 7, E: 8, F: 9, H: 11, M: 13, Q: 17, R: 18,
  S: 19, T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26 };
const MAX_BLOCKS = 20000;   // more blocks than this in one run = endless loop
const CLOSE_CALL = 1e-6;    // two numbers this close in a comparison = flagged as a close call

class SimError extends Error {}

const num = (v) => (v === null ? 0 : v);
const RAD = Math.PI / 180;
const FN = {
  SIN: (a) => Math.sin(a * RAD), COS: (a) => Math.cos(a * RAD), TAN: (a) => Math.tan(a * RAD),
  ASIN: (a) => Math.asin(a) / RAD, ACOS: (a) => Math.acos(a) / RAD, ATAN: (a) => Math.atan(a) / RAD,
  SQRT: (a) => { if (a < 0) throw new SimError('SQRT of a negative number'); return Math.sqrt(a); },
  ABS: Math.abs,
  ROUND: (a) => Math.sign(a) * Math.round(Math.abs(a)),
  FIX: Math.trunc,
  FUP: (a) => Math.sign(a) * Math.ceil(Math.abs(a)),
  LN: (a) => { if (a <= 0) throw new SimError('LN of zero or a negative number'); return Math.log(a); },
  EXP: Math.exp,
};

function fmt(v) {
  if (v === null) return '<empty>';
  if (Number.isInteger(v)) return String(v);
  let s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}

// ---------- reading the macro file ----------

function loadProgram(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const blocks = [];
  const labels = {};
  let oNumber = null;
  let rev = null;
  lines.forEach((text, idx) => {
    const lineNo = idx + 1;
    let t = text.trim();
    if (!t || t === '%') return;
    const comments = [];
    t = t.replace(/\(([^()]*)\)/g, (m, c) => { comments.push(c.trim()); return ' '; });
    if (t.includes('(') || t.includes(')')) throw new SimError(`line ${lineNo}: a comment ( ) is not closed`);
    for (const c of comments) {
      const m = c.match(/^REV\s+([A-Z]+)\s+(\d{4}-\d{2}-\d{2})$/i);
      if (m && !rev) rev = { letter: m[1].toUpperCase(), date: m[2], lineNo };
    }
    let code = t.replace(/\s+/g, '').toUpperCase();
    let blockDelete = false;
    if (code.startsWith('/')) { blockDelete = true; code = code.slice(1); }
    const o = code.match(/^O(\d+)/);
    if (o) {
      if (oNumber !== null) throw new SimError(`line ${lineNo}: a second O number (O${o[1]}) in the same file`);
      oNumber = +o[1];
      code = code.slice(o[0].length);
      if (code) throw new SimError(`line ${lineNo}: code after the O number on the same line`);
      return;
    }
    let label = null;
    const n = code.match(/^N(\d+)/);
    if (n) {
      label = +n[1];
      code = code.slice(n[0].length);
      if (label in labels) {
        throw new SimError(`line ${lineNo}: N${label} is used twice (also on line ${blocks[labels[label]].lineNo})`);
      }
      labels[label] = blocks.length;
    }
    if (!code && label === null) return;
    blocks.push({ lineNo, code, comment: comments.join(' '), blockDelete, label });
  });
  return { blocks, labels, oNumber, rev };
}

// ---------- expressions ----------

class Parser {
  constructor(s, sim, lineNo) { this.s = s; this.i = 0; this.sim = sim; this.lineNo = lineNo; }
  err(msg) { throw new SimError(`line ${this.lineNo}: ${msg} (in "${this.s}")`); }
  peek(re) { const m = this.s.slice(this.i).match(re); return m ? m[0] : null; }
  eat(str) { if (this.s.startsWith(str, this.i)) { this.i += str.length; return true; } return false; }
  need(str) { if (!this.eat(str)) this.err(`expected "${str}" at character ${this.i + 1}`); }
  atEnd() { return this.i >= this.s.length; }

  bracket() { this.need('['); const v = this.cond(); this.need(']'); return v; }

  cond() {
    const a = this.expr();
    const op = this.peek(/^(EQ|NE|GT|GE|LT|LE)/);
    if (!op) return a;
    this.i += 2;
    const b = this.expr();
    return this.sim.compare(a, op, b, this.lineNo);
  }

  expr() {
    let v = this.term();
    for (;;) {
      if (this.eat('+')) v = num(v) + num(this.term());
      else if (this.eat('-')) v = num(v) - num(this.term());
      else if (this.peek(/^XOR/)) { this.i += 3; v = this.int(v) ^ this.int(this.term()); }
      else if (this.peek(/^OR/)) { this.i += 2; v = this.int(v) | this.int(this.term()); }
      else return v;
    }
  }

  term() {
    let v = this.factor();
    for (;;) {
      if (this.eat('*')) v = num(v) * num(this.factor());
      else if (this.eat('/')) {
        const d = num(this.factor());
        if (d === 0) this.err('divide by zero');
        v = num(v) / d;
      }
      else if (this.peek(/^AND/)) { this.i += 3; v = this.int(v) & this.int(this.factor()); }
      else if (this.peek(/^MOD/)) {
        this.i += 3;
        const d = num(this.factor());
        if (d === 0) this.err('MOD by zero');
        v = num(v) % d;
      }
      else return v;
    }
  }

  int(v) {
    const x = num(v);
    if (!Number.isInteger(x)) this.err(`AND / OR / XOR used on ${fmt(x)}, which is not a whole number`);
    return x;
  }

  factor() {
    if (this.eat('-')) return -num(this.factor());
    if (this.eat('+')) return num(this.factor());
    if (this.peek(/^\[/)) return this.bracket();
    if (this.eat('#')) return this.sim.read(this.varIndex(), this.lineNo);
    const fn = this.peek(/^(SIN|COS|TAN|ASIN|ACOS|ATAN|SQRT|ABS|ROUND|FIX|FUP|LN|EXP)(?=\[)/);
    if (fn) {
      this.i += fn.length;
      const a = num(this.bracket());
      if (fn === 'ATAN' && this.s.startsWith('/[', this.i)) {
        this.i += 1;
        const b = num(this.bracket());
        let deg = Math.atan2(a, b) / RAD;
        if (deg < 0) deg += 360;
        return deg;
      }
      try { return FN[fn](a); } catch (e) { this.err(e.message); }
    }
    const n = this.peek(/^(\d+\.?\d*|\.\d+)/);
    if (n) { this.i += n.length; return parseFloat(n); }
    this.err(`can't read a number or variable at character ${this.i + 1}`);
  }

  varIndex() {
    let v;
    if (this.peek(/^\[/)) v = num(this.bracket());
    else {
      const d = this.peek(/^\d+/);
      if (!d) this.err('# with no variable number after it');
      this.i += d.length;
      v = +d;
    }
    const r = Math.round(v);
    if (Math.abs(v - r) > 1e-6) this.err(`#[${fmt(v)}] is not a whole variable number`);
    return r;
  }
}

// ---------- running one test case ----------

class Sim {
  constructor(prog, tc, touchOffCode, trace) {
    this.prog = prog;
    this.tc = tc;
    this.touchOffCode = touchOffCode;
    this.local = {};
    this.common = {};
    this.machine = Object.assign({}, tc.machine);
    this.events = [];
    this.warnings = [];
    this.trace = trace ? [] : null;
    for (const [n, v] of Object.entries(tc.args)) this.local[n] = v;
  }

  log(lineNo, text) { if (this.trace) this.trace.push(`line ${lineNo}: ${text}`); }

  read(n, lineNo) {
    if (n === 0) return null;
    if (n >= 1 && n <= 33) return n in this.local ? this.local[n] : null;
    if ((n >= 100 && n <= 199) || (n >= 500 && n <= 999)) return n in this.common ? this.common[n] : null;
    if (n in this.machine) return this.machine[n];
    throw new SimError(`line ${lineNo} reads #${n}, but the test case doesn't say what #${n} is on the machine. ` +
      `Add it to the case's Machine line, e.g. "- Machine: #${n}=...".`);
  }

  write(n, v, block) {
    const lineNo = block.lineNo;
    if (n === 0) throw new SimError(`line ${lineNo} tries to set #0, which is always empty`);
    if (n === 3000) {
      this.log(lineNo, `#3000=${fmt(v)} alarm`);
      this.events.push(`ALARM #3000=${fmt(v)} ${block.comment}`.trim());
      return { stop: true };
    }
    if (n === 3006) {
      this.log(lineNo, `#3006=${fmt(v)} stop with message`);
      this.events.push(`STOP #3006=${fmt(v)} ${block.comment}`.trim());
      return;
    }
    if (n >= 1 && n <= 33) this.local[n] = v;
    else if ((n >= 100 && n <= 199) || (n >= 500 && n <= 999)) this.common[n] = v;
    else if (n in this.machine) this.machine[n] = v;
    else {
      throw new SimError(`line ${lineNo} sets #${n}. The simulator doesn't know that system variable. ` +
        `If it's an offset, add it to the case's Machine line so the simulator knows it exists.`);
    }
    this.log(lineNo, `#${n} = ${fmt(v)}`);
  }

  compare(a, op, b, lineNo) {
    let result;
    if (op === 'EQ' || op === 'NE') {
      let eq;
      if (a === null || b === null) eq = a === null && b === null;
      else eq = a === b;
      result = (op === 'EQ') === eq;
    } else {
      const x = num(a), y = num(b);
      result = { GT: x > y, GE: x >= y, LT: x < y, LE: x <= y }[op];
    }
    if (a !== null && b !== null && a !== b && Math.abs(a - b) < CLOSE_CALL) {
      this.warnings.push(`line ${lineNo}: ${fmt(a)} ${op} ${fmt(b)} is a close call (equal to 6 decimal places). ` +
        `The real control could go the other way here.`);
    }
    return result ? 1 : 0;
  }

  jump(s, block) {
    const p = new Parser(s, this, block.lineNo);
    const target = Math.round(num(p.expr()));
    if (!p.atEnd()) p.err('extra characters after the GOTO number');
    if (!(target in this.prog.labels)) throw new SimError(`line ${block.lineNo}: GOTO ${target}, but there is no N${target} in the program`);
    this.log(block.lineNo, `GOTO ${target} (line ${this.prog.blocks[this.prog.labels[target]].lineNo})`);
    return { jump: this.prog.labels[target] };
  }

  assign(s, block) {
    const p = new Parser(s, this, block.lineNo);
    p.need('#');
    const n = p.varIndex();
    p.need('=');
    const v = p.expr();
    if (!p.atEnd()) p.err(`extra characters at character ${p.i + 1}`);
    return this.write(n, v, block);
  }

  machineBlock(block) {
    const c = block.code;
    const p = new Parser(c, this, block.lineNo);
    const words = [];
    while (!p.atEnd()) {
      const L = p.peek(/^[A-Z]/);
      if (!L) p.err(`can't read character ${p.i + 1}`);
      p.i += 1;
      let v;
      if (p.peek(/^#/)) { p.i += 1; v = this.read(p.varIndex(), block.lineNo); }
      else if (p.peek(/^\[/)) v = p.bracket();
      else {
        const n = p.peek(/^[-+]?(\d+\.?\d*|\.\d+)/);
        if (!n) p.err(`the letter ${L} has no value after it. If this is a macro command, the simulator wasn't built for it`);
        p.i += n.length;
        v = parseFloat(n);
      }
      words.push({ L, v });
    }
    const has = (L, v) => words.some((w) => w.L === L && w.v === v);
    if (words.some((w) => w.L === 'G' && w.v >= 65 && w.v <= 67)) {
      throw new SimError(`line ${block.lineNo}: calls another macro with G65/G66, which the simulator wasn't built for`);
    }
    const text = words.map((w) => w.L + fmt(w.v)).join(' ');
    if (has('M', 99)) {
      if (words.length > 1) throw new SimError(`line ${block.lineNo}: M99 with other words (${text}) isn't built into the simulator`);
      this.log(block.lineNo, 'M99 return');
      this.events.push('M99');
      return { stop: true };
    }
    if (has('M', 30) || has('M', 2)) {
      this.log(block.lineNo, `${text} program end`);
      this.events.push(text);
      return { stop: true };
    }
    this.events.push(text);
    this.log(block.lineNo, `sends ${text}`);
    if (this.touchOffCode && words.some((w) => w.L + fmt(w.v) === this.touchOffCode)) {
      if (Object.keys(this.tc.touchOff).length === 0) {
        this.log(block.lineNo, 'touch-off: the test case says it changes nothing');
      }
      for (const [n, v] of Object.entries(this.tc.touchOff)) {
        if (!(n in this.machine)) {
          throw new SimError(`the case's Touch-off sets line sets #${n}, which isn't on its Machine line`);
        }
        this.machine[n] = v;
        this.log(block.lineNo, `touch-off writes #${n} = ${fmt(v)}`);
      }
    }
  }

  exec(block) {
    const c = block.code;
    if (!c) return;
    if (c.startsWith('IF[')) {
      const p = new Parser(c, this, block.lineNo);
      p.i = 2;
      const v = num(p.bracket());
      const rest = c.slice(p.i);
      this.log(block.lineNo, `IF ${c.slice(2, p.i)} is ${v ? 'TRUE' : 'FALSE'}`);
      if (rest.startsWith('GOTO')) return v ? this.jump(rest.slice(4), block) : undefined;
      if (rest.startsWith('THEN')) return v ? this.assign(rest.slice(4), block) : undefined;
      p.err('IF must be followed by GOTO or THEN');
    }
    if (c.startsWith('GOTO')) return this.jump(c.slice(4), block);
    if (/^(WHILE|END\d|DO\d)/.test(c)) {
      throw new SimError(`line ${block.lineNo}: WHILE / DO / END loops aren't built into the simulator yet`);
    }
    if (c.startsWith('#')) return this.assign(c, block);
    return this.machineBlock(block);
  }

  run() {
    const { blocks } = this.prog;
    let pc = 0;
    let steps = 0;
    try {
      for (;;) {
        if (pc >= blocks.length) { this.events.push('RAN OFF THE END WITHOUT M99'); break; }
        if (++steps > MAX_BLOCKS) {
          const seen = [];
          for (const e of this.events) if (!seen.includes(e)) seen.push(e);
          this.events = seen.concat(['ENDLESS LOOP']);
          break;
        }
        const b = blocks[pc];
        if (b.blockDelete && this.tc.blockDelete) { this.log(b.lineNo, 'skipped (block delete is on)'); pc++; continue; }
        const r = this.exec(b);
        if (r && r.stop) break;
        pc = r && r.jump !== undefined ? r.jump : pc + 1;
      }
    } catch (e) {
      if (!(e instanceof SimError)) throw e;
      this.events.push(`SIM ERROR: ${e.message}`);
    }
    return this;
  }
}

// ---------- test case file ----------

function parseCases(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const cases = [];
  let touchOffCode = null;
  let cur = null;
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const h = line.match(/^###\s+(\S+)\s*(.*)$/);
    if (h) {
      cur = { id: h[1], title: h[2].trim(), lineNo, call: null, args: {}, machine: {}, touchOff: {},
        blockDelete: false, expect: null, problems: [] };
      cases.push(cur);
      return;
    }
    if (/^##?\s/.test(line)) { cur = null; return; }
    const t = line.match(/^\s*(?:-\s*)?Touch-off code\s*:\s*(\S+)/i);
    if (t && !cur) { touchOffCode = t[1].toUpperCase(); return; }
    if (!cur) return;
    const f = line.match(/^\s*-\s*(Call|Machine|Touch-off sets|Block delete|Expect)\s*:\s*(.*)$/i);
    if (!f) return;
    const key = f[1].toLowerCase();
    const val = f[2].replace(/`/g, '').trim();
    const bad = (msg) => cur.problems.push(`test case file line ${lineNo}: ${msg}`);
    if (key === 'call') {
      cur.call = val;
      const words = val.toUpperCase().replace(/\s+/g, '').match(/[A-Z][-+]?(\d+\.?\d*|\.\d+)/g) || [];
      const joined = words.join('');
      if (joined !== val.toUpperCase().replace(/\s+/g, '')) bad(`can't read the Call line "${val}"`);
      for (const w of words) {
        const L = w[0];
        const v = parseFloat(w.slice(1));
        if (L === 'G') { if (v !== 65) bad(`the Call line must be a G65 call`); continue; }
        if (L === 'P') { cur.program = v; continue; }
        if (!(L in ARG_VARS)) { bad(`${L} can't be used as a G65 argument`); continue; }
        cur.args[ARG_VARS[L]] = v;
      }
    } else if (key === 'machine' || key === 'touch-off sets') {
      const target = key === 'machine' ? cur.machine : cur.touchOff;
      for (const pair of val.split(/[\s,]+/).filter(Boolean)) {
        const m = pair.match(/^#(\d+)=([-+]?(\d+\.?\d*|\.\d+))$/);
        if (!m) { bad(`can't read "${pair}" (write it like #11006=8.415)`); continue; }
        target[+m[1]] = parseFloat(m[2]);
      }
    } else if (key === 'block delete') {
      cur.blockDelete = /^on$/i.test(val);
    } else if (key === 'expect') {
      cur.expect = val;
    }
  });
  for (const c of cases) {
    if (!c.call) c.problems.push(`${c.id} has no Call line`);
    if (!c.expect) c.problems.push(`${c.id} has no Expect line`);
  }
  return { cases, touchOffCode };
}

const norm = (s) => s.split('|').map((e) => e.trim().replace(/\s+/g, ' ').toUpperCase()).filter(Boolean);

function runOne(prog, tc, touchOffCode, trace) {
  if (tc.problems.length) return { events: tc.problems.map((p) => `CASE PROBLEM: ${p}`), warnings: [], trace: null, problem: true };
  return new Sim(prog, tc, touchOffCode, trace).run();
}

// ---------- static check ----------

function check(path) {
  const out = [];
  let fail = false;
  const ok = (m) => out.push(`OK    ${m}`);
  const bad = (m) => { out.push(`FAIL  ${m}`); fail = true; };
  const note = (m) => out.push(`NOTE  ${m}`);
  const raw = fs.readFileSync(path, 'utf8');
  const lines = raw.split(/\r?\n/);
  const nonEmpty = lines.map((l, i) => ({ t: l.trim(), n: i + 1 })).filter((x) => x.t);
  if (nonEmpty.length && nonEmpty[0].t === '%') ok('starts with %'); else bad('first line is not %');
  if (nonEmpty.length && nonEmpty[nonEmpty.length - 1].t === '%') ok('ends with %'); else bad('last line is not %');
  if (/[^\x09\x0A\x0D\x20-\x7E]/.test(raw)) {
    const i = lines.findIndex((l) => /[^\x09\x20-\x7E]/.test(l));
    bad(`line ${i + 1} has a character the control may not accept (only plain keyboard characters are safe)`);
  } else ok('only plain characters');
  let prog;
  try { prog = loadProgram(path); } catch (e) {
    if (!(e instanceof SimError)) throw e;
    bad(e.message);
    return { out, fail };
  }
  ok('every comment ( ) is closed, no N number used twice');
  if (prog.oNumber !== null) ok(`program number O${prog.oNumber}`); else bad('no O number line');
  if (prog.rev) ok(`REV ${prog.rev.letter} ${prog.rev.date} (line ${prog.rev.lineNo})`);
  else note('no (REV x YYYY-MM-DD) line');
  let bracketsOk = true;
  for (const b of prog.blocks) {
    let depth = 0;
    for (const ch of b.code) {
      if (ch === '[') depth++;
      if (ch === ']') depth--;
      if (depth < 0) break;
    }
    if (depth !== 0) { bad(`line ${b.lineNo}: [ ] brackets don't match`); bracketsOk = false; }
  }
  if (bracketsOk) ok('every [ ] bracket matches');
  let gotosOk = true;
  for (const b of prog.blocks) {
    for (const m of b.code.matchAll(/GOTO(#?)(\d*)/g)) {
      if (m[1] || !m[2]) { note(`line ${b.lineNo}: GOTO with a variable target can't be checked ahead of time`); continue; }
      if (!(+m[2] in prog.labels)) { bad(`line ${b.lineNo}: GOTO ${m[2]}, but there is no N${m[2]}`); gotosOk = false; }
    }
  }
  if (gotosOk) ok('every GOTO lands on an N number');
  const last = prog.blocks.filter((b) => b.code)[prog.blocks.filter((b) => b.code).length - 1];
  if (last && last.code === 'M99') ok(`ends with M99 (line ${last.lineNo})`);
  else bad('the last block is not M99, so the macro may never return to the program');
  for (let i = 0; i < prog.blocks.length - 1; i++) {
    const b = prog.blocks[i];
    const stops = /^GOTO/.test(b.code) || b.code === 'M99' || /^#3000=/.test(b.code);
    if (!stops) continue;
    const nxt = prog.blocks[i + 1];
    if (nxt.label === null && nxt.code) note(`line ${nxt.lineNo} (${nxt.code}) can never run: the block before it always jumps or stops`);
  }
  return { out, fail, prog };
}

// ---------- command line ----------

function main(argv) {
  const opts = { trace: false, only: null, before: null, check: null };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--trace') opts.trace = true;
    else if (a === '--case') opts.only = (argv[++i] || '').toUpperCase();
    else if (a === '--before') opts.before = argv[++i];
    else if (a === '--check') opts.check = argv[++i];
    else files.push(a);
  }
  try {
    if (opts.check) {
      const r = check(opts.check);
      console.log(`Macro check: ${opts.check}`);
      for (const l of r.out) console.log(l);
      console.log(r.fail ? 'RESULT: FAILED' : 'RESULT: PASSED');
      return r.fail ? 1 : 0;
    }
    if (files.length !== 2) {
      console.error('Usage: node macro-sim.js <macro file> <test cases .md> [--before <older macro>] [--case TC3] [--trace]\n' +
        '       node macro-sim.js --check <macro file>');
      return 2;
    }
    const [macroPath, casesPath] = files;
    const prog = loadProgram(macroPath);
    const before = opts.before ? loadProgram(opts.before) : null;
    const { cases, touchOffCode } = parseCases(casesPath);
    const chosen = cases.filter((c) => !opts.only || c.id.toUpperCase() === opts.only);
    if (!chosen.length) { console.error(opts.only ? `No case ${opts.only} in ${casesPath}` : `No test cases in ${casesPath}`); return 2; }
    const revText = (p) => (p.rev ? `REV ${p.rev.letter} ${p.rev.date}` : 'no rev line');
    console.log(`Desk check of O${prog.oNumber} (${revText(prog)})` +
      (before ? ` against older O${before.oNumber} (${revText(before)})` : '') + `: ${chosen.length} test case(s)`);
    if (!touchOffCode) console.log('NOTE  the test case file has no "Touch-off code:" line, so no block is treated as a touch-off');
    let passed = 0, failed = 0, changed = 0;
    for (const tc of chosen) {
      if (tc.program !== undefined && tc.program !== prog.oNumber) {
        tc.problems.push(`${tc.id} calls P${tc.program} but the macro file is O${prog.oNumber}`);
      }
      const after = runOne(prog, tc, touchOffCode, opts.trace);
      const exp = tc.expect ? norm(tc.expect) : [];
      const got = after.events.map((e) => e.replace(/\s+/g, ' ').toUpperCase());
      const pass = !after.problem && exp.length === got.length && exp.every((e, i) => e === got[i]);
      pass ? passed++ : failed++;
      console.log('');
      let head = `${pass ? 'PASS' : 'FAIL'}  ${tc.id} ${tc.title}`;
      if (before) {
        const b = runOne(before, tc, touchOffCode, opts.trace);
        const same = b.events.join(' | ') === after.events.join(' | ');
        if (!same) changed++;
        head += `   [${same ? 'SAME' : 'CHANGED'}]`;
        console.log(head);
        console.log(`      call:     ${tc.call}`);
        console.log(`      before:   ${b.events.join(' | ')}`);
        console.log(`      after:    ${after.events.join(' | ')}`);
        if (!pass) console.log(`      expected: ${tc.expect}`);
        for (const w of b.warnings) console.log(`      WARN (before) ${w}`);
        if (opts.trace && b.trace) { console.log('      trace (before):'); for (const t of b.trace) console.log(`        ${t}`); }
      } else {
        console.log(head);
        console.log(`      call:     ${tc.call}`);
        console.log(`      did:      ${after.events.join(' | ')}`);
        if (!pass) console.log(`      expected: ${tc.expect}`);
      }
      for (const w of after.warnings) console.log(`      WARN  ${w}`);
      if (opts.trace && after.trace) { console.log(before ? '      trace (after):' : '      trace:'); for (const t of after.trace) console.log(`        ${t}`); }
    }
    console.log('');
    console.log(`${passed} passed, ${failed} failed` + (before ? `, ${changed} changed from before` : ''));
    return failed ? 1 : 0;
  } catch (e) {
    if (e instanceof SimError || e.code === 'ENOENT') { console.error(`ERROR: ${e.message}`); return 2; }
    throw e;
  }
}

process.exitCode = main(process.argv.slice(2));
