import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Download, Heart, Headphones, MapPin, MessageCircle, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { formatPlays, type Expedition, type FeedPost, type Sound } from '@polevka/core';
import { color, pinColor, spring, tap } from '@polevka/design';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { useUi } from '../state/UiContext';
import { usePrefs } from '../state/PrefsContext';
import { ListSkeleton, NavBar, PlayPauseIcon, ScreenHeader, SoundTypeTag } from '../primitives/ui';
import { EmptyNote } from '../primitives/EmptyNote';
import { PullToRefresh } from '../primitives/PullToRefresh';
import { useScrollMemory } from '../lib/use-scroll-memory';
import BrandMark from '@/brand/BrandMark';
import { CatalogSoundList } from './CatalogScreen';
import { downloadSound } from '../lib/download-sound';
import { soundAuthor, soundCover, soundDateLabel, soundTime } from '../lib/sound-media';
import { useSoundMeta } from '../lib/audio-meta';
import { useT } from '../state/PrefsContext';
import { setExpeditionSaved } from '../lib/saved-expeditions';

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
  const t = useT();
  const [tab, setTab] = useState<FeedTab>(initialTab || 'posts');
  const scroll = useScrollMemory(`feed-${tab}`);
  const subTabs: { id: FeedTab; label: string }[] = [
    { id: 'posts', label: t('posts') },
    { id: 'catalog', label: t('catalog') },
    { id: 'expeditions', label: t('expeditions') },
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!embed && (
      <div className="relative px-4 pb-0 flex-shrink-0 overflow-hidden pv-safe-top">
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 relative flex-shrink-0"><BrandMark /></div>
            <h1 className="pv-page truncate" style={{ color: th.inkText }}>{t('feed')}</h1>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <motion.button whileTap={tap.cta} onClick={() => push({ type: 'search' })} className="w-11 h-11 rounded-2xl flex items-center justify-center cursor-pointer" style={{ background: th.cardBg }} aria-label={t('search')}>
              <Search size={16} style={{ color: OLIVE }} />
            </motion.button>
            <motion.button whileTap={tap.cta} onClick={() => push({ type: 'notifications' })} className="relative w-11 h-11 rounded-2xl flex items-center justify-center cursor-pointer" style={{ background: th.cardBg }} aria-label={t('notifications')}>
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
          <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fade} className="absolute inset-0">
            <PullToRefresh ref={scroll} className={`h-full overflow-y-auto scrollbar-none px-4 pt-2 ${showNav ? 'pb-48' : 'pb-6'}`}>
              {tab === 'posts' && <PostsList onCatalog={() => setTab('catalog')} />}
              {tab === 'catalog' && <CatalogSoundList />}
              {tab === 'expeditions' && <ExpeditionsList />}
            </PullToRefresh>
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
  const t = useT();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('feed')} onBack={onBack} right={
        <button type="button" className="w-11 h-11 rounded-2xl flex items-center justify-center cursor-pointer" aria-label={t('notifications')}
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
  const t = useT();
  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('expeditions')} onBack={onBack} />
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
  const { feed, sounds, playingId, playing, togglePlay, loading } = useData();
  const { push } = useNav();
  const { toast } = useUi();
  const th = useTh();
  const t = useT();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<FeedSort>('new');
  const sortLabel = { new: t('new'), popular: t('popular'), discussed: t('discussed') };

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

  if (loading && !feed.length && !sounds.length) {
    return <ListSkeleton rows={6} />;
  }

  if (!feed.length && !sounds.length) {
    return (
      <EmptyNote title={t('noPosts')} hint={t('noPostsHint')} actionLabel={t('openCatalog')} onAction={onCatalog} />
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5" style={{ background: th.cardBg }}>
        <Search size={16} color={SAGE} className="flex-shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchFeed')}
          className="flex-1 min-w-0 bg-transparent outline-none" style={{ color: th.inkText }}
          aria-label={t('searchFeedAria')} />
      </label>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {FEED_SORTS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSort(s.id)}
            className="pv-label h-8 px-3 rounded-full flex-shrink-0"
            style={{ background: sort === s.id ? ACCENT : th.cardBg, color: sort === s.id ? '#fff' : OLIVE }}>
            {sortLabel[s.id]}
          </button>
        ))}
      </div>
      {items.map((item) => item.kind === 'post' ? (
        <FeedPostCard key={item.id} post={item.post} onOpen={() => push({ type: 'feed-post', post: item.post })} />
      ) : (
        <MarkerFeedCard key={item.id} sound={item.sound} playing={playing && String(playingId) === String(item.sound.id)}
          onPlay={() => togglePlay(item.sound)}
          onOpen={() => push({ type: 'sound-detail', sound: item.sound })}
          onDownload={() => downloadSound(item.sound, toast)} />
      ))}
      {!items.length && <EmptyNote title={t('nothingFound')} hint={t('nothingFoundHint')} />}
    </div>
  );
}

