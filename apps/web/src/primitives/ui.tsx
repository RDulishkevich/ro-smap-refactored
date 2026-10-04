import { AnimatePresence, motion } from 'motion/react';
import { AudioLines, ChevronLeft, Download, Globe2, LayoutGrid, Map as MapIcon, MessageCircle, Play, User, LogIn, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { color, pinColor, spring, tap, typeMeta } from '@polevka/design';
import { normalizeTimeMarkers } from '@polevka/core';
import type { Sound } from '@polevka/core';
import { useNav, type TabId } from '../state/NavContext';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useTh } from '../state/ThemeContext';
import { formatClock, parseDurationLabel } from '../lib/waveform';
import { PLACEHOLDER_PEAKS, useSoundMeta } from '../lib/audio-meta';
import { typeI18nKey } from '../lib/i18n';
import { useT } from '../state/PrefsContext';
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
  const t = useT();
  const s = typeMeta[type] ?? { label: type, bg: color.cream, color: color.olive };
  return (
    <span className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
      <span className="pv-micro uppercase" style={{ color: s.color }}>{type ? t(typeI18nKey(type)) : s.label}</span>
    </span>
  );
}

export function ScreenHeader({ title, onBack, right, onTitleClick }: { title: string; onBack: () => void; right?: ReactNode; onTitleClick?: () => void }) {
  const th = useTh();
  return (
    <div className="flex items-center gap-3 px-4 pv-safe-top pb-3 flex-shrink-0" style={{ background: th.headerBg, borderBottom: `1px solid ${th.border}` }}>
      <motion.button whileTap={tap.nav} onClick={onBack} className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ background: th.lightBg }} aria-label="Назад">
        <ChevronLeft size={18} style={{ color: color.dark }} />
      </motion.button>
      {onTitleClick ? (
        <button type="button" onClick={onTitleClick} className="pv-heading flex-1 truncate text-left" style={{ color: th.inkText }}>{title}</button>
      ) : (
        <p className="pv-heading flex-1 truncate" style={{ color: th.inkText }}>{title}</p>
      )}
      {right}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const th = useTh();
  return (
    <div className="flex flex-col gap-2 pt-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: th.cardBg, opacity: Math.max(0.35, 1 - i * 0.12) }} />
      ))}
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
        <label htmlFor={id} className="pv-label block mb-2" style={{ color: color.sage }}>{label}</label>
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
                className="pv-heading flex-1 min-w-0 h-12 rounded-2xl flex items-center justify-center tabular-nums select-none"
                style={{
                  background: th.lightBg,
                  color: th.inkText,
                  boxShadow: `inset 0 0 0 ${on || error ? 1.5 : 1}px ${error || on ? color.accent : th.border}`,
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
  const { isLoggedIn, user } = useAuth();
  const { mail } = useData();
  const th = useTh();
  const t = useT();
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;
  const tabs: Array<{ id: TabId; Icon: typeof MapIcon; label: string }> = [
    { id: 'menu', Icon: LayoutGrid, label: t('menu') },
    { id: 'map', Icon: MapIcon, label: t('map') },
    { id: 'messages', Icon: MessageCircle, label: t('messages') },
    { id: 'profile', Icon: isLoggedIn ? User : LogIn, label: isLoggedIn ? t('profile') : t('login') },
  ];
  return (
    <div className="flex justify-around items-center py-2 px-3 min-h-[3.5rem] flex-shrink-0" style={{ background: hollowCenter ? th.navBg : 'transparent' }}>
      {tabs.map(({ id, Icon, label }, i) => {
        const on = activeTab === id;
        const btn = (
          <motion.button key={id} onClick={() => setActiveTab(id)} className="flex items-center justify-center" whileTap={tap.nav} aria-label={label} aria-current={on ? 'page' : undefined}>
            <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: on ? color.accent : 'transparent' }}>
              <Icon size={20} color={on ? 'white' : th.isDark ? '#7A9A88' : '#B0B8A8'} />
              {id === 'messages' && unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: on ? '#fff' : color.accent }} />
              )}
            </div>
          </motion.button>
        );
        if (hollowCenter && i === 1) {
          return (
            <span key={`${id}-wrap`} className="contents">
              {btn}
              <div className="w-14 h-12 flex-shrink-0" aria-hidden />
            </span>
          );
        }
        return btn;
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

function VolumeKnob({ volume, muted, onVolume, onMute, compact = false, tone = color.accent }: {
  volume: number; muted: boolean; onVolume: (v: number) => void; onMute: () => void; compact?: boolean; tone?: string;
}) {
  const shown = muted ? 0 : volume;
  const pct = Math.round(shown * 100);
  const t = useT();
  const Icon = muted || shown === 0 ? VolumeX : shown < 0.45 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1 flex-shrink-0" title={`${t('volume')} ${pct}%`}>
      <button type="button" onClick={onMute}
        className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
        style={{ background: `${tone}2E` }}
        aria-label={muted ? t('unmute') : t('mute')}>
        <Icon size={14} color={tone} />
      </button>
      {!compact && (
        <div className="relative w-14 h-1 rounded-full" style={{ background: `${tone}40` }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: tone }} />
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

function PlayerAction({ on, label, onClick, tone, children }: {
  on: boolean; label: string; onClick: () => void; tone: string; children: ReactNode;
}) {
  return (
    <motion.button type="button" whileTap={tap.btn} onClick={onClick}
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
      style={{ background: on ? `${tone}40` : `${tone}2E`, boxShadow: on ? `inset 0 0 0 1.5px ${tone}` : undefined }}
      title={label} aria-label={label} aria-pressed={on}>
      {children}
    </motion.button>
  );
}

export function PinPlayer({ sound, onClose, simple = false, playing, onToggle, progress = 0, onOpen, onSeek, volume = 1, muted = false, onVolume, onMute, onDownload }: {
  sound: Sound; onClose: () => void; simple?: boolean; playing?: boolean; onToggle?: () => void; progress?: number; onOpen?: () => void;
  onSeek?: (r: number) => void; volume?: number; muted?: boolean; onVolume?: (v: number) => void; onMute?: () => void; onDownload?: () => void;
}) {
  const th = useTh();
  const compact = !useIsDesktop();
  const { toast } = useUi();
  const c = pinColor[String(sound.type)] ?? color.accent;
  const [peaksOn, setPeaksOn] = useState(false);
  const meta = useSoundMeta(sound, { peaks: peaksOn });
  const peaks = meta.peaks && meta.peaks.length ? meta.peaks : PLACEHOLDER_PEAKS;
  const t = useT();
  const [analyzers, setAnalyzers] = useState(false);
  const [ambiUi, setAmbiUi] = useState(false);
  const [markTip, setMarkTip] = useState<{ label: string; left: number } | null>(null);
  const ambiGen = useRef(0);
  const ambiCapable = isAmbisonicSound(sound);
  const [liveDur, setLiveDur] = useState(0);
  useEffect(() => {
    const sync = () => {
      setLiveDur(String(audioService.soundId) === String(sound.id) ? audioService.duration() : 0);
    };
    sync();
    return audioService.subscribe(sync);
  }, [sound.id]);
  const totalSec = liveDur || meta.durationSec || parseDurationLabel(sound.duration);
  const nowSec = totalSec ? progress * totalSec : 0;
  const totalLabel = totalSec ? formatClock(totalSec) : '—';
  useEffect(() => {
    setAnalyzers(false);
    setAmbiUi(false);
    ambiGen.current += 1;
    if (audioService.ambisonic) void audioService.setAmbisonic(false);
    if (sound.url) audioService.preload(sound.id, String(sound.url));
    setPeaksOn(false);
    const later = window.setTimeout(() => setPeaksOn(true), 1400);
    return () => window.clearTimeout(later);
  }, [sound.id, sound.url]);
  const toggleAnalyzers = async () => {
    if (analyzers) { setAnalyzers(false); return; }
    const ok = await audioService.ensureGraph();
    if (!ok) { toast(t('analyzersFail')); return; }
    setAnalyzers(true);
  };
  const toggleAmbi = async () => {
    const gen = ++ambiGen.current;
    if (audioService.ambisonic) {
      await audioService.setAmbisonic(false);
      if (gen !== ambiGen.current) return;
      setAmbiUi(false);
      toast(t('ambisonicOff'));
      return;
    }
    const ok = await audioService.setAmbisonic(true, sound.url ? String(sound.url) : undefined);
    if (gen !== ambiGen.current) return;
    if (!ok) { toast(t('ambisonicFail')); return; }
    setAmbiUi(true);
    setAnalyzers(false);
    toast(t('ambisonicOn'));
  };
  return (
    <div className={`px-3.5 ${simple ? 'py-2.5' : 'pt-3 pb-9'}`}
      style={simple ? { background: th.cardBg } : {
        background: th.cardBg,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -6px 32px rgba(45,60,57,0.18)',
        maskImage: analyzers || ambiUi ? undefined : 'radial-gradient(circle 36px at 50% 100%, transparent 34px, black 36px)',
        WebkitMaskImage: analyzers || ambiUi ? undefined : 'radial-gradient(circle 36px at 50% 100%, transparent 34px, black 36px)',
      }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button type="button" onClick={onToggle} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ backgroundColor: c }} aria-label={playing ? t('pause') : t('listen')}>
          <PlayPauseIcon playing={!!playing} size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <button type="button" className="pv-subtitle block w-full text-left truncate" style={{ color: th.inkText }} onClick={onOpen}>{sound.title}</button>
          <p className="pv-caption tabular-nums mt-0.5 truncate" style={{ color: color.olive }}>
            <span className="font-medium" style={{ color: color.dark }}>{formatClock(nowSec)}</span>
            <span> / {totalLabel}</span>
            {sound.location ? <span> · {sound.location}</span> : null}
          </p>
        </div>
        <div className="relative z-20 flex items-center gap-1 flex-shrink-0 pointer-events-auto">
        {onVolume && onMute && <VolumeKnob volume={volume} muted={muted} onVolume={onVolume} onMute={onMute} compact={compact} tone={c} />}
        <PlayerAction on={analyzers} label={t('analyzers')} onClick={() => void toggleAnalyzers()} tone={c}>
          <AudioLines size={14} color={c} />
        </PlayerAction>
        {ambiCapable && (
          <PlayerAction on={ambiUi} label={t('ambisonic')} onClick={() => void toggleAmbi()} tone={c}>
            <Globe2 size={14} color={c} />
          </PlayerAction>
        )}
        {onDownload && (
          <PlayerAction on={false} label={t('download')} onClick={onDownload} tone={c}>
            <Download size={14} color={c} />
          </PlayerAction>
        )}
        <PlayerAction on={false} label={t('close')} onClick={onClose} tone={c}>
          <X size={15} color={c} />
        </PlayerAction>
        </div>
      </div>
      <div className="relative mt-2.5">
        <WaveformSVG data={peaks} color={c} progress={progress} h={28} onSeek={onSeek} />
        {normalizeTimeMarkers(sound.timeMarkers).map((m) => {
          const pct = totalSec ? Math.max(0, Math.min(100, (m.t / totalSec) * 100)) : 0;
          return (
            <button key={`${m.t}-${m.label}`} type="button"
              className="absolute -top-1 z-[3] -translate-x-1/2 w-4 h-4 rounded-full cursor-pointer"
              style={{ left: `${pct}%`, background: color.dark, boxShadow: '0 0 0 3px rgba(45,60,57,0.16)' }}
              onMouseEnter={() => setMarkTip({ label: m.label, left: pct })}
              onMouseLeave={() => setMarkTip(null)}
              onFocus={() => setMarkTip({ label: m.label, left: pct })}
              onBlur={() => setMarkTip(null)}
              aria-label={m.label}
              onClick={(e) => {
                e.stopPropagation();
                if (totalSec && onSeek) onSeek(Math.max(0, Math.min(1, m.t / totalSec)));
              }} />
          );
        })}
        {markTip && (
          <div className="absolute z-[4] -top-8 -translate-x-1/2 pointer-events-none px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap"
            style={{ left: `${markTip.left}%`, background: color.dark, color: '#fff' }}>
            {markTip.label}
          </div>
        )}
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
