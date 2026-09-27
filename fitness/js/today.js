'use strict';
// Today dashboard: calories, macros, water, recovery check-in, streaks, today's workout.

const A = {};   // click actions: data-act
const F = {};   // form submits: data-form
const I = {};   // input handlers: data-input
const V = {};   // views

V.today = () => {
  const k = today(), t = dayTotals(k), T = S.targets;
  let html = '';

  const h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const cheer = !S.profile.setupDone ? 'Set up your profile so your targets fit you.'
    : t.kcal === 0 ? "Nothing logged yet. What's first?"
    : t.p >= T.protein * 0.95 ? 'Protein target hit. Nice work.'
    : `${r0(Math.max(0, T.protein - t.p))} g protein to go today.`;
  html += `<div class="card yellow hero"><div class="eyebrow">${fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h2>${hi}.</h2><p>${esc(cheer)}</p>
    ${!S.profile.setupDone ? '<div style="margin-top:14px"><button class="btn primary" data-act="go" data-arg="settings">Set up</button></div>' : ''}${blob('var(--cream)', 0)}</div>`;

  // calories ring
  const pct = T.kcal ? clamp(t.kcal / T.kcal, 0, 1) : 0, R = 48, C = 2 * Math.PI * R;
  const left = T.kcal - t.kcal;
  html += `<div class="card"><h2>Calories <button class="btn sm" data-act="go" data-arg="food">Log food <span class="arrow-dot">→</span></button></h2>
    <div class="ring"><svg viewBox="0 0 116 116"><circle cx="58" cy="58" r="${R}" stroke="var(--surface-2)" stroke-width="13"/>
    <circle class="arc" cx="58" cy="58" r="${R}" stroke="${left < 0 ? 'var(--bad)' : 'var(--ink)'}" stroke-width="13" stroke-dasharray="${C * pct} ${C}" transform="rotate(-90 58 58)"/>
    <text x="58" y="57" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)" stroke="none">${r0(Math.abs(left))}</text>
    <text x="58" y="75" text-anchor="middle" font-size="11" font-weight="700" fill="var(--muted)" stroke="none">${left < 0 ? 'kcal over' : 'kcal left'}</text></svg>
    <div class="grow"><div class="num"><b>${r0(t.kcal)}</b> <span class="muted">/ ${T.kcal} kcal eaten</span></div><div style="height:8px"></div>
    ${macroBar('Protein', t.p, T.protein, 'var(--protein)')}${macroBar('Carbs', t.c, T.carbs, 'var(--carbs)')}${macroBar('Fat', t.f, T.fat, 'var(--fat)')}</div></div></div>`;

  // today's workout
  html += quickLogCard(k, { compact: true });
  html += todayWorkoutCard(k);
  html += planWeekNudge();

  // water
  const w = waterTotal(k), wp = T.waterMl ? clamp(w / T.waterMl, 0, 1) * 100 : 0;
  html += `<div class="card"><h2>Water <span class="num muted small">${(w / 1000).toFixed(2)} / ${(T.waterMl / 1000).toFixed(1)} L</span></h2>
    <div class="bar" style="height:14px;margin-bottom:12px"><i style="width:${wp}%;background:var(--blue)"></i></div>
    <div class="row wrap"><button class="btn sm" data-act="water" data-arg="250">+250 ml</button><button class="btn sm" data-act="water" data-arg="500">+500 ml</button><button class="btn sm" data-act="water" data-arg="750">+750 ml</button><button class="btn sm ghost" data-act="waterUndo" ${w ? '' : 'disabled'}>Undo</button></div></div>`;

  // streaks
  html += streaksCard();

  // recovery
  html += recoveryCard(k);

  // weight quick log
  const hasW = S.weights.some(x => x.date === k);
  html += `<div class="card"><h2>Weight</h2>${hasW
    ? `<div class="row between"><span>Logged today: <b class="num">${S.weights.find(x => x.date === k).kg} kg</b></span><button class="btn sm ghost" data-act="go" data-arg="body">Trend</button></div>`
    : `<form data-form="quickWeight" class="row"><input type="number" name="kg" step="0.1" inputmode="decimal" placeholder="Today's weight (kg)" required><button class="btn primary">Save</button></form>`}</div>`;

  return html;
};

