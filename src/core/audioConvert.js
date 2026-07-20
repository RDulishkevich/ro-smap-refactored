/**
 * Detect audio tech params and convert arbitrary browser-decodable audio → WAV PCM.
 */

function readFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );
}

/** Read fmt chunk from WAV; returns null if not WAVE. */
export function readWavFormatInfo(buffer) {
    if (!buffer || buffer.byteLength < 44) return null;
    const view = new DataView(buffer);
    if (readFourCC(view, 0) !== 'RIFF' || readFourCC(view, 8) !== 'WAVE') return null;

    let offset = 12;
    while (offset + 8 <= buffer.byteLength) {
        const id = readFourCC(view, offset);
        const size = view.getUint32(offset + 4, true);
        const payloadStart = offset + 8;
        const padded = size + (size % 2);
        if (payloadStart + size > buffer.byteLength) break;

        if (id === 'fmt ' && size >= 16) {
            const audioFormat = view.getUint16(payloadStart, true);
            const channels = view.getUint16(payloadStart + 2, true);
            const sampleRate = view.getUint32(payloadStart + 4, true);
            let bitsPerSample = view.getUint16(payloadStart + 14, true);
            let float = audioFormat === 3;
            if (audioFormat === 0xFFFE && size >= 40) {
                const bits = view.getUint16(payloadStart + 14, true);
                bitsPerSample = bits;
                const subFormat = view.getUint16(payloadStart + 24, true);
                float = subFormat === 3;
            }
            return { sampleRate, channels, bitsPerSample, float, audioFormat };
        }
        if (id === 'data') break;
        offset = payloadStart + padded;
    }
    return null;
}

export function formatWavLabel({ sampleRate, bitsPerSample, float } = {}) {
    const sr = Number(sampleRate) || 0;
    const bits = Number(bitsPerSample) || 0;
    if (!sr || !bits) return '';
    const khz = sr % 1000 === 0 ? `${sr / 1000}kHz` : `${sr}Hz`;
    const depth = float ? `${bits}-bit Float` : `${bits}-bit`;
    return `WAV ${khz} / ${depth}`;
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** Encode AudioBuffer as 24-bit PCM WAV (or 16-bit if bitDepth === 16). */
export function audioBufferToWav(audioBuffer, { bitDepth = 24 } = {}) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numFrames = audioBuffer.length;
    const bytesPerSample = bitDepth === 16 ? 2 : 3;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numFrames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth === 16 ? 16 : 24, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = [];
    for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));

    let offset = 44;
    if (bitDepth === 16) {
        for (let i = 0; i < numFrames; i++) {
            for (let c = 0; c < numChannels; c++) {
                let s = Math.max(-1, Math.min(1, channels[c][i]));
                s = s < 0 ? s * 0x8000 : s * 0x7fff;
                view.setInt16(offset, s | 0, true);
                offset += 2;
            }
        }
    } else {
        for (let i = 0; i < numFrames; i++) {
            for (let c = 0; c < numChannels; c++) {
                let s = Math.max(-1, Math.min(1, channels[c][i]));
                const v = Math.round(s * 0x7fffff);
                view.setUint8(offset, v & 0xff);
                view.setUint8(offset + 1, (v >> 8) & 0xff);
                view.setUint8(offset + 2, (v >> 16) & 0xff);
                offset += 3;
            }
        }
    }
    return buffer;
}

export async function decodeAudioFile(file) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('AudioContext unavailable');
    const ctx = new AC();
    try {
        const ab = await file.arrayBuffer();
        return await ctx.decodeAudioData(ab.slice(0));
    } finally {
        try { await ctx.close(); } catch (_) {}
    }
}

/**
 * Pitch-shift by resampling (duration changes with pitch).
 * ratio > 1 → higher pitch / shorter; ratio < 1 → lower / longer.
 */
export function pitchShiftAudioBuffer(audioBuffer, ratio) {
    const r = Math.max(0.25, Math.min(4, Number(ratio) || 1));
    if (Math.abs(r - 1) < 0.001) return audioBuffer;
    const newLen = Math.max(1, Math.floor(audioBuffer.length / r));
    const AC = window.AudioContext || window.webkitAudioContext;
    const tmp = new AC();
    const out = tmp.createBuffer(audioBuffer.numberOfChannels, newLen, audioBuffer.sampleRate);
    try { tmp.close(); } catch (_) {}
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const src = audioBuffer.getChannelData(c);
        const dst = out.getChannelData(c);
        for (let i = 0; i < newLen; i++) {
            const srcPos = i * r;
            const i0 = Math.floor(srcPos);
            const i1 = Math.min(i0 + 1, src.length - 1);
            const t = srcPos - i0;
            dst[i] = src[i0] * (1 - t) + src[i1] * t;
        }
    }
    return out;
}

/**
 * Ensure upload file is WAV; detect/format label from source.
 * @returns {Promise<{ file: File, formatLabel: string, converted: boolean, sampleRate: number, channels: number }>}
 */
export async function ensureWavUploadFile(file) {
    if (!file) throw new Error('no_file');
    const name = file.name || 'audio';
    const isWav = /\.wav$/i.test(name) || file.type === 'audio/wav' || file.type === 'audio/x-wav';

    if (isWav) {
        const buf = await file.arrayBuffer();
        const info = readWavFormatInfo(buf);
        const formatLabel = info
            ? formatWavLabel(info)
            : 'WAV';
        const outName = name.replace(/\.[^.]+$/, '') + '.wav';
        const outFile = file.name.toLowerCase().endsWith('.wav')
            ? file
            : new File([buf], outName, { type: 'audio/wav' });
        return {
            file: outFile,
            formatLabel,
            converted: false,
            sampleRate: info?.sampleRate || 0,
            channels: info?.channels || 0,
            bitsPerSample: info?.bitsPerSample || 0
        };
    }

    const audioBuffer = await decodeAudioFile(file);
    const wavBuf = audioBufferToWav(audioBuffer, { bitDepth: 24 });
    const base = name.replace(/\.[^.]+$/, '') || 'audio';
    const outFile = new File([wavBuf], `${base}.wav`, { type: 'audio/wav' });
    const formatLabel = formatWavLabel({
        sampleRate: audioBuffer.sampleRate,
        bitsPerSample: 24,
        float: false
    });
    return {
        file: outFile,
        formatLabel,
        converted: true,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        bitsPerSample: 24
    };
}

if (typeof window !== 'undefined') {
    window.readWavFormatInfo = readWavFormatInfo;
    window.formatWavLabel = formatWavLabel;
    window.audioBufferToWav = audioBufferToWav;
    window.decodeAudioFile = decodeAudioFile;
    window.pitchShiftAudioBuffer = pitchShiftAudioBuffer;
    window.ensureWavUploadFile = ensureWavUploadFile;
}
