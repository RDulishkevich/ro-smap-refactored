import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Dices, HelpCircle, LayoutGrid, Radio, Search, Settings, Shield, Ticket,
} from 'lucide-react';
import { color, tap } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import BrandMark from '@/brand/BrandMark';
import { SEARCH_KIND_LABEL, searchAll, type SearchHit } from '../lib/search-all';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

export function MenuHub() {
  const th = useTh();
  const { push } = useNav();
  const { isStaff } = useAuth();
  const { sounds, profiles, events, feed } = useData();
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchAll(q, { sounds, profiles, events, feed }), [q, sounds, profiles, events, feed]);

  const openHit = (hit: SearchHit) => {
    if (hit.kind === 'sound') push({ type: 'sound-detail', sound: hit.sound });
    else if (hit.kind === 'expedition') push({ type: 'expedition-detail', exp: hit.exp });
    else if (hit.kind === 'event') push({ type: 'events', focusId: String(hit.event.id || '') });
    else if (hit.kind === 'person') {
      const login = String(hit.profile.loginName || hit.profile.login || '').replace(/^@/, '');
      push({
        type: 'user-profile',
        name: hit.title,
        avatar: String(hit.profile.avatar || '🎙️'),
        username: `@${login || hit.title}`,
      });
    } else push({ type: 'feed' });
  };

  const items: Array<{ label: string; Icon: typeof Radio; screen: ScreenConfig; staff?: boolean }> = [
    { label: 'Лента', Icon: Radio, screen: { type: 'feed' } },
    { label: 'Каталог', Icon: LayoutGrid, screen: { type: 'catalog' } },
    { label: 'Экспедиции', Icon: Calendar, screen: { type: 'expeditions' } },
    { label: 'Ивенты', Icon: Ticket, screen: { type: 'events' } },
    { label: 'Настройки', Icon: Settings, screen: { type: 'settings' } },
    { label: 'Админ-панель', Icon: Shield, screen: { type: 'staff' }, staff: true },
    { label: 'Помощь', Icon: HelpCircle, screen: { type: 'help' } },
    { label: 'Audio Guesser', Icon: Dices, screen: { type: 'guessr' } },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className="px-4 pv-safe-top pb-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 relative flex-shrink-0"><BrandMark /></div>
          <h1 className="text-lg font-bold leading-tight" style={{ color: th.inkText, fontFamily: 'Klukva, "Geist Variable", serif' }}>Меню</h1>
        </div>
        <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5" style={{ background: th.cardBg }}>
          <Search size={16} color={SAGE} className="flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по звукам, людям, экспедициям…"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
            style={{ color: th.inkText }}
            aria-label="Общий поиск" />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8">
        {q.trim() ? (
          <div className="flex flex-col gap-2 pt-2">
            {!hits.length && <p className="text-xs py-10 text-center" style={{ color: SAGE }}>Ничего не нашлось</p>}
            {hits.map((hit) => (
              <button key={hit.id} type="button" onClick={() => openHit(hit)}
                className="w-full text-left rounded-3xl px-4 py-3.5" style={{ background: th.cardBg }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: SAGE }}>{SEARCH_KIND_LABEL[hit.kind]}</p>
                <p className="text-[13px] font-semibold mt-0.5" style={{ color: th.inkText }}>{hit.title}</p>
                {hit.hint && <p className="text-[11px] mt-0.5 truncate" style={{ color: OLIVE }}>{hit.hint}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            {items.filter((it) => !it.staff || isStaff).map(({ label, Icon, screen }) => (
              <motion.button key={label} type="button" whileTap={tap.cta} onClick={() => push(screen)}
                className="rounded-3xl px-4 py-5 text-left min-h-[108px] flex flex-col justify-between"
                style={{ background: th.cardBg }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}>
                  <Icon size={20} color={ACCENT} />
                </span>
                <span className="text-[14px] font-bold leading-tight" style={{ color: th.inkText }}>{label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
