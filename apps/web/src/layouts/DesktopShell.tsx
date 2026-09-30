import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell, Calendar, ChevronDown, HelpCircle, LayoutGrid, LogIn, LogOut,
  Map as MapIcon, MessageCircle, Radio, Search, Settings, Shield, User,
} from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import { apiPatchSound, type Sound } from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useNav, type DesktopView, type ScreenConfig } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { MapScreen } from '../screens/MapScreen';
import { CatalogSoundList, FeedScreen } from '../screens/FeedScreen';
import { GuestProfileScreen, ProfileScreen } from '../screens/ProfileScreen';
import { ScreenContent } from '../screens/stack';
import { CatalogFilters } from '../primitives/filters';
import { PinPlayer } from '../primitives/ui';
import Favicon from '@/brand/Favicon';

const ACCENT = color.accent;
const OLIVE = color.olive;
const SAGE = color.sage;

const VIEW_TITLE: Record<DesktopView, string> = {
  map: 'Карта',
  library: 'Каталог',
  feed: 'Лента',
  expeditions: 'Экспедиции',
  help: 'Помощь',
  staff: 'Модерация',
  cabinet: 'Профиль',
};

function stackTitle(s: ScreenConfig): string {
  switch (s.type) {
    case 'sound-detail': return s.sound.title;
    case 'user-profile': return s.name;
    case 'search': return 'Поиск';
    case 'settings': return 'Настройки';
    case 'events': return 'События';
    case 'auth': return 'Вход';
    case 'messages': return 'Сообщения';
    case 'notifications': return 'Уведомления';
    case 'add-sound': return 'Добавить звук';
    case 'record': return 'Запись';
    case 'staff': return 'Модерация';
    case 'help': return 'Поддержка';
    case 'cabinet': return 'Кабинет';
    case 'edit-profile': return 'Профиль';
    case 'expedition-detail': return s.exp.title;
    case 'expedition-edit': return s.exp ? 'Экспедиция' : 'Новая экспедиция';
    default: return 'Полёвка';
  }
}

