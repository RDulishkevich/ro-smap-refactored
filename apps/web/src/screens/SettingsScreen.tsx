import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Info, LogOut, Volume2 } from 'lucide-react';
import { color } from '@polevka/design';
import { apiExportMyData, apiLogoutAll } from '@polevka/core';
import { canUseDeviceUnlock } from '../lib/device-unlock';
import { useAuth } from '../state/AuthContext';
import { useNav } from '../state/NavContext';
import { useData } from '../state/DataContext';
import { useTh, useToggleTheme, useIsDark } from '../state/ThemeContext';
import { usePrefs, useT } from '../state/PrefsContext';
import { useUi } from '../state/UiContext';
import { useIsDesktop } from '../lib/use-media';
import { ScreenHeader } from '../primitives/ui';
import { LanguageSwitch } from '../primitives/LanguageSwitch';
import { openCookieBanner } from '../primitives/CookieBanner';

const OLIVE = color.olive;
const SAGE = color.sage;
const DARK = color.dark;
const MIST = color.mist;

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const desktop = useIsDesktop();
  const toggle = useToggleTheme();
  const dark = useIsDark();
  const { logout, isStaff, isLoggedIn, user, offerDeviceUnlock, disableDeviceUnlock, deviceUnlockReady } = useAuth();
  const [waOk, setWaOk] = useState(false);
  useEffect(() => { void canUseDeviceUnlock().then(setWaOk); }, []);
  const { push, reset } = useNav();
  const { toast, confirm } = useUi();
  const { prefs, setPref } = usePrefs();
  const { volume, setVolume } = useData();
  const t = useT();

  const logoutEverywhere = async () => {
    const ok = await confirm({ title: t('logoutEverywhereQ'), body: t('logoutEverywhereBody'), ok: t('logoutAll') });
    if (!ok) return;
    try { await apiLogoutAll(); } catch { /* still clear local */ }
    await logout();
    reset();
    toast(t('sessionsEnded'));
  };

  const exportOwnData = async () => {
    try {
      const data = await apiExportMyData() as { data?: unknown };
      const payload = data.data ?? data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polevka-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t('dataExported'));
    } catch (e: unknown) {
      toast((e as Error).message || t('downloadMyData'));
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title={t('settings')} onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto scrollbar-none flex flex-col gap-4 ${desktop ? 'p-6' : 'p-4'}`}>
        {desktop && <p className="pv-heading" style={{ color: th.inkText }}>{t('settings')}</p>}

        <Section title={t('language')} th={th}>
          <Row label={t('lang')} th={th} right={<LanguageSwitch />} />
        </Section>

        <Section title={t('appearance')} th={th}>
          <Row label={t('darkTheme')} th={th} right={<Switch on={dark} onChange={toggle} />} />
          <Row label={t('lessMotion')} th={th} right={<Switch on={prefs.reduceMotion} onChange={() => setPref('reduceMotion', !prefs.reduceMotion)} />} />
        </Section>

        <Section title={t('mapAndSound')} th={th}>
          <Row label={t('autoplayPin')} th={th}
            right={<Switch on={prefs.autoplayPin} onChange={() => setPref('autoplayPin', !prefs.autoplayPin)} />} />
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="pv-label" style={{ color: th.inkText }}>{t('volume')}</span>
              <span className="pv-micro" style={{ color: SAGE }}>{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 size={14} color={OLIVE} />
              <input type="range" min={0} max={1} step={0.01} value={volume} aria-label={t('volume')}
                className="flex-1 accent-[#92B3B1]"
                onChange={(e) => setVolume(Number(e.target.value))} />
            </div>
          </div>
        </Section>

        <Section title={t('notifications')} th={th}>
          <Row label={t('notifyInApp')} th={th}
            right={<Switch on={prefs.notifyInApp} onChange={() => setPref('notifyInApp', !prefs.notifyInApp)} />} />
        </Section>

        <Section title={t('privacy')} th={th}>
          <Row label={t('cookies')} th={th} right={<Info size={16} color={OLIVE} />} onClick={() => openCookieBanner()} />
          <Row label={t('privacyPolicy')} th={th} onClick={() => push({ type: 'legal', doc: 'privacy' })} />
          <Row label={t('terms')} th={th} onClick={() => push({ type: 'legal', doc: 'terms' })} />
          <Row label={t('publishRules')} th={th} onClick={() => push({ type: 'legal', doc: 'publish' })} />
        </Section>

        <Section title={t('account')} th={th}>
          {isLoggedIn && <Row label={t('profileSecurity')} th={th} onClick={() => push({ type: 'cabinet' })} />}
          {isLoggedIn && waOk && (
            <Row
              label={t('enableFaceId')}
              th={th}
              right={<Switch on={deviceUnlockReady} onChange={() => {
                void (async () => {
                  if (deviceUnlockReady) {
                    disableDeviceUnlock();
                    toast(t('deviceUnlockOff'));
                    return;
                  }
                  try {
                    await offerDeviceUnlock();
                    toast(t('deviceUnlockOn'));
                  } catch {
                    toast(t('unlockFailed'));
                  }
                })();
              }} />}
            />
          )}
          {isLoggedIn && <Row label={t('downloadMyData')} th={th} onClick={() => void exportOwnData()} />}
          {isLoggedIn && user?.loginName !== 'admin' && user?.loginName !== 'support' && (
            <Row label={t('deleteAccount')} th={th} onClick={() => push({ type: 'delete-account' })} />
          )}
          <Row label={t('helpSupport')} th={th} onClick={() => push({ type: 'help' })} />
          {isStaff && <Row label={t('staff')} th={th} onClick={() => push({ type: 'staff' })} />}
        </Section>

        {isLoggedIn && (
          <>
            <motion.button whileTap={{ scale: 0.96 }} className="pv-button w-full py-3 rounded-2xl flex items-center justify-center gap-2 text-white" style={{ background: DARK }}
              onClick={async () => { await logout(); reset(); toast(t('loggedOut')); }}>
              <LogOut size={15} />{t('logout')}
            </motion.button>
            <button type="button" className="pv-button w-full py-3 rounded-2xl cursor-pointer" style={{ background: th.cardBg, color: OLIVE }}
              onClick={() => void logoutEverywhere()}>
              {t('logoutAll')}
            </button>
          </>
        )}

        <p className="pv-micro text-center pb-4" style={{ color: SAGE }}>Полёвка · polevka.art</p>
      </div>
    </div>
  );
}

function Section({ title, children, th }: { title: string; children: ReactNode; th: { inkText: string; cardBg: string } }) {
  return (
    <section>
      <p className="pv-label uppercase px-1 mb-1.5" style={{ color: SAGE }}>{title}</p>
      <div className="rounded-3xl overflow-hidden" style={{ background: th.cardBg }}>{children}</div>
    </section>
  );
}

function Row({ label, right, th, onClick }: { label: string; right?: ReactNode; th: { cardBg: string; inkText: string }; onClick?: () => void }) {
  const cls = 'w-full flex items-center justify-between px-4 py-3.5 text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} cursor-pointer`} style={{ background: th.cardBg }}>
        <span className="pv-subtitle" style={{ color: th.inkText }}>{label}</span>
        {right || <span style={{ color: SAGE }}>›</span>}
      </button>
    );
  }
  return (
    <div className={cls} style={{ background: th.cardBg }}>
        <span className="pv-subtitle" style={{ color: th.inkText }}>{label}</span>
      {right}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="w-10 h-6 rounded-full relative flex-shrink-0"
      style={{ background: on ? MIST : 'rgba(45,60,57,0.18)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}
