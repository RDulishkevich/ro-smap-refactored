import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell, Calendar, ChevronDown, HelpCircle, LayoutGrid, LogIn,
  MessageCircle, Radio, Search, Settings, Shield, User,
} from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import type { Sound } from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useNav, type DesktopView } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useData } from '../state/DataContext';
import { useUi } from '../state/UiContext';
import { usePrefs, useT } from '../state/PrefsContext';
import { MapScreen } from '../screens/MapScreen';
import { CatalogSoundList, FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ScreenContent } from '../screens/stack';
import { StaffScreen } from '../screens/StaffScreen';
import { PinPlayer } from '../primitives/ui';
import { HoverMenu } from '../primitives/HoverMenu';
import BrandMark from '@/brand/BrandMark';
import { RailBannerCarousel } from '../primitives/RailBannerCarousel';
import { downloadSound } from '../lib/download-sound';
import { LanguageSwitch } from '../primitives/LanguageSwitch';

const ACCENT = color.accent;
const OLIVE = color.olive;
const SAGE = color.sage;
const RAIL_W = 216;
const LIST_W = 360;
const SIDE_W = 400;
const PANEL_GAP = 12;

const OVERLAY = new Set(['auth', 'reset-password']);
const WORKSPACE = new Set([
  'add-sound', 'record', 'sound-detail',
  'expedition-detail', 'expedition-edit',
  'user-profile', 'cabinet', 'edit-profile',
  'staff', 'legal', 'help', 'messages', 'conversation', 'settings',
  'feed-post', 'notifications', 'events',
]);
const VIEW_WORKSPACE = new Set<DesktopView>(['library', 'feed', 'expeditions', 'cabinet', 'staff']);

type ChromeMode = 'map' | 'list' | 'workspace';

function RailItem({
  label, Icon, on, onClick, ink, mute,
}: {
  label: string;
  Icon: typeof Radio;
  on: boolean;
  onClick: () => void;
  ink: string;
  mute: string;
}) {
  return (
    <motion.button whileTap={tap.cta} onClick={onClick}
      className="flex items-center gap-3 w-full h-11 px-3 rounded-2xl text-left"
      style={{ background: on ? color.cream : 'transparent' }}>
      <Icon size={18} color={on ? ACCENT : mute} strokeWidth={on ? 2.25 : 1.75} className="flex-shrink-0" />
      <span className="text-[13px] font-semibold truncate" style={{ color: on ? ink : mute }}>{label}</span>
    </motion.button>
  );
}

