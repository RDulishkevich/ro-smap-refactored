import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Download, Headphones, Map as MapIcon, MapPin, Play, Radio, User, LogIn, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { color, pinColor, spring, tap, typeMeta } from '@polevka/design';
import { WF } from '@polevka/core';
import type { Sound } from '@polevka/core';
import { useNav, type TabId } from '../state/NavContext';
import { useAuth } from '../state/AuthContext';
import { useTh } from '../state/ThemeContext';
import Image11 from '@/brand/Image11';

export function WaveformSVG({ data, color: c = color.accent, progress = 0, h = 28 }: { data: number[]; color?: string; progress?: number; h?: number }) {
  const w = 3, gap = 2, n = data.length, idx = Math.floor(progress * n);
  return (
    <svg viewBox={`0 0 ${n * (w + gap)} ${h}`} width={n * (w + gap)} height={h} className="flex-shrink-0">
      {data.map((v, i) => (
        <rect key={i} x={i * (w + gap)} y={(1 - v) * h} width={w} height={v * h} rx="1.5" fill={c} opacity={i <= idx ? 0.9 : 0.2} />
      ))}
    </svg>
  );
}

export function PlayPauseIcon({ playing, size = 14 }: { playing: boolean; size?: number }) {
  return (
    <AnimatePresence mode="wait">
      {playing
        ? (
          <motion.span key="p" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="flex gap-0.5 items-center">
            <span className="w-1 bg-white rounded-full" style={{ height: size * 0.9 }} />
            <span className="w-1 bg-white rounded-full" style={{ height: size * 0.9 }} />
          </motion.span>
        )
        : (
          <motion.div key="pl" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
            <Play size={size} fill="white" color="white" className="ml-0.5" />
          </motion.div>
        )}
    </AnimatePresence>
  );
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
    <div className="flex items-center gap-3 px-4 pt-4 pb-3 flex-shrink-0" style={{ background: th.headerBg, borderBottom: `1px solid ${th.border}` }}>
      <motion.button whileTap={tap.nav} onClick={onBack} className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: th.lightBg }}>
        <ChevronLeft size={16} style={{ color: color.dark }} />
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
                  fontFamily: 'Geologica, sans-serif',
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
    <div className="flex justify-around items-center py-3 px-4 flex-shrink-0" style={{ background: th.navBg }}>
      {tabs.map(({ id, Icon, label }) => {
        const on = activeTab === id;
        if (id === 'map' && hollowCenter) return <div key={id} className="w-10 h-14" />;
        return (
          <motion.button key={id} onClick={() => setActiveTab(id)} className="flex flex-col items-center gap-1" whileTap={tap.nav}>
            <motion.div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              animate={on ? { backgroundColor: color.accent, scale: 1.08 } : { backgroundColor: 'rgba(0,0,0,0)', scale: 1 }}
              transition={spring.nav}>
              <Icon size={18} color={on ? 'white' : th.isDark ? '#7A9A88' : '#B0B8A8'} />
            </motion.div>
            <motion.span className="text-[9px] font-semibold" animate={{ color: on ? color.accent : th.isDark ? '#7A9A88' : '#B0B8A8' }}>{label}</motion.span>
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

export function VolumeRow({ volume, muted, onVolume, onMute }: { volume: number; muted: boolean; onVolume: (v: number) => void; onMute: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <button type="button" onClick={onMute} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
        {muted || volume === 0 ? <VolumeX size={13} color={color.olive} /> : <Volume2 size={13} color={color.olive} />}
      </button>
      <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => onVolume(Number(e.target.value))}
        className="flex-1 accent-[#B5613F] h-1" />
    </div>
  );
}

export function PinPlayer({ sound, onClose, simple = false, playing, onToggle, progress = 0, onOpen, onSeek, volume = 1, muted = false, onVolume, onMute, onDownload }: {
  sound: Sound; onClose: () => void; simple?: boolean; playing?: boolean; onToggle?: () => void; progress?: number; onOpen?: () => void;
  onSeek?: (r: number) => void; volume?: number; muted?: boolean; onVolume?: (v: number) => void; onMute?: () => void; onDownload?: () => void;
}) {
  const th = useTh();
  const c = pinColor[String(sound.type)] ?? color.accent;
  const wf = WF[Number(sound.wf || 0) % 4];
  return (
    <div className={`px-4 ${simple ? 'pt-3 pb-3' : 'pt-4 pb-10'}`}
      style={{
        background: th.cardBg,
        borderRadius: simple ? 24 : '24px 24px 0 0',
        boxShadow: simple ? '0 4px 16px rgba(45,60,57,0.08)' : '0 -6px 32px rgba(45,60,57,0.18)',
        ...(simple ? {} : {
          maskImage: 'radial-gradient(circle 36px at 50% 100%, transparent 34px, black 36px)',
          WebkitMaskImage: 'radial-gradient(circle 36px at 50% 100%, transparent 34px, black 36px)',
        }),
      }}>
      <div className="flex items-start gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5"><SoundTypeTag type={String(sound.type)} /></div>
          <p className="text-xs font-bold truncate leading-snug cursor-pointer" style={{ color: th.inkText }} onClick={onOpen}>{sound.title}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={9} style={{ color: color.sage, flexShrink: 0 }} />
            <p className="text-[10px] truncate" style={{ color: color.olive }}>{sound.location}</p>
          </div>
        </div>
        {onDownload && (
          <motion.button onClick={onDownload} whileTap={{ scale: 0.82 }} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: th.lightBg }}>
            <Download size={11} color={color.olive} />
          </motion.button>
        )}
        <motion.button onClick={onClose} whileTap={{ scale: 0.82 }} className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: th.lightBg }}>
          <X size={11} color={color.olive} />
        </motion.button>
      </div>
      <div className="flex items-center gap-2.5">
        <motion.button onClick={onToggle} whileTap={{ scale: 0.88 }} className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c }}>
          <PlayPauseIcon playing={!!playing} size={14} />
        </motion.button>
        <div className="flex-1 overflow-hidden">
          <WaveformSVG data={wf} color={c} progress={playing ? progress : 0} h={26} />
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] font-semibold" style={{ color: color.ink }}>{sound.duration}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5" style={{ color: color.sage }}>
            <Headphones size={9} /><span className="text-[9px]">{String(sound.plays ?? 0)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2"><SeekBar progress={progress} onSeek={onSeek} color={c} /></div>
      {onVolume && onMute && <VolumeRow volume={volume} muted={muted} onVolume={onVolume} onMute={onMute} />}
    </div>
  );
}
