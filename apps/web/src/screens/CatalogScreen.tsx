import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Download, MoreHorizontal, Search, SlidersHorizontal } from 'lucide-react';
import { EMPTY_FILTER, type Sound } from '@polevka/core';
import { color, pinColor } from '@polevka/design';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { usePrefs, useT } from '../state/PrefsContext';
import { ListSkeleton, ScreenHeader, WaveformSVG } from '../primitives/ui';
import { EmptyNote } from '../primitives/EmptyNote';
import { PullToRefresh } from '../primitives/PullToRefresh';
import { CatalogFilters } from '../primitives/filters';
import { useScrollMemory } from '../lib/use-scroll-memory';
import { downloadSound } from '../lib/download-sound';
import { PLACEHOLDER_PEAKS, useSoundMeta } from '../lib/audio-meta';
import { recordingsLabel, typeI18nKey } from '../lib/i18n';
import { soundAuthor, soundCover } from '../lib/sound-media';
import { isSoundSaved, setSoundSaved } from '../lib/saved-sounds';
import { soundTagLines } from '../lib/sound-tags';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;
const TYPES = ['', 'nature', 'water', 'urban', 'forest', 'birds'] as const;
const SORTS = [
  { id: 'new' as const, label: 'Новые' },
  { id: 'plays' as const, label: 'Слушают' },
  { id: 'az' as const, label: 'А–Я' },
];

function sortSounds(list: Sound[], sort: 'new' | 'plays' | 'az') {
  const next = [...list];
  if (sort === 'plays') next.sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0));
  else if (sort === 'az') next.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
  else next.sort((a, b) => String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
  return next;
}

export function CatalogScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const scroll = useScrollMemory('catalog');
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('catalog')} onBack={onBack} />
      <PullToRefresh ref={scroll} className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 pb-8">
        <CatalogBrowse />
      </PullToRefresh>
    </div>
  );
}

