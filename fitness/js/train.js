'use strict';
// Training: goal questionnaire -> weekly plan -> workout logger, history, progress, weekly check-ins.

const QUESTIONS = [
  { id: 'goal', q: 'What is your main goal right now?', type: 'one', opts: ['Build muscle', 'Get stronger', 'Lose fat, keep muscle', 'General fitness & health', 'Endurance / running', 'Sport performance'] },
  { id: 'extra', q: 'Anything else you want out of training?', type: 'many', opts: ['Better physique', 'Hit strength numbers', 'Cardio fitness', 'Mobility & flexibility', 'Posture / back health', 'Stress relief', 'Glute focus'] },
  { id: 'experience', q: 'How long have you been lifting consistently?', type: 'one', opts: ['New / under 6 months', '6 months to 2 years', '2+ years'] },
  { id: 'days', q: 'Which days can you usually train?', type: 'many', opts: DAYS, hint: 'Pick the days you can realistically make most weeks.' },
  { id: 'length', q: 'How long can a session be?', type: 'one', opts: ['30 min', '45 min', '60 min', '75 min', '90 min'] },
  { id: 'equipment', q: 'What equipment do you have?', type: 'one', opts: ['Full commercial gym', 'Home: dumbbells + bench', 'Home: barbell, rack, bench', 'Bodyweight only', 'Mostly machines / cables'] },
  { id: 'split', q: 'Any preference on how the week is split?', type: 'one', opts: ['Choose for me', 'Full body', 'Upper / lower', 'Push / pull / legs', 'Body-part split'] },
  { id: 'priority', q: 'Any muscles you want to prioritise?', type: 'many', opts: ['Glutes', 'Quads', 'Hamstrings', 'Back', 'Chest', 'Shoulders', 'Arms', 'Core', 'None in particular'] },
  { id: 'cardio', q: 'How much cardio do you want in the plan?', type: 'one', opts: ['None', '1–2 sessions a week', '3+ sessions a week', 'Just daily steps'] },
  { id: 'lifts', q: 'Current working weights (optional)', type: 'text', hint: 'e.g. squat 60 kg × 5, bench 40 kg × 8, RDL 50 kg × 10, or "not sure".' },
  { id: 'injuries', q: 'Injuries, pain or movements to avoid?', type: 'text', hint: 'e.g. "lower back flares with heavy deadlifts", or leave blank.' },
  { id: 'schedule', q: 'Anything about your schedule or lifestyle?', type: 'text', hint: 'e.g. hospital placements, night shifts, exam blocks, train before 7am.' },
];

V.train = () => {
  if (ui.q) return questionnaireView();
  if (S.activeWorkout) return loggerView();
  if (!S.training.plan) {
    return `<div class="card"><h2>Let's build your plan</h2><p class="muted">I'll ask ${QUESTIONS.length} quick questions about your goals, experience, schedule and equipment, then build a weekly plan around them. ${aiReady() ? 'Your AI coach will write the plan.' : 'Without an AI key a solid template is built from your answers; add a key in Settings for a fully tailored plan.'}</p>
      <button class="btn primary block" data-act="startQ">Start</button></div>
      <div class="card"><h2>Or just log</h2><p class="small muted">Log a session without a plan.</p><button class="btn block" data-act="startWorkout" data-arg="free">Start empty workout</button></div>`;
  }
  let html = `<div class="seg">${[['plan', 'Plan'], ['week', 'This week'], ['history', 'History'], ['progress', 'Progress']].map(([k, l]) => `<button class="${ui.trainSub === k ? 'on' : ''}" data-act="trainSub" data-arg="${k}">${l}</button>`).join('')}</div>`;
  html += ({ plan: planView, week: weekView, history: historyView, progress: progressView })[ui.trainSub]();
  return html;
};

