'use strict';
// Shared state, storage and helpers. All data lives on the device (localStorage + IndexedDB for photos).

const KEY = 'fitlog.v1';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const DEFAULT_STATE = () => ({
  profile: { sex: 'female', age: 25, heightCm: 165, activity: 1.55, goal: 'maintain', rateKg: 0.25, goalWeight: null, setupDone: false },
  targets: { kcal: 2000, protein: 120, carbs: 220, fat: 65, waterMl: 2500 },
  theme: 'light',
  ai: { provider: 'anthropic', anthropicKey: '', anthropicModel: 'claude-opus-5', openaiKey: '', openaiModel: 'gpt-5' },
  food: {},          // { 'YYYY-MM-DD': [{id,name,qty,meal,kcal,p,c,f}] }
  savedFoods: [],    // favourites
  chat: [],          // AI nutrition chat
  training: { questionnaire: null, plan: null, createdAt: null, checkins: [] },
  workouts: [],      // finished sessions
  activeWorkout: null,
  mealPlan: null,    // { prefs, days:[{day, meals:[...]}] }
  mealPrefs: null,
  grocery: { items: [], builtAt: null },
  weights: [],       // [{date, kg}]
  measurements: [],  // [{date, waist, hips, chest, arm, thigh, neck, bf}]
  water: {},         // { date: [ml, ml] }
  recovery: {},      // { date: {sleepH, sleepQ, soreness, energy, stress, notes} }
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE();
    const d = DEFAULT_STATE();
    const s = JSON.parse(raw);
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    for (const k of ['profile', 'targets', 'ai', 'training']) s[k] = Object.assign(d[k], s[k]);
    return s;
  } catch (e) {
    console.error(e);
    return DEFAULT_STATE();
  }
}

let S = load();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Storage full: export a backup and clear old chat'); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

// UI state (not persisted)
const ui = {
  tab: 'today', foodDate: null, foodSub: 'log', trainSub: 'plan', mealSub: 'plan', bodySub: 'weight',
  mealDay: null, q: null, qStep: 0, busy: false, chartRange: 90, progressEx: null, pendingImage: null,
  compare: [],
};

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Local-time date keys (never toISOString: that's UTC and shifts the day in Australia)
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dkey();
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const weekdayIdx = k => (parseKey(k).getDay() + 6) % 7; // Mon = 0
const weekStart = k => addDays(k, -weekdayIdx(k));
const fmtDate = (k, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => parseKey(k).toLocaleDateString('en-AU', opts);
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'Breakfast';
  if (h < 15) return 'Lunch';
  if (h < 21) return 'Dinner';
  return 'Snacks';
}

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

function openModal(html) {
  $('#sheet').innerHTML = html;
  $('#modal').hidden = false;
  const first = $('#sheet input, #sheet textarea, #sheet select');
  if (first && !first.dataset.nofocus) setTimeout(() => first.focus(), 50);
}
function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; }

function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}

// ---------- blob characters ----------
const BLOBS = [
  'M52 8c20 0 38 12 40 34s-8 44-30 48S14 86 10 62 26 8 52 8z',
  'M30 14c14-10 34-6 42 6 10 2 22 14 18 30 6 14-2 32-20 36-12 10-34 8-44-4C12 76 6 58 14 44 10 30 18 18 30 14z',
  'M50 10c12 0 20 8 22 16 12 0 22 10 20 24 8 10 2 28-14 30-6 12-26 14-36 6-14 4-30-4-30-20C2 58 4 40 16 34 14 20 30 10 50 10z',
  'M48 6c26-2 44 20 42 44-2 26-22 44-46 42C20 90 6 70 8 46 10 22 26 8 48 6z',
];
function blob(color = 'var(--yellow)', v = 0, cls = '') {
  return `<svg class="blob ${cls}" viewBox="0 0 100 100" aria-hidden="true"><g class="wob"><path d="${BLOBS[v % BLOBS.length]}" fill="${color}" stroke="none"/>
    <ellipse class="eye" cx="42" cy="46" rx="4.2" ry="5.8" fill="#111" stroke="none"/><ellipse class="eye" cx="59" cy="46" rx="4.2" ry="5.8" fill="#111" stroke="none"/></g></svg>`;
}
const PASTELS = ['yellow', 'pink', 'mint', 'blue'];
function emptyState(text, color = 'var(--surface-2)', v = 3) { return `<div class="empty">${blob(color, v)}${text}</div>`; }
function applyTheme() {
  const t = S.theme || 'light';
  document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#161514' : '#f7f3ef');
}

