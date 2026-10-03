import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Info, LogOut, Volume2 } from 'lucide-react';
import { color } from '@polevka/design';
import { apiLogoutAll } from '@polevka/core';
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
  const { logout, isStaff, isLoggedIn } = useAuth();
  const { push, reset } = useNav();
  const { toast, confirm } = useUi();
  const { prefs, setPref } = usePrefs();
  const { volume, setVolume } = useData();
  const t = useT();

  const logoutEverywhere = async () => {
    const ok = await confirm({ title: 'Выйти везде?', body: 'Все сессии на других устройствах будут завершены.', ok: 'Выйти везде' });
    if (!ok) return;
    try { await apiLogoutAll(); } catch { /* still clear local */ }
    await logout();
    reset();
    toast('Все сессии завершены');
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title={t('settings')} onBack={onBack} />}
      <div className={`flex-1 overflow-y-auto scrollbar-none flex flex-col gap-4 ${desktop ? 'p-6' : 'p-4'}`}>
        {desktop && <p className="text-lg font-bold" style={{ color: th.inkText }}>{t('settings')}</p>}

        <Section title={t('language')} th={th}>
          <Row label={t('lang')} th={th} right={<LanguageSwitch />} />
        </Section>

        <Section title={t('appearance')} th={th}>
          <Row label="Тёмная тема" th={th} right={<Switch on={dark} onChange={toggle} />} />
          <Row label="Меньше анимации" th={th} right={<Switch on={prefs.reduceMotion} onChange={() => setPref('reduceMotion', !prefs.reduceMotion)} />} />
        </Section>

        <Section title="Карта и звук" th={th}>
          <Row label="Автовоспроизведение метки" th={th}
            right={<Switch on={prefs.autoplayPin} onChange={() => setPref('autoplayPin', !prefs.autoplayPin)} />} />
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: th.inkText }}>Громкость</span>
              <span className="text-[10px] font-semibold" style={{ color: SAGE }}>{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Volume2 size={14} color={OLIVE} />
              <input type="range" min={0} max={1} step={0.01} value={volume} aria-label="Громкость"
                className="flex-1 accent-[#92B3B1]"
                onChange={(e) => setVolume(Number(e.target.value))} />
            </div>
          </div>
        </Section>

        <Section title="Уведомления" th={th}>
          <Row label="Показывать в приложении" th={th}
            right={<Switch on={prefs.notifyInApp} onChange={() => setPref('notifyInApp', !prefs.notifyInApp)} />} />
        </Section>

        <Section title="Конфиденциальность" th={th}>
          <Row label="Cookies и согласие" th={th} right={<Info size={16} color={OLIVE} />} onClick={() => openCookieBanner()} />
          <Row label="Политика конфиденциальности" th={th} onClick={() => push({ type: 'legal', doc: 'privacy' })} />
          <Row label="Условия использования" th={th} onClick={() => push({ type: 'legal', doc: 'terms' })} />
          <Row label="Правила публикации" th={th} onClick={() => push({ type: 'legal', doc: 'publish' })} />
        </Section>

        <Section title="Аккаунт" th={th}>
          {isLoggedIn && <Row label="Профиль и безопасность" th={th} onClick={() => push({ type: 'cabinet' })} />}
          <Row label="Помощь и поддержка" th={th} onClick={() => push({ type: 'help' })} />
          {isStaff && <Row label="Модерация" th={th} onClick={() => push({ type: 'staff' })} />}
        </Section>

        {isLoggedIn && (
          <>
            <motion.button whileTap={{ scale: 0.96 }} className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 text-white" style={{ background: DARK }}
              onClick={async () => { await logout(); reset(); toast('Вы вышли'); }}>
              <LogOut size={15} />Выйти
            </motion.button>
            <button type="button" className="w-full py-3 rounded-2xl text-xs font-semibold" style={{ background: th.cardBg, color: OLIVE }}
              onClick={() => void logoutEverywhere()}>
              Выйти на всех устройствах
            </button>
          </>
        )}

        <p className="text-[10px] text-center pb-4" style={{ color: SAGE }}>Полёвка · polevka.art</p>
      </div>
    </div>
  );
}

function Section({ title, children, th }: { title: string; children: ReactNode; th: { inkText: string; cardBg: string } }) {
  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-wide px-1 mb-1.5" style={{ color: SAGE }}>{title}</p>
      <div className="rounded-3xl overflow-hidden" style={{ background: th.cardBg }}>{children}</div>
    </section>
  );
}

function Row({ label, right, th, onClick }: { label: string; right?: ReactNode; th: { cardBg: string; inkText: string }; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 text-left" style={{ background: th.cardBg }}>
      <span className="text-xs font-semibold" style={{ color: th.inkText }}>{label}</span>
      {right || (onClick ? <span style={{ color: SAGE }}>›</span> : null)}
    </button>
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