function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const th = useTh();
  const t = useT();
  const { mail, markNotificationsRead } = useData();
  const { user } = useAuth();
  const box = mail.find((b) => b.loginName === user?.loginName);
  const list = (box?.notifications || []) as Array<{ fromName?: string; fromId?: string; text?: string; date?: string; read?: boolean }>;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { void markNotificationsRead(); }, [markNotificationsRead]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={spring.fade}
      className="absolute right-0 top-[calc(100%+10px)] z-[520] w-[320px] rounded-3xl shadow-[0_16px_40px_rgba(45,60,57,0.18)] overflow-hidden"
      style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${th.border}` }}>
        <p className="text-sm font-bold" style={{ color: th.inkText }}>{t('notifications')}</p>
        <span className="text-[10px]" style={{ color: SAGE }}>{list.length ? `${list.length}` : ''}</span>
      </div>
      <div className="max-h-[360px] overflow-y-auto scrollbar-none p-2.5 flex flex-col gap-1.5">
        {list.length === 0 && (
          <p className="text-xs py-8 text-center" style={{ color: SAGE }}>{t('quiet')}</p>
        )}
        {list.map((n, i) => (
          <div key={i} className="rounded-2xl px-3 py-2.5" style={{ background: th.phoneBg }}>
            <p className="text-xs font-semibold" style={{ color: th.inkText }}>{n.fromName || n.fromId || 'Полёвка'}</p>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: OLIVE }}>{n.text}</p>
            {n.date && <p className="text-[9px] mt-1" style={{ color: SAGE }}>{n.date}</p>}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function DesktopShell() {
  const th = useTh();
  const { toast } = useUi();
  const { prefs } = usePrefs();
  const { isLoggedIn, isStaff, user, logout } = useAuth();
  const { desktopView, setDesktopView, push, stack, pop, reset } = useNav();
  const {
    filter, setFilter, mail, pickMode,
    playing, playingId, progress, togglePlay, seek, volume, muted, setVolume, toggleMute, allSounds,
    focused, setFocused,
  } = useData();
  const t = useT();
  const [q, setQ] = useState(filter.tag);
  const [notifyOpen, setNotifyOpen] = useState(false);

  const chipBg = th.isDark ? th.lightBg : '#F4F5F7';
  const top = stack[stack.length - 1];
  const isOverlay = !!top && OVERLAY.has(top.type);
  const vis = isOverlay
    ? [...stack].reverse().find((s) => !OVERLAY.has(s.type)) ?? null
    : top;
  const isWorkspace = (!!vis && WORKSPACE.has(vis.type)) || (!vis && VIEW_WORKSPACE.has(desktopView));
  const isList = !isWorkspace && (desktopView !== 'map' || !!vis);
  const mode: ChromeMode = isWorkspace ? 'workspace' : isList ? 'list' : 'map';
  const unread = (mail.find((b) => b.loginName === user?.loginName)?.notifications || [])
    .filter((n) => !(n as { read?: boolean }).read).length;

  const dockSound = focused || allSounds.find((s) => String(s.id) === String(playingId)) || null;
  const mute = th.isDark ? '#7A9A88' : '#B8BFC0';
  const year = new Date().getFullYear();

  useEffect(() => {
    if (vis?.type === 'sound-detail') setFocused(vis.sound);
  }, [vis]);

  const mainNav: Array<{ id: DesktopView | 'messages'; Icon: typeof Radio; label: string }> = [
    { id: 'library', Icon: LayoutGrid, label: t('catalog') },
    { id: 'feed', Icon: Radio, label: t('feed') },
    { id: 'expeditions', Icon: Calendar, label: t('expeditions') },
    ...(isLoggedIn ? [{ id: 'messages' as const, Icon: MessageCircle, label: t('messages') }] : []),
    ...(isStaff ? [{ id: 'staff' as const, Icon: Shield, label: t('staff') }] : []),
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

  const toggleStack = (type: 'help' | 'settings') => {
    if (vis?.type === type) { reset(); return; }
    reset();
    push({ type });
  };

  const openLegal = (doc: 'privacy' | 'terms' | 'publish') => {
    if (vis?.type === 'legal' && vis.doc === doc) return;
    push({ type: 'legal', doc });
  };

  const download = (s: Sound) => downloadSound(s, toast);

  return (
    <div className="relative h-full w-full p-4 lg:p-5">
      <div className="flex h-full w-full overflow-hidden rounded-[32px] shadow-[0_24px_64px_rgba(45,60,57,0.14)]"
        style={{ background: th.cardBg }}>
        <nav className="flex flex-col py-5 px-2.5 flex-shrink-0" style={{ width: RAIL_W, borderRight: `1px solid ${th.border}` }}>
          <button onClick={() => { reset(); setDesktopView('map'); }}
            className="flex items-center gap-3 px-2 mb-5 text-left w-full">
            <div className="w-14 h-14 flex-shrink-0 relative"><BrandMark /></div>
            <div className="min-w-0">
              <p className="text-[22px] font-extrabold tracking-wide leading-none" style={{ color: th.inkText, fontFamily: 'Klukva, "Geist Variable", serif' }}>ПОЛЁВКА</p>
            </div>
          </button>
          <div className="flex flex-col gap-0.5">
            {mainNav.map(({ id, Icon, label }) => {
              const on = id === 'messages' ? vis?.type === 'messages' : desktopView === id && !vis;
              return <RailItem key={id} label={label} Icon={Icon} on={on} onClick={() => goView(id)} ink={th.inkText} mute={mute} />;
            })}
          </div>
          <RailBannerCarousel />
          <div className="flex flex-col gap-0.5 mb-3">
            <RailItem label={t('help')} Icon={HelpCircle} on={vis?.type === 'help'} onClick={() => toggleStack('help')} ink={th.inkText} mute={mute} />
            <RailItem label={t('settings')} Icon={Settings} on={vis?.type === 'settings'} onClick={() => toggleStack('settings')} ink={th.inkText} mute={mute} />
          </div>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="flex items-center gap-4 px-6 h-[64px] flex-shrink-0" style={{ borderBottom: `1px solid ${th.border}` }}>
            <div className="flex-1 flex justify-center min-w-0">
              <label className="flex items-center gap-2 w-full max-w-[420px] h-11 rounded-full px-4" style={{ background: chipBg }}>
                <Search size={15} color={SAGE} className="flex-shrink-0" />
                <input value={q} placeholder={t('searchSounds')}
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none" style={{ color: th.inkText }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQ(v);
                    setFilter((f) => ({ ...f, tag: v, q: v }));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') push({ type: 'search' }); }} />
              </label>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <LanguageSwitch compact />
              <div className="relative">
                <motion.button whileTap={tap.cta} onMouseDown={(e) => e.stopPropagation()} onClick={() => setNotifyOpen((v) => !v)}
                  className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer" style={{ background: chipBg }} aria-expanded={notifyOpen} aria-label={t('notifications')}>
                  <Bell size={16} color={OLIVE} />
                  {prefs.notifyInApp && unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: ACCENT }} />}
                </motion.button>
                <AnimatePresence>
                  {notifyOpen && <NotificationsPopover onClose={() => setNotifyOpen(false)} />}
                </AnimatePresence>
              </div>
              {isLoggedIn ? (
                <div className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full" style={{ background: chipBg }}>
                  <button type="button" onClick={() => {
                    if (desktopView === 'cabinet' && !vis) { setDesktopView('map'); return; }
                    reset();
                    setDesktopView('cabinet');
                  }} className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm" style={{ background: th.lightBg }}>
                      {user?.avatar && String(user.avatar).startsWith('http')
                        ? <img src={String(user.avatar)} alt="" className="w-full h-full object-cover" />
                        : <User size={16} color={OLIVE} />}
                    </div>
                    <div className="text-left hidden lg:block pr-1">
                      <p className="text-xs font-bold leading-tight" style={{ color: th.inkText }}>{user?.displayName || user?.username}</p>
                      <p className="text-[10px] leading-tight" style={{ color: SAGE }}>@{user?.loginName}</p>
                    </div>
                  </button>
                  <HoverMenu items={[
                    { label: t('profile'), onClick: () => { reset(); setDesktopView('cabinet'); } },
                    { label: t('logout'), danger: true, onClick: () => { void logout().then(() => { reset(); setDesktopView('map'); toast(t('loggedOut')); }); } },
                  ]}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center">
                      <ChevronDown size={14} color={SAGE} />
                    </span>
                  </HoverMenu>
                </div>
              ) : (
                <motion.button whileTap={tap.cta} onClick={() => push({ type: 'auth' })}
                  className="h-10 px-4 rounded-full text-[13px] font-bold text-white flex items-center gap-1.5" style={{ background: ACCENT }}>
                  <LogIn size={14} />{t('signIn')}
                </motion.button>
              )}
            </div>
          </header>

          <div className="flex-1 min-h-0 flex p-3 lg:p-4" style={{ gap: mode === 'map' ? 0 : PANEL_GAP }}>
            <aside
              className="min-h-0 min-w-0 overflow-hidden rounded-[24px]"
              style={{
                flex: mode === 'workspace' ? '1 1 0%' : `0 0 ${mode === 'list' ? LIST_W : 0}px`,
                opacity: mode === 'map' ? 0 : 1,
                pointerEvents: mode === 'map' ? 'none' : 'auto',
                background: th.phoneBg,
              }}>
              <div className="h-full w-full flex flex-col min-h-0">
                {vis ? (
                  <div key={vis._id} className="h-full min-h-0">
                    <ScreenContent screen={vis} onBack={pop} />
                  </div>
                ) : (
                  <div key={desktopView} className="h-full min-h-0 overflow-hidden">
                    {desktopView === 'library' && (
                      <div className="h-full overflow-y-auto p-5 scrollbar-none">
                        <CatalogSoundList />
                      </div>
                    )}
                    {desktopView === 'feed' && <FeedScreen showNav={false} embed />}
                    {desktopView === 'expeditions' && <FeedScreen showNav={false} embed initialTab="expeditions" />}
                    {desktopView === 'staff' && <StaffScreen onBack={() => setDesktopView('map')} />}
                    {desktopView === 'cabinet' && isLoggedIn && <ProfileScreen showNav={false} />}
                  </div>
                )}
              </div>
            </aside>

            <div
              className="flex flex-col min-h-0 min-w-0"
              style={{ flex: mode === 'workspace' ? `0 0 ${SIDE_W}px` : '1 1 0%' }}>
              <div className="relative flex-1 min-h-0 rounded-[24px] overflow-hidden" style={{ background: th.phoneBg }}>
                <MapScreen showNav={false} desktop hidePlayer />
              </div>
              {dockSound ? (
                <div className="flex-shrink-0 mt-3 rounded-2xl overflow-y-auto max-h-[56vh]" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
                  <PinPlayer sound={dockSound} simple
                    onClose={() => setFocused(null)}
                    playing={playing && String(playingId) === String(dockSound.id)}
                    onToggle={() => togglePlay(dockSound)}
                    progress={progress}
                    onOpen={() => { if (vis?.type !== 'sound-detail') push({ type: 'sound-detail', sound: dockSound }); }}
                    onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute}
                    onDownload={() => download(dockSound)} />
                </div>
              ) : null}
            </div>
          </div>
          <footer className="flex-shrink-0 h-8 px-6 flex items-center gap-x-3 text-[10px] whitespace-nowrap overflow-hidden" style={{ borderTop: `1px solid ${th.border}`, color: SAGE }}>
            <span>© {year} Полёвка</span>
            <button className="hover:underline cursor-pointer" style={{ color: OLIVE }} onClick={() => openLegal('privacy')}>{t('privacyPolicy')}</button>
            <button className="hover:underline cursor-pointer" style={{ color: OLIVE }} onClick={() => openLegal('terms')}>{t('terms')}</button>
            <button className="hover:underline cursor-pointer" style={{ color: OLIVE }} onClick={() => openLegal('publish')}>{t('publishRules')}</button>
          </footer>
        </div>
      </div>
      <AnimatePresence>
        {isOverlay && top && (
          <motion.div
            key={top._id}
            className="absolute inset-0 z-[500] overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: pickMode ? 0 : 1, y: pickMode ? 8 : 0 }}
            exit={{ opacity: 0, y: 8 }}
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
