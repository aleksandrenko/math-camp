'use strict';

/* ================================================================
   math-camp — генератор на листове за смятане с решения по стъпки
   ================================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const len = (n) => String(Math.abs(n)).length;
const digitAt = (n, i) => Math.floor(n / 10 ** i) % 10;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const PLACE = ['единици', 'десетици', 'стотици', 'хиляди', 'десетици хиляди', 'стотици хиляди', 'милиони', 'десетици милиони'];
const PLACE_FROM = ['единиците', 'десетиците', 'стотиците', 'хилядите', 'десетиците хиляди', 'стотиците хиляди', 'милионите', 'десетиците милиони'];

const TYPES = ['smart', 'add', 'sub', 'mul', 'div', 'mix'];
const COLORS = { smart: '#8E6CC9', add: '#F4C430', sub: '#F07258', mul: '#6DBE94', div: '#1F5A6E', mix: '#24221E' };
const CHROME_COLORS = { smart: 'var(--plum)', add: 'var(--yellow)', sub: 'var(--coral)', mul: 'var(--green)', div: 'var(--navy)', mix: 'var(--fg)' };
const TYPE_NAME = { smart: 'Рационално смятане', add: 'Събиране', sub: 'Изваждане', mul: 'Умножение', div: 'Деление', mix: 'Ред на действията' };
const TYPE_SYM = { smart: 'dot', add: 'plus', sub: 'minus', mul: 'times', div: 'divide', mix: 'equals' };
const SMART_KINDS = ['group', 'distrib', 'chain', 'decomp', 'combo'];
const SMART_KIND_NAME = { group: 'Групиране', distrib: 'Общ множител', chain: 'Деление на части', decomp: 'Разлагане', combo: 'Комбинирани' };
const SMALL_PAIRS = [[2, 5], [5, 2], [4, 25], [25, 4], [20, 5], [5, 20], [50, 2], [2, 50]];
const BIG_PAIRS = [[125, 8], [8, 125], [250, 4], [4, 250], [500, 2], [2, 500], [200, 5], [25, 40], [40, 25]];

const SKILLS = {
  'add-simple': { type: 'add', name: 'Събиране без преминаване' },
  'add-carry': { type: 'add', name: 'Събиране с преминаване (наум)' },
  'sub-simple': { type: 'sub', name: 'Изваждане без заемане' },
  'sub-borrow': { type: 'sub', name: 'Изваждане със заемане' },
  'sub-zero': { type: 'sub', name: 'Заемане през нула' },
  'sub-neg': { type: 'sub', name: 'Отрицателен резултат' },
  'mul-table': { type: 'mul', name: 'Таблица за умножение' },
  'mul-1': { type: 'mul', name: 'Умножение с едноцифрено число' },
  'mul-multi': { type: 'mul', name: 'Умножение с многоцифрено число' },
  'div-table': { type: 'div', name: 'Таблично деление' },
  'div-long': { type: 'div', name: 'Деление в колонка' },
  'div-zero': { type: 'div', name: 'Нула в частното' },
  'div-rem': { type: 'div', name: 'Деление с остатък' },
  'mix-order': { type: 'mix', name: 'Ред на действията' },
  'mix-paren': { type: 'mix', name: 'Изрази със скоби' },
  'smart-group': { type: 'smart', name: 'Групиране на множители' },
  'smart-distrib': { type: 'smart', name: 'Изнасяне на общ множител' },
  'smart-chain': { type: 'smart', name: 'Последователно деление' },
  'smart-decomp': { type: 'smart', name: 'Деление чрез разлагане' },
  'smart-combo': { type: 'smart', name: 'Комбинирани изрази' },
};

/* ---------------- storage (try/catch: може да е недостъпно) ---------------- */
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* недостъпно хранилище */ } },
};
const CFG_KEY = 'math-camp:config:v1';
const LEGACY_JOURNAL_KEY = 'math-camp:journal:v1';

/* ---------------- история в IndexedDB (без лимита на localStorage) ---------------- */
const db = {
  _p: null,
  open() {
    return (this._p ??= new Promise((res, rej) => {
      if (!('indexedDB' in window)) { rej(new Error('IndexedDB липсва')); return; }
      const r = indexedDB.open('math-camp', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('sheets', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  },
  async run(mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction('sheets', mode);
      const req = fn(t.objectStore('sheets'));
      t.oncomplete = () => res(req.result);
      t.onerror = () => rej(t.error);
    });
  },
  all() { return this.run('readonly', (s) => s.getAll()); },
  put(v) { return this.run('readwrite', (s) => s.put(v)); },
  del(id) { return this.run('readwrite', (s) => s.delete(id)); },
};

/* ---------------- нива на трудност: същите видове задачи, различни числа ---------------- */
const LADDER = {
  smart: [
    { xMin: 2, xMax: 9, big: false, t100: false, depth: 2, dMax: 5, rMax: 5, k: 2 },
    { xMin: 2, xMax: 20, big: false, t100: false, depth: 2, dMax: 5, rMax: 9, k: 2 },
    { xMin: 11, xMax: 50, big: false, t100: false, depth: 2, dMax: 9, rMax: 9, k: 2 },
    { xMin: 11, xMax: 99, big: true, t100: false, depth: 2, dMax: 9, rMax: 12, k: 3 },
    { xMin: 11, xMax: 99, big: true, t100: true, depth: 3, dMax: 6, rMax: 10, k: 3 },
    { xMin: 11, xMax: 199, big: true, t100: true, depth: 3, dMax: 8, rMax: 12, k: 3 },
    { xMin: 100, xMax: 999, big: true, t100: true, depth: 3, dMax: 9, rMax: 15, k: 3 },
    { xMin: 100, xMax: 999, big: true, t100: true, depth: 3, dMax: 9, rMax: 20, k: 4 },
    { xMin: 100, xMax: 9999, big: true, t100: true, depth: 3, dMax: 9, rMax: 25, k: 4 },
    { xMin: 1000, xMax: 9999, big: true, t100: true, depth: 3, dMax: 9, rMax: 30, k: 4 },
  ],
  add: [
    { min: 1, max: 10, terms: 2, noCarry: true }, { min: 2, max: 20, terms: 2, noCarry: false },
    { min: 10, max: 99, terms: 2, noCarry: true }, { min: 10, max: 99, terms: 2, noCarry: false },
    { min: 100, max: 999, terms: 2, noCarry: false }, { min: 100, max: 999, terms: 3, noCarry: false },
    { min: 1000, max: 9999, terms: 2, noCarry: false }, { min: 1000, max: 9999, terms: 3, noCarry: false },
    { min: 10000, max: 99999, terms: 2, noCarry: false }, { min: 10000, max: 999999, terms: 3, noCarry: false },
  ],
  sub: [
    { aMin: 2, aMax: 10, bMin: 1, bMax: 9, noCarry: true }, { aMin: 10, aMax: 20, bMin: 1, bMax: 10, noCarry: false },
    { aMin: 20, aMax: 99, bMin: 10, bMax: 99, noCarry: true }, { aMin: 20, aMax: 100, bMin: 10, bMax: 99, noCarry: false },
    { aMin: 100, aMax: 999, bMin: 10, bMax: 999, noCarry: false }, { aMin: 100, aMax: 1000, bMin: 100, bMax: 999, noCarry: false },
    { aMin: 1000, aMax: 9999, bMin: 100, bMax: 999, noCarry: false }, { aMin: 1000, aMax: 9999, bMin: 1000, bMax: 9999, noCarry: false },
    { aMin: 10000, aMax: 99999, bMin: 1000, bMax: 9999, noCarry: false }, { aMin: 10000, aMax: 999999, bMin: 1000, bMax: 99999, noCarry: false },
  ],
  mul: [
    { aMin: 2, aMax: 5, bMin: 2, bMax: 5 }, { aMin: 2, aMax: 10, bMin: 2, bMax: 5 },
    { aMin: 2, aMax: 10, bMin: 2, bMax: 10 }, { aMin: 11, aMax: 20, bMin: 2, bMax: 9 },
    { aMin: 12, aMax: 999, bMin: 2, bMax: 9 }, { aMin: 100, aMax: 9999, bMin: 2, bMax: 9 },
    { aMin: 12, aMax: 99, bMin: 11, bMax: 99 }, { aMin: 100, aMax: 999, bMin: 11, bMax: 99 },
    { aMin: 1000, aMax: 9999, bMin: 11, bMax: 99 }, { aMin: 1000, aMax: 9999, bMin: 100, bMax: 999 },
  ],
  div: [
    { aMin: 4, aMax: 20, bMin: 2, bMax: 5 }, { aMin: 4, aMax: 50, bMin: 2, bMax: 10 },
    { aMin: 4, aMax: 100, bMin: 2, bMax: 10 }, { aMin: 20, aMax: 99, bMin: 2, bMax: 9 },
    { aMin: 20, aMax: 999, bMin: 2, bMax: 9 }, { aMin: 1000, aMax: 9999, bMin: 2, bMax: 9 },
    { aMin: 100, aMax: 999, bMin: 11, bMax: 30 }, { aMin: 1000, aMax: 9999, bMin: 11, bMax: 99 },
    { aMin: 10000, aMax: 99999, bMin: 11, bMax: 99 }, { aMin: 10000, aMax: 999999, bMin: 100, bMax: 999 },
  ],
  mix: [
    { min: 1, max: 10, smallMax: 5, ops: 2, paren: false }, { min: 1, max: 20, smallMax: 5, ops: 2, paren: false },
    { min: 2, max: 30, smallMax: 10, ops: 2, paren: false }, { min: 2, max: 50, smallMax: 10, ops: 2, paren: true },
    { min: 2, max: 100, smallMax: 10, ops: 2, paren: true }, { min: 2, max: 100, smallMax: 10, ops: 3, paren: true },
    { min: 10, max: 200, smallMax: 12, ops: 3, paren: true }, { min: 10, max: 500, smallMax: 15, ops: 3, paren: true },
    { min: 10, max: 999, smallMax: 20, ops: 3, paren: true }, { min: 10, max: 999, smallMax: 20, ops: 4, paren: true },
  ],
};
const LEVEL_MIN = 1, LEVEL_MAX = 10;
function applyLevel(c, L) {
  c.level = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, L));
  c.levelCustom = false;
  for (const t of Object.keys(LADDER)) Object.assign(c[t], LADDER[t][c.level - 1]);
  return c;
}
// следващото ниво според резултата: над 90% вярно → по-трудно, под 70% → по-лесно
function nextLevel(level, acc) {
  if (acc >= 0.9) return Math.min(LEVEL_MAX, level + 1);
  if (acc < 0.7) return Math.max(LEVEL_MIN, level - 1);
  return level;
}
const levelWord = (from, to) => (to > from ? 'малко по-трудно' : to < from ? 'малко по-лесно' : 'същото ниво');

/* ---------------- конфигурация ---------------- */
const BASE = applyLevel({
  title: 'Работен лист по математика', detail: 'short', symbols: 'x', work: true, order: 'grouped', names: true, check: true, noTrivial: true, focus: [],
  level: 5, levelCustom: false,
  smart: { on: true, n: 8, kinds: { group: true, distrib: true, chain: true, decomp: true, combo: true } },
  add: { on: true, n: 1 },
  sub: { on: true, n: 1, neg: false },
  mul: { on: true, n: 1 },
  div: { on: true, n: 2, rem: false },
  mix: { on: true, n: 2, allow: { '+': true, '−': true, '·': true, ':': true } },
}, 5);

const PRESETS = [
  { id: 'g1', label: '1 клас', level: 2, patch: { smart: { on: false },
    add: { on: true, n: 8 }, sub: { on: true, n: 8 }, mul: { on: false }, div: { on: false }, mix: { on: false } } },
  { id: 'g2', label: '2 клас', level: 3, patch: { smart: { on: true, n: 4 },
    add: { on: true, n: 4 }, sub: { on: true, n: 4 }, mul: { on: true, n: 4 }, div: { on: true, n: 4 }, mix: { on: false } } },
  { id: 'g3', label: '3 клас', level: 5, patch: { smart: { on: true, n: 6 },
    add: { on: true, n: 3 }, sub: { on: true, n: 3 }, mul: { on: true, n: 3 }, div: { on: true, n: 3 }, mix: { on: true, n: 3 } } },
  { id: 'g4', label: '4 клас', level: 8, patch: { smart: { on: true, n: 8 },
    add: { on: true, n: 2 }, sub: { on: true, n: 2 }, mul: { on: true, n: 3 }, div: { on: true, n: 3 }, mix: { on: true, n: 2 } } },
  { id: 'table', label: 'Таблицата за умножение', level: 3, patch: { smart: { on: false },
    add: { on: false }, sub: { on: false }, div: { on: false }, mix: { on: false }, mul: { on: true, n: 24 } } },
];

function merge(target, patch) {
  for (const k of Object.keys(patch)) {
    if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k])) merge(target[k] ??= {}, patch[k]);
    else target[k] = patch[k];
  }
  return target;
}