// ---------- domain helpers ----------
function dayFood(k) { return S.food[k] || []; }
function dayTotals(k) {
  return dayFood(k).reduce((t, e) => ({ kcal: t.kcal + num(e.kcal), p: t.p + num(e.p), c: t.c + num(e.c), f: t.f + num(e.f) }), { kcal: 0, p: 0, c: 0, f: 0 });
}
function addFood(k, entry) {
  (S.food[k] = S.food[k] || []).push({ id: uid(), meal: defaultMeal(), qty: '', ...entry,
    kcal: r0(num(entry.kcal)), p: r1(num(entry.p)), c: r1(num(entry.c)), f: r1(num(entry.f)) });
}
function waterTotal(k) { return (S.water[k] || []).reduce((a, b) => a + b, 0); }

function sortedWeights() { return [...S.weights].sort((a, b) => a.date.localeCompare(b.date)); }
function latestWeight() { const w = sortedWeights(); return w.length ? w[w.length - 1].kg : null; }
function avgWeight(endKey, days) {
  const start = addDays(endKey, -(days - 1));
  const w = S.weights.filter(x => x.date >= start && x.date <= endKey);
  return w.length ? w.reduce((a, b) => a + b.kg, 0) / w.length : null;
}
// kg per week over the last n days via least squares
function weightRate(days = 28) {
  const end = today(), start = addDays(end, -days);
  const pts = S.weights.filter(w => w.date >= start).map(w => [daysBetween(start, w.date), w.kg]);
  if (pts.length < 3) return null;
  const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const den = n * sxx - sx * sx;
  if (!den) return null;
  return ((n * sxy - sx * sy) / den) * 7;
}

const e1rm = (w, r) => (r > 0 && w > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0);

function lastSetsFor(name, beforeDate) {
  const n = name.trim().toLowerCase();
  const ws = S.workouts.filter(w => !beforeDate || w.date <= beforeDate).sort((a, b) => b.finishedAt - a.finishedAt);
  for (const w of ws) {
    const ex = w.exercises.find(e => e.name.trim().toLowerCase() === n);
    if (ex && ex.sets.some(s => s.done)) return { date: w.date, sets: ex.sets.filter(s => s.done) };
  }
  return null;
}

function readiness(r) {
  if (!r) return null;
  const sleep = clamp(num(r.sleepH) / 8, 0, 1) * 25;
  return r0(sleep + (num(r.sleepQ, 3) / 5) * 20 + (num(r.energy, 3) / 5) * 20 + ((6 - num(r.soreness, 3)) / 5) * 20 + ((6 - num(r.stress, 3)) / 5) * 15);
}
function readinessLabel(score) {
  if (score >= 75) return ['Good to push', 'good'];
  if (score >= 55) return ['Train as planned', ''];
  return ['Consider a lighter session', 'warn'];
}

// Streak = consecutive days meeting a condition, counting back from today
// (today only counts once it's met, so an unfinished day doesn't break the streak).
function streak(test) {
  let k = today(), n = 0;
  if (!test(k)) k = addDays(k, -1);
  for (let i = 0; i < 730 && test(k); i++) { n++; k = addDays(k, -1); }
  return n;
}

// ---------- photos (IndexedDB) ----------
const photoDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const req = indexedDB.open('fitlog-photos', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => rej(req.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode);
      const out = fn(t.objectStore('photos'));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
      t.onerror = () => rej(t.error);
    });
  },
  put(p) { return this.tx('readwrite', s => s.put(p)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
  all() { return this.tx('readonly', s => s.getAll()); },
};

function resizeImage(file, maxDim = 1080, quality = 0.8) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read image')); };
    img.src = url;
  });
}

