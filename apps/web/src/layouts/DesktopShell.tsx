import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar, HelpCircle, Library, LogOut, Map as MapIcon, MessageCircle, Radio,
  Settings, Shield, User,
} from 'lucide-react';
import { color, spring } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useNav, type DesktopView } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { MapScreen } from '../screens/MapScreen';
import { FeedScreen, CatalogSoundList } from '../screens/FeedScreen';
import { GuestProfileScreen, ProfileScreen } from '../screens/ProfileScreen';
import { ScreenContent } from '../screens/stack';

export function DesktopShell() {
  const th = useTh();
  const { isLoggedIn, isStaff, logout } = useAuth();
  const { desktopView, setDesktopView, push, stack, pop, reset } = useNav();

  const items: Array<{ id: DesktopView; Icon: typeof MapIcon; label: string; staff?: boolean }> = [
    { id: 'map', Icon: MapIcon, label: 'Карта' },
    { id: 'library', Icon: Library, label: 'Каталог' },
    { id: 'feed', Icon: Radio, label: 'Лента' },
    { id: 'expeditions', Icon: Calendar, label: 'Экспедиции' },
    { id: 'help', Icon: HelpCircle, label: 'Помощь' },
    { id: 'staff', Icon: Shield, label: 'Staff', staff: true },
    { id: 'cabinet', Icon: User, label: 'Профиль' },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: th.phoneBg }}>
      <nav className="flex flex-col items-center py-4 gap-1 flex-shrink-0" style={{ width: 72, background: th.navBg, borderRight: `1px solid ${th.border}` }}>
        {items.filter((i) => !i.staff || isStaff).map(({ id, Icon, label }) => {
          const on = desktopView === id;
          return (
            <button key={id} title={label} onClick={() => {
              if (id === 'help') { push({ type: 'help' }); return; }
              if (id === 'staff') { push({ type: 'staff' }); return; }
              if (id === 'cabinet') { setDesktopView('cabinet'); return; }
              setDesktopView(id);
            }} className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: on ? color.accent : 'transparent' }}>
              <Icon size={18} color={on ? '#fff' : color.olive} />
            </button>
          );
        })}
        <div className="flex-1" />
        <button title="События" onClick={() => push({ type: 'events' })} className="w-11 h-11 rounded-2xl flex items-center justify-center"><Calendar size={18} color={color.olive} /></button>
        <button title="Сообщения" onClick={() => push({ type: 'messages' })} className="w-11 h-11 rounded-2xl flex items-center justify-center"><MessageCircle size={18} color={color.olive} /></button>
        <button title="Настройки" onClick={() => push({ type: 'settings' })} className="w-11 h-11 rounded-2xl flex items-center justify-center"><Settings size={18} color={color.olive} /></button>
        {isLoggedIn && (
          <button title="Выйти" onClick={() => { void logout(); reset(); }} className="w-11 h-11 rounded-2xl flex items-center justify-center"><LogOut size={18} color={color.olive} /></button>
        )}
      </nav>
      {desktopView !== 'map' && desktopView !== 'cabinet' && (
        <aside className="flex-shrink-0 overflow-hidden" style={{ width: 380, borderRight: `1px solid ${th.border}` }}>
          {desktopView === 'feed' && <FeedScreen showNav={false} />}
          {desktopView === 'library' && (
            <div className="h-full overflow-y-auto p-4" style={{ background: th.phoneBg }}>
              <p className="text-sm font-bold mb-3" style={{ color: th.inkText }}>Каталог</p>
              <CatalogSoundList />
            </div>
          )}
          {desktopView === 'expeditions' && <FeedScreen showNav={false} />}
        </aside>
      )}
      {desktopView === 'cabinet' && (
        <aside className="flex-shrink-0 overflow-hidden" style={{ width: 380, borderRight: `1px solid ${th.border}` }}>
          {isLoggedIn ? <ProfileScreen showNav={false} /> : <GuestProfileScreen showNav={false} />}
        </aside>
      )}
      <div className="relative flex-1 min-w-0">
        <MapScreen showNav={false} />
        <AnimatePresence>
          {stack.map((screen, i) => (
            <motion.div key={screen._id} className="absolute inset-0" style={{ zIndex: 100 + i, background: th.phoneBg }}
              initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={spring.stack}>
              <ScreenContent screen={screen} onBack={pop} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
