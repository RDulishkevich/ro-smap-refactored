import { color } from '@polevka/design';
import { Shield } from 'lucide-react';
import { ScreenHeader } from '../primitives/ui';
import { useTh } from '../state/ThemeContext';
import { useIsDesktop } from '../lib/use-media';
import { StaffHost } from '../staff/StaffHost';

const ACCENT = color.accent;

/** Gate from main app; host mode is the modular staff console. */
export function StaffScreen({ onBack, mode = 'gate' }: { onBack: () => void; mode?: 'gate' | 'host' }) {
  const th = useTh();
  const desktop = useIsDesktop();

  if (mode === 'host') {
    return <StaffHost />;
  }

  const openStaffHost = () => {
    const url = import.meta.env.DEV
      ? `${window.location.origin}/staff.html`
      : 'https://www.polevka.art/staff/';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title="Staff" onBack={onBack} />}
      <div className={`${desktop ? 'p-6' : 'p-4'} flex flex-col gap-4`}>
        <div className="rounded-3xl px-4 py-5 flex flex-col gap-3" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
          <div className="flex items-center gap-2">
            <Shield size={20} color={ACCENT} />
            <p className="pv-heading" style={{ color: th.inkText }}>Staff</p>
          </div>
          <p className="pv-body leading-snug" style={{ color: th.muted }}>
            Админка: очередь с плеером, сообщения, аналитика и настройки пользователей.
          </p>
          <p className="pv-caption" style={{ color: th.soft }}>www.polevka.art/staff</p>
          <button type="button" onClick={openStaffHost} className="pv-button w-full min-h-11 rounded-2xl text-white mt-1"
            style={{ background: ACCENT }}>
            Открыть админку
          </button>
        </div>
      </div>
    </div>
  );
}
