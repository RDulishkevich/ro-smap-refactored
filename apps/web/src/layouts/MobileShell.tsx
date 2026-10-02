import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@polevka/design';
import { useNav, type ScreenConfig } from '../state/NavContext';
import { useAuth } from '../state/AuthContext';
import { useTh } from '../state/ThemeContext';
import { FeedScreen } from '../screens/FeedScreen';
import { MapScreen } from '../screens/MapScreen';
import { GuestProfileScreen, ProfileScreen } from '../screens/ProfileScreen';
import { ScreenContent } from '../screens/stack';
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
  const current = sounds.find((s) => String(s.id) === String(playingId)) || null;
  const dock = focused || current;
  const showChrome = stack.length === 0;
  const onMap = activeTab === 'map';
  const top = stack[stack.length - 1];
  const hideForScreen = !!top && HIDE_PLAYER.includes(top.type);
  const showPlayer = !!dock && !fabOpen && !hideForScreen;

  useEffect(() => { if (!onMap) setFabOpen(false); }, [onMap]);

  return (
    <div className="relative w-full h-full overflow-hidden pv-mobile" style={{ background: th.phoneBg }}>
      <div className="absolute inset-0" style={{ bottom: showChrome ? 'var(--pv-nav-h)' : (showPlayer ? '8.25rem' : 0) }}>
        <div
          className={`absolute inset-0 ${onMap && showChrome ? 'z-[1]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={!onMap || !showChrome}>
          <MapScreen showNav={false} hidePlayer />
        </div>
        <div
          className={`absolute inset-0 ${activeTab === 'feed' && showChrome ? 'z-[2]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={activeTab !== 'feed' || !showChrome}>
          <FeedScreen showNav={false} initialTab="catalog" />
        </div>
        <div
          className={`absolute inset-0 ${activeTab === 'profile' && showChrome ? 'z-[2]' : 'invisible pointer-events-none z-0'}`}
          aria-hidden={activeTab !== 'profile' || !showChrome}>
          {isLoggedIn ? <ProfileScreen showNav={false} /> : <GuestProfileScreen showNav={false} />}
        </div>
      </div>

      {showPlayer && dock && (
        <div
          className="absolute left-3 right-3 z-[220] rounded-3xl overflow-hidden shadow-[0_12px_32px_rgba(45,60,57,0.18)] max-h-[min(42vh,360px)] overflow-y-auto"
          style={{
            bottom: showChrome
              ? (onMap ? 'calc(var(--pv-nav-h) + 2.35rem)' : 'calc(var(--pv-nav-h) + 0.5rem)')
              : '0.75rem',
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
        <div className="absolute left-0 right-0 bottom-0 z-[95] pv-mobile-nav">
          {onMap && (
            <div className="absolute left-1/2 z-20" style={{ top: 0, transform: 'translate(-50%, -50%)' }}>
              <MapFab open={fabOpen} onToggle={() => setFabOpen((o) => !o)} from="center" />
            </div>
          )}
          <div style={{
            background: th.navBg,
            borderTop: `1px solid ${th.border}`,
            maskImage: onMap ? 'radial-gradient(circle 36px at 50% 0%, transparent 34px, black 36px)' : undefined,
            WebkitMaskImage: onMap ? 'radial-gradient(circle 36px at 50% 0%, transparent 34px, black 36px)' : undefined,
          }}>
            <NavBar hollowCenter={onMap} />
          </div>
        </div>
      )}

      <AnimatePresence>
        {stack.map((screen, i) => (
          <motion.div key={screen._id} className="absolute inset-0" style={{
            zIndex: 100 + i,
            background: th.phoneBg,
            bottom: showPlayer ? '8.25rem' : 0,
          }}
            initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={spring.stack}>
            <ScreenContent screen={screen} onBack={pop} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
