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
