const IN_KEY = 'polevka_rec_in';
const OUT_KEY = 'polevka_rec_out';

export type AudioPick = { deviceId: string; label: string };

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

export async function applySinkId(el: { setSinkId?: (id: string) => Promise<void> } | null, id: string) {
  if (!el || !id || typeof el.setSinkId !== 'function') return;
  try { await el.setSinkId(id); } catch { /* device gone */ }
}

export async function applyCtxSink(ctx: AudioContext | null, id: string) {
  const anyCtx = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (!anyCtx || !id || typeof anyCtx.setSinkId !== 'function') return;
  try { await anyCtx.setSinkId(id); } catch { /* */ }
}

/** Phone mics are often mono (or stereo with a dead right). Wire a stereo bus so both ears hear the take. */
export function wireRecCapture(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
  stream: MediaStream,
  opts: { keepStereo: boolean },
) {
  const track = stream.getAudioTracks()[0];
  const reported = Number(track?.getSettings()?.channelCount) || source.channelCount || 1;
  const stereo = opts.keepStereo && reported >= 2;

  const mix = ctx.createAnalyser();
  mix.fftSize = 2048;
  mix.smoothingTimeConstant = 0.2;
  const left = ctx.createAnalyser();
  const right = ctx.createAnalyser();
  left.fftSize = 2048;
  right.fftSize = 2048;

  const dest = ctx.createMediaStreamDestination();
  dest.channelCount = 2;
  dest.channelCountMode = 'explicit';
  dest.channelInterpretation = 'speakers';

  const monitor = ctx.createGain();
  monitor.gain.value = 0;

  if (stereo) {
    const split = ctx.createChannelSplitter(2);
    source.connect(split);
    split.connect(left, 0);
    split.connect(right, 1);
    source.connect(mix);
    source.connect(dest);
    source.connect(monitor);
  } else {
    // Sum available input channels → duplicate to L and R (fixes phone “left only”).
    const split = ctx.createChannelSplitter(Math.max(2, reported));
    const sum = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    source.connect(split);
    if (reported >= 2) {
      const g0 = ctx.createGain();
      const g1 = ctx.createGain();
      g0.gain.value = 0.5;
      g1.gain.value = 0.5;
      split.connect(g0, 0);
      split.connect(g1, 1);
      g0.connect(sum);
      g1.connect(sum);
    } else {
      split.connect(sum, 0);
    }
    sum.connect(merger, 0, 0);
    sum.connect(merger, 0, 1);
    sum.connect(left);
    sum.connect(right);
    merger.connect(mix);
    merger.connect(dest);
    merger.connect(monitor);
  }

  monitor.connect(ctx.destination);
  return { mix, left, right, dest, monitor };
}