// ---------- questionnaire ----------
function questionnaireView() {
  const q = QUESTIONS[ui.qStep], a = ui.q[q.id];
  let body = '';
  if (q.type === 'one') body = `<div class="chips">${q.opts.map(o => `<button class="chip ${a === o ? 'on' : ''}" data-act="qPick" data-arg="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  else if (q.type === 'many') body = `<div class="chips">${q.opts.map(o => `<button class="chip ${(a || []).includes(o) ? 'on' : ''}" data-act="qToggle" data-arg="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  else body = `<textarea data-input="qText" placeholder="${esc(q.hint || '')}">${esc(a || '')}</textarea>`;
  const last = ui.qStep === QUESTIONS.length - 1;
  return `<div class="progress"><i style="width:${((ui.qStep + 1) / QUESTIONS.length) * 100}%"></i></div>
    <div class="card"><div class="small muted">Question ${ui.qStep + 1} of ${QUESTIONS.length}</div><h2 style="margin-top:6px">${esc(q.q)}</h2>
    ${q.hint && q.type !== 'text' ? `<p class="small muted">${esc(q.hint)}</p>` : ''}${body}</div>
    <div class="row"><button class="btn" data-act="qBack">${ui.qStep ? 'Back' : 'Cancel'}</button><div class="grow"></div>
    ${last ? `<button class="btn primary" data-act="qFinish" id="qFinish">Build my plan</button>` : `<button class="btn primary" data-act="qNext">Next</button>`}</div>`;
}
A.startQ = () => { ui.q = { ...(S.training.questionnaire || {}) }; ui.qStep = 0; render(); };
A.qPick = o => { ui.q[QUESTIONS[ui.qStep].id] = o; A.qNext(); };
A.qToggle = (o, el) => {
  const id = QUESTIONS[ui.qStep].id, arr = ui.q[id] || [];
  ui.q[id] = arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o];
  el.classList.toggle('on');
};
I.qText = el => { ui.q[QUESTIONS[ui.qStep].id] = el.value; };
A.qBack = () => { if (ui.qStep) ui.qStep--; else ui.q = null; render(); };
A.qNext = () => {
  const q = QUESTIONS[ui.qStep];
  if (q.type !== 'text' && (!ui.q[q.id] || (Array.isArray(ui.q[q.id]) && !ui.q[q.id].length))) return toast('Pick at least one');
  ui.qStep = Math.min(ui.qStep + 1, QUESTIONS.length - 1); render(); window.scrollTo(0, 0);
};
A.qFinish = async (_, btn) => {
  const answers = ui.q;
  S.training.questionnaire = answers;
  save();
  let plan = null;
  if (aiReady()) {
    aiBusyButton(btn, true);
    try { plan = await aiPlan(answers); }
    catch (e) { toast(e.message + ' Using a template instead.', 4000); }
    aiBusyButton(btn, false);
  }
  if (!plan) plan = templatePlan(answers);
  S.training.plan = normalisePlan(plan);
  S.training.createdAt = today();
  ui.q = null; ui.trainSub = 'plan'; save(); render();
};

const PLAN_SHAPE = `{"name": "string", "summary": "2-3 sentences on why this plan fits the user", "progression": "how to progress week to week (load/reps/RIR), plain text", "deload": "when/how to deload", "days": [{"day": "Mon", "title": "e.g. Upper A or Rest", "focus": "short", "cardio": "optional cardio/steps note", "exercises": [{"name": "Barbell Back Squat", "muscle": "one of: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, full body, cardio", "sets": 3, "reps": "6-8", "rest": 120, "rir": "2", "notes": "short cue or substitution"}]}]}
"days" must contain exactly 7 entries Mon..Sun in order. Rest days have an empty exercises array.`;

async function aiPlan(answers) {
  const recent = recoverySummary();
  const system = `You are an experienced strength & conditioning coach writing an evidence-based weekly resistance training plan (volume ~10-20 hard sets per muscle per week scaled to experience, compound lifts first, appropriate rep ranges and rest for the goal, progressive overload, exercise choices matched to equipment and injuries). ${userContext()}`;
  const user = `Build my weekly training plan from these answers:\n${JSON.stringify(answers, null, 2)}\n${recent}\nOnly schedule training on the days I said I'm available. Fit each session within my session length including warm-up. JSON shape:\n${PLAN_SHAPE}`;
  return aiJSON(system, [{ role: 'user', content: user }], { effort: 'medium', maxTokens: 16000 });
}

function normalisePlan(p) {
  const days = DAYS.map((d, i) => {
    const src = (p.days || []).find(x => (x.day || '').slice(0, 3).toLowerCase() === d.toLowerCase()) || (p.days || [])[i] || {};
    return {
      day: d, title: src.title || (src.exercises?.length ? 'Session' : 'Rest'), focus: src.focus || '', cardio: src.cardio || '',
      exercises: (src.exercises || []).map(e => ({ name: e.name || 'Exercise', muscle: (e.muscle || '').toLowerCase(), sets: Math.max(1, r0(num(e.sets, 3))), reps: String(e.reps || '8-12'), rest: r0(num(e.rest, 90)), rir: String(e.rir ?? ''), notes: e.notes || '' })),
    };
  });
  return { name: p.name || 'My plan', summary: p.summary || '', progression: p.progression || '', deload: p.deload || '', days };
}

