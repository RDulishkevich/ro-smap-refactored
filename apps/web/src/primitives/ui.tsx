import { AnimatePresence, motion } from 'motion/react';
import { AudioLines, ChevronLeft, Download, Globe2, Map as MapIcon, Play, Radio, User, LogIn, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { color, pinColor, spring, tap, typeMeta } from '@polevka/design';
import { WF } from '@polevka/core';
import type { Sound } from '@polevka/core';
import { useNav, type TabId } from '../state/NavContext';
import { useAuth } from '../state/AuthContext';
import { useTh } from '../state/ThemeContext';
import { formatClock, parseDurationLabel, peaksFromUrl } from '../lib/waveform';
import { isAmbisonicSound } from '../lib/sound-media';
import { audioService } from '../lib/audio-player';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';
import { AnalyzersPanel } from './AnalyzersPanel';
import { AmbiSphere } from './AmbiSphere';
import Image11 from '@/brand/Image11';

export function WaveformSVG({
  data, color: c = color.accent, progress = 0, h = 28, onSeek,
}: {
  data: number[]; color?: string; progress?: number; h?: number; onSeek?: (r: number) => void;
}) {
  const n = Math.max(1, data.length);
  const idx = Math.floor(progress * n);
  return (
    <svg viewBox={`0 0 ${n * 2} ${h}`} preserveAspectRatio="none" height={h}
      className="w-full block"
      style={{ cursor: onSeek ? 'pointer' : undefined }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      }}>
      {data.map((v, i) => (
        <rect key={i} x={i * 2} y={(1 - v) * h} width={1.35} height={Math.max(1.2, v * h)} rx="0.65"
          fill={c} opacity={i <= idx ? 0.95 : 0.22} />
      ))}
    </svg>
  );
}

export function PlayPauseIcon({ playing, size = 14 }: { playing: boolean; size?: number }) {
  return playing
    ? (
      <span className="flex gap-0.5 items-center">
        <span className="w-1 bg-white rounded-full" style={{ height: size * 0.9 }} />
        <span className="w-1 bg-white rounded-full" style={{ height: size * 0.9 }} />
      </span>
    )
    : <Play size={size} fill="white" color="white" className="ml-0.5" />;
}