export function CatalogBrowse() {
  const th = useTh();
  const { filteredSounds, filter, setFilter, playingId, playing, togglePlay, loading, progress, seek } = useData();
  const { push } = useNav();
  const { toast } = useUi();
  const t = useT();
  const { prefs } = usePrefs();
  const [sort, setSort] = useState<'new' | 'plays' | 'az'>('new');
  const [more, setMore] = useState(false);
  const sortLabels = { new: t('new'), plays: t('playing'), az: t('az') };
  const sorted = useMemo(() => sortSounds(filteredSounds, sort), [filteredSounds, sort]);
  const grouped = useMemo(() => {
    if (filter.type) return [{ type: filter.type, items: sorted }];
    const order = ['nature', 'water', 'urban', 'forest', 'birds'];
    return order
      .map((type) => ({ type, items: sorted.filter((s) => String(s.type) === type) }))
      .filter((g) => g.items.length)
      .concat([{ type: 'other', items: sorted.filter((s) => !order.includes(String(s.type))) }].filter((g) => g.items.length));
  }, [sorted, filter.type]);

  return (
    <div className="flex flex-col gap-3 pt-3">
      <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5" style={{ background: th.cardBg }}>
        <Search size={16} color={SAGE} className="flex-shrink-0" />
        <input
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder={t('searchCatalog')}
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{ color: th.inkText }}
          aria-label={t('searchCatalogAria')} />
      </label>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {SORTS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSort(s.id)}
            className="pv-label min-h-11 h-11 px-3 rounded-full flex-shrink-0"
            style={{ background: sort === s.id ? ACCENT : th.cardBg, color: sort === s.id ? '#fff' : OLIVE }}>
            {sortLabels[s.id]}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {TYPES.map((id) => {
          const on = filter.type === id;
          const label = id ? t(typeI18nKey(id)) : t('all');
          return (
            <button key={id || 'all'} type="button" onClick={() => setFilter({ ...filter, type: id })}
              className="pv-label min-h-11 h-11 px-3 rounded-full flex-shrink-0"
              style={{ background: on ? ACCENT : th.cardBg, color: on ? '#fff' : OLIVE }}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="pv-label" style={{ color: SAGE }}>{sorted.length} {pluralSounds(sorted.length, t, prefs.locale === 'en' ? 'en' : 'ru')}</p>
        <button type="button" className="pv-label inline-flex items-center gap-1"
          style={{ color: more ? OLIVE : ACCENT }} onClick={() => setMore((v) => !v)}>
          <SlidersHorizontal size={12} /> {more ? t('hideFilters') : t('filters')}
        </button>
      </div>
      {more && (
        <div className="rounded-3xl p-3" style={{ background: th.cardBg }}>
          <CatalogFilters />
        </div>
      )}
      {(filter.q || filter.type || filter.eco || filter.ucs || filter.tag) && (
        <button type="button" className="pv-label self-start" style={{ color: SAGE }}
          onClick={() => { setFilter(EMPTY_FILTER); setSort('new'); }}>{t('resetSearch')}</button>
      )}
      {grouped.map((g) => (
        <section key={g.type} className="flex flex-col gap-2">
          {!filter.type && (
            <p className="pv-label uppercase px-1" style={{ color: SAGE }}>
              {g.type === 'other' ? t('other') : t(typeI18nKey(g.type))} · {g.items.length}
            </p>
          )}
          {g.items.map((item) => (
            <SoundRow key={String(item.id)} item={item}
              on={playing && String(playingId) === String(item.id)}
              progress={playing && String(playingId) === String(item.id) ? progress : 0}
              onPlay={() => togglePlay(item)}
              onSeek={seek}
              onOpen={() => push({ type: 'sound-detail', sound: item })}
              onDownload={() => downloadSound(item, toast)}
              thCard={th.cardBg} ink={th.inkText} />
          ))}
        </section>
      ))}
      {loading && !sorted.length && <ListSkeleton rows={7} />}
      {!loading && !sorted.length && (
        <EmptyNote title={t('nothingFound')} hint={t('nothingFoundHint')}
          actionLabel={t('resetSearch')} onAction={() => { setFilter(EMPTY_FILTER); setSort('new'); }} />
      )}
    </div>
  );
}

function useRowVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true);
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function SoundRow({ item, on, progress, onPlay, onSeek, onOpen, onDownload, thCard, ink }: {
  item: Sound;
  on: boolean;
  progress: number;
  onPlay: () => void;
  onSeek: (ratio: number) => void;
  onOpen: () => void;
  onDownload: () => void;
  thCard: string;
  ink: string;
}) {
  const t = useT();
  const { toast } = useUi();
  const [rowRef, seen] = useRowVisible();
  const meta = useSoundMeta(item, { peaks: seen });
  const peaks = meta.peaks && meta.peaks.length ? meta.peaks : PLACEHOLDER_PEAKS;
  const cover = soundCover(item);
  const author = soundAuthor(item);
  const tint = pinColor[String(item.type)] ?? ACCENT;
  const tags = soundTagLines(item, t(typeI18nKey(String(item.type || ''))));
  const [saved, setSaved] = useState(() => isSoundSaved(item.id));

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

  return (
    <div
      ref={rowRef}
      className="rounded-2xl px-3 py-2.5 grid grid-cols-[3rem_minmax(0,1fr)_auto] md:grid-cols-[3rem_9.5rem_minmax(5.5rem,1fr)_9.5rem_auto] items-center gap-x-3 gap-y-1.5"
      style={{ background: thCard }}>
      <button type="button" onClick={onPlay}
        className="row-start-1 col-start-1 w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer relative"
        style={{ background: tint }}
        aria-label={on ? t('pause') : t('listen')}>
        {cover
          ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center pv-subtitle text-white">{String(item.title || '?').slice(0, 1)}</span>}
      </button>

      <div className="row-start-1 col-start-2 min-w-0">
        <p className="pv-subtitle truncate" style={{ color: ink }}>{item.title}</p>
        <p className="pv-micro uppercase truncate mt-0.5" style={{ color: SAGE }}>{author}</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        className="col-span-3 md:col-span-1 md:col-start-3 md:row-start-1 min-w-0 h-8 flex items-center cursor-pointer"
        aria-label={on ? t('pause') : t('listen')}
        onClick={() => { if (!on) onPlay(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!on) onPlay(); } }}>
        <WaveformSVG data={peaks} color={on ? ACCENT : color.olive} progress={on ? progress : 0} h={28}
          onSeek={on ? onSeek : undefined} />
      </div>

      {(tags.primary || tags.secondary) && (
        <div className="col-span-3 md:col-span-1 md:col-start-4 md:row-start-1 min-w-0">
          {tags.primary ? <p className="pv-caption truncate" style={{ color: ink }}>{tags.primary}</p> : null}
          {tags.secondary ? <p className="pv-micro truncate mt-0.5" style={{ color: OLIVE }}>{tags.secondary}</p> : null}
        </div>
      )}

      <div className="row-start-1 col-start-3 md:col-start-5 flex items-center gap-0.5 flex-shrink-0">
        <button type="button" onClick={toggleSave}
          className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
          aria-label={t('save')} aria-pressed={saved}>
          <Bookmark size={16} color={saved ? ACCENT : SAGE} fill={saved ? ACCENT : 'none'} />
        </button>
        <button type="button" onClick={() => void onDownload()}
          className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(146,179,177,0.18)' }}
          aria-label={t('download')}>
          <Download size={15} color={color.mist} />
        </button>
        <button type="button" onClick={onOpen}
          className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer"
          aria-label={t('openSound')}>
          <MoreHorizontal size={16} color={SAGE} />
        </button>
      </div>
    </div>
  );
}

function pluralSounds(n: number, t: ReturnType<typeof useT>, locale: 'ru' | 'en') {
  return recordingsLabel(n, t, locale);
}

export function CatalogSoundList() {
  return <CatalogBrowse />;
}
