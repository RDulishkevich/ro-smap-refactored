import { EMPTY_FILTER, ucsCategories, ucsStructure, type CatalogFilter } from '@polevka/core';
import { color } from '@polevka/design';
import { useState } from 'react';
import { useData } from '../state/DataContext';
import { useTh } from '../state/ThemeContext';
import { useIsDesktop } from '../lib/use-media';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

const ECO = [
  { id: '', label: 'Все' },
  { id: 'geophony', label: 'Геофония' },
  { id: 'biophony', label: 'Биофония' },
  { id: 'anthrophony', label: 'Антропофония' },
];

const CHANNELS = ['', 'mono', 'stereo', 'quad', 'ambisonic'];
const UCS_TOP = ['', 'AMBIENCE', 'WATER', 'ANIMALS', 'BIRDS', 'WEATHER', 'NATURE', 'VEHICLES', 'INDUSTRIAL'];

export function CatalogFilters() {
  const th = useTh();
  const desktop = useIsDesktop();
  const [more, setMore] = useState(false);
  const { filter, setFilter } = useData();
  const set = (patch: Partial<CatalogFilter>) => setFilter({ ...filter, ...patch });
  const cats = (ucsCategories as string[]).length ? UCS_TOP.concat((ucsCategories as string[]).filter((c) => !UCS_TOP.includes(c)).slice(0, 12)) : UCS_TOP;
  const extra = desktop || more;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none">
        {ECO.map((e) => (
          <Chip key={e.id || 'all'} on={filter.eco === e.id} onClick={() => set({ eco: e.id })} label={e.label} th={th} />
        ))}
      </div>
      {extra && (
        <>
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none">
        {cats.slice(0, 16).map((c) => (
          <Chip key={c || 'ucs'} on={filter.ucs === c} onClick={() => set({ ucs: c, ucsSub: '' })} label={c || 'UCS'} th={th} />
        ))}
      </div>
      {filter.ucs && Array.isArray((ucsStructure as Record<string, Array<{ id: string; name: string }>>)[filter.ucs]) && (
        <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none">
          <Chip on={!filter.ucsSub} onClick={() => set({ ucsSub: '' })} label="все подкатегории" th={th} />
          {((ucsStructure as Record<string, Array<{ id: string; name: string }>>)[filter.ucs] || []).slice(0, 20).map((s) => (
            <Chip key={s.id} on={filter.ucsSub === s.id} onClick={() => set({ ucsSub: s.id })} label={s.id} th={th} />
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input value={filter.tag} onChange={(e) => set({ tag: e.target.value })} placeholder="тег"
          className="flex-1 min-w-0 rounded-xl px-2 py-1.5 text-[10px] outline-none" style={{ background: th.lightBg, color: th.inkText }} />
        <input value={filter.gear} onChange={(e) => set({ gear: e.target.value })} placeholder="техника"
          className="flex-1 min-w-0 rounded-xl px-2 py-1.5 text-[10px] outline-none" style={{ background: th.lightBg, color: th.inkText }} />
        <select value={filter.channels} onChange={(e) => set({ channels: e.target.value })}
          className="rounded-xl px-2 py-1.5 text-[10px] outline-none" style={{ background: th.lightBg, color: th.inkText }}>
          {CHANNELS.map((c) => <option key={c || 'ch'} value={c}>{c || 'каналы'}</option>)}
        </select>
      </div>
        </>
      )}
      <div className="flex items-center gap-2">
        {!desktop && (
          <button type="button" className="text-[10px] font-semibold" style={{ color: extra ? OLIVE : ACCENT }} onClick={() => setMore((v) => !v)}>
            {extra ? 'Свернуть фильтры' : 'Ещё фильтры'}
          </button>
        )}
        {(filter.eco || filter.ucs || filter.ucsSub || filter.tag || filter.gear || filter.channels || filter.q || filter.type) && (
          <button className="text-[10px]" style={{ color: SAGE }} onClick={() => setFilter(EMPTY_FILTER)}>Сбросить</button>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, label, th }: { on: boolean; onClick: () => void; label: string; th: { lightBg: string } }) {
  return (
    <button type="button" onClick={onClick} className="px-3 py-1.5 rounded-full text-[10px] font-semibold flex-shrink-0"
      style={{ background: on ? ACCENT : th.lightBg, color: on ? '#fff' : OLIVE }}>{label}</button>
  );
}
