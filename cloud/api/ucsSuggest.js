/**
 * UCS catalog helper for Полёвка: closed CatID from UCS 8.2.1,
 * kind/eco from ucsMap, Whisper only when the author marked speech.
 * Set GROQ_API_KEY in the Cloud Function environment.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_CHAT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_STT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-20b';
const STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';

const index = require('./ucsIndex');
const { mapCatId } = require('./ucsMap');

const FIELD_PRIORITY = [
  'AMBIENCE', 'WATER', 'WEATHER', 'WIND', 'RAIN', 'BIRDS', 'ANIMALS',
  'VEGETATION', 'VEHICLES', 'CROWDS', 'TRAINS', 'FOOTSTEPS', 'SNOW', 'ICE',
];

const HEURISTICS = [
  { re: /птиц|пение|birds?|songbird|воронь|чирик|скворец|синиц/i, catId: 'AMBBird', fx: 'Birdsong' },
  { re: /певч(ие|их)|соловей|жавор/i, catId: 'BIRDSong', fx: 'Songbirds' },
  { re: /лягуш|квака|amphib/i, catId: 'ANMLAmph', fx: 'Frogs' },
  { re: /насеком|insect|сверч|цикад|комар/i, catId: 'AMBInsc', fx: 'Insects' },
  { re: /дожд|ливень|капл|rain/i, catId: 'RAIN', fx: 'Rain' },
  { re: /гром|гроза|thunder|storm/i, catId: 'THUN', fx: 'Thunder' },
  { re: /ветер|wind|порыв/i, catId: 'WIND', fx: 'Wind' },
  { re: /водопад|waterfall/i, catId: 'WATRFall', fx: 'Waterfall' },
  { re: /река|руч(ей|ья)|поток|stream|river/i, catId: 'WATRFlow', fx: 'Water_Flow' },
  { re: /море|волн|surf|seaside|прибой|берег/i, catId: 'AMBSea', fx: 'Seaside' },
  { re: /озер/i, catId: 'AMBLake', fx: 'Lakeside' },
  { re: /болот|камыш|тростник|swamp/i, catId: 'AMBSwmp', fx: 'Swamp' },
  { re: /лист|кроны|листв|leaves|foliage/i, catId: 'VEGELeaf', fx: 'Leaves' },
  { re: /трактор/i, catId: 'VEHFarm', fx: 'Tractor' },
  { re: /трамвай|tram/i, catId: 'TRNTram', fx: 'Tram' },
  { re: /поезд|электричка|train|железн/i, catId: 'TRNDiesl', fx: 'Train' },
  { re: /лес|дерев|forest|чащ|рощ|рассвет|dawn/i, catId: 'AMBForst', fx: 'Forest_Ambience' },
  { re: /город|улиц|traffic|urban|трафик|машин/i, catId: 'AMBUrbn', fx: 'Urban_Ambience' },
  { re: /парк|park/i, catId: 'AMBPark', fx: 'Park_Ambience' },
  { re: /деревн|rural|село/i, catId: 'AMBRurl', fx: 'Rural' },
  { re: /шаг(и|ов)|footstep/i, catId: 'FEETHmn', fx: 'Footsteps' },
  { re: /колокол/i, catId: 'BELLLrg', fx: 'Bells' },
];

function configured() {
  return !!GROQ_API_KEY;
}

function lookup(catId) {
  return index.byId[String(catId || '')] || null;
}

function sanitizeFx(raw) {
  let s = String(raw || 'Untitled').trim();
  s = s.replace(/[^a-zA-Z0-9 \-_']/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(/[\s_-]+/).filter(Boolean).slice(0, 8);
  s = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_');
  if (s.length > 48) s = s.slice(0, 48).replace(/_+$/, '');
  return s || 'Untitled';
}

function decorate(partial, source) {
  const catId = String(partial.catId || '').trim();
  const meta = lookup(catId);
  if (!meta) return null;
  const mapped = mapCatId(catId, meta.category);
  return {
    catId,
    category: meta.category,
    fxName: sanitizeFx(partial.fxName || partial.FXName || 'Untitled'),
    title: String(partial.title || '').trim().slice(0, 120),
    kind: mapped.kind,
    ecoCategory: mapped.eco,
    source,
    rationale: String(partial.rationale || '').trim().slice(0, 240),
  };
}

function heuristicSuggest(text) {
  const src = String(text || '');
  for (const rule of HEURISTICS) {
    if (rule.re.test(src)) {
      const hit = decorate({ catId: rule.catId, fxName: rule.fx, title: '', rationale: 'Подобрано по ключевым словам описания' }, 'heuristic');
      if (hit) return hit;
    }
  }
  return decorate({
    catId: 'AMBMisc',
    fxName: 'Field_Recording',
    title: '',
    rationale: 'Нейтральный AMBMisc — уточните вручную',
  }, 'heuristic');
}

function parseModelJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) return null;
  try {
    return JSON.parse(fenced[0]);
  } catch {
    return null;
  }
}

function isUsefulTranscript(text) {
  const t = String(text || '').trim();
  if (t.length < 12) return false;
  const lower = t.toLowerCase();
  if (/продолжение следует|thank you for watching|subscribe|подпишись|www\.|http/.test(lower)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  const uniq = new Set(words.map((w) => w.toLowerCase()));
  if (uniq.size <= 2 && words.length >= 6) return false;
  return true;
}

function normalizeSuggestion(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const catId = String(raw.catId || raw.CatID || '').trim();
  if (!lookup(catId)) return null;
  return decorate({
    catId,
    fxName: raw.fxName || raw.FXName,
    title: raw.title,
    rationale: raw.rationale,
  }, source);
}

function normalizeAlternatives(rawList, primaryId, source) {
  const seen = new Set([String(primaryId || '')]);
  const out = [];
  for (const item of Array.isArray(rawList) ? rawList : []) {
    const raw = typeof item === 'string' ? { catId: item } : item;
    const next = normalizeSuggestion(raw, source);
    if (!next || seen.has(next.catId)) continue;
    seen.add(next.catId);
    out.push(next);
    if (out.length >= 2) break;
  }
  return out;
}

async function groqChatOnce(messages, withJsonFormat) {
  const payload = {
    model: CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 400,
    messages,
  };
  if (withJsonFormat) payload.response_format = { type: 'json_object' };

  const res = await fetch(GROQ_CHAT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(`groq_chat_${res.status}:${detail}`);
    err.status = res.status;
    throw err;
  }
  const content = data?.choices?.[0]?.message?.content
    || data?.choices?.[0]?.message?.reasoning
    || '';
  return parseModelJson(content);
}

async function groqChat(messages) {
  try {
    return await groqChatOnce(messages, true);
  } catch (e) {
    if (e && e.status === 400) return groqChatOnce(messages, false);
    throw e;
  }
}

function categoryListForPrompt() {
  const rest = index.categories.filter((c) => !FIELD_PRIORITY.includes(c));
  return [...FIELD_PRIORITY.filter((c) => index.categories.includes(c)), ...rest].join(', ');
}

function catIdListForPrompt(category) {
  const ids = index.byCategory[category] || [];
  return ids.map((id) => {
    const meta = index.byId[id] || {};
    return `${id} — ${meta.sub || ''}${meta.ru ? ` (${meta.ru})` : ''}`.trim();
  }).join('\n');
}

function contextPrompt(input, audioNotes) {
  return [
    input.title ? `Title: ${input.title}` : '',
    input.description ? `Description: ${input.description}` : '',
    input.location ? `Location: ${input.location}` : '',
    input.weather ? `Weather: ${input.weather}` : '',
    audioNotes ? `Spoken notes from the recording: ${audioNotes.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n');
}

async function groqPickCategory(userPrompt) {
  const parsed = await groqChat([
    {
      role: 'system',
      content: [
        'You catalog field recordings for Полёвка using UCS 8.2.1.',
        'Reply with ONLY compact JSON: {"category":"AMBIENCE"}',
        `Prefer field categories when evidence is weak: ${FIELD_PRIORITY.join(', ')}.`,
        `Allowed category values (exact): ${categoryListForPrompt()}`,
      ].join(' '),
    },
    { role: 'user', content: userPrompt },
  ]);
  const category = String(parsed?.category || '').trim();
  if (!index.byCategory[category]) return null;
  return category;
}

async function groqPickCatId(userPrompt, category) {
  const parsed = await groqChat([
    {
      role: 'system',
      content: [
        'You catalog field recordings for Полёвка using UCS 8.2.1.',
        'Reply with ONLY compact JSON:',
        '{"catId":"AMBForst","fxName":"Forest_Dawn_Birds","title":"Утренний лес","rationale":"...","alternatives":["AMBBird","VEGELeaf"]}',
        `Use category ${category}. catId MUST be one of the allowed CatIDs.`,
        'fxName: English Title_Case words joined by underscores, max 8 words.',
        'title: short Russian display title.',
        'alternatives: 0–2 other allowed CatIDs, not the primary.',
        `Allowed CatIDs:\n${catIdListForPrompt(category)}`,
      ].join('\n'),
    },
    { role: 'user', content: userPrompt },
  ]);
  return parsed;
}

function multipartBody(fields, file) {
  const boundary = `----Polevka${Date.now().toString(16)}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`,
  ));
  chunks.push(file.buf);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function groqTranscribe(audioBase64, mimeType) {
  const bin = Buffer.from(String(audioBase64 || ''), 'base64');
  if (!bin.length || bin.length > 3_500_000) {
    const err = new Error('audio_too_large');
    err.status = 400;
    throw err;
  }
  const mime = mimeType || 'audio/wav';
  const ext = /webm/i.test(mime) ? 'webm'
    : /ogg/i.test(mime) ? 'ogg'
      : /mp4|m4a/i.test(mime) ? 'm4a'
        : /mpeg|mp3/i.test(mime) ? 'mp3'
          : 'wav';
  const { body, contentType } = multipartBody(
    { model: STT_MODEL, response_format: 'json', language: 'ru' },
    { name: `clip.${ext}`, mime, buf: bin },
  );

  const res = await fetch(GROQ_STT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': contentType,
    },
    body,
  });
  if (!res.ok) {
    const err = new Error(`groq_stt_${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return String(data?.text || '').trim();
}

/**
 * @param {{ description?: string, title?: string, location?: string, weather?: string, audioBase64?: string, audioMime?: string, voice?: boolean }} input
 */