// Template fallback (no AI key)
const LIB = {
  gym: {
    squat: ['Barbell Back Squat', 'quads'], hinge: ['Romanian Deadlift', 'hamstrings'], lunge: ['Walking Lunge', 'quads'], glute: ['Barbell Hip Thrust', 'glutes'],
    legcurl: ['Seated Leg Curl', 'hamstrings'], legext: ['Leg Extension', 'quads'], calf: ['Standing Calf Raise', 'calves'],
    hpush: ['Barbell Bench Press', 'chest'], ipush: ['Incline Dumbbell Press', 'chest'], vpush: ['Seated Dumbbell Shoulder Press', 'shoulders'],
    hpull: ['Chest-Supported Row', 'back'], vpull: ['Lat Pulldown', 'back'], lateral: ['Cable Lateral Raise', 'shoulders'], rear: ['Face Pull', 'shoulders'],
    bi: ['EZ-Bar Curl', 'biceps'], tri: ['Cable Triceps Pushdown', 'triceps'], core: ['Cable Crunch', 'core'],
  },
  db: {
    squat: ['Goblet Squat', 'quads'], hinge: ['Dumbbell Romanian Deadlift', 'hamstrings'], lunge: ['Dumbbell Bulgarian Split Squat', 'quads'], glute: ['Dumbbell Hip Thrust', 'glutes'],
    legcurl: ['Single-Leg Dumbbell RDL', 'hamstrings'], legext: ['Dumbbell Step-Up', 'quads'], calf: ['Single-Leg Calf Raise', 'calves'],
    hpush: ['Dumbbell Bench Press', 'chest'], ipush: ['Incline Dumbbell Press', 'chest'], vpush: ['Seated Dumbbell Shoulder Press', 'shoulders'],
    hpull: ['One-Arm Dumbbell Row', 'back'], vpull: ['Dumbbell Pullover', 'back'], lateral: ['Dumbbell Lateral Raise', 'shoulders'], rear: ['Dumbbell Rear Delt Fly', 'shoulders'],
    bi: ['Dumbbell Curl', 'biceps'], tri: ['Overhead Dumbbell Triceps Extension', 'triceps'], core: ['Dead Bug', 'core'],
  },
  bw: {
    squat: ['Tempo Bodyweight Squat', 'quads'], hinge: ['Single-Leg Hip Hinge', 'hamstrings'], lunge: ['Reverse Lunge', 'quads'], glute: ['Single-Leg Glute Bridge', 'glutes'],
    legcurl: ['Sliding Leg Curl', 'hamstrings'], legext: ['Split Squat', 'quads'], calf: ['Single-Leg Calf Raise', 'calves'],
    hpush: ['Push-Up', 'chest'], ipush: ['Decline Push-Up', 'chest'], vpush: ['Pike Push-Up', 'shoulders'],
    hpull: ['Inverted Row (table/bar)', 'back'], vpull: ['Towel Door Row', 'back'], lateral: ['Band Lateral Raise', 'shoulders'], rear: ['Prone Y-T-W Raise', 'shoulders'],
    bi: ['Chin-Up Hold / Band Curl', 'biceps'], tri: ['Bench Dip', 'triceps'], core: ['Plank', 'core'],
  },
};
function templatePlan(a) {
  const eq = /bodyweight/i.test(a.equipment || '') ? 'bw' : /dumbbell/i.test(a.equipment || '') ? 'db' : 'gym';
  const L = LIB[eq];
  const days = (a.days && a.days.length ? a.days : ['Mon', 'Wed', 'Fri']).slice().sort((x, y) => DAYS.indexOf(x) - DAYS.indexOf(y));
  const n = days.length, strength = /stronger/i.test(a.goal || ''), fat = /fat/i.test(a.goal || '');
  const newbie = /new/i.test(a.experience || '');
  const main = strength ? ['5', 180] : ['6-10', 120], acc = fat ? ['10-15', 60] : ['10-12', 75];
  const ex = (k, compound = true) => ({ name: L[k][0], muscle: L[k][1], sets: newbie ? (compound ? 3 : 2) : (compound ? 4 : 3), reps: compound ? main[0] : acc[0], rest: compound ? main[1] : acc[1], rir: newbie ? '3' : '1-2', notes: '' });
  const glutes = (a.priority || []).includes('Glutes') || (a.extra || []).includes('Glute focus');
  const T = {
    fullA: ['Full Body A', [ex('squat'), ex('hpush'), ex('hpull'), ex(glutes ? 'glute' : 'legcurl', false), ex('lateral', false), ex('core', false)]],
    fullB: ['Full Body B', [ex('hinge'), ex('vpush'), ex('vpull'), ex('lunge', false), ex('bi', false), ex('tri', false)]],
    fullC: ['Full Body C', [ex('glute'), ex('ipush'), ex('hpull'), ex('legext', false), ex('rear', false), ex('calf', false)]],
    upperA: ['Upper A', [ex('hpush'), ex('hpull'), ex('vpush'), ex('vpull', false), ex('lateral', false), ex('tri', false)]],
    lowerA: ['Lower A', [ex('squat'), ex('hinge'), ex('lunge', false), ex('legcurl', false), ex('calf', false), ex('core', false)]],
    upperB: ['Upper B', [ex('ipush'), ex('vpull'), ex('hpull', false), ex('rear', false), ex('bi', false), ex('tri', false)]],
    lowerB: ['Lower B', [ex('hinge'), ex('glute'), ex('legext', false), ex('legcurl', false), ex('calf', false), ex('core', false)]],
    push: ['Push', [ex('hpush'), ex('vpush'), ex('ipush', false), ex('lateral', false), ex('tri', false)]],
    pull: ['Pull', [ex('vpull'), ex('hpull'), ex('rear', false), ex('bi', false), ex('core', false)]],
    legs: ['Legs', [ex('squat'), ex('hinge'), ex('glute', false), ex('legcurl', false), ex('calf', false)]],
  };
  const seq = n <= 3 ? ['fullA', 'fullB', 'fullC'] : n === 4 ? ['upperA', 'lowerA', 'upperB', 'lowerB'] : n === 5 ? ['upperA', 'lowerA', 'push', 'pull', 'legs'] : ['push', 'pull', 'legs', 'upperB', 'lowerB', 'fullA'];
  const cardio = /3\+/.test(a.cardio || '') ? '25–30 min zone 2 cardio' : /1–2/.test(a.cardio || '') ? 'Optional 20–30 min zone 2 cardio' : 'Aim for 8–10k steps';
  return {
    name: `${n}-day ${n <= 3 ? 'full body' : n === 4 ? 'upper/lower' : 'hybrid'} plan`,
    summary: `A ${n}-day template matched to your goal (${a.goal}) and equipment. Add an AI key in Settings and redo setup for a plan tailored to your injuries, priorities and schedule.`,
    progression: `Double progression: when you hit the top of the rep range on all sets at the target RIR, add 2.5 kg (upper) or 5 kg (lower) next session, or one rep if using fixed dumbbells.`,
    deload: 'Every 6–8 weeks, or when performance drops two sessions in a row: halve the sets for one week.',
    days: DAYS.map(d => { const i = days.indexOf(d); if (i < 0) return { day: d, title: 'Rest', exercises: [], cardio }; const [title, exs] = T[seq[i % seq.length]]; return { day: d, title, focus: '', exercises: exs, cardio: '' }; }),
  };
}