const stored = store.get(CFG_KEY, {});
let cfg = merge(clone(BASE), stored);
delete cfg.seed; delete cfg.preset; delete cfg.layout; delete cfg.cols;
let seed = stored.seed || newCode();
let view = 'both';
let probs = [];
let activePreset = stored.preset || null;

// стабилен JSON (сортирани ключове), за да дава един и същ номер един и същ лист
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
// настройките, които не променят самите задачи, не влизат в отпечатъка
const problemKey = () => seed + '|' + stable({ ...cfg, title: '', names: 0, check: 0, symbols: 0, work: 0, detail: 0 });

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

/* ---------------- детерминиран генератор на случайни числа ---------------- */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- решетка от квадратчета ---------------- */
function mkGrid(w) { return { w, rows: [] }; }
function addRow(g, kind = '') {
  const r = { kind, cells: Array.from({ length: g.w }, () => ({ t: '', c: '', a: false, ac: '' })) };
  g.rows.push(r);
  return r;
}
function put(r, col, t, o = {}) {
  const c = r.cells[col];
  if (!c) return;
  c.t = String(t);
  if (o.c) c.c += ' ' + o.c;
  if (o.a) c.a = true;
  if (o.ac) c.ac += ' ' + o.ac;
  if (o.span) c.span = o.span;
}
function putNum(r, end, n, o) { const s = String(n); for (let i = 0; i < s.length; i++) put(r, end - s.length + 1 + i, s[i], o); }
function putStr(r, start, s, o) { [...s].forEach((ch, i) => put(r, start + i, ch, o)); }
function underline(r, c0, c1, ans) {
  for (let c = Math.max(0, c0); c <= c1; c++) if (r.cells[c]) { if (ans) r.cells[c].ac += ' ul'; else r.cells[c].c += ' ul'; }
}
function gridHTML(g, mode) {
  let h = `<div class="cg" style="--w:${g.w}">`;
  for (const r of g.rows) {
    h += `<div class="cr ${r.kind}">`;
    for (let i = 0; i < r.cells.length; i++) {
      const c = r.cells[i];
      const show = mode === 'ans' || !c.a;
      const cls = 'cc' + c.c + (mode === 'ans' ? c.ac + (c.a ? ' ans' : '') : '');
      const sp = c.span ? ` style="grid-column:span ${c.span}"` : '';
      h += `<span class="${cls}"${sp}>${show ? esc(symCell(c.t)) : ''}</span>`;
      if (c.span) i += c.span - 1;
    }
    h += '</div>';
  }
  return h + '</div>';
}

/* ---------------- решаване: събиране ---------------- */
function solveAdd(nums) {
  const sum = nums.reduce((s, x) => s + x, 0);
  const W = Math.max(len(sum), ...nums.map(len)) + 1;
  const maxLen = Math.max(...nums.map(len));
  const steps = [];
  const carries = [];
  let carry = 0;
  let hadCarry = false;
  for (let i = 0; i < maxLen; i++) {
    const ds = nums.filter((n) => i < len(n)).map((n) => digitAt(n, i));
    const s = ds.reduce((a, b) => a + b, 0) + carry;
    const last = i === maxLen - 1;
    let txt = ds.join(' + ') + (carry ? ` + ${carry} (наум)` : '') + ` = ${s}`;
    if (last) txt += ` → пишем ${s}`;
    else if (s >= 10) { txt += ` → пишем ${s % 10}, ${Math.floor(s / 10)} наум`; hadCarry = true; }
    else txt += ` → пишем ${s}`;
    if (last && s >= 10 && maxLen > 1) hadCarry = true;
    steps.push({ lead: cap(PLACE[i]), txt });
    carry = Math.floor(s / 10);
    if (!last && carry) carries[i + 1] = carry;
  }
  const g = mkGrid(W);
  const cr = addRow(g, 'carry');
  carries.forEach((c, i) => { if (c) put(cr, W - 1 - i, c, { a: true }); });
  nums.forEach((n, k) => {
    const r = addRow(g);
    putNum(r, W - 1, n);
    if (k > 0) put(r, 0, '+', { c: 'op' });
    if (k === nums.length - 1) underline(r, 0, W - 1, false);
  });
  putNum(addRow(g), W - 1, sum, { a: true });
  const others = sum - nums[nums.length - 1];
  return {
    grid: g, steps, answer: String(sum), value: sum,
    check: `${sum} − ${nums[nums.length - 1]} = ${others}`,
    tags: [hadCarry ? 'add-carry' : 'add-simple'],
  };
}

/* ---------------- решаване: изваждане ---------------- */
function solveSub(a, b) {
  if (a < b) {
    const s = solveSub(b, a);
    s.steps.unshift({ lead: 'Внимание', txt: `${a} < ${b}, затова смятаме ${b} − ${a} и пред резултата слагаме минус` });
    s.answer = '−' + s.answer;
    s.value = -s.value;
    s.check = `${s.answer} + ${b} = ${a}`;
    s.tags = ['sub-neg', ...s.tags];
    return s;
  }
  const da = len(a);
  const W = da + 1;
  const work = Array.from({ length: da + 1 }, (_, i) => (i < da ? digitAt(a, i) : 0));
  const changed = [];
  const steps = [];
  let borrowed = false;
  let zeroBorrow = false;
  for (let i = 0; i < da; i++) {
    const inB = i < len(b);
    const sd = inB ? digitAt(b, i) : 0;
    const orig = digitAt(a, i);
    let v = work[i];
    let txt;
    if (v < 0) {
      work[i] += 10; work[i + 1] -= 1; changed[i] = changed[i + 1] = true; zeroBorrow = true;
      v = work[i];
      txt = `тук е 0 и трябва да даде 1 → заемаме 1 от ${PLACE_FROM[i + 1]}: 10 − 1 = 9; ` + (inB ? `9 − ${sd} = ${9 - sd}` : 'пишем 9');
    } else {
      const pre = v !== orig ? `${orig} − 1 (дадохме 1) = ${v}; ` : '';
      if (v < sd) {
        work[i] += 10; work[i + 1] -= 1; changed[i] = changed[i + 1] = true; borrowed = true;
        txt = pre + `${v} < ${sd} → заемаме 1 от ${PLACE_FROM[i + 1]}: ${v + 10} − ${sd} = ${v + 10 - sd}`;
      } else {
        txt = pre + (inB ? `${v} − ${sd} = ${v - sd}` : `пишем ${v}`);
      }
    }
    if (i === da - 1 && da > 1 && work[i] - sd === 0) txt += ' → нулата отпред не се пише';
    steps.push({ lead: cap(PLACE[i]), txt });
  }
  const r = a - b;
  const g = mkGrid(W);
  const br = addRow(g, 'carry');
  const top = addRow(g);
  putNum(top, W - 1, a);
  for (let i = 0; i < da; i++) {
    if (changed[i]) { put(br, W - 1 - i, work[i], { a: true }); top.cells[W - 1 - i].ac += ' x'; }
  }
  const bot = addRow(g);
  putNum(bot, W - 1, b);
  put(bot, 0, '−', { c: 'op' });
  underline(bot, 0, W - 1, false);
  putNum(addRow(g), W - 1, r, { a: true });
  const tags = zeroBorrow ? ['sub-zero', 'sub-borrow'] : borrowed ? ['sub-borrow'] : ['sub-simple'];
  return { grid: g, steps, answer: String(r), value: r, check: `${r} + ${b} = ${a}`, tags };
}

