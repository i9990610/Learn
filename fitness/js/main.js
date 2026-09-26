'use strict';
// Router, event delegation, boot.

const TITLES = { today: 'Today', food: 'Food', train: 'Training', meals: 'Meal plan', body: 'Body', settings: 'Settings' };

function render() {
  const view = $('#view');
  const y = window.scrollY, same = render.last === ui.tab;
  view.innerHTML = V[ui.tab]();
  $('#title').textContent = TITLES[ui.tab];
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.arg === ui.tab));
  if (same) window.scrollTo(0, y); else window.scrollTo(0, 0);
  render.last = ui.tab;
  try { sessionStorage.setItem('fitlog.tab', ui.tab); } catch {}
}

A.go = tab => { ui.tab = tab; if (tab === 'food') ui.foodDate = ui.foodDate || today(); render(); };
A.close = closeModal;

document.addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset.arg, el, e)).catch(err => { console.error(err); toast(err.message || 'Something went wrong'); });
});

document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = F[form.dataset.form];
  if (fn) Promise.resolve(fn(formData(form), form)).catch(err => { console.error(err); toast(err.message || 'Something went wrong'); });
});

const CHANGE_TYPES = new Set(['checkbox', 'radio', 'file', 'select-one', 'date']);
function onInput(e) {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const isChange = CHANGE_TYPES.has(el.type);
  if ((e.type === 'change') !== isChange) return;
  const fn = I[el.dataset.input];
  if (fn) Promise.resolve(fn(el, e)).catch(err => { console.error(err); toast(err.message || 'Something went wrong'); });
}
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);

// Enter sends in the chat composer (Shift+Enter for a newline)
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.composer textarea')) {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
});

document.addEventListener('pointermove', chartPointer);
document.addEventListener('pointerdown', chartPointer);
document.addEventListener('pointerleave', chartLeave, true);

// Refresh "today" when the app is reopened on a new day
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    if (ui.foodDate === lastDay) ui.foodDate = today();
    lastDay = today(); render();
  }
});

try { const t = sessionStorage.getItem('fitlog.tab'); if (t && V[t]) ui.tab = t; } catch {}
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
