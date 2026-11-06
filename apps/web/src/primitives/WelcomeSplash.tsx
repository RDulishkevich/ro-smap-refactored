import { useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScanFace } from 'lucide-react';
import { color, spring, tap } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useT } from '../state/PrefsContext';
import { isStandaloneApp } from '../lib/standalone';

const ACCENT = color.accent;

function hideHtmlSplash() {
  const el = document.getElementById('welcome-splash');
  if (!el) return;
  el.classList.remove('is-on');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('hidden', '');
  el.style.display = 'none';
  el.remove();
}

export function WelcomeSplash() {
  const t = useT();
  const { needsUnlock, unlockWithDevice, skipDeviceUnlock } = useAuth();
  const { loading } = useData();
  const standalone = isStandaloneApp();
  const [minHold, setMinHold] = useState(true);
  const [firstBoot, setFirstBoot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useLayoutEffect(() => { hideHtmlSplash(); }, []);

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
          className="fixed inset-0 z-[200] flex flex-col items-start justify-end px-8 pb-16"
          style={{ background: '#131513' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.fade}
        >
          <img
            src="/auth/field.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: '28% 42%' }}
          />
          <span
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(19,21,19,0.22) 0%, rgba(19,21,19,0.5) 46%, rgba(19,21,19,0.88) 100%)' }}
          />
          <div className="relative z-[1] w-full max-w-[320px]">
          <h1 className="pv-display mb-2" style={{ color: '#F2F0EA', textShadow: '0 1px 18px rgba(0,0,0,0.55)' }}>
            Полёвка
          </h1>
          <p className="pv-caption max-w-[260px] mb-8" style={{ color: '#E7E8E4', textShadow: '0 1px 14px rgba(0,0,0,0.5)' }}>
            {needsUnlock ? t('unlockDeviceHint') : t('welcomeTag')}
          </p>
          {needsUnlock ? (
            <div className="w-full max-w-[320px] flex flex-col gap-2">
              <motion.button
                type="button"
                whileTap={tap.cta}
                disabled={busy}
                onClick={() => void unlock()}
                className="pv-button w-full h-12 rounded-2xl text-white flex items-center justify-center gap-2"
                style={{ background: ACCENT }}
              >
                <ScanFace size={18} />
                {busy ? '…' : t('unlockDevice')}
              </motion.button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void skipDeviceUnlock()}
                className="pv-button w-full h-11 rounded-2xl"
                style={{ color: 'rgba(242,240,234,0.78)' }}
              >
                {t('unlockPassword')}
              </button>
              {err ? <p className="pv-caption" style={{ color: '#E7D5C8' }}>{err}</p> : null}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: ACCENT }} />
          )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