/* ---------------- решаване: умножение ---------------- */
function solveMul(a, b) {
  const res = a * b;
  const db = len(b);
  const da = len(a);
  const partials = [];
  const steps = [];
  for (let j = 0; j < db; j++) {
    const md = digitAt(b, j);
    const p = a * md;
    partials.push(p);
    let txt;
    if (md === 0) txt = `${a} · 0 = 0`;
    else if (da === 1) txt = `${a} · ${md} = ${p}`;
    else {
      const parts = [];
      let carry = 0;
      for (let k = 0; k < da; k++) {
        const ad = digitAt(a, k);
        const v = ad * md + carry;
        const lastk = k === da - 1;
        let s = `${ad} · ${md}` + (carry ? ` + ${carry}` : '') + ` = ${v}`;
        s += lastk ? ` → пишем ${v}` : v >= 10 ? ` → пишем ${v % 10}, ${Math.floor(v / 10)} наум` : ` → пишем ${v}`;
        carry = Math.floor(v / 10);
        parts.push(s);
      }
      txt = parts.join('; ');
    }
    if (db > 1) txt += ` ⇒ ${p}` + (j ? `, пишем го отместено с ${j} квадратче${j > 1 ? 'та' : ''} наляво` : '');
    steps.push({ lead: db > 1 ? `${a} · ${md} (${PLACE[j]})` : `${a} · ${md}`, txt });
  }
  if (db > 1) steps.push({ lead: 'Събираме', txt: partials.map((p, j) => p * 10 ** j).join(' + ') + ` = ${res}` });
  const W = Math.max(da, db, len(res), ...partials.map((p, j) => len(p) + j)) + 1;
  const g = mkGrid(W);
  putNum(addRow(g), W - 1, a);
  const br = addRow(g);
  putNum(br, W - 1, b);
  put(br, 0, '×', { c: 'op' });
  underline(br, 0, W - 1, false);
  if (db > 1) {
    partials.forEach((p, j) => {
      const r = addRow(g);
      putNum(r, W - 1 - j, p, { a: true });
      if (j > 0) put(r, 0, '+', { c: 'op', a: true });
      if (j === db - 1) underline(r, 0, W - 1, true);
    });
  }
  putNum(addRow(g), W - 1, res, { a: true });
  const tags = a <= 10 && b <= 10 ? ['mul-table'] : db > 1 ? ['mul-multi'] : ['mul-1'];
  return { grid: g, steps, answer: String(res), value: res, check: b ? `${res} : ${b} = ${a}` : '', tags };
}

/* ---------------- решаване: деление (записът от българското училище) ---------------- */
function solveDiv(a, b, showRem) {
  const q = Math.floor(a / b);
  const rem = a % b;
  const A = String(a), B = String(b), Q = String(q);
  const da = A.length, db = B.length;
  const remCells = showRem && rem ? 1 + 2 + String(rem).length : 0;
  const W = 1 + da + 1 + db + 1 + Q.length + remCells;
  const g = mkGrid(W);
  const h = addRow(g);
  putStr(h, 1, A);
  put(h, da + 1, ':', { c: 'op' });
  putStr(h, da + 2, B);
  put(h, da + 2 + db, '=', { c: 'op' });
  putStr(h, da + 3 + db, Q, { a: true });
  if (remCells) {
    const st = da + 3 + db + Q.length + 1;
    put(h, st, 'ост.', { a: true, span: 2, c: 'sm' });
    putStr(h, st + 2, String(rem), { a: true });
  }

  const D = [...A].map(Number);
  const steps = [];
  let pos = 0, cur = 0;
  while (pos < da && cur < b) { cur = cur * 10 + D[pos]; pos++; }
  let end = pos;
  steps.push({ lead: 'Начало', txt: pos > 1 ? `${Math.floor(cur / 10)} < ${b}, затова взимаме първите ${pos} цифри: ${cur}` : `взимаме първата цифра: ${cur}` });

  let rowCur = null;
  let zeroInQ = false;
  while (true) {
    const qd = Math.floor(cur / b);
    if (qd === 0) {
      if (!rowCur) break;
      zeroInQ = true;
      if (pos < da) {
        const d = D[pos];
        steps.push({ lead: `${cur} : ${b}`, txt: `= 0, защото ${cur} < ${b} → пишем 0 в частното и сваляме ${d}` });
        cur = cur * 10 + d; pos++; end++;
        put(rowCur, end, d, { a: true });
        continue;
      }
      steps.push({ lead: `${cur} : ${b}`, txt: `= 0, защото ${cur} < ${b} → пишем 0 в частното, остатъкът е ${cur}` });
      break;
    }
    const prod = qd * b;
    const r = cur - prod;
    const pr = addRow(g);
    putNum(pr, end, prod, { a: true });
    put(pr, end - String(prod).length, '−', { a: true, c: 'op' });
    underline(pr, end - Math.max(String(cur).length, String(prod).length) + 1, end, true);
    const rr = addRow(g);
    let txt = `= ${qd} → ${qd} · ${b} = ${prod}; ${cur} − ${prod} = ${r}`;
    const lead = `${cur} : ${b}`;
    if (pos < da) {
      const d = D[pos];
      if (r > 0) putNum(rr, end, r, { a: true });
      put(rr, end + 1, d, { a: true });
      txt += `; сваляме ${d} → ${r * 10 + d}`;
      cur = r * 10 + d; pos++; end++;
      rowCur = rr;
      steps.push({ lead, txt });
    } else {
      putNum(rr, end, r, { a: true });
      steps.push({ lead, txt });
      break;
    }
  }
  steps.push({ lead: 'Резултат', txt: `частно ${q}` + (rem ? `, остатък ${rem}` : ', остатък 0') });
  const tags = [];
  if (a <= 100 && b <= 10 && q <= 10) tags.push('div-table'); else tags.push('div-long');
  if (zeroInQ || /0/.test(Q.slice(1))) tags.push('div-zero');
  if (rem) tags.push('div-rem');
  return {
    grid: g, steps, value: q, rem,
    answer: rem ? `${q}, ост. ${rem}` : String(q),
    check: `${q} · ${b}${rem ? ` + ${rem}` : ''} = ${a}`, tags,
  };
}

/* ---------------- решаване: ред на действията ---------------- */
const isMD = (o) => o === '·' || o === ':';
const isAS = (o) => o === '+' || o === '−';
function fmtTok(t, sp) {
  return t.map((x) => (x === '(' || x === ')' ? x : x.o ? (sp ? ` ${x.o} ` : x.o) : String(x.n))).join('');
}
function reduceAll(toks) {
  let t = toks.map((x) => (typeof x === 'object' ? { ...x } : x));
  const states = [], statesSp = [], notes = [];
  let orderMattered = false;
  while (t.length > 1) {
    let lo = 0, hi = t.length, open = -1, inG = false;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') open = i;
      else if (t[i] === ')') { lo = open + 1; hi = i; inG = true; break; }
    }
    const level = t.slice(lo, hi);
    let k = -1;
    for (let i = lo; i < hi; i++) if (t[i].o && isMD(t[i].o)) { k = i; break; }
    const md = k >= 0;
    const hasAS = level.some((z) => z.o && isAS(z.o));
    if (k < 0) for (let i = lo; i < hi; i++) if (t[i].o) { k = i; break; }
    const x = t[k - 1].n, y = t[k + 1].n, o = t[k].o;
    let r;
    if (o === '+') r = x + y;
    else if (o === '−') r = x - y;
    else if (o === '·') r = x * y;
    else { if (!y || x % y) return null; r = x / y; }
    if (r < 0 || r > 99999) return null;
    const opsHere = level.filter((z) => z.o).length;
    let lead;
    if (inG) lead = 'Първо скобите';
    else if (md && hasAS) { lead = 'Първо · и :'; orderMattered = true; }
    else if (opsHere > 1) lead = 'Отляво надясно';
    else lead = 'Накрая';
    t.splice(k - 1, 3, { n: r });
    for (let i = 0; i < t.length - 2; i++) {
      if (t[i] === '(' && t[i + 2] === ')' && t[i + 1].n !== undefined) t.splice(i, 3, t[i + 1]);
    }
    notes.push({ lead, txt: `${x} ${o} ${y} = ${r}` });
    states.push(fmtTok(t));
    statesSp.push(fmtTok(t, true));
  }
  return { states, statesSp, notes, result: t[0].n, orderMattered };
}
function solveMix(toks) {
  const red = reduceAll(toks);
  if (!red) return null;
  const first = fmtTok(toks) + '=';
  const rows = [first, ...red.states.map((s) => '=' + s)];
  const W = Math.max(...rows.map((s) => [...s].length));
  const g = mkGrid(W);
  rows.forEach((s, i) => putStr(addRow(g), 0, s, i === 0 ? {} : { a: true }));
  const hasParen = toks.includes('(');
  const tags = [];
  if (red.orderMattered || toks.some((x) => x.o && isMD(x.o))) tags.push('mix-order');
  if (hasParen) tags.push('mix-paren');
  return { grid: g, steps: red.notes, answer: String(red.result), value: red.result, check: '', tags, expr: fmtTok(toks, true), parts: red.statesSp.slice(0, -1) };
}

/* ---------------- кратки решения: верига от равенства ---------------- */
const placeParts = (n) => [...String(n)].map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((v) => v > 0);
function partsAdd(nums) {
  const L = Math.max(...nums.map(len));
  if (L < 2) return [];
  const groups = [], sums = [];
  for (let i = L - 1; i >= 0; i--) {
    const ps = nums.filter((n) => i < len(n)).map((n) => digitAt(n, i) * 10 ** i).filter((v) => v > 0);
    if (!ps.length) continue;
    groups.push(ps.length > 1 ? `(${ps.join(' + ')})` : String(ps[0]));
    sums.push(ps.reduce((a, b) => a + b, 0));
  }
  if (groups.length < 2 && !groups[0]?.startsWith('(')) return [];
  const out = [groups.join(' + ')];
  if (sums.length > 1) out.push(sums.join(' + '));
  return out;
}
function partsSub(a, b) {
  if (a < b) return [`−(${b} − ${a})`, ...partsSub(b, a).map((x) => `−(${x})`)];
  const ps = placeParts(b);
  if (ps.length < 2) return [];
  const out = [];
  let cur = a;
  for (let k = 0; k < ps.length - 1; k++) {
    out.push(`${cur} − ${ps.slice(k).join(' − ')}`);
    cur -= ps[k];
  }
  out.push(`${cur} − ${ps[ps.length - 1]}`);
  return out;
}
function partsMul(a, b) {
  if (a < 10 && b < 10) return [];
  if (b < 10 || a < 10) {
    const [big, small, left] = b < 10 ? [a, b, false] : [b, a, true];
    const ps = placeParts(big);
    if (ps.length < 2) return [];
    return [left ? `${small} · (${ps.join(' + ')})` : `(${ps.join(' + ')}) · ${small}`, ps.map((x) => x * small).join(' + ')];
  }
  const ps = placeParts(b);
  if (ps.length < 2) { const z = 10 ** (len(b) - 1); return [`${a} · ${b / z} · ${z}`, `${(a * b) / z} · ${z}`]; }
  return [ps.map((x) => `${a} · ${x}`).join(' + '), ps.map((x) => a * x).join(' + ')];
}
function partsDiv(a, b) {
  const q = Math.floor(a / b), r = a % b, base = a - r;
  if (q < 10) return [];
  let pieces = null;
  // първо търсим „кръгло + малко“, както се смята наум: 6045 = 6000 + 45
  for (let k = len(base) - 1; k >= 1; k--) {
    const h = Math.floor(base / 10 ** k) * 10 ** k, sm = base - h;
    if (sm === 0) break;
    if (h % b === 0 && sm % b === 0) { pieces = [h, sm]; break; }
  }
  if (!pieces) pieces = [...String(q)].map((d, i, arr) => Number(d) * b * 10 ** (arr.length - 1 - i)).filter((v) => v > 0);
  if (pieces.length < 2) return [];
  const all = r ? [...pieces, r] : pieces;
  return [`(${all.join(' + ')}) : ${b}`, pieces.map((x) => x / b).join(' + ') + (r ? `, ост. ${r}` : '')];
}
const fmtNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function fmtAns(p) {
  if (p.type === 'div' && p.rem) return `${fmtNum(p.value)}, ост. ${p.rem}`;
  return p.value < 0 ? '−' + fmtNum(-p.value) : fmtNum(p.value);
}
// решетка от квадратчета за подробния вид: изразът и всяко равенство на нов ред
function gridFromParts(expr, parts, ans) {
  const cmp = (x) => x.replace(/\s+/g, '');
  const rows = [cmp(expr) + '=', ...parts.map((x) => '=' + cmp(x)), '=' + ans];
  const g = mkGrid(Math.max(...rows.map((x) => [...x].length)));
  rows.forEach((x, i) => putStr(addRow(g), 0, x, i === 0 ? {} : { a: true }));
  return g;
}

