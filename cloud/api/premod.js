/**
 * Pre-moderation: Whisper transcript + profanity scan for staff.
 * Full report stays in the private bucket; public catalog only gets premodFlag.
 */

const ucsSuggest = require('./ucsSuggest');

const STEMS = [
  'хуй', 'хуя', 'хуе', 'хуё', 'хуи',
  'бляд', 'блять', 'блядь',
  'еба', 'ёба', 'ебл', 'ебу', 'ебан', 'ёбан', 'ебать',
  'пизд',
  'сука', 'суки', 'сучар',
  'мудак', 'мудил',
  'залуп',
  'гандон', 'гондон',
  'шлюх',
  'нахуй', 'похуй', 'охуе',
  'пиздец',
  'fuck', 'shit', 'bitch', 'cunt', 'asshole',
];

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanProfanity(text) {
  const src = String(text || '');
  if (!src.trim()) return { profanity: false, hits: [] };
  const hits = [];
  for (const stem of STEMS) {
    const re = new RegExp(`(?:^|[^\\p{L}])${escapeRe(stem)}`, 'iu');
    if (re.test(src) && !hits.includes(stem)) hits.push(stem);
  }
  return { profanity: hits.length > 0, hits };
}

function inspectTexts({ transcript = '', title = '', description = '' } = {}) {
  const raw = String(transcript || '').trim().slice(0, 800);
  const speech = ucsSuggest.isUsefulTranscript(raw);
  const audio = scanProfanity(raw);
  const typed = scanProfanity([title, description].filter(Boolean).join('\n'));
  const hits = [...audio.hits];
  for (const h of typed.hits) {
    if (!hits.includes(h)) hits.push(h);
  }
  return {
    speech,
    profanity: hits.length > 0,
    hits: hits.slice(0, 12),
    transcript: (speech || audio.profanity) ? raw : '',
  };
}

function flagFor(report, skipped) {
  if (report.profanity) return 'profanity';
  if (skipped) return 'skip';
  if (report.speech) return 'speech';
  return 'clean';
}

/**
 * @param {{ audioBase64?: string, audioMime?: string, title?: string, description?: string }} input
 */
async function analyzeClip(input = {}) {
  if (!ucsSuggest.configured()) {
    const report = inspectTexts({
      transcript: '',
      title: input.title,
      description: input.description,
    });
    return { skipped: true, ...report, flag: flagFor(report, true) };
  }

  let transcript = '';
  if (input.audioBase64) {
    transcript = await ucsSuggest.groqTranscribe(input.audioBase64, input.audioMime || 'audio/wav');
  }
  const report = inspectTexts({
    transcript,
    title: input.title,
    description: input.description,
  });
  return { skipped: false, ...report, flag: flagFor(report, false) };
}

module.exports = {
  STEMS,
  scanProfanity,
  inspectTexts,
  flagFor,
  analyzeClip,
};