function todayWorkoutCard(k) {
  const plan = S.training.plan;
  if (!plan) return `<div class="card pink hero" style="min-height:0"><div class="eyebrow">Training</div><h2>Build your plan</h2><p class="muted">A few questions, then a week built around your goals.</p><div style="margin-top:14px"><button class="btn primary" data-act="go" data-arg="train">Let's go</button></div>${blob('var(--cream)', 3)}</div>`;
  if (S.activeWorkout) return `<div class="card yellow hero" style="min-height:0"><div class="eyebrow">In progress</div><h2>${esc(S.activeWorkout.title)}</h2><div style="margin-top:14px"><button class="btn primary" data-act="resumeWorkout">Resume</button></div>${blob('var(--blue)', 2)}</div>`;
  const s = scheduleFor(k), done = S.workouts.filter(w => w.date === k);
  const lifted = done.some(w => !w.activity);
  const note = s.note ? `<p class="small" style="margin:4px 0 0">📌 ${esc(s.note)}</p>` : '';
  const acts = activityList(s.activities, 'd' + k, k);
  if (lifted || (done.length && !s.lift && s.activities.every(a => done.some(w => w.title.toLowerCase() === a.name.toLowerCase())))) {
    return `<div class="card mint hero" style="min-height:0"><div class="eyebrow">Training · done ✓</div><h2>Nice work!</h2><p>${done.map(w => w.activity ? `${esc(w.title)} (${w.durationMin} min)` : `${esc(w.title)}: ${w.exercises.reduce((b, e) => b + e.sets.filter(x => x.done).length, 0)} sets`).join(' · ')}</p>${!lifted || !s.activities.length ? '' : `<div style="max-width:78%">${acts}</div>`}${blob('var(--yellow)', 1)}</div>`;
  }
  if (!s.lift && s.activities.length) return `<div class="card blue hero" style="min-height:0"><div class="eyebrow">Today</div><h2>${esc(s.title)}</h2>${note}<div style="max-width:78%">${acts}</div>${blob('var(--mint)', 1)}</div>`;
  if (!s.lift) return `<div class="card mint hero" style="min-height:0"><div class="eyebrow">Training</div><h2>Rest day</h2><p class="muted">${esc(s.cardio || 'Recover: walk, stretch, sleep.')}</p>${note}${blob('var(--cream)', 1)}</div>`;
  const r = readiness(S.recovery[k]), day = s.lift;
  return `<div class="card blue hero" style="min-height:0"><div class="eyebrow">Today's session</div><h2>${esc(day.title)}</h2>
    <p class="muted">${day.exercises.length} exercises · ${day.exercises.reduce((a, e) => a + e.sets, 0)} sets</p>${note}
    ${r != null && r < 55 ? '<p class="small" style="margin-top:6px;max-width:70%">Readiness is low. Drop a set per exercise or keep 3+ reps in reserve.</p>' : ''}
    <div style="margin-top:14px"><button class="btn primary" data-act="startWorkout" data-arg="${s.liftIdx}">Start workout</button></div>${s.activities.length ? `<div style="max-width:78%">${acts}</div>` : ''}${blob('var(--pink)', 2)}</div>`;
}

function planWeekNudge() {
  if (!S.training.plan) return '';
  const ws = weekStart(today()), next = addDays(ws, 7), wd = weekdayIdx(today());
  const target = !weekPlan(ws) && wd <= 1 ? ws : !weekPlan(next) && wd >= 5 ? next : null;
  if (!target) return '';
  return `<div class="card"><div class="row between"><div><div class="eyebrow">${target === ws ? 'This week' : 'Next week'}</div><b>Plan your week around your commitments</b></div><button class="btn sm primary" data-act="planWeek" data-arg="${target}">Plan</button></div></div>`;
}

