'use strict';
// Class timetable (imported from screenshots/text or added by hand) + week-by-week planner.
// A planned week overrides the plan's default days: which lifting session goes where, and which classes you'll do.

// ---------- schedule resolution ----------
function weekPlan(ws) { return (S.weekPlans || {})[ws] || null; }
function classToActivity(c) {
  return { name: c.name, type: c.type || 'class', duration: c.duration || 45, details: [c.time, c.instructor, c.location].filter(Boolean).join(' · '), classId: c.id };
}
// Sat/Sun: the current week is nearly over, so plan the next one
function planTargetWeek() { const ws = weekStart(today()); return weekdayIdx(today()) >= 5 ? addDays(ws, 7) : ws; }
function findClass(id) { return S.timetable.classes.find(c => c.id === id); }

function scheduleFor(k) {
  const plan = S.training.plan;
  if (!plan) return null;
  const di = weekdayIdx(k), wp = weekPlan(weekStart(k));
  if (wp) {
    const d = wp.days[di] || {};
    const lift = d.lift != null && plan.days[d.lift]?.exercises.length ? plan.days[d.lift] : null;
    const classes = (d.classes || []).map(findClass).filter(Boolean).sort((a, b) => a.time.localeCompare(b.time)).map(classToActivity);
    const activities = [...(d.extras || []), ...classes];
    return { planned: true, lift, liftIdx: lift ? d.lift : null, activities, note: d.note || '', title: lift ? lift.title : activities[0]?.name || 'Rest', cardio: '' };
  }
  const day = plan.days[di];
  return { planned: false, lift: day.exercises.length ? day : null, liftIdx: day.exercises.length ? di : null, activities: day.activities || [], note: '', title: day.title, cardio: day.cardio };
}
function weekSummaryText(ws) {
  return DAYS.map((d, i) => {
    const s = scheduleFor(addDays(ws, i));
    const bits = [s.lift ? `lift: ${s.lift.title}` : '', ...s.activities.map(a => `${a.name}${a.details ? ' (' + a.details + ')' : ''}`)].filter(Boolean);
    return `${d}: ${bits.join(', ') || 'rest'}${s.note ? ` [commitments: ${s.note}]` : ''}`;
  }).join('\n');
}

// ---------- activity list + logging (shared by plan, today, planner) ----------
const ACT_ICON = { swim: '🏊', class: '🧘', cycle: '🚴', hiit: '🔥', 'mind-body': '🧘', dance: '💃', cardio: '🏃', mobility: '🤸', sport: '🎾', recovery: '🧖', strength: '🏋️' };
function activityList(acts, ref, dateKey = null) {
  if (!acts?.length) return '';
  const done = dateKey ? S.workouts.filter(w => w.date === dateKey && w.activity).map(w => w.title.toLowerCase()) : [];
  const canLog = !dateKey || dateKey <= today();
  return `<ul class="list" style="margin-top:4px">${acts.map((x, ai) => `<li><span style="font-size:20px">${ACT_ICON[x.type] || '✨'}</span><div class="grow"><div>${esc(x.name)} <span class="muted small">· ${x.duration} min</span></div>${x.details ? `<div class="meta">${esc(x.details)}</div>` : ''}</div>
    ${done.includes(x.name.toLowerCase()) ? '<span class="tag good">Done ✓</span>' : canLog ? `<button class="btn sm" data-act="logActivity" data-arg="${ref}#${ai}">Log</button>` : ''}</li>`).join('')}</ul>`;
}
function resolveActs(ref) {
  if (ref[0] === 'p') return S.training.plan.days[+ref.slice(1)].activities;
  if (ref[0] === 'd') return scheduleFor(ref.slice(1)).activities;
  return [];
}
A.logActivity = arg => {
  const [ref, ai] = (arg || 'free').split('#');
  const x = ref === 'free' ? { name: '', duration: 45 } : resolveActs(ref)[+ai];
  const date = ref[0] === 'd' && ref.slice(1) <= today() ? ref.slice(1) : today();
  openModal(`<h2>Log activity<button class="x" data-act="close">×</button></h2><form data-form="saveActivity">
    <label class="f"><span>Activity</span><input type="text" name="name" value="${esc(x.name)}" placeholder="e.g. Swim, Reformer class" list="actlist" required></label>
    <datalist id="actlist">${[...new Set([...S.timetable.classes.map(c => c.name), ...ACT_TEMPLATES.map(([, t]) => t.name)])].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="grid2"><label class="f"><span>Minutes</span><input type="number" name="min" value="${x.duration}" inputmode="numeric"></label><label class="f"><span>Distance (optional)</span><input type="text" name="dist" placeholder="e.g. 1.2 km"></label></div>
    <label class="f"><span>Effort (1 easy – 10 max)</span><div class="chips">${[2, 4, 6, 8, 10].map(n => `<button type="button" class="chip ${n === 6 ? 'on' : ''}" data-act="scale" data-arg="rpe:${n}">${n}</button>`).join('')}</div><input type="hidden" name="rpe" value="6"></label>
    <label class="f"><span>Date</span><input type="date" name="date" value="${date}" max="${today()}"></label>
    <label class="f"><span>Notes</span><input type="text" name="notes"></label>
    <button class="btn primary block">Save</button></form>`);
};
F.saveActivity = d => {
  const now = Date.now();
  S.workouts.push({ id: uid(), date: d.date || today(), title: d.name.trim(), activity: true, durationMin: r0(num(d.min)), distance: d.dist, rpe: num(d.rpe), notes: d.notes, exercises: [], startedAt: now, finishedAt: now });
  save(); closeModal(); toast(`${d.name} logged`); render();
};

