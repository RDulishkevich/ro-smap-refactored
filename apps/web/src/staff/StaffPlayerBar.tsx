import type { Sound } from '@polevka/core';
import { MiniPlayer } from '../primitives/MiniPlayer';
import { useData } from '../state/DataContext';

/** Docked player for staff queue — same audio engine as the main app. */
export function StaffPlayerBar({
  sound,
  onOpen,
  onClose,
}: {
  sound: Sound;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { togglePlay, playing, playingId, progress, seek } = useData();
  const on = playing && String(playingId) === String(sound.id);
  return (
    <div className="flex-shrink-0 border-t" style={{ borderColor: 'transparent' }}>
      <MiniPlayer
        sound={sound}
        playing={on}
        progress={on ? progress : 0}
        onToggle={() => togglePlay(sound)}
        onOpen={onOpen}
        onClose={onClose}
        onSeek={seek}
      />
    </div>
  );
}