export function SoundTypeTag({ type }: { type: string }) {
  const s = typeMeta[type] ?? { label: type, bg: color.cream, color: color.olive };
  return (
    <span className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
      <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
    </span>
  );
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const th = useTh();
  return (
    <div className="flex items-center gap-3 px-4 pv-safe-top pb-3 flex-shrink-0" style={{ background: th.headerBg, borderBottom: `1px solid ${th.border}` }}>
      <motion.button whileTap={tap.nav} onClick={onBack} className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: th.lightBg }} aria-label="Назад">
        <ChevronLeft size={18} style={{ color: color.dark }} />
      </motion.button>
      <p className="flex-1 text-sm font-bold truncate" style={{ color: th.inkText }}>{title}</p>
      {right}
    </div>
  );
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  error = false,
  autoFocus = false,
  disabled = false,
  label = 'Код 2FA',
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const th = useTh();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef('');
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, length);
  const caret = digits.length < length ? digits.length : length - 1;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (digits.length === length) {
      if (done.current !== digits) {
        done.current = digits;
        onComplete?.(digits);
      }
    } else {
      done.current = '';
    }
  }, [digits, length, onComplete]);

  return (
    <div>
      {label && (
        <label htmlFor={id} className="text-[10px] font-semibold block mb-2" style={{ color: color.sage }}>{label}</label>
      )}
      <motion.div
        animate={error ? { x: [0, -8, 8, -6, 6, -3, 0] } : { x: 0 }}
        transition={{ duration: 0.42 }}
        className="relative"
        onClick={() => inputRef.current?.focus()}>
        <input
          id={id}
          ref={inputRef}
          value={digits}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          name="otp"
          maxLength={length}
          aria-label={label}
          aria-invalid={error}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
          className="absolute inset-0 w-full h-full opacity-0 caret-transparent text-base"
        />
        <div className="flex gap-1.5 sm:gap-2">
          {Array.from({ length }, (_, i) => {
            const on = focused && i === caret;
            const filled = !!digits[i];
            return (
              <div
                key={i}
                className="flex-1 min-w-0 h-12 rounded-2xl flex items-center justify-center text-lg font-bold tabular-nums select-none"
                style={{
                  background: th.lightBg,
                  color: th.inkText,
                  boxShadow: `inset 0 0 0 ${on || error ? 1.5 : 1}px ${error || on ? color.accent : th.border}`,
                  fontFamily: '"Geist Variable", system-ui, sans-serif',
                }}>
                {filled ? digits[i] : on ? (
                  <motion.span className="w-px h-5 rounded-full" style={{ background: color.accent }}
                    animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 1.05, repeat: Infinity }} />
                ) : null}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

export function DecorBand({ opacity = 0.18, flip = false }: { opacity?: number; flip?: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 overflow-hidden pointer-events-none" style={{ height: 140, opacity, transform: flip ? 'scaleX(-1)' : 'none' }}>
      <div className="absolute inset-0"><Image11 /></div>
    </div>
  );
}

export function NavBar({ hollowCenter }: { hollowCenter?: boolean }) {
  const { activeTab, setActiveTab } = useNav();
  const { isLoggedIn } = useAuth();
  const th = useTh();
  const tabs: Array<{ id: TabId; Icon: typeof Radio; label: string }> = [
    { id: 'feed', Icon: Radio, label: 'Лента' },
    { id: 'map', Icon: MapIcon, label: 'Карта' },
    { id: 'profile', Icon: isLoggedIn ? User : LogIn, label: isLoggedIn ? 'Профиль' : 'Вход' },
  ];
  return (
    <div className="flex justify-around items-center py-2 px-4 min-h-[3.75rem] flex-shrink-0" style={{ background: th.navBg }}>
      {tabs.map(({ id, Icon, label }) => {
        const on = activeTab === id;
        if (id === 'map' && hollowCenter) return <div key={id} className="w-10 h-14" />;
        return (
          <motion.button key={id} onClick={() => setActiveTab(id)} className="flex flex-col items-center gap-1" whileTap={tap.nav}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: on ? color.accent : 'transparent' }}>
              <Icon size={18} color={on ? 'white' : th.isDark ? '#7A9A88' : '#B0B8A8'} />
            </div>
            <span className="text-[9px] font-semibold" style={{ color: on ? color.accent : th.isDark ? '#7A9A88' : '#B0B8A8' }}>{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function SeekBar({ progress, onSeek, color: c = color.accent }: { progress: number; onSeek?: (r: number) => void; color?: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden cursor-pointer" style={{ background: 'rgba(45,60,57,0.12)' }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      }}>
      <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: c }} />
    </div>
  );
}

function VolumeKnob({ volume, muted, onVolume, onMute, compact = false }: {
  volume: number; muted: boolean; onVolume: (v: number) => void; onMute: () => void; compact?: boolean;
}) {
  const shown = muted ? 0 : volume;
  const pct = Math.round(shown * 100);
  const Icon = muted || shown === 0 ? VolumeX : shown < 0.45 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1 flex-shrink-0" title={`Громкость ${pct}%`}>
      <button type="button" onClick={onMute} className="w-9 h-9 rounded-full flex items-center justify-center" aria-label={muted ? 'Включить звук' : 'Выключить звук'}>
        <Icon size={14} color={color.olive} />
      </button>
      {!compact && (
        <div className="relative w-14 h-1 rounded-full" style={{ background: 'rgba(45,60,57,0.16)' }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color.accent }} />
          <input type="range" min={0} max={1} step={0.01} value={shown} aria-label="Громкость" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => onVolume(Number(e.target.value))} />
        </div>
      )}
    </div>
  );
}

export function VolumeRow({ volume, muted, onVolume, onMute }: { volume: number; muted: boolean; onVolume: (v: number) => void; onMute: () => void }) {
  return <VolumeKnob volume={volume} muted={muted} onVolume={onVolume} onMute={onMute} />;
}

export function PinPlayer({ sound, onClose, simple = false, playing, onToggle, progress = 0, onOpen, onSeek, volume = 1, muted = false, onVolume, onMute, onDownload }: {
  sound: Sound; onClose: () => void; simple?: boolean; playing?: boolean; onToggle?: () => void; progress?: number; onOpen?: () => void;
  onSeek?: (r: number) => void; volume?: number; muted?: boolean; onVolume?: (v: number) => void; onMute?: () => void; onDownload?: () => void;
}) {
  const th = useTh();
  const compact = !useIsDesktop();
  const { toast } = useUi();
  const c = pinColor[String(sound.type)] ?? color.accent;
  const [peaks, setPeaks] = useState<number[]>(() => WF[Number(sound.wf || 0) % 4]);
  const [analyzers, setAnalyzers] = useState(false);
  const [ambiUi, setAmbiUi] = useState(false);
  const ambiGen = useRef(0);
  const ambiCapable = isAmbisonicSound(sound);
  const totalSec = parseDurationLabel(sound.duration);
  const nowSec = totalSec ? progress * totalSec : 0;
  const totalLabel = totalSec ? formatClock(totalSec) : String(sound.duration || '0:00');
  useEffect(() => {
    const url = String(sound.url || '');
    if (!url) return;
    let dead = false;
    void peaksFromUrl(url, 80).then((p) => { if (!dead && p.length) setPeaks(p); }).catch(() => {});
    return () => { dead = true; };
  }, [sound.url, sound.id]);
  useEffect(() => {
    setAnalyzers(false);
    setAmbiUi(false);
    ambiGen.current += 1;
    if (audioService.ambisonic) void audioService.setAmbisonic(false);
  }, [sound.id]);
  const toggleAnalyzers = async () => {
    if (analyzers) { setAnalyzers(false); return; }
    const ok = await audioService.ensureGraph();
    if (!ok) { toast('Анализаторы недоступны в этом браузере'); return; }
    setAnalyzers(true);
  };
  const toggleAmbi = async () => {
    const gen = ++ambiGen.current;
    if (audioService.ambisonic) {
      await audioService.setAmbisonic(false);
      if (gen !== ambiGen.current) return;
      setAmbiUi(false);
      toast('Ambisonic выкл.');
      return;
    }
    const ok = await audioService.setAmbisonic(true, sound.url ? String(sound.url) : undefined);
    if (gen !== ambiGen.current) return;
    if (!ok) { toast('Не удалось включить ambisonic — нужен 4-канальный WAV'); return; }
    setAmbiUi(true);
    setAnalyzers(false);
    toast('Ambisonic вкл.');
  };
  return (
    <div className={`px-3.5 ${simple ? 'py-2.5' : 'pt-3 pb-9'}`}
      style={simple ? undefined : {
        background: th.cardBg,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -6px 32px rgba(45,60,57,0.18)',
        maskImage: analyzers || ambiUi ? undefined : 'radial-gradient(circle 36px at 50% 100%, transparent 34px, black 36px)',
        WebkitMaskImage: analyzers || ambiUi ? undefined : 'radial-gradient(circle 36px at 50% 100%, transparent 34px, black 36px)',
      }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button type="button" onClick={onToggle} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c }} aria-label={playing ? 'Пауза' : 'Слушать'}>
          <PlayPauseIcon playing={!!playing} size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <button type="button" className="block w-full text-left text-[13px] font-semibold truncate leading-tight" style={{ color: th.inkText }} onClick={onOpen}>{sound.title}</button>
          <p className="text-[11px] tabular-nums mt-0.5 truncate" style={{ color: color.olive }}>
            <span className="font-medium" style={{ color: color.dark }}>{formatClock(nowSec)}</span>
            <span> / {totalLabel}</span>
            {sound.location ? <span> · {sound.location}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
        {onVolume && onMute && <VolumeKnob volume={volume} muted={muted} onVolume={onVolume} onMute={onMute} compact={compact} />}
        <motion.button type="button" whileTap={tap.btn} onClick={() => void toggleAnalyzers()} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" title="Анализаторы" aria-label="Анализаторы" aria-pressed={analyzers}>
          <AudioLines size={13} color={analyzers ? color.accent : color.olive} />
        </motion.button>
        {ambiCapable && (
          <motion.button type="button" whileTap={tap.btn} onClick={() => void toggleAmbi()} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" title="Звуковая сфера" aria-label="Звуковая сфера" aria-pressed={ambiUi}>
            <Globe2 size={13} color={ambiUi ? color.accent : color.olive} />
          </motion.button>
        )}
        {!compact && onDownload && (
          <motion.button type="button" whileTap={tap.btn} onClick={onDownload} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" title="Скачать WAV">
            <Download size={13} color={color.olive} />
          </motion.button>
        )}
        <motion.button type="button" whileTap={tap.btn} onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" aria-label="Закрыть">
          <X size={14} color={color.olive} />
        </motion.button>
        </div>
      </div>
      <div className="mt-2.5">
        <WaveformSVG data={peaks} color={c} progress={progress} h={28} onSeek={onSeek} />
      </div>
      <AnimatePresence>
        {analyzers && (
          <motion.div key="analyzers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={spring.sheet}>
            <AnalyzersPanel playing={!!playing} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {ambiUi && !analyzers && (
          <motion.div key="sphere" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={spring.sheet}>
            <AmbiSphere />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
