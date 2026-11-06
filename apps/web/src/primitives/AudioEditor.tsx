import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Pause, Play, Volume2, X } from 'lucide-react';
import { color } from '@polevka/design';
import { normalizeTimeMarkers, spamGuardCheck, spamGuardMessage, type TimeMarker } from '@polevka/core';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { durationFromBlob, formatClock, peakLanesFromBlob, peaksFromUrl, playLength } from '../lib/waveform';
import { applyCtxSink, applySinkId, channelLaneLabel } from '../lib/record-devices';
import { WaveformSVG } from './ui';

const ACCENT = color.accent;
const MIN = 0.02;

function drawLane(ctx: CanvasRenderingContext2D, peaks: number[], x: number, y: number, w: number, h: number, fill: string) {
  const mid = y + h / 2;
  ctx.fillStyle = fill;
  if (!peaks.length) {
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, mid - 1, w, 2);
    ctx.globalAlpha = 1;
    return;
  }
  const bar = 2;
  const used = peaks.length * bar;
  if (used <= w) {
    for (let i = 0; i < peaks.length; i++) {
      const bh = Math.max(1.5, peaks[i] * (h * 0.46));
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x + i * bar, mid - bh, 1.35, bh * 2);
    }
  } else {
    for (let px = 0; px < w; px++) {
      const i0 = Math.floor((px / w) * peaks.length);
      const i1 = Math.max(i0 + 1, Math.floor(((px + 1) / w) * peaks.length));
      let peak = 0;
      for (let i = i0; i < i1; i++) peak = Math.max(peak, peaks[i] || 0);
      const bh = Math.max(1.5, peak * (h * 0.46));
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x + px, mid - bh, 1, bh * 2);
    }
  }
  ctx.globalAlpha = 1;
}

export function LiveTape({
  analysers,
  color: c = ACCENT,
  laneH = 44,
}: {
  analysers: AnalyserNode[];
  color?: string;
  laneH?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lanes = Math.max(1, analysers.length);
  const cssH = analysers.length > 1 ? lanes * laneH : Math.max(96, laneH);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gutter = analysers.length > 1 ? 36 : 8;
    const drawIdle = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawLane(ctx, [], gutter, 8, canvas.width - gutter - 8, canvas.height - 16, c);
    };
    if (!analysers.length) {
      drawIdle();
      return;
    }
    const hist = analysers.map(() => [] as number[]);
    const td = new Float32Array(Math.max(...analysers.map((a) => a.fftSize), 2048));
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - last < 32) return;
      last = ts;
      for (let i = 0; i < analysers.length; i++) {
        analysers[i].getFloatTimeDomainData(td);
        let peak = 0;
        for (let k = 0; k < td.length; k++) peak = Math.max(peak, Math.abs(td[k]));
        hist[i].push(peak);
      }
      const w = canvas.width;
      const hh = canvas.height;
      ctx.clearRect(0, 0, w, hh);
      const lanePx = hh / analysers.length;
      for (let i = 0; i < analysers.length; i++) {
        const y = i * lanePx;
        if (i > 0) {
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = c;
          ctx.fillRect(gutter, y, w - gutter - 8, 1);
          ctx.globalAlpha = 1;
        }
        drawLane(ctx, hist[i], gutter, y + 6, w - gutter - 10, lanePx - 12, c);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analysers, c]);
  return (
    <div className="relative">
      <canvas ref={canvasRef} width={720} height={cssH * 2} className="w-full rounded-2xl block"
        style={{ height: cssH, background: 'rgba(45,60,57,0.06)' }} />
      {analysers.length > 1 && analysers.map((_, i) => (
        <span key={i} className="absolute pv-micro pointer-events-none"
          style={{ left: 8, top: i * laneH + 6, color: c, opacity: 0.7 }}>
          {channelLaneLabel(i, analysers.length)}
        </span>
      ))}
    </div>
  );
}

