const cache = new Map<string, number[]>();
const blobJobs = new Map<string, Promise<Blob>>();

export function fetchAudioBlob(url: string): Promise<Blob> {
  const hit = blobJobs.get(url);
  if (hit) return hit;
  const job = fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error('audio');
      return res.blob();
    })
    .catch((err) => {
      blobJobs.delete(url);
      throw err;
    });
  blobJobs.set(url, job);
  return job;
}

function barsFromChannel(data: Float32Array, bars: number): number[] {
  const n = data.length;
  if (!n) return Array.from({ length: bars }, () => 0.12);
  const step = Math.max(1, Math.floor(n / bars));
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const a = i * step;
    const b = Math.min(n, a + step);
    let peak = 0;
    for (let k = a; k < b; k++) peak = Math.max(peak, Math.abs(data[k]));
    out.push(Math.max(0.06, Math.min(1, peak * 1.6)));
  }
  return out;
}

async function decode(buf: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(buf.slice(0));
  } finally {
    void ctx.close();
  }
}

export function playLength(el: HTMLMediaElement | null, fallback: number) {
  const d = Number(el?.duration);
  if (Number.isFinite(d) && d > 0.05) return d;
  return Math.max(0.2, fallback);
}

export async function durationFromBlob(blob: Blob): Promise<number> {
  const buffer = await decode(await blob.arrayBuffer());
  return buffer.duration;
}

export async function peaksFromBuffer(buffer: AudioBuffer, bars = 80): Promise<number[]> {
  return barsFromChannel(buffer.getChannelData(0), bars);
}

