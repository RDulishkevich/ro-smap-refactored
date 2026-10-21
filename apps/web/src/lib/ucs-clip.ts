/** Build a short base64 clip (~45s / ≤2.8MB) for experimental UCS audio catalogize. */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const raw = String(reader.result || '');
      const i = raw.indexOf(',');
      resolve(i >= 0 ? raw.slice(i + 1) : raw);
    };
    reader.readAsDataURL(blob);
  });
}

async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const buf = await blob.arrayBuffer();
    return await ctx.decodeAudioData(buf.slice(0));
  } finally {
    void ctx.close();
  }
}

function encodeWavMono(buffer: AudioBuffer, maxSec: number): Blob {
  const rate = Math.min(16000, buffer.sampleRate);
  const src = buffer.getChannelData(0);
  const take = Math.min(src.length, Math.floor(buffer.sampleRate * maxSec));
  const ratio = buffer.sampleRate / rate;
  const outLen = Math.floor(take / ratio);
  const samples = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const s = src[Math.min(take - 1, Math.floor(i * ratio))] || 0;
    const v = Math.max(-1, Math.min(1, s));
    samples[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const dataSize = samples.length * 2;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  return new Blob([header, samples], { type: 'audio/wav' });
}

export async function buildUcsAudioClip(source: Blob | string): Promise<{ audioBase64: string; audioMime: string }> {
  let blob: Blob;
  if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) throw new Error('audio_fetch_failed');
    blob = await res.blob();
  } else {
    blob = source;
  }

  try {
    const decoded = await decodeBlob(blob);
    let clip = encodeWavMono(decoded, 45);
    if (clip.size > 2_800_000) clip = encodeWavMono(decoded, 25);
    if (clip.size > 2_800_000) throw new Error('audio_too_large');
    return { audioBase64: await blobToBase64(clip), audioMime: 'audio/wav' };
  } catch {
    // Fallback: send a truncated original if decode fails (e.g. exotic codecs).
    const slice = blob.size > 2_800_000 ? blob.slice(0, 2_800_000, blob.type || 'audio/wav') : blob;
    return {
      audioBase64: await blobToBase64(slice),
      audioMime: slice.type || 'audio/wav',
    };
  }
}