/* ---------------- генериране ---------------- */
function generate(c, sd) {
  const rng = mulberry32(hashStr(sd));
  const R = (a, b) => { if (a > b) [a, b] = [b, a]; return a + Math.floor(rng() * (b - a + 1)); };
  const focus = new Set(c.focus || []);
  const out = [];
  const seen = new Set();

  const carryFree = (nums) => {
    const L = Math.max(...nums.map(len));
    for (let i = 0; i < L; i++) if (nums.reduce((s, n) => s + digitAt(n, i), 0) >= 10) return false;
    return true;
  };

  const makers = {
    add() {
      const o = c.add;
      const nums = Array.from({ length: Math.max(2, Math.min(4, o.terms)) }, () => R(o.min, o.max));
      if (c.noTrivial && nums.some((n) => n === 0)) return null;
      if (o.noCarry && !carryFree(nums)) return null;
      return { type: 'add', key: 'add' + nums.join(','), nums, ...solveAdd(nums), expr: nums.join(' + '), parts: partsAdd(nums) };
    },
    sub() {
      const o = c.sub;
      let a = R(o.aMin, o.aMax), b = R(o.bMin, o.bMax);
      if (!o.neg && b > a) { if (Math.min(o.bMin, o.bMax) > a) return null; b = R(Math.min(o.bMin, o.bMax), Math.min(Math.max(o.bMin, o.bMax), a)); }
      if (c.noTrivial && (b === 0 || a === b)) return null;
      if (o.noCarry) { for (let i = 0; i < len(b); i++) if (digitAt(b, i) > digitAt(a, i)) return null; if (b > a) return null; }
      return { type: 'sub', key: `sub${a},${b}`, nums: [a, b], forceInline: a < b, ...solveSub(a, b), expr: `${a} − ${b}`, parts: partsSub(a, b) };
    },
    mul() {
      const o = c.mul;
      const a = R(o.aMin, o.aMax), b = R(o.bMin, o.bMax);
      if (c.noTrivial && (a < 2 || b < 2)) return null;
      return { type: 'mul', key: `mul${a},${b}`, nums: [a, b], ...solveMul(a, b), expr: `${a} · ${b}`, parts: partsMul(a, b) };
    },
    div() {
      const o = c.div;
      const lo = Math.min(o.bMin, o.bMax), hi = Math.max(o.bMin, o.bMax);
      const b = R(Math.max(1, lo), Math.max(1, hi));
      if (c.noTrivial && b < 2 && hi >= 2) return null;
      let a;
      if (!o.rem) {
        const qMin = Math.max(1, Math.ceil(Math.min(o.aMin, o.aMax) / b)), qMax = Math.floor(Math.max(o.aMin, o.aMax) / b);
        if (qMin > qMax) return null;
        const q = R(qMin, qMax);
        if (c.noTrivial && q < 2 && qMax >= 2) return null;
        a = q * b;
      } else {
        a = R(o.aMin, o.aMax);
        if (a < b || a % b === 0) return null;
      }
      return { type: 'div', key: `div${a},${b}`, nums: [a, b], ...solveDiv(a, b, o.rem), expr: `${a} : ${b}`, parts: partsDiv(a, b) };
    },
    mix() {
      const o = c.mix;
      const ops = Object.keys(o.allow).filter((k) => o.allow[k]);
      if (!ops.length) return null;
      const nOps = Math.max(2, Math.min(4, o.ops));
      const opList = Array.from({ length: nOps }, () => ops[Math.floor(rng() * ops.length)]);
      const t = [];
      for (let i = 0; i <= nOps; i++) {
        const near = (i > 0 && isMD(opList[i - 1])) || (i < nOps && isMD(opList[i]));
        t.push({ n: near ? R(2, Math.max(2, o.smallMax)) : R(o.min, o.max) });
        if (i < nOps) t.push({ o: opList[i] });
      }
      if (o.paren && rng() < 0.8) {
        const cand = opList.map((op, i) => i).filter((i) => isAS(opList[i]));
        const good = cand.filter((i) => isMD(opList[i - 1]) || isMD(opList[i + 1]));
        const pool = good.length ? good : cand;
        if (pool.length) {
          const i = pool[Math.floor(rng() * pool.length)];
          t.splice(2 * (i + 1) + 1, 0, ')');
          t.splice(2 * i, 0, '(');
        }
      }
      for (let k = 0; k < t.length; k++) {
        if (t[k].o === ':' && t[k - 1].n !== undefined && t[k + 1].n !== undefined) t[k - 1].n = t[k + 1].n * R(2, Math.max(2, o.smallMax));
      }
      const s = solveMix(t);
      if (!s) return null;
      return { type: 'mix', key: 'mix' + s.expr, ...s };
    },
    smart(k) {
      const o = c.smart;
      const kinds = SMART_KINDS.filter((x) => o.kinds[x]);
      if (!kinds.length) return null;
      const kind = kinds[k % kinds.length];
      const X = () => R(Math.max(2, o.xMin), Math.max(2, o.xMax));
      let expr, value, parts, steps;
      if (kind === 'group') {
        const pairs = o.big ? [...SMALL_PAIRS, ...BIG_PAIRS] : SMALL_PAIRS;
        const [p, q] = pairs[Math.floor(rng() * pairs.length)];
        const x = X();
        if (x === p || x === q) return null;
        expr = `${p} · ${x} · ${q}`; value = p * q * x;
        parts = [`(${p} · ${q}) · ${x}`, `${p * q} · ${x}`];
        steps = [{ lead: 'Разместваме множителите', txt: `${p} · ${q} = ${p * q}, удобно за умножение` }, { lead: 'Умножаваме', txt: `${p * q} · ${x} = ${value}` }];
      } else if (kind === 'distrib') {
        const T = o.t100 && rng() < 0.6 ? 100 : 10;
        const a = X();
        const minus = rng() < 0.45;
        let b, d;
        if (!minus) { b = R(1, T - 1); d = T - b; if (b === d) return null; }
        else { d = R(2, T === 100 ? 99 : 60); b = d + T; }
        const op = minus ? '−' : '+';
        expr = `${a} · ${b} ${op} ${a} · ${d}`; value = a * T;
        parts = [`${a} · (${b} ${op} ${d})`, `${a} · ${T}`];
        steps = [{ lead: 'Общ множител', txt: `${a} е и в двете произведения → ${a} · (${b} ${op} ${d})` }, { lead: 'Скобите', txt: `${b} ${op} ${d} = ${T}` }, { lead: 'Умножаваме', txt: `${a} · ${T} = ${value}` }];
      } else if (kind === 'chain') {
        const ds = Array.from({ length: o.depth }, () => R(2, Math.max(2, o.dMax)));
        const r = R(2, Math.max(2, o.rMax));
        const N = ds.reduce((m, d) => m * d, r);
        const build = (start, rest) => rest.reduce((e, d, i) => (i < rest.length - 1 ? `(${e} : ${d})` : `${e} : ${d}`), String(start));
        expr = build(N, ds); value = r;
        parts = []; steps = [];
        let v = N;
        ds.forEach((d, i) => {
          steps.push({ lead: `${i + 1}. деление`, txt: `${v} : ${d} = ${v / d}` });
          v /= d;
          if (i < ds.length - 1) parts.push(build(v, ds.slice(i + 1)));
        });
      } else if (kind === 'decomp') {
        const b = R(2, 9);
        const pw = 10 ** o.k;
        const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (d * pw) % b === 0);
        if (!ds.length) return null;
        const h = ds[Math.floor(rng() * ds.length)] * pw;
        const sN = R(1, Math.floor(99 / b));
        const small = b * sN;
        const a = h + small;
        expr = `${a} : ${b}`; value = h / b + sN;
        parts = [`(${h} + ${small}) : ${b}`, `${h / b} + ${sN}`];
        steps = [{ lead: 'Разлагаме делимото', txt: `${a} = ${h} + ${small}` }, { lead: 'Делим всяка част', txt: `${h} : ${b} = ${h / b}; ${small} : ${b} = ${sN}` }, { lead: 'Събираме', txt: `${h / b} + ${sN} = ${value}` }];
      } else {
        const a = X();
        const b = R(1, 9), d = 10 - b;
        if (b === d) return null;
        const dv = R(2, 5);
        const m = R(Math.max(10, o.xMin), Math.max(20, o.xMax * 2));
        const M = dv * m, Q = R(1, 9) * 10, P = M + Q;
        expr = `${a} · ${b} + ${a} · ${d} + (${P} − ${Q}) : ${dv}`; value = a * 10 + m;
        parts = [`${a} · (${b} + ${d}) + ${M} : ${dv}`, `${a * 10} + ${m}`];
        steps = [{ lead: 'Общ множител', txt: `${a} · ${b} + ${a} · ${d} = ${a} · (${b} + ${d}) = ${a * 10}` }, { lead: 'Скобите', txt: `${P} − ${Q} = ${M}` }, { lead: 'Делим', txt: `${M} : ${dv} = ${m}` }, { lead: 'Събираме', txt: `${a * 10} + ${m} = ${value}` }];
      }
      return {
        type: 'smart', kind, kindIdx: SMART_KINDS.indexOf(kind), key: 'smart' + expr, expr, value, answer: String(value), parts, steps,
        check: '', tags: ['smart-' + kind], grid: gridFromParts(expr, parts, String(value)),
      };
    },
  };

  for (const type of TYPES) {
    const o = c[type];
    if (!o || !o.on) continue;
    const blockStart = out.length;
    const wanted = [...focus].filter((f) => SKILLS[f]?.type === type);
    for (let k = 0; k < Math.min(60, o.n); k++) {
      let pick = null, fallback = null;
      for (let tries = 0; tries < 300; tries++) {
        const p = makers[type](k);
        if (!p) continue;
        if (seen.has(p.key) && tries < 250) continue;
        fallback ??= p;
        // при фокус: половината задачи от този вид трябва да упражняват слабото умение
        if (wanted.length && k % 2 === 0 && !p.tags.some((tg) => wanted.includes(tg)) && tries < 250) continue;
        pick = p;
        break;
      }
      pick ??= fallback;
      if (pick) { seen.add(pick.key); out.push(pick); }
    }
    // рационалното смятане се подрежда по вид: групиране, общ множител, деление...
    if (type === 'smart' && c.order !== 'mixed') {
      const block = out.splice(blockStart).sort((x, y) => x.kindIdx - y.kindIdx);
      out.push(...block);
    }
  }
  if (c.order === 'mixed') {
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  }
  return out;
}