export function LiveWaveform({ analyser, color: c = ACCENT, h = 56 }: { analyser: AnalyserNode | null; color?: string; h?: number }) {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 48 }, () => 0.12));
  useEffect(() => {
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      const n = 48;
      const step = Math.max(1, Math.floor(data.length / n));
      const next: number[] = [];
      for (let i = 0; i < n; i++) {
        let peak = 0;
        for (let k = 0; k < step; k++) peak = Math.max(peak, Math.abs(data[i * step + k] - 128) / 128);
        next.push(Math.max(0.08, Math.min(1, peak * 1.8)));
      }
      setBars(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);
  return <WaveformSVG data={bars} color={c} h={h} />;
}

export function AudioEditor({
  blob,
  url,
  durationSec,
  trimStart,
  trimEnd,
  gain,
  onChange,
  markers = [],
  onMarkers,
  allowTrim = true,
  sinkId = '',
}: {
  blob?: Blob | null;
  url?: string;
  durationSec: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
  onChange: (next: { trimStart: number; trimEnd: number; gain: number }) => void;
  markers?: TimeMarker[];
  onMarkers?: (next: TimeMarker[]) => void;
  allowTrim?: boolean;
  sinkId?: string;
}) {
  const th = useTh();
  const { toast } = useUi();
  const [lanes, setLanes] = useState<number[][]>(() => [Array.from({ length: 96 }, () => 0.2)]);
  const [decodedDur, setDecodedDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(trimStart);
  const [label, setLabel] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<'start' | 'end' | null>(null);
  const endsRef = useRef({ a: 0, b: 1 });
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const trimRef = useRef({ trimStart, trimEnd });
  const onChangeRef = useRef(onChange);
  const gainValueRef = useRef(gain);
  trimRef.current = { trimStart, trimEnd };
  onChangeRef.current = onChange;
  gainValueRef.current = gain;

  const dur = Math.max(0.2, decodedDur || durationSec);
  const a = Math.max(0, Math.min(trimEnd - MIN, trimStart));
  const b = Math.max(a + MIN, Math.min(1, trimEnd));
  endsRef.current = { a, b };

  useEffect(() => {
    let dead = false;
    setDecodedDur(0);
    if (blob) {
      void peakLanesFromBlob(blob, 96).then((p) => { if (!dead && p.length) setLanes(p); }).catch(() => {});
      void durationFromBlob(blob).then((d) => { if (!dead && Number.isFinite(d) && d > 0.05) setDecodedDur(d); }).catch(() => {});
    } else if (url) {
      void peaksFromUrl(url, 96).then((p) => { if (!dead && p.length) setLanes([p]); }).catch(() => {});
    }
    return () => { dead = true; };
  }, [blob, url]);

  useEffect(() => {
    const el = new Audio();
    el.preload = 'metadata';
    el.crossOrigin = 'anonymous';
    let objectUrl = '';
    if (blob) {
      objectUrl = URL.createObjectURL(blob);
      el.src = objectUrl;
    } else if (url) {
      el.src = url;
    }
    audioRef.current = el;
    void applySinkId(el, sinkId);
    const onTime = () => {
      const { trimStart: s, trimEnd: e } = trimRef.current;
      const length = playLength(el, dur);
      const t0 = s * length;
      const t1 = e * length;
      if (el.currentTime >= t1 - 0.03) {
        el.pause();
        el.currentTime = t0;
        setPlaying(false);
        setProgress(s);
        return;
      }
      setProgress(el.currentTime / length);
    };
    const onEnd = () => { setPlaying(false); setProgress(trimRef.current.trimStart); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      audioRef.current = null;
      gainRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [blob, url, dur]);

  useEffect(() => {
    const g = gainRef.current;
    if (g) g.gain.value = gain;
    if (audioRef.current && !gainRef.current) audioRef.current.volume = Math.min(1, gain);
  }, [gain]);

  useEffect(() => {
    void applySinkId(audioRef.current, sinkId);
    void applyCtxSink(ctxRef.current, sinkId);
  }, [sinkId]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el && !el.paused) {
        const length = playLength(el, dur);
        const { trimStart: s, trimEnd: e } = trimRef.current;
        if (el.currentTime >= e * length - 0.03) {
          el.pause();
          el.currentTime = s * length;
          setPlaying(false);
          setProgress(s);
          return;
        }
        setProgress(el.currentTime / length);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, dur]);

  const ensureGain = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (gainRef.current) { gainRef.current.gain.value = gain; return; }
    try {
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaElementSource(el);
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(ctx.destination);
      gainRef.current = g;
      ctxRef.current = ctx;
      void applyCtxSink(ctx, sinkId);
    } catch {
      el.volume = Math.min(1, gain);
    }
  };

  const applyTrim = (nextA: number, nextB: number) => {
    const start = Math.max(0, Math.min(nextB - MIN, nextA));
    const end = Math.max(start + MIN, Math.min(1, nextB));
    onChangeRef.current({ trimStart: start, trimEnd: end, gain: gainValueRef.current });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const box = waveRef.current?.getBoundingClientRect();
      if (!box || box.width <= 0) return;
      const r = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
      const { a: start, b: end } = endsRef.current;
      if (drag.current === 'start') applyTrim(r, end);
      else applyTrim(start, r);
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const seekTo = (r: number) => {
    const el = audioRef.current;
    const length = playLength(el, dur);
    const clamped = Math.max(a, Math.min(b, r));
    if (el) el.currentTime = clamped * length;
    setProgress(clamped);
  };

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    await ensureGain();
    const length = playLength(el, dur);
    if (playing) { el.pause(); setPlaying(false); return; }
    if (el.currentTime < a * length || el.currentTime >= b * length) el.currentTime = a * length;
    try { await el.play(); setPlaying(true); } catch { setPlaying(false); }
  };

  const addMarker = () => {
    if (!onMarkers) return;
    const guard = spamGuardCheck('marker');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const text = label.trim();
    if (!text) { toast('Подпишите метку — что слышно в этой точке'); return; }
    const length = playLength(audioRef.current, dur);
    const t = Math.round((progress * length) * 100) / 100;
    const next = normalizeTimeMarkers([...markers, { t, label: text }]);
    if (next.length > 40) { toast('Слишком много меток (макс. 40)'); return; }
    onMarkers(next);
    setLabel('');
    toast(`Метка ${formatClock(t)}`);
  };

  const cut = Math.max(0.05, (b - a) * dur);

  return (
    <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
      <div className="flex items-center justify-between mb-2">
        <p className="pv-label" style={{ color: th.soft }}>
          {allowTrim ? `Обрезка · ${formatClock(cut)}` : 'Превью'}
        </p>
        <p className="pv-micro tabular-nums" style={{ color: th.muted }}>{formatClock(progress * dur)} / {formatClock(dur)}</p>
      </div>
      <div
        ref={waveRef}
        className="relative rounded-2xl px-2 py-3 mb-3 select-none touch-none"
        style={{ background: th.phoneBg }}
      >
        {allowTrim && (
          <>
            <div className="absolute inset-y-0 left-0 z-[1] pointer-events-none rounded-l-2xl" style={{ width: `${a * 100}%`, background: 'rgba(45,60,57,0.38)' }} />
            <div className="absolute inset-y-0 right-0 z-[1] pointer-events-none rounded-r-2xl" style={{ width: `${(1 - b) * 100}%`, background: 'rgba(45,60,57,0.38)' }} />
            <div className="absolute inset-y-0 z-[1] pointer-events-none" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%`, boxShadow: `inset 0 0 0 1.5px ${ACCENT}` }} />
          </>
        )}
        <div className="flex flex-col gap-1">
          {lanes.map((lane, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {lanes.length > 1 && (
                <span className="pv-micro w-4 flex-shrink-0 text-center" style={{ color: th.soft }}>{channelLaneLabel(i, lanes.length)}</span>
              )}
              <div className="flex-1 min-w-0">
                <WaveformSVG data={lane} color={ACCENT} progress={progress} h={lanes.length > 1 ? 36 : 64} onSeek={seekTo} />
              </div>
            </div>
          ))}
        </div>
        <div className="absolute top-1 bottom-1 z-[3] pointer-events-none" style={{ left: `${Math.max(0, Math.min(100, progress * 100))}%`, transform: 'translateX(-50%)' }}>
          <span className="block w-2.5 h-2.5 rounded-full mx-auto" style={{ background: ACCENT, boxShadow: '0 0 0 2px rgba(255,255,255,0.85)' }} />
          <span className="block w-0.5 h-[calc(100%-10px)] mx-auto" style={{ background: ACCENT }} />
        </div>
        {allowTrim && (
          <>
            <button type="button" aria-label="Начало фрагмента"
              className="absolute top-0 bottom-0 z-[3] w-4 -ml-2 flex items-center justify-center cursor-ew-resize"
              style={{ left: `${a * 100}%` }}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); drag.current = 'start'; e.currentTarget.setPointerCapture(e.pointerId); }}>
              <span className="w-1.5 h-10 rounded-full" style={{ background: ACCENT }} />
            </button>
            <button type="button" aria-label="Конец фрагмента"
              className="absolute top-0 bottom-0 z-[3] w-4 -ml-2 flex items-center justify-center cursor-ew-resize"
              style={{ left: `${b * 100}%` }}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); drag.current = 'end'; e.currentTarget.setPointerCapture(e.pointerId); }}>
              <span className="w-1.5 h-10 rounded-full" style={{ background: ACCENT }} />
            </button>
          </>
        )}
        {markers.map((m) => {
          const pct = dur ? Math.max(0, Math.min(100, (m.t / dur) * 100)) : 0;
          return (
            <button key={`${m.t}-${m.label}`} type="button" title={m.label}
              className="absolute top-0 z-[4] -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pct}%` }}
              onClick={(e) => { e.stopPropagation(); seekTo(m.t / dur); }}>
              <span className="w-2 h-2 rounded-full" style={{ background: color.dark }} />
              <span className="mt-0.5 max-w-[72px] truncate pv-micro px-1 rounded" style={{ background: th.cardBg, color: th.muted }}>{m.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => void toggle()}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: ACCENT }}
          aria-label={playing ? 'Пауза' : 'Слушать фрагмент'}>
          {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" className="ml-0.5" />}
        </motion.button>
        <div className="flex-1 min-w-0">
          {allowTrim && (
            <p className="pv-micro mb-1" style={{ color: th.soft }}>
              {formatClock(a * dur)} — {formatClock(b * dur)} · тяните ручки на волне
            </p>
          )}
          <div className="flex items-center gap-2">
            <Volume2 size={14} color={th.muted} />
            <input type="range" min={0.2} max={2} step={0.05} value={gain}
              className="flex-1 accent-[#B5613F] h-1" aria-label="Громкость фрагмента"
              onChange={(e) => onChange({ trimStart: a, trimEnd: b, gain: Number(e.target.value) })} />
            <span className="pv-micro w-10 text-right tabular-nums" style={{ color: th.soft }}>{Math.round(gain * 100)}%</span>
          </div>
        </div>
      </div>
      {onMarkers && (
        <div>
          <div className="flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160}
              placeholder="Метка: крик чайки, гудок…"
              className="flex-1 min-w-0 rounded-2xl px-3 py-2.5 pv-caption pv-inset-focus outline-none"
              style={{ background: th.phoneBg, color: th.inkText }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMarker(); } }} />
            <button type="button" onClick={addMarker}
              className="h-11 px-3 rounded-2xl pv-button flex items-center gap-1 flex-shrink-0"
              style={{ background: th.phoneBg, color: ACCENT }}>
              <Flag size={13} /> Здесь
            </button>
          </div>
          {!!markers.length && (
            <ul className="mt-2 flex flex-col gap-1">
              {markers.map((m, i) => (
                <li key={`${m.t}-${m.label}-${i}`} className="flex items-center gap-2">
                  <button type="button" className="pv-label tabular-nums" style={{ color: ACCENT }}
                    onClick={() => seekTo(m.t / dur)}>{formatClock(m.t)}</button>
                  <span className="flex-1 min-w-0 truncate pv-caption" style={{ color: th.inkText }}>{m.label}</span>
                  <button type="button" aria-label="Удалить метку" className="w-8 h-8 rounded-full flex items-center justify-center"
                    onClick={() => onMarkers(markers.filter((_, n) => n !== i))}>
                    <X size={12} color={th.muted} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