function FeedPostCard({ post, onOpen }: { post: FeedPost; onOpen: () => void }) {
  const th = useTh();
  const t = useT();
  const images = (post.images || []).map(String).filter(Boolean);
  const author = String(post.author || 'Полёвка');
  const when = post.createdAt ? fmtWhen(String(post.createdAt)) : '';
  const text = String(post.text || '').trim();
  const comments = Array.isArray(post.comments) ? post.comments.length : 0;
  return (
    <button type="button" onClick={onOpen} className="rounded-3xl overflow-hidden shadow-sm text-left w-full cursor-pointer"
      style={{ background: th.cardBg }}>
      <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0" style={{ background: th.lightBg, color: ACCENT }}>
          {author.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{author}</p>
          {when ? <p className="pv-micro" style={{ color: SAGE }}>{when}</p> : null}
        </div>
      </div>
      {!!images.length && (
        <div className="relative aspect-[16/10]" style={{ background: th.lightBg }}>
          <img src={images[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      )}
      <div className="px-4 py-3.5">
        <p className="pv-heading" style={{ color: th.inkText }}>{String(post.title || t('kindPost'))}</p>
        {text ? <p className="pv-body mt-1.5" style={{ color: OLIVE }}>{text}</p> : null}
        <div className="flex items-center gap-1.5 mt-3" style={{ color: SAGE }}>
          <MessageCircle size={11} />
          <span className="pv-micro">{comments} {t('comments')}</span>
        </div>
      </div>
    </button>
  );
}

function MarkerFeedCard({ sound, playing, onPlay, onOpen, onDownload }: {
  sound: Sound; playing: boolean; onPlay: () => void; onOpen: () => void; onDownload: () => void;
}) {
  const th = useTh();
  const t = useT();
  const meta = useSoundMeta(sound);
  const cover = soundCover(sound);
  const author = soundAuthor(sound);
  const when = soundDateLabel(sound);
  const c = pinColor[String(sound.type)] || ACCENT;
  const likes = Number(sound.likes || 0);
  const comments = Array.isArray(sound.comments) ? sound.comments.length : 0;
  return (
    <article className="rounded-3xl p-3.5 shadow-sm" style={{ background: th.cardBg }}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: th.lightBg, color: ACCENT }}>
          {author.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{author}</p>
          {when ? <p className="pv-micro" style={{ color: SAGE }}>{when}</p> : null}
        </div>
        <SoundTypeTag type={String(sound.type || '')} />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onOpen} className="relative w-[88px] h-[88px] rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer" style={{ background: c }} aria-label={sound.title}>
          {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        </button>
        <div className="min-w-0 flex-1 flex flex-col">
          <button type="button" className="text-left cursor-pointer" onClick={onOpen}>
            <p className="pv-subtitle" style={{ color: th.inkText }}>{sound.title}</p>
            <p className="pv-caption truncate mt-1" style={{ color: OLIVE }}>
              <MapPin size={10} className="inline -mt-0.5 mr-0.5" />
              {sound.location || t('onMap')}
              {meta.durationSec > 0 ? ` · ${meta.durationLabel}` : ''}
            </p>
          </button>
          <div className="mt-auto pt-2 flex items-center gap-2.5" style={{ color: SAGE }}>
            <span className="inline-flex items-center gap-0.5" title={t('likes')}><Heart size={11} /><span className="pv-micro">{likes}</span></span>
            <span className="inline-flex items-center gap-0.5" title={t('comments')}><MessageCircle size={11} /><span className="pv-micro">{comments}</span></span>
            <span className="inline-flex items-center gap-0.5" title={t('views')}><Headphones size={11} /><span className="pv-micro">{formatPlays(sound.plays)}</span></span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={onPlay} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: c }} aria-label={playing ? t('pause') : t('listen')}>
                <PlayPauseIcon playing={playing} size={11} />
              </button>
              <button type="button" onClick={() => void onDownload()} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: 'rgba(146,179,177,0.22)' }} aria-label={t('download')}>
                <Download size={13} color={color.mist} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

type ExpCard = Expedition & {
  photo: string;
  points: number;
  subtitle: string;
  tint: string;
};

type ExpFilter = 'all' | 'photo' | 'route' | 'saved';

const EXP_TINTS = [color.mist, color.olive, color.accent, color.dark, color.sage];

