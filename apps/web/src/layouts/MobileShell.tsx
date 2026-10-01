import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@polevka/design';
import { useNav } from '../state/NavContext';
import { useAuth } from '../state/AuthContext';
import { useTh } from '../state/ThemeContext';
import { FeedScreen } from '../screens/FeedScreen';
import { MapScreen } from '../screens/MapScreen';
import { GuestProfileScreen, ProfileScreen } from '../screens/ProfileScreen';
import { ScreenContent } from '../screens/stack';
import { PinPlayer } from '../primitives/ui';
import { useData } from '../state/DataContext';
import { audioService } from '../lib/audio-player';

export function MobileShell() {
  const { isLoggedIn } = useAuth();
  const th = useTh();
  const { activeTab, stack, pop, push } = useNav();
  const { sounds, playingId, playing, progress, togglePlay, seek, volume, muted, setVolume, toggleMute } = useData();
  const current = sounds.find((s) => String(s.id) === String(playingId));
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: th.phoneBg }}>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={spring.tab}
          className="absolute inset-0">
          {activeTab === 'feed' && <FeedScreen />}
          {activeTab === 'map' && <MapScreen />}
          {activeTab === 'profile' && (isLoggedIn ? <ProfileScreen /> : <GuestProfileScreen />)}
        </motion.div>
      </AnimatePresence>
      {current && stack.length === 0 && activeTab !== 'map' && (
        <div className="absolute left-3 right-3 z-[90]" style={{ bottom: 88 }}>
          <PinPlayer sound={current} onClose={() => audioService.stop()} simple
            playing={playing} onToggle={() => togglePlay(current)} progress={progress}
            onOpen={() => push({ type: 'sound-detail', sound: current })}
            onSeek={seek} volume={volume} muted={muted} onVolume={setVolume} onMute={toggleMute} />
        </div>
      )}
      <AnimatePresence>
        {stack.map((screen, i) => (
          <motion.div key={screen._id} className="absolute inset-0" style={{ zIndex: 100 + i, background: th.phoneBg }}
            initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={spring.stack}>
            <ScreenContent screen={screen} onBack={pop} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
