import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Heart, MoreHorizontal, SkipBack, SkipForward } from 'lucide-react';
import { color, pinColor, spring, tap } from '@polevka/design';
import type { Sound } from '@polevka/core';
import { normalizeTimeMarkers } from '@polevka/core';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';
import { PhotoCarousel } from './PhotoCarousel';
import { PlayPauseIcon, WaveformSVG } from './ui';
import { HoverMenu } from './HoverMenu';
import { soundAuthor } from '../lib/sound-media';
import { formatClock, parseDurationLabel } from '../lib/waveform';
import { PLACEHOLDER_PEAKS, useSoundMeta } from '../lib/audio-meta';
import { audioService } from '../lib/audio-player';
import { resolveMediaUrl } from '../lib/media-url';

const DISMISS = 96;

export function SoundPlayerSheet({
  sound,
  playing,
  progress,
  liked,
  onToggle,
  onSeek,
  onLike,
  onClose,
  menu,
  children,
}: {
  sound: Sound;
  playing?: boolean;
  progress?: number;
  liked?: boolean;
  onToggle?: () => void;
  onSeek?: (r: number) => void;
  onLike?: () => void;
  onClose: () => void;
  menu?: ReactNode;
  children?: ReactNode;
}) {
  const th = useTh();
  const t = useT();
  const tone = pinColor[String(sound.type)] ?? color.accent;
  const author = soundAuthor(sound);
  const meta = useSoundMeta(sound, { peaks: true });
  const peaks = meta.peaks?.length ? meta.peaks : PLACEHOLDER_PEAKS;
  const [liveDur, setLiveDur] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroEndRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(true);
  const dragRef = useRef<{ y0: number; x0: number; active: boolean; armed?: boolean } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const images = (sound.images || []).map((u) => resolveMediaUrl(String(u)) || String(u)).filter(Boolean);

  useEffect(() => {
    const sync = () => {
      setLiveDur(String(audioService.soundId) === String(sound.id) ? audioService.duration() : 0);
    };
    sync();
    return audioService.subscribe(sync);
  }, [sound.id]);

  useEffect(() => {
    const root = scrollRef.current;
    const end = heroEndRef.current;
    if (!root || !end) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root, threshold: 0 },
    );
    io.observe(end);
    return () => io.disconnect();
  }, [sound.id]);

  useEffect(() => {
    if (!closing) return;
    const tmr = window.setTimeout(() => onCloseRef.current(), 260);
    return () => window.clearTimeout(tmr);
  }, [closing]);

  const totalSec = liveDur || meta.durationSec || parseDurationLabel(sound.duration);
  const nowSec = totalSec ? (progress || 0) * totalSec : 0;
  const markers = normalizeTimeMarkers(sound.timeMarkers);

  const finishClose = () => {
    if (closing) return;
    setClosing(true);
    setDragY((y) => Math.max(y, 140));
  };

  const onScroll = () => {
    const el = scrollRef.current;
    atTopRef.current = !el || el.scrollTop <= 1;
  };

  const canSheetDrag = () => atTopRef.current && (scrollRef.current?.scrollTop ?? 0) <= 1;

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!canSheetDrag()) {
      dragRef.current = null;
      return;
    }
    // Armed — capture only after a clear downward pull so content can still scroll.
    dragRef.current = { y0: e.clientY, x0: e.clientX, active: false, armed: true };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!canSheetDrag() && !d.active) {
      dragRef.current = null;
      setDragY(0);
      return;
    }
    const dy = e.clientY - d.y0;
    const dx = e.clientX - d.x0;
    if (!d.active) {
      if (!d.armed) return;
      if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) {
        dragRef.current = null;
        return;
      }
      if (dy < -8) {
        dragRef.current = null;
        return;
      }
      if (dy > 10) {
        d.active = true;
        d.armed = false;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
      } else {
        return;
      }
    }
    if (Math.abs(dx) > Math.abs(dy) + 6) {
      dragRef.current = null;
      setDragY(0);
      return;
    }
    if (dy > 0) {
      setDragY(dy);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } else {
      setDragY(0);
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.active) { setDragY(0); return; }
    if (dragY > DISMISS) finishClose();
    else setDragY(0);
  };

  const skip = (dir: -1 | 1) => {
    if (!totalSec || !onSeek) return;
    const cur = nowSec;
    if (dir > 0) {
      const next = markers.find((m) => m.t > cur + 0.4);
      onSeek(Math.min(1, (next ? next.t : Math.min(totalSec, cur + 15)) / totalSec));
    } else {
      const prev = [...markers].reverse().find((m) => m.t < cur - 0.4);
      onSeek(Math.max(0, (prev ? prev.t : Math.max(0, cur - 15)) / totalSec));
    }
  };
  const skipBackLabel = markers.length ? 'Предыдущая метка' : 'На 15 секунд назад';
  const skipFwdLabel = markers.length ? 'Следующая метка' : 'На 15 секунд вперёд';
  const showSkip = !!onSeek && totalSec > 0;

  return (
    <motion.div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: th.phoneBg, touchAction: 'pan-y' }}
      initial={{ y: '100%' }}
      animate={{
        y: closing ? '110%' : dragY,
        opacity: closing ? 0.96 : 1,
      }}
      exit={{ y: '110%', opacity: 0 }}
      transition={dragRef.current?.active && dragY ? { type: 'tween', duration: 0 } : spring.sheet}>
      {/* Dismiss from the top chrome only — safe while scrolled into the card. */}
      <div
        className="flex-shrink-0 pv-safe-top"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; setDragY(0); }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-2 mb-1" style={{ background: th.border }} />
        <div className="flex items-center justify-between px-3 pb-2">
          <motion.button type="button" whileTap={tap.btn} onClick={finishClose}
            className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}
            aria-label={t('close')}>
            <ChevronDown size={20} color={th.inkText} />
          </motion.button>
          <p className="pv-caption font-semibold" style={{ color: th.muted }}>Сейчас играет</p>
          {menu || (
            <span className="w-10 h-10" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {stuck && (
          <motion.div
            key="sticky"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring.fade}
            className="flex-shrink-0 px-4 pb-2 border-b"
            style={{ background: th.phoneBg, borderColor: th.border }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{sound.title}</p>
                <p className="pv-caption truncate" style={{ color: th.muted }}>{author}</p>
              </div>
              {onLike && (
                <motion.button type="button" whileTap={tap.btn} onClick={onLike}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: liked ? `${color.accent}22` : th.lightBg }}
                  aria-label="Нравится">
                  <Heart size={16} color={liked ? color.accent : th.muted} fill={liked ? color.accent : 'none'} />
                </motion.button>
              )}
            </div>
            <button
              type="button"
              className="relative mt-2 h-1 w-full rounded-full overflow-hidden"
              style={{ background: th.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(45,60,57,0.12)' }}
              onClick={(e) => {
                if (!onSeek) return;
                const r = e.currentTarget.getBoundingClientRect();
                onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
              }}>
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(progress || 0) * 100}%`, background: th.inkText }} />
            </button>
            <div className="flex justify-between pv-micro tabular-nums mt-1" style={{ color: th.soft }}>
              <span>{formatClock(nowSec)}</span>
              <span>{totalSec ? formatClock(totalSec) : '—'}</span>
            </div>
            <div className="flex items-center justify-center gap-5 mt-2">
              {showSkip && (
                <button type="button" className="w-10 h-10 flex items-center justify-center" aria-label={skipBackLabel} onClick={() => skip(-1)}>
                  <SkipBack size={18} color={th.inkText} fill={th.inkText} />
                </button>
              )}
              <motion.button type="button" whileTap={tap.btn} onClick={onToggle}
                className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: tone }}
                aria-label={playing ? t('pause') : t('listen')}>
                <PlayPauseIcon playing={!!playing} size={18} />
              </motion.button>
              {showSkip && (
                <button type="button" className="w-10 h-10 flex items-center justify-center" aria-label={skipFwdLabel} onClick={() => skip(1)}>
                  <SkipForward size={18} color={th.inkText} fill={th.inkText} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-none overscroll-y-contain"
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; setDragY(0); }}
        style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-4 pt-1">
          {images.length ? (
            <PhotoCarousel images={images} title={sound.title} aspect="1 / 1" className="rounded-3xl" />
          ) : (
            <div className="rounded-3xl flex items-center justify-center" style={{ aspectRatio: '1 / 1', background: th.lightBg }}>
              <p className="pv-heading" style={{ color: th.soft }}>{(sound.title || '?').slice(0, 1)}</p>
            </div>
          )}
        </div>

        <div className="px-5 pt-5 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="pv-heading" style={{ color: th.inkText }}>{sound.title}</p>
              <p className="pv-body mt-1" style={{ color: th.muted }}>{author}</p>
            </div>
            {onLike && (
              <motion.button type="button" whileTap={tap.btn} onClick={onLike}
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: liked ? `${color.accent}22` : th.lightBg }}
                aria-label="Нравится">
                <Heart size={18} color={liked ? color.accent : th.muted} fill={liked ? color.accent : 'none'} />
              </motion.button>
            )}
          </div>

          <div className="mt-4">
            <WaveformSVG data={peaks} color={tone} progress={progress || 0} h={36} onSeek={onSeek} />
            <div className="flex justify-between pv-micro tabular-nums mt-1.5" style={{ color: th.soft }}>
              <span>{formatClock(nowSec)}</span>
              <span>{totalSec ? formatClock(totalSec) : '—'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-3 mb-2">
            {showSkip && (
              <button type="button" className="w-11 h-11 flex items-center justify-center" aria-label={skipBackLabel} onClick={() => skip(-1)}>
                <SkipBack size={20} color={th.inkText} fill={th.inkText} />
              </button>
            )}
            <motion.button type="button" whileTap={tap.cta} onClick={onToggle}
              className="w-[68px] h-[68px] rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(45,60,57,0.18)]"
              style={{ background: tone }}
              aria-label={playing ? t('pause') : t('listen')}>
              <PlayPauseIcon playing={!!playing} size={22} />
            </motion.button>
            {showSkip && (
              <button type="button" className="w-11 h-11 flex items-center justify-center" aria-label={skipFwdLabel} onClick={() => skip(1)}>
                <SkipForward size={20} color={th.inkText} fill={th.inkText} />
              </button>
            )}
          </div>
        </div>

        <div ref={heroEndRef} className="h-px w-full" aria-hidden />

        <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export function SoundPlayerMenuButton({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; danger?: boolean; onClick: () => void }>;
}) {
  const th = useTh();
  return (
    <HoverMenu title={title} items={items}>
      <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}>
        <MoreHorizontal size={16} color={th.muted} />
      </span>
    </HoverMenu>
  );
}
