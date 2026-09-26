'use strict';
// AI calls straight from the phone to Anthropic or OpenAI with the user's own key.
// Messages use a neutral shape: {role, content: string | [{type:'text',text} | {type:'image',mediaType,data}]}

const ANTHROPIC_MODELS = [
  ['claude-opus-5', 'Claude Opus 5 (best)'],
  ['claude-sonnet-5', 'Claude Sonnet 5 (cheaper, fast)'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5 (cheapest)'],
];

function aiReady() {
  const a = S.ai;
  return a.provider === 'openai' ? !!a.openaiKey : !!a.anthropicKey;
}

function toParts(content) { return typeof content === 'string' ? [{ type: 'text', text: content }] : content; }

async function callAnthropic(system, messages, { maxTokens, effort }) {
  const model = S.ai.anthropicModel || 'claude-opus-5';
  const headers = {
    'content-type': 'application/json',
    'x-api-key': S.ai.anthropicKey.trim(),
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map(m => ({
      role: m.role,
      content: toParts(m.content).map(p => p.type === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } }
        : { type: 'text', text: p.text }),
    })),
  };
  if (model !== 'claude-haiku-4-5') body.output_config = { effort };
  if (model === 'claude-opus-5') {
    // If a safety classifier declines, let the API retry on its recommended fallback model.
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${data?.error?.message || res.statusText}`);
  if (data.stop_reason === 'refusal') throw new Error('The model declined this request. Try rephrasing.');
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (data.stop_reason === 'max_tokens' && !text) throw new Error('Response was cut off. Try again.');
  return text;
}

async function callOpenAI(system, messages, { maxTokens, json }) {
  const body = {
    model: S.ai.openaiModel || 'gpt-5',
    max_completion_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'image'
        ? { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } }
        : { type: 'text', text: p.text }),
    }))],
  };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${S.ai.openaiKey.trim()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data?.error?.message || res.statusText}`);
  return data.choices?.[0]?.message?.content || '';
}

async function aiText(system, messages, opts = {}) {
  if (!aiReady()) throw new Error('Add an API key in Settings to use the AI features.');
  const o = { maxTokens: 16000, effort: 'medium', json: false, ...opts };
  // Conversation must start with a user turn and alternate roles; merge any same-role neighbours.
  const norm = [];
  for (const m of messages) {
    if (!norm.length && m.role !== 'user') continue;
    const prev = norm[norm.length - 1];
    if (prev && prev.role === m.role) prev.content = [...toParts(prev.content), ...toParts(m.content)];
    else norm.push({ ...m });
  }
  messages = norm;
  return S.ai.provider === 'openai' ? callOpenAI(system, messages, o) : callAnthropic(system, messages, o);
}

function extractJSON(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch {}
  }
  throw new Error('The AI reply was not valid JSON. Try again.');
}

async function aiJSON(system, messages, opts = {}) {
  const sys = system + '\n\nRespond with a single valid JSON object only. No markdown fences, no text outside the JSON.';
  const text = await aiText(sys, messages, { ...opts, json: true });
  return extractJSON(text);
}

// Context the model gets about the user, shared by all features
function userContext() {
  const p = S.profile, t = S.targets;
  const w = latestWeight();
  return [
    `User profile: ${p.sex}, ${p.age} y, ${p.heightCm} cm${w ? `, ${w} kg` : ''}. Goal: ${p.goal}${p.goal !== 'maintain' ? ` at ~${p.rateKg} kg/week` : ''}${p.goalWeight ? `, goal weight ${p.goalWeight} kg` : ''}.`,
    `Daily targets: ${t.kcal} kcal, protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g, water ${t.waterMl} ml.`,
    'The user lives in NSW, Australia and is a final-year medical student. Use metric units, Australian food names and brands (e.g. Woolworths/Coles products), and Australian spelling. Energy in kcal (give kJ only if asked).',
  ].join('\n');
}

function aiBusyButton(btn, on) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Working…'; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