// ---------- plan view ----------
function planView() {
  const p = S.training.plan, ti = weekdayIdx(today());
  let html = `<div class="card"><h2>${esc(p.name)}</h2><p class="small">${esc(p.summary)}</p>
    <details><summary>Progression &amp; deload</summary><p>${esc(p.progression)}</p><p>${esc(p.deload)}</p></details>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm ${checkinDue() ? 'primary' : ''}" data-act="checkin">Weekly check-in${checkinDue() ? ' (due)' : ''}</button><button class="btn sm" data-act="startQ">Redo setup</button><button class="btn sm ghost" data-act="startWorkout" data-arg="free">Empty workout</button></div></div>`;
  p.days.forEach((d, i) => {
    html += `<div class="card day-card ${i === ti ? 'today' : ''}"><h2><span>${d.day} · ${esc(d.title)} ${i === ti ? '<span class="tag accent">Today</span>' : ''}</span>
      <span class="row">${d.exercises.length ? `<button class="btn sm primary" data-act="startWorkout" data-arg="${i}">Start</button>` : ''}<button class="btn sm ghost" data-act="editDay" data-arg="${i}">Edit</button></span></h2>
      ${d.focus ? `<div class="small muted">${esc(d.focus)}</div>` : ''}
      ${d.exercises.length ? `<ul class="list">${d.exercises.map(e => `<li><div class="grow"><div>${esc(e.name)}</div><div class="meta">${e.sets} × ${esc(e.reps)}${e.rir ? ` @ ${esc(e.rir)} RIR` : ''} · rest ${e.rest}s${e.notes ? ' · ' + esc(e.notes) : ''}</div></div></li>`).join('')}</ul>` : ''}
      ${d.cardio ? `<div class="small muted" style="margin-top:6px">🏃 ${esc(d.cardio)}</div>` : ''}</div>`;
  });
  return html;
}
A.trainSub = k => { ui.trainSub = k; render(); };

A.editDay = i => {
  const d = S.training.plan.days[+i];
  openModal(`<h2>Edit ${d.day}<button class="x" data-act="close">×</button></h2><form data-form="saveDay"><input type="hidden" name="i" value="${i}">
    <label class="f"><span>Title</span><input type="text" name="title" value="${esc(d.title)}"></label>
    <label class="f"><span>Cardio / notes</span><input type="text" name="cardio" value="${esc(d.cardio)}"></label>
    <p class="small muted">One exercise per line: <b>Name | sets | reps | rest s | muscle</b></p>
    <textarea name="ex" rows="8" style="font-size:14px">${esc(d.exercises.map(e => [e.name, e.sets, e.reps, e.rest, e.muscle].join(' | ')).join('\n'))}</textarea>
    <p class="small muted">Leave empty to make it a rest day.</p><button class="btn primary block">Save</button></form>`);
};
F.saveDay = d => {
  const day = S.training.plan.days[+d.i];
  const old = Object.fromEntries(day.exercises.map(e => [e.name.toLowerCase(), e]));
  day.title = d.title || 'Session'; day.cardio = d.cardio;
  day.exercises = d.ex.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [name, sets, reps, rest, muscle] = l.split('|').map(s => (s || '').trim());
    const o = old[name.toLowerCase()] || {};
    return { name, sets: Math.max(1, r0(num(sets, 3))), reps: reps || '8-12', rest: r0(num(rest, 90)), muscle: (muscle || o.muscle || '').toLowerCase(), rir: o.rir || '', notes: o.notes || '' };
  });
  if (!day.exercises.length) day.title = d.title || 'Rest';
  save(); closeModal(); render();
};

// ---------- workout logger ----------
A.startWorkout = arg => {
  if (S.activeWorkout && !confirm('Discard the workout in progress and start a new one?')) return;
  const plan = S.training.plan;
  const day = arg === 'free' ? null : plan.days[+arg];
  S.activeWorkout = {
    id: uid(), date: today(), startedAt: Date.now(), dayIdx: day ? +arg : null, title: day ? day.title : 'Workout', notes: '',
    exercises: (day ? day.exercises : []).map(e => {
      const last = lastSetsFor(e.name);
      return { name: e.name, muscle: e.muscle, target: `${e.sets} × ${e.reps}${e.rir ? ` @ ${e.rir} RIR` : ''}`, rest: e.rest, notes: e.notes,
        sets: Array.from({ length: e.sets }, (_, j) => ({ w: last?.sets[j]?.w ?? '', r: '', done: false })) };
    }),
  };
  save(); ui.tab = 'train'; render(); window.scrollTo(0, 0);
};
A.resumeWorkout = () => { ui.tab = 'train'; render(); };