/* ---------------- стикери (знаците с очички) ---------------- */
function sticker(kind, fill, size = 32, cls = '') {
  const eye = (x, y, r = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + r * 0.22}" cy="${y + r * 0.14}" r="${r * 0.5}" fill="#1c2128"/>`;
  let body, eyes;
  switch (kind) {
    case 'plus': body = '<rect x="33" y="6" width="34" height="88" rx="13"/><rect x="6" y="33" width="88" height="34" rx="13"/>'; eyes = eye(41, 50) + eye(59, 50); break;
    case 'minus': body = '<rect x="4" y="30" width="92" height="40" rx="18"/>'; eyes = eye(40, 50) + eye(60, 50); break;
    case 'times': body = '<g transform="rotate(45 50 50)"><rect x="33" y="4" width="34" height="92" rx="13"/><rect x="4" y="33" width="92" height="34" rx="13"/></g>'; eyes = eye(41, 50) + eye(59, 50); break;
    case 'divide': body = '<rect x="4" y="37" width="92" height="27" rx="13"/><circle cx="50" cy="15" r="12"/><circle cx="50" cy="86" r="12"/>'; eyes = eye(41, 50.5, 6.5) + eye(59, 50.5, 6.5); break;
    case 'dot': body = '<circle cx="50" cy="50" r="44"/>'; eyes = eye(40, 46) + eye(60, 46); break;
    default: body = '<rect x="4" y="18" width="92" height="28" rx="13"/><rect x="4" y="56" width="92" height="28" rx="13"/>'; eyes = eye(40, 32, 6.5) + eye(60, 32, 6.5);
  }
  return `<svg class="stk ${cls}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><g style="fill:${fill}">${body}</g>${eyes}</svg>`;
}

/* ---------------- конфигурационен панел ---------------- */
const TYPE_FIELDS = {
  smart: [['range', 'Числото, с което се смята', 'xMin', 'xMax'], ['kinds', 'Видове', 'kinds']],
  add: [['range', 'Събираеми', 'min', 'max'], ['num', 'Брой събираеми', 'terms', 2, 4], ['check', 'Без преминаване през десетицата', 'noCarry']],
  sub: [['range', 'Умаляемо', 'aMin', 'aMax'], ['range', 'Умалител', 'bMin', 'bMax'], ['check', 'Без заемане', 'noCarry'], ['check', 'Може отрицателен резултат', 'neg']],
  mul: [['range', 'Първи множител', 'aMin', 'aMax'], ['range', 'Втори множител', 'bMin', 'bMax']],
  div: [['range', 'Делимо', 'aMin', 'aMax'], ['range', 'Делител', 'bMin', 'bMax'], ['check', 'С остатък', 'rem']],
  mix: [['range', 'Числа за + и −', 'min', 'max'], ['num', 'Числа за · и : до', 'smallMax', 2, 20], ['num', 'Брой действия', 'ops', 2, 4], ['ops', 'Действия', 'allow'], ['check', 'Със скоби', 'paren']],
};

function fieldHTML(type, f) {
  const o = cfg[type];
  const id = (k) => `f-${type}-${k}`;
  switch (f[0]) {
    case 'range':
      return `<div class="fld"><span class="lbl">${f[1]}</span><span class="rng">от <input class="num" type="number" inputmode="numeric" min="0" max="9999999" id="${id(f[2])}" data-k="${type}.${f[2]}" value="${o[f[2]]}" aria-label="${f[1]} от"> до <input class="num" type="number" inputmode="numeric" min="0" max="9999999" id="${id(f[3])}" data-k="${type}.${f[3]}" value="${o[f[3]]}" aria-label="${f[1]} до"></span></div>`;
    case 'num':
      return `<div class="fld"><label class="lbl" for="${id(f[2])}">${f[1]}</label><input class="num sm" type="number" inputmode="numeric" min="${f[3]}" max="${f[4]}" id="${id(f[2])}" data-k="${type}.${f[2]}" value="${o[f[2]]}"></div>`;
    case 'check':
      return `<label class="chk"><input type="checkbox" id="${id(f[2])}" data-k="${type}.${f[2]}" ${o[f[2]] ? 'checked' : ''}> ${f[1]}</label>`;
    case 'kinds':
      return `<div class="fld kinds"><span class="lbl">${f[1]}</span><span class="ops wide">${SMART_KINDS.map((kd) => `<label><input type="checkbox" id="${id('k-' + kd)}" data-k="${type}.kinds.${kd}" ${o.kinds[kd] ? 'checked' : ''}><span>${SMART_KIND_NAME[kd]}</span></label>`).join('')}</span></div>`;
    case 'ops':
      return `<div class="fld"><span class="lbl">${f[1]}</span><span class="ops">${['+', '−', '·', ':'].map((op, i) => `<label><input type="checkbox" id="${id('op' + i)}" data-k="${type}.allow.${op}" ${o.allow[op] ? 'checked' : ''}><span>${op}</span></label>`).join('')}</span></div>`;
  }
  return '';
}

function typeCard(type) {
  const o = cfg[type];
  return `<section class="tcard ${o.on ? '' : 'off'}" data-type="${type}" style="--c:${CHROME_COLORS[type]}">
    <div class="th">
      ${sticker(TYPE_SYM[type], CHROME_COLORS[type], 30)}
      <h3>${TYPE_NAME[type]}</h3>
      <div class="stepper" ${o.on ? '' : 'hidden'}>
        <button type="button" data-step="${type}.n" data-d="-1" aria-label="По-малко задачи">−</button>
        <input type="number" id="f-${type}-n" min="1" max="60" data-k="${type}.n" value="${o.n}" aria-label="Брой задачи ${TYPE_NAME[type]}">
        <button type="button" data-step="${type}.n" data-d="1" aria-label="Повече задачи">+</button>
      </div>
      <input type="checkbox" class="sw" id="f-${type}-on" data-k="${type}.on" ${o.on ? 'checked' : ''} aria-label="${TYPE_NAME[type]}">
    </div>
    <div class="tb">${TYPE_FIELDS[type].map((f) => fieldHTML(type, f)).join('')}</div>
  </section>`;
}

function segHTML(key, opts) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-seg="${key}" data-v="${v}" aria-pressed="${String(cfg[key]) === String(v)}">${l}</button>`).join('')}</div>`;
}

function buildConfig() {
  const focus = (cfg.focus || []).filter((f) => SKILLS[f]);
  $('#config').innerHTML = `
    ${focus.length ? `<div class="focus-note"><span>Листът набляга на: <b>${focus.map((f) => SKILLS[f].name.toLowerCase()).join(', ')}</b></span><button type="button" id="clearFocus">Махни</button></div>` : ''}
    ${adaptBanner()}
    <div class="panel">
      <h2>Трудност</h2>
      <div class="lvl">
        <div class="lvl-top"><span class="lvl-num" id="lvlOut">${levelLabel()}</span><span class="muted" id="lvlWord">${LEVEL_WORDS[cfg.level - 1]}</span></div>
        <input type="range" id="f-level" min="${LEVEL_MIN}" max="${LEVEL_MAX}" step="1" value="${cfg.level}" aria-label="Трудност от 1 до 10" aria-describedby="lvlDesc">
        <div class="lvl-scale" aria-hidden="true"><span>по-лесно</span><span>по-трудно</span></div>
        <p class="lvl-desc" id="lvlDesc"></p>
      </div>
    </div>
    <div class="panel">
      <h2>Бърз старт</h2>
      <div class="presets">${PRESETS.map((p) => `<button type="button" data-preset="${p.id}" aria-pressed="${activePreset === p.id}">${p.label}</button>`).join('')}</div>
    </div>
    <div class="panel">
      <h2>Листът</h2>
      <div class="rows">
        <input class="txt" id="f-title" data-k="title" value="${esc(cfg.title)}" aria-label="Заглавие на листа" maxlength="60">
        <div class="row"><span>Решения</span>${segHTML('detail', [['short', 'Кратки'], ['full', 'Подробни']])}</div>
        <div class="row"><span>Знаци</span>${segHTML('symbols', [['bg', '· :'], ['x', '× ÷'], ['pc', '* /']])}</div>
        <div class="row"><span>Подредба</span>${segHTML('order', [['mixed', 'Разбъркани'], ['grouped', 'По вид']])}</div>
        <label class="chk"><input type="checkbox" id="f-work" data-k="work" ${cfg.work ? 'checked' : ''}> Ред за смятане под всяка задача</label>
        <label class="chk"><input type="checkbox" id="f-names" data-k="names" ${cfg.names ? 'checked' : ''}> Място за име и дата</label>
        <label class="chk"><input type="checkbox" id="f-check" data-k="check" ${cfg.check ? 'checked' : ''}> Проверка в решенията</label>
        <label class="chk"><input type="checkbox" id="f-trivial" data-k="noTrivial" ${cfg.noTrivial ? 'checked' : ''}> Без лесни случаи (0 и 1)</label>
      </div>
    </div>
    ${TYPES.map(typeCard).join('')}`;
  updateLevelUI();
  updateLevelDesc();
}

