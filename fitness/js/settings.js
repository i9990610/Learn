'use strict';
// Settings: profile & targets, AI provider/keys, backup.

const ACTIVITY = [[1.2, 'Sedentary (desk, little exercise)'], [1.375, 'Light (1–3 sessions/wk)'], [1.55, 'Moderate (3–5 sessions/wk)'], [1.725, 'High (6–7 sessions/wk or on feet all day)'], [1.9, 'Very high (hard training + physical job)']];

V.settings = () => {
  const p = S.profile, t = S.targets, a = S.ai, w = latestWeight();
  const sel = (name, opts, val) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="card"><h2>Look</h2><div class="seg" style="margin:0;box-shadow:none;background:var(--surface-2)">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match phone']].map(([v, l]) => `<button class="${(S.theme || 'light') === v ? 'on' : ''}" data-act="theme" data-arg="${v}">${l}</button>`).join('')}</div></div>
  <div class="card"><h2>Profile</h2><form data-form="profile">
    <div class="grid2"><label class="f"><span>Sex</span>${sel('sex', [['female', 'Female'], ['male', 'Male']], p.sex)}</label><label class="f"><span>Age</span><input type="number" name="age" value="${p.age}" inputmode="numeric"></label></div>
    <div class="grid2"><label class="f"><span>Height (cm)</span><input type="number" name="heightCm" value="${p.heightCm}" inputmode="decimal"></label><label class="f"><span>Weight (kg)</span><input type="number" step="0.1" name="weight" value="${w ?? ''}" inputmode="decimal" placeholder="log in Body"></label></div>
    <label class="f"><span>Activity</span>${sel('activity', ACTIVITY, p.activity)}</label>
    <div class="grid2"><label class="f"><span>Goal</span>${sel('goal', [['lose', 'Lose fat'], ['maintain', 'Maintain / recomp'], ['gain', 'Build (lean gain)']], p.goal)}</label><label class="f"><span>Rate (kg/week)</span>${sel('rateKg', [[0.1, '0.1'], [0.25, '0.25'], [0.5, '0.5'], [0.75, '0.75'], [1, '1.0']], p.rateKg)}</label></div>
    <label class="f"><span>Goal weight (kg, optional)</span><input type="number" step="0.1" name="goalWeight" value="${p.goalWeight ?? ''}" inputmode="decimal"></label>
    <button class="btn primary block">Save &amp; calculate targets</button></form>
    <p class="small muted">Uses Mifflin-St Jeor × activity, a deficit/surplus of ~7700 kcal per kg, protein 1.8–2.2 g/kg, fat ~27% of energy, carbs the rest.</p></div>

  <div class="card"><h2>Daily targets</h2><form data-form="targets">
    <div class="grid2"><label class="f"><span>Calories (kcal)</span><input type="number" name="kcal" value="${t.kcal}" inputmode="numeric"></label><label class="f"><span>Water (ml)</span><input type="number" name="waterMl" value="${t.waterMl}" inputmode="numeric"></label></div>
    <div class="grid3"><label class="f"><span>Protein g</span><input type="number" name="protein" value="${t.protein}" inputmode="numeric"></label><label class="f"><span>Carbs g</span><input type="number" name="carbs" value="${t.carbs}" inputmode="numeric"></label><label class="f"><span>Fat g</span><input type="number" name="fat" value="${t.fat}" inputmode="numeric"></label></div>
    <p class="small muted">Macros add up to ${r0(t.protein * 4 + t.carbs * 4 + t.fat * 9)} kcal.</p><button class="btn block">Save targets</button></form></div>

  <div class="card"><h2>AI coach</h2><form data-form="ai">
    <label class="f"><span>Provider</span>${sel('provider', [['anthropic', 'Claude (Anthropic)'], ['openai', 'ChatGPT (OpenAI)']], a.provider)}</label>
    <label class="f"><span>Anthropic API key</span><input type="password" name="anthropicKey" value="${esc(a.anthropicKey)}" placeholder="sk-ant-…" autocomplete="off"></label>
    <label class="f"><span>Claude model</span>${sel('anthropicModel', ANTHROPIC_MODELS, a.anthropicModel)}</label>
    <label class="f"><span>OpenAI API key</span><input type="password" name="openaiKey" value="${esc(a.openaiKey)}" placeholder="sk-…" autocomplete="off"></label>
    <label class="f"><span>OpenAI model</span><input type="text" name="openaiModel" value="${esc(a.openaiModel)}"></label>
    <div class="row"><button class="btn primary grow">Save</button><button type="button" class="btn" data-act="testAI">Test</button></div></form>
    <p class="small muted">Keys are stored only on this phone and sent directly to the provider. Get one at console.anthropic.com or platform.openai.com and set a monthly spend limit there. A typical day of food logging costs cents.</p></div>

  <div class="card"><h2>Data</h2><div class="row wrap"><button class="btn" data-act="exportData">Export backup</button><label class="btn">Import backup<input type="file" accept="application/json" data-input="importData" hidden></label><button class="btn danger" data-act="resetAll">Reset everything</button></div>
    <p class="small muted">Everything is saved on this device. Export a backup now and then (API keys and photos are not included).</p></div>
  <p class="small muted" style="text-align:center">Fit Log · version ${APP_VERSION} · not medical advice<br><button class="btn sm ghost" style="margin-top:8px" data-act="forceUpdate">Check for updates</button></p>`;
};

F.profile = d => {
  const p = S.profile;
  Object.assign(p, { sex: d.sex, age: num(d.age, 25), heightCm: num(d.heightCm, 165), activity: num(d.activity, 1.55), goal: d.goal, rateKg: num(d.rateKg, 0.25), goalWeight: d.goalWeight ? num(d.goalWeight) : null, setupDone: true });
  const kg = num(d.weight) || latestWeight();
  if (d.weight && num(d.weight) !== latestWeight()) setWeight(today(), num(d.weight));
  if (!kg) { save(); return toast('Add your weight to calculate targets'); }
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * p.activity;
  const adj = p.goal === 'lose' ? -(p.rateKg * 7700) / 7 : p.goal === 'gain' ? (p.rateKg * 7700) / 7 : 0;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const kcal = Math.max(floor, r0((tdee + adj) / 10) * 10);
  const protein = r0(kg * (p.goal === 'lose' ? 2.2 : p.goal === 'gain' ? 1.8 : 2.0));
  const fat = r0((kcal * 0.27) / 9);
  const carbs = Math.max(50, r0((kcal - protein * 4 - fat * 9) / 4));
  S.targets = { ...S.targets, kcal, protein, fat, carbs, waterMl: r0((kg * 35) / 250) * 250 };
  save(); render();
  toast(`TDEE ≈ ${r0(tdee)} kcal → target ${kcal} kcal`, 4000);
};
A.theme = v => { S.theme = v; save(); applyTheme(); render(); };
A.forceUpdate = async () => {
  toast('Updating…');
  try {
    const regs = await navigator.serviceWorker?.getRegistrations() || [];
    await Promise.all(regs.map(r => r.update().catch(() => {})));
    for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
  location.reload();
};
F.targets = d => { S.targets = { kcal: num(d.kcal), protein: num(d.protein), carbs: num(d.carbs), fat: num(d.fat), waterMl: num(d.waterMl) }; save(); toast('Targets saved'); render(); };
F.ai = d => { Object.assign(S.ai, d); save(); toast('AI settings saved'); };
A.testAI = async (_, btn) => {
  const form = btn.closest('form');
  Object.assign(S.ai, formData(form)); save();
  aiBusyButton(btn, true);
  try { const t = await aiText('Reply with exactly: OK', [{ role: 'user', content: 'Test' }], { effort: 'low', maxTokens: 2000 }); toast(`Connected ✓ (${t.trim().slice(0, 20)})`); }
  catch (e) { toast(e.message, 5000); }
  aiBusyButton(btn, false);
};
A.exportData = () => {
  const copy = JSON.parse(JSON.stringify(S));
  copy.ai.anthropicKey = ''; copy.ai.openaiKey = '';
  const blob = new Blob([JSON.stringify(copy, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `fitlog-backup-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
I.importData = async el => {
  const f = el.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data.targets || !data.profile) throw new Error('Not a Fit Log backup');
    if (!confirm('Replace all current data with this backup?')) return;
    const keys = { anthropicKey: S.ai.anthropicKey, openaiKey: S.ai.openaiKey };
    localStorage.setItem(KEY, JSON.stringify(data));
    S = load(); Object.assign(S.ai, keys); save(); toast('Backup restored'); render();
  } catch (e) { toast('Import failed: ' + e.message); }
};
A.resetAll = async () => {
  if (!confirm('Delete ALL data on this device, including photos? This cannot be undone.')) return;
  localStorage.removeItem(KEY);
  try { indexedDB.deleteDatabase('fitlog-photos'); } catch {}
  S = DEFAULT_STATE(); photoCache = null; ui.tab = 'today'; render();
};
