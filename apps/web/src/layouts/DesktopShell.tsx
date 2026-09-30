import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell, Calendar, ChevronDown, HelpCircle, LayoutGrid, LogIn,
  MessageCircle, Radio, Search, Settings, Shield, User,
} from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import type { Sound } from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useNav, type DesktopView, type ScreenConfig } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { MapScreen } from '../screens/MapScreen';
import { CatalogSoundList, FeedScreen } from '../screens/FeedScreen';
import { GuestProfileScreen, ProfileScreen } from '../screens/ProfileScreen';
import { ScreenContent } from '../screens/stack';
import LogoApp from '@/brand/LogoApp';

const ACCENT = color.accent;
const OLIVE = color.olive;
const SAGE = color.sage;
const PANEL_W = 360;
const PANEL_GAP = 20;

const OVERLAY = new Set(['auth', 'reset-password', 'add-sound', 'record']);

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
  const { isLoggedIn, isStaff, user } = useAuth();
  const { desktopView, setDesktopView, push, stack, pop, reset } = useNav();
  const { filter, setFilter, mail, pickMode } = useData();
  const [picked, setPicked] = useState<Sound | null>(null);
  const [q, setQ] = useState(filter.tag);

  const chipBg = th.isDark ? th.lightBg : '#F4F5F7';
  const top = stack[stack.length - 1];
  const isOverlay = !!top && OVERLAY.has(top.type);
  const asideTop = isOverlay
    ? [...stack].reverse().find((s) => !OVERLAY.has(s.type)) ?? null
    : top;
  const showAside = desktopView !== 'map' || !!asideTop;
  const title = isOverlay && top ? stackTitle(top) : asideTop ? stackTitle(asideTop) : VIEW_TITLE[desktopView];
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;

  const mainNav: Array<{ id: DesktopView | 'messages'; Icon: typeof Radio; label: string }> = [
    { id: 'library', Icon: LayoutGrid, label: 'Каталог' },
    { id: 'feed', Icon: Radio, label: 'Лента' },
    { id: 'expeditions', Icon: Calendar, label: 'Экспедиции' },
    ...(isLoggedIn ? [{ id: 'messages' as const, Icon: MessageCircle, label: 'Сообщения' }] : []),
  ];

  const goView = (id: DesktopView | 'messages') => {
    if (id === 'messages') {
      if (asideTop?.type === 'messages') { reset(); return; }
      reset();
      push({ type: 'messages' });
      return;
    }
    if (desktopView === id && !asideTop) {
      setDesktopView('map');
      return;
    }
    reset();
    setDesktopView(id);
  };

  const toggleStack = (type: 'staff' | 'help' | 'settings') => {
    if (asideTop?.type === type) { reset(); return; }
    reset();
    push({ type });
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
            const on = id === 'messages' ? asideTop?.type === 'messages' : desktopView === id && !asideTop;
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
              style={{ background: asideTop?.type === 'staff' ? color.cream : 'transparent' }}>
              <Shield size={18} color={asideTop?.type === 'staff' ? ACCENT : th.isDark ? '#7A9A88' : '#C0C6BA'} />
            </motion.button>
          )}
          <div className="flex-1" />
          <motion.button title="Помощь" whileTap={tap.nav} onClick={() => toggleStack('help')}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: asideTop?.type === 'help' ? color.cream : 'transparent' }}>
            <HelpCircle size={18} color={asideTop?.type === 'help' ? ACCENT : OLIVE} />
          </motion.button>
          <motion.button title="Настройки" whileTap={tap.nav} onClick={() => toggleStack('settings')}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: asideTop?.type === 'settings' ? color.cream : 'transparent' }}>
            <Settings size={18} color={asideTop?.type === 'settings' ? ACCENT : OLIVE} />
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
                if (desktopView === 'cabinet' && !asideTop) { setDesktopView('map'); return; }
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

          <motion.div className="flex-1 min-h-0 flex p-4 lg:p-5" style={{ gap: showAside ? PANEL_GAP : 0 }}>
            <motion.aside
              initial={false}
              animate={{ width: showAside ? PANEL_W : 0, opacity: showAside ? 1 : 0 }}
              transition={spring.sheet}
              className="flex-shrink-0 min-h-0 overflow-hidden rounded-[24px]"
              style={{ background: th.phoneBg, pointerEvents: showAside ? 'auto' : 'none' }}>
              <div className="w-[360px] h-full flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  {asideTop ? (
                    <motion.div key={asideTop._id} className="h-full min-h-0" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={spring.stack}>
                      <ScreenContent screen={asideTop} onBack={pop} />
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
            <div className="relative flex-1 min-w-0 rounded-[24px] overflow-hidden" style={{ background: th.phoneBg }}>
              <MapScreen showNav={false} desktop active={picked} onActive={setPicked} />
            </div>
          </motion.div>
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
