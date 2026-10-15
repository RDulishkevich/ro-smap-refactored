import { describe, expect, it } from 'vitest';
import { peaksFromWavArrayBuffer } from './waveform';

function pcmWav(frames: number, sampleRate = 8000) {
  const dataSize = frames * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < frames; i++) {
    const amp = Math.sin((i / frames) * Math.PI * 8) * 20000;
    view.setInt16(44 + i * 2, amp, true);
  }
  return buf;
}

describe('peaksFromWavArrayBuffer', () => {
  it('reads PCM WAV peaks without AudioContext', () => {
    const peaks = peaksFromWavArrayBuffer(pcmWav(2048), 32);
    expect(peaks).toBeTruthy();
    expect(peaks!.length).toBe(32);
    expect(Math.max(...peaks!)).toBeGreaterThan(0.5);
  });

  it('uses only available bytes when the data chunk is truncated', () => {
    const full = pcmWav(8000);
    const truncated = full.slice(0, 44 + 512);
    const peaks = peaksFromWavArrayBuffer(truncated, 16);
    expect(peaks).toBeTruthy();
    expect(peaks!.length).toBe(16);
  });

  it('rejects non-wav buffers', () => {
    expect(peaksFromWavArrayBuffer(new ArrayBuffer(64))).toBeNull();
  });
});
