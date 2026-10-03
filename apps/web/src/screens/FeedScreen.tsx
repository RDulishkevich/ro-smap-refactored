import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Download, Headphones, MapPin, Search } from 'lucide-react';
import { formatPlays, type FeedPost, type Sound } from '@polevka/core';
import { color, pinColor, spring, tap } from '@polevka/design';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useUi } from '../state/UiContext';
import { usePrefs } from '../state/PrefsContext';
import { NavBar, PlayPauseIcon, ScreenHeader, SoundTypeTag } from '../primitives/ui';
import BrandMark from '@/brand/BrandMark';
import { CatalogSoundList } from './CatalogScreen';
import { downloadSound } from '../lib/download-sound';
import { soundAuthor, soundCover, soundTime } from '../lib/sound-media';
import { parseDurationLabel } from '../lib/waveform';

export { CatalogSoundList } from './CatalogScreen';
export { CatalogScreen as CatalogPage } from './CatalogScreen';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

function FeedUnreadDot() {
  const { mail } = useData();
  const { user } = useAuth();
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;
  const { prefs } = usePrefs();
  if (!prefs.notifyInApp || !unread) return null;
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

export function FeedPage({ onBack }: { onBack: () => void }) {
  const { push } = useNav();
  const th = useTh();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Лента" onBack={onBack} right={
        <button type="button" className="w-11 h-11 rounded-2xl flex items-center justify-center" aria-label="Уведомления"
          style={{ background: th.lightBg }}
          onClick={() => push({ type: 'notifications' })}>
          <Bell size={16} color={OLIVE} />
        </button>
      } />
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8 pt-2">
        <PostsList onCatalog={() => push({ type: 'catalog' })} />
      </div>
    </div>
  );
}

export function ExpeditionsPage({ onBack }: { onBack: () => void }) {
  const th = useTh();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Экспедиции" onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8 pt-2">
        <ExpeditionsList />
      </div>
    </div>
  );
}

type FeedSort = 'new' | 'popular' | 'discussed';
type FeedEntry =
  | { kind: 'post'; id: string; at: number; score: number; talk: number; post: FeedPost }
  | { kind: 'marker'; id: string; at: number; score: number; talk: number; sound: Sound };

const FEED_SORTS: Array<{ id: FeedSort; label: string }> = [
  { id: 'new', label: 'Новые' },
  { id: 'popular', label: 'Популярные' },
  { id: 'discussed', label: 'Обсуждают' },
];

function fmtWhen(raw: string) {
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return raw;
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function postTime(p: FeedPost) {
  const t = Date.parse(String(p.createdAt || ''));
  return Number.isNaN(t) ? 0 : t;
}

function PostsList({ onCatalog }: { onCatalog: () => void }) {
  const { feed, sounds, playingId, playing, togglePlay } = useData();
  const { push } = useNav();
  const { toast } = useUi();
  const th = useTh();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<FeedSort>('new');

  const items = useMemo(() => {
    const posts: FeedEntry[] = feed.filter((p) => p.title || p.text).map((p) => ({
      kind: 'post' as const,
      id: `post-${p.id || p.title}`,
      at: postTime(p),
      score: Number(p.likes || (p as { plays?: number }).plays || 0),
      talk: Array.isArray(p.comments) ? p.comments.length : 0,
      post: p,
    }));
    const markers: FeedEntry[] = sounds.map((s) => ({
      kind: 'marker' as const,
      id: `marker-${s.id}`,
      at: soundTime(s),
      score: Number(s.plays || 0) + Number(s.likes || 0) * 4,
      talk: Array.isArray(s.comments) ? s.comments.length : 0,
      sound: s,
    }));
    const needle = q.trim().toLowerCase();
    const all = [...posts, ...markers].filter((item) => {
      if (!needle) return true;
      if (item.kind === 'post') {
        return `${item.post.title} ${item.post.text} ${item.post.author}`.toLowerCase().includes(needle);
      }
      return `${item.sound.title} ${item.sound.location} ${soundAuthor(item.sound)}`.toLowerCase().includes(needle);
    });
    all.sort((a, b) => {
      if (sort === 'popular') return b.score - a.score;
      if (sort === 'discussed') return b.talk - a.talk;
      return b.at - a.at;
    });
    return all;
  }, [feed, sounds, q, sort]);

  if (!feed.length && !sounds.length) {
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
      <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5" style={{ background: th.cardBg }}>
        <Search size={16} color={SAGE} className="flex-shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по ленте…"
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none" style={{ color: th.inkText }}
          aria-label="Поиск по ленте" />
      </label>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {FEED_SORTS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSort(s.id)}
            className="h-8 px-3 rounded-full text-[11px] font-semibold flex-shrink-0"
            style={{ background: sort === s.id ? ACCENT : th.cardBg, color: sort === s.id ? '#fff' : OLIVE }}>
            {s.label}
          </button>
        ))}
      </div>
      {items.map((item) => item.kind === 'post' ? (
        <article key={item.id} className="rounded-3xl p-4 shadow-sm" style={{ background: th.cardBg }}>
          <p className="text-[10px] mb-1" style={{ color: SAGE }}>{String(item.post.author || 'Полёвка')}{item.post.createdAt ? ` · ${fmtWhen(String(item.post.createdAt))}` : ''}</p>
          <p className="text-sm font-bold mb-1" style={{ color: th.inkText }}>{String(item.post.title || 'Запись')}</p>
          <p className="text-xs leading-relaxed" style={{ color: OLIVE }}>{String(item.post.text || '').slice(0, 220)}</p>
        </article>
      ) : (
        <MarkerFeedCard key={item.id} sound={item.sound} playing={playing && String(playingId) === String(item.sound.id)}
          onPlay={() => togglePlay(item.sound)}
          onOpen={() => push({ type: 'sound-detail', sound: item.sound })}
          onDownload={() => downloadSound(item.sound, toast)} />
      ))}
      {!items.length && <p className="text-xs py-8 text-center" style={{ color: SAGE }}>Ничего не нашлось</p>}
    </div>
  );
}

