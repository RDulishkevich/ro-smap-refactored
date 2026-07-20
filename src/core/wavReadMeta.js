/**
 * Read BWF bext / iXML / LIST INFO and UCS filename hints from a WAV ArrayBuffer.
 */

function readFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );
}

function readAscii(view, offset, len) {
    let s = '';
    for (let i = 0; i < len; i++) {
        const c = view.getUint8(offset + i);
        if (c === 0) break;
        if (c >= 32 && c < 127) s += String.fromCharCode(c);
    }
    return s.trim();
}

function decodeUtf8(bytes) {
    try {
        return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
    } catch (_) {
        return '';
    }
}

function unescapeXml(s) {
    return String(s || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

function extractIxmlField(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = xml.match(re);
    if (!m) return '';
    return unescapeXml(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')).trim();
}

/**
 * Parse UCS-style filename: CatID_FXName_CreatorID_SourceID[_UserData]
 * FXName may contain underscores (RO.SMap convention).
 */
export function parseUcsFileName(fileName) {
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

    const byId = (typeof window !== 'undefined' && window.ucsByCatId) || {};
    if (!byId[catBlock] && parts.length < 4) {
        // Unknown CatID — still return raw head
    }

    let userData = '';
    let sourceId = '';
    let creatorId = '';
    let fxParts = [];

    if (parts.length >= 4) {
        // Assume last is UserData only if SourceID is ROSMAP at -2, else last is SourceID
        const last = parts[parts.length - 1];
        const prev = parts[parts.length - 2];
        if (prev.toUpperCase() === 'ROSMAP' || prev.toUpperCase() === 'NONE') {
            sourceId = prev;
            userData = last;
            creatorId = parts[parts.length - 3];
            fxParts = parts.slice(1, -3);
        } else {
            sourceId = last;
            creatorId = prev;
            fxParts = parts.slice(1, -2);
        }
    } else if (parts.length === 3) {
        fxParts = [parts[1]];
        creatorId = parts[2];
    } else {
        fxParts = parts.slice(1);
    }

    const fxName = fxParts.join('_');
    const meta = byId[catBlock] || {};
    return {
        catId: catBlock,
        userCategory,
        fxName,
        creatorId,
        sourceId,
        userData,
        category: meta.category || '',
        subCategory: meta.subCategory || ''
    };
}

export function readWavMetadataBuffer(buffer) {
    const view = new DataView(buffer);
    const out = {
        description: '',
        originator: '',
        originatorReference: '',
        originationDate: '',
        originationTime: '',
        keywords: '',
        title: '',
        artist: '',
        catId: '',
        category: '',
        subCategory: '',
        fxName: '',
        location: '',
        note: '',
        ecoCategory: '',
        weather: '',
        recPrinciple: '',
        micType: '',
        recorder: '',
        format: '',
        channels: '',
        license: '',
        recordist: '',
        sessionId: '',
        duration: '',
        lat: null,
        lng: null,
        fileName: '',
        rosmapPayload: null
    };

    if (buffer.byteLength < 12 || readFourCC(view, 0) !== 'RIFF' || readFourCC(view, 8) !== 'WAVE') {
        return out;
    }

    let offset = 12;
    while (offset + 8 <= buffer.byteLength) {
        const id = readFourCC(view, offset);
        const size = view.getUint32(offset + 4, true);
        const payloadStart = offset + 8;
        const padded = size + (size % 2);
        if (payloadStart + size > buffer.byteLength) break;

        if (id === 'fmt ' && size >= 16) {
            const audioFormat = view.getUint16(payloadStart, true);
            const sampleRate = view.getUint32(payloadStart + 4, true);
            let bitsPerSample = view.getUint16(payloadStart + 14, true);
            let float = audioFormat === 3;
            if (audioFormat === 0xFFFE && size >= 40) {
                bitsPerSample = view.getUint16(payloadStart + 14, true);
                const subFormat = view.getUint16(payloadStart + 24, true);
                float = subFormat === 3;
            }
            if (sampleRate && bitsPerSample && !out.format) {
                const khz = sampleRate % 1000 === 0 ? `${sampleRate / 1000}kHz` : `${sampleRate}Hz`;
                out.format = `WAV ${khz} / ${float ? `${bitsPerSample}-bit Float` : `${bitsPerSample}-bit`}`;
            }
        } else if (id === 'bext' && size >= 256 + 32 + 32 + 10 + 8) {
            out.description = readAscii(view, payloadStart, 256) || out.description;
            out.originator = readAscii(view, payloadStart + 256, 32) || out.originator;
            out.originatorReference = readAscii(view, payloadStart + 288, 32) || out.originatorReference;
            out.originationDate = readAscii(view, payloadStart + 320, 10) || out.originationDate;
            out.originationTime = readAscii(view, payloadStart + 330, 8) || out.originationTime;
        } else if (id === 'iXML' || id === 'ixml') {
            const xml = decodeUtf8(new Uint8Array(buffer, payloadStart, size));
            out.catId = extractIxmlField(xml, 'UCS_CATID') || extractIxmlField(xml, 'CatID') || out.catId;
            out.category = extractIxmlField(xml, 'UCS_CATEGORY') || extractIxmlField(xml, 'Category') || out.category;
            out.subCategory = extractIxmlField(xml, 'UCS_SUBCATEGORY') || extractIxmlField(xml, 'SubCategory') || out.subCategory;
            out.fxName = extractIxmlField(xml, 'UCS_FXNAME') || extractIxmlField(xml, 'FXName') || out.fxName;
            out.keywords = extractIxmlField(xml, 'KEYWORDS') || extractIxmlField(xml, 'Keywords') || out.keywords;
            out.location = extractIxmlField(xml, 'LOCATION') || extractIxmlField(xml, 'Location') || out.location;
            out.note = extractIxmlField(xml, 'NOTE') || extractIxmlField(xml, 'Note') || out.note;
            out.title = extractIxmlField(xml, 'DISPLAY_TITLE') || extractIxmlField(xml, 'TITLE') || out.title;
            out.ecoCategory = extractIxmlField(xml, 'ECO_CATEGORY') || out.ecoCategory;
            out.weather = extractIxmlField(xml, 'WEATHER') || out.weather;
            out.recPrinciple = extractIxmlField(xml, 'REC_PRINCIPLE') || out.recPrinciple;
            out.micType = extractIxmlField(xml, 'MIC_TYPE') || out.micType;
            out.recorder = extractIxmlField(xml, 'RECORDER') || out.recorder;
            out.format = extractIxmlField(xml, 'FORMAT') || out.format;
            out.channels = extractIxmlField(xml, 'CHANNELS') || out.channels;
            out.license = extractIxmlField(xml, 'LICENSE') || out.license;
            out.recordist = extractIxmlField(xml, 'RECORDIST') || out.recordist;
            out.sessionId = extractIxmlField(xml, 'SESSION_ID') || out.sessionId;
            out.duration = extractIxmlField(xml, 'DURATION') || out.duration;
            out.fileName = extractIxmlField(xml, 'UCS_FILENAME') || out.fileName;
            const latStr = extractIxmlField(xml, 'LAT');
            const lngStr = extractIxmlField(xml, 'LNG');
            const gps = extractIxmlField(xml, 'GPS');
            if (latStr && lngStr) {
                out.lat = Number(latStr);
                out.lng = Number(lngStr);
            } else if (gps && gps.includes(',')) {
                const [a, b] = gps.split(',').map((x) => Number(String(x).trim()));
                if (Number.isFinite(a) && Number.isFinite(b)) {
                    out.lat = a;
                    out.lng = b;
                }
            }
            const rosmapJson = extractIxmlField(xml, 'ROSMAP_JSON');
            if (rosmapJson) {
                try {
                    out.rosmapPayload = JSON.parse(rosmapJson);
                } catch (_) { /* ignore bad snapshot */ }
            }
            const bwfDate = extractIxmlField(xml, 'BWF_ORIGINATION_DATE') || extractIxmlField(xml, 'DATE');
            const bwfTime = extractIxmlField(xml, 'BWF_ORIGINATION_TIME') || extractIxmlField(xml, 'TIME');
            if (bwfDate) out.originationDate = bwfDate;
            if (bwfTime) out.originationTime = bwfTime;
            if (!out.description) {
                out.description = extractIxmlField(xml, 'DESCRIPTION')
                    || extractIxmlField(xml, 'BWF_DESCRIPTION')
                    || out.description;
            }
        } else if (id === 'LIST' && size >= 4) {
            const listType = readFourCC(view, payloadStart);
            if (listType === 'INFO') {
                let p = payloadStart + 4;
                const end = payloadStart + size;
                while (p + 8 <= end) {
                    const sid = readFourCC(view, p);
                    const ssize = view.getUint32(p + 4, true);
                    const sStart = p + 8;
                    if (sStart + ssize > end) break;
                    const text = decodeUtf8(new Uint8Array(buffer, sStart, ssize));
                    if (sid === 'INAM' && !out.title) out.title = text;
                    if (sid === 'IART' && !out.artist) out.artist = text;
                    if (sid === 'ICMT' && !out.description) out.description = text;
                    if (sid === 'IKEY' && !out.keywords) out.keywords = text;
                    if (sid === 'IGNR' && !out.category) out.category = text;
                    p = sStart + ssize + (ssize % 2);
                }
            }
        }

        if (id === 'data') break;
        offset = payloadStart + padded;
    }

    return out;
}

export async function readWavFileMetadata(file) {
    const result = {
        fromFileName: null,
        fromChunks: null,
        date: '',
        time: '',
        keywords: '',
        fxName: '',
        catId: '',
        category: '',
        description: '',
        location: '',
        title: '',
        ecoCategory: '',
        weather: '',
        recPrinciple: '',
        micType: '',
        recorder: '',
        format: '',
        channels: '',
        license: '',
        recordist: '',
        sessionId: '',
        duration: '',
        lat: null,
        lng: null,
        fileName: '',
        rosmapPayload: null
    };
    if (!file) return result;

    result.fromFileName = parseUcsFileName(file.name);

    const isWav = /\.wav$/i.test(file.name || '') || file.type === 'audio/wav' || file.type === 'audio/x-wav';
    if (isWav) {
        try {
            const buf = await file.arrayBuffer();
            // Keep a copy for later upload — arrayBuffer() may detach in some browsers if we reuse same file;
            // File is fine to re-read. Store nothing here.
            result.fromChunks = readWavMetadataBuffer(buf);
        } catch (err) {
            console.warn('readWavFileMetadata', err);
        }
    }

    const chunk = result.fromChunks || {};
    const snap = chunk.rosmapPayload || null;
    const parsed = result.fromFileName || {};

    result.rosmapPayload = snap;
    result.catId = snap?.typeTag || chunk.catId || parsed.catId || '';
    result.category = snap?.ucsCat || chunk.category || parsed.category || '';
    result.fxName = snap?.fxName || chunk.fxName || parsed.fxName || '';
    result.keywords = snap?.keywords || chunk.keywords || '';
    result.description = snap?.description || chunk.note || chunk.description || '';
    result.location = snap?.location || chunk.location || '';
    result.title = snap?.title || chunk.title || '';
    result.ecoCategory = snap?.ecoCategory || chunk.ecoCategory || '';
    result.weather = snap?.weather || chunk.weather || '';
    result.recPrinciple = snap?.recPrinciple || chunk.recPrinciple || '';
    result.micType = snap?.micType || chunk.micType || '';
    result.recorder = snap?.gear || chunk.recorder || '';
    result.format = snap?.format || chunk.format || '';
    result.channels = snap?.channels || chunk.channels || '';
    result.license = snap?.license || chunk.license || '';
    result.recordist = snap?.recordist || chunk.recordist || chunk.artist || chunk.originator || '';
    result.sessionId = snap?.sessionId || chunk.sessionId || '';
    result.duration = snap?.duration || chunk.duration || '';
    result.fileName = snap?.fileName || chunk.fileName || '';
    result.lat = snap?.lat ?? chunk.lat ?? null;
    result.lng = snap?.lng ?? chunk.lng ?? null;

    let date = snap?.date || chunk.originationDate || '';
    let time = snap?.time || chunk.originationTime || '';
    // Normalize date YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        result.date = date;
    } else if (/^\d{4}:\d{2}:\d{2}$/.test(date)) {
        result.date = date.replace(/:/g, '-');
    }
    // Time HH:MM or HH:MM:SS → HH:MM for input[type=time]
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        result.time = time.slice(0, 5);
    }

    if (!result.date && file.lastModified) {
        const d = new Date(file.lastModified);
        if (!Number.isNaN(d.getTime())) {
            result.date = d.toISOString().slice(0, 10);
            result.time = result.time || `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    }

    return result;
}

if (typeof window !== 'undefined') {
    window.parseUcsFileName = parseUcsFileName;
    window.readWavMetadataBuffer = readWavMetadataBuffer;
    window.readWavFileMetadata = readWavFileMetadata;
}
