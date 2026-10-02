import { useMemo, useState } from 'react';
import { Headphones, Search, SlidersHorizontal } from 'lucide-react';
import { EMPTY_FILTER, formatPlays, type Sound } from '@polevka/core';
import { color, pinColor, typeMeta } from '@polevka/design';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { PlayPauseIcon, ScreenHeader, SoundTypeTag } from '../primitives/ui';
import { CatalogFilters } from '../primitives/filters';
import { parseDurationLabel } from '../lib/waveform';

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
  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Каталог" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 pb-8">
        <CatalogBrowse />
      </div>
    </div>
  );
}

export function CatalogBrowse() {
  const th = useTh();
  const { filteredSounds, filter, setFilter, playingId, playing, togglePlay } = useData();
  const { push } = useNav();
  const [sort, setSort] = useState<'new' | 'plays' | 'az'>('new');
  const [more, setMore] = useState(false);
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
          placeholder="Название, место, автор, UCS…"
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
          style={{ color: th.inkText }}
          aria-label="Поиск по каталогу" />
      </label>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {SORTS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSort(s.id)}
            className="h-8 px-3 rounded-full text-[11px] font-semibold flex-shrink-0"
            style={{ background: sort === s.id ? ACCENT : th.cardBg, color: sort === s.id ? '#fff' : OLIVE }}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {TYPES.map((id) => {
          const on = filter.type === id;
          const label = id ? (typeMeta[id]?.label || id) : 'Все';
          return (
            <button key={id || 'all'} type="button" onClick={() => setFilter({ ...filter, type: id })}
              className="h-8 px-3 rounded-full text-[11px] font-semibold flex-shrink-0"
              style={{ background: on ? ACCENT : th.cardBg, color: on ? '#fff' : OLIVE }}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold" style={{ color: SAGE }}>{sorted.length} {pluralSounds(sorted.length)}</p>
        <button type="button" className="text-[11px] font-semibold inline-flex items-center gap-1"
          style={{ color: more ? OLIVE : ACCENT }} onClick={() => setMore((v) => !v)}>
          <SlidersHorizontal size={12} /> {more ? 'Скрыть фильтры' : 'Фильтры'}
        </button>
      </div>
      {more && (
        <div className="rounded-3xl p-3" style={{ background: th.cardBg }}>
          <CatalogFilters />
        </div>
      )}
      {(filter.q || filter.type || filter.eco || filter.ucs || filter.tag) && (
        <button type="button" className="text-[11px] self-start" style={{ color: SAGE }}
          onClick={() => { setFilter(EMPTY_FILTER); setSort('new'); }}>Сбросить поиск</button>
      )}
      {grouped.map((g) => (
        <section key={g.type} className="flex flex-col gap-2">
          {!filter.type && (
            <p className="text-[11px] font-bold uppercase tracking-wide px-1" style={{ color: SAGE }}>
              {typeMeta[g.type]?.label || 'Другое'} · {g.items.length}
            </p>
          )}
          {g.items.map((item) => (
            <SoundRow key={String(item.id)} item={item}
              on={playing && String(playingId) === String(item.id)}
              onPlay={() => togglePlay(item)}
              onOpen={() => push({ type: 'sound-detail', sound: item })}
              thCard={th.cardBg} ink={th.inkText} />
          ))}
        </section>
      ))}
      {!sorted.length && (
        <p className="text-xs py-10 text-center" style={{ color: SAGE }}>Ничего не нашлось — сбросьте фильтр или измените запрос</p>
      )}
    </div>
  );
}

function SoundRow({ item, on, onPlay, onOpen, thCard, ink }: { item: Sound; on: boolean; onPlay: () => void; onOpen: () => void; thCard: string; ink: string }) {
  const c = pinColor[String(item.type)] ?? ACCENT;
  return (
    <div className="rounded-2xl px-3.5 py-3 flex items-center gap-3" style={{ background: thCard }}>
      <button type="button" onClick={onPlay} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c }} aria-label={on ? 'Пауза' : 'Слушать'}>
        <PlayPauseIcon playing={on} size={12} />
      </button>
      <button type="button" className="flex-1 min-w-0 text-left" onClick={onOpen}>
        <p className="text-[13px] font-semibold truncate" style={{ color: ink }}>{item.title}</p>
        <p className="text-[11px] truncate mt-0.5" style={{ color: OLIVE }}>
          {item.location}
          {parseDurationLabel(item.duration) > 0 ? ` · ${item.duration}` : ''}
        </p>
      </button>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <SoundTypeTag type={String(item.type)} />
        <span className="flex items-center gap-0.5" style={{ color: SAGE }}><Headphones size={9} /><span className="text-[9px]">{formatPlays(item.plays)}</span></span>
      </div>
    </div>
  );
}

function pluralSounds(n: number) {
  const m = n % 100;
  if (m >= 11 && m <= 14) return 'записей';
  const d = n % 10;
  if (d === 1) return 'запись';
  if (d >= 2 && d <= 4) return 'записи';
  return 'записей';
}

export function CatalogSoundList() {
  return <CatalogBrowse />;
}
