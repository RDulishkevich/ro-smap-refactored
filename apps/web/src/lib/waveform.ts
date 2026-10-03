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

export async function peaksFromUrl(url: string, bars = 80): Promise<number[]> {
  const key = `${url}:${bars}`;
  const hit = cache.get(key);
  if (hit) return hit;
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
