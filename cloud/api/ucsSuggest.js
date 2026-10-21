/**
 * UCS naming helpers via Groq free-tier (Llama + Whisper) with keyword fallback.
 * Set GROQ_API_KEY in the Cloud Function environment.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_CHAT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_STT = 'https://api.groq.com/openai/v1/audio/transcriptions';
// llama-3.1-8b-instant shut down 2026-08-16 — free-tier replacement:
const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-20b';
const STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';

const KIND_SET = new Set(['nature', 'water', 'urban', 'forest', 'birds']);
const ECO_SET = new Set(['geophony', 'biophony', 'anthrophony']);

const HEURISTICS = [
  { re: /птиц|пение|birds?|songbird|воронь|чирик/i, catId: 'AMBBird', kind: 'birds', eco: 'biophony', fx: 'Birdsong' },
  { re: /лес|дерев|forest|чащ|рощ/i, catId: 'AMBForst', kind: 'forest', eco: 'biophony', fx: 'Forest_Ambience' },
  { re: /дожд|ливень|капл|rain/i, catId: 'RAIN', kind: 'water', eco: 'geophony', fx: 'Rain' },
  { re: /ветер|wind|порыв/i, catId: 'WIND', kind: 'nature', eco: 'geophony', fx: 'Wind' },
  { re: /гром|гроза|thunder|storm/i, catId: 'THUN', kind: 'nature', eco: 'geophony', fx: 'Thunder' },
  { re: /река|руч(ей|ья)|поток|stream|river|водопад|waterfall/i, catId: 'WATRFlow', kind: 'water', eco: 'geophony', fx: 'Water_Flow' },
  { re: /море|волн|surf|seaside|прибой|берег/i, catId: 'AMBSea', kind: 'water', eco: 'geophony', fx: 'Seaside' },
  { re: /город|улиц|traffic|urban|трафик|машин/i, catId: 'AMBUrbn', kind: 'urban', eco: 'anthrophony', fx: 'Urban_Ambience' },
  { re: /парк|park/i, catId: 'AMBPark', kind: 'nature', eco: 'biophony', fx: 'Park_Ambience' },
  { re: /насеком|insect|сверч|цикад/i, catId: 'AMBInsc', kind: 'nature', eco: 'biophony', fx: 'Insects' },
  { re: /болот|swamp/i, catId: 'AMBSwmp', kind: 'nature', eco: 'biophony', fx: 'Swamp' },
  { re: /деревн|rural|село/i, catId: 'AMBRurl', kind: 'nature', eco: 'anthrophony', fx: 'Rural' },
];

function configured() {
  return !!GROQ_API_KEY;
}

function sanitizeFx(raw) {
  let s = String(raw || 'Untitled').trim();
  s = s.replace(/[^a-zA-Z0-9 \-_']/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s.split(/[\s_-]+/).filter(Boolean).slice(0, 8);
  s = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_');
  if (s.length > 48) s = s.slice(0, 48).replace(/_+$/, '');
  return s || 'Untitled';
}

function heuristicSuggest(text) {
  const src = String(text || '');
  for (const rule of HEURISTICS) {
    if (rule.re.test(src)) {
      return {
        catId: rule.catId,
        fxName: rule.fx,
        title: '',
        kind: rule.kind,
        ecoCategory: rule.eco,
        source: 'heuristic',
        rationale: 'Подобрано по ключевым словам описания',
      };
    }
  }
  return {
    catId: 'AMBMisc',
    fxName: 'Field_Recording',
    title: '',
    kind: 'nature',
    ecoCategory: 'geophony',
    source: 'heuristic',
    rationale: 'Нейтральный AMBMisc — уточните вручную',
  };
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

function normalizeSuggestion(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const catId = String(raw.catId || raw.CatID || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9]{2,24}$/.test(catId)) return null;
  const kind = KIND_SET.has(String(raw.kind || '')) ? String(raw.kind) : 'nature';
  const ecoCategory = ECO_SET.has(String(raw.ecoCategory || raw.eco || ''))
    ? String(raw.ecoCategory || raw.eco)
    : 'geophony';
  return {
    catId,
    fxName: sanitizeFx(raw.fxName || raw.FXName || 'Untitled'),
    title: String(raw.title || '').trim().slice(0, 120),
    kind,
    ecoCategory,
    source,
    rationale: String(raw.rationale || '').trim().slice(0, 240),
  };
}

async function groqChatOnce(userPrompt, withJsonFormat) {
  const payload = {
    model: CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: [
          'You catalog field recordings for Полёвка using UCS 8.2.1.',
          'Reply with ONLY compact JSON:',
          '{"catId":"AMBForst","fxName":"Forest_Dawn_Birds","title":"Утренний лес","kind":"forest","ecoCategory":"biophony","rationale":"..."}',
          'Rules: catId must be a real UCS CatID (e.g. AMBForst, AMBBird, WATRFlow, AMBUrbn, RAIN, WIND, THUN, AMBMisc).',
          'fxName: English Title_Case words joined by underscores, max 8 words.',
          'title: short Russian display title.',
          'kind: nature|water|urban|forest|birds.',
          'ecoCategory: geophony|biophony|anthrophony.',
        ].join(' '),
      },
      { role: 'user', content: userPrompt },
    ],
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

async function groqChat(userPrompt) {
  try {
    return await groqChatOnce(userPrompt, true);
  } catch (e) {
    // Some models reject response_format — retry plain.
    if (e && e.status === 400) return groqChatOnce(userPrompt, false);
    throw e;
  }
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
 * @param {{ description?: string, title?: string, location?: string, audioBase64?: string, audioMime?: string, mode?: 'text'|'audio' }} input
 */
async function suggestUcs(input = {}) {
  const description = String(input.description || '').trim();
  const title = String(input.title || '').trim();
  const location = String(input.location || '').trim();
  const mode = input.mode === 'audio' ? 'audio' : 'text';
  const hay = [title, description, location].filter(Boolean).join('\n');

  if (mode === 'text' && hay.length < 8) {
    const err = new Error('need_description');
    err.status = 400;
    throw err;
  }

  if (!configured()) {
    if (mode === 'audio') {
      const err = new Error('ucs_ai_unconfigured');
      err.status = 503;
      throw err;
    }
    return heuristicSuggest(hay);
  }

  try {
    let audioNotes = '';
    if (mode === 'audio' && input.audioBase64) {
      audioNotes = await groqTranscribe(input.audioBase64, input.audioMime || 'audio/wav');
    }
    const prompt = [
      title ? `Title: ${title}` : '',
      description ? `Description: ${description}` : '',
      location ? `Location: ${location}` : '',
      audioNotes ? `Audio analysis / transcript notes: ${audioNotes.slice(0, 1200)}` : '',
      mode === 'audio' && !audioNotes ? 'Audio provided but empty transcript — infer from metadata only.' : '',
    ].filter(Boolean).join('\n');

    const parsed = await groqChat(prompt || hay);
    const normalized = normalizeSuggestion(parsed, mode === 'audio' ? 'groq-audio' : 'groq');
    if (normalized) {
      if (audioNotes) normalized.audioNotes = audioNotes.slice(0, 400);
      return normalized;
    }
  } catch (e) {
    if (mode === 'audio') throw e;
    // text mode soft-falls back
  }

  const fallback = heuristicSuggest(hay);
  fallback.source = configured() ? 'heuristic-fallback' : 'heuristic';
  return fallback;
}

module.exports = {
  configured,
  suggestUcs,
  heuristicSuggest,
};
