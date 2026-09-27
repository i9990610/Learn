'use strict';
// Food log with automatic AI calorie estimates + AI nutrition chat.

// Shared estimation rules: the user prefers to over- rather than under-estimate.
const ESTIMATE_RULES = `Estimate portions and macros using Australian Food Composition Database (AUSNUT/AFCD) style values and typical Australian serving sizes, brands and cafe/takeaway portions.
For every item work out a realistic LOW and HIGH calorie estimate, then LOG THE HIGH ESTIMATE as "kcal" (the user deliberately prefers to overestimate): unless they say otherwise, assume a generous portion, cooking oil or butter used in preparation, full-fat dairy, regular (not diet) drinks, and sauces/dressings included.
Protein, carbs and fat must be consistent with the logged high "kcal" (4/4/9 kcal per g, within ~5%).
Break mixed meals into sensible components (e.g. burger: bun, patty, cheese, sauce; or keep a known menu item whole). Use known nutrition info for chain/brand items when you recognise them.
Always make a best estimate; never ask the user to look anything up.`;
const ITEM_SHAPE = `{"name": "string", "qty": "e.g. 150 g / 1 large", "meal": "Breakfast|Lunch|Dinner|Snacks", "kcal_low": number, "kcal": number (the HIGH estimate), "protein": number, "carbs": number, "fat": number, "assumption": "short, e.g. assumed 1 tbsp oil"}`;
const MEAL_COLOR = { Breakfast: 'yellow', Lunch: 'mint', Dinner: 'blue', Snacks: 'pink' };

V.food = () => {
  const k = ui.foodDate || (ui.foodDate = today());
  const t = dayTotals(k), T = S.targets;
  let html = `<div class="row between" style="margin-bottom:10px">
    <button class="btn sm round-btn" data-act="foodDay" data-arg="-1">‹</button>
    <div style="text-align:center"><b>${k === today() ? 'Today' : fmtDate(k)}</b><div class="small muted num">${r0(t.kcal)} / ${T.kcal} kcal · P ${r0(t.p)} · C ${r0(t.c)} · F ${r0(t.f)}</div></div>
    <button class="btn sm round-btn" data-act="foodDay" data-arg="1" ${k >= today() ? 'disabled' : ''}>›</button></div>
    <div class="seg"><button class="${ui.foodSub === 'log' ? 'on' : ''}" data-act="foodSub" data-arg="log">Food log</button><button class="${ui.foodSub === 'ai' ? 'on' : ''}" data-act="foodSub" data-arg="ai">Ask AI</button></div>`;
  html += ui.foodSub === 'ai' ? foodChat(k) : foodLog(k);
  return html;
};

// ---------- automatic AI logging ----------
function quickLogCard(k, { compact = false } = {}) {
  if (!aiReady()) {
    return `<div class="card yellow"><h2>Log food</h2><p class="small">Add an Anthropic or OpenAI key in Settings and just type what you ate. Calories and macros are estimated and logged for you.</p><div class="row"><button class="btn primary" data-act="go" data-arg="settings">Add key</button><button class="btn" data-act="addFoodManual">Enter manually</button></div></div>`;
  }
  const meal = ui.logMeal || 'Auto', busy = ui.busy === 'log';
  let html = `<div class="card yellow"><h2>What did you eat?</h2><form data-form="aiLog">
    ${ui.logImage ? `<div class="row small" style="margin-bottom:8px"><img src="${ui.logImage}" style="width:52px;height:52px;object-fit:cover;border-radius:12px"> Photo attached <button type="button" class="x" data-act="clearLogImage">×</button></div>` : ''}
    <div class="row" style="align-items:flex-end"><label class="btn round-btn" style="background:var(--surface);border-color:#111;color:#111" aria-label="Add photo">📷<input type="file" accept="image/*" capture="environment" data-input="logImage" hidden></label>
    <textarea name="text" class="grow" rows="2" data-enter placeholder="e.g. burrito bowl + large flat white" style="min-height:48px;border-radius:20px">${esc(ui.logDraft || '')}</textarea>
    <button class="btn primary sm round-btn" style="background:#111;border-color:#111;color:#fff" ${busy ? 'disabled' : ''} aria-label="Log">${busy ? '<span class="spinner"></span>' : '<svg viewBox="0 0 24 24" width="20" height="20" stroke-width="2.6"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'}</button></div>
    ${compact ? '' : `<div class="chips" style="margin-top:10px">${['Auto', ...MEALS].map(m => `<button type="button" class="chip ${m === meal ? 'on' : ''}" style="${m === meal ? 'background:#111;border-color:#111;color:#fff' : 'background:transparent;border-color:rgba(17,17,17,.25);color:#111'}" data-act="pickLogMeal" data-arg="${m}">${m}</button>`).join('')}</div>`}
    <p class="small muted" style="margin:8px 0 0">Logged automatically using the higher calorie estimate${k === today() ? '' : ` · to ${fmtDate(k)}`}.</p></form></div>`;
  html += lastLogCard(k);
  return html;
}

