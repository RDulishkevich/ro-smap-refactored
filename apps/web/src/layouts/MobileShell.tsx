import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@polevka/design';
import type { TabId } from '../state/NavContext';
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

const TAB_ORDER: TabId[] = ['feed', 'map', 'profile'];

export function MobileShell() {
  const { isLoggedIn } = useAuth();
  const th = useTh();
  const { activeTab, prevTab, stack, pop, push } = useNav();
  const { sounds, playingId, playing, progress, togglePlay } = useData();
  const current = sounds.find((s) => String(s.id) === String(playingId));
  const tabDir = TAB_ORDER.indexOf(activeTab) - TAB_ORDER.indexOf(prevTab);
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: th.phoneBg }}>
      <AnimatePresence mode="wait" custom={tabDir}>
        <motion.div key={activeTab} custom={tabDir}
          initial={{ opacity: 0, x: tabDir >= 0 ? 55 : -55 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tabDir >= 0 ? -55 : 55 }}
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
            onOpen={() => push({ type: 'sound-detail', sound: current })} />
        </div>
      )}
      <AnimatePresence>
        {stack.map((screen, i) => (
          <motion.div key={screen._id} className="absolute inset-0" style={{ zIndex: 100 + i, background: th.phoneBg }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={spring.stack}>
            <ScreenContent screen={screen} onBack={pop} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
