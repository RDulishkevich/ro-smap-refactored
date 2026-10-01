export type MatrixFoa = {
  input: GainNode;
  output: GainNode;
  setRotation: (yawDeg: number, pitchDeg: number) => void;
};

export function buildMatrixFoaDecoder(ctx: AudioContext): MatrixFoa {
  const input = ctx.createGain();
  input.channelCount = 4;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'discrete';

  const splitter = ctx.createChannelSplitter(4);
  input.connect(splitter);

  const pair = (ch: number) => {
    const gL = ctx.createGain();
    const gR = ctx.createGain();
    try { splitter.connect(gL, ch); } catch { /* */ }
    try { splitter.connect(gR, ch); } catch { /* */ }
    return { gL, gR };
  };
  const W = pair(0);
  const X = pair(1);
  const Y = pair(2);
  const Z = pair(3);

  const merger = ctx.createChannelMerger(2);
  [W, X, Y, Z].forEach(({ gL, gR }) => {
    try { gL.connect(merger, 0, 0); } catch { /* */ }
    try { gR.connect(merger, 0, 1); } catch { /* */ }
  });

  const output = ctx.createGain();
  merger.connect(output);

  const SQRT_HALF = Math.SQRT1_2;
  const apply = (yawDeg = 0, pitchDeg = 0) => {
    const yaw = (Number(yawDeg) || 0) * Math.PI / 180;
    const pitch = (Number(pitchDeg) || 0) * Math.PI / 180;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const m00 = cy * cp, m01 = -sy, m02 = cy * sp;
    const m10 = sy * cp, m11 = cy, m12 = sy * sp;
    W.gL.gain.value = SQRT_HALF;
    W.gR.gain.value = SQRT_HALF;
    X.gL.gain.value = 0.5 * m00 + 0.5 * m10;
    X.gR.gain.value = 0.5 * m00 - 0.5 * m10;
    Y.gL.gain.value = 0.5 * m01 + 0.5 * m11;
    Y.gR.gain.value = 0.5 * m01 - 0.5 * m11;
    Z.gL.gain.value = 0.35 * m02 + 0.35 * m12;
    Z.gR.gain.value = 0.35 * m02 - 0.35 * m12;
  };
  apply(0, 0);

  return {
    input,
    output,
    setRotation(yawDeg, pitchDeg) { apply(yawDeg, pitchDeg); },
  };
}

export function padFoaBuffer(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels >= 4) return buffer;
  const out = ctx.createBuffer(4, buffer.length, buffer.sampleRate);
  if (buffer.numberOfChannels === 1) {
    out.copyToChannel(buffer.getChannelData(0), 0);
  } else {
    out.copyToChannel(buffer.getChannelData(0), 0);
    out.copyToChannel(buffer.getChannelData(1), 2);
  }
  return out;
}
