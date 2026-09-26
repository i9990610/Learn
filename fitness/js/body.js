'use strict';
// Body: weight trend, measurements, progress photos.

V.body = () => {
  let html = `<div class="seg">${[['weight', 'Weight'], ['measure', 'Measurements'], ['photos', 'Photos']].map(([k, l]) => `<button class="${ui.bodySub === k ? 'on' : ''}" data-act="bodySub" data-arg="${k}">${l}</button>`).join('')}</div>`;
  return html + ({ weight: weightView, measure: measureView, photos: photosView })[ui.bodySub]();
};
A.bodySub = k => { ui.bodySub = k; render(); };

function weightView() {
  const ws = sortedWeights(), cur = latestWeight();
  const avg7 = avgWeight(today(), 7), avgPrev = avgWeight(addDays(today(), -7), 7);
  const rate = weightRate(28), gw = num(S.profile.goalWeight, 0);
  let html = `<div class="card"><form data-form="weight"><div class="grid2"><label class="f"><span>Weight (kg)</span><input type="number" step="0.1" inputmode="decimal" name="kg" required></label><label class="f"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label></div><button class="btn primary block">Save weight</button></form></div>`;
  html += `<div class="card"><div class="grid2">
    <div class="stat"><div class="v num">${cur ?? '–'} kg</div><div class="l">latest</div></div>
    <div class="stat"><div class="v num">${avg7 ? r1(avg7) : '–'} kg</div><div class="l">7-day average${avg7 && avgPrev ? ` (${avg7 - avgPrev >= 0 ? '+' : ''}${r1(avg7 - avgPrev)} vs last wk)` : ''}</div></div>
    <div class="stat"><div class="v num">${rate != null ? (rate >= 0 ? '+' : '') + r1(rate) : '–'} kg</div><div class="l">per week (4-wk trend)</div></div>
    <div class="stat"><div class="v num">${gw && cur ? r1(cur - gw) + ' kg' : '–'}</div><div class="l">${gw ? `to goal (${gw} kg)` : 'set a goal weight in Settings'}</div></div></div>
    ${rate != null && S.profile.goal !== 'maintain' ? `<p class="small muted" style="margin-top:8px">${rateAdvice(rate)}</p>` : ''}</div>`;
  // chart: raw weigh-ins as dots, 7-day rolling average as the line
  const from = ui.chartRange ? addDays(today(), -ui.chartRange) : '0000';
  const pts = ws.filter(w => w.date >= from);
  const avgPts = pts.map(w => ({ x: parseKey(w.date).getTime(), y: r1(avgWeight(w.date, 7)) }));
  html += `<div class="card"><h2>Trend <span class="chips">${[[30, '30d'], [90, '90d'], [365, '1y'], [0, 'All']].map(([v, l]) => `<button class="chip ${ui.chartRange === v ? 'on' : ''}" data-act="range" data-arg="${v}">${l}</button>`).join('')}</span></h2>
    ${lineChart('weight', [
      { name: 'Weigh-in', color: 'var(--muted)', points: pts.map(w => ({ x: parseKey(w.date).getTime(), y: w.kg })), dots: true, line: false, dotR: 3 },
      { name: '7-day average', color: 'var(--accent)', points: avgPts, width: 2.5 },
    ], { unit: ' kg', target: gw || null })}</div>`;
  if (ws.length) html += `<div class="card"><h2>Entries</h2><ul class="list">${ws.slice(-30).reverse().map(w => `<li><span class="grow">${fmtDate(w.date)}</span><b class="num">${w.kg} kg</b><button class="x" data-act="delWeight" data-arg="${w.date}">×</button></li>`).join('')}</ul></div>`;
  return html;
}
function rateAdvice(rate) {
  const p = S.profile, want = p.goal === 'lose' ? -p.rateKg : p.rateKg;
  const diff = rate - want;
  if (Math.abs(diff) < 0.15) return 'Right on your target rate. Keep going.';
  const kcal = r0(Math.abs(diff) * 7700 / 7 / 50) * 50;
  if (p.goal === 'lose') return diff > 0 ? `Losing slower than planned. A ~${kcal} kcal/day reduction would close the gap (or add steps).` : `Losing faster than planned. Consider adding ~${kcal} kcal/day to protect muscle and performance.`;
  return diff < 0 ? `Gaining slower than planned. Try adding ~${kcal} kcal/day.` : `Gaining faster than planned. Trim ~${kcal} kcal/day to limit fat gain.`;
}
A.range = v => { ui.chartRange = num(v); render(); };
F.weight = d => { setWeight(d.date || today(), num(d.kg)); toast('Saved'); render(); };
A.delWeight = date => { S.weights = S.weights.filter(w => w.date !== date); save(); render(); };

