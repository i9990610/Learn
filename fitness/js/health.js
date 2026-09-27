'use strict';
// Health: bowel habits (size, Bristol type, laxatives), menstrual cycle, and daily symptoms.

const BO_SIZES = { S: 'Small', M: 'Medium', L: 'Large' };
const BRISTOL = ['', 'Separate hard lumps', 'Lumpy, sausage-shaped', 'Sausage with cracks', 'Smooth, soft sausage', 'Soft blobs, clear edges', 'Mushy, ragged edges', 'Watery, no solid pieces'];
const LAXATIVES = ['Movicol', 'OsmoLax', 'Coloxyl', 'Coloxyl with Senna', 'Senokot', 'Lactulose', 'Metamucil', 'Benefiber', 'Dulcolax (bisacodyl)', 'Glycerin suppository', 'Microlax enema'];
const FLOWS = [['', 'None'], ['spotting', 'Spotting'], ['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']];
const SYMPTOMS = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Back pain', 'Breast tenderness', 'Acne', 'Low mood', 'Anxiety', 'Irritability', 'Cravings', 'Nausea', 'Abdominal pain', 'Constipation', 'Diarrhoea', 'Heartburn', 'Dizziness', 'Insomnia', 'Joint pain'];
const SEV = ['', 'mild', 'moderate', 'severe'];

const tracksCycle = () => S.profile.sex !== 'male';
const bowelDay = k => S.bowels[k] || { events: [], none: false, laxative: { taken: false, name: '', dose: '' }, notes: '' };
const ensureBowel = k => (S.bowels[k] = S.bowels[k] || bowelDay(k));
const flowOn = k => S.cycle.days[k]?.flow || '';
const symDay = k => S.symptoms[k] || { items: {}, notes: '' };
const ensureSym = k => (S.symptoms[k] = S.symptoms[k] || symDay(k));

// ---------- bowel helpers ----------
function lastBowelDate(before = today()) {
  const ks = Object.keys(S.bowels).filter(k => k <= before && S.bowels[k].events?.length).sort();
  return ks.length ? ks[ks.length - 1] : null;
}
function daysSinceBO() { const l = lastBowelDate(); return l ? daysBetween(l, today()) : null; }
function boLabel(n) { return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; }

// ---------- cycle maths ----------
function periodStarts() {
  const ks = Object.keys(S.cycle.days).filter(k => ['light', 'medium', 'heavy'].includes(flowOn(k))).sort();
  const starts = []; let prev = null;
  for (const k of ks) { if (!prev || daysBetween(prev, k) >= 10) starts.push(k); prev = k; }
  return starts;
}
function cycleStats() {
  const starts = periodStarts();
  const lens = starts.slice(1).map((s, i) => daysBetween(starts[i], s)).filter(n => n >= 15 && n <= 60);
  const recent = lens.slice(-6);
  const avgLen = recent.length ? r0(recent.reduce((a, b) => a + b, 0) / recent.length) : num(S.cycle.settings.cycleLength, 28);
  const pLens = starts.map(s => {
    let end = s;
    for (let i = 1; i < 10; i++) { const k = addDays(s, i); if (['spotting', 'light', 'medium', 'heavy'].includes(flowOn(k))) end = k; else if (daysBetween(end, k) > 2) break; }
    return daysBetween(s, end) + 1;
  });
  // leave out a period that may still be going (started in the last 10 days)
  const doneP = pLens.filter((_, i) => daysBetween(starts[i], today()) >= 10);
  const lastP = doneP.slice(-6);
  const avgPeriod = lastP.length ? r0(lastP.reduce((a, b) => a + b, 0) / lastP.length) : num(S.cycle.settings.periodLength, 5);
  const last = [...starts].reverse().find(s => s <= today()) || null;
  const range = recent.length >= 2 ? [Math.min(...recent), Math.max(...recent)] : null;
  return { starts, lens, avgLen, avgPeriod, pLens, last, range };
}
function cycleInfo(k = today(), st = cycleStats()) {
  const last = [...st.starts].reverse().find(s => s <= k);
  if (!last) return null;
  const cd = daysBetween(last, k) + 1, ovDay = st.avgLen - 14;
  let phase = 'Luteal';
  if (cd <= st.avgPeriod) phase = 'Menstrual';
  else if (Math.abs(cd - ovDay) <= 1) phase = 'Ovulatory';
  else if (cd < ovDay) phase = 'Follicular';
  if (cd > st.avgLen + 7) phase = 'Late';
  const next = addDays(last, st.avgLen);
  return { last, cd, phase, next, ov: addDays(last, ovDay - 1), daysToNext: daysBetween(k, next) };
}
const PHASE_NOTE = {
  Menstrual: 'Energy can be lower. Lighter sessions are fine if you need them; iron-rich foods help.',
  Follicular: 'Energy is often rising. A good week to push progression.',
  Ovulatory: 'Many people feel strongest here. Warm up well.',
  Luteal: 'Appetite, fatigue and bloating can rise. Slightly higher intake and weight are normal.',
  Late: 'Period is later than your average. Cycles vary with stress, sleep, illness and training load.',
};
const PHASE_COLOR = { Menstrual: 'pink', Follicular: 'mint', Ovulatory: 'blue', Luteal: 'yellow', Late: 'pink' };

