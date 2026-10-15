import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Download, MoreHorizontal } from 'lucide-react';
import type { Sound } from '@polevka/core';
import { color, pinColor } from '@polevka/design';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { PlayPauseIcon, WaveformSVG } from './ui';
import { seedPeaks } from '../lib/audio-meta';
import { peaksFromWavPreview } from '../lib/waveform';
import { soundAuthor, soundCover, soundOwnerLogin } from '../lib/sound-media';
import { isSoundSaved, setSoundSaved } from '../lib/saved-sounds';
import { downloadSound } from '../lib/download-sound';
import { pathForSound } from '../lib/routes';
import { shareLink } from '../lib/share';
import { SoundTagLines } from './SoundTagLines';
import { Avatar } from './Avatar';
import { HoverMenu } from './HoverMenu';

const ACCENT = color.accent;

function useRowVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true);
    }, { rootMargin: '160px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function useRowPeaks(url: string | undefined, seed: string, enabled: boolean) {
  const fallback = useMemo(() => seedPeaks(seed, 64), [seed]);
  const [peaks, setPeaks] = useState<number[]>(fallback);
  useEffect(() => { setPeaks(fallback); }, [fallback]);
  useEffect(() => {
    if (!enabled || !url) return;
    let dead = false;
    void peaksFromWavPreview(url, 64).then((p) => {
      if (!dead && p?.length) setPeaks(p);
    }).catch(() => {});
    return () => { dead = true; };
  }, [url, enabled]);
  return peaks;
}

/** Catalog-style audio row: cover/play, title, waveform, tags, actions. */
export function SoundRow({
  item,
  badge,
  onOpen,
  trailing = 'more',
}: {
  item: Sound;
  badge?: string;
  onOpen?: () => void;
  /** Drafts use an edit chevron instead of ⋯. */
  trailing?: 'more' | 'edit';
}) {
  const th = useTh();
  const t = useT();
  const { push } = useNav();
  const { profiles, playingId, playing, togglePlay, progress, seek } = useData();
  const { toast } = useUi();
  const [rowRef, seen] = useRowVisible();
  const peaks = useRowPeaks(item.url, String(item.id || item.title || 's'), seen);
  const cover = soundCover(item);
  const author = soundAuthor(item);
  const ownerLogin = soundOwnerLogin(item);
  const ownerProfile = profiles.find((p) => String(p.loginName || '').toLowerCase() === ownerLogin);
  const tint = pinColor[String(item.type)] ?? ACCENT;
  const on = playing && String(playingId) === String(item.id);
  const [saved, setSaved] = useState(() => isSoundSaved(item.id));

  const open = onOpen || (() => push({ type: 'sound-detail', sound: item }));

  const toggleSave = () => {
    const next = !saved;
    setSoundSaved(item.id, next);
    setSaved(next);
    toast(next ? t('saved') : t('unsaved'), {
      undo: () => {
        setSoundSaved(item.id, !next);
        setSaved(!next);
      },
    });
  };

  const share = () => {
    void shareLink(pathForSound(item.id), String(item.title || 'Полёвка')).then((how) => {
      if (how === 'copied') toast('Ссылка скопирована');
      if (how === 'fail') toast('Не удалось поделиться');
    });
  };

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="pv-sound-row rounded-2xl px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 cursor-pointer"
      style={{ background: th.cardBg }}
    >
      {badge ? (
        <p className="w-full pv-micro uppercase px-0.5" style={{ color: th.soft }}>{badge}</p>
      ) : null}

      <button type="button" onClick={(e) => { e.stopPropagation(); togglePlay(item); }}
        className="group w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer relative isolate"
        style={{ background: tint }}
        aria-label={on ? t('pause') : t('listen')}>
        {cover
          ? <img
              src={cover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-[filter,transform] duration-200 ease-out group-hover:scale-105 group-hover:blur-[1.25px] group-focus-visible:scale-105 group-focus-visible:blur-[1.25px]"
            />
          : <span className="absolute inset-0 flex items-center justify-center pv-subtitle text-white">{String(item.title || '?').slice(0, 1)}</span>}
        <span
          className={`absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center transition-opacity duration-200 ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
          style={{ background: 'rgba(26,26,26,0.38)' }}
          aria-hidden
        >
          <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.94)' }}>
            <PlayPauseIcon playing={on} size={12} tone="#1A1A1A" />
          </span>
        </span>
      </button>

      {/* Title needs room — wider than before so mobile truncates later */}
      <div className="min-w-0 flex-[1.35] basis-[9.5rem] max-w-[14rem] sm:max-w-[16rem]">
        <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{item.title || '—'}</p>
        <button
          type="button"
          className="flex items-center gap-1.5 mt-0.5 max-w-full text-left cursor-pointer rounded-lg px-1 -mx-1"
          onClick={(e) => {
            e.stopPropagation();
            if (!ownerLogin) return;
            push({
              type: 'user-profile',
              name: String(ownerProfile?.displayName || ownerProfile?.username || author),
              avatar: String(ownerProfile?.avatar || ''),
              username: `@${ownerLogin}`,
            });
          }}
        >
          <Avatar src={ownerProfile?.avatar} name={author} size={18} rounded="rounded-full" fallback="icon" />
          <span className="pv-micro uppercase truncate" style={{ color: th.soft }}>{author}</span>
        </button>
      </div>

      <div
        role="presentation"
        className="flex-1 min-w-[5.5rem] sm:min-w-[7rem] h-8 flex items-center ml-1 sm:ml-2"
        onClick={(e) => {
          e.stopPropagation();
          if (!on) togglePlay(item);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (!on) togglePlay(item);
          }
        }}
      >
        <WaveformSVG data={peaks} color={on ? ACCENT : color.olive} progress={on ? progress : 0} h={28}
          onSeek={on ? (r) => { seek(r); } : undefined} />
      </div>

      <SoundTagLines sound={item} openOnClick={false} className="w-[6.5rem] sm:w-[8.5rem] flex-shrink-0 pointer-events-none" />

      <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => void downloadSound(item, toast)}
          className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(146,179,177,0.18)' }}
          aria-label={t('download')}>
          <Download size={15} color={color.mist} />
        </button>
        {trailing === 'edit' ? (
          <button type="button" onClick={open}
            className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
            aria-label={t('editSound')}>
            <ChevronRight size={18} color={th.soft} strokeWidth={1.75} />
          </button>
        ) : (
          <HoverMenu
            align="right"
            items={[
              { label: t('share'), onClick: share },
              { label: saved ? t('fromFavorites') : t('toFavorites'), onClick: toggleSave },
            ]}
          >
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
              aria-label={t('openSound')}
            >
              <MoreHorizontal size={16} color={th.soft} />
            </span>
          </HoverMenu>
        )}
      </div>
    </div>
  );
}