const LEVEL_WORDS = ['до 10', 'до 20', 'до 100 без преминаване', 'до 100', 'до 1000', 'до 1000, по-дълги', 'до 10 000', 'многоцифрени множители', 'до 100 000', 'шампионско'];
function levelLabel() { return `Ниво ${cfg.level}` + (cfg.levelCustom ? ' · ръчно' : ''); }
function updateLevelUI() {
  const o = $('#lvlOut'); if (o) o.textContent = levelLabel();
  const w = $('#lvlWord'); if (w) w.textContent = cfg.levelCustom ? 'числата са сменени ръчно' : LEVEL_WORDS[cfg.level - 1];
  const r = $('#f-level'); if (r) { r.value = cfg.level; r.style.setProperty('--pct', ((cfg.level - 1) / (LEVEL_MAX - 1)) * 100 + '%'); }
}
function updateLevelDesc() {
  const d = $('#lvlDesc');
  if (!d) return;
  const seenT = new Set();
  const ex = probs.filter((p) => !seenT.has(p.type) && seenT.add(p.type)).map((p) => p.expr);
  d.textContent = ex.length ? 'Например: ' + ex.map(symText).join(';  ') : '';
}
// показва полетата с числата според избраното ниво, без да пренарежда панела (плъзгачът не губи фокус)
function syncTypeInputs() {
  for (const t of Object.keys(LADDER)) {
    for (const k of Object.keys(LADDER[t][0])) {
      const inp = $(`[data-k="${t}.${k}"]`, $('#config'));
      if (!inp) continue;
      if (inp.type === 'checkbox') inp.checked = !!cfg[t][k]; else inp.value = cfg[t][k];
    }
  }
}
function lastGraded() {
  return journal.filter((j) => j.result).sort((a, b) => (b.result.at || '').localeCompare(a.result.at || ''))[0] || null;
}
let bannerDismissed = false;
function adaptBanner() {
  const j = lastGraded();
  if (!j || bannerDismissed) return '';
  const r = j.result;
  const from = j.level || cfg.level;
  if (r.next === cfg.level && !cfg.levelCustom) return '';
  return `<div class="focus-note adapt"><span>Последният проверен лист (${esc(j.seed)}): <b>${r.ok} верни, ${r.errors} грешни</b>. Предлагаме ниво ${r.next}, ${levelWord(from, r.next)}.</span>
    <span class="actions"><button type="button" class="btn ink small" id="applyNext" data-level="${r.next}">Приложи</button><button type="button" id="dismissAdapt">Скрий</button></span></div>`;
}

function setK(path, val) {
  const ks = path.split('.');
  let o = cfg;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
function getK(path) { return path.split('.').reduce((o, k) => o[k], cfg); }

function save() { store.set(CFG_KEY, { ...cfg, seed, preset: activePreset }); }

let timer = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(() => { save(); render(); }, 160); }

function markCustom() {
  if (!activePreset) return;
  activePreset = null;
  $$('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}

function wireConfig() {
  const root = $('#config');
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'f-level') {
      applyLevel(cfg, Number(el.value));
      syncTypeInputs();
      updateLevelUI();
      markCustom();
      schedule();
      return;
    }
    const k = el.dataset.k;
    if (!k) return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') {
      v = parseInt(el.value, 10);
      if (Number.isNaN(v)) return;
      const mn = el.min !== '' ? +el.min : -Infinity, mx = el.max !== '' ? +el.max : Infinity;
      v = Math.max(mn, Math.min(mx, v));
    } else v = el.value;
    setK(k, v);
    if (k.endsWith('.on')) {
      const card = el.closest('.tcard');
      card.classList.toggle('off', !v);
      $('.stepper', card).hidden = !v;
    }
    if (k !== 'title') markCustom();
    // ръчна промяна на числата: нивото вече е „ръчно“
    const [t, f] = k.split('.');
    if (LADDER[t] && f in LADDER[t][0]) { cfg.levelCustom = true; updateLevelUI(); }
    schedule();
  });
  root.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const k = step.dataset.step;
      const v = Math.max(1, Math.min(60, getK(k) + Number(step.dataset.d)));
      setK(k, v);
      $(`[data-k="${k}"]`, root).value = v;
      markCustom();
      schedule();
      return;
    }
    const seg = e.target.closest('[data-seg]');
    if (seg) {
      const key = seg.dataset.seg;
      cfg[key] = key === 'cols' ? Number(seg.dataset.v) : seg.dataset.v;
      $$(`[data-seg="${key}"]`, root).forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
      schedule();
      return;
    }
    const pre = e.target.closest('[data-preset]');
    if (pre) {
      const p = PRESETS.find((x) => x.id === pre.dataset.preset);
      const keep = { title: cfg.title, names: cfg.names, check: cfg.check, noTrivial: cfg.noTrivial, order: cfg.order };
      cfg = merge(merge(applyLevel(clone(BASE), p.level), p.patch), keep);
      cfg.focus = [];
      activePreset = p.id;
      buildConfig();
      schedule();
      return;
    }
    if (e.target.id === 'clearFocus') { cfg.focus = []; buildConfig(); schedule(); }
    if (e.target.id === 'applyNext') { applyLevel(cfg, Number(e.target.dataset.level)); seed = newCode(); bannerDismissed = true; buildConfig(); schedule(); }
    if (e.target.id === 'dismissAdapt') { bannerDismissed = true; e.target.closest('.adapt').remove(); }
  });
}

/* ---------------- знаци за умножение и деление ---------------- */
const SYMBOLS = { bg: { '·': '·', ':': ':' }, x: { '·': '×', ':': '÷' }, pc: { '·': '*', ':': '/' } };
const symCell = (t) => (t === '·' || t === ':' ? SYMBOLS[cfg.symbols || 'bg'][t] : t);
// заменя само знаците на действия (с интервали около тях), не и двоеточията в текста
const symText = (s) => String(s).replace(/ · /g, ` ${SYMBOLS[cfg.symbols || 'bg']['·']} `).replace(/ : /g, ` ${SYMBOLS[cfg.symbols || 'bg'][':']} `);

/* ---------------- листове A4 ---------------- */
const MM = 96 / 25.4;
const PAGE_INNER_MM = 186;
const CELL_MM = 5;

function spanFor(cells, cols) {
  const colW = (PAGE_INNER_MM - 4 * (cols - 1)) / cols;
  return Math.min(cols, Math.max(1, Math.ceil(((cells + 1) * CELL_MM + 0.6) / colW)));
}

function inlineGrid(p, withAns) {
  const ops = { add: '+', sub: '−', mul: '·' };
  const lhs = p.nums.join(ops[p.type]) + '=';
  const chars = [...lhs];
  const ans = [...p.answer];
  const g = mkGrid(chars.length + ans.length);
  const r = addRow(g);
  putStr(r, 0, lhs);
  if (withAns) putStr(r, chars.length, p.answer, { a: true });
  return g;
}
// отрицателен резултат при изваждане: подробното решение показва и записа на ред
const usesInline = (p) => p.forceInline && p.type === 'sub';

function badge(p, i) {
  return `<span class="q-num">${i + 1})</span>`;
}

// лист със задачи на редове: „1) 25 × 63 × 4 = ........ [   ]“ и ред за смятане
function taskItem(p, i) {
  return el(`<div class="item q-item">
    <div class="q-row"><span class="q-ex">${i + 1}) ${esc(symText(p.expr))} =</span><span class="q-lead"></span><span class="q-box"></span></div>
    ${cfg.work ? '<div class="q-work"></div>' : ''}
  </div>`);
}

// кратко решение: условието, отговорът вдясно и веригата от равенства отдолу
function answerShort(p, i) {
  const chain = p.parts && p.parts.length ? `<div class="s-chain">= ${esc(symText(p.parts.join(' = ')))}</div>` : '';
  return el(`<div class="item s-item">
    <div class="s-row"><span class="s-q">${i + 1}) ${esc(symText(p.expr))}</span><span class="s-a">= ${esc(fmtAns(p))}</span></div>
    ${chain}
  </div>`);
}

function answerItem(p, i) {
  if (cfg.detail !== 'full') return answerShort(p, i);
  const parts = [];
  let w = p.grid.w;
  if (usesInline(p)) { const ig = inlineGrid(p, true); w = Math.max(w, ig.w); parts.push(gridHTML(ig, 'ans')); }
  parts.push(gridHTML(p.grid, 'ans'));
  const steps = p.steps.map((st) => `<li><b>${esc(symText(st.lead))}:</b> <span class="math">${esc(symText(st.txt))}</span></li>`).join('');
  return el(`<div class="item" style="grid-column:span ${spanFor(w, 2)}">
    <div class="item-top">${badge(p, i)}<span class="aexpr">${esc(symText(p.expr))}</span><span class="answer">= ${esc(fmtAns(p))}</span></div>
    <div class="paper">${parts.join('')}</div>
    <ol class="steps">${steps}</ol>
    ${cfg.check && p.check ? `<div class="check">Проверка: ${esc(symText(p.check))}</div>` : ''}
  </div>`);
}

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

function pageLogo() {
  return `<div class="pg-logo" aria-hidden="true">${sticker('plus', COLORS.add, 13)}${sticker('minus', COLORS.sub, 13)}${sticker('times', COLORS.mul, 13)}${sticker('divide', COLORS.div, 13)}<span>math-camp</span></div>`;
}

function makePage(kind, n) {
  const isTask = kind === 'task';
  const cols = !isTask && cfg.detail === 'full' ? 2 : 1;
  const title = isTask ? esc(cfg.title) : 'Решения по стъпки';
  const cont = n > 1 ? ' <span class="ph-cont">(продължение)</span>' : '';
  const right = isTask
    ? (cfg.names && n === 1 ? '<span class="field">Име: <span class="fl"></span></span><span class="field">Дата: <span class="fl short"></span></span>' : `<span class="code">Лист № ${esc(seed)}</span>`)
    : `<span class="code">Лист № ${esc(seed)}</span>`;
  const head = `<header class="pg-head"><h1 class="ph-title">${title}${cont}</h1><div class="ph-r">${right}</div></header>`;
  const bodyCls = isTask ? 'lines' : cfg.detail === 'full' ? '' : 'short';
  const page = el(`<article class="page">${pageLogo()}${head}<div class="pg-body ${bodyCls}" style="--cols:${cols}"></div><footer class="pg-foot"><span>Лист № ${esc(seed)}${isTask ? '' : ' · решения'}</span><span class="pn"></span></footer></article>`);
  return { el: page, body: $('.pg-body', page) };
}

function paginate(container, items, kind, count) {
  let n = 1;
  let page = makePage(kind, n);
  container.append(page.el);
  const pages = [page.el];
  for (const it of items) {
    page.body.append(it);
    if (page.body.scrollHeight > page.body.clientHeight + 1 && page.body.children.length > 1) {
      it.remove();
      n++;
      page = makePage(kind, n);
      container.append(page.el);
      pages.push(page.el);
      page.body.append(it);
    }
  }
  pages.forEach((p, i) => { $('.pn', p).textContent = `стр. ${i + 1} от ${pages.length}`; });
  return pages.length;
}