function loggerView() {
  const w = S.activeWorkout;
  const mins = r0((Date.now() - w.startedAt) / 60000);
  let html = `<div class="card"><h2><input type="text" value="${esc(w.title)}" data-input="woTitle" style="font-weight:700;font-size:16px"></h2><div class="small muted">${fmtDate(w.date)} · started ${mins} min ago</div></div>`;
  w.exercises.forEach((e, ei) => {
    const last = lastSetsFor(e.name, w.date);
    html += `<div class="card"><h2><span>${esc(e.name)}</span><button class="x" data-act="woDelEx" data-arg="${ei}" aria-label="Remove exercise">×</button></h2>
      <div class="small muted" style="margin-bottom:8px">${e.target ? `Target ${esc(e.target)} · ` : ''}${last ? `Last (${fmtDate(last.date, { day: 'numeric', month: 'short' })}): ${last.sets.map(s => `${s.w}×${s.r}`).join(', ')}` : 'No history yet'}${e.notes ? `<br>${esc(e.notes)}` : ''}</div>
      <div class="setrow small muted"><span class="n">Set</span><span style="text-align:center">kg</span><span style="text-align:center">reps</span><span></span></div>
      ${e.sets.map((s, si) => `<div class="setrow"><span class="n">${si + 1}</span>
        <input type="number" inputmode="decimal" step="0.5" value="${s.w}" placeholder="${last?.sets[si]?.w ?? ''}" data-input="woSet" data-arg="${ei}:${si}:w">
        <input type="number" inputmode="numeric" value="${s.r}" placeholder="${last?.sets[si]?.r ?? ''}" data-input="woSet" data-arg="${ei}:${si}:r">
        <button class="tick ${s.done ? 'on' : ''}" data-act="woTick" data-arg="${ei}:${si}" aria-label="Complete set">✓</button></div>`).join('')}
      <div class="row"><button class="btn sm ghost" data-act="woAddSet" data-arg="${ei}">+ Set</button>${e.sets.length > 1 ? `<button class="btn sm ghost" data-act="woDelSet" data-arg="${ei}">− Set</button>` : ''}</div></div>`;
  });
  html += `<div class="card"><form data-form="woAddEx" class="row"><input type="text" name="name" placeholder="Add exercise" list="exlist" required><button class="btn">Add</button></form>
    <datalist id="exlist">${[...new Set(S.workouts.flatMap(x => x.exercises.map(e => e.name)))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <label class="f" style="margin-top:10px"><span>Session notes</span><textarea data-input="woNotes" placeholder="How did it feel?">${esc(w.notes)}</textarea></label></div>
    <div class="row"><button class="btn danger" data-act="woDiscard">Discard</button><div class="grow"></div><button class="btn primary" data-act="woFinish">Finish workout</button></div>`;
  return html;
}

I.woTitle = el => { S.activeWorkout.title = el.value; saveSoon(); };
I.woNotes = el => { S.activeWorkout.notes = el.value; saveSoon(); };
I.woSet = el => {
  const [ei, si, f] = el.dataset.arg.split(':');
  S.activeWorkout.exercises[+ei].sets[+si][f] = el.value === '' ? '' : num(el.value);
  saveSoon();
};
A.woTick = (arg, el) => {
  const [ei, si] = arg.split(':').map(Number);
  const ex = S.activeWorkout.exercises[ei], s = ex.sets[si];
  // fill blanks from placeholders (last session) when ticking
  const row = el.closest('.setrow'), [wIn, rIn] = $$('input', row);
  if (s.w === '' && wIn.placeholder) s.w = num(wIn.placeholder);
  if (s.r === '' && rIn.placeholder) s.r = num(rIn.placeholder);
  if (!s.done && (s.r === '' || !s.r)) return toast('Enter reps first');
  s.done = !s.done;
  save(); render();
  if (s.done) startRest(ex.rest || 90);
};
A.woAddSet = ei => { const ex = S.activeWorkout.exercises[+ei], l = ex.sets[ex.sets.length - 1]; ex.sets.push({ w: l ? l.w : '', r: '', done: false }); save(); render(); };
A.woDelSet = ei => { S.activeWorkout.exercises[+ei].sets.pop(); save(); render(); };
A.woDelEx = ei => { if (confirm('Remove this exercise?')) { S.activeWorkout.exercises.splice(+ei, 1); save(); render(); } };
F.woAddEx = d => {
  const last = lastSetsFor(d.name);
  const known = S.training.plan?.days.flatMap(x => x.exercises).find(e => e.name.toLowerCase() === d.name.trim().toLowerCase());
  S.activeWorkout.exercises.push({ name: d.name.trim(), muscle: known?.muscle || '', target: '', rest: known?.rest || 90, notes: '', sets: (last ? last.sets : [{}, {}, {}]).map(s => ({ w: s.w ?? '', r: '', done: false })) });
  save(); render();
};
A.woDiscard = () => { if (confirm('Discard this workout?')) { S.activeWorkout = null; stopRest(); save(); render(); } };
A.woFinish = () => {
  const w = S.activeWorkout;
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  if (!doneSets && !confirm('No sets ticked. Save anyway?')) return;
  // PR detection vs all previous sessions
  const prs = [];
  for (const e of w.exercises) {
    const best = Math.max(0, ...e.sets.filter(s => s.done).map(s => e1rm(num(s.w), num(s.r))));
    const prev = Math.max(0, ...S.workouts.flatMap(x => x.exercises.filter(y => y.name.toLowerCase() === e.name.toLowerCase()).flatMap(y => y.sets.filter(s => s.done).map(s => e1rm(num(s.w), num(s.r))))));
    if (best > 0 && prev > 0 && best > prev) prs.push(e.name);
  }
  w.finishedAt = Date.now();
  w.durationMin = r0((w.finishedAt - w.startedAt) / 60000);
  S.workouts.push(w);
  S.activeWorkout = null; stopRest(); save();
  ui.trainSub = 'week'; render();
  toast(prs.length ? `🏆 New best: ${prs.join(', ')}` : `Saved: ${doneSets} sets`, 4000);
};