// ---------- charts (inline SVG, tap/hover tooltip) ----------
const charts = {};
function lineChart(id, series, { unit = '', height = 180, target = null } = {}) {
  // series: [{name, color, points:[{x (ms), y, label}], dots, width}]
  const all = series.flatMap(s => s.points);
  if (all.length < 2) return emptyState('Log at least two entries to see a chart.', 'var(--blue)', 1);
  const W = 600, H = height, pl = 40, pr = 12, pt = 12, pb = 24;
  let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x));
  let ys = all.map(p => p.y); if (target != null) ys.push(target);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad;
  if (x1 === x0) x1 = x0 + 1;
  const sx = x => pl + ((x - x0) / (x1 - x0)) * (W - pl - pr);
  const sy = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const ticks = 4, grid = [];
  for (let i = 0; i <= ticks; i++) {
    const v = y0 + ((y1 - y0) * i) / ticks, y = sy(v);
    grid.push(`<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 5"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)" stroke="none">${r1(v)}</text>`);
  }
  const d0 = new Date(x0), d1 = new Date(x1);
  const f = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const xl = `<text x="${pl}" y="${H - 6}" font-size="11" fill="var(--muted)" stroke="none">${f(d0)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--muted)" stroke="none">${f(d1)}</text>`;
  const tgt = target != null ? `<line x1="${pl}" x2="${W - pr}" y1="${sy(target)}" y2="${sy(target)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1.5"/>` : '';
  const paths = series.map(s => {
    const pts = s.points.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`);
    const line = s.line === false ? '' : `<polyline points="${pts.join(' ')}" stroke="${s.color}" stroke-width="${s.width || 2}" fill="none"/>`;
    const dots = s.dots ? s.points.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${s.dotR || 4}" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('') : '';
    return line + dots;
  }).join('');
  charts[id] = { series, sx, sy, W, H, unit, pl, pr };
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}${target != null ? '<span>- - target</span>' : ''}</div>` : '';
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series[0].name)} chart">${grid.join('')}${tgt}${xl}${paths}<line class="xhair" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/></svg><div class="tip" hidden></div></div>${legend}`;
}

function chartPointer(e) {
  const el = e.target.closest('.chart');
  if (!el) return;
  const c = charts[el.dataset.chart];
  if (!c) return;
  const svg = el.querySelector('svg'), rect = svg.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * c.W;
  let best = null;
  for (const s of c.series) for (const p of s.points) {
    const d = Math.abs(c.sx(p.x) - px);
    if (!best || d < best.d) best = { d, p, s };
  }
  if (!best) return;
  const x = c.sx(best.p.x);
  const xh = svg.querySelector('.xhair');
  xh.setAttribute('x1', x); xh.setAttribute('x2', x); xh.setAttribute('visibility', 'visible');
  const same = c.series.map(s => s.points.find(p => p.x === best.p.x) ? `${s.name}: ${r1(s.points.find(p => p.x === best.p.x).y)}${c.unit}` : null).filter(Boolean);
  const tip = el.querySelector('.tip');
  tip.hidden = false;
  tip.innerHTML = `<b>${new Date(best.p.x).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</b><br>${esc(same.join(' · '))}${best.p.label ? '<br>' + esc(best.p.label) : ''}`;
  tip.style.left = clamp((x / c.W) * rect.width, 60, rect.width - 60) + 'px';
  tip.style.top = (c.sy(best.p.y) / c.H) * rect.height + 'px';
}
function chartLeave(e) {
  const el = e.target.closest && e.target.closest('.chart');
  if (!el) return;
  el.querySelector('.tip').hidden = true;
  el.querySelector('.xhair').setAttribute('visibility', 'hidden');
}

function barRows(rows, color = 'var(--accent)', unit = '') {
  // horizontal bars: [{label, value, target?}]
  const max = Math.max(1, ...rows.map(r => Math.max(r.value, r.target || 0)));
  return rows.map(r => `<div class="macro"><div class="row between"><span>${esc(r.label)}</span><span class="num muted">${r1(r.value)}${unit}${r.target ? ' / ' + r.target + unit : ''}</span></div><div class="bar"><i style="width:${(r.value / max) * 100}%;background:${color}"></i></div></div>`).join('');
}

function macroBar(label, val, target, color) {
  const pct = target ? clamp((val / target) * 100, 0, 100) : 0;
  return `<div class="macro"><div class="row between"><span><i class="dot" style="background:${color}"></i> ${label}</span><span class="num">${r0(val)} / ${r0(target)} g</span></div><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}
