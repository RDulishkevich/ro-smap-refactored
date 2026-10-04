import { useEffect, useRef, useState } from 'react';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';
import { audioService } from '../lib/audio-player';

const DARK_STOPS = [
  { t: 0, c: [21, 36, 32] },
  { t: 0.22, c: [45, 60, 57] },
  { t: 0.45, c: [111, 124, 78] },
  { t: 0.68, c: [181, 97, 63] },
  { t: 0.88, c: [244, 232, 216] },
  { t: 1, c: [255, 255, 255] },
];
const LIGHT_STOPS = [
  { t: 0, c: [232, 237, 234] },
  { t: 0.22, c: [217, 226, 195] },
  { t: 0.48, c: [157, 177, 112] },
  { t: 0.72, c: [181, 97, 63] },
  { t: 0.9, c: [45, 60, 57] },
  { t: 1, c: [26, 26, 26] },
];

function lerpRgb(v: number, stops: typeof DARK_STOPS): [number, number, number] {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (x >= a.t && x <= b.t) {
      const t = (x - a.t) / (b.t - a.t || 1);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * t),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * t),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * t),
      ];
    }
  }
  const last = stops[stops.length - 1].c;
  return [last[0], last[1], last[2]];
}

function rmsOf(an: AnalyserNode, buf: Float32Array<ArrayBuffer>) {
  an.getFloatTimeDomainData(buf);
  let sum = 0, peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  return { rms: Math.sqrt(sum / buf.length), peak };
}

function dbFromRms(rms: number) {
  if (!rms) return -Infinity;
  return 20 * Math.log10(rms);
}