// used by AI prompts so coaching and food estimates can account for cycle phase
function healthContext() {
  const bits = [];
  if (tracksCycle()) { const c = cycleInfo(); if (c) bits.push(`Menstrual cycle: day ${c.cd}, ${c.phase.toLowerCase()} phase (estimated).`); }
  const n = daysSinceBO();
  if (n != null && n >= 3) bits.push(`Bowels not opened for ${n} days.`);
  const sy = Object.entries(symDay(today()).items).map(([s, v]) => `${s} (${SEV[v]})`);
  if (sy.length) bits.push(`Symptoms today: ${sy.join(', ')}.`);
  return bits.join(' ');
}

// ---------- view ----------
V.health = () => {
  const subs = [['day', 'Log'], ...(tracksCycle() ? [['cycle', 'Cycle']] : []), ['history', 'History']];
  if (!subs.some(s => s[0] === ui.healthSub)) ui.healthSub = 'day';
  let html = `<div class="seg">${subs.map(([k, l]) => `<button class="${ui.healthSub === k ? 'on' : ''}" data-act="healthSub" data-arg="${k}">${l}</button>`).join('')}</div>`;
  return html + ({ day: healthDayView, cycle: cycleView, history: healthHistoryView })[ui.healthSub]();
};
A.healthSub = k => { ui.healthSub = k; render(); };
A.healthDay = n => { ui.healthDate = addDays(ui.healthDate || today(), num(n)); if (ui.healthDate > today()) ui.healthDate = today(); render(); };

function healthDayView() {
  const k = ui.healthDate || (ui.healthDate = today());
  let html = `<div class="row between" style="margin-bottom:12px"><button class="btn sm round-btn" data-act="healthDay" data-arg="-1">‹</button>
    <b>${k === today() ? 'Today' : fmtDate(k)}</b><button class="btn sm round-btn" data-act="healthDay" data-arg="1" ${k >= today() ? 'disabled' : ''}>›</button></div>`;
  html += bowelCard(k);
  if (tracksCycle()) html += periodCard(k);
  html += symptomsCard(k);
  return html;
}