const MEASURES = [['waist', 'Waist'], ['hips', 'Hips'], ['chest', 'Chest'], ['arm', 'Arm (flexed)'], ['thigh', 'Thigh'], ['neck', 'Neck'], ['bf', 'Body fat %']];
function measureView() {
  const ms = [...S.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const first = ms[0], last = ms[ms.length - 1];
  let html = `<div class="card"><h2>New measurements <span class="small muted">cm</span></h2><form data-form="measure"><label class="f"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
    <div class="grid2">${MEASURES.map(([k, l]) => `<label class="f"><span>${l}</span><input type="number" step="0.1" inputmode="decimal" name="${k}" placeholder="${last?.[k] ?? ''}"></label>`).join('')}</div>
    <p class="small muted">Measure first thing in the morning, same spot each time. Every 2–4 weeks is plenty.</p><button class="btn primary block">Save</button></form></div>`;
  if (ms.length) {
    html += `<div class="card"><h2>Progress</h2><table class="t"><tr><th></th><th>Start</th><th>Latest</th><th>Change</th></tr>${MEASURES.map(([k, l]) => {
      const a = ms.find(m => m[k]), b = [...ms].reverse().find(m => m[k]);
      if (!a) return '';
      const dlt = r1(b[k] - a[k]);
      return `<tr><td>${l}</td><td class="num">${a[k]}</td><td class="num">${b[k]}</td><td class="num">${dlt > 0 ? '+' : ''}${dlt}</td></tr>`;
    }).join('')}</table><p class="small muted">${fmtDate(first.date)} → ${fmtDate(last.date)}</p></div>
    <div class="card"><h2>History</h2><ul class="list">${ms.slice().reverse().map(m => `<li><div class="grow"><div>${fmtDate(m.date)}</div><div class="meta">${MEASURES.filter(([k]) => m[k]).map(([k, l]) => `${l} ${m[k]}`).join(' · ')}</div></div><button class="x" data-act="delMeasure" data-arg="${m.date}">×</button></li>`).join('')}</ul></div>`;
  }
  return html;
}
F.measure = d => {
  const m = { date: d.date || today() };
  let any = false;
  for (const [k] of MEASURES) if (d[k] !== '') { m[k] = r1(num(d[k])); any = true; }
  if (!any) return toast('Enter at least one measurement');
  S.measurements = S.measurements.filter(x => x.date !== m.date);
  S.measurements.push(m); save(); toast('Saved'); render();
};
A.delMeasure = date => { if (confirm('Delete this entry?')) { S.measurements = S.measurements.filter(m => m.date !== date); save(); render(); } };

// photos
let photoCache = null;
function photosView() {
  if (!photoCache) {
    photoDB.all().then(p => { photoCache = p.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts); if (ui.tab === 'body') render(); }).catch(() => { photoCache = []; render(); });
    return '<div class="empty"><span class="spinner"></span></div>';
  }
  let html = `<div class="card"><h2>Add progress photo</h2><div class="grid2"><label class="f"><span>Pose</span><select id="pose"><option>Front</option><option>Side</option><option>Back</option><option>Other</option></select></label><label class="f"><span>Date</span><input type="date" id="photoDate" value="${today()}" max="${today()}"></label></div>
    <label class="btn primary block">📷 Take or choose photo<input type="file" accept="image/*" data-input="addPhoto" hidden></label>
    <p class="small muted">Photos stay on this phone only (not in backups). Same lighting, time of day and pose each time makes comparisons useful.</p></div>`;
  if (!photoCache.length) return html + '<div class="empty">No photos yet.</div>';
  if (ui.compare.length === 2) {
    const [a, b] = ui.compare.map(id => photoCache.find(p => p.id === id)).sort((x, y) => x.date.localeCompare(y.date));
    if (a && b) html += `<div class="card"><h2>Compare <button class="btn sm ghost" data-act="clearCompare">Close</button></h2><div class="compare"><div><img src="${a.data}" alt=""><div class="small muted">${fmtDate(a.date)} · ${esc(a.pose)}</div></div><div><img src="${b.data}" alt=""><div class="small muted">${fmtDate(b.date)} · ${esc(b.pose)}</div></div></div><p class="small muted">${daysBetween(a.date, b.date)} days apart</p></div>`;
  }
  html += `<div class="card"><h2>Gallery <span class="small muted">${ui.compare.length === 1 ? 'pick one more to compare' : 'tap to view'}</span></h2>
    <div class="row" style="margin-bottom:8px"><button class="btn sm ${ui.comparing ? 'primary' : ''}" data-act="toggleCompare">${ui.comparing ? 'Select 2 photos' : 'Compare'}</button></div>
    <div class="photos">${photoCache.map(p => `<figure data-act="photo" data-arg="${p.id}" style="${ui.compare.includes(p.id) ? 'outline:3px solid var(--accent)' : ''}"><img src="${p.data}" alt="" loading="lazy"><figcaption>${fmtDate(p.date, { day: 'numeric', month: 'short', year: '2-digit' })} · ${esc(p.pose)}</figcaption></figure>`).join('')}</div></div>`;
  return html;
}
I.addPhoto = async el => {
  const f = el.files[0];
  if (!f) return;
  try {
    const data = await resizeImage(f, 1080, 0.8);
    await photoDB.put({ id: uid(), date: $('#photoDate').value || today(), pose: $('#pose').value, data, ts: Date.now() });
    photoCache = null; toast('Photo saved'); render();
  } catch (e) { toast('Could not save photo: ' + e.message); }
};
A.toggleCompare = () => { ui.comparing = !ui.comparing; ui.compare = []; render(); };
A.clearCompare = () => { ui.compare = []; ui.comparing = false; render(); };
A.photo = id => {
  if (ui.comparing) {
    ui.compare = ui.compare.includes(id) ? ui.compare.filter(x => x !== id) : [...ui.compare, id].slice(-2);
    if (ui.compare.length === 2) ui.comparing = false;
    render(); if (ui.compare.length === 2) window.scrollTo(0, 0);
    return;
  }
  const p = photoCache.find(x => x.id === id);
  openModal(`<h2>${fmtDate(p.date)} · ${esc(p.pose)}<button class="x" data-act="close">×</button></h2><img src="${p.data}" style="width:100%;border-radius:10px" alt=""><hr><button class="btn danger block" data-act="delPhoto" data-arg="${p.id}">Delete photo</button>`);
};
A.delPhoto = async id => { if (!confirm('Delete this photo?')) return; await photoDB.del(id); photoCache = null; closeModal(); render(); };