function collectExpeditions(profiles: ReturnType<typeof useData>['profiles']): ExpCard[] {
  return profiles.flatMap((p, pi) => (p.sessions || []).map((s, si) => {
    const points = Number(s.n || s.route?.length || s.soundIds?.length || 0);
    const photo = Array.isArray(s.photos) && s.photos[0] ? String(s.photos[0]) : '';
    const place = String(s.place || '').trim();
    const dur = String(s.dur || '').trim();
    const subtitle = [
      place,
      points ? `${points} · ${dur || '—'}` : dur,
      s.desc || s.preview || '',
    ].filter(Boolean).join(' · ') || 'Экспедиция';
    return {
      ...s,
      title: s.title,
      desc: s.desc || 'Экспедиция',
      dur: dur || '—',
      n: points,
      emoji: s.emoji || '🗺️',
      preview: s.preview || s.desc || '',
      ownerLogin: s.ownerLogin || p.loginName,
      photo,
      points,
      subtitle,
      tint: EXP_TINTS[(pi + si) % EXP_TINTS.length],
    };
  }));
}

function SectionHead({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  const th = useTh();
  return (
    <div className="flex items-center justify-between px-0.5">
      <h2 className="pv-heading" style={{ color: th.inkText }}>{title}</h2>
      <button type="button" onClick={onAction} className="pv-caption cursor-pointer" style={{ color: SAGE }}>
        {action}
      </button>
    </div>
  );
}

function PopularTile({ exp, onOpen }: { exp: ExpCard; onOpen: () => void }) {
  const th = useTh();
  return (
    <button type="button" onClick={onOpen}
      className="flex flex-col items-center gap-2 w-[4.75rem] flex-shrink-0 cursor-pointer">
      <span className="relative w-[4.75rem] h-[4.75rem] rounded-[1.35rem] overflow-hidden shadow-sm"
        style={{ background: exp.tint }}>
        {exp.photo
          ? <img src={exp.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-2xl">{exp.emoji}</span>}
      </span>
      <span className="pv-caption text-center w-full truncate" style={{ color: th.inkText }}>{exp.title}</span>
    </button>
  );
}

function RecommendedCard({ exp, onOpen, onToggleSave, wide = false, saved }: {
  exp: ExpCard;
  onOpen: () => void;
  onToggleSave: () => void;
  wide?: boolean;
  saved: boolean;
}) {
  const th = useTh();
  const t = useT();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={`rounded-[1.75rem] p-2.5 shadow-sm cursor-pointer ${wide ? 'w-full' : 'flex-shrink-0 w-[min(78vw,17.5rem)]'}`}
      style={{ background: th.cardBg }}>
      <div className="relative aspect-[5/3.4] rounded-[1.35rem] overflow-hidden" style={{ background: exp.tint }}>
        {exp.photo
          ? <img src={exp.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-90">{exp.emoji}</span>}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          className="absolute top-2.5 right-2.5 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer shadow-sm"
          style={{ background: th.cardBg }}
          aria-label={saved ? t('expUnsave') : t('expSave')}
          aria-pressed={saved}>
          <Heart size={15} color={saved ? ACCENT : SAGE} fill={saved ? ACCENT : 'none'} />
        </button>
      </div>
      <div className="px-1.5 pt-3 pb-1.5 text-left">
        <p className="pv-subtitle leading-snug" style={{ color: th.inkText }}>{exp.title}</p>
        <p className="pv-caption mt-1 truncate" style={{ color: OLIVE }}>{exp.subtitle}</p>
      </div>
    </div>
  );
}

function ExpeditionsList() {
  const { profiles } = useData();
  const { push } = useNav();
  const { isLoggedIn } = useAuth();
  const { toast } = useUi();
  const th = useTh();
  const t = useT();
  const [q, setQ] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<ExpFilter>('all');
  const [showPopularAll, setShowPopularAll] = useState(false);
  const [showRecommendedAll, setShowRecommendedAll] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      return listIdsFromStorage();
    } catch {
      return [];
    }
  });

  const list = useMemo(() => collectExpeditions(profiles), [profiles]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const filtered = useMemo(
    () => list.filter((exp) => {
      if (filter === 'photo' && !exp.photo) return false;
      if (filter === 'route' && !(exp.route && exp.route.length >= 2)) return false;
      if (filter === 'saved' && !savedSet.has(String(exp.id || exp.title))) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return `${exp.title} ${exp.desc} ${exp.place || ''} ${exp.ownerLogin || ''} ${exp.preview || ''}`
        .toLowerCase()
        .includes(needle);
    }),
    [list, q, filter, savedSet],
  );

  const popular = useMemo(() => {
    const ranked = [...filtered].sort((a, b) => {
      const photo = Number(!!b.photo) - Number(!!a.photo);
      if (photo) return photo;
      return b.points - a.points;
    });
    return ranked;
  }, [filtered]);

  const recommended = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = Date.parse(String(a.createdAt || a.date || '')) || 0;
      const tb = Date.parse(String(b.createdAt || b.date || '')) || 0;
      if (tb !== ta) return tb - ta;
      return b.points - a.points;
    });
  }, [filtered]);

  const popularView = showPopularAll ? popular : popular.slice(0, 8);
  const recommendedView = showRecommendedAll ? recommended : recommended.slice(0, 8);
  const searching = !!q.trim();

  const open = (exp: ExpCard) => push({ type: 'expedition-detail', exp });
  const toggleSave = (exp: ExpCard) => {
    const id = String(exp.id || exp.title);
    const next = !savedSet.has(id);
    setExpeditionSaved(id, next);
    setSavedIds((prev) => (next ? [id, ...prev.filter((x) => x !== id)] : prev.filter((x) => x !== id)));
    toast(next ? t('expSaved') : t('expUnsaved'), {
      undo: () => {
        setExpeditionSaved(id, !next);
        setSavedIds((prev) => (!next ? [id, ...prev.filter((x) => x !== id)] : prev.filter((x) => x !== id)));
      },
    });
  };

  const filters: Array<{ id: ExpFilter; label: string }> = [
    { id: 'all', label: t('expFilterAll') },
    { id: 'photo', label: t('expFilterPhoto') },
    { id: 'route', label: t('expFilterRoute') },
    { id: 'saved', label: t('expFilterSaved') },
  ];

  if (!list.length) {
    return (
      <div className="flex flex-col gap-3 pt-1">
        {isLoggedIn && (
          <button type="button" onClick={() => push({ type: 'expedition-edit' })}
            className="pv-button rounded-3xl p-4 text-left shadow-sm cursor-pointer inline-flex items-center gap-2"
            style={{ background: th.lightBg, color: ACCENT }}>
            <Plus size={16} /> {t('firstExpedition')}
          </button>
        )}
        <EmptyNote title={t('expEmpty')} hint={t('expEmptyHint')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex items-center gap-2.5">
        <label className="flex-1 flex items-center gap-2 h-12 rounded-2xl px-3.5 min-w-0" style={{ background: th.cardBg }}>
          <Search size={16} color={SAGE} className="flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchExpeditions')}
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ color: th.inkText }}
            aria-label={t('searchExpeditionsAria')} />
        </label>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ background: filterOpen || filter !== 'all' ? ACCENT : th.cardBg }}
          aria-label={t('filters')}
          aria-pressed={filterOpen || filter !== 'all'}>
          <SlidersHorizontal size={16} color={filterOpen || filter !== 'all' ? '#fff' : OLIVE} />
        </button>
      </div>

      {filterOpen && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mt-2">
          {filters.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className="pv-label h-9 px-3 rounded-full flex-shrink-0 cursor-pointer"
              style={{ background: filter === f.id ? ACCENT : th.cardBg, color: filter === f.id ? '#fff' : OLIVE }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isLoggedIn && (
        <button type="button" onClick={() => push({ type: 'expedition-edit' })}
          className="pv-button rounded-3xl px-4 py-3.5 text-left shadow-sm cursor-pointer inline-flex items-center gap-2"
          style={{ background: th.lightBg, color: ACCENT }}>
          <Plus size={16} /> {t('newExpedition')}
        </button>
      )}

      {!searching && !!popularView.length && (
        <section className="flex flex-col gap-3">
          <SectionHead
            title={t('popular')}
            action={t('showAll')}
            onAction={() => setShowPopularAll((v) => !v)} />
          <div className={showPopularAll
            ? 'grid grid-cols-4 gap-x-3 gap-y-4'
            : 'flex gap-3.5 overflow-x-auto scrollbar-none pb-1'}>
            {popularView.map((exp) => (
              <PopularTile key={`pop-${exp.id || exp.title}`} exp={exp} onOpen={() => open(exp)} />
            ))}
          </div>
        </section>
      )}

      {!!recommendedView.length && (
        <section className="flex flex-col gap-3">
          <SectionHead
            title={searching ? t('expeditions') : t('recommended')}
            action={t('showAll')}
            onAction={() => setShowRecommendedAll((v) => !v)} />
          <div className={showRecommendedAll || searching
            ? 'flex flex-col gap-3'
            : 'flex gap-3 overflow-x-auto scrollbar-none pb-1 snap-x snap-mandatory'}>
            {recommendedView.map((exp) => (
              <div key={`rec-${exp.id || exp.title}`} className={showRecommendedAll || searching ? '' : 'snap-start'}>
                <RecommendedCard
                  exp={exp}
                  wide={showRecommendedAll || searching}
                  saved={savedSet.has(String(exp.id || exp.title))}
                  onOpen={() => open(exp)}
                  onToggleSave={() => toggleSave(exp)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {!filtered.length && (
        <EmptyNote title={t('nothingFound')} hint={t('nothingFoundHint')}
          actionLabel={t('resetSearch')} onAction={() => { setQ(''); setFilter('all'); }} />
      )}
    </div>
  );
}

function listIdsFromStorage() {
  try {
    const raw = localStorage.getItem('polevka_saved_expeditions');
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [] as string[];
  }
}
