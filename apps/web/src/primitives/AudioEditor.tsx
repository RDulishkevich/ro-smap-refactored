import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Pause, Play, Volume2 } from 'lucide-react';
import { color } from '@polevka/design';
import { useTh } from '../state/ThemeContext';
import { formatClock, peaksFromBlob } from '../lib/waveform';
import { WaveformSVG } from './ui';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

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
  durationSec,
  trimStart,
  trimEnd,
  gain,
  onChange,
}: {
  blob: Blob;
  durationSec: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
  onChange: (next: { trimStart: number; trimEnd: number; gain: number }) => void;
}) {
  const th = useTh();
  const [peaks, setPeaks] = useState<number[]>(() => Array.from({ length: 72 }, () => 0.2));
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef('');
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const trimRef = useRef({ trimStart, trimEnd });
  trimRef.current = { trimStart, trimEnd };

  useEffect(() => {
    let dead = false;
    void peaksFromBlob(blob, 72).then((p) => { if (!dead) setPeaks(p); }).catch(() => {});
    return () => { dead = true; };
  }, [blob]);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const el = new Audio();
    el.preload = 'metadata';
    el.src = url;
    audioRef.current = el;
    const onTime = () => {
      const { trimStart: a, trimEnd: b } = trimRef.current;
      const dur = el.duration || durationSec;
      const t0 = a * dur;
      const t1 = b * dur;
      if (el.currentTime >= t1 - 0.02) {
        el.pause();
        el.currentTime = t0;
        setPlaying(false);
        setProgress(a);
        return;
      }
      setProgress(dur ? el.currentTime / dur : 0);
    };
    const onEnd = () => { setPlaying(false); setProgress(trimRef.current.trimStart); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      URL.revokeObjectURL(url);
      audioRef.current = null;
      gainRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [blob, durationSec]);

  useEffect(() => {
    const g = gainRef.current;
    if (g) g.gain.value = gain;
    if (audioRef.current && !gainRef.current) audioRef.current.volume = Math.min(1, gain);
  }, [gain]);

  const ensureGain = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (gainRef.current) {
      gainRef.current.gain.value = gain;
      return;
    }
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
    } catch {
      el.volume = Math.min(1, gain);
    }
  };

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    await ensureGain();
    const dur = el.duration || durationSec;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    const t0 = trimStart * dur;
    if (el.currentTime < t0 || el.currentTime >= trimEnd * dur) el.currentTime = t0;
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const cut = Math.max(0.05, (trimEnd - trimStart) * durationSec);

  return (
    <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
      <p className="text-[11px] font-semibold mb-2" style={{ color: SAGE }}>Превью · {formatClock(cut)}</p>
      <div className="relative rounded-2xl px-3 py-3 mb-3 overflow-hidden" style={{ background: th.phoneBg }}>
        <div className="absolute inset-y-0 left-0 pointer-events-none z-[1]"
          style={{ width: `${trimStart * 100}%`, background: 'rgba(45,60,57,0.28)' }} />
        <div className="absolute inset-y-0 right-0 pointer-events-none z-[1]"
          style={{ width: `${(1 - trimEnd) * 100}%`, background: 'rgba(45,60,57,0.28)' }} />
        <WaveformSVG data={peaks} color={ACCENT} progress={progress} h={56} onSeek={(r) => {
          const el = audioRef.current;
          const dur = el?.duration || durationSec;
          const t = Math.max(trimStart, Math.min(trimEnd, r)) * dur;
          if (el) el.currentTime = t;
          setProgress(r);
        }} />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => void toggle()}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: ACCENT }}>
          {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" className="ml-0.5" />}
        </motion.button>
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-semibold block mb-1" style={{ color: SAGE }}>Начало {formatClock(trimStart * durationSec)}</label>
          <input type="range" min={0} max={Math.max(0, trimEnd - 0.02)} step={0.005} value={trimStart}
            className="w-full accent-[#B5613F] h-1"
            onChange={(e) => onChange({ trimStart: Number(e.target.value), trimEnd, gain })} />
          <label className="text-[10px] font-semibold block mt-2 mb-1" style={{ color: SAGE }}>Конец {formatClock(trimEnd * durationSec)}</label>
          <input type="range" min={Math.min(1, trimStart + 0.02)} max={1} step={0.005} value={trimEnd}
            className="w-full accent-[#B5613F] h-1"
            onChange={(e) => onChange({ trimStart, trimEnd: Number(e.target.value), gain })} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Volume2 size={14} color={OLIVE} />
        <input type="range" min={0.2} max={2} step={0.05} value={gain}
          className="flex-1 accent-[#B5613F] h-1"
          onChange={(e) => onChange({ trimStart, trimEnd, gain: Number(e.target.value) })} />
        <span className="text-[10px] w-10 text-right tabular-nums" style={{ color: SAGE }}>{Math.round(gain * 100)}%</span>
      </div>
    </div>
  );
}