function dbToPct(db: number) {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

function panLabel(pan: number) {
  if (Math.abs(pan) < 0.02) return 'C';
  if (pan < 0) return `L ${Math.round(Math.abs(pan) * 100)}`;
  return `R ${Math.round(pan * 100)}`;
}

export function AnalyzersPanel({ playing }: { playing: boolean }) {
  const th = useTh();
  const t = useT();
  const [pan, setPan] = useState(() => audioService.pan);
  const [pitch, setPitch] = useState(() => audioService.pitch);
  const gonioRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const lRms = useRef<HTMLDivElement>(null);
  const rRms = useRef<HTMLDivElement>(null);
  const lPeak = useRef<HTMLDivElement>(null);
  const rPeak = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLSpanElement>(null);
  const dark = th.isDark;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const bufA = new Float32Array(new ArrayBuffer(2048 * 4));
    const bufB = new Float32Array(new ArrayBuffer(2048 * 4));
    const spec = new Uint8Array(1024);
    const gonioFade = dark ? 'rgba(21,36,32,0.35)' : 'rgba(238,243,239,0.42)';
    const grid = dark ? 'rgba(157,177,112,0.32)' : 'rgba(45,60,57,0.2)';
    const gridSoft = dark ? 'rgba(157,177,112,0.14)' : 'rgba(45,60,57,0.1)';
    const label = dark ? color.sage : color.olive;
    const stroke = color.accent;
    const stops = dark ? DARK_STOPS : LIGHT_STOPS;
    let peakHoldL = 0, peakHoldR = 0, holdL = 0, holdR = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - last < 32) return;
      last = ts;
      const anL = audioService.anL;
      const anR = audioService.anR;
      const mix = audioService.analyser;
      const ctxA = audioService.ctx;

      const gonio = gonioRef.current;
      if (gonio) {
        const g = gonio.getContext('2d');
        if (g) {
          const w = gonio.width, h = gonio.height;
          const cx = w / 2, cy = h / 2;
          const scale = Math.min(w, h) / 2 * 0.78;
          g.fillStyle = gonioFade;
          g.fillRect(0, 0, w, h);
          g.strokeStyle = grid;
          g.lineWidth = 1.2;
          g.beginPath(); g.arc(cx, cy, scale, 0, Math.PI * 2); g.stroke();
          g.beginPath();
          g.moveTo(cx - scale, cy); g.lineTo(cx + scale, cy);
          g.moveTo(cx, cy - scale); g.lineTo(cx, cy + scale);
          g.stroke();
          g.strokeStyle = gridSoft;
          g.beginPath();
          g.moveTo(cx - scale * 0.7, cy - scale * 0.7); g.lineTo(cx + scale * 0.7, cy + scale * 0.7);
          g.moveTo(cx - scale * 0.7, cy + scale * 0.7); g.lineTo(cx + scale * 0.7, cy - scale * 0.7);
          g.stroke();
          g.fillStyle = label;
          g.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
          g.fillText('M', cx - 4, cy - scale - 3);
          g.fillText('L', 6, cy + 4);
          g.fillText('R', w - 14, cy + 4);
          if (playing && anL && anR) {
            anL.getFloatTimeDomainData(bufA);
            anR.getFloatTimeDomainData(bufB);
            g.strokeStyle = stroke;
            g.lineWidth = 1.6;
            g.beginPath();
            const n = Math.min(bufA.length, bufB.length);
            const step = Math.max(1, Math.floor(n / 360));
            const G = 2.2;
            for (let i = 0; i < n; i += step) {
              const L = bufA[i], R = bufB[i];
              const x = cx + Math.tanh(((L - R) / Math.SQRT2) * G) * scale;
              const y = cy - Math.tanh(((L + R) / Math.SQRT2) * G) * scale;
              if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.stroke();
          }
        }
      }

      const specEl = specRef.current;
      if (specEl && mix && ctxA) {
        const s = specEl.getContext('2d', { willReadFrequently: true });
        if (s) {
          const w = specEl.width, h = specEl.height;
          s.drawImage(specEl, -1, 0);
          mix.getByteFrequencyData(spec);
          const nyquist = ctxA.sampleRate / 2;
          const minLog = Math.log10(20);
          const maxLog = Math.log10(Math.min(20000, nyquist));
          const col = s.createImageData(1, h);
          const data = col.data;
          const binCount = mix.frequencyBinCount;
          for (let y = 0; y < h; y++) {
            const tt = 1 - y / h;
            const freq = Math.pow(10, minLog + tt * (maxLog - minLog));
            const bin = Math.max(0, Math.min(binCount - 1, Math.round((freq / nyquist) * binCount)));
            const mag = Math.pow((spec[bin] || 0) / 255, 0.85);
            const rgb = lerpRgb(mag, stops);
            const i = y * 4;
            data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
          }
          s.putImageData(col, w - 1, 0);
        }
      }

      if (anL && anR) {
        const L = rmsOf(anL, bufA);
        const R = rmsOf(anR, bufB);
        const lDb = dbFromRms(L.rms);
        const rDb = dbFromRms(R.rms);
        const lPct = dbToPct(lDb);
        const rPct = dbToPct(rDb);
        const lPk = dbToPct(dbFromRms(L.peak));
        const rPk = dbToPct(dbFromRms(R.peak));
        if (lPk >= peakHoldL) { peakHoldL = lPk; holdL = 42; }
        else if (holdL > 0) holdL -= 1;
        else peakHoldL = Math.max(lPk, peakHoldL - 1.4);
        if (rPk >= peakHoldR) { peakHoldR = rPk; holdR = 42; }
        else if (holdR > 0) holdR -= 1;
        else peakHoldR = Math.max(rPk, peakHoldR - 1.4);
        if (lRms.current) lRms.current.style.width = `${lPct}%`;
        if (rRms.current) rRms.current.style.width = `${rPct}%`;
        if (lPeak.current) lPeak.current.style.left = `${peakHoldL}%`;
        if (rPeak.current) rPeak.current.style.left = `${peakHoldR}%`;
        const dbMax = Math.max(lDb, rDb);
        if (dbRef.current) dbRef.current.textContent = !Number.isFinite(dbMax) || dbMax <= -90 ? '−∞ dB' : `${dbMax.toFixed(1)} dB`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, dark]);

  const meter = (lab: string, rms: typeof lRms, peak: typeof lPeak) => (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[9px] font-bold" style={{ color: color.sage }}>{lab}</span>
      <div className="relative flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: dark ? 'rgba(26,41,38,0.65)' : 'rgba(255,255,255,0.7)' }}>
        <div ref={rms} className="absolute inset-y-0 left-0 rounded-full" style={{ width: '0%', background: color.accent }} />
        <div ref={peak} className="absolute top-0 bottom-0 w-0.5" style={{ left: '0%', background: color.dark }} />
      </div>
    </div>
  );

  return (
    <div className="mt-3 rounded-[22px] overflow-hidden" style={{
      background: dark ? '#152420' : '#EEF3EF',
      border: `1px solid ${th.border}`,
    }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${th.border}` }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: color.sage }}>{t('analyzers')}</span>
        <span ref={dbRef} className="text-[11px] font-mono font-bold tabular-nums" style={{ color: color.accent }}>−∞ dB</span>
      </div>
      <div className="grid grid-cols-[108px_minmax(0,1fr)] gap-2 p-2.5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: color.sage }}>{t('goniometer')}</p>
          <canvas ref={gonioRef} width={200} height={200} className="w-full aspect-square rounded-2xl block" style={{ background: dark ? '#1A2926' : '#F8FAF6' }} />
        </div>
        <div className="min-w-0 flex flex-col gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: color.sage }}>{t('spectrogram')}</p>
            <canvas ref={specRef} width={720} height={160} className="w-full h-[108px] rounded-2xl block" style={{ background: dark ? '#1A2926' : '#F8FAF6' }} />
          </div>
          <div className="flex flex-col gap-1.5">
            {meter('L', lRms, lPeak)}
            {meter('R', rRms, rPeak)}
          </div>
        </div>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2" style={{ borderTop: `1px solid ${th.border}` }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold w-3 text-center" style={{ color: color.sage }}>L</span>
          <input type="range" min={-1} max={1} step={0.01} value={pan} aria-label="Pan"
            className="flex-1 h-1.5 accent-[#B5613F] cursor-pointer"
            onChange={(e) => { const v = Number(e.target.value); setPan(v); audioService.setPan(v); }} />
          <span className="text-[9px] font-bold w-3 text-center" style={{ color: color.sage }}>R</span>
          <span className="text-[10px] font-mono font-semibold w-10 text-right" style={{ color: color.accent }}>{panLabel(pan)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold" style={{ color: color.sage }}>−12</span>
          <input type="range" min={-12} max={12} step={1} value={pitch} aria-label={t('pitch')}
            className="flex-1 h-1.5 accent-[#B5613F] cursor-pointer"
            onChange={(e) => { const v = Number(e.target.value); setPitch(v); audioService.setPitch(v); }} />
          <span className="text-[9px] font-bold" style={{ color: color.sage }}>+12</span>
          <span className="text-[10px] font-mono font-semibold w-10 text-right" style={{ color: color.accent }}>{pitch} st</span>
          <button type="button" className="text-[10px] font-bold px-2.5 h-7 rounded-xl cursor-pointer"
            style={{ color: color.olive, background: th.cardBg }}
            onClick={() => { setPan(0); setPitch(0); audioService.setPan(0); audioService.setPitch(0); }}>{t('reset')}</button>
        </div>
      </div>
    </div>
  );
}

export function LiveAnalyzers({
  mix, left, right, active,
}: {
  mix: AnalyserNode | null;
  left: AnalyserNode | null;
  right: AnalyserNode | null;
  active: boolean;
}) {
  const th = useTh();
  const t = useT();
  const gonioRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const lRms = useRef<HTMLDivElement>(null);
  const rRms = useRef<HTMLDivElement>(null);
  const lPeak = useRef<HTMLDivElement>(null);
  const rPeak = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLSpanElement>(null);
  const dark = th.isDark;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const bufA = new Float32Array(new ArrayBuffer(2048 * 4));
    const bufB = new Float32Array(new ArrayBuffer(2048 * 4));
    const spec = new Uint8Array(1024);
    const gonioFade = dark ? 'rgba(21,36,32,0.35)' : 'rgba(238,243,239,0.42)';
    const grid = dark ? 'rgba(157,177,112,0.32)' : 'rgba(45,60,57,0.2)';
    const gridSoft = dark ? 'rgba(157,177,112,0.14)' : 'rgba(45,60,57,0.1)';
    const label = dark ? color.sage : color.olive;
    const stroke = color.accent;
    const stops = dark ? DARK_STOPS : LIGHT_STOPS;
    let peakHoldL = 0, peakHoldR = 0, holdL = 0, holdR = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - last < 32) return;
      last = ts;
      const gonio = gonioRef.current;
      if (gonio) {
        const g = gonio.getContext('2d');
        if (g) {
          const w = gonio.width, h = gonio.height;
          const cx = w / 2, cy = h / 2;
          const scale = Math.min(w, h) / 2 * 0.78;
          g.fillStyle = gonioFade;
          g.fillRect(0, 0, w, h);
          g.strokeStyle = grid;
          g.lineWidth = 1.2;
          g.beginPath(); g.arc(cx, cy, scale, 0, Math.PI * 2); g.stroke();
          g.beginPath();
          g.moveTo(cx - scale, cy); g.lineTo(cx + scale, cy);
          g.moveTo(cx, cy - scale); g.lineTo(cx, cy + scale);
          g.stroke();
          g.strokeStyle = gridSoft;
          g.beginPath();
          g.moveTo(cx - scale * 0.7, cy - scale * 0.7); g.lineTo(cx + scale * 0.7, cy + scale * 0.7);
          g.moveTo(cx - scale * 0.7, cy + scale * 0.7); g.lineTo(cx + scale * 0.7, cy - scale * 0.7);
          g.stroke();
          g.fillStyle = label;
          g.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
          g.fillText('M', cx - 4, cy - scale - 3);
          g.fillText('L', 6, cy + 4);
          g.fillText('R', w - 14, cy + 4);
          if (active && left && right) {
            left.getFloatTimeDomainData(bufA);
            right.getFloatTimeDomainData(bufB);
            g.strokeStyle = stroke;
            g.lineWidth = 1.6;
            g.beginPath();
            const n = Math.min(bufA.length, bufB.length);
            const step = Math.max(1, Math.floor(n / 360));
            const G = 2.2;
            for (let i = 0; i < n; i += step) {
              const L = bufA[i], R = bufB[i];
              const x = cx + Math.tanh(((L - R) / Math.SQRT2) * G) * scale;
              const y = cy - Math.tanh(((L + R) / Math.SQRT2) * G) * scale;
              if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.stroke();
          }
        }
      }

      const specEl = specRef.current;
      const ctxA = mix?.context;
      if (specEl && mix && ctxA) {
        const s = specEl.getContext('2d', { willReadFrequently: true });
        if (s) {
          const w = specEl.width, h = specEl.height;
          s.drawImage(specEl, -1, 0);
          mix.getByteFrequencyData(spec);
          const nyquist = ctxA.sampleRate / 2;
          const minLog = Math.log10(20);
          const maxLog = Math.log10(Math.min(20000, nyquist));
          const col = s.createImageData(1, h);
          const data = col.data;
          const binCount = mix.frequencyBinCount;
          for (let y = 0; y < h; y++) {
            const tt = 1 - y / h;
            const freq = Math.pow(10, minLog + tt * (maxLog - minLog));
            const bin = Math.max(0, Math.min(binCount - 1, Math.round((freq / nyquist) * binCount)));
            const mag = Math.pow((spec[bin] || 0) / 255, 0.85);
            const rgb = lerpRgb(mag, stops);
            const i = y * 4;
            data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
          }
          s.putImageData(col, w - 1, 0);
        }
      }

      if (left && right) {
        const L = rmsOf(left, bufA);
        const R = rmsOf(right, bufB);
        const lDb = dbFromRms(L.rms);
        const rDb = dbFromRms(R.rms);
        const lPct = dbToPct(lDb);
        const rPct = dbToPct(rDb);
        const lPk = dbToPct(dbFromRms(L.peak));
        const rPk = dbToPct(dbFromRms(R.peak));
        if (lPk >= peakHoldL) { peakHoldL = lPk; holdL = 42; }
        else if (holdL > 0) holdL -= 1;
        else peakHoldL = Math.max(lPk, peakHoldL - 1.4);
        if (rPk >= peakHoldR) { peakHoldR = rPk; holdR = 42; }
        else if (holdR > 0) holdR -= 1;
        else peakHoldR = Math.max(rPk, peakHoldR - 1.4);
        if (lRms.current) lRms.current.style.width = `${lPct}%`;
        if (rRms.current) rRms.current.style.width = `${rPct}%`;
        if (lPeak.current) lPeak.current.style.left = `${peakHoldL}%`;
        if (rPeak.current) rPeak.current.style.left = `${peakHoldR}%`;
        const dbMax = Math.max(lDb, rDb);
        if (dbRef.current) dbRef.current.textContent = !Number.isFinite(dbMax) || dbMax <= -90 ? '−∞ dB' : `${dbMax.toFixed(1)} dB`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, dark, mix, left, right]);

  const meter = (lab: string, rms: typeof lRms, peak: typeof lPeak) => (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[9px] font-bold" style={{ color: color.sage }}>{lab}</span>
      <div className="relative flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: dark ? 'rgba(26,41,38,0.65)' : 'rgba(255,255,255,0.7)' }}>
        <div ref={rms} className="absolute inset-y-0 left-0 rounded-full" style={{ width: '0%', background: color.accent }} />
        <div ref={peak} className="absolute top-0 bottom-0 w-0.5" style={{ left: '0%', background: color.dark }} />
      </div>
    </div>
  );

  return (
    <div className="rounded-[22px] overflow-hidden" style={{
      background: dark ? '#152420' : '#EEF3EF',
      border: `1px solid ${th.border}`,
    }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${th.border}` }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: color.sage }}>{t('analyzers')}</span>
        <span ref={dbRef} className="text-[11px] font-mono font-bold tabular-nums" style={{ color: color.accent }}>−∞ dB</span>
      </div>
      <div className="grid grid-cols-[108px_minmax(0,1fr)] gap-2 p-2.5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: color.sage }}>{t('goniometer')}</p>
          <canvas ref={gonioRef} width={200} height={200} className="w-full aspect-square rounded-2xl block" style={{ background: dark ? '#1A2926' : '#F8FAF6' }} />
        </div>
        <div className="min-w-0 flex flex-col gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: color.sage }}>{t('spectrogram')}</p>
            <canvas ref={specRef} width={720} height={160} className="w-full h-[108px] rounded-2xl block" style={{ background: dark ? '#1A2926' : '#F8FAF6' }} />
          </div>
          <div className="flex flex-col gap-1.5">
            {meter('L', lRms, lPeak)}
            {meter('R', rRms, rPeak)}
          </div>
        </div>
      </div>
    </div>
  );
}