function lastLogCard(k) {
  const L = ui.lastLog;
  if (!L || L.date !== k) return '';
  if (L.error) return `<div class="card" style="background:var(--pink);color:#111"><b>Couldn't log that.</b><div class="small">${esc(L.error)}</div></div>`;
  if (!L.ids.length) return L.note ? `<div class="card"><div class="small">${esc(L.note)}</div></div>` : '';
  const items = dayFood(k).filter(e => L.ids.includes(e.id));
  if (!items.length) return '';
  const tot = items.reduce((a, e) => a + e.kcal, 0);
  return `<div class="card"><div class="row between"><div><span class="tag good">Logged ✓</span> <b class="num">${r0(tot)} kcal</b> <span class="small muted">to ${esc(items[0].meal)}</span></div><button class="btn sm" data-act="undoLog">Undo</button></div>
    <ul class="list" style="margin-top:6px">${items.map(e => `<li><div class="grow" data-act="editFood" data-arg="${e.id}"><div>${esc(e.name)}${e.qty ? ` <span class="muted small">(${esc(e.qty)})</span>` : ''}</div><div class="meta num">${e.kcal} kcal${e.low ? ` (est. ${e.low}–${e.kcal})` : ''} · P ${e.p} · C ${e.c} · F ${e.f}${e.note ? ` · ${esc(e.note)}` : ''}</div></div></li>`).join('')}</ul>
    ${L.note ? `<p class="small muted" style="margin:6px 0 0">${esc(L.note)}</p>` : ''}<p class="small muted" style="margin:4px 0 0">Tap an item to adjust it.</p></div>`;
}