// ---------- "this week" card for the Plan tab ----------
function weekCard() {
  const ws = weekStart(today()), wp = weekPlan(ws), next = addDays(ws, 7);
  const nudgeNext = weekdayIdx(today()) >= 4 && !weekPlan(next);
  const rows = DAYS.map((d, i) => {
    const k = addDays(ws, i), s = scheduleFor(k), isToday = k === today();
    const bits = [s.lift ? `<b>${esc(s.lift.title)}</b>` : '', ...s.activities.map(a => esc(a.name) + (a.details && a.classId ? ` <span class="muted">${esc(a.details.split(' · ')[0])}</span>` : ''))].filter(Boolean);
    return `<li style="${isToday ? 'font-weight:800' : ''}"><span class="tag" style="background:var(--${PASTELS[i % 4]});color:#111;min-width:42px;text-align:center">${d}</span><div class="grow small">${bits.join(' · ') || '<span class="muted">Rest</span>'}${s.note ? `<div class="meta">📌 ${esc(s.note)}</div>` : ''}</div></li>`;
  }).join('');
  return `<div class="card"><h2>This week <span class="small muted">${wp ? 'planned' : 'default plan'}</span></h2><ul class="list">${rows}</ul>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm primary" data-act="planWeek" data-arg="${ws}">${wp ? 'Edit this week' : 'Plan this week'}</button><button class="btn sm ${nudgeNext ? 'primary' : ''}" data-act="planWeek" data-arg="${next}">${weekPlan(next) ? 'Edit next week' : 'Plan next week'}</button></div></div>`;
}

