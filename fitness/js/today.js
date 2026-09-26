'use strict';
// Today dashboard: calories, macros, water, recovery check-in, streaks, today's workout.

const A = {};   // click actions: data-act
const F = {};   // form submits: data-form
const I = {};   // input handlers: data-input
const V = {};   // views

V.today = () => {
  const k = today(), t = dayTotals(k), T = S.targets;
  let html = '';

  if (!S.profile.setupDone) {
    html += `<div class="card"><h2>Welcome</h2><p class="muted">Set your profile first so calorie and macro targets are tailored to you. Then add an AI key if you want to log food by chat.</p><button class="btn primary block" data-act="go" data-arg="settings">Set up profile &amp; targets</button></div>`;
  }

  // calories ring
  const pct = T.kcal ? clamp(t.kcal / T.kcal, 0, 1) : 0, R = 48, C = 2 * Math.PI * R;
  const left = T.kcal - t.kcal;
  html += `<div class="card"><h2>Calories <button class="btn sm ghost" data-act="go" data-arg="food">Log food</button></h2>
    <div class="ring"><svg viewBox="0 0 116 116"><circle cx="58" cy="58" r="${R}" stroke="var(--surface-2)" stroke-width="12"/>
    <circle cx="58" cy="58" r="${R}" stroke="${left < 0 ? 'var(--bad)' : 'var(--accent)'}" stroke-width="12" stroke-dasharray="${C * pct} ${C}" transform="rotate(-90 58 58)"/>
    <text x="58" y="56" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text)" stroke="none">${r0(Math.abs(left))}</text>
    <text x="58" y="74" text-anchor="middle" font-size="11" fill="var(--muted)" stroke="none">${left < 0 ? 'kcal over' : 'kcal left'}</text></svg>
    <div class="grow"><div class="num"><b>${r0(t.kcal)}</b> <span class="muted">/ ${T.kcal} kcal eaten</span></div><div style="height:8px"></div>
    ${macroBar('Protein', t.p, T.protein, 'var(--protein)')}${macroBar('Carbs', t.c, T.carbs, 'var(--carbs)')}${macroBar('Fat', t.f, T.fat, 'var(--fat)')}</div></div></div>`;

  // today's workout
  html += todayWorkoutCard(k);

  // water
  const w = waterTotal(k), wp = T.waterMl ? clamp(w / T.waterMl, 0, 1) * 100 : 0;
  html += `<div class="card"><h2>Water <span class="num muted small">${(w / 1000).toFixed(2)} / ${(T.waterMl / 1000).toFixed(1)} L</span></h2>
    <div class="bar" style="height:12px;margin-bottom:10px"><i style="width:${wp}%;background:var(--accent)"></i></div>
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
  if (!plan) return `<div class="card"><h2>Training</h2><p class="muted small">Answer a few questions and get a weekly plan built around your goals.</p><button class="btn block" data-act="go" data-arg="train">Build my plan</button></div>`;
  const di = weekdayIdx(k), day = plan.days[di];
  const done = S.workouts.filter(w => w.date === k);
  if (S.activeWorkout) return `<div class="card"><h2>Workout in progress</h2><p class="small muted">${esc(S.activeWorkout.title)}</p><button class="btn primary block" data-act="resumeWorkout">Resume</button></div>`;
  if (done.length) return `<div class="card"><h2>Training <span class="tag good">Done</span></h2><p class="small">${done.map(w => esc(w.title)).join(', ')}: ${done.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter(s => s.done).length, 0), 0)} set(s) logged.</p></div>`;
  if (!day || !day.exercises?.length) return `<div class="card"><h2>Training <span class="tag">Rest day</span></h2><p class="small muted">${esc(day?.cardio || 'Recover: walk, stretch, sleep.')}</p></div>`;
  const r = readiness(S.recovery[k]);
  return `<div class="card"><h2>${esc(day.title)} <span class="tag accent">Today</span></h2>
    <p class="small muted">${day.exercises.map(e => esc(e.name)).join(' · ')}</p>
    ${r != null && r < 55 ? '<p class="small" style="color:var(--warn)">Readiness is low today. Consider dropping a set per exercise or keeping 3+ reps in reserve.</p>' : ''}
    <button class="btn primary block" data-act="startWorkout" data-arg="${di}">Start workout</button></div>`;
}

function streaksCard() {
  const T = S.targets;
  const logged = streak(k => dayFood(k).length > 0);
  const protein = streak(k => dayTotals(k).p >= T.protein * 0.95);
  const cals = streak(k => { const c = dayTotals(k).kcal; return c > 0 && Math.abs(c - T.kcal) <= T.kcal * 0.1; });
  const water = streak(k => waterTotal(k) >= T.waterMl);
  const ws = weekStart(today());
  const planned = S.training.plan ? S.training.plan.days.filter(d => d.exercises?.length).length : 0;
  const doneWeek = new Set(S.workouts.filter(w => w.date >= ws).map(w => w.date)).size;
  const s = (v, l) => `<div class="stat streak"><div class="v num">${v}</div><div class="l">${l}</div></div>`;
  return `<div class="card"><h2>Streaks</h2><div class="grid3">${s(protein, 'days protein hit')}${s(cals, 'days kcal ±10%')}${s(water, 'days water hit')}${s(logged, 'days logged')}${s(`${doneWeek}/${planned || '–'}`, 'sessions this week')}${s(checkinDue() ? 'Due' : 'OK', 'weekly check-in')}</div></div>`;
}

function recoveryCard(k) {
  const r = S.recovery[k];
  if (r && !ui.editRecovery) {
    const sc = readiness(r), [lab, cls] = readinessLabel(sc);
    return `<div class="card"><h2>Recovery <button class="btn sm ghost" data-act="editRecovery">Edit</button></h2>
      <div class="row between"><div><div class="big num">${sc}</div><div class="small muted">readiness / 100</div></div><span class="tag ${cls}" style="${cls === 'warn' ? 'color:var(--warn)' : ''}">${lab}</span></div>
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
