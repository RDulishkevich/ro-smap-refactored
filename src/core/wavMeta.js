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
    // EBU Tech 3285 bext chunk (minimum useful fields)
    const desc = String(meta.description || meta.fxName || '').slice(0, 256);
    const originator = String(meta.originator || meta.creatorId || '').slice(0, 32);
    const originatorReference = String(meta.originatorReference || meta.soundId || '').slice(0, 32);
    const date = String(meta.originationDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '-').slice(0, 10);
    const time = String(meta.originationTime || '00:00:00').slice(0, 8);

    const parts = [
        encAscii(desc, 256),
        encAscii(originator, 32),
        encAscii(originatorReference, 32),
        encAscii(date, 10),
        encAscii(time, 8),
        u32le(0), u32le(0), // TimeReference low/high
        new Uint8Array([0, 0]), // Version
        new Uint8Array(64), // UMID
        new Uint8Array(190) // Reserved + coding history stub
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
    const tags = {
        SPEED: {
            TIMESTAMP_MODE: 'Original',
            TIMECODE_FLAG: 'NonDrop'
        },
        BEXT: {
            BWF_DESCRIPTION: meta.description || meta.fxName || '',
            BWF_ORIGINATOR: meta.originator || meta.creatorId || '',
            BWF_ORIGINATOR_REFERENCE: meta.originatorReference || meta.soundId || ''
        },
        USER: {
            UCS_CATID: meta.catId || '',
            UCS_CATEGORY: meta.category || '',
            UCS_SUBCATEGORY: meta.subCategory || '',
            UCS_FXNAME: meta.fxName || '',
            UCS_CREATORID: meta.creatorId || '',
            UCS_SOURCEID: meta.sourceId || 'ROSMAP',
            LOCATION: meta.location || '',
            GPS: meta.lat != null && meta.lng != null ? `${meta.lat},${meta.lng}` : '',
            MIC_TYPE: meta.micType || '',
            RECORDER: meta.recorder || '',
            CHANNELS: meta.channels || '',
            LICENSE: meta.license || '',
            KEYWORDS: meta.keywords || '',
            ECO_CATEGORY: meta.ecoCategory || '',
            NOTE: meta.note || meta.description || ''
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
    const payload = padEven(encUtf8(String(text || '') + '\0'));
    // INFO subchunk size is payload length including null, before pad — RIFF uses unpadded size
    const raw = encUtf8(String(text || '') + '\0');
    return concatChunks([fourCC(tag), u32le(raw.length), padEven(raw)]);
}

function buildListInfo(meta) {
    const body = concatChunks([
        fourCC('INFO'),
        infoSubchunk('INAM', meta.fxName || meta.title || ''),
        infoSubchunk('IART', meta.creatorId || meta.originator || ''),
        infoSubchunk('ICMT', meta.description || ''),
        infoSubchunk('ICOP', meta.license || ''),
        infoSubchunk('IGNR', meta.category || meta.catId || '')
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
