import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell, Calendar, ChevronDown, Headphones, HelpCircle, LayoutGrid, LogIn,
  MessageCircle, Radio, Search, Settings, Shield, User,
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
import { PinPlayer } from '../primitives/ui';
import LogoApp from '@/brand/LogoApp';

const ACCENT = color.accent;
const OLIVE = color.olive;
const SAGE = color.sage;
const PANEL_W = 360;
const PANEL_GAP = 20;
const PLAYER_H = 228;

const OVERLAY = new Set(['auth', 'reset-password']);
const WORKSPACE = new Set([
  'add-sound', 'record', 'sound-detail',
  'expedition-detail', 'expedition-edit',
  'user-profile', 'cabinet', 'edit-profile',
]);

const VIEW_TITLE: Record<DesktopView, string> = {
  map: 'Карта',
  library: 'Каталог',
  feed: 'Лента',
  expeditions: 'Экспедиции',
  help: 'Помощь',
  staff: 'Модерация',
  cabinet: 'Профиль',
};

type ChromeMode = 'map' | 'list' | 'workspace';

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
    case 'add-sound': return s.edit ? 'Черновик' : 'Добавить звук';
    case 'record': return 'Запись';
    case 'staff': return 'Модерация';
    case 'help': return 'Поддержка';
    case 'cabinet': return 'Профиль';
    case 'edit-profile': return 'Редактировать профиль';
    case 'expedition-detail': return s.exp.title;
    case 'expedition-edit': return s.exp ? 'Экспедиция' : 'Новая экспедиция';
    case 'conversation': return s.name;
    case 'legal': return 'Документы';
    case 'guessr': return 'Угадайка';
    case 'reset-password': return 'Сброс пароля';
    case 'map-location': return 'Место на карте';
    case 'pick-location': return s.mode === 'route' ? 'Маршрут' : 'Точка на карте';
    default: return 'Полёвка';
  }
}