function render() {
  probs = generate(cfg, problemKey());
  const sh = $('#sheets');
  sh.style.zoom = 1;
  sh.innerHTML = '';
  $('#seed').value = seed;
  if (!probs.length) {
    sh.innerHTML = `<div class="empty">${sticker('equals', 'var(--fg)', 56)}<strong>Няма включени задачи</strong><span>Включи поне един вид задачи отляво, за да се появи лист.</span></div>`;
    $('#summary').textContent = '';
    return;
  }
  const tg = el('<div class="sheet-group" data-group="tasks"><div class="sg-label">Лист със задачи</div><div class="pages"></div></div>');
  const ag = el('<div class="sheet-group" data-group="answers"><div class="sg-label">Лист с решенията</div><div class="pages"></div></div>');
  sh.append(tg, ag);
  const draw = () => {
    $('.pages', tg).innerHTML = '';
    $('.pages', ag).innerHTML = '';
    const tp = paginate($('.pages', tg), probs.map((p, i) => taskItem(p, i)), 'task', probs.length);
    const ap = paginate($('.pages', ag), probs.map((p, i) => answerItem(p, i)), 'ans', probs.length);
    const first = (g) => $('.page .pg-body', g).children.length;
    return { tp, ap, capT: tp > 1 ? first(tg) : Infinity, capA: ap > 1 ? first(ag) : Infinity };
  };
  // винаги точно 1 лист задачи + 1 лист решения: махаме излишните задачи
  const wanted = probs.length;
  const r = draw();
  if (r.tp > 1 || r.ap > 1) {
    probs = trimTo(probs, Math.min(r.capT, r.capA));
    draw();
  }
  const dropped = wanted - probs.length;
  const hint = r.capA < r.capT
    ? (cfg.detail === 'full' ? 'решенията не се побират: избери „Кратки“ решения или намали задачите' : 'решенията не се побират: намали задачите отляво')
    : 'намали задачите отляво или изключи реда за смятане';
  $('#summary').textContent = `${probs.length} задачи · 1 лист задачи + 1 лист решения` + (dropped ? ` · ${dropped} не се побраха (${hint})` : '');
  $('#summary').classList.toggle('warn', dropped > 0);
  applyView();
  updateSelectedUI();
  updateLevelDesc();
  fit();
}

// съкращава до n задачи, като маха от вида с най-много задачи (последната от него)
function trimTo(list, n) {
  const out = [...list];
  while (out.length > n) {
    const cnt = {};
    out.forEach((p) => { cnt[p.type] = (cnt[p.type] || 0) + 1; });
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    for (let i = out.length - 1; i >= 0; i--) if (out[i].type === top) { out.splice(i, 1); break; }
  }
  return out;
}

function applyView() {
  $$('[data-view-sel]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewSel === view)));
  $$('.sheet-group').forEach((g) => { g.hidden = view !== 'both' && g.dataset.group !== view; });
}

function fit() {
  const sh = $('#sheets');
  const avail = sh.clientWidth;
  if (!avail) return;
  sh.style.zoom = Math.min(1, avail / (210 * MM + 2));
}

/* ---------------- история (IndexedDB) ---------------- */
let journal = [];
let dbOk = true;
let openGrade = null;
let gradeDraft = null;

function sheetSignature() { return seed + '|' + probs.map((p) => p.key).join(';'); }
const isSelected = () => probs.length > 0 && journal.some((j) => j.sig === sheetSignature());

async function loadJournal() {
  try {
    journal = await db.all();
    // еднократно пренасяне от старото localStorage хранилище
    const legacy = store.get(LEGACY_JOURNAL_KEY, null);
    if (Array.isArray(legacy) && legacy.length) {
      for (const j of legacy) if (!journal.some((x) => x.id === j.id)) { await db.put(j); journal.push(j); }
      try { localStorage.removeItem(LEGACY_JOURNAL_KEY); } catch { /* недостъпно */ }
    }
  } catch {
    dbOk = false;
    journal = [];
  }
  journal.sort((a, b) => b.created.localeCompare(a.created));
}

async function persist(entry) {
  if (!dbOk) return;
  try { await db.put(entry); } catch { dbOk = false; toast('Историята не може да се запише в този браузър'); }
}

// избира текущия лист: влиза в историята (ако още го няма)
async function selectSheet() {
  if (!probs.length) return null;
  const sig = sheetSignature();
  const existing = journal.find((j) => j.sig === sig);
  if (existing) return existing;
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sig, seed, title: cfg.title, created: new Date().toISOString(),
    level: cfg.level, levelCustom: !!cfg.levelCustom,
    cfg: clone(cfg),
    problems: probs.map((p) => ({ type: p.type, expr: p.expr, answer: p.answer, tags: p.tags })),
    result: null,
  };
  journal.unshift(entry);
  await persist(entry);
  // молим браузъра да не изтрива историята при недостиг на място
  try { await navigator.storage?.persist?.(); } catch { /* по избор */ }
  updatePending();
  return entry;
}

function updateSelectedUI() {
  const sel = isSelected();
  const b = $('#printBtn');
  $('.lbl', b).textContent = sel ? 'Печатай отново' : 'Избери и печатай';
  $('#selChip').hidden = !sel;
}

function updatePending() {
  const n = journal.filter((j) => !j.result).length;
  const c = $('#pendingCount');
  c.hidden = !n;
  c.textContent = n;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });

function dominantColor(j) {
  const cnt = {};
  j.problems.forEach((p) => { cnt[p.type] = (cnt[p.type] || 0) + 1; });
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  return { top, types: Object.keys(cnt) };
}

function renderJournal() {
  const list = $('#journalList');
  if (!journal.length) {
    list.innerHTML = `<div class="empty">${sticker('plus', 'var(--yellow)', 56)}<strong>Историята е празна</strong><span>Генерирай лист, докато ти хареса, и натисни „Избери и печатай“. Листът влиза тук, а след решаването отбелязваш грешките.</span><button type="button" class="btn yellow" data-nav="gen">Към новия лист</button></div>`;
    return;
  }
  list.innerHTML = journal.map((j) => {
    const { top, types } = dominantColor(j);
    const total = j.problems.length;
    const r = j.result;
    let pill, next = '';
    if (!r) pill = '<span class="pill wait">Чака проверка</span>';
    else {
      pill = `<span class="pill ${r.ok / total >= 0.9 ? 'good' : r.ok / total >= 0.7 ? 'wait' : 'mid'}">✓ ${r.ok} верни · ✗ ${r.errors} грешни</span>`;
      next = `<div class="jnext"><span>Следващият лист: <b>ниво ${r.next}</b> – ${levelWord(j.level || r.next, r.next)}</span><button type="button" class="btn yellow small" data-next="${j.id}">Направи го</button></div>`;
    }
    const open = openGrade === j.id;
    return `<article class="jcard" style="--c:${CHROME_COLORS[top]}">
      <div class="jhead">
        <div class="jtitle">
          <h3>${esc(j.title)}</h3>
          <div class="jmeta"><span class="code-chip">Лист ${esc(j.seed)}</span><span>${fmtDate(j.created)}</span><span>${total} задачи</span><span>Ниво ${j.level ?? '–'}${j.levelCustom ? ' (ръчно)' : ''}</span><span class="mix-dots">${types.map((t) => `<i style="--c:${CHROME_COLORS[t]}" title="${TYPE_NAME[t]}"></i>`).join('')}</span>${r?.minutes ? `<span>${r.minutes} мин</span>` : ''}</div>
        </div>
        ${pill}
        <div class="actions">
          <button type="button" class="btn ghost small" data-reopen="${j.id}">Отвори</button>
          <button type="button" class="btn ${r ? 'ghost' : 'ink'} small" data-grade="${j.id}" aria-expanded="${open}">${r ? 'Промени проверката' : 'Провери'}</button>
          <button type="button" class="btn ghost small" data-del="${j.id}" aria-label="Премахни лист ${esc(j.seed)}">Премахни</button>
        </div>
      </div>
      ${open ? gradeHTML(j) : next}
    </article>`;
  }).join('');
}

function gradeCounts(j) {
  const errors = gradeDraft.wrong.length;
  return `<b>✓ ${j.problems.length - errors}</b> верни · <b>✗ ${errors}</b> грешни`;
}

function gradeHTML(j) {
  const wrong = new Set(gradeDraft.wrong);
  return `<div class="grade">
    <p>Натисни задачите със грешка. Отбележи и тези с верен отговор, но без стъпки.</p>
    <div class="gprobs">${j.problems.map((p, i) => `<button type="button" class="gp" data-gp="${i}" aria-pressed="${wrong.has(i)}"><span class="mk">${wrong.has(i) ? '✗' : '✓'}</span><span class="ex">${i + 1}. ${esc(p.expr)} = ${esc(p.answer)}</span></button>`).join('')}</div>
    <div class="grade-foot">
      <span class="gcount" id="gCount">${gradeCounts(j)}</span>
      <label class="chk" for="gMin">Време <input class="num sm" id="gMin" type="number" min="0" max="300" value="${gradeDraft.minutes ?? ''}"> мин</label>
      <div class="actions">
        <button type="button" class="btn ghost small" data-cancel>Отказ</button>
        <button type="button" class="btn ink small" data-save-grade="${j.id}">Запази проверката</button>
      </div>
    </div>
  </div>`;
}

function loadSheet(j, opts = {}) {
  cfg = merge(clone(BASE), j.cfg);
  delete cfg.seed; delete cfg.preset;
  if (opts.level) { applyLevel(cfg, opts.level); cfg.focus = []; seed = newCode(); }
  else seed = j.seed;
  activePreset = null;
  bannerDismissed = !!opts.level;
  buildConfig();
  save();
  go('gen');
}

function wireJournal() {
  $('#journalList').addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const find = (id) => journal.find((x) => x.id === id);
    if (t.dataset.grade) {
      const j = find(t.dataset.grade);
      if (openGrade === j.id) openGrade = null;
      else { openGrade = j.id; gradeDraft = { wrong: [...(j.result?.wrong || [])], minutes: j.result?.minutes ?? null }; }
      renderJournal();
    } else if (t.dataset.gp !== undefined) {
      const i = Number(t.dataset.gp);
      const s = new Set(gradeDraft.wrong);
      if (s.has(i)) s.delete(i); else s.add(i);
      gradeDraft.wrong = [...s].sort((a, b) => a - b);
      t.setAttribute('aria-pressed', String(s.has(i)));
      $('.mk', t).textContent = s.has(i) ? '✗' : '✓';
      $('#gCount').innerHTML = gradeCounts(find(openGrade));
    } else if (t.hasAttribute('data-cancel')) {
      openGrade = null; renderJournal();
    } else if (t.dataset.saveGrade) {
      const j = find(t.dataset.saveGrade);
      const m = parseInt($('#gMin').value, 10);
      const total = j.problems.length;
      const errors = gradeDraft.wrong.length;
      const acc = (total - errors) / total;
      j.result = {
        wrong: gradeDraft.wrong, ok: total - errors, errors, acc,
        minutes: Number.isNaN(m) ? null : m, at: new Date().toISOString(),
        next: nextLevel(j.level || 5, acc),
      };
      await persist(j);
      openGrade = null;
      bannerDismissed = false;
      updatePending();
      renderJournal();
      toast(`Записано: ${j.result.ok} верни, ${errors} грешни`);
    } else if (t.dataset.next) {
      const j = find(t.dataset.next);
      loadSheet(j, { level: j.result.next });
    } else if (t.dataset.reopen) {
      loadSheet(find(t.dataset.reopen));
    } else if (t.dataset.del) {
      if (t.dataset.armed) {
        journal = journal.filter((x) => x.id !== t.dataset.del);
        if (dbOk) { try { await db.del(t.dataset.del); } catch { /* вече го няма */ } }
        updatePending();
        renderJournal();
      } else {
        t.dataset.armed = '1';
        t.textContent = 'Сигурно ли?';
        setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = 'Премахни'; } }, 3000);
      }
    }
  });
}