// rest timer
let restInt = null;
function startRest(sec) {
  stopRest();
  const end = Date.now() + sec * 1000, el = $('#timer');
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    el.innerHTML = `<span>Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span><span class="row"><button data-act="restAdd">+30s</button><button data-act="restStop">Skip</button></span>`;
    if (!left) { stopRest(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); toast('Rest done. Next set!'); }
  };
  el.hidden = false; tick(); restInt = setInterval(tick, 1000);
  startRest.end = end;
}
function stopRest() { clearInterval(restInt); restInt = null; $('#timer').hidden = true; }
A.restStop = stopRest;
A.restAdd = () => startRest(Math.round((startRest.end - Date.now()) / 1000) + 30);

// ---------- week breakdown ----------
function weekView() {
  const ws = weekStart(today()), we = addDays(ws, 6);
  const wk = S.workouts.filter(w => w.date >= ws && w.date <= we);
  const plan = S.training.plan;
  const planned = plan.days.filter(d => d.exercises.length).length;
  const sets = {}, plannedSets = {};
  let volume = 0;
  wk.forEach(w => w.exercises.forEach(e => {
    const m = e.muscle || muscleOf(e.name) || 'other';
    const n = e.sets.filter(s => s.done).length;
    sets[m] = (sets[m] || 0) + n;
    volume += e.sets.filter(s => s.done).reduce((a, s) => a + num(s.w) * num(s.r), 0);
  }));
  plan.days.forEach(d => d.exercises.forEach(e => { const m = e.muscle || 'other'; plannedSets[m] = (plannedSets[m] || 0) + e.sets; }));
  const muscles = [...new Set([...Object.keys(plannedSets), ...Object.keys(sets)])].sort((a, b) => (plannedSets[b] || 0) - (plannedSets[a] || 0));

  let html = `<div class="card"><h2>Week of ${fmtDate(ws, { day: 'numeric', month: 'short' })}</h2><div class="grid3">
    <div class="stat"><div class="v num">${wk.length}/${planned}</div><div class="l">sessions</div></div>
    <div class="stat"><div class="v num">${Object.values(sets).reduce((a, b) => a + b, 0)}</div><div class="l">hard sets</div></div>
    <div class="stat"><div class="v num">${volume >= 1000 ? r1(volume / 1000) + 't' : r0(volume) + 'kg'}</div><div class="l">volume</div></div></div>
    <div class="row" style="gap:4px;margin-top:12px">${DAYS.map((d, i) => { const k = addDays(ws, i), did = wk.some(w => w.date === k), pl = plan.days[i].exercises.length; return `<div class="grow" style="text-align:center"><div class="small muted">${d[0]}</div><div style="height:28px;border-radius:6px;margin-top:2px;background:${did ? 'var(--good)' : pl ? 'var(--surface-2)' : 'transparent'};border:1px ${pl && !did ? 'solid' : 'dashed'} var(--border)"></div></div>`; }).join('')}</div>
    <div class="legend"><span><i class="dot" style="background:var(--good)"></i>done</span><span><i class="dot" style="background:var(--surface-2);border:1px solid var(--border)"></i>planned</span></div></div>`;
  html += `<div class="card"><h2>Sets per muscle <span class="small muted">done / planned</span></h2>${muscles.length ? barRows(muscles.map(m => ({ label: m[0].toUpperCase() + m.slice(1), value: sets[m] || 0, target: plannedSets[m] || 0 }))) : '<div class="small muted">No sets yet.</div>'}
    <p class="small muted">Most people grow well on roughly 10–20 hard sets per muscle per week.</p></div>`;
  const avgR = recoveryAvg(7);
  if (avgR) html += `<div class="card"><h2>Recovery this week</h2><div class="grid3"><div class="stat"><div class="v num">${r1(avgR.sleepH)}h</div><div class="l">avg sleep</div></div><div class="stat"><div class="v num">${r0(avgR.score)}</div><div class="l">avg readiness</div></div><div class="stat"><div class="v num">${r1(avgR.soreness)}/5</div><div class="l">avg soreness</div></div></div></div>`;
  return html;
}
function muscleOf(name) {
  const n = name.toLowerCase();
  for (const d of S.training.plan?.days || []) for (const e of d.exercises) if (e.name.toLowerCase() === n && e.muscle) return e.muscle;
  return '';
}

