import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@polevka/design';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useAuth } from '../state/AuthContext';
import { useTh } from '../state/ThemeContext';
import { MapScreen } from '../screens/MapScreen';
import { GuestProfileScreen, ProfileScreen } from '../screens/ProfileScreen';
import { MenuHub } from '../screens/MenuHub';
import { ScreenContent, MessagesScreen } from '../screens/stack';
import { NavBar, PinPlayer } from '../primitives/ui';
import { MapFab } from '../primitives/chrome';
import { useData } from '../state/DataContext';
import { audioService } from '../lib/audio-player';

const HIDE_PLAYER: ScreenConfig['type'][] = [
  'auth', 'record', 'add-sound', 'legal', 'reset-password',
  'pick-location', 'guessr', 'map-location',
];

export function MobileShell() {
  const { isLoggedIn } = useAuth();
  const th = useTh();
  const { activeTab, stack, pop, push } = useNav();
  const {
    sounds, playingId, playing, progress, togglePlay, seek, volume, muted, setVolume, toggleMute,
    focused, setFocused,
  } = useData();
  const [fabOpen, setFabOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [dockH, setDockH] = useState(0);
  const current = sounds.find((s) => String(s.id) === String(playingId)) || null;
  const dock = focused || current;
  const showChrome = stack.length === 0;
  const onMap = activeTab === 'map';
  const top = stack[stack.length - 1];
  const hideForScreen = !!top && HIDE_PLAYER.includes(top.type);
  const showPlayer = !!dock && !fabOpen && !hideForScreen;

  useEffect(() => {
    const el = dockRef.current;
    if (!showPlayer || !el) {
      setDockH(0);
      return;
    }
    const apply = () => setDockH(Math.ceil(el.getBoundingClientRect().height));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPlayer, dock?.id]);

  const contentBottom = showChrome
    ? (showPlayer
      ? `calc(var(--pv-nav-h) + var(--pv-fab-gap) + ${dockH}px + 0.7rem)`
      : 'calc(var(--pv-nav-h) + var(--pv-fab-gap))')
    : (showPlayer ? `calc(${Math.max(dockH, 72)}px + 0.75rem)` : '0px');
  const playerBottom = showChrome
    ? 'calc(var(--pv-nav-h) + var(--pv-fab-gap))'
    : '0.75rem';

  return (
    <div className="relative w-full h-full overflow-hidden pv-mobile" style={{ background: th.phoneBg }}>
      <div className="absolute inset-0" style={{ bottom: contentBottom }}>
        <div
          className={`pv-mobile-map ${onMap && showChrome ? 'z-[1]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={!onMap || !showChrome}>
          <div className="pv-mobile-map-card">
            <MapScreen showNav={false} hidePlayer />
          </div>
        </div>
        <div
          className={`absolute inset-0 ${activeTab === 'menu' && showChrome ? 'z-[2]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={activeTab !== 'menu' || !showChrome}>
          <MenuHub />
        </div>
        <div
          className={`absolute inset-0 ${activeTab === 'messages' && showChrome ? 'z-[2]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={activeTab !== 'messages' || !showChrome}>
          <MessagesScreen embed />
        </div>
        <div
          className={`absolute inset-0 ${activeTab === 'profile' && showChrome ? 'z-[2]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={activeTab !== 'profile' || !showChrome}>
          {isLoggedIn ? <ProfileScreen showNav={false} /> : <GuestProfileScreen showNav={false} />}
        </div>
      </div>

      {showPlayer && dock && (
        <div
          ref={dockRef}
          className="absolute z-[220] rounded-[24px] overflow-hidden shadow-[0_12px_32px_rgba(45,60,57,0.16)] max-h-[min(42vh,360px)] overflow-y-auto"
          style={{
            left: 'var(--pv-gutter)',
            right: 'var(--pv-gutter)',
            bottom: playerBottom,
            background: th.cardBg,
          }}>
          <PinPlayer
            key={String(dock.id)}
            sound={dock}
            simple
            onClose={() => { setFocused(null); audioService.stop(); }}
            playing={playing && String(playingId) === String(dock.id)}
            onToggle={() => togglePlay(dock)}
            progress={String(playingId) === String(dock.id) ? progress : 0}
            onOpen={() => {
              if (top?.type !== 'sound-detail' || String((top as { sound?: { id?: unknown } }).sound?.id) !== String(dock.id)) {
                push({ type: 'sound-detail', sound: dock });
              }
            }}
            onSeek={String(playingId) === String(dock.id) ? seek : undefined}
            volume={volume}
            muted={muted}
            onVolume={setVolume}
            onMute={toggleMute} />
        </div>
      )}

      {showChrome && (
        <div className="absolute left-0 right-0 z-[95] pv-mobile-nav" style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="absolute left-1/2 z-20" style={{ top: 0, transform: 'translate(-50%, -50%)' }}>
            <MapFab open={fabOpen} onToggle={() => setFabOpen((o) => !o)} from="center" />
          </div>
          <div
            className="mx-[var(--pv-gutter)] rounded-[24px] overflow-hidden shadow-[0_10px_28px_rgba(45,60,57,0.14)]"
            style={{
              background: th.cardBg,
              maskImage: 'radial-gradient(circle 36px at 50% 0%, transparent 34px, black 36px)',
              WebkitMaskImage: 'radial-gradient(circle 36px at 50% 0%, transparent 34px, black 36px)',
            }}>
            <NavBar hollowCenter />
          </div>
        </div>
      )}

      <AnimatePresence>
        {stack.map((screen, i) => (
          <motion.div key={screen._id} className="absolute inset-0" style={{
            zIndex: 100 + i,
            background: th.phoneBg,
            bottom: showPlayer ? `calc(${Math.max(dockH, 72)}px + 0.75rem)` : 0,
          }}
            initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={spring.stack}>
            <ScreenContent screen={screen} onBack={pop} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