async function aiLogFood({ text, image, date, meal }) {
  const t = dayTotals(date);
  const system = `You are the calorie-estimation engine inside a food-tracking app. The user types or photographs what they ate and you return items the app logs automatically without asking them anything. ${userContext()}
${ESTIMATE_RULES}
Meal: ${meal && meal !== 'Auto' ? `log everything to ${meal}.` : `use the meal the user mentions; otherwise "${defaultMeal()}" (it's currently ${new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}).`}
Already logged on ${date}: ${r0(t.kcal)} kcal. If the message isn't about food they ate (e.g. a question), return an empty items array and answer briefly in "note".
JSON shape: {"items": [${ITEM_SHAPE}], "note": "optional one short line, e.g. key assumption or a nudge about remaining protein"}`;
  const content = image
    ? [{ type: 'image', mediaType: 'image/jpeg', data: image.split(',')[1] }, { type: 'text', text: text || 'Estimate everything I ate in this photo.' }]
    : text;
  const out = await aiJSON(system, [{ role: 'user', content }], { effort: 'low', maxTokens: 4000 });
  const items = (Array.isArray(out.items) ? out.items : []).filter(x => x && x.name);
  const forced = meal && meal !== 'Auto' ? meal : null;
  const entries = items.map(x => addFood(date, {
    name: x.name, qty: x.qty || '', meal: forced || (MEALS.includes(x.meal) ? x.meal : defaultMeal()),
    kcal: Math.max(num(x.kcal), num(x.kcal_low)), p: x.protein, c: x.carbs, f: x.fat,
    low: num(x.kcal_low) && num(x.kcal_low) < num(x.kcal) ? r0(num(x.kcal_low)) : null, note: x.assumption || '', ai: true,
  }));
  save();
  return { ids: entries.map(e => e.id), note: out.note || '', entries };
}

F.aiLog = async d => {
  const text = d.text.trim(), image = ui.logImage;
  if ((!text && !image) || ui.busy) return;
  ui.logDraft = text; ui.busy = 'log'; render();
  const date = ui.tab === 'food' ? ui.foodDate : today();
  try {
    const r = await aiLogFood({ text, image, date, meal: ui.logMeal });
    ui.lastLog = { date, ...r };
    ui.logDraft = ''; ui.logImage = null;
    if (r.ids.length) toast(`Logged ${r0(r.entries.reduce((a, e) => a + e.kcal, 0))} kcal`);
  } catch (e) { ui.lastLog = { date, ids: [], error: e.message }; }
  ui.busy = false; render();
};
A.pickLogMeal = m => { ui.logMeal = m; const ta = $('[data-form=aiLog] textarea'); if (ta) ui.logDraft = ta.value; render(); };
I.logImage = async el => {
  const file = el.files[0];
  if (!file) return;
  const ta = $('[data-form=aiLog] textarea'); if (ta) ui.logDraft = ta.value;
  try { ui.logImage = await resizeImage(file, 1024, 0.75); render(); } catch (e) { toast(e.message); }
};
A.clearLogImage = () => { ui.logImage = null; render(); };
A.undoLog = () => {
  const L = ui.lastLog;
  if (!L) return;
  S.food[L.date] = dayFood(L.date).filter(e => !L.ids.includes(e.id));
  ui.lastLog = null; save(); toast('Removed'); render();
};

// ---------- food log ----------
function foodLog(k) {
  const t = dayTotals(k), T = S.targets;
  let html = quickLogCard(k);
  html += `<div class="card">${macroBar('Protein', t.p, T.protein, 'var(--protein)')}${macroBar('Carbs', t.c, T.carbs, 'var(--carbs)')}${macroBar('Fat', t.f, T.fat, 'var(--fat)')}
    <div class="small muted">Calories from macros: P ${r0(t.p * 4)} · C ${r0(t.c * 4)} · F ${r0(t.f * 9)} kcal</div></div>`;

  const recents = recentFoods();
  if (S.savedFoods.length || recents.length) {
    html += `<div class="card"><h2>Log again <span class="small muted">one tap</span></h2><div class="chips scroller">${S.savedFoods.map((f, i) => `<button class="chip tint" data-act="quickFood" data-arg="s${i}">★ ${esc(f.name)}</button>`).join('')}${recents.map((f, i) => `<button class="chip" data-act="quickFood" data-arg="r${i}">${esc(f.name)}</button>`).join('')}</div></div>`;
  }

  for (const m of MEALS) {
    const items = dayFood(k).filter(e => e.meal === m);
    const kc = items.reduce((a, e) => a + num(e.kcal), 0);
    html += `<div class="card"><h2><span class="row"><i class="dot" style="background:var(--${MEAL_COLOR[m]});width:14px;height:14px"></i>${m}</span> <span class="row"><span class="small muted num">${r0(kc)} kcal</span><button class="btn sm" data-act="addFood" data-arg="${m}">+ Add</button></span></h2>
      ${items.length ? `<ul class="list">${items.map(e => `<li><span class="bullet" style="background:var(--${MEAL_COLOR[m]})"></span><div class="grow" data-act="editFood" data-arg="${e.id}"><div>${esc(e.name)}${e.qty ? ` <span class="muted small">(${esc(e.qty)})</span>` : ''}</div><div class="meta num">${e.kcal} kcal${e.low ? ` <span title="estimate range">(est. ${e.low}–${e.kcal})</span>` : ''} · P ${e.p} · C ${e.c} · F ${e.f}</div></div><button class="x" data-act="delFood" data-arg="${e.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : '<div class="small muted">Nothing yet.</div>'}</div>`;
  }

  const pts = [];
  for (let i = 6; i >= 0; i--) { const d = addDays(k, -i); pts.push({ label: fmtDate(d, { weekday: 'short' }), value: dayTotals(d).kcal }); }
  const max = Math.max(T.kcal * 1.2, ...pts.map(p => p.value));
  html += `<div class="card"><h2>Last 7 days</h2><svg viewBox="0 0 320 140" style="width:100%">
    ${pts.map((p, i) => { const h = (p.value / max) * 100, x = 10 + i * 44; return `<rect x="${x}" y="${110 - h}" width="32" height="${Math.max(h, 0)}" rx="8" stroke="none" fill="var(--${PASTELS[i % 4]})"><title>${p.label}: ${r0(p.value)} kcal</title></rect><text x="${x + 16}" y="128" text-anchor="middle" font-size="11" fill="var(--muted)" stroke="none">${p.label}</text>${p.value ? `<text x="${x + 16}" y="${105 - h}" text-anchor="middle" font-size="10" fill="var(--text-2)" stroke="none">${r0(p.value)}</text>` : ''}`; }).join('')}
    <line x1="4" x2="316" y1="${110 - (T.kcal / max) * 100}" y2="${110 - (T.kcal / max) * 100}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1.5"/></svg>
    <div class="legend"><span>- - target ${T.kcal} kcal</span><span>7-day avg ${r0(pts.reduce((a, p) => a + p.value, 0) / 7)} kcal</span></div></div>`;
  return html;
}

function recentFoods() {
  const seen = new Set(S.savedFoods.map(f => f.name.toLowerCase())), out = [];
  for (let i = 0; i < 14 && out.length < 8; i++) {
    for (const e of [...dayFood(addDays(today(), -i))].reverse()) {
      const n = e.name.toLowerCase();
      if (!seen.has(n)) { seen.add(n); out.push(e); if (out.length >= 8) break; }
    }
  }
  ui._recents = out;
  return out;
}

function foodForm(e = {}, meal) {
  return `<h2>${e.id ? 'Edit food' : 'Enter manually'}<button class="x" data-act="close">×</button></h2>
  <form data-form="saveFood"><input type="hidden" name="id" value="${e.id || ''}">
  <label class="f"><span>Food</span><input type="text" name="name" value="${esc(e.name || '')}" required></label>
  <div class="grid2"><label class="f"><span>Amount</span><input type="text" name="qty" value="${esc(e.qty || '')}" placeholder="e.g. 150 g"></label>
  <label class="f"><span>Meal</span><select name="meal">${MEALS.map(m => `<option ${m === (e.meal || meal) ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
  <div class="grid2"><label class="f"><span>Calories (kcal)</span><input type="number" inputmode="decimal" name="kcal" value="${e.kcal ?? ''}" required></label>
  <label class="f"><span>Servings ×</span><input type="number" inputmode="decimal" step="0.25" name="mult" value="1"></label></div>
  <div class="grid3"><label class="f"><span>Protein g</span><input type="number" inputmode="decimal" step="0.1" name="p" value="${e.p ?? ''}"></label>
  <label class="f"><span>Carbs g</span><input type="number" inputmode="decimal" step="0.1" name="c" value="${e.c ?? ''}"></label>
  <label class="f"><span>Fat g</span><input type="number" inputmode="decimal" step="0.1" name="f" value="${e.f ?? ''}"></label></div>
  ${e.note ? `<p class="small muted">AI assumed: ${esc(e.note)}</p>` : ''}
  <label class="row small" style="margin-bottom:12px"><input type="checkbox" class="check" name="fav"> Save to one-tap favourites</label>
  <button class="btn primary block">Save</button></form>`;
}

// "+ Add" on a meal: describe it and the AI logs it to that meal
A.addFood = meal => {
  if (!aiReady()) return openModal(foodForm({}, meal || defaultMeal()));
  openModal(`<h2>Add to ${esc(meal)}<button class="x" data-act="close">×</button></h2><form data-form="aiLogModal"><input type="hidden" name="meal" value="${esc(meal)}">
    <textarea name="text" rows="3" data-enter placeholder="Describe what you had, e.g. 2 slices of pepperoni pizza and a can of Coke" required></textarea>
    <button class="btn primary block" style="margin-top:10px" id="aiModalBtn">Estimate &amp; log</button></form>
    <button class="btn ghost block" style="margin-top:8px" data-act="addFoodManual" data-arg="${esc(meal)}">Enter calories manually instead</button>`);
};
F.aiLogModal = async (d, form) => {
  const btn = $('#aiModalBtn', form);
  aiBusyButton(btn, true);
  try {
    const r = await aiLogFood({ text: d.text.trim(), date: ui.foodDate, meal: d.meal });
    ui.lastLog = { date: ui.foodDate, ...r };
    closeModal(); window.scrollTo(0, 0);
  } catch (e) { aiBusyButton(btn, false); return toast(e.message, 4000); }
  render();
};
A.addFoodManual = meal => openModal(foodForm({}, meal || defaultMeal()));

A.foodDay = arg => { ui.foodDate = addDays(ui.foodDate, num(arg)); if (ui.foodDate > today()) ui.foodDate = today(); render(); };
A.foodSub = arg => { ui.foodSub = arg; render(); };
A.editFood = id => { const e = dayFood(ui.tab === 'food' ? ui.foodDate : today()).find(x => x.id === id); if (e) openModal(foodForm(e)); };
A.delFood = id => { S.food[ui.foodDate] = dayFood(ui.foodDate).filter(e => e.id !== id); save(); render(); };
A.quickFood = arg => {
  const src = arg[0] === 's' ? S.savedFoods[+arg.slice(1)] : ui._recents[+arg.slice(1)];
  if (!src) return;
  const { id, meal, ...rest } = src;
  const e = addFood(ui.foodDate, { ...rest, meal: ui.logMeal && ui.logMeal !== 'Auto' ? ui.logMeal : defaultMeal() });
  ui.lastLog = { date: ui.foodDate, ids: [e.id], note: '' };
  save(); toast(`Logged ${e.name}`); render();
};
F.saveFood = d => {
  const m = num(d.mult, 1) || 1;
  const e = { name: d.name.trim(), qty: d.qty.trim(), meal: d.meal, kcal: num(d.kcal) * m, p: num(d.p) * m, c: num(d.c) * m, f: num(d.f) * m };
  if (m !== 1 && e.qty) e.qty = `${m} × ${e.qty}`;
  const date = ui.tab === 'food' ? ui.foodDate : today();
  if (d.id) {
    const list = dayFood(date), i = list.findIndex(x => x.id === d.id);
    if (i >= 0) {
      const changed = r0(e.kcal) !== list[i].kcal;
      list[i] = { ...list[i], ...e, kcal: r0(e.kcal), p: r1(e.p), c: r1(e.c), f: r1(e.f) };
      if (changed) list[i].low = null;
    }
  } else addFood(date, e);
  if (d.fav) {
    S.savedFoods = S.savedFoods.filter(f => f.name.toLowerCase() !== e.name.toLowerCase());
    S.savedFoods.unshift({ name: e.name, qty: e.qty, kcal: r0(e.kcal), p: r1(e.p), c: r1(e.c), f: r1(e.f) });
    S.savedFoods = S.savedFoods.slice(0, 20);
  }
  save(); closeModal(); render();
};

// ---------- AI chat (questions; food mentioned as eaten is logged automatically) ----------
function foodChat(k) {
  let html = '';
  if (!aiReady()) html += `<div class="card"><p class="small">Add an Anthropic or OpenAI API key in Settings to chat about macros and log meals by describing them (or snapping a photo).</p><button class="btn block" data-act="go" data-arg="settings">Open settings</button></div>`;
  html += `<div class="chat" id="chat">`;
  if (!S.chat.length) {
    html += `<div class="bot">${blob('var(--yellow)', 0)}<div class="msg assistant">Ask me anything about your food and macros, e.g. "how much protein do I have left?" or "what should I have for dinner?". If you tell me something you ate, I'll log it for you automatically.</div></div>`;
  }
  S.chat.forEach((m, i) => {
    if (m.role === 'user') html += `<div class="msg user">${m.image ? '<div class="small">📷 photo</div>' : ''}${esc(m.text)}</div>`;
    else if (m.role === 'error') html += `<div class="msg error small">${esc(m.text)}</div>`;
    else html += `<div class="bot">${blob('var(--yellow)', 0)}<div class="msg assistant">${esc(m.text)}${m.items?.length ? proposal(m, i) : ''}</div></div>`;
  });
  if (ui.busy === 'chat') html += `<div class="bot">${blob('var(--yellow)', 0)}<div class="msg assistant"><span class="spinner"></span></div></div>`;
  html += `</div>
  <div class="chips scroller" style="margin-bottom:8px">${['How much protein do I have left today?', 'High-protein snack under 300 kcal', 'What should I have for dinner?'].map(q => `<button class="chip tint" data-act="chatQuick" data-arg="${esc(q)}">${esc(q)}</button>`).join('')}</div>
  <form class="composer" data-form="chat">
    ${ui.pendingImage ? `<div class="row small" style="margin-bottom:6px"><img src="${ui.pendingImage}" style="width:48px;height:48px;object-fit:cover;border-radius:6px"> Photo attached <button type="button" class="x" data-act="clearImage">×</button></div>` : ''}
    <div class="row"><label class="btn round-btn" aria-label="Attach photo">📷<input type="file" accept="image/*" capture="environment" data-input="chatImage" hidden></label>
    <textarea name="text" class="grow" rows="1" placeholder="Ask about food or macros"></textarea>
    <button class="btn primary sm round-btn" ${ui.busy ? 'disabled' : ''} aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" stroke-width="2.6"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div>
    <div class="row between small muted" style="margin-top:4px"><span>Food logs to: ${k === today() ? 'today' : fmtDate(k)}</span>${S.chat.length ? '<button type="button" class="btn sm ghost" data-act="clearChat">Clear chat</button>' : ''}</div>
  </form>`;
  return html;
}

function proposal(m, i) {
  const tot = m.items.reduce((a, x) => ({ kcal: a.kcal + num(x.kcal), p: a.p + num(x.protein), c: a.c + num(x.carbs), f: a.f + num(x.fat) }), { kcal: 0, p: 0, c: 0, f: 0 });
  return `<div class="proposal">${m.items.map(x => `<div class="it"><div class="grow"><b>${esc(x.name)}</b>${x.qty ? ` <span class="muted">${esc(x.qty)}</span>` : ''}<div class="muted num">${r0(num(x.kcal))} kcal${num(x.kcal_low) ? ` (est. ${r0(num(x.kcal_low))}–${r0(num(x.kcal))})` : ''} · P ${r1(num(x.protein))} · C ${r1(num(x.carbs))} · F ${r1(num(x.fat))}</div></div></div>`).join('')}
    <div class="small num" style="margin:4px 0 8px"><b>Total ${r0(tot.kcal)} kcal</b> · P ${r0(tot.p)} · C ${r0(tot.c)} · F ${r0(tot.f)}</div>
    ${m.undone ? '<span class="tag">Removed</span>' : `<div class="row"><span class="tag good">Logged ✓${m.meal ? ' to ' + esc(m.meal) : ''}</span><button class="btn sm" data-act="undoChatLog" data-arg="${i}">Undo</button></div>`}</div>`;
}

I.chatImage = async el => {
  const file = el.files[0];
  if (!file) return;
  try { ui.pendingImage = await resizeImage(file, 1024, 0.75); render(); }
  catch (e) { toast(e.message); }
};
A.clearImage = () => { ui.pendingImage = null; render(); };
A.clearChat = () => { if (confirm('Clear the chat history?')) { S.chat = []; save(); render(); } };
A.chatQuick = q => sendChat(q);
F.chat = d => sendChat(d.text.trim());
A.undoChatLog = i => {
  const m = S.chat[+i];
  if (!m || !m.ids) return;
  S.food[m.date] = dayFood(m.date).filter(e => !m.ids.includes(e.id));
  m.undone = true; save(); toast('Removed from log'); render();
};

async function sendChat(text) {
  if (!text && !ui.pendingImage) return;
  if (ui.busy) return;
  const k = ui.foodDate, t = dayTotals(k), T = S.targets;
  const img = ui.pendingImage;
  S.chat.push({ role: 'user', text: text || 'Estimate and log what is in this photo.', image: !!img });
  ui.pendingImage = null; ui.busy = 'chat'; render(); scrollChat();

  const system = `You are a practical sports dietitian inside a food-tracking app. ${userContext()}
Logged so far on ${k}: ${r0(t.kcal)} kcal, P ${r0(t.p)} g, C ${r0(t.c)} g, F ${r0(t.f)} g. Remaining: ${r0(T.kcal - t.kcal)} kcal, P ${r0(T.protein - t.p)} g, C ${r0(T.carbs - t.c)} g, F ${r0(T.fat - t.f)} g.
Entries today: ${dayFood(k).map(e => `${e.meal}: ${e.name} ${e.qty} (${e.kcal} kcal)`).join('; ') || 'none'}.
Only when the user says they ate or are eating something (or sends a photo of their food), return those foods as items: the app logs them automatically. Never return items for food they are only asking about or considering.
${ESTIMATE_RULES}
Default meal if they don't say: "${defaultMeal()}".
JSON shape: {"reply": "short conversational answer, plain text, under 120 words", "items": [${ITEM_SHAPE}]}`;

  const hist = S.chat.filter(m => m.role !== 'error').slice(-13, -1).map(m => ({ role: m.role, content: m.role === 'assistant' ? m.raw || m.text : m.text }));
  const cur = img ? [{ type: 'image', mediaType: 'image/jpeg', data: img.split(',')[1] }, { type: 'text', text: text || 'Estimate and log this meal.' }] : text;
  try {
    const out = await aiJSON(system, [...hist, { role: 'user', content: cur }], { effort: 'low', maxTokens: 4000 });
    const items = (Array.isArray(out.items) ? out.items : []).filter(x => x && x.name).map(x => ({ ...x, kcal: Math.max(num(x.kcal), num(x.kcal_low)) }));
    const msg = { role: 'assistant', text: out.reply || '', items, raw: JSON.stringify(out) };
    if (items.length) {
      const entries = items.map(x => addFood(k, { name: x.name, qty: x.qty || '', meal: MEALS.includes(x.meal) ? x.meal : defaultMeal(), kcal: x.kcal, p: x.protein, c: x.carbs, f: x.fat,
        low: num(x.kcal_low) && num(x.kcal_low) < x.kcal ? r0(num(x.kcal_low)) : null, note: x.assumption || '', ai: true }));
      Object.assign(msg, { ids: entries.map(e => e.id), date: k, meal: [...new Set(entries.map(e => e.meal))].join(', ') });
    }
    S.chat.push(msg);
  } catch (e) {
    S.chat.push({ role: 'error', text: e.message });
  }
  S.chat = S.chat.slice(-60);
  ui.busy = false; save(); render(); scrollChat();
}
function scrollChat() { requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); }