// ---------- history & progress ----------
function historyView() {
  const ws = [...S.workouts].sort((a, b) => b.finishedAt - a.finishedAt);
  if (!ws.length) return '<div class="empty">No workouts logged yet.</div>';
  return `<div class="card"><ul class="list">${ws.slice(0, 60).map(w => {
    const sets = w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
    const vol = w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).reduce((b, s) => b + num(s.w) * num(s.r), 0), 0);
    return `<li data-act="viewWorkout" data-arg="${w.id}"><div class="grow"><div>${esc(w.title)}</div><div class="meta">${fmtDate(w.date)} · ${sets} sets · ${r0(vol)} kg · ${w.durationMin || '?'} min</div></div><span class="muted">›</span></li>`;
  }).join('')}</ul></div>`;
}
A.viewWorkout = id => {
  const w = S.workouts.find(x => x.id === id);
  if (!w) return;
  openModal(`<h2>${esc(w.title)}<button class="x" data-act="close">×</button></h2><div class="small muted">${fmtDate(w.date)} · ${w.durationMin || '?'} min</div>
    ${w.exercises.map(e => `<h3>${esc(e.name)}</h3><div class="small num">${e.sets.filter(s => s.done).map(s => `${s.w} kg × ${s.r}`).join(' · ') || 'no sets'}</div>`).join('')}
    ${w.notes ? `<h3>Notes</h3><p class="small">${esc(w.notes)}</p>` : ''}<hr><button class="btn danger block" data-act="delWorkout" data-arg="${w.id}">Delete workout</button>`);
};
A.delWorkout = id => { if (confirm('Delete this workout?')) { S.workouts = S.workouts.filter(w => w.id !== id); save(); closeModal(); render(); } };

