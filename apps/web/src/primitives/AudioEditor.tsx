import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Pause, Play, Volume2, X } from 'lucide-react';
import { color } from '@polevka/design';
import { normalizeTimeMarkers, spamGuardCheck, spamGuardMessage, type TimeMarker } from '@polevka/core';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { durationFromBlob, formatClock, peaksFromBlob, peaksFromUrl, playLength } from '../lib/waveform';
import { applyCtxSink, applySinkId } from '../lib/record-devices';
import { WaveformSVG } from './ui';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;
const MIN = 0.02;

export function LiveTape({ analyser, color: c = ACCENT, h = 96 }: { analyser: AnalyserNode | null; color?: string; h?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const hist = new Float32Array(280);
    let hi = 0;
    let raf = 0;
    const drawIdle = () => {
      const w = canvas.width, hh = canvas.height;
      ctx.clearRect(0, 0, w, hh);
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(0, hh / 2);
      ctx.lineTo(w, hh / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (!analyser) {
      drawIdle();
      return;
    }
    const td = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(td);
      let peak = 0;
      for (let i = 0; i < td.length; i++) peak = Math.max(peak, Math.abs(td[i]));
      hist[hi % hist.length] = peak;
      hi += 1;
      const w = canvas.width, hh = canvas.height;
      ctx.clearRect(0, 0, w, hh);
      const mid = hh / 2;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const n = td.length;
      for (let i = 0; i < n; i += 2) {
        const x = (i / n) * w;
        const y = mid - td[i] * mid * 0.92;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const v = hist[(hi + i) % hist.length];
        const x = (i / hist.length) * w;
        const y = hh - 6 - v * 18;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser, c]);
  return (
    <canvas ref={canvasRef} width={720} height={h * 2} className="w-full rounded-2xl block"
      style={{ height: h, background: 'rgba(45,60,57,0.06)' }} />
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
  const [peaks, setPeaks] = useState<number[]>(() => Array.from({ length: 96 }, () => 0.2));
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
      void peaksFromBlob(blob, 96).then((p) => { if (!dead && p.length) setPeaks(p); }).catch(() => {});
      void durationFromBlob(blob).then((d) => { if (!dead && Number.isFinite(d) && d > 0.05) setDecodedDur(d); }).catch(() => {});
    } else if (url) {
      void peaksFromUrl(url, 96).then((p) => { if (!dead && p.length) setPeaks(p); }).catch(() => {});
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
        <p className="text-[11px] font-semibold" style={{ color: SAGE }}>
          {allowTrim ? `Обрезка · ${formatClock(cut)}` : 'Превью'}
        </p>
        <p className="text-[10px] tabular-nums" style={{ color: OLIVE }}>{formatClock(progress * dur)} / {formatClock(dur)}</p>
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
        <WaveformSVG data={peaks} color={ACCENT} progress={progress} h={64} onSeek={seekTo} />
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
              <span className="mt-0.5 max-w-[72px] truncate text-[8px] font-semibold px-1 rounded" style={{ background: th.cardBg, color: OLIVE }}>{m.label}</span>
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
            <p className="text-[10px] font-semibold mb-1" style={{ color: SAGE }}>
              {formatClock(a * dur)} — {formatClock(b * dur)} · тяните ручки на волне
            </p>
          )}
          <div className="flex items-center gap-2">
            <Volume2 size={14} color={OLIVE} />
            <input type="range" min={0.2} max={2} step={0.05} value={gain}
              className="flex-1 accent-[#B5613F] h-1" aria-label="Громкость фрагмента"
              onChange={(e) => onChange({ trimStart: a, trimEnd: b, gain: Number(e.target.value) })} />
            <span className="text-[10px] w-10 text-right tabular-nums" style={{ color: SAGE }}>{Math.round(gain * 100)}%</span>
          </div>
        </div>
      </div>
      {onMarkers && (
        <div>
          <div className="flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160}
              placeholder="Метка: крик чайки, гудок…"
              className="flex-1 min-w-0 rounded-2xl px-3 py-2.5 text-[12px] outline-none"
              style={{ background: th.phoneBg, color: th.inkText }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMarker(); } }} />
            <button type="button" onClick={addMarker}
              className="h-11 px-3 rounded-2xl text-[11px] font-semibold flex items-center gap-1 flex-shrink-0"
              style={{ background: th.phoneBg, color: ACCENT }}>
              <Flag size={13} /> Здесь
            </button>
          </div>
          {!!markers.length && (
            <ul className="mt-2 flex flex-col gap-1">
              {markers.map((m, i) => (
                <li key={`${m.t}-${m.label}-${i}`} className="flex items-center gap-2">
                  <button type="button" className="text-[11px] font-semibold tabular-nums" style={{ color: ACCENT }}
                    onClick={() => seekTo(m.t / dur)}>{formatClock(m.t)}</button>
                  <span className="flex-1 min-w-0 truncate text-[11px]" style={{ color: th.inkText }}>{m.label}</span>
                  <button type="button" aria-label="Удалить метку" className="w-8 h-8 rounded-full flex items-center justify-center"
                    onClick={() => onMarkers(markers.filter((_, n) => n !== i))}>
                    <X size={12} color={OLIVE} />
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
