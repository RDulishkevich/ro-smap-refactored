import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Headphones, MessageCircle, Search } from 'lucide-react';
import { color, pinColor, spring, tap } from '@polevka/design';
import { formatPlays, type Sound } from '@polevka/core';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { NavBar, PlayPauseIcon, SoundTypeTag } from '../primitives/ui';
import { CatalogFilters } from '../primitives/filters';
import BrandMark from '@/brand/BrandMark';
import { parseDurationLabel } from '../lib/waveform';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

function FeedUnreadDot() {
  const { mail } = useData();
  const { user } = useAuth();
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;
  if (!unread) return null;
  return <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full" style={{ background: ACCENT }} />;
}

type FeedTab = 'posts' | 'catalog' | 'expeditions';

export function FeedScreen({ showNav = true, embed = false, initialTab }: { showNav?: boolean; embed?: boolean; initialTab?: FeedTab }) {
  const { push } = useNav();
  const th = useTh();
  const [tab, setTab] = useState<FeedTab>(initialTab || 'posts');
  const subTabs: { id: FeedTab; label: string }[] = [
    { id: 'posts', label: 'Публикации' },
    { id: 'catalog', label: 'Каталог' },
    { id: 'expeditions', label: 'Экспедиции' },
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!embed && (
      <div className="relative px-4 pb-0 flex-shrink-0 overflow-hidden pv-safe-top">
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 relative flex-shrink-0"><BrandMark /></div>
            <h1 className="text-lg font-bold leading-tight truncate" style={{ color: th.inkText, fontFamily: 'Klukva, "Geist Variable", serif' }}>Лента</h1>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <motion.button whileTap={tap.cta} onClick={() => push({ type: 'search' })} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.cardBg }} aria-label="Поиск">
              <Search size={16} style={{ color: OLIVE }} />
            </motion.button>
            <motion.button whileTap={tap.cta} onClick={() => push({ type: 'messages' })} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.cardBg }} aria-label="Сообщения">
              <MessageCircle size={16} style={{ color: OLIVE }} />
            </motion.button>
            <motion.button whileTap={tap.cta} onClick={() => push({ type: 'notifications' })} className="relative w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.cardBg }} aria-label="Уведомления">
              <Bell size={16} style={{ color: OLIVE }} />
              <FeedUnreadDot />
            </motion.button>
          </div>
        </div>
        <div className="relative flex gap-1 p-1 rounded-2xl mb-2" style={{ background: th.lightBg }}>
          {subTabs.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold" style={{ background: tab === id ? th.cardBg : 'transparent', color: tab === id ? ACCENT : OLIVE, boxShadow: tab === id ? '0 1px 4px rgba(45,60,57,0.08)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fade} className="absolute inset-0 overflow-y-auto scrollbar-none px-4 pb-48 pt-2">
            {tab === 'posts' && <PostsList onCatalog={() => setTab('catalog')} />}
            {tab === 'catalog' && <CatalogSoundList />}
            {tab === 'expeditions' && <ExpeditionsList />}
          </motion.div>
        </AnimatePresence>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}

function PostsList({ onCatalog }: { onCatalog: () => void }) {
  const { feed } = useData();
  const th = useTh();
  const posts = feed.filter((p) => p.title || p.text);
  if (!posts.length) {
    return (
      <div className="py-10 px-2 text-center">
        <p className="text-xs mb-4" style={{ color: SAGE }}>Пока нет публикаций — слушайте записи в каталоге</p>
        <button type="button" onClick={onCatalog} className="h-10 px-4 rounded-full text-[12px] font-semibold" style={{ background: th.cardBg, color: ACCENT }}>
          Открыть каталог
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 pt-1">
      {posts.map((p) => (
        <div key={String(p.id || p.title)} className="rounded-3xl p-4 shadow-sm" style={{ background: th.cardBg }}>
          <p className="text-[10px] mb-1" style={{ color: SAGE }}>{String(p.author || 'Полёвка')} · {String(p.createdAt || '')}</p>
          <p className="text-sm font-bold mb-1" style={{ color: th.inkText }}>{String(p.title || 'Запись')}</p>
          <p className="text-xs leading-relaxed" style={{ color: OLIVE }}>{String(p.text || '').slice(0, 220)}</p>
        </div>
      ))}
    </div>
  );
}

export function CatalogSoundList() {
  const { filteredSounds, playingId, playing, togglePlay } = useData();
  const { push } = useNav();
  const th = useTh();
  return (
    <div className="flex flex-col gap-2 pt-1">
      <CatalogFilters />
      {filteredSounds.map((item) => <SoundRow key={String(item.id)} item={item} on={playing && String(playingId) === String(item.id)} onPlay={() => togglePlay(item)} onOpen={() => push({ type: 'sound-detail', sound: item })} thCard={th.cardBg} ink={th.inkText} />)}
      {!filteredSounds.length && <p className="text-xs py-8 text-center" style={{ color: SAGE }}>Нет записей</p>}
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

function ExpeditionsList() {
  const { profiles } = useData();
  const { push } = useNav();
  const { isLoggedIn } = useAuth();
  const th = useTh();
  const fromProfiles = profiles.flatMap((p) => (p.sessions || []).map((s) => ({
    ...s,
    title: s.title,
    desc: s.desc || 'Экспедиция',
    dur: s.dur || '—',
    n: s.n || (s.route?.length || 0),
    emoji: s.emoji || '🗺️',
    preview: s.preview || s.desc || '',
    ownerLogin: s.ownerLogin || p.loginName,
  })));
  const list = fromProfiles;
  return (
    <div className="flex flex-col gap-3 pt-1">
      {isLoggedIn && (
        <button onClick={() => push({ type: 'expedition-edit' })} className="rounded-3xl p-4 text-left shadow-sm text-xs font-semibold" style={{ background: th.lightBg, color: ACCENT }}>
          + Новая экспедиция
        </button>
      )}
      {list.map((exp) => (
        <button key={String(exp.id || exp.title)} onClick={() => push({ type: 'expedition-detail', exp })} className="rounded-3xl p-4 text-left shadow-sm" style={{ background: th.cardBg }}>
          <div className="text-2xl mb-2">{exp.emoji}</div>
          <p className="text-sm font-bold" style={{ color: th.inkText }}>{exp.title}</p>
          <p className="text-[10px]" style={{ color: OLIVE }}>{exp.desc} · {exp.dur}</p>
        </button>
      ))}
      {!list.length && <p className="text-xs py-8 text-center" style={{ color: SAGE }}>Пока нет экспедиций</p>}
    </div>
  );
}