function bowelCard(k) {
  const b = bowelDay(k), n = daysSinceBO();
  const since = n == null ? '' : `<span class="tag ${n >= 3 ? 'warn' : 'good'}">Last opened ${boLabel(n)}</span>`;
  const lax = b.laxative || {};
  return `<div class="card"><h2>Bowels ${k === today() ? since : ''}</h2>
    <div class="eyebrow" style="margin-bottom:6px">Opened bowels</div>
    <div class="row">${Object.entries(BO_SIZES).map(([s, l]) => `<button class="btn grow" data-act="boAdd" data-arg="${s}" aria-label="Add ${l}">+ ${s}</button>`).join('')}</div>
    ${b.events.length ? `<ul class="list" style="margin-top:8px">${b.events.map(e => `<li data-act="boEdit" data-arg="${e.id}"><span class="tag" style="background:var(--${e.size === 'S' ? 'mint' : e.size === 'M' ? 'yellow' : 'pink'});color:#111;min-width:32px;text-align:center">${e.size}</span><div class="grow"><div class="num">${esc(e.time)} · ${BO_SIZES[e.size]}</div><div class="meta">${e.bristol ? `Bristol ${e.bristol}: ${BRISTOL[e.bristol]}` : 'Tap to add Bristol type or notes'}${e.notes ? ' · ' + esc(e.notes) : ''}</div></div><span class="muted">›</span></li>`).join('')}</ul>`
      : `<div class="chips" style="margin-top:10px"><button class="chip ${b.none ? 'on' : ''}" data-act="boNone">Not opened${k === today() ? ' today' : ''}</button></div>`}
    <hr><div class="eyebrow" style="margin-bottom:6px">Laxatives needed?</div>
    <div class="chips"><button class="chip ${!lax.taken ? 'on' : ''}" data-act="laxSet" data-arg="0">No</button><button class="chip ${lax.taken ? 'on' : ''}" data-act="laxSet" data-arg="1">Yes</button></div>
    ${lax.taken ? `<div class="grid2" style="margin-top:10px"><label class="f"><span>Which</span><input type="text" list="laxlist" value="${esc(lax.name)}" data-input="laxField" data-arg="name" placeholder="e.g. Movicol"></label><label class="f"><span>Dose</span><input type="text" value="${esc(lax.dose)}" data-input="laxField" data-arg="dose" placeholder="e.g. 1 sachet"></label></div>
      <datalist id="laxlist">${LAXATIVES.map(l => `<option value="${esc(l)}">`).join('')}</datalist>` : ''}</div>`;
}
A.boAdd = size => {
  const k = ui.healthDate || today(), b = ensureBowel(k);
  const time = k === today() ? new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : '12:00';
  b.events.push({ id: uid(), size, time, bristol: null, notes: '' });
  b.events.sort((x, y) => x.time.localeCompare(y.time));
  b.none = false; save(); toast(`Logged ${BO_SIZES[size].toLowerCase()} at ${time}`); render();
};
A.boNone = () => { const b = ensureBowel(ui.healthDate || today()); b.none = !b.none; save(); render(); };
A.boEdit = id => {
  const k = ui.healthDate || today(), e = bowelDay(k).events.find(x => x.id === id);
  if (!e) return;
  openModal(`<h2>Bowel motion<button class="x" data-act="close">×</button></h2><form data-form="boSave"><input type="hidden" name="id" value="${id}">
    <div class="grid2"><label class="f"><span>Time</span><input type="text" name="time" value="${esc(e.time)}" inputmode="numeric"></label>
    <label class="f"><span>Size</span><select name="size">${Object.entries(BO_SIZES).map(([s, l]) => `<option value="${s}" ${s === e.size ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="f"><span>Bristol stool type (optional)</span><select name="bristol"><option value="">Not recorded</option>${BRISTOL.slice(1).map((d, i) => `<option value="${i + 1}" ${e.bristol === i + 1 ? 'selected' : ''}>Type ${i + 1}: ${d}</option>`).join('')}</select></label>
    <label class="f"><span>Notes</span><input type="text" name="notes" value="${esc(e.notes)}" placeholder="e.g. straining, urgency, blood"></label>
    <button class="btn primary block">Save</button></form><button class="btn ghost danger block" style="margin-top:8px" data-act="boDel" data-arg="${id}">Delete</button>`);
};
F.boSave = d => {
  const b = ensureBowel(ui.healthDate || today()), e = b.events.find(x => x.id === d.id);
  Object.assign(e, { time: d.time, size: d.size, bristol: d.bristol ? +d.bristol : null, notes: d.notes });
  b.events.sort((x, y) => x.time.localeCompare(y.time));
  save(); closeModal(); render();
};
A.boDel = id => { const b = ensureBowel(ui.healthDate || today()); b.events = b.events.filter(x => x.id !== id); save(); closeModal(); render(); };
A.laxSet = v => { const b = ensureBowel(ui.healthDate || today()); b.laxative = { ...(b.laxative || {}), taken: v === '1' }; save(); render(); };
I.laxField = el => { const b = ensureBowel(ui.healthDate || today()); b.laxative[el.dataset.arg] = el.value; saveSoon(); };

function periodCard(k) {
  const f = flowOn(k), c = cycleInfo(k);
  return `<div class="card"><h2>Period ${c ? `<span class="tag" style="background:var(--${PHASE_COLOR[c.phase]});color:#111">Day ${c.cd} · ${c.phase}</span>` : ''}</h2>
    <div class="chips">${FLOWS.map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-act="flowSet" data-arg="${v}">${l}</button>`).join('')}</div>
    ${!periodStarts().length ? '<p class="small muted" style="margin:10px 0 0">Log the days of your period (tap a flow). After one period the app estimates your cycle; it gets more accurate over a few cycles.</p>' : ''}</div>`;
}
A.flowSet = v => {
  const k = ui.healthDate || today();
  if (v) S.cycle.days[k] = { flow: v }; else delete S.cycle.days[k];
  save(); render();
};

function symptomsCard(k) {
  const s = symDay(k), list = [...new Set([...SYMPTOMS, ...S.symptomList, ...Object.keys(s.items)])];
  const on = Object.entries(s.items);
  return `<div class="card"><h2>Symptoms <span class="small muted">tap again for severity</span></h2>
    <div class="chips">${list.map(n => { const v = s.items[n] || 0; return `<button class="chip ${v ? 'on' : ''}" style="${v === 1 ? 'background:var(--yellow);border-color:var(--yellow);color:#111' : v === 2 ? 'background:var(--pink);border-color:var(--pink);color:#111' : ''}" data-act="symTap" data-arg="${esc(n)}">${esc(n)}${v ? ` · ${SEV[v]}` : ''}</button>`; }).join('')}</div>
    <form data-form="symAdd" class="row" style="margin-top:12px"><input type="text" name="name" placeholder="Add another symptom"><button class="btn">Add</button></form>
    <label class="f" style="margin:12px 0 0"><span>Notes</span><textarea data-input="symNotes" placeholder="Anything else worth remembering">${esc(s.notes)}</textarea></label>
    ${on.length ? `<p class="small muted" style="margin:8px 0 0">${on.length} symptom${on.length > 1 ? 's' : ''} logged</p>` : ''}</div>`;
}
A.symTap = n => {
  const s = ensureSym(ui.healthDate || today()), v = ((s.items[n] || 0) + 1) % 4;
  if (v) s.items[n] = v; else delete s.items[n];
  save(); render();
};
F.symAdd = d => {
  const n = d.name.trim();
  if (!n) return;
  const name = n[0].toUpperCase() + n.slice(1);
  if (!SYMPTOMS.includes(name) && !S.symptomList.includes(name)) S.symptomList.push(name);
  ensureSym(ui.healthDate || today()).items[name] = 1;
  save(); render();
};
I.symNotes = el => { ensureSym(ui.healthDate || today()).notes = el.value; saveSoon(); };

// ---------- cycle view ----------
function cycleView() {
  const st = cycleStats(), c = cycleInfo(today(), st);
  let html = '';
  if (c) {
    html += `<div class="card ${PHASE_COLOR[c.phase]} hero"><div class="eyebrow">Cycle day ${c.cd}</div><h2>${c.phase} phase</h2>
      <p>${c.daysToNext > 0 ? `Next period in about <b>${c.daysToNext} day${c.daysToNext > 1 ? 's' : ''}</b> (${fmtDate(c.next, { day: 'numeric', month: 'short' })})` : c.daysToNext === 0 ? 'Period expected today' : `Period ${-c.daysToNext} day${c.daysToNext < -1 ? 's' : ''} later than your average`}</p>
      <p class="small" style="margin-top:8px;max-width:66%">${PHASE_NOTE[c.phase]}</p>${blob('var(--cream)', 2)}</div>`;
  } else {
    html += `<div class="card pink hero"><div class="eyebrow">Cycle</div><h2>Start tracking</h2><p>Tap the first day of your last period on the calendar, then pick the flow. Predictions appear straight away.</p>${blob('var(--cream)', 2)}</div>`;
  }
  html += `<div class="card"><div class="grid3"><div class="stat pink"><div class="v num">${st.avgLen}</div><div class="l">avg cycle (days)${st.lens.length ? '' : ' · default'}</div></div>
    <div class="stat yellow"><div class="v num">${st.avgPeriod}</div><div class="l">avg period (days)</div></div>
    <div class="stat blue"><div class="v num">${st.range ? `${st.range[0]}–${st.range[1]}` : st.starts.length}</div><div class="l">${st.range ? 'cycle range' : 'periods logged'}</div></div></div>
    ${c ? `<p class="small muted" style="margin:10px 0 0">Estimated ovulation ${fmtDate(c.ov, { day: 'numeric', month: 'short' })}. Estimates only; not reliable for contraception.</p>` : ''}</div>`;
  html += calendarCard(st);
  if (st.starts.length) {
    html += `<div class="card"><h2>Past cycles</h2><table class="t"><tr><th>Started</th><th>Period</th><th>Cycle</th></tr>${st.starts.map((s, i) => `<tr><td>${fmtDate(s, { day: 'numeric', month: 'short', year: '2-digit' })}</td><td class="num">${st.pLens[i]} d</td><td class="num">${st.starts[i + 1] ? daysBetween(s, st.starts[i + 1]) + ' d' : 'current'}</td></tr>`).reverse().join('')}</table></div>`;
  }
  return html;
}
function calendarCard(st) {
  const m = ui.calMonth || today().slice(0, 7), [y, mo] = m.split('-').map(Number);
  const first = `${m}-01`, startPad = weekdayIdx(first), daysIn = new Date(y, mo, 0).getDate();
  // predicted periods and fertile windows for the next 3 cycles
  const pred = new Set(), fert = new Set(), ovs = new Set();
  if (st.last) {
    for (let n = 1; n <= 3; n++) {
      const s = addDays(st.last, st.avgLen * n);
      for (let i = 0; i < st.avgPeriod; i++) pred.add(addDays(s, i));
    }
    for (let n = 0; n <= 3; n++) {
      const ov = addDays(st.last, st.avgLen * n + st.avgLen - 15);
      ovs.add(ov);
      for (let i = -5; i <= 1; i++) fert.add(addDays(ov, i));
    }
  }
  const sym = k => Object.keys(symDay(k).items).length > 0;
  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<div></div>';
  for (let d = 1; d <= daysIn; d++) {
    const k = `${m}-${String(d).padStart(2, '0')}`, f = flowOn(k), fut = k > today();
    let bg = 'transparent', border = 'transparent', color = 'var(--text)';
    if (f) { bg = f === 'spotting' ? 'transparent' : 'var(--pink)'; border = 'var(--pink)'; color = f === 'spotting' ? 'var(--text)' : '#111'; }
    else if (pred.has(k) && fut) border = 'var(--pink)';
    else if (ovs.has(k)) { bg = 'var(--blue)'; color = '#111'; }
    else if (fert.has(k)) { bg = 'color-mix(in srgb, var(--blue) 45%, transparent)'; }
    const isToday = k === today();
    cells += `<button data-act="calDay" data-arg="${k}" ${fut ? 'disabled' : ''} style="aspect-ratio:1;border-radius:50%;border:2px ${pred.has(k) && !f ? 'dashed' : 'solid'} ${isToday ? 'var(--ink)' : border};background:${bg};color:${color};font-weight:${isToday ? 800 : 700};font-size:13px;position:relative;cursor:pointer;opacity:${fut ? 0.75 : 1}">${d}${sym(k) ? '<i style="position:absolute;bottom:3px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--ink)"></i>' : ''}</button>`;
  }
  const prevM = dkey(new Date(y, mo - 2, 1)).slice(0, 7), nextM = dkey(new Date(y, mo, 1)).slice(0, 7);
  return `<div class="card"><div class="row between" style="margin-bottom:10px"><button class="btn sm round-btn" data-act="calMonth" data-arg="${prevM}">‹</button><b>${new Date(y, mo - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</b><button class="btn sm round-btn" data-act="calMonth" data-arg="${nextM}">›</button></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center" class="small muted">${DAYS.map(d => `<div>${d[0]}</div>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:4px">${cells}</div>
    <div class="legend"><span><i class="dot" style="background:var(--pink)"></i>period</span><span><i class="dot" style="border:2px dashed var(--pink)"></i>predicted</span><span><i class="dot" style="background:color-mix(in srgb, var(--blue) 45%, transparent)"></i>fertile (est.)</span><span><i class="dot" style="background:var(--blue)"></i>ovulation (est.)</span><span><i class="dot" style="background:var(--ink);width:5px;height:5px"></i>symptoms</span></div>
    <p class="small muted" style="margin:8px 0 0">Tap a day to log flow, bowels or symptoms for it.</p></div>`;
}
A.calMonth = m => { ui.calMonth = m; render(); };
A.calDay = k => { ui.healthDate = k; ui.healthSub = 'day'; render(); };

// ---------- history ----------
function healthHistoryView() {
  const days = Array.from({ length: 30 }, (_, i) => addDays(today(), -i));
  const boDays7 = days.slice(0, 7).filter(k => bowelDay(k).events.length).length;
  const boCount30 = days.reduce((a, k) => a + bowelDay(k).events.length, 0);
  const laxDays = days.filter(k => bowelDay(k).laxative?.taken).length;
  // longest run of days without a BO within the last 30 days (only counting days you logged something about bowels, or any day after first log)
  let gap = 0, run = 0;
  [...days].reverse().forEach(k => { if (bowelDay(k).events.length) run = 0; else if (S.bowels[k] || Object.keys(S.bowels).some(x => x < k)) { run++; gap = Math.max(gap, run); } });
  const n = daysSinceBO();
  const counts = {};
  days.forEach(k => Object.keys(symDay(k).items).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  let html = `<div class="card"><h2>Bowels <span class="small muted">last 30 days</span></h2><div class="grid2">
    <div class="stat ${n != null && n >= 3 ? 'pink' : 'mint'}"><div class="v">${n == null ? '–' : boLabel(n)}</div><div class="l">last opened</div></div>
    <div class="stat yellow"><div class="v num">${boDays7}/7</div><div class="l">days opened this week</div></div>
    <div class="stat blue"><div class="v num">${r1(boCount30 / 30)}</div><div class="l">motions per day (avg)</div></div>
    <div class="stat"><div class="v num">${laxDays}</div><div class="l">days laxatives needed</div></div></div>
    ${gap >= 3 ? `<p class="small" style="margin:10px 0 0">Longest gap: <b>${gap} days</b> without opening bowels.</p>` : ''}</div>`;
  if (top.length) html += `<div class="card"><h2>Most common symptoms <span class="small muted">days, last 30</span></h2>${barRows(top.map(([s, c]) => ({ label: s, value: c })), 'var(--ink)', '')}</div>`;

  html += `<div class="card"><h2>Daily log</h2><ul class="list">${days.map(k => {
    const b = bowelDay(k), f = flowOn(k), sy = Object.entries(symDay(k).items);
    const parts = [
      b.events.length ? `💩 ${b.events.map(e => e.size + (e.bristol ? `(${e.bristol})` : '')).join(', ')}` : b.none ? '💩 not opened' : '',
      b.laxative?.taken ? `💊 ${esc(b.laxative.name || 'laxative')}${b.laxative.dose ? ' ' + esc(b.laxative.dose) : ''}` : '',
      f ? `🩸 ${f}` : '',
      sy.length ? sy.map(([s, v]) => `${esc(s)}${v > 1 ? ` (${SEV[v]})` : ''}`).join(', ') : '',
    ].filter(Boolean);
    if (!parts.length) return '';
    return `<li data-act="calDay" data-arg="${k}"><div style="min-width:74px" class="small"><b>${fmtDate(k, { weekday: 'short', day: 'numeric', month: 'short' })}</b></div><div class="grow small">${parts.join('<br>')}</div><span class="muted">›</span></li>`;
  }).join('') || '<li class="muted small">Nothing logged in the last 30 days.</li>'}</ul></div>`;
  return html;
}

// ---------- Today card ----------
function healthTodayCard() {
  const n = daysSinceBO(), c = tracksCycle() ? cycleInfo() : null, b = bowelDay(today());
  const sy = Object.keys(symDay(today()).items);
  return `<div class="card"><h2>Health <button class="btn sm" data-act="go" data-arg="health">Open <span class="arrow-dot">→</span></button></h2>
    <div class="row wrap" style="margin-bottom:10px">${n != null ? `<span class="tag ${n >= 3 ? 'warn' : 'good'}">BO ${boLabel(n)}</span>` : ''}${c ? `<span class="tag" style="background:var(--${PHASE_COLOR[c.phase]});color:#111">Cycle day ${c.cd} · ${c.phase}</span>` : ''}${b.laxative?.taken ? '<span class="tag">💊 laxative</span>' : ''}${sy.length ? `<span class="tag">${sy.length} symptom${sy.length > 1 ? 's' : ''}</span>` : ''}</div>
    <div class="row"><span class="small muted" style="min-width:74px">Opened bowels</span>${Object.keys(BO_SIZES).map(s => `<button class="btn sm grow" data-act="boAddToday" data-arg="${s}">+ ${s}</button>`).join('')}</div></div>`;
}
A.boAddToday = s => { ui.healthDate = today(); A.boAdd(s); };
