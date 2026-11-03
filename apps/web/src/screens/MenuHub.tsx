import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Dices, FilePenLine, HelpCircle, LayoutGrid, Radio, Search, Settings, Ticket,
} from 'lucide-react';
import { color, tap } from '@polevka/design';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import BrandMark from '@/brand/BrandMark';
import { searchAll, type SearchHit } from '../lib/search-all';
import { EmptyNote } from '../primitives/EmptyNote';
import { PullToRefresh } from '../primitives/PullToRefresh';
import { useScrollMemory } from '../lib/use-scroll-memory';
import { useT } from '../state/PrefsContext';
import { kindI18nKey } from '../lib/i18n';
import { stock } from '../lib/stock';

const ACCENT = color.accent;

export function MenuHub() {
  const th = useTh();
  const t = useT();
  const { push } = useNav();
  const { sounds, profiles, events, feed } = useData();
  const [q, setQ] = useState('');
  const scroll = useScrollMemory('menu');
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

  const featured = { label: t('catalog'), Icon: LayoutGrid, screen: { type: 'catalog' } as ScreenConfig, art: stock.catalog, paper: true };
  const explore: Array<{ label: string; Icon: typeof Radio; screen: ScreenConfig; art: string; paper?: boolean }> = [
    { label: t('expeditions'), Icon: Calendar, screen: { type: 'expeditions' }, art: stock.expeditions, paper: true },
    { label: t('feed'), Icon: Radio, screen: { type: 'feed' }, art: stock.feed, paper: true },
    { label: t('events'), Icon: Ticket, screen: { type: 'events' }, art: stock.events, paper: true },
    { label: t('guessr'), Icon: Dices, screen: { type: 'guessr' }, art: stock.guessr, paper: true },
  ];
  const tools: Array<{ label: string; Icon: typeof Radio; screen: ScreenConfig }> = [
    { label: t('drafts'), Icon: FilePenLine, screen: { type: 'drafts' } },
    { label: t('settings'), Icon: Settings, screen: { type: 'settings' } },
    { label: t('help'), Icon: HelpCircle, screen: { type: 'help' } },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className="px-4 pv-safe-top pb-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 relative flex-shrink-0"><BrandMark /></div>
          <h1 className="pv-page flex-1 truncate" style={{ color: th.inkText }}>{t('menu')}</h1>
        </div>
        <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5" style={{ background: th.cardBg }}>
          <Search size={16} color={th.soft} className="flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchGlobal')}
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ color: th.inkText }}
            aria-label={t('searchGlobalAria')} />
        </label>
      </div>
      <PullToRefresh ref={scroll} className="flex-1 overflow-y-auto scrollbar-none px-4 pb-40">
        {q.trim() ? (
          <div className="flex flex-col gap-2 pt-2">
            {!hits.length && <EmptyNote title={t('nothingFound')} hint={t('nothingFoundHint')} />}
            {hits.map((hit) => (
              <button key={hit.id} type="button" onClick={() => openHit(hit)}
                className="w-full text-left rounded-3xl px-4 py-3.5 min-h-11" style={{ background: th.cardBg }}>
                <p className="pv-micro" style={{ color: th.soft }}>{t(kindI18nKey(hit.kind))}</p>
                <p className="pv-subtitle mt-0.5" style={{ color: th.inkText }}>{hit.title}</p>
                {hit.hint && <p className="pv-caption mt-0.5 truncate" style={{ color: th.muted }}>{hit.hint}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pt-2">
            <MenuTile
              label={featured.label}
              Icon={featured.Icon}
              art={featured.art}
              paper={featured.paper}
              tall
              onClick={() => push(featured.screen)}
              th={th}
            />
            <div className="grid grid-cols-2 gap-2.5">
              {explore.map(({ label, Icon, screen, art, paper }) => (
                <MenuTile key={label} label={label} Icon={Icon} art={art} paper={paper} onClick={() => push(screen)} th={th} />
              ))}
            </div>
            <div className="flex flex-col gap-1.5 pt-1">
              {tools.map(({ label, Icon, screen }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => push(screen)}
                  className="w-full min-h-14 rounded-2xl px-3 flex items-center gap-3 text-left"
                  style={{ background: th.cardBg }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: th.lightBg }}>
                    <Icon size={18} color={ACCENT} />
                  </span>
                  <span className="pv-subtitle" style={{ color: th.inkText }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

function MenuTile({ label, Icon, art, paper, tall, onClick, th }: {
  label: string;
  Icon: typeof Radio;
  art?: string;
  paper?: boolean;
  tall?: boolean;
  onClick: () => void;
  th: { cardBg: string; lightBg: string; inkText: string };
}) {
  const [broken, setBroken] = useState(false);
  const show = !!art && !broken;
  const onPaper = show && paper;
  return (
    <motion.button type="button" whileTap={tap.cta} onClick={onClick}
      className={`relative rounded-3xl px-4 py-5 text-left flex flex-col overflow-hidden ${tall ? 'min-h-[152px]' : 'min-h-[128px]'} ${show ? 'justify-end' : 'justify-between'}`}
      style={{ background: th.cardBg }}>
      {show && (
        <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
      )}
      {show && !onPaper && (
        <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,26,26,0.08), rgba(26,26,26,0.55))' }} />
      )}
      {onPaper && (
        <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(247,245,239,0) 42%, rgba(247,245,239,0.92) 100%)' }} />
      )}
      {!show && (
        <span className="relative w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}>
          <Icon size={20} color={ACCENT} />
        </span>
      )}
      <span className="pv-subtitle relative" style={{ color: onPaper ? '#1A1A1A' : show ? '#fff' : th.inkText }}>{label}</span>
    </motion.button>
  );
}
