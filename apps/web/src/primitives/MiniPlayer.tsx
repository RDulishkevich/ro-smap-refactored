import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { color, pinColor, tap } from '@polevka/design';
import type { Sound } from '@polevka/core';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';
import { PlayPauseIcon } from './ui';
import { soundAuthor, soundCover } from '../lib/sound-media';
import { formatClock, parseDurationLabel } from '../lib/waveform';
import { useSoundMeta } from '../lib/audio-meta';
import { audioService } from '../lib/audio-player';
import { useEffect, useState } from 'react';

export function MiniPlayer({
  sound,
  playing,
  progress,
  onToggle,
  onOpen,
  onClose,
  onSeek,
}: {
  sound: Sound;
  playing?: boolean;
  progress?: number;
  onToggle?: () => void;
  onOpen?: () => void;
  onClose: () => void;
  onSeek?: (r: number) => void;
}) {
  const th = useTh();
  const t = useT();
  const cover = soundCover(sound);
  const author = soundAuthor(sound);
  const tone = pinColor[String(sound.type)] ?? color.accent;
  const meta = useSoundMeta(sound);
  const [liveDur, setLiveDur] = useState(0);
  useEffect(() => {
    const sync = () => {
      setLiveDur(String(audioService.soundId) === String(sound.id) ? audioService.duration() : 0);
    };
    sync();
    return audioService.subscribe(sync);
  }, [sound.id]);
  const totalSec = liveDur || meta.durationSec || parseDurationLabel(sound.duration);
  const nowSec = totalSec ? (progress || 0) * totalSec : 0;
  const pct = Math.max(0, Math.min(100, (progress || 0) * 100));

  const seekAt = (clientX: number, el: HTMLElement) => {
    if (!onSeek) return;
    const r = el.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };

  return (
    <div className="px-3 pt-2.5 pb-2.5" style={{ background: th.cardBg }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
          style={{ background: th.lightBg }}
          aria-label={sound.title}>
          {cover ? (
            <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center pv-caption" style={{ color: th.soft }}>
              {(sound.title || '?').slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
          <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{sound.title}</p>
          <p className="pv-caption truncate mt-0.5" style={{ color: th.muted }}>{author}</p>
        </button>
        <motion.button
          type="button"
          whileTap={tap.btn}
          onClick={onToggle}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ backgroundColor: tone }}
          aria-label={playing ? t('pause') : t('listen')}>
          <PlayPauseIcon playing={!!playing} size={14} />
        </motion.button>
        <motion.button
          type="button"
          whileTap={tap.btn}
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ background: th.lightBg }}
          aria-label={t('close')}>
          <X size={15} color={th.muted} />
        </motion.button>
      </div>

      <div className="mt-2.5">
        <div className="flex justify-between pv-micro tabular-nums mb-1.5" style={{ color: th.soft }}>
          <span>{formatClock(nowSec)}</span>
          <span>{totalSec ? formatClock(totalSec) : '—'}</span>
        </div>
        <button
          type="button"
          className="relative h-3 w-full rounded-full cursor-pointer touch-none"
          style={{ background: th.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(45,60,57,0.14)' }}
          aria-label={`${formatClock(nowSec)} / ${totalSec ? formatClock(totalSec) : '—'}`}
          disabled={!onSeek}
          onClick={(e) => seekAt(e.clientX, e.currentTarget)}
          onPointerDown={(e) => {
            if (!onSeek || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => {
            if (!onSeek || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
            seekAt(e.clientX, e.currentTarget);
          }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, background: tone }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full shadow-sm pointer-events-none"
            style={{
              left: `clamp(0px, calc(${pct}% - 7px), calc(100% - 14px))`,
              background: th.cardBg,
              boxShadow: `0 0 0 2px ${tone}`,
            }}
          />
        </button>
      </div>
    </div>
  );
}