export function DesktopShell() {
  const th = useTh();
  const { toast } = useUi();
  const { isLoggedIn, isStaff, user } = useAuth();
  const { desktopView, setDesktopView, push, stack, pop, reset } = useNav();
  const {
    filter, setFilter, mail, pickMode,
    playing, playingId, progress, togglePlay, seek, volume, muted, setVolume, toggleMute, allSounds,
  } = useData();
  const [picked, setPicked] = useState<Sound | null>(null);
  const [q, setQ] = useState(filter.tag);

  const chipBg = th.isDark ? th.lightBg : '#F4F5F7';
  const top = stack[stack.length - 1];
  const isOverlay = !!top && OVERLAY.has(top.type);
  const vis = isOverlay
    ? [...stack].reverse().find((s) => !OVERLAY.has(s.type)) ?? null
    : top;
  const isWorkspace = (!!vis && WORKSPACE.has(vis.type)) || (desktopView === 'cabinet' && !vis);
  const isList = !isWorkspace && (desktopView !== 'map' || !!vis);
  const mode: ChromeMode = isWorkspace ? 'workspace' : isList ? 'list' : 'map';
  const title = isOverlay && top ? stackTitle(top) : vis ? stackTitle(vis) : VIEW_TITLE[desktopView];
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;

  const dockSound = picked || allSounds.find((s) => String(s.id) === String(playingId)) || null;

  useEffect(() => {
    if (vis?.type === 'sound-detail') setPicked(vis.sound);
  }, [vis]);

  const mainNav: Array<{ id: DesktopView | 'messages'; Icon: typeof Radio; label: string }> = [
    { id: 'library', Icon: LayoutGrid, label: 'Каталог' },
    { id: 'feed', Icon: Radio, label: 'Лента' },
    { id: 'expeditions', Icon: Calendar, label: 'Экспедиции' },
    ...(isLoggedIn ? [{ id: 'messages' as const, Icon: MessageCircle, label: 'Сообщения' }] : []),
  ];

  const goView = (id: DesktopView | 'messages') => {
    if (id === 'messages') {
      if (vis?.type === 'messages') { reset(); return; }
      reset();
      push({ type: 'messages' });
      return;
    }
    if (desktopView === id && !vis) {
      setDesktopView('map');
      return;
    }
    reset();
    setDesktopView(id);
  };

  const toggleStack = (type: 'staff' | 'help' | 'settings') => {
    if (vis?.type === type) { reset(); return; }
    reset();
    push({ type });
  };

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
    toast('Скачивание WAV');
  };

  return (
    <div className="relative h-full w-full p-4 lg:p-5">
      <div className="flex h-full w-full overflow-hidden rounded-[32px] shadow-[0_24px_64px_rgba(45,60,57,0.14)]"
        style={{ background: th.cardBg }}>
        <nav className="flex flex-col items-center py-5 gap-1.5 flex-shrink-0 w-[72px]" style={{ borderRight: `1px solid ${th.border}` }}>
          <button title="Полёвка" onClick={() => { reset(); setDesktopView('map'); }} className="w-11 h-11 rounded-[14px] relative mb-3 overflow-hidden shadow-sm">
            <LogoApp />
          </button>
          {mainNav.map(({ id, Icon, label }) => {
            const on = id === 'messages' ? vis?.type === 'messages' : desktopView === id && !vis;
            return (
              <motion.button key={id} title={label} whileTap={tap.nav} onClick={() => goView(id)}
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: on ? color.cream : 'transparent' }}>
                <Icon size={18} color={on ? ACCENT : th.isDark ? '#7A9A88' : '#C0C6BA'} strokeWidth={on ? 2.25 : 1.75} />
              </motion.button>
            );
          })}
          {isStaff && (
            <motion.button title="Staff" whileTap={tap.nav} onClick={() => toggleStack('staff')}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: vis?.type === 'staff' ? color.cream : 'transparent' }}>
              <Shield size={18} color={vis?.type === 'staff' ? ACCENT : th.isDark ? '#7A9A88' : '#C0C6BA'} />
            </motion.button>
          )}
          <div className="flex-1" />
          <motion.button title="Помощь" whileTap={tap.nav} onClick={() => toggleStack('help')}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: vis?.type === 'help' ? color.cream : 'transparent' }}>
            <HelpCircle size={18} color={vis?.type === 'help' ? ACCENT : OLIVE} />
          </motion.button>
          <motion.button title="Настройки" whileTap={tap.nav} onClick={() => toggleStack('settings')}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: vis?.type === 'settings' ? color.cream : 'transparent' }}>
            <Settings size={18} color={vis?.type === 'settings' ? ACCENT : OLIVE} />
          </motion.button>
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
              <button onClick={() => {
                if (desktopView === 'cabinet' && !vis) { setDesktopView('map'); return; }
                reset();
                setDesktopView('cabinet');
              }}
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

          <div className="flex-1 min-h-0 flex p-4 lg:p-5" style={{ gap: mode === 'map' ? 0 : PANEL_GAP }}>
            <motion.aside
              layout
              initial={false}
              transition={spring.sheet}
              className="min-h-0 min-w-0 overflow-hidden rounded-[24px]"
              style={{
                flex: mode === 'workspace' ? '1 1 0%' : `0 0 ${mode === 'list' ? PANEL_W : 0}px`,
                opacity: mode === 'map' ? 0 : 1,
                pointerEvents: mode === 'map' ? 'none' : 'auto',
                background: th.phoneBg,
              }}>
              <div className="h-full w-full flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  {vis ? (
                    <motion.div key={vis._id} className="h-full min-h-0" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={spring.stack}>
                      <ScreenContent screen={vis} onBack={pop} />
                    </motion.div>
                  ) : (
                    <motion.div key={desktopView} className="h-full min-h-0 overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.mount}>
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
              </div>
            </motion.aside>

            <motion.div
              layout
              className="flex flex-col min-h-0 min-w-0"
              initial={false}
              transition={spring.sheet}
              style={{ flex: mode === 'workspace' ? `0 0 ${PANEL_W}px` : '1 1 0%' }}>
              <div className="relative flex-1 min-h-0 rounded-[24px] overflow-hidden" style={{ background: th.phoneBg }}>
                <MapScreen showNav={false} desktop hidePlayer={mode === 'workspace'} active={picked} onActive={setPicked} />
              </div>
              <motion.div
                initial={false}
                animate={{
                  height: mode === 'workspace' ? PLAYER_H : 0,
                  opacity: mode === 'workspace' ? 1 : 0,
                  marginTop: mode === 'workspace' ? PANEL_GAP : 0,
                }}
                transition={spring.sheet}
                className="overflow-hidden rounded-[24px] flex-shrink-0"
                style={{ background: th.phoneBg }}>
                <div className="h-[228px] flex flex-col min-h-0">
                  {dockSound ? (
                    <PinPlayer sound={dockSound} simple
                      onClose={() => setPicked(null)}
                      playing={playing && String(playingId) === String(dockSound.id)}
                      onToggle={() => togglePlay(dockSound)}
                      progress={progress}
                      onOpen={() => { if (vis?.type !== 'sound-detail') push({ type: 'sound-detail', sound: dockSound }); }}
                      onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute}
                      onDownload={() => download(dockSound)} />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <Headphones size={18} color={SAGE} />
                      <p className="text-[11px]" style={{ color: SAGE }}>Выберите звук на карте</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isOverlay && top && (
          <motion.div
            key={top._id}
            className="absolute inset-0 z-[500] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: pickMode ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={spring.sheet}
            style={{
              background: th.phoneBg,
              visibility: pickMode ? 'hidden' : 'visible',
              pointerEvents: pickMode ? 'none' : 'auto',
            }}>
            <ScreenContent screen={top} onBack={pop} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
