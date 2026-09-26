'use strict';
// Food log + AI nutrition chat.

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

function foodLog(k) {
  const t = dayTotals(k), T = S.targets;
  let html = `<div class="card">${macroBar('Protein', t.p, T.protein, 'var(--protein)')}${macroBar('Carbs', t.c, T.carbs, 'var(--carbs)')}${macroBar('Fat', t.f, T.fat, 'var(--fat)')}
    <div class="small muted">Calories from macros: P ${r0(t.p * 4)} · C ${r0(t.c * 4)} · F ${r0(t.f * 9)} kcal</div></div>`;

  // quick add
  const recents = recentFoods();
  if (S.savedFoods.length || recents.length) {
    html += `<div class="card"><h2>Quick add</h2><div class="chips scroller">${S.savedFoods.map((f, i) => `<button class="chip tint" data-act="quickFood" data-arg="s${i}">★ ${esc(f.name)}</button>`).join('')}${recents.map((f, i) => `<button class="chip" data-act="quickFood" data-arg="r${i}">${esc(f.name)}</button>`).join('')}</div></div>`;
  }

  const mealColor = { Breakfast: 'yellow', Lunch: 'mint', Dinner: 'blue', Snacks: 'pink' };
  for (const m of MEALS) {
    const items = dayFood(k).filter(e => e.meal === m);
    const kc = items.reduce((a, e) => a + num(e.kcal), 0);
    html += `<div class="card"><h2><span class="row"><i class="dot" style="background:var(--${mealColor[m]});width:14px;height:14px"></i>${m}</span> <span class="row"><span class="small muted num">${r0(kc)} kcal</span><button class="btn sm" data-act="addFood" data-arg="${m}">+ Add</button></span></h2>
      ${items.length ? `<ul class="list">${items.map(e => `<li><span class="bullet" style="background:var(--${mealColor[m]})"></span><div class="grow" data-act="editFood" data-arg="${e.id}"><div>${esc(e.name)}${e.qty ? ` <span class="muted small">(${esc(e.qty)})</span>` : ''}</div><div class="meta num">${e.kcal} kcal · P ${e.p} · C ${e.c} · F ${e.f}</div></div><button class="x" data-act="delFood" data-arg="${e.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : '<div class="small muted">Nothing yet.</div>'}</div>`;
  }

  // last 7 days
  const pts = [];
  for (let i = 6; i >= 0; i--) { const d = addDays(k, -i); pts.push({ label: fmtDate(d, { weekday: 'short' }), value: dayTotals(d).kcal }); }
  const max = Math.max(T.kcal * 1.2, ...pts.map(p => p.value));
  html += `<div class="card"><h2>Last 7 days</h2><svg viewBox="0 0 320 140" style="width:100%">
    ${pts.map((p, i) => { const h = (p.value / max) * 100, x = 10 + i * 44; return `<rect x="${x}" y="${110 - h}" width="32" height="${Math.max(h, 0)}" rx="8" fill="var(--${['yellow', 'pink', 'mint', 'blue'][i % 4]})"><title>${p.label}: ${r0(p.value)} kcal</title></rect><text x="${x + 16}" y="128" text-anchor="middle" font-size="11" fill="var(--muted)" stroke="none">${p.label}</text>${p.value ? `<text x="${x + 16}" y="${105 - h}" text-anchor="middle" font-size="10" fill="var(--text-2)" stroke="none">${r0(p.value)}</text>` : ''}`; }).join('')}
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
  return `<h2>${e.id ? 'Edit food' : 'Add food'}<button class="x" data-act="close">×</button></h2>
  <form data-form="saveFood"><input type="hidden" name="id" value="${e.id || ''}">
  <label class="f"><span>Food</span><input type="text" name="name" value="${esc(e.name || '')}" required></label>
  <div class="grid2"><label class="f"><span>Amount</span><input type="text" name="qty" value="${esc(e.qty || '')}" placeholder="e.g. 150 g"></label>
  <label class="f"><span>Meal</span><select name="meal">${MEALS.map(m => `<option ${m === (e.meal || meal) ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
  <div class="grid2"><label class="f"><span>Calories (kcal)</span><input type="number" inputmode="decimal" name="kcal" value="${e.kcal ?? ''}" required></label>
  <label class="f"><span>Servings ×</span><input type="number" inputmode="decimal" step="0.25" name="mult" value="1"></label></div>
  <div class="grid3"><label class="f"><span>Protein g</span><input type="number" inputmode="decimal" step="0.1" name="p" value="${e.p ?? ''}"></label>
  <label class="f"><span>Carbs g</span><input type="number" inputmode="decimal" step="0.1" name="c" value="${e.c ?? ''}"></label>
  <label class="f"><span>Fat g</span><input type="number" inputmode="decimal" step="0.1" name="f" value="${e.f ?? ''}"></label></div>
  <label class="row small" style="margin-bottom:12px"><input type="checkbox" class="check" name="fav"> Save to quick-add favourites</label>
  <button class="btn primary block">Save</button></form>`;
}

A.foodDay = arg => { ui.foodDate = addDays(ui.foodDate, num(arg)); if (ui.foodDate > today()) ui.foodDate = today(); render(); };
A.foodSub = arg => { ui.foodSub = arg; render(); };
A.addFood = arg => openModal(foodForm({}, arg || defaultMeal()));
A.editFood = id => { const e = dayFood(ui.foodDate).find(x => x.id === id); if (e) openModal(foodForm(e)); };
A.delFood = id => { S.food[ui.foodDate] = dayFood(ui.foodDate).filter(e => e.id !== id); save(); render(); };
A.quickFood = arg => {
  const src = arg[0] === 's' ? S.savedFoods[+arg.slice(1)] : ui._recents[+arg.slice(1)];
  if (!src) return;
  const { id, ...rest } = src;
  openModal(foodForm({ ...rest, meal: defaultMeal() }));
};
F.saveFood = d => {
  const m = num(d.mult, 1) || 1;
  const e = { name: d.name.trim(), qty: d.qty.trim(), meal: d.meal, kcal: num(d.kcal) * m, p: num(d.p) * m, c: num(d.c) * m, f: num(d.f) * m };
  if (m !== 1 && e.qty) e.qty = `${m} × ${e.qty}`;
  if (d.id) {
    const list = dayFood(ui.foodDate), i = list.findIndex(x => x.id === d.id);
    if (i >= 0) list[i] = { ...list[i], ...e, kcal: r0(e.kcal), p: r1(e.p), c: r1(e.c), f: r1(e.f) };
  } else addFood(ui.foodDate, e);
  if (d.fav) {
    S.savedFoods = S.savedFoods.filter(f => f.name.toLowerCase() !== e.name.toLowerCase());
    S.savedFoods.unshift({ name: e.name, qty: e.qty, kcal: r0(e.kcal), p: r1(e.p), c: r1(e.c), f: r1(e.f) });
    S.savedFoods = S.savedFoods.slice(0, 20);
  }
  save(); closeModal(); render();
};

// ---------- AI chat ----------
function foodChat(k) {
  let html = '';
  if (!aiReady()) html += `<div class="card"><p class="small">Add an Anthropic or OpenAI API key in Settings to chat about macros and log meals by describing them (or snapping a photo).</p><button class="btn block" data-act="go" data-arg="settings">Open settings</button></div>`;
  html += `<div class="chat" id="chat">`;
  if (!S.chat.length) {
    html += `<div class="bot">${blob('var(--yellow)', 0)}<div class="msg assistant">Tell me what you ate and I'll work out the macros and log it, e.g. "2 eggs on sourdough with avo, flat white with full cream". You can also send a photo of your plate, or ask things like "how much protein do I have left?"</div></div>`;
  }
  S.chat.forEach((m, i) => {
    if (m.role === 'user') html += `<div class="msg user">${m.image ? '<div class="small">📷 photo</div>' : ''}${esc(m.text)}</div>`;
    else if (m.role === 'error') html += `<div class="msg error small">${esc(m.text)}</div>`;
    else html += `<div class="bot">${blob('var(--yellow)', 0)}<div class="msg assistant">${esc(m.text)}${m.items?.length ? proposal(m, i) : ''}</div></div>`;
  });
  if (ui.busy === 'chat') html += `<div class="bot">${blob('var(--yellow)', 0)}<div class="msg assistant"><span class="spinner"></span></div></div>`;
  html += `</div>
  <div class="chips scroller" style="margin-bottom:8px">${['How much protein do I have left today?', 'High-protein snack under 300 kcal', 'Is my macro split right for my goal?'].map(q => `<button class="chip tint" data-act="chatQuick" data-arg="${esc(q)}">${esc(q)}</button>`).join('')}</div>
  <form class="composer" data-form="chat">
    ${ui.pendingImage ? `<div class="row small" style="margin-bottom:6px"><img src="${ui.pendingImage}" style="width:48px;height:48px;object-fit:cover;border-radius:6px"> Photo attached <button type="button" class="x" data-act="clearImage">×</button></div>` : ''}
    <div class="row"><label class="btn round-btn" aria-label="Attach photo">📷<input type="file" accept="image/*" capture="environment" data-input="chatImage" hidden></label>
    <textarea name="text" class="grow" rows="1" placeholder="What did you eat?"></textarea>
    <button class="btn primary sm round-btn" ${ui.busy ? 'disabled' : ''} aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" stroke-width="2.6"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div>
    <div class="row between small muted" style="margin-top:4px"><span>Logs to: ${k === today() ? 'today' : fmtDate(k)}</span>${S.chat.length ? '<button type="button" class="btn sm ghost" data-act="clearChat">Clear chat</button>' : ''}</div>
  </form>`;
  return html;
}

function proposal(m, i) {
  const tot = m.items.reduce((a, x) => ({ kcal: a.kcal + num(x.kcal), p: a.p + num(x.protein), c: a.c + num(x.carbs), f: a.f + num(x.fat) }), { kcal: 0, p: 0, c: 0, f: 0 });
  return `<div class="proposal">${m.items.map(x => `<div class="it"><div class="grow"><b>${esc(x.name)}</b>${x.qty ? ` <span class="muted">${esc(x.qty)}</span>` : ''}<div class="muted num">${r0(num(x.kcal))} kcal · P ${r1(num(x.protein))} · C ${r1(num(x.carbs))} · F ${r1(num(x.fat))}</div></div></div>`).join('')}
    <div class="small num" style="margin:4px 0 8px"><b>Total ${r0(tot.kcal)} kcal</b> · P ${r0(tot.p)} · C ${r0(tot.c)} · F ${r0(tot.f)}</div>
    ${m.logged ? '<span class="tag good">Logged ✓</span>' : `<div class="row wrap"><select data-meal-for="${i}" style="width:auto;min-height:32px;padding:4px 8px;font-size:13px">${MEALS.map(x => `<option ${x === (m.items[0].meal || defaultMeal()) ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn sm primary" data-act="logProposal" data-arg="${i}">Log all</button></div>`}</div>`;
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
A.logProposal = i => {
  const m = S.chat[+i];
  if (!m || m.logged) return;
  const meal = $(`[data-meal-for="${i}"]`)?.value || defaultMeal();
  m.items.forEach(x => addFood(ui.foodDate, { name: x.name, qty: x.qty || '', meal, kcal: x.kcal, p: x.protein, c: x.carbs, f: x.fat }));
  m.logged = true; save(); toast(`Logged to ${meal}`); render();
};

async function sendChat(text) {
  if (!text && !ui.pendingImage) return;
  if (ui.busy) return;
  const k = ui.foodDate, t = dayTotals(k), T = S.targets;
  const img = ui.pendingImage;
  S.chat.push({ role: 'user', text: text || 'What is in this photo? Estimate and log it.', image: !!img });
  ui.pendingImage = null; ui.busy = 'chat'; render(); scrollChat();

  const system = `You are a practical sports dietitian inside a food-tracking app. ${userContext()}
Logged so far on ${k}: ${r0(t.kcal)} kcal, P ${r0(t.p)} g, C ${r0(t.c)} g, F ${r0(t.f)} g. Remaining: ${r0(T.kcal - t.kcal)} kcal, P ${r0(T.protein - t.p)} g, C ${r0(T.carbs - t.c)} g, F ${r0(T.fat - t.f)} g.
Entries today: ${dayFood(k).map(e => `${e.meal}: ${e.name} ${e.qty} (${e.kcal} kcal)`).join('; ') || 'none'}.
When the user describes or photographs food they ate, estimate realistic portions and macros using AUSFOODS / Australian Food Composition Database style values and return them as items so the app can log them. Break mixed meals into sensible components. If portion size is genuinely unclear, make a reasonable assumption and state it in the reply. When the user is only asking a question, answer it concisely and return an empty items array.
JSON shape: {"reply": "short conversational answer, plain text, under 120 words", "items": [{"name": "string", "qty": "e.g. 150 g", "meal": "Breakfast|Lunch|Dinner|Snacks", "kcal": number, "protein": number, "carbs": number, "fat": number}]}`;

  // last 12 text turns for context; images are only sent for the current message
  const hist = S.chat.filter(m => m.role !== 'error').slice(-13, -1).map(m => ({ role: m.role, content: m.role === 'assistant' ? m.raw || m.text : m.text }));
  const cur = img ? [{ type: 'image', mediaType: 'image/jpeg', data: img.split(',')[1] }, { type: 'text', text: text || 'Estimate and log this meal.' }] : text;
  try {
    const out = await aiJSON(system, [...hist, { role: 'user', content: cur }], { effort: 'low', maxTokens: 4000 });
    const items = Array.isArray(out.items) ? out.items.filter(x => x && x.name) : [];
    S.chat.push({ role: 'assistant', text: out.reply || (items.length ? 'Here is my estimate:' : ''), items, raw: JSON.stringify(out) });
  } catch (e) {
    S.chat.push({ role: 'error', text: e.message });
  }
  S.chat = S.chat.slice(-60);
  ui.busy = false; save(); render(); scrollChat();
}
function scrollChat() { requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); }