async function suggestUcs(input = {}) {
  const description = String(input.description || '').trim();
  const title = String(input.title || '').trim();
  const location = String(input.location || '').trim();
  const weather = String(input.weather || '').trim();
  const voice = input.voice === true;
  const hay = [title, description, location, weather].filter(Boolean).join('\n');

  if (!voice && hay.length < 8) {
    const err = new Error('need_description');
    err.status = 400;
    throw err;
  }

  if (!configured()) {
    if (voice && !hay) {
      const err = new Error('ucs_ai_unconfigured');
      err.status = 503;
      throw err;
    }
    const fallback = heuristicSuggest(hay);
    return { suggestion: fallback, alternatives: [], usedVoice: false };
  }

  let audioNotes = '';
  let usedVoice = false;
  if (voice && input.audioBase64) {
    try {
      const raw = await groqTranscribe(input.audioBase64, input.audioMime || 'audio/wav');
      if (isUsefulTranscript(raw)) {
        audioNotes = raw;
        usedVoice = true;
      }
    } catch (e) {
      if (e && e.message === 'audio_too_large') throw e;
      // Speech failed — continue from text.
    }
  }

  if (!usedVoice && hay.length < 8) {
    const err = new Error('need_description');
    err.status = 400;
    throw err;
  }

  const userPrompt = contextPrompt({ title, description, location, weather }, audioNotes) || hay;
  const source = usedVoice ? 'groq-voice' : 'groq';

  try {
    const category = await groqPickCategory(userPrompt);
    if (category) {
      const parsed = await groqPickCatId(userPrompt, category);
      const normalized = normalizeSuggestion(parsed, source);
      if (normalized) {
        if (audioNotes) normalized.audioNotes = audioNotes.slice(0, 400);
        const alternatives = normalizeAlternatives(parsed?.alternatives, normalized.catId, source);
        return { suggestion: normalized, alternatives, usedVoice };
      }
    }
  } catch (e) {
    if (e && e.message === 'audio_too_large') throw e;
  }

  const fallback = heuristicSuggest(hay || audioNotes);
  fallback.source = 'heuristic-fallback';
  return { suggestion: fallback, alternatives: [], usedVoice };
}

module.exports = {
  configured,
  suggestUcs,
  heuristicSuggest,
  normalizeSuggestion,
  normalizeAlternatives,
  isUsefulTranscript,
  groqTranscribe,
  lookup,
};
