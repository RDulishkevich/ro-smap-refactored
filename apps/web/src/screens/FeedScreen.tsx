import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Headphones, MapPin, MessageCircle, Search } from 'lucide-react';
import { color, pinColor, spring } from '@polevka/design';
import { formatPlays, WF, type Sound } from '@polevka/core';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { DecorBand, NavBar, PlayPauseIcon, SoundTypeTag, WaveformSVG } from '../primitives/ui';
import { CatalogFilters } from '../primitives/filters';
import Favicon from '@/brand/Favicon';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

type FeedTab = 'posts' | 'catalog' | 'expeditions';

export function FeedScreen({ showNav = true }: { showNav?: boolean }) {
  const { push } = useNav();
  const th = useTh();
  const [tab, setTab] = useState<FeedTab>('posts');
  const subTabs: { id: FeedTab; label: string }[] = [
    { id: 'posts', label: 'Публикации' },
    { id: 'catalog', label: 'Каталог' },
    { id: 'expeditions', label: 'Экспедиции' },
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <div className="relative p-5 pb-0 flex-shrink-0 overflow-hidden">
        <DecorBand opacity={th.isDark ? 0.12 : 0.15} />
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 relative flex-shrink-0"><Favicon /></div>
            <div>
              <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: SAGE }}>Полёвка</p>
              <h1 className="text-lg font-bold leading-tight" style={{ color: th.inkText, fontFamily: 'Klukva, Geologica, serif' }}>Лента</h1>
            </div>
          </div>
          <div className="flex gap-1.5">
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => push({ type: 'messages' })} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.cardBg }}>
              <MessageCircle size={14} style={{ color: OLIVE }} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => push({ type: 'notifications' })} className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: th.cardBg }}>
              <Bell size={14} style={{ color: OLIVE }} />
            </motion.button>
          </div>
        </div>
        <div className="relative flex gap-1 p-1 rounded-2xl mb-3" style={{ background: th.lightBg }}>
          {subTabs.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} className="flex-1 py-2 rounded-xl text-[11px] font-semibold relative overflow-hidden" style={{ color: tab === id ? ACCENT : OLIVE }}>
              {tab === id && <motion.div layoutId="feedPill" className="absolute inset-0 rounded-xl" style={{ background: th.cardBg, boxShadow: '0 1px 4px rgba(45,60,57,0.12)' }} transition={spring.pill} />}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => push({ type: 'search' })} className="relative flex items-center gap-2 px-3 py-2.5 rounded-2xl mb-3 w-full text-left" style={{ background: th.cardBg }}>
          <Search size={13} style={{ color: SAGE }} className="flex-shrink-0" />
          <span className="text-xs" style={{ color: th.isDark ? '#7A9A88' : '#B8C4B0' }}>Поиск звуков...</span>
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring.tab} className="absolute inset-0 overflow-y-auto scrollbar-none px-5 pb-4">
            {tab === 'posts' && <PostsList />}
            {tab === 'catalog' && <CatalogSoundList />}
            {tab === 'expeditions' && <ExpeditionsList />}
          </motion.div>
        </AnimatePresence>
      </div>
      {showNav && <div className="rounded-t-3xl shadow-lg overflow-hidden flex-shrink-0"><NavBar /></div>}
    </div>
  );
}

function PostsList() {
  const { feed } = useData();
  const th = useTh();
  const posts = feed.filter((p) => p.title || p.text);
  if (!posts.length) return <p className="text-xs py-8 text-center" style={{ color: SAGE }}>Пока нет публикаций в ленте</p>;
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
  const { filteredSounds, playingId, playing, progress, togglePlay } = useData();
  const { push } = useNav();
  const th = useTh();
  return (
    <div className="flex flex-col gap-2 pt-1">
      <CatalogFilters />
      {filteredSounds.map((item) => <SoundRow key={String(item.id)} item={item} on={playing && String(playingId) === String(item.id)} progress={playing && String(playingId) === String(item.id) ? progress : 0} onPlay={() => togglePlay(item)} onOpen={() => push({ type: 'sound-detail', sound: item })} thCard={th.cardBg} ink={th.inkText} />)}
      {!filteredSounds.length && <p className="text-xs py-8 text-center" style={{ color: SAGE }}>Нет записей</p>}
    </div>
  );
}

function SoundRow({ item, on, progress = 0, onPlay, onOpen, thCard, ink }: { item: Sound; on: boolean; progress?: number; onPlay: () => void; onOpen: () => void; thCard: string; ink: string }) {
  const c = pinColor[String(item.type)] ?? ACCENT;
  return (
    <div className="rounded-3xl p-4 shadow-sm" style={{ background: thCard }}>
      <div className="flex justify-between items-start mb-2">
        <button className="flex-1 min-w-0 text-left" onClick={onOpen}>
          <p className="text-xs font-bold truncate" style={{ color: ink }}>{item.title}</p>
          <div className="flex items-center gap-1"><MapPin size={9} style={{ color: SAGE }} /><p className="text-[10px] truncate" style={{ color: OLIVE }}>{item.location}</p></div>
        </button>
        <SoundTypeTag type={String(item.type)} />
      </div>
      <div className="flex items-center gap-3">
        <motion.button onClick={onPlay} whileTap={{ scale: 0.88 }} className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c }}>
          <PlayPauseIcon playing={on} size={12} />
        </motion.button>
        <div className="flex-1 overflow-hidden"><WaveformSVG data={WF[Number(item.wf || 0) % 4]} color={c} progress={on ? progress : 0} /></div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px]" style={{ color: ink }}>{item.duration}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5" style={{ color: SAGE }}><Headphones size={9} /><span className="text-[9px]">{formatPlays(item.plays)}</span></div>
        </div>
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
