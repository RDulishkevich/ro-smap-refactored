/**
 * Embed BWF bext + Open iXML + LIST/INFO into a WAV file (browser).
 * Inserts metadata chunks before the `data` chunk.
 */

function encAscii(str, len) {
    const out = new Uint8Array(len);
    const s = String(str || '');
    for (let i = 0; i < len; i++) {
        const code = i < s.length ? s.charCodeAt(i) : 0;
        out[i] = code < 128 ? code : 63; // '?'
    }
    return out;
}

function encUtf8(str) {
    return new TextEncoder().encode(String(str || ''));
}

function padEven(bytes) {
    if (bytes.length % 2 === 0) return bytes;
    const out = new Uint8Array(bytes.length + 1);
    out.set(bytes);
    return out;
}

function fourCC(tag) {
    return encAscii(tag, 4);
}

function u32le(n) {
    const b = new Uint8Array(4);
    const v = n >>> 0;
    b[0] = v & 255;
    b[1] = (v >>> 8) & 255;
    b[2] = (v >>> 16) & 255;
    b[3] = (v >>> 24) & 255;
    return b;
}

function concatChunks(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return out;
}

function chunk(tag, payload) {
    const body = padEven(payload instanceof Uint8Array ? payload : encUtf8(payload));
    return concatChunks([fourCC(tag), u32le(payload.length), body]);
}