function MarkerFeedCard({ sound, playing, onPlay, onOpen, onDownload }: {
  sound: Sound; playing: boolean; onPlay: () => void; onOpen: () => void; onDownload: () => void;
}) {
  const th = useTh();
  const cover = soundCover(sound);
  const author = soundAuthor(sound);
  const c = pinColor[String(sound.type)] || ACCENT;
  return (
    <article className="rounded-3xl overflow-hidden shadow-sm" style={{ background: th.cardBg }}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative h-28" style={{ background: c }}>
          {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(26,26,26,0.45))' }} />
          <span className="absolute left-3 bottom-2 text-[10px] font-semibold text-white">{author} создал метку</span>
        </div>
      </button>
      <div className="p-3.5 flex items-center gap-3">
        <button type="button" onClick={onPlay} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c }} aria-label={playing ? 'Пауза' : 'Слушать'}>
          <PlayPauseIcon playing={playing} size={12} />
        </button>
        <button type="button" className="flex-1 min-w-0 text-left" onClick={onOpen}>
          <p className="text-[13px] font-semibold truncate" style={{ color: th.inkText }}>{sound.title}</p>
          <p className="text-[11px] truncate mt-0.5" style={{ color: OLIVE }}>
            <MapPin size={10} className="inline -mt-0.5 mr-0.5" />
            {sound.location || 'На карте'}
            {parseDurationLabel(sound.duration) > 0 ? ` · ${sound.duration}` : ''}
          </p>
        </button>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SoundTypeTag type={String(sound.type || '')} />
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5" style={{ color: SAGE }}><Headphones size={9} /><span className="text-[9px]">{formatPlays(sound.plays)}</span></span>
            <button type="button" onClick={onDownload} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(146,179,177,0.22)' }} aria-label="Скачать">
              <Download size={13} color={color.mist} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ExpeditionsList() {
  const { profiles } = useData();
  const { push } = useNav();
  const { isLoggedIn } = useAuth();
  const th = useTh();
  const list = profiles.flatMap((p) => (p.sessions || []).map((s) => ({
    ...s,
    title: s.title,
    desc: s.desc || 'Экспедиция',
    dur: s.dur || '—',
    n: s.n || (s.route?.length || 0),
    emoji: s.emoji || '🗺️',
    preview: s.preview || s.desc || '',
    ownerLogin: s.ownerLogin || p.loginName,
    photo: Array.isArray(s.photos) && s.photos[0] ? String(s.photos[0]) : '',
  })));
  const tints = [color.mist, color.olive, color.accent, color.dark, color.sage];
  return (
    <div className="flex flex-col gap-3 pt-1">
      {isLoggedIn && (
        <button onClick={() => push({ type: 'expedition-edit' })} className="rounded-3xl p-4 text-left shadow-sm text-xs font-semibold" style={{ background: th.lightBg, color: ACCENT }}>
          + Новая экспедиция
        </button>
      )}
      {list.map((exp, i) => {
        const tint = tints[i % tints.length];
        return (
          <button key={String(exp.id || exp.title)} onClick={() => push({ type: 'expedition-detail', exp })}
            className="relative rounded-3xl overflow-hidden text-left h-[8.25rem] shadow-sm">
            <span className="absolute inset-0" style={{ background: tint }} />
            {exp.photo && <img src={exp.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,26,26,0.05), rgba(26,26,26,0.62))' }} />
            <span className="absolute left-3.5 right-3.5 bottom-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{exp.emoji} · {exp.n} точек · {exp.dur}</span>
              <span className="block text-[16px] font-bold text-white leading-tight mt-0.5">{exp.title}</span>
              <span className="block text-[11px] text-white/80 truncate mt-0.5">{exp.desc}</span>
            </span>
          </button>
        );
      })}
      {!list.length && (
        <div className="relative rounded-3xl overflow-hidden h-[8.25rem]" style={{ background: color.mist }}>
          <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,26,26,0.05), rgba(26,26,26,0.45))' }} />
          <span className="absolute left-3.5 right-3.5 bottom-3.5 text-white">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">Скоро</span>
            <span className="block text-[16px] font-bold leading-tight mt-0.5">Первая экспедиция</span>
            <span className="block text-[11px] text-white/80 mt-0.5">Маршруты и общие записи появятся здесь баннерами</span>
          </span>
        </div>
      )}
    </div>
  );
}