export function DesktopShell() {
  const th = useTh();
  const { isLoggedIn, isStaff, logout, user } = useAuth();
  const { desktopView, setDesktopView, push, stack, pop, reset } = useNav();
  const { filter, setFilter, mail } = useData();
  const [picked, setPicked] = useState<Sound | null>(null);
  const [q, setQ] = useState(filter.tag);

  const chipBg = th.isDark ? th.lightBg : '#F4F5F7';
  const top = stack[stack.length - 1];
  const title = top ? stackTitle(top) : VIEW_TITLE[desktopView];
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;

  const mainNav: Array<{ id: DesktopView | 'messages'; Icon: typeof MapIcon; label: string; staff?: boolean }> = [
    { id: 'map', Icon: MapIcon, label: 'Карта' },
    { id: 'library', Icon: LayoutGrid, label: 'Каталог' },
    { id: 'feed', Icon: Radio, label: 'Лента' },
    { id: 'expeditions', Icon: Calendar, label: 'Экспедиции' },
    { id: 'messages', Icon: MessageCircle, label: 'Сообщения' },
  ];

  const goView = (id: DesktopView | 'messages') => {
    if (id === 'messages') { push({ type: 'messages' }); return; }
    reset();
    setDesktopView(id);
  };

  return (
    <div className="h-full w-full p-4 lg:p-5">
      <div className="flex h-full w-full overflow-hidden rounded-[32px] shadow-[0_24px_64px_rgba(45,60,57,0.14)]"
        style={{ background: th.cardBg }}>
        <nav className="flex flex-col items-center py-5 gap-1.5 flex-shrink-0 w-[72px]" style={{ borderRight: `1px solid ${th.border}` }}>
          <button title="Полёвка" onClick={() => goView('map')} className="w-10 h-10 rounded-2xl relative mb-3 overflow-hidden">
            <Favicon />
          </button>
          {mainNav.map(({ id, Icon, label }) => {
            const on = id === 'messages' ? top?.type === 'messages' : desktopView === id && !top;
            return (
              <motion.button key={id} title={label} whileTap={tap.nav} onClick={() => goView(id)}
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: on ? color.cream : 'transparent' }}>
                <Icon size={18} color={on ? ACCENT : th.isDark ? '#7A9A88' : '#C0C6BA'} strokeWidth={on ? 2.25 : 1.75} />
              </motion.button>
            );
          })}
          {isStaff && (
            <motion.button title="Staff" whileTap={tap.nav} onClick={() => push({ type: 'staff' })}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: top?.type === 'staff' ? color.cream : 'transparent' }}>
              <Shield size={18} color={top?.type === 'staff' ? ACCENT : th.isDark ? '#7A9A88' : '#C0C6BA'} />
            </motion.button>
          )}
          <div className="flex-1" />
          <motion.button title="Помощь" whileTap={tap.nav} onClick={() => push({ type: 'help' })}
            className="w-11 h-11 rounded-2xl flex items-center justify-center">
            <HelpCircle size={18} color={OLIVE} />
          </motion.button>
          <motion.button title="Настройки" whileTap={tap.nav} onClick={() => push({ type: 'settings' })}
            className="w-11 h-11 rounded-2xl flex items-center justify-center">
            <Settings size={18} color={OLIVE} />
          </motion.button>
          {isLoggedIn ? (
            <motion.button title="Выйти" whileTap={tap.nav} onClick={() => { void logout(); reset(); }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center">
              <LogOut size={18} color={OLIVE} />
            </motion.button>
          ) : (
            <motion.button title="Войти" whileTap={tap.nav} onClick={() => push({ type: 'auth' })}
              className="w-11 h-11 rounded-2xl flex items-center justify-center">
              <LogIn size={18} color={OLIVE} />
            </motion.button>
          )}
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="flex items-center gap-4 px-6 h-[72px] flex-shrink-0" style={{ borderBottom: `1px solid ${th.border}` }}>
            <h1 className="text-[22px] font-bold tracking-tight flex-shrink-0" style={{ color: th.inkText, fontFamily: 'Klukva, Geologica, serif' }}>
              {title}
            </h1>
            <div className="flex-1 flex justify-center min-w-0">
              <label className="flex items-center gap-2 w-full max-w-[420px] h-11 rounded-full px-4" style={{ background: chipBg }}>
                <Search size={15} color={SAGE} className="flex-shrink-0" />
                <input value={q} placeholder="Поиск звуков…"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none" style={{ color: th.inkText }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQ(v);
                    setFilter((f) => ({ ...f, tag: v }));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') push({ type: 'search' }); }} />
              </label>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <motion.button whileTap={tap.nav} onClick={() => push({ type: 'notifications' })}
                className="relative w-10 h-10 rounded-full flex items-center justify-center" style={{ background: chipBg }}>
                <Bell size={16} color={OLIVE} />
                {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: ACCENT }} />}
              </motion.button>
              <button onClick={() => { reset(); setDesktopView('cabinet'); }}
                className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full" style={{ background: chipBg }}>
                <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm" style={{ background: th.lightBg }}>
                  {user?.avatar && String(user.avatar).startsWith('http')
                    ? <img src={String(user.avatar)} alt="" className="w-full h-full object-cover" />
                    : (isLoggedIn ? <User size={16} color={OLIVE} /> : <LogIn size={16} color={OLIVE} />)}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-bold leading-tight" style={{ color: th.inkText }}>{user?.displayName || user?.username || 'Гость'}</p>
                  <p className="text-[10px] leading-tight" style={{ color: SAGE }}>@{user?.loginName || 'вход'}</p>
                </div>
                <ChevronDown size={14} color={SAGE} />
              </button>
            </div>
          </header>

          <div className="flex-1 min-h-0 flex gap-4 p-4 lg:p-5">
            <aside className="w-[360px] flex-shrink-0 flex flex-col min-h-0 rounded-[24px] overflow-hidden" style={{ background: th.phoneBg }}>
              <AnimatePresence mode="wait">
                {top ? (
                  <motion.div key={top._id} className="h-full min-h-0" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={spring.stack}>
                    <ScreenContent screen={top} onBack={pop} />
                  </motion.div>
                ) : (
                  <motion.div key={desktopView} className="h-full min-h-0 overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.mount}>
                    {desktopView === 'map' && <MapSidePanel sound={picked} onPick={setPicked} />}
                    {desktopView === 'library' && (
                      <div className="h-full overflow-y-auto p-4 scrollbar-none">
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-3 text-center" style={{ color: SAGE }}>Каталог</p>
                        <CatalogSoundList />
                      </div>
                    )}
                    {desktopView === 'feed' && <FeedScreen showNav={false} embed />}
                    {desktopView === 'expeditions' && <FeedScreen showNav={false} embed initialTab="expeditions" />}
                    {desktopView === 'cabinet' && (isLoggedIn ? <ProfileScreen showNav={false} /> : <GuestProfileScreen showNav={false} />)}
                  </motion.div>
                )}
              </AnimatePresence>
            </aside>
            <div className="relative flex-1 min-w-0 rounded-[24px] overflow-hidden" style={{ background: th.phoneBg }}>
              <MapScreen showNav={false} desktop active={picked} onActive={setPicked} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapSidePanel({ sound, onPick }: { sound: Sound | null; onPick: (s: Sound | null) => void }) {
  const th = useTh();
  const { push } = useNav();
  const { toast } = useUi();
  const {
    filteredSounds, playing, playingId, progress, togglePlay, seek, volume, muted, setVolume, toggleMute,
  } = useData();
  const more = filteredSounds.filter((s) => String(s.id) !== String(sound?.id)).slice(0, 3);

  const download = (s: Sound) => {
    if (!s.url) { toast('Нет файла'); return; }
    const a = document.createElement('a');
    a.href = String(s.url);
    a.download = `${s.title || 'sound'}.wav`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    void apiPatchSound(s.id, { incDownloads: 1 }).catch(() => {});
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-center" style={{ color: SAGE }}>Карточка</p>
      {sound ? (
        <div className="rounded-3xl overflow-hidden" style={{ background: th.cardBg }}>
          <PinPlayer sound={sound} simple playing={playing && String(playingId) === String(sound.id)}
            onToggle={() => togglePlay(sound)} progress={progress}
            onOpen={() => push({ type: 'sound-detail', sound })}
            onClose={() => onPick(null)}
            onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute}
            onDownload={() => download(sound)} />
          <div className="px-4 pb-4">
            <button className="w-full py-3 rounded-full text-sm font-bold text-white" style={{ background: ACCENT }}
              onClick={() => push({ type: 'sound-detail', sound })}>Открыть запись</button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl p-4" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-1" style={{ color: th.inkText }}>Выберите метку</p>
          <p className="text-[10px] mb-3" style={{ color: OLIVE }}>Клик по пину на карте откроет плеер и карточку здесь — как деталь в макете.</p>
          <CatalogFilters />
        </div>
      )}
      {!!more.length && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-semibold" style={{ color: th.inkText }}>Ещё записи</p>
            <button className="text-[10px] font-semibold" style={{ color: ACCENT }} onClick={() => push({ type: 'search' })}>все</button>
          </div>
          {more.map((s) => (
            <button key={String(s.id)} onClick={() => onPick(s)}
              className="w-full text-left rounded-2xl overflow-hidden mb-2" style={{ background: th.cardBg }}>
              <p className="text-xs font-bold px-3 pt-3 truncate" style={{ color: th.inkText }}>{s.title}</p>
              <p className="text-[10px] px-3 pb-3" style={{ color: SAGE }}>{s.location}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