// ---------- timetable ----------
function classesView() {
  const T = S.timetable, n = T.classes.length;
  let html = `<div class="card blue hero" style="min-height:0"><div class="eyebrow">Class timetable</div><h2>${esc(T.gym || 'Your gym')}</h2>
    <p>${n ? `${n} classes${T.importedAt ? ` · updated ${fmtDate(T.importedAt, { day: 'numeric', month: 'short' })}` : ''}` : 'Import your gym timetable, then pick classes week by week.'}</p>
    ${n ? `<div style="margin-top:14px"><button class="btn primary" data-act="planWeek" data-arg="${planTargetWeek()}">Plan ${planTargetWeek() === weekStart(today()) ? 'this' : 'next'} week</button></div>` : ''}${blob('var(--yellow)', 2)}</div>`;

  html += `<div class="card"><h2>Import timetable</h2>${aiReady() ? `
    <p class="small muted">Screenshot the timetable in your gym's app or website (several screenshots is fine), or snap a photo of the printed one. The AI reads every class.</p>
    <label class="btn primary block" id="ttBtn">📷 Choose screenshots / photo<input type="file" accept="image/*" multiple data-input="ttImages" hidden></label>
    <details style="margin-top:8px"><summary>Or paste the timetable as text</summary><form data-form="ttText" style="margin-top:8px"><textarea name="text" rows="5" placeholder="Copy the timetable from the gym website and paste it here"></textarea><button class="btn block" style="margin-top:8px">Read timetable</button></form></details>
    <label class="row small" style="margin-top:10px"><input type="checkbox" class="check" id="ttMerge"> Add to my current timetable instead of replacing it</label>`
    : `<p class="small muted">Add an AI key in Settings to import from screenshots or text. You can still add classes by hand below.</p>`}</div>`;

  html += `<div class="card"><h2>Add a class</h2><form data-form="ttAdd"><div class="grid2"><label class="f"><span>Day</span><select name="day">${DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></label><label class="f"><span>Time</span><input type="text" name="time" placeholder="18:00" required></label></div>
    <label class="f"><span>Class</span><input type="text" name="name" placeholder="e.g. Body Pump" required></label>
    <div class="grid2"><label class="f"><span>Minutes</span><input type="number" name="duration" value="45" inputmode="numeric"></label><label class="f"><span>Instructor (optional)</span><input type="text" name="instructor"></label></div>
    <button class="btn block">Add class</button></form></div>`;

  if (n) {
    html += DAYS.map((d, i) => {
      const cs = T.classes.filter(c => c.day === i).sort((a, b) => a.time.localeCompare(b.time));
      if (!cs.length) return '';
      return `<div class="card"><h2><span class="row"><span class="tag" style="background:var(--${PASTELS[i % 4]});color:#111">${d}</span></span><span class="small muted">${cs.length}</span></h2><ul class="list">${cs.map(c => `<li><b class="num" style="min-width:48px">${esc(c.time)}</b><div class="grow"><div>${ACT_ICON[c.type] || '✨'} ${esc(c.name)}</div><div class="meta">${c.duration} min${c.instructor ? ' · ' + esc(c.instructor) : ''}${c.location ? ' · ' + esc(c.location) : ''}</div></div><button class="x" data-act="ttDel" data-arg="${c.id}">×</button></li>`).join('')}</ul></div>`;
    }).join('');
    html += `<button class="btn ghost danger block" data-act="ttClear">Clear timetable</button>`;
  }
  return html;
}

const TT_SYSTEM = 'You extract gym group-fitness class timetables from screenshots, photos or pasted text. Be exhaustive and exact: every class, every day. Use 24-hour HH:MM start times. If a class runs on several days, list it once per day. Skip closed/cancelled sessions and non-class items (e.g. creche hours).';
const TT_SHAPE = '{"gym": "gym or club name if shown, else empty", "classes": [{"day": "Mon|Tue|Wed|Thu|Fri|Sat|Sun", "time": "18:00", "name": "Body Pump", "duration": 45, "type": "class|swim|cycle|hiit|mind-body|dance|strength|other", "instructor": "", "location": "studio/pool if shown"}]}';

