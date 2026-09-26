'use strict';
// Weekly meal plan (AI or manual) + grocery list built from it.

const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const CATS = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Bakery', 'Pantry', 'Frozen', 'Other'];

V.meals = () => {
  let html = `<div class="seg"><button class="${ui.mealSub === 'plan' ? 'on' : ''}" data-act="mealSub" data-arg="plan">Meal plan</button><button class="${ui.mealSub === 'grocery' ? 'on' : ''}" data-act="mealSub" data-arg="grocery">Grocery list</button></div>`;
  return html + (ui.mealSub === 'grocery' ? groceryView() : (S.mealPlan && !ui.editPrefs ? mealPlanView() : prefsView()));
};
A.mealSub = k => { ui.mealSub = k; render(); };

function prefsView() {
  const p = S.mealPrefs || { diet: 'Omnivore', mealsPerDay: '3 meals + 1 snack', cook: 'Moderate (30 min)', budget: 'Moderate', avoid: '', likes: '', notes: '' };
  const sel = (name, opts) => `<select name="${name}">${opts.map(o => `<option ${p[name] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  return `<div class="card mint hero"><div class="eyebrow">Meal plan</div><h2>What do you like to eat?</h2><p>A week of meals built around your targets.</p>${blob('var(--cream)', 1)}</div><div class="card"><form data-form="mealPrefs">
    <p class="small muted">Plans are built to hit your targets: ${S.targets.kcal} kcal, P ${S.targets.protein} g, C ${S.targets.carbs} g, F ${S.targets.fat} g.</p>
    <label class="f"><span>Diet</span>${sel('diet', ['Omnivore', 'Pescatarian', 'Vegetarian', 'Vegan', 'Halal', 'Low FODMAP', 'Gluten free'])}</label>
    <div class="grid2"><label class="f"><span>Meals per day</span>${sel('mealsPerDay', ['3 meals', '3 meals + 1 snack', '3 meals + 2 snacks', '2 meals + 1 snack'])}</label>
    <label class="f"><span>Cooking time</span>${sel('cook', ['Quick (15 min)', 'Moderate (30 min)', 'Batch cook / meal prep', 'I enjoy cooking'])}</label></div>
    <label class="f"><span>Budget</span>${sel('budget', ['Tight', 'Moderate', 'Flexible'])}</label>
    <label class="f"><span>Allergies / foods to avoid</span><input type="text" name="avoid" value="${esc(p.avoid)}" placeholder="e.g. mushrooms, shellfish"></label>
    <label class="f"><span>Foods or cuisines you like</span><input type="text" name="likes" value="${esc(p.likes)}" placeholder="e.g. Korean, Mexican, Greek yoghurt"></label>
    <label class="f"><span>Other notes</span><input type="text" name="notes" value="${esc(p.notes)}" placeholder="e.g. portable lunches for placement, repeat breakfasts fine"></label>
    <div class="row">${S.mealPlan ? '<button type="button" class="btn" data-act="cancelPrefs">Cancel</button>' : ''}<button type="button" class="btn" data-act="blankPlan">Blank plan</button><button class="btn primary grow" id="genPlan">${aiReady() ? 'Generate week with AI' : 'Save (add AI key to generate)'}</button></div>
    </form></div>`;
}
A.cancelPrefs = () => { ui.editPrefs = false; render(); };
A.blankPlan = () => {
  if (S.mealPlan && !confirm('Replace your current meal plan with a blank one?')) return;
  S.mealPlan = { weekOf: weekStart(today()), days: DAYS.map(d => ({ day: d, meals: [] })) };
  ui.editPrefs = false; save(); render();
};
F.mealPrefs = async (d, form) => {
  S.mealPrefs = d; save();
  if (!aiReady()) { toast('Preferences saved. Add an API key in Settings to generate plans.'); if (!S.mealPlan) A.blankPlan(); return; }
  const btn = $('#genPlan', form);
  aiBusyButton(btn, true);
  try {
    const out = await aiJSON(mealSystem(), [{ role: 'user', content: `Create a 7-day meal plan (Mon..Sun). Preferences: ${JSON.stringify(d)}.\nVary dinners, allow sensible repeats for breakfast/lunch to keep shopping simple, and reuse ingredients across the week to reduce waste. Each day's total should land within ~5% of my calorie target and hit protein. JSON shape:\n${MEAL_SHAPE_WEEK}` }], { effort: 'medium', maxTokens: 24000 });
    S.mealPlan = { weekOf: weekStart(today()), days: DAYS.map((day, i) => ({ day, meals: normMeals((out.days || []).find(x => (x.day || '').slice(0, 3) === day)?.meals || out.days?.[i]?.meals || []) })) };
    ui.editPrefs = false; ui.mealDay = weekdayIdx(today()); save(); toast('Meal plan ready');
  } catch (e) { toast(e.message, 4000); }
  aiBusyButton(btn, false);
  render();
};

const MEAL_OBJ = `{"slot": "Breakfast|Lunch|Dinner|Snack", "name": "string", "kcal": number, "protein": number, "carbs": number, "fat": number, "prep": "e.g. 10 min", "ingredients": [{"item": "chicken thigh fillets", "qty": number, "unit": "g|ml|pc|tbsp|tsp|cup", "cat": "Produce|Meat & seafood|Dairy & eggs|Bakery|Pantry|Frozen|Other"}], "method": "short numbered steps"}`;
const MEAL_SHAPE_WEEK = `{"days": [{"day": "Mon", "meals": [${MEAL_OBJ}]}]}  (quantities are per single serving; exactly 7 days)`;
function mealSystem() {
  return `You are an Australian accredited practising dietitian writing realistic, tasty meal plans with ingredients available at Woolworths/Coles. Macros must be accurate for the stated quantities. ${userContext()}`;
}
function normMeals(ms) {
  return ms.map(m => ({ id: uid(), slot: SLOTS.includes(m.slot) ? m.slot : 'Snack', name: m.name || 'Meal', kcal: r0(num(m.kcal)), p: r1(num(m.protein ?? m.p)), c: r1(num(m.carbs ?? m.c)), f: r1(num(m.fat ?? m.f)), prep: m.prep || '',
    ingredients: (m.ingredients || []).map(x => ({ item: String(x.item || '').trim(), qty: num(x.qty), unit: x.unit || '', cat: CATS.includes(x.cat) ? x.cat : 'Other' })).filter(x => x.item), method: m.method || '' }));
}

function mealPlanView() {
  const di = ui.mealDay ?? (ui.mealDay = weekdayIdx(today()));
  const day = S.mealPlan.days[di], T = S.targets;
  const tot = day.meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  let html = `<div class="chips scroller" style="margin-bottom:12px">${DAYS.map((d, i) => `<button class="chip ${i === di ? 'on' : ''}" data-act="mealDay" data-arg="${i}">${d}${i === weekdayIdx(today()) ? ' •' : ''}</button>`).join('')}</div>
    <div class="card"><div class="row between"><b>${day.day} total</b><span class="num">${r0(tot.kcal)} / ${T.kcal} kcal</span></div><div style="height:8px"></div>
    ${macroBar('Protein', tot.p, T.protein, 'var(--protein)')}${macroBar('Carbs', tot.c, T.carbs, 'var(--carbs)')}${macroBar('Fat', tot.f, T.fat, 'var(--fat)')}</div>`;
  const order = m => SLOTS.indexOf(m.slot);
  [...day.meals].sort((a, b) => order(a) - order(b)).forEach(m => {
    html += `<div class="card"><div class="row between"><span class="tag ${m.slot}">${m.slot}</span><span class="small muted">${esc(m.prep)}</span></div>
      <h2 style="margin:8px 0 2px">${esc(m.name)}</h2><div class="small muted num">${m.kcal} kcal · P ${m.p} · C ${m.c} · F ${m.f}</div>
      ${m.ingredients.length || m.method ? `<details><summary>Ingredients &amp; method</summary><ul>${m.ingredients.map(x => `<li>${x.qty ? r1(x.qty) + ' ' + esc(x.unit) + ' ' : ''}${esc(x.item)}</li>`).join('')}</ul>${m.method ? `<p>${esc(m.method)}</p>` : ''}</details>` : ''}
      <div class="row wrap" style="margin-top:10px"><button class="btn sm primary" data-act="logMeal" data-arg="${m.id}">Log to today</button>${aiReady() ? `<button class="btn sm" data-act="swapMeal" data-arg="${m.id}">Swap</button>` : ''}<button class="btn sm ghost" data-act="editMeal" data-arg="${m.id}">Edit</button><button class="btn sm ghost danger" data-act="delMeal" data-arg="${m.id}">Delete</button></div></div>`;
  });
  if (!day.meals.length) html += emptyState('No meals planned for this day.', 'var(--yellow)', 0);
  html += `<div class="row wrap"><button class="btn" data-act="addMeal">+ Add meal</button><button class="btn" data-act="copyDay">Copy day to…</button><div class="grow"></div><button class="btn ghost" data-act="editPrefs">${aiReady() ? 'New plan' : 'Preferences'}</button></div>`;
  return html;
}
A.mealDay = i => { ui.mealDay = +i; render(); };
A.editPrefs = () => { ui.editPrefs = true; render(); };
const findMeal = id => { for (const d of S.mealPlan.days) { const m = d.meals.find(x => x.id === id); if (m) return [d, m]; } return [null, null]; };
A.logMeal = id => {
  const [, m] = findMeal(id);
  addFood(today(), { name: m.name, qty: '1 serve', meal: m.slot === 'Snack' ? 'Snacks' : m.slot, kcal: m.kcal, p: m.p, c: m.c, f: m.f });
  save(); toast(`Logged ${m.name}`);
};
A.delMeal = id => { const [d] = findMeal(id); if (d && confirm('Delete this meal?')) { d.meals = d.meals.filter(x => x.id !== id); save(); render(); } };
A.copyDay = () => {
  const di = ui.mealDay;
  openModal(`<h2>Copy ${DAYS[di]} to…<button class="x" data-act="close">×</button></h2><form data-form="copyDay"><div class="chips" style="margin-bottom:12px">${DAYS.map((d, i) => i === di ? '' : `<label class="chip"><input type="checkbox" name="d${i}" hidden onchange="this.parentElement.classList.toggle('on',this.checked)">${d}</label>`).join('')}</div><p class="small muted">This replaces the meals on the chosen days.</p><button class="btn primary block">Copy</button></form>`);
};
F.copyDay = d => {
  const src = S.mealPlan.days[ui.mealDay].meals;
  DAYS.forEach((_, i) => { if (d['d' + i]) S.mealPlan.days[i].meals = src.map(m => ({ ...JSON.parse(JSON.stringify(m)), id: uid() })); });
  save(); closeModal(); render();
};

function mealForm(m = {}) {
  return `<h2>${m.id ? 'Edit meal' : 'Add meal'}<button class="x" data-act="close">×</button></h2><form data-form="saveMeal"><input type="hidden" name="id" value="${m.id || ''}">
    <label class="f"><span>Name</span><input type="text" name="name" value="${esc(m.name || '')}" required></label>
    <div class="grid2"><label class="f"><span>Slot</span><select name="slot">${SLOTS.map(s => `<option ${s === m.slot ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="f"><span>kcal</span><input type="number" inputmode="decimal" name="kcal" value="${m.kcal ?? ''}" required></label></div>
    <div class="grid3"><label class="f"><span>Protein g</span><input type="number" inputmode="decimal" name="p" value="${m.p ?? ''}"></label><label class="f"><span>Carbs g</span><input type="number" inputmode="decimal" name="c" value="${m.c ?? ''}"></label><label class="f"><span>Fat g</span><input type="number" inputmode="decimal" name="f" value="${m.f ?? ''}"></label></div>
    <label class="f"><span>Ingredients (one per line, e.g. "200 g chicken breast")</span><textarea name="ing" rows="5">${esc((m.ingredients || []).map(x => `${x.qty ? r1(x.qty) + ' ' : ''}${x.unit ? x.unit + ' ' : ''}${x.item}`).join('\n'))}</textarea></label>
    <label class="f"><span>Method</span><textarea name="method">${esc(m.method || '')}</textarea></label>
    <button class="btn primary block">Save</button></form>`;
}
A.addMeal = () => openModal(mealForm({ slot: 'Lunch' }));
A.editMeal = id => openModal(mealForm(findMeal(id)[1]));
F.saveMeal = d => {
  const [, old] = d.id ? findMeal(d.id) : [null, null];
  const oldCats = Object.fromEntries((old?.ingredients || []).map(x => [x.item.toLowerCase(), x.cat]));
  const ingredients = d.ing.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const mm = l.match(/^([\d.\/]+)\s*(g|kg|ml|l|pc|pcs|tbsp|tsp|cups?|x)?\s+(.+)$/i);
    const x = mm ? { qty: mm[1].includes('/') ? mm[1].split('/').reduce((a, b) => num(a) / num(b)) : num(mm[1]), unit: (mm[2] || '').toLowerCase(), item: mm[3] } : { qty: 0, unit: '', item: l };
    return { ...x, cat: oldCats[x.item.toLowerCase()] || guessCat(x.item) };
  });
  const m = { id: d.id || uid(), slot: d.slot, name: d.name, kcal: r0(num(d.kcal)), p: r1(num(d.p)), c: r1(num(d.c)), f: r1(num(d.f)), prep: old?.prep || '', ingredients, method: d.method };
  if (old) Object.assign(old, m); else S.mealPlan.days[ui.mealDay].meals.push(m);
  save(); closeModal(); render();
};
function guessCat(item) {
  const s = item.toLowerCase();
  if (/chicken|beef|pork|lamb|mince|fish|salmon|tuna|prawn|turkey|bacon|ham/.test(s)) return 'Meat & seafood';
  if (/milk|yoghurt|yogurt|cheese|egg|butter|cream|feta|cottage/.test(s)) return 'Dairy & eggs';
  if (/bread|wrap|roll|bagel|sourdough|tortilla|pita/.test(s)) return 'Bakery';
  if (/frozen|peas|edamame|berries frozen/.test(s)) return 'Frozen';
  if (/apple|banana|berr|spinach|lettuce|tomato|onion|garlic|capsicum|carrot|broccoli|potato|avocado|lemon|lime|cucumber|zucchini|herb|kale|mushroom|fruit|veg/.test(s)) return 'Produce';
  if (/rice|oat|pasta|oil|sauce|flour|bean|lentil|chickpea|spice|salt|pepper|honey|nut|seed|stock|tin|can|quinoa|noodle|protein powder/.test(s)) return 'Pantry';
  return 'Other';
}

A.swapMeal = async (id, btn) => {
  const [day, m] = findMeal(id);
  aiBusyButton(btn, true);
  try {
    const others = day.meals.filter(x => x.id !== id).map(x => x.name).join(', ');
    const out = await aiJSON(mealSystem(), [{ role: 'user', content: `Suggest a different ${m.slot.toLowerCase()} to replace "${m.name}" (${m.kcal} kcal, P ${m.p} g, C ${m.c} g, F ${m.f} g). Keep macros within ~10%. Other meals that day: ${others}. Preferences: ${JSON.stringify(S.mealPrefs || {})}. JSON shape: {"meal": ${MEAL_OBJ}}` }], { effort: 'low', maxTokens: 6000 });
    const [nm] = normMeals([out.meal || out]);
    Object.assign(m, { ...nm, id: m.id, slot: m.slot });
    save(); toast('Meal swapped');
  } catch (e) { toast(e.message, 4000); }
  aiBusyButton(btn, false);
  render();
};

// ---------- grocery ----------
function groceryView() {
  const g = S.grocery;
  let html = `<div class="card"><div class="row wrap"><button class="btn primary" data-act="buildGrocery" ${S.mealPlan ? '' : 'disabled'}>${g.items.length ? 'Rebuild' : 'Build'} from meal plan</button><button class="btn" data-act="shareGrocery" ${g.items.length ? '' : 'disabled'}>Share / copy</button><button class="btn ghost" data-act="clearChecked" ${g.items.some(i => i.checked) ? '' : 'disabled'}>Clear ticked</button></div>
    ${g.builtAt ? `<p class="small muted">Built ${fmtDate(g.builtAt)} for 7 days of meals. Rebuilding keeps items you added yourself.</p>` : ''}
    <form data-form="addGrocery" class="row" style="margin-top:8px"><input type="text" name="name" placeholder="Add item" required><button class="btn">Add</button></form></div>`;
  if (!g.items.length) return html + `<div class="empty">${blob('var(--mint)', 2)}${S.mealPlan ? 'Build the list from your meal plan, or add items.' : 'Create a meal plan first, or add items manually.'}</div>`;
  for (const cat of CATS) {
    const items = g.items.map((x, i) => ({ ...x, i })).filter(x => x.cat === cat);
    if (!items.length) continue;
    html += `<div class="card"><h2>${cat} <span class="small muted">${items.filter(x => !x.checked).length}</span></h2><ul class="list grocery">${items.sort((a, b) => a.checked - b.checked).map(x => `<li class="${x.checked ? 'done' : ''}"><input type="checkbox" class="check" ${x.checked ? 'checked' : ''} data-input="groceryTick" data-arg="${x.i}"><span class="grow name">${esc(x.name)}</span><span class="small muted num">${esc(x.amount || '')}</span><button class="x" data-act="delGrocery" data-arg="${x.i}">×</button></li>`).join('')}</ul></div>`;
  }
  return html;
}
function fmtQty(q, unit) {
  if (!q) return '';
  if (unit === 'g' && q >= 1000) return `${r1(q / 1000)} kg`;
  if (unit === 'ml' && q >= 1000) return `${r1(q / 1000)} L`;
  return `${r1(q)}${unit ? ' ' + unit : ''}`;
}
A.buildGrocery = () => {
  const agg = {};
  S.mealPlan.days.forEach(d => d.meals.forEach(m => m.ingredients.forEach(x => {
    let unit = (x.unit || '').toLowerCase(), q = num(x.qty);
    if (unit === 'kg') { unit = 'g'; q *= 1000; }
    if (unit === 'l') { unit = 'ml'; q *= 1000; }
    const key = x.item.toLowerCase().replace(/s$/, '') + '|' + unit;
    (agg[key] = agg[key] || { name: x.item, unit, q: 0, cat: x.cat || guessCat(x.item) }).q += q;
  })));
  const manual = S.grocery.items.filter(i => i.manual);
  const built = Object.values(agg).sort((a, b) => a.name.localeCompare(b.name)).map(a => ({ name: a.name, amount: fmtQty(a.q, a.unit), cat: CATS.includes(a.cat) ? a.cat : 'Other', checked: false }));
  S.grocery = { items: [...built, ...manual], builtAt: today() };
  save(); render();
};
F.addGrocery = d => { S.grocery.items.push({ name: d.name.trim(), amount: '', cat: guessCat(d.name), checked: false, manual: true }); save(); render(); };
I.groceryTick = el => { S.grocery.items[+el.dataset.arg].checked = el.checked; save(); render(); };
A.delGrocery = i => { S.grocery.items.splice(+i, 1); save(); render(); };
A.clearChecked = () => { S.grocery.items = S.grocery.items.filter(i => !i.checked); save(); render(); };
A.shareGrocery = async () => {
  const text = CATS.map(c => { const it = S.grocery.items.filter(i => i.cat === c && !i.checked); return it.length ? `${c}\n${it.map(i => `- ${i.name}${i.amount ? ' (' + i.amount + ')' : ''}`).join('\n')}` : ''; }).filter(Boolean).join('\n\n');
  try {
    if (navigator.share) await navigator.share({ title: 'Grocery list', text });
    else { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  } catch (e) { if (e.name !== 'AbortError') { await navigator.clipboard?.writeText(text); toast('Copied to clipboard'); } }
};