export async function peaksFromBlob(blob: Blob, bars = 80): Promise<number[]> {
  const key = `blob:${blob.size}:${blob.type}:${bars}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const buffer = await decode(await blob.arrayBuffer());
  const peaks = await peaksFromBuffer(buffer, bars);
  cache.set(key, peaks);
  return peaks;
}

const PREVIEW_BYTES = 1024 * 1024;
const previewCache = new Map<string, number[]>();
let peakQueue: Promise<unknown> = Promise.resolve();

function enqueuePeak<T>(fn: () => Promise<T>): Promise<T> {
  const run = peakQueue.then(fn, fn);
  peakQueue = run.then(() => undefined, () => undefined);
  return run;
}

/** PCM / IEEE-float WAV → peaks. Uses only the bytes we have (Range previews OK). */
export function peaksFromWavArrayBuffer(ab: ArrayBuffer, sampleCount = 64): number[] | null {
  if (!ab || ab.byteLength < 44) return null;
  const view = new DataView(ab);
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) return null;
  let offset = 12;
  let channels = 1;
  let bits = 16;
  let format = 1;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    const next = offset + 8 + size + (size % 2);
    if (id === 0x666d7420) {
      format = view.getUint16(offset + 8, true);
      channels = Math.max(1, view.getUint16(offset + 10, true) || 1);
      bits = view.getUint16(offset + 22, true) || 16;
      if (format !== 1 && format !== 3) return null;
      if (format === 3) bits = 32;
    } else if (id === 0x64617461) {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    if (next <= offset) break;
    offset = next;
  }
  if (dataOffset < 0 || dataOffset >= view.byteLength) return null;
  const n = Math.max(8, Math.min(160, sampleCount | 0 || 64));
  const bytesPerSample = Math.max(1, bits / 8);
  const frameSize = bytesPerSample * channels;
  const available = view.byteLength - dataOffset;
  const usable = Math.min(dataSize > 0 ? dataSize : available, available);
  const totalFrames = Math.floor(usable / frameSize);
  if (totalFrames < 8 || frameSize < 1) return null;
  const block = Math.max(1, Math.floor(totalFrames / n));
  const stride = Math.max(1, Math.floor(block / 48));
  const endByte = dataOffset + usable;

  const readSample = (byteOffset: number) => {
    if (byteOffset + bytesPerSample > endByte) return 0;
    if (bits === 8) return (view.getUint8(byteOffset) - 128) / 128;
    if (bits === 16) return view.getInt16(byteOffset, true) / 32768;
    if (bits === 24) {
      const b0 = view.getUint8(byteOffset);
      const b1 = view.getUint8(byteOffset + 1);
      const b2 = view.getUint8(byteOffset + 2);
      let sample = (b2 << 16) | (b1 << 8) | b0;
      if (sample & 0x800000) sample |= ~0xffffff;
      return sample / 8388608;
    }
    if (bits === 32) return format === 3 ? view.getFloat32(byteOffset, true) : view.getInt32(byteOffset, true) / 2147483648;
    return 0;
  };

  const peaks = new Array<number>(n);
  let maxPeak = 0.0001;
  for (let i = 0; i < n; i++) {
    const startFrame = i * block;
    const endFrame = Math.min(totalFrames, startFrame + block);
    let peak = 0;
    for (let f = startFrame; f < endFrame; f += stride) {
      const o = dataOffset + f * frameSize;
      const a = Math.abs(readSample(o));
      if (a > peak) peak = a;
    }
    peaks[i] = peak;
    if (peak > maxPeak) maxPeak = peak;
  }
  for (let i = 0; i < n; i++) {
    const norm = peaks[i] / maxPeak;
    peaks[i] = Math.max(0.12, Math.min(1, Math.pow(norm, 0.72)));
  }
  return peaks;
}

/** First megabyte via Range — never decode the whole file. */
export async function peaksFromWavPreview(url: string, bars = 64): Promise<number[] | null> {
  const key = `prev:${url}:${bars}`;
  const hit = previewCache.get(key);
  if (hit) return hit;
  return enqueuePeak(async () => {
    const cached = previewCache.get(key);
    if (cached) return cached;
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache',
        headers: { Range: `bytes=0-${PREVIEW_BYTES - 1}` },
      });
      if (!res.ok && res.status !== 206) return null;
      const raw = await res.arrayBuffer();
      const ab = raw.byteLength > PREVIEW_BYTES ? raw.slice(0, PREVIEW_BYTES) : raw;
      const peaks = peaksFromWavArrayBuffer(ab, bars);
      if (peaks?.length) previewCache.set(key, peaks);
      return peaks;
    } catch {
      return null;
    }
  });
}

export async function peaksFromUrl(url: string, bars = 80): Promise<number[]> {
  const key = `${url}:${bars}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const preview = await peaksFromWavPreview(url, bars);
  if (preview?.length) {
    cache.set(key, preview);
    return preview;
  }
  const blob = await fetchAudioBlob(url);
  const buffer = await decode(await blob.arrayBuffer());
  const peaks = await peaksFromBuffer(buffer, bars);
  cache.set(key, peaks);
  return peaks;
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytes = len * ch * 2;
  const ab = new ArrayBuffer(44 + bytes);
  const view = new DataView(ab);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + bytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, bytes, true);
  const channels = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export async function applyTrimGain(blob: Blob, start: number, end: number, gain: number): Promise<{ blob: Blob; durationSec: number }> {
  const ctx = new AudioContext();
  let srcBuf: AudioBuffer;
  try {
    srcBuf = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
  } finally {
    void ctx.close();
  }
  const t0 = Math.max(0, Math.min(srcBuf.duration, start * srcBuf.duration));
  const t1 = Math.max(t0 + 0.05, Math.min(srcBuf.duration, end * srcBuf.duration));
  const sample0 = Math.floor(t0 * srcBuf.sampleRate);
  const sample1 = Math.floor(t1 * srcBuf.sampleRate);
  const length = Math.max(1, sample1 - sample0);
  const offline = new OfflineAudioContext(srcBuf.numberOfChannels, length, srcBuf.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = srcBuf;
  const g = offline.createGain();
  g.gain.value = Math.max(0.05, Math.min(2.5, gain));
  source.connect(g);
  g.connect(offline.destination);
  source.start(0, t0, t1 - t0);
  const rendered = await offline.startRendering();
  return { blob: encodeWav(rendered), durationSec: Math.max(1, Math.round(rendered.duration)) };
}

export function formatClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function parseDurationLabel(label: string | number | undefined): number {
  const raw = String(label ?? '');
  const m = raw.match(/^(\d+):(\d{1,2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