async function importTimetable(content, btn) {
  aiBusyButton(btn, true);
  try {
    const out = await aiJSON(TT_SYSTEM, [{ role: 'user', content }], { effort: 'medium', maxTokens: 16000 });
    const dayIdx = s => DAYS.findIndex(d => d.toLowerCase() === String(s || '').slice(0, 3).toLowerCase());
    const cls = (out.classes || []).map(c => ({
      id: uid(), day: dayIdx(c.day), time: normTime(c.time), name: String(c.name || '').trim(), duration: r0(num(c.duration, 45)) || 45,
      type: ACT_ICON[c.type] ? c.type : 'class', instructor: c.instructor || '', location: c.location || '',
    })).filter(c => c.day >= 0 && c.name);
    if (!cls.length) throw new Error("Couldn't find any classes. Try a clearer screenshot.");
    const merge = $('#ttMerge')?.checked;
    if (!merge) pruneWeekPlans(cls);
    S.timetable = { gym: out.gym || S.timetable.gym || '', classes: merge ? dedupe([...S.timetable.classes, ...cls]) : cls, importedAt: today() };
    save(); toast(`Imported ${cls.length} classes`);
  } catch (e) { toast(e.message, 4500); }
  aiBusyButton(btn, false);
  render();
}
function normTime(t) {
  const m = String(t || '').match(/(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i);
  if (!m) return String(t || '');
  let h = +m[1]; const min = m[2] || '00', ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}
function dedupe(cs) {
  const seen = new Set();
  return cs.filter(c => { const k = `${c.day}|${c.time}|${c.name.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
// When the timetable is replaced, keep week-plan picks that still exist (same day/time/name) by remapping their ids.
function pruneWeekPlans(newCls) {
  const key = c => `${c.day}|${c.time}|${c.name.toLowerCase()}`;
  const byKey = Object.fromEntries(newCls.map(c => [key(c), c.id]));
  for (const wp of Object.values(S.weekPlans)) for (const d of wp.days) {
    d.classes = (d.classes || []).map(id => { const old = findClass(id); return old ? byKey[key(old)] : null; }).filter(Boolean);
  }
}
I.ttImages = async el => {
  const files = [...el.files].slice(0, 6);
  if (!files.length) return;
  try {
    const imgs = await Promise.all(files.map(f => resizeImage(f, 1600, 0.85)));
    const content = [...imgs.map(d => ({ type: 'image', mediaType: 'image/jpeg', data: d.split(',')[1] })), { type: 'text', text: `Extract the full class timetable from ${imgs.length > 1 ? 'these screenshots (they may overlap; do not duplicate)' : 'this image'}. JSON shape: ${TT_SHAPE}` }];
    await importTimetable(content, $('#ttBtn'));
  } catch (e) { toast(e.message); }
};
F.ttText = (d, form) => { if (d.text.trim()) importTimetable(`Extract the class timetable from this text. JSON shape: ${TT_SHAPE}\n\n${d.text}`, $('button', form)); };
F.ttAdd = d => {
  S.timetable.classes.push({ id: uid(), day: +d.day, time: normTime(d.time), name: d.name.trim(), duration: r0(num(d.duration, 45)), type: guessClassType(d.name), instructor: d.instructor, location: '' });
  save(); toast('Class added'); render();
};
function guessClassType(n) {
  const s = n.toLowerCase();
  if (/swim|aqua|pool/.test(s)) return 'swim';
  if (/spin|cycle|rpm|ride/.test(s)) return 'cycle';
  if (/yoga|pilates|reformer|stretch|barre|core/.test(s)) return 'mind-body';
  if (/hiit|circuit|grit|attack|bootcamp|tabata|box/.test(s)) return 'hiit';
  if (/pump|strength|lift|kettle/.test(s)) return 'strength';
  if (/zumba|dance|sh.?bam/.test(s)) return 'dance';
  return 'class';
}
A.ttDel = id => { S.timetable.classes = S.timetable.classes.filter(c => c.id !== id); save(); render(); };
A.ttClear = () => { if (confirm('Remove the whole timetable? Classes picked in planned weeks will be removed too.')) { S.timetable = { gym: '', classes: [], importedAt: null }; save(); render(); } };

// ---------- week planner ----------
function defaultWeekDraft() {
  const plan = S.training.plan, hasTT = S.timetable.classes.length > 0;
  return { days: plan.days.map((d, i) => ({
    lift: d.exercises.length ? i : null, classes: [], note: '',
    // keep the plan's own activities (swims, runs); drop generic class placeholders once there's a real timetable
    extras: (d.activities || []).filter(a => !(hasTT && /class|pilates|reformer|spin|yoga|hiit/i.test(a.type + ' ' + a.name))).map(a => ({ ...a })),
  })) };
}
A.planWeek = ws => {
  if (!S.training.plan) return toast('Build a plan first');
  const existing = weekPlan(ws);
  ui.weekEdit = { ws, draft: JSON.parse(JSON.stringify(existing || defaultWeekDraft())), summary: '' };
  ui.tab = 'train'; ui.trainSub = 'plan'; render(); window.scrollTo(0, 0);
};
function plannerView() {
  const { ws, draft } = ui.weekEdit, plan = S.training.plan;
  const sessions = plan.days.map((d, i) => ({ i, d })).filter(x => x.d.exercises.length);
  const used = draft.days.map(d => d.lift).filter(x => x != null);
  const missing = sessions.filter(s => !used.includes(s.i)).map(s => s.d.title);
  const dup = sessions.filter(s => used.filter(u => u === s.i).length > 1).map(s => s.d.title);
  const nClasses = draft.days.reduce((a, d) => a + d.classes.length, 0);
  const thisWs = weekStart(today());
  let html = `<div class="card yellow hero" style="min-height:0"><div class="eyebrow">Plan your week</div><h2>Week of ${fmtDate(ws, { day: 'numeric', month: 'short' })}</h2>
    <p>Add your commitments, then pick what fits each day.</p>
    <div class="chips" style="margin-top:12px">${[[thisWs, 'This week'], [addDays(thisWs, 7), 'Next week']].map(([k, l]) => `<button class="chip ${k === ws ? 'on' : ''}" data-act="planWeek" data-arg="${k}">${l}</button>`).join('')}</div>${blob('var(--cream)', 0)}</div>`;

  html += `<div class="card"><div class="grid3"><div class="stat blue"><div class="v num">${used.length}/${sessions.length}</div><div class="l">lift sessions</div></div><div class="stat pink"><div class="v num">${nClasses}</div><div class="l">classes</div></div><div class="stat mint"><div class="v num">${draft.days.filter(d => d.lift == null && !d.classes.length && !(d.extras || []).length).length}</div><div class="l">rest days</div></div></div>
    ${missing.length ? `<p class="small" style="margin:10px 0 0">Not scheduled yet: <b>${missing.map(esc).join(', ')}</b></p>` : ''}${dup.length ? `<p class="small" style="margin:6px 0 0">Twice this week: <b>${dup.map(esc).join(', ')}</b></p>` : ''}
    ${!S.timetable.classes.length ? `<p class="small muted" style="margin:10px 0 0">No class timetable yet. <button class="btn sm" data-act="trainSubFromPlanner" data-arg="classes">Import one</button></p>` : ''}
    ${ui.weekEdit.summary ? `<hr><div class="small"><b>Coach:</b> ${esc(ui.weekEdit.summary)}</div>` : ''}
    <div class="row wrap" style="margin-top:12px">${aiReady() ? '<button class="btn sm" data-act="suggestWeek" id="suggestBtn">✨ Suggest my week</button>' : ''}<button class="btn sm ghost" data-act="resetWeek">Reset to default</button></div></div>`;

  draft.days.forEach((d, i) => {
    const k = addDays(ws, i);
    const cs = S.timetable.classes.filter(c => c.day === i).sort((a, b) => a.time.localeCompare(b.time));
    html += `<div class="card ${k === today() ? 'day-card today' : ''}"><h2><span class="row"><span class="tag" style="background:var(--${PASTELS[i % 4]});color:#111">${DAYS[i]}</span>${fmtDate(k, { day: 'numeric', month: 'short' })}</span>${k < today() ? '<span class="tag">past</span>' : ''}</h2>
      <input type="text" value="${esc(d.note)}" placeholder="Commitments, e.g. placement 8–5, study night" data-input="wkNote" data-arg="${i}" style="margin-bottom:12px">
      <div class="eyebrow" style="margin-bottom:6px">Lift</div>
      <div class="chips" style="margin-bottom:12px"><button class="chip ${d.lift == null ? 'on' : ''}" data-act="wkLift" data-arg="${i}:-">None</button>${sessions.map(s => `<button class="chip ${d.lift === s.i ? 'on' : ''}" data-act="wkLift" data-arg="${i}:${s.i}">${esc(s.d.title)}</button>`).join('')}</div>
      ${cs.length ? `<div class="eyebrow" style="margin-bottom:6px">Classes</div><div class="chips" style="margin-bottom:${(d.extras || []).length ? 12 : 0}px">${cs.map(c => `<button class="chip ${d.classes.includes(c.id) ? 'on' : ''}" data-act="wkClass" data-arg="${i}:${c.id}">${esc(c.time)} ${esc(c.name)}</button>`).join('')}</div>` : ''}
      ${(d.extras || []).length ? `<div class="eyebrow" style="margin-bottom:6px">Other</div><div class="chips">${d.extras.map((x, ei) => `<button class="chip on" data-act="wkExtra" data-arg="${i}:${ei}">${ACT_ICON[x.type] || '✨'} ${esc(x.name)} ×</button>`).join('')}</div>` : ''}
      ${d.reason ? `<p class="small muted" style="margin:10px 0 0">💡 ${esc(d.reason)}</p>` : ''}</div>`;
  });
  html += `<div class="row" style="position:sticky;bottom:calc(92px + env(safe-area-inset-bottom));padding:8px 0"><button class="btn" style="background:var(--surface)" data-act="cancelWeek">Cancel</button><button class="btn primary grow" data-act="saveWeek">Save week</button></div>`;
  return html;
}
A.trainSubFromPlanner = k => { ui.weekEdit = null; ui.trainSub = k; render(); };
I.wkNote = el => { ui.weekEdit.draft.days[+el.dataset.arg].note = el.value; };
A.wkLift = arg => { const [i, v] = arg.split(':'); ui.weekEdit.draft.days[+i].lift = v === '-' ? null : +v; render(); };
A.wkClass = arg => {
  const [i, id] = arg.split(':'), d = ui.weekEdit.draft.days[+i];
  d.classes = d.classes.includes(id) ? d.classes.filter(x => x !== id) : [...d.classes, id];
  render();
};
A.wkExtra = arg => { const [i, ei] = arg.split(':').map(Number); ui.weekEdit.draft.days[i].extras.splice(ei, 1); render(); };
A.resetWeek = () => { ui.weekEdit.draft = defaultWeekDraft(); ui.weekEdit.summary = ''; render(); };
A.cancelWeek = () => { ui.weekEdit = null; render(); };
A.saveWeek = () => {
  const { ws, draft } = ui.weekEdit;
  draft.days.forEach(d => delete d.reason);
  S.weekPlans[ws] = draft;
  // keep only recent weeks
  for (const k of Object.keys(S.weekPlans)) if (k < addDays(weekStart(today()), -56)) delete S.weekPlans[k];
  ui.weekEdit = null; save(); toast('Week saved'); render();
};
A.suggestWeek = async (_, btn) => {
  const { ws, draft } = ui.weekEdit, plan = S.training.plan, q = S.training.questionnaire || {};
  const sessions = plan.days.map((d, i) => ({ id: i, title: d.title, focus: d.focus, exercises: d.exercises.map(e => e.name).join(', ') })).filter((s, i) => plan.days[i].exercises.length);
  const tt = S.timetable.classes.map(c => ({ id: c.id, day: DAYS[c.day], time: c.time, name: c.name, minutes: c.duration, type: c.type }));
  const notes = draft.days.map((d, i) => `${DAYS[i]} ${fmtDate(addDays(ws, i), { day: 'numeric', month: 'short' })}: ${d.note || 'no commitments noted'}`).join('\n');
  const since = addDays(today(), -7);
  const recent = S.workouts.filter(w => w.date >= since).map(w => `${w.date} ${w.title}`).join('; ') || 'none';
  const system = `You are the user's coach planning one specific week around their real commitments. Place each lifting session once on a day it fits (respect session length ${q.length || '60 min'}), spread hard sessions for recovery (avoid heavy legs the day after spin/HIIT/leg-heavy classes), and add timetable classes that suit the goal and cardio preference without overloading busy days. Classes must fit around the stated commitments (e.g. a placement 8–5 rules out a 12:00 class but allows 06:15 or 18:30). It's fine to leave a session out if the week is genuinely too full; say so. ${userContext()}`;
  const user = `Goal: ${q.goal || ''}; cardio preference: ${q.cardio || ''}; facilities liked: ${(q.facilities || []).join(', ')}; lifestyle: ${q.schedule || ''}.
Lifting sessions (use the id): ${JSON.stringify(sessions)}
Class timetable (use the id): ${JSON.stringify(tt)}
This week's commitments:\n${notes}
Trained in the last 7 days: ${recent}
${recoverySummary()}
Return JSON: {"summary": "2-3 sentences on how the week is set up", "days": [{"day": "Mon", "lift": <session id or null>, "classes": ["class id"], "reason": "short why"}]} with exactly 7 days Mon..Sun.`;
  aiBusyButton(btn, true);
  try {
    const out = await aiJSON(system, [{ role: 'user', content: user }], { effort: 'medium', maxTokens: 8000 });
    (out.days || []).forEach((od, j) => {
      const i = DAYS.findIndex(d => d.toLowerCase() === String(od.day || '').slice(0, 3).toLowerCase());
      const d = draft.days[i >= 0 ? i : j];
      if (!d) return;
      const lift = od.lift == null || od.lift === '' ? null : +od.lift;
      d.lift = lift != null && plan.days[lift]?.exercises.length ? lift : null;
      d.classes = (od.classes || []).map(String).filter(id => findClass(id));
      d.reason = od.reason || '';
    });
    ui.weekEdit.summary = out.summary || '';
    toast('Suggestion ready. Tweak anything, then save.');
  } catch (e) { toast(e.message, 4500); }
  aiBusyButton(btn, false);
  render();
};