function progressView() {
  const names = [...new Set(S.workouts.flatMap(w => w.exercises.filter(e => e.sets.some(s => s.done)).map(e => e.name)))].sort();
  if (!names.length) return '<div class="empty">Finish a workout to see progress.</div>';
  const ex = ui.progressEx && names.includes(ui.progressEx) ? ui.progressEx : names[0];
  const pts = S.workouts.filter(w => w.exercises.some(e => e.name === ex)).sort((a, b) => a.date.localeCompare(b.date)).map(w => {
    const sets = w.exercises.filter(e => e.name === ex).flatMap(e => e.sets.filter(s => s.done));
    const best = sets.reduce((b, s) => (e1rm(num(s.w), num(s.r)) > e1rm(num(b.w), num(b.r)) ? s : b), { w: 0, r: 0 });
    return { x: parseKey(w.date).getTime(), y: r1(e1rm(num(best.w), num(best.r))), label: `best set ${best.w} kg × ${best.r}`, top: Math.max(...sets.map(s => num(s.w))) };
  }).filter(p => p.y > 0);
  const pr = pts.reduce((a, p) => Math.max(a, p.y), 0);
  return `<div class="card"><label class="f"><span>Exercise</span><select data-input="progressEx">${names.map(n => `<option ${n === ex ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="grid2" style="margin-bottom:10px"><div class="stat"><div class="v num">${r1(pr)} kg</div><div class="l">best estimated 1RM</div></div><div class="stat"><div class="v num">${pts.length ? pts[pts.length - 1].top : 0} kg</div><div class="l">last top weight</div></div></div>
    <h3>Estimated 1RM per session</h3>${lineChart('e1rm', [{ name: 'Est. 1RM', color: 'var(--accent)', points: pts, dots: true }], { unit: ' kg' })}
    <p class="small muted">Estimated 1RM uses the Epley formula from your best set each session, so rep PRs count too.</p></div>`;
}
I.progressEx = el => { ui.progressEx = el.value; render(); };

// ---------- weekly check-in ----------
function checkinDue() {
  if (!S.training.plan) return false;
  const last = S.training.checkins[S.training.checkins.length - 1];
  const since = last ? last.date : S.training.createdAt;
  return !since || daysBetween(since, today()) >= 7;
}
function recoveryAvg(days) {
  const rs = [];
  for (let i = 0; i < days; i++) { const r = S.recovery[addDays(today(), -i)]; if (r) rs.push(r); }
  if (!rs.length) return null;
  const avg = f => rs.reduce((a, r) => a + num(r[f]), 0) / rs.length;
  return { sleepH: avg('sleepH'), soreness: avg('soreness'), energy: avg('energy'), stress: avg('stress'), score: rs.reduce((a, r) => a + readiness(r), 0) / rs.length, n: rs.length };
}
function recoverySummary() {
  const r = recoveryAvg(7), rate = weightRate(28);
  return [r ? `Last 7 days recovery (${r.n} check-ins): sleep ${r1(r.sleepH)} h, energy ${r1(r.energy)}/5, soreness ${r1(r.soreness)}/5, stress ${r1(r.stress)}/5.` : '', rate != null ? `Weight trend: ${r1(rate)} kg/week over 4 weeks.` : ''].filter(Boolean).join('\n');
}

A.checkin = () => {
  const ws = weekStart(today()), prevWs = addDays(ws, -7);
  const done = S.workouts.filter(w => w.date >= prevWs).length;
  const chips = (name, opts) => `<div class="chips" style="margin-bottom:10px">${opts.map((o, i) => `<button type="button" class="chip ${i === 1 ? 'on' : ''}" data-act="pickOpt" data-arg="${name}">${esc(o)}</button>`).join('')}<input type="hidden" name="${name}" value="${esc(opts[1])}"></div>`;
  openModal(`<h2>Weekly check-in<button class="x" data-act="close">×</button></h2>
    <p class="small muted">${done} sessions logged in the last 2 weeks. Be honest; this is how the plan adapts.</p>
    <form data-form="checkin">
    <div class="small">How did the training feel overall?</div>${chips('difficulty', ['Too easy', 'About right', 'Too hard'])}
    <div class="small">How are you recovering between sessions?</div>${chips('recovery', ['Great', 'OK', 'Struggling'])}
    <div class="small">Did you get the sessions done?</div>${chips('adherence', ['All of them', 'Most', 'Missed several'])}
    <div class="small">Enjoying it?</div>${chips('enjoy', ['Love it', "It's fine", 'Bored / not for me'])}
    <label class="f"><span>Any pain, niggles or injuries?</span><input type="text" name="pain" placeholder="None"></label>
    <label class="f"><span>Schedule next week (placements, exams, travel)?</span><input type="text" name="schedule"></label>
    <label class="f"><span>Anything you want changed?</span><textarea name="change" placeholder="e.g. swap barbell squats for hack squats, shorter Friday session"></textarea></label>
    <button class="btn primary block" id="checkinBtn">${aiReady() ? 'Submit & get coach review' : 'Submit'}</button></form>`);
};
A.pickOpt = (name, el) => { const wrap = el.parentElement; $$('.chip', wrap).forEach(c => c.classList.toggle('on', c === el)); wrap.querySelector('input').value = el.textContent; };

F.checkin = async (d, form) => {
  const entry = { date: today(), answers: d };
  const btn = $('#checkinBtn', form);
  if (aiReady()) {
    aiBusyButton(btn, true);
    try {
      const since = addDays(today(), -14);
      const log = S.workouts.filter(w => w.date >= since).map(w => `${w.date} ${w.title}: ` + w.exercises.map(e => `${e.name} ${e.sets.filter(s => s.done).map(s => `${s.w}x${s.r}`).join(',')}`).join('; ')).join('\n');
      const system = `You are the user's strength coach doing a weekly check-in. Adjust the plan only as much as the feedback warrants (small, specific changes; keep what works). Apply progressive overload guidance based on the logged sets. ${userContext()}`;
      const user = `Original questionnaire: ${JSON.stringify(S.training.questionnaire)}\nCurrent plan: ${JSON.stringify(S.training.plan)}\nLast 2 weeks of logged training:\n${log || 'none logged'}\n${recoverySummary()}\nCheck-in answers: ${JSON.stringify(d)}\n\nReturn JSON: {"review": "3-6 sentences of honest, specific feedback and what to focus on this week, incl. target weights where logs allow", "changes": ["each concrete change you made"], "plan": <full updated plan in this shape: ${PLAN_SHAPE}>}. If no changes are needed, return the plan unchanged and an empty changes array.`;
      const out = await aiJSON(system, [{ role: 'user', content: user }], { effort: 'medium', maxTokens: 16000 });
      entry.review = out.review || '';
      entry.changes = out.changes || [];
      if (out.plan && out.plan.days) entry.newPlan = normalisePlan(out.plan);
    } catch (e) { toast(e.message, 4000); }
    aiBusyButton(btn, false);
  } else {
    entry.review = ruleReview(d);
  }
  S.training.checkins.push(entry); save();
  openModal(`<h2>Coach review<button class="x" data-act="close">×</button></h2><p class="small" style="white-space:pre-wrap">${esc(entry.review || 'Check-in saved.')}</p>
    ${entry.changes?.length ? `<h3>Suggested changes</h3><ul class="small">${entry.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <div class="row"><button class="btn" data-act="close">Keep current plan</button><button class="btn primary grow" data-act="applyCheckin">Apply changes</button></div>` : '<button class="btn block" data-act="close">Done</button>'}`);
  render();
};
A.applyCheckin = () => {
  const c = S.training.checkins[S.training.checkins.length - 1];
  if (c?.newPlan) { S.training.plan = c.newPlan; c.applied = true; save(); toast('Plan updated'); }
  closeModal(); render();
};
function ruleReview(d) {
  const out = [];
  if (d.difficulty === 'Too easy') out.push('Sessions feel easy: add 2.5–5 kg to your main lifts, or take sets closer to failure (1 rep in reserve).');
  if (d.difficulty === 'Too hard') out.push('Sessions feel too hard: keep the weights but drop one set per exercise this week, and leave 2–3 reps in reserve.');
  if (d.recovery === 'Struggling') out.push('Recovery is lagging: prioritise 7–9 h sleep and protein near target; consider a deload week (half the sets).');
  if (d.adherence === 'Missed several') out.push('Missing sessions: consider fewer, shorter sessions you can actually hit. Redo setup with fewer days.');
  if (d.enjoy === 'Bored / not for me') out.push('Swap a couple of exercises for variations you enjoy; enjoyment drives consistency.');
  if (d.pain && !/^none$/i.test(d.pain.trim())) out.push(`Pain noted (${d.pain}): swap aggravating movements for pain-free variations and get it assessed if it persists.`);
  return out.join('\n\n') || 'Everything looks on track. Keep progressing with double progression: add load once you hit the top of the rep range on all sets.';
}
