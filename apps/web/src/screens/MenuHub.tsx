import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, Dices, FilePenLine, HelpCircle, LayoutGrid, Radio, Search, Settings, Shield, Ticket,
} from 'lucide-react';
import { color, tap } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import BrandMark from '@/brand/BrandMark';
import { searchAll, type SearchHit } from '../lib/search-all';
import { LanguageSwitch } from '../primitives/LanguageSwitch';
import { useT } from '../state/PrefsContext';
import { kindI18nKey } from '../lib/i18n';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

export function MenuHub() {
  const th = useTh();
  const t = useT();
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

  const items: Array<{ label: string; Icon: typeof Radio; screen: ScreenConfig; staff?: boolean; art?: string }> = [
    { label: t('feed'), Icon: Radio, screen: { type: 'feed' }, art: '/menu/feed.png' },
    { label: t('catalog'), Icon: LayoutGrid, screen: { type: 'catalog' }, art: '/menu/catalog.png' },
    { label: t('expeditions'), Icon: Calendar, screen: { type: 'expeditions' }, art: '/menu/expeditions.png' },
    { label: t('events'), Icon: Ticket, screen: { type: 'events' }, art: '/menu/events.png' },
    { label: t('drafts'), Icon: FilePenLine, screen: { type: 'drafts' } },
    { label: t('settings'), Icon: Settings, screen: { type: 'settings' } },
    { label: t('staffPanel'), Icon: Shield, screen: { type: 'staff' }, staff: true },
    { label: t('help'), Icon: HelpCircle, screen: { type: 'help' } },
    { label: t('guessr'), Icon: Dices, screen: { type: 'guessr' } },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className="px-4 pv-safe-top pb-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 relative flex-shrink-0"><BrandMark /></div>
          <h1 className="pv-heading flex-1 truncate" style={{ color: th.inkText }}>{t('menu')}</h1>
          <LanguageSwitch compact />
        </div>
        <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5" style={{ background: th.cardBg }}>
          <Search size={16} color={SAGE} className="flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchGlobal')}
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ color: th.inkText }}
            aria-label={t('searchGlobalAria')} />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8">
        {q.trim() ? (
          <div className="flex flex-col gap-2 pt-2">
            {!hits.length && <p className="pv-caption py-10 text-center" style={{ color: SAGE }}>{t('nothingFound')}</p>}
            {hits.map((hit) => (
              <button key={hit.id} type="button" onClick={() => openHit(hit)}
                className="w-full text-left rounded-3xl px-4 py-3.5" style={{ background: th.cardBg }}>
                <p className="pv-micro uppercase" style={{ color: SAGE }}>{t(kindI18nKey(hit.kind))}</p>
                <p className="pv-subtitle mt-0.5" style={{ color: th.inkText }}>{hit.title}</p>
                {hit.hint && <p className="pv-caption mt-0.5 truncate" style={{ color: OLIVE }}>{hit.hint}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            {items.filter((it) => !it.staff || isStaff).map(({ label, Icon, screen, art }) => (
              <MenuTile key={label} label={label} Icon={Icon} art={art} onClick={() => push(screen)} th={th} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuTile({ label, Icon, art, onClick, th }: {
  label: string;
  Icon: typeof Radio;
  art?: string;
  onClick: () => void;
  th: { cardBg: string; lightBg: string; inkText: string };
}) {
  const [broken, setBroken] = useState(false);
  const show = !!art && !broken;
  return (
    <motion.button type="button" whileTap={tap.cta} onClick={onClick}
      className="relative rounded-3xl px-4 py-5 text-left min-h-[128px] flex flex-col justify-between overflow-hidden"
      style={{ background: th.cardBg }}>
      {show && (
        <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
      )}
      {show && <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,26,26,0.12), rgba(26,26,26,0.52))' }} />}
      <span className="relative w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: show ? 'rgba(255,255,255,0.88)' : th.lightBg }}>
        <Icon size={20} color={ACCENT} />
      </span>
      <span className="pv-subtitle relative" style={{ color: show ? '#fff' : th.inkText }}>{label}</span>
    </motion.button>
  );
}