/* ---------------- напредък и предложения ---------------- */
function stats() {
  const graded = journal.filter((j) => j.result);
  const byType = {}, bySkill = {};
  let total = 0, wrongAll = 0, minutes = 0;
  for (const j of graded) {
    const wrong = new Set(j.result.wrong);
    minutes += j.result.minutes || 0;
    j.problems.forEach((p, i) => {
      const ok = !wrong.has(i);
      total++; if (!ok) wrongAll++;
      const t = (byType[p.type] ??= { n: 0, ok: 0 }); t.n++; if (ok) t.ok++;
      for (const tg of p.tags || []) { const s = (bySkill[tg] ??= { n: 0, ok: 0 }); s.n++; if (ok) s.ok++; }
    });
  }
  return { graded, total, wrongAll, minutes, byType, bySkill };
}

function suggestion(st) {
  const skills = Object.entries(st.bySkill).filter(([k, s]) => SKILLS[k] && s.n >= 2).map(([k, s]) => ({ k, acc: s.ok / s.n, n: s.n }));
  const weak = skills.filter((s) => s.acc < 0.85).sort((a, b) => a.acc - b.acc).slice(0, 3);
  if (weak.length) return { kind: 'weak', weak };
  if (st.total >= 10) return { kind: 'harder' };
  return { kind: 'more' };
}

function donut(byType) {
  const types = Object.keys(byType);
  const total = types.reduce((s, t) => s + byType[t].n, 0);
  const R = 62, C = 2 * Math.PI * R;
  let off = 0;
  const segs = types.map((t) => {
    const frac = byType[t].n / total;
    const gap = types.length > 1 ? 4 : 0;
    const s = `<circle cx="84" cy="84" r="${R}" fill="none" stroke="${CHROME_COLORS[t]}" stroke-width="20" stroke-linecap="round" stroke-dasharray="${Math.max(0.1, frac * C - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 84 84)"/>`;
    off += frac * C;
    return s;
  }).join('');
  const ok = types.reduce((s, t) => s + byType[t].ok, 0);
  return `<svg class="donut" viewBox="0 0 168 168" role="img" aria-label="Решени задачи по вид">
    <circle cx="84" cy="84" r="${R}" fill="none" stroke="var(--chip)" stroke-width="20"/>${segs}
    <text x="84" y="84" text-anchor="middle" style="font:700 30px var(--f-display);fill:var(--fg)">${Math.round((ok / total) * 100)}%</text>
    <text x="84" y="106" text-anchor="middle" style="font:500 12px var(--f-body);fill:var(--muted)">вярно</text>
  </svg>`;
}

function renderProgress() {
  const st = stats();
  const body = $('#progressBody');
  if (!st.graded.length) {
    body.innerHTML = `<div class="empty">${sticker('divide', 'var(--navy)', 56)}<strong>Още няма проверени листове</strong><span>Отвори историята и отбележи грешките на поне един решен лист. Тогава тук ще видиш силните и слабите места.</span><button type="button" class="btn yellow" data-nav="journal">Към историята</button></div>`;
    return;
  }
  const acc = Math.round(((st.total - st.wrongAll) / st.total) * 100);
  const sug = suggestion(st);
  const skillRows = Object.entries(st.bySkill).filter(([k]) => SKILLS[k])
    .map(([k, s]) => ({ k, acc: s.ok / s.n, n: s.n })).sort((a, b) => a.acc - b.acc);
  let sugBody;
  if (sug.kind === 'weak') {
    sugBody = `<p>Най-много грешки има при:</p><ul>${sug.weak.map((w) => `<li>${SKILLS[w.k].name} – ${Math.round(w.acc * 100)}% вярно от ${w.n} задачи</li>`).join('')}</ul>
      <p>Следващият лист ще е с повече задачи от тези видове, а половината от тях ще упражняват точно тези стъпки.</p>
      <div><button type="button" class="btn yellow" id="sugGo">Направи такъв лист</button></div>`;
  } else if (sug.kind === 'harder') {
    sugBody = `<p>Всички видове задачи вървят над 85% вярно. Време е за по-големи числа.</p><div><button type="button" class="btn yellow" id="sugGo">Лист с по-големи числа</button></div>`;
  } else {
    sugBody = `<p>Още са малко проверените задачи. Реши и провери още един-два листа, за да има надеждно предложение.</p><div><button type="button" class="btn yellow" data-nav="gen">Към новия лист</button></div>`;
  }
  body.innerHTML = `<div class="rows">
    <div class="tiles">
      <div class="tile"><div class="v">${st.graded.length}</div><div class="k">проверени листа</div></div>
      <div class="tile"><div class="v">${st.total}</div><div class="k">решени задачи</div></div>
      <div class="tile"><div class="v">${acc}%</div><div class="k">вярно общо</div></div>
      <div class="tile"><div class="v">${st.minutes ? Math.round((st.minutes / st.total) * 60) + ' сек' : '–'}</div><div class="k">средно за задача</div></div>
    </div>
    <div class="prog">
      <div class="rows">
        <div class="panel">
          <h2>По вид задачи</h2>
          <div class="donut-wrap">${donut(st.byType)}
            <div class="legend">${Object.entries(st.byType).map(([t, s]) => `<div class="lg" style="--c:${CHROME_COLORS[t]}"><i></i><span>${TYPE_NAME[t]}</span><span class="p">${s.ok}/${s.n} · ${Math.round((s.ok / s.n) * 100)}%</span></div>`).join('')}</div>
          </div>
        </div>
        <div class="panel">
          <h2>Умения</h2>
          <div class="skills">${skillRows.map((s) => `<div class="sk ${s.acc < 0.85 ? 'weak' : ''}" style="--c:${s.acc < 0.6 ? 'var(--coral)' : s.acc < 0.85 ? 'var(--yellow)' : 'var(--green)'}"><span class="n">${SKILLS[s.k].name}</span><span class="p">${Math.round(s.acc * 100)}% · ${s.n} задачи</span><div class="bar"><i style="width:${Math.max(3, s.acc * 100)}%"></i></div></div>`).join('')}</div>
        </div>
      </div>
      <div class="panel suggest"><h2>Предложение за следващия лист</h2>${sugBody}</div>
    </div>
  </div>`;
  const go2 = $('#sugGo');
  if (go2) go2.addEventListener('click', () => applySuggestion(sug));
}

function applySuggestion(sug) {
  const last = journal.find((j) => j.result) || journal[0];
  cfg = merge(clone(BASE), last ? last.cfg : {});
  if (sug.kind === 'weak') {
    const weakTypes = new Set(sug.weak.map((w) => SKILLS[w.k].type));
    for (const t of TYPES) {
      if (weakTypes.has(t)) { cfg[t].on = true; cfg[t].n = Math.max(cfg[t].n, 5); }
      else if (cfg[t].on) cfg[t].n = Math.min(cfg[t].n, 2);
    }
    const f = sug.weak.map((w) => w.k);
    if (f.includes('add-carry')) cfg.add.noCarry = false;
    if (f.includes('sub-borrow') || f.includes('sub-zero')) cfg.sub.noCarry = false;
    if (f.includes('sub-neg')) cfg.sub.neg = true;
    if (f.includes('div-rem')) cfg.div.rem = true;
    if (f.includes('mul-multi')) cfg.mul.bMax = Math.max(cfg.mul.bMax, 99);
    if (f.includes('mix-paren')) cfg.mix.paren = true;
    cfg.focus = f;
  } else {
    const up = (v) => Math.min(99999, v * 10 + 9);
    if (cfg.add.on) cfg.add.max = up(cfg.add.max);
    if (cfg.sub.on) { cfg.sub.aMax = up(cfg.sub.aMax); cfg.sub.bMax = up(cfg.sub.bMax); }
    if (cfg.mul.on) cfg.mul.aMax = up(cfg.mul.aMax);
    if (cfg.div.on) cfg.div.aMax = up(cfg.div.aMax);
    cfg.focus = [];
  }
  seed = newCode();
  activePreset = null;
  buildConfig();
  save();
  go('gen');
}

/* ---------------- навигация и общи ---------------- */
function go(v) {
  $$('[data-view]').forEach((s) => { s.hidden = s.dataset.view !== v; });
  $$('.nav [data-nav]').forEach((b) => { if (b.dataset.nav === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (v === 'gen') render();
  if (v === 'journal') renderJournal();
  if (v === 'progress') renderProgress();
  window.scrollTo({ top: 0 });
}

let toastEl;
function toast(msg) {
  if (!toastEl) {
    toastEl = el('<div class="toast" role="status" aria-live="polite"></div>');
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

async function init() {
  $('#brandStk').innerHTML = sticker('plus', 'var(--yellow)', 40) + sticker('minus', 'var(--coral)', 36) + sticker('times', 'var(--green)', 38) + sticker('divide', 'var(--navy)', 34);
  await loadJournal();
  buildConfig();
  wireConfig();
  wireJournal();
  updatePending();

  document.addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]');
    if (n) go(n.dataset.nav);
    const vs = e.target.closest('[data-view-sel]');
    if (vs) { view = vs.dataset.viewSel; applyView(); }
  });
  $('#newSheet').addEventListener('click', () => { seed = newCode(); save(); render(); });
  $('#printBtn').addEventListener('click', async () => {
    const fresh = !isSelected();
    const entry = await selectSheet();
    updateSelectedUI();
    if (entry && fresh) toast(`Лист ${entry.seed} е избран и записан в историята`);
    window.print();
  });
  $('#seed').addEventListener('change', (e) => {
    const v = e.target.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v) { seed = v; save(); render(); } else e.target.value = seed;
  });
  window.addEventListener('resize', fit);
  render();
  save();
  // след зареждане на шрифтовете височините се променят, затова страниците се преподреждат
  if (document.fonts) document.fonts.ready.then(() => { if (!$('[data-view="gen"]').hidden) render(); });
}

init();
