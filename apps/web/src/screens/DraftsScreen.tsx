import { FilePenLine } from 'lucide-react';
import { color, tap } from '@polevka/design';
import { motion } from 'motion/react';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';
import { useUi } from '../state/UiContext';
import { ScreenHeader } from '../primitives/ui';
import { useIsDesktop } from '../lib/use-media';
import { getDraftRecording } from '../lib/record-buffer';
import { formatClock } from '../lib/waveform';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;

function statusLabel(status?: string) {
  if (status === 'pending') return 'На модерации';
  if (status === 'rejected') return 'Отклонено';
  return 'Черновик';
}

export function DraftsScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const t = useT();
  const desktop = useIsDesktop();
  const { user, isLoggedIn } = useAuth();
  const { allSounds } = useData();
  const { push } = useNav();
  const { toast } = useUi();
  const local = getDraftRecording();
  const login = String(user?.loginName || '').toLowerCase();
  const name = String(user?.username || '').toLowerCase();
  const drafts = allSounds.filter((s) => {
    const mine = String(s.recordistId || s.user || '').toLowerCase() === login
      || String(s.recordist || '').toLowerCase() === name;
    return mine && (s.status === 'draft' || s.status === 'pending' || s.status === 'rejected');
  });

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title={t('drafts')} onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto scrollbar-none ${desktop ? 'px-6 pt-6 pb-8' : 'p-4'}`}>
        {desktop && (
          <div className="mb-4">
            <p className="pv-heading" style={{ color: th.inkText }}>{t('drafts')}</p>
            <p className="pv-caption mt-1" style={{ color: OLIVE }}>{t('draftsHint')}</p>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {local && (
            <motion.button type="button" whileTap={tap.cta}
              onClick={() => push({ type: 'add-sound' })}
              className="w-full text-left rounded-3xl p-4"
              style={{ background: th.cardBg }}>
              <p className="pv-micro uppercase" style={{ color: ACCENT }}>{t('draftLocal')}</p>
              <p className="pv-subtitle mt-0.5" style={{ color: th.inkText }}>{t('draftContinue')}</p>
              <p className="pv-caption mt-1" style={{ color: SAGE }}>{formatClock(local.durationSec)}</p>
            </motion.button>
          )}
          {drafts.map((item) => (
            <motion.button key={String(item.id)} type="button" whileTap={tap.cta}
              onClick={() => {
                if (item.status === 'draft' || item.status === 'rejected') push({ type: 'add-sound', edit: item });
                else push({ type: 'sound-detail', sound: item });
              }}
              className="w-full text-left rounded-3xl p-4"
              style={{ background: th.cardBg }}>
              <p className="pv-micro uppercase" style={{ color: item.status === 'rejected' ? ACCENT : SAGE }}>{statusLabel(item.status)}</p>
              <p className="pv-subtitle mt-0.5" style={{ color: th.inkText }}>{item.title || 'Без названия'}</p>
              {item.rejectNote ? <p className="pv-caption mt-1" style={{ color: ACCENT }}>{String(item.rejectNote)}</p> : null}
            </motion.button>
          ))}
          {!local && !drafts.length && (
            <div className="rounded-3xl px-5 py-10 text-center" style={{ background: th.cardBg }}>
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: th.lightBg }}>
                <FilePenLine size={20} color={SAGE} />
              </div>
              <p className="pv-subtitle" style={{ color: th.inkText }}>{t('draftsEmpty')}</p>
              <p className="pv-caption mt-1" style={{ color: SAGE }}>{t('draftsHint')}</p>
              {!isLoggedIn && (
                <button type="button" className="mt-4 pv-button px-4 py-2.5 rounded-2xl text-white"
                  style={{ background: ACCENT }}
                  onClick={() => { toast('Войдите, чтобы видеть облачные черновики'); push({ type: 'auth' }); }}>
                  {t('signIn')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
