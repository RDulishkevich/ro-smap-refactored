import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { EMPTY_FILTER, type Sound } from '@polevka/core';
import { color } from '@polevka/design';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { usePrefs, useT } from '../state/PrefsContext';
import { ListSkeleton, ScreenHeader } from '../primitives/ui';
import { EmptyNote } from '../primitives/EmptyNote';
import { PullToRefresh } from '../primitives/PullToRefresh';
import { CatalogFilters } from '../primitives/filters';
import { useScrollMemory } from '../lib/use-scroll-memory';
import { recordingsLabel, typeI18nKey } from '../lib/i18n';
import { SoundRow } from '../primitives/SoundRow';

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
  const { filteredSounds, filter, setFilter, loading } = useData();
  const { push } = useNav();
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
        <Search size={16} color={th.soft} className="flex-shrink-0" />
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
            style={{ background: sort === s.id ? ACCENT : th.cardBg, color: sort === s.id ? '#fff' : th.muted }}>
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
              style={{ background: on ? ACCENT : th.cardBg, color: on ? '#fff' : th.muted }}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="pv-label" style={{ color: th.soft }}>{sorted.length} {pluralSounds(sorted.length, t, prefs.locale === 'en' ? 'en' : 'ru')}</p>
        <button type="button" className="pv-label inline-flex items-center gap-1"
          style={{ color: more ? th.muted : ACCENT }} onClick={() => setMore((v) => !v)}>
          <SlidersHorizontal size={12} /> {more ? t('hideFilters') : t('filters')}
        </button>
      </div>
      {more && (
        <div className="rounded-3xl p-3" style={{ background: th.cardBg }}>
          <CatalogFilters />
        </div>
      )}
      {(filter.q || filter.type || filter.eco || filter.ucs || filter.tag) && (
        <button type="button" className="pv-label self-start" style={{ color: th.soft }}
          onClick={() => { setFilter(EMPTY_FILTER); setSort('new'); }}>{t('resetSearch')}</button>
      )}
      {grouped.map((g) => (
        <section key={g.type} className="flex flex-col gap-2">
          {!filter.type && (
            <p className="pv-label uppercase px-1" style={{ color: th.soft }}>
              {g.type === 'other' ? t('other') : t(typeI18nKey(g.type))} · {g.items.length}
            </p>
          )}
          {g.items.map((item) => (
            <SoundRow key={String(item.id)} item={item}
              onOpen={() => push({ type: 'sound-detail', sound: item })} />
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

function pluralSounds(n: number, t: ReturnType<typeof useT>, locale: 'ru' | 'en') {
  return recordingsLabel(n, t, locale);
}

export function CatalogSoundList() {
  return <CatalogBrowse />;
}
