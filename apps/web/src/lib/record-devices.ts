import { encodeWavFromChannels } from './waveform';

const IN_KEY = 'polevka_rec_in';
const OUT_KEY = 'polevka_rec_out';
const MAX_CHANNELS = 8;

export type AudioPick = { deviceId: string; label: string };

export type RecCapture = {
  channels: number;
  analysers: AnalyserNode[];
  mix: AnalyserNode;
  left: AnalyserNode;
  right: AnalyserNode;
  dest: MediaStreamAudioDestinationNode;
  monitor: GainNode;
  drainWav: () => Blob | null;
};

export function readRecInput() {
  try { return localStorage.getItem(IN_KEY) || ''; } catch { return ''; }
}
export function readRecOutput() {
  try { return localStorage.getItem(OUT_KEY) || ''; } catch { return ''; }
}
export function writeRecInput(id: string) {
  try { localStorage.setItem(IN_KEY, id); } catch { /* */ }
}
export function writeRecOutput(id: string) {
  try { localStorage.setItem(OUT_KEY, id); } catch { /* */ }
}

export function resolveInputChannels(settingsCount: number, capabilityMax = 0, sourceCount = 1): number {
  const n = Math.round(settingsCount || capabilityMax || sourceCount || 1);
  return Math.max(1, Math.min(MAX_CHANNELS, n));
}

export function channelLaneLabel(index: number, total: number): string {
  if (total === 2) return index === 0 ? 'L' : 'R';
  return String(index + 1);
}

export function streamChannelCount(stream: MediaStream, sourceChannels = 1): number {
  const track = stream.getAudioTracks()[0];
  const settings = Number(track?.getSettings()?.channelCount) || 0;
  let capMax = 0;
  try {
    const cap = track?.getCapabilities?.();
    capMax = Number(cap?.channelCount?.max) || 0;
  } catch { /* capabilities unsupported */ }
  return resolveInputChannels(settings, capMax, sourceChannels);
}

export async function listAudioDevices(): Promise<{ inputs: AudioPick[]; outputs: AudioPick[] }> {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [] };
  const all = await navigator.mediaDevices.enumerateDevices();
  const label = (d: MediaDeviceInfo, i: number, kind: string) =>
    d.label || (kind === 'in' ? `Микрофон ${i + 1}` : `Выход ${i + 1}`);
  return {
    inputs: all.filter((d) => d.kind === 'audioinput').map((d, i) => ({ deviceId: d.deviceId, label: label(d, i, 'in') })),
    outputs: all.filter((d) => d.kind === 'audiooutput').map((d, i) => ({ deviceId: d.deviceId, label: label(d, i, 'out') })),
  };
}

/** Unlock device labels (and later setSinkId) after a user gesture. */
export async function unlockAudioDevices(): Promise<{ inputs: AudioPick[]; outputs: AudioPick[] }> {
  if (!navigator.mediaDevices?.getUserMedia) return listAudioDevices();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((tr) => tr.stop());
  return listAudioDevices();
}

export async function applySinkId(el: { setSinkId?: (id: string) => Promise<void> } | null, id: string) {
  if (!el || !id || typeof el.setSinkId !== 'function') return;
  try { await el.setSinkId(id); } catch { /* device gone */ }
}

export async function applyCtxSink(ctx: AudioContext | null, id: string) {
  const anyCtx = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (!anyCtx || !id || typeof anyCtx.setSinkId !== 'function') return;
  try { await anyCtx.setSinkId(id); } catch { /* */ }
}

export async function requestRecStream(deviceId: string): Promise<MediaStream> {
  const base: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { min: 1, ideal: MAX_CHANNELS },
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: base });
  const track = stream.getAudioTracks()[0];
  try {
    const cap = track?.getCapabilities?.();
    const maxCh = Number(cap?.channelCount?.max) || 0;
    if (track && maxCh > 1) {
      await track.applyConstraints({ channelCount: Math.min(MAX_CHANNELS, maxCh) });
    }
  } catch { /* browser / driver rejected the extra channels */ }
  return stream;
}

function concatFloat32(parts: Float32Array[]): Float32Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function makeAnalyser(ctx: AudioContext): AnalyserNode {
  const node = ctx.createAnalyser();
  node.fftSize = 2048;
  node.smoothingTimeConstant = 0.12;
  return node;
}

/** Discrete N-channel graph: one analyser (and PCM lane) per input channel. */
export function wireRecCapture(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  stream: MediaStream,
): RecCapture {
  const channels = streamChannelCount(stream, source.channelCount || 1);
  const split = ctx.createChannelSplitter(channels);
  const merger = ctx.createChannelMerger(channels);
  const analysers = Array.from({ length: channels }, () => makeAnalyser(ctx));
  const mix = makeAnalyser(ctx);

  source.connect(split);
  for (let i = 0; i < channels; i++) {
    split.connect(analysers[i], i);
    split.connect(merger, i, i);
  }
  merger.connect(mix);

  const dest = ctx.createMediaStreamDestination();
  try {
    dest.channelCount = channels;
    dest.channelCountMode = 'explicit';
    dest.channelInterpretation = 'discrete';
  } catch { /* some browsers only allow stereo destinations */ }
  merger.connect(dest);

  const monitor = ctx.createGain();
  monitor.gain.value = 0;
  merger.connect(monitor);
  monitor.connect(ctx.destination);

  const pcm: Float32Array[][] = Array.from({ length: channels }, () => []);
  let samples = 0;
  const ctor = ctx.createScriptProcessor?.bind(ctx);
  if (ctor) {
    const processor = ctor(4096, channels, channels);
    const keepAlive = ctx.createGain();
    keepAlive.gain.value = 0;
    processor.onaudioprocess = (e) => {
      for (let c = 0; c < channels; c++) {
        const data = e.inputBuffer.getChannelData(c);
        pcm[c].push(new Float32Array(data));
      }
      samples += e.inputBuffer.length;
    };
    merger.connect(processor);
    processor.connect(keepAlive);
    keepAlive.connect(ctx.destination);
  }

  const drainWav = (): Blob | null => {
    if (samples < 32 || !pcm[0]?.length) return null;
    const lanes = pcm.map(concatFloat32);
    return encodeWavFromChannels(lanes, ctx.sampleRate || 48000);
  };

  return {
    channels,
    analysers,
    mix,
    left: analysers[0],
    right: analysers[1] || analysers[0],
    dest,
    monitor,
    drainWav,
  };
}
