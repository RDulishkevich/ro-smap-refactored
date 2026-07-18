/**
 * UCS filename builder (Tim Nielsen convention).
 * CatID_FXName_CreatorID_SourceID[_UserData]
 * @see docs/ucs-naming.md
 */

import { sourceIdMap } from '../data/dict.js';

export const UCS_SOURCE_ID = 'ROSMAP';
export const UCS_FXNAME_MAX = 40;

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

/** FXName: spaces OK, underscores forbidden, ASCII-ish for library tools. */
export function sanitizeFxName(raw, maxLen = UCS_FXNAME_MAX) {
    let s = String(raw || '').trim();
    s = s.replace(/_/g, ' ');
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/[^a-zA-Z0-9 \-',.]/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) s = 'Untitled';
    if (s.length > maxLen) s = s.slice(0, maxLen).trim();
    return s;
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
 * @param {object} opts
 * @param {string} opts.catId
 * @param {string} opts.fxName
 * @param {string} opts.creatorId
 * @param {string} [opts.sourceId]
 * @param {string} [opts.channels]
 * @param {string} [opts.location]
 * @param {string} [opts.userCategory]
 */
export function buildUcsFileName(opts = {}) {
    const catId = sanitizeIdBlock(opts.catId || 'AMBMisc', 'AMBMisc');
    const userCat = opts.userCategory
        ? sanitizeIdBlock(opts.userCategory, '')
        : '';
    const catBlock = userCat ? `${catId}-${userCat}` : catId;

    const fxName = sanitizeFxName(opts.fxName || 'Untitled');
    const creatorId = sanitizeIdBlock(opts.creatorId || 'Anon', 'Anon');
    const sourceId = sanitizeIdBlock(opts.sourceId || UCS_SOURCE_ID, UCS_SOURCE_ID);

    const channelCode = sourceIdMap[opts.channels] || sanitizeUserDataPart(opts.channels) || '';
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
    return buildUcsFileName({
        catId: val('add-subcat') || 'AMBMisc',
        fxName: val('add-user-defined') || 'Untitled',
        creatorId: recordist,
        sourceId: UCS_SOURCE_ID,
        channels: val('add-channels'),
        location: val('add-loc')
    });
}

if (typeof window !== 'undefined') {
    window.UCS_SOURCE_ID = UCS_SOURCE_ID;
    window.sanitizeFxName = sanitizeFxName;
    window.buildUcsFileName = buildUcsFileName;
    window.collectUcsNameFromForm = collectUcsNameFromForm;
}