function buildBext(meta) {
    // EBU Tech 3285 bext — Description packs the richest ASCII summary (256 chars).
    const packed = [
        meta.fxName || meta.title || '',
        meta.location || '',
        meta.keywords || '',
        meta.ecoCategory || '',
        meta.catId || ''
    ].filter(Boolean).join(' | ');
    const desc = String(meta.description || packed || meta.fxName || '').slice(0, 256);
    const originator = String(meta.originator || meta.creatorId || meta.recordist || '').slice(0, 32);
    const originatorReference = String(meta.originatorReference || meta.soundId || meta.fileName || '').slice(0, 32);
    const date = String(meta.originationDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const time = String(meta.originationTime || '00:00:00').slice(0, 8);

    // Coding history: short ASCII trail of gear / format
    const history = String([
        meta.recorder && `Recorder=${meta.recorder}`,
        meta.micType && `Mic=${meta.micType}`,
        meta.format && `Format=${meta.format}`,
        meta.channels && `Channels=${meta.channels}`,
        meta.fileName && `File=${meta.fileName}`
    ].filter(Boolean).join('; ')).slice(0, 180);

    const historyBytes = encAscii(history, 190);

    const parts = [
        encAscii(desc, 256),
        encAscii(originator, 32),
        encAscii(originatorReference, 32),
        encAscii(date, 10),
        encAscii(time, 8),
        u32le(0), u32le(0), // TimeReference low/high
        new Uint8Array([0, 0]), // Version
        new Uint8Array(64), // UMID
        historyBytes
    ];
    return chunk('bext', concatChunks(parts));
}

function xmlEscape(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildIxml(meta) {
    const payload = meta.rosmapPayload || null;
    const tags = {
        SPEED: {
            TIMESTAMP_MODE: 'Original',
            TIMECODE_FLAG: 'NonDrop'
        },
        BEXT: {
            BWF_DESCRIPTION: meta.description || meta.fxName || '',
            BWF_ORIGINATOR: meta.originator || meta.creatorId || meta.recordist || '',
            BWF_ORIGINATOR_REFERENCE: meta.originatorReference || meta.soundId || '',
            BWF_ORIGINATION_DATE: meta.originationDate || '',
            BWF_ORIGINATION_TIME: meta.originationTime || ''
        },
        USER: {
            // UCS
            UCS_CATID: meta.catId || '',
            UCS_CATEGORY: meta.category || '',
            UCS_SUBCATEGORY: meta.subCategory || meta.subCategoryName || '',
            UCS_SUBCATEGORY_NAME: meta.subCategoryName || '',
            UCS_FXNAME: meta.fxName || '',
            UCS_CREATORID: meta.creatorId || '',
            UCS_SOURCEID: meta.projectId || meta.sourceId || 'NONE',
            UCS_FILENAME: meta.fileName || '',
            // Platform identity — inside file only, never in UCS filename
            PLATFORM_ID: meta.platformId || 'ROSMAP',
            SOUND_ID: meta.soundId || '',
            PROJECT_ID: meta.projectId || meta.sourceId || 'NONE',
            SESSION_ID: meta.sessionId || '',
            // Content
            TITLE: meta.title || '',
            DISPLAY_TITLE: meta.title || '',
            DESCRIPTION: meta.description || '',
            NOTE: meta.note || meta.description || '',
            KEYWORDS: meta.keywords || '',
            // Place / time
            LOCATION: meta.location || '',
            GPS: meta.lat != null && meta.lng != null ? `${meta.lat},${meta.lng}` : '',
            LAT: meta.lat != null ? String(meta.lat) : '',
            LNG: meta.lng != null ? String(meta.lng) : '',
            DATE: meta.originationDate || '',
            TIME: meta.originationTime || '',
            // Classification
            ECO_CATEGORY: meta.ecoCategory || '',
            // Tech
            MIC_TYPE: meta.micType || '',
            RECORDER: meta.recorder || '',
            FORMAT: meta.format || '',
            CHANNELS: meta.channels || '',
            REC_PRINCIPLE: meta.recPrinciple || '',
            WEATHER: meta.weather || '',
            LICENSE: meta.license || '',
            RECORDIST: meta.recordist || '',
            RECORDIST_ID: meta.recordistId || meta.creatorId || '',
            DURATION: meta.duration || '',
            ROUTE: meta.routeJson || '',
            SESSION_TITLE: meta.sessionTitle || '',
            IMAGE_URLS: meta.imageUrls || '',
            IMAGES_JSON: meta.imagesJson || '',
            // Full snapshot for round-trip
            ROSMAP_JSON: payload ? JSON.stringify(payload) : ''
        }
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<BWFXML>\n';
    Object.entries(tags).forEach(([section, fields]) => {
        xml += `  <${section}>\n`;
        Object.entries(fields).forEach(([k, v]) => {
            if (v === '' || v == null) return;
            xml += `    <${k}>${xmlEscape(v)}</${k}>\n`;
        });
        xml += `  </${section}>\n`;
    });
    xml += '</BWFXML>\n';
    return chunk('iXML', encUtf8(xml));
}

function infoSubchunk(tag, text) {
    const raw = encUtf8(String(text || '') + '\0');
    return concatChunks([fourCC(tag), u32le(raw.length), padEven(raw)]);
}

function buildListInfo(meta) {
    const comment = [
        meta.description || '',
        meta.sessionTitle && `Expedition: ${meta.sessionTitle}`,
        meta.weather && `Weather: ${meta.weather}`,
        meta.recPrinciple && `Principle: ${meta.recPrinciple}`,
        meta.format && `Format: ${meta.format}`,
        meta.duration && `Duration: ${meta.duration}`,
        meta.imageUrls && `Photos: ${String(meta.imageUrls).replace(/\n/g, ' | ')}`
    ].filter(Boolean).join(' | ').slice(0, 900);

    const body = concatChunks([
        fourCC('INFO'),
        infoSubchunk('INAM', meta.title || meta.fxName || ''),
        infoSubchunk('IART', meta.recordist || meta.creatorId || meta.originator || ''),
        infoSubchunk('ICMT', comment),
        infoSubchunk('ICOP', meta.license || ''),
        infoSubchunk('IGNR', [meta.category, meta.catId, meta.ecoCategory].filter(Boolean).join(' / ')),
        infoSubchunk('IKEY', meta.keywords || ''),
        infoSubchunk('ICRD', meta.originationDate || ''),
        infoSubchunk('ISBJ', meta.location || ''),
        infoSubchunk('ISRC', meta.soundId || ''),
        infoSubchunk('IENG', meta.recorder || ''),
        infoSubchunk('ITCH', meta.micType || '')
    ]);
    return concatChunks([fourCC('LIST'), u32le(body.length), body]);
}

function readFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );
}

/**
 * @param {ArrayBuffer} buffer
 * @param {object} meta
 * @returns {ArrayBuffer}
 */
export function embedWavMetadataBuffer(buffer, meta = {}) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 12 || readFourCC(view, 0) !== 'RIFF' || readFourCC(view, 8) !== 'WAVE') {
        throw new Error('not_wav');
    }

    const metaBytes = concatChunks([
        buildBext(meta),
        buildIxml(meta),
        buildListInfo(meta)
    ]);

    // Find start of `data` chunk; keep everything before it, drop old bext/iXML/LIST
    let offset = 12;
    const kept = [];
    let dataChunk = null;

    while (offset + 8 <= buffer.byteLength) {
        const id = readFourCC(view, offset);
        const size = view.getUint32(offset + 4, true);
        const payloadStart = offset + 8;
        const padded = size + (size % 2);
        const next = payloadStart + padded;
        if (next > buffer.byteLength + (size % 2 ? 0 : 0) && next > buffer.byteLength) {
            break;
        }
        const sliceEnd = Math.min(next, buffer.byteLength);
        const chunkBytes = new Uint8Array(buffer, offset, sliceEnd - offset);

        if (id === 'data') {
            dataChunk = new Uint8Array(buffer, offset, buffer.byteLength - offset);
            break;
        }
        if (id === 'bext' || id === 'iXML' || id === 'LIST') {
            // drop previous metadata
        } else {
            kept.push(chunkBytes);
        }
        offset = next;
        if (offset >= buffer.byteLength) break;
    }

    if (!dataChunk) {
        // No data chunk — append meta at end of existing WAVE body
        const body = concatChunks([
            ...kept.length ? kept : [new Uint8Array(buffer, 12)],
            metaBytes
        ]);
        const riffSize = 4 + body.length;
        return concatChunks([
            fourCC('RIFF'),
            u32le(riffSize),
            fourCC('WAVE'),
            body
        ]).buffer;
    }

    const body = concatChunks([...kept, metaBytes, dataChunk]);
    const riffSize = 4 + body.length;
    return concatChunks([
        fourCC('RIFF'),
        u32le(riffSize),
        fourCC('WAVE'),
        body
    ]).buffer;
}

/**
 * @param {File|Blob} file
 * @param {object} meta
 * @param {string} [fileName]
 * @returns {Promise<{ file: File, embedded: boolean, skipped?: string }>}
 */
export async function embedWavMetadata(file, meta = {}, fileName = '') {
    if (!file) return { file: null, embedded: false, skipped: 'no_file' };
    const name = fileName || file.name || 'audio.wav';
    const isWav = /\.wav$/i.test(name) || file.type === 'audio/wav' || file.type === 'audio/x-wav';

    if (!isWav) return { file, embedded: false, skipped: 'not_wav' };

    const buf = await file.arrayBuffer();
    const outBuf = embedWavMetadataBuffer(buf, meta);
    const outFile = new File([outBuf], name, { type: 'audio/wav' });
    return { file: outFile, embedded: true };
}

if (typeof window !== 'undefined') {
    window.embedWavMetadata = embedWavMetadata;
    window.embedWavMetadataBuffer = embedWavMetadataBuffer;
}
