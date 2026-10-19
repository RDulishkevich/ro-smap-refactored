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

  return (
    <div className="px-3 pt-2.5 pb-2" style={{ background: th.cardBg }}>
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
      <button
        type="button"
        className="relative mt-2 h-1.5 w-full rounded-full overflow-hidden cursor-pointer"
        style={{ background: th.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(45,60,57,0.12)' }}
        aria-label={`${formatClock(nowSec)} / ${totalSec ? formatClock(totalSec) : '—'}`}
        onClick={(e) => {
          if (!onSeek) return;
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
        }}>
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: tone }}
        />
      </button>
    </div>
  );
}