function streaksCard() {
  const T = S.targets;
  const logged = streak(k => dayFood(k).length > 0);
  const protein = streak(k => dayTotals(k).p >= T.protein * 0.95);
  const cals = streak(k => { const c = dayTotals(k).kcal; return c > 0 && Math.abs(c - T.kcal) <= T.kcal * 0.1; });
  const water = streak(k => waterTotal(k) >= T.waterMl);
  const ws = weekStart(today());
  const planned = S.training.plan ? DAYS.filter((_, i) => { const s = scheduleFor(addDays(ws, i)); return s.lift || s.activities.length; }).length : 0;
  const doneWeek = new Set(S.workouts.filter(w => w.date >= ws).map(w => w.date)).size;
  const s = (v, l, c) => `<div class="stat streak ${c}"><div class="v num">${v}</div><div class="l">${l}</div></div>`;
  return `<div class="card"><h2>Streaks <span class="small muted">🔥 keep it going</span></h2><div class="grid3">${s(protein, 'days protein', 'blue')}${s(cals, 'days on kcal', 'yellow')}${s(water, 'days water', 'mint')}${s(logged, 'days logged', 'pink')}${s(`${doneWeek}/${planned || '–'}`, 'sessions', '')}${s(checkinDue() ? 'Due' : 'OK', 'check-in', '')}</div></div>`;
}

function recoveryCard(k) {
  const r = S.recovery[k];
  if (r && !ui.editRecovery) {
    const sc = readiness(r), [lab, cls] = readinessLabel(sc);
    return `<div class="card"><h2>Recovery <button class="btn sm ghost" data-act="editRecovery">Edit</button></h2>
      <div class="row between"><div><div class="big num">${sc}</div><div class="small muted">readiness / 100</div></div><span class="tag ${cls || 'accent'}">${lab}</span></div>
      <p class="small muted">Sleep ${r.sleepH} h (quality ${r.sleepQ}/5) · energy ${r.energy}/5 · soreness ${r.soreness}/5 · stress ${r.stress}/5</p></div>`;
  }
  const v = r || { sleepH: '', sleepQ: 3, energy: 3, soreness: 2, stress: 3 };
  const scale = (name, label, lo, hi) => `<label class="f"><span>${label} <span class="muted">(1 ${lo}, 5 ${hi})</span></span><div class="chips" data-scale="${name}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="chip ${num(v[name]) === n ? 'on' : ''}" data-act="scale" data-arg="${name}:${n}">${n}</button>`).join('')}</div><input type="hidden" name="${name}" value="${v[name]}"></label>`;
  return `<div class="card"><h2>Sleep &amp; recovery check-in</h2><form data-form="recovery">
    <label class="f"><span>Hours slept</span><input type="number" name="sleepH" step="0.25" inputmode="decimal" value="${v.sleepH}" required></label>
    ${scale('sleepQ', 'Sleep quality', 'poor', 'great')}${scale('energy', 'Energy', 'flat', 'high')}${scale('soreness', 'Muscle soreness', 'none', 'very sore')}${scale('stress', 'Stress', 'calm', 'very stressed')}
    <label class="f"><span>Notes (optional)</span><input type="text" name="notes" value="${esc(v.notes || '')}" placeholder="e.g. night shift, niggle in left knee"></label>
    <button class="btn primary block">Save check-in</button></form></div>`;
}

A.scale = (arg, el) => {
  const [name, n] = arg.split(':');
  const wrap = el.closest('label');
  wrap.querySelector('input').value = n;
  $$('.chip', wrap).forEach(c => c.classList.toggle('on', c === el));
};
A.editRecovery = () => { ui.editRecovery = true; render(); };
F.recovery = d => {
  S.recovery[today()] = { sleepH: num(d.sleepH), sleepQ: num(d.sleepQ), energy: num(d.energy), soreness: num(d.soreness), stress: num(d.stress), notes: d.notes };
  ui.editRecovery = false; save(); render();
};
A.water = arg => { (S.water[today()] = S.water[today()] || []).push(num(arg)); save(); render(); };
A.waterUndo = () => { const a = S.water[today()]; if (a && a.length) a.pop(); save(); render(); };
F.quickWeight = d => { setWeight(today(), num(d.kg)); toast('Weight saved'); render(); };

function setWeight(date, kg) {
  if (!kg) return;
  S.weights = S.weights.filter(w => w.date !== date);
  S.weights.push({ date, kg: r1(kg) });
  save();
}
