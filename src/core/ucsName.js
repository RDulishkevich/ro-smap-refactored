/**
 * UCS filename builder (Tim Nielsen / UCS 8.2.1).
 * CatID_FXName_CreatorID_SourceID[_UserData]
 *
 * Underscore separates blocks only. FXName is a Title Case phrase with spaces
 * so parsers keep the whole title, not the first word.
 * @see docs/ucs-naming.md
 */

import { sourceIdMap } from '../data/dict.js';

/** Platform library tag — embedded in WAV metadata only, never in the UCS filename. */
export const UCS_PLATFORM_ID = 'ROSMAP';
/** @deprecated use UCS_PLATFORM_ID — kept for older callers */
export const UCS_SOURCE_ID = UCS_PLATFORM_ID;
/** Soft cap; official spec prefers ~25, examples run longer. Truncate on a word. */
export const UCS_FXNAME_MAX = 72;
export const UCS_PROJECT_MAX = 24;

const CHANNEL_ALIASES = {
    mono: 'MONO',
    моно: 'MONO',
    stereo: 'XY',
    'stereo xy': 'XY',
    'стерео xy': 'XY',
    'stereo ortf': 'ORTF',
    'стерео ortf': 'ORTF',
    binaural: 'BINA',
    бинаурал: 'BINA',
    ambisonic: 'AMBI',
    quad: 'QUAD',
    soundwalk: 'WALK',
    'звуковая прогулка (soundwalk)': 'WALK',
};

