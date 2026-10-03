import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScanFace } from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';
import { isStandaloneApp } from '../lib/standalone';
import LogoApp from '@/brand/LogoApp';

const SAGE = color.sage;
const ACCENT = color.accent;

function hideHtmlSplash() {
  document.getElementById('welcome-splash')?.classList.remove('is-on');
  document.getElementById('welcome-splash')?.setAttribute('aria-hidden', 'true');
}

export function WelcomeSplash() {
  const th = useTh();
  const t = useT();
  const { needsUnlock, unlockWithDevice, skipDeviceUnlock } = useAuth();
  const { loading } = useData();
  const standalone = isStandaloneApp();
  const [minHold, setMinHold] = useState(true);
  const [firstBoot, setFirstBoot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { hideHtmlSplash(); }, []);

  useEffect(() => {
    const ms = standalone ? 900 : 400;
    const id = window.setTimeout(() => setMinHold(false), ms);
    return () => window.clearTimeout(id);
  }, [standalone]);

  const booting = loading || minHold;
  useEffect(() => {
    if (!needsUnlock && !booting) setFirstBoot(false);
  }, [needsUnlock, booting]);

  const visible = needsUnlock || (firstBoot && booting);

  useEffect(() => {
    if (!visible) hideHtmlSplash();
  }, [visible]);

  const unlock = async () => {
    setBusy(true);
    setErr('');
    try {
      const ok = await unlockWithDevice();
      if (!ok) setErr(t('unlockExpired'));
    } catch {
      setErr(t('unlockFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="welcome"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-8"
          style={{ background: th.isDark ? '#0E1A18' : '#E8EDEA' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.fade}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.mount}
            className="w-[88px] h-[88px] rounded-[28px] overflow-hidden shadow-xl mb-5"
          >
            <LogoApp />
          </motion.div>
          <h1
            className="text-[34px] leading-none mb-2"
            style={{ fontFamily: 'Klukva, Georgia, serif', color: th.inkText }}
          >
            Полёвка
          </h1>
          <p className="text-[13px] text-center max-w-[260px] mb-8" style={{ color: SAGE }}>
            {needsUnlock ? t('unlockDeviceHint') : t('welcomeTag')}
          </p>
          {needsUnlock ? (
            <div className="w-full max-w-[320px] flex flex-col gap-2">
              <motion.button
                type="button"
                whileTap={tap.cta}
                disabled={busy}
                onClick={() => void unlock()}
                className="w-full h-12 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: ACCENT }}
              >
                <ScanFace size={18} />
                {busy ? '…' : t('unlockDevice')}
              </motion.button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void skipDeviceUnlock()}
                className="w-full h-11 rounded-2xl text-xs font-semibold"
                style={{ color: SAGE }}
              >
                {t('unlockPassword')}
              </button>
              {err ? <p className="text-[11px] text-center" style={{ color: ACCENT }}>{err}</p> : null}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: ACCENT }} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
