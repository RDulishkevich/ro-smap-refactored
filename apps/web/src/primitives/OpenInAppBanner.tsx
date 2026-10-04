import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { color } from '@polevka/design';
import { shouldOfferOpenInApp, tryOpenInstalledApp } from '../lib/launch-pwa';
import { useTh } from '../state/ThemeContext';
import { useT } from '../state/PrefsContext';

const HIDE = 'polevka_hide_open_app';

export function OpenInAppBanner() {
  const th = useTh();
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!shouldOfferOpenInApp()) return;
    try {
      if (sessionStorage.getItem(HIDE)) return;
    } catch { /* */ }
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed left-3 right-3 z-[360]" style={{ top: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}>
      <div className="rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-[0_10px_28px_rgba(45,60,57,0.18)]"
        style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <p className="flex-1 min-w-0 pv-caption leading-snug" style={{ color: th.inkText }}>{t('openInAppHint')}</p>
        <button type="button" className="pv-button flex-shrink-0 h-9 px-3 rounded-2xl text-white"
          style={{ background: color.accent }}
          onClick={() => tryOpenInstalledApp()}>
          {t('openInApp')}
        </button>
        <button type="button" className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: th.lightBg }}
          aria-label={t('close')}
          onClick={() => {
            try { sessionStorage.setItem(HIDE, '1'); } catch { /* */ }
            setShow(false);
          }}>
          <X size={14} color={color.olive} />
        </button>
      </div>
    </div>
  );
}