function titleCaseWord(word) {
    const w = String(word || '');
    if (!w) return w;
    if (/^[0-9]/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

const CYR_MAP = {
    Ё: 'Yo', Й: 'I', Ц: 'Ts', У: 'U', К: 'K', Е: 'E', Н: 'N', Г: 'G', Ш: 'Sh', Щ: 'Sch', З: 'Z', Х: 'H', Ъ: '',
    ё: 'yo', й: 'i', ц: 'ts', у: 'u', к: 'k', е: 'e', н: 'n', г: 'g', ш: 'sh', щ: 'sch', з: 'z', х: 'h', ъ: '',
    Ф: 'F', Ы: 'I', В: 'V', А: 'A', П: 'P', Р: 'R', О: 'O', Л: 'L', Д: 'D', Ж: 'Zh', Э: 'E',
    ф: 'f', ы: 'i', в: 'v', а: 'a', п: 'p', р: 'r', о: 'o', л: 'l', д: 'd', ж: 'zh', э: 'e',
    Я: 'Ya', Ч: 'Ch', С: 'S', М: 'M', И: 'I', Т: 'T', Ь: '', Б: 'B', Ю: 'Yu',
    я: 'ya', ч: 'ch', с: 's', м: 'm', и: 'i', т: 't', ь: '', б: 'b', ю: 'yu'
};

function latinize(word) {
    return String(word || '').split('').map((ch) => CYR_MAP[ch] || ch).join('');
}

/** FXName: Title Case phrase with spaces (UCS). Never insert `_` inside this block. */
export function sanitizeFxName(raw, maxLen = UCS_FXNAME_MAX) {
    let s = latinize(String(raw || '').trim());
    s = s.replace(/[_]+/g, ' ');
    s = s.replace(/[^a-zA-Z0-9 \-']/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) s = 'Untitled';
    const words = s.split(' ').filter(Boolean).map(titleCaseWord);
    s = words.join(' ');
    if (s.length > maxLen) {
        const cut = s.slice(0, maxLen).replace(/\s+\S*$/, '').trim();
        s = cut || words[0].slice(0, maxLen);
    }
    return s || 'Untitled';
}

function resolveChannelCode(opts = {}) {
    const candidates = [opts.principle, opts.recPrinciple, opts.channels];
    for (const raw of candidates) {
        if (!raw) continue;
        const key = String(raw).trim();
        if (sourceIdMap[key]) return sourceIdMap[key];
        const lower = key.toLowerCase();
        if (CHANNEL_ALIASES[lower]) return CHANNEL_ALIASES[lower];
        const mapped = Object.entries(sourceIdMap).find(([k]) => k.toLowerCase() === lower);
        if (mapped) return mapped[1];
        if (/ortf/i.test(key)) return 'ORTF';
        if (/\bm\/?s\b/i.test(key)) return 'MS';
        if (/\bxy\b/i.test(key)) return 'XY';
        if (/binaur/i.test(key)) return 'BINA';
        if (/ambison/i.test(key)) return 'AMBI';
        if (/soundwalk|прогулк/i.test(key)) return 'WALK';
    }
    return sanitizeUserDataPart(opts.channels) || '';
}

/**
 * Split a UCS filename into blocks. New names keep FXName as one `_` block
 * (spaces inside). Legacy RO.SMap names with underscored FXName still parse.
 */
export function parseUcsFileName(fileName, byId) {
    const base = String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.wav$/i, '');
    if (!base) return null;
    const parts = base.split('_').filter(Boolean);
    if (parts.length < 2) return null;

    let catBlock = parts[0];
    let userCategory = '';
    const dash = catBlock.indexOf('-');
    if (dash > 0) {
        userCategory = catBlock.slice(dash + 1);
        catBlock = catBlock.slice(0, dash);
    }

    const lookup = byId
        || (typeof window !== 'undefined' && window.ucsByCatId)
        || {};

    let userData = '';
    let sourceId = '';
    let creatorId = '';
    let fxName = '';

    const looksLegacyFx = parts.length > 5 && !/\s/.test(parts[1] || '');
    if (looksLegacyFx) {
        const last = parts[parts.length - 1];
        const prev = parts[parts.length - 2];
        if (prev.toUpperCase() === 'ROSMAP' || prev.toUpperCase() === 'NONE' || /[A-Za-z]+-[A-Za-z0-9]/.test(last)) {
            sourceId = prev;
            userData = last;
            creatorId = parts[parts.length - 3];
            fxName = parts.slice(1, -3).join(' ');
        } else {
            sourceId = last;
            creatorId = prev;
            fxName = parts.slice(1, -2).join(' ');
        }
    } else if (parts.length >= 5) {
        fxName = parts[1];
        creatorId = parts[2];
        sourceId = parts[3];
        userData = parts.slice(4).join('_');
    } else if (parts.length === 4) {
        fxName = parts[1];
        creatorId = parts[2];
        sourceId = parts[3];
    } else if (parts.length === 3) {
        fxName = parts[1];
        creatorId = parts[2];
    } else {
        fxName = parts.slice(1).join(' ');
    }

    const meta = lookup[catBlock] || {};
    return {
        catId: catBlock,
        userCategory,
        fxName,
        creatorId,
        sourceId,
        userData,
        category: meta.category || '',
        subCategory: meta.subCategory || meta.sub || '',
    };
}

/** CreatorID / CatID / SourceID blocks: no spaces or underscores. */
export function sanitizeIdBlock(raw, fallback = 'Anon') {
    let s = latinize(String(raw || fallback));
    s = s.replace(/[\s_]+/g, '');
    s = s.replace(/[^a-zA-Z0-9\-]/g, '');
    return s || fallback;
}

export function sanitizeUserDataPart(raw) {
    let s = latinize(String(raw || ''));
    s = s.replace(/_/g, '-').replace(/\s+/g, '');
    s = s.replace(/[^a-zA-Z0-9\-]/g, '');
    return s;
}

/**
 * UCS SourceID = project from expedition/session title.
 * Without an expedition → NONE. Platform id (ROSMAP) is metadata-only.
 */
export function resolveProjectSourceId(sessionId, sessionTitle) {
    let title = sessionTitle || '';
    if (!title && sessionId && typeof window !== 'undefined' && window.findSessionById) {
        const session = window.findSessionById(sessionId);
        title = session?.title || '';
    }
    if (!title) return 'NONE';
    const project = sanitizeIdBlock(title, 'NONE').slice(0, UCS_PROJECT_MAX);
    return project || 'NONE';
}

export function buildUcsFileName(opts = {}) {
    const catId = sanitizeIdBlock(opts.catId || 'AMBMisc', 'AMBMisc');
    const userCat = opts.userCategory
        ? sanitizeIdBlock(opts.userCategory, '')
        : '';
    const catBlock = userCat ? `${catId}-${userCat}` : catId;

    const fxName = sanitizeFxName(opts.fxName || 'Untitled');
    const creatorId = sanitizeIdBlock(opts.creatorId || 'Anon', 'Anon');
    const sourceId = sanitizeIdBlock(
        opts.sourceId || opts.projectId || 'NONE',
        'NONE'
    );

    const channelCode = resolveChannelCode(opts);
    const locSlug = sanitizeUserDataPart(opts.location || '').slice(0, 16);
    const userDataParts = [channelCode, locSlug].filter(Boolean);
    const userData = userDataParts.join('-');

    const base = `${catBlock}_${fxName}_${creatorId}_${sourceId}`;
    const name = userData ? `${base}_${userData}` : base;
    return `${name}.wav`;
}

export function collectUcsNameFromForm() {
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const recordist = val('add-recordist')
        || window.currentUser?.loginName
        || window.currentUser?.username
        || 'Anon';
    const sessionId = val('add-session');
    const projectId = resolveProjectSourceId(sessionId);
    return buildUcsFileName({
        catId: val('add-subcat') || 'AMBMisc',
        fxName: val('add-user-defined') || 'Untitled',
        creatorId: recordist,
        sourceId: projectId,
        projectId,
        channels: val('add-channels'),
        location: val('add-loc')
    });
}

if (typeof window !== 'undefined') {
    window.UCS_SOURCE_ID = UCS_SOURCE_ID;
    window.UCS_PLATFORM_ID = UCS_PLATFORM_ID;
    window.sanitizeFxName = sanitizeFxName;
    window.buildUcsFileName = buildUcsFileName;
    window.parseUcsFileName = parseUcsFileName;
    window.resolveProjectSourceId = resolveProjectSourceId;
    window.collectUcsNameFromForm = collectUcsNameFromForm;
}
